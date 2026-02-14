# Development

Guide for forking terminull and building your own e-zine.

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [CONTRIBUTING.md](./CONTRIBUTING.md) | [EDITING.md](./EDITING.md) | [ADMIN.md](./ADMIN.md)

---

## Prerequisites

- **Node.js 20+** and npm
- **git**
- Familiarity with [Astro](https://astro.build) and Markdown

---

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/terminull.git
cd terminull

# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

The dev server runs at `http://localhost:4321` with hot reload.

`npm run build` produces static files in `dist/` (~800ms, ~11 pages).

No linter or test runner is configured. Verify changes with `npm run build`.

### Print Zine Export

```bash
npm run zine                  # Export latest volume as PDF
npm run zine -- --volume 1    # Export specific volume
```

Outputs two PDFs to `dist/zine/`: a reader version (5.5"×8.5" portrait) and a
booklet imposition (11"×8.5" landscape, 2-up saddle-stitch spreads). Requires
`puppeteer` and `pdf-lib` (dev dependencies, installed via `npm install`).

---

## Project Structure

```
terminull/
├── astro.config.mjs            # Astro config, Shiki theme, plugins
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript config
├── public/                     # Static assets (copied to dist/ as-is)
│   ├── art/                    # ASCII/ANSI art files
│   │   ├── logo.txt            # Site logo
│   │   ├── headers/            # Article header art
│   │   └── dividers/           # Decorative dividers
│   ├── fonts/                  # IBM Plex Mono woff2 files
│   ├── favicon.ico
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── assets/styles/          # CSS files (5 files)
│   ├── components/             # Astro components (15 files)
│   ├── content/
│   │   ├── config.ts           # Collection schemas
│   │   ├── issues/_templates/   # Template articles (drafts)
│   │   └── pages/              # Static pages
│   ├── layouts/                # Layout templates (3 files)
│   ├── lib/                    # Utility modules
│   ├── pages/                  # Route files
│   └── plugins/                # Remark/rehype plugins
├── scripts/
│   └── export-zine.js          # Print zine PDF exporter
├── .github/workflows/
│   └── deploy.yml              # Cloudflare Pages deployment
└── docs/                       # Documentation (you are here)
```

For a detailed file-by-file reference, see
[ARCHITECTURE.md -- File Reference](./ARCHITECTURE.md#file-reference).

---

## Customizing Your Zine

### Renaming from "terminull"

The name "terminull" appears in these locations. Update all of them:

| File | What to change |
|------|----------------|
| `astro.config.mjs:40` | `site` URL (`https://terminull.pages.dev`) |
| `src/components/BbsHeader.astro:23` | Node name in system info (`terminull.local`) |
| `src/components/BbsPrompt.astro:11` | Prompt prefix (`guest@terminull`) |
| `src/components/BbsPrompt.astro:95,151` | Error messages (`terminull: cd:`, `terminull: command not found:`) |
| `src/components/StatusBar.astro:13` | Status bar label (`terminull`) |
| `src/components/Seo.astro:9` | Default description (`terminull - hacker e-zine`) |
| `src/components/Seo.astro:11` | Title suffix (`// terminull`) |
| `src/components/Seo.astro:23` | OG site name (`terminull`) |
| `src/components/CrtEffect.astro:10` | localStorage key (`terminull-crt`) |
| `src/pages/index.astro:15` | Page title and description |
| `src/pages/index.astro:25-26` | MOTD welcome text |
| `src/pages/index.astro:34` | Footer text |
| `src/lib/ansi-text.ts:128,131` | Connection sequence and system info (`terminull.local`) |
| `src/lib/ansi-text.ts:248` | Footer URL (`terminull.local`) |
| `src/content/pages/about.md` | Content references to the name |
| `src/content/pages/manifesto.md` | Content references to the name |
| `public/robots.txt:4` | Sitemap URL |

### Logo

Replace `public/art/logo.txt` with your own ASCII art. Keep it under ~76
characters wide to avoid horizontal scrolling.

Tools for generating ASCII art logos:

```bash
# figlet
figlet -f slant "MYSITE"

# toilet with color
toilet -f future "MYSITE"
```

The logo is rendered inline by `BbsHeader.astro` (each line wrapped in a span
for staggered print-line animation) in IBM Plex Mono at 1.125rem. Test how it
looks at that size.

### Colors

Edit `src/assets/styles/colors.css` to change the full palette. The CSS custom
properties are used throughout all other stylesheets:

```css
:root {
  --green: #afd700;      /* Primary accent: links, active states */
  --gold: #ffd700;       /* Headings, highlights */
  --pink: #ff5fd7;       /* Inline code, functions */
  --cyan: #5fd7ff;       /* Secondary accent, categories */
  --red: #ff5f5f;        /* Errors, warnings */
  /* ... plus dim variants, backgrounds, text, borders */
}
```

If you change the accent colors, also update the Shiki syntax highlighting
theme in `astro.config.mjs` (lines 8-37) to match. The theme uses the same
hex values for code highlighting.

### Fonts

The primary display font is **VT323** (Google Fonts), loaded in
`src/layouts/BaseLayout.astro:33`:

```html
<link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
```

To change it:

1. Update the Google Fonts `<link>` in `BaseLayout.astro:33`
2. Update `font-family` in `src/assets/styles/global.css:36`

The fallback font is **IBM Plex Mono** (self-hosted in `public/fonts/`), used
for code blocks, ASCII art, and box-drawing characters. Replace the woff2 files
and update the `@font-face` declarations in `global.css:13-27` if changing it.

### Categories

To add a new category:

1. Add it to the enum in `src/content/config.ts:12-15`:
   ```typescript
   category: z.enum([
     'editorial', 'ascii-art', 'security-news', 'guide',
     'writeup', 'tool', 'fiction', 'interview',
     'your-new-category',  // add here
   ]),
   ```

2. Add a color mapping in `src/components/CategoryBadge.astro:8-17`:
   ```typescript
   const colorMap: Record<string, string> = {
     // ... existing entries
     'your-new-category': 'cyan',  // pick: green, gold, cyan, pink, red
   };
   ```

### Connection Sequence

The boot-up text at the top of every page. Edit
`src/layouts/BaseLayout.astro:40-44`:

```html
<div class="connection-sequence" aria-hidden="true">
  <div class="line"><span class="label">Connecting to</span><span class="value"> terminull.local</span><span class="label">...</span><span class="ok"> OK</span></div>
  <div class="line"><span class="label">Verifying identity...</span><span class="value"> ANONYMOUS</span></div>
  <div class="line"><span class="label">Loading system...</span><span class="ok"> READY</span></div>
</div>
```

Use the `.label`, `.value`, and `.ok` classes for coloring. See
`src/assets/styles/terminal.css:58-79` for their styles.

### System Info Box

The system info panel below the logo. Edit `src/components/BbsHeader.astro`:

```html
<BoxFrame title="SYSTEM INFO">
  <div class="system-info">
    <div class="system-info__line">
      <span class="label">Connected:</span>
      <span class="value">{dateStr}</span>
      <!-- ... -->
    </div>
  </div>
</BoxFrame>
```

### MOTD (Message of the Day)

The welcome message on the homepage. Edit `src/pages/index.astro:22-29`:

```html
<div class="motd">
  <p class="motd-label">[MESSAGE OF THE DAY]</p>
  <p class="motd-text">
    Your custom welcome message here.
  </p>
</div>
```

### ASCII Art

Art files live in `public/art/`. Subdirectories:

- `public/art/logo.txt` -- site logo
- `public/art/headers/` -- article header art
- `public/art/dividers/` -- decorative line dividers

Use the `AsciiArt` component for plain ASCII:

```astro
<AsciiArt file="/art/your-art.txt" color="green" />
```

Use the `AnsiArt` component for ANSI escape-coded art:

```astro
<AnsiArt file="/art/your-ansi.ans" />
```

---

## Adding Content

### Creating a New Volume

1. Create the directory:
   ```
   src/content/issues/vol2/
   ```

2. Add an entry to the volumes array in `src/pages/vol/index.astro`:
   ```typescript
   const volumes = [
     { label: 'Volume 1', href: '/vol/1', description: 'June 2025 -- Inaugural Issue' },
   ];
   ```

3. Add a `Latest Issue` menu item to `src/pages/index.astro` if desired:
   ```typescript
   { label: 'Latest Issue', href: '/vol/1', description: 'Volume 1 -- June 2025' },
   ```

4. Add articles to the new volume directory. Each article's `volume` frontmatter
   field must match the volume number.

Volume TOC pages and article pages are generated automatically by
`src/pages/vol/[volume]/index.astro` and `src/pages/vol/[volume]/[slug].astro`
via `getStaticPaths()`.

### Adding Articles

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full article writing guide.

Quick reference:

1. Create `src/content/issues/vol{N}/{order:2d}-{slug}.md`
2. Add frontmatter (title, author, date, volume, order, category, description)
3. Set `draft: true` during development
4. Write content in Markdown
5. Run `npm run build` to verify
6. Set `draft: false` to publish

### Adding Static Pages

1. Create `src/content/pages/{slug}.md` with frontmatter:
   ```yaml
   ---
   title: "Your Page Title"
   description: "Optional description."
   ---
   ```

2. The page is automatically routed to `/{slug}` by `src/pages/[page].astro`.

3. If you want it in the main menu, add it to the `menuItems` array in
   `src/pages/index.astro:6-12`.

4. If you want it accessible via the `cd` command, add a case in
   `src/components/BbsPrompt.astro:79-98`.

---

## Deployment

terminull builds to a static `dist/` directory. It works on any static hosting
provider.

### Cloudflare Pages (Current)

The project includes `.github/workflows/deploy.yml` for Cloudflare Pages
deployment. Set the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets
in your GitHub repo settings.

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/
      - uses: actions/deploy-pages@v4
```

### Netlify / Vercel

Set the build command to `npm run build` and the output directory to `dist/`.
No additional configuration needed.

### Any Static Host

```bash
npm run build
# Upload contents of dist/ to your server
```

---

## Extending the Platform

### Adding Remark/Rehype Plugins

1. Create your plugin in `src/plugins/`:
   ```typescript
   // src/plugins/remark-my-plugin.ts
   import type { Root } from 'mdast';
   import { visit } from 'unist-util-visit';

   export function remarkMyPlugin() {
     return (tree: Root) => {
       visit(tree, 'paragraph', (node) => {
         // transform nodes
       });
     };
   }
   ```

2. Register it in `astro.config.mjs`:
   ```javascript
   import { remarkMyPlugin } from './src/plugins/remark-my-plugin.ts';

   export default defineConfig({
     markdown: {
       remarkPlugins: [remarkBbsAdmonitions, remarkMyPlugin],
       rehypePlugins: [rehypeTerminalCode],
     },
   });
   ```

The existing plugins use `unist-util-visit` (already a dependency) for AST
traversal. Remark plugins operate on mdast (Markdown AST), rehype plugins
operate on hast (HTML AST).

### Adding Components

Follow existing patterns:

- **Display components**: `.astro` file with typed `Props` interface, scoped
  `<style>` block, no `<script>`.

- **Interactive components**: include a `<script>` block that:
  1. Defines an `init()` function
  2. Calls `init()` immediately
  3. Registers `document.addEventListener('astro:after-swap', init)` for
     client-side navigation support
  4. Exposes global functions on `window` if other components need to call them

### Adding Routes

1. Create a new `.astro` file in `src/pages/` following Astro's file-based
   routing conventions.

2. Use one of the existing layouts (`BaseLayout`, `ArticleLayout`,
   `IssueLayout`) or create a new one.

3. If the new page should be reachable via the command prompt, add a case to
   the `cd` command switch in `src/components/BbsPrompt.astro:79-98`.

4. If it should appear in the main menu, add it to `menuItems` in
   `src/pages/index.astro:6-12`.
