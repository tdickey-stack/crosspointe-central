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

      resolved.push({
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

  return resolved;
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
  if (matches.length) return matches;
  const exact = sourceById.get(item.sourceEventId);
  return exact ? [exact] : [];
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

  return styles + [
    "<section class=\"central-embed-root central-embed-layout-",
    escapeAttr_(layout),
    "\" data-central-embed-layout=\"",
    escapeAttr_(layout),
    "\" data-central-embed-rendered=\"",
    safeId,
    "\" aria-label=\"CrossPointe events\">",
    "<div class=\"central-embed-grid\">",
    content,
    "</div>",
    "</section>",
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
