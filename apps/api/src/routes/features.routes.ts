import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { FeaturesService, FeatureKey } from '../services/features.service.js';

export interface FeaturesRoutesOptions {
  features: FeaturesService;
  authMiddleware: AuthMiddlewareDeps;
}

const featureKeySchema = z.enum(['caddy', 'minio', 'email', 'postgres-gui', 'registry']);

export const featuresRoutes: FastifyPluginAsync<FeaturesRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  // Enabling/disabling a feature spins infrastructure containers up or down —
  // that is an admin-level operation, not something an operator or viewer does.
  const requireAdmin = requireRole('owner', 'admin');
  app.addHook('preHandler', requireAuth);

  app.get('/features', async () => {
    return opts.features.list();
  });

  // Prerequisites for on-prem email (read-only; any authenticated role). The
  // email feature stays gated — this surfaces exactly what hosting mail needs.
  // Declared BEFORE /features/:key so it isn't shadowed by the param route.
  app.get<{ Querystring: { domain?: string } }>('/features/email/preconditions', async (req) => {
    const domain = typeof req.query.domain === 'string' ? req.query.domain : null;
    return opts.features.emailPreconditions(domain);
  });

  app.get<{ Params: { key: string } }>('/features/:key', async (req) => {
    const key = featureKeySchema.parse(req.params.key) as FeatureKey;
    return opts.features.get(key);
  });

  app.post<{ Params: { key: string } }>(
    '/features/:key/enable',
    { preHandler: requireAdmin },
    async (req) => {
      const key = featureKeySchema.parse(req.params.key) as FeatureKey;
      return opts.features.enable(key);
    },
  );

  app.post<{ Params: { key: string } }>(
    '/features/:key/disable',
    { preHandler: requireAdmin },
    async (req) => {
      const key = featureKeySchema.parse(req.params.key) as FeatureKey;
      return opts.features.disable(key);
    },
  );
};
