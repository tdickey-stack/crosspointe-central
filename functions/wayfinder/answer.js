import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {rankWayfinderKnowledge} from "./retrieval.js";
import {
  buildWayfinderLiveSourceAnswer,
  buildWayfinderPolicyAnswer,
  buildWayfinderUnknownAnswer,
  classifyWayfinderPolicyQuestion,
} from "./policy.js";

const KNOWLEDGE_COLLECTION = "centralAssistantKnowledgeDraft";
const POLICY_DOC_PATH = "centralAssistantConfigDraft/document-00";
const REQUEST_LIMIT = 8;
const REQUEST_WINDOW_MS = 60 * 1000;
const requestWindowsByUid = new Map();
const LIVE_SOURCE_QUESTION_PATTERN = new RegExp(
    "\\b(?:when|next|upcoming|date|time|times|scheduled|schedule|" +
      "register|registration|events?)\\b",
    "i",
);

export function createWayfinderAnswerHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const isAllowedAdminEmail = dependencies.isAllowedAdminEmail;
  const getAdminUserDocPath = dependencies.getAdminUserDocPath;
  const generateAnswer = dependencies.generateAnswer;
  const model = String(dependencies.model || "gemini-3.5-flash");

  return async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request: request,
        admin: admin,
        firestore: firestore,
        isAllowedAdminEmail: isAllowedAdminEmail,
        getAdminUserDocPath: getAdminUserDocPath,
      });
      enforcePrototypeRateLimit_(authResult.decodedToken.uid);

      const question = getValidQuestion_(request.body);
      const [knowledgeSnapshot, policySnapshot] = await Promise.all([
        firestore.collection(KNOWLEDGE_COLLECTION).limit(250).get(),
        firestore.doc(POLICY_DOC_PATH).get(),
      ]);
      const entries = getApprovedDraftEntries_(knowledgeSnapshot);
      const policy = getApprovedDraftPolicy_(policySnapshot);

      if (!policy) {
        throw createWayfinderAccessError(
            503,
            "The approved Wayfinder policy is not available yet.",
        );
      }

      const policyRoute = classifyWayfinderPolicyQuestion(question);
      const policyAnswer = buildWayfinderPolicyAnswer(policyRoute, policy);

      if (policyAnswer) {
        response.status(200).json(buildPolicyResponse_(
            question,
            entries.length,
            policy,
            policyAnswer,
        ));
        return;
      }

      const retrieval = rankWayfinderKnowledge(question, entries, {limit: 5});

      if (retrieval.confidence === "none" ||
        retrieval.confidence === "low") {
        response.status(200).json(buildFallbackResponse_(
            question,
            entries.length,
            retrieval,
            policy,
            buildWayfinderUnknownAnswer(policy),
        ));
        return;
      }

      if (questionRequiresLiveSource_(question, retrieval.results)) {
        response.status(200).json(buildFallbackResponse_(
            question,
            entries.length,
            retrieval,
            policy,
            buildWayfinderLiveSourceAnswer(),
        ));
        return;
      }

      const selectedEntries = selectRetrievedEntries_(
          entries,
          retrieval.results,
      );
      let generated = null;

      if (typeof generateAnswer === "function") {
        try {
          generated = await generateAnswer({
            question: question,
            policy: policy,
            entries: selectedEntries,
          });
        } catch (error) {
          console.warn("Wayfinder used its approved knowledge fallback.", {
            code: String(error && error.code || "model_unavailable"),
            reason: String(error && error.safeReason || ""),
          });
        }
      }

      if (!generated) {
        response.status(200).json(buildKnowledgeResponse_(
            question,
            entries.length,
            retrieval,
            selectedEntries,
        ));
        return;
      }
      const sourceCards = buildEntrySourceCards_(
          selectedEntries,
          generated.sourceEntryIds,
      );

      response.status(200).json({
        ok: true,
        prototype: true,
        mode: "gemini-grounded",
        modelUsed: true,
        model: model,
        question: question,
        answer: generated.answer,
        followUpQuestion: generated.followUpQuestion,
        shouldContactChurch: generated.shouldContactChurch,
        confidence: retrieval.confidence,
        knowledgeEntryCount: entries.length,
        sourceCards: sourceCards,
        results: retrieval.results,
        notice: "Gemini received only the selected approved Wayfinder context.",
      });
    } catch (error) {
      const status = Number(error && error.statusCode) ||
        (error && error.code === "wayfinder-model-validation" ? 502 : 503);

      if (!error || !error.statusCode) {
        console.error("Wayfinder Gemini request failed.", {
          code: String(error && error.code || "unknown"),
          name: String(error && error.name || "Error"),
          status: status,
        });
      }

      response.status(status).json({
        error: error && error.statusCode ?
          String(error.message || "Wayfinder access denied.") :
          "Gemini could not generate a verified Wayfinder answer. " +
            "The approved retrieval results are still available in the lab.",
      });
    }
  };
}

