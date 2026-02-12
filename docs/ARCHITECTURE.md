# Architecture

Technical reference for the terminull codebase. Read this to understand how the
site is built, how pages are rendered, and how the interactive layer works.

See also: [DEVELOPMENT.md](./DEVELOPMENT.md) | [CONTRIBUTING.md](./CONTRIBUTING.md) | [EDITING.md](./EDITING.md) | [ADMIN.md](./ADMIN.md)

---

## Overview

terminull is a static site built with [Astro 5](https://astro.build). It
generates pure HTML+CSS pages with zero JavaScript required for core content.
Interactive features (keyboard navigation, command prompt, search, CRT effect)
are layered on top as progressive enhancements.

**Key constraints:**

- Static output only (no SSR, no server)
- All content authored in Markdown
- No frontend framework (React, Vue, etc.) -- just Astro components
- Single external runtime dependency: `ansi_up` for ANSI art rendering

**Dependencies** (`package.json`):

| Package           | Purpose                              |
|-------------------|--------------------------------------|
| `astro`           | Static site generator                |
| `@astrojs/mdx`    | MDX support for content collections  |
| `ansi_up`         | ANSI escape code to HTML conversion  |
| `unist-util-visit` | AST traversal for remark/rehype plugins |
| `marked`           | Markdown parser for ANSI text rendering |
| `marked-terminal`  | Renders markdown as ANSI escape sequences |

---

## Rendering Pipeline

### Build Process

```
Astro CLI
  ├── Collects .astro pages from src/pages/
  ├── Resolves content collections (issues, pages)
  ├── For each .md file:
  │     Source MD
  │       → remark plugins (operate on mdast)
  │       → rehype plugins (operate on hast)
  │       → Shiki syntax highlighting
  │       → HTML output
  ├── Composes layouts (BaseLayout → ArticleLayout/IssueLayout)
  └── Writes static HTML to dist/
```

Build command: `astro build` (runs in ~800ms, produces 11 pages).

### Content Collections

Defined in `src/content/config.ts`. Two collections with Zod-validated schemas:

**issues** -- Articles organized by volume:

```typescript
z.object({
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
})
```

**pages** -- Static pages (about, manifesto):

```typescript
z.object({
  title: z.string(),
  description: z.string().optional(),
})
```

### Slug Extraction

Astro 5 content collection IDs include the full path and `.md` extension
(e.g., `vol1/01-smashing-the-stack.md`). Slugs are extracted with:

```javascript
article.id.replace(/.*\//, '').replace(/\.mdx?$/, '')
// "vol1/01-smashing-the-stack.md" → "01-smashing-the-stack"
```

This pattern appears in five files and must stay consistent:

- `src/pages/vol/[volume]/[slug].astro` -- article page generation
- `src/pages/vol/[volume]/index.astro` -- volume TOC
- `src/lib/search-index.ts` -- search index builder
- `src/pages/vol/[volume]/[slug].txt.ts` -- ANSI text article endpoint
- `src/pages/vol/[volume]/index.txt.ts` -- ANSI text volume TOC endpoint

### Route Generation

| Route File                            | URL Pattern              | Data Source             |
|---------------------------------------|--------------------------|-------------------------|
| `src/pages/index.astro`               | `/`                      | Static                  |
| `src/pages/help.astro`                | `/help`                  | Static                  |
| `src/pages/[page].astro`              | `/{page}`                | `pages` collection      |
| `src/pages/vol/index.astro`           | `/vol`                   | Static volumes array    |
| `src/pages/vol/[volume]/index.astro`  | `/vol/{n}`               | `issues` collection     |
| `src/pages/vol/[volume]/[slug].astro` | `/vol/{n}/{slug}`        | `issues` collection     |
| `src/pages/search-index.json.ts`      | `/search-index.json`     | `issues` collection     |
| `src/pages/index.txt.ts`              | `/index.txt`             | `issues` collection     |
| `src/pages/vol/[volume]/index.txt.ts` | `/vol/{n}/index.txt`     | `issues` collection     |
| `src/pages/vol/[volume]/[slug].txt.ts`| `/vol/{n}/{slug}.txt`    | `issues` collection     |
| `src/pages/[page].txt.ts`            | `/{page}.txt`            | `pages` collection      |

Dynamic routes use `getStaticPaths()` to enumerate all valid parameter
combinations at build time. Draft articles (`draft: true`) are filtered out
in every `getStaticPaths()` and in the search index.

---

## Layout Composition

```
BaseLayout.astro
├── <head>
│   ├── Meta tags, viewport, generator
│   ├── Google Fonts (VT323)
│   └── Seo.astro (title, OG, Twitter)
├── <body>
│   ├── CrtEffect.astro (overlay div + toggle script)
│   ├── <keyboard-nav> (KeyboardNav.astro web component)
│   │   └── .terminal (960px centered container)
│   │       ├── .connection-sequence (3-line boot text)
│   │       ├── BbsHeader.astro (logo + system info box)
│   │       └── <main.terminal-content>
│   │           └── <slot /> ← page content goes here
│   ├── StatusBar.astro (fixed, bottom: 3.5rem)
│   ├── BbsPrompt.astro (fixed, bottom: 0)
│   ├── HelpOverlay.astro (fixed, z-index: 100)
│   └── SearchOverlay.astro (fixed, z-index: 100)
```

### BaseLayout Props

```typescript
interface Props {
  title: string;
  description?: string;
  page?: string;       // Status bar label, default "HOME"
  volume?: number;     // Shown in status bar as "// vol.{n}"
  type?: 'website' | 'article';  // OG meta type
}
```

### ArticleLayout

Extends BaseLayout for individual articles. Adds:

- Article metadata header (order number, category badge, date, author, tags)
- `.glow-md` wrapper around content for styled markdown rendering
- `ArticleNav` component with prev/next/index links
- Imports `glow-markdown.css`

### IssueLayout

Extends BaseLayout for volume table-of-contents pages. Adds:

- Volume title (gold, uppercase)
- Optional description
- Passes `volume` number to BaseLayout for status bar

---

## CSS Architecture

Five CSS files in `src/assets/styles/`, imported in this order:

### 1. `colors.css`

CSS custom properties defining the full color palette:

| Token Group | Variables                              |
|-------------|----------------------------------------|
| Backgrounds | `--bg-deep`, `--bg-primary`, `--bg-surface`, `--bg-highlight` |
| Green       | `--green`, `--green-dim`, `--green-bright` |
| Gold        | `--gold`, `--gold-dim`                 |
| Pink        | `--pink`, `--pink-dim`                 |
| Cyan        | `--cyan`, `--cyan-dim`                 |
| Red         | `--red`                                |
| Text        | `--text-primary`, `--text-secondary`, `--text-muted` |
| Borders     | `--border`, `--border-bright`          |

### 2. `global.css`

Imports `colors.css`. Defines:

- CSS reset (box-sizing, margin, padding)
- `@font-face` for IBM Plex Mono (regular + bold, woff2 from `/fonts/`)
- Body defaults: VT323 font stack, 1.5rem base, `--text-primary` color, `--bg-deep` background
- Link styles (`--green`, hover `--green-bright`)
- Selection color (`--green` background)
- Custom scrollbar styling
- `.visually-hidden` utility class

### 3. `terminal.css`

Terminal chrome and structural layout:

- `.terminal` -- 960px max-width centered container, flex column, min-height 100vh
- `.terminal-content` -- flex: 1, **padding-bottom: 6rem** (clears fixed bars)
- Connection sequence line styling
- Section headings, dividers, link lists
- Terminal footer
- **Print-line animation** -- CSS-only staggered fade-in (`@keyframes print-line`) simulating BBS line-by-line printing. `.print-line` + `.print-line-{1-14}` classes applied to connection sequence, logo lines, tagline, and system info box. Each line fades in after a staggered delay (0ms–1200ms, ~1.2s total). Wrapped in `@media (prefers-reduced-motion: no-preference)` so everything appears instantly for users who prefer no motion.

### 4. `glow-markdown.css`

Charmbracelet/glow-inspired article rendering within `.glow-md`:

| Element        | Style                                           |
|----------------|------------------------------------------------|
| `h1`           | Gold background, dark text, uppercase           |
| `h2`           | Cyan text, `##` prefix via `::before`, bottom border |
| `h3`           | Green text, `###` prefix via `::before`         |
| `h4`           | Gold-dim text                                   |
| `pre`          | Dark surface background, border, no border-radius |
| `code` (inline)| Pink text on dark surface                       |
| `blockquote`   | Green-dim left border, `>` prefix               |
| `ul`           | Green `*` bullets via `::before`                |
| `ol`           | Gold numbered counters via `::before`            |
| `table`        | Gold headers, hover row highlight               |
| `strong`       | White text                                      |
| `em`           | Pink italic                                     |
| `a`            | Cyan, underline                                 |
| `hr`           | Dashed border                                   |
| `img`          | Border, max-width: 100%                         |
| `video`        | Border, dark surface background, max-width: 100% |
| `audio`        | Full width, block display                       |
| Admonitions    | Bordered boxes with colored headers (warn=gold, hack=green, info=cyan) |

### 5. `keyboard-nav.css`

Fixed-position UI elements and navigation:

- `[data-nav-item]` highlight styles and blinking `>` cursor
- `.bbs-menu` and `.article-list` navigation active states
- Help overlay (fixed, z-index: 100, centered)
- Search overlay (fixed, z-index: 100, top-aligned)
- Command prompt (fixed, bottom: 0, z-index: 50)
- Status bar (fixed, bottom: 3.5rem, z-index: 49)

### Fixed Layout Zones

```
┌─────────────────────────────────────────────┐
│                                             │
│              Scrollable Content              │
│                                             │
│         padding-bottom: 6rem clears          │
│         the fixed bars below                 │
│                                             │
├─────────────────────────────────────────────┤ ← bottom: 3.5rem
│  Status Bar (z-index: 49)                   │
├─────────────────────────────────────────────┤ ← bottom: 0
│  Command Prompt (z-index: 50)               │
└─────────────────────────────────────────────┘
```

Overlay z-indexes:

- CRT effect overlay: z-index 1000 (above everything, pointer-events: none)
- Help/Search overlays: z-index 100

### Responsive

Single breakpoint at **640px**:

- Status bar right section (key hints) hidden
- Article list header row hidden, link layout wraps
- Help table rows stack vertically

---

## Component System

### Display Components (No JS)

| Component            | Purpose                                              |
|----------------------|------------------------------------------------------|
| `AsciiArt.astro`     | Renders ASCII art from `public/art/` files or inline text. Color variants: green, gold, cyan, pink, red, muted. Uses IBM Plex Mono. |
| `AnsiArt.astro`      | Renders ANSI escape-coded art via `ansi_up` library. Reads from `public/art/` or inline text. |
| `BoxFrame.astro`     | Box-drawing character frame with optional title. 76-char wide borders. Optional `printLineStart`/`printLineEnd` props enable staggered print-line animation on the frame borders. |
| `BbsMenu.astro`      | Numbered menu list with `[00]` prefixed items. Assigns `data-nav-item` and `data-nav-index` attributes. |
| `ArticleList.astro`  | Tabular article listing with columns: #, title, author, category. Sorted by `order`. Assigns nav attributes. |
| `ArticleNav.astro`   | Prev/Next/Index navigation bar for articles.         |
| `CategoryBadge.astro`| Colored `[category]` label. Color map: editorial=gold, ascii-art=pink, security-news=red, guide=cyan, writeup=green, tool=green, fiction=pink, interview=gold. |
| `BbsHeader.astro`    | Site header: ASCII logo link (inline-rendered with per-line animation spans) + system info box with date, user, node, protocol details. |
| `Seo.astro`          | `<title>`, meta description, canonical URL, Open Graph, Twitter Card tags. |

### Interactive Components

| Component              | Global Function(s)        | Persistence       |
|------------------------|---------------------------|--------------------|
| `KeyboardNav.astro`    | --                        | --                 |
| `BbsPrompt.astro`      | `window.focusPrompt()`    | In-memory history  |
| `CrtEffect.astro`      | `window.toggleCrt()`      | `localStorage` key `terminull-crt` |
| `HelpOverlay.astro`    | `window.toggleHelp()`     | --                 |
| `SearchOverlay.astro`  | `window.openSearch(query?)`, `window.closeSearch()` | Cached index |

### Data Navigation Attributes

Interactive navigation targets elements with specific data attributes:

- `data-nav-item` -- Marks an element as navigable. `KeyboardNav` collects all matching elements.
- `data-nav-index` -- Numeric index for quick-jump (0-9 keys).
- `.nav-active` -- CSS class toggled on the currently selected item.

These attributes are set by `BbsMenu` and `ArticleList` components.

---

## Interactive Layer

### Philosophy

Core content (articles, navigation links, menus) is fully functional as static
HTML. All JavaScript is additive:

- Without JS: users click links, read articles, navigate via standard browser
- With JS: keyboard navigation, command prompt, search, CRT effect, help overlay

### Script Lifecycle

Every interactive component follows the same pattern:

```typescript
function init() {
  // Find DOM elements
  // Set up event listeners
  // Expose global functions on window
}

init();
document.addEventListener('astro:after-swap', init);
```

The `astro:after-swap` event fires after Astro's client-side navigation (View
Transitions). Re-initializing on this event ensures scripts survive page
transitions.

