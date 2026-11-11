import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { version, versionLabel } from './version.js';

test('version is SemVer', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(versionLabel, `terminull v${version}`);
});

test('CHANGELOG has a section for the current version', () => {
  const changelog = fs.readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
  const heading = new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
  assert.match(changelog, heading, `CHANGELOG.md needs a "## [${version}] - YYYY-MM-DD" section`);
});
