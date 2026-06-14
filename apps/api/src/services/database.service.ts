import { connect as netConnect } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import type Docker from 'dockerode';
import { CryptoBox } from '../lib/crypto-box.js';
import { DockerContainersService } from './docker-containers.service.js';
import {
  DriverQueryExecutor,
  clampOptions,
  type QueryExecutor,
  type QueryOptions,
  type QueryResult,
} from '../lib/db-query.js';
import { AppError, NotFoundError } from '../lib/errors.js';

/** Format verify-step errors so lastError carries the AppError code. */
function formatVerifyError(err: unknown): string {
  if (err instanceof AppError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Verification failed';
}

// -------------------- Public types --------------------

export type DbEngine = 'postgres' | 'mysql' | 'mariadb';

export const DEFAULT_PORT: Record<DbEngine, number> = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
};

export interface DatabaseConnectionSummary {
  id: string;
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  username: string;
  database: string | null;
  ssl: boolean;
  hasPassword: boolean;
  containerId: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatabaseConnectionInput {
  name: string;
  engine: DbEngine;
  host: string;
  port?: number;
  username: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  containerId?: string;
}

export interface UpdateDatabaseConnectionInput {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string | null;
  database?: string | null;
  ssl?: boolean;
}

/** A database server discovered from a running/own container. */
export interface DiscoveredDatabase {
  containerId: string;
  containerName: string;
  image: string;
  engine: DbEngine;
  /** Hostname the api can use to reach it on the shared docker network. */
  suggestedHost: string;
  suggestedPort: number;
  state: string;
  /** True when a saved connection already references this container. */
  alreadyConnected: boolean;
}

/**
 * Probe a TCP host:port for reachability. Injectable so tests don't open real
 * sockets. The default uses node:net with a timeout. This is a reachability
 * check only — credential validation against the live DB lands with the query
 * console (which needs the DB drivers).
 */
export type TcpProbe = (host: string, port: number, timeoutMs: number) => Promise<void>;

const defaultTcpProbe: TcpProbe = (host, port, timeoutMs) =>
  new Promise<void>((resolve, reject) => {
    const socket = netConnect({ host, port });
    const done = (err?: Error) => {
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done());
    socket.once('timeout', () => done(new Error(`Timed out connecting to ${host}:${port}`)));
    socket.once('error', (err) => done(err));
  });

export interface DatabaseServiceOptions {
  /** Override the TCP reachability probe (tests inject a fake). */
  tcpProbe?: TcpProbe;
  /** Probe timeout (ms). */
  probeTimeoutMs?: number;
  /** Override the SQL executor (tests inject a fake — no real DB). */
  queryExecutor?: QueryExecutor;
}

// Image-name heuristics for discovery. Matches the leading repo component so
// `postgres:16`, `bitnami/postgresql`, `mysql:8`, `mariadb`, `percona` etc.
const ENGINE_IMAGE_PATTERNS: Array<{ re: RegExp; engine: DbEngine }> = [
  { re: /(^|\/)postgres(ql)?(:|$|@)/i, engine: 'postgres' },
  { re: /(^|\/)timescale/i, engine: 'postgres' },
  { re: /(^|\/)pgvector/i, engine: 'postgres' },
  { re: /(^|\/)mariadb(:|$|@)/i, engine: 'mariadb' },
  { re: /(^|\/)mysql(:|$|@)/i, engine: 'mysql' },
  { re: /(^|\/)percona(:|$|@)/i, engine: 'mysql' },
];

function detectEngine(image: string): DbEngine | null {
  for (const { re, engine } of ENGINE_IMAGE_PATTERNS) {
    if (re.test(image)) return engine;
  }
  return null;
}

// -------------------- Service --------------------

export class DatabaseService {
  private readonly containers: DockerContainersService;
  private readonly probe: TcpProbe;
  private readonly probeTimeout: number;
  private readonly executor: QueryExecutor;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cryptoBox: CryptoBox,
    docker: Docker,
    options: DatabaseServiceOptions = {},
  ) {
    this.containers = new DockerContainersService(docker);
    this.probe = options.tcpProbe ?? defaultTcpProbe;
    this.probeTimeout = options.probeTimeoutMs ?? 5000;
    this.executor = options.queryExecutor ?? new DriverQueryExecutor();
  }

