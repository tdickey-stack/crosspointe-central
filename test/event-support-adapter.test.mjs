import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hash, planTitle, reviewPlan, validateScope } from '../scripts/event-support-harness/scope.mjs';
import { reviewCreation } from '../scripts/event-support-harness/creation-plan.mjs';
import { createCreationPcoClient } from '../scripts/event-support-harness/creation-client.mjs';
import { createAdapter } from '../scripts/event-support-harness/adapter.mjs';
import { collectReadOnlyReport, parseArgs } from '../scripts/event-support-harness/adapter-cli.mjs';
import { openJournal } from '../scripts/event-support-harness/journal.mjs';

const configUrl = new URL('../scripts/event-support-harness/selected-test-plan.json', import.meta.url);
const awaitedConfig = await readFile(configUrl, 'utf8');
const selected = () => JSON.parse(awaitedConfig);
const cliPath = fileURLToPath(new URL('../scripts/event-support-harness/adapter-cli.mjs', import.meta.url));

function configuredScope() {
  const scope = selected();
  scope.serviceTypeId = '700';
  scope.team.id = '701';
  Object.assign(scope.occurrences[0], {
    eventId: '800', instanceId: '801', planId: '802',
    timeIds: { arrival: '803', event: '804' },
  });
  Object.assign(scope.occurrences[1], {
    eventId: '900', instanceId: '901', planId: '902',
    timeIds: { arrival: '903', event: '904' },
  });
  return scope;
}

function creationScope() {
  const scope = configuredScope();
  for (const occurrence of scope.occurrences) {
    occurrence.planId = null;
    occurrence.timeIds = { arrival: null, event: null };
  }
  return scope;
}

const relationship = (type, id) => ({ data: { type, id: String(id) } });
const relationships = (type, ids) => ({ data: ids.map(id => ({ type, id: String(id) })) });
const row = (type, id, attributes, related = {}) => ({
  type,
  id: String(id),
  attributes: structuredClone(attributes),
  relationships: structuredClone(related),
});

async function journalDirectory(t) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'event-support-adapter-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function simulationFixture(scope, { calendarA = 'original' } = {}) {
  const gets = new Map();
  const collections = new Map();
  const calls = [];
  const drops = { postPlan: 'none', postTimeName: null, patchPath: null, afterRequest: null, afterCollection: null };
  const base = `/services/v2/service_types/${scope.serviceTypeId}`;
  const clone = value => structuredClone(value);
  const setGet = (path, value) => gets.set(path, value);
  const setCollection = (path, data, complete = true) => collections.set(path, { data, included: [], complete });
  const service = row('ServiceType', scope.serviceTypeId, { name: 'Event Support', scheduled_publish: false });
  const team = row('Team', scope.team.id, {
    name: 'Tech', schedule_to: 'plan', default_status: 'U', default_prepare_notifications: false,
    archived_at: null, deleted_at: null,
  }, {
    service_type: relationship('ServiceType', scope.serviceTypeId),
    default_responds_to: relationship('Person', scope.people.responseRecipientId),
  });
  setGet(base, service);
  setGet(`/services/v2/teams/${scope.team.id}`, team);
  setCollection(`/services/v2/teams/${scope.team.id}/team_leaders?per_page=100`, [
    row('TeamLeader', '710', { send_responses_for_accepts: true, send_responses_for_declines: true }, {
      person: relationship('Person', scope.people.leaderId), team: relationship('Team', scope.team.id),
    }),
  ]);
  setCollection(`/services/v2/teams/${scope.team.id}/team_positions?per_page=100`, [
    row('TeamPosition', '711', { name: 'Sound' }, { team: relationship('Team', scope.team.id) }),
    row('TeamPosition', '712', { name: 'Graphics' }, { team: relationship('Team', scope.team.id) }),
  ]);
  for (const person of scope.people.participants) setGet(`/services/v2/people/${person.id}`, row('Person', person.id, {
    first_name: person.name.split(' ')[0], last_name: person.name.split(' ').slice(1).join(' '), permissions: 'Scheduler',
    email_addresses: ['must-not-be-projected@example.test'], phone_numbers: ['+15555550123'],
  }));

  for (const occurrence of scope.occurrences) {
    const moved = occurrence.key === 'A' && calendarA === 'target';
    const startsAt = moved ? scope.reschedule.startsAt : occurrence.startsAt;
    const endsAt = moved ? scope.reschedule.endsAt : occurrence.endsAt;
    setGet(`/calendar/v2/event_instances/${occurrence.instanceId}`, row('EventInstance', occurrence.instanceId, {
      all_day_event: false, starts_at: startsAt, ends_at: endsAt,
      description: 'raw Calendar description must not be persisted', location: 'private fixture location',
    }, { event: relationship('Event', occurrence.eventId) }));

    if (!occurrence.planId) continue;

    const planPath = `${base}/plans/${occurrence.planId}`;
    setGet(planPath, row('Plan', occurrence.planId, {
      title: planTitle(scope, occurrence.key), public: false, public_by_schedule: false, reminders_disabled: true,
      planning_center_url: 'https://example.test/private', permissions: 'Editor',
    }, { service_type: relationship('ServiceType', scope.serviceTypeId) }));
    // Calendar A may already be moved; mapped Services times remain at the
    // reviewed baseline until the adapter applies its journaled proposal.
    const schedule = { startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, arrivalAt: '2026-10-28T22:00:00Z' };
    const planTimes = [
      row('PlanTime', occurrence.timeIds.arrival, {
        name: `${scope.runId}:${occurrence.key}:arrival`, time_type: 'other', starts_at: schedule.arrivalAt,
        ends_at: schedule.startsAt, team_reminders: [], scheduled_team_ids: [scope.team.id],
      }),
      row('PlanTime', occurrence.timeIds.event, {
        name: `${scope.runId}:${occurrence.key}:event`, time_type: 'service', starts_at: schedule.startsAt,
        ends_at: schedule.endsAt, team_reminders: [], scheduled_team_ids: [scope.team.id],
      }),
    ];
    setCollection(`${planPath}/plan_times?per_page=100`, planTimes);
    for (const time of planTimes) setGet(`${base}/plan_times/${time.id}`, time);

    const memberRows = occurrence.key === 'A' ? scope.people.participants.map((person, index) => {
      const confirmed = person.role === 'Sound';
      const member = row('PlanPerson', String(820 + index), {
        can_accept_partial: false, status: confirmed ? 'C' : 'D', team_position_name: person.role,
        prepare_notification: true,
        notification_sent_at: '2026-10-20T12:00:00Z', notification_prepared_at: '2026-10-20T11:00:00Z',
        status_updated_at: '2026-10-20T13:00:00Z', decline_reason: confirmed ? null : 'fixture reason',
        name: person.name, notes: 'raw notes must not be projected', photo_thumbnail: 'https://example.test/private.jpg',
      }, {
        person: relationship('Person', person.id), team: relationship('Team', scope.team.id),
        plan: relationship('Plan', occurrence.planId), service_type: relationship('ServiceType', scope.serviceTypeId),
        responds_to: relationship('Person', scope.people.responseRecipientId),
        times: relationships('PlanTime', [occurrence.timeIds.arrival, occurrence.timeIds.event]),
      });
      setGet(`/services/v2/people/${person.id}/plan_people/${member.id}`, member);
      return member;
    }) : [];
    setCollection(`${planPath}/team_members?per_page=100`, memberRows);
    const needed = scope.team.requirements.map((requirement, index) => row('NeededPosition', String(Number(occurrence.planId) + 20 + index), {
      quantity: requirement.quantity, scheduled_to: 'plan', team_position_name: requirement.role,
    }, {
      plan: relationship('Plan', occurrence.planId), team: relationship('Team', scope.team.id),
      time: relationship('PlanTime', occurrence.timeIds.event),
    }));
    setCollection(`${planPath}/needed_positions?per_page=100`, needed);
  }

  const plansPath = `${base}/plans?per_page=100`;
  setCollection(plansPath, scope.occurrences.filter(item => item.planId).map(item => gets.get(`${base}/plans/${item.planId}`)));

  const client = {
    mode: 'simulation',
    async get(path) {
      calls.push({ kind: 'get', path });
      assert.ok(gets.has(path), `Unexpected GET ${path}`);
      return { data: clone(gets.get(path)) };
    },
    async collection(path) {
      calls.push({ kind: 'collection', path });
      assert.ok(collections.has(path), `Unexpected collection ${path}`);
      const result = clone(collections.get(path));
      drops.afterCollection?.(path);
      return result;
    },
    async request(method, path, body) {
      calls.push({ kind: 'request', method, path, body: clone(body) });
      assert.ok(['POST', 'PATCH'].includes(method), `Forbidden method ${method}`);
      assert.doesNotMatch(path, /send|notify|invite|email/i);
      if (method === 'PATCH') {
        const target = gets.get(path);
        assert.ok(target, `Unexpected PATCH ${path}`);
        Object.assign(target.attributes, body.data.attributes);
        drops.afterRequest?.(calls.at(-1));
        if (drops.patchPath === path) {
          drops.patchPath = null;
          throw new Error('simulated dropped PATCH response');
        }
        return { data: clone(target) };
      }
      if (path === `${base}/plans`) {
        const occurrence = scope.occurrences.find(item => body.data.attributes.title === planTitle(scope, item.key));
        assert.ok(occurrence, 'Created plan must use an exact reviewed marker');
        const id = occurrence.key === 'A' ? '1001' : '1101';
        const created = row('Plan', id, { ...body.data.attributes, reminders_disabled: false, public_by_schedule: false }, {
          service_type: relationship('ServiceType', scope.serviceTypeId),
        });
        const listing = collections.get(plansPath).data;
        if (drops.postPlan !== 'before') {
          listing.push(created);
          setGet(`${base}/plans/${id}`, created);
          setCollection(`${base}/plans/${id}/plan_times?per_page=100`, []);
          setCollection(`${base}/plans/${id}/team_members?per_page=100`, []);
          setCollection(`${base}/plans/${id}/needed_positions?per_page=100`, []);
        }
        drops.afterRequest?.(calls.at(-1));
        const behavior = drops.postPlan;
        drops.postPlan = 'none';
        if (behavior !== 'none') throw new Error('simulated dropped POST response');
        return { data: clone(created) };
      }
      const match = path.match(new RegExp(`^${base}/plans/(\\d+)/plan_times$`));
      assert.ok(match, `Unexpected POST ${path}`);
      const key = body.data.attributes.name.split(':').at(-2);
      assert.ok(['A', 'B'].includes(key), 'Created time must use an exact reviewed marker');
      const ids = key === 'A' ? { arrival: '1003', event: '1004' } : { arrival: '1103', event: '1104' };
      const kind = body.data.attributes.name.endsWith(':arrival') ? 'arrival' : 'event';
      const id = ids[kind];
      const created = row('PlanTime', id, body.data.attributes);
      collections.get(`${path}?per_page=100`).data.push(created);
      setGet(`${base}/plan_times/${id}`, created);
      drops.afterRequest?.(calls.at(-1));
      if (drops.postTimeName === body.data.attributes.name) {
        drops.postTimeName = null;
        throw new Error('simulated dropped PlanTime POST response');
      }
      return { data: clone(created) };
    },
  };
  return { client, calls, gets, collections, drops, base, plansPath };
}

