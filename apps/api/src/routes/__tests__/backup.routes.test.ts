import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  ListBucketsCommand,
  PutObjectCommand,
  GetObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
  waitFor,
} from '../../__tests__/test-helpers.js';
import type { BackupEngine } from '../../lib/backup-engine.js';
import type { QueryConfig } from '../../lib/db-query.js';
import { AppError } from '../../lib/errors.js';

/**
 * Backup lifecycle end to end. No mocks for our code: real Fastify + real
 * Prisma. Only the two external edges are injected — the dump engine (no
 * Docker/DB) and the S3 client (no MinIO) — exactly the seams the production
 * wiring fills with the real DockerBackupEngine + AWS S3 client.
 */

// Captured PutObject calls so we can assert the dump was uploaded correctly.
const putCalls: Array<{ Bucket?: string; Key?: string; bodyLen: number }> = [];
// In-memory object store so restore (GetObject) gets back what backup stored.
const objectStore = new Map<string, Buffer>();

function fakeS3(): S3Client {
  return {
    send: (command: unknown) => {
      if (command instanceof ListBucketsCommand) return Promise.resolve({ Buckets: [] });
      if (command instanceof PutObjectCommand) {
        const body = command.input.Body as Buffer | undefined;
        putCalls.push({
          ...(command.input.Bucket !== undefined ? { Bucket: command.input.Bucket } : {}),
          ...(command.input.Key !== undefined ? { Key: command.input.Key } : {}),
          bodyLen: body ? body.length : 0,
        });
        if (body) objectStore.set(`${command.input.Bucket}/${command.input.Key}`, Buffer.from(body));
        return Promise.resolve({});
      }
      if (command instanceof GetObjectCommand) {
        const bytes = objectStore.get(`${command.input.Bucket}/${command.input.Key}`);
        if (!bytes) {
          return Promise.reject(Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }));
        }
        return Promise.resolve({ Body: { transformToByteArray: async () => new Uint8Array(bytes) } });
      }
      return Promise.resolve({});
    },
  } as unknown as S3Client;
}

const engineState = {
  fail: false,
  lastConfig: null as QueryConfig | null,
  restoreFail: false,
  restoredWith: null as { config: QueryConfig; data: Buffer } | null,
  blockDump: null as Promise<void> | null,
};
const fakeEngine: BackupEngine = {
  async dump(config: QueryConfig) {
    engineState.lastConfig = config;
    if (engineState.blockDump) await engineState.blockDump;
    if (engineState.fail) throw new Error('pg_dump: connection refused');
    return { data: Buffer.from('-- SQL dump\nSELECT 1;\n'), filename: 'appdb.sql' };
  },
  async restore(config: QueryConfig, data: Buffer) {
    engineState.restoredWith = { config, data };
    // Mirror the real DockerBackupEngine, which wraps restore failures as a 502 AppError.
    if (engineState.restoreFail) {
      throw new AppError('backup.restore_failed', 'Restore failed (exit 1): psql: relation already exists', 502);
    }
  },
};

let env: TestEnv;
let operatorToken: string;
let viewerToken: string;

