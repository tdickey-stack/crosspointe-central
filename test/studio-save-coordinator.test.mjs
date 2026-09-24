import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStudioSaveFailure,
  applyStudioSaveSuccess,
  createStudioSaveCoordinator,
  markStudioProjectPending,
  reconcileStudioProjects,
} from "../src/studio/save-coordinator.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {promise, resolve, reject};
}

function fakeTimers() {
  let clock = 0;
  let nextId = 1;
  const tasks = new Map();
  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  return {
    setTimeout(callback, delay = 0) {
      const id = nextId++;
      tasks.set(id, {callback, dueAt: clock + Number(delay || 0)});
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    async advance(milliseconds) {
      const target = clock + milliseconds;
      while (true) {
        const next = [...tasks.entries()]
          .filter(([, task]) => task.dueAt <= target)
          .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
        if (!next) break;
        const [id, task] = next;
        tasks.delete(id);
        clock = task.dueAt;
        task.callback();
        await flushMicrotasks();
      }
      clock = target;
      await flushMicrotasks();
    },
  };
}

function project(id, changes = {}) {
  return {
    id,
    name: id,
    cloudBacked: true,
    ownerUid: "studio-user",
    updatedAt: "2026-09-23T12:00:00.000Z",
    content: {title: id},
    ...changes,
  };
}

test("a conflict keeps the latest local edit and never automatically retries or flushes it", async () => {
  const timers = fakeTimers();
  const operation = deferred();
  const notifications = [];
  let calls = 0;
  let latest = markStudioProjectPending(project("a", {_cloudRevision: 1}), "studio-user");
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user", timers,
    saveProject: async () => { calls += 1; return operation.promise; },
    deleteProject: async () => {},
    onSaveError: (result) => { latest = applyStudioSaveFailure(latest, result); },
    onStateChange: (state) => notifications.push(state.status),
  });
  coordinator.schedule(latest);
  await timers.advance(500);
  latest = markStudioProjectPending({...latest, name: "Edited during request"}, "studio-user");
  coordinator.schedule(latest);
  operation.reject(Object.assign(new Error("A newer version exists"), {code: "studio/conflict"}));
  await timers.advance(20_000);
  await coordinator.flush("a");
  assert.equal(calls, 1);
  assert.equal(latest.name, "Edited during request");
  assert.equal(latest._studioSync.pending, true);
  assert.equal(latest._studioSync.conflict, true);
  assert.equal(coordinator.retry("a"), false);
  assert.equal(notifications.at(-1), "conflict");
  coordinator.schedule(markStudioProjectPending(latest, "studio-user"));
  await timers.advance(20_000);
  assert.equal(calls, 1);
});

test("a successful in-flight save advances the cloud version of queued edits", async () => {
  const timers = fakeTimers();
  const first = deferred();
  const versions = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user", timers,
    saveProject: async (value) => {
      versions.push(value._cloudRevision);
      if (versions.length === 1) await first.promise;
      return {...value, _cloudRevision: value._cloudRevision + 1};
    },
    deleteProject: async () => {},
  });
  const draft = markStudioProjectPending(project("a", {_cloudRevision: 3}), "studio-user");
  coordinator.schedule(draft); await timers.advance(500);
  coordinator.schedule(markStudioProjectPending({...draft, name: "Later"}, "studio-user"));
  await timers.advance(500); first.resolve(); await timers.advance(0);
  await coordinator.flush("a");
  assert.deepEqual(versions.slice(0, 2), [3, 4]);
});

test("loading a latest version resets a blocked queue for subsequent edits", async () => {
  const timers = fakeTimers();
  const versions = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user", timers,
    saveProject: async (value) => {
      versions.push(value._cloudRevision);
      if (value._cloudRevision === 1) throw Object.assign(new Error("Conflict"), {code: "studio/conflict"});
      return {...value, _cloudRevision: value._cloudRevision + 1};
    }, deleteProject: async () => {},
  });
  coordinator.schedule(markStudioProjectPending(project("a", {_cloudRevision: 1}), "studio-user"));
  await timers.advance(500);
  coordinator.reset("a");
  coordinator.schedule(markStudioProjectPending(project("a", {_cloudRevision: 2}), "studio-user"));
  await timers.advance(500);
  assert.deepEqual(versions, [1, 2]);
});

test("per-project debounce saves A and B independently", async () => {
  const timers = fakeTimers();
  const saves = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user",
    saveProject: async (value) => {
      saves.push(value.id);
      return {...value, cloudBacked: true};
    },
    deleteProject: async () => {},
    debounceMs: 500,
    timers,
  });
  coordinator.schedule(markStudioProjectPending(project("a"), "studio-user"));
  await timers.advance(100);
  coordinator.schedule(markStudioProjectPending(project("b"), "studio-user"));
  await timers.advance(500);
  assert.deepEqual(saves, ["a", "b"]);
});

