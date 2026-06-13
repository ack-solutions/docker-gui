import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service.js';
import type { UserService } from '../services/user.service.js';
import type { AuthMiddlewareDeps } from '../middleware/auth.middleware.js';
import { createRequireAuth } from '../middleware/auth.middleware.js';

export interface AuthRoutesOptions {
  auth: AuthService;
  users: UserService;
  authMiddleware: AuthMiddlewareDeps;
  setupSecret: string;
}

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(500),
});

const bootstrapSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(100),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

function publicUser(user: { id: string; email: string; name: string; role: string; isActive: boolean }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

async function parseBody<T>(req: FastifyRequest, schema: z.ZodSchema<T>): Promise<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = await parseBody(req, loginSchema);
    const result = await opts.auth.login(body);
    return reply.status(200).send({
      data: {
        user: publicUser(result.user),
        accessToken: result.accessToken,
        accessExpiresAt: result.accessExpiresAt.toISOString(),
        refreshToken: result.refreshToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString(),
      },
    });
  });

  // POST /auth/refresh
  app.post('/auth/refresh', async (req, reply) => {
    const body = await parseBody(req, refreshSchema);
    const result = await opts.auth.refresh(body.refreshToken);
    return reply.status(200).send({
      data: {
        user: publicUser(result.user),
        accessToken: result.accessToken,
        accessExpiresAt: result.accessExpiresAt.toISOString(),
        refreshToken: result.refreshToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString(),
      },
    });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (req, reply) => {
    const body = await parseBody(req, refreshSchema);
    await opts.auth.logout(body.refreshToken);
    return reply.status(204).send();
  });

  // GET /auth/me — protected
  app.get('/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({
        error: { code: 'auth.unauthorized', message: 'Authentication required' },
      });
    }
    const fresh = await opts.users.findById(req.user.sub);
    if (!fresh) {
      return reply.status(401).send({
        error: { code: 'auth.user_gone', message: 'User no longer exists' },
      });
    }
    return reply.send({ data: { user: publicUser(fresh) } });
  });

  // POST /auth/change-password — self-service; requires the current password
  app.post('/auth/change-password', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({
        error: { code: 'auth.unauthorized', message: 'Authentication required' },
      });
    }
    const body = await parseBody(req, changePasswordSchema);
    await opts.auth.changeOwnPassword(req.user.sub, body.currentPassword, body.newPassword);
    return reply.status(204).send();
  });

  // POST /setup/bootstrap — only available when no users exist; requires SETUP_SECRET
  app.post('/setup/bootstrap', async (req, reply) => {
    const provided = req.headers['x-setup-secret'];
    if (typeof provided !== 'string' || provided !== opts.setupSecret) {
      return reply.status(403).send({
        error: { code: 'setup.invalid_secret', message: 'Invalid setup secret' },
      });
    }
    const existing = await opts.users.countAll();
    if (existing > 0) {
      return reply.status(409).send({
        error: {
          code: 'setup.already_initialized',
          message: 'An admin user already exists. Use the regular login flow.',
        },
      });
    }
    const body = await parseBody(req, bootstrapSchema);
    const user = await opts.users.create({ ...body, role: 'owner' });
    return reply.status(201).send({ data: { user: publicUser(user) } });
  });
};
