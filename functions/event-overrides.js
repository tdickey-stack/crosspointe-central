import crypto from "node:crypto";

export const EVENT_OVERRIDE_FIELDS = ["title", "location", "description"];

/**
 * Normalizes the target scope for an event override.
 * @param {*} value Candidate scope value.
 * @return {"series"|"instance"} Normalized scope.
 */
export function normalizeEventOverrideScope(value) {
  return String(value || "").trim().toLowerCase() === "series" ?
    "series" :
    "instance";
}

/**
 * Normalizes a stored or submitted event override.
 * @param {*} item Candidate event override.
 * @param {string} fallbackId ID to use when the item has none.
 * @return {object} Normalized event override.
 */
export function normalizeEventOverrideItem(item, fallbackId = "") {
  const source = item && typeof item === "object" ? item : {};
  const scope = normalizeEventOverrideScope(source.scope);
  const eventId = String(source.planning_center_event_id || "").trim();
  const instanceId = String(source.planning_center_instance_id || "").trim();
  const overriddenFields = (Array.isArray(source.overridden_fields) ?
    source.overridden_fields :
    EVENT_OVERRIDE_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(source, field),
    ))
      .map((field) => String(field || "").trim().toLowerCase())
      .filter((field, index, fields) =>
        EVENT_OVERRIDE_FIELDS.includes(field) &&
        fields.indexOf(field) === index,
      );

  return {
    id: String(source.id || fallbackId || buildEventOverrideId({
      scope,
      planning_center_event_id: eventId,
      planning_center_instance_id: instanceId,
    })).trim(),
    active: source.active !== false,
    scope,
    planning_center_event_id: eventId,
    planning_center_instance_id: instanceId,
    overridden_fields: overriddenFields,
    title: String(source.title || "").trim(),
    location: String(source.location || "").trim(),
    description: String(source.description || "").trim(),
  };
}

/**
 * Builds a stable document ID for an event override target.
 * @param {object} item Event override identity.
 * @return {string} Stable document ID, or an empty string without a target.
 */
export function buildEventOverrideId(item) {
  const source = item || {};
  const scope = normalizeEventOverrideScope(source.scope);
  const targetId = scope === "series" ?
    String(source.planning_center_event_id || "").trim() :
    String(source.planning_center_instance_id || "").trim();
  if (!targetId) return "";

  return scope + "-" + crypto.createHash("sha256")
      .update(targetId)
      .digest("hex")
      .slice(0, 40);
}

/**
 * Validates and normalizes an event override submission.
 * @param {*} item Candidate event override.
 * @return {object} Validated event override.
 */
export function validateEventOverrideItem(item) {
  const normalized = normalizeEventOverrideItem(item);
  if (!normalized.id) {
    throw new Error("Choose a valid Planning Center event.");
  }
  if (
    normalized.scope === "series" &&
    !normalized.planning_center_event_id
  ) {
    throw new Error("This event is missing its Planning Center series ID.");
  }
  if (
    normalized.scope === "instance" &&
    !normalized.planning_center_instance_id
  ) {
    throw new Error("This event is missing its Planning Center occurrence ID.");
  }
  if (!normalized.overridden_fields.length) {
    throw new Error("Choose at least one event field to override.");
  }
  if (
    normalized.overridden_fields.includes("title") &&
    !normalized.title
  ) {
    throw new Error("An overridden event name cannot be empty.");
  }
  return normalized;
}

/**
 * Normalizes the active overrides from storage.
 * @param {*} items Candidate event override list.
 * @return {object[]} Active normalized overrides.
 */
export function normalizeEventOverrides(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeEventOverrideItem(
          item,
          item && item.id || "event-override-" + String(index + 1),
      ))
      .filter((item) => item.id && item.active);
}

/**
 * Creates a stable cache hash for an event override list.
 * @param {*} items Candidate event override list.
 * @return {string} SHA-256 content hash.
 */
export function createEventOverridesHash(items) {
  const normalized = normalizeEventOverrides(items)
      .map((item) => ({
        id: item.id,
        active: item.active,
        scope: item.scope,
        planning_center_event_id: item.planning_center_event_id,
        planning_center_instance_id: item.planning_center_instance_id,
        overridden_fields: item.overridden_fields.slice().sort(),
        title: item.title,
        location: item.location,
        description: item.description,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex");
}

/**
 * Applies matching series and occurrence overrides to Planning Center values.
 * @param {object} values Planning Center display values.
 * @param {*} items Candidate event override list.
 * @param {object} identity Planning Center event and occurrence IDs.
 * @return {object} Effective display values and override metadata.
 */
export function applyEventOverrides(values, items, identity) {
  const source = values || {};
  const target = identity || {};
  const normalized = normalizeEventOverrides(items);
  const eventId = String(target.planning_center_event_id || "").trim();
  const instanceId = String(
      target.planning_center_instance_id || "",
  ).trim();
  const seriesOverride = normalized.find((item) =>
    item.scope === "series" &&
    item.planning_center_event_id === eventId,
  ) || null;
  const instanceOverride = normalized.find((item) =>
    item.scope === "instance" &&
    item.planning_center_instance_id === instanceId,
  ) || null;
  const effective = {
    title: String(source.title || "").trim(),
    location: String(source.location || "").trim(),
    description: String(source.description || "").trim(),
  };
  const appliedFields = [];

  [seriesOverride, instanceOverride].filter(Boolean).forEach((override) => {
    override.overridden_fields.forEach((field) => {
      effective[field] = override[field];
      if (!appliedFields.includes(field)) appliedFields.push(field);
    });
  });

  return {
    ...effective,
    overridden_fields: appliedFields,
    override_scope: instanceOverride ? "instance" :
      (seriesOverride ? "series" : ""),
    override_id: instanceOverride && instanceOverride.id ||
      seriesOverride && seriesOverride.id || "",
  };
}
