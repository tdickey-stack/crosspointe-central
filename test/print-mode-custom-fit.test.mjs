import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/admin.js", import.meta.url), "utf8");
function loadFunctions(names, globals = {}) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const end = source.indexOf("\n  }", start);
    assert.notEqual(end, -1, `Missing end of function ${name}`);
    vm.runInContext(source.slice(start, end + 4), context);
  }
  return context;
}

const nextDescription = "College, work, and figuring out what comes next are easier with people beside you. CrossPointe NEXT is a new small group for ages 18–23 to build friendships and grow together through this stage of life. Join us October 18 and 25 after second service at The Pointe building for free food and time to connect. Bring a friend and come get to know the group!";
function fixture({size = 2, side = "back", entries = [], editingId = "", horizontal = false, contentOverflow = false, pageOverflow = false, throws = false} = {}) {
  const draft = {title: "CrossPointe NEXT", eyebrow: "Grow together", description: nextDescription, imageUrl: "", size, layout3Side: side};
  const adminState = {bulletinFallbackBlockDraft: draft, bulletinFallbackBlockEditingId: editingId, bulletinDraft: {fallbackBlocks: [{id: "saved", description: "Original saved copy"}], layout3: {items: [{key: "custom:saved", side: "front", size: 1}]}}};
  let removed = false;
  let appended = 0;
  let checked = 0;
  const renderedEntries = [];
  const columns = [{appendChild() {}}, {appendChild() {}}];
  const cards = () => renderedEntries.map(({entry}) => ({
    kind: "card",
    getAttribute: () => entry.key,
    offsetHeight: entry.item.description ? 280 : 120,
    clientWidth: 180,
    scrollWidth: horizontal ? 200 : 180,
    clientHeight: entry.size === 2 ? 330 : 150,
    scrollHeight: 280,
  }));
  const slots = {
    innerHTML: "",
    querySelectorAll(selector) {
      if (selector === ".b3-back-column") return columns;
      if (selector === "[data-bulletin-preview-key]") return cards();
      throw new Error(`Unexpected selector: ${selector}`);
    },
  };
  const pageRegion = {
    kind: "page",
    clientWidth: 360,
    scrollWidth: 360,
    clientHeight: 500,
    scrollHeight: pageOverflow ? 503 : 500,
  };
  const holder = {
    style: {},
    setAttribute() {},
    set innerHTML(value) { assert.equal(value, "actual panel budgets"); },
    querySelector(selector) { assert.equal(selector, side === "back" ? ".b3-back-slots" : ".b3-front-slots"); return slots; },
    querySelectorAll(selector) {
      if (selector === ".b3-back-slots") return side === "back" ? [slots] : [];
      if (selector === "[data-b3-region]") return [pageRegion];
      throw new Error(`Unexpected holder selector: ${selector}`);
    },
    remove() { removed = true; },
  };
  const context = loadFunctions(["getBulletinLayout3BackSplit_", "layoutBulletinLayout3Back_", "renderBulletinLayout3BackColumns_", "measureBulletinLayout3CustomDraftFit_"], {
    adminState,
    document: {createElement: () => holder},
    window: {getComputedStyle: () => ({rowGap: "12px"})},
    appEl: {appendChild: () => { appended += 1; }},
    getBulletinLayout3Entries_: (requestedSide) => { assert.equal(requestedSide, side); return entries; },
    renderBulletinPanel_: (requestedSide, preview) => { assert.equal(requestedSide, side); assert.equal(preview, false); return "actual panel budgets"; },
    renderBulletinLayout3Card_: (entry, position) => {
      if (throws) throw new Error("render failed");
      renderedEntries.push({entry, position});
      return `<article>${entry.item.description || ""}</article>`;
    },
    bulletinLayout3ContentOverflows_: (region) => { checked += 1; return region.kind === "page" ? pageOverflow : contentOverflow; },
  });
  return {context, adminState, draft, slots, renderedEntries, appended: () => appended, removed: () => removed, checked: () => checked};
}

test("back custom fit measures the candidate with other cards at automatic height", () => {
  assert.equal(nextDescription.length, 354);
  const other = {key: "campaign:other", type: "campaign", size: 2, item: {description: "Other copy"}};
  const fit = fixture({entries: [other]});
  const original = JSON.stringify(fit.adminState);
  const result = fit.context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(result.fits, true);
  assert.match(result.message, /complete back page fit at 12pt.*adjust automatically/i);
  assert.doesNotMatch(result.message, /Standard|Large/);
  assert.match(fit.slots.innerHTML, /Bring a friend and come get to know the group!/);
  assert.deepEqual(fit.renderedEntries.map(({entry}) => entry.key), [
    "campaign:other",
    "custom:unsaved-fit-draft",
  ]);
  assert.deepEqual(fit.renderedEntries.map(({entry}) => entry.size), [1, 1]);
  assert.equal(JSON.stringify(fit.adminState), original);
  assert.equal(fit.removed(), true);
});

