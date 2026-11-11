# Changelog

Notable changes to terminull. The project has no tagged releases yet, so
entries are grouped by date. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-11-11

### Added

- **ANSI art articles.** Drop a classic `.ANS` file into a volume folder,
  named like an article (`11-xibalba.ans`), and it becomes one. Title, artist,
  group and date are read from the file's SAUCE record.
  - **Web:** the piece draws in cell by cell at 9600 baud, in the IBM VGA 9x16
    font on an exact 80-column grid with the VGA palette. The view follows the
    drawing edge, normal scrolling works throughout, and the drawing pauses
    while the tab is hidden.
  - **SSH BBS:** the same draw-in in the terminal, pausing while help or
    search covers it. Needs an 80-column terminal.
  - **`.txt` endpoint:** the art in 24-bit VGA colours, with a `pv` hint for
    the draw-in.
  - **Print zine:** greyscale, in the VGA font, across as many pages as
    needed.
  - Files wider than 80 columns, with blinking text, or with cursor
    repositioning are skipped with a warning.
- Web437 IBM VGA 9x16 font from the Ultimate Oldschool PC Font Pack
  (CC BY-SA 4.0, license included in `public/fonts/`).

### Changed

- An article's `date` may be absent for ANSI art without a dated SAUCE record.
  It is still required for written articles.
- The zine exporter now imports `src/lib/ansi-art.js`; it is no longer a
  single self-contained file.

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

### Fixed

- IBM Plex Mono now loads. Both files in `public/fonts/` were saved HTML pages
  rather than fonts, so the site and the print zine fell back to a system
  monospace font. Replaced with the real woff2 files from `@ibm/plex-mono`
  2.5.0 (SIL Open Font License, included alongside).

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
