/* eslint-disable require-jsdoc */
import {randomUUID} from "node:crypto";

import {
  buildChangeRequestDeliveryClaim,
  buildChangeRequestDeliveryFailure,
  buildChangeRequestDeliverySuccess,
  canClaimChangeRequestDelivery,
  changeRequestDeliveryLeaseMatches,
  DEFAULT_DELIVERY_LEASE_MS,
  DEFAULT_DELIVERY_MAX_ATTEMPTS,
  DEFAULT_DELIVERY_RETRY_BASE_MS,
  DEFAULT_DELIVERY_RETRY_MAX_MS,
  DELIVERY_STATUS_CANCELED,
  DELIVERY_STATUS_FAILED,
  DELIVERY_STATUS_PENDING,
  DELIVERY_STATUS_SENDING,
  DELIVERY_STATUS_SENT,
} from "./delivery.js";
import {
  buildChangeRequestNotificationDeliveryId,
  CHANGE_REQUEST_REMINDER_EVENT,
  CHANGE_REQUEST_SUBMITTED_EVENT,
} from "./ids.js";
import {
  CHANGE_REQUEST_EMAIL_CHANNEL,
  CHANGE_REQUEST_PUMBLE_CHANNEL,
  canReceiveChangeRequestNotifications,
  getEligibleChangeRequestNotificationChannels,
} from "./preferences.js";
import {
  buildChangeRequestNotificationDigest,
  buildQueuedReminderState,
  CHANGE_REQUEST_REMINDER_INTERVAL_MS,
  formatChangeRequestNotificationDigestText,
  isChangeRequestReminderDue,
  toTimestampMs,
} from "./timing.js";

export const CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH =
  "centralAdmin/root/changeRequestNotificationEvents";
export const CHANGE_REQUESTS_PATH = "centralAdmin/root/changeRequests";
export const CHANGE_REQUEST_REVIEWERS_PATH = "centralAdmin/root/users";

export const DEFAULT_CHANGE_REQUEST_EVENT_LEASE_MS = 5 * 60 * 1000;
export const DEFAULT_CHANGE_REQUEST_REMINDER_BATCH_SIZE = 50;
export const DEFAULT_CHANGE_REQUEST_EVENT_SCAN_SIZE = 10;

const EVENT_STATUS_PENDING = "pending";
const EVENT_STATUS_COMPLETE = "complete";
const TERMINAL_DELIVERY_STATUSES = new Set([
  DELIVERY_STATUS_SENT,
  DELIVERY_STATUS_FAILED,
  DELIVERY_STATUS_CANCELED,
]);

/**
 * Creates the provider-neutral Change Request notification runtime.
 *
 * Provider callbacks receive `{recipient, event, digest, text}` and may return
 * a provider message ID string or an object containing one. Provider-specific
 * authentication, lookup, and request schemas remain outside this module.
 *
 * @param {Object} options Runtime dependencies and configuration.
 * @return {Object} Queue and dispatch operations.
 */
