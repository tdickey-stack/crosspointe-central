import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRecurrence,
  describeRecurrence,
  expandRecurrence,
  normalizeRecurrence,
} from "../src/planner/recurrence.js";

function rule(overrides = {}) {
  return {
    frequency: "monthly",
    interval: 1,
    startDate: "2026-01-15",
    endType: "count",
    count: 4,
    until: "",
    weekdays: [4],
    monthlyMode: "date",
    monthDay: 15,
    ordinals: [3],
    missingDate: "skip",
    ...overrides,
  };
}

test("monthly date recurrence counts actual dates when short months are skipped", () => {
  assert.deepEqual(expandRecurrence(rule({startDate: "2026-01-31", monthDay: 31})), [
    "2026-01-31",
    "2026-03-31",
    "2026-05-31",
    "2026-07-31",
  ]);
  assert.deepEqual(expandRecurrence(rule({startDate: "2026-01-31", monthDay: 31, missingDate: "last-day"})), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
  ]);
});

test("monthly last-day selector handles leap years", () => {
  assert.deepEqual(expandRecurrence(rule({startDate: "2027-12-31", count: 4, monthDay: -1})), [
    "2027-12-31",
    "2028-01-31",
    "2028-02-29",
    "2028-03-31",
  ]);
});

test("monthly weekday mode skips missing fifth weekdays and supports explicit last", () => {
  assert.deepEqual(expandRecurrence(rule({
    startDate: "2026-01-01",
    monthlyMode: "weekday",
    weekdays: [1],
    ordinals: [5],
    count: 3,
  })), ["2026-03-30", "2026-06-29", "2026-08-31"]);
  assert.deepEqual(expandRecurrence(rule({
    startDate: "2026-01-01",
    monthlyMode: "weekday",
    weekdays: [5],
    ordinals: [-1],
    count: 3,
  })), ["2026-01-30", "2026-02-27", "2026-03-27"]);
});

test("weekly intervals are anchored to the start week and the start date is inclusive", () => {
  assert.deepEqual(expandRecurrence(rule({
    frequency: "weekly",
    interval: 2,
    startDate: "2026-09-16",
    weekdays: [0, 3, 5],
    count: 6,
  })), [
    "2026-09-16",
    "2026-09-18",
    "2026-09-27",
    "2026-09-30",
    "2026-10-02",
    "2026-10-11",
  ]);
});

test("date endings are inclusive", () => {
  assert.deepEqual(expandRecurrence(rule({
    frequency: "weekly",
    startDate: "2026-09-16",
    weekdays: [3, 5],
    endType: "date",
    count: 100,
    until: "2026-09-25",
  })), ["2026-09-16", "2026-09-18", "2026-09-23", "2026-09-25"]);
});

test("yearly recurrence uses the start month and configured month day", () => {
  assert.deepEqual(expandRecurrence(rule({
    frequency: "yearly",
    startDate: "2027-02-01",
    monthDay: 29,
    missingDate: "skip",
    count: 1,
  })), ["2028-02-29"]);
});

test("normalization rejects malformed dates, selectors, and bounds", () => {
  assert.throws(() => normalizeRecurrence(rule({startDate: "2026-02-30"})), /valid calendar date/);
  assert.throws(() => normalizeRecurrence(rule({interval: 0})), /Interval/);
  assert.throws(() => normalizeRecurrence(rule({count: 101})), /Count/);
  assert.throws(() => normalizeRecurrence(rule({monthDay: 32})), /Month day/);
  assert.throws(() => normalizeRecurrence(rule({monthlyMode: "weekday", weekdays: [], ordinals: [1]})), /Weekdays/);
  assert.throws(() => normalizeRecurrence(rule({monthlyMode: "weekday", weekdays: [1], ordinals: [0]})), /Ordinals/);
  assert.throws(() => normalizeRecurrence(rule({endType: "date", until: "2026-01-14"})), /before/);
});

test("five-year and 100-date limits fail clearly instead of truncating", () => {
  assert.throws(() => expandRecurrence(rule({frequency: "yearly", startDate: "2026-01-15", count: 7})), /within five years/);
  assert.throws(() => expandRecurrence(rule({endType: "date", count: 100, until: "2031-01-16"})), /within five years/);
  assert.throws(() => expandRecurrence(rule({
    frequency: "weekly",
    startDate: "2026-01-04",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    endType: "date",
    count: 100,
    until: "2026-06-01",
  })), /more than 100/);
});

test("defaults and descriptions are complete and human readable", () => {
  const value = defaultRecurrence("2026-09-15");
  assert.deepEqual(value, {
    frequency: "monthly",
    interval: 1,
    startDate: "2026-09-15",
    endType: "count",
    count: 12,
    until: "",
    weekdays: [2],
    monthlyMode: "date",
    monthDay: 15,
    ordinals: [3],
    missingDate: "skip",
  });
  assert.equal(describeRecurrence(value), "Every month on day 15, for 12 occurrences, starting 2026-09-15.");
});
