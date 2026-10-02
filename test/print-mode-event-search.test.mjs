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

const makeEvents = () => [
  {id: "one", title: "Family Dinner", description: "Bring friends", location: "Main Hall", date: "2026-10-04", time: "6:00 PM", week: "week1", included: true},
  {id: "two", title: "Family Workshop", description: "Dinner together", location: "Room 2", date: "2026-10-12", time: "7:00 PM", week: "week2", included: false},
  {id: "three", title: "Music Night", description: "Friends welcome", location: "Main Hall", date: "2026-10-20", time: "6:00 PM", week: "week3", included: true},
];
const ids = (events) => Array.from(events, (item) => item.id);

function filterContext(events, filter = "all", search = "") {
  const adminState = {bulletinEventFilter: filter, bulletinEventSearch: search};
  const context = loadFunctions(["getFilteredBulletinEventDrafts_", "updateBulletinEventBulkInclusion_"], {
    adminState,
    getBulletinEventDraftsInWindow_: () => events,
    getBulletinEventWeek_: (item) => item.week,
  });
  return {context, adminState};
}

test("event search matches every term across copy, schedule, and location without changing source events", () => {
  const events = makeEvents();
  const original = JSON.stringify(events);
  const {context, adminState} = filterContext(events);
  const cases = [
    ["  FAMILY   dinner ", ["one", "two"]],
    ["friends HALL", ["one", "three"]],
    ["2026-10-12 7:00", ["two"]],
    ["family music", []],
    [" \t\n ", ["one", "two", "three"]],
  ];
  for (const [query, expected] of cases) {
    adminState.bulletinEventSearch = query;
    assert.deepEqual(ids(context.getFilteredBulletinEventDrafts_(events)), expected, query);
  }
  assert.equal(JSON.stringify(events), original);
});

test("event search intersects week and included filters and accepts the live event source", () => {
  const events = makeEvents();
  const {context, adminState} = filterContext(events, "week2", "family");
  assert.deepEqual(ids(context.getFilteredBulletinEventDrafts_()), ["two"]);
  adminState.bulletinEventFilter = "included";
  assert.deepEqual(ids(context.getFilteredBulletinEventDrafts_()), ["one"]);
  adminState.bulletinEventSearch = "hall";
  assert.deepEqual(ids(context.getFilteredBulletinEventDrafts_()), ["one", "three"]);
});

test("starting search selects all days, later typing preserves filters and avoids draft mutation or full rendering", () => {
  const draft = {events: makeEvents()};
  const adminState = {bulletinEventFilter: "week1", bulletinEventSearch: "", bulletinDraft: draft, bulletinDirty: false};
  const original = JSON.stringify(draft);
  let syncCalls = 0;
  const context = loadFunctions(["updateBulletinEventSearch_"], {
    adminState,
    syncBulletinEventSearchResults_: () => { syncCalls += 1; },
    renderAdmin_: () => { throw new Error("search must preserve the input node"); },
  });
  context.updateBulletinEventSearch_("  Family ");
  assert.equal(adminState.bulletinEventSearch, "  Family ");
  assert.equal(adminState.bulletinEventFilter, "all");
  adminState.bulletinEventFilter = "week2";
  context.updateBulletinEventSearch_("family dinner");
  assert.equal(adminState.bulletinEventFilter, "week2");
  context.updateBulletinEventSearch_("x".repeat(220));
  assert.equal(adminState.bulletinEventSearch.length, 200);
  context.updateBulletinEventSearch_("");
  assert.equal(adminState.bulletinEventFilter, "week2");
  assert.equal(adminState.bulletinEventSearch, "");
  assert.equal(syncCalls, 4);
  assert.equal(adminState.bulletinDraft, draft);
  assert.equal(JSON.stringify(draft), original);
  assert.equal(adminState.bulletinDirty, false);
});

test("search bulk inclusion changes only matching events in the active view", () => {
  const events = makeEvents();
  const {context, adminState} = filterContext(events, "week2", "family");
  context.updateBulletinEventBulkInclusion_("include");
  assert.deepEqual(events.map((item) => item.included), [true, true, true]);
  context.updateBulletinEventBulkInclusion_("exclude");
  assert.deepEqual(events.map((item) => item.included), [true, false, true]);
  adminState.bulletinEventFilter = "included";
  adminState.bulletinEventSearch = "hall";
  context.updateBulletinEventBulkInclusion_("exclude");
  assert.deepEqual(events.map((item) => item.included), [false, false, false]);
});

test("blank-search bulk retains all-days behavior and Week 1 reset clears the search", () => {
  const events = makeEvents();
  const {context, adminState} = filterContext(events, "week2", "  ");
  context.updateBulletinEventBulkInclusion_("exclude");
  assert.deepEqual(events.map((item) => item.included), [false, false, false]);
  context.updateBulletinEventBulkInclusion_("include");
  assert.deepEqual(events.map((item) => item.included), [true, true, true]);
  adminState.bulletinEventSearch = "music";
  context.updateBulletinEventBulkInclusion_("week1-default");
  assert.deepEqual(events.map((item) => item.included), [true, false, false]);
  assert.equal(adminState.bulletinEventSearch, "");
  assert.equal(adminState.bulletinEventFilter, "week1");
});

