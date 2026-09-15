import assert from "node:assert/strict";
import test from "node:test";

import {buildOccurrencePlan, buildSeriesPlan, skipOccurrencePlan} from "../src/planner/series.js";

const generatedAt = new Date("2026-09-01T12:00:00-05:00");

function playbook(overrides = {}) {
  return {
    id: "monthly-events",
    level: 4,
    version: 3,
    durationWeeks: 1,
    campaignType: "standard",
    weeks: [{
      weekNumber: 1,
      phase: "Invitation",
      plays: [{id: "social", playType: "Social Post", channel: "Social", resourceId: "level-4-social", dayOfWeek: 1, eligibleWeekdays: [1], lateBehavior: "SKIP"}],
    }],
    ...overrides,
  };
}

function series(overrides = {}) {
  return {
    id: "women_monthly",
    name: "Women's Gathering",
    recurrence: {
      frequency: "monthly",
      interval: 1,
      startDate: "2026-10-15",
      endType: "count",
      count: 3,
      until: "",
      weekdays: [4],
      monthlyMode: "date",
      monthDay: 15,
      ordinals: [3],
      missingDate: "skip",
    },
    playbookId: "monthly-events",
    playbookVersion: 3,
    level: 4,
    campaignType: "standard",
    submittedAt: "2026-09-01T15:00:00.000Z",
    sourceEventId: "pco-55",
    eventDetails: "Monthly connection and teaching.",
    sampleAnnouncement: "Join us this month.",
    notes: "Keep the invitation warm.",
    deadlineOffsetDays: null,
    status: "active",
    revision: 1,
    ...overrides,
  };
}

test("series creates deterministic occurrence campaigns and schedules each playbook backward from its event", () => {
  const plan = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  assert.deepEqual(plan.campaigns.map((campaign) => campaign.id), [
    "women_monthly_2026-10-15",
    "women_monthly_2026-11-15",
    "women_monthly_2026-12-15",
  ]);
  assert.deepEqual(plan.campaigns.map((campaign) => campaign.eventDate), ["2026-10-15", "2026-11-15", "2026-12-15"]);
  assert.deepEqual(plan.campaigns.map((campaign) => campaign.registrationDeadline), ["", "", ""]);
  assert.deepEqual(plan.plays.map((play) => play.originalScheduledDate), ["2026-10-12", "2026-11-09", "2026-12-14"]);
  assert.ok(plan.plays.every((play) => play.seriesId === undefined));
  assert.equal(plan.summary.occurrences, 3);
  assert.equal(plan.summary.promotions, 3);
  assert.deepEqual(plan.expectedCampaigns, []);
  assert.deepEqual(plan.expectedPlays, []);
});

test("retries are deterministic and produce no campaign or play writes", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const retry = buildSeriesPlan({
    series: series(),
    playbook: playbook(),
    campaigns: first.campaigns,
    plays: first.plays,
    generatedAt,
  });
  assert.deepEqual(retry.campaigns, []);
  assert.deepEqual(retry.plays, []);
});

test("future edits preserve history, protected plays, and explicit occurrence exceptions", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const pastCampaign = {...first.campaigns[0], eventDate: "2026-08-15", occurrenceKey: "2026-08-15", id: "women_monthly_2026-08-15"};
  const pastPlay = {...first.plays[0], campaignId: pastCampaign.id, id: `${pastCampaign.id}_social_1`, scheduledDate: "2026-08-10", originalScheduledDate: "2026-08-10", status: "completed"};
  const exception = {...first.campaigns[1], eventDate: "2026-11-22", recurrenceException: true, name: "Thanksgiving Gathering"};
  const protectedFuture = {...first.plays[2], manuallyAdjusted: true, scheduledDate: "2026-12-11"};
  const nextSeries = series({
    revision: 2,
    name: "Women's Community",
    recurrence: {...series().recurrence, startDate: "2026-11-15", count: 3, interval: 2},
  });
  const plan = buildSeriesPlan({
    series: nextSeries,
    playbook: playbook(),
    campaigns: [pastCampaign, first.campaigns[0], exception, first.campaigns[2]],
    plays: [pastPlay, first.plays[0], first.plays[1], protectedFuture],
    generatedAt,
    scope: "future",
    fromDate: "2026-11-15",
  });
  assert.ok(!plan.campaigns.some((campaign) => campaign.id === pastCampaign.id));
  assert.ok(!plan.campaigns.some((campaign) => campaign.id === exception.id));
  assert.ok(!plan.plays.some((play) => play.id === pastPlay.id));
  assert.ok(!plan.plays.some((play) => play.id === protectedFuture.id));
  assert.ok(plan.campaigns.some((campaign) => campaign.occurrenceKey === "2027-01-15"));
  assert.ok(plan.campaigns.some((campaign) => campaign.occurrenceKey === "2027-03-15"));
  assert.ok(plan.campaigns.some((campaign) => campaign.occurrenceKey === "2026-12-15" && campaign.status === "archived"));
  assert.ok(plan.expectedCampaigns.some((campaign) => campaign.occurrenceKey === "2026-12-15"));
  assert.ok(plan.summary.preserved >= 2);
});

