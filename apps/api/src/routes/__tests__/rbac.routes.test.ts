import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

/**
 * Verify always fails fast (no real network). createConnection swallows the
 * failure and still persists the row with verified:false, so 201 is returned
 * — which is all the RBAC assertions care about.
 */
function failingS3Client(): S3Client {
  return {
    send: () => Promise.reject(Object.assign(new Error('unreachable'), { name: 'ECONNREFUSED' })),
  } as unknown as S3Client;
}

/**
 * RBAC enforcement, end to end through the real Fastify app + real SQLite.
 * No mocks: real argon2 password hashing, real JWT issuance, real route guards.
 *
 * Role model:
 *   owner / admin    → everything
 *   operator         → resource writes (storage, sites, docker) but NOT
 *                      infra-level feature enable/disable
 *   viewer           → reads only
 */
let env: TestEnv;

// Tokens per role, minted once.
let ownerToken: string;
let operatorToken: string;
let viewerToken: string;

beforeAll(async () => {
  env = await buildTestEnv({
    storageOptions: { buildS3Client: () => failingS3Client() },
  });
  // Bootstrap creates the first OWNER.
  const boot = await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  expect(boot.statusCode).toBe(201);
  const login = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1' },
  });
  ownerToken = login.json().data.accessToken as string;

  operatorToken = await createUserAndLogin(env, {
    email: 'operator@example.com',
    password: 'OperatorPass1',
    name: 'Operator',
    role: 'operator',
  });
  viewerToken = await createUserAndLogin(env, {
    email: 'viewer@example.com',
    password: 'ViewerPass1',
    name: 'Viewer',
    role: 'viewer',
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.prisma.s3Connection.deleteMany();
});

/** Headers for a request WITH a JSON body. */
function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

/**
 * Headers for a BODILESS request (GET/DELETE/verb-POST). We deliberately omit
 * content-type: setting `application/json` with no body makes Fastify reject
 * with 400 during body parsing — which happens BEFORE the role preHandler, so
 * it would mask the 401/403 we are asserting. Real clients sending an empty
 * body also must not set that header.
 */
function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

const connectionPayload = {
  name: 'minio-rbac',
  endpoint: 'http://minio:9000',
  accessKey: 'minioadmin',
  secretKey: 'minioadmin-secret',
};

describe('storage RBAC', () => {
  it('viewer can READ connections (200) but cannot CREATE (403)', async () => {
    const read = await env.app.inject({
      method: 'GET',
      url: '/api/v1/storage/connections',
      headers: auth(viewerToken),
    });
    expect(read.statusCode).toBe(200);

    const create = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(viewerToken),
      payload: connectionPayload,
    });
    expect(create.statusCode).toBe(403);
    expect(create.json().error.code).toBe('auth.forbidden');
  });

  it('operator CAN create a connection (201)', async () => {
    const create = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(operatorToken),
      payload: connectionPayload,
    });
    expect(create.statusCode).toBe(201);
  });

  it('owner can create + delete a connection', async () => {
    const create = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: { ...connectionPayload, name: 'owner-conn' },
    });
    expect(create.statusCode).toBe(201);
    const id = JSON.parse(create.body).id as string;

    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/connections/${id}`,
      headers: bearer(ownerToken),
    });
    expect(del.statusCode).toBe(204);
  });

  it('viewer cannot delete a connection an operator made (403)', async () => {
    const create = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(operatorToken),
      payload: { ...connectionPayload, name: 'to-protect' },
    });
    expect(create.statusCode).toBe(201);
    const id = JSON.parse(create.body).id as string;

    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/storage/connections/${id}`,
      headers: bearer(viewerToken),
    });
    expect(del.statusCode).toBe(403);
  });
});

describe('features RBAC', () => {
  it('any authenticated user can LIST features', async () => {
    for (const t of [ownerToken, operatorToken, viewerToken]) {
      const res = await env.app.inject({
        method: 'GET',
        url: '/api/v1/features',
        headers: bearer(t),
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('operator CANNOT enable a feature (403) — infra is admin-only', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/caddy/enable',
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('auth.forbidden');
  });

  it('viewer CANNOT disable a feature (403)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/caddy/disable',
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('unauthenticated access', () => {
  it('rejects every protected route with 401 when no token', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/v1/storage/connections'],
      ['POST', '/api/v1/storage/connections'],
      ['GET', '/api/v1/features'],
      ['POST', '/api/v1/features/caddy/enable'],
      ['GET', '/api/v1/audit'],
    ];
    for (const [method, url] of routes) {
      const res = await env.app.inject({ method: method as 'GET', url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
