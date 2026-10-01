import assert from "node:assert/strict";
import test from "node:test";

import {
  createEventMedia,
  eventDateToken,
  eventLocationMeta,
  eventPalette,
  safeEventImageUrl,
} from "../public/navlab-event-card.js";

const APPROVED_PALETTE = new Set([
  "#EF3E2D|#27272A",
  "#33BECC|#27272A",
  "#64242E|#FFFFFF",
  "#FAC8C3|#64242E",
  "#4BC3A7|#27272A",
  "#4BB8E9|#27272A",
  "#5558A6|#FFFFFF",
]);

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = {
      setProperty: (name, value) => { this.style[name] = value; },
    };
    this.className = "";
    this.classList = {
      add: (name) => { this.className = `${this.className} ${name}`.trim(); },
      remove: (name) => { this.className = this.className.split(/\s+/).filter((entry) => entry !== name).join(" "); },
    };
    this.textContent = "";
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  emit(type) {
    for (const listener of this.listeners.get(type) || []) listener({target: this});
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
          (child) => child !== this,
      );
    }
    this.parentElement = null;
  }
}

function withFakeDocument(callback) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
  try {
    return callback();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function findByClass(root, className) {
  if (String(root.className).split(/\s+/).includes(className)) return root;
  for (const child of root.children || []) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

test("timestamp dates use the church timezone across the UTC day boundary", () => {
  assert.deepEqual(eventDateToken({starts_at: "2026-01-01T05:30:00Z", time: "11:30 PM"}), {
    month: "DEC",
    day: "31",
    year: "2025",
    label: "",
    time: "11:30 PM",
    fallback: "",
  });
  assert.deepEqual(eventDateToken({starts_at: "2026-07-01T04:30:00Z"}), {
    month: "JUN",
    day: "30",
    year: "2026",
    label: "",
    time: "",
    fallback: "",
  });
});

test("date-only labels remain calendar dates and invalid dates stay readable", () => {
  assert.deepEqual(eventDateToken({date: "2026-03-08", time: "9:00 AM"}), {
    month: "MAR",
    day: "8",
    year: "2026",
    label: "",
    time: "9:00 AM",
    fallback: "",
  });
  assert.deepEqual(eventDateToken({date: "September 30, 2026"}), {
    month: "SEP",
    day: "30",
    year: "2026",
    label: "",
    time: "",
    fallback: "",
  });
  assert.deepEqual(eventDateToken({date: "2026-02-30"}), {
    month: "",
    day: "",
    year: "",
    label: "",
    time: "",
    fallback: "2026-02-30",
  });
  assert.equal(eventDateToken({date: "Every Wednesday"}).fallback, "Every Wednesday");
});

test("registration close dates are distinguished only when no event schedule exists", () => {
  assert.deepEqual(eventDateToken({close_date: "October 28, 2026", time: "6:00 PM"}), {
    month: "OCT",
    day: "28",
    year: "2026",
    label: "Closes",
    time: "",
    fallback: "",
  });

  const scheduled = eventDateToken({
    date: "October 31, 2026",
    close_date: "October 28, 2026",
    time: "6:00 PM",
  });
  assert.equal(scheduled.label, "");
  assert.equal(scheduled.day, "31");
  assert.equal(scheduled.time, "6:00 PM");
  assert.equal(eventLocationMeta({
    date: "October 31, 2026",
    close_date: "October 28, 2026",
    location: "CrossPointe Central",
  }), "CrossPointe Central");
});

test("repeat occurrences keep their series palette and approved colors vary", () => {
  const first = eventPalette({
    planning_center_event_id: "series-42",
    id: "occurrence-1",
    title: "Original title",
  });
  const repeat = eventPalette({
    planning_center_event_id: "series-42",
    id: "occurrence-2",
    title: "Renamed occurrence",
  });
  assert.deepEqual(repeat, first);

  const colors = new Set();
  const patterns = new Set();
  for (let index = 0; index < 80; index += 1) {
    const palette = eventPalette({planning_center_event_id: `series-${index}`});
    assert.ok(APPROVED_PALETTE.has(`${palette.background}|${palette.ink}`));
    colors.add(`${palette.background}|${palette.ink}`);
    patterns.add(palette.pattern);
  }
  assert.ok(colors.size >= 5, "series hashing should visibly vary the approved palette");
  assert.deepEqual([...patterns].sort(), [0, 1, 2]);
});

test("event images accept HTTPS without credentials and reject unsafe sources", () => {
  assert.equal(
      safeEventImageUrl("https://images.example.org/events/fall.jpg?size=large"),
      "https://images.example.org/events/fall.jpg?size=large",
  );
  for (const value of [
    "http://images.example.org/event.jpg",
    "//images.example.org/event.jpg",
    "https://editor:secret@images.example.org/event.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "not a url",
    "",
  ]) {
    assert.equal(safeEventImageUrl(value), "", value);
  }
});

test("media keeps the branded fallback when an image is missing or fails", () => {
  withFakeDocument(() => {
    const missing = createEventMedia({
      planning_center_event_id: "series-missing",
      date: "2026-10-28",
      image_url: "http://unsafe.example.org/event.jpg",
    }, {kind: "Registration"});
    assert.ok(findByClass(missing, "event-fallback"));
    assert.equal(missing.children.some((child) => child.tagName === "IMG"), false);
    assert.equal(findByClass(missing, "event-fallback-kind").textContent, "Registration");
    assert.ok(findByClass(missing, "event-date-token"));

    const loaded = createEventMedia({
      planning_center_event_id: "series-loaded",
      image_url: "https://images.example.org/event.jpg",
    }, {eager: true});
    const image = loaded.children.find((child) => child.tagName === "IMG");
    assert.ok(image);
    assert.equal(image.loading, "eager");
    assert.equal(image.decoding, "async");
    assert.equal(image.src, "https://images.example.org/event.jpg");
    const backdrop = findByClass(loaded, "event-image-backdrop");
    assert.ok(backdrop);
    image.emit("load");
    assert.ok(findByClass(loaded, "has-event-image"));
    assert.equal(backdrop.style.backgroundImage, 'url("https://images.example.org/event.jpg")');
    image.emit("error");
    assert.equal(loaded.children.includes(image), false);
    assert.equal(findByClass(loaded, "event-image-backdrop"), null);
    assert.equal(findByClass(loaded, "has-event-image"), null);
    assert.ok(findByClass(loaded, "event-fallback"));
  });
});
