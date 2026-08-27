/* eslint-disable require-jsdoc */
import assert from "node:assert/strict";
import test from "node:test";

import {buildChangeRequestNotificationDeliveryId} from "./ids.js";
import {
  canClaimChangeRequestNotificationEvent,
  CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH,
  CHANGE_REQUEST_REVIEWERS_PATH,
  CHANGE_REQUESTS_PATH,
  createChangeRequestNotificationRuntime,
  serializeChangeRequestNotificationReviewer,
} from "./runtime.js";
import {CHANGE_REQUEST_REMINDER_INTERVAL_MS} from "./timing.js";

class TestTimestamp {
  constructor(milliseconds) {
    this.milliseconds = milliseconds;
  }

  toMillis() {
    return this.milliseconds;
  }

  valueOf() {
    return this.milliseconds;
  }
}

class MemoryDocumentSnapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = value !== undefined;
    this.value = value;
  }

  data() {
    return this.value;
  }
}

class MemoryDocumentReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
    this.id = path.split("/").at(-1);
  }

  async get() {
    return new MemoryDocumentSnapshot(
        this,
        this.firestore.documents.get(this.path),
    );
  }

  collection(name) {
    return this.firestore.collection(this.path + "/" + name);
  }
}

class MemoryQuery {
  constructor(firestore, path, filters = [], order = null, maximum = null) {
    this.firestore = firestore;
    this.path = path;
    this.filters = filters;
    this.order = order;
    this.maximum = maximum;
  }

  where(field, operator, value) {
    return new MemoryQuery(
        this.firestore,
        this.path,
        [...this.filters, {field, operator, value}],
        this.order,
        this.maximum,
    );
  }

  orderBy(field) {
    return new MemoryQuery(
        this.firestore,
        this.path,
        this.filters,
        field,
        this.maximum,
    );
  }

  limit(maximum) {
    return new MemoryQuery(
        this.firestore,
        this.path,
        this.filters,
        this.order,
        maximum,
    );
  }

  async get() {
    return this.firestore.readQuery(this);
  }
}

class MemoryCollectionReference extends MemoryQuery {
  doc(id) {
    const documentId = id || "auto-" + String(++this.firestore.nextId);
    return new MemoryDocumentReference(
        this.firestore,
        this.path + "/" + documentId,
    );
  }
}

class MemoryFirestore {
  constructor() {
    this.documents = new Map();
    this.nextId = 0;
  }

  collection(path) {
    return new MemoryCollectionReference(this, path);
  }

  seed(path, value) {
    this.documents.set(path, value);
  }

  read(path) {
    return this.documents.get(path);
  }

  readCollection(path) {
    return [...this.documents.entries()].filter(([documentPath]) => {
      if (!documentPath.startsWith(path + "/")) return false;
      return !documentPath.slice(path.length + 1).includes("/");
    }).map(([documentPath, value]) => {
      return new MemoryDocumentSnapshot(
          new MemoryDocumentReference(this, documentPath),
          value,
      );
    });
  }

  readQuery(query) {
    let docs = this.readCollection(query.path).filter((doc) => {
      return query.filters.every((filter) => {
        const actual = doc.data()[filter.field];
        const left = comparable_(actual);
        const right = comparable_(filter.value);
        if (filter.operator === "==") return left === right;
        if (filter.operator === "<=") return left <= right;
        throw new Error("Unsupported test query operator: " + filter.operator);
      });
    });
    if (query.order) {
      docs = docs.sort((left, right) => {
        return comparable_(left.data()[query.order]) -
          comparable_(right.data()[query.order]);
      });
    }
    if (Number.isInteger(query.maximum)) docs = docs.slice(0, query.maximum);
    return {docs, empty: docs.length === 0, size: docs.length};
  }

  async runTransaction(callback) {
    const writes = [];
    const transaction = {
      get: async (target) => {
        if (target instanceof MemoryQuery) return target.get();
        return target.get();
      },
      set: (ref, value) => writes.push({type: "set", ref, value}),
      update: (ref, value) => writes.push({type: "update", ref, value}),
    };
    const result = await callback(transaction);
    writes.forEach((write) => {
      const current = this.documents.get(write.ref.path) || {};
      this.documents.set(
          write.ref.path,
          write.type === "update" ? {...current, ...write.value} : write.value,
      );
    });
    return result;
  }
}

function comparable_(value) {
  return value && typeof value.toMillis === "function" ?
    value.toMillis() : value;
}

function timestamp_(value) {
  return new TestTimestamp(
      typeof value === "number" ? value : new Date(value).getTime(),
  );
}

