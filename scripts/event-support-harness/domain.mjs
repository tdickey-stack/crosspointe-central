// Offline simulation only. This module deliberately has no transport or credentials.
import { createHash } from 'node:crypto';

const copy = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const instant = value => {
  assert(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Expected an ISO timestamp with an explicit timezone');
  return Date.parse(value);
};
const windowOf = row => {
  const start = instant(row.startsAt);
  const end = instant(row.endsAt);
  assert(end > start, 'Time window must end after it starts');
  return [start, end];
};
const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];
const text = value => typeof value === 'string' && value.trim().length > 0;
const fixtureId = value => typeof value === 'string' && /^fixture-[a-z0-9-]+$/.test(value);
const checkFixtureIds = value => {
  if (Array.isArray(value)) { value.forEach(checkFixtureIds); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id' || key.endsWith('Id')) assert(fixtureId(child), 'All input IDs must use fictional fixture- identifiers');
    if (key.endsWith('Ids')) assert(Array.isArray(child) && child.every(fixtureId), 'All input ID arrays must use fictional fixture- identifiers');
    checkFixtureIds(child);
  }
};

/** A complete read is mandatory before deciding whether creation can be retried. */
export function reconcileCreation(operation, candidates, { complete = true } = {}) {
  assert(text(operation?.marker) && text(operation?.serviceTypeId), 'Creation requires a marker and service type');
  assert(Array.isArray(candidates), 'Creation candidates must be an array');
  if (!complete) return { decision: 'needs-repair', reason: 'Incomplete lookup; creation outcome remains unknown' };
  const matches = candidates.filter(row => row.marker === operation.marker && row.serviceTypeId === operation.serviceTypeId);
  if (matches.length > 1 || (matches.length === 1 && !text(matches[0].id))) {
    return { decision: 'needs-repair', reason: 'Ambiguous matching resources' };
  }
  return matches.length ? { decision: 'attach', resourceId: matches[0].id } : { decision: 'retry' };
}

/** Small-fixture allocation: maximize coverage without assigning one person twice at once. */
export function evaluateCoverage(requirements, assignments, revision) {
  assert(Array.isArray(requirements) && Array.isArray(assignments), 'Coverage requires requirements and assignments');
  assert(Number.isInteger(revision) && revision > 0, 'Coverage requires a positive revision');
  assert(new Set(requirements.map(row => row.id)).size === requirements.length, 'Duplicate requirement IDs');
  const slots = [];
  for (const requirement of requirements) {
    assert(text(requirement.id) && text(requirement.teamId) && text(requirement.role), 'Requirements need IDs, teams and roles');
    assert(Number.isInteger(requirement.quantity) && requirement.quantity > 0 && requirement.quantity <= 12, 'Requirement quantity must be 1–12');
    const window = windowOf(requirement);
    for (let i = 0; i < requirement.quantity; i++) slots.push({ requirement, window });
  }
  assert(slots.length <= 12 && assignments.length <= 100, 'Coverage exceeds small-fixture limits');
  const rows = assignments.map(row => {
    assert(text(row.personId) && text(row.teamId) && text(row.role) && ['C', 'U', 'D'].includes(row.status), 'Invalid assignment identity, role or status');
    return { ...row, window: windowOf(row) };
  });
  for (const slot of slots) {
    slot.people = [...new Set(rows.filter(row => row.status === 'C' && row.confirmedRevision === revision &&
      row.teamId === slot.requirement.teamId && row.role === slot.requirement.role &&
      row.window[0] <= slot.window[0] && row.window[1] >= slot.window[1]).map(row => row.personId))].sort();
  }
  slots.sort((a, b) => a.people.length - b.people.length || a.requirement.id.localeCompare(b.requirement.id));
  let best = [];
  let steps = 0;
  const search = (index, chosen) => {
    assert(++steps <= 50000, 'Coverage exceeds the 50000 search bound; simplify fixture');
    if (chosen.length + slots.length - index <= best.length) return;
    if (index === slots.length) { best = [...chosen]; return; }
    const slot = slots[index];
    for (const personId of slot.people) {
      if (chosen.some(row => row.personId === personId && overlaps(row.window, slot.window))) continue;
      search(index + 1, [...chosen, { personId, window: slot.window, requirementId: slot.requirement.id }]);
    }
    search(index + 1, chosen);
  };
  search(0, []);
  const gaps = requirements.map(row => ({ requirementId: row.id, missing: row.quantity - best.filter(item => item.requirementId === row.id).length })).filter(row => row.missing > 0);
  return { state: gaps.length ? 'Needs attention' : 'Coverage confirmed', required: slots.length, confirmed: best.length, gaps };
}

