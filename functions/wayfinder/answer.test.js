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

test("a follow-up retrieves live details from recent context", async () => {
  const history = [{
    role: "user",
    content: "When is Starting Pointe?",
  }, {
    role: "assistant",
    content: "Starting Pointe is scheduled for Tuesday, July 14.",
  }];
  let liveQuestion = "";
  let generatorHistory = [];
  const response = await runHandler_(
      "What time does it start?",
      async (context) => {
        generatorHistory = context.conversationHistory;
        return {
          answer: "It starts at 6:00 PM.",
          sourceEntryIds: ["live-event-123"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      async ({question}) => {
        liveQuestion = question;
        return {
          statuses: {planning_center_event: "ok"},
          entries: [{
            id: "live-event-123",
            topic: "live_events",
            title: "Starting Pointe",
            responseMode: "guided",
            requiredFacts: ["Starting Pointe starts at 6:00 PM."],
            approvedLinks: [],
          }],
        };
      },
      undefined,
      undefined,
      history,
  );

  assert.equal(response.statusCode, 200);
  assert.match(liveQuestion, /Starting Pointe/);
  assert.deepEqual(generatorHistory, history);
  assert.match(response.body.answer, /6:00 PM/);
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

test("pronoun follow-up retrieves the person from recent context", async () => {
  const history = [{
    role: "user",
    content: "Who is the lead pastor?",
  }, {
    role: "assistant",
    content: "Chris Todd is CrossPointe's Lead Pastor.",
  }];
  let selectedIds = [];
  const response = await runHandler_(
      "What does he do?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "He provides leadership and spiritual guidance.",
          sourceEntryIds: ["staff-pastoral-worship-and-students"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      undefined,
      undefined,
      undefined,
      history,
  );

  assert.equal(response.statusCode, 200);
  assert.ok(selectedIds.includes("staff-pastoral-worship-and-students"));
  assert.match(response.body.answer, /leadership/i);
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

test("active notice is placed ahead of approved knowledge", async () => {
  let selectedIds = [];
  const response = await runHandler_(
      "Is the Care Center open Friday?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "The Care Center will be closed this Friday.",
          sourceEntryIds: ["active-notice-notice-1"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      undefined,
      async () => [{
        id: "notice-1",
        title: "Care Center closed Friday",
        publicMessage: "The Care Center will be closed this Friday.",
        topic: "care_center",
        keywords: ["care center", "Friday"],
        overrideTargets: ["knowledge"],
        startsAt: new Date("2026-07-11T15:00:00.000Z"),
        expiresAt: new Date("2026-07-18T04:59:59.000Z"),
      }],
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.equal(response.body.confidence, "high");
  assert.equal(selectedIds[0], "active-notice-notice-1");
  assert.equal(response.body.sourceCards[0].id, "active-notice-notice-1");
});

test("active permanent override replaces imported knowledge", async () => {
  let selectedEntry = null;
  const response = await runHandler_(
      "What time is the second Sunday service?",
      async (context) => {
        selectedEntry = context.entries[0];
        return {
          answer: "The second Sunday service begins at 11:00 AM.",
          sourceEntryIds: [selectedEntry.id],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      undefined,
      undefined,
      async () => [{
        id: "visiting-sunday-service-times",
        revision: 1,
        entry: {
          ...entries.find((entry) => {
            return entry.id === "visiting-sunday-service-times";
          }),
          requiredFacts: [
            "The second Sunday service begins at 11:00 AM.",
          ],
        },
      }],
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.ok(selectedEntry);
  assert.match(selectedEntry.requiredFacts[0], /11:00 AM/);
});

test("public answer omits admin auth and lab diagnostics", async () => {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
    generateAnswer: async () => ({
      answer: "Sunday services begin at 9:00 and 10:30 AM.",
      sourceEntryIds: ["visiting-sunday-service-times"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }),
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-test-session-123"},
    ip: "127.0.0.22",
    body: {question: "What time is church?"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.body.answer, /9:00/);
  assert.equal(Object.hasOwn(response.body, "results"), false);
  assert.equal(Object.hasOwn(response.body, "sourceCards"), false);
  assert.equal(Object.hasOwn(response.body, "model"), false);
});

test("public answer exposes links without source data", async () => {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
    generateAnswer: async () => ({
      answer: "Both normal Sunday services are livestreamed.",
      sourceEntryIds: ["visiting-watch-online"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }),
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-links-test-123"},
    ip: "127.0.0.24",
    body: {question: "Where can I watch online?"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.links.length, 1);
  assert.match(response.body.links[0].url, /crosspointe\.tv\/church-online/);
  assert.equal(Object.hasOwn(response.body, "sourceCards"), false);
});

test("group-directory question returns the website directly", async () => {
  let liveCalls = 0;
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
    generateAnswer: async () => ({
      answer: "You can browse every current Pointe Group on our directory.",
      sourceEntryIds: ["groups-live-directory"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }),
    retrieveLiveContext: async () => {
      liveCalls += 1;
      return {statuses: {}, entries: []};
    },
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-group-directory-test-123"},
    ip: "127.0.0.27",
    body: {question: "Is there a place to see every small group?"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(liveCalls, 0);
  assert.equal(response.body.links.length, 1);
  assert.match(response.body.links[0].url, /crosspointe\.tv\/small-groups/);
});

test("website index grounds a question with no curated match", async () => {
  let selectedIds = [];
  const response = await runHandler_(
      "Where can I find Behind the Crown?",
      async (context) => {
        selectedIds = context.entries.map((entry) => entry.id);
        return {
          answer: "You can find Behind the Crown on the linked page below.",
          sourceEntryIds: ["website-behind-the-crown-00"],
          shouldContactChurch: false,
          followUpQuestion: "",
        };
      },
      undefined,
      undefined,
      undefined,
      [],
      async () => [{
        id: "website-behind-the-crown-00",
        topic: "website_content",
        title: "Behind the Crown",
        responseMode: "guided",
        allowedPublicFacts: ["CrossPointe has a Behind the Crown page."],
        approvedLinks: [{
          label: "Behind the Crown",
          url: "https://www.crosspointe.tv/behind-the-crown",
        }],
        sourceAuthority: "supplemental",
        websiteScore: 20,
        matchedTerms: ["crown"],
      }],
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mode, "gemini-grounded");
  assert.ok(selectedIds.includes("website-behind-the-crown-00"));
  assert.equal(
      response.body.sourceCards.find((card) => {
        return card.id === "website-behind-the-crown-00";
      }).topic,
      "website_content",
  );
});

test("public answer returns only the requested platform link", async () => {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
    generateAnswer: async () => ({
      answer: "Yes. CrossPointe's Instagram handle is @crosspointe.tv.",
      sourceEntryIds: ["visiting-social-media"],
      shouldContactChurch: false,
      followUpQuestion: "Would you like our other social media links?",
    }),
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-instagram-test-123"},
    ip: "127.0.0.25",
    body: {question: "Do you have Instagram?"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.links.length, 1);
  assert.match(response.body.links[0].url, /instagram/i);
  assert.equal(response.body.followUpQuestion, "");
});

test("other-socials follow-up excludes the prior platform", async () => {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
    generateAnswer: async () => ({
      answer: "CrossPointe is also on YouTube, Facebook, and TikTok.",
      sourceEntryIds: ["visiting-social-media"],
      shouldContactChurch: false,
      followUpQuestion: "",
    }),
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-other-socials-test-123"},
    ip: "127.0.0.26",
    body: {
      question: "What other socials do you have?",
      history: [{
        role: "user",
        content: "Do you have Instagram?",
      }, {
        role: "assistant",
        content: "Yes. Our Instagram handle is @crosspointe.tv.",
      }],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(
      response.body.links.length,
      3,
      JSON.stringify(response.body),
  );
  assert.equal(response.body.links.some((link) => {
    return /instagram/i.test(link.url);
  }), false);
  assert.equal(response.body.links.some((link) => {
    return /tiktok/i.test(link.url);
  }), true);
});

test("public answer rejects oversized conversation history", async () => {
  const response = createResponse_();
  const handler = createWayfinderAnswerHandler({
    firestore: createFirestore_(),
    requireAdminAuth: false,
    publicResponse: true,
  });

  await handler({
    method: "POST",
    headers: {"x-wayfinder-session": "public-history-test-123"},
    ip: "127.0.0.23",
    body: {
      question: "What time is church?",
      history: Array.from({length: 9}, () => ({
        role: "user",
        content: "Previous question",
      })),
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /history is invalid/i);
});

async function runHandler_(
    question,
    generateAnswer,
    retrieveLiveContext,
    getActiveNotices,
    getActiveKnowledgeOverrides,
    history = [],
    getWebsiteEntries,
) {
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
    getActiveNotices: getActiveNotices,
    getActiveKnowledgeOverrides: getActiveKnowledgeOverrides,
    getWebsiteEntries: getWebsiteEntries,
    model: "gemini-3.5-flash",
  });

  await handler({
    method: "POST",
    headers: {authorization: "Bearer local-test-token"},
    body: {question: question, history: history},
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
