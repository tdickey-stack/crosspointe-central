import crypto from "node:crypto";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";

const CONFIG_DOC_PATH = "centralAssistantBetaConfig/settings";
const INVITES_COLLECTION = "centralAssistantBetaInvites";
const ACCESS_COLLECTION = "centralAssistantBetaAccess";
const USAGE_COLLECTION = "centralAssistantBetaUsage";
const CONVERSATIONS_COLLECTION = "centralAssistantBetaConversations";
// Firebase Hosting forwards only the specially named __session cookie through
// rewrites to Cloud Functions.
const SESSION_COOKIE_NAME = "__session";
const CENTRAL_TIMEZONE = "America/Chicago";
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,100}$/;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,100}$/;
const ACCESS_ID_PATTERN = /^WF-BETA-[A-Z0-9]{8}$/;
const QUESTION_COOLDOWN_MILLISECONDS = 2500;
const BETA_CONFIG_VERSION = 2;
const DEFAULT_CONFIG = Object.freeze({
  betaEnabled: false,
  sessionDays: 30,
  transcriptRetentionDays: 30,
  defaultMaxActivations: 20,
  perAccessDailyLimit: 25,
  globalDailyLimit: 250,
});

export function createFirestoreWayfinderBetaService(dependencies) {
  const firestore = dependencies.firestore;
  const timestampFromDate = dependencies.timestampFromDate;
  const now = typeof dependencies.now === "function" ?
    dependencies.now : () => new Date();
  const randomBytes = typeof dependencies.randomBytes === "function" ?
    dependencies.randomBytes : crypto.randomBytes;

  function toTimestamp_(date) {
    return timestampFromDate(new Date(date));
  }

  function getNow_() {
    return new Date(now());
  }

  async function getConfig_() {
    const snapshot = await firestore.doc(CONFIG_DOC_PATH).get();
    return normalizeConfig_(snapshot.exists ? snapshot.data() : {});
  }

  async function authenticateSessionToken_(sessionToken) {
    if (!SESSION_TOKEN_PATTERN.test(String(sessionToken || ""))) {
      throw createWayfinderAccessError(
          401,
          "This Wayfinder beta session is unavailable.",
      );
    }
    const sessionRecordId = hashWayfinderBetaToken(sessionToken);
    const sessionRef = firestore.collection(ACCESS_COLLECTION)
        .doc(sessionRecordId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw createWayfinderAccessError(
          401,
          "This Wayfinder beta session is unavailable.",
      );
    }
    const session = sessionSnapshot.data() || {};
    const config = await getConfig_();
    const currentTime = getNow_();
    if (!config.betaEnabled) {
      throw createWayfinderAccessError(
          403,
          "The Wayfinder beta is not accepting questions right now.",
      );
    }
    if (session.status !== "active" ||
      toMillis_(session.expiresAt) <= currentTime.getTime()) {
      throw createWayfinderAccessError(
          403,
          "This Wayfinder beta access has expired or been revoked.",
      );
    }
    const inviteRef = firestore.collection(INVITES_COLLECTION)
        .doc(String(session.inviteRecordId || ""));
    const inviteSnapshot = await inviteRef.get();
    const invite = inviteSnapshot.exists ? inviteSnapshot.data() || {} : {};
    if (invite.status !== "active" ||
      toMillis_(invite.expiresAt) <= currentTime.getTime()) {
      throw createWayfinderAccessError(
          403,
          "This Wayfinder beta invitation has expired or been revoked.",
      );
    }
    return buildAccessContext_(
        sessionRecordId,
        session,
        invite,
        config,
    );
  }

  async function redeemInvite_(options) {
    const token = String(options && options.token || "").trim();
    if (!INVITE_TOKEN_PATTERN.test(token)) {
      throw createWayfinderAccessError(
          400,
          "That Wayfinder beta invitation is invalid.",
      );
    }
    const inviteRecordId = hashWayfinderBetaToken(token);
    const existingSessionToken = String(
        options && options.existingSessionToken || "",
    ).trim();
    if (existingSessionToken) {
      try {
        const existing = await authenticateSessionToken_(
            existingSessionToken,
        );
        if (existing.inviteRecordId === inviteRecordId) {
          return {
            sessionToken: existingSessionToken,
            access: existing,
          };
        }
      } catch (error) {
        // A stale session cookie should not block a valid new invitation.
      }
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const sessionRecordId = hashWayfinderBetaToken(sessionToken);
    const accessId = createAccessId_(randomBytes);
    const currentTime = getNow_();
    const configRef = firestore.doc(CONFIG_DOC_PATH);
    const inviteRef = firestore.collection(INVITES_COLLECTION)
        .doc(inviteRecordId);
    const sessionRef = firestore.collection(ACCESS_COLLECTION)
        .doc(sessionRecordId);

    const access = await firestore.runTransaction(async (transaction) => {
      const [configSnapshot, inviteSnapshot] = await Promise.all([
        transaction.get(configRef),
        transaction.get(inviteRef),
      ]);
      const config = normalizeConfig_(
          configSnapshot.exists ? configSnapshot.data() : {},
      );
      if (!config.betaEnabled) {
        throw createWayfinderAccessError(
            403,
            "The Wayfinder beta is not accepting invitations right now.",
        );
      }
      if (!inviteSnapshot.exists) {
        throw createWayfinderAccessError(
            404,
            "That Wayfinder beta invitation was not found.",
        );
      }
      const invite = inviteSnapshot.data() || {};
      if (invite.status !== "active" ||
        toMillis_(invite.expiresAt) <= currentTime.getTime()) {
        throw createWayfinderAccessError(
            403,
            "That Wayfinder beta invitation has expired or been revoked.",
        );
      }
      const activationCount = boundedInteger_(
          invite.activationCount,
          0,
          100000,
          0,
      );
      const maxActivations = boundedInteger_(
          invite.maxActivations,
          1,
          100,
          config.defaultMaxActivations,
      );
      if (activationCount >= maxActivations) {
        throw createWayfinderAccessError(
            403,
            "That Wayfinder beta invitation has reached its access limit.",
        );
      }
      const inviteExpiration = new Date(toMillis_(invite.expiresAt));
      const sessionExpiration = new Date(Math.min(
          inviteExpiration.getTime(),
          currentTime.getTime() + config.sessionDays * 86400000,
      ));
      const session = {
        accessId,
        inviteId: String(invite.inviteId || ""),
        inviteLabel: String(invite.label || "").slice(0, 80),
        inviteRecordId,
        status: "active",
        createdAt: toTimestamp_(currentTime),
        lastActiveAt: toTimestamp_(currentTime),
        expiresAt: toTimestamp_(sessionExpiration),
        usageDate: getCentralDateKey_(currentTime),
        questionsToday: 0,
        totalQuestions: 0,
        feedbackCount: 0,
      };
      transaction.set(sessionRef, session);
      transaction.set(inviteRef, {
        activationCount: activationCount + 1,
        lastActivatedAt: toTimestamp_(currentTime),
      }, {merge: true});
      return buildAccessContext_(
          sessionRecordId,
          session,
          invite,
          config,
      );
    });

    return {sessionToken, access};
  }

  async function consumeQuestion_(accessContext) {
    const currentTime = getNow_();
    const dateKey = getCentralDateKey_(currentTime);
    const sessionRef = firestore.collection(ACCESS_COLLECTION)
        .doc(accessContext.sessionRecordId);
    const inviteRef = firestore.collection(INVITES_COLLECTION)
        .doc(accessContext.inviteRecordId);
    const configRef = firestore.doc(CONFIG_DOC_PATH);
    const usageRef = firestore.collection(USAGE_COLLECTION).doc(dateKey);

    return firestore.runTransaction(async (transaction) => {
      const [sessionSnapshot, inviteSnapshot, configSnapshot, usageSnapshot] =
        await Promise.all([
          transaction.get(sessionRef),
          transaction.get(inviteRef),
          transaction.get(configRef),
          transaction.get(usageRef),
        ]);
      const config = normalizeConfig_(
          configSnapshot.exists ? configSnapshot.data() : {},
      );
      const session = sessionSnapshot.exists ?
        sessionSnapshot.data() || {} : {};
      const invite = inviteSnapshot.exists ? inviteSnapshot.data() || {} : {};
      if (!config.betaEnabled || session.status !== "active" ||
        invite.status !== "active" ||
        toMillis_(session.expiresAt) <= currentTime.getTime() ||
        toMillis_(invite.expiresAt) <= currentTime.getTime()) {
        throw createWayfinderAccessError(
            403,
            "This Wayfinder beta access has expired or been revoked.",
        );
      }
      const questionsToday = session.usageDate === dateKey ?
        boundedInteger_(session.questionsToday, 0, 100000, 0) : 0;
      const lastQuestionAt = toMillis_(session.lastQuestionAt);
      if (lastQuestionAt > 0 &&
        currentTime.getTime() - lastQuestionAt <
          QUESTION_COOLDOWN_MILLISECONDS) {
        throw createWayfinderAccessError(
            429,
            "Please wait a moment before asking another question.",
        );
      }
      if (questionsToday >= config.perAccessDailyLimit) {
        throw createWayfinderAccessError(
            429,
            "You have reached today's Wayfinder beta question limit. " +
              "Please try again tomorrow.",
        );
      }
      const usage = usageSnapshot.exists ? usageSnapshot.data() || {} : {};
      const globalQuestions = boundedInteger_(
          usage.questionCount,
          0,
          10000000,
          0,
      );
      if (globalQuestions >= config.globalDailyLimit) {
        throw createWayfinderAccessError(
            429,
            "Wayfinder has reached today's beta capacity. Please try again " +
              "tomorrow.",
        );
      }
      const totalQuestions = boundedInteger_(
          session.totalQuestions,
          0,
          10000000,
          0,
      ) + 1;
      transaction.set(sessionRef, {
        usageDate: dateKey,
        questionsToday: questionsToday + 1,
        totalQuestions,
        lastActiveAt: toTimestamp_(currentTime),
        lastQuestionAt: toTimestamp_(currentTime),
      }, {merge: true});
      transaction.set(usageRef, {
        dateKey,
        questionCount: globalQuestions + 1,
        updatedAt: toTimestamp_(currentTime),
      }, {merge: true});
      return {
        questionsToday: questionsToday + 1,
        remainingToday: Math.max(
            0,
            config.perAccessDailyLimit - questionsToday - 1,
        ),
        globalQuestionCount: globalQuestions + 1,
      };
    });
  }

  async function recordConversation_(accessContext, interaction) {
    const currentTime = getNow_();
    const responseId = /^[A-Za-z0-9_-]{8,100}$/.test(
        String(interaction && interaction.responseId || ""),
    ) ? String(interaction.responseId) : crypto.randomUUID();
    const retentionDays = accessContext.config.transcriptRetentionDays;
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION)
        .doc(responseId);
    await conversationRef.set({
      responseId,
      accessId: accessContext.accessId,
      inviteId: accessContext.inviteId,
      inviteLabel: accessContext.inviteLabel,
      question: redactBetaText_(interaction && interaction.question, 500),
      answer: String(interaction && interaction.answer || "")
          .trim().slice(0, 1800),
      error: String(interaction && interaction.error || "")
          .trim().slice(0, 500),
      answerMode: String(interaction && interaction.answerMode || "")
          .trim().slice(0, 80),
      modelUsed: interaction && interaction.modelUsed === true,
      confidence: String(interaction && interaction.confidence || "")
          .trim().slice(0, 40),
      statusCode: boundedInteger_(
          interaction && interaction.statusCode,
          100,
          599,
          200,
      ),
      links: sanitizeConversationLinks_(interaction && interaction.links),
      actions: sanitizeConversationActions_(interaction && interaction.actions),
      feedbackRating: "",
      feedbackReason: "",
      feedbackNote: "",
      createdAt: toTimestamp_(currentTime),
      expiresAt: toTimestamp_(new Date(
          currentTime.getTime() + retentionDays * 86400000,
      )),
    }, {merge: false});
    return responseId;
  }

  async function recordFeedback_(accessContext, feedback) {
    const responseId = String(feedback && feedback.responseId || "").trim();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(responseId)) return;
    const conversationRef = firestore.collection(CONVERSATIONS_COLLECTION)
        .doc(responseId);
    const sessionRef = firestore.collection(ACCESS_COLLECTION)
        .doc(accessContext.sessionRecordId);
    await firestore.runTransaction(async (transaction) => {
      const [conversationSnapshot, sessionSnapshot] = await Promise.all([
        transaction.get(conversationRef),
        transaction.get(sessionRef),
      ]);
      if (conversationSnapshot.exists &&
        conversationSnapshot.get("accessId") === accessContext.accessId) {
        transaction.set(conversationRef, {
          feedbackRating: String(feedback.rating || "").slice(0, 40),
          feedbackReason: String(feedback.reason || "").slice(0, 80),
          feedbackNote: redactBetaText_(feedback.note, 500),
          feedbackAt: toTimestamp_(getNow_()),
        }, {merge: true});
      }
      const currentFeedbackCount = sessionSnapshot.exists ?
        sessionSnapshot.get("feedbackCount") : 0;
      transaction.set(sessionRef, {
        feedbackCount: boundedInteger_(
            currentFeedbackCount,
            0,
            100000,
            0,
        ) + 1,
      }, {merge: true});
    });
  }

  async function createInvite_(options, adminIdentity) {
    const currentTime = getNow_();
    const config = await getConfig_();
    const label = requiredBoundedString_(
        options && options.label,
        "Give this beta invitation a label.",
        80,
    );
    const expiresInDays = boundedInteger_(
        options && options.expiresInDays,
        1,
        90,
        config.sessionDays,
    );
    const maxActivations = boundedInteger_(
        options && options.maxActivations,
        1,
        100,
        config.defaultMaxActivations,
    );
    const token = randomBytes(32).toString("base64url");
    const inviteRecordId = hashWayfinderBetaToken(token);
    const inviteId = createInviteId_(randomBytes);
    const expiresAt = new Date(
        currentTime.getTime() + expiresInDays * 86400000,
    );
    await firestore.collection(INVITES_COLLECTION).doc(inviteRecordId).set({
      inviteId,
      label,
      status: "active",
      maxActivations,
      activationCount: 0,
      createdAt: toTimestamp_(currentTime),
      expiresAt: toTimestamp_(expiresAt),
      createdByUid: String(adminIdentity && adminIdentity.uid || ""),
      createdByEmail: String(adminIdentity && adminIdentity.email || "")
          .trim().toLowerCase().slice(0, 254),
    });
    return {
      inviteId,
      inviteRecordId,
      label,
      token,
      status: "active",
      maxActivations,
      activationCount: 0,
      createdAt: currentTime.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async function updateConfig_(updates, adminIdentity) {
    const current = await getConfig_();
    const next = {
      configVersion: BETA_CONFIG_VERSION,
      betaEnabled: updates && typeof updates.betaEnabled === "boolean" ?
        updates.betaEnabled : current.betaEnabled,
      sessionDays: boundedInteger_(
          updates && updates.sessionDays,
          1,
          90,
          current.sessionDays,
      ),
      transcriptRetentionDays: boundedInteger_(
          updates && updates.transcriptRetentionDays,
          1,
          90,
          current.transcriptRetentionDays,
      ),
      defaultMaxActivations: boundedInteger_(
          updates && updates.defaultMaxActivations,
          1,
          100,
          current.defaultMaxActivations,
      ),
      perAccessDailyLimit: boundedInteger_(
          updates && updates.perAccessDailyLimit,
          1,
          500,
          current.perAccessDailyLimit,
      ),
      globalDailyLimit: boundedInteger_(
          updates && updates.globalDailyLimit,
          1,
          10000,
          current.globalDailyLimit,
      ),
    };
    await firestore.doc(CONFIG_DOC_PATH).set({
      ...next,
      updatedAt: toTimestamp_(getNow_()),
      updatedByUid: String(adminIdentity && adminIdentity.uid || ""),
      updatedByEmail: String(adminIdentity && adminIdentity.email || "")
          .trim().toLowerCase().slice(0, 254),
    }, {merge: true});
    return next;
  }

  async function revokeInvite_(inviteRecordId) {
    const id = validateRecordId_(inviteRecordId);
    await firestore.collection(INVITES_COLLECTION).doc(id).set({
      status: "revoked",
      revokedAt: toTimestamp_(getNow_()),
    }, {merge: true});
  }

  async function revokeAccess_(sessionRecordId) {
    const id = validateRecordId_(sessionRecordId);
    await firestore.collection(ACCESS_COLLECTION).doc(id).set({
      status: "revoked",
      revokedAt: toTimestamp_(getNow_()),
    }, {merge: true});
  }

  async function getConversationHistory_(options = {}) {
    const currentTime = getNow_();
    const accessId = String(options && options.accessId || "")
        .trim().toUpperCase();
    if (!ACCESS_ID_PATTERN.test(accessId)) {
      throw createWayfinderAccessError(
          400,
          "Choose a valid Wayfinder beta Access ID.",
      );
    }
    let conversationQuery = firestore.collection(CONVERSATIONS_COLLECTION)
        .where("accessId", "==", accessId)
        .orderBy("createdAt", "desc");
    const conversationCursor = String(
        options && options.conversationCursor || "",
    ).trim();
    if (/^[A-Za-z0-9_-]{8,100}$/.test(conversationCursor)) {
      const cursorSnapshot = await firestore.collection(
          CONVERSATIONS_COLLECTION,
      ).doc(conversationCursor).get();
      if (cursorSnapshot.exists &&
        cursorSnapshot.get("accessId") === accessId) {
        conversationQuery = conversationQuery.startAfter(cursorSnapshot);
      }
    }
    const conversationSnapshot = await conversationQuery.limit(51).get();
    const conversationDocuments = conversationSnapshot.docs.slice(0, 50);
    const conversations = conversationDocuments
        .map((document) => {
          return serializeConversation_(document.id, document.data() || {});
        })
        .filter((item) => {
          return !item.expiresAt ||
            new Date(item.expiresAt).getTime() > currentTime.getTime();
        });
    return {
      accessId,
      conversations,
      conversationPage: {
        hasMore: conversationSnapshot.docs.length > 50,
        nextCursor: conversationDocuments.length ?
          conversationDocuments[conversationDocuments.length - 1].id : "",
      },
    };
  }

  async function getDashboard_() {
    const currentTime = getNow_();
    const dateKey = getCentralDateKey_(currentTime);
    const [config, inviteSnapshot, accessSnapshot, usageSnapshot] =
      await Promise.all([
        getConfig_(),
        firestore.collection(INVITES_COLLECTION)
            .orderBy("createdAt", "desc").get(),
        firestore.collection(ACCESS_COLLECTION)
            .orderBy("lastActiveAt", "desc").get(),
        firestore.collection(USAGE_COLLECTION).doc(dateKey).get(),
      ]);
    return {
      config,
      usage: {
        dateKey,
        questionCount: usageSnapshot.exists ? boundedInteger_(
            usageSnapshot.get("questionCount"),
            0,
            10000000,
            0,
        ) : 0,
      },
      invites: inviteSnapshot.docs.map((document) => {
        return serializeInvite_(document.id, document.data() || {});
      }),
      access: accessSnapshot.docs.map((document) => {
        return serializeAccess_(document.id, document.data() || {}, dateKey);
      }),
    };
  }

  return {
    authenticateSessionToken: authenticateSessionToken_,
    consumeQuestion: consumeQuestion_,
    createInvite: createInvite_,
    getConfig: getConfig_,
    getConversationHistory: getConversationHistory_,
    getDashboard: getDashboard_,
    recordConversation: recordConversation_,
    recordFeedback: recordFeedback_,
    redeemInvite: redeemInvite_,
    revokeAccess: revokeAccess_,
    revokeInvite: revokeInvite_,
    updateConfig: updateConfig_,
  };
}

export function createWayfinderBetaRedeemHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    try {
      validateBetaRequestOrigin_(request);
      const existingSessionToken = getWayfinderBetaSessionToken(request);
      const result = await dependencies.service.redeemInvite({
        token: request.body && request.body.token,
        existingSessionToken,
      });
      response.set("Set-Cookie", buildWayfinderBetaCookie_(
          request,
          result.sessionToken,
          result.access.expiresAt,
      ));
      response.status(200).json({
        ok: true,
        canUse: true,
        sessionToken: result.sessionToken,
        access: sanitizeAccessResponse_(result.access),
        message: "Wayfinder beta access is ready on this browser.",
      });
    } catch (error) {
      response.status(Number(error && error.statusCode) || 500).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder could not activate that beta invitation.",
      });
    }
  };
}

export function createWayfinderBetaAccessHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    const sessionToken = getWayfinderBetaSessionToken(request);
    if (!sessionToken) {
      response.status(200).json({ok: true, canUse: false});
      return;
    }
    try {
      const access = await dependencies.service.authenticateSessionToken(
          sessionToken,
      );
      response.status(200).json({
        ok: true,
        canUse: true,
        access: sanitizeAccessResponse_(access),
      });
    } catch (error) {
      response.set("Set-Cookie", clearWayfinderBetaCookie_(request));
      response.status(200).json({
        ok: true,
        canUse: false,
        message: error && error.statusCode ? String(error.message) : "",
      });
    }
  };
}

export function createWayfinderBetaAnswerHandler(dependencies) {
  return async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    const sessionToken = getWayfinderBetaSessionToken(request);
    let access = null;
    try {
      access = await dependencies.service.authenticateSessionToken(
          sessionToken,
      );
      await dependencies.service.consumeQuestion(access);
    } catch (error) {
      response.status(Number(error && error.statusCode) || 500).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder beta access could not be verified.",
      });
      return;
    }

    const captured = createCapturedResponse_(response);
    await dependencies.answerHandler(request, captured.response);
    const payload = captured.payload || {};
    try {
      await dependencies.service.recordConversation(access, {
        responseId: payload.responseId,
        question: request.body && request.body.question,
        answer: payload.answer,
        error: payload.error,
        answerMode: payload.answerMode,
        modelUsed: payload.modelUsed,
        confidence: payload.confidence,
        statusCode: captured.statusCode,
        links: payload.links,
        actions: payload.actions,
      });
    } catch (error) {
      console.warn("Wayfinder beta transcript could not be stored.", {
        code: String(error && error.code || "transcript_write_failed"),
      });
    }
    captured.flush();
  };
}

