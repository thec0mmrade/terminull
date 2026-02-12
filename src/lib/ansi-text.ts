import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// ANSI escape helpers
// ---------------------------------------------------------------------------

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const ITALIC = `${ESC}3m`;

/** xterm-256 foreground: \x1b[38;5;{n}m */
function fg(n: number): string {
  return `${ESC}38;5;${n}m`;
}

// ---------------------------------------------------------------------------
// terminull color palette → xterm-256 codes
// ---------------------------------------------------------------------------

export const C = {
  green: fg(148),       // #afd700
  greenBright: fg(191), // #d7ff5f
  greenDim: fg(100),    // #5f8700
  gold: fg(220),        // #ffd700
  goldDim: fg(136),     // #af8700
  cyan: fg(81),         // #5fd7ff
  cyanDim: fg(67),      // #5f87af
  pink: fg(206),        // #ff5fd7
  pinkDim: fg(132),     // #af5f87
  red: fg(203),         // #ff5f5f
  text: fg(252),        // #d0d0d0
  muted: fg(239),       // ~#4a4a4a
  secondary: fg(244),   // ~#808080
  border: fg(236),      // ~#333333
  borderBright: fg(240),// ~#555555
  reset: RESET,
  bold: BOLD,
  dim: DIM,
  italic: ITALIC,
} as const;

// ---------------------------------------------------------------------------
// Markdown → ANSI rendering
// ---------------------------------------------------------------------------

const WIDTH = 78;

/**
 * Pre-process admonitions: convert `> [!TYPE] text` into styled blockquote text
 * since we bypass Astro's remark plugin pipeline.
 */
function preprocessAdmonitions(md: string): string {
  return md.replace(
    /^(>\s*)\[!(WARN|HACK|INFO)\]\s*(.*)/gm,
    (_match, prefix, type, rest) => {
      const label = type as string;
      return `${prefix}**[!] ${label}:** ${rest}`;
    },
  );
}

/** Wrap text with ANSI codes (chalk-style function) */
function wrap(open: string, close: string = RESET): (text: string) => string {
  return (text: string) => `${open}${text}${close}`;
}

export function renderMarkdownToAnsi(markdown: string): string {
  const processed = preprocessAdmonitions(markdown);

  const marked = new Marked();
  marked.use(
    markedTerminal({
      // Headings (already functions)
      firstHeading: (text: string) =>
        `\n${C.gold}${BOLD}${'━'.repeat(WIDTH)}${RESET}\n` +
        `${C.gold}${BOLD}  ${text}${RESET}\n` +
        `${C.gold}${BOLD}${'━'.repeat(WIDTH)}${RESET}\n`,
      heading: (text: string) =>
        `\n${C.cyan}${BOLD}## ${text}${RESET}\n`,

      // Inline styles (must be functions)
      strong: wrap(BOLD),
      em: wrap(`${C.pink}${ITALIC}`),
      codespan: wrap(C.pink),
      code: wrap(C.green),
      blockquote: wrap(`${C.greenDim}${ITALIC}`),
      link: wrap(C.cyan),
      href: wrap(C.cyanDim),
      listitem: wrap(C.text),
      paragraph: wrap(''),
      table: wrap(''),
      html: wrap(C.muted),
      del: wrap(`${DIM}${C.secondary}`),
      hr: wrap(C.borderBright),

      // Layout
      width: WIDTH,
      reflowText: true,
      showSectionPrefix: false,
      tab: 2,
      emoji: false,

      // Tables
      tableOptions: {
        chars: {
          top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
          bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
          left: '│', 'left-mid': '├',
          mid: '─', 'mid-mid': '┼',
          right: '│', 'right-mid': '┤',
          middle: '│',
        },
        style: {
          head: [], border: [],
        },
      },
    }),
  );

  return marked.parse(processed) as string;
}

// ---------------------------------------------------------------------------
// BBS chrome builders
// ---------------------------------------------------------------------------

const HR = `${C.borderBright}${'─'.repeat(WIDTH)}${C.reset}`;

export function buildConnectionSequence(): string {
  return [
    `${C.greenDim}Connecting to terminull.local...${C.reset}`,
    `${C.greenDim}SSH-2.0 | xterm-256color | UTF-8${C.reset}`,
    `${C.green}Connection established.${C.reset}`,
    '',
  ].join('\n');
}

export function buildLogo(): string {
  const logoPath = path.join(process.cwd(), 'public', 'art', 'logo.txt');
  const logo = fs.readFileSync(logoPath, 'utf-8').trimEnd();
  return `${C.green}${logo}${C.reset}`;
}

export function buildHeader(latestVolume: number): string {
  const tagBase = 'h a c k e r   e - z i n e';
  const tagline = latestVolume > 0
    ? `[ ${tagBase}   / /   v o l . ${latestVolume} ]`
    : `[ ${tagBase} ]`;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const sysInfo = [
    `Connected: ${dateStr}  |  User: guest  |  Node: terminull.local`,
    `Protocol: SSH-2.0  |  Term: xterm-256color  |  Charset: UTF-8`,
  ];

  return [
    buildConnectionSequence(),
    buildLogo(),
    `${C.green}${' '.repeat(Math.max(0, Math.floor((WIDTH - tagline.length) / 2)))}${tagline}${C.reset}`,
    '',
    buildBoxFrame('SYSTEM INFO', sysInfo),
    '',
  ].join('\n');
}

