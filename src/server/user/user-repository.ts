import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/server/database/client";
import { userPermissions } from "@/types/user";
import type { UserPermission, UserRecord, UserRole } from "@/types/user";

const VALID_PERMISSION_SET = new Set(userPermissions);

class UserRepository {
  private normalizePermissions(input: UserPermission[] = []): UserPermission[] {
    return input.filter((permission) => VALID_PERMISSION_SET.has(permission));
  }

  private mapPermissions(raw: Prisma.JsonValue | null): UserPermission[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (entry): entry is UserPermission =>
        typeof entry === "string" && VALID_PERMISSION_SET.has(entry as UserPermission)
    );
  }

  private mapUser(user: User): UserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name ?? null,
      role: user.role as UserRole,
      permissions: this.mapPermissions(user.permissions),
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt.toISOString()
    };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    return user ? this.mapUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  async all(): Promise<UserRecord[]> {
    const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
    return users.map((user) => this.mapUser(user));
  }

  async count(): Promise<number> {
    return prisma.user.count();
  }

  async create(input: {
    email: string;
    passwordHash: string;
    name?: string | null;
    role: UserRole;
    permissions: UserPermission[];
    isSuperAdmin?: boolean;
  }): Promise<UserRecord> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: input.passwordHash,
        name: input.name ?? null,
        role: input.role,
        permissions: this.normalizePermissions(input.permissions),
        isSuperAdmin: Boolean(input.isSuperAdmin)
      }
    });

    return this.mapUser(user);
  }

  async update(
    id: string,
    input: {
      email?: string;
      passwordHash?: string;
      name?: string | null;
      role?: UserRole;
      permissions?: UserPermission[];
      isSuperAdmin?: boolean;
    }
  ): Promise<UserRecord | null> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const data: Prisma.UserUpdateInput = {};

    if (input.email !== undefined) {
      data.email = input.email.trim().toLowerCase();
    }
    if (input.passwordHash !== undefined) {
      data.passwordHash = input.passwordHash;
    }
    if (input.name !== undefined) {
      data.name = input.name ?? null;
    }
    if (input.role !== undefined) {
      data.role = input.role;
    }
    if (input.permissions !== undefined) {
      data.permissions = this.normalizePermissions(input.permissions);
    }
    if (input.isSuperAdmin !== undefined) {
      data.isSuperAdmin = input.isSuperAdmin;
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });
    return this.mapUser(updated);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error?.code === "P2025") {
        return false;
      }
      throw error;
    }
  }
}

export default UserRepository;
