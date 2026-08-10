const CAMPAIGN_ACTION_LINK = "link";
const CAMPAIGN_ACTION_CONTACT = "contact";

/**
 * Normalizes the configured action for a campaign.
 *
 * Legacy campaigns without an explicit action remain link-based. A stored
 * contact address is used only as a migration hint when there is no link.
 *
 * @param {Object} source Campaign-like data.
 * @return {string} Normalized campaign action.
 */
export function normalizeCampaignActionType(source) {
  const data = source && typeof source === "object" ? source : {};
  const requestedAction = String(
      data.action_type || data.actionType || "",
  ).trim().toLowerCase();

  if (requestedAction === CAMPAIGN_ACTION_CONTACT) {
    return CAMPAIGN_ACTION_CONTACT;
  }

  if (requestedAction === CAMPAIGN_ACTION_LINK) {
    return CAMPAIGN_ACTION_LINK;
  }

  return String(data.contact_email || "").trim() &&
    !String(data.button_url || "").trim() ?
    CAMPAIGN_ACTION_CONTACT :
    CAMPAIGN_ACTION_LINK;
}

/**
 * Validates and bounds a public campaign-contact submission.
 *
 * @param {Object} payload Public request data.
 * @return {{name: string, email: string, phone: string, message: string}}
 *   Normalized submission fields.
 */
export function normalizeCampaignContactSubmission(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const name = boundedString_(source.name, 120, "Name");
  const email = boundedString_(source.email, 254, "Email").toLowerCase();
  const phone = boundedString_(source.phone, 40, "Phone");
  const message = boundedString_(source.message, 2000, "Message");

  if (!name) {
    throw validationError_("Enter your name before submitting.");
  }

  if (!looksLikeEmailAddress_(email)) {
    throw validationError_("Enter a valid email address before submitting.");
  }

  return {name, email, phone, message};
}

/**
 * Builds the plain-text Campaign contact notification.
 *
 * @param {Object} interest Stored interest record.
 * @param {string} submittedAt Human-readable submit time.
 * @return {string} Plain-text email body.
 */
export function buildCampaignContactEmailText(interest, submittedAt) {
  const data = interest && typeof interest === "object" ? interest : {};

  return [
    "A new Campaign contact form was submitted through Central.",
    "",
    "Campaign",
    "Title: " + String(data.campaignTitle || "").trim(),
    "",
    "Person",
    "Name: " + String(data.name || "").trim(),
    "Email: " + String(data.email || "").trim(),
    "Phone: " + (String(data.phone || "").trim() || "Not provided"),
    "",
    "Message",
    String(data.message || "").trim() || "No message provided",
    "",
    "Submitted",
    String(submittedAt || "").trim(),
    "",
    "Reply directly to this email to contact the person who submitted " +
      "the form.",
  ].join("\n");
}

/**
 * Normalizes a bounded text field.
 *
 * @param {*} value Raw field value.
 * @param {number} maximumLength Maximum accepted length.
 * @param {string} label Field label for errors.
 * @return {string} Normalized field value.
 */
function boundedString_(value, maximumLength, label) {
  const normalized = String(value || "").trim();

  if (normalized.length > maximumLength) {
    throw validationError_(
        String(label || "Field") + " is too long.",
    );
  }

  return normalized;
}

/**
 * Checks a normalized email address.
 *
 * @param {string} value Email address.
 * @return {boolean} Whether it has a basic email shape.
 */
function looksLikeEmailAddress_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

/**
 * Creates a public validation error.
 *
 * @param {string} message Safe validation message.
 * @return {Error} Tagged validation error.
 */
function validationError_(message) {
  const error = new Error(message);
  error.code = "invalid-payload";
  return error;
}

export {
  CAMPAIGN_ACTION_CONTACT,
  CAMPAIGN_ACTION_LINK,
};
