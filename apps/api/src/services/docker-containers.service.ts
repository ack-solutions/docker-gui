import type Docker from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { ContainerState, ContainerSummary } from '../schemas/container.schema.js';

const DOCKERODE_STATE_MAP: Record<string, ContainerState> = {
  created: 'created',
  running: 'running',
  paused: 'paused',
  restarting: 'restarting',
  removing: 'removing',
  exited: 'exited',
  dead: 'dead',
};

function normalizeState(state: string | undefined): ContainerState {
  if (!state) return 'unknown';
  return DOCKERODE_STATE_MAP[state.toLowerCase()] ?? 'unknown';
}

interface DockerodeContainerInfo {
  Id: string;
  Names?: string[];
  Image: string;
  ImageID: string;
  Command: string;
  State: string;
  Status: string;
  Created: number;
  Ports?: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
  Labels?: Record<string, string>;
}

export class DockerContainersService {
  constructor(private readonly docker: Docker) {}

  async list(opts: { all?: boolean } = {}): Promise<ContainerSummary[]> {
    let raw: DockerodeContainerInfo[];
    try {
      raw = (await this.docker.listContainers({ all: opts.all ?? true })) as DockerodeContainerInfo[];
    } catch (err) {
      throw mapDockerError(err);
    }
    return raw.map(toSummary);
  }

  async inspect(id: string): Promise<unknown> {
    try {
      const c = this.docker.getContainer(id);
      return await c.inspect();
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async start(id: string): Promise<void> {
    try {
      await this.docker.getContainer(id).start();
    } catch (err) {
      // Already running is not an error from a user perspective
      if (isStatusError(err, 304)) return;
      throw mapDockerError(err);
    }
  }

  async stop(id: string, timeoutSeconds = 10): Promise<void> {
    try {
      await this.docker.getContainer(id).stop({ t: timeoutSeconds });
    } catch (err) {
      if (isStatusError(err, 304)) return; // already stopped
      throw mapDockerError(err);
    }
  }

  async restart(id: string, timeoutSeconds = 10): Promise<void> {
    try {
      await this.docker.getContainer(id).restart({ t: timeoutSeconds });
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async remove(id: string, opts: { force?: boolean; removeVolumes?: boolean } = {}): Promise<void> {
    try {
      await this.docker.getContainer(id).remove({
        force: opts.force ?? false,
        v: opts.removeVolumes ?? false,
      });
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  async logs(id: string, opts: { tail?: number } = {}): Promise<string> {
    try {
      const buf = (await this.docker.getContainer(id).logs({
        follow: false,
        stdout: true,
        stderr: true,
        tail: opts.tail ?? 200,
        timestamps: false,
      })) as Buffer;
      return demuxLogs(buf);
    } catch (err) {
      throw mapDockerError(err);
    }
  }
}

export function toSummary(info: DockerodeContainerInfo): ContainerSummary {
  const id = info.Id;
  return {
    id,
    shortId: id.slice(0, 12),
    names: (info.Names ?? []).map((n) => n.replace(/^\//, '')),
    image: info.Image,
    imageId: info.ImageID,
    command: info.Command,
    state: normalizeState(info.State),
    status: info.Status,
    createdAt: new Date(info.Created * 1000).toISOString(),
    ports: (info.Ports ?? []).map((p) => ({
      privatePort: p.PrivatePort,
      ...(p.PublicPort !== undefined ? { publicPort: p.PublicPort } : {}),
      type: p.Type,
      ...(p.IP ? { ip: p.IP } : {}),
    })),
    labels: info.Labels ?? {},
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
  if (isStatusError(err, 404)) {
    return new NotFoundError('Container not found');
  }
  const message = err instanceof Error ? err.message : 'Docker daemon error';
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return new AppError('docker.unavailable', 'Docker daemon is not reachable', 503, {
      original: message,
    });
  }
  const status =
    typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;
  return new AppError('docker.error', message, status >= 400 && status < 600 ? status : 500);
}

/**
 * Demultiplex Docker's stream format. When stdin is not a TTY the stream is a
 * sequence of 8-byte headers: [stream_type, 0,0,0, size_be_u32, ...payload].
 * For TTY containers, the buffer is plain text. We sniff the first byte: if
 * it's a valid stream type (0, 1, or 2) and the buffer is at least 8 bytes,
 * we treat it as multiplexed. Otherwise plain text.
 */
export function demuxLogs(buf: Buffer): string {
  if (buf.length === 0) return '';
  if (buf.length < 8) return buf.toString('utf8');

  const firstByte = buf[0];
  if (firstByte === undefined || firstByte > 2) {
    return buf.toString('utf8');
  }

  const out: string[] = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > buf.length) break;
    out.push(buf.subarray(payloadStart, payloadEnd).toString('utf8'));
    offset = payloadEnd;
  }
  return out.join('');
}
