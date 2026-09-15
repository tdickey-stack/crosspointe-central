import {
  addDays,
  buildSmuggleRelationships,
  compareCampaignPriority,
  dateKey,
  differenceInDays,
  generateCampaignSchedule,
  smuggledBeneficiaryPlayIds,
  startOfSundayWeek,
  utcDateFromKey,
} from "./domain.js";
import {expandRecurrence, normalizeRecurrence} from "./recurrence.js";
import {Temporal} from "temporal-polyfill";

const CAPACITY_CONFLICT_STATES = new Set([
  "capacity-overflow",
  "invalid-weekday",
  "level-4-social-overflow",
]);

function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${label} must be a positive integer${Number.isFinite(maximum) ? ` no greater than ${maximum}` : ""}.`);
  }
  return number;
}

function validateDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a valid date.`);
  try {
    const date = Temporal.PlainDate.from(value);
    if (date.toString() !== value) throw new Error();
    return date.toString();
  } catch {
    throw new Error(`${label} must be a valid date.`);
  }
}

function normalizeSeries(series) {
  if (!series || typeof series !== "object" || Array.isArray(series)) throw new Error("A series is required.");
  const id = String(series.id || "").trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("Series id must be a short id containing only letters, numbers, underscores, or hyphens.");
  const name = String(series.name || "").trim();
  if (!name) throw new Error("Series name is required.");
  const playbookId = String(series.playbookId || "").trim();
  if (!playbookId) throw new Error("Series playbook id is required.");
  const playbookVersion = positiveInteger(series.playbookVersion, "Series playbook version");
  const level = positiveInteger(series.level, "Series level", 5);
  const campaignType = String(series.campaignType || "").trim();
  if (!campaignType) throw new Error("Series campaign type is required.");
  if (!series.submittedAt || Number.isNaN(new Date(series.submittedAt).getTime())) throw new Error("Series submitted time is required.");
  const status = String(series.status || "");
  if (!new Set(["active", "ended"]).has(status)) throw new Error("Series status must be active or ended.");
  const revision = positiveInteger(series.revision, "Series revision");
  const deadlineOffsetDays = series.deadlineOffsetDays == null || series.deadlineOffsetDays === ""
    ? null
    : Number(series.deadlineOffsetDays);
  if (deadlineOffsetDays != null && (!Number.isInteger(deadlineOffsetDays) || deadlineOffsetDays < 0 || deadlineOffsetDays > 365)) {
    throw new Error("Deadline offset must be from 0 to 365 days.");
  }
  return {
    ...series,
    id,
    name,
    recurrence: normalizeRecurrence(series.recurrence),
    playbookId,
    playbookVersion,
    level,
    campaignType,
    submittedAt: series.submittedAt instanceof Date ? series.submittedAt.toISOString() : String(series.submittedAt),
    sourceEventId: String(series.sourceEventId || ""),
    eventDetails: String(series.eventDetails || ""),
    sampleAnnouncement: String(series.sampleAnnouncement || ""),
    notes: String(series.notes || ""),
    deadlineOffsetDays,
    status,
    revision,
  };
}

function assertPlaybook(series, playbook) {
  if (!playbook?.id || !Array.isArray(playbook.weeks)) throw new Error("A valid pinned playbook is required.");
  if (playbook.id !== series.playbookId || Number(playbook.version || 1) !== series.playbookVersion) {
    throw new Error(`Playbook ${series.playbookId} version ${series.playbookVersion} is required for this series.`);
  }
}

function registrationDeadline(eventDate, offset) {
  return offset == null ? "" : addDays(eventDate, -offset);
}

function campaignFields(series, occurrenceKey, id) {
  return {
    id,
    name: series.name,
    eventDate: occurrenceKey,
    registrationDeadline: registrationDeadline(occurrenceKey, series.deadlineOffsetDays),
    submittedAt: series.submittedAt,
    level: series.level,
    campaignType: series.campaignType,
    status: "active",
    sourceEventId: series.sourceEventId,
    eventDetails: series.eventDetails,
    sampleAnnouncement: series.sampleAnnouncement,
    notes: series.notes,
    deadlineOffsetDays: series.deadlineOffsetDays,
    playbookId: series.playbookId,
    playbookVersion: series.playbookVersion,
    seriesId: series.id,
    occurrenceKey,
    seriesRevision: series.revision,
    recurrenceException: false,
  };
}

