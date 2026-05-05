import { z } from 'zod';
import { loadYamlConfig } from './lib/yaml-config.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters of entropy'),
  SETUP_SECRET: z.string().min(16, 'SETUP_SECRET must be at least 16 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DOCKER_SOCKET: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // 15m
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800), // 7d
  CADDY_ADMIN_URL: z.string().url().optional(),
  CADDY_DEFAULT_LE_EMAIL: z.string().email().optional(),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Default location of `config.yml` inside the production container. Override
 * with the `CONFIG_PATH` env var. In dev, leave it unset and it falls back
 * to `./config.yml` (relative to cwd) — present if the user ran the
 * installer locally, absent otherwise.
 */
const DEFAULT_CONFIG_PATH = '/etc/docker-gui/config.yml';

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Config {
  // Layer 1: config.yml (operational settings)
  const yamlPath = env['CONFIG_PATH'] ?? DEFAULT_CONFIG_PATH;
  const fromYaml = loadYamlConfig(yamlPath);

  // Layer 2: process env / .env (secrets + overrides). Env always wins.
  const merged: Record<string, string | undefined> = { ...fromYaml };
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) merged[key] = value;
  }

  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (parsed.data.JWT_SECRET.startsWith('dev-secret')) {
      throw new Error(
        'JWT_SECRET appears to be the development default. Refusing to start in production.',
      );
    }
    if (parsed.data.SETUP_SECRET.startsWith('dev-setup-secret')) {
      throw new Error(
        'SETUP_SECRET appears to be the development default. Refusing to start in production.',
      );
    }
  }
  return parsed.data;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
