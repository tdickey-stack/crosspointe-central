import {
  PUMBLE_API_ENDPOINT,
  normalizePumbleNotificationText,
  normalizePumbleUserId,
} from "./pumble.js";

export const DEFAULT_PUMBLE_API_TIMEOUT_MS = 15 * 1000;
export const PUMBLE_DIRECT_CHANNEL_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Creates a small dependency-free client matching Pumble SDK bot-DM behavior.
 *
 * The client looks up the direct channel between the linked app bot and target
 * user. A missing channel is created for the target user before the text-only
 * message is posted. It never lists users or workspace channels.
 *
 * @param {Object} options Client dependencies.
 * @return {{sendDirectMessage: Function, clearChannelCache: Function}}
 *   Direct-message API client.
 */
export function createPumbleDirectApiClient(options = {}) {
  const fetchImpl = options.fetch || options.fetchImpl;
  const getAppKey = options.getAppKey;
  const getBotToken = options.getBotToken;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const requestTimeoutMs = Number(
      options.requestTimeoutMs !== undefined ?
        options.requestTimeoutMs : DEFAULT_PUMBLE_API_TIMEOUT_MS,
  );
  const channelCacheTtlMs = Number(
      options.channelCacheTtlMs !== undefined ?
        options.channelCacheTtlMs : PUMBLE_DIRECT_CHANNEL_CACHE_TTL_MS,
  );

  if (typeof fetchImpl !== "function") {
    throw apiError_(
        "pumble-fetch-invalid",
        "Pumble API requires an injected fetch implementation.",
        false,
    );
  }
  if (typeof getAppKey !== "function" || typeof getBotToken !== "function") {
    throw apiError_(
        "pumble-credentials-invalid",
        "Pumble API requires App key and bot token providers.",
        false,
    );
  }
  if (options.endpoint && options.endpoint !== PUMBLE_API_ENDPOINT) {
    throw apiError_(
        "pumble-endpoint-invalid",
        "Pumble credentials may only be sent to the official API endpoint.",
        false,
    );
  }
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 1000 ||
      requestTimeoutMs > 60 * 1000) {
    throw apiError_(
        "pumble-timeout-invalid",
        "Pumble API requires a timeout between 1 and 60 seconds.",
        false,
    );
  }
  if (!Number.isFinite(channelCacheTtlMs) || channelCacheTtlMs < 0 ||
      channelCacheTtlMs > 60 * 60 * 1000) {
    throw apiError_(
        "pumble-cache-ttl-invalid",
        "Pumble direct-channel cache TTL must be between 0 and 60 minutes.",
        false,
    );
  }

  const channelCache = new Map();

  /**
   * Resolves credentials only at request time.
   *
   * @return {Promise<Object>} Pumble auth headers.
   */
  async function getAuthHeaders_() {
    let appKey = "";
    let botToken = "";
    try {
      [appKey, botToken] = await Promise.all([
        Promise.resolve(getAppKey()),
        Promise.resolve(getBotToken()),
      ]);
    } catch (_error) {
      throw apiError_(
          "pumble-credentials-unavailable",
          "Pumble credentials could not be loaded.",
          true,
      );
    }
    appKey = String(appKey || "").trim();
    botToken = String(botToken || "").trim();
    if (!appKey || !botToken) {
      throw apiError_(
          "pumble-credentials-missing",
          "Pumble credentials are not configured.",
          false,
      );
    }
    return {
      "Content-Type": "application/json",
      "token": botToken,
      "x-app-token": appKey,
    };
  }

  /**
   * Sends one authenticated JSON request to Pumble.
   *
   * @param {string} path API path and optional query.
   * @param {Object} request Request options.
   * @return {Promise<*>} Parsed JSON response, or null for allowed 404.
   */
  async function requestJson_(path, request = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      let response = null;
      try {
        response = await fetchImpl(PUMBLE_API_ENDPOINT + path, {
          method: String(request.method || "GET").toUpperCase(),
          headers: await getAuthHeaders_(),
          ...(request.body === undefined ? {} : {
            body: JSON.stringify(request.body),
          }),
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        const timedOut = controller.signal.aborted ||
          String(error && error.name || "") === "AbortError";
        throw apiError_(
            timedOut ? "pumble-api-timeout" : "pumble-api-network-failed",
            timedOut ? "Pumble API timed out." :
              "Pumble API could not be reached.",
            true,
        );
      }

      const status = Number(response && response.status) || 0;
      if (status === 404 && request.allowNotFound === true) return null;
      if (!response || response.ok !== true) {
        throw apiError_(
            "pumble-api-http-failed",
            "Pumble API returned HTTP " + String(status || "error") + ".",
            isRetryableHttpStatus_(status),
            status,
        );
      }
      if (typeof response.json !== "function") return {};
      try {
        return await response.json();
      } catch (_error) {
        throw apiError_(
            "pumble-api-response-invalid",
            "Pumble API returned an invalid response.",
            true,
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Gets or creates the direct channel for one bot/target pair.
   *
   * @param {string} botUserId Linked bot workspace user ID.
   * @param {string} targetUserId Linked recipient workspace user ID.
   * @return {Promise<string>} Direct channel ID.
   */
  async function resolveDirectChannel_(botUserId, targetUserId) {
    const cacheKey = botUserId + ":" + targetUserId;
    const nowMs = Number(now());
    const cached = channelCache.get(cacheKey);
    if (cached && Number.isFinite(nowMs) && nowMs < cached.expiresAtMs) {
      return cached.promise;
    }

    const promise = (async () => {
      const query = new URLSearchParams({
        participantIds: [botUserId, targetUserId].join(","),
      });
      let channel = await requestJson_(
          "/v1/channels/direct?" + query.toString(),
          {allowNotFound: true},
      );
      if (!channel) {
        channel = await requestJson_("/v1/channels/direct", {
          method: "POST",
          body: {participantIds: [targetUserId]},
        });
      }
      return normalizePumbleDirectChannelId(channel);
    })().catch((error) => {
      channelCache.delete(cacheKey);
      throw error;
    });

    channelCache.set(cacheKey, {
      promise,
      expiresAtMs: Number.isFinite(nowMs) ?
        nowMs + channelCacheTtlMs : Number.NEGATIVE_INFINITY,
    });
    return promise;
  }

  return {
    /** Clears all process-local direct-channel mappings. */
    clearChannelCache() {
      channelCache.clear();
    },

    /**
     * Sends a text-only direct message from the linked bot.
     *
     * @param {Object} input Linked IDs and message text.
     * @return {Promise<*>} Raw Pumble message response.
     */
    async sendDirectMessage(input) {
      const source = input && typeof input === "object" ? input : {};
      const userId = normalizePumbleUserId(source.userId);
      const botUserId = normalizePumbleUserId(source.botUserId, "bot user ID");
      const text = normalizePumbleNotificationText(source.text);
      if (userId === botUserId) {
        throw apiError_(
            "pumble-recipient-invalid",
            "Pumble recipient and bot user IDs must be different.",
            false,
        );
      }

      const channelId = await resolveDirectChannel_(botUserId, userId);
      return requestJson_(
          "/v1/channels/" + encodeURIComponent(channelId) + "/messages",
          {method: "POST", body: {text}},
      );
    },
  };
}

/**
 * Reads a direct channel ID from the official ChannelInfo response shape.
 *
 * @param {*} value Pumble ChannelInfo response.
 * @return {string} Direct channel ID.
 */
export function normalizePumbleDirectChannelId(value) {
  const source = value && typeof value === "object" ? value : {};
  const channel = source.channel && typeof source.channel === "object" ?
    source.channel : source;
  const channelId = String(channel.id || channel.channelId || "").trim();
  if (!channelId || channelId.length > 500 ||
      hasControlCharacters_(channelId)) {
    throw apiError_(
        "pumble-direct-channel-invalid",
        "Pumble API returned an invalid direct channel.",
        true,
    );
  }
  return channelId;
}

/**
 * Checks for ASCII control characters.
 *
 * @param {string} value Text to inspect.
 * @return {boolean} Whether the value contains a control character.
 */
function hasControlCharacters_(value) {
  return Array.from(String(value || "")).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

/**
 * Classifies retryable HTTP response statuses.
 *
 * @param {number} status HTTP status.
 * @return {boolean} Whether a later delivery attempt may succeed.
 */
function isRetryableHttpStatus_(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500 ||
    status === 0;
}

/**
 * Creates a safe tagged Pumble API error.
 *
 * @param {string} code Stable error code.
 * @param {string} message Credential-free error message.
 * @param {boolean} retryable Retry classification.
 * @param {number} status Optional HTTP status.
 * @return {Error} Tagged error.
 */
function apiError_(code, message, retryable, status = 0) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  if (status) error.status = status;
  return error;
}
