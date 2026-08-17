/* eslint-disable max-len, require-jsdoc */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  buildPlannerRequestDocument,
  buildPlanningCenterFormSubmissionUrl,
  extractPlanningCenterFormSubmissionRefs,
  parseEventDateText,
  verifyPlanningCenterWebhookSignature,
} from "./pco-form-webhook.js";

const EVENT_FORM_ID = "930568";
const GENERAL_FORM_ID = "1229879";

function submissionValue(id, fieldId, displayValue, options = {}) {
  return {
    type: "FormSubmissionValue",
    id: String(id),
    attributes: {
      display_value: displayValue,
      value: options.rawValue === undefined ? displayValue : options.rawValue,
    },
    relationships: {
      form_submission: {data: {type: "FormSubmission", id: options.submissionId || "501"}},
      form_field: {data: {type: "FormField", id: fieldId}},
      form_field_option: options.optionId ? {
        data: {type: "FormFieldOption", id: options.optionId},
      } : {data: null},
    },
  };
}

function canonicalSubmission(formId, included, options = {}) {
  return {
    data: {
      type: "FormSubmission",
      id: options.submissionId || "501",
      attributes: {
        created_at: options.createdAt || "2026-08-16T15:30:00Z",
      },
      relationships: {
        form: {data: {type: "Form", id: formId}},
        person: {data: {type: "Person", id: "private-person-id"}},
      },
    },
    included: [
      ...included,
      {
        type: "Person",
        id: "private-person-id",
        attributes: {name: "Must Not Be Persisted", email: "private@example.com"},
      },
    ],
  };
}

function qualifyingEventSubmission(overrides = {}) {
  const values = [
    submissionValue(1, "7301964", "Yes", {optionId: "7963996"}),
    submissionValue(2, "7452308", "Yes", {optionId: "8136339"}),
    submissionValue(3, "7301877", "Fall Groups Launch"),
    submissionValue(4, "7301875", "Discipleship"),
    submissionValue(5, "7301879", "September 25 & 26"),
    submissionValue(6, "9647462", "Newsletter"),
    submissionValue(7, "9647462", "Stage Announcement"),
    submissionValue(8, "7302145", "Help people find a group."),
    submissionValue(9, "7301968", "Start four weeks ahead."),
  ];
  return canonicalSubmission(EVENT_FORM_ID, values, overrides);
}

test("verifies the webhook HMAC against the exact raw body", () => {
  const body = Buffer.from("{\"data\":[{\"id\":\"delivery-1\"}]}");
  const secret = "webhook-secret";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyPlanningCenterWebhookSignature(body, signature, secret), true);
  assert.equal(verifyPlanningCenterWebhookSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyPlanningCenterWebhookSignature(Buffer.from(`${body} `), signature, secret), false);
  assert.equal(verifyPlanningCenterWebhookSignature(body, "not-a-signature", secret), false);
  assert.equal(verifyPlanningCenterWebhookSignature(body, signature, ""), false);
});

test("extracts unique refs from created deliveries and ignores updates", () => {
  const created = (id, submissionId) => ({
    type: "EventDelivery",
    id,
    attributes: {
      name: "people.v2.events.form_submission.created",
      payload: JSON.stringify({
        data: {
          type: "FormSubmission",
          id: submissionId,
          relationships: {form: {data: {type: "Form", id: EVENT_FORM_ID}}},
        },
      }),
    },
  });
  const payload = {
    data: [
      created("delivery-1", "501"),
      created("delivery-duplicate", "501"),
      {
        ...created("delivery-2", "502"),
        attributes: {
          ...created("delivery-2", "502").attributes,
          name: "people.v2.events.form_submission.updated",
        },
      },
      {
        type: "EventDelivery",
        id: "delivery-3",
        attributes: {name: "people.v2.events.form_submission.created"},
      },
      {
        type: "EventDelivery",
        id: "delivery-4",
        attributes: {
          name: "people.v2.events.form_submission.created",
          payload: "{malformed-json",
        },
      },
    ],
  };
  assert.deepEqual(extractPlanningCenterFormSubmissionRefs(payload), [{
    deliveryId: "delivery-1",
    eventName: "people.v2.events.form_submission.created",
    formId: EVENT_FORM_ID,
    submissionId: "501",
  }]);
});

test("builds the nested canonical PCO People submission URL", () => {
  assert.equal(
      buildPlanningCenterFormSubmissionUrl(EVENT_FORM_ID, "501"),
      "https://api.planningcenteronline.com/people/v2/forms/930568/form_submissions/501?include=form_submission_values",
  );
  assert.throws(
      () => buildPlanningCenterFormSubmissionUrl("not-an-id", "501"),
      /numeric Planning Center form ID/,
  );
});

test("parses single dates, yearless ranges, and full ranges", () => {
  assert.deepEqual(parseEventDateText("August 23", "2026-08-16T12:00:00Z"), {
    rawText: "August 23",
    status: "parsed",
    kind: "single",
    primaryDate: "2026-08-23",
    dates: ["2026-08-23"],
    endDate: null,
  });
  assert.deepEqual(parseEventDateText("08/21-08/22", "2026-08-16T12:00:00Z"), {
    rawText: "08/21-08/22",
    status: "parsed",
    kind: "range",
    primaryDate: "2026-08-21",
    dates: ["2026-08-21", "2026-08-22"],
    endDate: "2026-08-22",
  });
  assert.deepEqual(parseEventDateText("8/19/2026 - 10/28/2026", "2026-08-16T12:00:00Z"), {
    rawText: "8/19/2026 - 10/28/2026",
    status: "parsed",
    kind: "range",
    primaryDate: "2026-08-19",
    dates: ["2026-08-19", "2026-10-28"],
    endDate: "2026-10-28",
  });
});

