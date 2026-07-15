import crypto from "node:crypto";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {rankWayfinderKnowledge} from "./retrieval.js";
import {selectRelevantWayfinderNotices} from "./notices.js";
import {applyWayfinderKnowledgeOverrides} from "./knowledge-overrides.js";
import {
  buildWayfinderLiveSourceAnswer,
  buildWayfinderPolicyAnswer,
  buildWayfinderUnknownAnswer,
  classifyWayfinderPolicyQuestion,
} from "./policy.js";

const KNOWLEDGE_COLLECTION = "centralAssistantKnowledgeDraft";
const POLICY_DOC_PATH = "centralAssistantConfigDraft/document-00";
const APPROVED_CONTEXT_CACHE_TTL_MS = 60 * 1000;
const REQUEST_LIMIT = 8;
const PUBLIC_SESSION_LIMIT = 12;
const PUBLIC_IP_LIMIT = 30;
const REQUEST_WINDOW_MS = 60 * 1000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_USER_LENGTH = 500;
const MAX_HISTORY_ASSISTANT_LENGTH = 1800;
const requestWindowsByUid = new Map();
const LIVE_SOURCE_QUESTION_PATTERN = new RegExp(
    "\\b(?:when|next|upcoming|date|time|times|scheduled|schedule|" +
      "register|registration|events?|happening|today|tomorrow|" +
      "weekends?|this\\s+week|this\\s+month|anything\\s+special)\\b",
    "i",
);
const EVENT_SOURCE_TYPE = "planning_center_event";
const GROUP_SOURCE_TYPE = "planning_center_groups";
const GROUP_LIVE_QUESTION_PATTERN = new RegExp(
    "\\b(?:pointe|small)\\s+groups?\\b|" +
    "\\bgroups?\\s+(?:meet|meeting|available|join|directory)\\b",
    "i",
);
const GROUP_DIRECTORY_LINK_PATTERN = new RegExp(
    "\\b(?:directory|list)\\s+(?:of\\s+)?(?:pointe|small)?\\s*groups?\\b|" +
    "\\b(?:where|place|page|website|link|see|view|browse)\\b" +
    ".{0,60}\\b(?:pointe|small)?\\s*groups?\\b",
    "i",
);
const FOLLOW_UP_QUESTION_PATTERN = new RegExp(
    "^(?:and\\b|also\\b|but\\b|yes\\b|no\\b|what about\\b|how about\\b|" +
    "what if\\b|what other\\b|which\\b|any other\\b|anything else\\b|" +
    "tell me more\\b|more details?\\b|what time\\b|when\\b|where\\b|" +
    "how long\\b|how soon\\b|how do i\\b|how can i\\b|can i\\b|can you\\b|" +
    "could i\\b|" +
    "would i\\b|who\\b|why\\b|" +
    "what do (?:the )?(?:kids|children|students|people|they) do\\b|" +
    "what\\s+(?:does|do|is|are|was|were|can|will)\\s+(?:it|that|this|" +
    "they|them|he|she)\\b|" +
    "how\\s+(?:does|do|is|are|can)\\s+(?:it|that|this|they|he|she)\\b|" +
    "(?:does|do|is|are|can|will|should)\\s+(?:it|that|this|they|them|" +
    "he|she)\\b)",
    "i",
);
const WEBSITE_LINK_QUESTION_PATTERN = new RegExp(
    "\\b(?:website|webpage|page|link|directory|where can i find|" +
      "where do i find|show me)\\b",
    "i",
);
const PRAYER_FORM_QUESTION_PATTERN = new RegExp(
    "\\b(?:submit|send|make|add(?:ed)?)\\b.{0,40}\\bprayer\\b|" +
      "\\bprayer\\b.{0,40}\\b(?:request|list|form)\\b",
    "i",
);
const SERVING_QUESTION_PATTERN = new RegExp(
    "\\b(?:volunteer|serving|serve|tech ministry|creative ministry)\\b",
    "i",
);
const PASTORAL_CONVERSATION_PATTERN = new RegExp(
    "\\b(?:griev(?:e|ing)|bereavement|pastoral care|" +
      "(?:speak|talk|meet|connect)\\s+(?:with|to)\\s+(?:a\\s+)?pastor)\\b",
    "i",
);

