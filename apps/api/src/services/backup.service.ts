import type { PrismaClient } from '@prisma/client';
import { CryptoBox } from '../lib/crypto-box.js';
import type { BackupEngine } from '../lib/backup-engine.js';
import type { QueryConfig } from '../lib/db-query.js';
import type { StorageService } from './storage.service.js';
import type { DbEngine } from './database.service.js';
import { AppError, NotFoundError } from '../lib/errors.js';

export interface BackupJobSummary {
  id: string;
  connectionId: string;
  connectionName: string;
  engine: DbEngine;
  status: 'pending' | 'running' | 'success' | 'failed';
  trigger: 'manual' | 'scheduled';
  s3ConnectionId: string;
  bucket: string;
  objectKey: string;
  sizeBytes: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface StartBackupInput {
  connectionId: string;
  /** Omit to fall back to the default storage connection. */
  s3ConnectionId?: string;
  /** Omit to fall back to the (default) connection's defaultBucket. */
  bucket?: string;
  trigger?: 'manual' | 'scheduled';
}

export interface BackupServiceOptions {
  /** Inject a fake dumper in tests (no Docker/DB). */
  engine?: BackupEngine;
  /** Override the async runner so tests can await completion deterministically. */
  runInBackground?: (fn: () => Promise<void>) => void;
}

export class BackupService {
  private readonly engine: BackupEngine | undefined;
  private readonly schedule: (fn: () => Promise<void>) => void;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cryptoBox: CryptoBox,
    private readonly storage: StorageService,
    options: BackupServiceOptions = {},
  ) {
    this.engine = options.engine;
    // Default: fire-and-forget on the next tick. Tests can pass a runner that
    // tracks the promise so they can await it.
    this.schedule = options.runInBackground ?? ((fn) => void fn().catch(() => undefined));
  }

  /**
   * Kick off a backup. Creates the job row, returns it immediately as
   * `running`, and performs the dump + upload in the background. The UI polls
   * the job list for the terminal status.
   */
  async startBackup(input: StartBackupInput): Promise<BackupJobSummary> {
    if (!this.engine) {
      throw new AppError('backup.not_available', 'Backup engine is not configured', 503);
    }
    const conn = await this.prisma.databaseConnection.findUnique({ where: { id: input.connectionId } });
    if (!conn) throw new NotFoundError('Database connection not found');
    // Don't pile up concurrent backups of the same connection. A scheduled
    // fire that overlaps an in-flight run is skipped (returns the running job);
    // a manual trigger is rejected so the operator knows.
    const running = await this.prisma.backupJob.findFirst({
      where: { connectionId: conn.id, status: 'running' },
    });
    if (running) {
      if (input.trigger === 'scheduled') return this.toSummary(running);
      throw new AppError('backup.in_progress', 'A backup for this connection is already running', 409);
    }
    // Resolve the S3 destination, falling back to the default connection /
    // its default bucket when the caller didn't specify one.
    let s3ConnectionId = input.s3ConnectionId;
    let bucket = input.bucket;
    if (!s3ConnectionId) {
      const def = await this.storage.getDefaultConnection();
      if (!def) {
        throw new AppError(
          'backup.no_destination',
          'No S3 destination specified and no default storage connection is set',
          400,
        );
      }
      s3ConnectionId = def.id;
      if (!bucket && def.defaultBucket) bucket = def.defaultBucket;
    }
    if (!bucket) {
      throw new AppError(
        'backup.no_bucket',
        'No bucket specified and the storage connection has no default bucket',
        400,
      );
    }
    // Validate the (resolved) S3 destination exists up front for a clean error.
    await this.storage.getConnection(s3ConnectionId);

    const objectKeyBase = `backups/${slug(conn.name)}`;
    const job = await this.prisma.backupJob.create({
      data: {
        connectionId: conn.id,
        connectionName: conn.name,
        engine: conn.engine,
        status: 'running',
        trigger: input.trigger ?? 'manual',
        s3ConnectionId,
        bucket,
        objectKey: '', // filled below once we know the id
        startedAt: new Date(),
      },
    });
    const objectKey = `${objectKeyBase}/${job.id}.sql`;
    await this.prisma.backupJob.update({ where: { id: job.id }, data: { objectKey } });

    const config: QueryConfig = {
      engine: conn.engine as DbEngine,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      ...(conn.passwordCipher ? { password: this.cryptoBox.open(conn.passwordCipher) } : {}),
      ...(conn.database ? { database: conn.database } : {}),
      ssl: conn.ssl,
    };

    this.schedule(() => this.runBackup(job.id, config, s3ConnectionId, bucket, objectKey));

    const fresh = await this.prisma.backupJob.findUnique({ where: { id: job.id } });
    return this.toSummary(fresh!);
  }

