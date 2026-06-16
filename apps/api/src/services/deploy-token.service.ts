import { randomBytes, createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';

export type DeployScope = 'static' | 'container' | 'both';

export interface DeployTokenSummary {
  id: string;
  siteId: string;
  name: string;
  scope: DeployScope;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const TOKEN_PREFIX = 'dgwt_'; // docker-gui web/deploy token

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Per-site CI deploy credentials. The plaintext is shown exactly once at mint;
 * only its SHA-256 is stored (mirrors RefreshToken). Authentication looks the
 * hash up via the @unique index — never a fetch-all-and-compare.
 */
export class DeployTokenService {
  constructor(private readonly db: PrismaClient) {}

  /** Mint a token for a site. Returns the PLAINTEXT once + the stored summary. */
  async mint(
    siteId: string,
    name: string,
    scope: DeployScope = 'static',
  ): Promise<{ token: string; summary: DeployTokenSummary }> {
    const site = await this.db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundError('Site not found');
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const row = await this.db.deployToken.create({
      data: { siteId, name: name.trim() || 'deploy token', tokenHash: hashToken(token), scope },
    });
    return { token, summary: toSummary(row) };
  }

  async list(siteId: string): Promise<DeployTokenSummary[]> {
    const rows = await this.db.deployToken.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSummary);
  }

  async revoke(siteId: string, tokenId: string): Promise<void> {
    const row = await this.db.deployToken.findUnique({ where: { id: tokenId } });
    if (!row || row.siteId !== siteId) throw new NotFoundError('Deploy token not found');
    if (row.revokedAt) return; // idempotent
    await this.db.deployToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  }

  /**
   * Authenticate a bearer token for a specific site + required scope. Returns
   * the token id (and stamps lastUsedAt) on success, else null. The bearer must
   * belong to THIS site (a token can't deploy a different site) and its scope
   * must cover the requested deploy kind (a static token can't recreate a
   * container).
   */
  async authenticate(
    siteId: string,
    bearer: string | undefined,
    need: 'static' | 'container',
  ): Promise<{ id: string } | null> {
    if (!bearer || !bearer.startsWith(TOKEN_PREFIX)) return null;
    const row = await this.db.deployToken.findUnique({ where: { tokenHash: hashToken(bearer) } });
    if (!row || row.siteId !== siteId || row.revokedAt) return null;
    if (row.scope !== 'both' && row.scope !== need) return null;
    await this.db.deployToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    return { id: row.id };
  }
}

function toSummary(r: {
  id: string;
  siteId: string;
  name: string;
  scope: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): DeployTokenSummary {
  return {
    id: r.id,
    siteId: r.siteId,
    name: r.name,
    scope: (['static', 'container', 'both'].includes(r.scope) ? r.scope : 'static') as DeployScope,
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}
