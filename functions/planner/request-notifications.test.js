/* eslint-disable require-jsdoc, max-len */
import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlannerRequestNotificationRuntime, plannerReminderDate,
  PLANNER_NOTIFICATION_EVENTS_PATH, PLANNER_REQUESTS_PATH,
} from "./request-notifications.js";
import {
  canReceivePlannerNotifications, getPlannerNotificationPreferences,
  PLANNER_NOTIFICATION_RECIPIENT_UID as UID,
} from "./notification-preferences.js";

const USERS = "centralAdmin/root/users";
const DELETE = Symbol("delete");

function fixture() {
  const docs = new Map();
  let time = Date.parse("2026-03-08T14:00:00Z");
  let tail = Promise.resolve();
  const calls = {email: [], pumble: [], degraded: []};
  const snapshot = (path) => ({
    id: path.split("/").at(-1), exists: docs.has(path),
    data: () => structuredClone(docs.get(path)),
  });
  const update = (ref, fields) => {
    const value = {...docs.get(ref.path)};
    for (const [key, field] of Object.entries(fields)) {
      if (field === DELETE) delete value[key];
      else value[key] = structuredClone(field);
    }
    docs.set(ref.path, value);
  };
  const ref = (path) => ({
    path,
    get: async () => snapshot(path),
    create: async (data) => {
      if (docs.has(path)) throw Object.assign(new Error("exists"), {code: 6});
      docs.set(path, structuredClone(data));
    },
  });
  const collection = (path) => ({
    doc: (id) => ref(`${path}/${id}`),
    where: (field, operator, value) => {
      const query = {
        orderBy: () => query, limit: () => query,
        get: async () => ({docs: [...docs.keys()].filter((key) => {
          if (!key.startsWith(`${path}/`) || key.slice(path.length + 1).includes("/")) return false;
          const actual = docs.get(key)[field];
          return operator === "==" ? actual === value : actual <= value;
        }).map(snapshot)}),
      };
      return query;
    },
  });
  const firestore = {
    collection,
    runTransaction: async (fn) => {
      const previous = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        let wrote = false;
        return await fn({
          get: async (target) => {
            assert.equal(wrote, false, "transaction reads must precede writes");
            return snapshot(target.path);
          },
          update: (target, fields) => {
            wrote = true; update(target, fields);
          },
        });
      } finally {
        release();
      }
    },
  };
  let email = async (payload) => {
    calls.email.push(payload); return {id: "email-id"};
  };
  let pumble = async (payload) => {
    calls.pumble.push(payload); return {messageId: "pumble-id"};
  };
  const runtime = createPlannerRequestNotificationRuntime({
    firestore, fieldValue: {delete: () => DELETE}, now: () => time,
    sendEmail: (payload) => email(payload), sendPumble: (payload) => pumble(payload),
    degradeConnection: async (uid, error) => {
      calls.degraded.push({uid, error});
    },
  });
  docs.set(`${USERS}/${UID}`, {
    active: true, email: "reviewer@example.com", pageAccess: {planner: "edit"},
    notificationIntegrations: {pumble: {status: "linked", userId: "person", botId: "bot", workspaceId: "workspace"}},
  });
  docs.set(`${PLANNER_REQUESTS_PATH}/r1`, {status: "pending-review", proposedName: "Fall Event"});
  return {
    runtime, docs, calls, setTime: (value) => {
      time = value;
    }, now: () => time,
    setEmail: (value) => {
      email = value;
    }, setPumble: (value) => {
      pumble = value;
    },
    event: (id) => docs.get(`${PLANNER_NOTIFICATION_EVENTS_PATH}/${id}`),
    user: () => docs.get(`${USERS}/${UID}`),
  };
}

test("recipient is limited to the active authorized UID; preferences default on", () => {
  const user = {active: true, pageAccess: {planner: "edit"}};
  assert.equal(canReceivePlannerNotifications(UID, user), true);
  assert.equal(canReceivePlannerNotifications("another", user), false);
  assert.equal(canReceivePlannerNotifications(UID, {...user, active: false}), false);
  assert.equal(canReceivePlannerNotifications(UID, {...user, pageAccess: {planner: "view"}}), false);
  assert.deepEqual(getPlannerNotificationPreferences(user), {email: true, pumble: true, reminders: true});
  assert.deepEqual(getPlannerNotificationPreferences({notificationPreferences: {plannerRequests: {email: false, pumble: false, reminders: false}}}), {email: false, pumble: false, reminders: false});
});

test("stable enqueue deduplicates and pending submissions send both channels", async () => {
  const f = fixture();
  const id = await f.runtime.enqueue("submitted", "r1");
  assert.equal(await f.runtime.enqueue("submitted", "r1"), id);
  assert.deepEqual(await f.runtime.dispatch(id), {claimed: true, state: "complete"});
  assert.equal(f.calls.email.length, 1);
  assert.equal(f.calls.email[0].to, "reviewer@example.com");
  assert.match(f.calls.email[0].text, /Fall Event/);
  assert.equal(f.calls.pumble[0].recipientUserId, "person");
  assert.equal((await f.runtime.dispatch(id)).claimed, false);
  assert.equal(f.event(id).attempts, 1);
});

test("reviewed requests, opt-outs, removed permission and missing links are skipped", async () => {
  for (const mode of ["reviewed", "optout", "permission", "unlinked"]) {
    const f = fixture();
    if (mode === "reviewed") f.docs.get(`${PLANNER_REQUESTS_PATH}/r1`).status = "approved";
    if (mode === "optout") f.user().notificationPreferences = {plannerRequests: {email: false, pumble: false}};
    if (mode === "permission") f.user().pageAccess.planner = "view";
    if (mode === "unlinked") delete f.user().notificationIntegrations;
    const id = await f.runtime.enqueue("submitted", "r1");
    await f.runtime.dispatch(id);
    assert.equal(f.calls.pumble.length, 0, mode);
    assert.equal(f.calls.email.length, mode === "unlinked" ? 1 : 0, mode);
  }
});

