import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

/**
 * Deploy history + rollback. No mocks of our own code — only the dockerode
 * boundary is faked (Caddy exec for the symlink swap; createContainer for the
 * container path). The fake exec returns a 0/non-0 exit code based on whether
 * the release dir is in `existingReleases`, so we can drive both the happy
 * path and the pruned-release (stale) path.
 */

const execScripts: string[] = [];
const existingReleases = new Set<string>();
const createdContainers: Array<Record<string, unknown>> = [];
const removedContainers: string[] = [];
const startSpy = vi.fn(async () => {});

const docker = {
  getContainer: (name: string) => ({
    inspect: async () => ({}),
    remove: async () => {
      removedContainers.push(name);
    },
    exec: async ({ Cmd }: { Cmd: string[] }) => {
      const script = Cmd[2] ?? '';
      execScripts.push(script);
      let code = 0;
      // Emulate the rollback's combined `test -d … || exit 3; ln …` script:
      // missing release dir → exit 3 (release_gone), else the symlink swap (0).
      if (script.includes('exit 3')) {
        code = [...existingReleases].some((r) => script.includes(`/releases/${r}`)) ? 0 : 3;
      }
      return {
        start: async () => Readable.from([Buffer.from('')]),
        inspect: async () => ({ ExitCode: code }),
      };
    },
  }),
  pull: (_image: string, _opts: unknown, cb: (e: Error | null, s?: unknown) => void) => cb(null, {}),
  modem: { followProgress: (_s: unknown, done: (e: Error | null) => void) => done(null) },
  createContainer: async (spec: Record<string, unknown>) => {
    createdContainers.push(spec);
    return { start: startSpy, rename: async (_opts: { name: string }) => {} };
  },
} as unknown as Docker;

let env: TestEnv;
let adminToken: string;
let operatorToken: string;
let viewerToken: string;

