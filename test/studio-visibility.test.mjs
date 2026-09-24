import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";

import {buildSync} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createDocumentPage} from "../src/studio/templates.js";

const require = createRequire(import.meta.url);

// Preview modules are JSX and are normally bundled for the browser. Bundle this
// one module in-process so this test verifies the markup Studio actually renders.
const previewBundle = buildSync({
  entryPoints: ["src/studio/previews.jsx"],
  bundle: true,
  format: "cjs",
  platform: "node",
  external: ["react"],
  write: false,
});
const previewModule = {exports: {}};
new Function("require", "module", "exports", previewBundle.outputFiles[0].text)(
  require,
  previewModule,
  previewModule.exports,
);
const {DocumentPagePreview, EventPreview, documentPageHasOverflow} =
  previewModule.exports;

const visibleContent = {
  eyebrow: "A PLACE TO CONNECT",
  eyebrowVisible: true,
  title: "Community Night",
  subtitle: "Come as you are. Leave knowing someone new.",
  subtitleVisible: true,
  date: "SEPTEMBER 18",
  time: "6:30 PM",
  location: "CROSSPOINTE CHURCH",
  cta: "DETAILS AT CENTRAL.CROSSPOINTE.TV",
  format: "square",
  composition: "editorial",
  palette: "charcoal-red",
  flatColor: "charcoal",
  overlayColor: "red",
  overlayBlendMode: "multiply",
  fontKey: "montserrat",
  fontWeight: "template",
  brandMark: "central",
  brandColor: "auto",
  imagePosition: "center",
  focalX: 50,
  focalY: 50,
  imageZoom: 1,
  backgroundImageOpacity: 1,
  backgroundImage: "",
  textAlignment: "left",
  heroMode: "text",
};

function renderPreview(content, editorMode) {
  return renderToStaticMarkup(
    React.createElement(EventPreview, {
      content,
      editorMode,
      templateId: "event-signal-stack",
    }),
  );
}

test("hidden optional fields leave the editor canvas and export while preserving saved copy", () => {
  const hiddenContent = {
    ...visibleContent,
    eyebrowVisible: false,
    subtitleVisible: false,
  };

  const editorMarkup = renderPreview(hiddenContent, true);
  const exportMarkup = renderPreview(hiddenContent, false);

  assert.equal(hiddenContent.eyebrow, visibleContent.eyebrow);
  assert.equal(hiddenContent.subtitle, visibleContent.subtitle);
  assert.doesNotMatch(editorMarkup, /A PLACE TO CONNECT/u);
  assert.doesNotMatch(editorMarkup, /Come as you are\. Leave knowing someone new\./u);
  assert.doesNotMatch(exportMarkup, /A PLACE TO CONNECT/u);
  assert.doesNotMatch(exportMarkup, /Come as you are\. Leave knowing someone new\./u);
});

test("restoring optional fields displays their unchanged saved text and editor Hide buttons", () => {
  const restoredContent = {
    ...visibleContent,
    eyebrowVisible: true,
    subtitleVisible: true,
  };
  const editorMarkup = renderPreview(restoredContent, true);

  assert.match(editorMarkup, /A PLACE TO CONNECT/u);
  assert.match(editorMarkup, /Come as you are\. Leave knowing someone new\./u);
  assert.match(editorMarkup, /aria-label="Hide Utility label"/u);
  assert.match(editorMarkup, /aria-label="Hide Supporting line"/u);
  assert.equal(restoredContent.eyebrow, visibleContent.eyebrow);
  assert.equal(restoredContent.subtitle, visibleContent.subtitle);
});

test("export previews contain visible optional copy but never editor controls", () => {
  const exportMarkup = renderPreview(visibleContent, false);

  assert.match(exportMarkup, /A PLACE TO CONNECT/u);
  assert.match(exportMarkup, /Come as you are\. Leave knowing someone new\./u);
  assert.doesNotMatch(exportMarkup, /event-field-visibility-toggle/u);
  assert.doesNotMatch(exportMarkup, /aria-label="(?:Hide|Show) (?:Utility label|Supporting line)"/u);
});

test("document overflow checks meaningful content regions without treating directory card clamps as errors", () => {
  const overflowingBlocks = {
    clientHeight: 100,
    scrollHeight: 130,
    clientWidth: 100,
    scrollWidth: 100,
  };
  const root = {
    clientHeight: 200,
    scrollHeight: 200,
    clientWidth: 150,
    scrollWidth: 150,
    querySelectorAll(selector) {
      return selector === ".content-page-blocks" ? [overflowingBlocks] : [];
    },
  };
  assert.equal(documentPageHasOverflow(root, "document-content-page"), true);

  const intentionallyClampedCard = {
    clientHeight: 50,
    scrollHeight: 90,
    clientWidth: 50,
    scrollWidth: 50,
  };
  root.querySelectorAll = (selector) =>
    selector === ".directory-card-copy" ? [intentionallyClampedCard] : [];
  assert.equal(documentPageHasOverflow(root, "document-directory"), false);
});

test("one-pager cards ignore padding-only scroll metrics", () => {
  const paddedCard = {
    clientHeight: 108,
    scrollHeight: 125,
    clientWidth: 200,
    scrollWidth: 200,
  };
  const root = {
    clientHeight: 660,
    scrollHeight: 660,
    clientWidth: 510,
    scrollWidth: 510,
    querySelectorAll(selector) {
      if ([".policy-list-card", ".policy-owner-card"].includes(selector)) {
        return [paddedCard];
      }
      return [];
    },
  };

  assert.equal(documentPageHasOverflow(root, "document-one-pager"), false);
});

test("every default document page reaches its distinct SSR renderer", () => {
  const expectedClasses = {
    "document-one-pager": "studio-policy-document",
    "document-checklist": "studio-checklist-document",
    "document-signup-sheet": "studio-signup-document",
    "document-directory": "studio-directory-document",
    "document-content-page": "studio-content-document",
  };

  Object.entries(expectedClasses).forEach(([templateId, className]) => {
    const markup = renderToStaticMarkup(
      React.createElement(DocumentPagePreview, {
        page: createDocumentPage(templateId),
        pageNumber: 1,
        pageCount: 1,
      }),
    );
    assert.match(markup, new RegExp(`class="${className}"`, "u"), templateId);
    assert.doesNotMatch(markup, /data-studio-layout-error/u, templateId);
  });
});
