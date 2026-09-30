import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {createAnnualStore, encodeAnnualEvent} from '../src/annual-planner/persistence.js';
import {createDemoEvents, STARTER_TEMPLATES} from '../src/annual-planner/seed-data.js';

let environment;
const projectId = process.env.ANNUAL_RULES_PROJECT_ID || 'crosspointe-central-annual-rules';
const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
const metadata = (uid = 'editor') => ({revision: 1, createdByUid: uid, updatedByUid: uid, createdAt: stamp(), updatedAt: stamp()});
const eventPayload = () => ({...encodeAnnualEvent(createDemoEvents()[0]), ...metadata()});
const templatePayload = () => ({...encodeAnnualEvent(createDemoEvents()[0]).templateSnapshot, ...metadata()});
const dbFor = uid => environment.authenticatedContext(uid).firestore();
const eventRef = db => {
  const ref = db.doc('centralAnnualEvents/sample-easter');
  const adjustmentRef = db.doc('centralAnnualAdjustments/sample-easter');
  return {
    async set(value) {
      const {overrides, excludedMeetingDates, ...header} = value;
      const adjustments = {eventId: value.id, overrides, excludedMeetingDates, ...Object.fromEntries(['revision', 'createdByUid', 'updatedByUid', 'createdAt', 'updatedAt'].map(key => [key, value[key]]))};
      const batch = db.batch(); batch.set(ref, header); batch.set(adjustmentRef, adjustments); return batch.commit();
    },
    async get() { const snap = await ref.get(); const adj = await adjustmentRef.get(); return {data: () => ({...snap.data(), overrides: adj.data()?.overrides, excludedMeetingDates: adj.data()?.excludedMeetingDates})}; },
    update: value => ref.update(value), delete: () => ref.delete(),
  };
};
async function seedUser(uid, permission = 'edit', active = true, key = 'planner') {
  await environment.withSecurityRulesDisabled(context => context.firestore().doc(`centralAdmin/root/users/${uid}`).set({active, pageAccess: {[key]: permission}}));
}
test.before(async () => {
  environment = await initializeTestEnvironment({projectId, firestore: {rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')}});
});
test.beforeEach(async () => {
  await environment.clearFirestore();
  await Promise.all([seedUser('editor'), seedUser('other'), seedUser('viewer', 'view'), seedUser('inactive', 'admin', false), seedUser('legacy', 'edit', true, 'studio'), seedUser('denied', 'none')]);
});
test.after(async () => environment?.cleanup());

test('maximum bounded event fits rules evaluation budget', async () => {
  const payload = eventPayload();
  payload.templateSnapshot.phases = Object.fromEntries(Array.from({length: 6}, (_, i) => [`phase-${i}`, [`Phase ${i}`, 'preparation', (i + 730) * 2196 + i]]));
  payload.templateSnapshot.meetingCount = 8;
  payload.overrides = Object.fromEntries([...Array.from({length: 6}, (_, i) => `phase-${i}`), 'meeting-1', 'recovery'].map(itemId => [itemId, (20819 + 25567) * 366]));
  payload.excludedMeetingDates = Array.from({length: 12}, (_, i) => 20819 + i);
  const db = dbFor('editor');
  await assertSucceeds(eventRef(db).set(payload));
  const previous = (await eventRef(db).get()).data();
  await assertSucceeds(eventRef(db).set({...previous, name: 'Maximum updated', revision: 2, updatedAt: stamp()}));
  const template = {...payload.templateSnapshot, ...metadata()};
  const templateRef = db.doc('centralAnnualTemplates/easter');
  await assertSucceeds(templateRef.set(template));
  await assertSucceeds(templateRef.update({version: 2, revision: 2, updatedAt: stamp()}));
});

test('shared store saves, streams, versions templates and rejects concurrent stale edits', async () => {
  const db = dbFor('editor');
  const store = createAnnualStore({firestore: db, user: {uid: 'editor'}, serverTimestamp: stamp});
  const first = await store.saveEvent(createDemoEvents()[0]);
  assert.equal(first.revision, 1);
  const outcomes = await Promise.allSettled([store.saveEvent({...first, name: 'A'}), store.saveEvent({...first, name: 'B'})]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(item => item.status === 'rejected').reason.code, 'annual/stale-revision');
  await assert.rejects(store.deleteEvent(first), {code: 'annual/stale-revision'});
  const template = await store.saveTemplate({...STARTER_TEMPLATES[0], name: 'Custom Easter'});
  assert.equal(template.version, 2);
  const settings = await store.saveSettings({lightThreshold: 2, strongThreshold: 4});
  assert.equal(settings.revision, 1);
  const workspace = await new Promise((resolve, reject) => { let stop; stop = store.subscribe(value => { stop(); resolve(value); }, reject); });
  assert.equal(workspace.source, 'cloud');
  assert.equal(workspace.templates.find(item => item.id === 'easter').version, 2);
  assert.equal(workspace.events[0].templateSnapshot.version, 1);
  assert.equal(workspace.events[0].anchorDate, createDemoEvents()[0].anchorDate);
  assert.equal(workspace.settings.strongThreshold, 4);
  await store.deleteEvent(workspace.events[0]);
});

test('anonymous, missing, inactive, denied and revoked users cannot access annual workspace', async () => {
  const blocked = [environment.unauthenticatedContext().firestore(), ...['missing', 'inactive', 'denied'].map(dbFor)];
  for (const db of blocked) {
    await assertFails(db.collection('centralAnnualEvents').get());
    await assertFails(eventRef(db).set(eventPayload()));
    await assertFails(db.collection('centralAnnualTemplates').get());
    await assertFails(db.doc('centralAnnualSettings/workspace').get());
  }
  const db = dbFor('editor');
  await assertSucceeds(eventRef(db).set(eventPayload()));
  await seedUser('editor', 'none');
  await assertFails(eventRef(db).get());
  await assertFails(eventRef(db).delete());
});

test('viewer reads shared workspace but cannot create, update or delete', async () => {
  await eventRef(dbFor('editor')).set(eventPayload());
  const db = dbFor('viewer');
  await assertSucceeds(db.collection('centralAnnualEvents').get());
  await assertSucceeds(db.collection('centralAnnualTemplates').get());
  await assertFails(db.doc('centralAnnualEvents/another').set({...eventPayload(), id: 'another', ...metadata('viewer')}));
  await assertFails(eventRef(db).update({name: 'Changed', revision: 2, updatedByUid: 'viewer', updatedAt: stamp()}));
  await assertFails(eventRef(db).delete());
  await assertFails(db.doc('centralAnnualSettings/workspace').set({lightThreshold: 2, strongThreshold: 3, ...metadata('viewer')}));
});

test('legacy ACL works; explicit none overrides inherited edit; collaborator preserves creator', async () => {
  const legacy = dbFor('legacy');
  await assertSucceeds(eventRef(legacy).set({...eventPayload(), ...metadata('legacy')}));
  const previous = (await eventRef(dbFor('other')).get()).data();
  await assertSucceeds(eventRef(dbFor('other')).set({...previous, name: 'Shared edit', revision: 2, updatedByUid: 'other', updatedAt: stamp()}));
  await assertFails(eventRef(dbFor('other')).update({createdByUid: 'other', revision: 3, updatedByUid: 'other', updatedAt: stamp()}));
  await environment.withSecurityRulesDisabled(context => context.firestore().doc('centralAdmin/root/users/legacy').update({'pageAccess.planner': 'none'}));
  await assertFails(eventRef(legacy).get());
});

test('all event create and update paths validate nested schemas and bounds', async () => {
  const db = dbFor('editor');
  const mutations = [
    value => ({...value, rogue: true}),
    value => ({...value, name: 'x'.repeat(141)}),
    value => ({...value, notes: 'x'.repeat(3001)}),
    value => ({...value, anchorDate: '2027-02-30'}),
    value => ({...value, anchorDate: new Date('2500-01-01T00:00:00Z')}),
    value => ({...value, anchorDate: new Date('2027-03-01T12:00:00Z')}),
    value => ({...value, status: 'deleted'}),
    value => ({...value, templateId: 'wrong'}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, phases: {event: ['Event', 'active', 3208356]}}}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, phases: {event: ['Event', 'active', 1603080, 'hidden']}}}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, phases: {event: ['Event', 'forged', 1603080]}}}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, phases: Object.fromEntries(Array.from({length: 7}, (_, i) => [`p${i}`, ['Phase', 'active', 1603080 + i]]))}}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, phases: {'meeting-forged': ['Phase', 'active', 1603080]}}}),
    value => ({...value, overrides: {event: -1}}),
    value => ({...value, overrides: {event: {range: 16977276, hidden: true}}}),
    value => ({...value, overrides: {event: 109937 * 366 + 1}}),
    value => ({...value, overrides: {event: 16977276.5}}),
    value => ({...value, overrides: Object.fromEntries(Array.from({length: 9}, (_, i) => [`item${i}`, 16977276]))}),
    value => ({...value, excludedMeetingDates: '2027-02-31'}),
    value => ({...value, excludedMeetingDates: [84371]}),
    value => ({...value, excludedMeetingDates: Array(13).fill(20819)}),
    value => ({...value, templateSnapshot: {...value.templateSnapshot, role: 'admin'}}),
    value => ({...value, createdByUid: 'forged'}),
    value => ({...value, updatedByUid: 'forged'}),
    value => ({...value, createdAt: new Date('2020-01-01Z')}),
    value => ({...value, updatedAt: new Date('2020-01-01Z')}),
  ];
  for (const mutate of mutations) await assertFails(eventRef(db).set(mutate(eventPayload())));
  await eventRef(db).set(eventPayload());
  const base = (await eventRef(db).get()).data();
  for (const mutate of mutations) await assertFails(eventRef(db).set(mutate({...base, revision: 2, updatedAt: stamp()})));
  await assertFails(eventRef(db).update({revision: 3, updatedAt: stamp()}));
  await assertFails(eventRef(db).update({notes: firebase.firestore.FieldValue.delete(), revision: 2, updatedAt: stamp()}));
});

