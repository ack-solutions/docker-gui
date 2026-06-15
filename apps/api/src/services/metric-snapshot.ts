import type { ContainerStats } from 'dockerode';
import type { MetricSnapshot } from './alert.service.js';

/**
 * Metric snapshot assembly + Docker per-container stat math.
 *
 * The alert evaluator matches rules against a flat `Record<string, number>`
 * keyed by metric name. This module owns the metric-name vocabulary and the
 * (pure, unit-tested) maths that turn raw Docker stats into percentages, so
 * the evaluation loop and the "available metrics" catalog stay in lock-step.
 *
 * Metric keys:
 *   system.cpu.percent
 *   system.memory.percent
 *   system.disk.<path>.percent        e.g. system.disk./.percent
 *   container.<name>.cpu.percent      % of total host CPU used by the container
 *   container.<name>.memory.percent   used (minus page cache) / limit
 */

export interface DiskLike {
  path: string;
  usagePercent: number;
}

export interface ContainerStatSample {
  name: string;
  cpuPercent: number;
  memoryPercent: number;
}

export interface MetricDescriptor {
  value: string;
  label: string;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function diskMetricKey(path: string): string {
  return `system.disk.${path}.percent`;
}

export function containerCpuKey(name: string): string {
  return `container.${name}.cpu.percent`;
}

export function containerMemoryKey(name: string): string {
  return `container.${name}.memory.percent`;
}

/**
 * CPU as a fraction of total host capacity (0–100), matching the semantics of
 * `system.cpu.percent`. `system_cpu_usage` already spans every core, so the
 * raw ratio is the share of the whole machine — we deliberately do NOT multiply
 * by online_cpus (which is the `docker stats` convention that can exceed 100%).
 */
export function computeContainerCpuPercent(
  stats: Pick<ContainerStats, 'cpu_stats' | 'precpu_stats'>,
): number {
  const cpu = stats.cpu_stats;
  const pre = stats.precpu_stats;
  if (!cpu?.cpu_usage || !pre?.cpu_usage) return 0;
  const cpuDelta = cpu.cpu_usage.total_usage - pre.cpu_usage.total_usage;
  const systemDelta = cpu.system_cpu_usage - pre.system_cpu_usage;
  if (systemDelta <= 0 || cpuDelta < 0) return 0;
  return clamp((cpuDelta / systemDelta) * 100, 0, 100);
}

/**
 * Memory usage as a percentage of the container's limit. Subtracts reclaimable
 * page cache the way `docker stats` does — `total_inactive_file` on cgroup v2,
 * falling back to `cache` on v1 — so a container isn't flagged for cache it
 * doesn't really need.
 */
export function computeContainerMemoryPercent(
  stats: Pick<ContainerStats, 'memory_stats'>,
): number {
  const m = stats.memory_stats;
  if (!m || !m.limit || m.limit <= 0) return 0;
  const cache = m.stats?.total_inactive_file ?? m.stats?.cache ?? 0;
  const used = Math.max(0, m.usage - cache);
  return clamp((used / m.limit) * 100, 0, 100);
}

/** Assemble the flat snapshot the evaluator checks rules against. Pure. */
export function assembleSnapshot(input: {
  cpuPercent: number;
  memoryPercent: number;
  disks: DiskLike[];
  containers: ContainerStatSample[];
}): MetricSnapshot {
  const snap: MetricSnapshot = {
    'system.cpu.percent': round2(input.cpuPercent),
    'system.memory.percent': round2(input.memoryPercent),
  };
  for (const d of input.disks) snap[diskMetricKey(d.path)] = round2(d.usagePercent);
  for (const c of input.containers) {
    snap[containerCpuKey(c.name)] = round2(c.cpuPercent);
    snap[containerMemoryKey(c.name)] = round2(c.memoryPercent);
  }
  return snap;
}

/** Friendly label for a metric key (for the UI dropdown). Pure. */
export function describeMetric(key: string): string {
  if (key === 'system.cpu.percent') return 'CPU %';
  if (key === 'system.memory.percent') return 'Memory %';
  const disk = /^system\.disk\.(.+)\.percent$/.exec(key);
  if (disk) return `Disk ${disk[1]} · usage %`;
  const ccpu = /^container\.(.+)\.cpu\.percent$/.exec(key);
  if (ccpu) return `Container ${ccpu[1]} · CPU %`;
  const cmem = /^container\.(.+)\.memory\.percent$/.exec(key);
  if (cmem) return `Container ${cmem[1]} · Memory %`;
  return key;
}

/**
 * The catalog of metric keys a user can build a rule on right now. Built from
 * cheap inputs (disk paths + running container names) — no Docker stats call —
 * so populating the rule dialog is fast. Pure.
 */
export function buildMetricCatalog(input: {
  diskPaths: string[];
  containerNames: string[];
}): MetricDescriptor[] {
  const keys: string[] = ['system.cpu.percent', 'system.memory.percent'];
  for (const p of input.diskPaths) keys.push(diskMetricKey(p));
  for (const name of input.containerNames) {
    keys.push(containerCpuKey(name));
    keys.push(containerMemoryKey(name));
  }
  return keys.map((value) => ({ value, label: describeMetric(value) }));
}
