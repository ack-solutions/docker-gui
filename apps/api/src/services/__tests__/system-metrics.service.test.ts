import { describe, it, expect } from 'vitest';
import {
  getCpuUsagePercent,
  getMemoryMetrics,
  getDiskMetrics,
  getSystemMetrics,
} from '../system-metrics.service.js';

describe('getMemoryMetrics', () => {
  it('returns positive total and consistent fields', () => {
    const m = getMemoryMetrics();
    expect(m.totalBytes).toBeGreaterThan(0);
    expect(m.freeBytes).toBeGreaterThanOrEqual(0);
    expect(m.usedBytes).toBe(Math.max(0, m.totalBytes - m.freeBytes));
  });

  it('produces a usage percentage between 0 and 100', () => {
    const m = getMemoryMetrics();
    expect(m.usagePercent).toBeGreaterThanOrEqual(0);
    expect(m.usagePercent).toBeLessThanOrEqual(100);
  });
});

describe('getCpuUsagePercent', () => {
  it('returns a percentage between 0 and 100', async () => {
    const usage = await getCpuUsagePercent(50);
    expect(usage).toBeGreaterThanOrEqual(0);
    expect(usage).toBeLessThanOrEqual(100);
  });

  it('returns a finite number', async () => {
    const usage = await getCpuUsagePercent(50);
    expect(Number.isFinite(usage)).toBe(true);
  });
});

describe('getDiskMetrics', () => {
  it('returns metrics for the root filesystem', async () => {
    const disks = await getDiskMetrics(['/']);
    expect(disks.length).toBeGreaterThanOrEqual(1);
    const root = disks[0]!;
    expect(root.path).toBe('/');
    expect(root.totalBytes).toBeGreaterThan(0);
    expect(root.usagePercent).toBeGreaterThanOrEqual(0);
    expect(root.usagePercent).toBeLessThanOrEqual(100);
    expect(root.usedBytes + (root.totalBytes - root.usedBytes)).toBe(root.totalBytes);
  });

  it('skips inaccessible paths silently', async () => {
    const disks = await getDiskMetrics(['/this/path/should/not/exist/anywhere']);
    expect(disks).toEqual([]);
  });

  it('returns an empty array when no paths supplied', async () => {
    expect(await getDiskMetrics([])).toEqual([]);
  });
});

describe('getSystemMetrics', () => {
  it('returns the full system snapshot', async () => {
    const m = await getSystemMetrics(['/']);
    expect(m.cpu.cores).toBeGreaterThan(0);
    expect(m.cpu.loadAverage).toHaveLength(3);
    expect(m.cpu.usagePercent).toBeGreaterThanOrEqual(0);
    expect(m.memory.totalBytes).toBeGreaterThan(0);
    expect(m.disks.length).toBeGreaterThanOrEqual(1);
  });
});
