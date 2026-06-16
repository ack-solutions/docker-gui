import { z } from 'zod';

export const dbEngineSchema = z.enum(['postgres', 'mysql', 'mariadb']);

// A hostname or container name (no scheme, no path). Conservative allowlist.
const hostSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/, 'invalid host or container name');

const portSchema = z.coerce.number().int().min(1).max(65535);

export const createDatabaseConnectionSchema = z.object({
  name: z.string().min(1).max(64),
  engine: dbEngineSchema,
  host: hostSchema,
  port: portSchema.optional(),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256).optional(),
  database: z.string().min(1).max(128).optional(),
  ssl: z.boolean().optional(),
  containerId: z.string().min(1).max(128).optional(),
});

export const updateDatabaseConnectionSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    host: hostSchema.optional(),
    port: portSchema.optional(),
    username: z.string().min(1).max(128).optional(),
    password: z.string().max(256).optional(),
    database: z.string().max(128).optional(),
    ssl: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const startBackupSchema = z.object({
  // Both optional — when omitted the backup falls back to the default storage
  // connection and its default bucket (resolved in BackupService.startBackup).
  s3ConnectionId: z.string().min(1).max(64).optional(),
  bucket: z.string().min(1).max(63).optional(),
});

export const restoreBackupSchema = z.object({
  // Optional target connection; defaults to the backup's own connection.
  targetConnectionId: z.string().min(1).max(64).optional(),
});

export const setScheduleSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().min(1).max(120).optional(),
  s3ConnectionId: z.string().min(1).max(64).optional(),
  bucket: z.string().min(1).max(63).optional(),
});

export const runQuerySchema = z.object({
  sql: z.string().min(1).max(100_000),
  readOnly: z.boolean().optional(),
  // Upper bounds are enforced (clamped, not rejected) by clampOptions in
  // lib/db-query.ts — the single source of truth for query limits. Keep the
  // schema permissive on the ceiling so a too-large request is reduced, not 400'd.
  maxRows: z.coerce.number().int().positive().optional(),
  timeoutMs: z.coerce.number().int().positive().optional(),
});

export type CreateDatabaseConnectionBody = z.infer<typeof createDatabaseConnectionSchema>;
export type UpdateDatabaseConnectionBody = z.infer<typeof updateDatabaseConnectionSchema>;
export type RunQueryBody = z.infer<typeof runQuerySchema>;
