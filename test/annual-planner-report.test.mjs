import test from 'node:test';
import assert from 'node:assert/strict';
import { annualReportFilename, buildAnnualReport, createAnnualReportPdf } from '../src/annual-planner/report.js';

const created = new Date('2026-10-01T03:30:00Z');
const phase = (id = 'work', kind = 'active', offsetDays = 0, durationDays = 1, demand) => ({
  id, name: `Phase ${id}`, kind, offsetDays, durationDays,
  ...(demand ? { demand, workStage: 'implementation' } : {}),
});
function event(id, anchorDate = '2027-04-12', phases = [phase()], options = {}) {
  const { level = 1, meetingCount = 0, recoveryDays = 0, ...fields } = options;
  return {
    id, name: `Event ${id}`, level, anchorDate, templateId: 'playbook',
    templateSnapshot: { id: 'playbook', name: 'Saved playbook', description: '', level, version: 1, meetingCount, recoveryDays, phases },
    overrides: {}, notes: '', status: 'tentative', excludedMeetingDates: [], ...fields,
  };
}
const commands = pdf => pdf.internal.pages.slice(1).flat().join('\n');

test('year inclusion uses actual items, keeps complete cross-year schedules and all priorities/statuses', () => {
  const future = event('future', '2028-01-10', [phase('prep', 'preparation', -21, 21), phase()], { level: 5, status: 'confirmed' });
  const meeting = event('meeting', '2028-01-03', [phase()], { meetingCount: 1, level: 4 });
  const recovery = event('recovery', '2026-12-30', [phase()], { recoveryDays: 7, level: 3 });
  const gap = event('gap', '2027-01-01', [phase('before', 'milestone', -1), phase('after', 'milestone', 365)]);
  const report = buildAnnualReport([future, gap, meeting, recovery], 2027, {}, created);
  assert.deepEqual(report.events.map(item => item.id), ['recovery', 'meeting', 'future']);
  assert.ok(report.events.every(item => item.crossYear));
  assert.equal(report.events[1].schedule[0].kind, 'meeting');
  assert.equal(report.events[1].schedule[0].startDate, '2027-12-28');
  assert.equal(report.events[2].schedule.at(-1).startDate, '2028-01-10');
  assert.equal(report.events[2].schedule.at(-1).intersectsYear, false);
  assert.equal(report.summaries.confirmedCount, 1);
  assert.equal(report.summaries.tentativeCount, 2);
  assert.equal(report.summaries.restPeriodCount, 1);
  assert.deepEqual(report.summaries.levelCounts, { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 });
});

test('manual dates decide inclusion; legacy profiles, notes and saved playbook version survive detached snapshot', () => {
  const input = event('manual', '2028-06-01', [phase()], {
    notes: 'Keep this note.\nSecond paragraph.', status: 'confirmed',
    overrides: { work: { startDate: '2027-12-31', endDate: '2028-01-02' } },
  });
  const settings = { lightThreshold: 3, strongThreshold: 4 };
  const report = buildAnnualReport([input], 2027, settings, created);
  const entry = report.events[0];
  assert.equal(entry.anchorDate, '2028-06-01');
  assert.equal(entry.schedule[0].startDate, '2027-12-31');
  assert.equal(entry.schedule[0].manuallyAdjusted, true);
  assert.equal(entry.schedule[0].stageLabel, 'Unclassified');
  assert.equal(entry.schedule[0].demandLabel, 'Unclassified');
  assert.equal(entry.status, 'confirmed');
  assert.equal(report.summaries.unclassifiedPhaseCount, 1);
  input.notes = 'Changed later';
  input.templateSnapshot.name = 'Updated library';
  input.templateSnapshot.phases[0].name = 'Changed phase';
  input.overrides.work.startDate = '2028-01-01';
  settings.lightThreshold = 2;
  assert.equal(entry.notes, 'Keep this note.\nSecond paragraph.');
  assert.equal(entry.playbookName, 'Saved playbook');
  assert.equal(entry.playbookVersion, 1);
  assert.equal(entry.schedule[0].name, 'Phase work');
  assert.equal(entry.schedule[0].startDate, '2027-12-31');
  assert.equal(report.settings.lightThreshold, 3);
});

test('sort is anchor, name then id regardless of input order', () => {
  const a = event('a', '2027-04-12', [phase()], { name: 'Same' });
  const b = event('b', '2027-04-12', [phase()], { name: 'Same' });
  const c = event('c', '2027-04-11', [phase()], { name: 'Zebra' });
  assert.deepEqual(buildAnnualReport([b, a, c], 2027, {}, created).events.map(item => item.id), ['c', 'a', 'b']);
});

test('pressure evidence retains its own date while rest review includes localized work', () => {
  const inputs = ['a', 'b', 'c'].map(id => event(id, '2027-04-12', [phase('planning', 'preparation', 0, 1, 'light')]));
  inputs.push(...['d', 'e'].map(id => event(id, '2027-04-15', [phase('delivery', 'active', 0, 1, 'high')])));
  inputs.push(event('rest', '2027-04-16', [phase('sabbath', 'rest')]), event('local', '2027-04-16', [phase('setup', 'preparation', 0, 1, 'light')], { level: 5 }));
  const report = buildAnnualReport(inputs, 2027, {}, created);
  const week = report.summaries.capacityWeeks[0];
  assert.equal(week.count, 3);
  assert.equal(week.peakDate, '2027-04-12');
  assert.equal(week.pressure.date, '2027-04-15');
  assert.equal(week.pressure.severity, 'strong');
  assert.deepEqual(week.pressure.eventIds, ['d', 'e']);
  assert.equal(week.pressure.phases[0].name, 'Phase delivery');
  assert.deepEqual(report.summaries.restWeeks[0].restConflicts[0].eventIds, ['local']);
  const content = commands(createAnnualReportPdf(report));
  assert.match(content, /Pressure evidence: Apr 15, 2027/);
  assert.match(content, /Raw overlap peak: 3 events on Apr 12, 2027/);
  assert.match(content, /Overlapping work: Event local/);
});

