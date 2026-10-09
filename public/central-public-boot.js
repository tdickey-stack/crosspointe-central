(function() {
  "use strict";

  var FIREBASE_COMPAT_VERSION = "11.10.0";
  var isLocalHost = ["localhost", "127.0.0.1", "[::1]"]
      .indexOf(window.location.hostname) !== -1;

  window.CENTRAL_BOOT_MODE = "public";
  window.CENTRAL_ANALYTICS_READY = false;
  document.documentElement.setAttribute("data-app-route", "public");

  function loadFirebaseScript_(name) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = name === "init" ? "/__/firebase/init.js" :
        "/__/firebase/" + FIREBASE_COMPAT_VERSION + "/firebase-" +
          name + "-compat.js";
      script.async = false;
      script.onload = resolve;
      script.onerror = function() {
        reject(new Error("Failed to load " + script.src));
      };
      document.head.appendChild(script);
    });
  }

  function initializeAnalytics_() {
    if (isLocalHost || !window.firebase ||
      typeof window.firebase.analytics !== "function") return;

    try {
      window.centralAnalytics = window.firebase.analytics();
      window.CENTRAL_ANALYTICS_READY = true;
    } catch (error) {
      console.warn("Firebase Analytics did not initialize.", error);
    }
  }

  window.CENTRAL_FIREBASE_AUTH_READY =
    loadFirebaseScript_("app")
        .then(function() {
          return loadFirebaseScript_("auth");
        })
        .then(function() {
          return loadFirebaseScript_("messaging");
        })
        .then(function() {
          return loadFirebaseScript_("firestore");
        })
        .then(function() {
          if (!isLocalHost) {
            return loadFirebaseScript_("analytics").catch(function(error) {
              console.warn("Firebase Analytics SDK did not load.", error);
            });
          }
        })
        .then(function() {
          return loadFirebaseScript_("init");
        })
        .then(function() {
          initializeAnalytics_();
          return window.firebase || null;
        })
        .catch(function(error) {
          console.error("Central Firebase did not initialize.", error);
          return null;
        });
}());
