import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainMenu, latestVolume, volumeSummary, MOTD_TEXT } from './home.js';

test('main menu: Latest Volume first, then Archive, About, Manifesto, Help', () => {
  const menu = mainMenu({ number: 3, articles: 12 });
  assert.deepEqual(menu.map((i) => i.label), ['Latest Volume', 'Archive', 'About', 'Manifesto', 'Help']);
  assert.equal(menu[0].href, '/vol/3');
  assert.equal(menu[0].txt, '/vol/3/index.txt');
  assert.equal(menu[0].description, 'Volume 03, 12 articles');
  assert.equal(menu[1].href, '/vol');
});

test('main menu without published volumes starts at Archive', () => {
  assert.deepEqual(mainMenu(null).map((i) => i.label), ['Archive', 'About', 'Manifesto', 'Help']);
});

test('latestVolume picks the highest volume and counts its articles', () => {
  const a = (volume) => ({ data: { volume } });
  assert.deepEqual(latestVolume([a(1), a(2), a(2), a(1), a(2)]), { number: 2, articles: 3 });
  assert.equal(latestVolume([]), null);
});

test('volumeSummary pads and pluralises', () => {
  assert.equal(volumeSummary(1, 1), 'Volume 01, 1 article');
  assert.equal(volumeSummary(12, 2), 'Volume 12, 2 articles');
});

test('MOTD names terminull', () => {
  assert.match(MOTD_TEXT, /^Welcome to terminull\./);
});
