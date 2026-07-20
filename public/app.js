var CENTRAL_IS_ADMIN_ROUTE = window.CENTRAL_BOOT_MODE === "admin" ||
  /^\/admin(?:\/|$)/.test(window.location.pathname);

var currentCentralData = null;
var centralRefreshInterval = null;
var countdownInterval = null;
var previousCountdownDigits = {};

var sundayNotesStorageKey = "";
var sundayNotesSeed = {};

var googleNotesTokenClient = null;
var googleNotesAccessToken = "";
var googleNotesTokenExpiresAt = 0;
var googleNotesClientId = "";
var googleIdentityReady = false;
var googleNotesClientReady = false;
var googleNotesWarmupPromise = null;
var responsiveListenersBound = false;
var googleNotesPendingResolve = null;
var googleNotesPendingReject = null;
var sundayNotesLastDocUrl = "";
var sundayNotesToolbarListenersBound = false;

var GOOGLE_NOTES_SCOPE = "https://www.googleapis.com/auth/drive.file";
var GOOGLE_NOTES_INIT_TIMEOUT_MS = 10000;
var CENTRAL_REFRESH_MS = 1200000;
var CENTRAL_API_URL = "/api/central-data";
var CENTRAL_HOSTED_WHATS_NEW_URL = "/content/whats-new.json";
var SERVE_NEED_INTEREST_ENDPOINT = "/api/serve-needs/share-interest";
var CENTRAL_CACHE_KEY = "central-data-cache-v4";
var CENTRAL_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
var EXPANDABLE_FLOW_DURATION_MS = 1000;
var CENTRAL_WHATS_NEW_SEEN_KEY = "central-whats-new-seen-v1";
var CENTRAL_THEME_STORAGE_KEY = "central-theme-override-v2";
var CENTRAL_THEME_LIGHT = "light";
var CENTRAL_THEME_DARK = "dark";
var CENTRAL_THEME_META_LIGHT = "#f4f4f5";
var CENTRAL_THEME_META_DARK = "#18181b";
var YOUVERSION_READER_MODULE_URL = "/youversion-reader.js";
var HOMEPAGE_MODULE_DEFINITIONS = [
  {id: "statusBanner", label: "Status Banner", defaultEnabled: true},
  {id: "today", label: "Today", defaultEnabled: true},
  {id: "sunday", label: "This Sunday", defaultEnabled: true},
  {id: "events", label: "Events", defaultEnabled: true},
  {id: "registrations", label: "Registrations", defaultEnabled: true},
  {id: "campaigns", label: "Campaigns", defaultEnabled: true},
  {id: "nextSteps", label: "Next Steps", defaultEnabled: true},
  {id: "serveNeeds", label: "Serve Needs", defaultEnabled: true},
  {id: "resources", label: "Resources", defaultEnabled: true},
  {id: "quickLinks", label: "Quick Links", defaultEnabled: true},
];
var SUNDAY_MODE_MODULE_DEFINITIONS = [
  {id: "quickActions", label: "Quick Actions", defaultEnabled: true},
  {id: "sermonWorship", label: "Sermon + Worship", defaultEnabled: true},
  {id: "watchLive", label: "Watch Live", defaultEnabled: true},
  {id: "scriptureNotes", label: "Scripture + Notes", defaultEnabled: true},
  {id: "today", label: "Today", defaultEnabled: true},
  {id: "events", label: "Events", defaultEnabled: true},
  {id: "registrations", label: "Registrations", defaultEnabled: false},
  {id: "campaigns", label: "Campaigns", defaultEnabled: false},
  {id: "nextSteps", label: "Next Steps", defaultEnabled: false},
  {id: "serveNeeds", label: "Serve Needs", defaultEnabled: false},
  {id: "resources", label: "Resources", defaultEnabled: false},
];
var whatsNewEscapeHandler = null;
var serveNeedInterestEscapeHandler = null;
var eventDetailsEscapeHandler = null;
var eventDetailsPreviousFocus = null;
var eventDetailsCloseTimer = 0;
var eventDetailItemsByKey = {};
var eventDetailKeyCounter = 0;
var serveNeedInterestItemsByKey = {};
var serveNeedInterestKeyCounter = 0;
var youVersionReaderModulePromise = null;
var youVersionReaderStylesLoaded = false;
var sundayScriptureUnmount = null;
var sundayScriptureMountRequestId = 0;
var sundayStreamMiniPlayerEnabled = false;
var sundayStreamMiniPlayerWidth = 420;
var sundayStreamPlayerAnimation = null;
var sundayStreamReturnAnimationFrame = 0;
var sundayStreamResizePointerId = null;
var sundayStreamResizeStartX = 0;
var sundayStreamResizeStartWidth = 0;
var sundayStreamResizeHandle = null;
var sundayStreamGestureState = null;
var sundayStreamMiniPlayerPosition = null;
var sundayStreamPlaybackIframe = null;
var sundayStreamPlaybackOrigin = "";
var sundayStreamPlaybackConnected = false;
var sundayStreamPlaybackStateKnown = false;
var sundayStreamPlaybackPaused = false;
var sundayStreamPlaybackConnectTimer = 0;
var sundayStreamPlaybackConnectAttempts = 0;
var calendarMenuIdCounter = 0;
var centralThemeMediaQuery = null;
var centralThemeOverride = "";
var centralLoaderProgressValue = 0;
var centralLoaderProgressTarget = 0;
var centralLoaderAnimationFrame = 0;
var centralLoaderTrickleInterval = 0;
var centralLoaderRevealTimeout = 0;
var centralLoaderHideTimeout = 0;
var centralLoaderBootStartedAt = 0;
var centralLoaderVisible = false;
var centralHostedWhatsNewConfig = null;
var centralHostedWhatsNewConfigPromise = null;
var CENTRAL_LOADER_COLLAPSE_MS = 680;
var CENTRAL_LOADER_DOOR_MS = 1525;
var SUNDAY_STREAM_MINI_DEFAULT_WIDTH = 420;
var SUNDAY_STREAM_MINI_MIN_WIDTH = 240;
var SUNDAY_STREAM_MINI_MAX_WIDTH = 680;
var SUNDAY_STREAM_MINI_WIDTH_STEP = 80;
var SUNDAY_STREAM_MINI_MOBILE_DEFAULT_WIDTH = 240;
var SUNDAY_STREAM_MINI_MOBILE_MIN_WIDTH = 160;
var SUNDAY_STREAM_MINI_MOBILE_BREAKPOINT = 640;
var SUNDAY_STREAM_MINI_TAP_MOVE_THRESHOLD = 10;
var SUNDAY_STREAM_MINI_ANIMATION_DURATION_MS = 460;
var SUNDAY_STREAM_MINI_QUAD_EASING =
  "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
var SUNDAY_STREAM_PLAYER_CONNECT_MAX_ATTEMPTS = 24;

if (!CENTRAL_IS_ADMIN_ROUTE) {
  document.addEventListener("DOMContentLoaded", function() {
    initializeCentralTheme_();
    bindCalendarMenuListeners_();
    bootCentral_();
  });
}

function bindCalendarMenuListeners_() {
  document.addEventListener("click", function(event) {
    if (!event.target.closest(".event-calendar-control")) {
      closeCalendarMenus_();
    }
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      closeCalendarMenus_();
    }
  });
}

function initializeCentralTheme_() {
  centralThemeOverride = readStoredCentralTheme_();
  applyCentralTheme_(getResolvedCentralTheme_(), false);
  bindCentralThemeListener_();
}

function bindCentralThemeListener_() {
  if (!window.matchMedia) return;

  centralThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  if (typeof centralThemeMediaQuery.addEventListener === "function") {
    centralThemeMediaQuery.addEventListener(
        "change",
        handleCentralThemeMediaChange_,
    );
  } else if (typeof centralThemeMediaQuery.addListener === "function") {
    centralThemeMediaQuery.addListener(handleCentralThemeMediaChange_);
  }
}

function handleCentralThemeMediaChange_(event) {
  if (centralThemeOverride) return;

  applyCentralTheme_(
      event && event.matches ? CENTRAL_THEME_DARK : CENTRAL_THEME_LIGHT,
      true,
  );
}

function readStoredCentralTheme_() {
  try {
    var storedTheme = localStorage.getItem(CENTRAL_THEME_STORAGE_KEY) || "";
    return isValidCentralTheme_(storedTheme) ? storedTheme : "";
  } catch (error) {
    return "";
  }
}

function writeStoredCentralTheme_(theme) {
  try {
    if (isValidCentralTheme_(theme)) {
      localStorage.setItem(CENTRAL_THEME_STORAGE_KEY, theme);
      return;
    }

    localStorage.removeItem(CENTRAL_THEME_STORAGE_KEY);
  } catch (error) {
  }
}

function prefersDarkCentralTheme_() {
  return !!(
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function getSystemCentralTheme_() {
  return prefersDarkCentralTheme_() ?
    CENTRAL_THEME_DARK :
    CENTRAL_THEME_LIGHT;
}

function isValidCentralTheme_(theme) {
  return theme === CENTRAL_THEME_LIGHT || theme === CENTRAL_THEME_DARK;
}

function getResolvedCentralTheme_() {
  if (isValidCentralTheme_(centralThemeOverride)) {
    return centralThemeOverride;
  }

  var rootTheme = document.documentElement.getAttribute("data-theme");
  if (isValidCentralTheme_(rootTheme)) {
    return rootTheme;
  }

  return getSystemCentralTheme_();
}

function applyCentralTheme_(theme, refreshSundayScripture) {
  var resolvedTheme = isValidCentralTheme_(theme) ?
    theme :
    getResolvedCentralTheme_();
  var root = document.documentElement;

  root.setAttribute("data-theme", resolvedTheme);
  root.style.colorScheme = resolvedTheme;

  if (document.body) {
    document.body.setAttribute("data-theme", resolvedTheme);
  }

  updateCentralThemeColor_();
  syncCentralThemeToggleUi_(resolvedTheme);

  if (refreshSundayScripture) {
    refreshSundayScriptureTheme_();
  }
}

function updateCentralThemeColor_() {
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;

  meta.setAttribute(
      "content",
      getResolvedCentralTheme_() === CENTRAL_THEME_DARK ?
        CENTRAL_THEME_META_DARK :
        CENTRAL_THEME_META_LIGHT,
  );
}

function syncCentralThemeToggleUi_(theme) {
  var resolvedTheme = isValidCentralTheme_(theme) ?
    theme :
    getResolvedCentralTheme_();
  var isDark = resolvedTheme === CENTRAL_THEME_DARK;

  document.querySelectorAll("[data-theme-toggle]").forEach(function(buttonEl) {
    buttonEl.setAttribute("data-theme-state", resolvedTheme);
    buttonEl.setAttribute("aria-pressed", isDark ? "true" : "false");
    buttonEl.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode",
    );

    var statusEl = buttonEl.querySelector("[data-theme-toggle-status]");
    if (statusEl) {
      statusEl.textContent = isDark ? "On" : "Off";
    }
  });
}

function toggleCentralTheme() {
  var nextTheme = getResolvedCentralTheme_() === CENTRAL_THEME_DARK ?
    CENTRAL_THEME_LIGHT :
    CENTRAL_THEME_DARK;
  var systemTheme = getSystemCentralTheme_();

  if (nextTheme === systemTheme) {
    centralThemeOverride = "";
    writeStoredCentralTheme_("");
  } else {
    centralThemeOverride = nextTheme;
    writeStoredCentralTheme_(nextTheme);
  }

  applyCentralTheme_(nextTheme, true);
}

function renderThemeToggle_() {
  var isDark = getResolvedCentralTheme_() === CENTRAL_THEME_DARK;

  return [
    "<button type=\"button\" class=\"theme-toggle\" data-theme-toggle",
    " data-theme-state=\"", escapeAttr(
        isDark ? CENTRAL_THEME_DARK : CENTRAL_THEME_LIGHT,
    ), "\"",
    " aria-pressed=\"", isDark ? "true" : "false", "\"",
    " aria-label=\"", escapeAttr(
        isDark ? "Switch to light mode" : "Switch to dark mode",
    ), "\"",
    " onclick=\"toggleCentralTheme()\">",
      "<span class=\"theme-toggle-copy\">",
        "<strong>Dark Mode</strong>",
        "<small data-theme-toggle-status>", isDark ? "On" : "Off", "</small>",
      "</span>",
      "<span class=\"theme-toggle-switch\" aria-hidden=\"true\">",
        "<span class=\"theme-toggle-thumb\"></span>",
      "</span>",
    "</button>",
  ].join("");
}

function isSundayModeActive_() {
  return !!(
    currentCentralData &&
    currentCentralData.sundayMode &&
    currentCentralData.sundayMode.enabled
  );
}

function refreshSundayScriptureTheme_() {
  var mountEl = document.getElementById("sunday-scripture-mount");
  if (!mountEl || !isSundayModeActive_()) return;

  teardownSundayScripture_();
  initSundayScripture(currentCentralData);
}

function bootCentral_() {
  var continueBoot = function() {
    restoreCentralFromCache_();
    loadCentralData();

    if (!centralRefreshInterval) {
      centralRefreshInterval = window.setInterval(loadCentralData, CENTRAL_REFRESH_MS);
    }
  };

  bindResponsiveListeners_();
  applyResponsiveMode();
  showCentralLoader_();
  setLoadingMessage(
      "Loading CrossPointe Central...",
      "Checking saved content and warming up your hub.",
      14,
  );
  loadHostedWhatsNewConfig_().then(continueBoot, continueBoot);
}

function bindResponsiveListeners_() {
  if (responsiveListenersBound) return;

  window.addEventListener("resize", applyResponsiveMode);
  window.addEventListener("orientationchange", applyResponsiveMode);
  responsiveListenersBound = true;
}

function showCentralLoader_() {
  var loader = document.getElementById("central-loader");
  if (!loader) return;

  if (centralLoaderRevealTimeout) {
    clearTimeout(centralLoaderRevealTimeout);
    centralLoaderRevealTimeout = 0;
  }

  if (centralLoaderHideTimeout) {
    clearTimeout(centralLoaderHideTimeout);
    centralLoaderHideTimeout = 0;
  }

  if (!centralLoaderBootStartedAt) {
    centralLoaderBootStartedAt = Date.now();
  }

  loader.classList.remove("is-hidden", "is-revealing", "is-collapsing");
  loader.setAttribute("aria-busy", "true");
  loader.setAttribute("aria-hidden", "false");
  centralLoaderVisible = true;
}

function isCentralLoaderVisible_() {
  var loader = document.getElementById("central-loader");
  return !!loader && centralLoaderVisible &&
    !loader.classList.contains("is-hidden");
}

function hideCentralLoader_(immediate) {
  var loader = document.getElementById("central-loader");
  if (!loader) return;

  stopCentralLoaderTrickle_();

  if (centralLoaderRevealTimeout) {
    clearTimeout(centralLoaderRevealTimeout);
    centralLoaderRevealTimeout = 0;
  }

  if (centralLoaderHideTimeout) {
    clearTimeout(centralLoaderHideTimeout);
    centralLoaderHideTimeout = 0;
  }

  if (immediate) {
    loader.classList.remove("is-revealing", "is-collapsing");
    loader.classList.add("is-hidden");
    loader.setAttribute("aria-busy", "false");
    loader.setAttribute("aria-hidden", "true");
    centralLoaderVisible = false;
    centralLoaderBootStartedAt = 0;
    return;
  }

  if (!centralLoaderVisible || loader.classList.contains("is-hidden")) {
    return;
  }

  centralLoaderVisible = false;
  loader.classList.add("is-collapsing");

  centralLoaderRevealTimeout = window.setTimeout(function() {
    centralLoaderRevealTimeout = 0;
    loader.classList.add("is-revealing");

    centralLoaderHideTimeout = window.setTimeout(function() {
      loader.classList.add("is-hidden");
      loader.setAttribute("aria-busy", "false");
      loader.setAttribute("aria-hidden", "true");
      centralLoaderBootStartedAt = 0;
      centralLoaderHideTimeout = 0;
    }, CENTRAL_LOADER_DOOR_MS);
  }, CENTRAL_LOADER_COLLAPSE_MS);
}

function setLoadingMessage(message, detail, progress) {
  showCentralLoader_();

  var titleEl = document.getElementById("central-loader-title");
  var detailEl = document.getElementById("central-loader-detail");

  if (titleEl) {
    titleEl.textContent = String(message || "Loading CrossPointe Central...");
  }

  if (detailEl) {
    detailEl.textContent = String(
        detail || "Pulling in the latest Sunday details, events, and resources.",
    );
  }

  if (typeof progress === "number") {
    setCentralLoaderProgress_(progress);
  }
}

function setCentralLoaderProgress_(value) {
  centralLoaderProgressTarget = Math.max(
      0,
      Math.min(100, Number(value) || 0),
  );

  if (!centralLoaderAnimationFrame) {
    centralLoaderAnimationFrame = window.requestAnimationFrame(
        animateCentralLoaderProgress_,
    );
  }
}

function animateCentralLoaderProgress_() {
  var diff = centralLoaderProgressTarget - centralLoaderProgressValue;

  if (Math.abs(diff) < 0.35) {
    centralLoaderProgressValue = centralLoaderProgressTarget;
  } else {
    centralLoaderProgressValue += (diff * 0.18) + (diff > 0 ? 0.24 : -0.24);

    if (diff > 0 && centralLoaderProgressValue > centralLoaderProgressTarget) {
      centralLoaderProgressValue = centralLoaderProgressTarget;
    }

    if (diff < 0 && centralLoaderProgressValue < centralLoaderProgressTarget) {
      centralLoaderProgressValue = centralLoaderProgressTarget;
    }
  }

  updateCentralLoaderUi_();

  if (Math.abs(centralLoaderProgressTarget - centralLoaderProgressValue) >= 0.1) {
    centralLoaderAnimationFrame = window.requestAnimationFrame(
        animateCentralLoaderProgress_,
    );
    return;
  }

  centralLoaderAnimationFrame = 0;
}

function updateCentralLoaderUi_() {
  var loader = document.getElementById("central-loader");
  if (!loader) return;

  var progress = Math.max(0, Math.min(100, centralLoaderProgressValue));
  var progressText = Math.round(progress) + "%";
  var progressValue = progress.toFixed(2) + "%";
  var progressRatio = (progress / 100).toFixed(3);
  var percentEl = document.getElementById("central-loader-percent");
  var barEl = document.getElementById("central-loader-bar");

  loader.style.setProperty("--central-loader-progress", progressValue);
  loader.style.setProperty("--central-loader-progress-ratio", progressRatio);

  if (barEl) {
    barEl.style.width = progressValue;
  }

  if (percentEl) {
    percentEl.textContent = progressText;
  }

  syncCentralLoaderDots_(loader, progress);
}

function getCentralLoaderDotCount_(progress) {
  var clamped = Math.max(0, Math.min(100, Number(progress) || 0));
  var visibleCount = Math.floor(((clamped / 100) * 6) + 0.0001);

  if (clamped >= 99.95) {
    visibleCount = 6;
  }

  return Math.max(0, Math.min(6, visibleCount));
}

function syncCentralLoaderDots_(loader, progress) {
  if (!loader) return;

  var orbit = loader.querySelector(".central-loader-orbit");
  var dots = loader.querySelectorAll(".central-loader-dot");
  var visibleCount = getCentralLoaderDotCount_(progress);

  if (orbit) {
    orbit.setAttribute("data-dot-count", String(visibleCount));
  }

  dots.forEach(function(dotEl, index) {
    dotEl.classList.toggle("is-visible", index < visibleCount);
  });
}

function startCentralLoaderTrickle_(maxProgress) {
  stopCentralLoaderTrickle_();

  var ceiling = Math.max(0, Math.min(96, Number(maxProgress) || 82));

  centralLoaderTrickleInterval = window.setInterval(function() {
    if (!isCentralLoaderVisible_()) return;
    if (centralLoaderProgressTarget >= ceiling) return;

    setCentralLoaderProgress_(Math.min(
        ceiling,
        centralLoaderProgressTarget + 2 + (Math.random() * 3.2),
    ));
  }, 360);
}

function stopCentralLoaderTrickle_() {
  if (!centralLoaderTrickleInterval) return;

  clearInterval(centralLoaderTrickleInterval);
  centralLoaderTrickleInterval = 0;
}

function finalizeCentralLoader_() {
  if (!isCentralLoaderVisible_()) return;

  stopCentralLoaderTrickle_();
  setLoadingMessage(
      "Central Is Ready",
      "Opening the doors to everything happening at CrossPointe.",
      100,
  );

  if (centralLoaderRevealTimeout) {
    clearTimeout(centralLoaderRevealTimeout);
  }

  var visibleDurationMs = Date.now() - (centralLoaderBootStartedAt || Date.now());
  var waitMs = Math.max(260, 980 - visibleDurationMs);

  centralLoaderRevealTimeout = window.setTimeout(function() {
    window.requestAnimationFrame(function() {
      window.requestAnimationFrame(function() {
        hideCentralLoader_(false);
      });
    });
  }, waitMs);
}

function getResponsiveWidth() {
  return Math.min(
      window.innerWidth || 9999,
      document.documentElement.clientWidth || 9999,
      screen.width || 9999,
  );
}

function isMobileLayout() {
  return getResponsiveWidth() <= 900;
}

function getVisibleLimit(desktopLimit) {
  return isMobileLayout() ? 3 : desktopLimit;
}

function applyResponsiveMode() {
  document.body.classList.toggle("central-mobile", isMobileLayout());
}

async function loadCentralData() {
  if (document.activeElement && document.activeElement.id === "sunday-notes-input") {
    return;
  }

  if (!currentCentralData) {
    setLoadingMessage(
        "Loading CrossPointe Central...",
        "Pulling in events, Sunday details, resources, and fresh updates.",
        34,
    );
    startCentralLoaderTrickle_(84);
  }

  try {
    var response = await fetch(CENTRAL_API_URL, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    var data = applyHostedPublicWhatsNewOverride_(
        await parseJsonResponse_(response),
    );
    stopCentralLoaderTrickle_();

    if (isCentralLoaderVisible_()) {
      setLoadingMessage(
          "Building Central...",
          "Putting everything in place for you now.",
          88,
      );
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || "Could not load Central.");
    }

    saveCentralCache_(data || {});
    renderCentral(data || {});
  } catch (error) {
    stopCentralLoaderTrickle_();

    if (currentCentralData || restoreCentralFromCache_(true)) {
      console.warn("Central refresh failed, using cached content.", error);
      return;
    }

    showError(error);
  }
}

function restoreCentralFromCache_(skipIfExpired) {
  try {
    var raw = localStorage.getItem(CENTRAL_CACHE_KEY);
    if (!raw) return false;

    var cached = JSON.parse(raw);
    if (!cached || !cached.data || !cached.savedAt) return false;

    var age = Date.now() - Number(cached.savedAt || 0);
    if (age > CENTRAL_CACHE_MAX_AGE_MS) {
      if (!skipIfExpired) {
        localStorage.removeItem(CENTRAL_CACHE_KEY);
      }
      return false;
    }

    setLoadingMessage(
        "Opening Central...",
        "Showing saved content while we refresh the latest details.",
        68,
    );
    renderCentral(applyHostedPublicWhatsNewOverride_(cached.data));
    return true;
  } catch (error) {
    return false;
  }
}

function saveCentralCache_(data) {
  try {
    localStorage.setItem(CENTRAL_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      data: data,
    }));
  } catch (error) {
  }
}

