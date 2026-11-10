import test from "node:test";
import assert from "node:assert/strict";
import {buildCampaignRows, campaignActivity} from "../src/planner/campaign-activity.js";

const event = (values = {}) => ({id: "e", name: "Event", level: 2, status: "active", eventDate: "2026-11-10", recommendedStartDate: "2026-11-01", ...values});

test("activity uses Chicago dates and actual event day, ignoring stale currentWeek", () => {
  const item = event({currentWeek: 0, campaignEndDate: "2026-11-09"});
  assert.equal(campaignActivity(item, new Date("2026-11-11T05:59:00Z")).label, "Event today");
  assert.equal(campaignActivity(item, new Date("2026-11-11T06:00:00Z")).label, "Ended");
  assert.equal(campaignActivity(item, "2026-11-05").label, "Promoting now");
  assert.equal(campaignActivity(event({currentWeek: 99}), "2026-10-01").label, "Starts later");
});

test("activity handles windows, statuses and incomplete dates", () => {
  const window = event({scheduleMode: "promotion-window", campaignEndDate: "2026-11-10", recommendedStartDate: "", durationWeeks: 2});
  assert.equal(campaignActivity(window, "2026-11-10").label, "Promoting now");
  assert.equal(campaignActivity(window, "2026-11-11").label, "Ended");
  assert.equal(campaignActivity(event({status: "archived"}), "2026-01-01").label, "Skipped");
  assert.equal(campaignActivity(event({status: "completed"}), "2026-01-01").inactive, true);
  assert.equal(campaignActivity(event({status: "draft", eventDate: ""}), "2026-01-01").label, "Draft");
  assert.equal(campaignActivity(event({eventDate: "2026-02-30"}), "2026-01-01").label, "Needs dates");
});

test("series group all occurrences and select nearest active event despite later ended or skipped records", () => {
  const campaigns = [event({id: "old", seriesId: "s", eventDate: "2026-10-01"}),
    event({id: "next", seriesId: "s", eventDate: "2026-11-11"}),
    event({id: "later", seriesId: "s", eventDate: "2026-12-01", status: "completed"}),
    event({id: "skip", seriesId: "s", eventDate: "2026-12-03", status: "archived"}),
    event({id: "orphan", seriesId: "missing"}), event({id: "content", campaignType: "standalone-content"})];
  const rows = buildCampaignRows({campaigns, campaignSeries: [{id: "s", name: "Series", level: 2}, {id: "saving", name: "Saving", level: 1, saveState: "saving"}], scheduledPlays: [{campaignId: "old", status: "conflict"}]}, "2026-11-10");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].activity.label, "Save interrupted");
  const series = rows.find((row) => row.id === "s");
  assert.equal(series.campaign.id, "next");
  assert.equal(series.occurrences.length, 4);
  assert.equal(series.conflicts, 0);
  assert.equal(series.activity.inactive, false);
  assert.ok(rows.find((row) => row.id === "orphan"));
});

test("inactive series picks the latest non-skipped occurrence and rows sort by level and activity", () => {
  const rows = buildCampaignRows({campaigns: [
    event({id: "early", seriesId: "s", eventDate: "2026-09-01"}),
    event({id: "recent", seriesId: "s", eventDate: "2026-10-01"}),
    event({id: "skipped", seriesId: "s", eventDate: "2026-12-01", status: "archived"}),
    event({id: "active", level: 2, eventDate: "2026-11-12"}),
    event({id: "level1", level: 1, eventDate: "2026-01-01"}),
  ], campaignSeries: [{id: "s", level: 2, name: "Series"}]}, "2026-11-10");
  assert.deepEqual(rows.map((row) => row.id), ["level1", "active", "s"]);
  assert.equal(rows[2].campaign.id, "recent");
  assert.equal(rows[2].activity.label, "Ended");
});

test("series label reflects promotion of a later event while preserving nearest representative", () => {
  const workspace = {campaigns: [
    event({id: "near", seriesId: "s", eventDate: "2026-11-12", recommendedStartDate: "2026-11-11"}),
    event({id: "later", seriesId: "s", eventDate: "2026-12-01", recommendedStartDate: "2026-11-01"}),
    event({id: "skipped", seriesId: "s", eventDate: "2027-01-01", status: "archived"}),
  ], campaignSeries: [{id: "s", level: 2, name: "Series", status: "ended"}]};
  const before = structuredClone(workspace);
  const [row] = buildCampaignRows(workspace, "2026-11-10");
  assert.equal(row.campaign.id, "near");
  assert.equal(row.activity.label, "Promoting now");
  assert.equal(row.activity.inactive, false);
  assert.deepEqual(workspace, before);
});

test("all skipped occurrences yield an inactive series", () => {
  const [row] = buildCampaignRows({campaigns: [event({seriesId: "s", status: "archived"})], campaignSeries: [{id: "s", level: 2}]}, "2026-11-01");
  assert.equal(row.activity.label, "Skipped");
  assert.equal(row.activity.inactive, true);
});

test("invalid durations do not throw or invent a start date", () => {
  for (const durationWeeks of [NaN, Infinity, 1.5, -1, 0, Number.MAX_SAFE_INTEGER]) {
    assert.equal(campaignActivity(event({recommendedStartDate: "", durationWeeks}), "2026-11-01").label, "Needs dates");
  }
});


test("row names are safe to search even for malformed records", () => {
  const [row] = buildCampaignRows({campaigns: [event({name: 123})]}, "2026-11-01");
  assert.equal(row.name.toLowerCase(), "123");
});


test("dated active occurrences lead and conflicts exclude past plays and inactive campaigns", () => {
  const campaigns = [event({id: "undated", seriesId: "s", eventDate: ""}),
    event({id: "dated", seriesId: "s", eventDate: "2026-11-12"}),
    event({id: "old", seriesId: "s", eventDate: "2026-10-01"})];
  const scheduledPlays = [
    {campaignId: "old", status: "conflict", scheduledDate: "2026-11-12"},
    {campaignId: "dated", status: "conflict", scheduledDate: "2026-11-09"},
    {campaignId: "dated", status: "conflict", scheduledDate: "2026-11-10"},
    {campaignId: "undated", status: "conflict"},
  ];
  const [row] = buildCampaignRows({campaigns, scheduledPlays, campaignSeries: [{id: "s", level: 2}]}, "2026-11-10");
  assert.equal(row.campaign.id, "dated");
  assert.equal(row.occurrences.length, 3);
  assert.equal(row.conflicts, 2);
});
