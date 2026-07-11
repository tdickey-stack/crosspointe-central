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
  assert.equal(flattened.entries.length, 115);
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
  ["How can I start volunteering?", "serving-get-started"],
  ["Can my teenager volunteer?", "serving-membership-age-and-eligibility"],
  ["Do I need an audition for worship team?", "serving-worship-ministry"],
  ["Can I help make coffee on Sundays?", "serving-coffee-ministry"],
  ["How can I give online?", "giving-online"],
  ["Can I give cash during church?", "giving-during-services"],
  ["How do I cancel recurring giving?", "giving-recurring-and-manage"],
  ["How do I get my giving statement?", "giving-receipts-and-statements"],
  ["Do I have to tithe?", "giving-overview-and-tone"],
  ["Will my prayer request be private?", "care-prayer-privacy-and-wall"],
  ["Will a pastor visit someone in the hospital?", "care-pastoral-support"],
  ["Does CrossPointe offer counseling?", "care-pastoral-counseling"],
  ["Can you write a prayer for me?", "care-wayfinder-prayer-boundary"],
  ["How do I get added to the prayer list?", "care-prayer-request-submit"],
  ["What denomination is CrossPointe?", "beliefs-affiliation-and-unity"],
  ["What does CrossPointe believe about the Bible?", "beliefs-bible-and-authority"],
  ["How can I be saved?", "beliefs-jesus-and-salvation"],
  ["Who should Christians vote for?", "beliefs-creation-government-and-politics"],
  ["Is CrossPointe Calvinist or Arminian?", "beliefs-secondary-doctrines-and-comparisons"],
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
