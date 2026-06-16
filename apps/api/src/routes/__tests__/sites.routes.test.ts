import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { CaddyClient } from '../../lib/caddy.js';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

let env: TestEnv;
let caddyLoadConfig: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  caddyLoadConfig = vi.fn().mockResolvedValue(undefined);
  const fakeCaddy = {
    loadConfig: caddyLoadConfig,
    getConfig: vi.fn().mockResolvedValue({}),
    ping: vi.fn().mockResolvedValue(true),
  } as unknown as CaddyClient;

  env = await buildTestEnv({ caddy: fakeCaddy });
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
  caddyLoadConfig.mockClear();
  await env.prisma.site.deleteMany();
});

async function getToken(): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1' },
  });
  return res.json().data.accessToken;
}

describe('GET /api/v1/sites', () => {
  it('rejects without auth', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/sites' });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty list initially', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

describe('GET /api/v1/sites/status', () => {
  it('reports caddy configured when client is provided', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/sites/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ caddyConfigured: true, caddyReachable: true });
  });
});

describe('POST /api/v1/sites', () => {
  it('creates a site with valid input', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {
        primaryDomain: 'example.com',
        upstreamUrl: 'web:80',
      },
    });
    expect(res.statusCode).toBe(201);
    const site = res.json().data;
    expect(site.primaryDomain).toBe('example.com');
    expect(site.aliasDomains).toEqual([]);
    expect(site.enableHttps).toBe(true);
    expect(site.status).toBe('draft');
  });

  it('rejects malformed domain', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { primaryDomain: 'not a domain', upstreamUrl: 'x:80' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects duplicate primary domain', async () => {
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'dup.com', upstreamUrl: 'a:80' },
    });
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'dup.com', upstreamUrl: 'b:80' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('site.domain_taken');
  });

  it('accepts alias domains and Let\'s Encrypt email', async () => {
    const token = await getToken();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {
        primaryDomain: 'example.com',
        aliasDomains: ['www.example.com'],
        upstreamUrl: 'web:80',
        letsEncryptEmail: 'ops@example.com',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.aliasDomains).toEqual(['www.example.com']);
    expect(res.json().data.letsEncryptEmail).toBe('ops@example.com');
  });
});

describe('PATCH /api/v1/sites/:id', () => {
  it('updates fields and resets status to draft', async () => {
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'a.com', upstreamUrl: 'a:80' },
    });
    const id = created.json().data.id;

    // simulate that it had been applied
    await env.prisma.site.update({
      where: { id },
      data: { status: 'applied', lastAppliedAt: new Date() },
    });

    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/sites/${id}`,
      headers: auth,
      payload: { upstreamUrl: 'b:8080' },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json().data;
    expect(updated.upstreamUrl).toBe('b:8080');
    expect(updated.status).toBe('draft'); // reset
  });
});

describe('DELETE /api/v1/sites/:id', () => {
  it('removes a site', async () => {
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'gone.com', upstreamUrl: 'x:80' },
    });
    const id = created.json().data.id;

    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/sites/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const get = await env.app.inject({
      method: 'GET',
      url: `/api/v1/sites/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(404);
  });
});

describe('POST /api/v1/sites/apply', () => {
  it('applies enabled sites to Caddy and marks them applied', async () => {
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'a.com', upstreamUrl: 'a:80' },
    });
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'b.com', upstreamUrl: 'b:80' },
    });

    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites/apply',
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ ok: true, applied: 2 });
    expect(caddyLoadConfig).toHaveBeenCalledOnce();

    const list = await env.app.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}` },
    });
    for (const site of list.json().data) {
      expect(site.status).toBe('applied');
      expect(site.lastAppliedAt).toBeTruthy();
    }
  });

  it('marks sites as error when Caddy rejects the config', async () => {
    caddyLoadConfig.mockRejectedValueOnce(new Error('caddy: bad upstream'));
    const token = await getToken();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: auth,
      payload: { primaryDomain: 'broken.com', upstreamUrl: 'x:80' },
    });

    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites/apply',
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const result = res.json().data;
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bad upstream');

    const list = await env.app.inject({
      method: 'GET',
      url: '/api/v1/sites',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data[0].status).toBe('error');
    expect(list.json().data[0].lastError).toContain('bad upstream');
  });
});

describe('Caddy not configured', () => {
  it('returns 503 with caddy.not_configured when no client', async () => {
    const env2 = await buildTestEnv({ caddy: null });
    try {
      // bootstrap + login on the second env
      await env2.app.inject({
        method: 'POST',
        url: '/api/v1/setup/bootstrap',
        headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
        payload: { email: 'a@b.co', password: 'StrongPass1', name: 'A' },
      });
      const login = await env2.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'a@b.co', password: 'StrongPass1' },
      });
      const t = login.json().data.accessToken;

      const res = await env2.app.inject({
        method: 'POST',
        url: '/api/v1/sites/apply',
        headers: { authorization: `Bearer ${t}` },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe('caddy.not_configured');
    } finally {
      await env2.cleanup();
    }
  });
});
