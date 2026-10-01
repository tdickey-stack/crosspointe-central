import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
    new URL("../public/print-mode-qr.js", import.meta.url),
    "utf8",
);

class CountingMap extends Map {
  static instances = [];

  constructor(...args) {
    super(...args);
    this.setCalls = 0;
    CountingMap.instances.push(this);
  }

  set(key, value) {
    this.setCalls += 1;
    return super.set(key, value);
  }
}

function loadHelper({countCache = false} = {}) {
  if (countCache) CountingMap.instances.length = 0;
  const sandbox = {
    Map: countCache ? CountingMap : Map,
    Number,
    Object,
    String,
    URL,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {filename: "print-mode-qr.js"});
  return {sandbox, cache: countCache ? CountingMap.instances.at(-1) : null};
}

function stubFactory(sandbox, {throwOnMake = false} = {}) {
  const calls = [];
  sandbox.qrcode = (typeNumber, errorCorrectionLevel) => {
    const call = {typeNumber, errorCorrectionLevel, data: "", mode: ""};
    calls.push(call);
    return {
      addData(value, mode) {
        call.data = value;
        call.mode = mode;
      },
      make() {
        if (throwOnMake) throw new Error("generation failed");
      },
      getModuleCount: () => 21,
      isDark: (row, column) => row === 0 && column < 7,
    };
  };
  return calls;
}

test("classic script exposes one synchronous SVG renderer", () => {
  const {sandbox} = loadHelper();
  assert.equal(typeof sandbox.PrintModeQr.renderSvg, "function");
  const result = sandbox.PrintModeQr.renderSvg("https://crosspointe.tv/events/starting-pointe");
  const rootTag = result.slice(0, result.indexOf(">") + 1);
  assert.match(result, /^<svg[\s\S]*<\/svg>$/);
  assert.doesNotMatch(rootTag, /\b(?:width|height)=\"[^\"]+\"/);
  assert.match(result, /viewBox=\"0 0 \d+ \d+\"/);
  assert.match(result, /role=\"img\"/);
  assert.match(result, /aria-label=\"QR code for this event link\"/);
  assert.match(result, /shape-rendering=\"crispEdges\"/);
  assert.match(result, /fill=\"#fff\"/);
  assert.match(result, /fill=\"#000\"/);
});

test("encodes the exact normalized credential-free HTTPS URL at error correction M", () => {
  const {sandbox} = loadHelper();
  const calls = stubFactory(sandbox);
  const input = "  HTTPS://Exämple.org:443/a path/?message=Join+us&note=\"quoted\"&name=José#mañana  ";
  const expected = new URL(input.trim()).href;
  const result = sandbox.PrintModeQr.renderSvg(input);
  assert.match(result, /^<svg/);
  assert.deepEqual(calls.map(({typeNumber, errorCorrectionLevel, data, mode}) => ({
    typeNumber,
    errorCorrectionLevel,
    data,
    mode,
  })), [{
    typeNumber: 0,
    errorCorrectionLevel: "M",
    data: expected,
    mode: "Byte",
  }]);
  assert.equal(result.includes("quoted"), false, "URL data must not leak into SVG markup");
  assert.equal(result.includes("José"), false, "Unicode URL data must not leak into SVG markup");
});

test("rejects invalid, non-HTTPS, relative, and credential-bearing URLs", () => {
  const {sandbox} = loadHelper();
  for (const value of [
    "",
    "not a url",
    "/events/123",
    "http://crosspointe.tv/events/123",
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://editor:secret@crosspointe.tv/events/123",
    "https://editor@crosspointe.tv/events/123",
  ]) {
    assert.equal(sandbox.PrintModeQr.renderSvg(value), "", value);
  }
});

test("renders an exact four-module quiet zone without fixed CSS dimensions", () => {
  const {sandbox} = loadHelper();
  stubFactory(sandbox);
  const svg = sandbox.PrintModeQr.renderSvg("https://crosspointe.tv/events/quiet-zone");
  assert.match(svg, /viewBox=\"0 0 29 29\"/);
  assert.match(svg, /<path d=\"M4 4h7v1H4z\" fill=\"#000\"\/>/);
  assert.doesNotMatch(svg, /<path[^>]+(?:M[0-3] | [0-3]h)/);
});

test("caches repeated normalized URLs and bounds the cache", () => {
  const {sandbox, cache} = loadHelper({countCache: true});
  const originalFactory = sandbox.qrcode;
  let generationCount = 0;
  sandbox.qrcode = (...args) => {
    generationCount += 1;
    return originalFactory(...args);
  };

  const first = sandbox.PrintModeQr.renderSvg("https://crosspointe.tv/events/cache");
  const repeat = sandbox.PrintModeQr.renderSvg(" HTTPS://crosspointe.tv:443/events/cache ");
  assert.equal(repeat, first);
  assert.equal(generationCount, 1);
  assert.equal(cache.setCalls, 1);

  for (let index = 0; index < 70; index += 1) {
    assert.match(
        sandbox.PrintModeQr.renderSvg(`https://crosspointe.tv/events/${index}`),
        /^<svg/,
    );
  }
  assert.equal(cache.size, 64);
});

test("returns an empty string when the encoder is unavailable or generation fails", () => {
  const missing = loadHelper().sandbox;
  missing.qrcode = null;
  assert.equal(missing.PrintModeQr.renderSvg("https://crosspointe.tv/events/missing"), "");

  const failed = loadHelper().sandbox;
  stubFactory(failed, {throwOnMake: true});
  assert.equal(failed.PrintModeQr.renderSvg("https://crosspointe.tv/events/failure"), "");
});