export function createChangeRequestNotificationRuntime(options = {}) {
  const firestore = requireFunctionDependency_(
      options.firestore,
      "Firestore instance",
      "collection",
  );
  requireFunctionDependency_(firestore, "Firestore instance", "runTransaction");
  const timestampFromMillis = requireFunction_(
      options.timestampFromMillis,
      "timestampFromMillis",
  );
  const sendEmail = optionalFunction_(options.sendEmail, "sendEmail");
  const sendPumble = optionalFunction_(options.sendPumble, "sendPumble");
  const now = optionalFunction_(options.now, "now") || (() => new Date());
  const createLeaseId = optionalFunction_(
      options.createLeaseId,
      "createLeaseId",
  ) || randomUUID;
  const actionUrl = normalizeActionUrl_(options.actionUrl);
  const reminderIntervalMs = positiveNumber_(
      options.reminderIntervalMs,
      CHANGE_REQUEST_REMINDER_INTERVAL_MS,
      "reminder interval",
  );
  const reminderBatchSize = boundedInteger_(
      options.reminderBatchSize,
      DEFAULT_CHANGE_REQUEST_REMINDER_BATCH_SIZE,
      1,
      50,
      "reminder batch size",
  );
  const eventScanSize = boundedInteger_(
      options.eventScanSize,
      DEFAULT_CHANGE_REQUEST_EVENT_SCAN_SIZE,
      1,
      50,
      "event scan size",
  );
  const eventLeaseMs = positiveNumber_(
      options.eventLeaseMs,
      DEFAULT_CHANGE_REQUEST_EVENT_LEASE_MS,
      "event lease duration",
  );
  const deliveryLeaseMs = positiveNumber_(
      options.deliveryLeaseMs,
      DEFAULT_DELIVERY_LEASE_MS,
      "delivery lease duration",
  );
  const deliveryMaxAttempts = boundedInteger_(
      options.deliveryMaxAttempts,
      DEFAULT_DELIVERY_MAX_ATTEMPTS,
      1,
      100,
      "delivery maximum attempts",
  );
  const deliveryRetryBaseMs = positiveNumber_(
      options.deliveryRetryBaseMs,
      DEFAULT_DELIVERY_RETRY_BASE_MS,
      "delivery retry base duration",
  );
  const deliveryRetryMaxMs = positiveNumber_(
      options.deliveryRetryMaxMs,
      DEFAULT_DELIVERY_RETRY_MAX_MS,
      "delivery retry maximum duration",
  );

  const events = firestore.collection(CHANGE_REQUEST_NOTIFICATION_EVENTS_PATH);
  const requests = firestore.collection(CHANGE_REQUESTS_PATH);
  const reviewers = firestore.collection(CHANGE_REQUEST_REVIEWERS_PATH);

  /**
   * Queues one reminder digest and advances every included request atomically.
   *
   * @return {Promise<Object>} Queue outcome.
   */
  async function queueDueReminderDigest() {
    const nowMs = requiredNowMs_(now());
    const nowTimestamp = timestampFromMillis(nowMs);
    const eventRef = events.doc();

    return firestore.runTransaction(async (transaction) => {
      const query = requests
          .where("status", "==", "pending")
          .where("nextReminderAt", "<=", nowTimestamp)
          .orderBy("nextReminderAt")
          .limit(reminderBatchSize);
      const snapshot = await transaction.get(query);
      const dueDocs = snapshot.docs.filter((doc) => {
        return isChangeRequestReminderDue(doc.data(), nowMs);
      });

      if (!dueDocs.length) {
        return {
          queued: false,
          eventId: "",
          requestCount: 0,
          requestIds: [],
        };
      }

      const requestModels = dueDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const digest = buildChangeRequestNotificationDigest({
        eventType: CHANGE_REQUEST_REMINDER_EVENT,
        requests: requestModels,
        actionUrl,
        maxItems: reminderBatchSize,
      });
      const requestIds = dueDocs.map((doc) => doc.id);

      transaction.set(eventRef, {
        eventType: CHANGE_REQUEST_REMINDER_EVENT,
        status: EVENT_STATUS_PENDING,
        requestIds,
        requestCount: requestIds.length,
        digest: serializeDigestForFirestore_(digest, timestampFromMillis),
        attemptCount: 0,
        dueAt: nowTimestamp,
        leaseId: "",
        leaseUntil: null,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });

      dueDocs.forEach((doc) => {
        const reminderState = buildQueuedReminderState(
            doc.data(),
            nowMs,
            reminderIntervalMs,
        );
        transaction.update(doc.ref, {
          reminderSequence: reminderState.reminderSequence,
          lastReminderQueuedAt: timestampFromMillis(
              reminderState.lastReminderQueuedAtMs,
          ),
          nextReminderAt: timestampFromMillis(
              reminderState.nextReminderAtMs,
          ),
          updatedAt: nowTimestamp,
        });
      });

      return {
        queued: true,
        eventId: eventRef.id,
        requestCount: requestIds.length,
        requestIds,
      };
    });
  }

  /**
   * Claims and dispatches a specific event, including trigger-created events.
   *
   * @param {string} eventId Notification event document ID.
   * @return {Promise<Object>} Dispatch outcome.
   */
  async function dispatchEvent(eventId) {
    const normalizedEventId = requiredText_(eventId, "event ID", 500);
    const claimed = await claimEvent_(events.doc(normalizedEventId));
    if (!claimed.claimed) {
      return {
        dispatched: false,
        eventId: normalizedEventId,
        reason: claimed.reason,
      };
    }

    return dispatchClaimedEvent_(claimed);
  }

  /**
   * Finds and dispatches at most one due event for a scheduled worker.
   *
   * @return {Promise<Object>} Dispatch outcome.
   */
  async function dispatchNextEvent() {
    const nowMs = requiredNowMs_(now());
    const snapshot = await events
        .where("status", "==", EVENT_STATUS_PENDING)
        .where("dueAt", "<=", timestampFromMillis(nowMs))
        .orderBy("dueAt")
        .limit(eventScanSize)
        .get();

    for (const doc of snapshot.docs) {
      const result = await dispatchEvent(doc.id);
      if (result.dispatched) return result;
    }

    return {
      dispatched: false,
      eventId: "",
      reason: snapshot.empty ? "no-due-event" : "no-claimable-event",
    };
  }

  /**
   * Claims an event while keeping it queryable as pending. A crashed worker
   * can therefore be replaced after its lease expires without a cleanup job.
   *
   * @param {*} eventRef Event document reference.
   * @return {Promise<Object>} Claimed event state.
   */
  async function claimEvent_(eventRef) {
    const nowMs = requiredNowMs_(now());
    const leaseId = requiredText_(createLeaseId(), "event lease ID", 200);

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventRef);
      if (!snapshot.exists) {
        return {claimed: false, reason: "event-not-found"};
      }

      const event = snapshot.data();
      if (!canClaimEvent_(event, nowMs)) {
        return {claimed: false, reason: "event-not-claimable"};
      }

      const claim = {
        status: EVENT_STATUS_PENDING,
        attemptCount: normalizeCount_(event.attemptCount) + 1,
        leaseId,
        leaseUntil: timestampFromMillis(nowMs + eventLeaseMs),
        dueAt: timestampFromMillis(nowMs + eventLeaseMs),
        lastAttemptAt: timestampFromMillis(nowMs),
        updatedAt: timestampFromMillis(nowMs),
      };
      transaction.update(eventRef, claim);

      return {
        claimed: true,
        eventId: eventRef.id,
        eventRef,
        leaseId,
        event: {...event, ...claim},
      };
    });
  }

  /**
   * Resolves current requests/reviewers, creates stable delivery records, and
   * sends each channel independently.
   *
   * @param {Object} claimed Active event claim.
   * @return {Promise<Object>} Dispatch outcome.
   */
  async function dispatchClaimedEvent_(claimed) {
    const eventType = normalizeEventType_(claimed.event.eventType);
    const requestIds = normalizeRequestIds_(claimed.event);
    const requestSnapshots = await Promise.all(requestIds.map((requestId) => {
      return requests.doc(requestId).get();
    }));
    const pendingRequests = requestSnapshots.filter((snapshot) => {
      return snapshot.exists && normalizeStatus_(snapshot.data().status) ===
        "pending";
    }).map((snapshot) => ({id: snapshot.id, ...snapshot.data()}));

    if (!pendingRequests.length) {
      const canceledDeliveries = await cancelObsoleteDeliveries_(
          claimed,
          new Set(),
          "request-no-longer-pending",
      );
      await finalizeEvent_(claimed, canceledDeliveries);
      return {
        dispatched: true,
        eventId: claimed.eventId,
        requestCount: 0,
        deliveryCount: canceledDeliveries.length,
        status: EVENT_STATUS_COMPLETE,
        reason: "no-pending-requests",
      };
    }

    const digest = buildChangeRequestNotificationDigest({
      eventType,
      requests: pendingRequests,
      actionUrl: buildEventActionUrl_(
          claimed.event.digest && claimed.event.digest.actionUrl || actionUrl,
          eventType,
          pendingRequests,
      ),
      maxItems: 50,
    });
    const text = formatChangeRequestNotificationDigestText(digest);
    const reviewerSnapshot = await reviewers.get();
    const recipients = reviewerSnapshot.docs
        .map((doc) => serializeReviewer_(doc.id, doc.data()))
        .filter((recipient) => recipient.channels.length > 0);
    const deliveryRefs = await ensureDeliveryDocuments_(
        claimed,
        recipients,
        pendingRequests.map((request) => request.id),
    );
    await cancelObsoleteDeliveries_(
        claimed,
        new Set(deliveryRefs.map((ref) => ref.id)),
        "recipient-no-longer-eligible",
    );

    for (const deliveryRef of deliveryRefs) {
      const deliveryClaim = await claimDelivery_(deliveryRef);
      if (!deliveryClaim.claimed) continue;

      const provider = deliveryClaim.delivery.channel ===
          CHANGE_REQUEST_EMAIL_CHANNEL ? sendEmail : sendPumble;
      try {
        if (!provider) {
          throw terminalProviderError_(
              "notification-transport-not-configured",
              "The notification transport is not configured.",
          );
        }
        const providerResult = await provider({
          recipient: serializeDeliveryRecipient_(deliveryClaim.delivery),
          event: {
            id: claimed.eventId,
            eventType,
            requestIds: pendingRequests.map((request) => request.id),
          },
          digest,
          text,
        });
        await completeDelivery_(deliveryClaim, providerResult);
      } catch (error) {
        await failDelivery_(deliveryClaim, error);
      }
    }

    const deliveries = await readEventDeliveries_(claimed);
    const finalState = await finalizeEvent_(claimed, deliveries);

    return {
      dispatched: true,
      eventId: claimed.eventId,
      requestCount: pendingRequests.length,
      deliveryCount: deliveries.length,
      sentCount: finalState.sentCount,
      failedCount: finalState.failedCount,
      status: finalState.status,
    };
  }

  /**
   * Creates only missing deterministic delivery documents.
   *
   * @param {Object} claimed Active event claim.
   * @param {Object[]} recipients Eligible reviewer recipients.
   * @param {string[]} requestIds Pending request IDs.
   * @return {Promise<Array<*>>} Delivery document references.
   */
  async function ensureDeliveryDocuments_(claimed, recipients, requestIds) {
    const deliverySeeds = recipients.flatMap((recipient) => {
      return recipient.channels.map((channel) => {
        const id = buildChangeRequestNotificationDeliveryId({
          eventId: claimed.eventId,
          recipientUid: recipient.uid,
          channel,
        });
        return {
          ref: claimed.eventRef.collection("deliveries").doc(id),
          recipient,
          channel,
        };
      });
    });

    if (!deliverySeeds.length) return [];
    const createdAtMs = requiredNowMs_(now());

    await firestore.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(deliverySeeds.map((seed) => {
        return transaction.get(seed.ref);
      }));

      deliverySeeds.forEach((seed, index) => {
        if (snapshots[index].exists) return;
        const timestamp = timestampFromMillis(createdAtMs);
        transaction.set(seed.ref, {
          eventId: claimed.eventId,
          eventType: normalizeEventType_(claimed.event.eventType),
          requestIds,
          recipientUid: seed.recipient.uid,
          recipientEmail: seed.recipient.email,
          recipientDisplayName: seed.recipient.displayName,
          recipientPumbleUserId: seed.recipient.pumbleUserId,
          pumbleBotUserId: seed.recipient.pumbleBotUserId,
          channel: seed.channel,
          status: DELIVERY_STATUS_PENDING,
          attemptCount: 0,
          dueAt: timestamp,
          leaseId: "",
          leaseUntil: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
    });

    return deliverySeeds.map((seed) => seed.ref);
  }

  async function cancelObsoleteDeliveries_(claimed, activeIds, reasonCode) {
    const collection = claimed.eventRef.collection("deliveries");
    const snapshot = await collection.get();
    const canceledAtMs = requiredNowMs_(now());

    await Promise.all(snapshot.docs.map((doc) => {
      if (activeIds.has(doc.id)) return Promise.resolve();
      return firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(doc.ref);
        if (!current.exists ||
            TERMINAL_DELIVERY_STATUSES.has(current.data().status)) {
          return;
        }
        transaction.update(doc.ref, {
          status: DELIVERY_STATUS_CANCELED,
          canceledAt: timestampFromMillis(canceledAtMs),
          nextAttemptAt: null,
          leaseId: "",
          leaseUntil: null,
          lastError: "",
          lastErrorCode: reasonCode,
          lastErrorStatus: 0,
          updatedAt: timestampFromMillis(canceledAtMs),
        });
      });
    }));

    return readEventDeliveries_(claimed);
  }

  async function readEventDeliveries_(claimed) {
    const snapshot = await claimed.eventRef.collection("deliveries").get();
    return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Claims one delivery with the shared retry/lease state helper.
   *
   * @param {*} deliveryRef Delivery document reference.
   * @return {Promise<Object>} Claim outcome.
   */
  async function claimDelivery_(deliveryRef) {
    const nowMs = requiredNowMs_(now());
    const leaseId = requiredText_(createLeaseId(), "delivery lease ID", 200);

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(deliveryRef);
      if (!snapshot.exists ||
          !canClaimChangeRequestDelivery(snapshot.data(), nowMs)) {
        return {claimed: false};
      }

      const claim = buildChangeRequestDeliveryClaim(snapshot.data(), {
        now: nowMs,
        leaseId,
        leaseMs: deliveryLeaseMs,
      });
      const persistedClaim = serializeDeliveryState_(
          claim,
          timestampFromMillis,
      );
      persistedClaim.updatedAt = timestampFromMillis(nowMs);
      transaction.update(deliveryRef, persistedClaim);

      return {
        claimed: true,
        deliveryRef,
        leaseId,
        delivery: {...snapshot.data(), ...persistedClaim},
      };
    });
  }

  /**
   * Records a successful provider send when the delivery lease still matches.
   *
   * @param {Object} claimedDelivery Active delivery claim.
   * @param {*} providerResult Provider response.
   * @return {Promise<boolean>} Whether completion was written.
   */
  async function completeDelivery_(claimedDelivery, providerResult) {
    const completedAtMs = requiredNowMs_(now());
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(claimedDelivery.deliveryRef);
      if (!snapshot.exists || !changeRequestDeliveryLeaseMatches(
          snapshot.data(),
          claimedDelivery.leaseId,
      )) {
        return false;
      }

      const success = buildChangeRequestDeliverySuccess({
        now: completedAtMs,
        providerMessageId: resolveProviderMessageId_(providerResult),
      });
      const persistedSuccess = serializeDeliveryState_(
          success,
          timestampFromMillis,
      );
      persistedSuccess.updatedAt = timestampFromMillis(completedAtMs);
      transaction.update(claimedDelivery.deliveryRef, persistedSuccess);
      return true;
    });
  }

  /**
   * Records a retryable or terminal provider failure under the active lease.
   *
   * @param {Object} claimedDelivery Active delivery claim.
   * @param {*} error Provider failure.
   * @return {Promise<boolean>} Whether failure state was written.
   */
  async function failDelivery_(claimedDelivery, error) {
    const failedAtMs = requiredNowMs_(now());
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(claimedDelivery.deliveryRef);
      if (!snapshot.exists || !changeRequestDeliveryLeaseMatches(
          snapshot.data(),
          claimedDelivery.leaseId,
      )) {
        return false;
      }

      const failure = buildChangeRequestDeliveryFailure(
          snapshot.data(),
          error,
          {
            now: failedAtMs,
            maxAttempts: deliveryMaxAttempts,
            baseMs: deliveryRetryBaseMs,
            maxMs: deliveryRetryMaxMs,
          },
      );
      const persistedFailure = serializeDeliveryState_(
          failure,
          timestampFromMillis,
      );
      persistedFailure.updatedAt = timestampFromMillis(failedAtMs);
      transaction.update(claimedDelivery.deliveryRef, persistedFailure);
      return true;
    });
  }

  /**
   * Releases or completes the event according to its delivery documents.
   *
   * @param {Object} claimed Active event claim.
   * @param {Object[]} deliveries Current deliveries.
   * @return {Promise<Object>} Persisted event summary.
   */
  async function finalizeEvent_(claimed, deliveries) {
    const finalizedAtMs = requiredNowMs_(now());
    const sentCount = deliveries.filter((delivery) => {
      return delivery.status === DELIVERY_STATUS_SENT;
    }).length;
    const failedCount = deliveries.filter((delivery) => {
      return delivery.status === DELIVERY_STATUS_FAILED;
    }).length;
    const incomplete = deliveries.filter((delivery) => {
      return !TERMINAL_DELIVERY_STATUSES.has(delivery.status);
    });
    const complete = incomplete.length === 0;
    const nextDueAtMs = complete ? NaN : Math.min(...incomplete.map((item) => {
      return deliveryDueAtMs_(item, finalizedAtMs);
    }));
    const update = {
      status: complete ? EVENT_STATUS_COMPLETE : EVENT_STATUS_PENDING,
      deliveryCount: deliveries.length,
      sentCount,
      failedCount,
      dueAt: complete ? null : timestampFromMillis(nextDueAtMs),
      leaseId: "",
      leaseUntil: null,
      updatedAt: timestampFromMillis(finalizedAtMs),
      completedAt: complete ? timestampFromMillis(finalizedAtMs) : null,
    };

    const written = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(claimed.eventRef);
      if (!snapshot.exists ||
          String(snapshot.data().leaseId || "") !== claimed.leaseId) {
        return false;
      }
      transaction.update(claimed.eventRef, update);
      return true;
    });

    return {...update, written};
  }

  return {
    queueDueReminderDigest,
    dispatchEvent,
    dispatchNextEvent,
  };
}

