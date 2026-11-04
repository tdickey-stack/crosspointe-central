import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCampaignRegeneration, generateCampaignSchedule,
  generateEventDayBulletin, isCampaignExpired,
} from "../src/planner/domain.js";
import {buildCampaignEditPlan, buildSeriesPlan} from "../src/planner/series.js";
import {buildPromotionBrief} from "../src/planner/briefs.js";

const generatedAt = new Date("2026-02-01T18:00:00Z");
const bulletin = {
  id: "bulletin-final", playType: "Weekly Bulletin Mention",
  resourceId: "weekly-bulletin", channel: "Weekly Bulletin", dayOfWeek: 0,
  eligibleWeekdays: [0], lateBehavior: "SKIP", requirement: "required",
};
const playbook = {
  id: "sample", version: 1, level: 3, campaignType: "standard", durationWeeks: 2,
  weeks: [
    {weekNumber: 1, phase: "Awareness", plays: [{...bulletin, id: "first"}]},
    {weekNumber: 2, phase: "Invitation", plays: [bulletin]},
  ],
};
function campaign(overrides = {}) {
  return {
    id: "campaign", name: "Community Dinner", status: "active", level: 3,
    eventDate: "2026-03-08", registrationDeadline: "", campaignType: "standard",
    playbookId: "sample", playbookVersion: 1, submittedAt: "2026-02-01T18:00:00Z",
    ...overrides,
  };
}
function extra(value, definition = playbook, now = generatedAt) {
  return generateEventDayBulletin({campaign: value, playbook: definition, generatedAt: now});
}

test("Sunday event-day bulletin retains prior weeks and uses final-week template around DST", () => {
  for (const eventDate of ["2026-03-08", "2026-11-01"]) {
    const value = campaign({eventDate});
    const play = extra(value);
    assert.equal(play.scheduledDate, eventDate);
    assert.equal(play.originalScheduledDate, eventDate);
    assert.equal(play.templatePlayId, "event-day-bulletin");
    assert.equal(play.weekNumber, 2);
    assert.equal(play.phase, "Event day");
    assert.equal(play.playType, bulletin.playType);
    assert.equal(play.resourceId, bulletin.resourceId);
    assert.equal(play.channel, bulletin.channel);
    const schedule = generateCampaignSchedule({campaign: value, playbook, generatedAt});
    const bulletinPlays = schedule.plays.filter((item) => item.resourceId === "weekly-bulletin");
    assert.equal(bulletinPlays.length, 3);
    assert.equal(bulletinPlays.filter((item) => item.templatePlayId === "event-day-bulletin").length, 1);
  }
});

test("only Sunday events gain an event-day bulletin", () => {
  for (let day = 8; day <= 14; day++) {
    const value = campaign({eventDate: `2026-03-${day}`});
    assert.equal(Boolean(extra(value)), day === 8);
  }
});

test("deadline, status, type, and final-week template gate event-day generation", () => {
  assert.ok(extra(campaign({status: "draft"})));
  assert.ok(extra(campaign({registrationDeadline: "2026-03-08"})));
  assert.ok(extra(campaign({registrationDeadline: "2026-03-08T09:00:00-05:00"})));
  assert.equal(extra(campaign({registrationDeadline: "2026-03-07"})), null);
  for (const status of ["archived", "completed"]) assert.equal(extra(campaign({status})), null);
  assert.equal(extra(campaign({campaignType: "standalone-content"})), null);
  assert.equal(extra(campaign({scheduleMode: "promotion-window", campaignEndDate: "2026-03-08"})), null);
  assert.equal(extra(campaign(), {...playbook, weeks: [playbook.weeks[0], {...playbook.weeks[1], plays: []}]}), null);
  assert.equal(extra(campaign(), playbook, new Date("2026-03-09T17:00:00Z")), null);
});

test("promotion-window schedules and earlier registration deadlines do not gain extra plays", () => {
  const window = campaign({
    scheduleMode: "promotion-window", eventDate: "", campaignEndDate: "2026-03-08",
  });
  const limited = campaign({registrationDeadline: "2026-03-07"});
  for (const value of [window, limited]) {
    const schedule = generateCampaignSchedule({campaign: value, playbook, generatedAt});
    assert.equal(schedule.plays.some((play) => play.templatePlayId === "event-day-bulletin"), false);
    assert.ok(schedule.plays.length > 0);
    assert.ok(schedule.plays.every((play) => play.scheduledDate <= "2026-03-08"));
  }
});

