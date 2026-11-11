# Publishing and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command on the owner's laptop (`npm run publish`) builds the site, zine PDFs and SSH BBS from a private content repo and deploys them atomically to a single server.

**Architecture:** Volumes move out of the engine's tracked tree into a gitignored folder (`src/content/volumes/`, the owner's private repo checkout), configurable by one env var shared by Astro, the zine exporter and the Go BBS. A Node publish script reads a gitignored `deploy.env`, preflights, builds everything locally into a staging dir, rsyncs it to a new release directory on the server, flips a `current` symlink, restarts the BBS, verifies, and rolls back on failure. Caddy serves `current/site`; systemd runs `current/bin/terminull-ssh` on port 22.

**Tech Stack:** Node 22 (`node:test`, `node:child_process`, `node:net`), Astro 7, Go 1.26 (`go test`), rsync + OpenSSH, Caddy 2, systemd.

**Spec:** `docs/superpowers/specs/2026-11-11-publishing-deployment-design.md`

## Global Constraints

- **No sensitive values in git.** Server IPs/hostnames, usernames, ports, paths on the server, the content repo URL and the owner's domain live only in `deploy.env` (gitignored). Committed files use placeholders: `terminull.example.com`, `deploy`, `203.0.113.10` (RFC 5737 doc range). Host keys stay ignored (`ssh/.gitignore` already covers `ssh_host_*`).
- Everything a forker needs to change is configuration; no code edit is required to point the engine elsewhere.
- Child processes are spawned with argument arrays (`spawn`/`execFile`), never a shell string, so paths with spaces work and nothing is interpolated.
- `npm run dev` and `npm run build` keep working with no `deploy.env` and no env vars set.
- A failed publish leaves the previous release live.
- Node 22.12+, Go 1.26+. No new npm or Go dependencies.

## Review Focus

