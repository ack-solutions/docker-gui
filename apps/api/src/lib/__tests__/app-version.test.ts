import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAppVersion } from '../app-version.js';

describe('readAppVersion', () => {
  let root: string;
  const savedEnv = process.env['npm_package_version'];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'appver-'));
    delete process.env['npm_package_version'];
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (savedEnv === undefined) delete process.env['npm_package_version'];
    else process.env['npm_package_version'] = savedEnv;
  });

  it('reads the version from package.json in the start dir', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
    expect(readAppVersion(root)).toBe('1.2.3');
  });

  it('walks up to find the nearest package.json', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '4.5.6' }));
    const nested = join(root, 'dist', 'lib');
    mkdirSync(nested, { recursive: true });
    expect(readAppVersion(nested)).toBe('4.5.6');
  });

  it('stops at the first package.json found (does not climb past it)', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    const inner = join(root, 'app');
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(inner, 'package.json'), JSON.stringify({ version: '7.7.7' }));
    expect(readAppVersion(inner)).toBe('7.7.7');
  });

  it('falls back to npm_package_version when no manifest is found', () => {
    process.env['npm_package_version'] = '2.0.0';
    const empty = join(root, 'a', 'b', 'c');
    mkdirSync(empty, { recursive: true });
    // no package.json anywhere under the temp tree → climbs to FS root, finds
    // none of ours, falls back to the env var.
    expect(readAppVersion(empty)).toBe('2.0.0');
  });

  it('ignores a package.json with no usable version field', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x' }));
    process.env['npm_package_version'] = '3.1.4';
    expect(readAppVersion(root)).toBe('3.1.4');
  });
});
