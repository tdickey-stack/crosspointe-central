import { validateScope, reviewPlan, planTitle, schedule, hash, check, fail } from './scope.mjs';

const copy = value => structuredClone(value);
const rel = (row, key) => row.relationships?.[key]?.data;
const one = (payload, type, id) => {
  const row = payload?.data;
  check(row?.type === type && /^[1-9]\d*$/.test(row.id) && (!id || row.id === id) && row.attributes && typeof row.attributes === 'object', 'Unexpected PCO resource identity or shape.', 'RESOURCE_MISMATCH');
  return row;
};
const complete = result => {
  check(result?.complete === true && Array.isArray(result.data), 'Complete collection required.', 'INCOMPLETE_READ');
  check(new Set(result.data.map(r => `${r.type}:${r.id}`)).size === result.data.length, 'Duplicate resources require repair.', 'NEEDS_REPAIR');
  return result.data;
};
const status = value => ({ c: 'C', u: 'U', d: 'D', confirmed: 'C', unconfirmed: 'U', declined: 'D' })[String(value).toLowerCase()];
const sourceTime = value => {
  check(typeof value === 'string' && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'PCO timestamp is missing an explicit timezone.', 'RESOURCE_MISMATCH');
  return new Date(value).toISOString();
};
const optionalTime = value => value == null ? null : sourceTime(value);
const sameTime = (left, right) => sourceTime(left) === sourceTime(right);
const attrsMatch = (actual, expected) => Object.entries(expected).every(([key, value]) =>
  ['starts_at', 'ends_at'].includes(key) ? typeof actual[key] === 'string' && sameTime(actual[key], value) : key === 'status' ? status(actual[key]) === status(value) : hash(actual[key] ?? null) === hash(value));
const patch = (key, path, type, id, before, after) => ({ key, method: 'PATCH', path, type, id, before, after, body: { data: { type, id, attributes: after } } });

/** The only network implementation supplied by this package rejects all mutations.
 * Rehearsal methods deliberately require an injected in-memory simulation client. */
