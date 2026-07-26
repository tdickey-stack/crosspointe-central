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

export {
    areServeNeedsComparisonItemsEqual_,
    buildFirstAdminPageAccess_,
    formatDate_,
    formatTime_,
    formatTimeRange_,
    getBearerToken_,
    getCampaignConflictLabel_,
    getFirestoreTimestampMillis_,
    getFirstAdminBootstrapErrorMessage_,
    getOptionalBooleanConfigValue_,
    getResourceConflictLabel_,
    getServeNeedConflictLabel_,
    hasQuickLinksDraftBeenInitialized_,
    htmlToPlainText_,
    isTruthyValue_,
    looksLikeEmailAddress_,
    looksLikeHtml_,
    looksLikePassageText_,
    mapCampaignsComparisonItemsById_,
    mapResourcesComparisonItemsById_,
    mapServeNeedsComparisonItemsById_,
    normalizeOptionalBooleanConfigValue_,
    normalizePassageText_,
    normalizePreviewPublishOperation_,
    normalizePreviewPublishSection_,
    normalizeSortValue_,
    normalizeSundayModeOverrideValue_,
    normalizeYouVersionBookAlias_,
    parsePlanningCenterServiceTypes_,
    parsePositiveInt_,
    sanitizePassageHtml_,
    sortCampaignsComparisonItems_,
    sortServeNeedsComparisonItems_,
    trimFirestoreStringValue_
};