async function adapterFixture(t, options = {}) {
  const scope = options.scope ?? configuredScope();
  const transport = simulationFixture(scope, options);
  const directory = options.directory ?? await journalDirectory(t);
  const journal = await openJournal({ directory, runId: scope.runId });
  const adapter = createAdapter({ scope, client: transport.client, journal, now: () => '2026-10-21T12:00:00.000Z' });
  return { scope, directory, journal, adapter, ...transport };
}

async function creationFixture(t, options = {}) {
  const scope = options.scope ?? creationScope();
  const fixture = await adapterFixture(t, { ...options, scope });
  fixture.client.mode = 'live-creation';
  return fixture;
}

function statefulFakeFetch(transport, calls) {
  return async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const path = `${url.pathname}${url.search}`;
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : undefined });

    let payload;
    if (method === 'GET') {
      if (transport.collections.has(path)) {
        const page = await transport.client.collection(path);
        payload = {
          data: page.data,
          included: page.included,
          meta: { total_count: page.data.length },
          links: { next: null },
        };
      } else {
        payload = await transport.client.get(url.pathname);
      }
    } else {
      payload = await transport.client.request(method, url.pathname, JSON.parse(init.body));
    }

    return {
      ok: true,
      status: 200,
      redirected: false,
      url: url.href,
      headers: { get() { return null; } },
      async json() { return structuredClone(payload); },
    };
  };
}

test('selected test plan remains offline and calculates the approved UTC schedules', () => {
  const source = selected();
  const review = reviewPlan(source);

  assert.equal(review.mode, 'preview');
  assert.equal(review.liveWritesEnabled, false);
  assert.equal(review.invitationsEnabled, false);
  assert.equal(source.serviceTypeId, '1832664');
  assert.equal(source.team.id, '7589233');
  assert.equal(review.blockers.length, 6);
  assert.deepEqual(source.occurrences.map(({ eventId, instanceId }) => ({ eventId, instanceId })), [
    { eventId: '23139957', instanceId: '240573824' },
    { eventId: '23139985', instanceId: '240574002' },
  ]);
  assert.ok(!review.blockers.includes('Explicit Event Support service type ID required.'));
  assert.ok(!review.blockers.includes('Explicit Tech team ID required.'));
  assert.ok(review.blockers.includes('A: explicit event time ID required.'));
  assert.ok(review.blockers.includes('B: explicit planId required.'));
  assert.deepEqual(review.occurrences.map(({ key, startsAt, endsAt, arrivalAt, arrivalOffsetMinutes }) => ({ key, startsAt, endsAt, arrivalAt, arrivalOffsetMinutes })), [
    { key: 'A', startsAt: '2026-10-28T23:00:00.000Z', endsAt: '2026-10-29T00:00:00.000Z', arrivalAt: '2026-10-28T22:00:00.000Z', arrivalOffsetMinutes: 60 },
    { key: 'B', startsAt: '2026-10-28T23:00:00.000Z', endsAt: '2026-10-29T00:00:00.000Z', arrivalAt: '2026-10-28T22:00:00.000Z', arrivalOffsetMinutes: 60 },
  ]);
  assert.deepEqual(review.reschedule, {
    key: 'A', startsAt: '2026-10-30T00:00:00.000Z', endsAt: '2026-10-30T01:00:00.000Z',
    arrivalAt: '2026-10-29T23:00:00.000Z', arrivalOffsetMinutes: 60,
  });
  assert.deepEqual(review.occurrences[0].participants.map(({ id, role }) => ({ id, role })), [
    { id: '146335432', role: 'Sound' },
    { id: '15109003', role: 'Graphics' },
  ]);
  assert.deepEqual(review.occurrences[1].participants, []);
});

test('scope validation is cloned, canonical, and limited to exact numeric resources', () => {
  const input = configuredScope();
  const validated = validateScope(input);
  validated.occurrences[0].title = 'changed only in the result';
  assert.equal(input.occurrences[0].title, 'TEST — Central Notifications A');

  assert.equal(typeof hash(input), 'string');
  assert.equal(hash(input).length, 64);
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
  assert.equal(planTitle(input, 'A'), 'TEST — Central Notifications A [central-notifications-2026-10-28:A]');

  for (const badId of ['0', '-1', '12x', 'fixture-plan', 12, '']) {
    const candidate = configuredScope();
    candidate.occurrences[0].planId = badId;
    assert.throws(() => validateScope(candidate), /numeric strings or null/i);
  }
});

test('scope rejects resource escape, ambiguous participants, implicit timezones, and mass scope', () => {
  const mutations = [
    scope => { scope.occurrences[1].eventId = scope.occurrences[0].eventId; },
    scope => { scope.occurrences[1].timeIds.event = scope.occurrences[0].timeIds.event; },
    scope => { scope.people.participants[1].id = scope.people.participants[0].id; },
    scope => { scope.occurrences[0].startsAt = '2026-10-28T18:00:00-05:00'; },
    scope => { scope.reschedule.key = 'B'; },
    scope => { scope.occurrences.push(structuredClone(scope.occurrences[1])); },
    scope => { scope.massAction = true; },
    scope => { scope.team.requirements.push({ role: 'Lighting', quantity: 20 }); },
  ];
  for (const mutate of mutations) {
    const candidate = configuredScope();
    mutate(candidate);
    assert.throws(() => validateScope(candidate));
  }
});

test('all mutation rehearsals reject a live client before reads, journal work, or writes', async () => {
  let calls = 0;
  const client = {
    mode: 'live-read-only',
    async get() { calls += 1; },
    async collection() { calls += 1; },
    async request() { calls += 1; },
  };
  const journal = { async withLock() { calls += 1; assert.fail('journal must not be entered'); } };
  const adapter = createAdapter({ scope: configuredScope(), client, journal });

  for (const action of [
    () => adapter.rehearseCreatePlan('A'),
    () => adapter.rehearseCreateTimes('A'),
    () => adapter.rehearseReschedule(),
  ]) await assert.rejects(action, error => error.code === 'LIVE_WRITES_DISABLED');
  assert.equal(calls, 0);
});

test('CLI defaults to offline preview and rejects every write-like flag', () => {
  assert.equal(parseArgs([]).mode, 'preview');
  assert.equal(parseArgs(['--preview']).mode, 'preview');
  assert.equal(parseArgs(['--read-only', '--journal-dir', '/private/tmp/adapter-journal']).mode, 'read-only');
  for (const flag of ['--execute', '--send', '--live', '--write', '--cleanup', '--dry-run']) {
    assert.throws(() => parseArgs([flag]), error => error.code === 'INVALID_ARGUMENT');
  }
  assert.throws(() => parseArgs(['--read-only']), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => parseArgs(['--preview', '--read-only', '--journal-dir', '/private/tmp/adapter-journal']), error => error.code === 'INVALID_ARGUMENT');

  const preview = spawnSync(process.execPath, [cliPath], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
  });
  assert.equal(preview.status, 0, preview.stderr);
  const report = JSON.parse(preview.stdout);
  assert.equal(report.mode, 'preview');
  assert.equal(report.liveWritesEnabled, false);
  assert.equal(report.invitationsEnabled, false);

  const rejected = spawnSync(process.execPath, [cliPath, '--execute', '--config', '/must/not/be/read.json'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', TZ: 'UTC', PCO_APP_ID: 'must-not-be-used', PCO_SECRET: 'must-not-be-used' },
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /INVALID_ARGUMENT/);
  assert.doesNotMatch(rejected.stderr, /must-not-be-read|must-not-be-used/);
});

