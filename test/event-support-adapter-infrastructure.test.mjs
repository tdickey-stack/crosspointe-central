import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile, writeFile, lstat, symlink, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadOnlyPcoClient } from '../scripts/event-support-harness/pco-client.mjs';
import { openJournal } from '../scripts/event-support-harness/journal.mjs';

const path = '/services/v2/service_types/12/plans';
const origin = 'https://api.planningcenteronline.com';
const resource = id => ({ type: 'Plan', id: String(id), attributes: { title: `Plan ${id}` } });
const response = (data, { status = 200, headers = {}, ...rest } = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => data, ...rest });
function fixture(responses, options = {}) {
  const calls = [];
  const waits = [];
  const client = createReadOnlyPcoClient({ appId: 'test-app', secret: 'sensitive-secret', fetchImpl: async (...args) => { calls.push(args); const next = responses.shift(); if (next instanceof Error) throw next; if (typeof next === 'function') return next(...args); return next; }, sleepImpl: async delay => { waits.push(delay); }, ...options });
  return { client, calls, waits };
}
async function directory(t) {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'event-support-journal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const code = expected => error => { assert.equal(error.code, expected); assert.doesNotMatch(error.message, /sensitive-secret|test-app|Authorization/); return true; };

test('live transport rejects all non-GET methods before any fetch or URL processing', async () => {
  const { client, calls } = fixture([]);
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'OPTIONS', 'get', undefined]) await assert.rejects(client.request(method, 'https://host.invalid/send_email', { secret: 'sensitive-secret' }), code('LIVE_WRITES_DISABLED'));
  assert.equal(client.mode, 'live-read-only');
  assert.equal(calls.length, 0);
});

test('GET uses fixed-origin Basic auth, versioned Services and manual redirect policy', async () => {
  const { client, calls } = fixture([response({ data: resource(1) }), response({ data: { type: 'Event', id: '2' } })]);
  await client.get(`${path}/1`);
  await client.get('/calendar/v2/events/2');
  assert.equal(calls[0][0], `${origin}${path}/1`);
  assert.equal(calls[0][1].headers.Authorization, `Basic ${Buffer.from('test-app:sensitive-secret').toString('base64')}`);
  assert.equal(calls[0][1].headers['X-PCO-API-Version'], '2018-11-01');
  assert.equal(calls[0][1].redirect, 'manual');
  assert.equal(calls[1][1].headers['X-PCO-API-Version'], '2022-07-07');
  assert.equal(calls[0][1].body, undefined);
});

test('allowlist rejects foreign origins, credentials, action endpoints, path encodings and unsafe queries without fetch', async () => {
  const { client, calls } = fixture([]);
  for (const target of [`http://api.planningcenteronline.com${path}`, `https://api.planningcenteronline.com.evil.test${path}`, `https://test-app:sensitive-secret@api.planningcenteronline.com${path}`, `${path}/1/send_email`, `${path}/x`, '/services/v2/people/1/../../service_types', '/services/v2/%73ervice_types', `${path}?token=sensitive-secret`, `${path}?offset=-1`, `${path}?per_page=101`, `${path}?offset=1&offset=2`, `${path}#fragment`]) await assert.rejects(client.get(target));
  await assert.rejects(client.request('GET', path, {}), code('INVALID_PCO_REQUEST'));
  assert.equal(calls.length, 0);
});

test('documented readback resource endpoints are allowed', async () => {
  const targets = ['/services/v2/teams/1', '/services/v2/service_types/1/plan_times/2', '/services/v2/people/1/plan_people/2', '/services/v2/people/1/plan_people/2/plan_person_times', '/services/v2/people/1/plan_people/2/declined_plan_times'];
  const { client, calls } = fixture(targets.map(() => response({ data: [] })));
  for (const target of targets) await client.get(target);
  assert.equal(calls.length, targets.length);
});

