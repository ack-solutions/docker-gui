import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: string;
}

export interface SignedTokens {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

export interface JwtConfig {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export function signAccessToken(
  payload: AccessTokenPayload,
  config: JwtConfig,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + config.accessTtlSeconds * 1000);
  const token = jwt.sign(payload, config.secret, {
    expiresIn: config.accessTtlSeconds,
  });
  return { token, expiresAt };
}

export function verifyAccessToken(token: string, config: JwtConfig): AccessTokenPayload {
  const decoded = jwt.verify(token, config.secret);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload (string)');
  }
  if (
    typeof decoded.sub !== 'string' ||
    typeof decoded['email'] !== 'string' ||
    typeof decoded['role'] !== 'string'
  ) {
    throw new Error('Invalid token payload (shape)');
  }
  return {
    sub: decoded.sub,
    email: decoded['email'] as string,
    role: decoded['role'] as string,
  };
}

/**
 * Refresh tokens are opaque random strings. We store only the SHA-256 hash
 * in the DB so even DB compromise doesn't leak usable tokens.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  const hash = hashRefreshToken(token);
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buildRefreshExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}
