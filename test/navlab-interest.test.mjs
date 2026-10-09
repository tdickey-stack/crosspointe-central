import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {
  buildInterestSubmission,
  normalizeInterestItem,
  submitInterestRequest,
} from "../public/navlab-interest.js";

test("public interest subjects retain display fields and IDs without private contacts", () => {
  const campaign = normalizeInterestItem("campaign", {
    id: "campaign-1",
    title: "Community Care",
    description: "Help care for our neighbors.",
    button_text: "Ask a question",
    action_type: "contact",
    contact_email: "private@example.test",
  });
  const serveNeed = normalizeInterestItem("serveNeed", {
    id: "serve-1",
    need: "Production Team",
    ministry: "Worship",
    contact_email: "private@example.test",
  });

  assert.deepEqual(campaign, {
    kind: "campaign",
    id: "campaign-1",
    title: "Community Care",
    description: "Help care for our neighbors.",
    buttonText: "Ask a question",
  });
  assert.deepEqual(serveNeed, {
    kind: "serveNeed",
    id: "serve-1",
    title: "Production Team",
    description: "",
    ministry: "Worship",
    priority: "",
    buttonText: "Share my interest",
  });
  assert.doesNotMatch(JSON.stringify([campaign, serveNeed]), /private@example\.test|contact_email/);
  assert.equal(normalizeInterestItem("campaign", {id: "link", action_type: "link"}), null);
  assert.equal(normalizeInterestItem("serveNeed", {need: "Missing ID"}), null);
});

test("campaign submissions match the validated API contract exactly", () => {
  const payload = buildInterestSubmission("campaign", {
    id: "campaign-1",
    title: "Community Care",
    action_type: "contact",
    contact_email: "must-not-leak@example.test",
  }, {
    name: "  Alex Smith ",
    email: " ALEX@Example.test ",
    phone: " 405-555-0100 ",
    message: " I would like more information. ",
  });

  assert.deepEqual(payload, {
    campaignId: "campaign-1",
    name: "Alex Smith",
    email: "alex@example.test",
    phone: "405-555-0100",
    message: "I would like more information.",
  });
  assert.throws(() => buildInterestSubmission("campaign", {
    id: "campaign-1", action_type: "contact",
  }, {name: "Alex", email: "bad"}), /valid email address/);
  assert.throws(() => buildInterestSubmission("campaign", {
    id: "campaign-1", action_type: "contact",
  }, {name: "Alex", email: "alex@example.test", message: "x".repeat(2001)}), /Message is too long/);
});

test("serve submissions require a usable contact preference and public item ID", () => {
  const item = {id: "serve-1", need: "Production Team", ministry: "Worship"};
  assert.deepEqual(buildInterestSubmission("serveNeed", item, {
    name: " Taylor ",
    email: "TAYLOR@example.test",
    phone: "405-555-0199",
    preferredContactMethod: "text",
    additionalNotes: " I can serve twice a month. ",
  }), {
    serveNeedId: "serve-1",
    name: "Taylor",
    email: "taylor@example.test",
    phone: "405-555-0199",
    preferredContactMethod: "text",
    additionalNotes: "I can serve twice a month.",
  });
  assert.throws(() => buildInterestSubmission("serveNeed", item, {
    name: "Taylor", email: "taylor@example.test", preferredContactMethod: "text",
  }), /Add a phone number/);
  assert.throws(() => buildInterestSubmission("serveNeed", item, {
    name: "Taylor", email: "taylor@example.test", preferredContactMethod: "call",
  }), /Choose Email or Text/);
});

test("requests use the existing same-origin endpoints and surface server validation", async () => {
  const calls = [];
  const fetchOk = async (url, options) => {
    calls.push({url, options});
    return {ok: true, async text() { return JSON.stringify({ok: true, need: "Production Team"}); }};
  };
  const item = {id: "serve-1", need: "Production Team"};
  const result = await submitInterestRequest("serveNeed", item, {
    name: "Taylor", email: "taylor@example.test", phone: "",
    preferredContactMethod: "email", additionalNotes: "",
  }, fetchOk);
  assert.equal(result.need, "Production Team");
  assert.equal(calls[0].url, "/api/serve-needs/share-interest");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    serveNeedId: "serve-1",
    name: "Taylor",
    email: "taylor@example.test",
    phone: "",
    preferredContactMethod: "email",
    additionalNotes: "",
  });

  await assert.rejects(() => submitInterestRequest("campaign", {
    id: "campaign-1", title: "Care", action_type: "contact",
  }, {name: "Taylor", email: "taylor@example.test"}, async () => ({
    ok: false,
    async text() { return JSON.stringify({error: "That campaign is no longer active."}); },
  })), /no longer active/);
});

test("Navlab cards launch the forms instead of production hash links", () => {
  const source = readFileSync(new URL("../public/navlab-content.js", import.meta.url), "utf8");
  assert.match(source, /interests\.openServeNeed\(item, button\)/);
  assert.match(source, /interests\.openCampaign\(item, button\)/);
  assert.doesNotMatch(source, /View opportunity on Central|View campaign on Central/);
  assert.match(source, /onData\(fresh\)/);
});