export function createAdapter({ scope: input, client, journal, now = () => new Date().toISOString() }) {
  const scope = validateScope(input);
  check(client?.get && client?.collection && client?.request && journal?.withLock, 'Client and journal required.');
  const base = `/services/v2/service_types/${scope.serviceTypeId}`;
  const occurrence = key => { const o = scope.occurrences.find(o => o.key === key); check(o, 'Unknown occurrence.'); return o; };
  const simulationOnly = () => check(client.mode === 'simulation', 'Live PCO writes and invitations are disabled.', 'LIVE_WRITES_DISABLED');
  async function bind(session) {
    check(!session.state.scopeHash || session.state.scopeHash === hash(scope), 'Journal scope changed; review and use a separate run.', 'SCOPE_CHANGED');
    if (!session.state.scopeHash) { session.state.scopeHash = hash(scope); session.state.bindings = {}; await session.save(); }
  }
  async function locked(fn) { return journal.withLock(async session => { await bind(session); return fn(session); }); }
  const resolved = (o, session) => {
    const b = session.state.bindings?.[o.key] ?? {};
    return { ...o, planId: o.planId ?? b.planId ?? null, timeIds: { arrival: o.timeIds.arrival ?? b.arrival ?? null, event: o.timeIds.event ?? b.event ?? null } };
  };
  async function verifySetup() {
    check(scope.serviceTypeId && scope.team.id, 'Explicit service type and team IDs are required.', 'SETUP_REQUIRED');
    const service = one(await client.get(base), 'ServiceType', scope.serviceTypeId);
    const team = one(await client.get(`/services/v2/teams/${scope.team.id}`), 'Team', scope.team.id);
    check(service.attributes.name === scope.serviceTypeName && team.attributes.name === scope.team.name, 'Selected service type or team does not match the reviewed setup.', 'RESOURCE_MISMATCH');
    check(rel(team, 'service_type')?.id === scope.serviceTypeId && rel(team, 'default_responds_to')?.id === scope.people.responseRecipientId && team.attributes.schedule_to === 'plan' && status(team.attributes.default_status) === 'U' && !team.attributes.archived_at && !team.attributes.deleted_at,
      'Tech must be an active, unsplit team with unconfirmed defaults and the reviewed response recipient.', 'SETUP_REQUIRED');
    const leaders = complete(await client.collection(`/services/v2/teams/${scope.team.id}/team_leaders?per_page=100`));
    check(leaders.length === 1 && leaders[0].type === 'TeamLeader' && rel(leaders[0], 'person')?.id === scope.people.leaderId && rel(leaders[0], 'team')?.id === scope.team.id && leaders[0].attributes?.send_responses_for_accepts === true && leaders[0].attributes?.send_responses_for_declines === true,
      'Only the approved leader may receive acceptance and decline responses.', 'SETUP_REQUIRED');
    const positions = complete(await client.collection(`/services/v2/teams/${scope.team.id}/team_positions?per_page=100`));
    check(positions.length === 2 && scope.team.requirements.every(r => positions.filter(p => p.type === 'TeamPosition' && p.attributes?.name === r.role).length === 1), 'The Tech team needs exactly the two reviewed roles.', 'SETUP_REQUIRED');
    return { serviceTypeId: service.id, teamId: team.id };
  }
  async function calendar(o) {
    check(o.eventId && o.instanceId, 'Explicit Calendar parent and occurrence IDs required.', 'SETUP_REQUIRED');
    const row = one(await client.get(`/calendar/v2/event_instances/${o.instanceId}`), 'EventInstance', o.instanceId);
    check(rel(row, 'event')?.id === o.eventId, 'Calendar parent does not match the explicit occurrence link.', 'RESOURCE_MISMATCH');
    check(row.attributes.all_day_event === false, 'Timed test occurrence required.', 'RESOURCE_MISMATCH');
    return { id: row.id, eventId: o.eventId, startsAt: sourceTime(row.attributes.starts_at), endsAt: sourceTime(row.attributes.ends_at) };
  }
  async function preflight() {
    return locked(async session => {
      const result = { ...reviewPlan(scope), mode: 'live-read-only', checked: [], readyForLiveWrites: false };
      // Name matches are informational candidates only; never assign an ID from them.
      if (!scope.serviceTypeId) {
        const rows = complete(await client.collection('/services/v2/service_types?per_page=100'));
        result.serviceTypeCandidates = rows.filter(r => r.type === 'ServiceType' && r.attributes?.name === scope.serviceTypeName).map(r => ({ id: r.id, name: r.attributes.name }));
      } else if (scope.team.id) result.checked.push(await verifySetup());
      for (const person of scope.people.participants) {
        const row = one(await client.get(`/services/v2/people/${person.id}`), 'Person', person.id);
        result.checked.push({ personId: row.id, expectedName: person.name, actualName: [row.attributes.first_name, row.attributes.last_name].filter(Boolean).join(' '), permissions: row.attributes.permissions ?? null });
      }
      for (const o of scope.occurrences) if (o.eventId && o.instanceId) result.checked.push({ key: o.key, occurrence: await calendar(o) });
      session.state.history.push({ kind: 'read-only-preflight', at: now(), blockers: result.blockers });
      await session.save();
      return result;
    });
  }
  async function readSnapshot(key, session) {
    const o = resolved(occurrence(key), session);
    await verifySetup();
    check(o.planId && o.timeIds.arrival && o.timeIds.event, 'Exact plan and both time IDs required.', 'SETUP_REQUIRED');
    const event = await calendar(o);
    const planPath = `${base}/plans/${o.planId}`;
    const plan = one(await client.get(planPath), 'Plan', o.planId);
    check(plan.attributes.title === planTitle(scope, key) && rel(plan, 'service_type')?.id === scope.serviceTypeId, 'Plan marker or service type does not match.', 'RESOURCE_MISMATCH');
    check(plan.attributes.public === false && plan.attributes.public_by_schedule !== true && plan.attributes.reminders_disabled === true, 'Plan must be private with serving reminders disabled.', 'UNSAFE_PLAN');
    const times = complete(await client.collection(`${planPath}/plan_times?per_page=100`));
    check(times.length === 2, 'Only the two explicitly mapped plan times are allowed.', 'RESOURCE_MISMATCH');
    const mappedTimes = ['arrival', 'event'].map(kind => {
      const row = times.find(r => r.id === o.timeIds[kind]);
      one({ data: row }, 'PlanTime', o.timeIds[kind]);
      // PlanTime has no plan relationship; membership is proven by this exact
      // plan's complete collection, never by a service-type-wide time lookup.
      check(row.attributes.time_type === (kind === 'arrival' ? 'other' : 'service'), 'Unexpected plan time mapping.', 'RESOURCE_MISMATCH');
      check(Array.isArray(row.attributes.team_reminders) && row.attributes.team_reminders.length === 0, 'Plan time reminders must be empty.', 'UNSAFE_PLAN');
      return { id: row.id, kind, startsAt: sourceTime(row.attributes.starts_at), endsAt: sourceTime(row.attributes.ends_at), timeType: row.attributes.time_type };
    });
    const members = complete(await client.collection(`${planPath}/team_members?per_page=100`));
    check(key !== 'B' || members.length === 0, 'The control plan must have no participants.', 'RESOURCE_MISMATCH');
    const peopleSeen = new Set();
    const assignments = members.map(row => {
      one({ data: row }, 'PlanPerson');
      const personId = rel(row, 'person')?.id;
      const participant = scope.people.participants.find(p => p.id === personId);
      const timeLinks = rel(row, 'times');
      check(participant && !peopleSeen.has(personId) && rel(row, 'team')?.id === scope.team.id && rel(row, 'plan')?.id === o.planId && rel(row, 'service_type')?.id === scope.serviceTypeId && rel(row, 'responds_to')?.id === scope.people.responseRecipientId && row.attributes.team_position_name === participant.role,
        'Roster identity, role, team or response recipient is outside the reviewed scope.', 'RESOURCE_MISMATCH');
      peopleSeen.add(personId);
      check(row.attributes.can_accept_partial === false && Array.isArray(timeLinks) && timeLinks.length === 2 && new Set(timeLinks.map(t => t.id)).size === 2 && timeLinks.every(t => t.type === 'PlanTime' && Object.values(o.timeIds).includes(t.id)), 'Partial or mixed time assignments require manual review.', 'PARTIAL_ASSIGNMENT');
      check(status(row.attributes.status), 'Unknown assignment status.', 'RESOURCE_MISMATCH');
      return { id: row.id, personId, teamId: scope.team.id, role: participant.role, status: status(row.attributes.status), timeIds: timeLinks.map(t => t.id).sort(),
        notificationSentAt: optionalTime(row.attributes.notification_sent_at), notificationPreparedAt: optionalTime(row.attributes.notification_prepared_at),
        statusUpdatedAt: optionalTime(row.attributes.status_updated_at), hasDeclineReason: Boolean(row.attributes.decline_reason), confirmedRevision: null };
    });
    const positions = complete(await client.collection(`${planPath}/needed_positions?per_page=100`));
    const requirements = positions.map(row => {
      one({ data: row }, 'NeededPosition');
      check(rel(row, 'plan')?.id === o.planId && rel(row, 'team')?.id === scope.team.id && scope.team.requirements.some(r => r.role === row.attributes.team_position_name) && Number.isInteger(row.attributes.quantity) && row.attributes.quantity >= 0 && (!rel(row, 'time') || Object.values(o.timeIds).includes(rel(row, 'time').id)),
        'Needed position mapping is outside the reviewed scope.', 'RESOURCE_MISMATCH');
      return { id: row.id, role: row.attributes.team_position_name, quantity: row.attributes.quantity, timeId: rel(row, 'time')?.id ?? null };
    });
    return { key, at: now(), occurrence: event, plan: { id: o.planId, title: plan.attributes.title, public: false, remindersDisabled: true }, times: mappedTimes, assignments, requirements,
      coverage: { state: 'Manual evidence required', required: 2, confirmed: null, requiresManualReconfirmationEvidence: true } };
  }
  async function capture(key) {
    return locked(async session => {
      try {
        const snapshot = await readSnapshot(key, session);
        session.state.snapshots.push(snapshot); await session.save(); return snapshot;
      } catch (error) {
        session.state.history.push({ kind: 'snapshot-read-failed', key, at: now(), code: 'READ_FAILED', previousSnapshotRetained: true });
        await session.save(); throw error;
      }
    });
  }
  const fingerprint = snapshot => hash({ ...snapshot, at: null });
  function assertSchedule(snapshot, wanted, withTimes = true) {
    check(sameTime(snapshot.occurrence.startsAt, wanted.startsAt) && sameTime(snapshot.occurrence.endsAt, wanted.endsAt), 'Calendar occurrence is not at the expected schedule.', 'SCHEDULE_DRIFT');
    if (withTimes) for (const time of snapshot.times) check(sameTime(time.startsAt, time.kind === 'arrival' ? wanted.arrivalAt : wanted.startsAt) && sameTime(time.endsAt, time.kind === 'arrival' ? wanted.startsAt : wanted.endsAt), 'Mapped plan time differs from the reviewed schedule.', 'SCHEDULE_DRIFT');
  }
  async function proposal(session) {
    const before = await readSnapshot('A', session);
    const control = await readSnapshot('B', session);
    const original = schedule(scope, occurrence('A'));
    const target = schedule(scope, occurrence('A'), scope.reschedule);
    assertSchedule(control, schedule(scope, occurrence('B')));
    // Preview may happen before or after the manual Calendar move. Plan times must
    // still be at the baseline; recovery uses the saved proposal instead.
    const calendarMoved = sameTime(before.occurrence.startsAt, target.startsAt) && sameTime(before.occurrence.endsAt, target.endsAt);
    assertSchedule({ ...before, occurrence: calendarMoved ? { ...before.occurrence, startsAt: original.startsAt, endsAt: original.endsAt } : before.occurrence }, original);
    const actions = before.times.map(t => patch(`time:${t.id}`, `${base}/plan_times/${t.id}`, 'PlanTime', t.id,
      { starts_at: t.startsAt, ends_at: t.endsAt }, { starts_at: t.kind === 'arrival' ? target.arrivalAt : target.startsAt, ends_at: t.kind === 'arrival' ? target.startsAt : target.endsAt }));
    for (const a of before.assignments.filter(a => a.status === 'C')) actions.push(patch(`reset:${a.id}`, `/services/v2/people/${a.personId}/plan_people/${a.id}`, 'PlanPerson', a.id, { status: 'C' }, { status: 'U' }));
    return { before, control, calendarMoved, actions, requiresManualReconfirmationEvidence: true };
  }
  async function previewReschedule() { return locked(proposal); }

  // Durable per-operation intent. After a lost response, only a read proving the
  // intended state permits completion. An empty lookup never silently resends.
  async function applyPatch(session, operationKey, action) {
    const intentHash = hash(action);
    let op = session.state.operations[operationKey];
    check(!op || op.intentHash === intentHash, 'Operation intent changed.', 'SCOPE_CHANGED');
    const current = one(await client.get(action.path), action.type, action.id);
    if (attrsMatch(current.attributes, action.after)) {
      check(op, 'Desired state exists without this run owning the operation.', 'NEEDS_REPAIR');
      op.status = 'complete'; await session.save(); return;
    }
    check(!op, 'Uncertain or changed PATCH outcome needs manual repair.', 'NEEDS_REPAIR');
    check(attrsMatch(current.attributes, action.before), 'Resource changed since the preview.', 'SCHEDULE_DRIFT');
    op = { intentHash, status: 'intent', action: copy(action), at: now() };
    session.state.operations[operationKey] = op; await session.save();
    try {
      await client.request('PATCH', action.path, action.body);
      const readback = one(await client.get(action.path), action.type, action.id);
      check(attrsMatch(readback.attributes, action.after), 'PATCH did not produce the expected state.', 'NEEDS_REPAIR');
      op.status = 'complete'; await session.save();
    } catch {
      op.status = 'outcome-unknown'; await session.save(); throw fail('OUTCOME_UNKNOWN', 'PATCH outcome is uncertain; rerun recovery before any further changes.');
    }
  }
  async function createResource(session, operationKey, { path, type, attributes, matches }) {
    const intentHash = hash({ path, type, attributes });
    let op = session.state.operations[operationKey];
    check(!op || op.intentHash === intentHash, 'Creation intent changed.', 'SCOPE_CHANGED');
    const candidates = complete(await client.collection(`${path}?per_page=100`)).filter(matches);
    check(candidates.length <= 1, 'Duplicate operation markers require repair.', 'NEEDS_REPAIR');
    if (candidates.length === 1) {
      const row = one({ data: candidates[0] }, type);
      check(op && (!op.resourceId || op.resourceId === row.id) && attrsMatch(row.attributes, attributes), 'Matching resource is not owned by this journal or changed.', 'NEEDS_REPAIR');
      op.status = 'complete'; op.resourceId = row.id; await session.save(); return row.id;
    }
    check(!op, 'No resource found for an uncertain create; manual repair required before retry.', 'NEEDS_REPAIR');
    op = { intentHash, status: 'intent', at: now(), path, type, attributes: copy(attributes) };
    session.state.operations[operationKey] = op; await session.save();
    try {
      const created = one(await client.request('POST', path, { data: { type, attributes } }), type);
      op.resourceId = created.id; await session.save();
      const readback = complete(await client.collection(`${path}?per_page=100`)).filter(matches);
      check(readback.length === 1 && readback[0].id === created.id && attrsMatch(readback[0].attributes, attributes), 'Creation readback is ambiguous.', 'NEEDS_REPAIR');
      op.status = 'complete'; await session.save(); return created.id;
    } catch {
      op.status = 'outcome-unknown'; await session.save(); throw fail('OUTCOME_UNKNOWN', 'Create outcome is uncertain; reconcile the journal before continuing.');
    }
  }
  async function rehearseCreatePlan(key) {
    simulationOnly();
    return locked(async session => {
      const o = occurrence(key); await verifySetup();
      const event = await calendar(o);
      check(sameTime(event.startsAt, o.startsAt) && sameTime(event.endsAt, o.endsAt), 'Calendar baseline changed.', 'SCHEDULE_DRIFT');
      check(!o.planId, 'Plan creation requires an unbound plan ID.', 'SETUP_REQUIRED');
      const title = planTitle(scope, key);
      const planId = await createResource(session, `create-plan:${key}`, { path: `${base}/plans`, type: 'Plan', attributes: { title, public: false }, matches: row => row.attributes?.title === title && rel(row, 'service_type')?.id === scope.serviceTypeId });
      session.state.bindings[key] = { ...session.state.bindings[key], planId }; await session.save();
      const plan = one(await client.get(`${base}/plans/${planId}`), 'Plan', planId);
      if (plan.attributes.reminders_disabled !== true || session.state.operations[`disable-reminders:${key}`]) {
        await applyPatch(session, `disable-reminders:${key}`, patch('disable-reminders', `${base}/plans/${planId}`, 'Plan', planId, { reminders_disabled: false }, { reminders_disabled: true }));
      }
      return { planId, simulated: true, invitationsEnabled: false };
    });
  }
  async function rehearseCreateTimes(key) {
    simulationOnly();
    return locked(async session => {
      const o = resolved(occurrence(key), session); await verifySetup();
      check(o.planId, 'Create or explicitly bind the reviewed plan first.', 'SETUP_REQUIRED');
      const plan = one(await client.get(`${base}/plans/${o.planId}`), 'Plan', o.planId);
      check(plan.attributes.title === planTitle(scope, key) && plan.attributes.public === false && plan.attributes.public_by_schedule !== true && plan.attributes.reminders_disabled === true && rel(plan, 'service_type')?.id === scope.serviceTypeId, 'Private test plan with reminders disabled required.', 'UNSAFE_PLAN');
      const members = complete(await client.collection(`${base}/plans/${o.planId}/team_members?per_page=100`));
      check(members.length === 0, 'Create times before adding participants.', 'UNSAFE_PLAN');
      const event = await calendar(o); const wanted = schedule(scope, o);
      check(sameTime(event.startsAt, wanted.startsAt) && sameTime(event.endsAt, wanted.endsAt), 'Calendar baseline changed.', 'SCHEDULE_DRIFT');
      const existingTimes = complete(await client.collection(`${base}/plans/${o.planId}/plan_times?per_page=100`));
      const existingKinds = new Set();
      for (const row of existingTimes) {
        const kind = ['arrival', 'event'].find(kind => row.attributes?.name === `${scope.runId}:${key}:${kind}`);
        const op = kind && session.state.operations[`create-time:${key}:${kind}`];
        check(row.type === 'PlanTime' && op && !existingKinds.has(kind) && (!op.resourceId || op.resourceId === row.id) && attrsMatch(row.attributes, op.attributes), 'Foreign, changed or ambiguous plan times require review before creation.', 'NEEDS_REPAIR');
        existingKinds.add(kind);
      }
      for (const kind of ['arrival', 'event']) {
        check(!occurrence(key).timeIds[kind], 'Time creation requires an unbound time ID.', 'SETUP_REQUIRED');
        const name = `${scope.runId}:${key}:${kind}`;
        const attributes = { name, time_type: kind === 'arrival' ? 'other' : 'service', starts_at: kind === 'arrival' ? wanted.arrivalAt : wanted.startsAt, ends_at: kind === 'arrival' ? wanted.startsAt : wanted.endsAt, team_reminders: [] };
        const timeId = await createResource(session, `create-time:${key}:${kind}`, { path: `${base}/plans/${o.planId}/plan_times`, type: 'PlanTime', attributes, matches: row => row.attributes?.name === name });
        session.state.bindings[key] = { ...session.state.bindings[key], [kind]: timeId }; await session.save();
      }
      return copy(session.state.bindings[key]);
    });
  }
  async function rehearseReschedule() {
    simulationOnly();
    return locked(async session => {
      let workflow = session.state.reschedule;
      if (!workflow) {
        const preview = await proposal(session);
        check(preview.calendarMoved, 'Move only Calendar A to the reviewed target before applying the proposal.', 'CALENDAR_MOVE_REQUIRED');
        workflow = { ...preview, status: 'intent', revision: 2, at: now() };
        session.state.reschedule = workflow; session.state.snapshots.push(preview.before, preview.control); await session.save();
      }
      // Even on recovery, never trust only the saved workflow or an old read.
      const currentA = await readSnapshot('A', session);
      const currentB = await readSnapshot('B', session);
      assertSchedule(currentA, schedule(scope, occurrence('A'), scope.reschedule), false);
      check(fingerprint(currentB) === fingerprint(workflow.control), 'Control B changed; stop for review.', 'CONTROL_CHANGED');
      check(hash(currentA.assignments.map(a => ({ id: a.id, personId: a.personId, timeIds: a.timeIds }))) === hash(workflow.before.assignments.map(a => ({ id: a.id, personId: a.personId, timeIds: a.timeIds }))), 'Roster changed after the saved proposal.', 'RESOURCE_MISMATCH');
      for (const baseline of workflow.before.assignments) {
        const current = currentA.assignments.find(row => row.id === baseline.id);
        const reset = session.state.operations[`reschedule:A:reset:${baseline.id}`];
        const ownedReset = baseline.status === 'C' && reset && current.status === 'U';
        check((current.status === baseline.status && current.statusUpdatedAt === baseline.statusUpdatedAt || ownedReset) && current.notificationSentAt === baseline.notificationSentAt && current.notificationPreparedAt === baseline.notificationPreparedAt && current.hasDeclineReason === baseline.hasDeclineReason,
          'Response or invitation evidence changed after the preview; review before moving times.', 'SCHEDULE_DRIFT');
      }
      for (const action of workflow.actions) await applyPatch(session, `reschedule:A:${action.key}`, action);
      const after = await readSnapshot('A', session);
      assertSchedule(after, schedule(scope, occurrence('A'), scope.reschedule));
      for (const a of workflow.before.assignments) {
        const updated = after.assignments.find(row => row.id === a.id);
        check(updated.status === (a.status === 'C' ? 'U' : a.status) && updated.notificationSentAt === a.notificationSentAt && updated.hasDeclineReason === a.hasDeclineReason, 'Response history changed unexpectedly.', 'NEEDS_REPAIR');
      }
      check(fingerprint(await readSnapshot('B', session)) === fingerprint(workflow.control), 'Control B changed during the rehearsal.', 'CONTROL_CHANGED');
      workflow.status = 'complete'; session.state.snapshots.push(after); await session.save();
      return { simulated: true, revision: 2, state: 'Needs reconfirmation', requiresManualReconfirmationEvidence: true, after };
    });
  }
  return Object.freeze({ preflight, capture, previewReschedule, rehearseCreatePlan, rehearseCreateTimes, rehearseReschedule });
}
