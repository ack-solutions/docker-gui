/**
 * Verifies that the on-disk docs/CONFIG.md byte-for-byte matches what
 * renderConfigMarkdown() produces from the current registry. This is the
 * "registry is the truth" invariant — drift fails CI.
 *
 * Also checks the renderer covers every registry key and every group.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderConfigMarkdown } from '../doc-gen.js';
import { CONFIG_REGISTRY, listGroups } from '../registry.js';

describe('renderConfigMarkdown', () => {
  it('emits a header that warns hand-edits will be overwritten', () => {
    const md = renderConfigMarkdown();
    expect(md).toMatch(/AUTO-GENERATED/);
  });

  it('includes a section heading for every group', () => {
    const md = renderConfigMarkdown();
    for (const g of listGroups()) {
      // Group title (any-case) appears at least once after the TOC.
      expect(md.toLowerCase()).toContain(g.toLowerCase().replace(/\/.*/, ''));
    }
  });

  it('renders every registered key by name', () => {
    const md = renderConfigMarkdown();
    for (const k of CONFIG_REGISTRY) {
      expect(md, `key ${k.key} missing from doc`).toContain('`' + k.key + '`');
    }
  });

  it('masks secret defaults rather than printing them', () => {
    const md = renderConfigMarkdown();
    // Secret keys whose default is non-empty should not appear verbatim.
    const secrets = CONFIG_REGISTRY.filter((k) => k.secret);
    for (const s of secrets) {
      if (typeof s.default === 'string' && s.default.length > 0) {
        expect(md).not.toContain(s.default);
      }
    }
  });

  it('flags deprecated keys with a warning badge', () => {
    const md = renderConfigMarkdown();
    const deprecated = CONFIG_REGISTRY.filter((k) => k.deprecatedIn);
    for (const d of deprecated) {
      const line = md.split('\n').find((l) => l.includes('`' + d.key + '`'));
      expect(line, `expected deprecation badge for ${d.key}`).toMatch(/deprecated/);
    }
  });
});

describe('docs/CONFIG.md on disk matches the registry', () => {
  const docsPath = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'CONFIG.md');

  it('the file exists', () => {
    expect(existsSync(docsPath)).toBe(true);
  });

  it('matches renderConfigMarkdown() exactly', () => {
    const onDisk = readFileSync(docsPath, 'utf-8');
    const generated = renderConfigMarkdown();
    if (onDisk !== generated) {
      throw new Error(
        'docs/CONFIG.md is out of date. Run `yarn workspace @dgui/api docs:config` to regenerate.',
      );
    }
    expect(onDisk).toBe(generated);
  });
});
