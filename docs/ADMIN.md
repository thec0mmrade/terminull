# Administration

Guide for maintaining the terminull site infrastructure.

See also: [EDITING.md](./EDITING.md) | [DEVELOPMENT.md](./DEVELOPMENT.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Deployment Pipeline

### Current Setup: GitHub Pages

The pipeline is defined in `.github/workflows/deploy.yml`. It triggers on:

- **Push to `main`** -- automatic deploy on every merge
- **`workflow_dispatch`** -- manual trigger for redeployment without code changes

### Pipeline Steps

```
Checkout → Node 20 setup (npm cache) → npm ci → npm run build → Upload artifact → Deploy to GitHub Pages
```

Two jobs: `build` produces the artifact, `deploy` publishes it.

### Required GitHub Repo Settings

The workflow declares these permissions:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

In your repo's Settings > Pages, set the source to **GitHub Actions** (not
"Deploy from a branch").

The `concurrency` block (`group: pages`, `cancel-in-progress: false`) ensures
only one deployment runs at a time and in-progress deploys are not cancelled.

### GitHub Pages Hardening

1. **Branch protection on `main`**: Require pull request reviews before merge.
   Prevents direct pushes that bypass review (including malicious content files
   that could affect the SSH BBS loader).
2. **Environment protection rules**: In Settings > Environments > `github-pages`,
   enable required reviewers for production deploys if needed.
3. **Limit Actions permissions**: The workflow only needs `contents: read`,
   `pages: write`, and `id-token: write`. Do not grant broader permissions.
4. **Pin Action versions**: The workflow should pin actions to commit SHAs
   rather than tags to prevent supply chain attacks:
   ```yaml
   - uses: actions/checkout@<commit-sha>     # instead of @v4
   - uses: actions/setup-node@<commit-sha>   # instead of @v4
   ```
5. **Custom domain**: If using a custom domain, enable **Enforce HTTPS** in
   Settings > Pages. Add a `CNAME` file to `public/` so Astro includes it in
   `dist/`.
6. **`site` URL mismatch**: `astro.config.mjs` currently has
   `site: 'https://terminull.pages.dev'` (Cloudflare Pages URL). If deploying
   to GitHub Pages, update this to your GitHub Pages URL so canonical URLs,
   Open Graph tags, and sitemap are correct.

### Manual Deploy

Use the `workflow_dispatch` trigger in GitHub Actions (Actions tab > "Deploy to
GitHub Pages" > "Run workflow"). Useful for redeploying after a GitHub Pages
issue without pushing a code change.

### Deploying to Vercel

Vercel auto-detects Astro projects. No `vercel.json` needed for basic setup.

**Setup:**

1. Import the repo at vercel.com/new
2. Vercel detects Astro, sets build command (`npm run build`) and output
   directory (`dist/`) automatically
3. Set the `site` value in `astro.config.mjs` to your Vercel domain

**Hardening:**

1. **Environment variables**: If you add env vars, use Vercel's encrypted
   environment variables (Settings > Environment Variables). Never commit
   secrets to the repo.
2. **Deployment protection**: Enable Vercel Authentication or password
   protection on preview deployments to prevent leaking draft content on
   preview URLs.
3. **Production branch**: Lock production deployments to the `main` branch
   only (Settings > Git > Production Branch).
4. **Headers**: Add a `vercel.json` for security headers:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
         ]
       }
     ]
   }
   ```
5. **Preview URL access**: By default, every push creates a preview deployment
   with a public URL. Disable preview deployments or restrict access if draft
   articles should not be publicly visible before merge.

### Alternative Hosts

terminull builds to a static `dist/` directory. It works on any static host:

| Host             | Build command    | Output dir | Notes                              |
|------------------|------------------|------------|------------------------------------|
| GitHub Pages     | `npm run build`  | `dist/`    | Current setup, via Actions         |
| Cloudflare Pages | `npm run build`  | `dist/`    | Set in dashboard or `wrangler`     |
| Netlify          | `npm run build`  | `dist/`    | Set in `netlify.toml` or dashboard |
| Vercel           | `npm run build`  | `dist/`    | Auto-detected from Astro           |
| nginx            | `npm run build`  | `dist/`    | Copy `dist/` to web root           |

No SSR, no edge functions, no server runtime. Any host that serves static
files works.

---

## Domain and DNS

Two files contain the site URL:

| File                   | Line | Value                                        |
|------------------------|------|----------------------------------------------|
| `astro.config.mjs`    | 40   | `site: 'https://terminull.pages.dev'`        |
| `public/robots.txt`   | 4    | `Sitemap: https://terminull.pages.dev/sitemap-index.xml` |

The `site` value in `astro.config.mjs` affects:

- Canonical URLs generated by `src/components/Seo.astro:10`
- Open Graph `og:url` tags
- Sitemap URLs (auto-generated by Astro at `/sitemap-index.xml`)

