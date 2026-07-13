import assert from "node:assert/strict";
import test from "node:test";

import {getWayfinderFeaturedEventHealth} from "./featured-event-health.js";

const NOW = new Date("2026-07-12T15:00:00.000Z");

test("reports matched, renamed, and unmatched Featured Events safely",
    async () => {
      const result = await getWayfinderFeaturedEventHealth({
        now: () => NOW,
        timezone: "America/Chicago",
        getFeaturedEvents: async () => ({
          status: "ok",
          fetchedAt: NOW.toISOString(),
          events: [
            featured_("Men's Night", "2026-07-20T22:30:00.000Z"),
            featured_("Website Only", "2026-07-22T23:00:00.000Z"),
          ],
        }),
        fetchJson: async () => ({
          data: [pco_(
              "The Pointe - Men's Ministry",
              "2026-07-20T22:30:00.000Z",
          )],
          links: {next: null},
        }),
      });

      assert.equal(result.status, "ready");
      assert.equal(result.featuredCount, 2);
      assert.equal(result.matchedCount, 1);
      assert.equal(result.nameDifferenceCount, 1);
      assert.equal(result.unmatchedCount, 1);
      assert.deepEqual(result.events.map((item) => item.status), [
        "matched", "unmatched",
      ]);
      assert.equal(result.events[0].websiteName, "Men's Night");
      assert.equal(
          result.events[0].planningCenterName,
          "The Pointe - Men's Ministry",
      );
      assert.doesNotMatch(JSON.stringify(result), /content|token|secret/i);
    });

test("reports website and Planning Center source failures without guessing",
    async () => {
      const websiteFailure = await getWayfinderFeaturedEventHealth({
        now: () => NOW,
        getFeaturedEvents: async () => ({
          status: "unavailable",
          events: [],
        }),
        fetchJson: async () => {
          throw new Error("should not run");
        },
      });
      assert.equal(websiteFailure.status, "unavailable");
      assert.equal(websiteFailure.websiteStatus, "unavailable");

      const pcoFailure = await getWayfinderFeaturedEventHealth({
        now: () => NOW,
        getFeaturedEvents: async () => ({
          status: "ok",
          fetchedAt: NOW.toISOString(),
          events: [featured_("Men's Night", "2026-07-20T22:30:00.000Z")],
        }),
        fetchJson: async () => {
          throw new Error("PCO unavailable");
        },
      });
      assert.equal(pcoFailure.planningCenterStatus, "unavailable");
      assert.equal(pcoFailure.events[0].status, "unverified");
    });

test("recognizes CSM Summer Games as regular Wednesday programming",
    async () => {
      const result = await getWayfinderFeaturedEventHealth({
        now: () => NOW,
        timezone: "America/Chicago",
        getFeaturedEvents: async () => ({
          status: "ok",
          fetchedAt: NOW.toISOString(),
          events: [featured_(
              "CSM Summer Games", "2026-06-03T22:00:00.000Z",
          )],
        }),
        fetchJson: async () => ({
          data: [pco_(
              "CSM Wednesday Nights", "2026-07-15T22:00:00.000Z",
          )],
          links: {next: null},
        }),
      });

      assert.equal(result.matchedCount, 1);
      assert.equal(result.unmatchedCount, 0);
      assert.equal(result.events[0].planningCenterName,
          "CSM Wednesday Nights");
    });

function featured_(name, startsAt) {
  return {
    name,
    startsAt,
    url: "https://www.crosspointe.tv/event/" +
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  };
}

function pco_(name, startsAt) {
  return {
    type: "EventInstance",
    id: "pco-1",
    attributes: {
      name,
      starts_at: startsAt,
      church_center_url:
        "https://crosspointetv.churchcenter.com/calendar/event/pco-1",
    },
  };
}
