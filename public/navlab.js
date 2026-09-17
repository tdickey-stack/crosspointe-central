/* Isolated Central preview: anonymous public content, no admin or shared preferences. */
import {mountCentralContent} from "./navlab-content.js?v=5";
import {mountGroupDirectory} from "./group-directory.js";
(() => {
  const byId = (id) => document.getElementById(id);
  const dialog = byId("detail-dialog");
  let previousFocus;
  let groupsStarted = false;
  function ensureGroups() {
    if (groupsStarted) return;
    groupsStarted = true;
    mountGroupDirectory(byId("live-groups"), {
      endpoint: "https://central.crosspointe.tv/api/groups",
      fallbackUrl: "https://crosspointetv.churchcenter.com/groups",
    });
  }
  let currentView = "";
  const destinations = ["home", "next-steps", "groups", "events"];
  const scrollPositions = {};
  const pager = byId("page-track");
  const navigation = document.querySelector(".navigation");
  const headerInner = document.querySelector(".header-inner");
  const mobile = window.matchMedia("(max-width: 760px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scrollTimer;
  let lastPagerWidth = 0;
  let pendingNavigation = null;
  let highlightedView = "";

  function highlightView(next) {
    if (!next || next === highlightedView) return;
    highlightedView = next;
    document.querySelectorAll("[data-destination]").forEach((link) => {
      if (link.dataset.destination === next) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function selectView(next, focus = false) {
    currentView = next;
    if (next === "groups") ensureGroups();
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = !mobile.matches && view.id !== next;
      // Keep offscreen controls out of the keyboard and screen-reader order.
      view.inert = mobile.matches && view.id !== next;
    });
    highlightView(next);
    const title = next === "next-steps" ? "Next Steps" : next[0].toUpperCase() + next.slice(1);
    document.title = `${title} · Central Navigation Lab`;
    if (focus) byId(`${next}-title`)?.focus({preventScroll: true});
  }

  function navigate() {
    const requested = location.hash.slice(1);
    if (requested === "main") return;
    const next = destinations.includes(requested) ? requested : "home";
    if (next === currentView && !mobile.matches) return;
    if (dialog.open) dialog.close();
    const initial = !currentView;
    if (currentView && !mobile.matches) scrollPositions[currentView] = window.scrollY;
    clearTimeout(scrollTimer);
    pendingNavigation = mobile.matches ? {destination: next, focus: !initial} : null;
    selectView(next, !initial && !mobile.matches);
    if (mobile.matches) {
      pager.scrollTo({
        left: destinations.indexOf(next) * pager.clientWidth,
        behavior: initial || reduceMotion.matches ? "instant" : "smooth",
      });
      settlePage();
    } else {
      window.scrollTo({top: scrollPositions[next] || 0, behavior: "instant"});
    }
  }

  // The browser owns dragging, momentum, cancellation, and snap animations.
  // Highlight the mostly visible page during a swipe; commit URL/focus afterward.
  function settlePage() {
    if (!mobile.matches || !pager.clientWidth || document.querySelector("dialog[open]")) return;
    const index = Math.round(pager.scrollLeft / pager.clientWidth);
    if (Math.abs(pager.scrollLeft - index * pager.clientWidth) > 2) return;
    const next = destinations[index];
    // A stale scroll-end at the old page must not undo a tab/button request.
    // Wait to move focus until the requested page has actually arrived, too.
    if (pendingNavigation) {
      if (next !== pendingNavigation.destination) return;
      const {focus} = pendingNavigation;
      pendingNavigation = null;
      if (focus) byId(`${next}-title`)?.focus({preventScroll: true});
    }
    if (!next || next === currentView) return;
    selectView(next);
    history.pushState(null, "", `#${next}`);
  }
  pager.addEventListener("scroll", (event) => {
    if (event.target !== pager) return;
    if (mobile.matches && pager.clientWidth && !pendingNavigation) {
      highlightView(destinations[Math.round(pager.scrollLeft / pager.clientWidth)]);
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(settlePage, 150);
  }, {passive: true});
  pager.addEventListener("scrollend", (event) => {
    if (event.target === pager) settlePage();
  });
  // A new gesture takes ownership immediately; native swiping is never locked.
  for (const eventName of ["pointerdown", "touchstart", "wheel"]) {
    pager.addEventListener(eventName, () => {
      pendingNavigation = null;
      clearTimeout(scrollTimer);
    }, {passive: true});
  }

  function sizePager() {
    // Keep the mobile bar in normal flow within the dynamic viewport shell.
    // Independent fixed-bottom positioning can leave a gap on mobile browsers.
    if (mobile.matches && navigation.parentElement !== document.body) {
      document.body.append(navigation);
    } else if (!mobile.matches && navigation.parentElement !== headerInner) {
      headerInner.insertBefore(navigation, byId("theme-toggle"));
    }
    if (mobile.matches && pager.clientWidth !== lastPagerWidth) {
      pager.scrollTo({left: destinations.indexOf(currentView) * pager.clientWidth, behavior: "instant"});
    }
    lastPagerWidth = pager.clientWidth;
  }
  mobile.addEventListener("change", () => {
    pendingNavigation = null;
    selectView(currentView);
    lastPagerWidth = 0;
    sizePager();
  });
  window.addEventListener("resize", sizePager);
  dialog.addEventListener("close", () => {
    document.body.style.overflow = "";
    previousFocus?.focus({preventScroll: true});
  });
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  byId("detail-done").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    byId("theme-toggle").setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? "#18181b" : "#f4f4f5";
  }
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
  byId("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme !== "dark"));
  history.scrollRestoration = "manual";
  function goTo(destination) {
    if (!destinations.includes(destination)) return;
    if (location.hash !== `#${destination}`) history.pushState(null, "", `#${destination}`);
    navigate();
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[data-destination], a[href="#home"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goTo(link.hash.slice(1));
  });
  document.addEventListener("click", (event) => {
    if (!dialog.open) previousFocus = event.target.closest("button, a") || document.activeElement;
  }, true);
  window.addEventListener("popstate", navigate);
  window.addEventListener("hashchange", navigate);
  navigate();
  sizePager();
  mountCentralContent({endpoint: "https://central.crosspointe.tv/api/central-data", onNavigate: goTo});
})();
