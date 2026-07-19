import {
  isApprovedFeaturedEventAlias,
  normalizeFeaturedEventName,
} from "./featured-events.js";

const API_ORIGIN = "https://api.planningcenteronline.com";
const EVENT_SOURCE = "planning_center_event";
const GROUP_SOURCE = "planning_center_groups";
const GENERAL_EVENT_DAYS = 14;
const NAMED_EVENT_DAYS = 183;
const MAX_API_PAGES = 5;
const MAX_GROUP_RESULTS = 5;

const GENERIC_EVENT_PATTERN = new RegExp(
    "^(?:what(?:'s| is)?|which|any|show me|list)?\\s*(?:church\\s+)?" +
    "(?:upcoming\\s+)?events?(?:\\s+(?:are\\s+)?" +
    "(?:coming\\s+up|soon))?[?!. ]*$",
    "i",
);
const TODAY_PATTERN = /\b(?:today|tonight|later today)\b/i;
const RELATIVE_WEEK_PATTERN =
  /\b(?:(?:this|coming|next)\s+week|this\s+weekend)\b/i;
const NEXT_WEEK_PATTERN = /\bnext\s+week\b/i;
const MINISTRY_EVENT_PATTERN = new RegExp(
    "\\b(?:kids?|children|students?|youth|college(?:\\s+students?)?|" +
    "young\\s+adults?|women'?s|men'?s|outreach)" +
    "\\s+events?\\b",
    "i",
);
const STOP_WORDS = new Set([
  "a", "an", "and", "any", "are", "at", "can", "church", "crosspointe",
  "do", "does", "event", "events", "find", "for", "group", "groups", "have",
  "how", "i", "in", "is", "it", "join", "me", "my", "of", "on", "pointe",
  "show", "small", "the", "there", "this", "to", "up", "what", "when",
  "where", "which", "who", "with",
]);

export function createWayfinderPlanningCenterRetriever(options = {}) {
  const fetchJson = options.fetchJson;
  if (typeof fetchJson !== "function") {
    throw new TypeError("Planning Center retrieval requires fetchJson.");
  }

  const timezone = String(options.timezone || "America/Chicago");
  const centralTagName = String(options.centralTagName || "Central").trim();
  const priorityTagName = String(
      options.priorityTagName || "Wayfinder Priority",
  ).trim();
  const resolveEventRooms = typeof options.resolveEventRooms === "function" ?
    options.resolveEventRooms : async () => [];
  const getFeaturedEvents = typeof options.getFeaturedEvents === "function" ?
    options.getFeaturedEvents : async () => ({
      status: "unavailable",
      events: [],
    });
  const now = typeof options.now === "function" ?
    options.now : () => new Date();

  return async ({question, sourceTypes}) => {
    const requested = new Set(Array.isArray(sourceTypes) ? sourceTypes : []);
    const liveEntries = [];
    const statuses = {};

    if (requested.has(EVENT_SOURCE)) {
      try {
        const featured = await getFeaturedEvents();
        const events = await retrieveEvents_({
          question,
          fetchJson,
          resolveEventRooms,
          timezone,
          centralTagName,
          priorityTagName,
          featured,
          now,
        });
        liveEntries.push(...events.entries);
        statuses[EVENT_SOURCE] = events.status;
      } catch (error) {
        statuses[EVENT_SOURCE] = "unavailable";
        console.error("Wayfinder Planning Center event retrieval failed.", {
          code: String(error && error.code || "planning_center_event_error"),
          name: String(error && error.name || "Error"),
        });
      }
    }

    if (requested.has(GROUP_SOURCE)) {
      try {
        const groups = await retrieveGroups_({question, fetchJson});
        liveEntries.push(...groups.entries);
        statuses[GROUP_SOURCE] = groups.status;
      } catch (error) {
        statuses[GROUP_SOURCE] = "unavailable";
        console.error("Wayfinder Planning Center group retrieval failed.", {
          code: String(error && error.code || "planning_center_group_error"),
          name: String(error && error.name || "Error"),
        });
      }
    }

    return {entries: liveEntries, statuses};
  };
}

