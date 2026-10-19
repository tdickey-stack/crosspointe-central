(function(root, factory) {
  var core = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = core;
  }

  if (!root || !root.document) return;
  root.CentralPublicIntegrationsCore = core;
  core.mount_(root, root.document);
}(typeof window !== "undefined" ? window : null, function() {
  "use strict";

  var ADMIN_USER_PATH = "centralAdmin/root/users";
  var ALLOWED_ADMIN_DOMAINS = ["crosspointe.tv"];
  var ALLOWED_ADMIN_EMAILS = ["tylerdickey17@gmail.com"];
  var PRESENCE_ENDPOINT = "/api/livestream-presence";
  var PRESENCE_POLL_MS = 15000;
  var PRESENCE_HEARTBEAT_MS = 20000;

  function text_(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeHttpUrl_(value, baseUrl) {
    var raw = text_(value);
    if (!raw) return "";
    try {
      var parsed = new URL(raw, baseUrl ||
        "https://central.crosspointe.tv/");
      if (["http:", "https:"].indexOf(parsed.protocol) === -1 ||
        parsed.username || parsed.password) return "";
      return parsed.href;
    } catch (error) {
      return "";
    }
  }

  function normalizePermission_(value) {
    var permission = text_(value).toLowerCase();
    return ["view", "propose", "edit", "approve", "admin"]
        .indexOf(permission) !== -1 ? permission : "none";
  }

  function permissionFor_(pageAccess, key) {
    if (!pageAccess || typeof pageAccess !== "object") return "none";
    if (Object.prototype.hasOwnProperty.call(pageAccess, key)) {
      return normalizePermission_(pageAccess[key]);
    }
    if (key === "studio") return normalizePermission_(pageAccess.settings);
    if (key === "planner") {
      if (Object.prototype.hasOwnProperty.call(pageAccess, "studio")) {
        return normalizePermission_(pageAccess.studio);
      }
      return normalizePermission_(pageAccess.settings);
    }
    return "none";
  }

  function canOpenAdmin_(user) {
    var email = text_(user && user.email).toLowerCase();
    if (!email) return false;
    if (ALLOWED_ADMIN_EMAILS.indexOf(email) !== -1) return true;
    return ALLOWED_ADMIN_DOMAINS.some(function(domain) {
      return email.endsWith("@" + domain);
    });
  }

  function getWorkspaceDestinations_(user, userRecord) {
    var pageAccess = userRecord && userRecord.pageAccess;
    if (!userRecord || userRecord.active !== true || !pageAccess ||
      typeof pageAccess !== "object" ||
      !Object.keys(pageAccess).some(function(key) {
        return normalizePermission_(pageAccess[key]) !== "none";
      })) return [];

    var destinations = [];
    if (canOpenAdmin_(user)) {
      destinations.push({href: "/admin", label: "Admin"});
    }
    if (permissionFor_(pageAccess, "studio") !== "none") {
      destinations.push({href: "/studio", label: "Studio"});
    }
    if (permissionFor_(pageAccess, "planner") !== "none") {
      destinations.push({href: "/planner", label: "Planner"});
      destinations.push({href: "/annual-planner", label: "Annual Planner"});
    }
    return destinations;
  }

  function normalizeWayfinderEvent_(event) {
    var source = event && typeof event === "object" ? event : {};
    return {
      title: text_(source.title) || "CrossPointe Event",
      date: text_(source.date),
      time: text_(source.time),
      location: text_(source.location || source.venue),
      description: text_(source.description) ||
        "More details will be posted here as they become available.",
      registrationUrl: safeHttpUrl_(
          source.registrationUrl || source.registration_url,
      ),
      registrationLabel: text_(
          source.registrationLabel || source.registration_button_text,
      ) || "Register",
    };
  }

  function playbackState_(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;
    if (typeof snapshot.paused === "boolean") return !snapshot.paused;
    if (typeof snapshot.playing === "boolean") return snapshot.playing;
    return null;
  }

  function startsPresenceForPhase_(phase) {
    return phase === "opened" || phase === "restored";
  }

  function getPushPromptOffset_(height) {
    var measured = Number(height);
    return Number.isFinite(measured) && measured > 0 ?
      Math.ceil(measured) + 12 : 0;
  }

  function applyWorkspaceOpenState_(navigation, isOpen, restoreFocus) {
    if (!navigation) return;
    var button = navigation.querySelector("button");
    var panel = navigation.querySelector(".central-app-navigation-panel");
    if (!button || !panel) return;
    navigation.classList.toggle("is-open", Boolean(isOpen));
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    button.setAttribute("aria-label", isOpen ?
      "Close workspace navigation" : "Open workspace navigation");
    panel.hidden = !isOpen;
    if (!isOpen && restoreFocus && typeof button.focus === "function") {
      button.focus();
    }
  }

  function validatePresencePayload_(payload, streamUrl) {
    if (!payload || payload.available !== true ||
      !text_(payload.streamKey) ||
      !Number.isSafeInteger(payload.count) || payload.count < 0) return null;
    var returnedUrl = safeHttpUrl_(payload.streamUrl);
    var expectedUrl = safeHttpUrl_(streamUrl);
    if (!returnedUrl || returnedUrl !== expectedUrl) return null;
    return {
      streamKey: text_(payload.streamKey),
      streamUrl: returnedUrl,
      count: payload.count,
    };
  }

  function formatPresenceCount_(count) {
    if (!Number.isSafeInteger(count) || count < 0) return "";
    if (count < 1000) return String(count);
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(count);
  }

  function mount_(windowObject, documentObject) {
    var footerMedia = windowObject.matchMedia("(max-width: 760px)");
    var workspaceAuthGeneration = 0;
    var workspaceOpen = false;
    var presence = null;

    function makeLink_(label, href, className) {
      var link = documentObject.createElement("a");
      link.textContent = label;
      link.href = href;
      if (className) link.className = className;
      return link;
    }

    function openWayfinderEventDetails_(rawEvent) {
      if (!rawEvent || typeof rawEvent !== "object") return false;
      var dialog = documentObject.getElementById("detail-dialog");
      if (!dialog) return false;
      var event = normalizeWayfinderEvent_(rawEvent);
      var title = documentObject.getElementById("detail-title");
      var kicker = documentObject.getElementById("detail-kicker");
      var meta = documentObject.getElementById("detail-meta");
      var copy = documentObject.getElementById("detail-copy");
      var links = documentObject.getElementById("detail-links");
      if (!title || !kicker || !meta || !copy) return false;

      title.textContent = event.title;
      kicker.textContent = "Event";
      meta.textContent = [event.date, event.time, event.location]
          .filter(Boolean).join(" · ");
      copy.textContent = event.description;
      dialog.setAttribute("data-analytics-section", "events");
      dialog.setAttribute("data-analytics-content-label", event.title);
      if (links) {
        links.replaceChildren();
        if (event.registrationUrl) {
          var registration = makeLink_(
              event.registrationLabel,
              event.registrationUrl,
              "button",
          );
          registration.target = "_blank";
          registration.rel = "noopener noreferrer";
          registration.setAttribute("data-analytics-event", "registration_click");
          registration.setAttribute("data-analytics-action", "registration_outbound");
          registration.setAttribute("data-analytics-content-label", event.title);
          links.appendChild(registration);
        }
      }
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
      if (windowObject.centralAnalyticsService) {
        windowObject.centralAnalyticsService.track("central_ui_action", {
          section_id: "events",
          interaction_action: "event_details_open",
          content_type: "events",
          content_id: event.title,
          content_label: event.title,
          item_id: event.title,
          item_name: event.title,
        });
      }
      return true;
    }

    windowObject.openWayfinderEventDetailsModal =
      openWayfinderEventDetails_;

    function setWorkspaceOpen_(isOpen, restoreFocus) {
      workspaceOpen = Boolean(isOpen);
      var navigation = documentObject.getElementById("central-app-navigation");
      applyWorkspaceOpenState_(navigation, workspaceOpen, restoreFocus);
    }

    function renderWorkspaceNavigation_(user, userRecord) {
      var existing = documentObject.getElementById("central-app-navigation");
      var destinations = getWorkspaceDestinations_(user, userRecord);
      if (!destinations.length) {
        workspaceOpen = false;
        if (existing) existing.remove();
        return;
      }

      var navigation = existing || documentObject.createElement("nav");
      navigation.id = "central-app-navigation";
      navigation.className = "central-app-navigation";
      navigation.setAttribute("aria-label", "Central workspaces");
      navigation.setAttribute("data-analytics-section", "workspace_navigation");
      navigation.replaceChildren();

      var button = documentObject.createElement("button");
      button.type = "button";
      button.className = "central-app-navigation-toggle";
      button.setAttribute("aria-controls", "central-app-navigation-panel");
      [1, 2, 3].forEach(function() {
        button.appendChild(documentObject.createElement("span"));
      });
      var panel = documentObject.createElement("div");
      panel.id = "central-app-navigation-panel";
      panel.className = "central-app-navigation-panel";
      destinations.forEach(function(destination) {
        panel.appendChild(makeLink_(destination.label, destination.href));
      });
      navigation.appendChild(button);
      navigation.appendChild(panel);
      if (!existing) documentObject.body.appendChild(navigation);
      button.addEventListener("click", function() {
        setWorkspaceOpen_(!workspaceOpen);
      });
      setWorkspaceOpen_(false);
      if (windowObject.centralAnalyticsService) {
        windowObject.centralAnalyticsService.observeSections(navigation);
      }
    }

    function initializeWorkspaceNavigation_() {
      Promise.resolve(windowObject.CENTRAL_FIREBASE_AUTH_READY)
          .then(function() {
            if (!windowObject.firebase || !windowObject.firebase.auth ||
              !windowObject.firebase.firestore) return;
            var auth = windowObject.firebase.auth();
            var firestore = windowObject.firebase.firestore();
            auth.onAuthStateChanged(function(user) {
              var requestGeneration = ++workspaceAuthGeneration;
              if (!user || !user.uid) {
                renderWorkspaceNavigation_(null, null);
                return;
              }
              firestore.doc(ADMIN_USER_PATH + "/" + user.uid).get()
                  .then(function(snapshot) {
                    if (requestGeneration !== workspaceAuthGeneration) return;
                    renderWorkspaceNavigation_(
                        user,
                        snapshot.exists ? snapshot.data() : null,
                    );
                  })
                  .catch(function() {
                    if (requestGeneration === workspaceAuthGeneration) {
                      renderWorkspaceNavigation_(null, null);
                    }
                  });
            });
          })
          .catch(function() {
            renderWorkspaceNavigation_(null, null);
          });
    }

    function syncMobileChrome_() {
      var navigation = documentObject.querySelector(".navigation");
      if (navigation && typeof navigation.getBoundingClientRect === "function") {
        var height = Math.max(0, navigation.getBoundingClientRect().height || 0);
        documentObject.documentElement.style.setProperty(
            "--central-mobile-nav-height",
            height + "px",
        );
      }
      var footer = documentObject.querySelector("footer.public-footer");
      var main = documentObject.querySelector(".main");
      if (!footer || !main) return;
      if (footerMedia.matches) {
        var current = documentObject.querySelector(
            ".navigation [data-destination][aria-current='page']",
        );
        var view = current && documentObject.getElementById(
            current.getAttribute("data-destination"),
        );
        if (view && footer.parentElement !== view) view.appendChild(footer);
      } else if (footer.parentElement !== main) {
        main.appendChild(footer);
      }
    }

    function syncPushPromptOffset_() {
      var prompt = documentObject.querySelector(".central-push-prompt");
      var height = prompt && typeof prompt.getBoundingClientRect === "function" ?
        prompt.getBoundingClientRect().height : 0;
      documentObject.documentElement.style.setProperty(
          "--central-push-prompt-offset",
          getPushPromptOffset_(height) + "px",
      );
    }

    function createPresenceBadge_(compact) {
      var badge = documentObject.createElement("span");
      badge.className = "central-livestream-presence" +
        (compact ? " is-compact" : "");
      badge.hidden = true;
      badge.setAttribute("data-central-livestream-presence", "");
      badge.setAttribute("title", "An estimate of active streams on Central; one stream may include several people.");
      var count = documentObject.createElement("strong");
      count.setAttribute("data-central-livestream-presence-count", "");
      badge.appendChild(count);
      if (!compact) badge.appendChild(documentObject.createTextNode(" Watching on Central"));
      return badge;
    }

    function ensurePresenceBadges_() {
      var player = documentObject.querySelector(".lab-player");
      if (player && !player.querySelector(".central-livestream-presence.is-compact")) {
        player.appendChild(createPresenceBadge_(true));
      }
      var heading = documentObject.querySelector(
          ".sunday-watch-section .section-heading",
      );
      if (heading && !heading.querySelector(".central-livestream-presence")) {
        heading.appendChild(createPresenceBadge_(false));
      }
    }

    function updatePresenceCount_(count) {
      ensurePresenceBadges_();
      var valid = Number.isSafeInteger(count) && count >= 0;
      Array.prototype.forEach.call(documentObject.querySelectorAll(
          "[data-central-livestream-presence]",
      ), function(badge) {
        badge.hidden = !valid;
        badge.setAttribute("aria-label", valid ?
          count + " watching on Central. Estimated active streams." : "");
        var countElement = badge.querySelector(
            "[data-central-livestream-presence-count]",
        );
        if (countElement) countElement.textContent = valid ?
          formatPresenceCount_(count) : "";
      });
    }

    function postPresence_(state, active) {
      if (!state.streamKey) return;
      if (active && (state !== presence ||
        safeHttpUrl_(state.streamUrl) !== safeHttpUrl_(state.activeUrl))) return;
      state.postedActive = active;
      var sequence = ++state.sequence;
      windowObject.fetch(PRESENCE_ENDPOINT, {
        method: "POST",
        credentials: "omit",
        keepalive: !active,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          sessionId: state.sessionId,
          streamKey: state.streamKey,
          active: active,
          sequence: sequence,
        }),
      }).then(function(response) {
        if (!response.ok) throw new Error("Presence unavailable");
        return response.json();
      }).then(function(data) {
        if (state === presence && sequence === state.sequence &&
          (!data || data.available !== true)) updatePresenceCount_(null);
      }).catch(function() {
        if (state === presence && sequence === state.sequence) {
          updatePresenceCount_(null);
        }
      });
    }

    function pollPresence_(state) {
      if (state !== presence) return;
      var requestId = ++state.requestId;
      if (state.controller) state.controller.abort();
      windowObject.clearTimeout(state.pollTimeout);
      state.controller = typeof windowObject.AbortController === "function" ?
        new windowObject.AbortController() : null;
      state.pollTimeout = windowObject.setTimeout(function() {
        if (state !== presence || requestId !== state.requestId) return;
        state.requestId += 1;
        if (state.controller) state.controller.abort();
        state.pollTimeout = 0;
        updatePresenceCount_(null);
      }, 10000);
      var options = {cache: "no-store", credentials: "omit"};
      if (state.controller) options.signal = state.controller.signal;
      windowObject.fetch(PRESENCE_ENDPOINT, options)
          .then(function(response) {
            if (!response.ok) throw new Error("Presence unavailable");
            return response.json();
          })
          .then(function(data) {
            if (state !== presence || requestId !== state.requestId) return;
            var valid = validatePresencePayload_(data, state.activeUrl);
            if (!valid) {
              if (state.postedActive) postPresence_(state, false);
              state.streamKey = "";
              state.streamUrl = "";
              updatePresenceCount_(null);
              return;
            }
            if (state.streamKey !== valid.streamKey) {
              if (state.postedActive) postPresence_(state, false);
              state.streamKey = valid.streamKey;
              state.streamUrl = valid.streamUrl;
              if (state.confirmedPlaying) postPresence_(state, true);
            }
            updatePresenceCount_(valid.count);
          })
          .catch(function() {
            if (state === presence && requestId === state.requestId) {
              updatePresenceCount_(null);
            }
          })
          .finally(function() {
            if (requestId === state.requestId) {
              windowObject.clearTimeout(state.pollTimeout);
              state.pollTimeout = 0;
            }
          });
    }

    function teardownPresence_(sendInactive) {
      var state = presence;
      presence = null;
      if (state) {
        windowObject.clearTimeout(state.pollTimeout);
        if (state.controller) state.controller.abort();
        windowObject.clearInterval(state.pollTimer);
        windowObject.clearInterval(state.heartbeatTimer);
        if (sendInactive && state.postedActive) postPresence_(state, false);
      }
      updatePresenceCount_(null);
    }

    function startPresence_(detail) {
      var activeUrl = safeHttpUrl_(detail && detail.streamUrl);
      var iframe = detail && detail.iframe;
      try {
        var parsed = new URL(activeUrl);
        if (parsed.protocol !== "https:" || parsed.hostname !== "control.resi.io") {
          teardownPresence_(true);
          return;
        }
      } catch (error) {
        teardownPresence_(true);
        return;
      }
      teardownPresence_(true);
      if (!windowObject.crypto ||
        typeof windowObject.crypto.getRandomValues !== "function") return;
      var random = new Uint8Array(16);
      windowObject.crypto.getRandomValues(random);
      var state = {
        iframe: iframe,
        activeUrl: activeUrl,
        sessionId: Array.from(random, function(value) {
          return value.toString(16).padStart(2, "0");
        }).join(""),
        streamKey: "",
        streamUrl: "",
        sequence: 0,
        confirmedPlaying: false,
        postedActive: false,
        requestId: 0,
        controller: null,
        pollTimeout: 0,
        pollTimer: 0,
        heartbeatTimer: 0,
      };
      presence = state;
      state.pollTimer = windowObject.setInterval(function() {
        pollPresence_(state);
      }, PRESENCE_POLL_MS);
      state.heartbeatTimer = windowObject.setInterval(function() {
        if (state === presence && state.confirmedPlaying && state.streamKey) {
          postPresence_(state, true);
        }
      }, PRESENCE_HEARTBEAT_MS);
      pollPresence_(state);
    }

    function handlePlayerLifecycle_(event) {
      var detail = event && event.detail || {};
      if (startsPresenceForPhase_(detail.phase)) {
        startPresence_(detail);
        return;
      }
      if (!presence || (detail.iframe && detail.iframe !== presence.iframe)) return;
      if (detail.phase === "closed") {
        teardownPresence_(true);
        return;
      }
      if (detail.phase !== "playback" || typeof detail.playing !== "boolean" ||
        detail.playing === presence.confirmedPlaying) return;
      presence.confirmedPlaying = detail.playing;
      if (detail.playing || presence.postedActive) {
        postPresence_(presence, detail.playing);
      }
    }

    documentObject.addEventListener("click", function(event) {
      var navigation = documentObject.getElementById("central-app-navigation");
      if (navigation && !navigation.contains(event.target)) {
        setWorkspaceOpen_(false);
      }
    });
    documentObject.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && workspaceOpen) {
        setWorkspaceOpen_(false, true);
      }
    });
    windowObject.addEventListener("central:livestream-player", handlePlayerLifecycle_);
    windowObject.addEventListener("central:data", function() {
      ensurePresenceBadges_();
    });
    windowObject.addEventListener("pagehide", function() {
      teardownPresence_(true);
    });
    windowObject.addEventListener("resize", syncMobileChrome_);
    footerMedia.addEventListener("change", syncMobileChrome_);

    var navigation = documentObject.querySelector(".navigation");
    if (navigation && typeof windowObject.MutationObserver === "function") {
      new windowObject.MutationObserver(syncMobileChrome_).observe(navigation, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-current"],
      });
    }
    if (documentObject.body && typeof windowObject.MutationObserver === "function") {
      new windowObject.MutationObserver(syncPushPromptOffset_).observe(
          documentObject.body,
          {childList: true, subtree: true, characterData: true},
      );
    }
    initializeWorkspaceNavigation_();
    syncMobileChrome_();
    syncPushPromptOffset_();
    ensurePresenceBadges_();
  }

  return {
    applyWorkspaceOpenState_: applyWorkspaceOpenState_,
    formatPresenceCount_: formatPresenceCount_,
    getPushPromptOffset_: getPushPromptOffset_,
    getWorkspaceDestinations_: getWorkspaceDestinations_,
    mount_: mount_,
    normalizePermission_: normalizePermission_,
    normalizeWayfinderEvent_: normalizeWayfinderEvent_,
    playbackState_: playbackState_,
    safeHttpUrl_: safeHttpUrl_,
    startsPresenceForPhase_: startsPresenceForPhase_,
    validatePresencePayload_: validatePresencePayload_,
  };
}));
