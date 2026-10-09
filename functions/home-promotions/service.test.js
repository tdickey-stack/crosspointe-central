/* eslint-disable require-jsdoc, max-len */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HomePromotionError,
  PROMOTIONS_COLLECTION_PATH,
  buildHomePromotionOverlapWarnings,
  createHomePromotionsService,
  getHomePromotionCandidates,
  resolveHomePromotionHighlights,
} from "./service.js";

const NOW = Date.parse("2026-10-09T17:00:00.000Z");
const START = "2026-10-09T16:00:00.000Z";
const END = "2026-10-10T16:00:00.000Z";

test("candidates use stable public IDs and explain featured-event exclusion", () => {
  const data = publicData_();
  const candidates = getHomePromotionCandidates(data, NOW);

  assert.deepEqual(candidates.map((candidate) => candidate.key), [
    "events:event-featured",
    "events:event-2",
    "registrations:signup-1",
    "campaigns:campaign-1",
    "serveNeeds:serve-1",
  ]);
  assert.deepEqual(candidates[0], {
    key: "events:event-featured",
    type: "events",
    id: "event-featured",
    title: "Featured Event",
    eligible: false,
    unavailableReason: "featured-event",
  });
  assert.equal(candidates[1].eligible, true);
  assert.equal(candidates.some((candidate) => candidate.id === "old-event"), false);
  assert.equal(candidates.some((candidate) => candidate.id === "hidden-campaign"), false);
  assert.equal(candidates.some((candidate) => candidate.id === "draft-campaign"), false);
  assert.equal(candidates.some((candidate) => candidate.id === "untitled-campaign"), false);
});

test("module visibility and featured setting control candidate eligibility", () => {
  const data = publicData_();
  data.settings.homepage_modules = [{id: "campaigns", enabled: false}];
  data.settings.featured_event_enabled = false;
  const candidates = getHomePromotionCandidates(data, NOW);

  assert.equal(candidates.some((candidate) => candidate.type === "campaigns"), false);
  assert.equal(
      candidates.find((candidate) => candidate.id === "event-featured").eligible,
      true,
  );
});

test("campaign windows are rechecked against the Chicago calendar date", () => {
  const data = publicData_();
  data.campaigns = [
    {
      id: "ended",
      title: "Ended",
      ongoing: "FALSE",
      end_date: "2026-10-08",
    },
    {
      id: "today",
      title: "Through Today",
      ongoing: "FALSE",
      start_date: "2026-10-09",
      end_date: "2026-10-09",
    },
    {
      id: "future",
      title: "Future",
      ongoing: "FALSE",
      start_date: "2026-10-10",
    },
    {
      id: "ongoing",
      title: "Ongoing",
      ongoing: "TRUE",
      start_date: "2027-01-01",
    },
  ];
  const lateChicagoEvening = Date.parse("2026-10-10T02:00:00.000Z");

  const candidates = getHomePromotionCandidates(data, lateChicagoEvening);

  assert.deepEqual(
      candidates.filter((item) => item.type === "campaigns")
          .map((item) => item.id),
      ["today", "ongoing"],
  );
});

test("active highlights resolve public sources by priority with a hard cap of 3", () => {
  const data = publicData_();
  const promotions = [
    promotion_("p4", "serveNeeds", "serve-1", 40),
    promotion_("p2", "campaigns", "campaign-1", 20),
    promotion_("p1", "events", "event-2", 10),
    promotion_("p3", "registrations", "signup-1", 30),
    promotion_("hero", "events", "event-featured", 0),
    promotion_("missing", "campaigns", "missing-campaign", 5),
  ];

  const highlights = resolveHomePromotionHighlights(promotions, data, NOW);

  assert.deepEqual(highlights.map((item) => item.promotionId), [
    "p1", "p2", "p3",
  ]);
  assert.deepEqual(highlights.map((item) => item.selection), [
    "scheduled", "scheduled", "scheduled",
  ]);
  assert.equal(highlights[0].key, "events:event-2");
  assert.equal(highlights[0].item.title, "Second Event");
  assert.equal(highlights[1].startsAt, START);
});

