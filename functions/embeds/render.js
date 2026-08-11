/* eslint-disable require-jsdoc */

import {
  CENTRAL_EMBED_LAYOUT_COMPACT,
  flattenCentralEmbedSourceEvents,
  normalizeCentralEmbedLayout,
  normalizeCentralEmbedDraft,
} from "./payload.js";

export function resolveCentralEmbedEvents(publishedConfig, eventGroups) {
  const config = normalizeCentralEmbedDraft(publishedConfig);
  const sourceEvents = flattenCentralEmbedSourceEvents(eventGroups);
  const sourceById = new Map(sourceEvents.map((event) => [event.id, event]));
  const sourceOrderById = new Map(
      sourceEvents.map((event, index) => [event.id, index]),
  );
  const renderedSourceIds = new Set();
  const resolved = [];

  config.items.forEach((item, itemIndex) => {
    const sources = findCentralEmbedItemSources_(
        item,
        sourceEvents,
        sourceById,
    );
    sources.forEach((source) => {
      if (renderedSourceIds.has(source.id)) return;
      renderedSourceIds.add(source.id);
      const overrides = item.overrides || {};
      const hasScheduleOverride = overrides.date !== null ||
        overrides.time !== null;
      const actionUrl = source.registrationUrl ||
        source.buttonUrl ||
        source.churchCenterUrl;
      const sourceOrder = sourceOrderById.get(source.id);

      resolved.push({
        _sortStartsAtMs: getCentralEmbedSortTimestamp_(source),
        _sourceOrder: sourceOrder === undefined ?
          Number.MAX_SAFE_INTEGER : sourceOrder,
        _itemOrder: itemIndex,
        key: "event-" + String(itemIndex + 1) + "-" + source.id,
        title: overrides.title !== null ? overrides.title : source.title,
        date: overrides.date !== null ? overrides.date : source.date,
        time: overrides.time !== null ? overrides.time : source.time,
        startsAt: hasScheduleOverride ? "" : source.startsAt,
        endsAt: hasScheduleOverride ? "" : source.endsAt,
        location: overrides.location !== null ?
          overrides.location : source.location,
        description: overrides.description !== null ?
          overrides.description : source.description,
        imageUrl: overrides.image ? overrides.image.url : source.imageUrl,
        actionUrl,
        actionLabel: source.registrationUrl ?
          "Register" :
          (source.buttonText || "Learn More"),
      });
    });
  });

  return resolved
      .sort(compareResolvedCentralEmbedEvents_)
      .map(toPublicCentralEmbedEvent_);
}

function toPublicCentralEmbedEvent_(event) {
  const publicEvent = {...event};
  delete publicEvent._sortStartsAtMs;
  delete publicEvent._sourceOrder;
  delete publicEvent._itemOrder;
  return publicEvent;
}

function findCentralEmbedItemSources_(item, sourceEvents, sourceById) {
  const recurrence = item && item.recurrence;
  let matches = [];
  if (recurrence && recurrence.planningCenterEventId) {
    matches = sourceEvents.filter((source) => {
      return source.seriesId === recurrence.planningCenterEventId;
    });
  } else if (recurrence && recurrence.title) {
    const titleKey = normalizeSeriesTitle_(recurrence.title);
    matches = sourceEvents.filter((source) => {
      return normalizeSeriesTitle_(source.seriesTitle || source.title) ===
        titleKey;
    });
  }
  if (matches.length) {
    return [matches.slice().sort(compareCentralEmbedSources_)[0]];
  }
  const exact = sourceById.get(item.sourceEventId);
  return exact ? [exact] : [];
}

function compareCentralEmbedSources_(left, right) {
  const timeDifference = getCentralEmbedSortTimestamp_(left) -
    getCentralEmbedSortTimestamp_(right);
  if (Number.isFinite(timeDifference) && timeDifference !== 0) {
    return timeDifference;
  }
  return 0;
}

function compareResolvedCentralEmbedEvents_(left, right) {
  const timeDifference = left._sortStartsAtMs - right._sortStartsAtMs;
  if (Number.isFinite(timeDifference) && timeDifference !== 0) {
    return timeDifference;
  }
  if (left._sourceOrder !== right._sourceOrder) {
    return left._sourceOrder - right._sourceOrder;
  }
  if (left._itemOrder !== right._itemOrder) {
    return left._itemOrder - right._itemOrder;
  }
  return String(left.title || "").localeCompare(String(right.title || ""));
}

