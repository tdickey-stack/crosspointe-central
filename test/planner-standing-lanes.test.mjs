import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  buildCampaignRegeneration,
  generateCampaignSchedule,
  planningWeekRange,
  startOfPlanningWeek,
  utilizationForWeek,
  withLevel2StandingLane,
} from "../src/planner/domain.js";
import {buildPromotionBrief} from "../src/planner/briefs.js";
import {buildOccurrencePlan, buildSeriesPlan} from "../src/planner/series.js";

const NOW = new Date("2026-10-05T12:00:00-05:00");

function templatePlay({
  id = "weekly-newsletter",
  playType = "Newsletter Feature",
  channel = "Newsletter",
  resourceId = "newsletter-feature",
  dayOfWeek = 3,
  supportsSmuggle = false,
} = {}) {
  return {
    id,
    playType,
    channel,
    resourceId,
    dayOfWeek,
    eligibleWeekdays: [dayOfWeek],
    requirement: "required",
    lateBehavior: "SKIP",
    supportsSmuggle,
  };
}

function ongoingPlaybook({
  id = "level-2-ongoing-awareness",
  version = 1,
  plays = [templatePlay()],
} = {}) {
  return {
    id,
    level: 2,
    name: id === "level-2-ongoing-interest"
      ? "Level 2 Ongoing Interest"
      : "Level 2 Ongoing Awareness",
    campaignType: id === "level-2-ongoing-interest"
      ? "ongoing-interest"
      : "ongoing-awareness",
    durationWeeks: 1,
    version,
    active: true,
    weeks: [{weekNumber: 1, phase: "Awareness", label: "Weekly presence", plays}],
  };
}

function workspace(overrides = {}) {
  const playbook = ongoingPlaybook();
  return {
    campaigns: [],
    playbooks: [playbook],
    standingLanes: [{
      id: "level-2-weekly",
      level: 2,
      cadence: "weekly",
      fallbackPlaybookId: playbook.id,
      active: true,
    }],
    scheduledPlays: [],
    capacityRules: [],
    ...overrides,
  };
}

function campaignPlay({
  id = "event-play",
  campaignId = "event-campaign",
  campaignName = "Starting Pointe",
  campaignLevel = 2,
  scheduledDate = "2026-10-07",
  status = "scheduled",
  resourceId = "newsletter-feature",
  playType = "Newsletter Feature",
} = {}) {
  return {
    id,
    campaignId,
    campaignName,
    campaignLevel,
    campaignType: "event-based",
    playbookId: `level-${campaignLevel}-event`,
    playbookVersion: 1,
    templatePlayId: `${id}-template`,
    weekNumber: 1,
    phase: "Awareness",
    playType,
    channel: "Newsletter",
    resourceId,
    originalScheduledDate: scheduledDate,
    scheduledDate,
    eligibleWeekdays: [3],
    requirement: "required",
    lateBehavior: "SKIP",
    status,
    source: "campaign-generation",
    manuallyAdjusted: false,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    lateReason: "",
    supportsSmuggle: false,
    smuggle: null,
  };
}

function standingPlays(result) {
  return result.scheduledPlays.filter((play) => play.source === "standing-lane");
}

function eventPlaybook(level = 3) {
  return {
    id: `level-${level}-weekly-event`,
    level,
    version: 1,
    durationWeeks: 1,
    campaignType: "event-based",
    active: true,
    weeks: [{
      weekNumber: 1,
      phase: "Awareness",
      label: "Weekly event",
      plays: [templatePlay({id: "event-newsletter"})],
    }],
  };
}

function eventSeries(level = 3) {
  return {
    id: `level_${level}_series`,
    name: `Level ${level} Series`,
    recurrence: {
      frequency: "monthly",
      interval: 1,
      startDate: "2026-10-15",
      endType: "count",
      count: 1,
      until: "",
      weekdays: [4],
      monthlyMode: "date",
      monthDay: 15,
      ordinals: [3],
      missingDate: "skip",
    },
    playbookId: eventPlaybook(level).id,
    playbookVersion: 1,
    level,
    campaignType: "event-based",
    submittedAt: "2026-09-01T15:00:00.000Z",
    sourceEventId: "",
    eventDetails: "",
    sampleAnnouncement: "",
    notes: "",
    deadlineOffsetDays: null,
    status: "active",
    revision: 1,
  };
}

