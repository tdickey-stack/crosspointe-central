import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, createId, dateKey, daysBetween, generateSchedule, summarizeEvent, validateEvent, validateTemplate, weeklyCongestion } from '../src/annual-planner/domain.js';
import { STARTER_TEMPLATES, createDemoEvents } from '../src/annual-planner/seed-data.js';

const phase = (id, kind, offsetDays, durationDays = 1) => ({ id, name: id, kind, offsetDays, durationDays });
function event(id = 'a', anchorDate = '2027-04-12', phases = [phase('event', 'active', 0)], options = {}) {
  const templateSnapshot = { id: 'template', name: 'Test template', description: '', version: 1, level: 1, meetingCount: 0, recoveryDays: 0, phases, ...options };
  return { id, name: `Event ${id}`, anchorDate, level: 1, templateId: 'template', templateSnapshot, overrides: {}, notes: '', status: 'tentative', excludedMeetingDates: [] };
}
const weekOf = (events, date, options) => weeklyCongestion(events, Number(date.slice(0, 4)), options).find(week => week.startDate <= date && week.endDate >= date);

test('calendar math handles leap days and DST without local-time drift', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(daysBetween('2027-03-13', '2027-03-15'), 2);
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(dateKey(new Date('2027-01-01T04:00:00Z')), '2026-12-31');
  assert.equal(dateKey('2027-01-01'), '2027-01-01');
  for (const date of ['2027-02-29', '2028-02-30', '2027-13-01', '2027-2-01', '1899-12-31', '2201-01-01']) assert.throws(() => addDays(date, 0), RangeError);
  assert.throws(() => addDays('2027-01-01', 0.5), RangeError);
});

test('meetings use eligible Tuesdays strictly before work and skip explicit exclusions', () => {
  const proposal = event('a', '2027-04-13', [phase('prep', 'preparation', 0, 7), phase('launch', 'active', 7)], { meetingCount: 3 });
  proposal.excludedMeetingDates = ['2027-04-06'];
  const meetings = generateSchedule(proposal).filter(item => item.kind === 'meeting');
  assert.deepEqual(meetings.map(item => [item.id, item.startDate]), [['meeting-1', '2027-03-16'], ['meeting-2', '2027-03-23'], ['meeting-3', '2027-03-30']]);
  assert.ok(meetings.every(item => item.startDate < '2027-04-13'));
  assert.equal(summarizeEvent(proposal).planningStartDate, '2027-03-16');
  const milestone = event('m', '2027-04-13', [phase('launch', 'milestone', 0)], { meetingCount: 1 });
  assert.equal(generateSchedule(milestone)[0].startDate, '2027-04-06');
});

test('moving an anchor preserves manual phase, meeting and recovery dates without mutating snapshots', () => {
  const proposal = event('a', '2027-04-12', [phase('prep', 'preparation', -7, 7), phase('event', 'active', 0)], { meetingCount: 2, recoveryDays: 7 });
  proposal.overrides = { prep: { startDate: '2027-04-01', endDate: '2027-04-10' }, 'meeting-1': { startDate: '2027-03-15', endDate: '2027-03-15' }, recovery: { startDate: '2027-04-20', endDate: '2027-04-22' } };
  const original = structuredClone(proposal);
  const schedule = generateSchedule({ ...proposal, anchorDate: '2027-05-12' });
  for (const [id, override] of Object.entries(proposal.overrides)) {
    const item = schedule.find(item => item.id === id);
    assert.equal(item.startDate, override.startDate);
    assert.equal(item.endDate, override.endDate);
    assert.equal(item.manuallyAdjusted, true);
  }
  assert.equal(schedule.find(item => item.id === 'event').startDate, '2027-05-12');
  assert.deepEqual(proposal, original);
  // An override moving preparation earlier also moves the automatic meeting window earlier.
  assert.equal(schedule.find(item => item.id === 'meeting-2').startDate, '2027-03-30');
});

