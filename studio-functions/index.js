import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";

import {
  SHARE_DURATION_MS,
  buildStudioShareUrl,
  createShareToken,
  hasStudioAccess,
  hashShareToken,
  isSafeUnsplashDownloadUrl,
  membershipId,
  unsplashPhotoResult,
} from "./studio-core.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const unsplashAccessKey = defineSecret("UNSPLASH_ACCESS_KEY");
const region = "us-central1";

function sendJson(response, status, body) {
  response.status(status).set("Cache-Control", "no-store").json(body);
}

function allowRequest(request, response, methods) {
  response.set("Vary", "Origin");
  if (request.method === "OPTIONS") {
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.set("Access-Control-Allow-Methods", `${methods.join(", ")}, OPTIONS`);
    response.status(204).send("");
    return false;
  }
  if (!methods.includes(request.method)) {
    sendJson(response, 405, {error: "Method not allowed."});
    return false;
  }
  return true;
}

function isLocalPreviewRequest(request) {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" &&
    request.get("x-central-studio-preview") === "1"
  );
}

async function requireStudioUser(
  request,
  requireEdit = false,
  allowLocalPreview = false,
) {
  if (allowLocalPreview && isLocalPreviewRequest(request)) {
    return {uid: "studio-local-preview"};
  }
  const authorization = String(request.get("authorization") || "");
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Sign in to Central Studio first.");
    error.status = 401;
    throw error;
  }
  const decoded = await getAuth().verifyIdToken(authorization.slice(7));
  const snapshot = await db.doc(`centralAdmin/root/users/${decoded.uid}`).get();
  if (!snapshot.exists || !hasStudioAccess(snapshot.data(), requireEdit)) {
    const error = new Error("This account does not have the required Studio access.");
    error.status = 403;
    throw error;
  }
  return decoded;
}

function handleError(response, error, label) {
  const status = Number(error?.status) || 500;
  if (status >= 500) {
    logger.error(label, {message: error?.message || String(error)});
  }
  sendJson(response, status, {
    error: status >= 500 ? "Central Studio could not complete that request." : error.message,
  });
}

async function callUnsplash(path, accessKey) {
  const response = await fetch(`https://api.unsplash.com${path}`, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
  });
  if (!response.ok) {
    const error = new Error(`Unsplash returned ${response.status}.`);
    error.status = response.status === 403 ? 503 : 502;
    throw error;
  }
  return response.json();
}

export const studioUnsplashSearch = onRequest(
  {region, secrets: [unsplashAccessKey], timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["GET"])) return;
    try {
      await requireStudioUser(request, false, true);
      const accessKey = String(unsplashAccessKey.value() || "").trim();
      if (!accessKey) {
        const error = new Error("Unsplash is not configured for Studio yet.");
        error.status = 503;
        throw error;
      }
      const query = String(request.query.q || "").trim().slice(0, 100);
      if (query.length < 2) {
        sendJson(response, 400, {error: "Enter at least two search characters."});
        return;
      }
      const page = Math.min(Math.max(Number(request.query.page) || 1, 1), 50);
      const orientation = ["landscape", "portrait", "squarish"].includes(
        request.query.orientation,
      )
        ? request.query.orientation
        : "";
      const params = new URLSearchParams({
        query,
        page: String(page),
        per_page: "18",
        content_filter: "high",
      });
      if (orientation) params.set("orientation", orientation);
      const data = await callUnsplash(`/search/photos?${params}`, accessKey);
      sendJson(response, 200, {
        total: Number(data.total || 0),
        totalPages: Number(data.total_pages || 0),
        results: Array.isArray(data.results)
          ? data.results.map(unsplashPhotoResult)
          : [],
      });
    } catch (error) {
      handleError(response, error, "Studio Unsplash search failed");
    }
  },
);

export const studioUnsplashTrackDownload = onRequest(
  {region, secrets: [unsplashAccessKey], timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["POST"])) return;
    try {
      await requireStudioUser(request, true, true);
      const accessKey = String(unsplashAccessKey.value() || "").trim();
      const downloadLocation = String(request.body?.downloadLocation || "");
      if (!accessKey || !isSafeUnsplashDownloadUrl(downloadLocation)) {
        sendJson(response, 400, {error: "Invalid Unsplash download location."});
        return;
      }
      const url = new URL(downloadLocation);
      const data = await callUnsplash(`${url.pathname}${url.search}`, accessKey);
      sendJson(response, 200, {url: String(data.url || "")});
    } catch (error) {
      handleError(response, error, "Studio Unsplash download tracking failed");
    }
  },
);

