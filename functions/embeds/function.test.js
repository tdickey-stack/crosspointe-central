/* eslint-disable require-jsdoc */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createCentralEmbedPublicHandler,
  createCentralEmbedsAdminHandler,
} from "./function.js";

function createResponse_() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    type(value) {
      this.headers["Content-Type"] = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

function createPublicOptions_(documentData) {
  return {
    firestore: {
      collection(path) {
        assert.equal(path, "centralEmbeds");
        return {
          doc(id) {
            assert.equal(id, "embed_abc123def456");
            return {
              async get() {
                return {
                  exists: !!documentData,
                  data: () => documentData || {},
                };
              },
            };
          },
        };
      },
    },
    getFirestoreRoomRulesOverride: async () => ({
      shouldOverride: false,
      items: [],
    }),
    getFirestoreEventOverrides: async () => [],
    getDefaultRoomRules: () => [],
    planningCenter: {
      async getCached() {
        return {
          data: {
            events: {upcoming: [{
              id: "event-1",
              title: "Public Event",
              date: "August 20",
              time: "6 PM",
              location: "CrossPointe",
              description: "Public description",
              church_center_url: "https://example.com/event",
              featured: "TRUE",
              private_notes: "secret",
            }]},
          },
          status: "cached",
          fetchedAtMs: 1,
        };
      },
    },
  };
}

function createAdminOptions_(documentData) {
  const documents = new Map();
  if (documentData) {
    documents.set("embed_abc123def456", structuredClone(documentData));
  }
  const snapshot = (id) => {
    const data = documents.get(id);
    return {
      id,
      exists: !!data,
      data: () => data ? structuredClone(data) : {},
      get: (field) => data && data[field],
    };
  };
  const documentRef = (id) => ({
    async create(data) {
      assert.equal(documents.has(id), false);
      documents.set(id, structuredClone(data));
    },
    async delete() {
      documents.delete(id);
    },
    async get() {
      return snapshot(id);
    },
    async set(data, options) {
      const previous = documents.get(id) || {};
      documents.set(id, options && options.merge ?
        {...previous, ...structuredClone(data)} : structuredClone(data));
    },
  });
  const options = {
    admin: {
      auth: () => ({
        verifyIdToken: async () => ({
          uid: "admin-1",
          email: "admin@example.com",
          name: "Admin",
        }),
      }),
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
      },
      storage: () => assert.fail("Storage should not be used."),
    },
    allowedAdminEmails: ["admin@example.com"],
    allowedAdminEmailDomains: [],
    firestore: {
      collection(path) {
        if (path === "centralEmbeds") {
          return {
            doc: documentRef,
            async get() {
              return {docs: [...documents.keys()].map(snapshot)};
            },
          };
        }
        assert.equal(path, "centralAdmin/root/auditLog");
        return {add: async () => {}};
      },
      doc(path) {
        assert.equal(path, "centralAdmin/root/users/admin-1");
        return {get: async () => ({
          exists: true,
          get(field) {
            return field === "active" ? true :
              field === "pageAccess" ? {embeds: "edit"} : "";
          },
        })};
      },
    },
  };
  return {options, documents};
}

async function postAdmin_(options, body) {
  const handler = createCentralEmbedsAdminHandler(options);
  const response = createResponse_();
  await handler({
    method: "POST",
    headers: {authorization: "Bearer test-token"},
    body,
  }, response);
  return response;
}

