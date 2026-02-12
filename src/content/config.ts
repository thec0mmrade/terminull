import { defineCollection, z } from 'astro:content';

const issues = defineCollection({
  type: 'content',
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
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { issues, pages };
