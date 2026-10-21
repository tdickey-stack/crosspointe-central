import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCreationArgs } from '../scripts/event-support-harness/creation-cli.mjs';

const cli = fileURLToPath(new URL('../scripts/event-support-harness/creation-cli.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, PCO_APP_ID: '', PCO_SECRET: '' } });

test('creation CLI defaults to a deterministic offline manifest with no participants', () => {
  const first = run([]);
  const second = run(['--preview']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  const review = JSON.parse(first.stdout);
  assert.equal(review.phase, 'create-empty-plans');
  assert.equal(review.invitationsEnabled, false);
  assert.equal(review.operations.length, 8);
  assert.deepEqual(review.blockers, []);
  assert.doesNotMatch(JSON.stringify(review.operations), /PlanPerson|send_email|autoschedule|\/import/);
});

test('creation CLI rejects incomplete authorization, conflicting modes and scope-expanding flags', () => {
  for (const args of [
    ['--execute-create'], ['--approve-hash', 'a'.repeat(64)], ['--journal-dir', '/private/tmp/example'],
    ['--execute-create', '--approve-hash', 'wrong', '--journal-dir', '/private/tmp/example'],
    ['--preview', '--execute-create'], ['--preview', '--preview'], ['--send'], ['--reschedule'],
    ['--assign'], ['--live'], ['--config'], ['--execute-create', '--execute-create'],
  ]) assert.throws(() => parseCreationArgs(args), { code: 'INVALID_ARGUMENT' });
});

test('creation CLI recognizes only an explicit bounded execution command', () => {
  const parsed = parseCreationArgs(['--execute-create', '--approve-hash', 'a'.repeat(64), '--journal-dir', '/private/tmp/example']);
  assert.equal(parsed.mode, 'execute-create');
  assert.equal(parsed.approvalHash, 'a'.repeat(64));
});

test('creation CLI stops on wrong approval or missing source links before credentials', t => {
  const wrong = run(['--execute-create', '--approve-hash', 'a'.repeat(64), '--journal-dir', '/private/tmp/never-create-this-creation-test']);
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /CREATION_APPROVAL_REQUIRED/);
  const directory = mkdtempSync(join(tmpdir(), 'event-support-unlinked-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = JSON.parse(readFileSync(new URL('../scripts/event-support-harness/selected-test-plan.json', import.meta.url), 'utf8'));
  for (const occurrence of config.occurrences) {
    occurrence.eventId = null;
    occurrence.instanceId = null;
  }
  const configPath = join(directory, 'unlinked.json');
  writeFileSync(configPath, JSON.stringify(config));
  const review = JSON.parse(run(['--preview', '--config', configPath]).stdout);
  assert.equal(review.blockers.length, 4);
  const blocked = run(['--execute-create', '--config', configPath, '--approve-hash', review.approvalHash, '--journal-dir', '/private/tmp/never-create-this-creation-test']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /SETUP_REQUIRED/);
  assert.doesNotMatch(blocked.stderr, /INVALID_PCO_CONFIGURATION/);
});

test('creation help performs no configuration or credential access', () => {
  const result = run(['--help', '--config', '/file-that-does-not-exist']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /invitations disabled/);
});
