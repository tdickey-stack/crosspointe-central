const NOTES_KEY_PREFIX = "navlab-sermon-notes-";
const PRODUCTION_NOTES_KEY_PREFIX = "central-sermon-notes-";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_SCRIPT_ID = "lab-study-google-gsi";
const YOUVERSION_STYLE_ID = "lab-study-youversion-styles";
const SAFE_NOTE_ELEMENTS = new Set([
  "B", "BR", "DIV", "EM", "I", "LI", "OL", "P", "STRONG", "UL",
]);
const DROP_NOTE_ELEMENTS = new Set([
  "EMBED", "IFRAME", "MATH", "OBJECT", "SCRIPT", "STYLE", "SVG", "TEMPLATE",
]);

const text = (value) => String(value == null ? "" : value).trim();

function enabled(value, fallback = true) {
  if (value === true || value === false) return value;
  if (value == null || text(value) === "") return fallback;
  return ["true", "1", "yes", "on"].includes(text(value).toLowerCase());
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

export function getSundayNotesStorageKey(sunday) {
  return NOTES_KEY_PREFIX + text(sunday && sunday.date || "default");
}

export function getProductionSundayNotesStorageKey(sunday) {
  return PRODUCTION_NOTES_KEY_PREFIX + text(sunday && sunday.date || "default");
}

export function getSundayStudyConfig(data = {}) {
  const sunday = data.sunday || {};
  const settings = data.sundaySettings || {};
  const reference = text(settings.sunday_scripture_reference || sunday.scripture);
  const googleEnabledValue = Object.prototype.hasOwnProperty.call(data, "googleDocsEnabled") ?
    data.googleDocsEnabled :
    Object.prototype.hasOwnProperty.call(data, "google_docs_enabled") ?
      data.google_docs_enabled :
      Object.prototype.hasOwnProperty.call(settings, "googleDocsEnabled") ?
        settings.googleDocsEnabled : settings.google_docs_enabled;

  return {
    sunday,
    reference,
    bible: {
      appKey: text(data.youVersionAppKey),
      reference,
      versionId: text(settings.sunday_scripture_bible_id) || "2692",
      title: reference ? text(settings.sunday_scripture_title) || "Bible Reader" : "Browse the Bible",
      helperText: reference ?
        text(settings.sunday_scripture_helper_text) ||
          "Follow along with today’s passage and browse anywhere in Scripture beside your notes." :
        "No passage is configured for today. Browse the Bible while you take notes.",
    },
    google: {
      enabled: enabled(googleEnabledValue, true),
      clientId: text(
          data.googleWebClientId || settings.googleWebClientId || settings.google_web_client_id,
      ),
    },
  };
}

export function sanitizeSundayNotesHtml(html, documentRef = globalThis.document) {
  const source = String(html || "");
  if (!source) return "";

  // A non-browser caller cannot safely parse HTML, so preserve it as visible text.
  if (!documentRef || typeof documentRef.createElement !== "function") {
    return escapeHtml(source);
  }

  const template = documentRef.createElement("template");
  template.innerHTML = source;
  const cleanRoot = documentRef.createElement("div");

  const copySafe = (sourceNode, targetNode) => {
    Array.from(sourceNode.childNodes || []).forEach((node) => {
      if (node.nodeType === 3) {
        targetNode.appendChild(documentRef.createTextNode(node.textContent || ""));
        return;
      }
      if (node.nodeType !== 1) return;

      const tag = String(node.nodeName || "").toUpperCase();
      if (DROP_NOTE_ELEMENTS.has(tag)) return;
      if (!SAFE_NOTE_ELEMENTS.has(tag)) {
        copySafe(node, targetNode);
        return;
      }

      const cleanNode = documentRef.createElement(tag.toLowerCase());
      copySafe(node, cleanNode);
      targetNode.appendChild(cleanNode);
    });
  };

  copySafe(template.content, cleanRoot);
  return cleanRoot.innerHTML.trim();
}

function renderInlineMarkdown(value) {
  const source = String(value || "");
  let result = "";
  let plain = "";
  let bold = false;
  let italic = false;
  const flush = () => {
    if (!plain) return;
    let safe = escapeHtml(plain);
    if (italic) safe = `<em>${safe}</em>`;
    if (bold) safe = `<strong>${safe}</strong>`;
    result += safe;
    plain = "";
  };
  for (let index = 0; index < source.length;) {
    if (source.slice(index, index + 2) === "**") {
      flush(); bold = !bold; index += 2; continue;
    }
    if (source[index] === "*") {
      flush(); italic = !italic; index += 1; continue;
    }
    plain += source[index++];
  }
  flush();
  return result;
}

function legacyNotesToHtml(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length === 1 && !lines[0]) return "";
  const blocks = [];
  let listType = "";
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<${listType}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listType}>`);
    listType = "";
    listItems = [];
  };
  lines.forEach((line) => {
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const nextType = unordered ? "ul" : ordered ? "ol" : "";
    if (nextType) {
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      return;
    }
    flushList();
    blocks.push(line ? `<div>${renderInlineMarkdown(line)}</div>` : "<div><br></div>");
  });
  flushList();
  return blocks.join("");
}

export function parseStoredSundayNotes(storedValue, documentRef = globalThis.document) {
  const raw = String(storedValue || "");
  if (!raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === "rich-text-v1") {
      return sanitizeSundayNotesHtml(String(parsed.html || ""), documentRef);
    }
  } catch (_error) {
    // Older Central drafts were stored as plain text.
  }
  return legacyNotesToHtml(raw);
}

function makeElement(tagName, className, label) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (label != null) node.textContent = label;
  return node;
}

function makeButton(label, className = "") {
  const button = makeElement("button", className, label);
  button.type = "button";
  return button;
}

function plainNotesText(editor) {
  return String(editor && editor.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n");
}

function ensureYouVersionStyles() {
  if (document.getElementById(YOUVERSION_STYLE_ID) ||
      document.querySelector('link[href="/youversion-reader.css"]')) return;
  const link = document.createElement("link");
  link.id = YOUVERSION_STYLE_ID;
  link.rel = "stylesheet";
  link.href = "/youversion-reader.css";
  document.head.append(link);
}

let googleIdentityPromise;
function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (googleIdentityPromise) return googleIdentityPromise;
  googleIdentityPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_SCRIPT_ID) ||
      document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const ready = () => {
      let tries = 0;
      const check = () => {
        if (window.google?.accounts?.oauth2) return resolve();
        if (++tries > 40) return reject(new Error("Google Sign-In did not finish loading."));
        window.setTimeout(check, 250);
      };
      check();
    };
    if (script) return ready();
    script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", ready, {once: true});
    script.addEventListener("error", () => reject(new Error("Could not load Google Sign-In.")), {once: true});
    document.head.append(script);
  }).catch((error) => {
    googleIdentityPromise = undefined;
    throw error;
  });
  return googleIdentityPromise;
}

function parseGoogleResponse(response) {
  return response.json().catch(() => ({}));
}

async function createGoogleDoc(title, payload, accessToken) {
  const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json"},
    body: JSON.stringify({title}),
  });
  const doc = await parseGoogleResponse(createResponse);
  if (!createResponse.ok) {
    throw new Error(doc.error?.message || "Unable to create the Google Doc.");
  }
  const writeResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(doc.documentId)}:batchUpdate`,
      {
        method: "POST",
        headers: {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json"},
        body: JSON.stringify({requests: [{insertText: {location: {index: 1}, text: payload.text}}, ...payload.requests]}),
      },
  );
  const written = await parseGoogleResponse(writeResponse);
  if (!writeResponse.ok) {
    throw new Error(written.error?.message || "Unable to write notes into the Google Doc.");
  }
  return `https://docs.google.com/document/d/${doc.documentId}/edit`;
}

