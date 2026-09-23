import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";

import {buildSync} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

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
const {EventPreview} = previewModule.exports;

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