export function createWayfinderAnswerHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const isAllowedAdminEmail = dependencies.isAllowedAdminEmail;
  const getAdminUserDocPath = dependencies.getAdminUserDocPath;
  const generateAnswer = dependencies.generateAnswer;
  const retrieveLiveContext = dependencies.retrieveLiveContext;
  const getActiveNotices = dependencies.getActiveNotices;
  const getActiveKnowledgeOverrides =
    dependencies.getActiveKnowledgeOverrides;
  const getWebsiteEntries = dependencies.getWebsiteEntries;
  const getFeaturedEventEntries = dependencies.getFeaturedEventEntries;
  const requireAdminAuth = dependencies.requireAdminAuth !== false;
  const requireEnabled = dependencies.requireEnabled;
  const publicResponse = dependencies.publicResponse === true;
  const model = String(dependencies.model || "gemini-3.5-flash");
  const approvedContextCacheTtlMs = Number.isFinite(
      dependencies.approvedContextCacheTtlMs,
  ) ? Math.max(0, dependencies.approvedContextCacheTtlMs) :
    APPROVED_CONTEXT_CACHE_TTL_MS;
  const loadApprovedContext = createApprovedContextLoader_({
    firestore: firestore,
    ttlMs: approvedContextCacheTtlMs,
    now: typeof dependencies.nowMs === "function" ?
      dependencies.nowMs : Date.now,
  });

  return async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const authPromise = requireAdminAuth ?
        authenticateWayfinderAdminRequest({
          request: request,
          admin: admin,
          firestore: firestore,
          isAllowedAdminEmail: isAllowedAdminEmail,
          getAdminUserDocPath: getAdminUserDocPath,
        }) : Promise.resolve(null);
      const enabledPromise = typeof requireEnabled === "function" ?
        requireEnabled() : Promise.resolve(true);
      const [authResult, enabled] = await Promise.all([
        authPromise,
        enabledPromise,
      ]);

      if (requireAdminAuth) {
        enforceRequestRateLimit_(
            "admin:" + authResult.decodedToken.uid,
            REQUEST_LIMIT,
        );
      } else {
        enforcePublicRateLimit_(request);
      }

      if (enabled !== true) {
        throw createWayfinderAccessError(
            403,
            "Wayfinder is not enabled right now.",
        );
      }

      const question = getValidQuestion_(request.body);
      const conversationHistory = getValidConversationHistory_(request.body);
      const retrievalQuestion = buildContextualRetrievalQuestion_(
          question,
          conversationHistory,
      );
      const [
        approvedContext,
        activeNotices,
        activeKnowledgeOverrides,
      ] = await Promise.all([
        loadApprovedContext(),
        typeof getActiveNotices === "function" ? getActiveNotices() : [],
        typeof getActiveKnowledgeOverrides === "function" ?
          getActiveKnowledgeOverrides() : [],
      ]);
      const entries = applyWayfinderKnowledgeOverrides(
          approvedContext.entries,
          activeKnowledgeOverrides,
      );
      const policy = approvedContext.policy;

      if (!policy) {
        throw createWayfinderAccessError(
            503,
            "The approved Wayfinder policy is not available yet.",
        );
      }

      const policyRoute = classifyWayfinderPolicyQuestion(question);
      const policyAnswer = buildWayfinderPolicyAnswer(policyRoute, policy);

      if (policyAnswer) {
        sendWayfinderSuccess_(response, buildPolicyResponse_(
            question,
            entries.length,
            policy,
            policyAnswer,
        ), publicResponse);
        return;
      }

      const noticeEntries = selectRelevantWayfinderNotices(
          retrievalQuestion,
          activeNotices,
      );

      const featuredEventEntries =
        typeof getFeaturedEventEntries === "function" ?
          await getFeaturedEventEntries(retrievalQuestion) : [];
      const rankedEntries = entries.concat(
          Array.isArray(featuredEventEntries) ? featuredEventEntries : [],
      );

      const retrieval = rankWayfinderKnowledge(
          retrievalQuestion,
          rankedEntries,
          {limit: 5},
      );
      const shouldCheckWebsite = typeof getWebsiteEntries === "function" &&
        (retrieval.confidence === "none" || retrieval.confidence === "low" ||
          WEBSITE_LINK_QUESTION_PATTERN.test(retrievalQuestion));
      const websiteEntries = shouldCheckWebsite ?
        await getWebsiteEntries(retrievalQuestion) : [];

      if (retrieval.confidence === "none" ||
        retrieval.confidence === "low") {
        if (noticeEntries.length) {
          await respondWithApprovedEntries_({
            response,
            generateAnswer,
            question,
            conversationHistory,
            policy,
            entries: noticeEntries,
            retrieval,
            entryCount: entries.length,
            model,
            publicResponse,
          });
          return;
        }
        if (websiteEntries.length) {
          const websiteRetrieval = buildWebsiteRetrieval_(
              retrievalQuestion,
              websiteEntries,
          );
          await respondWithApprovedEntries_({
            response,
            generateAnswer,
            question,
            conversationHistory,
            policy,
            entries: websiteEntries,
            retrieval: websiteRetrieval,
            entryCount: entries.length,
            model,
            publicResponse,
          });
          return;
        }
        sendWayfinderSuccess_(response, buildFallbackResponse_(
            question,
            entries.length,
            retrieval,
            policy,
            buildWayfinderUnknownAnswer(policy),
        ), publicResponse);
        return;
      }

      const sourceTypes = getRequiredLiveSourceTypes_(
          retrievalQuestion,
          retrieval.results,
      ).filter((sourceType) => !noticeEntries.some((entry) => {
        return arrayOfStrings_(entry.overrideTargets).includes(
            sourceType === EVENT_SOURCE_TYPE ?
              "planning_center_events" : "planning_center_groups",
        );
      }));
      let liveEntries = [];
      if (sourceTypes.length) {
        if (typeof retrieveLiveContext !== "function") {
          sendWayfinderSuccess_(response, buildFallbackResponse_(
              question,
              entries.length,
              retrieval,
              policy,
              buildWayfinderLiveSourceAnswer(sourceTypes),
          ), publicResponse);
          return;
        }

        const liveContext = await retrieveLiveContext({
          question: retrievalQuestion,
          sourceTypes: sourceTypes,
        });
        const unavailable = sourceTypes.some((sourceType) => {
          return !liveContext || !liveContext.statuses ||
            liveContext.statuses[sourceType] === "unavailable";
        });
        if (unavailable) {
          sendWayfinderSuccess_(response, buildFallbackResponse_(
              question,
              entries.length,
              retrieval,
              policy,
              buildWayfinderLiveSourceAnswer(sourceTypes),
          ), publicResponse);
          return;
        }
        liveEntries = getSafeLiveEntries_(liveContext && liveContext.entries);
      }

      const selectedEntries = deduplicateEntries_([
        ...noticeEntries,
        ...liveEntries,
        ...featuredEventEntries,
        ...selectRetrievedEntries_(
            rankedEntries,
            retrieval.results,
        ),
        ...websiteEntries,
      ]).slice(0, 5);
      if (GROUP_DIRECTORY_LINK_PATTERN.test(retrievalQuestion)) {
        const directoryEntry = entries.find((entry) => {
          return entry.id === "groups-live-directory";
        });
        if (directoryEntry && !selectedEntries.some((entry) => {
          return entry.id === directoryEntry.id;
        })) {
          if (selectedEntries.length >= 5) selectedEntries.pop();
          selectedEntries.push(directoryEntry);
        }
      }
      if (websiteEntries.length && !selectedEntries.some((entry) => {
        return entry.sourceType === "website_page";
      })) {
        if (selectedEntries.length >= 5) {
          selectedEntries.pop();
        }
        selectedEntries.push(websiteEntries[0]);
      }
      await respondWithApprovedEntries_({
        response,
        generateAnswer,
        question,
        conversationHistory,
        policy,
        entries: selectedEntries,
        retrieval,
        entryCount: entries.length,
        model,
        publicResponse,
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
          publicResponse ?
            "Wayfinder could not answer safely right now. Please try again." :
            "Gemini could not generate a verified Wayfinder answer. " +
              "The approved retrieval results are still available in the lab.",
      });
    }
  };
}

