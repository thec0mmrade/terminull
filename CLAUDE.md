# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build → dist/
npm run preview   # Serve built dist/ locally
```

No linter or test runner is configured. Verify changes with `npm run build` (builds 11 pages in ~800ms).

### SSH BBS (Go)

```bash
cd ssh
go build .                  # Build binary (needs Go 1.23+)
go run . --port 2222        # Start SSH server
ssh localhost -p 2222       # Connect in another terminal
```

Go is installed via [mise](https://mise.jdx.dev/). Use `mise exec -- go build` if `go` isn't on your PATH.

## Architecture

**terminull** is a static hacker e-zine website built with Astro 5. It simulates a 90s BBS terminal with keyboard navigation, a command prompt, and glow-inspired markdown rendering. Zero JS required for core content; interactive features are progressive enhancements.

The `ssh/` directory contains a Go SSH BBS server that provides an interactive TUI over SSH, using the same content and visual identity. See the **SSH BBS** section below.

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
This pattern appears in `[slug].astro`, `[volume]/index.astro`, `search-index.ts`, and the `.txt` endpoint routes. Keep them consistent.

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

**BbsPrompt.astro** implements a command interpreter: `help`, `read <num>`, `ls`, `cd <section>` (supports `..`, `~`, named sections, `vol N`), `search <query>`, `crt`, `vol <n>`, `home`, `back`, `clear`.

### Remark/Rehype Plugins

- **remark-bbs-admonitions.ts** — Converts `> [!WARN]`, `> [!HACK]`, `> [!INFO]` blockquotes into styled admonition blocks with CSS classes
- **rehype-terminal-code.ts** — Prepends a language label header div inside `<pre>` elements that contain `<code class="language-*">`

### ANSI Text Endpoints

`src/lib/ansi-text.ts` provides ANSI-colored terminal text rendering: color constants (xterm-256 mapped from `colors.css`), a `renderMarkdownToAnsi()` pipeline using `marked` + `marked-terminal`, and BBS chrome builders (header, box frame, article nav, footer).

Static `.txt` API routes serve ANSI-formatted content for `curl URL | less -R`:
- `src/pages/index.txt.ts` → `/index.txt` (homepage)
- `src/pages/[page].txt.ts` → `/{page}.txt` (about, manifesto)
- `src/pages/vol/[volume]/index.txt.ts` → `/vol/{n}/index.txt` (volume TOC)
- `src/pages/vol/[volume]/[slug].txt.ts` → `/vol/{n}/{slug}.txt` (article content)

Articles use `article.body` (raw markdown) instead of `article.render()` (HTML), with admonition syntax pre-processed via regex.

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

### SSH BBS (`ssh/`)

A Go application providing a full interactive TUI over SSH. Connect via `ssh host -p 2222`.

**Stack:** [Wish](https://github.com/charmbracelet/wish) (SSH server) + [Bubble Tea](https://github.com/charmbracelet/bubbletea) (TUI) + [Glamour](https://github.com/charmbracelet/glamour) (markdown) + [Lip Gloss](https://github.com/charmbracelet/lipgloss) (styling).

**Content loading:** Reads raw markdown from `../src/content/` at runtime. Parses YAML frontmatter with `gopkg.in/yaml.v3`. Skips `draft: true` articles. Loaded once at startup, shared read-only across sessions.

**Screen architecture:** Screen stack router (`ui/app.go`) manages push/pop/replace navigation. Each screen implements `Screen` interface (`Init`, `Update`, `View`, `StatusInfo`). Shared message types in `ui/types/` to avoid import cycles.

**Screens:**
- **Home** — Connection animation (4 phases via `tea.Tick`), logo, system info box, main menu
- **Volume TOC** — Article table with category colors, j/k + number key navigation
- **Article** — Glamour-rendered markdown in a viewport with metadata box, prev/next (p/n)
- **Page** — Static page reader (about, manifesto)
- **Help** — Keyboard reference in a box frame
- **Search** — Live text input with substring matching across article fields

**Theme:** Custom Glamour `StyleConfig` and Lip Gloss styles matching the web's `glow-markdown.css` palette. xterm-256 colors for Lip Gloss, hex colors for Chroma syntax highlighting.

**Preprocessing:** Admonitions (`> [!WARN]`, etc.) converted to bold blockquote text. Images/video/audio replaced with `[IMAGE]`/`[VIDEO]`/`[AUDIO]` placeholders.

**Security hardening:** Rate limiting via `wish/ratelimiter` (1 conn/sec, burst 10, 256-IP LRU). Username guard rejects usernames >64 bytes at the SSH layer; `sanitizeUsername()` strips ANSI escapes and non-printable chars, truncates to 32 for display. PTY dimensions clamped (width ≤300, height ≤100). Screen stack capped at 20 depth. Content loader enforces 1MB file size limit and symlink containment. Idle timeout: 10min, max session: 2hr.

**Config:** Env vars with flag overrides — `TERMINULL_PORT` (2222), `TERMINULL_HOST` (0.0.0.0), `TERMINULL_CONTENT_DIR` (../src/content), `TERMINULL_SITE_URL`, `TERMINULL_HOST_KEY` (auto-generated).