/**
 * Serializes the safe, provider-neutral reviewer shape used by deliveries.
 *
 * @param {string} uid Reviewer document ID.
 * @param {*} user Reviewer document data.
 * @return {Object}
 * Reviewer notification identity.
 */
export function serializeChangeRequestNotificationReviewer(uid, user) {
  return serializeReviewer_(uid, user);
}

/**
 * Determines whether an event may be claimed without hiding it from recovery.
 *
 * @param {*} event Event document data.
 * @param {*} now Current clock value.
 * @return {boolean} Whether the event can be claimed.
 */
export function canClaimChangeRequestNotificationEvent(
    event,
    now = Date.now(),
) {
  const nowMs = toTimestampMs(now);
  return canClaimEvent_(event, nowMs);
}

function canClaimEvent_(event, nowMs) {
  const source = event && typeof event === "object" ? event : {};
  if (!Number.isFinite(nowMs) ||
      normalizeStatus_(source.status) !== EVENT_STATUS_PENDING) {
    return false;
  }

  const dueAtMs = toTimestampMs(source.dueAt);
  if (Number.isFinite(dueAtMs) && dueAtMs > nowMs) return false;
  const leaseUntilMs = toTimestampMs(source.leaseUntil);
  return !String(source.leaseId || "").trim() ||
    !Number.isFinite(leaseUntilMs) || leaseUntilMs <= nowMs;
}