function newsletterCapacityRule() {
  return {
    id: "newsletter-feature",
    name: "Newsletter Feature",
    channel: "Newsletter",
    capacity: 1,
    typicalCapacity: 1,
    capacityPeriod: "week",
    allowedWeekdays: [3],
    perCampaignMaximum: 1,
    eligibleLevels: [1, 2, 3, 4],
    autoResolve: false,
    supportsSmuggle: false,
    allocationStrategy: "creative-decision",
    showOnDashboard: true,
    active: true,
  };
}

function playsInWeek(plays, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  return plays.filter((play) =>
    play.scheduledDate >= weekStart && play.scheduledDate <= weekEnd);
}

test("an empty live workspace derives every current and future fallback week in the default horizon", () => {
  const raw = workspace();
  const result = withLevel2StandingLane(raw, {now: NOW});
  const currentWeek = startOfPlanningWeek(NOW);
  const horizonEnd = addDays(NOW, 400);
  const expectedWeeks = [];
  for (let week = currentWeek; week <= horizonEnd; week = addDays(week, 7)) {
    expectedWeeks.push(week);
  }

  assert.deepEqual(result.storedScheduledPlays, raw.scheduledPlays);
  assert.equal(standingPlays(result).length, expectedWeeks.length);
  expectedWeeks.forEach((week) => {
    assert.equal(playsInWeek(standingPlays(result), week).length, 1, week);
  });
  assert.equal(
    standingPlays(result).some((play) => play.scheduledDate < currentWeek),
    false,
  );
});

test("actual Level 2 promotions suppress only their scheduled week and follow a manual move", () => {
  const weekOne = "2026-10-05";
  const weekTwo = addDays(weekOne, 7);
  const weekThree = addDays(weekTwo, 7);
  const initial = campaignPlay({scheduledDate: addDays(weekTwo, 2)});
  const first = withLevel2StandingLane(workspace({scheduledPlays: [initial]}), {now: NOW});

  assert.equal(playsInWeek(standingPlays(first), weekOne).length, 1);
  assert.equal(playsInWeek(standingPlays(first), weekTwo).length, 0);
  assert.equal(playsInWeek(standingPlays(first), weekThree).length, 1);

  const moved = {
    ...initial,
    scheduledDate: addDays(weekThree, 2),
    status: "rescheduled",
    manuallyAdjusted: true,
  };
  const second = withLevel2StandingLane(workspace({scheduledPlays: [moved]}), {now: NOW});

  assert.equal(playsInWeek(standingPlays(second), weekTwo).length, 1);
  assert.equal(playsInWeek(standingPlays(second), weekThree).length, 0);
});

test("non-Level 2 promotions and hidden Level 2 promotions do not cover the lane", () => {
  const weekStart = startOfPlanningWeek(NOW);
  const scheduledDate = addDays(weekStart, 2);
  const result = withLevel2StandingLane(workspace({
    scheduledPlays: [
      campaignPlay({id: "level-3", campaignId: "level-3", campaignLevel: 3, scheduledDate}),
      campaignPlay({id: "skipped-level-2", campaignId: "skipped-level-2", scheduledDate, status: "skipped"}),
      campaignPlay({id: "missed-level-2", campaignId: "missed-level-2", scheduledDate, status: "missed"}),
    ],
  }), {now: NOW});

  assert.equal(playsInWeek(standingPlays(result), weekStart).length, 1);
});

