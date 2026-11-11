// One-command deploy: preflight, build, upload a release, switch, verify, roll back on failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { version } from '../src/lib/version.js';
import { loadDeployConfig } from './publish/config.js';
import { checkContentRepo, checkConfigUntracked } from './publish/preflight.js';
import {
  releaseName, releaseText, prepareCommand, finalizeCommand, switchCommand,
  previousReleaseCommand, pruneCommand, sshOpts, rsyncArgs,
} from './publish/remote.js';
import { checkHttp, checkHttpBody, checkSshBanner, withRetries } from './publish/verify.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOTAL_STEPS = 8;

// True while current may point at the new release: Ctrl-C then means "roll back", not "exit".
let switching = false;

/** @param {number} n @param {string} msg */
const step = (n, msg) => console.log(`[${n}/${TOTAL_STEPS}] ${msg}`);

/**
 * Child process env: process.env + deploy.env, with the resolved volumes dir and site URL forced.
 * @param {import('./publish/config.js').DeployConfig} cfg
 */
function childEnv(cfg) {
  return {
    ...process.env,
    ...cfg.env,
    TERMINULL_VOLUMES_DIR: cfg.volumesDir,
    TERMINULL_SITE_URL: cfg.siteUrl,
  };
}

/**
 * Run a command with an argument array, streaming output; reject on non-zero exit.
 * @param {string} cmd @param {string[]} args @param {{cwd: string, env: NodeJS.ProcessEnv}} opts
 */
function runStreaming(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: 'inherit' });
    child.on('error', (err) => reject(new Error(`${cmd}: ${err.message}`)));
    child.on('close', (code, signal) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

/** @param {string} volumesDir */
function volumeNumbers(volumesDir) {
  return fs.readdirSync(volumesDir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? /^vol(\d+)$/.exec(e.name) : null))
    .filter(Boolean)
    .map((m) => Number(/** @type {RegExpExecArray} */ (m)[1]))
    .sort((a, b) => a - b);
}

/**
 * Build everything into stageDir. Stops at the first failing command.
 * @param {import('./publish/config.js').DeployConfig} cfg
 * @param {string} stageDir
 * @param {{name: string, engineVersion: string, contentCommit: string, engineCommit: string, engineDirty: boolean, date: Date, siteUrl: string}} meta
 *   written to RELEASE.pending in the stage; it is never uploaded (finalizeCommand writes RELEASE last)
 */
export async function buildRelease(cfg, stageDir, meta) {
  const env = childEnv(cfg);
  const opts = { cwd: ROOT, env };

  const vols = volumeNumbers(cfg.volumesDir);
  if (vols.length === 0) throw new Error(`no vol* directories found in ${cfg.volumesDir}`);

  // Stale PDFs from deleted or renamed volumes must not ship.
  fs.rmSync(path.join(ROOT, 'public', 'zine'), { recursive: true, force: true });
  for (const n of vols) await runStreaming('npm', ['run', 'zine', '--', '--volume', String(n)], opts);
  await runStreaming('npm', ['run', 'build'], opts);

  fs.cpSync(path.join(ROOT, 'dist'), path.join(stageDir, 'site'), { recursive: true });
  // Verify fetches this to prove the new release (not a stale one) is being served.
  fs.writeFileSync(path.join(stageDir, 'site', 'release.txt'), `${meta.name}\n`);
  fs.cpSync(path.join(ROOT, 'src/content/pages'), path.join(stageDir, 'content/pages'), { recursive: true });
  const volumesOut = path.join(stageDir, 'content/volumes');
  fs.mkdirSync(volumesOut, { recursive: true });
  for (const entry of fs.readdirSync(cfg.volumesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^vol\d+$/.test(entry.name)) continue; // only volumes; .git stays behind
    fs.cpSync(path.join(cfg.volumesDir, entry.name), path.join(volumesOut, entry.name), { recursive: true });
  }

  fs.mkdirSync(path.join(stageDir, 'bin'), { recursive: true });
  const ldflags = `-X terminull-ssh/ui/components.Version=${version}`;
  await runStreaming('go', ['build', '-trimpath', '-ldflags', ldflags, '-o', path.join(stageDir, 'bin/terminull-ssh'), '.'], {
    cwd: path.join(ROOT, 'ssh'),
    env: { ...env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: cfg.arch },
  });

  const bbsEnv = [
    `TERMINULL_SITE_URL=${cfg.siteUrl}`,
    `TERMINULL_PORT=${cfg.bbsPort}`,
    'TERMINULL_HOST=0.0.0.0',
    `TERMINULL_CONTENT_DIR=${cfg.path}/current/content`,
    `TERMINULL_VOLUMES_DIR=${cfg.path}/current/content/volumes`,
    `TERMINULL_HOST_KEY=${cfg.path}/shared/ssh_host_ed25519_key`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(stageDir, 'bbs.env'), bbsEnv);
  fs.writeFileSync(path.join(stageDir, 'RELEASE.pending'), releaseText(meta));
}

