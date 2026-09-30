import {DEMAND_LEVELS, WORK_STAGES, validateEvent, validateTemplate} from './domain.js';
import {STARTER_TEMPLATES} from './seed-data.js';

export const ANNUAL_COLLECTIONS = {events: 'centralAnnualEvents', templates: 'centralAnnualTemplates', settings: 'centralAnnualSettings', adjustments: 'centralAnnualAdjustments'};
export const PREVIEW_STORAGE_KEY = 'central-annual-planner-preview-v1';
const DEFAULT_SETTINGS = {lightThreshold: 2, strongThreshold: 3, revision: 0};
const clone = value => JSON.parse(JSON.stringify(value));
const iso = value => value?.toDate ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : '';
const date = value => iso(value).slice(0, 10);
const asDate = value => new Date(`${value}T00:00:00.000Z`);
const dayIndex = value => asDate(value).getTime() / 86400000;
const fromDay = value => new Date(value * 86400000).toISOString().slice(0, 10);
// Bounded wire ranges: 366 duration choices x 6 ordering slots per offset.
// Legacy tuples keep three slots. Optional profiles append stage/demand, with
// empty strings representing absence; no stage or demand is inferred on load.
const optionalProfile = phase => Object.fromEntries(['workStage', 'demand'].filter(key => phase[key] !== undefined).map(key => [key, phase[key]]));
const encodeTemplate = value => ({...value, phases: Object.fromEntries(value.phases.map((phase, index) => {
  const tuple = [phase.name, phase.kind, ((phase.offsetDays + 730) * 366 + phase.durationDays - 1) * 6 + index];
  if (phase.workStage !== undefined || phase.demand !== undefined) tuple.push(phase.workStage ?? '', phase.demand ?? '');
  return [phase.id, tuple];
}))});
function decodeTemplate(value) {
  const phases = Object.entries(value.phases).map(([id, tuple]) => {
    assertValid(Array.isArray(tuple) && (tuple.length === 3 || tuple.length === 5) ? [] : [`Phase ${id} has an invalid stored tuple.`]);
    const [name, kind, range, workStage, demand] = tuple;
    if (tuple.length === 5) {
      assertValid(['preparation', 'active'].includes(kind) && (workStage === '' || WORK_STAGES.includes(workStage)) && (demand === '' || DEMAND_LEVELS.includes(demand)) ? [] : [`Phase ${id} has an invalid stored work profile.`]);
    }
    const phase = {id, name, kind, offsetDays: Math.floor(range / 2196) - 730, durationDays: Math.floor(range / 6) % 366 + 1};
    if (workStage) phase.workStage = workStage;
    if (demand) phase.demand = demand;
    return {phase, order: range % 6};
  });
  return {...value, phases: phases.sort((a, b) => a.order - b.order).map(item => item.phase)};
}
const pick = (value, fields) => Object.fromEntries(fields.map(key => [key, value[key]]));
const templateFields = ['id', 'name', 'description', 'level', 'version', 'meetingCount', 'phases', 'recoveryDays'];
const templateDefinition = value => ({...pick(value, templateFields), phases: value.phases.map(phase => ({...pick(phase, ['id', 'name', 'kind', 'offsetDays', 'durationDays']), ...optionalProfile(phase)}))});
function assertValid(errors) {
  if (errors.length) throw Object.assign(new Error(errors.join(' ')), {code: 'annual/invalid-data'});
}
function settingsDefinition(value) {
  const {lightThreshold, strongThreshold} = value;
  assertValid(Number.isInteger(lightThreshold) && lightThreshold >= 1 && lightThreshold <= 10 && Number.isInteger(strongThreshold) && strongThreshold > lightThreshold && strongThreshold <= 20 ? [] : ['Capacity thresholds must be whole numbers: light 1–10, strong above light and no more than 20.']);
  return {lightThreshold, strongThreshold};
}
function clean(kind, value) {
  if (kind === 'templates') { assertValid(validateTemplate(value)); return templateDefinition(value); }
  if (kind === 'settings') return settingsDefinition(value);
  const event = {...value, overrides: value.overrides || {}, excludedMeetingDates: value.excludedMeetingDates || []};
  assertValid(validateEvent(event));
  return {...pick(event, ['id', 'name', 'level', 'anchorDate', 'templateId', 'notes', 'status', 'excludedMeetingDates']), templateSnapshot: templateDefinition(event.templateSnapshot), overrides: Object.fromEntries(Object.entries(event.overrides).map(([id, range]) => [id, pick(range, ['startDate', 'endDate'])]))};
}
export function encodeAnnualEvent(event) {
  const value = clean('events', event);
  return {...value, templateSnapshot: encodeTemplate(value.templateSnapshot), anchorDate: asDate(value.anchorDate), excludedMeetingDates: value.excludedMeetingDates.map(dayIndex), overrides: Object.fromEntries(Object.entries(value.overrides).map(([itemId, range]) => [itemId, (dayIndex(range.startDate) + 25567) * 366 + dayIndex(range.endDate) - dayIndex(range.startDate)]))};
}
export function decodeAnnualEvent(value) {
  return {...value, templateSnapshot: decodeTemplate(value.templateSnapshot), anchorDate: date(value.anchorDate), excludedMeetingDates: (value.excludedMeetingDates || []).map(fromDay), overrides: Object.fromEntries(Object.entries(value.overrides || {}).map(([itemId, range]) => [itemId, {startDate: fromDay(Math.floor(range / 366) - 25567), endDate: fromDay(Math.floor(range / 366) - 25567 + range % 366)}]))};
}
function normalized(kind, value) {
  const result = kind === 'events' ? decodeAnnualEvent(value) : kind === 'templates' ? decodeTemplate(value) : {...value};
  return {...result, createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt)};
}
function stale() { return Object.assign(new Error('This record changed in another window. Reload the latest version before saving.'), {code: 'annual/stale-revision'}); }
function revisionCheck(input, previous) {
  const expected = input.revision ?? 0;
  if (!Number.isInteger(expected) || expected < 0 || expected !== (previous?.revision ?? 0)) throw stale();
}
function nextValue(kind, input, previous, uid) {
  revisionCheck(input, previous);
  const value = clean(kind, input);
  if (kind === 'templates') {
    const starter = STARTER_TEMPLATES.find(item => item.id === input.id);
    value.version = previous ? previous.version + 1 : starter ? starter.version + 1 : 1;
    assertValid(validateTemplate(value));
  }
  const now = new Date().toISOString();
  return {...value, revision: (previous?.revision ?? 0) + 1, createdByUid: previous?.createdByUid || uid, updatedByUid: uid, createdAt: previous?.createdAt || now, updatedAt: now};
}
function workspace(state, source) {
  const templates = new Map(STARTER_TEMPLATES.map(item => [item.id, {...clone(item), revision: 0}]));
  for (const template of state.templates) templates.set(template.id, template);
  return {events: clone(state.events), templates: clone([...templates.values()]), settings: {...DEFAULT_SETTINGS, ...state.settings}, source};
}

