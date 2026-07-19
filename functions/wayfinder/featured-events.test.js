import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWayfinderFeaturedEventEntries,
  createWayfinderFeaturedEventProvider,
} from "./featured-events.js";

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
              content: {blocks: [{
                type: "paragraph",
                data: {text: "<p>A relaxed night to connect &amp; grow.</p>"},
              }, {
                type: "buttons",
                data: {buttons: [{
                  text: "Learn More",
                  url: "https://example.com/details",
                }, {
                  text: "Sign Up Today!",
                  url: "https://registration.example.com/mens-night",
                }]},
              }]},
              privateNote: "unused",
            },
            {
              name: "Men's Night",
              slug: "duplicate",
              startTime: "2026-07-20T22:30:00.000Z",
              content: {blocks: []},
              privateNote: "unused",
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
  assert.equal(result.fetchedAt, NOW.toISOString());
  assert.deepEqual(result.events, [{
    name: "Men's Night",
    normalizedName: "mens night",
    startsAt: "2026-07-20T22:30:00.000Z",
    description: "A relaxed night to connect & grow.",
    registrationAction: {
      label: "Sign Up Today!",
      url: "https://registration.example.com/mens-night",
    },
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

      assert.deepEqual(await provider(), {
        status: "ok",
        fetchedAt: NOW.toISOString(),
        events: [],
      });
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

test("a health check can force a fresh Featured Events request", async () => {
  let calls = 0;
  const provider = createWayfinderFeaturedEventProvider({
    now: () => NOW,
    fetchImpl: async (url) => {
      calls += 1;
      return url.endsWith("/events") ?
        response_("\\\"token\\\":\\\"" + TOKEN + "\\\"") :
        response_({data: {rows: []}});
    },
  });

  await provider();
  await provider();
  await provider({forceRefresh: true});
  assert.equal(calls, 4);
});

test("builds a temporary grounded entry for a named Featured Event", () => {
  const entries = buildWayfinderFeaturedEventEntries({
    status: "ok",
    events: [{
      name: "Converge 2026",
      normalizedName: "converge 2026",
      startsAt: "2026-07-30T17:00:00.000Z",
      description: "A music camp for children to learn and perform.",
      registrationAction: {
        label: "Sign Up Today!",
        url: "https://ru.edu/converge",
      },
      url: "https://www.crosspointe.tv/event/converge-2026",
    }],
  }, "What is Converge?");

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "featured-event-converge-2026");
  assert.equal(entries[0].requiredSourceType, "planning_center_event");
  assert.match(entries[0].requiredFacts[0], /music camp for children/i);
  assert.equal(entries[0].approvedLinks[0].url,
      "https://www.crosspointe.tv/event/converge-2026");
  assert.doesNotMatch(entries[0].requiredFacts.join(" "), /July 30/);
});

function response_(body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: {"content-type": typeof body === "string" ?
      "text/html" : "application/json"},
  });
}
