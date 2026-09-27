import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/embed.js", import.meta.url), "utf8");

function hostFixture(type, staticPreview = false) {
  const rootAttrs = new Map(type === "groups" ? [["data-central-embed-type", "groups"]] : []);
  const root = {
    getAttribute: (name) => rootAttrs.get(name),
    setAttribute: (name, value) => rootAttrs.set(name, value),
    querySelector: () => null,
  };
  const attrs = new Map([["data-central-embed", "embed_labgroupslight"]]);
  if (staticPreview) attrs.set("data-central-embed-static-preview", "true");
  return {
    innerHTML: type === "groups" ? "Groups shell" : "Readable Event snapshot",
    getAttribute: (name) => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: (name) => attrs.delete(name),
    querySelector: (selector) => selector === ".central-embed-root" ||
      (type === "groups" && selector.includes('data-central-embed-type')) ? root : null,
  };
}

async function runLoader(host, fetch) {
  vm.runInNewContext(source, {
    URL, fetch,
    document: {
      currentScript: {src: "https://central.example/embed.js"},
      readyState: "complete",
      querySelector: () => ({}),
      querySelectorAll: () => [host],
    },
  });
  // Drain the fetch/text/import promise chain without timing assumptions.
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function classListFixture(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : !!force;
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
  };
}

function controlFixture() {
  const attrs = new Map();
  const listeners = new Map();
  return {
    attrs,
    classList: classListFixture(),
    disabled: false,
    hidden: false,
    textContent: "",
    addEventListener: (type, listener) => listeners.set(type, listener),
    click() {
      listeners.get("click")();
    },
    getAttribute: (name) => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, String(value)),
  };
}

function featuredDescriptionFixture({overflow = true, expandedHeight = 300} = {}) {
  const description = {
    id: "",
    classList: classListFixture(),
    after(button) {
      this.button = button;
    },
    get clientHeight() {
      return 100;
    },
    get scrollHeight() {
      return overflow && this.classList.contains("is-collapsed") ? 240 :
        (overflow ? expandedHeight : 100);
    },
  };
  return description;
}

function standardEmbedFixture({descriptionOverflow = true, gridToggle = true} = {}) {
  const description = featuredDescriptionFixture({overflow: descriptionOverflow});
  const gridButton = gridToggle ? controlFixture() : null;
  if (gridButton) gridButton.setAttribute("aria-expanded", "false");
  const root = {
    classList: classListFixture(),
    attrs: new Map([["data-central-embed-layout", "standard"]]),
    getAttribute(name) {
      return this.attrs.get(name);
    },
    setAttribute(name, value) {
      this.attrs.set(name, value);
    },
    querySelector(selector) {
      if (selector === "[data-central-embed-toggle]") return gridButton;
      if (selector === ".central-embed-grid") return grid;
      if (selector === ".central-embed-grid-viewport") return viewport;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".central-embed-event.is-featured .central-embed-description") {
        return [description];
      }
      return [];
    },
  };
  const featuredCard = {
    getBoundingClientRect() {
      return {top: 0, bottom: description.classList.contains("is-collapsed") ? 180 : 300};
    },
  };
  const laterCard = {
    getBoundingClientRect: () => ({top: 320, bottom: 440}),
  };
  const grid = {
    scrollHeight: 440,
    getBoundingClientRect: () => ({top: 0}),
    querySelectorAll: () => gridToggle ? [featuredCard, laterCard] : [featuredCard],
  };
  const viewport = {
    offsetHeight: 0,
    style: {height: "", transition: ""},
    getBoundingClientRect() {
      return {height: Number.parseInt(this.style.height, 10) || 180};
    },
  };
  const host = {
    attrs: new Map([
      ["data-central-embed", "embed_featured123"],
      ["data-central-embed-static-preview", "true"],
    ]),
    getAttribute(name) {
      return this.attrs.get(name);
    },
    setAttribute(name, value) {
      this.attrs.set(name, value);
    },
    removeAttribute(name) {
      this.attrs.delete(name);
    },
    querySelector: (selector) => selector === ".central-embed-root" ? root : null,
  };
  return {host, root, viewport, gridButton, description};
}

