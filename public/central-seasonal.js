/* Public-shell seasonal controls share campaign preferences with the core runtime. */
(function(window) {
  "use strict";
  var document = window.document;
  var root = document.documentElement;
  var experience = window.CentralSeasonalExperience;
  if (root.getAttribute("data-production-shell") !== "true" || !experience) return;

  function syncThemeColor() {
    var dark = root.getAttribute("data-theme") === "dark";
    var active = experience.isActive();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = active ? (dark ? "#07110e" : "#f4ead7") : (dark ? "#18181b" : "#f4f4f5");
  }

  function syncControl(button) {
    var state = experience.getState();
    button.hidden = !state.available;
    button.textContent = state.active ? "Use Normal Central" : "Christmas Mode";
    button.setAttribute("aria-pressed", String(state.active));
    button.setAttribute("aria-label", state.active ? "Use Normal Central" : "Use Christmas At The Movies mode");
  }

  function sync() {
    document.querySelectorAll("[data-central-seasonal-toggle]").forEach(syncControl);
    syncThemeColor();
  }

  function setEnabled(enabled) {
    if (!experience.isAvailable()) return false;
    // Keep the active tab, notes editor, and live player mounted.
    if (!experience.setMode(enabled ? "seasonal" : "normal", false)) return false;
    sync();
    window.dispatchEvent(new window.CustomEvent("central:seasonalchange", {detail: experience.getState()}));
    return true;
  }

  function appendControl(container) {
    if (!experience.isAvailable()) return null;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "central-seasonal-toggle";
    button.setAttribute("data-central-seasonal-toggle", "");
    syncControl(button);
    button.addEventListener("click", function() {setEnabled(!experience.isActive());});
    container.append(button);
    return button;
  }

  window.CentralSeasonal = Object.freeze({
    getState: experience.getState,
    isAvailable: experience.isAvailable,
    isActive: experience.isActive,
    setEnabled: setEnabled,
    appendControl: appendControl,
    syncThemeColor: syncThemeColor,
  });
  sync();
}(window));
