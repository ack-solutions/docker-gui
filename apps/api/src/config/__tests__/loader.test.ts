/**
 * Integration tests for the layered loader. Real YAML files written to a
 * tmp dir; real env objects; real zod validation. Zero mocks.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLayeredConfig, loadLayeredConfigOrThrow } from '../loader.js';
import { loadConfig, loadConfigSoft, describeForApi } from '../index.js';

function validBaseEnv(): Record<string, string> {
  return {
    JWT_SECRET: 'a'.repeat(32),
    SETUP_SECRET: 'b'.repeat(16),
    DATABASE_URL: 'file:./test.db',
    NODE_ENV: 'test',
  };
}

describe('loadLayeredConfig — env layer', () => {
  it('parses minimum-valid env and resolves defaults', () => {
    const result = loadLayeredConfig({ env: validBaseEnv() });
    expect(result.errors).toEqual([]);
    expect(result.values['core.auth.accessTokenTtlSeconds']).toBe(900);
    expect(result.values['core.log.level']).toBe('info');
    expect(result.values['docker.installDir']).toBe('/opt/docker-gui');
  });

  it('tracks env as the source when set via env', () => {
    const result = loadLayeredConfig({
      env: { ...validBaseEnv(), LOG_LEVEL: 'debug' },
    });
    const detail = result.details.find((d) => d.key === 'core.log.level');
    expect(detail?.source).toBe('env');
    expect(detail?.isDefault).toBe(false);
    expect(detail?.value).toBe('debug');
  });

  it('tracks default as the source when nothing is set', () => {
    const result = loadLayeredConfig({ env: validBaseEnv() });
    const detail = result.details.find((d) => d.key === 'core.log.level');
    expect(detail?.source).toBe('default');
    expect(detail?.isDefault).toBe(true);
  });

  it('returns errors (not throws) for invalid values', () => {
    const result = loadLayeredConfig({
      env: { ...validBaseEnv(), ACCESS_TOKEN_TTL: '5' }, // below min 60
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/core\.auth\.accessTokenTtlSeconds/);
  });

  it('refuses dev-default JWT_SECRET in production', () => {
    const result = loadLayeredConfig({
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'dev-secret-do-not-use-in-production-this-is-not-secure-at-all',
        SETUP_SECRET: 'b'.repeat(16),
        DATABASE_URL: 'file:./prod.db',
      },
    });
    expect(result.errors.some((e) => e.includes('jwtSecret'))).toBe(true);
  });

  it('accepts a strong JWT_SECRET in production', () => {
    const result = loadLayeredConfig({
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'P'.repeat(64),
        SETUP_SECRET: 'S'.repeat(32),
        DATABASE_URL: 'file:./prod.db',
      },
    });
    expect(result.errors).toEqual([]);
  });

  it('treats empty-string env value as unset (default wins)', () => {
    const result = loadLayeredConfig({
      env: { ...validBaseEnv(), LOG_LEVEL: '' },
    });
    expect(result.errors).toEqual([]);
    const detail = result.details.find((d) => d.key === 'core.log.level');
    expect(detail?.source).toBe('default');
  });
});

describe('loadLayeredConfig — yaml layer', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cfg-test-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('reads values from a real config.yml on disk', () => {
    const yamlPath = join(tmp, 'config.yml');
    writeFileSync(
      yamlPath,
      [
        'api:',
        '  log_level: warn',
        '  log_pretty: true',
        'auth:',
        '  access_token_ttl: 1800',
      ].join('\n'),
    );
    const result = loadLayeredConfig({ env: validBaseEnv(), yamlPath });
    expect(result.errors).toEqual([]);
    expect(result.values['core.log.level']).toBe('warn');
    expect(result.values['core.log.pretty']).toBe(true);
    expect(result.values['core.auth.accessTokenTtlSeconds']).toBe(1800);
    const logLevelDetail = result.details.find((d) => d.key === 'core.log.level');
    expect(logLevelDetail?.source).toBe('yaml');
  });

  it('env wins over yaml (precedence check)', () => {
    const yamlPath = join(tmp, 'config.yml');
    writeFileSync(yamlPath, 'api:\n  log_level: warn\n');
    const result = loadLayeredConfig({
      env: { ...validBaseEnv(), LOG_LEVEL: 'error' },
      yamlPath,
    });
    expect(result.values['core.log.level']).toBe('error');
    expect(result.details.find((d) => d.key === 'core.log.level')?.source).toBe('env');
  });

  it('silently ignores a malformed yaml file (falls back to env+defaults)', () => {
    const yamlPath = join(tmp, 'config.yml');
    writeFileSync(yamlPath, '!! not valid yaml @@ ::');
    const result = loadLayeredConfig({ env: validBaseEnv(), yamlPath });
    expect(result.errors).toEqual([]);
    expect(result.values['core.log.level']).toBe('info');
  });

  it('handles missing yaml file (no error)', () => {
    const result = loadLayeredConfig({
      env: validBaseEnv(),
      yamlPath: join(tmp, 'does-not-exist.yml'),
    });
    expect(result.errors).toEqual([]);
  });

  it('joins arrays into a comma string for list-typed keys', () => {
    const yamlPath = join(tmp, 'config.yml');
    writeFileSync(
      yamlPath,
      'api:\n  cors_origins:\n    - http://localhost:3000\n    - https://panel.example.com\n',
    );
    const result = loadLayeredConfig({ env: validBaseEnv(), yamlPath });
    expect(result.values['core.network.corsOrigins']).toBe(
      'http://localhost:3000,https://panel.example.com',
    );
  });

  it('yaml booleans flow through to typed values', () => {
    const yamlPath = join(tmp, 'config.yml');
    writeFileSync(yamlPath, 'api:\n  log_pretty: false\n');
    const result = loadLayeredConfig({
      env: { ...validBaseEnv() },
      yamlPath,
    });
    expect(result.values['core.log.pretty']).toBe(false);
  });
});

describe('loadConfig snapshot (public API)', () => {
  it('exposes typed get() with defaults', () => {
    const snapshot = loadConfig({ env: validBaseEnv() });
    expect(snapshot.get<number>('core.auth.accessTokenTtlSeconds')).toBe(900);
    expect(snapshot.get<string>('core.log.level')).toBe('info');
    expect(snapshot.sourceOf('core.log.level')).toBe('default');
  });

  it('throws when reading an unknown key (registry is truth)', () => {
    const snapshot = loadConfig({ env: validBaseEnv() });
    expect(() => snapshot.get('nope.nope')).toThrow(/Unknown config key/);
  });

  it('returns undefined for unset optional keys via getOptional', () => {
    const snapshot = loadConfig({ env: validBaseEnv() });
    expect(snapshot.getOptional<string>('caddy.adminUrl')).toBeUndefined();
  });

  it('throws on missing required keys at boot', () => {
    expect(() => loadConfig({ env: {} })).toThrow(/Invalid configuration/);
  });

  it('loadConfigSoft returns errors instead of throwing', () => {
    const result = loadConfigSoft({ env: {} });
    expect(result.snapshot).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('jwtSecret'))).toBe(true);
  });
});

describe('describeForApi — secret masking + public shape', () => {
  it('masks secret values in the public describe output', () => {
    const snapshot = loadConfig({
      env: {
        ...validBaseEnv(),
        JWT_SECRET: 'super-secret-jwt-token-that-is-not-shown-to-anyone-1234',
      },
    });
    const public_ = describeForApi(snapshot);
    const jwt = public_.find((k) => k.key === 'core.auth.jwtSecret');
    expect(jwt).toBeDefined();
    const masked = String(jwt!.current.value);
    expect(masked).toMatch(/^•+1234$/);
    expect(masked).not.toContain('super-secret');
  });

  it('does not mask non-secret values', () => {
    const snapshot = loadConfig({
      env: { ...validBaseEnv(), LOG_LEVEL: 'debug' },
    });
    const public_ = describeForApi(snapshot);
    const ll = public_.find((k) => k.key === 'core.log.level');
    expect(ll?.current.value).toBe('debug');
  });

  it('round-trips group + description + source for every registry key', () => {
    const snapshot = loadConfig({ env: validBaseEnv() });
    const public_ = describeForApi(snapshot);
    for (const k of public_) {
      expect(k.group).toBeTruthy();
      expect(k.description.length).toBeGreaterThan(10);
      expect(['default', 'yaml', 'env', 'db', 'runtime']).toContain(k.current.source);
    }
  });
});

describe('loadLayeredConfigOrThrow', () => {
  it('throws with all error messages joined when validation fails', () => {
    expect(() =>
      loadLayeredConfigOrThrow({
        env: { JWT_SECRET: 'short', SETUP_SECRET: 'also-short' },
      }),
    ).toThrow(/Invalid configuration/);
  });
  it('passes through when valid', () => {
    const result = loadLayeredConfigOrThrow({ env: validBaseEnv() });
    expect(result.values['core.log.level']).toBe('info');
  });
});
