import { describe, it, expect, vi } from 'vitest';
import { Route53Client } from '../route53.js';

type Cmd = { constructor: { name: string }; input: Record<string, unknown> };

/** Stand-in for the AWS SDK client: routes by command class name. */
function sender(handlers: Record<string, (input: Record<string, unknown>) => unknown>) {
  const send = vi.fn(async (command: Cmd) => {
    const name = command.constructor.name;
    const h = handlers[name];
    if (!h) throw new Error(`unexpected command ${name}`);
    return h(command.input);
  });
  return { client: { send } as unknown as { send(c: unknown): Promise<unknown> }, send };
}

const creds = { accessKeyId: 'AKIAEXAMPLE0000000000', secretAccessKey: 'SUPERSECRETvalue00000000000000000000' };

describe('Route53Client', () => {
  it('verify() succeeds when hosted zones can be listed', async () => {
    const { client } = sender({ ListHostedZonesCommand: () => ({ HostedZones: [] }) });
    expect(await new Route53Client({ ...creds, client }).verify()).toEqual({ status: 'active' });
  });

  it('listZones() strips id prefix + trailing dot and skips private zones', async () => {
    const { client } = sender({
      ListHostedZonesCommand: () => ({
        HostedZones: [
          { Id: '/hostedzone/Z1', Name: 'example.com.', Config: { PrivateZone: false } },
          { Id: '/hostedzone/Z2', Name: 'corp.internal.', Config: { PrivateZone: true } },
        ],
        IsTruncated: false,
      }),
    });
    expect(await new Route53Client({ ...creds, client }).listZones()).toEqual([
      { id: 'Z1', name: 'example.com' },
    ]);
  });

  it('listRecords() maps RRsets, filters by name, skips alias + unsupported types', async () => {
    const { client } = sender({
      ListResourceRecordSetsCommand: () => ({
        ResourceRecordSets: [
          { Name: 'app.example.com.', Type: 'A', TTL: 300, ResourceRecords: [{ Value: '203.0.113.5' }] },
          { Name: 'other.example.com.', Type: 'A', TTL: 300, ResourceRecords: [{ Value: '1.2.3.4' }] },
          { Name: 'app.example.com.', Type: 'NS', TTL: 300, ResourceRecords: [{ Value: 'ns-1.aws.' }] },
          { Name: 'alias.example.com.', Type: 'A', AliasTarget: { DNSName: 'elb.aws.' } },
        ],
        IsTruncated: false,
      }),
    });
    const recs = await new Route53Client({ ...creds, client }).listRecords('Z1', 'app.example.com');
    expect(recs).toEqual([
      { id: 'app.example.com|A', zoneId: 'Z1', type: 'A', name: 'app.example.com', value: '203.0.113.5', ttl: 300 },
    ]);
  });

  it('createRecord() UPSERTs with a TTL floor and synthesizes an id', async () => {
    let captured: Record<string, unknown> | undefined;
    const { client } = sender({
      ChangeResourceRecordSetsCommand: (input) => {
        captured = input;
        return {};
      },
    });
    const rec = await new Route53Client({ ...creds, client }).createRecord('Z1', {
      type: 'A',
      name: 'app.example.com',
      value: '203.0.113.9',
      ttl: 1, // "automatic" → floored to 300
    });
    expect(rec).toMatchObject({ id: 'app.example.com|A', value: '203.0.113.9', ttl: 300 });
    const change = (captured as { ChangeBatch: { Changes: Array<Record<string, unknown>> } }).ChangeBatch
      .Changes[0];
    expect(change).toMatchObject({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: 'app.example.com.',
        Type: 'A',
        TTL: 300,
        ResourceRecords: [{ Value: '203.0.113.9' }],
      },
    });
  });

  it('deleteRecord() fetches the exact RRset then DELETEs it', async () => {
    const change = vi.fn(() => ({}));
    const client = {
      send: vi.fn(async (command: Cmd) => {
        const n = command.constructor.name;
        if (n === 'ListResourceRecordSetsCommand') {
          return {
            ResourceRecordSets: [
              { Name: 'app.example.com.', Type: 'A', TTL: 120, ResourceRecords: [{ Value: '203.0.113.5' }] },
            ],
            IsTruncated: false,
          };
        }
        if (n === 'ChangeResourceRecordSetsCommand') return change(command.input);
        throw new Error(`unexpected ${n}`);
      }),
    } as unknown as { send(c: unknown): Promise<unknown> };
    await new Route53Client({ ...creds, client }).deleteRecord('Z1', 'app.example.com|A');
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({
        ChangeBatch: {
          Changes: [
            expect.objectContaining({
              Action: 'DELETE',
              ResourceRecordSet: expect.objectContaining({ TTL: 120, Type: 'A' }),
            }),
          ],
        },
      }),
    );
  });

  it('deleteRecord() is a no-op when the record is already gone', async () => {
    const change = vi.fn();
    const client = {
      send: vi.fn(async (command: Cmd) => {
        if (command.constructor.name === 'ListResourceRecordSetsCommand') {
          return { ResourceRecordSets: [], IsTruncated: false };
        }
        change();
        return {};
      }),
    } as unknown as { send(c: unknown): Promise<unknown> };
    await new Route53Client({ ...creds, client }).deleteRecord('Z1', 'gone.example.com|A');
    expect(change).not.toHaveBeenCalled();
  });

  it('wraps AWS errors and never leaks the secret key', async () => {
    const client = {
      send: vi.fn(async () => {
        const e = new Error('The security token included in the request is invalid') as Error & {
          name: string;
          $metadata: { httpStatusCode: number };
        };
        e.name = 'InvalidClientTokenId';
        e.$metadata = { httpStatusCode: 403 };
        throw e;
      }),
    } as unknown as { send(c: unknown): Promise<unknown> };
    const c = new Route53Client({ ...creds, client });
    await expect(c.verify()).rejects.toThrow(/InvalidClientTokenId/);
    await expect(c.verify()).rejects.not.toThrow(/SUPERSECRET/);
  });

  it('requires credentials', () => {
    expect(() => new Route53Client({ accessKeyId: '', secretAccessKey: '' })).toThrow(/required/);
  });
});