/**
 * Run a sh script on the server (`ssh … sh -s`, script on stdin) and return its stdout.
 * The ssh child gets its own process group so a Ctrl-C cannot cut a switch or rollback short.
 * @param {import('./publish/config.js').DeployConfig} cfg @param {string} script
 * @returns {Promise<string>}
 */
function runRemote(cfg, script) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [...sshOpts(cfg), '--', `${cfg.user}@${cfg.host}`, 'sh', '-s'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: true,
    });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
    child.stdin.on('error', () => {}); // reported via the exit code
    child.stdin.end(script);
    child.on('error', (err) => reject(new Error(`ssh: ${err.message}`)));
    child.on('close', (code, signal) => {
      if (code === 0) resolve(out);
      else reject(new Error(`remote command on ${cfg.host} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

/**
 * Fail fast (before the build) if the server cannot be reached as the deploy user.
 * @param {import('./publish/config.js').DeployConfig} cfg
 */
function checkSshAccess(cfg) {
  const target = `${cfg.user}@${cfg.host}`;
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [...sshOpts(cfg), '--', target, 'true'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.setEncoding('utf8').on('data', (d) => { err += d; });
    child.on('error', (e) => reject(new Error(`ssh: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) return resolve(undefined);
      const detail = err.trim().split('\n').pop() || `exit ${code}`;
      reject(new Error(`cannot ssh to ${target} (port ${cfg.sshPort}): ${detail}. ` +
        'Check DEPLOY_HOST/DEPLOY_USER/DEPLOY_SSH_PORT, that your key is loaded, and that the host key is in known_hosts (ssh in once by hand).'));
    });
  });
}

/** Highest volume number the built site has a page for. @param {string} stageDir */
function newestBuiltVolume(stageDir) {
  const dir = path.join(stageDir, 'site', 'vol');
  const nums = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b)
    : [];
  if (nums.length === 0) throw new Error('the built site has no /vol/<n>/ pages');
  return nums[nums.length - 1];
}

/** `ssh <hostname>` plus ` -p <port>` when the BBS is not on 22. @param {import('./publish/config.js').DeployConfig} cfg */
function bbsCommand(cfg) {
  const host = new URL(cfg.siteUrl).hostname;
  return `ssh ${host}${cfg.bbsPort === 22 ? '' : ` -p ${cfg.bbsPort}`}`;
}

/**
 * Steps 5-8, described the same way for real runs and dry runs.
 * @param {import('./publish/config.js').DeployConfig} cfg @param {string} name @param {number} vol
 */
function remoteSteps(cfg, name, vol) {
  return {
    upload: `Uploading release ${name} to ${cfg.user}@${cfg.host}:${cfg.path}/releases/ (ssh port ${cfg.sshPort})…`,
    switch: `Switching ${cfg.path}/current to ${name} and restarting terminull-bbs…`,
    verify: `Verifying ${cfg.siteUrl}/, ${cfg.siteUrl}/vol/${vol}/, ${cfg.siteUrl}/release.txt and the BBS (${bbsCommand(cfg)})…`,
    prune: `Pruning old releases, keeping ${cfg.keepReleases}…`,
  };
}

/**
 * Upload, switch, verify; roll back to the previous release if anything after the switch fails.
 * Before the switch, a failure leaves current untouched and the upload without RELEASE
 * (the next publish deletes it).
 * @param {import('./publish/config.js').DeployConfig} cfg
 * @param {string} stageDir
 * @param {string} name
 * @param {{attempts?: number, delayMs?: number, restart?: string}} [opts]
 *   verify retries, and the BBS restart command (injectable for tests)
 */
