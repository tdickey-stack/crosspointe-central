/* eslint-disable require-jsdoc */

const PROMOTIONS_COLLECTION_PATH = "centralAdmin/root/homePromotions";
const SOURCE_TYPES = Object.freeze([
  "events",
  "registrations",
  "campaigns",
  "serveNeeds",
]);
const SOURCE_TYPE_SET = new Set(SOURCE_TYPES);
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EXPLICIT_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export class HomePromotionError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "HomePromotionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createHomePromotionsService(options = {}) {
  const firestore = requireObject_(options.firestore, "firestore");
  const timestampFromMillis = requireFunction_(
      options.timestampFromMillis,
      "timestampFromMillis",
  );
  const serverTimestamp = requireFunction_(
      options.serverTimestamp,
      "serverTimestamp",
  );
  const now = typeof options.now === "function" ? options.now : Date.now;
  const collection = firestore.collection(PROMOTIONS_COLLECTION_PATH);

  async function loadRecords_(currentOnly = false, nowMs = 0) {
    const query = currentOnly ? collection.where(
        "endsAt",
        ">",
        timestampFromMillis(nowMs),
    ) : collection;
    const snapshot = await query.get();
    return snapshot.docs
        .map((document) => normalizeStoredPromotion_(
            document.id,
            document.data(),
        ))
        .filter(Boolean)
        .sort(comparePromotionRecords_);
  }

  return {
    async list(publicData) {
      const nowMs = normalizeNow_(now());
      const records = await loadRecords_();
      return buildHomePromotionsAdminProjection(records, publicData, nowMs);
    },

    async publicProjection(publicData) {
      const nowMs = normalizeNow_(now());
      // A single-field range query avoids rereading expired history on every
      // anonymous Central request. Active state and ordering stay in memory,
      // so this needs no composite index.
      const records = await loadRecords_(true, nowMs);
      return resolveHomePromotionHighlights(records, publicData, nowMs);
    },

    async save(item, actor, publicData) {
      const input = normalizePromotionInput_(item);
      const normalizedActor = normalizeActor_(actor);
      const nowMs = normalizeNow_(now());
      const candidates = getHomePromotionCandidates(publicData, nowMs);
      const eligibleCandidate = candidates.find((candidate) => {
        return candidate.key === sourceKey_(input.sourceType, input.sourceId) &&
          candidate.eligible;
      });

      if (input.active && !eligibleCandidate) {
        throw new HomePromotionError(
            "promotion-source-unavailable",
            "That source is not currently eligible for a Home highlight.",
            404,
        );
      }

      const reference = collection.doc(input.id);
      const transactionResult = await firestore.runTransaction(
          async (transaction) => {
            const [existingSnapshot, allSnapshot] = await Promise.all([
              transaction.get(reference),
              transaction.get(collection),
            ]);
            const existing = existingSnapshot.exists ?
              normalizeStoredPromotion_(
                  existingSnapshot.id || input.id,
                  existingSnapshot.data(),
              ) :
              null;

            if (!eligibleCandidate && !existing) {
              throw new HomePromotionError(
                  "promotion-source-unavailable",
                  "That source is not currently eligible for a Home " +
                    "highlight.",
                  404,
              );
            }

            if (existing && input.revision === 0 &&
              samePromotionValues_(existing, input)) {
              return {idempotent: true, item: existing};
            }

            if (!existing && input.revision !== 0) {
              throw revisionConflict_(input.id, 0);
            }
            if (existing && input.revision !== existing.revision) {
              throw revisionConflict_(input.id, existing.revision);
            }
            if (existing && (
              existing.sourceType !== input.sourceType ||
              existing.sourceId !== input.sourceId
            )) {
              throw new HomePromotionError(
                  "invalid-source",
                  "A saved promotion's source cannot be changed. " +
                    "Deactivate it and create a new promotion.",
                  400,
              );
            }

            const allRecords = allSnapshot.docs
                .map((document) => normalizeStoredPromotion_(
                    document.id,
                    document.data(),
                ))
                .filter(Boolean);
            if (input.active && allRecords.some((record) => {
              return record.id !== input.id && record.active &&
                record.sourceType === input.sourceType &&
                record.sourceId === input.sourceId &&
                rangesOverlap_(
                    input.startsAtMs,
                    input.endsAtMs,
                    record.startsAtMs,
                    record.endsAtMs,
                );
            })) {
              throw new HomePromotionError(
                  "promotion-source-overlap",
                  "This source already has an overlapping active Home " +
                    "promotion.",
                  409,
              );
            }

            const revision = existing ? existing.revision + 1 : 1;
            const write = {
              schemaVersion: 1,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              startsAt: timestampFromMillis(input.startsAtMs),
              endsAt: timestampFromMillis(input.endsAtMs),
              order: input.order,
              active: input.active,
              revision,
              createdAt: existing && existingSnapshot.get("createdAt") ||
                serverTimestamp(),
              createdByUid: existing ?
                String(existingSnapshot.get("createdByUid") || "") :
                normalizedActor.uid,
              updatedAt: serverTimestamp(),
              updatedByUid: normalizedActor.uid,
              updatedByEmail: normalizedActor.email,
              updatedByDisplayName: normalizedActor.displayName,
            };
            transaction.set(reference, write);
            return {
              idempotent: false,
              item: normalizeStoredPromotion_(input.id, {
                ...write,
                createdAt: existing && existing.createdAt || "",
                updatedAt: "",
              }),
            };
          },
      );

      return transactionResult.item;
    },
  };
}

