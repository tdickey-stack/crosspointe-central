import assert from "node:assert/strict";
import test from "node:test";

import {
  createWayfinderPlanningCenterRetriever,
  WAYFINDER_PCO_SOURCE_TYPES,
} from "./planning-center.js";

const NOW = new Date("2026-07-11T15:00:00.000Z");

test("returns future Central-tagged events with priority first", async () => {
  const requestedUrls = [];
  const retriever = createWayfinderPlanningCenterRetriever({
    now: () => NOW,
    fetchJson: async (url) => {
      requestedUrls.push(url);
      return {
        data: [
          event_(
              "1", "Community Lunch", "2026-07-13T17:00:00Z", ["central"],
          ),
          event_(
              "2", "Starting Pointe", "2026-07-14T23:00:00Z",
              ["central", "priority"],
          ),
          event_(
              "3", "Private Staff Meeting", "2026-07-12T18:00:00Z",
              ["private"],
          ),
          event_(
              "4", "Already Started", "2026-07-11T14:00:00Z", ["central"],
          ),
          event_(
              "5", "CSM Wednesday Nights", "2026-07-15T23:30:00Z",
              ["central"],
          ),
        ],
        included: [
          tag_("central", "Central"),
          tag_("priority", "Wayfinder Priority"),
          tag_("private", "Staff"),
        ],
        links: {next: null},
      };
    },
    resolveEventRooms: async (id) => id === "2" ? ["Event Hall"] : [],
  });

  const result = await retriever({
    question: "What events are coming up?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.events],
  });

  assert.equal(result.statuses.planning_center_event, "ok");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].title, "Starting Pointe");
  assert.match(result.entries[0].requiredFacts.join(" "), /Event Hall/);
  assert.equal(
      result.entries.some((entry) => /Private/.test(entry.title)),
      false,
  );
  assert.match(requestedUrls[0], /where%5Bstarts_at%5D%5Blte%5D/);
});

test("uses a six-month window for a named event search", async () => {
  let requestedUrl = "";
  const retriever = createWayfinderPlanningCenterRetriever({
    now: () => NOW,
    fetchJson: async (url) => {
      requestedUrl = url;
      return {
        data: [event_(
            "9", "Starting Pointe", "2026-11-01T18:00:00Z", ["central"],
        )],
        included: [tag_("central", "Central")],
        links: {next: null},
      };
    },
  });

  const result = await retriever({
    question: "When is Starting Pointe?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.events],
  });

  assert.equal(result.entries[0].title, "Starting Pointe");
  const end = new URL(requestedUrl).searchParams.get("where[starts_at][lte]");
  assert.ok(new Date(end).getTime() - NOW.getTime() > 180 * 86400000);
});

test("returns only sanitized published group fields", async () => {
  const retriever = createWayfinderPlanningCenterRetriever({
    now: () => NOW,
    fetchJson: async () => ({
      data: [{
        type: "Group",
        id: "44",
        attributes: {
          name: "Young Adults",
          description_as_plain_text: "A group for young adults.",
          schedule: "Tuesdays at 7:00 PM",
          listed: true,
          archived_at: null,
          public_church_center_web_url:
            "https://crosspointetv.churchcenter.com/groups/" +
            "pointe-groups/young-adults",
          contact_email: "private-leader@example.com",
        },
        relationships: {
          group_type: {data: {type: "GroupType", id: "type-1"}},
          tags: {data: [{type: "Tag", id: "tag-1"}]},
          enrollment: {data: {type: "Enrollment", id: "enroll-1"}},
          location: {data: {type: "Location", id: "private-location"}},
        },
      }],
      included: [
        {
          type: "GroupType",
          id: "type-1",
          attributes: {name: "Pointe Groups", church_center_visible: true},
        },
        tag_("tag-1", "Young Adult"),
        {
          type: "Enrollment",
          id: "enroll-1",
          attributes: {status: "open", strategy: "request_to_join"},
        },
      ],
      links: {next: null},
    }),
  });

  const result = await retriever({
    question: "Are there any young adult Pointe Groups?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.groups],
  });
  const serialized = JSON.stringify(result.entries);

  assert.equal(result.statuses.planning_center_groups, "ok");
  assert.equal(result.entries[0].title, "Young Adults");
  assert.match(serialized, /Tuesdays at 7:00 PM/);
  assert.match(serialized, /request to join/);
  assert.doesNotMatch(serialized, /private-leader@example.com/);
  assert.doesNotMatch(serialized, /private-location/);
});

test("refuses pagination outside approved API paths", async () => {
  const retriever = createWayfinderPlanningCenterRetriever({
    fetchJson: async () => ({
      data: [],
      included: [],
      links: {next: "https://api.planningcenteronline.com/people/v2/people"},
    }),
  });

  const result = await retriever({
    question: "What Pointe Groups are available?",
    sourceTypes: [WAYFINDER_PCO_SOURCE_TYPES.groups],
  });

  assert.equal(result.statuses.planning_center_groups, "unavailable");
  assert.deepEqual(result.entries, []);
});

function event_(id, name, startsAt, tagIds) {
  return {
    type: "EventInstance",
    id,
    attributes: {
      name,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
      recurrence_description: "",
      location: "CrossPointe Church",
      church_center_url: "https://crosspointetv.churchcenter.com/calendar/event/" + id,
    },
    relationships: {
      tags: {data: tagIds.map((tagId) => ({type: "Tag", id: tagId}))},
    },
  };
}

function tag_(id, name) {
  return {type: "Tag", id, attributes: {name}};
}