function runsFromNode(node, inherited = {}) {
  const runs = [];
  const walk = (current, style) => {
    if (current.nodeType === 3) {
      if (current.textContent) runs.push({text: current.textContent, ...style});
      return;
    }
    if (current.nodeType !== 1) return;
    const tag = current.nodeName;
    const next = {
      bold: style.bold || tag === "B" || tag === "STRONG",
      italic: style.italic || tag === "I" || tag === "EM",
    };
    if (tag === "BR") {
      runs.push({text: "\n", ...next});
      return;
    }
    Array.from(current.childNodes).forEach((child) => walk(child, next));
  };
  walk(node, {bold: !!inherited.bold, italic: !!inherited.italic});
  return runs.reduce((merged, run) => {
    const previous = merged.at(-1);
    if (previous && previous.bold === run.bold && previous.italic === run.italic) previous.text += run.text;
    else merged.push(run);
    return merged;
  }, []);
}

function notesBlocks(notesHtml) {
  const holder = document.createElement("div");
  holder.innerHTML = sanitizeSundayNotesHtml(notesHtml);
  const blocks = [];
  let inline = [];
  const flushInline = () => {
    if (!inline.length) return;
    const wrapper = document.createElement("div");
    inline.forEach((node) => wrapper.append(node.cloneNode(true)));
    const runs = runsFromNode(wrapper);
    if (runs.some((run) => run.text.trim())) blocks.push({type: "paragraph", runs});
    inline = [];
  };
  Array.from(holder.childNodes).forEach((node) => {
    if (node.nodeType === 1 && ["UL", "OL"].includes(node.nodeName)) {
      flushInline();
      const items = Array.from(node.children)
          .filter((child) => child.nodeName === "LI")
          .map((child) => runsFromNode(child))
          .filter((runs) => runs.some((run) => run.text.trim()));
      if (items.length) blocks.push({type: node.nodeName.toLowerCase(), items});
    } else if (node.nodeType === 1 && ["DIV", "P"].includes(node.nodeName)) {
      flushInline();
      const runs = runsFromNode(node);
      if (runs.some((run) => run.text.trim())) blocks.push({type: "paragraph", runs});
    } else if (!(node.nodeType === 3 && !String(node.textContent || "").trim())) {
      inline.push(node);
    }
  });
  flushInline();
  return blocks;
}