### KeyboardNav State Machine

`KeyboardNav.astro` defines a custom element (`<keyboard-nav>`) that wraps the
entire terminal content area.

**Input guards** -- ignores keystrokes when:

- Focus is on `<input>`, `<textarea>`, or `contentEditable` element
- Search overlay is active (only Escape passes through to close it)

**Key bindings:**

**List pages** (homepage, volume TOC -- pages with `[data-nav-item]` elements):

| Key             | Action                                      |
|-----------------|---------------------------------------------|
| `j` / `ArrowDown` | Move selection down                       |
| `k` / `ArrowUp`   | Move selection up                         |
| `Enter`         | Click the link in the active item            |
| `0-9`           | Find item with matching `data-nav-index`, select it, click after 150ms delay |

**Article/static pages** (no `[data-nav-item]` elements -- pager mode):

| Key             | Action                                      |
|-----------------|---------------------------------------------|
| `j` / `ArrowDown` | Scroll down (60px)                        |
| `k` / `ArrowUp`   | Scroll up (60px)                          |
| `d`             | Scroll half-page down                        |
| `u`             | Scroll half-page up                          |
| `g`             | Jump to top of page                          |
| `G`             | Jump to bottom of page                       |
| `p`             | Click `.article-nav__prev` link              |
| `n`             | Click `.article-nav__next` link              |