function hasSmuggle(play) {
  return play?.smuggle && typeof play.smuggle === "object";
}

function protectedPlay(play, today) {
  return play?.locked === true || play?.manuallyAdjusted === true || play?.status === "completed" ||
    play?.status === "skipped" || hasSmuggle(play) || String(play?.scheduledDate || "") < today;
}

function protectedCampaign(campaign, today) {
  return campaign?.status === "completed" || String(campaign?.eventDate || "") < today;
}

function automaticallyRemovedPlay(play) {
  return play?.status === "skipped" && [
    "Removed from the active plan by recurrence update.",
    "Skipped because this date is no longer in the recurring series.",
    "Skipped because the recurring series ended.",
  ].includes(String(play.lateReason || ""));
}

function withoutWriteMetadata(value) {
  if (Array.isArray(value)) return value.map(withoutWriteMetadata);
  if (!value || typeof value !== "object") return value;
  const next = {};
  Object.keys(value).sort().forEach((key) => {
    if (!["createdAt", "createdByUid", "updatedAt", "updatedByUid"].includes(key)) next[key] = withoutWriteMetadata(value[key]);
  });
  return next;
}

function recordsEqual(left, right) {
  return JSON.stringify(withoutWriteMetadata(left)) === JSON.stringify(withoutWriteMetadata(right));
}

function baseStatus(play) {
  return play.scheduledDate === play.originalScheduledDate ? "scheduled" : "rescheduled";
}

function resetCapacityResult(play, isProtected) {
  if (isProtected || !CAPACITY_CONFLICT_STATES.has(play.conflictState)) return {...play};
  return {
    ...play,
    status: baseStatus(play),
    conflictState: "none",
    conflictReason: "",
  };
}

function campaignDeadline(campaign) {
  const eventDate = validateDate(campaign.eventDate, "Campaign event date");
  if (!campaign.registrationDeadline) return eventDate;
  const deadline = validateDate(campaign.registrationDeadline, "Campaign registration deadline");
  return deadline < eventDate ? deadline : eventDate;
}

function allocateLevel4WithProtected({plays, campaigns, protectedIds}) {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const next = plays.map((play) => resetCapacityResult(play, protectedIds.has(play.id)));
  const groups = new Map();
  next.forEach((play) => {
    if (Number(play.campaignLevel) !== 4 || play.resourceId !== "level-4-social" ||
      !["scheduled", "rescheduled"].includes(play.status)) return;
    const allocationAnchor = protectedIds.has(play.id)
      ? play.scheduledDate
      : (play.originalScheduledDate || play.scheduledDate);
    const key = startOfSundayWeek(allocationAnchor);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(play);
  });
  const conflicts = [];
  groups.forEach((candidates, weekStart) => {
    const protectedCandidates = candidates.filter((play) => protectedIds.has(play.id));
    const mutable = candidates.filter((play) => !protectedIds.has(play.id));
    const standardSlots = [addDays(weekStart, 1), addDays(weekStart, 5)];
    const occupiedStandard = new Set(protectedCandidates.map((play) => play.scheduledDate).filter((date) => standardSlots.includes(date)));
    const capacityRemaining = Math.max(0, 2 - protectedCandidates.length);
    const available = standardSlots.filter((slot) => !occupiedStandard.has(slot)).slice(0, capacityRemaining);
    const ordered = [...mutable].sort((left, right) => {
      const leftCampaign = campaignMap.get(left.campaignId) || left;
      const rightCampaign = campaignMap.get(right.campaignId) || right;
      const leftValid = available.filter((slot) => slot <= campaignDeadline(leftCampaign)).length;
      const rightValid = available.filter((slot) => slot <= campaignDeadline(rightCampaign)).length;
      if (leftValid !== rightValid) return leftValid - rightValid;
      return compareCampaignPriority(leftCampaign, rightCampaign);
    });
    const used = new Set();
    ordered.forEach((play) => {
      const deadline = campaignDeadline(campaignMap.get(play.campaignId) || play);
      const chosen = available.find((slot) => slot <= deadline && !used.has(slot));
      if (!chosen) {
        play.status = "conflict";
        play.conflictState = "level-4-social-overflow";
        play.conflictReason = protectedCandidates.length
          ? "Protected Level 4 Social promotions already use the available weekly capacity."
          : "Both shared Level 4 Social slots are already allocated or fall after the campaign deadline.";
        return;
      }
      used.add(chosen);
      play.scheduledDate = chosen;
      play.status = baseStatus(play);
      play.conflictState = "none";
      play.conflictReason = "";
    });
    const overflow = ordered.filter((play) => play.conflictState === "level-4-social-overflow");
    const protectedOverflow = protectedCandidates.length > 2 ? protectedCandidates.slice(2) : [];
    if (overflow.length || protectedOverflow.length) {
      conflicts.push({
        id: `level-4-social:${weekStart}`,
        resourceId: "level-4-social",
        resourceName: "Level 4 Social",
        period: weekStart,
        capacity: 2,
        campaignCount: candidates.length,
        recommendedPlayIds: [...protectedCandidates.slice(0, 2).map((play) => play.id), ...ordered.filter((play) => !overflow.includes(play)).map((play) => play.id)],
        overflowPlayIds: [...protectedOverflow.map((play) => play.id), ...overflow.map((play) => play.id)],
        protectedPlayIds: protectedCandidates.map((play) => play.id),
        protectedOverflowPlayIds: protectedOverflow.map((play) => play.id),
        involvesProtected: protectedCandidates.length > 0,
        reason: protectedCandidates.length ? "Existing protected promotions retain their dates before new series promotions are allocated." : "Constrained deadlines are protected first, followed by campaign priority and timeliness.",
        requiresDecision: true,
      });
    }
  });
  return {plays: next, conflicts};
}

