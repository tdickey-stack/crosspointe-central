/* eslint-disable max-len, require-jsdoc */
import assert from "node:assert/strict";
import test from "node:test";

import {createServeNeedPumbleNotificationRuntime} from
  "./serve-needs-runtime.js";

function user(id, overrides = {}) {
  const data = {
    active: true,
    email: `${id}@example.com`,
    pageAccess: {serveNeeds: "view"},
    notificationPreferences: {serveNeeds: {pumble: true}},
    notificationIntegrations: {pumble: {
      status: "linked", userId: `pumble-${id}`, botId: "bot",
      workspaceId: "workspace",
    }},
    ...overrides,
  };
  return {id, data: () => data};
}

function harness(users, send = async () => ({messageId: "message-1"})) {
  const sends = [];
  const writes = [];
  const degraded = [];
  const runtime = createServeNeedPumbleNotificationRuntime({
    firestore: {collection: (path) => {
      if (path === "adminUsers") {
        return {where: (field, operator, value) => {
          assert.deepEqual([field, operator, value], ["active", "==", true]);
          return {get: async () => ({docs: users})};
        }};
      }
      assert.equal(path, "serveNeedInterests");
      return {doc: (id) => ({set: async (value, options) => {
        writes.push({id, value, options});
      }})};
    }},
    fieldValue: {serverTimestamp: () => "server-time", delete: () => "delete-field"},
    transport: {send: async (message) => {
      sends.push(message);
      return send(message);
    }},
    degradeConnection: async (uid) => {
      degraded.push(uid);
    },
    usersCollectionPath: "adminUsers",
    interestsCollectionPath: "serveNeedInterests",
  });
  return {runtime, sends, writes, degraded};
}

test("delivers only to the matching contact, ignoring unrelated eligible users", async () => {
  const h = harness([user("contact"), user("other")]);
  await h.runtime.notify("interest-1", {
    contactEmail: "  CONTACT@Example.COM ", serveNeedNeed: "Production Team",
    name: "Taylor Example", email: "taylor@example.com",
  });
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].recipientUserId, "pumble-contact");
  assert.equal(h.sends[0].botUserId, "bot");
  assert.match(h.sends[0].text, /Production Team/);
  assert.equal(h.writes[0].id, "interest-1");
  assert.deepEqual(h.writes[0].options, {merge: true});
  assert.equal(h.writes[0].value.pumbleNotificationStatus, "sent");
  assert.equal(h.writes[0].value.pumbleNotificationRecipientCount, 1);
  assert.deepEqual(h.writes[0].value.pumbleNotificationMessageIds, ["message-1"]);
});

test("missing, invalid, unmatched, or ambiguous contacts never broadcast", async () => {
  const cases = [
    {contact: undefined, users: [user("other")]},
    {contact: " ", users: [user("other")]},
    {contact: {toString: () => "other@example.com"}, users: [user("other")]},
    {contact: "other@example.com\nattacker@example.com", users: [user("other")]},
    {contact: "missing@example.com", users: [user("other")]},
    {contact: "contact@example.com", users: [
      user("contact"), user("duplicate", {email: " CONTACT@example.com "}),
    ]},
    {contact: "contact@example.com", users: [
      user("contact"), user("duplicate", {email: "contact@example.com",
        notificationPreferences: {serveNeeds: {pumble: false}}}),
    ]},
  ];
  for (const {contact, users} of cases) {
    const h = harness(users);
    await h.runtime.notify("interest", {contactEmail: contact});
    assert.equal(h.sends.length, 0);
    assert.equal(h.writes[0].value.pumbleNotificationStatus, "skipped");
    assert.equal(h.writes[0].value.pumbleNotificationRecipientCount, 0);
  }
});

test("matching contacts must be active, permitted, opted in, and linked", async () => {
  for (const overrides of [
    {active: false},
    {pageAccess: {serveNeeds: "none"}},
    {notificationPreferences: {serveNeeds: {pumble: false}}},
    {notificationIntegrations: {pumble: {status: "unlinked"}}},
  ]) {
    const h = harness([user("contact", overrides), user("other")]);
    await h.runtime.notify("interest", {contactEmail: "contact@example.com"});
    assert.equal(h.sends.length, 0);
    assert.equal(h.writes[0].value.pumbleNotificationStatus, "skipped");
  }
});

test("delivery failures are recorded and nonretryable failures degrade only the contact", async () => {
  const error = Object.assign(new Error("failed"), {code: "pumble-invalid-auth"});
  const h = harness([user("contact"), user("other")], async () => {
    throw error;
  });
  await h.runtime.notify("interest", {contactEmail: "contact@example.com"});
  assert.equal(h.sends.length, 1);
  assert.deepEqual(h.degraded, ["contact"]);
  assert.equal(h.writes[0].value.pumbleNotificationStatus, "failed");
  assert.equal(h.writes[0].value.pumbleNotificationFailedCount, 1);
  assert.deepEqual(h.writes[0].value.pumbleNotificationErrorCodes, ["pumble-invalid-auth"]);
});