test("identity is bounded and stable across event-date and playbook-version edits", () => {
  const longId = "campaign-" + "x".repeat(180);
  const first = extra(campaign({id: longId}));
  const second = extra(campaign({id: longId, eventDate: "2026-11-01"}), {...playbook, version: 2});
  assert.ok(first.id.length <= 128);
  assert.equal(first.id, second.id);
  assert.notEqual(first.id, extra(campaign({id: longId + "y"})).id);
});

test("regeneration preserves manually skipped event-day and earlier history", () => {
  const value = campaign();
  const initial = generateCampaignSchedule({campaign: value, playbook, generatedAt});
  const selected = initial.plays.find((play) => play.templatePlayId === "event-day-bulletin");
  const past = initial.plays.find((play) => play.templatePlayId === "first");
  const skipped = {...selected, status: "skipped", manuallyAdjusted: true};
  const historical = {...past, status: "completed", scheduledDate: "2026-02-15"};
  const regenerated = buildCampaignRegeneration({
    campaigns: [value], plays: initial.plays.map((play) => play.id === skipped.id ? skipped : play.id === past.id ? historical : play),
    playbooks: [{...playbook, version: 2}], generatedAt: new Date("2026-03-01T18:00:00Z"),
  });
  assert.deepEqual(regenerated.plays.find((play) => play.id === skipped.id), skipped);
  assert.deepEqual(regenerated.plays.find((play) => play.id === historical.id), historical);
});

test("series edit preserves a skipped event-day bulletin", () => {
  const series = {
    id: "series", name: "Dinner", status: "active", revision: 1,
    playbookId: playbook.id, playbookVersion: 1, level: 3, campaignType: "standard",
    submittedAt: "2026-02-01T18:00:00Z", deadlineOffsetDays: null,
    recurrence: {frequency: "monthly", interval: 1, startDate: "2026-03-08", endType: "count", count: 1,
      until: "", weekdays: [0], monthlyMode: "date", monthDay: 8, ordinals: [2], missingDate: "skip"},
  };
  const first = buildSeriesPlan({series, playbook, generatedAt});
  const selected = first.plays.find((play) => play.templatePlayId === "event-day-bulletin");
  assert.ok(selected);
  const skipped = {...selected, status: "skipped", manuallyAdjusted: true};
  const edited = buildSeriesPlan({
    series: {...series, revision: 2, name: "Dinner Updated"}, playbook,
    campaigns: first.campaigns, plays: first.plays.map((play) => play.id === selected.id ? skipped : play), generatedAt,
  });
  assert.equal(edited.plays.some((play) => play.id === skipped.id && play.status !== "skipped"), false);
});

test("Sunday event-day bulletin appears in the promotion brief", () => {
  const value = campaign();
  const schedule = generateCampaignSchedule({campaign: value, playbook, generatedAt});
  const brief = buildPromotionBrief({
    campaigns: [value], scheduledPlays: schedule.plays,
    selectedPlayTypes: ["Weekly Bulletin Mention"], startDate: value.eventDate,
    endDate: value.eventDate, generatedAt,
  });
  assert.equal(brief.announcementCount, 1);
  assert.equal(brief.entries[0].announcements[0].playType, "Weekly Bulletin Mention");
});

test("legacy Sunday campaign remains visible through its event day", () => {
  const value = campaign({eventDate: "2026-03-08", durationWeeks: 2});
  assert.equal(isCampaignExpired(value, new Date("2026-03-09T04:59:00Z")), false);
  assert.equal(isCampaignExpired(value, new Date("2026-03-09T05:00:00Z")), true);
});

test("protected final-week bulletin on event day prevents duplicates in regeneration and campaign edit", () => {
  for (const adjustment of [
    {status: "scheduled", manuallyAdjusted: true},
    {status: "skipped", manuallyAdjusted: true},
    {status: "scheduled", locked: true},
    {status: "completed"},
  ]) {
    const value = campaign();
    const initial = generateCampaignSchedule({campaign: value, playbook, generatedAt});
    const regular = initial.plays.find((play) => play.templatePlayId === bulletin.id);
    const protectedPlay = {...regular, scheduledDate: value.eventDate, ...adjustment};
    const existing = initial.plays.filter((play) => play.templatePlayId !== "event-day-bulletin")
        .map((play) => play.id === regular.id ? protectedPlay : play);
    const regenerated = buildCampaignRegeneration({campaigns: [value], plays: existing, playbooks: [playbook], generatedAt});
    assert.deepEqual(regenerated.plays.find((play) => play.id === regular.id), protectedPlay);
    assert.equal(regenerated.plays.some((play) => play.templatePlayId === "event-day-bulletin" && play.status !== "skipped"), false);
    const edit = buildCampaignEditPlan({campaign: value, updates: {name: "Updated"}, playbook, campaigns: [value], plays: existing, generatedAt});
    const merged = new Map(existing.map((play) => [play.id, play]));
    edit.plays.forEach((play) => merged.set(play.id, play));
    assert.deepEqual(merged.get(regular.id), protectedPlay);
    assert.equal([...merged.values()].some((play) => play.templatePlayId === "event-day-bulletin" && play.status !== "skipped"), false);
  }
});

