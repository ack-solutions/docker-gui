import type { DnsProvider, PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';
import { CryptoBox, maskSecret } from '../lib/crypto-box.js';
import {
  CloudflareClient,
  CloudflareError,
  findZoneForDomain,
} from '../lib/dns/cloudflare.js';
import type {
  DnsRecord,
  DnsRecordInput,
  DnsRecordType,
  DnsZone,
  RecommendedRecords,
} from '../lib/dns/types.js';
import {
  type CreateDnsProviderInput,
  type DnsProviderKind,
  type DnsProviderSummary,
  type UpdateDnsProviderInput,
} from '../schemas/dns.schema.js';

export interface DnsServiceOptions {
  /**
   * Public IPv4 of this server. Used to recommend A records. If unset, the
   * service still works for record CRUD but `recommendedRecordsForSite`
   * returns an empty record list and the caller should ask the user to set
   * `system.public_ip` in config.yml.
   */
  publicIp?: string;
  publicIp6?: string;
  /**
   * Live public-IP resolver (auto-detected), preferred over the static
   * `publicIp` when it returns a value. Lets recommendations track a changing
   * server IP without a restart.
   */
  getPublicIp?: () => { ipv4?: string | null; ipv6?: string | null };
  /** Override DoH base for tests. Default: Cloudflare. */
  dohBaseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Override Cloudflare client constructor (for tests). */
  buildCloudflare?: (apiToken: string) => CloudflareClient;
}

interface CloudflareCredentials {
  apiToken: string;
}

export class DnsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly box: CryptoBox,
    private readonly opts: DnsServiceOptions = {},
  ) {}

  // ---------- providers ----------

  async list(): Promise<DnsProviderSummary[]> {
    const rows = await this.db.dnsProvider.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => this.toSummary(r));
  }

  async get(id: string): Promise<DnsProviderSummary> {
    const row = await this.db.dnsProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('DNS provider not found');
    return this.toSummary(row);
  }

  async create(input: CreateDnsProviderInput): Promise<DnsProviderSummary> {
    if (input.kind !== 'cloudflare') {
      throw new AppError('dns.kind_unsupported', `Unsupported provider kind: ${input.kind}`, 400);
    }
    const dupe = await this.db.dnsProvider.findUnique({ where: { name: input.name } });
    if (dupe) throw new AppError('dns.name_taken', 'A provider with that name already exists', 409);

    const creds: CloudflareCredentials = { apiToken: input.apiToken };
    const cipher = this.box.seal(JSON.stringify(creds));

    // Verify before saving so the user gets immediate feedback.
    let verified = false;
    let lastError: string | null = null;
    let lastVerifiedAt: Date | null = null;
    try {
      const cf = this.cf(creds.apiToken);
      const r = await cf.verifyToken();
      if (r.status !== 'active') {
        lastError = `Token reported status: ${r.status}`;
      } else {
        verified = true;
        lastVerifiedAt = new Date();
      }
    } catch (err) {
      lastError = errMsg(err);
    }

    const row = await this.db.dnsProvider.create({
      data: {
        name: input.name,
        kind: input.kind,
        credentialsCipher: cipher,
        verified,
        lastVerifiedAt,
        lastError,
      },
    });
    return this.toSummary(row);
  }

  async update(id: string, input: UpdateDnsProviderInput): Promise<DnsProviderSummary> {
    const existing = await this.db.dnsProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DNS provider not found');

    const data: Record<string, unknown> = {};
    if (input.name !== undefined && input.name !== existing.name) {
      const dupe = await this.db.dnsProvider.findUnique({ where: { name: input.name } });
      if (dupe) throw new AppError('dns.name_taken', 'A provider with that name already exists', 409);
      data['name'] = input.name;
    }

    if (input.apiToken) {
      const creds: CloudflareCredentials = { apiToken: input.apiToken };
      data['credentialsCipher'] = this.box.seal(JSON.stringify(creds));
      // New token → re-verify on next call.
      data['verified'] = false;
      data['lastError'] = null;
      data['lastVerifiedAt'] = null;
    }

    const row = await this.db.dnsProvider.update({ where: { id }, data });
    return this.toSummary(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db.dnsProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DNS provider not found');
    await this.db.dnsProvider.delete({ where: { id } });
  }

  async verify(id: string): Promise<DnsProviderSummary> {
    const row = await this.db.dnsProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('DNS provider not found');
    const creds = this.openCreds(row);
    const cf = this.cf(creds.apiToken);
    let verified = false;
    let lastError: string | null = null;
    let lastVerifiedAt: Date | null = null;
    try {
      const r = await cf.verifyToken();
      if (r.status !== 'active') {
        lastError = `Token reported status: ${r.status}`;
      } else {
        verified = true;
        lastVerifiedAt = new Date();
      }
    } catch (err) {
      lastError = errMsg(err);
    }
    const updated = await this.db.dnsProvider.update({
      where: { id },
      data: { verified, lastError, lastVerifiedAt },
    });
    return this.toSummary(updated);
  }

  // ---------- zones / records ----------

  async listZones(id: string): Promise<DnsZone[]> {
    const cf = await this.clientFor(id);
    return cf.listZones();
  }

  async listRecords(id: string, zoneId: string, name?: string): Promise<DnsRecord[]> {
    const cf = await this.clientFor(id);
    return cf.listRecords(zoneId, name);
  }

  async createRecord(id: string, zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const cf = await this.clientFor(id);
    return cf.createRecord(zoneId, input);
  }

  async updateRecord(
    id: string,
    zoneId: string,
    recordId: string,
    input: DnsRecordInput,
  ): Promise<DnsRecord> {
    const cf = await this.clientFor(id);
    return cf.updateRecord(zoneId, recordId, input);
  }

  async deleteRecord(id: string, zoneId: string, recordId: string): Promise<void> {
    const cf = await this.clientFor(id);
    await cf.deleteRecord(zoneId, recordId);
  }

  /**
   * Resolve which zone a domain belongs to using this provider's accessible
   * zones. Returns null if no zone matches (likely the user added the wrong
   * provider for this domain).
   */
  async findZone(id: string, domain: string): Promise<DnsZone | null> {
    const zones = await this.listZones(id);
    return findZoneForDomain(domain, zones);
  }

  /**
   * Build the recommended records for pointing `domain` at this server.
   * Pure logic — no API calls. The caller can preview them and then call
   * `applyRecommended` to write them.
   */
  recommendedFor(zoneName: string, domain: string): RecommendedRecords {
    const isApex = domain.toLowerCase() === zoneName.toLowerCase();
    const records: DnsRecordInput[] = [];
    // Prefer the live auto-detected IP; fall back to the static config value.
    const live = this.opts.getPublicIp?.();
    const ipv4 = live?.ipv4 ?? this.opts.publicIp;
    const ipv6 = live?.ipv6 ?? this.opts.publicIp6;
    if (ipv4) {
      records.push({
        type: 'A',
        name: domain,
        value: ipv4,
        ttl: 1, // Cloudflare "automatic"
        proxied: false,
      });
    }
    if (ipv6) {
      records.push({
        type: 'AAAA',
        name: domain,
        value: ipv6,
        ttl: 1,
        proxied: false,
      });
    }
    return { zone: zoneName, isApex, records };
  }

  /**
   * Apply recommended records: for each suggested record, if a record with
   * the same (type,name) already exists, replace its value; otherwise create.
   * Returns the resulting records.
   */
  async applyRecommended(
    id: string,
    zoneId: string,
    domain: string,
    suggested: DnsRecordInput[],
  ): Promise<DnsRecord[]> {
    const cf = await this.clientFor(id);
    const existing = await cf.listRecords(zoneId, domain);
    const out: DnsRecord[] = [];
    for (const rec of suggested) {
      const match = existing.find(
        (e) => e.type === rec.type && e.name.toLowerCase() === rec.name.toLowerCase(),
      );
      if (match) {
        if (match.value === rec.value) {
          out.push(match); // already correct
        } else {
          out.push(await cf.updateRecord(zoneId, match.id, rec));
        }
      } else {
        out.push(await cf.createRecord(zoneId, rec));
      }
    }
    return out;
  }

  // ---------- propagation check ----------

  /**
   * Query a public DNS-over-HTTPS resolver for a given (name, type) and check
   * whether `expected` appears in the answer. Used by the wizard to wait
   * until DNS has propagated before issuing TLS.
   *
   * Default resolver: Cloudflare 1.1.1.1 DoH. We don't fall back to the OS
   * resolver because it can return cached negative results from before the
   * record was created.
   */
  async propagation(
    name: string,
    type: DnsRecordType,
    expected: string,
  ): Promise<{ resolved: string[]; matched: boolean }> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const base = this.opts.dohBaseUrl ?? 'https://cloudflare-dns.com/dns-query';
    const url = `${base}?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetchImpl(url, { headers: { accept: 'application/dns-json' } });
    if (!res.ok) {
      throw new AppError('dns.lookup_failed', `DoH ${res.status}`, 502);
    }
    const data = (await res.json()) as { Answer?: Array<{ data: string; type: number }> };
    const resolved = (data.Answer ?? []).map((a) => stripQuotes(a.data));
    const matched = resolved.some((r) => r.toLowerCase() === expected.toLowerCase());
    return { resolved, matched };
  }

  // ---------- helpers ----------

  private async clientFor(id: string): Promise<CloudflareClient> {
    const row = await this.db.dnsProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('DNS provider not found');
    if (row.kind !== 'cloudflare') {
      throw new AppError('dns.kind_unsupported', `Unsupported provider kind: ${row.kind}`, 400);
    }
    const creds = this.openCreds(row);
    return this.cf(creds.apiToken);
  }

  private cf(apiToken: string): CloudflareClient {
    if (this.opts.buildCloudflare) return this.opts.buildCloudflare(apiToken);
    const fetchOpt = this.opts.fetchImpl;
    return new CloudflareClient({
      apiToken,
      ...(fetchOpt ? { fetch: fetchOpt } : {}),
    });
  }

  private openCreds(row: DnsProvider): CloudflareCredentials {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.box.open(row.credentialsCipher));
    } catch (err) {
      throw new AppError(
        'dns.creds_unreadable',
        'DNS provider credentials could not be decrypted. Re-enter the API token.',
        500,
        { cause: errMsg(err) },
      );
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('apiToken' in parsed) ||
      typeof (parsed as { apiToken: unknown }).apiToken !== 'string'
    ) {
      throw new AppError('dns.creds_invalid', 'Stored credentials are malformed', 500);
    }
    return parsed as CloudflareCredentials;
  }

  private toSummary(row: DnsProvider): DnsProviderSummary {
    let tokenMask: string | null = null;
    try {
      const creds = JSON.parse(this.box.open(row.credentialsCipher)) as CloudflareCredentials;
      tokenMask = maskSecret(creds.apiToken);
    } catch {
      // Decryption failure (e.g. JWT_SECRET rotated). Surface as null mask;
      // routes can decide to mark provider as broken.
    }
    return {
      id: row.id,
      name: row.name,
      // kind is validated to be a known enum value on insert; the DB stores
      // it as a string, so cast back to the union type here.
      kind: row.kind as DnsProviderKind,
      tokenMask,
      verified: row.verified,
      lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function errMsg(err: unknown): string {
  if (err instanceof CloudflareError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

function stripQuotes(s: string): string {
  // DoH JSON wraps TXT records in quotes
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}
