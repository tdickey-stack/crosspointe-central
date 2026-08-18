import {Temporal} from "temporal-polyfill";

export const BUSINESS_TIME_ZONE = "America/Chicago";

export const PLAY_STATUSES = [
  "scheduled",
  "completed",
  "missed",
  "skipped",
  "rescheduled",
  "conflict",
  "needs-decision",
];

export const LATE_BEHAVIORS = [
  "SKIP",
  "NEXT_AVAILABLE_SLOT",
  "NEXT_OCCURRENCE",
  "MANUAL_REVIEW",
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function businessLocalToIso(value) {
  return Temporal.PlainDateTime.from(String(value))
    .toZonedDateTime(BUSINESS_TIME_ZONE)
    .toInstant()
    .toString();
}

export function businessNowInputValue() {
  return Temporal.Now.zonedDateTimeISO(BUSINESS_TIME_ZONE)
    .toPlainDateTime()
    .toString({smallestUnit: "minute"});
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function dateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function utcDateFromKey(value) {
  const [year, month, day] = dateKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function keyFromUtcDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(value, amount) {
  const date = utcDateFromKey(value);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return keyFromUtcDate(date);
}

export function recurringContentDates({startDate, cadence = "none", occurrences = 1}) {
  const allowedCadences = new Set(["none", "weekly", "biweekly", "monthly"]);
  if (!allowedCadences.has(cadence)) throw new Error("A valid content cadence is required.");
  const count = cadence === "none"
    ? 1
    : Math.min(12, Math.max(2, Number(occurrences) || 2));
  const anchor = Temporal.PlainDate.from(dateKey(startDate));
  return Array.from({length: count}, (_value, index) => {
    if (cadence === "weekly") return anchor.add({days: index * 7}).toString();
    if (cadence === "biweekly") return anchor.add({days: index * 14}).toString();
    if (cadence === "monthly") return anchor.add({months: index}).toString();
    return anchor.toString();
  });
}

export function differenceInDays(later, earlier) {
  return Math.round((utcDateFromKey(later) - utcDateFromKey(earlier)) / DAY_MS);
}

export function startOfSundayWeek(value) {
  const date = utcDateFromKey(value);
  return addDays(value, -date.getUTCDay());
}

export function nextPlanningWeekStart(value = new Date()) {
  return addDays(startOfSundayWeek(value), 7);
}

export function reportPresetDateRange(preset, value = new Date()) {
  const upcomingStart = nextPlanningWeekStart(value);
  if (preset === "upcoming") {
    return {startDate: upcomingStart, endDate: addDays(upcomingStart, 6)};
  }
  if (preset === "next-two-weeks") {
    return {startDate: upcomingStart, endDate: addDays(upcomingStart, 13)};
  }
  if (preset === "month-at-a-glance") {
    const monthStart = Temporal.PlainDate.from(upcomingStart).with({day: 1});
    return {
      startDate: monthStart.toString(),
      endDate: monthStart.add({months: 1}).subtract({days: 1}).toString(),
    };
  }
  throw new Error("A valid report date preset is required.");
}

export function endOfSaturdayWeek(value) {
  return addDays(startOfSundayWeek(value), 6);
}

export function campaignWindow(eventDate, durationWeeks) {
  const duration = Math.max(1, Number(durationWeeks) || 1);
  const eventWeekStart = startOfSundayWeek(eventDate);
  const recommendedStartDate = addDays(eventWeekStart, -(duration - 1) * 7);
  return {
    recommendedStartDate,
    eventWeekStart,
    campaignEndDate: addDays(eventWeekStart, 6),
  };
}

export function calculateTimeliness({eventDate, durationWeeks, submittedAt}) {
  const {recommendedStartDate} = campaignWindow(eventDate, durationWeeks);
  const submittedDate = dateKey(submittedAt);
  const daysLate = Math.max(0, differenceInDays(submittedDate, recommendedStartDate));
  return {
    recommendedStartDate,
    submittedAt: submittedAt instanceof Date ? submittedAt.toISOString() : submittedAt,
    submittedDate,
    isOnTime: daysLate === 0,
    daysLate,
    weeksLate: Math.floor(daysLate / 7),
  };
}

export function campaignWeekForDate({eventDate, durationWeeks, value}) {
  const {recommendedStartDate, campaignEndDate} = campaignWindow(
    eventDate,
    durationWeeks,
  );
  const target = dateKey(value);
  if (target < recommendedStartDate) return 0;
  if (target > campaignEndDate) return Number(durationWeeks) + 1;
  return Math.floor(differenceInDays(target, recommendedStartDate) / 7) + 1;
}

function deadlineForCampaign(campaign) {
  const event = dateKey(campaign.eventDate);
  if (!campaign.registrationDeadline) return event;
  const registration = dateKey(campaign.registrationDeadline);
  return registration < event ? registration : event;
}

function normalizedEligibleDays(templatePlay) {
  const values = Array.isArray(templatePlay.eligibleWeekdays)
    ? templatePlay.eligibleWeekdays
    : [templatePlay.dayOfWeek];
  return [...new Set(values.map(Number).filter((day) => day >= 0 && day <= 6))];
}

function nextEligibleDate({fromDate, finalDate, eligibleWeekdays}) {
  for (let date = dateKey(fromDate); date <= finalDate; date = addDays(date, 1)) {
    if (eligibleWeekdays.includes(utcDateFromKey(date).getUTCDay())) return date;
  }
  return "";
}

function templatePlayDate(recommendedStartDate, weekNumber, dayOfWeek) {
  return addDays(recommendedStartDate, (Number(weekNumber) - 1) * 7 + Number(dayOfWeek));
}

export function priorityTuple(campaign) {
  const typeWeight = String(campaign.campaignType || "").toLowerCase() === "featured" ? 1 : 0;
  const timeliness = campaign.isOnTime === false ? 0 : 1;
  const deadline = deadlineForCampaign(campaign);
  return [
    6 - Math.min(5, Math.max(1, Number(campaign.level) || 5)),
    typeWeight,
    timeliness,
    -differenceInDays(deadline, dateKey(campaign.submittedAt || deadline)),
    -utcDateFromKey(dateKey(campaign.submittedAt || deadline)).getTime(),
  ];
}

export function compareCampaignPriority(left, right) {
  const a = priorityTuple(left);
  const b = priorityTuple(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function generateCampaignSchedule({
  campaign,
  playbook,
  generatedAt = new Date(),
  idFactory = (templatePlay, weekNumber) =>
    `${campaign.id}_${templatePlay.id}_${weekNumber}`,
}) {
  if (!campaign?.id) throw new Error("Campaign id is required.");
  if (!playbook?.id || !Array.isArray(playbook.weeks)) {
    throw new Error("A valid playbook is required.");
  }
  const today = dateKey(generatedAt);
  const timeliness = calculateTimeliness({
    eventDate: campaign.eventDate,
    durationWeeks: playbook.durationWeeks,
    submittedAt: campaign.submittedAt,
  });
  const finalDate = deadlineForCampaign(campaign);
  const plays = [];

  playbook.weeks.forEach((week) => {
    (week.plays || []).forEach((templatePlay) => {
      const eligibleWeekdays = normalizedEligibleDays(templatePlay);
      const primaryDay = eligibleWeekdays[0] ?? 0;
      const originalScheduledDate = templatePlayDate(
        timeliness.recommendedStartDate,
        week.weekNumber,
        primaryDay,
      );
      // A playbook describes a Sunday-through-Saturday rhythm, but the event
      // can happen on any day in that final week. Promotions after the event
      // (or an earlier registration deadline) are not part of the plan.
      if (originalScheduledDate > finalDate) return;
      let scheduledDate = originalScheduledDate;
      let status = "scheduled";
      let conflictState = "none";
      let lateReason = "";

      if (originalScheduledDate < today) {
        const behavior = LATE_BEHAVIORS.includes(templatePlay.lateBehavior)
          ? templatePlay.lateBehavior
          : "SKIP";
        if (behavior === "NEXT_AVAILABLE_SLOT") {
          const weekEnd = addDays(
            timeliness.recommendedStartDate,
            (Number(week.weekNumber) - 1) * 7 + 6,
          );
          const candidate = nextEligibleDate({
            fromDate: today,
            finalDate: [weekEnd, finalDate].sort()[0],
            eligibleWeekdays,
          });
          if (candidate) {
            scheduledDate = candidate;
            status = "rescheduled";
            lateReason = "Moved to the next eligible slot because the original play passed.";
          } else {
            status = "missed";
            lateReason = "No eligible slot remained before the campaign deadline.";
          }
        } else if (behavior === "NEXT_OCCURRENCE") {
          const candidate = addDays(originalScheduledDate, 7);
          if (candidate >= today && candidate <= finalDate) {
            scheduledDate = candidate;
            status = "rescheduled";
            lateReason = "Moved to the next weekly occurrence.";
          } else {
            status = "missed";
            lateReason = "The next occurrence falls after the campaign deadline.";
          }
        } else if (behavior === "MANUAL_REVIEW") {
          status = "needs-decision";
          conflictState = "late-review";
          lateReason = "This late play requires a Creative decision.";
        } else {
          status = "missed";
          lateReason = "The configured late behavior skips plays that have passed.";
        }
      }

      plays.push({
        id: idFactory(templatePlay, week.weekNumber),
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignLevel: Number(campaign.level || playbook.level),
        campaignType: campaign.campaignType || playbook.campaignType,
        playbookId: playbook.id,
        playbookVersion: Number(playbook.version || 1),
        templatePlayId: templatePlay.id,
        weekNumber: Number(week.weekNumber),
        phase: week.phase,
        playType: templatePlay.playType,
        channel: templatePlay.channel,
        resourceId: templatePlay.resourceId,
        originalScheduledDate,
        scheduledDate,
        eligibleWeekdays,
        requirement: templatePlay.requirement || "required",
        lateBehavior: templatePlay.lateBehavior || "SKIP",
        supportsSmuggle: templatePlay.supportsSmuggle === true,
        status,
        source: "campaign-generation",
        manuallyAdjusted: false,
        locked: false,
        conflictState,
        conflictReason: "",
        lateReason,
        smuggle: null,
      });
    });
  });

  return {
    campaign: {
      ...campaign,
      durationWeeks: playbook.durationWeeks,
      playbookId: playbook.id,
      playbookVersion: Number(playbook.version || 1),
      ...timeliness,
      currentWeek: campaignWeekForDate({
        eventDate: campaign.eventDate,
        durationWeeks: playbook.durationWeeks,
        value: today,
      }),
    },
    plays,
    summary: scheduleSummary(plays),
  };
}

export function scheduleSummary(plays) {
  const list = Array.isArray(plays) ? plays : [];
  return {
    total: list.length,
    missed: list.filter((play) => play.status === "missed").length,
    skipped: list.filter((play) => play.status === "skipped").length,
    rescheduled: list.filter((play) => play.status === "rescheduled").length,
    remaining: list.filter((play) =>
      ["scheduled", "rescheduled", "conflict", "needs-decision"].includes(play.status),
    ).length,
    conflicts: list.filter((play) =>
      play.status === "conflict" || play.conflictState !== "none",
    ).length,
  };
}

export function weeklyInventoryPlays({
  plays,
  weekStart,
  weekEnd = addDays(weekStart, 6),
  resourceId = "",
  campaignLevel = null,
}) {
  return (Array.isArray(plays) ? plays : [])
    .filter((play) => play.scheduledDate >= weekStart && play.scheduledDate <= weekEnd)
    .filter((play) => resourceId ? play.resourceId === resourceId : Number(play.campaignLevel) === Number(campaignLevel))
    .sort((left, right) =>
      Number(left.campaignLevel || 5) - Number(right.campaignLevel || 5) ||
      String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
      String(left.campaignName).localeCompare(String(right.campaignName)) ||
      String(left.playType).localeCompare(String(right.playType)),
    );
}

export function groupCalendarCampaignDays(plays) {
  const groups = new Map();
  (Array.isArray(plays) ? plays : []).forEach((play) => {
    const campaignId = String(play.campaignId || "uncategorized");
    const scheduledDate = dateKey(play.scheduledDate);
    const key = `${campaignId}:${scheduledDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `campaign-day:${key}`,
        campaignId,
        campaignName: play.campaignName || "Uncategorized promotion",
        campaignLevel: Number(play.campaignLevel || 1),
        campaignType: play.campaignType || "",
        scheduledDate,
        plays: [],
      });
    }
    groups.get(key).plays.push(play);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      plays: [...group.plays].sort((left, right) =>
        String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
        String(left.playType).localeCompare(String(right.playType)),
      ),
    }))
    .sort((left, right) =>
      left.scheduledDate.localeCompare(right.scheduledDate) ||
      Number(left.campaignLevel) - Number(right.campaignLevel) ||
      left.campaignName.localeCompare(right.campaignName),
    );
}

function resourcePeriodKey(play, rule) {
  const date = play.scheduledDate;
  if (rule.capacityPeriod === "week" || rule.capacityPeriod === "sunday") {
    return startOfSundayWeek(date);
  }
  return date;
}

function capacityThresholds(rule) {
  const capacity = Math.max(1, Number(rule.capacity || 1));
  const typicalCapacity = Math.min(
    capacity,
    Math.max(1, Number(rule.typicalCapacity || capacity)),
  );
  return {capacity, typicalCapacity};
}

export function evaluateCapacity({plays, capacityRules, campaigns = []}) {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const next = plays.map((play) => ({...play}));
  const rules = new Map((capacityRules || []).map((rule) => [rule.id, rule]));
  const groups = new Map();

  next.forEach((play) => {
    if (!["scheduled", "rescheduled"].includes(play.status)) return;
    const rule = rules.get(play.resourceId);
    if (!rule || rule.active === false) return;
    if (Array.isArray(rule.allowedWeekdays) && rule.allowedWeekdays.length) {
      const weekday = utcDateFromKey(play.scheduledDate).getUTCDay();
      if (!rule.allowedWeekdays.includes(weekday)) {
        play.status = "conflict";
        play.conflictState = "invalid-weekday";
        play.conflictReason = `${rule.name} is not available on this weekday.`;
        return;
      }
    }
    const key = `${rule.id}:${resourcePeriodKey(play, rule)}`;
    if (!groups.has(key)) groups.set(key, {rule, plays: []});
    groups.get(key).plays.push(play);
  });

  const conflicts = [];
  groups.forEach(({rule, plays: candidates}, key) => {
    const {capacity, typicalCapacity} = capacityThresholds(rule);
    if (candidates.length <= capacity) return;
    const ordered = [...candidates].sort((left, right) =>
      compareCampaignPriority(
        campaignMap.get(left.campaignId) || left,
        campaignMap.get(right.campaignId) || right,
      ),
    );
    const winners = ordered.slice(0, capacity);
    const overflow = ordered.slice(capacity);
    overflow.forEach((play) => {
      play.status = "conflict";
      play.conflictState = "capacity-overflow";
      play.conflictReason = `${candidates.length} campaigns need ${capacity} available ${rule.name} slot${capacity === 1 ? "" : "s"}. The normal planning target is ${typicalCapacity}.`;
    });
    conflicts.push({
      id: key,
      resourceId: rule.id,
      resourceName: rule.name,
      period: key.slice(key.indexOf(":") + 1),
      capacity,
      typicalCapacity,
      campaignCount: candidates.length,
      recommendedPlayIds: winners.map((play) => play.id),
      overflowPlayIds: overflow.map((play) => play.id),
      reason: "Recommended by promotion level, campaign type, timeliness, deadline proximity, then submission time.",
      requiresDecision: rule.autoResolve !== true,
    });
  });
  return {plays: next, conflicts};
}

export function allocateLevel4SocialSlots({plays, campaigns = []}) {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const next = plays.map((play) => ({...play}));
  const groups = new Map();
  next.forEach((play) => {
    if (
      Number(play.campaignLevel) !== 4 ||
      play.resourceId !== "level-4-social" ||
      !["scheduled", "rescheduled"].includes(play.status)
    ) return;
    const key = startOfSundayWeek(play.originalScheduledDate || play.scheduledDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(play);
  });

  const conflicts = [];
  groups.forEach((candidates, weekStart) => {
    const slots = [addDays(weekStart, 1), addDays(weekStart, 5)];
    const ordered = [...candidates].sort((left, right) => {
      const leftCampaign = campaignMap.get(left.campaignId) || left;
      const rightCampaign = campaignMap.get(right.campaignId) || right;
      const leftValid = slots.filter((slot) => slot <= deadlineForCampaign(leftCampaign)).length;
      const rightValid = slots.filter((slot) => slot <= deadlineForCampaign(rightCampaign)).length;
      if (leftValid !== rightValid) return leftValid - rightValid;
      return compareCampaignPriority(leftCampaign, rightCampaign);
    });
    const used = new Set();
    ordered.forEach((play) => {
      const campaign = campaignMap.get(play.campaignId) || play;
      const deadline = deadlineForCampaign(campaign);
      const valid = slots.filter((slot) => slot <= deadline && !used.has(slot));
      if (!valid.length) {
        play.status = "conflict";
        play.conflictState = "level-4-social-overflow";
        play.conflictReason = "Both shared Level 4 Social slots are already allocated or fall after the campaign deadline.";
        return;
      }
      const chosen = valid[0];
      used.add(chosen);
      if (play.scheduledDate !== chosen) {
        play.scheduledDate = chosen;
        play.status = play.originalScheduledDate === chosen ? "scheduled" : "rescheduled";
      }
    });
    const overflow = ordered.filter((play) => play.conflictState === "level-4-social-overflow");
    if (overflow.length) {
      conflicts.push({
        id: `level-4-social:${weekStart}`,
        resourceId: "level-4-social",
        resourceName: "Level 4 Social",
        period: weekStart,
        capacity: 2,
        campaignCount: candidates.length,
        recommendedPlayIds: ordered.filter((play) => !overflow.includes(play)).map((play) => play.id),
        overflowPlayIds: overflow.map((play) => play.id),
        reason: "Constrained deadlines are protected first, followed by campaign priority and timeliness.",
        requiresDecision: true,
      });
    }
  });
  return {plays: next, conflicts};
}

export function ensureLevel2StandingLane({weekStart, plays, ongoingPlaybook}) {
  const start = startOfSundayWeek(weekStart);
  const end = addDays(start, 6);
  const existing = (plays || []).filter((play) =>
    Number(play.campaignLevel) === 2 &&
    play.scheduledDate >= start &&
    play.scheduledDate <= end &&
    !["missed", "skipped"].includes(play.status),
  );
  if (existing.length) {
    return {covered: true, source: "event-campaign", plays: existing};
  }
  const template = ongoingPlaybook?.weeks?.[0];
  const generated = (template?.plays || []).map((play) => ({
    id: `standing_${start}_${play.id}`,
    campaignId: `standing-level-2-${start}`,
    campaignName: "Level 2 Ongoing",
    campaignLevel: 2,
    campaignType: "ongoing",
    playbookId: ongoingPlaybook.id,
    playbookVersion: ongoingPlaybook.version,
    templatePlayId: play.id,
    weekNumber: 1,
    phase: template.phase,
    playType: play.playType,
    channel: play.channel,
    resourceId: play.resourceId,
    originalScheduledDate: addDays(start, normalizedEligibleDays(play)[0] || 0),
    scheduledDate: addDays(start, normalizedEligibleDays(play)[0] || 0),
    eligibleWeekdays: normalizedEligibleDays(play),
    requirement: play.requirement || "required",
    lateBehavior: play.lateBehavior || "SKIP",
    supportsSmuggle: play.supportsSmuggle === true,
    status: "scheduled",
    source: "standing-lane",
    manuallyAdjusted: false,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    lateReason: "",
    smuggle: null,
  }));
  return {covered: generated.length > 0, source: "ongoing", plays: generated};
}

export function recommendSmuggleOpportunities({
  hostPlays,
  campaigns,
  now = new Date(),
  eligibleLevels = [4, 5],
}) {
  const today = dateKey(now);
  const campaignById = new Map((campaigns || []).map((campaign) => [campaign.id, campaign]));
  const relationships = buildSmuggleRelationships({plays: hostPlays, campaigns});
  const alreadyPlacedPlayIds = new Set(relationships.map((relationship) => relationship.beneficiaryPlayId).filter(Boolean));
  const legacyPlacedCampaignIds = new Set(relationships
    .filter((relationship) => !relationship.beneficiaryPlayId)
    .map((relationship) => relationship.beneficiaryCampaignId));
  const candidates = new Map((campaigns || []).filter((campaign) =>
    campaign.campaignType !== "standalone-content" &&
    eligibleLevels.includes(Number(campaign.level)) &&
    dateKey(campaign.eventDate) >= today &&
    !legacyPlacedCampaignIds.has(campaign.id) &&
    campaign.status !== "archived",
  ).map((campaign) => [campaign.id, campaign]));
  const beneficiaryPlays = (hostPlays || []).filter((play) =>
    candidates.has(play.campaignId) &&
    !alreadyPlacedPlayIds.has(play.id) &&
    play.scheduledDate >= today &&
    ["scheduled", "rescheduled", "conflict", "needs-decision"].includes(play.status),
  );
  const opportunities = [];
  (hostPlays || []).filter((play) =>
    [1, 2, 3].includes(Number(play.campaignLevel)) &&
    canHostSmuggle(play) &&
    !play.smuggle &&
    play.scheduledDate >= today &&
    ["scheduled", "rescheduled"].includes(play.status),
  ).forEach((hostPlay) => {
    const hostCampaign = campaignById.get(hostPlay.campaignId) || {};
    beneficiaryPlays
      .filter((beneficiaryPlay) =>
        beneficiaryPlay.campaignId !== hostPlay.campaignId &&
        smuggleAnnouncementsMatch(hostPlay, beneficiaryPlay),
      )
      .forEach((beneficiaryPlay) => {
        const campaign = candidates.get(beneficiaryPlay.campaignId);
        opportunities.push({
          id: `${hostPlay.id}_${beneficiaryPlay.id}`,
          hostCampaignId: hostPlay.campaignId,
          hostScheduledPlayId: hostPlay.id,
          beneficiaryCampaignId: campaign.id,
          beneficiaryScheduledPlayId: beneficiaryPlay.id,
          strategy: "SMUGGLE",
          beneficiaryName: campaign.name,
          beneficiaryLevel: Number(campaign.level),
          beneficiaryPlayType: beneficiaryPlay.playType,
          beneficiaryChannel: beneficiaryPlay.channel,
          hostCampaignName: hostCampaign.name || hostPlay.campaignName || "Higher-level campaign",
          hostCampaignLevel: Number(hostCampaign.level || hostPlay.campaignLevel),
          hostPlayType: hostPlay.playType,
          hostChannel: hostPlay.channel,
          scheduledDate: hostPlay.scheduledDate,
          scoreReason: `Both campaigns have a ${hostPlay.playType} planned for ${hostPlay.scheduledDate}.`,
          applied: false,
        });
      });
  });
  return opportunities.sort((left, right) =>
    Number(left.beneficiaryLevel) - Number(right.beneficiaryLevel) ||
    String(left.beneficiaryName).localeCompare(String(right.beneficiaryName)) ||
    String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
    String(left.beneficiaryPlayType).localeCompare(String(right.beneficiaryPlayType)) ||
    Number(left.hostCampaignLevel) - Number(right.hostCampaignLevel) ||
    String(left.hostCampaignName).localeCompare(String(right.hostCampaignName)),
  );
}

const SMUGGLE_HOST_RESOURCE_IDS = new Set([
  "stage-announcement",
  "social-sprinkle",
  "ministry-social",
  "main-social-crosspost",
]);

export function canHostSmuggle(play) {
  return play?.supportsSmuggle === true || SMUGGLE_HOST_RESOURCE_IDS.has(String(play?.resourceId || ""));
}

export function smuggleAnnouncementsMatch(hostPlay, beneficiaryPlay) {
  if (!hostPlay || !beneficiaryPlay || hostPlay.scheduledDate !== beneficiaryPlay.scheduledDate) return false;
  const hostType = String(hostPlay.playType || "").trim().toLowerCase();
  const beneficiaryType = String(beneficiaryPlay.playType || "").trim().toLowerCase();
  if (hostType && hostType === beneficiaryType) return true;
  const hostResource = String(hostPlay.resourceId || "").trim();
  const beneficiaryResource = String(beneficiaryPlay.resourceId || "").trim();
  return Boolean(hostResource && hostResource === beneficiaryResource);
}

export function buildSmuggleRelationships({plays = [], campaigns = []} = {}) {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  return plays.filter((play) => play.smuggle?.beneficiaryCampaignId).map((play) => {
    const hostCampaign = campaignById.get(play.campaignId) || {};
    const beneficiaryCampaign = campaignById.get(play.smuggle.beneficiaryCampaignId) || {};
    const beneficiaryPlay = plays
      .filter((candidate) =>
        candidate.campaignId === play.smuggle.beneficiaryCampaignId &&
        !["missed", "skipped"].includes(candidate.status) &&
        smuggleAnnouncementsMatch(play, candidate),
      )
      .sort((left, right) => {
        const leftExactResource = left.resourceId && left.resourceId === play.resourceId ? 0 : 1;
        const rightExactResource = right.resourceId && right.resourceId === play.resourceId ? 0 : 1;
        return leftExactResource - rightExactResource || String(left.id).localeCompare(String(right.id));
      })[0] || null;
    return {
      id: `${play.id}:${play.smuggle.beneficiaryCampaignId}`,
      hostPlayId: play.id,
      hostCampaignId: play.campaignId || play.smuggle.hostCampaignId,
      hostCampaignName: hostCampaign.name || play.campaignName || "Higher-level campaign",
      hostCampaignLevel: Number(hostCampaign.level || play.campaignLevel || 3),
      hostPlayType: play.playType || "Promotion",
      hostChannel: play.channel || "",
      scheduledDate: play.scheduledDate || "",
      beneficiaryCampaignId: play.smuggle.beneficiaryCampaignId,
      beneficiaryName: beneficiaryCampaign.name || play.smuggle.beneficiaryName || "Lower-level campaign",
      beneficiaryLevel: Number(beneficiaryCampaign.level || 5),
      beneficiaryPlayId: beneficiaryPlay?.id || "",
      beneficiaryPlayType: beneficiaryPlay?.playType || play.playType || "Promotion",
      beneficiaryChannel: beneficiaryPlay?.channel || "",
    };
  }).sort((left, right) =>
    String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
    Number(left.hostCampaignLevel) - Number(right.hostCampaignLevel) ||
    String(left.hostCampaignName).localeCompare(String(right.hostCampaignName)),
  );
}

export function smuggledBeneficiaryPlayIds({plays = [], campaigns = []} = {}) {
  return new Set(buildSmuggleRelationships({plays, campaigns})
    .map((relationship) => relationship.beneficiaryPlayId)
    .filter(Boolean));
}

export function applySmuggle(play, opportunity) {
  if (!canHostSmuggle(play)) throw new Error("This promotion does not support Smuggle.");
  if (!opportunity || opportunity.hostScheduledPlayId !== play.id) {
    throw new Error("The Smuggle opportunity does not match this host play.");
  }
  return {
    ...play,
    smuggle: {
      hostCampaignId: opportunity.hostCampaignId,
      hostScheduledPlayId: opportunity.hostScheduledPlayId,
      beneficiaryCampaignId: opportunity.beneficiaryCampaignId,
      beneficiaryName: opportunity.beneficiaryName,
      strategy: "SMUGGLE",
    },
  };
}

export function cancelSmuggle(play) {
  if (!play?.id) throw new Error("A Smuggle host promotion is required.");
  if (!play.smuggle?.beneficiaryCampaignId) {
    throw new Error("This promotion does not have an active Smuggle.");
  }
  return {
    ...play,
    smuggle: null,
  };
}

export function skipPromotion(play) {
  if (!play?.id) throw new Error("A scheduled promotion is required.");
  return {
    ...play,
    status: "skipped",
    conflictState: "none",
    conflictReason: "",
    smuggle: null,
    manuallyAdjusted: true,
  };
}

export function utilizationForWeek({weekStart, plays, capacityRules}) {
  const start = startOfSundayWeek(weekStart);
  const end = addDays(start, 6);
  const smuggledPlayIds = smuggledBeneficiaryPlayIds({plays});
  const active = (plays || []).filter((play) =>
    play.scheduledDate >= start &&
    play.scheduledDate <= end &&
    !smuggledPlayIds.has(play.id) &&
    !["missed", "skipped"].includes(play.status),
  );
  return (capacityRules || []).filter((rule) => rule.showOnDashboard !== false).map((rule) => {
    const {capacity, typicalCapacity} = capacityThresholds(rule);
    const used = active.filter((play) => play.resourceId === rule.id).length;
    const capacityState = used > capacity ? "conflict" :
      used === capacity ? "full" :
      used > typicalCapacity ? "above-typical" :
      used === typicalCapacity ? "typical" : "available";
    return {...rule, capacity, typicalCapacity, used, capacityState};
  });
}
