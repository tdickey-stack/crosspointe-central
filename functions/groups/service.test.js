/* eslint-disable require-jsdoc, max-len */
import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceFromTags, createPublicGroupsService, fetchGroupsCollection,
  locationTagsFromTags, meetingDaysFromSchedule, normalizePublicGroup,
  publicLocation,
} from "./service.js";

const group = {
  id: "1", type: "Group",
  attributes: {
    name: "Test Group", listed: true, archived_at: null,
    public_church_center_web_url:
      "https://crosspointetv.churchcenter.com/groups/campus-groups/test",
    schedule: "Meets weekly on Sundays from 9-10am", tag_ids: ["100"],
    description_as_plain_text: "A welcoming group.\n\nCome as you are.",
    location_type_preference: "physical",
    header_image: {medium:
      "https://groups-production.s3.amazonaws.com/uploads/group/header_image/1/a.jpg"},
    contact_email: "private@example.com", internal_notes: "Do not share",
    memberships_count: 42, virtual_location_url: "https://private.example/room",
  },
  relationships: {
    group_type: {data: {id: "2"}}, location: {data: {id: "3"}},
    people: {data: [{id: "secret-person"}]},
  },
};
const type = {id: "2", type: "GroupType", attributes: {
  name: "Campus Groups", church_center_visible: true,
}};
const location = {id: "3", type: "Location", attributes: {
  name: "Room 200", display_preference: "exact", strategy: "exact",
  full_formatted_address: "private street", latitude: 42, longitude: 12,
}};
const included = new Map([["GroupType:2", type], ["Location:3", location]]);
const tags = new Map([["100", "Drop-ins welcome"],
  ["101", "Connect before visiting"]]);
const copy = (value) => structuredClone(value);

test("only the explicit public display contract crosses the boundary", () => {
  const result = normalizePublicGroup(group, included, tags);
  assert.deepEqual(Object.keys(result).sort(), ["attendance", "description",
    "id", "imageUrl", "location", "locationTags", "meetingDays", "name",
    "schedule", "type", "url"]);
  assert.equal(result.description, "A welcoming group.\n\nCome as you are.");
  assert.equal(result.location, "Room 200");
  assert.deepEqual(result.meetingDays, [0]);
  assert.equal(result.attendance, "Drop-ins welcome");
  assert.deepEqual(result.locationTags, []);
  assert.doesNotMatch(JSON.stringify(result), /private|secret-person|latitude/);
});

test("description stays plain text, preserves paragraphs, and is bounded", () => {
  const value = copy(group);
  value.attributes.description_as_plain_text =
    "\r\nFirst paragraph.\r\n\r\nSecond paragraph.\r\n";
  assert.equal(normalizePublicGroup(value, included, tags).description,
      "First paragraph.\n\nSecond paragraph.");

  value.attributes.description_as_plain_text = "x".repeat(12001);
  const result = normalizePublicGroup(value, included, tags);
  assert.equal(result.description.length, 12000);
  assert.equal(result.description, "x".repeat(12000));

  value.attributes.description_as_plain_text = undefined;
  assert.equal(normalizePublicGroup(value, included, tags).description, "");
});

test("unlisted, archived, hidden-type and unknown-type groups fail closed", () => {
  for (const attrs of [{listed: false}, {listed: "true"},
    {archived_at: "2026-01-01"}, {public_church_center_web_url: "javascript:x"},
    {public_church_center_web_url: "https://evil.test/groups/type/test"}]) {
    const value = copy(group);
    Object.assign(value.attributes, attrs);
    assert.equal(normalizePublicGroup(value, included, tags), null);
  }
  assert.equal(normalizePublicGroup(group, new Map(), tags), null);
  const hidden = copy(type);
  hidden.attributes.church_center_visible = false;
  assert.equal(normalizePublicGroup(group,
      new Map([["GroupType:2", hidden]]), tags), null);
});

test("staff exact location strategy cannot override visitor privacy", () => {
  for (const display of ["hidden", "approximate", undefined, "other"]) {
    const value = copy(location);
    value.attributes.display_preference = display;
    assert.equal(publicLocation(group, value), "");
  }
  const virtual = copy(group);
  virtual.attributes.location_type_preference = "virtual";
  assert.equal(publicLocation(virtual, location), "");
  assert.equal(publicLocation(group, undefined), "");
});

test("attendance requires an exact Central tag mapping, never enrollment", () => {
  assert.equal(attendanceFromTags([], tags), null);
  assert.equal(attendanceFromTags(["unrelated"], tags), null);
  assert.equal(attendanceFromTags(["100", "101"], tags), null);
  assert.equal(attendanceFromTags(["101"], tags), "Connect before visiting");
  const value = copy(group);
  value.attributes.tag_ids = [];
  value.attributes.enrollment_strategy = "open_signup";
  assert.equal(normalizePublicGroup(value, included, tags).attendance, null);
});

test("location tags preserve public labels, support multiples, and dedupe case-insensitively", () => {
  const mapped = new Map([["200", "North Campus"], ["201", "north campus"],
    ["202", "Online"]]);
  assert.deepEqual(locationTagsFromTags(["200", "201", "202", "unknown"], mapped),
      ["North Campus", "Online"]);
  const value = copy(group);
  value.attributes.tag_ids = ["200", "202"];
  value.attributes.location_type_preference = "virtual";
  assert.deepEqual(normalizePublicGroup(value, included, tags, mapped).locationTags,
      ["North Campus", "Online"]);
});