test('read-only reporting captures current state without constructing a reschedule proposal', async () => {
  const calls = [];
  const adapter = {
    async preflight() { calls.push('preflight'); return { blockers: [] }; },
    async capture(key) { calls.push(`capture:${key}`); return { key }; },
    async previewReschedule() { assert.fail('read-only reporting must not construct a proposal'); },
  };

  assert.deepEqual(await collectReadOnlyReport(adapter), {
    preflight: { blockers: [] },
    snapshots: [{ key: 'A' }, { key: 'B' }],
  });
  assert.deepEqual(calls, ['preflight', 'capture:A', 'capture:B']);
});

test('read-only preflight reports candidates without inferring IDs or enabling writes', async t => {
  const scope = selected();
  scope.serviceTypeId = null;
  scope.team.id = null;
  for (const occurrence of scope.occurrences) {
    occurrence.eventId = null;
    occurrence.instanceId = null;
  }
  const calls = [];
  const client = {
    mode: 'live-read-only',
    async collection(path) {
      calls.push({ method: 'GET collection', path });
      assert.equal(path, '/services/v2/service_types?per_page=100');
      return { data: [
        row('ServiceType', '700', { name: 'Event Support' }),
        row('ServiceType', '701', { name: 'Worship' }),
      ], included: [], complete: true };
    },
    async get(path) {
      calls.push({ method: 'GET', path });
      const person = scope.people.participants.find(item => path.endsWith(`/${item.id}`));
      assert.ok(person, `Unexpected GET ${path}`);
      const [first_name, ...rest] = person.name.split(' ');
      return { data: row('Person', person.id, { first_name, last_name: rest.join(' '), permissions: 'Scheduler' }) };
    },
    async request() { assert.fail('preflight cannot mutate'); },
  };
  const directory = await journalDirectory(t);
  const adapter = createAdapter({ scope, client, journal: await openJournal({ directory, runId: scope.runId }) });
  const report = await adapter.preflight();
  assert.deepEqual(report.serviceTypeCandidates, [{ id: '700', name: 'Event Support' }]);
  assert.equal(report.readyForLiveWrites, false);
  assert.equal(report.liveWritesEnabled, false);
  assert.equal(report.invitationsEnabled, false);
  assert.ok(report.blockers.length > 0);
  assert.equal(scope.serviceTypeId, null);
  assert.ok(calls.every(call => call.method.startsWith('GET')));
});

test('capture accepts documented JSON:API shapes and projects only reviewed fields', async t => {
  const { adapter } = await adapterFixture(t);
  const snapshot = await adapter.capture('A');

  assert.deepEqual(snapshot.plan, {
    id: '802', title: planTitle(configuredScope(), 'A'), public: false, remindersDisabled: true,
  });
  assert.deepEqual(snapshot.times.map(({ id, kind, startsAt, endsAt, timeType }) => ({ id, kind, startsAt, endsAt, timeType })), [
    { id: '803', kind: 'arrival', startsAt: '2026-10-28T22:00:00.000Z', endsAt: '2026-10-28T23:00:00.000Z', timeType: 'other' },
    { id: '804', kind: 'event', startsAt: '2026-10-28T23:00:00.000Z', endsAt: '2026-10-29T00:00:00.000Z', timeType: 'service' },
  ]);
  assert.deepEqual(snapshot.assignments.map(item => Object.keys(item).sort()), [
    ['confirmedRevision', 'hasDeclineReason', 'id', 'notificationPrepared', 'notificationPreparedAt', 'notificationSent', 'notificationSentAt', 'personId', 'role', 'status', 'statusUpdatedAt', 'teamId', 'timeIds'].sort(),
    ['confirmedRevision', 'hasDeclineReason', 'id', 'notificationPrepared', 'notificationPreparedAt', 'notificationSent', 'notificationSentAt', 'personId', 'role', 'status', 'statusUpdatedAt', 'teamId', 'timeIds'].sort(),
  ]);
  assert.deepEqual(snapshot.assignments.map(({ personId, role, status, notificationPrepared, notificationSent, confirmedRevision, hasDeclineReason }) => ({ personId, role, status, notificationPrepared, notificationSent, confirmedRevision, hasDeclineReason })), [
    { personId: '146335432', role: 'Sound', status: 'C', notificationPrepared: true, notificationSent: true, confirmedRevision: null, hasDeclineReason: false },
    { personId: '15109003', role: 'Graphics', status: 'D', notificationPrepared: true, notificationSent: true, confirmedRevision: null, hasDeclineReason: true },
  ]);
  assert.deepEqual(snapshot.coverage, {
    state: 'Manual evidence required', required: 2, confirmed: null, requiresManualReconfirmationEvidence: true,
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /raw notes|private fixture|private\.jpg|example\.test\/private|fixture reason|email_addresses|phone_numbers/);
});

test('native preparation, delivery, and response evidence remain independent', async t => {
  const scenarios = [
    {
      name: 'prepared but unsent unconfirmed assignment',
      attributes: {
        status: 'U', prepare_notification: true,
        notification_prepared_at: null, notification_sent_at: null,
      },
      expected: {
        status: 'U', notificationPrepared: true, notificationPreparedAt: null,
        notificationSent: false, notificationSentAt: null,
      },
    },
    {
      name: 'sent but still unconfirmed assignment',
      attributes: {
        status: 'U', prepare_notification: false,
        notification_prepared_at: null, notification_sent_at: '2026-10-20T12:00:00Z',
      },
      expected: {
        status: 'U', notificationPrepared: false, notificationPreparedAt: null,
        notificationSent: true, notificationSentAt: '2026-10-20T12:00:00.000Z',
      },
    },
    {
      name: 'confirmed but unsent assignment',
      attributes: {
        status: 'C', prepare_notification: null,
        notification_prepared_at: null, notification_sent_at: null,
      },
      expected: {
        status: 'C', notificationPrepared: null, notificationPreparedAt: null,
        notificationSent: false, notificationSentAt: null,
      },
    },
    {
      name: 'missing native flags with a historical prepared timestamp',
      attributes: { status: 'U' },
      remove: ['prepare_notification', 'notification_sent_at'],
      expected: {
        status: 'U', notificationPrepared: null, notificationPreparedAt: '2026-10-20T11:00:00.000Z',
        notificationSent: null, notificationSentAt: null,
      },
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const scope = configuredScope();
    scope.runId = `native-invitation-evidence-${index}`;
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    const member = fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0];
    Object.assign(member.attributes, scenario.attributes);
    for (const field of scenario.remove ?? []) delete member.attributes[field];

    const snapshot = await fixture.adapter.capture('A');
    const assignment = snapshot.assignments.find(item => item.id === member.id);
    assert.deepEqual({
      status: assignment.status,
      notificationPrepared: assignment.notificationPrepared,
      notificationPreparedAt: assignment.notificationPreparedAt,
      notificationSent: assignment.notificationSent,
      notificationSentAt: assignment.notificationSentAt,
    }, scenario.expected, scenario.name);
    assert.deepEqual(snapshot.coverage, {
      state: 'Manual evidence required', required: 2, confirmed: null, requiresManualReconfirmationEvidence: true,
    }, scenario.name);
  }
});

test('capture rejects non-boolean native preparation evidence', async t => {
  const fixture = await adapterFixture(t);
  fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0]
    .attributes.prepare_notification = 'true';

  await assert.rejects(
    () => fixture.adapter.capture('A'),
    error => error.code === 'RESOURCE_MISMATCH',
  );
});

test('scheduled publishing must be explicitly false before writes', async t => {
  for (const [index, alter] of [
    fixture => { delete fixture.gets.get(fixture.base).attributes.scheduled_publish; },
    fixture => { fixture.gets.get(fixture.base).attributes.scheduled_publish = true; },
  ].entries()) {
    const scope = configuredScope();
    scope.runId = `unsafe-scheduled-publishing-${index}`;
    scope.occurrences[0].planId = null;
    scope.occurrences[0].timeIds = { arrival: null, event: null };
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    alter(fixture);
    await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'SETUP_REQUIRED');
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
  }
});

