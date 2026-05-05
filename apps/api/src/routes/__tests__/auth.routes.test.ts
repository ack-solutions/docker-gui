import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

let env: TestEnv;

beforeAll(async () => {
  env = await buildTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  // Reset users + tokens before each test
  await env.prisma.refreshToken.deleteMany();
  await env.prisma.auditLog.deleteMany();
  await env.prisma.user.deleteMany();
});

async function bootstrap(email = 'admin@example.com', password = 'StrongPass1') {
  return env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email, password, name: 'Admin' },
  });
}

describe('POST /api/v1/setup/bootstrap', () => {
  it('creates the first admin with valid setup secret', async () => {
    const res = await bootstrap();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.email).toBe('admin@example.com');
    expect(body.data.user.role).toBe('owner');
    expect(body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects with wrong setup secret', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/setup/bootstrap',
      headers: { 'x-setup-secret': 'wrong', 'content-type': 'application/json' },
      payload: { email: 'a@b.co', password: 'StrongPass1', name: 'A' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('setup.invalid_secret');
  });

  it('refuses to bootstrap when an admin already exists', async () => {
    await bootstrap();
    const res = await bootstrap('second@example.com');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('setup.already_initialized');
  });

  it('validates input', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/setup/bootstrap',
      headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
      payload: { email: 'not-email', password: 'x', name: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await bootstrap();
  });

  it('returns tokens for valid creds', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@example.com', password: 'StrongPass1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.email).toBe('admin@example.com');
    expect(body.data.accessExpiresAt).toMatch(/^\d{4}-/);
  });

  it('rejects wrong password', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@example.com', password: 'WrongPassword' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.unauthorized');
  });

  it('rejects unknown email with same generic error', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nobody@example.com', password: 'whatever' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.unauthorized');
  });

  it('validates payload', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    await bootstrap();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@example.com', password: 'StrongPass1' },
    });
    accessToken = res.json().data.accessToken;
  });

  it('returns current user with valid token', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.email).toBe('admin@example.com');
  });

  it('rejects without token', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  let refreshToken: string;

  beforeEach(async () => {
    await bootstrap();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@example.com', password: 'StrongPass1' },
    });
    refreshToken = res.json().data.refreshToken;
  });

  it('rotates refresh token on use', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.refreshToken).not.toBe(refreshToken);

    // Old token must no longer work
    const reuse = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('rejects invalid refresh token', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken: 'bogus' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the refresh token', async () => {
    await bootstrap();
    const login = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@example.com', password: 'StrongPass1' },
    });
    const refreshToken = login.json().data.refreshToken;

    const out = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(out.statusCode).toBe(204);

    const reuse = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });
});
