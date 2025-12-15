import { prisma } from "../database/client";
import { SettingsService } from "./settings-service";
import type { SystemMetrics } from "@/types/system";
import type {
  DiskMetricsLog as PrismaDiskMetricsLog,
  MemoryMetricsLog as PrismaMemoryMetricsLog
} from "@prisma/client";

type SerializedMemoryLog = Omit<PrismaMemoryMetricsLog, "usedBytes" | "totalBytes" | "freeBytes"> & {
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
};

type SerializedDiskLog = Omit<PrismaDiskMetricsLog, "usedBytes" | "totalBytes" | "availableBytes"> & {
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
};

type MetricType = "cpu" | "memory" | "disk";

interface CpuBatch {
  timestamp: Date;
  usagePercent: number;
  loadAverage1m: number;
  loadAverage5m: number;
  loadAverage15m: number;
  coresUsage: { coreId: string; usagePercent: number }[];
}

interface MemoryBatch {
  timestamp: Date;
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
}

interface DiskBatch {
  timestamp: Date;
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
  partitions: { filesystem: string; mountpoint: string; usagePercent: number; usedBytes: number; totalBytes: number }[];
}

export class MetricsLoggingService {
  private static instance: MetricsLoggingService;
  
  // Separate queues for each metric type
  private cpuQueue: CpuBatch[] = [];
  private memoryQueue: MemoryBatch[] = [];
  private diskQueue: DiskBatch[] = [];

  // Separate timers for each metric type
  private cpuBatchTimer: NodeJS.Timeout | null = null;
  private memoryBatchTimer: NodeJS.Timeout | null = null;
  private diskBatchTimer: NodeJS.Timeout | null = null;

  // Cleanup timers
  private cpuCleanupTimer: NodeJS.Timeout | null = null;
  private memoryCleanupTimer: NodeJS.Timeout | null = null;
  private diskCleanupTimer: NodeJS.Timeout | null = null;

  // Processing flags
  private isProcessingCpu = false;
  private isProcessingMemory = false;
  private isProcessingDisk = false;

  private constructor() {
    // Initialize silently - no logging to reduce overhead
    this.startBatchProcessing();
    this.startCleanupSchedulers();
  }

  static getInstance(): MetricsLoggingService {
    if (!MetricsLoggingService.instance) {
      MetricsLoggingService.instance = new MetricsLoggingService();
    }
    return MetricsLoggingService.instance;
  }

  /**
   * Queue metrics from a SystemMetrics snapshot
   * Each metric type is queued separately and will be saved based on its own frequency
   * Returns early if logging is disabled
   */
  async queueMetrics(metrics: SystemMetrics): Promise<void> {
    // Check if metrics logging is enabled
    const enabled = await SettingsService.getInstance().getValue<boolean>(
      "METRICS_LOGGING_ENABLED",
      false // Disabled by default to reduce overhead
    );
    
    if (!enabled) {
      return; // Skip all processing if disabled
    }
    const timestamp = new Date(metrics.timestamp);

    // Queue CPU metrics
    const cpuBatch: CpuBatch = {
      timestamp,
      usagePercent: metrics.cpu.overallUsagePercent,
      loadAverage1m: metrics.cpu.loadAverage[0],
      loadAverage5m: metrics.cpu.loadAverage[1],
      loadAverage15m: metrics.cpu.loadAverage[2],
      coresUsage: metrics.cpu.cores.map((core) => ({
        coreId: core.id,
        usagePercent: core.usagePercent
      }))
    };
    this.cpuQueue.push(cpuBatch);

    // Queue Memory metrics
    const memoryBatch: MemoryBatch = {
      timestamp,
      usagePercent: metrics.memory.usagePercent,
      usedBytes: metrics.memory.usedBytes,
      totalBytes: metrics.memory.totalBytes,
      freeBytes: metrics.memory.freeBytes
    };
    this.memoryQueue.push(memoryBatch);

    // Queue Disk metrics (if available)
    if (metrics.disks) {
      const diskBatch: DiskBatch = {
        timestamp,
        usagePercent: metrics.disks.usagePercent,
        usedBytes: metrics.disks.usedBytes,
        totalBytes: metrics.disks.totalBytes,
        availableBytes: metrics.disks.availableBytes,
        partitions: metrics.disks.partitions.map((p) => ({
          filesystem: p.filesystem,
          mountpoint: p.mountpoint,
          usagePercent: p.usagePercent,
          usedBytes: p.usedBytes,
          totalBytes: p.sizeBytes
        }))
      };
      this.diskQueue.push(diskBatch);
    }

    // Check if any queue needs immediate flushing
    await Promise.all([
      this.checkAndFlush("cpu"),
      this.checkAndFlush("memory"),
      this.checkAndFlush("disk")
    ]);
  }

