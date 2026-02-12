import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildHeader,
  buildArticleHeader,
  buildArticleNav,
  buildFooter,
  renderMarkdownToAnsi,
  textResponse,
} from '../../../lib/ansi-text';

export const getStaticPaths: GetStaticPaths = async () => {
  const allArticles = await getCollection('issues', ({ data }) => !data.draft);
  const latestVolume = allArticles.length > 0
    ? Math.max(...allArticles.map(a => a.data.volume))
    : 0;

  return allArticles.map(article => {
    const slug = article.id.replace(/.*\//, '').replace(/\.mdx?$/, '');
    const volume = article.data.volume;
    const order = article.data.order;

    // Find prev/next in same volume
    const sameVolume = allArticles
      .filter(a => a.data.volume === volume)
      .sort((a, b) => a.data.order - b.data.order);

    const currentIdx = sameVolume.findIndex(a => a.data.order === order);
    const prev = currentIdx > 0 ? sameVolume[currentIdx - 1] : null;
    const next = currentIdx < sameVolume.length - 1 ? sameVolume[currentIdx + 1] : null;

    return {
      params: { volume: String(volume), slug },
      props: {
        article,
        latestVolume,
        prevSlug: prev ? prev.id.replace(/.*\//, '').replace(/\.mdx?$/, '') : undefined,
        prevTitle: prev?.data.title,
        nextSlug: next ? next.id.replace(/.*\//, '').replace(/\.mdx?$/, '') : undefined,
        nextTitle: next?.data.title,
      },
    };
  });
};

export function GET({ props }: { props: any }) {
  const { article, latestVolume, prevSlug, prevTitle, nextSlug, nextTitle } = props;
  const { data } = article;

  const content = renderMarkdownToAnsi(article.body ?? '');

  const body = [
    buildHeader(latestVolume),
    buildArticleHeader({
      title: data.title,
      order: data.order,
      category: data.category,
      date: data.date,
      author: data.author,
      handle: data.handle,
      tags: data.tags,
      volume: data.volume,
    }),
    '',
    content,
    buildArticleNav({
      volume: data.volume,
      prevSlug,
      prevTitle,
      nextSlug,
      nextTitle,
    }),
    buildFooter(),
  ].join('\n');

  return textResponse(body);
}