export function buildHomePromotionsAdminProjection(
    promotions,
    publicData,
    now = Date.now(),
) {
  const nowMs = normalizeNow_(now);
  const records = normalizePromotionRecords_(promotions);
  const candidates = getHomePromotionCandidates(publicData, nowMs);
  const candidateByKey = new Map(candidates.map((candidate) => {
    return [candidate.key, candidate];
  }));
  const items = records.map((record) => {
    const key = sourceKey_(record.sourceType, record.sourceId);
    const candidate = candidateByKey.get(key);
    return serializePromotion_(record, {
      sourceTitle: candidate && candidate.title || "",
      sourceAvailable: Boolean(candidate && candidate.eligible),
      scheduleState: getScheduleState_(record, nowMs),
    });
  });

  return {
    items,
    candidates,
    highlights: resolveHomePromotionHighlights(records, publicData, nowMs),
    warnings: buildHomePromotionOverlapWarnings(records, nowMs),
  };
}

export function getHomePromotionCandidates(publicData, now = Date.now()) {
  const candidates = getHomePromotionSourceCandidates_(publicData, now);
  return candidates.map((candidate) => ({
    key: candidate.key,
    type: candidate.type,
    id: candidate.id,
    title: candidate.title,
    eligible: candidate.eligible,
    unavailableReason: candidate.unavailableReason,
  }));
}

function getHomePromotionSourceCandidates_(publicData, now = Date.now()) {
  const data = publicData && typeof publicData === "object" ? publicData : {};
  const nowMs = normalizeNow_(now);
  const featuredEnabled = isEnabled_(
      data.settings && data.settings.featured_event_enabled,
      false,
  );
  const featuredId = featuredEnabled ? String(
      data.featuredEvent && (
        data.featuredEvent.planning_center_instance_id ||
        data.featuredEvent.id
      ) || "",
  ).trim() : "";
  const candidates = [];
  const seen = new Set();

  for (const type of SOURCE_TYPES) {
    if (!isHomepageModuleEnabled_(data, type)) continue;
    const items = Array.isArray(data[type]) ? data[type] : [];
    for (const item of items) {
      if (!item || isDisabled_(item.active) || isDisabled_(item.published)) {
        continue;
      }
      const id = String(
          type === "events" ?
            item.planning_center_instance_id || item.id || "" :
            item.id || "",
      ).trim();
      const title = String(
          (type === "serveNeeds" ? item.need : item.title) || "",
      ).trim();
      if (!SAFE_ID_PATTERN.test(id) || !title) continue;
      if (type === "events") {
        const deadline = Date.parse(item.ends_at || item.starts_at || "");
        if (!Number.isFinite(deadline) || deadline <= nowMs) continue;
      }
      if (type === "campaigns" &&
        !isCampaignCurrentlyVisible_(item, nowMs)) {
        continue;
      }
      const key = sourceKey_(type, id);
      if (seen.has(key)) continue;
      seen.add(key);
      const featured = type === "events" && id === featuredId;
      candidates.push({
        key,
        type,
        id,
        title,
        eligible: !featured,
        unavailableReason: featured ? "featured-event" : "",
        item,
      });
    }
  }

  return candidates;
}

