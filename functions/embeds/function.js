/* eslint-disable require-jsdoc */

import crypto from "node:crypto";

import {onRequest} from "firebase-functions/v2/https";

import {
  createCentralEmbedError,
  getCentralEmbedErrorMessage,
  getCentralEmbedStatusCode,
} from "./errors.js";
import {
  CENTRAL_EMBED_COLLECTION_PATH,
  CENTRAL_EMBED_LAYOUT_STANDARD,
  CENTRAL_EMBED_TYPE_EVENTS,
  flattenCentralEmbedSourceEvents,
  normalizeCentralEmbedDraft,
  normalizeCentralEmbedId,
  normalizeCentralEmbedName,
  serializeCentralEmbedAdminRecord,
} from "./payload.js";
import {
  renderCentralEmbedHtml,
  resolveCentralEmbedEvents,
} from "./render.js";
import {uploadCentralEmbedImage} from "./storage.js";

const ADMIN_USERS_COLLECTION_PATH = "centralAdmin/root/users";
const ADMIN_AUDIT_LOG_COLLECTION_PATH = "centralAdmin/root/auditLog";

export function createCentralEmbedsAdminFunction(options) {
  const planningCenterSecrets = Array.isArray(options.planningCenterSecrets) ?
    options.planningCenterSecrets :
    [];
  return onRequest({
    region: "us-central1",
    cors: true,
    secrets: planningCenterSecrets,
  }, createCentralEmbedsAdminHandler(options));
}

export function createCentralEmbedPublicFunction(options) {
  const planningCenterSecrets = Array.isArray(options.planningCenterSecrets) ?
    options.planningCenterSecrets :
    [];
  return onRequest({
    region: "us-central1",
    cors: true,
    secrets: planningCenterSecrets,
  }, createCentralEmbedPublicHandler(options));
}

export function createCentralEmbedsAdminHandler(options) {
  const firestore = options.firestore;

  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const actor = await verifyAdminAccess_(
          request,
          request.method === "POST",
          options,
      );

      if (request.method === "GET") {
        const embedId = normalizeCentralEmbedId(
            request.query && request.query.id,
        );
        const [embeds, sourceResult] = await Promise.all([
          loadAdminEmbeds_(firestore, embedId),
          loadSourceEvents_(
              options,
              isTruthy_(request.query && request.query.refresh),
          ),
        ]);
        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          embeds,
          events: flattenCentralEmbedSourceEvents(sourceResult.data.events),
          sync: {
            status: sourceResult.status,
            fetchedAtMs: sourceResult.fetchedAtMs,
          },
        });
        return;
      }

      const body = request.body && typeof request.body === "object" ?
        request.body :
        {};
      const action = String(body.action || "").trim();
      const result = await handleAdminAction_(action, body, actor, options);
      response.set("Cache-Control", "no-store");
      response.status(200).json({ok: true, ...result});
    } catch (error) {
      response.status(getCentralEmbedStatusCode(error)).json({
        error: getCentralEmbedErrorMessage(error),
        code: error && error.code || "",
      });
    }
  };
}

export function createCentralEmbedPublicHandler(options) {
  return async (request, response) => {
    if (request.method !== "GET") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const requestInfo = parsePublicEmbedRequest_(request);
      if (!requestInfo.embedId) {
        throw createCentralEmbedError(
            "invalid-payload",
            "A valid Central Embed ID is required.",
        );
      }

      const snapshot = await options.firestore
          .collection(CENTRAL_EMBED_COLLECTION_PATH)
          .doc(requestInfo.embedId)
          .get();
      if (!snapshot.exists) {
        throw createCentralEmbedError("not-found", "Embed not found.");
      }
      const data = snapshot.data() || {};
      if (!data.published || typeof data.published !== "object") {
        throw createCentralEmbedError(
            "not-published",
            "This embed has not been published.",
        );
      }

      const published = normalizeCentralEmbedDraft(data.published);
      const sourceResult = await loadSourceEvents_(options, false);
      const events = resolveCentralEmbedEvents(
          published,
          sourceResult.data.events,
      );
      response.set("Cache-Control", "no-store");

      if (requestInfo.format === "html") {
        response.type("html").status(200).send(renderCentralEmbedHtml(
            requestInfo.embedId,
            events,
            {
              includeStyles: requestInfo.includeStyles,
              layout: published.layout,
              stylesUrl: getRequestOrigin_(request) + "/embed.css",
            },
        ));
        return;
      }

      response.status(200).json({
        schemaVersion: 1,
        id: requestInfo.embedId,
        type: CENTRAL_EMBED_TYPE_EVENTS,
        layout: published.layout,
        publishedVersion: Math.max(1, Number(data.publishedVersion) || 1),
        events,
      });
    } catch (error) {
      const status = getCentralEmbedStatusCode(error);
      response.set("Cache-Control", status === 404 ?
        "public, max-age=30" :
        "no-store");
      response.status(status).json({
        error: getCentralEmbedErrorMessage(error),
        code: error && error.code || "",
      });
    }
  };
}

