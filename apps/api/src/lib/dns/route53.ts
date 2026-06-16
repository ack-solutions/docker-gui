/**
 * AWS Route 53 adapter implementing the provider-agnostic DnsProviderClient.
 *
 * Route 53 differs from Cloudflare in ways this adapter hides:
 *   - No per-record ids. We synthesize a stable id of `name|type`; update and
 *     delete key off (name, type) rather than an opaque id.
 *   - Changes are batched (ChangeResourceRecordSets) with CREATE/UPSERT/DELETE
 *     actions. We use UPSERT for create+update (idempotent), and DELETE must
 *     submit the EXACT existing record set — so delete fetches it first.
 *   - Hosted-zone ids arrive as "/hostedzone/Z123"; names carry a trailing dot.
 *
 * Auth uses an IAM access key (id + secret). Verification lists hosted zones
 * (a cheap read) so we never mutate to validate. Credentials are never logged
 * or included in surfaced error messages.
 */
import {
  Route53Client as AwsRoute53Client,
  ListHostedZonesCommand,
  ListResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommand,
  type ListHostedZonesCommandOutput,
  type ListResourceRecordSetsCommandOutput,
  type RRType,
} from '@aws-sdk/client-route-53';
import type { DnsProviderClient, DnsRecord, DnsRecordInput, DnsRecordType, DnsZone } from './types.js';

export class Route53Error extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'Route53Error';
  }
}

/** Minimal AWS client surface — lets tests inject a fake `send`. */
interface AwsSender {
  send(command: unknown): Promise<unknown>;
}

export interface Route53ClientOptions {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  /** Test seam: stand in for the AWS SDK client. */
  client?: AwsSender;
}

const ALLOWED: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA'];
const DEFAULT_TTL = 300;

export class Route53Client implements DnsProviderClient {
  private readonly sender: AwsSender;

  constructor(opts: Route53ClientOptions) {
    if (!opts.accessKeyId || !opts.secretAccessKey) {
      throw new Route53Error('AWS access key id and secret are required');
    }
    this.sender =
      opts.client ??
      (new AwsRoute53Client({
        region: opts.region || 'us-east-1',
        credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      }) as unknown as AwsSender);
  }

  async verify(): Promise<{ status: string }> {
    try {
      await this.sender.send(new ListHostedZonesCommand({ MaxItems: 1 }));
      return { status: 'active' };
    } catch (err) {
      throw this.wrap(err, 'verify');
    }
  }

  async listZones(): Promise<DnsZone[]> {
    const out: DnsZone[] = [];
    let marker: string | undefined;
    try {
      do {
        const res = (await this.sender.send(
          new ListHostedZonesCommand(marker ? { Marker: marker } : {}),
        )) as ListHostedZonesCommandOutput;
        for (const z of res.HostedZones ?? []) {
          if (z.Config?.PrivateZone) continue; // public zones only
          if (!z.Id || !z.Name) continue;
          out.push({ id: stripZoneId(z.Id), name: stripDot(z.Name) });
        }
        marker = res.IsTruncated ? res.NextMarker : undefined;
      } while (marker);
    } catch (err) {
      throw this.wrap(err, 'listZones');
    }
    return out;
  }

