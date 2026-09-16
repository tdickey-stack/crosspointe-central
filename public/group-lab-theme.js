/* Lab shell only: the reusable directory follows its host's data-theme. */
(() => {
  const storageKey = "central-theme-override-v2";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const validTheme = (value) => value === "light" || value === "dark";
  let override = null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (validTheme(stored)) override = stored;
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }

  function applyTheme() {
    const theme = override || (systemTheme.matches ? "dark" : "light");
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", isDark ? "#18181b" : "#f4f4f5");
    document.querySelector("[data-group-theme-toggle]")
        ?.setAttribute("aria-checked", String(isDark));
  }

  // Apply before CSS/paint so a saved dark theme does not flash light.
  applyTheme();
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    document.querySelector("[data-group-theme-toggle]")
        ?.addEventListener("click", () => {
          override = document.documentElement.dataset.theme === "dark" ?
            "light" : "dark";
          try {
            localStorage.setItem(storageKey, override);
          } catch {
            // Keep the current choice for this page even without storage.
          }
          applyTheme();
        });
  });
  systemTheme.addEventListener("change", () => {
    if (!override) applyTheme();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    override = validTheme(event.newValue) ? event.newValue : null;
    applyTheme();
  });
})();