test('team default invitation preparation is observational and never enables harness delivery', async t => {
  const scenarios = [
    { name: 'false', value: false, expected: false },
    { name: 'true', value: true, expected: true },
    { name: 'missing', expected: null },
    { name: 'null', value: null, expected: null },
  ];

  for (const scenario of scenarios) {
    const scope = configuredScope();
    scope.runId = `observe-default-preparation-${scenario.name}`;
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    const team = fixture.gets.get(`/services/v2/teams/${scope.team.id}`);
    if (Object.hasOwn(scenario, 'value')) team.attributes.default_prepare_notifications = scenario.value;
    else delete team.attributes.default_prepare_notifications;

    const report = await fixture.adapter.preflight();
    assert.equal(report.blockers.length, 0, scenario.name);
    assert.deepEqual(report.checked[0], {
      serviceTypeId: scope.serviceTypeId,
      teamId: scope.team.id,
      defaultPrepareNotifications: scenario.expected,
    }, scenario.name);
    assert.equal(report.invitationsEnabled, false, scenario.name);
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0, scenario.name);
  }
});

test('setup accepts unrelated team positions while preserving the exact required-role contract', async t => {
  const scope = configuredScope();
  scope.runId = 'setup-allows-unrelated-position';
  const fixture = await adapterFixture(t, { scope });
  const positionsPath = `/services/v2/teams/${scope.team.id}/team_positions?per_page=100`;
  fixture.collections.get(positionsPath).data.push(
    row('TeamPosition', '713', { name: 'Lighting' }, { team: relationship('Team', scope.team.id) }),
  );

  const report = await fixture.adapter.preflight();
  assert.equal(report.blockers.length, 0);
  assert.deepEqual(report.checked[0], {
    serviceTypeId: scope.serviceTypeId,
    teamId: scope.team.id,
    defaultPrepareNotifications: false,
  });
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
});

test('setup rejects missing, duplicate, or foreign-team required positions before creation writes', async t => {
  const scenarios = [
    {
      name: 'missing Graphics',
      mutate(rows) { rows.splice(rows.findIndex(item => item.attributes.name === 'Graphics'), 1); },
    },
    {
      name: 'duplicate Sound',
      mutate(rows, scope) {
        rows.push(row('TeamPosition', '713', { name: 'Sound' }, { team: relationship('Team', scope.team.id) }));
      },
    },
    {
      name: 'foreign-team Graphics',
      mutate(rows) {
        rows.find(item => item.attributes.name === 'Graphics').relationships.team = relationship('Team', '999');
      },
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const scope = creationScope();
    scope.runId = `setup-rejects-required-position-${index}`;
    const fixture = await creationFixture(t, { scope, directory: await journalDirectory(t) });
    const positionsPath = `/services/v2/teams/${scope.team.id}/team_positions?per_page=100`;
    scenario.mutate(fixture.collections.get(positionsPath).data, scope);

    await assert.rejects(
      () => fixture.adapter.executeCreation({ approvalHash: reviewCreation(scope).approvalHash }),
      error => error.code === 'SETUP_REQUIRED',
      scenario.name,
    );
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0, scenario.name);
    assert.equal(fixture.collections.get(fixture.plansPath).data.length, 0, scenario.name);
  }
});

test('capture accepts explicit PCO offsets and normalizes source evidence to UTC', async t => {
  const fixture = await adapterFixture(t);
  const calendar = fixture.gets.get('/calendar/v2/event_instances/801');
  calendar.attributes.starts_at = '2026-10-28T18:00:00-05:00';
  calendar.attributes.ends_at = '2026-10-28T19:00:00-05:00';
  const times = fixture.collections.get(`${fixture.base}/plans/802/plan_times?per_page=100`).data;
  Object.assign(times[0].attributes, { starts_at: '2026-10-28T17:00:00-05:00', ends_at: '2026-10-28T18:00:00-05:00' });
  Object.assign(times[1].attributes, { starts_at: '2026-10-28T18:00:00-05:00', ends_at: '2026-10-28T19:00:00-05:00' });
  const member = fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0];
  member.attributes.notification_sent_at = '2026-10-20T07:00:00-05:00';

  const snapshot = await fixture.adapter.capture('A');
  assert.equal(snapshot.occurrence.startsAt, '2026-10-28T23:00:00.000Z');
  assert.equal(snapshot.times[0].startsAt, '2026-10-28T22:00:00.000Z');
  assert.equal(snapshot.assignments[0].notificationSentAt, '2026-10-20T12:00:00.000Z');
});

test('native remaining-needed positions never lower the approved two-role baseline', async t => {
  for (const mutate of [
    rows => rows.pop(),
    rows => { rows[0].attributes.quantity = 0; },
    rows => { rows[0].relationships.time = relationship('PlanTime', '803'); },
  ]) {
    const fixture = await adapterFixture(t, { directory: await journalDirectory(t) });
    const path = `${fixture.base}/plans/802/needed_positions?per_page=100`;
    mutate(fixture.collections.get(path).data);
    const snapshot = await fixture.adapter.capture('A');
    assert.equal(snapshot.coverage.required, 2);
    assert.equal(snapshot.coverage.confirmed, null);
    assert.equal(snapshot.coverage.requiresManualReconfirmationEvidence, true);
  }
});

test('capture rejects incomplete reads, mixed times, external people, and unsafe plans', async t => {
  const scenarios = [
    fixture => { fixture.collections.get(`${fixture.base}/plans/802/plan_times?per_page=100`).complete = false; },
    fixture => { fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0].relationships.times.data.pop(); },
    fixture => { fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0].relationships.person = relationship('Person', '999999'); },
    fixture => { fixture.gets.get(`${fixture.base}/plans/802`).attributes.public_by_schedule = true; },
  ];
  for (const alter of scenarios) {
    const fixture = await adapterFixture(t, { directory: await journalDirectory(t) });
    alter(fixture);
    await assert.rejects(() => fixture.adapter.capture('A'));
  }
});

test('failed refresh preserves the last complete snapshot and records stale evidence', async t => {
  const fixture = await adapterFixture(t);
  const before = await fixture.adapter.capture('A');
  fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).complete = false;
  await assert.rejects(() => fixture.adapter.capture('A'), error => error.code === 'INCOMPLETE_READ');

  const state = await fixture.journal.inspect();
  assert.equal(state.snapshots.length, 1);
  assert.deepEqual(state.snapshots[0], before);
  assert.deepEqual(state.history.at(-1), {
    kind: 'snapshot-read-failed', key: 'A', at: '2026-10-21T12:00:00.000Z', code: 'READ_FAILED', previousSnapshotRetained: true,
  });
});

test('reschedule preview changes only mapped A times and resets only the allowed confirmation', async t => {
  const { adapter } = await adapterFixture(t);
  const preview = await adapter.previewReschedule();

  assert.equal(preview.requiresManualReconfirmationEvidence, true);
  assert.equal(preview.before.key, 'A');
  assert.equal(preview.control.key, 'B');
  assert.deepEqual(preview.actions.map(({ key, method, path, after }) => ({ key, method, path, after })), [
    { key: 'time:803', method: 'PATCH', path: '/services/v2/service_types/700/plan_times/803', after: { starts_at: '2026-10-29T23:00:00.000Z', ends_at: '2026-10-30T00:00:00.000Z' } },
    { key: 'time:804', method: 'PATCH', path: '/services/v2/service_types/700/plan_times/804', after: { starts_at: '2026-10-30T00:00:00.000Z', ends_at: '2026-10-30T01:00:00.000Z' } },
    { key: 'reset:820', method: 'PATCH', path: '/services/v2/people/146335432/plan_people/820', after: { status: 'U' } },
  ]);
  assert.ok(preview.actions.every(action => !/\b(?:903|904|15109003|821)\b/.test(`${action.path} ${JSON.stringify(action.body)}`)));
  assert.equal(preview.before.assignments.find(item => item.role === 'Graphics').status, 'D');
});

test('lost PATCH response recovers from readback after restart without duplicate writes or sends', async t => {
  const scope = configuredScope();
  const fixture = await adapterFixture(t, { scope, calendarA: 'target' });
  const controlBefore = structuredClone(fixture.gets.get(`${fixture.base}/plans/902`));
  const path = `${fixture.base}/plan_times/803`;
  fixture.drops.patchPath = path;
  await assert.rejects(() => fixture.adapter.rehearseReschedule(), error => error.code === 'OUTCOME_UNKNOWN');
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.path === path).length, 1);
  assert.equal((await fixture.journal.inspect()).operations['reschedule:A:time:803'].status, 'outcome-unknown');

  const reopenedJournal = await openJournal({ directory: fixture.directory, runId: scope.runId });
  const restarted = createAdapter({ scope, client: fixture.client, journal: reopenedJournal, now: () => '2026-10-21T12:05:00.000Z' });
  const result = await restarted.rehearseReschedule();
  assert.equal(result.state, 'Needs reconfirmation');
  assert.equal(result.requiresManualReconfirmationEvidence, true);
  assert.deepEqual(
    (({ status, notificationPrepared, notificationPreparedAt, notificationSent, notificationSentAt }) => ({
      status, notificationPrepared, notificationPreparedAt, notificationSent, notificationSentAt,
    }))(result.after.assignments.find(item => item.role === 'Sound')),
    {
      status: 'U', notificationPrepared: true, notificationPreparedAt: '2026-10-20T11:00:00.000Z',
      notificationSent: true, notificationSentAt: '2026-10-20T12:00:00.000Z',
    },
  );
  assert.equal(result.after.assignments.find(item => item.role === 'Graphics').status, 'D');
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.path === path).length, 1);
  assert.ok(fixture.calls.filter(call => call.kind === 'request').every(call => call.method === 'PATCH' && !/send|notify|invite|email/i.test(call.path)));
  assert.deepEqual(fixture.gets.get(`${fixture.base}/plans/902`), controlBefore);
  assert.ok(fixture.calls.filter(call => call.kind === 'request').every(call => !/\b(?:903|904|902)\b/.test(call.path)));
  const recovered = await reopenedJournal.inspect();
  assert.ok(Object.entries(recovered.operations).filter(([key]) => key.startsWith('reschedule:A:')).every(([, operation]) => operation.status === 'complete'));
  assert.equal(recovered.reschedule.status, 'complete');
});

