import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8");
const baseConfig = {id: "christmas-at-the-movies", previewEnabled: true, previewDefaultOn: false,
  productionEnabled: false, productionStartsAt: "2020-01-01T00:00:00Z", productionEndsAt: "2099-01-01T00:00:00Z"};

function load({url = "https://crosspointe-central--dev-review.web.app/#notes", config = {},
  storage = new Map(), dark = false, publicShell = true, storageBlocked = false} = {}) {
  const attributes = new Map([["data-theme", dark ? "dark" : "light"], ["data-production-shell", String(publicShell)]]);
  const controls = [];
  const events = [];
  const meta = {content: "#f4f4f5"};
  let reloads = 0;
  const window = {
    location: new URL(url),
    CENTRAL_SEASONAL_EXPERIENCE_CONFIG: {...baseConfig, ...config},
    history: {replaceState(_state, _title, next) {window.location = new URL(next, window.location);}},
    localStorage: {
      getItem(key) {if (storageBlocked) throw Error("blocked"); return storage.get(key) || null;},
      setItem(key, value) {if (storageBlocked) throw Error("blocked"); storage.set(key, value);},
      removeItem(key) {if (storageBlocked) throw Error("blocked"); storage.delete(key);},
    },
    CustomEvent: class {constructor(type, {detail}) {this.type = type; this.detail = detail;}},
    dispatchEvent(event) {events.push(event);},
    document: {
      documentElement: {
        getAttribute(key) {return attributes.get(key);},
        setAttribute(key, value) {attributes.set(key, value);},
        removeAttribute(key) {attributes.delete(key);},
      },
      querySelector() {return meta;},
      querySelectorAll() {return controls;},
      createElement(tag) {
        assert.equal(tag, "button");
        const callbacks = {};
        const button = {attributes: {}, setAttribute(key, value) {this.attributes[key] = value;},
          addEventListener(name, callback) {callbacks[name] = callback;}, click() {callbacks.click();}};
        controls.push(button);
        return button;
      },
    },
  };
  window.location.reload = () => {reloads++;};
  const context = vm.createContext({window, URL, URLSearchParams});
  vm.runInContext(read("seasonal-experience.js"), context);
  vm.runInContext(read("central-seasonal.js"), context);
  return {window, api: window.CentralSeasonal, attributes, controls, storage, meta, events,
    reloads: () => reloads};
}

test("public dev defaults to normal and explicit Christmas links activate before content mounts", () => {
  assert.equal(load().api.isActive(), false);
  const p = load({url: "https://crosspointe-central--dev-review.web.app/?seasonalPreview=christmas#events"});
  assert.equal(p.api.isActive(), true);
  assert.equal(p.attributes.get("data-seasonal-experience"), "christmas-at-the-movies");
  assert.equal(p.meta.content, "#f4ead7");
  assert.equal(p.window.location.hash, "#events");
});

test("Home and Sunday controls toggle in place, stay synchronized, and preserve unrelated preferences and URL", () => {
  const storage = new Map([["central-theme-override-v2", "dark"]]);
  const p = load({url: "http://localhost/?keep=yes&seasonalPreview=christmas#notes", dark: true, storage});
  const notes = {draft: "Unsaved notes"};
  const player = {playing: true};
  const home = {children: [notes, player], append(button) {this.children.push(button);}};
  const sunday = {children: [], append(button) {this.children.push(button);}};
  const button = p.api.appendControl(home);
  p.api.appendControl(sunday);
  assert.equal(button.type, "button");
  assert.equal(button.attributes["aria-pressed"], "true");
  assert.equal(button.textContent, "Use Normal Central");
  button.click();
  assert.equal(p.api.isActive(), false);
  assert.equal(p.window.location.search, "?keep=yes");
  assert.equal(p.window.location.hash, "#notes");
  assert.equal(p.attributes.get("data-theme"), "dark");
  assert.equal(p.meta.content, "#18181b");
  assert.equal(storage.get("central-theme-override-v2"), "dark");
  assert.equal(storage.get("central-christmas-movies-2026-mode"), "normal");
  assert.equal(home.children[0], notes);
  assert.equal(home.children[1], player);
  assert.equal(player.playing, true);
  assert.equal(notes.draft, "Unsaved notes");
  for (const control of p.controls) {
    assert.equal(control.textContent, "Christmas Mode");
    assert.equal(control.attributes["aria-pressed"], "false");
    assert.equal(control.hidden, false);
  }
  sunday.children[0].click();
  assert.equal(p.api.isActive(), true);
  assert.equal(p.meta.content, "#07110e");
  assert.equal(p.reloads(), 0);
  assert.deepEqual(p.events.map((event) => [event.type, event.detail.active]),
    [["central:seasonalchange", false], ["central:seasonalchange", true]]);
});

test("production opt-out survives a fresh load and opt-back-in clears only the campaign opt-out", () => {
  const options = {url: "https://central.crosspointe.tv/#home", config: {productionEnabled: true}, storage: new Map()};
  const first = load(options);
  assert.equal(first.api.isActive(), true);
  first.api.setEnabled(false);
  const second = load(options);
  assert.equal(second.api.isActive(), false);
  second.api.setEnabled(true);
  assert.equal(options.storage.has("central-christmas-movies-2026-mode"), false);
  assert.equal(load(options).api.isActive(), true);
});

test("unavailable or unsupported campaigns expose no control and cannot be enabled", () => {
  for (const options of [
    {url: "https://central.crosspointe.tv/?seasonalPreview=christmas"},
    {url: "https://example.org/?seasonalPreview=christmas"},
    {url: "http://localhost/admin?seasonalPreview=christmas"},
    {config: {id: "another-campaign"}},
  ]) {
    const p = load(options);
    assert.equal(p.api.appendControl({append() {assert.fail("unavailable control mounted");}}), null);
    assert.equal(p.api.setEnabled(true), false);
    assert.equal(p.events.length, 0);
    assert.equal(p.attributes.has("data-seasonal-experience"), false);
  }
});

test("blocked browser storage still allows toggling the current page without reload", () => {
  const p = load({storageBlocked: true});
  assert.equal(p.api.setEnabled(true), true);
  assert.equal(p.api.isActive(), true);
  assert.equal(p.api.setEnabled(false), true);
  assert.equal(p.api.isActive(), false);
  assert.equal(p.reloads(), 0);
});

test("adapter stays out of the isolated lab", () => {
  assert.equal(load({publicShell: false}).api, undefined);
});
