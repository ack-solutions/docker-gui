import { describe, it, expect } from 'vitest';
import { PublicIpService, isPublicIpv4 } from '../public-ip.service.js';

describe('isPublicIpv4', () => {
  it('accepts routable public addresses', () => {
    expect(isPublicIpv4('203.0.113.7')).toBe(true);
    expect(isPublicIpv4('8.8.8.8')).toBe(true);
    expect(isPublicIpv4('  1.1.1.1  ')).toBe(true);
  });

  it('rejects private / loopback / link-local / CGNAT / malformed', () => {
    expect(isPublicIpv4('10.0.0.5')).toBe(false);
    expect(isPublicIpv4('192.168.1.10')).toBe(false);
    expect(isPublicIpv4('172.16.4.4')).toBe(false);
    expect(isPublicIpv4('127.0.0.1')).toBe(false);
    expect(isPublicIpv4('169.254.1.1')).toBe(false);
    expect(isPublicIpv4('100.64.0.1')).toBe(false); // CGNAT
    expect(isPublicIpv4('224.0.0.1')).toBe(false); // multicast
    expect(isPublicIpv4('999.1.1.1')).toBe(false);
    expect(isPublicIpv4('not.an.ip')).toBe(false);
    expect(isPublicIpv4('')).toBe(false);
  });
});

/** Fetch stub serving a scripted body/status per URL. */
function stubFetch(byUrl: Record<string, { status?: number; body: string } | Error>) {
  return (async (input: string | URL) => {
    const url = String(input);
    const entry = byUrl[url];
    if (entry === undefined) throw new Error(`unexpected url ${url}`);
    if (entry instanceof Error) throw entry;
    const status = entry.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => entry.body,
    } as Response;
  }) as unknown as typeof fetch;
}

const A = 'https://a.test/ip';
const B = 'https://b.test/ip';

describe('PublicIpService', () => {
  it('returns the first source that yields a public IPv4', async () => {
    const svc = new PublicIpService({ sources: [A, B], fetchImpl: stubFetch({ [A]: { body: '203.0.113.9\n' }, [B]: { body: '8.8.8.8' } }) });
    const r = await svc.refresh();
    expect(r.current).toBe('203.0.113.9');
    expect(r.changed).toBe(false); // first detection is not a "change"
    expect(svc.current().ipv4).toBe('203.0.113.9');
  });

  it('falls through past a private/garbage source to a valid one', async () => {
    const svc = new PublicIpService({ sources: [A, B], fetchImpl: stubFetch({ [A]: { body: '192.168.0.1' }, [B]: { body: '203.0.113.50' } }) });
    expect((await svc.refresh()).current).toBe('203.0.113.50');
  });

  it('flags changed only when a known IP moves to a new value', async () => {
    let body = '203.0.113.1';
    const fetchImpl = stubFetch({ [A]: { get body() { return body; } } as { body: string } });
    const svc = new PublicIpService({ sources: [A], fetchImpl });
    await svc.refresh(); // initial → not changed
    const same = await svc.refresh();
    expect(same.changed).toBe(false);
    body = '203.0.113.2';
    const moved = await svc.refresh();
    expect(moved).toEqual({ changed: true, previous: '203.0.113.1', current: '203.0.113.2' });
  });

  it('keeps the last good IP when every source fails', async () => {
    let fail = false;
    const fetchImpl = stubFetch({ [A]: { get body() { if (fail) throw new Error('down'); return '203.0.113.3'; } } as { body: string } });
    const svc = new PublicIpService({ sources: [A], fetchImpl });
    await svc.refresh();
    fail = true;
    const r = await svc.refresh();
    expect(r.current).toBe('203.0.113.3');
    expect(r.changed).toBe(false);
    expect(svc.current().ipv4).toBe('203.0.113.3');
  });
});
