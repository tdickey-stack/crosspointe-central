const DEFAULT_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Creates a process-local gate that spaces request starts apart.
 *
 * @param {Object} options Gate options.
 * @return {Function} Async function that waits for the next request slot.
 */
export function createRequestStartGate(options = {}) {
  const minIntervalMs = Math.max(
      0,
      Number(options.minIntervalMs) || 0,
  );
  const now = typeof options.now === "function" ?
    options.now :
    () => Date.now();
  const sleep = typeof options.sleep === "function" ?
    options.sleep :
    sleepMs;
  let queue = Promise.resolve();
  let nextStartAtMs = 0;

  return function waitForRequestStart() {
    const slot = queue.catch(() => {}).then(async () => {
      const waitMs = Math.max(0, nextStartAtMs - now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      nextStartAtMs = now() + minIntervalMs;
    });

    queue = slot;
    return slot;
  };
}

/**
 * Fetches and parses JSON while retrying temporary upstream failures.
 *
 * @param {string} url Request URL.
 * @param {Object} options Fetch and retry options.
 * @return {Promise<Object>} Parsed JSON response.
 */
export async function fetchJsonWithRetry(url, options = {}) {
  const fetchImpl = typeof options.fetchImpl === "function" ?
    options.fetchImpl :
    fetch;
  const waitForRequestStart =
    typeof options.waitForRequestStart === "function" ?
      options.waitForRequestStart :
      async () => {};
  const sleep = typeof options.sleep === "function" ?
    options.sleep :
    sleepMs;
  const now = typeof options.now === "function" ?
    options.now :
    () => Date.now();
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 3);
  const maxRetryAfterMs = Math.max(
      0,
      Number(options.maxRetryAfterMs) || 20000,
  );
  const retryableStatuses = options.retryableStatuses instanceof Set ?
    options.retryableStatuses :
    DEFAULT_RETRYABLE_STATUSES;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForRequestStart();

    let response = null;
    let body = "";
    try {
      response = await fetchImpl(url, options.requestOptions || {});
      body = await response.text();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) throw error;
      await sleep(networkRetryDelayMs(attempt));
      continue;
    }

    if (response.ok) {
      return JSON.parse(body);
    }

    const error = new Error(
        "Planning Center API error " + response.status + ": " + body,
    );
    error.status = response.status;
    lastError = error;

    if (
      attempt >= maxAttempts ||
      !retryableStatuses.has(response.status)
    ) {
      throw error;
    }

    const retryAfter = response.headers &&
      typeof response.headers.get === "function" ?
      response.headers.get("retry-after") :
      "";
    const waitMs = retryDelayMs(
        response.status,
        retryAfter,
        attempt,
        now(),
        maxRetryAfterMs,
    );
    await sleep(waitMs);
  }

  throw lastError || new Error("Planning Center request failed.");
}

/**
 * Calculates the delay before retrying an HTTP response.
 *
 * @param {number} status HTTP status.
 * @param {string} retryAfter Retry-After header value.
 * @param {number} attempt One-based attempt number.
 * @param {number} nowMs Current time in milliseconds.
 * @param {number} maxRetryAfterMs Maximum allowed retry delay.
 * @return {number} Delay in milliseconds.
 */
function retryDelayMs(
    status,
    retryAfter,
    attempt,
    nowMs,
    maxRetryAfterMs,
) {
  const parsedRetryAfterMs = parseRetryAfterMs(retryAfter, nowMs);
  if (parsedRetryAfterMs !== null) {
    return Math.min(parsedRetryAfterMs, maxRetryAfterMs);
  }

  if (status === 429) {
    return Math.min(attempt === 1 ? 5000 : 15000, maxRetryAfterMs);
  }

  return Math.min(500 * Math.pow(3, attempt - 1), maxRetryAfterMs);
}

/**
 * Parses a Retry-After header as seconds or an HTTP date.
 *
 * @param {string} value Header value.
 * @param {number} nowMs Current time in milliseconds.
 * @return {number|null} Parsed delay or null.
 */
function parseRetryAfterMs(value, nowMs) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryDateMs = Date.parse(normalized);
  if (Number.isNaN(retryDateMs)) return null;
  return Math.max(0, retryDateMs - nowMs);
}

/**
 * Calculates a short retry delay for network failures.
 *
 * @param {number} attempt One-based attempt number.
 * @return {number} Delay in milliseconds.
 */
function networkRetryDelayMs(attempt) {
  return 500 * Math.pow(3, attempt - 1);
}

/**
 * Resolves after the requested delay.
 *
 * @param {number} milliseconds Delay in milliseconds.
 * @return {Promise<void>} Delay promise.
 */
function sleepMs(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
