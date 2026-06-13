/**
 * Audit log read API. Write-side is automatic via the `onResponse` hook
 * in app.ts — there is intentionally NO write endpoint exposed here, so
 * a compromised user account cannot forge or delete history.
 *
 * Reads are restricted to `owner` + `admin` roles. Other authenticated
 * users get 403 even if they can see the related resources elsewhere.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { AuditLogService } from '../services/audit-log.service.js';

export interface AuditRoutesOptions {
  audit: AuditLogService;
  authMiddleware: AuthMiddlewareDeps;
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(64).optional(),
  actionPrefix: z.string().min(1).max(64).optional(),
  actorId: z.string().min(1).max(64).optional(),
  targetType: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(256).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeTotal: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

function parseQuery<S extends z.ZodTypeAny>(req: FastifyRequest, schema: S): z.output<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const auditRoutes: FastifyPluginAsync<AuditRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireAdmin = requireRole('owner', 'admin');

  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireAdmin);

  app.get('/audit', async (req, reply) => {
    const q = parseQuery(req, listQuerySchema);
    const page = await opts.audit.list({
      ...(q.limit !== undefined ? { limit: q.limit } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      ...(q.action !== undefined ? { action: q.action } : {}),
      ...(q.actionPrefix !== undefined ? { actionPrefix: q.actionPrefix } : {}),
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.targetType !== undefined ? { targetType: q.targetType } : {}),
      ...(q.targetId !== undefined ? { targetId: q.targetId } : {}),
      ...(q.from !== undefined ? { from: q.from } : {}),
      ...(q.to !== undefined ? { to: q.to } : {}),
      ...(q.includeTotal !== undefined ? { includeTotal: q.includeTotal } : {}),
    });
    return reply.send({ data: page });
  });
};
