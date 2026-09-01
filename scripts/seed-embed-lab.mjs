import {createRequire} from "node:module";

const projectId = "crosspointe-central";
const emulatorHost = String(
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
).trim();

if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulatorHost)) {
  throw new Error(
      "Embed Lab seeding is restricted to a local Firestore emulator.",
  );
}

process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
process.env.GCLOUD_PROJECT = projectId;

const require = createRequire(
    new URL("../functions/package.json", import.meta.url),
);
const admin = require("firebase-admin");
const app = admin.apps.length ?
  admin.app() :
  admin.initializeApp({projectId});
const firestore = admin.firestore(app);
const now = new Date();
const imageUrl = "http://127.0.0.1:5005/icons/central-512.png";
const sourceEvents = [
  createEvent_("lab-featured", "CrossPointe Serve Day", 20, 9, 0, {
    description: "Spend a Saturday serving our neighbors alongside your " +
      "CrossPointe family. Choose a project that fits your gifts and bring " +
      "the whole family.",
    location: "All CrossPointe Campuses",
    registration: true,
    featured: true,
  }),
  createEvent_("lab-starting-pointe", "Starting Pointe", 7, 11, 0, {
    description: "Learn more about CrossPointe and find your next step.",
    location: "Central Campus",
  }),
  createEvent_("lab-marriage-night", "Marriage Night", 12, 18, 30, {
    description: "An encouraging evening designed to help couples grow " +
      "together.",
    location: "CrossPointe Church",
    registration: true,
  }),
  createEvent_("lab-community-night", "Community Night", 28, 17, 0, {
    description: "Food, games, and an easy evening together for every " +
      "generation.",
    location: "Town Green",
  }),
];
const standardDraft = createDraft_("standard");
const compactDraft = createDraft_("compact");
const batch = firestore.batch();

batch.set(firestore.doc("centralEmbeds/embed_labstandard1"), {
  schemaVersion: 1,
  type: "events",
  name: "Embed Lab Standard Demo",
  draft: standardDraft,
  published: standardDraft,
  publishedVersion: 1,
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now(),
  publishedAt: admin.firestore.Timestamp.now(),
});

batch.set(firestore.doc("centralEmbeds/embed_labcompact01"), {
  schemaVersion: 1,
  type: "events",
  name: "Embed Lab Compact Demo",
  draft: compactDraft,
  published: compactDraft,
  publishedVersion: 1,
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now(),
  publishedAt: admin.firestore.Timestamp.now(),
});

batch.set(
    firestore.doc("centralCache/planningCenter/calendar/v3-60"),
    {
      cacheType: "planning-center-calendar-source",
      dateKey: dateKey_(now),
      lookaheadDays: 60,
      fetchedAtMs: Date.now(),
      refreshLeaseId: "",
      refreshLeaseUntilMs: 0,
      lastErrorAtMs: 0,
      value: {today: [], upcoming: sourceEvents},
    },
    {merge: true},
);

await batch.commit();

console.log("Seeded local Embed Lab demos:");
console.log("  Standard: http://127.0.0.1:5005/embed-lab.html" +
  "?id=embed_labstandard1");
console.log("  Compact:  http://127.0.0.1:5005/embed-lab.html" +
  "?id=embed_labcompact01");

await app.delete();

function createDraft_(layout) {
  return {
    layout,
    items: sourceEvents.map((event, index) => ({
      sourceEventId: event.id,
      recurrence: null,
      overrides: {
        title: null,
        date: null,
        time: null,
        location: null,
        description: null,
        image: null,
      },
      order: index,
    })),
  };
}

function createEvent_(id, title, daysFromNow, hour, minute, options) {
  const startsAt = new Date(now.getTime());
  startsAt.setDate(startsAt.getDate() + daysFromNow);
  startsAt.setHours(hour, minute, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const details = options && typeof options === "object" ? options : {};
  const location = details.location || "CrossPointe Church";

  return {
    id,
    planning_center_instance_id: id,
    planning_center_event_id: "series-" + id,
    planning_center_title: title,
    featured: details.featured ? "TRUE" : "FALSE",
    title,
    date: new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago",
    }).format(startsAt),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    }).format(startsAt),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location,
    planning_center_location: location,
    description: details.description || "A local Embed Lab event.",
    image_url: imageUrl,
    registration_url: details.registration ?
      "https://crosspointe.tv" : "",
    church_center_url: "https://crosspointe.tv",
    button_text: details.registration ? "Register" : "Learn More",
    button_url: "https://crosspointe.tv",
    source: "Embed Lab",
    _planningCenterRooms: [location],
    _planningCenterRawLocation: location,
  };
}

function dateKey_(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Chicago",
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return parts.year + "-" + parts.month + "-" + parts.day;
}
