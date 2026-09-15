import {Temporal} from "temporal-polyfill";

const FREQUENCIES = new Set(["weekly", "monthly", "yearly"]);
const END_TYPES = new Set(["count", "date"]);
const MONTHLY_MODES = new Set(["date", "weekday"]);
const MISSING_DATE_BEHAVIORS = new Set(["skip", "last-day"]);
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_NAMES = new Map([[1, "first"], [2, "second"], [3, "third"], [4, "fourth"], [5, "fifth"], [-1, "last"]]);

function plainDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  try {
    const date = Temporal.PlainDate.from(value);
    if (date.toString() !== value) throw new Error();
    return date;
  } catch {
    throw new Error(`${label} must be a valid calendar date.`);
  }
}

function boundedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

function uniqueIntegers(values, allowed, label) {
  if (!Array.isArray(values) || !values.length) throw new Error(`${label} must include at least one selection.`);
  const normalized = [...new Set(values.map(Number))].sort((left, right) => left - right);
  if (normalized.some((value) => !Number.isInteger(value) || !allowed.has(value))) {
    throw new Error(`${label} contains an invalid selection.`);
  }
  return normalized;
}

function optionalUniqueIntegers(values, allowed, label) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} must be a list.`);
  if (!values.length) return [];
  return uniqueIntegers(values, allowed, label);
}

function dateSelector(value, label = "Month day") {
  const number = Number(value);
  if (!Number.isInteger(number) || (number !== -1 && (number < 1 || number > 31))) {
    throw new Error(`${label} must be 1 through 31 or -1 for the last day.`);
  }
  return number;
}

export function defaultRecurrence(startDate) {
  const anchor = plainDate(startDate, "Start date");
  return {
    frequency: "monthly",
    interval: 1,
    startDate: anchor.toString(),
    endType: "count",
    count: 12,
    until: "",
    weekdays: [anchor.dayOfWeek % 7],
    monthlyMode: "date",
    monthDay: anchor.day,
    ordinals: [Math.ceil(anchor.day / 7)],
    missingDate: "skip",
  };
}

export function normalizeRecurrence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("A recurrence rule is required.");
  }
  const frequency = String(input.frequency || "");
  if (!FREQUENCIES.has(frequency)) throw new Error("Frequency must be weekly, monthly, or yearly.");
  const start = plainDate(input.startDate, "Start date");
  const interval = boundedInteger(input.interval, 1, 12, "Interval");
  const endType = String(input.endType || "");
  if (!END_TYPES.has(endType)) throw new Error("End type must be count or date.");
  const count = boundedInteger(input.count, 1, 100, "Count");
  let until = "";
  if (input.until) plainDate(input.until, "End date");
  if (endType === "date") {
    const end = plainDate(input.until, "End date");
    if (Temporal.PlainDate.compare(end, start) < 0) throw new Error("End date cannot be before the start date.");
    until = end.toString();
  }
  const missingDate = String(input.missingDate || "skip");
  if (!MISSING_DATE_BEHAVIORS.has(missingDate)) throw new Error("Missing date behavior must be skip or last-day.");
  let weekdays = optionalUniqueIntegers(input.weekdays, new Set([0, 1, 2, 3, 4, 5, 6]), "Weekdays");
  let monthlyMode = String(input.monthlyMode || "date");
  if (!MONTHLY_MODES.has(monthlyMode)) throw new Error("Monthly mode must be date or weekday.");
  let monthDay = dateSelector(input.monthDay ?? start.day);
  let ordinals = optionalUniqueIntegers(input.ordinals, new Set([1, 2, 3, 4, 5, -1]), "Ordinals");
  if (frequency === "weekly") {
    if (!weekdays.length) throw new Error("Weekdays must include at least one selection.");
  } else if (frequency === "monthly") {
    if (monthlyMode === "date") {
      monthDay = dateSelector(input.monthDay);
    } else {
      if (!weekdays.length) throw new Error("Weekdays must include at least one selection.");
      if (!ordinals.length) throw new Error("Ordinals must include at least one selection.");
    }
  } else {
    monthDay = dateSelector(input.monthDay ?? start.day);
  }
  return {
    frequency,
    interval,
    startDate: start.toString(),
    endType,
    count,
    until,
    weekdays: frequency === "weekly" || (frequency === "monthly" && monthlyMode === "weekday") ? weekdays : [],
    monthlyMode,
    monthDay,
    ordinals: frequency === "monthly" && monthlyMode === "weekday" ? ordinals : [],
    missingDate,
  };
}

function lastDayOfMonth(year, month) {
  return Temporal.PlainDate.from({year, month, day: 1}).add({months: 1}).subtract({days: 1});
}

function dayInMonth(year, month, monthDay, missingDate) {
  const last = lastDayOfMonth(year, month);
  if (monthDay === -1) return last;
  if (monthDay <= last.day) return Temporal.PlainDate.from({year, month, day: monthDay});
  return missingDate === "last-day" ? last : null;
}

function ordinalWeekdayInMonth(year, month, weekday, ordinal) {
  const first = Temporal.PlainDate.from({year, month, day: 1});
  const last = lastDayOfMonth(year, month);
  if (ordinal === -1) {
    const offset = ((last.dayOfWeek % 7) - weekday + 7) % 7;
    return last.subtract({days: offset});
  }
  const firstOffset = (weekday - (first.dayOfWeek % 7) + 7) % 7;
  const day = 1 + firstOffset + (ordinal - 1) * 7;
  return day <= last.day ? Temporal.PlainDate.from({year, month, day}) : null;
}

function occurrenceCandidates(rule, periodIndex) {
  const start = Temporal.PlainDate.from(rule.startDate);
  if (rule.frequency === "weekly") {
    const weekStart = start.subtract({days: start.dayOfWeek % 7}).add({weeks: periodIndex * rule.interval});
    return rule.weekdays.map((weekday) => weekStart.add({days: weekday}));
  }
  if (rule.frequency === "monthly") {
    const month = start.with({day: 1}).add({months: periodIndex * rule.interval});
    if (rule.monthlyMode === "date") {
      const date = dayInMonth(month.year, month.month, rule.monthDay, rule.missingDate);
      return date ? [date] : [];
    }
    return rule.weekdays.flatMap((weekday) => rule.ordinals.map((ordinal) =>
      ordinalWeekdayInMonth(month.year, month.month, weekday, ordinal),
    )).filter(Boolean);
  }
  const year = start.add({years: periodIndex * rule.interval}).year;
  const date = dayInMonth(year, start.month, rule.monthDay, rule.missingDate);
  return date ? [date] : [];
}

export function expandRecurrence(input) {
  const rule = normalizeRecurrence(input);
  const start = Temporal.PlainDate.from(rule.startDate);
  const maximum = start.add({years: 5});
  const until = rule.endType === "date" ? Temporal.PlainDate.from(rule.until) : null;
  if (until && Temporal.PlainDate.compare(until, maximum) > 0) {
    throw new Error("End date must be within five years of the start date.");
  }
  const results = new Set();
  const resultLimit = rule.endType === "count" ? rule.count : 101;
  for (let periodIndex = 0; periodIndex <= 600 && results.size < resultLimit; periodIndex += 1) {
    const candidates = occurrenceCandidates(rule, periodIndex)
      .filter((date) => Temporal.PlainDate.compare(date, start) >= 0)
      .sort(Temporal.PlainDate.compare);
    if (candidates.length && Temporal.PlainDate.compare(candidates[0], maximum) > 0) break;
    for (const date of candidates) {
      if (Temporal.PlainDate.compare(date, maximum) > 0) break;
      if (until && Temporal.PlainDate.compare(date, until) > 0) break;
      results.add(date.toString());
      if (rule.endType === "count" && results.size === rule.count) break;
    }
    if (until) {
      const nextCandidates = occurrenceCandidates(rule, periodIndex + 1);
      if (nextCandidates.length && nextCandidates.every((date) => Temporal.PlainDate.compare(date, until) > 0)) break;
    }
  }
  const dates = [...results].sort();
  if (rule.endType === "date" && dates.length > 100) {
    throw new Error("This recurrence produces more than 100 dates. Choose an earlier end date or a larger interval.");
  }
  if (rule.endType === "count" && dates.length !== rule.count) {
    throw new Error(`This recurrence cannot produce ${rule.count} actual dates within five years.`);
  }
  return dates;
}

function joinList(values) {
  if (values.length < 2) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function describeRecurrence(input) {
  const rule = normalizeRecurrence(input);
  const interval = rule.interval === 1 ? "Every" : `Every ${rule.interval}`;
  let cadence;
  if (rule.frequency === "weekly") {
    cadence = `${interval}${rule.interval === 1 ? " week" : " weeks"} on ${joinList(rule.weekdays.map((day) => WEEKDAY_NAMES[day]))}`;
  } else if (rule.frequency === "monthly" && rule.monthlyMode === "weekday") {
    cadence = `${interval}${rule.interval === 1 ? " month" : " months"} on the ${joinList(rule.ordinals.map((ordinal) => ORDINAL_NAMES.get(ordinal)))} ${joinList(rule.weekdays.map((day) => WEEKDAY_NAMES[day]))}`;
  } else if (rule.frequency === "monthly") {
    const selector = rule.monthDay === -1 ? "last day" : `day ${rule.monthDay}`;
    cadence = `${interval}${rule.interval === 1 ? " month" : " months"} on ${selector === "last day" ? "the last day" : selector}`;
  } else {
    const start = Temporal.PlainDate.from(rule.startDate);
    const selector = rule.monthDay === -1 ? "last day" : `day ${rule.monthDay}`;
    cadence = `${interval}${rule.interval === 1 ? " year" : " years"} in ${start.toLocaleString("en-US", {month: "long"})} on the ${selector}`;
  }
  const ending = rule.endType === "count" ? `for ${rule.count} occurrence${rule.count === 1 ? "" : "s"}` : `through ${rule.until}`;
  return `${cadence}, ${ending}, starting ${rule.startDate}.`;
}