test('filename follows Chicago creation date across UTC day boundaries', () => {
  assert.equal(annualReportFilename(buildAnnualReport([], 2027, {}, created)), 'CENTRAL_ANNUAL_PLAN_2027_20260930.pdf');
  assert.equal(annualReportFilename(buildAnnualReport([], 2027, {}, new Date('2026-10-01T05:00:00Z'))), 'CENTRAL_ANNUAL_PLAN_2027_20261001.pdf');
});

test('empty year produces valid letter PDF without fabricated events or warnings', () => {
  const report = buildAnnualReport([], 2027, {}, created);
  const pdf = createAnnualReportPdf(report);
  assert.equal(report.events.length, 0);
  assert.equal(pdf.internal.pageSize.getWidth(), 612);
  assert.equal(pdf.internal.pageSize.getHeight(), 792);
  assert.match(commands(pdf), /No scheduled events/);
  assert.match(commands(pdf), /No shared-capacity pressure signals in 2027/);
  assert.match(commands(pdf), /No protected-rest conflicts in 2027/);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});

test('long notes paginate without truncation and repeat event context and source notice', () => {
  const name = 'Long annual planning event '.repeat(4) + 'TITLE_END';
  const notes = `NOTES_BEGIN\n${'Distinct staff instructions for this event.\n'.repeat(60)}NOTES_END`;
  const report = buildAnnualReport([event('long', '2027-04-12', [phase()], { name, notes })], 2027, {}, created);
  report.sourceNotice = 'DEMONSTRATION DATA - local preview';
  const pdf = createAnnualReportPdf(report);
  const content = commands(pdf);
  assert.ok(pdf.getNumberOfPages() >= 4);
  assert.match(content, /NOTES_BEGIN/);
  assert.match(content, /NOTES_END/);
  assert.match(content, /TITLE_END/);
  assert.match(content, /EVENT 01.*CONTINUED/);
  assert.equal((content.match(/DEMONSTRATION DATA - local preview/g) || []).length, pdf.getNumberOfPages() + 1);
  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) assert.match(content, new RegExp(`Page ${page} of ${pdf.getNumberOfPages()}`));
});

test('newline-filled titles normalize for display; notes retain deliberate line breaks and no text leaves the page', () => {
  const work = { ...phase(), name: `Phase${'\n'.repeat(100)}PHASE_END` };
  const report = buildAnnualReport([event('lines', '2027-04-12', [work], { name: `Event${'\n'.repeat(100)}TITLE_END`, notes: 'First note line\nSecond note line' })], 2027, {}, created);
  const pdf = createAnnualReportPdf(report);
  const content = commands(pdf);
  assert.match(content, /Event TITLE_END/);
  assert.match(content, /Phase PHASE_END/);
  assert.match(content, /First note line/);
  assert.match(content, /Second note line/);
  assert.ok(report.events[0].name.includes('\n'));
  for (const match of content.matchAll(/(-?[\d.]+) (-?[\d.]+) Td/g)) {
    assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= 612, `Text x outside page: ${match[1]}`);
    assert.ok(Number(match[2]) >= 0 && Number(match[2]) <= 792, `Text y outside page: ${match[2]}`);
  }
});

test('Latin text and common symbols stay readable; unsupported actual content gets an explicit conditional warning', () => {
  const latin = buildAnnualReport([event('latin', '2027-04-12', [phase()], { name: 'Café Noël', notes: '• Welcome → next ✓ done €5 “quoted”' })], 2027, {}, created);
  assert.deepEqual(latin.summaries.unsupportedCharacters, []);
  const latinContent = commands(createAnnualReportPdf(latin));
  assert.match(latinContent, /Café Noël/);
  assert.match(latinContent, /- Welcome -> next \[check\] done EUR5 "quoted"/);
  assert.doesNotMatch(latinContent, /unsupported by this PDF font/);
  const unicode = buildAnnualReport([event('unicode', '2027-04-12', [phase()], { name: '中 gathering', notes: '中 🙂' }), event('outside', '2028-04-12', [phase()], { notes: 'Ж' })], 2027, {}, created);
  assert.deepEqual(unicode.summaries.unsupportedCharacters, ['中', '🙂']);
  const content = commands(createAnnualReportPdf(unicode));
  assert.match(content, /unsupported by this PDF font/);
  assert.match(content, /\[U\+4E2D\]/);
  assert.match(content, /\[U\+1F642\]/);
  assert.equal(unicode.events[0].notes, '中 🙂');
});

test('maximum-length character-code titles remain within printable page bounds', () => {
  const name = '中'.repeat(140);
  const source = event('wide', '2027-04-12', [{ ...phase(), name }], { name });
  source.templateSnapshot.name = name;
  const pdf = createAnnualReportPdf(buildAnnualReport([source], 2027, {}, created));
  for (const match of commands(pdf).matchAll(/(-?[\d.]+) (-?[\d.]+) Td/g)) {
    assert.ok(Number(match[1]) >= 44 && Number(match[1]) <= 568);
    assert.ok(Number(match[2]) >= 24 && Number(match[2]) <= 760);
  }
});
