(function(root, factory) {
  var core = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = core;
  }

  if (!root || !root.document) return;

  root.CentralAnalyticsCore = core;
  root.centralAnalyticsService = core.createService_(root, root.document);
}(typeof window !== "undefined" ? window : null, function() {
  "use strict";

  var MAX_EVENT_NAME_LENGTH = 40;
  var MAX_PARAMETER_LENGTH = 100;
  var ALLOWED_EVENTS = {
    central_page_view: true,
    central_section_view: true,
    central_ui_action: true,
    select_content: true,
    registration_click: true,
    calendar_add: true,
    generate_lead: true,
    notes_action: true,
    livestream_action: true,
    notification_action: true,
    wayfinder_action: true,
  };
  var ALLOWED_PARAMETERS = {
    page_mode: true,
    section_id: true,
    interaction_action: true,
    content_type: true,
    content_id: true,
    content_label: true,
    item_id: true,
    item_name: true,
    link_domain: true,
    link_path: true,
    calendar_provider: true,
    result: true,
    expanded: true,
    debug_mode: true,
    lead_source: true,
  };

  function normalizeAnalyticsText_(value, maxLength) {
    return String(value == null ? "" : value)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength || MAX_PARAMETER_LENGTH);
  }

  function slugifyAnalyticsValue_(value, fallback) {
    var slug = normalizeAnalyticsText_(value, MAX_PARAMETER_LENGTH)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, MAX_PARAMETER_LENGTH);

    return slug || normalizeAnalyticsText_(fallback || "unknown");
  }

  function sanitizeAnalyticsEventName_(value) {
    var eventName = slugifyAnalyticsValue_(value, "central_ui_action")
        .slice(0, MAX_EVENT_NAME_LENGTH);
    return ALLOWED_EVENTS[eventName] ? eventName : "central_ui_action";
  }

  function sanitizeAnalyticsParameters_(parameters) {
    var source = parameters && typeof parameters === "object" ?
      parameters :
      {};
    var sanitized = {};

    Object.keys(source).forEach(function(key) {
      if (!ALLOWED_PARAMETERS[key]) return;

      var value = source[key];
      if (value === true || value === false) {
        sanitized[key] = value;
        return;
      }

      if (typeof value === "number" && isFinite(value)) {
        sanitized[key] = value;
        return;
      }

      var normalized = normalizeAnalyticsText_(value);
      if (normalized) sanitized[key] = normalized;
    });

    return sanitized;
  }

  function getSafeAnalyticsLinkDetails_(value, baseUrl) {
    var rawValue = normalizeAnalyticsText_(value, 1000);
    if (!rawValue || rawValue.charAt(0) === "#") return {};

    try {
      var parsed = new URL(rawValue, baseUrl || "https://central.crosspointe.tv/");
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {};
      }

      return {
        link_domain: parsed.hostname,
        link_path: parsed.pathname || "/",
      };
    } catch (error) {
      return {};
    }
  }

  function getAnalyticsElementText_(element) {
    if (!element) return "";

    return normalizeAnalyticsText_(
        element.getAttribute("data-analytics-content-label") ||
        element.getAttribute("aria-label") ||
        element.textContent ||
        "",
    );
  }

  function findAnalyticsContentLabel_(element, sectionElement) {
    var explicitLabel = getAnalyticsElementText_(element);
    var card = element && element.closest ?
      element.closest("article, .card, .sunday-action") :
      null;
    var heading = card && card.querySelector ?
      card.querySelector("h2, h3, h4, strong") :
      null;

    return normalizeAnalyticsText_(
        element && element.getAttribute("data-analytics-content-label") ||
        heading && heading.textContent ||
        explicitLabel ||
        sectionElement && sectionElement.getAttribute(
            "data-analytics-section",
        ) ||
        "content",
    );
  }

  function getAnalyticsInteractionFromElement_(element, locationHref) {
    if (!element || !element.closest) return null;

    var actionElement = element.closest(
        "[data-analytics-action], a[href], button, [role='button']",
    );
    if (!actionElement || actionElement.hasAttribute("data-analytics-ignore")) {
      return null;
    }

    var sectionElement = actionElement.closest("[data-analytics-section]");
    if (!sectionElement) return null;

    var sectionId = slugifyAnalyticsValue_(
        actionElement.getAttribute("data-analytics-section") ||
        sectionElement.getAttribute("data-analytics-section"),
        "unknown_section",
    );
    var label = findAnalyticsContentLabel_(actionElement, sectionElement);
    var action = slugifyAnalyticsValue_(
        actionElement.getAttribute("data-analytics-action") ||
        actionElement.getAttribute("aria-label") ||
        actionElement.textContent,
        "select",
    );
    var contentId = slugifyAnalyticsValue_(
        actionElement.getAttribute("data-analytics-content-id") ||
        sectionElement.getAttribute("data-analytics-content-id") ||
        label,
        sectionId + "_content",
    );
    var href = actionElement.getAttribute("href") || "";
    var parameters = {
      section_id: sectionId,
      interaction_action: action,
      content_type: sectionId,
      content_id: contentId.indexOf("_") === -1 ?
        sectionId + "_" + contentId :
        contentId,
      content_label: label,
    };

    Object.assign(
        parameters,
        getSafeAnalyticsLinkDetails_(href, locationHref),
    );

    var calendarProvider = actionElement.getAttribute(
        "data-calendar-provider",
    );
    if (calendarProvider) {
      parameters.calendar_provider = slugifyAnalyticsValue_(
          calendarProvider,
          "unknown",
      );
    }

    var outcomeEventName = sanitizeAnalyticsEventName_(
        actionElement.getAttribute("data-analytics-event") ||
        (calendarProvider ? "calendar_add" : "select_content"),
    );

    return {
      eventName: "select_content",
      outcomeEventName: outcomeEventName === "select_content" ?
        "" : outcomeEventName,
      parameters: parameters,
    };
  }

  function createService_(windowObject, documentObject) {
    var pageMode = "homepage";
    var trackedPageModes = {};
    var trackedSectionViews = {};
    var sectionObserver = null;
    var sectionTargets = new Map();
    var isLocal = ["localhost", "127.0.0.1", "[::1]"]
        .indexOf(windowObject.location.hostname) !== -1;
    var debugMode = new URLSearchParams(windowObject.location.search)
        .get("analytics_debug") === "1";

    function logDebug_(eventName, parameters) {
      if (!isLocal && !debugMode) return;
      windowObject.console.info(
          "[Central Analytics]",
          eventName,
          parameters,
      );
    }

    function track(eventName, parameters) {
      if (windowObject.CENTRAL_BOOT_MODE === "admin") return;

      var safeEventName = sanitizeAnalyticsEventName_(eventName);
      var safeParameters = sanitizeAnalyticsParameters_(Object.assign(
          {},
          parameters || {},
          {
            page_mode: parameters && parameters.page_mode || pageMode,
            debug_mode: debugMode || undefined,
          },
      ));

      logDebug_(safeEventName, safeParameters);
      if (isLocal) return;

      var ready = windowObject.CENTRAL_FIREBASE_AUTH_READY ||
        Promise.resolve();
      Promise.resolve(ready).then(function() {
        if (!windowObject.CENTRAL_ANALYTICS_READY ||
          !windowObject.centralAnalytics ||
          typeof windowObject.centralAnalytics.logEvent !== "function") {
          return;
        }

        windowObject.centralAnalytics.logEvent(
            safeEventName,
            safeParameters,
        );
      }).catch(function(error) {
        if (debugMode) {
          windowObject.console.warn(
              "Central Analytics event failed.",
              error,
          );
        }
      });
    }

    function setPageMode(nextPageMode) {
      pageMode = slugifyAnalyticsValue_(nextPageMode, "homepage");
      documentObject.body.setAttribute("data-analytics-page-mode", pageMode);

      if (trackedPageModes[pageMode]) return;
      trackedPageModes[pageMode] = true;
      track("central_page_view", {
        page_mode: pageMode,
        section_id: "page",
        interaction_action: "view",
      });
    }

    function trackSectionTarget_(target) {
      var section = sectionTargets.get(target) || target;
      if (!section || !section.getAttribute) return;

      var sectionId = slugifyAnalyticsValue_(
          section.getAttribute("data-analytics-section"),
          "unknown_section",
      );
      var viewKey = pageMode + ":" + sectionId;
      if (trackedSectionViews[viewKey]) return;

      trackedSectionViews[viewKey] = true;
      track("central_section_view", {
        section_id: sectionId,
        interaction_action: "view",
      });
    }

    function observeSections(rootElement) {
      var scope = rootElement && rootElement.querySelectorAll ?
        rootElement :
        documentObject;
      var sections = Array.from(
          scope.querySelectorAll("[data-analytics-section]"),
      );
      if (scope.matches && scope.matches("[data-analytics-section]")) {
        sections.unshift(scope);
      }

      if (typeof windowObject.IntersectionObserver !== "function") {
        sections.forEach(trackSectionTarget_);
        return;
      }

      if (!sectionObserver) {
        sectionObserver = new windowObject.IntersectionObserver(
            function(entries) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
                  return;
                }

                trackSectionTarget_(entry.target);
                sectionObserver.unobserve(entry.target);
                sectionTargets.delete(entry.target);
              });
            },
            {threshold: [0.5]},
        );
      }

      sections.forEach(function(section) {
        var target = section.querySelector(
            ".section-head, .hero-topbar, .sunday-badge-row",
        ) || section;
        if (sectionTargets.has(target)) return;
        sectionTargets.set(target, section);
        sectionObserver.observe(target);
      });
    }

    function handleDocumentClick_(event) {
      var interaction = getAnalyticsInteractionFromElement_(
          event.target,
          windowObject.location.href,
      );
      if (!interaction) return;
      track(interaction.eventName, interaction.parameters);
      if (interaction.outcomeEventName) {
        track(interaction.outcomeEventName, interaction.parameters);
      }
    }

    documentObject.addEventListener("click", handleDocumentClick_);

    return {
      observeSections: observeSections,
      setPageMode: setPageMode,
      track: track,
    };
  }

  return {
    createService_: createService_,
    getAnalyticsInteractionFromElement_: getAnalyticsInteractionFromElement_,
    getSafeAnalyticsLinkDetails_: getSafeAnalyticsLinkDetails_,
    sanitizeAnalyticsEventName_: sanitizeAnalyticsEventName_,
    sanitizeAnalyticsParameters_: sanitizeAnalyticsParameters_,
    slugifyAnalyticsValue_: slugifyAnalyticsValue_,
  };
}));
