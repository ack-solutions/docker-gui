import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload, type JwtConfig } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export interface AuthMiddlewareDeps {
  jwtConfig: JwtConfig;
  /**
   * Optional fresh-state loader. When provided, every authenticated request
   * re-validates the subject against the database: if the user no longer
   * exists or is inactive the request is rejected, and the user's CURRENT db
   * role replaces whatever the (possibly stale) JWT carried. This closes the
   * window where a deactivated / deleted / role-changed user keeps acting on
   * an already-issued access token until it expires. Authentication still
   * comes from the signed JWT; only authorization state is refreshed.
   */
  loadUser?: (id: string) => Promise<{ isActive: boolean; role: string } | null>;
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
    if (deps.loadUser) {
      const fresh = await deps.loadUser(req.user.sub);
      if (!fresh || !fresh.isActive) {
        return reply.status(401).send({
          error: { code: 'auth.session_revoked', message: 'Session is no longer valid' },
        });
      }
      // DB is the source of truth for authorization — apply the live role so a
      // role change (or deactivation) takes effect on the next request.
      req.user = { ...req.user, role: fresh.role };
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
