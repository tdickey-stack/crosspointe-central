import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  allocateLevel4SocialSlots,
  applySmuggle,
  calculateTimeliness,
  ensureLevel2StandingLane,
  evaluateCapacity,
  generateCampaignSchedule,
  groupCalendarCampaignDays,
  nextPlanningWeekStart,
  recommendSmuggleOpportunities,
  startOfSundayWeek,
  utilizationForWeek,
  weeklyInventoryPlays,
} from "../src/planner/domain.js";
import {
  STARTER_CAPACITY_RULES,
  STARTER_PLAYBOOKS,
} from "../src/planner/seed-data.js";

function playbook(id) {
  return structuredClone(STARTER_PLAYBOOKS.find((item) => item.id === id));
}

function campaign(overrides = {}) {
  return {
    id: overrides.id || "campaign-a",
    name: overrides.name || "Test Campaign",
    eventDate: "2026-10-17",
    registrationDeadline: "",
    submittedAt: "2026-09-01T15:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
    ...overrides,
  };
}

test("normal on-time campaign generates every play", () => {
  const definition = playbook("level-4-standard");
  const result = generateCampaignSchedule({
    campaign: campaign(),
    playbook: definition,
    generatedAt: new Date("2026-09-01T12:00:00-05:00"),
  });
  const expected = definition.weeks.reduce((sum, week) => sum + week.plays.length, 0);
  assert.equal(result.plays.length, expected);
  assert.equal(result.summary.missed, 0);
  assert.equal(result.campaign.isOnTime, true);
});

test("event-week promotions stop at a midweek event deadline", () => {
  const definition = {
    id: "midweek-event",
    level: 3,
    version: 1,
    durationWeeks: 1,
    campaignType: "standard",
    weeks: [{
      weekNumber: 1,
      phase: "Event Week",
      plays: [
        {id: "sunday", playType: "Stage Announcement", channel: "Stage", resourceId: "stage-announcement", dayOfWeek: 0, eligibleWeekdays: [0], lateBehavior: "SKIP"},
        {id: "monday", playType: "Social Post", channel: "Social", resourceId: "social-content", dayOfWeek: 1, eligibleWeekdays: [1], lateBehavior: "SKIP"},
        {id: "wednesday", playType: "Newsletter", channel: "Newsletter", resourceId: "newsletter-feature", dayOfWeek: 3, eligibleWeekdays: [3], lateBehavior: "SKIP"},
      ],
    }],
  };
  const result = generateCampaignSchedule({
    campaign: campaign({eventDate: "2026-08-17", registrationDeadline: ""}),
    playbook: definition,
    generatedAt: new Date("2026-08-01T12:00:00-05:00"),
  });
  assert.deepEqual(result.plays.map((play) => play.templatePlayId), ["sunday", "monday"]);
  assert.ok(result.plays.every((play) => play.scheduledDate <= "2026-08-17"));
});

test("two-week campaign submitted during week two does not compress week one", () => {
  const result = generateCampaignSchedule({
    campaign: campaign({submittedAt: "2026-10-12T15:00:00-05:00"}),
    playbook: playbook("level-4-standard"),
    generatedAt: new Date("2026-10-12T15:00:00-05:00"),
  });
  const weekOne = result.plays.filter((play) => play.weekNumber === 1);
  assert.ok(weekOne.every((play) => ["missed", "needs-decision"].includes(play.status)));
  assert.ok(result.plays.some((play) => play.weekNumber === 2 && play.status === "scheduled"));
  assert.equal(result.campaign.currentWeek, 2);
});

test("midweek late flexible play reschedules while passed Sunday play is missed", () => {
  const definition = {
    id: "late-test",
    level: 4,
    version: 1,
    durationWeeks: 1,
    campaignType: "standard",
    weeks: [{
      weekNumber: 1,
      phase: "Interest",
      plays: [
        {id: "stage", playType: "Stage", channel: "Stage", resourceId: "stage-announcement", dayOfWeek: 0, eligibleWeekdays: [0], lateBehavior: "SKIP"},
        {id: "social", playType: "Social", channel: "Social", resourceId: "social-sprinkle", dayOfWeek: 1, eligibleWeekdays: [1, 5], lateBehavior: "NEXT_AVAILABLE_SLOT"},
      ],
    }],
  };
  const result = generateCampaignSchedule({
    campaign: campaign({eventDate: "2026-10-17", submittedAt: "2026-10-14T10:00:00-05:00"}),
    playbook: definition,
    generatedAt: new Date("2026-10-14T10:00:00-05:00"),
  });
  assert.equal(result.plays.find((play) => play.templatePlayId === "stage").status, "missed");
  const flexible = result.plays.find((play) => play.templatePlayId === "social");
  assert.equal(flexible.status, "rescheduled");
  assert.equal(flexible.scheduledDate, "2026-10-16");
});