async function parseJsonResponse_(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function loadHostedWhatsNewConfig_() {
  if (centralHostedWhatsNewConfigPromise) {
    return centralHostedWhatsNewConfigPromise;
  }

  centralHostedWhatsNewConfigPromise = fetch(CENTRAL_HOSTED_WHATS_NEW_URL, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })
      .then(function(response) {
        if (!response.ok) {
          throw new Error("Could not load the hosted what's-new config.");
        }

        return parseJsonResponse_(response);
      })
      .then(function(payload) {
        centralHostedWhatsNewConfig =
          payload && typeof payload === "object" ? payload : {};
        return centralHostedWhatsNewConfig;
      })
      .catch(function(error) {
        console.warn(
            "Hosted what's-new config unavailable, using Firestore fallback.",
            error,
        );
        centralHostedWhatsNewConfig = null;
        return null;
      });

  return centralHostedWhatsNewConfigPromise;
}

function applyHostedPublicWhatsNewOverride_(data) {
  var nextData = data && typeof data === "object" ? data : {};

  if (!hasHostedWhatsNewOverride_(centralHostedWhatsNewConfig, "public")) {
    return nextData;
  }

  return Object.assign({}, nextData, {
    whatsNew: normalizeHostedWhatsNewSection_(
        centralHostedWhatsNewConfig.public,
    ),
  });
}

function hasHostedWhatsNewOverride_(config, key) {
  var source = config && typeof config === "object" ? config : {};
  var section = Object.prototype.hasOwnProperty.call(source, key) ?
    source[key] :
    null;

  if (!section || typeof section !== "object") {
    return false;
  }

  return isTruthyHostedWhatsNewValue_(
      getHostedWhatsNewValue_(section, [
        "enabled",
        "use_hosted",
        "useHosted",
      ]),
  );
}

function normalizeHostedWhatsNewSection_(source) {
  var data = source && typeof source === "object" ? source : {};

  return {
    active: isTruthyHostedWhatsNewValue_(
        getHostedWhatsNewValue_(data, ["active", "isActive"]),
    ) ? "TRUE" : "FALSE",
    force_show: isTruthyHostedWhatsNewValue_(
        getHostedWhatsNewValue_(data, [
          "force_show",
          "forceShow",
          "force_every_time",
          "forceEveryTime",
        ]),
    ) ? "TRUE" : "FALSE",
    version: normalizeHostedWhatsNewText_(
        getHostedWhatsNewValue_(data, [
          "version",
          "release",
          "releaseVersion",
        ]),
    ),
    title: normalizeHostedWhatsNewText_(
        getHostedWhatsNewValue_(data, ["title", "heading"]),
    ),
    message: normalizeHostedWhatsNewText_(
        getHostedWhatsNewValue_(data, [
          "message",
          "body",
          "content",
          "markdown",
        ]),
    ),
    button_text: normalizeHostedWhatsNewText_(
        getHostedWhatsNewValue_(data, [
          "button_text",
          "buttonText",
          "testing_button_text",
          "testingButtonText",
          "cta_text",
          "ctaText",
        ]),
    ),
    source: "Hosted file",
  };
}

function getHostedWhatsNewValue_(source, keys) {
  var data = source && typeof source === "object" ? source : {};
  var keyList = Array.isArray(keys) ? keys : [];
  var index;
  var key;

  for (index = 0; index < keyList.length; index += 1) {
    key = keyList[index];

    if (Object.prototype.hasOwnProperty.call(data, key) &&
      data[key] !== undefined &&
      data[key] !== null) {
      return data[key];
    }
  }

  return "";
}

function normalizeHostedWhatsNewText_(value) {
  return String(value || "").trim();
}

function isTruthyHostedWhatsNewValue_(value) {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes", "on"].indexOf(
      String(value || "").trim().toLowerCase(),
  ) !== -1;
}

function renderCentral(data) {
  currentCentralData = data || {};
  removeWhatsNewModal_();
  teardownSundayStreamMiniPlayer_();
  teardownSundayScripture_();
  removeEventDetailsModal_();
  eventDetailItemsByKey = {};
  eventDetailKeyCounter = 0;
  serveNeedInterestItemsByKey = {};
  serveNeedInterestKeyCounter = 0;

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (data.sundayMode && data.sundayMode.enabled) {
    document.getElementById("app").innerHTML = renderSundayPage(data);
    syncCentralThemeToggleUi_(getResolvedCentralTheme_());
    initSundayStreamMiniPlayer_();
    initSundayNotes(data);
    initSundayScripture(data);
    syncSundayNotesSaveButton_(data);
    maybeShowWhatsNew_(data);
    finalizeCentralLoader_();
    return;
  }

  var s = data.settings || {};
  var homepageModules = normalizeCentralModuleConfig_(
      s.homepage_modules,
      HOMEPAGE_MODULE_DEFINITIONS,
  );
  var featuredEventCard = renderFeaturedEventHeroCard_(data, s);

  document.getElementById("app").innerHTML = [
    "<div class=\"central\">",
      "<header class=\"hero", featuredEventCard ? " hero-featured-event" : "", "\">",
        "<div class=\"wrap\">",
          "<div class=\"hero-topbar\">",
            "<div class=\"eyebrow\">",
              "<span class=\"eyebrow-dot\"></span>",
              escapeHtml(s.site_title || "CrossPointe Central"),
            "</div>",
            renderThemeToggle_(),
          "</div>",
          "<div class=\"hero-grid\">",
            "<div>",
              "<h1>" + escapeHtml(s.hero_heading || "Your hub for everything CrossPointe") + "</h1>",
              "<p>" + escapeHtml(s.hero_subheading || "") + "</p>",
              "<div class=\"hero-actions\">",
                button(s.primary_button_text, s.primary_button_url, "btn-primary"),
                button(s.secondary_button_text, s.secondary_button_url, "btn-secondary"),
              "</div>",
            "</div>",
            featuredEventCard || renderHomepageCountdownCard_(s),
          "</div>",
        "</div>",
      "</header>",
      "<div class=\"content\">",
        "<div class=\"wrap\">",
          renderConfiguredCentralModules_(homepageModules, function(moduleId) {
            return renderHomepageModuleById_(moduleId, data);
          }),
        "</div>",
      "</div>",
      renderPublicFooter_(),
    "</div>",
  ].join("");

  syncCentralThemeToggleUi_(getResolvedCentralTheme_());
  startCountdown();
  maybeShowWhatsNew_(data);
  finalizeCentralLoader_();
}

function renderHomepageCountdownCard_(settings) {
  var s = settings || {};

  return [
    "<div class=\"countdown-card\">",
      "<small>" + escapeHtml(s.countdown_label || "Next Up") + "</small>",
      "<strong>" + escapeHtml(s.countdown_title || "Sunday Worship") + "</strong>",
      "<p id=\"central-countdown\" data-countdown-datetime=\"" +
        escapeAttr(s.countdown_datetime || "") +
        "\">Loading countdown...</p>",
    "</div>",
  ].join("");
}

function renderFeaturedEventHeroCard_(data, settings) {
  var featuredEvent = getFeaturedEventContext_(data, settings);
  if (!featuredEvent) return "";

  var eventKey = featuredEvent.eventKey;
  var title = featuredEvent.title;
  var imageUrl = featuredEvent.imageUrl;
  var schedule = featuredEvent.schedule;
  var doorsOpenTime = featuredEvent.doorsOpenTime;

  return [
    "<article class=\"featured-event-card\" aria-labelledby=\"featured-event-title\">",
      "<div class=\"featured-event-media\">",
        "<img src=\"", escapeAttr(imageUrl),
          "\" alt=\"\" loading=\"eager\" fetchpriority=\"high\">",
      "</div>",
      "<div class=\"featured-event-body\">",
        "<div class=\"featured-event-copy\">",
          "<span class=\"featured-event-badge\">Featured Event</span>",
          "<h2 id=\"featured-event-title\">", escapeHtml(title), "</h2>",
          doorsOpenTime ?
            "<p class=\"featured-event-doors-open\"><strong>Doors Open:</strong> " +
              escapeHtml(doorsOpenTime) + "</p>" : "",
          schedule ?
            "<p class=\"featured-event-schedule\">" +
              escapeHtml(schedule) + "</p>" : "",
        "</div>",
        "<button type=\"button\" class=\"btn btn-primary featured-event-cta\"",
          " onclick=\"openEventDetailsModal('",
          escapeJsString(eventKey),
          "')\">View Event</button>",
      "</div>",
    "</article>",
  ].join("");
}

function getFeaturedEventContext_(data, settings) {
  var enabled = normalizeCentralBooleanValue_(
      settings && settings.featured_event_enabled,
      false,
  );
  var item = data && data.featuredEvent ? data.featuredEvent : null;
  var title = String(item && item.title || "").trim();
  var imageUrl = String(item && item.image_url || "").trim();

  if (!enabled || !item || !title || !/^https:\/\//i.test(imageUrl)) {
    return "";
  }

  var eventKey = registerEventDetailsItem_(item);
  if (!eventKey) return null;

  return {
    item: item,
    eventKey: eventKey,
    title: title,
    imageUrl: imageUrl,
    schedule: [item.date, item.time].filter(Boolean).join(" • "),
    doorsOpenTime: String(item.doors_open_time || "").trim(),
  };
}

function renderSundayFeaturedEventCard_(data, settings) {
  var featuredEvent = getFeaturedEventContext_(data, settings);
  if (!featuredEvent) return "";

  return [
    "<article class=\"featured-event-card sunday-featured-event-card\"",
      " aria-labelledby=\"sunday-featured-event-title\">",
      "<div class=\"featured-event-media\">",
        "<img src=\"", escapeAttr(featuredEvent.imageUrl),
          "\" alt=\"\" loading=\"eager\" fetchpriority=\"high\">",
      "</div>",
      "<div class=\"featured-event-body\">",
        "<div class=\"featured-event-copy\">",
          "<span class=\"featured-event-badge\">Featured Event</span>",
          "<h2 id=\"sunday-featured-event-title\">",
            escapeHtml(featuredEvent.title),
          "</h2>",
          featuredEvent.doorsOpenTime ?
            "<p class=\"featured-event-doors-open\"><strong>Doors Open:</strong> " +
              escapeHtml(featuredEvent.doorsOpenTime) + "</p>" : "",
          featuredEvent.schedule ?
            "<p class=\"featured-event-schedule\">" +
              escapeHtml(featuredEvent.schedule) + "</p>" : "",
        "</div>",
        "<button type=\"button\" class=\"btn btn-primary featured-event-cta\"",
          " aria-label=\"View featured event: ",
          escapeAttr(featuredEvent.title), "\"",
          " onclick=\"openEventDetailsModal('",
          escapeJsString(featuredEvent.eventKey),
          "')\">View Event</button>",
      "</div>",
    "</article>",
  ].join("");
}

function normalizeCentralModuleConfig_(sourceItems, definitions) {
  var rawItems = Array.isArray(sourceItems) ? sourceItems : [];
  var definitionOrder = {};
  var definitionDefaults = {};
  var normalizedItems = [];
  var seenIds = {};

  (definitions || []).forEach(function(definition, index) {
    definitionOrder[definition.id] = index;
    definitionDefaults[definition.id] = definitionDefaultEnabled_(definition);
  });

  rawItems.forEach(function(item) {
    var moduleId = String(item && item.id || "").trim();
    if (!moduleId ||
      !Object.prototype.hasOwnProperty.call(definitionOrder, moduleId) ||
      seenIds[moduleId]) {
      return;
    }

    seenIds[moduleId] = true;
    normalizedItems.push({
      id: moduleId,
      enabled: item && item.enabled !== false && item.enabled !== "false",
      sort: Number.isFinite(Number(item && item.sort)) ?
        Number(item.sort) :
        ((definitionOrder[moduleId] + 1) * 10),
    });
  });

  (definitions || []).forEach(function(definition, index) {
    if (seenIds[definition.id]) {
      return;
    }

    seenIds[definition.id] = true;
    normalizedItems.push({
      id: definition.id,
      enabled: definitionDefaults[definition.id],
      sort: (index + 1) * 10,
    });
  });

  return normalizedItems.sort(function(leftItem, rightItem) {
    var leftSort = Number(leftItem && leftItem.sort);
    var rightSort = Number(rightItem && rightItem.sort);
    var leftOrder = definitionOrder[leftItem.id];
    var rightOrder = definitionOrder[rightItem.id];

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    if (leftItem.enabled !== rightItem.enabled) {
      return leftItem.enabled ? -1 : 1;
    }

    return leftOrder - rightOrder;
  }).map(function(item, index) {
    return {
      id: item.id,
      enabled: item.enabled !== false,
      sort: (index + 1) * 10,
    };
  });
}

function definitionDefaultEnabled_(definition) {
  return !definition || definition.defaultEnabled !== false;
}

function renderConfiguredCentralModules_(modules, renderModule) {
  return (Array.isArray(modules) ? modules : [])
      .filter(function(moduleItem) {
        return moduleItem && moduleItem.enabled !== false;
      })
      .map(function(moduleItem) {
        return typeof renderModule === "function" ?
          renderModule(moduleItem.id) :
          "";
      })
      .join("");
}

function renderHomepageModuleById_(moduleId, data) {
  if (moduleId === "statusBanner") {
    return renderBanner(data.banner);
  }

  if (moduleId === "today") {
    return renderToday(data.today || []);
  }

  if (moduleId === "sunday") {
    return renderSunday(data.sunday || {}, data.setlist || []);
  }

  if (moduleId === "events") {
    return renderEvents(data.events || []);
  }

  if (moduleId === "registrations") {
    return renderRegistrations(data.registrations || []);
  }

  if (moduleId === "campaigns") {
    return renderCampaigns(data.campaigns || []);
  }

  if (moduleId === "nextSteps") {
    return renderNextSteps(data.nextSteps || []);
  }

  if (moduleId === "serveNeeds") {
    return renderServeNeeds(data.serveNeeds || []);
  }

  if (moduleId === "resources") {
    return renderResources(data.resources || []);
  }

  if (moduleId === "quickLinks") {
    return renderQuickLinks(data.quickLinks || []);
  }

  return "";
}

function renderSundayModeModuleById_(moduleId, data, quickLinks, services, serviceNames, sundaySettings, sundayMode, sunday) {
  if (moduleId === "quickActions") {
    return renderSundayQuickActions(quickLinks);
  }

  if (moduleId === "sermonWorship") {
    return [
      "<section class=\"section\">",
        "<div class=\"section-head\">",
          "<div>",
            "<div class=\"section-kicker\">This Morning</div>",
            "<h2 class=\"section-title\">Sermon + Worship</h2>",
          "</div>",
        "</div>",
        "<div class=\"grid two sunday-focus-grid\">",
          "<article class=\"card sunday-sermon-card featured\">",
            "<span class=\"pill\">" + escapeHtml(sunday.date || "Sunday") + "</span>",
            "<h3>" + escapeHtml(sunday.sermon_title || "Sunday Worship") + "</h3>",
            "<div class=\"sunday-detail-list\">",
              sunday.series ? "<div><strong>Series</strong><span>" + escapeHtml(sunday.series) + "</span></div>" : "",
              sunday.speaker ? "<div><strong>Speaker</strong><span>" + escapeHtml(sunday.speaker) + "</span></div>" : "",
              sunday.scripture ? "<div><strong>Scripture</strong><span>" + escapeHtml(sunday.scripture) + "</span></div>" : "",
            "</div>",
            sunday.note ? "<p>" + escapeHtml(sunday.note) + "</p>" : "",
          "</article>",
          renderAnimatedSetlistCard(serviceNames, services),
        "</div>",
      "</section>",
    ].join("");
  }

  if (moduleId === "watchLive") {
    var livestreamCard = renderSundayLivestream(sundaySettings);
    if (!livestreamCard) {
      return "";
    }

    return [
      "<section class=\"section\">",
        "<div class=\"section-head\">",
          "<div>",
            "<div class=\"section-kicker\">Join Online</div>",
            "<h2 class=\"section-title\">Watch Live</h2>",
          "</div>",
        "</div>",
        livestreamCard,
      "</section>",
    ].join("");
  }

  if (moduleId === "scriptureNotes") {
    return [
      "<section class=\"section sunday-study-section\" id=\"notes\">",
        "<div class=\"section-head\">",
          "<div>",
            "<div class=\"section-kicker\">One-Tap Study</div>",
            "<h2 class=\"section-title\">Scripture + Sermon Notes</h2>",
          "</div>",
        "</div>",
        "<div class=\"grid two sunday-notes-scripture-grid\">",
          renderSundayScriptureCard(sunday, sundaySettings),
          "<article class=\"card sunday-notes-card\">",
            "<h3 class=\"sunday-card-title\">Sermon Notes</h3>",
            "<p class=\"sunday-notes-copy\">Take notes as you listen to the sermon, keep today’s Scripture open beside you, and let these three questions guide what God may be saying to you today.</p>",
            "<div class=\"sunday-prompt-row\">",
              (sundayMode.prompts || []).map(function(prompt) {
                return "<span class=\"sunday-prompt-chip\">" + escapeHtml(prompt) + "</span>";
              }).join(""),
            "</div>",
            "<div class=\"sunday-notes-toolbar\" aria-label=\"Notes formatting\">",
              "<button type=\"button\" class=\"notes-format-btn\" data-format=\"bold\" aria-pressed=\"false\" onmousedown=\"return false;\" onclick=\"formatSundayNotes('bold')\"><strong>Bold</strong></button>",
              "<button type=\"button\" class=\"notes-format-btn\" data-format=\"italic\" aria-pressed=\"false\" onmousedown=\"return false;\" onclick=\"formatSundayNotes('italic')\"><em>Italic</em></button>",
              "<button type=\"button\" class=\"notes-format-btn\" data-format=\"bullets\" aria-pressed=\"false\" onmousedown=\"return false;\" onclick=\"formatSundayNotes('bullets')\">Bullets</button>",
              "<button type=\"button\" class=\"notes-format-btn\" data-format=\"numbered\" aria-pressed=\"false\" onmousedown=\"return false;\" onclick=\"formatSundayNotes('numbered')\">Numbered</button>",
            "</div>",
            "<div id=\"sunday-notes-input\" class=\"sunday-notes-input\" contenteditable=\"true\" spellcheck=\"true\" role=\"textbox\" aria-multiline=\"true\" data-placeholder=\"Write notes, verses, prayer points, and action steps here...\"></div>",
            "<div class=\"sunday-notes-tools\">",
              renderSundayNotesGoogleDocsControls_(data),
              "<button class=\"see-more-btn\" type=\"button\" onclick=\"copySundayNotes()\">Copy Notes</button>",
              "<button class=\"see-more-btn sunday-clear-btn\" type=\"button\" onclick=\"clearSundayNotes()\">Clear Notes</button>",
              "<span class=\"sunday-notes-status\" id=\"sunday-notes-status\">Saved on this device</span>",
            "</div>",
          "</article>",
        "</div>",
      "</section>",
    ].join("");
  }

  if (moduleId === "today") {
    return renderToday(data.today || []);
  }

  if (moduleId === "events") {
    return renderEvents(data.events || []);
  }

  if (moduleId === "registrations") {
    return renderRegistrations(data.registrations || []);
  }

  if (moduleId === "campaigns") {
    return renderCampaigns(data.campaigns || []);
  }

  if (moduleId === "nextSteps") {
    return renderNextSteps(data.nextSteps || []);
  }

  if (moduleId === "serveNeeds") {
    return renderServeNeeds(data.serveNeeds || []);
  }

  if (moduleId === "resources") {
    return renderResources(data.resources || []);
  }

  return "";
}

function renderSundayNotesGoogleDocsControls_(data) {
  var googleDocsConfig = getGoogleNotesConfig_(data);

  if (!googleDocsConfig.enabled || !googleDocsConfig.clientId) {
    return "";
  }

  return [
    "<button type=\"button\" class=\"see-more-btn\" id=\"save-notes-doc-btn\" onclick=\"saveSundayNotesToMyGoogleDocs()\">Save to My Google Docs</button>",
    "<a class=\"see-more-btn\" id=\"open-notes-doc-link\" href=\"#\" target=\"_blank\" rel=\"noopener\" hidden>Open My Google Doc</a>",
  ].join("");
}

function maybeShowWhatsNew_(data) {
  var whatsNew = data && data.whatsNew ? data.whatsNew : {};
  var isActive = String(whatsNew.active || "").toLowerCase() === "true";
  var forceShow = String(
      whatsNew.force_show || whatsNew.force_every_time || "",
  ).toLowerCase() === "true";
  var version = String(whatsNew.version || "").trim();
  var message = String(whatsNew.message || "").trim();

  if (!isActive || !message) return;
  if (!forceShow && !version) return;
  if (!forceShow && readSeenWhatsNewVersion_() === version) return;

  if (!forceShow) {
    markWhatsNewSeen_(version);
  }

  showWhatsNewModal_({
    version: forceShow ? (version || "Testing") : version,
    title: String(whatsNew.title || "").trim() || "What's New In Central",
    message: message,
    buttonText: String(
        whatsNew.button_text || whatsNew.testing_button_text || "",
    ).trim() || "Sounds Good",
  });
}

