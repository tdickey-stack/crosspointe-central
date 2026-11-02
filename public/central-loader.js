/* Central loader, retaining the standard progress and door reveal timing.
 * Loaded independently of the navigation module so a module/network failure can
 * offer recovery rather than leave the visitor behind an endless animation. */
(() => {
  const loader = document.getElementById("central-loader");
  if (!loader) return;
  const site = document.getElementById("central-site");
  const title = document.getElementById("central-loader-title");
  const detail = document.getElementById("central-loader-detail");
  const percent = document.getElementById("central-loader-percent");
  const retry = document.getElementById("central-loader-retry");
  const orbit = loader.querySelector(".central-loader-orbit");
  const dots = loader.querySelectorAll(".central-loader-dot");
  const seasonal = Boolean(window.CentralSeasonalExperience?.isActive());
  const popcornMount = seasonal ? document.getElementById("catm-lab-popcorn") : null;
  const soundButton = seasonal ? document.getElementById("central-loader-sound") : null;
  const started = Date.now();
  let value = 0;
  let target = 34;
  let frame = 0;
  let finished = false;
  let popcorn = null;
  let audio = null;
  let seasonalDisposed = false;
  let completionTimer = 0;
  let revealStarted = false;
  let pageLeft = false;
  const timeouts = new Set();
  function later(callback, delay) {
    const timer = window.setTimeout(() => {
      timeouts.delete(timer);
      if (!pageLeft) callback();
    }, delay);
    timeouts.add(timer);
    return timer;
  }
  function clearLater(timer) {
    window.clearTimeout(timer);
    timeouts.delete(timer);
  }
  document.documentElement.classList.add("central-is-loading");

  // A failed or slow decorative asset must never hold the application closed.
  let resolveArtwork;
  let artworkStarted = false;
  const artworkReady = new Promise(resolve => { resolveArtwork = resolve; });
  if (!popcornMount) resolveArtwork(null);
  function initializeArtwork() {
    if (!popcornMount || !window.CatmPopcornLab || artworkStarted || seasonalDisposed) return;
    artworkStarted = true;
    Promise.resolve().then(() => window.CatmPopcornLab.create(popcornMount)).then(controller => {
      if (seasonalDisposed) {
        controller.destroy();
        resolveArtwork(null);
        return;
      }
      popcorn = controller;
      controller.setProgress(value, {animate: true});
      resolveArtwork(controller);
    }).catch(() => resolveArtwork(null));
  }

  function updateSound(state) {
    if (!soundButton) return;
    soundButton.setAttribute("aria-pressed", String(state === "playing"));
    soundButton.textContent = state === "playing" ? "Mute popcorn sound" :
      state === "loading" ? "Loading sound…" : "Enable popcorn sound";
    soundButton.disabled = state === "loading";
  }
  function toggleSound() {
    if (!audio || seasonalDisposed) return;
    if (soundButton.getAttribute("aria-pressed") === "true") audio.stop();
    else audio.start();
  }
  function initializeAudio() {
    if (!soundButton || !window.CatmPopcornAudio || audio || seasonalDisposed) return;
    try {
      audio = window.CatmPopcornAudio.create({onState: updateSound});
      soundButton.hidden = false;
      soundButton.addEventListener("click", toggleSound);
    } catch (_error) { /* Silent loading also works without Web Audio. */ }
  }
  function initializeSeasonalAssets() {
    initializeArtwork();
    initializeAudio();
  }
  if (seasonal) {
    window.addEventListener("central:loaderasset", initializeSeasonalAssets);
    initializeSeasonalAssets();
  }
  function disposeSeasonal() {
    seasonalDisposed = true;
    resolveArtwork(null);
    window.removeEventListener("central:loaderasset", initializeSeasonalAssets);
    popcorn?.destroy();
    popcorn = null;
    audio?.destroy();
    audio = null;
    if (soundButton) {
      soundButton.hidden = true;
      soundButton.removeEventListener("click", toggleSound);
    }
  }

  function paint() {
    loader.style.setProperty("--central-loader-progress", `${value.toFixed(2)}%`);
    loader.style.setProperty("--central-loader-progress-ratio", (value / 100).toFixed(3));
    percent.textContent = `${Math.round(value)}%`;
    percent.setAttribute("aria-valuenow", String(Math.round(value)));
    const count = value >= 99.95 ? 6 : Math.floor(value / 100 * 6 + 0.0001);
    orbit.setAttribute("data-dot-count", String(count));
    dots.forEach((dot, index) => dot.classList.toggle("is-visible", index < count));
    popcorn?.setProgress(value, {animate: true});
    audio?.setProgress(value);
  }
  function animate() {
    const diff = target - value;
    value = Math.abs(diff) < 0.35 ? target : Math.min(target, value + diff * 0.18 + 0.24);
    paint();
    frame = Math.abs(target - value) >= 0.1 ? window.requestAnimationFrame(animate) : 0;
  }
  function progress(next) {
    target = Math.max(target, Math.min(100, next));
    if (!frame) frame = window.requestAnimationFrame(animate);
  }
  const trickle = window.setInterval(() => progress(Math.min(84, target + 2 + Math.random() * 3.2)), 360);
  const watchdog = window.setTimeout(fail, 35_000);
  progress(34);
  const reload = () => window.location.reload();
  retry.addEventListener("click", reload);
  function onPageHide() {
    pageLeft = true;
    stop();
    if (frame) window.cancelAnimationFrame(frame);
    timeouts.forEach(timer => window.clearTimeout(timer));
    timeouts.clear();
    disposeSeasonal();
  }
  function hideLoader() {
    loader.classList.add("is-hidden");
    loader.setAttribute("aria-busy", "false");
    loader.setAttribute("aria-hidden", "true");
    site.inert = false;
    document.documentElement.classList.remove("central-is-loading");
    retry.removeEventListener("click", reload);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  }
  function onPageShow(event) {
    if (!event.persisted || !pageLeft) return;
    pageLeft = false;
    // Completed content is ready to expose. An unfinished module needs visible
    // recovery while any resumed data request retains its late-finish path.
    if (finished) hideLoader();
    else fail();
  }
  window.addEventListener("pagehide", onPageHide, {once: true});
  window.addEventListener("pageshow", onPageShow);

  function stop() {
    window.clearInterval(trickle);
    window.clearTimeout(watchdog);
  }
  function fail() {
    if (finished) return;
    stop();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    disposeSeasonal();
    title.textContent = "Central could not finish loading";
    detail.textContent = "Please check your connection and reload Central to try again.";
    loader.setAttribute("aria-busy", "false");
    retry.hidden = false;
  }
  function finish(success = true) {
    if (finished) return;
    finished = true;
    stop();
    retry.hidden = true;
    title.textContent = success ? "Central Is Ready" : "Central could not load right now";
    detail.textContent = success ? "Opening the doors to everything happening at CrossPointe." :
      "Opening Central so you can try loading the content again.";
    progress(100);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function beginReveal() {
      if (revealStarted || pageLeft) return;
      revealStarted = true;
      clearLater(completionTimer);
      disposeSeasonal();
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          if (pageLeft) return;
          loader.classList.add("is-collapsing");
          later(() => {
            loader.classList.add("is-revealing");
            later(hideLoader, reduced ? 160 : 1525);
          }, reduced ? 80 : 680);
        });
      });
    }
    later(() => {
      if (!seasonal || seasonalDisposed) {
        beginReveal();
        return;
      }
      // Set the final thresholds before observing idle: the last kernels and
      // ticket must land before the curtain moves. Bound the entire wait,
      // including artwork fetch and browsers that suspend animation frames.
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      value = 100;
      paint();
      completionTimer = later(beginReveal, reduced ? 120 : 2400);
      artworkReady.then(controller => {
        if (revealStarted || !controller) return beginReveal();
        controller.setProgress(100, {animate: true});
        return controller.whenIdle().then(beginReveal);
      }).catch(beginReveal);
    }, Math.max(260, 980 - (Date.now() - started)));
  }
  window.CentralLoader = {finish, fail};
})();
