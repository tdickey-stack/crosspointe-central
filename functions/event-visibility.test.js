import assert from "node:assert/strict";
import test from "node:test";

import {
  filterExpiredCentralEvents,
  isPlanningCenterEventUpcoming,
} from "./planning-center/event-visibility.js";

const NOW = new Date("2026-07-29T18:00:00.000Z");

test("an event stops being upcoming when its start time is reached", () => {
  assert.equal(isPlanningCenterEventUpcoming({
    starts_at: "2026-07-29T18:00:01.000Z",
  }, NOW), true);
  assert.equal(isPlanningCenterEventUpcoming({
    starts_at: "2026-07-29T18:00:00.000Z",
  }, NOW), false);
  assert.equal(isPlanningCenterEventUpcoming({
    starts_at: "2026-07-29T17:59:59.000Z",
  }, NOW), false);
});

test("source-cache timestamps and legacy events remain compatible", () => {
  assert.equal(isPlanningCenterEventUpcoming({
    _planningCenterStartsAt: "2026-07-29T18:00:01.000Z",
  }, NOW), true);
  assert.equal(isPlanningCenterEventUpcoming({
    title: "Legacy event without an ISO timestamp",
  }, NOW), true);
});

test("Central payload visibility filters Today and Featured Event", () => {
  const payload = {
    today: [
      {id: "past", starts_at: "2026-07-29T17:00:00.000Z"},
      {id: "future", starts_at: "2026-07-29T19:00:00.000Z"},
    ],
    events: [{id: "tomorrow"}],
    featuredEvent: {
      id: "featured-past",
      starts_at: "2026-07-29T17:30:00.000Z",
    },
  };

  const visible = filterExpiredCentralEvents(payload, NOW);

  assert.deepEqual(visible.today.map((event) => event.id), ["future"]);
  assert.equal(visible.featuredEvent, null);
  assert.equal(visible.events, payload.events);
  assert.equal(payload.today.length, 2);
  assert.equal(payload.featuredEvent.id, "featured-past");
});
