(function(global) {
  "use strict";

  var EXPERIENCE_ID = "christmas-at-the-movies";
  var STORAGE_KEY = "central-christmas-movies-2026-mode";
  var ACTIVE_ATTRIBUTE = "data-seasonal-experience";
  var PREVIEW_QUERY_KEY = "seasonalPreview";

  function normalizeHostname_(value) {
    return String(value || "").trim().toLowerCase().replace(/:\d+$/, "");
  }

  function isLocalHostname_(hostname) {
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
  }

  function isDevPreviewHostname_(hostname) {
    return /^crosspointe-central--dev-[a-z0-9-]+\.(?:web\.app|firebaseapp\.com)$/
        .test(hostname);
  }

  function isProductionHostname_(hostname) {
    return hostname === "central.crosspointe.tv" ||
      hostname === "crosspointe-central.web.app" ||
      hostname === "crosspointe-central.firebaseapp.com";
  }

  function isPublicPath_(pathname) {
    var path = String(pathname || "/");
    return !/^\/(?:admin|planner|studio|embeds|privacy|terms|about)(?:\/|$)/
        .test(path);
  }

  function normalizeConfig_(value) {
    var source = value && typeof value === "object" ? value : {};
    return {
      id: source.id === EXPERIENCE_ID ? source.id : EXPERIENCE_ID,
      previewEnabled: source.previewEnabled === true,
      previewDefaultOn: source.previewDefaultOn === true,
      productionEnabled: source.productionEnabled === true,
      productionStartsAt: String(source.productionStartsAt || "").trim(),
      productionEndsAt: String(source.productionEndsAt || "").trim(),
    };
  }

  function isInsideProductionWindow_(config, nowMs) {
    var startsAt = config.productionStartsAt ?
      Date.parse(config.productionStartsAt) : Number.NaN;
    var endsAt = config.productionEndsAt ?
      Date.parse(config.productionEndsAt) : Number.NaN;

    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) ||
      endsAt <= startsAt) {
      return false;
    }

    return nowMs >= startsAt && nowMs < endsAt;
  }

  function getPreviewQueryMode_(search) {
    try {
      var value = new URLSearchParams(String(search || ""))
          .get(PREVIEW_QUERY_KEY);
      if (value === EXPERIENCE_ID || value === "christmas" || value === "on") {
        return "seasonal";
      }
      if (value === "normal" || value === "off") {
        return "normal";
      }
    } catch (error) {
    }

    return "";
  }

  function normalizeStoredMode_(value) {
    var mode = String(value || "").trim().toLowerCase();
    return mode === "normal" || mode === "seasonal" ? mode : "";
  }

  function resolveState_(options) {
    var settings = options && typeof options === "object" ? options : {};
    var config = normalizeConfig_(settings.config);
    var hostname = normalizeHostname_(settings.hostname);
    var pathname = String(settings.pathname || "/");
    var nowMs = Number.isFinite(settings.nowMs) ? settings.nowMs : Date.now();
    var storedMode = normalizeStoredMode_(settings.storedMode);
    var isPreview = isLocalHostname_(hostname) || isDevPreviewHostname_(hostname);
    var isProduction = isProductionHostname_(hostname);
    var available = false;
    var defaultActive = false;
    var queryMode = "";

    if (!isPublicPath_(pathname)) {
      return {
        id: EXPERIENCE_ID,
        environment: "excluded",
        available: false,
        active: false,
        mode: "normal",
      };
    }

    if (isPreview) {
      available = config.previewEnabled;
      defaultActive = available && config.previewDefaultOn;
      queryMode = getPreviewQueryMode_(settings.search);
    } else if (isProduction) {
      available = config.productionEnabled &&
        isInsideProductionWindow_(config, nowMs);
      defaultActive = available;
    }

    var active = defaultActive;
    if (available && storedMode === "normal") {
      active = false;
    } else if (available && isPreview && storedMode === "seasonal") {
      active = true;
    }

    if (available && isPreview && queryMode) {
      active = queryMode === "seasonal";
    }

    return {
      id: EXPERIENCE_ID,
      environment: isPreview ? "preview" : (isProduction ? "production" : "unknown"),
      available: available,
      active: active,
      mode: active ? "seasonal" : "normal",
    };
  }

  function readStoredMode_() {
    try {
      return global.localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function writeStoredMode_(mode) {
    try {
      if (mode === "normal" || mode === "seasonal") {
        global.localStorage.setItem(STORAGE_KEY, mode);
      } else {
        global.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
    }
  }

  function getCurrentOptions_() {
    return {
      config: global.CENTRAL_SEASONAL_EXPERIENCE_CONFIG,
      hostname: global.location && global.location.hostname,
      pathname: global.location && global.location.pathname,
      search: global.location && global.location.search,
      storedMode: readStoredMode_(),
      nowMs: Date.now(),
    };
  }

  function clearPreviewQuery_() {
    if (!global.location || !global.history ||
      typeof global.history.replaceState !== "function") return;

    try {
      var params = new URLSearchParams(String(global.location.search || ""));
      if (!params.has(PREVIEW_QUERY_KEY)) return;

      params.delete(PREVIEW_QUERY_KEY);
      var query = params.toString();
      var nextUrl = String(global.location.pathname || "/") +
        (query ? "?" + query : "") + String(global.location.hash || "");
      global.history.replaceState({}, "", nextUrl);
    } catch (error) {
    }
  }

  var state = resolveState_(getCurrentOptions_());

  function applyState_() {
    if (!global.document || !global.document.documentElement) return;

    var root = global.document.documentElement;
    if (state.active) {
      root.setAttribute(ACTIVE_ATTRIBUTE, EXPERIENCE_ID);
    } else {
      root.removeAttribute(ACTIVE_ATTRIBUTE);
    }

    root.setAttribute(
        "data-seasonal-experience-available",
        state.available ? "true" : "false",
    );
  }

  function setMode_(mode, reload) {
    var normalizedMode = normalizeStoredMode_(mode);
    if (normalizedMode === "seasonal") {
      if (!state.available) return false;

      // Production is seasonal by configuration, so re-enabling it means
      // clearing the visitor's normal-mode opt-out instead of persisting a
      // preview-only seasonal override.
      if (state.environment === "production") {
        normalizedMode = "";
      }
    }

    writeStoredMode_(normalizedMode);
    state = resolveState_(Object.assign({}, getCurrentOptions_(), {
      storedMode: normalizedMode,
      search: "",
    }));
    applyState_();
    clearPreviewQuery_();

    if (reload !== false && global.location &&
      typeof global.location.reload === "function") {
      global.location.reload();
    }

    return true;
  }

  function toggle_(reload) {
    if (!state.available) return false;
    return setMode_(state.active ? "normal" : "seasonal", reload);
  }

  applyState_();

  global.CentralSeasonalExperience = Object.freeze({
    id: EXPERIENCE_ID,
    storageKey: STORAGE_KEY,
    getState: function() {
      return Object.assign({}, state);
    },
    isAvailable: function() {
      return state.available;
    },
    isActive: function() {
      return state.active;
    },
    resolveState: resolveState_,
    setMode: setMode_,
    toggle: toggle_,
  });
}(window));