function createApprovedContextLoader_(options) {
  const firestore = options.firestore;
  const ttlMs = options.ttlMs;
  const now = options.now;
  let cached = null;
  let pending = null;

  return async () => {
    const currentTime = now();
    if (cached && currentTime - cached.loadedAt < ttlMs) {
      return cached.value;
    }
    if (pending) return pending;

    pending = Promise.all([
      firestore.collection(KNOWLEDGE_COLLECTION).limit(250).get(),
      firestore.doc(POLICY_DOC_PATH).get(),
    ]).then(([knowledgeSnapshot, policySnapshot]) => {
      const value = {
        entries: getApprovedDraftEntries_(knowledgeSnapshot),
        policy: getApprovedDraftPolicy_(policySnapshot),
      };
      cached = {value: value, loadedAt: now()};
      return value;
    }).finally(() => {
      pending = null;
    });

    return pending;
  };
}

function buildWebsiteRetrieval_(question, websiteEntries) {
  return {
    question: question,
    confidence: "medium",
    results: websiteEntries.map((entry) => ({
      id: String(entry.id || ""),
      topic: String(entry.topic || "website_content"),
      title: String(entry.title || "CrossPointe website"),
      responseMode: String(entry.responseMode || "guided"),
      score: Number(entry.websiteScore) || 6,
      matchedTerms: arrayOfStrings_(entry.matchedTerms),
      requiredFacts: arrayOfStrings_(entry.requiredFacts),
      allowedPublicFacts: arrayOfStrings_(entry.allowedPublicFacts),
      requiredActions: arrayOfStrings_(entry.requiredActions),
      approvedActions: Array.isArray(entry.approvedActions) ?
        entry.approvedActions : [],
      approvedLinks: Array.isArray(entry.approvedLinks) ?
        entry.approvedLinks : [],
      prohibitedClaims: arrayOfStrings_(entry.prohibitedClaims),
      prohibitedInformation: arrayOfStrings_(entry.prohibitedInformation),
      requiredSourceType: "",
      sourceBundleId: "website-index",
    })),
  };
}