function buildGoogleDocPayload(data, notesHtml) {
  const sunday = data.sunday || {};
  const settings = data.settings || {};
  const state = {text: "", cursor: 1, styles: [], lists: []};
  const style = (start, end, run) => {
    const textStyle = {};
    const fields = [];
    if (run.bold) { textStyle.bold = true; fields.push("bold"); }
    if (run.italic) { textStyle.italic = true; fields.push("italic"); }
    if (fields.length && end > start) {
      state.styles.push({updateTextStyle: {range: {startIndex: start, endIndex: end}, textStyle, fields: fields.join(",")}});
    }
  };
  const line = (value, run = {}) => {
    const content = String(value || "");
    const start = state.cursor;
    state.text += content + "\n";
    state.cursor += content.length + 1;
    style(start, start + content.length, run);
  };
  const labelLine = (label, value) => {
    const start = state.cursor;
    line(label + value);
    style(start, start + label.length, {bold: true});
  };
  const appendRuns = (runs, suffix = "") => {
    let cursor = state.cursor;
    runs.forEach((run) => {
      state.text += run.text;
      style(cursor, cursor + run.text.length, run);
      cursor += run.text.length;
    });
    state.text += suffix;
    state.cursor = cursor + suffix.length;
  };

  line(text(settings.site_title) || "CrossPointe Central", {bold: true});
  line("");
  line("Sunday Notes", {bold: true});
  if (sunday.date) labelLine("Date: ", sunday.date);
  if (sunday.sermon_title) labelLine("Sermon: ", sunday.sermon_title);
  if (sunday.speaker) labelLine("Speaker: ", sunday.speaker);
  if (sunday.scripture) labelLine("Scripture: ", sunday.scripture);
  line("");

  const blocks = notesBlocks(notesHtml);
  blocks.forEach((block, index) => {
    if (block.type === "paragraph") appendRuns(block.runs, "\n");
    else {
      const start = state.cursor;
      block.items.forEach((runs) => appendRuns(runs, "\n"));
      state.lists.push({createParagraphBullets: {
        range: {startIndex: start, endIndex: state.cursor},
        bulletPreset: block.type === "ol" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DISC_CIRCLE_SQUARE",
      }});
    }
    if (index < blocks.length - 1) line("");
  });
  return {text: state.text, requests: [...state.styles, ...state.lists]};
}

