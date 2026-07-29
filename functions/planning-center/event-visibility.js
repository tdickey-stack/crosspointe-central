/**
 * Determines whether a Planning Center event has not started yet.
 *
 * Events without a usable source timestamp remain visible so older cached
 * payloads do not disappear unexpectedly.
 *
 * @param {Object} event Public or source-cache event.
 * @param {Date=} now Current time.
 * @return {boolean} Whether the event should remain visible.
 */
export function isPlanningCenterEventUpcoming(event, now = new Date()) {
  const source = event && typeof event === "object" ? event : {};
  const startsAt = new Date(String(
      source.starts_at || source._planningCenterStartsAt || "",
  ));
  const currentTime = now instanceof Date ? now : new Date(now);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(currentTime.getTime())
  ) {
    return true;
  }

  return startsAt.getTime() > currentTime.getTime();
}

/**
 * Removes expired Today and Featured Event content from a Central payload.
 *
 * @param {Object} payload Central public response.
 * @param {Date=} now Current time.
 * @return {Object} Payload with current time-sensitive events.
 */
export function filterExpiredCentralEvents(payload, now = new Date()) {
  const source = payload && typeof payload === "object" ? payload : {};
  const today = Array.isArray(source.today) ? source.today : [];
  const featuredEvent = source.featuredEvent &&
    typeof source.featuredEvent === "object" ?
    source.featuredEvent :
    null;

  return {
    ...source,
    today: today.filter((event) => {
      return isPlanningCenterEventUpcoming(event, now);
    }),
    featuredEvent:
      featuredEvent &&
      isPlanningCenterEventUpcoming(featuredEvent, now) ?
        featuredEvent :
        null,
  };
}
