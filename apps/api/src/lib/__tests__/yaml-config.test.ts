import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadYamlConfig, YAML_TO_ENV } from '../yaml-config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dgui-yaml-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(content: string): string {
  const path = join(tmpDir, 'config.yml');
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('loadYamlConfig', () => {
  it('returns empty object when file does not exist', () => {
    expect(loadYamlConfig(join(tmpDir, 'missing.yml'))).toEqual({});
  });

  it('parses a typical config', () => {
    const path = writeConfig(`
api:
  host: 0.0.0.0
  port: 4000
  log_level: debug
  log_pretty: false
docker:
  socket: /var/run/docker.sock
caddy:
  admin_url: http://caddy:2019
`);
    expect(loadYamlConfig(path)).toEqual({
      API_HOST: '0.0.0.0',
      API_PORT: '4000',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: 'false',
      DOCKER_SOCKET: '/var/run/docker.sock',
      CADDY_ADMIN_URL: 'http://caddy:2019',
    });
  });

  it('joins arrays with commas (CORS_ORIGINS convention)', () => {
    const path = writeConfig(`
api:
  cors_origins:
    - http://localhost:3000
    - https://app.example.com
`);
    expect(loadYamlConfig(path)).toEqual({
      CORS_ORIGINS: 'http://localhost:3000,https://app.example.com',
    });
  });

  it('coerces numbers and booleans to strings', () => {
    const path = writeConfig(`
auth:
  access_token_ttl: 1800
  refresh_token_ttl: 1209600
api:
  log_pretty: true
`);
    const out = loadYamlConfig(path);
    expect(out['ACCESS_TOKEN_TTL']).toBe('1800');
    expect(out['REFRESH_TOKEN_TTL']).toBe('1209600');
    expect(out['LOG_PRETTY']).toBe('true');
  });

  it('skips unrecognised keys (no surprises)', () => {
    const path = writeConfig(`
api:
  port: 4000
unknown_section:
  some: value
`);
    expect(loadYamlConfig(path)).toEqual({ API_PORT: '4000' });
  });

  it('skips null and undefined leaves', () => {
    const path = writeConfig(`
api:
  port: 4000
caddy:
  default_le_email: ~
`);
    expect(loadYamlConfig(path)).toEqual({ API_PORT: '4000' });
  });

  it('returns empty object on malformed YAML', () => {
    const path = writeConfig('this is: not [valid: yaml');
    expect(loadYamlConfig(path)).toEqual({});
  });

  it('returns empty object when top-level is not a mapping', () => {
    const path = writeConfig('"just a string"');
    expect(loadYamlConfig(path)).toEqual({});
  });

  it('exposes the YAML_TO_ENV mapping with no duplicate env keys', () => {
    const envKeys = YAML_TO_ENV.map(([, e]) => e);
    expect(new Set(envKeys).size).toBe(envKeys.length);
  });

  it('never maps secret keys', () => {
    const envKeys = YAML_TO_ENV.map(([, e]) => e);
    expect(envKeys).not.toContain('JWT_SECRET');
    expect(envKeys).not.toContain('SETUP_SECRET');
    expect(envKeys).not.toContain('DATABASE_URL');
  });
});