export function mountSundayStudy(root, {data = {}, theme = "light"} = {}) {
  if (!root || typeof root.replaceChildren !== "function") {
    throw new TypeError("mountSundayStudy requires a DOM root element.");
  }

  const config = getSundayStudyConfig(data);
  const storageKey = getSundayNotesStorageKey(config.sunday);
  const productionStorageKey = getProductionSundayNotesStorageKey(config.sunday);
  const cleanups = [];
  let destroyed = false;
  let activePanel = "notes";
  let bibleCleanup = null;
  let bibleRequest = 0;
  let currentTheme = theme === "dark" ? "dark" : "light";
  let statusTimer = 0;
  let accessToken = "";
  let tokenExpiresAt = 0;

  const shell = makeElement("div", "lab-study");
  shell.dataset.theme = currentTheme;
  const switcher = makeElement("div", "lab-study-switcher");
  switcher.setAttribute("role", "tablist");
  switcher.setAttribute("aria-label", "Study view");
  const notesTab = makeButton("Notes", "lab-study-switch");
  const bibleTab = makeButton("Bible", "lab-study-switch");
  notesTab.setAttribute("role", "tab");
  bibleTab.setAttribute("role", "tab");
  notesTab.id = "lab-study-notes-tab";
  bibleTab.id = "lab-study-bible-tab";
  switcher.append(notesTab, bibleTab);

  const workspace = makeElement("div", "lab-study-workspace");
  const notesPanel = makeElement("article", "lab-study-panel lab-study-notes");
  const biblePanel = makeElement("article", "lab-study-panel lab-study-bible");
  notesPanel.id = "lab-study-notes-panel";
  biblePanel.id = "lab-study-bible-panel";
  notesPanel.setAttribute("role", "tabpanel");
  biblePanel.setAttribute("role", "tabpanel");
  notesPanel.setAttribute("aria-labelledby", notesTab.id);
  biblePanel.setAttribute("aria-labelledby", bibleTab.id);
  notesTab.setAttribute("aria-controls", notesPanel.id);
  bibleTab.setAttribute("aria-controls", biblePanel.id);

  const notesHead = makeElement("div", "lab-study-panel-head");
  const notesHeadCopy = makeElement("div");
  notesHeadCopy.append(
      makeElement("p", "lab-study-kicker", "Sermon notes"),
      makeElement("h2", "lab-study-title", text(config.sunday.sermon_title) || "Take notes as you listen"),
  );
  notesHead.append(notesHeadCopy);
  if (text(config.sunday.scripture)) notesHead.append(makeElement("span", "lab-study-reference", config.sunday.scripture));

  const toolbar = makeElement("div", "lab-study-toolbar");
  toolbar.setAttribute("aria-label", "Notes formatting");
  const formats = [
    ["bold", "Bold", "Bold"],
    ["italic", "Italic", "Italic"],
    ["insertUnorderedList", "Bulleted list", "Bullets"],
    ["insertOrderedList", "Numbered list", "Numbered"],
  ];
  const formatButtons = formats.map(([command, label, visible]) => {
    const button = makeButton(visible, "lab-study-format");
    button.dataset.command = command;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("mousedown", (event) => event.preventDefault());
    toolbar.append(button);
    return button;
  });

  const editor = makeElement("div", "lab-study-editor");
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", "Sermon notes");
  editor.setAttribute("aria-multiline", "true");
  editor.dataset.placeholder = "Write notes, verses, prayer points, and action steps here…";

  const tools = makeElement("div", "lab-study-tools");
  const copyButton = makeButton("Copy", "lab-study-tool");
  const clearButton = makeButton("Clear", "lab-study-tool lab-study-clear");
  const saveButton = makeButton("Save to My Google Docs", "lab-study-tool lab-study-google");
  const openDoc = makeElement("a", "lab-study-tool lab-study-open-doc", "Open My Google Doc");
  openDoc.target = "_blank";
  openDoc.rel = "noopener";
  openDoc.hidden = true;
  const status = makeElement("span", "lab-study-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  if (config.google.enabled && config.google.clientId) tools.append(saveButton, openDoc);
  tools.append(copyButton, clearButton, status);
  notesPanel.append(notesHead, toolbar, editor, tools);

  const bibleHead = makeElement("div", "lab-study-panel-head");
  const bibleHeadCopy = makeElement("div");
  bibleHeadCopy.append(
      makeElement("p", "lab-study-kicker", "Powered by YouVersion"),
      makeElement("h2", "lab-study-title", config.bible.title),
  );
  bibleHead.append(bibleHeadCopy);
  if (config.reference) bibleHead.append(makeElement("span", "lab-study-reference", config.reference));
  const bibleMount = makeElement("div", "lab-study-bible-mount");
  biblePanel.append(bibleHead, bibleMount);
  workspace.append(notesPanel, biblePanel);
  shell.append(switcher, workspace);
  root.replaceChildren(shell);

  const mobile = window.matchMedia("(max-width: 760px)");
  let storageFallback = "Ready to save on this device";
  const setStatus = (message, persistent = false) => {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    if (!persistent && message !== "Saved on this device") {
      statusTimer = window.setTimeout(() => { status.textContent = storageFallback; }, 1600);
    }
  };

  try {
    let stored = window.localStorage.getItem(storageKey);
    const importedFromProduction = stored === null;
    if (importedFromProduction) {
      stored = window.localStorage.getItem(productionStorageKey);
    }
    editor.innerHTML = parseStoredSundayNotes(stored);
    if (importedFromProduction && stored !== null) {
      const safeHtml = sanitizeSundayNotesHtml(editor.innerHTML);
      window.localStorage.setItem(storageKey, JSON.stringify({type: "rich-text-v1", html: safeHtml}));
      storageFallback = "Saved in this Navigation Lab preview";
    } else {
      storageFallback = plainNotesText(editor).trim() ?
        "Saved in this Navigation Lab preview" : "Ready to save in this preview";
    }
    setStatus(storageFallback, true);
  } catch (_error) {
    storageFallback = "Saving on this device is unavailable. Keep this page open.";
    setStatus(storageFallback, true);
  }

  const saveDraft = () => {
    const safeHtml = sanitizeSundayNotesHtml(editor.innerHTML);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({type: "rich-text-v1", html: safeHtml}));
      storageFallback = "Saved in this Navigation Lab preview";
      setStatus("Saved just now");
    } catch (_error) {
      storageFallback = "Could not save on this device. Keep this page open.";
      setStatus(storageFallback, true);
    }
  };

  const updateToolbar = () => {
    const selection = window.getSelection?.();
    const inside = !!selection?.rangeCount && editor.contains(selection.anchorNode);
    formatButtons.forEach((button) => {
      let active = false;
      try { active = inside && !!document.queryCommandState?.(button.dataset.command); } catch (_error) {}
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const initBible = async () => {
    if (destroyed || bibleCleanup) return;
    const request = ++bibleRequest;
    bibleMount.replaceChildren();
    const loading = makeElement("div", "lab-study-loading", "Loading Bible reader…");
    bibleMount.append(loading);
    ensureYouVersionStyles();
    try {
      const module = await import("/youversion-reader.js");
      if (destroyed || request !== bibleRequest || !bibleMount.isConnected) return;
      bibleCleanup = module.mountYouVersionReader(bibleMount, {...config.bible, theme: currentTheme});
    } catch (_error) {
      if (destroyed || request !== bibleRequest || !bibleMount.isConnected) return;
      const errorMessage = makeElement(
          "p",
          "lab-study-reader-error",
          "The Bible reader could not load right now. Please try again in a moment.",
      );
      const retryButton = makeButton("Retry Bible reader", "lab-study-tool");
      retryButton.addEventListener("click", initBible, {once: true});
      errorMessage.append(retryButton);
      bibleMount.replaceChildren(errorMessage);
    }
  };

  const showPanel = (next) => {
    activePanel = next === "bible" ? "bible" : "notes";
    const isMobile = mobile.matches;
    notesPanel.hidden = isMobile && activePanel !== "notes";
    biblePanel.hidden = isMobile && activePanel !== "bible";
    notesTab.setAttribute("aria-selected", String(activePanel === "notes"));
    bibleTab.setAttribute("aria-selected", String(activePanel === "bible"));
    notesTab.tabIndex = activePanel === "notes" ? 0 : -1;
    bibleTab.tabIndex = activePanel === "bible" ? 0 : -1;
    if (!isMobile || activePanel === "bible") initBible();
  };

  const onMediaChange = () => showPanel(activePanel);
  mobile.addEventListener?.("change", onMediaChange);
  cleanups.push(() => mobile.removeEventListener?.("change", onMediaChange));
  notesTab.addEventListener("click", () => showPanel("notes"));
  bibleTab.addEventListener("click", () => showPanel("bible"));
  [notesTab, bibleTab].forEach((tab, index, tabs) => {
    tab.addEventListener("keydown", (event) => {
      let nextIndex = -1;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex < 0) return;
      event.preventDefault();
      const nextTab = tabs[nextIndex];
      showPanel(nextTab === bibleTab ? "bible" : "notes");
      nextTab.focus();
    });
  });
  editor.addEventListener("input", saveDraft);
  editor.addEventListener("keyup", updateToolbar);
  editor.addEventListener("mouseup", updateToolbar);
  editor.addEventListener("focus", updateToolbar);
  editor.addEventListener("blur", () => window.setTimeout(updateToolbar, 0));
  const onSelectionChange = () => {
    if (root.isConnected) updateToolbar();
  };
  document.addEventListener("selectionchange", onSelectionChange);
  cleanups.push(() => document.removeEventListener("selectionchange", onSelectionChange));

  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text/plain") || "";
    if (!document.execCommand?.("insertText", false, pasted)) {
      const selection = window.getSelection?.();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(pasted));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    saveDraft();
  });
  formatButtons.forEach((button) => button.addEventListener("click", () => {
    editor.focus();
    document.execCommand?.("styleWithCSS", false, false);
    document.execCommand?.(button.dataset.command, false, null);
    saveDraft();
    window.setTimeout(updateToolbar, 0);
  }));

  copyButton.addEventListener("click", async () => {
    const plain = plainNotesText(editor);
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([plain], {type: "text/plain"}),
          "text/html": new Blob([sanitizeSundayNotesHtml(editor.innerHTML)], {type: "text/html"}),
        })]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plain);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand?.("copy")) throw new Error("Copy unavailable");
      }
      setStatus("Copied to clipboard");
    } catch (_error) {
      setStatus("Could not copy these notes. Select the text and copy it manually.", true);
    }
  });

  clearButton.addEventListener("click", () => {
    if (!window.confirm("Clear your sermon notes in this Navigation Lab preview?")) return;
    editor.replaceChildren();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({type: "rich-text-v1", html: ""}));
      storageFallback = "Ready to save in this preview";
      setStatus("Notes cleared", true);
    } catch (_error) {
      storageFallback = "Could not save this change. Keep this page open.";
      setStatus("Notes cleared here, but the preview draft could not be updated.", true);
    }
  });

  const requestToken = async () => {
    if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
    await loadGoogleIdentity();
    return new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: config.google.clientId,
        scope: GOOGLE_SCOPE,
        callback(response) {
          if (response?.error || !response?.access_token) {
            reject(new Error(response?.error_description || response?.error || "Google Sign-In did not return access."));
            return;
          }
          accessToken = response.access_token;
          tokenExpiresAt = Date.now() + Math.max(Number(response.expires_in || 0) - 60, 0) * 1000;
          resolve(accessToken);
        },
        error_callback(error) {
          if (error?.type === "popup_failed_to_open") reject(new Error("Google Sign-In popup was blocked. Allow pop-ups, then try again."));
          else if (error?.type === "popup_closed") reject(new Error("Google Sign-In was closed before it finished."));
          else reject(new Error("Google Sign-In could not finish."));
        },
      });
      tokenClient.requestAccessToken({prompt: accessToken ? "" : "consent"});
    });
  };

  saveButton.addEventListener("click", async () => {
    const notes = plainNotesText(editor).trim();
    if (!notes) {
      setStatus("Add a few notes first, then save to Google Docs.", true);
      return;
    }
    saveButton.disabled = true;
    saveButton.textContent = "Connecting to Google…";
    setStatus("Waiting for Google Sign-In…", true);
    try {
      const token = await requestToken();
      saveButton.textContent = "Saving to Google Docs…";
      setStatus("Creating your Google Doc…", true);
      const sermonTitle = text(config.sunday.sermon_title) || "Sunday Notes";
      const title = config.sunday.date ?
        `CrossPointe Notes - ${sermonTitle} - ${config.sunday.date}` :
        `CrossPointe Notes - ${sermonTitle}`;
      const url = await createGoogleDoc(title, buildGoogleDocPayload(data, editor.innerHTML), token);
      openDoc.href = url;
      openDoc.hidden = false;
      setStatus("Saved to your Google Drive.", true);
    } catch (error) {
      setStatus(error?.message || "Could not save notes to Google Docs.", true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save to My Google Docs";
    }
  });

  showPanel("notes");

  return {
    setTheme(nextTheme) {
      const normalized = nextTheme === "dark" ? "dark" : "light";
      if (normalized === currentTheme) return;
      currentTheme = normalized;
      shell.dataset.theme = currentTheme;
      if (bibleCleanup) {
        bibleCleanup();
        bibleCleanup = null;
        initBible();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      bibleRequest++;
      window.clearTimeout(statusTimer);
      bibleCleanup?.();
      bibleCleanup = null;
      cleanups.forEach((cleanup) => cleanup());
      root.replaceChildren();
    },
  };
}
