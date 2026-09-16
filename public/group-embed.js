import {mountGroupDirectory} from "./group-directory.js";

// An embed owns its theme; it never changes the host site's theme or storage.
export function followGroupEmbedTheme(root, theme, media = window.matchMedia(
    "(prefers-color-scheme: dark)",
)) {
  const update = () => {
    root.dataset.theme = theme === "dark" ||
      (theme === "responsive" && media.matches) ? "dark" : "light";
  };
  update();
  if (theme !== "responsive") return () => {};
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

function loadStyles(shadow, origin) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = origin + "/group-directory.css";
    const timeout = window.setTimeout(() => finish(false), 20000);
    const finish = (loaded) => {
      window.clearTimeout(timeout);
      if (loaded) resolve();
      else reject(new Error("Groups styles unavailable."));
    };
    link.addEventListener("load", () => finish(true), {once: true});
    link.addEventListener("error", () => finish(false), {once: true});
    shadow.append(link);
  });
}

const fontOrigins = new Set();

function ensureFonts(origin) {
  if (fontOrigins.has(origin) || typeof FontFace !== "function" || !document.fonts) return;
  fontOrigins.add(origin);
  // Unique family names cannot restyle existing host text. Font files and
  // licenses are served by Central, with system fallbacks if loading is blocked.
  [
    ["Central Groups Body", "google-sans-flex-v22-latin-wght-400-800.woff2", "400 800"],
    ["Central Groups Heading", "league-spartan-v15-latin-wght-600-800.woff2", "600 800"],
  ].forEach(([family, file, weight]) => {
    const face = new FontFace(family, `url("${origin}/fonts/groups/${file}")`, {
      weight, style: "normal", display: "swap",
    });
    document.fonts.add(face);
    face.load().catch(() => {});
  });
}

export async function mountGroupEmbed(host, {origin, theme = "light"}) {
  // Shadow DOM isolates both directions: site CSS cannot restyle the directory,
  // and directory styles do not change the surrounding website.
  const shadow = host.shadowRoot || host.attachShadow({mode: "open"});
  shadow.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading groups…";
  loading.setAttribute("role", "status");
  shadow.append(loading);
  const root = document.createElement("section");
  root.setAttribute("data-group-directory", "");
  root.setAttribute("data-group-embedded", "");
  root.setAttribute("aria-label", "Explore CrossPointe groups");
  const stopTheme = followGroupEmbedTheme(root, theme);
  ensureFonts(origin);
  try {
    await loadStyles(shadow, origin);
    loading.remove();
    shadow.append(root);
    const directory = await mountGroupDirectory(root, {
      endpoint: origin + "/api/groups",
      fallbackUrl: "https://crosspointetv.churchcenter.com/groups",
    });
    let destroyed = false;
    const observer = new MutationObserver(() => {
      if (!host.isConnected) destroy();
    });
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      stopTheme();
      directory.destroy();
      shadow.replaceChildren();
    }
    observer.observe(document.documentElement, {childList: true, subtree: true});
    if (!host.isConnected) destroy();
    return {destroy};
  } catch (error) {
    stopTheme();
    throw error;
  }
}
