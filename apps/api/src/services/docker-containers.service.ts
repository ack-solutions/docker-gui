import type Docker from 'dockerode';
import type { ContainerStats } from 'dockerode';
import { AppError, NotFoundError } from '../lib/errors.js';
import type { ContainerState, ContainerSummary } from '../schemas/container.schema.js';
import {
  computeContainerCpuPercent,
  computeContainerMemoryPercent,
  type ContainerStatSample,
} from './metric-snapshot.js';

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

  /** Names (no leading slash) of currently-running containers. Cheap — one
   *  listContainers call, no per-container stats. Used to build the alert
   *  metric catalog. Returns [] if the daemon is unreachable. */
  async runningNames(): Promise<string[]> {
    try {
      const raw = (await this.docker.listContainers({ all: false })) as DockerodeContainerInfo[];
      return raw.map((info) => (info.Names?.[0] ?? info.Id).replace(/^\//, ''));
    } catch {
      return [];
    }
  }

  /**
   * Sample CPU/memory for every running container, for the alert evaluator.
   * Uses a non-streaming stats read (the daemon computes the delta against the
   * previous sample, so precpu_stats is valid). Per-container failures and a
   * per-call timeout are swallowed so one bad container can't stall the loop or
   * skew metrics. Returns [] if the daemon is unreachable.
   */
  async sampleStats(
    opts: { timeoutMs?: number; concurrency?: number } = {},
  ): Promise<ContainerStatSample[]> {
    let raw: DockerodeContainerInfo[];
    try {
      raw = (await this.docker.listContainers({ all: false })) as DockerodeContainerInfo[];
    } catch {
      return [];
    }
    const timeoutMs = opts.timeoutMs ?? 4000;
    const concurrency = Math.max(1, opts.concurrency ?? 5);
    const out: ContainerStatSample[] = [];
    for (let i = 0; i < raw.length; i += concurrency) {
      const batch = raw.slice(i, i + concurrency);
      const settled = await Promise.all(
        batch.map(async (info) => {
          const name = (info.Names?.[0] ?? info.Id).replace(/^\//, '');
          try {
            const stats = (await withTimeout(
              this.docker.getContainer(info.Id).stats({ stream: false }),
              timeoutMs,
            )) as ContainerStats;
            return {
              name,
              cpuPercent: computeContainerCpuPercent(stats),
              memoryPercent: computeContainerMemoryPercent(stats),
            };
          } catch {
            return null;
          }
        }),
      );
      for (const s of settled) if (s) out.push(s);
    }
    return out;
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

  /**
   * Open a follow=true log stream from Docker. The returned stream is
   * dockerode's raw multiplexed stream (or plain text for TTY containers);
   * demux with `LogStreamDemuxer` if you need stdout/stderr split.
   *
   * The caller is responsible for `stream.destroy()` when done.
   */
  async streamLogs(id: string, opts: { tail?: number } = {}): Promise<NodeJS.ReadableStream> {
    try {
      const stream = (await this.docker.getContainer(id).logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: opts.tail ?? 100,
        timestamps: false,
      })) as NodeJS.ReadableStream;
      return stream;
    } catch (err) {
      throw mapDockerError(err);
    }
  }

  /**
   * Open an interactive exec session in the container.
   *
   * Returns a hijacked duplex stream (write to send stdin, read stdout/stderr)
   * plus a `resize(rows, cols)` helper and an `inspect()` to read the exit
   * code once the process ends. Tty=true means the stream is NOT multiplexed —
   * read it as raw bytes / UTF-8.
   *
   * The caller MUST call `stream.destroy()` when done.
   */
  async exec(
    id: string,
    opts: { cmd: string[]; cols?: number; rows?: number; user?: string; workingDir?: string } = {
      cmd: ['/bin/sh'],
    },
  ): Promise<ExecSession> {
    try {
      const container = this.docker.getContainer(id);
      const exec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: opts.cmd,
        ...(opts.user !== undefined ? { User: opts.user } : {}),
        ...(opts.workingDir !== undefined ? { WorkingDir: opts.workingDir } : {}),
      });

      const stream = (await exec.start({
        hijack: true,
        stdin: true,
        ...(opts.cols !== undefined && opts.rows !== undefined
          ? { Detach: false, Tty: true }
          : {}),
      })) as NodeJS.ReadWriteStream;

      if (opts.cols !== undefined && opts.rows !== undefined) {
        try {
          await exec.resize({ h: opts.rows, w: opts.cols });
        } catch {
          // pre-output resize sometimes fails on slow daemons; ignore
        }
      }

      return {
        stream,
        resize: async (rows: number, cols: number) => {
          await exec.resize({ h: rows, w: cols });
        },
        inspect: async () => {
          const info = (await exec.inspect()) as { ExitCode: number | null; Running: boolean };
          return { exitCode: info.ExitCode, running: info.Running };
        },
      };
    } catch (err) {
      throw mapDockerError(err);
    }
  }
}

export interface ExecSession {
  stream: NodeJS.ReadWriteStream;
  resize: (rows: number, cols: number) => Promise<void>;
  inspect: () => Promise<{ exitCode: number | null; running: boolean }>;
}

/**
 * Streaming demuxer for Docker's multiplexed log format. Push partial
 * buffers via `feed`; emit complete-frame strings tagged with their stream
 * (1=stdout, 2=stderr) via the `onFrame` callback. Buffers leftover bytes
 * across calls.
 */
export class LogStreamDemuxer {
  private buf: Buffer = Buffer.alloc(0);
  private tty = false;

  /**
   * If we receive data and the first byte isn't a valid stream type, we
   * treat the entire stream as TTY (plain text) for the rest of its life.
   */
  feed(chunk: Buffer, onFrame: (kind: 'stdout' | 'stderr', text: string) => void): void {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    if (this.tty) {
      onFrame('stdout', this.buf.toString('utf8'));
      this.buf = Buffer.alloc(0);
      return;
    }
    while (this.buf.length >= 8) {
      const first = this.buf[0]!;
      if (first > 2) {
        // not multiplexed — flip to TTY mode
        this.tty = true;
        onFrame('stdout', this.buf.toString('utf8'));
        this.buf = Buffer.alloc(0);
        return;
      }
      const size = this.buf.readUInt32BE(4);
      if (this.buf.length < 8 + size) break;
      const payload = this.buf.subarray(8, 8 + size).toString('utf8');
      onFrame(first === 2 ? 'stderr' : 'stdout', payload);
      this.buf = this.buf.subarray(8 + size);
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

/** Reject if a promise doesn't settle within `ms`. The Docker stats read can
 *  hang on a wedged container; this caps the per-container cost. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('stats timed out')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