  // -------------------- Discovery --------------------

  /** Scan containers for database engines and suggest connection profiles. */
  async discover(): Promise<DiscoveredDatabase[]> {
    const [containers, connections] = await Promise.all([
      this.containers.list({ all: true }),
      this.prisma.databaseConnection.findMany({ select: { containerId: true } }),
    ]);
    const connectedIds = new Set(connections.map((c) => c.containerId).filter(Boolean));

    const out: DiscoveredDatabase[] = [];
    for (const c of containers) {
      const engine = detectEngine(c.image);
      if (!engine) continue;
      // Prefer a real (non-truncated) name; fall back to short id.
      const name = c.names[0] ?? c.shortId;
      // The DB's in-container port (private). If exposed, still use the private
      // port since the api reaches it over the docker network by name.
      const dbPort =
        c.ports.find((p) => p.privatePort === DEFAULT_PORT[engine])?.privatePort ??
        DEFAULT_PORT[engine];
      out.push({
        containerId: c.id,
        containerName: name,
        image: c.image,
        engine,
        suggestedHost: name,
        suggestedPort: dbPort,
        state: c.state,
        alreadyConnected: connectedIds.has(c.id),
      });
    }
    return out;
  }

  // -------------------- Connections --------------------

  async listConnections(): Promise<DatabaseConnectionSummary[]> {
    const rows = await this.prisma.databaseConnection.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toSummary(r));
  }

  async getConnection(id: string): Promise<DatabaseConnectionSummary> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    return this.toSummary(row);
  }

  async createConnection(
    input: CreateDatabaseConnectionInput,
  ): Promise<DatabaseConnectionSummary> {
    const existing = await this.prisma.databaseConnection.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new AppError('database.duplicate_name', 'A connection with that name already exists', 409);
    }
    const port = input.port ?? DEFAULT_PORT[input.engine];

    let verified = false;
    let lastVerifiedAt: Date | null = null;
    let lastError: string | null = null;
    try {
      await this.probe(input.host, port, this.probeTimeout);
      verified = true;
      lastVerifiedAt = new Date();
    } catch (err) {
      lastError = formatVerifyError(err);
    }

    const created = await this.prisma.databaseConnection.create({
      data: {
        name: input.name,
        engine: input.engine,
        host: input.host,
        port,
        username: input.username,
        passwordCipher: input.password ? this.cryptoBox.seal(input.password) : null,
        database: input.database ?? null,
        ssl: input.ssl ?? false,
        containerId: input.containerId ?? null,
        verified,
        lastVerifiedAt,
        lastError,
      },
    });
    return this.toSummary(created);
  }

  async updateConnection(
    id: string,
    input: UpdateDatabaseConnectionInput,
  ): Promise<DatabaseConnectionSummary> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    if (input.name && input.name !== row.name) {
      const dup = await this.prisma.databaseConnection.findUnique({ where: { name: input.name } });
      if (dup) {
        throw new AppError('database.duplicate_name', 'A connection with that name already exists', 409);
      }
    }
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data['name'] = input.name;
    if (input.host !== undefined) data['host'] = input.host;
    if (input.port !== undefined) data['port'] = input.port;
    if (input.username !== undefined) data['username'] = input.username;
    if (input.database !== undefined) data['database'] = input.database;
    if (input.ssl !== undefined) data['ssl'] = input.ssl;
    if (input.password !== undefined) {
      data['passwordCipher'] = input.password ? this.cryptoBox.seal(input.password) : null;
    }
    if (input.host !== undefined || input.port !== undefined) {
      data['verified'] = false;
      data['lastVerifiedAt'] = null;
    }
    const updated = await this.prisma.databaseConnection.update({ where: { id }, data });
    return this.toSummary(updated);
  }

  async deleteConnection(id: string): Promise<void> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    await this.prisma.databaseConnection.delete({ where: { id } });
  }

  async verifyConnection(id: string): Promise<DatabaseConnectionSummary> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    let verified = false;
    let lastError: string | null = null;
    try {
      await this.probe(row.host, row.port, this.probeTimeout);
      verified = true;
    } catch (err) {
      lastError = formatVerifyError(err);
    }
    const updated = await this.prisma.databaseConnection.update({
      where: { id },
      data: { verified, lastVerifiedAt: verified ? new Date() : row.lastVerifiedAt, lastError },
    });
    return this.toSummary(updated);
  }

  // -------------------- Backup schedule --------------------

  async getSchedule(id: string): Promise<{
    enabled: boolean;
    cron: string | null;
    s3ConnectionId: string | null;
    bucket: string | null;
  }> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    return {
      enabled: row.backupEnabled,
      cron: row.backupCron,
      s3ConnectionId: row.backupS3ConnectionId,
      bucket: row.backupBucket,
    };
  }

  async setSchedule(
    id: string,
    input: { enabled: boolean; cron?: string; s3ConnectionId?: string; bucket?: string },
  ): Promise<void> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Database connection not found');
    if (input.enabled && (!input.cron || !input.s3ConnectionId || !input.bucket)) {
      throw new AppError(
        'database.schedule_incomplete',
        'Enabling a schedule requires a cron expression, S3 connection, and bucket',
        400,
      );
    }
    // Don't let a schedule be enabled against a non-existent S3 destination —
    // it would only surface as a silent failure at fire time.
    if (input.enabled && input.s3ConnectionId) {
      const s3 = await this.prisma.s3Connection.findUnique({ where: { id: input.s3ConnectionId } });
      if (!s3) {
        throw new AppError('database.s3_not_found', 'The chosen S3 connection does not exist', 400);
      }
    }
    await this.prisma.databaseConnection.update({
      where: { id },
      data: {
        backupEnabled: input.enabled,
        backupCron: input.cron ?? null,
        backupS3ConnectionId: input.s3ConnectionId ?? null,
        backupBucket: input.bucket ?? null,
      },
    });
  }

  // -------------------- Query console --------------------

  /**
   * Run a single SQL request against a saved connection. Gated to operator+ at
   * the route. `readOnly` is a guardrail (best-effort, DB-enforced via a
   * read-only transaction), not a hard boundary — see lib/db-query.ts.
   */
  async runQuery(
    connectionId: string,
    sql: string,
    opts: Partial<QueryOptions>,
  ): Promise<QueryResult> {
    const row = await this.prisma.databaseConnection.findUnique({ where: { id: connectionId } });
    if (!row) throw new NotFoundError('Database connection not found');
    if (typeof sql !== 'string' || sql.trim().length === 0) {
      throw new AppError('database.empty_sql', 'SQL statement is required', 400);
    }
    const config = {
      engine: row.engine as DbEngine,
      host: row.host,
      port: row.port,
      username: row.username,
      ...(row.passwordCipher ? { password: this.cryptoBox.open(row.passwordCipher) } : {}),
      ...(row.database ? { database: row.database } : {}),
      ssl: row.ssl,
    };
    return this.executor.run(config, sql, clampOptions(opts));
  }

  // -------------------- internals --------------------

  private toSummary(row: {
    id: string;
    name: string;
    engine: string;
    host: string;
    port: number;
    username: string;
    passwordCipher: string | null;
    database: string | null;
    ssl: boolean;
    containerId: string | null;
    verified: boolean;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DatabaseConnectionSummary {
    return {
      id: row.id,
      name: row.name,
      engine: row.engine as DbEngine,
      host: row.host,
      port: row.port,
      username: row.username,
      database: row.database,
      ssl: row.ssl,
      hasPassword: row.passwordCipher !== null,
      containerId: row.containerId,
      verified: row.verified,
      lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export { detectEngine };
