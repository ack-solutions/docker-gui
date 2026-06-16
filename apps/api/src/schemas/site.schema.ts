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

export const backendTypeSchema = z.enum(['container', 'static', 'external']);
export type BackendType = z.infer<typeof backendTypeSchema>;

// Container/host name reachable on the docker network.
const containerNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 'Invalid container name');

export const siteSummarySchema = z.object({
  id: z.string(),
  primaryDomain: z.string(),
  aliasDomains: z.array(z.string()),
  backendType: backendTypeSchema,
  upstreamUrl: z.string().nullable(),
  containerName: z.string().nullable(),
  containerPort: z.number().int().nullable(),
  imageRef: z.string().nullable(),
  spaFallback: z.boolean(),
  currentDeployId: z.string().nullable(),
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

// Base fields shared by create/update. backendType defaults to "external" so
// existing callers (which send only upstreamUrl) keep working unchanged.
const siteFields = z.object({
  primaryDomain: domainSchema,
  aliasDomains: z.array(domainSchema).max(20).default([]),
  backendType: backendTypeSchema.default('external'),
  upstreamUrl: upstreamUrlSchema.optional(),
  containerName: containerNameSchema.optional(),
  containerPort: z.number().int().min(1).max(65535).optional(),
  imageRef: z.string().max(512).optional(),
  spaFallback: z.boolean().default(false),
  enableHttps: z.boolean().default(true),
  forceHttps: z.boolean().default(true),
  letsEncryptEmail: z.string().email().optional(),
  enabled: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

/** Enforce the per-backend required fields. */
function requireBackendFields(
  v: {
    backendType?: BackendType | undefined;
    upstreamUrl?: string | undefined;
    containerName?: string | undefined;
    containerPort?: number | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (v.backendType === 'external' && !v.upstreamUrl) {
    ctx.addIssue({ code: 'custom', path: ['upstreamUrl'], message: 'Upstream is required for an external backend' });
  }
  if (v.backendType === 'container' && (!v.containerName || !v.containerPort)) {
    ctx.addIssue({ code: 'custom', path: ['containerName'], message: 'Container name and port are required for a container backend' });
  }
}

export const createSiteSchema = siteFields.superRefine(requireBackendFields);
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = siteFields.partial();
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const applyResultSchema = z.object({
  ok: z.boolean(),
  applied: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type ApplyResult = z.infer<typeof applyResultSchema>;