test('restart stops before more writes when native preparation changes but timestamps do not', async t => {
  const scope = configuredScope();
  scope.runId = 'restart-preparation-flag-drift';
  const fixture = await adapterFixture(t, { scope, calendarA: 'target' });
  fixture.drops.patchPath = `${fixture.base}/plan_times/803`;
  await assert.rejects(() => fixture.adapter.rehearseReschedule(), error => error.code === 'OUTCOME_UNKNOWN');
  const mutationsBeforeRestart = fixture.calls.filter(call => call.kind === 'request').length;
  assert.equal(mutationsBeforeRestart, 1);

  const member = fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data[0];
  const timestampsBefore = {
    preparedAt: member.attributes.notification_prepared_at,
    sentAt: member.attributes.notification_sent_at,
  };
  member.attributes.prepare_notification = false;

  const restarted = createAdapter({
    scope, client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T14:05:00.000Z',
  });
  await assert.rejects(() => restarted.rehearseReschedule(), error => error.code === 'SCHEDULE_DRIFT');
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, mutationsBeforeRestart);
  assert.deepEqual({
    preparedAt: member.attributes.notification_prepared_at,
    sentAt: member.attributes.notification_sent_at,
  }, timestampsBefore);
  assert.ok(fixture.calls.filter(call => call.kind === 'request').every(call =>
    !/send|notify|invite|email/i.test(call.path) && !Object.hasOwn(call.body?.data?.attributes ?? {}, 'prepare_notification')));
  const state = await fixture.journal.inspect();
  assert.equal(state.operations['reschedule:A:time:803'].status, 'outcome-unknown');
  assert.equal(state.operations['reschedule:A:time:804'], undefined);
  assert.equal(state.operations['reschedule:A:reset:820'], undefined);
});

test('restart stops before more writes when assignment response evidence changed after an unknown PATCH', async t => {
  const scope = configuredScope();
  scope.runId = 'restart-response-drift';
  const fixture = await adapterFixture(t, { scope, calendarA: 'target' });
  const droppedPath = `${fixture.base}/plan_times/803`;
  fixture.drops.patchPath = droppedPath;
  await assert.rejects(() => fixture.adapter.rehearseReschedule(), error => error.code === 'OUTCOME_UNKNOWN');
  const mutationsBeforeRestart = fixture.calls.filter(call => call.kind === 'request').length;
  assert.equal(mutationsBeforeRestart, 1);

  const members = fixture.collections.get(`${fixture.base}/plans/802/team_members?per_page=100`).data;
  const declined = members.find(member => member.attributes.team_position_name === 'Graphics');
  Object.assign(declined.attributes, {
    status: 'C',
    status_updated_at: '2026-10-21T14:00:00Z',
    notification_sent_at: '2026-10-21T13:55:00Z',
    decline_reason: null,
  });

  const restarted = createAdapter({
    scope, client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T14:05:00.000Z',
  });
  await assert.rejects(() => restarted.rehearseReschedule(), error => error.code === 'SCHEDULE_DRIFT');
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, mutationsBeforeRestart);
  const state = await fixture.journal.inspect();
  assert.equal(state.operations['reschedule:A:time:803'].status, 'outcome-unknown');
  assert.equal(state.operations['reschedule:A:time:804'], undefined);
  assert.equal(state.operations['reschedule:A:reset:820'], undefined);
});

test('restart stops before more writes when control B changed after an unknown PATCH', async t => {
  const scope = configuredScope();
  scope.runId = 'restart-control-drift';
  const fixture = await adapterFixture(t, { scope, calendarA: 'target' });
  fixture.drops.patchPath = `${fixture.base}/plan_times/803`;
  await assert.rejects(() => fixture.adapter.rehearseReschedule(), error => error.code === 'OUTCOME_UNKNOWN');
  const mutationsBeforeRestart = fixture.calls.filter(call => call.kind === 'request').length;
  assert.equal(mutationsBeforeRestart, 1);

  const control = fixture.gets.get('/calendar/v2/event_instances/901');
  control.attributes.starts_at = '2026-10-28T23:05:00Z';

  const restarted = createAdapter({
    scope, client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T14:05:00.000Z',
  });
  await assert.rejects(() => restarted.rehearseReschedule(), error => error.code === 'CONTROL_CHANGED');
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, mutationsBeforeRestart);
  const state = await fixture.journal.inspect();
  assert.equal(state.operations['reschedule:A:time:803'].status, 'outcome-unknown');
  assert.equal(state.operations['reschedule:A:time:804'], undefined);
  assert.equal(state.operations['reschedule:A:reset:820'], undefined);
});

test('lost create response attaches one exact marker after restart and never blindly repeats POST', async t => {
  const scope = configuredScope();
  scope.occurrences[0].planId = null;
  scope.occurrences[0].timeIds = { arrival: null, event: null };
  const fixture = await adapterFixture(t, { scope });
  fixture.drops.postPlan = 'after';
  await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'OUTCOME_UNKNOWN');
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST').length, 1);

  const restarted = createAdapter({
    scope, client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T12:05:00.000Z',
  });
  const result = await restarted.rehearseCreatePlan('A');
  assert.deepEqual(result, { planId: '1001', simulated: true, invitationsEnabled: false });
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST').length, 1);
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'PATCH').length, 1);
  assert.ok(fixture.calls.filter(call => call.kind === 'request').every(call => !/send|notify|invite|email/i.test(call.path)));
});

test('time creation requires an empty plan and creates only two reminder-free mapped times', async t => {
  const scope = configuredScope();
  scope.runId = 'create-reviewed-times';
  scope.occurrences[0].timeIds = { arrival: null, event: null };
  const fixture = await adapterFixture(t, { scope });
  const planPath = `${fixture.base}/plans/802`;
  fixture.collections.get(`${planPath}/plan_times?per_page=100`).data = [];
  fixture.collections.get(`${planPath}/team_members?per_page=100`).data = [];

  assert.deepEqual(await fixture.adapter.rehearseCreateTimes('A'), { arrival: '1003', event: '1004' });
  const writes = fixture.calls.filter(call => call.kind === 'request');
  assert.equal(writes.length, 2);
  assert.ok(writes.every(call => call.method === 'POST' && call.path === `${planPath}/plan_times`));
  assert.deepEqual(writes.map(call => call.body.data.attributes), [
    { name: 'create-reviewed-times:A:arrival', time_type: 'other', starts_at: '2026-10-28T22:00:00.000Z', ends_at: '2026-10-28T23:00:00.000Z', team_reminders: [] },
    { name: 'create-reviewed-times:A:event', time_type: 'service', starts_at: '2026-10-28T23:00:00.000Z', ends_at: '2026-10-29T00:00:00.000Z', team_reminders: [] },
  ]);
  assert.ok(writes.every(call => !/send|notify|invite|email/i.test(call.path)));
});

test('time creation rejects every partially or fully configured pair before any mutation', async t => {
  for (const [index, timeIds] of [
    { arrival: null, event: '804' },
    { arrival: '803', event: null },
    { arrival: '803', event: '804' },
  ].entries()) {
    const scope = configuredScope();
    scope.runId = `reject-configured-time-pair-${index}`;
    scope.occurrences[0].timeIds = timeIds;
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    const planPath = `${fixture.base}/plans/802`;
    fixture.collections.get(`${planPath}/plan_times?per_page=100`).data = [];
    fixture.collections.get(`${planPath}/team_members?per_page=100`).data = [];

    await assert.rejects(() => fixture.adapter.rehearseCreateTimes('A'), error => error.code === 'SETUP_REQUIRED');
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
  }
});

test('foreign plan times stop time creation before any mutation', async t => {
  const scope = configuredScope();
  scope.runId = 'reject-foreign-time';
  scope.occurrences[0].timeIds = { arrival: null, event: null };
  const fixture = await adapterFixture(t, { scope });
  const planPath = `${fixture.base}/plans/802`;
  fixture.collections.get(`${planPath}/team_members?per_page=100`).data = [];
  fixture.collections.get(`${planPath}/plan_times?per_page=100`).data = [row('PlanTime', '999', {
    name: 'foreign-time', time_type: 'other', starts_at: '2026-10-28T22:00:00Z', ends_at: '2026-10-28T23:00:00Z', team_reminders: [],
  })];
  await assert.rejects(() => fixture.adapter.rehearseCreateTimes('A'), error => error.code === 'NEEDS_REPAIR');
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
});

