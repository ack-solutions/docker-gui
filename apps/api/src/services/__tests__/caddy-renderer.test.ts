import { describe, it, expect } from 'vitest';
import type { Site } from '@prisma/client';
import { render } from '../caddy-renderer.js';

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: 'id-1',
    primaryDomain: 'example.com',
    aliasDomains: '[]',
    upstreamUrl: 'web:80',
    enableHttps: true,
    forceHttps: true,
    letsEncryptEmail: null,
    enabled: true,
    status: 'draft',
    lastError: null,
    lastAppliedAt: null,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Site;
}

describe('render', () => {
  it('produces an empty server set when no sites are enabled', () => {
    const config = render([]);
    expect(config.admin.listen).toBe(':2019');
    expect(config.apps.http.servers).toEqual({});
    expect(config.apps.tls).toBeUndefined();
  });

  it('renders one site as a single HTTPS route', () => {
    const config = render([makeSite()]);
    expect(config.apps.http.servers['https']).toBeDefined();
    const server = config.apps.http.servers['https']!;
    expect(server.listen).toEqual([':443']);
    expect(server.routes).toHaveLength(1);
    const route = server.routes[0]!;
    expect(route.match).toEqual([{ host: ['example.com'] }]);
    expect(route.handle[0]).toMatchObject({
      handler: 'reverse_proxy',
      upstreams: [{ dial: 'web:80' }],
    });
  });

  it('includes alias domains in the host match', () => {
    const config = render([
      makeSite({ aliasDomains: '["www.example.com", "alt.example.com"]' }),
    ]);
    const route = config.apps.http.servers['https']!.routes[0]!;
    expect(route.match[0]!.host).toEqual(['example.com', 'www.example.com', 'alt.example.com']);
  });

  it('dedupes duplicate domains', () => {
    const config = render([makeSite({ aliasDomains: '["example.com", "example.com"]' })]);
    expect(config.apps.http.servers['https']!.routes[0]!.match[0]!.host).toEqual(['example.com']);
  });

  it('skips disabled sites', () => {
    const config = render([makeSite({ enabled: false })]);
    expect(config.apps.http.servers).toEqual({});
  });

  it('puts non-HTTPS sites on the http server', () => {
    const config = render([makeSite({ enableHttps: false, forceHttps: false })]);
    expect(config.apps.http.servers['http']).toBeDefined();
    expect(config.apps.http.servers['https']).toBeUndefined();
    const httpServer = config.apps.http.servers['http']!;
    expect(httpServer.listen).toEqual([':80']);
    expect(httpServer.automatic_https?.disable_redirects).toBe(true);
  });

  it('emits an HTTP server (for redirects) when at least one site forces HTTPS', () => {
    const config = render([makeSite({ enableHttps: true, forceHttps: true })]);
    expect(config.apps.http.servers['http']).toBeDefined();
    expect(config.apps.http.servers['http']!.automatic_https?.disable_redirects).toBe(false);
  });

  it('attaches per-site Let\'s Encrypt email when set', () => {
    const config = render([
      makeSite({ letsEncryptEmail: 'admin@example.com' }),
    ]);
    expect(config.apps.tls?.automation?.policies?.[0]).toMatchObject({
      subjects: ['example.com'],
      issuers: [{ module: 'acme', email: 'admin@example.com' }],
    });
  });

  it('falls back to default LE email', () => {
    const config = render([makeSite()], { defaultLetsEncryptEmail: 'ops@example.com' });
    expect(config.apps.tls?.automation?.policies?.[0]?.issuers?.[0]?.email).toBe('ops@example.com');
  });

  it('strips http:// scheme from upstream', () => {
    const config = render([makeSite({ upstreamUrl: 'http://internal:8080' })]);
    const handle = config.apps.http.servers['https']!.routes[0]!.handle[0]!;
    expect(handle).toMatchObject({ upstreams: [{ dial: 'internal:8080' }] });
  });

  it('handles multiple sites with mixed config', () => {
    const config = render([
      makeSite({ id: 'a', primaryDomain: 'a.com' }),
      makeSite({ id: 'b', primaryDomain: 'b.com', enableHttps: false, forceHttps: false }),
      makeSite({ id: 'c', primaryDomain: 'c.com', enabled: false }),
    ]);
    const httpsRoutes = config.apps.http.servers['https']?.routes ?? [];
    const httpRoutes = config.apps.http.servers['http']?.routes ?? [];
    expect(httpsRoutes.flatMap((r) => r.match[0]!.host)).toEqual(['a.com']);
    expect(httpRoutes.flatMap((r) => r.match[0]!.host)).toEqual(['b.com']);
  });

  it('respects custom listen ports', () => {
    const config = render([makeSite()], { httpsPorts: [':8443'], httpPorts: [':8080'] });
    expect(config.apps.http.servers['https']!.listen).toEqual([':8443']);
    expect(config.apps.http.servers['http']!.listen).toEqual([':8080']);
  });

  it('tolerates corrupt aliasDomains JSON', () => {
    const config = render([makeSite({ aliasDomains: '{not json}' })]);
    expect(config.apps.http.servers['https']!.routes[0]!.match[0]!.host).toEqual(['example.com']);
  });
});
