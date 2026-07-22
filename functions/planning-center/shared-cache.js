import crypto from "node:crypto";

/**
 * Reads a shared Firestore cache, allowing only one caller to refresh it.
 *
 * Existing stale data is returned while another instance refreshes. When no
 * cached value exists, callers briefly wait for the active refresh lease.
 *
 * @param {Object} options Cache options.
 * @return {Promise<{value: *, status: string}>} Cached or refreshed value.
 */
export async function getSharedCachedValue(options = {}) {
  const firestore = options.firestore;
  const docRef = options.docRef;
  const loadFresh = options.loadFresh;
  if (!firestore || !docRef || typeof loadFresh !== "function") {
    throw new Error(
        "Shared cache requires Firestore, a document, and a loader.",
    );
  }

  const ttlMs = Math.max(0, Number(options.ttlMs) || 0);
  const leaseMs = Math.max(1000, Number(options.leaseMs) || 30000);
  const waitForRefreshMs = Math.max(
      0,
      Number(options.waitForRefreshMs) || 30000,
  );
  const pollIntervalMs = Math.max(
      50,
      Number(options.pollIntervalMs) || 500,
  );
  const now = typeof options.now === "function" ?
    options.now :
    () => Date.now();
  const sleep = typeof options.sleep === "function" ?
    options.sleep :
    sleepMs;
  const validateValue = typeof options.validateValue === "function" ?
    options.validateValue :
    (value) => value !== null && value !== undefined;
  const isEntryCurrent = typeof options.isEntryCurrent === "function" ?
    options.isEntryCurrent :
    () => true;
  const metadata = options.metadata && typeof options.metadata === "object" ?
    options.metadata :
    {};
  const leaseId = crypto.randomUUID();
  const waitDeadlineMs = now() + waitForRefreshMs;
  const maxPollAttempts = Math.max(
      1,
      Math.ceil(waitForRefreshMs / pollIntervalMs) + 2,
  );

  for (
    let pollAttempt = 0;
    pollAttempt < maxPollAttempts;
    pollAttempt += 1
  ) {
    const claim = await claimRefreshLease({
      firestore,
      docRef,
      leaseId,
      leaseMs,
      ttlMs,
      now,
      validateValue,
      isEntryCurrent,
    });

    if (claim.status === "fresh") {
      return {value: claim.value, status: "fresh"};
    }

    if (claim.status === "busy") {
      if (claim.hasValue) {
        return {value: claim.value, status: "stale"};
      }
      if (now() >= waitDeadlineMs) {
        throw new Error(
            "Shared cache refresh timed out before data was ready.",
        );
      }
      await sleep(pollIntervalMs);
      continue;
    }

    try {
      const value = await loadFresh();
      if (!validateValue(value)) {
        throw new Error("Shared cache loader returned an invalid value.");
      }

      const fetchedAtMs = now();
      try {
        await docRef.set({
          value,
          fetchedAtMs,
          refreshLeaseId: "",
          refreshLeaseUntilMs: 0,
          lastErrorAtMs: 0,
          ...metadata,
        }, {merge: true});
      } catch (error) {
        reportCacheError(options, "write", error);
      }

      return {value, status: "refreshed"};
    } catch (error) {
      await releaseRefreshLease({
        firestore,
        docRef,
        leaseId,
        now,
        error,
        onError: options.onError,
      });
      if (claim.hasValue) {
        reportCacheError(options, "refresh", error);
        return {value: claim.value, status: "stale"};
      }
      throw error;
    }
  }

  throw new Error("Shared cache refresh timed out before data was ready.");
}

/**
 * Atomically reads a cache entry and claims its refresh lease when available.
 *
 * @param {Object} options Claim options.
 * @return {Promise<Object>} Claim result.
 */
async function claimRefreshLease(options) {
  return options.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(options.docRef);
    const entry = snapshot.exists ? snapshot.data() || {} : {};
    const hasValue = options.validateValue(entry.value);
    const fetchedAtMs = Number(entry.fetchedAtMs) || 0;
    const currentNowMs = options.now();
    const fresh = hasValue &&
      options.isEntryCurrent(entry) &&
      currentNowMs - fetchedAtMs < options.ttlMs;

    if (fresh) {
      return {status: "fresh", value: entry.value, hasValue: true};
    }

    const leaseUntilMs = Number(entry.refreshLeaseUntilMs) || 0;
    if (leaseUntilMs > currentNowMs) {
      return {
        status: "busy",
        value: hasValue ? entry.value : null,
        hasValue,
      };
    }

    transaction.set(options.docRef, {
      refreshLeaseId: options.leaseId,
      refreshLeaseUntilMs: currentNowMs + options.leaseMs,
    }, {merge: true});

    return {
      status: "acquired",
      value: hasValue ? entry.value : null,
      hasValue,
    };
  });
}

/**
 * Clears a refresh lease when its owner encounters an error.
 *
 * @param {Object} options Release options.
 * @return {Promise<void>} Release promise.
 */
async function releaseRefreshLease(options) {
  try {
    await options.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(options.docRef);
      const entry = snapshot.exists ? snapshot.data() || {} : {};
      if (entry.refreshLeaseId !== options.leaseId) return;

      transaction.set(options.docRef, {
        refreshLeaseId: "",
        refreshLeaseUntilMs: 0,
        lastErrorAtMs: options.now(),
        lastErrorStatus: Number(options.error && options.error.status) || 0,
      }, {merge: true});
    });
  } catch (error) {
    reportCacheError({onError: options.onError}, "release", error);
  }
}

/**
 * Reports a cache error without coupling the helper to a logger.
 *
 * @param {Object} options Cache options.
 * @param {string} phase Cache operation phase.
 * @param {Error} error Cache error.
 * @return {void}
 */
function reportCacheError(options, phase, error) {
  if (typeof options.onError === "function") {
    options.onError(phase, error);
  }
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
