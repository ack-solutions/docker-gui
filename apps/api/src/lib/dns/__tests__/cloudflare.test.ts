import { describe, it, expect } from 'vitest';
import { CloudflareClient, CloudflareError, findZoneForDomain } from '../cloudflare.js';
import type { DnsZone } from '../types.js';

function makeFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return ((url: string | URL | Request, init: RequestInit = {}) =>
    Promise.resolve(handler(typeof url === 'string' ? url : url.toString(), init))) as unknown as typeof fetch;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function fail(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CloudflareClient.verifyToken', () => {
  it('returns active status on success', async () => {
    const fetchImpl = makeFetch((url) => {
      expect(url).toContain('/user/tokens/verify');
      return ok({ success: true, result: { id: 'tok', status: 'active' } });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    const r = await cf.verifyToken();
    expect(r.status).toBe('active');
  });

  it('attaches Bearer auth header', async () => {
    const seen: { auth?: string } = {};
    const fetchImpl = makeFetch((_url, init) => {
      const headers = init.headers as Record<string, string>;
      seen.auth = headers['authorization'];
      return ok({ success: true, result: { id: 'tok', status: 'active' } });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    await cf.verifyToken();
    expect(seen.auth).toBe('Bearer cf-token-12345');
  });

  it('throws CloudflareError with cf code on invalid token', async () => {
    const fetchImpl = makeFetch(() =>
      fail(401, { success: false, errors: [{ code: 1000, message: 'Invalid API token' }] }),
    );
    const cf = new CloudflareClient({ apiToken: 'bad-token-xxxx', fetch: fetchImpl });
    await expect(cf.verifyToken()).rejects.toMatchObject({
      name: 'CloudflareError',
      cfCode: 1000,
      statusCode: 401,
    });
  });

  it('throws when API returns success:false at HTTP 200', async () => {
    const fetchImpl = makeFetch(() =>
      ok({ success: false, errors: [{ code: 9999, message: 'wat' }] }),
    );
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    await expect(cf.verifyToken()).rejects.toBeInstanceOf(CloudflareError);
  });
});

describe('CloudflareClient.listZones', () => {
  it('walks pagination', async () => {
    const calls: string[] = [];
    const fetchImpl = makeFetch((url) => {
      calls.push(url);
      if (url.includes('page=1')) {
        return ok({
          success: true,
          result: [
            { id: 'z1', name: 'a.com', account: { id: 'a1', name: 'My Acc' } },
            { id: 'z2', name: 'b.com' },
          ],
          result_info: { page: 1, per_page: 50, total_pages: 2, count: 2 },
        });
      }
      return ok({
        success: true,
        result: [{ id: 'z3', name: 'c.com' }],
        result_info: { page: 2, per_page: 50, total_pages: 2, count: 1 },
      });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    const zones = await cf.listZones();
    expect(zones).toHaveLength(3);
    expect(zones[0]).toMatchObject({ id: 'z1', name: 'a.com', accountName: 'My Acc' });
    expect(zones[1]?.accountName).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it('stops on empty page even if total_pages claims more', async () => {
    let page = 0;
    const fetchImpl = makeFetch(() => {
      page += 1;
      if (page > 1) return ok({ success: true, result: [], result_info: { page, per_page: 50, total_pages: 99, count: 0 } });
      return ok({
        success: true,
        result: [{ id: 'z1', name: 'a.com' }],
        result_info: { page: 1, per_page: 50, total_pages: 99, count: 1 },
      });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    const zones = await cf.listZones();
    expect(zones).toHaveLength(1);
  });
});

describe('CloudflareClient.listRecords', () => {
  it('filters by name and skips unsupported record types', async () => {
    const fetchImpl = makeFetch((url) => {
      expect(url).toContain('/zones/zoneA/dns_records');
      expect(url).toContain('name=app.example.com');
      return ok({
        success: true,
        result: [
          { id: 'r1', zone_id: 'zoneA', type: 'A', name: 'app.example.com', content: '1.2.3.4', ttl: 1, proxied: true },
          { id: 'r2', zone_id: 'zoneA', type: 'SRV', name: 'app.example.com', content: '...', ttl: 1 },
        ],
        result_info: { page: 1, per_page: 100, total_pages: 1, count: 2 },
      });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    const recs = await cf.listRecords('zoneA', 'app.example.com');
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ type: 'A', value: '1.2.3.4', proxied: true });
  });
});

describe('CloudflareClient.createRecord', () => {
  it('POSTs the right body and returns the record', async () => {
    const seen: { url?: string; body?: string } = {};
    const fetchImpl = makeFetch((url, init) => {
      seen.url = url;
      seen.body = init.body as string;
      return ok({
        success: true,
        result: { id: 'newId', zone_id: 'zoneA', type: 'A', name: 'app.example.com', content: '1.2.3.4', ttl: 1, proxied: false },
      });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    const rec = await cf.createRecord('zoneA', { type: 'A', name: 'app.example.com', value: '1.2.3.4', proxied: false });
    expect(rec.id).toBe('newId');
    expect(seen.url).toContain('/zones/zoneA/dns_records');
    const body = JSON.parse(seen.body ?? '{}');
    expect(body).toMatchObject({ type: 'A', name: 'app.example.com', content: '1.2.3.4', proxied: false });
  });
});

describe('CloudflareClient.deleteRecord', () => {
  it('DELETEs the record path', async () => {
    let method = '';
    const fetchImpl = makeFetch((_url, init) => {
      method = init.method ?? '';
      return ok({ success: true, result: { id: 'r1' } });
    });
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl });
    await cf.deleteRecord('zoneA', 'r1');
    expect(method).toBe('DELETE');
  });
});

describe('findZoneForDomain', () => {
  const zones: DnsZone[] = [
    { id: 'z1', name: 'example.com' },
    { id: 'z2', name: 'eu.example.com' },
    { id: 'z3', name: 'unrelated.io' },
  ];

  it('matches apex', () => {
    expect(findZoneForDomain('example.com', zones)?.id).toBe('z1');
  });

  it('matches the longest suffix', () => {
    expect(findZoneForDomain('app.eu.example.com', zones)?.id).toBe('z2');
  });

  it('matches subdomain to apex zone when no specific zone exists', () => {
    expect(findZoneForDomain('api.example.com', zones)?.id).toBe('z1');
  });

  it('rejects non-suffix even if string contains zone name', () => {
    expect(findZoneForDomain('myexample.com', zones)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(findZoneForDomain('nope.test', zones)).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(findZoneForDomain('APP.Example.COM', zones)?.id).toBe('z1');
  });
});

describe('CloudflareClient validation', () => {
  it('refuses missing apiToken', () => {
    expect(() => new CloudflareClient({ apiToken: '' })).toThrow();
  });

  it('aborts the request when timeout fires', async () => {
    // Real timer; fetch respects the AbortSignal so we resolve when aborted.
    const fetchImpl = ((_url: string, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        const sig = init.signal as AbortSignal | undefined;
        if (sig) {
          sig.addEventListener('abort', () => {
            const err = new Error('aborted') as Error & { name: string };
            err.name = 'AbortError';
            reject(err);
          });
        }
      })) as unknown as typeof fetch;
    const cf = new CloudflareClient({ apiToken: 'cf-token-12345', fetch: fetchImpl, timeoutMs: 5 });
    await expect(cf.verifyToken()).rejects.toBeInstanceOf(CloudflareError);
  });
});
