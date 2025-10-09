import bcrypt from "bcryptjs";
import UserRepository from "@/server/user/user-repository";
import { rolePermissions } from "@/types/user";
import type { User, UserPermission, UserRecord, UserRole } from "@/types/user";

class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  getById(id: string): User | null {
    const record = this.repository.findById(id);
    return record ? this.toUser(record) : null;
  }

  getByEmail(email: string): User | null {
    const record = this.repository.findByEmail(email);
    return record ? this.toUser(record) : null;
  }

  list(): User[] {
    return this.repository.all().map((record) => this.toUser(record));
  }

  create(input: {
    email: string;
    password: string;
    name?: string | null;
    role: UserRole;
    permissions?: UserPermission[];
  }): User {
    const passwordHash = bcrypt.hashSync(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? "10"));
    const permissions = input.permissions?.length ? input.permissions : rolePermissions[input.role] ?? [];
    const record = this.repository.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
      role: input.role,
      permissions
    });
    return this.toUser(record);
  }

  update(
    id: string,
    input: {
      email?: string;
      password?: string;
      name?: string | null;
      role?: UserRole;
      permissions?: UserPermission[];
    }
  ): User | null {
    const passwordHash = input.password
      ? bcrypt.hashSync(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? "10"))
      : undefined;
    const record = this.repository.update(id, {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      permissions: input.permissions
    });
    return record ? this.toUser(record) : null;
  }

  delete(id: string): boolean {
    return this.repository.delete(id);
  }

  count(): number {
    return this.repository.count();
  }

  private toUser(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      permissions: record.permissions,
      createdAt: record.createdAt
    } satisfies User;
  }
}

export default UserService;
