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
    attrs.closed === true ||
    attrs.open === false ||
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
  const isAtCapacity = attrs.at_maximum_capacity === true;
  const offersWaitlist = selectionTypes.some((selectionType) => {
    return selectionType.waitlist === true;
  });

  return {
    id: String(signup.id),
    title: String(attrs.name || "Registration").trim(),
    description: htmlToPlainText_(attrs.description),
    image_url: getSafeHttpUrl_(attrs.logo_url),
    registration_url: registrationUrl,
    open_at: normalizeIsoDate_(attrs.open_at),
    close_at: normalizeIsoDate_(attrs.close_at),
    starts_at: getIncludedDateAttribute_(nextSignupTime, "starts_at"),
    ends_at: getIncludedDateAttribute_(nextSignupTime, "ends_at"),
    all_day: Boolean(
        nextSignupTime && nextSignupTime.attributes &&
        nextSignupTime.attributes.all_day,
    ),
    location: getPublicLocation_(signupLocation),
    price_label: getPriceLabel_(selectionTypes),
    status: isAtCapacity ? (offersWaitlist ? "waitlist" : "full") : "open",
    status_label: isAtCapacity ?
      (offersWaitlist ? "Waitlist available" : "Registration full") :
      "Registration open",
    selection_types: selectionTypes,
    source: "Planning Center Registrations",
  };
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
 * Selects the public signup location label.
 *
 * @param {Object|null} signupLocation SignupLocation resource.
 * @return {string} Public location label.
 */
function getPublicLocation_(signupLocation) {
  const attrs = signupLocation && signupLocation.attributes || {};
  return String(
      attrs.name ||
      attrs.full_formatted_address ||
      attrs.formatted_address ||
      "",
  ).trim();
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
