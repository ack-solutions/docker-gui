import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  DeleteBucketPolicyCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

// -------------------- Fake S3 backend --------------------

interface FakeObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

interface FakeBucketState {
  buckets: Map<string, { CreationDate: Date }>;
  objects: Map<string /* bucket */, Map<string /* key */, FakeObject>>;
  policies: Map<string, string>;
  /** When set, the next `ListBuckets` call rejects with this error name. */
  failVerifyWith: string | null;
}

const state: FakeBucketState = {
  buckets: new Map(),
  objects: new Map(),
  policies: new Map(),
  failVerifyWith: null,
};

function s3Err(name: string, httpStatusCode: number, message?: string): Error {
  const err = new Error(message ?? name);
  Object.assign(err, { name, $metadata: { httpStatusCode } });
  return err;
}

function buildFakeClient(): S3Client {
  return {
    send: vi.fn(async (command: unknown) => {
      if (command instanceof ListBucketsCommand) {
        if (state.failVerifyWith) {
          throw s3Err(state.failVerifyWith, 403);
        }
        return {
          Buckets: Array.from(state.buckets.entries()).map(([Name, v]) => ({
            Name,
            CreationDate: v.CreationDate,
          })),
        };
      }
      if (command instanceof CreateBucketCommand) {
        const name = command.input.Bucket!;
        if (state.buckets.has(name)) {
          throw s3Err('BucketAlreadyOwnedByYou', 409);
        }
        state.buckets.set(name, { CreationDate: new Date() });
        state.objects.set(name, new Map());
        return {};
      }
      if (command instanceof DeleteBucketCommand) {
        const name = command.input.Bucket!;
        if (!state.buckets.has(name)) {
          throw s3Err('NoSuchBucket', 404);
        }
        const objs = state.objects.get(name);
        if (objs && objs.size > 0) {
          throw s3Err('BucketNotEmpty', 409);
        }
        state.buckets.delete(name);
        state.objects.delete(name);
        state.policies.delete(name);
        return {};
      }
      if (command instanceof HeadBucketCommand) {
        const name = command.input.Bucket!;
        if (!state.buckets.has(name)) throw s3Err('NoSuchBucket', 404);
        return {};
      }
      if (command instanceof ListObjectsV2Command) {
        const bucket = command.input.Bucket!;
        if (!state.buckets.has(bucket)) throw s3Err('NoSuchBucket', 404);
        const all = Array.from(state.objects.get(bucket)?.values() ?? []);
        const prefix = command.input.Prefix ?? '';
        const filtered = all.filter((o) => o.key.startsWith(prefix));
        return {
          Contents: filtered.map((o) => ({
            Key: o.key,
            Size: o.size,
            LastModified: o.lastModified,
            ETag: o.etag,
            StorageClass: 'STANDARD',
          })),
          KeyCount: filtered.length,
          IsTruncated: false,
          CommonPrefixes: [],
        };
      }
      if (command instanceof DeleteObjectCommand) {
        const bucket = command.input.Bucket!;
        const key = command.input.Key!;
        state.objects.get(bucket)?.delete(key);
        return {};
      }
      if (command instanceof GetBucketPolicyCommand) {
        const policy = state.policies.get(command.input.Bucket!);
        if (!policy) throw s3Err('NoSuchBucketPolicy', 404);
        return { Policy: policy };
      }
      if (command instanceof PutBucketPolicyCommand) {
        state.policies.set(command.input.Bucket!, command.input.Policy!);
        return {};
      }
      if (command instanceof DeleteBucketPolicyCommand) {
        state.policies.delete(command.input.Bucket!);
        return {};
      }
      throw new Error(`unhandled command: ${command?.constructor?.name}`);
    }),
  } as unknown as S3Client;
}

// -------------------- Test wiring --------------------

let env: TestEnv;

beforeAll(async () => {
  env = await buildTestEnv({
    storageOptions: {
      buildS3Client: () => buildFakeClient(),
      presigner: async (_client, command, opts) => {
        if (command instanceof GetObjectCommand) {
          return `https://example.com/get/${command.input.Bucket}/${command.input.Key}?X-Amz-Expires=${opts.expiresIn}`;
        }
        if (command instanceof PutObjectCommand) {
          return `https://example.com/put/${command.input.Bucket}/${command.input.Key}?X-Amz-Expires=${opts.expiresIn}`;
        }
        return 'https://example.com/unknown';
      },
    },
  });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1', name: 'Admin' },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  state.buckets.clear();
  state.objects.clear();
  state.policies.clear();
  state.failVerifyWith = null;
  await env.prisma.s3Connection.deleteMany();
});

