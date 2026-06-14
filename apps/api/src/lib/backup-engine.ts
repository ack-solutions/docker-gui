import type Docker from 'dockerode';
import { Writable, type Duplex } from 'node:stream';
import { AppError } from './errors.js';
import type { QueryConfig } from './db-query.js';

/**
 * Produces a logical dump of a database. The dump bytes are returned in
 * memory (suitable for small/medium databases; streaming multipart upload for
 * very large dumps is a future enhancement).
 *
 * The real implementation runs the engine's own CLI tool (pg_dump /
 * mysqldump) in a one-shot container attached to the same docker network as
 * the api, so it can reach the database container by name. Tests inject a fake.
 */
export interface BackupEngine {
  dump(config: QueryConfig): Promise<{ data: Buffer; filename: string }>;
  /** Restore a previously-taken dump into the target database. */
  restore(config: QueryConfig, data: Buffer): Promise<void>;
}

/** Default tool image per engine (version-forward-compatible dump tools). */
const DUMP_IMAGE: Record<string, string> = {
  postgres: 'postgres:16-alpine',
  mysql: 'mysql:8.4',
  mariadb: 'mariadb:11',
};

export interface DockerBackupEngineOptions {
  /** Docker network the api is on (so the one-shot container can reach the DB). */
  network: string;
  /** Per-request safety timeout (ms). */
  timeoutMs?: number;
}

/**
 * Real dockerode-backed dumper. Verified on a live server — unit tests use an
 * injected fake instead (no Docker/DB needed in CI).
 */
export class DockerBackupEngine implements BackupEngine {
  constructor(
    private readonly docker: Docker,
    private readonly opts: DockerBackupEngineOptions,
  ) {}

  async dump(config: QueryConfig): Promise<{ data: Buffer; filename: string }> {
    const image = DUMP_IMAGE[config.engine] ?? DUMP_IMAGE['postgres']!;
    const { cmd, env, filename } = buildDumpCommand(config);

    const container = await this.docker.createContainer({
      Image: image,
      Cmd: cmd,
      Env: env,
      Tty: false,
      HostConfig: {
        NetworkMode: this.opts.network,
        AutoRemove: false,
      },
      Labels: { 'docker-gui.managed-by': 'backup-engine' },
    });

    // Attach BEFORE start so we don't miss output. Docker multiplexes
    // stdout/stderr on one stream; demux into separate collectors.
    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const stdout = collector(stdoutChunks);
    const stderr = collector(stderrChunks);
    this.docker.modem.demuxStream(stream, stdout, stderr);

    try {
      await container.start();
      const result = (await container.wait()) as { StatusCode?: number };
      const exitCode = result.StatusCode ?? 0;
      if (exitCode !== 0) {
        const errText = sanitizeDbError(Buffer.concat(stderrChunks).toString('utf8'));
        throw new AppError('backup.dump_failed', `Dump failed (exit ${exitCode}): ${errText}`, 502);
      }
      return { data: Buffer.concat(stdoutChunks), filename };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('backup.dump_error', `Backup error: ${msg}`, 502);
    } finally {
      await container.remove({ force: true }).catch(() => undefined);
    }
  }

  async restore(config: QueryConfig, data: Buffer): Promise<void> {
    const image = DUMP_IMAGE[config.engine] ?? DUMP_IMAGE['postgres']!;
    const { cmd, env } = buildRestoreCommand(config);

    const container = await this.docker.createContainer({
      Image: image,
      Cmd: cmd,
      Env: env,
      Tty: false,
      OpenStdin: true,
      StdinOnce: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        NetworkMode: this.opts.network,
        AutoRemove: false,
      },
      Labels: { 'docker-gui.managed-by': 'backup-engine' },
    });

    // Hijack the duplex stream so we can write the dump to the container's
    // stdin and read its stdout/stderr. dockerode types it as a plain
    // ReadWriteStream; it is a Duplex in practice.
    const stream = (await container.attach({
      stream: true,
      hijack: true,
      stdin: true,
      stdout: true,
      stderr: true,
    })) as unknown as Duplex;
    const stderrChunks: Buffer[] = [];
    // Register an error handler up front: the hijacked duplex stream emits
    // 'error' events asynchronously (socket close, daemon hiccup) that a
    // try/catch cannot catch — without a listener they crash the process.
    let streamErr: Error | null = null;
    stream.on('error', (e: Error) => {
      streamErr = e;
    });
    this.docker.modem.demuxStream(stream, collector([]), collector(stderrChunks));

