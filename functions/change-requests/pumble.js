export const PUMBLE_API_ENDPOINT = "https://api-ga.pumble.com";
export const PUMBLE_MAX_MESSAGE_LENGTH = 10000;

/**
 * Creates a Change Request transport over an injected Pumble bot API client.
 *
 * Identity linking happens outside this delivery boundary. Every send must
 * supply the previously linked target user ID and bot ID; delivery never
 * searches the workspace directory or guesses from an email address.
 *
 * @param {Object} options Transport dependencies.
 * @return {{send: Function}} Pumble notification transport.
 */
export function createPumbleChangeRequestTransport(options = {}) {
  const apiClient = options.apiClient || options.mcpClient;
  if (!apiClient || typeof apiClient.sendDirectMessage !== "function") {
    throw pumbleError_(
        "pumble-client-invalid",
        "Pumble delivery requires a direct-message API client.",
        false,
    );
  }

  return {
    /**
     * Delivers one direct message from the linked app bot.
     *
     * @param {Object} input Delivery input.
     * @return {Promise<Object>} Bounded provider result.
     */
    async send(input) {
      const source = input && typeof input === "object" ? input : {};
      const recipientUserId = normalizePumbleUserId(source.recipientUserId);
      const botUserId = normalizePumbleUserId(source.botUserId, "bot user ID");
      const text = normalizePumbleNotificationText(source.text);

      let result = null;
      try {
        result = await apiClient.sendDirectMessage({
          userId: recipientUserId,
          botUserId,
          text,
        });
      } catch (error) {
        throw tagPumbleProviderError_(error);
      }

      return {
        provider: "pumble-api",
        endpoint: PUMBLE_API_ENDPOINT,
        recipientUserId,
        messageId: normalizePumbleProviderMessageId(result),
      };
    },
  };
}

/**
 * Normalizes a linked Pumble workspace user ID.
 *
 * @param {*} value Raw user ID.
 * @param {string} label Safe field label.
 * @return {string} Bounded Pumble user ID.
 */
export function normalizePumbleUserId(value, label = "recipient user ID") {
  const userId = String(value || "").trim();
  if (!userId || userId.length > 500 || hasControlCharacters_(userId)) {
    throw pumbleError_(
        "pumble-user-id-invalid",
        "Pumble delivery requires a valid linked " + label + ".",
        false,
    );
  }
  return userId;
}

/**
 * Checks for ASCII control characters without embedding them in a regex.
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
 * Normalizes a bounded Pumble message.
 *
 * @param {*} value Raw message.
 * @return {string} Bounded message.
 */
export function normalizePumbleNotificationText(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw pumbleError_(
        "pumble-message-missing",
        "Pumble delivery requires notification text.",
        false,
    );
  }
  if (text.length > PUMBLE_MAX_MESSAGE_LENGTH) {
    throw pumbleError_(
        "pumble-message-too-long",
        "Pumble notification text exceeds 10000 characters.",
        false,
    );
  }
  return text;
}

/**
 * Extracts a bounded provider message ID from common API response shapes.
 *
 * @param {*} value Raw direct-message result.
 * @return {string} Provider message ID or an empty string.
 */
export function normalizePumbleProviderMessageId(value) {
  const source = value && typeof value === "object" ? value : {};
  const message = source.message && typeof source.message === "object" ?
    source.message : {};
  const data = source.data && typeof source.data === "object" ?
    source.data : {};
  return String(
      source.messageId || source.id || message.id ||
      data.messageId || data.id || "",
  ).trim().slice(0, 500);
}

/**
 * Preserves provider error metadata while assigning a stable code.
 *
 * @param {*} cause Provider error.
 * @return {Error} Tagged provider error.
 */
function tagPumbleProviderError_(cause) {
  if (cause && String(cause.code || "").startsWith("pumble-")) return cause;

  const error = pumbleError_(
      "pumble-provider-failed",
      String(cause && cause.message || "Pumble delivery failed.")
          .replace(/[\r\n]+/g, " ")
          .trim()
          .slice(0, 500),
      undefined,
  );
  const status = Number(cause && (cause.status || cause.statusCode));
  if (Number.isFinite(status) && status > 0) error.status = status;
  if (cause && typeof cause.retryable === "boolean") {
    error.retryable = cause.retryable;
  }
  return error;
}

/**
 * Creates a tagged Pumble transport error.
 *
 * @param {string} code Stable error code.
 * @param {string} message Safe message.
 * @param {boolean|undefined} retryable Retry classification.
 * @return {Error} Tagged error.
 */
function pumbleError_(code, message, retryable) {
  const error = new Error(message);
  error.code = code;
  if (typeof retryable === "boolean") error.retryable = retryable;
  return error;
}
