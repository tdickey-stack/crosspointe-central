import {GoogleGenAI} from "@google/genai";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {rankWayfinderKnowledge} from "./retrieval.js";

const MODE_COLLECTION = "centralAssistantAdminModes";
const KNOWLEDGE_COLLECTION = "centralAssistantKnowledgeDraft";
const DRAFT_COLLECTION = "centralAssistantKnowledgeChangeDrafts";
const OVERRIDE_COLLECTION = "centralAssistantKnowledgeOverrides";
const HISTORY_COLLECTION = "centralAssistantKnowledgeRevisionHistory";
const DRAFT_DURATION_MS = 20 * 60 * 1000;
const EDIT_PERMISSIONS = new Set(["edit", "approve", "admin"]);

const LINK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {type: "string"},
    url: {type: "string"},
  },
  required: ["label", "url"],
};

const CHANGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    clarificationNeeded: {type: "boolean"},
    clarificationQuestion: {type: "string"},
    targetEntryId: {type: "string"},
    changeSummary: {type: "string"},
    title: {type: "string"},
    requiredFacts: {type: "array", items: {type: "string"}, maxItems: 30},
    allowedPublicFacts: {
      type: "array",
      items: {type: "string"},
      maxItems: 30,
    },
    requiredActions: {
      type: "array",
      items: {type: "string"},
      maxItems: 20,
    },
    prohibitedClaims: {
      type: "array",
      items: {type: "string"},
      maxItems: 30,
    },
    prohibitedInformation: {
      type: "array",
      items: {type: "string"},
      maxItems: 30,
    },
    approvedLinks: {type: "array", items: LINK_SCHEMA, maxItems: 12},
  },
  required: [
    "clarificationNeeded",
    "clarificationQuestion",
    "targetEntryId",
    "changeSummary",
    "title",
    "requiredFacts",
    "allowedPublicFacts",
    "requiredActions",
    "prohibitedClaims",
    "prohibitedInformation",
    "approvedLinks",
  ],
};

export function createWayfinderKnowledgeChangeGenerator(options = {}) {
  const model = String(options.model || "gemini-3.5-flash").trim();
  const ClientClass = options.GoogleGenAIClass || GoogleGenAI;

  return async ({instruction, candidates}) => {
    const apiKey = String(
        typeof options.getApiKey === "function" ?
          options.getApiKey() : options.apiKey || "",
    ).trim();
    if (!apiKey && !options.client) {
      const error = new Error("Gemini knowledge editing is not configured.");
      error.code = "wayfinder-knowledge-gemini-not-configured";
      throw error;
    }
    const safeCandidates = sanitizeCandidateEntries_(candidates);
    if (!safeCandidates.length) {
      throw createWayfinderAccessError(
          409,
          "I could not identify an existing knowledge entry to update.",
      );
    }
    const client = options.client || new ClientClass({apiKey});
    const systemInstruction = [
      "Draft one permanent update to an existing approved Wayfinder entry.",
      "Use only the administrator instruction and supplied candidate entries.",
      "Select exactly one candidate targetEntryId.",
      "Return complete replacement values for every editable field.",
      "Preserve every existing value the administrator did not ask to change.",
      "Do not add facts, reasons, contacts, links, policies, or details.",
      "Do not change sample questions, keywords, routing, live source rules, " +
        "response mode, or source metadata.",
      "If the request is ambiguous or does not match a candidate, request " +
        "one short clarification instead of guessing.",
      "Return only JSON matching the schema.",
    ].join("\n");
    const response = await client.models.generateContent({
      model,
      contents: JSON.stringify({
        administratorInstruction: String(instruction || "").trim(),
        candidateEntries: safeCandidates,
      }),
      config: {
        systemInstruction,
        temperature: 0.05,
        candidateCount: 1,
        maxOutputTokens: 4096,
        thinkingConfig: {
          thinkingLevel: "MINIMAL",
          includeThoughts: false,
        },
        responseMimeType: "application/json",
        responseJsonSchema: CHANGE_SCHEMA,
      },
    });
    return validateGeneratedChange_(response && response.text, safeCandidates);
  };
}

export function createWayfinderKnowledgeChangeHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const generateChange = dependencies.generateChange;
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
      requireEditPermission_(authResult.permission);
      const action = String(request.body && request.body.action || "")
          .trim().toLowerCase();
      const current = now();
      await requireActiveMode_(
          firestore,
          authResult.decodedToken.uid,
          current,
      );
      let result;

      if (action === "draft") {
        result = await createKnowledgeDraft_({
          firestore,
          decodedToken: authResult.decodedToken,
          instruction: request.body && request.body.instruction,
          generateChange,
          current,
        });
      } else if (action === "publish") {
        requireAdminPermission_(authResult.permission);
        result = await publishKnowledgeDraft_({
          firestore,
          decodedToken: authResult.decodedToken,
          draftId: request.body && request.body.draftId,
          current,
        });
      } else if (action === "cancel") {
        result = await cancelKnowledgeDraft_({
          firestore,
          decodedToken: authResult.decodedToken,
          draftId: request.body && request.body.draftId,
          current,
        });
      } else if (action === "list") {
        result = await listKnowledgeOverrides_(firestore);
      } else if (action === "deactivate") {
        requireAdminPermission_(authResult.permission);
        result = await deactivateKnowledgeOverride_({
          firestore,
          decodedToken: authResult.decodedToken,
          entryId: request.body && request.body.entryId,
          current,
        });
      } else {
        throw createWayfinderAccessError(400, "Unsupported knowledge action.");
      }

      response.status(200).json({ok: true, ...result});
    } catch (error) {
      const status = Number(error && error.statusCode) || 503;
      if (!error || !error.statusCode) {
        console.error("Wayfinder knowledge change failed.", {
          code: String(error && error.code || "unknown"),
          name: String(error && error.name || "Error"),
        });
      }
      response.status(status).json({
        error: error && error.statusCode ?
          String(error.message || "Knowledge access denied.") :
          "Wayfinder could not safely prepare that permanent change.",
      });
    }
  };
}

export async function getActiveWayfinderKnowledgeOverrides(firestore) {
  const snapshot = await firestore.collection(OVERRIDE_COLLECTION)
      .where("active", "==", true)
      .limit(250)
      .get();
  return snapshot.docs.map((document) => {
    const data = document.data() || {};
    return {
      id: document.id,
      entry: data.entry && typeof data.entry === "object" ? data.entry : null,
      revision: Number(data.revision) || 0,
    };
  }).filter((item) => item.entry && item.entry.id === item.id);
}

export function applyWayfinderKnowledgeOverrides(entries, overrides) {
  const overrideMap = new Map(
      (Array.isArray(overrides) ? overrides : [])
          .filter((item) => item && item.entry && item.id)
          .map((item) => [String(item.id), item]),
  );
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const override = overrideMap.get(String(entry && entry.id || ""));
    if (!override) return entry;
    return {
      ...entry,
      ...override.entry,
      approvalStatus: "approved",
      publicationState: "draft",
      permanentOverrideRevision: override.revision,
    };
  });
}

