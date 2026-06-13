/**
 * Audit log writer + reader.
 *
 * Every state-changing API call (POST / PATCH / PUT / DELETE) is recorded
 * here via an `onResponse` hook wired in `app.ts`. The log is append-only
 * from the panel's perspective — there is no `update` or `delete` operation.
 *
 * What we record per request:
 *   - actorId: the authenticated user (or null for anonymous routes — login,
 *     setup-bootstrap, etc.; their identity is captured in `payload.username`)
 *   - action: a stable kebab-cased verb like "container.start", "site.create",
 *     "auth.login.success", "auth.login.failed". Derived from method + path
 *     by a small mapper so callers don't have to label every route.
 *   - targetType / targetId: the principal noun being acted on. Pulled from
 *     URL params when possible (`:id`, `:cid`, `:bucket`, `:key`, …).
 *   - payload: a small JSON blob with statusCode + non-secret query/body
 *     fields. Secrets are stripped via a denylist.
 *   - ip / userAgent: forensic context.
 *   - createdAt: server time (UTC).
 *
 * Reads are restricted to `owner` + `admin` roles (see audit.routes.ts).
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

export interface AuditEntry {
  id: string;
  actorId: string | null;
  /** Resolved at read time from the actor relation; null for system/anon. */
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditQuery {
  /** Limit per page (1..200). */
  limit?: number;
  /** Cursor: id of the last row from the previous page. */
  cursor?: string;
  /** Filter by exact action string. Takes precedence over actionPrefix. */
  action?: string;
  /** Filter by action prefix, e.g. "container.". Ignored if `action` is set. */
  actionPrefix?: string;
  /** Filter by actor user id. */
  actorId?: string;
  /** Filter by target. */
  targetType?: string;
  targetId?: string;
  /** Filter by createdAt range. */
  from?: Date;
  to?: Date;
  /**
   * Whether to also run the (potentially expensive) total-count query.
   * Defaults to true so the UI can show "N matching entries". Pass false for
   * cheap tail reads on very large audit tables.
   */
  includeTotal?: boolean;
}

export interface AuditPage {
  entries: AuditEntry[];
  /** Cursor to pass back as `cursor` for the next page. Null when end of feed. */
  nextCursor: string | null;
  /** Total matching rows (without paging). Present unless `includeTotal:false`. */
  total?: number;
}

