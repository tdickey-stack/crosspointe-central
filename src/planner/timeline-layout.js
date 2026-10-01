import {Temporal} from "temporal-polyfill";
import {
  addDays,
  buildSmuggleRelationships,
  campaignWindow,
  groupCalendarCampaignDays,
} from "./domain.js";

const HIDDEN_PLAY_STATUSES = new Set(["missed", "skipped"]);
const STANDALONE_CONTENT_TYPE = "standalone-content";

function plainDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch (_error) {
    return "";
  }
}

function orderedRange(range) {
  const startDate = plainDate(range?.startDate);
  const endDate = plainDate(range?.endDate);
  if (!startDate || !endDate || endDate < startDate) {
    throw new RangeError("Timeline range must have valid ordered dates.");
  }
  return {startDate, endDate};
}

function daysBetween(startDate, endDate) {
  return Temporal.PlainDate.from(startDate).until(Temporal.PlainDate.from(endDate), {largestUnit: "day"}).days;
}

function percentage(value) {
  const rounded = Math.round(value * 1000000) / 1000000;
  return `${Object.is(rounded, -0) ? 0 : rounded}%`;
}

function intersects(startDate, endDate, range) {
  return Boolean(startDate && endDate && startDate <= range.endDate && endDate >= range.startDate);
}

function campaignLevel(campaign, plays) {
  const value = Number(campaign?.level || plays.find((play) => Number(play.campaignLevel))?.campaignLevel || 5);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 5;
}

function compareGroups(left, right) {
  return left.startDate.localeCompare(right.startDate) ||
    left.endDate.localeCompare(right.endDate) ||
    left.id.localeCompare(right.id);
}

function packLevel(groups, level) {
  const lanes = [];
  const laneEnds = [];
  for (const group of [...groups].sort(compareGroups)) {
    let laneIndex = laneEnds.findIndex((endDate) => endDate < group.startDate);
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push({level, groups: []});
    }
    lanes[laneIndex].groups.push(group);
    laneEnds[laneIndex] = group.endDate;
  }
  return lanes;
}

function pinnedPlaybook(workspace, campaign) {
  const playbookId = String(campaign?.playbookId || "");
  const version = Number(campaign?.playbookVersion);
  const exactVersion = (item) =>
    String(item?.playbookId || item?.id || "") === playbookId &&
    Number(item?.version) === version;
  return (workspace.playbookVersions || []).find(exactVersion) ||
    (workspace.playbooks || []).find(exactVersion) || null;
}

function campaignPhases(workspace, campaign, recommendedStartDate, campaignEndDate) {
  if (!recommendedStartDate || !campaignEndDate || campaignEndDate < recommendedStartDate) return [];
  const weeks = [...(pinnedPlaybook(workspace, campaign)?.weeks || [])]
    .filter((week) => Number.isInteger(Number(week?.weekNumber)) && Number(week.weekNumber) > 0)
    .sort((left, right) => Number(left.weekNumber) - Number(right.weekNumber));
  const runs = [];
  for (const week of weeks) {
    const weekNumber = Number(week.weekNumber);
    const name = String(week.phase || "Campaign").trim() || "Campaign";
    const previous = runs.at(-1);
    if (previous && previous.name === name && previous.lastWeek + 1 === weekNumber) {
      previous.lastWeek = weekNumber;
    } else {
      runs.push({name, firstWeek: weekNumber, lastWeek: weekNumber});
    }
  }
  return runs.flatMap((run) => {
    const startDate = addDays(recommendedStartDate, (run.firstWeek - 1) * 7);
    if (startDate > campaignEndDate) return [];
    const naturalEnd = addDays(recommendedStartDate, run.lastWeek * 7 - 1);
    return [{
      id: `${campaign.id}:phase:${run.firstWeek}`,
      name: run.name,
      startDate,
      endDate: naturalEnd < campaignEndDate ? naturalEnd : campaignEndDate,
    }];
  });
}

function savedCampaignWindow(campaign) {
  const eventDate = plainDate(campaign?.eventDate);
  let fallback = null;
  if (eventDate) {
    try {
      fallback = campaignWindow(eventDate, campaign?.durationWeeks);
    } catch (_error) {
      fallback = null;
    }
  }
  return {
    recommendedStartDate: plainDate(campaign?.recommendedStartDate) || plainDate(fallback?.recommendedStartDate),
    campaignEndDate: plainDate(campaign?.campaignEndDate) || plainDate(fallback?.campaignEndDate),
    eventDate,
  };
}

function envelope(dates) {
  const valid = dates.map(plainDate).filter(Boolean).sort();
  return valid.length ? {startDate: valid[0], endDate: valid.at(-1)} : null;
}

function rangeDays(plays, range) {
  return groupCalendarCampaignDays(plays.filter((play) => {
    const scheduledDate = plainDate(play?.scheduledDate);
    return scheduledDate && scheduledDate >= range.startDate && scheduledDate <= range.endDate;
  }));
}

