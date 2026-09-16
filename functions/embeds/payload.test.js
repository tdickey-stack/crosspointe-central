import assert from "node:assert/strict";
import test from "node:test";

import {
  CENTRAL_EMBED_LAYOUT_COMPACT,
  CENTRAL_EMBED_TYPE_EVENTS,
  CENTRAL_EMBED_TYPE_GROUPS,
  createCentralEmbedDefaultDraft,
  flattenCentralEmbedSourceEvents,
  normalizeCentralEmbedDraft,
  normalizeCentralEmbedId,
  normalizeCentralEmbedTheme,
  normalizeCentralEmbedType,
  serializeCentralEmbedAdminRecord,
} from "./payload.js";

test("Central Embed IDs and event items are strictly normalized", () => {
  assert.equal(
      normalizeCentralEmbedId("embed_abc123def456"),
      "embed_abc123def456",
  );
  assert.equal(normalizeCentralEmbedId("../admin"), "");

  const draft = normalizeCentralEmbedDraft({
    layout: "compact",
    items: [
      {
        sourceEventId: "event_123",
        featured: true,
        recurrence: {
          planningCenterEventId: "series_456",
          title: "  Weekly   Gathering ",
        },
        overrides: {
          title: "  Summer   Picnic ",
          date: "",
          description: "Line one\r\nLine two",
          image: {
            url: "https://example.com/not-an-upload.jpg",
            storagePath: "other/path.jpg",
          },
        },
      },
      {sourceEventId: "event_123", overrides: {title: "Duplicate"}},
      {sourceEventId: "../../bad"},
    ],
  });

  assert.deepEqual(draft, {
    layout: CENTRAL_EMBED_LAYOUT_COMPACT,
    items: [{
      sourceEventId: "event_123",
      recurrence: {
        planningCenterEventId: "series_456",
        title: "Weekly Gathering",
      },
      overrides: {
        title: "Summer Picnic",
        date: null,
        time: null,
        location: null,
        description: "Line one\nLine two",
        image: null,
      },
      order: 0,
    }],
  });

  assert.equal(normalizeCentralEmbedDraft({layout: "unknown"}).layout,
      "standard");
  const legacyItem = normalizeCentralEmbedDraft({items: [{
    sourceEventId: "event_456",
    featured: true,
  }]}).items[0];
  assert.equal(Object.hasOwn(legacyItem, "featured"), false);
});

test("source event flattening exposes only needed public fields", () => {
  const events = flattenCentralEmbedSourceEvents({
    today: [{
      id: "1",
      planning_center_event_id: "series-1",
      planning_center_title: "Source Series",
      title: "Event",
      date: "Aug 20",
      starts_at: "2026-08-20T18:00:00Z",
      featured: "TRUE",
      private_notes: "do not expose",
      registration_url: "https://example.com/register",
    }],
    upcoming: [{id: "1", title: "Duplicate"}],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].registrationUrl, "https://example.com/register");
  assert.equal(events[0].seriesId, "series-1");
  assert.equal(events[0].seriesTitle, "Source Series");
  assert.equal(events[0].featured, true);
  assert.equal(Object.hasOwn(events[0], "private_notes"), false);
});

test("source event Featured values default false and accept booleans", () => {
  const events = flattenCentralEmbedSourceEvents({
    upcoming: [
      {id: "one", title: "Normal", featured: "FALSE"},
      {id: "two", title: "Featured", featured: true},
    ],
  });

  assert.deepEqual(events.map((event) => event.featured), [false, true]);
});

test("embed types preserve legacy Events and reject unknown values", () => {
  assert.equal(normalizeCentralEmbedType(), CENTRAL_EMBED_TYPE_EVENTS);
  assert.equal(normalizeCentralEmbedType(""), CENTRAL_EMBED_TYPE_EVENTS);
  assert.equal(
      normalizeCentralEmbedType(" EVENTS "),
      CENTRAL_EMBED_TYPE_EVENTS,
  );
  assert.equal(normalizeCentralEmbedType("Groups"), CENTRAL_EMBED_TYPE_GROUPS);
  assert.equal(normalizeCentralEmbedType("pages"), "");
});

test("Groups drafts contain only a normalized theme", () => {
  assert.deepEqual(createCentralEmbedDefaultDraft("groups"), {theme: "light"});
  assert.deepEqual(normalizeCentralEmbedDraft({
    theme: "responsive",
    layout: "compact",
    items: [{sourceEventId: "event-1"}],
  }, "groups"), {theme: "responsive"});
  assert.deepEqual(normalizeCentralEmbedDraft({theme: "DARK"}, "groups"), {
    theme: "dark",
  });
  assert.equal(normalizeCentralEmbedTheme("system"), "light");
});

test("admin serialization preserves types and legacy Event defaults", () => {
  const snapshot = (id, data) => ({id, data: () => data});
  const groups = serializeCentralEmbedAdminRecord(snapshot(
      "embed_abc123def456",
      {
        type: "groups",
        name: "Directory",
        draft: {theme: "dark", items: [{sourceEventId: "ignored"}]},
        published: {theme: "responsive"},
      },
  ));
  assert.equal(groups.type, "groups");
  assert.deepEqual(groups.draft, {theme: "dark"});
  assert.deepEqual(groups.published, {theme: "responsive"});

  const legacy = serializeCentralEmbedAdminRecord(snapshot(
      "embed_def456abc123",
      {draft: {items: []}},
  ));
  assert.equal(legacy.type, "events");
  assert.equal(legacy.draft.layout, "standard");
  assert.throws(
      () => serializeCentralEmbedAdminRecord(snapshot(
          "embed_bad123bad123",
          {type: "unsupported", draft: {}},
      )),
      /Unsupported Central Embed type/,
  );
});
