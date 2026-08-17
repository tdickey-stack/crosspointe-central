import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANNER_COLLECTIONS,
  createPlannerStore,
  plannerPersistenceInternals,
} from "../src/planner/persistence.js";
import {cloneStarterData} from "../src/planner/seed-data.js";

test("playbook persistence validates every week and promotion play", () => {
  const playbook = cloneStarterData().playbooks.find(
    (item) => item.id === "level-1-major",
  );
  assert.doesNotThrow(() => {
    plannerPersistenceInternals.assertValidPlaybookDefinition(playbook);
  });

  const invalidMiddleWeek = structuredClone(playbook);
  invalidMiddleWeek.weeks[3].plays[0].eligibleWeekdays = [9];
  assert.throws(
    () => plannerPersistenceInternals
      .assertValidPlaybookDefinition(invalidMiddleWeek),
    /invalid promotion play/,
  );

  const mismatchedDuration = structuredClone(playbook);
  mismatchedDuration.durationWeeks = 7;
  assert.throws(
    () => plannerPersistenceInternals
      .assertValidPlaybookDefinition(mismatchedDuration),
    /one definition for every campaign week/,
  );
});

function createFakeFirestore(initialDocuments = {}) {
  const documents = new Map(Object.entries(initialDocuments));
  const committedBatchSizes = [];
  const writtenPaths = [];

  function snapshot(path, data) {
    return {
      id: path.split("/").at(-1),
      exists: data !== undefined,
      data: () => data,
    };
  }

  function collection(name) {
    const query = {
      doc(id) {
        const path = `${name}/${id}`;
        return {
          id,
          path,
          get: async () => snapshot(path, documents.get(path)),
        };
      },
      async get() {
        const docs = [...documents.entries()]
          .filter(([path]) => path.startsWith(`${name}/`))
          .map(([path, data]) => snapshot(path, data));
        return {docs, empty: docs.length === 0, size: docs.length};
      },
      where() {
        return query;
      },
      orderBy() {
        return query;
      },
    };
    return query;
  }

  return {
    collection,
    batch() {
      const writes = [];
      return {
        set(reference, payload) {
          writes.push({reference, payload});
        },
        async commit() {
          committedBatchSizes.push(writes.length);
          writes.forEach(({reference, payload}) => {
            writtenPaths.push(reference.path);
            documents.set(reference.path, payload);
          });
        },
      };
    },
    committedBatchSizes,
    documents,
    writtenPaths,
  };
}

test("Planner set operations stay below the rules evaluation ceiling", async () => {
  const committedBatchSizes = [];
  const firestore = {
    batch() {
      let writes = 0;
      return {
        set() {
          writes += 1;
        },
        async commit() {
          committedBatchSizes.push(writes);
        },
      };
    },
  };
  const operations = Array.from({length: 23}, (_value, index) => ({
    reference: {path: `starter/${index}`},
    payload: {index},
  }));

  await plannerPersistenceInternals.commitPlannerSetOperations(
    firestore,
    operations,
  );

  assert.equal(plannerPersistenceInternals.PLANNER_RULES_SAFE_BATCH_SIZE, 5);
  assert.deepEqual(committedBatchSizes, [5, 5, 5, 5, 3]);
});

