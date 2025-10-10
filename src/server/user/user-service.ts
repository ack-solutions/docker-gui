import bcrypt from "bcryptjs";
import UserRepository from "@/server/user/user-repository";
import { rolePermissions } from "@/types/user";
import type { CreateUserInput, UpdateUserInput, User, UserRecord } from "@/types/user";

class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  async getById(id: string): Promise<User | null> {
    const record = await this.repository.findById(id);
    return record ? this.toUser(record) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const record = await this.repository.findByEmail(email);
    return record ? this.toUser(record) : null;
  }

  async list(): Promise<User[]> {
    const records = await this.repository.all();
    return records.map((record) => this.toUser(record));
  }

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = bcrypt.hashSync(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? "10"));
    const permissions = input.permissions?.length ? input.permissions : rolePermissions[input.role] ?? [];
    const record = await this.repository.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
      role: input.role,
      permissions,
      isSuperAdmin: Boolean(input.isSuperAdmin)
    });
    return this.toUser(record);
  }

  async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const passwordHash = input.password
      ? bcrypt.hashSync(input.password, Number(process.env.BCRYPT_SALT_ROUNDS ?? "10"))
      : undefined;
    const record = await this.repository.update(id, {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin
    });
    return record ? this.toUser(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  private toUser(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      permissions: record.permissions,
      isSuperAdmin: record.isSuperAdmin,
      createdAt: record.createdAt
    };
  }
}

export default UserService;
