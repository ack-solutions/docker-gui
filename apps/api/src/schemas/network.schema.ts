import { z } from 'zod';

export const networkSummarySchema = z.object({
  id: z.string(),
  shortId: z.string(),
  name: z.string(),
  driver: z.string(),
  scope: z.string(),
  internal: z.boolean(),
  ipam: z
    .object({
      driver: z.string().optional(),
      subnets: z.array(z.string()),
    })
    .optional(),
  containerCount: z.number().int().nonnegative(),
  labels: z.record(z.string()),
  createdAt: z.string().optional(),
});
export type NetworkSummary = z.infer<typeof networkSummarySchema>;
