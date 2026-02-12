import { getCollection } from 'astro:content';

export interface SearchEntry {
  title: string;
  slug: string;
  volume: number;
  order: number;
  category: string;
  description: string;
  tags: string[];
  author: string;
  handle?: string;
}

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const articles = await getCollection('issues', ({ data }) => !data.draft);

  return articles.map((article) => ({
    title: article.data.title,
    slug: article.id.replace(/.*\//, '').replace(/\.mdx?$/, ''),
    volume: article.data.volume,
    order: article.data.order,
    category: article.data.category,
    description: article.data.description,
    tags: article.data.tags,
    author: article.data.author,
    handle: article.data.handle,
  }));
}
