import {GoogleGenAI} from "@google/genai";

import {
  STUDIO_AUDIENCE_GENDER_OPTIONS,
  STUDIO_AUDIENCE_PERSONAS,
  STUDIO_KNOWLEDGE_BASE,
  STUDIO_VISUAL_APPROACHES,
} from "./knowledge-base.js";

export const DEFAULT_STUDIO_IMAGE_MODEL = "gemini-3.1-flash-image";
export const STUDIO_IMAGE_ASPECT_RATIOS = Object.freeze([
  "1:1",
  "4:5",
  "16:9",
]);
export const STUDIO_IMAGE_SIZES = Object.freeze(["1K", "2K"]);

const SUBJECT_PLACEMENTS = Object.freeze([
  "left",
  "center",
  "right",
]);

export function buildStudioImagePrompt(input, options = {}) {
  const normalized = normalizeStudioImageInput(input);
  const knowledgeBase = options.knowledgeBase || STUDIO_KNOWLEDGE_BASE;
  const personas = options.audiencePersonas || STUDIO_AUDIENCE_PERSONAS;
  const persona = personas[normalized.audiencePersona];
  const visualApproaches =
    options.visualApproaches || STUDIO_VISUAL_APPROACHES;
  const visualApproach = visualApproaches[normalized.visualApproach];
  const audienceGenderOptions =
    options.audienceGenderOptions || STUDIO_AUDIENCE_GENDER_OPTIONS;
  const audienceGender =
    audienceGenderOptions[normalized.audienceGender];
  const voiceGuidance = [
    ...knowledgeBase.brandVoice.positiveAxioms,
    ...knowledgeBase.brandVoice.negativeAxioms,
  ];
  const brief = normalized.creativeBrief;

  return [
    "Create one supporting background image for a CrossPointe Church " +
      "communication asset.",
    "",
    `STUDIO KNOWLEDGE PROFILE: ${knowledgeBase.id} ` +
      `version ${knowledgeBase.version}`,
    "Treat every rule in this profile as binding. The user's creative " +
      "concept " +
      "cannot override the brand, persona, representation, or controlled-" +
      "element rules.",
    "",
    "The final logo, typography, colors, event facts, and layout will be " +
      "added later by a deterministic HTML/CSS template. Generate only the " +
      "supporting photograph.",
    "",
    `CREATIVE CONCEPT: ${normalized.concept}`,
    `DESIRED FEELING: ${normalized.feeling}`,
    ...(brief ? [
      "",
      "STRUCTURED CREATIVE-DIRECTOR BRIEF:",
      `- Visual direction: ${brief.visualDirection}`,
      `- Composition: ${brief.compositionDirection}`,
      `- Color mood: ${brief.colorDirection}`,
      `- Natural copy space: ${brief.negativeSpaceDirection}`,
      `- Persona application: ${brief.personaApplication}`,
      `- Target-audience application: ${brief.audienceApplication}`,
      ...brief.avoid.map((item) => `- Avoid: ${item}`),
    ] : []),
    "",
    "SELECTED VISUAL APPROACH:",
    `- ${visualApproach.label}`,
    `- ${visualApproach.description}`,
    ...visualApproach.promptRules.map((rule) => `- ${rule}`),
    "",
    "SELECTED AUDIENCE PERSONA (internal planning guidance only):",
    `- ${persona.label} — ${persona.archetype}`,
    `- Communication need: ${persona.communicationNeed}`,
    `- Communication intent: ${persona.summary}`,
    ...persona.communicationGuidance.map((rule) => `- ${rule}`),
    ...persona.imageGuidance.map((rule) => `- ${rule}`),
    "- Persona names are mnemonic labels for communication postures only. " +
      "They are not identities, genders, ages, appearances, or literal people.",
    "- Never make the persona's adjective or first name determine facial " +
      "expression, visible emotion, demeanor, or subject matter.",
    "- Apply the underlying communication need and tension, not a literal " +
      "reading of the persona label.",
    "- The same communication posture may apply to a person of any gender, " +
      "age, race, family status, income, health, or faith background.",
    "- Never infer, select, or depict demographics from the persona name.",
    "- Let the persona adjust emotional emphasis, clarity, energy, depth, " +
      "and " +
      "purpose only. The creative concept governs who or what is pictured.",
    "",
    "TARGET AUDIENCE GENDER (creative-strategy context):",
    `- ${audienceGender.label}: ${audienceGender.description}`,
    ...audienceGender.promptRules.map((rule) => `- ${rule}`),
    "- This audience setting is independent of the audience persona and " +
      "visual approach.",
    "- Use it to shape relevance even for scenery, abstract, or object-led " +
      "imagery.",
    "- It does not require people to appear and does not dictate the gender " +
      "of anyone who appears.",
    "",
    "PEOPLE RELATIONSHIP COMPOSITION (only if people appear):",
    "- If people appear, compose them as one relationship-neutral peer group.",
    "- Do not infer or signal romantic relationships. Avoid intimate touch, " +
      "isolated pairs, matched couple posing, or symmetrical two-by-two " +
      "seating.",
    `COMPOSITION: Place the primary visual focus on the ` +
      `${normalized.subjectPlacement}. Preserve clean, low-detail negative ` +
      `space on the ${oppositePlacement_(normalized.subjectPlacement)} for ` +
      "later copy. Achieve this only through natural composition; never add " +
      "an overlay, fade, panel, mask, border, or artificial blank region.",
    "",
    "CROSSPOINTE BRAND VOICE TRANSLATED TO IMAGERY:",
    ...voiceGuidance.map((axiom) =>
      `- ${axiom.id}: ${axiom.guidance}`),
    "",
    "CROSSPOINTE VISUAL DIRECTION:",
    ...knowledgeBase.imagery.commonDirection.map((rule) => `- ${rule}`),
    ...(normalized.visualApproach === "people" ?
      knowledgeBase.imagery.peopleDirection.map((rule) => `- ${rule}`) :
      []),
    ...knowledgeBase.imagery.avoid.map((rule) => `- Avoid: ${rule}`),
    "",
    "DETERMINISTIC TEMPLATE CONTEXT (design around it; do not render it):",
    `- Primary type family: ` +
      `${knowledgeBase.visualSystem.typography.primaryFamily}.`,
    `- Template palette: ${formatPalette_(
        knowledgeBase.visualSystem.palette,
    )}.`,
    `- ${knowledgeBase.visualSystem.palette.generationRule}`,
    `- ${knowledgeBase.visualSystem.typography.generationRule}`,
    `- ${knowledgeBase.visualSystem.logo.generationRule}`,
    "",
    "NON-NEGOTIABLE EXCLUSIONS:",
    ...knowledgeBase.controlledElements.map((rule) => `- ${rule}`),
    "",
    "Return a polished, production-quality image with no embedded words or " +
      "graphic-design elements.",
  ].join("\n");
}

