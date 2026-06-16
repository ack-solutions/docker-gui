import type { PrismaClient, Site } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';
import { CaddyClient, CaddyError } from '../lib/caddy.js';
import { render, type RendererOptions } from './caddy-renderer.js';
import {
  createSiteSchema,
  updateSiteSchema,
  type CreateSiteInput,
  type SiteSummary,
  type UpdateSiteInput,
  type ApplyResult,
} from '../schemas/site.schema.js';

export interface SitesServiceOptions {
  rendererDefaults?: RendererOptions;
}

export class SitesService {
  constructor(
    private readonly db: PrismaClient,
    private readonly caddy: CaddyClient | null,
    private readonly opts: SitesServiceOptions = {},
  ) {}

  caddyConfigured(): boolean {
    return this.caddy !== null;
  }

  /**
   * Whether Apply can succeed right now: Caddy must be configured AND its admin
   * API reachable (the reverse-proxy feature container actually running).
   */
  async caddyStatus(): Promise<{ configured: boolean; reachable: boolean }> {
    if (!this.caddy) return { configured: false, reachable: false };
    return { configured: true, reachable: await this.caddy.ping() };
  }

  async list(): Promise<SiteSummary[]> {
    const rows = await this.db.site.findMany({ orderBy: { primaryDomain: 'asc' } });
    return rows.map(toSummary);
  }

  async get(id: string): Promise<SiteSummary> {
    const row = await this.db.site.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Site not found');
    return toSummary(row);
  }

  async create(input: CreateSiteInput): Promise<SiteSummary> {
    const parsed = createSiteSchema.parse(input);
    const existing = await this.db.site.findUnique({
      where: { primaryDomain: parsed.primaryDomain },
    });
    if (existing) {
      throw new AppError('site.domain_taken', 'A site for that domain already exists', 409);
    }
    const row = await this.db.site.create({
      data: {
        primaryDomain: parsed.primaryDomain,
        aliasDomains: JSON.stringify(parsed.aliasDomains),
        backendType: parsed.backendType,
        // Null the upstream for static; keep it for container/external.
        upstreamUrl: parsed.backendType === 'static' ? null : parsed.upstreamUrl ?? null,
        ...(parsed.containerName !== undefined ? { containerName: parsed.containerName } : {}),
        ...(parsed.containerPort !== undefined ? { containerPort: parsed.containerPort } : {}),
        ...(parsed.imageRef !== undefined ? { imageRef: parsed.imageRef } : {}),
        spaFallback: parsed.spaFallback,
        enableHttps: parsed.enableHttps,
        forceHttps: parsed.forceHttps,
        ...(parsed.letsEncryptEmail !== undefined ? { letsEncryptEmail: parsed.letsEncryptEmail } : {}),
        enabled: parsed.enabled,
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
      },
    });
    return toSummary(row);
  }

  async update(id: string, input: UpdateSiteInput): Promise<SiteSummary> {
    const parsed = updateSiteSchema.parse(input);
    const existing = await this.db.site.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Site not found');

    if (parsed.primaryDomain && parsed.primaryDomain !== existing.primaryDomain) {
      const dupe = await this.db.site.findUnique({
        where: { primaryDomain: parsed.primaryDomain },
      });
      if (dupe) {
        throw new AppError('site.domain_taken', 'A site for that domain already exists', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.primaryDomain !== undefined) data['primaryDomain'] = parsed.primaryDomain;
    if (parsed.aliasDomains !== undefined) data['aliasDomains'] = JSON.stringify(parsed.aliasDomains);
    if (parsed.backendType !== undefined) data['backendType'] = parsed.backendType;
    if (parsed.upstreamUrl !== undefined) data['upstreamUrl'] = parsed.upstreamUrl;
    if (parsed.containerName !== undefined) data['containerName'] = parsed.containerName;
    if (parsed.containerPort !== undefined) data['containerPort'] = parsed.containerPort;
    if (parsed.imageRef !== undefined) data['imageRef'] = parsed.imageRef;
    if (parsed.spaFallback !== undefined) data['spaFallback'] = parsed.spaFallback;
    // Static sites never keep an upstream.
    if (parsed.backendType === 'static') data['upstreamUrl'] = null;
    if (parsed.enableHttps !== undefined) data['enableHttps'] = parsed.enableHttps;
    if (parsed.forceHttps !== undefined) data['forceHttps'] = parsed.forceHttps;
    if (parsed.letsEncryptEmail !== undefined) data['letsEncryptEmail'] = parsed.letsEncryptEmail;
    if (parsed.enabled !== undefined) data['enabled'] = parsed.enabled;
    if (parsed.notes !== undefined) data['notes'] = parsed.notes;
    // Edits return the site to "draft" state — needs re-apply
    data['status'] = 'draft';
    data['lastError'] = null;

    const row = await this.db.site.update({ where: { id }, data });
    return toSummary(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db.site.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Site not found');
    await this.db.site.delete({ where: { id } });
  }

  /**
   * Render all enabled sites and POST the full config to Caddy. Atomically
   * either applies all of them or none — that's how Caddy's `/load` works.
   * On success, every applied site has status='applied' + lastAppliedAt.
   * On failure, every applied site has status='error' + lastError.
   */
  async applyAll(): Promise<ApplyResult> {
    if (!this.caddy) {
      throw new AppError(
        'caddy.not_configured',
        'Caddy admin URL is not configured (set CADDY_ADMIN_URL).',
        503,
      );
    }
    const sites = await this.db.site.findMany();
    const enabled = sites.filter((s) => s.enabled);
    const config = render(enabled, this.opts.rendererDefaults ?? {});

    try {
      await this.caddy.loadConfig(config);
    } catch (err) {
      const message =
        err instanceof CaddyError
          ? typeof err.body === 'string'
            ? err.body
            : (err.body && typeof err.body === 'object' && 'error' in err.body
                ? String((err.body as { error: unknown }).error)
                : err.message)
          : err instanceof Error
            ? err.message
            : 'Caddy refused config';
      await this.db.site.updateMany({
        where: { id: { in: enabled.map((s) => s.id) } },
        data: { status: 'error', lastError: message },
      });
      return { ok: false, applied: 0, error: message };
    }

    const now = new Date();
    await this.db.site.updateMany({
      where: { id: { in: enabled.map((s) => s.id) } },
      data: { status: 'applied', lastError: null, lastAppliedAt: now },
    });
    // Disabled sites that were previously applied → mark draft
    await this.db.site.updateMany({
      where: { enabled: false, status: 'applied' },
      data: { status: 'draft' },
    });
    return { ok: true, applied: enabled.length };
  }
}

export function toSummary(s: Site): SiteSummary {
  return {
    id: s.id,
    primaryDomain: s.primaryDomain,
    aliasDomains: parseAliases(s.aliasDomains),
    backendType: (['container', 'static', 'external'].includes(s.backendType)
      ? s.backendType
      : 'external') as SiteSummary['backendType'],
    upstreamUrl: s.upstreamUrl,
    containerName: s.containerName,
    containerPort: s.containerPort,
    imageRef: s.imageRef,
    spaFallback: s.spaFallback,
    currentDeployId: s.currentDeployId,
    enableHttps: s.enableHttps,
    forceHttps: s.forceHttps,
    letsEncryptEmail: s.letsEncryptEmail,
    enabled: s.enabled,
    status: (s.status === 'applied' || s.status === 'error' ? s.status : 'draft') as SiteSummary['status'],
    lastError: s.lastError,
    lastAppliedAt: s.lastAppliedAt ? s.lastAppliedAt.toISOString() : null,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // ignore
  }
  return [];
}
