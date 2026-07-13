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
  assert.ok(request.config.responseJsonSchema.required.includes(
      "communicationPosture",
  ));
  assert.ok(request.config.responseJsonSchema.required.includes(
      "postureConfidence",
  ));
  assert.equal(request.config.thinkingConfig.thinkingLevel, "MINIMAL");
  assert.equal(prompt.userQuestion, CONTEXT.question);
  assert.equal(prompt.APPROVED_CONTEXT.entries.length, 1);
  assert.deepEqual(prompt.LIVE_EVENT_ANSWER_ORDER, []);
  assert.match(request.config.systemInstruction, /untrusted data/i);
  assert.match(request.config.systemInstruction, /only from APPROVED_CONTEXT/i);
  assert.match(request.config.systemInstruction, /first person/i);
  assert.match(request.config.systemInstruction, /already introduced/i);
  assert.match(request.config.systemInstruction, /canned chatbot/i);
  assert.match(
      request.config.systemInstruction,
      /CP-CM-1\.4 BRAND VOICE GATE/i,
  );
  assert.match(request.config.systemInstruction, /Be loving/i);
  assert.match(request.config.systemInstruction, /Be stable/i);
  assert.match(request.config.systemInstruction, /Be authentic/i);
  assert.match(request.config.systemInstruction, /Be engaging/i);
  assert.match(request.config.systemInstruction, /Be inspiring/i);
  assert.match(
      request.config.systemInstruction,
      /Not every answer needs inspiration/i,
  );
  assert.match(
      request.config.systemInstruction,
      /Do not add an offer to contact the church/i,
  );
  assert.match(request.config.systemInstruction, /AUDIENCE ADAPTATION/i);
  assert.match(request.config.systemInstruction, /Never identify.*persona/i);
  assert.match(request.config.systemInstruction, /Never infer age, gender/i);
  assert.match(request.config.systemInstruction, /reassuring_belonging/i);
  assert.match(request.config.systemInstruction, /practical_stability/i);
  assert.match(request.config.systemInstruction, /direct_relational_depth/i);
  assert.match(request.config.systemInstruction, /optimistic_agency/i);
  assert.match(request.config.systemInstruction, /curious_relevance/i);
  assert.match(request.config.systemInstruction, /Apply.*posture subtly/i);
  assert.match(request.config.systemInstruction, /Do not perform a persona/i);
  assert.match(
      request.config.systemInstruction,
      /at most three useful examples/i,
  );
  assert.match(
      request.config.systemInstruction,
      /exclusive, overwhelming, or stale/i,
  );
  assert.match(request.config.systemInstruction, /sounds commanding/i);
  assert.match(
      request.config.systemInstruction,
      /Never invent or imply a reason/i,
  );
  assert.match(request.config.systemInstruction, /answer only the question/i);
  assert.match(request.config.systemInstruction, /followUpQuestion empty/i);
  assert.match(request.config.systemInstruction, /do not repeat options/i);
  assert.match(
      request.config.systemInstruction,
      /do not reuse the opening structure/i,
  );
  assert.match(request.config.systemInstruction, /Since you/i);
  assert.match(
      request.config.systemInstruction,
      /only shares context without asking a question/i,
  );
  assert.match(
      request.config.systemInstruction,
      /never claim.*information is missing/i,
  );
  assert.match(
      request.config.systemInstruction,
      /authoritative public source/i,
  );
  assert.match(request.config.systemInstruction, /I have included/i);
  assert.match(
      request.config.systemInstruction,
      /main link is for event details/i,
  );
});

