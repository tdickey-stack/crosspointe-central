import { createHash } from 'node:crypto';

export const fail = (code, message) => Object.assign(new Error(message), { code });
export function check(condition, message, code = 'INVALID_SCOPE') {
  if (!condition) throw fail(code, message);
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const keys = (value, names) => check(value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => names.includes(key)) && names.every(key => Object.hasOwn(value, key)), 'Unexpected or missing configuration fields.');
const id = value => check(value === null || typeof value === 'string' && /^[1-9]\d*$/.test(value), 'IDs must be explicit numeric strings or null.');
export const instant = value => {
  check(typeof value === 'string' && /T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), 'Use an explicit UTC ISO timestamp.');
  return Date.parse(value);
};
const window = row => check(instant(row.endsAt) > instant(row.startsAt), 'The event must end after its start.');
const offset = value => check(Number.isInteger(value) && value >= 0 && value <= 240, 'Arrival offset must be 0–240 minutes.');

/** Deliberately small, explicit review scope; no execution flag is accepted. */
export function validateScope(input) {
  const s = structuredClone(input);
  keys(s, ['schemaVersion', 'runId', 'timezone', 'serviceTypeName', 'serviceTypeId', 'team', 'people', 'occurrences', 'reschedule']);
  check(s.schemaVersion === 1 && typeof s.runId === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s.runId), 'Invalid schema or run ID.');
  check(s.timezone === 'America/Chicago' && s.serviceTypeName === 'Event Support', 'This adapter is scoped to Event Support in America/Chicago.');
  id(s.serviceTypeId);
  keys(s.team, ['id', 'name', 'arrivalOffsetMinutes', 'requirements']);
  id(s.team.id); offset(s.team.arrivalOffsetMinutes);
  check(s.team.name === 'Tech' && Array.isArray(s.team.requirements) && s.team.requirements.length === 2, 'Exactly two Tech roles are required.');
  for (const r of s.team.requirements) { keys(r, ['role', 'quantity']); check(['Sound', 'Graphics'].includes(r.role) && r.quantity === 1, 'Approved baseline is one Sound and one Graphics.'); }
  check(new Set(s.team.requirements.map(r => r.role)).size === 2, 'Duplicate role.');
  keys(s.people, ['leaderId', 'responseRecipientId', 'participants']);
  id(s.people.leaderId); id(s.people.responseRecipientId);
  check(s.people.leaderId && s.people.leaderId === s.people.responseRecipientId, 'The approved leader must also receive responses.');
  check(Array.isArray(s.people.participants) && s.people.participants.length === 2, 'Exactly two approved participants are required.');
  for (const p of s.people.participants) {
    keys(p, ['id', 'name', 'role']); id(p.id);
    check(p.id && typeof p.name === 'string' && p.name.trim() && ['Sound', 'Graphics'].includes(p.role), 'Invalid participant.');
  }
  check(new Set(s.people.participants.map(p => p.id)).size === 2 && new Set(s.people.participants.map(p => p.role)).size === 2 && s.people.participants.some(p => p.id === s.people.leaderId), 'Participants need distinct identities and roles, including the leader.');
  check(Array.isArray(s.occurrences) && s.occurrences.length === 2 && s.occurrences[0].key === 'A' && s.occurrences[1].key === 'B', 'Occurrences must be explicit A and B records.');
  for (const o of s.occurrences) {
    keys(o, ['key', 'title', 'eventId', 'instanceId', 'planId', 'timeIds', 'startsAt', 'endsAt', 'arrivalOffsetMinutes']);
    check(typeof o.title === 'string' && o.title.startsWith('TEST — Central Notifications') && o.title.length < 120, 'Use the test-only title.');
    for (const field of ['eventId', 'instanceId', 'planId']) id(o[field]);
    keys(o.timeIds, ['arrival', 'event']); Object.values(o.timeIds).forEach(id);
    if (o.arrivalOffsetMinutes !== null) offset(o.arrivalOffsetMinutes);
    window(o);
  }
  for (const field of ['eventId', 'instanceId', 'planId']) {
    const ids = s.occurrences.map(o => o[field]).filter(Boolean);
    check(new Set(ids).size === ids.length, 'A and B must have distinct parent, occurrence and plan IDs.');
  }
  const timeIds = s.occurrences.flatMap(o => Object.values(o.timeIds)).filter(Boolean);
  check(new Set(timeIds).size === timeIds.length, 'Every mapped plan time must be distinct.');
  const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  check(day(s.occurrences[0].startsAt) === day(s.occurrences[1].startsAt), 'The control must start on the same local day.');
  keys(s.reschedule, ['key', 'startsAt', 'endsAt']); window(s.reschedule);
  check(s.reschedule.key === 'A' && (instant(s.reschedule.startsAt) !== instant(s.occurrences[0].startsAt) || instant(s.reschedule.endsAt) !== instant(s.occurrences[0].endsAt)), 'Only A may be rescheduled, to a changed time.');
  return s;
}
export function planTitle(scope, key) {
  const o = scope.occurrences.find(o => o.key === key);
  check(o, 'Unknown occurrence.');
  return `${o.title} [${scope.runId}:${key}]`;
}
export function schedule(scope, occurrence, replacement = occurrence) {
  const minutes = occurrence.arrivalOffsetMinutes ?? scope.team.arrivalOffsetMinutes;
  return { startsAt: new Date(instant(replacement.startsAt)).toISOString(), endsAt: new Date(instant(replacement.endsAt)).toISOString(),
    arrivalAt: new Date(instant(replacement.startsAt) - minutes * 60000).toISOString(), arrivalOffsetMinutes: minutes };
}
export function reviewPlan(input) {
  const scope = validateScope(input);
  const blockers = [];
  if (!scope.serviceTypeId) blockers.push('Explicit Event Support service type ID required.');
  if (!scope.team.id) blockers.push('Explicit Tech team ID required.');
  for (const o of scope.occurrences) {
    for (const field of ['eventId', 'instanceId', 'planId']) if (!o[field]) blockers.push(`${o.key}: explicit ${field} required.`);
    for (const [kind, value] of Object.entries(o.timeIds)) if (!value) blockers.push(`${o.key}: explicit ${kind} time ID required.`);
  }
  return { mode: 'preview', liveWritesEnabled: false, invitationsEnabled: false, scopeHash: hash(scope), timezone: scope.timezone,
    occurrences: scope.occurrences.map(o => ({ key: o.key, title: planTitle(scope, o.key), ...schedule(scope, o), participants: o.key === 'A' ? scope.people.participants : [] })),
    reschedule: { key: 'A', ...schedule(scope, scope.occurrences[0], scope.reschedule) }, blockers,
    manualChecks: ['Internal, unpublished Calendar events without public tags or resource bookings', 'Native Tech leader and response routing verified', 'Serving reminders disabled before participants are added', 'Sound and Graphics needed positions and both time assignments verified', 'Native invitations sent only by Tyler after review', 'Old-link behavior and fresh response evidence observed during the controlled live test'] };
}
