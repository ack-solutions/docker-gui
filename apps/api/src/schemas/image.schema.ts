import { z } from 'zod';

export const imageSummarySchema = z.object({
  id: z.string(),
  shortId: z.string(),
  repoTags: z.array(z.string()),
  repoDigests: z.array(z.string()),
  sizeBytes: z.number().nonnegative(),
  virtualSizeBytes: z.number().nonnegative(),
  createdAt: z.string(), // ISO
  labels: z.record(z.string()),
  containers: z.number().int(),
  dangling: z.boolean(),
});
export type ImageSummary = z.infer<typeof imageSummarySchema>;

export const pullImageInputSchema = z.object({
  reference: z
    .string()
    .min(1)
    .max(256)
    // Allow standard Docker reference syntax: [registry/]name[:tag][@digest]
    .regex(/^[a-zA-Z0-9._\-/:@]+$/, 'Invalid image reference'),
});
export type PullImageInput = z.infer<typeof pullImageInputSchema>;
