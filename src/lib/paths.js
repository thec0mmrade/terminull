// Shared path resolution (plain JS: used by the Astro build and the zine
// exporter). Resolved from this file's location, never process.cwd().
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Absolute path of the volumes directory (TERMINULL_VOLUMES_DIR, resolved against the repo root). */
export function volumesDir() {
  const env = process.env.TERMINULL_VOLUMES_DIR;
  return path.resolve(ROOT, env || 'src/content/volumes');
}
