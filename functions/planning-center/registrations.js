export const CENTRAL_REGISTRATION_SIGNUP_FIELDS = [
  "archived",
  "at_maximum_capacity",
  "categories",
  "close_at",
  "closed",
  "description",
  "logo_url",
  "maximum_capacity",
  "name",
  "new_registration_url",
  "next_signup_time",
  "open",
  "open_at",
  "selection_types",
  "signup_location",
];
export const CENTRAL_REGISTRATION_LOOKAHEAD_DAYS = 30;

/**
 * Selects public Planning Center signups approved for Central.
 *
 * This mapper intentionally ignores Attendee, Registration, Person, and
 * EmergencyContact resources. Central only needs public signup metadata and
 * the hosted Church Center URL.
 *
 * @param {Object} payload Planning Center Registrations JSON:API response.
 * @param {Object} options Central signup-selection options.
 * @return {Array<Object>} Sanitized, public-only signup records.
 */
export function getCentralRegistrationSignups(payload, options = {}) {
  const categoryName = String(options.categoryName || "Central").trim();
  const requestedNow = new Date(options.now || Date.now());
  const now = Number.isNaN(requestedNow.getTime()) ? new Date() : requestedNow;
  if (!categoryName) return [];

  const included = payload && Array.isArray(payload.included) ?
    payload.included : [];
  const categoryMap = buildIncludedMap_(included, "Category");
  const selectionTypeMap = buildIncludedMap_(included, "SelectionType");
  const signupTimeMap = buildIncludedMap_(included, "SignupTime");
  const signupLocationMap = buildIncludedMap_(included, "SignupLocation");

  return (payload && Array.isArray(payload.data) ? payload.data : [])
      .map((signup) => {
        return buildCentralRegistrationSignup_(signup, {
          categoryName,
          categoryMap,
          selectionTypeMap,
          signupTimeMap,
          signupLocationMap,
          now,
        });
      })
      .filter(Boolean)
      .sort(sortCentralRegistrationSignups_);
}

/**
 * Builds an ID lookup for one included resource type.
 *
 * @param {Array<Object>} included Included JSON:API resources.
 * @param {string} type Resource type.
 * @return {Map<string, Object>} Included-resource lookup.
 */
function buildIncludedMap_(included, type) {
  const map = new Map();

  included.forEach((item) => {
    if (!item || item.type !== type || !item.id) return;
    map.set(String(item.id), item);
  });

  return map;
}

/**
 * Converts one signup into Central's public registration shape.
 *
 * @param {Object} signup Planning Center Signup resource.
 * @param {Object} context Included-resource lookup maps.
 * @return {Object|null} Sanitized signup or null when it is not approved.
 */