function createRuntime_(firestore, overrides = {}) {
  let leaseSequence = 0;
  return createChangeRequestNotificationRuntime({
    firestore,
    timestampFromMillis: (milliseconds) => timestamp_(milliseconds),
    now: () => typeof overrides.now === "function" ? overrides.now() :
      new Date("2026-08-27T12:00:00.000Z"),
    createLeaseId: () => "lease-" + String(++leaseSequence),
    actionUrl: "https://central.crosspointe.church/admin?section=changes",
    ...overrides,
  });
}

function request_(overrides = {}) {
  return {
    status: "pending",
    summary: "Update the event title",
    section: "Events",
    submittedByName: "Pat Requester",
    createdAt: timestamp_("2026-08-20T12:00:00.000Z"),
    nextReminderAt: timestamp_("2026-08-27T11:00:00.000Z"),
    payload: {secretInternalField: "must not enter notifications"},
    ...overrides,
  };
}

function reviewer_(permission, overrides = {}) {
  return {
    active: true,
    email: permission + "@example.com",
    displayName: permission + " reviewer",
    pageAccess: {changeRequests: permission},
    ...overrides,
  };
}

function assertNoMillisecondFields_(value, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(
        key.endsWith("AtMs"),
        false,
        path + "." + key + " must not be persisted",
    );
    assertNoMillisecondFields_(child, path + "." + key);
  }
}

test("requires a linked user and bot ID before scheduling Pumble delivery",
    () => {
      const base = reviewer_("approve", {
        notificationPreferences: {
          changeRequests: {email: false, pumble: true},
        },
      });
      assert.deepEqual(
          serializeChangeRequestNotificationReviewer("reviewer-1", base)
              .channels,
          [],
      );
      const linked = serializeChangeRequestNotificationReviewer(
          "reviewer-1",
          {
            ...base,
            notificationIntegrations: {
              pumble: {
                status: "linked",
                userId: "user-1",
                botId: "bot-1",
                workspaceId: "workspace-1",
              },
            },
          },
      );
      assert.deepEqual(linked.channels, ["pumble"]);
      assert.equal(linked.pumbleUserId, "user-1");
      assert.equal(linked.pumbleBotUserId, "bot-1");
    });

test("queues a bounded reminder digest and advances requests", async () => {
  const firestore = new MemoryFirestore();
  for (let index = 0; index < 51; index += 1) {
    firestore.seed(
        CHANGE_REQUESTS_PATH + "/due-" + String(index).padStart(2, "0"),
        request_({
          summary: "Due request " + String(index),
          nextReminderAt: timestamp_(
              new Date("2026-08-27T10:00:00.000Z").getTime() + index,
          ),
        }),
    );
  }
  firestore.seed(
      CHANGE_REQUESTS_PATH + "/future",
      request_({nextReminderAt: timestamp_("2026-08-28T12:00:00.000Z")}),
  );
  firestore.seed(
      CHANGE_REQUESTS_PATH + "/approved",
      request_({status: "approved"}),
  );

  const result = await createRuntime_(firestore).queueDueReminderDigest();

  assert.equal(result.queued, true);
  assert.equal(result.requestCount, 50);
  assert.equal(result.requestIds.includes("due-50"), false);
  const event = firestore.read(
      CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + result.eventId,
  );
  assert.equal(event.eventType, "reminder");
  assert.equal(event.status, "pending");
  assert.equal(event.digest.items.length, 12);
  assert.equal(event.digest.omittedCount, 38);
  assert.equal("payload" in event.digest.items[0], false);
  assert.equal(event.dueAt instanceof TestTimestamp, true);
  assertNoMillisecondFields_(event);

  for (const requestId of result.requestIds) {
    const request = firestore.read(CHANGE_REQUESTS_PATH + "/" + requestId);
    assert.equal(request.reminderSequence, 1);
    assert.equal(
        request.nextReminderAt.toMillis(),
        new Date("2026-08-27T12:00:00.000Z").getTime() +
          CHANGE_REQUEST_REMINDER_INTERVAL_MS,
    );
    assert.equal(request.lastReminderQueuedAt instanceof TestTimestamp, true);
    assertNoMillisecondFields_(request);
  }
  assert.equal(
      firestore.read(CHANGE_REQUESTS_PATH + "/due-50").reminderSequence,
      undefined,
  );
  assert.equal(
      firestore.read(CHANGE_REQUESTS_PATH + "/future").reminderSequence,
      undefined,
  );
  assert.equal(
      firestore.read(CHANGE_REQUESTS_PATH + "/approved").reminderSequence,
      undefined,
  );
});

