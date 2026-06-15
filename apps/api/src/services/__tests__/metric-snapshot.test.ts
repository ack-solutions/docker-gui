import { describe, it, expect } from 'vitest';
import type { ContainerStats } from 'dockerode';
import {
  assembleSnapshot,
  buildMetricCatalog,
  computeContainerCpuPercent,
  computeContainerMemoryPercent,
  describeMetric,
} from '../metric-snapshot.js';

function cpuStats(curTotal: number, curSystem: number, preTotal: number, preSystem: number) {
  return {
    cpu_stats: {
      cpu_usage: { total_usage: curTotal, percpu_usage: [], usage_in_usermode: 0, usage_in_kernelmode: 0 },
      system_cpu_usage: curSystem,
      online_cpus: 4,
      throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 },
    },
    precpu_stats: {
      cpu_usage: { total_usage: preTotal, percpu_usage: [], usage_in_usermode: 0, usage_in_kernelmode: 0 },
      system_cpu_usage: preSystem,
      online_cpus: 4,
      throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 },
    },
  } as unknown as Pick<ContainerStats, 'cpu_stats' | 'precpu_stats'>;
}

function memStats(usage: number, limit: number, inactiveFile?: number, cache = 0) {
  // total_inactive_file present => cgroup v2; absent => cgroup v1 (fall back to cache).
  const stats: Record<string, number> = { cache };
  if (inactiveFile !== undefined) stats['total_inactive_file'] = inactiveFile;
  return {
    memory_stats: { usage, limit, max_usage: usage, failcnt: 0, stats },
  } as unknown as Pick<ContainerStats, 'memory_stats'>;
}

describe('computeContainerCpuPercent', () => {
  it('returns the container share of total host CPU (0-100)', () => {
    // cpuDelta=100M, systemDelta=1000M -> 10% of the whole machine
    expect(computeContainerCpuPercent(cpuStats(200_000_000, 2_000_000_000, 100_000_000, 1_000_000_000))).toBe(10);
  });

  it('returns 0 when the system delta is non-positive (first sample / no movement)', () => {
    expect(computeContainerCpuPercent(cpuStats(100, 1000, 100, 1000))).toBe(0);
  });

  it('clamps to 100 and never goes negative', () => {
    expect(computeContainerCpuPercent(cpuStats(2_000_000_000, 1_000_000_000, 0, 0))).toBe(100);
    // counter reset: current < previous -> negative cpuDelta -> 0, not a wild number
    expect(computeContainerCpuPercent(cpuStats(50, 2000, 100, 1000))).toBe(0);
  });
});

describe('computeContainerMemoryPercent', () => {
  it('subtracts reclaimable page cache (total_inactive_file) like docker stats', () => {
    // usage 600MB, inactive_file 100MB -> used 500MB of 1000MB limit = 50%
    expect(computeContainerMemoryPercent(memStats(600, 1000, 100))).toBe(50);
  });

  it('falls back to cgroup-v1 cache when total_inactive_file is absent', () => {
    expect(computeContainerMemoryPercent(memStats(800, 1000, undefined, 300))).toBe(50);
  });

  it('honors a literal zero reclaimable cache (does not fall back to v1 cache)', () => {
    // cgroup v2 reporting 0 inactive_file is real data, not "missing".
    expect(computeContainerMemoryPercent(memStats(700, 1000, 0, 300))).toBe(70);
  });

  it('returns 0 when there is no positive limit', () => {
    expect(computeContainerMemoryPercent(memStats(500, 0))).toBe(0);
  });
});

describe('assembleSnapshot', () => {
  it('flattens system, per-disk and per-container metrics into one keyed map', () => {
    const snap = assembleSnapshot({
      cpuPercent: 12.345,
      memoryPercent: 47.6,
      disks: [
        { path: '/', usagePercent: 5.1 },
        { path: '/data', usagePercent: 88.27 },
      ],
      containers: [{ name: 'web', cpuPercent: 3.333, memoryPercent: 61.5 }],
    });
    expect(snap).toEqual({
      'system.cpu.percent': 12.35,
      'system.memory.percent': 47.6,
      'system.disk./.percent': 5.1,
      'system.disk./data.percent': 88.27,
      'container.web.cpu.percent': 3.33,
      'container.web.memory.percent': 61.5,
    });
  });
});

describe('describeMetric', () => {
  it('produces friendly labels for every key shape', () => {
    expect(describeMetric('system.cpu.percent')).toBe('CPU %');
    expect(describeMetric('system.memory.percent')).toBe('Memory %');
    expect(describeMetric('system.disk./.percent')).toBe('Disk / · usage %');
    expect(describeMetric('container.api.cpu.percent')).toBe('Container api · CPU %');
    expect(describeMetric('container.api.memory.percent')).toBe('Container api · Memory %');
    expect(describeMetric('something.else')).toBe('something.else');
  });
});

describe('buildMetricCatalog', () => {
  it('lists system + per-disk + per-container keys with labels, no stats needed', () => {
    const cat = buildMetricCatalog({ diskPaths: ['/'], containerNames: ['web', 'db'] });
    expect(cat.map((c) => c.value)).toEqual([
      'system.cpu.percent',
      'system.memory.percent',
      'system.disk./.percent',
      'container.web.cpu.percent',
      'container.web.memory.percent',
      'container.db.cpu.percent',
      'container.db.memory.percent',
    ]);
    expect(cat[0]).toEqual({ value: 'system.cpu.percent', label: 'CPU %' });
  });
});
