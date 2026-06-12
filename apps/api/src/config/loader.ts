/**
 * Layered config loader.
 *
 * Precedence (lowest → highest):
 *   1. Hard-coded defaults from the registry
 *   2. /etc/docker-gui/config.yml (operational settings)
 *   3. process.env (and .env)  ← wins over yaml
 *
 * (DB-stored Settings — for runtime UI edits — are layered on top of this
 *  in the higher-level config service; loaderless callers like `index.ts`
 *  during boot only see these three layers.)
 *
 * Every returned value carries provenance (`source: 'default'|'yaml'|'env'`)
 * so the /settings UI can show a badge.
 *
 * Renamed-from handling:
 *   If a key was renamed and the user still has the old env var or yaml
 *   path set, we read it as a fallback and emit a deprecation warning
 *   pointing at the new name. The new name still wins if both are set.
 */

import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  CONFIG_REGISTRY,
  type ConfigKeyDef,
  type ConfigSource,
  buildEnvSchema,
} from './registry.js';

export interface LoadedValue {
  key: string;
  envName: string;
  value: unknown;
  /** `undefined` if neither yaml nor env set this — value is the default. */
  source: ConfigSource;
  /** True when default was used because no override was found. */
  isDefault: boolean;
  /** True when value comes from a deprecated/renamed source. */
  deprecated: boolean;
  /** If deprecated, which old name was used (`oldEnv`/`oldYaml`/null). */
  deprecatedAlias?: string;
}

export interface LoadConfigInput {
  /** Override process.env for tests. */
  env?: Record<string, string | undefined>;
  /** Override the yaml path; defaults to env CONFIG_PATH or /etc/.../config.yml. */
  yamlPath?: string;
}

export interface LoadConfigResult {
  /** Map of dotted-key → resolved value (the kind callers actually use). */
  values: Record<string, unknown>;
  /** Detailed per-key info for the UI. */
  details: LoadedValue[];
  /** Non-fatal warnings collected during load (deprecations, weak secrets…). */
  warnings: string[];
  /** Fatal validation errors. If non-empty, the api must refuse to boot. */
  errors: string[];
}

const DEFAULT_YAML_PATH = '/etc/docker-gui/config.yml';

/**
 * Walk a parsed YAML object with a dotted path.
 * Returns `undefined` for missing/non-object intermediate keys.
 */
function getYamlNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Convert a YAML-loaded value into the string form the env layer would use.
 * Lists become comma-joined; bools/numbers become their string form.
 */
function yamlToEnvString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => String(v)).join(',');
  return String(value);
}

function loadYamlBag(yamlPath: string): Record<string, unknown> {
  if (!existsSync(yamlPath)) return {};
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(yamlPath, 'utf-8'));
  } catch {
    // Surfaced indirectly via missing-required-key errors. The yaml file
    // being unparseable shouldn't crash the boot — we still try env.
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  return parsed as Record<string, unknown>;
}

/**
 * Resolve one key by walking env → yaml → default and tracking source.
 */
function resolveOne(
  def: ConfigKeyDef<unknown>,
  env: Record<string, string | undefined>,
  yamlBag: Record<string, unknown>,
  warnings: string[],
): LoadedValue {
  // 1. Try env (highest precedence).
  const envRaw = env[def.envName];
  if (envRaw !== undefined && envRaw !== '') {
    return {
      key: def.key,
      envName: def.envName,
      value: envRaw,
      source: 'env',
      isDefault: false,
      deprecated: !!def.deprecatedIn,
    };
  }
  // 1a. Try renamed-from aliases via env.
  if (def.renamedFrom) {
    for (const oldName of def.renamedFrom) {
      const oldEnv = oldName.toUpperCase().replace(/\./g, '_');
      const aliasRaw = env[oldEnv];
      if (aliasRaw !== undefined && aliasRaw !== '') {
        warnings.push(
          `Env var ${oldEnv} is deprecated — use ${def.envName} instead (renamed in this docker-gui version).`,
        );
        return {
          key: def.key,
          envName: def.envName,
          value: aliasRaw,
          source: 'env',
          isDefault: false,
          deprecated: true,
          deprecatedAlias: oldEnv,
        };
      }
    }
  }

  // 2. Try yaml.
  if (def.yamlPath) {
    const yamlValue = getYamlNested(yamlBag, def.yamlPath);
    if (yamlValue !== undefined && yamlValue !== null && yamlValue !== '') {
      return {
        key: def.key,
        envName: def.envName,
        value: yamlToEnvString(yamlValue),
        source: 'yaml',
        isDefault: false,
        deprecated: !!def.deprecatedIn,
      };
    }
    // 2a. Renamed-from via yaml.
    if (def.renamedFrom) {
      for (const oldName of def.renamedFrom) {
        const aliasValue = getYamlNested(yamlBag, oldName);
        if (aliasValue !== undefined && aliasValue !== null && aliasValue !== '') {
          warnings.push(
            `Yaml key ${oldName} is deprecated — use ${def.yamlPath} instead.`,
          );
          return {
            key: def.key,
            envName: def.envName,
            value: yamlToEnvString(aliasValue),
            source: 'yaml',
            isDefault: false,
            deprecated: true,
            deprecatedAlias: oldName,
          };
        }
      }
    }
  }

  // 3. Default (or undefined for truly optional keys).
  return {
    key: def.key,
    envName: def.envName,
    value: def.default,
    source: 'default',
    isDefault: true,
    deprecated: !!def.deprecatedIn,
  };
}