test("front custom fit retains Standard and Large choices", () => {
  const standard = fixture({side: "front", contentOverflow: true});
  const result = standard.context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(result.fits, false);
  assert.match(result.message, /Standard.*clips.*Choose Large/);
  const large = fixture({side: "front", size: 3, contentOverflow: true});
  const fit = large.context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(fit.size, 2);
  assert.equal(fit.fits, true);
  assert.match(fit.message, /Large.*fits at 12pt.*complete description/);
  assert.equal(large.draft.size, 3);
});

test("editing replaces only its matching measured entry and retains full image, title, and eyebrow", () => {
  const entries = [{key: 'custom:a"b', type: "custom", size: 1, item: {description: "Saved old copy"}}, {key: "campaign:other", type: "campaign", size: 1, item: {description: "Other copy"}}];
  const original = JSON.stringify(entries);
  const {context, draft, renderedEntries} = fixture({side: "front", editingId: 'a"b', entries});
  draft.imageUrl = "https://example.org/graphic.jpg";
  context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(renderedEntries.length, 2);
  assert.equal(renderedEntries[0].entry.item.description, nextDescription);
  assert.equal(renderedEntries[0].entry.item.imageUrl, draft.imageUrl);
  assert.equal(renderedEntries[0].entry.item.title, draft.title);
  assert.equal(renderedEntries[0].entry.item.eyebrow, draft.eyebrow);
  assert.equal(JSON.stringify(entries), original);
});

test("unselected or over-capacity front drafts explain placement before measurement", () => {
  const off = fixture({side: "off"});
  assert.match(off.context.measureBulletinLayout3CustomDraftFit_().message, /Choose Front or Back/);
  assert.equal(off.appended(), 0);
  const full = fixture({side: "front", entries: [{key: "custom:other", size: 2, item: {}}]});
  assert.match(full.context.measureBulletinLayout3CustomDraftFit_().message, /Not enough slots/);
  assert.equal(full.appended(), 0);
  const back = fixture({entries: Array.from({length: 8}, (_unused, index) => ({
    key: `custom:${index}`,
    type: "custom",
    size: 2,
    item: {},
  }))});
  assert.equal(back.context.measureBulletinLayout3CustomDraftFit_().fits, true);
  assert.equal(back.appended(), 1);
});

test("back custom fit checks the full page and cleans up failed renders", () => {
  const padding = fixture();
  assert.equal(padding.context.measureBulletinLayout3CustomDraftFit_().fits, true);
  assert.equal(padding.checked(), 1);
  const horizontal = fixture({horizontal: true});
  const result = horizontal.context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(result.fits, false);
  assert.match(result.message, /back page is too full.*Shorten copy.*move an item.*remove an item/i);
  assert.doesNotMatch(result.message, /Large/);
  const fullPage = fixture({pageOverflow: true});
  const fullPageResult = fullPage.context.measureBulletinLayout3CustomDraftFit_();
  assert.equal(fullPageResult.fits, false);
  assert.match(fullPageResult.message, /back page is too full/i);
  const failed = fixture({throws: true});
  assert.throws(() => failed.context.measureBulletinLayout3CustomDraftFit_(), /render failed/);
  assert.equal(failed.removed(), true);
});

test("custom card renderer preserves the complete NEXT description and graphic", () => {
  const context = loadFunctions(["escapeHtml_", "escapeAttr_", "renderBulletinLayout3Card_"], {
    getBulletinFallbackImageUrl_: (value) => value,
    renderAdminMarkdownLite_: (value) => `<p>${value}</p>`,
  });
  const html = context.renderBulletinLayout3Card_({type: "custom", key: "custom:next", size: 1, item: {title: "CrossPointe NEXT", description: nextDescription, imageUrl: "https://example.org/next.jpg", imageSide: "left"}});
  assert.match(html, /CrossPointe NEXT/);
  assert.match(html, /src="https:\/\/example.org\/next.jpg"/);
  assert.ok(html.includes(nextDescription));
});

test("custom fit status refresh touches only status text while other layouts skip measurement", () => {
  let layout = "readable";
  let calls = 0;
  const notice = {textContent: "", setAttribute(name, value) { this[name] = value; }};
  const context = loadFunctions(["syncBulletinLayout3CustomDraftFit_"], {
    adminState: {bulletinFallbackBlockEditorOpen: true},
    getBulletinLayout_: () => layout,
    appEl: {querySelector(selector) { assert.equal(selector, "[data-admin-bulletin-custom-fit]"); return notice; }},
    measureBulletinLayout3CustomDraftFit_: () => { calls += 1; return {fits: false, message: "The back page is too full"}; },
    renderAdmin_: () => { throw new Error("typing must preserve input focus"); },
  });
  context.syncBulletinLayout3CustomDraftFit_();
  assert.equal(notice.textContent, "The back page is too full");
  assert.equal(notice["data-fits"], "false");
  layout = "classic";
  context.syncBulletinLayout3CustomDraftFit_();
  assert.equal(calls, 1);
});
