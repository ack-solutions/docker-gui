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
import { CaddyClient } from '../lib/caddy.js';

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
  cleanup: () => Promise<void>;
}

export interface BuildTestEnvOptions {
  docker?: Docker;
  caddy?: CaddyClient | null;
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
    jwtConfig: TEST_JWT_CONFIG,
    setupSecret: TEST_SETUP_SECRET,
  });

  return {
    app,
    prisma,
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
