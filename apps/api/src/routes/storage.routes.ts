import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { StorageService } from '../services/storage.service.js';
import {
  createConnectionSchema,
  updateConnectionSchema,
  createBucketSchema,
  listObjectsQuerySchema,
  uploadUrlSchema,
  downloadUrlQuerySchema,
  putBucketPolicySchema,
} from '../schemas/storage.schema.js';

export interface StorageRoutesOptions {
  storage: StorageService;
  authMiddleware: AuthMiddlewareDeps;
}

/** Parse a zod schema and convert failures into 400s the global error handler will catch. */
function parseInput<S extends z.ZodTypeAny>(
  source: 'body' | 'query',
  req: FastifyRequest,
  schema: S,
): z.output<S> {
  const value = source === 'body' ? req.body : req.query;
  const result = schema.safeParse(value);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const storageRoutes: FastifyPluginAsync<StorageRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  // Reads are open to any authenticated user; any write (mutating a
  // connection, bucket, object, or policy, or minting an upload URL) needs
  // operator+ — same split the docker/sites/dns routes use.
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  // -------------------- Connections --------------------

  app.get('/storage/connections', async () => {
    return opts.storage.listConnections();
  });

  app.get<{ Params: { id: string } }>('/storage/connections/:id', async (req) => {
    return opts.storage.getConnection(req.params.id);
  });

  app.post('/storage/connections', { preHandler: requireOperator }, async (req, reply) => {
    const input = parseInput('body', req, createConnectionSchema);
    const created = await opts.storage.createConnection({
      name: input.name,
      endpoint: input.endpoint,
      accessKey: input.accessKey,
      secretKey: input.secretKey,
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.flavor !== undefined ? { flavor: input.flavor } : {}),
      ...(input.pathStyle !== undefined ? { pathStyle: input.pathStyle } : {}),
    });
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/storage/connections/:id',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseInput('body', req, updateConnectionSchema);
      return opts.storage.updateConnection(req.params.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.flavor !== undefined ? { flavor: input.flavor } : {}),
        ...(input.pathStyle !== undefined ? { pathStyle: input.pathStyle } : {}),
        ...(input.accessKey !== undefined ? { accessKey: input.accessKey } : {}),
        ...(input.secretKey !== undefined ? { secretKey: input.secretKey } : {}),
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/storage/connections/:id',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.storage.deleteConnection(req.params.id);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/storage/connections/:id/verify',
    { preHandler: requireOperator },
    async (req) => {
      return opts.storage.verifyConnection(req.params.id);
    },
  );

  // -------------------- Buckets --------------------

  app.get<{ Params: { cid: string } }>('/storage/:cid/buckets', async (req) => {
    return opts.storage.listBuckets(req.params.cid);
  });

  app.post<{ Params: { cid: string } }>(
    '/storage/:cid/buckets',
    { preHandler: requireOperator },
    async (req, reply) => {
      const input = parseInput('body', req, createBucketSchema);
      const created = await opts.storage.createBucket(req.params.cid, input.name);
      return reply.status(201).send(created);
    },
  );

  app.delete<{ Params: { cid: string; bucket: string } }>(
    '/storage/:cid/buckets/:bucket',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.storage.deleteBucket(req.params.cid, req.params.bucket);
      return reply.status(204).send();
    },
  );

  // -------------------- Objects --------------------

  app.get<{
    Params: { cid: string; bucket: string };
    Querystring: Record<string, string>;
  }>('/storage/:cid/buckets/:bucket/objects', async (req) => {
    const q = parseInput('query', req, listObjectsQuerySchema);
    return opts.storage.listObjects(req.params.cid, req.params.bucket, {
      ...(q.prefix !== undefined ? { prefix: q.prefix } : {}),
      ...(q.delimiter !== undefined ? { delimiter: q.delimiter } : {}),
      ...(q.continuationToken !== undefined ? { continuationToken: q.continuationToken } : {}),
      ...(q.maxKeys !== undefined ? { maxKeys: q.maxKeys } : {}),
    });
  });

  app.post<{ Params: { cid: string; bucket: string } }>(
    '/storage/:cid/buckets/:bucket/objects/upload-url',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseInput('body', req, uploadUrlSchema);
      return opts.storage.getUploadUrl(req.params.cid, req.params.bucket, input.key, {
        ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
      });
    },
  );

  app.get<{
    Params: { cid: string; bucket: string };
    Querystring: Record<string, string>;
  }>('/storage/:cid/buckets/:bucket/objects/download-url', async (req) => {
    const q = parseInput('query', req, downloadUrlQuerySchema);
    return opts.storage.getDownloadUrl(req.params.cid, req.params.bucket, q.key);
  });

  app.delete<{
    Params: { cid: string; bucket: string };
    Querystring: { key?: string };
  }>(
    '/storage/:cid/buckets/:bucket/objects',
    { preHandler: requireOperator },
    async (req, reply) => {
      const q = parseInput('query', req, downloadUrlQuerySchema);
      await opts.storage.deleteObject(req.params.cid, req.params.bucket, q.key);
      return reply.status(204).send();
    },
  );

  // -------------------- Bucket policy --------------------

  app.get<{ Params: { cid: string; bucket: string } }>(
    '/storage/:cid/buckets/:bucket/policy',
    async (req) => {
      return opts.storage.getBucketPolicy(req.params.cid, req.params.bucket);
    },
  );

  app.put<{ Params: { cid: string; bucket: string } }>(
    '/storage/:cid/buckets/:bucket/policy',
    { preHandler: requireOperator },
    async (req, reply) => {
      const input = parseInput('body', req, putBucketPolicySchema);
      await opts.storage.putBucketPolicy(req.params.cid, req.params.bucket, input.policy);
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: { cid: string; bucket: string } }>(
    '/storage/:cid/buckets/:bucket/policy',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.storage.deleteBucketPolicy(req.params.cid, req.params.bucket);
      return reply.status(204).send();
    },
  );
};