test("promotion windows are start-inclusive and end-exclusive", () => {
  const data = publicData_();
  const promotion = promotion_("p1", "events", "event-2", 10, {
    startsAt: NOW,
    endsAt: NOW + 1000,
  });

  assert.equal(
      resolveHomePromotionHighlights([promotion], data, NOW)
          .filter((item) => item.selection === "scheduled").length,
      1,
  );
  assert.equal(
      resolveHomePromotionHighlights([promotion], data, NOW + 1000)
          .filter((item) => item.selection === "scheduled").length,
      0,
  );
});

test("automatic fill uses next event, newest campaign, then newest serve", () => {
  const highlights = resolveHomePromotionHighlights([], fallbackData_(), NOW);

  assert.deepEqual(highlights.map((item) => ({
    selection: item.selection,
    key: item.key,
  })), [
    {selection: "automatic", key: "events:event-next"},
    {selection: "automatic", key: "campaigns:campaign-new"},
    {selection: "automatic", key: "serveNeeds:serve-new"},
  ]);
  assert.equal(
      highlights[0].endsAt,
      new Date(NOW + 10 * 60 * 1000).toISOString(),
  );
  assert.equal("promotionId" in highlights[0], false);
  assert.equal("startsAt" in highlights[0], false);
});

test("the automatic event advances at the exact start boundary", () => {
  const data = fallbackData_();
  data.events.unshift({
    id: "starting-now", title: "Starting now",
    starts_at: new Date(NOW).toISOString(),
    ends_at: new Date(NOW + 60000).toISOString(),
  });
  const result = resolveHomePromotionHighlights([], data, NOW);
  assert.equal(result[0].key, "events:event-next");
});

test("scheduled items lead and automatic fill never duplicates their source", () => {
  const data = fallbackData_();
  data.registrations = [{
    id: "signup-1",
    title: "Manual Registration",
    active: "TRUE",
  }];
  const registration = promotion_(
      "manual-registration",
      "registrations",
      "signup-1",
      1,
  );
  const partial = resolveHomePromotionHighlights([registration], data, NOW);
  assert.deepEqual(partial.map((item) => item.key), [
    "registrations:signup-1",
    "events:event-next",
    "campaigns:campaign-new",
  ]);

  const campaign = promotion_(
      "manual-campaign",
      "campaigns",
      "campaign-new",
      1,
  );
  const deduplicated = resolveHomePromotionHighlights([campaign], data, NOW);
  assert.deepEqual(deduplicated.map((item) => item.key), [
    "campaigns:campaign-new",
    "events:event-next",
    "serveNeeds:serve-new",
  ]);
});

test("automatic fill does not substitute registrations or another source type", () => {
  const data = {
    settings: {featured_event_enabled: false, homepage_modules: []},
    registrations: [{id: "signup-only", title: "Registration only"}],
  };
  assert.deepEqual(resolveHomePromotionHighlights([], data, NOW), []);
});

test("an ongoing event may remain scheduled but is never the next automatic event", () => {
  const data = fallbackData_();
  const ongoing = promotion_(
      "manual-running",
      "events",
      "event-running",
      1,
  );
  const highlights = resolveHomePromotionHighlights([ongoing], data, NOW);

  assert.deepEqual(highlights.map((item) => item.key), [
    "events:event-running",
    "events:event-next",
    "campaigns:campaign-new",
  ]);
  assert.equal(highlights[0].selection, "scheduled");
});

test("overlap warnings report future segments above the three-card capacity", () => {
  const promotions = [
    promotion_("a", "events", "event-2", 10, {
      startsAt: NOW - 1000,
      endsAt: NOW + 10000,
    }),
    promotion_("b", "registrations", "signup-1", 20, {
      startsAt: NOW,
      endsAt: NOW + 10000,
    }),
    promotion_("c", "campaigns", "campaign-1", 30, {
      startsAt: NOW,
      endsAt: NOW + 10000,
    }),
    promotion_("d", "serveNeeds", "serve-1", 40, {
      startsAt: NOW + 1000,
      endsAt: NOW + 5000,
    }),
  ];

  assert.deepEqual(buildHomePromotionOverlapWarnings(promotions, NOW), [{
    code: "promotion-capacity-overlap",
    startsAt: new Date(NOW + 1000).toISOString(),
    endsAt: new Date(NOW + 5000).toISOString(),
    count: 4,
    promotionIds: ["a", "b", "c", "d"],
    message: "4 Home promotions overlap this window; only the first 3 by display order will appear.",
  }]);
});

