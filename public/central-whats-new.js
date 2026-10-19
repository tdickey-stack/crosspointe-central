/* Public release announcements. The legacy seen-version key survives the UI upgrade. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.mount(root, root.document);
})(typeof window !== "undefined" ? window : this, function() {
  const SEEN_KEY = "central-whats-new-seen-v1";
  const text = value => String(value ?? "").trim();
  const truthy = value => text(value).toLowerCase() === "true";
  function normalize(raw = {}) {
    if (!raw || !truthy(raw.active) || !text(raw.message)) return null;
    const forceShow = truthy(raw.force_show || raw.force_every_time);
    if (!forceShow && !text(raw.version)) return null;
    return {version: text(raw.version) || "Testing", forceShow,
      title: text(raw.title) || "What's New In Central",
      message: text(raw.message),
      buttonText: text(raw.button_text || raw.testing_button_text) || "Sounds Good"};
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
function renderMarkdownLite_(value) {
  var normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  var lines = normalized.split("\n");
  var html = [];
  var paragraphLines = [];
  var listLines = [];

  var flushParagraph = function() {
    if (!paragraphLines.length) return;

    html.push(
        "<p>" +
        renderMarkdownInline_(paragraphLines.join("\n")).replace(/\n/g, "<br>") +
        "</p>",
    );
    paragraphLines = [];
  };

  var flushList = function() {
    if (!listLines.length) return;
    html.push(renderMarkdownListCollectionHtml_(parseMarkdownListBlocks_(listLines)));
    listLines = [];
  };

  lines.forEach(function(rawLine) {
    var line = String(rawLine || "");
    var trimmedLine = line.trim();
    var headingMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);
    var listMatch = parseMarkdownListLine_(line);

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    if (headingMatch) {
      flushParagraph();
      flushList();
      html.push(
          "<h3 class=\"whats-new-heading level-" + headingMatch[1].length + "\">" +
          renderMarkdownInline_(headingMatch[2]) +
          "</h3>",
      );
      return;
    }

    if (listMatch) {
      flushParagraph();
      listLines.push(line);
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  return html.join("");
}

function parseMarkdownListLine_(line) {
  var match = String(line || "").match(/^([ \t]*)([-*]|\d+\.)\s+(.*)$/);
  if (!match) return null;

  return {
    indent: getMarkdownIndentWidth_(match[1]),
    type: /^\d+\.$/.test(match[2]) ? "ol" : "ul",
    text: match[3],
  };
}

function getMarkdownIndentWidth_(value) {
  return String(value || "").replace(/\t/g, "  ").length;
}

function parseMarkdownListBlocks_(lines) {
  var tokens = (lines || []).map(parseMarkdownListLine_).filter(Boolean);
  if (!tokens.length) return [];

  var index = 0;

  var parseListsAtIndent = function(expectedIndent) {
    var lists = [];
    var currentList = null;

    while (index < tokens.length) {
      var token = tokens[index];

      if (token.indent < expectedIndent) {
        break;
      }

      if (token.indent > expectedIndent) {
        if (!currentList || !currentList.items.length) {
          token.indent = expectedIndent;
        } else {
          currentList.items[currentList.items.length - 1].children =
            currentList.items[currentList.items.length - 1].children.concat(
                parseListsAtIndent(token.indent),
            );
          continue;
        }
      }

      if (!currentList || currentList.type !== token.type) {
        currentList = {
          type: token.type,
          items: [],
        };
        lists.push(currentList);
      }

      currentList.items.push({
        text: token.text,
        children: [],
      });
      index += 1;

      while (index < tokens.length && tokens[index].indent > expectedIndent) {
        currentList.items[currentList.items.length - 1].children =
          currentList.items[currentList.items.length - 1].children.concat(
              parseListsAtIndent(tokens[index].indent),
          );
      }
    }

    return lists;
  };

  return parseListsAtIndent(tokens[0].indent);
}

function renderMarkdownListCollectionHtml_(lists) {
  return (lists || []).map(function(list) {
    return "<" + list.type + ">" +
      (list.items || []).map(function(item) {
        return "<li>" +
          renderMarkdownInline_(item.text || "") +
          renderMarkdownListCollectionHtml_(item.children || []) +
          "</li>";
      }).join("") +
      "</" + list.type + ">";
  }).join("");
}

function renderMarkdownInline_(value) {
  var html = escapeHtml(value || "");

  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n][\s\S]*?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return html;
}


  function mount(win, doc) {
    if (doc.documentElement.dataset.productionShell !== "true") return;
    let pending = null;
    let modal = null;
    const shown = new Set();
    function attempt() {
      if (!pending || modal) return;
      const loader = doc.getElementById("central-loader");
      if (loader && !loader.classList.contains("is-hidden")) return;
      if (doc.querySelector("dialog[open]")) return;
      const config = pending;
      let seen = "";
      try { seen = win.localStorage.getItem(SEEN_KEY) || ""; } catch (_) {}
      if (shown.has(config.version) || (!config.forceShow && seen === config.version)) {
        pending = null;
        return;
      }
      const dialog = doc.createElement("dialog");
      dialog.id = "central-whats-new-modal";
      dialog.setAttribute("aria-labelledby", "whats-new-title");
      dialog.setAttribute("data-analytics-section", "whats_new");
      dialog.innerHTML = `<button type="button" class="whats-new-close" aria-label="Close what's new" data-whats-new-close>×</button>
        <p class="whats-new-kicker">What's New</p>
        <span class="whats-new-version">Version ${escapeHtml(config.version)}</span>
        <h2 id="whats-new-title">${escapeHtml(config.title)}</h2>
        <div class="whats-new-body">${renderMarkdownLite_(config.message)}</div>
        <div class="whats-new-actions"><button type="button" class="button primary" data-whats-new-close autofocus>${escapeHtml(config.buttonText)}</button></div>`;
      const previousFocus = doc.activeElement;
      dialog.addEventListener("click", event => {
        if (event.target.closest("[data-whats-new-close]")) { dialog.close(); return; }
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        modal = null;
        doc.documentElement.classList.remove("central-whats-new-open");
        if (previousFocus && previousFocus.isConnected && previousFocus !== doc.body) previousFocus.focus({preventScroll: true});
        else doc.querySelector('.navigation [aria-current="page"]')?.focus({preventScroll: true});
        attempt();
      });
      doc.body.appendChild(dialog);
      try { dialog.showModal(); } catch (_) {
        pending = null; // Avoid a mutation/retry loop if the browser cannot open it.
        dialog.remove();
        return;
      }
      modal = dialog;
      pending = null;
      shown.add(config.version);
      if (!config.forceShow) {
        try { win.localStorage.setItem(SEEN_KEY, config.version); } catch (_) {}
      }
      doc.documentElement.classList.add("central-whats-new-open");
      win.centralAnalyticsService?.observeSections(dialog);
    }
    win.addEventListener("central:data", event => {
      pending = normalize(event.detail?.whatsNew);
      attempt();
    });
    // The loader ends asynchronously. Also defer behind event/interest dialogs,
    // without stealing focus if refreshed release notes arrive during a task.
    new win.MutationObserver(attempt).observe(doc.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ["class", "open"],
    });
  }
  return {normalize, renderMarkdown: renderMarkdownLite_, mount};
});
