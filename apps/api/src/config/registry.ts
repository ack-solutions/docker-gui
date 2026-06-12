/**
 * Central config registry. Every configurable value in docker-gui is declared
 * here exactly once — type, default, validation, documentation, where it can
 * be set, and which UI group it lives in.
 *
 * Adding a new config key:
 *   1. Append a `defineKey({...})` entry below.
 *   2. Run `yarn workspace @docker-gui/api docs:config` to regenerate
 *      `docs/CONFIG.md`. CI fails if you forget.
 *   3. Use it via `config.get('your.key.path')` — fully typed.
 *
 * Renaming a key:
 *   1. Add the new entry, set `renamedFrom: ['old.key.path']`.
 *   2. Leave the old entry with `deprecatedIn: 'X.Y.Z'` for two minor
 *      versions so users have a window to migrate.
 *
 * The registry is the single source of truth for:
 *   - Boot-time validation (refuses to start with missing required keys)
 *   - Layered loader precedence (default → yaml → env → DB Setting → UI)
 *   - Source tracking (UI badge shows where each value came from)
 *   - `docs/CONFIG.md` auto-generation
 *   - `docker-gui config show` CLI output (Phase 6)
 *   - `/settings` page in the web UI
 */

import { z } from 'zod';

/** Valid groups for the `/settings` UI. */
export type ConfigGroup =
  | 'core/auth'
  | 'core/networking'
  | 'core/logging'
  | 'core/rate-limit'
  | 'docker'
  | 'caddy'
  | 'dns'
  | 'storage'
  | 'features'
  | 'system';

/** Where a config value can be set. Higher index = higher precedence. */
export const SOURCES = ['default', 'yaml', 'env', 'db', 'runtime'] as const;
export type ConfigSource = (typeof SOURCES)[number];

/** Types a config value can take. */
export type ConfigType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'list'
  | 'email'
  | 'url'
  | 'ipv4'
  | 'ipv6'
  | 'duration-seconds';

export interface ConfigKeyDef<TValue = unknown> {
  /** Dotted path used in code: `config.get('core.session.accessTtl')`. */
  key: string;
  /** Environment-variable name. Always SHOUTY_SNAKE_CASE. */
  envName: string;
  /** Path inside `config.yml` (or null if env-only — e.g. for secrets). */
  yamlPath: string | null;

  type: ConfigType;
  enumValues?: readonly string[];
  /**
   * The default value used when no override is present. May be `undefined`
   * for optional keys (in which case the value is `undefined` at runtime).
   * Required keys MUST either have a default OR set `required: true`.
   */
  default?: TValue;

  /** If true, boot refuses to start when value is missing/empty. */
  required: boolean;
  /** If true, value is masked in API output, logs, and CLI. */
  secret: boolean;
  /** If true, exposed in the /settings UI for editing. */
  uiEditable: boolean;
  /** If true, value changes only take effect after a restart. */
  requiresRestart: boolean;
  /** Group key for the UI. */
  group: ConfigGroup;

  /** Short human label for the UI. */
  label: string;
  /** Long description shown as help text + in docs. */
  description: string;
  /** One or two illustrative values for docs. */
  examples?: readonly string[];

  /** Numeric range (inclusive). */
  min?: number;
  max?: number;
  /** Regex for string validation. */
  pattern?: RegExp;
  /** Allowed entries for `list` type (no allowlist = free). */
  itemPattern?: RegExp;

