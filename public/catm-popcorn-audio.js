/* Loader Lab popcorn ambience. Sound starts only from an explicit start() call. */
(function(root) {
  "use strict";

  var DEFAULT_URL = "/catm-popcorn-pops.wav";
  var LAYERS = [
    {offset: 0.04, rate: 0.985, pan: -0.18},
    {offset: 0.37, rate: 1.000, pan: 0.12},
    {offset: 0.71, rate: 1.018, pan: 0.02},
  ];

  function clampProgress(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function setParam(param, value, now, transition) {
    if (!param) return;
    try {
      if (typeof param.cancelScheduledValues === "function") param.cancelScheduledValues(now);
      if (typeof param.setValueAtTime === "function") param.setValueAtTime(Number(param.value) || 0, now);
      if (transition && typeof param.linearRampToValueAtTime === "function") {
        param.linearRampToValueAtTime(value, now + transition);
      } else if (transition && typeof param.setTargetAtTime === "function") {
        param.setTargetAtTime(value, now, Math.max(0.01, transition / 3));
      } else if (typeof param.setValueAtTime === "function") {
        param.setValueAtTime(value, now);
      } else {
        param.value = value;
      }
    } catch (_error) {
      try { param.value = value; } catch (_ignored) {}
    }
  }

  function disconnect(node) {
    if (!node || typeof node.disconnect !== "function") return;
    try { node.disconnect(); } catch (_error) {}
  }

  function create(options) {
    options = options || {};
    var url = options.url || DEFAULT_URL;
    var onState = typeof options.onState === "function" ? options.onState : function() {};
    var AudioContextConstructor = root.AudioContext || root.webkitAudioContext;
    var context = null;
    var output = null;
    var buffer = null;
    var bufferPromise = null;
    var currentPlayback = null;
    var retiredPlaybacks = new Set();
    var generation = 0;
    var progress = 0;
    var state = null;
    var destroyed = false;

    function setState(next) {
      if (state === next) return;
      state = next;
      try { onState(next); } catch (_error) {}
    }

    function makeOutput(audioContext) {
      var compressor = typeof audioContext.createDynamicsCompressor === "function" ?
        audioContext.createDynamicsCompressor() : null;
      if (!compressor) return audioContext.destination;
      setParam(compressor.threshold, -18, audioContext.currentTime || 0);
      setParam(compressor.knee, 18, audioContext.currentTime || 0);
      setParam(compressor.ratio, 4, audioContext.currentTime || 0);
      setParam(compressor.attack, 0.003, audioContext.currentTime || 0);
      setParam(compressor.release, 0.18, audioContext.currentTime || 0);
      compressor.connect(audioContext.destination);
      return compressor;
    }

    function ensureContext() {
      if (context) return context;
      if (!AudioContextConstructor) throw new Error("Web Audio is unavailable.");
      context = new AudioContextConstructor();
      output = makeOutput(context);
      return context;
    }

    function decode(audioContext, data) {
      return new Promise(function(resolve, reject) {
        var settled = false;
        function succeed(value) {
          if (settled) return;
          settled = true;
          resolve(value);
        }
        function fail(error) {
          if (settled) return;
          settled = true;
          reject(error || new Error("The popcorn audio could not be decoded."));
        }
        try {
          var result = audioContext.decodeAudioData(data, succeed, fail);
          if (result && typeof result.then === "function") result.then(succeed, fail);
        } catch (error) {
          fail(error);
        }
      });
    }

    function loadBuffer(audioContext) {
      if (buffer) return Promise.resolve(buffer);
      if (bufferPromise) return bufferPromise;
      var fetcher = root.fetch;
      if (typeof fetcher !== "function") return Promise.reject(new Error("Audio loading is unavailable."));
      bufferPromise = Promise.resolve().then(function() {
        return fetcher.call(root, url);
      }).then(function(response) {
        if (!response || !response.ok) throw new Error("The popcorn audio could not be loaded.");
        return response.arrayBuffer();
      }).then(function(data) {
        return decode(audioContext, data);
      }).then(function(decoded) {
        if (!decoded) throw new Error("The popcorn audio could not be decoded.");
        buffer = decoded;
        return decoded;
      }).catch(function(error) {
        bufferPromise = null;
        throw error;
      });
      return bufferPromise;
    }

    function levels() {
      var phase = progress / 100;
      return {
        master: 0.62 + phase * 0.12,
        layers: [0.52, 0.22 + phase * 0.23, 0.10 + phase * 0.28],
      };
    }

    function applyProgress(playback, transition) {
      if (!playback || playback.disposed) return;
      var now = context.currentTime || 0;
      var next = levels();
      setParam(playback.master.gain, next.master, now, transition);
      playback.layerGains.forEach(function(gain, index) {
        setParam(gain.gain, next.layers[index], now, transition);
      });
    }

    function cleanupPlayback(playback) {
      if (!playback || playback.disposed) return;
      playback.disposed = true;
      if (playback.cleanupTimer) {
        (root.clearTimeout || clearTimeout)(playback.cleanupTimer);
        playback.cleanupTimer = 0;
      }
      playback.sources.forEach(function(source) {
        source.onended = null;
        try { source.stop(); } catch (_error) {}
        disconnect(source);
      });
      playback.panners.forEach(disconnect);
      playback.layerGains.forEach(disconnect);
      disconnect(playback.master);
      retiredPlaybacks.delete(playback);
      if (currentPlayback === playback) currentPlayback = null;
    }

    function cleanupRetired() {
      Array.from(retiredPlaybacks).forEach(cleanupPlayback);
    }

    function retirePlayback(playback, fadeSeconds) {
      if (!playback || playback.disposed) return;
      if (currentPlayback === playback) currentPlayback = null;
      retiredPlaybacks.add(playback);
      var now = context.currentTime || 0;
      setParam(playback.master.gain, 0, now, fadeSeconds);
      playback.sources.forEach(function(source) {
        try { source.stop(now + fadeSeconds + 0.01); } catch (_error) {}
      });
      var remaining = playback.sources.length;
      playback.sources.forEach(function(source) {
        source.onended = function() {
          remaining -= 1;
          if (remaining === 0) cleanupPlayback(playback);
        };
      });
      playback.cleanupTimer = (root.setTimeout || setTimeout)(function() {
        cleanupPlayback(playback);
      }, Math.ceil((fadeSeconds + 0.08) * 1000));
    }

    function beginPlayback(decoded) {
      cleanupRetired();
      var now = context.currentTime || 0;
      var playback = {
        master: context.createGain(),
        layerGains: [],
        panners: [],
        sources: [],
        cleanupTimer: 0,
        disposed: false,
      };
      playback.master.gain.value = 0;
      playback.master.connect(output);
      try {
        LAYERS.forEach(function(spec, index) {
          var source = context.createBufferSource();
          var gain = context.createGain();
          var panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
          source.buffer = decoded;
          source.loop = true;
          setParam(source.playbackRate, spec.rate, now);
          if (panner) setParam(panner.pan, spec.pan, now);
          source.connect(panner || gain);
          if (panner) panner.connect(gain);
          gain.connect(playback.master);
          playback.sources.push(source);
          playback.layerGains.push(gain);
          if (panner) playback.panners.push(panner);
          var duration = Math.max(0.01, Number(decoded.duration) || 1);
          source.start(now, Math.min(duration - 0.001, duration * spec.offset));
        });
      } catch (error) {
        cleanupPlayback(playback);
        throw error;
      }
      currentPlayback = playback;
      applyProgress(playback, 0.12);
      return playback;
    }

    function start() {
      if (destroyed) return Promise.resolve(false);
      if (currentPlayback && !currentPlayback.disposed) return Promise.resolve(true);

      var audioContext;
      var resumeResult;
      var token = ++generation;
      try {
        audioContext = ensureContext();
        setState("loading");
        // Keep resume in this synchronous call stack so a click can unlock audio.
        resumeResult = audioContext.state === "suspended" && typeof audioContext.resume === "function" ?
          audioContext.resume() : undefined;
      } catch (_error) {
        if (token === generation && !destroyed) setState("unavailable");
        return Promise.resolve(false);
      }

      var loading = loadBuffer(audioContext);
      return Promise.all([Promise.resolve(resumeResult), loading]).then(function(results) {
        if (destroyed || token !== generation) return false;
        if (audioContext.state === "suspended") throw new Error("Audio playback is still suspended.");
        beginPlayback(results[1]);
        if (destroyed || token !== generation) {
          retirePlayback(currentPlayback, 0);
          cleanupRetired();
          return false;
        }
        setState("playing");
        return true;
      }).catch(function() {
        if (token === generation && !destroyed) setState("unavailable");
        return false;
      });
    }

    function stop() {
      generation += 1;
      if (currentPlayback) retirePlayback(currentPlayback, 0.20);
      if (!destroyed) setState("off");
    }

    function setProgress(value) {
      progress = clampProgress(value);
      applyProgress(currentPlayback, 0.09);
    }

    function destroy() {
      if (destroyed) return;
      generation += 1;
      destroyed = true;
      if (currentPlayback) cleanupPlayback(currentPlayback);
      cleanupRetired();
      setState("off");
      if (context && typeof context.close === "function") {
        try {
          var closed = context.close();
          if (closed && typeof closed.catch === "function") closed.catch(function() {});
        } catch (_error) {}
      }
      context = null;
      output = null;
      buffer = null;
      bufferPromise = null;
    }

    setState("off");
    return {start: start, stop: stop, setProgress: setProgress, destroy: destroy};
  }

  var api = {create: create};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CatmPopcornAudio = api;
}(typeof window !== "undefined" ? window : globalThis));
