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
  assert.equal(payload.printColorMode, "color");
  assert.equal(payload.heroSource, "featured");
  assert.equal(payload.frontContentSource, "mixed");
  assert.equal(payload.headings.frontHeading, "This Week at\nCrossPointe");
  assert.equal(payload.fallbackHero.title, "We're Glad You're Here");
  assert.deepEqual(
      payload.fallbackBlocks,
      getDefaultPrintModeFallbackBlocks(),
  );
  assert.deepEqual(payload.frontContentOrder, [
    "custom:new-here",
    "custom:stay-connected",
    "campaigns",
    "serveNeeds",
  ]);
  assert.deepEqual(payload.backContentOrder, [
    "custom:new-here",
    "custom:stay-connected",
  ]);
  assert.equal(payload.backCustomPlacement, "after-events");
  assert.deepEqual(payload.events, []);
  assert.deepEqual(payload.campaignIds, []);
  assert.deepEqual(payload.serveNeedIds, []);
  assert.equal(payload.serveNeedId, "");
});

test("Print Mode payload normalizes settings within existing limits", () => {
  const payload = normalizePrintModePayload({
    serviceDate: "2026-07-26",
    printFormat: "full-page",
    printColorMode: "bw",
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
    fallbackBlocks: [{
      id: "front-feature",
      title: "Front Feature",
      size: 3,
      includeOnFront: true,
      includeOnBack: true,
    }],
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
  assert.equal(payload.printColorMode, "bw");
  assert.equal(payload.heroSource, "manual");
  assert.equal(payload.frontContentSource, "mixed");
  assert.equal(payload.headings.frontHeading, "First line\nSecond line");
  assert.equal(payload.giving.monthlyBudget, 12346);
  assert.equal(payload.giving.monthToDateGiving, 0);
  assert.deepEqual(payload.campaignIds, ["a", "b", "c"]);
  assert.deepEqual(payload.campaignIcons, [
    {id: "a", icon: "heart"},
    {id: "b", icon: "general"},
  ]);
  assert.deepEqual(payload.serveNeedIds, []);
  assert.equal(payload.serveNeedId, "");
  assert.deepEqual(payload.fallbackBlocks, [{
    id: "front-feature",
    eyebrow: "",
    title: "Front Feature",
    description: "",
    imageUrl: "",
    imageStoragePath: "",
    imageSide: "right",
    size: 3,
    includeOnFront: true,
    includeOnBack: true,
    enabled: true,
  }]);
  assert.deepEqual(payload.frontContentOrder, [
    "custom:front-feature",
    "campaigns",
    "serveNeeds",
  ]);
  assert.deepEqual(payload.events, [{
    id: "event-1",
    title: "Sunday Gathering",
    description: "Line one\nLine two",
    location: "",
    included: false,
    includeDescription: true,
  }]);
});

test("Print Mode migrates legacy custom-only blocks onto the front", () => {
  const payload = normalizePrintModePayload({
    frontContentSource: "fallback",
    campaignIds: ["campaign-1"],
    fallbackBlocks: [{
      id: "legacy",
      title: "Legacy Block",
      enabled: true,
    }],
  });

  assert.equal(payload.fallbackBlocks[0].includeOnFront, true);
  assert.equal(payload.fallbackBlocks[0].size, 2);
  assert.deepEqual(payload.campaignIds, ["campaign-1"]);
});

test(
    "Disabled custom blocks preserve placement without using front space",
    () => {
      const payload = normalizePrintModePayload({
        campaignIds: ["campaign-1", "campaign-2", "campaign-3"],
        serveNeedIds: ["serve-1"],
        fallbackBlocks: [{
          id: "disabled-front",
          title: "Disabled Front Block",
          size: 3,
          includeOnFront: true,
          includeOnBack: true,
          enabled: false,
        }],
      });

      assert.deepEqual(payload.campaignIds, [
        "campaign-1",
        "campaign-2",
        "campaign-3",
      ]);
      assert.deepEqual(payload.serveNeedIds, ["serve-1"]);
      assert.deepEqual(payload.fallbackBlocks[0], {
        id: "disabled-front",
        eyebrow: "",
        title: "Disabled Front Block",
        description: "",
        imageUrl: "",
        imageStoragePath: "",
        imageSide: "right",
        size: 3,
        includeOnFront: true,
        includeOnBack: true,
        enabled: false,
      });
    },
);

test(
    "Campaign and Serve selections each use one grouped front-page space",
    () => {
      const payload = normalizePrintModePayload({
        campaignIds: ["campaign-1", "campaign-2", "campaign-3"],
        serveNeedIds: ["serve-1", "serve-2", "serve-3"],
        fallbackBlocks: [
          {
            id: "compact-1",
            title: "Compact One",
            size: 1,
            includeOnFront: true,
          },
          {
            id: "compact-2",
            title: "Compact Two",
            size: 1,
            includeOnFront: true,
          },
        ],
      });

      assert.deepEqual(payload.campaignIds, [
        "campaign-1",
        "campaign-2",
        "campaign-3",
      ]);
      assert.deepEqual(payload.serveNeedIds, [
        "serve-1",
        "serve-2",
        "serve-3",
      ]);
    },
);

test("Grouped live content still respects the four-space budget", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1", "campaign-2", "campaign-3"],
    serveNeedIds: ["serve-1", "serve-2"],
    fallbackBlocks: [{
      id: "large",
      title: "Large Block",
      size: 3,
      includeOnFront: true,
    }],
  });

  assert.deepEqual(payload.campaignIds, [
    "campaign-1",
    "campaign-2",
    "campaign-3",
  ]);
  assert.deepEqual(payload.serveNeedIds, []);
});

test("Print Mode preserves a safe mixed front-page card order", () => {
  const payload = normalizePrintModePayload({
    frontContentOrder: [
      "campaigns",
      "custom:second",
      "not-a-real-card",
      "campaigns",
    ],
    fallbackBlocks: [
      {
        id: "first",
        title: "First Block",
        includeOnFront: true,
      },
      {
        id: "second",
        title: "Second Block",
        includeOnFront: true,
      },
    ],
  });

  assert.deepEqual(payload.frontContentOrder, [
    "campaigns",
    "custom:second",
    "custom:first",
    "serveNeeds",
  ]);
});

test(
    "Print Mode preserves separate back-page custom order and placement",
    () => {
      const payload = normalizePrintModePayload({
        backContentOrder: [
          "custom:second",
          "not-a-real-card",
          "custom:second",
        ],
        backCustomPlacement: "before-events",
        fallbackBlocks: [
          {
            id: "first",
            title: "First Block",
            includeOnBack: true,
          },
          {
            id: "second",
            title: "Second Block",
            includeOnBack: true,
          },
        ],
      });

      assert.deepEqual(payload.backContentOrder, [
        "custom:second",
        "custom:first",
      ]);
      assert.equal(payload.backCustomPlacement, "before-events");
    },
);

test("Custom blocks without a page are normalized as disabled", () => {
  const payload = normalizePrintModePayload({
    fallbackBlocks: [{
      id: "unplaced",
      title: "Unplaced Block",
      enabled: true,
    }],
  });

  assert.equal(payload.fallbackBlocks[0].enabled, false);
  assert.equal(payload.fallbackBlocks[0].includeOnFront, false);
  assert.equal(payload.fallbackBlocks[0].includeOnBack, false);
});

test("Print Mode text normalization preserves endpoint actions", () => {
  assert.equal(
      normalizePrintModeText("  uploadFallbackImage  ", 40),
      "uploadFallbackImage",
  );
});
