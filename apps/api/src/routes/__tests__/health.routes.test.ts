import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv } from '../../__tests__/test-helpers.js';

let env: TestEnv;

beforeAll(async () => {
  env = await buildTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

describe('GET /api/v1/health', () => {
  it('returns 200 and a valid health envelope', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.checks.api.status).toBe('ok');
    expect(body.data.checks.docker.status).toBe('ok');
    expect(body.data.checks.database.status).toBe('ok'); // real DB now
    expect(body.data.system.cpu.cores).toBeGreaterThan(0);
    expect(body.data.system.memory.totalBytes).toBeGreaterThan(0);
    expect(body.data.status).toBe('ok');
  });
});

describe('GET /api/v1/health/live', () => {
  it('returns ok=true', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { ok: true } });
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns ok=true when status is not down', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.ok).toBe(true);
  });
});

describe('error handling', () => {
  it('returns standard error envelope for unknown routes', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });
});

describe('CORS', () => {
  it('allows the configured origin', async () => {
    const res = await env.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
