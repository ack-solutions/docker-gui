import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import type Docker from 'dockerode';
import type { Container } from 'dockerode';
import * as tarFs from 'tar-fs';
import type { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors.js';
import { extractGzippedTarTo } from '../lib/tar-extract.js';
import type { CryptoBox } from '../lib/crypto-box.js';

export interface DeployServiceOptions {
  caddyContainerName?: string;
  /** Decompressed-byte ceiling per deploy. Default 200 MB. */
  maxBytes?: number;
  /** File-count ceiling per deploy. Default 20000. */
  maxFiles?: number;
  /** Release dirs to retain per site for rollback. Default 5. */
  keepReleases?: number;
  /** Docker network the panel + feature containers share (for app sites). */
  network?: string;
  /** Used to decrypt registry credentials for authenticated image pulls. */
  cryptoBox?: CryptoBox;
}

export interface StaticDeployResult {
  deployId: string;
  files: number;
  bytes: number;
}

export interface ContainerDeployResult {
  image: string;
  containerName: string;
}

export interface DeploySummary {
  id: string;
  siteId: string;
  kind: 'static' | 'container';
  ref: string;
  status: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
}

const SRV_BASE = '/srv/sites';

export class DeployService {
  private readonly caddyName: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly keep: number;
  private readonly network: string;
  private readonly cryptoBox: CryptoBox | undefined;

  constructor(
    private readonly db: PrismaClient,
    private readonly docker: Docker,
    opts: DeployServiceOptions = {},
  ) {
    this.caddyName = opts.caddyContainerName ?? 'docker-gui-caddy';
    this.maxBytes = opts.maxBytes ?? 200 * 1024 * 1024;
    this.maxFiles = opts.maxFiles ?? 20_000;
    this.keep = Math.max(1, opts.keepReleases ?? 5);
    this.network = opts.network ?? 'docker-gui_dgui';
    this.cryptoBox = opts.cryptoBox;
  }

  /** Per-site in-process lock: serialize deploy + rollback for one site so a
   *  concurrent CI deploy and operator rollback can't interleave their
   *  filesystem/container side effects and desync the active release from the
   *  live target (single-box, single-process — an in-process queue suffices). */
  private readonly siteLocks = new Map<string, Promise<unknown>>();

  private withSiteLock<T>(siteId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.siteLocks.get(siteId) ?? Promise.resolve();
    const run = prev.then(() => fn());
    // Store a non-rejecting tail so the next waiter always proceeds.
    this.siteLocks.set(
      siteId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  /**
   * Deploy a gzipped tar of a static build to a site. Validates it on the
   * api's local disk, streams the clean tree into the running Caddy container
   * (no shared mount into the api), then atomically repoints `current` so Caddy
   * never serves a half-written tree. Returns the new release id.
   */
  deployStatic(siteId: string, gzippedTar: Buffer, actor = 'ci'): Promise<StaticDeployResult> {
    return this.withSiteLock(siteId, () => this.runDeployStatic(siteId, gzippedTar, actor));
  }

  private async runDeployStatic(siteId: string, gzippedTar: Buffer, actor: string): Promise<StaticDeployResult> {
    const site = await this.db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundError('Site not found');
    if (site.backendType !== 'static') {
      throw new AppError('deploy.wrong_backend', 'This site is not a static site', 400);
    }

    const caddy = this.docker.getContainer(this.caddyName);
    try {
      await caddy.inspect();
    } catch {
      throw new AppError('deploy.caddy_unavailable', 'Reverse proxy (Caddy) is not running', 503);
    }

    const deployId = `r${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    const tmp = await mkdtemp(join(tmpdir(), 'dgui-deploy-'));
    try {
      // 1) Validate + extract on the api's own disk.
      const { files, bytes } = await extractGzippedTarTo(Readable.from(gzippedTar), tmp, {
        maxBytes: this.maxBytes,
        maxFiles: this.maxFiles,
      });
      if (files === 0) {
        throw new AppError('deploy.empty', 'Archive contained no files', 400);
      }

      // 2) Push the clean tree into Caddy under releases/<deployId>.
      const releaseDir = `${SRV_BASE}/${site.id}/releases/${deployId}`;
      const mk = await this.execSh(caddy, `mkdir -p ${shq(releaseDir)}`);
      if (mk.code !== 0) {
        // Don't reflect raw container shell output to the (CI-token) caller.
        throw new AppError('deploy.mkdir_failed', 'Could not prepare the release directory', 500);
      }
      await caddy.putArchive(tarFs.pack(tmp) as unknown as NodeJS.ReadableStream, { path: releaseDir });

      // 3) Atomic swap of the `current` symlink + prune old releases.
      const base = `${SRV_BASE}/${site.id}`;
      const swap = await this.execSh(
        caddy,
        `ln -sfn ${shq(`releases/${deployId}`)} ${shq(`${base}/current`)} && ` +
          `cd ${shq(`${base}/releases`)} && ls -1t | tail -n +$((${this.keep} + 1)) | xargs -r rm -rf`,
      );
      if (swap.code !== 0) {
        throw new AppError('deploy.swap_failed', 'Could not activate the release', 500);
      }

      await this.db.site.update({ where: { id: site.id }, data: { currentDeployId: deployId } });
      await this.recordDeploy(site.id, 'static', deployId, actor);
      return { deployId, files, bytes };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  /**
   * Deploy a container app: pull the (immutable, :sha) image — authenticating
   * against a matching managed registry if one is configured — then recreate
   * the site's container under its stable name on the shared network, so
   * Caddy's reverse_proxy upstream is unchanged (no /load needed).
   */
  deployContainer(siteId: string, image: string, actor = 'ci'): Promise<ContainerDeployResult> {
    return this.withSiteLock(siteId, () => this.runDeployContainer(siteId, image, actor));
  }

  private async runDeployContainer(siteId: string, image: string, actor: string): Promise<ContainerDeployResult> {
    const site = await this.db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundError('Site not found');
    if (site.backendType !== 'container') {
      throw new AppError('deploy.wrong_backend', 'This site is not a container app', 400);
    }
    if (!site.containerName || !site.containerPort) {
      throw new AppError('deploy.misconfigured', 'Site is missing a container name/port', 400);
    }

    const authconfig = await this.resolveRegistryAuth(image);
    await this.pullImage(image, authconfig);
    await this.recreateContainer(site.containerName, image, site.containerPort, parseEnv(site.envJson));

    await this.db.site.update({
      where: { id: siteId },
      data: { imageRef: image, currentDeployId: `c${Date.now().toString(36)}${randomBytes(2).toString('hex')}` },
    });
    await this.recordDeploy(siteId, 'container', image, actor);
    return { image, containerName: site.containerName };
  }

  // -------------------- History + rollback --------------------

  /** Deploy history for a site, newest first. No secrets in the output. */
  async listDeploys(siteId: string): Promise<DeploySummary[]> {
    const site = await this.db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundError('Site not found');
    const rows = await this.db.deploy.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDeploySummary);
  }

  /**
   * Roll a site back to a prior deploy. Static: re-point the `current` symlink
   * to the prior release dir (after verifying it still exists in Caddy).
   * Container: re-pull + recreate the prior image. Creates a NEW active Deploy
   * row pointing at the restored ref (so history reads forward).
   */
  rollback(siteId: string, deployId: string, actorId: string): Promise<DeploySummary> {
    return this.withSiteLock(siteId, () => this.runRollback(siteId, deployId, actorId));
  }

  private async runRollback(siteId: string, deployId: string, actorId: string): Promise<DeploySummary> {
    const site = await this.db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundError('Site not found');
    // The deploy MUST belong to this site — never trust the path id alone.
    const deploy = await this.db.deploy.findUnique({ where: { id: deployId } });
    if (!deploy || deploy.siteId !== siteId) throw new NotFoundError('Deploy not found');

    if (deploy.kind === 'static') return this.rollbackStatic(site, deploy.id, deploy.ref, actorId);
    if (deploy.kind === 'container') {
      return this.rollbackContainer(site, deploy.ref, actorId);
    }
    throw new AppError('deploy.unknown_kind', 'Unknown deploy kind', 400);
  }

  private async rollbackStatic(
    site: { id: string },
    deployRowId: string,
    ref: string,
    actorId: string,
  ): Promise<DeploySummary> {
    // Defense in depth: a static ref is always a server-generated release id.
    // Reject anything else before it reaches an `sh -c` script.
    if (!/^r[a-z0-9]+$/.test(ref)) {
      throw new AppError('deploy.bad_ref', 'Invalid release reference', 400);
    }
    const caddy = this.docker.getContainer(this.caddyName);
    try {
      await caddy.inspect();
    } catch {
      throw new AppError('deploy.caddy_unavailable', 'Reverse proxy (Caddy) is not running', 503);
    }
    const base = `${SRV_BASE}/${site.id}`;
    const releaseRel = `releases/${ref}`;
    // Check existence AND swap in ONE shell invocation so a concurrent prune
    // (a parallel deploy of this same site) can't delete the target between a
    // separate check and the symlink swap and leave `current` dangling. Exit 3
    // means the release dir is gone; any other non-zero is a swap failure.
    const swap = await this.execSh(
      caddy,
      `test -d ${shq(`${base}/${releaseRel}`)} || exit 3; ` +
        `ln -sfn ${shq(releaseRel)} ${shq(`${base}/current`)}`,
    );
    if (swap.code === 3) {
      await this.db.deploy.update({ where: { id: deployRowId }, data: { status: 'stale' } });
      throw new AppError(
        'deploy.release_gone',
        'That release has been pruned from disk and can no longer be restored',
        409,
      );
    }
    if (swap.code !== 0) {
      throw new AppError('deploy.swap_failed', 'Could not activate the release', 500);
    }
    await this.db.site.update({ where: { id: site.id }, data: { currentDeployId: ref } });
    return toDeploySummary(await this.recordDeploy(site.id, 'static', ref, actorId));
  }

  private async rollbackContainer(
    site: { id: string; containerName: string | null; containerPort: number | null; envJson: string | null },
    image: string,
    actorId: string,
  ): Promise<DeploySummary> {
    if (!site.containerName || !site.containerPort) {
      throw new AppError('deploy.misconfigured', 'Site is missing a container name/port', 400);
    }
    // Pull + recreate BEFORE writing history. recreateContainer is create-then-
    // swap, so a failed pull OR a bad image (start fails) leaves the currently-
    // running container in place — the site keeps serving and no bogus active
    // row is recorded (we rethrow before the DB updates below).
    const authconfig = await this.resolveRegistryAuth(image);
    await this.pullImage(image, authconfig);
    await this.recreateContainer(site.containerName, image, site.containerPort, parseEnv(site.envJson));
    await this.db.site.update({
      where: { id: site.id },
      data: {
        imageRef: image,
        currentDeployId: `c${Date.now().toString(36)}${randomBytes(2).toString('hex')}`,
      },
    });
    return toDeploySummary(await this.recordDeploy(site.id, 'container', image, actorId));
  }

  /**
   * Append a Deploy history row and make it the single active one for the site
   * (supersede any prior active row) in one transaction — so a crash can never
   * leave two active rows.
   */
  private async recordDeploy(
    siteId: string,
    kind: 'static' | 'container',
    ref: string,
    createdBy: string,
  ): Promise<DeployRow> {
    const [, row] = await this.db.$transaction([
      this.db.deploy.updateMany({
        where: { siteId, active: true },
        data: { active: false, status: 'superseded' },
      }),
      this.db.deploy.create({
        data: { siteId, kind, ref, active: true, status: 'active', createdBy },
      }),
    ]);
    return row;
  }

  /** Find managed-registry credentials whose host matches the image, if any. */
  private async resolveRegistryAuth(
    image: string,
  ): Promise<{ username: string; password: string; serveraddress: string } | undefined> {
    const host = registryHostOf(image);
    if (!host || !this.cryptoBox) return undefined;
    const conns = await this.db.registryConnection.findMany();
    const match = conns.find((c) => hostOf(c.endpoint) === host || c.pushHost === host);
    if (!match || !match.username || !match.passwordCipher) return undefined;
    try {
      return { username: match.username, password: this.cryptoBox.open(match.passwordCipher), serveraddress: host };
    } catch {
      return undefined; // unreadable creds → try an anonymous pull
    }
  }

  private pullImage(
    image: string,
    authconfig?: { username: string; password: string; serveraddress: string },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pullOpts = authconfig ? { authconfig } : {};
      this.docker.pull(image, pullOpts, (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err || !stream) return reject(mapPullError(err, image));
        this.docker.modem.followProgress(stream, (e: Error | null) =>
          e ? reject(mapPullError(e, image)) : resolve(),
        );
      });
    });
  }

  /**
   * Recreate the site's app container under its stable name. Create + start the
   * NEW container under a temp name FIRST, so that a bad image (createContainer
   * or start throws) leaves the currently-running container untouched — the
   * site keeps serving and no DB state is updated. Only once the new container
   * is up do we remove the old one and rename the new into place.
   */
  private async recreateContainer(
    name: string,
    image: string,
    port: number,
    env: Record<string, string>,
  ): Promise<void> {
    const tempName = `${name}-deploying`;
    // Clear any leftover temp container from a previously-failed attempt.
    await this.removeQuietly(tempName);

    const container = await this.docker.createContainer({
      name: tempName,
      Image: image,
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: { [`${port}/tcp`]: {} },
      Labels: {
        'docker-gui.managed-by': 'deploy-service',
        'docker-gui.site-app': name,
      },
      HostConfig: {
        NetworkMode: this.network,
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });
    try {
      await container.start();
    } catch (err) {
      // New container failed to start — tear it down and leave the old one
      // (if any) running. The caller's DB updates are skipped (we rethrow).
      await this.removeQuietly(tempName);
      throw err;
    }
    // New container is up: drop the old one and promote the temp name.
    await this.removeQuietly(name);
    await container.rename({ name });
  }

  /** Remove a container by name, ignoring "not found" (best-effort cleanup). */
  private async removeQuietly(name: string): Promise<void> {
    try {
      await this.docker.getContainer(name).remove({ force: true });
    } catch {
      // not running / doesn't exist
    }
  }

  /** Run `sh -c <script>` in a container; return exit code + combined output. */
  private async execSh(container: Container, script: string): Promise<{ code: number; out: string }> {
    const exec = await container.exec({
      Cmd: ['sh', '-c', script],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    const out = await collect(stream);
    const info = await exec.inspect();
    return { code: info.ExitCode ?? -1, out: out.slice(0, 2000) };
  }
}

interface DeployRow {
  id: string;
  siteId: string;
  kind: string;
  ref: string;
  status: string;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
}

function toDeploySummary(d: DeployRow): DeploySummary {
  return {
    id: d.id,
    siteId: d.siteId,
    kind: (d.kind === 'container' ? 'container' : 'static'),
    ref: d.ref,
    status: d.status,
    active: d.active,
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
  };
}

function collect(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

/** Single-quote a path for safe interpolation into an sh -c script. */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function parseEnv(envJson: string | null): Record<string, string> {
  if (!envJson) return {};
  try {
    const parsed = JSON.parse(envJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** The registry host of an image ref, or null for an implicit Docker Hub ref.
 *  "registry.example.com/app:sha" → "registry.example.com"; "nginx:latest" → null. */
function registryHostOf(image: string): string | null {
  const first = image.split('/')[0] ?? '';
  // A registry host has a dot or a port (":"), or is "localhost".
  if (first.includes('.') || first.includes(':') || first === 'localhost') return first;
  return null;
}

function hostOf(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

/** Turn a docker pull failure into a clear, actionable AppError. Plain-HTTP /
 *  unreachable registries are the common self-host snag — point at the fix. */
function mapPullError(err: Error | null, image: string): AppError {
  // Do NOT reflect the raw daemon error text to the caller — it leaks internal
  // registry hosts/paths/TLS details and acts as an image-resolution oracle to
  // a low-privilege CI-token holder. Classify on it, but return a fixed message
  // that only echoes back the caller-supplied image ref (not a secret).
  const msg = err?.message ?? '';
  if (/http: server gave HTTP response to HTTPS client|insecure|connection refused|no such host|certificate/i.test(msg)) {
    return new AppError(
      'deploy.registry_unreachable',
      `Could not pull ${image}: the Docker host could not reach the registry over HTTPS. Front the registry with a Site (TLS) or add it to the daemon's insecure-registries.`,
      502,
    );
  }
  return new AppError(
    'deploy.pull_failed',
    `Could not pull ${image}: check the registry connection and that the image tag exists.`,
    502,
  );
}
