# Publishing and deployment workflow — design

Date: 2026-11-11. Status: ready for owner approval.

## Intent

The public `terminull` repo is an **engine**: a reusable BBS-style e-zine kit
that anyone can clone and run as their own zine, without first deleting the
owner's back issues. The owner's issues are one installation of that engine
and live elsewhere.

That split (made on 2026-11-10, when issue content was gitignored) left no way
to publish: the GitHub Pages workflow builds from the public repo, which has no
content; it triggers on `main` while the branch is `master`; and Pages was
never enabled. This design restores a publishing path that fits the split.

## Decisions made by the owner

- **Content lives in a separate private git repo**, so back issues are
  versioned and backed up while the engine repo stays content-free.
- **Hosting is one rented server (VPS)** serving the website, the zine PDFs
  and the SSH BBS. (Considered and rejected: free tiers, home hosting via
  Tailscale Funnel or port forwarding.)
- **The owner's home IP stays private.** Nothing is served from home.
- **The SSH BBS must be publicly reachable with a plain `ssh` client.**
- **Address: a `terminull.` subdomain of the owner's own domain.** The real hostname lives only in local config, never in git; docs use `terminull.example.com`.
- **Publishing is one command run from the laptop** that deploys everything.

## Goals

1. One command on the laptop takes the current content and engine live:
   website, `.txt` endpoints, search index, zine PDFs, and the SSH BBS.
2. Every published state is committed and pushed in the private content repo.
3. A failed publish leaves the previous version live and intact.
4. A forker can use the same tooling with their own domain, server and content
   repo, by configuration only.
5. The server is set up once from a written guide, with a hardened default.

## Non-goals

- Automatic deploys on `git push` (CI). Publishing is a deliberate local act.
- Draft previews or a staging site. `npm run dev` locally covers previewing.
- Multiple editors or review workflow tooling.
- Hosting at home or behind a tunnel.
- Zero-downtime BBS restarts. Connected users are dropped for a few seconds
  per publish; acceptable.

## Anti-goals (would be a failure even if it works)

- The owner's articles, art or PDFs appear in the public engine repo or its
  history.
- A half-uploaded site goes live (some pages new, some old, or broken links).
- The publish command needs secrets committed to the engine repo.
- The setup ties the engine to one hosting provider or to the owner's domain; a forker
  would have to edit code to point it elsewhere.

## Constraints and current state

