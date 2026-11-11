// Preflight checks for the publish script.
import fs from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** @param {string} dir @param {string[]} args */
async function git(dir, args) {
  const { stdout } = await run('git', args, { cwd: dir });
  return stdout.trim();
}

/**
 * The content repo must be a clean git repo, fully pushed to its upstream.
 * @param {string} dir
 * @returns {Promise<{ commit: string }>}
 */
export async function checkContentRepo(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`${dir} does not exist: set TERMINULL_VOLUMES_DIR in deploy.env to your content repo`);
  }
  let top;
  try {
    top = await git(dir, ['rev-parse', '--show-toplevel']);
  } catch {
    throw new Error(`${dir} is not a git repo: run git init there and push it to a private remote`);
  }
  if (fs.realpathSync(top) !== fs.realpathSync(dir)) {
    throw new Error(`${dir} is not the root of a git repo (found ${top}): point TERMINULL_VOLUMES_DIR at the repo root`);
  }
  try {
    await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  } catch {
    throw new Error(`${dir} has no upstream branch: run git push -u origin <branch> there`);
  }
  if (await git(dir, ['status', '--porcelain'])) {
    throw new Error(`${dir} has uncommitted changes: commit them (git add -A && git commit) before publishing`);
  }
  try {
    await git(dir, ['fetch', '--quiet']);
  } catch (err) {
    throw new Error(`git fetch failed in ${dir}: ${/** @type {Error} */ (err).message.trim()}`);
  }
  const ahead = Number(await git(dir, ['rev-list', '--count', '@{u}..HEAD']));
  if (ahead > 0) {
    throw new Error(`${dir} has ${ahead} unpushed commit(s): run git push there before publishing`);
  }
  return { commit: await git(dir, ['rev-parse', 'HEAD']) };
}

/**
 * deploy.env holds the host and must never be committed.
 * @param {string} repoRoot
 */
export function checkConfigUntracked(repoRoot) {
  let tracked = true;
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', 'deploy.env'], { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    tracked = false;
  }
  if (tracked) {
    throw new Error('deploy.env is tracked by git: run git rm --cached deploy.env and keep it gitignored');
  }
}
