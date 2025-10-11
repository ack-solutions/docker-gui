import { promisify } from "node:util";
import { execFile } from "node:child_process";
import os from "node:os";
import type {
  CpuCoreMetrics,
  DiskMetrics,
  DiskPartitionMetrics,
  MemoryMetrics,
  SystemMetrics
} from "@/types/system";

const execFileAsync = promisify(execFile);

const sleep = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

type CpuTimes = ReturnType<typeof os.cpus>[number]["times"];

const sumCpuTimes = (times: CpuTimes) => {
  return Object.values(times).reduce((sum, value) => sum + value, 0);
};

const calculateCpuMetrics = async (): Promise<{ overallUsage: number; cores: CpuCoreMetrics[] }> => {
  const firstSample = os.cpus();
  await sleep(150);
  const secondSample = os.cpus();

  const cores: CpuCoreMetrics[] = secondSample.map((cpu, index) => {
    const previous = firstSample[index];
    const prevTimes = previous.times;
    const nextTimes = cpu.times;

    const prevTotal = sumCpuTimes(prevTimes);
    const nextTotal = sumCpuTimes(nextTimes);

    const totalDelta = nextTotal - prevTotal;
    const idleDelta = nextTimes.idle - prevTimes.idle;

    const usage = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;

    return {
      id: `cpu-${index}`,
      usagePercent: Number.isFinite(usage) ? Number(usage.toFixed(1)) : 0,
      speedMhz: cpu.speed
    };
  });

  const overallUsage = cores.length > 0
    ? Number((cores.reduce((sum, core) => sum + core.usagePercent, 0) / cores.length).toFixed(1))
    : 0;

  return { overallUsage, cores };
};

const getMemoryMetrics = (): MemoryMetrics => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(total - free, 0);
  const usagePercent = total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0;

  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usagePercent
  };
};

const DISK_BINARIES = [
  ["df", ["-kP"]],
  ["df", ["-Pk"]]
] as const;

const parseDiskRow = (row: string): DiskPartitionMetrics | null => {
  const trimmed = row.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 6) {
    return null;
  }

  const [filesystem, blocks, used, available, capacity, ...rest] = parts;
  const mountpoint = rest.join(" ");

  const sizeKb = Number.parseInt(blocks, 10);
  const usedKb = Number.parseInt(used, 10);
  const availableKb = Number.parseInt(available, 10);
  const usagePercent = Number.parseFloat(capacity.replace("%", ""));

  if (!Number.isFinite(sizeKb) || sizeKb <= 0) {
    return null;
  }

  const sizeBytes = sizeKb * 1024;
  const usedBytes = Number.isFinite(usedKb) ? usedKb * 1024 : 0;
  const availableBytes = Number.isFinite(availableKb) ? availableKb * 1024 : 0;

  const normalizedUsage = Number.isFinite(usagePercent) ? usagePercent : 0;

  return {
    filesystem,
    mountpoint,
    sizeBytes,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : 0,
    availableBytes: Number.isFinite(availableBytes) ? availableBytes : 0,
    usagePercent: normalizedUsage
  };
};

const collectDiskMetrics = async (): Promise<DiskMetrics | null> => {
  for (const [command, args] of DISK_BINARIES) {
    try {
      const { stdout } = await execFileAsync(command, args);
      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length <= 1) {
        continue;
      }

      const partitions = lines
        .slice(1)
        .map(parseDiskRow)
        .filter((partition): partition is DiskPartitionMetrics => Boolean(partition))
        .filter((partition) => {
          const fs = partition.filesystem.toLowerCase();
          const mount = partition.mountpoint.toLowerCase();

          if (fs.startsWith("tmpfs") || fs.startsWith("devfs") || fs.startsWith("udev") || fs.startsWith("overlay")) {
            return false;
          }

          if (mount.startsWith("/run") || mount.includes("containers") || mount.startsWith("/dev")) {
            return false;
          }

          return mount.startsWith("/");
        });

      if (!partitions.length) {
        continue;
      }

      const totalBytes = partitions.reduce((sum, partition) => sum + partition.sizeBytes, 0);
      const usedBytes = partitions.reduce((sum, partition) => sum + partition.usedBytes, 0);
      const availableBytes = partitions.reduce((sum, partition) => sum + partition.availableBytes, 0);

      const usagePercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;

      return {
        totalBytes,
        usedBytes,
        availableBytes,
        usagePercent,
        partitions: partitions.sort((a, b) => a.mountpoint.localeCompare(b.mountpoint))
      };
    } catch (error) {
      console.warn(`[system] Unable to collect disk metrics with ${command}:`, error);
    }
  }

  return null;
};

export const collectSystemMetrics = async (): Promise<SystemMetrics> => {
  const [{ overallUsage, cores }, disks] = await Promise.all([
    calculateCpuMetrics(),
    collectDiskMetrics()
  ]);

  const loadAverage = os.loadavg();

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    uptimeSeconds: Math.max(os.uptime(), 0),
    cpu: {
      overallUsagePercent: overallUsage,
      loadAverage: [
        Number(loadAverage[0]?.toFixed(2) ?? 0),
        Number(loadAverage[1]?.toFixed(2) ?? 0),
        Number(loadAverage[2]?.toFixed(2) ?? 0)
      ] as [number, number, number],
      cores
    },
    memory: getMemoryMetrics(),
    disks
  };
};

export const generateMockSystemMetrics = (): SystemMetrics => {
  return {
    timestamp: new Date().toISOString(),
    hostname: "mock-host",
    platform: "linux",
    release: "6.8.12-mock",
    architecture: "x86_64",
    uptimeSeconds: 42_000,
    cpu: {
      overallUsagePercent: 37.5,
      loadAverage: [0.42, 0.38, 0.35],
      cores: [
        { id: "cpu-0", usagePercent: 32.1, speedMhz: 3200 },
        { id: "cpu-1", usagePercent: 41.8, speedMhz: 3200 },
        { id: "cpu-2", usagePercent: 29.5, speedMhz: 3200 },
        { id: "cpu-3", usagePercent: 46.6, speedMhz: 3200 }
      ]
    },
    memory: {
      totalBytes: 32 * 1024 ** 3,
      usedBytes: 18.7 * 1024 ** 3,
      freeBytes: 13.3 * 1024 ** 3,
      usagePercent: 58.4
    },
    disks: {
      totalBytes: 512 * 1024 ** 3,
      usedBytes: 284 * 1024 ** 3,
      availableBytes: 228 * 1024 ** 3,
      usagePercent: 55.5,
      partitions: [
        {
          filesystem: "/dev/sda1",
          mountpoint: "/",
          sizeBytes: 256 * 1024 ** 3,
          usedBytes: 190 * 1024 ** 3,
          availableBytes: 66 * 1024 ** 3,
          usagePercent: 74.2
        },
        {
          filesystem: "/dev/sdb1",
          mountpoint: "/data",
          sizeBytes: 256 * 1024 ** 3,
          usedBytes: 94 * 1024 ** 3,
          availableBytes: 162 * 1024 ** 3,
          usagePercent: 36.8
        }
      ]
    }
  };
};