/** Proposal only; no API operation is executed. Snapshot history is never modified. */
export function planReschedule(snapshot, newSchedule) {
  assert(Number.isInteger(snapshot.revision) && snapshot.revision > 0, 'Invalid schedule revision');
  const [oldStart, oldEnd] = windowOf(snapshot.occurrence);
  const [newStart, newEnd] = windowOf(newSchedule);
  assert(text(snapshot.plan?.id) && text(snapshot.occurrence.id), 'Exact plan and occurrence IDs are required');
  assert(Array.isArray(snapshot.times) && snapshot.times.length > 0, 'Mapped plan times are required');
  assert(Array.isArray(snapshot.assignments) && Array.isArray(snapshot.requirements), 'Assignment and requirement snapshots are required');
  assert(new Set(snapshot.times.map(row => row.id)).size === snapshot.times.length, 'Duplicate plan time IDs');
  snapshot.times.forEach(row => { assert(text(row.id), 'Missing plan time ID'); windowOf(row); });
  const changed = oldStart !== newStart || oldEnd !== newEnd;
  const result = copy(snapshot);
  result.actions = [];
  result.state = changed ? 'Needs reconfirmation' : evaluateCoverage(snapshot.requirements, snapshot.assignments, snapshot.revision).state;
  if (!changed) return result;
  result.revision++;
  result.occurrence = { ...result.occurrence, startsAt: newSchedule.startsAt, endsAt: newSchedule.endsAt };
  const shift = row => {
    const [start, end] = windowOf(row);
    // Setup is anchored to event start; cleanup to event end. Spanning
    // windows retain their arrival and departure offsets independently.
    const startDelta = start >= oldEnd ? newEnd - oldEnd : newStart - oldStart;
    const endDelta = end <= oldStart ? newStart - oldStart : newEnd - oldEnd;
    const shifted = { ...copy(row), startsAt: new Date(start + startDelta).toISOString(), endsAt: new Date(end + endDelta).toISOString() };
    windowOf(shifted);
    return shifted;
  };
  result.times = snapshot.times.map(row => {
    const shifted = shift(row);
    result.actions.push({ kind: 'update-time', targetId: row.id, planId: snapshot.plan.id, before: copy(row), after: shifted });
    return shifted;
  });
  const affectedTimes = new Set(snapshot.times.map(row => row.id));
  result.assignments = snapshot.assignments.map(row => {
    assert(Array.isArray(row.timeIds) && row.timeIds.length > 0, 'Assignment time mapping is required before rescheduling');
    assert(['C', 'U', 'D'].includes(row.status), 'Unknown assignment status');
    if (!row.timeIds.some(id => affectedTimes.has(id))) return copy(row);
    if (row.status === 'C') assert(row.timeIds.every(id => affectedTimes.has(id)), 'Cannot reset a confirmed assignment spanning times outside this occurrence');
    const shifted = shift(row);
    if (row.status !== 'C') return shifted;
    result.actions.push({ kind: 'reset-confirmation', targetId: row.id, beforeStatus: 'C', afterStatus: 'U' });
    return { ...shifted, status: 'U', confirmedRevision: null };
  });
  result.requirements = snapshot.requirements.map(shift);
  return result;
}

