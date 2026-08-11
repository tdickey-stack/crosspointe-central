import assert from "node:assert/strict";
import test from "node:test";

import {isSupportedCentralEmbedImageBuffer} from "./storage.js";

test("Central Embed image validation accepts supported signatures", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
  ]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");
  assert.equal(isSupportedCentralEmbedImageBuffer(png, "image/png"), true);
  assert.equal(isSupportedCentralEmbedImageBuffer(webp, "image/webp"), true);
  assert.equal(
      isSupportedCentralEmbedImageBuffer(Buffer.alloc(20), "image/png"),
      false,
  );
});
