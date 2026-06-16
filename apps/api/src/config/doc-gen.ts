/**
 * Generate `docs/CONFIG.md` from the central registry.
 *
 * Two entry points:
 *   - `renderConfigMarkdown()` — pure function that returns the doc string,
 *     used by tests to assert the registry-doc invariant.
 *   - The CLI shim in `scripts/gen-config-docs.ts` writes it to disk and
 *     CI verifies the file on disk matches `renderConfigMarkdown()`.
 *
 * The header explicitly says "AUTO-GENERATED" so hand-edits get noticed.
 */

import { CONFIG_REGISTRY, type ConfigGroup, type ConfigKeyDef, listGroups } from './registry.js';

const GROUP_TITLES: Record<ConfigGroup, string> = {
  'core/auth': 'Authentication',
  'core/networking': 'Networking',
  'core/logging': 'Logging',
  'core/rate-limit': 'Rate limiting',
  docker: 'Docker',
  caddy: 'Caddy (reverse proxy)',
  dns: 'DNS',
  storage: 'Storage',
  features: 'Features',
  alerts: 'Alerts (email)',
  system: 'System',
};

function renderKey(def: ConfigKeyDef<unknown>): string {
  const lines: string[] = [];
  const requiredBadge = def.required ? ' **required**' : '';
  const secretBadge = def.secret ? ' 🔒' : '';
  const deprecatedBadge = def.deprecatedIn ? ' ⚠ deprecated' : '';
  lines.push(`### \`${def.key}\`${requiredBadge}${secretBadge}${deprecatedBadge}`);
  lines.push('');
  lines.push(def.description);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Type | \`${def.type}\` |`);
  if (def.enumValues) {
    lines.push(`| Allowed | ${def.enumValues.map((v) => `\`${v}\``).join(' · ')} |`);
  }
  if (def.default !== undefined) {
    const shown = def.secret ? '`<masked>`' : `\`${String(def.default)}\``;
    lines.push(`| Default | ${shown} |`);
  } else if (!def.required) {
    lines.push(`| Default | _(unset → feature disabled or auto-detected)_ |`);
  }
  lines.push(`| Env var | \`${def.envName}\` |`);
  if (def.yamlPath) {
    lines.push(`| YAML path | \`${def.yamlPath}\` |`);
  } else {
    lines.push(`| YAML path | _(env-only — never written to config.yml)_ |`);
  }
  if (def.min !== undefined || def.max !== undefined) {
    const range =
      def.min !== undefined && def.max !== undefined
        ? `${def.min} – ${def.max}`
        : def.min !== undefined
          ? `≥ ${def.min}`
          : `≤ ${def.max}`;
    lines.push(`| Range | ${range} |`);
  }
  lines.push(`| UI editable | ${def.uiEditable ? 'yes' : 'no'} |`);
  lines.push(`| Restart required | ${def.requiresRestart ? 'yes' : 'no'} |`);
  lines.push(`| Since | v${def.introducedIn} |`);
  if (def.deprecatedIn) lines.push(`| Deprecated in | v${def.deprecatedIn} |`);
  if (def.renamedFrom && def.renamedFrom.length > 0) {
    lines.push(`| Renamed from | ${def.renamedFrom.map((n) => `\`${n}\``).join(', ')} |`);
  }
  if (def.examples && def.examples.length > 0) {
    lines.push('');
    lines.push('Examples:');
    lines.push('');
    lines.push('```');
    for (const ex of def.examples) lines.push(ex);
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

export function renderConfigMarkdown(): string {
  const groups = listGroups();
  const out: string[] = [];
  out.push('# Configuration reference');
  out.push('');
  out.push(
    '> **AUTO-GENERATED** from `apps/api/src/config/registry.ts`. Do not edit by hand — your changes will be overwritten. To add or change a key, edit the registry and run `yarn workspace @dgui/api docs:config`.',
  );
  out.push('');
  out.push(
    'docker-gui reads configuration from three layers, in increasing precedence: hard-coded defaults, `/etc/docker-gui/config.yml`, and environment variables. Runtime UI edits (when supported) sit on top.',
  );
  out.push('');
  out.push('## Table of contents');
  out.push('');
  for (const g of groups) {
    out.push(`- [${GROUP_TITLES[g]}](#${GROUP_TITLES[g].toLowerCase().replace(/\s+/g, '-')})`);
  }
  out.push('');
  for (const g of groups) {
    out.push(`## ${GROUP_TITLES[g]}`);
    out.push('');
    const keys = CONFIG_REGISTRY.filter((k) => k.group === g);
    for (const k of keys) out.push(renderKey(k));
  }
  // Final newline so editors don't whine.
  return out.join('\n') + '\n';
}