  /** Version when this key first appeared. */
  introducedIn: string;
  /** If set, the key is deprecated; reads still work, docs flag it. */
  deprecatedIn?: string;
  /** Old names the loader will also recognize (with deprecation warning). */
  renamedFrom?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helper that just preserves the type
// ---------------------------------------------------------------------------

function defineKey<T>(def: ConfigKeyDef<T>): ConfigKeyDef<T> {
  return def;
}

// ---------------------------------------------------------------------------
// THE REGISTRY
// ---------------------------------------------------------------------------

export const CONFIG_REGISTRY = [
  // ─── core/auth ────────────────────────────────────────────────────────
  defineKey<string>({
    key: 'core.auth.jwtSecret',
    envName: 'JWT_SECRET',
    yamlPath: null,
    type: 'string',
    required: true,
    secret: true,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/auth',
    label: 'JWT secret',
    description:
      'HMAC key used to sign access + refresh tokens. Must be at least 32 bytes of high-entropy random data. NEVER set this manually — install.sh generates it once and writes it to /etc/docker-gui/secrets/jwt-secret with 0600 perms. Rotating it invalidates all existing sessions.',
    min: 32,
    introducedIn: '0.1.0',
  }),
  defineKey<string>({
    key: 'core.auth.setupSecret',
    envName: 'SETUP_SECRET',
    yamlPath: null,
    type: 'string',
    required: true,
    secret: true,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/auth',
    label: 'Setup secret',
    description:
      'One-time shared secret required to bootstrap the first admin account via POST /api/v1/setup/bootstrap. After the first admin exists, this route is disabled and the secret becomes inert.',
    min: 16,
    introducedIn: '0.1.0',
  }),
  defineKey<number>({
    key: 'core.auth.accessTokenTtlSeconds',
    envName: 'ACCESS_TOKEN_TTL',
    yamlPath: 'auth.access_token_ttl',
    type: 'duration-seconds',
    default: 900,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'core/auth',
    label: 'Access token TTL',
    description:
      'How long an access token is valid before it must be refreshed. Short is safer (smaller blast radius if a token leaks) but increases refresh-endpoint load. Default 15 min is a sensible middle ground.',
    examples: ['900 # 15 min', '3600 # 1 hour'],
    min: 60,
    max: 86400,
    introducedIn: '0.1.0',
  }),
  defineKey<number>({
    key: 'core.auth.refreshTokenTtlSeconds',
    envName: 'REFRESH_TOKEN_TTL',
    yamlPath: 'auth.refresh_token_ttl',
    type: 'duration-seconds',
    default: 604800,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'core/auth',
    label: 'Refresh token TTL',
    description:
      'How long a refresh token can be used to obtain new access tokens. After this the user must re-authenticate. Default 7 days balances convenience against risk.',
    examples: ['604800 # 7 days', '2592000 # 30 days'],
    min: 3600,
    max: 31536000,
    introducedIn: '0.1.0',
  }),

  // ─── core/networking ──────────────────────────────────────────────────
  defineKey<string>({
    key: 'core.network.bindHost',
    envName: 'API_HOST',
    yamlPath: 'api.host',
    type: 'string',
    default: '127.0.0.1',
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/networking',
    label: 'API bind host',
    description:
      'Network interface the API listens on. In the default compose setup this is 127.0.0.1 because the web service proxies to it over the docker network. Setting 0.0.0.0 exposes the API directly — only do this if you know why.',
    examples: ['127.0.0.1', '0.0.0.0'],
    introducedIn: '0.1.0',
  }),
  defineKey<number>({
    key: 'core.network.bindPort',
    envName: 'API_PORT',
    yamlPath: 'api.port',
    type: 'number',
    default: 4000,
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/networking',
    label: 'API bind port',
    description: 'TCP port the API listens on.',
    min: 1,
    max: 65535,
    introducedIn: '0.1.0',
  }),
  defineKey<string>({
    key: 'core.network.corsOrigins',
    envName: 'CORS_ORIGINS',
    yamlPath: 'api.cors_origins',
    type: 'list',
    default: 'http://localhost:3000',
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: true,
    group: 'core/networking',
    label: 'Allowed CORS origins',
    description:
      'Comma-separated list of origins allowed to call the API with credentials. The web UI origin must be included.',
    examples: ['http://localhost:3000', 'https://panel.example.com,https://example.com'],
    introducedIn: '0.1.0',
  }),
  defineKey<string>({
    key: 'core.network.databaseUrl',
    envName: 'DATABASE_URL',
    yamlPath: null,
    type: 'string',
    required: true,
    // Not flagged secret: the SQLite default is harmless and the UI shows
    // it for diagnostics. Operators who set a Postgres URL with credentials
    // should pass the password via PG-style component env (PGPASSWORD) or a
    // secrets store rather than embedding it in the URL.
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/networking',
    label: 'Database URL',
    description:
      'Prisma connection string. SQLite is the default and works for almost any single-server install. Switch to PostgreSQL by setting a postgres:// URL — schema is portable. Avoid embedding credentials directly in this URL; prefer per-component env vars so the connection string itself stays non-secret.',
    examples: ['file:../data/app.db', 'postgresql://user@host:5432/dockergui'],
    introducedIn: '0.1.0',
  }),
  defineKey<'development' | 'production' | 'test'>({
    key: 'core.env',
    envName: 'NODE_ENV',
    yamlPath: null,
    type: 'enum',
    enumValues: ['development', 'production', 'test'],
    default: 'development',
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'core/networking',
    label: 'Node environment',
    description:
      'Standard Node.js mode flag. In `production`, the boot validator refuses dev-default secrets and logs are JSON-only.',
    introducedIn: '0.1.0',
  }),

  // ─── core/logging ─────────────────────────────────────────────────────
  defineKey<'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'>({
    key: 'core.log.level',
    envName: 'LOG_LEVEL',
    yamlPath: 'api.log_level',
    type: 'enum',
    enumValues: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    default: 'info',
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'core/logging',
    label: 'Log level',
    description:
      'Minimum log level to emit. `debug` and `trace` are noisy but invaluable when chasing a bug. `info` is the right default.',
    introducedIn: '0.1.0',
  }),
  defineKey<boolean>({
    key: 'core.log.pretty',
    envName: 'LOG_PRETTY',
    yamlPath: 'api.log_pretty',
    type: 'boolean',
    default: false,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: true,
    group: 'core/logging',
    label: 'Pretty-print logs',
    description:
      'Human-readable colored log output. Turn off in production so logs are valid JSON for log shippers.',
    introducedIn: '0.1.0',
  }),

  // ─── core/rate-limit ──────────────────────────────────────────────────
  defineKey<number>({
    key: 'core.rateLimit.perMinute',
    envName: 'RATE_LIMIT_PER_MINUTE',
    yamlPath: 'auth.rate_limit_per_minute',
    type: 'number',
    default: 100,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: true,
    group: 'core/rate-limit',
    label: 'Rate limit (req/min/IP)',
    description:
      'Maximum API requests per minute per source IP. 0 disables. Keep on in production to slow brute force and runaway scripts.',
    min: 0,
    max: 100000,
    introducedIn: '0.2.0',
  }),
  defineKey<number>({
    key: 'core.rateLimit.lockoutAfterFails',
    envName: 'LOCKOUT_AFTER_FAILS',
    yamlPath: 'auth.lockout_after_fails',
    type: 'number',
    default: 5,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'core/rate-limit',
    label: 'Lockout after N failed logins',
    description:
      'Number of consecutive failed logins before the account is temporarily locked. 0 disables.',
    min: 0,
    max: 50,
    introducedIn: '0.2.0',
  }),
  defineKey<number>({
    key: 'core.rateLimit.lockoutDurationMinutes',
    envName: 'LOCKOUT_DURATION_MINUTES',
    yamlPath: 'auth.lockout_duration_minutes',
    type: 'number',
    default: 15,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'core/rate-limit',
    label: 'Lockout duration (minutes)',
    description: 'How long an account stays locked after triggering the fail threshold.',
    min: 1,
    max: 1440,
    introducedIn: '0.2.0',
  }),

  // ─── docker ───────────────────────────────────────────────────────────
  defineKey<string | undefined>({
    key: 'docker.socket',
    envName: 'DOCKER_SOCKET',
    yamlPath: 'docker.socket',
    type: 'string',
    default: undefined,
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'docker',
    label: 'Docker socket path',
    description:
      'Override the Docker socket path. Leave unset to use the platform default: /var/run/docker.sock on Linux, ~/.docker/run/docker.sock on macOS/Docker Desktop.',
    examples: ['/var/run/docker.sock'],
    introducedIn: '0.1.0',
  }),
  defineKey<string>({
    key: 'docker.network',
    envName: 'DOCKER_GUI_NETWORK',
    yamlPath: 'docker.network',
    type: 'string',
    default: 'docker-gui_dgui',
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'docker',
    label: 'Docker network',
    description:
      'Name of the Docker network the api container is on. Feature containers (Caddy, MinIO, …) are attached to this same network so the api can reach them without exposing ports to the host.',
    introducedIn: '0.1.0',
  }),
  defineKey<string>({
    key: 'docker.installDir',
    envName: 'DOCKER_GUI_INSTALL_DIR',
    yamlPath: 'docker.install_dir',
    type: 'string',
    default: '/opt/docker-gui',
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'docker',
    label: 'Host install directory',
    description:
      'Host path where install.sh wrote configs, snapshots, and feature data. Used to build bind mounts for feature containers — they need the host path, not the api container path.',
    introducedIn: '0.1.0',
  }),

  // ─── caddy ────────────────────────────────────────────────────────────
  defineKey<string | undefined>({
    key: 'caddy.adminUrl',
    envName: 'CADDY_ADMIN_URL',
    yamlPath: 'caddy.admin_url',
    type: 'url',
    default: undefined,
    required: false,
    secret: false,
    uiEditable: false,
    requiresRestart: true,
    group: 'caddy',
    label: 'Caddy admin URL',
    description:
      'URL of the Caddy admin API. Without this, Sites can be edited but Apply is disabled. Production compose default is http://caddy:2019 — reachable only on the internal docker network.',
    examples: ['http://caddy:2019'],
    introducedIn: '0.1.0',
  }),
  defineKey<string | undefined>({
    key: 'caddy.defaultLetsEncryptEmail',
    envName: 'CADDY_DEFAULT_LE_EMAIL',
    yamlPath: 'caddy.default_le_email',
    type: 'email',
    default: undefined,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'caddy',
    label: 'Default Lets Encrypt email',
    description:
      'Contact email registered with Lets Encrypt for any site without its own override. Required by ACME — without it the per-site form must always set one explicitly.',
    examples: ['ops@example.com'],
    introducedIn: '0.1.0',
  }),

  // ─── system ───────────────────────────────────────────────────────────
  defineKey<string | undefined>({
    key: 'system.publicIp',
    envName: 'SYSTEM_PUBLIC_IP',
    yamlPath: 'system.public_ip',
    type: 'ipv4',
    default: undefined,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'system',
    label: 'Public IPv4',
    description:
      'Public IPv4 address of this server. Drives the DNS wizard recommendations (e.g. A records). Auto-detected via STUN on first run if left blank.',
    examples: ['203.0.113.10'],
    introducedIn: '0.1.0',
  }),
  defineKey<string | undefined>({
    key: 'system.publicIp6',
    envName: 'SYSTEM_PUBLIC_IP6',
    yamlPath: 'system.public_ip6',
    type: 'ipv6',
    default: undefined,
    required: false,
    secret: false,
    uiEditable: true,
    requiresRestart: false,
    group: 'system',
    label: 'Public IPv6',
    description:
      'Public IPv6 address of this server (drives AAAA recommendations). Optional — skip if your VPS is v4-only.',
    examples: ['2001:db8::1'],
    introducedIn: '0.1.0',
  }),
] as const satisfies ReadonlyArray<ConfigKeyDef<unknown>>;

export type RegisteredKey = (typeof CONFIG_REGISTRY)[number]['key'];

/** Find a key by its dotted path. Throws if unknown — registry is the truth. */
export function getKeyDef(key: string): ConfigKeyDef<unknown> {
  const def = CONFIG_REGISTRY.find((k) => k.key === key);
  if (!def) {
    throw new Error(
      `Unknown config key "${key}". Add it to CONFIG_REGISTRY in apps/api/src/config/registry.ts first.`,
    );
  }
  return def;
}

/** Find by env-var name (used by the YAML/env layered loader). */
export function getKeyDefByEnv(envName: string): ConfigKeyDef<unknown> | undefined {
  return CONFIG_REGISTRY.find((k) => k.envName === envName);
}

/** All groups present in the registry, in stable display order. */
export function listGroups(): ConfigGroup[] {
  const seen = new Set<ConfigGroup>();
  for (const k of CONFIG_REGISTRY) seen.add(k.group);
  return Array.from(seen);
}

// ---------------------------------------------------------------------------
// Zod schema synthesised from the registry (one source of truth for both
// runtime validation and the docs generator).
// ---------------------------------------------------------------------------

function buildZodForKey(def: ConfigKeyDef<unknown>): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (def.type) {
    case 'string':
      schema = z.string();
      if (def.min !== undefined) schema = (schema as z.ZodString).min(def.min);
      if (def.max !== undefined) schema = (schema as z.ZodString).max(def.max);
      if (def.pattern) schema = (schema as z.ZodString).regex(def.pattern);
      break;
    case 'number':
    case 'duration-seconds': {
      let s = z.coerce.number().int();
      if (def.min !== undefined) s = s.min(def.min);
      if (def.max !== undefined) s = s.max(def.max);
      schema = s;
      break;
    }
    case 'boolean':
      // `z.coerce.boolean()` uses `Boolean(v)` which is wrong for env vars:
      // any non-empty string is truthy, so "false"/"0" both become true.
      // Use a preprocessor that respects the common textual forms.
      schema = z.preprocess((v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(s)) return true;
          if (['false', '0', 'no', 'off', ''].includes(s)) return false;
        }
        return v;
      }, z.boolean());
      break;
    case 'enum':
      if (!def.enumValues || def.enumValues.length === 0) {
        throw new Error(`Enum key ${def.key} missing enumValues`);
      }
      schema = z.enum(def.enumValues as readonly [string, ...string[]]);
      break;
    case 'list':
      // Stored as a comma-separated string at the env layer; consumers split.
      schema = z.string();
      break;
    case 'email':
      schema = z.string().email();
      break;
    case 'url':
      schema = z.string().url();
      break;
    case 'ipv4':
      schema = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Must be an IPv4 address');
      break;
    case 'ipv6':
      schema = z.string().regex(/^[0-9a-fA-F:]+$/, 'Must be an IPv6 address');
      break;
  }
  if (def.default !== undefined) {
    schema = schema.default(def.default as never);
  } else if (!def.required) {
    schema = schema.optional();
  }
  return schema;
}

/**
 * Build a zod object keyed by ENV name (which is how raw values arrive in
 * the loader). Used both at boot and inside tests.
 */
export function buildEnvSchema(): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const def of CONFIG_REGISTRY) {
    shape[def.envName] = buildZodForKey(def);
  }
  return z.object(shape);
}
