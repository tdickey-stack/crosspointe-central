import { jsPDF } from 'jspdf';
import { dateKey, generateSchedule, weeklyCongestion } from './domain.js';

const WORK = new Set(['preparation', 'active']);
const STAGES = { ideation: 'Ideation', activation: 'Activation', implementation: 'Implementation' };
const DEMANDS = { light: 'Light', moderate: 'Moderate', high: 'High' };
const KINDS = { preparation: 'Preparation', active: 'Active', milestone: 'Milestone', meeting: 'Planning meeting', rest: 'Protected rest' };
const compare = (a, b) => a.localeCompare(b, 'en');
const intersects = (item, range) => item.startDate <= range.end && item.endDate >= range.start;

/** Build a detached snapshot. A connected visual envelope is not scheduled work:
 * inclusion requires at least one actual generated item touching the chosen year.
 */
export function buildAnnualReport(events, year, settings = {}, generatedAt = new Date()) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new RangeError('Report year must be between 1900 and 2200.');
  const created = new Date(generatedAt);
  if (!Number.isFinite(created.getTime())) throw new RangeError('Report creation date is invalid.');
  const thresholds = { lightThreshold: settings.lightThreshold ?? 2, strongThreshold: settings.strongThreshold ?? 3 };
  const weeks = weeklyCongestion(events, year, thresholds);
  const range = { start: `${year}-01-01`, end: `${year}-12-31` };
  const included = events.map(event => {
    const schedule = generateSchedule(event).map(item => ({
      ...item,
      kindLabel: KINDS[item.kind],
      stageLabel: WORK.has(item.kind) ? STAGES[item.workStage] || 'Unclassified' : 'Not applicable',
      demandLabel: WORK.has(item.kind) ? DEMANDS[item.demand] || 'Unclassified' : 'Not applicable',
      intersectsYear: intersects(item, range),
    }));
    return {
      id: event.id, name: event.name, level: event.level, status: event.status,
      anchorDate: event.anchorDate, notes: event.notes,
      templateId: event.templateId, playbookName: event.templateSnapshot.name,
      playbookVersion: event.templateSnapshot.version,
      startDate: schedule[0].startDate,
      endDate: schedule.map(item => item.endDate).sort().at(-1),
      crossYear: schedule.some(item => item.startDate < range.start || item.endDate > range.end),
      schedule,
    };
  }).filter(event => event.schedule.some(item => item.intersectsYear))
    .sort((a, b) => compare(a.anchorDate, b.anchorDate) || compare(a.name, b.name) || compare(a.id, b.id));
  const inYearItems = included.flatMap(event => event.schedule.filter(item => item.intersectsYear));
  const report = {
    year, generatedAt: created.toISOString(), range, settings: thresholds, events: included,
    summaries: {
      eventCount: included.length,
      confirmedCount: included.filter(event => event.status === 'confirmed').length,
      tentativeCount: included.filter(event => event.status === 'tentative').length,
      levelCounts: Object.fromEntries([1, 2, 3, 4, 5].map(level => [level, included.filter(event => event.level === level).length])),
      restPeriodCount: inYearItems.filter(item => item.kind === 'rest').length,
      unclassifiedPhaseCount: inYearItems.filter(item => WORK.has(item.kind) && (!item.workStage || !item.demand)).length,
      unsupportedCharacters: [...new Set(included.flatMap(event => [event.name, event.notes, event.playbookName, ...event.schedule.map(item => item.name)])
        .flatMap(value => Array.from(normalizeTypography(value)).filter(character => character.codePointAt(0) > 255)))].sort(),
      capacityWeeks: weeks.filter(week => week.severity !== 'clear'),
      restWeeks: weeks.filter(week => week.restConflicts.length),
    },
  };
  return structuredClone(report);
}

export function annualReportFilename(report) {
  return `CENTRAL_ANNUAL_PLAN_${report.year}_${dateKey(new Date(report.generatedAt)).replaceAll('-', '')}.pdf`;
}

