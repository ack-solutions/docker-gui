import type { PrismaClient } from '@prisma/client';
import { CryptoBox } from '../lib/crypto-box.js';
import {
  createRegistryClient,
  type RegistryClient,
  type RegistryClientConfig,
} from '../lib/registry-client.js';
import { AppError, NotFoundError } from '../lib/errors.js';

/** Format verify-step errors so lastError carries the AppError code. */
function formatVerifyError(err: unknown): string {
  if (err instanceof AppError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Verification failed';
}

// -------------------- Public types --------------------

export interface RegistryConnectionSummary {
  id: string;
  name: string;
  endpoint: string;
  managed: boolean;
  username: string | null;
  /** True when a password is stored — the value itself is never returned. */
  hasPassword: boolean;
  pushHost: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistryConnectionInput {
  name: string;
  endpoint: string;
  managed?: boolean;
  username?: string;
  password?: string;
  pushHost?: string;
}

export interface UpdateRegistryConnectionInput {
  name?: string;
  endpoint?: string;
  username?: string | null;
  password?: string | null;
  pushHost?: string | null;
}

export interface RepositorySummary {
  name: string;
  tagCount: number;
}

export interface TagSummary {
  tag: string;
  digest: string;
  size: number;
  mediaType: string;
}

// -------------------- DI / options --------------------

export interface RegistryServiceOptions {
  /** Override for tests — return an in-memory RegistryClient. */
  buildClient?: (config: RegistryClientConfig) => RegistryClient;
}

// -------------------- Service --------------------

export class RegistryService {
  private readonly buildClient: (config: RegistryClientConfig) => RegistryClient;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cryptoBox: CryptoBox,
    options: RegistryServiceOptions = {},
  ) {
    this.buildClient = options.buildClient ?? createRegistryClient;
  }

  // -------------------- Connections --------------------

  async listConnections(): Promise<RegistryConnectionSummary[]> {
    const rows = await this.prisma.registryConnection.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toSummary(r));
  }

  async getConnection(id: string): Promise<RegistryConnectionSummary> {
    const row = await this.prisma.registryConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Registry connection not found');
    return this.toSummary(row);
  }

  async createConnection(input: CreateRegistryConnectionInput): Promise<RegistryConnectionSummary> {
    const existing = await this.prisma.registryConnection.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new AppError('registry.duplicate_name', 'A connection with that name already exists', 409);
    }
    const endpoint = normalizeEndpoint(input.endpoint);

    let verified = false;
    let lastVerifiedAt: Date | null = null;
    let lastError: string | null = null;
    try {
      await this.clientFor({
        endpoint,
        ...(input.username ? { username: input.username } : {}),
        ...(input.password ? { password: input.password } : {}),
      }).ping();
      verified = true;
      lastVerifiedAt = new Date();
    } catch (err) {
      lastError = formatVerifyError(err);
    }

    const created = await this.prisma.registryConnection.create({
      data: {
        name: input.name,
        endpoint,
        managed: input.managed ?? false,
        username: input.username ?? null,
        passwordCipher: input.password ? this.cryptoBox.seal(input.password) : null,
        pushHost: input.pushHost ?? null,
        verified,
        lastVerifiedAt,
        lastError,
      },
    });
    return this.toSummary(created);
  }

  async updateConnection(
    id: string,
    input: UpdateRegistryConnectionInput,
  ): Promise<RegistryConnectionSummary> {
    const row = await this.prisma.registryConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Registry connection not found');
    if (input.name && input.name !== row.name) {
      const dup = await this.prisma.registryConnection.findUnique({ where: { name: input.name } });
      if (dup) {
        throw new AppError('registry.duplicate_name', 'A connection with that name already exists', 409);
      }
    }
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data['name'] = input.name;
    if (input.endpoint !== undefined) data['endpoint'] = normalizeEndpoint(input.endpoint);
    if (input.pushHost !== undefined) data['pushHost'] = input.pushHost;
    if (input.username !== undefined) data['username'] = input.username;
    if (input.password !== undefined) {
      data['passwordCipher'] = input.password ? this.cryptoBox.seal(input.password) : null;
    }
    // Touching endpoint or credentials invalidates verification.
    if (input.endpoint !== undefined || input.username !== undefined || input.password !== undefined) {
      data['verified'] = false;
      data['lastVerifiedAt'] = null;
    }
    const updated = await this.prisma.registryConnection.update({ where: { id }, data });
    return this.toSummary(updated);
  }

  async deleteConnection(id: string): Promise<void> {
    const row = await this.prisma.registryConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Registry connection not found');
    await this.prisma.registryConnection.delete({ where: { id } });
  }

  async verifyConnection(id: string): Promise<RegistryConnectionSummary> {
    const row = await this.prisma.registryConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Registry connection not found');
    let verified = false;
    let lastError: string | null = null;
    try {
      await this.clientForRow(row).ping();
      verified = true;
    } catch (err) {
      lastError = formatVerifyError(err);
    }
    const updated = await this.prisma.registryConnection.update({
      where: { id },
      data: { verified, lastVerifiedAt: verified ? new Date() : row.lastVerifiedAt, lastError },
    });
    return this.toSummary(updated);
  }

  // -------------------- Repositories / tags --------------------

  async listRepositories(connectionId: string): Promise<RepositorySummary[]> {
    const client = await this.clientById(connectionId);
    // The registry is an untrusted upstream: validate the names it returns
    // (drop anything that isn't a well-formed repo name) and cap the count so
    // a hostile/misconfigured registry can't make us fan out unboundedly.
    const repos = (await client.listRepositories())
      .filter((name) => VALID_REPO.test(name))
      .slice(0, MAX_REPOS);
    // Tag counts with bounded concurrency (never more than FANOUT in flight),
    // so a registry returning huge lists can't exhaust sockets/memory.
    return mapWithConcurrency(repos, FANOUT, async (name) => {
      const tags = await client.listTags(name).catch(() => []);
      return { name, tagCount: tags.length };
    });
  }

  async listTags(connectionId: string, repo: string): Promise<TagSummary[]> {
    const client = await this.clientById(connectionId);
    const tags = (await client.listTags(repo))
      .filter((tag) => VALID_TAG.test(tag))
      .slice(0, MAX_TAGS);
    return mapWithConcurrency(tags, FANOUT, async (tag) => {
      try {
        const m = await client.getManifest(repo, tag);
        return { tag, digest: m.digest, size: m.size, mediaType: m.mediaType };
      } catch {
        return { tag, digest: '', size: 0, mediaType: 'unknown' };
      }
    });
  }

  /** Delete a tag by resolving it to a digest and deleting that manifest. */
  async deleteTag(connectionId: string, repo: string, tag: string): Promise<void> {
    const client = await this.clientById(connectionId);
    const manifest = await client.getManifest(repo, tag);
    if (!manifest.digest) {
      throw new AppError('registry.no_digest', 'Could not resolve tag to a digest', 502);
    }
    await client.deleteManifest(repo, manifest.digest);
  }

  // -------------------- internals --------------------

  private async clientById(connectionId: string): Promise<RegistryClient> {
    const row = await this.prisma.registryConnection.findUnique({ where: { id: connectionId } });
    if (!row) throw new NotFoundError('Registry connection not found');
    return this.clientForRow(row);
  }

  private clientForRow(row: {
    endpoint: string;
    username: string | null;
    passwordCipher: string | null;
  }): RegistryClient {
    return this.clientFor({
      endpoint: row.endpoint,
      ...(row.username ? { username: row.username } : {}),
      ...(row.passwordCipher ? { password: this.cryptoBox.open(row.passwordCipher) } : {}),
    });
  }

  private clientFor(config: RegistryClientConfig): RegistryClient {
    return this.buildClient(config);
  }

  private toSummary(row: {
    id: string;
    name: string;
    endpoint: string;
    managed: boolean;
    username: string | null;
    passwordCipher: string | null;
    pushHost: string | null;
    verified: boolean;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RegistryConnectionSummary {
    return {
      id: row.id,
      name: row.name,
      endpoint: row.endpoint,
      managed: row.managed,
      username: row.username,
      hasPassword: row.passwordCipher !== null,
      pushHost: row.pushHost,
      verified: row.verified,
      lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

// Hardening limits for data coming back from an untrusted registry upstream.
const MAX_REPOS = 1000;
const MAX_TAGS = 1000;
/** Max concurrent upstream requests during a fan-out (sockets/memory bound). */
const FANOUT = 8;
// Well-formed Docker repository / reference names. Anything else from the
// upstream is dropped before we act on or display it.
const VALID_REPO = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/;
const VALID_TAG = /^[A-Za-z0-9_][A-Za-z0-9._:-]{0,255}$/;

/**
 * Map `items` through `fn` with at most `limit` promises in flight at once.
 * Preserves input order in the output. Used to bound fan-out so a registry
 * returning thousands of repos/tags can't spawn thousands of sockets.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Strip trailing slashes; require an http(s) scheme. */
function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new AppError('registry.invalid_endpoint', 'Endpoint must start with http:// or https://', 400);
  }
  return trimmed;
}
