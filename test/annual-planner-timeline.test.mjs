import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelineLayout } from '../src/annual-planner/timeline-layout.js';

const YEAR = { start: '2027-01-01', end: '2027-12-31' };
const phase = (id, kind, offsetDays, durationDays = 1) => ({ id, name: id, kind, offsetDays, durationDays });
function event(id, anchorDate, phases = [phase('active', 'active', 0)], options = {}) {
  return {
    id, name: id, anchorDate, level: options.level || 1, templateId: 'test', notes: '', status: 'tentative', overrides: {}, excludedMeetingDates: [],
    templateSnapshot: { id: 'test', name: 'Test', description: '', level: options.level || 1, version: 1, meetingCount: 0, recoveryDays: 0, phases, ...options },
  };
}
const laneIds = layout => layout.lanes.map(lane => lane.map(group => group.event.id));

test('sequential events reuse a shared lane rather than keeping permanent event rows', () => {
  const events = [event('later', '2027-07-01'), event('first', '2027-01-01'), event('middle', '2027-04-01')];
  const layout = buildTimelineLayout(events, YEAR);
  assert.deepEqual(laneIds(layout), [['first', 'middle', 'later']]);
  assert.deepEqual(layout.events.map(group => group.lane), [0, 0, 0]);
  assert.equal(layout.events[0], layout.lanes[0][0]);
});

test('overlapping event envelopes use separate lanes and retain connected phases through gaps', () => {
  const long = event('long', '2027-04-01', [phase('prepare', 'preparation', 0, 4), phase('launch', 'active', 20, 2)]);
  const gap = event('gap', '2027-04-10');
  const after = event('after', '2027-04-23');
  const layout = buildTimelineLayout([gap, after, long], YEAR);
  assert.deepEqual(laneIds(layout), [['long', 'after'], ['gap']]);
  assert.deepEqual(layout.events.find(group => group.event.id === 'long').items.map(item => item.id), ['prepare', 'launch']);
  assert.equal(layout.events.find(group => group.event.id === 'long').endDate, '2027-04-22');
});

test('inclusive boundaries collide, while the following day can reuse the earliest free lane', () => {
  const first = event('first', '2027-04-01', [phase('active', 'active', 0, 3)]);
  const touching = event('touching', '2027-04-03');
  const next = event('next', '2027-04-04');
  assert.deepEqual(laneIds(buildTimelineLayout([next, touching, first], YEAR)), [['first', 'next'], ['touching']]);
});

test('shuffled inputs produce identical deterministic ordering and lane assignments', () => {
  const events = [event('z', '2027-03-01'), event('a', '2027-03-01'), event('long', '2027-03-01', [phase('active', 'active', 0, 3)]), event('next', '2027-03-02')];
  const first = buildTimelineLayout(events, YEAR);
  const shuffled = buildTimelineLayout([events[2], events[0], events[3], events[1]], YEAR);
  assert.deepEqual(first, shuffled);
  assert.deepEqual(laneIds(first), [['a', 'next'], ['z'], ['long']]);
});

test('priority levels form top-to-bottom bands before chronological order', () => {
  const level1Late = event('level-1-late', '2027-11-01', undefined, { level: 1 });
  const level2Later = event('level-2-later', '2027-09-01', undefined, { level: 2 });
  const level3Early = event('level-3-early', '2027-03-01', undefined, { level: 3 });
  const level5First = event('level-5-first', '2027-01-01', undefined, { level: 5 });
  const layout = buildTimelineLayout([level5First, level3Early, level2Later, level1Late], YEAR);
  assert.deepEqual(laneIds(layout), [['level-1-late'], ['level-2-later'], ['level-3-early'], ['level-5-first']]);
  assert.deepEqual(layout.events.map(group => group.event.id), ['level-1-late', 'level-2-later', 'level-3-early', 'level-5-first']);
  assert.deepEqual(layout.events.map(group => group.lane), [0, 1, 2, 3]);
});

test('disjoint events only reuse lanes within their own priority level', () => {
  const level1Early = event('level-1-early', '2027-02-01', undefined, { level: 1 });
  const level1Late = event('level-1-late', '2027-08-01', undefined, { level: 1 });
  const level2Middle = event('level-2-middle', '2027-05-01', undefined, { level: 2 });
  const layout = buildTimelineLayout([level2Middle, level1Late, level1Early], YEAR);
  assert.deepEqual(laneIds(layout), [['level-1-early', 'level-1-late'], ['level-2-middle']]);
  assert.equal(layout.events.find(group => group.event.id === 'level-2-middle').lane, 1);
});

