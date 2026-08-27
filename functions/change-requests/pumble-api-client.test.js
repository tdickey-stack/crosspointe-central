import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PUMBLE_API_TIMEOUT_MS,
  PUMBLE_DIRECT_CHANNEL_CACHE_TTL_MS,
  createPumbleDirectApiClient,
  normalizePumbleDirectChannelId,
} from "./pumble-api-client.js";

test("looks up an existing bot DM and posts a text-only message", async () => {
  const requests = [];
  const responses = [
    jsonResponse_(200, {channel: {id: "dm-1", channelType: "DIRECT"}}),
    jsonResponse_(200, {id: "message-1", text: "Review requested."}),
  ];
  const client = createClient_(responses, requests);

  const result = await client.sendDirectMessage({
    botUserId: "bot-1",
    userId: "user-1",
    text: "Review requested.",
  });

  assert.deepEqual(result, {id: "message-1", text: "Review requested."});
  assert.equal(requests.length, 2);
  const lookupUrl = new URL(requests[0].url);
  assert.equal(lookupUrl.origin, "https://api-ga.pumble.com");
  assert.equal(lookupUrl.pathname, "/v1/channels/direct");
  assert.equal(lookupUrl.searchParams.get("participantIds"), "bot-1,user-1");
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.body, undefined);
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.headers.token, "bot-token");
  assert.equal(requests[0].options.headers["x-app-token"], "app-key");
  assert.equal(
      requests[1].url,
      "https://api-ga.pumble.com/v1/channels/dm-1/messages",
  );
  assert.equal(requests[1].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    text: "Review requested.",
  });
  assert.equal(requests[1].options.body.includes("files"), false);
  assert.equal(requests[1].options.body.includes("attachments"), false);
});

test("creates a missing DM with the target user before posting", async () => {
  const requests = [];
  const client = createClient_([
    jsonResponse_(404, {error: "Not found"}),
    jsonResponse_(200, {channel: {id: "dm-new", channelType: "DIRECT"}}),
    jsonResponse_(200, {message: {id: "message-1"}}),
  ], requests);

  await client.sendDirectMessage({
    botUserId: "bot-1",
    userId: "user-1",
    text: "Review requested.",
  });

  assert.deepEqual(requests.map((request) => {
    return {
      method: request.options.method,
      path: new URL(request.url).pathname,
      body: request.options.body ? JSON.parse(request.options.body) : null,
    };
  }), [
    {method: "GET", path: "/v1/channels/direct", body: null},
    {
      method: "POST",
      path: "/v1/channels/direct",
      body: {participantIds: ["user-1"]},
    },
    {
      method: "POST",
      path: "/v1/channels/dm-new/messages",
      body: {text: "Review requested."},
    },
  ]);
});

test("bounds the direct-channel cache with an injected clock", async () => {
  let nowMs = 1000;
  const requests = [];
  const responses = [
    jsonResponse_(200, {channel: {id: "dm-1"}}),
    jsonResponse_(200, {id: "message-1"}),
    jsonResponse_(200, {id: "message-2"}),
    jsonResponse_(200, {channel: {id: "dm-1"}}),
    jsonResponse_(200, {id: "message-3"}),
  ];
  const client = createPumbleDirectApiClient({
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      return responses.shift();
    },
    getAppKey: () => "app-key",
    getBotToken: () => "bot-token",
    now: () => nowMs,
    channelCacheTtlMs: 5000,
  });
  const input = {
    botUserId: "bot-1",
    userId: "user-1",
    text: "Review requested.",
  };

  await client.sendDirectMessage(input);
  nowMs += 4999;
  await client.sendDirectMessage(input);
  assert.equal(requests.filter((request) => {
    return request.options.method === "GET";
  }).length, 1);

  nowMs += 1;
  await client.sendDirectMessage(input);
  assert.equal(requests.filter((request) => {
    return request.options.method === "GET";
  }).length, 2);
});

test("fails safely on invalid IDs, endpoints, and direct-channel responses",
    async () => {
      assert.equal(DEFAULT_PUMBLE_API_TIMEOUT_MS, 15 * 1000);
      assert.equal(PUMBLE_DIRECT_CHANNEL_CACHE_TTL_MS, 5 * 60 * 1000);
      assert.equal(normalizePumbleDirectChannelId({channel: {id: "dm-1"}}),
          "dm-1");
      assert.throws(
          () => normalizePumbleDirectChannelId({}),
          (error) => error.code === "pumble-direct-channel-invalid",
      );
      assert.throws(
          () => createPumbleDirectApiClient({
            fetchImpl: async () => {},
            getAppKey: () => "app-key",
            getBotToken: () => "bot-token",
            endpoint: "https://example.com",
          }),
          (error) => error.code === "pumble-endpoint-invalid",
      );

      const client = createClient_([
        jsonResponse_(200, {channel: {id: "dm-1"}}),
      ], []);
      await assert.rejects(
          client.sendDirectMessage({
            botUserId: "same-id",
            userId: "same-id",
            text: "Review requested.",
          }),
          (error) => error.code === "pumble-recipient-invalid",
      );
    });

test("classifies API timeouts as retryable", async () => {
  let receivedSignal = null;
  const client = createPumbleDirectApiClient({
    fetchImpl: async (_url, options) => {
      receivedSignal = options.signal;
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    },
    getAppKey: () => "app-key",
    getBotToken: () => "bot-token",
  });

  await assert.rejects(
      client.sendDirectMessage({
        botUserId: "bot-1",
        userId: "user-1",
        text: "Review requested.",
      }),
      (error) => error.code === "pumble-api-timeout" &&
        error.retryable === true,
  );
  assert.equal(receivedSignal instanceof AbortSignal, true);
});

test("never includes credential values in API errors", async () => {
  const client = createPumbleDirectApiClient({
    fetchImpl: async () => jsonResponse_(401, {error: "denied"}),
    getAppKey: () => "sensitive-app-key",
    getBotToken: () => "sensitive-bot-token",
  });

  await assert.rejects(
      client.sendDirectMessage({
        botUserId: "bot-1",
        userId: "user-1",
        text: "Review requested.",
      }),
      (error) => {
        assert.equal(error.code, "pumble-api-http-failed");
        assert.equal(error.retryable, false);
        assert.doesNotMatch(error.message, /sensitive/);
        return true;
      },
  );
});

/**
 * Creates a client consuming queued Fetch responses.
 *
 * @param {Object[]} responses Queued mock responses.
 * @param {Object[]} requests Request recorder.
 * @return {Object} Pumble direct API client.
 */
function createClient_(responses, requests) {
  const queue = responses.slice();
  return createPumbleDirectApiClient({
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      return queue.shift();
    },
    getAppKey: () => "app-key",
    getBotToken: () => "bot-token",
  });
}

/**
 * Creates a minimal JSON Fetch response.
 *
 * @param {number} status HTTP status.
 * @param {*} body JSON response body.
 * @return {Object} Mock Fetch response.
 */
function jsonResponse_(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