async function runFeaturedLoader(fixture) {
  let created = 0;
  const stylesheet = {addEventListener: () => {}};
  vm.runInNewContext(source, {
    URL,
    document: {
      currentScript: {src: "https://central.example/embed.js"},
      readyState: "complete",
      fonts: null,
      querySelector: (selector) =>
        selector === "link[data-central-embed-styles]" ? stylesheet : {},
      querySelectorAll: () => [fixture.host],
      getElementById: () => null,
      createElement: () => {
        created += 1;
        return controlFixture();
      },
    },
    window: {
      addEventListener: () => {},
      clearTimeout: () => {},
      requestAnimationFrame: (callback) => callback(),
      setTimeout: () => 0,
    },
    Array,
  });
  assert.equal(created, 1);
}

test("Groups configuration failure keeps a usable Church Center destination", async () => {
  const host = hostFixture("groups");
  await runLoader(host, async () => ({ok: false}));
  assert.match(host.innerHTML, /Groups are temporarily unavailable/);
  assert.match(host.innerHTML, /https:\/\/crosspointetv\.churchcenter\.com\/groups/);
  assert.doesNotMatch(host.innerHTML, /api\/embed/);
  assert.equal(host.getAttribute("aria-busy"), undefined);
});

test("Groups module failure replaces the whole shell with its fallback", async () => {
  const host = hostFixture("groups");
  // Dynamic imports cannot load in this VM. This exercises the loader rejection
  // path used by a network/module failure after published HTML is received.
  await runLoader(host, async () => ({ok: true, text: async () => "Fresh Groups shell"}));
  assert.match(host.innerHTML, /Browse groups in Church Center/);
  assert.equal(host.getAttribute("aria-busy"), undefined);
});

test("Event refresh failure preserves the readable copied snapshot", async () => {
  const host = hostFixture("events");
  await runLoader(host, async () => ({ok: false}));
  assert.equal(host.innerHTML, "Readable Event snapshot");
  assert.equal(host.getAttribute("aria-busy"), undefined);
});

test("static draft previews enhance their snapshot without fetching published data", async () => {
  const host = hostFixture("events", true);
  let fetchCalls = 0;
  await runLoader(host, async () => {
    fetchCalls += 1;
    throw new Error("A draft preview must not fetch.");
  });
  assert.equal(fetchCalls, 0);
  assert.equal(host.getAttribute("data-central-embed-static"), "true");
  assert.equal(host.getAttribute("data-central-embed-loaded"), "true");
});

test("a single featured description can disclose without the grid See More control", async () => {
  const fixture = standardEmbedFixture({gridToggle: false});
  await runFeaturedLoader(fixture);

  assert.equal(fixture.description.classList.contains("is-collapsed"), true);
  assert.equal(fixture.description.button.hidden, false);
  fixture.description.button.click();
  assert.equal(fixture.description.classList.contains("is-collapsed"), false);
  assert.equal(fixture.description.button.getAttribute("aria-expanded"), "true");
  assert.equal(fixture.description.button.textContent, "Read less");
});

test("a featured description that fits does not expose a disclosure control", async () => {
  const fixture = standardEmbedFixture({descriptionOverflow: false, gridToggle: false});
  await runFeaturedLoader(fixture);

  assert.equal(fixture.description.classList.contains("is-collapsed"), false);
  assert.equal(fixture.description.button.hidden, true);
});

test("featured disclosure recalculates the collapsed grid viewport height", async () => {
  const fixture = standardEmbedFixture();
  await runFeaturedLoader(fixture);

  assert.equal(fixture.root.classList.contains("central-embed-is-collapsed"), true);
  assert.equal(fixture.viewport.style.height, "180px");
  fixture.description.button.click();
  assert.equal(fixture.root.classList.contains("central-embed-is-collapsed"), true);
  assert.equal(fixture.viewport.style.height, "300px");
});

test("featured disclosure updates the viewport during a grid height transition", async () => {
  const fixture = standardEmbedFixture();
  await runFeaturedLoader(fixture);
  fixture.gridButton.disabled = true;

  fixture.description.button.click();
  assert.equal(fixture.viewport.style.height, "300px");
});
