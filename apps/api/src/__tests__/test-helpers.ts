import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type Docker from 'dockerode';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { UserService } from '../services/user.service.js';
import { AuthService } from '../services/auth.service.js';
import { DockerContainersService } from '../services/docker-containers.service.js';
import { DockerImagesService } from '../services/docker-images.service.js';
import { DockerVolumesService } from '../services/docker-volumes.service.js';
import { DockerNetworksService } from '../services/docker-networks.service.js';
import { SitesService } from '../services/sites.service.js';
import { DnsService, type DnsServiceOptions } from '../services/dns.service.js';
import { FeaturesService } from '../services/features.service.js';
import {
  StorageService,
  type StorageServiceOptions,
} from '../services/storage.service.js';
import {
  RegistryService,
  type RegistryServiceOptions,
} from '../services/registry.service.js';
import {
  DatabaseService,
  type DatabaseServiceOptions,
} from '../services/database.service.js';
import {
  BackupService,
  type BackupServiceOptions,
} from '../services/backup.service.js';
import {
  BackupSchedulerService,
  type CronScheduler,
} from '../services/backup-scheduler.service.js';
import {
  DbExplorerService,
  type DbExplorerServiceOptions,
} from '../services/db-explorer.service.js';
import { AuditLogService } from '../services/audit-log.service.js';

/**
 * Fake cron scheduler for tests: records registrations and lets a test fire a
 * scheduled task on demand (no real timers). Cron validation accepts the
 * common 5/6-field shape so schedule-CRUD tests work without node-cron.
 */
export class FakeCronScheduler implements CronScheduler {
  readonly tasks = new Map<string, () => void>();
  schedule(id: string, _cronExpr: string, task: () => void): void {
    this.tasks.set(id, task);
  }
  unschedule(id: string): void {
    this.tasks.delete(id);
  }
  validate(cronExpr: string): boolean {
    return /^(\S+\s+){4,5}\S+$/.test(cronExpr.trim());
  }
  /** Fire a registered task (simulates the cron firing). */
  fire(id: string): void {
    this.tasks.get(id)?.();
  }
}
import { CaddyClient } from '../lib/caddy.js';
import { CryptoBox } from '../lib/crypto-box.js';
import { hashPassword } from '../lib/password.js';
import { loadConfig as loadConfigSnapshot } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

export const TEST_JWT_CONFIG = {
  secret: 'test-secret-for-integration-tests-which-is-very-long-1234567890',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

export const TEST_SETUP_SECRET = 'test-setup-secret-1234567890abcdef';

export interface TestEnv {
  app: FastifyInstance;
  prisma: PrismaClient;
  audit: AuditLogService;
  /** Fake cron — inspect `.tasks` / call `.fire(connectionId)` in tests. */
  cron: FakeCronScheduler;
  cleanup: () => Promise<void>;
}

export interface BuildTestEnvOptions {
  docker?: Docker;
  caddy?: CaddyClient | null;
  dnsOptions?: DnsServiceOptions;
  storageOptions?: StorageServiceOptions;
  registryOptions?: RegistryServiceOptions;
  databaseOptions?: DatabaseServiceOptions;
  backupOptions?: BackupServiceOptions;
  explorerOptions?: Partial<DbExplorerServiceOptions>;
}

export type TestRole = 'owner' | 'admin' | 'operator' | 'viewer';

/**
 * Poll `fn` until it returns a truthy value or the timeout elapses. Used to
 * wait on side-effects that complete AFTER the HTTP response is sent — most
 * notably the audit-log `onResponse` writer, which is intentionally async so
 * it never adds latency to the user's request.
 */
export async function waitFor<T>(
  fn: () => Promise<T> | T,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeout = opts.timeoutMs ?? 2000;
  const interval = opts.intervalMs ?? 15;
  const start = Date.now();
  let last: T | undefined;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: condition not met before timeout');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * Create a real user row (real argon2 hash, real Prisma insert) with the
 * given role, then log in through the real /auth/login route and return a
 * usable access token. No mocks — exercises the full auth path.
 */
export async function createUserAndLogin(
  env: TestEnv,
  opts: { email: string; password: string; name: string; role: TestRole },
): Promise<string> {
  const passwordHash = await hashPassword(opts.password);
  await env.prisma.user.create({
    data: {
      email: opts.email.toLowerCase().trim(),
      passwordHash,
      name: opts.name,
      role: opts.role,
    },
  });
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: opts.email, password: opts.password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`login failed for ${opts.email}: ${res.statusCode} ${res.body}`);
  }
  return res.json().data.accessToken as string;
}

