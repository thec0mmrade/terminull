# Deploying to a server

One-time server setup, then one command (`npm run publish`) to put the site, the zine PDFs and the SSH BBS live. Any Debian 13 VPS works; nothing in the engine depends on a particular hosting provider. The server setup is automated by an Ansible playbook (see [Setup with the playbook](#setup-with-the-playbook)); the numbered steps below are the same work done by hand.

See also: [ADMIN.md](./ADMIN.md) | [EDITING.md](./EDITING.md) | [DEVELOPMENT.md](./DEVELOPMENT.md)

All examples use placeholders. Substitute your own:

| Placeholder            | Meaning                                         |
|------------------------|-------------------------------------------------|
| `terminull.example.com`| the public hostname of your zine                |
| `203.0.113.10`         | the server's IP address                        |
| `deploy`               | the account `npm run publish` logs in as        |
| `2200`                 | the port the server's own (admin) sshd listens on |
| `/srv/terminull`       | `DEPLOY_PATH`, where releases live              |

## How it fits together

- Visitors run `ssh terminull.example.com` (port 22) and reach the BBS, or open `https://terminull.example.com` (Caddy).
- You administer the server over ssh on port `2200`, so the BBS can own port 22.
- Releases live in `/srv/terminull/releases/<name>/`. `/srv/terminull/current` is a relative symlink to the live one. `/srv/terminull/shared/` holds what must survive releases (the BBS host key).
- `npm run publish` builds on your laptop, uploads a new release with rsync, flips `current`, restarts the BBS, checks the result, and rolls back by itself if the check fails.

Nothing here is committed to git: the hostname lives in your local `deploy.env`.

## Setup with the playbook

`deploy/ansible/` holds a playbook that does steps 3 to 6 below (and the package and kernel part of step 1) for you, and is safe to re-run. You still create the server and the DNS record yourself (steps 1 and 2), then:

```bash
cd deploy/ansible
ansible-galaxy collection install -r requirements.yml
cp inventory.example.ini inventory.ini   # your hostname and the server's IP
cp vars.example.yml vars.yml             # your hostname and SSH public key
ansible-playbook -i inventory.ini -e @vars.yml site.yml
```

`inventory.ini` and `vars.yml` are gitignored. Every setting is described in `roles/terminull_host/defaults/main.yml`.

What it does:

- Waits for the server's first-boot setup, upgrades every package, reboots into the new kernel, and **refuses to continue unless the running kernel fixes CVE-2026-98432** (Debian 13: `6.12.113-1` or later). Other releases fail closed until you set `min_kernel_version` for them.
- Turns on unattended upgrades, with an automatic reboot at 04:00 when an update needs one.
- Creates `admin` (key-only login, passwordless sudo), `deploy` and `terminull`, and the directories in step 4.
- Sets up `ufw`, moves the admin sshd to port 2200, then proves a fresh `admin` login on 2200 works before finishing.
- Installs Caddy, the Caddyfile, the BBS service and the `deploy` sudo rule.
- With `bbs_host_key_src` set, restores a backed-up BBS host key (see [Backing up the BBS host key](#backing-up-the-bbs-host-key)).

The first run logs in as `root` on port 22. Every later run logs in as `admin` on 2200; the playbook picks by itself. When it finishes, continue at [step 7](#7-laptop-the-content-repo).

## 1. Create the server

1. Create a server: smallest size, Debian 13, and add your SSH public key during creation. (IPv6 is optional.)
2. Log in as root once: `ssh root@203.0.113.10`.
3. Update, install rsync (publish uploads with it, so it must exist on the server), and reboot into the new kernel:

```bash
apt update && apt full-upgrade -y
apt install -y rsync
reboot
```

4. Check the running kernel fixes CVE-2026-98432, a remote bug reachable through any open TCP port. `uname -v` must show Debian `6.12.113-1` or later:

```bash
uname -v    # e.g. "... Debian 6.12.116-1 (...)"
```

## 2. DNS

At your DNS provider, add an `A` record `terminull.example.com` -> `203.0.113.10` (and an `AAAA` record if the server has IPv6). Caddy needs this to resolve before it can get a certificate.

## 3. Move admin SSH off port 22

The BBS will use port 22, so the server's own sshd moves. First create a non-root admin account that can use `sudo`, still as root:

```bash
adduser --disabled-password --gecos "" admin
usermod -aG sudo admin
install -d -m 700 -o admin -g admin /home/admin/.ssh
cp /root/.ssh/authorized_keys /home/admin/.ssh/authorized_keys
chown admin:admin /home/admin/.ssh/authorized_keys
passwd admin      # needed once: sudo asks for it
```

Then the sshd settings, in `/etc/ssh/sshd_config.d/10-admin.conf`:

```
Port 2200
PasswordAuthentication no
PermitRootLogin no
```

Apply it carefully. You can lock yourself out here.

1. If your hosting provider puts a cloud firewall in front of the server, open port `2200` there first. (`ufw` is set up later, in step 5, after sshd has moved; it allows `2200` before it is enabled.)
2. Test the config: `sshd -t`.
3. Restart sshd. On Debian 13 that is `systemctl restart ssh`. On **Ubuntu 24.04** sshd is socket-activated and ignores `Port` until you switch it to a plain service:

```bash
systemctl disable --now ssh.socket
systemctl enable --now ssh.service
systemctl restart ssh
```

4. If `ufw` is already active on the image, run `sudo ufw allow 2200/tcp` before restarting sshd.
5. **Keep your current session open.** From a second terminal confirm `ssh -p 2200 admin@203.0.113.10` works and `sudo -v` succeeds. Only then close the first session.

## 4. Users and directories

Two accounts, with different jobs:

- `deploy` logs in from your laptop and owns `/srv/terminull`. It has no sudo, apart from one command (step 6).
- `terminull` is a system user with no shell. It runs the BBS and owns only `shared/`; it reads releases.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo cp /home/admin/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys

sudo adduser --system --group --no-create-home --shell /usr/sbin/nologin terminull

sudo install -d -m 755 -o deploy -g deploy /srv/terminull /srv/terminull/releases
sudo install -d -m 700 -o terminull -g terminull /srv/terminull/shared
```

Why those modes: `/srv/terminull` and `releases/` are owned by `deploy` and world-readable, and publish uploads releases world-readable too (`--chmod=Dgo+rx,Fgo+rX`), so the `terminull` user and Caddy can read them. `shared/` is private to `terminull` so the BBS can generate and keep its SSH host key there (publish's own `mkdir -p shared` is then a no-op).

Do not create `/srv/terminull/current` yourself. Publish creates it as a relative symlink; an absolute one would break the rollback and verification logic.

## 5. Firewall and automatic updates

```bash
sudo apt install -y ufw unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2200/tcp   # admin ssh (before enabling ufw, so you are not locked out)
sudo ufw allow 22/tcp     # the BBS
sudo ufw allow 80/tcp     # Caddy (HTTP, certificate challenge and redirect)
sudo ufw allow 443/tcp    # Caddy (HTTPS)
sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # answer Yes
```

If your hosting provider puts a cloud firewall in front of the server, open the same four ports there.

## 6. Install Caddy and the three templates

Caddy from its official apt repository:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

The templates are in `deploy/` in the engine repo. From your laptop, in the engine directory, copy them over (the admin port, as `admin`):

```bash
scp -P 2200 deploy/Caddyfile.example deploy/terminull-bbs.service deploy/sudoers.example admin@203.0.113.10:/tmp/
```

Then on the server. Edit the hostname in the Caddyfile first (`sudo nano /tmp/Caddyfile.example`), and keep the `/srv/terminull` paths unless you changed `DEPLOY_PATH`:

```bash
sudo install -m 644 /tmp/Caddyfile.example /etc/caddy/Caddyfile
sudo install -m 644 /tmp/terminull-bbs.service /etc/systemd/system/terminull-bbs.service

# The sudoers rule: validate it before it goes live, and keep mode 0440.
sudo visudo -cf /tmp/sudoers.example
sudo install -m 440 -o root -g root /tmp/sudoers.example /etc/sudoers.d/terminull-deploy

sudo systemctl daemon-reload
sudo systemctl enable terminull-bbs
sudo systemctl reload caddy
```

The sudoers rule lets `deploy` run exactly `systemctl restart terminull-bbs` as root and nothing else. Publish calls it as `sudo -n systemctl restart terminull-bbs`, so a missing rule fails at once instead of waiting for a password.

Note `enable` without `start`: until the first publish creates `current`, the BBS unit has nothing to run and fails. That is expected. Caddy will serve an empty or missing site until then, too.

## 7. Laptop: the content repo

The engine repo contains no issues. Yours live in a separate private git repo, cloned where the engine looks for them (`src/content/volumes/`, gitignored by the engine):

```bash
cd /path/to/terminull
git clone <private-content-repo-url> src/content/volumes
```

The repo root must contain the `vol1/`, `vol2/`... folders. It must have an upstream branch: publish refuses to deploy content that is uncommitted or unpushed, so every live state is backed up. To keep the checkout elsewhere, set `TERMINULL_VOLUMES_DIR` to an absolute path, in `deploy.env` (see below) and in your shell for `npm run dev` and the local BBS (a relative value resolves against the repo root for the Node scripts but against its working directory (usually `ssh/`) for the Go BBS).

## 8. Laptop: deploy.env

```bash
cp deploy.env.example deploy.env
```

Edit it. For this guide:

```
TERMINULL_SITE_URL=https://terminull.example.com
DEPLOY_HOST=terminull.example.com
DEPLOY_USER=deploy
DEPLOY_SSH_PORT=2200
DEPLOY_PATH=/srv/terminull
DEPLOY_ARCH=amd64        # arm64 if the server is ARM
BBS_PORT=22
KEEP_RELEASES=5
```

`deploy.env` is gitignored, and publish refuses to run if it is tracked. Every key is explained in `deploy.env.example`.

Publish ssh's with `BatchMode=yes`, so it cannot answer the "trust this host?" prompt. Connect once by hand to put the server in `known_hosts`, and check your key works for `deploy`:

```bash
ssh -p 2200 deploy@terminull.example.com true
```

Requirements on the laptop: Node 22.12+, Go 1.26+, `rsync`, `ssh`, and a Chromium for the zine export (`PUPPETEER_EXECUTABLE_PATH` can point at one).

## 9. First publish

Try a dry run first. It checks the config and content repo, builds and stages a release (skipping the ssh check), and uploads nothing:

```bash
npm run publish -- --dry-run
```

Then the real one:

```bash
npm run publish
```

On NixOS, where Go and Chromium are not installed globally:

```bash
nix shell nixpkgs#go nixpkgs#chromium -c env -u LD_LIBRARY_PATH sh -c 'PUPPETEER_EXECUTABLE_PATH=$(which chromium) npm run publish'
```

(Alternatively set `PUPPETEER_EXECUTABLE_PATH` in `deploy.env` and keep `go` on your PATH.)

It checks the content repo and ssh access, builds (zines for every volume, the site, a static Linux BBS binary), uploads to a new release directory, points `current` at it, restarts the BBS, and verifies HTTPS (including that `/release.txt` names the new release) and the SSH banner. On failure it points `current` back at the previous release and restarts the BBS (on the very first publish there is no previous release, so a failed check leaves the new one in place; read the error, fix it, publish again). Because that failed release stays live, fix it before announcing the site. `--config <path>` uses another config file.

Afterwards:

```bash
curl -I https://terminull.example.com/
ssh terminull.example.com       # the BBS
```

On the server, `cat /srv/terminull/current/RELEASE` shows what is live: release name, content commit, engine commit, build time.

## Everyday use

Commit and push the content repo, then `npm run publish`. Each publish keeps the newest `KEEP_RELEASES` releases and prunes older ones. Connected BBS visitors are dropped for a few seconds on each restart.

## Manual rollback

Publish rolls back automatically when its own checks fail. To go back by hand to an older release (for example one that passes the checks but looks wrong), on the server as `deploy`:

```bash
cd /srv/terminull
ls releases                      # names sort by time; RELEASE inside tells the content commit
ln -sfn releases/<name> current.tmp && mv -T current.tmp current
sudo systemctl restart terminull-bbs
```

Keep the link relative (`releases/<name>`, never `/srv/...`), as above. The next publish uses the new `current` as the "previous" release.

## Backing up the BBS host key

`/srv/terminull/shared/ssh_host_ed25519_key` is created by the BBS on first start. It is the BBS's identity: if it is lost, every returning visitor gets a "host key changed" warning. Back it up from your laptop once it exists (after the first publish):

```bash
ssh -p 2200 admin@203.0.113.10 'sudo cat /srv/terminull/shared/ssh_host_ed25519_key' > ssh_host_ed25519_key.backup
chmod 600 ssh_host_ed25519_key.backup
```

Store the copy somewhere private (password manager or encrypted backup), never in git. To restore, put it back at the same path, owned by `terminull`, mode 0600, and restart `terminull-bbs`.

With the playbook, set `bbs_host_key_src` to the backup's path on your laptop instead. It installs the key before the BBS first starts, so a rebuilt server keeps the same identity. You can also make the key yourself before the first publish (`ssh-keygen -t ed25519 -N '' -f ssh_host_ed25519_key`) and keep only that copy's backup.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `cannot ssh to deploy@...` | Host key not in `known_hosts` (connect once by hand); wrong `DEPLOY_SSH_PORT`; key not loaded (`ssh-add -l`). |
| `rsync: command not found` | Install rsync on the server (step 1). |
| Publish fails to restart the BBS | The sudoers file is missing or its command path differs (`command -v systemctl`). Test: `sudo -n systemctl restart terminull-bbs` as `deploy`. |
| BBS does not start | `journalctl -u terminull-bbs -n 50`. Check `current` exists, `bbs.env` is readable, and `shared/` is owned by `terminull`. |
| HTTPS check fails on first publish | DNS not pointing at the server yet, or port 80/443 closed, so Caddy has no certificate. `journalctl -u caddy`. |
| `ssh terminull.example.com` shows the server's login instead of the BBS | sshd is still on port 22 (step 3, Ubuntu socket note). |
| Playbook stops at "Require a running kernel at or above the minimum" | The server is not running a kernel that fixes CVE-2026-98432. `apt full-upgrade`, reboot, check `uname -v`; on a release the playbook doesn't know, set `min_kernel_version`. |
| Playbook cannot connect | First run needs `root` login on port 22 with your key; later runs need `admin` on 2200. Check `ansible_host` in `inventory.ini`. |
