/**
 * Render docker-gui Site rows into a Caddy admin-API JSON config.
 *
 * Pure function — no I/O, no side effects, deterministic output for given
 * input. This makes it easy to unit-test and snapshot.
 *
 * Caddy config docs: https://caddyserver.com/docs/json/
 */

import type { Site } from '@prisma/client';

export interface RendererOptions {
  /** Default Let's Encrypt email if a Site doesn't supply its own. */
  defaultLetsEncryptEmail?: string;
  /** Listen ports for HTTPS. Default `[":443"]`. */
  httpsPorts?: string[];
  /** Listen ports for HTTP. Default `[":80"]`. */
  httpPorts?: string[];
  /**
   * Allowed admin-API origins (Host values). `POST /load` replaces the entire
   * config — including `admin` — so we must re-assert these every apply or
   * Caddy reverts to a loopback-only admin and the next apply can't reach it.
   */
  adminOrigins?: string[];
}

/** The reverse-proxy feature container + loopback, reachable on the internal
 *  docker network. Keep in sync with docker/caddy/initial.json. */
const DEFAULT_ADMIN_ORIGINS = [
  'docker-gui-caddy:2019',
  'localhost:2019',
  '127.0.0.1:2019',
  '[::1]:2019',
];

interface CaddyRoute {
  match: Array<{ host: string[] }>;
  handle: Array<Record<string, unknown>>;
  terminal?: boolean;
}

interface CaddyServer {
  listen: string[];
  routes: CaddyRoute[];
  automatic_https?: { disable_redirects?: boolean };
}

export interface CaddyConfig {
  admin: { listen: string; origins: string[] };
  apps: {
    http: { servers: Record<string, CaddyServer> };
    tls?: {
      automation?: {
        policies?: Array<{
          subjects?: string[];
          issuers?: Array<{ module: string; email?: string }>;
        }>;
      };
    };
  };
}

/**
 * Render the full Caddy config from a list of Sites + options.
 *
 * Sites that are disabled or have no domains are skipped silently.
 */
export function render(sites: readonly Site[], opts: RendererOptions = {}): CaddyConfig {
  const httpsPorts = opts.httpsPorts ?? [':443'];
  const httpPorts = opts.httpPorts ?? [':80'];

  const enabled = sites.filter((s) => s.enabled);

  const httpsRoutes: CaddyRoute[] = [];
  const httpOnlyRoutes: CaddyRoute[] = [];
  const tlsPolicies: NonNullable<CaddyConfig['apps']['tls']>['automation'] extends infer T
    ? Array<{ subjects?: string[]; issuers?: Array<{ module: string; email?: string }> }>
    : never = [];

  for (const site of enabled) {
    const hosts = collectHosts(site);
    if (hosts.length === 0) continue;

    const route: CaddyRoute = {
      match: [{ host: hosts }],
      handle: backendHandle(site),
      terminal: true,
    };

    if (site.enableHttps) {
      httpsRoutes.push(route);
      const email = site.letsEncryptEmail ?? opts.defaultLetsEncryptEmail;
      tlsPolicies.push({
        subjects: hosts,
        issuers: [{ module: 'acme', ...(email ? { email } : {}) }],
      });
    } else {
      httpOnlyRoutes.push(route);
    }
  }

  const servers: Record<string, CaddyServer> = {};
  if (httpsRoutes.length > 0) {
    servers['https'] = {
      listen: httpsPorts,
      routes: httpsRoutes,
    };
  }
  if (httpOnlyRoutes.length > 0 || enabledForceHttps(enabled)) {
    servers['http'] = {
      listen: httpPorts,
      routes: httpOnlyRoutes,
      // When any site has forceHttps, we let Caddy redirect HTTP→HTTPS
      // automatically (the default). Otherwise disable to allow plain HTTP.
      automatic_https: { disable_redirects: !enabledForceHttps(enabled) },
    };
  }

  const config: CaddyConfig = {
    admin: { listen: ':2019', origins: opts.adminOrigins ?? DEFAULT_ADMIN_ORIGINS },
    apps: {
      http: { servers },
    },
  };
  if (tlsPolicies.length > 0) {
    config.apps.tls = { automation: { policies: tlsPolicies } };
  }
  return config;
}

function collectHosts(site: Site): string[] {
  const aliases = parseJsonArray(site.aliasDomains);
  const all = [site.primaryDomain, ...aliases]
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  // dedupe while preserving order
  return Array.from(new Set(all));
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // fall through
  }
  return [];
}

/** Where Caddy file-serves static sites from (the caddy-www volume mount). */
const STATIC_ROOT_BASE = '/srv/sites';

/** The terminal handler chain for a site, by backend type. */
function backendHandle(site: Site): Array<Record<string, unknown>> {
  if (site.backendType === 'static') return staticHandlers(site);
  // container → the panel-run container's network address; external → the URL.
  const upstream =
    site.backendType === 'container' && site.containerName
      ? `${site.containerName}:${site.containerPort ?? 80}`
      : site.upstreamUrl ?? '';
  return [reverseProxy(upstream)];
}

/** file_server from /srv/sites/<id>/current (a stable symlink the deploy
 *  endpoint swaps), with optional SPA fallback to index.html. */
function staticHandlers(site: Site): Array<Record<string, unknown>> {
  const root = `${STATIC_ROOT_BASE}/${site.id}/current`;
  const handlers: Array<Record<string, unknown>> = [{ handler: 'vars', root }];
  if (site.spaFallback) {
    handlers.push({
      handler: 'subroute',
      routes: [
        {
          // Serve the requested file if it exists; else rewrite to index.html.
          match: [{ file: { try_files: ['{http.request.uri.path}', '/index.html'] } }],
          handle: [{ handler: 'rewrite', uri: '{http.matchers.file.relative}' }],
        },
        { handle: [{ handler: 'file_server' }] },
      ],
    });
  } else {
    handlers.push({ handler: 'file_server' });
  }
  return handlers;
}

function reverseProxy(upstream: string): Record<string, unknown> {
  return {
    handler: 'reverse_proxy',
    upstreams: [{ dial: stripScheme(upstream) }],
  };
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function enabledForceHttps(sites: readonly Site[]): boolean {
  return sites.some((s) => s.enableHttps && s.forceHttps);
}
