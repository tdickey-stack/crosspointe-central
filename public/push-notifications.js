(function() {
  "use strict";

  if (window.CENTRAL_BOOT_MODE === "admin") return;

  var SUBSCRIPTION_ENDPOINT = "/api/push/subscription";
  var STATE_STORAGE_KEY = "central-push-enabled-v1";
  var PROMPT_DISMISSED_UNTIL_KEY = "central-push-prompt-dismissed-until-v2";
  var PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
  var messaging = null;
  var registration = null;
  var buttonEl = null;
  var statusEl = null;
  var working = false;
  var initializationError = "";
  var initializationSettled = false;
  var promptEl = null;

  function isIosDevice_() {
    var userAgent = String(navigator.userAgent || "");
    return /iPad|iPhone|iPod/.test(userAgent) ||
      (/Macintosh/.test(userAgent) &&
        Number(navigator.maxTouchPoints || 0) > 1);
  }

  function isAndroidDevice_() {
    return /Android/.test(String(navigator.userAgent || ""));
  }

  function isStandalone_() {
    return navigator.standalone === true ||
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches);
  }

  function isSupported_() {
    return "Notification" in window &&
      "serviceWorker" in navigator &&
      window.firebase &&
      typeof window.firebase.messaging === "function";
  }

  function getStoredEnabled_() {
    try {
      return localStorage.getItem(STATE_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function setStoredEnabled_(enabled) {
    try {
      if (enabled) {
        localStorage.setItem(STATE_STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(STATE_STORAGE_KEY);
      }
    } catch (error) {
    }
  }

  function isPromptDismissed_() {
    try {
      return Number(localStorage.getItem(PROMPT_DISMISSED_UNTIL_KEY) || 0) >
        Date.now();
    } catch (error) {
      return false;
    }
  }

  function dismissPrompt_() {
    try {
      localStorage.setItem(
          PROMPT_DISMISSED_UNTIL_KEY,
          String(Date.now() + PROMPT_DISMISS_MS),
      );
    } catch (error) {
    }
    if (promptEl) promptEl.remove();
    promptEl = null;
  }

  function clearPromptDismissal_() {
    try {
      localStorage.removeItem(PROMPT_DISMISSED_UNTIL_KEY);
    } catch (error) {
    }
  }

  function closePrompt_() {
    if (promptEl) promptEl.remove();
    promptEl = null;
  }

  function trackNotificationAction_(action, result, source) {
    if (!source || !window.centralAnalyticsService ||
      typeof window.centralAnalyticsService.track !== "function") {
      return;
    }

    window.centralAnalyticsService.track("notification_action", {
      section_id: source === "prompt" ? "notification_prompt" : "footer",
      interaction_action: action,
      content_type: "push_notifications",
      content_id: "push_subscription",
      content_label: action === "disable" ?
        "Turn off notifications" : "Enable notifications",
      result: result,
    });
  }

  function trackNotificationFailure_(action, source) {
    trackNotificationAction_(
        action,
        Notification.permission === "denied" ? "denied" : "error",
        source,
    );
  }

  function postSubscription_(token, enabled) {
    return fetch(SUBSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        token: token,
        enabled: enabled,
      }),
    }).then(function(response) {
      return response.text().then(function(text) {
        var payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch (error) {
        }
        if (!response.ok) {
          throw new Error(
              payload && payload.error ? payload.error :
                "Central could not update push notifications.",
          );
        }
        return payload || {};
      });
    });
  }

  function getTokenOptions_() {
    var options = {serviceWorkerRegistration: registration};
    var keyMeta = document.querySelector(
        'meta[name="central-web-push-vapid-key"]',
    );
    var vapidKey = keyMeta ? String(keyMeta.content || "").trim() : "";
    if (vapidKey) options.vapidKey = vapidKey;
    return options;
  }

  function renderButton_() {
    if (!buttonEl || !statusEl) return;
    if (isIosDevice_() && !isStandalone_()) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Install for notifications";
      statusEl.textContent =
        "On iPhone or iPad, add Central to the Home Screen first.";
      return;
    }
    if (!initializationSettled && !isSupported_()) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Loading notifications...";
      statusEl.textContent =
        "Connecting this browser to Central notifications.";
      return;
    }
    if (!isSupported_()) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Notifications unavailable";
      statusEl.textContent = initializationError ||
        "This browser cannot use Central push notifications.";
      return;
    }
    if (!registration || !messaging) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Loading notifications...";
      statusEl.textContent = initializationError ||
        "Connecting this browser to Central notifications.";
      return;
    }
    var enabled = Notification.permission === "granted" && getStoredEnabled_();
    buttonEl.disabled = working;
    buttonEl.setAttribute("aria-pressed", enabled ? "true" : "false");
    buttonEl.textContent = working ? "Updating notifications..." :
      (enabled ? "Turn off notifications" : "Turn on notifications");
    buttonEl.setAttribute(
        "data-analytics-action",
        enabled ? "disable_notifications" : "enable_notifications",
    );
    buttonEl.setAttribute(
        "data-analytics-content-label",
        enabled ? "Turn off notifications" : "Enable notifications",
    );
    statusEl.textContent = enabled ?
      "Push notifications are on for this device." :
      (Notification.permission === "denied" ?
        "Notifications are blocked in this browser's settings." :
        "Get occasional updates from CrossPointe Central.");
  }

  function enableNotifications_(source) {
    working = true;
    renderButton_();
    return Notification.requestPermission()
        .then(function(permission) {
          if (permission !== "granted") {
            throw new Error("Notifications were not allowed in this browser.");
          }
          return messaging.getToken(getTokenOptions_());
        })
        .then(function(token) {
          if (!token) {
            throw new Error("This browser did not create a push subscription.");
          }
          return postSubscription_(token, true).then(function() {
            setStoredEnabled_(true);
            clearPromptDismissal_();
            closePrompt_();
            trackNotificationAction_("enable", "success", source);
          });
        });
  }

  function disableNotifications_(source) {
    working = true;
    renderButton_();
    return messaging.getToken(getTokenOptions_())
        .catch(function() {
          return "";
        })
        .then(function(token) {
          return token ? postSubscription_(token, false) : null;
        }).then(function() {
      return messaging.deleteToken().catch(function() {});
    }).then(function() {
      setStoredEnabled_(false);
      trackNotificationAction_("disable", "success", source);
    });
  }

  function handleToggle_() {
    if (working || !registration || !messaging) return;
    var isEnabled = Notification.permission === "granted" &&
      getStoredEnabled_();
    var action = isEnabled ?
      disableNotifications_("footer") : enableNotifications_("footer");
    action.catch(function(error) {
      trackNotificationFailure_(isEnabled ? "disable" : "enable", "footer");
      if (statusEl) {
        statusEl.textContent = error && error.message ? error.message :
          "Central could not update notifications.";
      }
    }).finally(function() {
      working = false;
      renderButton_();
    });
  }

  function mountControl_() {
    if (!document.body) return;
    if (buttonEl && buttonEl.isConnected) return;
    buttonEl = null;
    statusEl = null;
    var footer = document.querySelector(".public-footer-wrap");
    if (!footer) return;

    var control = document.createElement("div");
    control.className = "central-push-control";
    control.innerHTML = [
      "<button type=\"button\" class=\"central-push-toggle\"></button>",
      "<small class=\"central-push-status\" aria-live=\"polite\"></small>",
    ].join("");
    footer.appendChild(control);
    buttonEl = control.querySelector("button");
    statusEl = control.querySelector("small");
    buttonEl.addEventListener("click", handleToggle_);
    renderButton_();
  }

  function observeFooter_() {
    mountControl_();
    var observer = new MutationObserver(function() {
      mountControl_();
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  function getPromptMode_() {
    if (isPromptDismissed_()) return "";
    if (isIosDevice_() && !isStandalone_()) return "ios-install";
    if ("Notification" in window && Notification.permission === "denied") {
      return "blocked";
    }
    if (getStoredEnabled_()) return "";
    if (!initializationSettled) return "";
    if (!isSupported_() || !registration || !messaging) {
      return isAndroidDevice_() ? "android-unsupported" : "unsupported";
    }
    return "enable";
  }

  function maybeShowPrompt_() {
    var mode = getPromptMode_();
    if (!mode) {
      closePrompt_();
      return;
    }
    if (promptEl && promptEl.dataset.mode === mode) return;
    closePrompt_();

    var title = "Stay connected";
    var message = "Get occasional CrossPointe updates on this device.";
    var primaryLabel = "Enable notifications";
    var canEnable = mode === "enable";

    if (mode === "ios-install") {
      title = "Get notifications on iPhone";
      message = "Tap Share, choose Add to Home Screen, then open " +
        "CrossPointe Central from the new icon to enable notifications.";
      primaryLabel = "Got it";
    } else if (mode === "blocked") {
      title = "Notifications are blocked";
      message = "Allow notifications for Central in this browser's or " +
        "device's site settings, then return here and try again.";
      primaryLabel = "Got it";
    } else if (mode === "android-unsupported") {
      title = "Open Central in Chrome";
      message = "This in-app browser cannot receive push notifications. " +
        "Open this page in Chrome to enable them.";
      primaryLabel = "Got it";
    } else if (mode === "unsupported") {
      title = "Notifications unavailable";
      message = initializationError ||
        "This browser cannot receive Central push notifications.";
      primaryLabel = "Got it";
    } else if (Notification.permission === "granted") {
      title = "Turn notifications back on";
      message = "Reconnect this device to occasional CrossPointe updates.";
    }

    promptEl = document.createElement("aside");
    promptEl.className = "central-push-prompt";
    promptEl.dataset.mode = mode;
    promptEl.setAttribute("data-analytics-section", "notification_prompt");
    promptEl.setAttribute("role", "dialog");
    promptEl.setAttribute("aria-labelledby", "central-push-prompt-title");
    promptEl.innerHTML = [
      "<div class=\"central-push-prompt-icon\" aria-hidden=\"true\">" +
        "&#128276;</div>",
      "<div class=\"central-push-prompt-copy\">",
      "<strong id=\"central-push-prompt-title\"></strong>",
      "<p></p>",
      "</div><div class=\"central-push-prompt-actions\">",
      "<button type=\"button\" class=\"central-push-prompt-enable\"></button>",
      (canEnable ?
        "<button type=\"button\" class=\"central-push-prompt-later\" data-analytics-action=\"notification_prompt_later\" data-analytics-content-label=\"Not now\">" +
          "Not now</button>" : ""),
      "</div>",
    ].join("");
    promptEl.querySelector("strong").textContent = title;
    promptEl.querySelector("p").textContent = message;
    var primaryButton = promptEl.querySelector(
        ".central-push-prompt-enable",
    );
    primaryButton.textContent = primaryLabel;
    primaryButton.setAttribute(
        "data-analytics-action",
        canEnable ? "enable_notifications" : "acknowledge_notification_prompt",
    );
    primaryButton.setAttribute(
        "data-analytics-content-label",
        primaryLabel,
    );
    document.body.appendChild(promptEl);

    var laterButton = promptEl.querySelector(".central-push-prompt-later");
    if (laterButton) laterButton.addEventListener("click", dismissPrompt_);
    promptEl.querySelector(".central-push-prompt-enable")
        .addEventListener("click", function(event) {
          if (!canEnable) {
            dismissPrompt_();
            return;
          }
          var enableButton = event.currentTarget;
          enableButton.disabled = true;
          enableButton.textContent = "Enabling...";
          enableNotifications_("prompt").then(function() {
            closePrompt_();
          }).catch(function(error) {
            trackNotificationFailure_("enable", "prompt");
            enableButton.disabled = false;
            enableButton.textContent = "Enable notifications";
            if (promptEl) promptEl.querySelector("p").textContent =
              error && error.message ? error.message :
                "Central could not enable notifications.";
          }).finally(function() {
            working = false;
            renderButton_();
          });
        });
  }

  function syncExistingSubscription_() {
    if (!getStoredEnabled_()) return Promise.resolve();
    if (Notification.permission !== "granted") {
      setStoredEnabled_(false);
      renderButton_();
      maybeShowPrompt_();
      return Promise.resolve();
    }

    return messaging.getToken(getTokenOptions_()).then(function(token) {
      if (!token) throw new Error("This device needs to reconnect.");
      return postSubscription_(token, true);
    }).catch(function(error) {
      if (statusEl) {
        statusEl.textContent = error && error.message ? error.message :
          "Central could not refresh this notification subscription.";
      }
    });
  }

  observeFooter_();
  window.setTimeout(maybeShowPrompt_, 900);

  Promise.resolve(window.CENTRAL_FIREBASE_AUTH_READY)
      .then(function() {
        if (!isSupported_()) return null;
        messaging = window.firebase.messaging();
        return navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });
      })
      .then(function(serviceWorkerRegistration) {
        initializationSettled = true;
        if (!serviceWorkerRegistration) {
          renderButton_();
          maybeShowPrompt_();
          return;
        }
        registration = serviceWorkerRegistration;
        initializationError = "";
        renderButton_();
        maybeShowPrompt_();
        syncExistingSubscription_();
        messaging.onMessage(function(payload) {
          if (Notification.permission !== "granted") return;
          var data = payload && payload.data || {};
          var link = data.link || "/";
          registration.showNotification(data.title || "CrossPointe Central", {
            body: data.message || "",
            icon: "/icons/central-192.png",
            badge: "/icons/central-192.png",
            data: {link: link},
            requireInteraction: true,
          });
        });
      })
      .catch(function(error) {
        initializationSettled = true;
        initializationError = error && error.message ? error.message :
          "Central could not initialize push notifications.";
        renderButton_();
        maybeShowPrompt_();
        console.warn("Central push notifications are unavailable.", error);
      });
}());
