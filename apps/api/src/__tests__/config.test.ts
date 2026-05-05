import { describe, it, expect } from 'vitest';
import { loadConfig, parseCorsOrigins } from '../config.js';

const validSecret = 'a'.repeat(48);
const validSetup = 'b'.repeat(20);
const validDb = 'file:./test.db';

const baseEnv = {
  JWT_SECRET: validSecret,
  SETUP_SECRET: validSetup,
  DATABASE_URL: validDb,
};

describe('loadConfig', () => {
  it('throws when JWT_SECRET is missing', () => {
    expect(() => loadConfig({ SETUP_SECRET: validSetup, DATABASE_URL: validDb })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() =>
      loadConfig({ JWT_SECRET: 'short', SETUP_SECRET: validSetup, DATABASE_URL: validDb }),
    ).toThrow(/at least 32/);
  });

  it('throws when SETUP_SECRET is missing', () => {
    expect(() => loadConfig({ JWT_SECRET: validSecret, DATABASE_URL: validDb })).toThrow(
      /SETUP_SECRET/,
    );
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ JWT_SECRET: validSecret, SETUP_SECRET: validSetup })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuses dev-default JWT_SECRET in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET:
          'dev-secret-do-not-use-in-production-this-is-not-secure-at-all-12345678',
      }),
    ).toThrow(/development default/);
  });

  it('refuses dev-default SETUP_SECRET in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        SETUP_SECRET: 'dev-setup-secret-which-is-definitely-the-default-value',
      }),
    ).toThrow(/development default/);
  });

  it('accepts dev-default JWT_SECRET in development', () => {
    const c = loadConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      JWT_SECRET:
        'dev-secret-do-not-use-in-production-this-is-not-secure-at-all-12345678',
    });
    expect(c.NODE_ENV).toBe('development');
  });

  it('parses a valid config with defaults', () => {
    const c = loadConfig(baseEnv);
    expect(c.API_PORT).toBe(4000);
    expect(c.API_HOST).toBe('127.0.0.1');
    expect(c.LOG_LEVEL).toBe('info');
    expect(c.NODE_ENV).toBe('development');
    expect(c.ACCESS_TOKEN_TTL).toBe(900);
    expect(c.REFRESH_TOKEN_TTL).toBe(604800);
  });

  it('coerces API_PORT from string', () => {
    const c = loadConfig({ ...baseEnv, API_PORT: '5000' });
    expect(c.API_PORT).toBe(5000);
  });

  it('rejects non-numeric API_PORT', () => {
    expect(() => loadConfig({ ...baseEnv, API_PORT: 'abc' })).toThrow();
  });

  it('rejects unknown LOG_LEVEL', () => {
    expect(() => loadConfig({ ...baseEnv, LOG_LEVEL: 'wat' })).toThrow();
  });
});

describe('parseCorsOrigins', () => {
  it('parses comma-separated values', () => {
    expect(parseCorsOrigins('http://a.com, http://b.com,http://c.com')).toEqual([
      'http://a.com',
      'http://b.com',
      'http://c.com',
    ]);
  });

  it('handles empty string', () => {
    expect(parseCorsOrigins('')).toEqual([]);
  });
});
