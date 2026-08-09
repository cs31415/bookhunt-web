import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repo root, one level above this server tree.
 *
 * Holds for both layouts: `server/lib/repo-root.ts` under tsx in dev, and
 * `dist-server/lib/repo-root.js` after a build.
 */
export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
