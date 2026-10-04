/* eslint-disable require-jsdoc */
import {validHeartbeat} from "./service.js";

const LIVE_HOSTS = new Set([
  "central.crosspointe.tv", "crosspointe-central.web.app",
  "crosspointe-central.firebaseapp.com",
]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function requestEnvironment(request, emulator = false) {
  const headers = request.headers || {};
  const rawHost = headers["x-forwarded-host"] || headers.host || "";
  if (typeof rawHost !== "string" || /[,\s/@?#]/.test(rawHost)) return "";
  let host;
  try {
    host = new URL("https://" + rawHost);
  } catch (error) {
    return "";
  }
  const local = emulator && LOCAL_HOSTS.has(host.hostname);
  const devPattern =
    /^crosspointe-central--dev-[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/;
  const dev = devPattern.test(host.hostname);
  if (!local && (!LIVE_HOSTS.has(host.hostname) && !dev || host.port)) {
    return "";
  }
  if (headers["sec-fetch-site"] === "cross-site") return "";
  const origin = headers.origin;
  // Same-origin fetch/beacon POSTs supply Origin. No wildcard CORS is enabled.
  if (!origin && request.method === "POST") return "";
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || parsed.host !== host.host ||
          (parsed.protocol !== "https:" &&
          !(local && parsed.protocol === "http:"))) return "";
    } catch (error) {
      return "";
    }
  }
  return local || dev ? "dev" : "live";
}

// Fixed memory limits and no stored IP addresses. This reduces accidental
// polling storms; it is not identity verification or a bot-proof count.
export function createPresenceLimiter({now = Date.now, totalLimit = 2400,
  sessionLimit = 20, maxSessions = 5000} = {}) {
  let windowStart = now();
  let total = 0;
  const sessions = new Map();
  return (sessionId = "") => {
    const time = now();
    if (time - windowStart >= 60000) {
      windowStart = time;
      total = 0;
      sessions.clear();
    }
    if (++total > totalLimit) return false;
    if (!sessionId) return true;
    if (!sessions.has(sessionId) && sessions.size >= maxSessions) return false;
    const requests = (sessions.get(sessionId) || 0) + 1;
    sessions.set(sessionId, requests);
    return requests <= sessionLimit;
  };
}

export function createPresenceHandler({service, emulator = false,
  allowRequest = createPresenceLimiter()}) {
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    const fail = (status) => response.status(status).json({available: false});
    if (request.method !== "GET" && request.method !== "POST") {
      response.set("Allow", "GET, POST");
      return fail(405);
    }
    const environment = requestEnvironment(request, emulator);
    if (!environment) return fail(403);
    if (!allowRequest()) {
      response.set("Retry-After", "60");
      return fail(429);
    }
    if (request.method === "POST") {
      const contentType = String(request.headers["content-type"] || "")
          .split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") return fail(415);
      if (Number(request.headers["content-length"] || 0) > 1024 ||
          (request.rawBody && request.rawBody.length > 1024)) return fail(413);
      if (!validHeartbeat(request.body)) return fail(400);
      if (!allowRequest(environment + ":" + request.body.sessionId)) {
        response.set("Retry-After", "60");
        return fail(429);
      }
    }
    try {
      const result = request.method === "GET" ?
        await service.read(environment) :
        await service.write(environment, request.body);
      return response.status(200).json(result);
    } catch (error) {
      // Never expose Firestore errors or turn a failed query into a zero count.
      console.warn("Central livestream presence temporarily unavailable.");
      return fail(503);
    }
  };
}
