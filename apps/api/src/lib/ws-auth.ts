import { verifyAccessToken, type AccessTokenPayload, type JwtConfig } from './jwt.js';
import { UnauthorizedError } from './errors.js';

/**
 * Verify a JWT passed as a query parameter.
 *
 * Browsers can't set custom headers on WebSocket handshakes, so the standard
 * pattern is `?token=<access>`. Tokens are short-lived (15m default), so the
 * exposure surface is small — the same token would already be sent on every
 * REST call.
 */
export function verifyWsToken(rawUrl: string, jwtConfig: JwtConfig): AccessTokenPayload {
  let token: string | null = null;
  try {
    const url = new URL(rawUrl, 'http://x');
    token = url.searchParams.get('token');
  } catch {
    // ignore — handled by the null check below
  }
  if (!token) throw new UnauthorizedError('Missing token query parameter');
  try {
    return verifyAccessToken(token, jwtConfig);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'invalid';
    throw new UnauthorizedError(`Invalid token: ${reason}`);
  }
}
