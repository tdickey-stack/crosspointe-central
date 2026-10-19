import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const {mount, normalize, renderMarkdown} = require("../public/central-whats-new.js");

function makeClassList(...initial) {
  const values = new Set(initial);
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
  };
}

function makeHarness({
  loader = "absent",
  production = true,
  storedVersion = "",
  storageThrows = false,
  showFailures = 0,
  activeElement = null,
} = {}) {
  const windowListeners = new Map();
  const observers = [];
  const storage = new Map(storedVersion ? [["central-whats-new-seen-v1", storedVersion]] : []);
  const storageWrites = [];
  const dialogs = [];
  const root = {
    dataset: {productionShell: production ? "true" : "false"},
    classList: makeClassList(),
  };
  const body = {isConnected: true, appendChild(node) {
    node.isConnected = true;
    dialogs.push(node);
  }};
  const navigationFocus = {isConnected: true, focusCalls: [], focus(options) {
    this.focusCalls.push(options);
  }};
  const loaderNode = loader === "absent" ? null : {
    classList: makeClassList(...(loader === "hidden" ? ["is-hidden"] : [])),
  };
  let externalDialogOpen = false;
  let remainingShowFailures = showFailures;
  let analyticsCalls = 0;

  function makeDialog() {
    const listeners = new Map();
    const attributes = {};
    const dialog = {
      attributes,
      classList: makeClassList(),
      id: "",
      innerHTML: "",
      isConnected: false,
      open: false,
      removed: false,
      showCalls: 0,
      closeCalls: 0,
      addEventListener(type, listener) { listeners.set(type, listener); },
      setAttribute(name, value) { attributes[name] = value; },
      closest() { return null; },
      getBoundingClientRect() { return {left: 100, right: 500, top: 100, bottom: 500}; },
      showModal() {
        this.showCalls += 1;
        if (remainingShowFailures > 0) {
          remainingShowFailures -= 1;
          throw new Error("showModal failed");
        }
        this.open = true;
      },
      close() {
        this.closeCalls += 1;
        if (!this.open) return;
        this.open = false;
        listeners.get("close")?.({target: this});
      },
      remove() {
        this.open = false;
        this.removed = true;
        this.isConnected = false;
      },
      click(event) { listeners.get("click")?.(event); },
      nativeClose() {
        this.open = false;
        listeners.get("close")?.({target: this});
      },
    };
    return dialog;
  }

  const document = {
    documentElement: root,
    body,
    activeElement: activeElement || body,
    getElementById(id) {
      if (id === "central-loader") return loaderNode;
      return dialogs.find(dialog => dialog.id === id && dialog.isConnected) || null;
    },
    querySelector(selector) {
      if (selector === "dialog[open]") {
        if (externalDialogOpen) return {open: true};
        return dialogs.find(dialog => dialog.open) || null;
      }
      if (selector === '.navigation [aria-current="page"]') return navigationFocus;
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, "dialog");
      return makeDialog();
    },
  };
  const window = {
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error("storage unavailable");
        return storage.get(key) || null;
      },
      setItem(key, value) {
        if (storageThrows) throw new Error("storage unavailable");
        storage.set(key, String(value));
        storageWrites.push([key, String(value)]);
      },
    },
    centralAnalyticsService: {observeSections() { analyticsCalls += 1; }},
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; }
    },
  };

  return {
    body,
    dialogs,
    document,
    loaderNode,
    navigationFocus,
    root,
    storage,
    storageWrites,
    window,
    get analyticsCalls() { return analyticsCalls; },
    get observer() { return observers[0]; },
    emit(whatsNew) {
      windowListeners.get("central:data")?.({detail: {whatsNew}});
    },
    mutate() { observers.forEach(observer => observer.callback([])); },
    setExternalDialogOpen(value) { externalDialogOpen = value; },
  };
}

const release = (version = "1.3", overrides = {}) => ({
  active: true,
  version,
  title: "A better Central",
  message: "Here is what changed.",
  button_text: "Continue",
  ...overrides,
});

test("the production shell loads the What's New behavior and styles", () => {
  const shell = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(shell, /href="\/central-whats-new\.css\?v=1"/);
  assert.match(shell, /<script defer src="\/central-whats-new\.js\?v=1"><\/script>/);
});

test("normalize enforces active content and preserves the legacy field contract", () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize({active: false, version: "1.3", message: "News"}), null);
  assert.equal(normalize({active: true, version: "1.3", message: "  "}), null);
  assert.equal(normalize({active: "true", message: "News"}), null);
  assert.deepEqual(normalize({
    active: "TRUE",
    version: " 1.3 ",
    title: " Latest changes ",
    message: " **Ready** ",
    button_text: " Let's go ",
    force_show: "false",
  }), {
    version: "1.3",
    forceShow: false,
    title: "Latest changes",
    message: "**Ready**",
    buttonText: "Let's go",
  });
});

test("normalize treats force flags as booleans and supplies legacy defaults", () => {
  const forced = normalize({
    active: true,
    message: "Testing announcement",
    force_show: true,
    testing_button_text: "Got it",
  });
  assert.deepEqual(forced, {
    version: "Testing",
    forceShow: true,
    title: "What's New In Central",
    message: "Testing announcement",
    buttonText: "Got it",
  });
  assert.equal(normalize({
    active: true,
    message: "Not really forced",
    force_every_time: "false",
  }), null);
});

