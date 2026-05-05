import { z } from 'zod';

export const siteStatusSchema = z.enum(['draft', 'applied', 'error']);
export type SiteStatus = z.infer<typeof siteStatusSchema>;

// Domain regex — RFC 1035 compatible-ish. Allow underscores in labels for
// services like _service.example.com. Length-bounded.
const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)(\.[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)+$/;

export const domainSchema = z.string().regex(DOMAIN_RE, 'Invalid domain name');

// Upstream is a host[:port] target or a full URL. We accept liberally because
// users may run Caddy in odd network topologies. Caddy itself enforces
// reachability when the config is applied.
export const upstreamUrlSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[a-zA-Z0-9._\-:/]+$/, 'Invalid upstream (host:port or URL)');

export const siteSummarySchema = z.object({
  id: z.string(),
  primaryDomain: z.string(),
  aliasDomains: z.array(z.string()),
  upstreamUrl: z.string(),
  enableHttps: z.boolean(),
  forceHttps: z.boolean(),
  letsEncryptEmail: z.string().nullable(),
  enabled: z.boolean(),
  status: siteStatusSchema,
  lastError: z.string().nullable(),
  lastAppliedAt: z.string().nullable(), // ISO
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SiteSummary = z.infer<typeof siteSummarySchema>;

export const createSiteSchema = z.object({
  primaryDomain: domainSchema,
  aliasDomains: z.array(domainSchema).max(20).default([]),
  upstreamUrl: upstreamUrlSchema,
  enableHttps: z.boolean().default(true),
  forceHttps: z.boolean().default(true),
  letsEncryptEmail: z.string().email().optional(),
  enabled: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = createSiteSchema.partial();
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const applyResultSchema = z.object({
  ok: z.boolean(),
  applied: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type ApplyResult = z.infer<typeof applyResultSchema>;
