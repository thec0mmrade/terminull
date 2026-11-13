# Development

Guide for forking terminull and building your own e-zine.

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [CONTRIBUTING.md](./CONTRIBUTING.md) | [EDITING.md](./EDITING.md) | [ADMIN.md](./ADMIN.md)

---

## Prerequisites

- **Node.js 22.12+** and npm
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

`npm run build` produces static files in `dist/` (about a second; 18 pages for Volume 1).

No linter or test runner is configured. Verify changes with `npm run build`.

### Print Zine Export

```bash
npm run zine                  # Export latest volume as PDF
npm run zine -- --volume 1    # Export specific volume
```

Outputs two PDFs to `public/zine/` (gitignored; `npm run build` copies them into `dist/zine/`, and volume TOC pages link them when present): a reader version (5.5"×8.5" portrait) and a
booklet imposition (11"×8.5" landscape, 2-up saddle-stitch spreads). Requires
`puppeteer` and `pdf-lib` (dev dependencies, installed via `npm install`).

The exporter renders articles with JavaScript disabled, blocks every network
request except images, and runs Chromium with its sandbox on. If Chromium
cannot start its sandbox (some containers and CI runners), set
`ZINE_NO_SANDBOX=1`.

Puppeteer 25 downloads its own Chrome and needs `unzip` on your PATH to extract
it (`npx puppeteer browsers install chrome` retries the download). On NixOS the
downloaded Chrome cannot find system libraries such as `libglib-2.0.so.0`, so
the export fails unless Puppeteer is pointed at a system browser. This works:

```bash
nix shell nixpkgs#chromium -c env -u LD_LIBRARY_PATH sh -c \
  'PUPPETEER_EXECUTABLE_PATH=$(which chromium) npm run zine'
```

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
│   ├── fonts/                  # VT323, IBM Plex Mono, IBM VGA (woff2) and their licenses
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── assets/styles/          # CSS files (5 files)
│   ├── components/             # Astro components (16 files)
│   ├── content.config.ts       # Collection schemas and loaders
│   ├── content/
│   │   ├── templates/           # Template articles (drafts)
│   │   ├── volumes/             # Your issues (private content repo, gitignored)
│   │   └── pages/              # Static pages
│   ├── layouts/                # Layout templates (3 files)
│   ├── lib/                    # Utility modules
│   ├── pages/                  # Route files
│   └── plugins/                # Remark/rehype plugins
├── scripts/
│   ├── export-zine.js          # Print zine PDF exporter
│   ├── publish.js              # One-command deploy (npm run publish)
│   └── publish/                # Config, preflight, remote and verify helpers
├── deploy/                     # Server setup playbook (ansible/) and templates
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
| `TERMINULL_SITE_URL` | Public site URL (environment or `deploy.env`; feeds Astro `site`, `.txt` footers, the zine back cover and the BBS). Its host is also the "node" name in every "Connecting to …" line and `Node:` field, on the web, in `.txt` and in the BBS (`siteHost()` in `src/lib/site-url.js`, `SiteHost()` in `ssh/ui/components/header.go`); unset, it is `terminull.local`. |
| `src/components/BbsPrompt.astro:11` | Prompt prefix (`guest@terminull`) |
| `src/components/BbsPrompt.astro:99,155` | Error messages (`terminull: cd:`, `terminull: command not found:`) |
| `src/components/StatusBar.astro:13` | Status bar label (`terminull`) |
| `src/components/Seo.astro:9` | Default description (`terminull - hacker e-zine`) |
| `src/components/Seo.astro:11` | Title suffix (`// terminull`) |
| `src/components/Seo.astro:23` | OG site name (`terminull`) |
| `src/components/CrtEffect.astro:10` | localStorage key (`terminull-crt`) |
| `src/pages/index.astro:15` | Page title and description |
| `src/lib/home.js`, `ssh/ui/components/chrome.go` | Menu descriptions and MOTD welcome text (web, `.txt` and BBS) |
| `src/pages/index.astro:33` | Footer text |
| `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Site icon: a pixel-art `T_` (16×16 grid in the SVG; the `.ico` holds 16/32/48 px renders, the touch icon 180 px). Linked in `BaseLayout.astro`. |
| `src/content/pages/about.md` | Content references to the name |
| `src/content/pages/manifesto.md` | Content references to the name |

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

The primary display font is **VT323** (SIL OFL), self-hosted in
`public/fonts/` as two subsets (`VT323-latin.woff2`, `VT323-latin-ext.woff2`,
from `@fontsource/vt323`) with `@font-face` rules in
`src/assets/styles/global.css`. `BaseLayout.astro` preloads the latin file.

To change it, replace the woff2 files and their `@font-face` rules, update the
preload in `BaseLayout.astro`, and update `font-family` in `global.css`. Keep
fonts self-hosted: the Content-Security-Policy only allows fonts from the site
itself.

The fallback font is **IBM Plex Mono** (self-hosted in `public/fonts/`), used
for code blocks, ASCII art, and box-drawing characters. Replace the woff2 files
and update the `@font-face` declarations in `global.css:36-50` if changing it.

### Categories

To add a new category:

1. Add it to the enum in `src/content.config.ts`:
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
`src/layouts/BaseLayout.astro:42-46`:

```html
<div class="connection-sequence" aria-hidden="true">
  <div class="line"><span class="label">Connecting to</span><span class="value"> {siteHost()}</span><span class="label">...</span><span class="ok"> OK</span></div>
  <div class="line"><span class="label">Verifying identity...</span><span class="value"> ANONYMOUS</span></div>
  <div class="line"><span class="label">Loading system...</span><span class="ok"> READY</span></div>
