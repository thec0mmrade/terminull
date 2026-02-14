#!/usr/bin/env node

/**
 * export-zine.js — Export a terminull volume as a printable half-letter PDF.
 *
 * Usage:
 *   npm run zine                  # exports highest volume found
 *   npm run zine -- --volume 1    # exports volume 1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let volume = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--volume' && args[i + 1]) {
      volume = parseInt(args[i + 1], 10);
      if (isNaN(volume)) {
        console.error('Error: --volume must be a number');
        process.exit(1);
      }
    }
  }
  return { volume };
}

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const yamlBlock = match[1];
  const body = match[2];
  const data = {};

  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    let val = rawVal.trim();

    // Array: [item1, item2]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Boolean
    else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    // Number
    else if (/^\d+$/.test(val)) val = parseInt(val, 10);
    // Quoted string
    else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    data[key] = val;
  }

  return { data, body };
}

function loadArticles(volumeNum) {
  const dir = path.join(ROOT, 'src', 'content', 'issues', `vol${volumeNum}`);
  if (!fs.existsSync(dir)) {
    console.error(`Error: Volume directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  const articles = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;
    if (parsed.data.draft === true) continue;

    articles.push({
      slug: file.replace(/\.mdx?$/, ''),
      data: parsed.data,
      body: parsed.body,
    });
  }

  articles.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  return articles;
}

function findHighestVolume() {
  const issuesDir = path.join(ROOT, 'src', 'content', 'issues');
  if (!fs.existsSync(issuesDir)) {
    console.error('Error: No issues directory found');
    process.exit(1);
  }
  const vols = fs.readdirSync(issuesDir)
    .filter(d => /^vol\d+$/.test(d))
    .map(d => parseInt(d.replace('vol', ''), 10))
    .sort((a, b) => b - a);

  if (vols.length === 0) {
    console.error('Error: No volumes found');
    process.exit(1);
  }
  return vols[0];
}

// ---------------------------------------------------------------------------
// Markdown preprocessing
// ---------------------------------------------------------------------------

function preprocessMarkdown(md) {
  let result = md;

  // Admonitions: > [!TYPE] text → HTML admonition blocks
  result = result.replace(
    /^(>\s*)\[!(WARN|HACK|INFO)\]\s*([\s\S]*?)(?=\n(?!>)|$)/gm,
    (_match, _prefix, type, rest) => {
      const cleanRest = rest.replace(/^>\s*/gm, '').trim();
      return `<div class="admonition admonition-${type.toLowerCase()}"><strong>[${type}]</strong> ${cleanRest}</div>\n`;
    }
  );

  // Video/audio HTML embeds → placeholder
  result = result.replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '<div class="image-placeholder">[VIDEO]</div>');
  result = result.replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, '<div class="image-placeholder">[AUDIO]</div>');

  return result;
}

// ---------------------------------------------------------------------------
// Markdown → HTML with link footnotes
// ---------------------------------------------------------------------------

