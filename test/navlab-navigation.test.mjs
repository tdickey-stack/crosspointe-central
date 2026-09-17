import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../public/navlab.js", import.meta.url), "utf8")
    .replace(/^import .*;$/gm, "");

function preview(hash = "#home", {mobile = true} = {}) {
  const node = (id) => ({
    id, dataset: {}, style: {setProperty() {}}, listeners: {}, attributes: {},
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); },
    emit(type, target = this) { this.listeners[type]?.forEach((fn) => fn({target})); },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    append(child) { child.parentElement = this; },
    insertBefore(child) { child.parentElement = this; },
    focus() { this.focused = true; },
    getBoundingClientRect() { return {bottom: 102, height: 71}; },
  });
  const ids = new Map();
  const byId = (id) => {
    if (!ids.has(id)) ids.set(id, node(id));
    return ids.get(id);
  };
  const views = ["home", "notes", "next-steps", "groups", "events"].map(byId);
  const links = views.map(({id}) => Object.assign(byId(`${id}-link`), {dataset: {destination: id}}));
  byId("notes-link").hidden = true;
  const pager = byId("page-track");
  Object.assign(pager, {clientWidth: 390, scrollLeft: 0, requests: [], scrollTo(options) {
    this.requests.push(options);
    // Smooth movement is asynchronous: the browser may emit a stale scrollend first.
    if (options.behavior === "instant") this.scrollLeft = options.left;
  }});
  const dialog = byId("detail-dialog");
  dialog.querySelector = byId;
  const document = Object.assign(node("document"), {
    getElementById: byId, documentElement: node("html"), body: node("body"),
    querySelectorAll: (selector) => selector === ".view" ? views : links,
    querySelector: (selector) => selector === "dialog[open]" ? null : byId(selector),
  });
  const location = {hash};
  const history = {pushState: (_, __, value) => { location.hash = value; }};
  const window = Object.assign(node("window"), {
    matchMedia: (query) => Object.assign(node(query), {matches: mobile && query.includes("max-width")}),
    scrollTo() {},
  });
  let goTo;
  let receiveData;
  const studyCalls = [];
  const playerViews = [];
  const loads = {central: 0, groups: 0};
  // Keep both requests unresolved to verify that startup/navigation never waits.
  const pending = new Promise(() => {});
  vm.runInNewContext(source, {
    document, location, history, window, setTimeout: () => 1, clearTimeout() {},
    ResizeObserver: class { observe() {} },
    mountGroupDirectory() { loads.groups++; return pending; },
    mountSundayStudy(root, options) { studyCalls.push({root, options}); return {setTheme() {}}; },
    createSundayPlayer() { return {configure() {}, setHomeAnchor() {}, setView(view) { playerViews.push(view); }, setSundayMode() {}, open() {}}; },
    mountCentralContent: ({onNavigate, onData}) => { loads.central++; goTo = onNavigate; receiveData = onData; return pending; },
  });
  const settle = (left) => { pager.scrollLeft = left; pager.emit("scrollend"); };
  return {goTo, pager, location, byId, settle, loads, studyCalls, playerViews,
    receiveData, toggle: () => byId("sunday-toggle").emit("click"),
    selected: () => links.find((link) => link.attributes["aria-current"])?.dataset.destination};
}

test("Sunday preview adds Notes in second position and restores the four-page pager", () => {
  const page = preview();
  assert.equal(page.byId("notes").hidden, true);
  page.toggle();
  assert.equal(page.byId("sunday-toggle").attributes["aria-pressed"], "true");
  assert.equal(page.byId("notes-link").hidden, false);
  assert.equal(page.byId("home-content").hidden, true);
  page.goTo("notes"); page.settle(390);
  assert.equal(page.selected(), "notes");
  page.goTo("groups"); page.settle(1170);
  assert.equal(page.selected(), "groups");
  page.toggle();
  assert.equal(page.selected(), "home");
  assert.equal(page.pager.scrollLeft, 0);
  assert.equal(page.byId("notes").hidden, true);
  assert.equal(page.byId("notes").inert, true);
  page.settle(1170); // A stale Sunday scroll must not select another tab.
  assert.equal(page.selected(), "home");
  assert.equal(page.location.hash, "#home");
  page.goTo("groups"); page.settle(780);
  assert.equal(page.selected(), "groups");
});