/** Return an inclusive year or calendar-quarter range. */
export function timelineRange({year, zoom = "quarter", quarter = 1} = {}) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 9999) {
    throw new RangeError("Timeline year must be a valid calendar year.");
  }
  if (zoom === "year") {
    return {startDate: `${String(numericYear).padStart(4, "0")}-01-01`, endDate: `${String(numericYear).padStart(4, "0")}-12-31`};
  }
  const numericQuarter = Number(quarter);
  if (zoom !== "quarter" || !Number.isInteger(numericQuarter) || numericQuarter < 1 || numericQuarter > 4) {
    throw new RangeError("Timeline zoom must be year or a quarter from 1–4.");
  }
  const start = Temporal.PlainDate.from({year: numericYear, month: (numericQuarter - 1) * 3 + 1, day: 1});
  return {startDate: start.toString(), endDate: start.add({months: 3}).subtract({days: 1}).toString()};
}

/** Position an inclusive interval within a range, clipping at both boundaries. */
export function timelinePosition(startDate, endDate, range) {
  const visibleRange = orderedRange(range);
  const start = plainDate(startDate);
  const end = plainDate(endDate);
  if (!start || !end || end < start) return {left: "0%", width: "0%"};
  const clippedStart = start < visibleRange.startDate ? visibleRange.startDate : start;
  const clippedEnd = end > visibleRange.endDate ? visibleRange.endDate : end;
  if (clippedEnd < clippedStart) {
    return {left: start > visibleRange.endDate ? "100%" : "0%", width: "0%"};
  }
  const totalDays = daysBetween(visibleRange.startDate, visibleRange.endDate) + 1;
  return {
    left: percentage(daysBetween(visibleRange.startDate, clippedStart) / totalDays * 100),
    width: percentage((daysBetween(clippedStart, clippedEnd) + 1) / totalDays * 100),
  };
}

/** Build pure, deterministic Promotion Planner timeline data from a loaded workspace. */
export function buildPromotionTimeline(workspace = {}, range, {level = ""} = {}) {
  const visibleRange = orderedRange(range);
  const requestedLevel = level === "" ? null : Number(level);
  if (requestedLevel !== null && (!Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > 5)) {
    throw new RangeError("Timeline level must be blank or a number from 1–5.");
  }
  const campaigns = Array.isArray(workspace.campaigns) ? workspace.campaigns : [];
  const plays = Array.isArray(workspace.scheduledPlays) ? workspace.scheduledPlays : [];
  const archivedIds = new Set(campaigns.filter((campaign) => campaign.status === "archived").map((campaign) => campaign.id));
  const smuggledIds = new Set(buildSmuggleRelationships({plays, campaigns})
    .map((relationship) => relationship.beneficiaryPlayId).filter(Boolean));
  const visiblePlays = plays.filter((play) =>
    !HIDDEN_PLAY_STATUSES.has(play?.status) &&
    !smuggledIds.has(play?.id) &&
    !archivedIds.has(play?.campaignId) &&
    plainDate(play?.scheduledDate));

  const ongoingPlays = visiblePlays.filter((play) => play.source === "standing-lane")
    .filter((play) => requestedLevel === null || Number(play.campaignLevel) === requestedLevel);
  const ongoing = rangeDays(ongoingPlays, visibleRange);
  const normalPlays = visiblePlays.filter((play) => play.source !== "standing-lane");
  const groups = [];

  for (const campaign of campaigns) {
    if (!campaign?.id || campaign.status === "archived") continue;
    const campaignPlays = normalPlays.filter((play) => play.campaignId === campaign.id);
    if (!campaignPlays.length && ongoingPlays.some((play) => play.campaignId === campaign.id)) continue;
    const content = campaign.campaignType === STANDALONE_CONTENT_TYPE ||
      campaignPlays.some((play) => play.campaignType === STANDALONE_CONTENT_TYPE);
    const groupLevel = content ? 6 : campaignLevel(campaign, campaignPlays);
    if (requestedLevel !== null && (content || groupLevel !== requestedLevel)) continue;

    let groupEnvelope;
    let phases = [];
    if (content) {
      groupEnvelope = envelope(campaignPlays.map((play) => play.scheduledDate));
    } else {
      const window = savedCampaignWindow(campaign);
      const baseDates = [window.recommendedStartDate, window.campaignEndDate, window.eventDate];
      const movedDates = campaignPlays.filter((play) => play.manuallyAdjusted === true).map((play) => play.scheduledDate);
      groupEnvelope = envelope([...baseDates, ...movedDates]);
      if (!groupEnvelope && campaignPlays.length) {
        groupEnvelope = envelope(campaignPlays.map((play) => play.scheduledDate));
      }
      phases = campaignPhases(workspace, campaign, window.recommendedStartDate, window.campaignEndDate)
        .filter((phase) => intersects(phase.startDate, phase.endDate, visibleRange));
    }
    if (!groupEnvelope || !intersects(groupEnvelope.startDate, groupEnvelope.endDate, visibleRange)) continue;
    const group = {
      id: campaign.id,
      campaign,
      level: groupLevel,
      startDate: groupEnvelope.startDate,
      endDate: groupEnvelope.endDate,
      phases,
      days: rangeDays(campaignPlays, visibleRange),
    };
    groups.push(group);
  }

  groups.sort((left, right) => left.level - right.level || compareGroups(left, right));
  const lanes = [];
  for (let priority = 1; priority <= 6; priority += 1) {
    lanes.push(...packLevel(groups.filter((group) => group.level === priority), priority));
  }
  return {lanes, groups, ongoing};
}
