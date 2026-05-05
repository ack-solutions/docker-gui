import { z } from 'zod';

export const volumeSummarySchema = z.object({
  name: z.string(),
  driver: z.string(),
  mountpoint: z.string(),
  scope: z.string(),
  createdAt: z.string().optional(), // ISO; older Docker versions omit this
  labels: z.record(z.string()),
  options: z.record(z.string()).optional(),
  inUseBy: z.number().int().nonnegative(),
});
export type VolumeSummary = z.infer<typeof volumeSummarySchema>;
