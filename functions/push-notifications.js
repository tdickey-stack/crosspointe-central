import {createHash} from "node:crypto";

export const PUSH_SUBSCRIPTIONS_COLLECTION = "centralPushSubscriptions";
export const PUSH_HISTORY_COLLECTION = "centralPushNotifications";
export const PUSH_SCHEDULED_COLLECTION = "centralPushScheduled";
export const DEFAULT_PUSH_LINK = "https://central.crosspointe.tv/";

const MAX_TOKEN_LENGTH = 4096;
const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 240;
const MAX_LINK_LENGTH = 500;
const MAX_SCHEDULE_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_SCHEDULED_DISPATCHES = 50;
const MULTICAST_LIMIT = 500;
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/**
 * Returns a stable Firestore-safe ID without exposing the FCM token.
 * @param {string} token FCM registration token.
 * @return {string} SHA-256 document ID.
 */
export function getPushSubscriptionId(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * Validates and normalizes a browser subscription request.
 * @param {*} value Untrusted request body.
 * @return {{token: string, enabled: boolean}} Payload.
 */
export function normalizePushSubscriptionPayload(value) {
  const source = value && typeof value === "object" ? value : {};
  const token = String(source.token || "").trim();
  const enabled = source.enabled !== false;

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new Error("A valid push subscription token is required.");
  }

  return {token, enabled};
}

/**
 * Validates and normalizes an admin-authored notification.
 * @param {*} value Untrusted request body.
 * @return {{title: string, message: string, link: string}} Payload.
 */
export function normalizePushMessagePayload(value) {
  const source = value && typeof value === "object" ? value : {};
  const title = String(source.title || "").trim();
  const message = String(source.message || "").trim();
  const rawLink = String(source.link || "").trim();

  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new Error("Enter a notification title of 80 characters or fewer.");
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Enter a message of 240 characters or fewer.");
  }

  let link = DEFAULT_PUSH_LINK;
  if (rawLink) {
    if (rawLink.length > MAX_LINK_LENGTH) {
      throw new Error("The notification link is too long.");
    }
    try {
      const parsed = new URL(rawLink, DEFAULT_PUSH_LINK);
      if (parsed.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
      link = parsed.toString();
    } catch (error) {
      throw new Error("Enter a valid https notification link.");
    }
  }

  return {title, message, link};
}

/**
 * Validates a notification and its future delivery time.
 * @param {*} value Untrusted request body.
 * @param {number} nowMs Current time for validation.
 * @return {{title: string, message: string, link: string,
 *   scheduledFor: string}} Scheduled payload.
 */
export function normalizePushSchedulePayload(value, nowMs = Date.now()) {
  const payload = normalizePushMessagePayload(value);
  const source = value && typeof value === "object" ? value : {};
  const scheduledFor = new Date(String(source.scheduledFor || "").trim());
  const scheduledForMs = scheduledFor.getTime();

  if (!Number.isFinite(scheduledForMs)) {
    throw new Error("Choose a valid date and time for this notification.");
  }
  if (scheduledForMs <= Number(nowMs)) {
    throw new Error("Schedule the notification for a future time.");
  }
  if (scheduledForMs > Number(nowMs) + MAX_SCHEDULE_AHEAD_MS) {
    throw new Error("Schedule notifications no more than one year ahead.");
  }

  return {...payload, scheduledFor: scheduledFor.toISOString()};
}

/**
 * Creates the public subscribe/unsubscribe HTTP handler.
 * @param {object} dependencies Handler dependencies.
 * @return {Function} HTTP handler.
 */
export function createPushSubscriptionHandler({firestore, fieldValue}) {
  return async function pushSubscriptionHandler(request, response) {
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const payload = normalizePushSubscriptionPayload(request.body);
      const documentRef = firestore
          .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
          .doc(getPushSubscriptionId(payload.token));

      if (!payload.enabled) {
        await documentRef.delete();
        response.set("Cache-Control", "no-store");
        response.status(200).json({ok: true, enabled: false});
        return;
      }

      await documentRef.set({
        token: payload.token,
        enabled: true,
        createdAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
      }, {merge: true});

      response.set("Cache-Control", "no-store");
      response.status(200).json({ok: true, enabled: true});
    } catch (error) {
      response.status(400).json({
        error: error && error.message ? error.message :
          "Unable to update push notifications.",
      });
    }
  };
}

