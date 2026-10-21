import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewCreation } from '../scripts/event-support-harness/creation-plan.mjs';
import { createCreationPcoClient } from '../scripts/event-support-harness/creation-client.mjs';
import { hash } from '../scripts/event-support-harness/scope.mjs';

const origin = 'https://api.planningcenteronline.com';
const secret = 'sensitive-secret';

const scopeFixture = () => ({
  schemaVersion: 1,
  runId: 'central-notifications-2026-10-28',
  timezone: 'America/Chicago',
  serviceTypeName: 'Event Support',
  serviceTypeId: '12',
  team: {
    id: '34',
    name: 'Tech',
    arrivalOffsetMinutes: 60,
    requirements: [{ role: 'Sound', quantity: 1 }, { role: 'Graphics', quantity: 1 }],
  },
  people: {
    leaderId: '56',
    responseRecipientId: '56',
    participants: [
      { id: '78', name: 'Riley Baker', role: 'Sound' },
      { id: '56', name: 'Tyler Dickey', role: 'Graphics' },
    ],
  },
  occurrences: [
    {
      key: 'A', title: 'TEST — Central Notifications A', eventId: '101', instanceId: '201', planId: null,
      timeIds: { arrival: null, event: null }, startsAt: '2026-10-28T23:00:00Z', endsAt: '2026-10-29T00:00:00Z', arrivalOffsetMinutes: null,
    },
    {
      key: 'B', title: 'TEST — Central Notifications B — Control', eventId: '102', instanceId: '202', planId: null,
      timeIds: { arrival: null, event: null }, startsAt: '2026-10-28T23:00:00Z', endsAt: '2026-10-29T00:00:00Z', arrivalOffsetMinutes: null,
    },
  ],
  reschedule: { key: 'A', startsAt: '2026-10-30T00:00:00Z', endsAt: '2026-10-30T01:00:00Z' },
});

const response = (payload, { status = 200, url, redirected = false } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  redirected,
  url,
  json: async () => payload,
});

const clone = value => structuredClone(value);
const materialize = (operation, planId) => JSON.parse(JSON.stringify(operation).replaceAll(`<${operation.key.split(':')[1]}.planId>`, planId));
const planIntent = operation => ({ path: operation.path, type: operation.body.data.type, attributes: operation.body.data.attributes });

function journalState(review, operation, { planId = '901', overrides = {} } = {}) {
  const key = operation.key.split(':')[1];
  const state = {
    schemaVersion: 1,
    runId: 'central-notifications-2026-10-28',
    scopeHash: review.scopeHash,
    bindings: {},
    operations: {},
    snapshots: [],
    history: [],
  };
  let expected = operation;
  if (operation.key.startsWith('create-plan:')) {
    const intent = planIntent(operation);
    state.operations[operation.key] = { status: 'intent', intentHash: hash(intent), ...clone(intent) };
  } else {
    expected = materialize(operation, planId);
    state.bindings[key] = { planId };
    const originalPlan = review.operations.find(item => item.key === `create-plan:${key}`);
    const originalIntent = planIntent(originalPlan);
    state.operations[`create-plan:${key}`] = { status: 'complete', resourceId: planId, intentHash: hash(originalIntent), ...clone(originalIntent) };
    if (operation.key.startsWith('disable-reminders:')) {
      const action = {
        key: 'disable-reminders', method: 'PATCH', path: expected.path, type: 'Plan', id: planId,
        before: { reminders_disabled: false }, after: { reminders_disabled: true }, body: expected.body,
      };
      state.operations[operation.key] = { status: 'intent', intentHash: hash(action), action: clone(action) };
    } else {
      const intent = planIntent(expected);
      state.operations[operation.key] = { status: 'intent', intentHash: hash(intent), ...clone(intent) };
    }
  }
  Object.assign(state, clone(overrides));
  return { state, expected };
}