async function respondWithApprovedEntries_(options) {
  let generated = null;
  if (typeof options.generateAnswer === "function") {
    try {
      generated = await options.generateAnswer({
        question: options.question,
        conversationHistory: options.conversationHistory,
        policy: options.policy,
        entries: options.entries,
      });
    } catch (error) {
      console.warn("Wayfinder used its approved knowledge fallback.", {
        code: String(error && error.code || "model_unavailable"),
        reason: String(error && error.safeReason || ""),
      });
    }
  }

  if (!generated) {
    sendWayfinderSuccess_(options.response, buildKnowledgeResponse_(
        options.question,
        options.entryCount,
        options.retrieval,
        options.entries,
        options.conversationHistory,
    ), options.publicResponse);
    return;
  }

  sendWayfinderSuccess_(options.response, {
    ok: true,
    prototype: true,
    mode: "gemini-grounded",
    modelUsed: true,
    model: options.model,
    question: options.question,
    answer: generated.answer,
    followUpQuestion: generated.followUpQuestion,
    shouldContactChurch: generated.shouldContactChurch,
    communicationPosture: String(
        generated.communicationPosture || "universal",
    ),
    postureConfidence: String(generated.postureConfidence || "none"),
    conversationHistory: options.conversationHistory,
    confidence: options.entries.some((entry) => {
      return String(entry.id || "").startsWith("active-notice-");
    }) ? "high" : options.retrieval.confidence,
    knowledgeEntryCount: options.entryCount,
    sourceCards: buildAnswerSourceCards_(
        options.entries,
        generated.sourceEntryIds,
        options.question,
        options.conversationHistory,
        options.publicResponse,
    ),
    results: options.retrieval.results,
    notice: "Gemini received only the selected approved Wayfinder context.",
  }, options.publicResponse);
}

