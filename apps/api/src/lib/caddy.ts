/**
 * Tiny client for Caddy's admin API.
 *
 * Caddy exposes a JSON config over HTTP. POST /load atomically replaces
 * the running config; GET /config returns the current config; the server
 * validates internally and returns 400 with the error on bad config.
 *
 * Docs: https://caddyserver.com/docs/api
 */

export interface CaddyClientOptions {
  /** Base URL like "http://127.0.0.1:2019" or "http://caddy:2019" */
  adminUrl: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
  /** Custom fetch impl (used in tests). */
  fetch?: typeof fetch;
}

export class CaddyError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'CaddyError';
  }
}

export class CaddyClient {
  private readonly adminUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CaddyClientOptions) {
    this.adminUrl = opts.adminUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** Replace the entire running config. Atomic. */
  async loadConfig(config: unknown): Promise<void> {
    await this.request('POST', '/load', config);
  }

  /** Fetch the currently running config. */
  async getConfig(): Promise<unknown> {
    const res = await this.request('GET', '/config/');
    return res;
  }

  /** Liveness probe against the admin API. Uses `GET /config/` (the admin root
   *  `/` 404s — "Caddy is running" is served by the data plane, not admin). A
   *  short timeout keeps the Sites status poll snappy when Caddy isn't up. */
  async ping(timeoutMs = 3000): Promise<boolean> {
    try {
      await this.request('GET', '/config/', undefined, timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<unknown> {
    const url = `${this.adminUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      // Caddy's admin API enforces an origin allow-list when it listens on a
      // non-loopback address (so a cross-container caller is rejected with
      // "not allowed to access from origin ''"). Server-side fetch sends no
      // Origin header, so set one matching our admin URL; the Caddy config's
      // `admin.origins` must include this host.
      const headers: Record<string, string> = { Origin: this.adminUrl };
      if (body !== undefined) headers['content-type'] = 'application/json';
      const res = await this.fetchImpl(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        let parsed: unknown;
        try {
          parsed = text ? JSON.parse(text) : undefined;
        } catch {
          parsed = text;
        }
        throw new CaddyError(
          `Caddy ${method} ${path} failed: ${res.status}`,
          res.status,
          parsed,
        );
      }
      if (text.length === 0) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (err) {
      if (err instanceof CaddyError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new CaddyError(`Caddy ${method} ${path}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