function getCentralEmbedSortTimestamp_(event) {
  const startsAtMs = Date.parse(String(event && event.startsAt || ""));
  if (Number.isFinite(startsAtMs)) return startsAtMs;
  const endsAtMs = Date.parse(String(event && event.endsAt || ""));
  return Number.isFinite(endsAtMs) ? endsAtMs : Number.POSITIVE_INFINITY;
}

function normalizeSeriesTitle_(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function renderCentralEmbedHtml(embedId, events, options = {}) {
  const safeId = escapeHtml_(embedId);
  const normalizedEvents = Array.isArray(events) ? events : [];
  const layout = normalizeCentralEmbedLayout(options.layout);
  const stylesUrl = normalizeHttpsOrLocalUrl_(options.stylesUrl);
  const styles = options.includeStyles !== false && stylesUrl ?
    "<link rel=\"stylesheet\" href=\"" +
      escapeAttr_(stylesUrl) + "\" data-central-embed-styles>" :
    "";
  const content = normalizedEvents.length ?
    normalizedEvents.map((event) => {
      return renderCentralEmbedEventHtml_(event, layout);
    }).join("") :
    "<p class=\"central-embed-empty\">No events are available right now.</p>";
  const controls = renderCentralEmbedControls_(layout, normalizedEvents.length);

  return styles + [
    "<section class=\"central-embed-root central-embed-layout-",
    escapeAttr_(layout),
    "\" data-central-embed-layout=\"",
    escapeAttr_(layout),
    "\" data-central-embed-rendered=\"",
    safeId,
    "\" aria-label=\"CrossPointe events\">",
    "<div class=\"central-embed-grid-viewport\">",
    "<div class=\"central-embed-grid\">",
    content,
    "</div>",
    "</div>",
    controls,
    "</section>",
  ].join("");
}

function renderCentralEmbedControls_(layout, eventCount) {
  if (eventCount <= 1) return "";
  if (layout === CENTRAL_EMBED_LAYOUT_COMPACT) {
    return [
      "<div class=\"central-embed-scroll-controls\" ",
      "aria-label=\"Scroll through events\">",
      "<button type=\"button\" data-central-embed-scroll=\"-1\" ",
      "aria-label=\"Previous events\" disabled>&larr;</button>",
      "<button type=\"button\" data-central-embed-scroll=\"1\" ",
      "aria-label=\"Next events\">&rarr;</button>",
      "</div>",
    ].join("");
  }
  return [
    "<div class=\"central-embed-more\">",
    "<button type=\"button\" data-central-embed-toggle ",
    "aria-expanded=\"false\">See More</button>",
    "</div>",
  ].join("");
}

function renderCentralEmbedEventHtml_(event, layout) {
  const dateTime = event.startsAt ?
    " datetime=\"" + escapeAttr_(event.startsAt) + "\"" :
    "";
  const schedule = [event.date, event.time].filter(Boolean).join(" · ");

  return [
    "<article class=\"central-embed-event\">",
    event.imageUrl ?
      "<div class=\"central-embed-media\"><img src=\"" +
        escapeAttr_(event.imageUrl) + "\" alt=\"" +
        escapeAttr_(event.title + " event graphic") +
        "\" loading=\"lazy\"></div>" :
      "",
    "<div class=\"central-embed-copy\">",
    schedule ?
      "<time class=\"central-embed-time\"" + dateTime + ">" +
        escapeHtml_(schedule) + "</time>" :
      "",
    "<h2 class=\"central-embed-title\">",
    escapeHtml_(event.title),
    "</h2>",
    event.location ?
      "<p class=\"central-embed-location\">" +
        escapeHtml_(event.location) + "</p>" :
      "",
    event.description && layout !== CENTRAL_EMBED_LAYOUT_COMPACT ?
      "<p class=\"central-embed-description\">" +
        escapeHtml_(event.description).replace(/\n/g, "<br>") + "</p>" :
      "",
    event.actionUrl ?
      "<a class=\"central-embed-action\" href=\"" +
        escapeAttr_(event.actionUrl) +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
        escapeHtml_(event.actionLabel) + "</a>" :
      "",
    "</div>",
    "</article>",
  ].join("");
}

function normalizeHttpsOrLocalUrl_(value) {
  const normalized = String(value || "").trim().slice(0, 2000);
  return /^(?:https?:\/\/|\/)/i.test(normalized) ? normalized : "";
}

function escapeHtml_(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function escapeAttr_(value) {
  return escapeHtml_(value);
}