test("save validates IDs, explicit offsets, source eligibility, and actor", async () => {
  const service = service_(new FakeFirestore_());
  const valid = input_("new-promotion");

  await assert.rejects(
      service.save({...valid, id: "../escape"}, actor_(), publicData_()),
      errorCode_("invalid-promotion-id", 400),
  );
  await assert.rejects(
      service.save({...valid, startsAt: "2026-10-09 11:00"}, actor_(), publicData_()),
      errorCode_("invalid-window", 400),
  );
  await assert.rejects(
      service.save({...valid, sourceId: "missing"}, actor_(), publicData_()),
      errorCode_("promotion-source-unavailable", 404),
  );
  await assert.rejects(
      service.save({
        ...valid,
        id: "inactive-missing",
        sourceId: "missing",
        active: false,
      }, actor_(), publicData_()),
      errorCode_("promotion-source-unavailable", 404),
  );
  await assert.rejects(
      service.save(valid, {}, publicData_()),
      errorCode_("admin-access-required", 403),
  );
});

test("save creates, retries idempotently, and enforces revision conflicts", async () => {
  const firestore = new FakeFirestore_();
  const service = service_(firestore);
  const input = input_("promotion-1");

  const created = await service.save(input, actor_(), publicData_());
  assert.equal(created.revision, 1);
  assert.equal(firestore.get_(PROMOTIONS_COLLECTION_PATH + "/promotion-1").revision, 1);

  const retry = await service.save(input, actor_(), publicData_());
  assert.equal(retry.revision, 1);

  await assert.rejects(
      service.save({...input, order: 20}, actor_(), publicData_()),
      errorCode_("promotion-revision-conflict", 409),
  );

  const updated = await service.save(
      {...input, order: 20, revision: 1},
      actor_(),
      publicData_(),
  );
  assert.equal(updated.revision, 2);
  assert.equal(firestore.get_(PROMOTIONS_COLLECTION_PATH + "/promotion-1").order, 20);
});

test("save rejects same-source overlap but permits adjacent windows", async () => {
  const firestore = new FakeFirestore_();
  const service = service_(firestore);
  await service.save(input_("first"), actor_(), publicData_());

  await assert.rejects(
      service.save(input_("overlap", {
        startsAt: "2026-10-10T15:59:59.000Z",
        endsAt: "2026-10-11T16:00:00.000Z",
      }), actor_(), publicData_()),
      errorCode_("promotion-source-overlap", 409),
  );

  await service.save(input_("adjacent", {
    startsAt: END,
    endsAt: "2026-10-11T16:00:00.000Z",
  }), actor_(), publicData_());
  assert.ok(firestore.get_(PROMOTIONS_COLLECTION_PATH + "/adjacent"));
});

test("an unavailable saved source can still be deactivated", async () => {
  const firestore = new FakeFirestore_({
    [PROMOTIONS_COLLECTION_PATH + "/old"]: {
      schemaVersion: 1,
      sourceType: "campaigns",
      sourceId: "removed-campaign",
      startsAt: timestamp_(Date.parse(START)),
      endsAt: timestamp_(Date.parse(END)),
      order: 10,
      active: true,
      revision: 1,
    },
  });
  const service = service_(firestore);
  const result = await service.save({
    id: "old",
    sourceType: "campaigns",
    sourceId: "removed-campaign",
    startsAt: START,
    endsAt: END,
    order: 10,
    active: false,
    revision: 1,
  }, actor_(), publicData_());

  assert.equal(result.active, false);
  assert.equal(result.revision, 2);
});

