import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  releaseName, releaseText, prepareCommand, finalizeCommand, switchCommand,
  previousReleaseCommand, pruneCommand,
} from './remote.js';

/** Temp deploy root whose name contains a space and a single quote. */
function tmpRoot() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-remote-'));
  const root = path.join(base, "srv dir'x");
  fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
  return root;
}

/** Run a generated script the way publish.js does (`sh -s`, script on stdin). */
const sh = (script) => execFileSync('sh', ['-s'], { input: script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

/** @param {string} root @param {string} name @param {boolean} complete */
function addRelease(root, name, complete = true) {
  const dir = path.join(root, 'releases', name);
  fs.mkdirSync(path.join(dir, 'site'), { recursive: true });
  if (complete) fs.writeFileSync(path.join(dir, 'RELEASE'), `release: ${name}\n`);
}

const releases = (root) => fs.readdirSync(path.join(root, 'releases')).sort();

test('releaseName is UTC timestamp plus 7-char commit', () => {
  assert.equal(releaseName(new Date('2026-11-11T09:05:03Z'), 'abcdef1234'), '20261111-090503-abcdef1');
});

test('releaseText lists the release metadata', () => {
  const text = releaseText({
    name: 'n1', contentCommit: 'c'.repeat(40), engineCommit: 'e'.repeat(40), engineDirty: true,
    date: new Date('2026-11-11T09:05:03Z'), siteUrl: 'https://x.example',
  });
  assert.equal(text, [
    'release: n1', `content_commit: ${'c'.repeat(40)}`, `engine_commit: ${'e'.repeat(40)}`,
    'engine_dirty: yes', 'built_at: 2026-11-11T09:05:03.000Z', 'site_url: https://x.example', '',
  ].join('\n'));
});

test('builders single-quote the path, escaping embedded quotes', () => {
  const p = "/srv/a b'c";
  for (const script of [
    prepareCommand(p, 'n'), finalizeCommand(p, 'n', 'x'), switchCommand(p, 'n'),
    previousReleaseCommand(p), pruneCommand(p, 2),
  ]) {
    assert.ok(script.includes(`cd '/srv/a b'\\''c'`), script);
  }
  assert.ok(switchCommand(p, 'n').includes('sudo systemctl restart terminull-bbs'));
});

test('prepareCommand removes unfinished releases and creates the new one', () => {
  const root = tmpRoot();
  addRelease(root, '20260101-000000-aaaaaaa', true);
  addRelease(root, '20260102-000000-bbbbbbb', false);
  sh(prepareCommand(root, '20260103-000000-ccccccc'));
  assert.deepEqual(releases(root), ['20260101-000000-aaaaaaa', '20260103-000000-ccccccc']);
  assert.ok(fs.statSync(path.join(root, 'shared')).isDirectory());
});

test('prepareCommand refuses to reuse an existing complete release', () => {
  const root = tmpRoot();
  addRelease(root, 'r1', true);
  assert.throws(() => sh(prepareCommand(root, 'r1')), /already exists/);
  assert.ok(fs.existsSync(path.join(root, 'releases/r1/RELEASE')));
});

test('prepareCommand never removes the current target', () => {
  const root = tmpRoot();
  addRelease(root, 'legacy', false);
  fs.symlinkSync('releases/legacy', path.join(root, 'current'));
  sh(prepareCommand(root, 'r2'));
  assert.deepEqual(releases(root), ['legacy', 'r2']);
});

test('finalizeCommand writes RELEASE after checking the upload', () => {
  const root = tmpRoot();
  addRelease(root, 'r1', false);
  const text = "release: r1\nsite_url: https://it's.example\n";
  assert.throws(() => sh(finalizeCommand(root, 'r1', text)), /incomplete/);
  assert.ok(!fs.existsSync(path.join(root, 'releases/r1/RELEASE')));

  fs.mkdirSync(path.join(root, 'releases/r1/bin'));
  fs.writeFileSync(path.join(root, 'releases/r1/bin/terminull-ssh'), '', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'releases/r1/bbs.env'), '');
  sh(finalizeCommand(root, 'r1', text));
  assert.equal(fs.readFileSync(path.join(root, 'releases/r1/RELEASE'), 'utf8'), text);
});

test('switchCommand points current at the new release and runs the restart', () => {
  const root = tmpRoot();
  addRelease(root, 'r1');
  addRelease(root, 'r2');
  fs.symlinkSync('releases/r1', path.join(root, 'current'));
  const marker = path.join(root, 'restarted');
  sh(switchCommand(root, 'r2', `touch '${marker.replace(/'/g, "'\\''")}'`));
  assert.equal(fs.readlinkSync(path.join(root, 'current')), 'releases/r2');
  assert.ok(fs.existsSync(marker));
  assert.ok(!fs.existsSync(path.join(root, 'current.tmp')));
});

test('switchCommand refuses a release without RELEASE', () => {
  const root = tmpRoot();
  addRelease(root, 'r1');
  addRelease(root, 'half', false);
  fs.symlinkSync('releases/r1', path.join(root, 'current'));
  assert.throws(() => sh(switchCommand(root, 'half', 'true')));
  assert.equal(fs.readlinkSync(path.join(root, 'current')), 'releases/r1');
});

test('previousReleaseCommand prints the current target, or nothing', () => {
  const root = tmpRoot();
  assert.equal(sh(previousReleaseCommand(root)).trim(), '');
  addRelease(root, 'r1');
  fs.symlinkSync('releases/r1', path.join(root, 'current'));
  assert.equal(sh(previousReleaseCommand(root)).trim(), 'r1');
});

test('pruneCommand keeps the newest complete releases and the current target', () => {
  const root = tmpRoot();
  for (const n of ['20260101-000000-a', '20260102-000000-b', '20260103-000000-c', '20260104-000000-d']) addRelease(root, n);
  fs.symlinkSync('releases/20260101-000000-a', path.join(root, 'current'));
  sh(pruneCommand(root, 2));
  assert.deepEqual(releases(root), ['20260101-000000-a', '20260103-000000-c', '20260104-000000-d']);
});
