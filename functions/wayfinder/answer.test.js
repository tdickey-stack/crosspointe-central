import assert from "node:assert/strict";
import test from "node:test";

import {createWayfinderAnswerHandler} from "./answer.js";
import {flattenWayfinderBundles} from "./knowledge.js";
import {loadWayfinderBundles} from "../scripts/wayfinder-bundles.js";

const flattened = flattenWayfinderBundles(await loadWayfinderBundles());
const entries = flattened.entries.map((entry) => entry.data);
const policy = flattened.policies[0].data;

test("crisis policy skips Gemini", async () => {
  let generatorCalls = 0;
  const response = await runHandler_(
      "I am thinking about suicide",
      async () => {
        generatorCalls += 1;
        return null;
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "policy-answer");
  assert.equal(response.body.policyRoute, "crisis");
  assert.equal(response.body.modelUsed, false);
  assert.equal(generatorCalls, 0);
  assert.match(response.body.answer, /988/);
});

test("CARS transmission question uses approved grounded fallback", async () => {
  let generatorCalls = 0;
  const response = await runHandler_(
      "Can you repair the transmission in my car?",
      async () => {
        generatorCalls += 1;
        return null;
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "knowledge-fallback");
  assert.equal(response.body.modelUsed, false);
  assert.equal(generatorCalls, 1);
  assert.match(response.body.answer, /transmission/i);
});

test("date question waits for live Planning Center data", async () => {
  let generatorCalls = 0;
  const response = await runHandler_(
      "When is the next Starting Pointe?",
      async () => {
        generatorCalls += 1;
        return null;
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "live_source_required");
  assert.equal(response.body.modelUsed, false);
  assert.equal(generatorCalls, 0);
});

test("verified live event context is sent to Gemini", async () => {
  let selectedIds = [];
  const response = await runHandler_(
      "What events are coming up?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "Starting Pointe is Tuesday, July 14 at 6:00 PM.",
          sourceEntryIds: ["live-event-123"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      async () => ({
        statuses: {planning_center_event: "ok"},
        entries: [{
          id: "live-event-123",
          topic: "live_events",
          title: "Starting Pointe",
          responseMode: "guided",
          requiredFacts: [
            "Starting Pointe is Tuesday, July 14 at 6:00 PM.",
          ],
          approvedLinks: [{
            label: "Starting Pointe",
            url: "https://crosspointetv.churchcenter.com/calendar/event/123",
          }],
        }],
      }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.ok(selectedIds.includes("live-event-123"));
  assert.equal(response.body.sourceCards[0].id, "live-event-123");
});

test("verified published Pointe Groups are sent to Gemini", async () => {
  let requestedSourceTypes = [];
  const response = await runHandler_(
      "What Pointe Groups meet on Tuesday?",
      async () => ({
        answer: "Young Adults meets Tuesdays at 7:00 PM.",
        sourceEntryIds: ["live-group-44"],
        shouldContactChurch: false,
        followUpQuestion: "",
      }),
      async ({sourceTypes}) => {
        requestedSourceTypes = sourceTypes;
        return {
          statuses: {planning_center_groups: "ok"},
          entries: [{
            id: "live-group-44",
            topic: "pointe_groups",
            title: "Young Adults",
            responseMode: "guided",
            requiredFacts: ["Young Adults meets Tuesdays at 7:00 PM."],
            approvedLinks: [{
              label: "Young Adults",
              url: "https://crosspointetv.churchcenter.com/groups/pointe-groups/young-adults",
            }],
          }],
        };
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.deepEqual(requestedSourceTypes, ["planning_center_groups"]);
  assert.equal(response.body.sourceCards[0].id, "live-group-44");
});

test("approved static question is sent to Gemini", async () => {
  let selectedIds = [];
  const response = await runHandler_(
      "Do I have to dress up for church?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "Come as you are. CrossPointe is casual and welcoming.",
          sourceEntryIds: ["visiting-what-to-wear"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.equal(response.body.modelUsed, true);
  assert.equal(response.body.sourceCards[0].id, "visiting-what-to-wear");
  assert.ok(selectedIds.includes("visiting-what-to-wear"));
});

test("normal prayer-list question is sent to grounded Gemini", async () => {
  let selectedIds = [];
  const response = await runHandler_(
      "How do I get added to the prayer list?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "You can submit the approved Prayer Request Form.",
          sourceEntryIds: ["care-prayer-request-submit"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.equal(response.body.modelUsed, true);
  assert.ok(selectedIds.includes("care-prayer-request-submit"));
});

test("approved static question falls back to verified facts", async () => {
  const response = await runHandler_(
      "What time is church?",
      async () => {
        const error = new Error("No local Gemini key");
        error.code = "missing-api-key";
        throw error;
      },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "knowledge-fallback");
  assert.equal(response.body.modelUsed, false);
  assert.match(response.body.answer, /9:00 AM/);
  assert.match(response.body.answer, /10:30 AM/);
  assert.equal(
      response.body.sourceCards[0].id,
      "visiting-sunday-service-times",
  );
});

async function runHandler_(question, generateAnswer, retrieveLiveContext) {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    admin: {
      auth: () => ({
        verifyIdToken: async () => ({
          uid: "wayfinder-test-uid-" + Math.random(),
          email: "tester@crosspointe.tv",
        }),
      }),
    },
    firestore: createFirestore_(),
    isAllowedAdminEmail: () => true,
    getAdminUserDocPath: (uid) => "centralAdmin/root/users/" + uid,
    generateAnswer: generateAnswer,
    retrieveLiveContext: retrieveLiveContext,
    model: "gemini-3.5-flash",
  });

  await handler({
    method: "POST",
    headers: {authorization: "Bearer local-test-token"},
    body: {question: question},
  }, response);
  return response;
}

function createFirestore_() {
  return {
    collection: () => ({
      limit: () => ({
        get: async () => ({
          docs: entries.map((entry) => ({data: () => entry})),
        }),
      }),
    }),
    doc: (path) => ({
      get: async () => {
        if (path === "centralAssistantConfigDraft/document-00") {
          return {exists: true, data: () => policy};
        }
        return {
          exists: true,
          get: (field) => {
            if (field === "active") return true;
            if (field === "pageAccess") return {integrations: "admin"};
            return undefined;
          },
        };
      },
    }),
  };
}

function createResponse_() {
  return {
    statusCode: 200,
    body: null,
    set: () => {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
