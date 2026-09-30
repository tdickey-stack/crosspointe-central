// Calendar-only arithmetic uses UTC so DST cannot shorten or lengthen a day.
const DAY = 86400000;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const KINDS = new Set(['preparation', 'active', 'milestone', 'rest']);
const WORK = new Set(['preparation', 'active']);
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const validText = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2200) return NaN;
  const time = Date.UTC(year, month - 1, day);
  return new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

function requireDate(value) {
  const time = timestamp(value);
  if (!Number.isFinite(time)) throw new RangeError(`Invalid calendar date: ${String(value)}`);
  return time;
}

export function dateKey(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    requireDate(value);
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  const key = `${part('year')}-${part('month')}-${part('day')}`;
  requireDate(key);
  return key;
}

export function addDays(date, days) {
  if (!Number.isInteger(days)) throw new RangeError('Day offset must be an integer.');
  const result = new Date(requireDate(date) + days * DAY).toISOString().slice(0, 10);
  requireDate(result);
  return result;
}

export function daysBetween(start, end) {
  return (requireDate(end) - requireDate(start)) / DAY;
}

export function createId(prefix = 'event') {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(prefix)) throw new RangeError('Invalid ID prefix.');
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${suffix}`;
}

function validateExclusions(value, errors, label) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 12 || value.some(date => !Number.isFinite(timestamp(date)))) errors.push(`${label} must contain up to 12 valid dates.`);
}

export function validateTemplate(template) {
  const errors = [];
  if (!isObject(template)) return ['Template must be an object.'];
  if (typeof template.id !== 'string' || !ID.test(template.id)) errors.push('Template ID is invalid.');
  if (!validText(template.name, 140, true)) errors.push('Template name is required and must be at most 140 characters.');
  if (!validText(template.description, 3000)) errors.push('Template description must be at most 3000 characters.');
  if (!integer(template.level, 1, 5)) errors.push('Template level must be 1–5.');
  if (!integer(template.version, 1, 1000000)) errors.push('Template version must be a positive integer.');
  if (!integer(template.meetingCount, 0, 8)) errors.push('Meeting count must be 0–8.');
  if (!integer(template.recoveryDays, 0, 56)) errors.push('Recovery must be 0–56 days.');
  if (!Array.isArray(template.phases) || template.phases.length < 1 || template.phases.length > 6) {
    errors.push('A template must have 1–6 phases.');
  } else {
    const ids = new Set();
    for (const phase of template.phases) {
      if (!isObject(phase)) { errors.push('Each phase must be an object.'); continue; }
      if (typeof phase.id !== 'string' || !ID.test(phase.id) || phase.id === 'recovery' || /^meeting-/.test(phase.id) || ids.has(phase.id)) errors.push('Phase IDs must be unique and cannot use reserved meeting or recovery IDs.');
      ids.add(phase.id);
      if (!validText(phase.name, 140, true)) errors.push('Each phase needs a name of at most 140 characters.');
      if (!KINDS.has(phase.kind)) errors.push('Phase kind is invalid.');
      if (!integer(phase.offsetDays, -730, 730)) errors.push('Phase offsets must be whole days between -730 and 730.');
      if (!integer(phase.durationDays, 1, 366)) errors.push('Phase duration must be 1–366 days.');
    }
  }
  return errors;
}

export function validateEvent(event) {
  if (!isObject(event)) return ['Event must be an object.'];
  const errors = [];
  if (typeof event.id !== 'string' || !ID.test(event.id)) errors.push('Event ID is invalid.');
  if (!validText(event.name, 140, true)) errors.push('Event name is required and must be at most 140 characters.');
  if (!integer(event.level, 1, 5)) errors.push('Event level must be 1–5.');
  if (!Number.isFinite(timestamp(event.anchorDate))) errors.push('Anchor must be a valid date between 1900 and 2200.');
  if (typeof event.templateId !== 'string' || !ID.test(event.templateId)) errors.push('Template ID is invalid.');
  const templateErrors = validateTemplate(event.templateSnapshot);
  errors.push(...templateErrors);
  if (event.templateSnapshot?.id !== event.templateId) errors.push('Template snapshot must match the event template ID.');
  if (!validText(event.notes, 3000)) errors.push('Notes must be at most 3000 characters.');
  if (!['tentative', 'confirmed'].includes(event.status)) errors.push('Status must be tentative or confirmed.');
  validateExclusions(event.excludedMeetingDates, errors, 'Event meeting exclusions');
  if (!isObject(event.overrides) || Object.keys(event.overrides).length > 8) errors.push('Overrides must be an object with at most 8 entries.');
  else for (const [id, override] of Object.entries(event.overrides)) {
    if (!ID.test(id) || !isObject(override) || !Number.isFinite(timestamp(override.startDate)) || !Number.isFinite(timestamp(override.endDate)) || override.startDate > override.endDate || daysBetween(override.startDate, override.endDate) > 365) errors.push(`Override ${id} must have a valid inclusive range of 1–366 days.`);
  }
  if (!templateErrors.length && Number.isFinite(timestamp(event.anchorDate))) {
    try {
      for (const phase of event.templateSnapshot.phases) {
        addDays(event.anchorDate, phase.offsetDays);
        addDays(event.anchorDate, phase.offsetDays + phase.durationDays - 1 + event.templateSnapshot.recoveryDays);
      }
      // Allow room for all meetings and excluded dates near the supported boundary.
      buildSchedule(event);
    } catch { errors.push('Generated schedule extends beyond the supported calendar dates.'); }
  }
  return errors;
}

function buildSchedule(event) {
  const template = event.templateSnapshot;
  const decorate = item => {
    const override = event.overrides && Object.hasOwn(event.overrides, item.id) ? event.overrides[item.id] : undefined;
    return { ...item, ...(override ? { startDate: override.startDate, endDate: override.endDate } : {}), eventId: event.id, eventName: event.name, level: event.level, manuallyAdjusted: Boolean(override) };
  };
  const schedule = template.phases.map(phase => decorate({ id: phase.id, name: phase.name, kind: phase.kind, startDate: addDays(event.anchorDate, phase.offsetDays), endDate: addDays(event.anchorDate, phase.offsetDays + phase.durationDays - 1) }));
  const work = schedule.filter(item => WORK.has(item.kind));
  const meetingTargets = work.length ? work : schedule.filter(item => item.kind === 'milestone');
  if (template.meetingCount && meetingTargets.length) {
    const cutoff = meetingTargets.map(item => item.startDate).sort()[0];
    const exclusions = new Set(event.excludedMeetingDates || []);
    let candidate = addDays(cutoff, -1);
    candidate = addDays(candidate, -((new Date(requireDate(candidate)).getUTCDay() + 5) % 7));
    const dates = [];
    while (dates.length < template.meetingCount) {
      if (!exclusions.has(candidate)) dates.push(candidate);
      if (dates.length < template.meetingCount) candidate = addDays(candidate, -7);
    }
    dates.reverse().forEach((date, index) => schedule.push(decorate({ id: `meeting-${index + 1}`, name: `Planning meeting ${index + 1}`, kind: 'meeting', startDate: date, endDate: date })));
  }
  const recoveryTargets = schedule.filter(item => WORK.has(item.kind) || item.kind === 'milestone');
  if (template.recoveryDays && recoveryTargets.length) {
    const end = recoveryTargets.map(item => item.endDate).sort().at(-1);
    schedule.push(decorate({ id: 'recovery', name: 'Protected recovery', kind: 'rest', startDate: addDays(end, 1), endDate: addDays(end, template.recoveryDays) }));
  }
  return schedule.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}

export function generateSchedule(event) {
  const errors = validateEvent(event);
  if (errors.length) throw new RangeError(errors.join(' '));
  return buildSchedule(event);
}

export function summarizeEvent(event) {
  const schedule = generateSchedule(event);
  const planning = schedule.filter(item => item.kind === 'preparation' || item.kind === 'meeting');
  return { startDate: schedule[0].startDate, endDate: schedule.map(item => item.endDate).sort().at(-1), planningStartDate: planning.length ? planning[0].startDate : schedule[0].startDate };
}

/** Congestion is the daily peak of distinct Level 1–2 events doing prep/activity.
 * eventIds/names identify the first peak day; rest conflicts cover all levels.
 */
export function weeklyCongestion(events, year, { lightThreshold = 2, strongThreshold = 3 } = {}) {
  if (!integer(year, 1900, 2200)) throw new RangeError('Year must be between 1900 and 2200.');
  if (!integer(lightThreshold, 1, 1000) || !integer(strongThreshold, lightThreshold + 1, 1001)) throw new RangeError('Congestion thresholds must be positive increasing integers.');
  if (!Array.isArray(events) || new Set(events.map(event => event.id)).size !== events.length) throw new RangeError('Events must have unique IDs.');
  const schedules = events.flatMap(generateSchedule);
  const work = schedules.filter(item => WORK.has(item.kind));
  const rest = schedules.filter(item => item.kind === 'rest');
  const nameById = new Map(events.map(event => [event.id, event.name]));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const weeks = [];
  let startDate = yearStart;
  while (startDate <= yearEnd) {
    const remaining = 6 - ((new Date(requireDate(startDate)).getUTCDay() + 6) % 7);
    const endDate = new Date(Math.min(requireDate(yearEnd), requireDate(startDate) + remaining * DAY)).toISOString().slice(0, 10);
    let count = 0;
    let peakIds = new Set();
    let peakDate = null;
    const conflicts = new Map();
    for (let time = requireDate(startDate); time <= requireDate(endDate); time += DAY) {
      const date = new Date(time).toISOString().slice(0, 10);
      const overlapping = work.filter(item => item.startDate <= date && item.endDate >= date);
      const ids = new Set(overlapping.filter(item => item.level <= 2).map(item => item.eventId));
      const allLevelIds = new Set(overlapping.map(item => item.eventId));
      if (ids.size > count) { count = ids.size; peakIds = new Set(ids); peakDate = date; }
      for (const item of rest.filter(item => item.startDate <= date && item.endDate >= date)) {
        const others = [...allLevelIds].filter(id => id !== item.eventId);
        if (!others.length) continue;
        if (!conflicts.has(item.eventId)) conflicts.set(item.eventId, new Set());
        others.forEach(id => conflicts.get(item.eventId).add(id));
      }
    }
    const eventIds = [...peakIds].sort();
    weeks.push({ startDate, endDate, count, peakDate, eventIds, names: eventIds.map(id => nameById.get(id)), severity: count >= strongThreshold ? 'strong' : count >= lightThreshold ? 'light' : 'clear', restConflicts: [...conflicts].map(([restEventId, ids]) => { const eventIds = [...ids].sort(); return { restEventId, restName: nameById.get(restEventId), eventIds, names: eventIds.map(id => nameById.get(id)) }; }) });
    if (endDate === yearEnd) break;
    startDate = addDays(endDate, 1);
  }
  return weeks;
}
