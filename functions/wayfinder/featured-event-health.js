import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {
  isApprovedFeaturedEventAlias,
  normalizeFeaturedEventName,
} from "./featured-events.js";

const API_ORIGIN = "https://api.planningcenteronline.com";
const LOOKAHEAD_DAYS = 183;
const MAX_API_PAGES = 5;

export function createWayfinderFeaturedEventHealthHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      await authenticateWayfinderAdminRequest({
        request,
        admin: dependencies.admin,
        firestore: dependencies.firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      const action = String(request.body && request.body.action || "check")
          .trim().toLowerCase();
      if (action !== "check") {
        throw createWayfinderAccessError(
            400, "Choose check for Featured Event health.",
        );
      }
      response.status(200).json(await getWayfinderFeaturedEventHealth({
        getFeaturedEvents: dependencies.getFeaturedEvents,
        fetchJson: dependencies.fetchJson,
        timezone: dependencies.timezone || "America/Chicago",
        now: dependencies.now,
      }));
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      if (!error || !error.statusCode) {
        console.error("Wayfinder Featured Event health check failed.", {
          code: String(error && error.code || "featured_event_health_error"),
          name: String(error && error.name || "Error"),
        });
      }
      response.status(status).json({
        error: error && error.statusCode ? String(error.message) :
          "Featured Event health is unavailable right now.",
      });
    }
  };
}

export async function getWayfinderFeaturedEventHealth(options) {
  const current = typeof options.now === "function" ?
    options.now() : new Date();
  const featured = await options.getFeaturedEvents({forceRefresh: true});
  if (!featured || featured.status !== "ok") {
    return buildHealthResult_(current, featured, "unavailable", []);
  }

  let pcoEvents = [];
  let pcoStatus = "ok";
  try {
    pcoEvents = await fetchPlanningCenterEvents_(
        options.fetchJson, current,
    );
  } catch (error) {
    pcoStatus = "unavailable";
  }
  return buildHealthResult_(current, featured, pcoStatus, pcoEvents,
      options.timezone || "America/Chicago");
}

function buildHealthResult_(current, featured, pcoStatus, pcoEvents,
    timezone = "America/Chicago") {
  const featuredEvents = featured && Array.isArray(featured.events) ?
    featured.events : [];
  const events = featuredEvents.map((item) => {
    const match = pcoStatus === "ok" ?
      findBestPlanningCenterMatch_(item, pcoEvents, timezone) : null;
    const websiteName = cleanText_(item.name, 160);
    const planningCenterName = match ? cleanText_(match.name, 160) : "";
    const nameDiffers = Boolean(match) &&
      normalizeFeaturedEventName(websiteName) !==
        normalizeFeaturedEventName(planningCenterName);
    return {
      websiteName,
      websiteUrl: approvedWebsiteUrl_(item.url),
      websiteStartsAt: validIso_(item.startsAt),
      status: match ? "matched" :
        pcoStatus === "ok" ? "unmatched" : "unverified",
      nameDiffers,
      planningCenterName,
      planningCenterStartsAt: match ? match.startsAt.toISOString() : "",
      planningCenterUrl: match ? match.url : "",
    };
  });
  return {
    ok: true,
    status: featured && featured.status === "ok" && pcoStatus === "ok" ?
      "ready" : "unavailable",
    websiteStatus: featured && featured.status || "unavailable",
    planningCenterStatus: pcoStatus,
    checkedAt: current.toISOString(),
    websiteFetchedAt: validIso_(featured && featured.fetchedAt),
    featuredCount: events.length,
    matchedCount: events.filter((item) => item.status === "matched").length,
    nameDifferenceCount: events.filter((item) => item.nameDiffers).length,
    unmatchedCount: events.filter((item) => item.status === "unmatched").length,
    events,
  };
}