export function createWayfinderBetaFeedbackHandler(dependencies) {
  return async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    const sessionToken = getWayfinderBetaSessionToken(request);
    let access = null;
    try {
      access = await dependencies.service.authenticateSessionToken(
          sessionToken,
      );
    } catch (error) {
      response.status(Number(error && error.statusCode) || 500).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder beta access could not be verified.",
      });
      return;
    }
    request.wayfinderBetaAccess = access;
    request.body = sanitizeBetaFeedbackBody_(request.body);
    const captured = createCapturedResponse_(response);
    await dependencies.feedbackHandler(request, captured.response);
    if (captured.statusCode >= 200 && captured.statusCode < 300) {
      try {
        await dependencies.service.recordFeedback(access, request.body || {});
      } catch (error) {
        console.warn("Wayfinder beta feedback attribution failed.", {
          code: String(error && error.code || "feedback_attribution_failed"),
        });
      }
    }
    captured.flush();
  };
}

export function createWayfinderBetaAdminHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request,
        admin: dependencies.admin,
        firestore: dependencies.firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      if (authResult.permission !== "admin") {
        throw createWayfinderAccessError(
            403,
            "Only a Wayfinder Admin can manage beta access.",
        );
      }
      const action = String(request.body && request.body.action || "list")
          .trim().toLowerCase();
      const identity = {
        uid: authResult.decodedToken.uid,
        email: authResult.decodedToken.email,
      };
      if (action === "list_conversations") {
        const history = await dependencies.service.getConversationHistory({
          accessId: request.body && request.body.accessId,
          conversationCursor:
            request.body && request.body.conversationCursor,
        });
        response.status(200).json({ok: true, ...history});
        return;
      }
      let createdInvite = null;
      if (action === "create_invite") {
        createdInvite = await dependencies.service.createInvite(
            request.body,
            identity,
        );
      } else if (action === "update_config") {
        await dependencies.service.updateConfig(request.body, identity);
      } else if (action === "revoke_invite") {
        await dependencies.service.revokeInvite(
            request.body && request.body.inviteRecordId,
        );
      } else if (action === "revoke_access") {
        await dependencies.service.revokeAccess(
            request.body && request.body.sessionRecordId,
        );
      } else if (action !== "list") {
        throw createWayfinderAccessError(
            400,
            "Choose a valid Wayfinder beta management action.",
        );
      }
      const dashboard = await dependencies.service.getDashboard();
      const createdInviteToken = createdInvite && createdInvite.token;
      const safeCreatedInvite = createdInvite ? {...createdInvite} : null;
      if (safeCreatedInvite) delete safeCreatedInvite.token;
      response.status(200).json({
        ok: true,
        ...dashboard,
        createdInvite: safeCreatedInvite ? {
          ...safeCreatedInvite,
          inviteLink: buildInviteLink_(request, createdInviteToken),
        } : null,
      });
    } catch (error) {
      response.status(Number(error && error.statusCode) || 500).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder beta management is unavailable right now.",
      });
    }
  };
}

