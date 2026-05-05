import { describe, it, expect, vi } from 'vitest';
import { CaddyClient, CaddyError } from '../caddy.js';

interface MockResponse {
  status: number;
  body?: string;
}

function mockFetch(responses: Record<string, MockResponse | Error>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const path = urlStr.replace(/^https?:\/\/[^/]+/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const stub = responses[key];
    if (!stub) throw new Error(`unexpected request: ${key}`);
    if (stub instanceof Error) throw stub;
    return new Response(stub.body ?? '', { status: stub.status });
  });
}

describe('CaddyClient.loadConfig', () => {
  it('POSTs JSON to /load and resolves on 200', async () => {
    const fetchMock = mockFetch({ 'POST /load': { status: 200, body: '' } });
    const client = new CaddyClient({ adminUrl: 'http://caddy:2019', fetch: fetchMock });
    await client.loadConfig({ admin: { listen: ':2019' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const callInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(callInit.method).toBe('POST');
    expect(callInit.body).toBe('{"admin":{"listen":":2019"}}');
    expect((callInit.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('throws CaddyError with status code on 400', async () => {
    const fetchMock = mockFetch({
      'POST /load': { status: 400, body: '{"error":"bad config"}' },
    });
    const client = new CaddyClient({ adminUrl: 'http://caddy:2019', fetch: fetchMock });
    const promise = client.loadConfig({});
    await expect(promise).rejects.toBeInstanceOf(CaddyError);
    await expect(promise).rejects.toMatchObject({ statusCode: 400, body: { error: 'bad config' } });
  });

  it('strips trailing slash from adminUrl', async () => {
    const fetchMock = mockFetch({ 'POST /load': { status: 200 } });
    const client = new CaddyClient({ adminUrl: 'http://caddy:2019/', fetch: fetchMock });
    await client.loadConfig({});
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://caddy:2019/load');
  });
});

describe('CaddyClient.getConfig', () => {
  it('returns parsed JSON from /config/', async () => {
    const fetchMock = mockFetch({
      'GET /config/': { status: 200, body: '{"apps":{}}' },
    });
    const client = new CaddyClient({ adminUrl: 'http://x:2019', fetch: fetchMock });
    expect(await client.getConfig()).toEqual({ apps: {} });
  });

  it('returns plain text when body is not JSON', async () => {
    const fetchMock = mockFetch({ 'GET /config/': { status: 200, body: 'not json' } });
    const client = new CaddyClient({ adminUrl: 'http://x:2019', fetch: fetchMock });
    expect(await client.getConfig()).toBe('not json');
  });
});

describe('CaddyClient.ping', () => {
  it('returns true on 200', async () => {
    const fetchMock = mockFetch({ 'GET /': { status: 200, body: 'Caddy is running' } });
    const client = new CaddyClient({ adminUrl: 'http://x:2019', fetch: fetchMock });
    expect(await client.ping()).toBe(true);
  });

  it('returns false on network error', async () => {
    const fetchMock = mockFetch({ 'GET /': new Error('ECONNREFUSED') });
    const client = new CaddyClient({ adminUrl: 'http://x:2019', fetch: fetchMock });
    expect(await client.ping()).toBe(false);
  });

  it('returns false on non-2xx', async () => {
    const fetchMock = mockFetch({ 'GET /': { status: 503 } });
    const client = new CaddyClient({ adminUrl: 'http://x:2019', fetch: fetchMock });
    expect(await client.ping()).toBe(false);
  });
});
