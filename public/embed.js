(function() {
  "use strict";

  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src) : null;
  var centralOrigin = scriptUrl ? scriptUrl.origin :
    "https://central.crosspointe.tv";
  var expansionDurationMs = 1000;

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

  function getGridGap_(grid) {
    var styles = window.getComputedStyle(grid);
    return parseFloat(styles.columnGap || styles.gap || "0") || 0;
  }

  function enhanceCompactEmbed_(root, grid) {
    var previous = root.querySelector('[data-central-embed-scroll="-1"]');
    var next = root.querySelector('[data-central-embed-scroll="1"]');
    if (!previous || !next) return;

    var updateControls = function() {
      var maximum = Math.max(0, grid.scrollWidth - grid.clientWidth);
      var hasOverflow = maximum > 2;
      root.classList.toggle(
          "central-embed-has-horizontal-overflow",
          hasOverflow,
      );
      previous.disabled = !hasOverflow || grid.scrollLeft <= 2;
      next.disabled = !hasOverflow || grid.scrollLeft >= maximum - 2;
    };

    var scrollGrid = function(direction) {
      var card = grid.querySelector(".central-embed-event");
      var distance = card ?
        card.getBoundingClientRect().width + getGridGap_(grid) :
        grid.clientWidth;
      grid.scrollBy({left: direction * distance, behavior: "smooth"});
    };

    previous.addEventListener("click", function() {
      scrollGrid(-1);
    });
    next.addEventListener("click", function() {
      scrollGrid(1);
    });
    grid.addEventListener("scroll", updateControls, {passive: true});
    window.addEventListener("resize", updateControls, {passive: true});
    updateControls();
    window.requestAnimationFrame(updateControls);
    window.setTimeout(updateControls, 250);
  }

  function getFirstRowHeight_(grid) {
    var cards = Array.from(grid.querySelectorAll(".central-embed-event"));
    if (!cards.length) return {height: 0, hasMoreRows: false};
    var gridRect = grid.getBoundingClientRect();
    var firstTop = cards[0].getBoundingClientRect().top;
    var firstRowBottom = firstTop;
    var hasMoreRows = false;

    cards.forEach(function(card) {
      var rect = card.getBoundingClientRect();
      if (Math.abs(rect.top - firstTop) <= 2) {
        firstRowBottom = Math.max(firstRowBottom, rect.bottom);
      } else {
        hasMoreRows = true;
      }
    });

    return {
      height: Math.max(0, firstRowBottom - gridRect.top),
      hasMoreRows: hasMoreRows,
    };
  }

  function afterHeightTransition_(element, callback) {
    var finished = false;
    var finish = function(event) {
      if (event &&
        (event.target !== element || event.propertyName !== "height")) {
        return;
      }
      if (finished) return;
      finished = true;
      element.removeEventListener("transitionend", finish);
      callback();
    };
    element.addEventListener("transitionend", finish);
    window.setTimeout(finish, expansionDurationMs + 90);
  }

  function enhanceStandardEmbed_(root, viewport, grid) {
    var button = root.querySelector("[data-central-embed-toggle]");
    if (!button) return;
    var collapsedHeight = 0;

    var measure = function() {
      if (button.disabled) return;
      var expanded = button.getAttribute("aria-expanded") === "true";
      viewport.style.transition = "none";
      viewport.style.height = "auto";
      root.classList.remove("central-embed-is-collapsed");

      var firstRow = getFirstRowHeight_(grid);
      collapsedHeight = firstRow.height;
      root.classList.toggle(
          "central-embed-has-overflow",
          firstRow.hasMoreRows,
      );

      if (firstRow.hasMoreRows && !expanded) {
        root.classList.add("central-embed-is-collapsed");
        viewport.style.height = collapsedHeight + "px";
      }
      viewport.offsetHeight;
      viewport.style.transition = "";
    };

    button.addEventListener("click", function() {
      if (button.disabled || !collapsedHeight) return;
      var expanded = button.getAttribute("aria-expanded") === "true";
      button.disabled = true;

      if (expanded) {
        viewport.style.height = grid.scrollHeight + "px";
        root.classList.add("central-embed-is-collapsed");
        viewport.offsetHeight;
        viewport.style.height = collapsedHeight + "px";
        button.setAttribute("aria-expanded", "false");
        button.textContent = "See More";
        afterHeightTransition_(viewport, function() {
          button.disabled = false;
          measure();
        });
        return;
      }

      viewport.style.height = viewport.getBoundingClientRect().height + "px";
      viewport.offsetHeight;
      viewport.style.height = grid.scrollHeight + "px";
      button.setAttribute("aria-expanded", "true");
      button.textContent = "See Less";
      afterHeightTransition_(viewport, function() {
        root.classList.remove("central-embed-is-collapsed");
        viewport.style.height = "auto";
        button.disabled = false;
      });
    });

    var resizeTimer = 0;
    window.addEventListener("resize", function() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 120);
    }, {passive: true});
    measure();
    window.requestAnimationFrame(measure);
    window.setTimeout(measure, 250);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }
  }

  function enhanceEmbed_(host) {
    var root = host.querySelector(".central-embed-root");
    if (!root || root.getAttribute("data-central-embed-enhanced") === "true") {
      return;
    }
    var grid = root.querySelector(".central-embed-grid");
    var viewport = root.querySelector(".central-embed-grid-viewport");
    if (!grid || !viewport) return;
    root.setAttribute("data-central-embed-enhanced", "true");
    root.classList.add("central-embed-is-enhanced");

    if (root.getAttribute("data-central-embed-layout") === "compact") {
      enhanceCompactEmbed_(root, grid);
      return;
    }
    enhanceStandardEmbed_(root, viewport, grid);
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
    var hasStaticHtml = !!host.querySelector(".central-embed-root");
    if (hasStaticHtml) {
      enhanceEmbed_(host);
      host.setAttribute("data-central-embed-static", "true");
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
      enhanceEmbed_(host);
      host.setAttribute("data-central-embed-loaded", "true");
      host.removeAttribute("aria-busy");
    }).catch(function() {
      if (!hasStaticHtml) renderError_(host, embedId);
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
