import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DockerContainersService } from '../services/docker-containers.service.js';
import type { DockerImagesService } from '../services/docker-images.service.js';
import type { DockerVolumesService } from '../services/docker-volumes.service.js';
import type { DockerNetworksService } from '../services/docker-networks.service.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';

export interface DockerRoutesOptions {
  containers: DockerContainersService;
  images: DockerImagesService;
  volumes: DockerVolumesService;
  networks: DockerNetworksService;
  authMiddleware: AuthMiddlewareDeps;
}

const idParamSchema = z.object({ id: z.string().min(1).max(256) });
const nameParamSchema = z.object({ name: z.string().min(1).max(256) });
const listContainersQuerySchema = z.object({ all: z.coerce.boolean().default(true) });
const logsQuerySchema = z.object({ tail: z.coerce.number().int().min(1).max(2000).default(200) });
const removeContainerQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
  volumes: z.coerce.boolean().default(false),
});
const removeImageQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
});
const removeVolumeQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
});
const pullImageBodySchema = z.object({
  reference: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9._\-/:@]+$/, 'Invalid image reference'),
});

function parse<T>(req: FastifyRequest, schema: z.ZodSchema<T>, source: 'body' | 'params' | 'query'): T {
  const data = req[source];
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const dockerRoutes: FastifyPluginAsync<DockerRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireOperator = requireRole('owner', 'admin', 'operator');

  // Auth required for everything in this scope
  app.addHook('preHandler', requireAuth);

  // ---------- Containers ----------

  app.get('/docker/containers', async (req, reply) => {
    const all = parse(req, listContainersQuerySchema, 'query').all ?? true;
    const list = await opts.containers.list({ all });
    return reply.send({ data: list });
  });

  app.get('/docker/containers/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.containers.inspect(id) });
  });

  app.post('/docker/containers/:id/start', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.containers.start(id);
    return reply.send({ data: { id, action: 'start', ok: true } });
  });

  app.post('/docker/containers/:id/stop', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.containers.stop(id);
    return reply.send({ data: { id, action: 'stop', ok: true } });
  });

  app.post('/docker/containers/:id/restart', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.containers.restart(id);
    return reply.send({ data: { id, action: 'restart', ok: true } });
  });

  app.delete('/docker/containers/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const q = parse(req, removeContainerQuerySchema, 'query');
    await opts.containers.remove(id, { force: q.force ?? false, removeVolumes: q.volumes ?? false });
    return reply.send({ data: { id, action: 'remove', ok: true } });
  });

  app.get('/docker/containers/:id/logs', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const tail = parse(req, logsQuerySchema, 'query').tail ?? 200;
    const text = await opts.containers.logs(id, { tail });
    return reply.send({ data: { id, tail, text } });
  });

  // ---------- Images ----------

  app.get('/docker/images', async (_req, reply) => {
    return reply.send({ data: await opts.images.list() });
  });

  app.get('/docker/images/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.images.inspect(id) });
  });

  app.post('/docker/images/pull', { preHandler: requireOperator }, async (req, reply) => {
    const body = parse(req, pullImageBodySchema, 'body');
    const result = await opts.images.pull(body.reference);
    return reply.send({ data: result });
  });

  app.delete('/docker/images/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const q = parse(req, removeImageQuerySchema, 'query');
    await opts.images.remove(id, { force: q.force ?? false });
    return reply.send({ data: { id, action: 'remove', ok: true } });
  });

  // ---------- Volumes ----------

  app.get('/docker/volumes', async (_req, reply) => {
    return reply.send({ data: await opts.volumes.list() });
  });

  app.get('/docker/volumes/:name', async (req, reply) => {
    const { name } = parse(req, nameParamSchema, 'params');
    return reply.send({ data: await opts.volumes.inspect(name) });
  });

  app.delete('/docker/volumes/:name', { preHandler: requireOperator }, async (req, reply) => {
    const { name } = parse(req, nameParamSchema, 'params');
    const q = parse(req, removeVolumeQuerySchema, 'query');
    await opts.volumes.remove(name, { force: q.force ?? false });
    return reply.send({ data: { name, action: 'remove', ok: true } });
  });

  app.post('/docker/volumes/prune', { preHandler: requireOperator }, async (_req, reply) => {
    return reply.send({ data: await opts.volumes.prune() });
  });

  // ---------- Networks ----------

  app.get('/docker/networks', async (_req, reply) => {
    return reply.send({ data: await opts.networks.list() });
  });

  app.get('/docker/networks/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.networks.inspect(id) });
  });

  app.delete('/docker/networks/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.networks.remove(id);
    return reply.send({ data: { id, action: 'remove', ok: true } });
  });

  app.post('/docker/networks/prune', { preHandler: requireOperator }, async (_req, reply) => {
    return reply.send({ data: await opts.networks.prune() });
  });
};
