import { getCollection } from 'astro:content';
import {
  buildHeader,
  buildMenu,
  buildFooter,
  textResponse,
  C,
} from '../lib/ansi-text';

export async function GET() {
  const articles = await getCollection('issues', ({ data }) => !data.draft);
  const latestVolume = articles.length > 0
    ? Math.max(...articles.map(a => a.data.volume))
    : 0;

  const menuItems = [
    { label: 'Archive', description: 'All volumes', hint: 'curl HOST/vol/1/index.txt' },
    { label: 'About', description: 'What is terminull?' },
    { label: 'Manifesto', description: 'What we believe' },
    { label: 'Help', description: 'Commands & navigation' },
  ];

  const body = [
    buildHeader(latestVolume),
    buildMenu('MAIN MENU', menuItems),
    `${C.gold}[MESSAGE OF THE DAY]${C.reset}`,
    '',
    `${C.secondary}Welcome to ${C.green}terminull${C.secondary}. This is a space for hackers,${C.reset}`,
    `${C.secondary}researchers, artists, and anyone who believes knowledge${C.reset}`,
    `${C.secondary}should be free.${C.reset}`,
    '',
    buildFooter(),
  ].join('\n');

  return textResponse(body);
}