test("list retains saved rows independently of source publication", async () => {
  const firestore = new FakeFirestore_({
    [PROMOTIONS_COLLECTION_PATH + "/missing"]: {
      schemaVersion: 1,
      sourceType: "campaigns",
      sourceId: "removed-campaign",
      startsAt: timestamp_(NOW + 1000),
      endsAt: timestamp_(NOW + 10000),
      order: 10,
      active: true,
      revision: 3,
    },
  });
  const result = await service_(firestore).list(publicData_());

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].scheduleState, "upcoming");
  assert.equal(result.items[0].sourceAvailable, false);
  assert.deepEqual(result.highlights.map((item) => item.selection), [
    "automatic", "automatic", "automatic",
  ]);
});

test("public projection queries only records whose end is still ahead", async () => {
  const firestore = new FakeFirestore_({
    [PROMOTIONS_COLLECTION_PATH + "/current"]: storedPromotion_({
      endsAt: timestamp_(NOW + 10000),
    }),
    [PROMOTIONS_COLLECTION_PATH + "/expired"]: storedPromotion_({
      startsAt: timestamp_(NOW - 20000),
      endsAt: timestamp_(NOW - 10000),
    }),
  });

  const result = await service_(firestore).publicProjection(publicData_());

  assert.deepEqual(result.map((item) => item.promotionId || item.id), [
    "current", "event-2", "serve-1",
  ]);
  assert.deepEqual(firestore.queries, [{
    path: PROMOTIONS_COLLECTION_PATH,
    field: "endsAt",
    operator: ">",
    value: NOW,
  }]);
});

function publicData_() {
  return {
    settings: {
      featured_event_enabled: true,
      homepage_modules: [],
    },
    featuredEvent: {
      id: "event-featured",
      planning_center_instance_id: "event-featured",
    },
    events: [
      {
        id: "series-id",
        planning_center_instance_id: "event-featured",
        title: "Featured Event",
        starts_at: "2026-10-10T17:00:00.000Z",
        ends_at: "2026-10-10T19:00:00.000Z",
        active: "TRUE",
      },
      {
        id: "parent-event-id",
        planning_center_instance_id: "event-2",
        title: "Second Event",
        starts_at: "2026-10-11T17:00:00.000Z",
        ends_at: "2026-10-11T19:00:00.000Z",
        active: "TRUE",
      },
      {
        id: "old-event",
        title: "Old Event",
        starts_at: "2026-10-01T17:00:00.000Z",
        ends_at: "2026-10-01T19:00:00.000Z",
        active: "TRUE",
      },
    ],
    registrations: [{
      id: "signup-1",
      title: "Fall Registration",
      active: "TRUE",
    }],
    campaigns: [
      {id: "campaign-1", title: "Invite a Friend", active: "TRUE"},
      {id: "hidden-campaign", title: "Hidden", active: "FALSE"},
      {id: "draft-campaign", title: "Draft", published: false},
      {id: "untitled-campaign", active: "TRUE"},
    ],
    serveNeeds: [{
      id: "serve-1",
      need: "Welcome Team",
      active: "TRUE",
    }],
  };
}