test("dispatches channels independently and retries failures", async () => {
  const firestore = new MemoryFirestore();
  let nowMs = new Date("2026-08-27T12:00:00.000Z").getTime();
  const eventId = "submitted-event";
  firestore.seed(CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId, {
    eventType: "submitted",
    status: "pending",
    requestIds: ["pending", "approved", "missing"],
    dueAt: timestamp_(nowMs),
    attemptCount: 0,
  });
  firestore.seed(CHANGE_REQUESTS_PATH + "/pending", request_());
  firestore.seed(
      CHANGE_REQUESTS_PATH + "/approved",
      request_({status: "approved", summary: "Already handled"}),
  );
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/email-default",
      reviewer_("approve", {email: "default@example.com"}),
  );
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/both",
      reviewer_("admin", {
        email: "both@example.com",
        notificationPreferences: {
          changeRequests: {email: true, pumble: true},
        },
        notificationIntegrations: {
          pumble: {
            status: "linked",
            userId: "user-both",
            botId: "bot-1",
            workspaceId: "workspace-1",
          },
        },
      }),
  );
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/viewer",
      reviewer_("view", {
        notificationPreferences: {
          changeRequests: {email: true, pumble: true},
        },
      }),
  );
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/inactive",
      reviewer_("approve", {active: false}),
  );
  const obsoleteId = buildChangeRequestNotificationDeliveryId({
    eventId,
    recipientUid: "inactive",
    channel: "email",
  });
  const obsoletePath = CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" +
    eventId + "/deliveries/" + obsoleteId;
  firestore.seed(obsoletePath, {
    status: "retry",
    attemptCount: 1,
    nextAttemptAt: timestamp_(nowMs),
    lastAttemptAt: timestamp_(nowMs - 1000),
  });

  const calls = [];
  let failBothEmail = true;
  const runtime = createRuntime_(firestore, {
    now: () => new Date(nowMs),
    deliveryRetryBaseMs: 1000,
    deliveryRetryMaxMs: 10000,
    sendEmail: async (input) => {
      calls.push({channel: "email", input});
      const claimedEvent = firestore.read(
          CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId,
      );
      assert.equal(
          claimedEvent.dueAt.toMillis(),
          claimedEvent.leaseUntil.toMillis(),
      );
      assert.equal(claimedEvent.dueAt.toMillis() > nowMs, true);
      assert.equal(
          JSON.stringify(input.digest).includes("secretInternalField"),
          false,
      );
      assert.equal(input.digest.actionUrl.includes("request=pending"), true);
      if (input.recipient.email === "both@example.com" && failBothEmail) {
        const error = new Error("Temporary mail outage");
        error.status = 503;
        throw error;
      }
      return {messageId: "email-" + input.recipient.uid};
    },
    sendPumble: async (input) => {
      calls.push({channel: "pumble", input});
      return {id: "pumble-" + input.recipient.uid};
    },
  });

  const first = await runtime.dispatchEvent(eventId);

  assert.deepEqual(
      {
        dispatched: first.dispatched,
        requestCount: first.requestCount,
        deliveryCount: first.deliveryCount,
        sentCount: first.sentCount,
        failedCount: first.failedCount,
        status: first.status,
      },
      {
        dispatched: true,
        requestCount: 1,
        deliveryCount: 4,
        sentCount: 2,
        failedCount: 0,
        status: "pending",
      },
  );
  assert.equal(calls.filter((call) => call.channel === "email").length, 2);
  assert.equal(calls.filter((call) => call.channel === "pumble").length, 1);
  const pumbleCall = calls.find((call) => call.channel === "pumble");
  assert.equal(pumbleCall.input.recipient.pumbleUserId, "user-both");
  assert.equal(pumbleCall.input.recipient.pumbleBotUserId, "bot-1");
  assert.equal(
      calls.some((call) => call.input.recipient.uid === "viewer"),
      false,
  );
  assert.equal(
      calls.some((call) => call.input.recipient.uid === "inactive"),
      false,
  );
  assert.equal(firestore.read(obsoletePath).status, "canceled");
  assert.equal(
      firestore.read(obsoletePath).lastErrorCode,
      "recipient-no-longer-eligible",
  );

  const retryId = buildChangeRequestNotificationDeliveryId({
    eventId,
    recipientUid: "both",
    channel: "email",
  });
  const retryPath = CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId +
    "/deliveries/" + retryId;
  const retryDelivery = firestore.read(retryPath);
  assert.equal(retryDelivery.status, "retry");
  assert.equal(retryDelivery.nextAttemptAt.toMillis(), nowMs + 1000);
  assert.equal(retryDelivery.lastAttemptAt.toMillis(), nowMs);
  assertNoMillisecondFields_(retryDelivery);
  const pendingEvent = firestore.read(
      CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId,
  );
  assert.equal(pendingEvent.status, "pending");
  assert.equal(pendingEvent.dueAt.toMillis(), nowMs + 1000);
  assertNoMillisecondFields_(pendingEvent);

  nowMs += 1000;
  failBothEmail = false;
  const second = await runtime.dispatchNextEvent();

  assert.equal(second.dispatched, true);
  assert.equal(second.status, "complete");
  assert.equal(second.sentCount, 3);
  assert.equal(second.deliveryCount, 4);
  assert.equal(calls.filter((call) => call.channel === "email").length, 3);
  assert.equal(calls.filter((call) => call.channel === "pumble").length, 1);
  assert.equal(firestore.read(retryPath).status, "sent");
  assert.equal(firestore.read(retryPath).lastAttemptAt.toMillis(), nowMs);
  assert.equal(
      firestore.read(
          CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId,
      ).status,
      "complete",
  );
});