/**
 * Production-grade weak-secret check used in `production` only.
 * Catches the dev defaults that ship in `.env.example`.
 */
function looksLikeDevDefault(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith('dev-secret') || value.startsWith('dev-setup-secret');
}

/**
 * Load + validate config in one call. Returns provenance for every key
 * plus warnings and errors. Throws nothing — callers decide what to do
 * with errors (the api boot turns errors into a fatal exit).
 */
export function loadLayeredConfig(input: LoadConfigInput = {}): LoadConfigResult {
  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const yamlPath = input.yamlPath ?? env['CONFIG_PATH'] ?? DEFAULT_YAML_PATH;
  const yamlBag = loadYamlBag(yamlPath);

  const warnings: string[] = [];
  const details: LoadedValue[] = [];
  const rawByEnv: Record<string, unknown> = {};

  for (const def of CONFIG_REGISTRY) {
    const resolved = resolveOne(def, env, yamlBag, warnings);
    details.push(resolved);
    if (resolved.value !== undefined) {
      rawByEnv[def.envName] = resolved.value;
    }
  }

  // Validate via the synthesised zod schema.
  const schema = buildEnvSchema();
  const parsed = schema.safeParse(rawByEnv);
  const errors: string[] = [];
  let values: Record<string, unknown> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const envKey = String(issue.path[0] ?? '<root>');
      const def = CONFIG_REGISTRY.find((k) => k.envName === envKey);
      // Include BOTH names so docs / ops who know one or the other can
      // still find the right knob. Dotted-key first because that's what
      // appears in the UI and code.
      const label = def ? `${def.key} (env: ${def.envName})` : envKey;
      errors.push(`${label}: ${issue.message}`);
    }
  } else {
    // Map env-keyed parsed object back to dotted-key map for callers.
    for (const def of CONFIG_REGISTRY) {
      const raw = (parsed.data as Record<string, unknown>)[def.envName];
      values[def.key] = raw;
    }
  }

  // Production weak-secret check.
  if (rawByEnv['NODE_ENV'] === 'production') {
    if (looksLikeDevDefault(rawByEnv['JWT_SECRET'])) {
      errors.push(
        'core.auth.jwtSecret: appears to be the development default. Refusing to start in production.',
      );
    }
    if (looksLikeDevDefault(rawByEnv['SETUP_SECRET'])) {
      errors.push(
        'core.auth.setupSecret: appears to be the development default. Refusing to start in production.',
      );
    }
    if (rawByEnv['LOG_PRETTY'] === 'true' || rawByEnv['LOG_PRETTY'] === true) {
      warnings.push(
        'core.log.pretty is enabled in production — JSON logs are recommended for log shippers.',
      );
    }
  }

  return { values, details, warnings, errors };
}

/**
 * Convenience that throws on errors (used by the api boot).
 */
export function loadLayeredConfigOrThrow(input: LoadConfigInput = {}): {
  values: Record<string, unknown>;
  details: LoadedValue[];
  warnings: string[];
} {
  const result = loadLayeredConfig(input);
  if (result.errors.length > 0) {
    const lines = result.errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  return { values: result.values, details: result.details, warnings: result.warnings };
}
