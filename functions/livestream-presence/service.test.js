/* eslint-disable require-jsdoc */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupPresence, createFirestorePresenceStore, createPresenceService,
  nextSession, PRESENCE_COLLECTION, PRESENCE_RETENTION_MS, resolveStream,
  validHeartbeat,
} from "./service.js";

const config = {enabled: true, timezone: "America/Chicago",
  url: "https://control.resi.io/webplayer/video.html?id=example"};
const start = Date.parse("2026-10-04T15:00:00Z");
const heartbeat = {sessionId: "0123456789abcdef0123456789abcdef",
  streamKey: resolveStream(config, "live", start).streamKey,
  active: true, sequence: 1};

// Models the Admin API surface, including strict range expiry and transaction
// serialization. Tests exercise the production store and its query shape.
function fakeFirestore() {
  const documents = new Map();
  const queries = [];
  let queue = Promise.resolve();
  const ref = (path) => ({
    path,
    collection: (name) => collection(path + "/" + name),
    async create(data) {
      if (documents.has(path)) throw Object.assign(new Error(), {code: 6});
      documents.set(path, data);
    },
    async delete() {
      documents.delete(path);
    },
  });
  const collection = (path, filters = [], max = Infinity, order = "") => ({
    doc: (id) => ref(path + "/" + id),
    where: (field, operator, value) => collection(
        path, filters.concat([{field, operator, value}]), max, order,
    ),
    orderBy: (field) => collection(path, filters, max, field),
    limit: (limit) => collection(path, filters, limit, order),
    async get() {
      queries.push({path, filters, max, order});
      const matches = Array.from(documents.entries())
          .filter(([key, data]) => key.startsWith(path + "/") &&
            !key.slice(path.length + 1).includes("/") && filters.every((f) => {
            assert.ok([">", "<="].includes(f.operator));
            return f.operator === ">" ?
                data[f.field] > f.value : data[f.field] <= f.value;
          }))
          .sort((a, b) => order ? a[1][order] - b[1][order] : 0)
          .slice(0, max);
      return {docs: matches.map(([key, data]) => ({
        ref: ref(key), data: () => data,
      })), empty: !matches.length, size: matches.length};
    },
    count() {
      return {get: async () => {
        const result = await collection(path, filters).get();
        return {data: () => ({count: result.size})};
      }};
    },
  });
  return {
    documents, queries, collection,
    runTransaction(callback) {
      queue = queue.then(() => callback({
        get: async (target) => ({exists: documents.has(target.path),
          data: () => documents.get(target.path)}),
        set: (target, value) => documents.set(target.path, value),
      }));
      return queue;
    },
    batch() {
      const pending = [];
      return {delete: (target) => pending.push(target.path),
        commit: async () => pending.forEach((path) => documents.delete(path))};
    },
  };
}

test("key isolates environment, URL and local calendar day", () => {
  const live = resolveStream(config, "live", start).streamKey;
  assert.notEqual(live, resolveStream(config, "dev", start).streamKey);
  assert.notEqual(live, resolveStream({...config, url: config.url + "2"},
      "live", start).streamKey);
  assert.equal(live, resolveStream(config, "live",
      Date.parse("2026-10-05T04:59:59Z")).streamKey);
  assert.notEqual(live, resolveStream(config, "live",
      Date.parse("2026-10-05T05:00:00Z")).streamKey);
});

test("only an enabled configured HTTPS Resi player can produce a key", () => {
  assert.equal(resolveStream({...config, enabled: false}, "live", start), null);
  for (const url of ["", "bad", "https://example.com/player",
    "http://control.resi.io/player", "https://control.resi.io.evil.com/",
    "https://user:password@control.resi.io/player",
    "https://control.resi.io:444/player"]) {
    assert.equal(resolveStream({...config, url}, "live", start), null);
  }
});

test("heartbeat validation rejects malformed data and document paths", () => {
  assert.equal(validHeartbeat(heartbeat), true);
  for (const body of [null, [], {}, {...heartbeat, extra: 1},
    {...heartbeat, sessionId: "../path"}, {...heartbeat, sessionId: "a"},
    {...heartbeat, streamKey: "arbitrary/path"}, {...heartbeat, active: "true"},
    {...heartbeat, sequence: 0}, {...heartbeat, sequence: 1.1},
    {...heartbeat, sequence: Number.MAX_SAFE_INTEGER + 1}]) {
    assert.equal(validHeartbeat(body), false);
  }
});