function buildKnowledgeResponse_(question, entryCount, retrieval, entries) {
  const primaryEntry = Array.isArray(entries) ? entries[0] : null;
  const facts = primaryEntry ? [
    ...arrayOfStrings_(primaryEntry.requiredFacts),
    ...arrayOfStrings_(primaryEntry.allowedPublicFacts),
  ] : [];

  return {
    ok: true,
    prototype: true,
    mode: "knowledge-fallback",
    modelUsed: false,
    model: "",
    question: question,
    answer: facts.join(" ") ||
      "I don't have enough approved information to answer that yet.",
    followUpQuestion: "",
    shouldContactChurch: false,
    confidence: retrieval.confidence,
    knowledgeEntryCount: entryCount,
    sourceCards: primaryEntry ? [buildEntrySourceCard_(primaryEntry)] : [],
    results: retrieval.results,
    notice: "Gemini is not configured, so this preview used the top approved " +
      "knowledge entry without AI rewriting.",
  };
}

function getValidQuestion_(body) {
  const value = body && typeof body === "object" ? body : {};
  const question = String(value.question || "").trim();

  if (!question) {
    throw createWayfinderAccessError(400, "Enter a question to test.");
  }

  if (question.length > 500) {
    throw createWayfinderAccessError(
        400,
        "Prototype questions must be 500 characters or fewer.",
    );
  }

  return question;
}

function getApprovedDraftEntries_(snapshot) {
  return snapshot.docs
      .map((document) => document.data())
      .filter((entry) => {
        return entry &&
          entry.approvalStatus === "approved" &&
          entry.publicationState === "draft";
      });
}

function getApprovedDraftPolicy_(snapshot) {
  if (!snapshot.exists) return null;
  const policy = snapshot.data();
  if (!policy || policy.approvalStatus !== "approved" ||
    policy.publicationState !== "draft") {
    return null;
  }
  return policy;
}

function enforcePrototypeRateLimit_(uid) {
  const key = String(uid || "").trim();
  const now = Date.now();
  const current = requestWindowsByUid.get(key);

  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindowsByUid.set(key, {startedAt: now, count: 1});
    return;
  }

  if (current.count >= REQUEST_LIMIT) {
    throw createWayfinderAccessError(
        429,
        "Please wait a minute before running more Gemini tests.",
    );
  }

  current.count += 1;
}

function selectRetrievedEntries_(entries, results) {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return (Array.isArray(results) ? results : [])
      .map((result) => entriesById.get(result.id))
      .filter(Boolean)
      .slice(0, 5);
}

function questionRequiresLiveSource_(question, results) {
  const hasLiveEntry = (Array.isArray(results) ? results : [])
      .slice(0, 3)
      .some((result) => {
        return String(result.requiredSourceType || "") ===
          "planning_center_event";
      });
  const asksForCurrentDetails = LIVE_SOURCE_QUESTION_PATTERN.test(
      String(question || ""),
  );
  return hasLiveEntry && asksForCurrentDetails;
}

function buildPolicyResponse_(question, entryCount, policy, policyAnswer) {
  return {
    ok: true,
    prototype: true,
    mode: "policy-answer",
    modelUsed: false,
    model: "",
    question: question,
    answer: policyAnswer.answer,
    followUpQuestion: "",
    shouldContactChurch: policyAnswer.route === "prayer" ||
      policyAnswer.route === "pastoral_care",
    confidence: "high",
    knowledgeEntryCount: entryCount,
    sourceCards: [buildPolicySourceCard_(policy, policyAnswer.links)],
    results: [],
    policyRoute: policyAnswer.route,
    notice: "A fixed approved policy response was used without Gemini.",
  };
}

function buildFallbackResponse_(
    question,
    entryCount,
    retrieval,
    policy,
    fallback,
) {
  return {
    ok: true,
    prototype: true,
    mode: fallback.route,
    modelUsed: false,
    model: "",
    question: question,
    answer: fallback.answer,
    followUpQuestion: "",
    shouldContactChurch: fallback.route === "unknown",
    confidence: retrieval.confidence,
    knowledgeEntryCount: entryCount,
    sourceCards: [buildPolicySourceCard_(policy, fallback.links)],
    results: retrieval.results,
    policyRoute: fallback.route,
    notice: fallback.route === "live_source_required" ?
      "Gemini was intentionally skipped until live Planning Center " +
        "data is available." :
      "Gemini was intentionally skipped because the approved match " +
        "was insufficient.",
  };
}

function buildPolicySourceCard_(policy, links) {
  return {
    id: String(policy.documentId || "document-00"),
    title: String(policy.title || "Wayfinder Rules and Official Contacts"),
    topic: "assistant_policy",
    links: Array.isArray(links) ? links : [],
  };
}

function buildEntrySourceCards_(entries, sourceEntryIds) {
  const allowedIds = new Set(
      (Array.isArray(sourceEntryIds) ? sourceEntryIds : [])
          .map((id) => String(id || "")),
  );
  return entries.filter((entry) => allowedIds.has(entry.id))
      .map(buildEntrySourceCard_);
}

function buildEntrySourceCard_(entry) {
  return {
    id: String(entry.id || ""),
    title: String(entry.title || "Approved Wayfinder information"),
    topic: String(entry.topic || "knowledge"),
    links: Array.isArray(entry.approvedLinks) ? entry.approvedLinks : [],
    actions: Array.isArray(entry.approvedActions) ?
      entry.approvedActions : [],
  };
}

function arrayOfStrings_(value) {
  return (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
}