1. **`deploy.env` accidentally tracked** (e.g. `git add -f`) → preflight refuses to publish and says why. Test in Task 3.
2. **Content repo with no upstream, detached HEAD, or unpushed commits** → preflight fails with a message naming the repo and the fix (`git push`), never publishes. Test in Task 4.
3. **Upload interrupted** (network drop) → `current` untouched; the half-written release lacks its `RELEASE` file and is deleted on the next publish. Test (remote-command builder) in Task 5.
4. **First publish ever fails verification** → no previous release to roll back to; script reports the failure, leaves the new release in place for inspection, exits non-zero. Test in Task 5.
5. **Site URL entered with a trailing slash or as `http://`** → normalised (trailing slash stripped); non-`https` rejected unless the host is `localhost`. Test in Task 3.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/content/volumes/` | (gitignored) owner's private content repo checkout: `vol*/` |
| `src/content/templates/` | article templates (moved from `src/content/issues/_templates/`) |
| `src/lib/paths.js` | `volumesDir()` — single resolver for the volumes folder (Astro + zine) |
| `src/lib/site-url.js` | `siteUrl()` — normalised public URL from `TERMINULL_SITE_URL` |
| `scripts/publish.js` | orchestration (`npm run publish`) |
| `scripts/publish/config.js` | parse + validate `deploy.env` |
| `scripts/publish/preflight.js` | local checks before building |
| `scripts/publish/remote.js` | release naming + remote shell command builders |
| `scripts/publish/verify.js` | HTTP and SSH-banner checks |
| `scripts/publish/*.test.js` | `node:test` tests |
| `deploy.env.example` | committed placeholder config |
| `deploy/Caddyfile.example`, `deploy/terminull-bbs.service`, `deploy/sudoers.example` | server templates with placeholders |
| `docs/DEPLOY.md` | one-time server setup guide + publishing |

---

### Task 1: Move volumes to a configurable, gitignored folder

**Files:**
- Create: `src/lib/paths.js`, `ssh/content/loader_test.go`
- Move: `src/content/issues/_templates/` → `src/content/templates/` (`git mv`)
- Modify: `src/content.config.ts:10`, `scripts/export-zine.js:82,134-139`, `ssh/config.go`, `ssh/main.go:118`, `ssh/content/loader.go:73-110`, `.gitignore`

**Interfaces:**
- Produces: `volumesDir(): string` in `src/lib/paths.js` — absolute path from `process.env.TERMINULL_VOLUMES_DIR`, resolved against the repo root, default `<root>/src/content/volumes`.
- Produces (Go): `content.LoadStore(contentDir, volumesDir string) *Store` — volumes from `volumesDir/vol*/` (containment base = `volumesDir`), pages from `contentDir/pages`. `Config.VolumesDir` from `TERMINULL_VOLUMES_DIR` / `--volumes-dir`, default `../src/content/volumes`.
- Env var name `TERMINULL_VOLUMES_DIR` is shared by all three consumers.

- [ ] **Step 1: Write the failing Go test** `ssh/content/loader_test.go`:
  - `TestLoadStoreSeparateVolumesDir`: temp `content/pages/about.md` and temp `vols/vol2/01-x.md` (valid frontmatter, `volume: 2`); `LoadStore(content, vols)` → `len(Volumes)==1`, `Volumes[0].Number==2`, `len(Pages)==1`.
  - `TestLoadStoreMissingVolumesDir`: nonexistent volumes dir → no panic, `len(Volumes)==0`, pages still loaded.
- [ ] **Step 2: Run** `cd ssh && nix shell nixpkgs#go -c go test ./content/` — Expected: FAIL (too many arguments to `LoadStore`).
- [ ] **Step 3: Implement** the Go signature and config above; `main.go` passes `cfg.VolumesDir`.
- [ ] **Step 4: Run** the same command — Expected: PASS; also `go vet ./...` clean.
- [ ] **Step 5: Implement** `src/lib/paths.js`; `content.config.ts` uses `volumesDir()` as the glob base and `.ans` scan dir; `export-zine.js` uses it in `loadArticles` and volume discovery. `git mv src/content/issues/_templates src/content/templates`. In `.gitignore` replace `src/content/issues/vol*/` with `src/content/volumes/`.
- [ ] **Step 6: Move the owner's local content** (not tracked, no git effect): `mkdir -p src/content/volumes && mv src/content/issues/vol1 src/content/volumes/` and remove the now-empty `src/content/issues/`.
- [ ] **Step 7: Verify** `npm run build` → same page count as before the change (record it first) and `dist/vol/1/11-xibalba/index.html` exists. `TERMINULL_VOLUMES_DIR=/nonexistent npm run build` → succeeds with no volume pages. `git status --short` shows no file under `src/content/volumes/`.
- [ ] **Step 8: Commit** `git add -A src/content/templates src/content/issues src/lib/paths.js src/content.config.ts scripts/export-zine.js ssh .gitignore` — message "Move volumes to a configurable gitignored folder".

### Task 2: One public site URL; zine PDFs linked from the site

**Files:**
- Create: `src/lib/site-url.js`, `src/lib/site-url.test.js`
- Modify: `astro.config.mjs:41`, `src/lib/ansi-text.ts:260-267` and its 4 callers, `scripts/export-zine.js:940,1090`, `src/pages/vol/[volume]/index.astro`, `.gitignore`, `package.json` (`"test": "node --test"`)

**Interfaces:**
- Produces: `siteUrl(env = process.env): string` — `TERMINULL_SITE_URL` with trailing `/` stripped; default `https://terminull.local`.
- Produces: `buildFooter(site: string): string` — prints `site` instead of the hard-coded URL. Callers pass `siteUrl()`.
- Zine output dir becomes `public/zine/` (gitignored) so `astro build` copies PDFs into `dist/zine/`. File names unchanged: `terminull-vol{N}.pdf`, `terminull-vol{N}-booklet.pdf`.

