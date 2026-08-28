import {
  normalizeChangeRequestNotificationChannelSelection,
  normalizeChangeRequestNotificationPreferences,
  serializeChangeRequestNotificationPreferences,
} from "../change-requests/preferences.js";
import {
  getAdminPumbleNotificationEligibility,
  getAdminPumbleNotificationPreferences,
  normalizeAdminPumbleNotificationSelection,
} from "./preferences.js";

/**
 * Creates the authenticated per-user notification preference endpoint.
 *
 * @param {Object} options Injected Firebase and authorization dependencies.
 * @return {Function} HTTPS request handler.
 */
export function createAdminNotificationPreferencesHandler(options = {}) {
  const firestore = requireObject_(options.firestore, "firestore");
  const fieldValue = requireObject_(options.fieldValue, "fieldValue");
  const verifyAdmin = requireFunction_(options.verifyAdmin, "verifyAdmin");
  const getUserDocPath = requireFunction_(
      options.getUserDocPath,
      "getUserDocPath",
  );
  const serializePumbleConnection = requireFunction_(
      options.serializePumbleConnection,
      "serializePumbleConnection",
  );

  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const adminUser = await verifyAdmin(request);
      const userRef = firestore.doc(getUserDocPath(adminUser.uid));
      let result;

      if (request.method === "GET") {
        const snapshot = await userRef.get();
        assertActiveUser_(snapshot);
        result = serializeResponse_(
            snapshot.data() || {},
            serializePumbleConnection,
        );
      } else if (request.body &&
        Object.prototype.hasOwnProperty.call(
            request.body,
            "notificationPreferences",
        )) {
        result = await updateNotificationPreferences_({
          firestore,
          fieldValue,
          userRef,
          selection: request.body.notificationPreferences,
          serializePumbleConnection,
        });
      } else if (request.body &&
        Object.prototype.hasOwnProperty.call(
            request.body,
            "pumbleNotifications",
        )) {
        result = await updatePumblePreferences_({
          firestore,
          fieldValue,
          userRef,
          selection: request.body.pumbleNotifications,
          serializePumbleConnection,
        });
      } else {
        result = await updateChangeRequestChannels_({
          firestore,
          fieldValue,
          userRef,
          channels: request.body && request.body.channels,
          serializePumbleConnection,
        });
      }

      if (result.error) {
        response.status(result.status).json(result.error);
        return;
      }
      response.status(200).json({ok: true, ...result});
    } catch (error) {
      console.error("Admin notification preferences failed.", {
        code: String(error && error.code || ""),
        message: String(error && error.message || ""),
      });
      response.status(getErrorStatus_(error)).json({
        error: String(error && error.message ||
          "Notification preferences are unavailable."),
        code: String(error && error.code || ""),
      });
    }
  };
}

/**
 * Atomically updates every personal notification preference shown in Admin.
 *
 * Event groups are optional so users only change settings they are eligible
 * to manage. Existing request contracts remain available for older clients.
 *
 * @param {Object} options Transaction and serialization dependencies.
 * @return {Promise<Object>} Serialized preferences or an HTTP error result.
 */