test('redirects are rejected immediately without following or retrying', async () => {
  for (const redirect of [response({}, { status: 302, headers: { location: 'https://evil.test' } }), response({ data: [] }, { redirected: true }), response({ data: [] }, { url: 'https://evil.test' })]) {
    const { client, calls, waits } = fixture([redirect]);
    await assert.rejects(client.get(path), code('PCO_REDIRECT_REJECTED'));
    assert.equal(calls.length, 1); assert.deepEqual(waits, []);
  }
});

test('transient reads retry at most three attempts with bounded Retry-After', async () => {
  const { client, calls, waits } = fixture([response({}, { status: 429, headers: { 'retry-after': '999999' } }), response({}, { status: 503 }), response({ data: [] })]);
  assert.deepEqual(await client.get(path), { data: [] });
  assert.equal(calls.length, 3); assert.deepEqual(waits, [2000, 200]);
  const failing = fixture([new Error('sensitive-secret'), new Error('sensitive-secret'), new Error('sensitive-secret')]);
  await assert.rejects(failing.client.get(path), code('PCO_READ_FAILED'));
  assert.equal(failing.calls.length, 3);
});

test('permission failures never retry or expose response bodies', async () => {
  const { client, calls } = fixture([response({ errors: [{ detail: 'sensitive-secret' }] }, { status: 403 })]);
  await assert.rejects(client.get(path), code('PCO_READ_FAILED'));
  assert.equal(calls.length, 1);
});

test('timeout aborts and retries a stalled transport with bounded attempts', async () => {
  let calls = 0;
  const client = createReadOnlyPcoClient({ appId: 'test-app', secret: 'sensitive-secret', timeoutMs: 5, sleepImpl: async () => {}, fetchImpl: async (_url, { signal }) => {
    calls += 1;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('sensitive-secret')), { once: true }));
  } });
  await assert.rejects(client.get(path), code('PCO_READ_FAILED'));
  assert.equal(calls, 3);
});

test('full pagination preserves query and combines data and deduplicated includes', async () => {
  const query = '?include=plan_times&fields[Plan]=title&where[title]=Test&per_page=1';
  const included = { type: 'PlanTime', id: '10', attributes: {} };
  const { client, calls } = fixture([
    response({ data: [resource(1)], included: [included], meta: { total_count: 2 }, links: { next: `${origin}${path}${query}&offset=1` } }),
    response({ data: [resource(2)], included: [included], meta: { total_count: 2 }, links: { next: null } }),
  ]);
  assert.deepEqual(await client.collection(path + query), { data: [resource(1), resource(2)], included: [included], complete: true });
  assert.equal(calls.length, 2);
});

test('pagination rejects changes of origin, path, or filter before sending the next request', async () => {
  for (const next of [`https://evil.test${path}?where[title]=Test&offset=1`, `${origin}/services/v2/service_types/13/plans?where[title]=Test&offset=1`, `${origin}${path}?offset=1`, `${origin}${path}?where[title]=Other&offset=1`]) {
    const { client, calls } = fixture([response({ data: [resource(1)], meta: { total_count: 2 }, links: { next } })]);
    await assert.rejects(client.collection(`${path}?where[title]=Test`));
    assert.equal(calls.length, 1);
  }
});

test('collection fails closed on partial reads, malformed arrays and inconsistent totals', async () => {
  const pages = [
    [{ data: [resource(1)], meta: { total_count: 2 }, links: {} }],
    [{ data: {} }], [{ data: [], included: {} }], [{ data: [], meta: { total_count: -1 } }],
    [{ data: [resource(1)], links: { next: {} } }],
    [{ data: [resource(1)], meta: { total_count: 2 }, links: { next: `${path}?offset=1` } }, { data: [resource(2)], meta: { total_count: 3 } }],
    [{ data: [resource(1)], links: { next: `${path}?offset=1` } }, { data: [resource(1)] }],
  ];
  for (const scenario of pages) await assert.rejects(fixture(scenario.map(page => response(page))).client.collection(path));
  const failure = fixture([response({ data: [resource(1)], links: { next: `${path}?offset=1` } }), response({}, { status: 403 })]);
  await assert.rejects(failure.client.collection(path), code('PCO_READ_FAILED'));
});

