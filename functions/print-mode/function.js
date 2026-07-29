import {onRequest} from "firebase-functions/v2/https";

import {
  createPrintModeError,
  getPrintModeErrorMessage,
  getPrintModeStatusCode,
} from "./errors.js";
import {
  normalizePrintModePayload,
  normalizePrintModeText,
} from "./payload.js";
import {uploadPrintModeFallbackImage} from "./storage.js";

const PRINT_MODE_SETTINGS_DOC_PATH =
  "centralAdmin/root/public/bulletinMode";
const ADMIN_USERS_COLLECTION_PATH = "centralAdmin/root/users";
const ADMIN_AUDIT_LOG_COLLECTION_PATH = "centralAdmin/root/auditLog";

export function createPrintModeFunction(options) {
  const planningCenterSecrets =
    Array.isArray(options.planningCenterSecrets) ?
      options.planningCenterSecrets :
      [];

  return onRequest(
      {
        region: "us-central1",
        cors: true,
        secrets: [
          ...planningCenterSecrets,
          options.calendarSigningKey,
        ],
      },
      createPrintModeHandler(options),
  );
}

export function createPrintModeHandler(options) {
  const admin = options.admin;
  const firestore = options.firestore;
  const planningCenter = options.planningCenter;
  const getFirestoreEventOverrides =
    typeof options.getFirestoreEventOverrides === "function" ?
      options.getFirestoreEventOverrides :
      async () => [];

  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    const idToken = getBearerToken_(request.headers.authorization);
    if (!idToken) {
      response.status(401).json({
        error: "Missing Firebase ID token. Sign in again and retry.",
      });
      return;
    }

    let decodedToken = null;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      response.status(401).json({
        error: "Your Firebase sign-in expired. Sign in again and retry.",
      });
      return;
    }

    try {
      const actor = await verifyPrintModeAccess_(
          decodedToken,
          request.method === "POST",
          options,
      );

      if (request.method === "GET") {
        const [
          snapshot,
          roomRulesOverride,
          eventOverrides,
          campaignsOverride,
          serveNeedsOverride,
        ] = await Promise.all([
          firestore.doc(PRINT_MODE_SETTINGS_DOC_PATH).get(),
          options.getFirestoreRoomRulesOverride(),
          getFirestoreEventOverrides(),
          options.getFirestoreCampaignsOverride(),
          options.getFirestoreServeNeedsOverride(),
        ]);
        const roomRules = roomRulesOverride.shouldOverride ?
          roomRulesOverride.items :
          options.getDefaultRoomRules();
        const config = normalizePrintModePayload(
            snapshot.exists ? snapshot.data() : {},
        );
        const refreshPlanningCenter = isTruthyValue_(
            request.query && request.query.refresh,
        );
        const planningCenterResult = refreshPlanningCenter ?
          await planningCenter.refresh(roomRules, eventOverrides) :
          await planningCenter.getCached(roomRules, config, eventOverrides);
        const planningCenterData = planningCenterResult.data;
        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          config: config,
          events: planningCenterData.events,
          content: {
            featuredEvent: planningCenterData.featuredEvent,
            campaigns: campaignsOverride.shouldOverride ?
              campaignsOverride.items :
              [],
            serveNeeds: serveNeedsOverride.shouldOverride ?
              serveNeedsOverride.items :
              [],
          },
          sync: {
            status: planningCenterResult.status,
            fetchedAtMs: planningCenterResult.fetchedAtMs,
          },
        });
        return;
      }

      const action = normalizePrintModeText(
          request.body && request.body.action,
          40,
      );
      if (action === "uploadFallbackImage") {
        const uploadResult = await uploadPrintModeFallbackImage({
          sourceData: request.body,
          actor,
          admin,
        });
        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          imageUrl: uploadResult.imageUrl,
          storagePath: uploadResult.storagePath,
          message: "Print Mode welcome image uploaded.",
        });
        return;
      }

      const config = normalizePrintModePayload(
          request.body && typeof request.body === "object" ?
            request.body :
            {},
      );
      await firestore.doc(PRINT_MODE_SETTINGS_DOC_PATH).set({
        ...config,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByEmail: actor.email,
      });

      await writePrintModeAuditLog_(actor, config.events.length, options);

      response.set("Cache-Control", "no-store");
      response.status(200).json({
        ok: true,
        config: config,
        message: "Print Mode settings saved.",
      });
    } catch (error) {
      response.status(getPrintModeStatusCode(error)).json({
        error: getPrintModeErrorMessage(error),
        code: error && error.code ? error.code : "",
      });
    }
  };
}