async function createKnowledgeDraft_(options) {
  const instruction = String(options.instruction || "").trim();
  if (!instruction || instruction.length > 800) {
    throw createWayfinderAccessError(
        400,
        "Describe the permanent update in 800 characters or fewer.",
    );
  }
  const [knowledgeSnapshot, activeOverrides] = await Promise.all([
    options.firestore.collection(KNOWLEDGE_COLLECTION).limit(250).get(),
    getActiveWayfinderKnowledgeOverrides(options.firestore),
  ]);
  const baseEntries = knowledgeSnapshot.docs
      .map((document) => document.data())
      .filter(isApprovedEntry_);
  const effectiveEntries = applyWayfinderKnowledgeOverrides(
      baseEntries,
      activeOverrides,
  );
  const retrieval = rankWayfinderKnowledge(
      instruction,
      effectiveEntries,
      {limit: 4, minimumScore: 3},
  );
  const entriesById = new Map(
      effectiveEntries.map((entry) => [entry.id, entry]),
  );
  const candidates = retrieval.results
      .map((result) => entriesById.get(result.id))
      .filter(Boolean);
  if (!candidates.length) {
    return {
      mode: "knowledge_admin",
      modeActive: true,
      needsClarification: true,
      message: "Which existing Wayfinder topic should this permanently update?",
    };
  }
  const generated = await options.generateChange({instruction, candidates});
  if (generated.clarificationNeeded) {
    return {
      mode: "knowledge_admin",
      modeActive: true,
      needsClarification: true,
      message: generated.clarificationQuestion,
    };
  }
  const baseEntry = entriesById.get(generated.targetEntryId);
  if (!baseEntry) {
    throw createWayfinderAccessError(
        409,
        "The selected knowledge entry changed.",
    );
  }
  const replacementEntry = buildReplacementEntry_(baseEntry, generated);
  const reference = options.firestore.collection(DRAFT_COLLECTION).doc();
  const draftExpiresAt = new Date(
      options.current.getTime() + DRAFT_DURATION_MS,
  );
  const data = {
    status: "draft",
    targetEntryId: baseEntry.id,
    changeSummary: generated.changeSummary,
    beforeEntry: editableEntrySnapshot_(baseEntry),
    replacementEntry,
    createdByUid: options.decodedToken.uid,
    createdByEmail: normalizeEmail_(options.decodedToken.email),
    createdAt: options.current,
    updatedAt: options.current,
    draftExpiresAt,
  };
  await reference.set(data);
  return {
    mode: "knowledge_admin",
    modeActive: true,
    needsClarification: false,
    draft: toPublicKnowledgeDraft_(reference.id, data),
    message: "Review the permanent knowledge change before approving it.",
  };
}

async function publishKnowledgeDraft_(options) {
  const draftId = requireSafeId_(options.draftId);
  const draftReference = options.firestore.collection(DRAFT_COLLECTION)
      .doc(draftId);
  const draftSnapshot = await draftReference.get();
  if (!draftSnapshot.exists) {
    throw createWayfinderAccessError(
        404,
        "That knowledge draft was not found.",
    );
  }
  const draft = draftSnapshot.data() || {};
  if (draft.status !== "draft") {
    throw createWayfinderAccessError(
        409,
        "That knowledge draft is not active.",
    );
  }
  const draftExpiresAt = dateFromValue_(draft.draftExpiresAt);
  if (!draftExpiresAt || draftExpiresAt <= options.current) {
    throw createWayfinderAccessError(409, "That knowledge draft expired.");
  }
  const entryId = requireSafeEntryId_(draft.targetEntryId);
  const overrideReference = options.firestore.collection(OVERRIDE_COLLECTION)
      .doc(entryId);
  const currentSnapshot = await overrideReference.get();
  const currentData = currentSnapshot.exists ?
    currentSnapshot.data() || {} : {};
  const revision = (Number(currentData.revision) || 0) + 1;
  const historyReference = options.firestore.collection(HISTORY_COLLECTION)
      .doc();
  const batch = options.firestore.batch();
  batch.set(historyReference, {
    entryId,
    action: "publish",
    revision,
    previousOverride: currentSnapshot.exists ? currentData : null,
    changedByUid: options.decodedToken.uid,
    changedByEmail: normalizeEmail_(options.decodedToken.email),
    changedAt: options.current,
  });
  batch.set(overrideReference, {
    entryId,
    entry: draft.replacementEntry,
    changeSummary: String(draft.changeSummary || ""),
    active: true,
    revision,
    updatedByUid: options.decodedToken.uid,
    updatedByEmail: normalizeEmail_(options.decodedToken.email),
    updatedAt: options.current,
    createdAt: currentData.createdAt || options.current,
  });
  batch.set(draftReference, {
    status: "published",
    publishedRevision: revision,
    publishedAt: options.current,
    updatedAt: options.current,
  }, {merge: true});
  await batch.commit();
  return {
    mode: "knowledge_admin",
    modeActive: true,
    published: true,
    entryId,
    revision,
    message: "The permanent Wayfinder knowledge change is active.",
  };
}

