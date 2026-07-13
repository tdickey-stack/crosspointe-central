import assert from "node:assert/strict";
import test from "node:test";

import {createWayfinderFeaturedEventProvider} from "./featured-events.js";

const NOW = new Date("2026-07-12T15:00:00.000Z");
const TOKEN = "eyJ" + "a".repeat(40);

test("reads and sanitizes the public Featured Events identities", async () => {
  const requests = [];
  const provider = createWayfinderFeaturedEventProvider({
    now: () => NOW,
    cacheTtlMs: 0,
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      if (url === "https://www.crosspointe.tv/events") {
        return response_("flight data \\\"token\\\":\\\"" + TOKEN + "\\\"");
      }
      return response_({
        data: {
          rows: [
            {
              name: "Men's Night",
              slug: "mens-night",
              startTime: "2026-07-20T22:30:00.000Z",
              content: "unused",
            },
            {
              name: "Men's Night",
              slug: "duplicate",
              startTime: "2026-07-20T22:30:00.000Z",
              content: "unused",
            },
            {
              name: "Unsafe",
              slug: "../../private",
              startTime: "2026-07-20T22:30:00.000Z",
            },
          ],
        },
      });
    },
  });

  const result = await provider();

  assert.equal(result.status, "ok");
  assert.deepEqual(result.events, [{
    name: "Men's Night",
    normalizedName: "mens night",
    startsAt: "2026-07-20T22:30:00.000Z",
    url: "https://www.crosspointe.tv/event/mens-night",
  }]);
  assert.match(requests[1].url, /startTime=2026-07-12T15%3A00%3A00.000Z/);
  assert.equal(requests[1].options.headers.Authorization, "Bearer " + TOKEN);
  assert.doesNotMatch(JSON.stringify(result), /eyJ/);
  assert.doesNotMatch(JSON.stringify(result), /unused/);
});

test("treats a successful empty Featured Events feed as authoritative",
    async () => {
      const provider = createWayfinderFeaturedEventProvider({
        now: () => NOW,
        cacheTtlMs: 0,
        fetchImpl: async (url) => url.endsWith("/events") ?
      response_("\\\"token\\\":\\\"" + TOKEN + "\\\"") :
      response_({data: {rows: []}}),
      });

      assert.deepEqual(await provider(), {status: "ok", events: []});
    });

test("fails closed and caches an unavailable Featured Events feed",
    async () => {
      let calls = 0;
      const provider = createWayfinderFeaturedEventProvider({
        now: () => NOW,
        fetchImpl: async () => {
          calls += 1;
          return response_("No visitor token here");
        },
      });

      assert.deepEqual(await provider(), {status: "unavailable", events: []});
      assert.deepEqual(await provider(), {status: "unavailable", events: []});
      assert.equal(calls, 1);
    });

function response_(body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: {"content-type": typeof body === "string" ?
      "text/html" : "application/json"},
  });
}