async function token(): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1' },
  });
  return res.json().data.accessToken as string;
}

async function createConnection(extra: Record<string, unknown> = {}): Promise<string> {
  const t = await token();
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/storage/connections',
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    payload: {
      name: 'minio-local',
      endpoint: 'http://minio:9000',
      accessKey: 'minioadmin',
      secretKey: 'minioadmin-secret',
      ...extra,
    },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body).id as string;
}

// -------------------- Tests --------------------

describe('Storage — connections', () => {
  it('requires auth on every endpoint', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/storage/connections' });
    expect(res.statusCode).toBe(401);
  });

  it('creates a connection with masked access key, encrypted secret, and verified=true on a working endpoint', async () => {
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: {
        name: 'minio',
        endpoint: 'http://minio:9000',
        accessKey: 'AKIAEXAMPLEKEY12345',
        secretKey: 'top-secret-value',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      name: 'minio',
      endpoint: 'http://minio:9000',
      accessKeyMask: 'AKIA••••••2345',
      verified: true,
    });
    expect(body).not.toHaveProperty('secretKey');
    expect(body).not.toHaveProperty('secretKeyCipher');

    // Persisted with encrypted secret
    const row = await env.prisma.s3Connection.findUnique({ where: { id: body.id } });
    expect(row?.secretKeyCipher).not.toBe('top-secret-value');
    expect(row?.secretKeyCipher.length).toBeGreaterThan(20);
  });

  it('records lastError when verify fails on create — but still creates the connection', async () => {
    state.failVerifyWith = 'InvalidAccessKeyId';
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(false);
    expect(body.lastError).toContain('credentials');
  });

  it('rejects duplicate names with 409', async () => {
    await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: {
        name: 'minio-local',
        endpoint: 'http://minio:9000',
        accessKey: 'k',
        secretKey: 's',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe('storage.duplicate_name');
  });

  it('PATCH invalidates verified when credentials change', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { secretKey: 'new-secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(false);
  });

  it('verify endpoint succeeds on a healthy backend', async () => {
    const id = await createConnection();
    state.failVerifyWith = null;
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${id}/verify`,
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(true);
    expect(body.lastError).toBeNull();
  });

  it('verify endpoint records lastError on bad creds', async () => {
    const id = await createConnection();
    state.failVerifyWith = 'AccessDenied';
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${id}/verify`,
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(false);
    expect(body.lastError).toContain('access_denied');
  });

  it('DELETE removes the connection', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(204);
    expect(await env.prisma.s3Connection.count()).toBe(0);
  });
});

describe('Storage — default connection', () => {
  async function createNamed(name: string, extra: Record<string, unknown> = {}): Promise<string> {
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: {
        name,
        endpoint: 'http://minio:9000',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin-secret',
        ...extra,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body).id as string;
  }

  it('new connections are not default and carry a null defaultBucket', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    const body = JSON.parse(res.body);
    expect(body.isDefault).toBe(false);
    expect(body.defaultBucket).toBeNull();
  });

  it('set-default marks one connection default and flips any previous default off', async () => {
    const a = await createNamed('conn-a');
    const b = await createNamed('conn-b');
    const t = await token();

    const setA = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${a}/default`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(setA.statusCode).toBe(200);
    expect(JSON.parse(setA.body).isDefault).toBe(true);

    // Switching the default to B must clear A.
    const setB = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${b}/default`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(setB.statusCode).toBe(200);

    const list = await env.app.inject({
      method: 'GET',
      url: '/api/v1/storage/connections',
      headers: { authorization: `Bearer ${t}` },
    });
    const defaults = JSON.parse(list.body).filter((c: { isDefault: boolean }) => c.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b);
  });

  it('set-default on an unknown id returns 404', async () => {
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections/does-not-exist/default',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('create + PATCH round-trip defaultBucket', async () => {
    const id = await createNamed('with-bucket', { defaultBucket: 'backups-bucket' });
    const t = await token();
    const got = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(JSON.parse(got.body).defaultBucket).toBe('backups-bucket');

    const patched = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/storage/connections/${id}`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { defaultBucket: 'other-bucket' },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).defaultBucket).toBe('other-bucket');
  });

  it('rejects an invalid defaultBucket name with 400', async () => {
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: {
        name: 'bad-bucket-conn',
        endpoint: 'http://minio:9000',
        accessKey: 'k',
        secretKey: 's',
        defaultBucket: 'BAD_NAME',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('set-default requires operator+ (viewer gets 403)', async () => {
    const id = await createConnection();
    const viewerToken = await createUserAndLogin(env, {
      email: 'viewer-storage@example.com',
      password: 'StrongPass1',
      name: 'Viewer',
      role: 'viewer',
    });
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/connections/${id}/default`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Storage — buckets', () => {
  it('lists buckets from the connected endpoint', async () => {
    state.buckets.set('alpha', { CreationDate: new Date('2026-01-01') });
    state.buckets.set('beta', { CreationDate: new Date('2026-02-01') });
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/${id}/buckets`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.map((b: { name: string }) => b.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('creates a bucket via POST', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/${id}/buckets`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { name: 'my-bucket' },
    });
    expect(res.statusCode).toBe(201);
    expect(state.buckets.has('my-bucket')).toBe(true);
  });

  it('rejects invalid bucket names with 400 (zod schema)', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/${id}/buckets`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { name: 'BAD_NAME' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when the bucket already exists', async () => {
    state.buckets.set('taken', { CreationDate: new Date() });
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/${id}/buckets`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { name: 'taken' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe('s3.bucket_exists');
  });

  it('DELETE removes an empty bucket', async () => {
    state.buckets.set('empty', { CreationDate: new Date() });
    state.objects.set('empty', new Map());
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/${id}/buckets/empty`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(204);
    expect(state.buckets.has('empty')).toBe(false);
  });

  it('DELETE returns 409 when bucket not empty', async () => {
    state.buckets.set('full', { CreationDate: new Date() });
    state.objects.set(
      'full',
      new Map([['k', { key: 'k', size: 1, lastModified: new Date(), etag: 'e' }]]),
    );
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/${id}/buckets/full`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe('s3.bucket_not_empty');
  });
});

