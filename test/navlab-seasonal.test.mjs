import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

import {appendSeasonalPreviewDecorations} from "../public/navlab-content.js";

const read = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
function preview(url = "http://localhost/navlab.html", {stored = "", production = false} = {}) {
  const attributes = new Map([["data-theme", "light"]]);
  const events = [];
  const callbacks = {};
  const button = {hidden: true, attributes: {}, setAttribute(k, v) {this.attributes[k] = v;}, addEventListener(k, fn) {callbacks[k] = fn;}};
  const label = {textContent: "Off"};
  const meta = {content: "#f4f4f5"};
  let writes = 0;
  const window = {
    location: new URL(url),
    CENTRAL_SEASONAL_EXPERIENCE_CONFIG: {id: "christmas-at-the-movies", previewEnabled: true,
      previewDefaultOn: false, productionEnabled: production,
      productionStartsAt: "2020-01-01", productionEndsAt: "2099-01-01"},
    localStorage: {getItem() {return stored;}, setItem() {writes++;}, removeItem() {writes++;}},
    history: {replaceState(_state, _title, next) {window.location = new URL(next, window.location);}},
    document: {
      readyState: "complete",
      documentElement: {setAttribute(k, v) {attributes.set(k, v);}, removeAttribute(k) {attributes.delete(k);}, getAttribute(k) {return attributes.get(k);}},
      querySelector() {return meta;},
      getElementById(id) {return id === "christmas-toggle" ? button : id === "christmas-toggle-state" ? label : null;},
    },
    Event: class {constructor(type) {this.type = type;}},
    dispatchEvent(event) {events.push(event.type);},
    addEventListener() {},
  };
  const context = vm.createContext({window, URL, URLSearchParams});
  vm.runInContext(read("seasonal-experience.js"), context);
  vm.runInContext(read("navlab-seasonal.js"), context);
  return {window, attributes, button, label, meta, events, click: () => callbacks.click(), writes: () => writes};
}

test("Navlab starts normal independently of the saved Central seasonal preference", () => {
  const p = preview(undefined, {stored: "seasonal"});
  assert.equal(p.attributes.has("data-seasonal-experience"), false);
  assert.equal(p.button.hidden, false);
  assert.equal(p.writes(), 0);
});

test("Christmas URL works on local and dev previews, including direct links to a tab", () => {
  for (const host of ["127.0.0.1:8765", "crosspointe-central--dev-example.web.app"]) {
    const p = preview(`http://${host}/navlab.html?seasonalPreview=christmas#events`);
    assert.equal(p.attributes.get("data-seasonal-experience"), "christmas-at-the-movies");
    assert.equal(p.button.attributes["aria-pressed"], "true");
    assert.equal(p.meta.content, "#f4ead7");
    assert.equal(p.window.location.hash, "#events");
  }
});

test("toggle preserves the current tab and other query options without reloading or changing saved settings", () => {
  const p = preview("http://localhost/navlab.html?debug=yes#notes");
  p.click();
  assert.equal(p.window.location.search, "?debug=yes&seasonalPreview=christmas");
  assert.equal(p.window.location.hash, "#notes");
  assert.equal(p.label.textContent, "On");
  p.click();
  assert.equal(p.attributes.has("data-seasonal-experience"), false);
  assert.equal(p.window.location.search, "?debug=yes&seasonalPreview=off");
  assert.equal(p.label.textContent, "Off");
  assert.equal(p.writes(), 0);
  assert.deepEqual(p.events, ["navlabseasonchange", "navlabseasonchange"]);
});

test("light/dark browser chrome follows the selected preview without changing the theme", () => {
  const p = preview("http://localhost/navlab?seasonalPreview=christmas");
  p.attributes.set("data-theme", "dark");
  p.window.NavlabSeasonal.syncThemeColor();
  assert.equal(p.meta.content, "#07110e");
  p.click();
  assert.equal(p.meta.content, "#18181b");
  assert.equal(p.attributes.get("data-theme"), "dark");
});

test("preview toggle cannot activate on production, unknown hosts, or excluded routes", () => {
  for (const url of ["https://central.crosspointe.tv/navlab", "https://example.org/navlab", "http://localhost/admin"]) {
    const p = preview(`${url}?seasonalPreview=christmas`, {production: true});
    assert.equal(p.button.hidden, true);
    assert.equal(p.window.NavlabSeasonal.setEnabled(true), false);
    assert.equal(p.attributes.has("data-seasonal-experience"), false);
  }
});

test("Navlab boots the seasonal adapter before its own CSS without importing the legacy app", () => {
  const html = read("navlab.html");
  assert.ok(html.includes('data-app-route="public"'));
  assert.ok(html.indexOf('/seasonal-config.js') < html.indexOf('/seasonal-experience.js'));
  assert.ok(html.indexOf('/seasonal-experience.js') < html.indexOf('/navlab-seasonal.js'));
  assert.ok(html.indexOf('/navlab.css') < html.indexOf('/navlab-christmas.css'));
  assert.doesNotMatch(html, /(?:src|href)="\/(?:app\.js|styles\.css|christmas-movies\.css)/);
});

test("seasonal hero decorations stay out of production Home and Sunday but remain ready in Navlab", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalResizeObserver = globalThis.ResizeObserver;
  const node = (tagName) => ({
    tagName,
    children: [],
    className: "",
    classList: {values: [], add(value) { this.values.push(value); }},
    append(...children) { this.children.push(...children); },
    setAttribute() {},
  });
  const documentElement = {dataset: {productionShell: "true"}};

  globalThis.document = {
    documentElement,
    createElement: (tagName) => node(tagName),
    createElementNS: (_namespace, tagName) => node(tagName),
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
  };

  try {
    globalThis.window = {NavlabSeasonal: {}};
    for (const surface of ["Home", "Sunday"]) {
      const hero = node(`${surface} hero`);
      const copy = node(`${surface} copy`);
      assert.equal(appendSeasonalPreviewDecorations(hero, copy), false);
      assert.deepEqual(hero.children, []);
      assert.deepEqual(copy.children, []);
    }

    delete documentElement.dataset.productionShell;
    for (const surface of ["Home", "Sunday"]) {
      const hero = node(`${surface} hero`);
      const copy = node(`${surface} copy`);
      assert.equal(appendSeasonalPreviewDecorations(hero, copy), true);
      assert.equal(hero.children[0].classList.values.includes("navlab-marquee"), true);
      assert.equal(copy.children[0].className, "navlab-catm-brand");
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.ResizeObserver = originalResizeObserver;
  }
});