async function fetchPlanningCenterEvents_(fetchJson, current) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("Featured Event health requires Planning Center.");
  }
  const end = new Date(current.getTime() + LOOKAHEAD_DAYS * 86400000);
  const url = new URL("/calendar/v2/event_instances", API_ORIGIN);
  url.searchParams.set("order", "starts_at");
  url.searchParams.set("where[starts_at][gte]", current.toISOString());
  url.searchParams.set("where[starts_at][lte]", end.toISOString());
  url.searchParams.set("per_page", "100");

  const rows = [];
  let nextUrl = url.toString();
  for (let page = 0; nextUrl && page < MAX_API_PAGES; page += 1) {
    assertApprovedApiUrl_(nextUrl);
    const payload = await fetchJson(nextUrl);
    rows.push(...(Array.isArray(payload && payload.data) ? payload.data : []));
    nextUrl = payload && payload.links ? payload.links.next : "";
  }
  return rows.map(normalizePlanningCenterEvent_).filter(Boolean);
}

function normalizePlanningCenterEvent_(item) {
  const attributes = item && item.attributes || {};
  const startsAt = new Date(
      attributes.published_starts_at || attributes.starts_at || "",
  );
  const name = cleanText_(attributes.name, 160);
  if (!item || !item.id || !name || Number.isNaN(startsAt.getTime())) {
    return null;
  }
  return {
    name,
    startsAt,
    url: approvedPlanningCenterUrl_(attributes.church_center_url),
  };
}

function findBestPlanningCenterMatch_(featured, events, timezone) {
  const featuredName = normalizeFeaturedEventName(featured && featured.name);
  const featuredDate = new Date(String(featured && featured.startsAt || ""));
  const featuredDateKey = Number.isNaN(featuredDate.getTime()) ? "" :
    localDateKey_(featuredDate, timezone);
  const featuredTokens = identityTokens_(featuredName);
  return events.map((event) => {
    const eventName = normalizeFeaturedEventName(event.name);
    const sameName = eventName === featuredName;
    const sameDate = featuredDateKey &&
      localDateKey_(event.startsAt, timezone) === featuredDateKey;
    const eventTokens = identityTokens_(eventName);
    const sharedIdentity = [...featuredTokens]
        .some((token) => eventTokens.has(token));
    const approvedAlias = isApprovedFeaturedEventAlias(
        featured && featured.name, event.name,
    );
    return {
      event,
      score: sameName && sameDate ? 100 :
        approvedAlias ? 90 : sameDate && sharedIdentity ? 80 :
          sameName ? 60 : 0,
      distance: Number.isNaN(featuredDate.getTime()) ? Number.MAX_SAFE_INTEGER :
        Math.abs(event.startsAt.getTime() - featuredDate.getTime()),
    };
  }).filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.distance - b.distance)
      .map((item) => item.event)[0] || null;
}

function identityTokens_(value) {
  const ignored = new Set([
    "event", "ministry", "night", "pointe", "the", "crosspointe",
  ]);
  return new Set(String(value || "").split(/\s+/)
      .filter((token) => token.length >= 3 && !ignored.has(token)));
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

function assertApprovedApiUrl_(value) {
  const url = new URL(String(value || ""));
  if (url.origin !== API_ORIGIN ||
    url.pathname !== "/calendar/v2/event_instances") {
    const error = new Error("Unapproved Planning Center health-check path.");
    error.code = "wayfinder-featured-health-path-denied";
    throw error;
  }
}

function approvedWebsiteUrl_(value) {
  return approvedUrl_(value, ["www.crosspointe.tv"], "/event/");
}

function approvedPlanningCenterUrl_(value) {
  return approvedUrl_(value, ["crosspointetv.churchcenter.com"], "/calendar/");
}

function approvedUrl_(value, hosts, pathPrefix) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && hosts.includes(url.hostname) &&
      url.pathname.startsWith(pathPrefix) ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function validIso_(value) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanText_(value, maxLength) {
  return String(value || "").replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, maxLength);
}