export function createAnnualStore({firestore, user, preview = false, serverTimestamp = () => globalThis.window.firebase.firestore.FieldValue.serverTimestamp()}) {
  if (preview) return createPreviewStore(user?.uid || 'preview');
  if (!firestore || !user?.uid) throw new Error('Sign in to use the shared Annual Planner.');
  const uid = user.uid;
  async function save(kind, input) {
    const id = kind === 'settings' ? 'workspace' : input.id;
    clean(kind, input);
    const ref = firestore.collection(ANNUAL_COLLECTIONS[kind]).doc(id);
    return firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.exists ? normalized(kind, snapshot.data()) : null;
      const value = nextValue(kind, input, previous, uid);
      const payload = kind === 'events' ? {...encodeAnnualEvent(value), ...pick(value, ['revision', 'createdByUid', 'updatedByUid'])} : kind === 'templates' ? encodeTemplate(value) : {...value};
      payload.createdAt = snapshot.exists ? snapshot.data().createdAt : serverTimestamp();
      payload.updatedAt = serverTimestamp();
      if (kind === 'events') {
        const adjustments = {...pick(payload, ['overrides', 'excludedMeetingDates', 'revision', 'createdByUid', 'updatedByUid', 'createdAt', 'updatedAt']), eventId: id};
        delete payload.overrides;
        delete payload.excludedMeetingDates;
        transaction.set(firestore.collection(ANNUAL_COLLECTIONS.adjustments).doc(id), adjustments);
      }
      transaction.set(ref, payload);
      return value;
    }).catch(async error => {
      // A rules revision precondition may win the race before the SDK retries
      // a transaction. Translate only when a fresh authorized read proves staleness.
      if (error.code === 'permission-denied') {
        let latest;
        try { latest = await ref.get({source: 'server'}); } catch { throw error; }
        if ((latest.exists ? latest.data().revision : 0) !== (input.revision ?? 0)) throw stale();
      }
      throw error;
    });
  }
  return {
    subscribe(onWorkspace, onError = () => {}) {
      const state = {events: [], templates: [], adjustments: [], settings: {...DEFAULT_SETTINGS}};
      const ready = new Set();
      let stopped = false;
      let pairTimer;
      const report = (kind, value) => {
        if (stopped) return;
        state[kind] = value; ready.add(kind);
        if (ready.size !== 4) return;
        const events = [];
        for (const event of state.events) {
          const adjustment = state.adjustments.find(item => item.eventId === event.id);
          // The two snapshot streams can arrive in either order after an atomic write.
          if (!adjustment || adjustment.revision !== event.revision) {
            if (!pairTimer) pairTimer = setTimeout(() => {
              pairTimer = null;
              if (!stopped) onError(Object.assign(new Error(`Annual Planner record ${event.id} has incomplete shared adjustments. Reload or ask an administrator to repair the record.`), {code: 'annual/incomplete-record'}));
            }, 5000);
            return;
          }
          try {
            const joined = {...event, overrides: Object.fromEntries(Object.entries(adjustment.overrides).map(([id, range]) => [id, {startDate: fromDay(Math.floor(range / 366) - 25567), endDate: fromDay(Math.floor(range / 366) - 25567 + range % 366)}])), excludedMeetingDates: adjustment.excludedMeetingDates.map(fromDay)};
            clean('events', joined);
            events.push(joined);
          } catch (cause) { throw Object.assign(new Error(`Annual Planner record centralAnnualEvents/${event.id} is invalid: ${cause.message}`), {code: 'annual/invalid-record', cause}); }
        }
        clearTimeout(pairTimer); pairTimer = null;
        onWorkspace(workspace({...state, events}, 'cloud'));
      };
      const unsubs = Object.entries(ANNUAL_COLLECTIONS).map(([kind, collection]) => {
        const ref = kind === 'settings' ? firestore.collection(collection).doc('workspace') : firestore.collection(collection);
        return ref.onSnapshot(snapshot => {
          try {
            const load = item => {
              try {
                const value = kind === 'adjustments' ? item.data() : normalized(kind, {...item.data(), ...(kind === 'settings' ? {} : {id: item.id})});
                if (kind !== 'adjustments' && kind !== 'events') clean(kind, value);
                return value;
              } catch (cause) {
                throw Object.assign(new Error(`Annual Planner record ${collection}/${item.id} is invalid: ${cause.message}`), {code: 'annual/invalid-record', cause});
              }
            };
            report(kind, kind === 'settings' ? snapshot.exists ? load(snapshot) : {...DEFAULT_SETTINGS} : snapshot.docs.map(load));
          } catch (error) { if (!stopped) onError(error); }
        }, error => { if (!stopped) onError(error); });
      });
      return () => { stopped = true; clearTimeout(pairTimer); unsubs.forEach(unsubscribe => unsubscribe()); };
    },
    saveEvent: event => save('events', event),
    saveTemplate: template => save('templates', template),
    saveSettings: settings => save('settings', settings),
    async deleteEvent(event) {
      const ref = firestore.collection(ANNUAL_COLLECTIONS.events).doc(event.id);
      await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw stale();
        revisionCheck(event, snapshot.data());
        transaction.delete(firestore.collection(ANNUAL_COLLECTIONS.adjustments).doc(event.id));
        transaction.delete(ref);
      });
    },
  };
}