function socialCandidate(id, eventDate, submittedAt = "2026-09-01T12:00:00.000Z") {
  const weekStart = startOfSundayWeek(eventDate);
  return {
    play: {
      id: `play-${id}`,
      campaignId: id,
      campaignName: id,
      campaignLevel: 4,
      campaignType: "standard",
      resourceId: "level-4-social",
      originalScheduledDate: addDays(weekStart, 1),
      scheduledDate: addDays(weekStart, 1),
      status: "scheduled",
      conflictState: "none",
    },
    campaign: campaign({id, name: id, eventDate, submittedAt, isOnTime: true}),
  };
}

test("one Level 4 campaign receives only one shared social slot", () => {
  const item = socialCandidate("one", "2026-10-17");
  const result = allocateLevel4SocialSlots({plays: [item.play], campaigns: [item.campaign]});
  assert.equal(result.plays.length, 1);
  assert.equal(result.plays[0].scheduledDate, "2026-10-12");
});

test("two Level 4 campaigns receive Monday and Friday", () => {
  const a = socialCandidate("one", "2026-10-17");
  const b = socialCandidate("two", "2026-10-17", "2026-09-02T12:00:00.000Z");
  const result = allocateLevel4SocialSlots({plays: [a.play, b.play], campaigns: [a.campaign, b.campaign]});
  assert.deepEqual(new Set(result.plays.map((play) => play.scheduledDate)), new Set(["2026-10-12", "2026-10-16"]));
  assert.equal(result.conflicts.length, 0);
});

test("three Level 4 campaigns create one overflow conflict", () => {
  const items = ["one", "two", "three"].map((id) => socialCandidate(id, "2026-10-17"));
  const result = allocateLevel4SocialSlots({
    plays: items.map((item) => item.play),
    campaigns: items.map((item) => item.campaign),
  });
  assert.equal(result.plays.filter((play) => play.status === "conflict").length, 1);
  assert.equal(result.conflicts[0].capacity, 2);
});

test("campaign before Friday cannot receive a Friday slot", () => {
  const constrained = socialCandidate("constrained", "2026-10-14");
  const flexible = socialCandidate("flexible", "2026-10-17");
  const result = allocateLevel4SocialSlots({
    plays: [flexible.play, constrained.play],
    campaigns: [flexible.campaign, constrained.campaign],
  });
  assert.equal(result.plays.find((play) => play.campaignId === "constrained").scheduledDate, "2026-10-12");
  assert.equal(result.plays.find((play) => play.campaignId === "flexible").scheduledDate, "2026-10-16");
});

test("on-time campaign wins an otherwise comparable capacity recommendation", () => {
  const rule = STARTER_CAPACITY_RULES.find((item) => item.id === "newsletter-feature");
  const plays = ["late", "on-time"].map((id) => ({
    id: `play-${id}`,
    campaignId: id,
    campaignName: id,
    resourceId: rule.id,
    scheduledDate: "2026-10-14",
    status: "scheduled",
    conflictState: "none",
  }));
  const campaigns = [
    campaign({id: "late", level: 3, campaignType: "standard", isOnTime: false}),
    campaign({id: "on-time", level: 3, campaignType: "standard", isOnTime: true}),
  ];
  const result = evaluateCapacity({plays, capacityRules: [rule], campaigns});
  assert.deepEqual(result.conflicts[0].recommendedPlayIds, ["play-on-time"]);
  assert.equal(result.plays.find((play) => play.id === "play-late").status, "conflict");
});

