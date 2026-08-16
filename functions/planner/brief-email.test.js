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
      entries: [{
        name: "Women's <Breakfast>",
        kind: "campaign",
        level: 4,
        eventDate: "2026-09-12",
        registrationDeadline: "2026-09-10",
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
  assert.equal(result.attachment.filename, "weekly-promotion-brief.pdf");
});

test("planner brief email renders useful text and escaped HTML", () => {
  const normalized = normalizePlannerBriefEmailPayload(payload());
  const plainText = buildPlannerBriefEmailText(normalized);
  const html = buildPlannerBriefEmailHtml(normalized);
  assert.match(plainText, /Stage Announcement \| Aug 23, 2026/);
  assert.match(plainText, /SMUGGLE CONTAINS: Level 4 Ladies Bunco Night/);
  assert.match(plainText, /SMUGGLED INTO: Level 1 Big Small Group Relaunch/);
  assert.match(plainText, /The complete promotion brief is attached as a PDF/);
  assert.match(html, /Women&#39;s &lt;Breakfast&gt;/);
  assert.match(html, /Invite &amp; welcome everyone/);
  assert.match(html, /Smuggle contains Level 4 Ladies Bunco Night/);
  assert.match(html, /Smuggled into Level 1 Big Small Group Relaunch/);
  assert.doesNotMatch(html, /Women's <Breakfast>/);
});

test("planner brief email rejects malformed recipients", () => {
  assert.throws(
      () => normalizePlannerBriefEmailPayload(
          payload({recipients: "not-an-email"}),
      ),
      /Check the recipient email address/,
  );
});
