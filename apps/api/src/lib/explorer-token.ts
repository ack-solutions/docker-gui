import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived, connection-scoped access token for the DB-explorer reverse
 * proxy. The explorer proxy lives OUTSIDE the Bearer-auth API (browser asset
 * requests can't carry an Authorization header), so it authenticates with this
 * HMAC token instead: minted by the operator-only "open explorer" route, then
 * exchanged for a path-scoped session cookie on first hit.
 *
 * Format: base64url(`${connectionId}.${exp}`) + '.' + base64url(HMAC-SHA256).
 */

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12h

export function signExplorerToken(
  connectionId: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${connectionId}.${exp}`;
  const body = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyExplorerToken(
  token: string,
  secret: string,
): { connectionId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  let payload: string;
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // connectionId is a UUID (no dots); exp is the trailing numeric field.
  const dot = payload.lastIndexOf('.');
  if (dot <= 0) return null;
  const connectionId = payload.slice(0, dot);
  const exp = Number(payload.slice(dot + 1));
  if (!connectionId || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return { connectionId };
}
