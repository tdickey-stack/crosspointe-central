import test from "node:test";
import assert from "node:assert/strict";
import {resolveEffectiveRoomRulesBaseline} from
  "./room-rules-baseline.js";

test("first custom room rule starts from the effective fallback list", () => {
  const fallbackItems = [
    {id: "legacy-1", match_text: "Children"},
    {id: "legacy-2", match_text: "Student Room"},
  ];
  assert.deepEqual(
      resolveEffectiveRoomRulesBaseline({
        shouldOverride: false,
        items: [],
      }, fallbackItems),
      fallbackItems,
  );
});

test("an explicit published room-rule override remains authoritative", () => {
  const publishedItems = [{id: "custom-1", match_text: "Kid's Room"}];
  assert.deepEqual(
      resolveEffectiveRoomRulesBaseline({
        shouldOverride: true,
        items: publishedItems,
      }, [{id: "legacy-1"}]),
      publishedItems,
  );
});
