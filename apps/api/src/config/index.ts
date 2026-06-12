/**
 * Public config API. Consumers import from `../config/index.js` (or
 * `../config.js` which re-exports this).
 *
 *   const cfg = loadConfig();
 *   cfg.get('core.auth.accessTokenTtlSeconds');   // typed number
 *   cfg.sourceOf('core.auth.accessTokenTtlSeconds');  // 'env' | 'yaml' | …
 *
 * The `loadConfig()` call performs all three layered loads at boot. After
 * boot, callers hold the returned `ConfigSnapshot` and use `get()` / `sourceOf()`
 * for reads. Writes happen via the higher-level config service (Phase C.2,
 * UI-driven) which restarts the snapshot on change.
 */

import {
  loadLayeredConfig,
  loadLayeredConfigOrThrow,
  type LoadConfigInput,
  type LoadedValue,
} from './loader.js';
import {
  CONFIG_REGISTRY,
  getKeyDef,
  type ConfigSource,
} from './registry.js';

export * from './registry.js';
export type { LoadedValue, LoadConfigInput } from './loader.js';
export { loadLayeredConfig } from './loader.js';

/** Typed, frozen handle returned by `loadConfig()`. */
export interface ConfigSnapshot {
  /** Throws if `key` isn't registered. Returns the typed value. */
  get<T = unknown>(key: string): T;
  /** Same as get() but returns undefined for unset optional keys. */
  getOptional<T = unknown>(key: string): T | undefined;
  /** Where the current value came from. */
  sourceOf(key: string): ConfigSource;
  /** True if value comes from the registry default. */
  isDefault(key: string): boolean;
  /** All loaded values + provenance (used by /api/v1/config). */
  describe(): LoadedValue[];
  /** Non-fatal warnings emitted during load. */
  warnings(): string[];
}

function snapshotFromDetails(details: LoadedValue[], values: Record<string, unknown>, warnings: string[]): ConfigSnapshot {
  const sourceMap = new Map<string, ConfigSource>();
  const defaultMap = new Map<string, boolean>();
  for (const d of details) {
    sourceMap.set(d.key, d.source);
    defaultMap.set(d.key, d.isDefault);
  }
  return {
    get<T>(key: string): T {
      // Trigger the "unknown key" error fast in dev.
      getKeyDef(key);
      const v = values[key];
      if (v === undefined) {
        const def = getKeyDef(key);
        if (def.required) {
          throw new Error(`Required config key "${key}" was not set.`);
        }
      }
      return v as T;
    },
    getOptional<T>(key: string): T | undefined {
      getKeyDef(key);
      const v = values[key];
      return v as T | undefined;
    },
    sourceOf(key: string): ConfigSource {
      const s = sourceMap.get(key);
      if (!s) throw new Error(`Unknown config key "${key}"`);
      return s;
    },
    isDefault(key: string): boolean {
      return defaultMap.get(key) ?? true;
    },
    describe(): LoadedValue[] {
      return [...details];
    },
    warnings(): string[] {
      return [...warnings];
    },
  };
}

/**
 * Load + validate + return a typed snapshot. Throws if required keys are
 * missing or any validation fails — boot must fail loudly.
 */
export function loadConfig(input: LoadConfigInput = {}): ConfigSnapshot {
  const { values, details, warnings } = loadLayeredConfigOrThrow(input);
  return snapshotFromDetails(details, values, warnings);
}

/**
 * Non-throwing variant — used by `/api/v1/config` itself so a misconfig
 * doesn't 500. Returns errors for the UI to surface.
 */
export function loadConfigSoft(input: LoadConfigInput = {}): {
  snapshot: ConfigSnapshot | null;
  errors: string[];
  warnings: string[];
} {
  const result = loadLayeredConfig(input);
  if (result.errors.length > 0) {
    return { snapshot: null, errors: result.errors, warnings: result.warnings };
  }
  return {
    snapshot: snapshotFromDetails(result.details, result.values, result.warnings),
    errors: [],
    warnings: result.warnings,
  };
}

// ---------------------------------------------------------------------------
// Convenience: a `safe(view)` that produces a JSON-safe describe() output
// with secrets masked, ready for the /api/v1/config endpoint.
// ---------------------------------------------------------------------------

export interface PublicConfigKey {
  key: string;
  envName: string;
  group: string;
  label: string;
  description: string;
  type: string;
  enumValues?: readonly string[];
  default?: unknown;
  required: boolean;
  secret: boolean;
  uiEditable: boolean;
  requiresRestart: boolean;
  examples?: readonly string[];
  min?: number;
  max?: number;
  introducedIn: string;
  deprecatedIn?: string;
  current: { value: unknown; source: ConfigSource; isDefault: boolean };
}

function maskSecret(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const s = String(value);
  if (s.length === 0) return '';
  if (s.length <= 4) return '•'.repeat(s.length);
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

/** Public view safe to ship over /api/v1/config — secrets are masked. */
export function describeForApi(snapshot: ConfigSnapshot): PublicConfigKey[] {
  const detailsByKey = new Map(snapshot.describe().map((d) => [d.key, d]));
  return CONFIG_REGISTRY.map((def) => {
    const d = detailsByKey.get(def.key);
    const current = d ?? {
      key: def.key,
      envName: def.envName,
      value: def.default,
      source: 'default' as ConfigSource,
      isDefault: true,
      deprecated: false,
    };
    return {
      key: def.key,
      envName: def.envName,
      group: def.group,
      label: def.label,
      description: def.description,
      type: def.type,
      ...(def.enumValues ? { enumValues: def.enumValues } : {}),
      ...(def.default !== undefined ? { default: def.secret ? maskSecret(def.default) : def.default } : {}),
      required: def.required,
      secret: def.secret,
      uiEditable: def.uiEditable,
      requiresRestart: def.requiresRestart,
      ...(def.examples ? { examples: def.examples } : {}),
      ...(def.min !== undefined ? { min: def.min } : {}),
      ...(def.max !== undefined ? { max: def.max } : {}),
      introducedIn: def.introducedIn,
      ...(def.deprecatedIn ? { deprecatedIn: def.deprecatedIn } : {}),
      current: {
        value: def.secret ? maskSecret(current.value) : current.value,
        source: current.source,
        isDefault: current.isDefault,
      },
    };
  });
}
