import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('shipped seasonal configuration has a known campaign and explicit-offset launch window when enabled', () => {
  const window = {};
  vm.runInNewContext(read('public/seasonal-config.js'), {window});
  const config = window.CENTRAL_SEASONAL_EXPERIENCE_CONFIG;
  assert.equal(config.id, 'christmas-at-the-movies');
  assert.equal(typeof config.productionEnabled, 'boolean');
  assert.equal(config.previewDefaultOn, false);
  if (config.productionEnabled) {
    for (const date of [config.productionStartsAt, config.productionEndsAt]) {
      assert.match(date, /T.*(?:Z|[+-]\d{2}:\d{2})$/);
      assert.ok(Number.isFinite(Date.parse(date)));
    }
    assert.ok(Date.parse(config.productionEndsAt) > Date.parse(config.productionStartsAt));
  }
});
test('public seasonal assets exist and legacy page CSS stays out of the navigation shell', () => {
  const shell = read('public/index.html');
  assert.doesNotMatch(shell, /(?:src|href)="\/(?:app\.js|styles\.css|christmas-movies\.css|navlab-seasonal\.js)/);
  for (const asset of ['seasonal-config.js', 'seasonal-experience.js', 'central-seasonal.js',
    'navlab-christmas.css', 'central-christmas-loader.css', 'catm-popcorn-lab.js',
    'catm-popcorn-layered.svg', 'CATM_LOGO.svg', 'LoaderPopcornBucket.svg', 'catm-logo-e-overlay.svg']) {
    assert.ok(existsSync(new URL(`../public/${asset}`, import.meta.url)), asset);
  }
  for (const page of ['admin.html', 'planner.html', 'studio.html', 'embed.html', 'privacy.html', 'terms.html', 'about.html']) {
    if (!existsSync(new URL(`../public/${page}`, import.meta.url))) continue;
    assert.doesNotMatch(read(`public/${page}`), /central-seasonal\.js|central-christmas-loader\.css/);
  }
});
