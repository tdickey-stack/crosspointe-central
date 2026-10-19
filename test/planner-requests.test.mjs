import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignFromPromotionRequest,
  promotionRequestConversionUpdates,
  promotionRequestInitialForm,
} from "../src/planner/requests.js";

const general = {
  id: "pco_1229879_42", sourceFormId: "1229879", sourceSubmissionId: "42",
  proposedName: "Volunteer recruitment", submittedAt: "2026-10-01T15:00:00Z",
  requestedPromotionStart: "2026-11-01", requestedPromotionEnd: "2026-11-30",
  eventDate: "", eventDates: [], eventDateEnd: "", dateParseStatus: "manual-required",
  dateParseKind: null, dateSource: "manual-review", status: "pending-review",
};
const playbook = {id: "level-4-standard", level: 4, campaignType: "standard"};

test("general requests suggest the submitted end without creating an event date", () => {
  const form = promotionRequestInitialForm(general);
  assert.equal(form.campaignEndDate, "2026-11-30");
  assert.equal(form.eventDate, "");
  assert.equal(form.playbookId, "", "Creative must still select a playbook");
  assert.equal(promotionRequestInitialForm({...general, requestedPromotionEnd: ""}).campaignEndDate, "");
  assert.throws(() => campaignFromPromotionRequest({request: general,
    form: {...form, campaignEndDate: ""}, playbook}), /planning date/);
});

test("an adjusted general window retains original source bounds and converts without a false event", () => {
  const before = structuredClone(general);
  const campaign = campaignFromPromotionRequest({request: general,
    form: {...promotionRequestInitialForm(general), campaignEndDate: "2026-12-04"}, playbook});
  assert.equal(campaign.scheduleMode, "promotion-window");
  assert.equal(campaign.campaignEndDate, "2026-12-04");
  assert.equal(campaign.requestedPromotionStart, "2026-11-01");
  assert.equal(campaign.requestedPromotionEnd, "2026-11-30");
  assert.equal(campaign.eventDate, "");
  assert.equal(campaign.registrationDeadline, "");
  assert.equal(campaign.sourceEventId, "pco-form:1229879:42");
  assert.equal(campaign.submittedAt, general.submittedAt);
  const updates = promotionRequestConversionUpdates(general, campaign);
  assert.deepEqual(updates, {proposedName: general.proposedName, status: "converted", campaignId: campaign.id});
  assert.deepEqual({...general, ...updates}.eventDates, []);
  assert.equal({...general, ...updates}.dateParseStatus, "manual-required");
  assert.deepEqual(general, before);
});

test("event requests retain their event date and parsed range until an editor changes the date", () => {
  const request = {...general, sourceFormId: "930568", eventDate: "2026-11-28",
    eventDates: ["2026-11-28", "2026-11-29"], eventDateEnd: "2026-11-29",
    dateParseStatus: "parsed", dateParseKind: "range", dateSource: "form-parser"};
  const form = promotionRequestInitialForm(request);
  assert.equal(form.eventDate, "2026-11-28");
  assert.equal(form.campaignEndDate, "");
  const campaign = campaignFromPromotionRequest({request, form, playbook});
  assert.equal(campaign.eventDate, request.eventDate);
  assert.equal(Object.hasOwn(campaign, "scheduleMode"), false);
  assert.equal(Object.hasOwn(campaign, "requestedPromotionEnd"), false);
  const unchanged = promotionRequestConversionUpdates(request, campaign);
  assert.deepEqual(unchanged.eventDates, request.eventDates);
  assert.equal(unchanged.dateParseKind, "range");
  const changed = promotionRequestConversionUpdates(request, {...campaign, eventDate: "2026-12-05"});
  assert.deepEqual(changed.eventDates, ["2026-12-05"]);
  assert.equal(changed.eventDateEnd, "");
  assert.equal(changed.dateParseStatus, "manual");
  assert.equal(changed.dateParseKind, "single");
});
