import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import type { DeployService } from '../services/deploy.service.js';
import type { DeployTokenService } from '../services/deploy-token.service.js';

export interface DeployRoutesOptions {
  deploy: DeployService;
  tokens: DeployTokenService;
}

const MAX_UPLOAD = 256 * 1024 * 1024; // 256 MB compressed-upload ceiling

const imageBodySchema = z.object({
  image: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._\-:/@]*$/, 'Invalid image reference'),
});

function bearer(req: FastifyRequest): string | undefined {
  const h = req.headers['authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  return undefined;
}

/** A JSON body means a container deploy; a binary body means a static upload. */
function isContainerDeploy(req: FastifyRequest): boolean {
  return (req.headers['content-type'] ?? '').includes('application/json');
}

/**
 * CI deploy endpoint. Registered in its OWN plugin scope so it does NOT inherit
 * the JWT `requireAuth` preHandler that guards the rest of /sites — CI presents
 * a per-site deploy token, not an operator login. Authentication runs in
 * `onRequest` (before the body is buffered) so an unauthenticated caller can't
 * pin memory by streaming a large upload.
 */
export const deployRoutes: FastifyPluginAsync<DeployRoutesOptions> = async (app, opts) => {
  // Raw gzipped-tar body, scoped to this plugin only.
  app.addContentTypeParser(
    ['application/gzip', 'application/x-gzip', 'application/octet-stream'],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD },
    (_req, body, done) => done(null, body),
  );

  app.post<{ Params: { id: string } }>(
    '/sites/:id/deploy',
    {
      bodyLimit: MAX_UPLOAD,
      onRequest: async (req) => {
        // Authenticate BEFORE the body is read, with the scope matching the
        // deploy kind (a static-only token can't recreate a container).
        const need = isContainerDeploy(req) ? 'container' : 'static';
        const auth = await opts.tokens.authenticate(req.params.id, bearer(req), need);
        if (!auth) {
          throw new AppError('deploy.unauthorized', 'Invalid or missing deploy token', 401);
        }
      },
    },
    async (req, reply) => {
      if (isContainerDeploy(req)) {
        const parsed = imageBodySchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError('deploy.bad_body', 'Expected JSON { image } with a valid image reference', 400);
        }
        const result = await opts.deploy.deployContainer(req.params.id, parsed.data.image);
        return reply.send({ data: result });
      }
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new AppError(
          'deploy.bad_body',
          'Expected a gzipped tar of the build (Content-Type: application/gzip)',
          400,
        );
      }
      const result = await opts.deploy.deployStatic(req.params.id, body);
      return reply.send({ data: result });
    },
  );
};
