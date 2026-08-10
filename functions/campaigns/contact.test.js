import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_ACTION_CONTACT,
  CAMPAIGN_ACTION_LINK,
  buildCampaignContactEmailText,
  normalizeCampaignActionType,
  normalizeCampaignContactSubmission,
} from "./contact.js";
import {areCampaignsComparisonItemsEqual_} from "../helpers/helpers.js";

test("normalizes legacy and contact campaign actions", () => {
  assert.equal(normalizeCampaignActionType({}), CAMPAIGN_ACTION_LINK);
  assert.equal(normalizeCampaignActionType({
    button_url: "https://example.com",
  }), CAMPAIGN_ACTION_LINK);
  assert.equal(normalizeCampaignActionType({
    action_type: "contact",
    contact_email: "leader@example.com",
  }), CAMPAIGN_ACTION_CONTACT);
  assert.equal(normalizeCampaignActionType({
    contact_email: "leader@example.com",
  }), CAMPAIGN_ACTION_CONTACT);
});

test("normalizes bounded campaign contact submissions", () => {
  assert.deepEqual(normalizeCampaignContactSubmission({
    name: "  Alex Smith  ",
    email: " ALEX@example.com ",
    phone: " 405-555-0100 ",
    message: " I would like more information. ",
  }), {
    name: "Alex Smith",
    email: "alex@example.com",
    phone: "405-555-0100",
    message: "I would like more information.",
  });

  assert.throws(
      () => normalizeCampaignContactSubmission({name: "Alex", email: "bad"}),
      /valid email address/,
  );
  assert.throws(
      () => normalizeCampaignContactSubmission({
        name: "Alex",
        email: "alex@example.com",
        message: "x".repeat(2001),
      }),
      /Message is too long/,
  );
});

test("builds a reply-oriented campaign notification", () => {
  const message = buildCampaignContactEmailText({
    campaignTitle: "Community Food Drive",
    name: "Alex Smith",
    email: "alex@example.com",
    phone: "",
    message: "How can I help?",
  }, "Aug 10, 2026, 11:00 AM");

  assert.match(message, /Campaign\nTitle: Community Food Drive/);
  assert.match(message, /Email: alex@example\.com/);
  assert.match(message, /Phone: Not provided/);
  assert.match(message, /Reply directly to this email/);
});

test("campaign comparisons include action and contact email changes", () => {
  const linkCampaign = {
    title: "Food Drive",
    button_text: "Learn More",
    button_url: "https://example.com",
    action_type: "link",
    contact_email: "",
    ongoing: true,
    sort: 10,
    active: true,
  };

  assert.equal(
      areCampaignsComparisonItemsEqual_(linkCampaign, {
        ...linkCampaign,
        action_type: "contact",
        button_url: "",
        contact_email: "leader@example.com",
      }),
      false,
  );
});
