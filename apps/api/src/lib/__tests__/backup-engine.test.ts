import { describe, it, expect } from 'vitest';
import { buildDumpCommand, buildRestoreCommand, sanitizeDbError } from '../backup-engine.js';
import type { QueryConfig } from '../db-query.js';

const base: QueryConfig = {
  engine: 'postgres',
  host: 'app-postgres',
  port: 5432,
  username: 'postgres',
  password: "p@ss';DROP TABLE x;--",
  database: 'appdb',
  ssl: false,
};

describe('buildDumpCommand', () => {
  it('builds a pg_dump argv with credentials in ENV, not the command', () => {
    const { cmd, env, filename } = buildDumpCommand(base);
    expect(cmd[0]).toBe('pg_dump');
    expect(cmd).toContain('-h');
    expect(cmd).toContain('app-postgres');
    expect(cmd).toContain('-d');
    expect(cmd).toContain('appdb');
    // Password must NOT appear in argv (it goes via PGPASSWORD env).
    expect(cmd.join(' ')).not.toContain("p@ss");
    expect(env.some((e) => e.startsWith('PGPASSWORD='))).toBe(true);
    expect(filename).toBe('appdb.sql');
  });

  it('passes connection values as discrete argv entries (no shell string)', () => {
    const { cmd } = buildDumpCommand(base);
    // Each value is its own array element — there is no single shell string to
    // inject into. The host/db sit in their own slots verbatim.
    expect(cmd).toContain('app-postgres');
    // No element concatenates multiple flags+values together.
    expect(cmd.every((part) => !part.includes(' -'))).toBe(true);
  });

  it('builds a mysqldump argv with the password in ENV only — never argv', () => {
    const { cmd, env, filename } = buildDumpCommand({ ...base, engine: 'mysql' });
    expect(cmd[0]).toBe('mysqldump');
    expect(cmd).toContain('-h');
    expect(cmd).toContain('--single-transaction');
    expect(cmd).toContain('appdb');
    // Password must go via MYSQL_PWD env, and NOT appear in argv (a
    // `--password=` flag would be visible to `docker inspect` / `ps`).
    expect(env.some((e) => e.startsWith('MYSQL_PWD='))).toBe(true);
    expect(cmd.some((part) => part.includes('--password'))).toBe(false);
    expect(cmd.join(' ')).not.toContain(base.password!);
    expect(filename).toBe('appdb.sql');
  });

  it('dumps all databases when none is specified', () => {
    const noDb: QueryConfig = { ...base, engine: 'mysql' };
    delete (noDb as { database?: string }).database;
    const { cmd, filename } = buildDumpCommand(noDb);
    expect(cmd).toContain('--all-databases');
    expect(filename).toBe('all-databases.sql');
  });
});

describe('sanitizeDbError', () => {
  it('scrubs password-shaped tokens from tool stderr before it reaches the client', () => {
    const raw = 'connection failed PGPASSWORD=hunter2 and password: s3cr3t and --password=abc';
    const out = sanitizeDbError(raw);
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('s3cr3t');
    expect(out).not.toContain('abc');
    expect(out).toContain('***');
  });

  it('truncates very long stderr', () => {
    expect(sanitizeDbError('x'.repeat(5000)).length).toBeLessThanOrEqual(2000);
  });
});

describe('buildRestoreCommand', () => {
  it('builds psql reading from stdin with ON_ERROR_STOP and env-only password', () => {
    const { cmd, env } = buildRestoreCommand(base);
    expect(cmd[0]).toBe('psql');
    expect(cmd).toContain('-d');
    expect(cmd).toContain('appdb');
    expect(cmd).toContain('ON_ERROR_STOP=1');
    expect(cmd.join(' ')).not.toContain(base.password!);
    expect(env.some((e) => e.startsWith('PGPASSWORD='))).toBe(true);
  });

  it('builds mysql reading from stdin with env-only password (never argv)', () => {
    const { cmd, env } = buildRestoreCommand({ ...base, engine: 'mariadb' });
    expect(cmd[0]).toBe('mysql');
    expect(cmd).toContain('appdb');
    expect(cmd.some((p) => p.includes('--password'))).toBe(false);
    expect(cmd.join(' ')).not.toContain(base.password!);
    expect(env.some((e) => e.startsWith('MYSQL_PWD='))).toBe(true);
  });
});