test("Newsletter Event Cards warn above four and conflict only above six", () => {
  const rule = STARTER_CAPACITY_RULES.find((item) => item.id === "newsletter-event-card");
  assert.equal(rule.typicalCapacity, 4);
  assert.equal(rule.capacity, 6);
  const cards = Array.from({length: 7}, (_, index) => ({
    id: `newsletter-card-${index + 1}`,
    campaignId: `campaign-${index + 1}`,
    campaignName: `Campaign ${index + 1}`,
    campaignLevel: index < 4 ? 4 : 5,
    campaignType: "standard",
    eventDate: "2026-10-17",
    submittedAt: "2026-09-01T12:00:00.000Z",
    isOnTime: true,
    resourceId: rule.id,
    scheduledDate: "2026-10-14",
    status: "scheduled",
    conflictState: "none",
  }));
  const allowed = evaluateCapacity({plays: cards.slice(0, 6), capacityRules: [rule]});
  assert.equal(allowed.conflicts.length, 0);
  assert.equal(allowed.plays.filter((play) => play.status === "conflict").length, 0);
  const overCapacity = evaluateCapacity({plays: cards, capacityRules: [rule]});
  assert.equal(overCapacity.conflicts.length, 1);
  assert.equal(overCapacity.conflicts[0].capacity, 6);
  assert.equal(overCapacity.conflicts[0].typicalCapacity, 4);
  assert.equal(overCapacity.plays.filter((play) => play.status === "conflict").length, 1);
  const utilization = utilizationForWeek({
    weekStart: "2026-10-11",
    plays: cards.slice(0, 5),
    capacityRules: [rule],
  });
  assert.equal(utilization[0].capacityState, "above-typical");
});

test("weekly inventory includes every matching status and excludes other weeks and resources", () => {
  const plays = [
    {id: "scheduled", campaignName: "A", resourceId: "stage-announcement", campaignLevel: 4, scheduledDate: "2026-10-11", status: "scheduled"},
    {id: "conflict", campaignName: "B", resourceId: "stage-announcement", campaignLevel: 3, scheduledDate: "2026-10-14", status: "conflict"},
    {id: "missed", campaignName: "C", resourceId: "stage-announcement", campaignLevel: 2, scheduledDate: "2026-10-17", status: "missed"},
    {id: "other-resource", campaignName: "D", resourceId: "newsletter-feature", campaignLevel: 2, scheduledDate: "2026-10-14", status: "scheduled"},
    {id: "other-week", campaignName: "E", resourceId: "stage-announcement", campaignLevel: 2, scheduledDate: "2026-10-18", status: "scheduled"},
  ];
  assert.deepEqual(
    weeklyInventoryPlays({plays, weekStart: "2026-10-11", resourceId: "stage-announcement"}).map((play) => play.id),
    ["scheduled", "conflict", "missed"],
  );
  assert.deepEqual(
    weeklyInventoryPlays({plays, weekStart: "2026-10-11", campaignLevel: 2}).map((play) => play.id),
    ["other-resource", "missed"],
  );
});

test("planning overview always starts on the next Sunday", () => {
  assert.equal(nextPlanningWeekStart("2026-08-15"), "2026-08-16");
  assert.equal(nextPlanningWeekStart("2026-08-16"), "2026-08-23");
});

test("calendar groups only same-day plays for the same campaign", () => {
  const groups = groupCalendarCampaignDays([
    {id: "stage", campaignId: "campaign-a", campaignName: "Women's Breakfast", campaignLevel: 4, scheduledDate: "2026-08-16", playType: "Stage Announcement"},
    {id: "slide", campaignId: "campaign-a", campaignName: "Women's Breakfast", campaignLevel: 4, scheduledDate: "2026-08-16", playType: "Pre-Service Slide"},
    {id: "bulletin", campaignId: "campaign-a", campaignName: "Women's Breakfast", campaignLevel: 4, scheduledDate: "2026-08-16", playType: "Weekly Bulletin Mention"},
    {id: "newsletter", campaignId: "campaign-a", campaignName: "Women's Breakfast", campaignLevel: 4, scheduledDate: "2026-08-19", playType: "Newsletter Feature"},
    {id: "other", campaignId: "campaign-b", campaignName: "Starting Pointe", campaignLevel: 2, scheduledDate: "2026-08-16", playType: "Social Media Sprinkle"},
    {id: "next-week", campaignId: "campaign-a", campaignName: "Women's Breakfast", campaignLevel: 4, scheduledDate: "2026-08-23", playType: "Stage Announcement"},
  ]);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups.filter((group) => group.scheduledDate === "2026-08-16").map((group) => group.campaignLevel), [2, 4]);
  const sundayCampaign = groups.find((group) => group.campaignId === "campaign-a" && group.scheduledDate === "2026-08-16");
  assert.deepEqual(sundayCampaign.plays.map((play) => play.playType), ["Pre-Service Slide", "Stage Announcement", "Weekly Bulletin Mention"]);
  assert.equal(groups.find((group) => group.campaignId === "campaign-a" && group.scheduledDate === "2026-08-19").plays.length, 1);
});

