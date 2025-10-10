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
  if (!value) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const valid = value.filter((item): item is UserPermission => userPermissions.includes(item as UserPermission));
  return valid;
};

export const GET = withAuth(async () => {
  const users = await userService.list();
  return NextResponse.json(users);
}, { permission: "users:manage" });

export const POST = withAuth(async (request) => {
  const payload = await request.json().catch(() => null);

  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const name = typeof payload?.name === "string" ? payload.name : undefined;
  const role = sanitizeRole(payload?.role) ?? "viewer";
  const permissions = sanitizePermissions(payload?.permissions) ?? rolePermissions[role] ?? [];

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  try {
    const user = await userService.create({
      email,
      password,
      name,
      role,
      permissions,
      isSuperAdmin: false
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (
      error?.code === "SQLITE_CONSTRAINT" ||
      (typeof error?.message === "string" && error.message.includes("UNIQUE constraint failed"))
    ) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 409 });
    }
    console.error("Failed to create user", error);
    return NextResponse.json({ message: "Unable to create user." }, { status: 500 });
  }
}, { permission: "users:manage" });
