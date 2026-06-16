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
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  token = (
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'OwnerPass1' },
    })
  ).json().data.accessToken as string;
});

afterAll(async () => {
  await env.cleanup();
});

describe('GET /api/v1/features/email/preconditions', () => {
  it('requires auth', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/features/email/preconditions' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the prerequisites checklist + DNS records for a domain', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/features/email/preconditions?domain=example.com',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.ready).toBe('boolean');
    expect(Array.isArray(body.checklist)).toBe(true);
    expect(Array.isArray(body.manualSteps)).toBe(true);
    expect(body.why).toBeTruthy();
    // DNS records come from the domain regardless of IP detection.
    expect(body.dnsRecords.some((r: { type: string }) => r.type === 'MX')).toBe(true);
    // No secret material in the payload.
    expect(JSON.stringify(body)).not.toMatch(/passwordCipher|secretKey|dgwt_/);
  });

  it('email stays gated — enable returns feature.coming_soon', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/email/enable',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('feature.coming_soon');
  });
});
