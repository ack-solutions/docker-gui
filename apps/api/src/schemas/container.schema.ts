import { z } from 'zod';

export const containerStateSchema = z.enum([
  'created',
  'running',
  'paused',
  'restarting',
  'removing',
  'exited',
  'dead',
  'unknown',
]);
export type ContainerState = z.infer<typeof containerStateSchema>;

export const containerSummarySchema = z.object({
  id: z.string(),
  shortId: z.string(),
  names: z.array(z.string()),
  image: z.string(),
  imageId: z.string(),
  command: z.string(),
  state: containerStateSchema,
  status: z.string(),
  createdAt: z.string(), // ISO
  ports: z.array(
    z.object({
      privatePort: z.number().int().nonnegative(),
      publicPort: z.number().int().nonnegative().optional(),
      type: z.string(),
      ip: z.string().optional(),
    }),
  ),
  labels: z.record(z.string()),
});
export type ContainerSummary = z.infer<typeof containerSummarySchema>;

export const containerActionResultSchema = z.object({
  id: z.string(),
  action: z.enum(['start', 'stop', 'restart', 'remove', 'pause', 'unpause']),
  ok: z.boolean(),
});
