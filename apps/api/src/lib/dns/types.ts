/**
 * Provider-agnostic DNS shapes. The Cloudflare adapter (and any future
 * adapters — Route 53, DigitalOcean) translate to/from these.
 *
 * We intentionally keep the surface tiny: enough for the wizard ("show me
 * which records to create, then create them") without exposing every quirk
 * of every provider.
 */

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'CAA';

export interface DnsZone {
  /** Provider-internal id (Cloudflare zone id, R53 hosted zone id, …) */
  id: string;
  /** "example.com" — no trailing dot */
  name: string;
  /** Optional account label, useful when one token sees multiple accounts */
  accountName?: string;
}

export interface DnsRecord {
  /** Provider-internal id (Cloudflare record id, etc.). */
  id: string;
  zoneId: string;
  type: DnsRecordType;
  /**
   * Record name. Cloudflare returns the FQDN ("foo.example.com"); we
   * normalize to that. Use `@` to mean the zone apex.
   */
  name: string;
  /** Record value (IPv4, IPv6, hostname, "10 mail.foo." for MX, …). */
  value: string;
  /** TTL seconds. 1 = "automatic" (Cloudflare convention). */
  ttl: number;
  /** Cloudflare-only: orange-cloud proxying. */
  proxied?: boolean;
  /** MX priority. */
  priority?: number;
}

export interface DnsRecordInput {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

/**
 * Recommended record set for pointing a Site at this server.
 *
 *   - For an apex domain (example.com): one A (and one AAAA if IPv6 known).
 *   - For a subdomain (app.example.com): one CNAME → apex, OR one A.
 *
 * The choice between A vs CNAME is made by the caller; we expose both options.
 */
export interface RecommendedRecords {
  /** The matching zone for the domain (e.g. "example.com"). */
  zone: string;
  /** Whether the requested domain is the zone apex. */
  isApex: boolean;
  /** Records the user should create. */
  records: DnsRecordInput[];
}

/**
 * Provider-agnostic client surface. Cloudflare and Route 53 adapters both
 * implement this so DnsService can route by provider kind without caring about
 * each provider's quirks (Route 53 has no per-record ids, batches changes, etc.).
 */
export interface DnsProviderClient {
  /** Confirm the credentials work without mutating anything. */
  verify(): Promise<{ status: string }>;
  listZones(): Promise<DnsZone[]>;
  listRecords(zoneId: string, name?: string): Promise<DnsRecord[]>;
  createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord>;
  updateRecord(zoneId: string, recordId: string, input: DnsRecordInput): Promise<DnsRecord>;
  deleteRecord(zoneId: string, recordId: string): Promise<void>;
}