- [ ] **Step 1: Write the failing test** `src/lib/site-url.test.js`: `siteUrl({})==='https://terminull.local'`; `siteUrl({TERMINULL_SITE_URL:'https://a.example.com/'})==='https://a.example.com'`.
- [ ] **Step 2: Run** `node --test src/lib/` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `siteUrl`; `astro.config.mjs` `site: siteUrl()`; `buildFooter(site)`; zine back cover prints `siteUrl()` only when `TERMINULL_SITE_URL` is set (omit the line otherwise); zine `outDir = public/zine`; add `public/zine/` to `.gitignore`.
- [ ] **Step 4: Run** `node --test src/lib/` — Expected: PASS.
- [ ] **Step 5: Implement** the volume TOC link: in `src/pages/vol/[volume]/index.astro`, at build time check `fs.existsSync('public/zine/terminull-vol{N}.pdf')` (and the booklet) and, when present, render a "Print edition: [reader PDF] [booklet PDF]" line linking `/zine/<file>`; nothing when absent.
- [ ] **Step 6: Verify** `npm run zine -- --volume 1` (NixOS Chromium command from `CLAUDE.md`), then `TERMINULL_SITE_URL=https://terminull.example.com npm run build`: `dist/zine/terminull-vol1.pdf` exists; `dist/vol/1/index.html` contains `/zine/terminull-vol1.pdf`; `dist/vol/1/index.txt` contains `https://terminull.example.com`; `grep -r "terminull.pages.dev\|terminull.net" src scripts astro.config.mjs` → nothing. Without the PDFs (`rm -r public/zine`), rebuild → TOC has no print line.
- [ ] **Step 7: Commit** — "Read the public site URL from one setting; link zine PDFs".

### Task 3: Deploy config file

**Files:**
- Create: `scripts/publish/config.js`, `scripts/publish/config.test.js`, `deploy.env.example`
- Modify: `.gitignore` (add `deploy.env`)

**Interfaces:**
- Produces: `parseEnvFile(text: string): Record<string,string>` — `KEY=VALUE` lines, `#` comments, blank lines, optional matching single/double quotes; no variable expansion; throws `Error('deploy.env line N: …')` on a malformed line.
- Produces: `loadDeployConfig(file = 'deploy.env'): DeployConfig` (throws with a plain message naming the missing key or file), where

```js
/** @typedef {{ siteUrl: string, host: string, user: string, sshPort: number,
 *   path: string, arch: 'amd64'|'arm64', bbsPort: number, keepReleases: number,
 *   volumesDir: string, env: Record<string,string> }} DeployConfig */
```

  Keys: `TERMINULL_SITE_URL` (required; https, or http only for `localhost`; normalised via `siteUrl`), `DEPLOY_HOST` (required), `DEPLOY_USER` (required), `DEPLOY_SSH_PORT` (default 22), `DEPLOY_PATH` (default `/srv/terminull`, must be absolute), `DEPLOY_ARCH` (default `amd64`), `BBS_PORT` (default 22), `KEEP_RELEASES` (default 5, min 2), `TERMINULL_VOLUMES_DIR` (default `src/content/volumes`). `env` holds all parsed keys for passing to child builds (so `PUPPETEER_EXECUTABLE_PATH` etc. can be set there too).

- [ ] **Step 1: Write failing tests** in `config.test.js`: quoted and unquoted values; comment/blank lines ignored; `"FOO"` with no `=` throws mentioning line number; missing `DEPLOY_HOST` throws mentioning `DEPLOY_HOST`; `TERMINULL_SITE_URL=https://x.example.com/` → `siteUrl==='https://x.example.com'`; `http://x.example.com` throws; `DEPLOY_PATH=relative` throws; defaults applied (`sshPort===22`, `keepReleases===5`).
- [ ] **Step 2: Run** `node --test scripts/publish/` — Expected: FAIL.
- [ ] **Step 3: Implement.** Write `deploy.env.example` with every key, a one-line comment each, placeholder values only (`terminull.example.com`, `deploy`, `2200`).
- [ ] **Step 4: Run** `node --test scripts/publish/` — Expected: PASS. `git check-ignore deploy.env` → prints `deploy.env`.
- [ ] **Step 5: Commit** — "Add deploy config file".

### Task 4: Publish script — preflight, build, stage

**Files:**
- Create: `scripts/publish/preflight.js`, `scripts/publish/preflight.test.js`, `scripts/publish.js`
- Modify: `package.json` (`"publish": "node scripts/publish.js"`)