function clientFixture({ scope = scopeFixture(), approvalHash, state, responses = [], journal } = {}) {
  const review = reviewCreation(scope);
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(...args);
    return next;
  };
  const client = createCreationPcoClient({
    scope,
    approvalHash: approvalHash ?? review.approvalHash,
    journal: journal ?? { inspect: async () => clone(state) },
    appId: 'test-app',
    secret,
    fetchImpl,
    timeoutMs: 20,
    sleepImpl: async () => {},
  });
  return { client, calls, review };
}

const errorCode = expected => error => {
  assert.equal(error.code, expected);
  assert.doesNotMatch(error.message, /sensitive-secret|test-app|Authorization/);
  return true;
};

test('offline creation review is deterministic, covers the complete scope, and lists exactly eight bounded writes', () => {
  const scope = scopeFixture();
  const first = reviewCreation(scope);
  assert.deepEqual(first, reviewCreation(clone(scope)));
  assert.equal(first.phase, 'create-empty-plans');
  assert.equal(first.invitationsEnabled, false);
  assert.equal(first.maximumMutations, 8);
  assert.equal(first.operations.length, 8);
  assert.deepEqual(first.operations.map(item => item.key), [
    'create-plan:A', 'disable-reminders:A', 'create-time:A:arrival', 'create-time:A:event',
    'create-plan:B', 'disable-reminders:B', 'create-time:B:arrival', 'create-time:B:event',
  ]);
  assert.deepEqual(first.operations[0], {
    key: 'create-plan:A', method: 'POST', path: '/services/v2/service_types/12/plans',
    body: { data: { type: 'Plan', attributes: { title: 'TEST — Central Notifications A [central-notifications-2026-10-28:A]', public: false } } },
  });
  assert.equal(first.operations[1].path, '/services/v2/service_types/12/plans/<A.planId>');
  assert.equal(first.operations[1].body.data.id, '<A.planId>');
  assert.deepEqual(first.operations[2].body.data.attributes, {
    name: 'central-notifications-2026-10-28:A:arrival', time_type: 'other',
    starts_at: '2026-10-28T22:00:00.000Z', ends_at: '2026-10-28T23:00:00.000Z', team_reminders: [],
  });
  assert.deepEqual(first.operations[3].body.data.attributes, {
    name: 'central-notifications-2026-10-28:A:event', time_type: 'service',
    starts_at: '2026-10-28T23:00:00.000Z', ends_at: '2026-10-29T00:00:00.000Z', team_reminders: [],
  });
  const manifest = { ...first }; delete manifest.approvalHash;
  assert.equal(first.approvalHash, hash(manifest));

  const scheduleChanged = clone(scope); scheduleChanged.occurrences[0].startsAt = '2026-10-28T23:15:00Z'; scheduleChanged.occurrences[0].endsAt = '2026-10-29T00:15:00Z';
  const participantChanged = clone(scope); participantChanged.people.participants[0].name = 'Riley B.';
  const targetChanged = clone(scope); targetChanged.reschedule.startsAt = '2026-10-30T00:15:00Z'; targetChanged.reschedule.endsAt = '2026-10-30T01:15:00Z';
  for (const changed of [scheduleChanged, participantChanged, targetChanged]) {
    assert.notEqual(reviewCreation(changed).scopeHash, first.scopeHash);
    assert.notEqual(reviewCreation(changed).approvalHash, first.approvalHash);
  }
});

test('creation blockers are limited to missing fixed IDs and already configured plan/time IDs', () => {
  const scope = scopeFixture();
  scope.serviceTypeId = null;
  scope.team.id = null;
  scope.occurrences[0].eventId = null;
  scope.occurrences[0].instanceId = null;
  scope.occurrences[1].planId = '400';
  scope.occurrences[1].timeIds.arrival = '401';
  assert.deepEqual(reviewCreation(scope).blockers, [
    'Explicit Event Support service type ID required.',
    'Explicit Tech team ID required.',
    'A: explicit eventId required.',
    'A: explicit instanceId required.',
    'B: planId must be null for creation.',
    'B: arrival time ID must be null for creation.',
  ]);
});

