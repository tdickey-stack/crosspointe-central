import {GoogleGenAI} from "@google/genai";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";

const MODE_COLLECTION = "centralAssistantAdminModes";
const DRAFT_COLLECTION = "centralAssistantNoticeDrafts";
const NOTICE_COLLECTION = "centralAssistantNotices";
const MODE_DURATION_MS = 5 * 60 * 1000;
const DRAFT_DURATION_MS = 15 * 60 * 1000;
const MAX_NOTICE_DURATION_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_NOTICE_RESULTS = 3;
const PUBLISH_PERMISSIONS = new Set(["admin"]);
const ALLOWED_TOPICS = new Set([
  "general",
  "events",
  "care_center",
  "office",
  "campus",
  "pointe_groups",
  "children",
  "students",
]);
const ALLOWED_OVERRIDES = new Set([
  "knowledge",
  "planning_center_events",
  "planning_center_groups",
]);

const NOTICE_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    clarificationNeeded: {type: "boolean"},
    clarificationQuestion: {type: "string"},
    title: {type: "string"},
    publicMessage: {type: "string"},
    topic: {
      type: "string",
      enum: [...ALLOWED_TOPICS],
    },
    keywords: {
      type: "array",
      minItems: 0,
      maxItems: 8,
      items: {type: "string"},
    },
    startsAt: {type: "string"},
    expiresAt: {type: "string"},
    overrideTargets: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "string",
        enum: [...ALLOWED_OVERRIDES],
      },
    },
  },
  required: [
    "clarificationNeeded",
    "clarificationQuestion",
    "title",
    "publicMessage",
    "topic",
    "keywords",
    "startsAt",
    "expiresAt",
    "overrideTargets",
  ],
};

export function createWayfinderNoticeDraftGenerator(options = {}) {
  const model = String(options.model || "gemini-3.5-flash").trim();
  const ClientClass = options.GoogleGenAIClass || GoogleGenAI;
  const timezone = String(options.timezone || "America/Chicago");

  return async ({instruction, now, existingNotice}) => {
    const apiKey = String(
        typeof options.getApiKey === "function" ?
          options.getApiKey() : options.apiKey || "",
    ).trim();
    if (!apiKey && !options.client) {
      const error = new Error("Gemini notice drafting is not configured.");
      error.code = "wayfinder-notice-gemini-not-configured";
      throw error;
    }
    const client = options.client || new ClientClass({apiKey});
    const current = now instanceof Date ? now : new Date(now || Date.now());
    const systemInstruction = [
      "Create a temporary public CrossPointe Church operational notice.",
      "Use only the authenticated administrator's instruction.",
      "When an existing notice is supplied, apply the requested change and " +
        "preserve any details the administrator did not ask to change.",
      "Do not add facts, reasons, contacts, URLs, policies, or details.",
      "The notice must be short, plain, warm, and publicly appropriate.",
      "Use America/Chicago when interpreting relative dates and times.",
      "startsAt should normally be now unless the administrator explicitly " +
        "requests a future start.",
      "expiresAt must be the end of the stated temporary period.",
      "For 'closed this Friday', expire at the end of that Friday locally.",
      "If no safe temporary end can be determined, set clarificationNeeded " +
        "true and ask one short expiration question.",
      "Use topic care_center for food pantry or clothes closet notices.",
      "Use topic events for cancellations, moves, capacity, or event changes.",
      "Use planning_center_events as an override only for event changes.",
      "Use planning_center_groups only for Pointe Group changes.",
      "Always include knowledge as an override target for operational facts.",
      "Return only JSON matching the schema.",
    ].join("\n");
    const response = await client.models.generateContent({
      model,
      contents: JSON.stringify({
        currentTime: current.toISOString(),
        currentLocalTime: formatLocalDateTime_(current, timezone),
        timezone,
        administratorInstruction: String(instruction || "").trim(),
        existingNotice: existingNotice || null,
      }),
      config: {
        systemInstruction,
        temperature: 0.1,
        candidateCount: 1,
        maxOutputTokens: 1024,
        thinkingConfig: {
          thinkingLevel: "MINIMAL",
          includeThoughts: false,
        },
        responseMimeType: "application/json",
        responseJsonSchema: NOTICE_DRAFT_SCHEMA,
      },
    });
    return validateNoticeDraftOutput_(
        response && response.text,
        current,
        instruction,
        timezone,
    );
  };
}

export function createWayfinderNoticeCommandHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const generateDraft = dependencies.generateDraft;
  const now = typeof dependencies.now === "function" ?
    dependencies.now : () => new Date();

  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request,
        admin,
        firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      requirePublishPermission_(authResult.permission);
      const action = String(request.body && request.body.action || "")
          .trim().toLowerCase();
      const current = now();
      let result;

      if (action === "enter") {
        result = await enterNoticeMode_(
            firestore,
            authResult.decodedToken,
            current,
        );
      } else if (action === "exit") {
        result = await exitNoticeMode_(
            firestore,
            authResult.decodedToken,
            current,
        );
      } else if (action === "draft") {
        result = await createNoticeDraft_({
          firestore,
          decodedToken: authResult.decodedToken,
          instruction: request.body && request.body.instruction,
          noticeId: request.body && request.body.noticeId,
          current,
          generateDraft,
        });
      } else if (action === "publish") {
        result = await publishNoticeDraft_({
          admin,
          firestore,
          decodedToken: authResult.decodedToken,
          draftId: request.body && request.body.draftId,
          current,
        });
      } else if (action === "cancel") {
        result = await cancelNoticeDraft_({
          firestore,
          decodedToken: authResult.decodedToken,
          draftId: request.body && request.body.draftId,
          current,
        });
      } else if (action === "list") {
        await requireActiveMode_(
            firestore,
            authResult.decodedToken.uid,
            current,
        );
        result = await listNotices_(firestore, current);
      } else if (action === "end") {
        result = await endNotice_({
          firestore,
          decodedToken: authResult.decodedToken,
          noticeId: request.body && request.body.noticeId,
          current,
        });
      } else {
        throw createWayfinderAccessError(400, "Unsupported notice action.");
      }

      response.status(200).json({ok: true, ...result});
    } catch (error) {
      const status = Number(error && error.statusCode) || 503;
      if (!error || !error.statusCode) {
        console.error("Wayfinder notice command failed.", {
          code: String(error && error.code || "unknown"),
          name: String(error && error.name || "Error"),
        });
      }
      response.status(status).json({
        error: error && error.statusCode ?
          String(error.message || "Notice access denied.") :
          "Wayfinder could not safely process that notice update.",
      });
    }
  };
}

export async function getActiveWayfinderNotices(firestore, now = new Date()) {
  const snapshot = await firestore.collection(NOTICE_COLLECTION)
      .where("active", "==", true)
      .limit(50)
      .get();
  const currentTime = now.getTime();
  return snapshot.docs.map((document) => {
    const data = document.data() || {};
    return {
      id: document.id,
      title: String(data.title || "").trim(),
      publicMessage: String(data.publicMessage || "").trim(),
      topic: String(data.topic || "general").trim(),
      keywords: stringArray_(data.keywords),
      overrideTargets: stringArray_(data.overrideTargets),
      startsAt: dateFromValue_(data.startsAt),
      expiresAt: dateFromValue_(data.expiresAt),
    };
  }).filter((notice) => {
    return notice.title && notice.publicMessage &&
      notice.startsAt && notice.expiresAt &&
      notice.startsAt.getTime() <= currentTime &&
      notice.expiresAt.getTime() > currentTime;
  });
}

export function selectRelevantWayfinderNotices(
    question,
    notices,
    limit = MAX_NOTICE_RESULTS,
) {
  const queryTokens = tokenize_(question);
  return (Array.isArray(notices) ? notices : [])
      .map((notice) => {
        const noticeTokens = new Set(tokenize_([
          notice.title,
          notice.publicMessage,
          notice.topic,
          ...(notice.keywords || []),
        ].join(" ")));
        let score = notice.topic === "general" ? 1 : 0;
        queryTokens.forEach((token) => {
          if (noticeTokens.has(token)) score += 5;
        });
        return {notice, score};
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, Math.min(Number(limit) || 1, 5)))
      .map((item) => buildNoticeKnowledgeEntry_(item.notice));
}

