/* eslint-disable max-len, require-jsdoc */

import crypto from "node:crypto";

const PCO_PEOPLE_API_ROOT = "https://api.planningcenteronline.com/people/v2";

const EVENT_PROMO_FORM = Object.freeze({
  id: "930568",
  name: "CrossPointe Event & Promo Form",
  fields: Object.freeze({
    ministry: "7301875",
    name: "7301877",
    rawEventDate: "7301879",
    requiresPromotion: "7301964",
    requestedPromotionDates: "7301968",
    details: "7302145",
    promoInfoReady: "7452308",
    requestedPlatforms: "9647462",
  }),
  qualifyingOptions: Object.freeze({
    requiresPromotion: "7963996",
    promoInfoReady: "8136339",
  }),
});

const GENERAL_PROMOTION_FORM = Object.freeze({
  id: "1229879",
  name: "General Promotion Form",
  fields: Object.freeze({
    ministry: "9769760",
    name: "9769763",
    description: "9769769",
    requestedPromotionStart: "9769782",
    requestedPromotionEnd: "9769783",
    requestedPlatforms: "9769788",
    notes: "9769794",
    success: "9769812",
  }),
});

const SUPPORTED_FORMS = Object.freeze({
  [EVENT_PROMO_FORM.id]: EVENT_PROMO_FORM,
  [GENERAL_PROMOTION_FORM.id]: GENERAL_PROMOTION_FORM,
});

const MONTHS = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

const MONTH_PATTERN = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_PATTERN = "(?:[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?";
const YEAR_PATTERN = "(?:19|20)\\d{2}";
const NAMED_DATE_PATTERN = `${MONTH_PATTERN}\\s+${DAY_PATTERN}(?:\\s*,?\\s*${YEAR_PATTERN})?`;
const NUMERIC_DATE_PATTERN = "(?:0?[1-9]|1[0-2])\\/(?:0?[1-9]|[12]\\d|3[01])(?:\\/(?:\\d{2}|\\d{4}))?";
const ISO_DATE_PATTERN = "(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])";
const DATE_TOKEN_PATTERN = `(?:${ISO_DATE_PATTERN}|${NUMERIC_DATE_PATTERN}|${NAMED_DATE_PATTERN})`;

function text(value, maximum = 4000) {
  return String(value === null || value === undefined ? "" : value).trim().slice(0, maximum);
}

function identifier(value) {
  const normalized = text(value, 120);
  return /^\d+$/.test(normalized) ? normalized : "";
}

function normalizeType(value) {
  return text(value, 160)
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function relationshipIds(resource, key) {
  const relationship = asObject(asObject(asObject(resource).relationships)[key]);
  const data = relationship.data;
  const resources = Array.isArray(data) ? data : data ? [data] : [];
  return resources.map((item) => identifier(asObject(item).id)).filter(Boolean);
}

function relationshipId(resource, key) {
  return relationshipIds(resource, key)[0] || "";
}

function validIsoTimestamp(value, fallback = "") {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function validDateOnly(value) {
  const normalized = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  return isoDate(year, month, day);
}

function isoDate(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferredYear(month, day, submittedAt) {
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return null;
  const submittedDate = Date.UTC(
      submitted.getUTCFullYear(),
      submitted.getUTCMonth(),
      submitted.getUTCDate(),
  );
  const sameYear = Date.UTC(submitted.getUTCFullYear(), month - 1, day);
  const halfYearMs = 183 * 24 * 60 * 60 * 1000;
  return sameYear < submittedDate - halfYearMs ?
    submitted.getUTCFullYear() + 1 :
    submitted.getUTCFullYear();
}

function parseYear(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (String(value).length === 2) return numeric >= 70 ? 1900 + numeric : 2000 + numeric;
  return numeric;
}

function parseDateToken(token, submittedAt, inheritedYear = null) {
  const normalized = text(token, 100).toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    return date ? {date, explicitYear: true} : null;
  }

  match = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const explicitYear = Boolean(match[3]);
    const parsedYear = parseYear(match[3]);
    const year = parsedYear === null ?
      (inheritedYear === null ? inferredYear(month, day, submittedAt) : inheritedYear) :
      parsedYear;
    const date = year ? isoDate(year, month, day) : "";
    return date ? {date, explicitYear} : null;
  }

  match = normalized.match(new RegExp(`^(${MONTH_PATTERN})\\s+(${DAY_PATTERN})(?:\\s*,?\\s*(${YEAR_PATTERN}))?$`, "i"));
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2].replace(/\D/g, ""));
  const explicitYear = Boolean(match[3]);
  const parsedYear = parseYear(match[3]);
  const year = parsedYear === null ?
    (inheritedYear === null ? inferredYear(month, day, submittedAt) : inheritedYear) :
    parsedYear;
  const date = year ? isoDate(year, month, day) : "";
  return date ? {date, explicitYear} : null;
}