test('unknown or duplicate create outcomes remain repair states and retain original intent', async t => {
  for (const mode of ['before', 'duplicate']) {
    const scope = configuredScope();
    scope.runId = `create-${mode}`;
    scope.occurrences[0].planId = null;
    scope.occurrences[0].timeIds = { arrival: null, event: null };
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    fixture.drops.postPlan = mode === 'before' ? 'before' : 'after';
    await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'OUTCOME_UNKNOWN');
    if (mode === 'duplicate') {
      const duplicate = structuredClone(fixture.collections.get(fixture.plansPath).data.at(-1));
      duplicate.id = '1002';
      fixture.collections.get(fixture.plansPath).data.push(duplicate);
    }
    await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'NEEDS_REPAIR');
    assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST').length, 1);
    assert.equal((await fixture.journal.inspect()).operations['create-plan:A'].status, 'outcome-unknown');
  }
});

test('journal-owned unknown operation refuses intent-hash drift without another POST', async t => {
  const scope = configuredScope();
  scope.runId = 'create-intent-drift';
  scope.occurrences[0].planId = null;
  scope.occurrences[0].timeIds = { arrival: null, event: null };
  const fixture = await adapterFixture(t, { scope });
  fixture.drops.postPlan = 'after';
  await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'OUTCOME_UNKNOWN');
  await fixture.journal.withLock(async session => {
    session.state.operations['create-plan:A'].intentHash = 'tampered-intent';
    await session.save();
  });
  await assert.rejects(() => fixture.adapter.rehearseCreatePlan('A'), error => error.code === 'SCOPE_CHANGED');
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST').length, 1);
});

test('journal restart refuses scope drift before adapter reads external resources', async t => {
  const fixture = await adapterFixture(t);
  await fixture.adapter.capture('A');
  const callsBefore = fixture.calls.length;
  const drifted = configuredScope();
  drifted.reschedule.endsAt = '2026-10-30T01:30:00Z';
  const adapter = createAdapter({
    scope: drifted, client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: drifted.runId }),
  });
  await assert.rejects(() => adapter.capture('A'), error => error.code === 'SCOPE_CHANGED');
  assert.equal(fixture.calls.length, callsBefore);
});

test('preflight reuses exact journal-owned links and rejects tampering before external reads', async t => {
  const scenarios = [
    {
      name: 'binding resource mismatch',
      mutate(state) { state.bindings.A.planId = '1999'; },
      code: 'NEEDS_REPAIR',
    },
    {
      name: 'incomplete creation operation',
      mutate(state) { state.operations['create-time:A:arrival'].status = 'outcome-unknown'; },
      code: 'NEEDS_REPAIR',
    },
    {
      name: 'mismatched creation operation',
      mutate(state) { state.operations['create-time:A:event'].path = '/services/v2/service_types/700/plans/9999/plan_times'; },
      code: 'NEEDS_REPAIR',
    },
    {
      name: 'intent hash drift',
      mutate(state) { state.operations['create-plan:A'].intentHash = 'tampered-intent'; },
      code: 'NEEDS_REPAIR',
    },
    {
      name: 'generated identity conflicts with an explicit control identity',
      mutate(state) {
        state.bindings.A.event = '903';
        state.operations['create-time:A:event'].resourceId = '903';
      },
      code: 'INVALID_SCOPE',
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const scope = configuredScope();
    scope.runId = `journal-link-validation-${index}`;
    scope.occurrences[0].planId = null;
    scope.occurrences[0].timeIds = { arrival: null, event: null };
    const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
    await fixture.adapter.rehearseCreatePlan('A');
    await fixture.adapter.rehearseCreateTimes('A');

    const writesBeforeReports = fixture.calls.filter(call => call.kind === 'request').length;
    const first = await fixture.adapter.preflight();
    const second = await fixture.adapter.preflight();
    assert.deepEqual(first.links, second.links, scenario.name);
    assert.deepEqual(first.links.find(link => link.key === 'A'), {
      key: 'A', eventId: '800', instanceId: '801', planId: '1001',
      timeIds: { arrival: '1003', event: '1004' },
    });
    assert.equal(first.scopeHash, hash(scope));
    assert.equal((await fixture.journal.inspect()).scopeHash, hash(scope));
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, writesBeforeReports);

    await fixture.journal.withLock(async session => {
      scenario.mutate(session.state);
      await session.save();
    });
    const callsBeforeFailure = fixture.calls.length;
    await assert.rejects(() => fixture.adapter.preflight(), error => error.code === scenario.code, scenario.name);
    assert.equal(fixture.calls.length, callsBeforeFailure, `${scenario.name} must fail before external reads`);
  }

  const scope = configuredScope();
  scope.runId = 'journal-explicit-link-conflict';
  const fixture = await adapterFixture(t, { scope, directory: await journalDirectory(t) });
  await fixture.adapter.capture('A');
  await fixture.journal.withLock(async session => {
    session.state.bindings.A = { planId: '1999' };
    session.state.operations['create-plan:A'] = {
      status: 'complete', resourceId: '1999', intentHash: 'irrelevant-after-explicit-conflict',
      path: `${fixture.base}/plans`, type: 'Plan', attributes: { title: planTitle(scope, 'A'), public: false },
    };
    await session.save();
  });
  const callsBeforeConflict = fixture.calls.length;
  await assert.rejects(() => fixture.adapter.preflight(), error => error.code === 'NEEDS_REPAIR');
  assert.equal(fixture.calls.length, callsBeforeConflict);
});

