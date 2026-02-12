import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildHeader,
  buildVolumeToc,
  buildFooter,
  textResponse,
} from '../../../lib/ansi-text';

export const getStaticPaths: GetStaticPaths = async () => {
  const allArticles = await getCollection('issues', ({ data }) => !data.draft);
  const volumes = [...new Set(allArticles.map(a => a.data.volume))];

  return volumes.map(vol => ({
    params: { volume: String(vol) },
    props: {
      volume: vol,
      articles: allArticles
        .filter(a => a.data.volume === vol)
        .map(a => ({
          slug: a.id.replace(/.*\//, '').replace(/\.mdx?$/, ''),
          data: a.data,
        })),
      latestVolume: Math.max(...allArticles.map(a => a.data.volume)),
    },
  }));
};

export function GET({ props }: { props: { volume: number; articles: any[]; latestVolume: number } }) {
  const { volume, articles, latestVolume } = props;

  const body = [
    buildHeader(latestVolume),
    buildVolumeToc(volume, articles),
    buildFooter(),
  ].join('\n');

  return textResponse(body);
}
