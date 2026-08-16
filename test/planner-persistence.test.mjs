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