async function handleAdminAction_(action, body, actor, options) {
  const collection = options.firestore.collection(
      CENTRAL_EMBED_COLLECTION_PATH,
  );

  if (action === "create") {
    const name = normalizeCentralEmbedName(body.name);
    if (!name) {
      throw createCentralEmbedError(
          "invalid-payload",
          "Give the embed an internal name.",
      );
    }
    const embedId = createEmbedId_();
    const docRef = collection.doc(embedId);
    await docRef.create({
      schemaVersion: 1,
      type: CENTRAL_EMBED_TYPE_EVENTS,
      name,
      draft: {layout: CENTRAL_EMBED_LAYOUT_STANDARD, items: []},
      published: null,
      publishedVersion: 0,
      createdAt: options.admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: options.admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email,
    });
    await writeAuditLog_(actor, "createEmbed", embedId, 0, options);
    const created = await docRef.get();
    return {
      embed: serializeCentralEmbedAdminRecord(created),
      message: "Event Embed created.",
    };
  }

  const embedId = normalizeCentralEmbedId(body.id);
  if (!embedId) {
    throw createCentralEmbedError(
        "invalid-payload",
        "A valid Central Embed ID is required.",
    );
  }
  const docRef = collection.doc(embedId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw createCentralEmbedError("not-found", "Embed not found.");
  }

  if (action === "uploadImage") {
    const image = await uploadCentralEmbedImage({
      sourceData: body,
      embedId,
      actor,
      admin: options.admin,
    });
    return {image, message: "Embed event graphic uploaded."};
  }

  if (action === "delete") {
    await docRef.delete();
    await writeAuditLog_(actor, "deleteEmbed", embedId, 0, options);
    return {id: embedId, message: "Embed deleted."};
  }

  if (action === "rename") {
    const name = normalizeCentralEmbedName(body.name);
    if (!name) {
      throw createCentralEmbedError(
          "invalid-payload",
          "Give the embed an internal name.",
      );
    }
    await docRef.set({
      name,
      updatedAt: options.admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByEmail: actor.email,
    }, {merge: true});
    await writeAuditLog_(actor, "renameEmbed", embedId, 0, options);
    return {id: embedId, name, message: "Embed renamed."};
  }

  if (action === "duplicate") {
    const source = serializeCentralEmbedAdminRecord(snapshot);
    const duplicateId = createEmbedId_();
    const duplicateRef = collection.doc(duplicateId);
    await duplicateRef.create({
      schemaVersion: 1,
      type: CENTRAL_EMBED_TYPE_EVENTS,
      name: normalizeCentralEmbedName(source.name + " Copy"),
      draft: source.draft,
      published: null,
      publishedVersion: 0,
      createdAt: options.admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: options.admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email,
    });
    await writeAuditLog_(
        actor,
        "duplicateEmbed",
        duplicateId,
        source.draft.items.length,
        options,
    );
    const duplicate = await duplicateRef.get();
    return {
      embed: serializeCentralEmbedAdminRecord(duplicate),
      message: "Embed duplicated as a new draft.",
    };
  }

  if (action === "saveDraft" || action === "publish") {
    const name = normalizeCentralEmbedName(body.name);
    const draft = normalizeCentralEmbedDraft(body);
    if (!name) {
      throw createCentralEmbedError(
          "invalid-payload",
          "Give the embed an internal name.",
      );
    }
    if (action === "publish" && !draft.items.length) {
      throw createCentralEmbedError(
          "invalid-payload",
          "Select at least one event before publishing.",
      );
    }

    const nextData = {
      name,
      type: CENTRAL_EMBED_TYPE_EVENTS,
      draft,
      updatedAt: options.admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByEmail: actor.email,
    };
    if (action === "publish") {
      nextData.published = draft;
      nextData.publishedAt =
        options.admin.firestore.FieldValue.serverTimestamp();
      nextData.publishedVersion =
        Math.max(0, Number(snapshot.get("publishedVersion")) || 0) + 1;
    }
    await docRef.set(nextData, {merge: true});
    await writeAuditLog_(
        actor,
        action === "publish" ? "publishEmbed" : "saveEmbedDraft",
        embedId,
        draft.items.length,
        options,
    );
    const updated = await docRef.get();
    return {
      embed: serializeCentralEmbedAdminRecord(updated),
      message: action === "publish" ?
        "Embed published. Existing embed code now uses this version." :
        "Draft saved without changing the live embed.",
    };
  }

  throw createCentralEmbedError(
      "invalid-payload",
      "Unsupported Central Embeds action.",
  );
}

