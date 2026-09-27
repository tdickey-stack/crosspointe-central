(function() {
  "use strict";

  var root = document.getElementById("central-embeds-root");
  var GROUPS_DIRECTORY_URL = "https://crosspointetv.churchcenter.com/groups";
  var state = {
    auth: null,
    user: null,
    loading: true,
    working: false,
    embeds: [],
    events: [],
    activeId: "",
    search: "",
    filter: "all",
    editingId: "",
    codeOpen: false,
    previewOpen: false,
    previewExpanded: false,
    previewWidth: "desktop",
    mobilePanel: "events",
    savedEmbeds: {},
    previewTimer: 0,
    message: "",
    error: "",
    dirty: false,
    imageUploadingId: "",
    sync: null,
    createOpen: false,
    createType: "events",
    createName: "CrossPointe.tv Events",
  };

  if (!root) return;
  root.addEventListener("click", handleClick_);
  root.addEventListener("input", handleInput_);
  root.addEventListener("change", handleChange_);
  window.addEventListener("popstate", function() {
    if (state.imageUploadingId || state.working) {
      window.history.pushState({}, "", "/embeds?id=" + encodeURIComponent(state.activeId));
      return;
    }
    if (state.dirty && !window.confirm("Discard unsaved embed changes?")) {
      window.history.pushState({}, "", "/embeds?id=" + encodeURIComponent(state.activeId));
      return;
    }
    discardActiveChanges_();
    state.activeId = getRequestedEmbedId_();
    state.editingId = "";
    render_();
  });
  root.addEventListener("keydown", handleKeydown_);
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
        state.savedEmbeds = {};
        state.dirty = false;
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
    if ((state.working || state.imageUploadingId) &&
        ["save-draft", "publish", "refresh-events", "set-layout", "set-theme", "toggle-event", "remove-event", "restore-event", "use-source-image", "back", "open", "sign-out"].indexOf(action) !== -1) return;
    var id = button.getAttribute("data-embed-id") || "";
    var sourceId = button.getAttribute("data-source-event-id") || "";

    if (action === "sign-in") {
      signIn_();
    } else if (action === "sign-out") {
      if (state.dirty && !window.confirm("Discard unsaved embed changes and sign out?")) return;
      state.auth.signOut();
    } else if (action === "create") {
      state.createOpen = true;
      state.createType = "events";
      state.createName = "CrossPointe.tv Events";
      render_();
    } else if (action === "set-create-type") {
      setCreateType_(button.getAttribute("data-embed-type") || "events");
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
    } else if (action === "set-theme") {
      setTheme_(button.getAttribute("data-embed-theme") || "light");
    } else if (action === "toggle-event") {
      toggleSelectedEvent_(sourceId);
    } else if (action === "set-filter") {
      state.filter = button.getAttribute("data-filter") || "all";
      render_();
    } else if (action === "edit-event") {
      state.editingId = sourceId;
      render_();
      focusDialog_();
    } else if (action === "close-details") {
      state.editingId = "";
      render_();
      focusEvent_(sourceId);
    } else if (action === "restore-event") {
      var item = getActiveItems_().find(function(candidate) { return candidate.sourceEventId === sourceId; });
      if (item) {
        item.overrides = {};
        markDirty_();
        render_();
      }
    } else if (action === "toggle-code") {
      state.codeOpen = !state.codeOpen;
      render_();
      if (state.codeOpen) focusDialog_();
      else root.querySelector('[data-focus-key="code"]').focus({preventScroll: true});
    } else if (action === "toggle-preview") {
      state.previewOpen = !state.previewOpen;
      if (!state.previewOpen && state.mobilePanel === "preview") state.mobilePanel = "events";
      state.previewExpanded = false;
      render_();
    } else if (action === "toggle-preview-size") {
      state.previewExpanded = !state.previewExpanded;
      render_();
      if (state.previewExpanded) focusDialog_();
    } else if (action === "preview-width") {
      state.previewWidth = button.getAttribute("data-width") || "desktop";
      render_();
    } else if (action === "mobile-panel") {
      state.mobilePanel = button.getAttribute("data-panel") || "events";
      state.previewOpen = state.mobilePanel === "preview";
      render_();
    } else if (action === "remove-event") {
      removeSelectedEvent_(sourceId);
    } else if (action === "use-source-image") {
      updateItemOverride_(sourceId, "image", null);
    }
  }

  function handleInput_(event) {
    if (state.working || state.imageUploadingId) return;
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
      var hint = event.target.closest("label").querySelector("small");
      if (hint) hint.textContent = event.target.value.trim() ? "Embed override" : "Using current Central value";
    }
  }

  function handleChange_(event) {
    if (state.working || state.imageUploadingId) return;
    var selection = event.target.closest("[data-embed-select]");
    if (selection) {
      toggleSelectedEvent_(selection.getAttribute("data-source-event-id") || "");
      return;
    }
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
    // Refresh sources without replacing a user's unsaved working draft.
    var active = getActiveEmbed_();
    var workingCopy = state.dirty && active ? JSON.parse(JSON.stringify(active)) : null;
    state.loading = !state.embeds.length;
    state.working = true;
    state.error = "";
    state.message = refresh ? "Refreshing Central events…" : "";
    render_();
    apiRequest_("GET", null, refresh ? "?refresh=1" : "").then(function(data) {
      state.embeds = Array.isArray(data.embeds) ?
        data.embeds.map(normalizeEmbed_) : [];
      state.embeds.forEach(rememberSavedEmbed_);
      if (workingCopy) {
        state.embeds = state.embeds.map(function(embed) {
          return embed.id === workingCopy.id ? workingCopy : embed;
        });
      }
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
    runAction_({
      action: "create",
      name: name,
      type: normalizeEmbedType_(state.createType),
    }, function(data) {
      state.createOpen = false;
      var created = normalizeEmbed_(data.embed);
      state.embeds.unshift(created);
      rememberSavedEmbed_(created);
      state.message = data.message ||
        (created.type === "groups" ? "Groups Embed created." :
          "Event Embed created.");
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
      if (state.savedEmbeds[id]) state.savedEmbeds[id].name = data.name;
      state.message = data.message || "Embed renamed.";
    });
  }

  function duplicateEmbed_(id) {
    runAction_({action: "duplicate", id: id}, function(data) {
      var duplicate = normalizeEmbed_(data.embed);
      state.embeds.unshift(duplicate);
      rememberSavedEmbed_(duplicate);
      state.message = data.message || "Embed duplicated.";
      openEmbed_(duplicate.id);
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
      delete state.savedEmbeds[id];
      if (state.activeId === id) returnToDashboard_(true);
      state.message = data.message || "Embed deleted.";
    });
  }

  function saveActiveEmbed_(publish) {
    var embed = getActiveEmbed_();
    if (!embed) return;
    var name = String(embed.name || "").trim();
    var type = getEmbedType_(embed);
    var items = embed.draft && Array.isArray(embed.draft.items) ?
      embed.draft.items : [];
    if (!name) {
      state.error = "Give the embed an internal name.";
      render_();
      return;
    }
    if (type === "events" && publish && !items.length) {
      state.error = "Select at least one event before publishing.";
      render_();
      return;
    }
    var payload = {
      action: publish ? "publish" : "saveDraft",
      id: embed.id,
      name: name,
      type: type,
    };
    if (type === "groups") {
      payload.theme = getEmbedTheme_(embed);
    } else {
      payload.layout = embed.draft && embed.draft.layout || "standard";
      payload.items = items;
    }
    runAction_(payload, function(data) {
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
    if (items.length >= 100) {
      state.error = "This embed can include up to 100 events or series. Remove one before adding another.";
      render_();
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

  function setTheme_(theme) {
    var embed = getActiveEmbed_();
    if (!embed || getEmbedType_(embed) !== "groups") return;
    var normalized = normalizeTheme_(theme);
    embed.draft = embed.draft || {theme: "light"};
    if (embed.draft.theme === normalized) return;
    embed.draft.theme = normalized;
    markDirty_();
    render_();
  }

  function setCreateType_(type) {
    var normalized = normalizeEmbedType_(type);
    state.createType = normalized;
    state.createName = normalized === "groups" ?
      "CrossPointe.tv Groups" : "CrossPointe.tv Events";
    render_();
  }

  function openEmbed_(id) {
    if (state.dirty && !window.confirm("Discard unsaved embed changes?")) return;
    discardActiveChanges_();
    state.activeId = id;
    state.editingId = "";
    state.codeOpen = false;
    state.filter = "all";
    state.mobilePanel = "events";
    state.previewExpanded = false;
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
    discardActiveChanges_();
    state.activeId = "";
    state.editingId = "";
    state.codeOpen = false;
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
    var focus = captureFocus_();
    var scrolls = Array.from(root.querySelectorAll("[data-preserve-scroll]")).map(function(node) {
      return {key: node.getAttribute("data-preserve-scroll"), top: node.scrollTop};
    });
    var openDates = Array.from(root.querySelectorAll("details[data-series-dates][open]")).map(function(node) {
      return node.getAttribute("data-series-dates");
    });
    // Reuse the frame when filtering/selecting; an unchanged preview must not reload.
    var previousFrame = root.querySelector("[data-draft-preview]");
    var active = getActiveEmbed_();
    document.body.classList.toggle("is-events-workspace", !!(state.user && active && getEmbedType_(active) === "events"));
    if (!state.user) {
      root.innerHTML = renderAccessGate_();
      return;
    }
    root.innerHTML = [
      renderHeader_(),
      "<main class=\"embeds-main\">",
      renderMessages_(),
      state.loading ? renderLoading_() :
        (active ? renderEditor_() : renderDashboard_()),
      "</main>",
    ].join("");
    scrolls.forEach(function(saved) {
      var node = Array.from(root.querySelectorAll("[data-preserve-scroll]")).find(function(candidate) {
        return candidate.getAttribute("data-preserve-scroll") === saved.key;
      });
      if (node) node.scrollTop = saved.top;
    });
    root.querySelectorAll("details[data-series-dates]").forEach(function(node) {
      node.open = openDates.indexOf(node.getAttribute("data-series-dates")) !== -1;
    });
    var frame = root.querySelector("[data-draft-preview]");
    if (frame && previousFrame) frame.replaceWith(previousFrame);
    updatePreview_();
    var busy = !!(state.working || state.imageUploadingId);
    root.querySelectorAll("[data-embed-name], [data-embed-select], [data-embed-item-field], [data-embed-image-input], [data-embeds-search]").forEach(function(node) { node.disabled = busy; });
    root.querySelectorAll('[data-embeds-action="save-draft"], [data-embeds-action="publish"], [data-embeds-action="refresh-events"], [data-embeds-action="set-layout"], [data-embeds-action="restore-event"], [data-embeds-action="remove-event"]').forEach(function(node) { node.disabled = busy; });
    var modal = root.querySelector('[role="dialog"]');
    if (modal) {
      root.querySelector('.embeds-header').inert = true;
      Array.from(root.querySelector('.embeds-main').children).forEach(function(node) {
        if (!node.contains(modal)) node.inert = true;
      });
    }
    restoreFocus_(focus);
  }

  function captureFocus_() {
    var node = document.activeElement;
    if (!node || !root.contains(node)) return null;
    return {
      id: node.getAttribute("data-focus-key"),
      start: typeof node.selectionStart === "number" ? node.selectionStart : null,
      end: typeof node.selectionEnd === "number" ? node.selectionEnd : null,
    };
  }

  function restoreFocus_(saved) {
    if (!saved || !saved.id) return;
    var node = Array.from(root.querySelectorAll("[data-focus-key]")).find(function(candidate) {
      return candidate.getAttribute("data-focus-key") === saved.id;
    });
    if (!node) {
      node = Array.from(root.querySelectorAll('[data-embed-select], [data-embeds-action="edit-event"], [data-embeds-search]')).find(function(candidate) { return candidate.getClientRects().length && !candidate.disabled; });
      if (node) node.focus({preventScroll: true});
      return;
    }
    node.focus({preventScroll: true});
    if (saved.start !== null && node.setSelectionRange) {
      node.setSelectionRange(saved.start, saved.end);
    }
  }

  function focusEvent_(id) {
    var edit = Array.from(root.querySelectorAll('[data-embeds-action="edit-event"]')).find(function(node) {
      return node.getAttribute("data-source-event-id") === id;
    });
    if (edit) edit.focus({preventScroll: true});
  }

  function focusDialog_() {
    var dialog = root.querySelector('[role="dialog"]');
    if (dialog) dialog.querySelector("button, input, a").focus({preventScroll: true});
  }

  function handleKeydown_(event) {
    var dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return;
    if (event.key === "Escape") {
      var id = state.editingId;
      var wasPreview = state.previewExpanded;
      state.previewExpanded = false;
      state.editingId = "";
      state.codeOpen = false;
      render_();
      focusEvent_(id);
      if (!id) root.querySelector(wasPreview ? '[data-focus-key="preview"]' : '[data-embeds-action="toggle-code"]').focus();
    } else if (event.key === "Tab") {
      var controls = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, a[href], iframe'));
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }

  function renderAccessGate_() {
    return [
      "<main class=\"embeds-access\">",
      "<section class=\"embeds-access-card\">",
      "<img src=\"/favicon.svg\" alt=\"\">",
      "<p class=\"embeds-kicker\">CENTRAL EMBEDS</p>",
      "<h1>", state.loading ? "Preparing Central Embeds" :
        "Publish Central anywhere", "</h1>",
      "<p>Publish live Central events or the CrossPointe groups directory on approved websites without changing Planning Center.</p>",
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
      "<section class=\"embeds-hero\"><div><p class=\"embeds-kicker\">PUBLISHING WORKSPACE</p><h1>Central Embeds</h1><p>Build persistent Event and Groups Embeds for CrossPointe.tv and other approved websites.</p></div>",
      "<button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"create\">Create Embed</button></section>",
      state.createOpen ? renderCreateStep_() : "",
      "<section class=\"embeds-panel\"><div class=\"embeds-panel-heading\"><div><h2>Saved embeds</h2><p>",
      String(state.embeds.length), " configuration", state.embeds.length === 1 ? "" : "s",
      "</p></div><button class=\"embeds-button is-small\" type=\"button\" data-embeds-action=\"refresh-events\"",
      state.working ? " disabled" : "", ">Refresh Central Events</button></div>",
      state.embeds.length ? "<div class=\"embeds-list\">" +
        state.embeds.map(renderEmbedRow_).join("") + "</div>" :
        "<div class=\"embeds-empty\"><h3>No embeds yet</h3><p>Create an Event or Groups Embed, then publish it when it is ready for a website.</p></div>",
      "</section>",
    ].join("");
  }

  function renderCreateStep_() {
    var isGroups = state.createType === "groups";
    return [
      "<section class=\"embeds-panel embeds-create-step\"><div><p class=\"embeds-kicker\">NEW EMBED</p><h2>Choose what to publish</h2><p>The embed type cannot change after creation. Its internal name helps your Central team find it later and does not appear publicly.</p></div>",
      "<div class=\"embeds-create-fields\"><div class=\"embeds-type-options\" role=\"group\" aria-label=\"Embed type\">",
      renderCreateTypeOption_("events", "Events", "Choose and customize Central event cards.", state.createType),
      renderCreateTypeOption_("groups", "Groups", "Publish the live Planning Center groups directory.", state.createType),
      "</div><label><span>Internal name</span><input maxlength=\"100\" data-embed-create-name value=\"",
      escapeAttr_(state.createName),
      "\" placeholder=\"", isGroups ? "CrossPointe.tv Groups" :
        "CrossPointe.tv Events", "\"></label></div><div><button type=\"button\" class=\"embeds-button\" data-embeds-action=\"cancel-create\">Cancel</button><button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"confirm-create\"",
      state.working ? " disabled" : "",
      ">", state.working ? "Creating…" :
        (isGroups ? "Create Groups Embed" : "Create Event Embed"),
      "</button></div></section>",
    ].join("");
  }

  function renderCreateTypeOption_(value, title, description, selected) {
    return [
      "<button type=\"button\" class=\"embeds-type-option",
      selected === value ? " is-selected" : "",
      "\" data-embeds-action=\"set-create-type\" data-embed-type=\"",
      value, "\" aria-pressed=\"", selected === value ? "true" : "false",
      "\"><strong>", title, "</strong><small>", description,
      "</small></button>",
    ].join("");
  }

  function renderEmbedRow_(embed) {
    var isPublished = !!embed.published;
    var type = getEmbedType_(embed);
    var detail = type === "groups" ?
      "Groups · " + themeLabel_(getEmbedTheme_(embed)) + " theme" :
      (embed.draft.layout === "compact" ? "Compact" : "Standard") +
        " · " + String(embed.draft.items.length) + " selected event" +
        (embed.draft.items.length === 1 ? "" : "s");
    return [
      "<article class=\"embeds-row\"><button class=\"embeds-row-main\" type=\"button\" data-embeds-action=\"open\" data-embed-id=\"",
      escapeAttr_(embed.id), "\"><span class=\"embeds-status ",
      isPublished ? "is-published\">PUBLISHED" : "\">DRAFT",
      "</span><h3>", escapeHtml_(embed.name), "</h3><p>",
      escapeHtml_(embed.id), " · ", escapeHtml_(detail), "</p></button>",
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
    if (getEmbedType_(embed) === "groups") return renderGroupsEditor_(embed);
    return renderEventsEditor_(embed);
  }

  function renderEventsEditor_(embed) {
    var choices = getEventChoices_();
    var items = getActiveItems_();
    var selections = getResolvedSelections_();
    var available = selections.filter(function(entry) { return !!entry.event; });
    var filtered = choices.filter(function(choice) {
      var source = choice.source;
      var selected = items.some(function(item) { return itemMatchesSourceEvent_(item, source); });
      var searchMatch = choice.sources.some(function(event) {
        return [event.title, event.date, event.time, event.location].join(" ").toLowerCase().indexOf(state.search.trim().toLowerCase()) !== -1;
      });
      return searchMatch && (state.filter === "all" ||
        (state.filter === "featured" && source.featured) ||
        (state.filter === "selected" && selected));
    });
    return [
      '<section class="embeds-workspace-toolbar"><div class="embeds-workspace-title"><button class="embeds-back" data-embeds-action="back" type="button">← All Embeds</button>',
      '<input aria-label="Embed name" data-embed-name data-focus-key="name" maxlength="100" value="', escapeAttr_(embed.name), '">',
      '<span class="embeds-draft-status" data-draft-status role="status">', draftStatus_(embed), '</span></div>',
      '<div class="embeds-toolbar-actions"><div class="embeds-layout-switch" role="group" aria-label="Embed layout">',
      ['standard', 'compact'].map(function(layout) {
        return '<button type="button" data-embeds-action="set-layout" data-focus-key="layout-' + layout + '" data-embed-layout="' + layout + '" aria-pressed="' + (embed.draft.layout === layout) + '">' + (layout === 'standard' ? 'Standard' : 'Compact') + '</button>';
      }).join(''), '</div>',
      '<button class="embeds-button is-small" type="button" data-embeds-action="toggle-code" data-focus-key="code">Get Code</button>',
      '<button class="embeds-button is-small" type="button" data-embeds-action="save-draft" data-focus-key="save"', state.working ? ' disabled' : '', '>Save Draft</button>',
      '<button class="embeds-button is-primary is-small" type="button" data-embeds-action="publish" data-focus-key="publish"', state.working ? ' disabled' : '', '>Publish</button></div></section>',
      '<div class="embeds-mobile-tabs" role="group" aria-label="Workspace view">',
      ['events', 'selected', 'preview'].map(function(panel) { return '<button type="button" data-embeds-action="mobile-panel" data-panel="' + panel + '" aria-pressed="' + (panel === 'preview' ? state.previewOpen : !state.previewOpen && state.mobilePanel === panel) + '">' + (panel === 'events' ? 'Choose events' : panel === 'preview' ? 'Preview' : 'In this embed · ' + items.length) + '</button>'; }).join(''), '</div>',
      '<div class="embeds-workbench" data-mobile-panel="', state.mobilePanel, '">',
      '<aside class="embeds-selection-rail" aria-label="Selected events"><div class="embeds-rail-heading"><h2>In this embed <span>', items.length, '</span></h2><p>Featured first, then by date.</p><small>', available.length, ' visible · ', items.length - available.length, ' awaiting a date</small></div>',
      '<div class="embeds-selection-list" data-preserve-scroll="selected">', selections.length ? selections.map(renderSelectionRow_).join('') : '<div class="embeds-empty"><h3>Start with an event</h3><p>Check events to add them here. Their next dates stay connected to Central.</p></div>', '</div></aside>',
      '<section class="embeds-event-library" aria-label="Choose events"><div class="embeds-library-toolbar"><div><h2>Choose events</h2><p>Each recurring series appears once. Its next date updates automatically.</p></div><button class="embeds-button is-small" type="button" data-embeds-action="refresh-events" data-focus-key="refresh"', state.working ? ' disabled' : '', '>', state.working ? 'Refreshing…' : 'Refresh', '</button></div>',
      '<div class="embeds-library-filters"><label class="embeds-search"><span class="embeds-sr-only">Search events</span><input type="search" data-embeds-search data-focus-key="search" placeholder="Search title, date, or location" value="', escapeAttr_(state.search), '"></label><div class="embeds-filter-chips" role="group" aria-label="Filter events">',
      renderFilter_('all', 'All', choices.length), renderFilter_('featured', 'Featured', choices.filter(function(choice) { return choice.source.featured; }).length), renderFilter_('selected', 'Selected', choices.filter(function(choice) { return items.some(function(item) { return itemMatchesSourceEvent_(item, choice.source); }); }).length),
      '</div></div><div class="embeds-library-summary" role="status">', filtered.length, ' event', filtered.length === 1 ? '' : 's', ' · next 60 days</div>',
      '<div class="embeds-card-scroll" data-preserve-scroll="events"><div class="embeds-event-cards">', filtered.length ? filtered.map(function(choice) { return renderEventCard_(choice, items.some(function(item) { return itemMatchesSourceEvent_(item, choice.source); })); }).join('') : '<p class="embeds-empty-inline">No events match these filters. Try another search or choose All.</p>', '</div></div></section></div>',
      renderPreviewDock_(available.length),
      state.editingId ? renderDetailsDrawer_() : '',
      state.codeOpen ? renderCodeDialog_(embed) : '',
    ].join('');
  }

  function draftStatus_(embed) {
    if (state.dirty) return 'Unsaved changes';
    if (!embed.published) return 'Draft saved · not published';
    return JSON.stringify(embed.draft) === JSON.stringify(embed.published) ? 'Published · draft saved' : 'Draft saved · unpublished changes';
  }

  function renderFilter_(value, title, count) {
    return '<button type="button" data-embeds-action="set-filter" data-focus-key="filter-' + value + '" data-filter="' + value + '" aria-pressed="' + (state.filter === value) + '">' + title + ' <span>' + count + '</span></button>';
  }

  function getEventChoices_() {
    var groups = new Map();
    state.events.forEach(function(source) {
      var key = source.seriesId ? 'series:' + source.seriesId : 'title:' + normalizeSeriesTitle_(source.seriesTitle || source.title);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(source);
    });
    return Array.from(groups.values()).map(function(sources) {
      sources.sort(compareSourceDates_);
      return {source: sources[0], sources: sources};
    }).sort(function(a, b) { return Number(!!b.source.featured) - Number(!!a.source.featured) || compareSourceDates_(a.source, b.source); });
  }

  function compareSourceDates_(a, b) {
    var left = Date.parse(a.startsAt || a.endsAt) || Infinity;
    var right = Date.parse(b.startsAt || b.endsAt) || Infinity;
    return left === right ? 0 : left - right;
  }

  function getResolvedSelections_() {
    var embed = getActiveEmbed_();
    return window.CentralEmbedPreview.selections(embed.draft, state.events);
  }

  function renderEventCard_(choice, selected) {
    var source = choice.source;
    return [
      '<article class="embeds-event-card', selected ? ' is-selected' : '', source.featured ? ' is-featured' : '', '">',
      '<label class="embeds-card-choice">',
      source.imageUrl ? '<img class="embeds-card-image" src="' + escapeAttr_(source.imageUrl) + '" alt="" loading="lazy">' : '',
      '<span class="embeds-card-heading"><span class="embeds-card-badge">', source.featured ? '★ Featured' : (choice.sources.length > 1 ? 'Recurring' : 'Event'), '</span><input type="checkbox" data-embed-select data-focus-key="select-', escapeAttr_(source.id), '" data-source-event-id="', escapeAttr_(source.id), '" aria-label="Include ', escapeAttr_(source.title + ' · ' + source.time), '"', selected ? ' checked' : '', '></span>',
      '<strong>', escapeHtml_(source.title), '</strong><span class="embeds-card-date">', choice.sources.length > 1 ? 'Next: ' : '', escapeHtml_(source.date), '</span><span>', escapeHtml_(source.time), '</span><small>', escapeHtml_(source.location || 'Location to be confirmed'), '</small></label>',
      choice.sources.length > 1 ? '<details class="embeds-series-dates" data-series-dates="' + escapeAttr_(source.id) + '"><summary>' + choice.sources.length + ' upcoming dates</summary><ul>' + choice.sources.map(function(event) { return '<li>' + escapeHtml_(event.date + ' · ' + event.time) + '</li>'; }).join('') + '</ul></details>' : '<div class="embeds-card-footer">One upcoming date</div>',
      '</article>',
    ].join('');
  }

  function renderSelectionRow_(entry, index) {
    var item = entry.item;
    var event = entry.event;
    var title = event ? event.title : (item.recurrence && item.recurrence.title || item.sourceEventId);
    return '<article class="embeds-selection-row' + (event && event.featured ? ' is-featured' : '') + (!event ? ' is-missing' : '') + '"><span class="embeds-selection-number">' + (event ? index + 1 : '–') + '</span><div><strong>' + escapeHtml_(title) + '</strong>' + (event && event.featured ? '<span class="embeds-small-featured">★ Featured</span>' : '') + '<small>' + (event ? escapeHtml_(event.date + ' · ' + event.time) : 'Awaiting next date · not visible') + '</small>' + (hasOverrides_(item) ? '<small class="embeds-override-note">Custom details</small>' : '') + '<div class="embeds-selection-actions"><button type="button" data-embeds-action="edit-event" data-focus-key="edit-' + escapeAttr_(item.sourceEventId) + '" data-source-event-id="' + escapeAttr_(item.sourceEventId) + '" aria-label="Edit ' + escapeAttr_(title) + '">Edit</button><button type="button" data-embeds-action="remove-event" data-focus-key="remove-' + escapeAttr_(item.sourceEventId) + '" data-source-event-id="' + escapeAttr_(item.sourceEventId) + '" aria-label="Remove ' + escapeAttr_(title) + '">Remove</button></div></div></article>';
  }

  function hasOverrides_(item) {
    return Object.keys(item.overrides || {}).some(function(key) { return !!item.overrides[key]; });
  }

  function renderDetailsDrawer_() {
    var item = getActiveItems_().find(function(candidate) { return candidate.sourceEventId === state.editingId; });
    if (!item) { state.editingId = ''; return ''; }
    return '<div class="embeds-modal-backdrop"><section class="embeds-details-drawer" role="dialog" aria-modal="true" aria-label="Edit event details" data-preserve-scroll="details"><div class="embeds-dialog-heading"><div><p class="embeds-kicker">EMBED DETAILS</p><h2>Edit event</h2></div><button class="embeds-button is-small" type="button" data-embeds-action="close-details" data-source-event-id="' + escapeAttr_(item.sourceEventId) + '">Done</button></div><p class="embeds-detail-help">These changes apply only to this embed. Leave a field blank to keep using Central. Date and time overrides also apply when a recurring series advances. Automatic ordering follows the Central date.</p>' + renderSelectedEvent_(item, 0, 1) + '<button class="embeds-button" type="button" data-embeds-action="restore-event" data-focus-key="restore-event" data-source-event-id="' + escapeAttr_(item.sourceEventId) + '">Restore all Central values</button></section></div>';
  }

  function renderCodeDialog_(embed) {
    return '<div class="embeds-modal-backdrop"><section class="embeds-code-dialog" role="dialog" aria-modal="true" aria-label="Embed code"><div class="embeds-dialog-heading"><h2>Use this embed</h2><button class="embeds-button is-small" type="button" data-embeds-action="toggle-code">Done</button></div><p>Publishing updates every existing copy of this embed. Draft changes stay private until you publish.</p>' + (embed.published ? renderPublishTools_(embed) : '<p>Publish your first selection to get the embed code.</p>') + '</section></div>';
  }

  function renderPreviewDock_(count) {
    return '<section class="embeds-preview-dock' + (state.previewOpen ? ' is-open' : '') + (state.previewExpanded ? ' is-expanded' : '') + '"' + (state.previewExpanded ? ' role="dialog" aria-modal="true" aria-label="Expanded draft preview"' : '') + '><div class="embeds-preview-heading"><button type="button" data-embeds-action="toggle-preview" data-focus-key="preview" aria-expanded="' + state.previewOpen + '" aria-controls="embed-preview-stage"><strong>Draft preview</strong><span>' + count + ' visible cards · ' + (state.previewOpen ? 'Hide preview ↓' : 'Show preview ↑') + '</span></button>' + (state.previewOpen ? '<button class="embeds-preview-expand" type="button" data-embeds-action="toggle-preview-size" data-focus-key="expand-preview">' + (state.previewExpanded ? 'Exit expanded view' : 'Expand') + '</button><div class="embeds-preview-widths" role="group" aria-label="Preview width"><button type="button" data-embeds-action="preview-width" data-focus-key="preview-desktop" data-width="desktop" aria-pressed="' + (state.previewWidth === 'desktop') + '">Desktop</button><button type="button" data-embeds-action="preview-width" data-focus-key="preview-mobile" data-width="mobile" aria-pressed="' + (state.previewWidth === 'mobile') + '">Mobile</button></div>' : '') + '</div>' + (state.previewOpen ? '<div id="embed-preview-stage" class="embeds-preview-stage is-' + state.previewWidth + '"><iframe title="Unpublished draft embed preview" data-draft-preview sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe></div>' : '') + '</section>';
  }

  function updatePreview_() {
    var frame = root.querySelector('[data-draft-preview]');
    var embed = getActiveEmbed_();
    if (!frame || !embed || !window.CentralEmbedPreview) return;
    var doc = window.CentralEmbedPreview.document(embed.id, embed.draft, state.events, window.location.origin);
    if (frame.srcdoc !== doc) frame.srcdoc = doc;
  }

  function renderGroupsEditor_(embed) {
    return [
      "<section class=\"embeds-editor-heading\"><button type=\"button\" class=\"embeds-back\" data-embeds-action=\"back\">← All Embeds</button><div class=\"embeds-editor-title\"><div><p class=\"embeds-kicker\">GROUPS EMBED · ", escapeHtml_(embed.id), "</p><input data-embed-name maxlength=\"100\" aria-label=\"Embed name\" value=\"", escapeAttr_(embed.name), "\"></div>",
      "<span class=\"embeds-status ", embed.published ?
        "is-published\">PUBLISHED" : "\">DRAFT", "</span></div></section>",
      embed.published ? renderPublishTools_(embed) : "",
      renderThemePicker_(embed),
      "<section class=\"embeds-panel embeds-groups-info\"><div><p class=\"embeds-kicker\">LIVE DIRECTORY</p><h2>Groups stay connected to Planning Center</h2><p>The directory loads current public groups, filters, meeting details, and Church Center links automatically. There are no group selections, manual event cards, or image uploads to maintain here.</p></div><a class=\"embeds-button\" href=\"", GROUPS_DIRECTORY_URL, "\" target=\"_blank\" rel=\"noopener\">View Groups in Church Center</a></section>",
      renderSavebar_(),
    ].join("");
  }

  function renderSavebar_() {
    return [
      "<footer class=\"embeds-savebar\"><div><strong>",
      state.dirty ? "Unsaved draft changes" : "Draft is saved",
      "</strong><span>Publishing updates every existing copy of this embed.</span></div><div><button type=\"button\" class=\"embeds-button\" data-embeds-action=\"save-draft\"",
      state.working ? " disabled" : "", ">",
      state.working ? "Working…" : "Save Draft",
      "</button><button type=\"button\" class=\"embeds-button is-primary\" data-embeds-action=\"publish\"",
      state.working ? " disabled" : "", ">Publish</button></div></footer>",
    ].join("");
  }

  function renderPublishTools_(embed) {
    var isGroups = getEmbedType_(embed) === "groups";
    var heading = isGroups ? "Live directory with automatic updates" :
      "Crawlable HTML with live updates";
    var description = isGroups ?
      "Copied code includes the Groups Embed shell and a public Church Center fallback. The loader retrieves the current directory from Central whenever the page opens." :
      "Copied code includes the current semantic event HTML for bots and no-JavaScript visitors. The loader refreshes it from Central for browsers. For always-current HTML in the host page source itself, configure that site’s server or build to fetch the HTML endpoint.";
    var buttonLabel = isGroups ? "Copy Groups Embed Code" :
      "Copy Crawlable Embed Code";
    var placeholder = isGroups ?
      "<!-- The live groups directory loads here. -->" :
      "<!-- Current published event cards are inserted here when copied. -->";
    return [
      "<section class=\"embeds-panel embeds-publish-tools\"><div><p class=\"embeds-kicker\">LIVE EMBED</p><h2>", heading, "</h2><p>", description, "</p></div><div class=\"embeds-publish-actions\"><button class=\"embeds-button is-primary\" type=\"button\" data-embeds-action=\"copy-code\" data-embed-id=\"", escapeAttr_(embed.id), "\"", state.working ? " disabled" : "", ">", state.working ? "Preparing…" : buttonLabel, "</button><a class=\"embeds-button\" href=\"/embed-lab.html?id=", encodeURIComponent(embed.id), "\">Test in Embed Lab</a><button class=\"embeds-button\" type=\"button\" data-embeds-action=\"copy-html-url\" data-embed-id=\"", escapeAttr_(embed.id), "\">Copy HTML Endpoint</button><a class=\"embeds-button\" href=\"", escapeAttr_(getHtmlEndpoint_(embed.id)), "\" target=\"_blank\" rel=\"noopener\">Preview Live</a></div><pre>", escapeHtml_(getEmbedCode_(embed.id, placeholder, getEmbedType_(embed))), "</pre></section>",
    ].join("");
  }

  function renderThemePicker_(embed) {
    var theme = getEmbedTheme_(embed);
    return [
      "<section class=\"embeds-panel embeds-layout-panel embeds-theme-panel\"><div><p class=\"embeds-kicker\">COLOR THEME</p><h2>Choose the directory colors</h2><p>The groups layout is always responsive to its available width. This setting controls colors: Responsive follows each visitor’s light or dark system preference and updates when that preference changes.</p></div><div class=\"embeds-layout-options embeds-theme-options\">",
      renderThemeOption_("light", "Light", "Always use the light color palette.", theme),
      renderThemeOption_("dark", "Dark", "Always use the dark color palette.", theme),
      renderThemeOption_("responsive", "Responsive", "Follow the visitor’s system color preference.", theme),
      "</div></section>",
    ].join("");
  }

  function renderThemeOption_(value, title, description, selected) {
    return [
      "<button type=\"button\" class=\"embeds-layout-option embeds-theme-option is-",
      value, selected === value ? " is-selected" : "",
      "\" data-embeds-action=\"set-theme\" data-embed-theme=\"", value,
      "\" aria-pressed=\"", selected === value ? "true" : "false", "\">",
      "<span class=\"embeds-theme-swatch\" aria-hidden=\"true\"><i></i><i></i><i></i></span>",
      "<span><strong>", title, "</strong><small>", description,
      "</small></span></button>",
    ].join("");
  }

  function renderSelectedEvent_(item, index, total) {
    var seriesSources = getSeriesSourcesForItem_(item);
    var source = seriesSources.slice().sort(compareSourceDates_)[0] || getSourceEvent_(item.sourceEventId);
    var overrides = item.overrides || {};
    if (!source) {
      return [
        "<article class=\"embeds-panel embeds-selected-event is-missing\"><div class=\"embeds-selected-top\"><div><span class=\"embeds-warning\">AWAITING NEXT DATE</span><h3>", escapeHtml_(item.recurrence && item.recurrence.title || item.sourceEventId), "</h3><p>This selection stays saved. It is hidden publicly until Central finds another matching date.</p></div>", "", "</div></article>",
      ].join("");
    }
    var image = overrides.image && overrides.image.url ?
      overrides.image.url : source.imageUrl;
    return [
      "<article class=\"embeds-panel embeds-selected-event", source.featured ? " is-featured" : "", "\"><div class=\"embeds-selected-top\"><div><span>", source.featured ? "CENTRAL FEATURED" : (seriesSources.length > 1 ? "RECURRING SERIES · " + String(seriesSources.length) + " UPCOMING INSTANCES" : "EVENT " + String(index + 1)), "</span><h3>", escapeHtml_(overrides.title || source.title), "</h3><p>", escapeHtml_([overrides.date || source.date, overrides.time || source.time].filter(Boolean).join(" · ")), "</p>", source.featured ? "<small class=\"embeds-series-help\">Featured automatically from the Central Featured tag in Planning Center.</small>" : (seriesSources.length > 1 ? "<small class=\"embeds-series-help\">The next date in this series appears automatically. These overrides continue applying as the series advances.</small>" : ""), "</div>", "", "</div>",
      "<div class=\"embeds-fields\">",
      renderOverrideInput_(item, "title", "Title", source.title),
      renderOverrideInput_(item, "date", "Date", source.date),
      renderOverrideInput_(item, "time", "Time", source.time),
      renderOverrideInput_(item, "location", "Location", source.location),
      "<label class=\"is-wide\"><span>Description</span><textarea rows=\"4\" maxlength=\"2400\" data-embed-item-id=\"", escapeAttr_(item.sourceEventId), "\" data-embed-item-field=\"description\" data-focus-key=\"description\" placeholder=\"", escapeAttr_(source.description || "No Central description"), "\">", escapeHtml_(overrides.description || ""), "</textarea><small>", overrides.description ? "Embed override" : "Using current Central description", "</small></label>",
      "</div><div class=\"embeds-image-editor\"><div class=\"embeds-image-preview", image ? "" : " is-empty", "\">", image ? "<img src=\"" + escapeAttr_(image) + "\" alt=\"\">" : "<span>No event graphic</span>", "</div><div><strong>Event graphic</strong><p>", overrides.image ? "Custom image for this embed only." : "Using the current Central graphic when available.", "</p><div class=\"embeds-image-actions\"><label class=\"embeds-button is-small embeds-upload-button", state.imageUploadingId === item.sourceEventId ? " is-disabled" : "", "\">", state.imageUploadingId === item.sourceEventId ? "Uploading…" : "Upload Custom Graphic", "<input type=\"file\" accept=\"image/jpeg,image/png,image/webp\" data-embed-image-input data-source-event-id=\"", escapeAttr_(item.sourceEventId), "\"", state.imageUploadingId === item.sourceEventId ? " disabled" : "", "></label>", overrides.image ? "<button type=\"button\" class=\"embeds-button is-small\" data-embeds-action=\"use-source-image\" data-source-event-id=\"" + escapeAttr_(item.sourceEventId) + "\">Use Existing Graphic</button>" : "", "</div></div></div></article>",
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

  function getEmbedCode_(id, staticHtml, type) {
    var htmlEndpoint = getHtmlEndpoint_(id);
    var publishedHtml = String(staticHtml || "").trim();
    var isGroups = normalizeEmbedType_(type) === "groups";
    var fallbackUrl = isGroups ? GROUPS_DIRECTORY_URL : htmlEndpoint;
    var fallbackLabel = isGroups ? "Browse all CrossPointe groups" :
      (publishedHtml ? "View the latest CrossPointe events" :
        "View upcoming CrossPointe events");
    var staticContent = publishedHtml ? indentEmbedHtml_(publishedHtml) + "\n" : "";
    staticContent += "  <p class=\"central-embed-source\"><a href=\"" +
      fallbackUrl + "\">" + fallbackLabel + "</a></p>\n";
    return [
      "<link rel=\"stylesheet\" href=\"", window.location.origin,
      "/embed.css\" data-central-embed-styles>\n",
      "<div class=\"central-embed\" data-central-embed=\"", id, "\">\n",
      staticContent,
      "</div>\n",
      "<script async src=\"", window.location.origin, "/embed.js\"></script>",
    ].join("");
  }

  function indentEmbedHtml_(html) {
    return String(html || "").trim().replace(/></g, ">\n<")
        .split("\n").map(function(line) {
          return "  " + line;
        }).join("\n");
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
    state.working = true;
    state.error = "";
    var type = getEmbedType_(embed);
    state.message = type === "groups" ? "Preparing Groups Embed code…" :
      "Preparing crawlable event HTML…";
    render_();
    fetch(getHtmlEndpoint_(id) + "?styles=0", {
      cache: "no-store",
      headers: {Accept: "text/html"},
    }).then(function(response) {
      if (!response.ok) {
        throw new Error("The published embed HTML could not be loaded.");
      }
      return response.text();
    }).then(function(html) {
      if (html.indexOf("central-embed-root") === -1) {
        throw new Error("The published event HTML was incomplete.");
      }
      return copyText_(
          getEmbedCode_(id, html, type),
          type === "groups" ? "Groups Embed code copied." :
            "Crawlable embed code copied with the current event HTML.",
      );
    }).catch(showError_).finally(function() {
      state.working = false;
      render_();
    });
  }

  function copyText_(value, message) {
    var promise = navigator.clipboard && navigator.clipboard.writeText ?
      navigator.clipboard.writeText(value) :
      Promise.reject(new Error("Clipboard unavailable."));
    return promise.then(function() {
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
    var status = root.querySelector("[data-draft-status]");
    if (status) status.textContent = "Unsaved changes";
    window.clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(updatePreview_, 180);
  }

  function rememberSavedEmbed_(embed) {
    state.savedEmbeds[embed.id] = JSON.parse(JSON.stringify(embed));
  }

  function discardActiveChanges_() {
    var saved = state.savedEmbeds[state.activeId];
    if (saved) state.embeds = state.embeds.map(function(embed) {
      return embed.id === saved.id ? JSON.parse(JSON.stringify(saved)) : embed;
    });
    state.dirty = false;
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
    var normalized = normalizeEmbed_(embed);
    rememberSavedEmbed_(normalized);
    state.embeds = state.embeds.map(function(item) {
      return item.id === normalized.id ? normalized : item;
    });
  }

  function normalizeEmbed_(embed) {
    var normalized = embed && typeof embed === "object" ? embed : {};
    normalized.type = normalizeEmbedType_(normalized.type);
    if (normalized.type === "groups") {
      normalized.draft = normalized.draft &&
        typeof normalized.draft === "object" ? normalized.draft : {};
      normalized.draft.theme = normalizeTheme_(normalized.draft.theme);
      return normalized;
    }
    normalized.draft = normalized.draft &&
      typeof normalized.draft === "object" ? normalized.draft : {};
    normalized.draft.layout = normalized.draft.layout === "compact" ?
      "compact" : "standard";
    normalized.draft.items = Array.isArray(normalized.draft.items) ?
      normalized.draft.items : [];
    return normalized;
  }

  function normalizeEmbedType_(type) {
    return type === "groups" ? "groups" : "events";
  }

  function getEmbedType_(embed) {
    return normalizeEmbedType_(embed && embed.type);
  }

  function normalizeTheme_(theme) {
    return theme === "dark" || theme === "responsive" ? theme : "light";
  }

  function getEmbedTheme_(embed) {
    return normalizeTheme_(embed && embed.draft && embed.draft.theme);
  }

  function themeLabel_(theme) {
    var normalized = normalizeTheme_(theme);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
    if (getEmbedType_(embed) !== "events") return;
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
