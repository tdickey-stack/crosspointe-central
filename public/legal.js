(function() {
  "use strict";

  var storageKey = "central-theme-override-v2";
  var toggle = document.querySelector("[data-legal-theme-toggle]");
  var themeLabel = document.querySelector("[data-legal-theme-label]");

  function getTheme_() {
    return document.documentElement.getAttribute("data-theme") === "dark" ?
      "dark" : "light";
  }

  function applyTheme_(theme, persist) {
    var normalizedTheme = theme === "dark" ? "dark" : "light";
    var themeColor = document.querySelector('meta[name="theme-color"]');

    document.documentElement.setAttribute("data-theme", normalizedTheme);
    document.documentElement.style.colorScheme = normalizedTheme;

    if (themeColor) {
      themeColor.setAttribute(
          "content",
          normalizedTheme === "dark" ? "#18181b" : "#f4f4f5",
      );
    }

    if (toggle) {
      toggle.setAttribute("data-theme-state", normalizedTheme);
      toggle.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
    }

    if (themeLabel) {
      themeLabel.textContent = normalizedTheme === "dark" ? "Dark" : "Light";
    }

    if (persist) {
      try {
        localStorage.setItem(storageKey, normalizedTheme);
      } catch (error) {
      }
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function() {
      applyTheme_(getTheme_() === "dark" ? "light" : "dark", true);
    });
  }

  applyTheme_(getTheme_(), false);
}());
