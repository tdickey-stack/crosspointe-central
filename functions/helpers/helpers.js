function getFirstAdminBootstrapErrorMessage_(error) {
  if (error && error.code === "bootstrap-closed") {
    return [
      "Automatic bootstrap is closed because an admin user already exists.",
      "If you still need access, add your Firestore user document manually.",
    ].join(" ");
  }

  return error && error.message ?
    error.message :
    "Unable to create the first admin user document.";
}

function buildFirstAdminPageAccess_() {
  return {
    hub: "admin",
    bulletin: "admin",
    studio: "admin",
    settings: "admin",
    integrations: "admin",
    wayfinder: "admin",
    sundaySettings: "admin",
    thisSunday: "admin",
    whatsNew: "admin",
    statusBanner: "admin",
    today: "admin",
    events: "admin",
    setlist: "admin",
    campaigns: "admin",
    nextSteps: "admin",
    serveNeeds: "admin",
    resources: "admin",
    quickLinks: "admin",
    roomRules: "admin",
    users: "admin",
    roles: "admin",
    changeRequests: "admin",
  };
}

function isTruthyValue_(value) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" ||
    normalized === "1" ||
    normalized === "yes";
}

function hasQuickLinksDraftBeenInitialized_(draftSnapshot, draftMetaSnapshot) {
  if (draftSnapshot && !draftSnapshot.empty) {
    return true;
  }

  if (!draftMetaSnapshot || !draftMetaSnapshot.exists) {
    return false;
  }

  return isTruthyValue_(draftMetaSnapshot.get("initialized"));
}

function getFirestoreTimestampMillis_(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function trimFirestoreStringValue_(value) {
  return String(value || "").trim();
}

function looksLikeEmailAddress_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      trimFirestoreStringValue_(value).toLowerCase(),
  );
}

function normalizeOptionalBooleanConfigValue_(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = trimFirestoreStringValue_(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }

  return null;
}

function getOptionalBooleanConfigValue_(source, ...keys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    return normalizeOptionalBooleanConfigValue_(source[key]);
  }

  return null;
}

function getResourceConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this resource",
  ) || "this resource";
}

function mapResourcesComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function sortServeNeedsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function mapServeNeedsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areServeNeedsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.need || "") ===
    String(proposedItem && proposedItem.need || "") &&
    String(currentItem && currentItem.ministry || "") ===
      String(proposedItem && proposedItem.ministry || "") &&
    String(currentItem && currentItem.priority || "normal") ===
      String(proposedItem && proposedItem.priority || "normal") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.contact_email || "") ===
      String(proposedItem && proposedItem.contact_email || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getServeNeedConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.need ||
      currentItem && currentItem.need ||
      fallbackId ||
      "this serve need",
  ) || "this serve need";
}

function sortCampaignsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function mapCampaignsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function getCampaignConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this campaign",
  ) || "this campaign";
}

function normalizeSortValue_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).replace(/\s/g, " ");
}

function formatTimeRange_(startsDate, endsAt, timezone) {
  const start = formatTime_(startsDate, timezone);
  if (!endsAt) return start;

  const endDate = new Date(endsAt);
  if (Number.isNaN(endDate.getTime())) return start;

  return start + " - " + formatTime_(endDate, timezone);
}

function parsePlanningCenterServiceTypes_(value) {
  return String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split(":");
        const serviceTypeId = String(parts[0] || "").trim();
        const serviceLabel = parts.slice(1).join(":").trim();

        if (!serviceTypeId || !serviceLabel) return null;

        return {
          serviceTypeId: serviceTypeId,
          serviceLabel: serviceLabel,
        };
      })
      .filter(Boolean);
}

function parsePositiveInt_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeYouVersionBookAlias_(value) {
  return String(value || "")
      .toLowerCase()
      .replace(/[.]/g, "")
      .replace(/\s+/g, " ")
      .trim();
}

