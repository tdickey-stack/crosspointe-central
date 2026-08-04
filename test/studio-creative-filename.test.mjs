import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreativeFilename,
  formatCreativeVersion,
  getCreativeDateStamp,
  normalizeCreativeFilenameToken,
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
