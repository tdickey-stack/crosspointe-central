/* eslint-disable require-jsdoc */

import {HomePromotionError} from "./service.js";

export function createHomePromotionsHandler(options = {}) {
  const service = requireObject_(options.service, "service");
  const verifyAccess = requireFunction_(options.verifyAccess, "verifyAccess");
  const loadPublicData = requireFunction_(
      options.loadPublicData,
      "loadPublicData",
  );

  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    if (request.method !== "GET" && request.method !== "POST") {
      response.set("Allow", "GET, POST");
      response.status(405).json({
        error: "Method not allowed.",
        code: "method-not-allowed",
      });
      return;
    }

    try {
      const write = request.method === "POST";
      const actor = await verifyAccess(request, write);
      const publicData = await loadPublicData(request);

      if (!write) {
        const projection = await service.list(publicData);
        response.status(200).json({ok: true, ...projection});
        return;
      }

      const item = request.body && request.body.item;
      const saved = await service.save(item, actor, publicData);
      const projection = await service.list(publicData);
      const savedItem = projection.items.find((entry) => {
        return entry.id === saved.id;
      }) || saved;
      response.status(200).json({
        ok: true,
        ...projection,
        savedItem,
        message: "Home promotion saved.",
      });
    } catch (error) {
      const known = error instanceof HomePromotionError;
      const status = known ? error.status : normalizeExpectedStatus_(error);
      if (!known && status === 500) {
        console.error("Home promotion request failed.", {
          code: String(error && error.code || ""),
          message: String(error && error.message || ""),
        });
      }
      response.status(status).json({
        error: known ? error.message : getSafeErrorMessage_(status),
        code: known ? error.code : getSafeErrorCode_(error, status),
        ...(known && error.details && Object.keys(error.details).length ? {
          details: error.details,
        } : {}),
      });
    }
  };
}

function normalizeExpectedStatus_(error) {
  const status = Number(error && (error.status || error.statusCode));
  return [400, 401, 403, 404, 409].includes(status) ? status : 500;
}

function getSafeErrorMessage_(status) {
  if (status === 401) return "Sign in to Central Admin and try again.";
  if (status === 403) {
    return "Your current Admin access does not allow this action.";
  }
  if (status === 404) return "The requested promotion could not be found.";
  if (status === 409) return "The promotion changed. Refresh and try again.";
  if (status === 400) return "The promotion request is invalid.";
  return "Home promotions are temporarily unavailable.";
}

function getSafeErrorCode_(error, status) {
  const code = String(error && error.code || "").trim();
  if (/^[a-z][a-z0-9-]{0,79}$/.test(code) && status !== 500) return code;
  if (status === 401) return "firebase-auth-required";
  if (status === 403) return "home-promotions-forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "promotion-conflict";
  if (status === 400) return "invalid-payload";
  return "home-promotions-unavailable";
}

function requireObject_(value, label) {
  if (!value || typeof value !== "object") {
    throw new TypeError(label + " is required.");
  }
  return value;
}

function requireFunction_(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(label + " is required.");
  }
  return value;
}