function dateParseResult(rawText, values = {}) {
  return {
    rawText,
    status: values.status || "needs-review",
    kind: values.kind || null,
    primaryDate: values.primaryDate || null,
    dates: values.dates || [],
    endDate: values.endDate || null,
  };
}

function parseDateRange(rawText, submittedAt) {
  let match = rawText.match(new RegExp(`^(${DATE_TOKEN_PATTERN})\\s*(?:-|–|—|to|through|thru)\\s*(${DATE_TOKEN_PATTERN})$`, "i"));
  if (match) {
    const start = parseDateToken(match[1], submittedAt);
    let end = parseDateToken(match[2], submittedAt, start ? Number(start.date.slice(0, 4)) : null);
    if (!start || !end) return null;
    if (end.date < start.date && !end.explicitYear) {
      const [year, month, day] = end.date.split("-").map(Number);
      const rolled = isoDate(year + 1, month, day);
      end = rolled ? {...end, date: rolled} : end;
    }
    if (end.date < start.date) return null;
    return dateParseResult(rawText, {
      status: "parsed",
      kind: "range",
      primaryDate: start.date,
      dates: [start.date, end.date],
      endDate: end.date,
    });
  }

  match = rawText.match(new RegExp(`^(${MONTH_PATTERN})\\s+(${DAY_PATTERN})\\s*(?:-|–|—|to|through|thru)\\s*(${DAY_PATTERN})(?:\\s*,?\\s*(${YEAR_PATTERN}))?$`, "i"));
  if (match) {
    const year = match[4] || null;
    const start = parseDateToken(`${match[1]} ${match[2]}${year ? ` ${year}` : ""}`, submittedAt);
    const end = parseDateToken(`${match[1]} ${match[3]}${year ? ` ${year}` : ""}`, submittedAt, start ? Number(start.date.slice(0, 4)) : null);
    if (!start || !end || end.date < start.date) return null;
    return dateParseResult(rawText, {
      status: "parsed",
      kind: "range",
      primaryDate: start.date,
      dates: [start.date, end.date],
      endDate: end.date,
    });
  }

  match = rawText.match(/^(\d{1,2})\/(\d{1,2})\s*(?:-|–|—|to|through|thru)\s*(?:(\d{1,2})\/)?(\d{1,2})(?:\/(\d{2}|\d{4}))?$/i);
  if (!match) return null;
  const rightMonth = match[3] || match[1];
  const year = match[5] || null;
  const start = parseDateToken(`${match[1]}/${match[2]}${year ? `/${year}` : ""}`, submittedAt);
  let end = parseDateToken(`${rightMonth}/${match[4]}${year ? `/${year}` : ""}`, submittedAt, start ? Number(start.date.slice(0, 4)) : null);
  if (!start || !end) return null;
  if (end.date < start.date && !year) {
    const [endYear, month, day] = end.date.split("-").map(Number);
    const rolled = isoDate(endYear + 1, month, day);
    end = rolled ? {...end, date: rolled} : end;
  }
  if (end.date < start.date) return null;
  return dateParseResult(rawText, {
    status: "parsed",
    kind: "range",
    primaryDate: start.date,
    dates: [start.date, end.date],
    endDate: end.date,
  });
}

function parseSameMonthMultiple(rawText, submittedAt) {
  const match = rawText.match(new RegExp(`^(${MONTH_PATTERN})\\s+(${DAY_PATTERN})(?:\\s*(?:,|&|and|\\+)\\s*(${DAY_PATTERN}))+(?:\\s*,?\\s*(${YEAR_PATTERN}))?$`, "i"));
  if (!match) return null;

  const monthMatch = rawText.match(new RegExp(`^(${MONTH_PATTERN})\\s+`, "i"));
  const yearMatch = rawText.match(new RegExp(`(?:,?\\s*)(${YEAR_PATTERN})$`, "i"));
  const withoutMonth = rawText.slice(monthMatch[0].length).replace(new RegExp(`(?:,?\\s*)${YEAR_PATTERN}$`, "i"), "");
  const days = withoutMonth.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean);
  if (days.length < 2) return null;
  const year = yearMatch ? yearMatch[1] : "";
  const parsed = days.map((day) => parseDateToken(`${monthMatch[1]} ${day}${year ? ` ${year}` : ""}`, submittedAt));
  if (parsed.some((item) => !item)) return null;
  const dates = [...new Set(parsed.map((item) => item.date))].sort();
  if (dates.length > 8) return dateParseResult(rawText);
  return dateParseResult(rawText, {
    status: "parsed",
    kind: "multiple",
    primaryDate: dates[0],
    dates,
  });
}