test('unbound A and B complete the journal-backed lifecycle without reports sending or mutating', async t => {
  const scope = configuredScope();
  scope.runId = 'full-journal-lifecycle';
  for (const occurrence of scope.occurrences) {
    occurrence.planId = null;
    occurrence.timeIds = { arrival: null, event: null };
  }
  const fixture = await adapterFixture(t, { scope });

  assert.deepEqual(await fixture.adapter.rehearseCreatePlan('A'), {
    planId: '1001', simulated: true, invitationsEnabled: false,
  });
  fixture.drops.postTimeName = `${scope.runId}:A:event`;
  await assert.rejects(() => fixture.adapter.rehearseCreateTimes('A'), error => error.code === 'OUTCOME_UNKNOWN');
  assert.deepEqual((await fixture.journal.inspect()).bindings.A, { planId: '1001', arrival: '1003' });

  let reopenedJournal = await openJournal({ directory: fixture.directory, runId: scope.runId });
  let restarted = createAdapter({
    scope, client: fixture.client, journal: reopenedJournal, now: () => '2026-10-21T12:05:00.000Z',
  });
  assert.deepEqual(await restarted.rehearseCreateTimes('A'), {
    planId: '1001', arrival: '1003', event: '1004',
  });
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST' && call.path.endsWith('/plans/1001/plan_times')).length, 2);

  assert.deepEqual(await restarted.rehearseCreatePlan('B'), {
    planId: '1101', simulated: true, invitationsEnabled: false,
  });
  assert.deepEqual(await restarted.rehearseCreateTimes('B'), {
    planId: '1101', arrival: '1103', event: '1104',
  });

  const journalAfterCreate = await reopenedJournal.inspect();
  assert.equal(journalAfterCreate.scopeHash, hash(scope));
  assert.deepEqual(journalAfterCreate.bindings, {
    A: { planId: '1001', arrival: '1003', event: '1004' },
    B: { planId: '1101', arrival: '1103', event: '1104' },
  });

  const addPlanState = (key, planId, timeIds) => {
    const planPath = `${fixture.base}/plans/${planId}`;
    const members = key === 'A' ? scope.people.participants.map((person, index) => {
      const confirmed = person.name === 'Riley Baker';
      const member = row('PlanPerson', String(820 + index), {
        can_accept_partial: false, status: confirmed ? 'C' : 'D', team_position_name: person.role,
        prepare_notification: true,
        notification_sent_at: '2026-10-20T12:00:00Z', notification_prepared_at: '2026-10-20T11:00:00Z',
        status_updated_at: '2026-10-20T13:00:00Z', decline_reason: confirmed ? null : 'fixture reason',
      }, {
        person: relationship('Person', person.id), team: relationship('Team', scope.team.id),
        plan: relationship('Plan', planId), service_type: relationship('ServiceType', scope.serviceTypeId),
        responds_to: relationship('Person', scope.people.responseRecipientId),
        times: relationships('PlanTime', [timeIds.arrival, timeIds.event]),
      });
      fixture.gets.set(`/services/v2/people/${person.id}/plan_people/${member.id}`, member);
      return member;
    }) : [];
    fixture.collections.get(`${planPath}/team_members?per_page=100`).data = members;
    fixture.collections.get(`${planPath}/needed_positions?per_page=100`).data = scope.team.requirements.map((requirement, index) =>
      row('NeededPosition', String((key === 'A' ? 1200 : 1300) + index), {
        quantity: requirement.quantity, scheduled_to: 'plan', team_position_name: requirement.role,
      }, {
        plan: relationship('Plan', planId), team: relationship('Team', scope.team.id),
        time: relationship('PlanTime', timeIds.event),
      }));
  };
  addPlanState('A', '1001', { arrival: '1003', event: '1004' });
  addPlanState('B', '1101', { arrival: '1103', event: '1104' });

  reopenedJournal = await openJournal({ directory: fixture.directory, runId: scope.runId });
  restarted = createAdapter({
    scope, client: fixture.client, journal: reopenedJournal, now: () => '2026-10-21T12:10:00.000Z',
  });
  const writesBeforeFirstReport = fixture.calls.filter(call => call.kind === 'request').length;
  const firstReport = await collectReadOnlyReport(restarted);
  assert.equal(firstReport.preflight.blockers.length, 0);
  assert.equal(firstReport.preflight.scopeHash, hash(scope));
  assert.deepEqual(firstReport.preflight.links, [
    { key: 'A', eventId: '800', instanceId: '801', planId: '1001', timeIds: { arrival: '1003', event: '1004' } },
    { key: 'B', eventId: '900', instanceId: '901', planId: '1101', timeIds: { arrival: '1103', event: '1104' } },
  ]);
  assert.equal(Object.hasOwn(firstReport, 'rescheduleProposal'), false);
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, writesBeforeFirstReport);
  const controlBefore = { ...structuredClone(firstReport.snapshots[1]), at: null };

  const calendarA = fixture.gets.get('/calendar/v2/event_instances/801');
  calendarA.attributes.starts_at = scope.reschedule.startsAt;
  calendarA.attributes.ends_at = scope.reschedule.endsAt;
  fixture.drops.patchPath = `${fixture.base}/plan_times/1003`;
  await assert.rejects(() => restarted.rehearseReschedule(), error => error.code === 'OUTCOME_UNKNOWN');

  reopenedJournal = await openJournal({ directory: fixture.directory, runId: scope.runId });
  restarted = createAdapter({
    scope, client: fixture.client, journal: reopenedJournal, now: () => '2026-10-21T12:15:00.000Z',
  });
  const rehearsal = await restarted.rehearseReschedule();
  assert.equal(rehearsal.state, 'Needs reconfirmation');
  assert.equal(rehearsal.after.assignments.find(item => item.personId === '146335432').status, 'U');

  const writesBeforeMovedReport = fixture.calls.filter(call => call.kind === 'request').length;
  const movedReport = await collectReadOnlyReport(restarted);
  assert.equal(movedReport.preflight.blockers.length, 0);
  assert.deepEqual({ ...movedReport.snapshots[1], at: null }, controlBefore);
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, writesBeforeMovedReport);

  const riley = fixture.collections.get(`${fixture.base}/plans/1001/team_members?per_page=100`).data
    .find(member => member.relationships.person.data.id === '146335432');
  Object.assign(riley.attributes, {
    status: 'C', prepare_notification: true, notification_sent_at: '2026-10-21T15:00:00Z',
    notification_prepared_at: '2026-10-21T14:59:00Z', status_updated_at: '2026-10-21T15:01:00Z',
  });
  const writesBeforeFreshReport = fixture.calls.filter(call => call.kind === 'request').length;
  const freshReport = await collectReadOnlyReport(restarted);
  const freshRiley = freshReport.snapshots[0].assignments.find(item => item.personId === '146335432');
  assert.deepEqual({
    status: freshRiley.status,
    notificationPrepared: freshRiley.notificationPrepared,
    notificationSentAt: freshRiley.notificationSentAt,
    notificationSent: freshRiley.notificationSent,
    statusUpdatedAt: freshRiley.statusUpdatedAt,
    confirmedRevision: freshRiley.confirmedRevision,
  }, {
    status: 'C',
    notificationPrepared: true,
    notificationSentAt: '2026-10-21T15:00:00.000Z',
    notificationSent: true,
    statusUpdatedAt: '2026-10-21T15:01:00.000Z',
    confirmedRevision: null,
  });
  assert.deepEqual(freshReport.snapshots[0].coverage, {
    state: 'Manual evidence required', required: 2, confirmed: null, requiresManualReconfirmationEvidence: true,
  });
  assert.deepEqual({ ...freshReport.snapshots[1], at: null }, controlBefore);
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, writesBeforeFreshReport);
  assert.ok(fixture.calls.filter(call => call.kind === 'request').every(call =>
    ['POST', 'PATCH'].includes(call.method) && !/send|notify|invite|email/i.test(call.path)));
});

test('live creation requires the exact reviewed approval and live-creation mode before reads or writes', async t => {
  const fixture = await creationFixture(t);

  for (const options of [undefined, {}, { approvalHash: 'not-the-reviewed-hash' }]) {
    await assert.rejects(() => fixture.adapter.executeCreation(options), error => error.code === 'CREATION_APPROVAL_REQUIRED');
  }
  fixture.client.mode = 'simulation';
  await assert.rejects(
    () => fixture.adapter.executeCreation({ approvalHash: reviewCreation(fixture.scope).approvalHash }),
    error => error.code === 'LIVE_WRITES_DISABLED',
  );
  assert.equal(fixture.calls.length, 0);
  assert.deepEqual(await fixture.journal.inspect(), {
    schemaVersion: 1, runId: fixture.scope.runId, operations: {}, snapshots: [], history: [],
  });
});

test('live creation rejects every configured plan or time identity before mutation', async t => {
  const scenarios = [
    scope => { scope.occurrences[0].planId = '802'; },
    scope => { scope.occurrences[0].timeIds.arrival = '803'; },
    scope => { scope.occurrences[1].timeIds = { arrival: '903', event: '904' }; },
  ];

  for (const [index, configure] of scenarios.entries()) {
    const scope = creationScope();
    scope.runId = `live-creation-configured-${index}`;
    configure(scope);
    const fixture = await creationFixture(t, { scope, directory: await journalDirectory(t) });
    const review = reviewCreation(scope);
    assert.ok(review.blockers.length > 0);
    await assert.rejects(
      () => fixture.adapter.executeCreation({ approvalHash: review.approvalHash }),
      error => error.code === 'SETUP_REQUIRED',
    );
    assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
  }
});

test('live creation verifies both Calendar baselines before the first write', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-unsafe-control';
  const fixture = await creationFixture(t, { scope });
  fixture.gets.get('/calendar/v2/event_instances/901').attributes.starts_at = '2026-10-28T23:05:00Z';

  await assert.rejects(
    () => fixture.adapter.executeCreation({ approvalHash: reviewCreation(scope).approvalHash }),
    error => error.code === 'SCHEDULE_DRIFT',
  );
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 0);
  assert.equal(fixture.collections.get(fixture.plansPath).data.length, 0);
});

test('approved live creation holds one workflow lock and creates exactly two private empty plans', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-success';
  const fixture = await creationFixture(t, { scope });
  fixture.gets.get(`/services/v2/teams/${scope.team.id}`).attributes.default_prepare_notifications = true;
  let lockCount = 0;
  const adapter = createAdapter({
    scope,
    client: fixture.client,
    journal: {
      async withLock(callback) {
        lockCount += 1;
        return fixture.journal.withLock(callback);
      },
    },
    now: () => '2026-10-21T13:00:00.000Z',
  });
  const approvalHash = reviewCreation(scope).approvalHash;
  const result = await adapter.executeCreation({ approvalHash });

  assert.equal(lockCount, 1);
  assert.equal(result.mode, 'live-creation');
  assert.equal(result.invitationsEnabled, false);
  assert.equal(fixture.gets.get(`/services/v2/teams/${scope.team.id}`).attributes.default_prepare_notifications, true);
  assert.equal(result.approvalHash, approvalHash);
  assert.deepEqual(result.bindings, {
    A: { planId: '1001', arrival: '1003', event: '1004' },
    B: { planId: '1101', arrival: '1103', event: '1104' },
  });
  assert.deepEqual(result.snapshots.map(snapshot => ({
    key: snapshot.key,
    eventId: snapshot.occurrence.eventId,
    instanceId: snapshot.occurrence.id,
    planId: snapshot.plan.id,
    timeIds: snapshot.times.map(time => time.id),
    assignmentCount: snapshot.assignments.length,
  })), [
    { key: 'A', eventId: '800', instanceId: '801', planId: '1001', timeIds: ['1003', '1004'], assignmentCount: 0 },
    { key: 'B', eventId: '900', instanceId: '901', planId: '1101', timeIds: ['1103', '1104'], assignmentCount: 0 },
  ]);

  const writes = fixture.calls.filter(call => call.kind === 'request');
  assert.equal(writes.length, 8);
  assert.deepEqual(writes.map(call => `${call.method} ${call.path}`), [
    `POST ${fixture.base}/plans`,
    `PATCH ${fixture.base}/plans/1001`,
    `POST ${fixture.base}/plans/1001/plan_times`,
    `POST ${fixture.base}/plans/1001/plan_times`,
    `POST ${fixture.base}/plans`,
    `PATCH ${fixture.base}/plans/1101`,
    `POST ${fixture.base}/plans/1101/plan_times`,
    `POST ${fixture.base}/plans/1101/plan_times`,
  ]);
  assert.ok(writes.every(call => !/send|notify|invite|email/i.test(call.path)));
  assert.ok(writes.filter(call => call.method === 'POST' && call.path === `${fixture.base}/plans`)
    .every(call => call.body.data.attributes.public === false));
  assert.ok(writes.filter(call => call.method === 'POST' && call.path.endsWith('/plan_times'))
    .every(call => call.body.data.attributes.team_reminders.length === 0));

  for (const [planId, expectedTimes] of [['1001', ['1003', '1004']], ['1101', ['1103', '1104']]]) {
    const plan = fixture.gets.get(`${fixture.base}/plans/${planId}`);
    assert.equal(plan.attributes.public, false);
    assert.notEqual(plan.attributes.public_by_schedule, true);
    assert.equal(plan.attributes.reminders_disabled, true);
    assert.equal(fixture.collections.get(`${fixture.base}/plans/${planId}/team_members?per_page=100`).data.length, 0);
    assert.deepEqual(
      fixture.collections.get(`${fixture.base}/plans/${planId}/plan_times?per_page=100`).data.map(item => item.id),
      expectedTimes,
    );
  }
});

