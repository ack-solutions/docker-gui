import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DnsService } from '../services/dns.service.js';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import {
  createDnsProviderSchema,
  dnsRecordInputSchema,
  type DnsRecordInputApi,
  propagationCheckQuerySchema,
  recommendedQuerySchema,
  updateDnsProviderSchema,
} from '../schemas/dns.schema.js';
import type { DnsRecordInput } from '../lib/dns/types.js';
import { AppError, NotFoundError } from '../lib/errors.js';

export interface DnsRoutesOptions {
  dns: DnsService;
  authMiddleware: AuthMiddlewareDeps;
}

const idParamSchema = z.object({ id: z.string().min(1).max(64) });
const recordParamsSchema = z.object({
  id: z.string().min(1).max(64),
  zoneId: z.string().min(1).max(64),
  recordId: z.string().min(1).max(64),
});
const zoneParamSchema = z.object({
  id: z.string().min(1).max(64),
  zoneId: z.string().min(1).max(64),
});
const listRecordsQuerySchema = z.object({
  name: z
    .string()
    .max(253)
    .optional(),
});

function parse<S extends z.ZodTypeAny>(
  req: FastifyRequest,
  schema: S,
  source: 'body' | 'params' | 'query',
): z.output<S> {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const err = new Error('Validation failed');
    (err as Error & { statusCode: number; details: unknown }).statusCode = 400;
    (err as Error & { statusCode: number; details: unknown }).details = result.error.flatten();
    throw err;
  }
  return result.data;
}

export const dnsRoutes: FastifyPluginAsync<DnsRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  const requireOperator = requireRole('owner', 'admin', 'operator');
  app.addHook('preHandler', requireAuth);

  // --- providers ---
  app.get('/dns/providers', async (_req, reply) => {
    return reply.send({ data: await opts.dns.list() });
  });

  app.get('/dns/providers/:id', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.dns.get(id) });
  });

  app.post('/dns/providers', { preHandler: requireOperator }, async (req, reply) => {
    const body = parse(req, createDnsProviderSchema, 'body');
    return reply.status(201).send({ data: await opts.dns.create(body) });
  });

  app.patch('/dns/providers/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    const body = parse(req, updateDnsProviderSchema, 'body');
    return reply.send({ data: await opts.dns.update(id, body) });
  });

  app.delete('/dns/providers/:id', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    await opts.dns.remove(id);
    return reply.send({ data: { id, action: 'remove', ok: true } });
  });

  app.post('/dns/providers/:id/verify', { preHandler: requireOperator }, async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    return reply.send({ data: await opts.dns.verify(id) });
  });

  // --- zones / records ---
  app.get('/dns/providers/:id/zones', async (req, reply) => {
    const { id } = parse(req, idParamSchema, 'params');
    try {
      return reply.send({ data: await opts.dns.listZones(id) });
    } catch (err) {
      throw mapApiError(err);
    }
  });

  app.get('/dns/providers/:id/zones/:zoneId/records', async (req, reply) => {
    const { id, zoneId } = parse(req, zoneParamSchema, 'params');
    const { name } = parse(req, listRecordsQuerySchema, 'query');
    try {
      return reply.send({ data: await opts.dns.listRecords(id, zoneId, name) });
    } catch (err) {
      throw mapApiError(err);
    }
  });

  app.post(
    '/dns/providers/:id/zones/:zoneId/records',
    { preHandler: requireOperator },
    async (req, reply) => {
      const { id, zoneId } = parse(req, zoneParamSchema, 'params');
      const body = parse(req, dnsRecordInputSchema, 'body');
      try {
        return reply
          .status(201)
          .send({ data: await opts.dns.createRecord(id, zoneId, toRecordInput(body)) });
      } catch (err) {
        throw mapApiError(err);
      }
    },
  );

  app.delete(
    '/dns/providers/:id/zones/:zoneId/records/:recordId',
    { preHandler: requireOperator },
    async (req, reply) => {
      const { id, zoneId, recordId } = parse(req, recordParamsSchema, 'params');
      try {
        await opts.dns.deleteRecord(id, zoneId, recordId);
        return reply.send({ data: { id: recordId, action: 'remove', ok: true } });
      } catch (err) {
        throw mapApiError(err);
      }
    },
  );

  // --- recommended records for a domain ---
  app.get('/dns/recommended', async (req, reply) => {
    const { providerId, domain } = parse(req, recommendedQuerySchema, 'query');
    try {
      const zone = await opts.dns.findZone(providerId, domain);
      if (!zone) {
        return reply.status(404).send({
          error: {
            code: 'dns.zone_not_found',
            message: `No zone for "${domain}" found in this provider's account`,
          },
        });
      }
      return reply.send({
        data: {
          zone,
          recommended: opts.dns.recommendedFor(zone.name, domain),
        },
      });
    } catch (err) {
      throw mapApiError(err);
    }
  });

  // --- public-resolver propagation check ---
  app.get('/dns/propagation', async (req, reply) => {
    const { name, type, expected } = parse(req, propagationCheckQuerySchema, 'query');
    try {
      return reply.send({ data: await opts.dns.propagation(name, type, expected) });
    } catch (err) {
      throw mapApiError(err);
    }
  });
};

/**
 * Strip undefined optional fields before passing to the service layer. With
 * exactOptionalPropertyTypes:true, `{ ttl: undefined }` is invalid for
 * `ttl?: number` — we have to omit the key entirely.
 */
function toRecordInput(input: DnsRecordInputApi): DnsRecordInput {
  const out: DnsRecordInput = { type: input.type, name: input.name, value: input.value };
  if (input.ttl !== undefined) out.ttl = input.ttl;
  if (input.proxied !== undefined) out.proxied = input.proxied;
  if (input.priority !== undefined) out.priority = input.priority;
  return out;
}

/**
 * Translate an upstream error (CloudflareError, network error) into an
 * AppError with a stable code so the UI can render a friendly message.
 */
function mapApiError(err: unknown): unknown {
  if (err instanceof AppError) return err;
  if (err instanceof NotFoundError) return err;
  // Provider-specific upstream errors → one stable code (matched by name to
  // avoid importing each adapter). Without this, a Route 53 failure would
  // bypass the contract and bubble to the global handler as an "Unhandled
  // error", logging raw AWS SDK details.
  if (err instanceof Error && (err.name === 'CloudflareError' || err.name === 'Route53Error')) {
    return new AppError('dns.upstream_error', err.message, 502);
  }
  return err;
}
