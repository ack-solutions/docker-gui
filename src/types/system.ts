export interface CpuCoreMetrics {
  id: string;
  usagePercent: number;
  speedMhz: number;
}

export interface CpuMetrics {
  overallUsagePercent: number;
  loadAverage: [number, number, number];
  cores: CpuCoreMetrics[];
}

export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
}

export interface DiskPartitionMetrics {
  filesystem: string;
  mountpoint: string;
  sizeBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface DiskMetrics {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
  partitions: DiskPartitionMetrics[];
}

export interface SystemMetrics {
  timestamp: string;
  hostname: string;
  platform: NodeJS.Platform;
  release: string;
  architecture: string;
  uptimeSeconds: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics | null;
}