function auth(t: string) {
  return { authorization: `Bearer ${t}`, 'content-type': 'application/json' };
}
function bearer(t: string) {
  return { authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  env = await buildTestEnv({
    storageOptions: { buildS3Client: () => fakeS3() },
    databaseOptions: { tcpProbe: async () => {} },
    backupOptions: { engine: fakeEngine },
  });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  operatorToken = await createUserAndLogin(env, {
    email: 'op@example.com', password: 'OperatorPass1', name: 'Op', role: 'operator',
  });
  viewerToken = await createUserAndLogin(env, {
    email: 'viewer@example.com', password: 'ViewerPass1', name: 'Viewer', role: 'viewer',
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.prisma.backupJob.deleteMany();
  await env.prisma.databaseConnection.deleteMany();
  await env.prisma.s3Connection.deleteMany();
  putCalls.length = 0;
  objectStore.clear();
  engineState.fail = false;
  engineState.lastConfig = null;
  engineState.restoreFail = false;
  engineState.restoredWith = null;
  engineState.blockDump = null;
});

/** Run a backup to completion and return the finished job row. */
async function runBackupToSuccess(dbId: string, s3Id: string) {
  const res = await env.app.inject({
    method: 'POST', url: `/api/v1/databases/connections/${dbId}/backups`,
    headers: auth(operatorToken), payload: { s3ConnectionId: s3Id, bucket: 'db-backups' },
  });
  const jobId = res.json().id as string;
  return waitFor(async () => {
    const j = await env.prisma.backupJob.findUnique({ where: { id: jobId } });
    return j && (j.status === 'success' || j.status === 'failed') ? j : null;
  });
}

async function seed(): Promise<{ dbId: string; s3Id: string }> {
  const db = await env.app.inject({
    method: 'POST', url: '/api/v1/databases/connections', headers: auth(operatorToken),
    payload: { name: 'appdb', engine: 'postgres', host: 'app-postgres', username: 'postgres', password: 'dbpw', database: 'appdb' },
  });
  const s3 = await env.app.inject({
    method: 'POST', url: '/api/v1/storage/connections', headers: auth(operatorToken),
    payload: { name: 'minio', endpoint: 'http://minio:9000', accessKey: 'a', secretKey: 'b-secret' },
  });
  return { dbId: db.json().id as string, s3Id: s3.json().id as string };
}

describe('backup lifecycle', () => {
  it('runs a backup: dump → upload to S3 → job success', async () => {
    const { dbId, s3Id } = await seed();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: { s3ConnectionId: s3Id, bucket: 'db-backups' },
    });
    expect(res.statusCode).toBe(202);
    const job = res.json();
    expect(job.status).toBe('running');
    expect(job.connectionName).toBe('appdb');

    // Background work completes → job becomes success.
    const done = await waitFor(async () => {
      const j = await env.prisma.backupJob.findUnique({ where: { id: job.id } });
      return j && (j.status === 'success' || j.status === 'failed') ? j : null;
    });
    expect(done!.status).toBe('success');
    expect(done!.sizeBytes).toBe(Buffer.from('-- SQL dump\nSELECT 1;\n').length);
    expect(done!.objectKey).toMatch(/^backups\/appdb\/.+\.sql$/);

    // The dump was uploaded to the right bucket/key with the dump bytes.
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]!.Bucket).toBe('db-backups');
    expect(putCalls[0]!.Key).toBe(done!.objectKey);
    expect(putCalls[0]!.bodyLen).toBe(done!.sizeBytes);

    // The engine got the decrypted DB password (never the cipher).
    expect(engineState.lastConfig?.password).toBe('dbpw');
    expect(engineState.lastConfig?.engine).toBe('postgres');
  });

  it('marks the job failed (and uploads nothing) when the dump errors', async () => {
    const { dbId, s3Id } = await seed();
    engineState.fail = true;
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: { s3ConnectionId: s3Id, bucket: 'db-backups' },
    });
    expect(res.statusCode).toBe(202);
    const job = res.json();

    const done = await waitFor(async () => {
      const j = await env.prisma.backupJob.findUnique({ where: { id: job.id } });
      return j && (j.status === 'success' || j.status === 'failed') ? j : null;
    });
    expect(done!.status).toBe('failed');
    expect(done!.error).toContain('connection refused');
    expect(putCalls).toHaveLength(0);
  });

  it('404s when the S3 destination connection does not exist', async () => {
    const { dbId } = await seed();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: { s3ConnectionId: 'nope', bucket: 'db-backups' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('404s when the database connection does not exist', async () => {
    const { s3Id } = await seed();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/nope/backups`,
      headers: auth(operatorToken),
      payload: { s3ConnectionId: s3Id, bucket: 'db-backups' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a second manual backup while one is in flight (409)', async () => {
    const { dbId, s3Id } = await seed();
    // Block the first dump so its job stays `running`.
    let release!: () => void;
    engineState.blockDump = new Promise<void>((r) => {
      release = r;
    });
    const first = await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken), payload: { s3ConnectionId: s3Id, bucket: 'b' },
    });
    expect(first.statusCode).toBe(202);
    // Second manual trigger while the first is still running → 409.
    const second = await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken), payload: { s3ConnectionId: s3Id, bucket: 'b' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('backup.in_progress');
    // Let the first finish.
    release();
    await waitFor(async () => {
      const j = await env.prisma.backupJob.findUnique({ where: { id: first.json().id } });
      return j && j.status === 'success' ? j : null;
    });
  });
});

describe('backup destination fallback (default connection)', () => {
  it('falls back to the default storage connection + its defaultBucket when none given', async () => {
    const { dbId, s3Id } = await seed();
    // Make the connection the default and give it a default bucket.
    await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/storage/connections/${s3Id}`,
      headers: auth(operatorToken),
      payload: { defaultBucket: 'default-backups' },
    });
    await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${s3Id}/default`,
      headers: bearer(operatorToken),
    });

    // Trigger a backup with NO s3ConnectionId/bucket.
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    const done = await waitFor(async () => {
      const j = await env.prisma.backupJob.findUnique({ where: { id: res.json().id } });
      return j && (j.status === 'success' || j.status === 'failed') ? j : null;
    });
    expect(done!.status).toBe('success');
    expect(done!.s3ConnectionId).toBe(s3Id);
    expect(done!.bucket).toBe('default-backups');
    expect(putCalls.at(-1)!.Bucket).toBe('default-backups');
  });

  it('400 backup.no_destination when no s3ConnectionId and no default set', async () => {
    const { dbId } = await seed();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('backup.no_destination');
  });

  it('400 backup.no_bucket when the default connection has no defaultBucket and no bucket given', async () => {
    const { dbId, s3Id } = await seed();
    await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${s3Id}/default`,
      headers: bearer(operatorToken),
    });
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('backup.no_bucket');
  });
});

