import assert from "node:assert/strict";
import test from "node:test";

import {
  findDoorsOpenTimeInText,
  findPlanningCenterTagId,
  getCentralFeaturedEventCandidates,
  getPlanningCenterEventSchedule,
} from "./featured-event.js";

test("finds the configured Planning Center tag exactly", () => {
  const payload = {
    data: [
      {type: "Tag", id: "1", attributes: {name: "Central"}},
      {type: "Tag", id: "2", attributes: {name: "Central Featured"}},
    ],
  };

  assert.equal(findPlanningCenterTagId(payload, "Central Featured"), "2");
  assert.equal(findPlanningCenterTagId(payload, "central featured"), "");
});

test("separates Doors Open from the main event time", () => {
  const payload = {
    data: [
      {
        type: "EventTime",
        id: "setup",
        attributes: {
          name: "Setup",
          starts_at: "2026-07-27T21:00:00Z",
          ends_at: "2026-07-27T22:30:00Z",
          visible_on_widget_and_ical: false,
        },
      },
      {
        type: "EventTime",
        id: "doors",
        attributes: {
          name: "Doors Open",
          starts_at: "2026-07-27T22:30:00Z",
          ends_at: "2026-07-27T23:30:00Z",
          visible_on_widget_and_ical: true,
        },
      },
      {
        type: "EventTime",
        id: "event",
        attributes: {
          name: "Imani Milele Worship Night",
          starts_at: "2026-07-27T23:30:00Z",
          ends_at: "2026-07-28T01:00:00Z",
          visible_on_widget_and_ical: true,
        },
      },
    ],
  };

  assert.deepEqual(getPlanningCenterEventSchedule(payload, {
    eventTitle: "Imani Milele Worship Night",
  }), {
    doorsOpenStartsAt: "2026-07-27T22:30:00Z",
    eventStartsAt: "2026-07-27T23:30:00Z",
    eventEndsAt: "2026-07-28T01:00:00Z",
  });
});

test("prefers the reusable Event Time name", () => {
  const payload = {
    data: [
      eventTime_("doors", "Doors Open", "2026-09-02T23:00:00Z"),
      eventTime_("legacy", "Legacy Event", "2026-09-02T23:15:00Z"),
      eventTime_("main", "Event Time", "2026-09-02T23:30:00Z"),
    ],
  };

  assert.deepEqual(getPlanningCenterEventSchedule(payload, {
    eventTitle: "Legacy Event",
  }), {
    doorsOpenStartsAt: "2026-09-02T23:00:00.000Z",
    eventStartsAt: "2026-09-02T23:30:00.000Z",
    eventEndsAt: "2026-09-03T00:30:00.000Z",
  });
});

test("finds an explicit Doors Open time in public event copy", () => {
  assert.equal(
      findDoorsOpenTimeInText(
          "Doors open at 5:30 PM. A love offering will be received.",
      ),
      "5:30 PM",
  );
  assert.equal(findDoorsOpenTimeInText("Doors Open: 6pm"), "6:00 PM");
  assert.equal(findDoorsOpenTimeInText("The event begins at 6:30 PM."), "");
  assert.equal(findDoorsOpenTimeInText("Doors open soon."), "");
});

test("requires Central and Central Featured and sorts the next instance first",
    () => {
      const payload = {
        included: [
          {type: "Tag", id: "central", attributes: {name: "Central"}},
          {
            type: "Tag",
            id: "featured",
            attributes: {name: "Central Featured"},
          },
          {
            type: "Event",
            id: "event-later",
            attributes: {image_url: "https://example.com/later.jpg"},
          },
          {
            type: "Event",
            id: "event-next",
            attributes: {image_url: "https://example.com/next.jpg"},
          },
        ],
        data: [
          instance_("later", "event-later", "2026-09-10T23:30:00Z", [
            "central", "featured",
          ]),
          instance_("not-public", "event-next", "2026-08-01T23:30:00Z", [
            "featured",
          ]),
          instance_("next", "event-next", "2026-09-02T23:30:00Z", [
            "central", "featured",
          ]),
        ],
      };

      const candidates = getCentralFeaturedEventCandidates(payload);

      assert.deepEqual(candidates.map((item) => item.instance.id), [
        "next", "later",
      ]);
      assert.equal(
          candidates[0].eventAttributes.image_url,
          "https://example.com/next.jpg",
      );
    });

/**
 * Creates a minimal Planning Center event-instance fixture.
 *
 * @param {string} id Instance ID.
 * @param {string} eventId Parent event ID.
 * @param {string} startsAt ISO start time.
 * @param {Array<string>} tagIds Related tag IDs.
 * @return {Object} Event-instance fixture.
 */
function instance_(id, eventId, startsAt, tagIds) {
  return {
    type: "EventInstance",
    id,
    attributes: {
      name: "Featured Event " + id,
      starts_at: startsAt,
    },
    relationships: {
      event: {data: {type: "Event", id: eventId}},
      tags: {
        data: tagIds.map((tagId) => ({type: "Tag", id: tagId})),
      },
    },
  };
}

/**
 * Creates a public Planning Center event-time fixture.
 *
 * @param {string} id Event-time ID.
 * @param {string} name Event-time name.
 * @param {string} startsAt ISO start time.
 * @return {Object} Event-time fixture.
 */
function eventTime_(id, name, startsAt) {
  const startsDate = new Date(startsAt);
  const endsDate = new Date(startsDate.getTime() + 60 * 60 * 1000);

  return {
    type: "EventTime",
    id,
    attributes: {
      name,
      starts_at: startsDate.toISOString(),
      ends_at: endsDate.toISOString(),
      visible_on_widget_and_ical: true,
    },
  };
}
