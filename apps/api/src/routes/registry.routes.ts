import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { RegistryService } from '../services/registry.service.js';
import {
  createRegistryConnectionSchema,
  updateRegistryConnectionSchema,
} from '../schemas/registry.schema.js';

export interface RegistryRoutesOptions {
  registry: RegistryService;
  authMiddleware: AuthMiddlewareDeps;
}

const repoQuerySchema = z.object({
  repo: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/, 'invalid repository name'),
});

const tagQuerySchema = repoQuerySchema.extend({
  tag: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9_][A-Za-z0-9._:-]*$/, 'invalid tag'),
});

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

export const registryRoutes: FastifyPluginAsync<RegistryRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  // Reads (browse) open to any authenticated user; mutations need operator+.
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  // -------------------- Connections --------------------

  app.get('/registry/connections', async () => {
    return opts.registry.listConnections();
  });

  app.get<{ Params: { id: string } }>('/registry/connections/:id', async (req) => {
    return opts.registry.getConnection(req.params.id);
  });

  app.post('/registry/connections', { preHandler: requireOperator }, async (req, reply) => {
    const input = parseInput('body', req, createRegistryConnectionSchema);
    const created = await opts.registry.createConnection({
      name: input.name,
      endpoint: input.endpoint,
      ...(input.managed !== undefined ? { managed: input.managed } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.password !== undefined ? { password: input.password } : {}),
      ...(input.pushHost !== undefined ? { pushHost: input.pushHost } : {}),
    });
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/registry/connections/:id',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseInput('body', req, updateRegistryConnectionSchema);
      return opts.registry.updateConnection(req.params.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        ...(input.pushHost !== undefined ? { pushHost: input.pushHost } : {}),
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/registry/connections/:id',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.registry.deleteConnection(req.params.id);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/registry/connections/:id/verify',
    { preHandler: requireOperator },
    async (req) => {
      return opts.registry.verifyConnection(req.params.id);
    },
  );

  // -------------------- Repositories / tags --------------------

  app.get<{ Params: { cid: string } }>('/registry/:cid/repositories', async (req) => {
    return opts.registry.listRepositories(req.params.cid);
  });

  app.get<{ Params: { cid: string }; Querystring: Record<string, string> }>(
    '/registry/:cid/tags',
    async (req) => {
      const q = parseInput('query', req, repoQuerySchema);
      return opts.registry.listTags(req.params.cid, q.repo);
    },
  );

  app.delete<{ Params: { cid: string }; Querystring: Record<string, string> }>(
    '/registry/:cid/tags',
    { preHandler: requireOperator },
    async (req, reply) => {
      const q = parseInput('query', req, tagQuerySchema);
      await opts.registry.deleteTag(req.params.cid, q.repo, q.tag);
      return reply.status(204).send();
    },
  );
};
