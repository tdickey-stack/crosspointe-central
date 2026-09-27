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
  // Match Central's --cp-ease (also shared by Studio and Planner).
  const pageMotion = {duration: 420, curve: [0.16, 1, 0.3, 1]};
  let stopPageMotion = null;

  function cancelPageMotion() {
    stopPageMotion?.();
    stopPageMotion = null;
  }

  function slideDesktop(previous, next, previousScroll) {
    const outgoing = byId(previous);
    const incoming = byId(next);
    const distance = (destinations.indexOf(next) > destinations.indexOf(previous) ? 1 : -1) * pager.clientWidth;
    outgoing.hidden = false;
    outgoing.inert = true;
    outgoing.style.position = "absolute";
    outgoing.style.width = "100%";
    outgoing.style.top = `${window.scrollY - previousScroll}px`;
    pager.dataset.sliding = "true";
    const timing = {duration: pageMotion.duration, easing: `cubic-bezier(${pageMotion.curve.join(",")})`, fill: "both"};
    const exit = outgoing.animate([{transform: "translateX(0)"}, {transform: `translateX(${-distance}px)`}], timing);
    const enter = incoming.animate([{transform: `translateX(${distance}px)`}, {transform: "translateX(0)"}], timing);
    const cleanup = () => {
      enter.onfinish = null;
      outgoing.hidden = true;
      outgoing.style.position = outgoing.style.width = outgoing.style.top = "";
      delete pager.dataset.sliding;
      exit.cancel();
      enter.cancel();
    };
    stopPageMotion = cleanup;
    enter.onfinish = () => {
      cleanup();
      stopPageMotion = null;
      focusHeading(next);
    };
  }

  // ScrollTo's browser-defined smooth easing cannot use --cp-ease. Animate
  // button requests only; native touch scrolling and snapping still own swipes.
  function slideMobile(left) {
    const start = pager.scrollLeft;
    if (Math.abs(left - start) < 1) {
      pager.scrollTo({left, behavior: "instant"});
      settlePage();
      return;
    }
    const [x1, y1, x2, y2] = pageMotion.curve;
    const bezier = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    const ease = (progress) => {
      let low = 0, high = 1;
      for (let i = 0; i < 16; i++) {
        const t = (low + high) / 2;
        if (bezier(t, x1, x2) < progress) low = t;
        else high = t;
      }
      return bezier((low + high) / 2, y1, y2);
    };
    let started;
    let frame;
    pager.dataset.sliding = "true";
    stopPageMotion = () => {
      window.cancelAnimationFrame(frame);
      delete pager.dataset.sliding;
    };
    const step = (time) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / pageMotion.duration);
      pager.scrollTo({left: progress === 1 ? left : start + (left - start) * ease(progress), behavior: "instant"});
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else {
        cancelPageMotion();
        settlePage();
      }
    };
    frame = window.requestAnimationFrame(step);
  }

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
      view.inert = !available || view.id !== next;
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
    cancelPageMotion();
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
    const previous = currentView;
    const previousScroll = window.scrollY;
    cancelPageMotion();
    if (currentView && !mobile.matches) scrollPositions[currentView] = window.scrollY;
    clearTimeout(scrollTimer);
    pendingNavigation = mobile.matches ? {destination: next, focus: !initial} : null;
    const animate = !initial && !reduceMotion.matches;
    selectView(next, !initial && !mobile.matches && !animate);
    if (mobile.matches) {
      const left = destinations.indexOf(next) * pager.clientWidth;
      if (animate) slideMobile(left);
      else {
        pager.scrollTo({left, behavior: "instant"});
        settlePage();
      }
    } else {
      window.scrollTo({top: scrollPositions[next] || 0, behavior: "instant"});
      if (animate) slideDesktop(previous, next, previousScroll);
    }
  }

  // The browser owns dragging, momentum, cancellation, and snap animations.
  // Highlight the mostly visible page during a swipe; commit URL/focus afterward.
  function settlePage() {
    if (stopPageMotion) return;
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
      if (mobile.matches) cancelPageMotion();
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
    if (pager.clientWidth !== lastPagerWidth) {
      const wasSliding = Boolean(stopPageMotion);
      cancelPageMotion();
      if (mobile.matches) {
        pager.scrollTo({left: destinations.indexOf(currentView) * pager.clientWidth, behavior: "instant"});
        if (wasSliding) settlePage();
      } else if (wasSliding) focusHeading(currentView);
    }
    lastPagerWidth = pager.clientWidth;
  }
  mobile.addEventListener("change", () => {
    cancelPageMotion();
    pendingNavigation = null;
    selectView(currentView);
    lastPagerWidth = 0;
    sizePager();
  });
  window.addEventListener("resize", sizePager);
  reduceMotion.addEventListener("change", () => {
    if (!reduceMotion.matches || !stopPageMotion) return;
    cancelPageMotion();
    if (mobile.matches) {
      pager.scrollTo({left: destinations.indexOf(currentView) * pager.clientWidth, behavior: "instant"});
      settlePage();
    } else focusHeading(currentView);
  });
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