async function verifyAdminAccess_(request, requireEdit, options) {
  const token = getBearerToken_(
      request.headers && request.headers.authorization,
  );
  if (!token) {
    throw createCentralEmbedError(
        "auth-required",
        "Sign in to Central Admin and try again.",
    );
  }
  let decoded = null;
  try {
    decoded = await options.admin.auth().verifyIdToken(token);
  } catch (error) {
    throw createCentralEmbedError(
        "auth-required",
        "Your Firebase sign-in expired. Sign in again and retry.",
    );
  }

  const email = String(decoded.email || "").trim().toLowerCase();
  if (!isAllowedAdminEmail_(email, options)) {
    throw createCentralEmbedError(
        "access-required",
        "Use an approved CrossPointe account to manage Central Embeds.",
    );
  }
  const userSnapshot = await options.firestore
      .doc(ADMIN_USERS_COLLECTION_PATH + "/" + decoded.uid)
      .get();
  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createCentralEmbedError(
        "access-required",
        "Your Central Admin access record must be active.",
    );
  }
  const pageAccess = userSnapshot.get("pageAccess") || {};
  const permission = normalizePermission_(
      Object.prototype.hasOwnProperty.call(pageAccess, "embeds") ?
        pageAccess.embeds :
        pageAccess.settings,
  );
  const canRead = ["view", "propose", "edit", "approve", "admin"]
      .includes(permission);
  const canEdit = ["edit", "approve", "admin"].includes(permission);
  if (requireEdit ? !canEdit : !canRead) {
    throw createCentralEmbedError(
        "forbidden",
        requireEdit ?
          "Your Central Admin access does not allow editing embeds." :
          "Your Central Admin access does not allow viewing embeds.",
    );
  }

  return {
    uid: String(decoded.uid || "").trim(),
    email,
    displayName: String(
        decoded.name || userSnapshot.get("displayName") || "",
    ).trim(),
  };
}

async function loadAdminEmbeds_(firestore, embedId) {
  if (embedId) {
    const snapshot = await firestore
        .collection(CENTRAL_EMBED_COLLECTION_PATH)
        .doc(embedId)
        .get();
    if (!snapshot.exists) {
      throw createCentralEmbedError("not-found", "Embed not found.");
    }
    return [serializeCentralEmbedAdminRecord(snapshot)];
  }
  const snapshot = await firestore
      .collection(CENTRAL_EMBED_COLLECTION_PATH)
      .get();
  return snapshot.docs.map(serializeCentralEmbedAdminRecord).sort((a, b) => {
    return String(b.updatedAt || b.createdAt)
        .localeCompare(String(a.updatedAt || a.createdAt));
  });
}

async function loadSourceEvents_(options, refresh) {
  const [roomRulesOverride, eventOverrides] = await Promise.all([
    options.getFirestoreRoomRulesOverride(),
    options.getFirestoreEventOverrides(),
  ]);
  const roomRules = roomRulesOverride.shouldOverride ?
    roomRulesOverride.items :
    options.getDefaultRoomRules();
  return refresh ?
    options.planningCenter.refresh(roomRules, eventOverrides) :
    options.planningCenter.getCached(roomRules, {}, eventOverrides);
}

async function writeAuditLog_(actor, action, embedId, itemCount, options) {
  try {
    await options.firestore.collection(ADMIN_AUDIT_LOG_COLLECTION_PATH).add({
      action,
      target: embedId,
      section: "embeds",
      operation: action,
      itemCount: Number(itemCount) || 0,
      message: "Central Embed updated.",
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorDisplayName: actor.displayName,
      createdAt: options.admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Central Embeds audit log failed.", error);
  }
}

function parsePublicEmbedRequest_(request) {
  const queryId = request.query && request.query.id;
  const path = String(request.path || request.originalUrl || "").split("?")[0];
  const match = path.match(/\/(embed_[a-z0-9]{12,32})(?:\.(json|html))?\/?$/i);
  const extension = match && match[2] ? match[2].toLowerCase() : "";
  const queryFormat = String(request.query && request.query.format || "")
      .trim()
      .toLowerCase();
  return {
    embedId: normalizeCentralEmbedId(queryId || match && match[1]),
    format: extension === "html" || queryFormat === "html" ? "html" : "json",
    includeStyles: !(
      request.query && String(request.query.styles || "") === "0"
    ),
  };
}

function getRequestOrigin_(request) {
  const forwardedProto = String(
      request.get && request.get("x-forwarded-proto") || "",
  )
      .split(",")[0]
      .trim();
  const protocol = forwardedProto || request.protocol || "https";
  const host = String(request.get && request.get("host") || "").trim();
  return host ? protocol + "://" + host : "https://central.crosspointe.tv";
}

function createEmbedId_() {
  return "embed_" + crypto.randomBytes(9).toString("hex");
}

function getBearerToken_(header) {
  const match = String(header || "").trim().match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function normalizePermission_(value) {
  return String(value || "none").trim().toLowerCase();
}

function isAllowedAdminEmail_(email, options) {
  if (!email) return false;
  const emails = Array.isArray(options.allowedAdminEmails) ?
    options.allowedAdminEmails :
    [];
  const domains = Array.isArray(options.allowedAdminEmailDomains) ?
    options.allowedAdminEmailDomains :
    [];
  return emails.includes(email) ||
    domains.some((domain) => email.endsWith("@" + domain));
}

function isTruthy_(value) {
  return ["1", "true", "yes", "on"].includes(
      String(value || "").trim().toLowerCase(),
  );
}
