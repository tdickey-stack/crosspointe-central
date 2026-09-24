import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStudioLayoutReady,
  canvasToPngBlob,
  openDocumentSystemPrint,
  waitForDocumentImages,
  waitForFonts,
  waitForImageElement,
  waitForLayoutFrame,
  waitForPromiseWithTimeout,
} from "../src/studio/export.js";
import {createStudioExportLoader} from "../src/studio/export-loader.js";

function pendingImage() {
  const listeners = new Map();
  return {
    complete: false,
    naturalWidth: 0,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
}

test("export resources reject with a bounded timeout", async () => {
  await assert.rejects(
    waitForPromiseWithTimeout(new Promise(() => {}), 5, "resource timeout"),
    /resource timeout/u,
  );
  await assert.rejects(
    waitForImageElement(pendingImage(), {timeoutMs: 5}),
    /still loading/u,
  );
});

test("export layout frames and PNG encoding reject with bounded timeouts", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {requestAnimationFrame() {}};

  try {
    await assert.rejects(
      waitForLayoutFrame(5),
      /timed out while applying an export image/u,
    );
  } finally {
    globalThis.window = originalWindow;
  }

  await assert.rejects(
    canvasToPngBlob({toBlob() {}}, 5),
    /timed out while creating the exported PNG/u,
  );
});

test("export loader explains a stale chunk and retries after failure", async () => {
  const expectedModule = {exportEventPng() {}};
  let attempts = 0;
  const loadStudioExports = createStudioExportLoader(async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("Failed to fetch dynamically imported module");
    return expectedModule;
  });

  await assert.rejects(
    loadStudioExports(),
    /Reload Studio and try the export again/u,
  );
  assert.equal(await loadStudioExports(), expectedModule);
  assert.equal(attempts, 2);
  assert.equal(await loadStudioExports(), expectedModule);
  assert.equal(attempts, 2);
});

test("font readiness retries a failed startup stylesheet request", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let resolveRetry;
  let reloads = 0;
  globalThis.window = {
    CENTRAL_STUDIO_FONT_CSS_ERROR: new Error("startup offline"),
    CENTRAL_STUDIO_FONT_CSS_READY: Promise.resolve(),
    CENTRAL_STUDIO_RELOAD_FONT_CSS() {
      reloads += 1;
      this.CENTRAL_STUDIO_FONT_CSS_ERROR = null;
      this.CENTRAL_STUDIO_FONT_CSS_READY = new Promise((resolve) => {
        resolveRetry = resolve;
      });
      return this.CENTRAL_STUDIO_FONT_CSS_READY;
    },
  };
  globalThis.document = {fonts: {ready: Promise.resolve()}};

  try {
    let finished = false;
    const ready = waitForFonts().then(() => {
      finished = true;
    });
    await Promise.resolve();
    assert.equal(reloads, 1);
    assert.equal(finished, false);
    resolveRetry();
    await ready;
    assert.equal(finished, true);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("System Print rejects an image that already completed with an error", async () => {
  await assert.rejects(
    waitForDocumentImages({
      images: [{complete: true, naturalWidth: 0}],
    }),
    /could not be prepared for printing/u,
  );
});

test("export layout validation checks the root and its descendants", () => {
  const descendant = {
    dataset: {studioLayoutError: "Shorten this page before exporting."},
  };
  const rootError = {
    dataset: {studioLayoutError: "This document page is too full."},
    querySelector() {
      return null;
    },
  };
  const descendantError = {
    dataset: {},
    querySelector() {
      return descendant;
    },
  };

  assert.throws(() => assertStudioLayoutReady(rootError), /too full/u);
  assert.throws(
    () => assertStudioLayoutReady(descendantError),
    /Shorten this page/u,
  );

  const booleanMarker = {
    dataset: {studioLayoutError: "true"},
    querySelector() {
      return null;
    },
  };
  assert.throws(
    () => assertStudioLayoutReady(booleanMarker),
    /Page content exceeds the printable area/u,
  );
});

test("System Print closes a pre-opened window when preparation cannot start", async () => {
  let closed = false;
  const printWindow = {
    close() {
      closed = true;
    },
  };

  await assert.rejects(
    openDocumentSystemPrint({}, null, {printWindow}),
    /pages are not available/u,
  );
  assert.equal(closed, true);
});