async function retrieveEvents_(context) {
  const question = String(context.question || "").trim();
  const current = context.now();
  const todayOnly = TODAY_PATTERN.test(question);
  const relativeWeek = RELATIVE_WEEK_PATTERN.test(question);
  const ministrySearch = MINISTRY_EVENT_PATTERN.test(question);
  const youthEventSearch = isYouthEventSearch_(question);
  const collegeEventSearch = isCollegeEventSearch_(question);
  const namedSearch = !todayOnly &&
    !relativeWeek &&
    !isGenericEventQuestion_(question) &&
    !ministrySearch;
  const targetedSearch = namedSearch || ministrySearch;
  let lookaheadDays = GENERAL_EVENT_DAYS;
  if (targetedSearch) {
    lookaheadDays = NAMED_EVENT_DAYS;
  } else if (relativeWeek) {
    lookaheadDays = NEXT_WEEK_PATTERN.test(question) ? 14 : 7;
  }
  const end = new Date(current.getTime() + lookaheadDays * 86400000);
  const url = new URL("/calendar/v2/event_instances", API_ORIGIN);
  url.searchParams.set("include", "tags,event");
  url.searchParams.set("order", "starts_at");
  url.searchParams.set("where[starts_at][gte]", current.toISOString());
  url.searchParams.set("where[starts_at][lte]", end.toISOString());
  url.searchParams.set("per_page", "100");

  const pages = await fetchSafePages_(context.fetchJson, url.toString());
  const tagMap = buildIncludedMap_(pages, "Tag", (item) => {
    return String(item.attributes && item.attributes.name || "").trim();
  });
  const eventMap = buildIncludedMap_(pages, "Event", (item) => {
    return item.attributes || {};
  });
  const tokens = meaningfulTokens_(question);
  const candidates = pages.flatMap((page) => page.data || [])
      .map((instance) => normalizeEvent_(
          instance,
          tagMap,
          eventMap,
          current,
      ))
      .filter(Boolean)
      .filter((event) => event.tags.includes(context.centralTagName) ||
        isFeaturedEventMatch_(event, context.featured, context.timezone))
      .filter((event) => !isRegularWeeklyProgramming_(
          event, context.timezone,
      ) || isFeaturedEventMatch_(
          event, context.featured, context.timezone,
      ))
      .filter((event) => !youthEventSearch || !isYoungAdultEvent_(event))
      .filter((event) => !collegeEventSearch || isYoungAdultEvent_(event));

  let selected;
  if (todayOnly) {
    const todayKey = localDateKey_(current, context.timezone);
    selected = candidates.filter((event) => {
      return localDateKey_(event.startsAt, context.timezone) === todayKey;
    });
  } else if (targetedSearch) {
    selected = candidates
        .map((event) => ({event, score: scoreText_(event.searchText, tokens)}))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score ||
          a.event.startsAt.getTime() - b.event.startsAt.getTime())
        .map((item) => item.event);
  } else {
    const hasWebsitePriority = context.featured &&
      context.featured.status === "ok";
    selected = [...candidates].sort((a, b) => {
      const priorityDifference = hasWebsitePriority ?
        Number(isFeaturedEventMatch_(b, context.featured, context.timezone)) -
          Number(isFeaturedEventMatch_(
              a, context.featured, context.timezone,
          )) :
        Number(b.tags.includes(context.priorityTagName)) -
          Number(a.tags.includes(context.priorityTagName));
      return priorityDifference || a.startsAt.getTime() - b.startsAt.getTime();
    });
  }

  selected = deduplicateRecurringEvents_(selected)
      .slice(0, todayOnly ? 12 : 3);

  const entries = await Promise.all(selected.map(async (event) => {
    const rooms = await context.resolveEventRooms(event.id);
    const featuredMatch = findFeaturedEventMatch_(
        event, context.featured, context.timezone,
    );
    return buildEventEntry_(event, rooms, context.timezone, featuredMatch);
  }));

  if (!entries.length) {
    return {
      status: "no_matches",
      entries: [buildNoEventMatchEntry_(question, lookaheadDays)],
    };
  }

  return {status: "ok", entries};
}