test("removed future occurrences archive and skip mutable promotions without deleting history", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const shorter = series({revision: 2, recurrence: {...series().recurrence, count: 1}});
  const plan = buildSeriesPlan({series: shorter, playbook: playbook(), campaigns: first.campaigns, plays: first.plays, generatedAt});
  assert.equal(plan.campaigns.filter((campaign) => campaign.status === "archived").length, 2);
  assert.equal(plan.plays.filter((play) => play.status === "skipped").length, 2);
  assert.equal(plan.summary.skipped, 2);
  assert.equal(plan.expectedCampaigns.length, 3);
  assert.equal(plan.expectedPlays.length, 2);
});

test("ending a series archives future occurrences while preserving completed promotion history", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const completed = {...first.plays[1], status: "completed"};
  const plan = buildSeriesPlan({
    series: series({status: "ended", revision: 2}),
    playbook: playbook(),
    campaigns: first.campaigns,
    plays: [first.plays[0], completed, first.plays[2]],
    generatedAt,
    scope: "future",
    fromDate: "2026-11-15",
  });
  assert.deepEqual(plan.campaigns.map((campaign) => campaign.occurrenceKey), ["2026-11-15", "2026-12-15"]);
  assert.ok(plan.campaigns.every((campaign) => campaign.status === "archived"));
  assert.ok(!plan.plays.some((play) => play.id === completed.id));
  assert.equal(plan.summary.preserved, 1);
  assert.equal(plan.summary.skipped, 1);
});

test("one occurrence may move while its immutable occurrence key and original play date remain", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const originalPlay = first.plays[0];
  const plan = buildOccurrencePlan({
    campaign,
    updates: {eventDate: "2026-10-22", name: "Women's Gathering Special", deadlineOffsetDays: 1},
    playbook: playbook(),
    campaigns: first.campaigns,
    plays: first.plays,
    generatedAt,
  });
  assert.equal(plan.campaigns[0].id, campaign.id);
  assert.equal(plan.campaigns[0].occurrenceKey, "2026-10-15");
  assert.equal(plan.campaigns[0].eventDate, "2026-10-22");
  assert.equal(plan.campaigns[0].registrationDeadline, "2026-10-21");
  assert.equal(plan.campaigns[0].recurrenceException, true);
  const moved = plan.plays.find((play) => play.id === originalPlay.id);
  assert.equal(moved.originalScheduledDate, originalPlay.originalScheduledDate);
  assert.equal(moved.scheduledDate, "2026-10-19");
  assert.equal(moved.manuallyAdjusted, true);
});

test("skipping an occurrence keeps completed and past plays but marks mutable future plays skipped", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const future = first.plays[0];
  const completed = {...future, id: `${future.id}_completed`, status: "completed"};
  const plan = skipOccurrencePlan({campaign, plays: [future, completed], generatedAt});
  assert.equal(plan.campaigns[0].status, "archived");
  assert.equal(plan.campaigns[0].recurrenceException, true);
  assert.equal(plan.plays.length, 1);
  assert.equal(plan.plays[0].id, future.id);
  assert.equal(plan.plays[0].status, "skipped");
  assert.equal(plan.summary.preserved, 1);
});

