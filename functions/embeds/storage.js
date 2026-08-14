/* eslint-disable require-jsdoc */

import crypto from "node:crypto";

import {createCentralEmbedError} from "./errors.js";
import {
  CENTRAL_EMBED_IMAGE_MAX_BYTES,
  CENTRAL_EMBED_IMAGE_STORAGE_PREFIX,
  normalizeCentralEmbedId,
} from "./payload.js";

export async function uploadCentralEmbedImage(options) {
  const source = options && options.sourceData &&
    typeof options.sourceData === "object" ? options.sourceData : {};
  const actor = options && options.actor || {};
  const admin = options && options.admin;
  const embedId = normalizeCentralEmbedId(options && options.embedId);
  const sourceEventId = String(source.sourceEventId || "")
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 160);
  const match = String(source.dataUrl || "").match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );

  if (!embedId || !sourceEventId || !match) {
    throw createCentralEmbedError(
        "invalid-payload",
        "Choose a JPEG, PNG, or WebP image for a selected event.",
    );
  }

  const contentType = match[1].toLowerCase();
  const imageBuffer = Buffer.from(match[2], "base64");
  if (
    !imageBuffer.length ||
    imageBuffer.length > CENTRAL_EMBED_IMAGE_MAX_BYTES
  ) {
    throw createCentralEmbedError(
        "invalid-payload",
        "Embed images must be 10 MB or smaller.",
    );
  }
  if (!isSupportedCentralEmbedImageBuffer(imageBuffer, contentType)) {
    throw createCentralEmbedError(
        "invalid-payload",
        "That file does not appear to be a valid JPEG, PNG, or WebP image.",
    );
  }

  const extension = contentType === "image/jpeg" ?
    "jpg" :
    contentType.replace("image/", "");
  const imageHash = crypto.createHash("sha256")
      .update(imageBuffer)
      .digest("hex")
      .slice(0, 24);
  const storagePath = [
    CENTRAL_EMBED_IMAGE_STORAGE_PREFIX,
    embedId,
    "event-images",
    sourceEventId + "-" + imageHash + "." + extension,
  ].join("/");
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  let downloadToken = "";

  if (exists) {
    const [metadata] = await file.getMetadata();
    downloadToken = getStorageDownloadToken_(metadata);
  }
  if (!downloadToken) {
    downloadToken = crypto.randomUUID();
    await file.save(imageBuffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedByUid: String(actor.uid || "").trim(),
          uploadedByEmail: String(actor.email || "").trim(),
          embedId,
          sourceEventId,
        },
      },
    });
  }

  return {
    url: buildStorageDownloadUrl_(bucket.name, storagePath, downloadToken),
    storagePath,
  };
}

export function isSupportedCentralEmbedImageBuffer(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (contentType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9;
  }
  if (contentType === "image/png") {
    return buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return contentType === "image/webp" &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function getStorageDownloadToken_(metadata) {
  const raw = metadata && metadata.metadata &&
    metadata.metadata.firebaseStorageDownloadTokens;
  return String(raw || "").split(",")[0].trim();
}

function buildStorageDownloadUrl_(bucketName, storagePath, token) {
  const emulatorHost = String(
      process.env.FIREBASE_STORAGE_EMULATOR_HOST || "",
  ).trim();
  const baseUrl = emulatorHost ?
    "http://" + emulatorHost :
    "https://firebasestorage.googleapis.com";
  return baseUrl + "/v0/b/" + encodeURIComponent(bucketName) +
    "/o/" + encodeURIComponent(storagePath) +
    "?alt=media&token=" + encodeURIComponent(token);
}