test("starter publishing skips existing documents and is retry safe", async () => {
  const existingPlaybookPath =
    `${PLANNER_COLLECTIONS.playbooks}/level-1-major`;
  const existingVersionPath =
    `${PLANNER_COLLECTIONS.versions}/level-1-major_v1`;
  const firestore = createFakeFirestore({
    [existingPlaybookPath]: {
      currentVersion: 1,
      name: "Existing Level 1",
      createdAt: "existing-created-at",
      updatedAt: "existing-updated-at",
    },
    [existingVersionPath]: {
      playbookId: "level-1-major",
      version: 1,
      name: "Existing Level 1 Version",
      createdAt: "existing-created-at",
      updatedAt: "existing-updated-at",
    },
  });
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
        Timestamp: {fromDate: (value) => value},
      },
    },
  };

  try {
    const store = createPlannerStore({
      firestore,
      user: {uid: "planner-admin"},
    });
    const workspace = await store.publishStarterConfiguration();

    assert.deepEqual(firestore.committedBatchSizes, [5, 5, 5, 5, 1]);
    assert.equal(firestore.writtenPaths.includes(existingPlaybookPath), false);
    assert.equal(firestore.writtenPaths.includes(existingVersionPath), false);
    assert.equal(
      firestore.documents.get(existingPlaybookPath).name,
      "Existing Level 1",
    );
    assert.equal(workspace.playbooks.length, 9);
    assert.equal(workspace.capacityRules.length, 4);
    assert.equal(workspace.standingLanes.length, 1);
    assert.equal(workspace.isSeeded, true);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("editing an existing content series preserves immutable creation metadata", async () => {
  const createdAt = "2026-08-01T12:00:00.000Z";
  const campaignPath = `${PLANNER_COLLECTIONS.campaigns}/content-series`;
  const playPath = `${PLANNER_COLLECTIONS.plays}/content-series-promotion-1`;
  const firestore = createFakeFirestore({
    [campaignPath]: {
      id: "content-series",
      createdAt,
      createdByUid: "original-owner",
      eventDate: "2026-08-23",
      registrationDeadline: "",
      recommendedStartDate: "2026-08-23",
      submittedAt: createdAt,
    },
    [playPath]: {
      id: "content-series-promotion-1",
      campaignId: "content-series",
      createdAt,
      createdByUid: "original-owner",
      originalScheduledDate: "2026-08-23",
      scheduledDate: "2026-08-23",
    },
  });
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
        Timestamp: {fromDate: (value) => value},
      },
    },
  };

  try {
    const store = createPlannerStore({firestore, user: {uid: "planner-admin"}});
    const result = await store.saveCampaignSchedule({
      id: "content-series",
      name: "Edited podcast",
      eventDate: "2026-09-20",
      registrationDeadline: "",
      submittedAt: createdAt,
      recommendedStartDate: "2026-08-23",
      isOnTime: true,
      daysLate: 0,
      weeksLate: 0,
      level: 5,
      campaignType: "standalone-content",
      playbookId: "standalone-content",
      playbookVersion: 1,
      durationWeeks: 3,
      sourceEventId: "",
      notes: "Edited",
      status: "active",
    }, [{
      id: "content-series-promotion-1",
      campaignId: "content-series",
      campaignName: "Edited podcast",
      campaignLevel: 5,
      campaignType: "standalone-content",
      playbookId: "standalone-content",
      playbookVersion: 1,
      templatePlayId: "standalone-content-1",
      weekNumber: 1,
      phase: "Content",
      playType: "Podcast",
      channel: "Podcast",
      resourceId: "standalone-content",
      originalScheduledDate: "2026-08-23",
      scheduledDate: "2026-08-23",
      eligibleWeekdays: [0],
      status: "scheduled",
      requirement: "required",
      lateBehavior: "SKIP",
      source: "standalone-content:biweekly",
      manuallyAdjusted: false,
      locked: false,
      conflictState: "none",
      conflictReason: "",
      lateReason: "",
      supportsSmuggle: false,
      smuggle: null,
    }]);
    assert.equal(result.campaign.createdAt, createdAt);
    assert.equal(result.campaign.createdByUid, "original-owner");
    assert.equal(result.plays[0].createdAt, createdAt);
    assert.equal(result.plays[0].createdByUid, "original-owner");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("promotion requests normalize PCO date fields for the Planner UI", () => {
  const timestamp = (iso) => ({toDate: () => new Date(iso)});
  const normalized = plannerPersistenceInternals.normalizePromotionRequest({
    id: "pco_930568_123",
    submittedAt: timestamp("2026-08-16T15:30:00.000Z"),
    receivedAt: timestamp("2026-08-16T15:31:00.000Z"),
    eventDate: timestamp("2026-09-12T12:00:00.000Z"),
    eventDateEnd: timestamp("2026-09-13T12:00:00.000Z"),
    eventDates: [
      timestamp("2026-09-12T12:00:00.000Z"),
      timestamp("2026-09-13T12:00:00.000Z"),
    ],
    requestedPromotionStart: null,
    requestedPromotionEnd: null,
    requestedPlatforms: ["Newsletter", "Stage Announcement"],
  });

  assert.equal(normalized.eventDate, "2026-09-12");
  assert.equal(normalized.eventDateEnd, "2026-09-13");
  assert.deepEqual(normalized.eventDates, ["2026-09-12", "2026-09-13"]);
  assert.equal(normalized.submittedAt, "2026-08-16T15:30:00.000Z");
  assert.deepEqual(normalized.requestedPlatforms, ["Newsletter", "Stage Announcement"]);
});

test("promotion request review updates are whitelisted and timestamped", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        Timestamp: {fromDate: (value) => value},
      },
    },
  };
  try {
    const payload = plannerPersistenceInternals.promotionRequestUpdateForCloud({
      proposedName: "  Fall Kickoff  ",
      eventDate: "2026-09-12",
      eventDates: ["2026-09-12", "2026-09-13"],
      eventDateEnd: "2026-09-13",
      dateParseStatus: "manual",
      dateParseKind: "multiple",
      dateSource: "manual-review",
      status: "converted",
      campaignId: "pco-form-930568-123",
      sourceFormId: "must-not-change",
    }, "planner-admin", "server-timestamp");

    assert.equal(payload.proposedName, "Fall Kickoff");
    assert.equal(payload.status, "converted");
    assert.equal(payload.reviewedByUid, "planner-admin");
    assert.equal(payload.updatedAt, "server-timestamp");
    assert.equal(payload.eventDates.length, 2);
    assert.equal(payload.sourceFormId, undefined);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("request conversion commits the campaign, promos, and review state atomically", async () => {
  const requestId = "pco_1229879_456789";
  const campaignId = "pco-form-1229879-456789";
  const firestore = createFakeFirestore({
    [`${PLANNER_COLLECTIONS.requests}/${requestId}`]: {
      status: "pending-review",
    },
  });
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
        Timestamp: {fromDate: (value) => value},
      },
    },
  };

  try {
    const store = createPlannerStore({firestore, user: {uid: "planner-admin"}});
    const result = await store.convertPromotionRequest(
      requestId,
      {
        id: campaignId,
        name: "Community Story",
        eventDate: "2026-09-06",
        submittedAt: "2026-08-16T15:30:00.000Z",
        recommendedStartDate: "2026-08-23",
        isOnTime: true,
        level: 3,
        campaignType: "standard",
        playbookId: "level-3-standard",
        playbookVersion: 1,
        durationWeeks: 3,
        sourceEventId: "pco-form:1229879:456789",
        status: "active",
      },
      [{
        id: `${campaignId}-stage`,
        campaignId,
        campaignName: "Community Story",
        campaignLevel: 3,
        campaignType: "standard",
        playbookId: "level-3-standard",
        playbookVersion: 1,
        templatePlayId: "stage",
        weekNumber: 1,
        phase: "Awareness",
        playType: "Stage Announcement",
        originalScheduledDate: "2026-08-23",
        scheduledDate: "2026-08-23",
        eligibleWeekdays: [0],
        status: "scheduled",
        requirement: "required",
        lateBehavior: "SKIP",
      }],
      {
        proposedName: "Community Story",
        eventDate: "2026-09-06",
        eventDates: ["2026-09-06"],
        eventDateEnd: "",
        dateParseStatus: "manual",
        dateParseKind: "single",
        dateSource: "manual-review",
      },
    );

    assert.deepEqual(firestore.committedBatchSizes, [3]);
    assert.deepEqual(new Set(firestore.writtenPaths), new Set([
      `${PLANNER_COLLECTIONS.campaigns}/${campaignId}`,
      `${PLANNER_COLLECTIONS.plays}/${campaignId}-stage`,
      `${PLANNER_COLLECTIONS.requests}/${requestId}`,
    ]));
    assert.equal(result.request.status, "converted");
    assert.equal(result.request.campaignId, campaignId);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
