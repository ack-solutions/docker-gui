import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { CloudflareClient } from '../../lib/dns/cloudflare.js';
import type { DnsProviderClient } from '../../lib/dns/types.js';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import { buildTestEnv, TEST_SETUP_SECRET } from '../../__tests__/test-helpers.js';

let env: TestEnv;
let cfMock: {
  verifyToken: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  listZones: ReturnType<typeof vi.fn>;
  listRecords: ReturnType<typeof vi.fn>;
  createRecord: ReturnType<typeof vi.fn>;
  updateRecord: ReturnType<typeof vi.fn>;
  deleteRecord: ReturnType<typeof vi.fn>;
};
let dohFetch: ReturnType<typeof vi.fn>;
let r53Mock: {
  verify: ReturnType<typeof vi.fn>;
  listZones: ReturnType<typeof vi.fn>;
  listRecords: ReturnType<typeof vi.fn>;
  createRecord: ReturnType<typeof vi.fn>;
  updateRecord: ReturnType<typeof vi.fn>;
  deleteRecord: ReturnType<typeof vi.fn>;
};

beforeAll(async () => {
  cfMock = {
    verifyToken: vi.fn().mockResolvedValue({ status: 'active' }),
    // The service calls the uniform verify(); delegate so the existing
    // verifyToken mock setup + assertions keep working.
    verify: vi.fn(() => cfMock.verifyToken()),
    listZones: vi.fn().mockResolvedValue([
      { id: 'zone1', name: 'example.com', accountName: 'My Acc' },
    ]),
    listRecords: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn().mockImplementation((_zoneId, input) =>
      Promise.resolve({
        id: 'newrec',
        zoneId: _zoneId,
        type: input.type,
        name: input.name,
        value: input.value,
        ttl: input.ttl ?? 1,
      }),
    ),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn().mockResolvedValue(undefined),
  };

  dohFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ Answer: [{ data: '1.2.3.4', type: 1 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

  r53Mock = {
    verify: vi.fn().mockResolvedValue({ status: 'active' }),
    listZones: vi.fn().mockResolvedValue([{ id: 'Z1', name: 'example.com' }]),
    listRecords: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  };

  env = await buildTestEnv({
    dnsOptions: {
      publicIp: '1.2.3.4',
      buildCloudflare: () => cfMock as unknown as CloudflareClient,
      buildRoute53: () => r53Mock as unknown as DnsProviderClient,
      fetchImpl: dohFetch as unknown as typeof fetch,
    },
  });
  await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1', name: 'Admin' },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  // Reset call history but preserve default impls.
  cfMock.verifyToken.mockClear();
  cfMock.verifyToken.mockResolvedValue({ status: 'active' });
  cfMock.listZones.mockClear();
  cfMock.listZones.mockResolvedValue([
    { id: 'zone1', name: 'example.com', accountName: 'My Acc' },
  ]);
  cfMock.listRecords.mockClear();
  cfMock.listRecords.mockResolvedValue([]);
  cfMock.createRecord.mockClear();
  cfMock.deleteRecord.mockClear();
  dohFetch.mockClear();
  dohFetch.mockResolvedValue(
    new Response(JSON.stringify({ Answer: [{ data: '1.2.3.4', type: 1 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  r53Mock.verify.mockClear();
  r53Mock.verify.mockResolvedValue({ status: 'active' });
  r53Mock.listZones.mockClear();
  r53Mock.listZones.mockResolvedValue([{ id: 'Z1', name: 'example.com' }]);
  r53Mock.listRecords.mockClear();
  r53Mock.listRecords.mockResolvedValue([]);
  await env.prisma.dnsProvider.deleteMany();
});

async function token(): Promise<string> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@example.com', password: 'StrongPass1' },
  });
  return res.json().data.accessToken;
}

async function authHeaders(): Promise<Record<string, string>> {
  return {
    authorization: `Bearer ${await token()}`,
    'content-type': 'application/json',
  };
}

async function createProvider(): Promise<{ id: string }> {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/dns/providers',
    headers: await authHeaders(),
    payload: {
      name: 'Cloudflare main',
      kind: 'cloudflare',
      apiToken: 'cf-token-abcdefghij1234567890',
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().data;
}

describe('DNS providers — auth', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/dns/providers' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/dns/providers', () => {
  it('creates a provider and verifies the token', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'Cloudflare main',
        kind: 'cloudflare',
        apiToken: 'cf-token-abcdefghij1234567890',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.kind).toBe('cloudflare');
    expect(data.verified).toBe(true);
    expect(data.lastVerifiedAt).toBeTruthy();
    expect(data.tokenMask).toBe('cf-t••••••7890');
    expect(cfMock.verifyToken).toHaveBeenCalled();
  });

  it('saves the provider with verified=false on token rejection', async () => {
    cfMock.verifyToken.mockRejectedValueOnce(new Error('Invalid API token'));
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'Cloudflare bad',
        kind: 'cloudflare',
        apiToken: 'cf-token-abcdefghij1234567890',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.verified).toBe(false);
    expect(res.json().data.lastError).toContain('Invalid API token');
  });

  it('rejects duplicate name', async () => {
    await createProvider();
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'Cloudflare main',
        kind: 'cloudflare',
        apiToken: 'another-token-abcdefghij1234567890',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('dns.name_taken');
  });

  it('creates a Route 53 provider, verifies it, and masks the access-key id', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'AWS prod',
        kind: 'route53',
        accessKeyId: 'AKIAEXAMPLE0000000000',
        secretAccessKey: 'SUPERSECRETvalue00000000000000000000',
        region: 'us-east-1',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.kind).toBe('route53');
    expect(data.verified).toBe(true);
    // Mask reflects the access-key id; the secret is never returned, even masked.
    expect(data.tokenMask).toContain('•');
    expect(JSON.stringify(data)).not.toContain('SUPERSECRET');
  });

  it('rejects a Route 53 provider missing AWS credentials (schema)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: { name: 'AWS bad', kind: 'route53', region: 'us-east-1' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unsupported kind', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'Route 53',
        kind: 'route53',
        apiToken: 'tok-12345678901234567890',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects too-short API token at the schema layer', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: { name: 'CF', kind: 'cloudflare', apiToken: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/dns/providers', () => {
  it('lists providers without leaking the raw token', async () => {
    await createProvider();
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/v1/dns/providers',
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(1);
    expect(list[0].tokenMask).toMatch(/••••••/);
    expect(JSON.stringify(list[0])).not.toContain('cf-token-abcdefghij1234567890');
  });
});

describe('PATCH /api/v1/dns/providers/:id', () => {
  it('updates name without re-verifying', async () => {
    const { id } = await createProvider();
    cfMock.verifyToken.mockClear();
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/dns/providers/${id}`,
      headers: await authHeaders(),
      payload: { name: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Renamed');
    expect(cfMock.verifyToken).not.toHaveBeenCalled();
  });

  it('clears verified when token is rotated', async () => {
    const { id } = await createProvider();
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/dns/providers/${id}`,
      headers: await authHeaders(),
      payload: { apiToken: 'newtok-abcdefghij1234567890' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.verified).toBe(false);
    expect(res.json().data.lastVerifiedAt).toBeNull();
  });
});

describe('POST /api/v1/dns/providers/:id/verify', () => {
  it('re-verifies on demand', async () => {
    const { id } = await createProvider();
    cfMock.verifyToken.mockClear();
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/dns/providers/${id}/verify`,
      headers: await authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(cfMock.verifyToken).toHaveBeenCalledOnce();
    expect(res.json().data.verified).toBe(true);
  });
});

describe('DELETE /api/v1/dns/providers/:id', () => {
  it('removes a provider', async () => {
    const { id } = await createProvider();
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/dns/providers/${id}`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    const after = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/providers/${id}`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(after.statusCode).toBe(404);
  });
});

describe('zones + records', () => {
  it('lists zones and records', async () => {
    const { id } = await createProvider();
    cfMock.listRecords.mockResolvedValueOnce([
      { id: 'r1', zoneId: 'zone1', type: 'A', name: 'example.com', value: '5.6.7.8', ttl: 1 },
    ]);
    const z = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/providers/${id}/zones`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(z.statusCode).toBe(200);
    expect(z.json().data[0]).toMatchObject({ id: 'zone1', name: 'example.com' });

    const r = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/providers/${id}/zones/zone1/records`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data[0]).toMatchObject({ type: 'A', value: '5.6.7.8' });
  });

  it('creates and deletes a record', async () => {
    const { id } = await createProvider();
    const create = await env.app.inject({
      method: 'POST',
      url: `/api/v1/dns/providers/${id}/zones/zone1/records`,
      headers: await authHeaders(),
      payload: { type: 'A', name: 'app.example.com', value: '9.9.9.9', proxied: false },
    });
    expect(create.statusCode).toBe(201);
    expect(cfMock.createRecord).toHaveBeenCalledWith('zone1', expect.objectContaining({ type: 'A' }));

    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/dns/providers/${id}/zones/zone1/records/newrec`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(del.statusCode).toBe(200);
    expect(cfMock.deleteRecord).toHaveBeenCalledWith('zone1', 'newrec');
  });

  it('maps Cloudflare errors to dns.upstream_error 502', async () => {
    const { id } = await createProvider();
    const cfErr = new Error('Authentication error');
    cfErr.name = 'CloudflareError';
    cfMock.listZones.mockRejectedValueOnce(cfErr);
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/providers/${id}/zones`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('dns.upstream_error');
  });

  it('maps Route 53 errors to dns.upstream_error 502 (not an unhandled error)', async () => {
    const res0 = await env.app.inject({
      method: 'POST',
      url: '/api/v1/dns/providers',
      headers: await authHeaders(),
      payload: {
        name: 'AWS prod',
        kind: 'route53',
        accessKeyId: 'AKIAEXAMPLE0000000000',
        secretAccessKey: 'SUPERSECRETvalue00000000000000000000',
        region: 'us-east-1',
      },
    });
    const id = res0.json().data.id as string;
    const r53Err = new Error('Route 53 listZones: AccessDenied: not authorized');
    r53Err.name = 'Route53Error';
    r53Mock.listZones.mockRejectedValueOnce(r53Err);
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/providers/${id}/zones`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('dns.upstream_error');
  });
});

describe('GET /api/v1/dns/recommended', () => {
  it('returns zone + recommended A record for a subdomain', async () => {
    const { id } = await createProvider();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/recommended?providerId=${id}&domain=app.example.com`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.zone.name).toBe('example.com');
    expect(data.recommended.isApex).toBe(false);
    expect(data.recommended.records).toHaveLength(1);
    expect(data.recommended.records[0]).toMatchObject({
      type: 'A',
      name: 'app.example.com',
      value: '1.2.3.4',
    });
  });

  it('returns 404 when no zone matches the domain', async () => {
    const { id } = await createProvider();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/recommended?providerId=${id}&domain=foo.unknown.test`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('dns.zone_not_found');
  });
});

describe('GET /api/v1/dns/propagation', () => {
  it('reports matched=true when DoH answer contains expected', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/propagation?name=app.example.com&type=A&expected=1.2.3.4`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ resolved: ['1.2.3.4'], matched: true });
  });

  it('reports matched=false when DoH does not return expected value', async () => {
    dohFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ Answer: [{ data: '8.8.8.8', type: 1 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/v1/dns/propagation?name=app.example.com&type=A&expected=1.2.3.4`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ resolved: ['8.8.8.8'], matched: false });
  });
});