export async function deployRelease(cfg, stageDir, name, { restart, ...retry } = {}) {
  const vol = newestBuiltVolume(stageDir);
  const steps = remoteSteps(cfg, name, vol);
  const releaseFile = path.join(stageDir, 'RELEASE.pending');
  const text = fs.readFileSync(releaseFile, 'utf8');

  step(5, steps.upload);
  await runRemote(cfg, prepareCommand(cfg.path, name));
  const prev = (await runRemote(cfg, previousReleaseCommand(cfg.path))).trim() || null;
  if (prev && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prev)) throw new Error(`unexpected current release name ${JSON.stringify(prev)}`);
  await runStreaming('rsync', rsyncArgs(cfg, stageDir, name, prev), { cwd: ROOT, env: process.env });
  await runRemote(cfg, finalizeCommand(cfg.path, name, text));
  console.log(`      uploaded${prev ? ` (previous: ${prev})` : ' (first release)'}`);

  // From here on current may point at the new release: any failure, or Ctrl-C, rolls back.
  const ac = new AbortController();
  const onSigint = () => {
    if (!ac.signal.aborted) console.error('      interrupted: rolling back once the current step stops…');
    ac.abort();
  };
  process.on('SIGINT', onSigint);
  switching = true;
  try {
    try {
      step(6, steps.switch);
      await runRemote(cfg, switchCommand(cfg.path, name, restart));
      if (ac.signal.aborted) throw new Error('interrupted');

      step(7, steps.verify);
      const opts = { ...retry, signal: ac.signal };
      const host = new URL(cfg.siteUrl).hostname;
      await withRetries(() => checkHttp(`${cfg.siteUrl}/`), opts);
      await withRetries(() => checkHttp(`${cfg.siteUrl}/vol/${vol}/`), opts);
      await withRetries(() => checkHttpBody(`${cfg.siteUrl}/release.txt`, `${name}\n`), opts);
      await withRetries(() => checkSshBanner(host, cfg.bbsPort), opts);
      console.log('      ok');
    } catch (err) {
      console.error(`      ${/** @type {Error} */ (err).message}`);
      if (!prev) throw new Error('first release failed verification; left in place');
      console.error(`      rolling back to ${prev}…`);
      try {
        await runRemote(cfg, switchCommand(cfg.path, prev, restart));
      } catch (rbErr) {
        const why = /** @type {Error} */ (rbErr).message;
        // The switch script swaps the symlink before restarting: tell the two failures apart.
        const now = await runRemote(cfg, previousReleaseCommand(cfg.path)).then((o) => o.trim(), () => null);
        if (now === prev) {
          throw new Error(`rolled back ${cfg.path}/current to ${prev}, but restarting terminull-bbs failed (${why}): ` +
            'run `sudo systemctl restart terminull-bbs` on the server');
        }
        throw new Error(`ROLLBACK FAILED (${why}); ` +
          `${cfg.path}/current may still point at ${name}: switch it back to releases/${prev} by hand`);
      }
      throw new Error(`rolled back to ${prev}`);
    }
  } finally {
    switching = false;
    process.off('SIGINT', onSigint);
  }

  step(8, steps.prune);
  try {
    await runRemote(cfg, pruneCommand(cfg.path, cfg.keepReleases));
  } catch (err) {
    console.error(`      warning: prune failed (${/** @type {Error} */ (err).message}); the release is live`);
  }
}

/** @param {string[]} args @param {string} cwd */
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** @param {string[]} argv */
function parseArgs(argv) {
  const opts = { dryRun: false, config: 'deploy.env' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--config') {
      if (!argv[i + 1]) throw new Error('--config needs a path');
      opts.config = argv[++i];
    } else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  step(1, 'Loading deploy config…');
  const cfg = loadDeployConfig(opts.config);
  checkConfigUntracked(ROOT, opts.config);
  console.log(`      target ${cfg.user}@${cfg.host}:${cfg.path}, site ${cfg.siteUrl}`);

  step(2, 'Checking content repo…');
  const { commit } = await checkContentRepo(cfg.volumesDir);
  console.log(`      ok (${commit.slice(0, 7)})`);

  const engineCommit = git(['rev-parse', 'HEAD'], ROOT);
  const engineDirty = git(['status', '--porcelain'], ROOT) !== '';
  if (engineDirty) console.log('      note: the engine repo has uncommitted changes');

  step(3, `Checking ssh access to ${cfg.user}@${cfg.host}…`);
  if (opts.dryRun) console.log('      skipped (dry run)');
  else {
    await checkSshAccess(cfg);
    console.log('      ok');
  }

  const date = new Date();
  const name = releaseName(date, commit);
  const meta = { name, engineVersion: version, contentCommit: commit, engineCommit, engineDirty, date, siteUrl: cfg.siteUrl };

  step(4, 'Building site, zines and BBS binary…');
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-stage-'));
  if (opts.dryRun) {
    await buildRelease(cfg, stageDir, meta);
    console.log(`      staged release ${name} at ${stageDir}`);
    const steps = remoteSteps(cfg, name, newestBuiltVolume(stageDir));
    console.log('      Dry run: nothing uploaded. A real run would continue:');
    [steps.upload, steps.switch, steps.verify, steps.prune]
      .forEach((s, i) => console.log(`      [${i + 5}/${TOTAL_STEPS}] ${s}`));
    console.log(`      then print: Live: ${cfg.siteUrl} / BBS: ${bbsCommand(cfg)}`);
    return;
  }
  const removeStage = () => fs.rmSync(stageDir, { recursive: true, force: true });
  const onSigint = () => {
    if (switching) return; // deployRelease rolls back, then the finally below cleans up
    removeStage();
    process.exit(130);
  };
  process.on('SIGINT', onSigint);
  try {
    await buildRelease(cfg, stageDir, meta);
    console.log(`      staged release ${name}`);
    await deployRelease(cfg, stageDir, name);
  } finally {
    process.off('SIGINT', onSigint);
    removeStage();
  }

  console.log(`Live: ${cfg.siteUrl}`);
  console.log(`BBS: ${bbsCommand(cfg)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`publish failed: ${err.message}`);
    process.exit(1);
  });
}
