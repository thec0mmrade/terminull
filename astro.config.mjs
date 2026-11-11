// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { siteUrl } from './src/lib/site-url.js';
import { rehypeTerminalCode } from './src/plugins/rehype-terminal-code.ts';
import { remarkBbsAdmonitions } from './src/plugins/remark-bbs-admonitions.ts';

/** @type {import('astro').ShikiConfig} */
const shikiConfig = {
  theme: {
    name: 'terminull',
    type: 'dark',
    settings: [
      { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#5fd7ff' } },
      { scope: ['string', 'string.quoted'], settings: { foreground: '#afd700' } },
      { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#ffd700' } },
      { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#ff5fd7' } },
      { scope: ['entity.name.type', 'support.type'], settings: { foreground: '#ffd700' } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#4a4a4a', fontStyle: 'italic' } },
      { scope: ['variable', 'variable.other'], settings: { foreground: '#d0d0d0' } },
      { scope: ['constant.other', 'variable.other.constant'], settings: { foreground: '#ff5f5f' } },
      { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#808080' } },
      { scope: ['entity.name.tag'], settings: { foreground: '#ff5fd7' } },
      { scope: ['entity.other.attribute-name'], settings: { foreground: '#afd700' } },
      { scope: ['support.class', 'entity.name.class'], settings: { foreground: '#ffd700' } },
      { scope: ['meta.decorator', 'punctuation.decorator'], settings: { foreground: '#ff5fd7' } },
      { scope: ['variable.parameter'], settings: { foreground: '#d7ff5f' } },
      { scope: ['markup.heading'], settings: { foreground: '#ffd700', fontStyle: 'bold' } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.inline.raw'], settings: { foreground: '#ff5fd7' } },
    ],
    colors: {
      'editor.background': '#111111',
      'editor.foreground': '#d0d0d0',
    },
  },
};

export default defineConfig({
  site: siteUrl(),
  integrations: [mdx()],
  // Astro 7 defaults to JSX-style whitespace stripping; the ASCII art and
  // box frames rely on HTML whitespace rules.
  compressHTML: true,
  markdown: {
    // Astro 7 defaults to the Sätteri processor. Stay on unified so the
    // remark/rehype plugins below keep working.
    processor: unified({
      remarkPlugins: [remarkBbsAdmonitions],
      rehypePlugins: [rehypeTerminalCode],
    }),
    shikiConfig,
  },
});
