import assert from "node:assert/strict";
import test from "node:test";
import {todayEventItems} from "../public/navlab-content.js";

const now = Date.parse("2026-09-17T14:00:00Z");

test("Today uses the public Today projection and retains every future source item", () => {
  const today = Array.from({length: 5}, (_, index) => ({
    id: String(index), title: `Today ${index}`, starts_at: "2026-09-17T18:00:00Z",
  }));
  const data = {today, events: [{title: "Tomorrow", starts_at: "2026-09-18T18:00:00Z"}]};
  const result = todayEventItems(data, now);
  assert.deepEqual(result, today);
  assert.equal(result[0], today[0]);
  assert.equal(data.events.length, 1);
});

test("Today expires at start time, including ongoing events, using timestamp offsets", () => {
  const data = {today: [
    {title: "Started", starts_at: "2026-09-17T08:30:00-05:00", ends_at: "2026-09-17T20:00:00Z"},
    {title: "Starting now", starts_at: "2026-09-17T09:00:00-05:00"},
    {title: "Later", starts_at: "2026-09-17T09:01:00-05:00"},
  ]};
  assert.deepEqual(todayEventItems(data, now).map((item) => item.title), ["Later"]);
  assert.deepEqual(todayEventItems(data, now + 60_000), []);
});

test("Today honors its module visibility and excludes inactive or untitled records", () => {
  const today = [{title: "Visible"}, {title: "Hidden", active: "FALSE"}, {title: "Off", active: false}, {}, null];
  assert.deepEqual(todayEventItems({today}, now).map((item) => item.title), ["Visible"]);
  for (const enabled of [false, "false"]) {
    assert.deepEqual(todayEventItems({today, settings: {homepage_modules: [{id: "today", enabled}]}}, now), []);
  }
  assert.deepEqual(todayEventItems({}, now), []);
});

test("Legacy Today timestamps follow the existing homepage compatibility rule", () => {
  const today = [{title: "Without timestamp", time: "6:30 PM"}, {title: "Invalid timestamp", starts_at: "bad-date"}];
  assert.deepEqual(todayEventItems({today}, now), today);
});