async function enterNoticeMode_(firestore, decodedToken, current) {
  const expiresAt = new Date(current.getTime() + MODE_DURATION_MS);
  await firestore.collection(MODE_COLLECTION).doc(decodedToken.uid).set({
    active: true,
    uid: decodedToken.uid,
    email: normalizeEmail_(decodedToken.email),
    expiresAt,
    activatedAt: current,
    updatedAt: current,
  }, {merge: true});
  return {
    mode: "notice_admin",
    modeActive: true,
    expiresAt: expiresAt.toISOString(),
    message: "Admin Update Mode is active for five minutes. What temporary " +
      "or permanent information would you like to update?",
  };
}

async function exitNoticeMode_(firestore, decodedToken, current) {
  await firestore.collection(MODE_COLLECTION).doc(decodedToken.uid).set({
    active: false,
    updatedAt: current,
  }, {merge: true});
  return {
    mode: "notice_admin",
    modeActive: false,
    message: "Admin Update Mode is closed.",
  };
}

async function createNoticeDraft_(options) {
  await requireActiveMode_(
      options.firestore,
      options.decodedToken.uid,
      options.current,
  );
  const instruction = String(options.instruction || "").trim();
  if (!instruction || instruction.length > 500) {
    throw createWayfinderAccessError(
        400,
        "Describe the temporary update in 500 characters or fewer.",
    );
  }
  let existingNotice = null;
  let replacesNoticeId = "";
  if (options.noticeId) {
    replacesNoticeId = requireSafeId_(options.noticeId);
    const snapshot = await options.firestore.collection(NOTICE_COLLECTION)
        .doc(replacesNoticeId).get();
    if (!snapshot.exists) {
      throw createWayfinderAccessError(404, "That notice was not found.");
    }
    existingNotice = toPublicNotice_(
        replacesNoticeId,
        snapshot.data() || {},
        options.current,
    );
  }
  const generated = await options.generateDraft({
    instruction,
    now: options.current,
    existingNotice,
  });
  if (generated.clarificationNeeded) {
    return {
      mode: "notice_admin",
      modeActive: true,
      needsClarification: true,
      message: generated.clarificationQuestion,
    };
  }
  const draftReference = options.firestore.collection(DRAFT_COLLECTION).doc();
  const draftExpiresAt = new Date(
      options.current.getTime() + DRAFT_DURATION_MS,
  );
  const draftData = {
    ...generated,
    replacesNoticeId,
    status: "draft",
    createdByUid: options.decodedToken.uid,
    createdByEmail: normalizeEmail_(options.decodedToken.email),
    createdAt: options.current,
    updatedAt: options.current,
    draftExpiresAt,
  };
  await draftReference.set(draftData);
  return {
    mode: "notice_admin",
    modeActive: true,
    needsClarification: false,
    draft: toPublicDraft_(draftReference.id, draftData),
    message: "Review this notice carefully before publishing it.",
  };
}

