import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRequireAuth,
  requireRole,
  type AuthMiddlewareDeps,
} from '../middleware/auth.middleware.js';
import type { AlertService } from '../services/alert.service.js';

export interface AlertRoutesOptions {
  alerts: AlertService;
  /** Lists selectable metric keys (system + per-disk + per-container). */
  metricCatalog: () => Promise<Array<{ value: string; label: string }>>;
  authMiddleware: AuthMiddlewareDeps;
}

const operatorSchema = z.enum(['gt', 'lt', 'gte', 'lte', 'eq']);

const createRuleSchema = z.object({
  name: z.string().min(1).max(80),
  metric: z.string().min(1).max(120),
  operator: operatorSchema,
  threshold: z.number(),
  forSeconds: z.number().int().min(0).max(86400).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  webhookUrl: z.string().url().max(2048).nullable().optional(),
  enabled: z.boolean().optional(),
});

const updateRuleSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    metric: z.string().min(1).max(120).optional(),
    operator: operatorSchema.optional(),
    threshold: z.number().optional(),
    forSeconds: z.number().int().min(0).max(86400).optional(),
    cooldownSeconds: z.number().int().min(0).max(86400).optional(),
    webhookUrl: z.string().url().max(2048).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

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

export const alertRoutes: FastifyPluginAsync<AlertRoutesOptions> = async (app, opts) => {
  const requireAuth = createRequireAuth(opts.authMiddleware);
  // Managing alert rules (incl. webhook URLs) is an admin operation.
  const requireAdmin = requireRole('owner', 'admin');
  app.addHook('preHandler', requireAuth);

  app.get('/alerts/rules', async () => opts.alerts.listRules());
  app.get('/alerts/events', async () => opts.alerts.listEvents());
  // Metric keys a rule can target right now (CPU/mem, each disk, each running
  // container). Drives the rule dialog's dropdown so users don't guess keys.
  app.get('/alerts/metrics', async () => opts.metricCatalog());

  app.post('/alerts/rules', { preHandler: requireAdmin }, async (req, reply) => {
    const b = parseBody(req, createRuleSchema);
    const created = await opts.alerts.createRule({
      name: b.name,
      metric: b.metric,
      operator: b.operator,
      threshold: b.threshold,
      ...(b.forSeconds !== undefined ? { forSeconds: b.forSeconds } : {}),
      ...(b.cooldownSeconds !== undefined ? { cooldownSeconds: b.cooldownSeconds } : {}),
      ...(b.webhookUrl !== undefined ? { webhookUrl: b.webhookUrl } : {}),
      ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
    });
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/alerts/rules/:id',
    { preHandler: requireAdmin },
    async (req) => {
      const b = parseBody(req, updateRuleSchema);
      return opts.alerts.updateRule(req.params.id, {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.metric !== undefined ? { metric: b.metric } : {}),
        ...(b.operator !== undefined ? { operator: b.operator } : {}),
        ...(b.threshold !== undefined ? { threshold: b.threshold } : {}),
        ...(b.forSeconds !== undefined ? { forSeconds: b.forSeconds } : {}),
        ...(b.cooldownSeconds !== undefined ? { cooldownSeconds: b.cooldownSeconds } : {}),
        ...(b.webhookUrl !== undefined ? { webhookUrl: b.webhookUrl } : {}),
        ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/alerts/rules/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      await opts.alerts.deleteRule(req.params.id);
      return reply.status(204).send();
    },
  );
};