test("includes untrusted conversation context for follow-ups", () => {
  const request = buildWayfinderGeminiRequest({
    ...CONTEXT,
    question: "What time does it start?",
    conversationHistory: [{
      role: "user",
      content: "When is Starting Pointe?",
    }, {
      role: "assistant",
      content: "Starting Pointe is Tuesday, July 14.",
    }],
  }, DEFAULT_WAYFINDER_MODEL);
  const prompt = JSON.parse(request.contents);

  assert.equal(prompt.CONVERSATION_HISTORY.length, 2);
  assert.equal(prompt.CONVERSATION_HISTORY[0].role, "user");
  assert.match(
      request.config.systemInstruction,
      /not an approved factual source/i,
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
  assert.equal(output.communicationPosture, "universal");
  assert.equal(output.postureConfidence, "none");
});

test("accepts a supported high-confidence communication posture", () => {
  const output = validateWayfinderGeminiOutput({
    answer: "You are welcome to come as you are.",
    sourceEntryIds: ["visiting-service-times"],
    shouldContactChurch: false,
    followUpQuestion: "",
    communicationPosture: "reassuring_belonging",
    postureConfidence: "high",
  }, CONTEXT);

  assert.equal(output.communicationPosture, "reassuring_belonging");
  assert.equal(output.postureConfidence, "high");
});

test("rejects an unsupported or uncertain specialized posture", () => {
  assert.throws(() => {
    validateWayfinderGeminiOutput({
      answer: "Sunday services are at 9:00 AM and 10:30 AM.",
      sourceEntryIds: ["visiting-service-times"],
      shouldContactChurch: false,
      followUpQuestion: "",
      communicationPosture: "reassuring_belonging",
      postureConfidence: "none",
    }, CONTEXT);
  }, /invalid communication posture/i);
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

test("repairs an over-applied communication posture once", async () => {
  let calls = 0;
  const generator = createDeveloperApiWayfinderGenerator({
    apiKey: "test-key",
    model: "test-model",
    client: {
      models: {
        generateContent: async () => {
          calls += 1;
          return {
            text: JSON.stringify(calls === 1 ? {
              answer: "It is completely natural to feel nervous. " +
                "You are absolutely welcome to come as you are.",
              sourceEntryIds: ["visiting-what-to-wear"],
              shouldContactChurch: false,
              followUpQuestion: "",
              communicationPosture: "reassuring_belonging",
              postureConfidence: "high",
            } : {
              answer: "You are welcome to come as you are. " +
                "CrossPointe is casual, with no formal dress expectation.",
              sourceEntryIds: ["visiting-what-to-wear"],
              shouldContactChurch: false,
              followUpQuestion: "",
              communicationPosture: "reassuring_belonging",
              postureConfidence: "high",
            }),
          };
        },
      },
    },
  });
  const result = await generator({
    question: "I'm nervous about visiting. What should I wear?",
    policy: {},
    entries: [{
      id: "visiting-what-to-wear",
      requiredFacts: [
        "CrossPointe is casual.",
        "People are welcome to come as they are.",
        "There is no expectation to dress formally.",
      ],
    }],
  });

  assert.equal(calls, 2);
  assert.doesNotMatch(result.answer, /completely|absolutely/i);
  assert.equal(result.communicationPosture, "reassuring_belonging");
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

test("removes an accidental space inside a social handle", () => {
  const result = validateWayfinderGeminiOutput({
    answer: "Follow CrossPointe on Instagram at @crosspointe. tv.",
    sourceEntryIds: ["visiting-social-media"],
    shouldContactChurch: false,
    followUpQuestion: "",
  }, {
    question: "What is CrossPointe's Instagram?",
    policy: {},
    entries: [{
      id: "visiting-social-media",
      requiredFacts: [
        "CrossPointe's Instagram handle is @crosspointe.tv.",
      ],
    }],
  });

  assert.match(result.answer, /@crosspointe\.tv/);
});

test("removes an accidental space inside an approved email address", () => {
  const output = validateWayfinderGeminiOutput({
    answer: "Email info@crosspointe. tv if you would like to speak with us.",
    sourceEntryIds: ["entry-1"],
    shouldContactChurch: true,
    followUpQuestion: "",
  }, {
    question: "How do I speak with a pastor?",
    policy: {},
    entries: [{
      id: "entry-1",
      requiredFacts: ["The church email is info@crosspointe.tv."],
    }],
  });

  assert.match(output.answer, /info@crosspointe\.tv/);
  assert.doesNotMatch(output.answer, /crosspointe\.\s+tv/);
});
