/**
 * Finds an exact Planning Center tag ID in a tags collection response.
 *
 * @param {Object} payload Planning Center JSON:API response.
 * @param {string} tagName Exact configured tag name.
 * @return {string} Matching tag ID or an empty string.
 */
export function findPlanningCenterTagId(payload, tagName) {
  const expectedName = String(tagName || "").trim();
  if (!expectedName) return "";

  const tag = (payload && Array.isArray(payload.data) ? payload.data : [])
      .find((item) => {
        return item && item.type === "Tag" &&
          String(item.attributes && item.attributes.name || "").trim() ===
            expectedName;
      });

  return tag ? String(tag.id || "").trim() : "";
}

/**
 * Resolves the public Doors Open and main event times from a Calendar payload.
 *
 * @param {Object} payload Planning Center event-times response.
 * @param {Object} options Event title and main-time naming options.
 * @return {Object} Structured event schedule timestamps.
 */
export function getPlanningCenterEventSchedule(payload, options = {}) {
  const mainTimeName = normalizeEventTimeName_(
      options.mainTimeName || "Event Time",
  );
  const eventTitle = normalizeEventTimeName_(options.eventTitle);
  const publicEventTimes = (
    payload && Array.isArray(payload.data) ? payload.data : []
  ).filter((item) => {
    const attrs = item && item.attributes || {};
    const startsAt = new Date(String(attrs.starts_at || ""));

    return item && item.type === "EventTime" &&
      attrs.visible_on_widget_and_ical !== false &&
      !Number.isNaN(startsAt.getTime());
  });
  const findByName = (name) => {
    if (!name) return null;
    return publicEventTimes.find((item) => {
      return normalizeEventTimeName_(item.attributes.name) === name;
    }) || null;
  };
  const doorsOpen = findByName("doors open");
  const mainEventTime = findByName(mainTimeName) ||
    findByName(eventTitle) ||
    publicEventTimes.find((item) => {
      const name = normalizeEventTimeName_(item.attributes.name);
      return !["doors open", "setup", "teardown"].includes(name);
    }) || null;
  const mainAttrs = mainEventTime && mainEventTime.attributes || {};
  const doorsAttrs = doorsOpen && doorsOpen.attributes || {};

  return {
    doorsOpenStartsAt: String(doorsAttrs.starts_at || "").trim(),
    eventStartsAt: String(mainAttrs.starts_at || "").trim(),
    eventEndsAt: String(mainAttrs.ends_at || "").trim(),
  };
}

/**
 * Normalizes a Planning Center event-time name for exact comparison.
 *
 * @param {string} value Event-time name.
 * @return {string} Normalized name.
 */
function normalizeEventTimeName_(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Extracts an explicit Doors Open time from public event copy.
 *
 * This is a fallback for Planning Center events whose Calendar API schedule
 * omits the custom named time while the public description still contains it.
 *
 * @param {string} value Public event description.
 * @return {string} Normalized time label or an empty string.
 */
export function findDoorsOpenTimeInText(value) {
  const pattern = new RegExp(
      "\\bdoors\\s+open\\s*(?:at|:|-)?\\s*" +
      "(\\d{1,2})(?::(\\d{2}))?\\s*" +
      "(a\\.?m\\.?|p\\.?m\\.?)(?![a-z])",
      "i",
  );
  const match = String(value || "").match(pattern);

  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return "";

  return String(hour) + ":" + String(minute).padStart(2, "0") + " " +
    String(match[3]).replace(/\./g, "").toUpperCase();
}

/**
 * Selects future event instances carrying both public Central tags.
 *
 * @param {Object} payload Planning Center event-instances response.
 * @param {Object} options Tag configuration.
 * @return {Array<Object>} Sorted instance and parent-event pairs.
 */
export function getCentralFeaturedEventCandidates(payload, options = {}) {
  const centralTagName = String(options.centralTagName || "Central").trim();
  const featuredTagName = String(
      options.featuredTagName || "Central Featured",
  ).trim();
  const included = payload && Array.isArray(payload.included) ?
    payload.included : [];
  const tagMap = new Map();
  const eventMap = new Map();

  included.forEach((item) => {
    if (!item || !item.id) return;

    if (item.type === "Tag") {
      tagMap.set(
          String(item.id),
          String(item.attributes && item.attributes.name || "").trim(),
      );
      return;
    }

    if (item.type === "Event") {
      eventMap.set(String(item.id), item.attributes || {});
    }
  });

  return (payload && Array.isArray(payload.data) ? payload.data : [])
      .map((instance) => {
        const tagNames = getInstanceTagNames_(instance, tagMap);
        const eventReference = instance && instance.relationships &&
          instance.relationships.event &&
          instance.relationships.event.data;
        const startsAt = new Date(String(
            instance && instance.attributes &&
            (
              instance.attributes.published_starts_at ||
              instance.attributes.starts_at
            ) || "",
        ));

        if (
          !instance ||
          !instance.id ||
          !tagNames.includes(centralTagName) ||
          !tagNames.includes(featuredTagName) ||
          Number.isNaN(startsAt.getTime())
        ) {
          return null;
        }

        return {
          instance,
          eventAttributes: eventReference ?
            eventMap.get(String(eventReference.id)) || {} : {},
          startsAt,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        return left.startsAt.getTime() - right.startsAt.getTime();
      });
}

/**
 * Resolves the public tag names attached to an event instance.
 *
 * @param {Object} instance Planning Center event instance.
 * @param {Map<string, string>} tagMap Included tag lookup.
 * @return {Array<string>} Resolved tag names.
 */
function getInstanceTagNames_(instance, tagMap) {
  const references = instance && instance.relationships &&
    instance.relationships.tags &&
    Array.isArray(instance.relationships.tags.data) ?
      instance.relationships.tags.data : [];

  return references.map((reference) => {
    return tagMap.get(String(reference && reference.id || "")) || "";
  }).filter(Boolean);
}
