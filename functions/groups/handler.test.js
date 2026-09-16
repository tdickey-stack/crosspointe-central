/* eslint-disable require-jsdoc, max-len */
import assert from "node:assert/strict";
import test from "node:test";
import {createPublicGroupsHandler} from "./handler.js";

function response() {
  return {
    headers: {},
    set(key, value) {
      this.headers[key] = value; return this;
    },
    status(value) {
      this.code = value; return this;
    },
    json(value) {
      this.body = value; return this;
    },
  };
}

test("public GET returns directory and bounded public caching", async () => {
  const res = response();
  const handler = createPublicGroupsHandler({
    loadGroups: async () => [{id: "1"}],
  });
  await handler({method: "GET"}, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, {schemaVersion: 1, groups: [{id: "1"}]});
  assert.equal(res.headers["Cache-Control"],
      "public, max-age=60, s-maxage=60");
});

test("methods other than GET never reach Planning Center", async () => {
  const res = response();
  const handler = createPublicGroupsHandler({loadGroups: () => assert.fail()});
  await handler({method: "POST"}, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, "GET");
});

test("upstream errors and private response bodies never reach visitors", async () => {
  const res = response();
  await createPublicGroupsHandler({loadGroups: async () => {
    throw new Error("Authorization secret, private API response");
  }})({method: "GET"}, res);
  assert.equal(res.code, 503);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body, {
    error: "Groups are temporarily unavailable. Please try again.",
  });
});