async function cancelKnowledgeDraft_(options) {
  const draftId = requireSafeId_(options.draftId);
  const reference = options.firestore.collection(DRAFT_COLLECTION).doc(draftId);
  const snapshot = await reference.get();
  if (snapshot.exists) {
    const data = snapshot.data() || {};
    if (data.createdByUid !== options.decodedToken.uid) {
      throw createWayfinderAccessError(
          403,
          "That draft belongs to another admin.",
      );
    }
    await reference.set({
      status: "cancelled",
      updatedAt: options.current,
    }, {merge: true});
  }
  return {
    mode: "knowledge_admin",
    modeActive: true,
    cancelled: true,
    message: "The permanent knowledge draft was cancelled.",
  };
}

async function listKnowledgeOverrides_(firestore) {
  const snapshot = await firestore.collection(OVERRIDE_COLLECTION)
      .limit(100)
      .get();
  const overrides = snapshot.docs.map((document) => {
    const data = document.data() || {};
    return {
      entryId: document.id,
      title: String(data.entry && data.entry.title || document.id),
      changeSummary: String(data.changeSummary || ""),
      active: data.active === true,
      revision: Number(data.revision) || 0,
      updatedByEmail: normalizeEmail_(data.updatedByEmail),
      updatedAt: dateFromValue_(data.updatedAt) ?
        dateFromValue_(data.updatedAt).toISOString() : "",
    };
  }).sort((left, right) => {
    return String(right.updatedAt).localeCompare(String(left.updatedAt));
  });
  return {
    mode: "knowledge_admin",
    modeActive: true,
    overrides,
    message: overrides.length ?
      "Permanent knowledge overrides are ready to manage." :
      "There are no permanent knowledge overrides yet.",
  };
}

async function deactivateKnowledgeOverride_(options) {
  const entryId = requireSafeEntryId_(options.entryId);
  const reference = options.firestore.collection(OVERRIDE_COLLECTION)
      .doc(entryId);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    throw createWayfinderAccessError(
        404,
        "That knowledge override was not found.",
    );
  }
  const data = snapshot.data() || {};
  const historyReference = options.firestore.collection(HISTORY_COLLECTION)
      .doc();
  const batch = options.firestore.batch();
  batch.set(historyReference, {
    entryId,
    action: "deactivate",
    revision: Number(data.revision) || 0,
    previousOverride: data,
    changedByUid: options.decodedToken.uid,
    changedByEmail: normalizeEmail_(options.decodedToken.email),
    changedAt: options.current,
  });
  batch.set(reference, {
    active: false,
    deactivatedAt: options.current,
    deactivatedByUid: options.decodedToken.uid,
    deactivatedByEmail: normalizeEmail_(options.decodedToken.email),
    updatedAt: options.current,
  }, {merge: true});
  await batch.commit();
  return {
    mode: "knowledge_admin",
    modeActive: true,
    deactivated: true,
    entryId,
    message: "The override is inactive. Wayfinder is using the imported entry.",
  };
}

function validateGeneratedChange_(rawOutput, candidates) {
  let output;
  try {
    output = JSON.parse(String(rawOutput || "").trim());
  } catch (error) {
    throw createValidationError_("Gemini returned an invalid change draft.");
  }
  if (output.clarificationNeeded === true) {
    const question = limitedString_(output.clarificationQuestion, 240);
    if (!question) {
      throw createValidationError_("The clarification was invalid.");
    }
    return {clarificationNeeded: true, clarificationQuestion: question};
  }
  const allowedIds = new Set(candidates.map((entry) => entry.id));
  const targetEntryId = String(output.targetEntryId || "").trim();
  if (!allowedIds.has(targetEntryId)) {
    throw createValidationError_("Gemini selected an unsupported entry.");
  }
  return {
    clarificationNeeded: false,
    clarificationQuestion: "",
    targetEntryId,
    changeSummary: requiredLimitedString_(output.changeSummary, 240),
    title: requiredLimitedString_(output.title, 120),
    requiredFacts: safeStringArray_(output.requiredFacts, 30, 500),
    allowedPublicFacts: safeStringArray_(output.allowedPublicFacts, 30, 500),
    requiredActions: safeStringArray_(output.requiredActions, 20, 500),
    prohibitedClaims: safeStringArray_(output.prohibitedClaims, 30, 500),
    prohibitedInformation: safeStringArray_(
        output.prohibitedInformation,
        30,
        500,
    ),
    approvedLinks: safeLinks_(output.approvedLinks),
  };
}

