import {createHash, randomBytes} from "node:crypto";

export const SHARE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const STUDIO_EDIT_PERMISSIONS = new Set([
  "propose",
  "edit",
  "approve",
  "admin",
]);
export const STUDIO_VIEW_PERMISSIONS = new Set([
  "view",
  ...STUDIO_EDIT_PERMISSIONS,
]);

export function studioPermission(userData) {
  const pageAccess =
    userData?.pageAccess && typeof userData.pageAccess === "object"
      ? userData.pageAccess
      : {};
  return String(pageAccess.studio || pageAccess.settings || "none")
    .trim()
    .toLowerCase();
}

export function hasStudioAccess(userData, requireEdit = false) {
  if (!userData || userData.active !== true) return false;
  const permission = studioPermission(userData);
  return (requireEdit ? STUDIO_EDIT_PERMISSIONS : STUDIO_VIEW_PERMISSIONS).has(
    permission,
  );
}

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function membershipId(uid, projectId) {
  return `${uid}_${projectId}`;
}

export function isSafeUnsplashDownloadUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      url.protocol === "https:" &&
      url.hostname === "api.unsplash.com" &&
      /^\/photos\/[^/]+\/download$/.test(url.pathname)
    );
  } catch (error) {
    return false;
  }
}

export function buildStudioShareUrl(request, token) {
  const configured = String(process.env.STUDIO_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const forwardedHost = String(
    request.get("x-forwarded-host") || request.get("host") || "",
  ).trim();
  const forwardedProtocol = String(
    request.get("x-forwarded-proto") || request.protocol || "https",
  ).trim();
  const base = configured || `${forwardedProtocol}://${forwardedHost}`;
  return `${base}/studio?share=${encodeURIComponent(token)}`;
}

export function unsplashPhotoResult(photo) {
  return {
    id: String(photo?.id || ""),
    alt: String(photo?.alt_description || photo?.description || ""),
    color: String(photo?.color || ""),
    width: Number(photo?.width || 0),
    height: Number(photo?.height || 0),
    imageUrl: String(photo?.urls?.regular || ""),
    exportImageUrl: String(photo?.urls?.full || photo?.urls?.raw || ""),
    thumbnailUrl: String(photo?.urls?.small || ""),
    downloadLocation: String(photo?.links?.download_location || ""),
    photoUrl: appendUnsplashUtm(photo?.links?.html),
    photographerName: String(photo?.user?.name || ""),
    photographerUrl: appendUnsplashUtm(photo?.user?.links?.html),
  };
}

function appendUnsplashUtm(value) {
  try {
    const url = new URL(String(value || ""));
    url.searchParams.set("utm_source", "crosspointe_central_studio");
    url.searchParams.set("utm_medium", "referral");
    return url.toString();
  } catch (error) {
    return "";
  }
}
