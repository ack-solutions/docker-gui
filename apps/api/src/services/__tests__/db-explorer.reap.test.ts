import { describe, it, expect, beforeEach } from 'vitest';
import type Docker from 'dockerode';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbExplorerService } from '../db-explorer.service.js';
import { CryptoBox } from '../../lib/crypto-box.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

interface FakeContainer {
  Id: string;
  Image: string;
  State: string;
  Labels: Record<string, string>;
}
const state = { containers: [] as FakeContainer[], n: 1 };

function fakeDocker(): Docker {
  return {
    listContainers: (opts?: { filters?: { label?: string[] } }) => {
      let list = state.containers;
      for (const lf of opts?.filters?.label ?? []) {
        const [k, v] = lf.split('=');
        list = list.filter((c) => c.Labels[k!] === v);
      }
      return Promise.resolve(list);
    },
    createContainer: (spec: { Image: string; Labels: Record<string, string> }) => {
      const c: FakeContainer = { Id: `c${state.n++}`, Image: spec.Image, State: 'created', Labels: spec.Labels };
      state.containers.push(c);
      return Promise.resolve({ id: c.Id, start: () => { c.State = 'running'; return Promise.resolve(); } });
    },
    getContainer: (id: string) => ({
      stop: () => { const c = state.containers.find((x) => x.Id === id); if (c) c.State = 'exited'; return Promise.resolve(); },
      remove: () => { state.containers = state.containers.filter((x) => x.Id !== id); return Promise.resolve(); },
    }),
  } as unknown as Docker;
}

let prisma: PrismaClient;
let dbPath: string;
let now = 1_000_000;

beforeEach(() => {
  state.containers = [];
  state.n = 1;
  now = 1_000_000;
});

async function setupPrisma(): Promise<void> {
  const dir = join(ROOT, 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  dbPath = join(dir, `reap-${process.pid}-${state.n}-${Math.random().toString(36).slice(2, 8)}.db`);
  execSync('npx prisma migrate deploy', { cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${dbPath}` }, stdio: 'pipe' });
  prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
}

describe('DbExplorerService.reapIdle', () => {
  it('reaps sidecars idle longer than the TTL, keeps fresh ones', async () => {
    await setupPrisma();
    try {
      const crypto = new CryptoBox('reap-test-secret-which-is-quite-long-1234567890');
      const conn = await prisma.databaseConnection.create({
        data: { name: 'pg', engine: 'postgres', host: 'h', port: 5432, username: 'u', passwordCipher: crypto.seal('pw'), database: 'd', ssl: false },
      });
      const svc = new DbExplorerService(prisma, crypto, fakeDocker(), {
        network: 'n',
        idleTtlMs: 1000,
        clock: () => now,
      });

      // Launch → recorded as accessed at t=now.
      await svc.open(conn.id);
      expect(state.containers).toHaveLength(1);

      // Not yet idle → not reaped.
      now += 500;
      expect(await svc.reapIdle()).toEqual([]);
      expect(state.containers).toHaveLength(1);

      // Past the TTL → reaped.
      now += 1000;
      const reaped = await svc.reapIdle();
      expect(reaped).toEqual([conn.id]);
      expect(state.containers).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
      rmSync(dbPath, { force: true });
    }
  });
});