  async listRecords(zoneId: string, name?: string): Promise<DnsRecord[]> {
    const out: DnsRecord[] = [];
    const target = name ? ensureDot(name).toLowerCase() : undefined;
    let startName: string | undefined;
    let startType: RRType | undefined;
    try {
      for (;;) {
        const res = (await this.sender.send(
          new ListResourceRecordSetsCommand({
            HostedZoneId: zoneId,
            ...(startName ? { StartRecordName: startName, StartRecordType: startType } : {}),
          }),
        )) as ListResourceRecordSetsCommandOutput;
        for (const rr of res.ResourceRecordSets ?? []) {
          const type = rr.Type as DnsRecordType;
          if (!ALLOWED.includes(type)) continue;
          if (rr.AliasTarget) continue; // alias records have no plain value
          const recName = stripDot(rr.Name ?? '');
          if (target && ensureDot(recName).toLowerCase() !== target) continue;
          const value = decodeValue(type, rr.ResourceRecords?.[0]?.Value ?? '');
          if (!value) continue;
          out.push({
            id: recordId(recName, type),
            zoneId,
            type,
            name: recName,
            value,
            ttl: rr.TTL ?? DEFAULT_TTL,
          });
        }
        if (res.IsTruncated && res.NextRecordName) {
          startName = res.NextRecordName;
          startType = res.NextRecordType;
        } else {
          break;
        }
      }
    } catch (err) {
      throw this.wrap(err, 'listRecords');
    }
    return out;
  }

  async createRecord(zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    return this.upsert(zoneId, input);
  }

  async updateRecord(zoneId: string, _recordId: string, input: DnsRecordInput): Promise<DnsRecord> {
    // UPSERT keys on (name, type), so the synthesized id isn't needed.
    return this.upsert(zoneId, input);
  }

  async deleteRecord(zoneId: string, recordId: string): Promise<void> {
    const { name, type } = parseRecordId(recordId);
    // Route 53 DELETE must echo the exact existing record set; fetch it first.
    const existing = (await this.listRecords(zoneId, name)).find(
      (r) => r.type === type && r.name.toLowerCase() === name.toLowerCase(),
    );
    if (!existing) return; // already gone — idempotent
    try {
      await this.sender.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: zoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: 'DELETE',
                ResourceRecordSet: {
                  Name: ensureDot(existing.name),
                  Type: existing.type,
                  TTL: existing.ttl,
                  ResourceRecords: [{ Value: encodeValue(existing.type, existing.value) }],
                },
              },
            ],
          },
        }),
      );
    } catch (err) {
      throw this.wrap(err, 'deleteRecord');
    }
  }

  private async upsert(zoneId: string, input: DnsRecordInput): Promise<DnsRecord> {
    const ttl = input.ttl && input.ttl > 1 ? input.ttl : DEFAULT_TTL;
    try {
      await this.sender.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: zoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: ensureDot(input.name),
                  Type: input.type,
                  TTL: ttl,
                  ResourceRecords: [{ Value: encodeValue(input.type, input.value) }],
                },
              },
            ],
          },
        }),
      );
    } catch (err) {
      throw this.wrap(err, 'upsert');
    }
    return {
      id: recordId(input.name, input.type),
      zoneId,
      type: input.type,
      name: input.name,
      value: input.value,
      ttl,
    };
  }

  private wrap(err: unknown, op: string): Route53Error {
    const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const name = e?.name ?? 'Route53Error';
    const message = e?.message ?? 'AWS Route 53 error';
    return new Route53Error(`Route 53 ${op}: ${name}: ${message}`, e?.$metadata?.httpStatusCode);
  }
}

function stripZoneId(id: string): string {
  return id.replace(/^\/hostedzone\//, '');
}
function stripDot(name: string): string {
  return name.replace(/\.$/, '');
}
function ensureDot(name: string): string {
  return name.endsWith('.') ? name : `${name}.`;
}
function recordId(name: string, type: DnsRecordType): string {
  return `${stripDot(name).toLowerCase()}|${type}`;
}
function parseRecordId(id: string): { name: string; type: DnsRecordType } {
  const idx = id.lastIndexOf('|');
  if (idx === -1) return { name: id, type: 'A' };
  return { name: id.slice(0, idx), type: id.slice(idx + 1) as DnsRecordType };
}
/** TXT values are quoted in Route 53; other types are stored verbatim. */
function encodeValue(type: DnsRecordType, value: string): string {
  if (type === 'TXT' && !value.startsWith('"')) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}
function decodeValue(type: DnsRecordType, value: string): string {
  if (type === 'TXT' && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}
