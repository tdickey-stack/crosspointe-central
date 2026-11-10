import {Temporal} from "temporal-polyfill";
import {addDays, dateKey, isPromotionWindow} from "./domain.js";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  try { return Temporal.PlainDate.from(value).toString(); } catch { return ""; }
}

function endDate(campaign) {
  return validDate(isPromotionWindow(campaign) ? campaign?.campaignEndDate : campaign?.eventDate);
}

export function campaignActivity(campaign, today = new Date()) {
  if (campaign?.status === "archived") return {inactive: true, label: "Skipped", tone: "ended"};
  if (campaign?.status === "completed") return {inactive: true, label: "Completed", tone: "ended"};
  if (campaign?.status === "draft") return {inactive: false, label: "Draft", tone: "attention"};
  const end = endDate(campaign);
  if (!end) return {inactive: false, label: "Needs dates", tone: "attention"};
  const now = dateKey(today);
  if (end < now) return {inactive: true, label: "Ended", tone: "ended"};
  if (!isPromotionWindow(campaign) && end === now) return {inactive: false, label: "Event today", tone: "promoting"};
  let start = validDate(campaign?.recommendedStartDate);
  const duration = Number(campaign?.durationWeeks);
  if (!start && Number.isSafeInteger(duration) && duration > 0) {
    const anchor = isPromotionWindow(campaign) ? addDays(end, 1) : end;
    start = validDate(addDays(anchor, -duration * 7));
  }
  if (!start || start > end) return {inactive: false, label: "Needs dates", tone: "attention"};
  return start > now
    ? {inactive: false, label: "Starts later", tone: "upcoming"}
    : {inactive: false, label: "Promoting now", tone: "promoting"};
}

export function buildCampaignRows(workspace, today = new Date()) {
  const campaigns = (workspace.campaigns || []).filter((item) => item && item.campaignType !== "standalone-content" && item.resourceId !== "standalone-content");
  const series = (workspace.campaignSeries || []).filter((item) => item?.id);
  const seriesIds = new Set(series.map((item) => item.id));
  const plays = workspace.scheduledPlays || [];
  const makeRow = (item, occurrences, recurring) => {
    const sorted = [...occurrences].sort((a, b) => endDate(a).localeCompare(endDate(b)));
    const active = sorted.filter((campaign) => !campaignActivity(campaign, today).inactive);
    const nonSkipped = sorted.filter((campaign) => campaign.status !== "archived");
    const representative = active.find((campaign) => endDate(campaign)) || active[0] || nonSkipped.at(-1) || sorted.at(-1) || null;
    const priority = {"Event today": 0, "Promoting now": 1, "Starts later": 2, "Draft": 3, "Needs dates": 4};
    const activeActivities = active.map((campaign) => campaignActivity(campaign, today));
    activeActivities.sort((a, b) => (priority[a.label] ?? 99) - (priority[b.label] ?? 99));
    const activity = item.saveState === "saving"
      ? {inactive: false, label: "Save interrupted", tone: "attention"}
      : activeActivities[0] || campaignActivity(representative, today);
    const ids = new Set(active.map((campaign) => campaign.id));
    const todayKey = dateKey(today);
    return {id: item.id, level: item.level, name: String(item.name || ""), series: recurring ? item : null,
      campaign: representative, occurrences: sorted, activity, displayDate: endDate(representative),
      conflicts: plays.filter((play) => ids.has(play.campaignId) && play.status === "conflict" &&
        (!validDate(play.scheduledDate) || play.scheduledDate >= todayKey)).length};
  };
  const rows = campaigns.filter((item) => !item.seriesId || !seriesIds.has(item.seriesId))
    .map((item) => makeRow(item, [item], false));
  for (const item of series) {
    const occurrences = campaigns.filter((campaign) => campaign.seriesId === item.id);
    if (occurrences.length || item.saveState === "saving") rows.push(makeRow(item, occurrences, true));
  }
  return rows.sort((a, b) => (Number(a.level) || 99) - (Number(b.level) || 99) ||
    Number(a.activity.inactive) - Number(b.activity.inactive) ||
    (a.activity.inactive ? b.displayDate.localeCompare(a.displayDate) : a.displayDate.localeCompare(b.displayDate)) ||
    String(a.name || "").localeCompare(String(b.name || "")));
}
