import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANGE_REQUEST_REMINDER_INTERVAL_MS,
  buildChangeRequestNotificationDigest,
  buildQueuedReminderState,
  formatChangeRequestNotificationDigestText,
  getFirstChangeRequestReminderAtMs,
  getNextChangeRequestReminderAtMs,
  isChangeRequestReminderDue,
  toTimestampMs,
} from "./timing.js";

const CREATED_AT_MS = Date.parse("2026-08-27T15:00:00.000Z");

test("calculates the first and next 48-hour reminder times", () => {
  assert.equal(
      getFirstChangeRequestReminderAtMs(CREATED_AT_MS),
      CREATED_AT_MS + CHANGE_REQUEST_REMINDER_INTERVAL_MS,
  );
  assert.equal(
      getNextChangeRequestReminderAtMs(CREATED_AT_MS),
      CREATED_AT_MS + CHANGE_REQUEST_REMINDER_INTERVAL_MS,
  );
});

test("recognizes due pending requests at the exact boundary", () => {
  const dueAtMs = CREATED_AT_MS + CHANGE_REQUEST_REMINDER_INTERVAL_MS;
  const firestoreTimestamp = {toMillis: () => dueAtMs};

  assert.equal(isChangeRequestReminderDue({
    status: "pending",
    nextReminderAt: firestoreTimestamp,
  }, dueAtMs - 1), false);
  assert.equal(isChangeRequestReminderDue({
    status: "pending",
    nextReminderAt: firestoreTimestamp,
  }, dueAtMs), true);
  assert.equal(isChangeRequestReminderDue({
    status: "approved",
    nextReminderAt: firestoreTimestamp,
  }, dueAtMs), false);
  assert.equal(toTimestampMs(firestoreTimestamp), dueAtMs);
});

test("advances reminder sequence without replaying missed intervals", () => {
  const queuedAtMs = CREATED_AT_MS + (5 * CHANGE_REQUEST_REMINDER_INTERVAL_MS);
  const state = buildQueuedReminderState({reminderSequence: 2}, queuedAtMs);
  assert.deepEqual(state, {
    reminderSequence: 3,
    lastReminderQueuedAtMs: queuedAtMs,
    nextReminderAtMs: queuedAtMs + CHANGE_REQUEST_REMINDER_INTERVAL_MS,
  });
});

test("builds an oldest-first digest from safe summary fields", () => {
  const digest = buildChangeRequestNotificationDigest({
    eventType: "reminder",
    actionUrl: "https://central.crosspointe.tv/admin/change-requests",
    requests: [
      {
        id: "newer",
        status: "pending",
        summary: "Publish the banner",
        sectionLabel: "Status Banner",
        submittedByEmail: "newer@example.com",
        createdAt: CREATED_AT_MS + 1000,
        payload: {secret: "must-not-appear"},
      },
      {
        id: "older",
        status: "pending",
        summary: "Update events",
        sectionLabel: "Events",
        submittedByName: "Alex",
        createdAt: CREATED_AT_MS,
      },
      {
        id: "closed",
        status: "approved",
        summary: "Already handled",
      },
    ],
  });
  const text = formatChangeRequestNotificationDigestText(digest);

  assert.equal(digest.subject, "2 Change Requests Awaiting Review");
  assert.deepEqual(digest.items.map((item) => item.id), ["older", "newer"]);
  assert.match(text, /Update events/);
  assert.match(text, /Review Change Requests:/);
  assert.doesNotMatch(JSON.stringify(digest), /must-not-appear/);
  assert.doesNotMatch(text, /Already handled/);
});

test("bounds digest size and validates the review URL", () => {
  const requests = [1, 2, 3].map((index) => ({
    id: "request-" + String(index),
    status: "pending",
    summary: "Request " + String(index),
    createdAt: CREATED_AT_MS + index,
  }));
  const digest = buildChangeRequestNotificationDigest({
    eventType: "reminder",
    requests,
    maxItems: 2,
  });

  assert.equal(digest.items.length, 2);
  assert.equal(digest.omittedCount, 1);
  assert.throws(
      () => buildChangeRequestNotificationDigest({
        eventType: "submitted",
        requests: [requests[0]],
        actionUrl: "http://central.example.test/admin/change-requests",
      }),
      /must use HTTPS/,
  );
});
