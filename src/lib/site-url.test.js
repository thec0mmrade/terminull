import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl, siteHost } from './site-url.js';

test('defaults to terminull.local', () => {
  assert.equal(siteUrl({}), 'https://terminull.local');
});

test('uses TERMINULL_SITE_URL and strips trailing slash', () => {
  assert.equal(siteUrl({ TERMINULL_SITE_URL: 'https://a.example.com/' }), 'https://a.example.com');
});

test('siteHost is the URL host, defaulting to terminull.local', () => {
  assert.equal(siteHost({}), 'terminull.local');
  assert.equal(siteHost({ TERMINULL_SITE_URL: 'https://zine.example.com/' }), 'zine.example.com');
  assert.equal(siteHost({ TERMINULL_SITE_URL: 'http://localhost:4321' }), 'localhost:4321');
  assert.equal(siteHost({ TERMINULL_SITE_URL: 'not a url' }), 'terminull.local');
});
