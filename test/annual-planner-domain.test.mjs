import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, createId, dateKey, daysBetween, generateSchedule, summarizeEvent, validateEvent, validateTemplate, weeklyCongestion, WORK_STAGES, DEMAND_LEVELS } from '../src/annual-planner/domain.js';
import { STARTER_TEMPLATES, createDemoEvents } from '../src/annual-planner/seed-data.js';

const phase = (id, kind, offsetDays, durationDays = 1) => ({ id, name: id, kind, offsetDays, durationDays });
const profile = (item, demand, workStage = 'implementation') => ({ ...item, workStage, demand });
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
  assert.equal(second[0].templateSnapshot.phases[0].durationDays, 14);
  assert.equal(STARTER_TEMPLATES[0].phases[0].durationDays, 14);
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

test('work profiles are optional for legacy phases and strictly validated when supplied', () => {
  assert.deepEqual(WORK_STAGES, ['ideation', 'activation', 'implementation']);
  assert.deepEqual(DEMAND_LEVELS, ['light', 'moderate', 'high']);
  const base = event().templateSnapshot;
  assert.deepEqual(validateTemplate(base), []);
  for (const workStage of WORK_STAGES) for (const demand of DEMAND_LEVELS) {
    assert.deepEqual(validateTemplate({ ...base, phases: [profile(phase('work', 'preparation', 0), demand, workStage)] }), []);
  }
  for (const item of [
    { ...phase('work', 'active', 0), workStage: 'unknown' },
    { ...phase('work', 'active', 0), demand: 'heavy' },
    { ...phase('work', 'active', 0), demand: null },
    profile(phase('rest', 'rest', 0), 'light'),
    profile(phase('launch', 'milestone', 0), 'high'),
  ]) assert.ok(validateTemplate({ ...base, phases: [item] }).length);
  const legacyWork = generateSchedule(event())[0];
  assert.equal(legacyWork.workStage, null);
  assert.equal(legacyWork.demand, null);
});

test('the pressure matrix uses distinct-event demand combinations without weights', () => {
  const cases = [
    [['light', 'light'], 'clear'],
    [['light', 'light', 'light', 'light'], 'clear'],
    [['moderate', 'light'], 'clear'],
    [['high'], 'clear'],
    [['high', 'light'], 'light'],
    [['moderate', 'moderate'], 'light'],
    [['high', 'moderate'], 'strong'],
    [['high', 'high'], 'strong'],
    [['moderate', 'moderate', 'moderate'], 'strong'],
  ];
  for (const [demands, expected] of cases) {
    const events = demands.map((demand, index) => event(`event-${index}`, '2027-04-12', [profile(phase('work', 'preparation', 0), demand)]));
    const week = weekOf(events, '2027-04-12');
    assert.equal(week.count, demands.length);
    assert.equal(week.severity, expected, demands.join(' + '));
    assert.equal(week.pressure.severity, expected);
    assert.equal(week.pressure.unclassified, false);
    assert.equal(week.pressure.eventIds.length, demands.length);
  }
});

test('critical planning and physical implementation are evaluated by demand, not stage or kind', () => {
  const criticalPlanning = event('planning', '2027-04-12', [profile(phase('decisions', 'preparation', 0), 'high', 'ideation')]);
  const execution = event('execution', '2027-04-12', [profile(phase('setup', 'active', 0), 'moderate', 'implementation')]);
  const pressure = weekOf([criticalPlanning, execution], '2027-04-12', { lightThreshold: 5, strongThreshold: 6 }).pressure;
  assert.equal(pressure.severity, 'strong');
  assert.equal(pressure.reason, 'High and moderate demand overlap');
  assert.deepEqual(pressure.phases.map(item => [item.id, item.workStage, item.demand]), [['setup', 'implementation', 'moderate'], ['decisions', 'ideation', 'high']]);
  assert.ok(pressure.phases.every(item => item.startDate === '2027-04-12' && item.endDate === '2027-04-12'));
});

test('overlapping phases within one event contribute only its highest demand', () => {
  const oneEvent = event('one', '2027-04-12', [profile(phase('planning', 'preparation', 0), 'high', 'ideation'), profile(phase('execution', 'active', 0), 'high')]);
  assert.equal(weekOf([oneEvent], '2027-04-12').severity, 'clear');
  assert.equal(weekOf([oneEvent], '2027-04-12').count, 1);
  const moderate = event('other', '2027-04-12', [profile(phase('work', 'active', 0), 'moderate')]);
  assert.equal(weekOf([oneEvent, moderate], '2027-04-12').severity, 'strong');
  oneEvent.templateSnapshot.phases.forEach(item => { item.demand = 'moderate'; });
  const light = event('light', '2027-04-12', [profile(phase('work', 'active', 0), 'light')]);
  assert.equal(weekOf([oneEvent, light], '2027-04-12').severity, 'clear');
});

