import { describe, it, expect } from 'vitest';
import { verifyWsToken } from '../ws-auth.js';
import { signAccessToken } from '../jwt.js';
import { UnauthorizedError } from '../errors.js';

const cfg = { secret: 'a'.repeat(64), accessTtlSeconds: 60, refreshTtlSeconds: 600 };

describe('verifyWsToken', () => {
  it('returns the payload for a valid token query', () => {
    const { token } = signAccessToken(
      { sub: 'u1', email: 'a@b.co', role: 'admin' },
      cfg,
    );
    const payload = verifyWsToken(`/api/v1/ws/logs/c123?token=${token}`, cfg);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('admin');
  });

  it('throws when token is missing', () => {
    expect(() => verifyWsToken('/api/v1/ws/logs/c123', cfg)).toThrow(UnauthorizedError);
  });

  it('throws when token is malformed', () => {
    expect(() => verifyWsToken('/api/v1/ws/logs/c?token=garbage', cfg)).toThrow(UnauthorizedError);
  });

  it('throws when signed by a different secret', () => {
    const { token } = signAccessToken(
      { sub: 'u1', email: 'a@b.co', role: 'admin' },
      { ...cfg, secret: 'z'.repeat(64) },
    );
    expect(() => verifyWsToken(`/api/v1/ws/logs/c?token=${token}`, cfg)).toThrow(UnauthorizedError);
  });
});
