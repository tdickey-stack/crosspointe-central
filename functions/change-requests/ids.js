import {createHash} from "node:crypto";

export const CHANGE_REQUEST_SUBMITTED_EVENT = "submitted";
export const CHANGE_REQUEST_REMINDER_EVENT = "reminder";

const DELIVERY_CHANNELS = new Set(["email", "pumble"]);

/**
 * Builds a stable event ID for an immediate or recurring notification.
 *
 * @param {Object} input Event identity.
 * @return {string} Firestore-safe deterministic event ID.
 */
export function buildChangeRequestNotificationEventId(input) {
  const source = input && typeof input === "object" ? input : {};
  const requestId = requiredIdentity_(source.requestId, "request ID");
  const eventType = String(source.eventType || "").trim().toLowerCase();

  if (eventType === CHANGE_REQUEST_SUBMITTED_EVENT) {
    return "cr-submitted-" + stableHash_(requestId);
  }

  if (eventType === CHANGE_REQUEST_REMINDER_EVENT) {
    const sequence = normalizeReminderSequence_(source.reminderSequence);
    return "cr-reminder-" + String(sequence).padStart(4, "0") + "-" +
      stableHash_(requestId);
  }

  throw new Error("Choose a valid Change Request notification event type.");
}

/**
 * Builds a stable delivery ID for one event, recipient, and channel.
 *
 * @param {Object} input Delivery identity.
 * @return {string} Firestore-safe deterministic delivery ID.
 */
export function buildChangeRequestNotificationDeliveryId(input) {
  const source = input && typeof input === "object" ? input : {};
  const eventId = requiredIdentity_(source.eventId, "event ID");
  const recipientUid = requiredIdentity_(source.recipientUid, "recipient UID");
  const channel = String(source.channel || "").trim().toLowerCase();

  if (!DELIVERY_CHANNELS.has(channel)) {
    throw new Error("Choose email or Pumble for notification delivery.");
  }

  return "cr-delivery-" + stableHash_(
      [eventId, recipientUid, channel].join("\u0000"),
  );
}

/**
 * Requires a short, non-empty identity without placing it in the document ID.
 *
 * @param {*} value Raw identity.
 * @param {string} label Human-readable field label.
 * @return {string} Normalized identity.
 */
function requiredIdentity_(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 500) {
    throw new Error("A valid " + label + " is required.");
  }
  return normalized;
}

/**
 * Normalizes a one-based reminder sequence.
 *
 * @param {*} value Raw sequence.
 * @return {number} Normalized sequence.
 */
function normalizeReminderSequence_(value) {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error("A valid reminder sequence is required.");
  }
  return sequence;
}

/**
 * Hashes an identity into a non-reversible Firestore-safe suffix.
 *
 * @param {string} value Stable identity material.
 * @return {string} SHA-256 hex digest.
 */
function stableHash_(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
