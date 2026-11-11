import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const issues = defineCollection({
  // Only vol{N}/ directories are published; _templates/ is excluded.
  loader: glob({ pattern: 'vol*/*.{md,mdx}', base: './src/content/issues' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    handle: z.string().optional(),
    date: z.date(),
    volume: z.number(),
    order: z.number(),
    category: z.enum([
      'editorial', 'ascii-art', 'security-news', 'guide',
      'writeup', 'tool', 'fiction', 'interview'
    ]),
    tags: z.array(z.string()).default([]),
    description: z.string(),
    ascii_header: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { issues, pages };
