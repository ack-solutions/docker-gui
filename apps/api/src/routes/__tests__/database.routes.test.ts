import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

/**
 * Database GUI — discovery + connection profiles, end to end through the real
 * Fastify app + real Prisma. The TCP reachability probe is injected (no real
 * sockets); discovery uses a fake docker that lists DB + non-DB containers.
 */

function dbDocker(): Docker {
  const containers = [
    {
      Id: 'pg111111111111',
      Names: ['/app-postgres'],
      Image: 'postgres:16',
      ImageID: 'sha256:pg',
      Command: 'docker-entrypoint.sh postgres',
      State: 'running',
      Status: 'Up 2 hours',
      Created: 1_700_000_000,
      Ports: [{ PrivatePort: 5432, Type: 'tcp' }],
      Labels: {},
    },
    {
      Id: 'my2222222222',
      Names: ['/analytics-mysql'],
      Image: 'mysql:8',
      ImageID: 'sha256:my',
      Command: 'docker-entrypoint.sh mysqld',
      State: 'running',
      Status: 'Up 1 hour',
      Created: 1_700_000_100,
      Ports: [{ PrivatePort: 3306, Type: 'tcp' }],
      Labels: {},
    },
    {
      Id: 'nginx33333333',
      Names: ['/web'],
      Image: 'nginx:alpine',
      ImageID: 'sha256:nx',
      Command: 'nginx',
      State: 'running',
      Status: 'Up 3 hours',
      Created: 1_700_000_200,
      Ports: [{ PrivatePort: 80, Type: 'tcp' }],
      Labels: {},
    },
  ];
  return {
    ping: () => Promise.resolve('OK'),
    version: () => Promise.resolve({ Version: 'test', ApiVersion: '1.43', Os: 'linux', Arch: 'amd64' }),
    listContainers: () => Promise.resolve(containers),
    listImages: () => Promise.resolve([]),
    listVolumes: () => Promise.resolve({ Volumes: [] }),
    listNetworks: () => Promise.resolve([]),
  } as unknown as Docker;
}

let env: TestEnv;
let operatorToken: string;
let viewerToken: string;

beforeAll(async () => {
  env = await buildTestEnv({
    docker: dbDocker(),
    databaseOptions: { tcpProbe: async () => {} }, // reachable by default
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
  await env.prisma.databaseConnection.deleteMany();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('discovery', () => {
  it('finds DB containers and skips non-DB ones', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/databases/discover', headers: bearer(viewerToken) });
    expect(res.statusCode).toBe(200);
    const found = res.json() as Array<{ engine: string; suggestedHost: string; suggestedPort: number; alreadyConnected: boolean }>;
    expect(found).toHaveLength(2);
    const pg = found.find((d) => d.engine === 'postgres');
    expect(pg?.suggestedHost).toBe('app-postgres');
    expect(pg?.suggestedPort).toBe(5432);
    const my = found.find((d) => d.engine === 'mysql');
    expect(my?.suggestedHost).toBe('analytics-mysql');
    expect(my?.suggestedPort).toBe(3306);
    expect(found.every((d) => d.alreadyConnected === false)).toBe(true);
  });

  it('marks a discovered DB as alreadyConnected once a profile references it', async () => {
    await env.app.inject({
      method: 'POST',
      url: '/api/v1/databases/connections',
      headers: auth(operatorToken),
      payload: {
        name: 'pg', engine: 'postgres', host: 'app-postgres', username: 'postgres',
        password: 'pw', containerId: 'pg111111111111',
      },
    });
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/databases/discover', headers: bearer(operatorToken) });
    const pg = (res.json() as Array<{ engine: string; alreadyConnected: boolean }>).find((d) => d.engine === 'postgres');
    expect(pg?.alreadyConnected).toBe(true);
  });
});

describe('connections', () => {
  it('creates a connection with default port + verifies reachability', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/databases/connections',
      headers: auth(operatorToken),
      payload: { name: 'pg', engine: 'postgres', host: 'app-postgres', username: 'postgres', password: 'secret-pw' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.port).toBe(5432); // engine default
    expect(body.verified).toBe(true);
    expect(body.hasPassword).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-pw');
    const row = await env.prisma.databaseConnection.findFirst({ where: { name: 'pg' } });
    expect(row?.passwordCipher).toBeTruthy();
    expect(row?.passwordCipher).not.toContain('secret-pw');
  });

  it('records lastError when the DB is unreachable', async () => {
    const localEnv = await buildTestEnv({
      databaseOptions: { tcpProbe: async () => { throw new Error('ECONNREFUSED'); } },
    });
    try {
      await localEnv.app.inject({
        method: 'POST', url: '/api/v1/setup/bootstrap',
        headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
        payload: { email: 'o@example.com', password: 'OwnerPass1', name: 'O' },
      });
      const lr = await localEnv.app.inject({
        method: 'POST', url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'o@example.com', password: 'OwnerPass1' },
      });
      const tok = lr.json().data.accessToken as string;
      const res = await localEnv.app.inject({
        method: 'POST', url: '/api/v1/databases/connections',
        headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
        payload: { name: 'down', engine: 'mysql', host: 'nope', username: 'root' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().verified).toBe(false);
      expect(res.json().lastError).toContain('ECONNREFUSED');
      expect(res.json().port).toBe(3306);
    } finally {
      await localEnv.cleanup();
    }
  });

  it('rejects a duplicate name (409)', async () => {
    const mk = () => env.app.inject({
      method: 'POST', url: '/api/v1/databases/connections', headers: auth(operatorToken),
      payload: { name: 'dup', engine: 'postgres', host: 'app-postgres', username: 'u' },
    });
    expect((await mk()).statusCode).toBe(201);
    expect((await mk()).statusCode).toBe(409);
  });

  it('rejects an invalid host (400)', async () => {
    const res = await env.app.inject({
      method: 'POST', url: '/api/v1/databases/connections', headers: auth(operatorToken),
      payload: { name: 'bad', engine: 'postgres', host: 'http://evil/path', username: 'u' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH changing host resets verified and re-probes on verify', async () => {
    const created = await env.app.inject({
      method: 'POST', url: '/api/v1/databases/connections', headers: auth(operatorToken),
      payload: { name: 'movable', engine: 'postgres', host: 'app-postgres', username: 'u' },
    });
    const id = created.json().id as string;
    const patched = await env.app.inject({
      method: 'PATCH', url: `/api/v1/databases/connections/${id}`, headers: auth(operatorToken),
      payload: { host: 'new-host' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().verified).toBe(false);
    expect(patched.json().host).toBe('new-host');
    const v = await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${id}/verify`, headers: bearer(operatorToken),
    });
    expect(v.json().verified).toBe(true);
  });
});

describe('RBAC', () => {
  it('viewer can discover + read but cannot create (403)', async () => {
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/databases/connections', headers: bearer(viewerToken) })).statusCode).toBe(200);
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/databases/discover', headers: bearer(viewerToken) })).statusCode).toBe(200);
    const create = await env.app.inject({
      method: 'POST', url: '/api/v1/databases/connections', headers: auth(viewerToken),
      payload: { name: 'x', engine: 'postgres', host: 'app-postgres', username: 'u' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('requires auth on every route', async () => {
    for (const [method, url] of [
      ['GET', '/api/v1/databases/discover'],
      ['GET', '/api/v1/databases/connections'],
      ['POST', '/api/v1/databases/connections'],
    ] as const) {
      const res = await env.app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
