import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContentRepo, checkConfigUntracked } from './preflight.js';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** @type {string[]} */
const tmpDirs = [];
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-preflight-'));
  tmpDirs.push(dir);
  return dir;
}

function initRepo(dir) {
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'commit.gpgsign', 'false');
}

/** Clean repo with a bare upstream, one commit pushed. */
function pushedRepo() {
  const root = tmp();
  const bare = path.join(root, 'upstream.git');
  const work = path.join(root, 'work');
  fs.mkdirSync(bare);
  fs.mkdirSync(work);
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  initRepo(work);
  fs.writeFileSync(path.join(work, 'a.txt'), 'a');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'one');
  git(work, 'remote', 'add', 'origin', bare);
  git(work, 'push', '-q', '-u', 'origin', 'main');
  return work;
}

test('clean and pushed resolves with HEAD hash', async () => {
  const work = pushedRepo();
  const { commit } = await checkContentRepo(work);
  assert.equal(commit, git(work, 'rev-parse', 'HEAD'));
});

test('uncommitted file rejects', async () => {
  const work = pushedRepo();
  fs.writeFileSync(path.join(work, 'b.txt'), 'b');
  await assert.rejects(checkContentRepo(work), /uncommitted/);
});

test('unpushed commit rejects with git push hint', async () => {
  const work = pushedRepo();
  fs.writeFileSync(path.join(work, 'b.txt'), 'b');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'two');
  await assert.rejects(checkContentRepo(work), /git push/);
});

test('no upstream rejects', async () => {
  const dir = tmp();
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'one');
  await assert.rejects(checkContentRepo(dir), /upstream/);
});

test('not a git repo rejects', async () => {
  await assert.rejects(checkContentRepo(tmp()), /git repo/);
});

test('checkConfigUntracked throws when deploy.env is tracked', () => {
  const dir = tmp();
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'deploy.env'), 'X=1\n');
  git(dir, 'add', '-f', 'deploy.env');
  assert.throws(() => checkConfigUntracked(dir), /deploy\.env/);
});

test('checkConfigUntracked passes when untracked', () => {
  const dir = tmp();
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'deploy.env'), 'X=1\n');
  assert.doesNotThrow(() => checkConfigUntracked(dir));
});

test('checkConfigUntracked checks a custom config path inside the repo', () => {
  const dir = tmp();
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'other.env'), 'X=1\n');
  git(dir, 'add', '-f', 'other.env');
  assert.throws(() => checkConfigUntracked(dir, 'other.env'), /other\.env/);
});

test('checkConfigUntracked skips a config path outside the repo', () => {
  const dir = tmp();
  initRepo(dir);
  const outside = path.join(tmp(), 'deploy.env');
  fs.writeFileSync(outside, 'X=1\n');
  assert.doesNotThrow(() => checkConfigUntracked(dir, outside));
});

test('checkConfigUntracked fails loudly when not a git repo', () => {
  assert.throws(() => checkConfigUntracked(tmp()), /not a git repo/);
});

test('detached HEAD rejects with a distinct message', async () => {
  const work = pushedRepo();
  git(work, 'checkout', '-q', '--detach');
  await assert.rejects(checkContentRepo(work), /detached HEAD.*git switch/);
});
