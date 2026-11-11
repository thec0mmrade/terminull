# Administration

Guide for maintaining the terminull site infrastructure.

See also: [EDITING.md](./EDITING.md) | [DEVELOPMENT.md](./DEVELOPMENT.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Deployment

terminull is deployed to a single server that serves the website, the zine PDFs and the SSH BBS. Publishing is one command run from your laptop:

```bash
npm run publish
```

It checks that the content repo is committed and pushed, builds, uploads a new release, switches to it, verifies it and rolls back on failure. There is no CI deploy: a deploy is a deliberate local act.

The one-time server setup (OS, DNS, Caddy, the BBS systemd unit, firewall, users), the config file (`deploy.env`), manual rollback and host-key backup are all in [DEPLOY.md](./DEPLOY.md). The engine builds to a static `dist/` plus a Go binary, so it is not tied to any host, but only the server path is documented and supported.

---

## Domain and DNS

The public URL comes from one setting, `TERMINULL_SITE_URL` (in `deploy.env` for publishing, or in the environment for a local build). It is used by:

- Astro's `site`, hence canonical URLs (`src/components/Seo.astro`), Open Graph `og:url`
- the footer of the `.txt` endpoints
- the zine back cover
- the BBS (`--site-url` / `TERMINULL_SITE_URL`)

Without it, a neutral development default is used (`src/lib/site-url.js`). DNS itself is an `A`/`AAAA` record at your DNS provider; see [DEPLOY.md](./DEPLOY.md).

### Changing the Domain

1. Update `TERMINULL_SITE_URL` and `DEPLOY_HOST` in `deploy.env`
2. Update the hostname in the server's `/etc/caddy/Caddyfile` and the DNS record
3. If `DEPLOY_HOST` changed, ssh in once by hand (`ssh -p 2200 deploy@<new host>`) so the host key is in `known_hosts`: publish uses `BatchMode=yes` and will not prompt
4. `npm run publish`

---

## Dependency Management

### Current Dependencies

Six runtime dependencies and two dev dependencies:

| Package            | Version   | Purpose                                |
|--------------------|-----------|----------------------------------------|
| `astro`            | `^7.4.1`  | Static site generator                  |
| `@astrojs/mdx`     | `^8.1.0`  | MDX support for content collections    |
| `@astrojs/markdown-remark` | `^7.3.7` | unified (remark/rehype) Markdown processor, needed for the custom plugins |
| `ansi_up`          | `^6.0.6`  | ANSI escape code to HTML conversion    |
| `unist-util-visit`  | `^5.1.0`  | AST traversal for remark/rehype plugins |
| `marked`           | `^15`     | Markdown parser for ANSI text rendering |
| `marked-terminal`  | `^7`      | Renders markdown as ANSI escape sequences |
| `puppeteer`        | `^25.17`  | Headless Chrome for PDF generation (dev) |
| `pdf-lib`          | `^1.17`   | PDF page manipulation for booklet imposition (dev) |

No linter, no test runner, no formatter configured.

### Update Strategy

```bash
# Check for outdated packages
npm outdated

# Apply patch/minor updates
npm update

# Verify nothing broke
npm run build
```

### Security Audits

```bash
# npm: list advisories, apply non-breaking fixes
npm audit
npm audit fix

# Go (SSH BBS): update modules, then check reachable advisories
cd ssh
go get -u golang.org/x/crypto golang.org/x/net
go mod tidy
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

Rebuild and restart the SSH BBS after Go updates -- a running server keeps the
old binary. `ssh/go.mod` requires Go 1.26+.

As of 2026-11-10, `npm audit` reports 0 vulnerabilities after the Astro 7
upgrade. `github.com/charmbracelet/ssh` is pinned to a pseudo-version because
its tagged releases moved to the `charm.land/ssh` module path.

Astro 7 notes for this project (`astro.config.mjs`): the Markdown processor is
set to `unified()` from `@astrojs/markdown-remark` because the admonition and
code-header plugins are remark/rehype plugins, and `compressHTML: true` keeps
HTML whitespace rules for the ASCII art. Node 22.12+ is required.

### Astro Major Version Upgrades

Astro major versions may change the content collection API, config format, or
build behavior. Before upgrading:

1. Read the [Astro migration guide](https://docs.astro.build) for the target
   version
2. Check for breaking changes to `getCollection()`, `getStaticPaths()`,
   content collection `id` format, and `defineConfig()`
3. Run `npm run build` and verify all pages render correctly
4. Test the slug extraction pattern -- Astro has changed the `id` format
   between major versions

---

## Build and Performance

### Build Characteristics

- **Build time:** ~800ms for 11 pages (scales linearly with article count)
- **Output:** pure static HTML/CSS/JS in `dist/`
- **No SSR, no edge functions, no database**

### Cache Considerations

All pages are static HTML and can be aggressively cached (long `Cache-Control`
max-age or immutable).

Exceptions: `/search-index.json` and `.txt` endpoints should be revalidated
on deploy. They reflect the current set of published (non-draft) articles. If
a CDN caches them with a long TTL, newly published articles won't appear in
search or text endpoints until the cache expires.

---

## SEO

### Meta Tag Generation

`src/components/Seo.astro` generates these tags for every page:

| Tag                    | Value                                                |
|------------------------|------------------------------------------------------|
| `<title>`              | `{title} // terminull` (homepage: just `terminull`)  |
| `meta description`     | Page description or default fallback                 |
| `link canonical`       | Full URL from `Astro.site` + pathname                |
| `og:type`              | `website` (default) or `article`                     |
| `og:title`             | Same as `<title>`                                    |
| `og:description`       | Same as meta description                             |
| `og:url`               | Same as canonical URL                                |
| `og:site_name`         | `terminull`                                          |
| `og:image`             | Only if `image` prop is passed (currently unused)    |
| `twitter:card`         | `summary`                                            |
| `twitter:title`        | Same as `<title>`                                    |
| `twitter:description`  | Same as meta description                             |
| `theme-color`          | `#050505`                                            |

### Sitemap

No sitemap is generated, and `robots.txt` does not reference one.

### robots.txt

```
User-agent: *
Allow: /
```

Allows all crawlers.

### Not Implemented

- **JSON-LD structured data** -- no `<script type="application/ld+json">` for
  articles. Potential improvement for search engine rich results.
- **`og:image`** -- the prop exists in `Seo.astro` but no pages pass it.
  Adding default social preview images would improve link sharing.

---

## Security Considerations

### Attack Surface

terminull is a static site. There is no user input at runtime, no server, no
database, no authentication.

| Vector          | Status                                                      |
|-----------------|-------------------------------------------------------------|
| XSS/injection   | Build-time only. Markdown processed through remark/rehype and Shiki server-side. No runtime HTML injection path. |
| ANSI art         | `ansi_up` processes ANSI art files at build time via `AnsiArt.astro`. No runtime processing. |
| Search           | Client-side JS fetches `/search-index.json` (same-origin, no auth). User input is used for substring matching only, not rendered as HTML. |
| Storage          | `localStorage` stores CRT toggle preference (`terminull-crt`). No sensitive data. |
| Cookies          | None.                                                       |
| Analytics        | None. No tracking by design.                                |
| Third-party JS   | None.                                                       |

### SSH BBS Attack Surface

The SSH server (`ssh/`) accepts arbitrary connections from the internet and
has a significantly larger attack surface than the static site.

| Vector              | Mitigation                                                     |
|---------------------|----------------------------------------------------------------|
| Connection flood    | `wish/ratelimiter` middleware: 1 conn/sec sustained, burst 10, 256-IP LRU. Exceeding the limit rejects the connection. |
| Username abuse      | Middleware rejects usernames >64 bytes before the TUI starts. Display names sanitized: ANSI escapes stripped, non-printable chars removed, truncated to 32 chars. |
| PTY size abuse      | Client-supplied dimensions clamped to width ∈ [40, 300], height ∈ [10, 100], both at session start and on every later window-change (`types.ClampSize`). Markdown is re-rendered only when the wrap width changes, so a resize flood stays cheap. |
| Session exhaustion  | Idle timeout: 10 minutes. Max session: 2 hours (`WithIdleTimeout`, `WithMaxTimeout`). Concurrent sessions capped at 100 (`--max-sessions` / `TERMINULL_MAX_SESSIONS`); extra connections get "server full". |
| Log injection       | Connection logs write the username, TERM and client version with `%q`, so control characters and newlines are escaped and each event stays on one line. |
| Terminal escapes in content | The content loader strips C0 control characters (except newline and tab) from article bodies and frontmatter before they reach client terminals. The `.txt` endpoints do the same for article bodies. |
| Stack exhaustion    | Screen navigation stack capped at 20. At max depth, new screens replace the top instead of pushing. |
| Content dir escape  | Symlinks resolved via `filepath.EvalSymlinks`; files resolving outside the content directory are rejected. |
| Large file OOM      | Files >1MB skipped by the content loader (`maxFileSize = 1 << 20`). |

**Firewall**: expose only the BBS port (22 on the server; `BBS_PORT`), 80 and 443 for Caddy, and the admin sshd port. See [DEPLOY.md](./DEPLOY.md).

**Host key**: the BBS generates it on first start. On the server it lives at `/srv/terminull/shared/ssh_host_ed25519_key`, outside the release directories so it survives publishes. Back it up (see [DEPLOY.md](./DEPLOY.md)): changing it causes SSH client warnings for returning users. Override with `--host-key` or `TERMINULL_HOST_KEY`.

### SSH BBS Deployment

The SSH server is a long-running Go process. `npm run publish` builds it as a static Linux binary, uploads it with each release, and restarts the `terminull-bbs` systemd unit. The unit ([`deploy/terminull-bbs.service`](../deploy/terminull-bbs.service)) runs it as the unprivileged `terminull` user on port 22 through `CAP_NET_BIND_SERVICE`, with this hardening:

| Setting | Effect |
|---------|--------|
| `NoNewPrivileges=true` | the process cannot gain privileges |
| `ProtectSystem=strict` | the filesystem is read-only except `ReadWritePaths` |
| `ProtectHome=true` | `/home` is not visible |
| `PrivateTmp=true` | private `/tmp` |
| `ReadWritePaths=/srv/terminull/shared` | only the host key directory is writable |
| `CapabilityBoundingSet=CAP_NET_BIND_SERVICE` | no other capability, even if the process is compromised |
| `MemoryMax=512M` | bounds a memory-exhaustion bug: systemd restarts the service instead of the host swapping |

Its configuration is the `bbs.env` file that publish writes into each release (site URL, port, content and volumes paths, host key path). For running the BBS locally, see [DEVELOPMENT.md](./DEVELOPMENT.md).

### External Requests

The only external request is **Google Fonts** (VT323), loaded via a `<link>`
tag in `BaseLayout.astro`. This means:

- Google receives the visitor's IP on every page load
- Google's font CSS and woff2 files are loaded from `fonts.googleapis.com` and
  `fonts.gstatic.com`

To eliminate this, self-host VT323: download the woff2 file, add it to
`public/fonts/`, add an `@font-face` declaration in `global.css`, and remove
the Google Fonts `<link>` from `BaseLayout.astro`.

---

## Monitoring

### No Built-In Analytics

By design, terminull has no analytics, no error tracking, and no third-party
monitoring. The footer says "no tracking" and means it.

### Verify the Site Is Live

`npm run publish` verifies HTTPS, that `/release.txt` names the new release, and the SSH banner itself after every switch. To check by hand:

```bash
curl -I https://terminull.example.com/
ssh terminull.example.com
ssh -p 2200 deploy@terminull.example.com cat /srv/terminull/current/RELEASE   # what is live
```

### Verify Build Health

`npm run build` and `npm test` locally. A failed publish never leaves a half-uploaded site live: the previous release stays in place (or is restored). The exception is the very first publish: with no previous release to return to, a release that fails verification stays live (see [DEPLOY.md](./DEPLOY.md)).

### Verify Content

`/search-index.json` reflects all published (non-draft) articles. Fetch it
after a deploy to confirm new articles appear:

```bash
curl -s https://your-site.example/search-index.json | python3 -m json.tool | head -20
```

---

## Backup and Recovery

### Source of Truth

Two git repos: the public engine repo, and your private content repo (the `vol*/` folders, cloned at `src/content/volumes/`). Publishing requires the content repo to be committed and pushed, so what is live is always backed up. `dist/` and `public/zine/` are generated output and gitignored.

### Full Restore

```bash
git clone <engine-repo-url> terminull
cd terminull
git clone <private-content-repo-url> src/content/volumes
npm ci
cp deploy.env.example deploy.env   # fill in
npm run publish
```

### Rollback a Deploy

Publish rolls back by itself if its verification fails. To return to an older release by hand, see "Manual rollback" in [DEPLOY.md](./DEPLOY.md). Alternatively, revert the content commit, push it, and publish again.

### What's Not in Git

- `deploy.env` (your host and site URL)
- the BBS host key on the server (`/srv/terminull/shared/ssh_host_ed25519_key`)
- DNS configuration (managed at your registrar or DNS provider)
- the server itself: users, firewall, Caddy and systemd configuration (rebuilt from [DEPLOY.md](./DEPLOY.md))

Document these separately if you have co-administrators.
