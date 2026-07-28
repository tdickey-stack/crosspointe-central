import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStudioImagePrompt,
  createStudioImageGenerator,
  normalizeStudioImageInput,
} from "./image-generation.js";
import {
  getStudioAudienceGenderOptions,
  getStudioAudiencePersonaOptions,
  getStudioVisualApproachOptions,
  STUDIO_AUDIENCE_GENDER_OPTIONS,
  STUDIO_AUDIENCE_PERSONAS,
  STUDIO_VISUAL_APPROACHES,
} from "./knowledge-base.js";

test("builds a brand-directed prompt with controlled exclusions", () => {
  const prompt = buildStudioImagePrompt({
    concept: "A multigenerational family arriving at a community gathering.",
    feeling: "welcoming and authentic",
    audiencePersona: "new_nancy",
    visualApproach: "people",
    subjectPlacement: "right",
  });

  assert.match(prompt, /crosspointe-studio-knowledge version 0\.5\.0/i);
  assert.match(prompt, /New Nancy — The Restorer/i);
  assert.match(prompt, /Montserrat/i);
  assert.match(prompt, /#EF3E2D/);
  assert.match(prompt, /#33BECC/);
  assert.match(prompt, /mnemonic labels for communication postures only/i);
  assert.match(prompt, /not identities, genders, ages, appearances/i);
  assert.match(prompt, /same communication posture may apply to a person/i);
  assert.match(prompt, /creative concept governs who or what is pictured/i);
  assert.match(prompt, /relationship-neutral peer group/i);
  assert.match(prompt, /symmetrical two-by-two seating/i);
  assert.match(prompt, /supporting background image/i);
  assert.match(prompt, /People \/ Community/i);
  assert.match(prompt, /Place the primary visual focus on the right/i);
  assert.match(prompt, /negative space on the left/i);
  assert.match(prompt, /Do not render logos/i);
  assert.match(prompt, /no embedded words/i);
  assert.match(prompt, /completely plain and unbranded/i);
  assert.match(prompt, /pseudo-text/i);
  assert.match(prompt, /never add an overlay, fade, panel, mask, border/i);
  assert.match(prompt, /copy space only through natural composition/i);
});

test("Caring Carly guides communication without demographic targeting", () => {
  const prompt = buildStudioImagePrompt({
    concept: "Volunteers calmly organizing supplies together.",
    audiencePersona: "caring_carly",
    visualApproach: "people",
  });

  assert.match(prompt, /Caring Carly — The Stabilizer/);
  assert.match(prompt, /clarity, stability, compassion/i);
  assert.match(prompt, /always caring for others/i);
  assert.match(prompt, /not default to a smiling caregiver/i);
  assert.match(prompt, /Never infer, select, or depict demographics/i);
  assert.doesNotMatch(prompt, /50-year-old|working mother|female|woman/i);
});

test("normalizes safe prototype defaults", () => {
  assert.deepEqual(
      normalizeStudioImageInput({concept: "  A calm community meal.  "}),
      {
        concept: "A calm community meal.",
        feeling: "warm, authentic, and hopeful",
        audiencePersona: "universal",
        visualApproach: "auto",
        audienceGender: "unspecified",
        creativeBrief: null,
        subjectPlacement: "right",
        aspectRatio: "16:9",
        imageSize: "1K",
      },
  );
});

test("uses gender as target-audience strategy, not a cast requirement", () => {
  const prompt = buildStudioImagePrompt({
    concept: "A thoughtful small-group discussion.",
    audiencePersona: "happy_henry",
    visualApproach: "people",
    audienceGender: "male",
  });

  assert.match(prompt, /TARGET AUDIENCE GENDER/i);
  assert.match(prompt, /Men: Shape the concept to resonate with men/i);
  assert.match(prompt, /not as a cast requirement/i);
  assert.match(
      prompt,
      /does not require people to appear/i,
  );
  assert.match(prompt, /comfortable self-sufficiency/i);
  assert.match(prompt, /Do not default to laughter, celebration/i);
});

test("scenery keeps persona posture while explicitly excluding people", () => {
  const prompt = buildStudioImagePrompt({
    concept: "A quiet path through an Oklahoma prairie at sunrise.",
    audiencePersona: "happy_henry",
    visualApproach: "scenery",
  });

  assert.match(prompt, /Scenery \/ Environment/);
  assert.match(prompt, /Happy Henry — The Explorer/);
  assert.match(prompt, /Do not include any people, faces, silhouettes/i);
  assert.match(prompt, /landscape, architecture, light, weather/i);
  assert.doesNotMatch(prompt, /Use candid documentary realism/i);
});

test("male target audience still guides scenery", () => {
  const prompt = buildStudioImagePrompt({
    concept: "A purposeful outdoor gathering place at twilight.",
    audiencePersona: "sooner_sam",
    visualApproach: "scenery",
    audienceGender: "male",
  });

  assert.match(prompt, /Men: Shape the concept to resonate with men/i);
  assert.match(prompt, /shape relevance even for scenery/i);
  assert.match(prompt, /does not require people to appear/i);
  assert.match(prompt, /Do not include any people, faces, silhouettes/i);
});

test("passes a creative-director brief into the image prompt", () => {
  const prompt = buildStudioImagePrompt({
    concept: "Soft organic currents opening toward a calm center.",
    feeling: "calm, stable, compassionate, inviting",
    audiencePersona: "caring_carly",
    visualApproach: "abstract",
    creativeBrief: {
      visualDirection: "Tactile flowing layers with warm diffused light.",
      compositionDirection: "Flow from lower right into an open upper left.",
      colorDirection: "Warm neutrals with restrained blush and mint.",
      negativeSpaceDirection: "Use calmer natural texture on the left.",
      personaApplication: "Clarity, steadiness, and visual order.",
      audienceApplication:
        "The concept is broadly relevant without a gender emphasis.",
      avoid: ["people", "text", "graphic panels"],
    },
  });

  assert.match(prompt, /STRUCTURED CREATIVE-DIRECTOR BRIEF/);
  assert.match(prompt, /Tactile flowing layers/);
  assert.match(prompt, /Clarity, steadiness, and visual order/);
  assert.match(prompt, /Avoid: graphic panels/);
});

test("rejects unsupported output options before calling Gemini", () => {
  assert.throws(
      () => normalizeStudioImageInput({
        concept: "A welcoming lobby.",
        imageSize: "4K",
      }),
      {
        code: "studio-image-invalid-option",
      },
  );
});

test("exposes all approved persona choices for a future dropdown", () => {
  const options = getStudioAudiencePersonaOptions();

  assert.equal(options.length, 6);
  assert.deepEqual(
      options.map((option) => option.value),
      Object.keys(STUDIO_AUDIENCE_PERSONAS),
  );
  assert.equal(
      options.find((option) => option.value === "happy_henry").label,
      "Happy Henry — The Explorer",
  );
});

test("exposes people-optional visual choices for a future dropdown", () => {
  const options = getStudioVisualApproachOptions();

  assert.equal(options.length, 5);
  assert.deepEqual(
      options.map((option) => option.value),
      Object.keys(STUDIO_VISUAL_APPROACHES),
  );
  assert.equal(
      options.find((option) => option.value === "scenery").label,
      "Scenery / Environment",
  );
});

test("exposes audience-gender choices for a future dropdown", () => {
  const options = getStudioAudienceGenderOptions();

  assert.equal(options.length, 4);
  assert.deepEqual(
      options.map((option) => option.value),
      Object.keys(STUDIO_AUDIENCE_GENDER_OPTIONS),
  );
  assert.equal(
      options.find((option) => option.value === "male").label,
      "Men",
  );
});

test("returns decoded image bytes and lineage metadata", async () => {
  const requests = [];
  const generator = createStudioImageGenerator({
    model: "test-image-model",
    client: {
      interactions: {
        create: async (request) => {
          requests.push(request);
          return {
            id: "interaction-123",
            output_image: {
              data: Buffer.from("prototype-image").toString("base64"),
              mime_type: "image/jpeg",
            },
          };
        },
      },
    },
  });

  const result = await generator({
    concept: "A welcoming community gathering.",
    aspectRatio: "4:5",
  });

  assert.equal(result.bytes.toString(), "prototype-image");
  assert.equal(result.interactionId, "interaction-123");
  assert.equal(result.knowledgeBaseVersion, "0.5.0-drive-sourced");
  assert.equal(result.audiencePersona, "universal");
  assert.equal(result.visualApproach, "auto");
  assert.equal(result.audienceGender, "unspecified");
  assert.equal(requests[0].store, false);
  assert.deepEqual(requests[0].response_format, {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: "4:5",
    image_size: "1K",
  });
});
