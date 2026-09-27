// Local design-preview selections only. Saved promotion schedules will be resolved
// by the server against these same public source records in a later phase.
export const HIGHLIGHT_TYPES = Object.freeze({
  events: {label: "Event", plural: "Events", icon: "calendar"},
  registrations: {label: "Registration", plural: "Registrations", icon: "ticket"},
  campaigns: {label: "Campaign", plural: "Campaigns", icon: "people"},
  serveNeeds: {label: "Serve opportunity", plural: "Serve Needs", icon: "heart"},
});

const text = (value) => String(value ?? "").trim();
const disabled = (value) => value === false || /^(false|0)$/i.test(text(value));

export function highlightCandidates(data, now = Date.now()) {
  const modules = Array.isArray(data?.settings?.homepage_modules) ? data.settings.homepage_modules : [];
  const result = [];
  const seen = new Set();
  for (const type of Object.keys(HIGHLIGHT_TYPES)) {
    if (disabled(modules.find((entry) => entry.id === type)?.enabled)) continue;
    for (const item of Array.isArray(data?.[type]) ? data[type] : []) {
      if (!item || disabled(item.active) || disabled(item.published)) continue;
      const id = text(type === "events" ? item.planning_center_instance_id || item.id : item.id);
      const title = text(type === "serveNeeds" ? item.need : item.title);
      if (!id || !title) continue;
      // The public feed owns source visibility (including campaign date windows
      // and registration status). Never guess dates from its formatted labels.
      if (type === "events") {
        const deadline = Date.parse(item.ends_at || item.starts_at);
        if (!Number.isFinite(deadline) || deadline <= now) continue;
      }
      const key = `${type}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({key, type, id, title, item});
    }
  }
  return result;
}

export function defaultHighlightKeys(candidates, featuredId = "") {
  // A representative mix for visual review, not an editorial promotion policy.
  const selected = [];
  for (const type of ["events", "campaigns", "serveNeeds", "registrations"]) {
    const candidate = candidates.find((entry) => entry.type === type &&
      (type !== "events" || entry.id !== text(featuredId)));
    if (candidate) selected.push(candidate.key);
    if (selected.length === 3) break;
  }
  for (const candidate of candidates) {
    if (selected.length === 3) break;
    if (!selected.includes(candidate.key)) selected.push(candidate.key);
  }
  return selected;
}

export function resolveHighlightKeys(candidates, keys) {
  const byKey = new Map(candidates.map((entry) => [entry.key, entry]));
  return [...new Set(keys)].map((key) => byKey.get(key)).filter(Boolean).slice(0, 3);
}