function periodKey(play, rule) {
  return rule.capacityPeriod === "week" || rule.capacityPeriod === "sunday"
    ? startOfSundayWeek(play.scheduledDate)
    : play.scheduledDate;
}

function evaluateCapacityWithProtected({plays, campaigns, capacityRules, protectedIds}) {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const next = plays.map((play) => ({...play}));
  const groups = new Map();
  const rules = new Map((capacityRules || []).filter((rule) => rule.id !== "level-4-social").map((rule) => [rule.id, rule]));
  next.forEach((play) => {
    if (!["scheduled", "rescheduled"].includes(play.status)) return;
    const rule = rules.get(play.resourceId);
    if (!rule || rule.active === false) return;
    if (Array.isArray(rule.allowedWeekdays) && rule.allowedWeekdays.length) {
      const weekday = utcDateFromKey(play.scheduledDate).getUTCDay();
      if (!rule.allowedWeekdays.includes(weekday) && !protectedIds.has(play.id)) {
        play.status = "conflict";
        play.conflictState = "invalid-weekday";
        play.conflictReason = `${rule.name} is not available on this weekday.`;
        return;
      }
    }
    const key = `${rule.id}:${periodKey(play, rule)}`;
    if (!groups.has(key)) groups.set(key, {rule, plays: []});
    groups.get(key).plays.push(play);
  });
  const conflicts = [];
  groups.forEach(({rule, plays: candidates}, key) => {
    const capacity = Math.max(1, Number(rule.capacity || 1));
    if (candidates.length <= capacity) return;
    const protectedCandidates = candidates.filter((play) => protectedIds.has(play.id));
    const mutable = candidates.filter((play) => !protectedIds.has(play.id)).sort((left, right) =>
      compareCampaignPriority(campaignMap.get(left.campaignId) || left, campaignMap.get(right.campaignId) || right),
    );
    const mutableWinners = mutable.slice(0, Math.max(0, capacity - protectedCandidates.length));
    const overflow = mutable.slice(mutableWinners.length);
    overflow.forEach((play) => {
      play.status = "conflict";
      play.conflictState = "capacity-overflow";
      play.conflictReason = protectedCandidates.length
        ? `${protectedCandidates.length} protected promotion${protectedCandidates.length === 1 ? "" : "s"} already use this ${rule.name} capacity.`
        : `${candidates.length} campaigns need ${capacity} available ${rule.name} slot${capacity === 1 ? "" : "s"}.`;
    });
    const protectedOverflow = protectedCandidates.slice(capacity);
    conflicts.push({
      id: key,
      resourceId: rule.id,
      resourceName: rule.name,
      period: key.slice(key.indexOf(":") + 1),
      capacity,
      typicalCapacity: Math.min(capacity, Math.max(1, Number(rule.typicalCapacity || capacity))),
      campaignCount: candidates.length,
      recommendedPlayIds: [...protectedCandidates.slice(0, capacity).map((play) => play.id), ...mutableWinners.map((play) => play.id)],
      overflowPlayIds: [...protectedOverflow.map((play) => play.id), ...overflow.map((play) => play.id)],
      protectedPlayIds: protectedCandidates.map((play) => play.id),
      protectedOverflowPlayIds: protectedOverflow.map((play) => play.id),
      involvesProtected: protectedCandidates.length > 0,
      reason: protectedCandidates.length ? "Existing protected promotions retain their state before remaining capacity is recommended." : "Recommended by promotion level, campaign type, timeliness, deadline proximity, then submission time.",
      requiresDecision: rule.autoResolve !== true,
    });
  });
  return {plays: next, conflicts};
}

