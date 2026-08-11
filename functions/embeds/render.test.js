import assert from "node:assert/strict";
import test from "node:test";

import {
  renderCentralEmbedHtml,
  resolveCentralEmbedEvents,
} from "./render.js";

const eventGroups = {
  upcoming: [{
    id: "event-1",
    title: "Source Title",
    date: "August 20",
    time: "6:00 PM",
    starts_at: "2026-08-20T23:00:00.000Z",
    location: "CrossPointe Church",
    description: "Source description",
    image_url: "https://example.com/source.jpg",
    registration_url: "https://example.com/register",
  }],
};

test("published values use embed overrides and source fallbacks", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "event-1",
      overrides: {
        title: "Embed Title",
        date: null,
        time: "Doors at 5:30 PM",
        location: null,
        description: null,
        image: null,
      },
    }],
  }, eventGroups);

  assert.equal(events[0].title, "Embed Title");
  assert.equal(events[0].date, "August 20");
  assert.equal(events[0].time, "Doors at 5:30 PM");
  assert.equal(events[0].startsAt, "");
  assert.equal(events[0].actionUrl, "https://example.com/register");
});

test("missing source events are omitted without breaking the embed", () => {
  const events = resolveCentralEmbedEvents({
    items: [{sourceEventId: "missing", overrides: {title: "Saved"}}],
  }, eventGroups);
  assert.deepEqual(events, []);
});

test("a recurring selection expands future Planning Center instances", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "expired-instance",
      recurrence: {
        planningCenterEventId: "series-123",
        title: "Weekly Gathering",
      },
      overrides: {title: "Gather With Us"},
    }],
  }, {
    upcoming: [{
      ...eventGroups.upcoming[0],
      id: "future-1",
      planning_center_event_id: "series-123",
      planning_center_title: "Weekly Gathering",
      date: "August 20",
    }, {
      ...eventGroups.upcoming[0],
      id: "future-2",
      planning_center_event_id: "series-123",
      planning_center_title: "Weekly Gathering",
      date: "August 27",
    }, {
      ...eventGroups.upcoming[0],
      id: "different-series",
      planning_center_event_id: "series-999",
      planning_center_title: "Weekly Gathering",
    }],
  });

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.date), [
    "August 20",
    "August 27",
  ]);
  assert.equal(events[0].title, "Gather With Us");
});

test("recurring selection falls back to normalized source title", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "old-instance",
      recurrence: {title: "  Community   Prayer  "},
      overrides: {},
    }],
  }, {
    upcoming: [{
      ...eventGroups.upcoming[0],
      id: "future-title-match",
      title: "Community Prayer",
      planning_center_title: "Community Prayer",
    }, {
      ...eventGroups.upcoming[0],
      id: "unrelated",
      title: "Community Worship",
      planning_center_title: "Community Worship",
    }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Community Prayer");
});

test("HTML renderer emits semantic markup and escapes content", () => {
  const html = renderCentralEmbedHtml("embed_abc123def456", [{
    title: "Kids < Night",
    date: "August 20",
    time: "6 PM",
    startsAt: "2026-08-20T23:00:00.000Z",
    location: "CrossPointe",
    description: "A public event",
    imageUrl: "",
    actionUrl: "https://example.com",
    actionLabel: "Learn More",
  }], {includeStyles: false});

  assert.match(html, /<section/);
  assert.match(html, /<article/);
  assert.match(html, /<h2/);
  assert.match(html, /<time[^>]+datetime=/);
  assert.match(html, /<a[^>]+href=/);
  assert.match(html, /Kids &lt; Night/);
  assert.doesNotMatch(html, /Kids < Night/);
});

test("compact HTML stays bounded to the concise event fields", () => {
  const html = renderCentralEmbedHtml("embed_abc123def456", [{
    title: "Community Night",
    date: "August 20",
    time: "6 PM",
    startsAt: "2026-08-20T23:00:00.000Z",
    location: "CrossPointe Church",
    description: "This long description belongs only in the standard layout.",
    imageUrl: "https://example.com/event.jpg",
    actionUrl: "https://example.com/event",
    actionLabel: "Learn More",
  }], {includeStyles: false, layout: "compact"});

  assert.match(html, /central-embed-layout-compact/);
  assert.match(html, /data-central-embed-layout="compact"/);
  assert.match(html, /Community Night/);
  assert.match(html, /August 20 · 6 PM/);
  assert.match(html, /CrossPointe Church/);
  assert.match(html, /Learn More/);
  assert.doesNotMatch(html, /long description/);
});
