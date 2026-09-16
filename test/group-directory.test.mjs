import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveGroupFilterOptions,
  filterGroups,
  getSafeChurchCenterUrl,
  getSafeImageUrl,
} from "../public/group-directory.js";

const groups = [
  {
    id: "1",
    name: "Young Families",
    type: {id: "t1", name: "Life Groups"},
    schedule: "Sundays at 5 PM",
    meetingDays: [0],
    location: "Niceville",
  },
  {
    id: "2",
    name: "Tuesday Women",
    type: {id: "t2", name: "Women"},
    schedule: "Tuesday mornings",
    meetingDays: [2],
    location: "Crestview",
  },
  {
    id: "3",
    name: "Coffee and Scripture",
    type: {id: "t1b", name: "life groups"},
    schedule: "Schedule coming soon",
    meetingDays: [],
    location: " niceville ",
  },
  {
    id: "4",
    name: "Prayer Group",
    type: {id: "", name: ""},
    schedule: "Wednesdays",
    meetingDays: [3, 3, 9],
    location: "",
  },
];

test("filter options omit blanks, dedupe case-insensitively, and use real days", () => {
  const options = deriveGroupFilterOptions(groups);
  assert.deepEqual(options.types, [
    {value: "life groups", label: "Life Groups"},
    {value: "women", label: "Women"},
  ]);
  assert.deepEqual(options.locations, [
    {value: "crestview", label: "Crestview"},
    {value: "niceville", label: "Niceville"},
  ]);
  assert.deepEqual(options.days, [
    {value: "0", label: "Sunday"},
    {value: "2", label: "Tuesday"},
    {value: "3", label: "Wednesday"},
  ]);
});

test("combined filters match normalized type and location values", () => {
  const result = filterGroups(groups, {
    search: "young",
    type: "LIFE GROUPS",
    location: "niceville",
    day: "0",
  });
  assert.deepEqual(result.map((group) => group.id), ["1"]);
});

test("search checks useful card details and day filters exclude unknown days", () => {
  assert.deepEqual(
      filterGroups(groups, {search: "morning"}).map((group) => group.id),
      ["2"],
  );
  assert.deepEqual(
      filterGroups(groups, {day: "2"}).map((group) => group.id),
      ["2"],
  );
  assert.equal(filterGroups(groups, {}).length, groups.length);
});

test("safe destinations only accept HTTPS Church Center links", () => {
  assert.equal(
      getSafeChurchCenterUrl("https://crosspointetv.churchcenter.com/groups/123"),
      "https://crosspointetv.churchcenter.com/groups/123",
  );
  assert.equal(getSafeChurchCenterUrl("http://crosspointetv.churchcenter.com/groups/123"), "");
  assert.equal(getSafeChurchCenterUrl("https://churchcenter.com.evil.example/groups/123"), "");
  assert.equal(getSafeChurchCenterUrl("javascript:alert(1)"), "");
});

test("image destinations accept HTTPS and reject active or insecure schemes", () => {
  assert.equal(getSafeImageUrl("https://images.example/group.jpg"), "https://images.example/group.jpg");
  assert.equal(getSafeImageUrl("http://images.example/group.jpg"), "");
  assert.equal(getSafeImageUrl("data:image/svg+xml;base64,test"), "");
});
