import { createGunzip } from 'node:zlib';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, normalize, isAbsolute, dirname, relative } from 'node:path';
import * as tar from 'tar-stream';

export class DeployValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeployValidationError';
  }
}

export interface ExtractLimits {
  /** Hard ceiling on total decompressed bytes (gzip-bomb defense). */
  maxBytes: number;
  /** Hard ceiling on file count. */
  maxFiles: number;
  /** Optional per-file ceiling. */
  maxFileBytes?: number;
}

/**
 * Stream a GZIPPED TAR, validate every entry, and write the files under
 * `destDir`. Security posture (never trust the archive):
 *   - rejects absolute paths and any path that escapes destDir ("..")
 *   - rejects everything that isn't a plain file or directory (symlinks,
 *     hardlinks, devices, fifos) — so a symlink can't later be followed out of
 *     the web root
 *   - enforces byte + file-count ceilings AS THE STREAM FLOWS, aborting mid-
 *     stream rather than after the fact (declared sizes are never trusted)
 * Returns the validated file count + decompressed byte total.
 */
export async function extractGzippedTarTo(
  source: Readable,
  destDir: string,
  limits: ExtractLimits,
): Promise<{ files: number; bytes: number }> {
  const extract = tar.extract();
  let totalBytes = 0;
  let fileCount = 0;

  extract.on('entry', (header, stream, next) => {
    // A destroyed sub-stream can emit 'error'; swallow it so it never surfaces
    // as an unhandled event (the abort reason propagates via the pipeline).
    stream.on('error', () => {});
    const fail = (msg: string): void => {
      stream.resume(); // drain so the underlying tar stream can unwind
      extract.destroy(new DeployValidationError(msg));
    };
    // Reject anything that isn't a regular file or directory.
    if (header.type !== 'file' && header.type !== 'directory') {
      fail(`Unsupported archive entry type "${header.type}" (${header.name})`);
      return;
    }
    let safe: string;
    try {
      safe = safeJoin(destDir, header.name);
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Invalid path');
      return;
    }

    if (header.type === 'directory') {
      void mkdir(safe, { recursive: true })
        .then(() => next())
        .catch((err: unknown) => extract.destroy(err as Error));
      return;
    }

    // Regular file.
    fileCount += 1;
    if (fileCount > limits.maxFiles) {
      fail(`Archive has too many files (> ${limits.maxFiles})`);
      return;
    }
    const chunks: Buffer[] = [];
    let fileBytes = 0;
    stream.on('data', (chunk: Buffer) => {
      fileBytes += chunk.length;
      totalBytes += chunk.length;
      if (totalBytes > limits.maxBytes) {
        fail(`Archive exceeds ${limits.maxBytes} bytes (decompressed)`);
        return;
      }
      if (limits.maxFileBytes !== undefined && fileBytes > limits.maxFileBytes) {
        fail(`File exceeds ${limits.maxFileBytes} bytes: ${header.name}`);
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => {
      void mkdir(dirname(safe), { recursive: true })
        .then(() => writeFile(safe, Buffer.concat(chunks)))
        .then(() => next())
        .catch((err: unknown) => extract.destroy(err as Error));
    });
    stream.on('error', (err: Error) => extract.destroy(err));
  });

  await pipeline(source, createGunzip(), extract);
  return { files: fileCount, bytes: totalBytes };
}

/** Join + confirm the result stays inside root. Throws on traversal/absolute. */
function safeJoin(root: string, name: string): string {
  const cleaned = name.replace(/\\/g, '/');
  if (isAbsolute(cleaned) || cleaned.startsWith('/')) {
    throw new DeployValidationError(`Absolute path not allowed: ${name}`);
  }
  const joined = normalize(join(root, cleaned));
  const rel = relative(root, joined);
  if (rel === '' ) return joined;
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new DeployValidationError(`Path escapes deploy root: ${name}`);
  }
  return joined;
}