**Global** (all pages):

| Key             | Action                                      |
|-----------------|---------------------------------------------|
| `Escape`        | Close help overlay if open, else `history.back()` |
| `q`             | Close help overlay if open, else `history.back()` |
| `?`             | Toggle help overlay                          |
| `/` or `:`      | Focus command prompt                         |

### BbsPrompt Command Interpreter

`BbsPrompt.astro` implements a command prompt fixed at the bottom of the
viewport. Commands are case-insensitive.

| Command            | Action                                           |
|--------------------|--------------------------------------------------|
| `help`             | Navigate to `/help`                              |
| `home`             | Navigate to `/`                                  |
| `back`             | `history.back()`                                 |
| `clear`            | Clear feedback, scroll to top                    |
| `ls`               | Navigate to current volume TOC or `/vol`         |
| `cd <section>`     | Navigate to section: `~`/`home`=`/`, `..`=parent path, `vol`/`archive`=`/vol`, `about`, `manifesto`, `help`, `vol N`=`/vol/N` |
| `read <num>`       | Find nav item by index and navigate, or fall back to volume page |
| `vol [n]`          | Navigate to `/vol` or `/vol/{n}`                 |
| `search [query]`   | Open search overlay, optionally pre-filled       |
| `crt`              | Toggle CRT effect, show feedback                 |