function renderArticleHtml(markdown) {
  const links = [];
  let linkCounter = 0;

  const marked = new Marked();

  const renderer = {
    link({ href, text }) {
      linkCounter++;
      links.push({ num: linkCounter, url: href });
      return `${text}<sup class="fn-ref">[${linkCounter}]</sup>`;
    },
    code({ text, lang }) {
      const escaped = escapeHtml(text);
      const langLabel = lang ? `<div class="code-lang">${escapeHtml(lang)}</div>` : '';
      return `<div class="code-block">${langLabel}<pre><code>${escaped}</code></pre></div>`;
    },
    codespan({ text }) {
      return `<code class="inline-code">${escapeHtml(text)}</code>`;
    },
    image({ href, text }) {
      const alt = text ? escapeHtml(text) : '';
      return `<figure class="article-image"><img src="${escapeHtml(href)}" alt="${alt}"><figcaption>${alt}</figcaption></figure>`;
    },
  };

  marked.use({ renderer });

  const html = marked.parse(markdown);
  return { html, links };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Font embedding
// ---------------------------------------------------------------------------

function loadFontBase64(filename) {
  const fontPath = path.join(ROOT, 'public', 'fonts', filename);
  if (!fs.existsSync(fontPath)) return null;
  return fs.readFileSync(fontPath).toString('base64');
}

// ---------------------------------------------------------------------------
// HTML document assembly
// ---------------------------------------------------------------------------

function buildDocument(articles, volumeNum) {
  const regularFont = loadFontBase64('IBMPlexMono-Regular.woff2');
  const boldFont = loadFontBase64('IBMPlexMono-Bold.woff2');

  const css = buildCSS(regularFont, boldFont);
  const coverHtml = buildCover(articles, volumeNum);
  const tocHtml = buildTOC(articles, volumeNum);
  const articlesHtml = articles.map((article, idx) =>
    buildArticlePage(article, idx, articles.length)
  ).join('');
  const backCoverHtml = buildBackCover(volumeNum);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
${coverHtml}
${tocHtml}
${articlesHtml}
${backCoverHtml}
</body>
</html>`;
}

function buildCSS(regularFontB64, boldFontB64) {
  const fontFaces = [];
  if (regularFontB64) {
    fontFaces.push(`
      @font-face {
        font-family: 'IBM Plex Mono';
        src: url(data:font/woff2;base64,${regularFontB64}) format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    `);
  }
  if (boldFontB64) {
    fontFaces.push(`
      @font-face {
        font-family: 'IBM Plex Mono';
        src: url(data:font/woff2;base64,${boldFontB64}) format('woff2');
        font-weight: 700;
        font-style: normal;
      }
    `);
  }

  return `
    ${fontFaces.join('\n')}

    @page {
      size: 5.5in 8.5in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 9pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }

    .page {
      page-break-after: always;
      padding: 0.5in 0.5in 0.6in 0.5in;
      position: relative;
      min-height: 7.3in;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* --- COVER --- */

    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 7.3in;
    }

    .cover-logo {
      font-size: 5.5pt;
      line-height: 1.1;
      white-space: pre;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 0.3in;
      display: inline-block;
      text-align: left;
    }

    .cover-divider {
      font-size: 9pt;
      letter-spacing: 2px;
      margin: 0.15in 0;
    }

    .cover-volume {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin: 0.2in 0;
    }

    .cover-meta {
      font-size: 8pt;
      margin: 0.1in 0;
      color: #333;
    }

    .cover-tagline {
      font-size: 8pt;
      font-style: italic;
      margin-top: 0.25in;
      color: #333;
    }

    /* --- TOC --- */

    .toc-header {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #000;
      padding: 0.15in 0.25in;
      margin-bottom: 0.3in;
      text-align: center;
    }

    .toc-entry {
      display: flex;
      align-items: baseline;
      font-size: 8.5pt;
      line-height: 1.8;
      border-bottom: 1px dotted #ccc;
      padding: 2px 0;
    }

    .toc-num {
      font-weight: 700;
      min-width: 2em;
      flex-shrink: 0;
    }

    .toc-title {
      font-weight: 700;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .toc-author {
      font-size: 7.5pt;
      color: #444;
      flex-shrink: 0;
      margin-left: 0.5em;
      white-space: nowrap;
    }

    .toc-category {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 1px solid #000;
      padding: 0 4px;
      margin-left: 0.5em;
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* --- ARTICLE --- */

    .article-corner {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: right;
      color: #555;
      margin-bottom: 0.15in;
    }

    .article-title {
      font-size: 16pt;
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1.2;
      padding-bottom: 0.1in;
      border-bottom: 3px double #000;
      margin-bottom: 0.15in;
    }

    .article-byline {
      font-size: 8pt;
      color: #333;
      margin-bottom: 0.05in;
    }

    .article-tags {
      font-size: 7pt;
      color: #555;
      margin-bottom: 0.15in;
    }

    .article-separator {
      border: none;
      border-top: 1px solid #000;
      margin: 0.15in 0;
    }

    .article-body h1 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 3px double #000;
      padding-bottom: 0.05in;
      margin: 0.25in 0 0.1in 0;
    }

    .article-body h2 {
      font-size: 12pt;
      font-weight: 700;
      text-decoration: underline;
      margin: 0.2in 0 0.08in 0;
    }

    .article-body h2::before {
      content: "## ";
      text-decoration: none;
      display: inline;
    }

    .article-body h3 {
      font-size: 10pt;
      font-weight: 700;
      margin: 0.15in 0 0.05in 0;
    }

    .article-body h3::before {
      content: "### ";
    }

    .article-body h4 {
      font-size: 9pt;
      font-weight: 700;
      margin: 0.12in 0 0.05in 0;
    }

    .article-body p {
      margin: 0.08in 0;
      text-align: justify;
    }

    .article-body strong {
      font-weight: 700;
    }

    .article-body em {
      font-style: italic;
    }

    .article-body .inline-code {
      font-size: 8pt;
      border: 1px solid #999;
      padding: 0 3px;
      background: #f5f5f5;
    }

    .article-body .code-block {
      margin: 0.1in 0;
      border: 1px solid #999;
      background: #f5f5f5;
      page-break-inside: avoid;
    }

    .article-body .code-lang {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 2px 6px;
      border-bottom: 1px solid #999;
      background: #e8e8e8;
    }

    .article-body pre {
      font-size: 7.5pt;
      line-height: 1.3;
      padding: 0.08in;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .article-body pre code {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
    }

    .article-body blockquote {
      border-left: 2pt solid #000;
      padding-left: 0.15in;
      margin: 0.1in 0;
      font-style: italic;
      color: #333;
    }

    .article-body .admonition {
      border: 1.5pt solid #000;
      padding: 0.08in 0.12in;
      margin: 0.1in 0;
      page-break-inside: avoid;
    }

    .article-body .admonition strong {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .article-body ul {
      list-style: none;
      padding-left: 0.2in;
      margin: 0.08in 0;
    }

    .article-body ul li {
      margin: 0.03in 0;
    }

    .article-body ul li::before {
      content: "* ";
      font-weight: 700;
    }

    .article-body ol {
      list-style: none;
      padding-left: 0.2in;
      margin: 0.08in 0;
      counter-reset: ol-counter;
    }

    .article-body ol li {
      counter-increment: ol-counter;
      margin: 0.03in 0;
    }

    .article-body ol li::before {
      content: counter(ol-counter) ". ";
      font-weight: 700;
    }

    .article-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin: 0.1in 0;
      table-layout: auto;
      overflow-wrap: break-word;
      page-break-inside: auto;
    }

    .article-body tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .article-body thead {
      display: table-header-group;
    }

    .article-body th {
      font-weight: 700;
      border: 1px solid #000;
      padding: 3px 5px;
      text-align: left;
      background: #e8e8e8;
    }

    .article-body td {
      border: 1px solid #000;
      padding: 3px 5px;
      text-align: left;
    }

    .article-body a {
      color: #000;
      text-decoration: none;
    }

    .article-body .fn-ref {
      font-size: 6pt;
      vertical-align: super;
      font-weight: 700;
    }

    .article-body hr {
      border: none;
      border-top: 1px solid #999;
      margin: 0.15in 0;
    }

    .image-placeholder {
      border: 1px dashed #999;
      padding: 0.08in;
      margin: 0.1in 0;
      text-align: center;
      font-size: 8pt;
      font-style: italic;
      color: #555;
    }

    .article-image {
      margin: 0.12in 0;
      text-align: center;
      page-break-inside: avoid;
    }

    .article-image img {
      max-width: 100%;
      height: auto;
      filter: grayscale(100%);
      border: 1px solid #999;
    }

    .article-image figcaption {
      font-size: 7pt;
      font-style: italic;
      color: #555;
      margin-top: 0.03in;
    }

    /* --- FOOTNOTES --- */

    .footnotes {
      margin-top: 0.2in;
      padding-top: 0.1in;
      border-top: 1px solid #999;
      font-size: 6.5pt;
      line-height: 1.4;
      color: #333;
    }

    .footnotes-header {
      font-weight: 700;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.05in;
    }

    .footnote-entry {
      margin: 1px 0;
      overflow-wrap: break-word;
      word-break: break-all;
    }

    /* --- BACK COVER --- */

    .back-cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 7.3in;
    }

    .back-cover-title {
      font-size: 24pt;
      font-weight: 700;
      letter-spacing: 6px;
      text-transform: lowercase;
      margin-bottom: 0.3in;
    }

    .back-cover-meta {
      font-size: 8pt;
      color: #333;
      margin: 0.05in 0;
    }

    .back-cover-url {
      font-size: 7pt;
      color: #555;
      margin-top: 0.3in;
    }
  `;
}

function buildCover(articles, volumeNum) {
  const logoPath = path.join(ROOT, 'public', 'art', 'logo.txt');
  let logo = '';
  if (fs.existsSync(logoPath)) {
    logo = fs.readFileSync(logoPath, 'utf-8').trimEnd();
  }

  const dateStr = articles[0]?.data.date || new Date().toISOString().split('T')[0];

  return `
  <div class="page cover">
    <div class="cover-logo">${escapeHtml(logo)}</div>
    <div class="cover-divider">${'═'.repeat(45)}</div>
    <div class="cover-volume">VOLUME ${volumeNum}</div>
    <div class="cover-meta">${dateStr} &mdash; ${articles.length} articles</div>
    <div class="cover-tagline">The hacker e-zine for the modern underground</div>
  </div>
  `;
}

function buildTOC(articles, volumeNum) {
  const entries = articles.map(article => {
    const num = String(article.data.order ?? 0).padStart(2, '0');
    const title = escapeHtml(article.data.title);
    const author = article.data.handle
      ? `${escapeHtml(article.data.author)} (@${escapeHtml(article.data.handle)})`
      : escapeHtml(article.data.author);
    const category = escapeHtml(article.data.category);

    return `
      <div class="toc-entry">
        <span class="toc-num">${num}.</span>
        <span class="toc-title">${title}</span>
        <span class="toc-author">${author}</span>
        <span class="toc-category">${category}</span>
      </div>
    `;
  }).join('');

  return `
  <div class="page">
    <div class="toc-header">Table of Contents &mdash; Volume ${volumeNum}</div>
    ${entries}
  </div>
  `;
}

function buildArticlePage(article, index, total) {
  const { data, body } = article;
  const processed = preprocessMarkdown(body);
  const { html, links } = renderArticleHtml(processed);

  const num = String(data.order ?? index).padStart(2, '0');
  const category = escapeHtml((data.category || '').toUpperCase());
  const title = escapeHtml(data.title);
  const dateStr = data.date || '';
  const author = data.handle
    ? `${escapeHtml(data.author)} (@${escapeHtml(data.handle)})`
    : escapeHtml(data.author);
  const tags = Array.isArray(data.tags) ? data.tags.map(t => escapeHtml(t)).join(', ') : '';

  let footnotesHtml = '';
  if (links.length > 0) {
    const entries = links.map(l =>
      `<div class="footnote-entry"><strong>[${l.num}]</strong> ${escapeHtml(l.url)}</div>`
    ).join('');
    footnotesHtml = `
      <div class="footnotes">
        <div class="footnotes-header">Links</div>
        ${entries}
      </div>
    `;
  }

  return `
  <div class="page">
    <div class="article-corner">#${num} &mdash; ${category}</div>
    <div class="article-title">${title}</div>
    <div class="article-byline">by ${author} &mdash; ${dateStr}</div>
    ${tags ? `<div class="article-tags">tags: ${tags}</div>` : ''}
    <hr class="article-separator">
    <div class="article-body">
      ${html}
    </div>
    ${footnotesHtml}
  </div>
  `;
}

function buildBackCover(volumeNum) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return `
  <div class="page back-cover">
    <div class="back-cover-title">terminull</div>
    <div class="back-cover-meta">Volume ${volumeNum} &mdash; ${dateStr}</div>
    <div class="back-cover-meta">no tracking // no ads // just text</div>
    <div class="back-cover-url">https://terminull.net</div>
  </div>
  `;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

async function generatePdf(html, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    width: '5.5in',
    height: '8.5in',
    margin: { top: '0.75in', bottom: '0.75in', left: '0.5in', right: '0.5in' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;font-family:\'IBM Plex Mono\',monospace;width:100%;text-align:center;color:#999;"><span class="pageNumber"></span></div>',
  });

  await browser.close();
}

// ---------------------------------------------------------------------------
// Booklet imposition (saddle-stitch)
// ---------------------------------------------------------------------------

/**
 * Rearrange portrait pages into 2-up landscape sheets for saddle-stitch
 * booklet printing. Each output page is 11"×8.5" (landscape letter) with
 * two 5.5"×8.5" half-pages side by side.
 *
 * Pages are pre-compensated for short-edge duplex binding:
 * print duplex with "flip on short edge" to get correct page order.
 */
async function imposeBooklet(portraitPdfPath, bookletPdfPath) {
  const srcBytes = fs.readFileSync(portraitPdfPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const srcPageCount = srcDoc.getPageCount();

  // Pad to multiple of 4
  const paddedCount = Math.ceil(srcPageCount / 4) * 4;

  const dstDoc = await PDFDocument.create();

  // Embed all source pages
  const srcPages = srcDoc.getPages();
  const embedded = await dstDoc.embedPages(srcPages);

  // Dimensions in points (1in = 72pt)
  const HALF_W = 5.5 * 72;  // 396pt — one zine page width
  const FULL_W = 11 * 72;   // 792pt — landscape letter width
  const PAGE_H = 8.5 * 72;  // 612pt — letter height

  const numSheets = paddedCount / 4;

  for (let i = 0; i < numSheets; i++) {
    // Saddle-stitch page indices (0-based)
    const frontLeft  = paddedCount - 1 - 2 * i;
    const frontRight = 2 * i;
    // Back is pre-compensated for short-edge flip (left/right swap after flip)
    const backLeft   = paddedCount - 2 - 2 * i;
    const backRight  = 2 * i + 1;

    // Front of sheet
    const front = dstDoc.addPage([FULL_W, PAGE_H]);
    if (frontLeft < embedded.length) {
      front.drawPage(embedded[frontLeft], { x: 0, y: 0 });
    }
    if (frontRight < embedded.length) {
      front.drawPage(embedded[frontRight], { x: HALF_W, y: 0 });
    }

    // Back of sheet
    const back = dstDoc.addPage([FULL_W, PAGE_H]);
    if (backLeft < embedded.length) {
      back.drawPage(embedded[backLeft], { x: 0, y: 0 });
    }
    if (backRight < embedded.length) {
      back.drawPage(embedded[backRight], { x: HALF_W, y: 0 });
    }
  }

  const bookletBytes = await dstDoc.save();
  fs.writeFileSync(bookletPdfPath, bookletBytes);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { volume: requestedVolume } = parseArgs();
  const volumeNum = requestedVolume ?? findHighestVolume();

  console.log(`[zine] Loading volume ${volumeNum}...`);
  const articles = loadArticles(volumeNum);

  if (articles.length === 0) {
    console.error(`Error: No articles found for volume ${volumeNum}`);
    process.exit(1);
  }

  console.log(`[zine] Found ${articles.length} articles`);

  console.log('[zine] Rendering HTML...');
  const html = buildDocument(articles, volumeNum);

  const outDir = path.join(ROOT, 'dist', 'zine');
  fs.mkdirSync(outDir, { recursive: true });

  const readerPath = path.join(outDir, `terminull-vol${volumeNum}.pdf`);
  const bookletPath = path.join(outDir, `terminull-vol${volumeNum}-booklet.pdf`);

  console.log('[zine] Generating reader PDF...');
  await generatePdf(html, readerPath);

  console.log('[zine] Imposing booklet spreads...');
  await imposeBooklet(readerPath, bookletPath);

  console.log(`[zine] Reader:  ${path.relative(ROOT, readerPath)}`);
  console.log(`[zine] Booklet: ${path.relative(ROOT, bookletPath)}`);
  console.log('[zine] Print booklet duplex, flip on short edge. Fold & staple.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