/**
 * Delivers a normalized message to every enabled subscription.
 * @param {object} dependencies Delivery dependencies and message.
 * @return {Promise<object>} Delivery counts.
 */
export async function deliverPushMessage({
  firestore,
  fieldValue,
  messaging,
  payload,
  sender,
  source = "immediate",
  scheduledNotificationId = "",
}) {
  const snapshot = await firestore
      .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
      .where("enabled", "==", true)
      .get();
  const subscriptions = snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        token: String(documentSnapshot.get("token") || "").trim(),
      }))
      .filter((subscription) => subscription.token);

  let successCount = 0;
  let failureCount = 0;
  const invalidIds = [];

  for (let index = 0; index < subscriptions.length;
    index += MULTICAST_LIMIT) {
    const batch = subscriptions.slice(index, index + MULTICAST_LIMIT);
    const result = await messaging.sendEachForMulticast({
      tokens: batch.map((subscription) => subscription.token),
      data: {
        title: payload.title,
        message: payload.message,
        link: payload.link,
      },
      webpush: {
        headers: {Urgency: "high"},
      },
    });
    successCount += Number(result.successCount || 0);
    failureCount += Number(result.failureCount || 0);
    (result.responses || []).forEach((item, itemIndex) => {
      const code = item && item.error && item.error.code;
      if (!item.success && INVALID_TOKEN_CODES.has(code)) {
        invalidIds.push(batch[itemIndex].id);
      }
    });
  }

  for (let index = 0; index < invalidIds.length; index += MULTICAST_LIMIT) {
    const deleteBatch = firestore.batch();
    invalidIds.slice(index, index + MULTICAST_LIMIT).forEach((id) => {
      deleteBatch.delete(
          firestore.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(id),
      );
    });
    await deleteBatch.commit();
  }

  await firestore.collection(PUSH_HISTORY_COLLECTION).add({
    ...payload,
    source,
    scheduledNotificationId: scheduledNotificationId || null,
    senderUid: String(sender && sender.uid || ""),
    senderEmail: String(sender && sender.email || ""),
    recipientCount: subscriptions.length,
    successCount,
    failureCount,
    createdAt: fieldValue.serverTimestamp(),
  });

  return {
    recipientCount: subscriptions.length,
    successCount,
    failureCount,
    removedInvalidTokens: invalidIds.length,
  };
}

/**
 * Creates the authenticated admin notification sender.
 * @param {object} dependencies Handler dependencies.
 * @return {Function} HTTP handler.
 */
export function createPushSendHandler({
  firestore,
  fieldValue,
  messaging,
  verifySender,
}) {
  return async function pushSendHandler(request, response) {
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const sender = await verifySender(request);
      const payload = normalizePushMessagePayload(request.body);
      const result = await deliverPushMessage({
        firestore,
        fieldValue,
        messaging,
        payload,
        sender,
      });

      response.set("Cache-Control", "no-store");
      response.status(200).json({ok: true, ...result});
    } catch (error) {
      respondWithPushError_(response, error, "Unable to send notification.");
    }
  };
}

/**
 * Creates the authenticated scheduled notification CRUD handler.
 * @param {object} dependencies Handler dependencies.
 * @return {Function} HTTP handler.
 */
