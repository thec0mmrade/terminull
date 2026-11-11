# Changelog

Notable changes to terminull. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html): each release is a
git tag `vX.Y.Z`, and the version in `package.json` is what the site, the
`.txt` endpoints, the print zine and the SSH BBS show. Changes from before
1.0.0 were not versioned and are grouped by date. How to cut a release:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#releasing).

## [Unreleased]

### Changed

- "Connecting to …" and "Node: …" now show the site's real hostname (the host
  of `TERMINULL_SITE_URL`) instead of `terminull.local`: in the web page's
  connection sequence and system info box, the `.txt` endpoints and the SSH
  BBS. Without `TERMINULL_SITE_URL` they still say `terminull.local`.

### Fixed

- **SSH BBS:** a long username no longer pushes the system info box's right
  border out of line. The username is shortened with "…", and on narrow
  terminals the node moves to its own line.

## [1.0.0] - 2026-11-11

The first versioned release.

### Added

- **Version tracking.** `package.json` holds the version (SemVer). The web
  and `.txt` footers, the print zine's back cover and the SSH BBS footer all
  show it (the BBS gets it stamped in when publish builds it), and each
  release's `RELEASE` file on the server records it as `engine_version`.
  `npm test` fails if the version has no section in this changelog.

- **Security headers.** Caddy now sends HSTS, a Content-Security-Policy
  (scripts only from the site itself; frames only from YouTube),
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` and cross-origin isolation headers, and hides its
  `Server` header.
- **VT323 is self-hosted.** The site no longer loads anything from Google
  Fonts, so Google no longer sees visitors' IP addresses. The font's SIL Open
  Font License is in `public/fonts/`.
- **Server setup playbook.** `deploy/ansible/` configures a fresh Debian 13
  server end to end and is safe to re-run: packages, users, firewall, admin
  sshd on port 2200, Caddy, the BBS service and its sudo rule, and optionally
  a restored BBS host key. See `docs/DEPLOY.md`.
- The playbook upgrades and reboots into a patched kernel and refuses to
  continue on one vulnerable to CVE-2026-98432 (Debian 13: below
  `6.12.113-1`). Unattended upgrades now reboot at 04:00 when needed.
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
- **`npm run publish`.** One command builds the zine PDFs, the site and a
  static Linux BBS binary, uploads them to your server as a new release,
  switches over, checks HTTPS and the SSH banner, and rolls back by itself if
  the check fails. `--dry-run` shows the plan without touching the server;
  `--config <path>` uses another config file.
- `deploy.env` holds the deploy settings (gitignored); copy
  `deploy.env.example` to start.
- **Server setup guide.** `docs/DEPLOY.md` walks through the one-time server
  setup, with templates in `deploy/` for Caddy, the BBS systemd unit and
  sudoers.
- Each volume's table of contents links its zine PDFs.
- `npm test` runs the test suite.

### Changed

- The footers say **"no analytics"** instead of "no tracking", on the
  website, the `.txt` endpoints, the print zine, the SSH BBS and the
  manifesto. There are no analytics, cookies or third-party scripts, but the
  SSH BBS logs each connection and an article may embed images or video from
  other sites, so "no tracking" overclaimed. The homepage footnote now lists
  every JavaScript enhancement (keyboard nav, command prompt, search, ANSI art
  draw-in).
- Astro now emits every script as a file under `/_astro/` instead of inlining
  small ones (`vite.build.assetsInlineLimit: 0`), so the CSP can forbid inline
  scripts.
- `docs/CONTRIBUTING.md` says how to embed YouTube and what the CSP allows in
  articles.
- An article's `date` may be absent for ANSI art without a dated SAUCE record.
  It is still required for written articles.
- The zine exporter now imports `src/lib/ansi-art.js`; it is no longer a
  single self-contained file.
- **Volumes moved** to `src/content/volumes/`, a gitignored folder meant to
  hold your private content repo. `TERMINULL_VOLUMES_DIR` points elsewhere; the
  site, the zine export and the BBS (`--volumes-dir`) all use it.
- Article and volume templates moved to `src/content/templates/`.
- `npm run zine` writes to `public/zine/`; the build copies it into
  `dist/zine/`.
- One `TERMINULL_SITE_URL` setting gives the public URL for the site, `.txt`
  footers, the zine back cover and the BBS.
- `package.json` is now `"private": true`.

### Removed

- The GitHub Pages workflow.
- The `Sitemap` line in `robots.txt`; no sitemap is generated.

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
