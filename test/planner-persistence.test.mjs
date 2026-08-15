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
