(function() {
  "use strict";

  if (window.CENTRAL_BOOT_MODE === "admin") return;

  var SUBSCRIPTION_ENDPOINT = "/api/push/subscription";
  var STATE_STORAGE_KEY = "central-push-enabled-v1";
  var messaging = null;
  var registration = null;
  var buttonEl = null;
  var statusEl = null;
  var working = false;
  var initializationError = "";

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
    statusEl.textContent = enabled ?
      "Push notifications are on for this device." :
      (Notification.permission === "denied" ?
        "Notifications are blocked in this browser's settings." :
        "Get occasional updates from CrossPointe Central.");
  }

  function enableNotifications_() {
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
          });
        });
  }

  function disableNotifications_() {
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
    });
  }

  function handleToggle_() {
    if (working || !registration || !messaging) return;
    var action = getStoredEnabled_() ?
      disableNotifications_() : enableNotifications_();
    action.catch(function(error) {
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
    if (buttonEl || !document.body) return;
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
    if (buttonEl) return;
    var observer = new MutationObserver(function() {
      mountControl_();
      if (buttonEl) observer.disconnect();
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  observeFooter_();

  Promise.resolve(window.CENTRAL_FIREBASE_AUTH_READY)
      .then(function() {
        if (!isSupported_()) return null;
        messaging = window.firebase.messaging();
        return navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });
      })
      .then(function(serviceWorkerRegistration) {
        if (!serviceWorkerRegistration) return;
        registration = serviceWorkerRegistration;
        initializationError = "";
        renderButton_();
        messaging.onMessage(function(payload) {
          if (Notification.permission !== "granted") return;
          var data = payload && payload.data || {};
          var link = data.link || "/";
          var foregroundNotification = new Notification(
              data.title || "CrossPointe Central",
              {
                body: data.message || "",
                icon: "/icons/central-192.png",
              },
          );
          foregroundNotification.onclick = function() {
            window.focus();
            window.location.assign(link);
          };
        });
      })
      .catch(function(error) {
        initializationError = error && error.message ? error.message :
          "Central could not initialize push notifications.";
        renderButton_();
        console.warn("Central push notifications are unavailable.", error);
      });
}());