function defaultFakeDocker(): Docker {
  return {
    ping: () => Promise.resolve('OK'),
    version: () =>
      Promise.resolve({ Version: 'test', ApiVersion: '1.43', Os: 'linux', Arch: 'amd64' }),
    listContainers: () => Promise.resolve([]),
    listImages: () => Promise.resolve([]),
    listVolumes: () => Promise.resolve({ Volumes: [] }),
    listNetworks: () => Promise.resolve([]),
    pruneVolumes: () => Promise.resolve({ VolumesDeleted: [], SpaceReclaimed: 0 }),
    pruneNetworks: () => Promise.resolve({ NetworksDeleted: [] }),
    getContainer: () => ({
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      restart: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      inspect: () => Promise.resolve({ Id: 'x' }),
      logs: () => Promise.resolve(Buffer.from('')),
    }),
    getImage: () => ({
      inspect: () => Promise.resolve({ Id: 'sha256:x' }),
      remove: () => Promise.resolve(),
    }),
    getVolume: () => ({
      inspect: () => Promise.resolve({ Name: 'v' }),
      remove: () => Promise.resolve(),
    }),
    getNetwork: () => ({
      inspect: () => Promise.resolve({ Name: 'n' }),
      remove: () => Promise.resolve(),
    }),
  } as unknown as Docker;
}

/**
 * Create a fully-wired Fastify app backed by a fresh SQLite database in a
 * temp file. Each call gets its own DB so tests are isolated.
 */
export async function buildTestEnv(opts: BuildTestEnvOptions = {}): Promise<TestEnv> {
  const dbDir = join(PROJECT_ROOT, 'data');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  const dbName = `test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`;
  const dbPath = join(dbDir, dbName);
  const dbUrl = `file:${dbPath}`;

  execSync(`npx prisma migrate deploy`, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasourceUrl: dbUrl, log: [] });
  const docker = opts.docker ?? defaultFakeDocker();

  const users = new UserService(prisma);
  const auth = new AuthService(prisma, TEST_JWT_CONFIG);
  const containers = new DockerContainersService(docker);
  const images = new DockerImagesService(docker);
  const volumes = new DockerVolumesService(docker);
  const networks = new DockerNetworksService(docker);
  const caddy = opts.caddy === undefined ? null : opts.caddy;
  const sites = new SitesService(prisma, caddy);
  const cryptoBox = new CryptoBox(TEST_JWT_CONFIG.secret);
  const dns = new DnsService(prisma, cryptoBox, opts.dnsOptions ?? {});
  const features = new FeaturesService(docker, {
    network: 'docker-gui_dgui',
    hostInstallDir: '/opt/docker-gui',
  });
  const storage = new StorageService(prisma, cryptoBox, opts.storageOptions ?? {});
  const registry = new RegistryService(prisma, cryptoBox, opts.registryOptions ?? {});
  // Default to a probe that resolves instantly so tests never open real
  // sockets; failure-path tests inject a rejecting probe.
  const databases = new DatabaseService(
    prisma,
    cryptoBox,
    docker,
    opts.databaseOptions ?? { tcpProbe: async () => {} },
  );
  const backups = new BackupService(prisma, cryptoBox, storage, opts.backupOptions ?? {});
  const cron = new FakeCronScheduler();
  const scheduler = new BackupSchedulerService(prisma, backups, cron);
  const explorer = new DbExplorerService(prisma, cryptoBox, docker, {
    network: 'docker-gui_dgui',
    ...(opts.explorerOptions ?? {}),
  });
  const audit = new AuditLogService(prisma);
  const configSnapshot = loadConfigSnapshot({
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: TEST_JWT_CONFIG.secret,
      SETUP_SECRET: TEST_SETUP_SECRET,
      DATABASE_URL: dbUrl,
    },
  });

  const app = await buildApp({
    logger: false,
    healthDeps: { docker, prisma, appVersion: 'test', startedAt: Date.now() },
    auth,
    users,
    containers,
    images,
    volumes,
    networks,
    sites,
    dns,
    features,
    storage,
    registry,
    databases,
    backups,
    scheduler,
    explorer,
    configSnapshot,
    audit,
    jwtConfig: TEST_JWT_CONFIG,
    setupSecret: TEST_SETUP_SECRET,
  });

  return {
    app,
    prisma,
    audit,
    cron,
    async cleanup() {
      await app.close();
      await prisma.$disconnect();
      try {
        rmSync(dbPath, { force: true });
        rmSync(`${dbPath}-journal`, { force: true });
      } catch {
        // ignore
      }
    },
  };
}
