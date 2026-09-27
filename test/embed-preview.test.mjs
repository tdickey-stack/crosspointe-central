import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {resolveCentralEmbedEvents} from "../functions/embeds/render.js";

const bundle = await readFile(
    new URL("../public/embed-preview.js", import.meta.url),
    "utf8",
);

function previewApi() {
  const window = {};
  vm.runInNewContext(bundle, {window, URL});
  return window.CentralEmbedPreview;
}

const sourceGroups = {
  upcoming: [{
    id: "early-series-a",
    planning_center_event_id: "series-a",
    planning_center_title: "Weekly Prayer",
    title: "Weekly Prayer",
    date: "August 6",
    time: "6 PM",
    starts_at: "2026-08-06T23:00:00.000Z",
    description: "<Public prayer>",
    image_url: "https://example.com/prayer.jpg",
    featured: "FALSE",
  }, {
    id: "later-series-a",
    planning_center_event_id: "series-a",
    planning_center_title: "Weekly Prayer",
    title: "Weekly Prayer",
    date: "August 13",
    time: "6 PM",
    starts_at: "2026-08-13T23:00:00.000Z",
    featured: "FALSE",
  }, {
    id: "same-title-other-series",
    planning_center_event_id: "series-b",
    planning_center_title: "Weekly Prayer",
    title: "Weekly Prayer",
    date: "August 7",
    time: "6 PM",
    starts_at: "2026-08-07T23:00:00.000Z",
    featured: "FALSE",
  }, {
    id: "featured",
    planning_center_event_id: "series-featured",
    planning_center_title: "Featured Night",
    title: "Featured < Night",
    date: "August 20",
    time: "7 PM",
    starts_at: "2026-08-20T23:00:00.000Z",
    featured: "TRUE",
  }],
};

test("draft preview resolves with the same public ordering and rollover as the server", () => {
  const draft = {layout: "standard", items: [{
    sourceEventId: "later-series-a",
    recurrence: {planningCenterEventId: "series-a", title: "Weekly Prayer"},
    overrides: {title: "Pray with us"},
  }, {
    sourceEventId: "same-title-other-series",
    recurrence: {planningCenterEventId: "series-b", title: "Weekly Prayer"},
    overrides: {},
  }, {
    sourceEventId: "featured",
    overrides: {},
  }]};
  const api = previewApi();
  assert.deepEqual(
      JSON.parse(JSON.stringify(api.resolve(draft, sourceGroups))),
      resolveCentralEmbedEvents(draft, sourceGroups),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.resolve(draft, sourceGroups).map((event) => event.title))), [
    "Featured < Night",
    "Pray with us",
    "Weekly Prayer",
  ]);
});

test("selections preserve source item identity and append missing items after public order", () => {
  const selected = previewApi().selections({items: [{
    sourceEventId: "same-title-other-series",
    recurrence: {planningCenterEventId: "series-b", title: "Weekly Prayer"},
    overrides: {},
  }, {
    sourceEventId: "missing-event",
    overrides: {title: "Saved < title"},
  }, {
    sourceEventId: "early-series-a",
    recurrence: {planningCenterEventId: "series-a", title: "Weekly Prayer"},
    overrides: {},
  }]}, sourceGroups);
  assert.deepEqual(JSON.parse(JSON.stringify(selected.map((entry) => entry.event && entry.event.key))), [
    "event-3-early-series-a",
    "event-1-same-title-other-series",
    null,
  ]);
  assert.equal(selected[2].item.overrides.title, "Saved < title");
});

test("preview document escapes draft content and loads static enhancement assets", () => {
  const html = previewApi().document("draft<id", {items: [{
    sourceEventId: "featured",
    overrides: {title: "<script>alert(1)</script>"},
  }]}, sourceGroups, "https://central.example/path");
  assert.match(html, /data-central-embed-static-preview="true"/);
  assert.match(html, /https:\/\/central\.example\/embed\.css/);
  assert.match(html, /https:\/\/central\.example\/embed\.js/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