test("missing transport fails one delivery and completes event", async () => {
  const firestore = new MemoryFirestore();
  const now = new Date("2026-08-27T12:00:00.000Z");
  const eventId = "pumble-only-event";
  firestore.seed(CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId, {
    eventType: "submitted",
    status: "pending",
    requestId: "request-1",
    dueAt: timestamp_(now),
  });
  firestore.seed(CHANGE_REQUESTS_PATH + "/request-1", request_());
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/pumble-only",
      reviewer_("approve", {
        email: "pumble@example.com",
        notificationPreferences: {
          changeRequests: {email: false, pumble: true},
        },
        notificationIntegrations: {
          pumble: {
            status: "linked",
            userId: "user-pumble-only",
            botId: "bot-1",
            workspaceId: "workspace-1",
          },
        },
      }),
  );

  const result = await createRuntime_(firestore, {now: () => now})
      .dispatchEvent(eventId);

  assert.equal(result.status, "complete");
  assert.equal(result.failedCount, 1);
  const deliveriesPath = CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" +
    eventId + "/deliveries";
  const [delivery] = firestore.readCollection(deliveriesPath);
  assert.equal(delivery.data().status, "failed");
  assert.equal(
      delivery.data().lastErrorCode,
      "notification-transport-not-configured",
  );
  assert.equal(delivery.data().failedAt instanceof TestTimestamp, true);
  assertNoMillisecondFields_(delivery.data());
});

test("omits missing and nonpending requests", async () => {
  const firestore = new MemoryFirestore();
  const now = new Date("2026-08-27T12:00:00.000Z");
  const eventId = "obsolete-event";
  firestore.seed(CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId, {
    eventType: "submitted",
    status: "pending",
    requestIds: ["approved", "missing"],
    dueAt: timestamp_(now),
  });
  firestore.seed(
      CHANGE_REQUESTS_PATH + "/approved",
      request_({status: "approved"}),
  );
  firestore.seed(
      CHANGE_REQUEST_REVIEWERS_PATH + "/admin",
      reviewer_("admin"),
  );
  const existingDeliveryPath = CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" +
    eventId + "/deliveries/existing-retry";
  firestore.seed(existingDeliveryPath, {
    status: "retry",
    nextAttemptAt: timestamp_(now),
    leaseId: "",
    leaseUntil: null,
  });

  const result = await createRuntime_(firestore, {
    now: () => now,
    sendEmail: async () => assert.fail("No notification should be sent."),
  }).dispatchEvent(eventId);

  assert.equal(result.status, "complete");
  assert.equal(result.reason, "no-pending-requests");
  assert.equal(result.deliveryCount, 1);
  const event = firestore.read(
      CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH + "/" + eventId,
  );
  assert.equal(event.status, "complete");
  assert.equal(event.deliveryCount, 1);
  assert.equal(firestore.read(existingDeliveryPath).status, "canceled");
  assert.equal(
      firestore.read(existingDeliveryPath).lastErrorCode,
      "request-no-longer-pending",
  );
});

test("event claims recover after an expired lease", () => {
  const nowMs = new Date("2026-08-27T12:00:00.000Z").getTime();
  assert.equal(canClaimChangeRequestNotificationEvent({
    status: "pending",
    dueAt: timestamp_(nowMs),
    leaseId: "worker-a",
    leaseUntil: timestamp_(nowMs + 1000),
  }, nowMs), false);
  assert.equal(canClaimChangeRequestNotificationEvent({
    status: "pending",
    dueAt: timestamp_(nowMs),
    leaseId: "worker-a",
    leaseUntil: timestamp_(nowMs),
  }, nowMs), true);
  assert.equal(canClaimChangeRequestNotificationEvent({
    status: "complete",
    dueAt: timestamp_(nowMs),
  }, nowMs), false);
});
