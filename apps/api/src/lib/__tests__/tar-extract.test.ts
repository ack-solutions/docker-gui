import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { pack as tarPack } from 'tar-stream';
import { extractGzippedTarTo, DeployValidationError } from '../tar-extract.js';

interface Entry {
  name: string;
  content?: string;
  type?: 'file' | 'directory' | 'symlink';
  linkname?: string;
}

async function makeGzippedTar(entries: Entry[]): Promise<Buffer> {
  const pack = tarPack();
  for (const e of entries) {
    if (e.type === 'symlink') pack.entry({ name: e.name, type: 'symlink', linkname: e.linkname ?? '/etc/passwd' });
    else if (e.type === 'directory') pack.entry({ name: e.name, type: 'directory' });
    else pack.entry({ name: e.name }, e.content ?? '');
  }
  pack.finalize();
  const chunks: Buffer[] = [];
  for await (const c of pack) chunks.push(c as Buffer);
  return gzipSync(Buffer.concat(chunks));
}

const LIMITS = { maxBytes: 1024 * 1024, maxFiles: 100 };

describe('extractGzippedTarTo', () => {
  let dest: string;
  beforeEach(async () => {
    dest = await mkdtemp(join(tmpdir(), 'tar-test-'));
  });
  afterEach(async () => {
    await rm(dest, { recursive: true, force: true });
  });

  it('extracts a valid build tree', async () => {
    const gz = await makeGzippedTar([
      { name: 'index.html', content: '<h1>hi</h1>' },
      { name: 'assets', type: 'directory' },
      { name: 'assets/app.js', content: 'console.log(1)' },
    ]);
    const res = await extractGzippedTarTo(Readable.from(gz), dest, LIMITS);
    expect(res.files).toBe(2);
    expect(await readFile(join(dest, 'index.html'), 'utf8')).toBe('<h1>hi</h1>');
    expect(await readFile(join(dest, 'assets/app.js'), 'utf8')).toBe('console.log(1)');
  });

  it('rejects path traversal (..)', async () => {
    const gz = await makeGzippedTar([{ name: '../escape.txt', content: 'x' }]);
    await expect(extractGzippedTarTo(Readable.from(gz), dest, LIMITS)).rejects.toBeInstanceOf(
      DeployValidationError,
    );
  });

  it('rejects absolute paths', async () => {
    const gz = await makeGzippedTar([{ name: '/etc/cron.d/evil', content: 'x' }]);
    await expect(extractGzippedTarTo(Readable.from(gz), dest, LIMITS)).rejects.toBeInstanceOf(
      DeployValidationError,
    );
  });

  it('rejects symlink entries (no symlink-escape of the web root)', async () => {
    const gz = await makeGzippedTar([{ name: 'link', type: 'symlink', linkname: '/etc/passwd' }]);
    await expect(extractGzippedTarTo(Readable.from(gz), dest, LIMITS)).rejects.toBeInstanceOf(
      DeployValidationError,
    );
  });

  it('enforces the file-count ceiling', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' }));
    await expect(
      extractGzippedTarTo(Readable.from(await makeGzippedTar(many)), dest, { maxBytes: 1e6, maxFiles: 5 }),
    ).rejects.toBeInstanceOf(DeployValidationError);
  });

  it('enforces the decompressed-byte ceiling mid-stream', async () => {
    const big = 'a'.repeat(50_000);
    await expect(
      extractGzippedTarTo(Readable.from(await makeGzippedTar([{ name: 'big.txt', content: big }])), dest, {
        maxBytes: 10_000,
        maxFiles: 100,
      }),
    ).rejects.toBeInstanceOf(DeployValidationError);
  });
});
