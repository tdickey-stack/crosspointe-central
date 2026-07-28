import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStudioCreativeBriefRequest,
  createStudioCreativeBriefGenerator,
  validateStudioCreativeBrief_,
} from "./creative-brief.js";

const validBrief = {
  creativeConcept:
    "Layered translucent currents opening toward a calm center.",
  emotionalTone:
    "calm, compassionate, steady, inviting, quietly hopeful",
  visualDirection:
    "Soft organic ribbons and diffused light with tactile depth.",
  compositionDirection:
    "Flow from the lower right toward an open upper-left field.",
  colorDirection:
    "Warm neutrals with restrained blush, mint, and charcoal depth.",
  negativeSpaceDirection:
    "Use naturally calmer texture and lower contrast in the upper left.",
  avoid: [
    "people or human figures",
    "literal objects",
    "text, logos, overlays, or panels",
  ],
  personaApplication:
    "Caring Carly adds clarity, steadiness, compassion, and visual order.",
  audienceApplication:
    "No additional gender-based audience emphasis was selected.",
};

test("builds a knowledge-grounded structured creative-director request", () => {
  const request = buildStudioCreativeBriefRequest({
    request: "Inviting Sunday backdrop, abstract and flowy.",
    audiencePersona: "caring_carly",
    visualApproach: "abstract",
    aspectRatio: "4:5",
    subjectPlacement: "right",
    audienceGender: "unspecified",
  });
  const contents = JSON.parse(request.contents);

  assert.equal(request.model, "gemini-3.5-flash");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.ok(request.config.responseJsonSchema.required.includes(
      "creativeConcept",
  ));
  assert.equal(contents.SELECTED_PERSONA.id, "caring_carly");
  assert.equal(contents.SELECTED_VISUAL_APPROACH.id, "abstract");
  assert.equal(contents.SELECTED_AUDIENCE_GENDER.id, "unspecified");
  assert.equal(contents.OUTPUT_FORMAT.aspectRatio, "4:5");
  assert.match(request.config.systemInstruction, /communication posture only/i);
  assert.match(request.config.systemInstruction, /facial expression/i);
  assert.match(
      request.config.systemInstruction,
      /do not introduce or mention people/i,
  );
});

test("accepts a non-demographic Caring Carly abstract brief", () => {
  assert.deepEqual(
      validateStudioCreativeBrief_(validBrief, {
        visualApproach: "abstract",
      }),
      validBrief,
  );
});

test("rejects demographic persona interpretation", () => {
  assert.throws(
      () => validateStudioCreativeBrief_({
        ...validBrief,
        visualDirection: "A soft abstract silhouette of a working mother.",
      }, {
        visualApproach: "abstract",
      }),
      {
        code: "studio-brief-invalid-response",
        safeReason: "demographic_persona",
      },
  );
});

test("uses target gender without redefining the persona", () => {
  const brief = {
    ...validBrief,
    creativeConcept: "A group of men engaged in a meaningful conversation.",
    visualDirection: "Candid documentary photography of men as one peer group.",
    personaApplication:
      "The posture adds relevance and gentle challenge without literal joy.",
    audienceApplication:
      "The concept welcomes men without relying on masculine stereotypes.",
  };

  assert.deepEqual(
      validateStudioCreativeBrief_(brief, {
        visualApproach: "people",
        audienceGender: "male",
      }),
      brief,
  );
});

test("rejects gender language inside persona application", () => {
  assert.throws(
      () => validateStudioCreativeBrief_({
        ...validBrief,
        personaApplication: "Happy Henry is expressed as a group of men.",
      }, {
        visualApproach: "people",
        audienceGender: "male",
      }),
      {
        code: "studio-brief-invalid-response",
        safeReason: "demographic_persona",
      },
  );
});

test("rejects people in a scenery, abstract, or objects brief", () => {
  assert.throws(
      () => validateStudioCreativeBrief_({
        ...validBrief,
        creativeConcept: "A crowd moving through abstract ribbons of light.",
      }, {
        visualApproach: "abstract",
      }),
      {
        code: "studio-brief-invalid-response",
        safeReason: "disallowed_people",
      },
  );
});

test("generates and validates a brief with an injected client", async () => {
  const requests = [];
  const generator = createStudioCreativeBriefGenerator({
    model: "test-text-model",
    client: {
      models: {
        generateContent: async (request) => {
          requests.push(request);
          return {text: JSON.stringify(validBrief)};
        },
      },
    },
  });

  const result = await generator({
    request: "Inviting Sunday backdrop, abstract and flowy.",
    audiencePersona: "caring_carly",
    visualApproach: "abstract",
    audienceGender: "unspecified",
    aspectRatio: "4:5",
  });

  assert.equal(result.model, "test-text-model");
  assert.deepEqual(result.brief, validBrief);
  assert.equal(result.correctionAttempts, 0);
  assert.equal(result.knowledgeBaseVersion, "0.5.0-drive-sourced");
  assert.equal(requests.length, 1);
});

test("corrects a people-filled scenery brief once", async () => {
  const requests = [];
  const invalidBrief = {
    ...validBrief,
    creativeConcept: "Men gathering beside a peaceful mountain lake.",
  };
  const generator = createStudioCreativeBriefGenerator({
    model: "test-text-model",
    client: {
      models: {
        generateContent: async (request) => {
          requests.push(request);
          return {
            text: JSON.stringify(
                requests.length === 1 ? invalidBrief : validBrief,
            ),
          };
        },
      },
    },
  });

  const result = await generator({
    request: "Create an inviting image for a Men's Night.",
    audiencePersona: "sooner_sam",
    visualApproach: "scenery",
    audienceGender: "male",
    aspectRatio: "16:9",
  });

  assert.deepEqual(result.brief, validBrief);
  assert.equal(result.correctionAttempts, 1);
  assert.equal(requests.length, 2);
  assert.match(
      requests[1].config.systemInstruction,
      /CORRECTION REQUIRED/i,
  );
  assert.match(
      requests[1].config.systemInstruction,
      /prohibits people/i,
  );
});

test("allows male audience strategy in a people-free scenery brief", () => {
  const brief = {
    ...validBrief,
    audienceApplication:
      "The restrained, purposeful atmosphere is intended to resonate with men.",
  };

  assert.deepEqual(
      validateStudioCreativeBrief_(brief, {
        visualApproach: "scenery",
        audienceGender: "male",
      }),
      brief,
  );
});
