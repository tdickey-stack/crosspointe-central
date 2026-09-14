import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import {parseEventDescription} from "../functions/planning-center/event-description.js";
import {applyEventOverrides} from "../functions/event-overrides.js";

// Exercise the real Calendar assembly/projection functions without Firebase or
// Planning Center network access. Calendar export encoding is also kept real.
const source = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const context = vm.createContext({
  Date, Buffer, URLSearchParams, parseEventDescription, applyEventOverrides,
  PCO_TIMEZONE: "America/Chicago",
  getEventInstanceRawRooms_: async () => ["Lobby"],
  getEventInstanceSchedule_: async () => ({}),
  applyRoomRules_: (rooms) => rooms,
  splitPlanningCenterLocation_: () => ({venue: "CrossPointe", address: ""}),
  formatTime_: () => "6 PM",
  formatDate_: () => "October 28, 2026",
  formatTimeRange_: () => "6–8 PM",
  findDoorsOpenTimeInText: () => "",
  signCalendarEventToken_: () => "test-signature",
});
for (const name of [
  "buildCentralCalendarItem_", "cleanLocation_", "toTodayItem_", "toUpcomingItem_",
  "applyCachedCalendarItemPresentation_", "stripCalendarSourceFields_",
  "buildGoogleCalendarUrl_", "formatGoogleCalendarDate_", "buildCalendarFileUrl_",
]) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  assert.notEqual(start, -1, `Missing production function ${name}`);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  vm.runInContext(next < 0 ? rest : rest.slice(0, next + 1), context);
}
const url = "https://crosspointetv.churchcenter.com/people/forms/1309469";
const attrs = {
  description: `<p><strong>Welcome families</strong> this October.</p><p><a href="${url}">Register your booth</a></p><p>{button_text:'Register Your Booth'|button_link:'<a href="${url}">${url}</a>'}</p>`,
  registration_url: "https://example.com/default",
};
const instance = {
  id: "occurrence-1",
  attributes: {name: "Trunk or Treat", starts_at: "2026-10-28T23:00:00Z", ends_at: "2026-10-29T01:00:00Z"},
  relationships: {event: {data: {id: "event-1"}}},
};
const override = [{scope: "instance", planning_center_instance_id: instance.id, overridden_fields: ["description"], description: "A local plain-text update."}];
const build = (overrides = [], eventAttrs = attrs) => context.buildCentralCalendarItem_(instance, eventAttrs, [], true, overrides);
function assertCleanExports(item) {
  const googleCopy = new URL(item.calendar_url).searchParams.get("details");
  const token = new URL(item.calendar_file_url, "https://central.example").searchParams.get("event");
  const icsCopy = JSON.parse(Buffer.from(token, "base64url").toString()).d;
  for (const copy of [item.description, item.planning_center_description, googleCopy, icsCopy]) {
    assert.doesNotMatch(copy, /button_text|button_link|<\/?(?:p|strong|a)\b/);
  }
  assert.equal(googleCopy, item.description);
  assert.equal(icsCopy, item.description);
}

test("Calendar rich text and CTA survive both public projections and cache presentation", async () => {
  const sourceItem = await build();
  assert.equal(sourceItem.registration_url, url);
  assert.equal(sourceItem.registration_button_text, "Register Your Booth");
  for (const project of [context.toTodayItem_, context.toUpcomingItem_]) {
    const cached = project(sourceItem);
    const item = context.applyCachedCalendarItemPresentation_(cached, [], []);
    assert.match(item.description_html, /<strong>Welcome families<\/strong>/);
    assert.match(item.description_html, /href="https:\/\/crosspointetv/);
    assert.doesNotMatch(item.description_html, /button_text|button_link/);
    assert.equal(item.registration_url, url);
    assert.equal(item.registration_button_text, "Register Your Booth");
    assert.equal(item.cta_warning, "");
    assert.equal(item._planningCenterStartsAt, undefined);
    assertCleanExports(item);
  }
});

test("description override clears rich text and reset restores cached Planning Center formatting", async () => {
  const original = await build();
  const directlyOverridden = await build(override);
  assert.equal(directlyOverridden.description_html, "");
  assert.equal(directlyOverridden.description, override[0].description);
  assertCleanExports(directlyOverridden);
  for (const project of [context.toTodayItem_, context.toUpcomingItem_]) {
    const cached = project(original);
    const overridden = context.applyCachedCalendarItemPresentation_(cached, [], override);
    assert.equal(overridden.description_html, "");
    assert.equal(overridden.description, override[0].description);
    assert.equal(overridden.registration_url, url);
    assertCleanExports(overridden);
    const reset = context.applyCachedCalendarItemPresentation_(cached, [], []);
    assert.equal(reset.description_html, original.description_html);
    assert.equal(reset.description, original.description);
    assertCleanExports(reset);
  }
});

test("malformed marker is removed and warning survives projection with Calendar URL fallback", async () => {
  const original = await build([], {...attrs, description: '<p>Welcome</p><p>{button_text:"Host a booth"}</p>'});
  for (const project of [context.toTodayItem_, context.toUpcomingItem_]) {
    const item = context.applyCachedCalendarItemPresentation_(project(original), [], []);
    assert.ok(item.cta_warning);
    assert.equal(item.registration_button_text, "");
    assert.equal(item.registration_url, attrs.registration_url);
    assertCleanExports(item);
  }
});