test("new revisions wait for an in-flight save and stale success stays pending", async () => {
  const timers = fakeTimers();
  const first = deferred();
  const second = deferred();
  const operations = [first, second];
  const saveInputs = [];
  const revisions = [];
  let local = markStudioProjectPending(
    project("a", {cloudBacked: false, ownerUid: ""}),
    "studio-user",
    {
    now: () => "2026-09-23T12:01:00.000Z",
    },
  );
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user",
    saveProject: (value) => {
      saveInputs.push(value);
      return operations.shift().promise.then(() => ({
        ...value,
        cloudBacked: true,
        ownerUid: "studio-user",
      }));
    },
    deleteProject: async () => {},
    onSaveSuccess(result) {
      revisions.push({revision: result.revision, stale: result.stale});
      local = applyStudioSaveSuccess(local, result.savedProject, result);
    },
    debounceMs: 50,
    timers,
  });

  coordinator.schedule(local);
  await timers.advance(50);
  local = markStudioProjectPending(
    {...local, content: {title: "newer"}},
    "studio-user",
    {now: () => "2026-09-23T12:02:00.000Z"},
  );
  coordinator.schedule(local);
  await timers.advance(50);
  first.resolve();
  await timers.advance(0);

  assert.deepEqual(revisions, [{revision: 1, stale: true}]);
  assert.equal(local._studioSync.pending, true);
  assert.equal(local._studioSync.revision, 2);

  second.resolve();
  await timers.advance(0);
  assert.deepEqual(revisions, [
    {revision: 1, stale: true},
    {revision: 2, stale: false},
  ]);
  assert.equal(local._studioSync.pending, false);
  assert.equal(local._studioSync.syncedRevision, 2);
  assert.equal(local.content.title, "newer");
  assert.equal(saveInputs[1].cloudBacked, true);
});

test("failed saves remain pending and retry automatically", async () => {
  const timers = fakeTimers();
  let attempts = 0;
  let local = markStudioProjectPending(project("a"), "studio-user");
  const statuses = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user",
    saveProject: async (value) => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return value;
    },
    deleteProject: async () => {},
    onSaveError(result) {
      local = applyStudioSaveFailure(local, result);
    },
    onSaveSuccess(result) {
      local = applyStudioSaveSuccess(local, result.savedProject, result);
    },
    onStateChange(result) {
      statuses.push(result.status);
    },
    debounceMs: 20,
    retryDelayMs: 100,
    maxAutoRetries: 1,
    timers,
  });
  coordinator.schedule(local);
  await timers.advance(20);
  assert.equal(local._studioSync.pending, true);
  assert.equal(local._studioSync.lastError, "offline");
  await timers.advance(100);
  assert.equal(attempts, 2);
  assert.equal(local._studioSync.pending, false);
  assert.ok(statuses.includes("retrying"));
  assert.equal(statuses.at(-1), "saved");
});

test("delete cancels a pending create and idempotently deletes any external root", async () => {
  const timers = fakeTimers();
  const saves = [];
  const deletes = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user",
    saveProject: async (value) => saves.push(value.id),
    deleteProject: async (id) => deletes.push(id),
    debounceMs: 500,
    timers,
  });
  const pending = markStudioProjectPending(
    project("new", {cloudBacked: false, ownerUid: ""}),
    "studio-user",
  );
  coordinator.schedule(pending);
  await coordinator.delete(pending);
  await timers.advance(500);
  assert.deepEqual(saves, []);
  assert.deepEqual(deletes, ["new"]);
});

test("delete waits for an in-flight create and then removes it remotely", async () => {
  const timers = fakeTimers();
  const create = deferred();
  const order = [];
  const saveCallbacks = [];
  const coordinator = createStudioSaveCoordinator({
    actorUid: "studio-user",
    saveProject: async (value) => {
      order.push("save-start");
      await create.promise;
      order.push("save-end");
      return {...value, cloudBacked: true};
    },
    deleteProject: async () => order.push("delete"),
    onSaveSuccess: (result) => saveCallbacks.push(result),
    debounceMs: 10,
    timers,
  });
  const pending = markStudioProjectPending(
    project("new", {cloudBacked: false, ownerUid: ""}),
    "studio-user",
  );
  coordinator.schedule(pending);
  await timers.advance(10);
  const deletion = coordinator.delete(pending);
  await timers.advance(0);
  assert.deepEqual(order, ["save-start"]);
  create.resolve();
  await deletion;
  assert.deepEqual(order, ["save-start", "save-end", "delete"]);
  assert.deepEqual(saveCallbacks, []);
});