test("skipping a Smuggle beneficiary clears its host and stops the beneficiary", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const beneficiary = {...first.plays[0], resourceId: "stage-announcement", playType: "Stage Announcement", scheduledDate: "2026-10-11", originalScheduledDate: "2026-10-11"};
  const host = {
    ...beneficiary,
    id: "host-stage",
    campaignId: "host-campaign",
    campaignName: "Host Campaign",
    campaignLevel: 2,
    smuggle: {
      hostCampaignId: "host-campaign",
      hostScheduledPlayId: "host-stage",
      beneficiaryCampaignId: campaign.id,
      beneficiaryName: campaign.name,
      strategy: "SMUGGLE",
    },
  };
  const plan = skipOccurrencePlan({campaign, plays: [host, beneficiary], generatedAt});
  assert.equal(plan.plays.find((play) => play.id === beneficiary.id).status, "skipped");
  assert.equal(plan.plays.find((play) => play.id === host.id).smuggle, null);
  assert.equal(plan.expectedPlays.length, 2);
  assert.equal(plan.summary.skipped, 1);
});

test("skipping a beneficiary never rewrites a completed Smuggle host", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const beneficiary = {...first.plays[0], resourceId: "stage-announcement", playType: "Stage Announcement", scheduledDate: "2026-10-11", originalScheduledDate: "2026-10-11"};
  const completedHost = {
    ...beneficiary,
    id: "completed-host-stage",
    campaignId: "completed-host-campaign",
    campaignName: "Completed Host",
    campaignLevel: 2,
    status: "completed",
    smuggle: {
      hostCampaignId: "completed-host-campaign",
      hostScheduledPlayId: "completed-host-stage",
      beneficiaryCampaignId: campaign.id,
      beneficiaryName: campaign.name,
      strategy: "SMUGGLE",
    },
  };
  const plan = skipOccurrencePlan({campaign, plays: [completedHost, beneficiary], generatedAt});
  assert.equal(plan.plays.find((play) => play.id === beneficiary.id).status, "skipped");
  assert.ok(!plan.plays.some((play) => play.id === completedHost.id));
  assert.ok(!plan.expectedPlays.some((play) => play.id === completedHost.id));
});

test("skipping a Smuggle host clears the relationship so its beneficiary returns to the normal plan", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const host = {
    ...first.plays[0],
    resourceId: "stage-announcement",
    playType: "Stage Announcement",
    scheduledDate: "2026-10-11",
    originalScheduledDate: "2026-10-11",
    smuggle: {
      hostCampaignId: campaign.id,
      hostScheduledPlayId: first.plays[0].id,
      beneficiaryCampaignId: "beneficiary-campaign",
      beneficiaryName: "Beneficiary",
      strategy: "SMUGGLE",
    },
  };
  const beneficiary = {...host, id: "beneficiary-stage", campaignId: "beneficiary-campaign", campaignName: "Beneficiary", campaignLevel: 4, smuggle: null};
  const plan = skipOccurrencePlan({campaign, plays: [host, beneficiary], generatedAt});
  const skippedHost = plan.plays.find((play) => play.id === host.id);
  assert.equal(skippedHost.status, "skipped");
  assert.equal(skippedHost.smuggle, null);
  assert.ok(!plan.plays.some((play) => play.id === beneficiary.id));
});

test("skipping explicitly stops future manual and locked plays while retaining past and completed records", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const campaign = first.campaigns[0];
  const future = first.plays[0];
  const manual = {...future, id: `${future.id}_manual`, manuallyAdjusted: true};
  const locked = {...future, id: `${future.id}_locked`, locked: true};
  const past = {...future, id: `${future.id}_past`, scheduledDate: "2026-08-31", originalScheduledDate: "2026-08-31"};
  const completed = {...future, id: `${future.id}_completed`, status: "completed"};
  const plan = skipOccurrencePlan({campaign, plays: [manual, locked, past, completed], generatedAt});
  assert.deepEqual(plan.plays.map((play) => play.id).sort(), [locked.id, manual.id].sort());
  assert.ok(plan.plays.every((play) => play.status === "skipped"));
  assert.equal(plan.summary.skipped, 2);
  assert.equal(plan.summary.preserved, 2);
});