function buildAnswerSourceCards_(
    entries,
    sourceEntryIds,
    question,
    history,
    publicResponse,
) {
  const cards = buildEntrySourceCards_(entries, sourceEntryIds);
  const context = [
    String(question || ""),
    ...(Array.isArray(history) ? history : []).map((message) => {
      return String(message && message.content || "");
    }),
  ].join(" ");
  const existingIds = new Set(cards.map((card) => card.id));
  if (GROUP_DIRECTORY_LINK_PATTERN.test(context)) {
    entries.forEach((entry) => {
      if (existingIds.has(entry.id)) return;
      const links = Array.isArray(entry.approvedLinks) ?
        entry.approvedLinks : [];
      if (!links.some((link) => {
        return /crosspointe\.tv\/small-groups/i.test(
            String(link && link.url || ""),
        );
      })) return;
      cards.push(buildEntrySourceCard_(entry));
      existingIds.add(entry.id);
    });
  }
  if (!publicResponse) return cards;
  const requiredLinkRules = [
    {
      intent: PRAYER_FORM_QUESTION_PATTERN,
      link: /\/people\/forms\/340884/i,
    },
    {
      intent: SERVING_QUESTION_PATTERN,
      link: /\/people\/forms\/324465/i,
    },
    {
      intent: /\b(?:watch|livestream|live stream|streaming|church online)\b/i,
      link: /crosspointe\.tv\/church-online/i,
    },
  ];
  requiredLinkRules.filter((rule) => rule.intent.test(context))
      .forEach((rule) => {
        entries.forEach((entry) => {
          if (existingIds.has(entry.id)) return;
          const links = Array.isArray(entry.approvedLinks) ?
            entry.approvedLinks : [];
          if (!links.some((link) => rule.link.test(String(link.url || "")))) {
            return;
          }
          cards.push(buildEntrySourceCard_(entry));
          existingIds.add(entry.id);
        });
      });
  return cards;
}

function sendWayfinderSuccess_(response, payload, publicResponse) {
  if (!publicResponse) {
    response.status(200).json(payload);
    return;
  }
  response.status(200).json({
    ok: payload && payload.ok === true,
    responseId: crypto.randomUUID(),
    answer: normalizePublicAnswer_(payload && payload.answer),
    followUpQuestion: "",
    shouldContactChurch: payload && payload.shouldContactChurch === true,
    links: buildPublicActionLinks_(
        payload && payload.sourceCards,
        payload && payload.question,
        payload && payload.conversationHistory,
    ),
  });
}

function normalizePublicAnswer_(value) {
  return String(value || "")
      .replace(
          /([a-z0-9._%+-]+@[a-z0-9.-]+)\.\s+([a-z]{2,})\b/gi,
          "$1.$2",
      );
}

function buildPublicActionLinks_(sourceCards, question, history) {
  const links = [];
  const seenUrls = new Set();
  (Array.isArray(sourceCards) ? sourceCards : []).forEach((card) => {
    const cardLinks = card && Array.isArray(card.links) ? card.links : [];
    cardLinks.forEach((link) => {
      const label = String(link && link.label || "Learn more").trim()
          .slice(0, 80);
      const url = getSafePublicActionUrl_(link && link.url);
      if (!label || !url || seenUrls.has(url) || links.length >= 6) return;
      seenUrls.add(url);
      links.push({label, url});
    });
  });
  return selectQuestionSpecificLinks_(links, question, history);
}