test('existing template snapshots are independent from library updates and demo instances', () => {
  const first = createDemoEvents();
  const second = createDemoEvents();
  first[0].templateSnapshot.phases[0].durationDays = 42;
  assert.equal(second[0].templateSnapshot.phases[0].durationDays, 56);
  assert.equal(STARTER_TEMPLATES[0].phases[0].durationDays, 56);
  assert.ok(first.every(item => item.name.startsWith('Sample:') && item.status === 'tentative'));
  assert.equal(second[0].anchorDate, '2027-03-28');
  assert.equal(second[1].anchorDate, '2027-11-28');
  for (const template of STARTER_TEMPLATES) assert.deepEqual(validateTemplate(template), []);
  for (const proposal of second) assert.deepEqual(validateEvent(proposal), []);
});

test('congestion counts unique simultaneous events, excludes meetings and milestones, and supports thresholds', () => {
  const a = event('a', '2027-04-12', [phase('prep', 'preparation', 0, 3), phase('event', 'active', 0, 3)]);
  const b = event('b', '2027-04-14');
  const c = event('c', '2027-04-14');
  const milestone = event('m', '2027-04-14', [phase('launch', 'milestone', 0)]);
  assert.equal(weekOf([a], '2027-04-12').count, 1);
  const busy = weekOf([a, b, c, milestone], '2027-04-12');
  assert.equal(busy.count, 3);
  assert.equal(busy.severity, 'strong');
  assert.deepEqual(busy.eventIds, ['a', 'b', 'c']);
  assert.equal(weekOf([a, b], '2027-04-12').severity, 'light');
  assert.equal(weekOf([a, b], '2027-04-12', { lightThreshold: 3, strongThreshold: 4 }).severity, 'clear');
  const later = event('later', '2027-04-16');
  assert.equal(weekOf([a, later], '2027-04-12').count, 1);
  const meetings = event('meetings', '2027-04-20', [phase('launch', 'milestone', 0)], { meetingCount: 1 });
  assert.equal(weekOf([meetings], '2027-04-13').count, 0);
});

test('protected rest and recovery are separate exact-day conflicts and never increase congestion', () => {
  const rest = event('rest', '2027-04-12', [phase('break', 'rest', 0, 2)]);
  const sameDay = event('same-day', '2027-04-13');
  const later = event('later', '2027-04-16');
  const week = weekOf([rest, sameDay, later], '2027-04-12');
  assert.equal(week.count, 1);
  assert.equal(week.severity, 'clear');
  assert.deepEqual(week.restConflicts, [{ restEventId: 'rest', restName: 'Event rest', eventIds: ['same-day'], names: ['Event same-day'] }]);
  const recovering = event('recovering', '2027-04-12', [phase('event', 'active', 0)], { recoveryDays: 3 });
  assert.deepEqual(generateSchedule(recovering).find(item => item.id === 'recovery').startDate, '2027-04-13');
  assert.equal(weekOf([recovering, sameDay], '2027-04-12').restConflicts[0].restEventId, 'recovering');
  assert.deepEqual(weekOf([recovering, later], '2027-04-12').restConflicts, []);
});

test('only Level 1–2 add congestion; smaller events still conflict with protected rest', () => {
  const major = event('major', '2027-04-12');
  const cycle = { ...event('cycle', '2027-04-12'), level: 2 };
  const small = { ...event('small', '2027-04-12'), level: 5 };
  const rest = event('rest', '2027-04-12', [phase('break', 'rest', 0)]);
  const week = weekOf([major, cycle, small, rest], '2027-04-12');
  assert.equal(week.count, 2);
  assert.equal(week.severity, 'light');
  assert.deepEqual(week.eventIds, ['cycle', 'major']);
  assert.deepEqual(week.restConflicts[0].eventIds, ['cycle', 'major', 'small']);
  assert.equal(weekOf([small], '2027-04-12').count, 0);
});

test('peak explanation names one actual overlap, not the union of separate busy days', () => {
  const events = [event('a', '2027-04-12'), event('b', '2027-04-12'), event('c', '2027-04-15'), event('d', '2027-04-15')];
  const week = weekOf(events, '2027-04-12');
  assert.equal(week.count, 2);
  assert.equal(week.peakDate, '2027-04-12');
  assert.deepEqual(week.eventIds, ['a', 'b']);
  assert.equal(weeklyCongestion([], 2027)[0].peakDate, null);
});

