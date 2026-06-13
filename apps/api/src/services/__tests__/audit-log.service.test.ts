import { describe, it, expect } from 'vitest';
import {
  deriveAction,
  deriveTarget,
  sanitizePayload,
} from '../audit-log.service.js';

describe('deriveAction', () => {
  it('marks login success vs failure by status', () => {
    expect(deriveAction('POST', '/api/v1/auth/login', 200)).toBe('auth.login.success');
    expect(deriveAction('POST', '/api/v1/auth/login', 401)).toBe('auth.login.failed');
    expect(deriveAction('POST', '/auth/login', 200)).toBe('auth.login.success');
  });

  it('maps container verb routes', () => {
    expect(deriveAction('POST', '/api/v1/containers/:id/start', 200)).toBe('container.start');
    expect(deriveAction('POST', '/api/v1/containers/:id/stop', 200)).toBe('container.stop');
    expect(deriveAction('POST', '/api/v1/containers/:id/restart', 200)).toBe('container.restart');
  });

  it('maps CRUD on a resource by method', () => {
    expect(deriveAction('DELETE', '/api/v1/containers/:id', 204)).toBe('container.delete');
    expect(deriveAction('PATCH', '/api/v1/sites/:id', 200)).toBe('site.update');
    expect(deriveAction('PUT', '/api/v1/sites/:id', 200)).toBe('site.update');
    expect(deriveAction('POST', '/api/v1/sites', 201)).toBe('site.create');
  });

  it('handles nested sub-resources via the route pattern', () => {
    expect(deriveAction('POST', '/api/v1/storage/connections', 201)).toBe(
      'storage.connection.create',
    );
    expect(deriveAction('POST', '/api/v1/storage/:cid/buckets', 201)).toBe(
      'storage.bucket.create',
    );
    expect(deriveAction('DELETE', '/api/v1/storage/:cid/buckets/:bucket', 204)).toBe(
      'storage.bucket.delete',
    );
    expect(deriveAction('PUT', '/api/v1/storage/:cid/buckets/:bucket/policy', 204)).toBe(
      'storage.bucket.policy.update',
    );
    expect(deriveAction('POST', '/api/v1/storage/:cid/buckets/:bucket/objects/upload-url', 200)).toBe(
      'storage.bucket.object.upload-url',
    );
  });

  it('maps feature enable/disable as trailing verbs', () => {
    expect(deriveAction('POST', '/api/v1/features/:key/enable', 200)).toBe('feature.enable');
    expect(deriveAction('POST', '/api/v1/features/:key/disable', 200)).toBe('feature.disable');
  });

  it('maps connection verify', () => {
    expect(deriveAction('POST', '/api/v1/storage/connections/:id/verify', 200)).toBe(
      'storage.connection.verify',
    );
  });
});

describe('deriveTarget', () => {
  it('uses the last param + preceding noun', () => {
    expect(deriveTarget('/api/v1/containers/:id', { id: 'abc123' })).toEqual({
      targetType: 'container',
      targetId: 'abc123',
    });
    expect(
      deriveTarget('/api/v1/storage/:cid/buckets/:bucket', { cid: 'c1', bucket: 'photos' }),
    ).toEqual({ targetType: 'bucket', targetId: 'photos' });
    expect(
      deriveTarget('/api/v1/storage/:cid/buckets/:bucket/policy', { cid: 'c1', bucket: 'photos' }),
    ).toEqual({ targetType: 'bucket', targetId: 'photos' });
  });

  it('returns null id for collection routes', () => {
    expect(deriveTarget('/api/v1/storage/connections', {})).toEqual({
      targetType: 'connection',
      targetId: null,
    });
    expect(deriveTarget('/api/v1/sites', {})).toEqual({ targetType: 'site', targetId: null });
  });

  it('handles a param with no preceding noun', () => {
    expect(deriveTarget('/api/v1/features/:key/enable', { key: 'caddy' })).toEqual({
      targetType: 'feature',
      targetId: 'caddy',
    });
  });

  it('returns null id when the param value is missing', () => {
    expect(deriveTarget('/api/v1/containers/:id', {})).toEqual({
      targetType: 'container',
      targetId: null,
    });
  });
});

describe('sanitizePayload', () => {
  it('redacts secret-named keys (denylist + suffix heuristic)', () => {
    const out = sanitizePayload({
      name: 'minio',
      password: 'hunter2',
      secretKey: 'AKIA....',
      accessKey: 'public-ish',
      apiToken: 'tok',
      myCustomSecret: 'x',
      sessionToken: 'y',
      somethingCipher: 'z',
      nested: { secretKey: 'deep', ok: 'visible' },
    }) as Record<string, unknown>;

    expect(out['name']).toBe('minio');
    expect(out['password']).toBe('[redacted]');
    expect(out['secretKey']).toBe('[redacted]');
    expect(out['accessKey']).toBe('[redacted]');
    expect(out['apiToken']).toBe('[redacted]');
    expect(out['myCustomSecret']).toBe('[redacted]');
    expect(out['sessionToken']).toBe('[redacted]');
    expect(out['somethingCipher']).toBe('[redacted]');
    expect((out['nested'] as Record<string, unknown>)['secretKey']).toBe('[redacted]');
    expect((out['nested'] as Record<string, unknown>)['ok']).toBe('visible');
  });

  it('truncates very long strings', () => {
    const long = 'a'.repeat(500);
    const out = sanitizePayload({ note: long }) as Record<string, unknown>;
    expect(String(out['note'])).toMatch(/…\[500\]$/);
    expect(String(out['note']).length).toBeLessThan(300);
  });

  it('caps long arrays and keeps a count marker', () => {
    const arr = Array.from({ length: 80 }, (_v, i) => i);
    const out = sanitizePayload(arr) as unknown[];
    expect(out.length).toBe(51); // 50 + marker
    expect(out[50]).toBe('…+30');
  });

  it('caps deep recursion', () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 10; i++) deep = { child: deep };
    const out = sanitizePayload(deep);
    expect(JSON.stringify(out)).toContain('[truncated:depth]');
  });

  it('passes through primitives and null', () => {
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(42)).toBe(42);
    expect(sanitizePayload(true)).toBe(true);
    expect(sanitizePayload('short')).toBe('short');
  });
});