test("saved manual, status, and Smuggle decisions override a generated play without duplication", () => {
  const raw = workspace({
    playbooks: [ongoingPlaybook({plays: [
      templatePlay({supportsSmuggle: true}),
      templatePlay({
        id: "weekly-slide",
        playType: "Pre-Service Slide",
        channel: "Sunday / Screens",
        resourceId: "pre-service-slide",
        dayOfWeek: 0,
      }),
    ]})],
  });
  const generated = withLevel2StandingLane(raw, {now: NOW});
  const newsletter = standingPlays(generated)
    .find((play) => play.templatePlayId === "weekly-newsletter");
  const slide = standingPlays(generated)
    .find((play) => play.templatePlayId === "weekly-slide");
  const savedNewsletter = {
    ...newsletter,
    scheduledDate: addDays(newsletter.scheduledDate, 1),
    status: "rescheduled",
    manuallyAdjusted: true,
    smuggle: {
      hostCampaignId: newsletter.campaignId,
      hostScheduledPlayId: newsletter.id,
      beneficiaryCampaignId: "level-4-campaign",
      beneficiaryName: "Women's Breakfast",
      strategy: "SMUGGLE",
    },
  };
  const savedSlide = {...slide, status: "skipped", manuallyAdjusted: true};
  const withOverrides = withLevel2StandingLane({
    ...raw,
    scheduledPlays: [savedNewsletter, savedSlide],
  }, {now: NOW});

  assert.deepEqual(withOverrides.storedScheduledPlays, [savedNewsletter, savedSlide]);
  assert.equal(withOverrides.scheduledPlays.filter((play) => play.id === newsletter.id).length, 1);
  assert.equal(withOverrides.scheduledPlays.filter((play) => play.id === slide.id).length, 1);
  assert.equal(withOverrides.scheduledPlays.find((play) => play.id === newsletter.id).scheduledDate,
    savedNewsletter.scheduledDate);
  assert.equal(withOverrides.scheduledPlays.find((play) => play.id === newsletter.id).status,
    "rescheduled");
  assert.deepEqual(withOverrides.scheduledPlays.find((play) => play.id === newsletter.id).smuggle,
    savedNewsletter.smuggle);
  assert.equal(withOverrides.scheduledPlays.find((play) => play.id === slide.id).status,
    "skipped");
});

test("inactive lanes and unavailable fallback playbooks do not synthesize promotions", () => {
  const inactive = workspace();
  inactive.standingLanes[0].active = false;
  assert.equal(standingPlays(withLevel2StandingLane(inactive, {now: NOW})).length, 0);

  const missing = workspace({playbooks: []});
  assert.equal(standingPlays(withLevel2StandingLane(missing, {now: NOW})).length, 0);

  const disabledPlaybook = workspace();
  disabledPlaybook.playbooks[0].active = false;
  assert.equal(standingPlays(withLevel2StandingLane(disabledPlaybook, {now: NOW})).length, 0);
});

test("switching fallback playbooks hides obsolete future overrides but retains completed and past history", () => {
  const awareness = workspace();
  const initiallyProjected = withLevel2StandingLane(awareness, {
    now: new Date("2026-01-05T12:00:00-06:00"),
  });
  const awarenessPlays = standingPlays(initiallyProjected);
  const past = awarenessPlays.find((play) => play.scheduledDate < "2026-02-02");
  const obsoleteFuture = awarenessPlays.find((play) => play.scheduledDate >= "2026-03-02");
  const completedFutureSource = awarenessPlays.find((play) =>
    play.id !== obsoleteFuture.id && play.scheduledDate >= "2026-03-02");
  const completedFuture = {...completedFutureSource, status: "completed"};
  const interest = ongoingPlaybook({
    id: "level-2-ongoing-interest",
    plays: [templatePlay({
      id: "interest-stage",
      playType: "Stage Announcement",
      channel: "Sunday / Stage",
      resourceId: "stage-announcement",
      dayOfWeek: 0,
    })],
  });
  const switched = withLevel2StandingLane(workspace({
    playbooks: [interest],
    standingLanes: [{
      id: "level-2-weekly",
      level: 2,
      cadence: "weekly",
      fallbackPlaybookId: interest.id,
      active: true,
    }],
    scheduledPlays: [past, obsoleteFuture, completedFuture],
  }), {now: new Date("2026-02-02T12:00:00-06:00")});

  assert.ok(switched.scheduledPlays.some((play) => play.id === past.id));
  assert.ok(switched.scheduledPlays.some((play) => play.id === completedFuture.id));
  assert.equal(switched.scheduledPlays.some((play) => play.id === obsoleteFuture.id), false);
  assert.ok(standingPlays(switched).some((play) =>
    play.playbookId === interest.id && play.templatePlayId === "interest-stage"));
});

test("Central-time Sunday and Monday remain on opposite planning weeks across DST", () => {
  const sunday = withLevel2StandingLane(workspace(), {
    now: new Date("2026-03-08T23:30:00-05:00"),
  });
  const monday = withLevel2StandingLane(workspace(), {
    now: new Date("2026-03-09T00:30:00-05:00"),
  });

  assert.ok(playsInWeek(standingPlays(sunday), "2026-03-02").length > 0);
  assert.equal(playsInWeek(standingPlays(monday), "2026-03-02").length, 0);
  assert.ok(playsInWeek(standingPlays(monday), "2026-03-09").length > 0);
});

