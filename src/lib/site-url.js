// Single source of the public site URL (plain JS: used by astro.config.mjs,
// Astro pages/endpoints and the zine exporter).

/**
 * Public site URL: TERMINULL_SITE_URL without trailing slashes.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function siteUrl(env = process.env) {
  const raw = env.TERMINULL_SITE_URL;
  return (raw || 'https://terminull.local').replace(/\/+$/, '');
}

/**
 * Host of the public site URL (with a port if it has one), shown as the BBS
 * "node" name, e.g. "Connecting to terminull.example.com...". Falls back to
 * "terminull.local" if the URL can't be parsed.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function siteHost(env = process.env) {
  try {
    return new URL(siteUrl(env)).host || 'terminull.local';
  } catch {
    return 'terminull.local';
  }
}
