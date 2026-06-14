import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type Docker from 'dockerode';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

/**
 * DB-explorer sidecar lifecycle, end to end through the real Fastify app +
 * real Prisma, against a STATEFUL fake docker that tracks created containers
 * and honors the db-explorer label filter. No real Docker is used.
 */

interface FakeContainer {
  Id: string;
  Image: string;
  State: string;
  Labels: Record<string, string>;
  Env: string[];
}

const dockerState = { containers: [] as FakeContainer[], nextId: 1 };

function fakeDocker(): Docker {
  return {
    ping: () => Promise.resolve('OK'),
    version: () => Promise.resolve({ Version: 'test', ApiVersion: '1.43' }),
    listContainers: (opts?: { filters?: { label?: string[] } }) => {
      let list = dockerState.containers;
      const labelFilters = opts?.filters?.label ?? [];
      for (const lf of labelFilters) {
        const [k, v] = lf.split('=');
        list = list.filter((c) => c.Labels[k!] === v);
      }
      return Promise.resolve(list.map((c) => ({ Id: c.Id, Image: c.Image, State: c.State, Labels: c.Labels })));
    },
    createContainer: (spec: {
      name: string;
      Image: string;
      Env: string[];
      Labels: Record<string, string>;
    }) => {
      const container: FakeContainer = {
        Id: `ctr-${dockerState.nextId++}`,
        Image: spec.Image,
        State: 'created',
        Labels: spec.Labels,
        Env: spec.Env,
      };
      dockerState.containers.push(container);
      return Promise.resolve({
        id: container.Id,
        start: () => {
          container.State = 'running';
          return Promise.resolve();
        },
      });
    },
    getContainer: (id: string) => ({
      stop: () => {
        const c = dockerState.containers.find((x) => x.Id === id);
        if (c) c.State = 'exited';
        return Promise.resolve();
      },
      remove: () => {
        dockerState.containers = dockerState.containers.filter((x) => x.Id !== id);
        return Promise.resolve();
      },
    }),
  } as unknown as Docker;
}

let env: TestEnv;
let operatorToken: string;
let viewerToken: string;

function auth(t: string) {
  return { authorization: `Bearer ${t}` };
}

async function makeConn(engine: string, name: string): Promise<string> {
  const res = await env.app.inject({
    method: 'POST', url: '/api/v1/databases/connections',
    headers: { authorization: `Bearer ${operatorToken}`, 'content-type': 'application/json' },
    payload: { name, engine, host: `${name}-host`, username: 'u', password: 'pw', database: 'appdb' },
  });
  return res.json().id as string;
}

beforeAll(async () => {
  env = await buildTestEnv({
    docker: fakeDocker(),
    databaseOptions: { tcpProbe: async () => {} },
  });
  await env.app.inject({
    method: 'POST', url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
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
  dockerState.containers = [];
  await env.prisma.databaseConnection.deleteMany();
});

describe('explorer lifecycle', () => {
  it('launches pgweb for a postgres connection', async () => {
    const id = await makeConn('postgres', 'pg');
    const res = await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken),
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().kind).toBe('pgweb');
    expect(res.json().status).toBe('running');
    expect(res.json().upstream).toMatch(/:8081$/);
    // One pgweb container was created, with the password in DATABASE_URL env.
    expect(dockerState.containers).toHaveLength(1);
    expect(dockerState.containers[0]!.Image).toContain('pgweb');
    expect(dockerState.containers[0]!.Env.join(' ')).toContain('postgres://');
  });

  it('launches phpMyAdmin for a mysql connection', async () => {
    const id = await makeConn('mysql', 'my');
    const res = await env.app.inject({
      method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken),
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().kind).toBe('phpmyadmin');
    expect(res.json().upstream).toMatch(/:80$/);
    expect(dockerState.containers[0]!.Env).toContain('PMA_HOST=my-host');
  });

  it('reuses the running sidecar instead of creating a second', async () => {
    const id = await makeConn('postgres', 'pg');
    await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    expect(dockerState.containers).toHaveLength(1);
  });

  it('status reports stopped before launch and running after', async () => {
    const id = await makeConn('postgres', 'pg');
    const before = await env.app.inject({ method: 'GET', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    expect(before.json().status).toBe('stopped');
    await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    const after = await env.app.inject({ method: 'GET', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    expect(after.json().status).toBe('running');
  });

  it('stop removes the sidecar; list reflects it', async () => {
    const id = await makeConn('postgres', 'pg');
    await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/databases/explorers', headers: auth(operatorToken) })).json().length).toBe(1);

    const del = await env.app.inject({ method: 'DELETE', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(operatorToken) });
    expect(del.statusCode).toBe(204);
    expect(dockerState.containers).toHaveLength(0);
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/databases/explorers', headers: auth(operatorToken) })).json().length).toBe(0);
  });

  it('404s for an unknown connection', async () => {
    const res = await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/ghost/explorer`, headers: auth(operatorToken) });
    expect(res.statusCode).toBe(404);
  });
});

describe('RBAC', () => {
  it('viewer can read status but cannot launch (403) or stop (403)', async () => {
    const id = await makeConn('postgres', 'pg');
    expect((await env.app.inject({ method: 'GET', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(viewerToken) })).statusCode).toBe(200);
    expect((await env.app.inject({ method: 'POST', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(viewerToken) })).statusCode).toBe(403);
    expect((await env.app.inject({ method: 'DELETE', url: `/api/v1/databases/connections/${id}/explorer`, headers: auth(viewerToken) })).statusCode).toBe(403);
  });

  it('requires auth', async () => {
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/databases/explorers' })).statusCode).toBe(401);
  });
});
