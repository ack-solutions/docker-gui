import { describe, expect, it } from 'vitest';
import { CONFIG_REGISTRY, buildEnvSchema, getKeyDef, getKeyDefByEnv, listGroups } from '../registry.js';

describe('config registry', () => {
  it('every key has a unique dotted path', () => {
    const seen = new Set<string>();
    for (const k of CONFIG_REGISTRY) {
      expect(seen.has(k.key), `duplicate key ${k.key}`).toBe(false);
      seen.add(k.key);
    }
  });

  it('every key has a unique env name', () => {
    const seen = new Set<string>();
    for (const k of CONFIG_REGISTRY) {
      expect(seen.has(k.envName), `duplicate env ${k.envName}`).toBe(false);
      seen.add(k.envName);
    }
  });

  it('env names are SHOUTY_SNAKE_CASE', () => {
    for (const k of CONFIG_REGISTRY) {
      expect(k.envName).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('keys are dotted lower camel', () => {
    for (const k of CONFIG_REGISTRY) {
      expect(k.key, `bad shape: ${k.key}`).toMatch(/^[a-z][a-zA-Z0-9.]*$/);
    }
  });

  it('every secret key is marked uiEditable: false', () => {
    for (const k of CONFIG_REGISTRY) {
      if (k.secret) expect(k.uiEditable, `${k.key} is secret but uiEditable`).toBe(false);
    }
  });

  it('required keys either have a default or no default — never both with secret', () => {
    for (const k of CONFIG_REGISTRY) {
      if (k.required && k.secret) {
        // Secrets must NOT have a default committed to source.
        expect(k.default, `secret required key ${k.key} must not ship a default`).toBeUndefined();
      }
    }
  });

  it('enum keys list their values', () => {
    for (const k of CONFIG_REGISTRY) {
      if (k.type === 'enum') {
        expect(k.enumValues?.length).toBeGreaterThan(0);
      }
    }
  });

  it('getKeyDef returns the right def and throws on unknown', () => {
    const def = getKeyDef('core.auth.accessTokenTtlSeconds');
    expect(def.envName).toBe('ACCESS_TOKEN_TTL');
    expect(() => getKeyDef('does.not.exist')).toThrow(/Unknown config key/);
  });

  it('getKeyDefByEnv looks up by env name', () => {
    const def = getKeyDefByEnv('LOG_LEVEL');
    expect(def?.key).toBe('core.log.level');
    expect(getKeyDefByEnv('NOT_A_REAL_VAR')).toBeUndefined();
  });

  it('listGroups returns groups in stable order with no duplicates', () => {
    const groups = listGroups();
    const seen = new Set(groups);
    expect(seen.size).toBe(groups.length);
    expect(groups).toContain('core/auth');
  });

  describe('synthesised zod schema', () => {
    it('accepts a minimal valid env (defaults fill in)', () => {
      const schema = buildEnvSchema();
      const ok = schema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
        SETUP_SECRET: 'b'.repeat(16),
        DATABASE_URL: 'file:./test.db',
      });
      expect(ok.success).toBe(true);
      if (ok.success) {
        expect(ok.data['ACCESS_TOKEN_TTL']).toBe(900); // default
        expect(ok.data['LOG_LEVEL']).toBe('info');
      }
    });

    it('rejects JWT_SECRET shorter than 32 chars', () => {
      const schema = buildEnvSchema();
      const r = schema.safeParse({
        JWT_SECRET: 'too-short',
        SETUP_SECRET: 'b'.repeat(16),
      });
      expect(r.success).toBe(false);
    });

    it('rejects out-of-range numbers', () => {
      const schema = buildEnvSchema();
      const r = schema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
        SETUP_SECRET: 'b'.repeat(16),
        ACCESS_TOKEN_TTL: 30, // below min 60
      });
      expect(r.success).toBe(false);
    });

    it('coerces string numbers from env-style input', () => {
      const schema = buildEnvSchema();
      const r = schema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
        SETUP_SECRET: 'b'.repeat(16),
        DATABASE_URL: 'file:./test.db',
        ACCESS_TOKEN_TTL: '1800',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data['ACCESS_TOKEN_TTL']).toBe(1800);
    });

    it('rejects when DATABASE_URL is missing', () => {
      const schema = buildEnvSchema();
      const r = schema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
        SETUP_SECRET: 'b'.repeat(16),
      });
      expect(r.success).toBe(false);
    });

    it('rejects unknown enum values', () => {
      const schema = buildEnvSchema();
      const r = schema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
        SETUP_SECRET: 'b'.repeat(16),
        LOG_LEVEL: 'verbose',
      });
      expect(r.success).toBe(false);
    });
  });
});
