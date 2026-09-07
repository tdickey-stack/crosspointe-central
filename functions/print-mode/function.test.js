import assert from "node:assert/strict";
import test from "node:test";

import {createPrintModeHandler} from "./function.js";

test("Print Mode rejects unsupported methods before auth", async () => {
  const response = createResponse_();
  const handler = createPrintModeHandler({});

  await handler({method: "DELETE", headers: {}}, response);

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, {error: "Method not allowed."});
});

test("Print Mode GET preserves Firestore paths and response", async () => {
  const requestedPaths = [];
  const firestore = {
    doc: (path) => {
      requestedPaths.push(path);
      if (path === "centralAdmin/root/users/user-1") {
        return {
          get: async () => createSnapshot_({
            active: true,
            pageAccess: {bulletin: "view"},
            displayName: "Print User",
          }),
        };
      }
      if (path === "centralAdmin/root/public/bulletinMode") {
        return {
          get: async () => createSnapshot_(null),
        };
      }
      throw new Error("Unexpected document path: " + path);
    },
  };
  const response = createResponse_();
  const handler = createPrintModeHandler({
    admin: createAdmin_(),
    firestore,
    allowedAdminEmails: [],
    allowedAdminEmailDomains: ["crosspointe.tv"],
    getFirestoreRoomRulesOverride: async () => ({
      shouldOverride: false,
      items: [],
    }),
    getFirestoreCampaignsOverride: async () => ({
      shouldOverride: true,
      items: [{id: "campaign-1"}],
    }),
    getFirestoreServeNeedsOverride: async () => ({
      shouldOverride: true,
      items: [{id: "serve-1"}],
    }),
    getDefaultRoomRules: () => [{id: "default-room-rule"}],
    planningCenter: {
      getCached: async (roomRules) => {
        assert.deepEqual(roomRules, [{id: "default-room-rule"}]);
        return {
          data: {
            events: {today: [], upcoming: []},
            featuredEvent: null,
          },
          status: "cached",
          fetchedAtMs: 123,
        };
      },
    },
  });

  await handler({
    method: "GET",
    headers: {authorization: "Bearer valid-token"},
    query: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.events, {today: [], upcoming: []});
  assert.deepEqual(response.body.content.campaigns, [{id: "campaign-1"}]);
  assert.deepEqual(response.body.content.serveNeeds, [{id: "serve-1"}]);
  assert.deepEqual(response.body.sync, {
    status: "cached",
    fetchedAtMs: 123,
  });
  assert.equal(response.body.config.bulletinLayout, "classic");
  assert.deepEqual(requestedPaths, [
    "centralAdmin/root/users/user-1",
    "centralAdmin/root/public/bulletinMode",
  ]);
});

test("Print Mode POST preserves settings and audit write paths", async () => {
  const documentWrites = [];
  const auditWrites = [];
  const firestore = {
    doc: (path) => {
      if (path === "centralAdmin/root/users/user-1") {
        return {
          get: async () => createSnapshot_({
            active: true,
            pageAccess: {settings: "admin"},
            displayName: "Print User",
          }),
        };
      }
      if (path === "centralAdmin/root/public/bulletinMode") {
        return {
          set: async (value) => documentWrites.push({path, value}),
        };
      }
      throw new Error("Unexpected document path: " + path);
    },
    collection: (path) => ({
      add: async (value) => auditWrites.push({path, value}),
    }),
  };
  const response = createResponse_();
  const admin = createAdmin_();
  const handler = createPrintModeHandler({
    admin,
    firestore,
    allowedAdminEmails: [],
    allowedAdminEmailDomains: ["crosspointe.tv"],
  });

  await handler({
    method: "POST",
    headers: {authorization: "Bearer valid-token"},
    body: {
      serviceDate: "2026-07-26",
      printFormat: "full-page",
      bulletinLayout: "scannable",
      showCutLine: true,
      campaignDescriptionOverrides: [{
        id: "campaign-1",
        description: "Short campaign copy.",
      }],
      serveNeedDescriptionOverrides: [{
        id: "serve-1",
        description: "",
      }],
      events: [{id: "event-1", title: "Event"}],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(documentWrites.length, 1);
  assert.equal(
      documentWrites[0].path,
      "centralAdmin/root/public/bulletinMode",
  );
  assert.equal(documentWrites[0].value.serviceDate, "2026-07-26");
  assert.equal(documentWrites[0].value.bulletinLayout, "scannable");
  assert.equal(documentWrites[0].value.showCutLine, true);
  assert.equal(response.body.config.bulletinLayout, "scannable");
  assert.deepEqual(documentWrites[0].value.campaignDescriptionOverrides, [{
    id: "campaign-1",
    description: "Short campaign copy.",
  }]);
  assert.deepEqual(documentWrites[0].value.serveNeedDescriptionOverrides, [{
    id: "serve-1",
    description: "",
  }]);
  assert.equal(documentWrites[0].value.updatedByUid, "user-1");
  assert.equal(
      documentWrites[0].value.updatedByEmail,
      "person@crosspointe.tv",
  );
  assert.deepEqual(
      documentWrites[0].value.updatedAt,
      {serverTimestamp: true},
  );
  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0].path, "centralAdmin/root/auditLog");
  assert.equal(auditWrites[0].value.action, "saveBulletinMode");
  assert.equal(auditWrites[0].value.itemCount, 1);
});

test("GET and POST preserve selections regardless of custom size", async () => {
  const saved = {
    bulletinLayout: "scannable",
    campaignIds: ["campaign-1", "campaign-2"],
    serveNeedIds: ["serve-1", "serve-2"],
    fallbackBlocks: [{
      id: "compact",
      title: "Compact",
      size: 1,
      includeOnFront: true,
    }],
  };
  const writes = [];
  const handler = createPrintModeHandler({
    admin: createAdmin_(),
    firestore: {
      doc: (path) => ({
        get: async () => createSnapshot_(
            path === "centralAdmin/root/users/user-1" ?
              {active: true, pageAccess: {bulletin: "admin"}} : saved,
        ),
        set: async (value) => writes.push(value),
      }),
      collection: () => ({add: async () => {}}),
    },
    allowedAdminEmailDomains: ["crosspointe.tv"],
    getFirestoreRoomRulesOverride: async () => ({shouldOverride: false}),
    getFirestoreCampaignsOverride: async () => ({shouldOverride: false}),
    getFirestoreServeNeedsOverride: async () => ({shouldOverride: false}),
    getDefaultRoomRules: () => [],
    planningCenter: {
      getCached: async () => ({
        data: {events: [], featuredEvent: null},
        status: "cached",
        fetchedAtMs: 123,
      }),
    },
  });
  const response = createResponse_();
  await handler({
    method: "GET",
    headers: {authorization: "Bearer valid-token"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.config.campaignIds, saved.campaignIds);
  assert.deepEqual(response.body.config.serveNeedIds, saved.serveNeedIds);
  assert.equal(response.body.config.fallbackBlocks[0].includeOnFront, true);
  assert.equal(writes.length, 0);

  const postResponse = createResponse_();
  await handler({
    method: "POST",
    headers: {authorization: "Bearer valid-token"},
    body: saved,
  }, postResponse);

  assert.equal(postResponse.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].campaignIds, saved.campaignIds);
  assert.deepEqual(writes[0].serveNeedIds, saved.serveNeedIds);
  assert.equal(writes[0].fallbackBlocks[0].includeOnFront, true);
});

test("Print Mode POST preserves layout from a stale client", async () => {
  const documentWrites = [];
  const firestore = {
    doc: (path) => {
      if (path === "centralAdmin/root/users/user-1") {
        return {
          get: async () => createSnapshot_({
            active: true,
            pageAccess: {settings: "admin"},
          }),
        };
      }
      if (path === "centralAdmin/root/public/bulletinMode") {
        return {
          get: async () => createSnapshot_({
            bulletinLayout: "scannable",
          }),
          set: async (value) => documentWrites.push(value),
        };
      }
      throw new Error("Unexpected document path: " + path);
    },
    collection: () => ({
      add: async () => {},
    }),
  };
  const response = createResponse_();
  const handler = createPrintModeHandler({
    admin: createAdmin_(),
    firestore,
    allowedAdminEmails: [],
    allowedAdminEmailDomains: ["crosspointe.tv"],
  });

  await handler({
    method: "POST",
    headers: {authorization: "Bearer valid-token"},
    body: {serviceDate: "2026-07-26"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(documentWrites.length, 1);
  assert.equal(documentWrites[0].bulletinLayout, "scannable");
  assert.equal(response.body.config.bulletinLayout, "scannable");
});

function createAdmin_() {
  return {
    auth: () => ({
      verifyIdToken: async () => ({
        uid: "user-1",
        email: "person@crosspointe.tv",
        name: "Print User",
      }),
    }),
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({serverTimestamp: true}),
      },
    },
  };
}

function createSnapshot_(data) {
  const value = data && typeof data === "object" ? data : null;
  return {
    exists: !!value,
    data: () => value,
    get: (key) => value && value[key],
  };
}

function createResponse_() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    set(key, value) {
      this.headers[key] = value;
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