function serializeReviewer_(uid, user) {
  const source = user && typeof user === "object" ? user : {};
  const normalizedUid = String(uid || "").trim().slice(0, 500);
  if (!normalizedUid || !canReceiveChangeRequestNotifications(source)) {
    return {
      uid: normalizedUid,
      email: "",
      displayName: "",
      pumbleUserId: "",
      pumbleBotUserId: "",
      channels: [],
    };
  }

  const integrations = source.notificationIntegrations &&
    typeof source.notificationIntegrations === "object" ?
    source.notificationIntegrations : {};
  const pumble = integrations.pumble &&
    typeof integrations.pumble === "object" ? integrations.pumble : {};
  const pumbleUserId = String(pumble.userId || "").trim().slice(0, 500);
  const pumbleBotUserId = String(pumble.botId || "").trim().slice(0, 500);
  const pumbleWorkspaceId = String(pumble.workspaceId || "")
      .trim()
      .slice(0, 500);
  const pumbleLinked = String(pumble.status || "").trim().toLowerCase() ===
    "linked" && !!pumbleUserId && !!pumbleBotUserId && !!pumbleWorkspaceId;
  const channels = getEligibleChangeRequestNotificationChannels(source)
      .filter((channel) => {
        return channel !== CHANGE_REQUEST_PUMBLE_CHANNEL || pumbleLinked;
      });

  return {
    uid: normalizedUid,
    email: String(source.email || "").trim().toLowerCase().slice(0, 320),
    displayName: String(
        source.displayName || source.name || source.email || "Reviewer",
    ).trim().slice(0, 160),
    pumbleUserId: pumbleLinked ? pumbleUserId : "",
    pumbleBotUserId: pumbleLinked ? pumbleBotUserId : "",
    channels,
  };
}

