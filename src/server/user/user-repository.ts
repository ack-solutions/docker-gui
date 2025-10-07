import { randomUUID } from "node:crypto";
import SqliteClient from "@/server/database/sqlite-client";
import type { UserRecord } from "@/types/user";

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
        created_at TEXT NOT NULL
      );
    `);
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
      createdAt: row.created_at
    } satisfies UserRecord;
  }

  findByEmail(email: string): UserRecord | null {
    const statement = this.db.prepare(
      "SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?"
    );
    const row = statement.get(email.toLowerCase());
    return this.mapRow(row);
  }

  findById(id: string): UserRecord | null {
    const statement = this.db.prepare(
      "SELECT id, email, password_hash, name, created_at FROM users WHERE id = ?"
    );
    const row = statement.get(id);
    return this.mapRow(row);
  }

  create(input: { email: string; passwordHash: string; name?: string | null }): UserRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const normalizedEmail = input.email.toLowerCase();

    const statement = this.db.prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)"
    );

    statement.run(id, normalizedEmail, input.passwordHash, input.name ?? null, createdAt);

    return {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      createdAt
    };
  }
}

export default UserRepository;
