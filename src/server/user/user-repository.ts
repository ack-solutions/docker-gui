import type { Repository } from "typeorm";
import { getDataSource } from "@/server/database/data-source";
import { UserEntity } from "@/server/user/user.entity";
import { userPermissions } from "@/types/user";
import type { UserPermission, UserRecord, UserRole } from "@/types/user";

const VALID_PERMISSION_SET = new Set(userPermissions);

class UserRepository {
  private normalizePermissions(input: UserPermission[] = []): UserPermission[] {
    return input.filter((permission) => VALID_PERMISSION_SET.has(permission));
  }

  private async getRepository(): Promise<Repository<UserEntity>> {
    const dataSource = await getDataSource();
    return dataSource.getRepository(UserEntity);
  }

  private mapPermissions(raw: unknown): UserPermission[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((entry): entry is UserPermission => typeof entry === "string" && VALID_PERMISSION_SET.has(entry as UserPermission));
  }

  private mapUser(user: UserEntity): UserRecord {
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
    const repository = await this.getRepository();
    const normalizedEmail = email.trim().toLowerCase();
    const user = await repository.findOne({ where: { email: normalizedEmail } });
    return user ? this.mapUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const repository = await this.getRepository();
    const user = await repository.findOne({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  async all(): Promise<UserRecord[]> {
    const repository = await this.getRepository();
    const users = await repository.find({ order: { email: "ASC" } });
    return users.map((user) => this.mapUser(user));
  }

  async count(): Promise<number> {
    const repository = await this.getRepository();
    return repository.count();
  }

  async create(input: {
    email: string;
    passwordHash: string;
    name?: string | null;
    role: UserRole;
    permissions: UserPermission[];
    isSuperAdmin?: boolean;
  }): Promise<UserRecord> {
    const repository = await this.getRepository();
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = repository.create({
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      role: input.role,
      permissions: this.normalizePermissions(input.permissions),
      isSuperAdmin: Boolean(input.isSuperAdmin)
    });

    await repository.save(user);

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
    const repository = await this.getRepository();
    const existing = await repository.findOne({ where: { id } });
    if (!existing) {
      return null;
    }

    if (input.email !== undefined) {
      existing.email = input.email.trim().toLowerCase();
    }
    if (input.passwordHash !== undefined) {
      existing.passwordHash = input.passwordHash;
    }
    if (input.name !== undefined) {
      existing.name = input.name ?? null;
    }
    if (input.role !== undefined) {
      existing.role = input.role;
    }
    if (input.permissions !== undefined) {
      existing.permissions = this.normalizePermissions(input.permissions);
    }
    if (input.isSuperAdmin !== undefined) {
      existing.isSuperAdmin = input.isSuperAdmin;
    }

    await repository.save(existing);
    return this.mapUser(existing);
  }

  async delete(id: string): Promise<boolean> {
    const repository = await this.getRepository();
    const existing = await repository.findOne({ where: { id } });
    if (!existing) {
      return false;
    }

    await repository.remove(existing);
    return true;
  }
}

export default UserRepository;