async function publishNoticeDraft_(options) {
  await requireActiveMode_(
      options.firestore,
      options.decodedToken.uid,
      options.current,
  );
  const draftId = requireSafeId_(options.draftId);
  const draftReference = options.firestore.collection(DRAFT_COLLECTION)
      .doc(draftId);
  const draftSnapshot = await draftReference.get();
  if (!draftSnapshot.exists) {
    throw createWayfinderAccessError(404, "That notice draft was not found.");
  }
  const draft = draftSnapshot.data() || {};
  if (draft.createdByUid !== options.decodedToken.uid ||
    draft.status !== "draft") {
    throw createWayfinderAccessError(
        403,
        "That notice draft cannot be published.",
    );
  }
  const draftExpiresAt = dateFromValue_(draft.draftExpiresAt);
  if (!draftExpiresAt || draftExpiresAt <= options.current) {
    throw createWayfinderAccessError(
        409,
        "That notice draft expired. Please describe the update again.",
    );
  }
  const noticeReference = options.firestore.collection(NOTICE_COLLECTION).doc();
  const noticeData = {
    title: String(draft.title || "").trim(),
    publicMessage: String(draft.publicMessage || "").trim(),
    topic: String(draft.topic || "general").trim(),
    keywords: stringArray_(draft.keywords),
    overrideTargets: stringArray_(draft.overrideTargets),
    startsAt: dateFromValue_(draft.startsAt),
    expiresAt: dateFromValue_(draft.expiresAt),
    active: true,
    source: "wayfinder_admin_notice",
    createdByUid: options.decodedToken.uid,
    createdByEmail: normalizeEmail_(options.decodedToken.email),
    publishedAt: options.current,
    updatedAt: options.current,
    replacesNoticeId: String(draft.replacesNoticeId || ""),
  };
  const batch = options.firestore.batch();
  batch.set(noticeReference, noticeData);
  if (noticeData.replacesNoticeId) {
    batch.set(
        options.firestore.collection(NOTICE_COLLECTION)
            .doc(noticeData.replacesNoticeId),
        {
          active: false,
          supersededByNoticeId: noticeReference.id,
          supersededAt: options.current,
          updatedAt: options.current,
        },
        {merge: true},
    );
  }
  batch.set(draftReference, {
    status: "published",
    publishedNoticeId: noticeReference.id,
    publishedAt: options.current,
    updatedAt: options.current,
  }, {merge: true});
  await batch.commit();
  return {
    mode: "notice_admin",
    modeActive: true,
    published: true,
    notice: toPublicDraft_(noticeReference.id, noticeData),
    message: "The temporary Wayfinder notice is published.",
  };
}

async function cancelNoticeDraft_(options) {
  const draftId = requireSafeId_(options.draftId);
  const reference = options.firestore.collection(DRAFT_COLLECTION).doc(draftId);
  const snapshot = await reference.get();
  if (snapshot.exists) {
    const draft = snapshot.data() || {};
    if (draft.createdByUid !== options.decodedToken.uid) {
      throw createWayfinderAccessError(
          403,
          "That notice draft cannot be changed.",
      );
    }
    await reference.set({
      status: "cancelled",
      updatedAt: options.current,
    }, {merge: true});
  }
  return {
    mode: "notice_admin",
    modeActive: true,
    cancelled: true,
    message: "The notice draft was cancelled.",
  };
}

async function listNotices_(firestore, current) {
  const snapshot = await firestore.collection(NOTICE_COLLECTION)
      .limit(100)
      .get();
  const notices = snapshot.docs
      .map((document) => {
        return toPublicNotice_(document.id, document.data() || {}, current);
      })
      .sort((left, right) => {
        return String(right.startsAt).localeCompare(String(left.startsAt));
      });
  return {
    mode: "notice_admin",
    modeActive: true,
    notices,
    message: notices.length ?
      "Temporary notices are ready to manage." :
      "There are no temporary notices yet.",
  };
}

async function endNotice_(options) {
  await requireActiveMode_(
      options.firestore,
      options.decodedToken.uid,
      options.current,
  );
  const noticeId = requireSafeId_(options.noticeId);
  const reference = options.firestore.collection(NOTICE_COLLECTION)
      .doc(noticeId);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    throw createWayfinderAccessError(404, "That notice was not found.");
  }
  await reference.set({
    active: false,
    endedAt: options.current,
    endedByUid: options.decodedToken.uid,
    endedByEmail: normalizeEmail_(options.decodedToken.email),
    updatedAt: options.current,
  }, {merge: true});
  return {
    mode: "notice_admin",
    modeActive: true,
    ended: true,
    noticeId,
    message: "The temporary notice ended immediately.",
  };
}

