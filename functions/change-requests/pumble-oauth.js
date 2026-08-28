/* eslint-disable require-jsdoc */
import {createHash, randomBytes} from "node:crypto";

export const PUMBLE_AUTHORIZE_ENDPOINT =
  "https://app.pumble.com/access-request";
export const PUMBLE_TOKEN_ENDPOINT = "https://api-ga.pumble.com/oauth2/access";
export const PUMBLE_PROFILE_ENDPOINT = "https://api-ga.pumble.com/oauth2/me";
export const DEFAULT_PUMBLE_OAUTH_TIMEOUT_MS = 15 * 1000;
export const PUMBLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const PUMBLE_ROTATION_LEASE_TTL_MS = 2 * 60 * 1000;
export const PUMBLE_OAUTH_STATES_PATH =
  "centralAdmin/root/pumbleOAuthStates";
export const PUMBLE_BOT_CREDENTIAL_PATH =
  "centralAdmin/root/pumbleBotCredentials/primary";
export const PUMBLE_BOT_CREDENTIAL_LOCK_PATH =
  "centralAdmin/root/pumbleBotCredentialLocks/primary";
export const PUMBLE_REQUIRED_BOT_SCOPES = [
  "channels:read",
  "channels:write",
  "messages:write",
];

/**
 * Creates the server-only Pumble authorization service.
 *
 * The OAuth exchange returns user and bot access tokens. Central deliberately
 * discards the user token. The freshly issued bot token is profile-verified,
 * then stored in a server-only credential document. OAuth state and browser
 * responses contain only opaque workspace-user identifiers.
 *
 * @param {Object} options Service dependencies.
 * @return {Object} OAuth start and callback helpers.
 */