test("requested future ranges extend projection beyond the default 400-day horizon", () => {
  const farWeek = "2028-01-03";
  const result = withLevel2StandingLane(workspace(), {
    now: NOW,
    ranges: [{startDate: farWeek, endDate: addDays(farWeek, 6)}],
  });

  assert.equal(playsInWeek(standingPlays(result), farWeek).length, 1);
  assert.equal(
    standingPlays(result).some((play) => play.scheduledDate < startOfPlanningWeek(NOW)),
    false,
  );
});

test("ongoing promotions flow into briefs and effective weekly capacity", () => {
  const week = planningWeekRange(NOW);
  const levelThree = campaignPlay({
    id: "level-3-newsletter",
    campaignId: "level-3-campaign",
    campaignName: "Groups Launch",
    campaignLevel: 3,
    scheduledDate: addDays(week.startDate, 2),
  });
  const raw = workspace({
    campaigns: [{
      id: "level-3-campaign",
      name: "Groups Launch",
      level: 3,
      campaignType: "event-based",
      eventDate: "2026-11-01",
      submittedAt: "2026-09-01T12:00:00.000Z",
      status: "active",
    }],
    scheduledPlays: [levelThree],
    capacityRules: [{
      id: "newsletter-feature",
      name: "Newsletter Feature",
      channel: "Newsletter",
      capacity: 1,
      typicalCapacity: 1,
      capacityPeriod: "week",
      allowedWeekdays: [3],
      perCampaignMaximum: 1,
      eligibleLevels: [1, 2, 3, 4],
      autoResolve: false,
      supportsSmuggle: false,
      allocationStrategy: "creative-decision",
      showOnDashboard: true,
      active: true,
    }],
  });
  const result = withLevel2StandingLane(raw, {now: NOW});
  const fallback = playsInWeek(standingPlays(result), week.startDate)[0];
  const actual = result.scheduledPlays.find((play) => play.id === levelThree.id);
  const utilization = utilizationForWeek({
    weekStart: week.startDate,
    plays: result.scheduledPlays,
    capacityRules: raw.capacityRules,
  });
  const brief = buildPromotionBrief({
    campaigns: result.campaigns,
    scheduledPlays: result.scheduledPlays,
    selectedPlayTypes: ["Newsletter Feature"],
    startDate: week.startDate,
    endDate: week.endDate,
  });

  assert.equal(fallback.status, "scheduled");
  assert.equal(actual.status, "conflict");
  assert.equal(actual.conflictState, "capacity-overflow");
  assert.equal(utilization.find((item) => item.id === "newsletter-feature").used, 2);
  assert.equal(brief.announcementCount, 2);
  assert.ok(brief.entries.some((entry) =>
    entry.id === fallback.campaignId && entry.announcements[0].id === fallback.id));
});

test("series capacity includes ongoing inventory without writing synthetic fallback records", () => {
  const recurring = eventSeries(3);
  const campaignPlaybook = eventPlaybook(3);
  const ongoing = ongoingPlaybook();
  const lane = workspace().standingLanes;
  const plan = buildSeriesPlan({
    series: recurring,
    playbook: campaignPlaybook,
    campaigns: [],
    plays: [],
    capacityRules: [newsletterCapacityRule()],
    standingLanes: lane,
    playbooks: [ongoing, campaignPlaybook],
    generatedAt: NOW,
  });

  assert.equal(plan.plays.length, 1);
  assert.equal(plan.plays[0].campaignLevel, 3);
  assert.equal(plan.plays[0].status, "conflict");
  assert.equal(plan.plays[0].conflictState, "capacity-overflow");
  assert.ok(plan.conflicts.some((conflict) =>
    conflict.recommendedPlayIds.some((id) => id !== plan.plays[0].id)));
  assert.equal(plan.plays.some((play) => play.source === "standing-lane"), false);
  assert.deepEqual(plan.expectedPlays, []);
  assert.deepEqual(plan.expectedWorkspace.plays, []);
});

