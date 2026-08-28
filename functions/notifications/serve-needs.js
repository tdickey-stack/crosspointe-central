/**
 * Builds a bounded direct message for a new Serve Needs response.
 *
 * @param {*} interest Stored Serve Needs interest data.
 * @param {*} submittedAt Human-readable submission time.
 * @return {string} Pumble message text.
 */
export function buildServeNeedPumbleNotificationText(
    interest,
    submittedAt,
) {
  const source = interest && typeof interest === "object" ? interest : {};
  const preferredContact = String(source.preferredContactMethod || "")
      .trim()
      .toLowerCase() === "text" ? "Text" : "Email";
  const lines = [
    "New Serve Needs Response",
    "",
    "Opportunity: " + bounded_(source.serveNeedNeed, 160, "Serve Opportunity"),
    "Ministry: " + bounded_(source.serveNeedMinistry, 120, "Not specified"),
    "",
    "Name: " + bounded_(source.name, 160, "Not provided"),
    "Email: " + bounded_(source.email, 320, "Not provided"),
    "Phone: " + bounded_(source.phone, 80, "Not provided"),
    "Preferred contact: " + preferredContact,
    "",
    "Notes: " + bounded_(source.additionalNotes, 2500, "None"),
    "Submitted: " + bounded_(submittedAt, 120, "Just now"),
  ];

  return lines.join("\n").slice(0, 5000);
}

/**
 * @param {*} value Message field value.
 * @param {number} maxLength Maximum returned length.
 * @param {string} fallback Value used when the field is empty.
 * @return {string} Bounded message value.
 */
function bounded_(value, maxLength, fallback) {
  const normalized = String(value || "").trim();
  return (normalized || fallback).slice(0, maxLength);
}
