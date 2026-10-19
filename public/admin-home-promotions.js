const CHICAGO_ZONE = "America/Chicago";
const SOURCE_TYPES = Object.freeze({
  events: "Event",
  registrations: "Registration",
  campaigns: "Campaign",
  serveNeeds: "Serve Need",
});

const chicagoPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHICAGO_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const chicagoDisplayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

let mountSequence = 0;

export class HomePromotionsValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HomePromotionsValidationError";
    this.code = code;
  }
}

function partsFor(value) {
  return Object.fromEntries(chicagoPartsFormatter.formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]));
}

function parsedLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) {
    throw new HomePromotionsValidationError(
        "invalid-local-time",
        "Enter a complete date and time.",
    );
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day || check.getUTCHours() !== hour ||
      check.getUTCMinutes() !== minute) {
    throw new HomePromotionsValidationError(
        "invalid-local-time",
        "Enter a real calendar date and time.",
    );
  }
  return {year, month, day, hour, minute, value: match[0]};
}

function offsetText(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function localMatches(parts, local) {
  return Number(parts.year) === local.year && Number(parts.month) === local.month &&
    Number(parts.day) === local.day && Number(parts.hour) === local.hour &&
    Number(parts.minute) === local.minute;
}

/** Convert an America/Chicago datetime-local value to an ISO timestamp with offset. */
export function chicagoLocalToIso(value) {
  const local = parsedLocal(value);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const matches = [];
  // Quarter-hour offsets cover every current IANA zone and keep the conversion
  // independent of the browser's own local timezone.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(localAsUtc - offset * 60_000);
    if (localMatches(partsFor(instant), local)) matches.push({offset, instant});
  }
  if (!matches.length) {
    throw new HomePromotionsValidationError(
        "nonexistent-local-time",
        "That time does not exist in America/Chicago because the clock moves forward. Choose another time.",
    );
  }
  if (matches.length > 1) {
    throw new HomePromotionsValidationError(
        "ambiguous-local-time",
        "That time occurs twice in America/Chicago because the clock moves back. Choose a time outside the repeated hour.",
    );
  }
  return `${local.value}:00${offsetText(matches[0].offset)}`;
}

