import test from "node:test";
import assert from "node:assert/strict";
import {
  applyEventOverrides,
  buildEventOverrideId,
  validateEventOverrideItem,
} from "./event-overrides.js";

test("series override changes presentation fields but not schedule fields", () => {
  const source = {
    title: "Converge Music Camp",
    location: "Worship Center, Great Hall",
    description: "Planning Center description",
    date: "Jul 29, 2026",
    time: "12:00 PM - 11:30 PM",
  };
  const result = applyEventOverrides(source, [{
    scope: "series",
    planning_center_event_id: "event-1",
    planning_center_instance_id: "instance-1",
    overridden_fields: ["location"],
    location: "CrossPointe Church",
  }], {
    planning_center_event_id: "event-1",
    planning_center_instance_id: "instance-2",
  });

  assert.equal(result.location, "CrossPointe Church");
  assert.equal(result.title, source.title);
  assert.equal(result.date, undefined);
  assert.deepEqual(result.overridden_fields, ["location"]);
});

test("instance fields take precedence over a series override", () => {
  const result = applyEventOverrides({
    title: "Original",
    location: "Original room",
    description: "Original description",
  }, [{
    scope: "series",
    planning_center_event_id: "event-1",
    overridden_fields: ["title", "location"],
    title: "Series title",
    location: "Series room",
  }, {
    scope: "instance",
    planning_center_event_id: "event-1",
    planning_center_instance_id: "instance-1",
    overridden_fields: ["location", "description"],
    location: "Occurrence room",
    description: "",
  }], {
    planning_center_event_id: "event-1",
    planning_center_instance_id: "instance-1",
  });

  assert.equal(result.title, "Series title");
  assert.equal(result.location, "Occurrence room");
  assert.equal(result.description, "");
  assert.equal(result.override_scope, "instance");
});

test("event override IDs are stable and validation rejects blank names", () => {
  const first = buildEventOverrideId({
    scope: "instance",
    planning_center_instance_id: "123",
  });
  const second = buildEventOverrideId({
    scope: "instance",
    planning_center_instance_id: "123",
  });
  assert.equal(first, second);
  assert.throws(() => validateEventOverrideItem({
    scope: "instance",
    planning_center_instance_id: "123",
    overridden_fields: ["title"],
    title: "",
  }), /cannot be empty/i);
});
