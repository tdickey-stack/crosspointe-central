import assert from "node:assert/strict";
import test from "node:test";

import {
  createWayfinderAlphaAccessHandler,
  createWayfinderAlphaSettingsHandler,
} from "./alpha-access.js";

test("enabled alpha allows a user with Wayfinder permission", async () => {
  const store = createStore_({enabled: true, permission: "view"});
  const response = createResponse_();
  await createWayfinderAlphaAccessHandler(dependencies_(store))({
    method: "GET",
    headers: {authorization: "Bearer test-token"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.canUse, true);
  assert.equal(response.body.canAdmin, false);
  assert.equal(response.body.permission, "view");
});

test("disabled alpha remains hidden from an authorized admin", async () => {
  const store = createStore_({enabled: false, permission: "admin"});
  const response = createResponse_();
  await createWayfinderAlphaAccessHandler(dependencies_(store))({
    method: "GET",
    headers: {authorization: "Bearer test-token"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.canUse, false);
  assert.equal(response.body.canAdmin, false);
});

test("only a Wayfinder admin can change the alpha switch", async () => {
  const userStore = createStore_({enabled: false, permission: "view"});
  const denied = createResponse_();
  await createWayfinderAlphaSettingsHandler(dependencies_(userStore))({
    method: "POST",
    headers: {authorization: "Bearer test-token"},
    body: {enabled: true},
  }, denied);
  assert.equal(denied.statusCode, 403);

  const adminStore = createStore_({enabled: false, permission: "admin"});
  const allowed = createResponse_();
  await createWayfinderAlphaSettingsHandler(dependencies_(adminStore))({
    method: "POST",
    headers: {authorization: "Bearer test-token"},
    body: {enabled: true},
  }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.body.enabled, true);
  assert.equal(adminStore.settings.wayfinder_enabled, true);
});

function dependencies_(store) {
  return {
    admin: {
      auth: () => ({
        verifyIdToken: async () => ({
          uid: "alpha-user",
          email: "tester@crosspointe.tv",
        }),
      }),
      firestore: {
        FieldValue: {serverTimestamp: () => "server-time"},
      },
    },
    firestore: store.firestore,
    isAllowedAdminEmail: () => true,
    getAdminUserDocPath: () => "centralAdmin/root/users/alpha-user",
  };
}

function createStore_({enabled, permission}) {
  const store = {
    settings: {wayfinder_enabled: enabled},
  };
  store.firestore = {
    doc: (path) => ({
      get: async () => {
        if (path === "centralApp/root/public/settings") {
          return {exists: true, data: () => store.settings};
        }
        return {
          exists: true,
          get: (field) => {
            if (field === "active") return true;
            if (field === "pageAccess") return {wayfinder: permission};
            return undefined;
          },
        };
      },
      set: async (data) => {
        store.settings = {...store.settings, ...data};
      },
    }),
  };
  return store;
}

function createResponse_() {
  return {
    statusCode: 0,
    body: null,
    set: () => {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
