// The homepage's main menu and message of the day, shared by the web page
// (src/pages/index.astro) and its .txt twin (src/pages/index.txt.ts).
// The SSH BBS shows the same menu and message: ssh/ui/screens/home.go
// (menu) and ssh/ui/components/chrome.go (RenderMOTD). Change them together.

/**
 * @typedef {{ label: string, description: string, href: string, txt?: string }} MenuItem
 * `href` is the web link; `txt` the matching .txt path, if there is one.
 */

/**
 * "Volume 01, 12 articles".
 * @param {number} volume @param {number} articles
 */
export function volumeSummary(volume, articles) {
  return `Volume ${String(volume).padStart(2, '0')}, ${articles} article${articles === 1 ? '' : 's'}`;
}

/**
 * Main menu, numbered from [00] in order. "Latest Volume" is left out when
 * nothing is published yet.
 * @param {{ number: number, articles: number } | null} latest newest published volume
 * @returns {MenuItem[]}
 */
export function mainMenu(latest) {
  /** @type {MenuItem[]} */
  const items = [];
  if (latest) {
    items.push({
      label: 'Latest Volume',
      description: volumeSummary(latest.number, latest.articles),
      href: `/vol/${latest.number}`,
      txt: `/vol/${latest.number}/index.txt`,
    });
  }
  items.push(
    { label: 'Archive', description: 'All volumes', href: '/vol' },
    { label: 'About', description: 'What is terminull?', href: '/about', txt: '/about.txt' },
    { label: 'Manifesto', description: 'What we believe', href: '/manifesto', txt: '/manifesto.txt' },
    { label: 'Help', description: 'Commands & navigation', href: '/help' },
  );
  return items;
}

/** Heading of the message of the day. */
export const MOTD_TITLE = 'MESSAGE OF THE DAY';

/** The message itself; each medium highlights "terminull" and adds its own how-to-navigate hint. */
export const MOTD_TEXT =
  'Welcome to terminull. This is a space for hackers, researchers, artists, ' +
  'and anyone who believes knowledge should be free.';

/**
 * The newest published volume and its article count, or null.
 * @param {{ data: { volume: number } }[]} articles published articles
 * @returns {{ number: number, articles: number } | null}
 */
export function latestVolume(articles) {
  if (articles.length === 0) return null;
  const number = Math.max(...articles.map((a) => a.data.volume));
  return { number, articles: articles.filter((a) => a.data.volume === number).length };
}