function fallbackData_() {
  return {
    settings: {featured_event_enabled: false, homepage_modules: []},
    events: [
      {
        id: "event-later",
        title: "Later Event",
        starts_at: new Date(NOW + 20 * 60 * 1000).toISOString(),
        ends_at: new Date(NOW + 80 * 60 * 1000).toISOString(),
      },
      {
        id: "event-running",
        title: "Running Event",
        starts_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
        ends_at: new Date(NOW + 5 * 60 * 1000).toISOString(),
      },
      {
        id: "event-next",
        title: "Next Event",
        starts_at: new Date(NOW + 10 * 60 * 1000).toISOString(),
        ends_at: new Date(NOW + 70 * 60 * 1000).toISOString(),
      },
    ],
    campaigns: [
      {
        id: "campaign-old",
        title: "Old Campaign",
        published_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "campaign-new",
        title: "New Campaign",
        published_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      },
    ],
    serveNeeds: [
      {
        id: "serve-new",
        need: "New Serve Need",
        published_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
      },
      {
        id: "serve-old",
        need: "Old Serve Need",
        published_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function promotion_(id, sourceType, sourceId, order, overrides = {}) {
  return {
    id,
    sourceType,
    sourceId,
    startsAtMs: Object.prototype.hasOwnProperty.call(overrides, "startsAt") ?
      overrides.startsAt : Date.parse(START),
    endsAtMs: Object.prototype.hasOwnProperty.call(overrides, "endsAt") ?
      overrides.endsAt : Date.parse(END),
    order,
    active: Object.prototype.hasOwnProperty.call(overrides, "active") ?
      overrides.active : true,
    revision: 1,
  };
}

function input_(id, overrides = {}) {
  return {
    id,
    sourceType: "campaigns",
    sourceId: "campaign-1",
    startsAt: START,
    endsAt: END,
    order: 10,
    active: true,
    revision: 0,
    ...overrides,
  };
}

function storedPromotion_(overrides = {}) {
  return {
    schemaVersion: 1,
    sourceType: "campaigns",
    sourceId: "campaign-1",
    startsAt: timestamp_(NOW - 1000),
    endsAt: timestamp_(NOW + 1000),
    order: 10,
    active: true,
    revision: 1,
    ...overrides,
  };
}

function actor_() {
  return {
    uid: "admin-1",
    email: "admin@crosspointe.tv",
    displayName: "Admin One",
  };
}

function service_(firestore) {
  return createHomePromotionsService({
    firestore,
    timestampFromMillis: timestamp_,
    serverTimestamp: () => timestamp_(NOW),
    now: () => NOW,
  });
}

function timestamp_(milliseconds) {
  return {
    milliseconds,
    toMillis() {
      return milliseconds;
    },
  };
}

function errorCode_(code, status) {
  return (error) => {
    assert.ok(error instanceof HomePromotionError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

class FakeFirestore_ {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.queries = [];
  }

  collection(path) {
    const reference = {
      kind: "collection",
      path,
      doc: (id) => ({kind: "document", path: path + "/" + id, id}),
      get: async () => this.collectionSnapshot_(path),
      where: (field, operator, value) => ({
        kind: "collection",
        path,
        get: async () => {
          this.queries.push({
            path,
            field,
            operator,
            value: value.toMillis(),
          });
          return this.collectionSnapshot_(path, {field, operator, value});
        },
      }),
    };
    return reference;
  }

  async runTransaction(callback) {
    const writes = [];
    const result = await callback({
      get: async (reference) => reference.kind === "collection" ?
        this.collectionSnapshot_(reference.path) :
        this.documentSnapshot_(reference.path, reference.id),
      set: (reference, value) => writes.push([reference.path, value]),
    });
    writes.forEach(([path, value]) => this.values.set(path, value));
    return result;
  }

  get_(path) {
    return this.values.get(path);
  }

  collectionSnapshot_(path, constraint = null) {
    const prefix = path + "/";
    const docs = [...this.values.entries()]
        .filter(([key]) => key.startsWith(prefix) &&
          !key.slice(prefix.length).includes("/"))
        .filter(([, value]) => this.matches_(value, constraint))
        .map(([key, value]) => this.documentSnapshot_(
            key,
            key.slice(prefix.length),
            value,
        ));
    return {docs, empty: docs.length === 0, size: docs.length};
  }

  matches_(value, constraint) {
    if (!constraint) return true;
    const left = value && value[constraint.field];
    const leftValue = left && typeof left.toMillis === "function" ?
      left.toMillis() : left;
    const rightValue = constraint.value.toMillis();
    if (constraint.operator === ">") return leftValue > rightValue;
    throw new Error("Unsupported fake query operator.");
  }

  documentSnapshot_(path, id, suppliedValue) {
    const value = suppliedValue === undefined ?
      this.values.get(path) : suppliedValue;
    return {
      id,
      exists: value !== undefined,
      data: () => value,
      get: (field) => value && value[field],
    };
  }
}
