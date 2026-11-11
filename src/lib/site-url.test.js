import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl } from './site-url.js';

test('defaults to terminull.local', () => {
  assert.equal(siteUrl({}), 'https://terminull.local');
});

test('uses TERMINULL_SITE_URL and strips trailing slash', () => {
  assert.equal(siteUrl({ TERMINULL_SITE_URL: 'https://a.example.com/' }), 'https://a.example.com');
});
