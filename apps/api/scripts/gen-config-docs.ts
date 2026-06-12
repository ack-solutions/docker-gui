#!/usr/bin/env node
/**
 * Regenerate docs/CONFIG.md from the central registry.
 * Run via `yarn workspace @docker-gui/api docs:config`.
 *
 * CI also runs this and fails the build if the diff is non-empty —
 * forcing the registry to stay the single source of truth.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderConfigMarkdown } from '../src/config/doc-gen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..', '..');
const target = join(repoRoot, 'docs', 'CONFIG.md');

const out = renderConfigMarkdown();
writeFileSync(target, out, 'utf-8');
// eslint-disable-next-line no-console
console.log(`Wrote ${target} (${out.length} bytes)`);
