/* eslint-disable require-jsdoc */

import {buildCalendarSourceCacheId} from "../calendar-source-cache.js";

export const CENTRAL_EMBEDS_LOOKAHEAD_DAYS = 60;

export function createCentralEmbedsPlanningCenterService(options) {
  const baseService = options.baseService;
  const calendarDocRef = options.firestore.doc(
      "centralCache/planningCenter/calendar/" +
      buildCalendarSourceCacheId(CENTRAL_EMBEDS_LOOKAHEAD_DAYS),
  );

  async function loadCalendar_(roomRules, eventOverrides, forceRefresh) {
    const events = await options.getCentralCalendarEvents(
        Array.isArray(roomRules) ? roomRules : [],
        CENTRAL_EMBEDS_LOOKAHEAD_DAYS,
        {forceRefresh: forceRefresh === true},
        Array.isArray(eventOverrides) ? eventOverrides : [],
    );
    const snapshot = await calendarDocRef.get();
    const entry = snapshot.exists ? snapshot.data() || {} : {};

    return {
      data: {events, featuredEvent: null},
      status: forceRefresh ? "refreshed" : "calendar-cache",
      fetchedAtMs: Number(entry.fetchedAtMs) || 0,
    };
  }

  async function getCached(roomRules, config, eventOverrides) {
    try {
      return await loadCalendar_(roomRules, eventOverrides, false);
    } catch (error) {
      console.warn(
          "Central Embeds 60-day calendar load failed; using fallback.",
          error,
      );
      return baseService.getCached(roomRules, config, eventOverrides);
    }
  }

  async function refresh(roomRules, eventOverrides) {
    return loadCalendar_(roomRules, eventOverrides, true);
  }

  return {
    getCached,
    refresh,
  };
}