export const studioCreateShare = onRequest(
  {region, timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["POST"])) return;
    try {
      const user = await requireStudioUser(request, true);
      const projectId = String(request.body?.projectId || "").trim();
      const projectRef = db.doc(`centralStudioProjects/${projectId}`);
      const project = await projectRef.get();
      if (!project.exists || project.data().ownerUid !== user.uid) {
        sendJson(response, 404, {error: "Project not found."});
        return;
      }
      const token = createShareToken();
      const createdAt = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + SHARE_DURATION_MS);
      await db.doc(`centralStudioShares/${hashShareToken(token)}`).set({
        projectId,
        ownerUid: user.uid,
        permission: "edit",
        createdAt,
        expiresAt,
        revoked: false,
      });
      sendJson(response, 200, {
        shareUrl: buildStudioShareUrl(request, token),
        expiresAt: expiresAt.toDate().toISOString(),
      });
    } catch (error) {
      handleError(response, error, "Studio share creation failed");
    }
  },
);

export const studioAcceptShare = onRequest(
  {region, timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["POST"])) return;
    try {
      const user = await requireStudioUser(request, true);
      const token = String(request.body?.token || "");
      const shareRef = db.doc(`centralStudioShares/${hashShareToken(token)}`);
      const result = await db.runTransaction(async (transaction) => {
        const share = await transaction.get(shareRef);
        if (!share.exists) {
          const error = new Error("This Studio share link is invalid.");
          error.status = 404;
          throw error;
        }
        const shareData = share.data();
        if (
          shareData.revoked === true ||
          !shareData.expiresAt ||
          shareData.expiresAt.toMillis() <= Date.now()
        ) {
          const error = new Error("This Studio share link has expired.");
          error.status = 410;
          throw error;
        }
        const projectRef = db.doc(`centralStudioProjects/${shareData.projectId}`);
        const project = await transaction.get(projectRef);
        if (!project.exists || project.data().ownerUid !== shareData.ownerUid) {
          const error = new Error("The shared Studio project no longer exists.");
          error.status = 404;
          throw error;
        }
        if (shareData.ownerUid !== user.uid) {
          transaction.set(
            db.doc(
              `centralStudioMemberships/${membershipId(
                user.uid,
                shareData.projectId,
              )}`,
            ),
            {
              projectId: shareData.projectId,
              ownerUid: shareData.ownerUid,
              memberUid: user.uid,
              permission: "edit",
              createdAt: FieldValue.serverTimestamp(),
            },
            {merge: false},
          );
        }
        return {projectId: shareData.projectId};
      });
      sendJson(response, 200, result);
    } catch (error) {
      handleError(response, error, "Studio share acceptance failed");
    }
  },
);

export const studioLeaveProject = onRequest(
  {region, timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["POST"])) return;
    try {
      const user = await requireStudioUser(request);
      const projectId = String(request.body?.projectId || "").trim();
      await db
        .doc(`centralStudioMemberships/${membershipId(user.uid, projectId)}`)
        .delete();
      sendJson(response, 200, {projectId});
    } catch (error) {
      handleError(response, error, "Studio project leave failed");
    }
  },
);

export const studioDeleteProject = onRequest(
  {region, timeoutSeconds: 60},
  async (request, response) => {
    if (!allowRequest(request, response, ["POST"])) return;
    try {
      const user = await requireStudioUser(request, true);
      const projectId = String(request.body?.projectId || "").trim();
      const projectRef = db.doc(`centralStudioProjects/${projectId}`);
      const project = await projectRef.get();
      if (!project.exists || project.data().ownerUid !== user.uid) {
        sendJson(response, 404, {error: "Project not found."});
        return;
      }
      const [memberships, shares] = await Promise.all([
        db
          .collection("centralStudioMemberships")
          .where("projectId", "==", projectId)
          .get(),
        db.collection("centralStudioShares").where("projectId", "==", projectId).get(),
      ]);
      const batch = db.batch();
      memberships.docs.forEach((document) => batch.delete(document.ref));
      shares.docs.forEach((document) => batch.delete(document.ref));
      batch.delete(projectRef);
      await batch.commit();
      await getStorage()
        .bucket()
        .deleteFiles({prefix: `studio-projects/${projectId}/`});
      sendJson(response, 200, {projectId});
    } catch (error) {
      handleError(response, error, "Studio project deletion failed");
    }
  },
);
