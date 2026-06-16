import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gzipSync } from 'node:zlib';
import { pack as tarPack } from 'tar-stream';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

// A docker where the Caddy container doesn't exist, so the deploy service
// takes its "caddy unavailable" (503) branch right after auth — letting us
// assert the auth boundary without a full Caddy mock.
const caddyDownDocker = {
  getContainer: () => ({ inspect: async () => Promise.reject(new Error('no such container')) }),
} as unknown as Docker;

let env: TestEnv;
let adminToken: string;
let siteId: string;

async function gzippedTar(): Promise<Buffer> {
  const pack = tarPack();
  pack.entry({ name: 'index.html' }, '<h1>hello</h1>');
  pack.finalize();
  const chunks: Buffer[] = [];
  for await (const c of pack) chunks.push(c as Buffer);
  return gzipSync(Buffer.concat(chunks));
}

beforeAll(async () => {
  env = await buildTestEnv({ docker: caddyDownDocker });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  const lr = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1' },
  });
  adminToken = lr.json().data.accessToken as string;
  const site = await env.app.inject({
    method: 'POST',
    url: '/api/v1/sites',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    payload: { primaryDomain: 'static.example.com', backendType: 'static', spaFallback: false },
  });
  siteId = site.json().data.id as string;
});

afterAll(async () => {
  await env.cleanup();
});

function authH() {
  return { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
}

describe('deploy tokens + deploy endpoint', () => {
  it('creates a static site with no upstream', () => {
    expect(siteId).toBeTruthy();
  });

  it('mints a deploy token (plaintext shown once), lists, and the deploy route accepts it', async () => {
    const mint = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy-tokens`,
      headers: authH(),
      payload: { name: 'ci', scope: 'static' },
    });
    expect(mint.statusCode).toBe(201);
    const token = mint.json().data.token as string;
    expect(token).toMatch(/^dgwt_/);

    const list = await env.app.inject({
      method: 'GET',
      url: `/api/v1/sites/${siteId}/deploy-tokens`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    // list never leaks the plaintext
    expect(list.json().data).toHaveLength(1);
    expect(JSON.stringify(list.json().data)).not.toContain(token);

    // Valid token gets PAST auth — the fake docker has no Caddy container, so
    // it then 503s (proving auth + body parsing + reaching the deploy svc).
    const deploy = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/gzip' },
      payload: await gzippedTar(),
    });
    expect(deploy.statusCode).toBe(503);
    expect(deploy.json().error.code).toBe('deploy.caddy_unavailable');
  });

  it('rejects deploy with no token (401)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { 'content-type': 'application/gzip' },
      payload: await gzippedTar(),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token that belongs to another site / is revoked", async () => {
    const mint = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy-tokens`,
      headers: authH(),
      payload: { name: 'temp', scope: 'static' },
    });
    const tokenId = mint.json().data.id as string;
    const token = mint.json().data.token as string;
    // revoke it
    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/sites/${siteId}/deploy-tokens/${tokenId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(200);
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/gzip' },
      payload: await gzippedTar(),
    });
    expect(res.statusCode).toBe(401);
  });

  it('a static-scoped token cannot be used cross-site', async () => {
    // make a second site + token, try it against the first site
    const site2 = await env.app.inject({
      method: 'POST',
      url: '/api/v1/sites',
      headers: authH(),
      payload: { primaryDomain: 'other.example.com', backendType: 'static' },
    });
    const id2 = site2.json().data.id as string;
    const mint = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${id2}/deploy-tokens`,
      headers: authH(),
      payload: { name: 'ci2', scope: 'static' },
    });
    const token2 = mint.json().data.token as string;
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${siteId}/deploy`, // wrong site
      headers: { authorization: `Bearer ${token2}`, 'content-type': 'application/gzip' },
      payload: await gzippedTar(),
    });
    expect(res.statusCode).toBe(401);
  });
});
