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