function readSeenWhatsNewVersion_() {
  try {
    return localStorage.getItem(CENTRAL_WHATS_NEW_SEEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

function markWhatsNewSeen_(version) {
  try {
    localStorage.setItem(CENTRAL_WHATS_NEW_SEEN_KEY, String(version || ""));
  } catch (error) {
  }
}

function showWhatsNewModal_(config) {
  removeWhatsNewModal_();

  var modal = document.createElement("div");
  modal.id = "central-whats-new-modal";
  modal.className = "whats-new-modal";
  modal.innerHTML = [
    "<div class=\"whats-new-backdrop\" data-whats-new-close=\"true\"></div>",
    "<div class=\"whats-new-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"whats-new-title\">",
      "<button type=\"button\" class=\"whats-new-close\" aria-label=\"Close what's new\" data-whats-new-close=\"true\">&times;</button>",
      "<div class=\"whats-new-kicker\">What's New</div>",
      "<div class=\"whats-new-version\">Version " + escapeHtml(config.version || "") + "</div>",
      "<h2 class=\"whats-new-title\" id=\"whats-new-title\">" + escapeHtml(config.title || "What's New In Central") + "</h2>",
      "<div class=\"whats-new-body\">" + renderMarkdownLite_(config.message || "") + "</div>",
      "<div class=\"whats-new-actions\">",
        "<button type=\"button\" class=\"see-more-btn whats-new-confirm\" data-whats-new-close=\"true\">" + escapeHtml(config.buttonText || "Sounds Good") + "</button>",
      "</div>",
    "</div>",
  ].join("");

  modal.addEventListener("click", function(event) {
    var closeTrigger = event.target.closest("[data-whats-new-close=\"true\"]");
    if (closeTrigger) {
      closeWhatsNewModal_();
    }
  });

  whatsNewEscapeHandler = function(event) {
    if (event.key === "Escape") {
      closeWhatsNewModal_();
    }
  };

  document.addEventListener("keydown", whatsNewEscapeHandler);
  document.body.classList.add("modal-open");
  document.body.appendChild(modal);
}

function closeWhatsNewModal_() {
  var modal = document.getElementById("central-whats-new-modal");
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }

  if (whatsNewEscapeHandler) {
    document.removeEventListener("keydown", whatsNewEscapeHandler);
    whatsNewEscapeHandler = null;
  }

  document.body.classList.remove("modal-open");
}

function removeWhatsNewModal_() {
  closeWhatsNewModal_();
}

function renderMarkdownLite_(value) {
  var normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  var lines = normalized.split("\n");
  var html = [];
  var paragraphLines = [];
  var listLines = [];

  var flushParagraph = function() {
    if (!paragraphLines.length) return;

    html.push(
        "<p>" +
        renderMarkdownInline_(paragraphLines.join("\n")).replace(/\n/g, "<br>") +
        "</p>",
    );
    paragraphLines = [];
  };

  var flushList = function() {
    if (!listLines.length) return;
    html.push(renderMarkdownListCollectionHtml_(parseMarkdownListBlocks_(listLines)));
    listLines = [];
  };

  lines.forEach(function(rawLine) {
    var line = String(rawLine || "");
    var trimmedLine = line.trim();
    var headingMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);
    var listMatch = parseMarkdownListLine_(line);

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    if (headingMatch) {
      flushParagraph();
      flushList();
      html.push(
          "<h3 class=\"whats-new-heading level-" + headingMatch[1].length + "\">" +
          renderMarkdownInline_(headingMatch[2]) +
          "</h3>",
      );
      return;
    }

    if (listMatch) {
      flushParagraph();
      listLines.push(line);
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  return html.join("");
}

function parseMarkdownListLine_(line) {
  var match = String(line || "").match(/^([ \t]*)([-*]|\d+\.)\s+(.*)$/);
  if (!match) return null;

  return {
    indent: getMarkdownIndentWidth_(match[1]),
    type: /^\d+\.$/.test(match[2]) ? "ol" : "ul",
    text: match[3],
  };
}

function getMarkdownIndentWidth_(value) {
  return String(value || "").replace(/\t/g, "  ").length;
}

function parseMarkdownListBlocks_(lines) {
  var tokens = (lines || []).map(parseMarkdownListLine_).filter(Boolean);
  if (!tokens.length) return [];

  var index = 0;

  var parseListsAtIndent = function(expectedIndent) {
    var lists = [];
    var currentList = null;

    while (index < tokens.length) {
      var token = tokens[index];

      if (token.indent < expectedIndent) {
        break;
      }

      if (token.indent > expectedIndent) {
        if (!currentList || !currentList.items.length) {
          token.indent = expectedIndent;
        } else {
          currentList.items[currentList.items.length - 1].children =
            currentList.items[currentList.items.length - 1].children.concat(
                parseListsAtIndent(token.indent),
            );
          continue;
        }
      }

      if (!currentList || currentList.type !== token.type) {
        currentList = {
          type: token.type,
          items: [],
        };
        lists.push(currentList);
      }

      currentList.items.push({
        text: token.text,
        children: [],
      });
      index += 1;

      while (index < tokens.length && tokens[index].indent > expectedIndent) {
        currentList.items[currentList.items.length - 1].children =
          currentList.items[currentList.items.length - 1].children.concat(
              parseListsAtIndent(tokens[index].indent),
          );
      }
    }

    return lists;
  };

  return parseListsAtIndent(tokens[0].indent);
}

function renderMarkdownListCollectionHtml_(lists) {
  return (lists || []).map(function(list) {
    return "<" + list.type + ">" +
      (list.items || []).map(function(item) {
        return "<li>" +
          renderMarkdownInline_(item.text || "") +
          renderMarkdownListCollectionHtml_(item.children || []) +
          "</li>";
      }).join("") +
      "</" + list.type + ">";
  }).join("");
}

function renderMarkdownInline_(value) {
  var html = escapeHtml(value || "");

  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n][\s\S]*?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return html;
}

function renderSundayPage(data) {
  var s = data.settings || {};
  var sunday = data.sunday || {};
  var sundayMode = data.sundayMode || {};
  var sundaySettings = data.sundaySettings || {};
  var quickLinks = data.quickLinks || [];
  var services = groupBy(data.setlist || [], "service");
  var serviceNames = Object.keys(services);
  var sundayModules = normalizeCentralModuleConfig_(
      sundaySettings.sunday_modules,
      SUNDAY_MODE_MODULE_DEFINITIONS,
  );

  var watchLink = findSundayLink(quickLinks, /(watch|live|stream)/i);
  var fallbackSecondaryText = watchLink ? watchLink.title : (s.primary_button_text || "Open Church Center");
  var fallbackSecondaryUrl = watchLink ? watchLink.url : (s.primary_button_url || "");
  var heroStatus = sundayMode.status || {};
  var dynamicSubheading = [heroStatus.title, heroStatus.detail].filter(Boolean).join(" ");

  var eyebrowText =
    sundaySettings.sunday_eyebrow ||
    sundaySettings.sunday_eyebrow_live ||
    sundaySettings.sunday_eyebrow_test ||
    "Sunday Morning";

  var heroHeading =
    sundaySettings.sunday_heading ||
    sundaySettings.sunday_heading_live ||
    sundaySettings.sunday_heading_test ||
    "Everything you need for this morning.";

  var heroSubheading =
    sundaySettings.sunday_subheading ||
    dynamicSubheading ||
    "Welcome to CrossPointe Sunday morning.";

  var primaryButtonText = sundaySettings.sunday_primary_button_text || "Take Notes";
  var primaryButtonUrl = sundaySettings.sunday_primary_button_url || "#notes";

  var secondaryButtonText = sundaySettings.sunday_secondary_button_text || fallbackSecondaryText;
  var secondaryButtonUrl = sundaySettings.sunday_secondary_button_url || fallbackSecondaryUrl;

  var speakerLabel = sundaySettings.sunday_speaker_label || "Speaker";
  var scriptureLabel = sundaySettings.sunday_scripture_label || "Scripture";
  var scriptureReference = String(
      sundaySettings.sunday_scripture_reference || sunday.scripture || "",
  ).trim();
  var featuredEventCard = renderSundayFeaturedEventCard_(data, s);

  return [
    "<div class=\"central sunday-experience\">",
      "<header class=\"sunday-hero\">",
        "<div class=\"wrap\">",
          "<div class=\"sunday-badge-row\">",
            "<span class=\"eyebrow\">",
              "<span class=\"eyebrow-dot\"></span>",
              escapeHtml(eyebrowText),
            "</span>",
            "<div class=\"sunday-badge-actions\">",
              renderThemeToggle_(),
              "<span class=\"sunday-status-pill " + escapeAttr(heroStatus.tone || "") + "\">",
                escapeHtml(heroStatus.badge || "Sunday Mode"),
              "</span>",
            "</div>",
          "</div>",
          "<h1>" + escapeHtml(heroHeading) + "</h1>",
          "<p>" + escapeHtml(heroSubheading) + "</p>",
          "<div class=\"hero-actions\">",
            button(primaryButtonText, primaryButtonUrl, "btn-primary"),
            button(secondaryButtonText, secondaryButtonUrl, "btn-secondary"),
          "</div>",
          "<div class=\"sunday-status-grid\">",
            "<article class=\"sunday-status-card\">",
              "<small>" + escapeHtml(speakerLabel) + "</small>",
              "<strong>" + escapeHtml(sunday.speaker || "CrossPointe") + "</strong>",
              "<span>" + escapeHtml(sunday.series || "Sunday Worship") + "</span>",
            "</article>",
            scriptureReference ?
              [
                "<article class=\"sunday-status-card\">",
                  "<small>" + escapeHtml(scriptureLabel) + "</small>",
                  "<strong>" + escapeHtml(scriptureReference) + "</strong>",
                  "<span>" + escapeHtml(sunday.date || "Sunday") + "</span>",
                "</article>",
              ].join("") :
              "",
            featuredEventCard,
          "</div>",
        "</div>",
      "</header>",
      "<div class=\"content sunday-content\">",
        "<div class=\"wrap\">",
          renderConfiguredCentralModules_(sundayModules, function(moduleId) {
            return renderSundayModeModuleById_(
                moduleId,
                data,
                quickLinks,
                services,
                serviceNames,
                sundaySettings,
                sundayMode,
                sunday,
            );
          }),
        "</div>",
      "</div>",
      renderPublicFooter_(),
    "</div>",
  ].join("");
}

function renderPublicFooter_() {
  return [
    "<footer class=\"public-footer\">",
      "<div class=\"wrap public-footer-wrap\">",
        "<nav class=\"public-footer-links\" aria-label=\"Footer links\">",
          "<a href=\"/about\">About Central</a>",
          "<a href=\"/terms\">Terms of Service</a>",
          "<a href=\"/privacy\">Privacy Policy</a>",
          "<a href=\"https://crosspointetv.churchcenter.com/people/forms/1262753\">Tell Us What You Think of Central</a>",
        "</nav>",
      "</div>",
    "</footer>",
  ].join("");
}

function renderSundayQuickActions(items) {
  var links = (items || []).filter(function(item) {
    return item && item.url;
  }).slice(0, 6);

  if (!links.length) return "";

  return [
    "<section class=\"section\">",
      "<div class=\"section-head\">",
        "<div>",
          "<div class=\"section-kicker\">Quick Actions</div>",
          "<h2 class=\"section-title\">Tap And Go</h2>",
        "</div>",
      "</div>",
      "<div class=\"sunday-actions-grid\">",
        links.map(function(item) {
          return [
            "<a class=\"sunday-action\" ", buildLinkAttrs_(item.url), ">",
              "<strong>", escapeHtml(item.title), "</strong>",
              "<span>Open now</span>",
            "</a>",
          ].join("");
        }).join(""),
      "</div>",
    "</section>",
  ].join("");
}

function renderBanner(banner) {
  if (!banner) return "";

  return [
    "<section class=\"banner\">",
      "<h2>", escapeHtml(banner.title), "</h2>",
      "<p>", escapeHtml(banner.message), "</p>",
      button(banner.button_text, banner.button_url, "btn-primary"),
    "</section>",
  ].join("");
}

function renderToday(items) {
  if (!items || !items.length) return "";
  var calendarIntegrationsEnabled = getCalendarIntegrationsEnabledValue_(
      currentCentralData,
  );

  return section("Today at CrossPointe", "Happening Now", renderExpandableGroup({
    id: "today-grid",
    items: items,
    containerClass: "grid two",
    moreLabel: "See More Today",
    lessLabel: "See Less Today",
    renderItem: function(item) {
      return card({
        title: item.title,
        meta: [item.time, item.location].filter(Boolean).join(" • "),
        description: "",
        buttonHtml: renderEventDetailsButton_(item),
        bottomButtonText: calendarIntegrationsEnabled ? "Add to Calendar" : "",
        bottomButtonUrl: calendarIntegrationsEnabled ? item.calendar_url : "",
        calendarFileUrl: item.calendar_file_url,
        extraClass: "event-card",
      });
    },
  }));
}

function renderSunday(sunday, setlist) {
  var services = groupBy(setlist || [], "service");
  var serviceNames = Object.keys(services);

  return section("This Sunday", "Worship + Word", [
    "<div class=\"grid two\">",
      "<article class=\"card sunday-card featured\">",
        "<span class=\"pill\">", escapeHtml((sunday && sunday.date) || "Sunday"), "</span>",
        "<h3>", escapeHtml((sunday && sunday.sermon_title) || "Sunday Worship"), "</h3>",
        "<p><strong>", escapeHtml((sunday && sunday.series) || ""), "</strong></p>",
        "<p>", escapeHtml((sunday && sunday.speaker) || ""), "</p>",
        "<p>", escapeHtml((sunday && sunday.scripture) || ""), "</p>",
        "<p>", escapeHtml((sunday && sunday.note) || ""), "</p>",
      "</article>",
      renderAnimatedSetlistCard(serviceNames, services),
    "</div>",
  ].join(""), "sunday");
}

function renderSundayLivestream(sundaySettings) {
  var streamUrl = String((sundaySettings && sundaySettings.sunday_livestream_url) || "").trim();

  if (!streamUrl) return "";

  return [
    "<article class=\"card sunday-stream-card\" id=\"live\">",
      "<div class=\"sunday-stream-copy\">",
        "<div class=\"sunday-stream-copy-main\">",
          "<div class=\"section-kicker\">Live Right Now</div>",
          "<h3>", escapeHtml((sundaySettings && sundaySettings.sunday_livestream_title) || "Watch Live"), "</h3>",
          (sundaySettings && sundaySettings.sunday_livestream_note) ?
            "<p>" + escapeHtml(sundaySettings.sunday_livestream_note) + "</p>" :
            "",
        "</div>",
        "<button type=\"button\" class=\"sunday-stream-mini-toggle\" aria-controls=\"sunday-stream-player\" aria-pressed=\"false\" onclick=\"toggleSundayStreamMiniPlayer()\">",
          "<span class=\"sunday-stream-mini-icon\" aria-hidden=\"true\"></span>",
          "<span data-sunday-stream-toggle-label>Keep Watching</span>",
        "</button>",
      "</div>",
      "<div class=\"sunday-stream-status\" data-sunday-stream-status aria-live=\"polite\"></div>",
      "<div class=\"sunday-stream-stage\" data-sunday-stream-stage>",
        "<div class=\"sunday-stream-player\" id=\"sunday-stream-player\" data-sunday-stream-player>",
          "<div class=\"sunday-stream-frame\">",
            "<iframe allow=\"autoplay; fullscreen\" allowfullscreen=\"true\" class=\"resi-video-frame\" src=\"", escapeAttr(streamUrl), "\" title=\"CrossPointe Livestream\"></iframe>",
            "<div class=\"sunday-stream-gesture-surface\" role=\"group\" tabindex=\"0\" aria-label=\"Mini player. Tap to return to the live section, drag to move, or pinch to resize.\" title=\"Tap to return. Drag to move. Pinch to resize.\" onpointerdown=\"beginSundayStreamMiniPlayerGesture(event)\" onkeydown=\"handleSundayStreamMiniPlayerMoveKeydown(event)\">",
              "<button type=\"button\" class=\"sunday-stream-overlay-action sunday-stream-overlay-playback\" data-sunday-stream-playback data-playback-state=\"connecting\" aria-label=\"Connecting to livestream controls\" title=\"Connecting to livestream controls\" onclick=\"toggleSundayStreamPlayback(event)\" disabled>",
                "<span class=\"sunday-stream-playback-icon sunday-stream-playback-play\" aria-hidden=\"true\"></span>",
                "<span class=\"sunday-stream-playback-icon sunday-stream-playback-pause\" aria-hidden=\"true\"><span></span><span></span></span>",
                "<span class=\"sunday-stream-playback-connecting\" aria-hidden=\"true\">&middot;&middot;&middot;</span>",
              "</button>",
              "<button type=\"button\" class=\"sunday-stream-overlay-action sunday-stream-overlay-close\" aria-label=\"Close mini player and stop the stream\" title=\"Close and stop\" onclick=\"closeSundayStreamMiniPlayer()\">&times;</button>",
            "</div>",
          "</div>",
          "<button type=\"button\" class=\"sunday-stream-resize-handle\" aria-label=\"Drag to resize mini player\" title=\"Drag left or right to resize\" onpointerdown=\"beginSundayStreamMiniPlayerResize(event)\" onkeydown=\"handleSundayStreamMiniPlayerResizeKeydown(event)\"><span aria-hidden=\"true\"></span></button>",
        "</div>",
      "</div>",
    "</article>",
  ].join("");
}

function initSundayStreamMiniPlayer_() {
  var stageEl = document.querySelector("[data-sunday-stream-stage]");
  if (!stageEl) return;

  sundayStreamMiniPlayerEnabled = false;
  sundayStreamMiniPlayerWidth = getSundayStreamMiniPlayerDefaultWidth_();
  sundayStreamMiniPlayerPosition = null;
  window.addEventListener("resize", handleSundayStreamMiniViewportChange_);
  initSundayStreamPlaybackControl_();
  syncSundayStreamMiniPlayer_();
}

function teardownSundayStreamMiniPlayer_() {
  if (sundayStreamPlayerAnimation) {
    sundayStreamPlayerAnimation.cancel();
    sundayStreamPlayerAnimation = null;
  }

  if (sundayStreamReturnAnimationFrame) {
    window.cancelAnimationFrame(sundayStreamReturnAnimationFrame);
    sundayStreamReturnAnimationFrame = 0;
  }

  stopSundayStreamMiniPlayerResize_();
  stopSundayStreamMiniPlayerGesture_();
  teardownSundayStreamPlaybackControl_();
  resetSundayStreamMiniPlayerPosition_();
  window.removeEventListener("resize", handleSundayStreamMiniViewportChange_);
  sundayStreamMiniPlayerEnabled = false;
  sundayStreamMiniPlayerWidth = getSundayStreamMiniPlayerDefaultWidth_();
  sundayStreamMiniPlayerPosition = null;

  if (document.body) {
    document.body.classList.remove("sunday-stream-mini-active");
  }
}

function toggleSundayStreamMiniPlayer() {
  if (sundayStreamMiniPlayerEnabled) {
    dockSundayStreamMiniPlayer_();
    return;
  }

  popOutSundayStreamMiniPlayer_();
}

function popOutSundayStreamMiniPlayer_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl || sundayStreamMiniPlayerEnabled) return;

  var startRect = playerEl.getBoundingClientRect();
  cancelSundayStreamPlayerAnimation_();
  playerEl.classList.add("is-position-animating");
  sundayStreamMiniPlayerEnabled = true;
  syncSundayStreamMiniPlayer_();
  animateSundayStreamPlayerFromRect_(playerEl, startRect);
}

function dockSundayStreamMiniPlayer_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl || !sundayStreamMiniPlayerEnabled) return;

  var startRect = playerEl.getBoundingClientRect();
  cancelSundayStreamPlayerAnimation_();
  playerEl.classList.add("is-position-animating");
  sundayStreamMiniPlayerEnabled = false;
  syncSundayStreamMiniPlayer_();
  animateSundayStreamPlayerFromRect_(playerEl, startRect);
}

function animateSundayStreamPlayerFromRect_(playerEl, startRect) {
  var endRect = playerEl.getBoundingClientRect();
  var canAnimate = typeof playerEl.animate === "function" &&
    !prefersReducedCentralMotion_() &&
    startRect.width > 0 &&
    startRect.height > 0 &&
    endRect.width > 0 &&
    endRect.height > 0;

  if (!canAnimate) {
    playerEl.classList.remove("is-position-animating");
    return;
  }

  var translateX = startRect.left - endRect.left;
  var translateY = startRect.top - endRect.top;
  var scaleX = startRect.width / endRect.width;
  var scaleY = startRect.height / endRect.height;

  sundayStreamPlayerAnimation = playerEl.animate([
    {
      transformOrigin: "top left",
      transform: "translate(" + translateX + "px, " + translateY +
        "px) scale(" + scaleX + ", " + scaleY + ")",
    },
    {
      transformOrigin: "top left",
      transform: "translate(0, 0) scale(1, 1)",
    },
  ], {
    duration: SUNDAY_STREAM_MINI_ANIMATION_DURATION_MS,
    easing: SUNDAY_STREAM_MINI_QUAD_EASING,
  });

  sundayStreamPlayerAnimation.onfinish = function() {
    sundayStreamPlayerAnimation = null;
    playerEl.classList.remove("is-position-animating");
  };

  sundayStreamPlayerAnimation.oncancel = function() {
    playerEl.classList.remove("is-position-animating");
  };
}

function cancelSundayStreamPlayerAnimation_() {
  if (!sundayStreamPlayerAnimation) return;

  sundayStreamPlayerAnimation.cancel();
  sundayStreamPlayerAnimation = null;
}