test('templates require valid definitions on update and sequential revisions and versions', async () => {
  const ref = dbFor('editor').doc('centralAnnualTemplates/easter');
  await assertSucceeds(ref.set(templatePayload()));
  await assertFails(ref.update({version: 2, revision: 2, meetingCount: 9, updatedAt: stamp()}));
  await assertFails(ref.update({version: 1, revision: 2, updatedAt: stamp()}));
  await assertFails(ref.update({version: 3, revision: 2, updatedAt: stamp()}));
  await assertSucceeds(ref.update({version: 2, revision: 2, name: 'Updated', updatedAt: stamp()}));
  await assertFails(ref.delete());
});

test('settings are strictly validated on create/update and constrained to singleton', async () => {
  const db = dbFor('editor');
  const value = {lightThreshold: 2, strongThreshold: 3, ...metadata()};
  await assertFails(db.doc('centralAnnualSettings/other').set(value));
  const ref = db.doc('centralAnnualSettings/workspace');
  await assertFails(ref.set({...value, strongThreshold: 2}));
  await assertSucceeds(ref.set(value));
  await assertFails(ref.update({strongThreshold: 21, revision: 2, updatedAt: stamp()}));
  await assertFails(ref.update({createdAt: stamp(), revision: 2, updatedAt: stamp()}));
  await assertSucceeds(ref.update({strongThreshold: 4, revision: 2, updatedAt: stamp()}));
  await assertFails(ref.delete());
});