export function createPumbleOAuthService(options = {}) {
  const firestore = requireMethod_(
      options.firestore,
      "collection",
      "Firestore",
  );
  requireMethod_(firestore, "runTransaction", "Firestore");
  requireMethod_(firestore, "doc", "Firestore");
  const timestampFromMillis = requireFunction_(
      options.timestampFromMillis,
      "timestampFromMillis",
  );
  const fetchImpl = requireFunction_(options.fetchImpl, "fetchImpl");
  const getAppId = requireFunction_(options.getAppId, "getAppId");
  const getClientSecret = requireFunction_(
      options.getClientSecret,
      "getClientSecret",
  );
  const getAppKey = requireFunction_(options.getAppKey, "getAppKey");
  const now = typeof options.now === "function" ?
    options.now : () => Date.now();
  const createState = typeof options.createState === "function" ?
    options.createState : () => randomBytes(32).toString("base64url");
  const createCompletionToken =
    typeof options.createCompletionToken === "function" ?
      options.createCompletionToken :
      () => randomBytes(32).toString("base64url");
  const stateTtlMs = normalizePositiveNumber_(
      options.stateTtlMs,
      PUMBLE_OAUTH_STATE_TTL_MS,
      "OAuth state TTL",
  );
  const rotationLeaseTtlMs = normalizePositiveNumber_(
      options.rotationLeaseTtlMs,
      PUMBLE_ROTATION_LEASE_TTL_MS,
      "Bot credential rotation lease TTL",
  );
  const requestTimeoutMs = normalizeBoundedNumber_(
      options.requestTimeoutMs,
      DEFAULT_PUMBLE_OAUTH_TIMEOUT_MS,
      1000,
      60 * 1000,
      "OAuth request timeout",
  );
  const adminUrl = normalizeHttpsUrl_(options.adminUrl, "Admin URL");
  const approvedReturnOrigins = Array.isArray(options.approvedReturnOrigins) ?
    options.approvedReturnOrigins : [];
  const callbackUrl = normalizeHttpsUrl_(
      options.callbackUrl || buildPumbleOAuthCallbackUrl(adminUrl),
      "Pumble OAuth callback URL",
  );
  const states = firestore.collection(PUMBLE_OAUTH_STATES_PATH);
  const botCredentialRef = firestore.doc(PUMBLE_BOT_CREDENTIAL_PATH);
  const botCredentialLockRef = firestore.doc(
      PUMBLE_BOT_CREDENTIAL_LOCK_PATH,
  );

  async function beginAuthorization(uid, input = {}) {
    const normalizedUid = normalizeIdentifier_(uid, "Firebase user ID", 500);
    const appId = normalizeCredential_(getAppId(), "Pumble App ID");
    const state = normalizeState_(createState());
    const stateHash = hashPumbleOAuthState(state);
    const createdAtMs = normalizeNowMs_(now());
    const expiresAtMs = createdAtMs + stateTtlMs;

    const returnUrl = normalizePumbleOAuthReturnUrl(
        input.returnUrl,
        adminUrl,
        input.requestOrigin,
        approvedReturnOrigins,
    );

    await states.doc(stateHash).create({
      kind: "authorization",
      uid: normalizedUid,
      callbackUrl,
      returnUrl,
      createdAt: timestampFromMillis(createdAtMs),
      expiresAt: timestampFromMillis(expiresAtMs),
    });

    return {
      authorizationUrl: buildPumbleAuthorizationUrl({
        appId,
        callbackUrl,
        state,
      }),
      expiresAtMs,
    };
  }

  async function completeAuthorization({code, state} = {}) {
    const normalizedState = normalizeState_(state);
    const stateRef = states.doc(hashPumbleOAuthState(normalizedState));
    const nowMs = normalizeNowMs_(now());
    const leaseId = normalizeState_(createCompletionToken());
    const authorization = await firestore.runTransaction(
        async (transaction) => {
          const snapshot = await transaction.get(stateRef);
          if (!snapshot.exists) {
            throw oauthError_(
                "pumble-oauth-state-invalid",
                "The Pumble authorization link is invalid or was already used.",
                400,
            );
          }
          const data = snapshot.data() || {};
          if (data.kind !== "authorization") {
            transaction.delete(stateRef);
            return {errorCode: "pumble-oauth-state-invalid"};
          }
          if (String(data.callbackUrl || "") !== callbackUrl) {
            transaction.delete(stateRef);
            return {errorCode: "pumble-oauth-state-invalid"};
          }
          const returnUrl = normalizePumbleOAuthReturnUrl(
              data.returnUrl,
              adminUrl,
              "",
              approvedReturnOrigins,
          );
          const expiresAtMs = toMillis_(data.expiresAt);
          if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
            transaction.delete(stateRef);
            return {
              errorCode: "pumble-oauth-state-expired",
              returnUrl,
            };
          }
          const uid = normalizeIdentifier_(
              data.uid,
              "linked Firebase user ID",
              500,
          );
          const credentialSnapshot = await transaction.get(botCredentialRef);
          const lockSnapshot = await transaction.get(botCredentialLockRef);
          const anchor = credentialSnapshot.exists ?
            normalizeStoredBotCredential_(credentialSnapshot.data()) : null;
          if (lockSnapshot.exists) {
            const lockExpiresAtMs = toMillis_(
                (lockSnapshot.data() || {}).expiresAt,
            );
            if (Number.isFinite(lockExpiresAtMs) && lockExpiresAtMs > nowMs) {
              return {
                errorCode: "pumble-oauth-rotation-busy",
                returnUrl,
              };
            }
            transaction.delete(botCredentialLockRef);
          }
          transaction.delete(stateRef);
          transaction.set(botCredentialLockRef, {
            kind: "pumble-bot-token-rotation",
            leaseId,
            uid,
            createdAt: timestampFromMillis(nowMs),
            expiresAt: timestampFromMillis(nowMs + rotationLeaseTtlMs),
          });
          return {uid, returnUrl, anchor, leaseId};
        },
    );
    if (authorization.errorCode === "pumble-oauth-state-expired") {
      throw withReturnUrl_(oauthError_(
          authorization.errorCode,
          "The Pumble authorization link expired. Start again.",
          400,
      ), authorization.returnUrl);
    }
    if (authorization.errorCode) {
      throw withReturnUrl_(oauthError_(
          authorization.errorCode,
          authorization.errorCode === "pumble-oauth-rotation-busy" ?
            "Another Pumble link is being completed. Try again shortly." :
            "The Pumble authorization callback did not match.",
          authorization.errorCode === "pumble-oauth-rotation-busy" ?
            409 : 400,
          authorization.errorCode === "pumble-oauth-rotation-busy",
      ), authorization.returnUrl);
    }

    try {
      const normalizedCode = normalizeAuthorizationCode_(code);
      const tokens = await exchangePumbleAuthorizationCode({
        fetchImpl,
        appId: normalizeCredential_(getAppId(), "Pumble App ID"),
        clientSecret: normalizeCredential_(
            getClientSecret(),
            "Pumble Client Secret",
        ),
        code: normalizedCode,
        requestTimeoutMs,
      });
      await verifyPumbleBotTokenIdentity({
        fetchImpl,
        appKey: normalizeCredential_(getAppKey(), "Pumble App Key"),
        botToken: tokens.botToken,
        expectedWorkspaceId: tokens.workspaceId,
        expectedBotId: tokens.botId,
        requestTimeoutMs,
      });
      if (authorization.anchor &&
        (authorization.anchor.workspaceId !== tokens.workspaceId ||
        authorization.anchor.botId !== tokens.botId)) {
        throw oauthError_(
            "pumble-workspace-mismatch",
            "The Pumble app returned a different bot or workspace.",
            403,
        );
      }
      const completionToken = normalizeState_(createCompletionToken());
      const completionRef = states.doc(
          hashPumbleOAuthState(completionToken),
      );
      const committedAtMs = normalizeNowMs_(now());
      await firestore.runTransaction(async (transaction) => {
        const lockSnapshot = await transaction.get(botCredentialLockRef);
        const credentialSnapshot = await transaction.get(botCredentialRef);
        const lock = lockSnapshot.data() || {};
        if (!lockSnapshot.exists || lock.leaseId !== authorization.leaseId ||
          toMillis_(lock.expiresAt) <= committedAtMs) {
          throw oauthError_(
              "pumble-oauth-rotation-lost",
              "The Pumble bot credential rotation expired. Start again.",
              409,
              true,
          );
        }
        const storedCredential = credentialSnapshot.exists ?
          normalizeStoredBotCredential_(credentialSnapshot.data()) : null;
        if (storedCredential &&
          (storedCredential.workspaceId !== tokens.workspaceId ||
          storedCredential.botId !== tokens.botId)) {
          throw oauthError_(
              "pumble-workspace-mismatch",
              "The Pumble app returned a different bot or workspace.",
              403,
          );
        }
        const linkedAt = timestampFromMillis(committedAtMs);
        transaction.set(botCredentialRef, {
          schemaVersion: 1,
          token: tokens.botToken,
          botId: tokens.botId,
          workspaceId: tokens.workspaceId,
          establishedAt: storedCredential && storedCredential.establishedAt ?
            storedCredential.establishedAt : linkedAt,
          updatedAt: linkedAt,
          updatedByUid: authorization.uid,
        });
        transaction.create(completionRef, {
          kind: "completion",
          uid: authorization.uid,
          connection: {
            status: "linked",
            userId: tokens.userId,
            botId: tokens.botId,
            workspaceId: tokens.workspaceId,
            linkedAt,
          },
          createdAt: linkedAt,
          expiresAt: timestampFromMillis(committedAtMs + stateTtlMs),
        });
        transaction.delete(botCredentialLockRef);
      });

      return {
        completionToken,
        returnUrl: authorization.returnUrl,
      };
    } catch (error) {
      await releaseRotationLease_(
          firestore,
          botCredentialLockRef,
          authorization.leaseId,
      );
      throw withReturnUrl_(error, authorization.returnUrl);
    }
  }

  async function finalizeAuthorization({
    uid,
    completionToken,
    applyConnection,
  } = {}) {
    const normalizedUid = normalizeIdentifier_(uid, "Firebase user ID", 500);
    const normalizedToken = normalizeState_(completionToken);
    const completionRef = states.doc(hashPumbleOAuthState(normalizedToken));
    const nowMs = normalizeNowMs_(now());
    const result = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(completionRef);
      if (!snapshot.exists) {
        return {errorCode: "pumble-oauth-completion-invalid"};
      }
      const data = snapshot.data() || {};
      if (data.kind !== "completion") {
        return {errorCode: "pumble-oauth-completion-invalid"};
      }
      if (toMillis_(data.expiresAt) <= nowMs) {
        transaction.delete(completionRef);
        return {errorCode: "pumble-oauth-completion-expired"};
      }
      if (String(data.uid || "") !== normalizedUid) {
        return {errorCode: "pumble-oauth-user-mismatch"};
      }
      const connection = normalizePendingConnection_(data.connection);
      if (typeof applyConnection === "function") {
        await applyConnection({transaction, connection});
      }
      transaction.delete(completionRef);
      return {connection};
    });
    if (result.errorCode) {
      const status = result.errorCode === "pumble-oauth-user-mismatch" ?
        403 : 400;
      throw oauthError_(
          result.errorCode,
          result.errorCode === "pumble-oauth-user-mismatch" ?
            "Sign in with the Central account that started Pumble linking." :
            "This Pumble link expired or was already completed.",
          status,
      );
    }
    return result.connection;
  }

  return {
    adminUrl,
    callbackUrl,
    beginAuthorization,
    completeAuthorization,
    finalizeAuthorization,
  };
}

