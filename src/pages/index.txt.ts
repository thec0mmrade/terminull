import { getCollection } from 'astro:content';
import {
  buildHeader,
  buildMenu,
  buildFooter,
  textResponse,
  C,
} from '../lib/ansi-text';
import { siteUrl } from '../lib/site-url.js';
import { mainMenu, latestVolume, MOTD_TITLE, MOTD_TEXT } from '../lib/home.js';

// Same menu and message as the web homepage (src/lib/home.js); items with a
// .txt version show the curl command for it.
export async function GET() {
  const published = await getCollection('issues', ({ data }) => !data.draft);
  const latest = latestVolume(published);
  const site = siteUrl();

  const menuItems = mainMenu(latest).map(({ label, description, txt }) => ({
    label,
    description,
    hint: txt ? `curl ${site}${txt}` : undefined,
  }));

  const body = [
    buildHeader(latest ? latest.number : 0),
    buildMenu('MAIN MENU', menuItems),
    `${C.gold}[${MOTD_TITLE}]${C.reset}`,
    '',
    ...wrap(MOTD_TEXT, 64).map((line) =>
      `${C.secondary}${line.replace('terminull', `${C.green}terminull${C.secondary}`)}${C.reset}`),
    '',
    buildFooter(site),
  ].join('\n');

  return textResponse(body);
}

/** Greedy word wrap to at most `width` columns. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
