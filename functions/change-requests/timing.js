export const CHANGE_REQUEST_REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;

const MAX_DIGEST_ITEMS = 12;

/**
 * Returns whether a pending request's reminder timestamp is due.
 *
 * @param {*} request Change Request document data.
 * @param {*} now Current clock value.
 * @return {boolean} Whether the request should be included in a reminder.
 */
export function isChangeRequestReminderDue(request, now = Date.now()) {
  const source = request && typeof request === "object" ? request : {};
  if (String(source.status || "").trim().toLowerCase() !== "pending") {
    return false;
  }

  const dueAtMs = toTimestampMs(
      source.nextReminderAtMs === undefined ?
        source.nextReminderAt : source.nextReminderAtMs,
  );
  const nowMs = toTimestampMs(now);
  return Number.isFinite(dueAtMs) && Number.isFinite(nowMs) &&
    dueAtMs <= nowMs;
}

/**
 * Calculates the first reminder time relative to request creation.
 *
 * @param {*} createdAt Request creation timestamp.
 * @param {number} intervalMs Reminder cadence.
 * @return {number} Due time in milliseconds.
 */
export function getFirstChangeRequestReminderAtMs(
    createdAt,
    intervalMs = CHANGE_REQUEST_REMINDER_INTERVAL_MS,
) {
  const createdAtMs = toTimestampMs(createdAt);
  const normalizedIntervalMs = normalizeInterval_(intervalMs);
  if (!Number.isFinite(createdAtMs)) {
    throw new Error("A valid Change Request creation time is required.");
  }
  return createdAtMs + normalizedIntervalMs;
}

/**
 * Calculates the next reminder time from a successful queue/send time.
 *
 * This intentionally avoids replaying every missed 48-hour slot after an
 * outage. A late reminder starts a fresh 48-hour interval.
 *
 * @param {*} processedAt Successful processing timestamp.
 * @param {number} intervalMs Reminder cadence.
 * @return {number} Next due time in milliseconds.
 */
export function getNextChangeRequestReminderAtMs(
    processedAt,
    intervalMs = CHANGE_REQUEST_REMINDER_INTERVAL_MS,
) {
  const processedAtMs = toTimestampMs(processedAt);
  const normalizedIntervalMs = normalizeInterval_(intervalMs);
  if (!Number.isFinite(processedAtMs)) {
    throw new Error("A valid Change Request reminder time is required.");
  }
  return processedAtMs + normalizedIntervalMs;
}

/**
 * Creates the atomic state update used when a due reminder event is queued.
 *
 * @param {*} request Current Change Request data.
 * @param {*} queuedAt Queue timestamp.
 * @param {number} intervalMs Reminder cadence.
 * @return {Object} Reminder fields to merge into the request.
 */
export function buildQueuedReminderState(
    request,
    queuedAt = Date.now(),
    intervalMs = CHANGE_REQUEST_REMINDER_INTERVAL_MS,
) {
  const source = request && typeof request === "object" ? request : {};
  const currentSequence = Number(source.reminderSequence || 0);
  const reminderSequence = Number.isSafeInteger(currentSequence) &&
    currentSequence >= 0 ? currentSequence + 1 : 1;
  const queuedAtMs = toTimestampMs(queuedAt);

  if (!Number.isFinite(queuedAtMs)) {
    throw new Error("A valid Change Request reminder queue time is required.");
  }

  return {
    reminderSequence,
    lastReminderQueuedAtMs: queuedAtMs,
    nextReminderAtMs: getNextChangeRequestReminderAtMs(
        queuedAtMs,
        intervalMs,
    ),
  };
}

/**
 * Builds a provider-neutral digest without exposing the stored request payload.
 *
 * @param {Object} input Digest inputs.
 * @return {Object} Normalized digest model.
 */