test("reconciliation keeps trusted pending and newer legacy local revisions", () => {
  const cloud = [
    project("pending", {updatedAt: "2026-09-23T12:00:00.000Z"}),
    project("legacy", {updatedAt: "2026-09-23T12:00:00.000Z"}),
  ];
  const pending = markStudioProjectPending(
    project("pending", {
      content: {title: "pending local"},
      updatedAt: "2026-09-23T12:01:00.000Z",
    }),
    "studio-user",
  );
  const legacy = project("legacy", {
    content: {title: "legacy local"},
    updatedAt: "2026-09-23T12:02:00.000Z",
  });
  const result = reconcileStudioProjects({
    cloudProjects: cloud,
    browserProjects: [pending, legacy],
    actorUid: "studio-user",
  });
  assert.deepEqual(
    result.projects.map((value) => value.content.title),
    ["pending local", "legacy local"],
  );
  assert.deepEqual(
    result.pendingProjects.map((value) => value.id),
    ["pending", "legacy"],
  );
  assert.equal(result.pendingProjects[1]._studioSync.pending, true);
});

test("a future client clock does not revive an already-synced revision", () => {
  const cloud = project("clock-skew", {
    updatedAt: "2026-09-23T12:00:00.000Z",
    content: {title: "collaborator cloud edit"},
  });
  const syncedBrowser = project("clock-skew", {
    updatedAt: "2026-09-24T12:00:00.000Z",
    content: {title: "older synced browser copy"},
    _studioSync: {
      actorUid: "studio-user",
      revision: 4,
      syncedRevision: 4,
      pending: false,
    },
  });
  const result = reconcileStudioProjects({
    cloudProjects: [cloud],
    browserProjects: [syncedBrowser],
    actorUid: "studio-user",
  });
  assert.equal(result.projects[0].content.title, "collaborator cloud edit");
  assert.deepEqual(result.pendingProjects, []);
});

test("a cloud-backed browser copy missing remotely is preserved without recreation", () => {
  const missing = project("deleted-elsewhere", {
    content: {title: "recoverable local copy"},
    _studioSync: {
      actorUid: "studio-user",
      revision: 3,
      syncedRevision: 3,
      pending: false,
    },
  });
  const result = reconcileStudioProjects({
    cloudProjects: [],
    browserProjects: [missing],
    actorUid: "studio-user",
  });
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.pendingProjects, []);
  assert.deepEqual(result.preservedBrowserProjects, [missing]);
  assert.deepEqual(result.attentionProjects, [
    {projectId: "deleted-elsewhere", reason: "cloud-project-missing"},
  ]);
});

test("a new pending browser-only project still creates after reconciliation", () => {
  const pending = markStudioProjectPending(
    project("new-local", {cloudBacked: false, ownerUid: ""}),
    "studio-user",
  );
  const result = reconcileStudioProjects({
    cloudProjects: [],
    browserProjects: [pending],
    actorUid: "studio-user",
  });
  assert.deepEqual(result.projects, [pending]);
  assert.deepEqual(result.pendingProjects, [pending]);
  assert.deepEqual(result.preservedBrowserProjects, []);
});

test("reconciliation never uploads another user's local cache", () => {
  const foreign = markStudioProjectPending(
    project("a", {ownerUid: "first-user", content: {title: "foreign"}}),
    "first-user",
  );
  const cloud = project("a", {
    ownerUid: "second-user",
    content: {title: "current cloud"},
  });
  const result = reconcileStudioProjects({
    cloudProjects: [cloud],
    browserProjects: [foreign],
    actorUid: "second-user",
  });
  assert.equal(result.projects[0].content.title, "current cloud");
  assert.deepEqual(result.pendingProjects, []);
  assert.deepEqual(result.attentionProjects, [
    {projectId: "a", reason: "identity-mismatch"},
  ]);
  assert.deepEqual(result.preservedBrowserProjects, [foreign]);
});

test("unattributed legacy browser projects are preserved without auto-upload", () => {
  const legacy = project("legacy", {
    cloudBacked: false,
    ownerUid: "",
    content: {title: "legacy browser only"},
  });
  const result = reconcileStudioProjects({
    cloudProjects: [],
    browserProjects: [legacy],
    actorUid: "studio-user",
  });
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.pendingProjects, []);
  assert.deepEqual(result.preservedBrowserProjects, [legacy]);
  assert.deepEqual(result.attentionProjects, [
    {projectId: "legacy", reason: "unattributed-browser-project"},
  ]);
});

test("coordinator rejects a pending revision from another identity", () => {
  const coordinator = createStudioSaveCoordinator({
    actorUid: "second-user",
    saveProject: async () => {},
    deleteProject: async () => {},
  });
  const foreign = markStudioProjectPending(project("a"), "first-user");
  assert.throws(
    () => coordinator.schedule(foreign),
    /Mark the Studio project pending for this user/u,
  );
});
