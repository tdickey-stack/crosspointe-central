(function() {
  "use strict";

  var STANDARD_DEMO_ID = "embed_labstandard1";
  var SOURCE_PATTERN = /embed_[a-z0-9]{12,32}/i;
  var form = document.querySelector("[data-lab-form]");
  var sourceInput = document.querySelector("[data-lab-source]");
  var frame = document.querySelector("[data-lab-frame]");
  var device = document.querySelector("[data-lab-device]");
  var deviceLabel = document.querySelector("[data-lab-device-label]");
  var stage = document.querySelector("[data-lab-stage]");
  var status = document.querySelector("[data-lab-status]");
  var payloadOutput = document.querySelector("[data-lab-payload]");
  var htmlLink = document.querySelector("[data-lab-html-link]");
  var jsonLink = document.querySelector("[data-lab-json-link]");
  var copyButton = document.querySelector("[data-lab-copy]");
  var environment = document.querySelector("[data-lab-environment]");
  var emulatorUiLink = document.querySelector("[data-emulator-ui-link]");
  var state = {
    id: "",
    width: "1200",
    background: "light",
    payload: null,
    staticHtml: "",
  };

  if (!form || !sourceInput || !frame || !device || !status) return;

  initialize_();

  function initialize_() {
    var query = new URLSearchParams(window.location.search);
    var requestedId = parseEmbedId_(query.get("id")) || STANDARD_DEMO_ID;
    var requestedWidth = ["1200", "760", "390"].includes(
        query.get("width"),
    ) ? query.get("width") : "1200";
    var requestedBackground = ["light", "warm", "dark"].includes(
        query.get("background"),
    ) ? query.get("background") : "light";
    var isLocal = ["localhost", "127.0.0.1", "[::1]"]
        .includes(window.location.hostname);

    environment.textContent = isLocal ?
      "Local emulator" : "Deployed environment";
    environment.classList.toggle("is-local", isLocal);
    if (!isLocal && emulatorUiLink) emulatorUiLink.hidden = true;

    state.width = requestedWidth;
    state.background = requestedBackground;
    sourceInput.value = requestedId;
    applyWidth_(requestedWidth, false);
    applyBackground_(requestedBackground, false);

    form.addEventListener("submit", function(event) {
      event.preventDefault();
      loadEmbed_(sourceInput.value);
    });

    document.querySelectorAll("[data-demo-id]").forEach(function(button) {
      button.addEventListener("click", function() {
        sourceInput.value = button.getAttribute("data-demo-id") || "";
        loadEmbed_(sourceInput.value);
      });
    });

    document.querySelectorAll("[data-width]").forEach(function(button) {
      button.addEventListener("click", function() {
        applyWidth_(button.getAttribute("data-width") || "1200", true);
      });
    });

    document.querySelectorAll("[data-background]").forEach(function(button) {
      button.addEventListener("click", function() {
        applyBackground_(
            button.getAttribute("data-background") || "light",
            true,
        );
      });
    });

    copyButton.addEventListener("click", copyEmbedCode_);
    window.addEventListener("message", handleFrameMessage_);
    loadEmbed_(requestedId);
  }

  function parseEmbedId_(value) {
    var match = String(value || "").trim().match(SOURCE_PATTERN);
    return match ? match[0].toLowerCase() : "";
  }

  function loadEmbed_(source) {
    var id = parseEmbedId_(source);
    if (!id) {
      setStatus_(
          "error",
          "Embed ID not found",
          "Enter an Embed ID or paste the copied embed code.",
      );
      return;
    }

    state.id = id;
    state.payload = null;
    state.staticHtml = "";
    sourceInput.value = id;
    updateLinks_();
    updateUrl_();
    setStatus_("loading", "Loading " + id, "Checking the public endpoint.");
    payloadOutput.textContent = "Loading public payload…";
    frame.srcdoc = createHostDocument_(id, "");

    var startedAt = window.performance.now();
    var payloadRequest = fetch(
        "/api/embed/" + encodeURIComponent(id) + ".json",
        {
          cache: "no-store",
          headers: {Accept: "application/json"},
        },
    ).then(function(response) {
      return response.json().catch(function() {
        return {};
      }).then(function(payload) {
        if (!response.ok) {
          throw new Error(payload.error || "Embed endpoint returned " +
            String(response.status) + ".");
        }
        return payload;
      });
    });
    var htmlRequest = fetch(
        "/api/embed/" + encodeURIComponent(id) + ".html?styles=0",
        {
          cache: "no-store",
          headers: {Accept: "text/html"},
        },
    ).then(function(response) {
      if (!response.ok) {
        throw new Error("Semantic HTML endpoint returned " +
          String(response.status) + ".");
      }
      return response.text();
    });

    Promise.all([payloadRequest, htmlRequest]).then(function(results) {
      if (state.id !== id) return;
      var payload = results[0];
      var staticHtml = results[1];
      state.staticHtml = staticHtml;
      frame.srcdoc = createHostDocument_(id, staticHtml);
      state.payload = payload;
      payloadOutput.textContent = JSON.stringify(payload, null, 2);
      var events = Array.isArray(payload.events) ? payload.events : [];
      var featuredCount = events.filter(function(event) {
        return event.featured === true;
      }).length;
      var elapsed = Math.round(window.performance.now() - startedAt);
      setStatus_(
          "success",
          (payload.layout === "compact" ? "Compact" : "Standard") +
            " embed loaded",
          String(events.length) + " raw HTML event" +
            (events.length === 1 ? "" : "s") + " · " +
            String(featuredCount) + " featured · live JS refresh · v" +
            String(payload.publishedVersion || 1) + " · " +
            String(elapsed) + "ms",
      );
    }).catch(function(error) {
      payloadOutput.textContent = JSON.stringify({
        error: error && error.message || "Embed request failed.",
      }, null, 2);
      setStatus_(
          "error",
          "Embed did not load",
          error && error.message || "Check the emulator and published ID.",
      );
    });
  }

  function createHostDocument_(id, staticHtml) {
    var origin = window.location.origin;
    var endpoint = origin + "/api/embed/" + encodeURIComponent(id) + ".html";
    var palette = getHostPalette_();
    var snapshot = String(staticHtml || "").trim();
    var initialContent = snapshot ? snapshot +
      "<p class=\"central-embed-source\"><a href=\"" + endpoint +
      "\">View the latest CrossPointe events</a></p>" :
      "<p><a href=\"" + endpoint +
      "\">View upcoming CrossPointe events</a></p>";
    return [
      "<!doctype html><html lang=\"en\"><head>",
      "<meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<link rel=\"stylesheet\" href=\"", origin,
      "/embed.css\" data-central-embed-styles>",
      "<style>",
      "html{background:", palette.background, ";color:", palette.color, ";}",
      "body{margin:0;padding:clamp(18px,4vw,44px);font-family:Georgia,serif;}",
      ".host-heading{border-bottom:1px solid ", palette.line,
      ";margin:0 0 28px;padding:0 0 18px;}",
      ".host-heading small{display:block;font:700 11px/1 Arial,sans-serif;",
      "letter-spacing:.14em;margin-bottom:7px;text-transform:uppercase;}",
      ".host-heading h1{font-size:clamp(24px,4vw,44px);margin:0;}",
      ".host-grid{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;}",
      "</style></head><body>",
      "<header class=\"host-heading\"><small>Third-party website</small>",
      "<h1>Upcoming at CrossPointe</h1></header>",
      "<main class=\"host-grid\"><div class=\"central-embed\" data-central-embed=\"",
      id, "\">", initialContent, "</div></main>",
      "<script async src=\"", origin, "/embed.js\"></script>",
      "<script>(function(){var host=null;",
      "function report(){parent.postMessage({source:'central-embed-lab',id:'",
      id,
      "',height:document.documentElement?document.documentElement.scrollHeight:0,loaded:host&&host.hasAttribute('data-central-embed-loaded')},'",
      origin,
      "');}function watch(){host=document.querySelector('[data-central-embed]');",
      "if(window.ResizeObserver&&document.body){new ResizeObserver(report).observe(document.body);}",
      "report();}if(document.readyState==='loading'){document.addEventListener(",
      "'DOMContentLoaded',watch,{once:true});}else{watch();}",
      "window.addEventListener('load',report);}());</script>",
      "</body></html>",
    ].join("");
  }

  function getHostPalette_() {
    if (state.background === "dark") {
      return {background: "#171619", color: "#f6f2f5", line: "#49434a"};
    }
    if (state.background === "warm") {
      return {background: "#f3ede4", color: "#3e342e", line: "#d8ccbd"};
    }
    return {background: "#f7f6f7", color: "#262328", line: "#ded9df"};
  }

  function applyWidth_(width, updateUrl) {
    state.width = ["1200", "760", "390"].includes(width) ? width : "1200";
    device.style.width = state.width + "px";
    deviceLabel.textContent = "Third-party site · " + state.width + "px";
    document.querySelectorAll("[data-width]").forEach(function(button) {
      button.classList.toggle(
          "is-selected",
          button.getAttribute("data-width") === state.width,
      );
    });
    if (updateUrl) updateUrl_();
  }

  function applyBackground_(background, reload) {
    state.background = ["light", "warm", "dark"].includes(background) ?
      background : "light";
    stage.setAttribute("data-background", state.background);
    document.querySelectorAll("[data-background]").forEach(function(button) {
      button.classList.toggle(
          "is-selected",
          button.getAttribute("data-background") === state.background,
      );
    });
    if (reload && state.id) {
      updateUrl_();
      frame.srcdoc = createHostDocument_(state.id, state.staticHtml);
    }
  }

  function handleFrameMessage_(event) {
    var data = event.data && typeof event.data === "object" ? event.data : {};
    if (
      event.origin !== window.location.origin ||
      event.source !== frame.contentWindow ||
      data.source !== "central-embed-lab" ||
      data.id !== state.id
    ) return;
    var requestedHeight = Number(data.height) || 760;
    frame.style.height = Math.min(1800, Math.max(520, requestedHeight + 2)) +
      "px";
  }

  function updateLinks_() {
    var base = "/api/embed/" + encodeURIComponent(state.id);
    htmlLink.href = base + ".html";
    jsonLink.href = base + ".json";
  }

  function updateUrl_() {
    var query = new URLSearchParams();
    if (state.id) query.set("id", state.id);
    query.set("width", state.width);
    query.set("background", state.background);
    window.history.replaceState({}, "", "/embed-lab.html?" + query.toString());
  }

  function copyEmbedCode_() {
    if (!state.id) return;
    var endpoint = window.location.origin + "/api/embed/" + state.id + ".html";
    var staticContent = state.staticHtml ?
      indentEmbedHtml_(state.staticHtml) + "\n" +
        "  <p class=\"central-embed-source\"><a href=\"" + endpoint +
        "\">View the latest CrossPointe events</a></p>\n" :
      "  <p><a href=\"" + endpoint +
        "\">View upcoming CrossPointe events</a></p>\n";
    var code = [
      "<link rel=\"stylesheet\" href=\"", window.location.origin,
      "/embed.css\" data-central-embed-styles>\n",
      "<div class=\"central-embed\" data-central-embed=\"", state.id, "\">\n",
      staticContent,
      "</div>\n<script async src=\"", window.location.origin,
      "/embed.js\"></script>",
    ].join("");
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      window.prompt("Copy this embed code:", code);
      return;
    }
    navigator.clipboard.writeText(code).then(function() {
      var original = copyButton.textContent;
      copyButton.textContent = "Embed code copied";
      window.setTimeout(function() {
        copyButton.textContent = original;
      }, 1800);
    }).catch(function() {
      window.prompt("Copy this embed code:", code);
    });
  }

  function indentEmbedHtml_(html) {
    return String(html || "").trim().replace(/></g, ">\n<")
        .split("\n").map(function(line) {
          return "  " + line;
        }).join("\n");
  }

  function setStatus_(tone, title, detail) {
    status.className = "embed-lab-status is-" + tone;
    status.querySelector("strong").textContent = title;
    status.querySelector("small").textContent = detail;
  }
}());
