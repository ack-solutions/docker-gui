import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { TestEnv } from '../../__tests__/test-helpers.js';
import {
  buildTestEnv,
  TEST_SETUP_SECRET,
  createUserAndLogin,
} from '../../__tests__/test-helpers.js';

/**
 * User management, end to end. No mocks: real argon2, real JWT, real Prisma.
 * Covers the privilege matrix and the safety guards (last-owner, self-delete,
 * no escalation above your own role) plus session revocation side-effects.
 */
let env: TestEnv;
let ownerToken: string;
let adminToken: string;
let viewerToken: string;
let ownerId: string;

function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function login(email: string, password: string) {
  const res = await env.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email, password },
  });
  return res;
}

beforeAll(async () => {
  env = await buildTestEnv();
  const boot = await env.app.inject({
    method: 'POST',
    url: '/api/v1/setup/bootstrap',
    headers: { 'x-setup-secret': TEST_SETUP_SECRET, 'content-type': 'application/json' },
    payload: { email: 'owner@example.com', password: 'OwnerPass1', name: 'Owner' },
  });
  expect(boot.statusCode).toBe(201);
  ownerId = boot.json().data.user.id as string;
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  // Reset to a known state: EXACTLY the bootstrap owner + an admin + a viewer.
  // Delete every other user (including any extra owners a test created) and
  // restore the bootstrap owner's role/active flag in case a test changed it.
  await env.prisma.refreshToken.deleteMany();
  await env.prisma.user.deleteMany({ where: { id: { not: ownerId } } });
  await env.prisma.user.update({
    where: { id: ownerId },
    data: { role: 'owner', isActive: true },
  });
  // Re-login owner each run (tokens may have been revoked by a prior test).
  const res = await login('owner@example.com', 'OwnerPass1');
  ownerToken = res.json().data.accessToken as string;
  adminToken = await createUserAndLogin(env, {
    email: 'admin@example.com',
    password: 'AdminPass1',
    name: 'Admin',
    role: 'admin',
  });
  viewerToken = await createUserAndLogin(env, {
    email: 'viewer@example.com',
    password: 'ViewerPass1',
    name: 'Viewer',
    role: 'viewer',
  });
});

describe('listing + access', () => {
  it('admin can list users; viewer is forbidden', async () => {
    const ok = await env.app.inject({ method: 'GET', url: '/api/v1/users', headers: bearer(adminToken) });
    expect(ok.statusCode).toBe(200);
    expect(Array.isArray(ok.json().data)).toBe(true);
    expect(ok.json().data.length).toBeGreaterThanOrEqual(3);
    // No password hashes leak.
    expect(JSON.stringify(ok.json())).not.toContain('passwordHash');

    const denied = await env.app.inject({ method: 'GET', url: '/api/v1/users', headers: bearer(viewerToken) });
    expect(denied.statusCode).toBe(403);
  });
});

describe('create', () => {
  it('admin can create an operator', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'op1@example.com', password: 'OpPass123', name: 'Op One', role: 'operator' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.role).toBe('operator');
    // The new operator can actually log in.
    const lr = await login('op1@example.com', 'OpPass123');
    expect(lr.statusCode).toBe(200);
  });

  it('admin CANNOT create an owner (403)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'wannabe@example.com', password: 'OwnerPass1', name: 'Nope', role: 'owner' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('user.forbidden_role');
  });

  it('owner CAN create another owner', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(ownerToken),
      payload: { email: 'owner2@example.com', password: 'OwnerPass2', name: 'Owner Two', role: 'owner' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.role).toBe('owner');
  });

  it('rejects duplicate email (409)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'admin@example.com', password: 'Whatever1', name: 'Dup', role: 'operator' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects a weak password (400)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'weak@example.com', password: 'short', name: 'Weak', role: 'operator' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('update + privilege rules', () => {
  it('admin can change an operator role to viewer', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'op2@example.com', password: 'OpPass123', name: 'Op Two', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}`,
      headers: auth(adminToken),
      payload: { role: 'viewer' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.role).toBe('viewer');
  });

  it('admin CANNOT modify an owner (403)', async () => {
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${ownerId}`,
      headers: auth(adminToken),
      payload: { name: 'Hacked' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('user.forbidden');
  });

  it('admin CANNOT escalate someone to owner (403)', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'op3@example.com', password: 'OpPass123', name: 'Op Three', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}`,
      headers: auth(adminToken),
      payload: { role: 'owner' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('deactivating a user kicks their sessions (refresh fails)', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'op4@example.com', password: 'OpPass123', name: 'Op Four', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const lr = await login('op4@example.com', 'OpPass123');
    const refreshToken = lr.json().data.refreshToken as string;

    const patch = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}`,
      headers: auth(adminToken),
      payload: { isActive: false },
    });
    expect(patch.statusCode).toBe(200);

    // Old refresh token must now be rejected.
    const refresh = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    // And they can no longer log in.
    const relogin = await login('op4@example.com', 'OpPass123');
    expect(relogin.statusCode).toBe(401);
  });
});