function isFeaturedEventMatch_(event, featured, timezone) {
  return Boolean(findFeaturedEventMatch_(event, featured, timezone));
}

function findFeaturedEventMatch_(event, featured, timezone) {
  if (!featured || featured.status !== "ok" ||
    !Array.isArray(featured.events)) return null;
  const eventName = normalizeFeaturedEventName(event.name);
  const eventTokens = featuredIdentityTokens_(eventName);
  const eventDate = localDateKey_(event.startsAt, timezone);
  return featured.events.find((item) => {
    const featuredName = normalizeFeaturedEventName(
        item.normalizedName || item.name,
    );
    if (featuredName === eventName) return true;
    if (isApprovedFeaturedEventAlias(item.name, event.name)) return true;
    const featuredDate = new Date(String(item.startsAt || ""));
    if (Number.isNaN(featuredDate.getTime()) ||
      localDateKey_(featuredDate, timezone) !== eventDate) return false;
    const featuredTokens = featuredIdentityTokens_(featuredName);
    return [...featuredTokens].some((token) => eventTokens.has(token));
  }) || null;
}

function featuredIdentityTokens_(value) {
  const ignored = new Set([
    "event", "ministry", "night", "pointe", "the", "crosspointe",
  ]);
  return new Set(String(value || "").split(/\s+/)
      .filter((token) => token.length >= 3 && !ignored.has(token)));
}