function serializeDeliveryRecipient_(delivery) {
  return {
    uid: String(delivery.recipientUid || ""),
    email: String(delivery.recipientEmail || ""),
    displayName: String(delivery.recipientDisplayName || "Reviewer"),
    pumbleUserId: String(delivery.recipientPumbleUserId || ""),
    pumbleBotUserId: String(delivery.pumbleBotUserId || ""),
  };
}

function serializeDigestForFirestore_(digest, timestampFromMillis) {
  return {
    eventType: digest.eventType,
    subject: digest.subject,
    title: digest.title,
    lead: digest.lead,
    actionLabel: digest.actionLabel,
    actionUrl: digest.actionUrl,
    omittedCount: digest.omittedCount,
    items: digest.items.map((item) => ({
      id: item.id,
      summary: item.summary,
      sectionLabel: item.sectionLabel,
      submitterLabel: item.submitterLabel,
      createdAt: timestampFromMillis(item.createdAtMs),
    })),
  };
}

function serializeDeliveryState_(state, timestampFromMillis) {
  const source = state && typeof state === "object" ? state : {};
  const output = {};

  Object.entries(source).forEach(([key, value]) => {
    if (!key.endsWith("AtMs")) output[key] = value;
  });
  ["leaseUntil", "lastAttemptAt", "nextAttemptAt", "sentAt", "failedAt"]
      .forEach((field) => {
        const sourceField = field + "Ms";
        if (!Object.prototype.hasOwnProperty.call(source, sourceField)) return;
        const milliseconds = source[sourceField];
        output[field] = Number.isFinite(milliseconds) && milliseconds > 0 ?
          timestampFromMillis(milliseconds) : null;
      });

  return output;
}