test('every occupied Level 1 lane precedes Level 2 and uses its absolute group lane', () => {
  const level1Long = event('level-1-long', '2027-04-01', [phase('active', 'active', 0, 5)], { level: 1 });
  const level1Overlap = event('level-1-overlap', '2027-04-02', undefined, { level: 1 });
  const level1After = event('level-1-after', '2027-04-06', undefined, { level: 1 });
  const level2Earlier = event('level-2-earlier', '2027-01-01', undefined, { level: 2 });
  const layout = buildTimelineLayout([level2Earlier, level1After, level1Overlap, level1Long], YEAR);
  assert.deepEqual(laneIds(layout), [['level-1-long', 'level-1-after'], ['level-1-overlap'], ['level-2-earlier']]);
  assert.deepEqual(layout.events.map(group => group.event.id), ['level-1-long', 'level-1-overlap', 'level-1-after', 'level-2-earlier']);
  layout.lanes.forEach((lane, laneIndex) => lane.forEach(group => assert.equal(group.lane, laneIndex)));
  assert.deepEqual(Object.fromEntries(layout.events.map(group => [group.event.id, group.lane])), {
    'level-1-long': 0,
    'level-1-overlap': 1,
    'level-1-after': 0,
    'level-2-earlier': 2,
  });
});

test('mixed-level packing is deterministic when shuffled and preserves filtered level bands', () => {
  const events = [
    event('level-4', '2027-04-01', undefined, { level: 4 }),
    event('level-3-b', '2027-03-01', undefined, { level: 3 }),
    event('level-5', '2027-01-01', undefined, { level: 5 }),
    event('level-3-a', '2027-03-01', undefined, { level: 3 }),
    event('level-2', '2027-02-01', undefined, { level: 2 }),
  ];
  const ordered = buildTimelineLayout(events, YEAR);
  const shuffled = buildTimelineLayout([events[3], events[1], events[4], events[0], events[2]], YEAR);
  assert.deepEqual(ordered, shuffled);
  assert.deepEqual(laneIds(ordered), [['level-2'], ['level-3-a'], ['level-3-b'], ['level-4'], ['level-5']]);
  assert.deepEqual(laneIds(buildTimelineLayout(events, YEAR, { level: 'small' })), [['level-3-a'], ['level-3-b'], ['level-4'], ['level-5']]);
  assert.deepEqual(laneIds(buildTimelineLayout(events, YEAR, { level: '3' })), [['level-3-a'], ['level-3-b']]);
});

test('cross-year and quarter envelopes clip to visible items while retaining actual item dates', () => {
  const acrossYear = event('year', '2027-01-05', [phase('prepare', 'preparation', -10, 10), phase('active', 'active', 0)]);
  const group = buildTimelineLayout([acrossYear], YEAR).events[0];
  assert.equal(group.startDate, '2027-01-01');
  assert.equal(group.items[0].startDate, '2026-12-26');
  const quarter = { start: '2027-04-01', end: '2027-06-30' };
  const crossing = event('quarter', '2027-06-28', [phase('old', 'preparation', -100, 2), phase('active', 'active', 0, 10)]);
  const clipped = buildTimelineLayout([crossing], quarter).events[0];
  assert.equal(clipped.startDate, '2027-06-28');
  assert.equal(clipped.endDate, '2027-06-30');
  assert.deepEqual(clipped.items.map(item => item.id), ['active']);
  assert.equal(clipped.items[0].endDate, '2027-07-07');
  assert.equal(buildTimelineLayout([event('absent', '2027-07-01')], quarter).events.length, 0);
});

test('meetings expand the envelope only when enabled and can be the sole visible item', () => {
  const proposal = event('meetings', '2027-04-14', [phase('prep', 'preparation', 0, 2)], { meetingCount: 2 });
  assert.equal(buildTimelineLayout([proposal], YEAR).events[0].startDate, '2027-04-14');
  const shown = buildTimelineLayout([proposal], YEAR, { showMeetings: true }).events[0];
  assert.equal(shown.startDate, '2027-04-06');
  assert.deepEqual(shown.items.map(item => item.kind), ['meeting', 'meeting', 'preparation']);
  const meetingWindow = { start: '2027-04-06', end: '2027-04-06' };
  assert.deepEqual(buildTimelineLayout([proposal], meetingWindow).lanes, []);
  assert.deepEqual(buildTimelineLayout([proposal], meetingWindow, { showMeetings: true }).events[0].items.map(item => item.id), ['meeting-1']);
});