function applyWorkspaceCapacity({campaigns, plays, capacityRules, protectedIds}) {
  const social = allocateLevel4WithProtected({campaigns, plays, protectedIds});
  const capacity = evaluateCapacityWithProtected({campaigns, plays: social.plays, capacityRules, protectedIds});
  return {plays: capacity.plays, conflicts: [...social.conflicts, ...capacity.conflicts]};
}

function removedPlay(previous, reason) {
  return {
    ...previous,
    status: "skipped",
    conflictState: "none",
    conflictReason: "",
    lateReason: reason,
    smuggle: null,
  };
}

function mergeGeneratedPlays({campaign, playbook, existing, generatedAt, today, protectedIds = new Set(), occurrenceMove = false}) {
  const generated = generateCampaignSchedule({campaign, playbook, generatedAt});
  const priorById = new Map(existing.map((play) => [play.id, play]));
  const generatedIds = new Set(generated.plays.map((play) => play.id));
  const next = [];
  let preserved = 0;
  generated.plays.forEach((play) => {
    const previous = priorById.get(play.id);
    if (!previous) {
      next.push(play);
    } else if ((protectedPlay(previous, today) || protectedIds.has(previous.id)) && !automaticallyRemovedPlay(previous)) {
      next.push(previous);
      preserved += 1;
    } else {
      if (automaticallyRemovedPlay(previous)) protectedIds.delete(previous.id);
      const originalScheduledDate = previous.originalScheduledDate || play.originalScheduledDate;
      next.push({
        ...previous,
        ...play,
        originalScheduledDate,
        manuallyAdjusted: occurrenceMove && play.scheduledDate !== originalScheduledDate,
      });
    }
  });
  existing.filter((play) => !generatedIds.has(play.id)).forEach((previous) => {
    if (protectedPlay(previous, today) || protectedIds.has(previous.id)) {
      next.push(previous);
      preserved += 1;
    } else {
      next.push(removedPlay(previous, "Removed from the active plan by recurrence update."));
    }
  });
  return {campaign: generated.campaign, plays: next, preserved};
}

function buildWrites({originalCampaigns, originalPlays, desiredCampaigns, desiredPlays, conflicts, summary, series, expectedWorkspace = null, fromDate = "", seedCampaignId = ""}) {
  const campaignById = new Map(originalCampaigns.map((campaign) => [campaign.id, campaign]));
  const playById = new Map(originalPlays.map((play) => [play.id, play]));
  const campaignWrites = desiredCampaigns.filter((campaign) => {
    const previous = campaignById.get(campaign.id);
    return !previous || !recordsEqual(previous, campaign);
  });
  const playWrites = desiredPlays.filter((play) => {
    const previous = playById.get(play.id);
    return !previous || !recordsEqual(previous, play);
  });
  return {
    series,
    fromDate,
    seedCampaignId,
    campaigns: campaignWrites,
    plays: playWrites,
    expectedCampaigns: campaignWrites.flatMap((campaign) => campaignById.has(campaign.id) ? [campaignById.get(campaign.id)] : []),
    expectedPlays: playWrites.flatMap((play) => playById.has(play.id) ? [playById.get(play.id)] : []),
    writeCampaignIds: campaignWrites.map((campaign) => campaign.id),
    writePlayIds: playWrites.map((play) => play.id),
    summary: {...summary, conflicts: conflicts.length},
    conflicts,
    ...(expectedWorkspace ? {expectedWorkspace} : {}),
  };
}