function selectQuestionSpecificLinks_(links, question, history) {
  const value = String(question || "");
  const priorText = (Array.isArray(history) ? history : [])
      .map((message) => String(message && message.content || ""))
      .join(" ");
  const context = value + " " + priorText;
  const platformIntents = [
    {question: /\binstagram\b|@crosspointe\.tv/i, link: /instagram/i},
    {question: /\btik\s*tok\b|@crosspointenorman/i, link: /tiktok/i},
    {question: /\byou\s*tube\b/i, link: /youtube/i},
    {question: /\bface\s*book\b/i, link: /facebook/i},
    {question: /\bspotify\b/i, link: /spotify/i},
    {question: /\bapple podcasts?\b/i, link: /apple/i},
    {question: /\bamazon (?:music|podcasts?)\b/i, link: /amazon/i},
  ].filter((intent) => intent.question.test(value));

  let selectedLinks = links;
  if (/\b(?:giving|donation)\s+(?:receipt|statement)\b/i.test(value) ||
    /\bannual\s+giving\s+statement\b/i.test(value)) {
    return [];
  }
  if (/\bfuneral\b/i.test(value) &&
    !/\b(?:link|page|profile|staff directory)\b/i.test(value)) {
    selectedLinks = selectedLinks.filter((link) => {
      return !/crosspointe\.tv\/(?:staff|contributor\/)/i.test(link.url);
    });
  }
  if (/\bcare center\b|\bfood pantry\b|\bclothes closet\b/i.test(context)) {
    selectedLinks = selectedLinks.filter((link) => {
      return !/forms\.gle\/13UrumiVUXEZCLgj9|crosspointe\.tv\/give/i
          .test(link.url);
    });
  }
  if (/\bkingdom kids\b|\bchildren(?:'s)? ministry\b/i.test(context)) {
    selectedLinks = selectedLinks.filter((link) => {
      return !/forms\.gle\/13UrumiVUXEZCLgj9|crosspointe\.tv\/give/i
          .test(link.url);
    });
  }
  if (/\bCARS\b|\bcar\s+repair\b|\bvehicle\s+repair\b/i.test(context)) {
    const asksAboutCosts = /\b(?:cost|pay|payment|parts|donat|give)\w*\b/i
        .test(value);
    if (!asksAboutCosts) {
      selectedLinks = selectedLinks.filter((link) => {
        return !/crosspointe\.tv\/give/i.test(link.url);
      });
    }
  }
  if (PASTORAL_CONVERSATION_PATTERN.test(context) &&
    !/\b(?:link|page|profile|contact form)\b/i.test(value)) {
    selectedLinks = selectedLinks.filter((link) => {
      return !/crosspointe\.tv\/(?:staff|contributor\/)/i.test(link.url);
    });
  }
  if (platformIntents.length) {
    selectedLinks = links.filter((link) => platformIntents.some((intent) => {
      return intent.link.test(link.label) || intent.link.test(link.url);
    }));
  } else if (/\b(?:watch|livestream|live stream|streaming|church online)\b/i
      .test(value)) {
    const churchOnline = links.find((link) => {
      return /crosspointe\.tv\/church-online/i.test(link.url);
    });
    if (churchOnline) return [churchOnline];
  } else if (PRAYER_FORM_QUESTION_PATTERN.test(context)) {
    const prayerForm = links.find((link) => {
      return /\/people\/forms\/340884/i.test(link.url);
    });
    if (prayerForm) return [prayerForm];
  } else if (SERVING_QUESTION_PATTERN.test(context)) {
    const nextStepsForm = links.find((link) => {
      return /\/people\/forms\/324465/i.test(link.url);
    });
    if (nextStepsForm) return [nextStepsForm];
  }

  if (/\b(?:other|else)\b/i.test(value)) {
    const priorIntents = [
      {question: /\binstagram\b|@crosspointe\.tv/i, link: /instagram/i},
      {question: /\btik\s*tok\b|@crosspointenorman/i, link: /tiktok/i},
      {question: /\byou\s*tube\b/i, link: /youtube/i},
      {question: /\bface\s*book\b/i, link: /facebook/i},
      {question: /\bspotify\b/i, link: /spotify/i},
      {question: /\bapple podcasts?\b/i, link: /apple/i},
      {question: /\bamazon (?:music|podcasts?)\b/i, link: /amazon/i},
    ].filter((intent) => intent.question.test(priorText));
    if (priorIntents.length) {
      selectedLinks = selectedLinks.filter((link) => {
        return !priorIntents.some((intent) => {
          return intent.link.test(link.label) || intent.link.test(link.url);
        });
      });
    }
  }

  return selectedLinks;
}

function getSafePublicActionUrl_(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function buildKnowledgeResponse_(
    question,
    entryCount,
    retrieval,
    entries,
    conversationHistory = [],
) {
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
    conversationHistory: conversationHistory,
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
    throw createWayfinderAccessError(400, "Enter a question for Wayfinder.");
  }

  if (question.length > 500) {
    throw createWayfinderAccessError(
        400,
        "Questions must be 500 characters or fewer.",
    );
  }

  return question;
}

function getValidConversationHistory_(body) {
  const value = body && typeof body === "object" ? body : {};
  if (value.history === undefined) return [];
  if (!Array.isArray(value.history) ||
    value.history.length > MAX_HISTORY_MESSAGES) {
    throw createWayfinderAccessError(
        400,
        "Wayfinder conversation history is invalid.",
    );
  }

  return value.history.map((message) => {
    const item = message && typeof message === "object" ? message : {};
    const role = String(item.role || "").trim();
    const content = String(item.content || "").replace(/\s+/g, " ").trim();
    const maxLength = role === "user" ?
      MAX_HISTORY_USER_LENGTH : MAX_HISTORY_ASSISTANT_LENGTH;
    if ((role !== "user" && role !== "assistant") ||
      !content || content.length > maxLength) {
      throw createWayfinderAccessError(
          400,
          "Wayfinder conversation history is invalid.",
      );
    }
    return {role, content};
  });
}

function buildContextualRetrievalQuestion_(question, history) {
  const currentQuestion = String(question || "").trim();
  const recentContext = (Array.isArray(history) ? history : [])
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.content)
      .filter(Boolean);
  if (!recentContext.length ||
    isStandaloneFollowUpQuestion_(currentQuestion) ||
    !FOLLOW_UP_QUESTION_PATTERN.test(currentQuestion)) {
    return currentQuestion;
  }
  return recentContext.concat(currentQuestion).join("\n");
}