export function resolveHomePromotionHighlights(
    promotions,
    publicData,
    now = Date.now(),
) {
  const nowMs = normalizeNow_(now);
  const candidates = getHomePromotionSourceCandidates_(publicData, nowMs);
  const eligibleCandidates = candidates.filter((candidate) => {
    return candidate.eligible;
  });
  const byKey = new Map(eligibleCandidates.map((candidate) => {
    return [candidate.key, candidate];
  }));
  const seenSources = new Set();
  const scheduled = normalizePromotionRecords_(promotions)
      .filter((record) => record.active &&
        record.startsAtMs <= nowMs && nowMs < record.endsAtMs)
      .sort(comparePromotionRecords_)
      .flatMap((record) => {
        const key = sourceKey_(record.sourceType, record.sourceId);
        const candidate = byKey.get(key);
        if (!candidate || seenSources.has(key)) return [];
        seenSources.add(key);
        return [{
          selection: "scheduled",
          promotionId: record.id,
          key,
          type: record.sourceType,
          id: record.sourceId,
          title: candidate.title,
          startsAt: toIso_(record.startsAtMs),
          endsAt: toIso_(record.endsAtMs),
          order: record.order,
          item: candidate.item,
        }];
      })
      .slice(0, 3);

  if (scheduled.length === 3) return scheduled;

  const automaticDefaults = [
    nextAutomaticEvent_(eligibleCandidates, nowMs),
    newestAutomaticCandidate_(eligibleCandidates, "campaigns"),
    newestAutomaticCandidate_(eligibleCandidates, "serveNeeds"),
  ].filter(Boolean);

  for (const candidate of automaticDefaults) {
    if (scheduled.length === 3) break;
    if (seenSources.has(candidate.key)) continue;
    seenSources.add(candidate.key);
    scheduled.push(automaticHighlight_(candidate));
  }

  return scheduled;
}

export function buildHomePromotionOverlapWarnings(
    promotions,
    now = Date.now(),
) {
  const nowMs = normalizeNow_(now);
  const records = normalizePromotionRecords_(promotions)
      .filter((record) => record.active && record.endsAtMs > nowMs);
  const points = [...new Set(records.flatMap((record) => [
    Math.max(record.startsAtMs, nowMs),
    record.endsAtMs,
  ]))].sort((left, right) => left - right);
  const segments = [];

  for (let index = 0; index < points.length - 1; index++) {
    const startsAtMs = points[index];
    const endsAtMs = points[index + 1];
    if (startsAtMs >= endsAtMs) continue;
    const promotionIds = records
        .filter((record) => record.startsAtMs <= startsAtMs &&
          startsAtMs < record.endsAtMs)
        .map((record) => record.id)
        .sort();
    if (promotionIds.length <= 3) continue;
    const previous = segments[segments.length - 1];
    if (previous && previous.endsAtMs === startsAtMs &&
      previous.promotionIds.join("\n") === promotionIds.join("\n")) {
      previous.endsAtMs = endsAtMs;
    } else {
      segments.push({startsAtMs, endsAtMs, promotionIds});
    }
  }

  return segments.map((segment) => ({
    code: "promotion-capacity-overlap",
    startsAt: toIso_(segment.startsAtMs),
    endsAt: toIso_(segment.endsAtMs),
    count: segment.promotionIds.length,
    promotionIds: segment.promotionIds,
    message: segment.promotionIds.length +
      " Home promotions overlap this window; only the first 3 by " +
      "display order will appear.",
  }));
}

function normalizePromotionInput_(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ?
    value : null;
  if (!source) {
    throw new HomePromotionError(
        "invalid-payload",
        "A Home promotion item is required.",
    );
  }
  const id = String(source.id || "").trim();
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new HomePromotionError(
        "invalid-promotion-id",
        "Promotion IDs must use 1–128 letters, numbers, underscores, or " +
          "hyphens.",
    );
  }
  const sourceType = String(source.sourceType || "").trim();
  const sourceId = String(source.sourceId || "").trim();
  if (!SOURCE_TYPE_SET.has(sourceType) || !SAFE_ID_PATTERN.test(sourceId)) {
    throw new HomePromotionError(
        "invalid-source",
        "Choose a supported public source item.",
    );
  }
  if (typeof source.active !== "boolean") {
    throw new HomePromotionError(
        "invalid-payload",
        "Promotion active state must be true or false.",
    );
  }
  const order = Number(source.order);
  const revision = Number(source.revision);
  if (!Number.isSafeInteger(order) || order < 0 || order > 999) {
    throw new HomePromotionError(
        "invalid-payload",
        "Display order must be a whole number from 0 through 999.",
    );
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new HomePromotionError(
        "invalid-payload",
        "Promotion revision must be a non-negative whole number.",
    );
  }
  const startsAtMs = parseExplicitIso_(source.startsAt);
  const endsAtMs = parseExplicitIso_(source.endsAt);
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) ||
    startsAtMs >= endsAtMs) {
    throw new HomePromotionError(
        "invalid-window",
        "Enter an explicit start and end timestamp, with the end after " +
          "the start.",
    );
  }
  return {
    id,
    sourceType,
    sourceId,
    startsAtMs,
    endsAtMs,
    order,
    active: source.active,
    revision,
  };
}

