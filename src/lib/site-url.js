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
