import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, extname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";

import {
  createStudioCreativeBriefGenerator,
} from "../studio/creative-brief.js";
import {createStudioImageGenerator} from "../studio/image-generation.js";

const {values} = parseArgs({
  options: {
    "request": {type: "string"},
    "concept": {type: "string"},
    "feeling": {type: "string"},
    "persona": {type: "string"},
    "visual": {type: "string"},
    "gender": {type: "string"},
    "placement": {type: "string"},
    "aspect": {type: "string"},
    "size": {type: "string"},
    "output": {type: "string"},
    "model": {type: "string"},
    "from-metadata": {type: "string"},
  },
  strict: true,
});
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");

if (values.request && values.concept) {
  throw new Error("Use either --request or --concept, not both.");
}
if (values["from-metadata"] && (values.request || values.concept)) {
  throw new Error(
      "Use --from-metadata by itself instead of --request or --concept.",
  );
}

let sourceGeneration = null;
let sourceInput = null;
if (values["from-metadata"]) {
  const sourceMetadataPath = resolve(repoRoot, values["from-metadata"]);
  sourceGeneration = JSON.parse(await readFile(sourceMetadataPath, "utf8"));
  sourceInput = sourceGeneration && sourceGeneration.input;
  if (!sourceInput || !sourceInput.concept) {
    throw new Error("The source metadata has no reusable Studio input.");
  }
  sourceGeneration = {
    metadataPath: sourceMetadataPath,
    generatedAt: sourceGeneration.generatedAt || null,
    model: sourceGeneration.model || null,
    promptSha256: sourceGeneration.promptSha256 || null,
  };
}

let creativeDirector = null;
let concept = values.concept || sourceInput && sourceInput.concept || "";
let feeling = values.feeling || sourceInput && sourceInput.feeling || "";
let creativeBrief = sourceInput && sourceInput.creativeBrief || null;
if (sourceInput) {
  const sourceMetadata = JSON.parse(
      await readFile(sourceGeneration.metadataPath, "utf8"),
  );
  creativeDirector = sourceMetadata.creativeDirector ? {
    ...sourceMetadata.creativeDirector,
    reused: true,
    sourceMetadataPath: sourceGeneration.metadataPath,
  } : null;
} else if (values.request || !concept) {
  const generateBrief = createStudioCreativeBriefGenerator();
  creativeDirector = await generateBrief({
    request: values.request ||
      "Create a welcoming general-purpose CrossPointe background image.",
    audiencePersona: values.persona || "new_nancy",
    visualApproach: values.visual || "auto",
    audienceGender: values.gender || "unspecified",
    subjectPlacement: values.placement || "right",
    aspectRatio: values.aspect || "16:9",
  });
  creativeBrief = creativeDirector.brief;
  concept = creativeBrief.creativeConcept;
  feeling = creativeBrief.emotionalTone;
}

const audiencePersona =
  values.persona || sourceInput && sourceInput.audiencePersona || "new_nancy";
const visualApproach =
  values.visual || sourceInput && sourceInput.visualApproach || "auto";
const audienceGender =
  values.gender || sourceInput && sourceInput.audienceGender || "unspecified";
const subjectPlacement =
  values.placement || sourceInput && sourceInput.subjectPlacement || "right";
const aspectRatio =
  values.aspect || sourceInput && sourceInput.aspectRatio || "16:9";
const imageSize =
  values.size || sourceInput && sourceInput.imageSize || "1K";
const generateImage = createStudioImageGenerator(
    values.model ? {model: values.model} : {},
);
const result = await generateImage({
  concept,
  feeling: feeling || "warm, welcoming, authentic, and hopeful",
  audiencePersona,
  visualApproach,
  audienceGender,
  creativeBrief,
  subjectPlacement,
  aspectRatio,
  imageSize,
});

const outputDirectory = values.output ?
  resolve(repoRoot, values.output) :
  resolve(repoRoot, "output/studio");
const generatedAt = new Date();
const timestamp = generatedAt.toISOString().replace(/[:.]/g, "-");
const extension = extensionForMimeType_(result.mimeType);
const imagePath = resolve(outputDirectory, `studio-${timestamp}${extension}`);
const metadataPath = resolve(outputDirectory, `studio-${timestamp}.json`);
const promptSha256 = createHash("sha256")
    .update(result.prompt)
    .digest("hex");

await mkdir(outputDirectory, {recursive: true});
await Promise.all([
  writeFile(imagePath, result.bytes),
  writeFile(metadataPath, JSON.stringify({
    generatedAt: generatedAt.toISOString(),
    model: result.model,
    interactionId: result.interactionId,
    knowledgeBaseId: result.knowledgeBaseId,
    knowledgeBaseVersion: result.knowledgeBaseVersion,
    audiencePersona: result.audiencePersona,
    visualApproach: result.visualApproach,
    audienceGender: result.audienceGender,
    creativeDirector: creativeDirector ? {
      model: creativeDirector.model,
      latencyMs: creativeDirector.latencyMs,
      correctionAttempts: creativeDirector.correctionAttempts,
      brief: creativeDirector.brief,
      reused: Boolean(creativeDirector.reused),
      sourceMetadataPath: creativeDirector.sourceMetadataPath || null,
    } : null,
    sourceGeneration,
    promptSha256,
    input: result.input,
    output: {
      mimeType: result.mimeType,
      byteLength: result.bytes.byteLength,
      imagePath,
    },
    latencyMs: result.latencyMs,
    scope: "local_prototype_only",
  }, null, 2) + "\n"),
]);

console.log(JSON.stringify({
  ok: true,
  imagePath,
  metadataPath,
  model: result.model,
  creativeDirectorModel: creativeDirector && creativeDirector.model,
  creativeDirectorLatencyMs: creativeDirector && creativeDirector.latencyMs,
  creativeDirectorCorrectionAttempts:
    creativeDirector && creativeDirector.correctionAttempts,
  creativeDirectorReused: Boolean(
      creativeDirector && creativeDirector.reused,
  ),
  creativeBrief: creativeDirector && creativeDirector.brief,
  latencyMs: result.latencyMs,
  byteLength: result.bytes.byteLength,
}, null, 2));

function extensionForMimeType_(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/png") return ".png";

  const candidate = extname(String(mimeType || ""));
  return candidate || ".img";
}
