import { z } from 'zod';

export const dnsProviderKindSchema = z.enum(['cloudflare', 'route53']);
export type DnsProviderKind = z.infer<typeof dnsProviderKindSchema>;

export const dnsRecordTypeSchema = z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA']);
export type DnsRecordTypeApi = z.infer<typeof dnsRecordTypeSchema>;

const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)(\.[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)+$/;
const FQDN_OR_AT = z.string().refine(
  (v) => v === '@' || DOMAIN_RE.test(v),
  'Must be a valid domain or "@" for the zone apex',
);

export const dnsProviderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: dnsProviderKindSchema,
  tokenMask: z.string().nullable(),
  verified: z.boolean(),
  lastVerifiedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DnsProviderSummary = z.infer<typeof dnsProviderSummarySchema>;

// Credentials differ per provider, so create is a discriminated union on kind.
export const createDnsProviderSchema = z.discriminatedUnion('kind', [
  z.object({
    name: z.string().min(1).max(80).trim(),
    kind: z.literal('cloudflare'),
    apiToken: z.string().min(20).max(200).trim(),
  }),
  z.object({
    name: z.string().min(1).max(80).trim(),
    kind: z.literal('route53'),
    accessKeyId: z.string().min(16).max(128).trim(),
    secretAccessKey: z.string().min(20).max(256).trim(),
    region: z.string().min(2).max(40).trim().default('us-east-1'),
  }),
]);
export type CreateDnsProviderInput = z.infer<typeof createDnsProviderSchema>;

// Update doesn't carry kind (it's fixed); the service validates the supplied
// credential fields against the stored provider kind.
export const updateDnsProviderSchema = z
  .object({
    name: z.string().min(1).max(80).trim().optional(),
    apiToken: z.string().min(20).max(200).trim().optional(),
    accessKeyId: z.string().min(16).max(128).trim().optional(),
    secretAccessKey: z.string().min(20).max(256).trim().optional(),
    region: z.string().min(2).max(40).trim().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateDnsProviderInput = z.infer<typeof updateDnsProviderSchema>;

export const dnsRecordInputSchema = z.object({
  type: dnsRecordTypeSchema,
  name: FQDN_OR_AT,
  value: z.string().min(1).max(2048),
  ttl: z.number().int().min(1).max(86400).optional(),
  proxied: z.boolean().optional(),
  priority: z.number().int().min(0).max(65535).optional(),
});
export type DnsRecordInputApi = z.infer<typeof dnsRecordInputSchema>;

export const dnsZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountName: z.string().optional(),
});

export const dnsRecordSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  type: dnsRecordTypeSchema,
  name: z.string(),
  value: z.string(),
  ttl: z.number(),
  proxied: z.boolean().optional(),
  priority: z.number().optional(),
});

export const propagationCheckQuerySchema = z.object({
  name: z.string().refine((v) => DOMAIN_RE.test(v), 'Invalid domain'),
  type: dnsRecordTypeSchema,
  expected: z.string().min(1).max(2048),
});

export const recommendedQuerySchema = z.object({
  providerId: z.string().min(1),
  domain: z.string().refine((v) => DOMAIN_RE.test(v), 'Invalid domain'),
});
