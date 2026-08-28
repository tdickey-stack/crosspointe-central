import assert from "node:assert/strict";
import test from "node:test";

import {createAdminNotificationPreferencesHandler} from "./admin-handler.js";

test("atomically saves the Notifications page preferences", async () => {
  const userData = {
    active: true,
    pageAccess: {changeRequests: "approve", serveNeeds: "view"},
    notificationPreferences: {
      changeRequests: {email: true, pumble: false},
      serveNeeds: {pumble: false},
    },
    notificationIntegrations: {
      pumble: {
        status: "linked",
        userId: "pumble-user",
        botId: "pumble-bot",
        workspaceId: "workspace-1",
      },
    },
  };
  let update = null;
  const snapshot = {
    exists: true,
    data: () => userData,
    get: (field) => userData[field],
  };
  const handler = createAdminNotificationPreferencesHandler({
    firestore: {
      doc: (path) => ({path}),
      runTransaction: async (callback) => callback({
        get: async () => snapshot,
        update: (reference, value) => {
          update = {reference, value};
        },
      }),
    },
    fieldValue: {serverTimestamp: () => "server-time"},
    verifyAdmin: async () => ({uid: "admin-unified"}),
    getUserDocPath: (uid) => `adminUsers/${uid}`,
    serializePumbleConnection: () => ({linked: true}),
  });
  const response = createResponse_();

  await handler({
    method: "POST",
    body: {
      notificationPreferences: {
        changeRequests: {email: false, pumble: true},
        serveNeeds: {pumble: true},
      },
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, "Notification preferences saved.");
  assert.deepEqual(response.body.preferences.channels, ["pumble"]);
  assert.deepEqual(response.body.pumbleNotifications, {
    changeRequests: true,
    serveNeeds: true,
  });
  assert.equal(update.reference.path, "adminUsers/admin-unified");
  assert.deepEqual(
      update.value["notificationPreferences.changeRequests"],
      {email: false, pumble: true},
  );
  assert.equal(
      update.value["notificationPreferences.serveNeeds.pumble"],
      true,
  );
});

test("unified preferences require one Change Request channel", async () => {
  const userData = {
    active: true,
    pageAccess: {changeRequests: "approve"},
  };
  const snapshot = {
    exists: true,
    data: () => userData,
    get: (field) => userData[field],
  };
  const handler = createAdminNotificationPreferencesHandler({
    firestore: {
      doc: (path) => ({path}),
      runTransaction: async (callback) => callback({
        get: async () => snapshot,
        update: () => assert.fail("Invalid preferences must not be saved."),
      }),
    },
    fieldValue: {serverTimestamp: () => "server-time"},
    verifyAdmin: async () => ({uid: "admin-no-channel"}),
    getUserDocPath: (uid) => `adminUsers/${uid}`,
    serializePumbleConnection: () => ({linked: false}),
  });
  const response = createResponse_();

  await handler({
    method: "POST",
    body: {
      notificationPreferences: {
        changeRequests: {email: false, pumble: false},
      },
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "notification-channel-required");
});

test(
    "saves Pumble event preferences with Change Request email fallback",
    async () => {
      const userData = {
        active: true,
        pageAccess: {changeRequests: "approve", serveNeeds: "view"},
        notificationPreferences: {
          changeRequests: {email: false, pumble: true},
          serveNeeds: {pumble: false},
        },
        notificationIntegrations: {
          pumble: {
            status: "linked",
            userId: "pumble-user",
            botId: "pumble-bot",
            workspaceId: "workspace-1",
          },
        },
      };
      let update = null;
      const snapshot = {
        exists: true,
        data: () => userData,
        get: (field) => userData[field],
      };
      const handler = createAdminNotificationPreferencesHandler({
        firestore: {
          doc: (path) => ({path}),
          runTransaction: async (callback) => callback({
            get: async () => snapshot,
            update: (reference, value) => {
              update = {reference, value};
            },
          }),
        },
        fieldValue: {serverTimestamp: () => "server-time"},
        verifyAdmin: async () => ({uid: "admin-1"}),
        getUserDocPath: (uid) => `adminUsers/${uid}`,
        serializePumbleConnection: (value) => ({
          linked: value.notificationIntegrations.pumble.status === "linked",
        }),
      });
      const response = createResponse_();

      await handler({
        method: "POST",
        body: {
          pumbleNotifications: {changeRequests: false, serveNeeds: true},
        },
      }, response);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.ok, true);
      assert.deepEqual(response.body.pumbleNotifications, {
        changeRequests: false,
        serveNeeds: true,
      });
      assert.equal(update.reference.path, "adminUsers/admin-1");
      assert.deepEqual(
          update.value["notificationPreferences.changeRequests"],
          {email: true, pumble: false},
      );
      assert.equal(
          update.value["notificationPreferences.serveNeeds.pumble"],
          true,
      );
    },
);

test(
    "rejects a Pumble event type outside the Admin user's access",
    async () => {
      const userData = {
        active: true,
        pageAccess: {changeRequests: "view", serveNeeds: "none"},
        notificationIntegrations: {
          pumble: {
            status: "linked",
            userId: "pumble-user",
            botId: "pumble-bot",
            workspaceId: "workspace-1",
          },
        },
      };
      const handler = createAdminNotificationPreferencesHandler({
        firestore: {
          doc: (path) => ({path}),
          runTransaction: async (callback) => callback({
            get: async () => ({
              exists: true,
              data: () => userData,
              get: (field) => userData[field],
            }),
            update: () => assert.fail(
                "Forbidden preferences must not be saved.",
            ),
          }),
        },
        fieldValue: {serverTimestamp: () => "server-time"},
        verifyAdmin: async () => ({uid: "admin-2"}),
        getUserDocPath: (uid) => `adminUsers/${uid}`,
        serializePumbleConnection: () => ({linked: true}),
      });
      const response = createResponse_();

      await handler({
        method: "POST",
        body: {
          pumbleNotifications: {changeRequests: false, serveNeeds: true},
        },
      }, response);

      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "notification-type-forbidden");
      assert.deepEqual(response.body.eligibility, {
        changeRequests: false,
        serveNeeds: false,
      });
    },
);

/**
 * Creates a minimal Express response recorder.
 *
 * @return {Object} Response recorder.
 */
function createResponse_() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}
