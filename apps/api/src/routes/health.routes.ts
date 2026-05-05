import type { FastifyPluginAsync } from 'fastify';
import { getHealth, type HealthDeps } from '../services/health.service.js';
import { healthResponseSchema } from '../schemas/health.schema.js';

export interface HealthRoutesOptions {
  deps: HealthDeps;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, opts) => {
  app.get('/health', async () => {
    const data = await getHealth(opts.deps);
    // Validate before sending — protects against schema drift
    const validated = healthResponseSchema.parse(data);
    return { data: validated };
  });

  app.get('/health/live', async () => ({ data: { ok: true } }));

  app.get('/health/ready', async () => {
    const data = await getHealth(opts.deps);
    return { data: { ok: data.status !== 'down' } };
  });
};