function prefersReducedCentralMotion_() {
  return !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function returnToSundayLivestream() {
  var stageEl = document.querySelector("[data-sunday-stream-stage]");
  if (!stageEl) return;

  if (sundayStreamReturnAnimationFrame) {
    window.cancelAnimationFrame(sundayStreamReturnAnimationFrame);
    sundayStreamReturnAnimationFrame = 0;
  }

  stageEl.scrollIntoView({
    behavior: prefersReducedCentralMotion_() ? "auto" : "smooth",
    block: "center",
  });

  waitForSundayStreamStageThenDock_(Date.now());
}

function waitForSundayStreamStageThenDock_(startedAt) {
  var stageEl = document.querySelector("[data-sunday-stream-stage]");
  if (!stageEl || !sundayStreamMiniPlayerEnabled) {
    sundayStreamReturnAnimationFrame = 0;
    return;
  }

  var rect = stageEl.getBoundingClientRect();
  var viewportHeight = window.innerHeight ||
    document.documentElement.clientHeight || 0;
  var stageIsReady = rect.top < viewportHeight * 0.72 &&
    rect.bottom > viewportHeight * 0.28;

  if (stageIsReady || Date.now() - startedAt > 1600) {
    sundayStreamReturnAnimationFrame = 0;
    dockSundayStreamMiniPlayer_();
    return;
  }

  sundayStreamReturnAnimationFrame = window.requestAnimationFrame(function() {
    waitForSundayStreamStageThenDock_(startedAt);
  });
}

function closeSundayStreamMiniPlayer() {
  var iframeEl = document.querySelector(".sunday-stream-player iframe");
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  var streamUrl = iframeEl ? iframeEl.getAttribute("src") : "";

  if (sundayStreamReturnAnimationFrame) {
    window.cancelAnimationFrame(sundayStreamReturnAnimationFrame);
    sundayStreamReturnAnimationFrame = 0;
  }

  cancelSundayStreamPlayerAnimation_();

  var finishClose = function() {
    sundayStreamMiniPlayerEnabled = false;
    syncSundayStreamMiniPlayer_();

    if (iframeEl && streamUrl) {
      iframeEl.setAttribute("src", "about:blank");
      window.setTimeout(function() {
        if (iframeEl.isConnected) {
          iframeEl.setAttribute("src", streamUrl);
        }
      }, 0);
    }
  };

  if (
    playerEl &&
    sundayStreamMiniPlayerEnabled &&
    typeof playerEl.animate === "function" &&
    !prefersReducedCentralMotion_()
  ) {
    sundayStreamPlayerAnimation = playerEl.animate([
      {opacity: 1, transform: "scale(1)"},
      {opacity: 0, transform: "scale(0.94)"},
    ], {
      duration: 220,
      easing: SUNDAY_STREAM_MINI_QUAD_EASING,
    });
    sundayStreamPlayerAnimation.onfinish = function() {
      sundayStreamPlayerAnimation = null;
      finishClose();
    };
    return;
  }

  finishClose();
}

function initSundayStreamPlaybackControl_() {
  teardownSundayStreamPlaybackControl_();

  sundayStreamPlaybackIframe = document.querySelector(
      ".sunday-stream-player iframe",
  );
  sundayStreamPlaybackConnected = false;
  sundayStreamPlaybackStateKnown = false;
  sundayStreamPlaybackPaused = false;
  sundayStreamPlaybackConnectAttempts = 0;

  if (!sundayStreamPlaybackIframe) {
    updateSundayStreamPlaybackButton_();
    return;
  }

  sundayStreamPlaybackIframe.addEventListener(
      "load",
      handleSundayStreamPlaybackIframeLoad_,
  );
  window.addEventListener("message", handleSundayStreamPlaybackMessage_);
  handleSundayStreamPlaybackIframeLoad_();
}

function teardownSundayStreamPlaybackControl_() {
  if (sundayStreamPlaybackConnectTimer) {
    window.clearTimeout(sundayStreamPlaybackConnectTimer);
    sundayStreamPlaybackConnectTimer = 0;
  }

  if (sundayStreamPlaybackIframe) {
    sundayStreamPlaybackIframe.removeEventListener(
        "load",
        handleSundayStreamPlaybackIframeLoad_,
    );
  }

  window.removeEventListener("message", handleSundayStreamPlaybackMessage_);
  sundayStreamPlaybackIframe = null;
  sundayStreamPlaybackOrigin = "";
  sundayStreamPlaybackConnected = false;
  sundayStreamPlaybackStateKnown = false;
  sundayStreamPlaybackPaused = false;
  sundayStreamPlaybackConnectAttempts = 0;
}

function handleSundayStreamPlaybackIframeLoad_() {
  if (sundayStreamPlaybackConnectTimer) {
    window.clearTimeout(sundayStreamPlaybackConnectTimer);
    sundayStreamPlaybackConnectTimer = 0;
  }

  sundayStreamPlaybackOrigin = getSundayStreamPlaybackOrigin_();
  sundayStreamPlaybackConnected = false;
  sundayStreamPlaybackStateKnown = false;
  sundayStreamPlaybackConnectAttempts = 0;
  updateSundayStreamPlaybackButton_();

  if (sundayStreamPlaybackOrigin) {
    sendSundayStreamPlaybackConnect_();
  }
}

function getSundayStreamPlaybackOrigin_() {
  if (!sundayStreamPlaybackIframe) return "";

  try {
    var streamUrl = new URL(
        sundayStreamPlaybackIframe.getAttribute("src") || "",
        window.location.href,
    );

    if (
      streamUrl.protocol !== "https:" ||
      streamUrl.hostname !== "control.resi.io"
    ) {
      return "";
    }

    return streamUrl.origin;
  } catch (error) {
    return "";
  }
}

function sendSundayStreamPlaybackConnect_() {
  if (
    !sundayStreamPlaybackIframe ||
    !sundayStreamPlaybackIframe.contentWindow ||
    !sundayStreamPlaybackOrigin ||
    sundayStreamPlaybackConnected
  ) {
    return;
  }

  sundayStreamPlaybackConnectAttempts += 1;
  sundayStreamPlaybackIframe.contentWindow.postMessage({
    kind: "player-connect",
    origin: window.location.origin,
    values: ["playing", "paused"],
    throttleTime: 100,
  }, sundayStreamPlaybackOrigin);

  if (
    sundayStreamPlaybackConnectAttempts <
      SUNDAY_STREAM_PLAYER_CONNECT_MAX_ATTEMPTS
  ) {
    sundayStreamPlaybackConnectTimer = window.setTimeout(
        sendSundayStreamPlaybackConnect_,
        500,
    );
  }
}

function handleSundayStreamPlaybackMessage_(event) {
  if (
    !sundayStreamPlaybackIframe ||
    event.source !== sundayStreamPlaybackIframe.contentWindow ||
    event.origin !== sundayStreamPlaybackOrigin ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return;
  }

  if (event.data.kind === "player-ready") {
    sundayStreamPlaybackConnected = true;
    if (sundayStreamPlaybackConnectTimer) {
      window.clearTimeout(sundayStreamPlaybackConnectTimer);
      sundayStreamPlaybackConnectTimer = 0;
    }
    updateSundayStreamPlaybackButton_();
    return;
  }

  if (
    event.data.name === "init-state" ||
    event.data.name === "paused" ||
    event.data.name === "playing"
  ) {
    applySundayStreamPlaybackSnapshot_(event.data.value);
    return;
  }

  if (event.data.name === "getSnapshotResult") {
    applySundayStreamPlaybackSnapshot_(event.data.body);
    return;
  }

  if (event.data.name === "play-result" && event.data.ok === false) {
    sundayStreamPlaybackPaused = true;
    sundayStreamPlaybackStateKnown = true;
    updateSundayStreamPlaybackButton_();
  }
}

function applySundayStreamPlaybackSnapshot_(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;

  if (typeof snapshot.paused === "boolean") {
    sundayStreamPlaybackPaused = snapshot.paused;
  } else if (typeof snapshot.playing === "boolean") {
    sundayStreamPlaybackPaused = !snapshot.playing;
  } else {
    return;
  }

  sundayStreamPlaybackConnected = true;
  sundayStreamPlaybackStateKnown = true;
  updateSundayStreamPlaybackButton_();
}

function toggleSundayStreamPlayback(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (
    !sundayStreamPlaybackIframe ||
    !sundayStreamPlaybackIframe.contentWindow ||
    !sundayStreamPlaybackOrigin ||
    !sundayStreamPlaybackConnected ||
    !sundayStreamPlaybackStateKnown
  ) {
    return;
  }

  var previousPausedState = sundayStreamPlaybackPaused;
  var command = sundayStreamPlaybackPaused ? "play" : "pause";
  sundayStreamPlaybackPaused = !sundayStreamPlaybackPaused;
  updateSundayStreamPlaybackButton_();

  try {
    sundayStreamPlaybackIframe.contentWindow.postMessage({
      name: command,
      args: [],
    }, sundayStreamPlaybackOrigin);
  } catch (error) {
    sundayStreamPlaybackPaused = previousPausedState;
    updateSundayStreamPlaybackButton_();
  }
}

function updateSundayStreamPlaybackButton_() {
  var buttonEl = document.querySelector("[data-sunday-stream-playback]");
  if (!buttonEl) return;

  if (!sundayStreamPlaybackOrigin) {
    buttonEl.disabled = true;
    buttonEl.setAttribute("data-playback-state", "unavailable");
    buttonEl.setAttribute("aria-label", "Playback controls unavailable");
    buttonEl.setAttribute("title", "Playback controls unavailable");
    return;
  }

  if (!sundayStreamPlaybackConnected || !sundayStreamPlaybackStateKnown) {
    buttonEl.disabled = true;
    buttonEl.setAttribute("data-playback-state", "connecting");
    buttonEl.setAttribute("aria-label", "Connecting to livestream controls");
    buttonEl.setAttribute("title", "Connecting to livestream controls");
    return;
  }

  var nextAction = sundayStreamPlaybackPaused ? "Play" : "Pause";
  buttonEl.disabled = false;
  buttonEl.setAttribute(
      "data-playback-state",
      sundayStreamPlaybackPaused ? "paused" : "playing",
  );
  buttonEl.setAttribute("aria-label", nextAction + " livestream");
  buttonEl.setAttribute("title", nextAction);
}

function beginSundayStreamMiniPlayerGesture(event) {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  var targetEl = event.target;

  if (
    !playerEl ||
    !sundayStreamMiniPlayerEnabled ||
    (targetEl && targetEl.closest && targetEl.closest("button"))
  ) {
    return;
  }

  if (
    sundayStreamGestureState &&
    getSundayStreamGesturePointers_().length >= 2
  ) {
    return;
  }

  event.preventDefault();
  cancelSundayStreamPlayerAnimation_();

  if (!sundayStreamGestureState) {
    sundayStreamGestureState = {
      handle: event.currentTarget,
      pointers: {},
      mode: "move",
      startRect: playerEl.getBoundingClientRect(),
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      didMove: false,
      usedMultiplePointers: false,
    };

    window.addEventListener(
        "pointermove",
        handleSundayStreamMiniPlayerGestureMove_,
    );
    window.addEventListener(
        "pointerup",
        endSundayStreamMiniPlayerGesturePointer_,
    );
    window.addEventListener(
        "pointercancel",
        endSundayStreamMiniPlayerGesturePointer_,
    );
    window.addEventListener("blur", stopSundayStreamMiniPlayerGesture_);
  }

  sundayStreamGestureState.pointers[String(event.pointerId)] = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };

  if (
    sundayStreamGestureState.handle &&
    typeof sundayStreamGestureState.handle.setPointerCapture === "function"
  ) {
    try {
      sundayStreamGestureState.handle.setPointerCapture(event.pointerId);
    } catch (error) {
    }
  }

  if (getSundayStreamGesturePointers_().length === 2) {
    sundayStreamGestureState.didMove = true;
    sundayStreamGestureState.usedMultiplePointers = true;
    playerEl.classList.add("is-moving");
    initializeSundayStreamMiniPlayerPinch_();
  }
}

function handleSundayStreamMiniPlayerGestureMove_(event) {
  if (!sundayStreamGestureState) return;

  var pointerKey = String(event.pointerId);
  if (!sundayStreamGestureState.pointers[pointerKey]) return;

  event.preventDefault();
  sundayStreamGestureState.pointers[pointerKey].x = event.clientX;
  sundayStreamGestureState.pointers[pointerKey].y = event.clientY;

  var pointers = getSundayStreamGesturePointers_();
  if (pointers.length >= 2) {
    sundayStreamGestureState.didMove = true;
    sundayStreamGestureState.usedMultiplePointers = true;
    var playerEl = document.querySelector("[data-sunday-stream-player]");
    if (playerEl) playerEl.classList.add("is-moving");
    if (sundayStreamGestureState.mode !== "pinch") {
      initializeSundayStreamMiniPlayerPinch_();
    }
    applySundayStreamMiniPlayerPinch_(pointers[0], pointers[1]);
    return;
  }

  if (pointers.length !== 1) return;

  var movementX = pointers[0].x - sundayStreamGestureState.startPointerX;
  var movementY = pointers[0].y - sundayStreamGestureState.startPointerY;
  var movementDistance = Math.sqrt(
      movementX * movementX + movementY * movementY,
  );

  if (
    !sundayStreamGestureState.didMove &&
    movementDistance < SUNDAY_STREAM_MINI_TAP_MOVE_THRESHOLD
  ) {
    return;
  }

  sundayStreamGestureState.didMove = true;
  var movingPlayerEl = document.querySelector("[data-sunday-stream-player]");
  if (movingPlayerEl) movingPlayerEl.classList.add("is-moving");

  if (sundayStreamGestureState.mode !== "move") {
    initializeSundayStreamMiniPlayerMove_(pointers[0]);
  }

  setSundayStreamMiniPlayerPosition_(
      sundayStreamGestureState.startRect.left +
        pointers[0].x - sundayStreamGestureState.startPointerX,
      sundayStreamGestureState.startRect.top +
        pointers[0].y - sundayStreamGestureState.startPointerY,
  );
}

function initializeSundayStreamMiniPlayerMove_(pointer) {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl || !sundayStreamGestureState || !pointer) return;

  sundayStreamGestureState.mode = "move";
  sundayStreamGestureState.startRect = playerEl.getBoundingClientRect();
  sundayStreamGestureState.startPointerX = pointer.x;
  sundayStreamGestureState.startPointerY = pointer.y;
  playerEl.classList.remove("is-gesture-resizing");
}

function initializeSundayStreamMiniPlayerPinch_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  var pointers = getSundayStreamGesturePointers_();
  if (!playerEl || !sundayStreamGestureState || pointers.length < 2) return;

  var rect = playerEl.getBoundingClientRect();
  var center = getSundayStreamGestureCenter_(pointers[0], pointers[1]);

  sundayStreamGestureState.mode = "pinch";
  sundayStreamGestureState.startRect = rect;
  sundayStreamGestureState.startWidth = rect.width;
  sundayStreamGestureState.startDistance = Math.max(
      10,
      getSundayStreamGestureDistance_(pointers[0], pointers[1]),
  );
  sundayStreamGestureState.startGestureCenter = center;
  sundayStreamGestureState.startPlayerCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  playerEl.classList.add("is-gesture-resizing");
}

function applySundayStreamMiniPlayerPinch_(firstPointer, secondPointer) {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (
    !playerEl ||
    !sundayStreamGestureState ||
    sundayStreamGestureState.mode !== "pinch"
  ) {
    return;
  }

  var distance = getSundayStreamGestureDistance_(
      firstPointer,
      secondPointer,
  );
  var center = getSundayStreamGestureCenter_(firstPointer, secondPointer);
  var widthScale = distance / sundayStreamGestureState.startDistance;
  var desiredCenterX = sundayStreamGestureState.startPlayerCenter.x +
    center.x - sundayStreamGestureState.startGestureCenter.x;
  var desiredCenterY = sundayStreamGestureState.startPlayerCenter.y +
    center.y - sundayStreamGestureState.startGestureCenter.y;

  sundayStreamMiniPlayerWidth = clampSundayStreamMiniPlayerWidth_(
      sundayStreamGestureState.startWidth * widthScale,
  );
  applySundayStreamMiniPlayerWidth_();

  var resizedRect = playerEl.getBoundingClientRect();
  setSundayStreamMiniPlayerPosition_(
      desiredCenterX - resizedRect.width / 2,
      desiredCenterY - resizedRect.height / 2,
  );
}

function endSundayStreamMiniPlayerGesturePointer_(event) {
  if (!sundayStreamGestureState) return;

  var pointerKey = String(event.pointerId);
  if (!sundayStreamGestureState.pointers[pointerKey]) return;

  delete sundayStreamGestureState.pointers[pointerKey];

  if (
    sundayStreamGestureState.handle &&
    typeof sundayStreamGestureState.handle.releasePointerCapture === "function"
  ) {
    try {
      sundayStreamGestureState.handle.releasePointerCapture(event.pointerId);
    } catch (error) {
    }
  }

  var pointers = getSundayStreamGesturePointers_();
  if (pointers.length) {
    initializeSundayStreamMiniPlayerMove_(pointers[0]);
    return;
  }

  var shouldReturnToLivestream = event.type === "pointerup" &&
    !sundayStreamGestureState.didMove &&
    !sundayStreamGestureState.usedMultiplePointers;
  stopSundayStreamMiniPlayerGesture_();

  if (shouldReturnToLivestream) {
    returnToSundayLivestream();
  }
}

function stopSundayStreamMiniPlayerGesture_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");

  if (
    sundayStreamGestureState &&
    sundayStreamGestureState.handle &&
    typeof sundayStreamGestureState.handle.releasePointerCapture === "function"
  ) {
    getSundayStreamGesturePointers_().forEach(function(pointer) {
      try {
        sundayStreamGestureState.handle.releasePointerCapture(pointer.id);
      } catch (error) {
      }
    });
  }

  window.removeEventListener(
      "pointermove",
      handleSundayStreamMiniPlayerGestureMove_,
  );
  window.removeEventListener(
      "pointerup",
      endSundayStreamMiniPlayerGesturePointer_,
  );
  window.removeEventListener(
      "pointercancel",
      endSundayStreamMiniPlayerGesturePointer_,
  );
  window.removeEventListener("blur", stopSundayStreamMiniPlayerGesture_);

  if (playerEl) {
    playerEl.classList.remove("is-moving", "is-gesture-resizing");
  }

  sundayStreamGestureState = null;
}

function getSundayStreamGesturePointers_() {
  if (!sundayStreamGestureState) return [];

  return Object.keys(sundayStreamGestureState.pointers).map(function(key) {
    return sundayStreamGestureState.pointers[key];
  });
}

function getSundayStreamGestureDistance_(firstPointer, secondPointer) {
  var deltaX = secondPointer.x - firstPointer.x;
  var deltaY = secondPointer.y - firstPointer.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getSundayStreamGestureCenter_(firstPointer, secondPointer) {
  return {
    x: (firstPointer.x + secondPointer.x) / 2,
    y: (firstPointer.y + secondPointer.y) / 2,
  };
}

function handleSundayStreamMiniPlayerMoveKeydown(event) {
  if (
    event.target !== event.currentTarget ||
    !sundayStreamMiniPlayerEnabled
  ) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    returnToSundayLivestream();
    return;
  }

  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(
        event.key,
    ) === -1
  ) {
    return;
  }

  event.preventDefault();
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl) return;

  var rect = playerEl.getBoundingClientRect();
  var step = event.shiftKey ? 40 : 16;
  var deltaX = event.key === "ArrowLeft" ? -step :
    (event.key === "ArrowRight" ? step : 0);
  var deltaY = event.key === "ArrowUp" ? -step :
    (event.key === "ArrowDown" ? step : 0);

  setSundayStreamMiniPlayerPosition_(
      rect.left + deltaX,
      rect.top + deltaY,
  );
}

function resizeSundayStreamMiniPlayer(direction) {
  if (!sundayStreamMiniPlayerEnabled) return;

  sundayStreamMiniPlayerWidth = clampSundayStreamMiniPlayerWidth_(
      sundayStreamMiniPlayerWidth +
      Number(direction || 0) * SUNDAY_STREAM_MINI_WIDTH_STEP,
  );
  applySundayStreamMiniPlayerWidth_();
}

function beginSundayStreamMiniPlayerResize(event) {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (
    !playerEl ||
    !sundayStreamMiniPlayerEnabled ||
    window.innerWidth <= 640
  ) {
    return;
  }

  event.preventDefault();
  cancelSundayStreamPlayerAnimation_();
  sundayStreamResizePointerId = event.pointerId;
  sundayStreamResizeStartX = event.clientX;
  sundayStreamResizeStartWidth = playerEl.getBoundingClientRect().width;
  sundayStreamResizeHandle = event.currentTarget;
  playerEl.classList.add("is-resizing");

  if (typeof sundayStreamResizeHandle.setPointerCapture === "function") {
    sundayStreamResizeHandle.setPointerCapture(event.pointerId);
  }

  window.addEventListener("pointermove", handleSundayStreamMiniPlayerResize_);
  window.addEventListener("pointerup", endSundayStreamMiniPlayerResize_);
  window.addEventListener("pointercancel", endSundayStreamMiniPlayerResize_);
}

function handleSundayStreamMiniPlayerResize_(event) {
  if (event.pointerId !== sundayStreamResizePointerId) return;

  sundayStreamMiniPlayerWidth = clampSundayStreamMiniPlayerWidth_(
      sundayStreamResizeStartWidth +
      sundayStreamResizeStartX -
      event.clientX,
  );
  applySundayStreamMiniPlayerWidth_();
}

function endSundayStreamMiniPlayerResize_(event) {
  if (
    event &&
    sundayStreamResizePointerId !== null &&
    event.pointerId !== sundayStreamResizePointerId
  ) {
    return;
  }

  stopSundayStreamMiniPlayerResize_();
}

function stopSundayStreamMiniPlayerResize_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");

  if (
    sundayStreamResizeHandle &&
    sundayStreamResizePointerId !== null &&
    typeof sundayStreamResizeHandle.releasePointerCapture === "function"
  ) {
    try {
      sundayStreamResizeHandle.releasePointerCapture(
          sundayStreamResizePointerId,
      );
    } catch (error) {
    }
  }

  window.removeEventListener("pointermove", handleSundayStreamMiniPlayerResize_);
  window.removeEventListener("pointerup", endSundayStreamMiniPlayerResize_);
  window.removeEventListener("pointercancel", endSundayStreamMiniPlayerResize_);

  if (playerEl) {
    playerEl.classList.remove("is-resizing");
  }

  sundayStreamResizePointerId = null;
  sundayStreamResizeStartX = 0;
  sundayStreamResizeStartWidth = 0;
  sundayStreamResizeHandle = null;
}

function handleSundayStreamMiniPlayerResizeKeydown(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  event.preventDefault();
  resizeSundayStreamMiniPlayer(event.key === "ArrowLeft" ? 1 : -1);
}

function getSundayStreamMiniPlayerDefaultWidth_() {
  if (isSundayStreamMiniMobileViewport_()) {
    return clampSundayStreamMiniPlayerWidth_(
        SUNDAY_STREAM_MINI_MOBILE_DEFAULT_WIDTH,
    );
  }

  return SUNDAY_STREAM_MINI_DEFAULT_WIDTH;
}

function isSundayStreamMiniMobileViewport_() {
  return (window.innerWidth || 0) <=
    SUNDAY_STREAM_MINI_MOBILE_BREAKPOINT;
}

function getSundayStreamMiniPlayerMinimumWidth_() {
  if (!isSundayStreamMiniMobileViewport_()) {
    return SUNDAY_STREAM_MINI_MIN_WIDTH;
  }

  var viewportWidth = window.innerWidth ||
    SUNDAY_STREAM_MINI_MOBILE_DEFAULT_WIDTH + 28;

  return Math.min(
      SUNDAY_STREAM_MINI_MOBILE_MIN_WIDTH,
      Math.max(160, viewportWidth - 28),
  );
}

function getSundayStreamMiniPlayerMaximumWidth_() {
  var viewportWidth = window.innerWidth || SUNDAY_STREAM_MINI_MAX_WIDTH;
  var minimumWidth = getSundayStreamMiniPlayerMinimumWidth_();
  var viewportMargin = isSundayStreamMiniMobileViewport_() ? 28 : 40;
  var maximumWidth = viewportWidth - viewportMargin;

  if (!isSundayStreamMiniMobileViewport_()) {
    maximumWidth = Math.min(SUNDAY_STREAM_MINI_MAX_WIDTH, maximumWidth);
  }

  return Math.max(minimumWidth, maximumWidth);
}

function clampSundayStreamMiniPlayerWidth_(width) {
  var minimumWidth = getSundayStreamMiniPlayerMinimumWidth_();
  var maximumWidth = getSundayStreamMiniPlayerMaximumWidth_();

  return Math.max(
      minimumWidth,
      Math.min(maximumWidth, Math.round(Number(width) || 0)),
  );
}