  /**
   * Check if a queue has reached its batch size and flush if needed
   */
  private async checkAndFlush(type: MetricType): Promise<void> {
    const batchSize = await SettingsService.getInstance().getValue<number>(
      `METRICS_LOG_BATCH_SIZE_${type.toUpperCase()}`,
      this.getDefaultBatchSize(type)
    );

    const queue = this.getQueue(type);
    if (queue.length >= batchSize) {
      await this.flushBatch(type);
    }
  }

  /**
   * Get the queue for a specific metric type
   */
  private getQueue(type: MetricType): any[] {
    switch (type) {
      case "cpu": return this.cpuQueue;
      case "memory": return this.memoryQueue;
      case "disk": return this.diskQueue;
    }
  }

  /**
   * Get default batch size for a metric type
   */
  private getDefaultBatchSize(type: MetricType): number {
    switch (type) {
      case "cpu": return 60;      // Save every 60 samples (10 minutes at 10s intervals)
      case "memory": return 60;   // Save every 60 samples (10 minutes at 10s intervals)
      case "disk": return 6;      // Save every 6 samples (1 hour at 10 minute intervals)
    }
  }

  /**
   * Get default batch interval for a metric type (in milliseconds)
   */
  private getDefaultBatchInterval(type: MetricType): number {
    switch (type) {
      case "cpu": return 600000;     // 10 minutes
      case "memory": return 600000;  // 10 minutes
      case "disk": return 3600000;   // 1 hour
    }
  }

  /**
   * Flush the batch for a specific metric type
   */
  private async flushBatch(type: MetricType): Promise<void> {
    const isProcessing = this.getProcessingFlag(type);
    const queue = this.getQueue(type);

    if (isProcessing || queue.length === 0) {
      return;
    }

    this.setProcessingFlag(type, true);

    try {
      const batchToSave = [...queue];
      this.clearQueue(type);

        if (batchToSave.length > 0) {
        switch (type) {
          case "cpu": {
            await prisma.cpuMetricsLog.createMany({
              data: batchToSave.map((batch: CpuBatch) => ({
                timestamp: batch.timestamp,
                usagePercent: batch.usagePercent,
                loadAverage1m: batch.loadAverage1m,
                loadAverage5m: batch.loadAverage5m,
                loadAverage15m: batch.loadAverage15m,
                coresUsage: batch.coresUsage
              }))
            });
            break;
          }
          case "memory": {
            await prisma.memoryMetricsLog.createMany({
              data: batchToSave.map((batch: MemoryBatch) => ({
                timestamp: batch.timestamp,
                usagePercent: batch.usagePercent,
                usedBytes: BigInt(Math.round(batch.usedBytes)),
                totalBytes: BigInt(Math.round(batch.totalBytes)),
                freeBytes: BigInt(Math.round(batch.freeBytes))
              }))
            });
            break;
          }
          case "disk": {
            await prisma.diskMetricsLog.createMany({
              data: batchToSave.map((batch: DiskBatch) => ({
                timestamp: batch.timestamp,
                usagePercent: batch.usagePercent,
                usedBytes: BigInt(Math.round(batch.usedBytes)),
                totalBytes: BigInt(Math.round(batch.totalBytes)),
                availableBytes: BigInt(Math.round(batch.availableBytes)),
                partitions: batch.partitions
              }))
            });
            break;
          }
        }
      }
    } catch (error) {
      // Silently handle errors to reduce logging overhead
      // Don't lose the data - but limit queue size to prevent memory issues
      const queue = this.getQueue(type);
      if (queue.length < 100) {
        // Data is already lost since we cleared the queue above
      }
    } finally {
      this.setProcessingFlag(type, false);
    }
  }

  private getProcessingFlag(type: MetricType): boolean {
    switch (type) {
      case "cpu": return this.isProcessingCpu;
      case "memory": return this.isProcessingMemory;
      case "disk": return this.isProcessingDisk;
    }
  }

