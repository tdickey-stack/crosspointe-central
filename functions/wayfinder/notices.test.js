import assert from "node:assert/strict";
import test from "node:test";

import {
  createWayfinderNoticeDraftGenerator,
  selectRelevantWayfinderNotices,
} from "./notices.js";

test("notice draft generator accepts a safe expiring notice", async () => {
  const now = new Date("2026-07-11T15:00:00.000Z");
  const generator = createWayfinderNoticeDraftGenerator({
    apiKey: "local-test-key",
    client: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            clarificationNeeded: false,
            clarificationQuestion: "",
            title: "Care Center closed Friday",
            publicMessage: "The Care Center will be closed this Friday.",
            topic: "care_center",
            keywords: ["care center", "food pantry", "Friday"],
            startsAt: "2026-07-11T15:00:00.000Z",
            expiresAt: "2026-07-18T04:59:59.000Z",
            overrideTargets: ["knowledge"],
          }),
        }),
      },
    },
  });

  const result = await generator({
    instruction: "The Care Center is closed this Friday.",
    now,
  });

  assert.equal(result.title, "Care Center closed Friday");
  assert.equal(result.topic, "care_center");
  assert.deepEqual(result.overrideTargets, ["knowledge"]);
  assert.ok(result.expiresAt instanceof Date);
});

test("notice draft generator rejects notices longer than 31 days", async () => {
  const now = new Date("2026-07-11T15:00:00.000Z");
  const generator = createWayfinderNoticeDraftGenerator({
    apiKey: "local-test-key",
    client: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            clarificationNeeded: false,
            clarificationQuestion: "",
            title: "Long notice",
            publicMessage: "This temporary notice lasts too long.",
            topic: "general",
            keywords: ["notice"],
            startsAt: now.toISOString(),
            expiresAt: "2026-09-11T15:00:00.000Z",
            overrideTargets: ["knowledge"],
          }),
        }),
      },
    },
  });

  await assert.rejects(
      generator({instruction: "Keep this up for two months.", now}),
      /dates were invalid/i,
  );
});

test("matching temporary notice becomes approved grounded context", () => {
  const entries = selectRelevantWayfinderNotices(
      "Is the Care Center open Friday?",
      [{
        id: "notice-1",
        title: "Care Center closed Friday",
        publicMessage: "The Care Center will be closed this Friday.",
        topic: "care_center",
        keywords: ["care center", "food pantry", "Friday"],
        overrideTargets: ["knowledge"],
        startsAt: new Date("2026-07-11T15:00:00.000Z"),
        expiresAt: new Date("2026-07-18T04:59:59.000Z"),
      }],
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "active-notice-notice-1");
  assert.match(entries[0].requiredFacts[0], /closed this Friday/i);
  assert.match(entries[0].requiredActions[0], /overrides conflicting/i);
});

