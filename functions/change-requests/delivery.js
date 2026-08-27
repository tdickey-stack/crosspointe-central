export const DELIVERY_STATUS_PENDING = "pending";
export const DELIVERY_STATUS_SENDING = "sending";
export const DELIVERY_STATUS_RETRY = "retry";
export const DELIVERY_STATUS_SENT = "sent";
export const DELIVERY_STATUS_FAILED = "failed";
export const DELIVERY_STATUS_CANCELED = "canceled";

export const DEFAULT_DELIVERY_LEASE_MS = 5 * 60 * 1000;
export const DEFAULT_DELIVERY_MAX_ATTEMPTS = 5;
export const DEFAULT_DELIVERY_RETRY_BASE_MS = 60 * 1000;
export const DEFAULT_DELIVERY_RETRY_MAX_MS = 6 * 60 * 60 * 1000;

const CLAIMABLE_STATUSES = new Set([
  DELIVERY_STATUS_PENDING,
  DELIVERY_STATUS_RETRY,
]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Checks whether a delivery can be atomically claimed at the current time.
 *
 * A stale sending lease is claimable so an interrupted worker cannot strand a
 * notification indefinitely.
 *
 * @param {*} delivery Current delivery document data.
 * @param {*} now Current clock value.
 * @return {boolean} Whether a worker may claim the delivery.
 */
export function canClaimChangeRequestDelivery(delivery, now = Date.now()) {
  const source = delivery && typeof delivery === "object" ? delivery : {};
  const status = normalizeDeliveryStatus_(source.status);
  const nowMs = timestampMs_(now);
  const dueAtMs = timestampMs_(firstDefined_(
      source.nextAttemptAtMs,
      source.nextAttemptAt,
      source.dueAtMs,
      source.dueAt,
  ));

  if (!Number.isFinite(nowMs)) return false;
  if (Number.isFinite(dueAtMs) && dueAtMs > nowMs) return false;
  if (CLAIMABLE_STATUSES.has(status)) return true;

  if (status === DELIVERY_STATUS_SENDING) {
    const leaseUntilMs = timestampMs_(firstDefined_(
        source.leaseUntilMs,
        source.leaseUntil,
    ));
    return !Number.isFinite(leaseUntilMs) || leaseUntilMs <= nowMs;
  }

  return false;
}

/**
 * Builds the update applied while transactionally claiming a delivery.
 *
 * @param {*} delivery Current delivery document data.
 * @param {Object} options Claim options.
 * @return {Object} Claim state fields.
 */
export function buildChangeRequestDeliveryClaim(delivery, options = {}) {
  const source = delivery && typeof delivery === "object" ? delivery : {};
  const nowMs = requiredTimestamp_(
      firstDefined_(options.now, Date.now()),
      "claim time",
  );
  const leaseId = requiredText_(options.leaseId, "delivery lease ID", 200);
  const leaseMs = positiveNumber_(
      options.leaseMs,
      DEFAULT_DELIVERY_LEASE_MS,
      "delivery lease duration",
  );

  if (!canClaimChangeRequestDelivery(source, nowMs)) {
    throw deliveryError_(
        "delivery-not-claimable",
        "That Change Request notification delivery is not claimable.",
        false,
    );
  }

  return {
    status: DELIVERY_STATUS_SENDING,
    attemptCount: normalizeAttemptCount_(source.attemptCount) + 1,
    leaseId,
    leaseUntilMs: nowMs + leaseMs,
    lastAttemptAtMs: nowMs,
    nextAttemptAtMs: null,
  };
}

/**
 * Confirms that a completion belongs to the active delivery lease.
 *
 * @param {*} delivery Current delivery data.
 * @param {*} leaseId Worker's lease ID.
 * @return {boolean} Whether the lease still belongs to the worker.
 */
export function changeRequestDeliveryLeaseMatches(delivery, leaseId) {
  const source = delivery && typeof delivery === "object" ? delivery : {};
  const normalizedLeaseId = String(leaseId || "").trim();
  return normalizeDeliveryStatus_(source.status) === DELIVERY_STATUS_SENDING &&
    !!normalizedLeaseId && String(source.leaseId || "").trim() ===
      normalizedLeaseId;
}

/**
 * Builds the state applied after successful provider delivery.
 *
 * @param {Object} options Success details.
 * @return {Object} Terminal success state.
 */
export function buildChangeRequestDeliverySuccess(options = {}) {
  const nowMs = requiredTimestamp_(
      firstDefined_(options.now, Date.now()),
      "success time",
  );
  const providerMessageId = String(options.providerMessageId || "")
      .trim()
      .slice(0, 500);

  return {
    status: DELIVERY_STATUS_SENT,
    sentAtMs: nowMs,
    providerMessageId,
    leaseId: "",
    leaseUntilMs: 0,
    nextAttemptAtMs: null,
    lastError: "",
    lastErrorCode: "",
    lastErrorStatus: 0,
  };
}

/**
 * Classifies whether a provider error should be retried.
 *
 * Explicit `retryable` values win. Otherwise common rate-limit, timeout, and
 * server statuses retry; validation, authorization, and not-found errors do
 * not. Network errors without an HTTP status retry.
 *
 * @param {*} error Provider error.
 * @return {boolean} Whether another attempt is appropriate.
 */
export function isRetryableChangeRequestDeliveryError(error) {
  if (error && typeof error.retryable === "boolean") {
    return error.retryable;
  }

  const status = Number(
      error && (error.status || error.statusCode || error.httpStatus),
  );
  if (Number.isFinite(status) && status > 0) {
    return RETRYABLE_HTTP_STATUSES.has(status) || status >= 500;
  }

  const code = String(error && error.code || "").trim().toLowerCase();
  if (/invalid|forbidden|unauthorized|not-found|not_found|missing/.test(code)) {
    return false;
  }

  return true;
}

/**
 * Calculates bounded exponential backoff for a failed attempt.
 *
 * @param {*} attemptCount One-based attempt count.
 * @param {Object} options Backoff configuration.
 * @return {number} Retry delay in milliseconds.
 */
export function getChangeRequestDeliveryRetryDelayMs(
    attemptCount,
    options = {},
) {
  const attempt = Math.max(1, normalizeAttemptCount_(attemptCount));
  const baseMs = positiveNumber_(
      options.baseMs,
      DEFAULT_DELIVERY_RETRY_BASE_MS,
      "retry base duration",
  );
  const maxMs = positiveNumber_(
      options.maxMs,
      DEFAULT_DELIVERY_RETRY_MAX_MS,
      "retry maximum duration",
  );

  return Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
}

/**
 * Builds retry or terminal failure state after a provider error.
 *
 * @param {*} delivery Claimed delivery data, including the current attempt.
 * @param {*} error Provider error.
 * @param {Object} options Failure handling configuration.
 * @return {Object} Retry or terminal failure state.
 */
export function buildChangeRequestDeliveryFailure(
    delivery,
    error,
    options = {},
) {
  const source = delivery && typeof delivery === "object" ? delivery : {};
  const nowMs = requiredTimestamp_(
      firstDefined_(options.now, Date.now()),
      "failure time",
  );
  const attemptCount = normalizeAttemptCount_(source.attemptCount);
  const maxAttempts = Math.max(
      1,
      normalizeAttemptCount_(
          firstDefined_(
              options.maxAttempts,
              DEFAULT_DELIVERY_MAX_ATTEMPTS,
          ),
      ),
  );
  const retryable = isRetryableChangeRequestDeliveryError(error) &&
    attemptCount < maxAttempts;
  const nextAttemptAtMs = retryable ? nowMs +
    getChangeRequestDeliveryRetryDelayMs(attemptCount, options) : null;

  return {
    status: retryable ? DELIVERY_STATUS_RETRY : DELIVERY_STATUS_FAILED,
    failedAtMs: retryable ? null : nowMs,
    nextAttemptAtMs,
    lastError: normalizeErrorMessage_(error),
    lastErrorCode: String(error && error.code || "").trim().slice(0, 120),
    lastErrorStatus: normalizeErrorStatus_(error),
    leaseId: "",
    leaseUntilMs: 0,
  };
}

/**
 * Normalizes a delivery status.
 *
 * @param {*} value Raw status.
 * @return {string} Normalized status.
 */
function normalizeDeliveryStatus_(value) {
  return String(value || DELIVERY_STATUS_PENDING).trim().toLowerCase();
}

/**
 * Normalizes a nonnegative integer attempt count.
 *
 * @param {*} value Raw count.
 * @return {number} Normalized count.
 */
function normalizeAttemptCount_(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

/**
 * Resolves a positive numeric option or its default.
 *
 * @param {*} value Raw option.
 * @param {number} fallback Default value.
 * @param {string} label Error label.
 * @return {number} Positive number.
 */
function positiveNumber_(value, fallback, label) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("A positive " + label + " is required.");
  }
  return normalized;
}

