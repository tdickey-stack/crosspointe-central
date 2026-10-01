// CP-CM-1.3, pages 6–7: primary and secondary brand colors.
// https://drive.google.com/file/d/1wIWv_YE8DdaqHMQcWqqUg8AoUDTZ6KEd/view
const PALETTE = [
  {background: "#EF3E2D", ink: "#27272A"},
  {background: "#33BECC", ink: "#27272A"},
  {background: "#64242E", ink: "#FFFFFF"},
  {background: "#FAC8C3", ink: "#64242E"},
  {background: "#4BC3A7", ink: "#27272A"},
  {background: "#4BB8E9", ink: "#27272A"},
  {background: "#5558A6", ink: "#FFFFFF"},
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHURCH_TIMEZONE = "America/Chicago";
const text = (value) => String(value || "").trim();

export function eventPalette(item) {
  // A series keeps its identity across occurrences, placements, and filters.
  const key = text(item.planning_center_event_id || item.title || item.id) || "CrossPointe";
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return {...PALETTE[hash % PALETTE.length], pattern: (hash >>> 8) % 3};
}

function calendarParts(value) {
  // Date-only labels are calendar dates, never viewer-local timestamps.
  const label = text(value);
  const named = label.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  const iso = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const month = named ? MONTHS.findIndex((entry) => entry.toLowerCase() === named[1].slice(0, 3).toLowerCase()) : iso ? Number(iso[2]) - 1 : -1;
  const day = Number(named ? named[2] : iso ? iso[3] : 0);
  const year = Number(named ? named[3] : iso ? iso[1] : 0);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || month > 11 || !year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return {month: MONTHS[month].toUpperCase(), day: String(day), year: String(year)};
}

export function eventDateToken(item) {
  let date = calendarParts(item.date);
  if (!date && text(item.starts_at) && Number.isFinite(Date.parse(item.starts_at))) {
    const parts = new Intl.DateTimeFormat("en-US", {timeZone: CHURCH_TIMEZONE, month: "short", day: "numeric", year: "numeric"})
        .formatToParts(new Date(item.starts_at));
    const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
    date = {month: part("month").toUpperCase(), day: part("day"), year: part("year")};
  }
  const closes = !date && !text(item.date) && calendarParts(item.close_date);
  if (closes) date = closes;
  return {
    ...(date || {month: "", day: "", year: ""}),
    label: closes ? "Closes" : "",
    time: closes ? "" : text(item.time),
    // Preserve unusual/legacy date labels rather than guessing a date.
    fallback: date ? "" : text(item.date) || (text(item.close_date) ? `Closes ${text(item.close_date)}` : ""),
  };
}

export function safeEventImageUrl(value) {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch (_error) {
    return "";
  }
}

function node(tag, className, value) {
  const result = document.createElement(tag);
  result.className = className;
  if (value != null) result.textContent = value;
  return result;
}

export function createEventMedia(item, {kind = "Event", eager = false, showDate = true} = {}) {
  const palette = eventPalette(item);
  const media = node("div", `event-media event-pattern-${palette.pattern}`);
  media.style.setProperty("--event-color", palette.background);
  media.style.setProperty("--event-ink", palette.ink);
  const fallback = node("div", "event-fallback");
  fallback.setAttribute("aria-hidden", "true");
  fallback.append(node("span", "event-fallback-shape"), node("span", "event-fallback-kind", kind));
  media.append(fallback);
  const url = safeEventImageUrl(item.image_url);
  if (url) {
    // A blurred copy works with third-party thumbnails without requiring
    // canvas pixel access or changing how Planning Center images load.
    const backdrop = node("div", "event-image-backdrop");
    backdrop.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.alt = "";
    image.loading = eager ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => {
      backdrop.style.backgroundImage = `url("${url.replaceAll('"', "%22")}")`;
      media.classList.add("has-event-image");
    }, {once: true});
    image.addEventListener("error", () => {
      image.remove();
      backdrop.remove();
      media.classList.remove("has-event-image");
    }, {once: true});
    image.src = url;
    media.append(backdrop, image);
  }
  if (showDate) {
    const token = createEventDateToken(item);
    if (token) media.append(token);
  }
  return media;
}

export function createEventDateToken(item) {
  const date = eventDateToken(item);
  if (date.day || date.fallback || date.time) {
    const token = node("div", "event-date-token");
    if (date.label) token.append(node("span", "event-date-label", date.label));
    if (date.day) {
      token.append(node("span", "event-date-month", `${date.month} ${date.year}`), node("span", "event-date-day", date.day));
    } else if (date.fallback) {
      token.append(node("span", "event-date-label", date.fallback));
    }
    if (date.time) {
      const time = node("span", "event-date-time");
      const range = date.time.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (range) time.append(node("span", "", range[1]), node("span", "", `– ${range[2]}`));
      else time.textContent = date.time;
      token.append(time);
    }
    return token;
  }
  return null;
}

export function eventLocationMeta(item) {
  const range = text(item.end_date) && text(item.end_date) !== text(item.date) ? `Through ${text(item.end_date)}` : "";
  return [range, text(item.location || item.venue)].filter(Boolean).join(" · ");
}
