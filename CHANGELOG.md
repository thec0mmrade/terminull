# Changelog

Notable changes to terminull. The project has no tagged releases yet, so
entries are grouped by date. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-11-10

### Security

- **SSH BBS:** fixed a remote crash. Terminal sizes were clamped only at
  session start, so an unauthenticated client could send a huge window-change
  and exhaust the server's memory, ending every session. Sizes are now clamped
  on every resize.
- **SSH BBS:** articles and pages re-render only when the wrap width changes,
  so a flood of resize requests is cheap.
- **SSH BBS:** concurrent sessions are capped (default 100; `--max-sessions` /
  `TERMINULL_MAX_SESSIONS`).
- **SSH BBS:** connection logs quote client-supplied values (username, TERM,
  client version), preventing log and terminal-escape injection. The username
  length guard now runs before logging.
- **SSH BBS and `.txt` endpoints:** control characters are stripped from
  content before it reaches a terminal.
- **Zine export:** articles render with JavaScript disabled and non-image
  network requests blocked, and Chromium's sandbox stays on unless
  `ZINE_NO_SANDBOX=1`. Link labels are escaped.
- **Search overlay:** results are built with `textContent` instead of
  `innerHTML`.
- **Dependencies:** cleared all 26 `npm audit` advisories and all known
  advisories reachable in the Go modules (see Changed).

### Changed

- **Astro 5 → 7** (`astro` 7.4.1, `@astrojs/mdx` 8.1.0). Content collections
  moved to `src/content.config.ts` with `glob()` loaders. The custom
  remark/rehype plugins are kept through the `unified()` processor from
  `@astrojs/markdown-remark`. `compressHTML: true` preserves whitespace in
  ASCII art. Rendered pages are unchanged apart from one corrected quote mark.
- **Node 22.12+** is now required.
- **Puppeteer 24 → 25.** Its Chrome download now needs `unzip` on the PATH.
- **Go modules:** `x/crypto` v0.58.0, `x/net` v0.62.0, `x/text` v0.44.0,
  `x/sys` v0.50.0, `goldmark` v1.8.7, `bubbletea` v1.3.10. **Go 1.26+** is now
  required to build the SSH BBS.
- The search index is now in article order.
- Zine articles (`src/content/issues/vol*/`), `CLAUDE.md` and local notes are
  no longer tracked in git. Builds need the content present locally.

### Added

- `docs/ADMIN.md`: security audit steps (`npm audit`, `govulncheck`) and
  systemd hardening options for the SSH BBS.
- `docs/DEVELOPMENT.md`: running the zine export on NixOS.
- `docs/CONTRIBUTING.md`: `.mdx` submissions are reviewed as code.
- This changelog.

## 2026-02-14

### Added

- Print zine export: `npm run zine` produces a half-letter reader PDF and a
  saddle-stitch booklet PDF (`scripts/export-zine.js`).

### Fixed

- Page-break problems and loose spacing in the print zine.

## 2026-02-13

### Fixed

- The volume archive now populates automatically from the content.
- Colors now render in the SSH BBS when the server runs without a TTY.

## 2026-02-12

### Added

- First release: a static hacker e-zine site built with Astro, styled as a 90s
  BBS terminal with keyboard navigation, a command prompt, search, and a CRT
  effect.
- Pager-style keyboard scrolling, project docs and README.
- Print-line animation for the logo, and a template for media embeds.
- ANSI text endpoints (`.txt`) so the zine can be read with `curl`.
- SSH BBS: an interactive terminal version of the zine over SSH (`ssh/`).

### Security

- SSH BBS hardening: per-IP rate limiting, username length guard and
  sanitizing, initial terminal-size clamping, navigation stack cap, content
  directory containment, file size limit, idle and session timeouts.