function buildCentralRegistrationSignup_(signup, context) {
  if (!signup || signup.type !== "Signup" || !signup.id) return null;

  const attrs = signup.attributes || {};
  const registrationUrl = getSafeHttpUrl_(attrs.new_registration_url);
  const categoryNames = relationshipItems_(signup, "categories")
      .map((reference) => context.categoryMap.get(String(reference.id)))
      .filter(Boolean)
      .map((category) => {
        return String(category.attributes && category.attributes.name || "")
            .trim();
      });

  if (
    attrs.archived === true ||
    !registrationUrl ||
    !categoryNames.includes(context.categoryName)
  ) {
    return null;
  }

  const selectionTypes = relationshipItems_(signup, "selection_types")
      .map((reference) => context.selectionTypeMap.get(String(reference.id)))
      .filter(Boolean)
      .map(toPublicSelectionType_)
      .filter(Boolean);
  const nextSignupTime = firstRelatedIncluded_(
      signup,
      "next_signup_time",
      context.signupTimeMap,
  );
  const signupLocation = firstRelatedIncluded_(
      signup,
      "signup_location",
      context.signupLocationMap,
  );
  const startsAt = getIncludedDateAttribute_(nextSignupTime, "starts_at");
  const endsAt = getIncludedDateAttribute_(nextSignupTime, "ends_at");
  const allDay = Boolean(
      nextSignupTime && nextSignupTime.attributes &&
      nextSignupTime.attributes.all_day,
  );
  const openAt = normalizeIsoDate_(attrs.open_at);
  const closeAt = normalizeIsoDate_(attrs.close_at);
  const location = getPublicLocationDetails_(signupLocation);
  const eventEnd = getEventEndDate_(startsAt, endsAt, allDay);
  const eventStart = new Date(startsAt || "");
  const openDate = new Date(openAt || "");
  const closeDate = new Date(closeAt || "");
  const hasOpenDate = !Number.isNaN(openDate.getTime());
  const hasCloseDate = !Number.isNaN(closeDate.getTime());

  if (Number.isNaN(eventStart.getTime())) return null;
  if (eventStart.getTime() > context.now.getTime() +
    CENTRAL_REGISTRATION_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000) {
    return null;
  }
  if (eventEnd && eventEnd.getTime() <= context.now.getTime()) return null;
  if (attrs.open === false && hasOpenDate &&
    openDate.getTime() > context.now.getTime()) {
    return null;
  }

  const isAtCapacity = attrs.at_maximum_capacity === true;
  const offersWaitlist = selectionTypes.some((selectionType) => {
    return selectionType.waitlist === true;
  });
  const status = getRegistrationStatus_({
    now: context.now,
    closeDate,
    hasCloseDate,
    closed: attrs.closed === true || attrs.open === false,
    isAtCapacity,
    offersWaitlist,
  });

  return {
    id: String(signup.id),
    title: String(attrs.name || "Registration").trim(),
    description: htmlToPlainText_(attrs.description),
    image_url: getSafeHttpUrl_(attrs.logo_url),
    registration_url: registrationUrl,
    open_at: openAt,
    close_at: closeAt,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    location: location.room,
    venue: location.venue,
    address: location.address,
    price_label: getPriceLabel_(selectionTypes),
    status: status.id,
    status_label: status.label,
    selection_types: selectionTypes,
    source: "Planning Center Registrations",
  };
}

/**
 * Determines the public registration state shown by Central.
 *
 * @param {Object} context Status inputs.
 * @return {{id: string, label: string}} Public status.
 */
function getRegistrationStatus_(context) {
  if (context.closed ||
    (context.hasCloseDate &&
      context.closeDate.getTime() <= context.now.getTime())) {
    return {id: "closed", label: "Registration closed"};
  }

  if (context.isAtCapacity) {
    return context.offersWaitlist ?
      {id: "waitlist", label: "Waitlist available"} :
      {id: "full", label: "Registration full"};
  }

  const closingSoonMs = 7 * 24 * 60 * 60 * 1000;
  if (context.hasCloseDate &&
    context.closeDate.getTime() - context.now.getTime() <= closingSoonMs) {
    return {id: "closing-soon", label: "Registration closing soon"};
  }

  return {id: "open", label: "Registration open"};
}

/**
 * Resolves the moment after which an event should leave Central.
 *
 * @param {string} startsAt Event start.
 * @param {string} endsAt Event end.
 * @param {boolean} allDay Whether this is an all-day event.
 * @return {Date|null} Event end or null without a usable event time.
 */
function getEventEndDate_(startsAt, endsAt, allDay) {
  const endDate = new Date(endsAt || "");
  if (!Number.isNaN(endDate.getTime())) return endDate;

  const startDate = new Date(startsAt || "");
  if (Number.isNaN(startDate.getTime())) return null;

  return new Date(
      startDate.getTime() + (allDay ? 24 : 1) * 60 * 60 * 1000,
  );
}

/**
 * Normalizes one JSON:API relationship into an array.
 *
 * @param {Object} resource Parent JSON:API resource.
 * @param {string} relationshipName Relationship key.
 * @return {Array<Object>} Relationship references.
 */
function relationshipItems_(resource, relationshipName) {
  const data = resource && resource.relationships &&
    resource.relationships[relationshipName] &&
    resource.relationships[relationshipName].data;

  if (Array.isArray(data)) return data;
  return data && data.id ? [data] : [];
}

/**
 * Resolves the first resource attached to a relationship.
 *
 * @param {Object} resource Parent JSON:API resource.
 * @param {string} relationshipName Relationship key.
 * @param {Map<string, Object>} includedMap Included-resource lookup.
 * @return {Object|null} Included resource or null.
 */
