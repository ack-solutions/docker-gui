import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dbProxyRoutes } from '../db-proxy.routes.js';
import { signExplorerToken } from '../../lib/explorer-token.js';

const SECRET = 'proxy-test-secret-which-is-quite-long-1234567890';
const CID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// Fake sidecar upstream: echoes the path + method it received.
const received: Array<{ url: string; method: string }> = [];
let upstream: Server;
let upstreamAddr: string;

let app: FastifyInstance;
let upstreamReachable = true;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    received.push({ url: req.url ?? '', method: req.method ?? '' });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ gotPath: req.url }));
  });
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
  const a = upstream.address() as AddressInfo;
  upstreamAddr = `127.0.0.1:${a.port}`;

  app = Fastify();
  await app.register(dbProxyRoutes, {
    secret: SECRET,
    getUpstream: async (id) => (id === CID && upstreamReachable ? upstreamAddr : null),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((r) => upstream.close(() => r()));
});

describe('db-explorer proxy auth', () => {
  it('rejects a request with no token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/db-proxy/${CID}/` });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/db-proxy/${CID}/?__dgxt=garbage` });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token minted for a DIFFERENT connection (401)', async () => {
    const wrong = signExplorerToken('99999999-0000-0000-0000-000000000000', SECRET);
    const res = await app.inject({ method: 'GET', url: `/db-proxy/${CID}/?__dgxt=${wrong}` });
    expect(res.statusCode).toBe(401);
  });

  it('bootstraps with a query token: sets a path-scoped cookie + forwards', async () => {
    received.length = 0;
    const token = signExplorerToken(CID, SECRET);
    const res = await app.inject({ method: 'GET', url: `/db-proxy/${CID}/static/app.js?__dgxt=${token}` });
    expect(res.statusCode).toBe(200);
    // Cookie set, scoped to this connection's proxy path, HttpOnly.
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toContain('dgx_session=');
    expect(setCookie).toContain(`Path=/db-proxy/${CID}/`);
    expect(setCookie).toContain('HttpOnly');
    // Forwarded to the sidecar at the same path, WITHOUT our token in the query.
    expect(received).toHaveLength(1);
    expect(received[0]!.url).toBe(`/db-proxy/${CID}/static/app.js`);
  });

  it('authenticates subsequent requests with the cookie (no token in URL)', async () => {
    received.length = 0;
    const token = signExplorerToken(CID, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: `/db-proxy/${CID}/css/main.css`,
      headers: { cookie: `dgx_session=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(received[0]!.url).toBe(`/db-proxy/${CID}/css/main.css`);
  });

  it('never forwards a path-traversal escape to the sidecar', async () => {
    const token = signExplorerToken(CID, SECRET);
    // Various traversal shapes — some are normalized away by the router (404),
    // the ones that reach the handler within the wildcard are rejected (400).
    // The invariant: NONE are forwarded to an escaped path.
    for (const path of [
      `/db-proxy/${CID}/../../evil`,
      `/db-proxy/${CID}/a/../../../evil`,
      `/db-proxy/${CID}/x/..%2f..%2fevil`,
    ]) {
      received.length = 0;
      const res = await app.inject({ method: 'GET', url: `${path}?__dgxt=${token}` });
      expect([400, 404]).toContain(res.statusCode);
      // If anything was forwarded, it must stay within this connection's prefix.
      for (const r of received) expect(r.url.startsWith(`/db-proxy/${CID}/`)).toBe(true);
    }
  });

  it('returns 502 when the sidecar is not running', async () => {
    upstreamReachable = false;
    const token = signExplorerToken(CID, SECRET);
    const res = await app.inject({ method: 'GET', url: `/db-proxy/${CID}/?__dgxt=${token}` });
    expect(res.statusCode).toBe(502);
    upstreamReachable = true;
  });
});