function normalizeStoredPromotion_(id, value) {
  const source = value && typeof value === "object" ? value : {};
  const normalizedId = String(id || "").trim();
  const sourceType = String(source.sourceType || "").trim();
  const sourceId = String(source.sourceId || "").trim();
  const startsAtMs = toMillis_(source.startsAt);
  const endsAtMs = toMillis_(source.endsAt);
  const order = Number(source.order);
  const revision = Number(source.revision);
  if (!SAFE_ID_PATTERN.test(normalizedId) ||
    !SOURCE_TYPE_SET.has(sourceType) ||
    !SAFE_ID_PATTERN.test(sourceId) ||
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(endsAtMs) ||
    startsAtMs >= endsAtMs ||
    !Number.isSafeInteger(order) || order < 0 || order > 999 ||
    !Number.isSafeInteger(revision) || revision < 1 ||
    typeof source.active !== "boolean") {
    return null;
  }
  return {
    id: normalizedId,
    sourceType,
    sourceId,
    startsAtMs,
    endsAtMs,
    order,
    active: source.active,
    revision,
    createdAt: serializeTimestamp_(source.createdAt),
    createdByUid: String(source.createdByUid || "").trim(),
    updatedAt: serializeTimestamp_(source.updatedAt),
    updatedByUid: String(source.updatedByUid || "").trim(),
    updatedByEmail: String(source.updatedByEmail || "").trim(),
    updatedByDisplayName: String(source.updatedByDisplayName || "").trim(),
  };
}

function normalizePromotionRecords_(values) {
  return (Array.isArray(values) ? values : [])
      .map((value) => value && Number.isFinite(value.startsAtMs) ? value :
        normalizeStoredPromotion_(value && value.id, value))
      .filter(Boolean);
}

function serializePromotion_(record, extra = {}) {
  return {
    id: record.id,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceKey: sourceKey_(record.sourceType, record.sourceId),
    sourceTitle: String(extra.sourceTitle || ""),
    sourceAvailable: extra.sourceAvailable === true,
    startsAt: toIso_(record.startsAtMs),
    endsAt: toIso_(record.endsAtMs),
    order: record.order,
    active: record.active,
    revision: record.revision,
    scheduleState: String(extra.scheduleState || ""),
    createdAt: record.createdAt || "",
    createdByUid: record.createdByUid || "",
    updatedAt: record.updatedAt || "",
    updatedByUid: record.updatedByUid || "",
    updatedByEmail: record.updatedByEmail || "",
    updatedByDisplayName: record.updatedByDisplayName || "",
  };
}

function getScheduleState_(record, nowMs) {
  if (!record.active) return "inactive";
  if (record.endsAtMs <= nowMs) return "expired";
  if (record.startsAtMs > nowMs) return "upcoming";
  return "active";
}

function isHomepageModuleEnabled_(data, type) {
  const modules = data.settings &&
    Array.isArray(data.settings.homepage_modules) ?
    data.settings.homepage_modules : [];
  const module = modules.find((item) => item && item.id === type);
  return !module || !isDisabled_(module.enabled);
}

function isCampaignCurrentlyVisible_(item, nowMs) {
  const source = item && typeof item === "object" ? item : {};
  if (isEnabled_(source.ongoing, false)) return true;
  const startDate = campaignDate_(source.start_date);
  const endDate = campaignDate_(source.end_date);
  if (!startDate && !endDate) return true;
  const today = chicagoDateKey_(nowMs);
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

function campaignDate_(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function chicagoDateKey_(milliseconds) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(milliseconds));
  const values = Object.fromEntries(parts.map((part) => {
    return [part.type, part.value];
  }));
  return values.year + "-" + values.month + "-" + values.day;
}

function comparePromotionRecords_(left, right) {
  return left.order - right.order ||
    left.startsAtMs - right.startsAtMs ||
    left.id.localeCompare(right.id);
}

