/**
 * Top-level config façade — preserves the historical API used by
 * `apps/api/src/index.ts` so existing callers don't have to change.
 *
 * Under the hood we now delegate to the layered registry in `./config/`.
 * The returned `Config` shape is the env-keyed object we always had;
 * `loadConfigSnapshot()` (new) returns the richer typed snapshot for
 * callers that want dotted-key access + source provenance.
 */

import { z } from 'zod';
import { loadConfig as loadSnapshot } from './config/index.js';
import type { ConfigSnapshot } from './config/index.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  API_HOST: z.string(),
  API_PORT: z.number(),
  JWT_SECRET: z.string(),
  SETUP_SECRET: z.string(),
  DATABASE_URL: z.string(),
  DOCKER_SOCKET: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  LOG_PRETTY: z.boolean(),
  CORS_ORIGINS: z.string(),
  ACCESS_TOKEN_TTL: z.number(),
  REFRESH_TOKEN_TTL: z.number(),
  CADDY_ADMIN_URL: z.string().url().optional(),
  CADDY_DEFAULT_LE_EMAIL: z.string().email().optional(),
  SYSTEM_PUBLIC_IP: z.string().optional(),
  SYSTEM_PUBLIC_IP6: z.string().optional(),
  DOCKER_GUI_NETWORK: z.string(),
  DOCKER_GUI_INSTALL_DIR: z.string(),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Legacy entry point. Loads + validates via the central registry, then
 * shapes the result into the historical env-keyed `Config` object so
 * existing code in `index.ts` keeps working.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Config {
  const snapshot = loadSnapshot({ env: env as Record<string, string | undefined> });
  const cfg: Config = {
    NODE_ENV: snapshot.get('core.env'),
    API_HOST: snapshot.get('core.network.bindHost'),
    API_PORT: snapshot.get('core.network.bindPort'),
    JWT_SECRET: snapshot.get('core.auth.jwtSecret'),
    SETUP_SECRET: snapshot.get('core.auth.setupSecret'),
    DATABASE_URL: snapshot.get('core.network.databaseUrl'),
    LOG_LEVEL: snapshot.get('core.log.level'),
    LOG_PRETTY: snapshot.get('core.log.pretty'),
    CORS_ORIGINS: snapshot.get('core.network.corsOrigins'),
    ACCESS_TOKEN_TTL: snapshot.get('core.auth.accessTokenTtlSeconds'),
    REFRESH_TOKEN_TTL: snapshot.get('core.auth.refreshTokenTtlSeconds'),
    DOCKER_GUI_NETWORK: snapshot.get('docker.network'),
    DOCKER_GUI_INSTALL_DIR: snapshot.get('docker.installDir'),
  };
  // Optional keys: only set when defined.
  const dockerSocket = snapshot.getOptional<string>('docker.socket');
  if (dockerSocket !== undefined) cfg.DOCKER_SOCKET = dockerSocket;
  const caddyUrl = snapshot.getOptional<string>('caddy.adminUrl');
  if (caddyUrl !== undefined) cfg.CADDY_ADMIN_URL = caddyUrl;
  const caddyEmail = snapshot.getOptional<string>('caddy.defaultLetsEncryptEmail');
  if (caddyEmail !== undefined) cfg.CADDY_DEFAULT_LE_EMAIL = caddyEmail;
  const ip = snapshot.getOptional<string>('system.publicIp');
  if (ip !== undefined) cfg.SYSTEM_PUBLIC_IP = ip;
  const ip6 = snapshot.getOptional<string>('system.publicIp6');
  if (ip6 !== undefined) cfg.SYSTEM_PUBLIC_IP6 = ip6;
  return envSchema.parse(cfg);
}

/**
 * New: return the full registry-backed snapshot (preferred for new code).
 * Provides `cfg.get('dotted.key')` + provenance.
 */
export function loadConfigSnapshot(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ConfigSnapshot {
  return loadSnapshot({ env: env as Record<string, string | undefined> });
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