**Interfaces:**
- Consumes: `loadDeployConfig`, `volumesDir` semantics, `siteUrl`.
- Produces: `checkContentRepo(dir: string): Promise<{ commit: string }>` — throws unless `dir` is a git repo on a branch with an upstream, `git status --porcelain` empty, and after `git fetch`, `git rev-list --count @{u}..HEAD` is `0`. Messages name `dir` and the fix.
- Produces: `checkConfigUntracked(repoRoot: string): void` — throws if `git ls-files --error-unmatch deploy.env` succeeds.
- Produces: `buildRelease(cfg: DeployConfig, stageDir: string, meta: {contentCommit: string, engineCommit: string, engineDirty: boolean}): Promise<void>` in `scripts/publish.js` creating:

```
stageDir/
  site/                 # dist/ (after zine → public/zine, then astro build)
  content/pages/        # copy of src/content/pages
  content/volumes/vol*/ # copy of cfg.volumesDir
  bin/terminull-ssh     # CGO_ENABLED=0 GOOS=linux GOARCH=cfg.arch go build -trimpath
  bbs.env               # TERMINULL_SITE_URL, TERMINULL_PORT=cfg.bbsPort, TERMINULL_HOST=0.0.0.0,
                        # TERMINULL_CONTENT_DIR=<path>/current/content,
                        # TERMINULL_VOLUMES_DIR=<path>/current/content/volumes,
                        # TERMINULL_HOST_KEY=<path>/shared/ssh_host_ed25519_key
  RELEASE               # written LAST at upload time (Task 5), not here
```

  Build order: `npm run zine -- --volume N` for every `vol*` found, then `npm run build`, then Go build. Child env = `process.env` + `cfg.env`. Stop on the first non-zero exit, before anything is uploaded.

- [ ] **Step 1: Write failing tests** `preflight.test.js` using real temp git repos (`git init`, a bare repo as upstream): clean + pushed → resolves with the HEAD hash; uncommitted file → rejects matching `/uncommitted/`; commit not pushed → rejects matching `/git push/`; no upstream → rejects matching `/upstream/`; not a git repo → rejects. `checkConfigUntracked` on a temp repo with `deploy.env` force-added → throws.
- [ ] **Step 2: Run** `node --test scripts/publish/` — Expected: FAIL.
- [ ] **Step 3: Implement** preflight, then `scripts/publish.js` with `--dry-run` (preflight + build + stage, prints the stage path and the remote steps it would run, uploads nothing). Each step prints one plain line (`[1/5] Checking content repo… ok (abc1234)`).
- [ ] **Step 4: Run** tests — Expected: PASS.
- [ ] **Step 5: Verify** with a scratch `deploy.env` (placeholder host) and the content repo from Task 8 or a temp clean repo: `npm run publish -- --dry-run` produces the stage tree above; `file <stage>/bin/terminull-ssh` reports a static Linux ELF for the configured arch; `<stage>/site/vol/1/index.html` exists.
- [ ] **Step 6: Commit** — "Add publish preflight and build".

### Task 5: Upload, switch, verify, roll back

**Files:**
- Create: `scripts/publish/remote.js`, `scripts/publish/remote.test.js`, `scripts/publish/verify.js`, `scripts/publish/verify.test.js`
- Modify: `scripts/publish.js`

**Interfaces:**
- Produces: `releaseName(date: Date, contentCommit: string): string` → `YYYYMMDD-HHMMSS-<7-char hash>` (UTC).
- Produces remote command builders (each returns one POSIX `sh` script string run via `ssh … sh -s` on stdin; every path is single-quoted with `'` escaped):
  - `prepareCommand(path, name)` — `mkdir -p releases/<name> shared`; delete any `releases/*` lacking a `RELEASE` file (unfinished uploads).
  - `finalizeCommand(path, name, releaseText)` — write `RELEASE` into the release dir.
  - `switchCommand(path, name)` — `ln -sfn releases/<name> current.tmp && mv -T current.tmp current && sudo systemctl restart terminull-bbs`.
  - `previousReleaseCommand(path)` — prints the release `current` pointed to before the switch (read before switching).
  - `pruneCommand(path, keep)` — remove all but the newest `keep` complete releases, never the `current` target.
