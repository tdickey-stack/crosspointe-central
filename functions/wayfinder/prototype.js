import {rankWayfinderKnowledge} from "./retrieval.js";
import {authenticateWayfinderAdminRequest} from "./access.js";
import {applyWayfinderKnowledgeOverrides} from "./knowledge-overrides.js";

export function createWayfinderPrototypeHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const isAllowedAdminEmail = dependencies.isAllowedAdminEmail;
  const getAdminUserDocPath = dependencies.getAdminUserDocPath;
  const getActiveKnowledgeOverrides =
    dependencies.getActiveKnowledgeOverrides;

  return async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      await authenticateWayfinderAdminRequest({
        request: request,
        admin: admin,
        firestore: firestore,
        isAllowedAdminEmail: isAllowedAdminEmail,
        getAdminUserDocPath: getAdminUserDocPath,
      });

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

      const [snapshot, activeOverrides] = await Promise.all([
        firestore.collection("centralAssistantKnowledgeDraft")
            .limit(250)
            .get(),
        typeof getActiveKnowledgeOverrides === "function" ?
          getActiveKnowledgeOverrides() : [],
      ]);
      const entries = applyWayfinderKnowledgeOverrides(snapshot.docs
          .map((document) => document.data())
          .filter((entry) => {
            return entry &&
              entry.approvalStatus === "approved" &&
              entry.publicationState === "draft";
          }), activeOverrides);
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
