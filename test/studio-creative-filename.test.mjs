import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreativeFilename,
  formatCreativeVersion,
  getCreativeDateStamp,
  normalizeCreativeFilenameToken,
  validateCreativeFilenameForExport,
} from "../src/studio/creative-filename.js";

test("Creative Team filenames follow the documented segment order", () => {
  const filename = buildCreativeFilename({
    contentId: "CP 2417",
    workType: "Social Post",
    description: "Easter Invite",
    version: 2,
    date: new Date(2026, 7, 3, 14, 30),
  });

  assert.equal(
    filename,
    "CP-2417_SOCIAL-POST_EASTER-INVITE_20260803_V002",
  );
});

test("Creative Team filenames allow the optional description to be omitted", () => {
  assert.equal(
    buildCreativeFilename({
      contentId: "1812",
      workType: "document",
      version: 1,
      date: new Date(2026, 0, 9),
    }),
    "1812_DOCUMENT_20260109_V001",
  );
});

test("Creative Team filename tokens are filesystem-safe and consistent", () => {
  assert.equal(
    normalizeCreativeFilenameToken("Kid's Ministry & Baptism / Recap"),
    "KIDS-MINISTRY-AND-BAPTISM-RECAP",
  );
  assert.equal(formatCreativeVersion(19), "V019");
  assert.equal(getCreativeDateStamp(new Date(2026, 10, 5)), "20261105");
});

test("Creative Team filenames reject missing required fields and bad versions", () => {
  assert.throws(
    () => buildCreativeFilename({workType: "SOCIAL"}),
    /Content ID is required/,
  );
  assert.throws(
    () => buildCreativeFilename({contentId: "42", workType: ""}),
    /Work Type is required/,
  );
  assert.throws(() => formatCreativeVersion(0), /1 to 999/);
  assert.throws(() => formatCreativeVersion(1.5), /whole number/);
});

test("Creative Team filenames are bounded before carousel rendering starts", () => {
  assert.equal(
    validateCreativeFilenameForExport("A".repeat(188), {
      extension: "png",
      carousel: true,
      formatLabel: "1x1",
    }),
    "A".repeat(188),
  );
  assert.throws(
    () =>
      validateCreativeFilenameForExport("A".repeat(189), {
        extension: "png",
        carousel: true,
        formatLabel: "1x1",
      }),
    /too long.*1 character/u,
  );

  const maximumDialogFilename = buildCreativeFilename({
    contentId: "A".repeat(48),
    workType: "B".repeat(48),
    description: "C".repeat(100),
    version: 999,
    date: new Date(2026, 8, 23),
  });
  assert.throws(
    () =>
      validateCreativeFilenameForExport(maximumDialogFilename, {
        extension: "png",
        carousel: true,
        formatLabel: "1x1",
      }),
    /too long.*24 characters/u,
  );
});

test("Creative Team filename validation accounts for each output extension", () => {
  assert.equal(
    validateCreativeFilenameForExport("A".repeat(196), {extension: "pdf"}),
    "A".repeat(196),
  );
  assert.throws(
    () =>
      validateCreativeFilenameForExport("A".repeat(197), {extension: "pdf"}),
    /too long/u,
  );
});
