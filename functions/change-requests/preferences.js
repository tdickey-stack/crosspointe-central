export const CHANGE_REQUEST_EMAIL_CHANNEL = "email";
export const CHANGE_REQUEST_PUMBLE_CHANNEL = "pumble";

const REVIEW_PERMISSIONS = new Set(["approve", "admin"]);

/**
 * Normalizes one user's Change Request notification preferences.
 *
 * Existing eligible reviewers default to email notifications so introducing
 * the preference field does not silently disable the new workflow. Pumble is
 * always opt-in.
 *
 * @param {*} value Stored preference value.
 * @param {Object} options Default overrides.
 * @return {{email: boolean, pumble: boolean}} Normalized preferences.
 */
export function normalizeChangeRequestNotificationPreferences(
    value,
    options = {},
) {
  const source = value && typeof value === "object" ? value : {};
  if (Array.isArray(source.channels)) {
    return normalizeChangeRequestNotificationChannelSelection(
        source.channels,
        options,
    );
  }
  const defaultEmail = options.defaultEmail !== false;

  return {
    email: typeof source.email === "boolean" ? source.email : defaultEmail,
    pumble: source.pumble === true,
  };
}

/**
 * Normalizes the endpoint's channel-array preference contract for storage.
 *
 * @param {*} value Channel array or `{channels}` object.
 * @param {Object} options Default overrides.
 * @return {{email: boolean, pumble: boolean}} Storage-ready preferences.
 */
export function normalizeChangeRequestNotificationChannelSelection(
    value,
    options = {},
) {
  if (value && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "channels") &&
    !Array.isArray(value.channels)) {
    throw new Error("Notification channels must be an array.");
  }
  const rawChannels = Array.isArray(value) ? value :
    (value && Array.isArray(value.channels) ? value.channels : null);
  if (!rawChannels) {
    return normalizeChangeRequestNotificationPreferences(value, options);
  }

  const channels = new Set(rawChannels.map((channel) => {
    return String(channel || "").trim().toLowerCase();
  }).filter(Boolean));
  const invalidChannels = [...channels].filter((channel) => {
    return channel !== CHANGE_REQUEST_EMAIL_CHANNEL &&
      channel !== CHANGE_REQUEST_PUMBLE_CHANNEL;
  });

  if (invalidChannels.length) {
    throw new Error("Choose only email or Pumble notification channels.");
  }

  return {
    email: channels.has(CHANGE_REQUEST_EMAIL_CHANNEL),
    pumble: channels.has(CHANGE_REQUEST_PUMBLE_CHANNEL),
  };
}

/**
 * Serializes stored preferences for the Admin endpoint and UI.
 *
 * @param {*} value Stored preference value.
 * @param {Object} options Default overrides.
 * @return {{channels: string[]}} Endpoint response preference shape.
 */
export function serializeChangeRequestNotificationPreferences(
    value,
    options = {},
) {
  const preferences = normalizeChangeRequestNotificationPreferences(
      value,
      options,
  );
  const channels = [];
  if (preferences.email) channels.push(CHANGE_REQUEST_EMAIL_CHANNEL);
  if (preferences.pumble) channels.push(CHANGE_REQUEST_PUMBLE_CHANNEL);
  return {channels};
}

/**
 * Removes Pumble from stored preferences while preserving notification safety.
 *
 * Disconnecting a selected Pumble channel always falls back to Email so an
 * administrator cannot silently stop receiving Change Request notifications.
 *
 * @param {*} value Stored preference value.
 * @return {{email: boolean, pumble: boolean}} Storage-ready preferences.
 */
export function disconnectPumbleNotificationPreferences(value) {
  const preferences = normalizeChangeRequestNotificationPreferences(value);
  if (!preferences.pumble) return preferences;
  return {email: true, pumble: false};
}

/**
 * Returns the nested Change Request preferences from an admin-user document.
 *
 * @param {*} user Admin-user document data.
 * @param {Object} options Default overrides.
 * @return {{email: boolean, pumble: boolean}} Normalized preferences.
 */
export function getChangeRequestNotificationPreferences(
    user,
    options = {},
) {
  const source = user && typeof user === "object" ? user : {};
  const notifications = source.notificationPreferences &&
    typeof source.notificationPreferences === "object" ?
    source.notificationPreferences :
    {};

  return normalizeChangeRequestNotificationPreferences(
      notifications.changeRequests,
      options,
  );
}

/**
 * Checks whether an admin-user document is eligible to review requests.
 *
 * @param {*} user Admin-user document data.
 * @return {boolean} Whether the user may receive reviewer notifications.
 */
export function canReceiveChangeRequestNotifications(user) {
  const source = user && typeof user === "object" ? user : {};
  const pageAccess = source.pageAccess &&
    typeof source.pageAccess === "object" ? source.pageAccess : {};
  const permission = String(pageAccess.changeRequests || "")
      .trim()
      .toLowerCase();

  return source.active === true && REVIEW_PERMISSIONS.has(permission);
}

/**
 * Lists the enabled delivery channels for one eligible reviewer.
 *
 * @param {*} user Admin-user document data.
 * @param {Object} options Default overrides.
 * @return {string[]} Enabled channel names.
 */
export function getEligibleChangeRequestNotificationChannels(
    user,
    options = {},
) {
  if (!canReceiveChangeRequestNotifications(user)) return [];

  const preferences = getChangeRequestNotificationPreferences(user, options);
  const channels = [];

  if (preferences.email && looksLikeEmailAddress_(user && user.email)) {
    channels.push(CHANGE_REQUEST_EMAIL_CHANNEL);
  }
  if (preferences.pumble) {
    channels.push(CHANGE_REQUEST_PUMBLE_CHANNEL);
  }

  return channels;
}

/**
 * Checks a normalized email address without exposing a broader mail helper.
 *
 * @param {*} value Potential email address.
 * @return {boolean} Whether the address has a basic valid shape.
 */
function looksLikeEmailAddress_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(value || "").trim(),
  );
}
