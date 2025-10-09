import { randomUUID } from "node:crypto";
import SqliteClient from "@/server/database/sqlite-client";
import type { UserPermission, UserRecord, UserRole } from "@/types/user";

class UserRepository {
  private readonly db = SqliteClient.getInstance();

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'viewer',
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);
    this.ensureColumns();
  }

  private ensureColumns() {
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    if (!columnNames.includes("role")) {
      this.db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'");
    }

    if (!columnNames.includes("permissions")) {
      this.db.exec("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
    }
  }

  private mapRow(row: any): UserRecord | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role ?? "viewer",
      permissions: this.parsePermissions(row.permissions),
      createdAt: row.created_at
    } satisfies UserRecord;
  }

  private parsePermissions(raw: string | null | undefined): UserPermission[] {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed.filter((item) => typeof item === "string") as UserPermission[]) : [];
    } catch {
      return [];
    }
  }

  findByEmail(email: string): UserRecord | null {
    const statement = this.db.prepare(
      "SELECT id, email, password_hash, name, role, permissions, created_at FROM users WHERE email = ?"
    );
    const row = statement.get(email.toLowerCase());
    return this.mapRow(row);
  }

  findById(id: string): UserRecord | null {
    const statement = this.db.prepare(
      "SELECT id, email, password_hash, name, role, permissions, created_at FROM users WHERE id = ?"
    );
    const row = statement.get(id);
    return this.mapRow(row);
  }

  all(): UserRecord[] {
    const statement = this.db.prepare(
      "SELECT id, email, password_hash, name, role, permissions, created_at FROM users ORDER BY email ASC"
    );
    return statement.all().map((row) => this.mapRow(row)).filter(Boolean) as UserRecord[];
  }

  count(): number {
    const statement = this.db.prepare("SELECT COUNT(*) AS total FROM users");
    const row = statement.get() as { total: number };
    return row?.total ?? 0;
  }

  create(input: {
    email: string;
    passwordHash: string;
    name?: string | null;
    role: UserRole;
    permissions: UserPermission[];
  }): UserRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const normalizedEmail = input.email.toLowerCase();

    const statement = this.db.prepare(
      "INSERT INTO users (id, email, password_hash, name, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    statement.run(
      id,
      normalizedEmail,
      input.passwordHash,
      input.name ?? null,
      input.role,
      JSON.stringify(input.permissions),
      createdAt
    );

    return {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      role: input.role,
      permissions: input.permissions,
      createdAt
    };
  }

  update(
    id: string,
    input: {
      email?: string;
      passwordHash?: string;
      name?: string | null;
      role?: UserRole;
      permissions?: UserPermission[];
    }
  ): UserRecord | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const next: UserRecord = {
      ...existing,
      email: input.email?.toLowerCase() ?? existing.email,
      passwordHash: input.passwordHash ?? existing.passwordHash,
      name: input.name ?? existing.name ?? null,
      role: input.role ?? existing.role,
      permissions: input.permissions ?? existing.permissions
    };

    const statement = this.db.prepare(
      "UPDATE users SET email = ?, password_hash = ?, name = ?, role = ?, permissions = ? WHERE id = ?"
    );

    statement.run(
      next.email,
      next.passwordHash,
      next.name ?? null,
      next.role,
      JSON.stringify(next.permissions),
      id
    );

    return next;
  }

  delete(id: string): boolean {
    const statement = this.db.prepare("DELETE FROM users WHERE id = ?");
    const result = statement.run(id);
    return result.changes > 0;
  }
}

export default UserRepository;