function setSundayStreamMiniPlayerPosition_(left, top) {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl || !sundayStreamMiniPlayerEnabled) return;

  var rect = playerEl.getBoundingClientRect();
  var viewportWidth = window.innerWidth || rect.right;
  var viewportHeight = window.innerHeight || rect.bottom;
  var edge = 8;
  var maximumLeft = Math.max(edge, viewportWidth - rect.width - edge);
  var maximumTop = Math.max(edge, viewportHeight - rect.height - edge);
  var resolvedLeft = Math.max(edge, Math.min(maximumLeft, Number(left) || 0));
  var resolvedTop = Math.max(edge, Math.min(maximumTop, Number(top) || 0));

  sundayStreamMiniPlayerPosition = {
    left: resolvedLeft,
    top: resolvedTop,
  };
  playerEl.classList.add("has-custom-position");
  playerEl.style.left = resolvedLeft + "px";
  playerEl.style.top = resolvedTop + "px";
  playerEl.style.right = "auto";
  playerEl.style.bottom = "auto";
}

function constrainSundayStreamMiniPlayerPosition_() {
  if (!sundayStreamMiniPlayerPosition) return;

  setSundayStreamMiniPlayerPosition_(
      sundayStreamMiniPlayerPosition.left,
      sundayStreamMiniPlayerPosition.top,
  );
}

function resetSundayStreamMiniPlayerPosition_(playerEl) {
  var resolvedPlayerEl = playerEl ||
    document.querySelector("[data-sunday-stream-player]");

  sundayStreamMiniPlayerPosition = null;
  if (!resolvedPlayerEl) return;

  resolvedPlayerEl.classList.remove("has-custom-position");
  resolvedPlayerEl.style.removeProperty("left");
  resolvedPlayerEl.style.removeProperty("top");
  resolvedPlayerEl.style.removeProperty("right");
  resolvedPlayerEl.style.removeProperty("bottom");
}

function handleSundayStreamMiniViewportChange_() {
  if (!sundayStreamMiniPlayerEnabled) return;

  sundayStreamMiniPlayerWidth = clampSundayStreamMiniPlayerWidth_(
      sundayStreamMiniPlayerWidth,
  );
  applySundayStreamMiniPlayerWidth_();
  constrainSundayStreamMiniPlayerPosition_();
}

function applySundayStreamMiniPlayerWidth_() {
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  if (!playerEl) return;

  sundayStreamMiniPlayerWidth = clampSundayStreamMiniPlayerWidth_(
      sundayStreamMiniPlayerWidth,
  );
  playerEl.style.setProperty(
      "--sunday-stream-mini-width",
      sundayStreamMiniPlayerWidth + "px",
  );

  constrainSundayStreamMiniPlayerPosition_();
}

function syncSundayStreamMiniPlayer_() {
  var cardEl = document.getElementById("live");
  var playerEl = document.querySelector("[data-sunday-stream-player]");
  var stageEl = document.querySelector("[data-sunday-stream-stage]");
  var toggleEl = document.querySelector(".sunday-stream-mini-toggle");
  var labelEl = document.querySelector("[data-sunday-stream-toggle-label]");
  var statusEl = document.querySelector("[data-sunday-stream-status]");
  var shouldFloat = sundayStreamMiniPlayerEnabled;

  if (cardEl) {
    cardEl.classList.toggle("is-mini-player-active", shouldFloat);
  }

  if (playerEl) {
    if (!shouldFloat) {
      stopSundayStreamMiniPlayerGesture_();
      resetSundayStreamMiniPlayerPosition_(playerEl);
    }
    playerEl.classList.toggle("is-floating", shouldFloat);
  }

  if (stageEl) {
    stageEl.classList.toggle("has-floating-player", shouldFloat);
  }

  if (document.body) {
    document.body.classList.toggle("sunday-stream-mini-active", shouldFloat);
  }

  if (toggleEl) {
    toggleEl.classList.toggle("is-enabled", sundayStreamMiniPlayerEnabled);
    toggleEl.setAttribute(
        "aria-pressed",
        sundayStreamMiniPlayerEnabled ? "true" : "false",
    );
  }

  if (labelEl) {
    labelEl.textContent = sundayStreamMiniPlayerEnabled ?
      "Return Player" :
      "Keep Watching";
  }

  if (statusEl) {
    statusEl.textContent = sundayStreamMiniPlayerEnabled ?
      "The mini player is active. Keep browsing while you watch." :
      "";
  }

  applySundayStreamMiniPlayerWidth_();
}

function renderSundayScriptureCard(sunday, sundaySettings) {
  var reference = String(
      ((sundaySettings && sundaySettings.sunday_scripture_reference) ||
      (sunday && sunday.scripture) || ""),
  ).trim();

  return [
    "<article class=\"card sunday-scripture-card\">",
      "<div id=\"sunday-scripture-mount\" class=\"sunday-scripture-mount\" data-reference=\"", escapeAttr(reference), "\">",
        "<div class=\"yv-reader-loading\">",
          "<div class=\"spinner\"></div>",
          "<p>Loading YouVersion reader...</p>",
        "</div>",
      "</div>",
    "</article>",
  ].join("");
}

function renderAnimatedSetlistCard(serviceNames, services) {
  if (!serviceNames.length) {
    return [
      "<article class=\"card setlist-card\">",
        "<h3>Worship Set</h3>",
        "<p>No setlist added yet.</p>",
      "</article>",
    ].join("");
  }

  return [
    "<article class=\"card setlist-card\">",
      "<h3>Worship Set</h3>",
      "<div class=\"setlist-toggle\">",
        serviceNames.map(function(service, index) {
          return [
            "<button type=\"button\" class=\"", (index === 0 ? "active" : ""), "\"",
            " data-setlist-button=\"", escapeAttr(service), "\"",
            " onclick=\"showSetlistService('", escapeJsString(service), "')\">",
            escapeHtml(service),
            "</button>",
          ].join("");
        }).join(""),
      "</div>",
      "<div class=\"setlist-stage\">",
        serviceNames.map(function(service, index) {
          return [
            "<div class=\"setlist-panel ", (index === 0 ? "active" : ""), "\" data-setlist-panel=\"", escapeAttr(service), "\">",
              "<h4>", escapeHtml(service), " Service</h4>",
              (services[service] || []).map(function(song) {
                return [
                  "<div class=\"song\">",
                    "<div>",
                      "<div class=\"song-title\">", escapeHtml(song.song_title), "</div>",
                      "<div class=\"song-artist\">", escapeHtml(song.artist), "</div>",
                    "</div>",
                  "</div>",
                ].join("");
              }).join(""),
            "</div>",
          ].join("");
        }).join(""),
      "</div>",
    "</article>",
  ].join("");
}

function showSetlistService(service) {
  var panels = document.querySelectorAll("[data-setlist-panel]");
  var buttons = document.querySelectorAll("[data-setlist-button]");

  panels.forEach(function(panel) {
    panel.classList.toggle("active", panel.getAttribute("data-setlist-panel") === service);
  });

  buttons.forEach(function(buttonEl) {
    buttonEl.classList.toggle("active", buttonEl.getAttribute("data-setlist-button") === service);
  });
}

function renderEvents(items) {
  if (!items || !items.length) return "";
  var calendarIntegrationsEnabled = getCalendarIntegrationsEnabledValue_(
      currentCentralData,
  );

  return section("Upcoming Events", "See You There", renderExpandableGroup({
    id: "events-grid",
    items: items,
    containerClass: "grid three events-grid",
    desktopLimit: 6,
    moreLabel: "See More Events",
    lessLabel: "See Less Events",
    renderItem: function(item) {
      return card({
        title: item.title,
        meta: [item.date, item.time, item.location].filter(Boolean).join(" • "),
        description: "",
        buttonHtml: renderEventDetailsButton_(item),
        bottomButtonText: calendarIntegrationsEnabled ? "Add to Calendar" : "",
        bottomButtonUrl: calendarIntegrationsEnabled ? item.calendar_url : "",
        calendarFileUrl: item.calendar_file_url,
        featured: item.featured === "TRUE",
        extraClass: "event-card",
      });
    },
  }), "upcoming-events");
}

function renderRegistrations(items) {
  if (!items || !items.length) return "";
  var calendarIntegrationsEnabled = getCalendarIntegrationsEnabledValue_(
      currentCentralData,
  );

  return section(
      "Register for an Event",
      "Save Your Spot",
      renderExpandableGroup({
        id: "registrations-grid",
        items: items,
        containerClass: "grid three registrations-grid",
        desktopLimit: 6,
        moreLabel: "See More Registrations",
        lessLabel: "See Fewer Registrations",
        renderItem: function(item) {
          return renderRegistrationCard_(item, calendarIntegrationsEnabled);
        },
      }),
      "registrations",
  );
}

function renderRegistrationCard_(item, calendarIntegrationsEnabled) {
  var registrationUrl = String(item && item.registration_url || "").trim();
  if (!/^https?:\/\//i.test(registrationUrl)) return "";

  return card({
    title: item.title,
    meta: [item.date, item.time, item.location].filter(Boolean).join(" • "),
    description: "",
    preHeadingHtml: renderRegistrationStatus_(item),
    buttonHtml: renderEventDetailsButton_(item),
    bottomButtonText: calendarIntegrationsEnabled ? "Add to Calendar" : "",
    bottomButtonUrl: calendarIntegrationsEnabled ? item.calendar_url : "",
    calendarFileUrl: item.calendar_file_url,
    extraClass: "event-card registration-event-card",
  });
}

function renderRegistrationStatus_(item) {
  var status = String(item && item.status || "open").trim().toLowerCase();
  var allowedStatuses = [
    "open",
    "closing-soon",
    "closed",
    "waitlist",
    "full",
  ];

  if (allowedStatuses.indexOf(status) === -1) status = "open";

  return [
    "<div class=\"registration-status is-", escapeAttr(status), "\">",
      escapeHtml(item && item.status_label || "Registration open"),
    "</div>",
  ].join("");
}

function renderEventDetailsButton_(item) {
  var eventKey = registerEventDetailsItem_(item);
  if (!eventKey) return "";

  return [
    "<button type=\"button\" class=\"btn event-details-open\"",
      " onclick=\"openEventDetailsModal('",
      escapeJsString(eventKey),
      "')\">",
      escapeHtml(item.button_text || "Learn More"),
    "</button>",
  ].join("");
}

function openWayfinderEventDetailsModal(event) {
  if (!event || typeof event !== "object") return false;

  var eventKey = registerEventDetailsItem_({
    title: String(event.title || "").trim(),
    date: String(event.date || "").trim(),
    time: String(event.time || "").trim(),
    location: String(event.location || "").trim(),
    venue: String(event.venue || "").trim(),
    address: String(event.address || "").trim(),
    description: String(event.description || "").trim(),
    recurrence: String(event.recurrence || "").trim(),
    recurrence_details: String(event.recurrence || "").trim(),
    registration_url: String(event.registrationUrl || "").trim(),
    registration_button_text: String(
        event.registrationLabel || "Register",
    ).trim(),
    image_url: String(event.imageUrl || "").trim(),
    featured: "FALSE",
    source: "Wayfinder Event",
  });

  if (!eventKey) return false;
  openEventDetailsModal(eventKey);
  return true;
}

function getEventModalRecurrence_(value) {
  var recurrence = String(value || "").trim();
  if (/^does not repeat[.!]?$/i.test(recurrence)) return "";
  return recurrence;
}

function registerEventDetailsItem_(item) {
  if (!item) return "";

  var key = "event-detail:" + String(++eventDetailKeyCounter);

  eventDetailItemsByKey[key] = {
    title: String(item.title || "CrossPointe Event").trim(),
    date: String(item.date || "").trim(),
    time: String(item.time || "").trim(),
    doorsOpenTime: String(item.doors_open_time || "").trim(),
    location: String(item.location || "").trim(),
    venue: String(item.venue || "").trim(),
    address: String(item.address || "").trim(),
    description: String(item.description || "").trim(),
    recurrence: getEventModalRecurrence_(item.recurrence),
    recurrenceDetails: getEventModalRecurrence_(item.recurrence_details),
    featured: item.featured === "TRUE",
    registrationUrl: String(item.registration_url || "").trim(),
    imageUrl: String(item.image_url || "").trim(),
    calendarUrl: String(item.calendar_url || "").trim(),
    calendarFileUrl: String(item.calendar_file_url || "").trim(),
    isRegistrationEvent: item.source === "Planning Center Registrations",
    registrationStatus: String(item.status || "").trim(),
    registrationStatusLabel: String(item.status_label || "").trim(),
    registrationButtonText: String(
        item.registration_button_text || "Register in Church Center",
    ).trim(),
    priceLabel: String(item.price_label || "").trim(),
    closeLabel: String(item.close_label || "").trim(),
  };

  return key;
}

function openEventDetailsModal(eventKey) {
  var item = eventDetailItemsByKey[eventKey];
  if (!item) return;

  removeEventDetailsModal_();
  eventDetailsPreviousFocus = document.activeElement;

  var dateBadge = getEventDateBadgeParts_(item.date);
  var schedule = [item.date, item.time].filter(Boolean).join(" • ");
  var locationQuery = [item.venue, item.address]
      .filter(Boolean)
      .join(", ") || item.location;
  var mapUrl = locationQuery ?
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(locationQuery) :
    "";
  var directionsUrl = locationQuery ?
    "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(locationQuery) :
    "";
  var hasSafeImage = /^https?:\/\//i.test(item.imageUrl);
  var usesHeadingThumbnail = hasSafeImage && item.featured;
  var hasSafeRegistration = /^https?:\/\//i.test(item.registrationUrl);
  var registrationFacts = item.isRegistrationEvent ? [
    item.priceLabel ? {label: "Price", value: item.priceLabel} : null,
    item.closeLabel ? {
      label: "Registration closes",
      value: item.closeLabel,
    } : null,
  ].filter(Boolean) : [];
  var calendarIntegrationsEnabled = getCalendarIntegrationsEnabledValue_(
      currentCentralData,
  );
  var modal = document.createElement("div");

  modal.id = "central-event-details-modal";
  modal.className = "event-details-modal";
  modal.innerHTML = [
    "<div class=\"event-details-backdrop\" data-event-details-close=\"true\"></div>",
    "<article class=\"event-details-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"event-details-title\">",
      "<button type=\"button\" class=\"event-details-close\" aria-label=\"Close event details\" data-event-details-close=\"true\">&times;</button>",
      "<div class=\"event-details-heading\">",
        dateBadge && !usesHeadingThumbnail ? [
          "<div class=\"event-details-date\" aria-label=\"", escapeAttr(item.date), "\">",
            "<span>", escapeHtml(dateBadge.month), "</span>",
            "<strong>", escapeHtml(dateBadge.day), "</strong>",
          "</div>",
        ].join("") : "",
        "<div class=\"event-details-heading-copy\">",
          "<div class=\"event-details-kicker\">",
            item.isRegistrationEvent ? "Registration Event" :
              "CrossPointe Event",
          "</div>",
          item.registrationStatusLabel ? renderRegistrationStatus_({
            status: item.registrationStatus,
            status_label: item.registrationStatusLabel,
          }) : "",
          "<h2 id=\"event-details-title\">", escapeHtml(item.title), "</h2>",
          item.recurrence ?
            "<p class=\"event-details-recurrence\">" +
              escapeHtml(item.recurrence) + "</p>" :
            "",
          item.doorsOpenTime ?
            "<p class=\"event-details-doors-open\"><strong>Doors Open:</strong> " +
              escapeHtml(item.doorsOpenTime) + "</p>" :
            "",
          schedule ?
            "<p class=\"event-details-schedule\">" +
              escapeHtml(schedule) + "</p>" :
            "",
        "</div>",
        usesHeadingThumbnail ? [
          "<div class=\"event-details-heading-image-wrap\">",
            "<img class=\"event-details-heading-image\" src=\"",
              escapeAttr(item.imageUrl),
              "\" alt=\"\" loading=\"eager\">",
          "</div>",
        ].join("") : "",
      "</div>",
      hasSafeImage && !usesHeadingThumbnail ? [
        "<div class=\"event-details-image-wrap\">",
          "<img class=\"event-details-image\" src=\"", escapeAttr(item.imageUrl),
            "\" alt=\"\" loading=\"lazy\">",
        "</div>",
      ].join("") : "",
      "<div class=\"event-details-content\">",
        "<section class=\"event-details-main\" aria-labelledby=\"event-details-about-title\">",
          "<h3 id=\"event-details-about-title\">Details</h3>",
          (item.description || item.recurrenceDetails) ?
            "<p>" + escapeHtml(
                item.description || item.recurrenceDetails,
            ) + "</p>" :
            "<p>More details will be posted here as they become available.</p>",
          registrationFacts.length ? [
            "<dl class=\"registration-modal-facts\">",
              registrationFacts.map(function(fact) {
                return [
                  "<div>",
                    "<dt>", escapeHtml(fact.label), "</dt>",
                    "<dd>", escapeHtml(fact.value), "</dd>",
                  "</div>",
                ].join("");
              }).join(""),
            "</dl>",
          ].join("") : "",
        "</section>",
        (item.location || item.venue || item.address) ? [
          "<aside class=\"event-details-location\" aria-labelledby=\"event-details-location-title\">",
            "<div class=\"event-details-location-label\" id=\"event-details-location-title\">Location</div>",
            item.isRegistrationEvent && item.location ?
              "<strong>" + escapeHtml(item.location) + "</strong>" :
              item.venue ?
                "<strong>" + escapeHtml(item.venue) + "</strong>" : "",
            item.isRegistrationEvent && item.venue &&
              item.venue !== item.location ?
              "<span>" + escapeHtml(item.venue) + "</span>" :
              !item.isRegistrationEvent && item.location &&
                item.location !== item.venue ?
                "<span>" + escapeHtml(item.location) + "</span>" : "",
            item.address ? "<span>" + escapeHtml(item.address) + "</span>" : "",
            mapUrl ? [
              "<div class=\"event-details-map-actions\">",
                "<a class=\"event-details-map-link\" ", buildLinkAttrs_(mapUrl), ">Show map</a>",
                "<a class=\"event-details-map-link\" ", buildLinkAttrs_(directionsUrl), ">Get directions</a>",
              "</div>",
            ].join("") : "",
          "</aside>",
        ].join("") : "",
      "</div>",
      "<div class=\"event-details-actions",
        item.isRegistrationEvent ? " has-registration-action" : "",
        "\">",
        hasSafeRegistration && !item.featured ?
          item.isRegistrationEvent ? [
            "<div class=\"registration-modal-action\">",
              button(
                  item.registrationButtonText,
                  item.registrationUrl,
                  "btn-primary",
              ),
              "<span>Opens Church Center in a new tab</span>",
            "</div>",
          ].join("") :
            button(
                item.registrationButtonText || "Register",
                item.registrationUrl,
                "btn-primary",
            ) :
          "",
        calendarIntegrationsEnabled ? calendarButton_(
            "Add to Calendar",
            item.calendarUrl,
            item.calendarFileUrl,
            item.title,
        ) : "",
      "</div>",
    "</article>",
  ].join("");

  modal.addEventListener("click", function(event) {
    if (event.target.closest("[data-event-details-close=\"true\"]")) {
      closeEventDetailsModal();
    }
  });

  eventDetailsEscapeHandler = function(event) {
    if (event.key === "Escape") {
      closeEventDetailsModal();
    }
  };

  document.addEventListener("keydown", eventDetailsEscapeHandler);
  document.body.classList.add("modal-open");
  document.body.appendChild(modal);

  var closeButton = modal.querySelector(".event-details-close");
  if (closeButton) closeButton.focus();
}

function closeEventDetailsModal(immediate) {
  var modal = document.getElementById("central-event-details-modal");
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!modal) {
    finishEventDetailsModalClose_(null);
    return;
  }

  if (immediate || prefersReducedMotion) {
    finishEventDetailsModalClose_(modal);
    return;
  }

  if (modal.classList.contains("event-details-closing")) return;

  modal.classList.add("event-details-closing");

  var card = modal.querySelector(".event-details-card");
  var finishClose = function(event) {
    if (event && event.animationName !== "eventDetailsCardLiftOut") return;
    finishEventDetailsModalClose_(modal);
  };

  if (card) {
    card.addEventListener("animationend", finishClose);
  }

  eventDetailsCloseTimer = window.setTimeout(function() {
    finishEventDetailsModalClose_(modal);
  }, 1150);
}

function finishEventDetailsModalClose_(modal) {
  if (eventDetailsCloseTimer) {
    window.clearTimeout(eventDetailsCloseTimer);
    eventDetailsCloseTimer = 0;
  }

  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }

  if (eventDetailsEscapeHandler) {
    document.removeEventListener("keydown", eventDetailsEscapeHandler);
    eventDetailsEscapeHandler = null;
  }

  document.body.classList.remove("modal-open");

  if (eventDetailsPreviousFocus &&
    typeof eventDetailsPreviousFocus.focus === "function" &&
    document.body.contains(eventDetailsPreviousFocus)) {
    eventDetailsPreviousFocus.focus();
  }

  eventDetailsPreviousFocus = null;
}

function removeEventDetailsModal_() {
  closeEventDetailsModal(true);
}

function getEventDateBadgeParts_(dateLabel) {
  var match = String(dateLabel || "").trim()
      .match(/^([A-Za-z]{3,9})\s+(\d{1,2})/);

  if (!match) return null;

  return {
    month: match[1].slice(0, 3).toUpperCase(),
    day: match[2],
  };
}

function renderCampaigns(items) {
  if (!items || !items.length) return "";

  return section("Current Campaigns", "Church-Wide Focus", renderExpandableGroup({
    id: "campaigns-grid",
    items: items,
    containerClass: "grid two",
    moreLabel: "See More Campaigns",
    lessLabel: "See Less Campaigns",
    renderItem: function(item) {
      return card({
        title: item.title,
        description: item.description,
        buttonText: item.button_text,
        buttonUrl: item.button_url,
        featured: true,
      });
    },
  }), "current-campaigns");
}

function renderNextSteps(items) {
  if (!items || !items.length) return "";

  return section("Take Your Next Step", "Get Connected", renderExpandableGroup({
    id: "next-steps-grid",
    items: items,
    containerClass: "grid three",
    moreLabel: "See More Next Steps",
    lessLabel: "See Less Next Steps",
    renderItem: function(item) {
      return card({
        title: item.title,
        description: item.description,
        buttonText: item.button_text,
        buttonUrl: item.button_url,
      });
    },
  }), "next-step");
}

function renderServeNeeds(items) {
  serveNeedInterestItemsByKey = {};

  if (!items || !items.length) return "";

  return section("Serve Opportunities", "Make A Difference", renderExpandableGroup({
    id: "serve-needs-grid",
    items: items,
    containerClass: "grid two",
    moreLabel: "See More Opportunities",
    lessLabel: "See Less Opportunities",
    renderItem: function(item) {
      return renderServeNeedCard_(item);
    },
  }));
}

