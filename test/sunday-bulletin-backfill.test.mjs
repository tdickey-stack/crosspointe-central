import test from "node:test";
import assert from "node:assert/strict";
import {createBackfillCore} from "../scripts/sunday-bulletin-backfill-core.mjs";

function fixture() {
  const records = new Map();
  const writes = [];
  const doc = (path) => ({id: path.split("/").at(-1), path, get: async () => snapshot(path)});
  const snapshot = (path) => ({id: path.split("/").at(-1), exists: records.has(path), data: () => records.get(path)});
  const versions = {doc: (id) => doc(`versions/${id}`)};
  const plays = {
    doc: (id) => doc(`plays/${id}`),
    where: (_field, _operator, campaignId) => ({campaignId, get: async () => query(campaignId)}),
  };
  const query = (campaignId) => ({docs: [...records].filter(([path, value]) => path.startsWith("plays/") && value.campaignId === campaignId).map(([path]) => snapshot(path))});
  const transaction = {
    get: async (reference) => reference.campaignId ? query(reference.campaignId) : snapshot(reference.path),
    create: (reference, data) => { assert.equal(records.has(reference.path), false); records.set(reference.path, data); writes.push({path: reference.path, data}); },
  };
  const serverTimestamp = {sentinel: "server-time"};
  const admin = {firestore: {FieldValue: {serverTimestamp: () => serverTimestamp}, Timestamp: {fromDate: (date) => ({iso: date.toISOString()})}}};
  const core = createBackfillCore({admin, versions, plays, clock: () => new Date("2026-11-04T15:00:00Z")});
  const campaign = {name: "Youthsgiving", status: "active", campaignType: "event", level: 3, eventDate: "2026-11-08", registrationDeadline: null, playbookId: "level-3", playbookVersion: 2};
  const playbook = {durationWeeks: 1, weeks: [{weekNumber: 1, plays: [{id: "bulletin", resourceId: "weekly-bulletin", playType: "Weekly Bulletin Mention", channel: "Weekly Bulletin", dayOfWeek: 0, eligibleWeekdays: [0], requirement: "optional"}]}]};
  records.set("campaigns/youth", campaign);
  records.set("versions/level-3_v2", playbook);
  return {records, writes, transaction, core, campaign, playbook, reference: doc("campaigns/youth"), serverTimestamp};
}

test("apply reads pinned version and creates exactly one canonical record with full metadata", async () => {
  const f = fixture();
  f.records.set("versions/level-3_v3", {...f.playbook, weeks: []});
  const result = await f.core.inspect(f.reference, f.transaction);
  assert.equal(result.action, "added");
  assert.equal(f.writes.length, 1);
  const {path, data} = f.writes[0];
  assert.match(path, /^plays\/youth_level-3_edit_[a-z0-9]+$/);
  assert.deepEqual(data, {
    schemaVersion: 1, campaignId: "youth", campaignName: "Youthsgiving", campaignLevel: 3,
    campaignType: "event", playbookId: "level-3", playbookVersion: 2,
    templatePlayId: "event-day-bulletin", weekNumber: 1, phase: "Event day",
    playType: "Weekly Bulletin Mention", channel: "Weekly Bulletin", resourceId: "weekly-bulletin",
    originalScheduledDate: {iso: "2026-11-08T12:00:00.000Z"}, scheduledDate: {iso: "2026-11-08T12:00:00.000Z"},
    eligibleWeekdays: [0], status: "scheduled", requirement: "optional", lateBehavior: "SKIP",
    source: "campaign-generation", manuallyAdjusted: false, locked: false,
    conflictState: "none", conflictReason: "", lateReason: "", supportsSmuggle: false,
    smuggle: null, createdByUid: "planner-sunday-bulletin-backfill", updatedByUid: "planner-sunday-bulletin-backfill",
    createdAt: f.serverTimestamp, updatedAt: f.serverTimestamp,
  });
  assert.equal((await f.core.inspect(f.reference, f.transaction)).action, "skip");
  assert.equal(f.writes.length, 1);
});

test("saved same-day, moved, skipped, and canonical collision records prevent creation", async () => {
  for (const play of [
    {campaignId: "youth", resourceId: "weekly-bulletin", scheduledDate: "2026-11-08", status: "completed"},
    {campaignId: "youth", resourceId: "weekly-bulletin", scheduledDate: "2026-11-08", status: "skipped"},
    {campaignId: "youth", resourceId: "weekly-bulletin", scheduledDate: "2026-11-01", templatePlayId: "event-day-bulletin", status: "rescheduled"},
  ]) {
    const f = fixture();
    f.records.set("plays/existing", play);
    assert.equal((await f.core.inspect(f.reference, f.transaction)).action, "skip");
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.records.get("plays/existing"), play);
  }
  const f = fixture();
  await f.core.inspect(f.reference, f.transaction);
  const path = f.writes[0].path;
  f.records.set(path, {campaignId: "different"});
  f.writes.length = 0;
  assert.equal((await f.core.inspect(f.reference, f.transaction)).action, "skip");
  assert.equal(f.writes.length, 0);
});

test("apply rechecks changes after a dry run and refuses missing pinned playbooks", async () => {
  for (const change of [
    (f) => { f.campaign.status = "archived"; },
    (f) => { f.campaign.registrationDeadline = "2026-11-07"; },
    (f) => { f.records.delete("versions/level-3_v2"); },
    (f) => { f.records.set("plays/new", {campaignId: "youth", resourceId: "weekly-bulletin", scheduledDate: "2026-11-08"}); },
  ]) {
    const f = fixture();
    assert.equal((await f.core.inspect(f.reference)).action, "add");
    change(f);
    assert.equal((await f.core.inspect(f.reference, f.transaction)).action, "skip");
    assert.equal(f.writes.length, 0);
  }
});
