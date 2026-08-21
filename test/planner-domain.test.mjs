import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  allocateLevel4SocialSlots,
  applySmuggle,
  buildSmuggleRelationships,
  buildCampaignRegeneration,
  calculateTimeliness,
  cancelSmuggle,
  ensureLevel2StandingLane,
  evaluateCapacity,
  generateCampaignSchedule,
  groupCalendarCampaignDays,
  nextPlanningWeekStart,
  recommendSmuggleOpportunities,
  recurringContentDates,
  reportPresetDateRange,
  scheduleSummary,
  skipPromotion,
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

test("report date presets follow the upcoming planning Sunday", () => {
  const reference = new Date("2026-08-16T12:00:00-05:00");
  assert.deepEqual(reportPresetDateRange("upcoming", reference), {
    startDate: "2026-08-23",
    endDate: "2026-08-29",
  });
  assert.deepEqual(reportPresetDateRange("next-two-weeks", reference), {
    startDate: "2026-08-23",
    endDate: "2026-09-05",
  });
  assert.deepEqual(reportPresetDateRange("month-at-a-glance", reference), {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
  assert.throws(() => reportPresetDateRange("custom", reference), /valid report date preset/);
});

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

test("final phase is a complete seven-day window before a midweek event", () => {
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
  assert.deepEqual(result.plays.map((play) => play.templatePlayId), ["sunday", "monday", "wednesday"]);
  assert.deepEqual(result.plays.map((play) => play.scheduledDate), ["2026-08-16", "2026-08-10", "2026-08-12"]);
  assert.ok(result.plays.every((play) => play.scheduledDate < "2026-08-17"));
});

test("every event weekday receives all seven fixed weekdays in its final phase", () => {
  const definition = {
    id: "weekday-matrix",
    level: 1,
    version: 1,
    durationWeeks: 1,
    campaignType: "standard",
    weeks: [{
      weekNumber: 1,
      phase: "Sprint",
      plays: Array.from({length: 7}, (_value, dayOfWeek) => ({
        id: `day-${dayOfWeek}`,
        playType: `Day ${dayOfWeek}`,
        channel: "Test",
        resourceId: `test-${dayOfWeek}`,
        dayOfWeek,
        eligibleWeekdays: [dayOfWeek],
        lateBehavior: "SKIP",
      })),
    }],
  };
  Array.from({length: 7}, (_value, offset) => addDays("2026-08-16", offset))
    .forEach((eventDate) => {
      const result = generateCampaignSchedule({
        campaign: campaign({eventDate}),
        playbook: definition,
        generatedAt: new Date("2026-07-01T12:00:00-05:00"),
      });
      assert.equal(result.plays.length, 7);
      assert.deepEqual(
        new Set(result.plays.map((play) => new Date(`${play.scheduledDate}T12:00:00Z`).getUTCDay())),
        new Set([0, 1, 2, 3, 4, 5, 6]),
      );
      assert.ok(result.plays.every((play) => play.scheduledDate >= addDays(eventDate, -7)));
      assert.ok(result.plays.every((play) => play.scheduledDate < eventDate));
    });
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
    {id: "level-1", campaignName: "Priority", resourceId: "stage-announcement", campaignLevel: 1, scheduledDate: "2026-10-17", status: "scheduled"},
    {id: "scheduled", campaignName: "A", resourceId: "stage-announcement", campaignLevel: 4, scheduledDate: "2026-10-11", status: "scheduled"},
    {id: "conflict", campaignName: "B", resourceId: "stage-announcement", campaignLevel: 3, scheduledDate: "2026-10-14", status: "conflict"},
    {id: "missed", campaignName: "C", resourceId: "stage-announcement", campaignLevel: 2, scheduledDate: "2026-10-17", status: "missed"},
    {id: "level-5", campaignName: "Later", resourceId: "stage-announcement", campaignLevel: 5, scheduledDate: "2026-10-11", status: "scheduled"},
    {id: "other-resource", campaignName: "D", resourceId: "newsletter-feature", campaignLevel: 2, scheduledDate: "2026-10-14", status: "scheduled"},
    {id: "other-week", campaignName: "E", resourceId: "stage-announcement", campaignLevel: 2, scheduledDate: "2026-10-18", status: "scheduled"},
  ];
  assert.deepEqual(
    weeklyInventoryPlays({plays, weekStart: "2026-10-11", resourceId: "stage-announcement"}).map((play) => play.id),
    ["level-1", "missed", "conflict", "scheduled", "level-5"],
  );
  assert.deepEqual(
    weeklyInventoryPlays({plays, weekStart: "2026-10-11", campaignLevel: 2}).map((play) => play.id),
    ["other-resource", "missed"],
  );
});

test("planning overview capacity cards use the intended dashboard order", () => {
  const utilization = utilizationForWeek({
    weekStart: "2026-10-11",
    plays: [],
    capacityRules: [...STARTER_CAPACITY_RULES].reverse(),
  });
  assert.deepEqual(
    utilization.map((item) => item.id),
    ["stage-announcement", "newsletter-feature", "newsletter-event-card", "level-4-social"],
  );
});

test("planning overview always starts on the next Sunday", () => {
  assert.equal(nextPlanningWeekStart("2026-08-15"), "2026-08-16");
  assert.equal(nextPlanningWeekStart("2026-08-16"), "2026-08-23");
});

test("recurring content supports bounded weekly and anchored monthly series", () => {
  assert.deepEqual(recurringContentDates({
    startDate: "2026-08-17",
    cadence: "weekly",
    occurrences: 3,
  }), ["2026-08-17", "2026-08-24", "2026-08-31"]);
  assert.deepEqual(recurringContentDates({
    startDate: "2026-01-31",
    cadence: "monthly",
    occurrences: 3,
  }), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.equal(recurringContentDates({
    startDate: "2026-08-17",
    cadence: "weekly",
    occurrences: 99,
  }).length, 12);
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
    hostPlays: [
      host,
      {id: "l4-stage", campaignId: "l4", campaignLevel: 4, playType: "Social Media Sprinkle", resourceId: "social-sprinkle", scheduledDate: "2026-10-10", status: "scheduled"},
      {id: "l5-stage", campaignId: "l5", campaignLevel: 5, playType: "Social Media Sprinkle", resourceId: "social-sprinkle", scheduledDate: "2026-10-10", status: "scheduled"},
    ],
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

test("cancelling a Smuggle restores the lower-level announcement and host choices", () => {
  const guest = {
    id: "guest-stage",
    campaignId: "guest",
    campaignName: "Ladies Bunco Night",
    campaignLevel: 4,
    playType: "Stage Announcement",
    resourceId: "stage-announcement",
    scheduledDate: "2026-10-11",
    status: "conflict",
  };
  const host = {
    id: "host-stage",
    campaignId: "host",
    campaignName: "Big Small Group Relaunch",
    campaignLevel: 1,
    playType: "Stage Announcement",
    resourceId: "stage-announcement",
    scheduledDate: "2026-10-11",
    supportsSmuggle: true,
    status: "scheduled",
    smuggle: {
      hostCampaignId: "host",
      hostScheduledPlayId: "host-stage",
      beneficiaryCampaignId: "guest",
      beneficiaryName: "Ladies Bunco Night",
      strategy: "SMUGGLE",
    },
  };
  const campaigns = [
    campaign({id: "host", name: "Big Small Group Relaunch", level: 1, eventDate: "2026-10-25"}),
    campaign({id: "guest", name: "Ladies Bunco Night", level: 4, eventDate: "2026-10-20"}),
  ];

  assert.equal(buildSmuggleRelationships({plays: [host, guest], campaigns}).length, 1);
  const restoredHost = cancelSmuggle(host);
  assert.equal(restoredHost.smuggle, null);
  assert.notEqual(restoredHost, host);
  assert.equal(host.smuggle.beneficiaryCampaignId, "guest");
  assert.equal(buildSmuggleRelationships({plays: [restoredHost, guest], campaigns}).length, 0);
  const opportunities = recommendSmuggleOpportunities({
    hostPlays: [restoredHost, guest],
    campaigns,
    now: new Date("2026-10-01T12:00:00-05:00"),
  });
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].beneficiaryScheduledPlayId, guest.id);
});

test("Smuggle offers every eligible Level 1 through Level 3 host promotion", () => {
  const host = (level, resourceId, suffix) => ({
    id: `host-${suffix}`,
    campaignId: `campaign-${suffix}`,
    campaignName: `Host ${suffix}`,
    campaignLevel: level,
    playType: resourceId === "stage-announcement" ? "Stage Announcement" : "Social Media Sprinkle",
    channel: "Main channel",
    resourceId,
    scheduledDate: "2026-10-10",
    supportsSmuggle: false,
    status: "scheduled",
    smuggle: null,
  });
  const recommendations = recommendSmuggleOpportunities({
    hostPlays: [
      host(3, "stage-announcement", "l3"),
      host(1, "stage-announcement", "l1"),
      host(2, "stage-announcement", "l2"),
      host(4, "stage-announcement", "l4"),
      {
        id: "guest-stage",
        campaignId: "guest",
        campaignName: "Ladies Bunco Night",
        campaignLevel: 4,
        playType: "Stage Announcement",
        channel: "Sunday / Stage",
        resourceId: "stage-announcement",
        scheduledDate: "2026-10-10",
        status: "conflict",
      },
    ],
    campaigns: [
      campaign({id: "campaign-l1", name: "Level 1 Host", level: 1, eventDate: "2026-11-01"}),
      campaign({id: "campaign-l2", name: "Level 2 Host", level: 2, eventDate: "2026-11-01"}),
      campaign({id: "campaign-l3", name: "Level 3 Host", level: 3, eventDate: "2026-11-01"}),
      campaign({id: "guest", name: "Ladies Bunco Night", level: 4, eventDate: "2026-10-20"}),
    ],
    now: new Date("2026-10-01T12:00:00-05:00"),
  });
  assert.deepEqual(recommendations.map((item) => item.hostCampaignLevel), [1, 2, 3]);
  assert.deepEqual(recommendations.map((item) => item.hostCampaignName), [
    "Level 1 Host",
    "Level 2 Host",
    "Level 3 Host",
  ]);
  assert.ok(recommendations.every((item) => item.beneficiaryScheduledPlayId === "guest-stage"));
});

test("Smuggle only pairs the same announcement type on the same date", () => {
  const recommendations = recommendSmuggleOpportunities({
    hostPlays: [
      {id: "same", campaignId: "l1", campaignName: "Same Day Host", campaignLevel: 1, playType: "Stage Announcement", resourceId: "stage-announcement", scheduledDate: "2026-10-11", supportsSmuggle: true, status: "scheduled", smuggle: null},
      {id: "wrong-date", campaignId: "l2", campaignName: "Wrong Date", campaignLevel: 2, playType: "Stage Announcement", resourceId: "stage-announcement", scheduledDate: "2026-10-18", supportsSmuggle: true, status: "scheduled", smuggle: null},
      {id: "wrong-type", campaignId: "l3", campaignName: "Wrong Type", campaignLevel: 3, playType: "Social Media Sprinkle", resourceId: "social-sprinkle", scheduledDate: "2026-10-11", supportsSmuggle: true, status: "scheduled", smuggle: null},
      {id: "guest-stage", campaignId: "guest", campaignName: "Ladies Bunco Night", campaignLevel: 4, playType: "Stage Announcement", resourceId: "stage-announcement", scheduledDate: "2026-10-11", status: "needs-decision"},
    ],
    campaigns: [
      campaign({id: "l1", name: "Same Day Host", level: 1, eventDate: "2026-11-01"}),
      campaign({id: "l2", name: "Wrong Date", level: 2, eventDate: "2026-11-01"}),
      campaign({id: "l3", name: "Wrong Type", level: 3, eventDate: "2026-11-01"}),
      campaign({id: "guest", name: "Ladies Bunco Night", level: 4, eventDate: "2026-10-20"}),
    ],
    now: new Date("2026-10-01T12:00:00-05:00"),
  });
  assert.deepEqual(recommendations.map((item) => item.hostScheduledPlayId), ["same"]);
  assert.equal(recommendations[0].scheduledDate, "2026-10-11");
  assert.equal(recommendations[0].beneficiaryPlayType, "Stage Announcement");
});

test("declining a Smuggle skips only that announcement and clears its conflict", () => {
  const guest = {
    id: "guest-stage",
    campaignId: "guest",
    campaignName: "Ladies Bunco Night",
    campaignLevel: 4,
    playType: "Stage Announcement",
    resourceId: "stage-announcement",
    scheduledDate: "2026-10-11",
    status: "conflict",
    conflictState: "capacity-overflow",
    conflictReason: "The stage announcement capacity is full.",
    manuallyAdjusted: false,
  };
  const skipped = skipPromotion(guest);

  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.conflictState, "none");
  assert.equal(skipped.conflictReason, "");
  assert.equal(skipped.manuallyAdjusted, true);
  assert.equal(guest.status, "conflict");
  assert.equal(recommendSmuggleOpportunities({
    hostPlays: [
      {id: "host", campaignId: "l1", campaignName: "Host", campaignLevel: 1, playType: "Stage Announcement", resourceId: "stage-announcement", scheduledDate: "2026-10-11", supportsSmuggle: true, status: "scheduled", smuggle: null},
      skipped,
    ],
    campaigns: [
      campaign({id: "l1", name: "Host", level: 1, eventDate: "2026-10-20"}),
      campaign({id: "guest", name: "Ladies Bunco Night", level: 4, eventDate: "2026-10-20"}),
    ],
    now: new Date("2026-10-01T12:00:00-05:00"),
  }).length, 0);
  assert.equal(scheduleSummary([skipped]).conflicts, 0);
});

test("saved Smuggle maps resolve into host and guest display relationships", () => {
  const relationships = buildSmuggleRelationships({
    campaigns: [
      campaign({id: "host", name: "Big Small Group Relaunch", level: 1}),
      campaign({id: "guest", name: "Ladies Bunco Night", level: 4}),
    ],
    plays: [{
      id: "host-play",
      campaignId: "host",
      campaignName: "Old host name",
      campaignLevel: 1,
      playType: "Stage Announcement",
      channel: "Sunday / Stage",
      scheduledDate: "2026-10-11",
      smuggle: {
        hostCampaignId: "host",
        hostScheduledPlayId: "host-play",
        beneficiaryCampaignId: "guest",
        beneficiaryName: "Old guest name",
        strategy: "SMUGGLE",
      },
    }, {
      id: "guest-stage",
      campaignId: "guest",
      campaignName: "Ladies Bunco Night",
      campaignLevel: 4,
      playType: "Stage Announcement",
      channel: "Sunday / Stage",
      scheduledDate: "2026-10-11",
      status: "conflict",
    }],
  });
  assert.equal(relationships[0].hostCampaignName, "Big Small Group Relaunch");
  assert.equal(relationships[0].beneficiaryName, "Ladies Bunco Night");
  assert.equal(relationships[0].beneficiaryLevel, 4);
  assert.equal(relationships[0].beneficiaryPlayId, "guest-stage");
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

test("regeneration applies the latest playbook while preserving protected history", () => {
  const originalPlaybook = playbook("level-4-standard");
  const original = generateCampaignSchedule({
    campaign: campaign({eventDate: "2026-10-17"}),
    playbook: originalPlaybook,
    generatedAt: new Date("2026-09-01T12:00:00-05:00"),
  });
  const latest = structuredClone(originalPlaybook);
  latest.version = 2;
  latest.weeks[0].plays[0].playType = "Updated Promotion";
  latest.weeks[1].plays.push({
    id: "added-promotion",
    playType: "Added Promotion",
    channel: "Social",
    resourceId: "social-content",
    dayOfWeek: 4,
    eligibleWeekdays: [4],
    lateBehavior: "SKIP",
    requirement: "required",
    supportsSmuggle: false,
  });
  const protectedPlay = {...original.plays[0], manuallyAdjusted: true, scheduledDate: addDays(original.plays[0].scheduledDate, 1)};
  const result = buildCampaignRegeneration({
    campaigns: [original.campaign],
    plays: [protectedPlay, ...original.plays.slice(1)],
    playbooks: [latest],
    capacityRules: [],
    generatedAt: new Date("2026-09-02T12:00:00-05:00"),
  });
  assert.equal(result.campaigns[0].playbookVersion, 2);
  assert.equal(result.plays.find((item) => item.id === protectedPlay.id).scheduledDate, protectedPlay.scheduledDate);
  assert.ok(result.plays.some((item) => item.templatePlayId === "added-promotion"));
  assert.equal(result.summary.preserved, 1);
  assert.equal(result.summary.added, 1);
  const retry = buildCampaignRegeneration({
    campaigns: result.campaigns,
    plays: result.plays,
    playbooks: [latest],
    capacityRules: [],
    generatedAt: new Date("2026-09-02T12:00:00-05:00"),
  });
  assert.equal(retry.summary.added, 0);
  assert.equal(retry.summary.moved, 0);
  assert.equal(retry.summary.removed, 0);
});

test("regeneration clears future Smuggle decisions so new dates can be reviewed", () => {
  const definition = playbook("level-4-standard");
  const host = generateCampaignSchedule({
    campaign: campaign({id: "host", name: "Host", level: 2}),
    playbook: definition,
    generatedAt: new Date("2026-09-01T12:00:00-05:00"),
  });
  const guest = generateCampaignSchedule({
    campaign: campaign({id: "guest", name: "Guest", level: 4}),
    playbook: definition,
    generatedAt: new Date("2026-09-01T12:00:00-05:00"),
  });
  const hostPlay = host.plays[0];
  const guestPlay = guest.plays[0];
  const plays = [
    {...hostPlay, manuallyAdjusted: true, smuggle: {
      hostCampaignId: "host",
      hostScheduledPlayId: hostPlay.id,
      beneficiaryCampaignId: "guest",
      beneficiaryName: "Guest",
      strategy: "SMUGGLE",
    }},
    ...host.plays.slice(1),
    ...guest.plays,
  ];
  const result = buildCampaignRegeneration({
    campaigns: [host.campaign, guest.campaign],
    plays,
    playbooks: [definition],
    capacityRules: [],
    generatedAt: new Date("2026-09-02T12:00:00-05:00"),
  });
  assert.equal(result.summary.smugglesCleared, 1);
  assert.equal(result.plays.find((item) => item.id === hostPlay.id).smuggle, null);
  assert.equal(result.plays.find((item) => item.id === hostPlay.id).manuallyAdjusted, false);
  assert.equal(result.plays.find((item) => item.id === guestPlay.id).status, "scheduled");
});

test("timeliness stores days and weeks late from the rolling campaign window", () => {
  const result = calculateTimeliness({
    eventDate: "2026-10-17",
    durationWeeks: 2,
    submittedAt: "2026-10-14T10:00:00-05:00",
  });
  assert.equal(result.recommendedStartDate, "2026-10-03");
  assert.equal(result.daysLate, 11);
  assert.equal(result.weeksLate, 1);
});