test('approval and blockers fail before credentials, journal inspection, or fetch', () => {
  let inspected = 0;
  const journal = { inspect: async () => { inspected += 1; return {}; } };
  assert.throws(() => createCreationPcoClient({ scope: scopeFixture(), appId: '', secret: '', journal }), errorCode('CREATION_APPROVAL_REQUIRED'));
  assert.throws(() => createCreationPcoClient({ scope: scopeFixture(), approvalHash: '0'.repeat(64), appId: '', secret: '', journal }), errorCode('CREATION_APPROVAL_REQUIRED'));
  const blocked = scopeFixture(); blocked.team.id = null;
  assert.throws(() => createCreationPcoClient({ scope: blocked, approvalHash: reviewCreation(blocked).approvalHash, appId: '', secret: '', journal }), errorCode('CREATION_BLOCKED'));
  assert.equal(inspected, 0);
});

test('all eight exact approved writes use fixed transport policy and accept one safe response', async () => {
  const scope = scopeFixture();
  const review = reviewCreation(scope);
  for (const operation of review.operations) {
    const { state, expected } = journalState(review, operation);
    const responseId = expected.method === 'PATCH' ? expected.body.data.id : operation.key.startsWith('create-plan:') ? '901' : '902';
    const { client, calls } = clientFixture({ scope, state, responses: [response({ data: { type: expected.body.data.type, id: responseId, attributes: {} } })] });
    const result = await client.request(expected.method, expected.path, clone(expected.body));
    assert.equal(result.data.id, responseId);
    assert.equal(client.mode, 'live-creation');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], `${origin}${expected.path}`);
    assert.equal(calls[0][1].method, expected.method);
    assert.equal(calls[0][1].redirect, 'manual');
    assert.equal(calls[0][1].headers.Authorization, `Basic ${Buffer.from(`test-app:${secret}`).toString('base64')}`);
    assert.equal(calls[0][1].headers['X-PCO-API-Version'], '2018-11-01');
    assert.deepEqual(JSON.parse(calls[0][1].body), expected.body);
  }
});

test('client keeps an immutable reviewed copy of scope inputs', async () => {
  const scope = scopeFixture();
  const review = reviewCreation(scope);
  const operation = review.operations[0];
  const { state, expected } = journalState(review, operation);
  const { client, calls } = clientFixture({ scope, state, responses: [response({ data: { type: 'Plan', id: '901', attributes: {} } })] });
  scope.serviceTypeId = '999';
  scope.occurrences[0].title = 'changed after approval';
  await client.request(expected.method, expected.path, expected.body);
  assert.equal(calls[0][0], `${origin}/services/v2/service_types/12/plans`);
});

test('request body is snapshotted before asynchronous journal inspection', async () => {
  const review = reviewCreation(scopeFixture());
  const operation = review.operations[0];
  const { state, expected } = journalState(review, operation);
  let releaseInspection;
  const inspection = new Promise(resolve => { releaseInspection = () => resolve(clone(state)); });
  const { client, calls } = clientFixture({
    state,
    journal: { inspect: async () => inspection },
    responses: [response({ data: { type: 'Plan', id: '901', attributes: {} } })],
  });
  const body = clone(expected.body);
  const pending = client.request(expected.method, expected.path, body);
  body.data.attributes.public = true;
  body.data.attributes.title = secret;
  releaseInspection();
  await pending;
  assert.deepEqual(JSON.parse(calls[0][1].body), expected.body);
});

test('one client dispatches each journal intent only once, including concurrent calls', async () => {
  const review = reviewCreation(scopeFixture());
  const operation = review.operations[0];
  const { state, expected } = journalState(review, operation);
  let releaseFetch;
  let enteredFetch;
  const entered = new Promise(resolve => { enteredFetch = resolve; });
  const { client, calls } = clientFixture({
    state,
    responses: [async () => {
      enteredFetch();
      return new Promise(resolve => { releaseFetch = () => resolve(response({ data: { type: 'Plan', id: '901', attributes: {} } })); });
    }],
  });
  const first = client.request(expected.method, expected.path, clone(expected.body));
  await entered;
  await assert.rejects(client.request(expected.method, expected.path, clone(expected.body)), errorCode('CREATION_DUPLICATE_WRITE'));
  assert.equal(calls.length, 1);
  releaseFetch();
  await first;
  await assert.rejects(client.request(expected.method, expected.path, clone(expected.body)), errorCode('CREATION_DUPLICATE_WRITE'));
  assert.equal(calls.length, 1);
});

