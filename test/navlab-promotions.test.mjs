import assert from "node:assert/strict";
import test from "node:test";

import {
  HIGHLIGHT_TYPES,
  defaultHighlightKeys,
  highlightCandidates,
  resolveHighlightKeys,
} from "../public/navlab-promotions.js";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");

function data(overrides = {}) {
  return {
    settings: {homepage_modules: []},
    events: [],
    registrations: [],
    campaigns: [],
    serveNeeds: [],
    ...overrides,
  };
}

test("limits candidates to the four supported public types", () => {
  assert.deepEqual(Object.keys(HIGHLIGHT_TYPES), [
    "events", "registrations", "campaigns", "serveNeeds",
  ]);

  const candidates = highlightCandidates(data({
    events: [{id: "event-1", title: "Event", ends_at: "2026-09-18T12:00:00Z"}],
    registrations: [{id: "registration-1", title: "Registration"}],
    campaigns: [{id: "campaign-1", title: "Campaign"}],
    serveNeeds: [{id: "serve-1", need: "Serve"}],
    resources: [{id: "resource-1", title: "Resource"}],
    nextSteps: [{id: "next-step-1", title: "Next Step"}],
  }), NOW);

  assert.deepEqual(candidates.map(({key}) => key), [
    "events:event-1",
    "registrations:registration-1",
    "campaigns:campaign-1",
    "serveNeeds:serve-1",
  ]);
});

test("uses event occurrence identity, never its Planning Center series identity", () => {
  const candidates = highlightCandidates(data({
    events: [
      {
        id: "legacy-instance-id",
        planning_center_instance_id: "occurrence-17",
        planning_center_event_id: "series-9",
        title: "Weekly gathering",
        ends_at: "2026-09-18T12:00:00Z",
      },
    ],
  }), NOW);

  assert.equal(candidates[0].id, "occurrence-17");
  assert.equal(candidates[0].key, "events:occurrence-17");
  assert.notEqual(candidates[0].key, "events:series-9");
});

test("suppresses inactive, unpublished, and disabled-module sources", () => {
  const candidates = highlightCandidates(data({
    settings: {homepage_modules: [
      {id: "registrations", enabled: "0"},
      {id: "campaigns", enabled: false},
    ]},
    events: [
      {id: "inactive", title: "Inactive", active: "false", ends_at: "2026-09-18T12:00:00Z"},
      {id: "unpublished", title: "Unpublished", published: false, ends_at: "2026-09-18T12:00:00Z"},
      {id: "available", title: "Available", active: "TRUE", published: "true", ends_at: "2026-09-18T12:00:00Z"},
    ],
    registrations: [{id: "registration", title: "Registration"}],
    campaigns: [{id: "campaign", title: "Campaign"}],
    serveNeeds: [{id: "serve", need: "Serve", active: "0"}],
  }), NOW);

  assert.deepEqual(candidates.map(({key}) => key), ["events:available"]);
});

test("removes expired or malformed events while keeping a started event through its end", () => {
  const candidates = highlightCandidates(data({
    events: [
      {id: "expired", title: "Expired", ends_at: "2026-09-17T11:59:59Z"},
      {id: "invalid", title: "Invalid", ends_at: "not-a-date"},
      {id: "no-date", title: "No date"},
      {
        id: "still-running",
        title: "Still running",
        starts_at: "2026-09-17T09:00:00Z",
        ends_at: "2026-09-17T15:00:00Z",
      },
    ],
  }), NOW);

  assert.deepEqual(candidates.map(({key}) => key), ["events:still-running"]);
});

test("uses source fields at resolution time so source edits carry through", () => {
  const initial = highlightCandidates(data({
    campaigns: [{id: "campaign-1", title: "Original title", description: "Before"}],
  }), NOW);
  const chosen = ["campaigns:campaign-1"];
  assert.equal(resolveHighlightKeys(initial, chosen)[0].title, "Original title");

  const current = highlightCandidates(data({
    campaigns: [{id: "campaign-1", title: "Edited title", description: "After"}],
  }), NOW);
  const resolved = resolveHighlightKeys(current, chosen);
  assert.equal(resolved[0].title, "Edited title");
  assert.equal(resolved[0].item.description, "After");
});

test("defaults to a unique mixed set of no more than three highlights", () => {
  const candidates = highlightCandidates(data({
    events: [
      {id: "featured", title: "Featured", ends_at: "2026-09-18T12:00:00Z"},
      {id: "event-2", title: "Second event", ends_at: "2026-09-18T12:00:00Z"},
    ],
    registrations: [{id: "registration-1", title: "Registration"}],
    campaigns: [{id: "campaign-1", title: "Campaign"}],
    serveNeeds: [{id: "serve-1", need: "Serve"}],
  }), NOW);

  assert.deepEqual(defaultHighlightKeys(candidates, "featured"), [
    "events:event-2",
    "campaigns:campaign-1",
    "serveNeeds:serve-1",
  ]);
});

test("deduplicates public sources and ignores duplicate or removed chosen references", () => {
  const candidates = highlightCandidates(data({
    campaigns: [
      {id: "campaign-1", title: "First copy"},
      {id: "campaign-1", title: "Duplicate copy"},
    ],
    serveNeeds: [
      {id: "serve-1", need: "Serve"},
      {id: "", need: "Missing identity"},
      {id: "serve-2", need: ""},
    ],
  }), NOW);

  assert.deepEqual(candidates.map(({key, title}) => ({key, title})), [
    {key: "campaigns:campaign-1", title: "First copy"},
    {key: "serveNeeds:serve-1", title: "Serve"},
  ]);
  assert.deepEqual(
      resolveHighlightKeys(candidates, [
        "campaigns:campaign-1",
        "campaigns:campaign-1",
        "events:removed-event",
        "serveNeeds:serve-1",
      ]).map(({key}) => key),
      ["campaigns:campaign-1", "serveNeeds:serve-1"],
  );
});
