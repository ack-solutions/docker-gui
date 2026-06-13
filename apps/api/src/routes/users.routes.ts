/**
 * User management API. Owners + admins only (route-level requireAdmin).
 * Finer privilege rules (only-owner-touches-owner, last-owner protection,
 * no role escalation above your own) live in UserService and surface as 403/409.
 *
 * Sessions are revoked whenever an account is deactivated, deleted, has its
 * role changed, or its password reset — so a privilege change takes effect on
 * the next request, not whenever the victim's refresh token happens to expire.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { AuthService } from '../services/auth.service.js';
import {
  type UserService,
  type ActorContext,
  type UserRole,
  isValidRole,
} from '../services/user.service.js';

export interface UsersRoutesOptions {
  users: UserService;
  auth: AuthService;
  authMiddleware: AuthMiddlewareDeps;
}

const roleSchema = z.enum(['owner', 'admin', 'operator', 'viewer']);

const createSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(100),
  role: roleSchema,
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

const passwordSchema = z.object({
  newPassword: z.string().min(8).max(200),
});

function parse<S extends z.ZodTypeAny>(req: FastifyRequest, schema: S, source: 'body' | 'params'): z.output<S> {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

const idParamSchema = z.object({ id: z.string().min(1).max(64) });

function actorOf(req: FastifyRequest): ActorContext {
  // requireAuth guarantees req.user is set by the time these handlers run.
  const u = req.user!;
  const role: UserRole = isValidRole(u.role) ? u.role : 'viewer';
  return { id: u.sub, role };
}

function publicUser(u: { id: string; email: string; name: string; role: string; isActive: boolean; createdAt?: Date }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    ...(u.createdAt ? { createdAt: u.createdAt } : {}),
  };
}

export const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireAdmin = requireRole('owner', 'admin');
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireAdmin);

  app.get('/users', async (_req, reply) => {
    const users = await opts.users.list();
    return reply.send({ data: users.map(publicUser) });
  });

  app.post('/users', async (req, reply) => {
    const body = parse(req, createSchema, 'body');
    const created = await opts.users.createAsActor(
      { email: body.email, password: body.password, name: body.name, role: body.role },
      actorOf(req),
    );
    return reply.status(201).send({ data: publicUser(created) });
  });

  app.patch<{ Params: { id: string } }>('/users/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const body = parse(req, updateSchema, 'body');
    const updated = await opts.users.update(
      id,
      {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      actorOf(req),
    );
    // A role change or deactivation must take effect immediately.
    if (body.role !== undefined || body.isActive === false) {
      await opts.auth.revokeAllForUser(id);
    }
    return reply.send({ data: publicUser(updated) });
  });

  app.delete<{ Params: { id: string } }>('/users/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.users.delete(id, actorOf(req));
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/users/:id/password', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const body = parse(req, passwordSchema, 'body');
    const actor = actorOf(req);
    // Reuse the privilege rule: only an owner may reset an owner's password.
    const target = await opts.users.findById(id);
    if (!target) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'User not found' } });
    }
    if (target.role === 'owner' && actor.role !== 'owner') {
      return reply
        .status(403)
        .send({ error: { code: 'user.forbidden', message: 'Only an owner can reset an owner password' } });
    }
    await opts.users.setPassword(id, body.newPassword);
    // Force re-auth everywhere with the new credential.
    await opts.auth.revokeAllForUser(id);
    return reply.status(204).send();
  });
};
