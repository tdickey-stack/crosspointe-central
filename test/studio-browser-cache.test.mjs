import assert from "node:assert/strict";
import test from "node:test";
import {createStudioBrowserCache} from "../src/studio/browser-cache.js";
import {markStudioProjectPending, applyStudioSaveSuccess} from "../src/studio/save-coordinator.js";

function memoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}
const project = (id, changes = {}) => ({id, ownerUid: "viewer", name: id, _cloudRevision: 1, cloudBacked: true, content: {title: id}, ...changes});
const pending = (input) => markStudioProjectPending(input, "viewer");
function caches(storage = memoryStorage()) {
  let clock = 1;
  const options = {storage, key: "studio:viewer", actorUid: "viewer", now: () => clock++};
  return {storage, a: createStudioBrowserCache({...options, writerId: "a"}), b: createStudioBrowserCache({...options, writerId: "b"}), reload: () => createStudioBrowserCache({...options, writerId: "reload"}).read()};
}

test("a stale tab cannot erase another tab's offline project", () => {
  const {a, b, reload} = caches();
  const p = project("p"); const q = project("q");
  a.write([p, q]);
  const initialB = b.read().projects;
  const r = pending(project("r", {cloudBacked: false, _cloudRevision: undefined}));
  a.write([r, p, q], [p, q]);
  b.write([pending({...initialB[0], name: "B's edit"}), initialB[1]], initialB);
  assert.deepEqual(new Set(reload().projects.map((item) => item.id)), new Set(["p", "q", "r"]));
});

test("competing offline drafts of one project both survive a reload", () => {
  const {a, b, reload} = caches();
  const base = project("p"); a.write([base]);
  const editA = pending({...base, name: "Tab A draft"});
  const editB = pending({...base, name: "Tab B draft"});
  a.write([editA], [base]); b.write([editB], [base]);
  const result = reload();
  assert.equal(result.projects[0].name, "Tab B draft");
  assert.equal(result.recoveryProjects[0].name, "Tab A draft");
  // Saving B acknowledges only B's exact edit, never A's competing draft.
  b.write([applyStudioSaveSuccess(editB, {...editB, _cloudRevision: 2}, {actorUid: "viewer", revision: editB._studioSync.revision})], [editB]);
  assert.equal(reload().projects[0].name, "Tab A draft");
});

test("an older tab cannot replace a newer acknowledged cloud snapshot", () => {
  const {a, b, reload} = caches();
  a.write([project("p", {_cloudRevision: 3, name: "New"})]);
  b.write([project("p", {_cloudRevision: 2, name: "Stale"})]);
  assert.equal(reload().projects[0].name, "New");
});

test("account cache migration preserves a shared project's viewer identity without cloud access", () => {
  const storage = memoryStorage();
  storage.setItem("studio:viewer", JSON.stringify([project("shared", {ownerUid: "owner", shared: true})]));
  const {reload} = caches(storage);
  const first = reload();
  assert.equal(first.projects[0].ownerUid, "owner");
  assert.equal(first.projects[0]._studioSync.actorUid, "viewer");
  assert.equal(first.projects[0]._studioSync.pending, false);
  assert.equal(storage.getItem("studio:viewer"), null);
  assert.equal(reload().projects[0].id, "shared");
});

test("failed legacy migration keeps its original durable cache", () => {
  const storage = memoryStorage();
  const legacy = JSON.stringify([project("p"), project("q")]);
  storage.setItem("studio:viewer", legacy);
  storage.setItem = () => {throw new Error("Quota exceeded");};
  const {reload} = caches(storage);
  const result = reload();
  assert.equal(result.projects.length, 2);
  assert.match(result.migrationError.message, /Quota/);
  assert.equal(storage.getItem("studio:viewer"), legacy);
});

test("deleted project stays hidden when an older tab writes its stale list", () => {
  const {a, b, reload} = caches();
  const base = project("p"); a.write([base]);
  a.remove("p"); b.write([base]);
  assert.equal(reload().projects.length, 0);
  b.write([pending({...base, name: "Unsent edit after deletion"})]);
  assert.equal(reload().projects.length, 0);
  assert.equal(reload().recoveryProjects[0].name, "Unsent edit after deletion");
});

test("loading latest can archive multiple local versions without replaying them as active edits", () => {
  const {a, reload} = caches();
  const base = project("p");
  const first = pending({...base, name: "First draft"});
  const second = pending({...base, name: "Second draft"});
  a.write([first]); a.preserveForRecovery(first); a.retireDraft(first);
  a.write([second]); a.preserveForRecovery(second); a.retireDraft(second);
  a.write([project("p", {_cloudRevision: 3})]);
  const result = reload();
  assert.equal(result.projects[0]._cloudRevision, 3);
  assert.deepEqual(new Set(result.recoveryProjects.map((item) => item.name)), new Set(["First draft", "Second draft"]));
  a.retireRecovery(first);
  assert.equal(reload().recoveryProjects.length, 1);
});

test("different accounts never enumerate each other's per-project records", () => {
  const {storage, a} = caches();
  a.write([pending(project("private"))]);
  const other = createStudioBrowserCache({storage, key: "studio:other", actorUid: "other"});
  assert.deepEqual(other.read().projects, []);
});

test("a reaccepted shared project becomes available offline after an authoritative restore", () => {
  const {a, reload} = caches();
  const shared = project("shared", {ownerUid: "owner", shared: true});
  a.write([shared]); a.remove(shared.id);
  a.write([{...shared, _cloudRevision: 2}]);
  assert.equal(reload().projects.length, 0);
  a.restore([{...shared, _cloudRevision: 2}]);
  assert.equal(reload().projects[0].id, shared.id);
});

test("a legacy pending create receives a draft identity and retires after successful sync", () => {
  const storage = memoryStorage();
  const legacy = project("new", {cloudBacked: false, _cloudRevision: undefined,
    _studioSync: {actorUid: "viewer", revision: 1, syncedRevision: 0, pending: true}});
  storage.setItem("studio:viewer", JSON.stringify([legacy]));
  const {a, reload} = caches(storage);
  const draft = a.read().projects[0];
  assert.ok(draft._studioSync.changeId);
  a.write([applyStudioSaveSuccess(draft, {...draft, cloudBacked: true, _cloudRevision: 1}, {actorUid: "viewer", revision: 1})], [draft]);
  assert.equal(reload().projects[0]._studioSync.pending, false);
  assert.equal(reload().recoveryProjects.length, 0);
});