    try {
      await container.start();
      // Feed the dump to stdin and signal EOF atomically. end(chunk, cb)
      // handles backpressure (buffers + flushes) and the callback fires once
      // drained; reject if the stream errors mid-write.
      await new Promise<void>((resolve, reject) => {
        if (streamErr) return reject(streamErr);
        stream.once('error', reject);
        stream.end(data, () => resolve());
      });
      const result = (await container.wait()) as { StatusCode?: number };
      const exitCode = result.StatusCode ?? 0;
      if (exitCode !== 0) {
        const errText = sanitizeDbError(Buffer.concat(stderrChunks).toString('utf8'));
        throw new AppError('backup.restore_failed', `Restore failed (exit ${exitCode}): ${errText}`, 502);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('backup.restore_error', `Restore error: ${msg}`, 502);
    } finally {
      // Always tear the stream down — if start() threw we never wrote/ended it.
      stream.destroy();
      await container.remove({ force: true }).catch(() => undefined);
    }
  }
}

/**
 * Scrub anything password-shaped out of a DB tool's stderr before it reaches
 * the client. pg_dump/mysqldump don't normally print credentials, but the
 * project rule is to never forward raw third-party error text verbatim.
 */
export function sanitizeDbError(stderr: string): string {
  return stderr
    .replace(/PGPASSWORD\s*=\s*\S+/gi, 'PGPASSWORD=***')
    .replace(/MYSQL_PWD\s*=\s*\S+/gi, 'MYSQL_PWD=***')
    .replace(/--password\s*=\s*\S+/gi, '--password=***')
    .replace(/password['"]?\s*[:=]\s*\S+/gi, 'password=***')
    .trim()
    .slice(0, 2000);
}

function collector(chunks: Buffer[]): Writable {
  return new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
}

/**
 * Build the dump command + env for an engine. Credentials go via ENV (never
 * interpolated into the command), and all connection values are passed as
 * discrete argv entries (no shell), so there is no command-injection surface.
 */
export function buildDumpCommand(config: QueryConfig): {
  cmd: string[];
  env: string[];
  filename: string;
} {
  const db = config.database ?? '';
  if (config.engine === 'postgres') {
    return {
      cmd: [
        'pg_dump',
        '-h', config.host,
        '-p', String(config.port),
        '-U', config.username,
        '--no-owner',
        '--no-acl',
        ...(db ? ['-d', db] : []),
      ],
      env: [`PGPASSWORD=${config.password ?? ''}`, 'PGCONNECT_TIMEOUT=8'],
      filename: `${db || 'postgres'}.sql`,
    };
  }
  // mysql / mariadb
  return {
    cmd: [
      'mysqldump',
      '-h', config.host,
      '-P', String(config.port),
      '-u', config.username,
      '--single-transaction',
      '--skip-lock-tables',
      ...(db ? [db] : ['--all-databases']),
    ],
    // Password goes ONLY via MYSQL_PWD env — never in argv. A `--password=…`
    // flag would be visible to `docker inspect` / `ps` on the host; the env
    // var is not exposed that way. (pg_dump uses PGPASSWORD the same way.)
    env: [`MYSQL_PWD=${config.password ?? ''}`],
    filename: `${db || 'all-databases'}.sql`,
  };
}

/**
 * Build the restore command + env. The client tool reads the dump from stdin.
 * As with dumps: discrete argv (no shell) and the password via ENV only.
 */
export function buildRestoreCommand(config: QueryConfig): { cmd: string[]; env: string[] } {
  const db = config.database ?? '';
  if (config.engine === 'postgres') {
    return {
      cmd: [
        'psql',
        '-h', config.host,
        '-p', String(config.port),
        '-U', config.username,
        '-v', 'ON_ERROR_STOP=1',
        ...(db ? ['-d', db] : []),
      ],
      env: [`PGPASSWORD=${config.password ?? ''}`, 'PGCONNECT_TIMEOUT=8'],
    };
  }
  // mysql / mariadb
  return {
    cmd: [
      'mysql',
      '-h', config.host,
      '-P', String(config.port),
      '-u', config.username,
      ...(db ? [db] : []),
    ],
    env: [`MYSQL_PWD=${config.password ?? ''}`],
  };
}
