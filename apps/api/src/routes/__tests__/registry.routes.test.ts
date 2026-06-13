import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import type { RegistryClient, ManifestInfo } from '../../lib/registry-client.js';

/**
 * In-memory registry backend shared across the suite. The service is exercised
 * through the REAL Fastify app + REAL Prisma; only the registry transport
 * (network) is replaced by this in-memory implementation — the same seam the
 * storage tests use for S3.
 */
interface Repo {
  tags: Map<string, string>; // tag -> digest
  sizes: Map<string, number>; // digest -> size
}
const backend = {
  reachable: true,
  rejectAuth: false,
  repos: new Map<string, Repo>(),
};

function resetBackend() {
  backend.reachable = true;
  backend.rejectAuth = false;
  backend.repos = new Map([
    [
      'library/nginx',
      {
        tags: new Map([
          ['latest', 'sha256:aaa'],
          ['1.25', 'sha256:bbb'],
        ]),
        sizes: new Map([
          ['sha256:aaa', 12000],
          ['sha256:bbb', 8000],
        ]),
      },
    ],
    ['team/api', { tags: new Map([['v1', 'sha256:ccc']]), sizes: new Map([['sha256:ccc', 4000]]) }],
  ]);
}

function fakeClient(): RegistryClient {
  return {
    async ping() {
      if (!backend.reachable) throw new AppError('registry.unreachable', 'down', 503);
      if (backend.rejectAuth) throw new AppError('registry.invalid_credentials', 'nope', 401);
    },
    async listRepositories() {
      return [...backend.repos.keys()];
    },
    async listTags(repo: string) {
      const r = backend.repos.get(repo);
      return r ? [...r.tags.keys()] : [];
    },
    async getManifest(repo: string, ref: string): Promise<ManifestInfo> {
      const r = backend.repos.get(repo);
      if (!r) throw new NotFoundError('no repo');
      const digest = ref.startsWith('sha256:') ? ref : r.tags.get(ref);
      if (!digest || !r.sizes.has(digest)) throw new NotFoundError('no manifest');
      return { digest, size: r.sizes.get(digest) ?? 0, mediaType: 'application/vnd.docker.distribution.manifest.v2+json' };
    },
    async deleteManifest(repo: string, digest: string) {
      const r = backend.repos.get(repo);
      if (!r || !r.sizes.has(digest)) throw new NotFoundError('no manifest');
      r.sizes.delete(digest);
      for (const [t, d] of r.tags.entries()) if (d === digest) r.tags.delete(t);
    },
  };
}

let env: TestEnv;
let operatorToken: string;
let viewerToken: string;

