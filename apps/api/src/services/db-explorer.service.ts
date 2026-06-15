import type Docker from 'dockerode';
import type { PrismaClient } from '@prisma/client';
import { CryptoBox } from '../lib/crypto-box.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { DbEngine } from './database.service.js';

/**
 * Manages browser-based DB explorer sidecars (pgweb for Postgres, phpMyAdmin
 * for MySQL/MariaDB) — one per database connection, launched on demand and
 * reaped after an idle period.
 *
 * The sidecar runs on the api's docker network so it can reach the database
 * container by name, and so the panel can proxy to it (the secure
 * Caddy-fronted / panel-auth proxy is wired in a follow-up — this service owns
 * the container lifecycle, which is the testable core).
 *
 * NOTE: like every tool that connects to a database, the sidecar receives the
 * DB password (pgweb via DATABASE_URL, phpMyAdmin via PMA_PASSWORD) in its
 * environment — visible to `docker inspect` on the host. That is inherent to
 * these images; operators (who already have docker access) are trusted.
 */

export interface ExplorerInfo {
  connectionId: string;
  kind: 'pgweb' | 'phpmyadmin';
  status: 'running' | 'starting' | 'stopped';
  containerId?: string;
  /** Container name + internal port the panel proxy targets. */
  upstream?: string;
  lastAccessedAt?: string;
}

interface BuildCtx {
  target: SidecarTarget;
  /** Path the panel proxy serves this sidecar under: /db-proxy/<id>/ */
  prefix: string;
  /** Full external base URL for the sidecar, when the panel public URL is known. */
  absoluteUri: string | undefined;
}

interface ExplorerDef {
  kind: 'pgweb' | 'phpmyadmin';
  image: string;
  port: number;
  buildEnv: (ctx: BuildCtx) => string[];
  /** Extra container Cmd (e.g. pgweb's --prefix). */
  buildCmd?: (ctx: BuildCtx) => string[];
}

interface SidecarTarget {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

const PROJECT = 'docker-gui';
const LABEL_MANAGED = 'docker-gui.managed-by';
const LABEL_FEATURE = 'docker-gui.feature';
const LABEL_CONN = 'docker-gui.db-connection';

function pgweb(): ExplorerDef {
  return {
    kind: 'pgweb',
    image: 'sosedoff/pgweb:latest',
    port: 8081,
    buildEnv: ({ target: c }) => [
      `DATABASE_URL=postgres://${encodeURIComponent(c.username)}:${encodeURIComponent(
        c.password,
      )}@${c.host}:${c.port}/${encodeURIComponent(c.database)}?sslmode=disable`,
      'PGWEB_DATABASE_SSLMODE=disable',
    ],
    // Serve under the proxy prefix so pgweb's own asset links resolve through
    // the panel. (The exact flag may need tuning against the pgweb image.)
    buildCmd: ({ prefix }) => ['--bind=0.0.0.0', '--listen=8081', `--prefix=${prefix.replace(/\/$/, '')}`],
  };
}

function phpmyadmin(): ExplorerDef {
  return {
    kind: 'phpmyadmin',
    image: 'phpmyadmin:latest',
    port: 80,
    buildEnv: ({ target: c, absoluteUri }) => [
      `PMA_HOST=${c.host}`,
      `PMA_PORT=${c.port}`,
      `PMA_USER=${c.username}`,
      `PMA_PASSWORD=${c.password}`,
      // Needed so phpMyAdmin generates correct links behind the reverse proxy.
      ...(absoluteUri ? [`PMA_ABSOLUTE_URI=${absoluteUri}`] : []),
    ],
  };
}

const DEFS: Record<DbEngine, ExplorerDef> = {
  postgres: pgweb(),
  mysql: phpmyadmin(),
  mariadb: phpmyadmin(),
};

export interface DbExplorerServiceOptions {
  network: string;
  /** Stop a sidecar after this much idle time. Default 30 min. */
  idleTtlMs?: number;
  /** Clock seam for deterministic idle-reap tests. */
  clock?: () => number;
  /** Panel public base URL (no trailing slash), used to set phpMyAdmin's
   *  PMA_ABSOLUTE_URI so its links resolve behind the proxy. Optional. */
  publicUrl?: string;
}

export class DbExplorerService {
  private readonly idleTtl: number;
  private readonly clock: () => number;
  /** connectionId → last access epoch ms (in-memory; reconciled from labels). */
  private readonly lastAccess = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cryptoBox: CryptoBox,
    private readonly docker: Docker,
    private readonly opts: DbExplorerServiceOptions,
  ) {
    this.idleTtl = opts.idleTtlMs ?? 30 * 60 * 1000;
    this.clock = opts.clock ?? (() => Date.now());
  }

  private containerName(connectionId: string): string {
    return `${PROJECT}-dbx-${connectionId.slice(0, 12)}`;
  }