test("unprotected regular bulletin returns to its pre-event date and the event-day play is added", () => {
  const value = campaign();
  const initial = generateCampaignSchedule({campaign: value, playbook, generatedAt});
  const regular = initial.plays.find((play) => play.templatePlayId === bulletin.id);
  const existing = initial.plays.filter((play) => play.templatePlayId !== "event-day-bulletin")
      .map((play) => play.id === regular.id ? {...play, scheduledDate: value.eventDate} : play);
  const regenerated = buildCampaignRegeneration({campaigns: [value], plays: existing, playbooks: [playbook], generatedAt});
  assert.ok(regenerated.plays.find((play) => play.id === regular.id).scheduledDate < value.eventDate);
  assert.equal(regenerated.plays.filter((play) => play.templatePlayId === "event-day-bulletin" && play.scheduledDate === value.eventDate).length, 1);
});

test("an automatic past event-day tombstone revives when the campaign moves to a future Sunday", () => {
  const oldCampaign = campaign({eventDate: "2026-03-08"});
  const old = extra(oldCampaign);
  const tombstone = {...old, status: "skipped", lateReason: "Removed from the active plan by campaign regeneration."};
  const moved = campaign({eventDate: "2026-11-01"});
  const regenerated = buildCampaignRegeneration({
    campaigns: [moved], plays: [tombstone], playbooks: [playbook], generatedAt: new Date("2026-04-01T18:00:00Z"),
  });
  const revived = regenerated.plays.find((play) => play.id === tombstone.id);
  assert.equal(revived.scheduledDate, moved.eventDate);
  assert.equal(revived.status, "scheduled");
});

test("changing playbooks creates a distinct event-day play and retires the old automatic play", () => {
  const value = campaign();
  const initial = generateCampaignSchedule({campaign: value, playbook, generatedAt});
  const oldEventDay = initial.plays.find((play) => play.templatePlayId === "event-day-bulletin");
  const otherBook = {...playbook, id: "alternate", version: 2};
  const plan = buildCampaignEditPlan({
    campaign: value, playbook: otherBook, campaigns: [value], plays: initial.plays, generatedAt,
  });
  const oldById = new Map(initial.plays.map((play) => [play.id, play]));
  plan.plays.forEach((play) => {
    if (oldById.has(play.id)) assert.equal(play.playbookId, oldById.get(play.id).playbookId);
  });
  const merged = new Map(initial.plays.map((play) => [play.id, play]));
  plan.plays.forEach((play) => merged.set(play.id, play));
  assert.equal(merged.get(oldEventDay.id).status, "skipped");
  const active = [...merged.values()].filter((play) =>
    play.templatePlayId === "event-day-bulletin" && play.status !== "skipped");
  assert.equal(active.length, 1);
  assert.equal(active[0].playbookId, otherBook.id);
  assert.notEqual(active[0].id, oldEventDay.id);
});

test("changing playbooks preserves a protected old event-day bulletin without creating another", () => {
  const value = campaign();
  const initial = generateCampaignSchedule({campaign: value, playbook, generatedAt});
  const original = initial.plays.find((play) => play.templatePlayId === "event-day-bulletin");
  const protectedPlay = {...original, manuallyAdjusted: true, status: "skipped"};
  const existing = initial.plays.map((play) => play.id === original.id ? protectedPlay : play);
  const otherBook = {...playbook, id: "alternate", version: 2};
  const plan = buildCampaignEditPlan({
    campaign: value, playbook: otherBook, campaigns: [value], plays: existing, generatedAt,
  });
  const merged = new Map(existing.map((play) => [play.id, play]));
  plan.plays.forEach((play) => merged.set(play.id, play));
  assert.deepEqual(merged.get(original.id), protectedPlay);
  assert.equal([...merged.values()].some((play) =>
    play.templatePlayId === "event-day-bulletin" && play.playbookId === otherBook.id && play.status !== "skipped"), false);
});
