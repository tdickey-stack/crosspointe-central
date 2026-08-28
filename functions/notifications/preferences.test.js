import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminPumbleNotificationEligibility,
  getAdminPumbleNotificationPreferences,
  getEligibleServeNeedPumbleRecipient,
  normalizeAdminPumbleNotificationSelection,
} from "./preferences.js";

test("reads event-specific Pumble preferences", () => {
  assert.deepEqual(getAdminPumbleNotificationPreferences({
    notificationPreferences: {
      changeRequests: {email: true, pumble: true},
      serveNeeds: {pumble: true},
    },
  }), {
    changeRequests: true,
    serveNeeds: true,
  });
});

test("limits notification types to the user's event permissions", () => {
  assert.deepEqual(getAdminPumbleNotificationEligibility({
    active: true,
    pageAccess: {changeRequests: "approve", serveNeeds: "view"},
  }), {
    changeRequests: true,
    serveNeeds: true,
  });
  assert.deepEqual(getAdminPumbleNotificationEligibility({
    active: true,
    pageAccess: {changeRequests: "view", serveNeeds: "none"},
  }), {
    changeRequests: false,
    serveNeeds: false,
  });
  assert.equal(getAdminPumbleNotificationEligibility({
    active: true,
    pageAccess: {settings: "edit"},
  }).serveNeeds, true);
});

test("validates the complete Pumble selection contract", () => {
  assert.deepEqual(normalizeAdminPumbleNotificationSelection({
    changeRequests: true,
    serveNeeds: false,
  }), {
    changeRequests: true,
    serveNeeds: false,
  });
  assert.throws(
      () => normalizeAdminPumbleNotificationSelection({serveNeeds: true}),
      /must include Change Requests and Serve Needs/,
  );
});

test("Serve Needs recipients must be eligible, opted in, and linked", () => {
  const recipient = getEligibleServeNeedPumbleRecipient("user-1", {
    active: true,
    displayName: "Admin User",
    pageAccess: {serveNeeds: "view"},
    notificationPreferences: {serveNeeds: {pumble: true}},
    notificationIntegrations: {
      pumble: {
        status: "linked",
        userId: "pumble-user",
        botId: "pumble-bot",
        workspaceId: "workspace-1",
      },
    },
  });
  assert.deepEqual(recipient, {
    uid: "user-1",
    displayName: "Admin User",
    pumbleUserId: "pumble-user",
    pumbleBotUserId: "pumble-bot",
  });
  assert.equal(getEligibleServeNeedPumbleRecipient("user-2", {
    active: true,
    pageAccess: {serveNeeds: "view"},
    notificationPreferences: {serveNeeds: {pumble: false}},
  }), null);
});
