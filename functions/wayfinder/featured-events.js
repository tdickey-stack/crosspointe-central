const EVENTS_PAGE_URL = "https://www.crosspointe.tv/events";
const EVENTS_API_URL = "https://api.thechurchco.com/v1/event";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_FEATURED_EVENTS = 50;
const REGISTRATION_CTA_PATTERN = new RegExp(
    "\\b(?:register|registration|sign\\s*up|signup|tickets?|apply|rsvp|" +
    "waitlist)\\b",
    "i",
);

/**
 * Builds a cached reader for the public Featured Events section.
 *
 * The website is used only to identify featured event names. Planning Center
 * remains authoritative for every detail shown to a person.
 *
 * @param {Object} options Dependency overrides for tests.
 * @return {Function} Async featured-event reader.
 */
export function createWayfinderFeaturedEventProvider(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Featured event retrieval requires fetch.");
  }
  const now = typeof options.now === "function" ?
    options.now : () => new Date();
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ?
    Math.max(0, options.cacheTtlMs) : DEFAULT_CACHE_TTL_MS;
  let cache = null;

  return async (request = {}) => {
    const current = now();
    if (request.forceRefresh !== true && cache &&
      current.getTime() - cache.cachedAt < cacheTtlMs) {
      return cache.value;
    }

    let value;
    try {
      value = await fetchFeaturedEvents_({fetchImpl, current});
    } catch (error) {
      console.error("Wayfinder Featured Events retrieval failed.", {
        code: String(error && error.code || "featured_events_error"),
        name: String(error && error.name || "Error"),
      });
      value = {status: "unavailable", events: []};
    }
    cache = {cachedAt: current.getTime(), value};
    return value;
  };
}

async function fetchFeaturedEvents_({fetchImpl, current}) {
  const pageResponse = await fetchWithTimeout_(fetchImpl, EVENTS_PAGE_URL, {
    headers: {Accept: "text/html"},
    redirect: "error",
  });
  assertSuccessfulResponse_(pageResponse, "featured_events_page_failed");
  const html = await pageResponse.text();
  if (html.length > MAX_HTML_LENGTH) {
    throw codedError_("Featured Events page was too large.",
        "featured_events_page_too_large");
  }
  const token = extractVisitorToken_(html);

  const apiUrl = new URL(EVENTS_API_URL);
  apiUrl.searchParams.set("page", "1");
  apiUrl.searchParams.set("limit", String(MAX_FEATURED_EVENTS));
  apiUrl.searchParams.set("startTime", current.toISOString());
  apiUrl.searchParams.set("recurrence", "true");
  apiUrl.searchParams.set("nextOnly", "true");
  const apiResponse = await fetchWithTimeout_(fetchImpl, apiUrl.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + token,
    },
    redirect: "error",
  });
  assertSuccessfulResponse_(apiResponse, "featured_events_api_failed");
  const payload = await apiResponse.json();
  const rows = payload && payload.data && Array.isArray(payload.data.rows) ?
    payload.data.rows : null;
  if (!rows) {
    throw codedError_("Featured Events response was invalid.",
        "featured_events_invalid_response");
  }

  const seen = new Set();
  const events = rows.slice(0, MAX_FEATURED_EVENTS)
      .map(sanitizeFeaturedEvent_)
      .filter(Boolean)
      .filter((event) => {
        if (seen.has(event.normalizedName)) return false;
        seen.add(event.normalizedName);
        return true;
      });
  return {
    status: "ok",
    fetchedAt: current.toISOString(),
    events,
  };
}

async function fetchWithTimeout_(fetchImpl, url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {...options, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}

function assertSuccessfulResponse_(response, code) {
  if (!response || response.ok !== true) {
    throw codedError_("Featured Events request failed.", code);
  }
}

function extractVisitorToken_(html) {
  const escaped = String(html || "")
      .match(/\\"token\\":\\"(eyJ[^\\"]{20,4096})/);
  const plain = escaped ? null : String(html || "")
      .match(/"token"\s*:\s*"(eyJ[^"\s]{20,4096})"/);
  const token = escaped && escaped[1] || plain && plain[1] || "";
  if (!token.startsWith("eyJ")) {
    throw codedError_("Public visitor token was not found.",
        "featured_events_token_missing");
  }
  return token;
}

function sanitizeFeaturedEvent_(row) {
  const name = cleanText_(row && row.name, 160);
  const slug = String(row && row.slug || "").trim().toLowerCase();
  const startsAt = new Date(String(row && row.startTime || ""));
  const normalizedName = normalizeFeaturedEventName(name);
  if (!name || !normalizedName || Number.isNaN(startsAt.getTime()) ||
    !/^[a-z0-9-]{1,160}$/.test(slug)) {
    return null;
  }
  return {
    name,
    normalizedName,
    startsAt: startsAt.toISOString(),
    description: extractFeaturedContentText_(row && row.content),
    registrationAction: extractFeaturedRegistrationAction_(
        row && row.content,
    ),
    url: "https://www.crosspointe.tv/event/" + slug,
  };
}