function normalizeRequestIds_(event) {
  const source = event && typeof event === "object" ? event : {};
  const values = Array.isArray(source.requestIds) ? source.requestIds :
    [source.requestId];
  return [...new Set(values.map((value) => String(value || "").trim())
      .filter(Boolean))].slice(0, 50);
}

function normalizeEventType_(value) {
  const normalized = String(value || CHANGE_REQUEST_SUBMITTED_EVENT)
      .trim()
      .toLowerCase();
  if (normalized !== CHANGE_REQUEST_SUBMITTED_EVENT &&
      normalized !== CHANGE_REQUEST_REMINDER_EVENT) {
    throw new Error("Choose a valid Change Request notification event type.");
  }
  return normalized;
}

function deliveryDueAtMs_(delivery, fallbackMs) {
  const source = delivery && typeof delivery === "object" ? delivery : {};
  if (source.status === DELIVERY_STATUS_SENDING) {
    const leaseUntilMs = toTimestampMs(source.leaseUntil);
    if (Number.isFinite(leaseUntilMs)) return leaseUntilMs;
  }
  const nextAttemptAtMs = toTimestampMs(source.nextAttemptAt);
  if (Number.isFinite(nextAttemptAtMs)) return nextAttemptAtMs;
  const dueAtMs = toTimestampMs(source.dueAt);
  return Number.isFinite(dueAtMs) ? dueAtMs : fallbackMs;
}

