import { z } from 'zod';

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
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
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
