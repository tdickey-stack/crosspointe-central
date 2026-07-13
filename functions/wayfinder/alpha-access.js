import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";

export const WAYFINDER_SETTINGS_DOC_PATH =
  "centralApp/root/public/settings";

export async function getWayfinderAlphaConfig(firestore) {
  const snapshot = await firestore.doc(WAYFINDER_SETTINGS_DOC_PATH).get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return {
    enabled: data.wayfinder_enabled === true,
    accessMode: "admin_session_alpha",
  };
}

export function createWayfinderAlphaAccessHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET") {
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
      const config = await getWayfinderAlphaConfig(dependencies.firestore);
      response.status(200).json({
        ok: true,
        enabled: config.enabled,
        accessMode: config.accessMode,
        permission: authResult.permission,
        canUse: config.enabled,
        canAdmin: config.enabled && authResult.permission === "admin",
      });
    } catch (error) {
      response.status(Number(error && error.statusCode) || 503).json({
        error: error && error.statusCode ?
          String(error.message || "Wayfinder access denied.") :
          "Wayfinder access could not be verified.",
      });
    }
  };
}

export function createWayfinderAlphaSettingsHandler(dependencies) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "POST") {
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
            "Only a Wayfinder Admin can change alpha access.",
        );
      }

      if (request.method === "POST") {
        if (!request.body || typeof request.body.enabled !== "boolean") {
          throw createWayfinderAccessError(
              400,
              "Choose whether Wayfinder should be enabled or disabled.",
          );
        }
        await dependencies.firestore.doc(WAYFINDER_SETTINGS_DOC_PATH).set({
          wayfinder_enabled: request.body.enabled,
          wayfinder_access_mode: "admin_session_alpha",
          wayfinder_updated_by_uid: authResult.decodedToken.uid,
          wayfinder_updated_by_email: String(
              authResult.decodedToken.email || "",
          ).trim().toLowerCase(),
          wayfinder_updated_at:
            dependencies.admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
      }

      const config = await getWayfinderAlphaConfig(dependencies.firestore);
      response.status(200).json({
        ok: true,
        enabled: config.enabled,
        accessMode: config.accessMode,
        message: config.enabled ?
          "Wayfinder staff alpha is enabled." :
          "Wayfinder staff alpha is disabled.",
      });
    } catch (error) {
      response.status(Number(error && error.statusCode) || 503).json({
        error: error && error.statusCode ?
          String(error.message || "Wayfinder settings access denied.") :
          "Wayfinder settings could not be updated.",
      });
    }
  };
}
