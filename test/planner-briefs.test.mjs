import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPromotionBrief,
  createPromotionBriefPdf,
  sendPromotionBriefEmail,
} from "../src/planner/briefs.js";

const campaigns = [
  {id: "l4", name: "Women's Breakfast", level: 4, eventDate: "2026-09-12", notes: "Invite a friend."},
  {id: "l1", name: "Stewardship Campaign", level: 1, eventDate: "2026-09-20"},
  {id: "content", name: "Weekly Podcast", campaignType: "standalone-content"},
];
const scheduledPlays = [
  {id: "one", campaignId: "l4", campaignName: "Women's Breakfast", campaignLevel: 4, playType: "Stage Announcement", channel: "Sunday / Stage", scheduledDate: "2026-08-23", status: "scheduled"},
  {id: "two", campaignId: "l1", campaignName: "Stewardship Campaign", campaignLevel: 1, playType: "Newsletter Feature", channel: "Newsletter", scheduledDate: "2026-08-26", status: "needs-decision", conflictState: "capacity"},
  {id: "three", campaignId: "content", campaignName: "Weekly Podcast", campaignType: "standalone-content", playType: "Podcast", channel: "Podcast", scheduledDate: "2026-08-25", status: "scheduled"},
  {id: "hidden", campaignId: "l1", campaignName: "Stewardship Campaign", campaignLevel: 1, playType: "Stage Announcement", channel: "Sunday / Stage", scheduledDate: "2026-08-23", status: "skipped"},
  {id: "outside", campaignId: "l4", campaignName: "Women's Breakfast", campaignLevel: 4, playType: "Stage Announcement", channel: "Sunday / Stage", scheduledDate: "2026-09-06", status: "scheduled"},
];

function sampleBrief() {
  return buildPromotionBrief({
    campaigns,
    scheduledPlays,
    selectedPlayTypes: ["Stage Announcement", "Newsletter Feature", "Podcast"],
    startDate: "2026-08-23",
    endDate: "2026-08-29",
    title: "Weekly Promotion Brief",
    generatedAt: new Date("2026-08-16T12:00:00Z"),
  });
}

test("promotion brief filters the planning window and sorts Level 1 through content", () => {
  const brief = sampleBrief();
  assert.equal(brief.announcementCount, 3);
  assert.equal(brief.attentionCount, 1);
  assert.deepEqual(brief.entries.map((entry) => entry.name), [
    "Stewardship Campaign",
    "Women's Breakfast",
    "Weekly Podcast",
  ]);
  assert.equal(brief.entries[0].announcements[0].needsAttention, true);
  assert.equal(brief.entries[1].notes, "Invite a friend.");
});

test("promotion brief PDF produces a readable PDF document", () => {
  const result = createPromotionBriefPdf(sampleBrief());
  const bytes = new Uint8Array(result.pdf.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.match(result.filename, /weekly-promotion-brief-2026-08-23\.pdf$/);
  assert.ok(result.pdf.getNumberOfPages() >= 1);
});

test("promotion brief PDF repeats headers and paginates a long campaign cleanly", () => {
  const manyPromotions = Array.from({length: 32}, (_value, index) => ({
    id: `promotion-${index}`,
    campaignId: "long-campaign",
    campaignName: "Long Campaign",
    campaignLevel: 1,
    playType: "Stage Announcement",
    channel: "Sunday Stage and Additional Ministry Communication Channel",
    scheduledDate: `2026-08-${String(23 + (index % 7)).padStart(2, "0")}`,
    status: index === 9 ? "needs-decision" : "scheduled",
    conflictState: index === 9 ? "capacity" : "none",
    conflictReason: index === 9 ? "The weekly stage capacity is already full." : "",
  }));
  const brief = buildPromotionBrief({
    campaigns: [{
      id: "long-campaign",
      name: "Long Campaign",
      level: 1,
      eventDate: "2026-09-20",
      notes: "A long campaign verifies that promotion rows stay inside measured card sections across pages.",
    }],
    scheduledPlays: manyPromotions,
    selectedPlayTypes: ["Stage Announcement"],
    startDate: "2026-08-23",
    endDate: "2026-08-29",
    title: "Month at a Glance Promotion Brief",
  });
  const {pdf} = createPromotionBriefPdf(brief);
  assert.ok(pdf.getNumberOfPages() >= 2);
  pdf.internal.pages.slice(1).forEach((page) => {
    assert.match(page.join("\n"), /CROSSPOINTE CENTRAL/);
  });
  assert.match(pdf.internal.pages.slice(2).flat().join("\n"), /continued/);
});

test("email request authenticates and includes the generated PDF", async () => {
  let request = null;
  const result = await sendPromotionBriefEmail({
    user: {getIdToken: async () => "planner-token"},
    recipients: "creative@crosspointe.tv",
    subject: "Weekly Promotion Brief",
    message: "Here is the brief.",
    brief: sampleBrief(),
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {ok: true, json: async () => ({ok: true, message: "Promotion brief sent."})};
    },
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "/api/planner/send-brief");
  assert.equal(request.options.headers.Authorization, "Bearer planner-token");
  assert.equal(body.recipients, "creative@crosspointe.tv");
  assert.equal(body.attachment.contentType, "application/pdf");
  assert.ok(body.attachment.base64.length > 100);
  assert.equal(result.ok, true);
});