test("public endpoint returns only resolved published fields", async () => {
  const handler = createCentralEmbedPublicHandler(createPublicOptions_({
    name: "Private admin name",
    createdByEmail: "private@example.com",
    publishedVersion: 2,
    published: {
      layout: "compact",
      items: [{sourceEventId: "event-1", overrides: {title: null}}],
    },
  }));
  const response = createResponse_();
  await handler({
    method: "GET",
    path: "/api/embed/embed_abc123def456.json",
    query: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.body.layout, "compact");
  assert.equal(response.body.events[0].title, "Public Event");
  assert.equal(response.body.events[0].featured, true);
  assert.equal(Object.hasOwn(response.body, "name"), false);
  assert.equal(Object.hasOwn(response.body, "createdByEmail"), false);
  assert.equal(JSON.stringify(response.body).includes("private_notes"), false);
});

test("public HTML endpoint provides the semantic renderer", async () => {
  const handler = createCentralEmbedPublicHandler(createPublicOptions_({
    publishedVersion: 1,
    published: {
      layout: "compact",
      items: [{sourceEventId: "event-1", overrides: {}}],
    },
  }));
  const response = createResponse_();
  await handler({
    method: "GET",
    path: "/api/embed/embed_abc123def456.html",
    query: {styles: "0"},
    protocol: "https",
    get: () => "central.crosspointe.tv",
  }, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<section/);
  assert.match(response.body, /<article/);
  assert.match(response.body, /central-embed-layout-compact/);
  assert.match(response.body, /Public Event/);
  assert.doesNotMatch(response.body, /Public description/);
});

test("public Groups JSON skips the Event Planning Center source", async () => {
  const options = createPublicOptions_({
    type: "groups",
    publishedVersion: 3,
    published: {theme: "responsive", items: [{sourceEventId: "ignored"}]},
  });
  options.planningCenter.getCached = () => assert.fail(
      "Groups must not load Event Planning Center data.",
  );
  const response = createResponse_();
  await createCentralEmbedPublicHandler(options)({
    method: "GET",
    path: "/api/embed/embed_abc123def456.json",
    query: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    schemaVersion: 1,
    id: "embed_abc123def456",
    type: "groups",
    theme: "responsive",
    publishedVersion: 3,
  });
});

test("public Groups HTML supports shell and standalone forms", async () => {
  const options = createPublicOptions_({
    type: "groups",
    published: {theme: "dark"},
  });
  options.planningCenter.getCached = () => assert.fail(
      "Groups must not load Event Planning Center data.",
  );
  const handler = createCentralEmbedPublicHandler(options);
  const shell = createResponse_();
  await handler({
    method: "GET",
    path: "/api/embed/embed_abc123def456.html",
    query: {styles: "0"},
  }, shell);
  assert.match(shell.body, /^<section class="central-embed-root"/);
  assert.match(shell.body, /data-central-embed-type="groups"/);
  assert.doesNotMatch(shell.body, /<script|<link|data-group-directory/);

  const standalone = createResponse_();
  await handler({
    method: "GET",
    path: "/api/embed/embed_abc123def456.html",
    query: {},
    protocol: "https",
    get: (name) => name === "host" ? "central.crosspointe.tv" : "",
  }, standalone);
  assert.match(standalone.body, /data-central-embed="embed_abc123def456"/);
  assert.match(standalone.body, /<link[^>]+embed\.css/);
  assert.match(standalone.body, /<script defer[^>]+embed\.js/);
});

test(
    "public endpoint rejects unknown types without Event loading",
    async () => {
      const options = createPublicOptions_({
        type: "pages",
        published: {},
      });
      options.planningCenter.getCached = () => assert.fail();
      const response = createResponse_();
      await createCentralEmbedPublicHandler(options)({
        method: "GET",
        path: "/api/embed/embed_abc123def456.json",
        query: {},
      }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, "invalid-payload");
    },
);

test("public endpoint sanitizes unexpected backend failures", async () => {
  const options = createPublicOptions_(null);
  options.firestore.collection = () => ({doc: () => ({
    get: async () => {
      throw new Error("private upstream response and credential detail");
    },
  })});
  const response = createResponse_();
  await createCentralEmbedPublicHandler(options)({
    method: "GET",
    path: "/api/embed/embed_abc123def456.json",
    query: {},
  }, response);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "unavailable");
  assert.doesNotMatch(JSON.stringify(response.body), /private|credential/);
});

test("admin creates and publishes a typed Groups Embed", async () => {
  const {options, documents} = createAdminOptions_();
  const created = await postAdmin_(options, {
    action: "create",
    type: "groups",
    name: "Groups Directory",
  });
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.embed.type, "groups");
  assert.deepEqual(created.body.embed.draft, {theme: "light"});

  const id = created.body.embed.id;
  const published = await postAdmin_(options, {
    action: "publish",
    id,
    type: "groups",
    name: "Groups Directory",
    theme: "responsive",
    items: [{sourceEventId: "ignored"}],
  });
  assert.equal(published.statusCode, 200);
  assert.deepEqual(published.body.embed.published, {theme: "responsive"});
  assert.deepEqual(documents.get(id).published, {theme: "responsive"});

  const duplicated = await postAdmin_(options, {
    action: "duplicate",
    id,
    type: "groups",
  });
  assert.equal(duplicated.statusCode, 200);
  assert.equal(duplicated.body.embed.type, "groups");
  assert.deepEqual(duplicated.body.embed.draft, {theme: "responsive"});
  assert.equal(duplicated.body.embed.published, null);
});

test("admin rejects type changes and Groups image uploads", async () => {
  const {options} = createAdminOptions_({
    type: "groups",
    name: "Directory",
    draft: {theme: "light"},
    published: null,
    publishedVersion: 0,
  });
  const mismatch = await postAdmin_(options, {
    action: "saveDraft",
    id: "embed_abc123def456",
    type: "events",
    name: "Directory",
    items: [],
  });
  assert.equal(mismatch.statusCode, 400);
  assert.match(mismatch.body.error, /cannot change type/);

  const upload = await postAdmin_(options, {
    action: "uploadImage",
    id: "embed_abc123def456",
    type: "groups",
  });
  assert.equal(upload.statusCode, 400);
  assert.match(upload.body.error, /only for Event Embeds/);

  const unsupported = await postAdmin_(options, {
    action: "create",
    type: "pages",
    name: "Unsupported",
  });
  assert.equal(unsupported.statusCode, 400);
  assert.match(unsupported.body.error, /supported Central Embed type/);
});

test("Event publishing still requires a selected item", async () => {
  const {options} = createAdminOptions_({
    type: "events",
    name: "Events",
    draft: {layout: "standard", items: []},
    published: null,
    publishedVersion: 0,
  });
  const response = await postAdmin_(options, {
    action: "publish",
    id: "embed_abc123def456",
    type: "events",
    name: "Events",
    layout: "standard",
    items: [],
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /at least one event/);
});

test(
    "admin endpoint requires authentication before database access",
    async () => {
      const handler = createCentralEmbedsAdminHandler({
        admin: {},
        firestore: {},
      });
      const response = createResponse_();
      await handler({method: "GET", headers: {}, query: {}}, response);
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.code, "auth-required");
    },
);
