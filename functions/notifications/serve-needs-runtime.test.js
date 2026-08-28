import assert from "node:assert/strict";
import test from "node:test";

import {createServeNeedPumbleNotificationRuntime} from
  "./serve-needs-runtime.js";

test(
    "delivers Serve Needs responses only to eligible opted-in Admins",
    async () => {
      const sends = [];
      const writes = [];
      const users = [
        createUserSnapshot_("recipient-1", {
          active: true,
          displayName: "Serve Admin",
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
        }),
        createUserSnapshot_("not-opted-in", {
          active: true,
          pageAccess: {serveNeeds: "edit"},
          notificationPreferences: {serveNeeds: {pumble: false}},
        }),
      ];
      const runtime = createServeNeedPumbleNotificationRuntime({
        firestore: {
          collection: (path) => {
            if (path === "adminUsers") {
              return {
                where: (field, operator, value) => {
                  assert.deepEqual([field, operator, value], [
                    "active",
                    "==",
                    true,
                  ]);
                  return {get: async () => ({docs: users})};
                },
              };
            }
            assert.equal(path, "serveNeedInterests");
            return {
              doc: (id) => ({
                set: async (value, options) => {
                  writes.push({id, value, options});
                },
              }),
            };
          },
        },
        fieldValue: {
          serverTimestamp: () => "server-time",
          delete: () => "delete-field",
        },
        transport: {
          send: async (message) => {
            sends.push(message);
            return {messageId: "message-1"};
          },
        },
        degradeConnection: async () => {
          assert.fail("A successful delivery must not degrade the connection.");
        },
        usersCollectionPath: "adminUsers",
        interestsCollectionPath: "serveNeedInterests",
        timeZone: "America/Chicago",
      });

      await runtime.notify("interest-1", {
        serveNeedNeed: "Production Team",
        name: "Taylor Example",
        email: "taylor@example.com",
      });

      assert.equal(sends.length, 1);
      assert.equal(sends[0].recipientUserId, "pumble-user");
      assert.equal(sends[0].botUserId, "pumble-bot");
      assert.match(sends[0].text, /Production Team/);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].id, "interest-1");
      assert.deepEqual(writes[0].options, {merge: true});
      assert.equal(writes[0].value.pumbleNotificationStatus, "sent");
      assert.equal(writes[0].value.pumbleNotificationRecipientCount, 1);
      assert.equal(writes[0].value.pumbleNotificationSentCount, 1);
      assert.deepEqual(
          writes[0].value.pumbleNotificationMessageIds,
          ["message-1"],
      );
    },
);

/**
 * Creates the Firestore snapshot shape needed by the notification runtime.
 *
 * @param {string} id Admin user ID.
 * @param {Object} data Admin user data.
 * @return {Object} Snapshot stub.
 */
function createUserSnapshot_(id, data) {
  return {id, data: () => data};
}
