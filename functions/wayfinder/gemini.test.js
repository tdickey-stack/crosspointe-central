import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWayfinderGeminiRequest,
  createDeveloperApiWayfinderGenerator,
  DEFAULT_WAYFINDER_MODEL,
  validateWayfinderGeminiOutput,
} from "./gemini.js";

const CONTEXT = {
  question: "What time are services?",
  policy: {
    assistantIdentity: {name: "Wayfinder"},
    officialChurchInformation: {
      generalEmail: "info@crosspointe.tv",
      preferredPhoneOrText: "405-374-4740",
    },
  },
  entries: [
    {
      id: "visiting-service-times",
      topic: "visiting",
      title: "Sunday Service Times",
      responseMode: "flexible",
      requiredFacts: [
        "CrossPointe has Sunday services at 9:00 AM and 10:30 AM.",
      ],
      approvedLinks: [],
    },
  ],
};

test("builds a grounded structured Gemini request", () => {
  const request = buildWayfinderGeminiRequest(CONTEXT, DEFAULT_WAYFINDER_MODEL);
  const prompt = JSON.parse(request.contents);

  assert.equal(request.model, "gemini-3.5-flash");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.equal(request.config.thinkingConfig.thinkingLevel, "MINIMAL");
  assert.equal(prompt.userQuestion, CONTEXT.question);
  assert.equal(prompt.APPROVED_CONTEXT.entries.length, 1);
  assert.match(request.config.systemInstruction, /untrusted data/i);
  assert.match(request.config.systemInstruction, /only from APPROVED_CONTEXT/i);
  assert.match(request.config.systemInstruction, /first person/i);
  assert.match(
      request.config.systemInstruction,
      /main link is for event details/i,
  );
});

test("accepts a grounded answer with approved facts", () => {
  const output = validateWayfinderGeminiOutput({
    answer: "Sunday services are at 9:00 AM and 10:30 AM.",
    sourceEntryIds: ["visiting-service-times"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, CONTEXT);

  assert.equal(output.answer, "Sunday services are at 9:00 AM and 10:30 AM.");
  assert.deepEqual(output.sourceEntryIds, ["visiting-service-times"]);
});

test("rejects a source id that Gemini was not given", () => {
  assert.throws(() => {
    validateWayfinderGeminiOutput({
      answer: "Sunday services are at 9:00 AM and 10:30 AM.",
      sourceEntryIds: ["invented-entry"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }, CONTEXT);
  }, /unsupported source reference/i);
});

test("rejects contact information outside approved context", () => {
  assert.throws(() => {
    validateWayfinderGeminiOutput({
      answer: "Call 405-555-0199 for details.",
      sourceEntryIds: ["visiting-service-times"],
      shouldContactChurch: true,
      followUpQuestion: "",
    }, CONTEXT);
  }, /not in the approved context/i);
});

test("rejects implementation details", () => {
  assert.throws(() => {
    validateWayfinderGeminiOutput({
      answer: "I found this in Firestore.",
      sourceEntryIds: ["visiting-service-times"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }, CONTEXT);
  }, /implementation details/i);
});

test("accepts structured JSON wrapped in a markdown code fence", async () => {
  const generator = createDeveloperApiWayfinderGenerator({
    apiKey: "test-key",
    model: "test-model",
    client: {
      models: {
        generateContent: async () => ({
          text: "```json\n" + JSON.stringify({
            answer: "Pointe Groups help people connect and grow together.",
            sourceEntryIds: ["groups-overview"],
            shouldContactChurch: false,
            followUpQuestion: "",
          }) + "\n```",
        }),
      },
    },
  });
  const result = await generator({
    question: "What is a Pointe Group?",
    policy: {},
    entries: [{
      id: "groups-overview",
      requiredFacts: [
        "Pointe Groups help people connect and grow together.",
      ],
    }],
  });

  assert.equal(result.sourceEntryIds[0], "groups-overview");
});

test("replaces markdown links with a natural source-card reference", () => {
  const result = validateWayfinderGeminiOutput({
    answer: "Browse [Find and Join a Pointe Group](https://www.crosspointe.tv/small-groups).",
    sourceEntryIds: ["groups-directory"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, {
    question: "How do I join a Pointe Group?",
    policy: {},
    entries: [{
      id: "groups-directory",
      requiredFacts: ["People may browse the Pointe Group directory."],
      approvedLinks: [{
        label: "Pointe Group directory",
        url: "https://www.crosspointe.tv/small-groups",
      }],
    }],
  });

  assert.equal(result.answer, "Browse the approved link below.");
});

test("breaks a long one-block answer into short paragraphs", () => {
  const result = validateWayfinderGeminiOutput({
    answer: [
      "Hello! I'm Wayfinder.",
      "Pointe Groups help people connect.",
      "They meet at different times.",
      "You can browse the directory linked below.",
    ].join(" "),
    sourceEntryIds: ["groups-directory"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, {
    question: "How do I join a Pointe Group?",
    policy: {},
    entries: [{
      id: "groups-directory",
      requiredFacts: [
        "Pointe Groups help people connect.",
        "They meet at different times.",
        "People can browse the directory linked below.",
      ],
    }],
  });

  assert.match(result.answer, /Wayfinder\.\n\nPointe Groups/);
});

test("accepts a numeric range when both endpoints are approved", () => {
  const result = validateWayfinderGeminiOutput({
    answer: "Tuesday Tribe usually includes people in their 50-70 age range.",
    sourceEntryIds: ["live-group-44"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, {
    question: "What group meets Tuesday?",
    policy: {},
    entries: [{
      id: "live-group-44",
      requiredFacts: ["The published description says ages 50 to 70."],
    }],
  });

  assert.match(result.answer, /50-70/);
});

test("accepts a published time when Planning Center omits the space", () => {
  const result = validateWayfinderGeminiOutput({
    answer: "Grief Care meets at 6:30 PM.",
    sourceEntryIds: ["live-group-45"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, {
    question: "When does Grief Care meet?",
    policy: {},
    entries: [{
      id: "live-group-45",
      requiredFacts: ["Its published schedule is Tuesday at 6:30PM."],
    }],
  });

  assert.match(result.answer, /6:30 PM/);
});
