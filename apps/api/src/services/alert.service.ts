import type { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';

export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

export interface AlertRuleSummary {
  id: string;
  name: string;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  forSeconds: number;
  cooldownSeconds: number;
  webhookUrl: string | null;
  emailTo: string | null;
  enabled: boolean;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  name: string;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  forSeconds?: number;
  cooldownSeconds?: number;
  webhookUrl?: string | null;
  emailTo?: string | null;
  enabled?: boolean;
}

export type UpdateAlertRuleInput = Partial<CreateAlertRuleInput>;

export interface AlertEventView {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  status: 'firing' | 'resolved';
  message: string;
  delivered: boolean;
  createdAt: string;
}

/** A point-in-time snapshot of metric values the evaluator checks rules against. */
export type MetricSnapshot = Record<string, number>;

/**
 * Delivers a fired/resolved alert over one channel. Injected so tests never
 * make real network/SMTP calls. `send` returns `true` when it actually
 * delivered, `false` when the channel isn't configured for this rule (so the
 * caller can record "delivered" only when at least one channel succeeded).
 */
export interface AlertSender {
  send(rule: AlertRuleSummary, event: AlertEventView): Promise<boolean>;
}

export interface AlertServiceOptions {
  /** Single delivery channel (back-compat). Prefer `senders`. */
  sender?: AlertSender;
  /** One or more delivery channels (webhook, email, …). */
  senders?: AlertSender[];
  /** Clock seam for deterministic duration/cooldown tests. */
  clock?: () => number;
}

/** Real webhook sender: POSTs a compact JSON payload. */
export class WebhookAlertSender implements AlertSender {
  async send(rule: AlertRuleSummary, event: AlertEventView): Promise<boolean> {
    if (!rule.webhookUrl) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(rule.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: event.message,
          rule: rule.name,
          metric: event.metric,
          value: event.value,
          status: event.status,
          firedAt: event.createdAt,
        }),
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** A single outbound mail. The transport sets the wire details. */
export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

/** SMTP boundary — wrapped around nodemailer in production, faked in tests. */
export interface MailTransport {
  sendMail(message: MailMessage): Promise<void>;
}

export interface EmailAlertSenderOptions {
  transport: MailTransport;
  /** From address for alert emails. */
  from: string;
}

/** Email sender: delivers fired/resolved alerts to a rule's emailTo list. */
export class EmailAlertSender implements AlertSender {
  constructor(private readonly opts: EmailAlertSenderOptions) {}

  async send(rule: AlertRuleSummary, event: AlertEventView): Promise<boolean> {
    if (!rule.emailTo) return false;
    const recipients = rule.emailTo
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) return false;
    const verb = event.status === 'firing' ? 'FIRING' : 'RESOLVED';
    await this.opts.transport.sendMail({
      from: this.opts.from,
      to: recipients.join(', '),
      subject: `[docker-gui] ${verb}: ${rule.name}`,
      text:
        `${event.message}\n\n` +
        `Rule:   ${rule.name}\n` +
        `Metric: ${event.metric}\n` +
        `Value:  ${event.value}\n` +
        `Status: ${event.status}\n` +
        `Time:   ${event.createdAt}\n`,
    });
    return true;
  }
}

function compare(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
  }
}

const VALID_OPS: AlertOperator[] = ['gt', 'lt', 'gte', 'lte', 'eq'];

