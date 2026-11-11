// Release naming and the remote shell scripts publish.js runs over `ssh … sh -s`.
//
// Layout under the deploy path: releases/<name>/ (complete once it holds a RELEASE
// file), current -> releases/<name>, shared/. Each builder returns one POSIX sh
// script wrapped in { … } so sh parses all of it before running any of it: a
// connection dropped mid-transfer runs nothing rather than half a script.

const RESTART = 'sudo systemctl restart terminull-bbs';

/** Single-quote a value for sh, escaping embedded quotes. @param {string | number} value */
export const shq = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

/** @param {string} name */
function checkName(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`invalid release name: ${JSON.stringify(name)}`);
  return name;
}

/** @param {string} deployPath @param {string[]} lines */
const script = (deployPath, lines) => ['{', 'set -e', `cd ${shq(deployPath)}`, ...lines, '}', ''].join('\n');

/**
 * `YYYYMMDD-HHMMSS-<7-char commit>` in UTC; sorts by time.
 * @param {Date} date @param {string} contentCommit
 */
export function releaseName(date, contentCommit) {
  const stamp = date.toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
  return `${stamp}-${contentCommit.slice(0, 7)}`;
}

/**
 * Contents of the RELEASE file: plain `key: value` lines.
 * @param {{name: string, contentCommit: string, engineCommit: string, engineDirty: boolean, date: Date, siteUrl: string}} r
 */
export function releaseText(r) {
  return [
    `release: ${r.name}`,
    `content_commit: ${r.contentCommit}`,
    `engine_commit: ${r.engineCommit}`,
    `engine_dirty: ${r.engineDirty ? 'yes' : 'no'}`,
    `built_at: ${r.date.toISOString()}`,
    `site_url: ${r.siteUrl}`,
    '',
  ].join('\n');
}

// Prints the name current points at (empty when there is no current).
const READ_CURRENT = [
  'cur=',
  'if [ -L current ]; then cur=$(readlink current); cur=${cur#releases/}; fi',
];

/**
 * Delete unfinished uploads (releases without RELEASE, except the current target),
 * then create releases/<name> and shared/. Fails if <name> already exists.
 * @param {string} deployPath @param {string} name
 */
export function prepareCommand(deployPath, name) {
  const n = shq(checkName(name));
  return script(deployPath, [
    'mkdir -p releases shared',
    ...READ_CURRENT,
    'for d in releases/*; do',
    '  [ -d "$d" ] || continue',
    '  [ -f "$d/RELEASE" ] && continue',
    '  [ "${d#releases/}" = "$cur" ] && continue',
    '  rm -rf -- "$d"',
    'done',
    `if [ -e releases/${n} ]; then echo "release "${n}" already exists" >&2; exit 1; fi`,
    `mkdir releases/${n}`,
  ]);
}

/**
 * Mark the upload complete by writing RELEASE (atomically, via rename). Refuses an upload
 * without the site and BBS binary.
 * @param {string} deployPath @param {string} name @param {string} text
 */
export function finalizeCommand(deployPath, name, text) {
  const dir = `releases/${shq(checkName(name))}`;
  return script(deployPath, [
    `if [ ! -d ${dir}/site ] || [ ! -x ${dir}/bin/terminull-ssh ] || [ ! -f ${dir}/bbs.env ]; then`,
    `  echo "release "${dir}" is incomplete" >&2; exit 1`,
    'fi',
    `printf '%s' ${shq(text)} > ${dir}/RELEASE.tmp`,
    `mv ${dir}/RELEASE.tmp ${dir}/RELEASE`,
  ]);
}

/**
 * Atomically point current at a complete release, then restart the BBS.
 * @param {string} deployPath @param {string} name @param {string} [restart] shell command, injectable for tests
 */
export function switchCommand(deployPath, name, restart = RESTART) {
  const n = shq(checkName(name));
  return script(deployPath, [
    `if [ ! -f releases/${n}/RELEASE ]; then echo "release "${n}" is not complete" >&2; exit 1; fi`,
    `ln -sfn releases/${n} current.tmp`,
    'mv -T current.tmp current',
    restart,
  ]);
}

/** Print the release current points at (nothing if none). @param {string} deployPath */
export function previousReleaseCommand(deployPath) {
  return script(deployPath, [...READ_CURRENT, 'if [ -n "$cur" ]; then printf \'%s\\n\' "$cur"; fi']);
}

/**
 * Remove all but the newest `keep` complete releases; never the current target.
 * Release names sort by time.
 * @param {string} deployPath @param {number} keep
 */
export function pruneCommand(deployPath, keep) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error(`invalid keep count: ${keep}`);
  return script(deployPath, [
    ...READ_CURRENT,
    'n=0',
    'for d in $(ls -1 releases | sort -r); do',
    '  [ -f "releases/$d/RELEASE" ] || continue',
    '  n=$((n + 1))',
    `  if [ "$n" -gt ${shq(keep)} ] && [ "$d" != "$cur" ]; then rm -rf -- "releases/$d"; fi`,
    'done',
  ]);
}
