// deployRelease end to end against a local "server": a temp dir reached through a stub
// `ssh` on PATH (runs the remote command locally with sh), real rsync through it, a local
// HTTP server serving <root>/current/site and a local SSH-banner server. Never touches /srv.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { deployRelease } from '../publish.js';

// Skips ssh options and the host, then runs the remote command as real ssh does: joined
// with spaces and handed to a shell.
const STUB_SSH = `#!/bin/sh
while [ $# -gt 0 ]; do
  case "$1" in
    -p|-o|-l) shift 2 ;;
    --) shift; break ;;
    -*) shift ;;
    *) break ;;
  esac
done
shift
exec sh -c "$*"
`;

/** @type {{tmp: string, root: string, servers: import('node:net').Server[], fail: boolean, cfg: any, origPath: string | undefined}} */
let ctx;

/** @param {import('node:net').Server} server @returns {Promise<number>} */
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

beforeEach(async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-deploy-'));
  const root = path.join(tmp, 'server');
  fs.mkdirSync(root); // DEPLOY_PATH exists on the server (created during setup)
  fs.mkdirSync(path.join(tmp, 'bin'));
  fs.writeFileSync(path.join(tmp, 'bin', 'ssh'), STUB_SSH, { mode: 0o755 });
  const origPath = process.env.PATH;
  process.env.PATH = `${path.join(tmp, 'bin')}:${origPath}`;

  ctx = { tmp, root, servers: [], fail: false, cfg: null, origPath };
  const web = http.createServer((req, res) => {
    if (ctx.fail) { res.writeHead(500); res.end(); return; }
    let file = path.join(root, 'current', 'site', decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200);
      res.end(body);
    });
  });
  const banner = net.createServer((sock) => { sock.on('error', () => {}); sock.end('SSH-2.0-Go\r\n'); });
  ctx.servers.push(web, banner);
  const webPort = await listen(web);
  const bbsPort = await listen(banner);
  ctx.cfg = {
    siteUrl: `http://127.0.0.1:${webPort}`, host: 'server.invalid', user: 'deploy', sshPort: 2200,
    path: root, arch: 'amd64', bbsPort, keepReleases: 2, volumesDir: tmp, env: {},
  };
});

afterEach(async () => {
  process.env.PATH = ctx.origPath;
  await Promise.all(ctx.servers.map((s) => new Promise((resolve) => s.close(resolve))));
  fs.rmSync(ctx.tmp, { recursive: true, force: true });
});

let stages = 0;

/** A complete local stage for release `name`. @param {string} name */
function stage(name) {
  const dir = path.join(ctx.tmp, `stage-${name}`);
  fs.mkdirSync(path.join(dir, 'site', 'vol', '1'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'site', 'index.html'), `<p>${name}</p>`);
  fs.writeFileSync(path.join(dir, 'site', 'vol', '1', 'index.html'), 'vol 1');
  fs.writeFileSync(path.join(dir, 'site', 'release.txt'), `${name}\n`);
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.writeFileSync(path.join(dir, 'bin', 'terminull-ssh'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'bbs.env'), 'TERMINULL_PORT=2222\n');
  fs.writeFileSync(path.join(dir, 'RELEASE.pending'), `release: ${name}\n`);
  // Real builds are minutes apart; rsync's size+mtime check (and --link-dest) relies on that.
  const t = new Date(Date.UTC(2026, 0, 1) + 60000 * ++stages);
  fs.utimesSync(path.join(dir, 'site', 'release.txt'), t, t);
  return dir;
}

const current = () => fs.readlinkSync(path.join(ctx.root, 'current'));
const releases = () => fs.readdirSync(path.join(ctx.root, 'releases')).sort();
const opts = { attempts: 1, delayMs: 1, restart: 'true' };

test('deployRelease uploads, switches, verifies and prunes', async () => {
  for (const name of ['20260101-000000-aaaaaaa', '20260102-000000-bbbbbbb', '20260103-000000-ccccccc']) {
    await deployRelease(ctx.cfg, stage(name), name, opts);
    assert.equal(current(), `releases/${name}`);
    assert.equal(fs.readFileSync(path.join(ctx.root, 'releases', name, 'RELEASE'), 'utf8'), `release: ${name}\n`);
    assert.ok(!fs.existsSync(path.join(ctx.root, 'releases', name, 'RELEASE.pending')));
    assert.ok(fs.statSync(path.join(ctx.root, 'releases', name, 'bin', 'terminull-ssh')).mode & 0o111);
  }
  assert.deepEqual(releases(), ['20260102-000000-bbbbbbb', '20260103-000000-ccccccc']);
});

test('deployRelease rolls back to the previous release when verify fails', async () => {
  await deployRelease(ctx.cfg, stage('20260101-000000-aaaaaaa'), '20260101-000000-aaaaaaa', opts);
  ctx.fail = true;
  await assert.rejects(
    deployRelease(ctx.cfg, stage('20260102-000000-bbbbbbb'), '20260102-000000-bbbbbbb', opts),
    /rolled back to 20260101-000000-aaaaaaa/,
  );
  assert.equal(current(), 'releases/20260101-000000-aaaaaaa');
});

test('deployRelease leaves a failed first release in place', async () => {
  ctx.fail = true;
  await assert.rejects(
    deployRelease(ctx.cfg, stage('20260101-000000-aaaaaaa'), '20260101-000000-aaaaaaa', opts),
    /first release failed verification; left in place/,
  );
  assert.equal(current(), 'releases/20260101-000000-aaaaaaa');
});

test('deployRelease rolls back when the site does not serve the new release.txt', async () => {
  await deployRelease(ctx.cfg, stage('20260101-000000-aaaaaaa'), '20260101-000000-aaaaaaa', opts);
  const dir = stage('20260102-000000-bbbbbbb');
  fs.writeFileSync(path.join(dir, 'site', 'release.txt'), '20260101-000000-aaaaaaa\n'); // as if a stale site were served
  await assert.rejects(deployRelease(ctx.cfg, dir, '20260102-000000-bbbbbbb', opts), /rolled back to 20260101-000000-aaaaaaa/);
  assert.equal(current(), 'releases/20260101-000000-aaaaaaa');
});

test('deployRelease reports a rollback whose BBS restart failed as switched back, not ROLLBACK FAILED', async () => {
  await deployRelease(ctx.cfg, stage('20260101-000000-aaaaaaa'), '20260101-000000-aaaaaaa', opts);
  ctx.fail = true;
  // Restart succeeds for the new release, fails once current points back at the old one.
  const restart = 'test "$(readlink current)" = releases/20260102-000000-bbbbbbb';
  await assert.rejects(
    deployRelease(ctx.cfg, stage('20260102-000000-bbbbbbb'), '20260102-000000-bbbbbbb', { ...opts, restart }),
    (err) => /rolled back .*current to 20260101-000000-aaaaaaa, but restarting terminull-bbs failed/.test(err.message)
      && !/ROLLBACK FAILED/.test(err.message),
  );
  assert.equal(current(), 'releases/20260101-000000-aaaaaaa');
});
