import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
    new URL("../public/catm-popcorn-audio.js", import.meta.url),
    "utf8",
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}

function createParam(initial = 0) {
  return {
    value: initial,
    events: [],
    cancelScheduledValues(time) {
      this.events.push(["cancel", time]);
    },
    setValueAtTime(value, time) {
      this.value = value;
      this.events.push(["set", value, time]);
    },
    linearRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push(["ramp", value, time]);
    },
  };
}

function createNode(kind) {
  return {
    kind,
    connections: [],
    disconnected: false,
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {
      this.disconnected = true;
      this.connections.length = 0;
    },
  };
}

function loadAudio({fetchImpl, resumeImpl, decodeImpl, withContext = true} = {}) {
  const records = {
    contexts: [],
    fetches: [],
    timers: [],
  };

  class FakeAudioContext {
    constructor() {
      this.currentTime = 10;
      this.state = "suspended";
      this.destination = createNode("destination");
      this.sources = [];
      this.gains = [];
      this.panners = [];
      this.compressors = [];
      this.resumeCalls = 0;
      this.decodeCalls = 0;
      this.closed = false;
      records.contexts.push(this);
    }
    createDynamicsCompressor() {
      const node = Object.assign(createNode("compressor"), {
        threshold: createParam(),
        knee: createParam(),
        ratio: createParam(),
        attack: createParam(),
        release: createParam(),
      });
      this.compressors.push(node);
      return node;
    }
    createGain() {
      const node = Object.assign(createNode("gain"), {gain: createParam(1)});
      this.gains.push(node);
      return node;
    }
    createStereoPanner() {
      const node = Object.assign(createNode("panner"), {pan: createParam()});
      this.panners.push(node);
      return node;
    }
    createBufferSource() {
      const node = Object.assign(createNode("source"), {
        buffer: null,
        loop: false,
        playbackRate: createParam(1),
        starts: [],
        stops: [],
        onended: null,
        start(when, offset) {
          this.starts.push([when, offset]);
        },
        stop(when) {
          this.stops.push(when);
        },
      });
      this.sources.push(node);
      return node;
    }
    resume() {
      this.resumeCalls += 1;
      if (resumeImpl) return resumeImpl(this);
      this.state = "running";
      return Promise.resolve();
    }
    decodeAudioData(data, success, failure) {
      this.decodeCalls += 1;
      const result = decodeImpl ? decodeImpl(data, this) : Promise.resolve({duration: 20});
      result.then(success, failure);
      return result;
    }
    close() {
      this.closed = true;
      this.state = "closed";
      return Promise.resolve();
    }
  }

  const window = {
    fetch: async (url) => {
      records.fetches.push(url);
      if (fetchImpl) return fetchImpl(url, records.fetches.length);
      return {ok: true, arrayBuffer: async () => new ArrayBuffer(8)};
    },
    setTimeout(callback, delay) {
      const timer = {callback, delay, cleared: false};
      records.timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      timer.cleared = true;
    },
  };
  if (withContext) window.AudioContext = FakeAudioContext;
  vm.runInNewContext(source, {window, console}, {filename: "catm-popcorn-audio.js"});
  return {api: window.CatmPopcornAudio, records};
}

test("start unlocks synchronously, builds three restrained layers, and reuses the buffer", async () => {
  const {api, records} = loadAudio();
  const states = [];
  const audio = api.create({onState: (state) => states.push(state)});

  assert.deepEqual(states, ["off"]);
  const starting = audio.start();
  const context = records.contexts[0];
  assert.equal(context.resumeCalls, 1, "resume must run in the click/start call stack");
  assert.deepEqual(states, ["off", "loading"]);
  assert.equal(await starting, true);
  assert.equal(states.at(-1), "playing");
  assert.deepEqual(records.fetches, ["/catm-popcorn-pops.wav"]);
  assert.equal(context.decodeCalls, 1);
  assert.equal(context.sources.length, 3);
  assert.ok(context.sources.every((source) => source.loop));
  assert.equal(new Set(context.sources.map((source) => source.starts[0][1])).size, 3);
  assert.deepEqual(context.sources.map((source) => source.playbackRate.value), [0.985, 1, 1.018]);
  assert.deepEqual(context.panners.map((panner) => panner.pan.value), [-0.18, 0.12, 0.02]);
  assert.equal(context.compressors[0].threshold.value, -18);

  const gainsBefore = context.gains.map((gain) => gain.gain.value);
  audio.setProgress(100);
  assert.equal(context.sources.length, 3, "progress must not recreate sources");
  assert.ok(context.gains[0].gain.value > gainsBefore[0]);
  assert.ok(context.gains[2].gain.value > gainsBefore[2]);
  assert.ok(context.gains[3].gain.value > gainsBefore[3]);
  assert.equal(await audio.start(), true);
  assert.equal(context.sources.length, 3, "a repeated start while playing stays bounded");

  audio.stop();
  assert.equal(states.at(-1), "off");
  assert.ok(context.sources.every((source) =>
    source.stops.some((time) => Math.abs(time - 10.21) < 0.000001),
  ));
  assert.equal(await audio.start(), true);
  assert.equal(records.fetches.length, 1, "decoded audio is reused for replay");
  assert.equal(context.decodeCalls, 1);
  assert.equal(context.sources.filter((source) => !source.disconnected).length, 3);
});

test("stop cancels a pending load without allowing a stale failure or late playback", async () => {
  const request = deferred();
  const {api, records} = loadAudio({fetchImpl: () => request.promise});
  const states = [];
  const audio = api.create({onState: (state) => states.push(state)});

  const starting = audio.start();
  audio.stop();
  request.reject(new Error("network failed after stop"));

  assert.equal(await starting, false);
  assert.equal(records.contexts[0].sources.length, 0);
  assert.deepEqual(states, ["off", "loading", "off"]);
});

test("a failed load reports unavailable and a later explicit start can retry", async () => {
  const {api, records} = loadAudio({
    fetchImpl: async (_url, attempt) => {
      if (attempt === 1) throw new Error("temporary failure");
      return {ok: true, arrayBuffer: async () => new ArrayBuffer(8)};
    },
  });
  const states = [];
  const audio = api.create({onState: (state) => states.push(state)});

  assert.equal(await audio.start(), false);
  assert.equal(states.at(-1), "unavailable");
  assert.equal(await audio.start(), true);
  assert.equal(records.fetches.length, 2);
  assert.equal(states.at(-1), "playing");
});

test("cleanup timer disconnects a stopped session even when onended never fires", async () => {
  const {api, records} = loadAudio();
  const audio = api.create();
  await audio.start();
  const context = records.contexts[0];
  const firstSources = context.sources.slice();

  audio.stop();
  const timer = records.timers.at(-1);
  assert.equal(timer.delay, 280);
  timer.callback();
  assert.ok(firstSources.every((source) => source.disconnected));
  assert.ok(context.gains.slice(0, 4).every((gain) => gain.disconnected));
});

test("missing Web Audio is graceful and destroy prevents future playback", async () => {
  const unavailable = loadAudio({withContext: false});
  const states = [];
  const audio = unavailable.api.create({onState: (state) => states.push(state)});
  assert.equal(await audio.start(), false);
  assert.deepEqual(states, ["off", "unavailable"]);

  const available = loadAudio();
  const other = available.api.create();
  await other.start();
  other.destroy();
  assert.equal(available.records.contexts[0].closed, true);
  assert.equal(await other.start(), false);
  assert.ok(available.records.contexts[0].sources.every((source) => source.disconnected));
});