/**
 * Builds the canonical callback from the configured Admin URL.
 * @param {string} adminUrl Central Admin URL.
 * @return {string} Same-origin callback URL.
 */
export function buildPumbleOAuthCallbackUrl(adminUrl) {
  const url = new URL(normalizeHttpsUrl_(adminUrl, "Admin URL"));
  url.pathname = "/api/admin/pumble/oauth/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * Restricts OAuth completion redirects to the configured Admin host or one of
 * that Firebase project's HTTPS Hosting preview channels.
 * @param {*} value Requested return URL.
 * @param {string} adminUrl Configured canonical Admin URL.
 * @param {string} requestOrigin Browser origin that started authorization.
 * @param {string[]} approvedReturnOrigins Additional exact Central origins.
 * @return {string} Canonical Change Requests return URL.
 */
export function normalizePumbleOAuthReturnUrl(
    value,
    adminUrl,
    requestOrigin = "",
    approvedReturnOrigins = [],
) {
  const canonical = new URL(normalizeHttpsUrl_(adminUrl, "Admin URL"));
  const requested = new URL(normalizeHttpsUrl_(
      value || canonical.origin,
      "Pumble OAuth return URL",
  ));
  const requestedHost = requested.hostname.toLowerCase();
  const approvedOrigins = [canonical.origin];
  const hostingSiteIds = [];
  approvedReturnOrigins.forEach((origin) => {
    const approved = new URL(normalizeHttpsUrl_(
        origin,
        "Approved Pumble OAuth return origin",
    ));
    approvedOrigins.push(approved.origin);
  });
  approvedOrigins.forEach((origin) => {
    const approved = new URL(origin);
    const hostingSiteMatch = approved.hostname.toLowerCase()
        .match(/^([a-z0-9-]+)\.web\.app$/);
    if (hostingSiteMatch) hostingSiteIds.push(hostingSiteMatch[1]);
  });
  const isCanonicalOrigin = requested.origin === canonical.origin;
  const isApprovedOrigin = approvedOrigins.includes(requested.origin);
  const isPreviewOrigin = hostingSiteIds.some((siteId) =>
    requested.port === "" &&
    requestedHost.startsWith(siteId + "--") &&
    requestedHost.endsWith(".web.app"),
  );
  if (!isCanonicalOrigin && !isApprovedOrigin && !isPreviewOrigin) {
    throw oauthError_(
        "pumble-oauth-return-invalid",
        "The Pumble return URL is not an approved Central host.",
        400,
    );
  }
  if (requestOrigin) {
    const normalizedRequestOrigin = new URL(normalizeHttpsUrl_(
        requestOrigin,
        "Pumble OAuth request origin",
    )).origin;
    if (requested.origin !== normalizedRequestOrigin) {
      throw oauthError_(
          "pumble-oauth-return-invalid",
          "The Pumble return URL did not match the requesting Admin host.",
          400,
      );
    }
  }
  if (requested.username || requested.password) {
    throw oauthError_(
        "pumble-oauth-return-invalid",
        "The Pumble return URL must not include credentials.",
        400,
    );
  }
  requested.pathname = "/admin/change-requests";
  requested.search = "";
  requested.hash = "";
  return requested.toString();
}

/**
 * Builds the Pumble consent-screen URL.
 * @param {Object} input Authorization values.
 * @return {string} Pumble OAuth URL.
 */
export function buildPumbleAuthorizationUrl(input = {}) {
  const url = new URL(PUMBLE_AUTHORIZE_ENDPOINT);
  url.searchParams.set("redirectUrl", normalizeHttpsUrl_(
      input.callbackUrl,
      "Pumble OAuth callback URL",
  ));
  url.searchParams.set(
      "clientId",
      normalizeCredential_(input.appId, "Pumble App ID"),
  );
  url.searchParams.set(
      "scopes",
      PUMBLE_REQUIRED_BOT_SCOPES.map((scope) => "bot:" + scope).join(","),
  );
  url.searchParams.set("state", normalizeState_(input.state));
  return url.toString();
}

/**
 * Exchanges a one-time Pumble authorization code.
 * @param {Object} input Request dependencies and credentials.
 * @return {Promise<Object>} Normalized token payload.
 */
export async function exchangePumbleAuthorizationCode(input = {}) {
  const fetchImpl = requireFunction_(input.fetchImpl, "fetchImpl");
  const requestTimeoutMs = normalizeBoundedNumber_(
      input.requestTimeoutMs,
      DEFAULT_PUMBLE_OAUTH_TIMEOUT_MS,
      1000,
      60 * 1000,
      "OAuth request timeout",
  );
  const form = new FormData();
  form.set("client-id", normalizeCredential_(input.appId, "Pumble App ID"));
  form.set(
      "client-secret",
      normalizeCredential_(input.clientSecret, "Pumble Client Secret"),
  );
  form.set("code", normalizeAuthorizationCode_(input.code));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response;
  try {
    response = await fetchImpl(PUMBLE_TOKEN_ENDPOINT, {
      method: "POST",
      body: form,
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted ||
      String(error && error.name || "") === "AbortError";
    throw oauthError_(
        timedOut ? "pumble-oauth-timeout" :
          "pumble-oauth-network-failed",
        timedOut ? "Pumble authorization timed out." :
          "Pumble authorization is temporarily unavailable.",
        503,
        true,
        error,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await readJsonResponse_(response);
  if (!response || response.ok !== true) {
    throw oauthError_(
        "pumble-oauth-exchange-failed",
        "Pumble did not accept the authorization code.",
        response && Number(response.status) || 502,
        Number(response && response.status) >= 500,
    );
  }

  normalizeCredential_(
      payload && payload.accessToken,
      "Pumble user access token",
  );
  return {
    botToken: normalizeCredential_(
        payload && payload.botToken,
        "Pumble bot access token",
    ),
    userId: normalizeIdentifier_(
        payload && payload.userId,
        "Pumble user ID",
        500,
    ),
    botId: normalizeIdentifier_(
        payload && payload.botId,
        "Pumble bot ID",
        500,
    ),
    workspaceId: normalizeIdentifier_(
        payload && payload.workspaceId,
        "Pumble workspace ID",
        500,
    ),
  };
}

/**
 * Verifies that a newly issued bot token belongs to the exchanged bot and
 * workspace before Central stores it.
 * @param {Object} input Request dependencies and expected identity.
 * @return {Promise<Object>} Verified bot identity.
 */
export async function verifyPumbleBotTokenIdentity(input = {}) {
  const fetchImpl = requireFunction_(input.fetchImpl, "fetchImpl");
  const requestTimeoutMs = normalizeBoundedNumber_(
      input.requestTimeoutMs,
      DEFAULT_PUMBLE_OAUTH_TIMEOUT_MS,
      1000,
      60 * 1000,
      "OAuth request timeout",
  );
  const appKey = normalizeCredential_(input.appKey, "Pumble App Key");
  const botToken = normalizeCredential_(
      input.botToken,
      "Pumble bot access token",
  );
  const expectedWorkspaceId = normalizeIdentifier_(
      input.expectedWorkspaceId,
      "Pumble workspace ID",
      500,
  );
  const expectedBotId = normalizeIdentifier_(
      input.expectedBotId,
      "Pumble bot ID",
      500,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response;
  try {
    response = await fetchImpl(PUMBLE_PROFILE_ENDPOINT, {
      method: "GET",
      headers: [
        ["Accept", "application/json"],
        ["token", botToken],
        ["x-app-token", appKey],
      ],
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted ||
      String(error && error.name || "") === "AbortError";
    throw oauthError_(
        timedOut ? "pumble-oauth-timeout" :
          "pumble-oauth-network-failed",
        timedOut ? "Pumble bot verification timed out." :
          "Pumble bot verification is temporarily unavailable.",
        503,
        true,
        error,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await readJsonResponse_(response);
  if (!response || response.ok !== true) {
    throw oauthError_(
        "pumble-bot-verification-failed",
        "Pumble did not accept the newly issued bot credential.",
        Number(response && response.status) || 502,
        Number(response && response.status) >= 500,
    );
  }
  const workspaceId = normalizeIdentifier_(
      payload && payload.workspaceId,
      "Pumble bot workspace ID",
      500,
  );
  const botId = normalizeIdentifier_(
      payload && payload.workspaceUserId,
      "Pumble bot user ID",
      500,
  );
  if (workspaceId !== expectedWorkspaceId || botId !== expectedBotId) {
    throw oauthError_(
        "pumble-workspace-mismatch",
        "The issued Pumble bot token did not match its OAuth identity.",
        403,
    );
  }
  return {workspaceId, botId};
}

export function hashPumbleOAuthState(state) {
  return createHash("sha256").update(normalizeState_(state)).digest("hex");
}

async function readJsonResponse_(response) {
  if (!response || typeof response.json !== "function") return null;
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}


function normalizeHttpsUrl_(value, label) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch (error) {
    throw new Error(label + " must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error(label + " must use HTTPS.");
  }
  return url.toString();
}

function normalizeState_(value) {
  const state = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(state)) {
    throw oauthError_(
        "pumble-oauth-state-invalid",
        "The Pumble authorization state is invalid.",
        400,
    );
  }
  return state;
}

function normalizeAuthorizationCode_(value) {
  const code = String(value || "").trim();
  if (!code || code.length > 4000 || hasControlCharacters_(code)) {
    throw oauthError_(
        "pumble-oauth-code-invalid",
        "Pumble did not provide a valid authorization code.",
        400,
    );
  }
  return code;
}

function normalizeCredential_(value, label) {
  const credential = String(value || "").trim();
  if (!credential || credential.length > 10000) {
    throw oauthError_(
        "pumble-credentials-missing",
        label + " is not configured.",
        503,
        false,
    );
  }
  return credential;
}

function normalizeIdentifier_(value, label, maxLength) {
  const identifier = String(value || "").trim();
  if (!identifier || identifier.length > maxLength ||
      hasControlCharacters_(identifier)) {
    throw oauthError_(
        "pumble-oauth-response-invalid",
        label + " is invalid.",
        502,
    );
  }
  return identifier;
}

function normalizePendingConnection_(value) {
  const source = value && typeof value === "object" ? value : {};
  if (source.status !== "linked") {
    throw oauthError_(
        "pumble-oauth-completion-invalid",
        "The pending Pumble link is invalid.",
        400,
    );
  }
  const linkedAtMs = toMillis_(source.linkedAt);
  if (!Number.isFinite(linkedAtMs) || linkedAtMs <= 0) {
    throw oauthError_(
        "pumble-oauth-completion-invalid",
        "The pending Pumble link is invalid.",
        400,
    );
  }
  return {
    status: "linked",
    userId: normalizeIdentifier_(source.userId, "Pumble user ID", 500),
    botId: normalizeIdentifier_(source.botId, "Pumble bot ID", 500),
    workspaceId: normalizeIdentifier_(
        source.workspaceId,
        "Pumble workspace ID",
        500,
    ),
    linkedAt: source.linkedAt,
  };
}

function normalizeStoredBotCredential_(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    token: normalizeCredential_(source.token, "Pumble bot access token"),
    botId: normalizeIdentifier_(source.botId, "Pumble bot ID", 500),
    workspaceId: normalizeIdentifier_(
        source.workspaceId,
        "Pumble workspace ID",
        500,
    ),
    establishedAt: source.establishedAt,
    updatedAt: source.updatedAt,
  };
}

async function releaseRotationLease_(firestore, lockRef, leaseId) {
  try {
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(lockRef);
      if (snapshot.exists &&
        String((snapshot.data() || {}).leaseId || "") === leaseId) {
        transaction.delete(lockRef);
      }
    });
  } catch (error) {
    // Lease expiry provides bounded crash recovery if cleanup cannot commit.
  }
}

function withReturnUrl_(error, returnUrl) {
  if (error && typeof error === "object" && returnUrl) {
    error.returnUrl = returnUrl;
  }
  return error;
}

function hasControlCharacters_(value) {
  return Array.from(String(value || "")).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function normalizePositiveNumber_(value, fallback, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(label + " must be a positive number.");
  }
  return number;
}

function normalizeBoundedNumber_(value, fallback, minimum, maximum, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(
        label + " must be between " + minimum + " and " + maximum + ".",
    );
  }
  return number;
}

function normalizeNowMs_(value) {
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error("The Pumble OAuth clock is invalid.");
  }
  return milliseconds;
}

function toMillis_(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number(value);
}

function requireFunction_(value, label) {
  if (typeof value !== "function") {
    throw new Error(label + " must be a function.");
  }
  return value;
}

function requireMethod_(value, method, label) {
  if (!value || typeof value[method] !== "function") {
    throw new Error(label + " must provide " + method + "().");
  }
  return value;
}

function oauthError_(code, message, status = 500, retryable = false, cause) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  if (cause) error.cause = cause;
  return error;
}