test("markdown keeps legacy headings, emphasis, code, and nested lists while escaping HTML", () => {
  const html = renderMarkdown(`# **Highlights**

Use \`Central\` with *confidence*.

- First <script>alert(1)</script>
  - Nested **detail**
1. Ordered item`);
  assert.match(html, /^<h3 class="whats-new-heading level-1"><strong>Highlights<\/strong><\/h3>/);
  assert.match(html, /<p>Use <code>Central<\/code> with <em>confidence<\/em>\.<\/p>/);
  assert.match(html, /<ul><li>First &lt;script&gt;alert\(1\)&lt;\/script&gt;<ul><li>Nested <strong>detail<\/strong><\/li><\/ul><\/li><\/ul>/);
  assert.match(html, /<ol><li>Ordered item<\/li><\/ol>$/);
  assert.doesNotMatch(html, /<script>|<img|onerror=/);
});

test("mount waits for the loader, opens once, records success, and restores prior focus", () => {
  const previousFocus = {isConnected: true, focusCalls: [], focus(options) { this.focusCalls.push(options); }};
  const h = makeHarness({loader: "visible", activeElement: previousFocus});
  mount(h.window, h.document);
  h.emit(release());
  assert.equal(h.dialogs.length, 0);

  h.loaderNode.classList.add("is-hidden");
  h.mutate();
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0].open, true);
  assert.equal(h.dialogs[0].id, "central-whats-new-modal");
  assert.match(h.dialogs[0].innerHTML, /Version 1\.3/);
  assert.match(h.dialogs[0].innerHTML, /A better Central/);
  assert.equal(h.root.classList.contains("central-whats-new-open"), true);
  assert.deepEqual(h.storageWrites, [["central-whats-new-seen-v1", "1.3"]]);
  assert.equal(h.analyticsCalls, 1);

  h.emit(release());
  h.dialogs[0].nativeClose();
  assert.equal(h.root.classList.contains("central-whats-new-open"), false);
  assert.deepEqual(previousFocus.focusCalls, [{preventScroll: true}]);
  assert.equal(h.dialogs.length, 1);
  h.emit(release());
  assert.equal(h.dialogs.length, 1);
});

test("an absent loader is ready, but an existing dialog defers without losing a queued release", () => {
  const h = makeHarness();
  h.setExternalDialogOpen(true);
  mount(h.window, h.document);
  h.emit(release());
  assert.equal(h.dialogs.length, 0);
  assert.ok(h.observer.options.attributeFilter.includes("open"));

  h.setExternalDialogOpen(false);
  h.mutate();
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0].open, true);
});

test("an inactive refresh clears a queued announcement before another dialog closes", () => {
  const h = makeHarness();
  h.setExternalDialogOpen(true);
  mount(h.window, h.document);
  h.emit(release());
  h.emit({active: false, version: "1.3", message: "Cancelled"});
  h.setExternalDialogOpen(false);
  h.mutate();
  assert.equal(h.dialogs.length, 0);
});

test("seen versions stay suppressed while a version bump opens and is stored", () => {
  const h = makeHarness({loader: "hidden", storedVersion: "1.3"});
  mount(h.window, h.document);
  h.emit(release("1.3"));
  assert.equal(h.dialogs.length, 0);
  h.emit(release("1.4", {title: "Another release"}));
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.storage.get("central-whats-new-seen-v1"), "1.4");
});

test("forced announcements show only once per page even when storage is blocked and data repeats", () => {
  const h = makeHarness({storageThrows: true});
  mount(h.window, h.document);
  const forced = release("preview", {force_every_time: "true"});
  h.emit(forced);
  assert.equal(h.dialogs.length, 1);
  h.dialogs[0].nativeClose();
  h.emit(forced);
  h.mutate();
  assert.equal(h.dialogs.length, 1);
});

test("the seen marker is written only after showModal succeeds", () => {
  const h = makeHarness({showFailures: 1});
  mount(h.window, h.document);
  h.emit(release());
  assert.equal(h.storageWrites.length, 0);
  assert.equal(h.dialogs[0].removed, true);

  h.mutate();
  assert.equal(h.dialogs.length, 1);
  h.emit(release());
  assert.equal(h.dialogs.length, 2);
  assert.equal(h.dialogs[1].open, true);
  assert.deepEqual(h.storageWrites, [["central-whats-new-seen-v1", "1.3"]]);
});

test("native close and backdrop dismissal clean scroll lock and restore navigation focus", () => {
  const h = makeHarness();
  mount(h.window, h.document);
  h.emit(release("1.3"));
  const first = h.dialogs[0];
  first.click({target: first, clientX: 250, clientY: 250});
  assert.equal(first.open, true);
  first.click({target: first, clientX: 50, clientY: 250});
  assert.equal(first.closeCalls, 1);
  assert.equal(first.removed, true);
  assert.equal(h.root.classList.contains("central-whats-new-open"), false);
  assert.deepEqual(h.navigationFocus.focusCalls, [{preventScroll: true}]);

  h.emit(release("1.4"));
  const second = h.dialogs[1];
  const closeButton = {closest(selector) { return selector === "[data-whats-new-close]" ? this : null; }};
  second.click({target: closeButton, clientX: 0, clientY: 0});
  assert.equal(second.closeCalls, 1);
  assert.equal(second.removed, true);
});

test("mount leaves non-production documents untouched", () => {
  const h = makeHarness({production: false});
  mount(h.window, h.document);
  h.emit(release());
  assert.equal(h.dialogs.length, 0);
  assert.equal(h.observer, undefined);
});
