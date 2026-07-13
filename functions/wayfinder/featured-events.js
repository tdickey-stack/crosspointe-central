const EVENTS_PAGE_URL = "https://www.crosspointe.tv/events";
const EVENTS_API_URL = "https://api.thechurchco.com/v1/event";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_FEATURED_EVENTS = 50;

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

  return async () => {
    const current = now();
    if (cache && current.getTime() - cache.cachedAt < cacheTtlMs) {
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
  return {status: "ok", events};
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
    url: "https://www.crosspointe.tv/event/" + slug,
  };
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

function cleanText_(value, maxLength) {
  return String(value || "").replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function codedError_(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
