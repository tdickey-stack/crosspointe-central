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
  assert.equal(payload.bulletinLayout, "classic");
  assert.equal(payload.showCutLine, false);
  assert.equal(payload.heroSource, "featured");
  assert.equal(payload.frontContentSource, "mixed");
  assert.equal(payload.headings.frontHeading, "This Week at\nCrossPointe");
  assert.equal(payload.headings.backHeading, "The Next Four Weeks");
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
  assert.deepEqual(payload.campaignDescriptionOverrides, []);
  assert.deepEqual(payload.serveNeedIds, []);
  assert.deepEqual(payload.serveNeedDescriptionOverrides, []);
  assert.equal(payload.serveNeedId, "");
});

test("Print Mode migrates the legacy two-week heading", () => {
  const payload = normalizePrintModePayload({
    headings: {backHeading: "The Next Two Weeks"},
  });

  assert.equal(payload.headings.backHeading, "The Next Four Weeks");
});

test("Print Mode payload normalizes settings within existing limits", () => {
  const payload = normalizePrintModePayload({
    serviceDate: "2026-07-26",
    printFormat: "full-page",
    printColorMode: "bw",
    bulletinLayout: "scannable",
    showCutLine: true,
    heroSource: "manual",
    frontContentSource: "fallback",
    featuredEvent: {
      id: " featured-1 ",
      title: " Featured Print Title ",
      description: "PCO featured print copy persists.",
    },
    fallbackHero: {
      eyebrow: " Welcome ",
      title: " Manual Print Title ",
      description: "Manual hero print copy persists.",
    },
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
    campaignDescriptionOverrides: [
      {id: " a ", description: "Short campaign print copy."},
      {id: "a", description: "Duplicate is ignored."},
    ],
    serveNeedIds: ["serve-1", "serve-2"],
    serveNeedDescriptionOverrides: [
      {id: " serve-1 ", description: ""},
    ],
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
  assert.equal(payload.bulletinLayout, "scannable");
  assert.equal(payload.showCutLine, true);
  assert.equal(payload.heroSource, "manual");
  assert.equal(payload.frontContentSource, "mixed");
  assert.equal(payload.featuredEvent.id, "featured-1");
  assert.equal(payload.featuredEvent.title, "Featured Print Title");
  assert.equal(
      payload.featuredEvent.description,
      "PCO featured print copy persists.",
  );
  assert.equal(payload.fallbackHero.eyebrow, "Welcome");
  assert.equal(payload.fallbackHero.title, "Manual Print Title");
  assert.equal(
      payload.fallbackHero.description,
      "Manual hero print copy persists.",
  );
  assert.equal(payload.headings.frontHeading, "First line\nSecond line");
  assert.equal(payload.giving.monthlyBudget, 12346);
  assert.equal(payload.giving.monthToDateGiving, 0);
  assert.deepEqual(payload.campaignIds, ["a", "b", "c"]);
  assert.deepEqual(payload.campaignIcons, [
    {id: "a", icon: "heart"},
    {id: "b", icon: "general"},
  ]);
  assert.deepEqual(payload.campaignDescriptionOverrides, [{
    id: "a",
    description: "Short campaign print copy.",
  }]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2"]);
  assert.deepEqual(payload.serveNeedDescriptionOverrides, [{
    id: "serve-1",
    description: "",
  }]);
  assert.equal(payload.serveNeedId, "serve-1");
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

test("Print Mode payload falls back from unknown bulletin layouts", () => {
  assert.equal(
      normalizePrintModePayload({bulletinLayout: "future-layout"})
          .bulletinLayout,
      "classic",
  );
});

test("Print Mode bounds sparse description overrides", () => {
  const payload = normalizePrintModePayload({
    campaignDescriptionOverrides: Array.from(
        {length: 14},
        (_unused, index) => ({
          id: "campaign-" + String(index + 1),
          description: "x".repeat(180),
        }),
    ),
    serveNeedDescriptionOverrides: [
      {id: "serve-1", description: ""},
      {id: "serve-1", description: "Duplicate"},
      {id: "", description: "Missing ID"},
    ],
  });

  assert.equal(payload.campaignDescriptionOverrides.length, 12);
  assert.equal(payload.campaignDescriptionOverrides[0].description.length, 140);
  assert.deepEqual(payload.serveNeedDescriptionOverrides, [{
    id: "serve-1",
    description: "",
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

test("Campaign and Serve selections are preserved", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1", "campaign-2"],
    serveNeedIds: ["serve-1", "serve-2"],
  });

  assert.deepEqual(payload.campaignIds, ["campaign-1", "campaign-2"]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2"]);
});

test("Selections beyond the former weighted limit are preserved", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1", "campaign-2"],
    serveNeedIds: ["serve-1", "serve-2"],
    fallbackBlocks: [{
      id: "compact",
      title: "Compact Block",
      size: 1,
      includeOnFront: true,
    }],
  });

  assert.equal(payload.fallbackBlocks[0].includeOnFront, true);
  assert.deepEqual(payload.campaignIds, ["campaign-1", "campaign-2"]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2"]);
});

test("Selections retain category caps and deduplication", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["c1", "c1", "c2", "c3", "c4"],
    serveNeedIds: ["s1", "s2", "s3", "s4"],
    fallbackBlocks: [
      {id: "one", title: "One", size: 3, includeOnFront: true},
      {id: "two", title: "Two", size: 3, includeOnFront: true},
    ],
  });

  assert.deepEqual(payload.campaignIds, ["c1", "c2", "c3"]);
  assert.deepEqual(payload.serveNeedIds, ["s1", "s2", "s3"]);
  assert.ok(payload.fallbackBlocks.every((block) => block.includeOnFront));
  assert.ok(payload.fallbackBlocks.every((block) => block.enabled));
});

test("Custom size does not limit live selections", () => {
  for (const size of [1, 2, 3]) {
    const payload = normalizePrintModePayload({
      campaignIds: ["campaign-1", "campaign-2", "campaign-3"],
      serveNeedIds: ["serve-1", "serve-2"],
      fallbackBlocks: [{
        id: "custom",
        title: "Custom Block",
        size: size,
        includeOnFront: true,
      }],
    });

    assert.equal(payload.fallbackBlocks[0].size, size);
    assert.equal(payload.campaignIds.length, 3);
    assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2"]);
  }
});

test("Duplicate and empty live IDs are removed", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1", " campaign-1 ", "", "campaign-2"],
    serveNeedIds: ["", "serve-1", " serve-1 ", "serve-2", "serve-3"],
  });

  assert.deepEqual(payload.campaignIds, ["campaign-1", "campaign-2"]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2", "serve-3"]);
});

test("Back-only blocks preserve live selections", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1", "campaign-2"],
    serveNeedIds: ["serve-1", "serve-2"],
    fallbackBlocks: [{
      id: "back-only",
      title: "Back Only",
      size: 3,
      includeOnBack: true,
    }],
  });

  assert.equal(payload.fallbackBlocks[0].enabled, true);
  assert.equal(payload.fallbackBlocks[0].includeOnFront, false);
  assert.equal(payload.fallbackBlocks[0].includeOnBack, true);
  assert.deepEqual(payload.campaignIds, ["campaign-1", "campaign-2"]);
  assert.deepEqual(payload.serveNeedIds, ["serve-1", "serve-2"]);
});

test("Multiple custom sizes retain both front and back placement", () => {
  const payload = normalizePrintModePayload({
    campaignIds: ["campaign-1"],
    fallbackBlocks: [
      {id: "large", title: "Large", size: 3, includeOnFront: true},
      {
        id: "standard",
        title: "Standard",
        size: 2,
        includeOnFront: true,
        includeOnBack: true,
      },
      {id: "compact", title: "Compact", size: 1, includeOnFront: true},
    ],
  });

  assert.equal(payload.fallbackBlocks[1].includeOnFront, true);
  assert.equal(payload.fallbackBlocks[1].includeOnBack, true);
  assert.equal(payload.fallbackBlocks[1].enabled, true);
  assert.equal(payload.fallbackBlocks[2].includeOnFront, true);
  assert.deepEqual(payload.campaignIds, ["campaign-1"]);
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
