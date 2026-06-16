import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SitesService } from '../services/sites.service.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import { createSiteSchema, updateSiteSchema } from '../schemas/site.schema.js';
import type { DeployTokenService } from '../services/deploy-token.service.js';

export interface SitesRoutesOptions {
  sites: SitesService;
  tokens: DeployTokenService;
  authMiddleware: AuthMiddlewareDeps;
}

const mintTokenSchema = z.object({
  name: z.string().min(1).max(80).trim().default('deploy token'),
  scope: z.enum(['static', 'container', 'both']).default('static'),
});

const idParamSchema = z.object({ id: z.string().min(1).max(64) });

function parse<S extends z.ZodTypeAny>(
  req: FastifyRequest,
  schema: S,
  source: 'body' | 'params' | 'query',
): z.output<S> {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const sitesRoutes: FastifyPluginAsync<SitesRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireOperator = requireRole('owner', 'admin', 'operator');

  app.addHook('preHandler', requireAuth);

  app.get('/sites', async (_req, reply) => {
    return reply.send({ data: await opts.sites.list() });
  });

  app.get('/sites/status', async (_req, reply) => {
    const status = await opts.sites.caddyStatus();
    return reply.send({
      data: { caddyConfigured: status.configured, caddyReachable: status.reachable },
    });
  });

  app.get('/sites/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.sites.get(id) });
  });

  app.post('/sites', { preHandler: requireOperator }, async (req, reply) => {
    const body = parse(req, createSiteSchema, 'body');
    return reply.status(201).send({ data: await opts.sites.create(body) });
  });

  app.patch('/sites/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const body = parse(req, updateSiteSchema, 'body');
    return reply.send({ data: await opts.sites.update(id, body) });
  });

  app.delete('/sites/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.sites.remove(id);
    return reply.send({ data: { id, action: 'remove', ok: true } });
  });

  app.post('/sites/apply', { preHandler: requireOperator }, async (_req, reply) => {
    return reply.send({ data: await opts.sites.applyAll() });
  });

  // ---- Deploy tokens (CI credentials). Mint/revoke are operator actions;
  //      the plaintext is returned ONCE at mint and never again. ----
  app.get('/sites/:id/deploy-tokens', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.tokens.list(id) });
  });

  app.post('/sites/:id/deploy-tokens', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const body = parse(req, mintTokenSchema, 'body');
    const { token, summary } = await opts.tokens.mint(id, body.name, body.scope);
    // `token` is the plaintext — shown once, never stored.
    return reply.status(201).send({ data: { ...summary, token } });
  });

  app.delete<{ Params: { id: string; tokenId: string } }>(
    '/sites/:id/deploy-tokens/:tokenId',
    { preHandler: requireOperator },
    async (req, reply) => {
      const { id } = parse(req, idParamSchema, 'params');
      await opts.tokens.revoke(id, req.params.tokenId);
      return reply.send({ data: { id: req.params.tokenId, action: 'revoke', ok: true } });
    },
  );
};