function renderServeNeedCard_(item) {
  var priorityLabel = renderServeNeedPriorityLabel_(item.priority || item.urgency);
  var serveNeedKey = registerServeNeedInterestItem_(item);
  var buttonHtml = serveNeedKey ?
    [
      "<button type=\"button\" class=\"btn\" onclick=\"openServeNeedInterestModal('",
      escapeJsString(String(serveNeedKey || "")),
      "')\">",
      escapeHtml(item.button_text || "Share Interest"),
      "</button>",
    ].join("") :
    button(item.button_text, item.button_url);

  return [
    "<article class=\"card\">",
      (item.ministry || priorityLabel) ?
        "<div class=\"meta\">" +
        escapeHtml([item.ministry, priorityLabel].filter(Boolean).join(" • ")) +
        "</div>" :
        "",
      "<h3>", escapeHtml(item.need || item.title || ""), "</h3>",
      item.description ? "<p>" + escapeHtml(item.description || "") + "</p>" : "",
      buttonHtml,
    "</article>",
  ].join("");
}

function renderServeNeedPriorityLabel_(value) {
  var normalized = String(value || "normal").trim().toLowerCase();

  if (!normalized) return "";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1) + " priority";
}

function findServeNeedById_(serveNeedId) {
  var items = currentCentralData && Array.isArray(currentCentralData.serveNeeds) ?
    currentCentralData.serveNeeds :
    [];

  return items.find(function(item) {
    return String(item && item.id || "").trim() === String(serveNeedId || "").trim();
  }) || null;
}

function registerServeNeedInterestItem_(item) {
  if (!item) {
    return "";
  }

  var contactEmail = getServeNeedContactEmail_(item);
  var hasFirestoreId = String(item && item.source || "").trim() === "Firestore" &&
    !!String(item.id || "").trim();

  if (!hasFirestoreId && !contactEmail) {
    return "";
  }

  var key = hasFirestoreId ?
    "serve-need-id:" + String(item.id || "").trim() :
    "serve-need-inline:" + String(++serveNeedInterestKeyCounter);

  serveNeedInterestItemsByKey[key] = {
    id: hasFirestoreId ? String(item.id || "").trim() : "",
    need: String(item.need || item.title || "").trim(),
    ministry: String(item.ministry || "").trim(),
    priority: String(item.priority || item.urgency || "").trim().toLowerCase(),
    description: String(item.description || "").trim(),
    button_text: String(item.button_text || "Share Interest").trim(),
    button_url: String(item.button_url || "").trim(),
    contact_email: contactEmail,
  };

  return key;
}

function getServeNeedContactEmail_(item) {
  var explicitEmail = String(
      item && (item.contact_email || item.email) || "",
  ).trim();

  if (explicitEmail) {
    return explicitEmail;
  }

  var buttonUrl = String(item && item.button_url || "").trim();

  if (!/^mailto:/i.test(buttonUrl)) {
    return "";
  }

  var address = buttonUrl.replace(/^mailto:/i, "").split("?")[0];

  try {
    address = decodeURIComponent(address);
  } catch (error) {
  }

  return String(address || "").trim();
}

function findServeNeedInterestItem_(serveNeedKey) {
  var normalizedKey = String(serveNeedKey || "").trim();

  if (!normalizedKey) {
    return null;
  }

  if (serveNeedInterestItemsByKey[normalizedKey]) {
    return serveNeedInterestItemsByKey[normalizedKey];
  }

  return findServeNeedById_(normalizedKey);
}

function buildServeNeedFallbackRequestData_(serveNeed) {
  var contactEmail = getServeNeedContactEmail_(serveNeed);

  if (!contactEmail) {
    return null;
  }

  return {
    need: String(serveNeed && (serveNeed.need || serveNeed.title) || "").trim(),
    ministry: String(serveNeed && serveNeed.ministry || "").trim(),
    priority: String(serveNeed && serveNeed.priority || "").trim().toLowerCase(),
    description: String(serveNeed && serveNeed.description || "").trim(),
    button_text: String(
        serveNeed && serveNeed.button_text || "Share Interest",
    ).trim(),
    contact_email: contactEmail,
  };
}

function openServeNeedInterestModal(serveNeedKey) {
  var serveNeed = findServeNeedInterestItem_(serveNeedKey);

  if (!serveNeed) {
    window.alert("That serve opportunity could not be found. Please refresh Central and try again.");
    return;
  }

  closeServeNeedInterestModal_();

  var modal = document.createElement("div");
  modal.id = "central-serve-interest-modal";
  modal.className = "serve-interest-modal";
  modal.innerHTML = [
    "<div class=\"serve-interest-backdrop\" data-serve-interest-close=\"true\"></div>",
    "<div class=\"serve-interest-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"serve-interest-title\">",
      "<button type=\"button\" class=\"serve-interest-close\" aria-label=\"Close serve interest form\" data-serve-interest-close=\"true\">&times;</button>",
      "<div id=\"serve-interest-content\">",
        renderServeNeedInterestForm_(serveNeed),
      "</div>",
    "</div>",
  ].join("");

  modal.addEventListener("click", function(event) {
    var closeTrigger = event.target.closest("[data-serve-interest-close=\"true\"]");
    if (closeTrigger) {
      closeServeNeedInterestModal_();
    }
  });

  var form = modal.querySelector("[data-serve-interest-form]");
  if (form) {
    form.addEventListener("submit", function(event) {
      event.preventDefault();
      submitServeNeedInterest_(form, serveNeed);
    });
  }

  serveNeedInterestEscapeHandler = function(event) {
    if (event.key === "Escape") {
      closeServeNeedInterestModal_();
    }
  };

  document.addEventListener("keydown", serveNeedInterestEscapeHandler);
  document.body.classList.add("modal-open");
  document.body.appendChild(modal);
}

function renderServeNeedInterestForm_(serveNeed) {
  return [
    "<div class=\"serve-interest-kicker\">Serve Opportunity</div>",
    "<div class=\"serve-interest-meta\">",
    escapeHtml([serveNeed.ministry, renderServeNeedPriorityLabel_(serveNeed.priority)]
        .filter(Boolean)
        .join(" • ")),
    "</div>",
    "<h2 class=\"serve-interest-title\" id=\"serve-interest-title\">",
    escapeHtml(serveNeed.need || "Serve Opportunity"),
    "</h2>",
    serveNeed.description ?
      "<p class=\"serve-interest-copy\">" + escapeHtml(serveNeed.description) + "</p>" :
      "",
    "<form class=\"serve-interest-form\" data-serve-interest-form=\"true\">",
      "<label class=\"serve-interest-field\">",
        "<span>Name</span>",
        "<input type=\"text\" name=\"name\" required>",
      "</label>",
      "<label class=\"serve-interest-field\">",
        "<span>Email</span>",
        "<input type=\"email\" name=\"email\" required>",
      "</label>",
      "<label class=\"serve-interest-field\">",
        "<span>Phone</span>",
        "<input type=\"tel\" name=\"phone\">",
      "</label>",
      "<label class=\"serve-interest-field\">",
        "<span>Preferred Contact Method</span>",
        "<select name=\"preferredContactMethod\" required>",
          "<option value=\"email\">Email</option>",
          "<option value=\"text\">Text</option>",
        "</select>",
      "</label>",
      "<label class=\"serve-interest-field serve-interest-field-wide\">",
        "<span>Additional Notes</span>",
        "<textarea name=\"additionalNotes\" rows=\"4\" placeholder=\"Anything you'd like the ministry leader to know?\"></textarea>",
      "</label>",
      "<p class=\"serve-interest-error\" data-serve-interest-error hidden></p>",
      "<div class=\"serve-interest-actions\">",
        "<button type=\"submit\" class=\"btn btn-primary\" data-serve-interest-submit>",
        escapeHtml("Share my interest"),
        "</button>",
      "</div>",
    "</form>",
  ].join("");
}

function submitServeNeedInterest_(formEl, serveNeed) {
  var submitButton = formEl.querySelector("[data-serve-interest-submit]");
  var errorEl = formEl.querySelector("[data-serve-interest-error]");
  var preferredContactMethod =
    String(formEl.elements.preferredContactMethod.value || "").trim().toLowerCase();
  var phone = String(formEl.elements.phone.value || "").trim();

  if (preferredContactMethod === "text" && !phone) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent =
        "Add a phone number if you want the ministry leader to contact you by text.";
    }
    return;
  }

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sharing...";
  }

  fetch(SERVE_NEED_INTEREST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      serveNeedId: String(serveNeed.id || "").trim(),
      serveNeed: String(serveNeed.id || "").trim() ?
        null :
        buildServeNeedFallbackRequestData_(serveNeed),
      name: String(formEl.elements.name.value || "").trim(),
      email: String(formEl.elements.email.value || "").trim(),
      phone: phone,
      preferredContactMethod: preferredContactMethod,
      additionalNotes: String(formEl.elements.additionalNotes.value || "").trim(),
    }),
  })
      .then(function(response) {
        return response.text().then(function(text) {
          var payload = null;

          try {
            payload = text ? JSON.parse(text) : null;
          } catch (error) {
          }

          if (!response.ok) {
            throw new Error(
                payload && payload.error ?
                  payload.error :
                  "We could not submit your interest right now.",
            );
          }

          return payload || {};
        });
      })
      .then(function(payload) {
        var contentEl = document.getElementById("serve-interest-content");
        var need = String(payload.need || serveNeed.need || "").trim();
        var ministry = String(payload.ministry || serveNeed.ministry || "").trim();
        var contactMethodLabel = preferredContactMethod === "text" ? "text" : "email";
        var notificationStatus = String(
            payload && payload.notificationStatus || "",
        ).trim().toLowerCase();
        var followUpCopy = notificationStatus === "not-configured" ?
          "Our team received your interest and will follow up with you soon." :
          "A ministry leader will be reaching out to you by " +
            contactMethodLabel +
            " to talk more about your volunteer interest.";

        if (!contentEl) {
          return;
        }

        contentEl.innerHTML = [
          "<div class=\"serve-interest-kicker\">Thank You</div>",
          "<h2 class=\"serve-interest-title\">Interest Shared</h2>",
          "<p class=\"serve-interest-copy\">",
          escapeHtml(
              "Thanks for sharing your interest in " +
              (need || "this serve opportunity") +
              (ministry ? " with " + ministry : "") +
              ".",
          ),
          "</p>",
          "<p class=\"serve-interest-copy\">",
          escapeHtml(followUpCopy),
          "</p>",
          "<div class=\"serve-interest-actions\">",
            "<button type=\"button\" class=\"btn btn-primary\" data-serve-interest-close=\"true\">Close</button>",
          "</div>",
        ].join("");
      })
      .catch(function(error) {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Share my interest";
        }

        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = error && error.message ?
            error.message :
            "We could not submit your interest right now.";
        }
      });
}

function closeServeNeedInterestModal_() {
  var modal = document.getElementById("central-serve-interest-modal");
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }

  if (serveNeedInterestEscapeHandler) {
    document.removeEventListener("keydown", serveNeedInterestEscapeHandler);
    serveNeedInterestEscapeHandler = null;
  }

  document.body.classList.remove("modal-open");
}

function renderResources(items) {
  if (!items || !items.length) return "";

  return section("Resources", "Helpful Links", renderExpandableGroup({
    id: "resources-grid",
    items: items,
    containerClass: "grid three",
    moreLabel: "See More Resources",
    lessLabel: "See Less Resources",
    renderItem: function(item) {
      return card({
        title: item.title,
        meta: item.type,
        description: item.description,
        buttonText: item.button_text,
        buttonUrl: item.button_url,
      });
    },
  }), "resources");
}

function renderQuickLinks(items) {
  var links = (items || []).filter(function(item) {
    return item && item.url && !isSundayOnlyQuickLink_(item);
  });

  if (!links.length) return "";

  return [
    "<section class=\"section\">",
      "<div class=\"section-head\">",
        "<div>",
          "<div class=\"section-kicker\">Fast Access</div>",
          "<h2 class=\"section-title\">Quick Links</h2>",
        "</div>",
      "</div>",
      renderExpandableGroup({
        id: "quick-links-list",
        items: links,
        containerClass: "quick-links",
        moreLabel: "See More Links",
        lessLabel: "See Less Links",
        renderItem: function(item) {
          return "<a " + buildLinkAttrs_(item.url) + ">" + escapeHtml(item.title) + "</a>";
        },
      }),
    "</section>",
  ].join("");
}

function isSundayOnlyQuickLink_(item) {
  var value = item && item.sunday_only;
  return value === true || String(value || "").toLowerCase() === "true";
}

function renderExpandableGroup(options) {
  var items = options.items || [];
  var initialLimit = getVisibleLimit(
      typeof options.desktopLimit === "number" ? options.desktopLimit : items.length,
  );
  var visibleItems = items.slice(0, initialLimit);
  var extraItems = items.slice(initialLimit);
  var hasMore = extraItems.length > 0;
  var drawerId = options.id + "-drawer";

  return [
    "<div class=\"expandable-group\">",
      "<div class=\"", options.containerClass, "\" id=\"", escapeAttr(options.id), "\">",
        visibleItems.map(function(item) {
          return [
            "<div class=\"expandable-slot\">",
              options.renderItem(item),
            "</div>",
          ].join("");
        }).join(""),
      "</div>",
      hasMore ? [
        "<div class=\"expandable-drawer\" id=\"", escapeAttr(drawerId), "\" hidden aria-hidden=\"true\">",
          "<div class=\"expandable-drawer-inner\">",
            "<div class=\"", options.containerClass, " expandable-drawer-grid\">",
              extraItems.map(function(item) {
                return [
                  "<div class=\"expandable-slot\">",
                    options.renderItem(item),
                  "</div>",
                ].join("");
              }).join(""),
            "</div>",
          "</div>",
        "</div>",
      ].join("") : "",
    "</div>",
    hasMore ? [
      "<div class=\"see-more-wrap\">",
        "<button class=\"see-more-btn\" type=\"button\"",
          " data-expanded=\"false\"",
          " data-target-id=\"", escapeAttr(drawerId), "\"",
          " data-more-label=\"", escapeAttr(options.moreLabel || "See More"), "\"",
          " data-less-label=\"", escapeAttr(options.lessLabel || "See Less"), "\"",
          " onclick=\"toggleExpandable(this)\">",
          escapeHtml(options.moreLabel || "See More"),
        "</button>",
      "</div>",
    ].join("") : "",
  ].join("");
}

function toggleExpandable(buttonEl) {
  var drawerId = buttonEl.getAttribute("data-target-id");
  var drawer = document.getElementById(drawerId);
  if (!drawer) return;
  if (buttonEl.disabled) return;

  var slots = Array.from(drawer.querySelectorAll(".expandable-slot"));
  var isExpanded = buttonEl.getAttribute("data-expanded") === "true";
  var moreLabel = buttonEl.getAttribute("data-more-label") || "See More";
  var lessLabel = buttonEl.getAttribute("data-less-label") || "See Less";

  if (isExpanded) {
    collapseExpandableDrawer_(buttonEl, drawer, slots, moreLabel);
    return;
  }

  expandExpandableDrawer_(buttonEl, drawer, slots, lessLabel);
}

function expandExpandableDrawer_(buttonEl, drawer, slots, lessLabel) {
  buttonEl.disabled = true;
  drawer.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.style.height = "0px";
  drawer.style.opacity = "0";
  drawer.style.overflow = "hidden";
  drawer.style.transform = "translateY(-8px)";
  drawer.style.willChange = "height, opacity, transform";
  drawer.style.transition = "";

  slots.forEach(function(slot) {
    slot.classList.remove("expandable-visible");
    slot.classList.remove("expandable-leave");
    slot.style.animationDelay = "";
  });

  var endHeight = drawer.scrollHeight;

  slots.forEach(function(slot, index) {
    slot.style.animationDelay = (index * 90) + "ms";
    slot.classList.add("expandable-visible");

    var handleAnimationEnd = function(event) {
      if (event.animationName !== "expandableReveal") return;
      slot.style.animationDelay = "";
      slot.removeEventListener("animationend", handleAnimationEnd);
    };

    slot.addEventListener("animationend", handleAnimationEnd);
  });

  buttonEl.setAttribute("data-expanded", "true");
  buttonEl.textContent = lessLabel;

  transitionExpandableDrawer_(drawer, endHeight, function() {
    drawer.style.height = "";
    drawer.style.overflow = "";
    drawer.style.willChange = "";
    buttonEl.disabled = false;
  });
}

function collapseExpandableDrawer_(buttonEl, drawer, slots, moreLabel) {
  buttonEl.disabled = true;
  drawer.style.height = drawer.offsetHeight + "px";
  drawer.style.opacity = "1";
  drawer.style.overflow = "hidden";
  drawer.style.transform = "translateY(0)";
  drawer.style.willChange = "height, opacity, transform";
  drawer.style.transition = "";

  slots.slice().reverse().forEach(function(slot, index) {
    slot.classList.remove("expandable-visible");
    slot.classList.remove("expandable-leave");
    slot.style.animationDelay = (index * 45) + "ms";
    slot.classList.add("expandable-leave");

    var handleAnimationEnd = function(event) {
      if (event.animationName !== "expandableHide") return;
      slot.style.animationDelay = "";
      slot.removeEventListener("animationend", handleAnimationEnd);
    };

    slot.addEventListener("animationend", handleAnimationEnd);
  });

  buttonEl.setAttribute("data-expanded", "false");
  buttonEl.textContent = moreLabel;

  window.requestAnimationFrame(function() {
    drawer.style.transition =
      "height " + EXPANDABLE_FLOW_DURATION_MS + "ms cubic-bezier(0.16, 1, 0.3, 1), " +
      "opacity " + EXPANDABLE_FLOW_DURATION_MS + "ms ease, " +
      "transform " + EXPANDABLE_FLOW_DURATION_MS + "ms ease";
    drawer.style.height = "0px";
    drawer.style.opacity = "0";
    drawer.style.transform = "translateY(-8px)";
  });

  window.setTimeout(function() {
    slots.forEach(function(slot) {
      slot.classList.remove("expandable-leave");
      slot.style.animationDelay = "";
    });
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    drawer.style.height = "";
    drawer.style.opacity = "";
    drawer.style.overflow = "";
    drawer.style.transform = "";
    drawer.style.transition = "";
    drawer.style.willChange = "";
    buttonEl.disabled = false;
  }, EXPANDABLE_FLOW_DURATION_MS + 90);
}

function transitionExpandableDrawer_(drawer, endHeight, onDone) {
  var finished = false;

  var cleanup = function() {
    if (finished) return;
    finished = true;
    drawer.removeEventListener("transitionend", handleTransitionEnd);
    drawer.style.transition = "";
    drawer.style.opacity = "";
    drawer.style.transform = "";
    if (onDone) onDone();
  };

  var handleTransitionEnd = function(event) {
    if (event.target !== drawer || event.propertyName !== "height") return;
    cleanup();
  };

  drawer.addEventListener("transitionend", handleTransitionEnd);

  window.requestAnimationFrame(function() {
    drawer.style.transition =
      "height " + EXPANDABLE_FLOW_DURATION_MS + "ms cubic-bezier(0.16, 1, 0.3, 1), " +
      "opacity " + EXPANDABLE_FLOW_DURATION_MS + "ms ease, " +
      "transform " + EXPANDABLE_FLOW_DURATION_MS + "ms ease";
    drawer.style.height = endHeight + "px";
    drawer.style.opacity = "1";
    drawer.style.transform = "translateY(0)";
  });

  window.setTimeout(cleanup, EXPANDABLE_FLOW_DURATION_MS + 90);
}

function section(title, kicker, content, id) {
  return [
    "<section class=\"section\" ", (id ? "id=\"" + escapeAttr(id) + "\"" : ""), ">",
      "<div class=\"section-head\">",
        "<div>",
          "<div class=\"section-kicker\">", escapeHtml(kicker), "</div>",
          "<h2 class=\"section-title\">", escapeHtml(title), "</h2>",
        "</div>",
      "</div>",
      content,
    "</section>",
  ].join("");
}

function card(options) {
  var primaryButtonHtml = options.buttonHtml ||
    button(options.buttonText, options.buttonUrl);
  var hasPrimaryButton = Boolean(primaryButtonHtml);
  var hasBottomButton = options.bottomButtonText && options.bottomButtonUrl;
  var heading = [
    options.preHeadingHtml || "",
    options.meta ?
      "<div class=\"meta\">" + escapeHtml(options.meta) + "</div>" :
      "",
    "<h3>", escapeHtml(options.title || ""), "</h3>",
  ].join("");

  return [
    "<article class=\"card ", (options.featured ? "featured" : ""), " ", (options.extraClass || ""), "\">",
      heading,
      options.description ? "<p>" + escapeHtml(options.description || "") + "</p>" : "",
      hasBottomButton ? [
        "<div class=\"card-actions ", (hasPrimaryButton ? "" : "calendar-only"), "\">",
          primaryButtonHtml,
          calendarButton_(
              options.bottomButtonText,
              options.bottomButtonUrl,
              options.calendarFileUrl,
              options.title,
          ),
        "</div>",
      ].join("") : primaryButtonHtml,
    "</article>",
  ].join("");
}

function calendarButton_(text, url, calendarFileUrl, eventTitle) {
  if (!text || !url) return "";

  var cleanUrl = String(url).trim();
  var cleanCalendarFileUrl = String(calendarFileUrl || "").trim();
  var menuId = "event-calendar-menu-" + (++calendarMenuIdCounter);
  var accessibleLabel = "Add " + String(eventTitle || "this event") +
    " to a calendar";

  return [
    "<div class=\"event-calendar-control\">",
      "<button type=\"button\" class=\"btn event-calendar-btn\"",
        " aria-label=\"", escapeAttr(accessibleLabel), "\"",
        " aria-haspopup=\"menu\" aria-expanded=\"false\"",
        " aria-controls=\"", escapeAttr(menuId), "\"",
        " onclick=\"toggleCalendarMenu_(event, '", escapeJsString(menuId), "')\">",
        "<img class=\"event-calendar-logo\" src=\"/google-calendar-logo.svg\" alt=\"\" aria-hidden=\"true\">",
        "<span>", escapeHtml(text), "</span>",
      "</button>",
      "<div class=\"event-calendar-menu\" id=\"", escapeAttr(menuId), "\" role=\"menu\" hidden>",
        calendarMenuOption_(
            "Google Calendar",
            cleanUrl,
            "google",
        ),
        cleanCalendarFileUrl ? calendarMenuOption_(
            "Apple Calendar",
            cleanCalendarFileUrl,
            "apple",
        ) : "",
        cleanCalendarFileUrl ? calendarMenuOption_(
            "Outlook Calendar",
            appendUrlQueryParam_(cleanCalendarFileUrl, "download", "1"),
            "outlook",
        ) : "",
      "</div>",
    "</div>",
  ].join("");
}

function calendarMenuOption_(title, url, provider) {
  var iconUrl = getCalendarProviderIcon_(provider);

  return [
    "<a class=\"event-calendar-option\" role=\"menuitem\" ",
      buildLinkAttrs_(url),
      " data-calendar-provider=\"", escapeAttr(provider), "\"",
      " onclick=\"closeCalendarMenus_()\">",
      iconUrl ? [
        "<img class=\"event-calendar-provider-icon\" src=\"",
          escapeAttr(iconUrl),
          "\" alt=\"\" aria-hidden=\"true\">",
      ].join("") : "",
      "<strong>", escapeHtml(title), "</strong>",
    "</a>",
  ].join("");
}