beforeAll(async () => {
  env = await buildTestEnv({
    registryOptions: { buildClient: () => fakeClient() },
  });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  operatorToken = await createUserAndLogin(env, {
    email: 'op@example.com',
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
  resetBackend();
  await env.prisma.registryConnection.deleteMany();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createConnection(extra: Record<string, unknown> = {}): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/registry/connections',
    headers: auth(operatorToken),
    payload: { name: 'local', endpoint: 'http://docker-gui-registry:5000', managed: true, ...extra },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

describe('connections', () => {
  it('creates a connection and verifies it (reachable)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(operatorToken),
      payload: { name: 'local', endpoint: 'http://docker-gui-registry:5000/', managed: true },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.verified).toBe(true);
    // Endpoint trailing slash normalized away.
    expect(body.endpoint).toBe('http://docker-gui-registry:5000');
    expect(body.hasPassword).toBe(false);
  });

  it('stores credentials encrypted and never returns the password', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(operatorToken),
      payload: {
        name: 'secured',
        endpoint: 'https://registry.example.com',
        username: 'ci',
        password: 'super-secret-token',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.hasPassword).toBe(true);
    expect(JSON.stringify(body)).not.toContain('super-secret-token');
    // The cipher in the DB is not the plaintext.
    const row = await env.prisma.registryConnection.findFirst({ where: { name: 'secured' } });
    expect(row?.passwordCipher).toBeTruthy();
    expect(row?.passwordCipher).not.toContain('super-secret-token');
  });

  it('records lastError when the registry is unreachable on create', async () => {
    backend.reachable = false;
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(operatorToken),
      payload: { name: 'down', endpoint: 'http://nope:5000' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().verified).toBe(false);
    expect(res.json().lastError).toContain('registry.unreachable');
  });

  it('rejects a duplicate name (409)', async () => {
    await createConnection();
    const dup = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(operatorToken),
      payload: { name: 'local', endpoint: 'http://other:5000' },
    });
    expect(dup.statusCode).toBe(409);
  });

  it('rejects a non-http endpoint (400)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(operatorToken),
      payload: { name: 'bad', endpoint: 'ftp://x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('re-verify flips verified back to true after the registry recovers', async () => {
    backend.reachable = false;
    const id = await createConnection({ name: 'flap' });
    expect((await env.app.inject({ method: 'GET', url: `/api/v1/registry/connections/${id}`, headers: bearer(operatorToken) })).json().verified).toBe(false);
    backend.reachable = true;
    const v = await env.app.inject({ method: 'POST', url: `/api/v1/registry/connections/${id}/verify`, headers: bearer(operatorToken) });
    expect(v.statusCode).toBe(200);
    expect(v.json().verified).toBe(true);
  });

  it('PATCH clearing the password nulls the cipher', async () => {
    const id = await createConnection({ name: 'creds', username: 'u', password: 'p' });
    const patched = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/registry/connections/${id}`,
      headers: auth(operatorToken),
      payload: { password: '' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().hasPassword).toBe(false);
  });
});

describe('RBAC', () => {
  it('viewer can read connections but cannot create (403)', async () => {
    const read = await env.app.inject({ method: 'GET', url: '/api/v1/registry/connections', headers: bearer(viewerToken) });
    expect(read.statusCode).toBe(200);
    const create = await env.app.inject({
      method: 'POST',
      url: '/api/v1/registry/connections',
      headers: auth(viewerToken),
      payload: { name: 'x', endpoint: 'http://x:5000' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('viewer cannot delete a tag (403)', async () => {
    const id = await createConnection();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/registry/${id}/tags?repo=library/nginx&tag=1.25`,
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('repositories + tags', () => {
  it('lists repositories with tag counts', async () => {
    const id = await createConnection();
    const res = await env.app.inject({ method: 'GET', url: `/api/v1/registry/${id}/repositories`, headers: bearer(viewerToken) });
    expect(res.statusCode).toBe(200);
    const repos = res.json() as Array<{ name: string; tagCount: number }>;
    const nginx = repos.find((r) => r.name === 'library/nginx');
    expect(nginx?.tagCount).toBe(2);
    expect(repos.find((r) => r.name === 'team/api')?.tagCount).toBe(1);
  });

  it('lists tags with digest + size', async () => {
    const id = await createConnection();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/registry/${id}/tags?repo=library/nginx`,
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(200);
    const tags = res.json() as Array<{ tag: string; digest: string; size: number }>;
    const latest = tags.find((t) => t.tag === 'latest');
    expect(latest?.digest).toBe('sha256:aaa');
    expect(latest?.size).toBe(12000);
  });

  it('rejects an invalid repo name (400)', async () => {
    const id = await createConnection();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/registry/${id}/tags?repo=${encodeURIComponent('BAD NAME!!')}`,
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(400);
  });

  it('operator deletes a tag; it disappears from the listing', async () => {
    const id = await createConnection();
    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/registry/${id}/tags?repo=library/nginx&tag=1.25`,
      headers: bearer(operatorToken),
    });
    expect(del.statusCode).toBe(204);
    const tags = (await env.app.inject({
      method: 'GET',
      url: `/api/v1/registry/${id}/tags?repo=library/nginx`,
      headers: bearer(operatorToken),
    })).json() as Array<{ tag: string }>;
    expect(tags.map((t) => t.tag)).toEqual(['latest']);
  });

  it('deleting an unknown tag returns 404', async () => {
    const id = await createConnection();
    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/registry/${id}/tags?repo=library/nginx&tag=nope`,
      headers: bearer(operatorToken),
    });
    expect(del.statusCode).toBe(404);
  });

  it('bounds fan-out and filters malformed names/tags from a hostile registry', async () => {
    // A registry returning a huge, partly-malformed tag list must not cause
    // unbounded concurrency, and malformed entries must be dropped.
    let inFlight = 0;
    let maxInFlight = 0;
    const hugeTags = Array.from({ length: 5000 }, (_v, i) => `t${i}`);
    const hostile: RegistryClient = {
      async ping() {},
      async listRepositories() {
        return ['good/repo', 'BAD NAME', '../evil', 'another/ok'];
      },
      async listTags() {
        return [...hugeTags, 'BAD TAG', '../escape'];
      },
      async getManifest(_repo, ref) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return { digest: `sha256:${ref}`, size: 1, mediaType: 'application/vnd.docker.distribution.manifest.v2+json' };
      },
      async deleteManifest() {},
    };
    // Rebuild env with the hostile client just for this assertion.
    const localEnv = await buildTestEnv({ registryOptions: { buildClient: () => hostile } });
    try {
      await localEnv.app.inject({
        method: 'POST',
        url: '/api/v1/setup/bootstrap',
        headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
        payload: { email: 'o@example.com', password: 'OwnerPass1', name: 'O' },
      });
      const lr = await localEnv.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'o@example.com', password: 'OwnerPass1' },
      });
      const tok = lr.json().data.accessToken as string;
      const cr = await localEnv.app.inject({
        method: 'POST',
        url: '/api/v1/registry/connections',
        headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
        payload: { name: 'hostile', endpoint: 'http://hostile:5000' },
      });
      const cid = cr.json().id as string;

      // Repositories: malformed names dropped, valid ones kept.
      const reposRes = await localEnv.app.inject({
        method: 'GET',
        url: `/api/v1/registry/${cid}/repositories`,
        headers: { authorization: `Bearer ${tok}` },
      });
      const repoNames = (reposRes.json() as Array<{ name: string }>).map((r) => r.name);
      expect(repoNames).toEqual(['good/repo', 'another/ok']);

      // Tags: capped at MAX_TAGS (1000), malformed dropped, concurrency bounded.
      const tagsRes = await localEnv.app.inject({
        method: 'GET',
        url: `/api/v1/registry/${cid}/tags?repo=good/repo`,
        headers: { authorization: `Bearer ${tok}` },
      });
      const tags = tagsRes.json() as Array<{ tag: string }>;
      expect(tags.length).toBe(1000); // capped
      expect(tags.every((t) => /^t\d+$/.test(t.tag))).toBe(true); // malformed filtered
      expect(maxInFlight).toBeLessThanOrEqual(8); // bounded concurrency
    } finally {
      await localEnv.cleanup();
    }
  });

  it('requires auth on every route', async () => {
    const id = await createConnection();
    for (const [method, url] of [
      ['GET', '/api/v1/registry/connections'],
      ['GET', `/api/v1/registry/${id}/repositories`],
    ] as const) {
      const res = await env.app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
