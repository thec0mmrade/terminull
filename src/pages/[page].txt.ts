import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildHeader,
  buildFooter,
  renderMarkdownToAnsi,
  textResponse,
  C,
} from '../lib/ansi-text';

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await getCollection('pages');
  const articles = await getCollection('issues', ({ data }) => !data.draft);
  const latestVolume = articles.length > 0
    ? Math.max(...articles.map(a => a.data.volume))
    : 0;

  return pages.map(page => ({
    params: { page: page.id.replace(/\.mdx?$/, '') },
    props: { page, latestVolume },
  }));
};

export function GET({ props }: { props: { page: any; latestVolume: number } }) {
  const { page, latestVolume } = props;

  const content = renderMarkdownToAnsi(page.body ?? '');

  const body = [
    buildHeader(latestVolume),
    `${C.gold}${C.bold}${page.data.title.toUpperCase()}${C.reset}`,
    '',
    content,
    buildFooter(),
  ].join('\n');

  return textResponse(body);
}
