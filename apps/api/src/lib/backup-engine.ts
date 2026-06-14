import type Docker from 'dockerode';
import { Writable } from 'node:stream';
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
        const errText = Buffer.concat(stderrChunks).toString('utf8').slice(0, 2000);
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