test('weekly pressure preserves its own evidence when the raw count peak is a different day', () => {
  const lightEvents = ['a', 'b', 'c'].map(id => event(id, '2027-04-12', [profile(phase('planning', 'preparation', 0), 'light', 'ideation')]));
  const highEvents = ['x', 'y'].map(id => event(id, '2027-04-15', [profile(phase('delivery', 'active', 0), 'high')]));
  const events = [...lightEvents, ...highEvents];
  const week = weekOf(events, '2027-04-12');
  assert.equal(week.count, 3);
  assert.equal(week.peakDate, '2027-04-12');
  assert.deepEqual(week.eventIds, ['a', 'b', 'c']);
  assert.deepEqual(week.names, ['Event a', 'Event b', 'Event c']);
  assert.equal(week.severity, 'strong');
  assert.equal(week.pressure.date, '2027-04-15');
  assert.deepEqual(week.pressure.eventIds, ['x', 'y']);
  assert.deepEqual(week.pressure.phases.map(item => item.eventName), ['Event x', 'Event y']);
  assert.deepEqual(weekOf([...events].reverse(), '2027-04-12').pressure, week.pressure);
});

test('event-specific pressure retains a quieter overlap on another day of a busy week', () => {
  const events = [
    ...['a', 'b'].map(id => event(id, '2027-04-12', [profile(phase('work', 'active', 0), 'high')])),
    ...['c', 'd'].map(id => event(id, '2027-04-15', [profile(phase('work', 'preparation', 0), 'moderate')])),
  ];
  const week = weekOf(events, '2027-04-12');
  assert.deepEqual(week.pressure.eventIds, ['a', 'b']);
  assert.equal(week.pressure.severity, 'strong');
  assert.deepEqual(week.pressureByEvent.c.eventIds, ['c', 'd']);
  assert.equal(week.pressureByEvent.c.severity, 'light');
  assert.equal(week.pressureByEvent.c.date, '2027-04-15');
  assert.equal(week.pressureByEvent.constructor, undefined);
  assert.equal(week.pressureByEvent.absent, undefined);
});

test('unclassified phases retain legacy count signals without reducing classified pressure', () => {
  const light = ['a', 'b'].map(id => event(id, '2027-04-12', [profile(phase('work', 'preparation', 0), 'light')]));
  const unknown = event('unknown', '2027-04-12');
  const legacy = weekOf([...light, unknown], '2027-04-12').pressure;
  assert.equal(legacy.severity, 'strong');
  assert.equal(legacy.unclassified, true);
  assert.equal(legacy.reason, 'Unclassified phases use event-count signals');
  assert.equal(legacy.phases.find(item => item.eventId === 'unknown').demand, null);
  assert.equal(weekOf([...light, unknown], '2027-04-12', { lightThreshold: 4, strongThreshold: 5 }).severity, 'clear');
  const high = event('high', '2027-04-12', [profile(phase('work', 'active', 0), 'high')]);
  const moderate = event('moderate', '2027-04-12', [profile(phase('work', 'active', 0), 'moderate')]);
  const knownPressure = weekOf([high, moderate, unknown], '2027-04-12', { lightThreshold: 4, strongThreshold: 5 }).pressure;
  assert.equal(knownPressure.severity, 'strong');
  assert.equal(knownPressure.unclassified, true);
  assert.match(knownPressure.reason, /^High and moderate demand overlap/);
  const sharedId = event('mixed', '2027-04-12', [phase('unknown', 'preparation', 0), profile(phase('known', 'active', 0), 'high')]);
  assert.equal(weekOf([sharedId], '2027-04-12').count, 1);
  assert.equal(weekOf([sharedId], '2027-04-12').severity, 'clear');
});

test('legacy signal evidence uses its own date and phases rather than an earlier clear peak tie', () => {
  const light = ['a', 'b'].map(id => event(id, '2027-04-12', [profile(phase('work', 'preparation', 0), 'light')]));
  const legacy = ['c', 'd'].map(id => event(id, '2027-04-15'));
  const week = weekOf([...light, ...legacy], '2027-04-12');
  assert.equal(week.peakDate, '2027-04-12');
  assert.equal(week.pressure.date, '2027-04-15');
  assert.deepEqual(week.pressure.eventIds, ['c', 'd']);
  assert.equal(week.pressure.severity, 'light');
  assert.equal(week.pressure.unclassified, true);
});

test('profiled work retains actual-date, priority, meeting and rest boundaries', () => {
  const early = event('early', '2027-04-12', [profile(phase('high', 'active', 0), 'high')]);
  const later = event('later', '2027-04-15', [profile(phase('high', 'active', 0), 'high')]);
  assert.equal(weekOf([early, later], '2027-04-12').severity, 'clear');
  const small = { ...event('small', '2027-04-12', [profile(phase('high', 'active', 0), 'high')]), level: 5 };
  assert.equal(weekOf([early, small], '2027-04-12').severity, 'clear');
  const rest = event('rest', '2027-04-12', [phase('rest', 'rest', 0)]);
  small.templateSnapshot.phases[0].demand = 'light';
  assert.deepEqual(weekOf([rest, small], '2027-04-12').restConflicts[0].eventIds, ['small']);
  const meetings = event('meetings', '2027-04-13', [profile(phase('work', 'active', 0), 'high')], { meetingCount: 1, recoveryDays: 1 });
  assert.equal(weekOf([meetings], '2027-04-06').count, 0);
  assert.ok(generateSchedule(meetings).filter(item => item.kind === 'meeting' || item.kind === 'rest').every(item => item.demand === null && item.workStage === null));
});

