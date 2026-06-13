import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
  waitFor,
} from '../../__tests__/test-helpers.js';

function failingS3Client(): S3Client {
  return {
    send: () => Promise.reject(Object.assign(new Error('unreachable'), { name: 'ECONNREFUSED' })),
  } as unknown as S3Client;
}

let env: TestEnv;
let ownerToken: string;
let viewerToken: string;

beforeAll(async () => {
  env = await buildTestEnv({
    storageOptions: { buildS3Client: () => failingS3Client() },
  });
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
  await env.prisma.auditLog.deleteMany();
  await env.prisma.s3Connection.deleteMany();
});

/** Headers WITH a JSON body. */
function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

/** Headers for a BODILESS request (no content-type — see rbac test for why). */
function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

/** Wait until at least one audit row matching `action` exists, return it. */
async function awaitAction(action: string) {
  return waitFor(async () => {
    const rows = await env.prisma.auditLog.findMany({ where: { action } });
    return rows[0] ?? null;
  });
}

describe('audit log auto-writer', () => {
  it('records a row for a state-changing POST with derived action + target', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: {
        name: 'audit-conn',
        endpoint: 'http://minio:9000',
        accessKey: 'minioadmin',
        secretKey: 'super-secret-value',
      },
    });
    expect(res.statusCode).toBe(201);

    const entry = await awaitAction('storage.connection.create');
    expect(entry).toBeTruthy();
    expect(entry!.actorId).toBeTruthy();
    // target type derived from the route pattern
    expect(entry!.targetType).toBe('connection');
  });

  it('REDACTS secrets in the stored payload', async () => {
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: {
        name: 'redact-conn',
        endpoint: 'http://minio:9000',
        accessKey: 'minioadmin',
        secretKey: 'TOP-SECRET-DO-NOT-LOG',
      },
    });

    const entry = await awaitAction('storage.connection.create');
    expect(entry).toBeTruthy();
    const payload = entry!.payload ?? '';
    // The raw secret must never appear anywhere in the serialized payload.
    expect(payload).not.toContain('TOP-SECRET-DO-NOT-LOG');
    // It should be present but redacted.
    expect(payload).toContain('[redacted]');
    // Non-secret field is retained.
    expect(payload).toContain('redact-conn');
  });

  it('records auth.login.success on login and auth.login.failed on bad password', async () => {
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'OwnerPass1' },
    });
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'WRONG' },
    });

    await awaitAction('auth.login.success');
    await awaitAction('auth.login.failed');

    const rows = await env.prisma.auditLog.findMany();
    // The password must not be stored for either outcome.
    for (const r of rows.filter((x) => x.action.startsWith('auth.login'))) {
      expect(r.payload ?? '').not.toContain('OwnerPass1');
      expect(r.payload ?? '').not.toContain('WRONG');
    }
  });

  it('does NOT record GET reads', async () => {
    await env.app.inject({
      method: 'GET',
      url: '/api/v1/storage/connections',
      headers: bearer(ownerToken),
    });
    // Give any (erroneous) async writer a chance to fire, then assert none.
    await new Promise((r) => setTimeout(r, 100));
    const count = await env.prisma.auditLog.count({ where: { action: { startsWith: 'storage' } } });
    expect(count).toBe(0);
  });

  it('records a row even for a denied (403) write attempt', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/caddy/enable',
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(403);

    const entry = await awaitAction('feature.enable');
    expect(entry).toBeTruthy();
    // The forbidden status is captured in the payload for forensics.
    expect(entry!.payload ?? '').toContain('403');
  });
});

describe('audit log read API (RBAC + pagination + filter)', () => {
  it('viewer is FORBIDDEN from reading the audit log (403)', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('owner can read the audit log', async () => {
    // Generate a couple of events.
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: {
        name: 'read-conn',
        endpoint: 'http://minio:9000',
        accessKey: 'a',
        secretKey: 'b-secret',
      },
    });
    await awaitAction('storage.connection.create');
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: bearer(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const page = res.json().data;
    expect(Array.isArray(page.entries)).toBe(true);
    expect(page.entries.length).toBeGreaterThan(0);
    expect(typeof page.total).toBe('number');
  });

  it('filters by actionPrefix', async () => {
    // One storage event + one (failed) login event.
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: { name: 'f1', endpoint: 'http://minio:9000', accessKey: 'a', secretKey: 'b-secret' },
    });
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'nope' },
    });
    await awaitAction('storage.connection.create');

    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit?actionPrefix=storage.',
      headers: bearer(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json().data.entries as Array<{ action: string }>;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.action.startsWith('storage.'))).toBe(true);
  });

  it('exact action filter takes precedence over actionPrefix (no clobber)', async () => {
    // Create one storage event + one failed login event.
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: { name: 'p1', endpoint: 'http://minio:9000', accessKey: 'a', secretKey: 'b-secret' },
    });
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'nope' },
    });
    await awaitAction('storage.connection.create');
    await awaitAction('auth.login.failed');

    // Both action (exact) and actionPrefix (conflicting) provided: exact wins.
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit?action=auth.login.failed&actionPrefix=storage.',
      headers: bearer(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json().data.entries as Array<{ action: string }>;
    expect(entries.length).toBeGreaterThan(0);
    // Every row is the exact action — the prefix did NOT clobber it.
    expect(entries.every((e) => e.action === 'auth.login.failed')).toBe(true);
  });

  it('omits total when includeTotal=false', async () => {
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/storage/connections',
      headers: auth(ownerToken),
      payload: { name: 'nt', endpoint: 'http://minio:9000', accessKey: 'a', secretKey: 'b-secret' },
    });
    await awaitAction('storage.connection.create');

    const withTotal = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=5',
      headers: bearer(ownerToken),
    });
    expect(typeof withTotal.json().data.total).toBe('number');

    const noTotal = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=5&includeTotal=false',
      headers: bearer(ownerToken),
    });
    expect(noTotal.statusCode).toBe(200);
    expect(noTotal.json().data.total).toBeUndefined();
    // Entries are still returned.
    expect(noTotal.json().data.entries.length).toBeGreaterThan(0);
  });

  it('paginates with a cursor', async () => {
    // Make 5 events.
    for (let i = 0; i < 5; i++) {
      await env.app.inject({
        method: 'POST',
        url: '/api/v1/storage/connections',
        headers: auth(ownerToken),
        payload: {
          name: `page-${i}`,
          endpoint: 'http://minio:9000',
          accessKey: 'a',
          secretKey: 'b-secret',
        },
      });
    }
    // Wait until all 5 create events are persisted.
    await waitFor(async () => {
      const n = await env.prisma.auditLog.count({ where: { action: 'storage.connection.create' } });
      return n >= 5;
    });
    const first = await env.app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=2',
      headers: bearer(ownerToken),
    });
    const page1 = first.json().data;
    expect(page1.entries.length).toBe(2);
    expect(page1.nextCursor).toBeTruthy();

    const second = await env.app.inject({
      method: 'GET',
      url: `/api/v1/audit?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
      headers: bearer(ownerToken),
    });
    const page2 = second.json().data;
    expect(page2.entries.length).toBe(2);
    // No overlap between pages.
    const ids1 = new Set(page1.entries.map((e: { id: string }) => e.id));
    for (const e of page2.entries as Array<{ id: string }>) {
      expect(ids1.has(e.id)).toBe(false);
    }
  });
});