async function requireActiveMode_(firestore, uid, current) {
  const snapshot = await firestore.collection(MODE_COLLECTION).doc(uid).get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  const expiresAt = dateFromValue_(data.expiresAt);
  if (data.active !== true || !expiresAt || expiresAt <= current) {
    throw createWayfinderAccessError(
        409,
        "Admin Update Mode expired. Enter Alohomora again.",
    );
  }
}

function validateNoticeDraftOutput_(
    rawOutput,
    current,
    instruction,
    timezone,
) {
  let output;
  try {
    output = JSON.parse(String(rawOutput || "").trim());
  } catch (error) {
    throw createNoticeValidationError_(
        "Gemini returned an invalid notice draft.",
    );
  }
  if (output.clarificationNeeded === true) {
    const question = String(output.clarificationQuestion || "").trim();
    if (!question || question.length > 240) {
      throw createNoticeValidationError_("The clarification was invalid.");
    }
    return {clarificationNeeded: true, clarificationQuestion: question};
  }
  const title = String(output.title || "").trim();
  const publicMessage = String(output.publicMessage || "").trim();
  const topic = String(output.topic || "").trim();
  const keywords = stringArray_(output.keywords)
      .map((keyword) => keyword.slice(0, 60))
      .filter(Boolean)
      .slice(0, 8);
  const overrideTargets = [...new Set(stringArray_(output.overrideTargets))];
  const startsAt = new Date(output.startsAt);
  let expiresAt = new Date(output.expiresAt);
  expiresAt = getDeterministicRelativeExpiration_(
      instruction,
      current,
      timezone,
  ) || expiresAt;
  const invalidText = /https?:\/\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

  if (!title || title.length > 100 || !publicMessage ||
    publicMessage.length > 400 || invalidText.test(publicMessage)) {
    throw createNoticeValidationError_("The public notice text was invalid.");
  }
  if (!ALLOWED_TOPICS.has(topic) ||
    !overrideTargets.length ||
    overrideTargets.some((target) => !ALLOWED_OVERRIDES.has(target))) {
    throw createNoticeValidationError_("The notice routing was invalid.");
  }
  if (!keywords.length || Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt ||
    expiresAt <= current ||
    expiresAt.getTime() - startsAt.getTime() > MAX_NOTICE_DURATION_MS) {
    throw createNoticeValidationError_("The notice dates were invalid.");
  }
  return {
    clarificationNeeded: false,
    clarificationQuestion: "",
    title,
    publicMessage,
    topic,
    keywords,
    startsAt,
    expiresAt,
    overrideTargets,
  };
}

function buildNoticeKnowledgeEntry_(notice) {
  return {
    id: "active-notice-" + String(notice.id || "").replace(/[^\w-]/g, ""),
    topic: String(notice.topic || "general"),
    title: String(notice.title || "Temporary CrossPointe update"),
    responseMode: "guided",
    requiredFacts: [
      "Active temporary notice: " + String(notice.publicMessage || ""),
      "This notice expires at " + notice.expiresAt.toISOString() + ".",
    ],
    requiredActions: [
      "This active temporary notice overrides conflicting evergreen or live " +
      "information until it expires.",
    ],
    prohibitedClaims: [
      "Do not extend this notice beyond its expiration or add " +
        "unstated details.",
    ],
    approvedLinks: [],
    overrideTargets: notice.overrideTargets,
    liveSource: {type: "operational_notice", sourceId: notice.id},
  };
}

function toPublicDraft_(id, data) {
  const startsAt = dateFromValue_(data.startsAt);
  const expiresAt = dateFromValue_(data.expiresAt);
  return {
    id,
    title: String(data.title || ""),
    publicMessage: String(data.publicMessage || ""),
    topic: String(data.topic || "general"),
    keywords: stringArray_(data.keywords),
    overrideTargets: stringArray_(data.overrideTargets),
    startsAt: startsAt ? startsAt.toISOString() : "",
    expiresAt: expiresAt ? expiresAt.toISOString() : "",
    replacesNoticeId: String(data.replacesNoticeId || ""),
  };
}

