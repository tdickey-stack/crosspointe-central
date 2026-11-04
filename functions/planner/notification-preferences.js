/* eslint-disable require-jsdoc */
// Explicit initial rollout recipient, verified against Central's user record.
// Page access alone must never enroll additional reviewers.
export const PLANNER_NOTIFICATION_RECIPIENT_UID =
  "tZkRZgzHwAczbw8USKVhFtExxqK2";

export function canReceivePlannerNotifications(uid, user) {
  const access = user?.pageAccess || {};
  const permission = access.planner ?? access.studio ??
    access.settings ?? "none";
  return uid === PLANNER_NOTIFICATION_RECIPIENT_UID && user?.active === true &&
    ["propose", "edit", "approve", "admin"].includes(permission);
}

export function getPlannerNotificationPreferences(user) {
  const source = user?.notificationPreferences?.plannerRequests || {};
  return {
    email: source.email !== false,
    pumble: source.pumble !== false,
    reminders: source.reminders !== false,
  };
}

// A broken/disconnected Pumble link must not strand a Pumble-only subscriber.
export function disconnectPlannerNotificationPreferences(user) {
  const preferences = getPlannerNotificationPreferences(user);
  return {
    ...preferences,
    email: preferences.email || preferences.pumble,
    pumble: false,
  };
}
