// Provisional planning proposals. Existing events retain their own template snapshot.
function template(id, name, level, phases, options = {}) {
  return { id, name, description: 'Editable planning proposal; confirm dates and rhythm with your ministry leaders.', level, version: 1, meetingCount: 0, recoveryDays: 0, phases, ...options };
}
const phase = (id, name, kind, offsetDays, durationDays) => ({ id, name, kind, offsetDays, durationDays });

export const STARTER_TEMPLATES = [
  template('easter', 'Easter', 1, [phase('preparation', 'Preparation', 'preparation', -56, 56), phase('event', 'Easter Weekend', 'active', 0, 1)], { meetingCount: 4, recoveryDays: 7 }),
  template('christmas', 'Christmas season', 1, [phase('preparation', 'Preparation', 'preparation', -56, 56), phase('season', 'Christmas season', 'active', 0, 28)], { meetingCount: 4, recoveryDays: 7, description: 'Proposed anchor: first Sunday of Advent. Adjust the season length and recovery to your actual Christmas schedule.' }),
  template('camp', 'Camp', 1, [phase('preparation', 'Preparation', 'preparation', -56, 56), phase('camp', 'Camp week', 'active', 0, 7)], { meetingCount: 3, recoveryDays: 7, description: 'Proposed eight-week preparation window; shorten to six weeks if appropriate. Camp dates are placeholders until confirmed.' }),
  template('discipleship-cycle', 'Discipleship cycle', 2, [phase('recruitment', 'Identify new leaders', 'preparation', 0, 14), phase('training', 'Leader training', 'preparation', 14, 14), phase('campaign', 'Six-week Foundations study', 'active', 28, 42), phase('group-launch', 'Groups launch', 'milestone', 70, 1), phase('starting-pointe', 'Starting Pointe', 'active', 84, 1), phase('connection', 'Connection Pointe', 'active', 98, 1)], { meetingCount: 2, description: 'Ten core weeks: two to identify new leaders, two for leader training, and six for the Foundations study. Groups launch next, with Starting Pointe about two weeks later and Connection Pointe about two weeks after that.' }),
  template('level-three', 'Level 3 event', 3, [phase('preparation', 'Preparation', 'preparation', -21, 21), phase('event', 'Event', 'active', 0, 1)], { meetingCount: 1, recoveryDays: 2 }),
  template('level-four', 'Level 4 event', 4, [phase('preparation', 'Preparation', 'preparation', -14, 14), phase('event', 'Event', 'active', 0, 1)]),
  template('level-five', 'Level 5 event', 5, [phase('preparation', 'Preparation', 'preparation', -7, 7), phase('event', 'Event', 'active', 0, 1)]),
  template('protected-rest', 'Protected rest', 1, [phase('rest-window', 'Protected rest', 'rest', 0, 7)], { description: 'Protect a rest window. It does not add congestion; overlapping event preparation and activity are reported separately.' }),
];

function easterSunday(year) {
  // Gregorian computus, valid throughout the domain's supported calendar range.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function firstAdvent(year) {
  const november27 = new Date(Date.UTC(year, 10, 27));
  november27.setUTCDate(27 + ((7 - november27.getUTCDay()) % 7));
  return november27.toISOString().slice(0, 10);
}

export function createDemoEvents(year = 2027) {
  if (!Number.isInteger(year) || year < 1901 || year > 2199) throw new RangeError('Demo year must be between 1901 and 2199.');
  const make = (id, templateId, name, anchorDate) => {
    const snapshot = structuredClone(STARTER_TEMPLATES.find(item => item.id === templateId));
    return { id, name: `Sample: ${name}`, level: snapshot.level, anchorDate, templateId, templateSnapshot: snapshot, overrides: {}, notes: 'Sample proposal only. Replace or confirm these dates before using a live plan.', status: 'tentative', excludedMeetingDates: [] };
  };
  return [
    make('sample-easter', 'easter', 'Easter', easterSunday(year)),
    make('sample-christmas', 'christmas', 'Christmas season', firstAdvent(year)),
    make('sample-camp', 'camp', 'Camp', `${year}-07-12`),
    make('sample-spring-cycle', 'discipleship-cycle', 'Spring discipleship cycle', `${year}-01-11`),
    make('sample-fall-cycle', 'discipleship-cycle', 'Fall discipleship cycle', `${year}-08-16`),
    make('sample-community', 'level-three', 'Community event', `${year}-05-15`),
    make('sample-gathering', 'level-four', 'Ministry gathering', `${year}-09-18`),
    make('sample-small-event', 'level-five', 'Small event', `${year}-10-09`),
    make('sample-rest', 'protected-rest', 'Summer rest window', `${year}-07-19`),
  ];
}
