import { z } from 'zod';

export const checkStatusSchema = z.enum(['ok', 'degraded', 'down', 'unavailable']);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const checkResultSchema = z.object({
  status: checkStatusSchema,
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const cpuMetricsSchema = z.object({
  usagePercent: z.number().min(0).max(100),
  cores: z.number().int().positive(),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
});
export type CpuMetrics = z.infer<typeof cpuMetricsSchema>;

export const memoryMetricsSchema = z.object({
  usedBytes: z.number().nonnegative(),
  totalBytes: z.number().positive(),
  freeBytes: z.number().nonnegative(),
  usagePercent: z.number().min(0).max(100),
});
export type MemoryMetrics = z.infer<typeof memoryMetricsSchema>;

export const diskMetricsSchema = z.object({
  path: z.string(),
  usedBytes: z.number().nonnegative(),
  totalBytes: z.number().positive(),
  availableBytes: z.number().nonnegative(),
  usagePercent: z.number().min(0).max(100),
});
export type DiskMetrics = z.infer<typeof diskMetricsSchema>;

export const systemMetricsSchema = z.object({
  cpu: cpuMetricsSchema,
  memory: memoryMetricsSchema,
  disks: z.array(diskMetricsSchema),
});
export type SystemMetrics = z.infer<typeof systemMetricsSchema>;

export const healthResponseSchema = z.object({
  status: checkStatusSchema,
  uptime: z.number().nonnegative(),
  version: z.string(),
  timestamp: z.string(),
  checks: z.object({
    api: checkResultSchema,
    docker: checkResultSchema,
    database: checkResultSchema,
  }),
  system: systemMetricsSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
