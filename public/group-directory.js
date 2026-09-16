const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function normalizedText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function locationTags(group) {
  return (Array.isArray(group && group.locationTags) ? group.locationTags : [])
      .filter((label) => typeof label === "string" && label.trim())
      .map((label) => label.trim());
}

function validMeetingDays(group) {
  const values = Array.isArray(group && group.meetingDays) ?
    group.meetingDays : [];
  return [...new Set(values.filter((day) =>
    Number.isInteger(day) && day >= 0 && day <= 6,
  ))];
}

function namedOptions(groups, readLabel) {
  const labels = new Map();
  groups.forEach((group) => {
    const label = String(readLabel(group) || "").trim();
    const value = normalizedText(label);
    if (value && !labels.has(value)) labels.set(value, label);
  });
  return [...labels.entries()]
      .map(([value, label]) => ({value, label}))
      .sort((left, right) => left.label.localeCompare(right.label));
}

export function deriveGroupFilterOptions(groups) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const dayValues = new Set();
  safeGroups.forEach((group) => {
    validMeetingDays(group).forEach((day) => dayValues.add(day));
  });
  return {
    types: namedOptions(safeGroups, (group) => group && group.type && group.type.name),
    days: [...dayValues]
        .sort((left, right) => left - right)
        .map((value) => ({value: String(value), label: DAY_NAMES[value]})),
    locations: namedOptions(safeGroups.flatMap(locationTags), (label) => label),
  };
}

export function filterGroups(groups, filters = {}) {
  const query = normalizedText(filters.search);
  const type = normalizedText(filters.type);
  const location = normalizedText(filters.location);
  const requestedDay = filters.day === "" || filters.day == null ?
    null : Number(filters.day);
  const hasDayFilter = Number.isInteger(requestedDay) &&
    requestedDay >= 0 && requestedDay <= 6;

  return (Array.isArray(groups) ? groups : []).filter((group) => {
    if (!group || typeof group !== "object") return false;
    const groupType = normalizedText(group.type && group.type.name);
    const groupLocations = locationTags(group).map(normalizedText);
    if (type && groupType !== type) return false;
    if (location && !groupLocations.includes(location)) return false;

    const days = validMeetingDays(group);
    if (hasDayFilter && !days.includes(requestedDay)) {
      return false;
    }

    if (!query) return true;
    return [
      group.name,
      group.type && group.type.name,
      group.schedule,
      group.location,
      ...locationTags(group),
    ].some((value) => normalizedText(value).includes(query));
  });
}

export function getSafeChurchCenterUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLocaleLowerCase();
    if (url.protocol !== "https:") return "";
    if (hostname !== "churchcenter.com" &&
        !hostname.endsWith(".churchcenter.com")) return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}

export function getSafeImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch (_error) {
    return "";
  }
}

function createElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createSelectField(label, name, allLabel, options) {
  const field = createElement("label", "group-directory-field");
  const labelNode = createElement("span", "group-directory-label", label);
  const select = createElement("select", "group-directory-select");
  select.name = name;
  select.setAttribute("data-group-filter", name);
  select.append(new Option(allLabel, ""));
  options.forEach((option) => {
    select.append(new Option(option.label, option.value));
  });
  field.append(labelNode, select);
  return {field, select};
}

function createIcon(kind) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("group-card-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("d", kind === "location" ?
    "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5.5 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" :
    "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z");
  icon.append(path);
  return icon;
}

function createMetaLine(kind, text) {
  const line = createElement("p", "group-card-meta");
  line.append(createIcon(kind), document.createTextNode(text));
  return line;
}