test("parses multiple dates and rolls clearly future yearless dates forward", () => {
  assert.deepEqual(parseEventDateText("September 25&26", "2026-08-16T12:00:00Z"), {
    rawText: "September 25&26",
    status: "parsed",
    kind: "multiple",
    primaryDate: "2026-09-25",
    dates: ["2026-09-25", "2026-09-26"],
    endDate: null,
  });
  assert.equal(
      parseEventDateText("January 5", "2026-08-16T12:00:00Z").primaryDate,
      "2027-01-05",
  );
  assert.deepEqual(
      parseEventDateText("December 31-January 2", "2026-08-16T12:00:00Z").dates,
      ["2026-12-31", "2027-01-02"],
  );
});

test("leaves ambiguous, invalid, recurring, and oversized date lists for review", () => {
  [
    "September sometime",
    "February 29, 2026",
    "Every Sunday in September",
    "TBD",
    "August 1, 2, 3, 4, 5, 6, 7, 8, 9",
  ].forEach((value) => {
    const result = parseEventDateText(value, "2026-08-16T12:00:00Z");
    assert.equal(result.status, "needs-review", value);
    assert.equal(result.primaryDate, null, value);
    assert.deepEqual(result.dates, [], value);
  });
});

test("normalizes an eligible Event/Promo submission without person PII", () => {
  const result = buildPlannerRequestDocument(qualifyingEventSubmission(), {
    receivedAt: "2026-08-16T16:00:00Z",
  });
  assert.equal(result.action, "upsert");
  assert.equal(result.docId, "pco_930568_501");
  assert.deepEqual(result.request, {
    schemaVersion: 1,
    source: "planning-center-form",
    sourceFormId: EVENT_FORM_ID,
    sourceFormName: "CrossPointe Event & Promo Form",
    sourceSubmissionId: "501",
    submittedAt: "2026-08-16T15:30:00.000Z",
    receivedAt: "2026-08-16T16:00:00.000Z",
    status: "pending-review",
    proposedName: "Fall Groups Launch",
    ministry: "Discipleship",
    description: "Help people find a group.",
    notes: "Requested promotion timing: Start four weeks ahead.",
    requestedPlatforms: ["Newsletter", "Stage Announcement"],
    requestedPromotionStart: null,
    requestedPromotionEnd: null,
    rawEventDateText: "September 25 & 26",
    eventDate: "2026-09-25",
    eventDates: ["2026-09-25", "2026-09-26"],
    eventDateEnd: null,
    dateParseStatus: "parsed",
    dateParseKind: "multiple",
    dateSource: "form-parser",
    eligibility: {qualified: true},
  });
  assert.doesNotMatch(JSON.stringify(result.request), /private-person-id|private@example.com|Must Not Be Persisted/);
});

test("ignores Event/Promo submissions that fail either stable option check", () => {
  const document = qualifyingEventSubmission();
  document.included = document.included.filter((resource) => resource.id !== "2");
  assert.deepEqual(buildPlannerRequestDocument(document), {
    action: "ignore",
    reason: "event-form-not-eligible",
    formId: EVENT_FORM_ID,
    submissionId: "501",
  });
});

test("normalizes every General Promotion submission with manual date review", () => {
  const values = [
    submissionValue(10, "9769760", "Worship"),
    submissionValue(11, "9769763", "New Podcast Series"),
    submissionValue(12, "9769769", "Promote the next podcast season."),
    submissionValue(13, "9769782", "Aug 24, 2026"),
    submissionValue(14, "9769783", "09/14/2026"),
    submissionValue(15, "9769788", "Social Media"),
    submissionValue(16, "9769788", "Newsletter"),
    submissionValue(17, "9769812", "Listeners subscribe to the show."),
    submissionValue(18, "9769794", "Artwork is in the shared drive."),
  ];
  const result = buildPlannerRequestDocument(canonicalSubmission(GENERAL_FORM_ID, values));
  assert.equal(result.action, "upsert");
  assert.equal(result.docId, "pco_1229879_501");
  assert.equal(result.request.proposedName, "New Podcast Series");
  assert.equal(result.request.description, "Promote the next podcast season.\n\nListeners subscribe to the show.");
  assert.deepEqual(result.request.requestedPlatforms, ["Social Media", "Newsletter"]);
  assert.equal(result.request.requestedPromotionStart, "2026-08-24");
  assert.equal(result.request.requestedPromotionEnd, "2026-09-14");
  assert.equal(result.request.dateParseStatus, "manual-required");
  assert.equal(result.request.dateSource, "manual-review");
  assert.equal(result.request.eventDate, null);
  assert.deepEqual(result.request.eventDates, []);
});

test("ignores unsupported forms and malformed canonical documents", () => {
  assert.deepEqual(buildPlannerRequestDocument({data: {type: "Person", id: "1"}}), {
    action: "ignore",
    reason: "not-form-submission",
    formId: "",
    submissionId: "",
  });
  assert.deepEqual(
      buildPlannerRequestDocument(canonicalSubmission("999", [])),
      {action: "ignore", reason: "unsupported-form", formId: "999", submissionId: "501"},
  );
});