function getCalendarProviderIcon_(provider) {
  var icons = {
    google: "/google-calendar-logo.svg",
    apple: "/apple-calendar-icon.jpg",
    outlook: "/outlook-calendar-icon.jpg",
  };

  return icons[provider] || "";
}

function appendUrlQueryParam_(url, name, value) {
  return String(url || "") +
    (String(url || "").indexOf("?") === -1 ? "?" : "&") +
    encodeURIComponent(name) + "=" + encodeURIComponent(value);
}

function toggleCalendarMenu_(event, menuId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  var menu = document.getElementById(menuId);
  if (!menu) return;

  var shouldOpen = menu.hidden;
  closeCalendarMenus_(menuId);
  menu.hidden = !shouldOpen;

  var button = menu.parentElement &&
    menu.parentElement.querySelector(".event-calendar-btn");
  if (button) {
    button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }
}

function closeCalendarMenus_(exceptMenuId) {
  document.querySelectorAll(".event-calendar-menu:not([hidden])")
      .forEach(function(menu) {
        if (menu.id === exceptMenuId) return;

        menu.hidden = true;
        var button = menu.parentElement &&
          menu.parentElement.querySelector(".event-calendar-btn");
        if (button) {
          button.setAttribute("aria-expanded", "false");
        }
      });
}

function button(text, url, className) {
  if (!text || !url) return "";

  var cleanUrl = String(url).trim();
  var extraClass = className || "";

  return "<a class=\"btn " + extraClass + "\" " + buildLinkAttrs_(cleanUrl) + ">" +
    escapeHtml(text) + "</a>";
}

function buildLinkAttrs_(url) {
  var cleanUrl = String(url || "").trim();

  if (cleanUrl.startsWith("#")) {
    return "href=\"" + escapeAttr(cleanUrl) +
      "\" onclick=\"scrollToSection(event, '" + escapeJsString(cleanUrl) + "')\"";
  }

  return "href=\"" + escapeAttr(cleanUrl) + "\" target=\"_blank\" rel=\"noopener\"";
}

function resolveSectionSelector_(selector) {
  var aliases = {
    "#sermon-notes": "#notes",
  };

  return aliases[selector] || selector;
}

function scrollToSection(event, selector) {
  if (event) event.preventDefault();

  var target = document.querySelector(resolveSectionSelector_(selector));
  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function groupBy(items, key) {
  return (items || []).reduce(function(acc, item) {
    var group = item[key] || "General";
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

function findSundayLink(items, pattern) {
  return (items || []).find(function(item) {
    return item.url && pattern.test(String(item.title || ""));
  });
}

function buildYouVersionSearchUrl_(reference) {
  return "https://www.bible.com/search/bible?q=" +
    encodeURIComponent(String(reference || "").trim());
}

function getSundayScriptureConfig_(data) {
  var sunday = (data && data.sunday) || {};
  var sundaySettings = (data && data.sundaySettings) || {};
  var reference = String(
      sundaySettings.sunday_scripture_reference || sunday.scripture || "",
  ).trim();

  return {
    reference: reference,
    versionId: String(
        sundaySettings.sunday_scripture_bible_id || "2692",
    ).trim(),
    title: String(
        sundaySettings.sunday_scripture_title || "Bible Reader",
    ).trim(),
    helperText: String(
        sundaySettings.sunday_scripture_helper_text ||
        "Follow along with today’s passage and search anywhere in Scripture beside your notes.",
    ).trim(),
    theme: getResolvedCentralTheme_(),
    appKey: String((data && data.youVersionAppKey) || "").trim(),
  };
}

async function initSundayScripture(data) {
  var mountEl = document.getElementById("sunday-scripture-mount");
  if (!mountEl) return;

  var requestId = ++sundayScriptureMountRequestId;
  var config = getSundayScriptureConfig_(data);
  mountEl.innerHTML = [
    "<div class=\"yv-reader-loading\">",
      "<div class=\"spinner\"></div>",
      "<p>Loading YouVersion reader...</p>",
    "</div>",
  ].join("");

  ensureYouVersionReaderStyles_();

  try {
    var module = await loadYouVersionReaderModule_();
    if (requestId !== sundayScriptureMountRequestId || !mountEl.isConnected) return;
    sundayScriptureUnmount = module.mountYouVersionReader(mountEl, config);
  } catch (error) {
    if (requestId !== sundayScriptureMountRequestId || !mountEl.isConnected) return;
    renderSundayScriptureFallback_(mountEl, config, error);
  }
}

function teardownSundayScripture_() {
  sundayScriptureMountRequestId++;

  if (!sundayScriptureUnmount) return;

  try {
    sundayScriptureUnmount();
  } catch (error) {
  }

  sundayScriptureUnmount = null;
}

function ensureYouVersionReaderStyles_() {
  if (youVersionReaderStylesLoaded) return;

  var existingLink = document.getElementById("youversion-reader-styles");
  if (existingLink) {
    youVersionReaderStylesLoaded = true;
    return;
  }

  var linkEl = document.createElement("link");
  linkEl.id = "youversion-reader-styles";
  linkEl.rel = "stylesheet";
  linkEl.href = "/youversion-reader.css";
  document.head.appendChild(linkEl);
  youVersionReaderStylesLoaded = true;
}

function loadYouVersionReaderModule_() {
  if (!youVersionReaderModulePromise) {
    youVersionReaderModulePromise = import(YOUVERSION_READER_MODULE_URL);
  }

  return youVersionReaderModulePromise;
}

function renderSundayScriptureFallback_(mountEl, config, error) {
  if (!mountEl) return;

  mountEl.innerHTML = [
    "<div class=\"yv-reader-shell\">",
      "<div class=\"sunday-scripture-head\">",
        "<div>",
          "<div class=\"section-kicker\">Powered by YouVersion</div>",
          "<h3>", escapeHtml(config.title || "Bible Reader"), "</h3>",
        "</div>",
        "<span class=\"pill yv-reader-pill\">Bible Reader</span>",
      "</div>",
      config.helperText ?
        "<p class=\"sunday-scripture-copy\">" + escapeHtml(config.helperText) + "</p>" :
        "",
      "<div class=\"sunday-scripture-reference", (config.reference ? "" : " is-empty"), "\">",
        escapeHtml(
            config.reference ||
            "Today’s reference has not been added yet. Search any chapter in YouVersion.",
        ),
      "</div>",
      "<div class=\"yv-reader-fallback\">",
        "<p>",
          escapeHtml(
              config.appKey ?
                "The YouVersion reader could not load right now, but you can still open YouVersion in a new tab." :
                "Add your YouVersion app key to functions/.env to enable the full reader in Central.",
          ),
        "</p>",
        error && error.message ?
          "<p>" + escapeHtml(error.message) + "</p>" :
          "",
        "<a class=\"see-more-btn\" href=\"", escapeAttr(buildYouVersionSearchUrl_(config.reference || "John 3")), "\" target=\"_blank\" rel=\"noopener\">Open In YouVersion</a>",
      "</div>",
    "</div>",
  ].join("");
}

function initSundayNotes(data) {
  var input = document.getElementById("sunday-notes-input");
  if (!input) return;

  sundayNotesStorageKey = getSundayNotesStorageKey(data.sunday || {});
  sundayNotesSeed = data.sunday || {};

  var savedNotes = localStorage.getItem(sundayNotesStorageKey);
  setSundayNotesEditorContent_(input, savedNotes || buildSundayNotesTemplate());
  setSundayNotesStatus(
      getSundayNotesPlainText_(input).trim() ?
        "Saved on this device" :
        "Ready to save on this device",
  );

  input.addEventListener("input", function() {
    persistSundayNotesInput_(input);
  });

  input.addEventListener("paste", function(event) {
    handleSundayNotesPaste_(event, input);
  });

  input.addEventListener("keyup", function() {
    updateSundayNotesToolbarState_();
  });

  input.addEventListener("mouseup", function() {
    updateSundayNotesToolbarState_();
  });

  input.addEventListener("focus", function() {
    updateSundayNotesToolbarState_();
  });

  input.addEventListener("blur", function() {
    window.setTimeout(updateSundayNotesToolbarState_, 0);
  });

  bindSundayNotesToolbarListeners_();
  updateSundayNotesToolbarState_();
}

function getSundayNotesStorageKey(sunday) {
  return "central-sermon-notes-" + String((sunday && sunday.date) || "default").trim();
}

function buildSundayNotesTemplate() {
  return "";
}

function persistSundayNotesInput_(input) {
  if (!input) return;

  localStorage.setItem(sundayNotesStorageKey, JSON.stringify({
    type: "rich-text-v1",
    html: getSundayNotesEditorHtml_(input),
  }));
  setSundayNotesStatus("Saved just now");
}

function formatSundayNotes(action) {
  var input = document.getElementById("sunday-notes-input");
  if (!input) return;

  input.focus();
  if (document.execCommand) {
    document.execCommand("styleWithCSS", false, false);
  }

  if (action === "bold") {
    document.execCommand("bold", false, null);
  } else if (action === "italic") {
    document.execCommand("italic", false, null);
  } else if (action === "bullets") {
    document.execCommand("insertUnorderedList", false, null);
  } else if (action === "numbered") {
    document.execCommand("insertOrderedList", false, null);
  }

  persistSundayNotesInput_(input);
  window.setTimeout(updateSundayNotesToolbarState_, 0);
}

function bindSundayNotesToolbarListeners_() {
  if (sundayNotesToolbarListenersBound) return;

  document.addEventListener("selectionchange", function() {
    updateSundayNotesToolbarState_();
  });

  sundayNotesToolbarListenersBound = true;
}

function updateSundayNotesToolbarState_() {
  var buttons = Array.from(document.querySelectorAll(".notes-format-btn[data-format]"));
  if (!buttons.length) return;

  var input = document.getElementById("sunday-notes-input");
  var selectionInsideEditor = isSundayNotesSelectionInsideEditor_(input);

  buttons.forEach(function(button) {
    var format = button.getAttribute("data-format") || "";
    var isActive = selectionInsideEditor && getSundayNotesFormatState_(format);

    button.classList.toggle("active", !!isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function isSundayNotesSelectionInsideEditor_(input) {
  if (!input) return false;

  var selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;

  var anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  return input.contains(anchorNode);
}

function getSundayNotesFormatState_(format) {
  try {
    if (format === "bold") {
      return document.queryCommandState("bold");
    }

    if (format === "italic") {
      return document.queryCommandState("italic");
    }

    if (format === "bullets") {
      return document.queryCommandState("insertUnorderedList");
    }

    if (format === "numbered") {
      return document.queryCommandState("insertOrderedList");
    }
  } catch (error) {
  }

  return false;
}

function setSundayNotesEditorContent_(input, storedValue) {
  if (!input) return;

  var html = parseStoredSundayNotesHtml_(storedValue);
  input.innerHTML = html || "";
}

function parseStoredSundayNotesHtml_(storedValue) {
  var raw = String(storedValue || "");
  if (!raw.trim()) return "";

  try {
    var parsed = JSON.parse(raw);
    if (parsed && parsed.type === "rich-text-v1") {
      return String(parsed.html || "");
    }
  } catch (error) {
  }

  return legacySundayNotesTextToHtml_(raw);
}

function legacySundayNotesTextToHtml_(text) {
  var normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  return parseSundayNotesMarkdownBlocks_(normalized).map(function(block) {
    if (block.type === "paragraph") {
      return "<div>" +
        renderMarkdownInline_(block.lines.join("\n")).replace(/\n/g, "<br>") +
        "</div>";
    }

    return renderMarkdownListCollectionHtml_([block]);
  }).join("");
}

function getSundayNotesEditorHtml_(input) {
  return String((input && input.innerHTML) || "").trim();
}

function getSundayNotesPlainText_(input) {
  return String((input && input.innerText) || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n");
}

function handleSundayNotesPaste_(event, input) {
  if (!event) return;

  event.preventDefault();

  var pastedText = "";

  if (event.clipboardData && event.clipboardData.getData) {
    pastedText = event.clipboardData.getData("text/plain");
  } else if (window.clipboardData && window.clipboardData.getData) {
    pastedText = window.clipboardData.getData("Text");
  }

  insertPlainTextIntoSundayNotes_(input, pastedText);
  persistSundayNotesInput_(input);
}

function insertPlainTextIntoSundayNotes_(input, text) {
  if (!input) return;

  input.focus();

  if (document.execCommand) {
    document.execCommand("insertText", false, String(text || ""));
    return;
  }

  var selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  var range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(String(text || "")));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function syncSundayNotesSaveButton_(data) {
  if (!document.getElementById("save-notes-doc-btn")) return;

  setSundayNotesGoogleDocsControlsVisible_(false);

  var googleDocsConfig = getGoogleNotesConfig_(data);

  if (googleDocsConfig.clientId !== googleNotesClientId) {
    resetGoogleNotesAuthState_(googleDocsConfig.clientId);
  }

  if (!googleDocsConfig.enabled) {
    return;
  }

  if (!googleDocsConfig.clientId) {
    return;
  }

  setSundayNotesGoogleDocsControlsVisible_(true);

  if (googleNotesClientReady && googleNotesTokenClient) {
    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    return;
  }

  setSundayNotesSaveButtonState("Preparing Google Docs...", true);
  warmGoogleNotesAuth_();
}

function getGoogleNotesConfig_(data) {
  var sundaySettings = data && data.sundaySettings ? data.sundaySettings : {};
  var enabled = getGoogleNotesEnabledValue_(data, sundaySettings);
  var clientId = String(
      (data && data.googleWebClientId) ||
      sundaySettings.googleWebClientId ||
      sundaySettings.google_web_client_id ||
      "",
  ).trim();

  return {
    enabled: enabled,
    clientId: clientId,
  };
}

function getGoogleNotesEnabledValue_(data, sundaySettings) {
  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "googleDocsEnabled")
  ) {
    return normalizeCentralBooleanValue_(data.googleDocsEnabled, true);
  }

  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "google_docs_enabled")
  ) {
    return normalizeCentralBooleanValue_(data.google_docs_enabled, true);
  }

  if (
    sundaySettings &&
    Object.prototype.hasOwnProperty.call(sundaySettings, "googleDocsEnabled")
  ) {
    return normalizeCentralBooleanValue_(sundaySettings.googleDocsEnabled, true);
  }

  if (
    sundaySettings &&
    Object.prototype.hasOwnProperty.call(sundaySettings, "google_docs_enabled")
  ) {
    return normalizeCentralBooleanValue_(sundaySettings.google_docs_enabled, true);
  }

  return true;
}

function getCalendarIntegrationsEnabledValue_(data) {
  var sundaySettings = data && data.sundaySettings ? data.sundaySettings : {};

  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "calendarIntegrationsEnabled")
  ) {
    return normalizeCentralBooleanValue_(
        data.calendarIntegrationsEnabled,
        true,
    );
  }

  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "calendar_integrations_enabled")
  ) {
    return normalizeCentralBooleanValue_(
        data.calendar_integrations_enabled,
        true,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
        sundaySettings,
        "calendarIntegrationsEnabled",
    )
  ) {
    return normalizeCentralBooleanValue_(
        sundaySettings.calendarIntegrationsEnabled,
        true,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
        sundaySettings,
        "calendar_integrations_enabled",
    )
  ) {
    return normalizeCentralBooleanValue_(
        sundaySettings.calendar_integrations_enabled,
        true,
    );
  }

  return true;
}

function normalizeCentralBooleanValue_(value, defaultValue) {
  if (value === true || value === false) {
    return value;
  }

  if (value == null || String(value).trim() === "") {
    return !!defaultValue;
  }

  var normalized = String(value).trim().toLowerCase();

  return normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on";
}

function resetGoogleNotesAuthState_(nextClientId) {
  googleNotesTokenClient = null;
  googleNotesAccessToken = "";
  googleNotesTokenExpiresAt = 0;
  googleNotesClientId = String(nextClientId || "").trim();
  googleNotesClientReady = false;
  googleNotesWarmupPromise = null;
  googleNotesPendingResolve = null;
  googleNotesPendingReject = null;
}

async function copySundayNotes() {
  var input = document.getElementById("sunday-notes-input");
  if (!input) return;

  var plainText = getSundayNotesPlainText_(input);

  try {
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], {type: "text/plain"}),
          "text/html": new Blob([getSundayNotesEditorHtml_(input)], {type: "text/html"}),
        }),
      ]);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText);
    } else {
      selectSundayNotesEditorContents_(input);
      document.execCommand("copy", false, null);
    }
  } catch (error) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText);
    }
  }

  setSundayNotesStatus("Copied to clipboard");
}

function selectSundayNotesEditorContents_(input) {
  if (!input) return;

  var selection = window.getSelection();
  var range = document.createRange();

  range.selectNodeContents(input);
  selection.removeAllRanges();
  selection.addRange(range);
}

function clearSundayNotes() {
  var input = document.getElementById("sunday-notes-input");
  if (!input) return;

  if (!window.confirm("Clear your saved sermon notes on this device?")) return;

  input.innerHTML = "";
  localStorage.removeItem(sundayNotesStorageKey);
  setSundayNotesStatus("Notes cleared");
}

function setSundayNotesStatus(message, persist) {
  var status = document.getElementById("sunday-notes-status");
  if (!status) return;

  status.textContent = message;
  clearTimeout(setSundayNotesStatus.timerId);

  if (persist) return;

  setSundayNotesStatus.timerId = window.setTimeout(function() {
    status.textContent = "Saved on this device";
  }, 1600);
}

function warmGoogleNotesAuth_() {
  if (googleNotesClientReady && googleNotesTokenClient) {
    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    return Promise.resolve(googleNotesTokenClient);
  }

  if (googleNotesWarmupPromise) {
    return googleNotesWarmupPromise;
  }

  googleNotesWarmupPromise = promiseWithTimeout_(
      initGoogleTokenClient_(),
      GOOGLE_NOTES_INIT_TIMEOUT_MS,
      "Google Sign-In is taking longer than expected. Refresh the page and try again.",
  ).then(function(tokenClient) {
    googleNotesClientReady = true;
    googleNotesWarmupPromise = null;
    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    return tokenClient;
  }).catch(function(error) {
    googleNotesClientReady = false;
    googleNotesTokenClient = null;
    googleNotesWarmupPromise = null;
    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    setSundayNotesStatus(
        error && error.message ?
          error.message :
          "Google Sign-In could not finish loading.",
        true,
    );
    throw error;
  });

  return googleNotesWarmupPromise;
}

function ensureGoogleIdentityLoaded() {
  return new Promise(function(resolve, reject) {
    if (googleIdentityReady && window.google && google.accounts && google.accounts.oauth2) {
      resolve();
      return;
    }

    var existingScript = document.getElementById("google-gsi-script");

    if (existingScript) {
      waitForGoogleIdentity_(resolve, reject, 0);
      return;
    }

    var script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = function() {
      waitForGoogleIdentity_(resolve, reject, 0);
    };

    script.onerror = function() {
      reject(new Error("Could not load Google Sign-In."));
    };

    document.head.appendChild(script);
  });
}

function waitForGoogleIdentity_(resolve, reject, tries) {
  if (window.google && google.accounts && google.accounts.oauth2) {
    googleIdentityReady = true;
    resolve();
    return;
  }

  if (tries > 40) {
    reject(new Error("Google Sign-In did not finish loading."));
    return;
  }

  window.setTimeout(function() {
    waitForGoogleIdentity_(resolve, reject, tries + 1);
  }, 250);
}

function promiseWithTimeout_(promise, timeoutMs, message) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    var timerId = window.setTimeout(function() {
      if (settled) return;
      settled = true;
      reject(new Error(message || "This is taking longer than expected."));
    }, Math.max(250, Number(timeoutMs) || 0));

    Promise.resolve(promise).then(function(value) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      resolve(value);
    }).catch(function(error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      reject(error);
    });
  });
}

async function initGoogleTokenClient_() {
  var googleDocsConfig = getGoogleNotesConfig_(currentCentralData);
  var clientId = googleDocsConfig.clientId;

  if (!clientId) {
    throw new Error("Google Docs saving is not configured yet.");
  }

  if (googleNotesClientId !== clientId) {
    resetGoogleNotesAuthState_(clientId);
  }

  if (googleNotesTokenClient) return googleNotesTokenClient;

  await ensureGoogleIdentityLoaded();

  googleNotesTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_NOTES_SCOPE,
    callback: handleGoogleTokenResponse_,
    error_callback: handleGoogleTokenError_,
  });

  return googleNotesTokenClient;
}

function requestGoogleNotesAccessToken(promptMode) {
  return new Promise(function(resolve, reject) {
    if (!googleNotesTokenClient) {
      reject(new Error("Google Sign-In is still getting ready. Try again in a moment."));
      return;
    }

    googleNotesPendingResolve = resolve;
    googleNotesPendingReject = reject;

    googleNotesTokenClient.requestAccessToken({
      prompt: promptMode,
    });
  });
}

function handleGoogleTokenResponse_(response) {
  if (!googleNotesPendingResolve || !googleNotesPendingReject) return;

  var resolve = googleNotesPendingResolve;
  var reject = googleNotesPendingReject;

  googleNotesPendingResolve = null;
  googleNotesPendingReject = null;

  if (!response) {
    reject(new Error("No response was returned from Google Sign-In."));
    return;
  }

  if (response.error) {
    reject(new Error(response.error_description || response.error));
    return;
  }

  if (!response.access_token) {
    reject(new Error("No access token was returned."));
    return;
  }

  googleNotesAccessToken = response.access_token;
  googleNotesTokenExpiresAt = Date.now() +
    (Math.max(Number(response.expires_in || 0) - 60, 0) * 1000);
  resolve(googleNotesAccessToken);
}

function handleGoogleTokenError_(error) {
  if (!googleNotesPendingReject) return;

  var reject = googleNotesPendingReject;

  googleNotesPendingResolve = null;
  googleNotesPendingReject = null;

  if (error && error.type === "popup_failed_to_open") {
    reject(new Error("Google Sign-In popup was blocked. Allow pop-ups for this site, then tap Save again."));
    return;
  }

  if (error && error.type === "popup_closed") {
    reject(new Error("Google Sign-In was closed before it finished. Tap Save again when you're ready."));
    return;
  }

  reject(new Error("Google Sign-In could not finish."));
}

function ensureGoogleNotesAccess() {
  if (googleNotesAccessToken && Date.now() < googleNotesTokenExpiresAt) {
    return Promise.resolve(googleNotesAccessToken);
  }

  return requestGoogleNotesAccessToken(googleNotesAccessToken ? "" : "consent");
}

