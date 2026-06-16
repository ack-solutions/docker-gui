import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { SitesService, type SitesServiceOptions } from '../sites.service.js';
import { CaddyClient } from '../../lib/caddy.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Unit tests for SitesService.certStatus. Only external boundaries are faked
 * (Prisma row lookup, the Caddy client's getConfig, the DoH resolver, and the
 * HTTPS prober) — no mocking of SitesService itself.
 */

type SiteRow = {
  id: string;
  primaryDomain: string;
  aliasDomains: string;
  enableHttps: boolean;
};

function makeSite(over: Partial<SiteRow> = {}): SiteRow {
  return {
    id: 'site1',
    primaryDomain: 'app.example.com',
    aliasDomains: '[]',
    enableHttps: true,
    ...over,
  };
}

function fakeDb(site: SiteRow | null): PrismaClient {
  return { site: { findUnique: async () => site } } as unknown as PrismaClient;
}

/** A Caddy config whose https server matches the given hosts. */
function caddyWith(hosts: string[]): CaddyClient {
  return {
    getConfig: async () => ({
      apps: { http: { servers: { https: { routes: [{ match: [{ host: hosts }] }] } } } },
    }),
  } as unknown as CaddyClient;
}

function build(site: SiteRow | null, caddy: CaddyClient | null, opts: SitesServiceOptions = {}) {
  return new SitesService(fakeDb(site), caddy, opts);
}

describe('SitesService.certStatus', () => {
  it('throws NotFound for an unknown site', async () => {
    const svc = build(null, null);
    await expect(svc.certStatus('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('configured + probe ok → active / servedOk', async () => {
    const svc = build(makeSite(), caddyWith(['app.example.com']), {
      certProbe: async () => ({ ok: true, status: 200 }),
    });
    const s = await svc.certStatus('site1');
    expect(s).toMatchObject({ configured: true, certStatus: 'active', servedOk: true, httpStatus: 200 });
    expect(s.lastCheckedAt).toBeTruthy();
  });

  it('configured but probe throws (TLS/unreachable) → pending, not error', async () => {
    const svc = build(makeSite(), caddyWith(['app.example.com']), {
      certProbe: async () => {
        throw new Error('TLS handshake failed');
      },
    });
    const s = await svc.certStatus('site1');
    expect(s).toMatchObject({ configured: true, certStatus: 'pending', servedOk: false });
    expect(s.reason).toBeTruthy();
  });

  it('not in the live config → error', async () => {
    const svc = build(makeSite(), caddyWith(['other.example.com']), {
      certProbe: async () => ({ ok: true, status: 200 }),
    });
    const s = await svc.certStatus('site1');
    expect(s).toMatchObject({ configured: false, certStatus: 'error', servedOk: false });
  });

  it('caddy not configured → error', async () => {
    const svc = build(makeSite(), null);
    const s = await svc.certStatus('site1');
    expect(s).toMatchObject({ configured: false, certStatus: 'error' });
  });

  it('HTTP-only site → active with an "HTTP only" reason and no probe', async () => {
    let probed = false;
    const svc = build(makeSite({ enableHttps: false }), caddyWith(['app.example.com']), {
      certProbe: async () => {
        probed = true;
        return { ok: true, status: 200 };
      },
    });
    const s = await svc.certStatus('site1');
    expect(s).toMatchObject({ certStatus: 'active', reason: 'HTTP only' });
    expect(probed).toBe(false);
  });

  it('dnsOk reflects whether the A record matches this server, undefined when unknown', async () => {
    const probe = async () => ({ ok: true, status: 200 });

    const match = build(makeSite(), caddyWith(['app.example.com']), {
      certProbe: probe,
      getPublicIp: () => '203.0.113.10',
      resolveA: async () => ['203.0.113.10'],
    });
    expect((await match.certStatus('site1')).dnsOk).toBe(true);

    const mismatch = build(makeSite(), caddyWith(['app.example.com']), {
      certProbe: probe,
      getPublicIp: () => '203.0.113.10',
      resolveA: async () => ['198.51.100.7'],
    });
    expect((await mismatch.certStatus('site1')).dnsOk).toBe(false);

    const unknown = build(makeSite(), caddyWith(['app.example.com']), { certProbe: probe });
    expect((await unknown.certStatus('site1')).dnsOk).toBeUndefined();
  });

  it('never throws past NotFound even if getConfig fails', async () => {
    const brokenCaddy = { getConfig: async () => { throw new Error('boom'); } } as unknown as CaddyClient;
    const svc = build(makeSite(), brokenCaddy, { certProbe: async () => ({ ok: true, status: 200 }) });
    const s = await svc.certStatus('site1');
    expect(s.configured).toBe(false);
    expect(s.certStatus).toBe('error');
  });
});