function nextAutomaticEvent_(candidates, nowMs) {
  const first = candidates
      .filter((candidate) => candidate.type === "events")
      .map((candidate) => ({
        candidate,
        startsAtMs: Date.parse(candidate.item.starts_at || ""),
      }))
      .filter((entry) => Number.isFinite(entry.startsAtMs) &&
        entry.startsAtMs > nowMs)
      .sort((left, right) => left.startsAtMs - right.startsAtMs ||
        left.candidate.id.localeCompare(right.candidate.id))[0];
  return first ? first.candidate : null;
}

function newestAutomaticCandidate_(candidates, type) {
  const first = candidates
      .filter((candidate) => candidate.type === type)
      .map((candidate, index) => ({
        candidate,
        index,
        recency: getSourceRecencyMs_(candidate.item),
      }))
      .sort((left, right) => {
        const leftRecent = Number.isFinite(left.recency);
        const rightRecent = Number.isFinite(right.recency);
        if (leftRecent !== rightRecent) return leftRecent ? -1 : 1;
        if (leftRecent && left.recency !== right.recency) {
          return right.recency - left.recency;
        }
        return left.index - right.index ||
          left.candidate.id.localeCompare(right.candidate.id);
      })[0];
  return first ? first.candidate : null;
}

function getSourceRecencyMs_(item) {
  const source = item && typeof item === "object" ? item : {};
  const candidates = [
    source.published_at,
    source.publishedAt,
    source.created_at,
    source.createdAt,
    source.updated_at,
    source.updatedAt,
  ];
  for (const value of candidates) {
    const milliseconds = toMillis_(value);
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  return NaN;
}

function automaticHighlight_(candidate) {
  const result = {
    selection: "automatic",
    key: candidate.key,
    type: candidate.type,
    id: candidate.id,
    title: candidate.title,
    item: candidate.item,
  };
  if (candidate.type === "events") {
    const endsAtMs = Date.parse(candidate.item.starts_at || "");
    if (Number.isFinite(endsAtMs)) result.endsAt = toIso_(endsAtMs);
  }
  return result;
}

function samePromotionValues_(record, input) {
  return record.sourceType === input.sourceType &&
    record.sourceId === input.sourceId &&
    record.startsAtMs === input.startsAtMs &&
    record.endsAtMs === input.endsAtMs &&
    record.order === input.order &&
    record.active === input.active;
}

function revisionConflict_(id, currentRevision) {
  return new HomePromotionError(
      "promotion-revision-conflict",
      "This promotion changed after it was loaded. Refresh it and try again.",
      409,
      {id, currentRevision},
  );
}

function rangesOverlap_(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function sourceKey_(type, id) {
  return type + ":" + id;
}

function isDisabled_(value) {
  return value === false || /^(?:false|0|no|off)$/i.test(
      String(value == null ? "" : value).trim(),
  );
}

function isEnabled_(value, fallback) {
  if (value === true || value === false) return value;
  const normalized = String(value == null ? "" : value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseExplicitIso_(value) {
  const normalized = String(value || "").trim();
  if (!EXPLICIT_ISO_PATTERN.test(normalized)) return NaN;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? milliseconds : NaN;
}

function normalizeNow_(value) {
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(milliseconds) ? milliseconds : Date.now();
}

function toMillis_(value) {
  if (value && typeof value.toMillis === "function") {
    return Number(value.toMillis());
  }
  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const milliseconds = Date.parse(String(value || ""));
  return Number.isFinite(milliseconds) ? milliseconds : NaN;
}

function serializeTimestamp_(value) {
  const milliseconds = toMillis_(value);
  return Number.isFinite(milliseconds) ? toIso_(milliseconds) : "";
}

function toIso_(milliseconds) {
  return new Date(milliseconds).toISOString();
}

function normalizeActor_(value) {
  const source = value && typeof value === "object" ? value : {};
  const uid = String(source.uid || "").trim();
  if (!uid) {
    throw new HomePromotionError(
        "admin-access-required",
        "An active Central Admin account is required.",
        403,
    );
  }
  return {
    uid: uid.slice(0, 128),
    email: String(source.email || "").trim().toLowerCase().slice(0, 320),
    displayName: String(source.displayName || "").trim().slice(0, 160),
  };
}

function requireObject_(value, label) {
  if (!value || typeof value !== "object") {
    throw new TypeError(label + " is required.");
  }
  return value;
}

function requireFunction_(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(label + " is required.");
  }
  return value;
}

export {PROMOTIONS_COLLECTION_PATH, SOURCE_TYPES};