The prompt also supports command history via ArrowUp/ArrowDown (in-memory, not
persisted).

---

## Search System

### Build Time

`src/lib/search-index.ts` exports `buildSearchIndex()`, which:

1. Calls `getCollection('issues')` with draft filter
2. Maps each article to a `SearchEntry` object:

```typescript
interface SearchEntry {
  title: string;
  slug: string;       // extracted via the slug pattern
  volume: number;
  order: number;
  category: string;
  description: string;
  tags: string[];
  author: string;
  handle?: string;
}
```

`src/pages/search-index.json.ts` exposes this as a JSON endpoint at
`/search-index.json`.

### Client Side

`SearchOverlay.astro` implements the search UI:

1. On first `openSearch()` call, fetches `/search-index.json` and caches it
2. Filters on every input keystroke
3. Case-insensitive substring matching across: title, description, tags,
   author, handle, category
4. Results rendered as links to `/vol/{volume}/{slug}`
5. Closed via Escape key or clicking the backdrop

---

## Markdown Processing Pipeline

```
Source .md
  │
  ├── remark-bbs-admonitions (mdast)
  │     Converts > [!WARN], > [!HACK], > [!INFO] blockquotes
  │     into admonition divs with CSS classes
  │
  ├── rehype-terminal-code (hast)
  │     Adds language label header div inside <pre> blocks
  │
  └── Shiki (syntax highlighting)
        Custom "terminull" theme defined inline in astro.config.mjs
        ↓
      HTML output
```