</div>
```

`siteHost()` is the host of `TERMINULL_SITE_URL` (`terminull.local` when it
is unset), so the line names your real domain. Use the `.label`, `.value`, and
`.ok` classes for coloring. See
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

The welcome message on the homepage. The main menu and the message of the day are defined once, in
`src/lib/home.js` (`mainMenu()`, `MOTD_TEXT`), and used by the homepage
(`src/pages/index.astro`) and its `.txt` twin. The SSH BBS shows the same
menu and message: `mainMenu()` in `ssh/ui/screens/home.go` and `RenderMOTD()`
in `ssh/ui/components/chrome.go`. Change all three together; the Go and
JavaScript tests check the menu wording matches.

Edit `MOTD_TEXT` in `src/lib/home.js` and the matching text in `RenderMOTD()`
in `ssh/ui/components/chrome.go`.

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

1. Create the directory in your content repo:
   ```
   src/content/volumes/vol2/
   ```
   (`src/content/volumes/` is a separate, private git repo. The engine repo
   ignores it. Set `TERMINULL_VOLUMES_DIR` to an absolute path to keep it
   elsewhere; a relative value resolves differently for the Go BBS.)

2. The Archive page (`/vol`) lists volumes automatically; there is no array to
   update.

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

1. Create `src/content/volumes/vol{N}/{order:2d}-{slug}.md` (copy a starter from `src/content/templates/`)
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

3. If you want it in the main menu, add it to `mainMenu()` in
   `src/lib/home.js` and in `ssh/ui/screens/home.go`.

4. If you want it accessible via the `cd` command, add a case in
   `src/components/BbsPrompt.astro:79-98`.

---

## Deployment

Your issues live in a separate private git repo (checked out at
`src/content/volumes/`), and the site is published to a single server with one
command:

```bash
cp deploy.env.example deploy.env   # once; gitignored
npm run publish                    # --dry-run builds without uploading
```

Publish checks that the content repo is committed and pushed, builds the site,
zine PDFs for every volume and a static Linux BBS binary, uploads a release,
switches to it, verifies it and rolls back on failure. `npm test` runs its unit
tests. The server setup is a one-time job: see [DEPLOY.md](./DEPLOY.md). On
NixOS, run it via
`nix shell nixpkgs#go nixpkgs#chromium -c env -u LD_LIBRARY_PATH sh -c 'PUPPETEER_EXECUTABLE_PATH=$(which chromium) npm run publish'`.

The static `dist/` also works on any static host, but the BBS and the publish
workflow assume the server.

---

## Releasing

The engine is versioned with [SemVer](https://semver.org/). The version lives
in one place, `package.json`; the web and `.txt` footers, the print zine and
the server's `RELEASE` file read it from `src/lib/version.js`, and publish
stamps it into the SSH BBS binary (`-ldflags -X
terminull-ssh/ui/components.Version=…`). A plain `go build` shows
`terminull dev`.

Versions describe the engine, not the zine: publishing a new volume or article
changes nothing here. Bump:

- **MAJOR** when a forker has to act: a frontmatter field, `deploy.env` key,
  playbook variable or server layout changes incompatibly.
- **MINOR** for new features (a new screen, endpoint, content type, option).
- **PATCH** for fixes that change no interface.

To cut a release, say 1.1.0:

1. In `CHANGELOG.md`, move the entries under `## [Unreleased]` into a new
   `## [1.1.0] - YYYY-MM-DD` section, leaving `## [Unreleased]` empty above it.
   Commit that.
2. `npm version minor -m "Release %s"` (or `patch` / `major`). It sets
   `package.json` and `package-lock.json`, commits, and tags `v1.1.0`. It
   refuses to run with uncommitted changes.
3. `npm test` (fails if the changelog has no section for the new version),
   then `git push --follow-tags`.
4. Publish, so the site and the BBS show the new version.

Between releases, note every user-visible change under `## [Unreleased]` as
you make it.

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

4. If it should appear in the main menu, add it to `mainMenu()` in
   `src/lib/home.js` and in `ssh/ui/screens/home.go`.