function toPublicNotice_(id, data, current) {
  const notice = toPublicDraft_(id, data);
  const startsAt = dateFromValue_(data.startsAt);
  const expiresAt = dateFromValue_(data.expiresAt);
  const nowTime = current.getTime();
  let status = "ended";
  if (data.supersededByNoticeId) {
    status = "superseded";
  } else if (data.active === true && startsAt &&
    startsAt.getTime() > nowTime) {
    status = "scheduled";
  } else if (data.active === true && expiresAt &&
    expiresAt.getTime() > nowTime) {
    status = "active";
  } else if (expiresAt && expiresAt.getTime() <= nowTime) {
    status = "expired";
  }
  return {
    ...notice,
    status,
    active: data.active === true,
    createdByEmail: normalizeEmail_(data.createdByEmail),
    publishedAt: dateFromValue_(data.publishedAt) ?
      dateFromValue_(data.publishedAt).toISOString() : "",
    supersededByNoticeId: String(data.supersededByNoticeId || ""),
  };
}

function requirePublishPermission_(permission) {
  if (!PUBLISH_PERMISSIONS.has(String(permission || ""))) {
    throw createWayfinderAccessError(
        403,
        "Your Wayfinder access does not allow publishing notices.",
    );
  }
}

function requireSafeId_(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw createWayfinderAccessError(400, "A valid notice draft is required.");
  }
  return id;
}

function dateFromValue_(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringArray_(value) {
  return (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
}

function tokenize_(value) {
  return [...new Set(String(value || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2))];
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function createNoticeValidationError_(message) {
  const error = new Error(message);
  error.code = "wayfinder-notice-validation";
  return error;
}

function getDeterministicRelativeExpiration_(
    instruction,
    current,
    timezone,
) {
  const text = String(instruction || "").toLowerCase();
  if (/\b(?:at\s+\d|a\.?m\.?|p\.?m\.?|noon|midnight)\b/i.test(text)) {
    return null;
  }
  const local = getLocalDateParts_(current, timezone);
  let daysToAdd = null;
  const weekdayPattern = new RegExp(
      "\\b(this|next|through|until)\\s+" +
        "(sunday|monday|tuesday|wednesday|thursday|" +
        "friday|saturday)\\b",
      "i",
  );
  const weekdayMatch = text.match(weekdayPattern);
  const weekdays = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ];

  if (weekdayMatch) {
    const targetDay = weekdays.indexOf(weekdayMatch[2].toLowerCase());
    const currentDay = weekdays.indexOf(local.weekday.toLowerCase());
    daysToAdd = (targetDay - currentDay + 7) % 7;
    if (weekdayMatch[1].toLowerCase() === "next" && daysToAdd === 0) {
      daysToAdd = 7;
    }
  } else if (/\btomorrow\b/i.test(text)) {
    daysToAdd = 1;
  } else if (/\btoday\b|\btonight\b/i.test(text)) {
    daysToAdd = 0;
  }

  if (daysToAdd === null) return null;
  const target = new Date(Date.UTC(
      local.year,
      local.month - 1,
      local.day + daysToAdd,
  ));
  return endOfLocalDate_(
      target.getUTCFullYear(),
      target.getUTCMonth() + 1,
      target.getUTCDate(),
      timezone,
  );
}

function getLocalDateParts_(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(date);
  const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: String(values.weekday || ""),
  };
}

function endOfLocalDate_(year, month, day, timezone) {
  const approximate = new Date(Date.UTC(year, month - 1, day, 18));
  const offset = getTimezoneOffset_(approximate, timezone);
  const datePart = [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
  return new Date(datePart + "T23:59:59.999" + offset);
}

function getTimezoneOffset_(date, timezone) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(date).find((item) => item.type === "timeZoneName");
  const value = String(part && part.value || "GMT+00:00")
      .replace(/^GMT/, "");
  return /^[+-]\d{2}:\d{2}$/.test(value) ? value : "+00:00";
}

function formatLocalDateTime_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
}