function looksLikeHtml_(value) {
  return /<(p|div|span|sup|br|em|strong)\b/i.test(String(value || ""));
}

function looksLikePassageText_(value) {
  const text = String(value || "").trim();

  if (text.length < 30) return false;
  if (/^https?:\/\//i.test(text)) return false;

  return /[A-Za-z]/.test(text) && /\s/.test(text);
}

function sanitizePassageHtml_(html) {
  return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "")
      .replace(/javascript:/gi, "");
}

function normalizePassageText_(text) {
  return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

function htmlToPlainText_(html) {
  return normalizePassageText_(
      String(html || "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, "\"")
          .replace(/&#39;/g, "'"),
  );
}

function getBearerToken_(authorizationHeader) {
  const headerValue = String(authorizationHeader || "").trim();
  if (!headerValue.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return headerValue.slice(7).trim();
}

function normalizePreviewPublishSection_(value) {
  const section = String(value || "").trim();

  if (
    section === "hubSettings" ||
    section === "hubSunday" ||
    section === "settingsSunday" ||
    section === "integrations" ||
    section === "thisSunday" ||
    section === "campaigns" ||
    section === "nextSteps" ||
    section === "serveNeeds" ||
    section === "resources" ||
    section === "events" ||
    section === "roomRules" ||
    section === "quickLinks" ||
    section === "statusBanner"
  ) {
    return section;
  }

  return "";
}

function normalizePreviewPublishOperation_(value) {
  return String(value || "").trim() === "hide" ? "hide" : "publish";
}

function normalizeSundayModeOverrideValue_(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "enabled" ||
    normalized === "on" ||
    normalized === "force_on" ||
    normalized === "true"
  ) {
    return "enabled";
  }

  if (
    normalized === "disabled" ||
    normalized === "off" ||
    normalized === "force_off" ||
    normalized === "false"
  ) {
    return "disabled";
  }

  return "auto";
}

function normalizeAdminEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function trimEnvString_(value) {
  return String(value || "").trim();
}

function formatSundayModeTimeValue_(hour, minute) {
  return String(hour).padStart(2, "0") + ":" +
    String(minute).padStart(2, "0");
}

function getCountLabel_(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

function mapQuickLinksComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areQuickLinksComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.url || "") ===
      String(proposedItem && proposedItem.url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function sortQuickLinksComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function areRoomRulesComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.match_type || "contains") ===
    String(proposedItem && proposedItem.match_type || "contains") &&
    String(currentItem && currentItem.match_text || "") ===
      String(proposedItem && proposedItem.match_text || "") &&
    String(currentItem && currentItem.display_location || "") ===
      String(proposedItem && proposedItem.display_location || "") &&
    String(currentItem && currentItem.behavior || "replace") ===
      String(proposedItem && proposedItem.behavior || "replace") &&
    Number(currentItem && currentItem.priority || 50) ===
      Number(proposedItem && proposedItem.priority || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function mapRoomRulesComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areResourcesComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.type || "") ===
      String(proposedItem && proposedItem.type || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function sortResourcesComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function areNextStepsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function mapNextStepsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function sortNextStepsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function areCampaignsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Boolean(currentItem && currentItem.ongoing) ===
      Boolean(proposedItem && proposedItem.ongoing) &&
    String(currentItem && currentItem.start_date || "") ===
      String(proposedItem && proposedItem.start_date || "") &&
    String(currentItem && currentItem.end_date || "") ===
      String(proposedItem && proposedItem.end_date || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getPreviewSectionLabel_(section) {
  switch (section) {
    case "hubSettings":
      return "Homepage";
    case "hubSunday":
      return "Sunday Mode";
    case "settingsSunday":
      return "Settings";
    case "integrations":
      return "Integrations";
    case "thisSunday":
      return "Sunday";
    case "campaigns":
      return "Campaigns";
    case "nextSteps":
      return "Next Steps";
    case "serveNeeds":
      return "Serve Needs";
    case "resources":
      return "Resources";
    case "events":
      return "Events";
    case "roomRules":
      return "Room Rules";
    case "quickLinks":
      return "Quick Links";
    case "statusBanner":
      return "Status Banner";
    default:
      return "Central Content";
  }
}





function normalizeResourcePublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "resource-" + String(index + 1);
}

function normalizeRoomRulePublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "room-rule-" + String(index + 1);
}

function normalizeCampaignPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "campaign-" + String(index + 1);
}

function normalizeNextStepPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "next-step-" + String(index + 1);
}

function normalizeServeNeedPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "serve-need-" + String(index + 1);
}

function normalizeQuickLinkPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "quick-link-" + String(index + 1);
}

function normalizeChangeRequestDecision_(value) {
  const decision = String(value || "").trim().toLowerCase();

  if (decision === "approve" || decision === "reject") {
    return decision;
  }

  return "";
}

function getChangeRequestErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "Unable to process the change request.";
}

function getChangeRequestStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "change-request-forbidden" ||
    error.code === "change-request-review-forbidden"
  ) {
    return 403;
  }

  if (
    error.code === "change-request-missing" ||
    error.code === "change-request-closed" ||
    error.code === "change-request-conflict"
  ) {
    return 409;
  }

  if (
    error.code === "invalid-section" ||
    error.code === "invalid-operation" ||
    error.code === "invalid-decision" ||
    error.code === "missing-request-id" ||
    error.code === "invalid-payload"
  ) {
    return 400;
  }

  return 500;
}

function getPreviewPublishErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "Unable to publish content.";
}

function createChangeRequestError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getPreviewPublishStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "preview-publish-forbidden"
  ) {
    return 403;
  }

  if (
    error.code === "invalid-section" ||
    error.code === "invalid-operation" ||
    error.code === "invalid-payload"
  ) {
    return 400;
  }

  if (error.code === "change-request-conflict") {
    return 409;
  }

  return 500;
}

function getAdminUserManagementErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "The admin user request failed.";
}

function createPreviewPublishError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getAdminUserManagementStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "admin-user-management-forbidden") {
    return 403;
  }

  if (error.code === "missing-admin-user-target" ||
    error.code === "admin-user-resolve-failed" ||
    error.code === "invalid-admin-email" ||
    error.code === "invalid-admin-permissions" ||
    error.code === "self-disable-forbidden" ||
    error.code === "self-delete-forbidden" ||
    error.code === "self-demote-forbidden" ||
    error.code === "admin-invite-required" ||
    error.code === "admin-invite-token-invalid") {
    return 400;
  }

  if (error.code === "admin-invite-email-mismatch") {
    return 403;
  }

  if (error.code === "admin-invite-missing" ||
    error.code === "admin-user-missing") {
    return 404;
  }

  if (error.code === "admin-invite-claimed" ||
    error.code === "admin-invite-expired") {
    return 409;
  }

  if (error.code === "admin-invite-email-failed") {
    return 502;
  }

  return 500;
}

function createAdminUserManagementError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizePreviewPermissionValue_(value) {
  return String(value || "none").trim().toLowerCase() || "none";
}

function canPublishPreviewWithPermission_(permission) {
  return permission === "edit" ||
    permission === "approve" ||
    permission === "admin";
}

function canSubmitChangeRequestWithPermission_(permission) {
  return permission === "propose";
}

function canReviewChangeRequestsWithPermission_(permission) {
  return permission === "approve" ||
    permission === "admin";
}

function hasManagedAdminPageAccessKey_(pageAccess, key) {
  return !!(
    pageAccess &&
    typeof pageAccess === "object" &&
    Object.prototype.hasOwnProperty.call(pageAccess, key)
  );
}

