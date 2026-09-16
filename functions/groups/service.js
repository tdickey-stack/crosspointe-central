/* eslint-disable require-jsdoc */

const API_ORIGIN = "https://api.planningcenteronline.com";
const CACHE_MS = 60000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday"];
const ATTENDANCE_LABELS = ["Drop-ins welcome", "Connect before visiting"];

function text(value, limit = 240) {
  return String(value || "").replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, limit);
}

function relationshipId(record, key) {
  const relation = record.relationships && record.relationships[key];
  return String(relation && relation.data && relation.data.id || "");
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "crosspointetv.churchcenter.com" &&
      /^\/groups\/[^/]+\/[^/]+\/?$/.test(url.pathname) &&
      !url.username && !url.password && !url.port ? url.href : "";
  } catch {
    return "";
  }
}

function imageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "groups-production.s3.amazonaws.com" &&
      url.pathname.startsWith("/uploads/group/header_image/") &&
      !url.username && !url.password && !url.port ? url.href : "";
  } catch {
    return "";
  }
}

// The documented Groups API provides a public schedule summary, not a
// structured recurring weekday. Only explicit full weekday words qualify.
// Date-of-month, absent schedules, ranges and exceptions stay unclassified.
export function meetingDaysFromSchedule(value) {
  const schedule = text(value).toLowerCase();
  if (/\b(?:except|not|no|never|excluding|through|until)\b/.test(schedule) ||
      new RegExp("[–—]|\\b(?:" + WEEKDAYS.join("|") +
        ")s?\\s*-\\s*[a-z]").test(schedule)) return [];
  const dayWord = "(?:" + WEEKDAYS.join("|") + ")s?";
  if (new RegExp(dayWord + "\\s+(?:to|thru)\\s+" + dayWord)
      .test(schedule)) return [];
  return WEEKDAYS.flatMap((day, index) =>
    new RegExp("\\b" + day + "s?\\b", "i").test(schedule) ? [index] : []);
}

export function publicLocation(group, location) {
  const attrs = location && location.attributes || {};
  // Authenticated location.strategy may be 'exact' even when visitors may
  // only see an approximate location. Never serialize addresses/coordinates.
  if (group.attributes.location_type_preference !== "physical" ||
      attrs.display_preference !== "exact") return "";
  return text(attrs.name, 160);
}

export function attendanceFromTags(ids, attendanceTags) {
  const labels = new Set((Array.isArray(ids) ? ids : [])
      .map((id) => attendanceTags.get(String(id))).filter(Boolean));
  // Conflicting attendance tags cannot safely describe a visitor's next step.
  return labels.size === 1 ? [...labels][0] : null;
}

export function normalizePublicGroup(group, included, attendanceTags) {
  const attrs = group.attributes || {};
  if (!group.id || attrs.listed !== true || attrs.archived_at) return null;
  const typeId = relationshipId(group, "group_type");
  const groupType = included.get("GroupType:" + typeId);
  if (!groupType || groupType.attributes.church_center_visible !== true) {
    return null;
  }
  const url = publicUrl(attrs.public_church_center_web_url);
  const name = text(attrs.name, 160);
  if (!url || !name) return null;
  const header = attrs.header_image || {};
  const schedule = text(attrs.schedule);
  // Adapted from Studio's planningCenterGroupResult and Wayfinder's public
  // eligibility checks. This is deliberately a smaller public allowlist.
  return {
    id: String(group.id),
    name,
    type: {id: typeId, name: text(groupType.attributes.name, 100)},
    schedule,
    meetingDays: meetingDaysFromSchedule(schedule),
    location: publicLocation(group,
        included.get("Location:" + relationshipId(group, "location"))),
    imageUrl: imageUrl(header.medium || header.thumbnail || header.original),
    url,
    attendance: attendanceFromTags(attrs.tag_ids, attendanceTags),
  };
}

// Pagination stays on the original collection; credentials must never follow
// arbitrary upstream URLs. Fail rather than silently returning a partial list.
export async function fetchGroupsCollection(fetchJson, initialUrl) {
  const initial = new URL(initialUrl);
  const seen = new Set();
  const combined = {data: [], included: []};
  let next = initial.href;
  while (next) {
    const url = new URL(next, API_ORIGIN);
    if (url.origin !== API_ORIGIN || url.pathname !== initial.pathname ||
        url.username || url.password || seen.has(url.href) ||
        seen.size >= 100) {
      throw new Error("Invalid Groups pagination.");
    }
    seen.add(url.href);
    const page = await fetchJson(url.href);
    if (!page || !Array.isArray(page.data)) {
      throw new Error("Invalid Groups response.");
    }
    combined.data.push(...page.data);
    combined.included.push(...(Array.isArray(page.included) ?
      page.included : []));
    next = page.links && page.links.next || "";
  }
  return combined;
}

export function createPublicGroupsService({fetchJson, now = Date.now}) {
  let cached = null;
  let expiresAt = 0;
  let inFlight = null;

  async function refresh() {
    const url = new URL("/groups/v2/groups", API_ORIGIN);
    url.searchParams.set("filter", "published");
    url.searchParams.set("where[archive_status]", "not_archived");
    url.searchParams.set("include", "group_type,location");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("order", "name");
    url.searchParams.set("fields[Group]", ["name", "listed", "archived_at",
      "schedule", "header_image", "public_church_center_web_url", "tag_ids",
      "location_type_preference", "group_type", "location"].join(","));
    url.searchParams.set("fields[GroupType]", "name,church_center_visible");
    url.searchParams.set("fields[Location]", "name,display_preference");
    const [groups, tagGroups] = await Promise.all([
      fetchGroupsCollection(fetchJson, url.href),
      fetchGroupsCollection(fetchJson,
          API_ORIGIN + "/groups/v2/tag_groups?per_page=100"),
    ]);
    const central = tagGroups.data.filter((item) =>
      text(item.attributes && item.attributes.name).toLowerCase() ===
        "central");
    const attendanceTags = new Map();
    // The user explicitly authorizes these two Central tags as public pills,
    // even if the tag group itself is hidden from Church Center filters.
    if (central.length === 1 && /^\d+$/.test(String(central[0].id))) {
      const tags = await fetchGroupsCollection(fetchJson, API_ORIGIN +
        "/groups/v2/tag_groups/" + central[0].id + "/tags?per_page=100");
      tags.data.forEach((tag) => {
        const label = ATTENDANCE_LABELS.find((candidate) =>
          candidate.toLowerCase() ===
            text(tag.attributes && tag.attributes.name).toLowerCase());
        if (label) attendanceTags.set(String(tag.id), label);
      });
    }
    const included = new Map(groups.included.map((item) =>
      [item.type + ":" + item.id, item]));
    const unique = new Map();
    groups.data.forEach((group) => {
      const normalized = normalizePublicGroup(group, included, attendanceTags);
      if (normalized) unique.set(normalized.id, normalized);
    });
    const result = [...unique.values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    cached = result;
    expiresAt = now() + CACHE_MS;
    return result;
  }

  async function loadGroups() {
    if (cached && now() < expiresAt) return cached;
    if (!inFlight) {
      inFlight = refresh().finally(() => {
        inFlight = null;
      });
    }
    // Expired data is not served on failure: hidden/archived changes matter.
    return inFlight;
  }
  return {loadGroups};
}