  /** Launch (or reuse) the explorer for a connection and mark it accessed. */
  async open(connectionId: string): Promise<ExplorerInfo> {
    const conn = await this.prisma.databaseConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new NotFoundError('Database connection not found');
    const def = DEFS[conn.engine as DbEngine];
    if (!def) throw new AppError('explorer.unsupported', `No explorer for engine ${conn.engine}`, 400);

    const name = this.containerName(connectionId);
    const existing = await this.findContainer(connectionId);
    if (existing && existing.running) {
      this.lastAccess.set(connectionId, this.clock());
      return this.toInfo(connectionId, def, 'running', existing.id, name);
    }
    // Remove a stale (exited) container with the same name before recreating.
    if (existing && !existing.running) {
      await this.docker.getContainer(existing.id).remove({ force: true }).catch(() => undefined);
    }

    const target: SidecarTarget = {
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.passwordCipher ? this.cryptoBox.open(conn.passwordCipher) : '',
      database: conn.database ?? (conn.engine === 'postgres' ? 'postgres' : ''),
    };
    const prefix = `/db-proxy/${connectionId}/`;
    const ctx: BuildCtx = {
      target,
      prefix,
      absoluteUri: this.opts.publicUrl ? `${this.opts.publicUrl.replace(/\/$/, '')}${prefix}` : undefined,
    };
    const cmd = def.buildCmd?.(ctx);

    let container;
    try {
      container = await this.docker.createContainer({
        name,
        Image: def.image,
        Env: def.buildEnv(ctx),
        ...(cmd ? { Cmd: cmd } : {}),
        Labels: {
          [LABEL_MANAGED]: 'db-explorer-service',
          [LABEL_FEATURE]: 'db-explorer',
          [LABEL_CONN]: connectionId,
        },
        ExposedPorts: { [`${def.port}/tcp`]: {} },
        HostConfig: {
          RestartPolicy: { Name: 'no' },
          NetworkMode: this.opts.network,
        },
      });
      await container.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('explorer.launch_failed', `Could not start explorer: ${msg}`, 502);
    }
    this.lastAccess.set(connectionId, this.clock());
    return this.toInfo(connectionId, def, 'running', container.id, name);
  }

  async status(connectionId: string): Promise<ExplorerInfo> {
    const conn = await this.prisma.databaseConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new NotFoundError('Database connection not found');
    const def = DEFS[conn.engine as DbEngine];
    const found = await this.findContainer(connectionId);
    if (!found) return this.toInfo(connectionId, def, 'stopped');
    return this.toInfo(
      connectionId,
      def,
      found.running ? 'running' : 'stopped',
      found.id,
      this.containerName(connectionId),
    );
  }

  async stop(connectionId: string): Promise<void> {
    const found = await this.findContainer(connectionId);
    this.lastAccess.delete(connectionId);
    if (!found) return;
    const c = this.docker.getContainer(found.id);
    await c.stop().catch(() => undefined);
    await c.remove({ force: true }).catch(() => undefined);
  }

  /** All running explorer sidecars (from container labels). */
  async list(): Promise<ExplorerInfo[]> {
    const containers = await this.listLabeled();
    return containers.map((c) => {
      const connectionId = c.Labels?.[LABEL_CONN] ?? '';
      const running = (c.State ?? '').toLowerCase() === 'running';
      return {
        connectionId,
        kind: c.Image.includes('pgweb') ? 'pgweb' : 'phpmyadmin',
        status: running ? 'running' : 'stopped',
        containerId: c.Id,
        ...(this.lastAccess.has(connectionId)
          ? { lastAccessedAt: new Date(this.lastAccess.get(connectionId)!).toISOString() }
          : {}),
      } satisfies ExplorerInfo;
    });
  }

  /**
   * Stop sidecars that have been idle longer than the TTL. Intended to be
   * called on an interval. Returns the connection ids that were reaped.
   */
  async reapIdle(): Promise<string[]> {
    const now = this.clock();
    const containers = await this.listLabeled();
    const reaped: string[] = [];
    for (const c of containers) {
      const connectionId = c.Labels?.[LABEL_CONN];
      if (!connectionId) continue;
      const last = this.lastAccess.get(connectionId);
      // No record (e.g. after an api restart) → treat as idle and reap.
      const idleFor = last === undefined ? this.idleTtl + 1 : now - last;
      if (idleFor > this.idleTtl) {
        await this.stop(connectionId);
        reaped.push(connectionId);
      }
    }
    return reaped;
  }

  // -------------------- internals --------------------

  private async findContainer(
    connectionId: string,
  ): Promise<{ id: string; running: boolean } | null> {
    const containers = await this.listLabeled();
    const match = containers.find((c) => c.Labels?.[LABEL_CONN] === connectionId);
    if (!match) return null;
    return { id: match.Id, running: (match.State ?? '').toLowerCase() === 'running' };
  }

  private async listLabeled(): Promise<DockerContainerInfo[]> {
    const raw = (await this.docker.listContainers({
      all: true,
      filters: { label: [`${LABEL_FEATURE}=db-explorer`] },
    })) as DockerContainerInfo[];
    return raw;
  }

  private toInfo(
    connectionId: string,
    def: ExplorerDef | undefined,
    status: ExplorerInfo['status'],
    containerId?: string,
    name?: string,
  ): ExplorerInfo {
    return {
      connectionId,
      kind: def?.kind ?? 'pgweb',
      status,
      ...(containerId ? { containerId } : {}),
      ...(name && def ? { upstream: `${name}:${def.port}` } : {}),
      ...(this.lastAccess.has(connectionId)
        ? { lastAccessedAt: new Date(this.lastAccess.get(connectionId)!).toISOString() }
        : {}),
    };
  }
}

interface DockerContainerInfo {
  Id: string;
  Image: string;
  State?: string;
  Labels?: Record<string, string>;
}
