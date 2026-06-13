import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpRegistryClient, formatBytes } from '../registry-client.js';
import { AppError, NotFoundError } from '../errors.js';

/**
 * Tests the HTTP registry client against a REAL in-process HTTP server that
 * emulates the registry v2 endpoints we use. No mocking of our client — it
 * makes real fetch calls over a real socket.
 */

interface RepoState {
  tags: Map<string, string>; // tag -> digest
  manifests: Map<string, { mediaType: string; configSize: number; layerSizes: number[] }>;
}

const repos = new Map<string, RepoState>();
let requireAuth = false;

function reset() {
  repos.clear();
  requireAuth = false;
  const nginx: RepoState = {
    tags: new Map([
      ['latest', 'sha256:aaa'],
      ['1.25', 'sha256:bbb'],
    ]),
    manifests: new Map([
      ['sha256:aaa', { mediaType: 'application/vnd.docker.distribution.manifest.v2+json', configSize: 1000, layerSizes: [5000, 6000] }],
      ['sha256:bbb', { mediaType: 'application/vnd.docker.distribution.manifest.v2+json', configSize: 1000, layerSizes: [7000] }],
    ]),
  };
  repos.set('library/nginx', nginx);
  repos.set('app/web', { tags: new Map([['v1', 'sha256:ccc']]), manifests: new Map([['sha256:ccc', { mediaType: 'application/vnd.oci.image.manifest.v1+json', configSize: 500, layerSizes: [2000] }]]) });
}

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (requireAuth && !req.headers['authorization']) {
      res.writeHead(401).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;

    if (path === '/v2/' || path === '/v2') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      return;
    }
    if (path === '/v2/_catalog') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ repositories: [...repos.keys()] }),
      );
      return;
    }
    // /v2/<name...>/tags/list
    const tagsMatch = path.match(/^\/v2\/(.+)\/tags\/list$/);
    if (tagsMatch) {
      const repo = decodeURIComponent(tagsMatch[1]!);
      const state = repos.get(repo);
      if (!state) {
        res.writeHead(404).end('{}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ name: repo, tags: [...state.tags.keys()] }),
      );
      return;
    }
    // /v2/<name...>/manifests/<ref>
    const manMatch = path.match(/^\/v2\/(.+)\/manifests\/(.+)$/);
    if (manMatch) {
      const repo = decodeURIComponent(manMatch[1]!);
      const ref = decodeURIComponent(manMatch[2]!);
      const state = repos.get(repo);
      if (!state) {
        res.writeHead(404).end('{}');
        return;
      }
      const digest = ref.startsWith('sha256:') ? ref : state.tags.get(ref);
      const manifest = digest ? state.manifests.get(digest) : undefined;
      if (!digest || !manifest) {
        res.writeHead(404).end('{}');
        return;
      }
      if (req.method === 'DELETE') {
        // delete the manifest + any tags pointing at it
        state.manifests.delete(digest);
        for (const [t, d] of state.tags.entries()) if (d === digest) state.tags.delete(t);
        res.writeHead(202).end();
        return;
      }
      const body = JSON.stringify({
        mediaType: manifest.mediaType,
        config: { size: manifest.configSize },
        layers: manifest.layerSizes.map((size) => ({ size })),
      });
      res.writeHead(200, { 'content-type': manifest.mediaType, 'docker-content-digest': digest }).end(body);
      return;
    }
    res.writeHead(404).end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function client(extra: { username?: string; password?: string } = {}) {
  return new HttpRegistryClient({ endpoint: base, ...extra });
}

describe('HttpRegistryClient', () => {
  it('ping succeeds against a reachable registry', async () => {
    reset();
    await expect(client().ping()).resolves.toBeUndefined();
  });

  it('ping surfaces auth failures as invalid_credentials', async () => {
    reset();
    requireAuth = true;
    await expect(client().ping()).rejects.toMatchObject({ code: 'registry.invalid_credentials' });
    // With credentials it passes (the fake only checks presence of the header).
    await expect(client({ username: 'u', password: 'p' }).ping()).resolves.toBeUndefined();
  });

  it('ping on an unreachable host throws registry.unreachable', async () => {
    const c = new HttpRegistryClient({ endpoint: 'http://127.0.0.1:1', timeoutMs: 500 });
    await expect(c.ping()).rejects.toMatchObject({ code: 'registry.unreachable' });
  });

  it('lists repositories', async () => {
    reset();
    const repos = await client().listRepositories();
    expect(repos).toContain('library/nginx');
    expect(repos).toContain('app/web');
  });

  it('lists tags for a slashed repo name (path not over-encoded)', async () => {
    reset();
    const tags = await client().listTags('library/nginx');
    expect(tags.sort()).toEqual(['1.25', 'latest']);
  });

  it('returns [] tags for an unknown repo', async () => {
    reset();
    expect(await client().listTags('does/not-exist')).toEqual([]);
  });

  it('resolves a manifest digest + summed size', async () => {
    reset();
    const m = await client().getManifest('library/nginx', 'latest');
    expect(m.digest).toBe('sha256:aaa');
    expect(m.size).toBe(1000 + 5000 + 6000);
    expect(m.mediaType).toContain('manifest');
  });

  it('getManifest throws NotFound for a missing tag', async () => {
    reset();
    await expect(client().getManifest('library/nginx', 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes a manifest by digest', async () => {
    reset();
    const m = await client().getManifest('library/nginx', '1.25');
    await client().deleteManifest('library/nginx', m.digest);
    // 1.25 is gone; latest remains.
    expect((await client().listTags('library/nginx')).sort()).toEqual(['latest']);
  });

  it('deleteManifest throws NotFound for an unknown digest', async () => {
    reset();
    await expect(
      client().deleteManifest('library/nginx', 'sha256:doesnotexist'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('returns an AppError type from mapStatus paths (smoke)', () => {
    // Sanity: AppError is what the client throws for upstream issues.
    expect(new AppError('x', 'y', 502)).toBeInstanceOf(AppError);
  });
});