export interface RecordInput {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Fields the writer never persists — set membership grows as we add features.
 * The writer also redacts any header named `authorization` or `cookie`, and
 * any object key matching the regex below.
 */
const SECRET_KEYS_DENYLIST = new Set<string>([
  'password',
  'passwordHash',
  'newPassword',
  'oldPassword',
  'secret',
  'secretKey',
  'accessKey',
  'apiToken',
  'apiKey',
  'token',
  'refreshToken',
  'accessToken',
  'jwt',
  'authorization',
  'cookie',
  'policy', // bucket policies can contain sensitive principals
  'credentialsCipher',
  'secretKeyCipher',
]);
const SECRET_LIKE_KEY = /(secret|password|token|cipher|credential|key)$/i;

function isSecretKey(name: string): boolean {
  return SECRET_KEYS_DENYLIST.has(name) || SECRET_LIKE_KEY.test(name);
}

/** Recursively redact secrets from a payload. Truncates strings at 256 chars. */
export function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated:depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 256 ? `${value.slice(0, 256)}…[${value.length}]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > 50) {
      return [...value.slice(0, 50).map((v) => sanitizePayload(v, depth + 1)), `…+${value.length - 50}`];
    }
    return value.map((v) => sanitizePayload(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizePayload(v, depth + 1);
      }
    }
    return out;
  }
  return '[unsupported]';
}

/** Map a static path segment to its singular noun for nicer action names. */
function singularize(seg: string): string {
  if (seg.endsWith('ies')) return `${seg.slice(0, -3)}y`;
  if (seg.endsWith('ses')) return seg.slice(0, -2); // addresses → address
  if (seg.endsWith('s') && !seg.endsWith('ss')) return seg.slice(0, -1);
  return seg;
}

function verbForMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

/**
 * Path segments that name an ACTION rather than a resource. When one of these
 * is the final segment, it becomes the action verb verbatim (no method-derived
 * suffix). Everything else trailing is treated as a (sub-)resource noun.
 */
const ACTION_VERBS = new Set<string>([
  'start', 'stop', 'restart', 'pause', 'unpause', 'kill', 'enable', 'disable',
  'verify', 'apply', 'prune', 'rotate', 'reset', 'refresh', 'logs', 'exec',
  'attach', 'commit', 'rename', 'upload-url', 'download-url',
]);

/**
 * Translate a method + route PATTERN (not the live URL) into a stable action
 * string. The pattern has literal `:param` placeholders, so we can tell
 * nouns from ids exactly. A trailing segment in ACTION_VERBS is used verbatim;
 * otherwise the method maps to create/update/delete.
 *
 * Examples (pattern shown):
 *   POST   /auth/login                          → auth.login.success | auth.login.failed
 *   POST   /auth/logout                         → auth.logout
 *   POST   /containers/:id/start                → container.start
 *   DELETE /containers/:id                      → container.delete
 *   POST   /storage/connections                 → storage.connection.create
 *   POST   /storage/:cid/buckets                → storage.bucket.create
 *   PUT    /storage/:cid/buckets/:bucket/policy → storage.bucket.policy.update
 *   POST   /features/:key/enable                → feature.enable
 */
export function deriveAction(method: string, routePattern: string, statusCode: number): string {
  const path = routePattern.replace(/\?.*$/, '').replace(/^\/api\/v\d+/, '');
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return `request.${method.toLowerCase()}`;

  // Auth + setup get flat, explicit action names.
  if (segs[0] === 'auth') {
    const sub = segs[1] ?? 'unknown';
    if (sub === 'login') {
      return statusCode >= 200 && statusCode < 300 ? 'auth.login.success' : 'auth.login.failed';
    }
    return `auth.${sub}`;
  }
  if (segs[0] === 'setup') {
    return `setup.${segs[1] ?? 'unknown'}`;
  }

  const statics = segs.filter((s) => !s.startsWith(':'));
  const lastStatic = statics[statics.length - 1] ?? '';
  const trailingIsVerb = ACTION_VERBS.has(lastStatic) && segs[segs.length - 1] === lastStatic;

  if (trailingIsVerb) {
    // Noun = all static segments except the trailing verb.
    const noun = statics.slice(0, -1).map(singularize).join('.') || 'resource';
    return `${noun}.${lastStatic}`;
  }

  const noun = statics.map(singularize).join('.') || 'resource';
  return `${noun}.${verbForMethod(method)}`;
}

/**
 * Resolve the target (type + id) from the route PATTERN + live params.
 * The target is the LAST `:param` in the pattern; its type is the static
 * noun immediately preceding it.
 *
 *   /storage/:cid/buckets/:bucket  + {cid,bucket}  → { type: 'bucket', id: <bucket> }
 *   /containers/:id                + {id}          → { type: 'container', id: <id> }
 *   /storage/connections           + {}            → { type: 'connection', id: null }
 */
export function deriveTarget(
  routePattern: string,
  params: Record<string, unknown> | undefined,
): { targetType: string | null; targetId: string | null } {
  const path = routePattern.replace(/\?.*$/, '').replace(/^\/api\/v\d+/, '');
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return { targetType: null, targetId: null };

  // Find the last param segment in the pattern.
  let lastParamIdx = -1;
  for (let i = segs.length - 1; i >= 0; i--) {
    if ((segs[i] ?? '').startsWith(':')) {
      lastParamIdx = i;
      break;
    }
  }

  if (lastParamIdx >= 0) {
    const paramName = (segs[lastParamIdx] ?? '').slice(1); // strip leading ':'
    const rawId = params && typeof params === 'object'
      ? (params as Record<string, unknown>)[paramName]
      : undefined;
    const targetId = typeof rawId === 'string' && rawId.length > 0 ? rawId : null;
    // Type = nearest static noun before the param (singularized).
    let targetType: string | null = null;
    for (let i = lastParamIdx - 1; i >= 0; i--) {
      const s = segs[i] ?? '';
      if (!s.startsWith(':')) {
        targetType = singularize(s);
        break;
      }
    }
    // If the param is the first segment (no preceding noun), fall back to it.
    if (!targetType) targetType = singularize(paramName);
    return { targetType, targetId };
  }

  // No params → the resource collection itself; type is the last static noun.
  const lastStatic = [...segs].reverse().find((s) => !s.startsWith(':'));
  return { targetType: lastStatic ? singularize(lastStatic) : null, targetId: null };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AuditLogService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Record one audit row. Errors are swallowed and logged — never break a
   *  user request because the audit insert failed. The catch sits outside,
   *  in the onResponse hook in app.ts. */
  async record(input: RecordInput): Promise<AuditEntry> {
    const row = await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return toEntry(row, null);
  }

  /** Paginated query. Defaults to most-recent first. */
  async list(q: AuditQuery = {}): Promise<AuditPage> {
    const limit = Math.max(1, Math.min(200, q.limit ?? 50));
    const where: Prisma.AuditLogWhereInput = {};
    // Exact action wins over prefix; never let one silently clobber the other.
    if (q.action) {
      where.action = q.action;
    } else if (q.actionPrefix) {
      where.action = { startsWith: q.actionPrefix };
    }
    if (q.actorId) where.actorId = q.actorId;
    if (q.targetType) where.targetType = q.targetType;
    if (q.targetId) where.targetId = q.targetId;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // peek next
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { actor: { select: { email: true } } },
    });
    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    // Count is opt-out: skipped only when the caller explicitly says so.
    const includeTotal = q.includeTotal ?? true;
    const total = includeTotal ? await this.prisma.auditLog.count({ where }) : undefined;
    const last = trimmed[trimmed.length - 1];
    return {
      entries: trimmed.map((r) => toEntry(r, r.actor?.email ?? null)),
      nextCursor: hasMore && last ? last.id : null,
      ...(total !== undefined ? { total } : {}),
    };
  }
}

function toEntry(
  row: {
    id: string;
    actorId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    payload: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
  },
  actorEmail: string | null,
): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorEmail,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    payload: row.payload ? safeJsonParse(row.payload) : null,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  };
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request → record adapter (used by the onResponse hook)
// ---------------------------------------------------------------------------

const TRACKED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function shouldRecord(req: FastifyRequest, statusCode: number): boolean {
  if (!TRACKED_METHODS.has(req.method.toUpperCase())) return false;
  // Skip health / status reads.
  if (req.url.includes('/health')) return false;
  // Don't audit 5xx from the framework (no actor info, often noisy infra).
  if (statusCode >= 500) return false;
  return true;
}

/**
 * The route PATTERN Fastify matched (e.g. `/storage/:cid/buckets/:bucket`),
 * which lets us tell nouns from ids. Falls back to the live URL if the
 * pattern isn't available (shouldn't happen for matched routes).
 */
export function routePatternOf(req: FastifyRequest): string {
  const fromOptions = (req as { routeOptions?: { url?: string } }).routeOptions?.url;
  if (typeof fromOptions === 'string' && fromOptions.length > 0) return fromOptions;
  // Fastify <v4 fallback.
  const legacy = (req as { routerPath?: string }).routerPath;
  if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  return req.url;
}

/**
 * Adapt a Fastify request + reply into a RecordInput. Pulls actor (when
 * authenticated), targets from route params, and a redacted payload from
 * (body merged with query). Never reads the response body.
 */
export function buildRecord(
  req: FastifyRequest,
  statusCode: number,
): RecordInput {
  const pattern = routePatternOf(req);
  const action = deriveAction(req.method, pattern, statusCode);
  const target = deriveTarget(pattern, req.params as Record<string, unknown> | undefined);
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const query = (req.query && typeof req.query === 'object' ? req.query : {}) as Record<string, unknown>;
  const merged = { ...query, ...body };
  const sanitized = sanitizePayload(merged) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    statusCode,
    ...(Object.keys(sanitized).length > 0 ? { input: sanitized } : {}),
  };
  return {
    ...(req.user?.sub ? { actorId: req.user.sub } : {}),
    action,
    targetType: target.targetType,
    targetId: target.targetId,
    payload,
    ip: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}
