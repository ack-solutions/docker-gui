import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ListBucketsCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
  waitFor,
} from '../../__tests__/test-helpers.js';
import type { BackupEngine } from '../../lib/backup-engine.js';
import type { QueryConfig } from '../../lib/db-query.js';

/**
 * Backup lifecycle end to end. No mocks for our code: real Fastify + real
 * Prisma. Only the two external edges are injected — the dump engine (no
 * Docker/DB) and the S3 client (no MinIO) — exactly the seams the production
 * wiring fills with the real DockerBackupEngine + AWS S3 client.
 */

// Captured PutObject calls so we can assert the dump was uploaded correctly.
const putCalls: Array<{ Bucket?: string; Key?: string; bodyLen: number }> = [];

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
        return Promise.resolve({});
      }
      return Promise.resolve({});
    },
  } as unknown as S3Client;
}

const engineState = { fail: false, lastConfig: null as QueryConfig | null };
const fakeEngine: BackupEngine = {
  async dump(config: QueryConfig) {
    engineState.lastConfig = config;
    if (engineState.fail) throw new Error('pg_dump: connection refused');
    return { data: Buffer.from('-- SQL dump\nSELECT 1;\n'), filename: 'appdb.sql' };
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
  engineState.fail = false;
  engineState.lastConfig = null;
});

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