describe('last-owner protection', () => {
  it('cannot demote the last active owner (409)', async () => {
    // Only the bootstrap owner exists as owner in this run.
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${ownerId}`,
      headers: auth(ownerToken),
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('user.last_owner');
  });

  it('cannot deactivate the last active owner (409)', async () => {
    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${ownerId}`,
      headers: auth(ownerToken),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(409);
  });

  it('CAN demote an owner once a second owner exists', async () => {
    const second = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(ownerToken),
      payload: { email: 'owner3@example.com', password: 'OwnerPass3', name: 'Owner Three', role: 'owner' },
    });
    expect(second.statusCode).toBe(201);
    const secondId = second.json().data.id as string;

    const res = await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${secondId}`,
      headers: auth(ownerToken),
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.role).toBe('admin');
  });
});

describe('immediate session revocation (per-request DB re-check)', () => {
  it('a deactivated user\'s EXISTING access token stops working at once', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'live@example.com', password: 'LivePass123', name: 'Live', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const lr = await login('live@example.com', 'LivePass123');
    const opAccess = lr.json().data.accessToken as string;

    // Token works while active.
    const before = await env.app.inject({
      method: 'GET',
      url: '/api/v1/storage/connections',
      headers: bearer(opAccess),
    });
    expect(before.statusCode).toBe(200);

    // Admin deactivates them.
    await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}`,
      headers: auth(adminToken),
      payload: { isActive: false },
    });

    // The SAME (unexpired) access token must now be rejected.
    const after = await env.app.inject({
      method: 'GET',
      url: '/api/v1/storage/connections',
      headers: bearer(opAccess),
    });
    expect(after.statusCode).toBe(401);
    expect(after.json().error.code).toBe('auth.session_revoked');
  });

  it('a role change takes effect on the next request with the same token', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(ownerToken),
      payload: { email: 'promote@example.com', password: 'PromPass123', name: 'Prom', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const lr = await login('promote@example.com', 'PromPass123');
    const access = lr.json().data.accessToken as string;

    // As operator, cannot enable a feature (admin-only).
    const denied = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/caddy/enable',
      headers: bearer(access),
    });
    expect(denied.statusCode).toBe(403);

    // Owner promotes them to admin.
    await env.app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}`,
      headers: auth(ownerToken),
      payload: { role: 'admin' },
    });

    // The promotion revokes refresh tokens, but the live access token now
    // carries the admin role from the DB on the very next request — so the
    // role guard passes (the feature enable will fail later for infra reasons,
    // but NOT with 403).
    const allowed = await env.app.inject({
      method: 'POST',
      url: '/api/v1/features/caddy/enable',
      headers: bearer(access),
    });
    expect(allowed.statusCode).not.toBe(403);
  });
});

describe('last-owner race (atomic guard)', () => {
  it('two concurrent demotions cannot zero out owners', async () => {
    // Three owners total (bootstrap + two more).
    const ids: string[] = [];
    for (const n of [1, 2]) {
      const r = await env.app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: auth(ownerToken),
        payload: { email: `race${n}@example.com`, password: 'RacePass123', name: `Race ${n}`, role: 'owner' },
      });
      ids.push(r.json().data.id as string);
    }
    // Now demote all THREE owners concurrently (bootstrap + 2). At most two may
    // succeed; the guard must keep at least one active owner.
    const targets = [ownerId, ids[0]!, ids[1]!];
    const results = await Promise.all(
      targets.map((id) =>
        env.app.inject({
          method: 'PATCH',
          url: `/api/v1/users/${id}`,
          headers: auth(ownerToken),
          payload: { role: 'admin' },
        }),
      ),
    );
    const statuses = results.map((r) => r.statusCode);
    // At least one demotion was refused with the last-owner guard.
    expect(statuses.filter((s) => s === 409).length).toBeGreaterThanOrEqual(1);
    // The invariant holds: at least one active owner remains.
    const remaining = await env.prisma.user.count({ where: { role: 'owner', isActive: true } });
    expect(remaining).toBeGreaterThanOrEqual(1);
  });
});

describe('delete', () => {
  it('cannot delete your own account (400)', async () => {
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${ownerId}`,
      headers: bearer(ownerToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('user.self_delete');
  });

  it('admin can delete an operator', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'gone@example.com', password: 'OpPass123', name: 'Gone', role: 'operator' },
    });
    const id = created.json().data.id as string;
    const del = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${id}`,
      headers: bearer(adminToken),
    });
    expect(del.statusCode).toBe(204);
    const relogin = await login('gone@example.com', 'OpPass123');
    expect(relogin.statusCode).toBe(401);
  });

  it('admin CANNOT delete an owner (403)', async () => {
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${ownerId}`,
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('password reset + self-service change', () => {
  it('admin resets an operator password; old password stops working', async () => {
    const created = await env.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: auth(adminToken),
      payload: { email: 'pw@example.com', password: 'OldPass123', name: 'Pw User', role: 'operator' },
    });
    const id = created.json().data.id as string;

    const reset = await env.app.inject({
      method: 'POST',
      url: `/api/v1/users/${id}/password`,
      headers: auth(adminToken),
      payload: { newPassword: 'BrandNew123' },
    });
    expect(reset.statusCode).toBe(204);

    expect((await login('pw@example.com', 'OldPass123')).statusCode).toBe(401);
    expect((await login('pw@example.com', 'BrandNew123')).statusCode).toBe(200);
  });

  it('admin CANNOT reset an owner password (403)', async () => {
    const res = await env.app.inject({
      method: 'POST',
      url: `/api/v1/users/${ownerId}/password`,
      headers: auth(adminToken),
      payload: { newPassword: 'NewOwner123' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('self change-password requires the correct current password', async () => {
    const wrong = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: auth(adminToken),
      payload: { currentPassword: 'NotMyPassword', newPassword: 'AdminNew123' },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await env.app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: auth(adminToken),
      payload: { currentPassword: 'AdminPass1', newPassword: 'AdminNew123' },
    });
    expect(ok.statusCode).toBe(204);
    expect((await login('admin@example.com', 'AdminPass1')).statusCode).toBe(401);
    expect((await login('admin@example.com', 'AdminNew123')).statusCode).toBe(200);
  });
});
