import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { ansiMeta, unsupportedReason } from './lib/ansi-art.js';
import { volumesDir } from './lib/paths.js';


/**
 * Loads a volume's articles: markdown files, plus ANSI art. Dropping a
 * `{order}-{slug}.ans` file into a vol{N}/ directory publishes it as an
 * article whose title, artist and date come from the file's SAUCE record.
 * Only vol{N}/ directories of the volumes dir (TERMINULL_VOLUMES_DIR) are published.
 */
function issuesLoader(): Loader {
  const markdown = glob({ pattern: 'vol*/*.{md,mdx}', base: volumesDir() });
  let artIds = new Set<string>();

  return {
    name: 'terminull-issues',
    async load(ctx) {
      await markdown.load(ctx);

      const root = fileURLToPath(ctx.config.root);
      const base = volumesDir();

      const syncArt = async () => {
        const seen = new Set<string>();
        const volumes = fs.existsSync(base)
          ? fs.readdirSync(base).filter(d => /^vol\d+$/.test(d))
          : [];
        for (const vol of volumes) {
          for (const file of fs.readdirSync(path.join(base, vol))) {
            if (!/\.ans$/i.test(file)) continue;
            const abs = path.join(base, vol, file);
            const bytes = new Uint8Array(fs.readFileSync(abs));
            const reason = unsupportedReason(bytes);
            if (reason) {
              ctx.logger.warn(`Skipping ANSI art ${vol}/${file}: ${reason}.`);
              continue;
            }
            const meta = ansiMeta(file, bytes);
            const id = `${vol}/${meta.slug}`;
            const filePath = path.relative(root, abs).split(path.sep).join('/');
            const data = await ctx.parseData({
              id,
              filePath,
              data: {
                title: meta.title,
                author: meta.author,
                group: meta.group || undefined,
                date: meta.date ? new Date(`${meta.date}T00:00:00Z`) : undefined,
                volume: Number(vol.slice(3)),
                order: meta.order,
                category: 'ascii-art',
                tags: ['ansi'],
                description: meta.description,
                ansi: file,
              },
            });
            ctx.store.set({
              id,
              data,
              filePath,
              digest: ctx.generateDigest(Buffer.from(bytes).toString('base64')),
            });
            seen.add(id);
          }
        }
        for (const id of artIds) if (!seen.has(id)) ctx.store.delete(id);
        artIds = seen;
      };

      await syncArt();

      // Dev server: pick up art files as they are added, changed or removed.
      const onFsEvent = (file: string) => {
        if (/\.ans$/i.test(file) && path.resolve(file).startsWith(base + path.sep)) void syncArt();
      };
      ctx.watcher?.on('add', onFsEvent);
      ctx.watcher?.on('change', onFsEvent);
      ctx.watcher?.on('unlink', onFsEvent);
    },
  };
}

const issues = defineCollection({
  loader: issuesLoader(),
  schema: z
    .object({
      title: z.string(),
      author: z.string(),
      handle: z.string().optional(),
      // Required for written articles. ANSI art takes it from the file's
      // SAUCE record, which may not carry one.
      date: z.date().optional(),
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
      // Set by the loader for ANSI art: the .ANS filename, next to which the
      // entry's filePath points. Not meant to be written by hand.
      ansi: z.string().optional(),
      group: z.string().optional(),
    })
    .refine(d => d.ansi !== undefined || d.date !== undefined, {
      message: 'date is required',
      path: ['date'],
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
