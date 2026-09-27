import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {createSundayPlayer} from "../public/navlab-player.js";

const playerCss = readFileSync(new URL("../public/navlab-player.css", import.meta.url), "utf8");

class FakeClassList {
  constructor(element) { this.element = element; this.values = new Set(); }
  reset(value) { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.contains(value) : force;
    if (enabled) this.add(value); else this.remove(value);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    };
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.rect = {left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0};
    if (this.tagName === "IFRAME") {
      this.contentWindow = {messages: [], postMessage: (message, origin) => {
        this.contentWindow.messages.push({message, origin});
      }};
    }
  }
  set className(value) { this._className = value; this.classList.reset(value); }
  get className() { return this._className || ""; }
  append(...children) { children.forEach((child) => { child.parentElement = this; this.children.push(child); }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); if (name === "data-mode") delete this.dataset.mode; }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, init = {}) {
    const event = {target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...init};
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  getBoundingClientRect() { return this.rect; }
}

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener(event); }
}

function environment() {
  const window = new FakeEventTarget();
  Object.assign(window, {
    innerWidth: 1200,
    innerHeight: 800,
    location: {href: "https://central.crosspointe.tv/navlab", origin: "https://central.crosspointe.tv"},
    frames: [],
    requestAnimationFrame(callback) { this.frames.push(callback); return this.frames.length; },
    cancelAnimationFrame() {},
    flushFrames() { const frames = this.frames.splice(0); frames.forEach((callback) => callback()); },
    setTimeout() { return 1; },
    clearTimeout() {},
  });
  const document = new FakeEventTarget();
  Object.assign(document, {
    defaultView: window,
    documentElement: {clientWidth: 1200, clientHeight: 800},
    navigation: null,
    main: null,
    header: null,
    createElement: (tagName) => new FakeElement(tagName, document),
    querySelector(selector) {
      if (selector === ".navigation") return this.navigation;
      if (selector === ".main") return this.main;
      if (selector === ".site-header") return this.header;
      return null;
    },
  });
  const host = new FakeElement("div", document);
  return {window, document, host};
}

function find(root, className) {
  if (root.classList?.contains(className)) return root;
  for (const child of root.children || []) {
    const match = find(child, className);
    if (match) return match;
  }
  return null;
}

test("exposes the agreed synchronous controller and creates no iframe before open", () => {
  const {host} = environment();
  const player = createSundayPlayer({host});
  assert.deepEqual(Object.keys(player), [
    "configure", "setHomeAnchor", "open", "setView", "setSundayMode", "destroy",
  ]);
  assert.equal(find(host, "lab-player__iframe"), null);
  assert.equal(player.open(), false);
});

test("rejects unsafe or credential-bearing stream URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://viewer:secret@control.resi.io/live",
    "ftp://control.resi.io/live",
  ]) {
    const {host} = environment();
    const player = createSundayPlayer({host});
    player.configure({sunday_livestream_url: url});
    assert.equal(player.open(), false, url);
    assert.equal(find(host, "lab-player__iframe"), null, url);
  }
});

test("keeps one connected iframe while Sunday, view, and mini state change", () => {
  const {window, document, host} = environment();
  const anchor = new FakeElement("div", document);
  anchor.rect = {left: 100, top: 180, width: 640, height: 360, right: 740, bottom: 540};
  let returns = 0;
  let player;
  player = createSundayPlayer({host, onReturn() {
    returns += 1;
    player.setSundayMode(true);
    player.setView("home");
  }});
  player.configure({
    sunday_livestream_url: "https://control.resi.io/webplayer/video.html?id=one",
    sunday_livestream_title: "Watch Live",
  });
  player.setHomeAnchor(anchor);
  player.setSundayMode(true);
  assert.equal(find(host, "lab-player__iframe"), null);
  assert.equal(player.open(), true);

  const root = find(host, "lab-player");
  const iframe = find(host, "lab-player__iframe");
  assert.equal(root.dataset.mode, "inline");
  assert.equal(root.style.left, "100px");
  assert.equal(root.style.width, "640px");
  assert.equal(iframe.getAttribute("allow"), "autoplay; fullscreen");

  player.setView("notes");
  window.flushFrames();
  assert.equal(root.dataset.mode, "mini");
  assert.equal(find(host, "lab-player__iframe"), iframe);
  assert.equal(iframe.isConnected, true);

  player.setView("home");
  window.flushFrames();
  assert.equal(root.dataset.mode, "inline");
  find(host, "lab-player__minimize").emit("click");
  assert.equal(root.dataset.mode, "mini");
  player.setSundayMode(false);
  window.flushFrames();
  assert.equal(find(host, "lab-player__iframe"), iframe);

  find(host, "lab-player__return").emit("click");
  window.flushFrames();
  assert.equal(returns, 1);
  assert.equal(root.dataset.mode, "inline");
  assert.equal(find(host, "lab-player__iframe"), iframe);

  // Reconfiguration does not navigate or replace an active iframe.
  player.configure({sunday_livestream_url: "https://control.resi.io/webplayer/video.html?id=two"});
  assert.equal(find(host, "lab-player__iframe"), iframe);
  assert.match(iframe.src, /id=one/);
});

