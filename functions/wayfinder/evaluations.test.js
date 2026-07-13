import assert from "node:assert/strict";
import test from "node:test";

import {
  WAYFINDER_EVALUATION_CASES,
  WAYFINDER_EVALUATION_CATEGORIES,
} from "./evaluation-cases.js";
import {
  scoreWayfinderEvaluation,
  selectWayfinderEvaluationCases,
} from "./evaluations.js";

test("evaluation library has five balanced categories and unique cases", () => {
  assert.equal(WAYFINDER_EVALUATION_CATEGORIES.length, 5);
  assert.equal(WAYFINDER_EVALUATION_CASES.length, 25);
  assert.equal(new Set(WAYFINDER_EVALUATION_CASES.map((item) => item.id)).size,
      WAYFINDER_EVALUATION_CASES.length);
  WAYFINDER_EVALUATION_CATEGORIES.forEach((category) => {
    assert.equal(WAYFINDER_EVALUATION_CASES.filter((item) =>
      item.category === category).length, 5);
  });
});

test("shuffle bag draws one case per category without early repeats", () => {
  let state = {};
  const seenByCategory = new Map(WAYFINDER_EVALUATION_CATEGORIES.map(
      (category) => [category, new Set()]));
  for (let run = 0; run < 5; run += 1) {
    const draw = selectWayfinderEvaluationCases(state, () => 0.42);
    assert.equal(draw.cases.length, 5);
    draw.cases.forEach((item) => {
      assert.equal(seenByCategory.get(item.category).has(item.id), false);
      seenByCategory.get(item.category).add(item.id);
    });
    state = {remainingByCategory: draw.remainingByCategory};
  }
  seenByCategory.forEach((seen) => assert.equal(seen.size, 5));
});

test("scoring passes grounded, concise answers with expected links", () => {
  const testCase = WAYFINDER_EVALUATION_CASES.find((item) =>
    item.id === "general-pointe-groups");
  const result = scoreWayfinderEvaluation(testCase, {
    mode: "gemini-grounded",
    modelUsed: true,
    answer: "You can browse every Pointe Group and request to join online.",
    sourceCards: [{
      id: "groups-live-directory",
      links: [{url: "https://www.crosspointe.tv/small-groups"}],
    }],
  });
  assert.equal(result.status, "pass");
  assert.equal(result.checks.every((check) => check.status === "pass"), true);
});

test("scoring fails when a required source and link are missing", () => {
  const testCase = WAYFINDER_EVALUATION_CASES.find((item) =>
    item.id === "general-pointe-groups");
  const result = scoreWayfinderEvaluation(testCase, {
    mode: "gemini-grounded",
    modelUsed: true,
    answer: "Contact the office for more information.",
    sourceCards: [],
  });
  assert.equal(result.status, "fail");
  assert.equal(result.checks.filter((check) => check.status === "fail").length,
      2);
});

test("length concerns are warnings rather than factual failures", () => {
  const testCase = {
    id: "length-test",
    category: "brand_voice",
    title: "length",
    conversation: [{role: "user", content: "Test?"}],
    expected: {maxWords: 3},
  };
  const result = scoreWayfinderEvaluation(testCase, {
    answer: "This answer is definitely much too long.",
  });
  assert.equal(result.status, "warning");
});

test("evaluation accepts valid family and no-match live source ids", () => {
  const kidsCase = WAYFINDER_EVALUATION_CASES.find((item) =>
    item.id === "general-kids");
  const kidsResult = scoreWayfinderEvaluation(kidsCase, {
    answer: "Kingdom Kids has Sunday programming for children.",
    sourceCards: [{id: "families-kingdom-kids-sunday", links: []}],
  });
  assert.equal(kidsResult.status, "pass");

  const eventCase = WAYFINDER_EVALUATION_CASES.find((item) =>
    item.id === "live-next-starting-pointe");
  const eventResult = scoreWayfinderEvaluation(eventCase, {
    mode: "gemini-grounded",
    answer: "No Starting Pointe event is currently posted.",
    sourceCards: [{id: "live-events-no-match", links: []}],
  });
  assert.equal(eventResult.status, "pass");
});

test("child baptism evaluation requires both pastor and class details", () => {
  const baptismCase = WAYFINDER_EVALUATION_CASES.find((item) =>
    item.id === "memory-baptism-child");
  const result = scoreWayfinderEvaluation(baptismCase, {
    answer: "Contact the office to talk with someone.",
    sourceCards: [{id: "next-steps-child-teen-baptism", links: []}],
  });
  assert.equal(result.status, "fail");
  assert.equal(result.checks.filter((check) => check.status === "fail").length,
      2);
});
