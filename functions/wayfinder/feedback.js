import crypto from "node:crypto";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";

const FEEDBACK_COLLECTION = "centralAssistantFeedbackDraft";
const PUBLIC_FEEDBACK_LIMIT = 20;
const PUBLIC_FEEDBACK_WINDOW_MS = 60 * 1000;
const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 1800;
const MAX_NOTE_LENGTH = 500;
const ALLOWED_RATINGS = new Set(["helpful", "needs_work"]);
const ALLOWED_REASONS = new Set([
  "",
  "incorrect",
  "missing_information",
  "outdated",
  "too_long",
  "wrong_link",
  "other",
]);
const feedbackWindowsByClient = new Map();

export function createWayfinderPublicFeedbackHandler(dependencies) {
  const firestore = dependencies.firestore;
  const serverTimestamp = dependencies.serverTimestamp;

  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      if (dependencies.admin) {
        await authenticateWayfinderAdminRequest({
          request,
          admin: dependencies.admin,
          firestore,
          isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
          getAdminUserDocPath: dependencies.getAdminUserDocPath,
        });
      }
      if (typeof dependencies.requireEnabled === "function" &&
        await dependencies.requireEnabled() !== true) {
        throw createWayfinderAccessError(
            403,
            "Wayfinder is not enabled right now.",
        );
      }
      enforceFeedbackRateLimit_(request);
      const feedback = validatePublicFeedback_(request.body);
      const feedbackRef = firestore.collection(FEEDBACK_COLLECTION)
          .doc(feedback.responseId);
      const existing = await feedbackRef.get();
      const now = serverTimestamp();
      const stored = {
        responseId: feedback.responseId,
        question: feedback.question,
        answer: feedback.answer,
        rating: feedback.rating,
        reason: feedback.reason,
        note: feedback.note,
        links: feedback.links,
        actions: feedback.actions,
        status: feedback.rating === "helpful" ? "recorded" : "new",
        source: "public_chat",
        updatedAt: now,
      };
      if (!existing.exists) stored.createdAt = now;
      await feedbackRef.set(stored, {merge: true});
      response.status(200).json({
        ok: true,
        responseId: feedback.responseId,
        message: feedback.rating === "helpful" ?
          "Thanks for the feedback!" :
          "Thanks. This will help us improve Wayfinder.",
      });
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      response.status(status).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder could not save that feedback right now.",
      });
    }
  };
}

export function createWayfinderAdminFeedbackHandler(dependencies) {
  const firestore = dependencies.firestore;
  const serverTimestamp = dependencies.serverTimestamp;

  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request: request,
        admin: dependencies.admin,
        firestore: firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      const action = String(request.body && request.body.action || "list")
          .trim().toLowerCase();

      if (action === "list") {
        response.status(200).json({
          ok: true,
          feedback: await listWayfinderFeedback_(firestore),
        });
        return;
      }

      if (action !== "review" && action !== "reopen") {
        throw createWayfinderAccessError(
            400,
            "Choose list, review, or reopen for Wayfinder feedback.",
        );
      }
      const feedbackId = validateFeedbackId_(
          request.body && request.body.feedbackId,
      );
      const feedbackRef = firestore.collection(FEEDBACK_COLLECTION)
          .doc(feedbackId);
      const snapshot = await feedbackRef.get();
      if (!snapshot.exists) {
        throw createWayfinderAccessError(404, "That feedback was not found.");
      }
      const reviewed = action === "review";
      await feedbackRef.set({
        status: reviewed ? "reviewed" : "new",
        reviewedAt: reviewed ? serverTimestamp() : null,
        reviewedByUid: reviewed ? authResult.decodedToken.uid : "",
        reviewedByEmail: reviewed ? authResult.decodedToken.email : "",
        updatedAt: serverTimestamp(),
      }, {merge: true});
      response.status(200).json({
        ok: true,
        message: reviewed ? "Feedback marked as reviewed." :
          "Feedback returned to the review list.",
        feedback: await listWayfinderFeedback_(firestore),
      });
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      response.status(status).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder feedback is unavailable right now.",
      });
    }
  };
}

