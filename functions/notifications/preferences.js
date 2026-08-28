import {
  canReceiveChangeRequestNotifications,
  getChangeRequestNotificationPreferences,
} from "../change-requests/preferences.js";

const USABLE_ADMIN_PERMISSIONS = new Set([
  "view",
  "propose",
  "edit",
  "approve",
  "admin",
]);

/**
 * Returns the Pumble notification types selected by one Admin user.
 *
 * @param {*} user Central Admin user document data.
 * @return {{changeRequests: boolean, serveNeeds: boolean}} Selected types.
 */
export function getAdminPumbleNotificationPreferences(user) {
  const source = user && typeof user === "object" ? user : {};
  const notifications = source.notificationPreferences &&
    typeof source.notificationPreferences === "object" ?
    source.notificationPreferences : {};
  const serveNeeds = notifications.serveNeeds &&
    typeof notifications.serveNeeds === "object" ?
    notifications.serveNeeds : {};

  return {
    changeRequests: getChangeRequestNotificationPreferences(source).pumble,
    serveNeeds: serveNeeds.pumble === true,
  };
}

/**
 * Returns which Pumble notification types one Admin account may receive.
 *
 * @param {*} user Central Admin user document data.
 * @return {{changeRequests: boolean, serveNeeds: boolean}} Eligibility flags.
 */
export function getAdminPumbleNotificationEligibility(user) {
  const source = user && typeof user === "object" ? user : {};
  const pageAccess = source.pageAccess &&
    typeof source.pageAccess === "object" ? source.pageAccess : {};
  const serveNeedsPermission = normalizePermission_(
      Object.prototype.hasOwnProperty.call(pageAccess, "serveNeeds") ?
        pageAccess.serveNeeds : pageAccess.settings,
  );

  return {
    changeRequests: canReceiveChangeRequestNotifications(source),
    serveNeeds: source.active === true &&
      USABLE_ADMIN_PERMISSIONS.has(serveNeedsPermission),
  };
}

/**
 * Validates the Admin endpoint's Pumble notification selection.
 *
 * @param {*} value Proposed selection.
 * @return {{changeRequests: boolean, serveNeeds: boolean}} Valid selection.
 */
export function normalizeAdminPumbleNotificationSelection(value) {
  const source = value && typeof value === "object" &&
    !Array.isArray(value) ? value : null;
  if (!source || typeof source.changeRequests !== "boolean" ||
    typeof source.serveNeeds !== "boolean") {
    throw new Error(
        "Pumble notification selections must include Change Requests and " +
        "Serve Needs settings.",
    );
  }

  return {
    changeRequests: source.changeRequests,
    serveNeeds: source.serveNeeds,
  };
}

/**
 * Serializes a linked Pumble recipient for Serve Needs delivery.
 *
 * @param {*} uid Admin user document ID.
 * @param {*} user Central Admin user document data.
 * @return {Object|null} Delivery recipient or null when ineligible.
 */
export function getEligibleServeNeedPumbleRecipient(uid, user) {
  const normalizedUid = String(uid || "").trim().slice(0, 500);
  const source = user && typeof user === "object" ? user : {};
  const preferences = getAdminPumbleNotificationPreferences(source);
  const eligibility = getAdminPumbleNotificationEligibility(source);
  const integrations = source.notificationIntegrations &&
    typeof source.notificationIntegrations === "object" ?
    source.notificationIntegrations : {};
  const pumble = integrations.pumble &&
    typeof integrations.pumble === "object" ? integrations.pumble : {};
  const userId = String(pumble.userId || "").trim().slice(0, 500);
  const botId = String(pumble.botId || "").trim().slice(0, 500);
  const workspaceId = String(pumble.workspaceId || "").trim().slice(0, 500);
  const linked = String(pumble.status || "").trim().toLowerCase() ===
    "linked" && !!userId && !!botId && !!workspaceId;

  if (!normalizedUid || !eligibility.serveNeeds ||
    !preferences.serveNeeds || !linked) {
    return null;
  }

  return {
    uid: normalizedUid,
    displayName: String(
        source.displayName || source.name || source.email || "Admin",
    ).trim().slice(0, 160),
    pumbleUserId: userId,
    pumbleBotUserId: botId,
  };
}

/**
 * @param {*} value Stored Admin permission.
 * @return {string} Normalized permission.
 */
function normalizePermission_(value) {
  return String(value || "none").trim().toLowerCase() || "none";
}
