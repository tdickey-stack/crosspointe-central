const ALLOWED_PERMISSIONS = new Set([
  "view",
  "admin",
]);

export async function authenticateWayfinderAdminRequest(options) {
  const request = options.request;
  const admin = options.admin;
  const firestore = options.firestore;
  const isAllowedAdminEmail = options.isAllowedAdminEmail;
  const getAdminUserDocPath = options.getAdminUserDocPath;
  const token = getBearerToken_(request.headers.authorization);

  if (!token) {
    throw createWayfinderAccessError(
        401,
        "Missing Firebase ID token. Sign in again and retry.",
    );
  }

  let decodedToken = null;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    throw createWayfinderAccessError(
        401,
        "Your Firebase sign-in expired. Sign in again and retry.",
    );
  }

  const email = String(decodedToken && decodedToken.email || "")
      .trim()
      .toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    throw createWayfinderAccessError(
        403,
        "Use an approved CrossPointe admin account to test Wayfinder.",
    );
  }

  const userSnapshot = await firestore
      .doc(getAdminUserDocPath(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createWayfinderAccessError(
        403,
        "Your Central admin access must be active to test Wayfinder.",
    );
  }

  const pageAccess = userSnapshot.get("pageAccess") || {};
  const permission = String(
      pageAccess.wayfinder || "none",
  ).trim().toLowerCase();

  if (!ALLOWED_PERMISSIONS.has(permission)) {
    throw createWayfinderAccessError(
        403,
        "Your current admin access does not include the Wayfinder prototype.",
    );
  }

  return {
    decodedToken: decodedToken,
    permission: permission,
  };
}

export function createWayfinderAccessError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getBearerToken_(authorizationHeader) {
  const value = String(authorizationHeader || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}
