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
