import assert from "node:assert/strict";
import test from "node:test";

import {createPrintModePlanningCenterService} from "./planning-center.js";

test("Print Mode reads its existing shared Planning Center cache", async () => {
  const paths = [];
  const cachedValue = {
    events: {today: [{id: "event-1"}], upcoming: []},
    featuredEvent: {id: "event-1"},
  };
  const firestore = createFirestore_({
    "centralCache/planningCenter/bulletin/v1-room-hash": {
      value: cachedValue,
      fetchedAtMs: 456,
    },
  }, paths);
  const service = createService_(firestore);

  const result = await service.getCached([], {});

  assert.deepEqual(result, {
    data: cachedValue,
    status: "cached",
    fetchedAtMs: 456,
  });
  assert.deepEqual(paths, [
    "centralCache/planningCenter/bulletin/v1-room-hash",
  ]);
});

test("Print Mode falls back to the shared calendar cache", async () => {
  const paths = [];
  const calendarValue = {
    today: [{id: "featured-1"}, {id: "other"}],
    upcoming: [],
  };
  const firestore = createFirestore_({
    "centralCache/planningCenter/calendar/v3-21": {
      value: calendarValue,
      fetchedAtMs: 789,
    },
  }, paths);
  const service = createService_(firestore);

  const result = await service.getCached([], {
    featuredEvent: {id: "featured-1"},
  });

  assert.equal(result.status, "calendar-cache");
  assert.equal(result.fetchedAtMs, 789);
  assert.deepEqual(result.data.events, calendarValue);
  assert.deepEqual(result.data.featuredEvent, {id: "featured-1"});
  assert.deepEqual(paths, [
    "centralCache/planningCenter/bulletin/v1-room-hash",
    "centralCache/planningCenter/calendar/v3-21",
  ]);
});

test("Print Mode applies presentation after reading the source cache", async () => {
  const paths = [];
  const sourceValue = {
    today: [{id: "event-1", title: "Planning Center Title"}],
    upcoming: [],
  };
  const firestore = createFirestore_({
    "centralCache/planningCenter/calendar/v3-21": {
      value: sourceValue,
      fetchedAtMs: 900,
    },
  }, paths);
  const roomRules = [{id: "rule-1"}];
  const calls = [];
  const service = createService_(firestore, {
    applyCalendarPresentation: (events, currentRules, overrides) => {
      calls.push({events, currentRules, overrides});
      return {
        today: [{id: "event-1", title: "Central Title"}],
        upcoming: [],
      };
    },
  });

  const result = await service.getCached(roomRules, {});

  assert.equal(result.data.events.today[0].title, "Central Title");
  assert.deepEqual(calls, [{
    events: sourceValue,
    currentRules: roomRules,
    overrides: undefined,
  }]);
  assert.deepEqual(paths, [
    "centralCache/planningCenter/bulletin/v1-room-hash",
    "centralCache/planningCenter/calendar/v3-21",
  ]);
});

function createService_(firestore, overrides = {}) {
  return createPrintModePlanningCenterService({
    firestore,
    getCentralCalendarEvents: async () => ({
      today: [],
      upcoming: [],
    }),
    getCentralFeaturedEvent: async () => null,
    createRoomRulesComparisonHash: () => "room-hash",
    isValidCalendarEventsValue: (value) => {
      return !!value &&
        Array.isArray(value.today) &&
        Array.isArray(value.upcoming);
    },
    dateKey: () => "2026-07-24",
    timezone: "America/Chicago",
    cacheRefreshLeaseMs: 45000,
    cacheWaitMs: 50000,
    ...overrides,
  });
}

function createFirestore_(valuesByPath, requestedPaths) {
  return {
    doc: (path) => {
      requestedPaths.push(path);
      const value = valuesByPath[path];
      return {
        get: async () => ({
          exists: !!value,
          data: () => value,
        }),
      };
    },
  };
}
