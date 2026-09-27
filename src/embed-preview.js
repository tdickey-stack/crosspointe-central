/*
 * Browser-only draft preview helpers. This module intentionally imports the
 * production resolver so an unsaved editor preview follows the same selection,
 * recurrence, Featured, override, and ordering rules as a published embed.
 */
import {
  flattenCentralEmbedSourceEvents,
  normalizeCentralEmbedDraft,
} from "../functions/embeds/payload.js";
import {
  renderCentralEmbedHtml,
  resolveCentralEmbedEvents,
} from "../functions/embeds/render.js";

function string_(value) {
  return String(value == null ? "" : value);
}

function escapeHtml_(value) {
  return string_(value).replace(/[&<>"']/g, function(character) {
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character];
  });
}

function normalizedOrigin_(value) {
  try {
    var url = new URL(string_(value));
    return url.protocol === "https:" || url.protocol === "http:" ?
      url.origin : "";
  } catch (_error) {
    return "";
  }
}

// The Admin event feed has used both public API field names and Central's
// snake_case source names. Convert either shape to the shared resolver input.
function sourceGroups_(normalizedSourceEvents) {
  var sources = Array.isArray(normalizedSourceEvents) ?
    normalizedSourceEvents :
    flattenCentralEmbedSourceEvents(normalizedSourceEvents);
  return {upcoming: sources.map(function(source) {
    source = source && typeof source === "object" ? source : {};
    return {
      id: string_(source.id),
      planning_center_event_id: string_(source.seriesId || source.planningCenterEventId || source.planning_center_event_id),
      planning_center_title: string_(source.seriesTitle || source.planningCenterTitle || source.planning_center_title),
      title: string_(source.title),
      date: string_(source.date),
      time: string_(source.time),
      starts_at: string_(source.startsAt || source.starts_at),
      ends_at: string_(source.endsAt || source.ends_at),
      location: string_(source.location),
      description: string_(source.description),
      image_url: string_(source.imageUrl || source.image_url),
      registration_url: string_(source.registrationUrl || source.registration_url),
      button_url: string_(source.buttonUrl || source.button_url),
      church_center_url: string_(source.churchCenterUrl || source.church_center_url),
      button_text: string_(source.buttonText || source.button_text),
      featured: source.featured === true ||
        string_(source.featured).trim().toUpperCase() === "TRUE",
    };
  })};
}

function originalItems_(draft, normalized) {
  var rawItems = draft && Array.isArray(draft.items) ? draft.items : [];
  var claimed = new Set();
  return normalized.items.map(function(item) {
    var rawIndex = rawItems.findIndex(function(raw, index) {
      return !claimed.has(index) && raw &&
        string_(raw.sourceEventId).trim() === item.sourceEventId;
    });
    if (rawIndex >= 0) claimed.add(rawIndex);
    return rawIndex >= 0 ? rawItems[rawIndex] : item;
  });
}

function resolve(draft, normalizedSourceEvents) {
  return resolveCentralEmbedEvents(draft, sourceGroups_(normalizedSourceEvents));
}

function selections(draft, normalizedSourceEvents) {
  var normalized = normalizeCentralEmbedDraft(draft);
  var items = originalItems_(draft, normalized);
  var resolved = resolve(normalized, normalizedSourceEvents);
  var seen = new Set();
  var ordered = resolved.map(function(event) {
    var match = /^event-(\d+)-/.exec(string_(event.key));
    var index = match ? Number(match[1]) - 1 : -1;
    if (index >= 0) seen.add(index);
    return {item: items[index] || normalized.items[index], event: event};
  });
  normalized.items.forEach(function(item, index) {
    if (!seen.has(index)) ordered.push({item: items[index] || item, event: null});
  });
  return ordered;
}

function document_(id, draft, normalizedSourceEvents, origin) {
  var safeOrigin = normalizedOrigin_(origin);
  var html = renderCentralEmbedHtml(id, resolve(draft, normalizedSourceEvents), {
    includeStyles: false,
    layout: draft && draft.layout,
  });
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<link rel=\"stylesheet\" href=\"" + escapeHtml_(safeOrigin + "/embed.css") +
    "\"></head><body><div data-central-embed=\"draft-preview\" " +
    "data-central-embed-static-preview=\"true\">" + html + "</div>" +
    "<script src=\"" + escapeHtml_(safeOrigin + "/embed.js") +
    "\"></script></body></html>";
}

window.CentralEmbedPreview = {resolve: resolve, selections: selections, document: document_};