test('milestone-only events remain visible and pack like inclusive single-day events', () => {
  const milestone = event('milestone', '2027-04-14', [phase('launch', 'milestone', 0)]);
  const sameDay = event('other', '2027-04-14');
  const layout = buildTimelineLayout([milestone, sameDay], YEAR);
  assert.equal(layout.events[0].items[0].kind, 'milestone');
  assert.equal(layout.lanes.length, 2);
});

test('manual phase and meeting dates determine the visible envelope and collisions', () => {
  const proposal = event('manual', '2027-04-14', [phase('active', 'active', 0)], { meetingCount: 1 });
  proposal.overrides = { active: { startDate: '2027-05-01', endDate: '2027-05-03' }, 'meeting-1': { startDate: '2027-03-02', endDate: '2027-03-02' } };
  const other = event('other', '2027-05-02');
  const hidden = buildTimelineLayout([proposal, other], YEAR);
  assert.equal(hidden.events[0].startDate, '2027-05-01');
  assert.equal(hidden.events[0].items[0].manuallyAdjusted, true);
  assert.equal(hidden.lanes.length, 2);
  assert.equal(buildTimelineLayout([proposal], YEAR, { showMeetings: true }).events[0].startDate, '2027-03-02');
});

test('rest packs independently by schedule item and remains visible across priority filters', () => {
  const major = event('major', '2027-04-01', [phase('active', 'active', 0), phase('rest-a', 'rest', 1, 2), phase('rest-b', 'rest', 5, 2)]);
  const minor = event('minor', '2027-04-01', [phase('active', 'active', 0)], { level: 5, recoveryDays: 3 });
  const restOnly = event('rest-only', '2027-04-10', [phase('break', 'rest', 0, 2)], { level: 3 });
  const layout = buildTimelineLayout([minor, restOnly, major], YEAR, { level: 'small' });
  assert.deepEqual(layout.events.map(group => group.event.id), ['minor']);
  assert.equal(layout.lanes.length, 1);
  assert.deepEqual(layout.restLanes.map(lane => lane.map(group => group.id)), [['major:rest-a', 'major:rest-b', 'rest-only:break'], ['minor:recovery']]);
  assert.ok(layout.restLanes.flat().every(group => group.items.length === 1 && group.item === group.items[0]));
  assert.deepEqual(buildTimelineLayout([minor, restOnly, major], YEAR, { level: '1' }).events.map(group => group.event.id), ['major']);
  assert.deepEqual(buildTimelineLayout([minor, restOnly, major], YEAR, { level: 5 }).restLanes, layout.restLanes);
});

test('rest groups clip at view boundaries and packing is deterministic when shuffled', () => {
  const a = event('a', '2027-03-30', [phase('rest', 'rest', 0, 5)]);
  const b = event('b', '2027-04-03', [phase('rest', 'rest', 0, 5)]);
  const range = { start: '2027-04-01', end: '2027-04-06' };
  const layout = buildTimelineLayout([b, a], range);
  assert.deepEqual(layout, buildTimelineLayout([a, b], range));
  assert.equal(layout.restLanes[0][0].startDate, range.start);
  assert.equal(layout.restLanes[1][0].endDate, range.end);
  assert.equal(layout.restLanes[0][0].item.startDate, '2027-03-30');
  assert.deepEqual(layout.lanes, []);
});

test('layout leaves inputs unchanged and retains each original event reference', () => {
  const events = [event('b', '2027-06-01'), event('a', '2027-05-01', [phase('active', 'active', 0)], { recoveryDays: 2 })];
  const before = structuredClone(events);
  const range = Object.freeze({ ...YEAR });
  function freeze(value) { Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); }); return Object.freeze(value); }
  freeze(events);
  const layout = buildTimelineLayout(events, range);
  assert.deepEqual(events, before);
  assert.equal(layout.events[0].event, events[1]);
  assert.equal(layout.restLanes[0][0].event, events[1]);
});

test('invalid date ranges, levels and duplicate identities are rejected', () => {
  assert.throws(() => buildTimelineLayout([], { start: '2027-04-02', end: '2027-04-01' }), RangeError);
  assert.throws(() => buildTimelineLayout([], { start: '2027-02-29', end: '2027-04-01' }), RangeError);
  assert.throws(() => buildTimelineLayout([], YEAR, { level: 'unknown' }), RangeError);
  const proposal = event('a', '2027-04-01');
  assert.throws(() => buildTimelineLayout([proposal, proposal], YEAR), RangeError);
  assert.deepEqual(buildTimelineLayout([], YEAR), { lanes: [], restLanes: [], events: [] });
});