function cancelFutureOccurrencePlays({campaignId, desiredPlayById, originalPlays, relationships, today, reason}) {
  let preserved = 0;
  let skipped = 0;
  const canceledIds = new Set();
  originalPlays.filter((play) => play.campaignId === campaignId).forEach((play) => {
    if (play.status === "completed" || String(play.scheduledDate || "") < today) {
      preserved += 1;
      return;
    }
    if (play.status === "skipped") {
      canceledIds.add(play.id);
      if (play.smuggle) desiredPlayById.set(play.id, {...play, smuggle: null});
      return;
    }
    desiredPlayById.set(play.id, removedPlay(play, reason));
    canceledIds.add(play.id);
    skipped += play.status === "skipped" ? 0 : 1;
  });
  relationships.forEach((relationship) => {
    if (!canceledIds.has(relationship.beneficiaryPlayId)) return;
    const host = desiredPlayById.get(relationship.hostPlayId);
    if (host?.smuggle && host.status !== "completed" && String(host.scheduledDate || "") >= today) {
      desiredPlayById.set(host.id, {...host, smuggle: null});
    }
  });
  return {preserved, skipped};
}

export function buildSeriesPlan({
  series,
  playbook,
  campaigns = [],
  plays = [],
  capacityRules = [],
  generatedAt = new Date(),
  scope = "future",
  fromDate = "",
  seedCampaignId = "",
} = {}) {
  const nextSeries = normalizeSeries(series);
  assertPlaybook(nextSeries, playbook);
  if (!new Set(["future", "all"]).has(scope)) throw new Error("Series scope must be future or all.");
  const today = dateKey(generatedAt);
  const requestedCutoff = fromDate || nextSeries.saveFromDate || "";
  const cutoff = requestedCutoff
    ? validateDate(requestedCutoff, "Future edit date")
    : (scope === "future" && nextSeries.recurrence.startDate < today ? today : nextSeries.recurrence.startDate);
  nextSeries.saveFromDate = cutoff;
  const occurrenceDates = nextSeries.status === "active" ? expandRecurrence(nextSeries.recurrence) : [];
  const seed = seedCampaignId ? campaigns.find((campaign) => campaign.id === seedCampaignId) : null;
  if (seedCampaignId && !seed) throw new Error("The campaign selected for conversion could not be found.");
  if (seed?.seriesId && seed.seriesId !== nextSeries.id) {
    throw new Error("The campaign selected for conversion already belongs to another series.");
  }
  const seedNeedsAdoption = Boolean(seed && !seed.seriesId);
  if (seedNeedsAdoption) {
    const seedDate = validateDate(seed.eventDate, "Seed campaign event date");
    if (nextSeries.recurrence.startDate !== seedDate || !occurrenceDates.includes(seedDate)) {
      throw new Error("The recurrence must start on and include the campaign being converted.");
    }
  }
  const seriesCampaigns = campaigns.filter((campaign) => campaign.seriesId === nextSeries.id || campaign.id === seedCampaignId);
  const existingByOccurrence = new Map(seriesCampaigns.filter((campaign) => campaign.occurrenceKey || campaign.id === seedCampaignId).map((campaign) => [campaign.occurrenceKey || validateDate(campaign.eventDate, "Seed campaign event date"), campaign]));
  const targetedExisting = seriesCampaigns.filter((campaign) => scope === "all" || String(campaign.occurrenceKey || campaign.eventDate) >= cutoff);
  const targetIds = new Set(targetedExisting.map((campaign) => campaign.id));
  const desiredCampaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const desiredPlayById = new Map(plays.map((play) => [play.id, play]));
  const protectedIds = new Set([
    ...plays.filter((play) => protectedPlay(play, today)).map((play) => play.id),
    ...smuggledBeneficiaryPlayIds({plays, campaigns}),
  ]);
  let preserved = 0;
  let skipped = 0;
  let promotions = 0;
  const desiredOccurrenceKeys = new Set();
  const relationships = buildSmuggleRelationships({plays, campaigns});

  if (seedNeedsAdoption && protectedCampaign(seed, today)) {
    const occurrenceKey = validateDate(seed.eventDate, "Seed campaign event date");
    desiredOccurrenceKeys.add(occurrenceKey);
    targetIds.add(seed.id);
    desiredCampaignById.set(seed.id, {
      ...seed,
      seriesId: nextSeries.id,
      occurrenceKey,
      seriesRevision: nextSeries.revision,
      recurrenceException: false,
    });
    preserved += 1 + plays.filter((play) => play.campaignId === seed.id).length;
  }

  if (nextSeries.status === "active") {
    occurrenceDates.filter((occurrenceKey) => scope === "all" || occurrenceKey >= cutoff).forEach((occurrenceKey) => {
      desiredOccurrenceKeys.add(occurrenceKey);
      const existing = existingByOccurrence.get(occurrenceKey);
      if (seedNeedsAdoption && existing?.id === seed.id && protectedCampaign(seed, today)) return;
      if (existing && scope === "future" && protectedCampaign(existing, today)) {
        preserved += 1 + plays.filter((play) => play.campaignId === existing.id).length;
        return;
      }
      if (existing?.recurrenceException === true) {
        preserved += 1;
        return;
      }
      if (existing && existing.playbookId === nextSeries.playbookId && Number(existing.playbookVersion || 1) !== nextSeries.playbookVersion) {
        preserved += 1 + plays.filter((play) => play.campaignId === existing.id).length;
        return;
      }
      const id = existing?.id || (seed && validateDate(seed.eventDate, "Seed campaign event date") === occurrenceKey ? seed.id : `${nextSeries.id}_${occurrenceKey}`);
      targetIds.add(id);
      const fields = campaignFields(nextSeries, occurrenceKey, id);
      const campaign = existing ? {...existing, ...fields} : fields;
      const existingPlays = plays.filter((play) => play.campaignId === id);
      const generated = mergeGeneratedPlays({campaign, playbook, existing: existingPlays, generatedAt, today, protectedIds});
      desiredCampaignById.set(id, existing ? {...existing, ...generated.campaign} : generated.campaign);
      generated.plays.forEach((play) => desiredPlayById.set(play.id, play));
      generated.plays.filter((play) => !["skipped", "missed"].includes(play.status)).forEach(() => { promotions += 1; });
      preserved += generated.preserved;
    });
  }

  targetedExisting.forEach((campaign) => {
    const occurrenceKey = String(campaign.occurrenceKey || campaign.eventDate);
    if (desiredOccurrenceKeys.has(occurrenceKey)) return;
    if (scope === "future" && protectedCampaign(campaign, today)) {
      preserved += 1 + plays.filter((play) => play.campaignId === campaign.id).length;
      return;
    }
    if (campaign.recurrenceException === true && nextSeries.status !== "ended") return;
    desiredCampaignById.set(campaign.id, {...campaign, status: "archived", seriesId: nextSeries.id, occurrenceKey, seriesRevision: nextSeries.revision});
    if (nextSeries.status === "ended") {
      const cancellation = cancelFutureOccurrencePlays({
        campaignId: campaign.id,
        desiredPlayById,
        originalPlays: plays,
        relationships,
        today,
        reason: "Skipped because the recurring series ended.",
      });
      preserved += cancellation.preserved;
      skipped += cancellation.skipped;
      return;
    }
    plays.filter((play) => play.campaignId === campaign.id).forEach((play) => {
      if (protectedPlay(play, today) || protectedIds.has(play.id)) preserved += 1;
      else {
        desiredPlayById.set(play.id, removedPlay(play, "Skipped because this date is no longer in the recurring series."));
        skipped += 1;
      }
    });
  });

  const fullCampaigns = [...desiredCampaignById.values()];
  const fullPlays = [...desiredPlayById.values()];
  fullPlays.filter((play) => protectedPlay(play, today)).forEach((play) => protectedIds.add(play.id));
  const allocated = applyWorkspaceCapacity({campaigns: fullCampaigns, plays: fullPlays, capacityRules, protectedIds});
  const targetCampaigns = fullCampaigns.filter((campaign) => targetIds.has(campaign.id));
  return buildWrites({
    originalCampaigns: campaigns,
    originalPlays: plays,
    desiredCampaigns: targetCampaigns,
    desiredPlays: allocated.plays,
    conflicts: allocated.conflicts,
    summary: {occurrences: occurrenceDates.length, promotions, preserved, skipped},
    series: nextSeries,
    fromDate: cutoff,
    seedCampaignId,
    expectedWorkspace: {campaigns, plays, capacityRules},
  });
}

