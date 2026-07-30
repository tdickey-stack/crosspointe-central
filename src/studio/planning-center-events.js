function cleanText(value, maximum = 500) {
  return String(value || "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function cleanHttpsUrl(value, maximum = 1000) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString().slice(0, maximum) : "";
  } catch (error) {
    return "";
  }
}

function truncateAtWord(value, maximum) {
  const text = cleanText(value, maximum + 1);
  if (text.length <= maximum) return text;
  const candidate = text.slice(0, maximum - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate
    .slice(0, boundary > maximum * 0.6 ? boundary : maximum - 1)
    .trim()}…`;
}

function eventInstanceId(item) {
  return cleanText(item?.planning_center_instance_id || item?.id, 80);
}

export function normalizePlanningCenterEvent(item) {
  const id = eventInstanceId(item);
  const eventId = cleanText(item?.planning_center_event_id, 80);
  const title = cleanText(item?.title, 120);
  const startsAt = cleanText(item?.starts_at, 80);
  if (
    !/^\d{1,80}$/u.test(id) ||
    !/^\d{1,80}$/u.test(eventId) ||
    !title ||
    !startsAt ||
    Number.isNaN(new Date(startsAt).getTime())
  ) {
    return null;
  }

  return {
    id,
    eventId,
    title,
    date: cleanText(item?.date, 60),
    time: cleanText(item?.time, 60),
    startsAt,
    endsAt: cleanText(item?.ends_at, 80),
    location: cleanText(item?.location, 160),
    description: cleanText(item?.description, 1200),
    imageUrl: cleanHttpsUrl(item?.image_url, 1600),
    publicUrl: cleanHttpsUrl(
      item?.registration_url || item?.church_center_url,
      500,
    ),
    registrationUrl: cleanHttpsUrl(item?.registration_url, 500),
  };
}

export function planningCenterEventsFromCentralData(payload) {
  const source = payload?.events;
  const combined = [
    ...(Array.isArray(payload?.today) ? payload.today : []),
    ...(Array.isArray(source) ? source : []),
    ...(!Array.isArray(source) && Array.isArray(source?.today)
      ? source.today
      : []),
    ...(!Array.isArray(source) && Array.isArray(source?.upcoming)
      ? source.upcoming
      : []),
  ];
  const eventsById = new Map();
  combined.forEach((item) => {
    const event = normalizePlanningCenterEvent(item);
    if (event && !eventsById.has(event.id)) eventsById.set(event.id, event);
  });
  return [...eventsById.values()].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

export function planningCenterEventContentChanges(event, currentContent = {}) {
  const description = truncateAtWord(event?.description, 110);
  return {
    title: truncateAtWord(event?.title, 52),
    subtitle: description || cleanText(currentContent.subtitle, 110),
    date: cleanText(event?.date, 28).toUpperCase(),
    time: cleanText(event?.time, 24).toUpperCase(),
    location: truncateAtWord(event?.location, 34).toUpperCase(),
    cta: event?.registrationUrl
      ? "REGISTER IN CHURCH CENTER"
      : event?.publicUrl
        ? "DETAILS IN CHURCH CENTER"
        : cleanText(currentContent.cta, 44),
  };
}

export function planningCenterEventSearchText(event) {
  return [
    event?.title,
    event?.date,
    event?.time,
    event?.location,
    event?.description,
  ]
    .map((value) => cleanText(value, 1200).toLowerCase())
    .join(" ");
}
