import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
function setup({enabled = true, url = "https://control.resi.io/webplayer/video.html?id=central"} = {}) {
  const requests = [];
  const intervals = new Map();
  const timeouts = new Map();
  const listeners = new Map();
  let timer = 0;
  let session = 0;
  const bridgeMessages = [];
  const iframe = {
    src: url, isConnected: true, contentWindow: {postMessage(message) { bridgeMessages.push(message); }},
    getAttribute() { return this.src; }, setAttribute(key, value) { this.src = value; },
    addEventListener() {}, removeEventListener() {},
  };
  const badges = [0, 1].map(() => ({hidden: true, count: {textContent: ""},
    setAttribute(key, value) { this[key] = value; }, querySelector() { return this.count; }}));
  const window = {
    location: {href: "https://central.crosspointe.tv", origin: "https://central.crosspointe.tv"},
    crypto: {getRandomValues(values) { values.fill(++session); }},
    setInterval(fn, delay) { const id = ++timer; intervals.set(id, {fn, delay}); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(fn, delay) { const id = ++timer; timeouts.set(id, {fn, delay}); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    cancelAnimationFrame() {},
  };
  const context = vm.createContext({URL, Uint8Array, AbortController, window,
    currentCentralData: {sundayMode: {enabled}, sundaySettings: {sunday_livestream_url: url}},
    sundayStreamPlaybackIframe: iframe, sundayStreamPlaybackOrigin: "https://control.resi.io",
    sundayStreamPlaybackSuppressed: false, sundayStreamPlaybackResetUrl: "", sundayStreamPlaybackClosePending: false, sundayStreamPlaybackConfirmedPaused: null,
    sundayStreamPlaybackConnected: false, sundayStreamPlaybackStateKnown: false,
    sundayStreamPlaybackPaused: false, sundayStreamPlaybackConnectTimer: 0,
    sundayStreamPlaybackConnectAttempts: 0, SUNDAY_STREAM_PLAYER_CONNECT_MAX_ATTEMPTS: 4,
    sundayStreamPresence: null, sundayStreamReturnAnimationFrame: 0,
    sundayStreamMiniPlayerEnabled: false, cancelSundayStreamPlayerAnimation_() {},
    syncSundayStreamMiniPlayer_() {},
    document: {querySelectorAll() { return badges; }, querySelector(selector) {
      return selector === ".sunday-stream-player iframe" ? iframe : null;
    }},
    fetch(url, options = {}) {
      return new Promise((resolve, reject) => requests.push({url, options, resolve, reject}));
    },
  });
  const names = [...source.matchAll(/^function (\w*SundayStreamPresence\w*|renderSundayStreamPresenceBadge_|isSundayModeActive_)\(/gm)].map(m => m[1]);
  names.push("handleSundayStreamPlaybackMessage_", "applySundayStreamPlaybackSnapshot_",
      "toggleSundayStreamPlayback", "updateSundayStreamPlaybackButton_", "closeSundayStreamMiniPlayer",
      "handleSundayStreamPlaybackIframeLoad_", "getSundayStreamPlaybackOrigin_", "sendSundayStreamPlaybackConnect_",
      "teardownSundayStreamPlaybackControl_", "requestSundayStreamClosePause_");
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf("\nfunction ", start + 1);
    vm.runInContext(source.slice(start, end), context);
  }
  const posts = () => requests.filter(r => r.options.method === "POST");
  const message = (value, extra = {}) => context.handleSundayStreamPlaybackMessage_({
    source: iframe.contentWindow, origin: "https://control.resi.io", data: {name: "init-state", value}, ...extra,
  });
  const answer = async (request, data, ok = true) => {
    request.resolve({ok, json: async () => data});
    await flush();
  };
  const available = async (count = 7) => answer(requests.filter(r => !r.options.method).at(-1),
      {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "stream-one", count, updatedAt: new Date().toISOString()});
  context.initSundayStreamPresence_();
  return {context, iframe, bridgeMessages, badges, requests, intervals, timeouts, posts, message, answer, available};
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
const body = request => JSON.parse(request.options.body);

test("waits for authoritative playback, ignores spoofed messages and optimistic play", async () => {
  const e = setup();
  await e.available();
  assert.equal(e.posts().length, 0);
  for (const extra of [{source: {}}, {origin: "https://other.example"}]) e.message({playing: true}, extra);
  assert.equal(e.posts().length, 0);
  e.message({paused: true});
  e.context.toggleSundayStreamPlayback();
  assert.equal(e.posts().length, 0, "optimistic play is not presence evidence");
  e.message({playing: true});
  assert.equal(e.posts().length, 1);
  assert.equal(body(e.posts()[0]).active, true);
  assert.equal(e.badges[0].count.textContent, e.badges[1].count.textContent);
});

test("confirmed playback before availability starts only once the configured stream is known", async () => {
  const e = setup();
  e.message({paused: false});
  assert.equal(e.posts().length, 0);
  await e.available(0);
  assert.equal(e.posts().length, 1);
  assert.equal(e.badges[0].hidden, false);
  assert.equal(e.badges[0].count.textContent, "0");
});

test("pause stops immediately; only confirmed resume restarts heartbeats", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.toggleSundayStreamPlayback();
  assert.equal(body(e.posts().at(-1)).active, false);
  assert.equal(e.posts().at(-1).options.keepalive, true);
  const heartbeat = [...e.intervals.values()].find(v => v.delay === 20000);
  heartbeat.fn();
  assert.equal(e.posts().length, 2);
  e.context.toggleSundayStreamPlayback();
  heartbeat.fn();
  assert.equal(e.posts().length, 2);
  e.message({paused: false}); heartbeat.fn();
  assert.deepEqual(e.posts().map(r => body(r).active), [true, false, true, true]);
  assert.deepEqual(e.posts().map(r => body(r).sequence), [1, 2, 3, 4]);
  e.message({paused: true});
  assert.equal(body(e.posts().at(-1)).active, false);
});

test("close pauses and docks the existing iframe without reloading an autoplay stream", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  const streamUrl = e.iframe.src;
  e.context.closeSundayStreamMiniPlayer();
  assert.equal(body(e.posts().at(-1)).active, false);
  assert.equal(e.bridgeMessages.at(-1).name, "pause");
  assert.equal(e.iframe.src, streamUrl);
  assert.equal(e.context.sundayStreamPlaybackClosePending, true);
  e.message({playing: true});
  [...e.intervals.values()].find(v => v.delay === 20000).fn();
  assert.equal(e.posts().length, 2, "queued playing snapshots cannot resurrect presence");
  assert.equal(e.bridgeMessages.at(-1).name, "pause");
  e.message({paused: true});
  assert.equal(e.context.sundayStreamPlaybackClosePending, false);
  assert.equal(e.context.sundayStreamPlaybackPaused, true);
  e.message({paused: false});
  assert.equal(e.posts().length, 3, "a later embedded-player resume can count again");
});

test("disconnected close retains its pause latch through reset and rejects autoplay", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.sundayStreamPlaybackConnected = false;
  e.context.closeSundayStreamMiniPlayer();
  assert.equal(body(e.posts().at(-1)).active, false);
  assert.equal(e.context.sundayStreamPresence, null);
  e.message({playing: true});
  assert.equal(e.posts().length, 2);
  assert.equal(e.iframe.src, "about:blank");
  e.context.handleSundayStreamPlaybackIframeLoad_();
  e.message({playing: true});
  assert.equal(e.posts().length, 2);
  assert.match(e.iframe.src, /^https:\/\/control.resi.io/);
  e.context.handleSundayStreamPlaybackIframeLoad_();
  await e.available();
  e.message(null, {data: {kind: "player-ready"}});
  assert.equal(e.bridgeMessages.at(-1).name, "pause");
  e.message({paused: false});
  assert.equal(e.posts().length, 2, "reset autoplay must not count");
  e.message({paused: true});
  e.message({paused: false});
  assert.equal(e.posts().length, 3);
  assert.notEqual(body(e.posts()[0]).sessionId, body(e.posts()[2]).sessionId);
});


