import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

// Docker stub that captures pull + createContainer for a container deploy.
const created: Array<Record<string, unknown>> = [];
const removed: string[] = [];
const renamed: Array<{ name: string }> = [];
const startSpy = vi.fn(async () => {});
const containerDocker = {
  getContainer: (name: string) => ({
    inspect: async () => ({}),
    remove: async () => {
      removed.push(name);
    },
  }),
  pull: (_image: string, _opts: unknown, cb: (e: Error | null, s?: unknown) => void) => cb(null, {}),
  modem: { followProgress: (_s: unknown, done: (e: Error | null) => void) => done(null) },
  createContainer: async (spec: Record<string, unknown>) => {
    created.push(spec);
    return {
      start: startSpy,
      rename: async (opts: { name: string }) => {
        renamed.push(opts);
      },
    };
  },
} as unknown as Docker;

let env: TestEnv;
let adminToken: string;
let siteId: string;

beforeAll(async () => {
  env = await buildTestEnv({ docker: containerDocker });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  adminToken = (
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'owner@example.com', password: 'OwnerPass1' },
    })
  ).json().data.accessToken as string;
  const site = await env.app.inject({
    method: 'POST',
    url: '/api/v1/sites',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    payload: {
      primaryDomain: 'app.example.com',
      backendType: 'container',
      containerName: 'app-test',
      containerPort: 8080,
    },
  });
  siteId = site.json().data.id as string;
});

afterAll(async () => {
  await env.cleanup();
});

async function mint(scope: 'static' | 'container' | 'both'): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: `/api/v1/sites/${siteId}/deploy-tokens`,
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    payload: { name: scope, scope },
  });
  return res.json().data.token as string;
}

describe('container deploy', () => {
  it('pulls the image and recreates the container (create-then-swap to the stable name)', async () => {
    created.length = 0;
    renamed.length = 0;
    const token = await mint('container');
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { image: 'registry.example.com/app:abc123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ image: 'registry.example.com/app:abc123', containerName: 'app-test' });
    expect(created).toHaveLength(1);
    // New container is created under a temp name first (zero-downtime / failure-safe).
    expect(created[0]).toMatchObject({
      name: 'app-test-deploying',
      Image: 'registry.example.com/app:abc123',
      ExposedPorts: { '8080/tcp': {} },
    });
    expect(startSpy).toHaveBeenCalled();
    // …then promoted to the stable name once it's up.
    expect(renamed).toContainEqual({ name: 'app-test' });
  });

  it('rejects a JSON deploy with a malformed image ref (400)', async () => {
    const token = await mint('container');
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { image: 'bad image !!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('a static-scoped token cannot do a container deploy (401)', async () => {
    const token = await mint('static');
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { image: 'registry.example.com/app:def456' },
    });
    expect(res.statusCode).toBe(401);
  });
});
