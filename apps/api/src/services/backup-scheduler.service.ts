import type { PrismaClient } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import type { BackupService } from './backup.service.js';

/**
 * Cron seam so the scheduler is testable without real timers. The production
 * implementation wraps node-cron; tests inject a fake that records what was
 * scheduled and can fire tasks on demand.
 */
export interface CronScheduler {
  /** (Re)register a task under `id`, replacing any existing one. */
  schedule(id: string, cronExpr: string, task: () => void): void;
  /** Remove a task. */
  unschedule(id: string): void;
  /** Validate a cron expression. */
  validate(cronExpr: string): boolean;
}

/** node-cron-backed scheduler. */
export class NodeCronScheduler implements CronScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();

  schedule(id: string, cronExpr: string, task: () => void): void {
    this.unschedule(id);
    this.tasks.set(id, cron.schedule(cronExpr, task));
  }

  unschedule(id: string): void {
    const existing = this.tasks.get(id);
    if (existing) {
      existing.stop();
      this.tasks.delete(id);
    }
  }

  validate(cronExpr: string): boolean {
    return cron.validate(cronExpr);
  }
}

/**
 * Keeps cron registrations in sync with the per-connection backup schedule
 * stored on DatabaseConnection. A registered task fires a `scheduled` backup.
 */
export class BackupSchedulerService {
  /** Optional structured error sink for failures inside fired cron tasks. */
  private errorLogger?: (ctx: Record<string, unknown>, msg: string) => void;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly backups: BackupService,
    private readonly cron: CronScheduler,
  ) {}

  /** Wire a logger (set after the app/logger exists) so fired-task failures
   *  are observable rather than silently swallowed. */
  setErrorLogger(fn: (ctx: Record<string, unknown>, msg: string) => void): void {
    this.errorLogger = fn;
  }

  /** True when the cron expression is valid (used by the route before saving). */
  isValidCron(expr: string): boolean {
    return this.cron.validate(expr);
  }

  /** Register all currently-enabled schedules. Call once at boot. One bad
   *  schedule must not prevent the others from registering. */
  async start(): Promise<void> {
    const conns = await this.prisma.databaseConnection.findMany({
      where: { backupEnabled: true },
    });
    for (const conn of conns) {
      try {
        this.register(conn);
      } catch (err) {
        this.errorLogger?.({ connectionId: conn.id, err: String(err) }, 'failed to register schedule');
      }
    }
  }

  /** Re-sync a single connection's schedule after its config changed. */
  async sync(connectionId: string): Promise<void> {
    const conn = await this.prisma.databaseConnection.findUnique({ where: { id: connectionId } });
    if (!conn) {
      this.cron.unschedule(connectionId);
      return;
    }
    this.register(conn);
  }

  private register(conn: {
    id: string;
    backupEnabled: boolean;
    backupCron: string | null;
    backupS3ConnectionId: string | null;
    backupBucket: string | null;
  }): void {
    const ready =
      conn.backupEnabled &&
      conn.backupCron &&
      this.cron.validate(conn.backupCron) &&
      conn.backupS3ConnectionId &&
      conn.backupBucket;
    if (!ready) {
      this.cron.unschedule(conn.id);
      return;
    }
    const s3ConnectionId = conn.backupS3ConnectionId as string;
    const bucket = conn.backupBucket as string;
    this.cron.schedule(conn.id, conn.backupCron as string, () => {
      void this.backups
        .startBackup({ connectionId: conn.id, s3ConnectionId, bucket, trigger: 'scheduled' })
        .catch((err: unknown) => {
          // Never let a scheduled failure (e.g. the S3 destination was
          // deleted) crash the process — record it so operators can see it.
          this.errorLogger?.(
            { connectionId: conn.id, s3ConnectionId, bucket, err: String(err) },
            'scheduled backup failed',
          );
        });
    });
  }
}