export function createPushScheduleHandler({
  firestore,
  fieldValue,
  verifySender,
}) {
  return async function pushScheduleHandler(request, response) {
    if (request.method !== "GET" && request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const sender = await verifySender(request);
      if (request.method === "GET") {
        const [scheduleSnapshot, subscriptionSnapshot] = await Promise.all([
          firestore
              .collection(PUSH_SCHEDULED_COLLECTION)
              .orderBy("scheduledFor", "desc")
              .limit(100)
              .get(),
          firestore
              .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
              .where("enabled", "==", true)
              .get(),
        ]);
        const notifications = scheduleSnapshot.docs
            .map(serializeScheduledNotification_)
            .sort(compareScheduledNotifications_);
        const subscriberCount = subscriptionSnapshot.docs.filter(
            (documentSnapshot) => {
              return String(documentSnapshot.get("token") || "").trim();
            },
        ).length;
        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          notifications,
          subscriberCount,
        });
        return;
      }

      const source = request.body && typeof request.body === "object" ?
        request.body : {};
      const action = String(source.action || "create").trim().toLowerCase();
      if (action === "create") {
        const payload = normalizePushSchedulePayload(source);
        const documentRef = firestore
            .collection(PUSH_SCHEDULED_COLLECTION)
            .doc();
        await documentRef.set({
          ...payload,
          scheduledFor: new Date(payload.scheduledFor),
          status: "scheduled",
          createdByUid: sender.uid,
          createdByEmail: sender.email,
          updatedByUid: sender.uid,
          updatedByEmail: sender.email,
          createdAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp(),
        });
        response.set("Cache-Control", "no-store");
        response.status(201).json({
          ok: true,
          notification: {
            id: documentRef.id,
            ...payload,
            status: "scheduled",
          },
        });
        return;
      }

      const notificationId = normalizeScheduledNotificationId_(source.id);
      const documentRef = firestore
          .collection(PUSH_SCHEDULED_COLLECTION)
          .doc(notificationId);
      if (action === "update") {
        const payload = normalizePushSchedulePayload(source);
        await firestore.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          assertScheduledNotificationEditable_(snapshot);
          transaction.update(documentRef, {
            ...payload,
            scheduledFor: new Date(payload.scheduledFor),
            updatedByUid: sender.uid,
            updatedByEmail: sender.email,
            updatedAt: fieldValue.serverTimestamp(),
          });
        });
        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          notification: {
            id: notificationId,
            ...payload,
            status: "scheduled",
          },
        });
        return;
      }

      if (action === "cancel") {
        await firestore.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          assertScheduledNotificationEditable_(snapshot);
          transaction.update(documentRef, {
            status: "canceled",
            canceledByUid: sender.uid,
            canceledByEmail: sender.email,
            canceledAt: fieldValue.serverTimestamp(),
            updatedAt: fieldValue.serverTimestamp(),
          });
        });
        response.set("Cache-Control", "no-store");
        response.status(200).json({ok: true, id: notificationId});
        return;
      }

      throw createPushError_("Unsupported schedule action.", 400);
    } catch (error) {
      respondWithPushError_(
          response,
          error,
          "Unable to update the scheduled notification.",
      );
    }
  };
}

/**
 * Creates the scheduled function that claims and sends due notifications.
 * @param {object} dependencies Dispatcher dependencies.
 * @return {Function} Scheduled dispatcher.
 */
export function createPushScheduleDispatcher({
  firestore,
  fieldValue,
  messaging,
  now = () => new Date(),
}) {
  return async function dispatchScheduledPushNotifications() {
    const nowDate = now();
    const snapshot = await firestore
        .collection(PUSH_SCHEDULED_COLLECTION)
        .where("status", "==", "scheduled")
        .get();
    const dueDocuments = snapshot.docs
        .filter((documentSnapshot) => {
          const scheduledForMs = getFirestoreDateMs_(
              documentSnapshot.get("scheduledFor"),
          );
          return Number.isFinite(scheduledForMs) &&
            scheduledForMs <= nowDate.getTime();
        })
        .sort((leftDocument, rightDocument) => {
          return getFirestoreDateMs_(leftDocument.get("scheduledFor")) -
            getFirestoreDateMs_(rightDocument.get("scheduledFor"));
        })
        .slice(0, MAX_SCHEDULED_DISPATCHES);

    const summary = {
      dueCount: dueDocuments.length,
      sentCount: 0,
      failedCount: 0,
    };
    for (const documentSnapshot of dueDocuments) {
      const documentRef = firestore
          .collection(PUSH_SCHEDULED_COLLECTION)
          .doc(documentSnapshot.id);
      const claimed = await firestore.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(documentRef);
        const scheduledForMs = currentSnapshot.exists ? getFirestoreDateMs_(
            currentSnapshot.get("scheduledFor"),
        ) : NaN;
        if (!currentSnapshot.exists ||
          currentSnapshot.get("status") !== "scheduled" ||
          !Number.isFinite(scheduledForMs) ||
          scheduledForMs > nowDate.getTime()) {
          return null;
        }
        transaction.update(documentRef, {
          status: "sending",
          sendingStartedAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp(),
        });
        return currentSnapshot;
      });

      if (!claimed) continue;
      try {
        const payload = normalizePushMessagePayload({
          title: claimed.get("title"),
          message: claimed.get("message"),
          link: claimed.get("link"),
        });
        const sender = {
          uid: String(claimed.get("createdByUid") || ""),
          email: String(claimed.get("createdByEmail") || ""),
        };
        const result = await deliverPushMessage({
          firestore,
          fieldValue,
          messaging,
          payload,
          sender,
          source: "scheduled",
          scheduledNotificationId: documentSnapshot.id,
        });
        await documentRef.update({
          status: "sent",
          sentAt: fieldValue.serverTimestamp(),
          recipientCount: result.recipientCount,
          successCount: result.successCount,
          failureCount: result.failureCount,
          removedInvalidTokens: result.removedInvalidTokens,
          updatedAt: fieldValue.serverTimestamp(),
        });
        summary.sentCount += 1;
      } catch (error) {
        await documentRef.update({
          status: "failed",
          failedAt: fieldValue.serverTimestamp(),
          error: String(error && error.message || "Notification send failed."),
          updatedAt: fieldValue.serverTimestamp(),
        });
        summary.failedCount += 1;
      }
    }

    return summary;
  };
}

