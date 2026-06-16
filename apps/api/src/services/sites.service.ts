import type { PrismaClient, Site } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';
import { CaddyClient, CaddyError } from '../lib/caddy.js';
import { render, collectHosts, type RendererOptions } from './caddy-renderer.js';
import type { CertProbeResult } from '../lib/site-probe.js';
import {
  createSiteSchema,
  updateSiteSchema,
  type CreateSiteInput,
  type EnvVar,
  type SiteSummary,
  type UpdateSiteInput,
  type ApplyResult,
} from '../schemas/site.schema.js';

/** Live TLS / serving status for one site (computed, never persisted). */
export interface SiteCertStatus {
  siteId: string;
  /** The site's domain appears in the running Caddy config. */
  configured: boolean;
  /** A-record resolves to this server's public IP (undefined when unknown). */
  dnsOk?: boolean;
  certStatus: 'active' | 'pending' | 'error';
  /** An HTTPS HEAD to the domain succeeded. */
  servedOk: boolean;
  httpStatus?: number;
  /** Short, fixed-vocabulary explanation (never echoes response bodies). */
  reason?: string;
  lastCheckedAt: string;
}

export interface SitesServiceOptions {
  rendererDefaults?: RendererOptions;
  /** SSRF-guarded HTTPS prober for a site's own domain (injected). */
  certProbe?: (domain: string) => Promise<CertProbeResult>;
  /** DoH A-record resolver, for the dnsOk hint (injected). */
  resolveA?: (name: string) => Promise<string[]>;
  /** This server's current public IPv4 (for the dnsOk comparison). */
  getPublicIp?: () => string | undefined;
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

  /**
   * Best-effort live TLS / serving status for one site. Caddy's admin API has
   * no per-domain ACME endpoint, so "active" is INFERRED from (a) the domain
   * being in the running config and (b) a successful HTTPS HEAD to it. Always
   * returns (never throws past NotFound) so the UI can render a chip.
   */
  async certStatus(id: string): Promise<SiteCertStatus> {
    const site = await this.db.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundError('Site not found');
    const lastCheckedAt = new Date().toISOString();

    // (1) configured — the domain is in the live Caddy config.
    let configured = false;
    if (this.caddy) {
      try {
        const cfg = await this.caddy.getConfig();
        const live = liveHosts(cfg);
        configured = collectHosts(site).some((h) => live.has(h));
      } catch {
        configured = false;
      }
    }

    // (2) dnsOk — A record points at this server (best-effort hint).
    let dnsOk: boolean | undefined;
    const myIp = this.opts.getPublicIp?.();
    if (myIp && this.opts.resolveA) {
      try {
        const ips = await this.opts.resolveA(site.primaryDomain);
        if (ips.length > 0) dnsOk = ips.includes(myIp);
      } catch {
        dnsOk = undefined;
      }
    }

    const base = { siteId: id, configured, servedOk: false, lastCheckedAt };
    const withDns = dnsOk === undefined ? base : { ...base, dnsOk };

    // HTTP-only sites have no cert to verify.
    if (!site.enableHttps) {
      return { ...withDns, certStatus: 'active', reason: 'HTTP only' };
    }
    // Not in the live config → nothing is being served for it yet.
    if (!configured) {
      return { ...withDns, certStatus: 'error', reason: 'Not in the live Caddy config — apply changes' };
    }
    // No prober wired (or unavailable): we know it's configured but can't confirm serving.
    if (!this.opts.certProbe) {
      return { ...withDns, certStatus: 'pending', reason: 'Serving status not verified' };
    }
    // (3) probe HTTPS — SSRF-guarded, targets only the site's own domain.
    try {
      const res = await this.opts.certProbe(site.primaryDomain);
      if (res.ok) {
        return { ...withDns, certStatus: 'active', servedOk: true, httpStatus: res.status };
      }
      return {
        ...withDns,
        certStatus: 'pending',
        httpStatus: res.status,
        reason: 'Reachable but not serving normally yet',
      };
    } catch {
      // TLS error / unreachable / hairpin NAT — treat as pending, not a hard
      // error, since the API container may not reach its own public domain.
      return {
        ...withDns,
        certStatus: 'pending',
        reason: 'Could not verify HTTPS from the server (issuing, or self-reach blocked)',
      };
    }
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
        ...(parsed.env !== undefined ? { envJson: JSON.stringify(serializeEnv(parsed.env)) } : {}),
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
    if (parsed.env !== undefined) data['envJson'] = JSON.stringify(serializeEnv(parsed.env));
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
    env: parseEnvSummary(s.envJson),
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

/** Collect every host matched by any route in a (loosely-typed) Caddy config. */
function liveHosts(config: unknown): Set<string> {
  const hosts = new Set<string>();
  const servers = (config as { apps?: { http?: { servers?: Record<string, unknown> } } })?.apps
    ?.http?.servers;
  if (!servers || typeof servers !== 'object') return hosts;
  for (const server of Object.values(servers)) {
    const routes = (server as { routes?: unknown[] })?.routes;
    if (!Array.isArray(routes)) continue;
    for (const route of routes) {
      const matches = (route as { match?: unknown[] })?.match;
      if (!Array.isArray(matches)) continue;
      for (const m of matches) {
        const hostList = (m as { host?: unknown })?.host;
        if (Array.isArray(hostList)) {
          for (const h of hostList) if (typeof h === 'string') hosts.add(h);
        }
      }
    }
  }
  return hosts;
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

/** Fold an env-var array into a JSON map (last value wins on duplicate keys). */
function serializeEnv(pairs: EnvVar[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of pairs) out[key] = value;
  return out;
}

/**
 * Parse the stored envJson map back into the array form the API surfaces.
 * Mirrors deploy.service.ts parseEnv coercion exactly so what the UI shows
 * is what the container recreate applies — no behavioral drift.
 */
function parseEnvSummary(envJson: string | null | undefined): EnvVar[] {
  if (!envJson) return [];
  try {
    const parsed: unknown = JSON.parse(envJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const out: EnvVar[] = [];
    for (const [key, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out.push({ key, value: v });
      else if (typeof v === 'number' || typeof v === 'boolean') out.push({ key, value: String(v) });
    }
    return out;
  } catch {
    return [];
  }
}
