const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * Normalizes a Sunday date value for storage and display.
 *
 * @param {*} value Candidate date value.
 * @return {string} YYYY-MM-DD or an empty string.
 */
export function normalizeThisSundayDateValue(value) {
  const text = String(value == null ? "" : value).trim();
  const quickMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!text) {
    return "";
  }

  if (quickMatch) {
    return quickMatch[1] + "-" + quickMatch[2] + "-" + quickMatch[3];
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return [
    parsed.getFullYear(),
    "-",
    String(parsed.getMonth() + 1).padStart(2, "0"),
    "-",
    String(parsed.getDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Formats a normalized Sunday date without shifting calendar days.
 *
 * @param {*} value Candidate date value.
 * @return {string} Human-readable date or the original trimmed value.
 */
export function formatThisSundayDisplayDate(value) {
  const normalizedValue = normalizeThisSundayDateValue(value);

  if (!normalizedValue) {
    return String(value == null ? "" : value).trim();
  }

  const parts = normalizedValue.split("-").map((part) => Number(part));
  const parsedDate = new Date(Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2],
      12,
      0,
      0,
  ));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

/**
 * Gets today when it is Sunday, or the next Sunday, in the church timezone.
 *
 * @param {Date} now Current instant.
 * @param {string} timezone IANA timezone.
 * @return {string} YYYY-MM-DD.
 */
export function getAutomaticSundayDateIso(
    now = new Date(),
    timezone = DEFAULT_TIMEZONE,
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
      formatter.formatToParts(now)
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
  );
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .indexOf(parts.weekday);
  const daysUntilSunday = weekdayIndex === 0 ? 0 : 7 - weekdayIndex;
  const localCalendarDate = new Date(Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + daysUntilSunday,
      12,
  ));

  return [
    localCalendarDate.getUTCFullYear(),
    "-",
    String(localCalendarDate.getUTCMonth() + 1).padStart(2, "0"),
    "-",
    String(localCalendarDate.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Builds the date fields stored by the Sunday publishing workflow.
 * Automatic mode intentionally stores no fixed date.
 *
 * @param {Object} sourceData Submitted Sunday data.
 * @return {Object} Normalized date storage fields.
 */
export function buildThisSundayDateStorageFields(sourceData) {
  const source = sourceData && typeof sourceData === "object" ? sourceData : {};
  const overrideEnabled = source.date_override_enabled === true;
  const dateIso = normalizeThisSundayDateValue(source.date_iso || source.date);

  return {
    date_override_enabled: overrideEnabled,
    date: overrideEnabled && dateIso ?
      formatThisSundayDisplayDate(dateIso) :
      "",
    date_iso: overrideEnabled ? dateIso : "",
  };
}

/**
 * Resolves a stored Sunday document into the date the public app should show.
 * Missing legacy override flags intentionally opt into automatic dates.
 *
 * @param {Object} sourceData Stored or cached Sunday data.
 * @param {Object} options Resolution options.
 * @return {Object} Sunday data with a current display date.
 */
export function resolveThisSundayDate(sourceData, options = {}) {
  const source = sourceData && typeof sourceData === "object" ? sourceData : {};
  const overrideEnabled = source.date_override_enabled === true;
  const savedDateIso = normalizeThisSundayDateValue(
      source.date_iso || source.date,
  );
  const dateIso = overrideEnabled && savedDateIso ?
    savedDateIso :
    getAutomaticSundayDateIso(
        options.now instanceof Date ? options.now : new Date(),
        options.timezone || DEFAULT_TIMEZONE,
    );

  return {
    ...source,
    date_override_enabled: overrideEnabled,
    date_iso: dateIso,
    date: formatThisSundayDisplayDate(dateIso),
  };
}