test('all year weeks are present with clipped boundaries and cross-year preparation', () => {
  const nextYear = event('next-year', '2028-01-10', [phase('prep', 'preparation', -21, 21), phase('event', 'active', 0)]);
  const weeks = weeklyCongestion([nextYear], 2027);
  assert.equal(weeks[0].startDate, '2027-01-01');
  assert.equal(weeks[0].endDate, '2027-01-03');
  assert.equal(weeks.at(-1).endDate, '2027-12-31');
  assert.equal(weeks.at(-1).count, 1);
  assert.equal(weeks.reduce((sum, week) => sum + daysBetween(week.startDate, week.endDate) + 1, 0), 365);
  assert.equal(weeklyCongestion([], 2028).reduce((sum, week) => sum + daysBetween(week.startDate, week.endDate) + 1, 0), 366);
});

test('validation rejects invalid calendars, unsafe identifiers and unbounded inputs while allowing phase overlap', () => {
  const valid = event();
  assert.deepEqual(validateEvent(valid), []);
  assert.ok(validateEvent({ ...valid, anchorDate: '2027-02-29' }).length);
  assert.ok(validateEvent({ ...valid, templateId: 'different' }).length);
  assert.ok(validateEvent({ ...valid, notes: 'x'.repeat(3001) }).length);
  assert.ok(validateEvent({ ...valid, excludedMeetingDates: Array(13).fill('2027-01-01') }).length);
  assert.ok(validateEvent({ ...valid, overrides: { event: { startDate: '2027-04-02', endDate: '2027-04-01' } } }).length);
  assert.ok(validateEvent({ ...valid, overrides: { event: { startDate: '2027-01-01', endDate: '2028-01-02' } } }).length);
  for (const patch of [{ meetingCount: 9 }, { recoveryDays: 57 }, { phases: [] }, { phases: Array.from({length: 7}, (_, index) => phase(`p${index}`, 'active', 0)) }, { phases: [phase('meeting-1', 'active', 0)] }, { phases: [phase('p', 'active', 731)] }, { phases: [phase('p', 'active', 0, 367)] }, { phases: [phase('../p', 'active', 0)] }]) assert.ok(validateTemplate({ ...valid.templateSnapshot, ...patch }).length);
  assert.deepEqual(validateEvent(event('overlap', '2027-04-12', [phase('prep', 'preparation', 0, 7), phase('event', 'active', 0, 7)])), []);
  const constructorPhase = generateSchedule(event('safe', '2027-04-12', [phase('constructor', 'active', 0)]))[0];
  assert.equal(constructorPhase.startDate, '2027-04-12');
  assert.equal(constructorPhase.manuallyAdjusted, false);
  assert.throws(() => generateSchedule({ ...valid, anchorDate: 'invalid' }), RangeError);
  assert.throws(() => weeklyCongestion([valid, valid], 2027), RangeError);
  assert.match(createId('event'), /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);
});

test('v1 bounds allow six phases, eight overrides and twelve exclusions and reject one more', () => {
  const proposal = event('max', '2027-04-12', Array.from({length: 6}, (_, index) => phase(`phase-${index}`, 'active', index)));
  proposal.overrides = Object.fromEntries(Array.from({length: 8}, (_, index) => [`item-${index}`, {startDate: '2027-04-12', endDate: '2027-04-13'}]));
  proposal.excludedMeetingDates = Array.from({length: 12}, (_, index) => addDays('2027-01-01', index));
  assert.deepEqual(validateEvent(proposal), []);
  assert.ok(validateEvent({...proposal, overrides: {...proposal.overrides, extra: {startDate: '2027-04-12', endDate: '2027-04-13'}}}).some(error => error.includes('8 entries')));
  assert.ok(validateEvent({...proposal, excludedMeetingDates: [...proposal.excludedMeetingDates, '2027-02-01']}).some(error => error.includes('12 valid dates')));
  assert.ok(validateTemplate({...proposal.templateSnapshot, phases: [...proposal.templateSnapshot.phases, phase('extra', 'active', 0)]}).some(error => error.includes('1–6 phases')));
});
