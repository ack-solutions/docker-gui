import { describe, it, expect, vi } from 'vitest';
import type Docker from 'dockerode';
import type { PrismaClient } from '@prisma/client';
import {
  checkDocker,
  checkApi,
  checkDatabase,
  rollupStatus,
  getHealth,
} from '../health.service.js';

function mockDocker(opts: {
  ping?: () => Promise<unknown>;
  version?: () => Promise<unknown>;
} = {}): Docker {
  return {
    ping: opts.ping ?? (() => Promise.resolve('OK')),
    version:
      opts.version ??
      (() => Promise.resolve({ Version: '24.0.7', ApiVersion: '1.43', Os: 'linux', Arch: 'amd64' })),
  } as unknown as Docker;
}

function mockPrisma(query: () => Promise<unknown> = () => Promise.resolve([{ ok: 1 }])): PrismaClient {
  return { $queryRaw: vi.fn().mockImplementation(query) } as unknown as PrismaClient;
}

describe('checkDocker', () => {
  it('returns ok when daemon is reachable', async () => {
    const r = await checkDocker(mockDocker());
    expect(r.status).toBe('ok');
    expect(r.details).toMatchObject({ version: '24.0.7' });
  });

  it('returns unavailable when ping rejects', async () => {
    const r = await checkDocker(
      mockDocker({ ping: () => Promise.reject(new Error('ECONNREFUSED')) }),
    );
    expect(r.status).toBe('unavailable');
    expect(r.message).toContain('ECONNREFUSED');
  });
});

describe('checkApi', () => {
  it('always returns ok', () => {
    expect(checkApi().status).toBe('ok');
  });
});

describe('checkDatabase', () => {
  it('returns unavailable when prisma is null', async () => {
    const r = await checkDatabase(null);
    expect(r.status).toBe('unavailable');
  });

  it('returns ok on successful query', async () => {
    const r = await checkDatabase(mockPrisma());
    expect(r.status).toBe('ok');
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns down on query error', async () => {
    const r = await checkDatabase(mockPrisma(() => Promise.reject(new Error('connection lost'))));
    expect(r.status).toBe('down');
    expect(r.message).toContain('connection lost');
  });
});

describe('rollupStatus', () => {
  it('ok when all required ok and none unavailable', () => {
    expect(rollupStatus([{ status: 'ok' }, { status: 'ok' }])).toBe('ok');
  });

  it('degraded with unavailable checks', () => {
    expect(rollupStatus([{ status: 'ok' }, { status: 'unavailable' }])).toBe('degraded');
  });

  it('down when any required check is down', () => {
    expect(rollupStatus([{ status: 'ok' }, { status: 'down' }])).toBe('down');
  });

  it('degraded when any required check is degraded', () => {
    expect(rollupStatus([{ status: 'ok' }, { status: 'degraded' }])).toBe('degraded');
  });
});

describe('getHealth', () => {
  it('rolls up to ok with healthy DB + Docker', async () => {
    const r = await getHealth({
      docker: mockDocker(),
      prisma: mockPrisma(),
      appVersion: '0.0.0-test',
      startedAt: Date.now() - 5000,
    });
    expect(r.status).toBe('ok');
    expect(r.checks.database.status).toBe('ok');
    expect(r.checks.docker.status).toBe('ok');
    expect(r.uptime).toBeGreaterThanOrEqual(5);
    expect(r.system.cpu.cores).toBeGreaterThan(0);
  });

  it('reports down when DB is down', async () => {
    const r = await getHealth({
      docker: mockDocker(),
      prisma: mockPrisma(() => Promise.reject(new Error('db gone'))),
      appVersion: 'x',
      startedAt: Date.now(),
    });
    expect(r.status).toBe('down');
    expect(r.checks.database.status).toBe('down');
  });

  it('reports degraded when DB is intentionally not wired (null)', async () => {
    const r = await getHealth({
      docker: mockDocker(),
      prisma: null,
      appVersion: 'x',
      startedAt: Date.now(),
    });
    expect(r.status).toBe('degraded');
    expect(r.checks.database.status).toBe('unavailable');
  });
});
