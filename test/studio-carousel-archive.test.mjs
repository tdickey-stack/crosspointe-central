import assert from "node:assert/strict";
import test from "node:test";

import {unzipSync} from "fflate";

import {
  buildCarouselZip,
  pngDataUrlToBytes,
} from "../src/studio/carousel-archive.js";

function pngDataUrl(value) {
  return `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
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
  assert.equal(Buffer.from(files["campaign-s01-1x1.png"]).toString(), "slide one");
  assert.equal(Buffer.from(files["campaign-s02-1x1.png"]).toString(), "slide two");
});

test("carousel ZIP packaging rejects invalid data and unsafe filenames", () => {
  assert.throws(
    () => pngDataUrlToBytes("data:text/plain;base64,SGVsbG8="),
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
