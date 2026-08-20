import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlannerBriefEmailHtml,
  buildPlannerBriefEmailText,
  normalizePlannerBriefEmailPayload,
} from "./brief-email.js";

/**
 * Creates a valid Planner brief email payload for focused tests.
 * @param {object} overrides Payload fields to replace.
 * @return {object} Test payload.
 */
function payload(overrides = {}) {
  return {
    recipients: "creative@crosspointe.tv, ministry@crosspointe.tv",
    subject: "Weekly Promotion Brief",
    message: "Please review this week's promotions.",
    brief: {
      title: "Weekly Promotion Brief",
      startDate: "2026-08-23",
      endDate: "2026-08-29",
      announcementTypes: ["Stage Announcement"],
      closingScriptTitle: "One Next Step",
      closingScript: "Everything is on **CrossPointe Central**.",
      entries: [{
        name: "Women's <Breakfast>",
        kind: "campaign",
        level: 4,
        eventDate: "2026-09-12",
        registrationDeadline: "2026-09-10",
        eventDetails: "## At a glance\n- Doors open at **8:30 AM**\n<img src=x>",
        sampleAnnouncement: "Invite a friend to *Women's Breakfast*.",
        notes: "Invite & welcome everyone.",
        announcements: [{
          playType: "Stage Announcement",
          channel: "Sunday / Stage",
          scheduledDate: "2026-08-23",
          needsAttention: true,
          smuggle: {
            beneficiaryName: "Ladies Bunco Night",
            beneficiaryLevel: 4,
          },
        }],
        smuggledInto: [{
          id: "host-play:guest",
          hostCampaignName: "Big Small Group Relaunch",
          hostCampaignLevel: 1,
          hostPlayType: "Stage Announcement",
          hostChannel: "Sunday / Stage",
          scheduledDate: "2026-08-23",
        }],
      }],
    },
    attachment: {
      filename: "weekly-promotion-brief.pdf",
      contentType: "application/pdf",
      base64: "JVBERi0xLjQ=",
    },
    ...overrides,
  };
}

test("planner brief email validates recipients and PDF attachment", () => {
  const result = normalizePlannerBriefEmailPayload(payload());
  assert.deepEqual(result.recipients, [
    "creative@crosspointe.tv",
    "ministry@crosspointe.tv",
  ]);
  assert.equal(result.brief.announcementCount, 1);
  assert.equal(result.brief.attentionCount, 1);
  assert.equal(result.brief.entries[0].announcements[0].smuggle.beneficiaryName, "Ladies Bunco Night");
  assert.equal(result.brief.entries[0].smuggledInto[0].hostCampaignLevel, 1);
  assert.match(result.brief.entries[0].eventDetails, /Doors open/);
  assert.match(result.brief.entries[0].sampleAnnouncement, /Women's Breakfast/);
  assert.equal(result.brief.closingScriptTitle, "One Next Step");
  assert.match(result.brief.closingScript, /CrossPointe Central/);
  assert.equal(result.attachment.filename, "weekly-promotion-brief.pdf");
});

test("planner brief email renders useful text and escaped HTML", () => {
  const normalized = normalizePlannerBriefEmailPayload(payload());
  const plainText = buildPlannerBriefEmailText(normalized);
  const html = buildPlannerBriefEmailHtml(normalized);
  assert.match(plainText, /Stage Announcement \| Aug 23, 2026/);
  assert.match(plainText, /SMUGGLE CONTAINS: Level 4 Ladies Bunco Night/);
  assert.match(plainText, /SMUGGLED INTO: Level 1 Big Small Group Relaunch/);
  assert.match(plainText, /Event details:\nAt a glance/);
  assert.match(plainText, /SUNDAY ANNOUNCEMENT SCRIPT/);
  assert.match(plainText, /Women's <Breakfast>\nInvite a friend/);
  assert.match(plainText, /One Next Step\nEverything is on CrossPointe Central/);
  assert.match(plainText, /The complete announcement brief is attached as a PDF/);
  assert.match(html, /Women&#39;s &lt;Breakfast&gt;/);
  assert.match(html, /Invite &amp; welcome everyone/);
  assert.match(html, /Smuggle contains Level 4 Ladies Bunco Night/);
  assert.match(html, /Smuggled into Level 1 Big Small Group Relaunch/);
  assert.match(html, /<strong>8:30 AM<\/strong>/);
  assert.match(html, /<em>Women&#39;s Breakfast<\/em>/);
  assert.match(html, /SUNDAY ANNOUNCEMENT SCRIPT/);
  assert.match(html, /One Next Step/);
  assert.match(html, /Everything is on <strong>CrossPointe Central<\/strong>/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /Women's <Breakfast>/);
  assert.doesNotMatch(html, /<img src=x>/);
});

test("planner brief email rejects malformed recipients", () => {
  assert.throws(
      () => normalizePlannerBriefEmailPayload(
          payload({recipients: "not-an-email"}),
      ),
      /Check the recipient email address/,
  );
});
