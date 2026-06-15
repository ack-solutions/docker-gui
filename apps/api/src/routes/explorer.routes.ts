import type { FastifyPluginAsync } from 'fastify';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { DbExplorerService } from '../services/db-explorer.service.js';
import { signExplorerToken } from '../lib/explorer-token.js';

export interface ExplorerRoutesOptions {
  explorer: DbExplorerService;
  /** Secret used to mint the explorer access token (the proxy verifies it). */
  secret: string;
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
      // Mint a connection-scoped access URL the browser opens to reach the
      // sidecar through the panel proxy (it bootstraps a session cookie).
      const token = signExplorerToken(req.params.id, opts.secret);
      const accessUrl = `/db-proxy/${req.params.id}/?__dgxt=${encodeURIComponent(token)}`;
      return reply.status(202).send({ ...info, accessUrl });
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
