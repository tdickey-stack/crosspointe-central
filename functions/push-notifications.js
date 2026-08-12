import {createHash} from "node:crypto";

export const PUSH_SUBSCRIPTIONS_COLLECTION = "centralPushSubscriptions";
export const PUSH_HISTORY_COLLECTION = "centralPushNotifications";

const MAX_TOKEN_LENGTH = 4096;
const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 240;
const MAX_LINK_LENGTH = 500;
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

  return {
    token,
    enabled,
  };
}

/**
 * Validates and normalizes an admin-authored notification.
 * @param {*} value Untrusted request body.
 * @param {string} origin Request origin for relative links.
 * @return {{title: string, message: string, link: string}} Payload.
 */
export function normalizePushMessagePayload(value, origin) {
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

  let link = new URL(
      "/",
      origin || "https://central.crosspointe.tv",
  ).toString();
  if (rawLink) {
    if (rawLink.length > MAX_LINK_LENGTH) {
      throw new Error("The notification link is too long.");
    }
    try {
      const parsed = new URL(rawLink, origin || "https://central.crosspointe.tv");
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
      const payload = normalizePushMessagePayload(
          request.body,
          getRequestOrigin(request),
      );
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
        senderUid: sender.uid,
        senderEmail: sender.email,
        recipientCount: subscriptions.length,
        successCount,
        failureCount,
        createdAt: fieldValue.serverTimestamp(),
      });

      response.set("Cache-Control", "no-store");
      response.status(200).json({
        ok: true,
        recipientCount: subscriptions.length,
        successCount,
        failureCount,
        removedInvalidTokens: invalidIds.length,
      });
    } catch (error) {
      const statusCode = error && error.statusCode ? error.statusCode : 400;
      response.status(statusCode).json({
        error: error && error.message ? error.message :
          "Unable to send the push notification.",
      });
    }
  };
}

/**
 * Returns the canonical origin represented by an HTTP request.
 * @param {object} request HTTP request.
 * @return {string} Request origin.
 */
function getRequestOrigin(request) {
  const forwardedProtocol = String(request.get("x-forwarded-proto") || "")
      .split(",")[0]
      .trim();
  const protocol = forwardedProtocol || request.protocol || "https";
  const host = String(request.get("host") || "central.crosspointe.tv").trim();
  return protocol + "://" + host;
}
