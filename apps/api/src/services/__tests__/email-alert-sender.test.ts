import { describe, it, expect } from 'vitest';
import {
  EmailAlertSender,
  type AlertEventView,
  type AlertRuleSummary,
  type MailMessage,
  type MailTransport,
} from '../alert.service.js';

/** Capturing fake SMTP transport (external boundary — no real nodemailer). */
function fakeTransport(): { transport: MailTransport; sent: MailMessage[]; failNext: () => void } {
  const sent: MailMessage[] = [];
  let fail = false;
  return {
    sent,
    failNext: () => {
      fail = true;
    },
    transport: {
      async sendMail(message: MailMessage) {
        if (fail) throw new Error('smtp 554');
        sent.push(message);
      },
    },
  };
}

function rule(over: Partial<AlertRuleSummary> = {}): AlertRuleSummary {
  return {
    id: 'r1',
    name: 'high-mem',
    metric: 'system.memory.percent',
    operator: 'gt',
    threshold: 90,
    forSeconds: 0,
    cooldownSeconds: 300,
    webhookUrl: null,
    emailTo: 'ops@example.com, sre@example.com',
    enabled: true,
    lastFiredAt: null,
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    ...over,
  };
}

function event(over: Partial<AlertEventView> = {}): AlertEventView {
  return {
    id: 'e1',
    ruleId: 'r1',
    ruleName: 'high-mem',
    metric: 'system.memory.percent',
    value: 95,
    status: 'firing',
    message: 'high-mem: system.memory.percent gt 90 (is 95)',
    delivered: false,
    createdAt: '2026-06-16T00:00:00.000Z',
    ...over,
  };
}

describe('EmailAlertSender', () => {
  it('sends to all recipients with the configured from + a status subject', async () => {
    const { transport, sent } = fakeTransport();
    const sender = new EmailAlertSender({ transport, from: 'alerts@example.com' });

    const ok = await sender.send(rule(), event());
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.from).toBe('alerts@example.com');
    expect(sent[0]!.to).toBe('ops@example.com, sre@example.com');
    expect(sent[0]!.subject).toBe('[docker-gui] FIRING: high-mem');
    expect(sent[0]!.text).toContain('system.memory.percent');
    expect(sent[0]!.text).toContain('95');
  });

  it('uses a RESOLVED subject for resolved events', async () => {
    const { transport, sent } = fakeTransport();
    const sender = new EmailAlertSender({ transport, from: 'alerts@example.com' });
    await sender.send(rule(), event({ status: 'resolved' }));
    expect(sent[0]!.subject).toBe('[docker-gui] RESOLVED: high-mem');
  });

  it('no-ops (returns false) when the rule has no email recipients', async () => {
    const { transport, sent } = fakeTransport();
    const sender = new EmailAlertSender({ transport, from: 'alerts@example.com' });
    expect(await sender.send(rule({ emailTo: null }), event())).toBe(false);
    expect(await sender.send(rule({ emailTo: '   ' }), event())).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('propagates transport failures (so evaluate records delivered:false)', async () => {
    const { transport, failNext } = fakeTransport();
    const sender = new EmailAlertSender({ transport, from: 'alerts@example.com' });
    failNext();
    await expect(sender.send(rule(), event())).rejects.toThrow('smtp 554');
  });
});