function createGroupMedia(group, eager = false) {
  const media = createElement("div", "group-card-media is-fallback");
  const fallback = createElement("span", "group-card-fallback", "CP");
  fallback.setAttribute("aria-hidden", "true");
  media.append(fallback);

  const imageUrl = getSafeImageUrl(group.imageUrl);
  if (imageUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = eager ? "eager" : "lazy";
    image.decoding = "async";
    image.src = imageUrl;
    image.addEventListener("load", () => media.classList.remove("is-fallback"));
    image.addEventListener("error", () => {
      image.remove();
      media.classList.add("is-fallback");
    });
    media.prepend(image);
  }

  const attendance = ["Drop-ins welcome", "Connect before visiting"]
      .includes(group.attendance) ? group.attendance : "";
  if (attendance) {
    const pill = createElement("p", "group-card-attendance", attendance);
    pill.classList.add(attendance === "Drop-ins welcome" ?
      "is-drop-in" : "is-connect-first");
    media.append(pill);
  }

  return media;
}

function createGroupCard(group, openDetails) {
  const card = createElement("article", "group-card");
  const media = createGroupMedia(group);
  const copy = createElement("div", "group-card-copy");
  const typeName = String(group.type && group.type.name || "").trim();
  if (typeName) copy.append(createElement("p", "group-card-type", typeName));
  copy.append(createElement("h2", "group-card-title", group.name || "Group"));

  const details = createElement("div", "group-card-details");
  const schedule = String(group.schedule || "").trim();
  const location = String(group.location || "").trim();
  if (schedule) details.append(createMetaLine("schedule", schedule));
  if (location) details.append(createMetaLine("location", location));
  if (details.childElementCount > 0) copy.append(details);

  const action = createElement("button", "group-card-action", "View Group Details");
  action.type = "button";
  action.setAttribute("aria-label", `View details for ${group.name || "this group"}`);
  action.setAttribute("aria-haspopup", "dialog");
  action.addEventListener("click", () => openDetails(group, action));
  copy.append(action);

  card.append(media, copy);
  return card;
}

let dialogSequence = 0;

function createGroupDialog(root) {
  const dialog = createElement("dialog", "group-dialog");
  const panel = createElement("div", "group-dialog-panel");
  const titleId = `group-dialog-title-${++dialogSequence}`;
  dialog.setAttribute("aria-labelledby", titleId);
  const header = createElement("div", "group-dialog-header");
  header.append(createElement("span", "group-dialog-eyebrow", "Group details"));
  const close = createElement("button", "group-dialog-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close group details");
  close.autofocus = true;
  header.append(close);
  const scroll = createElement("div", "group-dialog-scroll");
  const footer = createElement("div", "group-dialog-footer");
  panel.append(header, scroll, footer);
  dialog.append(panel);
  root.append(dialog);
  let opener = null;
  let previousOverflow = "";
  let locked = false;
  let closeTimer = null;

  function resetClosing() {
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    closeTimer = null;
    dialog.classList.remove("is-closing");
  }

  function release() {
    resetClosing();
    if (locked) document.documentElement.style.overflow = previousOverflow;
    locked = false;
    if (opener && opener.isConnected) opener.focus({preventScroll: true});
    opener = null;
  }
  function finishClose() {
    if (dialog.open) dialog.close();
    release();
  }

  function requestClose() {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    dialog.classList.add("is-closing");
    // Match Central's event-details modal, including its completion fallback.
    closeTimer = window.setTimeout(finishClose, 1150);
  }

  panel.addEventListener("animationend", (event) => {
    if (event.target === panel && event.animationName === "groupDialogCardLiftOut") {
      finishClose();
    }
  });
  close.addEventListener("click", requestClose);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) release();
  });
  let startedOnBackdrop = false;
  const outside = (event) => {
    const rect = panel.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener("pointerdown", (event) => {
    startedOnBackdrop = event.target === dialog && outside(event);
  });
  dialog.addEventListener("click", (event) => {
    if (startedOnBackdrop && event.target === dialog && outside(event)) requestClose();
    startedOnBackdrop = false;
  });

  function open(group, trigger) {
    resetClosing();
    const name = group.name || "Group";
    const copy = createElement("div", "group-dialog-copy");
    const typeName = String(group.type && group.type.name || "").trim();
    if (typeName) copy.append(createElement("p", "group-card-type", typeName));
    const title = createElement("h2", "group-dialog-title", name);
    title.id = titleId;
    copy.append(title);
    const details = createElement("div", "group-card-details");
    if (group.schedule) details.append(createMetaLine("schedule", group.schedule));
    if (group.location) details.append(createMetaLine("location", group.location));
    if (details.childElementCount) copy.append(details);
    const attendanceMessage = group.attendance === "Drop-ins welcome" ?
      "You’re welcome to drop in. You don’t need online roster approval to attend." :
      group.attendance === "Connect before visiting" ?
        "Please connect with the group before attending. Open Church Center below to get in touch." : "";
    if (attendanceMessage) {
      copy.append(createElement("p", "group-dialog-attendance-note", attendanceMessage));
    }
    copy.append(createElement("h3", "group-dialog-section-title", "About this group"));
    const description = String(group.description || "").trim();
    copy.append(createElement("p", "group-dialog-description", description ||
      "More information is available on this group’s Church Center page."));
    scroll.replaceChildren(createGroupMedia(group, true), copy);
    footer.replaceChildren();
    const destination = getSafeChurchCenterUrl(group.url);
    if (destination) {
      footer.append(createElement("p", "group-dialog-handoff-note",
        "Contact the group or request access to its online roster in Church Center. Roster approval is separate from attending."));
      const action = createElement("a", "group-card-action group-dialog-action", "Open in Church Center");
      action.href = destination;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      const arrow = createElement("span", "group-card-action-arrow", "↗");
      arrow.setAttribute("aria-hidden", "true");
      action.append(arrow);
      const newTab = createElement("span", "group-directory-sr-only", " (opens in a new tab)");
      action.append(newTab);
      footer.append(action);
    } else {
      footer.append(createElement("p", "group-dialog-handoff-note",
        "This group’s Church Center link is currently unavailable."));
    }
    opener = trigger;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    locked = true;
    dialog.showModal();
    scroll.scrollTop = 0;
  }

  return {open, destroy() {
    finishClose();
    dialog.remove();
  }};
}