- Produces: `checkHttp(url: string, timeoutMs = 10000): Promise<void>` (throws unless status 200) and `checkSshBanner(host: string, port: number, timeoutMs = 10000): Promise<void>` (throws unless the first line starts with `SSH-2.0-`).
- Upload: `rsync -a --delete --link-dest=../<previous>` (when one exists) `-e 'ssh -p <sshPort>'` `<stage>/` → `<user>@<host>:<path>/releases/<name>/`.

Flow in `publish.js` after Task 4's build: prepare → rsync → finalize → read previous → switch → verify (`checkHttp(siteUrl+'/')`, `checkHttp(siteUrl+'/vol/<newest>/')`, `checkSshBanner(cfg.host, cfg.bbsPort)` — BBS host is the site URL's hostname) → on success prune and print `Live: <siteUrl>` and `BBS: ssh <hostname>` (with ` -p <port>` when not 22); on failure, if a previous release exists switch back to it and exit 1 with "rolled back to <prev>", else exit 1 with "first release failed verification; left in place".

- [ ] **Step 1: Write failing tests**
  - `remote.test.js`: `releaseName(new Date('2026-11-11T09:05:03Z'),'abcdef1234')==='20261111-090503-abcdef1'`; builders quote a path containing a space and a `'`; `prepareCommand` output removes releases without `RELEASE` (run it with `sh` against a temp dir containing one complete and one incomplete release → only the complete one remains); `switchCommand` run in a temp dir (with `sudo systemctl…` replaced via an injectable `restart` argument defaulting to the sudo line) leaves `current` → new release; `pruneCommand(dir, 2)` with 4 complete releases keeps the newest 2 and the `current` target.
  - `verify.test.js`: local `http.createServer` returning 200 → resolves, 500 → rejects; local `net.createServer` writing `SSH-2.0-Go\r\n` → resolves, writing `HTTP/1.1` → rejects; closed port → rejects within the timeout.
- [ ] **Step 2: Run** `node --test scripts/publish/` — Expected: FAIL.
- [ ] **Step 3: Implement** `remote.js`, `verify.js` and the flow.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — "Add release upload, switch, verify and rollback".

### Task 6: Server templates, setup guide, docs

**Files:**
- Create: `deploy/terminull-bbs.service`, `deploy/Caddyfile.example`, `deploy/sudoers.example`, `docs/DEPLOY.md`
- Delete: `.github/workflows/deploy.yml`
- Modify: `README.md`, `docs/ADMIN.md` (deployment pipeline + SSH BBS deployment sections point to `docs/DEPLOY.md`; drop GitHub Pages/Vercel/Fly as the primary path), `docs/EDITING.md` (new-volume steps: folder in `src/content/volumes/`, no volumes array; publishing = `npm run publish`), `docs/DEVELOPMENT.md`, `docs/CONTRIBUTING.md`, `docs/ARCHITECTURE.md` (paths), local `CLAUDE.md`

**Pinned values:**
- Service unit: `User=terminull`, `EnvironmentFile=/srv/terminull/current/bbs.env`, `ExecStart=/srv/terminull/current/bin/terminull-ssh`, `AmbientCapabilities=CAP_NET_BIND_SERVICE`, `CapabilityBoundingSet=CAP_NET_BIND_SERVICE`, `ReadWritePaths=/srv/terminull/shared`, plus the existing hardening lines from `docs/ADMIN.md` (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `MemoryMax=512M`), `Restart=on-failure`. Comment at top: paths assume `DEPLOY_PATH=/srv/terminull`.
- Caddyfile: `terminull.example.com { root * /srv/terminull/current/site; file_server; encode gzip; @txt path *.txt; header @txt Content-Type "text/plain; charset=utf-8"; handle_errors { rewrite * /404.html; file_server } }` (the 404 rewrite only if `dist/404.html` exists — check; otherwise omit).
- sudoers: `deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart terminull-bbs`.
- `docs/DEPLOY.md` sections, in order: create server (smallest, Debian 13 or Ubuntu 24.04 LTS, add SSH key); DNS `A`/`AAAA` record; admin SSH to a non-22 port (`/etc/ssh/sshd_config.d/10-admin.conf`: `Port <admin>`, `PasswordAuthentication no`, `PermitRootLogin no`) — warn to open the new port in the firewall and test a second session before closing the first; users `deploy` (owns `/srv/terminull`) and `terminull` (system, no shell, read access to releases, owns `shared/`); `ufw` allow 80, 443, 22, admin port; `unattended-upgrades`; install Caddy from its official apt repo; install the three templates; private content repo setup (`git clone <private-url> src/content/volumes`); `cp deploy.env.example deploy.env`; first `npm run publish` (with the NixOS wrapper: `nix shell nixpkgs#go nixpkgs#chromium -c env -u LD_LIBRARY_PATH sh -c 'PUPPETEER_EXECUTABLE_PATH=$(which chromium) npm run publish'`); manual rollback (`ln -sfn releases/<name> current.tmp && mv -T current.tmp current && sudo systemctl restart terminull-bbs`); backing up `shared/ssh_host_ed25519_key`.
- All examples use placeholders only (see Global Constraints).