test("teardown cancels timers and late requests cannot revive the old lifecycle", async () => {
  const e = setup(); const oldGet = e.requests[0];
  e.context.teardownSundayStreamPlaybackControl_();
  await e.answer(oldGet, {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "old", count: 88});
  assert.equal(e.badges[0].hidden, true);
  assert.equal(e.intervals.size, 0);
  assert.equal(e.posts().length, 0);
});

test("pagehide leaves and BFCache restore requires fresh playback validation", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.handleSundayStreamPresencePageHide_();
  assert.equal(body(e.posts().at(-1)).active, false);
  assert.equal(e.intervals.size, 0);
  e.message({playing: true});
  e.context.handleSundayStreamPresencePageShow_({persisted: true});
  await e.available();
  assert.equal(e.posts().length, 2);
  e.message({paused: false});
  assert.equal(e.posts().length, 3);
});

test("failed, malformed, or unavailable counts hide both badges and never fabricate zero", async () => {
  const e = setup(); await e.available();
  const poll = () => e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  poll(); e.requests.at(-1).reject(new Error("offline")); await flush();
  assert.ok(e.badges.every(b => b.hidden));
  for (const data of [{available: false}, {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "stream-one", count: -1},
    {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "stream-one", count: "4"}]) {
    poll(); await e.answer(e.requests.at(-1), data);
    assert.ok(e.badges.every(b => b.hidden));
  }
  poll(); await e.available(4);
  assert.equal(e.badges[0].count.textContent, "4");
});

test("unavailable stream withdraws active presence, and old poll responses cannot replace newer data", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  const old = e.requests.at(-1);
  e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  await e.answer(e.requests.at(-1), {available: false});
  await e.answer(old, {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "stream-one", count: 99});
  assert.equal(body(e.posts().at(-1)).active, false);
  assert.equal(e.badges[0].hidden, true);
});

test("SundayMode and configured iframe URL gate all network activity", () => {
  for (const options of [{enabled: false}, {url: "https://example.com/video"},
    {url: "https://user:pass@control.resi.io/video"}]) {
    assert.equal(setup(options).requests.length, 0);
  }
  const e = setup();
  e.context.teardownSundayStreamPresence_();
  e.iframe.src = "https://control.resi.io/other";
  e.context.initSundayStreamPresence_();
  assert.equal(e.context.sundayStreamPresence, null);
});

