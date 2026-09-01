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
    featured: "TRUE",
  }],
};

test("published values use embed overrides and source fallbacks", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "event-1",
      featured: false,
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
  assert.equal(events[0].featured, true);
  assert.equal(events[0].actionUrl, "https://example.com/register");
});

test("legacy manual prominence cannot override the Planning Center tag", () => {
  const events = resolveCentralEmbedEvents({
    items: [{sourceEventId: "event-1", featured: true, overrides: {}}],
  }, {
    upcoming: [{...eventGroups.upcoming[0], featured: "FALSE"}],
  });

  assert.equal(events[0].featured, false);
});

test("missing source events are omitted without breaking the embed", () => {
  const events = resolveCentralEmbedEvents({
    items: [{sourceEventId: "missing", overrides: {title: "Saved"}}],
  }, eventGroups);
  assert.deepEqual(events, []);
});

test(
    "a recurring selection uses only the next Planning Center instance",
    () => {
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
          starts_at: "2026-08-20T23:00:00.000Z",
        }, {
          ...eventGroups.upcoming[0],
          id: "future-2",
          planning_center_event_id: "series-123",
          planning_center_title: "Weekly Gathering",
          date: "August 27",
          starts_at: "2026-08-27T23:00:00.000Z",
        }, {
          ...eventGroups.upcoming[0],
          id: "different-series",
          planning_center_event_id: "series-999",
          planning_center_title: "Weekly Gathering",
        }],
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].date, "August 20");
      assert.equal(events[0].title, "Gather With Us");
    },
);

test("resolved events are chronological instead of editor ordered", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "later",
      overrides: {date: "Custom later date"},
    }, {
      sourceEventId: "earlier",
      overrides: {},
    }],
  }, {
    upcoming: [{
      ...eventGroups.upcoming[0],
      id: "later",
      title: "Later Event",
      starts_at: "2026-09-10T23:00:00.000Z",
    }, {
      ...eventGroups.upcoming[0],
      id: "earlier",
      title: "Earlier Event",
      starts_at: "2026-08-15T23:00:00.000Z",
    }],
  });

  assert.deepEqual(events.map((event) => event.title), [
    "Earlier Event",
    "Later Event",
  ]);
});

test("Featured events render before earlier normal events", () => {
  const events = resolveCentralEmbedEvents({
    items: [{
      sourceEventId: "normal-earlier",
      overrides: {},
    }, {
      sourceEventId: "featured-later",
      overrides: {},
    }, {
      sourceEventId: "normal-later",
      overrides: {},
    }],
  }, {
    upcoming: [{
      ...eventGroups.upcoming[0],
      id: "normal-later",
      title: "Normal Later",
      featured: "FALSE",
      starts_at: "2026-09-20T23:00:00.000Z",
    }, {
      ...eventGroups.upcoming[0],
      id: "normal-earlier",
      title: "Normal Earlier",
      featured: "FALSE",
      starts_at: "2026-08-15T23:00:00.000Z",
    }, {
      ...eventGroups.upcoming[0],
      id: "featured-later",
      title: "Featured Later",
      featured: "TRUE",
      starts_at: "2026-09-10T23:00:00.000Z",
    }],
  });

  assert.deepEqual(events.map((event) => event.title), [
    "Featured Later",
    "Normal Earlier",
    "Normal Later",
  ]);
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
    featured: true,
  }], {includeStyles: false});

  assert.match(html, /<section/);
  assert.match(html, /<article/);
  assert.match(html, /<h2/);
  assert.match(html, /<time[^>]+datetime=/);
  assert.match(html, /<a[^>]+href=/);
  assert.match(html, /Kids &lt; Night/);
  assert.match(html, /data-central-embed-event-kind="featured"/);
  assert.match(html, /central-embed-featured-label">Featured/);
  assert.match(html, /itemtype="https:\/\/schema.org\/Event"/);
  assert.match(html, /itemprop="startDate"/);
  assert.match(html, /itemprop="name"/);
  assert.match(html, /itemtype="https:\/\/schema.org\/Place"/);
  assert.match(html, /itemprop="description"/);
  assert.match(html, /itemprop="url"/);
  assert.doesNotMatch(html, /Kids < Night/);
});

test("standard HTML includes a progressive See More control", () => {
  const event = {
    title: "Community Night",
    date: "August 20",
    time: "6 PM",
    startsAt: "2026-08-20T23:00:00.000Z",
    location: "CrossPointe Church",
    description: "A public event",
    imageUrl: "",
    actionUrl: "https://example.com/event",
    actionLabel: "Learn More",
  };
  const html = renderCentralEmbedHtml(
      "embed_abc123def456",
      [event, {...event, title: "Next Event"}],
      {includeStyles: false, layout: "standard"},
  );

  assert.match(html, /data-central-embed-toggle/);
  assert.match(html, /aria-expanded="false">See More/);
});

test(
    "normal events are explicitly distinguishable from featured events",
    () => {
      const html = renderCentralEmbedHtml("embed_abc123def456", [{
        title: "Normal Event",
        featured: false,
      }, {
        title: "Featured Event",
        featured: true,
      }], {includeStyles: false, layout: "standard"});

      assert.match(html, /data-central-embed-event-kind="normal"/);
      assert.match(html, /class="central-embed-event is-featured"/);
    },
);

test("compact HTML stays bounded to the concise event fields", () => {
  const event = {
    title: "Community Night",
    date: "August 20",
    time: "6 PM",
    startsAt: "2026-08-20T23:00:00.000Z",
    location: "CrossPointe Church",
    description: "This long description belongs only in the standard layout.",
    imageUrl: "https://example.com/event.jpg",
    actionUrl: "https://example.com/event",
    actionLabel: "Learn More",
  };
  const html = renderCentralEmbedHtml(
      "embed_abc123def456",
      [event, {...event, title: "Next Community Night"}],
      {includeStyles: false, layout: "compact"},
  );

  assert.match(html, /central-embed-layout-compact/);
  assert.match(html, /data-central-embed-layout="compact"/);
  assert.match(html, /Community Night/);
  assert.match(html, /August 20 · 6 PM/);
  assert.match(html, /CrossPointe Church/);
  assert.match(html, /Learn More/);
  assert.match(html, /data-central-embed-scroll="-1"/);
  assert.match(html, /data-central-embed-scroll="1"/);
  assert.doesNotMatch(html, /long description/);
});
