import assert from "node:assert/strict";
import test from "node:test";

import {isSupportedPrintModeImageBuffer} from "./storage.js";

test("Print Mode image validation recognizes supported file signatures", () => {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a,
    0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
  ]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");

  assert.equal(isSupportedPrintModeImageBuffer(jpeg, "image/jpeg"), true);
  assert.equal(isSupportedPrintModeImageBuffer(png, "image/png"), true);
  assert.equal(isSupportedPrintModeImageBuffer(webp, "image/webp"), true);
});

test("Print Mode image validation rejects mismatched or short data", () => {
  assert.equal(
      isSupportedPrintModeImageBuffer(
          Buffer.from("not an image", "ascii"),
          "image/png",
      ),
      false,
  );
  assert.equal(
      isSupportedPrintModeImageBuffer(Buffer.from([0xff]), "image/jpeg"),
      false,
  );
});