/**
 * Converts a scheduled Firestore document to an Admin response object.
 * @param {object} documentSnapshot Firestore document snapshot.
 * @return {object} Serializable notification.
 */
function serializeScheduledNotification_(documentSnapshot) {
  const data = documentSnapshot.data() || {};
  return {
    id: documentSnapshot.id,
    title: String(data.title || ""),
    message: String(data.message || ""),
    link: String(data.link || DEFAULT_PUSH_LINK),
    status: String(data.status || "scheduled"),
    scheduledFor: toIsoString_(data.scheduledFor),
    sentAt: toIsoString_(data.sentAt),
    canceledAt: toIsoString_(data.canceledAt),
    failedAt: toIsoString_(data.failedAt),
    recipientCount: Number(data.recipientCount || 0),
    successCount: Number(data.successCount || 0),
    failureCount: Number(data.failureCount || 0),
    error: String(data.error || ""),
  };
}

/**
 * Sorts upcoming notifications first, then recent completed items.
 * @param {object} left Left item.
 * @param {object} right Right item.
 * @return {number} Sort order.
 */
function compareScheduledNotifications_(left, right) {
  const leftPending = left.status === "scheduled";
  const rightPending = right.status === "scheduled";
  if (leftPending !== rightPending) return leftPending ? -1 : 1;
  const leftTime = new Date(left.scheduledFor || 0).getTime();
  const rightTime = new Date(right.scheduledFor || 0).getTime();
  return leftPending ? leftTime - rightTime : rightTime - leftTime;
}

/**
 * Validates a scheduled document ID.
 * @param {*} value Untrusted ID.
 * @return {string} Validated ID.
 */
function normalizeScheduledNotificationId_(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 200 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw createPushError_("Choose a valid scheduled notification.", 400);
  }
  return id;
}

/**
 * Ensures a scheduled notification exists and can still be changed.
 * @param {object} snapshot Firestore document snapshot.
 */
function assertScheduledNotificationEditable_(snapshot) {
  if (!snapshot.exists) {
    throw createPushError_(
        "That scheduled notification no longer exists.",
        404,
    );
  }
  if (snapshot.get("status") !== "scheduled") {
    throw createPushError_(
        "Only notifications that are still scheduled can be changed.",
        409,
    );
  }
}

/**
 * Converts supported Firestore date values to milliseconds.
 * @param {*} value Firestore timestamp, Date, or date-like value.
 * @return {number} Milliseconds or NaN.
 */
function getFirestoreDateMs_(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  return new Date(value || "").getTime();
}

/**
 * Converts supported Firestore date values to ISO text.
 * @param {*} value Firestore timestamp, Date, or date-like value.
 * @return {string} ISO text or blank.
 */
function toIsoString_(value) {
  const milliseconds = getFirestoreDateMs_(value);
  return Number.isFinite(milliseconds) ?
    new Date(milliseconds).toISOString() : "";
}

/**
 * Creates an HTTP-friendly push notification error.
 * @param {string} message User-facing message.
 * @param {number} statusCode HTTP status code.
 * @return {Error} Error.
 */
function createPushError_(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Sends a consistent JSON error response.
 * @param {object} response HTTP response.
 * @param {*} error Caught error.
 * @param {string} fallback Fallback message.
 */
function respondWithPushError_(response, error, fallback) {
  const statusCode = error && error.statusCode ? error.statusCode : 400;
  response.status(statusCode).json({
    error: error && error.message ? error.message : fallback,
  });
}