function createPreviewStore(uid) {
  const listeners = new Set();
  let memory = {events: [], templates: [], settings: {...DEFAULT_SETTINGS}};
  const storage = globalThis.localStorage;
  const read = () => {
    const stored = storage?.getItem(PREVIEW_STORAGE_KEY);
    if (!stored) return clone(memory);
    const data = JSON.parse(stored);
    if (!Array.isArray(data.events) || !Array.isArray(data.templates) || !data.settings) throw new Error('Preview data is unreadable. Clear the Annual Planner preview storage to restart.');
    data.events.forEach(event => clean('events', event));
    data.templates.forEach(template => clean('templates', template));
    clean('settings', data.settings);
    return data;
  };
  let channel;
  const emit = () => { for (const listener of listeners) { try { listener.next(workspace(read(), 'preview')); } catch (error) { listener.error(error); } } };
  const onStorage = event => { if (event.key === PREVIEW_STORAGE_KEY) emit(); };
  function connect() {
    globalThis.addEventListener?.('storage', onStorage);
    if (globalThis.window && globalThis.BroadcastChannel) { channel = new BroadcastChannel(PREVIEW_STORAGE_KEY); channel.onmessage = emit; }
  }
  function disconnect() { globalThis.removeEventListener?.('storage', onStorage); channel?.close(); channel = null; }
  const mutate = fn => {
    const write = () => { const state = read(); const result = fn(state); if (storage) storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state)); memory = state; emit(); channel?.postMessage('updated'); return clone(result); };
    return globalThis.navigator?.locks ? navigator.locks.request(PREVIEW_STORAGE_KEY, async () => write()) : Promise.resolve().then(write);
  };
  const save = (kind, input) => mutate(state => {
    const previous = kind === 'settings' ? state.settings : state[kind].find(item => item.id === input.id);
    const value = nextValue(kind, input, previous, uid);
    if (kind === 'settings') state.settings = value;
    else state[kind] = [...state[kind].filter(item => item.id !== value.id), value];
    return value;
  });
  return {
    subscribe(next, error = () => {}) { const listener = {next, error}; listeners.add(listener); if (listeners.size === 1) connect(); try { next(workspace(read(), 'preview')); } catch (failure) { error(failure); } return () => { listeners.delete(listener); if (!listeners.size) disconnect(); }; },
    saveEvent: event => save('events', event), saveTemplate: template => save('templates', template), saveSettings: settings => save('settings', settings),
    deleteEvent: event => mutate(state => { const previous = state.events.find(item => item.id === event.id); if (!previous) throw stale(); revisionCheck(event, previous); state.events = state.events.filter(item => item.id !== event.id); return true; }),
  };
}