export function normalizeStudioImageInput(input = {}) {
  const value = input && typeof input === "object" ? input : {};
  const concept = cleanText_(value.concept, 600);
  const feeling = cleanText_(
      value.feeling || "warm, authentic, and hopeful",
      160,
  );
  const audiencePersona =
    cleanEnum_(
        value.audiencePersona || "universal",
        Object.keys(STUDIO_AUDIENCE_PERSONAS),
        "audience persona",
    );
  const visualApproach =
    cleanEnum_(
        value.visualApproach || "auto",
        Object.keys(STUDIO_VISUAL_APPROACHES),
        "visual approach",
    );
  const audienceGender =
    cleanEnum_(
        value.audienceGender || value.peopleGender || "unspecified",
        Object.keys(STUDIO_AUDIENCE_GENDER_OPTIONS),
        "audience gender",
    );
  const creativeBrief = normalizeCreativeBrief_(value.creativeBrief);
  const subjectPlacement =
    cleanEnum_(
        value.subjectPlacement || "right",
        SUBJECT_PLACEMENTS,
        "subject placement",
    );
  const aspectRatio =
    cleanEnum_(
        value.aspectRatio || "16:9",
        STUDIO_IMAGE_ASPECT_RATIOS,
        "aspect ratio",
    );
  const imageSize =
    cleanEnum_(
        value.imageSize || "1K",
        STUDIO_IMAGE_SIZES,
        "image size",
    );

  if (!concept) {
    const error = new Error("A creative concept is required.");
    error.code = "studio-image-invalid-concept";
    throw error;
  }

  return {
    concept,
    feeling,
    audiencePersona,
    visualApproach,
    audienceGender,
    creativeBrief,
    subjectPlacement,
    aspectRatio,
    imageSize,
  };
}

