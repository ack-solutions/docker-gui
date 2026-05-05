import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequireAuth, requireRole } from '../auth.middleware.js';
import { signAccessToken } from '../../lib/jwt.js';

const jwtConfig = {
  secret: 'test-secret-long-enough-for-tests-1234567890',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  const requireAuth = createRequireAuth({ jwtConfig });

  app.get('/protected', { preHandler: requireAuth }, async (req) => ({
    data: { user: req.user },
  }));

  app.get(
    '/admin-only',
    { preHandler: [requireAuth, requireRole('admin', 'owner')] },
    async () => ({ data: { ok: true } }),
  );

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function makeToken(role = 'admin') {
  const { token } = signAccessToken({ sub: 'u-1', email: 'a@b.co', role }, jwtConfig);
  return token;
}

describe('requireAuth', () => {
  it('rejects missing Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.missing_token');
  });

  it('rejects malformed Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Token xyz' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.missing_token');
  });

  it('rejects invalid bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer notajwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.invalid_token');
  });

  it('attaches user payload on valid token', async () => {
    const token = makeToken();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user).toMatchObject({ sub: 'u-1', email: 'a@b.co', role: 'admin' });
  });
});

describe('requireRole', () => {
  it('allows admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${makeToken('admin')}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('allows owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${makeToken('owner')}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('forbids viewer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${makeToken('viewer')}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('auth.forbidden');
  });
});
