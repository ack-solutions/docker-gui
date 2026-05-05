import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

/**
 * Map of YAML dotted-paths → environment-variable names. We use this
 * explicit table (rather than walking arbitrary YAML keys) so that the
 * config schema is a single, audit-able document.
 *
 * Secrets — JWT_SECRET, SETUP_SECRET, DATABASE_URL — are intentionally
 * absent. Those must come from the environment / `.env` file. Putting
 * them in `config.yml` would risk committing them to source control.
 */
export const YAML_TO_ENV: ReadonlyArray<readonly [string, string]> = [
  ['api.host', 'API_HOST'],
  ['api.port', 'API_PORT'],
  ['api.log_level', 'LOG_LEVEL'],
  ['api.log_pretty', 'LOG_PRETTY'],
  ['api.cors_origins', 'CORS_ORIGINS'],
  ['docker.socket', 'DOCKER_SOCKET'],
  ['caddy.admin_url', 'CADDY_ADMIN_URL'],
  ['caddy.default_le_email', 'CADDY_DEFAULT_LE_EMAIL'],
  ['auth.access_token_ttl', 'ACCESS_TOKEN_TTL'],
  ['auth.refresh_token_ttl', 'REFRESH_TOKEN_TTL'],
];

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Load `config.yml` from disk and project relevant keys into the
 * environment-variable namespace. Returns an object suitable for being
 * merged with `process.env`. Process env wins by being merged last.
 *
 * - Returns `{}` if the file doesn't exist.
 * - Returns `{}` if YAML parsing fails (silent — surfaced later via
 *   missing required env, since the schema validation fires next).
 * - Arrays are joined with commas (matches CORS_ORIGINS convention).
 * - Booleans and numbers are stringified (env vars are strings).
 */
export function loadYamlConfig(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};

  const out: Record<string, string> = {};
  for (const [yamlKey, envKey] of YAML_TO_ENV) {
    const value = getNested(parsed, yamlKey);
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      out[envKey] = value.map(String).join(',');
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[envKey] = String(value);
    }
  }
  return out;
}
