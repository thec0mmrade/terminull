// Deploy config (deploy.env) parser and validator for the publish script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteUrl } from '../../src/lib/site-url.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @typedef {{ siteUrl: string, host: string, user: string, sshPort: number,
 *   path: string, arch: 'amd64'|'arm64', bbsPort: number, keepReleases: number,
 *   volumesDir: string, env: Record<string,string> }} DeployConfig */

/**
 * Parse KEY=VALUE lines. `#` comments and blank lines are skipped; one pair of
 * matching single or double quotes around a value is removed. No expansion.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const out = {};
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!m) throw new Error(`deploy.env line ${i + 1}: expected KEY=VALUE`);
    let value = m[2].trim();
    const q = value[0];
    if (value.length >= 2 && (q === '"' || q === "'") && value.endsWith(q)) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  });
  return out;
}

/** @param {Record<string,string>} v @param {string} key */
function required(v, key) {
  if (!v[key]) throw new Error(`deploy.env: ${key} is required`);
  return v[key];
}

/** @param {Record<string,string>} v @param {string} key @param {number} def @param {number} min @param {number} max */
function intValue(v, key, def, min, max) {
  if (v[key] === undefined || v[key] === '') return def;
  if (!/^\d+$/.test(v[key])) throw new Error(`deploy.env: ${key} must be an integer`);
  const n = Number(v[key]);
  if (n < min || n > max) throw new Error(`deploy.env: ${key} must be between ${min} and ${max}`);
  return n;
}

/**
 * Load and validate the deploy config. A relative `file` resolves against the repo root.
 * @param {string} [file]
 * @returns {DeployConfig}
 */
export function loadDeployConfig(file = 'deploy.env') {
  const abs = path.resolve(ROOT, file);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') {
      throw new Error(`${file} not found: copy deploy.env.example to deploy.env and fill it in`);
    }
    throw err;
  }
  const v = parseEnvFile(text);

  const rawUrl = required(v, 'TERMINULL_SITE_URL');
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('deploy.env: TERMINULL_SITE_URL is not a valid URL');
  }
  const ok = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
  if (!ok) throw new Error('deploy.env: TERMINULL_SITE_URL must be https (http only for localhost)');

  const deployPath = v.DEPLOY_PATH || '/srv/terminull';
  if (!path.posix.isAbsolute(deployPath)) throw new Error('deploy.env: DEPLOY_PATH must be an absolute path');

  const arch = v.DEPLOY_ARCH || 'amd64';
  if (arch !== 'amd64' && arch !== 'arm64') throw new Error('deploy.env: DEPLOY_ARCH must be amd64 or arm64');

  return {
    siteUrl: siteUrl({ TERMINULL_SITE_URL: rawUrl }),
    host: required(v, 'DEPLOY_HOST'),
    user: required(v, 'DEPLOY_USER'),
    sshPort: intValue(v, 'DEPLOY_SSH_PORT', 22, 1, 65535),
    path: deployPath,
    arch,
    bbsPort: intValue(v, 'BBS_PORT', 22, 1, 65535),
    keepReleases: intValue(v, 'KEEP_RELEASES', 5, 2, Number.MAX_SAFE_INTEGER),
    volumesDir: path.resolve(ROOT, v.TERMINULL_VOLUMES_DIR || 'src/content/volumes'),
    env: v,
  };
}
