/* eslint-disable require-jsdoc */

export const CENTRAL_EMBED_COLLECTION_PATH = "centralEmbeds";
export const CENTRAL_EMBED_TYPE_EVENTS = "events";
export const CENTRAL_EMBED_LAYOUT_STANDARD = "standard";
export const CENTRAL_EMBED_LAYOUT_COMPACT = "compact";
export const CENTRAL_EMBED_ITEM_LIMIT = 100;
export const CENTRAL_EMBED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CENTRAL_EMBED_IMAGE_STORAGE_PREFIX = "central-embeds";

export function normalizeCentralEmbedName(value) {
  return normalizeText_(value, 100);
}

export function normalizeCentralEmbedId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^embed_[a-z0-9]{12,32}$/.test(normalized) ? normalized : "";
}

export function normalizeCentralEmbedDraft(sourceData) {
  const source = sourceData && typeof sourceData === "object" ?
    sourceData :
    {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const seenSelections = new Set();
  const seenSourceIds = new Set();
  const items = [];

  rawItems.slice(0, CENTRAL_EMBED_ITEM_LIMIT).forEach((rawItem) => {
    const item = rawItem && typeof rawItem === "object" ? rawItem : {};
    const sourceEventId = normalizeSourceEventId_(item.sourceEventId);
    if (!sourceEventId || seenSourceIds.has(sourceEventId)) {
      return;
    }

    const recurrence = normalizeCentralEmbedRecurrence(item.recurrence);
    const selectionKey = recurrence && recurrence.planningCenterEventId ?
      "series:" + recurrence.planningCenterEventId :
      recurrence && recurrence.title ?
        "title:" + recurrence.title.toLowerCase() :
        "event:" + sourceEventId;
    if (seenSelections.has(selectionKey)) return;
    seenSelections.add(selectionKey);
    seenSourceIds.add(sourceEventId);
    const overrides = item.overrides && typeof item.overrides === "object" ?
      item.overrides :
      {};
    items.push({
      sourceEventId,
      recurrence,
      overrides: {
        title: normalizeNullableText_(overrides.title, 180),
        date: normalizeNullableText_(overrides.date, 100),
        time: normalizeNullableText_(overrides.time, 100),
        location: normalizeNullableText_(overrides.location, 240),
        description: normalizeNullableLongText_(
            overrides.description,
            2400,
        ),
        image: normalizeCentralEmbedImageOverride(overrides.image),
      },
      order: items.length,
    });
  });

  return {
    layout: normalizeCentralEmbedLayout(source.layout),
    items,
  };
}

export function normalizeCentralEmbedRecurrence(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const planningCenterEventId = normalizeSourceEventId_(
      source.planningCenterEventId,
  );
  const title = normalizeText_(source.title, 180);
  if (!planningCenterEventId && !title) return null;
  return {planningCenterEventId, title};
}

export function normalizeCentralEmbedLayout(value) {
  return String(value || "").trim().toLowerCase() ===
    CENTRAL_EMBED_LAYOUT_COMPACT ?
    CENTRAL_EMBED_LAYOUT_COMPACT :
    CENTRAL_EMBED_LAYOUT_STANDARD;
}

export function normalizeCentralEmbedImageOverride(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) {
    return null;
  }

  const url = normalizeCentralEmbedImageUrl_(source.url);
  const storagePath = normalizeCentralEmbedStoragePath_(source.storagePath);
  if (!url || !storagePath) {
    return null;
  }

  return {url, storagePath};
}

export function serializeCentralEmbedAdminRecord(snapshot) {
  const source = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const draft = normalizeCentralEmbedDraft(source.draft);
  const published = source.published && typeof source.published === "object" ?
    normalizeCentralEmbedDraft(source.published) :
    null;

  return {
    id: normalizeCentralEmbedId(snapshot && snapshot.id),
    schemaVersion: 1,
    type: CENTRAL_EMBED_TYPE_EVENTS,
    name: normalizeCentralEmbedName(source.name) || "Untitled Event Embed",
    draft,
    published,
    publishedVersion: Math.max(0, Number(source.publishedVersion) || 0),
    createdAt: serializeTimestamp_(source.createdAt),
    updatedAt: serializeTimestamp_(source.updatedAt),
    publishedAt: serializeTimestamp_(source.publishedAt),
  };
}

export function flattenCentralEmbedSourceEvents(eventGroups) {
  const source = eventGroups && typeof eventGroups === "object" ?
    eventGroups :
    {};
  const seenIds = new Set();

  return []
      .concat(Array.isArray(source.today) ? source.today : [])
      .concat(Array.isArray(source.upcoming) ? source.upcoming : [])
      .filter((item) => {
        const id = normalizeSourceEventId_(item && item.id);
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .map(sanitizeCentralEmbedSourceEvent_);
}

function sanitizeCentralEmbedSourceEvent_(item) {
  const source = item && typeof item === "object" ? item : {};
  return {
    id: normalizeSourceEventId_(source.id),
    seriesId: normalizeSourceEventId_(source.planning_center_event_id),
    seriesTitle: normalizeText_(
        source.planning_center_title || source.title,
        180,
    ),
    title: normalizeText_(source.title, 180),
    date: normalizeText_(source.date, 100),
    time: normalizeText_(source.time, 100),
    startsAt: normalizeIsoDate_(source.starts_at),
    endsAt: normalizeIsoDate_(source.ends_at),
    location: normalizeText_(source.location, 240),
    description: normalizeLongText_(source.description, 2400),
    imageUrl: normalizePublicUrl_(source.image_url, 2000),
    registrationUrl: normalizePublicUrl_(source.registration_url, 2000),
    buttonUrl: normalizePublicUrl_(source.button_url, 2000),
    churchCenterUrl: normalizePublicUrl_(source.church_center_url, 2000),
    buttonText: normalizeText_(source.button_text, 80),
  };
}

function normalizeSourceEventId_(value) {
  const normalized = String(value || "").trim().slice(0, 160);
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : "";
}

function normalizeNullableText_(value, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return normalizeText_(value, maximum) || null;
}

function normalizeNullableLongText_(value, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return normalizeLongText_(value, maximum) || null;
}

function normalizeText_(value, maximum) {
  return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
}

function normalizeLongText_(value, maximum) {
  return String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
      .join("\n")
      .trim()
      .slice(0, maximum);
}

function normalizeCentralEmbedImageUrl_(value) {
  const normalized = String(value || "").trim().slice(0, 2000);
  if (
    /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i.test(
        normalized,
    ) ||
    /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):9199\/v0\/b\//i.test(
        normalized,
    )
  ) {
    return normalized;
  }
  return "";
}

function normalizeCentralEmbedStoragePath_(value) {
  const normalized = String(value || "").trim().slice(0, 500);
  return normalized.startsWith(CENTRAL_EMBED_IMAGE_STORAGE_PREFIX + "/") ?
    normalized :
    "";
}

function normalizePublicUrl_(value, maximum) {
  const normalized = String(value || "").trim().slice(0, maximum);
  return /^https?:\/\//i.test(normalized) ? normalized : "";
}

function normalizeIsoDate_(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function serializeTimestamp_(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const normalized = String(value || "").trim();
  return normalized && !Number.isNaN(new Date(normalized).getTime()) ?
    new Date(normalized).toISOString() :
    "";
}