export function buildChangeRequestNotificationDigest(input) {
  const source = input && typeof input === "object" ? input : {};
  const eventType = String(source.eventType || "submitted")
      .trim()
      .toLowerCase();
  const maximum = Math.max(
      1,
      Math.min(MAX_DIGEST_ITEMS, Number(source.maxItems) || MAX_DIGEST_ITEMS),
  );
  const requests = Array.isArray(source.requests) ? source.requests : [];
  const pendingItems = requests.map(normalizeDigestItem_)
      .filter(Boolean)
      .sort((left, right) => left.createdAtMs - right.createdAtMs);
  const items = pendingItems.slice(0, maximum);

  if (!items.length) {
    throw new Error("At least one pending Change Request is required.");
  }

  const isReminder = eventType === "reminder";
  if (!isReminder && eventType !== "submitted") {
    throw new Error("Choose submitted or reminder for the digest event.");
  }

  const actionUrl = normalizeActionUrl_(source.actionUrl);
  const omittedCount = Math.max(0, pendingItems.length - items.length);
  const subject = isReminder ?
    buildCountLabel_(items.length, "Change Request") + " Awaiting Review" :
    "New Change Request: " + items[0].summary;

  return {
    eventType,
    subject,
    title: isReminder ? "Change Requests Awaiting Review" :
      "New Change Request",
    lead: isReminder ?
      buildCountLabel_(items.length, "request") + " still need review." :
      "A new request was submitted for approval.",
    actionLabel: items.length === 1 ? "Review Change Request" :
      "Review Change Requests",
    actionUrl,
    items,
    omittedCount,
  };
}

/**
 * Formats a provider-neutral digest as bounded plain text.
 *
 * @param {*} digest Digest model.
 * @return {string} Plain-text message.
 */
export function formatChangeRequestNotificationDigestText(digest) {
  const source = digest && typeof digest === "object" ? digest : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const lines = [String(source.lead || source.title || "").trim(), ""];

  items.forEach((item) => {
    lines.push("- " + item.summary);
    lines.push("  Section: " + item.sectionLabel);
    lines.push("  Submitted by: " + item.submitterLabel);
  });

  if (Number(source.omittedCount || 0) > 0) {
    lines.push("");
    lines.push("Plus " + String(source.omittedCount) + " more pending.");
  }
  if (source.actionUrl) {
    lines.push("");
    lines.push(String(source.actionLabel || "Review requests") + ":");
    lines.push(String(source.actionUrl));
  }

  return lines.join("\n").trim();
}

/**
 * Converts Firestore, Date, ISO, or numeric values to milliseconds.
 *
 * @param {*} value Timestamp-like value.
 * @return {number} Milliseconds, or NaN for invalid values.
 */
export function toTimestampMs(value) {
  if (value && typeof value.toMillis === "function") {
    return Number(value.toMillis());
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number(value);
  if (typeof value === "string" && value.trim()) {
    return Date.parse(value);
  }
  return NaN;
}

/**
 * Normalizes a request into the safe subset used by notifications.
 *
 * @param {*} request Change Request data.
 * @param {number} index Source index.
 * @return {Object|null} Digest item or null.
 */
function normalizeDigestItem_(request, index) {
  const source = request && typeof request === "object" ? request : {};
  if (String(source.status || "pending").trim().toLowerCase() !== "pending") {
    return null;
  }

  const id = boundedText_(source.id || source.requestId, 500) ||
    "request-" + String(index + 1);
  const summary = boundedText_(source.summary, 240) || "Untitled request";
  const sectionLabel = boundedText_(
      source.sectionLabel || source.section,
      120,
  ) || "Unknown";
  const submitterLabel = boundedText_(
      source.submittedByName || source.submittedByEmail,
      160,
  ) || "Unknown submitter";
  const createdAtMs = toTimestampMs(source.createdAt);

  return {
    id,
    summary,
    sectionLabel,
    submitterLabel,
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
  };
}

/**
 * Normalizes a positive reminder interval.
 *
 * @param {*} value Raw interval.
 * @return {number} Positive interval in milliseconds.
 */
function normalizeInterval_(value) {
  const intervalMs = Number(value);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("A positive reminder interval is required.");
  }
  return intervalMs;
}

/**
 * Validates the authenticated review destination used by email and Pumble.
 *
 * @param {*} value Raw URL.
 * @return {string} Normalized HTTPS URL or an empty string.
 */
function normalizeActionUrl_(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  let parsed = null;
  try {
    parsed = new URL(normalized);
  } catch (_error) {
    throw new Error("A valid Change Request review URL is required.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("The Change Request review URL must use HTTPS.");
  }
  return parsed.toString();
}

/**
 * Trims and bounds text included in provider messages.
 *
 * @param {*} value Raw value.
 * @param {number} maximumLength Maximum output length.
 * @return {string} Bounded text.
 */
function boundedText_(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

/**
 * Builds a singular or plural count label.
 *
 * @param {number} count Item count.
 * @param {string} singular Singular noun.
 * @return {string} Human-readable count.
 */
function buildCountLabel_(count, singular) {
  return String(count) + " " + singular + (count === 1 ? "" : "s");
}
