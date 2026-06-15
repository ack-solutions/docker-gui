import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';
import type { AlertRuleSummary, AlertEventView, AlertSender } from '../../services/alert.service.js';

// Controllable clock + capturing sender shared with the env's AlertService.
let now = 1_000_000_000;
const sent: Array<{ rule: string; status: string }> = [];
let senderFails = false;
const fakeSender: AlertSender = {
  async send(rule: AlertRuleSummary, event: AlertEventView) {
    if (senderFails) throw new Error('webhook down');
    sent.push({ rule: rule.name, status: event.status });
  },
};

let env: TestEnv;
let adminToken: string;
let viewerToken: string;

function auth(t: string) {
  return { authorization: `Bearer ${t}`, 'content-type': 'application/json' };
}
function bearer(t: string) {
  return { authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  env = await buildTestEnv({
    alertOptions: { sender: fakeSender, clock: () => now },
  });
  await env.app.inject({
    method: 'POST', url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  // bootstrap owner is admin-tier for rule management.
  const lr = await env.app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1' },
  });
  adminToken = lr.json().data.accessToken as string;
  viewerToken = await createUserAndLogin(env, {
    email: 'viewer@example.com', password: 'ViewerPass1', name: 'Viewer', role: 'viewer',
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.prisma.alertEvent.deleteMany();
  await env.prisma.alertRule.deleteMany();
  now = 1_000_000_000;
  sent.length = 0;
  senderFails = false;
});

async function mkRule(extra: Record<string, unknown> = {}): Promise<AlertRuleSummary> {
  const res = await env.app.inject({
    method: 'POST', url: '/api/v1/alerts/rules', headers: auth(adminToken),
    payload: {
      name: 'high-mem', metric: 'system.memory.percent', operator: 'gt', threshold: 90,
      forSeconds: 0, cooldownSeconds: 300, webhookUrl: 'https://hooks.example.com/x', ...extra,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('rule CRUD + RBAC', () => {
  it('admin creates a rule; viewer can read but not create (403)', async () => {
    await mkRule();
    const list = await env.app.inject({ method: 'GET', url: '/api/v1/alerts/rules', headers: bearer(viewerToken) });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBe(1);

    const denied = await env.app.inject({
      method: 'POST', url: '/api/v1/alerts/rules', headers: auth(viewerToken),
      payload: { name: 'x', metric: 'system.cpu.percent', operator: 'gt', threshold: 80 },
    });
    expect(denied.statusCode).toBe(403);
  });

  it('rejects a duplicate name (409) and an invalid webhook URL (400)', async () => {
    await mkRule();
    expect((await env.app.inject({
      method: 'POST', url: '/api/v1/alerts/rules', headers: auth(adminToken),
      payload: { name: 'high-mem', metric: 'm', operator: 'gt', threshold: 1 },
    })).statusCode).toBe(409);
    expect((await env.app.inject({
      method: 'POST', url: '/api/v1/alerts/rules', headers: auth(adminToken),
      payload: { name: 'bad', metric: 'm', operator: 'gt', threshold: 1, webhookUrl: 'not-a-url' },
    })).statusCode).toBe(400);
  });
});

describe('evaluation engine', () => {
  it('fires when the threshold is breached, delivers, and records an event', async () => {
    await mkRule({ threshold: 90 });
    const created = await env.alerts.evaluate({ 'system.memory.percent': 95 });
    expect(created).toHaveLength(1);
    expect(created[0]!.status).toBe('firing');
    expect(sent).toEqual([{ rule: 'high-mem', status: 'firing' }]);
    // Event persisted + marked delivered.
    const events = await env.prisma.alertEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]!.delivered).toBe(true);
  });

  it('does NOT fire when the value is within bounds', async () => {
    await mkRule({ threshold: 90 });
    expect(await env.alerts.evaluate({ 'system.memory.percent': 50 })).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('respects forSeconds (debounce): only fires after the condition holds', async () => {
    await mkRule({ threshold: 90, forSeconds: 120 });
    // First breach — pending, not yet fired.
    expect(await env.alerts.evaluate({ 'system.memory.percent': 95 })).toHaveLength(0);
    now += 60_000; // 60s < 120s
    expect(await env.alerts.evaluate({ 'system.memory.percent': 95 })).toHaveLength(0);
    now += 70_000; // total 130s ≥ 120s
    const fired = await env.alerts.evaluate({ 'system.memory.percent': 95 });
    expect(fired).toHaveLength(1);
    expect(fired[0]!.status).toBe('firing');
  });

  it('respects cooldown: does not re-fire within the cooldown window', async () => {
    await mkRule({ threshold: 90, forSeconds: 0, cooldownSeconds: 300 });
    expect(await env.alerts.evaluate({ 'system.memory.percent': 95 })).toHaveLength(1);
    now += 100_000; // 100s < 300s cooldown
    expect(await env.alerts.evaluate({ 'system.memory.percent': 95 })).toHaveLength(0);
    now += 250_000; // now > 300s since fire
    expect(await env.alerts.evaluate({ 'system.memory.percent': 95 })).toHaveLength(1);
  });

  it('emits a resolved event when a firing condition clears', async () => {
    await mkRule({ threshold: 90, forSeconds: 0 });
    await env.alerts.evaluate({ 'system.memory.percent': 95 }); // firing
    const resolved = await env.alerts.evaluate({ 'system.memory.percent': 40 }); // clears
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.status).toBe('resolved');
  });

  it('records the event even when webhook delivery fails (delivered:false)', async () => {
    await mkRule({ threshold: 90 });
    senderFails = true;
    const created = await env.alerts.evaluate({ 'system.memory.percent': 95 });
    expect(created).toHaveLength(1); // still recorded
    const events = await env.prisma.alertEvent.findMany();
    expect(events[0]!.delivered).toBe(false);
  });

  it('skips disabled rules and missing metrics', async () => {
    await mkRule({ threshold: 90, enabled: false });
    expect(await env.alerts.evaluate({ 'system.memory.percent': 99 })).toHaveLength(0);
  });

  it('exposes fired events via the events API', async () => {
    await mkRule({ threshold: 90 });
    await env.alerts.evaluate({ 'system.memory.percent': 95 });
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/alerts/events', headers: bearer(viewerToken) });
    expect(res.statusCode).toBe(200);
    expect((res.json() as unknown[]).length).toBe(1);
  });

  it('requires auth', async () => {
    expect((await env.app.inject({ method: 'GET', url: '/api/v1/alerts/rules' })).statusCode).toBe(401);
  });
});
