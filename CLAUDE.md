# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build → dist/
npm run preview   # Serve built dist/ locally
```

No linter or test runner is configured. Verify changes with `npm run build` (builds 11 pages in ~800ms).

## Architecture

**terminull** is a static hacker e-zine website built with Astro 5. It simulates a 90s BBS terminal with keyboard navigation, a command prompt, and glow-inspired markdown rendering. Zero JS required for core content; interactive features are progressive enhancements.

### Layout Hierarchy

`BaseLayout.astro` is the root shell for every page. It renders the connection sequence, BBS header (ASCII logo + system info), CRT effect, keyboard nav web component, status bar, command prompt, help overlay, and search overlay. All pages inherit this chrome.

`ArticleLayout.astro` extends BaseLayout for individual articles — adds article metadata header, glow-md content wrapper, and prev/next navigation.

`IssueLayout.astro` extends BaseLayout for volume table-of-contents pages.

### Content Collections

Two Astro content collections defined in `src/content/config.ts`:

- **issues** (`src/content/issues/vol{N}/`): Articles with frontmatter schema including `volume`, `order` (position in TOC), `category` (enum), `draft`, `tags`, etc.
- **pages** (`src/content/pages/`): Static pages (about, manifesto) with just title/description.

Article filenames follow `{order:2d}-{slug}.md` convention (e.g., `01-smashing-the-stack.md`).

### Slug Extraction

Astro 5 content collection IDs include the directory path and `.md` extension. Slugs are extracted everywhere with:
```javascript
article.id.replace(/.*\//, '').replace(/\.mdx?$/, '')
```
This pattern appears in `[slug].astro`, `[volume]/index.astro`, and `search-index.ts`. Keep them consistent.

### CSS Architecture

Five CSS files in `src/assets/styles/`:
- **colors.css** — CSS custom properties for the full color palette (greens, gold, cyan, pink, red, grays)
- **global.css** — Reset, font-face (IBM Plex Mono woff2), body defaults (VT323 at 1.5rem), links, scrollbar, selection
- **terminal.css** — Terminal chrome layout (960px centered), connection sequence, dividers, section headings
- **glow-markdown.css** — Charmbracelet/glow-inspired article rendering: gold h1 blocks, cyan h2 with `##` prefix, green h3, pink inline code, green blockquote borders, custom list bullets, styled tables, admonition blocks
- **keyboard-nav.css** — Navigation highlights, blinking cursor, help/search overlays, command prompt, status bar (all fixed-position bottom elements)

### Interactive Components (Progressive Enhancement)

All interactive scripts re-initialize on `astro:after-swap` to survive client-side navigation. They communicate via global window functions:

- `window.focusPrompt()` — Focus the command input
- `window.toggleHelp()` — Toggle help overlay
- `window.toggleCrt()` — Toggle CRT effect (persisted in localStorage)
- `window.openSearch(query?)` / `window.closeSearch()` — Search overlay

**KeyboardNav.astro** is a custom element (`<keyboard-nav>`) that handles j/k navigation, number keys, Enter, Escape, `/`, `?`, `p`/`n`. It targets elements with `[data-nav-item]` and `[data-nav-index]` attributes.

**BbsPrompt.astro** implements a command interpreter: `help`, `read <num>`, `ls`, `cd <section>`, `search <query>`, `crt`, `vol <n>`, `home`, `back`, `clear`.

### Remark/Rehype Plugins

- **remark-bbs-admonitions.ts** — Converts `> [!WARN]`, `> [!HACK]`, `> [!INFO]` blockquotes into styled admonition blocks with CSS classes
- **rehype-terminal-code.ts** — Prepends a language label header div inside `<pre>` elements that contain `<code class="language-*">`

### Search

Build-time: `src/pages/search-index.json.ts` calls `buildSearchIndex()` to produce a JSON endpoint from all non-draft issues.

Client-side: `SearchOverlay.astro` fetches `/search-index.json` on first open, caches it, and filters on title/description/tags/author/handle/category.

### Fixed Layout Zones

Content needs `padding-bottom: 6rem` to clear the fixed-position bottom bars:
- Status bar: `bottom: 3.5rem`
- Command prompt: `bottom: 0`

### Fonts

- **VT323** (Google Fonts) — Primary display font, pixel/bitmap aesthetic
- **IBM Plex Mono** (self-hosted woff2 in `public/fonts/`) — Fallback, especially for box-drawing characters
