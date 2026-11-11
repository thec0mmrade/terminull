import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOL = 97; // a number no real volume uses, so no real PDF is touched

/** Run the exporter against a temp volumes dir; a browser launch would fail loudly. @param {string} volumesDir */
function exportZine(volumesDir) {
  return spawnSync(process.execPath, ['scripts/export-zine.js', '--volume', String(VOL)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TERMINULL_VOLUMES_DIR: volumesDir, PUPPETEER_EXECUTABLE_PATH: '/nonexistent/chromium' },
  });
}

test('export-zine skips a volume with only drafts (exit 0, no PDFs)', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-zine-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tmp, `vol${VOL}`));
  fs.writeFileSync(path.join(tmp, `vol${VOL}`, '01-wip.md'), '---\ntitle: WIP\ndraft: true\norder: 1\n---\n\nnot yet\n');

  const r = exportZine(tmp);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`volume ${VOL} has no published articles; skipping`));
  assert.ok(!fs.existsSync(path.join(ROOT, 'public', 'zine', `terminull-vol${VOL}.pdf`)));
});

test('export-zine still fails for a volume that does not exist', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'terminull-zine-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const r = exportZine(tmp);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Volume directory not found/);
});
