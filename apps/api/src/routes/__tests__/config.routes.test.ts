/**
 * /api/v1/config end-to-end. Real Fastify app, real JWT auth, real
 * registry-backed snapshot.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

let env: TestEnv;
let token: string;

beforeAll(async () => {
  env = await buildTestEnv();
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1', name: 'Admin' },
  });
  const login = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@example.com', password: 'StrongPass1' },
  });
  token = login.json().data.accessToken;
});

afterAll(async () => {
  await env.cleanup();
});

describe('GET /api/v1/config', () => {
  it('requires authentication', async () => {
    const r = await env.app.inject({ method: 'GET', url: '/api/v1/config' });
    expect(r.statusCode).toBe(401);
  });

  it('returns the full key catalogue when authenticated', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(Array.isArray(body.data.keys)).toBe(true);
    expect(body.data.keys.length).toBeGreaterThan(15);
    const keys = body.data.keys.map((k: { key: string }) => k.key);
    expect(keys).toContain('core.auth.jwtSecret');
    expect(keys).toContain('core.log.level');
    expect(keys).toContain('docker.installDir');
  });

  it('masks secret values in the response', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = r.json();
    const jwt = body.data.keys.find(
      (k: { key: string }) => k.key === 'core.auth.jwtSecret',
    );
    expect(jwt.secret).toBe(true);
    // The masked value never reveals the real JWT secret used in tests.
    expect(String(jwt.current.value)).not.toContain('test-secret');
    expect(String(jwt.current.value)).toMatch(/•/);
  });

  it('returns source provenance per key', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = r.json();
    for (const k of body.data.keys) {
      expect(['default', 'yaml', 'env', 'db', 'runtime']).toContain(k.current.source);
    }
  });

  it('groups every key into a valid group', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = r.json();
    const groups = new Set<string>(
      body.data.keys.map((k: { group: string }) => k.group),
    );
    expect(groups.size).toBeGreaterThanOrEqual(4);
  });

  it('flags JWT_SECRET as non-uiEditable + secret', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = r.json();
    const jwt = body.data.keys.find(
      (k: { key: string }) => k.key === 'core.auth.jwtSecret',
    );
    expect(jwt.uiEditable).toBe(false);
    expect(jwt.secret).toBe(true);
    expect(jwt.required).toBe(true);
  });
});

describe('GET /api/v1/config/:key', () => {
  it('returns one key by id', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config/core.log.level',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.key).toBe('core.log.level');
    expect(r.json().data.enumValues).toEqual([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('404s for unknown keys', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config/does.not.exist',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('not_found');
  });

  it('still requires auth for single-key reads', async () => {
    const r = await env.app.inject({
      method: 'GET',
      url: '/api/v1/config/core.log.level',
    });
    expect(r.statusCode).toBe(401);
  });
});
