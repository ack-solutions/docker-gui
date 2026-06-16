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

export interface DeployServiceOptions {
  caddyContainerName?: string;
  /** Decompressed-byte ceiling per deploy. Default 200 MB. */
  maxBytes?: number;
  /** File-count ceiling per deploy. Default 20000. */
  maxFiles?: number;
  /** Release dirs to retain per site for rollback. Default 2. */
  keepReleases?: number;
}

export interface StaticDeployResult {
  deployId: string;
  files: number;
  bytes: number;
}

const SRV_BASE = '/srv/sites';

export class DeployService {
  private readonly caddyName: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly keep: number;

  constructor(
    private readonly db: PrismaClient,
    private readonly docker: Docker,
    opts: DeployServiceOptions = {},
  ) {
    this.caddyName = opts.caddyContainerName ?? 'docker-gui-caddy';
    this.maxBytes = opts.maxBytes ?? 200 * 1024 * 1024;
    this.maxFiles = opts.maxFiles ?? 20_000;
    this.keep = Math.max(1, opts.keepReleases ?? 2);
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
