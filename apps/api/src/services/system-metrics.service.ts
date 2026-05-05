import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import type { DiskMetrics, MemoryMetrics, SystemMetrics } from '../schemas/health.schema.js';

const CPU_SAMPLE_INTERVAL_MS = 100;

interface CpuSnapshot {
  idle: number;
  total: number;
}

function sampleCpuTimes(): CpuSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  return { idle, total };
}

export async function getCpuUsagePercent(
  intervalMs: number = CPU_SAMPLE_INTERVAL_MS,
): Promise<number> {
  const a = sampleCpuTimes();
  await new Promise((r) => setTimeout(r, intervalMs));
  const b = sampleCpuTimes();
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  if (totalDelta <= 0) return 0;
  return clamp(100 * (1 - idleDelta / totalDelta), 0, 100);
}

export function getMemoryMetrics(): MemoryMetrics {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  return {
    usedBytes,
    totalBytes,
    freeBytes,
    usagePercent: clamp(totalBytes > 0 ? 100 * (usedBytes / totalBytes) : 0, 0, 100),
  };
}

export async function getDiskMetrics(paths: string[] = ['/']): Promise<DiskMetrics[]> {
  const results: DiskMetrics[] = [];
  for (const path of paths) {
    try {
      const statfs = await fs.statfs(path);
      const blockSize = Number(statfs.bsize);
      const totalBytes = blockSize * Number(statfs.blocks);
      const availableBytes = blockSize * Number(statfs.bavail);
      const freeBytes = blockSize * Number(statfs.bfree);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      if (totalBytes <= 0) continue;
      results.push({
        path,
        usedBytes,
        totalBytes,
        availableBytes,
        usagePercent: clamp(100 * (usedBytes / totalBytes), 0, 100),
      });
    } catch {
      // Path not accessible — skip silently
    }
  }
  return results;
}

export async function getSystemMetrics(diskPaths: string[] = ['/']): Promise<SystemMetrics> {
  const cpus = os.cpus();
  const [cpuUsage, disks] = await Promise.all([getCpuUsagePercent(), getDiskMetrics(diskPaths)]);
  const [load1, load5, load15] = os.loadavg();
  return {
    cpu: {
      usagePercent: cpuUsage,
      cores: cpus.length,
      loadAverage: [load1 ?? 0, load5 ?? 0, load15 ?? 0],
    },
    memory: getMemoryMetrics(),
    disks,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