function renderStatus(root, options) {
  root.replaceChildren();
  const status = createElement(
      "div",
      `group-directory-status is-${options.kind}`,
  );
  status.setAttribute("role", options.kind === "error" ? "alert" : "status");
  const copy = createElement("div");
  copy.append(
      createElement("strong", "", options.title),
      createElement("p", "", options.message),
  );
  const fallbackUrl = getSafeChurchCenterUrl(options.fallbackUrl);
  if (fallbackUrl) {
    const paragraph = createElement("p");
    const link = createElement("a", "group-directory-fallback", "Browse groups in Church Center");
    link.href = fallbackUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    paragraph.append(link);
    copy.append(paragraph);
  }
  if (options.kind === "loading") {
    const spinner = createElement("span", "group-directory-spinner");
    spinner.setAttribute("aria-hidden", "true");
    status.prepend(spinner);
  }
  status.append(copy);
  if (typeof options.action === "function") {
    const button = createElement("button", "group-directory-retry", options.actionLabel || "Try again");
    button.type = "button";
    button.addEventListener("click", options.action);
    status.append(button);
  }
  root.append(status);
}

function renderDirectory(root, groups) {
  root.replaceChildren();
  const options = deriveGroupFilterOptions(groups);
  const toolbar = createElement("div", "group-directory-toolbar");
  const searchField = createElement("label", "group-directory-field is-search");
  searchField.append(createElement("span", "group-directory-label", "Search groups"));
  const search = document.createElement("input");
  search.type = "search";
  search.name = "search";
  search.placeholder = "Search by name, type, or place";
  search.autocomplete = "off";
  search.setAttribute("data-group-filter", "search");
  searchField.append(search);

  const typeField = createSelectField("Group type", "type", "All types", options.types);
  const dayField = createSelectField("Meeting day", "day", "Any day", options.days);
  const locationField = createSelectField(
      "Location type",
      "location",
      "All locations",
      options.locations,
  );
  locationField.field.hidden = options.locations.length === 0;
  toolbar.classList.toggle("has-location-filter", options.locations.length > 0);

  const clearButton = createElement("button", "group-directory-clear", "Clear filters");
  clearButton.type = "button";
  clearButton.disabled = true;
  toolbar.append(
      searchField,
      typeField.field,
      dayField.field,
      locationField.field,
      clearButton,
  );

  const summary = createElement("div", "group-directory-summary");
  const count = createElement("p", "group-directory-count");
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");
  count.setAttribute("aria-atomic", "true");
  const dayHint = createElement(
      "p",
      "group-directory-hint",
      "Days reflect published schedules; see details for groups without a set day.",
  );
  summary.append(count, dayHint);

  const results = createElement("div", "group-directory-results");
  results.setAttribute("aria-label", "Group results");
  const empty = createElement("div", "group-directory-empty");
  const filters = {search: "", type: "", day: "", location: ""};
  const inputs = [search, typeField.select, dayField.select, locationField.select];

  function update() {
    inputs.forEach((input) => {
      filters[input.name] = input.value;
    });
    const visibleGroups = filterGroups(groups, filters);
    const hasFilters = Object.values(filters).some(Boolean);
    clearButton.disabled = !hasFilters;
    count.textContent = `${visibleGroups.length} ${visibleGroups.length === 1 ? "group" : "groups"}`;
    results.replaceChildren(...visibleGroups.map((group) =>
      createGroupCard(group, modal.open)));
    empty.replaceChildren();
    if (visibleGroups.length === 0) {
      empty.append(
          createElement("h2", "", "No groups match those filters."),
          createElement("p", "", "Try a different search or clear the filters to see every group."),
      );
      const reset = createElement("button", "group-directory-retry", "Clear filters");
      reset.type = "button";
      reset.addEventListener("click", clearFilters);
      empty.append(reset);
    }
  }

  function clearFilters() {
    inputs.forEach((input) => {
      input.value = "";
    });
    update();
    search.focus();
  }

  inputs.forEach((input) => input.addEventListener(
      input === search ? "input" : "change",
      update,
  ));
  clearButton.addEventListener("click", clearFilters);

  root.append(toolbar, summary, results, empty);
  const modal = createGroupDialog(root);
  update();
  return () => modal.destroy();
}