function renderContext(search = "") {
  return loadFunctions([
    "escapeHtml_", "escapeAttr_", "renderBulletinEventSearch_",
    "renderBulletinEventFilterBar_", "renderBulletinEventResultCount_",
    "renderBulletinEventResultCards_", "renderBulletinEventResults_",
  ], {
    adminState: {bulletinEventFilter: "all", bulletinEventSearch: search},
    PRINT_MODE_EVENT_WEEK_COUNT: 4,
    getFilteredBulletinEventDrafts_: (events) => events,
    renderBulletinEventEditor_: (item, options) => `<article data-readonly="${!options.canSave}" data-readable="${!!options.readable}">${item.title}</article>`,
  });
}

test("shared event toolbar provides escaped accessible search and view-appropriate bulk actions", () => {
  const context = renderContext('Family "Dinner" & Friends');
  const html = context.renderBulletinEventFilterBar_(3, [1, 1, 1, 0], 2);
  assert.match(html, /type="search"/);
  assert.match(html, /Search events/);
  assert.match(html, /Family &quot;Dinner&quot; &amp; Friends/);
  assert.match(html, /Include Results/);
  assert.match(html, /Exclude Results/);
  const readable = context.renderBulletinEventFilterBar_(3, [1, 1, 1, 0], 2, {readable: true});
  assert.match(readable, /type="search"/);
  assert.doesNotMatch(readable, /bulk-bulletin-events/);
});

test("event results expose a live count, preserve rendering permissions, and explain an empty search", () => {
  const context = renderContext("family");
  const html = context.renderBulletinEventResults_(makeEvents(), false, true);
  assert.match(html, /data-admin-bulletin-event-results/);
  assert.match(html, /(?:aria-live="polite"|role="status")/);
  assert.match(html, /Showing 3 of 3 events/);
  assert.match(html, /data-readonly="true" data-readable="true"/);
  assert.match(html, /Family Dinner/);
  const empty = context.renderBulletinEventResults_([], true, false);
  assert.match(empty, /No events match/i);
  assert.doesNotMatch(empty, /<article/);
});

test("search synchronization updates results and buttons while preserving the input and filter counts", () => {
  const adminState = {bulletinEventFilter: "all", bulletinEventSearch: "family"};
  const count = {textContent: "old count"};
  const list = {innerHTML: "old cards"};
  const results = {
    getAttribute: (name) => name === "data-readable" ? "true" : "false",
    querySelector: (selector) => selector.includes("result-count") ? count : list,
  };
  const buttons = ["week1", "all"].map((filter) => ({
    count: "baseline count",
    active: false,
    attributes: {},
    getAttribute: () => filter,
    setAttribute(name, value) { this.attributes[name] = value; },
    classList: {toggle(name, active) { buttons.find((button) => button.getAttribute() === filter).active = active; }},
  }));
  const bulk = ["include", "exclude", "week1-default"].map((mode) => ({
    textContent: mode === "week1-default" ? "Reset to Week 1" : "old label",
    getAttribute: () => mode,
  }));
  const context = loadFunctions(["syncBulletinEventSearchResults_", "renderBulletinEventResultCount_"], {
    adminState,
    appEl: {
      querySelector(selector) {
        assert.equal(selector, "[data-admin-bulletin-event-results]");
        return results;
      },
      querySelectorAll(selector) {
        return selector === "[data-admin-bulletin-filter]" ? buttons : bulk;
      },
      set innerHTML(_) { throw new Error("search must retain the editor and input"); },
    },
    getBulletinEventSelectionItems_: (readable) => { assert.equal(readable, true); return makeEvents(); },
    getFilteredBulletinEventDrafts_: (events) => events.slice(0, 2),
    renderBulletinEventResultCards_: (events, canSave, readable) => {
      assert.equal(events.length, 3);
      assert.equal(canSave, false);
      assert.equal(readable, true);
      return "matching cards";
    },
    renderAdmin_: () => { throw new Error("no full render while typing"); },
  });
  context.syncBulletinEventSearchResults_();
  assert.equal(count.textContent, "Showing 2 of 3 events");
  assert.equal(list.innerHTML, "matching cards");
  assert.deepEqual(buttons.map((button) => button.active), [false, true]);
  assert.deepEqual(buttons.map((button) => button.attributes["aria-pressed"]), ["false", "true"]);
  assert.deepEqual(buttons.map((button) => button.count), ["baseline count", "baseline count"]);
  assert.deepEqual(bulk.map((button) => button.textContent), ["Include Results", "Exclude Results", "Reset to Week 1"]);
  adminState.bulletinEventSearch = "";
  context.syncBulletinEventSearchResults_();
  assert.deepEqual(bulk.map((button) => button.textContent), ["Include All", "Exclude All", "Reset to Week 1"]);
});