export function validateFixture(fixture) {
  assert(fixture?.schemaVersion === 1 && fixture.simulated === true, 'Only schemaVersion 1 simulated fixtures are accepted');
  checkFixtureIds(fixture);
  assert(fixtureId(fixture.runId) && fixtureId(fixture.serviceTypeId), 'Use fictional fixture- IDs, never live PCO IDs');
  assert(fixture.timezone === 'America/Chicago', 'Fixture timezone must be America/Chicago');
  assert(instant(fixture.renewedEvidenceTime) > instant(fixture.evidenceTime), 'Renewed evidence must follow initial evidence');
  assert(Array.isArray(fixture.occurrences) && fixture.occurrences.length === 2, 'Exactly two fictional occurrences are required');
  const dates = [];
  const identities = new Set();
  for (const event of fixture.occurrences) {
    assert(fixtureId(event.id) && fixtureId(event.parentEventId), 'Exact fictional parent and occurrence IDs required');
    assert(!identities.has(event.id), 'Duplicate occurrence ID'); identities.add(event.id);
    windowOf(event);
    dates.push(new Intl.DateTimeFormat('en-US', { timeZone: fixture.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.startsAt)));
  }
  assert(fixture.occurrences[0].parentEventId !== fixture.occurrences[1].parentEventId, 'Same-date scenario needs unrelated parent events');
  assert(dates[0] === dates[1], 'Same-date scenario requires the same America/Chicago calendar date');
  const s = fixture.snapshot;
  assert(s && s.occurrence?.id === fixture.occurrences[0].id && s.occurrence.startsAt === fixture.occurrences[0].startsAt && s.occurrence.endsAt === fixture.occurrences[0].endsAt, 'Snapshot must match the first occurrence exactly');
  assert(fixtureId(s.plan?.id), 'Use a fictional plan ID');
  for (const row of [...(s.times || []), ...(s.requirements || []), ...(s.assignments || [])]) {
    assert(fixtureId(row.id), 'All snapshot IDs must be fictional');
    if ('teamId' in row) assert(fixtureId(row.teamId), 'Use fictional teams');
    if ('personId' in row) assert(fixtureId(row.personId), 'Use fictional participants');
    if ('timeIds' in row) assert(Array.isArray(row.timeIds) && row.timeIds.every(fixtureId), 'Use fictional time IDs');
  }
  assert(s.assignments?.some(row => row.status === 'C') && s.assignments?.some(row => row.status === 'D'), 'Scenario requires an accepted assignment and a declined assignment');
  evaluateCoverage(s.requirements, s.assignments, s.revision);
  const proposal = planReschedule(s, fixture.reschedule);
  assert(proposal.actions.length > 0, 'Scenario requires a material reschedule');
  return fixture;
}