test("a Level 2 series suppresses fallback capacity and never emits it as a write", () => {
  const recurring = eventSeries(2);
  const campaignPlaybook = eventPlaybook(2);
  const ongoing = ongoingPlaybook();
  const plan = buildSeriesPlan({
    series: recurring,
    playbook: campaignPlaybook,
    campaigns: [],
    plays: [],
    capacityRules: [newsletterCapacityRule()],
    standingLanes: workspace().standingLanes,
    playbooks: [ongoing, campaignPlaybook],
    generatedAt: NOW,
  });

  assert.equal(plan.plays.length, 1);
  assert.equal(plan.plays[0].campaignLevel, 2);
  assert.equal(plan.plays[0].status, "scheduled");
  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.plays.some((play) => play.source === "standing-lane"), false);
  assert.deepEqual(plan.expectedWorkspace.plays, []);
});

test("occurrence edits account for ongoing capacity without adding fallback to writes or baselines", () => {
  const campaignPlaybook = eventPlaybook(3);
  const initial = buildSeriesPlan({
    series: eventSeries(3),
    playbook: campaignPlaybook,
    generatedAt: NOW,
  });
  const campaign = initial.campaigns[0];
  const plan = buildOccurrencePlan({
    campaign,
    updates: {eventDate: "2026-10-22"},
    playbook: campaignPlaybook,
    campaigns: initial.campaigns,
    plays: initial.plays,
    capacityRules: [newsletterCapacityRule()],
    standingLanes: workspace().standingLanes,
    playbooks: [ongoingPlaybook(), campaignPlaybook],
    generatedAt: NOW,
  });

  assert.equal(plan.plays.some((play) => play.source === "standing-lane"), false);
  assert.equal(plan.expectedPlays.some((play) => play.source === "standing-lane"), false);
  assert.equal(plan.expectedWorkspace.plays.some((play) => play.source === "standing-lane"), false);
  const persistedIds = new Set([...plan.plays, ...plan.expectedPlays].map((play) => play.id));
  assert.ok(plan.conflicts.some((conflict) =>
    [...conflict.recommendedPlayIds, ...conflict.overflowPlayIds]
      .some((id) => !persistedIds.has(id))));

  const moved = plan.plays.find((play) => play.campaignId === campaign.id);
  assert.equal(moved.manuallyAdjusted, true);
  const projected = withLevel2StandingLane({
    campaigns: plan.campaigns,
    scheduledPlays: plan.plays,
    capacityRules: [newsletterCapacityRule()],
    standingLanes: workspace().standingLanes,
    playbooks: [ongoingPlaybook(), campaignPlaybook],
  }, {now: NOW});
  assert.equal(projected.scheduledPlays.find((play) => play.id === moved.id).status,
    moved.status);
  assert.ok(projected.scheduledPlays.some((play) =>
    play.source === "standing-lane" &&
    startOfPlanningWeek(play.scheduledDate) === startOfPlanningWeek(moved.scheduledDate) &&
    play.status === "conflict"));
});

test("campaign regeneration uses ongoing capacity but returns only persisted campaign writes", () => {
  const campaignPlaybook = eventPlaybook(3);
  const ongoing = ongoingPlaybook();
  const generated = generateCampaignSchedule({
    campaign: {
      id: "level-3-campaign",
      name: "Groups Launch",
      eventDate: "2026-10-15",
      registrationDeadline: "",
      submittedAt: "2026-09-01T15:00:00.000Z",
      level: 3,
      campaignType: "event-based",
      playbookId: campaignPlaybook.id,
      sourceEventId: "",
      eventDetails: "",
      sampleAnnouncement: "",
      notes: "",
      status: "active",
    },
    playbook: campaignPlaybook,
    generatedAt: NOW,
  });
  const result = buildCampaignRegeneration({
    campaigns: [generated.campaign],
    plays: generated.plays,
    playbooks: [ongoing, campaignPlaybook],
    standingLanes: workspace().standingLanes,
    capacityRules: [newsletterCapacityRule()],
    generatedAt: NOW,
  });

  assert.equal(result.plays.length, 1);
  assert.equal(result.plays[0].campaignId, generated.campaign.id);
  assert.equal(result.plays[0].status, "conflict");
  assert.equal(result.plays.some((play) => play.source === "standing-lane"), false);
  assert.deepEqual(result.writePlayIds, [generated.plays[0].id]);
});