function isStandaloneFollowUpQuestion_(question) {
  const value = String(question || "").trim();
  if (/^who\b/i.test(value) &&
    !/\b(?:it|that|this|them|they|he|she)\b/i.test(value)) {
    return true;
  }
  const whatAbout = value.match(/^what about\s+(.+)$/i);
  if (!whatAbout) return false;
  if (/^for\b/i.test(whatAbout[1].trim())) return false;
  return !/^(?:it|that|this|them|they|him|her)(?:\b|[?!.])/i
      .test(whatAbout[1].trim());
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

function enforcePublicRateLimit_(request) {
  const sessionId = String(
      request.headers && request.headers["x-wayfinder-session"] || "",
  ).trim();
  const safeSessionId = /^[A-Za-z0-9_-]{8,100}$/.test(sessionId) ?
    sessionId : "missing-session";
  const ipAddress = String(request.ip || request.socket &&
    request.socket.remoteAddress || "unknown").trim();
  enforceRequestRateLimit_(
      "public-session:" + safeSessionId,
      PUBLIC_SESSION_LIMIT,
  );
  enforceRequestRateLimit_("public-ip:" + ipAddress, PUBLIC_IP_LIMIT);
}

function enforceRequestRateLimit_(keyValue, limit) {
  const key = String(keyValue || "").trim();
  const now = Date.now();
  const current = requestWindowsByUid.get(key);

  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindowsByUid.set(key, {startedAt: now, count: 1});
    return;
  }

  if (current.count >= limit) {
    throw createWayfinderAccessError(
        429,
        "Please wait a minute before asking Wayfinder more questions.",
    );
  }

  current.count += 1;
}

function selectRetrievedEntries_(entries, results) {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const rankedResults = Array.isArray(results) ? results : [];
  const first = rankedResults[0];
  const second = rankedResults[1];
  const hasDecisiveMatch = first && Number(first.score) >= 24 &&
    (!second || Number(first.score) - Number(second.score) >= 5);
  return rankedResults
      .slice(0, hasDecisiveMatch ? 1 : 5)
      .map((result) => entriesById.get(result.id))
      .filter(Boolean);
}

function deduplicateEntries_(entries) {
  const seen = new Set();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const id = String(entry && entry.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getRequiredLiveSourceTypes_(question, results) {
  const topResults = (Array.isArray(results) ? results : []).slice(0, 3);
  const sourceTypes = new Set();
  const hasLiveEventEntry = topResults
      .slice(0, 3)
      .some((result) => {
        return String(result.requiredSourceType || "") ===
          EVENT_SOURCE_TYPE ||
          String(result.requiredSourceTypeForDates || "") ===
          EVENT_SOURCE_TYPE;
      });
  const asksForCurrentDetails = LIVE_SOURCE_QUESTION_PATTERN.test(
      String(question || ""),
  );
  if (hasLiveEventEntry && asksForCurrentDetails) {
    sourceTypes.add(EVENT_SOURCE_TYPE);
  }
  const asksForGroupDirectoryLink = GROUP_DIRECTORY_LINK_PATTERN.test(
      String(question || ""),
  );
  if (!asksForGroupDirectoryLink &&
    GROUP_LIVE_QUESTION_PATTERN.test(String(question || "")) &&
    topResults.some((result) => {
      return String(result.requiredSourceType || "") === GROUP_SOURCE_TYPE;
    })) {
    sourceTypes.add(GROUP_SOURCE_TYPE);
  }
  return [...sourceTypes];
}

function getSafeLiveEntries_(value) {
  return (Array.isArray(value) ? value : []).filter((entry) => {
    const id = String(entry && entry.id || "");
    return id.startsWith("live-event-") || id.startsWith("live-group-") ||
      id === "live-events-no-match" || id === "live-groups-no-match";
  });
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