function extractFeaturedContentText_(content) {
  if (typeof content === "string") return cleanText_(content, 900);
  const blocks = content && Array.isArray(content.blocks) ?
    content.blocks.slice(0, 30) : [];
  return cleanText_(blocks.map((block) => {
    return block && block.data && typeof block.data.text === "string" ?
      block.data.text : "";
  }).filter(Boolean).join(" "), 900);
}

function extractFeaturedRegistrationAction_(content) {
  const blocks = content && Array.isArray(content.blocks) ?
    content.blocks.slice(0, 30) : [];

  for (const block of blocks) {
    const buttons = block && block.data && Array.isArray(block.data.buttons) ?
      block.data.buttons.slice(0, 5) : [];
    for (const button of buttons) {
      const label = cleanText_(button && button.text, 80);
      const url = approvedRegistrationUrl_(button && button.url);
      if (label && url && REGISTRATION_CTA_PATTERN.test(label)) {
        return {label, url};
      }
    }
  }

  return null;
}

function approvedRegistrationUrl_(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !url.hostname ||
      url.username || url.password) return "";
    return url.toString().slice(0, 1000);
  } catch (error) {
    return "";
  }
}

/**
 * Canonicalizes a public event name for exact cross-source matching.
 *
 * @param {string} value Event name.
 * @return {string} Normalized event identity.
 */
export function normalizeFeaturedEventName(value) {
  return String(value || "").toLowerCase()
      .replace(/[’']/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

/**
 * Checks a small set of approved public-title to PCO-title mappings.
 *
 * @param {string} featuredName Website Featured Event name.
 * @param {string} planningCenterName Planning Center event name.
 * @return {boolean} Whether the titles are an approved equivalent.
 */
export function isApprovedFeaturedEventAlias(
    featuredName, planningCenterName,
) {
  const websiteName = normalizeFeaturedEventName(featuredName);
  const pcoName = normalizeFeaturedEventName(planningCenterName);
  const aliases = {
    "csm summer games": ["csm wednesday nights"],
  };
  return Array.isArray(aliases[websiteName]) &&
    aliases[websiteName].includes(pcoName);
}

/**
 * Converts matching public Featured Events into temporary grounded entries.
 * Website descriptions are supplemental; Planning Center remains required for
 * schedule and location details.
 *
 * @param {Object} featuredResult Sanitized Featured Events provider result.
 * @param {string} question Current question plus safe follow-up context.
 * @return {Array<Object>} Matching temporary knowledge entries.
 */
export function buildWayfinderFeaturedEventEntries(
    featuredResult, question,
) {
  if (!featuredResult || featuredResult.status !== "ok" ||
    !Array.isArray(featuredResult.events)) return [];
  const queryTokens = new Set(normalizeFeaturedEventName(question)
      .split(/\s+/).filter((token) => token.length > 2));
  if (!queryTokens.size) return [];

  return featuredResult.events.map((event) => {
    const name = cleanText_(event && event.name, 160);
    const normalizedName = normalizeFeaturedEventName(name);
    const nameTokens = normalizedName.split(/\s+/)
        .filter((token) => token.length > 2 && !/^\d+$/.test(token));
    const score = nameTokens.reduce((total, token) => {
      return total + (queryTokens.has(token) ? 1 : 0);
    }, 0);
    return {event, name, normalizedName, score};
  }).filter((item) => item.name && item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((item) => {
        const description = cleanText_(item.event.description, 900);
        return {
          id: "featured-event-" + item.normalizedName.replace(/\s+/g, "-"),
          topic: "live_events",
          title: item.name,
          responseMode: "guided",
          requiredSourceType: "planning_center_event",
          requiredFacts: description ? [
            "Public Featured Event description: " + description,
          ] : [
            item.name + " is currently listed as a Featured Event on " +
              "CrossPointe's website.",
          ],
          requiredActions: [
            "Use this website description as supplemental event context.",
            "Use Planning Center for dates, times, locations, and the main " +
              "event link.",
          ],
          prohibitedClaims: [
            "Do not use the website description to invent or override a " +
              "date, time, location, registration detail, or cancellation.",
          ],
          approvedLinks: item.event.url ? [{
            label: item.name,
            url: item.event.url,
          }] : [],
          sourceType: "website_featured_event",
        };
      });
}

function cleanText_(value, maxLength) {
  return String(value || "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function codedError_(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
