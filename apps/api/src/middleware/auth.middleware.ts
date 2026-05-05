import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload, type JwtConfig } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export interface AuthMiddlewareDeps {
  jwtConfig: JwtConfig;
}

export function createRequireAuth(deps: AuthMiddlewareDeps) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: { code: 'auth.missing_token', message: 'Missing or malformed Authorization header' },
      });
    }
    const token = header.slice(7).trim();
    if (!token) {
      return reply.status(401).send({
        error: { code: 'auth.missing_token', message: 'Empty bearer token' },
      });
    }
    try {
      req.user = verifyAccessToken(token, deps.jwtConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      return reply.status(401).send({
        error: { code: 'auth.invalid_token', message },
      });
    }
  };
}

export function requireRole(...roles: string[]) {
  return async function check(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user) {
      return reply.status(401).send({
        error: { code: 'auth.unauthorized', message: 'Authentication required' },
      });
    }
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({
        error: { code: 'auth.forbidden', message: 'Insufficient role' },
      });
    }
  };
}
