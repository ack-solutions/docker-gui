import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import replyFrom from '@fastify/reply-from';
import { verifyExplorerToken } from '../lib/explorer-token.js';

/**
 * Reverse proxy that exposes a DB-explorer sidecar (pgweb / phpMyAdmin) to the
 * browser. It lives OUTSIDE the Bearer-auth API because browser asset requests
 * (CSS/JS/forms) can't carry an Authorization header.
 *
 * Auth flow:
 *   1. The operator-only "open explorer" route mints a short-lived, connection-
 *      scoped HMAC token and returns an access URL `/db-proxy/<id>/?__dgxt=<t>`.
 *   2. First hit: the `__dgxt` query token is validated, exchanged for a
 *      path-scoped HttpOnly session cookie, and the request proceeds.
 *   3. Subsequent asset requests carry the cookie (scoped to /db-proxy/<id>/),
 *      so they authenticate without a token in the URL.
 *
 * The sidecar must serve under the same path prefix (pgweb `--prefix`,
 * phpMyAdmin `PMA_ABSOLUTE_URI`) so its own asset links resolve through here —
 * that prefix is set when the sidecar is launched.
 */

export interface DbProxyRoutesOptions {
  /** HMAC secret the explorer tokens were signed with. */
  secret: string;
  /** Resolve a connection id → running sidecar `host:port`, or null if down. */
  getUpstream: (connectionId: string) => Promise<string | null>;
  /** Cookie TTL seconds (matches the token). */
  cookieTtlSeconds?: number;
}

const COOKIE = 'dgx_session';

function readCookie(req: FastifyRequest, name: string): string | null {
  const raw = req.headers['cookie'];
  if (typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function deny(reply: FastifyReply, code: number, msg: string): FastifyReply {
  return reply
    .status(code)
    .type('text/html')
    .send(`<!doctype html><meta charset=utf-8><body style="font:14px system-ui;padding:2rem">
<h3>Database explorer</h3><p>${msg}</p>
<p>Open it again from the panel (Databases → Explore) to get a fresh access link.</p></body>`);
}

export const dbProxyRoutes: FastifyPluginAsync<DbProxyRoutesOptions> = async (app, opts) => {
  await app.register(replyFrom);

  // Proxy must stream raw bodies (phpMyAdmin POST forms) — don't let Fastify
  // buffer/parse them. A catch-all parser leaves the raw request for reply.from.
  app.addContentTypeParser('*', (_req, _payload, done) => done(null, undefined));

  const ttl = opts.cookieTtlSeconds ?? 12 * 60 * 60;

  const handler = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const id = (req.params as { id: string }).id;
    const basePath = `/db-proxy/${id}/`;

    // Resolve the token: query param (bootstrap) wins over cookie.
    const queryToken = (req.query as { __dgxt?: string }).__dgxt;
    const cookieToken = readCookie(req, COOKIE);
    const token = queryToken ?? cookieToken;

    if (!token) {
      deny(reply, 401, 'No access token.');
      return;
    }
    const verified = verifyExplorerToken(token, opts.secret);
    if (!verified || verified.connectionId !== id) {
      deny(reply, 401, 'Access token is invalid or expired.');
      return;
    }

    const upstream = await opts.getUpstream(id);
    if (!upstream) {
      deny(reply, 502, 'The explorer for this database is not running.');
      return;
    }

    // On bootstrap (token came from the URL), set the path-scoped session
    // cookie so subsequent asset requests authenticate without the token.
    if (queryToken) {
      reply.header(
        'set-cookie',
        `${COOKIE}=${queryToken}; Path=${basePath}; HttpOnly; SameSite=Lax; Max-Age=${ttl}`,
      );
    }

    // Forward to the sidecar at the SAME path (it serves under the prefix).
    // reply.from uses the source's PATH but re-appends the request's query, so
    // we both put the path in the source AND strip our token from req.raw.url
    // so it never reaches the sidecar.
    const url = new URL(req.url, 'http://placeholder');
    // `new URL` normalizes `..` — reject anything that escapes this
    // connection's prefix, so a traversal can't reach other sidecar paths.
    if (url.pathname !== `/db-proxy/${id}` && !url.pathname.startsWith(basePath)) {
      deny(reply, 400, 'Invalid path.');
      return;
    }
    url.searchParams.delete('__dgxt');
    req.raw.url = `${url.pathname}${url.search}`;
    await reply.from(`http://${upstream}${url.pathname}`);
  };

  app.all('/db-proxy/:id', handler);
  app.all('/db-proxy/:id/*', handler);
};
