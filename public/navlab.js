/* Isolated Central preview: anonymous public content, no admin or shared preferences. */
import {mountCentralContent} from "./navlab-content.js?v=8";
import {mountGroupDirectory} from "./group-directory.js";
import {mountSundayStudy} from "./navlab-study.js?v=1";
import {createSundayPlayer} from "./navlab-player.js?v=2";
(() => {
  const byId = (id) => document.getElementById(id);
  const dialog = byId("detail-dialog");
  let sundayMode = false;
  let centralData = null;
  let study = null;
  const player = createSundayPlayer({
    host: byId("sunday-player-host"),
    onReturn: () => {
      setSundayMode(true);
      byId("sunday-watch-anchor")?.scrollIntoView({block: "center", behavior: "instant"});
    },
  });
  function ensureStudy() {
    if (study || !centralData) return;
    try {
      study = mountSundayStudy(byId("notes-content"), {data: centralData, theme: document.documentElement.dataset.theme});
    } catch (_error) {
      const root = byId("notes-content");
      root.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "The notes workspace could not open. Please try again.";
      const retry = document.createElement("button");
      retry.type = "button"; retry.className = "button"; retry.textContent = "Try again";
      retry.addEventListener("click", ensureStudy); root.append(message, retry);
    }
  }
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
  let destinations = ["home", "next-steps", "groups", "events"];
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
    if (next === "notes") ensureStudy();
    player.setView(next);
    document.querySelectorAll(".view").forEach((view) => {
      const available = destinations.includes(view.id);
      view.hidden = !available || (!mobile.matches && view.id !== next);
      // Keep offscreen controls out of the keyboard and screen-reader order.
      view.inert = !available || (mobile.matches && view.id !== next);
    });
    highlightView(next);
    const title = next === "next-steps" ? "Next Steps" : next[0].toUpperCase() + next.slice(1);
    document.title = `${title} · Central Navigation Lab`;
    if (focus) focusHeading(next);
  }

  function focusHeading(next) {
    byId(next === "home" && sundayMode ? "sunday-home-title" : `${next}-title`)?.focus({preventScroll: true});
  }

  function setSundayMode(enabled, showHome = true) {
    sundayMode = enabled;
    destinations = enabled ? ["home", "notes", "next-steps", "groups", "events"] : ["home", "next-steps", "groups", "events"];
    document.documentElement.dataset.sundayPreview = String(enabled);
    byId("notes-link").hidden = !enabled;
    byId("home-content").hidden = enabled;
    byId("sunday-home-content").hidden = !enabled;
    byId("home").setAttribute("aria-labelledby", enabled ? "sunday-home-title" : "home-title");
    byId("sunday-toggle").setAttribute("aria-pressed", String(enabled));
    byId("sunday-toggle-state").textContent = enabled ? "On" : "Off";
    player.setSundayMode(enabled);
    clearTimeout(scrollTimer);
    pendingNavigation = null;
    lastPagerWidth = 0;
    if (showHome) {
      if (dialog.open) dialog.close();
      pendingNavigation = mobile.matches ? {destination: "home", focus: false} : null;
      history.pushState(null, "", "#home");
      selectView("home", true);
      byId("home").scrollTop = 0;
      window.scrollTo({top: 0, behavior: "instant"});
      sizePager();
    }
  }
  byId("sunday-toggle").addEventListener("click", () => setSundayMode(!sundayMode));

  function navigate() {
    const requested = location.hash.slice(1);
    if (requested === "main") return;
    if (requested === "notes" && !sundayMode) setSundayMode(true, false);
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
      if (focus) focusHeading(next);
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
    study?.setTheme(dark ? "dark" : "light");
  }
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
  byId("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme !== "dark"));
  history.scrollRestoration = "manual";
  function goTo(destination) {
    if (destination === "notes" && !sundayMode) setSundayMode(true, false);
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
  // Start both public feeds without waiting for either. Central content already
  // prepares Events/Next Steps; warm Groups while the visitor browses Home.
  mountCentralContent({
    endpoint: "https://central.crosspointe.tv/api/central-data",
    onNavigate: goTo,
    onWatch: () => {
      goTo("home");
      byId("sunday-watch-anchor")?.scrollIntoView({block: "center", behavior: "instant"});
      player.open();
    },
    onData: (data) => {
      centralData = data;
      player.configure(data.sundaySettings || {});
      player.setHomeAnchor(byId("sunday-watch-anchor"));
      if (currentView === "notes") ensureStudy();
    },
  });
  ensureGroups();
})();
