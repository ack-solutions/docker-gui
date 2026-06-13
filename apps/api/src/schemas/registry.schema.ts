import { z } from 'zod';

const endpointSchema = z
  .string()
  .url('endpoint must be a valid URL (e.g. http://docker-gui-registry:5000)');

// Docker repository names: lowercase path components, may include a registry
// host prefix. Keep it permissive but bounded.
const repoNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/, 'invalid repository name');

// A tag or digest reference.
const refSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_][A-Za-z0-9._:-]*$/, 'invalid tag or digest');

export const createRegistryConnectionSchema = z.object({
  name: z.string().min(1).max(64),
  endpoint: endpointSchema,
  managed: z.boolean().optional(),
  username: z.string().min(1).max(128).optional(),
  password: z.string().min(1).max(256).optional(),
  pushHost: z.string().min(1).max(255).optional(),
});

export const updateRegistryConnectionSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    endpoint: endpointSchema.optional(),
    // Pass empty string to clear username/password.
    username: z.string().max(128).optional(),
    password: z.string().max(256).optional(),
    pushHost: z.string().max(255).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const repoParamSchema = z.object({
  cid: z.string().min(1).max(64),
  repo: repoNameSchema,
});

export const tagParamSchema = z.object({
  cid: z.string().min(1).max(64),
  repo: repoNameSchema,
  tag: refSchema,
});

export type CreateRegistryConnectionBody = z.infer<typeof createRegistryConnectionSchema>;
export type UpdateRegistryConnectionBody = z.infer<typeof updateRegistryConnectionSchema>;
