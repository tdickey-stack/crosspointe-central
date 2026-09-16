import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

function createPage(hash = "#serve-needs") {
  const elements = new Map();
  const frames = new Map();
  const listeners = new Map();
  const scrolls = [];
  let frameId = 0;
  const window = {
    location: {pathname: "/", hash},
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const document = {
    addEventListener() {},
    getElementById(id) { return elements.get(id) || null; },
  };
  const context = vm.createContext({window, document});
  vm.runInContext(source, context);
  context.initializeCentralSectionNavigation_();
  return {
    context, scrolls, listeners,
    insert(id) {
      elements.set(id, {scrollIntoView(options) { scrolls.push({id, ...options}); }});
    },
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback());
    },
    render() { context.scheduleInitialSectionNavigation_(); },
    flush() { this.frame(); this.frame(); },
  };
}

test("a fresh fragment waits for asynchronous content and scrolls once", () => {
  const page = createPage();
  page.render();
  page.flush();
  assert.equal(page.scrolls.length, 0);
  page.insert("serve-needs");
  page.render();
  page.flush();
  assert.deepEqual(page.scrolls, [{id: "serve-needs", behavior: "instant", block: "start"}]);
  page.render();
  page.flush();
  assert.equal(page.scrolls.length, 1, "background refresh must not repeat navigation");
  assert.equal(page.listeners.size, 0);
});

test("cached render replaced before layout uses the current target only once", () => {
  const page = createPage();
  page.insert("serve-needs");
  page.render();
  page.frame();
  page.insert("serve-needs");
  page.render();
  page.flush();
  assert.equal(page.scrolls.length, 1);
});

test("known aliases and encoded fragment IDs resolve safely", () => {
  for (const [hash, id] of [["#sermon-notes", "notes"], ["#serve%2Dneeds", "serve-needs"], ["#events", "upcoming-events"]]) {
    const page = createPage(hash);
    page.insert(id);
    page.render();
    page.flush();
    assert.equal(page.scrolls[0].id, id);
  }
});

test("empty, missing, and malformed fragments do not break rendering", () => {
  for (const hash of ["", "#missing", "#%", "#foo["]) {
    const page = createPage(hash);
    page.render();
    assert.doesNotThrow(() => page.flush());
    assert.equal(page.scrolls.length, 0);
  }
});

test("visitor interaction cancels a pending landing scroll before late content arrives", () => {
  for (const type of ["wheel", "touchstart", "pointerdown", "keydown", "hashchange"]) {
    const page = createPage();
    page.render();
    page.frame();
    page.listeners.get(type)();
    page.insert("serve-needs");
    page.render();
    page.flush();
    assert.equal(page.scrolls.length, 0, type);
    assert.equal(page.listeners.size, 0);
  }
});

test("an explicit section click keeps smooth scrolling and cancels initial navigation", () => {
  const page = createPage();
  page.insert("upcoming-events");
  let prevented = false;
  page.context.scrollToSection({preventDefault() { prevented = true; }}, "#events");
  page.insert("serve-needs");
  page.render();
  page.flush();
  assert.equal(prevented, true);
  assert.deepEqual(page.scrolls, [{id: "upcoming-events", behavior: "smooth", block: "start"}]);
});
