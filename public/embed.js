(function() {
  "use strict";

  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src) : null;
  var centralOrigin = scriptUrl ? scriptUrl.origin :
    "https://central.crosspointe.tv";

  function ensureStyles_() {
    if (document.querySelector("link[data-central-embed-styles]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = centralOrigin + "/embed.css";
    link.setAttribute("data-central-embed-styles", "");
    document.head.appendChild(link);
  }

  function validEmbedId_(value) {
    var normalized = String(value || "").trim().toLowerCase();
    return /^embed_[a-z0-9]{12,32}$/.test(normalized) ? normalized : "";
  }

  function renderError_(host, embedId) {
    var fallback = embedId ?
      "<p class=\"central-embed-empty\">Events are temporarily unavailable. " +
        "<a href=\"" + centralOrigin + "/api/embed/" +
        encodeURIComponent(embedId) + ".html\">View upcoming events</a>.</p>" :
      "<p class=\"central-embed-empty\">Events are temporarily unavailable.</p>";
    host.innerHTML = [
      "<section class=\"central-embed-root\" aria-label=\"CrossPointe events\">",
      fallback,
      "</section>",
    ].join("");
  }

  function loadHost_(host) {
    if (!host || host.getAttribute("data-central-embed-loading") === "true") {
      return;
    }
    var embedId = validEmbedId_(host.getAttribute("data-central-embed"));
    if (!embedId) {
      renderError_(host, "");
      return;
    }
    host.setAttribute("data-central-embed-loading", "true");
    host.setAttribute("aria-busy", "true");
    fetch(
        centralOrigin + "/api/embed/" + encodeURIComponent(embedId) +
          ".html?styles=0",
        {
          cache: "no-store",
          headers: {Accept: "text/html"},
        },
    ).then(function(response) {
      if (!response.ok) throw new Error("Embed request failed.");
      return response.text();
    }).then(function(html) {
      host.innerHTML = html;
      host.setAttribute("data-central-embed-loaded", "true");
      host.removeAttribute("aria-busy");
    }).catch(function() {
      renderError_(host, embedId);
      host.removeAttribute("aria-busy");
    });
  }

  function boot_() {
    ensureStyles_();
    document.querySelectorAll("[data-central-embed]").forEach(loadHost_);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot_, {once: true});
  } else {
    boot_();
  }
}());
