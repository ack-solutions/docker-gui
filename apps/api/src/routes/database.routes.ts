import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { DatabaseService } from '../services/database.service.js';
import {
  createDatabaseConnectionSchema,
  updateDatabaseConnectionSchema,
  runQuerySchema,
} from '../schemas/database.schema.js';

export interface DatabaseRoutesOptions {
  databases: DatabaseService;
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

export const databaseRoutes: FastifyPluginAsync<DatabaseRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  // -------------------- Discovery --------------------

  app.get('/databases/discover', async () => {
    return opts.databases.discover();
  });

  // -------------------- Connections --------------------

  app.get('/databases/connections', async () => {
    return opts.databases.listConnections();
  });

  app.get<{ Params: { id: string } }>('/databases/connections/:id', async (req) => {
    return opts.databases.getConnection(req.params.id);
  });

  app.post('/databases/connections', { preHandler: requireOperator }, async (req, reply) => {
    const input = parseBody(req, createDatabaseConnectionSchema);
    const created = await opts.databases.createConnection({
      name: input.name,
      engine: input.engine,
      host: input.host,
      username: input.username,
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.password !== undefined ? { password: input.password } : {}),
      ...(input.database !== undefined ? { database: input.database } : {}),
      ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
      ...(input.containerId !== undefined ? { containerId: input.containerId } : {}),
    });
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/databases/connections/:id',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseBody(req, updateDatabaseConnectionSchema);
      return opts.databases.updateConnection(req.params.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.host !== undefined ? { host: input.host } : {}),
        ...(input.port !== undefined ? { port: input.port } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        ...(input.database !== undefined ? { database: input.database } : {}),
        ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/databases/connections/:id',
    { preHandler: requireOperator },
    async (req, reply) => {
      await opts.databases.deleteConnection(req.params.id);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/databases/connections/:id/verify',
    { preHandler: requireOperator },
    async (req) => {
      return opts.databases.verifyConnection(req.params.id);
    },
  );

  // -------------------- Query console --------------------
  // Running SQL — even read-only — can read any data the DB user can see, so
  // it's operator+ only (never viewers).
  app.post<{ Params: { id: string } }>(
    '/databases/connections/:id/query',
    { preHandler: requireOperator },
    async (req) => {
      const input = parseBody(req, runQuerySchema);
      return opts.databases.runQuery(req.params.id, input.sql, {
        ...(input.readOnly !== undefined ? { readOnly: input.readOnly } : {}),
        ...(input.maxRows !== undefined ? { maxRows: input.maxRows } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
      });
    },
  );
};
