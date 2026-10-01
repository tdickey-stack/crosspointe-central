import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPromotionTimeline,
  timelinePosition,
  timelineRange,
} from "../src/planner/timeline-layout.js";

const Q1 = {startDate: "2027-01-01", endDate: "2027-03-31"};

function campaign(id, overrides = {}) {
  return {
    id,
    name: id,
    level: 3,
    campaignType: "event-based",
    playbookId: "standard",
    playbookVersion: 1,
    durationWeeks: 4,
    recommendedStartDate: "2027-01-01",
    campaignEndDate: "2027-01-28",
    eventDate: "2027-01-29",
    status: "active",
    ...overrides,
  };
}

function play(id, campaignId, scheduledDate, overrides = {}) {
  return {
    id,
    campaignId,
    campaignName: campaignId,
    campaignLevel: 3,
    campaignType: "event-based",
    playbookId: "standard",
    playbookVersion: 1,
    playType: "Stage Announcement",
    resourceId: "stage-announcement",
    scheduledDate,
    originalScheduledDate: scheduledDate,
    status: "scheduled",
    source: "campaign-generation",
    manuallyAdjusted: false,
    smuggle: null,
    ...overrides,
  };
}

function workspace(overrides = {}) {
  return {
    campaigns: [],
    scheduledPlays: [],
    playbooks: [],
    playbookVersions: [],
    ...overrides,
  };
}

const idsByLane = (layout) => layout.lanes.map((lane) => lane.groups.map((group) => group.campaign.id));

test("calendar year and quarter ranges include leap days and reject invalid controls", () => {
  assert.deepEqual(timelineRange({year: 2028, zoom: "quarter", quarter: 1}), {
    startDate: "2028-01-01",
    endDate: "2028-03-31",
  });
  assert.deepEqual(timelineRange({year: "2027", zoom: "quarter", quarter: 4}), {
    startDate: "2027-10-01",
    endDate: "2027-12-31",
  });
  assert.deepEqual(timelineRange({year: 2027, zoom: "year"}), {
    startDate: "2027-01-01",
    endDate: "2027-12-31",
  });
  assert.throws(() => timelineRange({year: 2027, quarter: 5}), RangeError);
  assert.throws(() => timelineRange({year: "later", zoom: "year"}), RangeError);
});

test("timeline positions use inclusive days and clip at both range boundaries", () => {
  const range = {startDate: "2027-01-01", endDate: "2027-01-10"};
  assert.deepEqual(timelinePosition("2027-01-01", "2027-01-01", range), {left: "0%", width: "10%"});
  assert.deepEqual(timelinePosition("2026-12-20", "2027-01-02", range), {left: "0%", width: "20%"});
  assert.deepEqual(timelinePosition("2027-01-10", "2027-01-20", range), {left: "90%", width: "10%"});
  assert.deepEqual(timelinePosition("2027-02-01", "2027-02-02", range), {left: "100%", width: "0%"});
});

test("campaign phases come from the pinned version, merge adjacent names, and stop at the saved end", () => {
  const promotion = campaign("launch", {campaignEndDate: "2027-01-31", eventDate: "2027-02-01", durationWeeks: 5});
  const layout = buildPromotionTimeline(workspace({
    campaigns: [promotion],
    scheduledPlays: [
      play("stage", promotion.id, "2027-01-03"),
      play("newsletter", promotion.id, "2027-01-03", {playType: "Newsletter Feature"}),
      play("social", promotion.id, "2027-01-20", {playType: "Social Media Sprinkle"}),
    ],
    playbookVersions: [{
      id: "standard",
      playbookId: "standard",
      version: 1,
      weeks: [
        {weekNumber: 1, phase: "Awareness"},
        {weekNumber: 2, phase: "Awareness"},
        {weekNumber: 3, phase: "Interest"},
        {weekNumber: 4, phase: "Urgency"},
        {weekNumber: 5, phase: "Urgency"},
      ],
    }],
    playbooks: [{id: "standard", version: 2, weeks: [{weekNumber: 1, phase: "Wrong current version"}]}],
  }), Q1);
  const group = layout.groups[0];
  assert.equal(group.startDate, "2027-01-01");
  assert.equal(group.endDate, "2027-02-01");
  assert.deepEqual(group.phases.map(({name, startDate, endDate}) => ({name, startDate, endDate})), [
    {name: "Awareness", startDate: "2027-01-01", endDate: "2027-01-14"},
    {name: "Interest", startDate: "2027-01-15", endDate: "2027-01-21"},
    {name: "Urgency", startDate: "2027-01-22", endDate: "2027-01-31"},
  ]);
  assert.deepEqual(group.days.map((day) => [day.scheduledDate, day.plays.map((item) => item.id)]), [
    ["2027-01-03", ["newsletter", "stage"]],
    ["2027-01-20", ["social"]],
  ]);
});

