/* Navlab preview state is URL-only; never changes Central's saved preferences. */
(function(window) {
  "use strict";
  var root = window.document.documentElement;
  var experience = window.CentralSeasonalExperience;
  var attribute = "data-seasonal-experience";
  var bound = false;

  function resolve(search) {
    if (!experience) return {available: false, active: false};
    var state = experience.resolveState({
      config: window.CENTRAL_SEASONAL_EXPERIENCE_CONFIG,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      search: search,
      storedMode: "",
    });
    // This control is only for local/dev review, even if production is enabled later.
    return {available: state.environment === "preview" && state.available,
      active: state.environment === "preview" && state.active};
  }

  function syncThemeColor() {
    var dark = root.getAttribute("data-theme") === "dark";
    var active = root.getAttribute(attribute) === "christmas-at-the-movies";
    var meta = window.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = active ? (dark ? "#07110e" : "#f4ead7") : (dark ? "#18181b" : "#f4f4f5");
  }

  function apply() {
    var state = resolve(window.location.search);
    if (state.active) root.setAttribute(attribute, "christmas-at-the-movies");
    else root.removeAttribute(attribute);
    root.setAttribute("data-seasonal-experience-available", String(state.available));
    var button = window.document.getElementById("christmas-toggle");
    if (button) {
      button.hidden = !state.available;
      button.setAttribute("aria-pressed", String(state.active));
      window.document.getElementById("christmas-toggle-state").textContent = state.active ? "On" : "Off";
    }
    syncThemeColor();
    return state;
  }

  function setEnabled(enabled) {
    if (!resolve(window.location.search).available) return false;
    var url = new URL(window.location.href);
    url.searchParams.set("seasonalPreview", enabled ? "christmas" : "off");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    apply();
    window.dispatchEvent(new window.Event("navlabseasonchange"));
    return true;
  }

  function bind() {
    var button = window.document.getElementById("christmas-toggle");
    if (!bound && button) {
      button.addEventListener("click", function() {
        setEnabled(!resolve(window.location.search).active);
      });
      bound = true;
    }
    apply();
  }

  apply();
  if (window.document.readyState === "loading") window.document.addEventListener("DOMContentLoaded", bind);
  else bind();
  window.addEventListener("popstate", apply);
  window.NavlabSeasonal = Object.freeze({setEnabled: setEnabled, syncThemeColor: syncThemeColor});
}(window));