async function updateNotificationPreferences_(options) {
  let selection;
  try {
    selection = normalizeUnifiedNotificationSelection_(options.selection);
  } catch (error) {
    return errorResult_(400, error, "invalid-notification-preferences");
  }

  const transactionResult = await options.firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(options.userRef);
        assertActiveUser_(snapshot);
        const userData = snapshot.data() || {};
        const eligibility = getAdminPumbleNotificationEligibility(userData);
        const pumbleConnection = options.serializePumbleConnection(userData);
        const currentChangeRequests =
          normalizeChangeRequestNotificationPreferences(
              userData.notificationPreferences &&
              userData.notificationPreferences.changeRequests,
          );
        const currentPumble = getAdminPumbleNotificationPreferences(userData);
        const nextChangeRequests = selection.changeRequests ||
          currentChangeRequests;
        const nextServeNeedsPumble = selection.serveNeeds ?
          selection.serveNeeds.pumble : currentPumble.serveNeeds;

        if (selection.changeRequests && !eligibility.changeRequests) {
          return {forbidden: "changeRequests", eligibility};
        }
        if (selection.serveNeeds && !eligibility.serveNeeds) {
          return {forbidden: "serveNeeds", eligibility};
        }
        if (selection.changeRequests &&
          !nextChangeRequests.email && !nextChangeRequests.pumble) {
          return {missingChannel: true, eligibility};
        }
        if ((selection.changeRequests && nextChangeRequests.pumble) ||
          (selection.serveNeeds && nextServeNeedsPumble)) {
          if (!pumbleConnection.linked) {
            return {conflict: true, eligibility, pumbleConnection};
          }
        }

        const update = {
          "notificationPreferences.updatedAt":
            options.fieldValue.serverTimestamp(),
          "updatedAt": options.fieldValue.serverTimestamp(),
        };
        if (selection.changeRequests) {
          update["notificationPreferences.changeRequests"] =
            nextChangeRequests;
        }
        if (selection.serveNeeds) {
          update["notificationPreferences.serveNeeds.pumble"] =
            nextServeNeedsPumble;
        }
        transaction.update(options.userRef, update);

        return {
          eligibility,
          pumbleConnection,
          preferences: serializeChangeRequestNotificationPreferences(
              nextChangeRequests,
          ),
          pumbleNotifications: {
            changeRequests: nextChangeRequests.pumble,
            serveNeeds: nextServeNeedsPumble,
          },
          message: "Notification preferences saved.",
        };
      },
  );

  if (transactionResult.forbidden) {
    return {
      status: 403,
      error: {
        error:
          "Your current Admin access does not allow one of those " +
          "notification types.",
        code: "notification-type-forbidden",
        eligibility: transactionResult.eligibility,
      },
    };
  }
  if (transactionResult.missingChannel) {
    return {
      status: 400,
      error: {
        error: "Choose Email, Pumble, or both for Change Requests.",
        code: "notification-channel-required",
      },
    };
  }
  if (transactionResult.conflict) {
    return {
      status: 409,
      error: {
        error: "Link your Pumble account before enabling notifications.",
        code: "pumble-not-linked",
        pumbleConnection: transactionResult.pumbleConnection,
      },
    };
  }
  return transactionResult;
}

/**
 * Validates the Notifications page's partial, permission-aware payload.
 *
 * @param {*} value Proposed notification settings.
 * @return {Object} Storage-ready event preferences.
 */
function normalizeUnifiedNotificationSelection_(value) {
  const source = value && typeof value === "object" &&
    !Array.isArray(value) ? value : null;
  if (!source) {
    throw new Error("Notification preferences must be an object.");
  }

  const hasChangeRequests = Object.prototype.hasOwnProperty.call(
      source,
      "changeRequests",
  );
  const hasServeNeeds = Object.prototype.hasOwnProperty.call(
      source,
      "serveNeeds",
  );
  if (!hasChangeRequests && !hasServeNeeds) {
    throw new Error("Choose at least one notification type to update.");
  }

  const normalized = {};
  if (hasChangeRequests) {
    const changeRequests = source.changeRequests;
    if (!changeRequests || typeof changeRequests !== "object" ||
      Array.isArray(changeRequests) ||
      typeof changeRequests.email !== "boolean" ||
      typeof changeRequests.pumble !== "boolean") {
      throw new Error(
          "Change Request preferences must include Email and Pumble.",
      );
    }
    normalized.changeRequests = {
      email: changeRequests.email,
      pumble: changeRequests.pumble,
    };
  }
  if (hasServeNeeds) {
    const serveNeeds = source.serveNeeds;
    if (!serveNeeds || typeof serveNeeds !== "object" ||
      Array.isArray(serveNeeds) ||
      typeof serveNeeds.pumble !== "boolean") {
      throw new Error("Serve Needs preferences must include Pumble.");
    }
    normalized.serveNeeds = {pumble: serveNeeds.pumble};
  }
  return normalized;
}

