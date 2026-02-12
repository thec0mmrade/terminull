```
 ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗██╗   ██╗██╗     ██╗
 ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██║   ██║██║     ██║
    ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║██║   ██║██║     ██║
    ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██║   ██║██║     ██║
    ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║╚██████╔╝███████╗███████╗
    ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝
```

**A hacker e-zine in the spirit of the underground.**

terminull is a static website that simulates a 1990s BBS terminal. It publishes
technical deep-dives, security research, tool breakdowns, ASCII art, and
creative writing for the hacker community. No tracking, no ads, no paywalls.

---

## Features

- **BBS terminal aesthetic** -- VT323 pixel font, CRT scanline effect, connection sequence, box-drawing frames
- **Keyboard-first navigation** -- `j`/`k` movement, number keys for quick jump, vim-style bindings
- **Command prompt** -- `read`, `ls`, `cd`, `search`, `vol`, `crt`, and more
- **Glow-inspired markdown** -- Article rendering styled after [Charmbracelet Glow](https://github.com/charmbracelet/glow) with gold headings, cyan sections, green blockquotes, pink inline code
- **Admonitions** -- `[!WARN]`, `[!HACK]`, `[!INFO]` callout blocks for security content
- **Zero JS required** -- Core content is pure static HTML/CSS. Interactive features are progressive enhancements
- **Search** -- Build-time index, client-side filtering across titles, tags, authors, and categories
- **ANSI art support** -- Render ANSI escape-coded art files alongside standard ASCII art
- **Terminal-native reading** -- Every article has a `.txt` endpoint with ANSI colors, readable via `curl URL | less -R`
- **SSH BBS** -- Full interactive TUI over SSH with vim navigation, scrollable viewports, and Glamour-rendered markdown

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/terminull.git
cd terminull
npm install
npm run dev
```

Open `http://localhost:4321`. Navigate with keyboard or the command prompt at the bottom.

## Commands

```
npm run dev       # Start dev server with hot reload
npm run build     # Production build to dist/ (~800ms)
npm run preview   # Serve the built site locally
```

## Project Structure

```
terminull/
├── src/
│   ├── content/
│   │   ├── issues/_templates/  # Template articles (drafts)
│   │   └── pages/             # Static pages (about, manifesto)
│   ├── components/            # Astro components (15 files)
│   ├── layouts/               # BaseLayout, ArticleLayout, IssueLayout
│   ├── pages/                 # Route files
│   ├── assets/styles/         # CSS (colors, terminal, glow-markdown, etc.)
│   ├── lib/                   # Search index, ANSI text rendering
│   └── plugins/               # Remark/rehype plugins
├── ssh/                       # Go SSH BBS server
│   ├── content/               # Content loader, frontmatter parser, search
│   ├── ui/                    # Bubble Tea screens, components, theme
│   ├── art/                   # Embedded ASCII logo
│   ├── main.go                # Entry point (Wish SSH server)
│   └── config.go              # Env/flag configuration
├── public/
│   ├── art/                   # ASCII/ANSI art files
│   └── fonts/                 # IBM Plex Mono (self-hosted)
├── docs/                      # Documentation
└── .github/workflows/         # GitHub Pages deployment
```

## Reading in a Terminal

Every page has an ANSI-colored `.txt` counterpart, built at compile time:

```bash
# Homepage
curl https://your-site/index.txt

# Volume table of contents
curl https://your-site/vol/1/index.txt

# Read an article with color
curl https://your-site/vol/1/01-smashing-the-stack.txt | less -R
```

The text endpoints mirror the BBS chrome (logo, system info, box frames) using xterm-256 ANSI escape codes. No browser needed.

## SSH Access

terminull also runs as a full interactive BBS over SSH:

```bash
ssh terminull.local -p 2222
```

You get a TUI with the same visual identity -- connection animation, ASCII logo, vim-style navigation (j/k/g/G), scrollable article reader, live search, and Glamour-rendered markdown. Each SSH session runs in alt-screen mode.

### Running the SSH server

```bash
cd ssh
go build .              # Requires Go 1.23+
./terminull-ssh         # Starts on :2222
```

Configuration via environment variables or flags:

| Variable | Flag | Default |
|----------|------|---------|
| `TERMINULL_PORT` | `--port` | 2222 |
| `TERMINULL_HOST` | `--host` | 0.0.0.0 |
| `TERMINULL_CONTENT_DIR` | `--content-dir` | ../src/content |
| `TERMINULL_SITE_URL` | `--site-url` | https://terminull.local |
| `TERMINULL_HOST_KEY` | `--host-key` | ./ssh_host_ed25519_key |

The host key is auto-generated on first run.

## Writing Articles

Articles are markdown files in `src/content/issues/vol{N}/`:

```yaml
---
title: "Smashing the Stack in 2025"
author: "Sarah Chen"
handle: "stacksmash3r"
date: 2025-06-15
volume: 1
order: 1
category: guide
tags: [exploitation, buffer-overflow, x86]
description: "A modern guide to buffer overflow exploitation."
draft: false
---
```

Categories: `editorial`, `guide`, `writeup`, `tool`, `security-news`, `ascii-art`, `fiction`, `interview`

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full writing guide.

## Documentation

| Document | Audience |
|----------|----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Developers -- technical internals, rendering pipeline, component system |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Authors -- article format, markdown features, submission workflow |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Forkers -- customization, theming, extending the platform |
| [EDITING.md](docs/EDITING.md) | Editors -- reviewing, publishing, volume management |
| [ADMIN.md](docs/ADMIN.md) | Admins -- deployment, DNS, dependencies, security |

## Tech Stack

### Web (Astro)

| Dependency | Purpose |
|------------|---------|
| [Astro 5](https://astro.build) | Static site generator |
| [@astrojs/mdx](https://docs.astro.build/en/guides/integrations-guide/mdx/) | MDX content collections |
| [ansi_up](https://github.com/drudru/ansi_up) | ANSI escape code rendering |
| [unist-util-visit](https://github.com/syntax-tree/unist-util-visit) | AST traversal for remark/rehype plugins |
| [marked](https://github.com/markedjs/marked) | Markdown parser for ANSI text endpoints |
| [marked-terminal](https://github.com/mikaelbr/marked-terminal) | Renders markdown as ANSI escape sequences |

### SSH BBS (Go)

| Dependency | Purpose |
|------------|---------|
| [Wish](https://github.com/charmbracelet/wish) | SSH server framework |
| [Bubble Tea](https://github.com/charmbracelet/bubbletea) | TUI framework |
| [Glamour](https://github.com/charmbracelet/glamour) | Terminal markdown rendering |
| [Lip Gloss](https://github.com/charmbracelet/lipgloss) | Terminal styling |
| [Bubbles](https://github.com/charmbracelet/bubbles) | TUI components (viewport, text input) |

## Deployment

terminull builds to a static `dist/` directory. Deploy it anywhere:

```bash
npm run build
# Upload dist/ to any static host
```

GitHub Pages deployment is preconfigured in `.github/workflows/deploy.yml`.
Works out of the box with Cloudflare Pages, Netlify, Vercel, or any web server.

## License

This project is open source. The content (articles, art, text) and the code
(templates, styles, components) may have different terms -- check individual
files for attribution.

---

*The terminal never died. It was just waiting for you to connect.*