function parseGeneralMultiple(rawText, submittedAt) {
  const matches = [...rawText.matchAll(new RegExp(DATE_TOKEN_PATTERN, "gi"))];
  if (matches.length < 2) return null;
  let remainder = rawText;
  matches.slice().reverse().forEach((match) => {
    remainder = remainder.slice(0, match.index) + " " + remainder.slice(match.index + match[0].length);
  });
  remainder = remainder.replace(/\band\b/gi, "").replace(/[\s,;&+]+/g, "");
  if (remainder) return null;
  const parsed = matches.map((match) => parseDateToken(match[0], submittedAt));
  if (parsed.some((item) => !item)) return null;
  const dates = [...new Set(parsed.map((item) => item.date))].sort();
  if (dates.length > 8) return dateParseResult(rawText);
  return dateParseResult(rawText, {
    status: "parsed",
    kind: "multiple",
    primaryDate: dates[0],
    dates,
  });
}

/**
 * Conservatively parses date text supplied through the Event/Promo form.
 * Yearless dates use the submission year, unless that would place the date
 * more than 183 days before submission, in which case the next year is used.
 *
 * @param {string} value Free-text date answer.
 * @param {string|Date} submittedAt Canonical PCO submission timestamp.
 * @return {Object} Normalized date suggestion and review status.
 */
export function parseEventDateText(value, submittedAt) {
  const rawText = text(value, 1000).replace(/\s+/g, " ");
  if (!rawText) return dateParseResult(rawText);
  if (!validIsoTimestamp(submittedAt)) return dateParseResult(rawText);
  if (/\b(?:tbd|unknown|various|multiple|every|weekly|monthly|recurring|as needed)\b/i.test(rawText)) {
    return dateParseResult(rawText);
  }

  const range = parseDateRange(rawText, submittedAt);
  if (range) return range;
  const sameMonthMultiple = parseSameMonthMultiple(rawText, submittedAt);
  if (sameMonthMultiple) return sameMonthMultiple;
  const generalMultiple = parseGeneralMultiple(rawText, submittedAt);
  if (generalMultiple) return generalMultiple;

  const single = parseDateToken(rawText, submittedAt);
  if (!single) return dateParseResult(rawText);
  return dateParseResult(rawText, {
    status: "parsed",
    kind: "single",
    primaryDate: single.date,
    dates: [single.date],
  });
}

/**
 * Verifies Planning Center's hex HMAC-SHA256 signature over the raw body.
 *
 * @param {Buffer|string} rawBody Exact request bytes received by HTTPS.
 * @param {string} providedSignature X-PCO-Webhooks-Authenticity header.
 * @param {string} secret Webhook subscription authenticity secret.
 * @return {boolean} Whether the body has a valid signature.
 */
