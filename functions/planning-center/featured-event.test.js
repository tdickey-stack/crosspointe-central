import assert from "node:assert/strict";
import test from "node:test";

import {
  findPlanningCenterTagId,
  getCentralFeaturedEventCandidates,
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
