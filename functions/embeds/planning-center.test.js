import assert from "node:assert/strict";
import test from "node:test";

import {
  CENTRAL_EMBEDS_LOOKAHEAD_DAYS,
  createCentralEmbedsPlanningCenterService,
} from "./planning-center.js";

test("Central Embeds uses an isolated 60-day calendar window", async () => {
  const calls = [];
  const service = createCentralEmbedsPlanningCenterService({
    firestore: {
      doc(path) {
        assert.equal(
            path,
            "centralCache/planningCenter/calendar/v3-60",
        );
        return {
          async get() {
            return {
              exists: true,
              data: () => ({
                fetchedAtMs: 200,
              }),
            };
          },
        };
      },
    },
    baseService: {
      async getCached() {
        throw new Error("The 21-day fallback should not be used.");
      },
    },
    async getCentralCalendarEvents(roomRules, days, options, overrides) {
      calls.push({roomRules, days, options, overrides});
      return {today: [], upcoming: [{id: "new"}]};
    },
  });

  const result = await service.getCached([], {}, []);
  assert.equal(result.status, "calendar-cache");
  assert.equal(result.data.events.upcoming[0].id, "new");
  assert.equal(calls[0].days, CENTRAL_EMBEDS_LOOKAHEAD_DAYS);
  assert.equal(calls[0].options.forceRefresh, false);

  const refreshed = await service.refresh([], []);
  assert.equal(refreshed.status, "refreshed");
  assert.equal(calls[1].days, 60);
  assert.equal(calls[1].options.forceRefresh, true);
});
