// One-command deploy: preflight, build, stage (upload is added in a later step).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDeployConfig } from './publish/config.js';
import { checkContentRepo, checkConfigUntracked } from './publish/preflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOTAL_STEPS = 5;

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
 * @param {{contentCommit: string, engineCommit: string, engineDirty: boolean}} meta
 */
export async function buildRelease(cfg, stageDir, meta) {
  void meta; // recorded in RELEASE at upload time
  const env = childEnv(cfg);
  const opts = { cwd: ROOT, env };

  const vols = volumeNumbers(cfg.volumesDir);
  if (vols.length === 0) throw new Error(`no vol* directories found in ${cfg.volumesDir}`);

  for (const n of vols) await runStreaming('npm', ['run', 'zine', '--', '--volume', String(n)], opts);
  await runStreaming('npm', ['run', 'build'], opts);

  fs.cpSync(path.join(ROOT, 'dist'), path.join(stageDir, 'site'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'src/content/pages'), path.join(stageDir, 'content/pages'), { recursive: true });
  const volumesOut = path.join(stageDir, 'content/volumes');
  fs.mkdirSync(volumesOut, { recursive: true });
  for (const entry of fs.readdirSync(cfg.volumesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^vol\d+$/.test(entry.name)) continue; // only volumes; .git stays behind
    fs.cpSync(path.join(cfg.volumesDir, entry.name), path.join(volumesOut, entry.name), { recursive: true });
  }

  fs.mkdirSync(path.join(stageDir, 'bin'), { recursive: true });
  await runStreaming('go', ['build', '-trimpath', '-o', path.join(stageDir, 'bin/terminull-ssh'), '.'], {
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

  step(3, 'Building site, zines and BBS binary…');
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-stage-'));
  await buildRelease(cfg, stageDir, { contentCommit: commit, engineCommit, engineDirty });

  step(4, `Staged release at ${stageDir}`);

  if (opts.dryRun) {
    step(5, 'Dry run: nothing uploaded. Remote steps that would run:');
    for (const line of [
      `prepare release dir under ${cfg.path}/releases/ on ${cfg.host}`,
      `rsync the staged release to it over ssh (port ${cfg.sshPort})`,
      'write RELEASE (contentCommit, engineCommit, time) last',
      `switch ${cfg.path}/current symlink and restart the BBS service`,
      `verify ${cfg.siteUrl} and the BBS port ${cfg.bbsPort} respond`,
      `prune old releases, keeping ${cfg.keepReleases}`,
    ]) console.log(`      - ${line}`);
    return;
  }
  console.log('      upload is not implemented yet; use --dry-run');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`publish failed: ${err.message}`);
    process.exit(1);
  });
}