test("converting a legacy campaign adopts its campaign and play ids", () => {
  const legacy = {
    id: "legacy-campaign",
    name: "Women's Gathering",
    eventDate: "2026-10-15",
    registrationDeadline: "",
    submittedAt: "2026-09-01T15:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
    playbookId: "monthly-events",
    playbookVersion: 3,
  };
  const legacyPlay = {
    id: "legacy-campaign_social_1",
    campaignId: legacy.id,
    campaignName: legacy.name,
    campaignLevel: 4,
    campaignType: "standard",
    playbookId: "monthly-events",
    playbookVersion: 3,
    templatePlayId: "social",
    weekNumber: 1,
    phase: "Invitation",
    playType: "Social Post",
    channel: "Social",
    resourceId: "level-4-social",
    originalScheduledDate: "2026-10-12",
    scheduledDate: "2026-10-12",
    eligibleWeekdays: [1],
    status: "scheduled",
    source: "campaign-generation",
    manuallyAdjusted: false,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    lateReason: "",
    smuggle: null,
  };
  const plan = buildSeriesPlan({series: series(), playbook: playbook(), campaigns: [legacy], plays: [legacyPlay], generatedAt, seedCampaignId: legacy.id});
  assert.ok(plan.campaigns.some((campaign) => campaign.id === legacy.id && campaign.occurrenceKey === legacy.eventDate));
  assert.ok(!plan.campaigns.some((campaign) => campaign.id === "women_monthly_2026-10-15"));
  assert.ok(!plan.plays.some((play) => play.id === "women_monthly_2026-10-15_social_1"));
  assert.ok(plan.expectedCampaigns.some((campaign) => campaign.id === legacy.id));
  assert.throws(() => buildSeriesPlan({
    series: series({recurrence: {...series().recurrence, startDate: "2026-11-15"}}),
    playbook: playbook(),
    campaigns: [legacy],
    plays: [legacyPlay],
    generatedAt,
    seedCampaignId: legacy.id,
  }), /start on and include/);
});

test("capacity allocation reserves protected records and writes affected unrelated plays", () => {
  const existingCampaign = {
    id: "protected-campaign",
    name: "Protected Event",
    eventDate: "2026-10-20",
    submittedAt: "2026-08-01T12:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
  };
  const protectedPlay = {
    id: "protected-social",
    campaignId: existingCampaign.id,
    campaignName: existingCampaign.name,
    campaignLevel: 4,
    resourceId: "level-4-social",
    originalScheduledDate: "2026-10-12",
    scheduledDate: "2026-10-16",
    status: "rescheduled",
    manuallyAdjusted: true,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    smuggle: null,
  };
  const secondCampaign = {...existingCampaign, id: "unrelated", name: "Unrelated"};
  const secondPlay = {...protectedPlay, id: "unrelated-social", campaignId: secondCampaign.id, campaignName: secondCampaign.name, scheduledDate: "2026-10-12", manuallyAdjusted: false};
  const oneDate = series({recurrence: {...series().recurrence, count: 1}});
  const plan = buildSeriesPlan({
    series: oneDate,
    playbook: playbook(),
    campaigns: [existingCampaign, secondCampaign],
    plays: [protectedPlay, secondPlay],
    capacityRules: [],
    generatedAt,
  });
  assert.ok(!plan.plays.some((play) => play.id === protectedPlay.id));
  assert.ok(plan.plays.some((play) => play.id === secondPlay.id));
  assert.ok(plan.plays.some((play) => play.id === secondPlay.id && play.status === "conflict"));
  assert.ok(plan.conflicts[0].involvesProtected);
  assert.deepEqual(plan.conflicts[0].protectedPlayIds, [protectedPlay.id]);
});

test("a protected Level 4 move reserves its actual week and actual slot", () => {
  const protectedCampaign = {
    id: "moved-campaign",
    name: "Moved Campaign",
    eventDate: "2026-10-30",
    submittedAt: "2026-08-01T12:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
  };
  const protectedPlay = {
    id: "moved-social",
    campaignId: protectedCampaign.id,
    campaignName: protectedCampaign.name,
    campaignLevel: 4,
    resourceId: "level-4-social",
    originalScheduledDate: "2026-10-12",
    scheduledDate: "2026-10-19",
    status: "rescheduled",
    manuallyAdjusted: true,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    smuggle: null,
  };
  const nextSeries = series({
    recurrence: {...series().recurrence, startDate: "2026-10-24", monthDay: 24, count: 1},
  });
  const plan = buildSeriesPlan({series: nextSeries, playbook: playbook(), campaigns: [protectedCampaign], plays: [protectedPlay], generatedAt});
  const generated = plan.plays.find((play) => play.campaignId === "women_monthly_2026-10-24");
  assert.equal(generated.originalScheduledDate, "2026-10-19");
  assert.equal(generated.scheduledDate, "2026-10-23");
  assert.equal(plan.conflicts.length, 0);
});

