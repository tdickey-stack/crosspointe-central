import {onRequest} from "firebase-functions/v2/https";

export const STUDIO_PLANNING_CENTER_LOOKAHEAD_DAYS = 60;

const STUDIO_VIEW_PERMISSIONS = new Set([
  "view",
  "propose",
  "edit",
  "approve",
  "admin",
]);

export function getStudioPermission(userData) {
  if (!userData || userData.active !== true) return "none";
  const pageAccess =
    userData.pageAccess && typeof userData.pageAccess === "object" ?
      userData.pageAccess :
      {};
  return String(pageAccess.studio || pageAccess.settings || "none")
      .trim()
      .toLowerCase();
}

export function hasStudioEventLookupAccess(userData) {
  return STUDIO_VIEW_PERMISSIONS.has(getStudioPermission(userData));
}

export function createStudioPlanningCenterEventsFunction(options) {
  return onRequest(
      {
        region: "us-central1",
        cors: true,
        secrets: Array.isArray(options.planningCenterSecrets) ?
        options.planningCenterSecrets :
        [],
      },
      createStudioPlanningCenterEventsHandler(options),
  );
}

export function createStudioPlanningCenterEventsHandler(options) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      if (!isLocalPreviewRequest(request, options)) {
        await verifyStudioUser(request, options);
      }

      const [roomRulesOverride, eventOverrides] = await Promise.all([
        options.getFirestoreRoomRulesOverride(),
        options.getFirestoreEventOverrides(),
      ]);
      const roomRules = roomRulesOverride.shouldOverride ?
        roomRulesOverride.items :
        options.getDefaultRoomRules();
      const events = await options.getCentralCalendarEvents(
        Array.isArray(roomRules) ? roomRules : [],
        STUDIO_PLANNING_CENTER_LOOKAHEAD_DAYS,
        {},
        Array.isArray(eventOverrides) ? eventOverrides : [],
      );

      response.status(200).json({
        ok: true,
        lookaheadDays: STUDIO_PLANNING_CENTER_LOOKAHEAD_DAYS,
        events,
      });
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      response.status(status).json({
        error:
          status >= 500 ?
            "Central Studio could not load Planning Center events." :
            error.message,
      });
    }
  };
}

function isLocalPreviewRequest(request, options) {
  return (
    options.allowLocalPreview === true &&
    process.env.FUNCTIONS_EMULATOR === "true" &&
    String(request.get("x-central-studio-preview") || "") === "1"
  );
}

async function verifyStudioUser(request, options) {
  const authorization = String(request.get("authorization") || "");
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Sign in to Central Studio first.");
    error.statusCode = 401;
    throw error;
  }

  let decodedToken;
  try {
    decodedToken = await options.admin
        .auth()
        .verifyIdToken(authorization.slice(7));
  } catch {
    const error = new Error("Your Studio session expired. Sign in again.");
    error.statusCode = 401;
    throw error;
  }

  const snapshot = await options.firestore
      .doc(`centralAdmin/root/users/${decodedToken.uid}`)
      .get();
  const userData = snapshot.exists ? snapshot.data() || {} : null;
  if (!hasStudioEventLookupAccess(userData)) {
    const error = new Error(
        "This account does not have access to Central Studio.",
    );
    error.statusCode = 403;
    throw error;
  }
}