export function getWayfinderBetaSessionToken(request) {
  const cookieHeader = String(request && request.headers &&
    request.headers.cookie || "");
  const cookies = cookieHeader.split(";").reduce((result, item) => {
    const separator = item.indexOf("=");
    if (separator < 0) return result;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    result[name] = decodeURIComponent(value);
    return result;
  }, {});
  return String(cookies[SESSION_COOKIE_NAME] || "").trim();
}

export function hashWayfinderBetaToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function createCapturedResponse_(actualResponse) {
  let statusCode = 200;
  let payload = null;
  const headers = new Map();
  const capturedResponse = {
    set(name, value) {
      headers.set(name, value);
      return this;
    },
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  return {
    response: capturedResponse,
    get payload() {
      return payload;
    },
    get statusCode() {
      return statusCode;
    },
    flush() {
      headers.forEach((value, name) => actualResponse.set(name, value));
      actualResponse.status(statusCode).json(payload);
    },
  };
}

function normalizeConfig_(value) {
  const source = value && typeof value === "object" ? value : {};
  const isCurrentConfig = Number(source.configVersion) >=
    BETA_CONFIG_VERSION;
  return {
    configVersion: BETA_CONFIG_VERSION,
    betaEnabled: source.betaEnabled === true,
    sessionDays: boundedInteger_(
        source.sessionDays,
        1,
        90,
        DEFAULT_CONFIG.sessionDays,
    ),
    transcriptRetentionDays: boundedInteger_(
        source.transcriptRetentionDays,
        1,
        90,
        DEFAULT_CONFIG.transcriptRetentionDays,
    ),
    defaultMaxActivations: boundedInteger_(
        isCurrentConfig ? source.defaultMaxActivations : undefined,
        1,
        100,
        DEFAULT_CONFIG.defaultMaxActivations,
    ),
    perAccessDailyLimit: boundedInteger_(
        source.perAccessDailyLimit,
        1,
        500,
        DEFAULT_CONFIG.perAccessDailyLimit,
    ),
    globalDailyLimit: boundedInteger_(
        source.globalDailyLimit,
        1,
        10000,
        DEFAULT_CONFIG.globalDailyLimit,
    ),
  };
}

function buildAccessContext_(sessionRecordId, session, invite, config) {
  return {
    sessionRecordId,
    accessId: String(session.accessId || ""),
    inviteId: String(session.inviteId || invite.inviteId || ""),
    inviteLabel: String(session.inviteLabel || invite.label || ""),
    inviteRecordId: String(session.inviteRecordId || ""),
    status: String(session.status || ""),
    expiresAt: toIsoString_(session.expiresAt),
    questionsToday: boundedInteger_(session.questionsToday, 0, 100000, 0),
    totalQuestions: boundedInteger_(session.totalQuestions, 0, 10000000, 0),
    feedbackCount: boundedInteger_(session.feedbackCount, 0, 100000, 0),
    config,
  };
}

function sanitizeAccessResponse_(access) {
  return {
    accessId: String(access && access.accessId || ""),
    expiresAt: String(access && access.expiresAt || ""),
    questionsToday: boundedInteger_(
        access && access.questionsToday,
        0,
        100000,
        0,
    ),
    dailyLimit: boundedInteger_(
        access && access.config && access.config.perAccessDailyLimit,
        1,
        500,
        DEFAULT_CONFIG.perAccessDailyLimit,
    ),
    transcriptRetentionDays: boundedInteger_(
        access && access.config && access.config.transcriptRetentionDays,
        1,
        90,
        DEFAULT_CONFIG.transcriptRetentionDays,
    ),
  };
}

function serializeInvite_(recordId, value) {
  return {
    inviteRecordId: recordId,
    inviteId: String(value.inviteId || ""),
    label: String(value.label || ""),
    status: String(value.status || ""),
    maxActivations: boundedInteger_(value.maxActivations, 1, 100, 1),
    activationCount: boundedInteger_(value.activationCount, 0, 100000, 0),
    createdAt: toIsoString_(value.createdAt),
    expiresAt: toIsoString_(value.expiresAt),
    lastActivatedAt: toIsoString_(value.lastActivatedAt),
  };
}

function serializeAccess_(recordId, value, currentDateKey) {
  return {
    sessionRecordId: recordId,
    accessId: String(value.accessId || ""),
    inviteId: String(value.inviteId || ""),
    inviteLabel: String(value.inviteLabel || ""),
    status: String(value.status || ""),
    questionsToday: value.usageDate === currentDateKey ?
      boundedInteger_(value.questionsToday, 0, 100000, 0) : 0,
    totalQuestions: boundedInteger_(value.totalQuestions, 0, 10000000, 0),
    feedbackCount: boundedInteger_(value.feedbackCount, 0, 100000, 0),
    createdAt: toIsoString_(value.createdAt),
    lastActiveAt: toIsoString_(value.lastActiveAt),
    expiresAt: toIsoString_(value.expiresAt),
  };
}

function serializeConversation_(recordId, value) {
  return {
    id: recordId,
    responseId: String(value.responseId || recordId),
    accessId: String(value.accessId || ""),
    inviteId: String(value.inviteId || ""),
    inviteLabel: String(value.inviteLabel || ""),
    question: String(value.question || ""),
    answer: String(value.answer || ""),
    error: String(value.error || ""),
    answerMode: String(value.answerMode || ""),
    modelUsed: value.modelUsed === true,
    confidence: String(value.confidence || ""),
    feedbackRating: String(value.feedbackRating || ""),
    feedbackReason: String(value.feedbackReason || ""),
    feedbackNote: String(value.feedbackNote || ""),
    createdAt: toIsoString_(value.createdAt),
    expiresAt: toIsoString_(value.expiresAt),
  };
}

function sanitizeConversationLinks_(value) {
  return (Array.isArray(value) ? value : []).slice(0, 6).map((item) => ({
    label: String(item && item.label || "").slice(0, 80),
    url: String(item && item.url || "").slice(0, 1000),
  }));
}

function sanitizeConversationActions_(value) {
  return (Array.isArray(value) ? value : []).slice(0, 3).map((item) => ({
    type: String(item && item.type || "").slice(0, 80),
    id: String(item && item.id || "").slice(0, 160),
    label: String(item && item.label || "").slice(0, 80),
  }));
}

function sanitizeBetaFeedbackBody_(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...source,
    question: redactBetaText_(source.question, 500),
    answer: redactBetaText_(source.answer, 1800),
    note: redactBetaText_(source.note, 500),
  };
}