async function verifyPrintModeAccess_(decodedToken, requireEdit, options) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedAdminEmail_(email, options)) {
    throw createPrintModeError(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account " +
          "to manage Print Mode.",
    );
  }

  const userSnapshot = await options.firestore
      .doc(getAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createPrintModeError(
        "admin-access-required",
        "Your admin access record must be active before you can use " +
          "Print Mode.",
    );
  }

  const pageAccess = userSnapshot.get("pageAccess") || {};
  const permission = getManagedSectionPermission_(
      pageAccess,
      "bulletin",
      "settings",
  );
  const canRead = permission === "view" ||
    permission === "propose" ||
    canPublishWithPermission_(permission);
  const allowed = requireEdit ?
    canPublishWithPermission_(permission) :
    canRead;

  if (!allowed) {
    throw createPrintModeError(
        "bulletin-mode-forbidden",
        requireEdit ?
          "Your current admin access level does not allow saving Print Mode " +
            "settings." :
          "Your current admin access level does not allow viewing Print Mode.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

async function writePrintModeAuditLog_(actor, eventCount, options) {
  try {
    await options.firestore.collection(ADMIN_AUDIT_LOG_COLLECTION_PATH).add({
      action: "saveBulletinMode",
      target: "admin",
      section: "bulletin",
      operation: "save",
      itemCount: Number(eventCount || 0),
      message: "Print Mode settings saved.",
      actorUid: String(actor && actor.uid || "").trim(),
      actorEmail: String(actor && actor.email || "").trim(),
      actorDisplayName: String(actor && actor.displayName || "").trim(),
      createdAt: options.admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Bulletin Mode audit log failed.", error);
  }
}

function getBearerToken_(authorizationHeader) {
  const rawHeader = String(authorizationHeader || "").trim();
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getAdminUserDocPath_(uid) {
  return ADMIN_USERS_COLLECTION_PATH + "/" + String(uid || "").trim();
}

function normalizeAdminEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function isAllowedAdminEmail_(email, options) {
  if (!email) return false;

  const allowedEmails = Array.isArray(options.allowedAdminEmails) ?
    options.allowedAdminEmails :
    [];
  if (allowedEmails.includes(email)) {
    return true;
  }

  const allowedDomains = Array.isArray(options.allowedAdminEmailDomains) ?
    options.allowedAdminEmailDomains :
    [];
  return allowedDomains.some((domain) => {
    return email.endsWith("@" + domain);
  });
}

function getManagedSectionPermission_(pageAccess, key, fallbackKey) {
  if (
    pageAccess &&
    typeof pageAccess === "object" &&
    Object.prototype.hasOwnProperty.call(pageAccess, key)
  ) {
    return normalizePermission_(pageAccess[key]);
  }

  if (fallbackKey) {
    return normalizePermission_(pageAccess && pageAccess[fallbackKey]);
  }

  return "none";
}

function normalizePermission_(value) {
  return String(value || "none").trim().toLowerCase() || "none";
}

function canPublishWithPermission_(permission) {
  return permission === "edit" ||
    permission === "approve" ||
    permission === "admin";
}

function isTruthyValue_(value) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" ||
    normalized === "1" ||
    normalized === "yes";
}
