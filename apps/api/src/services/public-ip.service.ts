/**
 * Detects this server's public IPv4 by asking external "echo" services, so DNS
 * recommendations can auto-fill the A-record target and we can react when the
 * IP changes (dynamic-DNS resync / alerting is layered on top of `refresh()`).
 *
 * Detection is best-effort: each source is tried in order with a short timeout;
 * the first response that parses as a *public* IPv4 wins. A configured
 * `system.public_ip` remains the fallback when detection fails (offline,
 * egress blocked).
 */

const DEFAULT_SOURCES = [
  'https://checkip.amazonaws.com',
  'https://api.ipify.org',
  'https://ifconfig.me/ip',
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** True only for routable, non-private/loopback/link-local/CGNAT IPv4. */
export function isPublicIpv4(value: string): boolean {
  const m = IPV4_RE.exec(value.trim());
  if (!m) return false;
  const octets = m.slice(1, 5).map((s) => Number(s));
  if (octets.some((o) => o > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return false; // this-net / private / loopback
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT (RFC 6598)
  if (a >= 224) return false; // multicast / reserved
  return true;
}

export interface PublicIpRefresh {
  /** True only when a previously-known IP changed to a new value. */
  changed: boolean;
  previous: string | null;
  current: string | null;
}

export interface PublicIpServiceOptions {
  fetchImpl?: typeof fetch;
  sources?: string[];
  timeoutMs?: number;
}

export class PublicIpService {
  private readonly fetchImpl: typeof fetch;
  private readonly sources: string[];
  private readonly timeoutMs: number;
  private ipv4: string | null = null;
  private detectedAt: number | null = null;

  constructor(opts: PublicIpServiceOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sources = opts.sources ?? DEFAULT_SOURCES;
    this.timeoutMs = opts.timeoutMs ?? 4000;
  }

  /** Last successfully-detected public IPv4 (null until the first success). */
  current(): { ipv4: string | null; detectedAt: number | null } {
    return { ipv4: this.ipv4, detectedAt: this.detectedAt };
  }

  /**
   * Detect the current public IP and update the cache. `changed` is true only
   * when a known IP moved to a different value (not on first detection), so a
   * caller can resync DNS / alert exactly when it matters.
   */
  async refresh(): Promise<PublicIpRefresh> {
    const detected = await this.detectOnce();
    const previous = this.ipv4;
    if (!detected) return { changed: false, previous, current: previous };
    this.detectedAt = Date.now();
    if (detected !== previous) {
      this.ipv4 = detected;
      return { changed: previous !== null, previous, current: detected };
    }
    return { changed: false, previous, current: detected };
  }

  private async detectOnce(): Promise<string | null> {
    for (const url of this.sources) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await this.fetchImpl(url, { signal: controller.signal });
          if (!res.ok) continue;
          const text = (await res.text()).trim();
          if (isPublicIpv4(text)) return text;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // try the next source
      }
    }
    return null;
  }
}
