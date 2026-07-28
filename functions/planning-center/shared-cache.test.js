import assert from "node:assert/strict";
import test from "node:test";

import {getSharedCachedValue} from "./shared-cache.js";

test("fresh shared values avoid upstream refreshes", async () => {
  const fake = createFakeFirestore({
    value: {events: ["cached"]},
    fetchedAtMs: 9000,
  });
  let loadCount = 0;

  const result = await getSharedCachedValue({
    firestore: fake.firestore,
    docRef: fake.docRef,
    ttlMs: 5000,
    now: () => 10000,
    loadFresh: async () => {
      loadCount += 1;
      return {events: ["upstream"]};
    },
  });

  assert.equal(result.status, "fresh");
  assert.deepEqual(result.value, {events: ["cached"]});
  assert.equal(loadCount, 0);
});

test("forced refreshes replace otherwise fresh shared values", async () => {
  const fake = createFakeFirestore({
    value: {events: ["cached"]},
    fetchedAtMs: 9000,
  });
  let loadCount = 0;

  const result = await getSharedCachedValue({
    firestore: fake.firestore,
    docRef: fake.docRef,
    ttlMs: 5000,
    now: () => 10000,
    forceRefresh: true,
    loadFresh: async () => {
      loadCount += 1;
      return {events: ["upstream"]};
    },
  });

  assert.equal(result.status, "refreshed");
  assert.equal(result.fetchedAtMs, 10000);
  assert.deepEqual(result.value, {events: ["upstream"]});
  assert.equal(loadCount, 1);
});

test("concurrent cold callers share one upstream refresh", async () => {
  const fake = createFakeFirestore();
  let loadCount = 0;
  const options = {
    firestore: fake.firestore,
    docRef: fake.docRef,
    ttlMs: 5000,
    leaseMs: 1000,
    waitForRefreshMs: 500,
    pollIntervalMs: 5,
    loadFresh: async () => {
      loadCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {events: ["shared"]};
    },
  };

  const [first, second] = await Promise.all([
    getSharedCachedValue(options),
    getSharedCachedValue(options),
  ]);

  assert.equal(loadCount, 1);
  assert.deepEqual(first.value, {events: ["shared"]});
  assert.deepEqual(second.value, {events: ["shared"]});
  assert.ok([first.status, second.status].includes("refreshed"));
});

test("failed refreshes return the last known good value", async () => {
  const fake = createFakeFirestore({
    value: {events: ["stale"]},
    fetchedAtMs: 1000,
  });

  const result = await getSharedCachedValue({
    firestore: fake.firestore,
    docRef: fake.docRef,
    ttlMs: 1000,
    now: () => 10000,
    loadFresh: async () => {
      const error = new Error("rate limited");
      error.status = 429;
      throw error;
    },
  });

  assert.equal(result.status, "stale");
  assert.deepEqual(result.value, {events: ["stale"]});
  assert.equal(fake.getState().lastErrorStatus, 429);
});

test(
    "stale values return immediately while another lease is active",
    async () => {
      const fake = createFakeFirestore({
        value: {events: ["stale"]},
        fetchedAtMs: 1000,
        refreshLeaseId: "another-instance",
        refreshLeaseUntilMs: 20000,
      });
      let loadCount = 0;

      const result = await getSharedCachedValue({
        firestore: fake.firestore,
        docRef: fake.docRef,
        ttlMs: 1000,
        now: () => 10000,
        loadFresh: async () => {
          loadCount += 1;
          return {events: ["upstream"]};
        },
      });

      assert.equal(result.status, "stale");
      assert.deepEqual(result.value, {events: ["stale"]});
      assert.equal(loadCount, 0);
    },
);

/**
 * Creates a serialized in-memory Firestore transaction surface.
 *
 * @param {Object} initialState Initial document data.
 * @return {Object} Fake Firestore, document, and state reader.
 */
function createFakeFirestore(initialState = {}) {
  let state = structuredClone(initialState);
  let transactionQueue = Promise.resolve();

  const snapshot = () => ({
    exists: Object.keys(state).length > 0,
    data: () => structuredClone(state),
  });
  const mergeSet = (value, options = {}) => {
    state = options.merge ?
      {...state, ...structuredClone(value)} :
      structuredClone(value);
  };
  const docRef = {
    get: async () => snapshot(),
    set: async (value, options) => mergeSet(value, options),
  };
  const firestore = {
    runTransaction: (callback) => {
      const run = transactionQueue.catch(() => {}).then(async () => {
        const writes = [];
        const transaction = {
          get: async () => snapshot(),
          set: (reference, value, options) => {
            writes.push(() => mergeSet(value, options));
          },
        };
        const result = await callback(transaction);
        writes.forEach((write) => write());
        return result;
      });
      transactionQueue = run;
      return run;
    },
  };

  return {
    firestore,
    docRef,
    getState: () => structuredClone(state),
  };
}