test("inclusive expiry and duplicate heartbeat expiry", async () => {
  const db = fakeFirestore();
  const store = createFirestorePresenceStore(db);
  await store.write(heartbeat.streamKey, heartbeat, start);
  await store.write(heartbeat.streamKey, heartbeat, start + 20000);
  assert.equal(await store.count(heartbeat.streamKey, start + 59999), 1);
  assert.equal(await store.count(heartbeat.streamKey, start + 60000), 0);
  assert.equal(db.queries[0].filters.length, 1);
  assert.equal(db.queries[0].filters[0].field, "activeUntil");
});

test("tombstones defeat duplicate and reordered requests", async () => {
  const db = fakeFirestore();
  const store = createFirestorePresenceStore(db);
  await store.write(heartbeat.streamKey,
      {...heartbeat, sequence: 3, active: false}, start + 100);
  await Promise.all([1, 2, 3].map((sequence) => store.write(
      heartbeat.streamKey, {...heartbeat, sequence}, start + 1000,
  )));
  assert.equal(await store.count(heartbeat.streamKey, start + 1001), 0);
  assert.equal(db.documents.size, 2);
  await store.write(heartbeat.streamKey, {...heartbeat, sequence: 4},
      start + 2000);
  assert.equal(await store.count(heartbeat.streamKey, start + 2001), 1);
  assert.equal(nextSession({sequence: 8}, {...heartbeat, sequence: 7}, start),
      null);
});

test("counts isolate environments", async () => {
  const db = fakeFirestore();
  const store = createFirestorePresenceStore(db);
  const dev = resolveStream(config, "dev", start).streamKey;
  await store.write(heartbeat.streamKey, heartbeat, start);
  await store.write(dev, {...heartbeat, streamKey: dev}, start);
  assert.equal(await store.count(heartbeat.streamKey, start), 1);
  assert.equal(await store.count(dev, start), 1);
});

test("stale keys and unavailable mode prevent storage", async () => {
  let writes = 0;
  let activeConfig = config;
  const service = createPresenceService({now: () => start,
    loadConfiguration: async () => activeConfig,
    store: {count: async () => 4, write: async () => writes++}});
  assert.deepEqual(await service.read("live"), {available: true,
    streamKey: heartbeat.streamKey, streamUrl: config.url, count: 4,
    updatedAt: new Date(start).toISOString()});
  assert.deepEqual(await service.write("dev", heartbeat), {available: false});
  assert.equal(writes, 0);
  assert.deepEqual(await service.write("live", heartbeat), {available: true});
  activeConfig = {...config, enabled: false};
  assert.deepEqual(await service.read("live"), {available: false});
  assert.deepEqual(await service.write("live", heartbeat), {available: false});
  assert.equal(writes, 1);
});

test("failures propagate instead of becoming zero viewers", async () => {
  const badConfig = createPresenceService({
    loadConfiguration: async () => {
      throw new Error("configuration failed");
    },
    store: {}, now: () => start,
  });
  await assert.rejects(badConfig.read("live"));
  const badCount = createPresenceService({loadConfiguration: async () => config,
    store: {count: async () => {
      throw new Error("database failed");
    }},
    now: () => start});
  await assert.rejects(badCount.read("live"));
});

test("cleanup drains before roots and retains recent days", async () => {
  const db = fakeFirestore();
  const retired = PRESENCE_COLLECTION + "/retired";
  db.documents.set(retired, {retireAt: start});
  const recent = PRESENCE_COLLECTION + "/recent";
  db.documents.set(recent, {retireAt: start + PRESENCE_RETENTION_MS});
  for (let i = 0; i < 1001; i++) {
    db.documents.set(retired + "/sessions/" + i, {sequence: 1, activeUntil: 0});
  }
  assert.deepEqual(await cleanupPresence(db, start),
      {deletedSessions: 1000, deletedStreams: 0});
  assert.ok(db.documents.has(retired));
  assert.deepEqual(await cleanupPresence(db, start),
      {deletedSessions: 1, deletedStreams: 1});
  assert.ok(!db.documents.has(retired));
  assert.ok(db.documents.has(recent));
  assert.equal(db.documents.size, 1);
});
