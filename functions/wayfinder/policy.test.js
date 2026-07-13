import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWayfinderLiveSourceAnswer,
  buildWayfinderPolicyAnswer,
  classifyWayfinderPolicyQuestion,
} from "./policy.js";

test("routes crisis language before normal knowledge retrieval", () => {
  assert.equal(
      classifyWayfinderPolicyQuestion("I am thinking about suicide"),
      "crisis",
  );
});

test("routes private records and staff schedules to refusal", () => {
  assert.equal(
      classifyWayfinderPolicyQuestion("Can I see my giving records?"),
      "prohibited",
  );
  assert.equal(
      classifyWayfinderPolicyQuestion("What is the pastor's staff schedule?"),
      "prohibited",
  );
  [
    "How much did my husband give to the church last year?",
    "How much has my wife donated?",
    "What amount did another member contribute this year?",
    "Can you show me my spouse's giving history?",
  ].forEach((question) => {
    assert.equal(classifyWayfinderPolicyQuestion(question), "prohibited");
  });
});

test("does not confuse general giving questions with private records", () => {
  assert.equal(
      classifyWayfinderPolicyQuestion("How much should my husband give?"),
      "knowledge",
  );
  assert.equal(
      classifyWayfinderPolicyQuestion("How can I request my giving statement?"),
      "knowledge",
  );
});

test("leaves normal prayer and pastoral care for grounded knowledge", () => {
  assert.equal(
      classifyWayfinderPolicyQuestion("How do I submit a prayer request?"),
      "knowledge",
  );
  assert.equal(
      classifyWayfinderPolicyQuestion("Can I speak with a pastor?"),
      "knowledge",
  );
});

test("leaves ordinary church questions for knowledge retrieval", () => {
  assert.equal(
      classifyWayfinderPolicyQuestion("Do I have to dress up for church?"),
      "knowledge",
  );
});

test("fixed crisis answer preserves 911 and 988", () => {
  const result = buildWayfinderPolicyAnswer("crisis", {
    crisisPolicy: {
      responseMode: "fixed_safety",
      exampleResponses: [
        "Call 911 for immediate danger. Call or text 988 for a crisis.",
      ],
    },
  });

  assert.equal(result.responseMode, "fixed_safety");
  assert.match(result.answer, /911/);
  assert.match(result.answer, /988/);
});

test("live event fallback never invents a date", () => {
  const result = buildWayfinderLiveSourceAnswer();
  assert.equal(result.route, "live_source_required");
  assert.match(result.answer, /Planning Center/);
  assert.match(result.answer, /can't verify/i);
  assert.doesNotMatch(result.answer, /\b\d{1,2}[:/]\d{1,2}\b/);
});