function redactBetaText_(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength)
      .replace(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
          "[email removed]",
      )
      .replace(
          /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
          "[phone removed]",
      );
}

function buildWayfinderBetaCookie_(request, token, expiresAt) {
  const expiration = new Date(expiresAt);
  const secure = isSecureRequest_(request) ? "; Secure" : "";
  return SESSION_COOKIE_NAME + "=" + encodeURIComponent(token) +
    "; Path=/; HttpOnly; SameSite=Lax; Expires=" +
    expiration.toUTCString() + secure;
}

function clearWayfinderBetaCookie_(request) {
  const secure = isSecureRequest_(request) ? "; Secure" : "";
  return SESSION_COOKIE_NAME +
    "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + secure;
}

function isSecureRequest_(request) {
  const protocol = String(request && request.headers &&
    request.headers["x-forwarded-proto"] || "").toLowerCase();
  return request && request.secure === true || protocol === "https";
}

function validateBetaRequestOrigin_(request) {
  const origin = String(request && request.headers && request.headers.origin ||
    "").trim();
  if (!origin) return;
  let parsed = null;
  try {
    parsed = new URL(origin);
  } catch (error) {
    throw createWayfinderAccessError(403, "That beta request was not allowed.");
  }
  const allowedHostname = parsed.hostname === "central.crosspointe.tv" ||
    parsed.hostname === "crosspointe-central.web.app" ||
    parsed.hostname === "crosspointe-central.firebaseapp.com" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1";
  if (!allowedHostname) {
    throw createWayfinderAccessError(403, "That beta request was not allowed.");
  }
}

