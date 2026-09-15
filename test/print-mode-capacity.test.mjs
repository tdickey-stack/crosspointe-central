import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/admin.js", import.meta.url), "utf8");

function loadFunctions(names, globals = {}) {
  const context = vm.createContext(Object.assign({
    getBulletinLayout_: () => "classic",
  }, globals));
  for (const name of names) {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const end = source.indexOf("\n  }", start);
    assert.notEqual(end, -1, `Missing end of function ${name}`);
    vm.runInContext(source.slice(start, end + 4), context);
  }
  return context;
}

function loadBulletinMarkdownRenderers(context) {
  const start = source.indexOf("  function renderAdminMarkdownLite_(value) {");
  const end = source.lastIndexOf("\n}());");
  assert.notEqual(start, -1, "Missing Print Mode Markdown renderer");
  assert.notEqual(end, -1, "Missing admin module boundary");
  vm.runInContext(source.slice(start, end), context);
}

function customBlockRendererContext() {
  const context = loadFunctions([
    "escapeHtml_",
    "escapeAttr_",
    "renderBulletinFallbackBlock_",
    "renderBulletinBackCustomBlock_",
  ], {
    getBulletinFallbackImageUrl_: (value) => value || "",
    normalizeBulletinBlockSize_: (value) => Number(value) || 2,
    getBulletinBackCustomBlockLayoutWeight_: () => 1,
    getBulletinEventDescriptionFitSize_: () => "0.1in",
    getBulletinEventDescriptionLengthClass_: () => "",
  });
  loadBulletinMarkdownRenderers(context);
  return context;
}

function selectionContext() {
  return loadFunctions([
    "getSelectedBulletinCampaigns_",
    "getSelectedBulletinServeNeeds_",
    "normalizeBulletinBlockSize_",
    "getBulletinCustomBlockFrontCount_",
    "getBulletinFrontContentSelectionState_",
    "getBulletinCentralFrontUnits_",
    "getBulletinFrontDensityClass_",
  ], {
    PRINT_MODE_MAX_CAMPAIGNS: 3,
    PRINT_MODE_MAX_SERVE_NEEDS: 3,
    PRINT_MODE_MAX_FRONT_CONTENT_ITEMS: 4,
    applyBulletinDescriptionOverride_: (_kind, item) => item,
    adminState: {
      bulletinCentralData: {
        campaigns: [{id: "campaign-a"}, {id: "campaign-b"}],
        serveNeeds: [{id: "serve-a"}, {id: "serve-b"}],
      },
      bulletinDraft: {campaignIds: [], serveNeedIds: [], fallbackBlocks: []},
    },
  });
}

test("each Campaign, Serve Need, and custom block counts as one announcement", () => {
  const context = selectionContext();
  Object.assign(context.adminState.bulletinDraft, {
    campaignIds: ["campaign-a", "campaign-b"],
    serveNeedIds: ["serve-a", "serve-b"],
    fallbackBlocks: [{id: "custom", includeOnFront: true, size: 1}],
  });
  const selection = context.getBulletinFrontContentSelectionState_();
  assert.equal(selection.campaignCount, 2);
  assert.equal(selection.serveNeedCount, 2);
  assert.equal(selection.customBlockCount, 1);
  assert.equal(selection.totalCount, 5);
  assert.equal(context.getBulletinCentralFrontUnits_(), 4);
});

test("unavailable selections and disabled or back-only custom blocks use no front space", () => {
  const context = selectionContext();
  Object.assign(context.adminState.bulletinDraft, {
    campaignIds: ["campaign-a", "missing"],
    serveNeedIds: ["missing"],
    fallbackBlocks: [
      {includeOnFront: true, enabled: false, size: 3},
      {includeOnBack: true, includeOnFront: false, size: 3},
      {includeOnFront: true, size: 2},
    ],
  });
  assert.equal(context.getBulletinFrontContentSelectionState_().totalCount, 2);
});