  private setProcessingFlag(type: MetricType, value: boolean): void {
    switch (type) {
      case "cpu": this.isProcessingCpu = value; break;
      case "memory": this.isProcessingMemory = value; break;
      case "disk": this.isProcessingDisk = value; break;
    }
  }

  private clearQueue(type: MetricType): void {
    switch (type) {
      case "cpu": this.cpuQueue = []; break;
      case "memory": this.memoryQueue = []; break;
      case "disk": this.diskQueue = []; break;
    }
  }

  /**
   * Start periodic batch processing for all metric types
   */
  private startBatchProcessing(): void {
    this.scheduleBatchProcessing("cpu");
    this.scheduleBatchProcessing("memory");
    this.scheduleBatchProcessing("disk");
  }

  private scheduleBatchProcessing(type: MetricType): void {
    const scheduleNext = () => {
      // Fetch settings asynchronously but start timer immediately with defaults
      SettingsService.getInstance()
        .getValue<number>(
          `METRICS_LOG_BATCH_INTERVAL_MS_${type.toUpperCase()}`,
          this.getDefaultBatchInterval(type)
        )
        .then((intervalMs) => {
          const timer = setTimeout(async () => {
            await this.flushBatch(type);
            scheduleNext(); // Schedule next after flush completes
          }, intervalMs);

          this.setBatchTimer(type, timer);
        })
        .catch(() => {
          // Fallback to default interval silently
          const intervalMs = this.getDefaultBatchInterval(type);
          const timer = setTimeout(async () => {
            await this.flushBatch(type);
            scheduleNext();
          }, intervalMs);

          this.setBatchTimer(type, timer);
        });
    };

    scheduleNext();
  }

  private setBatchTimer(type: MetricType, timer: NodeJS.Timeout): void {
    switch (type) {
      case "cpu": this.cpuBatchTimer = timer; break;
      case "memory": this.memoryBatchTimer = timer; break;
      case "disk": this.diskBatchTimer = timer; break;
    }
  }

  /**
   * Clean up old logs based on retention settings
   */
  async cleanupOldLogs(type?: MetricType): Promise<{ cpu: number; memory: number; disk: number }> {
    const types: MetricType[] = type ? [type] : ["cpu", "memory", "disk"];
    const results = { cpu: 0, memory: 0, disk: 0 };

    for (const metricType of types) {
      try {
        const settingsService = SettingsService.getInstance();
        const retentionDays = await settingsService.getValue<number>(
          `METRICS_LOG_RETENTION_DAYS_${metricType.toUpperCase()}`,
          this.getDefaultRetentionDays(metricType)
        );

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let deletedCount = 0;

        switch (metricType) {
          case "cpu": {
            const result = await prisma.cpuMetricsLog.deleteMany({
              where: { timestamp: { lt: cutoffDate } }
            });
            deletedCount = result.count;
            results.cpu = deletedCount;
            break;
          }
          case "memory": {
            const result = await prisma.memoryMetricsLog.deleteMany({
              where: { timestamp: { lt: cutoffDate } }
            });
            deletedCount = result.count;
            results.memory = deletedCount;
            break;
          }
          case "disk": {
            const result = await prisma.diskMetricsLog.deleteMany({
              where: { timestamp: { lt: cutoffDate } }
            });
            deletedCount = result.count;
            results.disk = deletedCount;
            break;
          }
        }

        // Cleanup completed silently
      } catch (error) {
        // Silently handle cleanup errors
      }
    }

    return results;
  }

  private getDefaultRetentionDays(type: MetricType): number {
    switch (type) {
      case "cpu": return 3;      // 3 days (reduced from 7)
      case "memory": return 3;   // 3 days (reduced from 7)
      case "disk": return 7;    // 7 days (reduced from 30)
    }
  }

  /**
   * Start periodic cleanup schedulers
   */
  private startCleanupSchedulers(): void {
    this.scheduleCleanup("cpu");
    this.scheduleCleanup("memory");
    this.scheduleCleanup("disk");
  }