- [ ] **Step 1: Write the templates and docs.**
- [ ] **Step 2: Verify** `systemd-analyze verify deploy/terminull-bbs.service` (via `nix shell nixpkgs#systemd` if needed; warnings about missing paths on the laptop are expected, syntax errors are not); `nix shell nixpkgs#caddy -c caddy adapt --config deploy/Caddyfile.example` succeeds; `grep -rn -i "pages.dev\|terminull.net" README.md docs deploy` → nothing outside `docs/superpowers/`.
- [ ] **Step 3: Commit** — "Add server setup guide and templates; remove GitHub Pages workflow".

### Task 7: Changelog and secret scan

**Files:** Modify `CHANGELOG.md` (new dated entry: Added publish command, server guide; Changed volumes folder, templates path, zine output path, `TERMINULL_SITE_URL`, `TERMINULL_VOLUMES_DIR`; Removed GitHub Pages workflow).

- [ ] **Step 1: Write the changelog entry.**
- [ ] **Step 2: Secret scan of everything committed on the branch:** `git diff origin/master --name-only` reviewed; `git diff origin/master | grep -n -i -E '([0-9]{1,3}\.){3}[0-9]{1,3}|BEGIN .*PRIVATE KEY|password=|token='` → only RFC 5737 placeholders, if anything; then the same diff grepped for each value in `deploy.env` (`grep -F -f <(cut -d= -f2- deploy.env | tr -d "\"'" | grep -v "^$")`) → nothing; `git ls-files | grep -E 'deploy\.env$|ssh_host_|src/content/volumes|public/zine'` → nothing.
- [ ] **Step 3: Commit** — "Update changelog for publishing workflow". Do not push without the owner's go-ahead.

### Task 8: Owner setup and first live publish (with the owner)

Done together; each external action needs the owner's confirmation at the time.

- [ ] **Step 1: Content repo.** In `src/content/volumes/`: `git init`, commit `vol1/`. Owner creates the private GitHub repo (or approves `gh repo create <name> --private --source . --push`). Verify `git -C src/content/volumes status -sb` shows tracking with nothing ahead.
- [ ] **Step 2: Server + DNS** — owner follows `docs/DEPLOY.md` through the templates step; the owner enters their own values. Verify `ssh -p <admin> deploy@<host> true` succeeds and `dig +short <site host>` returns the server IP.
- [ ] **Step 3: `deploy.env`** — owner fills it in. Verify `git status --short` does not list it, then rerun the Task 7 secret scan (now with real `deploy.env` values) → nothing.
- [ ] **Step 4: First publish** with the NixOS wrapper. Expected: all steps `ok`; `curl -sI https://<site>/` → `200`; `curl -s https://<site>/vol/1/11-xibalba.txt | head` shows ANSI output; `ssh <site host>` opens the BBS home screen; `/vol/1/` links the PDFs and they download.
- [ ] **Step 5: Rollback drill** — publish again, then on the server switch `current` back to the previous release with the documented manual command; site and BBS serve the older release; switch forward again.