test("resizing a custom block changes neither announcement count nor page density", () => {
  const context = selectionContext();
  const empty = context.getBulletinFrontDensityClass_();
  const draft = context.adminState.bulletinDraft;
  draft.campaignIds = ["campaign-a", "campaign-b"];
  draft.fallbackBlocks = [{includeOnFront: true, size: 1}];
  assert.equal(context.getBulletinFrontContentSelectionState_().totalCount, 3);
  assert.equal(context.getBulletinFrontDensityClass_(), empty);
  draft.fallbackBlocks[0].size = 2;
  assert.equal(context.getBulletinFrontContentSelectionState_().totalCount, 3);
  assert.equal(context.getBulletinFrontDensityClass_(), empty);
});

for (const [name, renderer] of [
  ["front", "renderBulletinFallbackBlock_"],
  ["back", "renderBulletinBackCustomBlock_"],
]) {
  test(`${name} custom blocks render escaped lightweight Markdown without invalid paragraph nesting`, () => {
    const context = customBlockRendererContext();
    const html = context[renderer]({
      id: "custom",
      eyebrow: "News",
      title: "<script>keep title text safe</script>",
      description: [
        "# **Welcome**",
        "",
        "*Read* the <img src=x onerror=alert(1)> details.",
        "",
        "1. First",
        "   - Nested **second**",
      ].join("\n"),
      size: 2,
    });

    assert.match(html, /central-bulletin-markdown/);
    assert.match(html, /central-bulletin-custom-description|central-bulletin-event-description/);
    assert.match(html, /&lt;script&gt;keep title text safe&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>keep title text safe<\/script>/);
    assert.match(html, /<h3 class="whats-new-heading level-1"><strong>Welcome<\/strong><\/h3>/);
    assert.match(html, /<p><em>Read<\/em> the &lt;img src=x onerror=alert\(1\)&gt; details\.<\/p>/);
    assert.match(html, /<ol><li>First<ul><li>Nested <strong>second<\/strong><\/li><\/ul><\/li><\/ol>/);
    assert.doesNotMatch(html, /<p[^>]*>\s*<(?:h3|ol|ul)/);
  });
}

function measureFit({footerBottom = 880, totalCount = 4, format = "half-letter", heights = [200]} = {}) {
  let attached = false;
  let removed = false;
  let renderedFormat;
  let chosenLevel = 0;
  const panel = {
    setAttribute(_name, value) { chosenLevel = Number(value); },
    querySelector() { return {
      clientHeight: 200,
      get scrollHeight() { return heights[Math.min(chosenLevel, heights.length - 1)]; },
    }; },
    getBoundingClientRect: () => ({top: 100, bottom: 900}),
    children: [200, 450, 720, footerBottom].map((bottom) => ({
      getBoundingClientRect: () => ({bottom}),
    })),
  };
  const holder = {
    style: {},
    setAttribute() {},
    firstElementChild: panel,
    remove() { removed = true; },
  };
  const context = loadFunctions(["fitBulletinFrontPanel_", "measureBulletinFrontFit_"], {
    document: {createElement: () => holder},
    window: {getComputedStyle: () => ({paddingBottom: "20px"})},
    appEl: {appendChild(element) { assert.equal(element, holder); attached = true; }},
    getBulletinPrintFormat_: () => format,
    renderBulletinFullPagePanel_: () => { renderedFormat = "full-page"; return "panel"; },
    renderBulletinPanel_: () => { renderedFormat = "half-letter"; return "panel"; },
    getBulletinFrontContentSelectionState_: () => ({totalCount, maxCount: 4}),
  });
  const result = context.measureBulletinFrontFit_();
  assert.equal(attached, true);
  assert.equal(removed, true, "measurement must remove its temporary panel");
  assert.equal(renderedFormat, format);
  return result;
}

test("exact fit includes the footer and reserved bottom padding", () => {
  const result = measureFit();
  assert.equal(result.fits, true);
  assert.equal(result.overflow, 0);
});

test("footer inside the page but beyond the printable padding is rejected", () => {
  const result = measureFit({footerBottom: 890, totalCount: 3});
  assert.equal(result.fits, false);
  assert.equal(result.overflow, 10);
});

test("a physically fitting page permits more than four announcements", () => {
  const result = measureFit({totalCount: 5});
  assert.equal(result.fits, true);
  assert.equal(result.overflow, 0);
});

test("full-page measurement also reserves space below its last section", () => {
  assert.equal(measureFit({format: "full-page"}).fits, true);
  assert.equal(measureFit({format: "full-page", footerBottom: 925}).overflow, 45);
});


