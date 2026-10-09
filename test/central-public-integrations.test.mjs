import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const core = require("../public/central-public-integrations.js");
const bootSource = readFileSync(
    new URL("../public/central-public-boot.js", import.meta.url),
    "utf8",
);
const integrationsCss = readFileSync(
    new URL("../public/central-public-integrations.css", import.meta.url),
    "utf8",
);

test("public Firebase boot preserves the compat SDK order and analytics contract", async () => {
  const loaded = [];
  let analyticsInitializations = 0;
  const document = {
    documentElement: {setAttribute(name, value) { this[name] = value; }},
    createElement() { return {}; },
    head: {appendChild(script) {
      loaded.push(script.src);
      queueMicrotask(() => script.onload());
    }},
  };
  const window = {
    location: {hostname: "central.crosspointe.tv"},
    firebase: {analytics() { analyticsInitializations++; return {logEvent() {}}; }},
  };
  vm.runInNewContext(bootSource, {window, document, console, Promise});
  await window.CENTRAL_FIREBASE_AUTH_READY;

  assert.deepEqual(loaded, [
    "/__/firebase/11.10.0/firebase-app-compat.js",
    "/__/firebase/11.10.0/firebase-auth-compat.js",
    "/__/firebase/11.10.0/firebase-messaging-compat.js",
    "/__/firebase/11.10.0/firebase-firestore-compat.js",
    "/__/firebase/11.10.0/firebase-analytics-compat.js",
    "/__/firebase/init.js",
  ]);
  assert.equal(window.CENTRAL_BOOT_MODE, "public");
  assert.equal(window.CENTRAL_ANALYTICS_READY, true);
  assert.equal(analyticsInitializations, 1);
});

test("local Firebase boot omits Analytics while keeping messaging and Firestore", async () => {
  const loaded = [];
  const document = {
    documentElement: {setAttribute() {}},
    createElement() { return {}; },
    head: {appendChild(script) {
      loaded.push(script.src);
      queueMicrotask(() => script.onload());
    }},
  };
  const window = {location: {hostname: "127.0.0.1"}, firebase: {}};
  vm.runInNewContext(bootSource, {window, document, console, Promise});
  await window.CENTRAL_FIREBASE_AUTH_READY;
  assert.equal(loaded.some((src) => src.includes("firebase-analytics")), false);
  assert.equal(loaded.some((src) => src.includes("firebase-messaging")), true);
  assert.equal(loaded.some((src) => src.includes("firebase-firestore")), true);
  assert.equal(window.CENTRAL_ANALYTICS_READY, false);
});

test("workspace links preserve legacy permission fallbacks and staff Admin access", () => {
  assert.deepEqual(core.getWorkspaceDestinations_(
      {email: "alex@crosspointe.tv"},
      {active: true, pageAccess: {settings: "view"}},
  ), [
    {href: "/admin", label: "Admin"},
    {href: "/studio", label: "Studio"},
    {href: "/planner", label: "Planner"},
    {href: "/annual-planner", label: "Annual Planner"},
  ]);
  assert.deepEqual(core.getWorkspaceDestinations_(
      {email: "volunteer@example.com"},
      {active: true, pageAccess: {studio: "edit", planner: "none"}},
  ), [{href: "/studio", label: "Studio"}]);
  assert.deepEqual(core.getWorkspaceDestinations_(
      {email: "alex@crosspointe.tv"},
      {active: false, pageAccess: {settings: "admin"}},
  ), []);
});

test("workspace dismissal restores focus only for an explicit keyboard close", () => {
  const state = {classes: new Set(), focused: false};
  const button = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { state.focused = true; },
  };
  const panel = {hidden: true};
  const navigation = {
    classList: {toggle(name, enabled) {
      if (enabled) state.classes.add(name); else state.classes.delete(name);
    }},
    querySelector(selector) {
      return selector === "button" ? button : panel;
    },
  };
  core.applyWorkspaceOpenState_(navigation, true, false);
  assert.equal(panel.hidden, false);
  assert.equal(button.attributes["aria-expanded"], "true");
  core.applyWorkspaceOpenState_(navigation, false, true);
  assert.equal(panel.hidden, true);
  assert.equal(button.attributes["aria-expanded"], "false");
  assert.equal(state.focused, true);
});

test("workspace control stacks above push while mobile leaves Wayfinder a lane", () => {
  assert.equal(core.getPushPromptOffset_(0), 0);
  assert.equal(core.getPushPromptOffset_(147.2), 160);
  assert.match(integrationsCss, /central-app-navigation[^}]*central-push-prompt-offset/s);
  assert.match(integrationsCss, /central-push-prompt\s*\{[^}]*right:\s*max\(88px/s);
});

test("Wayfinder event mapping keeps copy and rejects unsafe registration URLs", () => {
  assert.deepEqual(core.normalizeWayfinderEvent_({
    title: "Worship Night",
    date: "Jul 27",
    time: "6:30 PM",
    venue: "The Pointe",
    description: "Come worship with us.",
    registrationUrl: "https://crosspointetv.churchcenter.com/registrations/1",
    registrationLabel: "Sign Up",
  }), {
    title: "Worship Night",
    date: "Jul 27",
    time: "6:30 PM",
    location: "The Pointe",
    description: "Come worship with us.",
    registrationUrl: "https://crosspointetv.churchcenter.com/registrations/1",
    registrationLabel: "Sign Up",
  });
  assert.equal(core.normalizeWayfinderEvent_({
    registrationUrl: "javascript:alert(1)",
  }).registrationUrl, "");
  assert.equal(core.normalizeWayfinderEvent_({title: "No signup"}).registrationUrl, "");
});

test("livestream presence accepts only exact active stream data and confirmed playback", () => {
  const streamUrl = "https://control.resi.io/webplayer/video.html?id=central";
  assert.deepEqual(core.validatePresencePayload_({
    available: true,
    streamKey: "stream-one",
    streamUrl,
    count: 12,
  }, streamUrl), {streamKey: "stream-one", streamUrl, count: 12});
  assert.equal(core.validatePresencePayload_({
    available: true,
    streamKey: "stream-two",
    streamUrl: "https://control.resi.io/webplayer/video.html?id=other",
    count: 99,
  }, streamUrl), null);
  assert.equal(core.validatePresencePayload_({
    available: true, streamKey: "stream-one", streamUrl, count: "12",
  }, streamUrl), null);
  assert.equal(core.playbackState_({paused: false}), true);
  assert.equal(core.playbackState_({playing: false}), false);
  assert.equal(core.playbackState_({status: "playing"}), null);
  assert.equal(core.startsPresenceForPhase_("opened"), true);
  assert.equal(core.startsPresenceForPhase_("restored"), true);
  assert.equal(core.startsPresenceForPhase_("playback"), false);
  assert.equal(core.formatPresenceCount_(1000), "1K");
});
