"use server";

import { NextResponse } from "next/server";
import UserService from "@/server/user/user-service";
import { withAuth } from "@/server/auth/authorization";
import { rolePermissions, userPermissions } from "@/types/user";
import type { UserPermission, UserRole } from "@/types/user";

const userService = new UserService();

const sanitizeRole = (value: unknown): UserRole | null => {
  if (value === "admin" || value === "operator" || value === "viewer") {
    return value;
  }
  return null;
};

const sanitizePermissions = (value: unknown): UserPermission[] | null => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const valid = value.filter((item): item is UserPermission => userPermissions.includes(item as UserPermission));
  return valid;
};

const hasUserManagementPermission = (permissions: UserPermission[]) =>
  permissions.includes("users:manage");

export const runtime = "nodejs";

export const PATCH = withAuth(async (request, { params }, currentUser) => {
  const userId = params?.id;
  if (!userId) {
    return NextResponse.json({ message: "User id is required." }, { status: 400 });
  }

  const existing = await userService.getById(userId);
  if (!existing) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));

  const updates: {
    email?: string;
    password?: string;
    name?: string | null;
    role?: UserRole;
    permissions?: UserPermission[];
  } = {};

  if (payload.email !== undefined) {
    if (typeof payload.email !== "string" || !payload.email.trim()) {
      return NextResponse.json({ message: "Email must be a non-empty string." }, { status: 400 });
    }
    const nextEmail = payload.email.trim();
    if (nextEmail.toLowerCase() !== existing.email.toLowerCase()) {
      updates.email = nextEmail;
    }
  }

  if (payload.name !== undefined) {
    const nextName = typeof payload.name === "string" ? payload.name : null;
    if (nextName !== existing.name) {
      updates.name = nextName;
    }
  }

  if (payload.password !== undefined) {
    if (typeof payload.password !== "string" || !payload.password.trim()) {
      return NextResponse.json({ message: "Password must be a non-empty string." }, { status: 400 });
    }
    updates.password = payload.password;
  }

  if (payload.role !== undefined) {
    const role = sanitizeRole(payload.role);
    if (!role) {
      return NextResponse.json({ message: "Invalid role provided." }, { status: 400 });
    }
    if (role !== existing.role) {
      updates.role = role;
    }
  }

  if (payload.permissions !== undefined) {
    const permissions = sanitizePermissions(payload.permissions);
    if (!permissions) {
      return NextResponse.json({ message: "Invalid permissions payload." }, { status: 400 });
    }
    const samePermissions =
      permissions.length === existing.permissions.length &&
      permissions.every((perm) => existing.permissions.includes(perm));
    if (!samePermissions) {
      updates.permissions = permissions;
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ message: "No updates provided." }, { status: 400 });
  }

  if (
    existing.isSuperAdmin &&
    (Object.prototype.hasOwnProperty.call(updates, "email") ||
      Object.prototype.hasOwnProperty.call(updates, "role") ||
      Object.prototype.hasOwnProperty.call(updates, "permissions"))
  ) {
    return NextResponse.json({ message: "Default super administrator cannot be reassigned." }, { status: 400 });
  }

  if (updates.role && updates.permissions === undefined) {
    updates.permissions = rolePermissions[updates.role];
  }

  const nextRole = updates.role ?? existing.role;
  const nextPermissions = updates.permissions ?? existing.permissions;

  if (existing.role === "admin" && nextRole !== "admin") {
    const otherAdmins = (await userService.list()).filter((user) => user.id !== existing.id && user.role === "admin");
    if (!otherAdmins.length) {
      return NextResponse.json(
        { message: "At least one administrator must remain in the system." },
        { status: 400 }
      );
    }
  }

  if (
    hasUserManagementPermission(existing.permissions) &&
    !hasUserManagementPermission(nextPermissions)
  ) {
    const otherManagers = (await userService.list()).filter((user) => user.id !== existing.id && hasUserManagementPermission(user.permissions));
    if (!otherManagers.length) {
      return NextResponse.json(
        { message: "At least one user must retain user management permissions." },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await userService.update(userId, updates);
    if (!updated) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // If the current user modified themselves and removed permissions, refresh their session.
    if (currentUser.id === updated.id && !hasUserManagementPermission(updated.permissions)) {
      // Nothing to do here directly; the frontend will refresh permissions on next request.
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (
      error?.code === "SQLITE_CONSTRAINT" ||
      (typeof error?.message === "string" && error.message.includes("UNIQUE constraint failed"))
    ) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }
    console.error(`Failed to update user ${userId}`, error);
    return NextResponse.json({ message: "Unable to update user." }, { status: 500 });
  }
}, { permission: "users:manage" });

export const DELETE = withAuth(async (_request, { params }, currentUser) => {
  const userId = params?.id;
  if (!userId) {
    return NextResponse.json({ message: "User id is required." }, { status: 400 });
  }

  const existing = await userService.getById(userId);
  if (!existing) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if (existing.id === currentUser.id) {
    return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  }

  if (existing.isSuperAdmin) {
    return NextResponse.json({ message: "Default super administrator cannot be deleted." }, { status: 400 });
  }

  if (existing.role === "admin") {
    const otherAdmins = (await userService.list()).filter((user) => user.id !== existing.id && user.role === "admin");
    if (!otherAdmins.length) {
      return NextResponse.json(
        { message: "At least one administrator must remain in the system." },
        { status: 400 }
      );
    }
  }

  if (hasUserManagementPermission(existing.permissions)) {
    const otherManagers = (await userService.list()).filter((user) => user.id !== existing.id && hasUserManagementPermission(user.permissions));
    if (!otherManagers.length) {
      return NextResponse.json(
        { message: "At least one user must retain user management permissions." },
        { status: 400 }
      );
    }
  }

  try {
    const removed = await userService.delete(userId);
    if (!removed) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete user ${userId}`, error);
    return NextResponse.json({ message: "Unable to delete user." }, { status: 500 });
  }
}, { permission: "users:manage" });
