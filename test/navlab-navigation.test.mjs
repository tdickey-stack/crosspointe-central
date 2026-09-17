import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../public/navlab.js", import.meta.url), "utf8")
    .replace(/^import .*;$/gm, "");

function preview(hash = "#home") {
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
  const views = ["home", "next-steps", "groups", "events"].map(byId);
  const links = views.map(({id}) => Object.assign(node(`${id}-link`), {dataset: {destination: id}}));
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
    matchMedia: (query) => Object.assign(node(query), {matches: query.includes("max-width")}),
    scrollTo() {},
  });
  let goTo;
  vm.runInNewContext(source, {
    document, location, history, window, setTimeout: () => 1, clearTimeout() {},
    ResizeObserver: class { observe() {} }, mountGroupDirectory() {},
    mountCentralContent: ({onNavigate}) => { goTo = onNavigate; },
  });
  const settle = (left) => { pager.scrollLeft = left; pager.emit("scrollend"); };
  return {goTo, pager, location, byId, settle, selected: () => links.find((link) => link.attributes["aria-current"])?.dataset.destination};
}

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
