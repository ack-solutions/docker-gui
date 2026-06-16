import { describe, it, expect, vi } from 'vitest';
import { createHttpsProbe, createDohResolveA } from '../site-probe.js';

describe('createHttpsProbe (SSRF guard)', () => {
  function okFetch(status = 200): typeof fetch {
    return vi.fn(async () => ({ status }) as Response) as unknown as typeof fetch;
  }

  it('probes only over HTTPS to the given domain with redirects disabled', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }) as Response) as unknown as typeof fetch;
    const probe = createHttpsProbe({
      resolveA: async () => ['203.0.113.10'],
      fetchImpl,
    });
    const res = await probe('app.example.com');
    expect(res).toEqual({ ok: true, status: 200 });
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://app.example.com/');
    expect(call[1]).toMatchObject({ method: 'HEAD', redirect: 'manual' });
  });

  it('treats a 5xx as not-ok (cert/serving not healthy)', async () => {
    const probe = createHttpsProbe({ resolveA: async () => ['203.0.113.10'], fetchImpl: okFetch(502) });
    expect(await probe('app.example.com')).toEqual({ ok: false, status: 502 });
  });

  it('refuses to connect when the domain resolves to a private/loopback IP', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    for (const ip of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.1', '172.16.0.1']) {
      const probe = createHttpsProbe({ resolveA: async () => [ip], fetchImpl });
      await expect(probe('evil.example.com')).rejects.toThrow(/public address/);
    }
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('refuses when ANY resolved address is non-public (mixed result)', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const probe = createHttpsProbe({
      resolveA: async () => ['203.0.113.10', '127.0.0.1'],
      fetchImpl,
    });
    await expect(probe('app.example.com')).rejects.toThrow(/public address/);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('refuses when the domain has no A record', async () => {
    const probe = createHttpsProbe({ resolveA: async () => [], fetchImpl: okFetch() });
    await expect(probe('app.example.com')).rejects.toThrow(/no public DNS record/);
  });

  it('rejects a malformed domain before resolving', async () => {
    const resolveA = vi.fn(async () => ['203.0.113.10']);
    const probe = createHttpsProbe({ resolveA, fetchImpl: okFetch() });
    await expect(probe('not a domain/../x')).rejects.toThrow(/invalid domain/);
    expect(resolveA).not.toHaveBeenCalled();
  });
});

describe('createDohResolveA', () => {
  it('parses A records (type 1) from a DoH JSON answer', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        Answer: [
          { type: 1, data: '203.0.113.10' },
          { type: 28, data: '2001:db8::1' }, // AAAA — ignored
          { type: 1, data: '203.0.113.11' },
        ],
      }),
    }) as unknown as Response) as unknown as typeof fetch;
    const resolveA = createDohResolveA(fetchImpl);
    expect(await resolveA('app.example.com')).toEqual(['203.0.113.10', '203.0.113.11']);
  });

  it('returns [] on a DoH error rather than throwing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await createDohResolveA(fetchImpl)('app.example.com')).toEqual([]);
  });
});
