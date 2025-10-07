import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as DatabaseInstance } from "better-sqlite3";

class SqliteClient {
  private static instance: DatabaseInstance | null = null;

  static getInstance(): DatabaseInstance {
    if (!SqliteClient.instance) {
      const databasePath = process.env.SQLITE_PATH ?? path.join(process.cwd(), ".data", "auth.db");
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });

      const db = new Database(databasePath);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      SqliteClient.instance = db;
    }

    return SqliteClient.instance;
  }
}

export default SqliteClient;
