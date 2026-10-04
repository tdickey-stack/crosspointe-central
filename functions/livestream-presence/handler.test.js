/* eslint-disable require-jsdoc */
import assert from "node:assert/strict";
import test from "node:test";
import {createPresenceHandler, createPresenceLimiter,
  requestEnvironment} from "./handler.js";

const validBody = {sessionId: "0123456789abcdef0123456789abcdef",
  streamKey: "a".repeat(64), sequence: 1, active: true};
const req = (method = "GET", host = "central.crosspointe.tv") => ({
  method, headers: {host, "origin": "https://" + host,
    "content-type": "application/json"}, body: validBody,
});
const run = async (request, options = {}) => {
  const result = {headers: {}, status: 0, body: null};
  const response = {set: (key, value) => {
    result.headers[key] = value;
  },
  status: (status) => {
    result.status = status; return response;
  },
  json: (body) => {
    result.body = body; return response;
  }};
  await createPresenceHandler({service: {
    read: async (environment) => ({available: true, environment, count: 2}),
    write: async () => ({available: true}),
  }, ...options})(request, response);
  return result;
};

test("allowed live and dev hostnames resolve isolated environments", () => {
  for (const host of ["central.crosspointe.tv", "crosspointe-central.web.app",
    "crosspointe-central.firebaseapp.com"]) {
    assert.equal(requestEnvironment(req("GET", host)), "live");
  }
  for (const host of ["crosspointe-central--dev-abc123.web.app",
    "crosspointe-central--dev-123.firebaseapp.com"]) {
    assert.equal(requestEnvironment(req("POST", host)), "dev");
  }
  const forwarded = req();
  forwarded.headers.host = "central-presence-abc.run.app";
  forwarded.headers["x-forwarded-host"] = "central.crosspointe.tv";
  assert.equal(requestEnvironment(forwarded), "live");
});

test("reject external origins, preview channels and lookalikes", () => {
  for (const host of ["evil.com", "central.crosspointe.tv.evil.com",
    "crosspointe-central--other-abc.web.app", "localhost", "127.0.0.1",
    "crosspointe-central--dev-.web.app", "central.crosspointe.tv:444",
    "central.crosspointe.tv, evil.com", "evil.com@central.crosspointe.tv"]) {
    assert.equal(requestEnvironment(req("POST", host)), "");
  }
  for (const origin of ["https://evil.com", "null", "http://central.crosspointe.tv",
    "https://crosspointe-central--dev-abc.web.app",
    "https://central.crosspointe.tv/path"]) {
    const request = req("POST");
    request.headers.origin = origin;
    assert.equal(requestEnvironment(request), "");
  }
  const noOrigin = req("POST");
  delete noOrigin.headers.origin;
  assert.equal(requestEnvironment(noOrigin), "");
  noOrigin.method = "GET";
  assert.equal(requestEnvironment(noOrigin), "live");
  noOrigin.headers["sec-fetch-site"] = "cross-site";
  assert.equal(requestEnvironment(noOrigin), "");
});

test("loopback requires emulator, including port and IPv6", () => {
  for (const host of ["localhost:5000", "127.0.0.1:5000", "[::1]:5000"]) {
    const request = req("POST", host);
    request.headers.origin = "http://" + host;
    assert.equal(requestEnvironment(request), "");
    assert.equal(requestEnvironment(request, true), "dev");
  }
});

test("read/write and private uncached generic errors", async () => {
  assert.equal((await run(req())).status, 200);
  assert.equal((await run(req("POST"))).status, 200);
  assert.equal((await run(req("DELETE"))).status, 405);
  assert.equal((await run(req("POST", "evil.com"))).status, 403);
  const malformed = req("POST");
  malformed.body = {...validBody, active: "true"};
  assert.equal((await run(malformed)).status, 400);
  const oversized = req("POST");
  oversized.rawBody = Buffer.alloc(1025);
  assert.equal((await run(oversized)).status, 413);
  const wrongType = req("POST");
  wrongType.headers["content-type"] = "text/plain";
  assert.equal((await run(wrongType)).status, 415);
  const failed = await run(req(), {service: {
    read: async () => {
      throw new Error("internal path/credentials");
    },
  }});
  assert.equal(failed.status, 503);
  assert.deepEqual(failed.body, {available: false});
  assert.equal(failed.headers["Cache-Control"], "no-store");
  assert.equal((await run(req(), {allowRequest: () => false})).status, 429);
});

test("rate limiter bounds request volume and session memory and resets", () => {
  let now = 1000;
  const allow = createPresenceLimiter({now: () => now,
    totalLimit: 5, sessionLimit: 2, maxSessions: 1});
  assert.equal(allow("session-a"), true);
  assert.equal(allow("session-a"), true);
  assert.equal(allow("session-a"), false);
  assert.equal(allow("session-b"), false);
  assert.equal(allow(), true);
  assert.equal(allow(), false);
  now += 60000;
  assert.equal(allow("session-b"), true);
});
