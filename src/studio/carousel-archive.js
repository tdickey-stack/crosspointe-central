import {zipSync} from "fflate";

import {MAX_STUDIO_EXPORT_FILENAME_LENGTH} from "./creative-filename.js";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const SAFE_ARCHIVE_FILENAME = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,${MAX_STUDIO_EXPORT_FILENAME_LENGTH - 1}}$`,
  "u",
);
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function validatePngBytes(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new Error("Studio could not package an invalid carousel PNG.");
  }
  return bytes;
}

export function pngDataUrlToBytes(dataUrl) {
  const value = String(dataUrl || "");
  if (!value.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error("Studio could not package an invalid carousel PNG.");
  }

  try {
    const binary = atob(value.slice(PNG_DATA_URL_PREFIX.length));
    if (!binary.length) throw new Error("Empty PNG");
    return validatePngBytes(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch (_error) {
    throw new Error("Studio could not package an invalid carousel PNG.");
  }
}

export function buildCarouselZip(files) {
  if (!Array.isArray(files) || !files.length) {
    throw new Error("Studio did not prepare any carousel PNGs to package.");
  }

  const entries = Object.create(null);
  files.forEach((file) => {
    const filename = String(file?.filename || "");
    if (!SAFE_ARCHIVE_FILENAME.test(filename) || !filename.endsWith(".png")) {
      throw new Error("Studio could not package an invalid carousel filename.");
    }
    if (Object.hasOwn(entries, filename)) {
      throw new Error("Studio could not package duplicate carousel filenames.");
    }
    entries[filename] = file?.bytes instanceof Uint8Array
      ? validatePngBytes(file.bytes)
      : pngDataUrlToBytes(file?.dataUrl);
  });

  // PNG data is already compressed, so store it without recompressing it.
  return zipSync(entries, {level: 0});
}