function auth(t: string) {
  return { authorization: `Bearer ${t}`, 'content-type': 'application/json' };
}
function bearer(t: string) {
  return { authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  env = await buildTestEnv({ docker });
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
  operatorToken = await createUserAndLogin(env, {
    email: 'op@example.com', password: 'OperatorPass1', name: 'Op', role: 'operator',
  });
  viewerToken = await createUserAndLogin(env, {
    email: 'viewer@example.com', password: 'ViewerPass1', name: 'Viewer', role: 'viewer',
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.prisma.deploy.deleteMany();
  await env.prisma.site.deleteMany();
  execScripts.length = 0;
  existingReleases.clear();
  createdContainers.length = 0;
  removedContainers.length = 0;
  startSpy.mockReset();
  startSpy.mockResolvedValue(undefined);
});

async function staticSite(): Promise<string> {
  const s = await env.prisma.site.create({
    data: { primaryDomain: 'static.example.com', backendType: 'static', currentDeployId: 'rcurr01' },
  });
  return s.id;
}

async function seedDeploy(
  siteId: string,
  over: Partial<{ kind: string; ref: string; active: boolean; status: string }> = {},
): Promise<string> {
  const d = await env.prisma.deploy.create({
    data: {
      siteId,
      kind: over.kind ?? 'static',
      ref: over.ref ?? 'rprev02',
      active: over.active ?? false,
      status: over.status ?? 'superseded',
      createdBy: 'ci',
    },
  });
  return d.id;
}

describe('GET /sites/:id/deploys', () => {
  it('requires auth', async () => {
    const id = await staticSite();
    expect((await env.app.inject({ method: 'GET', url: `/api/v1/sites/${id}/deploys` })).statusCode).toBe(401);
  });

  it('returns history newest-first with no secrets', async () => {
    const id = await staticSite();
    await seedDeploy(id, { ref: 'rprev02', active: false });
    await seedDeploy(id, { ref: 'rcurr01', active: true, status: 'active' });
    const res = await env.app.inject({
      method: 'GET', url: `/api/v1/sites/${id}/deploys`, headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json().data as Array<{ ref: string; active: boolean }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.ref).toBe('rcurr01'); // newest first
    // No credential material leaks into the history payload.
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain('dgwt_'); // deploy tokens
    expect(blob).not.toContain('passwordCipher');
    expect(blob).not.toContain('secretKey');
  });
});

describe('POST /sites/:id/deploys/:deployId/rollback — static', () => {
  it('re-points the symlink to the prior release and appends a new active deploy', async () => {
    const id = await staticSite();
    const prior = await seedDeploy(id, { ref: 'rprev02', active: false });
    await seedDeploy(id, { ref: 'rcurr01', active: true, status: 'active' });
    existingReleases.add('rprev02'); // still on disk

    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${id}/deploys/${prior}/rollback`,
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ ref: 'rprev02', active: true, kind: 'static' });

    // The swap targeted the prior release dir (shq-quoted).
    expect(execScripts.some((s) => s.includes("ln -sfn 'releases/rprev02'"))).toBe(true);

    // Site now points at the rolled-to release.
    const site = await env.prisma.site.findUnique({ where: { id } });
    expect(site!.currentDeployId).toBe('rprev02');

    // A new active row was appended (recorded as the operator), prior active flipped off.
    const rows = await env.prisma.deploy.findMany({ where: { siteId: id }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(3);
    const active = rows.filter((r) => r.active);
    expect(active).toHaveLength(1);
    expect(active[0]!.ref).toBe('rprev02');
    expect(active[0]!.createdBy).not.toBe('ci'); // the operator's user id
  });

  it('409s and marks the deploy stale when the release dir was pruned', async () => {
    const id = await staticSite();
    const prior = await seedDeploy(id, { ref: 'rgone03', active: false });
    // existingReleases stays empty → test -d fails.

    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${id}/deploys/${prior}/rollback`,
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('deploy.release_gone');
    // No symlink swap happened.
    expect(execScripts.some((s) => s.startsWith('ln -sfn'))).toBe(false);
    const row = await env.prisma.deploy.findUnique({ where: { id: prior } });
    expect(row!.status).toBe('stale');
  });

  it('rejects a tampered (non-release-id) ref before it reaches the shell (400)', async () => {
    const id = await staticSite();
    const bad = await seedDeploy(id, { ref: 'r../../etc/passwd', active: false });
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${id}/deploys/${bad}/rollback`,
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('deploy.bad_ref');
  });
});

describe('POST /sites/:id/deploys/:deployId/rollback — container', () => {
  it('re-pulls + recreates the prior image and appends a new active deploy', async () => {
    const site = await env.prisma.site.create({
      data: {
        primaryDomain: 'app.example.com',
        backendType: 'container',
        containerName: 'app-test',
        containerPort: 8080,
        imageRef: 'registry.example.com/app:v2',
      },
    });
    const prior = await seedDeploy(site.id, { kind: 'container', ref: 'registry.example.com/app:v1' });

    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${site.id}/deploys/${prior}/rollback`,
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ ref: 'registry.example.com/app:v1', kind: 'container', active: true });
    expect(createdContainers).toHaveLength(1);
    // create-then-swap: new container created under a temp name with the prior image.
    expect(createdContainers[0]).toMatchObject({
      name: 'app-test-deploying',
      Image: 'registry.example.com/app:v1',
    });
    const site2 = await env.prisma.site.findUnique({ where: { id: site.id } });
    expect(site2!.imageRef).toBe('registry.example.com/app:v1');
  });

  it('a failed start leaves the live container + DB untouched (create-then-swap safety)', async () => {
    const site = await env.prisma.site.create({
      data: {
        primaryDomain: 'safe.example.com',
        backendType: 'container',
        containerName: 'app-safe',
        containerPort: 8080,
        imageRef: 'registry.example.com/app:v2',
        currentDeployId: 'cgood01',
      },
    });
    await seedDeploy(site.id, { kind: 'container', ref: 'registry.example.com/app:v2', active: true, status: 'active' });
    const prior = await seedDeploy(site.id, { kind: 'container', ref: 'registry.example.com/app:v1' });

    // The new (rolled-to) image fails to start.
    startSpy.mockRejectedValueOnce(new Error('OCI runtime: exec format error'));

    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${site.id}/deploys/${prior}/rollback`,
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    // Only the temp container was torn down — the live "app-safe" was NOT removed.
    expect(removedContainers).toContain('app-safe-deploying');
    expect(removedContainers).not.toContain('app-safe');
    // DB unchanged: still on v2, no new active row, prior still inactive.
    const after = await env.prisma.site.findUnique({ where: { id: site.id } });
    expect(after!.imageRef).toBe('registry.example.com/app:v2');
    const active = await env.prisma.deploy.findMany({ where: { siteId: site.id, active: true } });
    expect(active).toHaveLength(1);
    expect(active[0]!.ref).toBe('registry.example.com/app:v2');
  });
});

describe('rollback — authorization + ownership', () => {
  it('404s when the deploy belongs to another site', async () => {
    const a = await staticSite();
    const b = await env.prisma.site.create({ data: { primaryDomain: 'b.example.com', backendType: 'static' } });
    const bDeploy = await seedDeploy(b.id, { ref: 'rbbb999', active: true, status: 'active' });
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${a}/deploys/${bDeploy}/rollback`, // wrong site
      headers: bearer(operatorToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('viewer cannot roll back (403)', async () => {
    const id = await staticSite();
    const prior = await seedDeploy(id, { ref: 'rprev02', active: false });
    existingReleases.add('rprev02');
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/sites/${id}/deploys/${prior}/rollback`,
      headers: bearer(viewerToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
