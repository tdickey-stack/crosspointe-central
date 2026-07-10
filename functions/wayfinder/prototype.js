import {rankWayfinderKnowledge} from "./retrieval.js";

const ALLOWED_PERMISSIONS = new Set([
  "view",
  "propose",
  "edit",
  "approve",
  "admin",
]);

export function createWayfinderPrototypeHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const isAllowedAdminEmail = dependencies.isAllowedAdminEmail;
  const getAdminUserDocPath = dependencies.getAdminUserDocPath;

  return async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    const token = getBearerToken_(request.headers.authorization);
    if (!token) {
      response.status(401).json({
        error: "Missing Firebase ID token. Sign in again and retry.",
      });
      return;
    }

    let decodedToken = null;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      response.status(401).json({
        error: "Your Firebase sign-in expired. Sign in again and retry.",
      });
      return;
    }

    try {
      await verifyPrototypeAccess_(
          decodedToken,
          firestore,
          isAllowedAdminEmail,
          getAdminUserDocPath,
      );

      const body = request.body && typeof request.body === "object" ?
        request.body : {};
      const question = String(body.question || "").trim();

      if (!question) {
        response.status(400).json({error: "Enter a question to test."});
        return;
      }

      if (question.length > 500) {
        response.status(400).json({
          error: "Prototype questions must be 500 characters or fewer.",
        });
        return;
      }

      const snapshot = await firestore
          .collection("centralAssistantKnowledgeDraft")
          .limit(250)
          .get();
      const entries = snapshot.docs
          .map((document) => document.data())
          .filter((entry) => {
            return entry &&
              entry.approvalStatus === "approved" &&
              entry.publicationState === "draft";
          });
      const retrieval = rankWayfinderKnowledge(question, entries, {limit: 5});

      response.status(200).json({
        ok: true,
        prototype: true,
        mode: "retrieval-only",
        question: retrieval.question,
        confidence: retrieval.confidence,
        knowledgeEntryCount: entries.length,
        results: retrieval.results,
        notice: "No Gemini response was generated.",
      });
    } catch (error) {
      const status = error && error.statusCode || 500;
      response.status(status).json({
        error: status === 500 ?
          "Unable to run the Wayfinder prototype." :
          String(error.message || "Wayfinder prototype access denied."),
      });
    }
  };
}

async function verifyPrototypeAccess_(
    decodedToken,
    firestore,
    isAllowedAdminEmail,
    getAdminUserDocPath,
) {
  const email = String(decodedToken && decodedToken.email || "")
      .trim()
      .toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    throw createAccessError_(
        403,
        "Use an approved CrossPointe admin account to test Wayfinder.",
    );
  }

  const userSnapshot = await firestore
      .doc(getAdminUserDocPath(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createAccessError_(
        403,
        "Your Central admin access must be active to test Wayfinder.",
    );
  }

  const pageAccess = userSnapshot.get("pageAccess") || {};
  const permission = String(
      pageAccess.integrations || pageAccess.settings || "none",
  ).trim().toLowerCase();

  if (!ALLOWED_PERMISSIONS.has(permission)) {
    throw createAccessError_(
        403,
        "Your current admin access does not include the Wayfinder prototype.",
    );
  }
}

function getBearerToken_(authorizationHeader) {
  const value = String(authorizationHeader || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}

function createAccessError_(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