function validatePublicFeedback_(body) {
  const value = body && typeof body === "object" ? body : {};
  const responseId = validateFeedbackId_(value.responseId);
  const question = getRequiredString_(
      value.question,
      "The feedback question is missing.",
      MAX_QUESTION_LENGTH,
  );
  const answer = getRequiredString_(
      value.answer,
      "The feedback answer is missing.",
      MAX_ANSWER_LENGTH,
  );
  const rating = String(value.rating || "").trim().toLowerCase();
  const reason = String(value.reason || "").trim().toLowerCase();
  const note = String(value.note || "").trim();
  if (!ALLOWED_RATINGS.has(rating)) {
    throw createWayfinderAccessError(400, "Choose a feedback rating.");
  }
  if (!ALLOWED_REASONS.has(reason)) {
    throw createWayfinderAccessError(400, "Choose a valid feedback reason.");
  }
  if (rating === "needs_work" && !reason) {
    throw createWayfinderAccessError(
        400,
        "Choose what Wayfinder should improve.",
    );
  }
  if (note.length > MAX_NOTE_LENGTH) {
    throw createWayfinderAccessError(
        400,
        "Keep feedback notes to 500 characters or fewer.",
    );
  }
  return {
    responseId: responseId,
    question: question,
    answer: answer,
    rating: rating,
    reason: reason,
    note: note,
    links: sanitizeFeedbackLinks_(value.links),
    actions: sanitizeFeedbackActions_(value.actions),
  };
}

function validateFeedbackId_(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) {
    throw createWayfinderAccessError(400, "The feedback response is invalid.");
  }
  return id;
}

function getRequiredString_(value, message, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw createWayfinderAccessError(400, message);
  }
  return text;
}

function sanitizeFeedbackLinks_(links) {
  return (Array.isArray(links) ? links : []).slice(0, 6)
      .map((link) => {
        const label = String(link && link.label || "Learn more").trim()
            .slice(0, 80);
        try {
          const url = new URL(String(link && link.url || ""));
          if (url.protocol !== "https:") return null;
          return {label: label, url: url.toString()};
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
}

function sanitizeFeedbackActions_(actions) {
  return (Array.isArray(actions) ? actions : []).slice(0, 3)
      .map((action) => {
        if (!action || action.type !== "event_details" || !action.event) {
          return null;
        }
        const event = action.event;
        const title = String(event.title || "").trim().slice(0, 160);
        const date = String(event.date || "").trim().slice(0, 80);
        if (!title || !date) return null;
        const registrationUrl = sanitizeFeedbackUrl_(event.registrationUrl);
        return {
          type: "event_details",
          id: String(action.id || "").trim().slice(0, 160),
          label: String(action.label || "View event").trim().slice(0, 80),
          event: {
            title: title,
            date: date,
            time: String(event.time || "").trim().slice(0, 80),
            registrationUrl: registrationUrl,
            registrationLabel: registrationUrl ?
              String(event.registrationLabel || "").trim().slice(0, 80) : "",
          },
        };
      })
      .filter(Boolean);
}

function sanitizeFeedbackUrl_(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ?
      url.toString().slice(0, 1000) : "";
  } catch (error) {
    return "";
  }
}

async function listWayfinderFeedback_(firestore) {
  const snapshot = await firestore.collection(FEEDBACK_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      responseId: String(data.responseId || doc.id),
      question: String(data.question || ""),
      answer: String(data.answer || ""),
      rating: String(data.rating || ""),
      reason: String(data.reason || ""),
      note: String(data.note || ""),
      links: sanitizeFeedbackLinks_(data.links),
      actions: sanitizeFeedbackActions_(data.actions),
      status: String(data.status || "new"),
      createdAt: toIsoString_(data.createdAt),
      updatedAt: toIsoString_(data.updatedAt),
    };
  });
}

function enforceFeedbackRateLimit_(request) {
  const forwarded = String(
      request.headers && request.headers["x-forwarded-for"] || "",
  ).split(",")[0].trim();
  const address = forwarded || String(request.ip || "unknown");
  const key = crypto.createHash("sha256").update(address).digest("hex");
  const now = Date.now();
  const window = feedbackWindowsByClient.get(key);
  if (!window || now - window.startedAt >= PUBLIC_FEEDBACK_WINDOW_MS) {
    feedbackWindowsByClient.set(key, {startedAt: now, count: 1});
    return;
  }
  if (window.count >= PUBLIC_FEEDBACK_LIMIT) {
    throw createWayfinderAccessError(
        429,
        "Please wait a minute before sending more Wayfinder feedback.",
    );
  }
  window.count += 1;
}

function toIsoString_(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