async function retrieveGroups_({question, fetchJson}) {
  const url = new URL("/groups/v2/groups", API_ORIGIN);
  url.searchParams.set("filter", "published");
  url.searchParams.set("include", "group_type,tags,enrollment");
  url.searchParams.set("order", "name");
  url.searchParams.set("per_page", "100");

  const pages = await fetchSafePages_(fetchJson, url.toString());
  const groupTypes = buildIncludedMap_(pages, "GroupType", (item) => {
    const attrs = item.attributes || {};
    return attrs.church_center_visible === false ?
      "" : String(attrs.name || "");
  });
  const tags = buildIncludedMap_(pages, "Tag", (item) => {
    return String(item.attributes && item.attributes.name || "").trim();
  });
  const enrollments = buildIncludedMap_(pages, "Enrollment", (item) => {
    const attrs = item.attributes || {};
    return {
      status: String(attrs.status || "").trim(),
      strategy: String(attrs.strategy || "").trim(),
    };
  });
  const tokens = meaningfulTokens_(question);
  const groups = pages.flatMap((page) => page.data || [])
      .map((group) => normalizeGroup_(group, groupTypes, tags, enrollments))
      .filter(Boolean);
  const isGeneral = tokens.length === 0 || /\b(?:all|directory|available)\b/i
      .test(String(question || ""));
  const selected = groups
      .map((group) => ({
        group,
        score: isGeneral ? 1 : scoreText_(group.searchText, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score ||
        a.group.name.localeCompare(b.group.name))
      .slice(0, MAX_GROUP_RESULTS)
      .map((item) => buildGroupEntry_(item.group));

  if (!selected.length) {
    return {status: "no_matches", entries: [buildNoGroupMatchEntry_()]};
  }

  return {status: "ok", entries: selected};
}

function normalizeEvent_(instance, tagMap, eventMap, current) {
  const attrs = instance && instance.attributes || {};
  const startsAt = new Date(attrs.published_starts_at || attrs.starts_at || "");
  if (!instance || !instance.id || Number.isNaN(startsAt.getTime()) ||
    startsAt.getTime() <= current.getTime()) {
    return null;
  }
  const endsAt = new Date(attrs.published_ends_at || attrs.ends_at || "");
  const tagRefs = instance.relationships && instance.relationships.tags &&
    Array.isArray(instance.relationships.tags.data) ?
    instance.relationships.tags.data : [];
  const tags = tagRefs.map((reference) => tagMap.get(String(reference.id)))
      .filter(Boolean);
  const eventReference = instance && instance.relationships &&
    instance.relationships.event && instance.relationships.event.data;
  const eventAttrs = eventReference ?
    eventMap.get(String(eventReference.id)) || {} : {};
  const name = cleanPublicText_(attrs.name || "Untitled Event", 200);
  const description = cleanPublicText_(
      eventAttrs.description || eventAttrs.summary || "",
      900,
  );
  const recurrence = cleanPublicText_(attrs.recurrence_description || "", 500);
  const location = cleanEventLocation_(attrs.location);
  const url = approvedPublicUrl_(attrs.church_center_url);
  const registrationUrl = approvedExternalActionUrl_(
      eventAttrs.registration_url,
  );
  const imageUrl = approvedExternalActionUrl_(
      eventAttrs.image_url || attrs.image_url,
  );

  return {
    id: String(instance.id),
    name,
    description,
    recurrence,
    location,
    startsAt,
    endsAt: Number.isNaN(endsAt.getTime()) ? null : endsAt,
    url,
    registrationUrl,
    imageUrl,
    tags,
    searchText: [name, description, recurrence, location, ...tags]
        .join(" ").toLowerCase(),
  };
}

function normalizeGroup_(group, groupTypes, tags, enrollments) {
  const attrs = group && group.attributes || {};
  if (!group || !group.id || attrs.listed !== true || attrs.archived_at) {
    return null;
  }
  const url = approvedPublicUrl_(attrs.public_church_center_web_url);
  if (!url) return null;
  const typeRef = relationshipId_(group, "group_type");
  const typeName = typeRef ? groupTypes.get(typeRef) : "";
  const tagRefs = relationshipIds_(group, "tags");
  const publicTags = tagRefs.map((id) => tags.get(id)).filter(Boolean);
  const enrollmentRef = relationshipId_(group, "enrollment");
  const enrollment = enrollmentRef ? enrollments.get(enrollmentRef) : null;
  const name = cleanPublicText_(attrs.name, 160);
  if (!name) return null;
  const description = cleanPublicText_(
      attrs.description_as_plain_text || attrs.description || "",
      500,
  );
  const schedule = cleanPublicText_(attrs.schedule || "", 240);

  return {
    id: String(group.id),
    name,
    description,
    schedule,
    typeName: cleanPublicText_(typeName, 120),
    tags: publicTags.map((tag) => cleanPublicText_(tag, 80)).filter(Boolean),
    enrollment: enrollment && {
      status: cleanPublicText_(enrollment.status, 60),
      strategy: cleanPublicText_(enrollment.strategy, 60),
    },
    url,
    searchText: [name, description, schedule, typeName, ...publicTags]
        .join(" ").toLowerCase(),
  };
}

function buildEventEntry_(event, rawRooms, timezone, featuredEvent = null) {
  const rooms = (Array.isArray(rawRooms) ? rawRooms : [])
      .map((room) => cleanPublicText_(room, 120)).filter(Boolean);
  const location = rooms.length ? rooms.join(", ") : event.location;
  const displayName = cleanPublicText_(
      featuredEvent && featuredEvent.name, 160,
  ) || event.name;
  const featuredDescription = cleanPublicText_(
      featuredEvent && featuredEvent.description, 900,
  );
  const isFeatured = Boolean(featuredEvent);
  const facts = [
    "The verified event is " + displayName + " on " +
      formatEventDate_(event.startsAt, timezone) + " at " +
      formatEventTime_(event.startsAt, timezone) + ".",
  ];
  if (event.endsAt) {
    facts.push("The listed end time is " +
      formatEventTime_(event.endsAt, timezone) + ".");
  }
  facts.push(location ? "The listed location is " + location + "." :
    "A location has not been posted yet.");
  if (event.recurrence) {
    facts.push("Public event note: " + event.recurrence);
  }
  if (event.description) {
    facts.push("Public event description: " + event.description);
  }
  if (featuredDescription) {
    facts.push("Public Featured Event description: " + featuredDescription);
  }

  return {
    id: "live-event-" + safeId_(event.id),
    topic: "live_events",
    title: displayName,
    responseMode: "guided",
    requiredFacts: facts,
    requiredActions: [
      "Treat these as live Planning Center details.",
      ...(isFeatured ? [
        "When listing multiple events, present this event before events " +
          "that are not featured. Do not explain the internal ranking.",
        "Use the Featured Event description only as supplemental public " +
          "context. Planning Center remains authoritative for schedule and " +
          "location details.",
      ] : []),
    ],
    prohibitedClaims: [
      "Do not add dates, times, locations, registration details, or capacity " +
      "information that are not stated here.",
      "The main event link is for details. Do not call it a registration " +
      "link unless the approved facts explicitly identify registration.",
    ],
    approvedLinks: event.url ? [{label: displayName, url: event.url}] : [],
    approvedActions: [buildEventDetailsAction_(
        event,
        location,
        displayName,
        featuredDescription,
        featuredEvent,
        timezone,
    )],
    liveSource: {type: EVENT_SOURCE, sourceId: event.id},
  };
}

function buildEventDetailsAction_(
    event,
    location,
    displayName,
    featuredDescription,
    featuredEvent,
    timezone,
) {
  const featuredRegistration = featuredEvent &&
    featuredEvent.registrationAction || null;
  const registrationUrl = event.registrationUrl ||
    approvedExternalActionUrl_(featuredRegistration &&
      featuredRegistration.url);
  const registrationLabel = event.registrationUrl ?
    (/churchcenter\.com$/i.test(new URL(event.registrationUrl).hostname) ?
      "Register in Church Center" : "Register") :
    cleanPublicText_(featuredRegistration && featuredRegistration.label, 80);
  const identity = featuredEvent ?
    "featured-event:" + normalizeFeaturedEventName(displayName) :
    "planning-center-event:" + safeId_(event.id);

  return {
    type: "event_details",
    id: identity,
    label: cleanPublicText_("View " + displayName, 80),
    event: {
      title: displayName,
      date: formatEventModalDate_(event.startsAt, timezone),
      time: formatEventTimeRange_(event.startsAt, event.endsAt, timezone),
      location: location,
      venue: location,
      address: "",
      description: featuredDescription || event.description,
      recurrence: event.recurrence,
      imageUrl: event.imageUrl,
      registrationUrl: registrationUrl,
      registrationLabel: registrationUrl ? registrationLabel : "",
    },
  };
}

function buildGroupEntry_(group) {
  const facts = ["Planning Center currently lists the Pointe Group " +
    group.name + "."];
  if (group.typeName) {
    facts.push("Its group category is " + group.typeName + ".");
  }
  if (group.schedule) {
    facts.push("Its published schedule is " + group.schedule + ".");
    facts.push(...buildScheduleTimeFacts_(group.schedule));
  }
  if (group.description) {
    facts.push("Public description: " + group.description);
  }
  if (group.tags.length) {
    facts.push("Public group tags: " + group.tags.join(", ") + ".");
  }
  if (group.enrollment && group.enrollment.strategy) {
    facts.push("The published join process is " +
      humanizeValue_(group.enrollment.strategy) + ".");
  }
  if (group.enrollment && group.enrollment.status) {
    facts.push("The published enrollment status is " +
      humanizeValue_(group.enrollment.status) + ".");
  }

  return {
    id: "live-group-" + safeId_(group.id),
    topic: "pointe_groups",
    title: group.name,
    responseMode: "guided",
    requiredFacts: facts,
    requiredActions: [
      "Use the public Church Center group page for current details or to " +
      "request to join.",
    ],
    prohibitedInformation: [
      "private street addresses", "leader contact information", "member lists",
      "attendance", "applications", "internal notes",
    ],
    approvedLinks: [{label: group.name, url: group.url}],
    liveSource: {type: GROUP_SOURCE, sourceId: group.id},
  };
}

function buildNoEventMatchEntry_(question, lookaheadDays) {
  return {
    id: "live-events-no-match",
    topic: "live_events",
    title: "No Matching Published Event",
    responseMode: "guided",
    requiredFacts: [
      "No matching public Central-tagged Planning Center event was found " +
      "within the next " + lookaheadDays + " days for this question.",
    ],
    requiredActions: [
      "Say that no matching event is currently posted; do not say the " +
      "event or ministry will never occur.",
    ],
    approvedLinks: [{
      label: "CrossPointe events",
      url: "https://www.crosspointe.tv/events",
    }],
  };
}

function buildNoGroupMatchEntry_() {
  return {
    id: "live-groups-no-match",
    topic: "pointe_groups",
    title: "No Matching Published Pointe Group",
    responseMode: "guided",
    requiredFacts: [
      "No matching published Pointe Group was found in the current " +
      "Planning Center directory.",
    ],
    requiredActions: [
      "Say that no matching group is currently posted; do not imply that " +
      "the ministry has no groups or future plans.",
    ],
    approvedLinks: [{
      label: "Pointe Group directory",
      url: "https://www.crosspointe.tv/small-groups",
    }],
  };
}

async function fetchSafePages_(fetchJson, initialUrl) {
  const pages = [];
  let nextUrl = initialUrl;
  for (let page = 0; nextUrl && page < MAX_API_PAGES; page += 1) {
    assertApprovedApiUrl_(nextUrl);
    const payload = await fetchJson(nextUrl);
    pages.push(payload && typeof payload === "object" ? payload : {});
    nextUrl = payload && payload.links ? payload.links.next : "";
  }
  return pages;
}

function assertApprovedApiUrl_(value) {
  const url = new URL(String(value || ""));
  const approvedPath =
    url.pathname.startsWith("/calendar/v2/event_instances") ||
    url.pathname === "/groups/v2/groups";
  if (url.origin !== API_ORIGIN || !approvedPath) {
    const error = new Error(
        "Planning Center attempted an unapproved API path.",
    );
    error.code = "wayfinder-pco-path-denied";
    throw error;
  }
}

function buildIncludedMap_(pages, type, transform) {
  const map = new Map();
  pages.forEach((page) => {
    (Array.isArray(page.included) ? page.included : []).forEach((item) => {
      if (item && item.type === type && item.id) {
        map.set(String(item.id), transform(item));
      }
    });
  });
  return map;
}

function relationshipId_(item, name) {
  const data = item && item.relationships && item.relationships[name] &&
    item.relationships[name].data;
  return data && !Array.isArray(data) && data.id ? String(data.id) : "";
}

function relationshipIds_(item, name) {
  const data = item && item.relationships && item.relationships[name] &&
    item.relationships[name].data;
  return (Array.isArray(data) ? data : [])
      .map((entry) => String(entry.id || ""))
      .filter(Boolean);
}

function isGenericEventQuestion_(question) {
  const value = String(question || "").trim();
  return GENERIC_EVENT_PATTERN.test(value) ||
    (/\b(?:events?|happening)\b/i.test(value) &&
      meaningfulTokens_(value).length === 0);
}

function isRegularWeeklyProgramming_(event, timezone) {
  const title = String(event.name || "").toLowerCase();
  const localDay = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(event.startsAt);
  const sundayProgram = new RegExp(
      "\\b(?:sunday school|worship service|sunday service|kingdom kids|" +
      "children'?s church|nursery)\\b",
      "i",
  );
  if (localDay === "Sun" && sundayProgram.test(title)) {
    return true;
  }
  const wednesdayProgram = new RegExp(
      "\\b(?:wednesday nights?|bible study|csm|student ministr|youth ministr|" +
      "children'?s ministr)\\b",
      "i",
  );
  return localDay === "Wed" && wednesdayProgram.test(title);
}

function deduplicateRecurringEvents_(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = String(event.name || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meaningfulTokens_(value) {
  const tokens = new Set(String(value || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
  if (["woman", "women", "womens", "lady", "ladies"]
      .some((token) => tokens.has(token))) {
    tokens.add("women");
    tokens.add("womens");
    tokens.add("lady");
    tokens.add("ladies");
  }
  const adultAudience = ["college", "career", "adult", "adults"]
      .some((token) => tokens.has(token));
  if (adultAudience) {
    tokens.add("young");
    tokens.add("adult");
    tokens.add("adults");
    tokens.add("college");
    tokens.add("career");
  }
  if (!adultAudience && ["csm", "student", "students", "youth"]
      .some((token) => tokens.has(token))) {
    tokens.add("csm");
    tokens.add("student");
    tokens.add("students");
    tokens.add("youth");
  }
  return [...tokens];
}

function isYouthEventSearch_(question) {
  const value = String(question || "");
  return /\b(?:csm|students?|youth|middle school|high school)\b/i.test(value) &&
    !/\b(?:young adults?|college|career)\b/i.test(value);
}

function isCollegeEventSearch_(question) {
  const currentQuestion = String(question || "").trim().split(/\n/).pop() || "";
  return /\b(?:young adults?|college|career)\b/i.test(currentQuestion);
}

function isYoungAdultEvent_(event) {
  return /\byoung adults?\b/i.test(String(event && event.searchText || ""));
}

function scoreText_(text, tokens) {
  if (!tokens.length) return 0;
  const haystack = " " + String(text || "").toLowerCase() + " ";
  return tokens.reduce((score, token) => {
    const exact = haystack.includes(" " + token + " ");
    return score + (exact ? 5 : haystack.includes(token) ? 2 : 0);
  }, 0);
}

function localDateKey_(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function formatEventDate_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatEventModalDate_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatEventTime_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatEventTimeRange_(startsAt, endsAt, timezone) {
  const start = formatEventTime_(startsAt, timezone);
  if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
    return start;
  }
  return start + " - " + formatEventTime_(endsAt, timezone);
}

function cleanPublicText_(value, maxLength) {
  return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
}

function cleanEventLocation_(value) {
  return cleanPublicText_(value, 240)
      .replace(
          "CrossPointe Church - 2601 24th Ave SE, Norman, OK 73071",
          "CrossPointe Church",
      )
      .trim();
}

function approvedPublicUrl_(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (!url.hostname.endsWith("churchcenter.com") &&
      url.hostname !== "crosspointe.tv" &&
      url.hostname !== "www.crosspointe.tv") return "";
    return url.toString();
  } catch (error) {
    return "";
  }
}

function approvedExternalActionUrl_(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !url.hostname ||
      url.username || url.password) return "";
    return url.toString().slice(0, 1000);
  } catch (error) {
    return "";
  }
}

function safeId_(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
}

function humanizeValue_(value) {
  return String(value || "").replace(/_/g, " ").trim();
}

function buildScheduleTimeFacts_(schedule) {
  const timeRangePattern = new RegExp(
      "\\bfrom\\s+(\\d{1,2})(?::(\\d{2}))?\\s*-\\s*" +
      "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)\\b",
      "i",
  );
  const range = String(schedule || "").match(timeRangePattern);
  if (!range) return [];
  const meridiem = range[5].toUpperCase();
  const startMinute = range[2] || "00";
  const endMinute = range[4] || "00";
  return [
    "The published meeting starts at " + range[1] + " " + meridiem +
      " (" + range[1] + ":" + startMinute + " " + meridiem + ").",
    "The published meeting ends at " + range[3] + ":" + endMinute + " " +
      meridiem + ".",
    "The published meeting time is " + range[1] + ":" + startMinute + "-" +
      range[3] + ":" + endMinute + " " + meridiem + ".",
  ];
}

export const WAYFINDER_PCO_SOURCE_TYPES = {
  events: EVENT_SOURCE,
  groups: GROUP_SOURCE,
};
