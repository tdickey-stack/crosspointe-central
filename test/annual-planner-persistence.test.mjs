import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnnualStore, encodeAnnualEvent, decodeAnnualEvent} from '../src/annual-planner/persistence.js';
import {createDemoEvents, STARTER_TEMPLATES} from '../src/annual-planner/seed-data.js';

test('cloud payload roundtrips date-only values across DST and leap day', () => {
  const event = {...createDemoEvents(2028)[0], anchorDate: '2028-02-29', overrides: {event: {startDate: '2028-03-12', endDate: '2028-03-13'}}, excludedMeetingDates: ['2028-02-22']};
  const payload = encodeAnnualEvent(event);
  assert.equal(payload.anchorDate.toISOString(), '2028-02-29T00:00:00.000Z');
  assert.deepEqual(decodeAnnualEvent(payload), event);
  assert.throws(() => encodeAnnualEvent({...event, anchorDate: '2027-02-29'}), /valid date/);
});

test('preview starts empty and pins template snapshots across template edits', async () => {
  const store = createAnnualStore({preview: true});
  let state;
  const unsubscribe = store.subscribe(value => { state = value; });
  assert.equal(state.source, 'preview');
  assert.deepEqual(state.events, []);
  const event = await store.saveEvent(createDemoEvents()[0]);
  const template = await store.saveTemplate({...STARTER_TEMPLATES[0], name: 'Changed Easter'});
  assert.equal(template.version, 2);
  assert.equal(template.revision, 1);
  assert.equal(state.events[0].templateSnapshot.version, 1);
  assert.equal(state.events[0].templateSnapshot.name, 'Easter');
  await assert.rejects(store.saveEvent({...event, revision: 0}), {code: 'annual/stale-revision'});
  const newer = await store.saveEvent({...event, name: 'Edited'});
  await assert.rejects(store.deleteEvent(event), {code: 'annual/stale-revision'});
  await store.deleteEvent(newer);
  assert.deepEqual(state.events, []);
  unsubscribe();
});

test('preview settings enforce useful ordered thresholds and optimistic revisions', async () => {
  const store = createAnnualStore({preview: true});
  const settings = await store.saveSettings({lightThreshold: 2, strongThreshold: 4});
  assert.equal(settings.revision, 1);
  await assert.rejects(store.saveSettings({lightThreshold: 3, strongThreshold: 5}), {code: 'annual/stale-revision'});
  await assert.rejects(store.saveSettings({...settings, strongThreshold: 2}), {code: 'annual/invalid-data'});
});

test('cloud authentication failure cannot silently open local preview', () => {
  assert.throws(() => createAnnualStore({}), /Sign in/);
});

test('two explicit preview stores share storage and reject stale changes', async () => {
  const entries = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value)}});
  try {
    const a = createAnnualStore({preview: true});
    const b = createAnnualStore({preview: true});
    const original = await a.saveEvent(createDemoEvents()[0]);
    await b.saveEvent({...original, name: 'Second window'});
    await assert.rejects(a.saveEvent({...original, name: 'Stale first window'}), {code: 'annual/stale-revision'});
    let state;
    b.subscribe(value => { state = value; })();
    assert.equal(state.events[0].name, 'Second window');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('all starter definitions and packed boundary ranges roundtrip losslessly', () => {
  for (const event of createDemoEvents()) assert.deepEqual(decodeAnnualEvent(encodeAnnualEvent(event)), event);
  const event = createDemoEvents()[0];
  event.anchorDate = '2027-06-01';
  event.templateSnapshot.meetingCount = 0;
  event.templateSnapshot.recoveryDays = 0;
  event.templateSnapshot.phases = [
    {id: 'early', name: 'Early 🎉', kind: 'preparation', offsetDays: -730, durationDays: 1},
    {id: 'late', name: 'Late', kind: 'rest', offsetDays: 730, durationDays: 366},
  ];
  event.overrides = {early: {startDate: '1900-01-01', endDate: '1900-12-31'}, late: {startDate: '2200-12-31', endDate: '2200-12-31'}};
  event.excludedMeetingDates = ['1900-01-01', '2000-02-29', '2200-12-31'];
  assert.deepEqual(decodeAnnualEvent(encodeAnnualEvent(event)), event);
});