export async function mountGroupDirectory(root, options = {}) {
  if (!root) throw new Error("A group directory root element is required.");
  const endpoint = options.endpoint || "/api/groups";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  let dispose = null;
  let controller = null;
  let generation = 0;
  let destroyed = false;

  async function load() {
    if (destroyed) return;
    const current = ++generation;
    if (controller) controller.abort();
    if (dispose) dispose();
    dispose = null;
    renderStatus(root, {
      kind: "loading",
      title: "Loading groups",
      message: "Gathering the latest group details…",
    });
    let timeoutId = null;
    controller = null;
    try {
      if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable.");
      if (typeof AbortController === "function") {
        controller = new AbortController();
        const requestController = controller;
        timeoutId = globalThis.setTimeout(() => requestController.abort(), 65000);
      }
      const response = await fetchImpl(endpoint, {
        headers: {Accept: "application/json"},
        cache: "no-store",
        ...(controller ? {signal: controller.signal} : {}),
      });
      if (!response.ok) throw new Error(`Groups endpoint returned ${response.status}.`);
      const payload = await response.json();
      if (destroyed || current !== generation) return;
      if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.groups)) {
        throw new Error("Groups endpoint returned an unsupported response.");
      }
      if (payload.groups.length === 0) {
        renderStatus(root, {
          kind: "empty",
          title: "No groups are listed right now.",
          message: "Check back soon as new groups and gathering details are added.",
        });
        return;
      }
      dispose = renderDirectory(root, payload.groups);
    } catch (_error) {
      if (destroyed || current !== generation) return;
      renderStatus(root, {
        kind: "error",
        title: "We couldn’t load groups.",
        message: "Check your connection, then try again.",
        action: load,
        actionLabel: "Try again",
        fallbackUrl: options.fallbackUrl,
      });
    } finally {
      if (timeoutId != null) globalThis.clearTimeout(timeoutId);
    }
  }

  await load();
  return {reload: load, destroy() {
    destroyed = true;
    generation++;
    if (controller) controller.abort();
    if (dispose) dispose();
    root.replaceChildren();
  }};
}