test("default future edits preserve past and completed campaign records and remain retry safe", () => {
  const initial = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const completedFuture = {...initial.campaigns[1], status: "completed", name: "Completed Name"};
  const currentCampaigns = [initial.campaigns[0], completedFuture, initial.campaigns[2]];
  const edit = buildSeriesPlan({
    series: series({revision: 2, name: "Current Series Name"}),
    playbook: playbook(),
    campaigns: currentCampaigns,
    plays: initial.plays,
    generatedAt: new Date("2026-11-01T12:00:00-06:00"),
  });
  assert.equal(edit.fromDate, "2026-11-01");
  assert.equal(edit.series.saveFromDate, "2026-11-01");
  assert.ok(!edit.campaigns.some((campaign) => campaign.id === initial.campaigns[0].id));
  assert.ok(!edit.campaigns.some((campaign) => campaign.id === completedFuture.id));
  const appliedCampaigns = currentCampaigns.map((campaign) => edit.campaigns.find((item) => item.id === campaign.id) || campaign);
  const appliedPlays = initial.plays.map((play) => edit.plays.find((item) => item.id === play.id) || play);
  const retry = buildSeriesPlan({series: edit.series, playbook: playbook(), campaigns: appliedCampaigns, plays: appliedPlays, generatedAt: new Date("2026-11-01T12:00:00-06:00")});
  assert.ok(!retry.campaigns.some((campaign) => campaign.id === initial.campaigns[0].id));
  assert.ok(!retry.campaigns.some((campaign) => campaign.id === completedFuture.id));
});

test("a past seed campaign is adopted without rewriting its status, copy, or play history", () => {
  const initial = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const seed = {...initial.campaigns[0], seriesId: undefined, occurrenceKey: undefined, seriesRevision: undefined, recurrenceException: undefined, status: "completed", name: "Legacy Name", eventDetails: "Legacy copy"};
  const seedPlay = {...initial.plays[0], status: "completed"};
  const plan = buildSeriesPlan({
    series: series({name: "New Series Name"}),
    playbook: playbook(),
    campaigns: [seed],
    plays: [seedPlay],
    generatedAt: new Date("2026-11-01T12:00:00-06:00"),
    seedCampaignId: seed.id,
  });
  const adopted = plan.campaigns.find((campaign) => campaign.id === seed.id);
  assert.equal(adopted.status, "completed");
  assert.equal(adopted.name, "Legacy Name");
  assert.equal(adopted.eventDetails, "Legacy copy");
  assert.equal(adopted.seriesId, "women_monthly");
  assert.ok(!plan.plays.some((play) => play.id === seedPlay.id));
});

test("persisted seed provenance does not rerun adoption validation on future edits or End", () => {
  const legacy = {
    id: "legacy-seed",
    name: "Legacy Seed",
    eventDate: "2026-10-15",
    submittedAt: "2026-09-01T15:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
    playbookId: "monthly-events",
    playbookVersion: 3,
  };
  const converted = buildSeriesPlan({series: series(), playbook: playbook(), campaigns: [legacy], generatedAt, seedCampaignId: legacy.id});
  const linkedSeed = converted.campaigns.find((campaign) => campaign.id === legacy.id);
  const futureSeries = series({revision: 2, recurrence: {...series().recurrence, startDate: "2026-11-15", count: 2}});
  assert.doesNotThrow(() => buildSeriesPlan({
    series: futureSeries,
    playbook: playbook(),
    campaigns: converted.campaigns,
    plays: converted.plays,
    generatedAt,
    fromDate: "2026-11-15",
    seedCampaignId: legacy.id,
  }));
  const ended = buildSeriesPlan({
    series: {...futureSeries, status: "ended", revision: 3},
    playbook: playbook(),
    campaigns: converted.campaigns,
    plays: converted.plays,
    generatedAt,
    fromDate: "2026-11-15",
    seedCampaignId: legacy.id,
  });
  assert.equal(ended.seedCampaignId, legacy.id);
  assert.ok(!ended.campaigns.some((campaign) => campaign.id === linkedSeed.id));
});