test("legacy campaigns derive their window while saved dates and manually moved plays determine the actual envelope", () => {
  const legacy = campaign("legacy", {
    recommendedStartDate: "",
    campaignEndDate: "",
    eventDate: "2027-03-15",
    durationWeeks: 2,
  });
  const moved = campaign("moved", {
    recommendedStartDate: "2027-01-10",
    campaignEndDate: "2027-01-20",
    eventDate: "2027-01-21",
  });
  const layout = buildPromotionTimeline(workspace({
    campaigns: [moved, legacy],
    scheduledPlays: [
      play("generated-outlier", moved.id, "2026-12-01"),
      play("moved-early", moved.id, "2027-01-02", {manuallyAdjusted: true}),
      play("moved-late", moved.id, "2027-02-04", {manuallyAdjusted: true}),
    ],
  }), Q1);
  const legacyGroup = layout.groups.find((group) => group.campaign.id === legacy.id);
  const movedGroup = layout.groups.find((group) => group.campaign.id === moved.id);
  assert.deepEqual([legacyGroup.startDate, legacyGroup.endDate], ["2027-03-01", "2027-03-15"]);
  assert.deepEqual([movedGroup.startDate, movedGroup.endDate], ["2027-01-02", "2027-02-04"]);
});

test("packing reuses disjoint dates within each level, treats touching dates as collisions, and is deterministic", () => {
  const campaigns = [
    campaign("level-2", {level: 2, recommendedStartDate: "2027-02-01", campaignEndDate: "2027-02-03", eventDate: "2027-02-04"}),
    campaign("first", {level: 1, recommendedStartDate: "2027-01-01", campaignEndDate: "2027-01-09", eventDate: "2027-01-10"}),
    campaign("touching", {level: 1, recommendedStartDate: "2027-01-10", campaignEndDate: "2027-01-10", eventDate: "2027-01-12"}),
    campaign("next", {level: 1, recommendedStartDate: "2027-01-11", campaignEndDate: "2027-01-11", eventDate: "2027-01-13"}),
    campaign("content", {campaignType: "standalone-content", eventDate: "2027-01-04"}),
  ];
  const scheduledPlays = [play("content-play", "content", "2027-01-04", {campaignType: "standalone-content"})];
  const ordered = buildPromotionTimeline(workspace({campaigns, scheduledPlays}), Q1);
  const shuffled = buildPromotionTimeline(workspace({campaigns: [campaigns[4], campaigns[2], campaigns[0], campaigns[3], campaigns[1]], scheduledPlays}), Q1);
  assert.deepEqual(idsByLane(ordered), [["first", "next"], ["touching"], ["level-2"], ["content"]]);
  assert.deepEqual(idsByLane(shuffled), idsByLane(ordered));
  assert.deepEqual(ordered.lanes.map((lane) => lane.level), [1, 1, 2, 6]);
});

test("an explicit historical range retains completed and expired campaign records", () => {
  const old = campaign("old", {
    status: "completed",
    recommendedStartDate: "2025-11-01",
    campaignEndDate: "2025-11-29",
    eventDate: "2025-11-30",
  });
  const layout = buildPromotionTimeline(workspace({campaigns: [old]}), {
    startDate: "2025-10-01",
    endDate: "2025-12-31",
  });
  assert.deepEqual(layout.groups.map((group) => group.campaign.id), ["old"]);
});

test("calendar-day groups omit skipped, missed, archived, and smuggled beneficiary plays", () => {
  const host = campaign("host", {level: 1});
  const guest = campaign("guest", {level: 4});
  const archived = campaign("archived", {status: "archived"});
  const scheduledPlays = [
    play("host-stage", host.id, "2027-01-10", {
      campaignLevel: 1,
      smuggle: {beneficiaryCampaignId: guest.id},
    }),
    play("guest-stage", guest.id, "2027-01-10", {campaignLevel: 4}),
    play("guest-social", guest.id, "2027-01-11", {campaignLevel: 4, playType: "Social"}),
    play("skipped", guest.id, "2027-01-12", {campaignLevel: 4, status: "skipped"}),
    play("missed", guest.id, "2027-01-13", {campaignLevel: 4, status: "missed"}),
    play("archived-play", archived.id, "2027-01-10"),
  ];
  const layout = buildPromotionTimeline(workspace({campaigns: [host, guest, archived], scheduledPlays}), Q1);
  assert.deepEqual(layout.groups.map((group) => group.campaign.id), ["host", "guest"]);
  assert.deepEqual(layout.groups.find((group) => group.campaign.id === "host").days[0].plays.map((item) => item.id), ["host-stage"]);
  assert.deepEqual(layout.groups.find((group) => group.campaign.id === "guest").days.flatMap((day) => day.plays.map((item) => item.id)), ["guest-social"]);
});