test("accepts playback state only from the active Resi frame and origin", () => {
  const {window, host} = environment();
  const player = createSundayPlayer({host});
  player.configure({sunday_livestream_url: "https://control.resi.io/webplayer/video.html?id=one"});
  player.open();
  const iframe = find(host, "lab-player__iframe");
  const playback = find(host, "lab-player__playback");
  iframe.emit("load");
  assert.equal(playback.disabled, true);
  assert.equal(playback.dataset.playbackState, "connecting");

  window.emit("message", {source: {}, origin: "https://control.resi.io", data: {name: "paused", value: {paused: true}}});
  window.emit("message", {source: iframe.contentWindow, origin: "https://evil.example", data: {name: "paused", value: {paused: true}}});
  assert.equal(playback.disabled, true);

  window.emit("message", {
    source: iframe.contentWindow,
    origin: "https://control.resi.io",
    data: {name: "paused", value: {paused: true}},
  });
  assert.equal(playback.disabled, false);
  assert.equal(playback.dataset.playbackState, "paused");
  playback.emit("click");
  assert.deepEqual(iframe.contentWindow.messages.at(-1), {
    message: {name: "play", args: []},
    origin: "https://control.resi.io",
  });
});

test("constrains mini geometry above the mobile navigation and removes playback only on close", () => {
  const {window, document, host} = environment();
  window.innerWidth = 390;
  window.innerHeight = 800;
  document.navigation = new FakeElement("nav", document);
  document.navigation.rect = {left: 0, top: 700, width: 390, height: 100, right: 390, bottom: 800};
  const player = createSundayPlayer({host});
  player.configure({sunday_livestream_url: "http://localhost:5005/stream"});
  player.open();
  const root = find(host, "lab-player");
  const iframe = find(host, "lab-player__iframe");
  const width = Number.parseFloat(root.style.width);
  const top = Number.parseFloat(root.style.top);
  assert.equal(width, 240);
  assert.ok(top + width * 9 / 16 <= 688.5);
  assert.equal(find(host, "lab-player__playback").dataset.playbackState, "unavailable");
  iframe.emit("load");
  assert.equal(find(host, "lab-player__playback").dataset.playbackState, "unavailable");

  find(host, "lab-player__close").emit("click");
  assert.equal(find(host, "lab-player__iframe"), null);
  assert.equal(root.hidden, true);
  assert.equal(iframe.isConnected, false);
});

test("moves offscreen inline playback to mini before it can cover page chrome", () => {
  const {window, document, host} = environment();
  document.main = new FakeElement("main", document);
  document.main.rect = {left: 0, top: 110, width: 1200, height: 690, right: 1200, bottom: 800};
  document.header = new FakeElement("header", document);
  document.header.rect = {left: 0, top: 0, width: 1200, height: 110, right: 1200, bottom: 110};
  const anchor = new FakeElement("div", document);
  anchor.rect = {left: 100, top: 180, width: 640, height: 360, right: 740, bottom: 540};
  const player = createSundayPlayer({host});
  player.configure({sunday_livestream_url: "https://control.resi.io/webplayer/video.html?id=one"});
  player.setHomeAnchor(anchor);
  player.setSundayMode(true);
  player.open();
  const root = find(host, "lab-player");
  const iframe = find(host, "lab-player__iframe");
  assert.equal(root.dataset.mode, "inline");

  anchor.rect = {left: 100, top: 80, width: 640, height: 360, right: 740, bottom: 440};
  document.emit("scroll");
  window.flushFrames();
  assert.equal(root.dataset.mode, "mini");
  assert.equal(find(host, "lab-player__iframe"), iframe);

  anchor.rect = {left: 100, top: 180, width: 640, height: 360, right: 740, bottom: 540};
  document.emit("scroll");
  window.flushFrames();
  assert.equal(root.dataset.mode, "inline");
  assert.equal(find(host, "lab-player__iframe"), iframe);
});

test("keeps the move affordance on a separate row at the 160px mini floor", () => {
  const {host} = environment();
  const player = createSundayPlayer({host});
  player.configure({sunday_livestream_url: "https://control.resi.io/live"});
  player.open();
  const controls = find(host, "lab-player__controls");
  const drag = find(host, "lab-player__drag");
  assert.notEqual(drag.parentElement, controls);
  assert.match(playerCss, /\.lab-player__drag\s*\{[^}]*bottom:\s*8px/s);
  assert.match(playerCss, /\.lab-player--mini \.lab-player__return\s*\{[^}]*flex:\s*1 1 auto/s);
});