/** Rehearses recovery and scheduling state using in-memory fictional resources. */
export function runSimulation(input) {
  const fixture = copy(validateFixture(input));
  const journal = [];
  const plans = [];
  const checks = [];
  const record = (operationId, state, details = {}) => journal.push({ sequence: journal.length + 1, operationId, state, simulated: true, ...details });
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
  for (const [index, event] of fixture.occurrences.entries()) {
    const marker = `${fixture.runId}:${event.parentEventId}:${event.id}`;
    const operation = { marker, serviceTypeId: fixture.serviceTypeId };
    const operationId = digest(operation).slice(0, 24);
    const proposedRequest = { method: 'POST', path: `/services/v2/service_types/${fixture.serviceTypeId}/plans`, body: { data: { type: 'Plan', attributes: { title: `[SIMULATION] ${marker}`, public: false } } } };
    record(operationId, 'planned', { occurrenceId: event.id, parentEventId: event.parentEventId, marker, bodyHash: digest(proposedRequest.body), proposedRequest });
    const plan = { id: index === 0 ? fixture.snapshot.plan.id : 'fixture-plan-b', ...operation, occurrenceId: event.id, startsAt: event.startsAt, endsAt: event.endsAt };
    plans.push(plan); // Fake provider success; nothing is sent.
    record(operationId, index === 0 ? 'outcome-unknown' : 'simulated-created', { reason: index === 0 ? 'Simulated lost response after provider creation' : 'Simulated provider response' });
    const recovered = reconcileCreation(operation, plans);
    record(operationId, 'simulated-linked', recovered);
    check(`Recover ${event.id} by exact marker`, recovered.decision === 'attach' && recovered.resourceId === plan.id);
    const replay = reconcileCreation(operation, plans);
    check(`Replay ${event.id} attaches without another create`, replay.decision === 'attach');
  }
  check('Two unrelated same-date occurrences retain distinct plans', new Set(plans.map(row => row.id)).size === 2);
  const operation = { marker: plans[0].marker, serviceTypeId: plans[0].serviceTypeId };
  check('Incomplete lookup cannot authorize a retry', reconcileCreation(operation, [], { complete: false }).decision === 'needs-repair');
  check('Ambiguous matching plans require repair', reconcileCreation(operation, [plans[0], { ...plans[0], id: 'fixture-duplicate' }]).decision === 'needs-repair');
  check('Authoritative empty lookup permits a proposed retry', reconcileCreation(operation, []).decision === 'retry');
  const baseline = copy(fixture.snapshot);
  const before = { snapshot: baseline, coverage: evaluateCoverage(baseline.requirements, baseline.assignments, baseline.revision) };
  const accepted = baseline.assignments.find(row => row.status === 'C');
  const prepared = { ...accepted, status: 'U', confirmedRevision: null, prepareNotification: true, notificationSentAt: null };
  const sent = { ...prepared, prepareNotification: false, notificationSentAt: fixture.evidenceTime };
  record('fixture-invitation', 'simulated-prepared', { assignment: prepared });
  record('fixture-invitation', 'manual-leader-send-simulated', { assignment: sent });
  record('fixture-invitation', 'volunteer-response-simulated', { assignment: accepted });
  check('Prepared and sent-but-unconfirmed rows do not count', evaluateCoverage(baseline.requirements, [prepared, sent], baseline.revision).confirmed === 0);
  const siblingBefore = copy(plans[1]);
  const proposal = planReschedule(baseline, fixture.reschedule);
  for (const action of proposal.actions) record(`fixture-reschedule:${action.targetId}`, 'proposed-only', action);
  plans[0].startsAt = fixture.reschedule.startsAt;
  plans[0].endsAt = fixture.reschedule.endsAt;
  const after = { proposal, coverage: evaluateCoverage(proposal.requirements, proposal.assignments, proposal.revision) };
  check('Only the selected occurrence moves', JSON.stringify(siblingBefore) === JSON.stringify(plans[1]));
  check('Old accepted coverage requires reconfirmation', proposal.state === 'Needs reconfirmation' && after.coverage.confirmed === 0);
  check('Declines and invitation history survive', baseline.assignments.filter(row => row.status === 'D').every(row => {
    const updated = proposal.assignments.find(item => item.id === row.id);
    return updated.status === 'D' && updated.declineReason === row.declineReason && updated.notificationSentAt === row.notificationSentAt;
  }));
  const renewed = proposal.assignments.map(row => row.id === accepted.id ? { ...row, status: 'C', confirmedRevision: proposal.revision, notificationSentAt: fixture.renewedEvidenceTime } : row);
  record('fixture-reconfirmation', 'manual-send-and-fresh-response-simulated', { assignmentId: accepted.id, revision: proposal.revision });
  const renewedCoverage = evaluateCoverage(proposal.requirements, renewed, proposal.revision);
  check('Fresh confirmation restores only its covered role', renewedCoverage.confirmed > after.coverage.confirmed && renewedCoverage.gaps.length > 0);
  return {
    mode: 'dry-run', simulated: true, liveRequests: 0,
    notice: 'All dates, people, plans and responses are fictional. No PCO behavior or live Phase 1 acceptance is proven.',
    fixtureHash: digest(fixture), checks, journal, plans, before, after, renewedCoverage,
    pendingLiveEvidence: ['Choose test date, leader, recipients and participants', 'Configure Event Support service type and reviewed roles', 'Verify write permissions and exact needed-position payloads', 'Observe native invitations, responses and notification routing', 'Verify targeted reset/re-preparation, partial-time behavior and old invitation links', 'Prove live create recovery and cleanup with a durable operation journal'],
  };
}
