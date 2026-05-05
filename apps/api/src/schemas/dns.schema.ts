import { z } from 'zod';

export const dnsProviderKindSchema = z.enum(['cloudflare']);
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

export const createDnsProviderSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  kind: dnsProviderKindSchema,
  apiToken: z.string().min(20).max(200).trim(),
});
export type CreateDnsProviderInput = z.infer<typeof createDnsProviderSchema>;

export const updateDnsProviderSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  apiToken: z.string().min(20).max(200).trim().optional(),
});
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