export function buildOccurrencePlan({campaign, updates = {}, playbook, campaigns = [], plays = [], capacityRules = [], generatedAt = new Date()} = {}) {
  if (!campaign?.id || !campaign.seriesId || !campaign.occurrenceKey) throw new Error("A recurring occurrence campaign is required.");
  if (!playbook?.id || !Array.isArray(playbook.weeks)) throw new Error("A valid pinned playbook is required.");
  if (playbook.id !== campaign.playbookId || Number(playbook.version || 1) !== Number(campaign.playbookVersion || 1)) {
    throw new Error(`Playbook ${campaign.playbookId} version ${campaign.playbookVersion} is required for this occurrence.`);
  }
  const today = dateKey(generatedAt);
  const allowedUpdates = ["name", "eventDate", "sourceEventId", "eventDetails", "sampleAnnouncement", "notes", "deadlineOffsetDays", "level", "campaignType"];
  const applied = Object.fromEntries(allowedUpdates.filter((key) => Object.hasOwn(updates, key)).map((key) => [key, updates[key]]));
  const eventDate = validateDate(applied.eventDate || campaign.eventDate, "Occurrence event date");
  const persistedDeadlineOffset = campaign.deadlineOffsetDays != null
    ? Number(campaign.deadlineOffsetDays)
    : (campaign.registrationDeadline
      ? differenceInDays(campaign.eventDate, campaign.registrationDeadline)
      : null);
  const deadlineOffsetDays = Object.hasOwn(applied, "deadlineOffsetDays")
    ? (applied.deadlineOffsetDays == null || applied.deadlineOffsetDays === "" ? null : Number(applied.deadlineOffsetDays))
    : persistedDeadlineOffset;
  if (deadlineOffsetDays != null && (!Number.isInteger(deadlineOffsetDays) || deadlineOffsetDays < 0 || deadlineOffsetDays > 365)) throw new Error("Deadline offset must be from 0 to 365 days.");
  const nextCampaign = {
    ...campaign,
    ...applied,
    id: campaign.id,
    seriesId: campaign.seriesId,
    occurrenceKey: campaign.occurrenceKey,
    eventDate,
    deadlineOffsetDays,
    registrationDeadline: registrationDeadline(eventDate, deadlineOffsetDays),
    recurrenceException: true,
    status: "active",
  };
  const existing = plays.filter((play) => play.campaignId === campaign.id);
  const protectedIds = new Set([
    ...plays.filter((play) => protectedPlay(play, today)).map((play) => play.id),
    ...smuggledBeneficiaryPlayIds({plays, campaigns}),
  ]);
  const generated = mergeGeneratedPlays({campaign: nextCampaign, playbook, existing, generatedAt, today, protectedIds, occurrenceMove: eventDate !== campaign.eventDate});
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  campaignById.set(campaign.id, {...campaign, ...generated.campaign, recurrenceException: true, occurrenceKey: campaign.occurrenceKey});
  const playById = new Map(plays.map((play) => [play.id, play]));
  generated.plays.forEach((play) => playById.set(play.id, play));
  [...playById.values()].filter((play) => protectedPlay(play, today)).forEach((play) => protectedIds.add(play.id));
  const allocated = applyWorkspaceCapacity({campaigns: [...campaignById.values()], plays: [...playById.values()], capacityRules, protectedIds});
  return buildWrites({
    originalCampaigns: campaigns.some((item) => item.id === campaign.id) ? campaigns : [...campaigns, campaign],
    originalPlays: plays,
    desiredCampaigns: [campaignById.get(campaign.id)],
    desiredPlays: allocated.plays,
    conflicts: allocated.conflicts,
    summary: {occurrences: 1, promotions: generated.plays.filter((play) => !["skipped", "missed"].includes(play.status)).length, preserved: generated.preserved, skipped: generated.plays.filter((play) => play.status === "skipped").length},
    series: null,
    expectedWorkspace: {campaigns, plays, capacityRules},
  });
}

export function skipOccurrencePlan({campaign, plays = [], generatedAt = new Date()} = {}) {
  if (!campaign?.id || !campaign.seriesId || !campaign.occurrenceKey) throw new Error("A recurring occurrence campaign is required.");
  const today = dateKey(generatedAt);
  const nextCampaign = {...campaign, status: "archived", recurrenceException: true};
  const desiredPlayById = new Map(plays.map((play) => [play.id, play]));
  const cancellation = cancelFutureOccurrencePlays({
    campaignId: campaign.id,
    desiredPlayById,
    originalPlays: plays,
    relationships: buildSmuggleRelationships({plays}),
    today,
    reason: "Skipped with this recurring occurrence.",
  });
  return buildWrites({
    originalCampaigns: [campaign],
    originalPlays: plays,
    desiredCampaigns: [nextCampaign],
    desiredPlays: [...desiredPlayById.values()],
    conflicts: [],
    summary: {occurrences: 1, promotions: 0, preserved: cancellation.preserved, skipped: cancellation.skipped},
    series: null,
  });
}
