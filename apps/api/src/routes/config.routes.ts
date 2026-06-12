/**
 * Read-only `/api/v1/config` endpoints.
 *
 * Exposes the typed, layered, secret-masked snapshot the api booted with,
 * so the `/settings` page can render it. UI write-through and DB-stored
 * runtime overrides land in a follow-up (Phase C.2) — those need a Setting
 * model + restart-on-required-restart-key plumbing.
 *
 * Auth: any authenticated user can read. Future RBAC can split "see secrets
 * masked" vs "see at all" — for now we always mask secrets in the response.
 */

import type { FastifyPluginAsync } from 'fastify';
import {
  createRequireAuth,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import { describeForApi, type ConfigSnapshot } from '../config/index.js';

export interface ConfigRoutesOptions {
  snapshot: ConfigSnapshot;
  authMiddleware: AuthMiddlewareDeps;
}

export const configRoutes: FastifyPluginAsync<ConfigRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  app.addHook('preHandler', requireAuth);

  /** Full registry + current values + provenance (secrets masked). */
  app.get('/config', async () => {
    const keys = describeForApi(opts.snapshot);
    return { data: { keys, warnings: opts.snapshot.warnings() } };
  });

  /**
   * Single key lookup — same shape as one entry in /config's `keys[]`.
   * Useful for the "edit this setting" drawer in the UI without re-fetching
   * the whole catalogue.
   */
  app.get<{ Params: { key: string } }>('/config/:key', async (req, reply) => {
    const wanted = req.params.key;
    const keys = describeForApi(opts.snapshot);
    const found = keys.find((k) => k.key === wanted);
    if (!found) {
      return reply.status(404).send({
        error: { code: 'not_found', message: `Unknown config key "${wanted}"` },
      });
    }
    return { data: found };
  });
};