function firstRelatedIncluded_(resource, relationshipName, includedMap) {
  const reference = relationshipItems_(resource, relationshipName)[0];
  return reference ? includedMap.get(String(reference.id)) || null : null;
}

/**
 * Selects the public price and waitlist fields for one selection type.
 *
 * @param {Object} selectionType Planning Center SelectionType resource.
 * @return {Object|null} Public selection type or null when hidden.
 */
function toPublicSelectionType_(selectionType) {
  const attrs = selectionType && selectionType.attributes || {};
  if (attrs.publicly_available === false) return null;

  const priceCents = Number(attrs.price_cents);

  return {
    id: String(selectionType.id || ""),
    name: String(attrs.name || "").trim(),
    price_cents: Number.isFinite(priceCents) ? priceCents : null,
    price_formatted: String(attrs.price_formatted || "").trim(),
    price_currency_symbol: String(attrs.price_currency_symbol || "").trim(),
    waitlist: attrs.waitlist === true,
  };
}

/**
 * Summarizes public selection prices for a signup card.
 *
 * @param {Array<Object>} selectionTypes Public selection types.
 * @return {string} Compact price label.
 */
function getPriceLabel_(selectionTypes) {
  const prices = selectionTypes
      .map((selectionType) => selectionType.price_cents)
      .filter((priceCents) => Number.isFinite(priceCents))
      .sort((left, right) => left - right);

  if (!prices.length) return "";

  const minimum = prices[0];
  const maximum = prices[prices.length - 1];
  const symbol = selectionTypes
      .map((selectionType) => selectionType.price_currency_symbol)
      .find(Boolean) || "$";

  if (maximum === 0) return "Free";
  if (minimum === maximum) return formatPrice_(minimum, symbol);
  if (minimum === 0) return "Free–" + formatPrice_(maximum, symbol);

  return formatPrice_(minimum, symbol) + "–" +
    formatPrice_(maximum, symbol);
}

/**
 * Formats a price without adding unnecessary decimal places.
 *
 * @param {number} priceCents Price in minor currency units.
 * @param {string} symbol Currency symbol.
 * @return {string} Display price.
 */
function formatPrice_(priceCents, symbol) {
  const amount = Number(priceCents) / 100;
  return symbol + amount.toFixed(amount % 1 === 0 ? 0 : 2);
}

/**
 * Reads and normalizes an included date-time attribute.
 *
 * @param {Object|null} item Included resource.
 * @param {string} attributeName Date attribute name.
 * @return {string} ISO date-time or an empty string.
 */
function getIncludedDateAttribute_(item, attributeName) {
  return normalizeIsoDate_(
      item && item.attributes && item.attributes[attributeName],
  );
}

/**
 * Normalizes a date-time value to an ISO string.
 *
 * @param {*} value Candidate date-time value.
 * @return {string} ISO date-time or an empty string.
 */
function normalizeIsoDate_(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * Selects the public room, venue, and address for a signup.
 *
 * @param {Object|null} signupLocation SignupLocation resource.
 * @return {{room: string, venue: string, address: string}} Location details.
 */
function getPublicLocationDetails_(signupLocation) {
  const attrs = signupLocation && signupLocation.attributes || {};
  const venue = String(attrs.name || "").trim();
  const room = String(
      attrs.subpremise || venue || attrs.full_formatted_address || "",
  ).trim();

  return {
    room,
    venue,
    address: String(
        attrs.formatted_address || attrs.full_formatted_address || "",
    ).trim(),
  };
}

/**
 * Allows only ordinary HTTP or HTTPS links.
 *
 * @param {*} value Candidate URL.
 * @return {string} Safe URL or an empty string.
 */
function getSafeHttpUrl_(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

/**
 * Converts Planning Center's signup description HTML to plain text.
 *
 * @param {*} value Candidate HTML value.
 * @return {string} Plain-text description.
 */
function htmlToPlainText_(value) {
  return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

/**
 * Sorts signups by their next event time and then title.
 *
 * @param {Object} left Left signup.
 * @param {Object} right Right signup.
 * @return {number} Sort result.
 */
function sortCentralRegistrationSignups_(left, right) {
  const leftTime = new Date(left.starts_at || left.close_at || 0).getTime();
  const rightTime = new Date(right.starts_at || right.close_at || 0).getTime();

  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.title.localeCompare(right.title);
}
