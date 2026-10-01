import { daysBetween, generateSchedule } from './domain.js';

const MAIN_KINDS = new Set(['preparation', 'active', 'milestone']);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const compareGroups = (a, b) => compare(a.startDate, b.startDate)
  || compare(a.endDate, b.endDate)
  || compare(a.event.id, b.event.id)
  || compare(a.item?.id || '', b.item?.id || '');

function pack(groups) {
  const lanes = [];
  const ends = [];
  groups.sort(compareGroups);
  for (const group of groups) {
    // Dates are inclusive: ending on Tuesday still collides with a Tuesday start.
    let lane = ends.findIndex(endDate => endDate < group.startDate);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    group.lane = lane;
    lanes[lane].push(group);
    ends[lane] = group.endDate;
  }
  return lanes;
}

function envelope(items, range) {
  const startDate = items.reduce((earliest, item) => item.startDate < earliest ? item.startDate : earliest, items[0].startDate);
  const endDate = items.reduce((latest, item) => item.endDate > latest ? item.endDate : latest, items[0].endDate);
  return { startDate: startDate < range.start ? range.start : startDate, endDate: endDate > range.end ? range.end : endDate };
}

/** Pack connected event envelopes into lanes ordered by level, with rest in a separate strip.
 * Group envelopes are clipped to range. Items keep their actual schedule dates for
 * tooltips; only items intersecting the visible range are included.
 */
export function buildTimelineLayout(events, range, { level = 'all', showMeetings = false } = {}) {
  if (!range || daysBetween(range.start, range.end) < 0) throw new RangeError('Timeline range must have valid ordered dates.');
  if (!Array.isArray(events) || new Set(events.map(event => event?.id)).size !== events.length) throw new RangeError('Timeline events must have unique IDs.');
  if (!['all', 'small', 1, 2, 3, 4, 5, '1', '2', '3', '4', '5'].includes(level)) throw new RangeError('Timeline level must be all, small, or 1–5.');
  const mainGroups = [];
  const restGroups = [];
  const visible = item => item.startDate <= range.end && item.endDate >= range.start;
  for (const event of events) {
    const schedule = generateSchedule(event);
    for (const item of schedule.filter(item => item.kind === 'rest' && visible(item))) {
      restGroups.push({ id: `${event.id}:${item.id}`, event, item, items: [item], ...envelope([item], range) });
    }
    const matchesLevel = level === 'all' || (level === 'small' ? event.level >= 3 : event.level === Number(level));
    if (!matchesLevel) continue;
    const items = schedule.filter(item => visible(item) && (MAIN_KINDS.has(item.kind) || (showMeetings && item.kind === 'meeting')));
    if (items.length) mainGroups.push({ event, items, ...envelope(items, range) });
  }
  mainGroups.sort((a, b) => a.event.level - b.event.level || compareGroups(a, b));
  const lanes = [];
  for (let priority = 1; priority <= 5; priority += 1) {
    // Reuse rows within a level without placing lower-priority work above it.
    const levelLanes = pack(mainGroups.filter(group => group.event.level === priority));
    const offset = lanes.length;
    for (const lane of levelLanes) {
      for (const group of lane) group.lane += offset;
    }
    lanes.push(...levelLanes);
  }
  const restLanes = pack(restGroups);
  return { lanes, restLanes, events: mainGroups };
}
