import assert from "node:assert/strict";
import test from "node:test";

import {flattenWayfinderBundles} from "./knowledge.js";
import {rankWayfinderKnowledge} from "./retrieval.js";
import {loadWayfinderBundles} from "../scripts/wayfinder-bundles.js";

const bundles = await loadWayfinderBundles();
const flattened = flattenWayfinderBundles(bundles);
const entries = flattened.entries.map((entry) => entry.data);

test("all approved Wayfinder bundles validate", () => {
  assert.deepEqual(flattened.errors, []);
  assert.equal(flattened.policies.length, 1);
  assert.equal(flattened.entries.length, 68);
});

const retrievalCases = [
  ["What time is church?", "visiting-sunday-service-times"],
  ["Do I have to dress up for church?", "visiting-what-to-wear"],
  [
    "Can my kids stay with me during worship?",
    "families-children-in-main-service",
  ],
  ["I accepted Jesus. What should I do now?", "next-steps-decision-for-christ"],
  ["When is the next Starting Pointe?", "next-steps-starting-pointe-schedule"],
  [
    "What is the street address for a home group?",
    "groups-home-address-privacy",
  ],
  ["How do I get baptized?", "next-steps-request-baptism"],
];

retrievalCases.forEach(([question, expectedId]) => {
  test("retrieves " + expectedId + " for: " + question, () => {
    const result = rankWayfinderKnowledge(question, entries);
    assert.ok(result.results.length > 0);
    assert.equal(result.results[0].id, expectedId);
  });
});

test("returns no match for an unrelated question", () => {
  const result = rankWayfinderKnowledge(
      "What is tomorrow's stock market forecast?",
      entries,
  );
  assert.deepEqual(result.results, []);
  assert.equal(result.confidence, "none");
});