  /** Background worker — never throws to the caller; records status on the job. */
  private async runBackup(
    jobId: string,
    config: QueryConfig,
    s3ConnectionId: string,
    bucket: string,
    objectKey: string,
  ): Promise<void> {
    try {
      const { data } = await this.engine!.dump(config);
      await this.storage.putObject(s3ConnectionId, bucket, objectKey, data, {
        contentType: 'application/sql',
      });
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: { status: 'success', sizeBytes: data.length, finishedAt: new Date(), error: null },
      });
    } catch (err) {
      const message = err instanceof AppError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : 'Backup failed';
      await this.prisma.backupJob
        .update({ where: { id: jobId }, data: { status: 'failed', finishedAt: new Date(), error: message.slice(0, 2000) } })
        .catch(() => undefined);
    }
  }

  /**
   * Restore a successful backup into a target connection (defaults to the one
   * it came from). Runs synchronously — the caller waits for the result.
   * DESTRUCTIVE: this applies the dump onto the target database.
   */
  async restoreBackup(
    jobId: string,
    targetConnectionId?: string,
  ): Promise<{ ok: true; restoredTo: string }> {
    if (!this.engine) {
      throw new AppError('backup.not_available', 'Backup engine is not configured', 503);
    }
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError('Backup job not found');
    if (job.status !== 'success') {
      throw new AppError('backup.not_restorable', 'Only a successful backup can be restored', 400);
    }
    const targetId = targetConnectionId ?? job.connectionId;
    const target = await this.prisma.databaseConnection.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundError('Target database connection not found');
    if (target.engine !== job.engine) {
      throw new AppError(
        'backup.engine_mismatch',
        `Backup engine (${job.engine}) does not match the target (${target.engine})`,
        400,
      );
    }

    const data = await this.storage.getObjectBytes(job.s3ConnectionId, job.bucket, job.objectKey);
    const config: QueryConfig = {
      engine: target.engine as DbEngine,
      host: target.host,
      port: target.port,
      username: target.username,
      ...(target.passwordCipher ? { password: this.cryptoBox.open(target.passwordCipher) } : {}),
      ...(target.database ? { database: target.database } : {}),
      ssl: target.ssl,
    };
    await this.engine.restore(config, data);
    return { ok: true, restoredTo: target.name };
  }

  async listJobs(connectionId?: string): Promise<BackupJobSummary[]> {
    const rows = await this.prisma.backupJob.findMany({
      ...(connectionId ? { where: { connectionId } } : {}),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toSummary(r));
  }

  async getJob(id: string): Promise<BackupJobSummary> {
    const row = await this.prisma.backupJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Backup job not found');
    return this.toSummary(row);
  }

  private toSummary(row: {
    id: string;
    connectionId: string;
    connectionName: string;
    engine: string;
    status: string;
    trigger: string;
    s3ConnectionId: string;
    bucket: string;
    objectKey: string;
    sizeBytes: number | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    error: string | null;
    createdAt: Date;
  }): BackupJobSummary {
    return {
      id: row.id,
      connectionId: row.connectionId,
      connectionName: row.connectionName,
      engine: row.engine as DbEngine,
      status: row.status as BackupJobSummary['status'],
      trigger: row.trigger as BackupJobSummary['trigger'],
      s3ConnectionId: row.s3ConnectionId,
      bucket: row.bucket,
      objectKey: row.objectKey,
      sizeBytes: row.sizeBytes,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

/** Filesystem/S3-safe slug for the object key prefix. */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'db';
}