test('profiling preserves manually adjusted dates and pinned legacy snapshots', () => {
  const legacy = event('legacy', '2027-04-12', [phase('preparation', 'preparation', -56, 56), phase('event', 'active', 0)], { meetingCount: 2, recoveryDays: 7 });
  legacy.overrides = { preparation: { startDate: '2027-02-01', endDate: '2027-04-08' }, 'meeting-1': { startDate: '2027-01-12', endDate: '2027-01-12' } };
  const original = structuredClone(legacy);
  const before = generateSchedule(legacy);
  const profiled = { ...legacy, templateSnapshot: { ...legacy.templateSnapshot, phases: legacy.templateSnapshot.phases.map(item => profile(item, 'high', 'ideation')) } };
  const after = generateSchedule(profiled);
  assert.deepEqual(after.map(({ id, startDate, endDate }) => ({ id, startDate, endDate })), before.map(({ id, startDate, endDate }) => ({ id, startDate, endDate })));
  assert.equal(after.find(item => item.id === 'preparation').demand, 'high');
  weeklyCongestion([legacy, { ...profiled, id: 'profiled' }], 2027);
  assert.deepEqual(legacy, original);
  assert.equal(legacy.templateSnapshot.version, 1);
  assert.equal(legacy.templateSnapshot.phases[0].durationDays, 56);
  assert.equal(generateSchedule(legacy).find(item => item.id === 'preparation').startDate, '2027-02-01');
  assert.ok(STARTER_TEMPLATES.find(item => item.id === 'easter').phases.every(item => item.id !== 'preparation'));
});

test('pressure uses manually moved work dates rather than the original anchor window', () => {
  const moved = event('moved', '2027-04-12', [profile(phase('work', 'preparation', 0), 'high', 'ideation')]);
  const other = event('other', '2027-04-15', [profile(phase('work', 'active', 0), 'moderate')]);
  assert.equal(weekOf([moved, other], '2027-04-12').severity, 'clear');
  moved.overrides.work = { startDate: '2027-04-15', endDate: '2027-04-15' };
  const week = weekOf([moved, other], '2027-04-12');
  assert.equal(week.severity, 'strong');
  assert.equal(week.pressure.date, '2027-04-15');
  assert.equal(week.pressure.phases.find(item => item.eventId === 'moved').startDate, '2027-04-15');
});

test('version-two starters model changing demand across the full eight-week lead-in', () => {
  for (const id of ['easter', 'christmas', 'camp']) {
    const template = STARTER_TEMPLATES.find(item => item.id === id);
    assert.equal(template.version, 2);
    assert.equal(template.phases.length, 5);
    assert.deepEqual(template.phases.filter(item => item.kind === 'preparation').map(item => [item.offsetDays, item.durationDays, item.workStage, item.demand]), [
      [-56, 14, 'ideation', 'light'], [-42, 14, 'activation', 'moderate'], [-28, 14, 'implementation', 'moderate'], [-14, 14, 'implementation', 'high'],
    ]);
    assert.equal(template.phases.at(-1).demand, 'high');
    assert.equal(template.phases.at(-1).offsetDays, 0);
  }
  const cycle = STARTER_TEMPLATES.find(item => item.id === 'discipleship-cycle');
  assert.equal(cycle.version, 2);
  assert.deepEqual(cycle.phases.map(item => item.id), ['recruitment', 'training', 'campaign', 'group-launch', 'starting-pointe', 'connection']);
  assert.ok(cycle.phases.filter(item => item.kind !== 'milestone').every(item => item.workStage && item.demand));
  assert.equal(cycle.phases.find(item => item.kind === 'milestone').demand, undefined);
  const rest = STARTER_TEMPLATES.find(item => item.id === 'protected-rest');
  assert.equal(rest.version, 1);
  assert.equal(rest.phases[0].workStage, undefined);
  const proposals = createDemoEvents().filter(item => ['easter', 'camp'].includes(item.templateId)).map(item => ({ ...item, anchorDate: '2027-04-26' }));
  assert.equal(weekOf(proposals, '2027-03-01').severity, 'clear');
  assert.equal(weekOf(proposals, '2027-03-15').severity, 'light');
  assert.equal(weekOf(proposals, '2027-04-12').severity, 'strong');
  assert.ok(generateSchedule(proposals[0]).filter(item => item.kind === 'meeting').every(item => item.startDate < '2027-03-01'));
});
