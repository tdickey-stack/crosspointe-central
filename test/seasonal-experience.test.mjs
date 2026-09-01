import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
    new URL("../public/seasonal-experience.js", import.meta.url),
    "utf8",
);

const baseConfig = Object.freeze({
  id: "christmas-at-the-movies",
  previewEnabled: true,
  previewDefaultOn: false,
  productionEnabled: false,
  productionStartsAt: "",
  productionEndsAt: "",
});

function loadExperience({
  hostname = "localhost",
  pathname = "/",
  search = "",
  storedMode = "",
  config = baseConfig,
} = {}) {
  const attributes = new Map();
  const storage = new Map();
  let reloadCount = 0;
  if (storedMode) storage.set("central-christmas-movies-2026-mode", storedMode);

  const location = {
    hostname,
    pathname,
    search,
    hash: "",
    reload() {
      reloadCount += 1;
    },
  };
  const window = {
    CENTRAL_SEASONAL_EXPERIENCE_CONFIG: config,
    location,
    history: {
      replaceState(_state, _title, nextUrl) {
        const url = new URL(nextUrl, "https://" + hostname);
        location.pathname = url.pathname;
        location.search = url.search;
        location.hash = url.hash;
      },
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    document: {
      documentElement: {
        setAttribute(name, value) {
          attributes.set(name, String(value));
        },
        removeAttribute(name) {
          attributes.delete(name);
        },
      },
    },
  };

  vm.runInNewContext(source, {window, URLSearchParams}, {
    filename: "seasonal-experience.js",
  });

  return {
    api: window.CentralSeasonalExperience,
    attributes,
    location,
    storage,
    getReloadCount: () => reloadCount,
  };
}

test("local preview is available but defaults to normal Central", () => {
  const experience = loadExperience();
  const state = experience.api.getState();

  assert.equal(state.environment, "preview");
  assert.equal(state.available, true);
  assert.equal(state.active, false);
  assert.equal(experience.attributes.has("data-seasonal-experience"), false);
});

test("preview query can activate Christmas At The Movies", () => {
  const experience = loadExperience({
    hostname: "crosspointe-central--dev-preview.web.app",
    search: "?seasonalPreview=christmas-at-the-movies",
  });

  assert.equal(experience.api.isActive(), true);
  assert.equal(
      experience.attributes.get("data-seasonal-experience"),
      "christmas-at-the-movies",
  );
});

test("normal-mode toggle clears a seasonal preview query before reload", () => {
  const experience = loadExperience({
    search: "?seasonalPreview=on&keep=this",
  });

  assert.equal(experience.api.isActive(), true);
  assert.equal(experience.api.toggle(true), true);
  assert.equal(experience.api.isActive(), false);
  assert.equal(experience.storage.get(experience.api.storageKey), "normal");
  assert.equal(experience.location.search, "?keep=this");
  assert.equal(experience.getReloadCount(), 1);
});

test("production stays off when the production gate is disabled", () => {
  const experience = loadExperience({
    hostname: "central.crosspointe.tv",
    search: "?seasonalPreview=on",
    storedMode: "seasonal",
  });

  assert.deepEqual(
      {
        available: experience.api.isAvailable(),
        active: experience.api.isActive(),
      },
      {available: false, active: false},
  );
  assert.equal(experience.api.setMode("seasonal", false), false);
});

test("unknown hosts and non-public routes cannot activate the experience", () => {
  const unknown = loadExperience({
    hostname: "example.com",
    search: "?seasonalPreview=on",
    storedMode: "seasonal",
  });
  const admin = loadExperience({
    hostname: "localhost",
    pathname: "/admin",
    search: "?seasonalPreview=on",
  });

  assert.equal(unknown.api.isActive(), false);
  assert.equal(unknown.api.isAvailable(), false);
  assert.equal(admin.api.isActive(), false);
  assert.equal(admin.api.getState().environment, "excluded");
});

test("production window supports normal opt-out and seasonal opt-back-in", () => {
  const experience = loadExperience({
    hostname: "central.crosspointe.tv",
    config: {
      ...baseConfig,
      productionEnabled: true,
      productionStartsAt: "2020-01-01T00:00:00.000Z",
      productionEndsAt: "2099-01-01T00:00:00.000Z",
    },
  });

  assert.equal(experience.api.isActive(), true);
  assert.equal(experience.api.setMode("normal", false), true);
  assert.equal(experience.api.isActive(), false);
  assert.equal(
      experience.storage.get("central-christmas-movies-2026-mode"),
      "normal",
  );

  assert.equal(experience.api.setMode("seasonal", false), true);
  assert.equal(experience.api.isActive(), true);
  assert.equal(
      experience.storage.has("central-christmas-movies-2026-mode"),
      false,
  );
  assert.equal(experience.getReloadCount(), 0);
});