### remark-bbs-admonitions

**Source:** `src/plugins/remark-bbs-admonitions.ts`

Transforms blockquotes that start with `[!WARN]`, `[!HACK]`, or `[!INFO]`:

**Input markdown:**
```markdown
> [!WARN] This technique can be dangerous.
```

**Transformation:**

1. Detects the pattern `[!TYPE]` in the first text node of a blockquote
2. Adds `className: "admonition admonition-{type}"` to the blockquote via `hProperties`
3. Prepends an `admonition-header` paragraph with the type name (uppercased)
4. Strips the `[!TYPE]` marker from the original text

### rehype-terminal-code

**Source:** `src/plugins/rehype-terminal-code.ts`

Adds a language label bar to fenced code blocks:

**Input HTML (post-Shiki):**
```html
<pre><code class="language-python">...</code></pre>
```

**Transformation:**

1. Finds `<pre>` elements containing `<code class="language-*">`
2. Extracts the language name from the class
3. Prepends a `<div class="code-header"><span class="code-lang">python</span></div>` inside the `<pre>`

### Shiki Theme

The custom `terminull` theme is defined inline in `astro.config.mjs`:

| Scope                      | Color    | Description    |
|----------------------------|----------|----------------|
| keyword, storage           | `#5fd7ff` | Cyan           |
| string                     | `#afd700` | Green          |
| constant.numeric           | `#ffd700` | Gold           |
| entity.name.function       | `#ff5fd7` | Pink           |
| entity.name.type           | `#ffd700` | Gold           |
| comment                    | `#4a4a4a` | Muted, italic  |
| variable                   | `#d0d0d0` | Default text   |
| constant.other             | `#ff5f5f` | Red            |
| punctuation                | `#808080` | Gray           |
| entity.name.tag            | `#ff5fd7` | Pink           |
| entity.other.attribute-name| `#afd700` | Green          |
| variable.parameter         | `#d7ff5f` | Bright green   |

