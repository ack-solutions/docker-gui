import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { BackupService } from '../services/backup.service.js';
import { startBackupSchema, restoreBackupSchema } from '../schemas/database.schema.js';

export interface BackupRoutesOptions {
  backups: BackupService;
  authMiddleware: AuthMiddlewareDeps;
}

function parseBody<S extends z.ZodTypeAny>(req: FastifyRequest, schema: S): z.output<S> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const backupRoutes: FastifyPluginAsync<BackupRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  // Trigger a backup of a connection to S3.
  app.post<{ Params: { id: string } }>(
    '/databases/connections/:id/backups',
    { preHandler: requireOperator },
    async (req, reply) => {
      const input = parseBody(req, startBackupSchema);
      const job = await opts.backups.startBackup({
        connectionId: req.params.id,
        s3ConnectionId: input.s3ConnectionId,
        bucket: input.bucket,
      });
      return reply.status(202).send(job);
    },
  );

  // Backup history for one connection.
  app.get<{ Params: { id: string } }>('/databases/connections/:id/backups', async (req) => {
    return opts.backups.listJobs(req.params.id);
  });

  // All backup jobs.
  app.get('/databases/backups', async () => {
    return opts.backups.listJobs();
  });

  app.get<{ Params: { jobId: string } }>('/databases/backups/:jobId', async (req) => {
    return opts.backups.getJob(req.params.jobId);
  });

  // Restore a successful backup (destructive) — operator+.
  app.post<{ Params: { jobId: string } }>(
    '/databases/backups/:jobId/restore',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseBody(req, restoreBackupSchema);
      return opts.backups.restoreBackup(
        req.params.jobId,
        input.targetConnectionId,
      );
    },
  );
};