function buildReplacementEntry_(baseEntry, generated) {
  const replacement = {
    ...baseEntry,
    title: generated.title,
    requiredFacts: generated.requiredFacts,
    allowedPublicFacts: generated.allowedPublicFacts,
    requiredActions: generated.requiredActions,
    prohibitedClaims: generated.prohibitedClaims,
    prohibitedInformation: generated.prohibitedInformation,
    approvedLinks: generated.approvedLinks,
  };
  if (!replacement.requiredFacts.length &&
    !replacement.allowedPublicFacts.length &&
    !replacement.requiredActions.length) {
    throw createValidationError_(
        "The replacement entry has no answer content.",
    );
  }
  return replacement;
}

function sanitizeCandidateEntries_(entries) {
  return (Array.isArray(entries) ? entries : []).slice(0, 4).map((entry) => {
    return editableEntrySnapshot_(entry);
  }).filter((entry) => entry.id && entry.title);
}

function editableEntrySnapshot_(entry) {
  return {
    id: String(entry && entry.id || ""),
    topic: String(entry && entry.topic || ""),
    title: String(entry && entry.title || ""),
    requiredFacts: safeStringArray_(entry && entry.requiredFacts, 30, 500),
    allowedPublicFacts: safeStringArray_(
        entry && entry.allowedPublicFacts,
        30,
        500,
    ),
    requiredActions: safeStringArray_(
        entry && entry.requiredActions,
        20,
        500,
    ),
    prohibitedClaims: safeStringArray_(
        entry && entry.prohibitedClaims,
        30,
        500,
    ),
    prohibitedInformation: safeStringArray_(
        entry && entry.prohibitedInformation,
        30,
        500,
    ),
    approvedLinks: safeLinks_(entry && entry.approvedLinks),
  };
}

function toPublicKnowledgeDraft_(id, data) {
  return {
    id,
    targetEntryId: String(data.targetEntryId || ""),
    changeSummary: String(data.changeSummary || ""),
    beforeEntry: editableEntrySnapshot_(data.beforeEntry),
    replacementEntry: editableEntrySnapshot_(data.replacementEntry),
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

function requireEditPermission_(permission) {
  if (!EDIT_PERMISSIONS.has(String(permission || ""))) {
    throw createWayfinderAccessError(403, "Your access cannot edit Wayfinder.");
  }
}

function requireAdminPermission_(permission) {
  if (String(permission || "") !== "admin") {
    throw createWayfinderAccessError(
        403,
        "Permanent Wayfinder changes require Admin permission.",
    );
  }
}

function requireSafeId_(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw createWayfinderAccessError(400, "A valid draft is required.");
  }
  return id;
}

function requireSafeEntryId_(value) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(id)) {
    throw createWayfinderAccessError(
        400,
        "A valid knowledge entry is required.",
    );
  }
  return id;
}

function safeStringArray_(value, maxItems, maxLength) {
  const result = (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, maxItems);
  if (result.some((item) => item.length > maxLength)) {
    throw createValidationError_("A knowledge field was too long.");
  }
  return result;
}

function safeLinks_(value) {
  return (Array.isArray(value) ? value : []).slice(0, 12).map((link) => {
    const label = requiredLimitedString_(link && link.label, 100);
    const url = String(link && link.url || "").trim();
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      throw createValidationError_("A permanent link was invalid.");
    }
    if (parsed.protocol !== "https:") {
      throw createValidationError_("Permanent links must use HTTPS.");
    }
    return {label, url};
  });
}

function limitedString_(value, maxLength) {
  const text = String(value || "").trim();
  return text.length <= maxLength ? text : "";
}

function requiredLimitedString_(value, maxLength) {
  const text = limitedString_(value, maxLength);
  if (!text) {
    throw createValidationError_("A required knowledge field was invalid.");
  }
  return text;
}

function isApprovedEntry_(entry) {
  return entry && entry.approvalStatus === "approved" &&
    entry.publicationState === "draft";
}

function dateFromValue_(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function createValidationError_(message) {
  const error = new Error(message);
  error.code = "wayfinder-knowledge-change-validation";
  return error;
}