test("adaptation stops at the least compact level that fits", () => {
  const result = measureFit({heights: [280, 250, 198, 170, 140]});
  assert.equal(result.fits, true);
  assert.equal(result.level, 2);
});

test("a middle region overflowing even at titles-only stays blocked", () => {
  const result = measureFit({heights: [400, 350, 300, 250, 220]});
  assert.equal(result.fits, false);
  assert.equal(result.level, 4);
  assert.equal(result.overflow, 20);
});

test("more available room restores the original presentation", () => {
  assert.equal(measureFit({heights: [400, 300, 190]}).level, 2);
  assert.equal(measureFit({heights: [190]}).level, 0);
});

test("spare room restores copy across announcements without overflowing", () => {
  let level = 0;
  const counts = [0, 0];
  const paragraphs = counts.map((_value, index) => ({
    closest: () => null,
    style: {setProperty(name, value) {
      if (name === "display" && value === "none") counts[index] = 0;
      if (name === "-webkit-line-clamp" && counts[index] !== -1) counts[index] = Number(value);
      if (name === "display") counts[index] = value === "none" ? -1 : 0;
    }},
  }));
  const content = {
    clientHeight: 100,
    get scrollHeight() {
      return level < 4 ? 200 : 50 + counts.reduce((sum, n) => sum + Math.max(0, n), 0) * 20;
    },
    querySelectorAll: () => paragraphs,
  };
  const panel = {
    children: [],
    querySelector: () => content,
    setAttribute(_name, value) { level = Number(value); },
    getBoundingClientRect: () => ({top: 0, bottom: 200}),
  };
  const context = loadFunctions(["setBulletinAdaptiveCopyLines_", "fitBulletinFrontPanel_"], {
    window: {getComputedStyle: () => ({paddingBottom: "20px"})},
  });
  const fit = context.fitBulletinFrontPanel_(panel);
  assert.equal(fit.fits, true);
  assert.deepEqual(Array.from(fit.copyLines), [1, 1]);
  assert.ok(content.scrollHeight <= content.clientHeight);
});

test("first adaptation preserves Large custom copy while shortening supporting copy", () => {
  let level = 0;
  let supportingLines = 1;
  const paragraphs = [
    {closest: () => ({classList: {contains: (name) => name === "is-size-3"}})},
    {closest: () => null, style: {setProperty(name, value) {
      if (name === "-webkit-line-clamp") supportingLines = Number(value);
    }}},
  ];
  const content = {
    clientHeight: 200,
    get scrollHeight() { return level === 0 || supportingLines > 1 ? 215 : 195; },
    querySelectorAll: () => paragraphs,
  };
  const panel = {
    children: [], querySelector: () => content,
    setAttribute(_name, value) { level = Number(value); },
    getBoundingClientRect: () => ({top: 0, bottom: 300}),
  };
  const context = loadFunctions(["setBulletinAdaptiveCopyLines_", "fitBulletinFrontPanel_"], {
    window: {getComputedStyle: () => ({paddingBottom: "20px"})},
  });
  const fit = context.fitBulletinFrontPanel_(panel);
  assert.equal(fit.level, 1);
  assert.deepEqual(Array.from(fit.copyLines), [6, 1]);
  assert.ok(content.scrollHeight <= content.clientHeight);
});

test("front fitting applies one line budget to the custom Markdown wrapper, not its nested blocks", () => {
  const applied = [];
  const nestedParagraph = {style: {removeProperty() { applied.push("nested"); }}};
  const wrapper = {style: {
    removeProperty() {},
    setProperty(name, value) { applied.push([name, value]); },
  }};
  const panel = {
    setAttribute() {},
    querySelectorAll(selector) {
      assert.match(selector, /fallback-copy > \.central-bulletin-custom-description/);
      return [wrapper];
    },
  };
  const context = loadFunctions([
    "setBulletinAdaptiveCopyLines_",
    "applyBulletinFrontFit_",
  ], {
    appEl: {querySelectorAll: () => [panel]},
  });
  context.applyBulletinFrontFit_({level: 2, copyLines: [3]});
  assert.deepEqual(applied, [
    ["display", "-webkit-box"],
    ["-webkit-line-clamp", "3"],
  ]);
  assert.equal(typeof nestedParagraph.style.removeProperty, "function");
});
