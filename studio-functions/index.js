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
  isPublishedPlanningCenterGroup,
  isSafePlanningCenterGroupImageUrl,
  isSafePlanningCenterGroupsUrl,
  isSafeUnsplashDownloadUrl,
  membershipId,
  planningCenterGroupResult,
  unsplashPhotoResult,
} from "./studio-core.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const unsplashAccessKey = defineSecret("UNSPLASH_ACCESS_KEY");
const pcoAppId = defineSecret("PCO_APP_ID");
const pcoSecret = defineSecret("PCO_SECRET");
const region = "us-central1";
let planningCenterGroupsCache = {expiresAt: 0, groups: []};

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

async function callPlanningCenterGroups(url, appId, secret) {
  if (!isSafePlanningCenterGroupsUrl(url)) {
    const error = new Error("Planning Center returned an invalid page URL.");
    error.status = 502;
    throw error;
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const error = new Error(`Planning Center returned ${response.status}.`);
    error.status = [401, 403].includes(response.status) ? 503 : 502;
    throw error;
  }
  return response.json();
}

async function loadPublishedPlanningCenterGroups(appId, secret) {
  if (
    planningCenterGroupsCache.expiresAt > Date.now() &&
    planningCenterGroupsCache.groups.length
  ) {
    return planningCenterGroupsCache.groups;
  }
  const start = new URL(
    "https://api.planningcenteronline.com/groups/v2/groups",
  );
  start.searchParams.set("filter", "published");
  start.searchParams.set("include", "group_type");
  start.searchParams.set("order", "name");
  start.searchParams.set("per_page", "100");
  const pages = [];
  let nextUrl = start.toString();
  for (let page = 0; nextUrl && page < 5; page += 1) {
    const payload = await callPlanningCenterGroups(nextUrl, appId, secret);
    pages.push(payload);
    nextUrl =
      typeof payload?.links?.next === "string" &&
      isSafePlanningCenterGroupsUrl(payload.links.next)
        ? payload.links.next
        : "";
  }
  const groupTypes = new Map();
  pages.forEach((payload) => {
    (Array.isArray(payload.included) ? payload.included : []).forEach((item) => {
      if (item?.type !== "GroupType" || !item.id) return;
      const attributes = item.attributes || {};
      if (attributes.church_center_visible === false) return;
      groupTypes.set(String(item.id), String(attributes.name || ""));
    });
  });
  const groups = pages
    .flatMap((payload) => (Array.isArray(payload.data) ? payload.data : []))
    .filter(isPublishedPlanningCenterGroup)
    .map((group) => planningCenterGroupResult(group, groupTypes))
    .filter((group) => group.id && group.name && group.publicUrl)
    .sort((a, b) => a.name.localeCompare(b.name));
  planningCenterGroupsCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    groups,
  };
  return groups;
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

export const studioPlanningCenterGroups = onRequest(
  {
    region,
    secrets: [pcoAppId, pcoSecret],
    timeoutSeconds: 30,
  },
  async (request, response) => {
    if (!allowRequest(request, response, ["GET"])) return;
    try {
      await requireStudioUser(request, false, true);
      const appId = String(pcoAppId.value() || "").trim();
      const secret = String(pcoSecret.value() || "").trim();
      if (!appId || !secret) {
        const error = new Error(
          "Planning Center Groups is not configured for Studio yet.",
        );
        error.status = 503;
        throw error;
      }
      const query = String(request.query.q || "")
        .trim()
        .toLowerCase()
        .slice(0, 100);
      const allGroups = await loadPublishedPlanningCenterGroups(appId, secret);
      const matchingGroups = query
        ? allGroups.filter((group) =>
            [
              group.name,
              group.description,
              group.schedule,
              group.typeName,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
        : allGroups;
      sendJson(response, 200, {
        total: matchingGroups.length,
        groups: matchingGroups.slice(0, 100),
      });
    } catch (error) {
      handleError(response, error, "Studio Planning Center Groups failed");
    }
  },
);

export const studioPlanningCenterImage = onRequest(
  {region, timeoutSeconds: 30},
  async (request, response) => {
    if (!allowRequest(request, response, ["GET"])) return;
    try {
      await requireStudioUser(request, false, true);
      const imageUrl = String(request.query.url || "").trim();
      if (!isSafePlanningCenterGroupImageUrl(imageUrl)) {
        sendJson(response, 400, {error: "Invalid Planning Center image URL."});
        return;
      }
      const upstream = await fetch(imageUrl, {
        headers: {Accept: "image/avif,image/webp,image/png,image/jpeg"},
        redirect: "error",
      });
      if (!upstream.ok) {
        const error = new Error(`Planning Center image returned ${upstream.status}.`);
        error.status = 502;
        throw error;
      }
      const contentType = String(upstream.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType)) {
        const error = new Error("Planning Center returned an unsupported image.");
        error.status = 502;
        throw error;
      }
      const declaredSize = Number(upstream.headers.get("content-length") || 0);
      if (declaredSize >= 8 * 1024 * 1024) {
        const error = new Error("Planning Center returned an image that is too large.");
        error.status = 502;
        throw error;
      }
      const image = Buffer.from(await upstream.arrayBuffer());
      if (!image.length || image.length >= 8 * 1024 * 1024) {
        const error = new Error("Planning Center returned an invalid image.");
        error.status = 502;
        throw error;
      }
      response
        .status(200)
        .set("Content-Type", contentType)
        .set("Cache-Control", "private, max-age=3600")
        .set("Content-Length", String(image.length))
        .send(image);
    } catch (error) {
      handleError(response, error, "Studio Planning Center image failed");
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
      const [memberships, shares, pages] = await Promise.all([
        db
          .collection("centralStudioMemberships")
          .where("projectId", "==", projectId)
          .get(),
        db.collection("centralStudioShares").where("projectId", "==", projectId).get(),
        projectRef.collection("pages").get(),
      ]);
      const batch = db.batch();
      memberships.docs.forEach((document) => batch.delete(document.ref));
      shares.docs.forEach((document) => batch.delete(document.ref));
      pages.docs.forEach((document) => batch.delete(document.ref));
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