export function isoToChicagoLocal(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function instantToChicagoIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new HomePromotionsValidationError("invalid-instant", "The current time could not be determined.");
  }
  const parts = partsFor(date);
  const localAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  const instantSecond = Math.floor(date.getTime() / 1000) * 1000;
  const offset = Math.round((localAsUtc - instantSecond) / 60_000);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offsetText(offset)}`;
}

export function createPromotionId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  throw new Error("This browser cannot create a promotion ID.");
}

/** Build the exact POST body used by the admin API. */
export function buildPromotionPayload(form, now = new Date()) {
  const candidate = form?.candidate;
  if (!candidate || !SOURCE_TYPES[candidate.type]) {
    throw new HomePromotionsValidationError("candidate-required", "Choose something to promote.");
  }
  if (form.active !== false && candidate.eligible === false) {
    throw new HomePromotionsValidationError(
        "candidate-unavailable",
        candidate.unavailableReason === "featured-event" ?
          "That event is already the Home hero and cannot also be a highlight." :
          "That source is not available for Home.",
    );
  }
  const startsAt = form.startMode === "scheduled" ?
    chicagoLocalToIso(form.startsAtLocal) : instantToChicagoIso(now);
  const endsAt = chicagoLocalToIso(form.endsAtLocal);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new HomePromotionsValidationError(
        "invalid-window",
        "End must be later than start.",
    );
  }
  const order = Number(form.order);
  if (!Number.isInteger(order) || order < 0 || order > 999) {
    throw new HomePromotionsValidationError(
        "invalid-order",
        "Display priority must be a whole number from 0 to 999.",
    );
  }
  const id = String(form.id || "").trim();
  if (!id) throw new HomePromotionsValidationError("invalid-id", "A promotion ID is required.");
  return {
    item: {
      id,
      sourceType: candidate.type,
      sourceId: String(candidate.id),
      startsAt,
      endsAt,
      order,
      active: form.active !== false,
      revision: Number.isInteger(Number(form.revision)) ? Number(form.revision) : 0,
    },
  };
}

function responseData(value) {
  return {
    items: Array.isArray(value?.items) ? value.items : [],
    candidates: Array.isArray(value?.candidates) ? value.candidates : [],
    highlights: Array.isArray(value?.highlights) ? value.highlights : [],
    warnings: Array.isArray(value?.warnings) ? value.warnings : [],
  };
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attrs || {})) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function sourceKey(item) {
  return item?.sourceKey || `${item?.sourceType || item?.type}:${item?.sourceId || item?.id}`;
}

function sourceTitle(item) {
  return item?.sourceTitle || item?.title || item?.item?.title || "Untitled source";
}

function sourceLabel(type) {
  return SOURCE_TYPES[type] || "Source";
}

function formatChicago(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? chicagoDisplayFormatter.format(date) : "Unknown time";
}

export function highlightPresentation(highlight) {
  const automatic = highlight?.selection === "automatic";
  let timing = "";
  if (automatic && highlight?.endsAt) timing = `Eligible through ${formatChicago(highlight.endsAt)}`;
  if (!automatic && highlight?.endsAt) timing = `Through ${formatChicago(highlight.endsAt)}`;
  if (automatic && !highlight?.endsAt) timing = "Filled from current eligible content";
  return {selection: automatic ? "Automatic" : "Scheduled", timing};
}

function statusFor(item, now = Date.now()) {
  if (item?.sourceAvailable === false) return "unavailable";
  if (!item?.active || item?.scheduleState === "inactive") return "paused";
  if (item?.scheduleState) return item.scheduleState;
  if (Date.parse(item?.endsAt) <= now) return "expired";
  if (Date.parse(item?.startsAt) > now) return "upcoming";
  return "active";
}

function errorCode(error) {
  return error?.code || error?.data?.code || error?.response?.code || "";
}

function errorMessage(error) {
  const code = errorCode(error);
  if (code === "promotion-revision-conflict") {
    return "This promotion changed after you opened it. Your form is still here; retry to apply it to the latest revision.";
  }
  if (code === "promotion-source-overlap") return "That source already has an overlapping promotion window.";
  if (code === "promotion-source-unavailable") return "That source is no longer available for a Home highlight.";
  if (error instanceof HomePromotionsValidationError) return error.message;
  return error?.message || error?.error || "The schedule could not be saved. Try again.";
}

function wireItem(item) {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    order: Number(item.order),
    active: Boolean(item.active),
    revision: Number(item.revision || 0),
  };
}

export function mountHomePromotions(root, {request, canEdit = false} = {}) {
  if (!root || typeof root.replaceChildren !== "function") throw new TypeError("A root element is required.");
  if (typeof request !== "function") throw new TypeError("An authenticated request callback is required.");

  const editable = canEdit === true;
  const idPrefix = `home-promotions-${++mountSequence}`;
  let disposed = false;
  let data = responseData();
  let editingItem = null;
  let draftId = editable ? createPromotionId() : "readonly";
  let busy = false;
  let failed = null;
  const listeners = [];

  const heading = element("section", {className: "central-admin-hero home-promotions-hero"}, [
    element("div", {className: "central-admin-kicker", text: "Hub"}),
    element("h2", {text: "Home highlights"}),
    element("p", {text: "Schedule an Event, Registration, Campaign, or Serve Need. Saved schedules appear first, then open spots use the next Event, most recently published Campaign, and most recently published Serve Need. The featured hero event stays separate."}),
    element("p", {className: "home-promotions-boundary", text: "A promotion changes Home placement only. It never edits or removes the source item from its normal section."}),
  ]);

  if (!editable) {
    heading.append(element("div", {
      className: "home-promotions-readonly",
      text: "Read-only access. Homepage Edit & Publish access is required to save schedule changes.",
      attrs: {role: "status"},
    }));
  }

  const pageStatus = element("div", {
    className: "home-promotions-status",
    attrs: {role: "status", "aria-live": "polite"},
  });
  const retryButton = element("button", {
    className: "central-admin-link-button is-secondary",
    text: "Retry",
    attrs: {type: "button", hidden: ""},
  });
  pageStatus.append(retryButton);

  const previewList = element("div", {className: "home-promotions-preview-list"});
  const previewPanel = element("section", {className: "central-admin-panel home-promotions-preview"}, [
    element("div", {className: "central-admin-panel-header"}, [
      element("div", {}, [
        element("h3", {text: "On Home now"}),
        element("p", {text: "The highlights visitors see now, in display order."}),
      ]),
      element("span", {className: "central-admin-pill", text: "0 of 3"}),
    ]),
    previewList,
  ]);
  const previewCount = previewPanel.querySelector(".central-admin-pill");

  const formTitle = element("h3", {text: "Schedule a highlight"});
  const formNote = element("p", {text: "Saved schedules win; open spots fill automatically. Times are entered and displayed in Central time (America/Chicago), regardless of this device's timezone."});
  const typeFilter = element("select", {attrs: {id: `${idPrefix}-type-filter`}});
  for (const [value, label] of [["", "All source types"], ...Object.entries(SOURCE_TYPES)]) {
    typeFilter.append(element("option", {text: value ? `${label}s` : label, attrs: {value}}));
  }
  const searchInput = element("input", {attrs: {
    id: `${idPrefix}-search`, type: "search", placeholder: "Search titles", autocomplete: "off",
  }});
  const candidateSelect = element("select", {attrs: {id: `${idPrefix}-candidate`, required: ""}});
  const startNow = element("input", {attrs: {
    id: `${idPrefix}-start-now`, type: "radio", name: `${idPrefix}-start-mode`, value: "now", checked: "",
  }});
  const startScheduled = element("input", {attrs: {
    id: `${idPrefix}-start-scheduled`, type: "radio", name: `${idPrefix}-start-mode`, value: "scheduled",
  }});
  const startsInput = element("input", {attrs: {
    id: `${idPrefix}-starts`, type: "datetime-local", disabled: "",
  }});
  const endsInput = element("input", {attrs: {
    id: `${idPrefix}-ends`, type: "datetime-local", required: "",
  }});
  const orderInput = element("input", {attrs: {
    id: `${idPrefix}-order`, type: "number", min: "0", max: "999", step: "1", value: "1", required: "",
  }});
  const activeInput = element("input", {attrs: {
    id: `${idPrefix}-active`, type: "checkbox", checked: "",
  }});
  const formMessage = element("div", {
    className: "home-promotions-form-message",
    attrs: {role: "status", "aria-live": "polite"},
  });
  const saveButton = element("button", {
    className: "central-admin-link-button is-primary",
    text: "Save promotion",
    attrs: {type: "submit"},
  });
  const cancelButton = element("button", {
    className: "central-admin-link-button is-secondary",
    text: "Cancel edit",
    attrs: {type: "button", hidden: ""},
  });

  const form = element("form", {className: "home-promotions-form"}, [
    element("div", {className: "home-promotions-form-grid"}, [
      element("label", {className: "central-admin-field is-select"}, [
        element("span", {text: "Filter by source type"}), typeFilter,
      ]),
      element("label", {className: "central-admin-field"}, [
        element("span", {text: "Search sources"}), searchInput,
      ]),
      element("label", {className: "central-admin-field is-select home-promotions-wide"}, [
        element("span", {text: "Source to promote"}), candidateSelect,
        element("small", {text: "The current featured hero event cannot also be a highlight. Registrations can be scheduled here but are not selected automatically."}),
      ]),
      element("fieldset", {className: "home-promotions-start home-promotions-wide"}, [
        element("legend", {text: "Start"}),
        element("div", {className: "home-promotions-choice-row"}, [
          element("label", {className: "home-promotions-radio"}, [startNow, element("span", {text: "Now"})]),
          element("label", {className: "home-promotions-radio"}, [startScheduled, element("span", {text: "Schedule time"})]),
        ]),
      ]),
      element("label", {className: "central-admin-field"}, [
        element("span", {text: "Scheduled start — Central time"}), startsInput,
      ]),
      element("label", {className: "central-admin-field"}, [
        element("span", {text: "End — Central time"}), endsInput,
        element("small", {text: "Required. The scheduled priority ends at this time; the item may still appear automatically."}),
      ]),
      element("label", {className: "central-admin-field"}, [
        element("span", {text: "Display priority"}), orderInput,
        element("small", {text: "Lower numbers appear first. Only the first three eligible highlights appear on Home."}),
      ]),
      element("label", {className: "central-admin-checkbox home-promotions-enabled"}, [
        activeInput, element("span", {text: "Enabled"}),
        element("small", {text: "Outside its scheduled window, or when paused, an eligible item may still appear automatically. Scheduling controls priority placement."}),
      ]),
    ]),
    formMessage,
    element("div", {className: "central-admin-action-row"}, [saveButton, cancelButton]),
  ]);

  const formPanel = element("section", {className: "central-admin-panel home-promotions-editor"}, [
    element("div", {className: "central-admin-panel-header"}, [element("div", {}, [formTitle, formNote])]),
    form,
  ]);

  const warningsList = element("div", {className: "home-promotions-warning-list"});
  const warningsPanel = element("section", {className: "central-admin-panel home-promotions-warnings"}, [
    element("div", {className: "central-admin-panel-header"}, [
      element("div", {}, [
        element("h3", {text: "Capacity check"}),
        element("p", {text: "When more than three saved schedules overlap, priority decides which three appear. Automatic choices fill only the spots left open."}),
      ]),
    ]),
    warningsList,
  ]);

  const savedList = element("div", {className: "home-promotions-saved-list"});
  const savedPanel = element("section", {className: "central-admin-panel home-promotions-saved"}, [
    element("div", {className: "central-admin-panel-header"}, [
      element("div", {}, [
        element("h3", {text: "Current and upcoming schedule"}),
        element("p", {text: "Expired, paused, and unavailable records remain visible for context."}),
      ]),
    ]),
    savedList,
  ]);

  root.replaceChildren(element("div", {className: "home-promotions"}, [
    heading,
    pageStatus,
    element("div", {className: "home-promotions-top-grid"}, [previewPanel, formPanel]),
    warningsPanel,
    savedPanel,
  ]));

  function listen(node, event, handler) {
    node.addEventListener(event, handler);
    listeners.push(() => node.removeEventListener(event, handler));
  }

  function setPageStatus(message = "", tone = "", retry = false) {
    pageStatus.className = `home-promotions-status${tone ? ` is-${tone}` : ""}`;
    if (!message && !retry) {
      pageStatus.replaceChildren();
      retryButton.setAttribute("hidden", "");
      return;
    }
    pageStatus.replaceChildren(element("span", {text: message}));
    if (retry) {
      retryButton.removeAttribute("hidden");
      pageStatus.append(retryButton);
    } else {
      retryButton.setAttribute("hidden", "");
    }
  }

  function setFormMessage(message = "", tone = "") {
    formMessage.className = `home-promotions-form-message${tone ? ` is-${tone}` : ""}`;
    formMessage.textContent = message;
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value || !editable;
    saveButton.textContent = value ? "Saving…" : "Save promotion";
  }

  function filteredCandidates() {
    const type = typeFilter.value;
    const search = searchInput.value.trim().toLocaleLowerCase();
    return data.candidates.filter((candidate) =>
      (!type || candidate.type === type) &&
      (!search || String(candidate.title || "").toLocaleLowerCase().includes(search)));
  }

  function renderCandidateOptions() {
    const selected = candidateSelect.value || (editingItem && sourceKey(editingItem)) || "";
    candidateSelect.replaceChildren(element("option", {text: "Choose a source", attrs: {value: ""}}));
    const candidates = filteredCandidates();
    for (const candidate of candidates) {
      const reason = candidate.unavailableReason === "featured-event" ? " — featured hero" :
        candidate.eligible === false ? " — unavailable" : "";
      const option = element("option", {
        text: `${sourceLabel(candidate.type)} · ${candidate.title}${reason}`,
        attrs: {value: candidate.key},
      });
      if (candidate.eligible === false) option.disabled = true;
      candidateSelect.append(option);
    }
    if (selected && ![...candidateSelect.options].some((option) => option.value === selected)) {
      const record = editingItem && sourceKey(editingItem) === selected ? editingItem : null;
      candidateSelect.append(element("option", {
        text: record ? `${sourceLabel(record.sourceType)} · ${sourceTitle(record)} — unavailable` : "Selected source — outside filter",
        attrs: {value: selected},
      }));
    }
    candidateSelect.value = selected;
  }

  function renderPreview() {
    previewCount.textContent = `${data.highlights.length} of 3`;
    previewList.replaceChildren();
    if (!data.highlights.length) {
      previewList.append(element("p", {className: "home-promotions-empty", text: "No eligible highlights are available right now. Automatic spots look for the next Event, most recently published Campaign, and most recently published Serve Need."}));
      return;
    }
    data.highlights.slice(0, 3).forEach((highlight, index) => {
      const presentation = highlightPresentation(highlight);
      const copy = element("div", {}, [
        element("div", {className: "home-promotions-preview-meta"}, [
          element("small", {text: sourceLabel(highlight.type)}),
          element("span", {
            className: `home-promotions-selection is-${highlight.selection === "automatic" ? "automatic" : "scheduled"}`,
            text: presentation.selection,
          }),
        ]),
        element("strong", {text: sourceTitle(highlight)}),
      ]);
      if (presentation.timing) copy.append(element("span", {text: presentation.timing}));
      previewList.append(element("article", {className: "home-promotions-preview-card"}, [
        element("span", {className: "home-promotions-slot", text: String(index + 1), attrs: {"aria-label": `Home position ${index + 1}`}}),
        copy,
      ]));
    });
  }

  function renderWarnings() {
    warningsList.replaceChildren();
    if (!data.warnings.length) {
      warningsList.append(element("p", {className: "home-promotions-empty is-safe", text: "No saved window currently exceeds the three-highlight capacity."}));
      return;
    }
    const itemsById = new Map(data.items.map((item) => [item.id, item]));
    for (const warning of data.warnings) {
      const priority = (warning.promotionIds || []).map((id) => itemsById.get(id)).filter(Boolean)
          .sort((left, right) => Number(left.order) - Number(right.order));
      const article = element("article", {className: "home-promotions-warning"}, [
        element("strong", {text: warning.message || `${warning.count || priority.length} promotions overlap this window.`}),
        element("span", {text: `${formatChicago(warning.startsAt)} to ${formatChicago(warning.endsAt)}`}),
      ]);
      if (priority.length) {
        article.append(element("small", {
          text: `Priority: ${priority.map((item) => `${sourceTitle(item)} (${item.order})`).join(" → ")}. The first three eligible items can appear.`,
        }));
      }
      warningsList.append(article);
    }
  }

  function renderSaved() {
    savedList.replaceChildren();
    if (!data.items.length) {
      savedList.append(element("p", {className: "home-promotions-empty", text: "No Home promotions have been scheduled."}));
      return;
    }
    const rank = {active: 0, upcoming: 1, paused: 2, unavailable: 3, expired: 4};
    const items = [...data.items].sort((left, right) =>
      (rank[statusFor(left)] ?? 9) - (rank[statusFor(right)] ?? 9) ||
      Date.parse(left.startsAt) - Date.parse(right.startsAt) || Number(left.order) - Number(right.order));
    for (const item of items) {
      const status = statusFor(item);
      const statusText = status === "active" ? "Current" : status[0].toUpperCase() + status.slice(1);
      const actions = element("div", {className: "home-promotions-item-actions"});
      const editButton = element("button", {
        className: "central-admin-link-button is-secondary",
        text: editable ? "Edit" : "View",
        attrs: {
          type: "button", "data-action": "edit", "data-id": item.id,
          "aria-label": `${editable ? "Edit" : "View"} ${sourceTitle(item)}`,
        },
      });
      actions.append(editButton);
      if (editable) {
        actions.append(element("button", {
          className: "central-admin-link-button is-secondary",
          text: item.active ? "Pause" : "Resume",
          attrs: {
            type: "button", "data-action": "toggle", "data-id": item.id,
            "aria-label": `${item.active ? "Pause" : "Resume"} ${sourceTitle(item)}`,
          },
        }));
      }
      savedList.append(element("article", {className: "home-promotions-item"}, [
        element("div", {className: "home-promotions-item-copy"}, [
          element("div", {className: "home-promotions-item-heading"}, [
            element("strong", {text: sourceTitle(item)}),
            element("span", {className: `home-promotions-state is-${status}`, text: statusText}),
          ]),
          element("span", {text: `${sourceLabel(item.sourceType)} · Priority ${item.order}`}),
          element("small", {text: `${formatChicago(item.startsAt)} → ${formatChicago(item.endsAt)}`}),
        ]),
        actions,
      ]));
    }
  }

  function renderData() {
    renderCandidateOptions();
    renderPreview();
    renderWarnings();
    renderSaved();
  }

  function resetForm() {
    editingItem = null;
    draftId = editable ? createPromotionId() : "readonly";
    form.reset();
    startNow.checked = true;
    startsInput.disabled = true;
    startsInput.required = false;
    activeInput.checked = true;
    orderInput.value = "1";
    formTitle.textContent = "Schedule a highlight";
    cancelButton.setAttribute("hidden", "");
    setFormMessage();
    renderCandidateOptions();
  }

  function editItem(item) {
    editingItem = item;
    draftId = item.id;
    typeFilter.value = "";
    searchInput.value = "";
    renderCandidateOptions();
    candidateSelect.value = sourceKey(item);
    const future = Date.parse(item.startsAt) > Date.now();
    startScheduled.checked = future;
    startNow.checked = !future;
    startsInput.disabled = !future || !editable;
    startsInput.required = future;
    startsInput.value = isoToChicagoLocal(item.startsAt);
    endsInput.value = isoToChicagoLocal(item.endsAt);
    orderInput.value = String(item.order ?? 1);
    activeInput.checked = Boolean(item.active);
    formTitle.textContent = editable ? `Edit ${sourceTitle(item)}` : sourceTitle(item);
    cancelButton.toggleAttribute("hidden", !editable);
    setFormMessage(item.sourceAvailable === false ? "This source is unavailable and cannot appear on Home." : "");
    form.scrollIntoView?.({behavior: "smooth", block: "start"});
  }

  function applyResponse(value) {
    const editingId = editingItem?.id;
    data = responseData(value);
    if (editingId) editingItem = data.items.find((item) => item.id === editingId) || editingItem;
    renderData();
  }

  async function load({quiet = false} = {}) {
    if (!quiet) setPageStatus("Loading Home highlights…");
    try {
      const value = await request("GET");
      if (disposed) return null;
      applyResponse(value);
      if (!quiet) setPageStatus();
      return value;
    } catch (error) {
      if (disposed) return null;
      failed = {kind: "load"};
      setPageStatus(errorMessage(error), "error", true);
      return null;
    }
  }

  async function savePayload(payload, {reset = false} = {}) {
    if (!editable || busy) return;
    setBusy(true);
    setFormMessage("Saving…");
    try {
      const value = await request("POST", payload);
      if (disposed) return;
      applyResponse(value);
      failed = null;
      setPageStatus(value?.message || "Promotion schedule saved.", "success");
      if (reset) resetForm();
      else setFormMessage();
    } catch (error) {
      if (disposed) return;
      failed = {kind: "save", payload, reset, conflict: errorCode(error) === "promotion-revision-conflict"};
      setFormMessage(errorMessage(error), "error");
      setPageStatus("The schedule was not changed.", "error", true);
    } finally {
      if (!disposed) setBusy(false);
    }
  }

  async function retryFailure() {
    if (!failed || busy) return;
    if (failed.kind === "load") {
      await load();
      return;
    }
    const retry = failed;
    if (retry.conflict) {
      const latest = await load({quiet: true});
      if (!latest) return;
      const current = data.items.find((item) => item.id === retry.payload.item.id);
      if (!current) {
        setFormMessage("That promotion no longer exists. Your form has been kept.", "error");
        return;
      }
      retry.payload = {item: {...retry.payload.item, revision: Number(current.revision || 0)}};
    }
    await savePayload(retry.payload, {reset: retry.reset});
  }

  listen(typeFilter, "change", renderCandidateOptions);
  listen(searchInput, "input", renderCandidateOptions);
  listen(form, "change", (event) => {
    if (event.target?.name !== `${idPrefix}-start-mode`) return;
    const scheduled = startScheduled.checked;
    startsInput.disabled = !scheduled;
    startsInput.required = scheduled;
  });
  listen(cancelButton, "click", resetForm);
  listen(retryButton, "click", retryFailure);
  listen(form, "submit", (event) => {
    event.preventDefault();
    if (!editable || busy) return;
    const candidate = data.candidates.find((entry) => entry.key === candidateSelect.value) ||
      (editingItem && sourceKey(editingItem) === candidateSelect.value ? {
        key: sourceKey(editingItem), type: editingItem.sourceType, id: editingItem.sourceId,
        title: sourceTitle(editingItem), eligible: editingItem.sourceAvailable !== false,
      } : null);
    try {
      const now = new Date();
      const preserveCurrentStart = editingItem && startNow.checked && Date.parse(editingItem.startsAt) <= now.getTime();
      const payload = buildPromotionPayload({
        id: draftId,
        revision: editingItem?.revision || 0,
        candidate,
        startMode: startScheduled.checked ? "scheduled" : "now",
        startsAtLocal: startsInput.value,
        endsAtLocal: endsInput.value,
        order: orderInput.value,
        active: activeInput.checked,
      }, now);
      if (preserveCurrentStart) payload.item.startsAt = editingItem.startsAt;
      savePayload(payload, {reset: true});
    } catch (error) {
      setFormMessage(errorMessage(error), "error");
    }
  });
  listen(savedList, "click", (event) => {
    const button = event.target.closest?.("button[data-action]");
    if (!button) return;
    const item = data.items.find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === "edit") editItem(item);
    if (button.dataset.action === "toggle" && editable) {
      savePayload({item: {...wireItem(item), active: !item.active}}, {reset: false});
    }
  });

  for (const control of form.elements) control.disabled = control.disabled || !editable;
  if (editable) {
    startsInput.disabled = true;
    saveButton.disabled = false;
  }
  renderData();
  load();

  return () => {
    disposed = true;
    for (const remove of listeners.splice(0)) remove();
    root.replaceChildren();
  };
}
