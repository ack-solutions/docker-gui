import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  buildRefreshExpiry,
} from '../jwt.js';

const cfg = {
  secret: 'a-very-long-secret-for-tests-only-1234567890',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

describe('jwt access tokens', () => {
  it('signs and verifies a valid token', () => {
    const payload = { sub: 'u-1', email: 'a@b.co', role: 'admin' };
    const { token, expiresAt } = signAccessToken(payload, cfg);
    expect(typeof token).toBe('string');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    const decoded = verifyAccessToken(token, cfg);
    expect(decoded).toEqual(payload);
  });

  it('rejects tokens signed with a different secret', () => {
    const payload = { sub: 'u-1', email: 'a@b.co', role: 'admin' };
    const { token } = signAccessToken(payload, cfg);
    expect(() =>
      verifyAccessToken(token, { ...cfg, secret: 'other-secret-still-long-enough-1234' }),
    ).toThrow();
  });

  it('rejects tampered tokens', () => {
    const { token } = signAccessToken({ sub: 'u', email: 'a@b', role: 'r' }, cfg);
    const tampered = token.slice(0, -3) + 'xxx';
    expect(() => verifyAccessToken(tampered, cfg)).toThrow();
  });

  it('rejects expired tokens', () => {
    const { token } = signAccessToken(
      { sub: 'u', email: 'a@b', role: 'r' },
      { ...cfg, accessTtlSeconds: -1 },
    );
    expect(() => verifyAccessToken(token, cfg)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates token + hash that match', () => {
    const { token, hash } = generateRefreshToken();
    expect(token.length).toBeGreaterThan(40);
    expect(hash).toBe(hashRefreshToken(token));
  });

  it('different tokens produce different hashes', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('builds expiry in the future', () => {
    const exp = buildRefreshExpiry(60);
    expect(exp.getTime()).toBeGreaterThan(Date.now());
    expect(exp.getTime()).toBeLessThanOrEqual(Date.now() + 61_000);
  });
});