test("standing-lane records stay in ongoing day groups even without a saved campaign", () => {
  const saved = campaign("standing-saved", {level: 2, campaignType: "ongoing"});
  const layout = buildPromotionTimeline(workspace({
    campaigns: [saved],
    scheduledPlays: [
      play("derived", "standing-derived", "2027-01-04", {campaignLevel: 2, source: "standing-lane"}),
      play("stored", saved.id, "2027-01-11", {campaignLevel: 2, source: "standing-lane"}),
      play("outside", "standing-derived", "2027-04-01", {campaignLevel: 2, source: "standing-lane"}),
    ],
  }), Q1);
  assert.deepEqual(layout.groups, []);
  assert.deepEqual(layout.ongoing.map((day) => [day.campaignId, day.scheduledDate]), [
    ["standing-derived", "2027-01-04"],
    [saved.id, "2027-01-11"],
  ]);
  assert.deepEqual(buildPromotionTimeline(workspace({campaigns: [saved], scheduledPlays: [
    play("stored", saved.id, "2027-01-11", {campaignLevel: 2, source: "standing-lane"}),
  ]}), Q1, {level: "3"}).ongoing, []);
});

test("standalone content uses only visible play dates, has no campaign phase, and is excluded by numeric level filters", () => {
  const content = campaign("podcast", {
    level: 5,
    campaignType: "standalone-content",
    recommendedStartDate: "2020-01-01",
    eventDate: "2030-01-01",
  });
  const data = workspace({
    campaigns: [content],
    scheduledPlays: [
      play("episode-1", content.id, "2027-01-08", {campaignLevel: 5, campaignType: "standalone-content"}),
      play("episode-2", content.id, "2027-02-08", {campaignLevel: 5, campaignType: "standalone-content"}),
      play("removed", content.id, "2027-03-08", {campaignLevel: 5, campaignType: "standalone-content", status: "skipped"}),
    ],
  });
  const group = buildPromotionTimeline(data, Q1).groups[0];
  assert.equal(group.level, 6);
  assert.deepEqual([group.startDate, group.endDate], ["2027-01-08", "2027-02-08"]);
  assert.deepEqual(group.phases, []);
  assert.deepEqual(buildPromotionTimeline(data, Q1, {level: "5"}).groups, []);
});

test("range intersection filters groups and play days while malformed campaign dates fail gracefully", () => {
  const crossing = campaign("crossing", {
    recommendedStartDate: "2026-12-20",
    campaignEndDate: "2027-01-04",
    eventDate: "2027-01-05",
  });
  const malformed = campaign("malformed", {
    recommendedStartDate: "bad",
    campaignEndDate: "2027-02-30",
    eventDate: "also-bad",
  });
  const absent = campaign("absent", {
    recommendedStartDate: "bad",
    campaignEndDate: "",
    eventDate: "",
  });
  const data = workspace({
    campaigns: [absent, malformed, crossing],
    scheduledPlays: [
      play("before", crossing.id, "2026-12-30"),
      play("inside", crossing.id, "2027-01-03"),
      play("repairable", malformed.id, "2027-02-10"),
    ],
    playbookVersions: [{
      playbookId: "standard",
      version: 1,
      weeks: [
        {weekNumber: 1, phase: "Before range"},
        {weekNumber: 2, phase: "Crosses boundary"},
        {weekNumber: 3, phase: "Inside range"},
      ],
    }],
  });
  assert.doesNotThrow(() => buildPromotionTimeline(data, Q1));
  const layout = buildPromotionTimeline(data, Q1);
  assert.deepEqual(layout.groups.map((group) => group.campaign.id), ["crossing", "malformed"]);
  assert.equal(layout.groups[0].id, "crossing");
  assert.deepEqual(layout.groups.find((group) => group.campaign.id === "crossing").days.map((day) => day.scheduledDate), ["2027-01-03"]);
  assert.deepEqual(layout.groups.find((group) => group.campaign.id === "crossing").phases.map((phase) => phase.name), ["Crosses boundary", "Inside range"]);
  assert.deepEqual(layout.groups.find((group) => group.campaign.id === "malformed").phases, []);
  assert.throws(() => buildPromotionTimeline(data, {startDate: "2027-03-01", endDate: "2027-02-01"}), RangeError);
});
