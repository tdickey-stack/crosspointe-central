import {
  createWayfinderPlanningCenterRetriever,
  WAYFINDER_PCO_SOURCE_TYPES,
} from "../wayfinder/planning-center.js";
import {createWayfinderFeaturedEventProvider} from
  "../wayfinder/featured-events.js";

const appId = String(process.env.PCO_APP_ID || "").trim();
const secret = String(process.env.PCO_SECRET || "").trim();

if (!appId || !secret) {
  throw new Error("PCO_APP_ID and PCO_SECRET are required.");
}

const authorization = "Basic " + Buffer.from(appId + ":" + secret)
    .toString("base64");
const retriever = createWayfinderPlanningCenterRetriever({
  timezone: process.env.PCO_TIMEZONE || "America/Chicago",
  centralTagName: process.env.PCO_CENTRAL_TAG_NAME || "Central",
  priorityTagName:
    process.env.PCO_WAYFINDER_PRIORITY_TAG_NAME || "Wayfinder Priority",
  getFeaturedEvents: createWayfinderFeaturedEventProvider(),
  fetchJson: async (url) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authorization,
        "Accept": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Planning Center returned HTTP " + response.status + ".");
    }
    return response.json();
  },
});

const [events, groups] = await Promise.all([
  retriever({
    question: "What events are coming up?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.events],
  }),
  retriever({
    question: "What Pointe Groups are available?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.groups],
  }),
]);

console.log(JSON.stringify({
  eventStatus: events.statuses[WAYFINDER_PCO_SOURCE_TYPES.events],
  eventResults: events.entries.map((entry) => ({
    title: entry.title,
    facts: entry.requiredFacts,
  })),
  groupStatus: groups.statuses[WAYFINDER_PCO_SOURCE_TYPES.groups],
  groupTitles: groups.entries.map((entry) => entry.title),
}, null, 2));