function resolveProviderMessageId_(result) {
  if (typeof result === "string") return result;
  const source = result && typeof result === "object" ? result : {};
  return String(
      source.providerMessageId || source.messageId || source.id || "",
  ).trim().slice(0, 500);
}

function terminalProviderError_(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

function normalizeActionUrl_(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") {
    throw new Error("The Change Request review URL must use HTTPS.");
  }
  return parsed.toString();
}

function buildEventActionUrl_(baseUrl, eventType, requests) {
  const normalized = normalizeActionUrl_(baseUrl);
  if (!normalized || eventType !== CHANGE_REQUEST_SUBMITTED_EVENT ||
      requests.length !== 1) {
    return normalized;
  }

  const url = new URL(normalized);
  url.searchParams.set("request", String(requests[0].id || ""));
  return url.toString();
}

function normalizeStatus_(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCount_(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function requiredNowMs_(value) {
  const milliseconds = toTimestampMs(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("The Change Request notification clock is invalid.");
  }
  return milliseconds;
}

function requireFunctionDependency_(value, label, method) {
  if (!value || typeof value[method] !== "function") {
    throw new Error("A valid " + label + " is required.");
  }
  return value;
}

function requireFunction_(value, label) {
  if (typeof value !== "function") {
    throw new Error("A " + label + " function is required.");
  }
  return value;
}

function optionalFunction_(value, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "function") {
    throw new Error(label + " must be a function.");
  }
  return value;
}

function positiveNumber_(value, fallback, label) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("A positive " + label + " is required.");
  }
  return normalized;
}

function boundedInteger_(value, fallback, minimum, maximum, label) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(normalized) ||
      normalized < minimum || normalized > maximum) {
    throw new Error("A valid " + label + " is required.");
  }
  return normalized;
}

function requiredText_(value, label, maximumLength) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new Error("A valid " + label + " is required.");
  }
  return normalized;
}
