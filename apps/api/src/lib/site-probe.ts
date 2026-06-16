import { isPublicIpv4 } from '../services/public-ip.service.js';

export interface CertProbeResult {
  ok: boolean;
  status: number;
}

export interface HttpsProbeDeps {
  /** Resolve a hostname's A records (IPv4 strings). Injected for tests. */
  resolveA: (name: string) => Promise<string[]>;
  /** fetch impl (injected for tests). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DOMAIN_RE = /^[a-zA-Z0-9._-]{1,253}$/;

/**
 * Build an SSRF-guarded HTTPS probe for a site's OWN domain.
 *
 * It resolves the domain via DoH and refuses to connect unless EVERY resolved
 * address is a public IPv4 — blocking a domain pointed at loopback / private /
 * link-local / CGNAT / cloud-metadata ranges. It then issues a HEAD with
 * redirects disabled and a short timeout, and reduces the response to
 * {ok, status} (ok = the TLS handshake succeeded AND status < 500). It only
 * ever targets the supplied domain (the site's stored primaryDomain), never an
 * arbitrary URL, and never follows a redirect to another host.
 *
 * Best-effort caveat: fetch() does its own DNS resolution, so the DoH pre-check
 * is advisory against a deliberate DNS-rebind; it reliably blocks the common
 * misconfiguration (a domain resolving to an internal IP) and the request is
 * HEAD-only with the body discarded.
 */
export function createHttpsProbe(
  deps: HttpsProbeDeps,
): (domain: string) => Promise<CertProbeResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5000;
  return async (domain: string): Promise<CertProbeResult> => {
    if (!DOMAIN_RE.test(domain)) throw new Error('invalid domain');
    const ips = await deps.resolveA(domain);
    if (ips.length === 0) throw new Error('no public DNS record');
    if (!ips.every((ip) => isPublicIpv4(ip))) {
      throw new Error('domain does not resolve to a public address');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(`https://${domain}/`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
      });
      return { ok: res.status < 500, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Cloudflare DoH A-record resolver. Returns IPv4 strings (empty on failure). */
export function createDohResolveA(
  fetchImpl: typeof fetch = fetch,
): (name: string) => Promise<string[]> {
  return async (name: string): Promise<string[]> => {
    if (!DOMAIN_RE.test(name)) return [];
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetchImpl(url, {
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
      // type 1 = A record
      return (body.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data.trim());
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };
}