function setSundayNotesSaveButtonState(label, disabled) {
  var buttonEl = document.getElementById("save-notes-doc-btn");
  if (!buttonEl) return;

  buttonEl.textContent = label;
  buttonEl.disabled = !!disabled;
}

function setSundayNotesSaveButtonVisibility_(visible) {
  var buttonEl = document.getElementById("save-notes-doc-btn");
  if (!buttonEl) return;

  buttonEl.hidden = !visible;
}

function setSundayNotesGoogleDocsControlsVisible_(visible) {
  setSundayNotesSaveButtonVisibility_(visible);

  if (!visible) {
    clearSavedDocLink_();
  }
}

function setSavedDocLink_(docUrl) {
  var linkEl = document.getElementById("open-notes-doc-link");
  if (!linkEl) return;

  sundayNotesLastDocUrl = docUrl || "";

  if (!sundayNotesLastDocUrl) {
    linkEl.hidden = true;
    linkEl.setAttribute("href", "#");
    return;
  }

  linkEl.hidden = false;
  linkEl.setAttribute("href", sundayNotesLastDocUrl);
}

function clearSavedDocLink_() {
  setSavedDocLink_("");
}

function buildSundayNotesDocTitle() {
  var sunday = (currentCentralData && currentCentralData.sunday) || {};
  var sermonTitle = String(sunday.sermon_title || "Sunday Notes").trim();
  var sermonDate = String(sunday.date || "").trim();

  return sermonDate ?
    "CrossPointe Notes - " + sermonTitle + " - " + sermonDate :
    "CrossPointe Notes - " + sermonTitle;
}

function buildSundayNotesDocPayload_(notesHtml) {
  var data = currentCentralData || {};
  var sunday = data.sunday || {};
  var settings = data.settings || {};
  var state = {
    text: "",
    cursor: 1,
    styleRequests: [],
    listRequests: [],
  };

  appendDocPlainLine_(state, String(settings.site_title || "CrossPointe Central"), {bold: true});
  appendDocBlankLine_(state);
  appendDocPlainLine_(state, "Sunday Notes", {bold: true});

  if (sunday.date) appendDocLabelLine_(state, "Date: ", sunday.date);
  if (sunday.sermon_title) appendDocLabelLine_(state, "Sermon: ", sunday.sermon_title);
  if (sunday.speaker) appendDocLabelLine_(state, "Speaker: ", sunday.speaker);
  if (sunday.scripture) appendDocLabelLine_(state, "Scripture: ", sunday.scripture);

  appendDocBlankLine_(state);

  parseSundayNotesHtmlBlocks_(notesHtml).forEach(function(block, index, blocks) {
    if (block.type === "paragraph") {
      appendDocRunsBlock_(state, block.runs, "\n");
    } else if (block.type === "ul" || block.type === "ol") {
      appendDocRunsListBlock_(state, block);
    }

    if (index < blocks.length - 1) {
      appendDocBlankLine_(state);
    }
  });

  return {
    text: state.text,
    requests: state.styleRequests.concat(state.listRequests),
  };
}

function appendDocPlainLine_(state, text, style) {
  var line = String(text || "");
  var start = state.cursor;

  state.text += line + "\n";
  state.cursor += line.length + 1;

  if (style && line) {
    pushDocTextStyleRequest_(state, start, start + line.length, style);
  }
}

function appendDocLabelLine_(state, label, value) {
  var labelText = String(label || "");
  var valueText = String(value || "");
  var line = labelText + valueText;
  var start = state.cursor;

  state.text += line + "\n";
  state.cursor += line.length + 1;

  if (labelText) {
    pushDocTextStyleRequest_(state, start, start + labelText.length, {bold: true});
  }
}

function appendDocBlankLine_(state) {
  state.text += "\n";
  state.cursor += 1;
}

function appendDocInlineBlock_(state, parsedInline, trailingText) {
  var start = state.cursor;
  var text = parsedInline && parsedInline.text ? parsedInline.text : "";
  var suffix = trailingText || "";

  state.text += text + suffix;
  state.cursor += text.length + suffix.length;

  (parsedInline.styles || []).forEach(function(styleRange) {
    pushDocTextStyleRequest_(
        state,
        start + styleRange.start,
        start + styleRange.end,
        styleRange,
    );
  });
}

function appendDocRunsBlock_(state, runs, trailingText) {
  var start = state.cursor;
  var text = "";

  (runs || []).forEach(function(run) {
    text += run.text;
  });

  state.text += text + (trailingText || "");
  state.cursor += text.length + (trailingText || "").length;

  pushDocStyledRuns_(state, start, runs);
}

function appendDocRunsListBlock_(state, block) {
  var listStart = state.cursor;

  (block.items || []).forEach(function(item) {
    appendDocRunsBlock_(state, item.runs || [], "\n");
  });

  if (state.cursor <= listStart) return;

  state.listRequests.push({
    createParagraphBullets: {
      range: {
        startIndex: listStart,
        endIndex: state.cursor,
      },
      bulletPreset: block.type === "ol" ?
        "NUMBERED_DECIMAL_ALPHA_ROMAN" :
        "BULLET_DISC_CIRCLE_SQUARE",
    },
  });
}

function pushDocStyledRuns_(state, start, runs) {
  var cursor = start;

  (runs || []).forEach(function(run) {
    var text = String((run && run.text) || "");

    if (text) {
      pushDocTextStyleRequest_(
          state,
          cursor,
          cursor + text.length,
          run,
      );
    }

    cursor += text.length;
  });
}

function pushDocTextStyleRequest_(state, start, end, style) {
  var textStyle = {};
  var fields = [];

  if (!style || end <= start) return;

  if (style.bold) {
    textStyle.bold = true;
    fields.push("bold");
  }

  if (style.italic) {
    textStyle.italic = true;
    fields.push("italic");
  }

  if (!fields.length) return;

  state.styleRequests.push({
    updateTextStyle: {
      range: {
        startIndex: start,
        endIndex: end,
      },
      textStyle: textStyle,
      fields: fields.join(","),
    },
  });
}

function parseSundayNotesMarkdownBlocks_(value) {
  var normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  var lines = normalized.split("\n");
  var blocks = [];
  var paragraphLines = [];
  var listLines = [];

  var flushParagraph = function() {
    if (!paragraphLines.length) return;
    blocks.push({
      type: "paragraph",
      lines: paragraphLines.slice(),
    });
    paragraphLines = [];
  };

  var flushList = function() {
    if (!listLines.length) return;
    blocks = blocks.concat(parseMarkdownListBlocks_(listLines));
    listLines = [];
  };

  lines.forEach(function(rawLine) {
    var line = String(rawLine || "");
    var listMatch = parseMarkdownListLine_(line);

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    if (listMatch) {
      flushParagraph();
      listLines.push(line);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return blocks;
}

function parseSundayNotesHtmlBlocks_(html) {
  var container = document.createElement("div");
  container.innerHTML = String(html || "");

  var blocks = [];
  var inlineNodes = [];

  var flushInlineNodes = function() {
    if (!inlineNodes.length) return;

    var wrapper = document.createElement("div");
    inlineNodes.forEach(function(node) {
      wrapper.appendChild(node.cloneNode(true));
    });

    var runs = extractSundayNotesRunsFromNode_(wrapper);
    if (hasVisibleSundayNotesRuns_(runs)) {
      blocks.push({
        type: "paragraph",
        runs: runs,
      });
    }

    inlineNodes = [];
  };

  Array.from(container.childNodes).forEach(function(node) {
    if (isSundayNotesListNode_(node)) {
      flushInlineNodes();
      var listBlock = parseSundayNotesListNode_(node);
      if (listBlock.items.length) {
        blocks.push(listBlock);
      }
      return;
    }

    if (isSundayNotesParagraphNode_(node)) {
      flushInlineNodes();
      var runs = extractSundayNotesRunsFromNode_(node);
      if (hasVisibleSundayNotesRuns_(runs)) {
        blocks.push({
          type: "paragraph",
          runs: runs,
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
      flushInlineNodes();
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").trim()) {
      return;
    }

    inlineNodes.push(node);
  });

  flushInlineNodes();

  return blocks;
}

function parseSundayNotesListNode_(node) {
  return {
    type: node.nodeName === "OL" ? "ol" : "ul",
    items: Array.from(node.children).filter(function(child) {
      return child.nodeName === "LI";
    }).map(function(itemNode) {
      return {
        runs: extractSundayNotesRunsFromNode_(itemNode),
      };
    }).filter(function(item) {
      return hasVisibleSundayNotesRuns_(item.runs);
    }),
  };
}

function extractSundayNotesRunsFromNode_(node) {
  var runs = [];

  var walk = function(currentNode, style) {
    var nextStyle = {
      bold: !!(style && style.bold),
      italic: !!(style && style.italic),
    };

    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.textContent) {
        runs.push({
          text: currentNode.textContent,
          bold: nextStyle.bold,
          italic: nextStyle.italic,
        });
      }
      return;
    }

    if (currentNode.nodeType !== Node.ELEMENT_NODE) return;

    if (currentNode.nodeName === "BR") {
      runs.push({
        text: "\n",
        bold: nextStyle.bold,
        italic: nextStyle.italic,
      });
      return;
    }

    if (currentNode.nodeName === "B" || currentNode.nodeName === "STRONG") {
      nextStyle.bold = true;
    }

    if (currentNode.nodeName === "I" || currentNode.nodeName === "EM") {
      nextStyle.italic = true;
    }

    if (currentNode.style) {
      var fontWeight = String(currentNode.style.fontWeight || "").toLowerCase();
      var fontStyle = String(currentNode.style.fontStyle || "").toLowerCase();

      if (fontWeight === "bold" || Number(fontWeight) >= 600) {
        nextStyle.bold = true;
      }

      if (fontStyle === "italic") {
        nextStyle.italic = true;
      }
    }

    Array.from(currentNode.childNodes).forEach(function(childNode) {
      walk(childNode, nextStyle);
    });
  };

  walk(node, {bold: false, italic: false});

  return mergeSundayNotesRuns_(runs);
}

function mergeSundayNotesRuns_(runs) {
  return (runs || []).reduce(function(acc, run) {
    if (!run || !run.text) return acc;

    var previous = acc[acc.length - 1];
    if (previous &&
      previous.bold === run.bold &&
      previous.italic === run.italic) {
      previous.text += run.text;
      return acc;
    }

    acc.push({
      text: run.text,
      bold: !!run.bold,
      italic: !!run.italic,
    });
    return acc;
  }, []);
}

function hasVisibleSundayNotesRuns_(runs) {
  return (runs || []).some(function(run) {
    return String((run && run.text) || "").replace(/\n/g, "").trim();
  });
}

function isSundayNotesParagraphNode_(node) {
  return !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    ["DIV", "P"].indexOf(node.nodeName) !== -1;
}

function isSundayNotesListNode_(node) {
  return !!node &&
    node.nodeType === Node.ELEMENT_NODE &&
    ["UL", "OL"].indexOf(node.nodeName) !== -1;
}

function parseSundayNotesInlineMarkdown_(value) {
  var source = String(value || "");
  var plainChars = [];
  var styles = [];
  var isBold = false;
  var isItalic = false;
  var index = 0;

  while (index < source.length) {
    if (source.slice(index, index + 2) === "**") {
      isBold = !isBold;
      index += 2;
      continue;
    }

    if (source.charAt(index) === "*") {
      isItalic = !isItalic;
      index += 1;
      continue;
    }

    plainChars.push(source.charAt(index));
    styles.push({
      bold: isBold,
      italic: isItalic,
    });
    index += 1;
  }

  var plainText = plainChars.join("");
  var styleRanges = [];
  var activeStyle = null;
  var activeStart = -1;

  var flushStyleRange = function(endIndex) {
    if (!activeStyle || activeStart === -1) return;

    styleRanges.push({
      start: activeStart,
      end: endIndex,
      bold: !!activeStyle.bold,
      italic: !!activeStyle.italic,
    });

    activeStyle = null;
    activeStart = -1;
  };

  styles.forEach(function(style, i) {
    if (!style.bold && !style.italic) {
      flushStyleRange(i);
      return;
    }

    if (!activeStyle) {
      activeStyle = style;
      activeStart = i;
      return;
    }

    if (activeStyle.bold !== style.bold || activeStyle.italic !== style.italic) {
      flushStyleRange(i);
      activeStyle = style;
      activeStart = i;
    }
  });

  flushStyleRange(plainText.length);

  return {
    text: plainText,
    styles: styleRanges,
  };
}

async function parseGoogleResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

async function createBlankGoogleDoc(title, accessToken) {
  var response = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  var data = await parseGoogleResponse(response);

  if (!response.ok) {
    throw new Error((data.error && data.error.message) || "Unable to create the Google Doc.");
  }

  return data;
}

async function writeGoogleDocContent(documentId, payload, accessToken) {
  var requests = [
    {
      insertText: {
        location: {index: 1},
        text: payload.text,
      },
    },
  ].concat(payload.requests || []);

  var response = await fetch(
      "https://docs.googleapis.com/v1/documents/" + encodeURIComponent(documentId) + ":batchUpdate",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: requests,
        }),
      },
  );

  var data = await parseGoogleResponse(response);

  if (!response.ok) {
    throw new Error((data.error && data.error.message) || "Unable to write notes into the Google Doc.");
  }

  return data;
}

async function saveSundayNotesToMyGoogleDocs() {
  var notesInput = document.getElementById("sunday-notes-input");
  if (!notesInput) return;

  var notesText = getSundayNotesPlainText_(notesInput).trim();
  var notesHtml = getSundayNotesEditorHtml_(notesInput);
  var googleDocsConfig = getGoogleNotesConfig_(currentCentralData);

  if (!notesText) {
    setSundayNotesStatus("Add a few notes first, then save to Google Docs.");
    return;
  }

  if (!googleDocsConfig.enabled) {
    return;
  }

  if (!googleDocsConfig.clientId) {
    return;
  }

  try {
    setSundayNotesSaveButtonState("Connecting to Google...", true);
    setSundayNotesStatus("Preparing Google Sign-In...");

    if (!googleNotesClientReady || !googleNotesTokenClient) {
      await warmGoogleNotesAuth_();
    }

    setSundayNotesStatus("Waiting for Google Sign-In...");

    var accessToken = await ensureGoogleNotesAccess();
    var title = buildSundayNotesDocTitle();
    var payload = buildSundayNotesDocPayload_(notesHtml);

    setSundayNotesSaveButtonState("Saving to Google Docs...", true);
    setSundayNotesStatus("Creating your Google Doc...");

    var doc = await createBlankGoogleDoc(title, accessToken);
    await writeGoogleDocContent(doc.documentId, payload, accessToken);

    var docUrl = "https://docs.google.com/document/d/" + doc.documentId + "/edit";
    setSavedDocLink_(docUrl);

    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    setSundayNotesStatus("Saved to your Google Drive.", true);
  } catch (error) {
    setSundayNotesSaveButtonState("Save to My Google Docs", false);
    setSundayNotesStatus(
        error && error.message ? error.message : "Could not save notes to Google Docs.",
        true,
    );
  }
}

function startCountdown() {
  var el = document.getElementById("central-countdown");
  if (!el) return;

  previousCountdownDigits = {};

  var target = ensureCountdownTargetDate_(el, new Date());
  if (!target) {
    el.textContent = "Date not set";
    return;
  }

  el.classList.add("countdown-ticker");

  el.innerHTML =
    countdownUnitMarkup("days", "d") +
    countdownUnitMarkup("hours", "h") +
    countdownUnitMarkup("minutes", "m") +
    countdownUnitMarkup("seconds", "s");

  updateCountdown();

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(updateCountdown, 1000);
}

function countdownUnitMarkup(name, label) {
  return "" +
    "<span class=\"count-unit\">" +
      "<span class=\"count-number\" data-countdown-unit=\"" + name + "\">" +
        "<span class=\"count-digit\" data-digit-index=\"0\">0</span>" +
        "<span class=\"count-digit\" data-digit-index=\"1\">0</span>" +
      "</span>" +
      "<span class=\"count-label\">" + label + "</span>" +
    "</span>";
}

function updateCountdown() {
  var el = document.getElementById("central-countdown");
  if (!el) return;

  var now = new Date();
  var target = ensureCountdownTargetDate_(el, now);
  var values = getCountdownValues(target, now);

  updateCountdownUnit("days", values.days);
  updateCountdownUnit("hours", values.hours);
  updateCountdownUnit("minutes", values.minutes);
  updateCountdownUnit("seconds", values.seconds);
}

function updateCountdownUnit(name, value) {
  var unit = document.querySelector("[data-countdown-unit=\"" + name + "\"]");
  if (!unit) return;

  var nextValue = String(value).padStart(2, "0");
  var digits = unit.querySelectorAll(".count-digit");

  digits.forEach(function(digitEl, index) {
    var nextDigit = nextValue.charAt(index);
    var key = name + "-" + index;

    if (previousCountdownDigits[key] === nextDigit) return;

    previousCountdownDigits[key] = nextDigit;
    digitEl.textContent = nextDigit;

    digitEl.classList.remove("slide-down");
    void digitEl.offsetWidth;
    digitEl.classList.add("slide-down");
  });
}

function getCountdownValues(targetDate, now) {
  var target = targetDate instanceof Date ? targetDate : null;
  var currentTime = now instanceof Date ? now : new Date();

  if (!target || isNaN(target.getTime())) {
    return {days: 0, hours: 0, minutes: 0, seconds: 0};
  }

  var diff = target.getTime() - currentTime.getTime();
  if (diff < 0) diff = 0;

  var totalSeconds = Math.floor(diff / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function ensureCountdownTargetDate_(el, now) {
  if (!el) return null;

  var currentTime = now instanceof Date ? now : new Date();
  var timezone = getCountdownTimeZone_();
  var target = parseCountdownDate(
      el.getAttribute("data-countdown-datetime"),
      timezone,
  );

  if (!target || isNaN(target.getTime()) || target.getTime() <= currentTime.getTime()) {
    target = getNextSundayCountdownDate_(timezone, currentTime);

    if (target && !isNaN(target.getTime())) {
      el.setAttribute("data-countdown-datetime", target.toISOString());
    }
  }

  return target && !isNaN(target.getTime()) ? target : null;
}

function parseCountdownDate(value, timezone) {
  if (!value) return null;

  var raw = String(value).trim();
  var match = raw.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T])(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (match) {
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var hour = Number(match[4]);
    var minute = Number(match[5]);
    var second = Number(match[6] || 0);

    return createDateForTimeZone_(
        year,
        month,
        day,
        hour,
        minute,
        second,
        timezone,
    );
  }

  return new Date(raw.replace(" ", "T"));
}

function getCountdownTimeZone_() {
  var data = currentCentralData || {};
  var sundayMode = data.sundayMode || {};
  var settings = data.settings || {};

  return String(
      sundayMode.timezone ||
      settings.timezone ||
      "America/Chicago",
  ).trim() || "America/Chicago";
}

function getNextSundayCountdownDate_(timezone, now) {
  var referenceDate = now instanceof Date ? now : new Date();
  var parts = getTimeZoneDateParts_(referenceDate, timezone);
  var weekdayIndex = getWeekdayIndex_(parts.weekday);
  var currentMinutes = (Number(parts.hour) * 60) + Number(parts.minute);
  var daysUntilSunday = weekdayIndex === 0 ?
    (currentMinutes >= 540 ? 7 : 0) :
    7 - weekdayIndex;
  var targetDay = addDaysToDateParts_(
      parts.year,
      parts.month,
      parts.day,
      daysUntilSunday,
  );

  return createDateForTimeZone_(
      targetDay.year,
      targetDay.month,
      targetDay.day,
      9,
      0,
      0,
      timezone,
  );
}

function getTimeZoneDateParts_(date, timezone) {
  var sourceDate = date instanceof Date ? date : new Date();

  try {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Chicago",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(sourceDate);
    var values = {};

    parts.forEach(function(part) {
      if (part && part.type && part.type !== "literal") {
        values[part.type] = part.value;
      }
    });

    return {
      weekday: String(values.weekday || "Sun"),
      year: Number(values.year || sourceDate.getFullYear()),
      month: Number(values.month || (sourceDate.getMonth() + 1)),
      day: Number(values.day || sourceDate.getDate()),
      hour: Number(values.hour || sourceDate.getHours()),
      minute: Number(values.minute || sourceDate.getMinutes()),
      second: Number(values.second || sourceDate.getSeconds()),
    };
  } catch (error) {
    return {
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][sourceDate.getDay()],
      year: sourceDate.getFullYear(),
      month: sourceDate.getMonth() + 1,
      day: sourceDate.getDate(),
      hour: sourceDate.getHours(),
      minute: sourceDate.getMinutes(),
      second: sourceDate.getSeconds(),
    };
  }
}

function getWeekdayIndex_(weekday) {
  return {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }[String(weekday || "Sun").slice(0, 3)] || 0;
}

function addDaysToDateParts_(year, month, day, days) {
  var date = new Date(Date.UTC(
      Number(year || 0),
      Number(month || 1) - 1,
      Number(day || 1),
      12,
      0,
      0,
      0,
  ));

  date.setUTCDate(date.getUTCDate() + Number(days || 0));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function createDateForTimeZone_(year, month, day, hour, minute, second, timezone) {
  if (!timezone) {
    return new Date(
        Number(year || 0),
        Number(month || 1) - 1,
        Number(day || 1),
        Number(hour || 0),
        Number(minute || 0),
        Number(second || 0),
        0,
    );
  }

  // Resolve a wall-clock time in the church timezone into a stable UTC instant.
  var baseUtc = new Date(Date.UTC(
      Number(year || 0),
      Number(month || 1) - 1,
      Number(day || 1),
      Number(hour || 0),
      Number(minute || 0),
      Number(second || 0),
      0,
  ));
  var adjusted = adjustDateForTimeZoneOffset_(baseUtc, timezone);

  return adjustDateForTimeZoneOffset_(adjusted, timezone);
}

function adjustDateForTimeZoneOffset_(date, timezone) {
  var sourceDate = date instanceof Date ? date : new Date(date);
  var parts = getTimeZoneDateParts_(sourceDate, timezone);
  var zonedAsUtc = Date.UTC(
      Number(parts.year || 0),
      Number(parts.month || 1) - 1,
      Number(parts.day || 1),
      Number(parts.hour || 0),
      Number(parts.minute || 0),
      Number(parts.second || 0),
      0,
  );
  var offsetMs = zonedAsUtc - sourceDate.getTime();

  return new Date(sourceDate.getTime() - offsetMs);
}

function escapeHtml(value) {
  return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJsString(value) {
  return String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\\'");
}

function showError(error) {
  var message = error && error.message ? error.message : error;
  hideCentralLoader_(true);

  document.getElementById("app").innerHTML = [
    "<section class=\"loading\">",
      "<p>Something went wrong loading CrossPointe Central.</p>",
      "<p>", escapeHtml(message || "Unknown error"), "</p>",
    "</section>",
  ].join("");
}
