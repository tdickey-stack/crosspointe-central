(function() {
  "use strict";

  var root = document.getElementById("central-embeds-root");
  var state = {
    auth: null,
    user: null,
    loading: true,
    working: false,
    embeds: [],
    events: [],
    activeId: "",
    search: "",
    message: "",
    error: "",
    dirty: false,
    imageUploadingId: "",
    sync: null,
    createOpen: false,
    createName: "CrossPointe.tv Events",
  };

  if (!root) return;
  root.addEventListener("click", handleClick_);
  root.addEventListener("input", handleInput_);
  root.addEventListener("change", handleChange_);
  window.addEventListener("popstate", function() {
    state.activeId = getRequestedEmbedId_();
    render_();
  });
  window.addEventListener("beforeunload", function(event) {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  render_();
  Promise.resolve(window.CENTRAL_EMBEDS_FIREBASE_READY).then(function() {
    state.auth = window.firebase.auth();
    if (isLocalHost_()) {
      try {
        state.auth.useEmulator("http://127.0.0.1:9099", {
          disableWarnings: true,
        });
      } catch (error) {
      }
    }
    state.auth.onAuthStateChanged(function(user) {
      state.user = user || null;
      state.error = "";
      state.message = "";
      if (!user) {
        state.loading = false;
        state.embeds = [];
        state.events = [];
        render_();
        return;
      }
      loadWorkspace_(false);
    });
  }).catch(function(error) {
    state.loading = false;
    state.error = error && error.message ? error.message :
      "Firebase could not start Central Embeds.";
    render_();
  });

  function handleClick_(event) {
    var button = event.target.closest("[data-embeds-action]");
    if (!button) return;
    var action = button.getAttribute("data-embeds-action");
    var id = button.getAttribute("data-embed-id") || "";
    var sourceId = button.getAttribute("data-source-event-id") || "";

    if (action === "sign-in") {
      signIn_();
    } else if (action === "sign-out") {
      state.auth.signOut();
    } else if (action === "create") {
      state.createOpen = true;
      state.createName = "CrossPointe.tv Events";
      render_();
    } else if (action === "confirm-create") {
      createEmbed_();
    } else if (action === "cancel-create") {
      state.createOpen = false;
      render_();
    } else if (action === "open") {
      openEmbed_(id);
    } else if (action === "back") {
      returnToDashboard_();
    } else if (action === "save-draft") {
      saveActiveEmbed_(false);
    } else if (action === "publish") {
      saveActiveEmbed_(true);
    } else if (action === "rename") {
      renameEmbed_(id);
    } else if (action === "duplicate") {
      duplicateEmbed_(id);
    } else if (action === "delete") {
      deleteEmbed_(id);
    } else if (action === "copy-code") {
      copyEmbedCode_(id);
    } else if (action === "copy-html-url") {
      copyText_(getHtmlEndpoint_(id), "Server-renderable HTML URL copied.");
    } else if (action === "refresh-events") {
      loadWorkspace_(true);
    } else if (action === "set-layout") {
      setLayout_(button.getAttribute("data-embed-layout") || "standard");
    } else if (action === "toggle-event") {
      toggleSelectedEvent_(sourceId);
    } else if (action === "move-event") {
      moveSelectedEvent_(
          sourceId,
          button.getAttribute("data-direction") || "up",
      );
    } else if (action === "remove-event") {
      removeSelectedEvent_(sourceId);
    } else if (action === "use-source-image") {
      updateItemOverride_(sourceId, "image", null);
    }
  }

  function handleInput_(event) {
    var search = event.target.closest("[data-embeds-search]");
    if (search) {
      state.search = search.value || "";
      render_();
      var nextSearch = root.querySelector("[data-embeds-search]");
      if (nextSearch) {
        nextSearch.focus();
        nextSearch.setSelectionRange(state.search.length, state.search.length);
      }
      return;
    }

    if (event.target.hasAttribute("data-embed-create-name")) {
      state.createName = event.target.value;
      return;
    }

    if (event.target.hasAttribute("data-embed-name")) {
      var active = getActiveEmbed_();
      if (active) {
        active.name = event.target.value;
        markDirty_();
      }
      return;
    }

    var sourceId = event.target.getAttribute("data-embed-item-id");
    var field = event.target.getAttribute("data-embed-item-field");
    if (sourceId && field) {
      updateItemOverride_(sourceId, field, event.target.value, false);
    }
  }

  function handleChange_(event) {
    var fileInput = event.target.closest("[data-embed-image-input]");
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    uploadEventImage_(
        fileInput.getAttribute("data-source-event-id") || "",
        fileInput.files[0],
    );
  }

  function signIn_() {
    if (!state.auth || state.working) return;
    state.working = true;
    state.error = "";
    render_();
    var provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt: "select_account"});
    var signInPromise = isLocalHost_() ?
      state.auth.signInWithRedirect(provider) :
      state.auth.signInWithPopup(provider).catch(function(error) {
      if (error && (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/operation-not-supported-in-this-environment"
      )) {
        return state.auth.signInWithRedirect(provider);
      }
      throw error;
      });
    signInPromise.catch(function(error) {
      state.error = error && error.message ? error.message :
        "Google sign-in did not start.";
    }).finally(function() {
      state.working = false;
      render_();
    });
  }

  function loadWorkspace_(refresh) {
    state.loading = !state.embeds.length;
    state.working = true;
    state.error = "";
    state.message = refresh ? "Refreshing Central events…" : "";
    render_();
    apiRequest_("GET", null, refresh ? "?refresh=1" : "").then(function(data) {
      state.embeds = Array.isArray(data.embeds) ? data.embeds : [];
      state.events = Array.isArray(data.events) ? data.events : [];
      state.embeds.forEach(hydrateEmbedRecurrences_);
      state.sync = data.sync || null;
      state.activeId = getRequestedEmbedId_();
      if (state.activeId && !getActiveEmbed_()) {
        state.activeId = "";
        window.history.replaceState({}, "", "/embeds");
      }
      state.message = refresh ? "Central events refreshed." : "";
    }).catch(showError_).finally(function() {
      state.loading = false;
      state.working = false;
      render_();
    });
  }

  function createEmbed_() {
    var name = String(state.createName || "").trim();
    if (!name) {
      state.error = "Give the embed an internal name.";
      render_();
      return;
    }
    runAction_({action: "create", name: name}, function(data) {
      state.createOpen = false;
      state.embeds.unshift(data.embed);
      state.message = data.message || "Event Embed created.";
      openEmbed_(data.embed.id);
    });
  }

  function renameEmbed_(id) {
    var embed = getEmbedById_(id);
    if (!embed) return;
    var name = window.prompt("Rename this embed:", embed.name);
    if (!name || !name.trim() || name.trim() === embed.name) return;
    runAction_({action: "rename", id: id, name: name.trim()}, function(data) {
      embed.name = data.name;
      state.message = data.message || "Embed renamed.";
    });
  }

  function duplicateEmbed_(id) {
    runAction_({action: "duplicate", id: id}, function(data) {
      state.embeds.unshift(data.embed);
      state.message = data.message || "Embed duplicated.";
      openEmbed_(data.embed.id);
    });
  }

  function deleteEmbed_(id) {
    var embed = getEmbedById_(id);
    if (!embed || !window.confirm(
        "Delete \"" + embed.name +
        "\"? Its public endpoint and existing embed code will stop working.",
    )) return;
    runAction_({action: "delete", id: id}, function(data) {
      state.embeds = state.embeds.filter(function(item) {
        return item.id !== id;
      });
      if (state.activeId === id) returnToDashboard_(true);
      state.message = data.message || "Embed deleted.";
    });
  }

  function saveActiveEmbed_(publish) {
    var embed = getActiveEmbed_();
    if (!embed) return;
    var name = String(embed.name || "").trim();
    var items = embed.draft && Array.isArray(embed.draft.items) ?
      embed.draft.items : [];
    if (!name) {
      state.error = "Give the embed an internal name.";
      render_();
      return;
    }
    if (publish && !items.length) {
      state.error = "Select at least one event before publishing.";
      render_();
      return;
    }
    runAction_({
      action: publish ? "publish" : "saveDraft",
      id: embed.id,
      name: name,
      type: "events",
      layout: embed.draft && embed.draft.layout || "standard",
      items: items,
    }, function(data) {
      replaceEmbed_(data.embed);
      state.dirty = false;
      state.message = data.message;
    });
  }

  function uploadEventImage_(sourceId, file) {
    var embed = getActiveEmbed_();
    if (!embed || !sourceId || !file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
      state.error = "Choose a JPEG, PNG, or WebP image.";
      render_();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      state.error = "Embed images must be 10 MB or smaller.";
      render_();
      return;
    }
    state.imageUploadingId = sourceId;
    state.error = "";
    render_();
    readFileAsDataUrl_(file).then(function(dataUrl) {
      return apiRequest_("POST", {
        action: "uploadImage",
        id: embed.id,
        sourceEventId: sourceId,
        dataUrl: dataUrl,
      });
    }).then(function(data) {
      updateItemOverride_(sourceId, "image", data.image, false);
      state.message = data.message || "Graphic uploaded. Save or publish next.";
    }).catch(showError_).finally(function() {
      state.imageUploadingId = "";
      render_();
    });
  }

  function toggleSelectedEvent_(sourceId) {
    var embed = getActiveEmbed_();
    if (!embed || !sourceId) return;
    var items = getActiveItems_();
    var source = getSourceEvent_(sourceId);
    if (!source) return;
    var existing = items.find(function(item) {
      return itemMatchesSourceEvent_(item, source);
    });
    if (existing) {
      removeSelectedEvent_(existing.sourceEventId);
      return;
    }
    items.push({
      sourceEventId: sourceId,
      recurrence: createRecurrence_(source),
      overrides: {
        title: null,
        date: null,
        time: null,
        location: null,
        description: null,
        image: null,
      },
      order: items.length,
    });
    embed.draft.items = normalizeItemOrder_(items);
    markDirty_();
    render_();
  }

  function removeSelectedEvent_(sourceId) {
    var embed = getActiveEmbed_();
    if (!embed) return;
    var source = getSourceEvent_(sourceId);
    embed.draft.items = normalizeItemOrder_(getActiveItems_().filter(
        function(item) {
          return item.sourceEventId !== sourceId &&
            !(source && itemMatchesSourceEvent_(item, source));
        },
    ));
    markDirty_();
    render_();
  }

  function moveSelectedEvent_(sourceId, direction) {
    var embed = getActiveEmbed_();
    if (!embed) return;
    var items = getActiveItems_().slice();
    var index = items.findIndex(function(item) {
      return item.sourceEventId === sourceId;
    });
    var nextIndex = direction === "down" ? index + 1 : index - 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    var moved = items.splice(index, 1)[0];
    items.splice(nextIndex, 0, moved);
    embed.draft.items = normalizeItemOrder_(items);
    markDirty_();
    render_();
  }

  function updateItemOverride_(sourceId, field, value, shouldRender) {
    var item = getActiveItems_().find(function(candidate) {
      return candidate.sourceEventId === sourceId;
    });
    if (!item) return;
    item.overrides = item.overrides || {};
    item.overrides[field] = field === "image" ? value :
      (String(value || "").trim() ? String(value) : null);
    markDirty_();
    if (shouldRender !== false) render_();
  }

  function setLayout_(layout) {
    var embed = getActiveEmbed_();
    if (!embed) return;
    var normalized = layout === "compact" ? "compact" : "standard";
    embed.draft = embed.draft || {layout: "standard", items: []};
    if (embed.draft.layout === normalized) return;
    embed.draft.layout = normalized;
    markDirty_();
    render_();
  }

  function openEmbed_(id) {
    if (state.dirty && !window.confirm("Discard unsaved embed changes?")) return;
    state.activeId = id;
    state.search = "";
    state.error = "";
    state.message = "";
    state.dirty = false;
    window.history.pushState({}, "", "/embeds?id=" + encodeURIComponent(id));
    render_();
    window.scrollTo({top: 0, behavior: "auto"});
  }

  function returnToDashboard_(skipConfirm) {
    if (!skipConfirm && state.dirty &&
      !window.confirm("Discard unsaved embed changes?")) return;
    state.activeId = "";
    state.dirty = false;
    state.error = "";
    window.history.pushState({}, "", "/embeds");
    render_();
  }

  function runAction_(payload, onSuccess) {
    if (state.working) return;
    state.working = true;
    state.error = "";
    state.message = "";
    render_();
    apiRequest_("POST", payload).then(onSuccess).catch(showError_).finally(
        function() {
          state.working = false;
          render_();
        },
    );
  }

  function apiRequest_(method, body, suffix) {
    if (!state.user) return Promise.reject(new Error("Sign in first."));
    return state.user.getIdToken().then(function(token) {
      return fetch("/api/admin/embeds" + (suffix || ""), {
        method: method,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      });
    }).then(function(response) {
      return response.json().catch(function() {
        return {};
      }).then(function(data) {
        if (!response.ok) {
          var error = new Error(data.error || "Central Embeds request failed.");
          error.code = data.code || "";
          throw error;
        }
        return data;
      });
    });
  }

  function render_() {
    if (!state.user) {
      root.innerHTML = renderAccessGate_();
      return;
    }
    root.innerHTML = [
      renderHeader_(),
      "<main class=\"embeds-main\">",
      renderMessages_(),
      state.loading ? renderLoading_() :
        (getActiveEmbed_() ? renderEditor_() : renderDashboard_()),
      "</main>",
    ].join("");
  }

  function renderAccessGate_() {
    return [
      "<main class=\"embeds-access\">",
      "<section class=\"embeds-access-card\">",
      "<img src=\"/favicon.svg\" alt=\"\">",
      "<p class=\"embeds-kicker\">CENTRAL EMBEDS</p>",
      "<h1>", state.loading ? "Preparing Central Embeds" :
        "Publish Central anywhere", "</h1>",
      "<p>Select Central events, add presentation overrides, and publish a persistent embed without changing Planning Center.</p>",
      state.error ? "<p class=\"embeds-alert is-error\">" +
        escapeHtml_(state.error) + "</p>" : "",
      "<div class=\"embeds-access-actions\">",
      "<button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"sign-in\"",
      state.loading || state.working ? " disabled" : "",
      ">", state.working ? "Signing In…" : "Sign In with Google", "</button>",
      "<a class=\"embeds-button\" href=\"/\">Return to Central</a>",
      "</div></section></main>",
    ].join("");
  }

  function renderHeader_() {
    var embed = getActiveEmbed_();
    return [
      "<header class=\"embeds-header\"><div class=\"embeds-header-inner\">",
      "<a class=\"embeds-brand\" href=\"/embeds\"><img src=\"/favicon.svg\" alt=\"\"><span><b>Central</b><strong>Embeds</strong></span></a>",
      embed ? "<span class=\"embeds-header-current\">" +
        escapeHtml_(embed.name) + "</span>" : "",
      "<div class=\"embeds-account\"><span>",
      escapeHtml_(state.user.displayName || state.user.email || "Central User"),
      "</span><a href=\"/admin\">Admin</a><button type=\"button\" data-embeds-action=\"sign-out\">Sign Out</button></div>",
      "</div></header>",
    ].join("");
  }

  function renderMessages_() {
    return [
      state.error ? "<div class=\"embeds-alert is-error\" role=\"alert\">" +
        escapeHtml_(state.error) + "</div>" : "",
      state.message ? "<div class=\"embeds-alert is-success\" role=\"status\">" +
        escapeHtml_(state.message) + "</div>" : "",
    ].join("");
  }

  function renderLoading_() {
    return "<section class=\"embeds-panel embeds-loading\"><span></span><h1>Loading Central Embeds</h1><p>Reading saved configurations and current Central events.</p></section>";
  }

  function renderDashboard_() {
    return [
      "<section class=\"embeds-hero\"><div><p class=\"embeds-kicker\">PUBLISHING WORKSPACE</p><h1>Central Embeds</h1><p>Build persistent Event Embeds for CrossPointe.tv and other approved websites.</p></div>",
      "<button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"create\">Create Embed</button></section>",
      state.createOpen ? renderCreateStep_() : "",
      "<section class=\"embeds-panel\"><div class=\"embeds-panel-heading\"><div><h2>Saved embeds</h2><p>",
      String(state.embeds.length), " configuration", state.embeds.length === 1 ? "" : "s",
      "</p></div><button class=\"embeds-button is-small\" type=\"button\" data-embeds-action=\"refresh-events\"",
      state.working ? " disabled" : "", ">Refresh Central Events</button></div>",
      state.embeds.length ? "<div class=\"embeds-list\">" +
        state.embeds.map(renderEmbedRow_).join("") + "</div>" :
        "<div class=\"embeds-empty\"><h3>No embeds yet</h3><p>Create the first Event Embed, then publish it when it is ready for a website.</p></div>",
      "</section>",
    ].join("");
  }

  function renderCreateStep_() {
    return [
      "<section class=\"embeds-panel embeds-create-step\"><div><p class=\"embeds-kicker\">NEW EVENT EMBED</p><h2>Name this embed</h2><p>This internal name helps your Central team find it later and does not appear publicly.</p></div><label><span>Internal name</span><input maxlength=\"100\" data-embed-create-name value=\"",
      escapeAttr_(state.createName),
      "\" placeholder=\"CrossPointe.tv Events\"></label><div><button type=\"button\" class=\"embeds-button\" data-embeds-action=\"cancel-create\">Cancel</button><button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"confirm-create\"",
      state.working ? " disabled" : "",
      ">", state.working ? "Creating…" : "Create Event Embed", "</button></div></section>",
    ].join("");
  }

  function renderEmbedRow_(embed) {
    var isPublished = !!embed.published;
    return [
      "<article class=\"embeds-row\"><button class=\"embeds-row-main\" type=\"button\" data-embeds-action=\"open\" data-embed-id=\"",
      escapeAttr_(embed.id), "\"><span class=\"embeds-status ",
      isPublished ? "is-published\">PUBLISHED" : "\">DRAFT",
      "</span><h3>", escapeHtml_(embed.name), "</h3><p>",
      escapeHtml_(embed.id), " · ", embed.draft.layout === "compact" ?
        "Compact" : "Standard", " · ", String(embed.draft.items.length), " selected event",
      embed.draft.items.length === 1 ? "" : "s", "</p></button>",
      "<div class=\"embeds-row-actions\">",
      isPublished ? "<button type=\"button\" data-embeds-action=\"copy-code\" data-embed-id=\"" + escapeAttr_(embed.id) + "\">Copy Code</button>" : "",
      "<button type=\"button\" data-embeds-action=\"rename\" data-embed-id=\"", escapeAttr_(embed.id), "\">Rename</button>",
      "<button type=\"button\" data-embeds-action=\"duplicate\" data-embed-id=\"", escapeAttr_(embed.id), "\">Duplicate</button>",
      "<button class=\"is-danger\" type=\"button\" data-embeds-action=\"delete\" data-embed-id=\"", escapeAttr_(embed.id), "\">Delete</button>",
      "</div></article>",
    ].join("");
  }

  function renderEditor_() {
    var embed = getActiveEmbed_();
    var items = getActiveItems_();
    var search = state.search.trim().toLowerCase();
    var filteredEvents = state.events.filter(function(item) {
      if (!search) return true;
      return [item.title, item.date, item.time, item.location]
          .join(" ").toLowerCase().indexOf(search) !== -1;
    });

    return [
      "<section class=\"embeds-editor-heading\"><button type=\"button\" class=\"embeds-back\" data-embeds-action=\"back\">← All Embeds</button><div class=\"embeds-editor-title\"><div><p class=\"embeds-kicker\">EVENT EMBED · ", escapeHtml_(embed.id), "</p><input data-embed-name maxlength=\"100\" aria-label=\"Embed name\" value=\"", escapeAttr_(embed.name), "\"></div>",
      "<span class=\"embeds-status ", embed.published ? "is-published\">PUBLISHED" : "\">DRAFT", "</span></div></section>",
      embed.published ? renderPublishTools_(embed) : "",
      renderLayoutPicker_(embed),
      "<div class=\"embeds-editor-grid\"><section class=\"embeds-panel embeds-picker\"><div class=\"embeds-panel-heading\"><div><h2>1. Select events</h2><p>Checking one recurring instance includes its future Planning Center dates automatically.</p></div><button class=\"embeds-button is-small\" type=\"button\" data-embeds-action=\"refresh-events\">Refresh</button></div>",
      "<label class=\"embeds-search\"><span>Search Central events</span><input type=\"search\" data-embeds-search placeholder=\"Title, date, or location\" value=\"", escapeAttr_(state.search), "\"></label>",
      "<div class=\"embeds-event-options\">",
      filteredEvents.length ? filteredEvents.map(function(eventItem) {
        return renderEventOption_(eventItem, items.some(function(item) {
          return itemMatchesSourceEvent_(item, eventItem);
        }));
      }).join("") : "<p class=\"embeds-empty-inline\">No events match that search.</p>",
      "</div></section>",
      "<section class=\"embeds-selected-column\"><div class=\"embeds-panel embeds-selected-heading\"><div class=\"embeds-panel-heading\"><div><h2>2. Customize and order</h2><p>Blank fields continue using current Central / Planning Center values.</p></div><b>", String(items.length), " selected</b></div></div>",
      items.length ? items.map(function(item, index) {
        return renderSelectedEvent_(item, index, items.length);
      }).join("") : "<div class=\"embeds-panel embeds-empty\"><h3>Select an event to begin</h3><p>The event stays connected to Central unless you override a field for this embed.</p></div>",
      "</section></div>",
      "<footer class=\"embeds-savebar\"><div><strong>", state.dirty ? "Unsaved draft changes" : "Draft is saved", "</strong><span>Publishing updates every existing copy of this embed.</span></div><div><button type=\"button\" class=\"embeds-button\" data-embeds-action=\"save-draft\"", state.working ? " disabled" : "", ">", state.working ? "Working…" : "Save Draft", "</button><button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"publish\"", state.working ? " disabled" : "", ">Publish</button></div></footer>",
    ].join("");
  }

  function renderPublishTools_(embed) {
    return [
      "<section class=\"embeds-panel embeds-publish-tools\"><div><p class=\"embeds-kicker\">LIVE EMBED</p><h2>Stable code and server-renderable HTML</h2><p>The code keeps the same embed ID. Publishing later replaces its live configuration without replacing this snippet.</p></div><div class=\"embeds-publish-actions\"><button class=\"embeds-button is-primary\" type=\"button\" data-embeds-action=\"copy-code\" data-embed-id=\"", escapeAttr_(embed.id), "\">Copy Embed Code</button><button class=\"embeds-button\" type=\"button\" data-embeds-action=\"copy-html-url\" data-embed-id=\"", escapeAttr_(embed.id), "\">Copy HTML Endpoint</button><a class=\"embeds-button\" href=\"", escapeAttr_(getHtmlEndpoint_(embed.id)), "\" target=\"_blank\" rel=\"noopener\">Preview Live</a></div><pre>", escapeHtml_(getEmbedCode_(embed.id)), "</pre></section>",
    ].join("");
  }

  function renderLayoutPicker_(embed) {
    var layout = embed.draft && embed.draft.layout === "compact" ?
      "compact" : "standard";
    return [
      "<section class=\"embeds-panel embeds-layout-panel\"><div><p class=\"embeds-kicker\">PRESENTATION</p><h2>Choose the embed layout</h2><p>This is saved with the draft and takes effect everywhere after publishing.</p></div><div class=\"embeds-layout-options\">",
      renderLayoutOption_("standard", "Standard cards", "Full-width responsive cards with the complete event description.", layout),
      renderLayoutOption_("compact", "Compact cards", "Bounded cards with graphic, title, date and time, location, and action only.", layout),
      "</div></section>",
    ].join("");
  }

  function renderLayoutOption_(value, title, description, selected) {
    return [
      "<button type=\"button\" class=\"embeds-layout-option",
      selected === value ? " is-selected" : "",
      "\" data-embeds-action=\"set-layout\" data-embed-layout=\"",
      value,
      "\" aria-pressed=\"", selected === value ? "true" : "false", "\">",
      "<span class=\"embeds-layout-swatch is-", value, "\" aria-hidden=\"true\"><i></i><i></i></span>",
      "<span><strong>", escapeHtml_(title), "</strong><small>",
      escapeHtml_(description), "</small></span></button>",
    ].join("");
  }

  function renderEventOption_(eventItem, selected) {
    var occurrenceCount = getSeriesSourcesForEvent_(eventItem).length;
    return [
      "<button type=\"button\" class=\"embeds-event-option", selected ? " is-selected" : "", "\" data-embeds-action=\"toggle-event\" data-source-event-id=\"", escapeAttr_(eventItem.id), "\"><span class=\"embeds-check\">", selected ? "✓" : "", "</span><span><strong>", escapeHtml_(eventItem.title), "</strong><small>", escapeHtml_([eventItem.date, eventItem.time].filter(Boolean).join(" · ")), "</small>", eventItem.location ? "<small>" + escapeHtml_(eventItem.location) + "</small>" : "", occurrenceCount > 1 ? "<small class=\"embeds-series-note\">Recurring series · " + String(occurrenceCount) + " dates in the next 60 days</small>" : "", "</span></button>",
    ].join("");
  }

  function renderSelectedEvent_(item, index, total) {
    var seriesSources = getSeriesSourcesForItem_(item);
    var source = getSourceEvent_(item.sourceEventId) || seriesSources[0];
    var overrides = item.overrides || {};
    if (!source) {
      return [
        "<article class=\"embeds-panel embeds-selected-event is-missing\"><div class=\"embeds-selected-top\"><div><span class=\"embeds-warning\">NO INSTANCE IN THE 60-DAY WINDOW</span><h3>", escapeHtml_(item.recurrence && item.recurrence.title || item.sourceEventId), "</h3><p>This selection stays saved and will appear publicly when Central finds its next recurring instance.</p></div>", renderOrderActions_(item, index, total), "</div></article>",
      ].join("");
    }
    var image = overrides.image && overrides.image.url ?
      overrides.image.url : source.imageUrl;
    return [
      "<article class=\"embeds-panel embeds-selected-event\"><div class=\"embeds-selected-top\"><div><span>", seriesSources.length > 1 ? "RECURRING SERIES · " + String(seriesSources.length) + " UPCOMING INSTANCES" : "EVENT " + String(index + 1), "</span><h3>", escapeHtml_(overrides.title || source.title), "</h3><p>", escapeHtml_([overrides.date || source.date, overrides.time || source.time].filter(Boolean).join(" · ")), "</p>", seriesSources.length > 1 ? "<small class=\"embeds-series-help\">Future Planning Center instances in this series are included automatically. Overrides below apply to every instance.</small>" : "", "</div>", renderOrderActions_(item, index, total), "</div>",
      "<div class=\"embeds-fields\">",
      renderOverrideInput_(item, "title", "Title", source.title),
      renderOverrideInput_(item, "date", "Date", source.date),
      renderOverrideInput_(item, "time", "Time", source.time),
      renderOverrideInput_(item, "location", "Location", source.location),
      "<label class=\"is-wide\"><span>Description</span><textarea rows=\"4\" maxlength=\"2400\" data-embed-item-id=\"", escapeAttr_(item.sourceEventId), "\" data-embed-item-field=\"description\" placeholder=\"", escapeAttr_(source.description || "No Central description"), "\">", escapeHtml_(overrides.description || ""), "</textarea><small>", overrides.description ? "Embed override" : "Using current Central description", "</small></label>",
      "</div><div class=\"embeds-image-editor\"><div class=\"embeds-image-preview", image ? "" : " is-empty", "\">", image ? "<img src=\"" + escapeAttr_(image) + "\" alt=\"\">" : "<span>No event graphic</span>", "</div><div><strong>Event graphic</strong><p>", overrides.image ? "Custom image for this embed only." : "Using the current Central graphic when available.", "</p><div class=\"embeds-image-actions\"><label class=\"embeds-button is-small", state.imageUploadingId === item.sourceEventId ? " is-disabled" : "", "\">", state.imageUploadingId === item.sourceEventId ? "Uploading…" : "Upload Custom Graphic", "<input type=\"file\" accept=\"image/jpeg,image/png,image/webp\" data-embed-image-input data-source-event-id=\"", escapeAttr_(item.sourceEventId), "\"", state.imageUploadingId === item.sourceEventId ? " disabled" : "", "></label>", overrides.image ? "<button type=\"button\" class=\"embeds-button is-small\" data-embeds-action=\"use-source-image\" data-source-event-id=\"" + escapeAttr_(item.sourceEventId) + "\">Use Existing Graphic</button>" : "", "</div></div></div></article>",
    ].join("");
  }

  function renderOrderActions_(item, index, total) {
    return [
      "<div class=\"embeds-order-actions\"><button type=\"button\" aria-label=\"Move event up\" data-embeds-action=\"move-event\" data-direction=\"up\" data-source-event-id=\"", escapeAttr_(item.sourceEventId), "\"", index === 0 ? " disabled" : "", ">↑</button><button type=\"button\" aria-label=\"Move event down\" data-embeds-action=\"move-event\" data-direction=\"down\" data-source-event-id=\"", escapeAttr_(item.sourceEventId), "\"", index === total - 1 ? " disabled" : "", ">↓</button><button class=\"is-danger\" type=\"button\" data-embeds-action=\"remove-event\" data-source-event-id=\"", escapeAttr_(item.sourceEventId), "\">Remove</button></div>",
    ].join("");
  }

  function renderOverrideInput_(item, field, label, sourceValue) {
    var value = item.overrides && item.overrides[field] || "";
    return [
      "<label><span>", escapeHtml_(label), "</span><input maxlength=\"",
      field === "location" ? "240" : "180",
      "\" data-embed-item-id=\"", escapeAttr_(item.sourceEventId),
      "\" data-embed-item-field=\"", escapeAttr_(field),
      "\" value=\"", escapeAttr_(value), "\" placeholder=\"",
      escapeAttr_(sourceValue || "No Central value"), "\"><small>",
      value ? "Embed override" : "Using Central: " + (sourceValue || "none"),
      "</small></label>",
    ].join("");
  }

  function getEmbedCode_(id) {
    var htmlEndpoint = getHtmlEndpoint_(id);
    return [
      "<div class=\"central-embed\" data-central-embed=\"", id, "\">\n",
      "  <p><a href=\"", htmlEndpoint, "\">View upcoming CrossPointe events</a></p>\n",
      "</div>\n",
      "<script async src=\"", window.location.origin, "/embed.js\"></script>",
    ].join("");
  }

  function getHtmlEndpoint_(id) {
    return window.location.origin + "/api/embed/" + id + ".html";
  }

  function copyEmbedCode_(id) {
    var embed = getEmbedById_(id);
    if (!embed || !embed.published) {
      state.error = "Publish the embed before copying live embed code.";
      render_();
      return;
    }
    copyText_(getEmbedCode_(id), "Embed code copied.");
  }

  function copyText_(value, message) {
    var promise = navigator.clipboard && navigator.clipboard.writeText ?
      navigator.clipboard.writeText(value) :
      Promise.reject(new Error("Clipboard unavailable."));
    promise.then(function() {
      state.message = message;
      state.error = "";
      render_();
    }).catch(function() {
      window.prompt("Copy this value:", value);
      state.message = message;
      render_();
    });
  }

  function showError_(error) {
    state.error = error && error.message ? error.message :
      "Central Embeds could not complete that request.";
    state.message = "";
  }

  function markDirty_() {
    state.dirty = true;
    state.message = "";
  }

  function getActiveEmbed_() {
    return getEmbedById_(state.activeId);
  }

  function getEmbedById_(id) {
    return state.embeds.find(function(embed) {
      return embed.id === id;
    }) || null;
  }

  function replaceEmbed_(embed) {
    state.embeds = state.embeds.map(function(item) {
      return item.id === embed.id ? embed : item;
    });
  }

  function getActiveItems_() {
    var embed = getActiveEmbed_();
    if (!embed) return [];
    embed.draft = embed.draft || {layout: "standard", items: []};
    embed.draft.layout = embed.draft.layout === "compact" ?
      "compact" : "standard";
    embed.draft.items = Array.isArray(embed.draft.items) ?
      embed.draft.items : [];
    return embed.draft.items;
  }

  function getSourceEvent_(id) {
    return state.events.find(function(item) {
      return item.id === id;
    }) || null;
  }

  function hydrateEmbedRecurrences_(embed) {
    var items = embed && embed.draft && Array.isArray(embed.draft.items) ?
      embed.draft.items : [];
    items.forEach(function(item) {
      if (item.recurrence) return;
      var source = getSourceEvent_(item.sourceEventId);
      if (source) item.recurrence = createRecurrence_(source);
    });
  }

  function createRecurrence_(source) {
    if (!source) return null;
    return {
      planningCenterEventId: source.seriesId || "",
      title: source.seriesTitle || source.title || "",
    };
  }

  function itemMatchesSourceEvent_(item, source) {
    if (!item || !source) return false;
    var recurrence = item.recurrence || null;
    if (recurrence && recurrence.planningCenterEventId) {
      return recurrence.planningCenterEventId === source.seriesId;
    }
    if (recurrence && recurrence.title) {
      return normalizeSeriesTitle_(recurrence.title) ===
        normalizeSeriesTitle_(source.seriesTitle || source.title);
    }
    return item.sourceEventId === source.id;
  }

  function getSeriesSourcesForEvent_(source) {
    if (!source) return [];
    var recurrence = createRecurrence_(source);
    return state.events.filter(function(candidate) {
      return itemMatchesSourceEvent_({
        sourceEventId: source.id,
        recurrence: recurrence,
      }, candidate);
    });
  }

  function getSeriesSourcesForItem_(item) {
    if (!item) return [];
    return state.events.filter(function(source) {
      return itemMatchesSourceEvent_(item, source);
    });
  }

  function normalizeSeriesTitle_(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeItemOrder_(items) {
    return items.map(function(item, index) {
      item.order = index;
      return item;
    });
  }

  function getRequestedEmbedId_() {
    var id = new URLSearchParams(window.location.search).get("id") || "";
    return /^embed_[a-z0-9]{12,32}$/.test(id) ? id : "";
  }

  function readFileAsDataUrl_(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function() {
        reject(new Error("That image could not be read."));
      };
      reader.readAsDataURL(file);
    });
  }

  function isLocalHost_() {
    return ["localhost", "127.0.0.1", "[::1]"]
        .indexOf(window.location.hostname) !== -1;
  }

  function escapeHtml_(value) {
    return String(value || "").replace(/[&<>"']/g, function(character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function escapeAttr_(value) {
    return escapeHtml_(value);
  }
}());