export class AlertService {
  private readonly senders: AlertSender[];
  private readonly clock: () => number;
  /** ruleId → epoch ms the condition first became true (debounce tracking). */
  private readonly pendingSince = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaClient,
    options: AlertServiceOptions = {},
  ) {
    // `senders` is preferred; `sender` is kept for back-compat (single channel).
    this.senders = options.senders ?? (options.sender ? [options.sender] : []);
    this.clock = options.clock ?? (() => Date.now());
  }

  // -------------------- Rules --------------------

  async listRules(): Promise<AlertRuleSummary[]> {
    const rows = await this.prisma.alertRule.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toRule);
  }

  async createRule(input: CreateAlertRuleInput): Promise<AlertRuleSummary> {
    if (!VALID_OPS.includes(input.operator)) throw new AppError('alert.invalid_operator', 'Invalid operator', 400);
    const dup = await this.prisma.alertRule.findUnique({ where: { name: input.name } });
    if (dup) throw new AppError('alert.duplicate_name', 'A rule with that name already exists', 409);
    const row = await this.prisma.alertRule.create({
      data: {
        name: input.name,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold,
        forSeconds: input.forSeconds ?? 0,
        cooldownSeconds: input.cooldownSeconds ?? 300,
        webhookUrl: input.webhookUrl ?? null,
        emailTo: input.emailTo ?? null,
        enabled: input.enabled ?? true,
      },
    });
    return toRule(row);
  }

  async updateRule(id: string, input: UpdateAlertRuleInput): Promise<AlertRuleSummary> {
    const row = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Alert rule not found');
    if (input.operator && !VALID_OPS.includes(input.operator)) {
      throw new AppError('alert.invalid_operator', 'Invalid operator', 400);
    }
    if (input.name && input.name !== row.name) {
      const dup = await this.prisma.alertRule.findUnique({ where: { name: input.name } });
      if (dup) throw new AppError('alert.duplicate_name', 'A rule with that name already exists', 409);
    }
    const data: Record<string, unknown> = {};
    for (const k of ['name', 'metric', 'operator', 'threshold', 'forSeconds', 'cooldownSeconds', 'enabled'] as const) {
      if (input[k] !== undefined) data[k] = input[k];
    }
    if (input.webhookUrl !== undefined) data['webhookUrl'] = input.webhookUrl;
    if (input.emailTo !== undefined) data['emailTo'] = input.emailTo;
    const updated = await this.prisma.alertRule.update({ where: { id }, data });
    return toRule(updated);
  }

  async deleteRule(id: string): Promise<void> {
    const row = await this.prisma.alertRule.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Alert rule not found');
    this.pendingSince.delete(id);
    await this.prisma.alertRule.delete({ where: { id } });
  }

  async listEvents(limit = 100): Promise<AlertEventView[]> {
    const rows = await this.prisma.alertEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(500, limit)),
    });
    return rows.map(toEvent);
  }

  // -------------------- Evaluation --------------------

  /**
   * Evaluate all enabled rules against a metric snapshot. Fires a rule when its
   * condition has held for `forSeconds` and it's outside its cooldown; records
   * a `resolved` event when a previously-pending condition clears. Returns the
   * events created this round. Never throws on a delivery failure.
   */
  async evaluate(snapshot: MetricSnapshot): Promise<AlertEventView[]> {
    const now = this.clock();
    const rules = (await this.prisma.alertRule.findMany({ where: { enabled: true } })).map(toRule);
    const created: AlertEventView[] = [];

    for (const rule of rules) {
      const value = snapshot[rule.metric];
      if (value === undefined) {
        this.pendingSince.delete(rule.id);
        continue;
      }
      const breached = compare(value, rule.operator, rule.threshold);

      if (!breached) {
        // Condition cleared. If it had been pending/firing, emit a resolve.
        if (this.pendingSince.has(rule.id)) {
          this.pendingSince.delete(rule.id);
          const ev = await this.record(rule, value, 'resolved', `${rule.name} resolved (${rule.metric}=${value})`);
          created.push(ev);
        }
        continue;
      }

      // Breached — start/continue the debounce timer.
      const since = this.pendingSince.get(rule.id) ?? now;
      if (!this.pendingSince.has(rule.id)) this.pendingSince.set(rule.id, now);
      const heldFor = (now - since) / 1000;
      if (heldFor < rule.forSeconds) continue;

      // Respect cooldown.
      const lastFired = rule.lastFiredAt ? Date.parse(rule.lastFiredAt) : 0;
      if (now - lastFired < rule.cooldownSeconds * 1000) continue;

      const ev = await this.record(
        rule,
        value,
        'firing',
        `${rule.name}: ${rule.metric} ${rule.operator} ${rule.threshold} (is ${value})`,
      );
      await this.prisma.alertRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date(now) } });
      // Best-effort delivery across every channel — never let it break
      // evaluation. Each sender self-gates (returns false when its channel
      // isn't configured for this rule); delivered = at least one succeeded.
      let delivered = false;
      for (const sender of this.senders) {
        try {
          if (await sender.send(rule, ev)) delivered = true;
        } catch {
          // this channel failed; others still get a shot, delivered stays false
        }
      }
      if (delivered) {
        await this.prisma.alertEvent.update({ where: { id: ev.id }, data: { delivered: true } });
        ev.delivered = true;
      }
      created.push(ev);
    }
    return created;
  }

  private async record(
    rule: AlertRuleSummary,
    value: number,
    status: 'firing' | 'resolved',
    message: string,
  ): Promise<AlertEventView> {
    const row = await this.prisma.alertEvent.create({
      data: { ruleId: rule.id, ruleName: rule.name, metric: rule.metric, value, status, message },
    });
    return toEvent(row);
  }
}

function toRule(r: {
  id: string; name: string; metric: string; operator: string; threshold: number;
  forSeconds: number; cooldownSeconds: number; webhookUrl: string | null;
  emailTo: string | null; enabled: boolean;
  lastFiredAt: Date | null; createdAt: Date; updatedAt: Date;
}): AlertRuleSummary {
  return {
    id: r.id, name: r.name, metric: r.metric, operator: r.operator as AlertOperator,
    threshold: r.threshold, forSeconds: r.forSeconds, cooldownSeconds: r.cooldownSeconds,
    webhookUrl: r.webhookUrl, emailTo: r.emailTo, enabled: r.enabled,
    lastFiredAt: r.lastFiredAt ? r.lastFiredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function toEvent(r: {
  id: string; ruleId: string; ruleName: string; metric: string; value: number;
  status: string; message: string; delivered: boolean; createdAt: Date;
}): AlertEventView {
  return {
    id: r.id, ruleId: r.ruleId, ruleName: r.ruleName, metric: r.metric, value: r.value,
    status: r.status as 'firing' | 'resolved', message: r.message, delivered: r.delivered,
    createdAt: r.createdAt.toISOString(),
  };
}