export function buildBoxFrame(title: string, lines: string[]): string {
  const innerWidth = WIDTH - 2; // account for │ on each side

  // Top border
  let top: string;
  if (title) {
    const titleStr = `[ ${title} ]`;
    const remaining = innerWidth - 1 - titleStr.length; // -1 for ─ after ┌
    top = `${C.borderBright}┌─${C.cyan}${titleStr}${C.borderBright}${'─'.repeat(Math.max(0, remaining))}┐${C.reset}`;
  } else {
    top = `${C.borderBright}┌${'─'.repeat(innerWidth)}┐${C.reset}`;
  }

  // Content lines
  const contentLines = lines.map(line => {
    const padding = Math.max(0, innerWidth - stripAnsi(line).length);
    return `${C.borderBright}│${C.reset} ${C.secondary}${line}${' '.repeat(Math.max(0, padding - 1))}${C.borderBright}│${C.reset}`;
  });

  // Bottom border
  const bottom = `${C.borderBright}└${'─'.repeat(innerWidth)}┘${C.reset}`;

  return [top, ...contentLines, bottom].join('\n');
}

export function buildArticleHeader(meta: {
  title: string;
  order: number;
  category: string;
  date: Date;
  author: string;
  handle?: string;
  tags: string[];
  volume: number;
}): string {
  const dateStr = meta.date instanceof Date
    ? meta.date.toISOString().split('T')[0]
    : String(meta.date);
  const authorStr = meta.handle ? `${meta.author} (@${meta.handle})` : meta.author;
  const tagStr = meta.tags.length > 0 ? meta.tags.join(', ') : 'none';

  const lines = [
    `Article #${String(meta.order).padStart(2, '0')}  |  ${meta.category.toUpperCase()}  |  ${dateStr}`,
    `Author: ${authorStr}`,
    `Tags: ${tagStr}`,
  ];

  return buildBoxFrame(`VOL ${meta.volume} // ${meta.title}`, lines);
}

export function buildArticleNav(opts: {
  volume: number;
  prevSlug?: string;
  prevTitle?: string;
  nextSlug?: string;
  nextTitle?: string;
}): string {
  const lines: string[] = [HR, ''];

  if (opts.prevSlug) {
    lines.push(`${C.muted}  [prev] ${C.cyan}${opts.prevTitle}${C.reset}`);
    lines.push(`${C.muted}         curl ${C.cyanDim}HOST/vol/${opts.volume}/${opts.prevSlug}.txt${C.reset}`);
  }
  if (opts.nextSlug) {
    lines.push(`${C.muted}  [next] ${C.cyan}${opts.nextTitle}${C.reset}`);
    lines.push(`${C.muted}         curl ${C.cyanDim}HOST/vol/${opts.volume}/${opts.nextSlug}.txt${C.reset}`);
  }
  if (!opts.prevSlug && !opts.nextSlug) {
    lines.push(`${C.muted}  No adjacent articles in this volume.${C.reset}`);
  }

  lines.push('');
  lines.push(`${C.muted}  [toc]  curl ${C.cyanDim}HOST/vol/${opts.volume}/index.txt${C.reset}`);
  lines.push(`${C.muted}  [home] curl ${C.cyanDim}HOST/index.txt${C.reset}`);
  lines.push('');

  return lines.join('\n');
}

export function buildFooter(): string {
  return [
    HR,
    `${C.muted}terminull v1.0 // no tracking // no ads // just text${C.reset}`,
    `${C.muted}https://terminull.local${C.reset}`,
    '',
  ].join('\n');
}

export function buildMenu(title: string, items: { label: string; description: string; hint?: string }[]): string {
  const lines: string[] = [];
  lines.push(`${C.gold}${BOLD}${title}${C.reset}`);
  lines.push(HR);
  lines.push('');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = `${C.green}${BOLD}  [${i + 1}]${C.reset}`;
    const label = `${C.text}${item.label}${C.reset}`;
    const desc = `${C.secondary}${item.description}${C.reset}`;
    const hint = item.hint ? `  ${C.muted}${item.hint}${C.reset}` : '';
    lines.push(`${num} ${label} ${C.muted}─${C.reset} ${desc}${hint}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function buildVolumeToc(
  volume: number,
  articles: { slug: string; data: { title: string; order: number; author: string; category: string } }[],
): string {
  const sorted = [...articles].sort((a, b) => a.data.order - b.data.order);

  const lines: string[] = [];
  lines.push(`${C.gold}${BOLD}VOLUME ${volume} -- TABLE OF CONTENTS${C.reset}`);
  lines.push(HR);
  lines.push('');

  // Header row
  lines.push(
    `${C.muted}  ${'#'.padEnd(4)}${'TITLE'.padEnd(38)}${'AUTHOR'.padEnd(20)}${'CATEGORY'}${C.reset}`,
  );
  lines.push(`${C.muted}  ${'─'.repeat(4)}${'─'.repeat(38)}${'─'.repeat(20)}${'─'.repeat(14)}${C.reset}`);

  for (const article of sorted) {
    const num = `${C.green}${String(article.data.order).padStart(2, '0')}${C.reset}`;
    const title = `${C.text}${truncate(article.data.title, 36).padEnd(38)}${C.reset}`;
    const author = `${C.secondary}${truncate(article.data.author, 18).padEnd(20)}${C.reset}`;
    const cat = `${C.cyanDim}${article.data.category}${C.reset}`;
    lines.push(`  ${num}  ${title}${author}${cat}`);
  }

  lines.push('');
  lines.push(`${C.muted}  Read an article:  curl HOST/vol/${volume}/SLUG.txt | less -R${C.reset}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/** Create a plain-text Response with correct content type */
export function textResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
