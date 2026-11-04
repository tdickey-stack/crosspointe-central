import assert from "node:assert/strict";
import test from "node:test";
import {disconnectPlannerNotificationPreferences} from
  "./notification-preferences.js";

test("disconnect preserves opt-outs and restores email fallback", () => {
  const preferences = (value) => ({
    notificationPreferences: {plannerRequests: value},
  });
  assert.deepEqual(disconnectPlannerNotificationPreferences(preferences({
    email: false, pumble: true, reminders: false,
  })), {email: true, pumble: false, reminders: false});
  assert.deepEqual(disconnectPlannerNotificationPreferences(preferences({
    email: false, pumble: false, reminders: true,
  })), {email: false, pumble: false, reminders: true});
});
