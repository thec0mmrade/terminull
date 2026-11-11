import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile, loadDeployConfig } from './config.js';

const MIN = 'TERMINULL_SITE_URL=https://x.example.com\nDEPLOY_HOST=h.example.com\nDEPLOY_USER=deploy\n';

function load(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploycfg-'));
  const file = path.join(dir, 'deploy.env');
  fs.writeFileSync(file, text);
  try {
    return loadDeployConfig(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('parseEnvFile handles quoted and unquoted values', () => {
  assert.deepEqual(parseEnvFile('A=1\nB="two words"\nC=\'x\'\nD=a=b\n'), {
    A: '1', B: 'two words', C: 'x', D: 'a=b',
  });
});

test('parseEnvFile ignores comments and blank lines', () => {
  assert.deepEqual(parseEnvFile('# hi\n\n  # indented\nA=1\n'), { A: '1' });
});

test('parseEnvFile does not expand variables', () => {
  assert.deepEqual(parseEnvFile('A=$HOME/x\n'), { A: '$HOME/x' });
});

test('parseEnvFile throws with line number on malformed line', () => {
  assert.throws(() => parseEnvFile('A=1\nFOO\n'), /line 2/);
});

test('missing DEPLOY_HOST throws naming the key', () => {
  assert.throws(() => load('TERMINULL_SITE_URL=https://x.example.com\nDEPLOY_USER=d\n'), /DEPLOY_HOST/);
});

test('missing file points at deploy.env.example', () => {
  assert.throws(() => loadDeployConfig('/nonexistent/deploy.env'), /deploy\.env\.example/);
});

test('site URL trailing slash is stripped', () => {
  const c = load(MIN.replace('com\n', 'com/\n'));
  assert.equal(c.siteUrl, 'https://x.example.com');
});

test('http site URL is rejected except for localhost', () => {
  assert.throws(() => load(MIN.replace('https', 'http')), /TERMINULL_SITE_URL/);
  assert.equal(load(MIN.replace('https://x.example.com', 'http://localhost:4321')).siteUrl, 'http://localhost:4321');
});

test('relative DEPLOY_PATH is rejected', () => {
  assert.throws(() => load(MIN + 'DEPLOY_PATH=relative\n'), /DEPLOY_PATH/);
});

test('defaults are applied', () => {
  const c = load(MIN);
  assert.equal(c.sshPort, 22);
  assert.equal(c.keepReleases, 5);
  assert.equal(c.path, '/srv/terminull');
  assert.equal(c.arch, 'amd64');
  assert.equal(c.bbsPort, 22);
  assert.ok(path.isAbsolute(c.volumesDir));
  assert.equal(c.env.DEPLOY_HOST, 'h.example.com');
});

test('invalid ports, arch and keepReleases throw naming the key', () => {
  assert.throws(() => load(MIN + 'DEPLOY_SSH_PORT=70000\n'), /DEPLOY_SSH_PORT/);
  assert.throws(() => load(MIN + 'BBS_PORT=abc\n'), /BBS_PORT/);
  assert.throws(() => load(MIN + 'DEPLOY_ARCH=x86\n'), /DEPLOY_ARCH/);
  assert.throws(() => load(MIN + 'KEEP_RELEASES=1\n'), /KEEP_RELEASES/);
  assert.equal(load(MIN + 'DEPLOY_ARCH=arm64\nDEPLOY_SSH_PORT=2200\n').sshPort, 2200);
});

test('absolute volumes dir is kept', () => {
  assert.equal(load(MIN + 'TERMINULL_VOLUMES_DIR=/data/vols\n').volumesDir, '/data/vols');
});
