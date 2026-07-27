import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultPrintModeFallbackBlocks,
  normalizePrintModePayload,
  normalizePrintModeText,
} from "./payload.js";

test("Print Mode payload defaults preserve the public contract", () => {
  const payload = normalizePrintModePayload({});

  assert.equal(payload.serviceDate, "");
  assert.equal(payload.printFormat, "half-letter");
  assert.equal(payload.heroSource, "featured");
  assert.equal(payload.frontContentSource, "live");
  assert.equal(payload.headings.frontHeading, "This Week at\nCrossPointe");
  assert.equal(payload.fallbackHero.title, "We're Glad You're Here");
  assert.deepEqual(
      payload.fallbackBlocks,
      getDefaultPrintModeFallbackBlocks(),
  );
  assert.deepEqual(payload.events, []);
  assert.deepEqual(payload.campaignIds, []);
  assert.deepEqual(payload.serveNeedIds, []);
  assert.equal(payload.serveNeedId, "");
});

test("Print Mode payload normalizes settings within existing limits", () => {
  const payload = normalizePrintModePayload({
    serviceDate: "2026-07-26",
    printFormat: "full-page",
    heroSource: "manual",
    frontContentSource: "fallback",
    headings: {
      frontHeading: " First line \n Second line \n Ignored line ",
    },
    giving: {
      monthlyBudget: "$12,345.60",
      monthToDateGiving: "-1",
    },
    campaignIds: ["a", "a", "b", "c", "d"],
    campaignIcons: [
      {id: "a", icon: "heart"},
      {id: "a", icon: "gift"},
      {id: "b", icon: "not-real"},
    ],
    serveNeedIds: ["serve-1", "serve-2"],
    events: [
      {
        id: " event-1 ",
        title: " Sunday   Gathering ",
        description: "Line one  \r\nLine   two",
        included: false,
      },
      {title: "Missing ID"},
    ],
  });

  assert.equal(payload.serviceDate, "2026-07-26");
  assert.equal(payload.printFormat, "full-page");
  assert.equal(payload.heroSource, "manual");
  assert.equal(payload.frontContentSource, "fallback");
  assert.equal(payload.headings.frontHeading, "First line\nSecond line");
  assert.equal(payload.giving.monthlyBudget, 12346);
  assert.equal(payload.giving.monthToDateGiving, 0);
  assert.deepEqual(payload.campaignIds, ["a", "b", "c"]);
  assert.deepEqual(payload.campaignIcons, [
    {id: "a", icon: "heart"},
    {id: "b", icon: "general"},
  ]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1"]);
  assert.equal(payload.serveNeedId, "serve-1");
  assert.deepEqual(payload.events, [{
    id: "event-1",
    title: "Sunday Gathering",
    description: "Line one\nLine two",
    location: "",
    included: false,
    includeDescription: true,
  }]);
});

test("Print Mode text normalization preserves endpoint actions", () => {
  assert.equal(
      normalizePrintModeText("  uploadFallbackImage  ", 40),
      "uploadFallbackImage",
  );
});
