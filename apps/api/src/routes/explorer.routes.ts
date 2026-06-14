import type { FastifyPluginAsync } from 'fastify';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { DbExplorerService } from '../services/db-explorer.service.js';

export interface ExplorerRoutesOptions {
  explorer: DbExplorerService;
  authMiddleware: AuthMiddlewareDeps;
}

export const explorerRoutes: FastifyPluginAsync<ExplorerRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  // Launching/stopping a sidecar container is a state change → operator+.
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  app.get('/databases/explorers', async () => {
    return opts.explorer.list();
  });

  app.get<{ Params: { id: string } }>('/databases/connections/:id/explorer', async (req) => {
    return opts.explorer.status(req.params.id);
  });

  app.post<{ Params: { id: string } }>(
    '/databases/connections/:id/explorer',
    { preHandler: requireOperator },
    async (req, reply) => {
      const info = await opts.explorer.open(req.params.id);
      return reply.status(202).send(info);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/databases/connections/:id/explorer',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.explorer.stop(req.params.id);
      return reply.status(204).send();
    },
  );
};