test('approved manifest, bounded creation transport, adapter, and journal complete the exact eight writes', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-transport-integration';
  const transport = simulationFixture(scope);
  const directory = await journalDirectory(t);
  const journal = await openJournal({ directory, runId: scope.runId });
  const approvalHash = reviewCreation(scope).approvalHash;
  const fetchCalls = [];
  const client = createCreationPcoClient({
    scope,
    approvalHash,
    journal,
    appId: 'fixture-app',
    secret: 'fixture-secret',
    fetchImpl: statefulFakeFetch(transport, fetchCalls),
  });
  const adapter = createAdapter({ scope, client, journal, now: () => '2026-10-21T13:02:00.000Z' });

  const result = await adapter.executeCreation({ approvalHash });
  assert.deepEqual(result.bindings, {
    A: { planId: '1001', arrival: '1003', event: '1004' },
    B: { planId: '1101', arrival: '1103', event: '1104' },
  });
  assert.deepEqual(result.snapshots.map(snapshot => ({
    key: snapshot.key,
    planId: snapshot.plan.id,
    timeIds: snapshot.times.map(time => time.id),
    assignments: snapshot.assignments.length,
  })), [
    { key: 'A', planId: '1001', timeIds: ['1003', '1004'], assignments: 0 },
    { key: 'B', planId: '1101', timeIds: ['1103', '1104'], assignments: 0 },
  ]);
  const writes = fetchCalls.filter(call => call.method !== 'GET');
  assert.equal(writes.length, 8);
  assert.deepEqual(writes.map(call => call.method), ['POST', 'PATCH', 'POST', 'POST', 'POST', 'PATCH', 'POST', 'POST']);
  assert.ok(writes.every(call => !/send|notify|invite|email/i.test(call.path)));
});

test('bounded creation transport recovers a lost second-time response with a fresh client', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-transport-recovery';
  const transport = simulationFixture(scope);
  transport.drops.postTimeName = `${scope.runId}:A:event`;
  const directory = await journalDirectory(t);
  let journal = await openJournal({ directory, runId: scope.runId });
  const approvalHash = reviewCreation(scope).approvalHash;
  const fetchCalls = [];
  let client = createCreationPcoClient({
    scope,
    approvalHash,
    journal,
    appId: 'fixture-app',
    secret: 'fixture-secret',
    fetchImpl: statefulFakeFetch(transport, fetchCalls),
  });
  let adapter = createAdapter({ scope, client, journal, now: () => '2026-10-21T13:03:00.000Z' });

  await assert.rejects(() => adapter.executeCreation({ approvalHash }), error => error.code === 'OUTCOME_UNKNOWN');
  assert.equal(fetchCalls.filter(call => call.method !== 'GET').length, 4);

  journal = await openJournal({ directory, runId: scope.runId });
  client = createCreationPcoClient({
    scope,
    approvalHash,
    journal,
    appId: 'fixture-app',
    secret: 'fixture-secret',
    fetchImpl: statefulFakeFetch(transport, fetchCalls),
  });
  adapter = createAdapter({ scope, client, journal, now: () => '2026-10-21T13:04:00.000Z' });
  const recovered = await adapter.executeCreation({ approvalHash });

  assert.deepEqual(recovered.bindings, {
    A: { planId: '1001', arrival: '1003', event: '1004' },
    B: { planId: '1101', arrival: '1103', event: '1104' },
  });
  const writes = fetchCalls.filter(call => call.method !== 'GET');
  assert.equal(writes.length, 8);
  assert.equal(writes.filter(call => call.body.data.attributes.name === `${scope.runId}:A:event`).length, 1);
});

test('completed live creation is idempotent across a journal reopen', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-reopen';
  const fixture = await creationFixture(t, { scope });
  const approvalHash = reviewCreation(scope).approvalHash;
  const first = await fixture.adapter.executeCreation({ approvalHash });
  const writesAfterFirstRun = fixture.calls.filter(call => call.kind === 'request').length;
  assert.equal(writesAfterFirstRun, 8);

  const reopened = createAdapter({
    scope,
    client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T13:05:00.000Z',
  });
  const second = await reopened.executeCreation({ approvalHash });

  assert.deepEqual(second.bindings, first.bindings);
  assert.deepEqual(second.snapshots.map(snapshot => snapshot.plan.id), ['1001', '1101']);
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, writesAfterFirstRun);
  assert.equal(fixture.collections.get(fixture.plansPath).data.length, 2);
});

test('lost second-time POST response recovers after reopen and continues B without duplicates', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-lost-second-time';
  const fixture = await creationFixture(t, { scope });
  const approvalHash = reviewCreation(scope).approvalHash;
  fixture.drops.postTimeName = `${scope.runId}:A:event`;

  await assert.rejects(
    () => fixture.adapter.executeCreation({ approvalHash }),
    error => error.code === 'OUTCOME_UNKNOWN',
  );
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 4);
  assert.deepEqual((await fixture.journal.inspect()).bindings.A, { planId: '1001', arrival: '1003' });

  const reopened = createAdapter({
    scope,
    client: fixture.client,
    journal: await openJournal({ directory: fixture.directory, runId: scope.runId }),
    now: () => '2026-10-21T13:10:00.000Z',
  });
  const result = await reopened.executeCreation({ approvalHash });

  assert.deepEqual(result.bindings, {
    A: { planId: '1001', arrival: '1003', event: '1004' },
    B: { planId: '1101', arrival: '1103', event: '1104' },
  });
  assert.equal(fixture.calls.filter(call => call.kind === 'request').length, 8);
  assert.equal(fixture.calls.filter(call => call.kind === 'request' && call.method === 'POST' &&
    call.body.data.attributes.name === `${scope.runId}:A:event`).length, 1);
  assert.equal(fixture.collections.get(fixture.plansPath).data.length, 2);
});

test('external roster drift after A arrival creation stops every later write', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-roster-drift';
  const fixture = await creationFixture(t, { scope });
  fixture.drops.afterRequest = call => {
    if (call.method !== 'POST' || call.body.data.attributes.name !== `${scope.runId}:A:arrival`) return;
    fixture.drops.afterRequest = null;
    fixture.collections.get(`${fixture.base}/plans/1001/team_members?per_page=100`).data.push(
      row('PlanPerson', '1998', { status: 'U' }),
    );
  };

  await assert.rejects(
    () => fixture.adapter.executeCreation({ approvalHash: reviewCreation(scope).approvalHash }),
    error => error.code === 'UNSAFE_PLAN',
  );
  const writes = fixture.calls.filter(call => call.kind === 'request');
  assert.equal(writes.length, 3);
  assert.equal(writes.filter(call => call.method === 'POST' && call.path.endsWith('/plan_times')).length, 1);
  assert.equal(fixture.collections.get(fixture.plansPath).data.length, 1);
});

test('reminders re-enabled after the initial time read stop before the first time POST', async t => {
  const scope = creationScope();
  scope.runId = 'live-creation-reminder-race';
  const fixture = await creationFixture(t, { scope });
  const path = `${fixture.base}/plans/1001/plan_times?per_page=100`;
  fixture.drops.afterCollection = readPath => {
    const plan = fixture.gets.get(`${fixture.base}/plans/1001`);
    if (readPath !== path || plan?.attributes.reminders_disabled !== true) return;
    fixture.drops.afterCollection = null;
    plan.attributes.reminders_disabled = false;
  };

  await assert.rejects(
    () => fixture.adapter.executeCreation({ approvalHash: reviewCreation(scope).approvalHash }),
    error => error.code === 'UNSAFE_PLAN',
  );
  const writes = fixture.calls.filter(call => call.kind === 'request');
  assert.deepEqual(writes.map(call => call.method), ['POST', 'PATCH']);
  assert.equal(writes.filter(call => call.path.endsWith('/plan_times')).length, 0);
  assert.equal(fixture.collections.get(fixture.plansPath).data.length, 1);
});

test('live-creation mode cannot use any rehearsal mutation method', async t => {
  const fixture = await creationFixture(t);

  for (const action of [
    () => fixture.adapter.rehearseCreatePlan('A'),
    () => fixture.adapter.rehearseCreateTimes('A'),
    () => fixture.adapter.rehearseReschedule(),
  ]) await assert.rejects(action, error => error.code === 'LIVE_WRITES_DISABLED');
  assert.equal(fixture.calls.length, 0);
});
