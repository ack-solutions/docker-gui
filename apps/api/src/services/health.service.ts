import type Docker from 'dockerode';
import type { PrismaClient } from '@prisma/client';
import type { CheckResult, CheckStatus, HealthResponse } from '../schemas/health.schema.js';
import { getSystemMetrics } from './system-metrics.service.js';

export interface HealthDeps {
  docker: Docker;
  prisma: PrismaClient | null; // null when DB is intentionally not wired (Phase 0 mode)
  appVersion: string;
  startedAt: number;
  diskPaths?: string[];
}

export async function checkDocker(docker: Docker): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    await docker.ping();
    const info = await docker.version();
    return {
      status: 'ok',
      latencyMs: Date.now() - t0,
      details: {
        version: info.Version,
        apiVersion: info.ApiVersion,
        os: info.Os,
        arch: info.Arch,
      },
    };
  } catch (err) {
    return {
      status: 'unavailable',
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : 'Docker daemon unreachable',
    };
  }
}

export function checkApi(): CheckResult {
  return { status: 'ok', latencyMs: 0 };
}

export async function checkDatabase(prisma: PrismaClient | null): Promise<CheckResult> {
  if (!prisma) {
    return { status: 'unavailable', message: 'database not wired' };
  }
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : 'Database query failed',
    };
  }
}

export function rollupStatus(checks: CheckResult[]): CheckStatus {
  const required = checks.filter((c) => c.status !== 'unavailable');
  if (required.length === 0) return 'degraded';
  if (required.every((c) => c.status === 'ok')) {
    return checks.some((c) => c.status === 'unavailable') ? 'degraded' : 'ok';
  }
  if (required.some((c) => c.status === 'down')) return 'down';
  return 'degraded';
}

export async function getHealth(deps: HealthDeps): Promise<HealthResponse> {
  const [system, docker, database] = await Promise.all([
    getSystemMetrics(deps.diskPaths ?? ['/']),
    checkDocker(deps.docker),
    checkDatabase(deps.prisma),
  ]);
  const api = checkApi();
  return {
    status: rollupStatus([api, docker, database]),
    uptime: Math.max(0, Math.floor((Date.now() - deps.startedAt) / 1000)),
    version: deps.appVersion,
    timestamp: new Date().toISOString(),
    checks: { api, docker, database },
    system,
  };
}
