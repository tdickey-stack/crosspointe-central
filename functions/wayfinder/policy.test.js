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
  assert.equal(
      classifyWayfinderPolicyQuestion(
          "I might hert myself tonight. Wat should I do?",
      ),
      "crisis",
  );
  assert.equal(
      classifyWayfinderPolicyQuestion("I'm going to hurt someone"),
      "crisis",
  );
  assert.equal(
      classifyWayfinderPolicyQuestion("I will shoot up the church"),
      "crisis",
  );
});

test("routes standalone and directed insults to the conduct response", () => {
  [
    "Asshole",
    "Bullshit",
    "Fuck you",
    "You're an asshole",
    "Wayfinder is a stupid bot",
  ].forEach((question) => {
    assert.equal(classifyWayfinderPolicyQuestion(question), "conduct");
  });
});

test("routes explicit CrossPointe complaints to the office response", () => {
  [
    "I want to file a complaint",
    "I'm furious with the church",
    "The service made me frustrated",
  ].forEach((question) => {
    assert.equal(classifyWayfinderPolicyQuestion(question), "complaint");
  });
});

test("incidental profanity and ordinary frustration remain answerable", () => {
  [
    "My car is in shitty shape. Can CARS help?",
    "I'm frustrated because my car won't start",
    "What does CrossPointe believe about profanity?",
  ].forEach((question) => {
    assert.equal(classifyWayfinderPolicyQuestion(question), "knowledge");
  });
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
  assert.equal(
      classifyWayfinderPolicyQuestion(
          "Is Jane Smith a member, and what is her phone number?",
      ),
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

test("conduct response asks for respect without escalating", () => {
  const result = buildWayfinderPolicyAnswer("conduct", {});
  assert.equal(result.responseMode, "fixed_safety");
  assert.match(result.answer, /keep the conversation respectful/i);
  assert.doesNotMatch(result.answer, /office|405-374-4740/i);
});

test("complaint response directs the person to the office", () => {
  const result = buildWayfinderPolicyAnswer("complaint", {});
  assert.equal(result.responseMode, "fixed_safety");
  assert.match(result.answer, /can't resolve complaints/i);
  assert.match(result.answer, /405-374-4740/);
  assert.match(result.answer, /info@crosspointe\.tv/);
});

test("live event fallback never invents a date", () => {
  const result = buildWayfinderLiveSourceAnswer();
  assert.equal(result.route, "live_source_required");
  assert.match(result.answer, /Planning Center/);
  assert.match(result.answer, /can't verify/i);
  assert.doesNotMatch(result.answer, /\b\d{1,2}[:/]\d{1,2}\b/);
});