/**
 * Updates the current Admin user's Pumble notification types.
 *
 * @param {Object} options Transaction and serialization dependencies.
 * @return {Promise<Object>} Serialized preferences or an HTTP error result.
 */
async function updatePumblePreferences_(options) {
  let selection;
  try {
    selection = normalizeAdminPumbleNotificationSelection(options.selection);
  } catch (error) {
    return errorResult_(400, error, "invalid-pumble-notification-types");
  }

  const transactionResult = await options.firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(options.userRef);
        assertActiveUser_(snapshot);
        const userData = snapshot.data() || {};
        const eligibility = getAdminPumbleNotificationEligibility(userData);
        const forbiddenTypes = Object.keys(selection).filter((type) => {
          return selection[type] && !eligibility[type];
        });
        const pumbleConnection = options.serializePumbleConnection(userData);
        if (forbiddenTypes.length) {
          return {forbiddenTypes, eligibility, pumbleConnection};
        }
        if ((selection.changeRequests || selection.serveNeeds) &&
          !pumbleConnection.linked) {
          return {conflict: true, eligibility, pumbleConnection};
        }

        const current = normalizeChangeRequestNotificationPreferences(
            userData.notificationPreferences &&
            userData.notificationPreferences.changeRequests,
        );
        const nextChangeRequests = {
          email: current.email || !selection.changeRequests,
          pumble: selection.changeRequests,
        };
        transaction.update(options.userRef, {
          "notificationPreferences.changeRequests": nextChangeRequests,
          "notificationPreferences.serveNeeds.pumble": selection.serveNeeds,
          "notificationPreferences.updatedAt":
            options.fieldValue.serverTimestamp(),
          "updatedAt": options.fieldValue.serverTimestamp(),
        });
        return {
          eligibility,
          pumbleConnection,
          preferences: serializeChangeRequestNotificationPreferences(
              nextChangeRequests,
          ),
          pumbleNotifications: selection,
          message: "Pumble notification preferences saved.",
        };
      },
  );

  if (transactionResult.forbiddenTypes &&
    transactionResult.forbiddenTypes.length) {
    return {
      status: 403,
      error: {
        error:
          "Your current Admin access does not allow one of those " +
          "notification types.",
        code: "notification-type-forbidden",
        eligibility: transactionResult.eligibility,
      },
    };
  }
  if (transactionResult.conflict) {
    return {
      status: 409,
      error: {
        error: "Link your Pumble account before enabling notifications.",
        code: "pumble-not-linked",
        pumbleConnection: transactionResult.pumbleConnection,
      },
    };
  }
  return transactionResult;
}

/**
 * Updates the current reviewer's Change Request delivery channels.
 *
 * @param {Object} options Transaction and serialization dependencies.
 * @return {Promise<Object>} Serialized preferences or an HTTP error result.
 */
