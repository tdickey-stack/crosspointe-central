/* Standard Central loader, retaining the legacy progress and door reveal timing.
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
  const started = Date.now();
  let value = 0;
  let target = 34;
  let frame = 0;
  let finished = false;
  document.documentElement.classList.add("central-is-loading");

  function paint() {
    loader.style.setProperty("--central-loader-progress", `${value.toFixed(2)}%`);
    loader.style.setProperty("--central-loader-progress-ratio", (value / 100).toFixed(3));
    percent.textContent = `${Math.round(value)}%`;
    percent.setAttribute("aria-valuenow", String(Math.round(value)));
    const count = value >= 99.95 ? 6 : Math.floor(value / 100 * 6 + 0.0001);
    orbit.setAttribute("data-dot-count", String(count));
    dots.forEach((dot, index) => dot.classList.toggle("is-visible", index < count));
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
  retry.addEventListener("click", () => window.location.reload());

  function stop() {
    window.clearInterval(trickle);
    window.clearTimeout(watchdog);
  }
  function fail() {
    if (finished) return;
    stop();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
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
    window.setTimeout(() => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        loader.classList.add("is-collapsing");
        window.setTimeout(() => {
          loader.classList.add("is-revealing");
          window.setTimeout(() => {
            loader.classList.add("is-hidden");
            loader.setAttribute("aria-busy", "false");
            loader.setAttribute("aria-hidden", "true");
            site.inert = false;
            document.documentElement.classList.remove("central-is-loading");
          }, reduced ? 160 : 1525);
        }, reduced ? 80 : 680);
      }));
    }, Math.max(260, 980 - (Date.now() - started)));
  }
  window.CentralLoader = {finish, fail};
})();