- Engine: Astro 7 static build (`npm run build` → `dist/`), zine export
  (`npm run zine`, needs Chromium; on NixOS via `nix shell nixpkgs#chromium`),
  Go SSH BBS in `ssh/` (Go 1.26, built via `nix shell nixpkgs#go` on the
  owner's NixOS laptop).
- The BBS reads content from disk once at startup (`TERMINULL_CONTENT_DIR`,
  default `../src/content`), so new content needs a restart.
- Content currently sits in `src/content/issues/vol*/` (gitignored).
  `src/content/issues/_templates/` and `src/content/pages/{about,manifesto}.md`
  are tracked in the engine.
- The site's public URL is hard-coded in several disagreeing places:
  `astro.config.mjs` `site: 'https://terminull.pages.dev'`,
  `scripts/export-zine.js` back cover `https://terminull.net`,
  `ssh/config.go` default `https://terminull.local`, `src/lib/ansi-text.ts`
  footer `https://terminull.local`. (`terminull.local` in the connection
  banners is flavour text, not a URL, and stays.)
- `.github/workflows/deploy.yml` cannot work under the split.
- Existing BBS hardening (rate limit, session cap, size clamps, timeouts) is
  documented in `docs/ADMIN.md`, including a systemd unit.

## The design

### Content repo

- A private git repo holding `vol*/` folders exactly as they sit today
  (`.md`, `.mdx`, `.ans`, and any media they reference).
- On the laptop, the engine must see the volume folders at
  `src/content/issues/vol*/`, as it does today. *Builder's call:* how the
  checkout coexists with the tracked `_templates/` folder in the same directory
  (e.g. content repo checked out elsewhere and pointed to by a setting, or a
  checkout that contains only `vol*/`). Must keep `npm run dev` working
  without extra steps.

### Configuration (one place, no secrets in git)

A local, gitignored config file in the engine (e.g. `deploy.config` or
`.env.deploy`) with at least:

- public site URL (`https://terminull.example.com`),
- SSH destination for deploys (user, host, admin port),
- path to the content repo.

The site URL from this config feeds every place that prints the public URL
(Astro `site`, zine back cover, `.txt` footer, BBS `--site-url`). A committed
example file documents the keys. Without the config, local dev keeps working
with a neutral default.

### The publish command

`npm run publish` (name is the builder's call), run in the engine repo:

1. **Preflight:** config present; content repo has no uncommitted changes and
   nothing unpushed; SSH to the server works. Any failure stops here.
2. **Build:** `npm run build`; `npm run zine` for the newest volume (all
   volumes is the builder's call if cheap); compile the BBS for the server
   (`GOOS=linux`, server's arch, static binary).
3. **Upload to a new release directory** on the server (site, PDFs, content,
   BBS binary), never into the live one.
4. **Switch:** atomically point the live symlink at the new release, then
   restart the BBS service.
5. **Verify:** the site returns 200 over HTTPS, a known article page returns
   200, and the BBS port accepts an SSH handshake. Print the live URLs.
6. If verify fails, switch the symlink back to the previous release and
   restart the BBS. Keep the last few releases for manual rollback.

The zine PDFs are served from `/zine/` on the site, and each volume's table of
contents links its PDFs when they exist (*my call*).

The command's output says what it did in plain steps. The content repo's
commit hash is recorded in the release (e.g. a `RELEASE` file) so it is clear
what is live.

### Server (one-time setup, written guide in `docs/ADMIN.md`)

- Smallest server size; Debian or Ubuntu LTS.
- DNS: an `A` (and `AAAA` if IPv6 enabled) record for
  the site hostname → server.
- **Web server: Caddy** (*my call*: automatic HTTPS, minimal config) serving
  the live release's `dist/`, with correct content types for `.txt`
  (`text/plain; charset=utf-8`) so `curl | less -R` works.
- **BBS on port 22** (*my call*), so visitors type `ssh <site hostname>`.
  The server's own admin `sshd` moves to another port, key-only, no root
  login. The BBS listens on 22 via systemd capability
  (`AmbientCapabilities=CAP_NET_BIND_SERVICE`), not as root.
- BBS runs as a dedicated unprivileged user under the hardened systemd unit
  from `docs/ADMIN.md`, with a persistent host key outside the release
  directories (so the key does not change between releases).
- Firewall: allow 80, 443, 22 (BBS), the admin SSH port; deny the rest.
- Unattended security updates on.

### Engine repo cleanup

- Remove `.github/workflows/deploy.yml` (it cannot work without content), or
  replace it with a build check that runs against `_templates/`
  (*builder's call*; removal is fine).
- Update `README.md`, `docs/ADMIN.md`, `docs/EDITING.md` (including the stale
  "update the volumes array" step), `docs/DEVELOPMENT.md` and local
  `CLAUDE.md` to describe the engine/content split, the config file, the
  publish command and the server guide.
- `CHANGELOG.md` entry.

## Done by the owner (the guide walks through it)

- Creating the private content repo on GitHub and the server
  (account, billing, SSH key).
- Adding the DNS record at the domain's DNS provider.

## Left to the builder

- Command name, script language (Node, to match the repo, is the default).
- Exact config file format and key names.
- How the content checkout is wired in (see Content repo).
- Release directory layout and how many releases to keep.
- Whether the BBS binary is built on the laptop (default) or on the server.

## Settled with the owner

- `src/content/pages/about.md`, `manifesto.md` and the homepage message of the
  day in `src/pages/index.astro` are starter text a forker rewrites. They stay
  in the engine; only `vol*/` moves to the content repo.
