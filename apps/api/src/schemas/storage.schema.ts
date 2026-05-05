import { z } from 'zod';

export const s3FlavorSchema = z.enum(['auto', 'minio', 'aws', 'other']);

const endpointSchema = z
  .string()
  .url('endpoint must be a valid URL (e.g. http://minio:9000 or https://s3.example.com)');

const bucketNameSchema = z
  .string()
  // S3 bucket naming: 3-63 chars, lowercase, digits, dots, hyphens.
  .regex(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
    'bucket name must be 3-63 chars, lowercase letters / digits / dots / hyphens, no leading or trailing punctuation',
  );

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(64),
  endpoint: endpointSchema,
  region: z.string().min(1).max(64).optional(),
  flavor: s3FlavorSchema.optional(),
  pathStyle: z.boolean().optional(),
  accessKey: z.string().min(1).max(128),
  secretKey: z.string().min(1).max(256),
});

export const updateConnectionSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    endpoint: endpointSchema.optional(),
    region: z.string().min(1).max(64).optional(),
    flavor: s3FlavorSchema.optional(),
    pathStyle: z.boolean().optional(),
    accessKey: z.string().min(1).max(128).optional(),
    secretKey: z.string().min(1).max(256).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const createBucketSchema = z.object({
  name: bucketNameSchema,
});

export const listObjectsQuerySchema = z.object({
  prefix: z.string().optional(),
  delimiter: z.string().max(8).optional(),
  continuationToken: z.string().optional(),
  maxKeys: z.coerce.number().int().min(1).max(1000).optional(),
});

export const uploadUrlSchema = z.object({
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255).optional(),
});

export const downloadUrlQuerySchema = z.object({
  key: z.string().min(1).max(1024),
});

export const putBucketPolicySchema = z.object({
  policy: z.string().min(2),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;
