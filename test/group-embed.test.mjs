import assert from "node:assert/strict";
import test from "node:test";
import {followGroupEmbedTheme} from "../public/group-embed.js";

function preference(initial) {
  const listeners = new Set();
  return {
    matches: initial,
    addEventListener(type, listener) {
      assert.equal(type, "change");
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, "change");
      listeners.delete(listener);
    },
    change(dark) {
      this.matches = dark;
      listeners.forEach((listener) => listener());
    },
    get listenerCount() { return listeners.size; },
  };
}

test("responsive theme follows preference changes and releases its listener", () => {
  const media = preference(false);
  const root = {dataset: {}};
  const stop = followGroupEmbedTheme(root, "responsive", media);
  assert.equal(root.dataset.theme, "light");
  media.change(true);
  assert.equal(root.dataset.theme, "dark");
  media.change(false);
  assert.equal(root.dataset.theme, "light");
  stop();
  assert.equal(media.listenerCount, 0);
  media.change(true);
  assert.equal(root.dataset.theme, "light");
});

test("fixed light and dark embeds keep independent themes on the same host", () => {
  const media = preference(true);
  const light = {dataset: {}};
  const dark = {dataset: {}};
  const responsive = {dataset: {}};
  followGroupEmbedTheme(light, "light", media);
  followGroupEmbedTheme(dark, "dark", media);
  const stop = followGroupEmbedTheme(responsive, "responsive", media);
  assert.equal(light.dataset.theme, "light");
  assert.equal(dark.dataset.theme, "dark");
  assert.equal(responsive.dataset.theme, "dark");
  media.change(false);
  assert.equal(light.dataset.theme, "light");
  assert.equal(dark.dataset.theme, "dark");
  assert.equal(responsive.dataset.theme, "light");
  stop();
});

test("importing the shared directory never initializes the host website", async () => {
  globalThis.document = {
    querySelectorAll() { throw new Error("The host document must not be scanned."); },
  };
  try {
    await import("../public/group-directory.js?host-isolation-test");
  } finally {
    delete globalThis.document;
  }
});