test("Notes mounts once after data arrives and survives tab and Sunday preview changes", () => {
  const page = preview();
  page.goTo("notes"); page.settle(390);
  assert.equal(page.byId("sunday-toggle").attributes["aria-pressed"], "true");
  assert.equal(page.studyCalls.length, 0);
  page.receiveData({sunday: {date: "September 20, 2026"}});
  assert.equal(page.studyCalls.length, 1);
  page.goTo("events"); page.settle(1560);
  page.toggle(); page.toggle();
  page.goTo("notes"); page.settle(390);
  assert.equal(page.studyCalls.length, 1);
  assert.equal(page.playerViews.at(-1), "notes");
  assert.deepEqual(page.loads, {central: 1, groups: 1});
});

test("a Notes deep link enables Sunday preview and desktop mode hides other panels", () => {
  const page = preview("#notes", {mobile: false});
  assert.equal(page.selected(), "notes");
  assert.equal(page.byId("notes").hidden, false);
  assert.equal(page.byId("home").hidden, true);
  page.toggle();
  assert.equal(page.byId("notes").hidden, true);
  assert.equal(page.byId("home").hidden, false);
  assert.equal(page.byId("home-title").focused, true);
});

test("Home starts both feeds in the background before either request completes", () => {
  const page = preview();
  assert.equal(page.selected(), "home");
  assert.deepEqual(page.loads, {central: 1, groups: 1});
  page.goTo("groups");
  page.settle(780);
  page.goTo("events");
  page.settle(1170);
  page.goTo("groups");
  page.settle(780);
  assert.equal(page.selected(), "groups");
  assert.deepEqual(page.loads, {central: 1, groups: 1});
});

test("a Groups deep link mounts the directory only once during startup", () => {
  const page = preview("#groups");
  assert.equal(page.selected(), "groups");
  assert.deepEqual(page.loads, {central: 1, groups: 1});
});

test("a stale Home scrollend cannot undo a Groups button request", () => {
  const page = preview();
  page.goTo("groups");
  page.settle(0);
  assert.equal(page.location.hash, "#groups");
  assert.equal(page.selected(), "groups");
  assert.equal(page.byId("groups-title").focused, undefined);
  page.settle(780);
  assert.equal(page.byId("groups-title").focused, true);
});

test("a second tab request wins over an earlier in-flight transition", () => {
  const page = preview();
  page.goTo("groups");
  page.goTo("events");
  page.settle(780);
  assert.equal(page.location.hash, "#events");
  page.settle(1170);
  assert.equal(page.selected(), "events");
});

test("a native gesture can interrupt navigation and select the settled page", () => {
  const page = preview();
  page.goTo("events");
  page.pager.emit("touchstart");
  page.settle(780);
  assert.equal(page.location.hash, "#groups");
  page.pager.emit("wheel");
  page.settle(0);
  assert.equal(page.selected(), "home");
});

test("tapping the selected tab again repairs an interrupted scroll", () => {
  const page = preview();
  page.goTo("groups");
  const requests = page.pager.requests.length;
  page.goTo("groups");
  assert.equal(page.pager.requests.length, requests + 1);
  assert.equal(page.pager.requests.at(-1).left, 780);
});

test("child scroll completion cannot change the selected page", () => {
  const page = preview("#groups");
  assert.equal(page.pager.scrollLeft, 780);
  page.pager.scrollLeft = 0;
  page.pager.emit("scrollend", page.byId("groups"));
  assert.equal(page.location.hash, "#groups");
});

test("Next Steps is the second page and supports swiping forward to Groups", () => {
  const page = preview();
  page.goTo("next-steps");
  assert.equal(page.pager.requests.at(-1).left, 390);
  page.settle(390);
  assert.equal(page.selected(), "next-steps");
  assert.equal(page.byId("next-steps-title").focused, true);
  page.pager.emit("touchstart");
  page.settle(780);
  assert.equal(page.location.hash, "#groups");
});

test("swiping highlights the mostly visible page before snap completion", () => {
  const page = preview();
  page.pager.emit("touchstart");
  page.pager.scrollLeft = 210;
  page.pager.emit("scroll");
  assert.equal(page.selected(), "next-steps");
  assert.equal(page.location.hash, "#home");
  page.pager.scrollLeft = 140;
  page.pager.emit("scroll");
  assert.equal(page.selected(), "home");
});

test("button navigation keeps its target highlighted while crossing other pages", () => {
  const page = preview();
  page.goTo("events");
  page.pager.scrollLeft = 400;
  page.pager.emit("scroll");
  assert.equal(page.selected(), "events");
});
