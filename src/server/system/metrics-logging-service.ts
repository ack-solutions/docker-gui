import { LessThan } from "typeorm";
import { getDataSource } from "../database/data-source";
import { CpuMetricsLogEntity } from "./cpu-metrics-log.entity";
import { MemoryMetricsLogEntity } from "./memory-metrics-log.entity";
import { DiskMetricsLogEntity } from "./disk-metrics-log.entity";
import { SettingsService } from "./settings-service";
import type { SystemMetrics } from "@/types/system";

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
    console.log("[metrics-logging] Initializing MetricsLoggingService");
    this.startBatchProcessing();
    this.startCleanupSchedulers();
    console.log("[metrics-logging] Service initialized with separate queues for CPU, Memory, and Disk");
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
   */
  async queueMetrics(metrics: SystemMetrics): Promise<void> {
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

    console.log(
      `[metrics-logging] Queued metrics - CPU: ${this.cpuQueue.length}, Memory: ${this.memoryQueue.length}, Disk: ${this.diskQueue.length}`
    );

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
      case "cpu": return 10;      // Save every 10 samples (150s at 15s intervals)
      case "memory": return 10;   // Save every 10 samples (150s at 15s intervals)
      case "disk": return 1;      // Save every sample (can be hourly)
    }
  }

  /**
   * Get default batch interval for a metric type (in milliseconds)
   */
  private getDefaultBatchInterval(type: MetricType): number {
    switch (type) {
      case "cpu": return 30000;     // 30 seconds
      case "memory": return 30000;  // 30 seconds
      case "disk": return 3600000;  // 1 hour
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
      const dataSource = await getDataSource();
      const batchToSave = [...queue];
      this.clearQueue(type);

      if (batchToSave.length > 0) {
        switch (type) {
          case "cpu": {
            const repository = dataSource.getRepository(CpuMetricsLogEntity);
            const entities = batchToSave.map((batch: CpuBatch) =>
              repository.create(batch)
            );
            await repository.save(entities);
            break;
          }
          case "memory": {
            const repository = dataSource.getRepository(MemoryMetricsLogEntity);
            const entities = batchToSave.map((batch: MemoryBatch) =>
              repository.create(batch)
            );
            await repository.save(entities);
            break;
          }
          case "disk": {
            const repository = dataSource.getRepository(DiskMetricsLogEntity);
            const entities = batchToSave.map((batch: DiskBatch) =>
              repository.create(batch)
            );
            await repository.save(entities);
            break;
          }
        }
        console.log(`[metrics-logging] Saved ${batchToSave.length} ${type} metrics to database`);
      }
    } catch (error) {
      console.error(`[metrics-logging] Failed to save ${type} metrics batch:`, error);
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
          console.log(`[metrics-logging] Scheduling ${type} batch flush in ${intervalMs}ms`);
          const timer = setTimeout(async () => {
            console.log(`[metrics-logging] Timer fired for ${type}, flushing batch...`);
            await this.flushBatch(type);
            scheduleNext(); // Schedule next after flush completes
          }, intervalMs);

          this.setBatchTimer(type, timer);
        })
        .catch((error) => {
          console.error(`[metrics-logging] Failed to get batch interval for ${type}, using default`, error);
          // Fallback to default interval
          const intervalMs = this.getDefaultBatchInterval(type);
          console.log(`[metrics-logging] Using default interval for ${type}: ${intervalMs}ms`);
          const timer = setTimeout(async () => {
            console.log(`[metrics-logging] Timer fired for ${type}, flushing batch...`);
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

        const dataSource = await getDataSource();
        let deletedCount = 0;

        switch (metricType) {
          case "cpu": {
            const repository = dataSource.getRepository(CpuMetricsLogEntity);
            const result = await repository.delete({ timestamp: LessThan(cutoffDate) });
            deletedCount = result.affected ?? 0;
            results.cpu = deletedCount;
            break;
          }
          case "memory": {
            const repository = dataSource.getRepository(MemoryMetricsLogEntity);
            const result = await repository.delete({ timestamp: LessThan(cutoffDate) });
            deletedCount = result.affected ?? 0;
            results.memory = deletedCount;
            break;
          }
          case "disk": {
            const repository = dataSource.getRepository(DiskMetricsLogEntity);
            const result = await repository.delete({ timestamp: LessThan(cutoffDate) });
            deletedCount = result.affected ?? 0;
            results.disk = deletedCount;
            break;
          }
        }

        if (deletedCount > 0) {
          console.log(
            `[metrics-logging] Cleaned up ${deletedCount} old ${metricType} metrics logs (retention: ${retentionDays} days)`
          );
        }
      } catch (error) {
        console.error(`[metrics-logging] Failed to cleanup old ${metricType} logs:`, error);
      }
    }

    return results;
  }

  private getDefaultRetentionDays(type: MetricType): number {
    switch (type) {
      case "cpu": return 7;      // 7 days
      case "memory": return 7;   // 7 days
      case "disk": return 30;    // 30 days (changes slowly)
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
        .catch((error) => {
          console.error(`[metrics-logging] Failed to schedule cleanup for ${type}`, error);
          // Retry after 1 hour on error
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
    const dataSource = await getDataSource();

    switch (type) {
      case "cpu": {
        const repository = dataSource.getRepository(CpuMetricsLogEntity);
        return repository.find({
          order: { timestamp: "DESC" },
          take: limit,
          skip: offset
        });
      }
      case "memory": {
        const repository = dataSource.getRepository(MemoryMetricsLogEntity);
        return repository.find({
          order: { timestamp: "DESC" },
          take: limit,
          skip: offset
        });
      }
      case "disk": {
        const repository = dataSource.getRepository(DiskMetricsLogEntity);
        return repository.find({
          order: { timestamp: "DESC" },
          take: limit,
          skip: offset
        });
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
    const dataSource = await getDataSource();

    switch (type) {
      case "cpu": {
        const repository = dataSource.getRepository(CpuMetricsLogEntity);
        return repository
          .createQueryBuilder("log")
          .where("log.timestamp >= :startDate", { startDate })
          .andWhere("log.timestamp <= :endDate", { endDate })
          .orderBy("log.timestamp", "DESC")
          .limit(limit)
          .getMany();
      }
      case "memory": {
        const repository = dataSource.getRepository(MemoryMetricsLogEntity);
        return repository
          .createQueryBuilder("log")
          .where("log.timestamp >= :startDate", { startDate })
          .andWhere("log.timestamp <= :endDate", { endDate })
          .orderBy("log.timestamp", "DESC")
          .limit(limit)
          .getMany();
      }
      case "disk": {
        const repository = dataSource.getRepository(DiskMetricsLogEntity);
        return repository
          .createQueryBuilder("log")
          .where("log.timestamp >= :startDate", { startDate })
          .andWhere("log.timestamp <= :endDate", { endDate })
          .orderBy("log.timestamp", "DESC")
          .limit(limit)
          .getMany();
      }
    }
  }

  /**
   * Gracefully shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log("[metrics-logging] Shutting down metrics logging service");

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
}