test("automatic recurrence removals revive when their dates return", () => {
  const initial = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const shorter = buildSeriesPlan({series: series({revision: 2, recurrence: {...series().recurrence, count: 1}}), playbook: playbook(), campaigns: initial.campaigns, plays: initial.plays, generatedAt});
  const shortenedCampaigns = initial.campaigns.map((campaign) => shorter.campaigns.find((item) => item.id === campaign.id) || campaign);
  const shortenedPlays = initial.plays.map((play) => shorter.plays.find((item) => item.id === play.id) || play);
  const restored = buildSeriesPlan({series: series({revision: 3}), playbook: playbook(), campaigns: shortenedCampaigns, plays: shortenedPlays, generatedAt});
  const restoredKeys = new Set(restored.campaigns.filter((campaign) => campaign.status === "active").map((campaign) => campaign.occurrenceKey));
  assert.ok(restoredKeys.has("2026-11-15"));
  assert.ok(restoredKeys.has("2026-12-15"));
  assert.ok(restored.plays.filter((play) => ["2026-11-09", "2026-12-14"].includes(play.originalScheduledDate)).every((play) => play.status !== "skipped"));
});

test("ending includes future occurrence exceptions and persists its cutoff for retries", () => {
  const initial = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const exception = {...initial.campaigns[1], recurrenceException: true, eventDate: "2026-11-22"};
  const manual = {...initial.plays[1], manuallyAdjusted: true, scheduledDate: "2026-11-20"};
  const ended = buildSeriesPlan({
    series: series({status: "ended", revision: 2}),
    playbook: playbook(),
    campaigns: [initial.campaigns[0], exception, initial.campaigns[2]],
    plays: [initial.plays[0], manual, initial.plays[2]],
    generatedAt,
    fromDate: "2026-11-15",
  });
  assert.equal(ended.fromDate, "2026-11-15");
  assert.equal(ended.series.saveFromDate, "2026-11-15");
  assert.ok(ended.campaigns.some((campaign) => campaign.id === exception.id && campaign.status === "archived"));
  assert.equal(ended.plays.find((play) => play.id === manual.id).status, "skipped");
  const appliedCampaigns = [initial.campaigns[0], exception, initial.campaigns[2]].map((campaign) => ended.campaigns.find((item) => item.id === campaign.id) || campaign);
  const appliedPlays = [initial.plays[0], manual, initial.plays[2]].map((play) => ended.plays.find((item) => item.id === play.id) || play);
  const retry = buildSeriesPlan({series: ended.series, playbook: playbook(), campaigns: appliedCampaigns, plays: appliedPlays, generatedAt});
  assert.equal(retry.fromDate, "2026-11-15");
  assert.ok(!retry.campaigns.some((campaign) => campaign.occurrenceKey === "2026-10-15"));
});

test("series plan requires the exact pinned playbook version", () => {
  assert.throws(() => buildSeriesPlan({series: series(), playbook: playbook({version: 4}), generatedAt}), /version 3/);
});

test("series edits never downgrade an occurrence advanced by global regeneration", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const advancedCampaign = {...first.campaigns[1], playbookVersion: 4};
  const advancedPlay = {...first.plays[1], playbookVersion: 4, playType: "Version 4 Social"};
  const plan = buildSeriesPlan({
    series: series({revision: 2, name: "Women's Community"}),
    playbook: playbook(),
    campaigns: [first.campaigns[0], advancedCampaign, first.campaigns[2]],
    plays: [first.plays[0], advancedPlay, first.plays[2]],
    generatedAt,
  });
  assert.ok(!plan.campaigns.some((campaign) => campaign.id === advancedCampaign.id));
  assert.ok(!plan.plays.some((play) => play.id === advancedPlay.id));
  assert.ok(plan.summary.preserved >= 2);
});

test("occurrence edits derive and preserve a persisted registration deadline offset", () => {
  const first = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const persisted = {...first.campaigns[0], registrationDeadline: "2026-10-10"};
  delete persisted.deadlineOffsetDays;
  const plan = buildOccurrencePlan({
    campaign: persisted,
    updates: {eventDate: "2026-10-22"},
    playbook: playbook(),
    campaigns: [persisted],
    plays: [first.plays[0]],
    generatedAt,
  });
  assert.equal(plan.campaigns[0].registrationDeadline, "2026-10-17");
  assert.equal(plan.campaigns[0].deadlineOffsetDays, 5);
});