test("weekday recognition is explicit, plural-aware, and preserves unknowns", () => {
  assert.deepEqual(meetingDaysFromSchedule("Meets monthly on the 1st"), []);
  assert.deepEqual(meetingDaysFromSchedule(""), []);
  assert.deepEqual(meetingDaysFromSchedule("Every other Tuesday at 7pm"), [2]);
  assert.deepEqual(meetingDaysFromSchedule("Sunday and Wednesday at 6pm"), [0, 3]);
  assert.deepEqual(meetingDaysFromSchedule("Sundays except Tuesday"), []);
  assert.deepEqual(meetingDaysFromSchedule("Monday-Friday"), []);
  assert.deepEqual(meetingDaysFromSchedule("Monday to Friday"), []);
  assert.deepEqual(meetingDaysFromSchedule("Monday thru Friday"), []);
  assert.deepEqual(meetingDaysFromSchedule("No Sundays in September"), []);
  assert.deepEqual(meetingDaysFromSchedule("Contact Sundayson for details"), []);
});

test("missing and unapproved images become an empty image URL", () => {
  for (const header of [null, {}, {medium: "https://evil.test/image.jpg"}]) {
    const value = copy(group);
    value.attributes.header_image = header;
    assert.equal(normalizePublicGroup(value, included, tags).imageUrl, "");
  }
});

test("pagination exhausts pages and rejects credential redirects or cycles", async () => {
  const url = "https://api.planningcenteronline.com/groups/v2/groups";
  let calls = 0;
  const result = await fetchGroupsCollection(async () => {
    calls++;
    return {data: [{id: String(calls)}], links: {
      next: calls === 1 ? url + "?offset=1" : null,
    }};
  }, url);
  assert.equal(result.data.length, 2);
  for (const next of ["https://evil.test/groups/v2/groups",
    "/groups/v2/people", url]) {
    await assert.rejects(fetchGroupsCollection(async () =>
      ({data: [], links: {next}}), url), /pagination/);
  }
});

function source({central = true, mapped = true, locationType = true,
  locationPublic = true, duplicateLocationType = false} = {}) {
  return async (value) => {
    const url = new URL(value);
    if (url.pathname === "/groups/v2/groups") {
      assert.equal(url.searchParams.get("include"), "group_type,location");
      assert.match(url.searchParams.get("fields[Group]"), /tag_ids/);
      assert.match(url.searchParams.get("fields[Group]"),
          /description_as_plain_text/);
      return {data: [group], included: [type, location]};
    }
    if (url.pathname === "/groups/v2/tag_groups") {
      const data = central ? [{id: "9", attributes: {
        name: "Central", display_publicly: false,
      }}] : [];
      if (locationType) {
        data.push({id: "10", attributes: {
          name: " Location Type ", display_publicly: locationPublic,
        }});
      }
      if (duplicateLocationType) {
        data.push({id: "11", attributes: {
          name: "location type", display_publicly: true,
        }});
      }
      return {data};
    }
    if (url.pathname === "/groups/v2/tag_groups/9/tags") {
      return {data: mapped ? [{id: "100", attributes: {
        name: "Drop-ins welcome",
      }}, {id: "999", attributes: {name: "Internal note"}}] : []};
    }
    assert.equal(url.pathname, "/groups/v2/tag_groups/10/tags");
    return {data: [{id: "200", attributes: {name: "North Campus"}},
      {id: "201", attributes: {name: "north campus"}},
      {id: "202", attributes: {name: "Online"}},
      {id: "203", attributes: {name: "   "}}]};
  };
}

test("service maps configured tags but absence never hides eligible groups", async () => {
  for (const options of [{}, {central: false}, {mapped: false}]) {
    const service = createPublicGroupsService({fetchJson: source(options)});
    const rows = await service.loadGroups();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].attendance, Object.keys(options).length ?
      null : "Drop-ins welcome");
  }
});

test("service exposes only public unique Location Type tag labels", async () => {
  const value = copy(group);
  value.attributes.tag_ids = ["200", "201", "202", "999"];
  for (const options of [{}, {locationType: false}, {locationPublic: false},
    {duplicateLocationType: true}]) {
    const fetchJson = source(options);
    const service = createPublicGroupsService({fetchJson: async (url) => {
      const response = await fetchJson(url);
      if (new URL(url).pathname === "/groups/v2/groups") {
        return {...response, data: [value]};
      }
      return response;
    }});
    const rows = await service.loadGroups();
    assert.deepEqual(rows[0].locationTags, Object.keys(options).length ? [] :
      ["North Campus", "Online"]);
  }
});

test("cache coalesces loads, expires, and never serves stale privacy data", async () => {
  let time = 0;
  let calls = 0;
  let fail = false;
  const fetchSource = source();
  const service = createPublicGroupsService({now: () => time,
    fetchJson: async (url) => {
      calls++;
      if (fail) throw new Error("Unavailable");
      return fetchSource(url);
    },
  });
  await Promise.all([service.loadGroups(), service.loadGroups()]);
  assert.equal(calls, 4);
  await service.loadGroups();
  assert.equal(calls, 4);
  time = 60001;
  fail = true;
  await assert.rejects(service.loadGroups(), /Unavailable/);
  fail = false;
  assert.equal((await service.loadGroups()).length, 1);
});
