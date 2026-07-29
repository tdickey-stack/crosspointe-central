export const CALENDAR_SOURCE_CACHE_VERSION = "v3";

/**
 * Builds the shared cache ID for raw Planning Center calendar source data.
 *
 * Presentation settings are intentionally excluded so Room Rules and event
 * overrides can be applied after the source cache is read.
 *
 * @param {number} lookaheadDays Normalized calendar lookahead.
 * @return {string} Shared source-cache document ID.
 */
export function buildCalendarSourceCacheId(lookaheadDays) {
  const parsed = Number(lookaheadDays);
  const normalized = Number.isFinite(parsed) && parsed > 0 ?
    Math.min(90, Math.max(1, Math.floor(parsed))) :
    14;
  return CALENDAR_SOURCE_CACHE_VERSION + "-" + String(normalized);
}
