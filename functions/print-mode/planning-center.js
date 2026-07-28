import {getSharedCachedValue} from
  "../planning-center/shared-cache.js";

const PRINT_MODE_PCO_CACHE_COLLECTION_PATH =
  "centralCache/planningCenter/bulletin";
const PRINT_MODE_PLANNING_CENTER_CACHE_TTL_MS = 60 * 1000;

export function createPrintModePlanningCenterService(options) {
  const firestore = options.firestore;
  const getCentralCalendarEvents = options.getCentralCalendarEvents;
  const getCentralFeaturedEvent = options.getCentralFeaturedEvent;
  const createRoomRulesComparisonHash =
    options.createRoomRulesComparisonHash;
  const isValidCalendarEventsValue = options.isValidCalendarEventsValue;
  const dateKey = options.dateKey;
  const timezone = options.timezone;
  const cacheRefreshLeaseMs = options.cacheRefreshLeaseMs;
  const cacheWaitMs = options.cacheWaitMs;

  function getCacheContext_(roomRules) {
    const normalizedRoomRules = Array.isArray(roomRules) ? roomRules : [];
    const roomRulesHash =
      createRoomRulesComparisonHash(normalizedRoomRules);
    const cacheId = "v1-" + roomRulesHash.slice(0, 40);

    return {
      roomRulesHash,
      docRef: firestore.doc(
          PRINT_MODE_PCO_CACHE_COLLECTION_PATH + "/" + cacheId,
      ),
    };
  }

  async function getCachedCalendarEvents_(roomRules, lookaheadDays) {
    const parsedLookaheadDays = Number(lookaheadDays);
    const normalizedLookaheadDays = Number.isFinite(parsedLookaheadDays) &&
      parsedLookaheadDays > 0 ?
      Math.min(90, Math.max(1, Math.floor(parsedLookaheadDays))) :
      14;
    const normalizedRoomRules = Array.isArray(roomRules) ? roomRules : [];
    const roomRulesHash =
      createRoomRulesComparisonHash(normalizedRoomRules);
    const cacheId = [
      "v1",
      normalizedLookaheadDays,
      roomRulesHash.slice(0, 32),
    ].join("-");
    const snapshot = await firestore.doc(
        "centralCache/planningCenter/calendar/" + cacheId,
    ).get();
    const entry = snapshot.exists ? snapshot.data() || {} : {};

    if (!isValidCalendarEventsValue(entry.value)) {
      return null;
    }

    return {
      events: entry.value,
      fetchedAtMs: Number(entry.fetchedAtMs) || 0,
    };
  }

  async function getCached(roomRules, config) {
    const cacheContext = getCacheContext_(roomRules);
    const snapshot = await cacheContext.docRef.get();
    const entry = snapshot.exists ? snapshot.data() || {} : {};
    if (isValidPrintModePlanningCenterData_(entry.value)) {
      return {
        data: entry.value,
        status: "cached",
        fetchedAtMs: Number(entry.fetchedAtMs) || 0,
      };
    }

    const calendarCache = await getCachedCalendarEvents_(roomRules, 21);
    if (calendarCache) {
      return {
        data: {
          events: calendarCache.events,
          featuredEvent: findCachedFeaturedEvent_(
              calendarCache.events,
              config && config.featuredEvent,
          ),
        },
        status: "calendar-cache",
        fetchedAtMs: calendarCache.fetchedAtMs,
      };
    }

    return {
      data: createEmptyPlanningCenterData_(),
      status: "empty",
      fetchedAtMs: 0,
    };
  }

  async function refresh(roomRules) {
    const cacheContext = getCacheContext_(roomRules);
    const cachedResult = await getSharedCachedValue({
      firestore,
      docRef: cacheContext.docRef,
      ttlMs: PRINT_MODE_PLANNING_CENTER_CACHE_TTL_MS,
      leaseMs: cacheRefreshLeaseMs,
      waitForRefreshMs: cacheWaitMs,
      validateValue: isValidPrintModePlanningCenterData_,
      metadata: {
        cacheType: "planning-center-bulletin",
        dateKey: dateKey(new Date(), timezone),
        roomRulesHash: cacheContext.roomRulesHash,
      },
      loadFresh: async () => {
        const results = await Promise.allSettled([
          getCentralCalendarEvents(roomRules, 21, {forceRefresh: true}),
          getCentralFeaturedEvent(roomRules),
        ]);

        if (results[0].status === "rejected") {
          console.error(
              "Bulletin Mode calendar sync failed.",
              results[0].reason,
          );
          throw results[0].reason;
        }
        if (results[1].status === "rejected") {
          console.error(
              "Bulletin Mode featured event sync failed.",
              results[1].reason,
          );
          throw results[1].reason;
        }

        return {
          events: results[0].value,
          featuredEvent: results[1].value,
        };
      },
      onError: (phase, error) => {
        console.warn(
            "Bulletin Mode shared snapshot " + phase + " failed.",
            error,
        );
      },
    });

    return {
      data: cachedResult.value,
      status: cachedResult.status,
      fetchedAtMs: cachedResult.fetchedAtMs,
    };
  }

  return {
    getCached,
    refresh,
  };

  function isValidPrintModePlanningCenterData_(value) {
    return !!value &&
      isValidCalendarEventsValue(value.events) &&
      (value.featuredEvent === null ||
        typeof value.featuredEvent === "object");
  }
}

function findCachedFeaturedEvent_(events, savedFeaturedEvent) {
  const featuredId = String(savedFeaturedEvent && savedFeaturedEvent.id || "");
  if (!featuredId) return null;

  return (Array.isArray(events && events.today) ? events.today : [])
      .concat(Array.isArray(events && events.upcoming) ? events.upcoming : [])
      .find((item) => String(item && item.id || "") === featuredId) || null;
}

function createEmptyPlanningCenterData_() {
  return {
    events: {today: [], upcoming: []},
    featuredEvent: null,
  };
}