  private scheduleCleanup(type: MetricType): void {
    const scheduleNext = () => {
      Promise.all([
        SettingsService.getInstance().getValue<number>(
          `METRICS_CLEANUP_INTERVAL_HOURS_${type.toUpperCase()}`,
          24
        ),
        SettingsService.getInstance().getValue<boolean>(
          `METRICS_CLEANUP_ENABLED_${type.toUpperCase()}`,
          true
        )
      ])
        .then(async ([intervalHours, enabled]) => {
          if (enabled) {
            await this.cleanupOldLogs(type);
          }

          const timer = setTimeout(() => {
            scheduleNext();
          }, intervalHours * 60 * 60 * 1000);

          this.setCleanupTimer(type, timer);
        })
        .catch(() => {
          // Retry after 1 hour on error silently
          const timer = setTimeout(() => {
            scheduleNext();
          }, 60 * 60 * 1000);

          this.setCleanupTimer(type, timer);
        });
    };

    scheduleNext();
  }

  private setCleanupTimer(type: MetricType, timer: NodeJS.Timeout): void {
    switch (type) {
      case "cpu": this.cpuCleanupTimer = timer; break;
      case "memory": this.memoryCleanupTimer = timer; break;
      case "disk": this.diskCleanupTimer = timer; break;
    }
  }

  /**
   * Get recent logs for a specific metric type
   */
  async getRecentLogs(type: MetricType, limit = 100, offset = 0): Promise<any[]> {
    switch (type) {
      case "cpu":
        return prisma.cpuMetricsLog.findMany({
          orderBy: { timestamp: "desc" },
          take: limit,
          skip: offset
        });
      case "memory": {
        const logs = await prisma.memoryMetricsLog.findMany({
          orderBy: { timestamp: "desc" },
          take: limit,
          skip: offset
        });
        return logs.map((log) => this.serializeMemoryLog(log));
      }
      case "disk": {
        const logs = await prisma.diskMetricsLog.findMany({
          orderBy: { timestamp: "desc" },
          take: limit,
          skip: offset
        });
        return logs.map((log) => this.serializeDiskLog(log));
      }
    }
  }

  /**
   * Get logs for a specific time range
   */
  async getLogsByTimeRange(
    type: MetricType,
    startDate: Date,
    endDate: Date,
    limit = 1000
  ): Promise<any[]> {
    switch (type) {
      case "cpu":
        return prisma.cpuMetricsLog.findMany({
          where: { timestamp: { gte: startDate, lte: endDate } },
          orderBy: { timestamp: "desc" },
          take: limit
        });
      case "memory": {
        const logs = await prisma.memoryMetricsLog.findMany({
          where: { timestamp: { gte: startDate, lte: endDate } },
          orderBy: { timestamp: "desc" },
          take: limit
        });
        return logs.map((log) => this.serializeMemoryLog(log));
      }
      case "disk": {
        const logs = await prisma.diskMetricsLog.findMany({
          where: { timestamp: { gte: startDate, lte: endDate } },
          orderBy: { timestamp: "desc" },
          take: limit
        });
        return logs.map((log) => this.serializeDiskLog(log));
      }
    }
  }

  /**
   * Gracefully shutdown the service
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    if (this.cpuBatchTimer) clearTimeout(this.cpuBatchTimer);
    if (this.memoryBatchTimer) clearTimeout(this.memoryBatchTimer);
    if (this.diskBatchTimer) clearTimeout(this.diskBatchTimer);
    if (this.cpuCleanupTimer) clearTimeout(this.cpuCleanupTimer);
    if (this.memoryCleanupTimer) clearTimeout(this.memoryCleanupTimer);
    if (this.diskCleanupTimer) clearTimeout(this.diskCleanupTimer);

    // Flush any remaining metrics
    await Promise.all([
      this.flushBatch("cpu"),
      this.flushBatch("memory"),
      this.flushBatch("disk")
    ]);
  }

  private serializeMemoryLog(log: PrismaMemoryMetricsLog): SerializedMemoryLog {
    const { usedBytes, totalBytes, freeBytes, ...rest } = log;

    return {
      ...rest,
      usedBytes: Number(usedBytes),
      totalBytes: Number(totalBytes),
      freeBytes: Number(freeBytes)
    };
  }

  private serializeDiskLog(log: PrismaDiskMetricsLog): SerializedDiskLog {
    const { usedBytes, totalBytes, availableBytes, ...rest } = log;

    return {
      ...rest,
      usedBytes: Number(usedBytes),
      totalBytes: Number(totalBytes),
      availableBytes: Number(availableBytes)
    };
  }
}
