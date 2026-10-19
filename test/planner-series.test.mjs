import assert from "node:assert/strict";
import test from "node:test";

import {buildCampaignRegeneration} from "../src/planner/domain.js";
import {STARTER_PLAYBOOKS} from "../src/planner/seed-data.js";
import {buildCampaignEditPlan, buildOccurrencePlan, buildSeriesPlan, skipOccurrencePlan} from "../src/planner/series.js";

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

function starterPlaybook(id) {
  return structuredClone(STARTER_PLAYBOOKS.find((item) => item.id === id));
}

function savedCampaign(playbookDefinition, overrides = {}) {
  return {
    id: "saved-campaign",
    name: "Saved Campaign",
    eventDate: "2027-01-31",
    registrationDeadline: "2027-01-24",
    deadlineOffsetDays: 7,
    submittedAt: "2026-08-01T12:00:00.000Z",
    sourceEventId: "pco-form:930568:4455",
    sourceUrl: "https://example.com/source/4455",
    level: playbookDefinition.level,
    campaignType: playbookDefinition.campaignType,
    playbookId: playbookDefinition.id,
    playbookVersion: playbookDefinition.version,
    status: "active",
    ...overrides,
  };
}

function applyWrites(records, writes) {
  const next = new Map(records.map((record) => [record.id, record]));
  writes.forEach((record) => next.set(record.id, record));
  return [...next.values()];
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

test("a protected Level 4 move reserves its actual Monday planning week and slot", () => {
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

test("a protected Sunday manual move consumes capacity in the Monday planning week that contains it", () => {
  const protectedCampaign = {
    id: "protected-sunday-campaign",
    name: "Protected Sunday",
    eventDate: "2026-10-20",
    submittedAt: "2026-08-01T12:00:00.000Z",
    level: 4,
    campaignType: "standard",
    status: "active",
  };
  const protectedPlay = {
    id: "protected-sunday-social",
    campaignId: protectedCampaign.id,
    campaignName: protectedCampaign.name,
    campaignLevel: 4,
    resourceId: "level-4-social",
    originalScheduledDate: "2026-09-28",
    scheduledDate: "2026-10-04",
    status: "rescheduled",
    manuallyAdjusted: true,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    smuggle: null,
  };
  const unrelatedCampaign = {...protectedCampaign, id: "unrelated-monday-campaign", name: "Unrelated Monday"};
  const unrelatedPlay = {
    ...protectedPlay,
    id: "unrelated-monday-social",
    campaignId: unrelatedCampaign.id,
    campaignName: unrelatedCampaign.name,
    scheduledDate: "2026-09-28",
    manuallyAdjusted: false,
  };
  const nextSeries = series({
    recurrence: {...series().recurrence, startDate: "2026-10-04", monthDay: 4, count: 1},
  });
  const plan = buildSeriesPlan({
    series: nextSeries,
    playbook: playbook(),
    campaigns: [protectedCampaign, unrelatedCampaign],
    plays: [protectedPlay, unrelatedPlay],
    generatedAt,
  });
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].period, "2026-09-28");
  assert.equal(plan.conflicts[0].campaignCount, 3);
  assert.equal(plan.conflicts[0].involvesProtected, true);
  assert.deepEqual(plan.conflicts[0].protectedPlayIds, [protectedPlay.id]);
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

function dateEditPlaybook(id) {
  return playbook({
    id,
    level: 3,
    campaignType: "featured",
    durationWeeks: 1,
    weeks: [{
      weekNumber: 1,
      phase: "Invitation",
      plays: [1, 2, 3, 4].map((day) => ({
        id: `day-${day}`,
        playType: `Day ${day} Promotion`,
        channel: `Channel ${day}`,
        resourceId: `date-edit-${day}`,
        dayOfWeek: day,
        eligibleWeekdays: [day],
        lateBehavior: "SKIP",
      })),
    }],
  });
}

function protectedDateEditPlays(initialPlays) {
  const manual = {...initialPlays[0], scheduledDate: "2027-01-29", manuallyAdjusted: true};
  const locked = {...initialPlays[1], locked: true};
  const past = {...initialPlays[2], originalScheduledDate: "2026-08-26", scheduledDate: "2026-08-26"};
  return {
    plays: [manual, locked, past, initialPlays[3]],
    protectedById: new Map([manual, locked, past].map((item) => [item.id, item])),
    automaticId: initialPlays[3].id,
  };
}

function assertProtectedDateEditPlays(plan, appliedPlays, protectedById) {
  protectedById.forEach((expected, id) => {
    assert.ok(!plan.plays.some((play) => play.id === id));
    assert.deepEqual(appliedPlays.find((play) => play.id === id), expected);
  });
}

test("successive event-date edits keep generated promotions automatic and reschedulable", () => {
  const selected = dateEditPlaybook("event-date-edits");
  const original = savedCampaign(selected, {registrationDeadline: "", deadlineOffsetDays: null});
  const initial = buildCampaignEditPlan({campaign: original, playbook: selected, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const {plays: currentPlays, protectedById, automaticId} = protectedDateEditPlays(initial.plays);

  const first = buildCampaignEditPlan({
    campaign: currentCampaign,
    updates: {eventDate: "2027-02-07"},
    playbook: selected,
    campaigns: [currentCampaign],
    plays: currentPlays,
    generatedAt,
  });
  const firstCampaigns = applyWrites([currentCampaign], first.campaigns);
  const firstPlays = applyWrites(currentPlays, first.plays);
  const firstAutomatic = firstPlays.find((play) => play.id === automaticId);
  assert.equal(firstAutomatic.scheduledDate, "2027-02-04");
  assert.equal(firstAutomatic.manuallyAdjusted, false);
  assertProtectedDateEditPlays(first, firstPlays, protectedById);

  const second = buildCampaignEditPlan({
    campaign: firstCampaigns[0],
    updates: {eventDate: "2027-02-14"},
    playbook: selected,
    campaigns: firstCampaigns,
    plays: firstPlays,
    generatedAt,
  });
  const secondPlays = applyWrites(firstPlays, second.plays);
  const secondAutomatic = secondPlays.find((play) => play.id === automaticId);
  assert.equal(secondAutomatic.scheduledDate, "2027-02-11");
  assert.equal(secondAutomatic.manuallyAdjusted, false);
  assertProtectedDateEditPlays(second, secondPlays, protectedById);
});

test("successive promotion-window end edits keep generated promotions automatic and reschedulable", () => {
  const selected = dateEditPlaybook("window-date-edits");
  const original = savedCampaign(selected, {
    scheduleMode: "promotion-window",
    eventDate: "",
    campaignEndDate: "2027-01-31",
    registrationDeadline: "",
    deadlineOffsetDays: null,
  });
  const initial = buildCampaignEditPlan({campaign: original, playbook: selected, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const {plays: currentPlays, protectedById, automaticId} = protectedDateEditPlays(initial.plays);

  const first = buildCampaignEditPlan({
    campaign: currentCampaign,
    updates: {campaignEndDate: "2027-02-07"},
    playbook: selected,
    campaigns: [currentCampaign],
    plays: currentPlays,
    generatedAt,
  });
  const firstCampaigns = applyWrites([currentCampaign], first.campaigns);
  const firstPlays = applyWrites(currentPlays, first.plays);
  const firstAutomatic = firstPlays.find((play) => play.id === automaticId);
  assert.equal(firstAutomatic.scheduledDate, "2027-02-04");
  assert.equal(firstAutomatic.manuallyAdjusted, false);
  assertProtectedDateEditPlays(first, firstPlays, protectedById);

  const second = buildCampaignEditPlan({
    campaign: firstCampaigns[0],
    updates: {campaignEndDate: "2027-02-14"},
    playbook: selected,
    campaigns: firstCampaigns,
    plays: firstPlays,
    generatedAt,
  });
  const secondPlays = applyWrites(firstPlays, second.plays);
  const secondAutomatic = secondPlays.find((play) => play.id === automaticId);
  assert.equal(secondAutomatic.scheduledDate, "2027-02-11");
  assert.equal(secondAutomatic.manuallyAdjusted, false);
  assertProtectedDateEditPlays(second, secondPlays, protectedById);
});

test("campaign edit downgrades Level 4 featured to standard without deleting superseded work", () => {
  const featured = starterPlaybook("level-4-featured");
  const standard = starterPlaybook("level-4-standard");
  const original = savedCampaign(featured);
  const initial = buildCampaignEditPlan({campaign: original, playbook: featured, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const standardPreviewCampaign = {...currentCampaign, level: standard.level, campaignType: standard.campaignType, playbookId: standard.id, playbookVersion: standard.version};
  const standardPreview = buildCampaignEditPlan({campaign: standardPreviewCampaign, playbook: standard, campaigns: [standardPreviewCampaign], generatedAt});
  const equivalentDate = standardPreview.plays.find((play) => play.resourceId === "central-listing").scheduledDate;
  const completedListing = {
    ...initial.plays.find((play) => play.resourceId === "central-listing"),
    originalScheduledDate: equivalentDate,
    scheduledDate: equivalentDate,
    status: "completed",
  };
  const currentPlays = initial.plays.map((play) => play.id === completedListing.id ? completedListing : play);

  const plan = buildCampaignEditPlan({
    campaign: currentCampaign,
    playbook: standard,
    campaigns: [currentCampaign],
    plays: currentPlays,
    generatedAt,
  });

  assert.equal(plan.campaigns[0].level, 4);
  assert.equal(plan.campaigns[0].campaignType, "standard");
  assert.equal(plan.campaigns[0].playbookId, standard.id);
  assert.equal(plan.campaigns[0].playbookVersion, standard.version);
  assert.ok(plan.plays.some((play) => play.playbookId === featured.id && play.status === "skipped"));
  assert.ok(plan.plays.some((play) => play.playbookId === standard.id && play.id.startsWith("saved-campaign_level-4-standard_edit_")));
  assert.ok(!plan.plays.some((play) => play.playbookId === standard.id && play.resourceId === "central-listing"));
  assert.ok(!plan.plays.some((play) => play.id === completedListing.id));
  assert.ok(plan.expectedPlays.some((play) => play.playbookId === featured.id && play.status !== "completed"));
});

test("campaign edit upgrades a recurring Level 4 occurrence to Level 3 while retaining identity and source metadata", () => {
  const standard = starterPlaybook("level-4-standard");
  const level3 = starterPlaybook("level-3-featured");
  const original = savedCampaign(standard, {
    seriesId: "monthly-series",
    occurrenceKey: "2027-01-31",
    seriesRevision: 7,
    recurrenceException: false,
  });
  const initial = buildCampaignEditPlan({campaign: original, playbook: standard, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const plan = buildCampaignEditPlan({
    campaign: currentCampaign,
    updates: {
      id: "replacement-id",
      name: "Upgraded Campaign",
      submittedAt: "2099-01-01T00:00:00.000Z",
      sourceEventId: "replacement-source",
      sourceUrl: "https://example.com/replacement",
      level: 1,
      campaignType: "major",
      playbookId: "level-1-major",
      eventDetails: "Updated details",
    },
    playbook: level3,
    campaigns: [currentCampaign],
    plays: initial.plays,
    generatedAt,
  });
  const edited = plan.campaigns[0];

  assert.equal(edited.id, original.id);
  assert.equal(edited.name, "Upgraded Campaign");
  assert.equal(edited.submittedAt, original.submittedAt);
  assert.equal(edited.sourceEventId, original.sourceEventId);
  assert.equal(edited.sourceUrl, original.sourceUrl);
  assert.equal(edited.level, 3);
  assert.equal(edited.campaignType, "featured");
  assert.equal(edited.playbookId, level3.id);
  assert.equal(edited.playbookVersion, level3.version);
  assert.equal(edited.seriesId, original.seriesId);
  assert.equal(edited.occurrenceKey, original.occurrenceKey);
  assert.equal(edited.seriesRevision, 7);
  assert.equal(edited.recurrenceException, true);
  assert.equal(plan.series, null);
  assert.ok(plan.plays.some((play) => play.playbookId === level3.id));
});

test("campaign playbook changes preserve protected history and both sides of Smuggle", () => {
  const priorPlaybook = playbook({id: "prior-playbook", campaignType: "featured"});
  const selectedPlaybook = playbook({
    id: "selected-playbook",
    level: 3,
    campaignType: "standard",
    weeks: [{
      weekNumber: 1,
      phase: "Invitation",
      plays: [
        {id: "new-completed", playType: "Completed Work", channel: "One", resourceId: "completed", dayOfWeek: 1},
        {id: "new-past", playType: "Past Work", channel: "Two", resourceId: "past", dayOfWeek: 1},
        {id: "new-manual", playType: "Manual Work", channel: "Three", resourceId: "manual", dayOfWeek: 1},
        {id: "new-locked", playType: "Locked Work", channel: "Four", resourceId: "locked", dayOfWeek: 1},
        {id: "new-skipped", playType: "Skipped Work", channel: "Five", resourceId: "intentional", dayOfWeek: 1},
        {id: "new-stage", playType: "Stage Announcement", channel: "Stage", resourceId: "stage-announcement", dayOfWeek: 1},
      ],
    }],
  });
  const campaign = savedCampaign(priorPlaybook, {registrationDeadline: "", deadlineOffsetDays: null});
  const basePlay = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignLevel: 4,
    campaignType: "featured",
    playbookId: priorPlaybook.id,
    playbookVersion: priorPlaybook.version,
    weekNumber: 1,
    phase: "Invitation",
    originalScheduledDate: "2027-01-25",
    scheduledDate: "2027-01-25",
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
  const protectedPlays = [
    {...basePlay, id: "completed-old", templatePlayId: "old-completed", playType: "Completed Work", channel: "One", resourceId: "completed", status: "completed"},
    {...basePlay, id: "past-old", templatePlayId: "old-past", playType: "Past Work", channel: "Two", resourceId: "past", originalScheduledDate: "2026-08-01", scheduledDate: "2026-08-01"},
    {...basePlay, id: "manual-old", templatePlayId: "old-manual", playType: "Manual Work", channel: "Three", resourceId: "manual", manuallyAdjusted: true},
    {...basePlay, id: "locked-old", templatePlayId: "old-locked", playType: "Locked Work", channel: "Four", resourceId: "locked", locked: true},
    {...basePlay, id: "skipped-old", templatePlayId: "old-skipped", playType: "Skipped Work", channel: "Five", resourceId: "intentional", status: "skipped", lateReason: "Intentionally not running."},
    {...basePlay, id: "beneficiary-old", templatePlayId: "old-stage", playType: "Stage Announcement", channel: "Stage", resourceId: "stage-announcement"},
  ];
  const hostCampaign = {...campaign, id: "host-campaign", name: "Host", level: 2};
  const host = {
    ...basePlay,
    id: "host-stage",
    campaignId: hostCampaign.id,
    campaignName: hostCampaign.name,
    campaignLevel: 2,
    templatePlayId: "host-stage",
    playType: "Stage Announcement",
    channel: "Stage",
    resourceId: "stage-announcement",
    smuggle: {
      hostCampaignId: hostCampaign.id,
      hostScheduledPlayId: "host-stage",
      beneficiaryCampaignId: campaign.id,
      beneficiaryName: campaign.name,
      strategy: "SMUGGLE",
    },
  };
  const plan = buildCampaignEditPlan({
    campaign,
    playbook: selectedPlaybook,
    campaigns: [campaign, hostCampaign],
    plays: [...protectedPlays, host],
    generatedAt,
  });

  assert.equal(plan.plays.length, 1);
  assert.equal(plan.plays[0].resourceId, "past");
  assert.equal(plan.plays[0].playbookId, selectedPlaybook.id);
  assert.deepEqual(plan.expectedPlays, []);
  assert.equal(plan.summary.preserved, protectedPlays.length);
  assert.equal(plan.campaigns[0].playbookId, selectedPlaybook.id);
});

test("campaign edits include capacity changes and optimistic baselines for outside campaigns", () => {
  const oldPlaybook = playbook({id: "old-capacity", level: 4, campaignType: "standard"});
  const selectedPlaybook = playbook({
    id: "selected-capacity",
    level: 3,
    campaignType: "featured",
    weeks: [{weekNumber: 1, phase: "Invitation", plays: [
      {id: "shared-new", playType: "Shared Work", channel: "Shared", resourceId: "shared-resource", dayOfWeek: 1, eligibleWeekdays: [1], lateBehavior: "SKIP"},
    ]}],
  });
  const campaign = savedCampaign(oldPlaybook, {registrationDeadline: "", deadlineOffsetDays: null});
  const oldPlay = {
    id: "saved-campaign_old_1",
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignLevel: 4,
    campaignType: "standard",
    playbookId: oldPlaybook.id,
    playbookVersion: oldPlaybook.version,
    templatePlayId: "old",
    weekNumber: 1,
    phase: "Invitation",
    playType: "Old Work",
    channel: "Other",
    resourceId: "other-resource",
    originalScheduledDate: "2027-01-25",
    scheduledDate: "2027-01-25",
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
  const outsideCampaign = {...campaign, id: "outside-campaign", name: "Outside Campaign", submittedAt: "2026-07-01T12:00:00.000Z"};
  const outsidePlay = {...oldPlay, id: "outside-shared", campaignId: outsideCampaign.id, campaignName: outsideCampaign.name, resourceId: "shared-resource", playType: "Shared Work", channel: "Shared"};
  const capacityRule = {id: "shared-resource", name: "Shared Resource", capacity: 1, typicalCapacity: 1, capacityPeriod: "week", allowedWeekdays: [1], active: true};
  const plan = buildCampaignEditPlan({
    campaign,
    playbook: selectedPlaybook,
    campaigns: [campaign, outsideCampaign],
    plays: [oldPlay, outsidePlay],
    capacityRules: [capacityRule],
    generatedAt,
  });

  const outsideWrite = plan.plays.find((play) => play.id === outsidePlay.id);
  assert.equal(outsideWrite.status, "conflict");
  assert.equal(outsideWrite.conflictState, "capacity-overflow");
  assert.deepEqual(plan.expectedPlays.find((play) => play.id === outsidePlay.id), outsidePlay);
  assert.deepEqual(plan.expectedWorkspace.campaigns, [campaign, outsideCampaign]);
  assert.deepEqual(plan.expectedWorkspace.plays, [oldPlay, outsidePlay]);
  assert.deepEqual(plan.expectedWorkspace.capacityRules, [capacityRule]);
});

test("campaign playbook edits are deterministic on repeat", () => {
  const standard = starterPlaybook("level-4-standard");
  const featured = starterPlaybook("level-4-featured");
  const original = savedCampaign(standard);
  const initial = buildCampaignEditPlan({campaign: original, playbook: standard, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const edit = buildCampaignEditPlan({campaign: currentCampaign, playbook: featured, campaigns: [currentCampaign], plays: initial.plays, generatedAt});
  assert.ok(edit.summary.skipped > 0);
  const appliedCampaigns = applyWrites([currentCampaign], edit.campaigns);
  const appliedPlays = applyWrites(initial.plays, edit.plays);
  const retry = buildCampaignEditPlan({
    campaign: appliedCampaigns[0],
    playbook: featured,
    campaigns: appliedCampaigns,
    plays: appliedPlays,
    generatedAt,
  });

  assert.deepEqual(retry.campaigns, []);
  assert.deepEqual(retry.plays, []);
  assert.deepEqual(retry.expectedCampaigns, []);
  assert.deepEqual(retry.expectedPlays, []);
  assert.equal(retry.summary.skipped, 0);
});

test("global regeneration reuses switched play ids and leaves wrong-playbook tombstones intact", () => {
  const standard = starterPlaybook("level-4-standard");
  const featured = starterPlaybook("level-4-featured");
  const original = savedCampaign(standard);
  const initial = buildCampaignEditPlan({campaign: original, playbook: standard, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const edit = buildCampaignEditPlan({campaign: currentCampaign, playbook: featured, campaigns: [currentCampaign], plays: initial.plays, generatedAt});
  const appliedCampaign = applyWrites([currentCampaign], edit.campaigns)[0];
  const appliedPlays = applyWrites(initial.plays, edit.plays);
  const selectedBefore = new Map(appliedPlays
    .filter((play) => play.playbookId === featured.id && play.status !== "skipped")
    .map((play) => [`${play.templatePlayId}:${play.weekNumber}`, play.id]));
  const latest = structuredClone(featured);
  latest.version = 2;
  const regeneration = buildCampaignRegeneration({
    campaigns: [appliedCampaign],
    plays: appliedPlays,
    playbooks: [latest],
    generatedAt,
  });

  selectedBefore.forEach((id, key) => {
    const [templatePlayId, weekNumber] = key.split(":");
    const regenerated = regeneration.plays.find((play) =>
      play.playbookId === featured.id && play.templatePlayId === templatePlayId && play.weekNumber === Number(weekNumber),
    );
    assert.equal(regenerated.id, id);
    assert.equal(regenerated.playbookVersion, 2);
  });
  const wrongPlaybookTombstones = appliedPlays.filter((play) => play.playbookId === standard.id && play.status === "skipped");
  wrongPlaybookTombstones.forEach((tombstone) => {
    assert.deepEqual(regeneration.plays.find((play) => play.id === tombstone.id), tombstone);
  });
  regeneration.writePlayIds.forEach((id) => {
    const before = appliedPlays.find((play) => play.id === id);
    const after = regeneration.plays.find((play) => play.id === id);
    if (before) assert.equal(after.playbookId, before.playbookId);
  });
});

test("series saves and later occurrence edits preserve a switched occurrence exception", () => {
  const initial = buildSeriesPlan({series: series(), playbook: playbook(), generatedAt});
  const occurrence = initial.campaigns[0];
  const selectedPlaybook = playbook({
    id: "selected-occurrence-playbook",
    level: 3,
    campaignType: "featured",
    weeks: [{weekNumber: 1, phase: "Invitation", plays: [
      {id: "selected-email", playType: "Selected Email", channel: "Email", resourceId: "selected-email", dayOfWeek: 1, eligibleWeekdays: [1], lateBehavior: "SKIP"},
    ]}],
  });
  const switched = buildCampaignEditPlan({
    campaign: occurrence,
    playbook: selectedPlaybook,
    campaigns: initial.campaigns,
    plays: initial.plays,
    generatedAt,
  });
  const appliedCampaigns = applyWrites(initial.campaigns, switched.campaigns);
  const appliedPlays = applyWrites(initial.plays, switched.plays);
  const switchedCampaign = appliedCampaigns.find((campaign) => campaign.id === occurrence.id);
  const selectedPlay = appliedPlays.find((play) => play.campaignId === occurrence.id && play.playbookId === selectedPlaybook.id && play.status !== "skipped");

  const futureSeriesSave = buildSeriesPlan({
    series: series({revision: 2, name: "Updated Series Default"}),
    playbook: playbook(),
    campaigns: appliedCampaigns,
    plays: appliedPlays,
    generatedAt,
  });
  assert.ok(!futureSeriesSave.campaigns.some((campaign) => campaign.id === occurrence.id));
  assert.ok(!futureSeriesSave.plays.some((play) => play.campaignId === occurrence.id));

  const occurrenceEdit = buildOccurrencePlan({
    campaign: switchedCampaign,
    updates: {eventDate: "2026-10-22"},
    playbook: selectedPlaybook,
    campaigns: appliedCampaigns,
    plays: appliedPlays,
    generatedAt,
  });
  const movedSelected = occurrenceEdit.plays.find((play) => play.id === selectedPlay.id);
  assert.ok(movedSelected);
  assert.equal(movedSelected.playbookId, selectedPlaybook.id);
  assert.ok(!occurrenceEdit.plays.some((play) =>
    play.campaignId === occurrence.id && play.playbookId === selectedPlaybook.id && play.id !== selectedPlay.id,
  ));
  assert.equal(occurrenceEdit.campaigns[0].recurrenceException, true);
});

test("promotion-window edits move the inclusive end while preserving source bounds and history", () => {
  const standard = starterPlaybook("level-4-standard");
  const original = savedCampaign(standard, {
    scheduleMode: "promotion-window",
    eventDate: "",
    campaignEndDate: "2027-01-31",
    registrationDeadline: "",
    deadlineOffsetDays: null,
    requestedPromotionStart: "2027-01-20",
    requestedPromotionEnd: "2027-02-02",
  });
  const initial = buildCampaignEditPlan({campaign: original, playbook: standard, campaigns: [original], generatedAt});
  const currentCampaign = initial.campaigns[0];
  const completed = {...initial.plays[0], status: "completed"};
  const currentPlays = initial.plays.map((play) => play.id === completed.id ? completed : play);
  const edit = buildCampaignEditPlan({
    campaign: currentCampaign,
    updates: {
      campaignEndDate: "2027-02-07",
      eventDate: "2099-01-01",
      deadlineOffsetDays: 30,
      requestedPromotionStart: "2099-01-01",
      requestedPromotionEnd: "2099-02-01",
    },
    playbook: standard,
    campaigns: [currentCampaign],
    plays: currentPlays,
    generatedAt,
  });
  const edited = edit.campaigns[0];

  assert.equal(edited.scheduleMode, "promotion-window");
  assert.equal(edited.eventDate, "");
  assert.equal(edited.campaignEndDate, "2027-02-07");
  assert.equal(edited.registrationDeadline, "");
  assert.equal(edited.deadlineOffsetDays, null);
  assert.equal(edited.requestedPromotionStart, original.requestedPromotionStart);
  assert.equal(edited.requestedPromotionEnd, original.requestedPromotionEnd);
  assert.equal(edited.recommendedStartDate, "2027-01-25");
  assert.ok(!edit.plays.some((play) => play.id === completed.id));
  assert.ok(edit.plays.every((play) => play.campaignId !== original.id || play.manuallyAdjusted === false));

  const appliedCampaigns = applyWrites([currentCampaign], edit.campaigns);
  const appliedPlays = applyWrites(currentPlays, edit.plays);
  const latest = {...standard, version: 2};
  const regeneration = buildCampaignRegeneration({
    campaigns: appliedCampaigns,
    plays: appliedPlays,
    playbooks: [latest],
    generatedAt,
  });
  assert.equal(regeneration.campaigns[0].eventDate, "");
  assert.equal(regeneration.campaigns[0].campaignEndDate, "2027-02-07");
  assert.deepEqual(regeneration.plays.find((play) => play.id === completed.id), completed);

  assert.throws(() => buildSeriesPlan({
    series: series({recurrence: {...series().recurrence, startDate: "2027-02-07", monthDay: 7, count: 1}}),
    playbook: playbook(),
    campaigns: [edited],
    plays: appliedPlays,
    generatedAt,
    seedCampaignId: edited.id,
  }), /cannot become recurring series/);
});

test("campaign edit play ids stay deterministic and valid at maximum source id lengths", () => {
  const oldPlaybook = playbook({id: "old-playbook"});
  const selectedPlaybook = playbook({
    id: "p".repeat(128),
    level: 3,
    campaignType: "featured",
    weeks: [{weekNumber: 1, phase: "Invitation", plays: [
      {id: "t".repeat(128), playType: "Long ID Work", channel: "Test", resourceId: "long-id", dayOfWeek: 1},
    ]}],
  });
  const campaign = savedCampaign(oldPlaybook, {
    id: "c".repeat(128),
    registrationDeadline: "",
    deadlineOffsetDays: null,
  });
  const first = buildCampaignEditPlan({campaign, playbook: selectedPlaybook, campaigns: [campaign], generatedAt});
  const second = buildCampaignEditPlan({campaign, playbook: selectedPlaybook, campaigns: [campaign], generatedAt});

  assert.equal(first.plays.length, 1);
  assert.match(first.plays[0].id, /^[A-Za-z0-9_-]{1,128}$/);
  assert.equal(first.plays[0].id, second.plays[0].id);
});