function buildInviteLink_(request, token) {
  const origin = String(request && request.headers && request.headers.origin ||
    "").trim();
  let baseUrl = "https://central.crosspointe.tv/";
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      baseUrl = parsed.origin + "/";
    }
  } catch (error) {
    // Production links intentionally use the canonical Central hostname.
  }
  return baseUrl + "#wayfinder-invite=" + encodeURIComponent(token);
}

function getCentralDateKey_(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return [parts.year, parts.month, parts.day].join("-");
}

function createAccessId_(randomBytes) {
  return "WF-BETA-" + randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
}

function createInviteId_(randomBytes) {
  return "WF-INV-" + randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function requiredBoundedString_(value, message, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw createWayfinderAccessError(400, message);
  }
  return text;
}

function validateRecordId_(value) {
  const id = String(value || "").trim();
  if (!/^[a-f0-9]{64}$/.test(id)) {
    throw createWayfinderAccessError(400, "That beta record is invalid.");
  }
  return id;
}

function boundedInteger_(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    return fallback;
  }
  return number;
}

function toMillis_(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toIsoString_(value) {
  const milliseconds = toMillis_(value);
  return milliseconds ? new Date(milliseconds).toISOString() : "";
}

export const WAYFINDER_BETA_DEFAULT_CONFIG = DEFAULT_CONFIG;
export const WAYFINDER_BETA_SESSION_COOKIE = SESSION_COOKIE_NAME;
export const WAYFINDER_BETA_ACCESS_ID_PATTERN = ACCESS_ID_PATTERN;
