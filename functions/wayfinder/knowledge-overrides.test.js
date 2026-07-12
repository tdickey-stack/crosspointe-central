import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWayfinderKnowledgeOverrides,
  createWayfinderKnowledgeChangeGenerator,
} from "./knowledge-overrides.js";

const officeEntry = {
  id: "contact-office-hours",
  topic: "contact",
  title: "Church Office Hours",
  responseMode: "guided",
  sampleQuestions: ["When is the office open?"],
  keywords: ["office", "hours"],
  requiredFacts: ["The office is open Monday through Thursday, 9 AM to 4 PM."],
  allowedPublicFacts: [],
  requiredActions: [],
  prohibitedClaims: [],
  prohibitedInformation: [],
  approvedLinks: [],
  approvalStatus: "approved",
  publicationState: "draft",
};

test("knowledge generator drafts a complete replacement", async () => {
  const generator = createWayfinderKnowledgeChangeGenerator({
    apiKey: "local-test-key",
    client: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            clarificationNeeded: false,
            clarificationQuestion: "",
            targetEntryId: "contact-office-hours",
            changeSummary: "Thursday closing time changes to 3 PM.",
            title: "Church Office Hours",
            requiredFacts: [
              "The office is open Monday through Wednesday, 9 AM to 4 PM.",
              "The office is open Thursday, 9 AM to 3 PM.",
            ],
            allowedPublicFacts: [],
            requiredActions: [],
            prohibitedClaims: [],
            prohibitedInformation: [],
            approvedLinks: [],
          }),
        }),
      },
    },
  });

  const result = await generator({
    instruction: "Office hours now end at 3 PM on Thursday.",
    candidates: [officeEntry],
  });

  assert.equal(result.targetEntryId, "contact-office-hours");
  assert.equal(result.requiredFacts.length, 2);
  assert.match(result.requiredFacts[1], /3 PM/);
});

test("knowledge generator rejects a target it was not given", async () => {
  const generator = createWayfinderKnowledgeChangeGenerator({
    apiKey: "local-test-key",
    client: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            clarificationNeeded: false,
            clarificationQuestion: "",
            targetEntryId: "unapproved-entry",
            changeSummary: "Unsupported change.",
            title: "Unsupported",
            requiredFacts: ["Unsupported fact."],
            allowedPublicFacts: [],
            requiredActions: [],
            prohibitedClaims: [],
            prohibitedInformation: [],
            approvedLinks: [],
          }),
        }),
      },
    },
  });

  await assert.rejects(
      generator({instruction: "Change it.", candidates: [officeEntry]}),
      /unsupported entry/i,
  );
});

test("active override replaces imported entry without changing id", () => {
  const result = applyWayfinderKnowledgeOverrides([officeEntry], [{
    id: "contact-office-hours",
    revision: 2,
    entry: {
      ...officeEntry,
      requiredFacts: ["The office closes at 3 PM on Thursday."],
    },
  }]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "contact-office-hours");
  assert.match(result[0].requiredFacts[0], /3 PM/);
  assert.equal(result[0].permanentOverrideRevision, 2);
});