function calendarDate(value) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}
const dateRange = (start, end) => start === end ? calendarDate(start) : `${calendarDate(start)} - ${calendarDate(end)}`;
const statusLabel = value => value === 'confirmed' ? 'Confirmed' : 'Tentative';
const severityLabel = value => value === 'strong' ? 'Strong signal' : 'Review';
const displayName = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function normalizeTypography(value) {
  return String(value ?? '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/[\u2022\u25cf\u25aa\u25e6]/g, '-')
    .replace(/[\u2713\u2714]/g, '[check]').replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->').replace(/\u2191/g, '[up]').replace(/\u2193/g, '[down]').replace(/\u20ac/g, 'EUR')
    .replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
}

// Standard PDF fonts cover Latin text. Preserve unsupported characters visibly
// instead of emitting broken glyphs; the report snapshot retains original text.
function printable(value) {
  return Array.from(normalizeTypography(value))
    .map(character => character.codePointAt(0) <= 255 ? character : `[U+${character.codePointAt(0).toString(16).toUpperCase()}]`).join('');
}

/** Letter portrait, measured wrapping and repeated context on continued pages.
 * No event names, phase names, or notes are length-truncated.
 */
export function createAnnualReportPdf(report) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter', compress: true });
  pdf.setProperties({ title: `${report.year} Annual Plan`, subject: 'CrossPointe Central staff planning report', author: 'CrossPointe Central', creator: 'CrossPointe Central Annual Planner' });
  pdf.setCreationDate(new Date(report.generatedAt));
  const L = 44;
  const R = 568;
  const WIDTH = R - L;
  const RED = [176, 43, 34];
  const INK = [30, 34, 39];
  const MUTED = [88, 94, 102];
  const sourceNotice = printable(report.sourceNotice || report.sourceNote || '');
  const generatedLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.generatedAt));
  let context = { section: 'Year overview', event: null, number: 0 };
  let y = 68;
  let firstPage = true;
  const eventPages = new Map();
  const indexPageLabels = [];

  function font(size = 10, bold = false, color = INK) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  }
  function lines(value, width = WIDTH, size = 10, bold = false) {
    font(size, bold);
    return pdf.splitTextToSize(printable(value), width);
  }
  const noticeLines = sourceNotice ? lines(sourceNotice, WIDTH, 7.5, true) : [];
  const bottom = 738 - noticeLines.length * 9 - (noticeLines.length ? 6 : 0);
  if (bottom < 420) throw new RangeError('The source notice is too long to repeat legibly in a PDF footer.');

  function rawLines(textLines, x, top, size, lineHeight, bold = false, color = INK) {
    font(size, bold, color);
    textLines.forEach((line, index) => pdf.text(line, x, top + size + index * lineHeight));
  }
  function eventHeading(continued = false) {
    const entry = context.event;
    font(8, true, RED);
    pdf.text(`EVENT ${String(context.number).padStart(2, '0')}  /  LEVEL ${entry.level}  /  ${statusLabel(entry.status).toUpperCase()}${continued ? '  /  CONTINUED' : ''}`, L, y + 8);
    y += 20;
    const heading = lines(displayName(entry.name), WIDTH, 15, true);
    rawLines(heading, L, y, 15, 18, true);
    y += heading.length * 18 + 7;
    font(9, false, MUTED);
    pdf.text(`Anchor: ${calendarDate(entry.anchorDate)}`, L, y + 9);
    y += 23;
  }
  function newPage(continued = true) {
    if (!firstPage) pdf.addPage();
    firstPage = false;
    font(8.5, true, RED);
    pdf.text('CROSSPOINTE CENTRAL', L, 32);
    font(8.5, false, MUTED);
    pdf.text(`${report.year} ANNUAL PLAN`, R, 32, { align: 'right' });
    pdf.setDrawColor(190, 194, 199);
    pdf.setLineWidth(0.55);
    pdf.line(L, 47, R, 47);
    y = 64;
    font(8, true, MUTED);
    pdf.text(`${context.section.toUpperCase()}${continued ? ' / CONTINUED' : ''}`, L, y + 8);
    y += 25;
    if (context.event) eventHeading(continued);
  }
  function ensure(height) {
    if (y + height > bottom) newPage(true);
  }
  function paragraph(value, { size = 10, bold = false, color = INK, gap = 9, inset = 0, leading = 1.35 } = {}) {
    const wrapped = lines(value, WIDTH - inset, size, bold);
    const lineHeight = size * leading;
    for (const line of wrapped) {
      ensure(lineHeight);
      font(size, bold, color);
      pdf.text(line, L + inset, y + size);
      y += lineHeight;
    }
    y += gap;
  }
  function heading(value) {
    ensure(46);
    paragraph(value, { size: 15, bold: true, gap: 10 });
  }
  function divider() {
    ensure(15);
    pdf.setDrawColor(220, 223, 227);
    pdf.setLineWidth(0.45);
    pdf.line(L, y, R, y);
    y += 14;
  }
  function itemRow(item, alternate = false) {
    const dateLines = lines(dateRange(item.startDate, item.endDate), 124, 8.8);
    const flags = [item.manuallyAdjusted ? 'Manual dates' : '', !item.intersectsYear ? `Outside ${report.year}` : ''].filter(Boolean);
    const titleLines = lines(displayName(item.name), 368, 10, true);
    const meta = WORK.has(item.kind) ? `${item.kindLabel} | ${item.stageLabel} | ${item.demandLabel} demand` : item.kindLabel;
    const metaLines = lines(meta, 368, 8.5);
    const height = Math.max(dateLines.length * 11 + flags.length * 10, titleLines.length * 13 + metaLines.length * 11 + 4) + 18;
    ensure(height);
    if (alternate) { pdf.setFillColor(247, 248, 249); pdf.rect(L, y, WIDTH, height, 'F'); }
    rawLines(dateLines, L + 7, y + 7, 8.8, 11, false, MUTED);
    rawLines(flags, L + 7, y + 10 + dateLines.length * 11, 7.5, 10, true, RED);
    rawLines(titleLines, L + 147, y + 7, 10, 13, true);
    rawLines(metaLines, L + 147, y + 11 + titleLines.length * 13, 8.5, 11, false, MUTED);
    y += height;
    pdf.setDrawColor(224, 227, 230);
    pdf.line(L, y, R, y);
  }

  newPage(false);
  paragraph(`${report.year} Annual Plan`, { size: 27, bold: true, gap: 7, leading: 1.15 });
  paragraph('Staff planning report', { size: 12, color: MUTED, gap: 16 });
  if (sourceNotice) paragraph(sourceNotice, { size: 10, bold: true, color: RED, gap: 13 });
  paragraph(`Snapshot created ${generatedLabel} (America/Chicago).`, { size: 9, color: MUTED, gap: 15 });
  ensure(61);
  pdf.setFillColor(245, 246, 247);
  pdf.rect(L, y, WIDTH, 55, 'F');
  const metrics = [[report.events.length, 'EVENTS / REST BLOCKS'], [report.summaries.capacityWeeks.length, 'CAPACITY SIGNAL WEEKS'], [report.summaries.restWeeks.length, 'REST CONFLICT WEEKS']];
  metrics.forEach(([value, label], index) => {
    const x = L + 12 + index * WIDTH / 3;
    font(19, true); pdf.text(String(value), x, y + 25);
    font(7.4, true, MUTED); pdf.text(label, x, y + 42);
  });
  y += 69;
  paragraph(`${report.summaries.confirmedCount} confirmed | ${report.summaries.tentativeCount} tentative | ${report.summaries.restPeriodCount} protected-rest / recovery periods touch this year.`, { size: 9 });
  paragraph([1, 2, 3, 4, 5].map(level => `Level ${level}: ${report.summaries.levelCounts[level]}`).join('  |  '), { size: 9, color: MUTED });
  paragraph('Includes every priority level and status with an actual scheduled item in the selected year. Full schedules retain dates outside the year; cross-year plans are labeled. Manual dates are preserved.', { size: 9, color: MUTED, gap: 15 });
  if (report.summaries.unsupportedCharacters?.length) paragraph('Some characters are unsupported by this PDF font and appear as character codes, such as [U+4E2D]. The saved plan retains the original text.', { size: 9, color: RED, gap: 15 });
  heading('Event index');
  if (!report.events.length) paragraph(`No scheduled events, meetings, milestones, or rest periods intersect ${report.year}.`);
  for (const [index, entry] of report.events.entries()) {
    const nameLines = lines(displayName(entry.name), 340, 10, true);
    const height = Math.max(nameLines.length * 13 + 29, 48);
    ensure(height);
    font(9, true, RED); pdf.text(String(index + 1).padStart(2, '0'), L, y + 10);
    rawLines(nameLines, L + 28, y, 10, 13, true);
    font(8, false, MUTED);
    pdf.text(`Level ${entry.level} | ${statusLabel(entry.status)}${entry.crossYear ? ' | Cross-year' : ''}`, L + 28, y + nameLines.length * 13 + 13);
    font(8.5, false, MUTED);
    pdf.text(calendarDate(entry.anchorDate), R, y + 10, { align: 'right' });
    indexPageLabels.push({ id: entry.id, page: pdf.getNumberOfPages(), y: y + 26 });
    y += height;
    pdf.setDrawColor(229, 231, 234); pdf.line(L, y - 7, R, y - 7);
  }

  for (const [index, entry] of report.events.entries()) {
    context = { section: 'Event details', event: entry, number: index + 1 };
    const headerHeight = lines(displayName(entry.name), WIDTH, 15, true).length * 18 + 51;
    if (index === 0 || y + headerHeight + 125 > bottom) newPage(false);
    else { divider(); eventHeading(false); }
    eventPages.set(entry.id, pdf.getNumberOfPages());
    paragraph(`Playbook: ${entry.playbookName} | Version ${entry.playbookVersion}`, { size: 9, color: MUTED, gap: 5 });
    paragraph(`Complete schedule: ${dateRange(entry.startDate, entry.endDate)}`, { size: 9, color: MUTED, gap: 9 });
    if (entry.crossYear) paragraph(`Cross-year schedule: all dates are retained, including items outside ${report.year}.`, { size: 9, bold: true, color: RED, gap: 10 });
    ensure(25);
    paragraph('SCHEDULE', { size: 8, bold: true, color: MUTED, gap: 7 });
    entry.schedule.forEach((item, itemIndex) => itemRow(item, itemIndex % 2 === 0));
    y += 15;
    ensure(40);
    paragraph('STAFF NOTES', { size: 8, bold: true, color: MUTED, gap: 7 });
    paragraph(entry.notes || 'No staff notes recorded.', { size: 10, color: entry.notes ? INK : MUTED, gap: 20 });
  }

  context = { section: 'Capacity and protected-rest review', event: null, number: 0 };
  if (report.events.length) newPage(false);
  else { y += 10; divider(); }
  heading('Shared capacity review');
  paragraph('Signals use actual overlapping preparation and active phases from Level 1-2 events. Each event contributes its highest demand on a day. Work stages describe the work; no hours or staffing capacity are estimated.', { size: 9, color: MUTED });
  paragraph('Light + light stays clear. High + light and two moderate demands invite review. High + moderate, two high, or three moderate demands produce a strong signal.', { size: 9, color: MUTED });
  paragraph(`Unclassified demand uses event-count signals: review at ${report.settings.lightThreshold}, strong at ${report.settings.strongThreshold}. ${report.summaries.unclassifiedPhaseCount} scheduled work phases have an unclassified stage or demand in this year.`, { size: 9, color: MUTED, gap: 16 });
  if (!report.summaries.capacityWeeks.length) paragraph(`No shared-capacity pressure signals in ${report.year}.`);
  for (const week of report.summaries.capacityWeeks) {
    ensure(80);
    paragraph(`${dateRange(week.startDate, week.endDate)} | ${severityLabel(week.severity)}`, { size: 11, bold: true, color: RED, gap: 6 });
    paragraph(week.pressure.reason, { size: 10, bold: true, gap: 6 });
    paragraph(`Pressure evidence: ${calendarDate(week.pressure.date)} | ${week.pressure.eventIds.length} distinct events.`, { size: 9, gap: 8 });
    for (const item of week.pressure.phases) {
      paragraph(`${item.eventName} - ${item.name}`, { size: 9, bold: true, inset: 12, gap: 3 });
      paragraph(`${STAGES[item.workStage] || 'Unclassified'} | ${DEMANDS[item.demand] || 'Unclassified'} demand | ${dateRange(item.startDate, item.endDate)}`, { size: 8.5, color: MUTED, inset: 12, gap: 9 });
    }
    paragraph(`Raw overlap peak: ${week.count} events on ${calendarDate(week.peakDate)}. This count peak is separate from the pressure evidence above.`, { size: 8.5, color: MUTED, gap: 5 });
    paragraph(`Raw-peak events: ${week.names.join('; ')}`, { size: 8.5, color: MUTED, gap: 13 });
    divider();
  }
  heading('Protected-rest review');
  paragraph('Protected rest and recovery do not add pressure. Conflicts below identify actual overlap with preparation or active work at any priority or demand level, independently of the shared-capacity signal.', { size: 9, color: MUTED, gap: 15 });
  if (!report.summaries.restWeeks.length) paragraph(`No protected-rest conflicts in ${report.year}.`);
  for (const week of report.summaries.restWeeks) {
    ensure(55);
    paragraph(dateRange(week.startDate, week.endDate), { size: 11, bold: true, gap: 8 });
    for (const conflict of week.restConflicts) {
      paragraph(`Protected rest: ${conflict.restName}`, { size: 10, bold: true, gap: 5 });
      paragraph(`Overlapping work: ${conflict.names.join('; ')}`, { size: 9, gap: 12 });
    }
    divider();
  }

  for (const label of indexPageLabels) {
    pdf.setPage(label.page);
    font(8, false, MUTED);
    pdf.text(`Page ${eventPages.get(label.id)}`, R, label.y, { align: 'right' });
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(190, 194, 199); pdf.setLineWidth(0.5);
    pdf.line(L, bottom + 10, R, bottom + 10);
    if (noticeLines.length) rawLines(noticeLines, L, bottom + 16, 7.5, 9, true, RED);
    font(7.5, false, MUTED);
    pdf.text(`Staff planning copy | Created ${dateKey(new Date(report.generatedAt))} Central`, L, 768);
    pdf.text(`Page ${page} of ${pages}`, R, 768, { align: 'right' });
  }
  pdf.setPage(pages);
  return pdf;
}

export function downloadAnnualReportPdf(report) {
  const filename = annualReportFilename(report);
  const pdf = createAnnualReportPdf(report);
  pdf.save(filename);
  return { filename, pageCount: pdf.getNumberOfPages(), eventCount: report.events.length };
}
