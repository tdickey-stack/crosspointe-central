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
  assert.equal(flattened.entries.length, 152);
});

const retrievalCases = [
  ["What time is church?", "visiting-sunday-service-times"],
  ["Do I have to dress up for church?", "visiting-what-to-wear"],
  [
    "What social media pages does CrossPointe have?",
    "visiting-social-media",
  ],
  ["What is CrossPointe's Instagram?", "visiting-social-media"],
  ["Where can I listen to the podcast?", "visiting-audio-podcast"],
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
  ["Is there a place to see every small group?", "groups-live-directory"],
  ["How do I get baptized?", "next-steps-request-baptism"],
  ["When is the food pantry open?", "outreach-care-center-overview-and-hours"],
  [
    "How often can I use the Care Center?",
    "outreach-care-center-eligibility-and-id",
  ],
  ["Can the church help fix my car?", "outreach-cars-overview-and-application"],
  ["Can CARS replace my tires?", "outreach-cars-repair-scope"],
  ["What is RFKC?", "outreach-rfk-and-trac-independent-ministries"],
  ["Who is the lead pastor?", "staff-pastoral-worship-and-students"],
  ["Who oversees the website?", "staff-creative-and-wayfinder"],
  [
    "Who should I tell about a livestream problem?",
    "staff-worship-technology-and-av",
  ],
  ["Who leads CARS Ministry?", "staff-volunteer-ministry-leaders"],
  ["What events are coming up?", "events-general-upcoming"],
  ["What's happening today?", "events-today"],
  ["Are there any women's events?", "events-named-and-ministry-search"],
  ["Where is the Welcome Center?", "campus-welcome-center-main-building"],
  [
    "Where do I check my kids in?",
    "campus-childrens-center-and-family-arrival",
  ],
  ["How do I find Pointe Brew?", "campus-the-pointe-navigation"],
  ["Is Pointe Brew wheelchair accessible?", "campus-parking-and-accessibility"],
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
  [
    "What does CrossPointe believe about the Bible?",
    "beliefs-bible-and-authority",
  ],
  ["How can I be saved?", "beliefs-jesus-and-salvation"],
  [
    "Who should Christians vote for?",
    "beliefs-creation-government-and-politics",
  ],
  [
    "Is CrossPointe Calvinist or Arminian?",
    "beliefs-secondary-doctrines-and-comparisons",
  ],
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
