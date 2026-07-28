import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestStartGate,
  fetchJsonWithRetry,
} from "./request-control.js";

test("request gate spaces concurrent request starts", async () => {
  let clockMs = 0;
  const starts = [];
  const gate = createRequestStartGate({
    minIntervalMs: 250,
    now: () => clockMs,
    sleep: async (milliseconds) => {
      clockMs += milliseconds;
    },
  });

  await Promise.all([1, 2, 3].map(async () => {
    await gate();
    starts.push(clockMs);
  }));

  assert.deepEqual(starts, [0, 250, 500]);
});

test("temporary rate limits honor Retry-After and retry", async () => {
  const sleeps = [];
  let requestCount = 0;
  const value = await fetchJsonWithRetry("https://example.test/events", {
    maxAttempts: 3,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return mockResponse(429, {error: "rate limited"}, {"retry-after": "2"});
      }
      return mockResponse(200, {events: ["ready"]});
    },
  });

  assert.equal(requestCount, 2);
  assert.deepEqual(sleeps, [2000]);
  assert.deepEqual(value, {events: ["ready"]});
});

test("permanent Planning Center errors are not retried", async () => {
  let requestCount = 0;

  await assert.rejects(
      fetchJsonWithRetry("https://example.test/events", {
        fetchImpl: async () => {
          requestCount += 1;
          return mockResponse(400, {error: "bad request"});
        },
        sleep: async () => {},
      }),
      /Planning Center API error 400/,
  );

  assert.equal(requestCount, 1);
});

/**
 * Builds the small Response surface used by retry tests.
 *
 * @param {number} status HTTP status.
 * @param {Object} body JSON response body.
 * @param {Object} headers Response headers.
 * @return {Object} Mock fetch response.
 */
function mockResponse(status, body, headers = {}) {
  const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => {
        return [key.toLowerCase(), value];
      }),
  );

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => normalizedHeaders[String(name).toLowerCase()] || null,
    },
    text: async () => JSON.stringify(body),
  };
}
