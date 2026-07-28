import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import {dirname, extname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";

import {GoogleGenAI} from "@google/genai";

const {values} = parseArgs({
  options: {
    source: {type: "string"},
    instruction: {type: "string"},
    model: {type: "string"},
    size: {type: "string"},
    output: {type: "string"},
  },
  strict: true,
});
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");

if (!values.source) {
  throw new Error("Provide the image to refine with --source=/path/image.jpg.");
}

const apiKey = String(
    process.env.STUDIO_GEMINI_API_KEY ||
    process.env.WAYFINDER_GEMINI_API_KEY ||
    "",
).trim();
if (!apiKey) {
  throw new Error("Set STUDIO_GEMINI_API_KEY in functions/.secret.local.");
}

const model = String(
    values.model ||
    process.env.STUDIO_PRO_IMAGE_MODEL ||
    "gemini-3-pro-image",
).trim();
const imageSize = cleanEnum_(
    values.size || "1K",
    ["1K", "2K", "4K"],
    "image size",
);
const sourcePath = resolve(repoRoot, values.source);
const sourceBytes = await readFile(sourcePath);
const sourceMimeType = mimeTypeForPath_(sourcePath);
const sourceMetadataPath = sourcePath.replace(/\.[^.]+$/, ".json");
const sourceMetadata = await readOptionalJson_(sourceMetadataPath);
const aspectRatio = cleanEnum_(
    sourceMetadata && sourceMetadata.input &&
      sourceMetadata.input.aspectRatio || "1:1",
    ["1:1", "4:5", "16:9"],
    "aspect ratio",
);
const prompt = buildRefinementPrompt_(
    sourceMetadata,
    values.instruction,
);
const client = new GoogleGenAI({apiKey});
const startedAt = Date.now();
const interaction = await client.interactions.create({
  model,
  input: [
    {
      type: "image",
      mime_type: sourceMimeType,
      data: sourceBytes.toString("base64"),
    },
    {
      type: "text",
      text: prompt,
    },
  ],
  store: false,
  response_format: {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: aspectRatio,
    image_size: imageSize,
  },
});

const outputImage = interaction && interaction.output_image;
if (!outputImage || !outputImage.data) {
  throw new Error("Nano Banana Pro returned no usable image.");
}

const outputBytes = Buffer.from(outputImage.data, "base64");
const outputDirectory = values.output ?
  resolve(repoRoot, values.output) :
  resolve(repoRoot, "output/studio");
const generatedAt = new Date();
const timestamp = generatedAt.toISOString().replace(/[:.]/g, "-");
const imagePath =
  resolve(outputDirectory, `studio-pro-refined-${timestamp}.jpg`);
const metadataPath =
  resolve(outputDirectory, `studio-pro-refined-${timestamp}.json`);

await Promise.all([
  writeFile(imagePath, outputBytes),
  writeFile(metadataPath, JSON.stringify({
    generatedAt: generatedAt.toISOString(),
    operation: "image_to_image_photorealism_refinement",
    model,
    interactionId: String(interaction.id || ""),
    source: {
      imagePath: sourcePath,
      metadataPath: sourceMetadata ? sourceMetadataPath : null,
      mimeType: sourceMimeType,
      byteLength: sourceBytes.byteLength,
      sha256: sha256_(sourceBytes),
      originalModel: sourceMetadata && sourceMetadata.model || null,
      originalKnowledgeBaseVersion:
        sourceMetadata && sourceMetadata.knowledgeBaseVersion || null,
    },
    promptSha256: sha256_(prompt),
    prompt,
    output: {
      imagePath,
      mimeType: outputImage.mime_type || "image/jpeg",
      byteLength: outputBytes.byteLength,
      aspectRatio,
      imageSize,
    },
    latencyMs: Date.now() - startedAt,
    scope: "local_prototype_only",
  }, null, 2) + "\n"),
]);

console.log(JSON.stringify({
  ok: true,
  operation: "image_to_image_photorealism_refinement",
  model,
  sourcePath,
  imagePath,
  metadataPath,
  aspectRatio,
  imageSize,
  latencyMs: Date.now() - startedAt,
  byteLength: outputBytes.byteLength,
}, null, 2));

function buildRefinementPrompt_(metadata, customInstruction) {
  const context = metadata ? {
    audiencePersona: metadata.audiencePersona,
    audienceGender: metadata.audienceGender,
    visualApproach: metadata.visualApproach,
    creativeBrief:
      metadata.creativeDirector && metadata.creativeDirector.brief,
  } : null;
  const instruction = String(customInstruction || "").trim() ||
    "Polish this image into a convincingly realistic professional location " +
    "photograph.";

  return [
    "Use the supplied image as the source for a restrained refinement.",
    "This is a polish pass, not a redesign.",
    instruction,
    "",
    "PRESERVE:",
    "- Preserve the square composition, camera viewpoint, garden pathway, " +
      "tropical setting, torch and string-light placement, overall palette, " +
      "rightward visual focus, and usable negative space.",
    "- Keep the same event concept and emotional intent.",
    "",
    "IMPROVE PHOTOGRAPHIC REALISM:",
    "- Make the botany coherent and naturally varied, with believable leaf " +
      "structure, scale, overlap, moisture, and depth.",
    "- Correct torch construction, flame physics, light falloff, " +
      "reflections, shadows, and color temperature.",
    "- Make stone, soil, ceramic, bamboo, and plant textures physically " +
      "credible and free of melted, repeated, or synthetic-looking detail.",
    "- Use natural lens behavior, tonal rolloff, atmospheric depth, and " +
      "subtle sensor grain appropriate to a high-end camera.",
    "- Remove obvious generative artifacts while retaining natural " +
      "imperfection.",
    "",
    "DO NOT:",
    "- Do not add people, faces, hands, silhouettes, text, logos, signs, " +
      "watermarks, leis, tiki masks, coconuts, or party props.",
    "- Do not add artificial overlays, excessive HDR, fantasy glow, plastic " +
      "foliage, oversharpening, or CGI polish.",
    "- Do not crop, reframe, replace, or substantially rearrange the scene.",
    ...(context ? [
      "",
      "ORIGINAL APPROVED CREATIVE CONTEXT:",
      JSON.stringify(context),
    ] : []),
    "",
    "Return only the refined image.",
  ].join("\n");
}

async function readOptionalJson_(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function sha256_(value) {
  return createHash("sha256").update(value).digest("hex");
}

function mimeTypeForPath_(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  throw new Error("Source image must be JPEG, PNG, or WebP.");
}

function cleanEnum_(value, allowed, label) {
  const normalized = String(value || "").trim();
  if (allowed.includes(normalized)) return normalized;
  throw new Error(`Unsupported ${label}: ${normalized}.`);
}
