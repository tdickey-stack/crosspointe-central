import assert from "node:assert/strict";
import test from "node:test";

import {
  canReceiveChangeRequestNotifications,
  disconnectPumbleNotificationPreferences,
  getChangeRequestNotificationPreferences,
  getEligibleChangeRequestNotificationChannels,
  normalizeChangeRequestNotificationChannelSelection,
  normalizeChangeRequestNotificationPreferences,
  serializeChangeRequestNotificationPreferences,
} from "./preferences.js";

test("defaults existing eligible reviewers to email only", () => {
  assert.deepEqual(normalizeChangeRequestNotificationPreferences(null), {
    email: true,
    pumble: false,
  });
  assert.deepEqual(normalizeChangeRequestNotificationPreferences(null, {
    defaultEmail: false,
  }), {
    email: false,
    pumble: false,
  });
});

test("normalizes storage and endpoint channel preference shapes", () => {
  assert.deepEqual(normalizeChangeRequestNotificationPreferences({
    email: false,
    pumble: true,
  }), {
    email: false,
    pumble: true,
  });
  assert.deepEqual(normalizeChangeRequestNotificationChannelSelection({
    channels: [" PUMBLE ", "email", "email"],
  }), {
    email: true,
    pumble: true,
  });
  assert.deepEqual(serializeChangeRequestNotificationPreferences({
    email: false,
    pumble: true,
  }), {
    channels: ["pumble"],
  });
  assert.throws(
      () => normalizeChangeRequestNotificationChannelSelection(["sms"]),
      /only email or Pumble/,
  );
  assert.throws(
      () => normalizeChangeRequestNotificationChannelSelection({
        channels: "email",
      }),
      /must be an array/,
  );
});

test("disconnecting Pumble safely falls back to email", () => {
  assert.deepEqual(disconnectPumbleNotificationPreferences({
    email: false,
    pumble: true,
  }), {email: true, pumble: false});
  assert.deepEqual(disconnectPumbleNotificationPreferences({
    email: true,
    pumble: true,
  }), {email: true, pumble: false});
  assert.deepEqual(disconnectPumbleNotificationPreferences({
    email: true,
    pumble: false,
  }), {email: true, pumble: false});
});

test("reads nested Change Request preferences", () => {
  assert.deepEqual(getChangeRequestNotificationPreferences({
    notificationPreferences: {
      changeRequests: {email: false, pumble: true},
    },
  }), {
    email: false,
    pumble: true,
  });
});

test("limits recipients to active approve or admin reviewers", () => {
  assert.equal(canReceiveChangeRequestNotifications({
    active: true,
    pageAccess: {changeRequests: "approve"},
  }), true);
  assert.equal(canReceiveChangeRequestNotifications({
    active: true,
    pageAccess: {changeRequests: "admin"},
  }), true);
  assert.equal(canReceiveChangeRequestNotifications({
    active: true,
    pageAccess: {changeRequests: "view"},
  }), false);
  assert.equal(canReceiveChangeRequestNotifications({
    active: false,
    pageAccess: {changeRequests: "admin"},
  }), false);
});

test("returns only usable enabled channels", () => {
  assert.deepEqual(getEligibleChangeRequestNotificationChannels({
    active: true,
    email: "reviewer@example.com",
    pageAccess: {changeRequests: "approve"},
  }), ["email"]);

  assert.deepEqual(getEligibleChangeRequestNotificationChannels({
    active: true,
    email: "not-an-email",
    pageAccess: {changeRequests: "admin"},
    notificationPreferences: {
      changeRequests: {email: true, pumble: true},
    },
  }), ["pumble"]);
});
