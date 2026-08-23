import {getSharedCachedValue} from
  "../planning-center/shared-cache.js";
import {buildCalendarSourceCacheId} from
  "../calendar-source-cache.js";

const PRINT_MODE_PCO_CACHE_COLLECTION_PATH =
  "centralCache/planningCenter/bulletin";
const PRINT_MODE_PLANNING_CENTER_CACHE_TTL_MS = 60 * 1000;
const PRINT_MODE_EVENT_LOOKAHEAD_DAYS = 35;

export function createPrintModePlanningCenterService(options) {
  const firestore = options.firestore;
  const getCentralCalendarEvents = options.getCentralCalendarEvents;
  const getCentralFeaturedEvent = options.getCentralFeaturedEvent;
  const createRoomRulesComparisonHash =
    options.createRoomRulesComparisonHash;
  const createEventOverridesHash =
    typeof options.createEventOverridesHash === "function" ?
      options.createEventOverridesHash :
      () => "none";
  const isValidCalendarEventsValue = options.isValidCalendarEventsValue;
  const applyCalendarPresentation =
    typeof options.applyCalendarPresentation === "function" ?
      options.applyCalendarPresentation :
      (events) => events;
  const dateKey = options.dateKey;
  const timezone = options.timezone;
  const cacheRefreshLeaseMs = options.cacheRefreshLeaseMs;
  const cacheWaitMs = options.cacheWaitMs;

  function getCacheContext_(roomRules, eventOverrides) {
    const normalizedRoomRules = Array.isArray(roomRules) ? roomRules : [];
    const normalizedEventOverrides = Array.isArray(eventOverrides) ?
      eventOverrides : [];
    const roomRulesHash =
      createRoomRulesComparisonHash(normalizedRoomRules);
    const eventOverridesHash = createEventOverridesHash(
        normalizedEventOverrides,
    );
    const cacheId = normalizedEventOverrides.length ?
      "v2-" + roomRulesHash.slice(0, 24) + "-" +
        eventOverridesHash.slice(0, 24) :
      "v1-" + roomRulesHash.slice(0, 40);

    return {
      roomRulesHash,
      eventOverridesHash,
      docRef: firestore.doc(
          PRINT_MODE_PCO_CACHE_COLLECTION_PATH + "/" + cacheId,
      ),
    };
  }

  async function getCachedCalendarEvents_(
      roomRules,
      lookaheadDays,
      eventOverrides,
  ) {
    const parsedLookaheadDays = Number(lookaheadDays);
    const normalizedLookaheadDays = Number.isFinite(parsedLookaheadDays) &&
      parsedLookaheadDays > 0 ?
      Math.min(90, Math.max(1, Math.floor(parsedLookaheadDays))) :
      14;
    const cacheId = buildCalendarSourceCacheId(normalizedLookaheadDays);
    const snapshot = await firestore.doc(
        "centralCache/planningCenter/calendar/" + cacheId,
    ).get();
    const entry = snapshot.exists ? snapshot.data() || {} : {};

    if (!isValidCalendarEventsValue(entry.value)) {
      return null;
    }

    return {
      events: applyCalendarPresentation(
          entry.value,
          roomRules,
          eventOverrides,
      ),
      fetchedAtMs: Number(entry.fetchedAtMs) || 0,
    };
  }

  async function getCached(roomRules, config, eventOverrides) {
    const cacheContext = getCacheContext_(roomRules, eventOverrides);
    const snapshot = await cacheContext.docRef.get();
    const entry = snapshot.exists ? snapshot.data() || {} : {};
    if (isValidPrintModePlanningCenterData_(entry.value)) {
      return {
        data: entry.value,
        status: "cached",
        fetchedAtMs: Number(entry.fetchedAtMs) || 0,
      };
    }

    const calendarCache = await getCachedCalendarEvents_(
        roomRules,
        PRINT_MODE_EVENT_LOOKAHEAD_DAYS,
        eventOverrides,
    );
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

  async function refresh(roomRules, eventOverrides) {
    const cacheContext = getCacheContext_(roomRules, eventOverrides);
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
        eventOverridesHash: cacheContext.eventOverridesHash,
      },
      loadFresh: async () => {
        const results = await Promise.allSettled([
          getCentralCalendarEvents(
              roomRules,
              PRINT_MODE_EVENT_LOOKAHEAD_DAYS,
              {forceRefresh: true},
              eventOverrides,
          ),
          getCentralFeaturedEvent(roomRules, eventOverrides),
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
