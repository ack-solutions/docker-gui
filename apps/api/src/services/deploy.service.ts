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
  /** Release dirs to retain per site for rollback. Default 2. */
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
    this.keep = Math.max(1, opts.keepReleases ?? 2);
    this.network = opts.network ?? 'docker-gui_dgui';
    this.cryptoBox = opts.cryptoBox;
  }

  /**
   * Deploy a gzipped tar of a static build to a site. Validates it on the
   * api's local disk, streams the clean tree into the running Caddy container
   * (no shared mount into the api), then atomically repoints `current` so Caddy
   * never serves a half-written tree. Returns the new release id.
   */
  async deployStatic(siteId: string, gzippedTar: Buffer): Promise<StaticDeployResult> {
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
        throw new AppError('deploy.mkdir_failed', `Could not prepare release dir: ${mk.out}`, 500);
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
        throw new AppError('deploy.swap_failed', `Could not activate release: ${swap.out}`, 500);
      }

      await this.db.site.update({ where: { id: site.id }, data: { currentDeployId: deployId } });
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
  async deployContainer(siteId: string, image: string): Promise<ContainerDeployResult> {
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
    return { image, containerName: site.containerName };
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

  private async recreateContainer(
    name: string,
    image: string,
    port: number,
    env: Record<string, string>,
  ): Promise<void> {
    // Remove the previous container (if any) under the stable name.
    try {
      await this.docker.getContainer(name).remove({ force: true });
    } catch {
      // not running / doesn't exist — first deploy
    }
    const container = await this.docker.createContainer({
      name,
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
    await container.start();
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
  const msg = err?.message ?? 'unknown error';
  if (/http: server gave HTTP response to HTTPS client|insecure|connection refused|no such host|certificate/i.test(msg)) {
    return new AppError(
      'deploy.registry_unreachable',
      `Could not pull ${image}: ${msg}. The Docker host must be able to pull this image over HTTPS — front the registry with a Site (TLS) or add it to the daemon's insecure-registries.`,
      502,
    );
  }
  return new AppError('deploy.pull_failed', `Could not pull ${image}: ${msg}`, 502);
}