Background: `#111111`, foreground: `#d0d0d0`.

---

## Accessibility

- **Semantic HTML**: `<header>`, `<main>`, `<nav>`, `<article>` elements with appropriate `role` attributes
- **ARIA labels**: Command prompt (`role="search"`, `aria-label`), help overlay (`role="dialog"`, `aria-label`), search overlay (`role="dialog"`, `aria-label`, `aria-hidden`), banner header (`role="banner"`)
- **Live regions**: Prompt feedback uses `aria-live="polite"` for screen reader announcements
- **Focus management**: `a:focus-visible` outline (2px solid green), input caret color
- **Keyboard-first**: Full site navigable via keyboard (j/k, Enter, Escape, number keys)
- **ASCII art**: Marked `aria-hidden="true"` and `role="img"` (decorative)
- **prefers-reduced-motion**: CRT scanline effect, text shadow, and print-line animation disabled when user prefers reduced motion
- **`.visually-hidden`**: Utility class for screen-reader-only content

---

## File Reference

```
src/
├── assets/styles/
│   ├── colors.css              # Color palette custom properties
│   ├── global.css              # Reset, fonts, body defaults
│   ├── terminal.css            # Terminal chrome layout
│   ├── glow-markdown.css       # Article markdown rendering
│   └── keyboard-nav.css        # Navigation, overlays, fixed bars
├── components/
│   ├── AnsiArt.astro           # ANSI escape art renderer
│   ├── ArticleList.astro       # Volume article table
│   ├── ArticleNav.astro        # Prev/Next article navigation
│   ├── AsciiArt.astro          # ASCII art renderer
│   ├── BbsHeader.astro         # Site header with logo + system info
│   ├── BbsMenu.astro           # Numbered navigation menu
│   ├── BbsPrompt.astro         # Command prompt interpreter
│   ├── BoxFrame.astro          # Box-drawing character frame
│   ├── CategoryBadge.astro     # Colored category label
│   ├── CrtEffect.astro         # CRT scanline toggle
│   ├── HelpOverlay.astro       # Keyboard shortcuts overlay
│   ├── KeyboardNav.astro       # Keyboard navigation web component
│   ├── SearchOverlay.astro     # Search UI overlay
│   ├── Seo.astro               # SEO/OG meta tags
│   └── StatusBar.astro         # Fixed status bar
├── content/
│   ├── config.ts               # Collection schemas (Zod)
│   ├── issues/vol1/            # Volume 1 articles
│   └── pages/                  # Static pages (about, manifesto)
├── layouts/
│   ├── BaseLayout.astro        # Root layout shell
│   ├── ArticleLayout.astro     # Article page layout
│   └── IssueLayout.astro       # Volume TOC layout
├── lib/
│   ├── ansi-render.ts          # ANSI-to-HTML conversion wrapper
│   ├── ansi-text.ts            # ANSI text rendering (marked-terminal) + BBS chrome builders
│   └── search-index.ts         # Search index builder
├── pages/
│   ├── index.astro             # Homepage
│   ├── help.astro              # Command reference page
│   ├── [page].astro            # Dynamic static pages
│   ├── search-index.json.ts    # Search JSON endpoint
│   ├── index.txt.ts            # ANSI text homepage
│   ├── [page].txt.ts           # ANSI text static pages (about, manifesto)
│   └── vol/
│       ├── index.astro         # Volume archive
│       └── [volume]/
│           ├── index.astro     # Volume TOC
│           ├── index.txt.ts    # ANSI text volume TOC
│           ├── [slug].astro    # Article page
│           └── [slug].txt.ts   # ANSI text article
└── plugins/
    ├── remark-bbs-admonitions.ts  # Admonition blockquote transform
    └── rehype-terminal-code.ts    # Code block language header
```
