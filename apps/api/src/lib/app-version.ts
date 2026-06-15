import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the panel version reported by `/health` and friends.
 *
 * `process.env.npm_package_version` is only populated when the process is
 * launched through a package-manager script (`yarn start`). The container runs
 * `node dist/index.js` directly, so that variable is empty there and the old
 * fallback made every deployed panel report a stale "0.1.0". Instead we read
 * the version straight off the `package.json` that ships beside the build,
 * walking up from the calling module until we find one. The manifest sits at
 * the app root in every layout — `apps/api/package.json` in dev (tsx running
 * `src/...`) and `/app/package.json` in the image (`node dist/...`).
 */
export function readAppVersion(
  startDir: string = dirname(fileURLToPath(import.meta.url))
): string {
  let dir = startDir;
  // Climb a bounded number of levels so a missing manifest can't loop forever.
  for (let i = 0; i < 8; i += 1) {
    const version = tryReadVersion(join(dir, 'package.json'));
    if (version) return version;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  const fromEnv = process.env['npm_package_version'];
  return fromEnv && fromEnv.length > 0 ? fromEnv : '0.0.0';
}

function tryReadVersion(pkgPath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.length > 0
      ? parsed.version
      : null;
  } catch {
    return null; // not here / unreadable / malformed — keep climbing
  }
}