test('malformed cloud records report actionable errors instead of reaching render', async () => {
  await environment.withSecurityRulesDisabled(context => eventRef(context.firestore()).set({...eventPayload(), anchorDate: new Date('1900-01-01T00:00:00Z')}));
  const store = createAnnualStore({firestore: dbFor('editor'), user: {uid: 'editor'}, serverTimestamp: stamp});
  const failure = await new Promise((resolve, reject) => {
    let stop;
    stop = store.subscribe(() => reject(new Error('Invalid event reached workspace')), error => { stop(); resolve(error); });
  });
  assert.equal(failure.code, 'annual/invalid-record');
  assert.match(failure.message, /centralAnnualEvents\/sample-easter/);
});


test('event and adjustment documents require an atomic matching pair for edits and deletion', async () => {
  const db = dbFor('editor');
  const store = createAnnualStore({firestore: db, user: {uid: 'editor'}, serverTimestamp: stamp});
  const event = await store.saveEvent(createDemoEvents()[0]);
  const header = db.doc('centralAnnualEvents/sample-easter');
  const adjustment = db.doc('centralAnnualAdjustments/sample-easter');
  await assertFails(header.update({revision: 2, name: 'Unpaired', updatedAt: stamp()}));
  await assertFails(adjustment.update({revision: 2, excludedMeetingDates: [20819], updatedAt: stamp()}));
  await assertFails(header.delete());
  await assertFails(adjustment.delete());
  await assertSucceeds(store.deleteEvent(event));
  assert.equal((await header.get()).exists, false);
  assert.equal((await adjustment.get()).exists, false);
});


test('joined cloud validation honors manual dates before evaluating boundary meetings', async () => {
  const event = createDemoEvents()[0];
  event.anchorDate = '1900-01-20';
  event.templateSnapshot.phases = [{id: 'event', name: 'Event', kind: 'active', offsetDays: 0, durationDays: 1}];
  event.templateSnapshot.recoveryDays = 0;
  event.overrides = {event: {startDate: '1900-03-01', endDate: '1900-03-01'}};
  const store = createAnnualStore({firestore: dbFor('editor'), user: {uid: 'editor'}, serverTimestamp: stamp});
  await store.saveEvent(event);
  const workspace = await new Promise((resolve, reject) => { let stop; stop = store.subscribe(value => { stop(); resolve(value); }, reject); });
  assert.equal(workspace.events[0].overrides.event.startDate, '1900-03-01');
});