test('pagination rejects loops and enforces page ceiling', async () => {
  await assert.rejects(fixture([response({ data: [resource(1)], links: { next: path } })]).client.collection(path), code('PCO_PAGINATION_LOOP'));
  const limited = fixture([response({ data: [resource(1)], links: { next: `${path}?offset=1` } })], { maxPages: 1 });
  await assert.rejects(limited.client.collection(path), code('PCO_PAGE_LIMIT'));
  assert.equal(limited.calls.length, 1);
});

test('malformed JSON is sanitized and is not retried', async () => {
  const { client, calls } = fixture([response({}, { json: async () => { throw new SyntaxError('sensitive-secret'); } })]);
  await assert.rejects(client.get(path), code('MALFORMED_PCO_RESPONSE'));
  assert.equal(calls.length, 1);
});

test('journal inspect creates no state file, returns copies, and save persists private valid state', async t => {
  const dir = await directory(t);
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  const initial = await journal.inspect();
  assert.deepEqual(initial, { schemaVersion: 1, runId: 'test-run', operations: {}, snapshots: [], history: [] });
  assert.deepEqual(await readdir(dir), []);
  initial.history.push('unpersisted');
  assert.deepEqual((await journal.inspect()).history, []);
  await journal.withLock(async session => { session.state.operations['one'] = { status: 'intent' }; session.state.snapshots.push({ before: true }); await session.save(); });
  const reopened = await openJournal({ directory: dir, runId: 'test-run' });
  assert.equal((await reopened.inspect()).operations.one.status, 'intent');
  assert.equal((await lstat(dir)).mode & 0o777, 0o700);
  assert.equal((await lstat(join(dir, 'test-run.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(dir), ['test-run.json']);
});

test('journal modifications require explicit save and cannot save outside an active session', async t => {
  const journal = await openJournal({ directory: await directory(t), runId: 'test-run' });
  let escaped;
  await journal.withLock(async session => { escaped = session; session.state.history.push('unsaved'); });
  assert.deepEqual((await journal.inspect()).history, []);
  await assert.rejects(escaped.save(), code('JOURNAL_SESSION_INACTIVE'));
});

test('exclusive journal lock rejects a competing writer and releases after callback failure', async t => {
  const dir = await directory(t);
  const one = await openJournal({ directory: dir, runId: 'test-run' });
  const two = await openJournal({ directory: dir, runId: 'test-run' });
  let unlock;
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const pending = one.withLock(async () => { entered(); await new Promise(resolve => { unlock = resolve; }); });
  await ready;
  await assert.rejects(two.withLock(async () => assert.fail('competing callback must not run')), code('JOURNAL_LOCKED'));
  unlock(); await pending;
  const domainError = Object.assign(new Error('Manual repair is required.'), { code: 'NEEDS_REPAIR' });
  await assert.rejects(one.withLock(async () => { throw domainError; }), error => error === domainError);
  await two.withLock(async session => { await session.save(); });
  assert.deepEqual(await readdir(dir), ['test-run.json']);
});

test('journal leaves a stale lock untouched and requires manual recovery', async t => {
  const dir = await directory(t);
  await writeFile(join(dir, 'test-run.lock'), 'stale lock', { mode: 0o600 });
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  await assert.rejects(journal.withLock(async () => {}), code('JOURNAL_LOCKED'));
  assert.equal(await readFile(join(dir, 'test-run.lock'), 'utf8'), 'stale lock');
});

test('journal refuses to overwrite corrupted, truncated, or mismatched state', async t => {
  const dir = await directory(t);
  const target = join(dir, 'test-run.json');
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  for (const contents of ['', '{"schemaVersion":1', JSON.stringify({ schemaVersion: 1, runId: 'different', operations: {}, snapshots: [], history: [] })]) {
    await writeFile(target, contents, { mode: 0o600 });
    await assert.rejects(journal.inspect(), code('JOURNAL_INVALID_STATE'));
    await assert.rejects(journal.withLock(async session => session.save()), code('JOURNAL_INVALID_STATE'));
    assert.equal(await readFile(target, 'utf8'), contents);
  }
});

test('journal rejects symlink directories, state and lock without touching their targets', async t => {
  const dir = await directory(t);
  const real = join(dir, 'real'); await mkdir(real);
  const alias = join(dir, 'alias'); await symlink(real, alias);
  await assert.rejects(openJournal({ directory: alias, runId: 'test-run' }), code('JOURNAL_UNSAFE_PATH'));
  const target = join(dir, 'sentinel'); await writeFile(target, 'sentinel', { mode: 0o600 });
  const journal = await openJournal({ directory: real, runId: 'test-run' });
  await symlink(target, join(real, 'test-run.json'));
  await assert.rejects(journal.inspect(), code('JOURNAL_UNSAFE_PATH'));
  await assert.rejects(journal.withLock(async session => session.save()), code('JOURNAL_UNSAFE_PATH'));
  await rm(join(real, 'test-run.json'));
  await symlink(target, join(real, 'test-run.lock'));
  await assert.rejects(journal.withLock(async () => {}), code('JOURNAL_LOCKED'));
  assert.equal(await readFile(target, 'utf8'), 'sentinel');
});

test('journal run IDs cannot traverse paths and invalid in-memory state never replaces saved state', async t => {
  const dir = await directory(t);
  for (const runId of ['../escape', '', 'Uppercase', 'a'.repeat(81), 'a/b', 1]) await assert.rejects(openJournal({ directory: dir, runId }), code('JOURNAL_INVALID_CONFIGURATION'));
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  await journal.withLock(async session => { await session.save(); });
  const before = await readFile(join(dir, 'test-run.json'), 'utf8');
  await assert.rejects(journal.withLock(async session => { session.state.runId = 'other'; await session.save(); }), code('JOURNAL_INVALID_STATE'));
  assert.equal(await readFile(join(dir, 'test-run.json'), 'utf8'), before);
});


test('transient body-read errors retry and arbitrary error codes cannot leak transport text', async () => {
  const bodyFailure = fixture([response({}, { json: async () => { throw new TypeError('sensitive-secret'); } }), response({ data: [] })]);
  assert.deepEqual(await bodyFailure.client.get(path), { data: [] });
  assert.equal(bodyFailure.calls.length, 2);
  const hostile = fixture(Array.from({ length: 3 }, () => Object.assign(new Error('sensitive-secret'), { code: 'PCO_READ_FAILED' })));
  await assert.rejects(hostile.client.get(path), code('PCO_READ_FAILED'));
});

test('journal retains its lock until an explicitly initiated save finishes, even if caller omits await', async t => {
  const dir = await directory(t);
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  await journal.withLock(async session => {
    session.state.history.push('saved before unlock');
    session.save();
    await assert.rejects(session.save(), code('JOURNAL_SESSION_INACTIVE'));
  });
  assert.deepEqual((await journal.inspect()).history, ['saved before unlock']);
  assert.deepEqual(await readdir(dir), ['test-run.json']);
});

test('journal atomic replacements remain parseable through repeated writes and independent reads', async t => {
  const dir = await directory(t);
  const journal = await openJournal({ directory: dir, runId: 'test-run' });
  await journal.withLock(async session => {
    await session.save();
    for (let i = 0; i < 12; i += 1) {
      session.state.history.push({ i, payload: 'x'.repeat(4096) });
      const saving = session.save();
      for (let read = 0; read < 5; read += 1) {
        const visible = JSON.parse(await readFile(join(dir, 'test-run.json'), 'utf8'));
        assert.ok(visible.history.length === i || visible.history.length === i + 1);
      }
      await saving;
    }
  });
  assert.equal((await journal.inspect()).history.length, 12);
});
