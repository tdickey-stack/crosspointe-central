/* eslint-disable require-jsdoc, max-len */
import {createHash, randomUUID} from "node:crypto";
import {isRetryableChangeRequestDeliveryError} from "../change-requests/delivery.js";
import {
  canReceivePlannerNotifications,
  getPlannerNotificationPreferences,
  PLANNER_NOTIFICATION_RECIPIENT_UID,
} from "./notification-preferences.js";

export const PLANNER_NOTIFICATION_EVENTS_PATH = "centralAdmin/root/plannerNotificationEvents";
export const PLANNER_REQUESTS_PATH = "centralPromotionRequests";
const USERS_PATH = "centralAdmin/root/users";
const LEASE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function plannerReminderDate(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(now));
}

export function buildPlannerNotification(requests, kind) {
  const count = requests.length;
  const subject = kind === "submitted" ? "New Central Planner request" :
    `${count} Central Planner request${count === 1 ? "" : "s"} awaiting review`;
  const lines = [subject, "", ...requests.slice(0, 12).map((request) =>
    `• ${String(request.proposedName || "Untitled promotion request").slice(0, 140)}${request.ministry ? " — " + String(request.ministry).slice(0, 140) : ""}`)];
  if (count > 12) lines.push(`And ${count - 12} more awaiting review.`);
  lines.push("", "Review requests: https://central.crosspointe.tv/planner?view=requests");
  return {subject, text: lines.join("\n")};
}

// A server-only outbox records independent channel outcomes. A trigger and a
// bounded scheduled drain share a transactional lease, so duplicate invocations
// do not ordinarily resend messages. As with other provider sends, a process
// crash after delivery but before acknowledgement can still produce a duplicate.
export function createPlannerRequestNotificationRuntime({
  firestore, fieldValue, sendEmail, sendPumble, degradeConnection = async () => {}, now = Date.now,
}) {
  const events = firestore.collection(PLANNER_NOTIFICATION_EVENTS_PATH);
  const requests = firestore.collection(PLANNER_REQUESTS_PATH);
  const userRef = firestore.collection(USERS_PATH).doc(PLANNER_NOTIFICATION_RECIPIENT_UID);

  async function enqueue(kind, requestId = "", scheduledAt = now()) {
    const date = plannerReminderDate(scheduledAt);
    const eventId = kind === "submitted" ? "submitted_" + createHash("sha256").update(requestId).digest("hex") : "reminder_" + date;
    try {
      await events.doc(eventId).create({
        kind, requestId, date, state: "pending", attempts: 0, channels: {},
        nextAttemptAtMs: now(), createdAtMs: now(),
      });
    } catch (error) {
      if (!["6", "already-exists", "already_exists"].includes(String(error.code))) throw error;
    }
    return eventId;
  }

  async function currentContent(event) {
    if (event.kind === "submitted") {
      const snapshot = await requests.doc(event.requestId).get();
      return snapshot.exists && snapshot.data().status === "pending-review" ? [snapshot.data()] : [];
    }
    // Do not send a previous day's reminder after an outage.
    if (event.date !== plannerReminderDate(now())) return [];
    const snapshot = await requests.where("status", "==", "pending-review").get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async function dispatch(eventId) {
    const ref = events.doc(eventId);
    const leaseId = randomUUID();
    const event = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if (data.state !== "pending" || data.nextAttemptAtMs > now()) return null;
      const claimed = {...data, leaseId, attempts: data.attempts + 1, nextAttemptAtMs: now() + LEASE_MS};
      transaction.update(ref, claimed);
      return claimed;
    });
    if (!event) return {claimed: false};

    async function update(patch) {
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.data()?.leaseId !== leaseId) throw new Error("Planner notification lease lost.");
        transaction.update(ref, {...patch, updatedAtMs: now()});
      });
    }

    try {
      const channels = {...event.channels};
      for (const channel of ["email", "pumble"]) {
        if (["sent", "skipped", "failed"].includes(channels[channel]?.state)) continue;
        // Recheck permissions, preferences, connection and pending status before
        // each delivery, including retry attempts and morning digests.
        const userSnapshot = await userRef.get();
        const user = userSnapshot.data();
        const prefs = getPlannerNotificationPreferences(user);
        const pending = await currentContent(event);
        const connection = user?.notificationIntegrations?.pumble;
        const linked = connection?.status === "linked" && connection.userId && connection.botId && connection.workspaceId;
        const eligible = canReceivePlannerNotifications(userSnapshot.id, user) &&
          prefs[channel] && (event.kind !== "reminder" || prefs.reminders) && pending.length > 0 &&
          (channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email || "") : linked);
        if (!eligible) {
          channels[channel] = {state: "skipped"};
        } else {
          try {
            const message = buildPlannerNotification(pending, event.kind);
            const result = channel === "email" ? await sendEmail({to: user.email, ...message}) :
              await sendPumble({recipientUserId: connection.userId, botUserId: connection.botId, text: message.text});
            channels[channel] = {state: "sent", sentAtMs: now(), messageId: String(result?.messageId || result?.id || "").slice(0, 500)};
          } catch (error) {
            const retryable = isRetryableChangeRequestDeliveryError(error);
            if (channel === "pumble" && !retryable) {
              try {
                await degradeConnection(userSnapshot.id, error);
              } catch (degradeError) {
                console.error("Planner Pumble connection update failed.", {
                  code: String(degradeError?.code || "update-failed"),
                });
              }
            }
            channels[channel] = {
              state: !retryable || event.attempts >= MAX_ATTEMPTS ? "failed" : "retry",
              code: String(error?.code || "delivery-failed").slice(0, 120),
            };
          }
        }
        await update({channels});
      }
      const retry = Object.values(channels).some((channel) => channel.state === "retry");
      const failed = Object.values(channels).some((channel) => channel.state === "failed");
      const state = retry ? "pending" : failed ? "failed" : "complete";
      await update({state, nextAttemptAtMs: retry ? now() + Math.min(60 * 60 * 1000, 60000 * 2 ** (event.attempts - 1)) : fieldValue.delete()});
      return {claimed: true, state};
    } catch (error) {
      // Database/lookup failures are retried after the lease, with a finite cap.
      await update({
        state: event.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        nextAttemptAtMs: event.attempts >= MAX_ATTEMPTS ? fieldValue.delete() : now() + LEASE_MS,
        lastErrorCode: String(error?.code || "dispatch-failed").slice(0, 120),
      });
      throw error;
    }
  }

  async function drain() {
    const due = await events.where("nextAttemptAtMs", "<=", now()).orderBy("nextAttemptAtMs").limit(50).get();
    const results = await Promise.allSettled(due.docs.map((doc) => dispatch(doc.id)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) throw new Error(`${failures.length} Planner notification events could not be dispatched.`);
    return results.length;
  }

  return {enqueue, dispatch, drain};
}