### Changing the Domain

1. Update `site` in `astro.config.mjs:40`
2. Update the sitemap URL in `public/robots.txt:4`
3. Rebuild and deploy

Both files must match. If they diverge, canonical URLs and the robots.txt
sitemap pointer will point to different domains.

---

## Dependency Management

### Current Dependencies

Six runtime dependencies and two dev dependencies:

| Package            | Version   | Purpose                                |
|--------------------|-----------|----------------------------------------|
| `astro`            | `^5.17.1` | Static site generator                  |
| `@astrojs/mdx`     | `^4.3.13` | MDX support for content collections    |
| `ansi_up`          | `^6.0.6`  | ANSI escape code to HTML conversion    |
| `unist-util-visit`  | `^5.1.0`  | AST traversal for remark/rehype plugins |
| `marked`           | `^15`     | Markdown parser for ANSI text rendering |
| `marked-terminal`  | `^7`      | Renders markdown as ANSI escape sequences |
| `puppeteer`        | `^24`     | Headless Chrome for PDF generation (dev) |
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

Astro auto-generates a sitemap at `/sitemap-index.xml`. This is referenced in
`public/robots.txt:4`. No manual sitemap maintenance needed -- it updates on
every build.

### robots.txt

```
User-agent: *
Allow: /

Sitemap: https://terminull.pages.dev/sitemap-index.xml
```

Allows all crawlers. The sitemap URL must match the `site` value in
`astro.config.mjs`.

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
| PTY size abuse      | Client-supplied dimensions clamped: width ∈ [40, 300], height ∈ [10, 100]. Prevents excessive memory allocation in rendering. |
| Session exhaustion  | Idle timeout: 10 minutes. Max session: 2 hours (`WithIdleTimeout`, `WithMaxTimeout`). |
| Stack exhaustion    | Screen navigation stack capped at 20. At max depth, new screens replace the top instead of pushing. |
| Content dir escape  | Symlinks resolved via `filepath.EvalSymlinks`; files resolving outside the content directory are rejected. |
| Large file OOM      | Files >1MB skipped by the content loader (`maxFileSize = 1 << 20`). |

**Firewall**: Only expose port 2222/tcp (or your configured SSH port). The
server does not need any other inbound ports.

**Host key**: Auto-generated on first run at `./ssh_host_ed25519_key`. Back
up this file -- changing it will cause SSH client warnings for returning users.
Override with `--host-key` flag or `TERMINULL_HOST_KEY` env var.

### SSH BBS Deployment

The SSH server is a long-running Go process. It cannot run on static hosts.

**systemd (VPS)**:

```ini
[Unit]
Description=terminull SSH BBS
After=network.target

[Service]
Type=simple
User=terminull
WorkingDirectory=/opt/terminull/ssh
ExecStart=/opt/terminull/ssh/terminull-ssh --port 2222 --content-dir /opt/terminull/src/content
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Docker**:

```dockerfile
FROM golang:1.24 AS build
WORKDIR /app
COPY ssh/ .
RUN go build -o terminull-ssh .

FROM debian:bookworm-slim
COPY --from=build /app/terminull-ssh /usr/local/bin/
COPY src/content /content
EXPOSE 2222
CMD ["terminull-ssh", "--content-dir", "/content"]
```

**Fly.io**: Supports TCP services natively. Expose port 2222 in `fly.toml`
with `[[services]]` type `tcp`. Free tier may suffice for low traffic.

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

Check the deployment URL directly. For GitHub Pages, this is typically
`https://{username}.github.io/{repo}/` or a custom domain.

### Verify Build Health

Check the GitHub Actions run status at:
```
https://github.com/{owner}/{repo}/actions
```

A failed build prevents deployment -- the previous version stays live.

### Verify Content

`/search-index.json` reflects all published (non-draft) articles. Fetch it
after a deploy to confirm new articles appear:

```bash
curl -s https://your-site.example/search-index.json | python3 -m json.tool | head -20
```

---

## Backup and Recovery

### Source of Truth

All content is in git. The repository is the single source of truth.

`dist/` is generated output and should not be committed (it's in `.gitignore`).

### Full Restore

```bash
git clone https://github.com/{owner}/terminull.git
cd terminull
npm ci
npm run build
# dist/ now contains the full site, ready to deploy
```

### Rollback a Deploy

If a bad deploy goes out:

1. Revert the commit on `main`:
   ```bash
   git revert HEAD
   git push
   ```
2. The pipeline re-triggers and deploys the reverted state.

Alternatively, use the GitHub Actions UI to re-run a previous successful
workflow.

### What's Not in Git

- GitHub Actions secrets (API tokens, deployment credentials)
- DNS configuration (managed at your registrar or DNS provider)
- GitHub repo settings (Pages source, branch protection rules)

Document these separately if you have co-administrators.