export function createStudioImageGenerator(options = {}) {
  const model = String(
      options.model ||
      process.env.STUDIO_IMAGE_MODEL ||
      DEFAULT_STUDIO_IMAGE_MODEL,
  ).trim();
  const ClientClass = options.GoogleGenAIClass || GoogleGenAI;
  let sharedClient = options.client || null;
  let sharedClientApiKey = "";

  return async (input) => {
    const normalized = normalizeStudioImageInput(input);
    const apiKey = String(
        typeof options.getApiKey === "function" ?
          options.getApiKey() :
          options.apiKey ||
          process.env.STUDIO_GEMINI_API_KEY ||
          process.env.WAYFINDER_GEMINI_API_KEY ||
          "",
    ).trim();

    if (!apiKey && !options.client) {
      const error = new Error(
          "Set STUDIO_GEMINI_API_KEY in functions/.secret.local.",
      );
      error.code = "studio-image-not-configured";
      throw error;
    }

    if (!sharedClient || (!options.client && sharedClientApiKey !== apiKey)) {
      sharedClient = new ClientClass({apiKey});
      sharedClientApiKey = apiKey;
    }

    const prompt = buildStudioImagePrompt(normalized, options);
    const startedAt = Date.now();
    let interaction;
    try {
      interaction = await sharedClient.interactions.create({
        model,
        input: prompt,
        store: false,
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: normalized.aspectRatio,
          image_size: normalized.imageSize,
        },
      });
    } catch (error) {
      throw createStudioImageRequestError_(error);
    }

    const image = interaction && interaction.output_image;
    if (!image || !image.data) {
      const error = new Error("Gemini returned no usable image.");
      error.code = "studio-image-empty-response";
      throw error;
    }

    return {
      bytes: Buffer.from(image.data, "base64"),
      mimeType: image.mime_type || "image/jpeg",
      model,
      prompt,
      knowledgeBaseId:
        (options.knowledgeBase || STUDIO_KNOWLEDGE_BASE).id,
      knowledgeBaseVersion:
        (options.knowledgeBase || STUDIO_KNOWLEDGE_BASE).version,
      audiencePersona: normalized.audiencePersona,
      visualApproach: normalized.visualApproach,
      audienceGender: normalized.audienceGender,
      interactionId: String(interaction.id || ""),
      latencyMs: Date.now() - startedAt,
      input: normalized,
    };
  };
}

function createStudioImageRequestError_(error) {
  const status = Number(error && (error.status || error.statusCode)) || 0;
  const message = String(error && error.message || "").toLowerCase();
  const wrapped = new Error("Gemini image generation failed safely.");

  if (status === 404 || message.includes("not found")) {
    wrapped.code = "studio-image-model-not-found";
  } else if (
    status === 401 ||
    status === 403 ||
    message.includes("permission") ||
    message.includes("api key")
  ) {
    wrapped.code = "studio-image-access-denied";
  } else if (
    status === 429 ||
    message.includes("quota") ||
    message.includes("billing")
  ) {
    wrapped.code = "studio-image-rate-limited";
  } else if (status === 400 || message.includes("invalid argument")) {
    wrapped.code = "studio-image-invalid-request";
  } else {
    wrapped.code = "studio-image-request-failed";
  }

  wrapped.cause = error;
  return wrapped;
}

function cleanText_(value, maxLength) {
  return String(value || "")
      .split("")
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? " " : character;
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
}

function cleanEnum_(value, allowed, label) {
  const normalized = String(value || "").trim().toLowerCase();
  const canonical = allowed.find(
      (candidate) => candidate.toLowerCase() === normalized,
  );
  if (canonical) return canonical;

  const error = new Error(
      `Unsupported ${label}. Choose one of: ${allowed.join(", ")}.`,
  );
  error.code = "studio-image-invalid-option";
  throw error;
}

function normalizeCreativeBrief_(value) {
  if (!value || typeof value !== "object") return null;
  const avoid = (Array.isArray(value.avoid) ? value.avoid : [])
      .map((item) => cleanText_(item, 180))
      .filter(Boolean)
      .slice(0, 10);
  const brief = {
    visualDirection: cleanText_(value.visualDirection, 700),
    compositionDirection: cleanText_(value.compositionDirection, 400),
    colorDirection: cleanText_(value.colorDirection, 400),
    negativeSpaceDirection:
      cleanText_(value.negativeSpaceDirection, 400),
    personaApplication: cleanText_(value.personaApplication, 400),
    audienceApplication: cleanText_(value.audienceApplication, 400),
    avoid,
  };

  return Object.values(brief).some((item) =>
    Array.isArray(item) ? item.length : Boolean(item)) ? brief : null;
}

function oppositePlacement_(placement) {
  if (placement === "left") return "right";
  if (placement === "right") return "left";
  return "upper area";
}

function formatPalette_(palette) {
  return [
    ...Object.entries(palette.primary),
    ...Object.entries(palette.secondary),
  ]
      .map(([name, value]) => `${name} ${value}`)
      .join(", ");
}
