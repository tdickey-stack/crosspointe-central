const RESI_ORIGIN = "https://control.resi.io";
const HOME_VIEW = "home";
const MINI_EDGE = 12;
const MINI_MIN_WIDTH = 160;
const MINI_MAX_WIDTH = 480;
const CONNECT_ATTEMPTS = 6;

const text = (value) => String(value ?? "").trim();

function safeStreamUrl(value, baseUrl) {
  try {
    const url = new URL(text(value), baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function button(document, className, label) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

function toggleClass(element, name, enabled) {
  element.classList.toggle(name, Boolean(enabled));
}

/**
 * Owns one body-level livestream iframe whose DOM identity survives all view,
 * Sunday-mode, theme, and inline/mini transitions.
 */
export function createSundayPlayer({host, onReturn} = {}) {
  if (!host || !host.ownerDocument || typeof host.append !== "function") {
    throw new TypeError("createSundayPlayer requires a DOM host element");
  }

  const document = host.ownerDocument;
  const window = document.defaultView || globalThis.window;
  const root = document.createElement("section");
  const frame = document.createElement("div");
  const controls = document.createElement("div");
  const dragHandle = button(document, "lab-player__drag", "Move player");
  const playbackButton = button(document, "lab-player__control lab-player__playback", "…");
  const minimizeButton = button(document, "lab-player__control lab-player__minimize", "Keep Watching");
  const returnButton = button(document, "lab-player__control lab-player__return", "Return");
  const closeButton = button(document, "lab-player__control lab-player__close", "×");
  const resizeHandle = button(document, "lab-player__resize", "Resize player");

  root.className = "lab-player";
  root.hidden = true;
  root.setAttribute("aria-label", "CrossPointe livestream");
  frame.className = "lab-player__frame";
  controls.className = "lab-player__controls";
  playbackButton.disabled = true;
  playbackButton.dataset.playbackState = "connecting";
  playbackButton.setAttribute("aria-label", "Connecting to livestream controls");
  minimizeButton.setAttribute("aria-label", "Keep watching in the mini player");
  returnButton.setAttribute("aria-label", "Return to the livestream on Home");
  closeButton.setAttribute("aria-label", "Close player and stop the livestream");
  resizeHandle.setAttribute("aria-label", "Resize mini player");
  resizeHandle.setAttribute("title", "Use left and right arrow keys to resize");
  dragHandle.setAttribute("aria-label", "Move mini player");
  dragHandle.setAttribute("title", "Drag, or use arrow keys, to move the mini player");
  controls.append(playbackButton, minimizeButton, returnButton, closeButton);
  root.append(frame, dragHandle, controls, resizeHandle);
  host.append(root);

  let configuredUrl = "";
  let activeUrl = "";
  let iframe = null;
  let anchor = null;
  let anchorObserver = null;
  let viewId = HOME_VIEW;
  let sundayMode = false;
  let userMinimized = false;
  let destroyed = false;
  let layoutFrame = 0;
  let miniWidth = 0;
  let miniPosition = null;
  let pointerOperation = null;
  let playbackOrigin = "";
  let playbackConnected = false;
  let playbackKnown = false;
  let playbackPaused = false;
  let connectAttempts = 0;
  let connectTimer = 0;

  function currentViewport() {
    const visual = window.visualViewport;
    return visual ? {
      left: Number(visual.offsetLeft) || 0,
      top: Number(visual.offsetTop) || 0,
      width: Number(visual.width) || window.innerWidth || 0,
      height: Number(visual.height) || window.innerHeight || 0,
    } : {
      left: 0,
      top: 0,
      width: window.innerWidth || document.documentElement.clientWidth || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0,
    };
  }

  function miniBounds(width = miniWidth || defaultMiniWidth()) {
    const viewport = currentViewport();
    let bottom = viewport.top + viewport.height - MINI_EDGE;
    const navigation = document.querySelector(".navigation");
    if (navigation && typeof navigation.getBoundingClientRect === "function") {
      const rect = navigation.getBoundingClientRect();
      if (rect.top > viewport.top + viewport.height * 0.45 && rect.top < bottom) {
        bottom = rect.top - MINI_EDGE;
      }
    }
    const height = width * 9 / 16;
    return {
      minLeft: viewport.left + MINI_EDGE,
      maxLeft: Math.max(viewport.left + MINI_EDGE, viewport.left + viewport.width - width - MINI_EDGE),
      minTop: viewport.top + MINI_EDGE,
      maxTop: Math.max(viewport.top + MINI_EDGE, bottom - height),
      width,
      height,
    };
  }

  function defaultMiniWidth() {
    const viewport = currentViewport();
    const desired = viewport.width <= 760 ? 240 : 360;
    return Math.max(MINI_MIN_WIDTH, Math.min(desired, MINI_MAX_WIDTH, viewport.width - MINI_EDGE * 2));
  }

  function clampMiniWidth(value) {
    const viewport = currentViewport();
    const maximum = Math.max(MINI_MIN_WIDTH, Math.min(MINI_MAX_WIDTH, viewport.width - MINI_EDGE * 2));
    return Math.max(MINI_MIN_WIDTH, Math.min(maximum, Math.round(Number(value) || defaultMiniWidth())));
  }

  function applyMiniGeometry() {
    miniWidth = clampMiniWidth(miniWidth || defaultMiniWidth());
    const bounds = miniBounds(miniWidth);
    if (!miniPosition) {
      miniPosition = {left: bounds.maxLeft, top: bounds.maxTop};
    }
    miniPosition.left = Math.max(bounds.minLeft, Math.min(bounds.maxLeft, miniPosition.left));
    miniPosition.top = Math.max(bounds.minTop, Math.min(bounds.maxTop, miniPosition.top));
    root.style.left = `${Math.round(miniPosition.left)}px`;
    root.style.top = `${Math.round(miniPosition.top)}px`;
    root.style.width = `${Math.round(bounds.width)}px`;
    // Preserve the exact 16:9 height. Rounding leaves a subpixel letterbox
    // inside the embed that can show as a bright hairline at its top edge.
    root.style.height = `${bounds.height}px`;
  }

  function visibleContentBounds() {
    const viewport = currentViewport();
    const bounds = {
      left: viewport.left,
      top: viewport.top,
      right: viewport.left + viewport.width,
      bottom: viewport.top + viewport.height,
    };
    const main = document.querySelector(".main");
    if (main && typeof main.getBoundingClientRect === "function") {
      const rect = main.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        bounds.left = Math.max(bounds.left, rect.left);
        bounds.top = Math.max(bounds.top, rect.top);
        bounds.right = Math.min(bounds.right, rect.right);
        bounds.bottom = Math.min(bounds.bottom, rect.bottom);
      }
    }
    const header = document.querySelector(".site-header");
    if (header && typeof header.getBoundingClientRect === "function") {
      const rect = header.getBoundingClientRect();
      if (rect.bottom > bounds.top && rect.top <= bounds.top + 1) {
        bounds.top = Math.min(bounds.bottom, rect.bottom);
      }
    }
    const navigation = document.querySelector(".navigation");
    if (navigation && typeof navigation.getBoundingClientRect === "function") {
      const rect = navigation.getBoundingClientRect();
      if (rect.top > bounds.top + (bounds.bottom - bounds.top) * 0.45 && rect.top < bounds.bottom) {
        bounds.bottom = rect.top;
      }
    }
    return bounds;
  }

  function inlineAnchorRect() {
    if (!sundayMode || viewId !== HOME_VIEW || userMinimized || !anchor ||
      anchor.isConnected === false || typeof anchor.getBoundingClientRect !== "function") return null;
    const rect = anchor.getBoundingClientRect();
    const bounds = visibleContentBounds();
    const tolerance = 1;
    if (rect.width <= 0 || rect.height <= 0 ||
      rect.left < bounds.left - tolerance || rect.top < bounds.top - tolerance ||
      rect.right > bounds.right + tolerance || rect.bottom > bounds.bottom + tolerance) return null;
    return rect;
  }

  function applyInlineGeometry(rect) {
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
  }

  function syncLayout() {
    layoutFrame = 0;
    if (!iframe || destroyed) return;
    const inlineRect = inlineAnchorRect();
    const inline = Boolean(inlineRect);
    toggleClass(root, "lab-player--inline", inline);
    toggleClass(root, "lab-player--mini", !inline);
    root.dataset.mode = inline ? "inline" : "mini";
    if (inline) applyInlineGeometry(inlineRect);
    else applyMiniGeometry();
  }

  function scheduleLayout() {
    if (!iframe || destroyed || layoutFrame) return;
    if (typeof window.requestAnimationFrame === "function") {
      layoutFrame = window.requestAnimationFrame(syncLayout);
    } else {
      syncLayout();
    }
  }

  function clearConnectTimer() {
    if (!connectTimer) return;
    window.clearTimeout(connectTimer);
    connectTimer = 0;
  }

  function updatePlaybackButton() {
    if (!playbackOrigin) {
      playbackButton.disabled = true;
      playbackButton.dataset.playbackState = "unavailable";
      playbackButton.textContent = "—";
      playbackButton.setAttribute("aria-label", "Playback controls unavailable");
      playbackButton.title = "Playback controls unavailable";
      return;
    }
    if (!playbackConnected || !playbackKnown) {
      playbackButton.disabled = true;
      playbackButton.dataset.playbackState = "connecting";
      playbackButton.textContent = "…";
      playbackButton.setAttribute("aria-label", "Connecting to livestream controls");
      playbackButton.title = "Connecting to livestream controls";
      return;
    }
    playbackButton.disabled = false;
    playbackButton.dataset.playbackState = playbackPaused ? "paused" : "playing";
    playbackButton.textContent = playbackPaused ? "▶" : "Ⅱ";
    playbackButton.setAttribute("aria-label", `${playbackPaused ? "Play" : "Pause"} livestream`);
    playbackButton.title = playbackPaused ? "Play" : "Pause";
  }

  function sendConnect() {
    if (!iframe || !iframe.contentWindow || !playbackOrigin || playbackConnected) return;
    connectAttempts += 1;
    iframe.contentWindow.postMessage({
      kind: "player-connect",
      origin: window.location.origin,
      values: ["playing", "paused"],
      throttleTime: 100,
    }, playbackOrigin);
    if (connectAttempts < CONNECT_ATTEMPTS) {
      connectTimer = window.setTimeout(sendConnect, 500);
    }
  }

  function handleIframeLoad() {
    clearConnectTimer();
    playbackOrigin = "";
    playbackConnected = false;
    playbackKnown = false;
    connectAttempts = 0;
    try {
      const url = new URL(activeUrl);
      if (url.origin === RESI_ORIGIN) playbackOrigin = url.origin;
    } catch {
      playbackOrigin = "";
    }
    updatePlaybackButton();
    if (playbackOrigin) sendConnect();
  }

  function applyPlaybackSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (typeof snapshot.paused === "boolean") playbackPaused = snapshot.paused;
    else if (typeof snapshot.playing === "boolean") playbackPaused = !snapshot.playing;
    else return;
    playbackConnected = true;
    playbackKnown = true;
    updatePlaybackButton();
  }

  function handlePlaybackMessage(event) {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== playbackOrigin ||
      !event.data || typeof event.data !== "object") return;
    if (event.data.kind === "player-ready") {
      playbackConnected = true;
      clearConnectTimer();
      updatePlaybackButton();
      return;
    }
    if (["init-state", "paused", "playing"].includes(event.data.name)) {
      applyPlaybackSnapshot(event.data.value);
    } else if (event.data.name === "getSnapshotResult") {
      applyPlaybackSnapshot(event.data.body);
    } else if (event.data.name === "play-result" && event.data.ok === false) {
      playbackPaused = true;
      playbackKnown = true;
      updatePlaybackButton();
    }
  }

  function stopPlaybackBridge() {
    clearConnectTimer();
    window.removeEventListener("message", handlePlaybackMessage);
    if (iframe) iframe.removeEventListener("load", handleIframeLoad);
    playbackOrigin = "";
    playbackConnected = false;
    playbackKnown = false;
  }

  function close() {
    if (!iframe) return;
    stopPointerOperation();
    stopPlaybackBridge();
    iframe.remove();
    iframe = null;
    activeUrl = "";
    root.hidden = true;
    root.removeAttribute("data-mode");
    root.classList.remove("lab-player--inline", "lab-player--mini");
    userMinimized = false;
    miniPosition = null;
  }

  function togglePlayback(event) {
    event?.preventDefault();
    if (!iframe?.contentWindow || !playbackOrigin || !playbackConnected || !playbackKnown) return;
    const previous = playbackPaused;
    const command = playbackPaused ? "play" : "pause";
    playbackPaused = !playbackPaused;
    updatePlaybackButton();
    try {
      iframe.contentWindow.postMessage({name: command, args: []}, playbackOrigin);
    } catch {
      playbackPaused = previous;
      updatePlaybackButton();
    }
  }

  function startPointerOperation(event, type) {
    if (!root.classList.contains("lab-player--mini")) return;
    event.preventDefault();
    const bounds = miniBounds(miniWidth || defaultMiniWidth());
    pointerOperation = {
      type,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: miniPosition?.left ?? bounds.maxLeft,
      top: miniPosition?.top ?? bounds.maxTop,
      width: miniWidth || bounds.width,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPointerOperation);
    window.addEventListener("pointercancel", stopPointerOperation);
  }

  function handlePointerMove(event) {
    if (!pointerOperation || event.pointerId !== pointerOperation.id) return;
    event.preventDefault();
    if (pointerOperation.type === "move") {
      miniPosition = {
        left: pointerOperation.left + event.clientX - pointerOperation.startX,
        top: pointerOperation.top + event.clientY - pointerOperation.startY,
      };
    } else {
      const right = pointerOperation.left + pointerOperation.width;
      miniWidth = clampMiniWidth(pointerOperation.width + pointerOperation.startX - event.clientX);
      miniPosition = {left: right - miniWidth, top: pointerOperation.top};
    }
    applyMiniGeometry();
  }

  function stopPointerOperation(event) {
    if (event?.pointerId != null && pointerOperation && event.pointerId !== pointerOperation.id) return;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopPointerOperation);
    window.removeEventListener("pointercancel", stopPointerOperation);
    pointerOperation = null;
  }

  function moveFromKeyboard(event) {
    const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (!directions[event.key] || !root.classList.contains("lab-player--mini")) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 12;
    const bounds = miniBounds(miniWidth || defaultMiniWidth());
    const position = miniPosition || {left: bounds.maxLeft, top: bounds.maxTop};
    miniPosition = {
      left: position.left + directions[event.key][0] * step,
      top: position.top + directions[event.key][1] * step,
    };
    applyMiniGeometry();
  }

  function resizeFromKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !root.classList.contains("lab-player--mini")) return;
    event.preventDefault();
    const bounds = miniBounds(miniWidth || defaultMiniWidth());
    const position = miniPosition || {left: bounds.maxLeft, top: bounds.maxTop};
    const right = position.left + (miniWidth || bounds.width);
    miniWidth = clampMiniWidth((miniWidth || bounds.width) + (event.key === "ArrowLeft" ? 20 : -20));
    miniPosition = {left: right - miniWidth, top: position.top};
    applyMiniGeometry();
  }

  function setObservedAnchor(nextAnchor) {
    anchorObserver?.disconnect();
    anchorObserver = null;
    anchor = nextAnchor && typeof nextAnchor.getBoundingClientRect === "function" ? nextAnchor : null;
    if (anchor && typeof window.ResizeObserver === "function") {
      anchorObserver = new window.ResizeObserver(scheduleLayout);
      anchorObserver.observe(anchor);
    }
  }

  function configure(settings = {}) {
    if (destroyed) return;
    configuredUrl = safeStreamUrl(settings.sunday_livestream_url, window.location.href);
    root.dataset.available = configuredUrl ? "true" : "false";
    const title = text(settings.sunday_livestream_title) || "CrossPointe Livestream";
    root.setAttribute("aria-label", title);
    // An active broadcast retains its exact iframe and URL. New configuration
    // applies the next time the visitor explicitly opens the player.
  }

  function setHomeAnchor(elementOrNull) {
    if (destroyed) return;
    setObservedAnchor(elementOrNull);
    scheduleLayout();
  }

  function open() {
    if (destroyed || iframe || !configuredUrl) return Boolean(iframe);
    activeUrl = configuredUrl;
    iframe = document.createElement("iframe");
    iframe.className = "lab-player__iframe";
    iframe.title = "CrossPointe Livestream";
    iframe.setAttribute("allow", "autoplay; fullscreen");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.addEventListener("load", handleIframeLoad);
    window.addEventListener("message", handlePlaybackMessage);
    frame.append(iframe);
    // Assigning src only here ensures page load/configuration cannot autoplay.
    iframe.src = activeUrl;
    // Resolve unsupported controls immediately; the load event repeats this
    // handshake once the embedded player is ready to receive messages.
    handleIframeLoad();
    root.hidden = false;
    userMinimized = false;
    miniWidth = clampMiniWidth(miniWidth || defaultMiniWidth());
    syncLayout();
    return true;
  }

  function setView(nextViewId) {
    if (destroyed) return;
    viewId = text(nextViewId);
    scheduleLayout();
  }

  function setSundayMode(enabled) {
    if (destroyed) return;
    sundayMode = Boolean(enabled);
    scheduleLayout();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (layoutFrame) window.cancelAnimationFrame?.(layoutFrame);
    layoutFrame = 0;
    close();
    setObservedAnchor(null);
    document.removeEventListener("scroll", scheduleLayout, true);
    window.removeEventListener("resize", scheduleLayout);
    window.visualViewport?.removeEventListener("resize", scheduleLayout);
    window.visualViewport?.removeEventListener("scroll", scheduleLayout);
    root.remove();
  }

  minimizeButton.addEventListener("click", () => {
    userMinimized = true;
    syncLayout();
  });
  returnButton.addEventListener("click", () => {
    userMinimized = false;
    if (typeof onReturn === "function") onReturn();
    syncLayout();
    scheduleLayout();
  });
  closeButton.addEventListener("click", close);
  playbackButton.addEventListener("click", togglePlayback);
  dragHandle.addEventListener("pointerdown", (event) => startPointerOperation(event, "move"));
  dragHandle.addEventListener("keydown", moveFromKeyboard);
  resizeHandle.addEventListener("pointerdown", (event) => startPointerOperation(event, "resize"));
  resizeHandle.addEventListener("keydown", resizeFromKeyboard);
  document.addEventListener("scroll", scheduleLayout, true);
  window.addEventListener("resize", scheduleLayout);
  window.visualViewport?.addEventListener("resize", scheduleLayout);
  window.visualViewport?.addEventListener("scroll", scheduleLayout);

  return {configure, setHomeAnchor, open, setView, setSundayMode, destroy};
}
