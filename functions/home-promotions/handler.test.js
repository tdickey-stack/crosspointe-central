/* eslint-disable require-jsdoc */

import assert from "node:assert/strict";
import test from "node:test";

import {createHomePromotionsHandler} from "./handler.js";

test("GET returns the current admin projection", async () => {
  const response = response_();
  let accessMode = null;
  const handler = createHomePromotionsHandler({
    service: {
      list: async (data) => ({
        items: [{id: "one", title: data.title}],
        candidates: [],
        highlights: [],
        warnings: [],
      }),
      save: async () => assert.fail("GET must not save."),
    },
    verifyAccess: async (request, write) => {
      accessMode = write;
      return {uid: "admin-1"};
    },
    loadPublicData: async () => ({title: "Source title"}),
  });

  await handler({method: "GET"}, response);

  assert.equal(accessMode, false);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.items[0].title, "Source title");
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("POST saves one item and returns a refreshed projection", async () => {
  const response = response_();
  const calls = [];
  const handler = createHomePromotionsHandler({
    service: {
      save: async (item, actor, data) => {
        calls.push({item, actor, data});
        return {id: item.id};
      },
      list: async () => ({
        items: [{id: "one", revision: 2}],
        candidates: [],
        highlights: [],
        warnings: [],
      }),
    },
    verifyAccess: async (request, write) => {
      assert.equal(write, true);
      return {uid: "admin-1"};
    },
    loadPublicData: async () => ({events: []}),
  });

  await handler({method: "POST", body: {item: {id: "one"}}}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.savedItem.revision, 2);
  assert.equal(response.body.message, "Home promotion saved.");
  assert.equal(calls[0].actor.uid, "admin-1");
});

test("handler returns safe auth and unexpected errors", async () => {
  const authResponse = response_();
  const authHandler = createHomePromotionsHandler({
    service: {},
    verifyAccess: async () => {
      const error = new Error("Sensitive auth implementation detail");
      error.status = 403;
      error.code = "home-promotions-forbidden";
      throw error;
    },
    loadPublicData: async () => ({}),
  });
  await authHandler({method: "GET"}, authResponse);
  assert.deepEqual(authResponse.body, {
    error: "Your current Admin access does not allow this action.",
    code: "home-promotions-forbidden",
  });

  const unexpectedResponse = response_();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const unexpectedHandler = createHomePromotionsHandler({
      service: {list: async () => {
        throw new Error("database credentials leaked here");
      }},
      verifyAccess: async () => ({uid: "admin-1"}),
      loadPublicData: async () => ({}),
    });
    await unexpectedHandler({method: "GET"}, unexpectedResponse);
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(unexpectedResponse.body, {
    error: "Home promotions are temporarily unavailable.",
    code: "home-promotions-unavailable",
  });
});

test("handler rejects unsupported methods before loading data", async () => {
  const response = response_();
  const handler = createHomePromotionsHandler({
    service: {},
    verifyAccess: async () => assert.fail("Must not authenticate."),
    loadPublicData: async () => assert.fail("Must not load public data."),
  });

  await handler({method: "DELETE"}, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET, POST");
});

function response_() {
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