test('forbidden methods, paths, actions, encodings, and payload drift make zero fetches', async () => {
  const review = reviewCreation(scopeFixture());
  const operation = review.operations[0];
  const { state, expected } = journalState(review, operation);
  const { client, calls } = clientFixture({ state });
  const attempts = [
    ['DELETE', expected.path, expected.body],
    ['PUT', expected.path, expected.body],
    ['POST', `https://evil.test${expected.path}`, expected.body],
    ['POST', `${expected.path}?send=true`, expected.body],
    ['POST', expected.path.replace('/services/', '/%73ervices/'), expected.body],
    ['POST', `${expected.path}/send_email`, expected.body],
    ['POST', expected.path, { ...expected.body, invitations: true }],
    ['POST', expected.path, { data: { type: 'PlanPerson', attributes: expected.body.data.attributes } }],
    ['POST', expected.path, new Proxy(expected.body, {})],
  ];
  for (const [method, path, body] of attempts) await assert.rejects(client.request(method, path, body));
  assert.equal(calls.length, 0);
});

test('scope, intent, status, binding, and plan-ownership journal failures make zero fetches', async () => {
  const scope = scopeFixture();
  const review = reviewCreation(scope);
  const operation = review.operations.find(item => item.key === 'create-time:A:arrival');
  const baseline = journalState(review, operation);
  const mutations = [
    state => { state.scopeHash = '0'.repeat(64); },
    state => { delete state.operations[operation.key]; },
    state => { state.operations[operation.key].status = 'complete'; },
    state => { state.operations[operation.key].intentHash = '0'.repeat(64); },
    state => { state.bindings.A.planId = '999'; },
    state => { state.operations['create-plan:A'].status = 'intent'; },
    state => { state.operations['create-plan:A'].attributes.public = true; },
    state => { state.bindings.A.arrival = '902'; },
  ];
  for (const mutate of mutations) {
    const state = clone(baseline.state); mutate(state);
    const { client, calls } = clientFixture({ scope, state });
    await assert.rejects(client.request(baseline.expected.method, baseline.expected.path, baseline.expected.body));
    assert.equal(calls.length, 0);
  }
});

test('write failures, redirects, malformed success, and timeout are uncertain after exactly one fetch and never leak secrets', async () => {
  const review = reviewCreation(scopeFixture());
  const operation = review.operations[0];
  const { state, expected } = journalState(review, operation);
  const scenarios = [
    response({ errors: [{ detail: secret }] }, { status: 429 }),
    response({ errors: [{ detail: secret }] }, { status: 503 }),
    response({}, { status: 302, url: 'https://evil.test', redirected: true }),
    response({ data: { type: 'Plan', id: 'not-numeric', attributes: {} } }),
    response({}, { status: 201 }),
    new Error(secret),
    Object.assign(new Error(secret), { code: 'PCO_WRITE_OUTCOME_UNKNOWN' }),
    async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error(secret)), { once: true })),
  ];
  for (const scenario of scenarios) {
    const { client, calls } = clientFixture({ state, responses: [scenario] });
    await assert.rejects(client.request(expected.method, expected.path, expected.body), errorCode('PCO_WRITE_OUTCOME_UNKNOWN'));
    assert.equal(calls.length, 1);
  }
});

test('GET and collection retain the bounded read-only transport behavior', async () => {
  const review = reviewCreation(scopeFixture());
  const { state } = journalState(review, review.operations[0]);
  const payload = { data: [], meta: { total_count: 0 }, links: { next: null } };
  const { client, calls } = clientFixture({ state, responses: [response(payload)] });
  assert.deepEqual(await client.collection('/services/v2/service_types?per_page=100'), { data: [], included: [], complete: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].body, undefined);
});