async function updateChangeRequestChannels_(options) {
  if (!Array.isArray(options.channels)) {
    return {
      status: 400,
      error: {
        error: "Notification channels must be an array.",
        code: "invalid-notification-channels",
      },
    };
  }

  let selection;
  try {
    selection = normalizeChangeRequestNotificationChannelSelection(
        options.channels,
    );
  } catch (error) {
    return errorResult_(400, error, "invalid-notification-channels");
  }
  const preferences = serializeChangeRequestNotificationPreferences(selection);
  if (!preferences.channels.length) {
    return {
      status: 400,
      error: {
        error: "Choose Email, Pumble, or both.",
        code: "notification-channel-required",
      },
    };
  }

  const transactionResult = await options.firestore.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(options.userRef);
        assertActiveUser_(snapshot);
        const userData = snapshot.data() || {};
        const eligibility = getAdminPumbleNotificationEligibility(userData);
        if (!eligibility.changeRequests) return {forbidden: true};
        const pumbleConnection = options.serializePumbleConnection(userData);
        if (selection.pumble && !pumbleConnection.linked) {
          return {conflict: true, pumbleConnection};
        }

        transaction.update(options.userRef, {
          "notificationPreferences.changeRequests": selection,
          "notificationPreferences.updatedAt":
            options.fieldValue.serverTimestamp(),
          "updatedAt": options.fieldValue.serverTimestamp(),
        });
        return {
          eligibility,
          pumbleConnection,
          preferences,
          pumbleNotifications: {
            changeRequests: selection.pumble,
            serveNeeds:
              getAdminPumbleNotificationPreferences(userData).serveNeeds,
          },
          message: "Change Request notification preferences saved.",
        };
      },
  );

  if (transactionResult.forbidden) {
    return {
      status: 403,
      error: {
        error:
          "Your current Admin access does not allow Change Request " +
          "notifications.",
        code: "change-request-review-forbidden",
      },
    };
  }
  if (transactionResult.conflict) {
    return {
      status: 409,
      error: {
        error: "Link your Pumble account before selecting Pumble.",
        code: "pumble-not-linked",
        pumbleConnection: transactionResult.pumbleConnection,
      },
    };
  }
  return transactionResult;
}

/**
 * Serializes the safe notification settings response.
 *
 * @param {Object} userData Admin user document data.
 * @param {Function} serializePumbleConnection Connection serializer.
 * @return {Object} Safe client response fields.
 */
function serializeResponse_(userData, serializePumbleConnection) {
  return {
    preferences: serializeChangeRequestNotificationPreferences(
        userData.notificationPreferences &&
        userData.notificationPreferences.changeRequests,
    ),
    pumbleNotifications: getAdminPumbleNotificationPreferences(userData),
    eligibility: getAdminPumbleNotificationEligibility(userData),
    pumbleConnection: serializePumbleConnection(userData),
  };
}

/**
 * Ensures the Admin user record still exists and is active.
 *
 * @param {Object} snapshot Firestore document snapshot.
 * @return {void}
 */
function assertActiveUser_(snapshot) {
  if (snapshot.exists && snapshot.get("active") === true) return;
  const error = new Error("Your admin access record is unavailable.");
  error.code = "admin-access-required";
  error.status = 403;
  throw error;
}

/**
 * Builds a normalized handler error result.
 *
 * @param {number} status HTTP status code.
 * @param {Error} error Original error.
 * @param {string} code Stable client error code.
 * @return {Object} Handler error result.
 */
function errorResult_(status, error, code) {
  return {
    status,
    error: {
      error: String(error && error.message ||
        "Notification preferences are unavailable."),
      code,
    },
  };
}

/**
 * Determines a safe HTTP status for a handler failure.
 *
 * @param {Error} error Handler failure.
 * @return {number} HTTP status code.
 */
function getErrorStatus_(error) {
  const explicit = Number(error && (error.status || error.statusCode));
  if (explicit >= 400 && explicit <= 599) return explicit;
  return error && error.code === "admin-access-required" ? 403 : 500;
}

/**
 * Requires a function dependency.
 *
 * @param {*} value Candidate dependency.
 * @param {string} label Dependency label.
 * @return {Function} Validated dependency.
 */
function requireFunction_(value, label) {
  if (typeof value === "function") return value;
  throw new Error("Admin notification preferences require " + label + ".");
}

/**
 * Requires an object dependency.
 *
 * @param {*} value Candidate dependency.
 * @param {string} label Dependency label.
 * @return {Object} Validated dependency.
 */
function requireObject_(value, label) {
  if (value && typeof value === "object") return value;
  throw new Error("Admin notification preferences require " + label + ".");
}