export function verifyPlanningCenterWebhookSignature(rawBody, providedSignature, secret) {
  if ((!Buffer.isBuffer(rawBody) && typeof rawBody !== "string") || !text(secret, 1000)) return false;
  const normalizedSignature = text(providedSignature, 256).toLowerCase().replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/.test(normalizedSignature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(normalizedSignature, "hex");
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

function eventName(event) {
  const attributes = asObject(event.attributes);
  return text(
      attributes.name || attributes.event || attributes.type ||
      event.name || event.event || event.event_type || event.type,
      240,
  );
}

function findSubmissionResource(value, depth = 0) {
  if (depth > 8 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSubmissionResource(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const object = asObject(value);
  const type = normalizeType(object.type);
  if (type === "form_submission" && identifier(object.id)) return object;
  for (const [key, child] of Object.entries(object)) {
    if (["person", "answers", "form_submission_values"].includes(normalizeType(key))) continue;
    const found = findSubmissionResource(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function webhookEvents(payload) {
  const source = asObject(payload);
  if (Array.isArray(source.data)) return source.data;
  if (source.data && typeof source.data === "object") return [source.data];
  if (Array.isArray(source.events)) return source.events;
  return [source];
}

function decodedEventPayload(event) {
  const payload = asObject(event.attributes).payload;
  if (payload && typeof payload === "object") return payload;
  if (typeof payload !== "string" || payload.length > 2000000) return {};
  try {
    return asObject(JSON.parse(payload));
  } catch (error) {
    void error;
    return {};
  }
}

/**
 * Extracts canonical submission references from created webhook deliveries.
 * Update events and resources without both form/submission IDs are ignored.
 *
 * @param {Object} payload Parsed Planning Center webhook body.
 * @return {Array<Object>} Unique created form-submission references.
 */
export function extractPlanningCenterFormSubmissionRefs(payload) {
  const refs = [];
  const seen = new Set();
  webhookEvents(payload).forEach((event) => {
    const name = normalizeType(eventName(asObject(event)));
    if (!name.endsWith("form_submission_created")) return;
    const submission = findSubmissionResource(decodedEventPayload(event));
    if (!submission) return;
    const submissionId = identifier(submission.id);
    const formId = relationshipId(submission, "form") ||
      identifier(asObject(asObject(event.attributes).form).id) ||
      identifier(asObject(event.form).id);
    if (!submissionId || !formId) return;
    const key = `${formId}:${submissionId}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({
      deliveryId: identifier(event.id) || text(event.id, 160),
      eventName: eventName(event),
      formId,
      submissionId,
    });
  });
  return refs;
}

/**
 * Builds the canonical PCO People API URL for one form submission.
 *
 * @param {string} formId PCO People form ID.
 * @param {string} submissionId PCO form submission ID.
 * @return {string} Canonical submission URL.
 */
export function buildPlanningCenterFormSubmissionUrl(formId, submissionId) {
  const normalizedFormId = identifier(formId);
  const normalizedSubmissionId = identifier(submissionId);
  if (!normalizedFormId || !normalizedSubmissionId) {
    throw new Error("A numeric Planning Center form ID and submission ID are required.");
  }
  return `${PCO_PEOPLE_API_ROOT}/forms/${normalizedFormId}/form_submissions/${normalizedSubmissionId}?include=form_submission_values`;
}

function submissionAnswers(document, submissionId) {
  const included = Array.isArray(document.included) ? document.included : [];
  const answers = new Map();
  included.forEach((resource) => {
    if (normalizeType(resource.type) !== "form_submission_value") return;
    const ownerId = relationshipId(resource, "form_submission");
    if (ownerId && ownerId !== submissionId) return;
    const fieldId = relationshipId(resource, "form_field");
    if (!fieldId) return;
    const attributes = asObject(resource.attributes);
    const answer = {
      displayValue: text(
          attributes.display_value === null || attributes.display_value === undefined ?
            attributes.value : attributes.display_value,
          6000,
      ),
      rawValue: text(attributes.value, 6000),
      optionIds: relationshipIds(resource, "form_field_option"),
    };
    if (!answers.has(fieldId)) answers.set(fieldId, []);
    answers.get(fieldId).push(answer);
  });
  return answers;
}

function answerText(answers, fieldId, maximum = 4000) {
  return text((answers.get(fieldId) || []).map((answer) => answer.displayValue).filter(Boolean).join("\n"), maximum);
}

function answerHasOption(answers, fieldId, optionId) {
  return (answers.get(fieldId) || []).some((answer) => answer.optionIds.includes(optionId));
}

function answerDate(answers, fieldId, submittedAt) {
  const values = answers.get(fieldId) || [];
  for (const answer of values) {
    const normalized = validDateOnly(answer.rawValue) || validDateOnly(answer.displayValue);
    if (normalized) return normalized;
    const parsed = parseEventDateText(answer.displayValue, submittedAt);
    if (parsed.status === "parsed" && parsed.kind === "single") return parsed.primaryDate;
  }
  return null;
}

function answerList(answers, fieldId) {
  const values = (answers.get(fieldId) || []).flatMap((answer) => answer.displayValue.split(/\r?\n|\s*;\s*/u));
  return [...new Set(values.map((value) => text(value, 120)).filter(Boolean))].slice(0, 12);
}

function ignore(reason, formId = "", submissionId = "") {
  return {action: "ignore", reason, formId, submissionId};
}

function dateFieldsForEvent(rawText, submittedAt) {
  const parsed = parseEventDateText(rawText, submittedAt);
  return {
    rawEventDateText: text(parsed.rawText, 500),
    eventDate: parsed.primaryDate,
    eventDates: parsed.dates,
    eventDateEnd: parsed.endDate,
    dateParseStatus: parsed.status,
    dateParseKind: parsed.kind,
    dateSource: parsed.status === "parsed" ? "form-parser" : "manual-review",
  };
}

function dateFieldsForGeneral() {
  return {
    rawEventDateText: "",
    eventDate: null,
    eventDates: [],
    eventDateEnd: null,
    dateParseStatus: "manual-required",
    dateParseKind: null,
    dateSource: "manual-review",
  };
}

/**
 * Converts a canonical PCO FormSubmission response into an idempotent,
 * campaign-only Planner request. Person resources and raw API data are omitted.
 *
 * @param {Object} apiDocument JSON:API document returned by PCO People.
 * @param {Object} options Normalization options.
 * @return {Object} Upsert instruction or explicit ignore result.
 */
export function buildPlannerRequestDocument(apiDocument, options = {}) {
  const document = asObject(apiDocument);
  const submission = asObject(document.data);
  if (normalizeType(submission.type) !== "form_submission") {
    return ignore("not-form-submission");
  }
  const submissionId = identifier(submission.id);
  const formId = relationshipId(submission, "form") || identifier(options.formId);
  if (!submissionId || !formId) return ignore("missing-source-identity", formId, submissionId);
  const form = SUPPORTED_FORMS[formId];
  if (!form) return ignore("unsupported-form", formId, submissionId);

  const attributes = asObject(submission.attributes);
  const submittedAt = validIsoTimestamp(attributes.created_at);
  if (!submittedAt) return ignore("missing-submission-date", formId, submissionId);
  const receivedAt = validIsoTimestamp(options.receivedAt, new Date().toISOString());
  const answers = submissionAnswers(document, submissionId);

  if (formId === EVENT_PROMO_FORM.id) {
    const qualifies = answerHasOption(
        answers,
        form.fields.requiresPromotion,
        form.qualifyingOptions.requiresPromotion,
    ) && answerHasOption(
        answers,
        form.fields.promoInfoReady,
        form.qualifyingOptions.promoInfoReady,
    );
    if (!qualifies) return ignore("event-form-not-eligible", formId, submissionId);
  }

  const isEventForm = formId === EVENT_PROMO_FORM.id;
  const fields = form.fields;
  const proposedName = answerText(answers, fields.name, 140);
  const rawEventDateText = isEventForm ? answerText(answers, fields.rawEventDate, 500) : "";
  const dateFields = isEventForm ? dateFieldsForEvent(rawEventDateText, submittedAt) : dateFieldsForGeneral();
  const descriptionParts = isEventForm ?
    [answerText(answers, fields.details, 3000)] :
    [answerText(answers, fields.description, 3000), answerText(answers, fields.success, 3000)];
  const requestedPromotionTiming = isEventForm ?
    answerText(answers, fields.requestedPromotionDates, 1000) : "";
  const notes = isEventForm ?
    (requestedPromotionTiming ? `Requested promotion timing: ${requestedPromotionTiming}` : "") :
    answerText(answers, fields.notes, 3000);

  const request = {
    schemaVersion: 1,
    source: "planning-center-form",
    sourceFormId: formId,
    sourceFormName: form.name,
    sourceSubmissionId: submissionId,
    submittedAt,
    receivedAt,
    status: "pending-review",
    proposedName,
    ministry: answerText(answers, fields.ministry, 140),
    description: text(descriptionParts.filter(Boolean).join("\n\n"), 3000),
    notes: text(notes, 3000),
    requestedPlatforms: answerList(answers, fields.requestedPlatforms),
    requestedPromotionStart: isEventForm ? null : answerDate(answers, fields.requestedPromotionStart, submittedAt),
    requestedPromotionEnd: isEventForm ? null : answerDate(answers, fields.requestedPromotionEnd, submittedAt),
    ...dateFields,
    eligibility: {qualified: true},
  };

  return {
    action: "upsert",
    docId: `pco_${formId}_${submissionId}`,
    request,
  };
}

export const plannerPcoFormInternals = Object.freeze({
  EVENT_PROMO_FORM,
  GENERAL_PROMOTION_FORM,
  SUPPORTED_FORMS,
});
