import { AppError, NotFoundError } from './errors.js';

/**
 * Minimal client for the Docker Registry HTTP API v2.
 * Spec: https://distribution.github.io/distribution/spec/api/
 *
 * We only use the read + delete surface a management UI needs:
 *   GET  /v2/                          → ping (auth / reachability check)
 *   GET  /v2/_catalog                  → list repositories
 *   GET  /v2/<name>/tags/list          → list tags for a repository
 *   HEAD /v2/<name>/manifests/<ref>    → resolve a tag to its digest + size
 *   GET  /v2/<name>/manifests/<ref>    → manifest body (layer sizes)
 *   DELETE /v2/<name>/manifests/<dig>  → delete an image (by digest)
 *
 * Tags are deleted by deleting the manifest they point to — the registry has
 * no "delete tag" verb. `REGISTRY_STORAGE_DELETE_ENABLED=true` must be set on
 * the registry for DELETE to be accepted (otherwise it returns 405).
 */

const MANIFEST_ACCEPT = [
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.oci.image.index.v1+json',
].join(', ');

export interface RegistryClientConfig {
  /** Base URL, no trailing slash, e.g. http://docker-gui-registry:5000 */
  endpoint: string;
  /** Optional basic-auth credentials. */
  username?: string;
  password?: string;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
}

export interface ManifestInfo {
  /** Canonical digest (sha256:…) the tag resolves to. */
  digest: string;
  /** Total size in bytes: config blob + sum of layer sizes (best effort). */
  size: number;
  /** Media type of the manifest. */
  mediaType: string;
}

/**
 * The transport seam. The HTTP implementation talks to a real registry; tests
 * inject an in-memory implementation (mirrors how storage injects an S3 client).
 */
export interface RegistryClient {
  ping(): Promise<void>;
  listRepositories(): Promise<string[]>;
  listTags(repo: string): Promise<string[]>;
  getManifest(repo: string, ref: string): Promise<ManifestInfo>;
  deleteManifest(repo: string, digest: string): Promise<void>;
}

interface ManifestBody {
  mediaType?: string;
  config?: { size?: number };
  layers?: Array<{ size?: number }>;
  manifests?: unknown[];
}

export class HttpRegistryClient implements RegistryClient {
  private readonly base: string;
  private readonly authHeader: string | null;
  private readonly timeoutMs: number;

  constructor(config: RegistryClientConfig) {
    this.base = config.endpoint.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.authHeader =
      config.username !== undefined && config.username !== ''
        ? `Basic ${Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64')}`
        : null;
  }

  private async req(
    path: string,
    init: { method?: string; accept?: string } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.authHeader) headers['authorization'] = this.authHeader;
    if (init.accept) headers['accept'] = init.accept;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.base}${path}`, {
        method: init.method ?? 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('registry.unreachable', `Cannot reach registry: ${msg}`, 503);
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<void> {
    const res = await this.req('/v2/');
    if (res.status === 401 || res.status === 403) {
      throw new AppError('registry.invalid_credentials', 'Registry rejected the credentials', 401);
    }
    if (!res.ok) {
      throw new AppError('registry.upstream_error', `Registry ping failed (${res.status})`, 502);
    }
  }

  async listRepositories(): Promise<string[]> {
    // n=large to avoid paging for typical self-hosted registries.
    const res = await this.req('/v2/_catalog?n=1000');
    if (!res.ok) throw mapStatus(res.status, 'list repositories');
    const body = (await res.json().catch(() => ({}))) as { repositories?: string[] };
    return body.repositories ?? [];
  }

  async listTags(repo: string): Promise<string[]> {
    const res = await this.req(`/v2/${encodePath(repo)}/tags/list`);
    if (res.status === 404) return [];
    if (!res.ok) throw mapStatus(res.status, `list tags for ${repo}`);
    const body = (await res.json().catch(() => ({}))) as { tags?: string[] | null };
    return body.tags ?? [];
  }

  async getManifest(repo: string, ref: string): Promise<ManifestInfo> {
    const res = await this.req(`/v2/${encodePath(repo)}/manifests/${encodeURIComponent(ref)}`, {
      accept: MANIFEST_ACCEPT,
    });
    if (res.status === 404) throw new NotFoundError(`No manifest for ${repo}:${ref}`);
    if (!res.ok) throw mapStatus(res.status, `get manifest ${repo}:${ref}`);
    const digest = res.headers.get('docker-content-digest') ?? '';
    const body = (await res.json().catch(() => ({}))) as ManifestBody;
    const mediaType =
      body.mediaType ?? res.headers.get('content-type') ?? 'application/octet-stream';
    let size = body.config?.size ?? 0;
    for (const layer of body.layers ?? []) size += layer.size ?? 0;
    return { digest, size, mediaType };
  }

  async deleteManifest(repo: string, digest: string): Promise<void> {
    const res = await this.req(`/v2/${encodePath(repo)}/manifests/${encodeURIComponent(digest)}`, {
      method: 'DELETE',
    });
    if (res.status === 404) throw new NotFoundError(`No manifest ${digest} in ${repo}`);
    if (res.status === 405) {
      throw new AppError(
        'registry.delete_disabled',
        'Tag deletion is disabled on this registry (set REGISTRY_STORAGE_DELETE_ENABLED=true)',
        409,
      );
    }
    if (!res.ok && res.status !== 202) throw mapStatus(res.status, `delete ${repo}@${digest}`);
  }
}

/** Repository names contain slashes that must NOT be percent-encoded. */
function encodePath(repo: string): string {
  return repo
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function mapStatus(status: number, action: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError('registry.invalid_credentials', `Registry rejected request to ${action}`, 401);
  }
  if (status === 404) return new NotFoundError(`Registry: ${action} not found`);
  return new AppError('registry.upstream_error', `Registry error during ${action} (${status})`, 502);
}

export function createRegistryClient(config: RegistryClientConfig): RegistryClient {
  return new HttpRegistryClient(config);
}

/** Human-readable byte size for the UI (kept here so CLI can reuse it). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
