import { AppError } from './errors.js';
import type { DbEngine } from '../services/database.service.js';

/**
 * One-shot SQL query execution against a user-registered database.
 *
 * SECURITY MODEL — read this before changing anything:
 *  - The query console is gated to operator+ (see database.routes.ts). Operators
 *    are trusted actors in this app.
 *  - `readOnly` is a GUARDRAIL against accidental writes (a fat-fingered DELETE
 *    in a read-only transaction errors out), NOT a hard privilege boundary. A
 *    determined operator can always bypass client-side read-only by issuing
 *    their own transaction-control SQL. The REAL boundary is the database
 *    user's own grants — the UI recommends a read-only DB user for safe
 *    browsing. We do not regex-parse SQL to "enforce" read-only because that is
 *    fragile and gives false confidence.
 *  - Resource use is bounded by a statement timeout (clamped server-side) and
 *    a max-row cap. NOTE: the drivers buffer the full result set before we
 *    slice, so the row cap bounds the RESPONSE, not peak server memory — a
 *    `SELECT *` over a huge table is bounded mainly by the statement timeout.
 *    The UI recommends adding a LIMIT. A future hardening is streaming reads
 *    (pg-cursor / mysql2 stream) to cap memory regardless of table size.
 */

export interface QueryConfig {
  engine: DbEngine;
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  ssl: boolean;
}

export interface QueryOptions {
  readOnly: boolean;
  maxRows: number;
  timeoutMs: number;
}

export interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  /** Rows returned after the maxRows cap. */
  rowCount: number;
  /** True when the result was capped at maxRows. */
  truncated: boolean;
  /** Wall-clock duration of the query. */
  durationMs: number;
  /** Command tag where the driver provides one (SELECT, INSERT, UPDATE…). */
  command: string | null;
  /** Rows affected for write statements, when known. */
  affectedRows: number | null;
}

export interface QueryExecutor {
  run(config: QueryConfig, sql: string, opts: QueryOptions): Promise<QueryResult>;
}

// Server-side clamps. Requests above these are silently reduced.
export const MAX_ROWS_LIMIT = 10_000;
export const DEFAULT_MAX_ROWS = 1_000;
export const MAX_TIMEOUT_MS = 60_000;
export const DEFAULT_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 8_000;

export function clampOptions(opts: Partial<QueryOptions>): QueryOptions {
  const maxRows = Math.max(1, Math.min(MAX_ROWS_LIMIT, opts.maxRows ?? DEFAULT_MAX_ROWS));
  const timeoutMs = Math.max(1_000, Math.min(MAX_TIMEOUT_MS, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  return { readOnly: opts.readOnly ?? true, maxRows, timeoutMs };
}

/** Cap a row array and report truncation. */
function capRows(
  rows: Array<Record<string, unknown>>,
  maxRows: number,
): { rows: Array<Record<string, unknown>>; truncated: boolean } {
  if (rows.length > maxRows) return { rows: rows.slice(0, maxRows), truncated: true };
  return { rows, truncated: false };
}

function columnsFromRows(rows: Array<Record<string, unknown>>): string[] {
  return rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
}

/**
 * Real driver-backed executor. Drivers (`pg`, `mysql2`) are lazy-imported so
 * they only load when a query actually runs, and so unit tests that inject a
 * fake executor never touch them.
 */
export class DriverQueryExecutor implements QueryExecutor {
  async run(config: QueryConfig, sql: string, opts: QueryOptions): Promise<QueryResult> {
    if (config.engine === 'postgres') return this.runPostgres(config, sql, opts);
    return this.runMysql(config, sql, opts);
  }

  private async runPostgres(
    config: QueryConfig,
    sql: string,
    opts: QueryOptions,
  ): Promise<QueryResult> {
    const pg = await import('pg');
    const client = new pg.Client({
      host: config.host,
      port: config.port,
      user: config.username,
      ...(config.password !== undefined ? { password: config.password } : {}),
      ...(config.database ? { database: config.database } : {}),
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      statement_timeout: opts.timeoutMs,
      query_timeout: opts.timeoutMs,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    try {
      await client.connect();
    } catch (err) {
      throw connError(err);
    }
    const start = Date.now();
    try {
      if (opts.readOnly) await client.query('START TRANSACTION READ ONLY');
      const res = await client.query(sql);
      if (opts.readOnly) await client.query('ROLLBACK');
      // Multiple statements → pg returns an array; take the last result set.
      const last = Array.isArray(res) ? res[res.length - 1] : res;
      const rawRows = (last?.rows ?? []) as Array<Record<string, unknown>>;
      const { rows, truncated } = capRows(rawRows, opts.maxRows);
      return {
        columns: (last?.fields ?? []).map((f: { name: string }) => f.name) ?? columnsFromRows(rows),
        rows,
        rowCount: rows.length,
        truncated,
        durationMs: Date.now() - start,
        command: (last?.command as string | undefined) ?? null,
        affectedRows: typeof last?.rowCount === 'number' && rawRows.length === 0 ? last.rowCount : null,
      };
    } catch (err) {
      // Best-effort rollback so a half-open read-only tx doesn't linger.
      if (opts.readOnly) await client.query('ROLLBACK').catch(() => undefined);
      throw queryError(err);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async runMysql(
    config: QueryConfig,
    sql: string,
    opts: QueryOptions,
  ): Promise<QueryResult> {
    const mysql = await import('mysql2/promise');
    let conn: Awaited<ReturnType<typeof mysql.createConnection>>;
    try {
      conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        ...(config.password !== undefined ? { password: config.password } : {}),
        ...(config.database ? { database: config.database } : {}),
        ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
        connectTimeout: CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      throw connError(err);
    }
    const start = Date.now();
    try {
      // max_execution_time bounds SELECTs (ms). Ignored for writes by MySQL.
      await conn.query(`SET SESSION max_execution_time = ${Math.floor(opts.timeoutMs)}`).catch(() => undefined);
      if (opts.readOnly) await conn.query('START TRANSACTION READ ONLY');
      const [result, fields] = await conn.query(sql);
      if (opts.readOnly) await conn.query('ROLLBACK');

      if (Array.isArray(result)) {
        const rawRows = result as Array<Record<string, unknown>>;
        const { rows, truncated } = capRows(rawRows, opts.maxRows);
        const cols = Array.isArray(fields) && fields.length > 0
          ? (fields as Array<{ name: string }>).map((f) => f.name)
          : columnsFromRows(rows);
        return {
          columns: cols,
          rows,
          rowCount: rows.length,
          truncated,
          durationMs: Date.now() - start,
          command: 'SELECT',
          affectedRows: null,
        };
      }
      // Write statement → ResultSetHeader.
      const header = result as { affectedRows?: number };
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        durationMs: Date.now() - start,
        command: 'OK',
        affectedRows: typeof header.affectedRows === 'number' ? header.affectedRows : null,
      };
    } catch (err) {
      if (opts.readOnly) await conn.query('ROLLBACK').catch(() => undefined);
      throw queryError(err);
    } finally {
      await conn.end().catch(() => undefined);
    }
  }
}

function connError(err: unknown): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  return new AppError('database.unreachable', `Cannot connect to database: ${msg}`, 503);
}

function queryError(err: unknown): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  // Surface the DB's own error (syntax, permission denied, read-only violation)
  // as a 400 so the console can show it inline.
  return new AppError('database.query_failed', msg, 400);
}
