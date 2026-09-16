import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/embed.js", import.meta.url), "utf8");

function hostFixture(type) {
  const rootAttrs = new Map(type === "groups" ? [["data-central-embed-type", "groups"]] : []);
  const root = {
    getAttribute: (name) => rootAttrs.get(name),
    setAttribute: (name, value) => rootAttrs.set(name, value),
    querySelector: () => null,
  };
  const attrs = new Map([["data-central-embed", "embed_labgroupslight"]]);
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
