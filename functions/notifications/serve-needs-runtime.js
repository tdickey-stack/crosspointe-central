import {isRetryableChangeRequestDeliveryError} from
  "../change-requests/delivery.js";
import {getEligibleServeNeedPumbleRecipient} from "./preferences.js";
import {buildServeNeedPumbleNotificationText} from "./serve-needs.js";

/**
 * Creates the server-side Serve Needs Pumble notification runtime.
 *
 * @param {Object} options Injected Firestore and Pumble dependencies.
 * @return {{notify: Function}} Notification runtime.
 */
export function createServeNeedPumbleNotificationRuntime(options = {}) {
  const firestore = requireObject_(options.firestore, "firestore");
  const fieldValue = requireObject_(options.fieldValue, "fieldValue");
  const transport = requireObject_(options.transport, "transport");
  const degradeConnection = requireFunction_(
      options.degradeConnection,
      "degradeConnection",
  );
  const usersCollectionPath = String(options.usersCollectionPath || "").trim();
  const interestsCollectionPath = String(
      options.interestsCollectionPath || "",
  ).trim();
  const timeZone = String(options.timeZone || "America/Chicago").trim();
  if (!usersCollectionPath || !interestsCollectionPath ||
    typeof transport.send !== "function") {
    throw new Error("Serve Needs Pumble runtime configuration is incomplete.");
  }

  /**
   * Delivers a submitted Serve Need response to eligible Pumble recipients.
   *
   * @param {string} interestId Persisted Serve Need interest ID.
   * @param {Object} interestData Persisted response data.
   * @return {Promise<void>}
   */
  async function notify(interestId, interestData) {
    const usersSnapshot = await firestore
        .collection(usersCollectionPath)
        .where("active", "==", true)
        .get();
    const recipients = usersSnapshot.docs.map((snapshot) => {
      return getEligibleServeNeedPumbleRecipient(
          snapshot.id,
          snapshot.data(),
      );
    }).filter(Boolean);
    const interestRef = firestore
        .collection(interestsCollectionPath)
        .doc(String(interestId || "").trim());

    if (!recipients.length) {
      await interestRef.set({
        pumbleNotificationStatus: "skipped",
        pumbleNotificationRecipientCount: 0,
        pumbleNotificationSentCount: 0,
        pumbleNotificationFailedCount: 0,
        pumbleNotificationMessageIds: [],
        pumbleNotificationErrorCodes: [],
        pumbleNotificationSentAt: fieldValue.delete(),
        pumbleNotificationUpdatedAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
      }, {merge: true});
      return;
    }

    const submittedAt = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    });
    const text = buildServeNeedPumbleNotificationText(
        interestData,
        submittedAt,
    );
    const outcomes = await Promise.all(recipients.map(async (recipient) => {
      try {
        const result = await transport.send({
          recipientUserId: recipient.pumbleUserId,
          botUserId: recipient.pumbleBotUserId,
          text,
        });
        return {
          ok: true,
          messageId: String(result && result.messageId || "").trim(),
        };
      } catch (error) {
        if (!isRetryableChangeRequestDeliveryError(error)) {
          try {
            await degradeConnection(recipient.uid, error);
          } catch (degradeError) {
            console.error("Unable to mark a failed Pumble connection.", {
              recipientUid: recipient.uid,
              code: String(degradeError && degradeError.code || ""),
            });
          }
        }
        const errorCode = normalizeErrorCode_(error && error.code);
        console.error("Serve Need Pumble delivery failed.", {
          recipientUid: recipient.uid,
          code: errorCode,
        });
        return {ok: false, errorCode};
      }
    }));
    const sent = outcomes.filter((outcome) => outcome.ok);
    const failed = outcomes.filter((outcome) => !outcome.ok);

    await interestRef.set({
      pumbleNotificationStatus: failed.length ?
        (sent.length ? "partial" : "failed") : "sent",
      pumbleNotificationRecipientCount: recipients.length,
      pumbleNotificationSentCount: sent.length,
      pumbleNotificationFailedCount: failed.length,
      pumbleNotificationMessageIds: sent.map((outcome) => {
        return outcome.messageId;
      }).filter(Boolean).slice(0, 50),
      pumbleNotificationErrorCodes: [...new Set(failed.map((outcome) => {
        return outcome.errorCode;
      }).filter(Boolean))].slice(0, 20),
      pumbleNotificationSentAt: sent.length ?
        fieldValue.serverTimestamp() : fieldValue.delete(),
      pumbleNotificationUpdatedAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp(),
    }, {merge: true});
  }

  return {notify};
}

/**
 * Normalizes a Pumble delivery error code before persistence.
 *
 * @param {*} value Candidate error code.
 * @return {string} Safe stable error code.
 */
function normalizeErrorCode_(value) {
  const code = String(value || "").trim().toLowerCase();
  return /^pumble-[a-z0-9-]{1,80}$/.test(code) ?
    code : "pumble-delivery-failed";
}

/**
 * Requires a function dependency.
 *
 * @param {*} value Candidate dependency.
 * @param {string} label Dependency label.
 * @return {Function} Validated dependency.
 */
function requireFunction_(value, label) {
  if (typeof value === "function") return value;
  throw new Error("Serve Needs Pumble runtime requires " + label + ".");
}

/**
 * Requires an object dependency.
 *
 * @param {*} value Candidate dependency.
 * @param {string} label Dependency label.
 * @return {Object} Validated dependency.
 */
function requireObject_(value, label) {
  if (value && typeof value === "object") return value;
  throw new Error("Serve Needs Pumble runtime requires " + label + ".");
}