describe('restore', () => {
  it('restores a successful backup: downloads from S3, feeds the engine', async () => {
    const { dbId, s3Id } = await seed();
    const job = await runBackupToSuccess(dbId, s3Id);
    expect(job!.status).toBe('success');

    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/backups/${job!.id}/restore`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().restoredTo).toBe('appdb');
    // The engine got the exact bytes that were backed up, plus the decrypted pw.
    expect(engineState.restoredWith?.data.toString()).toBe('-- SQL dump\nSELECT 1;\n');
    expect(engineState.restoredWith?.config.password).toBe('dbpw');
  });

  it('surfaces a restore failure as 502', async () => {
    const { dbId, s3Id } = await seed();
    const job = await runBackupToSuccess(dbId, s3Id);
    engineState.restoreFail = true;
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/backups/${job!.id}/restore`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.message).toContain('already exists');
  });

  it('refuses to restore a failed backup (400)', async () => {
    const { dbId, s3Id } = await seed();
    engineState.fail = true;
    const job = await runBackupToSuccess(dbId, s3Id);
    expect(job!.status).toBe('failed');
    engineState.fail = false;
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/backups/${job!.id}/restore`,
      headers: auth(operatorToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an engine mismatch between backup and target (400)', async () => {
    const { dbId, s3Id } = await seed();
    const job = await runBackupToSuccess(dbId, s3Id);
    // Create a mysql target and try to restore a postgres dump into it.
    const my = await env.app.inject({
      method: 'POST', url: '/api/v1/databases/connections', headers: auth(operatorToken),
      payload: { name: 'mysql-target', engine: 'mysql', host: 'app-mysql', username: 'root', password: 'x' },
    });
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/backups/${job!.id}/restore`,
      headers: auth(operatorToken),
      payload: { targetConnectionId: my.json().id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('backup.engine_mismatch');
  });

  it('viewer CANNOT restore (403)', async () => {
    const { dbId, s3Id } = await seed();
    const job = await runBackupToSuccess(dbId, s3Id);
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/backups/${job!.id}/restore`,
      headers: auth(viewerToken),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('scheduled backups', () => {
  it('enabling a schedule registers a cron task; disabling removes it', async () => {
    const { dbId, s3Id } = await seed();
    const enable = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true, cron: '0 3 * * *', s3ConnectionId: s3Id, bucket: 'nightly' },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().enabled).toBe(true);
    expect(env.cron.tasks.has(dbId)).toBe(true);

    const disable = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: false },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json().enabled).toBe(false);
    expect(env.cron.tasks.has(dbId)).toBe(false);
  });

  it('enabling without cron/dest is rejected (400)', async () => {
    const { dbId } = await seed();
    const res = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects enabling a schedule against a non-existent S3 connection (400)', async () => {
    const { dbId } = await seed();
    const res = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true, cron: '0 3 * * *', s3ConnectionId: 'ghost', bucket: 'b' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('database.s3_not_found');
  });

  it('rejects an invalid cron expression (400)', async () => {
    const { dbId, s3Id } = await seed();
    const res = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true, cron: 'not-a-cron', s3ConnectionId: s3Id, bucket: 'b' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('firing the cron runs a scheduled backup', async () => {
    const { dbId, s3Id } = await seed();
    await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true, cron: '0 3 * * *', s3ConnectionId: s3Id, bucket: 'nightly' },
    });
    // Simulate the cron firing.
    env.cron.fire(dbId);
    const job = await waitFor(async () => {
      const j = await env.prisma.backupJob.findFirst({
        where: { connectionId: dbId, trigger: 'scheduled' },
      });
      return j && (j.status === 'success' || j.status === 'failed') ? j : null;
    });
    expect(job!.status).toBe('success');
    expect(job!.trigger).toBe('scheduled');
    expect(job!.bucket).toBe('nightly');
  });

  it('deleting a scheduled connection removes its cron task (no zombie)', async () => {
    const { dbId, s3Id } = await seed();
    await env.app.inject({
      method: 'PUT',
      url: `/api/v1/databases/connections/${dbId}/schedule`,
      headers: auth(operatorToken),
      payload: { enabled: true, cron: '0 3 * * *', s3ConnectionId: s3Id, bucket: 'nightly' },
    });
    expect(env.cron.tasks.has(dbId)).toBe(true);
    const del = await env.app.inject({
      method: 'DELETE', url: `/api/v1/databases/connections/${dbId}`, headers: bearer(operatorToken),
    });
    expect(del.statusCode).toBe(204);
    expect(env.cron.tasks.has(dbId)).toBe(false);
  });

  it('viewer can read but not set the schedule', async () => {
    const { dbId, s3Id } = await seed();
    const read = await env.app.inject({
      method: 'GET', url: `/api/v1/databases/connections/${dbId}/schedule`, headers: bearer(viewerToken),
    });
    expect(read.statusCode).toBe(200);
    const write = await env.app.inject({
      method: 'PUT', url: `/api/v1/databases/connections/${dbId}/schedule`, headers: auth(viewerToken),
      payload: { enabled: true, cron: '0 3 * * *', s3ConnectionId: s3Id, bucket: 'b' },
    });
    expect(write.statusCode).toBe(403);
  });
});

describe('history + RBAC', () => {
  it('lists backup jobs for a connection and globally', async () => {
    const { dbId, s3Id } = await seed();
    await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(operatorToken), payload: { s3ConnectionId: s3Id, bucket: 'b' },
    });
    await waitFor(async () => (await env.prisma.backupJob.count()) >= 1);

    const perConn = await env.app.inject({
      method: 'GET', url: `/api/v1/databases/connections/${dbId}/backups`, headers: bearer(viewerToken),
    });
    expect(perConn.statusCode).toBe(200);
    expect((perConn.json() as unknown[]).length).toBe(1);

    const all = await env.app.inject({ method: 'GET', url: '/api/v1/databases/backups', headers: bearer(viewerToken) });
    expect(all.statusCode).toBe(200);
    expect((all.json() as unknown[]).length).toBe(1);
  });

  it('viewer CANNOT trigger a backup (403)', async () => {
    const { dbId, s3Id } = await seed();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/databases/connections/${dbId}/backups`,
      headers: auth(viewerToken),
      payload: { s3ConnectionId: s3Id, bucket: 'b' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/databases/backups' });
    expect(res.statusCode).toBe(401);
  });
});