function rankStringCandidates_(candidates, preferredPatterns) {
  if (!candidates.length) return null;

  const scoredCandidates = candidates.map((candidate) => {
    let score = Math.min(candidate.value.length, 600);

    preferredPatterns.forEach((pattern, index) => {
      if (pattern.test(candidate.path || "")) {
        score += (preferredPatterns.length - index) * 500;
      }
    });

    return {
      candidate: candidate,
      score: score,
    };
  }).sort((a, b) => b.score - a.score);

  return scoredCandidates[0].candidate;
}

function collectStringCandidates_(value, path, candidates, depth) {
  if (depth > 6 || !value) return;

  if (typeof value === "string") {
    candidates.push({
      path: path,
      value: value,
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringCandidates_(item, path + "[" + index + "]", candidates, depth + 1);
    });
    return;
  }

  if (typeof value !== "object") return;

  Object.keys(value).forEach((key) => {
    const nextPath = path ? path + "." + key : key;
    collectStringCandidates_(value[key], nextPath, candidates, depth + 1);
  });
}

function getTimeZoneParts_(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

export {
  areCampaignsComparisonItemsEqual_,
  areNextStepsComparisonItemsEqual_,
  areQuickLinksComparisonItemsEqual_,
  areResourcesComparisonItemsEqual_,
  areRoomRulesComparisonItemsEqual_,
  areServeNeedsComparisonItemsEqual_,

  buildFirstAdminPageAccess_,

  canPublishPreviewWithPermission_,
  canSubmitChangeRequestWithPermission_,
  canReviewChangeRequestsWithPermission_,
  collectStringCandidates_,
  createAdminUserManagementError_,
  createChangeRequestError_,
  createPreviewPublishError_,

  formatDate_,
  formatSundayModeTimeValue_,
  formatTime_,
  formatTimeRange_,

  getAdminUserManagementErrorMessage_,
  getAdminUserManagementStatusCode_,
  getBearerToken_,
  getCampaignConflictLabel_,
  getChangeRequestErrorMessage_,
  getChangeRequestStatusCode_,
  getCountLabel_,
  getFirestoreTimestampMillis_,
  getFirstAdminBootstrapErrorMessage_,
  getOptionalBooleanConfigValue_,
  getPreviewPublishErrorMessage_,
  getPreviewPublishStatusCode_,
  getPreviewSectionLabel_,
  getResourceConflictLabel_,
  getServeNeedConflictLabel_,
  getTimeZoneParts_,

  hasManagedAdminPageAccessKey_,
  hasQuickLinksDraftBeenInitialized_,
  htmlToPlainText_,

  isTruthyValue_,

  looksLikeEmailAddress_,
  looksLikeHtml_,
  looksLikePassageText_,

  mapCampaignsComparisonItemsById_,
  mapNextStepsComparisonItemsById_,
  mapQuickLinksComparisonItemsById_,
  mapResourcesComparisonItemsById_,
  mapRoomRulesComparisonItemsById_,
  mapServeNeedsComparisonItemsById_,

  normalizeAdminEmail_,
  normalizeCampaignPublishDocId_,
  normalizeChangeRequestDecision_,
  normalizeNextStepPublishDocId_,
  normalizeOptionalBooleanConfigValue_,
  normalizePassageText_,
  normalizePreviewPermissionValue_,
  normalizePreviewPublishOperation_,
  normalizePreviewPublishSection_,
  normalizeQuickLinkPublishDocId_,
  normalizeResourcePublishDocId_,
  normalizeRoomRulePublishDocId_,
  normalizeServeNeedPublishDocId_,
  normalizeSortValue_,
  normalizeSundayModeOverrideValue_,
  normalizeYouVersionBookAlias_,

  parsePlanningCenterServiceTypes_,
  parsePositiveInt_,

  rankStringCandidates_,

  sanitizePassageHtml_,
  sortCampaignsComparisonItems_,
  sortNextStepsComparisonItems_,
  sortQuickLinksComparisonItems_,
  sortResourcesComparisonItems_,
  sortServeNeedsComparisonItems_,

  trimEnvString_,
  trimFirestoreStringValue_
};