/**
 * Requires bounded text.
 *
 * @param {*} value Raw text.
 * @param {string} label Error label.
 * @param {number} maximumLength Maximum length.
 * @return {string} Normalized text.
 */
function requiredText_(value, label, maximumLength) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new Error("A valid " + label + " is required.");
  }
  return normalized;
}

/**
 * Converts a timestamp-like value to milliseconds.
 *
 * @param {*} value Raw timestamp.
 * @return {number} Milliseconds or NaN.
 */
function timestampMs_(value) {
  if (value && typeof value.toMillis === "function") {
    return Number(value.toMillis());
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number(value);
  if (typeof value === "string" && value.trim()) return Date.parse(value);
  return NaN;
}

/**
 * Requires a valid timestamp.
 *
 * @param {*} value Raw timestamp.
 * @param {string} label Error label.
 * @return {number} Milliseconds.
 */
function requiredTimestamp_(value, label) {
  const milliseconds = timestampMs_(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("A valid delivery " + label + " is required.");
  }
  return milliseconds;
}

/**
 * Creates a tagged delivery-state error.
 *
 * @param {string} code Error code.
 * @param {string} message Safe message.
 * @param {boolean} retryable Retry classification.
 * @return {Error} Tagged error.
 */
function deliveryError_(code, message, retryable) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

/**
 * Bounds a provider error for Firestore storage and logs.
 *
 * @param {*} error Provider error.
 * @return {string} Bounded single-line message.
 */
function normalizeErrorMessage_(error) {
  return String(error && error.message || "Notification delivery failed.")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 500);
}

/**
 * Normalizes an HTTP-like error status.
 *
 * @param {*} error Provider error.
 * @return {number} Positive status or zero.
 */
function normalizeErrorStatus_(error) {
  const status = Number(
      error && (error.status || error.statusCode || error.httpStatus),
  );
  return Number.isFinite(status) && status > 0 ? status : 0;
}

/**
 * Returns the first value that is neither null nor undefined.
 *
 * @param {...*} values Candidate values.
 * @return {*} First defined value.
 */
function firstDefined_(...values) {
  return values.find((value) => value !== undefined && value !== null);
}