test("failed play result withdraws an active session; failed POST hides the count", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  await e.answer(e.posts().at(-1), {available: false});
  assert.equal(e.badges[0].hidden, true);
  e.message(null, {data: {name: "play-result", ok: false}});
  assert.equal(body(e.posts().at(-1)).active, false);
});


test("hung polls hide stale counts, abort requests, and recover on the next poll", async () => {
  const e = setup(); await e.available();
  e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  const hung = e.requests.at(-1);
  const timeout = [...e.timeouts.values()].find(v => v.delay === 10000);
  timeout.fn();
  assert.equal(hung.options.signal.aborted, true);
  assert.equal(e.badges[0].hidden, true);
  await e.answer(hung, {available: true, streamUrl: "https://control.resi.io/webplayer/video.html?id=central", streamKey: "stream-one", count: 99});
  assert.equal(e.badges[0].hidden, true);
  e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  await e.available(1000);
  assert.equal(e.badges[0].hidden, false);
  assert.equal(e.badges[0].count.textContent, "1K");
  assert.equal(e.badges[1].count.textContent, "1K");
});


test("active teardown leaves once and old POST errors cannot hide a replacement lifecycle", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  const oldPost = e.posts()[0];
  e.context.teardownSundayStreamPresence_();
  assert.equal(body(e.posts().at(-1)).active, false);
  e.context.teardownSundayStreamPresence_();
  assert.equal(e.posts().length, 2);
  e.context.initSundayStreamPresence_();
  await e.available(3);
  oldPost.reject(new Error("late network failure"));
  await flush();
  assert.equal(e.badges[0].hidden, false);
  assert.equal(e.badges[0].count.textContent, "3");
});

test("pagehide while paused never sends a fabricated active session", async () => {
  const e = setup(); await e.available(); e.message({paused: true});
  e.context.handleSundayStreamPresencePageHide_();
  assert.equal(e.posts().length, 0);
  assert.equal(e.intervals.size, 0);
  assert.equal(e.badges[0].hidden, true);
});


test("server stream changes cannot transfer confirmed playback from an old iframe", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.pollSundayStreamPresence_(e.context.sundayStreamPresence);
  await e.answer(e.requests.at(-1), {available: true, streamKey: "stream-two", count: 12,
    streamUrl: "https://control.resi.io/webplayer/video.html?id=new-stream"});
  assert.deepEqual(e.posts().map(r => body(r).active), [true, false]);
  assert.ok(e.posts().every(r => body(r).streamKey === "stream-one"));
  assert.equal(e.context.sundayStreamPresence.streamKey, "");
  assert.ok(e.badges.every(b => b.hidden));
  e.message({paused: false});
  [...e.intervals.values()].find(v => v.delay === 20000).fn();
  assert.equal(e.posts().length, 2);
});

test("missing or malformed server URL hides the count and cannot activate presence", async () => {
  for (const streamUrl of [undefined, "not a URL", "https://other.example/video"]) {
    const e = setup(); e.message({playing: true});
    await e.answer(e.requests[0], {available: true, streamKey: "stream-one", count: 12, streamUrl});
    assert.equal(e.posts().length, 0);
    assert.ok(e.badges.every(b => b.hidden));
  }
});


test("only validated pause or an explicit overlay Play releases the close latch", async () => {
  const e = setup(); await e.available(); e.message({playing: true});
  e.context.closeSundayStreamMiniPlayer();
  e.message({paused: true}, {origin: "https://other.example"});
  assert.equal(e.context.sundayStreamPlaybackClosePending, true);
  e.context.toggleSundayStreamPlayback();
  assert.equal(e.context.sundayStreamPlaybackClosePending, false);
  assert.equal(e.bridgeMessages.at(-1).name, "play");
  assert.equal(e.posts().length, 2, "explicit play still waits for Resi confirmation");
  e.message({playing: true});
  assert.equal(e.posts().length, 3);
});


test("closing an already paused player permits the first native Play without another pause", async () => {
  const e = setup(); await e.available(); e.message({paused: true});
  e.context.closeSundayStreamMiniPlayer();
  assert.equal(e.context.sundayStreamPlaybackClosePending, false);
  const pauseMessages = e.bridgeMessages.length;
  e.message({playing: true});
  assert.equal(e.bridgeMessages.length, pauseMessages, "native Play is not intercepted");
  assert.equal(e.posts().length, 1);
  assert.equal(body(e.posts()[0]).active, true);
});

test("optimistic Play invalidates a previous paused snapshot before Close", async () => {
  const e = setup(); await e.available(); e.message({paused: true});
  e.context.toggleSundayStreamPlayback();
  e.context.closeSundayStreamMiniPlayer();
  assert.equal(e.context.sundayStreamPlaybackClosePending, true);
  e.message({playing: true});
  assert.equal(e.posts().length, 0);
  assert.equal(e.bridgeMessages.at(-1).name, "pause");
});
