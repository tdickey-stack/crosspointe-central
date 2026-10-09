import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const shell = read('public/index.html');
const config = JSON.parse(read('firebase.json')).hosting;
test('public root uses the new navigation without lab or seasonal controls', () => {
  assert.match(shell, /data-production-shell="true"/);
  assert.match(shell, /navlab\.js/);
  assert.doesNotMatch(shell, /Navigation Lab|class="lab-note"|noindex|navlab-seasonal|navlab-christmas|seasonal-experience/);
  assert.match(shell, /manifest\.webmanifest/);
  assert.match(shell, /central-public-boot\.js/);
  for (const asset of ['central-analytics.js', 'push-notifications.js', 'wayfinder-chat.js']) assert.ok(shell.includes(asset));
  assert.doesNotMatch(shell, /src="\/app\.js"/);
});
test('Admin and rollback routes precede the public fallback and keep original boot', () => {
  const admin = config.rewrites.findIndex((route) => route.source === '/admin{,/**}');
  const fallback = config.rewrites.findIndex((route) => route.source === '**');
  assert.ok(admin >= 0 && admin < fallback);
  assert.equal(config.rewrites[admin].destination, '/legacy.html');
  assert.equal(config.rewrites.find((route) => route.source === '/legacy{,/**}').destination, '/legacy.html');
  assert.equal(config.rewrites[fallback].destination, '/index.html');
  assert.match(read('public/legacy.html'), /admin\.js/);
  assert.match(read('public/legacy.html'), /var isAdminRoute/);
});
test('Home promotions API is routed before the public fallback', () => {
  const route = config.rewrites.find((route) => route.source === '/api/admin/home-promotions');
  assert.equal(route.function.functionId, 'homePromotionsAdmin');
  assert.equal(route.function.pinTag, false);
});
