import assert from "node:assert/strict";
import test from "node:test";

import {unzipSync} from "fflate";

import {
  buildCarouselZip,
  pngDataUrlToBytes,
} from "../src/studio/carousel-archive.js";

function pngDataUrl(value) {
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from(value),
  ]);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

test("carousel PNGs are packaged into one ZIP with deterministic filenames", () => {
  const archive = buildCarouselZip([
    {filename: "campaign-s01-1x1.png", dataUrl: pngDataUrl("slide one")},
    {filename: "campaign-s02-1x1.png", dataUrl: pngDataUrl("slide two")},
  ]);
  const files = unzipSync(archive);

  assert.deepEqual(Object.keys(files).sort(), [
    "campaign-s01-1x1.png",
    "campaign-s02-1x1.png",
  ]);
  assert.equal(
    Buffer.from(files["campaign-s01-1x1.png"]).subarray(8).toString(),
    "slide one",
  );
  assert.equal(
    Buffer.from(files["campaign-s02-1x1.png"]).subarray(8).toString(),
    "slide two",
  );
});

test("carousel PNG bytes package without a base64 copy", () => {
  const bytes = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 115, 108, 105, 100, 101,
  ]);
  const archive = buildCarouselZip([
    {filename: "campaign-s01-1x1.png", bytes},
  ]);
  const files = unzipSync(archive);

  assert.deepEqual(files["campaign-s01-1x1.png"], bytes);
});

test("carousel ZIP packaging rejects invalid data and unsafe filenames", () => {
  assert.throws(
    () => pngDataUrlToBytes("data:text/plain;base64,SGVsbG8="),
    /invalid carousel PNG/u,
  );
  assert.throws(
    () => pngDataUrlToBytes("data:image/png;base64,SGVsbG8="),
    /invalid carousel PNG/u,
  );
  assert.throws(
    () =>
      buildCarouselZip([
        {filename: "../slide.png", dataUrl: pngDataUrl("slide")},
      ]),
    /invalid carousel filename/u,
  );
  assert.throws(
    () =>
      buildCarouselZip([
        {filename: "slide.png", dataUrl: pngDataUrl("one")},
        {filename: "slide.png", dataUrl: pngDataUrl("two")},
      ]),
    /duplicate carousel filenames/u,
  );
});
