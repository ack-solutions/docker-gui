import type Docker from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';
import { pullImageInputSchema, type ImageSummary } from '../schemas/image.schema.js';

interface DockerodeImageInfo {
  Id: string;
  RepoTags?: string[] | null;
  RepoDigests?: string[] | null;
  Size: number;
  VirtualSize?: number;
  Created: number;
  Labels?: Record<string, string> | null;
  Containers?: number;
}

export class DockerImagesService {
  constructor(private readonly docker: Docker) {}

  async list(): Promise<ImageSummary[]> {
    let raw: DockerodeImageInfo[];
    try {
      raw = (await this.docker.listImages({ all: false })) as DockerodeImageInfo[];
    } catch (err) {
      throw mapDockerError(err);
    }
    return raw.map(toSummary);
  }

  async inspect(id: string): Promise<unknown> {
    try {
      return await this.docker.getImage(id).inspect();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async remove(id: string, opts: { force?: boolean } = {}): Promise<void> {
    try {
      await this.docker.getImage(id).remove({ force: opts.force ?? false });
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  /**
   * Pull an image. Returns a summary of progress events for the caller to
   * display. Pull is intentionally synchronous (we wait for completion) so
   * the route returns when it's done — fine for v1, becomes a streaming
   * endpoint in a later slice.
   */
  async pull(rawReference: string): Promise<{ reference: string; events: number }> {
    const { reference } = pullImageInputSchema.parse({ reference: rawReference });

    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      this.docker.pull(reference, (err: Error | null, s?: NodeJS.ReadableStream) => {
        if (err) return reject(mapDockerError(err));
        if (!s) return reject(new AppError('docker.pull_failed', 'No stream from pull'));
        resolve(s);
      });
    });

    return new Promise((resolve, reject) => {
      let events = 0;
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) return reject(mapDockerError(err));
          resolve({ reference, events });
        },
        () => {
          events += 1;
        },
      );
    });
  }
}

export function toSummary(info: DockerodeImageInfo): ImageSummary {
  const repoTags = (info.RepoTags ?? []).filter((t) => t && t !== '<none>:<none>');
  return {
    id: info.Id,
    shortId: info.Id.startsWith('sha256:') ? info.Id.slice(7, 19) : info.Id.slice(0, 12),
    repoTags,
    repoDigests: info.RepoDigests ?? [],
    sizeBytes: info.Size,
    virtualSizeBytes: info.VirtualSize ?? info.Size,
    createdAt: new Date(info.Created * 1000).toISOString(),
    labels: info.Labels ?? {},
    containers: info.Containers ?? -1,
    dangling: repoTags.length === 0,
  };
}

function isStatusError(err: unknown, code: number): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: unknown }).statusCode === code
  );
}

function mapDockerError(err: unknown): AppError {
  if (isStatusError(err, 404)) return new NotFoundError('Image not found');
  if (isStatusError(err, 409)) {
    return new AppError(
      'docker.image_in_use',
      'Image is in use by a container. Remove the container first or pass force=true.',
      409,
    );
  }
  const message = err instanceof Error ? err.message : 'Docker daemon error';
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return new AppError('docker.unavailable', 'Docker daemon is not reachable', 503);
  }
  const status =
    typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;
  return new AppError('docker.error', message, status >= 400 && status < 600 ? status : 500);
}