test("daily reminders use Chicago calendar days across DST and skip empty or stale summaries", async () => {
  assert.equal(plannerReminderDate(Date.parse("2026-03-08T05:59:59Z")), "2026-03-07");
  assert.equal(plannerReminderDate(Date.parse("2026-03-08T06:00:00Z")), "2026-03-08");
  assert.equal(plannerReminderDate(Date.parse("2026-03-09T04:59:59Z")), "2026-03-08");
  assert.equal(plannerReminderDate(Date.parse("2026-03-09T05:00:00Z")), "2026-03-09");
  const f = fixture();
  const id = await f.runtime.enqueue("reminder");
  assert.equal(await f.runtime.enqueue("reminder"), id);
  await f.runtime.dispatch(id);
  assert.match(f.calls.email[0].subject, /1 Central Planner request awaiting review/);
  const empty = fixture();
  empty.docs.delete(`${PLANNER_REQUESTS_PATH}/r1`);
  await empty.runtime.dispatch(await empty.runtime.enqueue("reminder"));
  assert.equal(empty.calls.email.length, 0);
  const stale = fixture();
  const staleId = await stale.runtime.enqueue("reminder");
  stale.setTime(Date.parse("2026-03-09T05:00:00Z"));
  await stale.runtime.dispatch(staleId);
  assert.equal(stale.calls.email.length, 0);
  const disabled = fixture();
  disabled.user().notificationPreferences = {plannerRequests: {reminders: false}};
  await disabled.runtime.dispatch(await disabled.runtime.enqueue("reminder"));
  assert.equal(disabled.calls.email.length + disabled.calls.pumble.length, 0);
});

test("retrying a failed channel never resends the successful channel", async () => {
  const f = fixture();
  let attempts = 0;
  f.setPumble(async (message) => {
    f.calls.pumble.push(message);
    if (++attempts === 1) throw Object.assign(new Error("temporary"), {retryable: true});
    return {messageId: "recovered"};
  });
  const id = await f.runtime.enqueue("submitted", "r1");
  assert.equal((await f.runtime.dispatch(id)).state, "pending");
  f.setTime(f.event(id).nextAttemptAtMs);
  assert.equal((await f.runtime.dispatch(id)).state, "complete");
  assert.equal(f.calls.email.length, 1);
  assert.equal(f.calls.pumble.length, 2);
});

test("concurrent dispatch claims one lease; expired leases can be reclaimed", async () => {
  const f = fixture();
  let release;
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  f.setEmail(async (message) => {
    f.calls.email.push(message); entered(); await blocked; return {};
  });
  const id = await f.runtime.enqueue("submitted", "r1");
  const first = f.runtime.dispatch(id);
  await started;
  assert.deepEqual(await f.runtime.dispatch(id), {claimed: false});
  release();
  await first;
  assert.equal(f.calls.email.length, 1);
  const second = fixture();
  const secondId = await second.runtime.enqueue("submitted", "r1");
  Object.assign(second.event(secondId), {leaseId: "abandoned", attempts: 1, nextAttemptAtMs: second.now() - 1});
  assert.equal((await second.runtime.dispatch(secondId)).state, "complete");
  assert.equal(second.event(secondId).attempts, 2);
});

test("retryable delivery failure stops at eight attempts", async () => {
  const f = fixture();
  let attempts = 0;
  f.setPumble(async () => {
    attempts++; throw Object.assign(new Error("retry"), {retryable: true});
  });
  const id = await f.runtime.enqueue("submitted", "r1");
  for (let i = 0; i < 8; i++) {
    const result = await f.runtime.dispatch(id);
    assert.equal(result.state, i === 7 ? "failed" : "pending");
    if (i < 7) f.setTime(f.event(id).nextAttemptAtMs);
  }
  assert.equal(attempts, 8);
  assert.equal(f.calls.email.length, 1);
  assert.equal(f.event(id).channels.pumble.state, "failed");
});

test("HTTP 403 is permanent and degrades only a Pumble connection", async () => {
  for (const channel of ["email", "pumble"]) {
    const f = fixture();
    const error = Object.assign(new Error("forbidden"), {status: 403});
    const fail = async () => {
      throw error;
    };
    if (channel === "email") f.setEmail(fail);
    else f.setPumble(fail);
    const id = await f.runtime.enqueue("submitted", "r1");
    assert.equal((await f.runtime.dispatch(id)).state, "failed");
    assert.equal(f.event(id).channels[channel].state, "failed");
    assert.deepEqual(f.calls.degraded, channel === "pumble" ?
      [{uid: UID, error}] : []);
    assert.equal(f.event(id).channels[channel === "email" ? "pumble" : "email"].state, "sent");
  }
});

test("HTTP 429 retries without degrading a Pumble connection", async () => {
  const f = fixture();
  let count = 0;
  f.setPumble(async () => {
    if (++count === 1) throw Object.assign(new Error("rate limited"), {status: 429});
    return {messageId: "recovered"};
  });
  const id = await f.runtime.enqueue("submitted", "r1");
  assert.equal((await f.runtime.dispatch(id)).state, "pending");
  assert.equal(f.event(id).channels.pumble.state, "retry");
  assert.deepEqual(f.calls.degraded, []);
  f.setTime(f.event(id).nextAttemptAtMs);
  assert.equal((await f.runtime.dispatch(id)).state, "complete");
  assert.equal(f.calls.email.length, 1);
  assert.equal(count, 2);
  assert.deepEqual(f.calls.degraded, []);
});
