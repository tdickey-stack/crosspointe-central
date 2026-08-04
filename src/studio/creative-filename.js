export const CREATIVE_FILENAME_PREFERENCE_KEY =
  "crosspointe-central-studio-creative-filename-v1";

export function getCreativeDateStamp(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid export date.");
  }
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function normalizeCreativeFilenameToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " AND ")
    .replace(/['’]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCreativeVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1 || version > 999) {
    throw new Error("Version must be a whole number from 1 to 999.");
  }
  return `V${String(version).padStart(3, "0")}`;
}

export function buildCreativeFilename({
  contentId,
  workType,
  description = "",
  version = 1,
  date = new Date(),
} = {}) {
  const normalizedContentId = normalizeCreativeFilenameToken(contentId);
  const normalizedWorkType = normalizeCreativeFilenameToken(workType);
  const normalizedDescription = normalizeCreativeFilenameToken(description);

  if (!normalizedContentId) {
    throw new Error("Content ID is required.");
  }
  if (!normalizedWorkType) {
    throw new Error("Work Type is required.");
  }

  return [
    normalizedContentId,
    normalizedWorkType,
    normalizedDescription,
    getCreativeDateStamp(date),
    formatCreativeVersion(version),
  ]
    .filter(Boolean)
    .join("_");
}
