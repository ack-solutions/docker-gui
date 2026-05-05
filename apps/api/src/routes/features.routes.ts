import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { FeaturesService, FeatureKey } from '../services/features.service.js';

export interface FeaturesRoutesOptions {
  features: FeaturesService;
  authMiddleware: AuthMiddlewareDeps;
}

const featureKeySchema = z.enum(['caddy', 'minio', 'email', 'postgres-gui']);

export const featuresRoutes: FastifyPluginAsync<FeaturesRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  app.addHook('preHandler', requireAuth);

  app.get('/features', async () => {
    return opts.features.list();
  });

  app.get<{ Params: { key: string } }>('/features/:key', async (req) => {
    const key = featureKeySchema.parse(req.params.key) as FeatureKey;
    return opts.features.get(key);
  });

  app.post<{ Params: { key: string } }>('/features/:key/enable', async (req) => {
    const key = featureKeySchema.parse(req.params.key) as FeatureKey;
    return opts.features.enable(key);
  });

  app.post<{ Params: { key: string } }>('/features/:key/disable', async (req) => {
    const key = featureKeySchema.parse(req.params.key) as FeatureKey;
    return opts.features.disable(key);
  });
};
