/**
 * Cloudflare API v4 client — only the endpoints the wizard uses.
 *
 * Auth: a scoped API token (Zone:Read, Zone:DNS:Edit). We never accept the
 * legacy global key. Verification (`POST /user/tokens/verify`) is the
 * cheapest way to confirm the token works without committing changes.
 *
 * Pagination: zones list can exceed 50; we walk pages until empty. Records
 * lists are typically small per zone — we still paginate to be safe.
 *
 * Errors: Cloudflare returns `{ success, errors: [{ code, message }] }`. We
 * surface the first error message as a `CloudflareError` so the caller can
 * show it. HTTP-level failures bubble up as the same error type.
 */
import type {
  DnsRecord,
  DnsRecordInput,
  DnsRecordType,
  DnsZone,
} from './types.js';

export class CloudflareError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cfCode?: number,
  ) {
    super(message);
    this.name = 'CloudflareError';
  }
}

export interface CloudflareClientOptions {
  apiToken: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: T;
  result_info?: { page: number; per_page: number; total_pages: number; count: number };
}

interface CfZone {
  id: string;
  name: string;
  account?: { id: string; name: string };
}

interface CfRecord {
  id: string;
  zone_id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
}

const DEFAULT_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 15_000;

export class CloudflareClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: CloudflareClientOptions) {
    if (!opts.apiToken || opts.apiToken.length < 10) {
      throw new CloudflareError('apiToken is required');
    }
    this.apiToken = opts.apiToken;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Validate the token. Returns the token's status string ("active") or
   * throws CloudflareError. This is the safe way to verify credentials
   * without scanning every zone.
   */
  async verifyToken(): Promise<{ status: string }> {
    const data = await this.request<{ id: string; status: string }>(
      'GET',
      '/user/tokens/verify',
    );
    return { status: data.status };
  }

  /** DnsProviderClient surface — verifies the scoped token. */
  async verify(): Promise<{ status: string }> {
    return this.verifyToken();
  }

  async listZones(): Promise<DnsZone[]> {
    const out: DnsZone[] = [];
    let page = 1;
    while (true) {
      const data = await this.requestEnvelope<CfZone[]>(
        'GET',
        `/zones?per_page=50&page=${page}`,
      );
      const items = data.result ?? [];
      for (const z of items) {
        out.push({
          id: z.id,
          name: z.name,
          ...(z.account?.name ? { accountName: z.account.name } : {}),
        });
      }
      const info = data.result_info;
      if (!info || page >= info.total_pages || items.length === 0) break;
      page += 1;
    }
    return out;
  }

  async listRecords(zoneId: string, name?: string): Promise<DnsRecord[]> {
    const out: DnsRecord[] = [];
    let page = 1;
    while (true) {
      const qs = new URLSearchParams({ per_page: '100', page: String(page) });
      if (name) qs.set('name', name);
      const data = await this.requestEnvelope<CfRecord[]>(
        'GET',
        `/zones/${encodeURIComponent(zoneId)}/dns_records?${qs.toString()}`,
      );
      const items = data.result ?? [];
      for (const r of items) {
        const rec = toDnsRecord(r);
        if (rec) out.push(rec);
      }
      const info = data.result_info;
      if (!info || page >= info.total_pages || items.length === 0) break;
      page += 1;
    }
    return out;
  }

  async createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const body: Record<string, unknown> = {
      type: input.type,
      name: input.name,
      content: input.value,
      ttl: input.ttl ?? 1,
    };
    if (input.proxied !== undefined) body['proxied'] = input.proxied;
    if (input.priority !== undefined) body['priority'] = input.priority;
    const r = await this.request<CfRecord>(
      'POST',
      `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      body,
    );
    const rec = toDnsRecord(r);
    if (!rec) throw new CloudflareError('Cloudflare returned an unsupported record type');
    return rec;
  }

  async updateRecord(
    zoneId: string,
    recordId: string,
    input: DnsRecordInput,
  ): Promise<DnsRecord> {
    const body: Record<string, unknown> = {
      type: input.type,
      name: input.name,
      content: input.value,
      ttl: input.ttl ?? 1,
    };
    if (input.proxied !== undefined) body['proxied'] = input.proxied;
    if (input.priority !== undefined) body['priority'] = input.priority;
    const r = await this.request<CfRecord>(
      'PUT',
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      body,
    );
    const rec = toDnsRecord(r);
    if (!rec) throw new CloudflareError('Cloudflare returned an unsupported record type');
    return rec;
  }

  async deleteRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request<{ id: string }>(
      'DELETE',
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    );
  }

  // ---------- internals ----------

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const env = await this.requestEnvelope<T>(method, path, body);
    if (env.result === undefined || env.result === null) {
      throw new CloudflareError(`Cloudflare ${method} ${path}: empty response`);
    }
    return env.result;
  }

  private async requestEnvelope<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<CfEnvelope<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${this.apiToken}`,
          'content-type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: CfEnvelope<T> | undefined;
      try {
        parsed = text ? (JSON.parse(text) as CfEnvelope<T>) : undefined;
      } catch {
        parsed = undefined;
      }
      if (!res.ok || !parsed || parsed.success === false) {
        const cfErr = parsed?.errors?.[0];
        const msg = cfErr
          ? `${cfErr.message} (cf code ${cfErr.code})`
          : `HTTP ${res.status}`;
        throw new CloudflareError(
          `Cloudflare ${method} ${path}: ${msg}`,
          res.status,
          cfErr?.code,
        );
      }
      return parsed;
    } catch (err) {
      if (err instanceof CloudflareError) throw err;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new CloudflareError(`Cloudflare ${method} ${path}: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

function toDnsRecord(r: CfRecord): DnsRecord | null {
  const allowed: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA'];
  if (!allowed.includes(r.type as DnsRecordType)) return null;
  const rec: DnsRecord = {
    id: r.id,
    zoneId: r.zone_id,
    type: r.type as DnsRecordType,
    name: r.name,
    value: r.content,
    ttl: r.ttl,
  };
  if (r.proxied !== undefined) rec.proxied = r.proxied;
  if (r.priority !== undefined) rec.priority = r.priority;
  return rec;
}

/**
 * Pick the longest zone whose name is a suffix of the requested domain.
 * "app.eu.example.com" against ["example.com", "eu.example.com"] → "eu.example.com".
 */
export function findZoneForDomain(domain: string, zones: DnsZone[]): DnsZone | null {
  const lower = domain.toLowerCase();
  let best: DnsZone | null = null;
  for (const z of zones) {
    const zname = z.name.toLowerCase();
    if (lower === zname || lower.endsWith(`.${zname}`)) {
      if (!best || z.name.length > best.name.length) best = z;
    }
  }
  return best;
}