describe('Storage — objects', () => {
  beforeEach(() => {
    state.buckets.set('files', { CreationDate: new Date() });
    state.objects.set(
      'files',
      new Map([
        ['readme.md', { key: 'readme.md', size: 100, lastModified: new Date(), etag: 'e1' }],
        [
          'images/cat.jpg',
          { key: 'images/cat.jpg', size: 5000, lastModified: new Date(), etag: 'e2' },
        ],
      ]),
    );
  });

  it('lists objects with prefix filter', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/${id}/buckets/files/objects?prefix=images/&delimiter=`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.objects).toHaveLength(1);
    expect(body.objects[0].key).toBe('images/cat.jpg');
  });

  it('returns a presigned download URL', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/${id}/buckets/files/objects/download-url?key=readme.md`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.method).toBe('GET');
    expect(body.url).toContain('readme.md');
    expect(body.expiresIn).toBeGreaterThan(0);
  });

  it('returns a presigned upload URL with the requested content type', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/storage/${id}/buckets/files/objects/upload-url`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { key: 'new.txt', contentType: 'text/plain' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.method).toBe('PUT');
    expect(body.url).toContain('new.txt');
  });

  it('deletes an object', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/${id}/buckets/files/objects?key=readme.md`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(204);
    expect(state.objects.get('files')?.has('readme.md')).toBe(false);
  });
});

describe('Storage — bucket policy', () => {
  beforeEach(() => {
    state.buckets.set('app-uploads', { CreationDate: new Date() });
    state.objects.set('app-uploads', new Map());
  });

  it('returns policy: null when none is set', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/${id}/buckets/app-uploads/policy`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ policy: null });
  });

  it('PUT stores a JSON policy and GET returns it back', async () => {
    const id = await createConnection();
    const t = await token();
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: 'arn:aws:s3:::app-uploads/public/*',
        },
      ],
    });
    const put = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/storage/${id}/buckets/app-uploads/policy`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { policy },
    });
    expect(put.statusCode).toBe(204);
    const get = await env.app.inject({
      method: 'GET',
      url: `/api/v1/storage/${id}/buckets/app-uploads/policy`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(JSON.parse(get.body).policy).toBe(policy);
  });

  it('rejects invalid JSON policy with 400', async () => {
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'PUT',
      url: `/api/v1/storage/${id}/buckets/app-uploads/policy`,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      payload: { policy: 'not json {' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('storage.invalid_json');
  });

  it('DELETE removes the policy', async () => {
    state.policies.set('app-uploads', '{"Version":"2012-10-17"}');
    const id = await createConnection();
    const t = await token();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/${id}/buckets/app-uploads/policy`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(204);
    expect(state.policies.has('app-uploads')).toBe(false);
  });
});