test("Level 2 event campaign covers the lane before ongoing fallback", () => {
  const existing = [{id: "event-play", campaignLevel: 2, scheduledDate: "2026-10-13", status: "scheduled"}];
  const result = ensureLevel2StandingLane({
    weekStart: "2026-10-11",
    plays: existing,
    ongoingPlaybook: playbook("level-2-ongoing-awareness"),
  });
  assert.equal(result.source, "event-campaign");
  assert.deepEqual(result.plays, existing);
});

test("week without Level 2 event receives ongoing standing lane plays", () => {
  const result = ensureLevel2StandingLane({
    weekStart: "2026-10-11",
    plays: [],
    ongoingPlaybook: playbook("level-2-ongoing-awareness"),
  });
  assert.equal(result.source, "ongoing");
  assert.ok(result.plays.length > 0);
  assert.ok(result.plays.every((play) => play.source === "standing-lane"));
});

test("Smuggle recommends Level 4 before Level 5 and never applies automatically", () => {
  const host = {
    id: "host-play",
    campaignId: "level-2-host",
    campaignLevel: 2,
    playType: "Social Media Sprinkle",
    scheduledDate: "2026-10-10",
    supportsSmuggle: true,
    status: "scheduled",
    smuggle: null,
  };
  const recommendations = recommendSmuggleOpportunities({
    hostPlays: [host],
    campaigns: [
      campaign({id: "l5", name: "Sewing Group", level: 5, eventDate: "2026-10-20", isOnTime: true}),
      campaign({id: "l4", name: "Women's Breakfast", level: 4, eventDate: "2026-10-22", isOnTime: true}),
    ],
    now: new Date("2026-10-01T12:00:00-05:00"),
  });
  assert.equal(recommendations[0].beneficiaryCampaignId, "l4");
  assert.equal(host.smuggle, null);
  const applied = applySmuggle(host, recommendations[0]);
  assert.equal(applied.smuggle.beneficiaryCampaignId, "l4");
  assert.equal(host.smuggle, null);
});

test("standalone content is never treated as a Smuggle campaign", () => {
  const recommendations = recommendSmuggleOpportunities({
    hostPlays: [{
      id: "host-play",
      campaignId: "level-2-host",
      campaignLevel: 2,
      playType: "Stage Announcement",
      scheduledDate: "2026-10-10",
      supportsSmuggle: true,
      status: "scheduled",
      smuggle: null,
    }],
    campaigns: [campaign({
      id: "content-item",
      name: "Weekend recap",
      level: 5,
      campaignType: "standalone-content",
      eventDate: "2026-10-12",
      isOnTime: true,
    })],
    now: new Date("2026-10-01T12:00:00-05:00"),
  });
  assert.deepEqual(recommendations, []);
});

test("playbook revision and manual move do not mutate prior templates or schedules", () => {
  const definition = playbook("level-4-standard");
  const result = generateCampaignSchedule({
    campaign: campaign(),
    playbook: definition,
    generatedAt: new Date("2026-09-01T12:00:00-05:00"),
  });
  const originalDate = result.plays[0].scheduledDate;
  definition.version = 2;
  definition.weeks[0].plays[0].playType = "Changed Template";
  const moved = {...result.plays[0], scheduledDate: addDays(originalDate, 1), manuallyAdjusted: true};
  assert.equal(result.campaign.playbookVersion, 1);
  assert.notEqual(result.plays[0].playType, "Changed Template");
  assert.equal(definition.weeks[0].plays[0].dayOfWeek, 0);
  assert.notEqual(moved.scheduledDate, originalDate);
});

test("timeliness stores days and weeks late from the recommended Sunday", () => {
  const result = calculateTimeliness({
    eventDate: "2026-10-17",
    durationWeeks: 2,
    submittedAt: "2026-10-14T10:00:00-05:00",
  });
  assert.equal(result.recommendedStartDate, "2026-10-04");
  assert.equal(result.daysLate, 10);
  assert.equal(result.weeksLate, 1);
});
