import assert from "node:assert/strict";
import test from "node:test";

import {createWayfinderPublicFeedbackHandler} from "./feedback.js";

test("public feedback stores a bounded helpful rating", async () => {
  const writes = [];
  const handler = createWayfinderPublicFeedbackHandler({
    firestore: createFeedbackFirestore_(writes),
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });
  const response = createResponse_();

  await handler({
    method: "POST",
    headers: {"x-forwarded-for": "192.0.2.10"},
    ip: "192.0.2.10",
    body: {
      responseId: "response-12345",
      question: "What time is church?",
      answer: "Services are at 9:00 and 10:30 AM.",
      rating: "helpful",
      links: [],
      actions: [{
        type: "event_details",
        id: "featured-event:converge-2026",
        label: "View Converge 2026",
        event: {
          title: "Converge 2026",
          date: "Jul 30, 2026",
          time: "12:00 PM",
          registrationUrl: "https://ru.edu/converge",
          registrationLabel: "Sign Up Today!",
          description: "This larger field is intentionally not stored.",
        },
      }],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.rating, "helpful");
  assert.equal(writes[0].data.status, "recorded");
  assert.deepEqual(writes[0].data.actions, [{
    type: "event_details",
    id: "featured-event:converge-2026",
    label: "View Converge 2026",
    event: {
      title: "Converge 2026",
      date: "Jul 30, 2026",
      time: "12:00 PM",
      registrationUrl: "https://ru.edu/converge",
      registrationLabel: "Sign Up Today!",
    },
  }]);
  assert.equal("ip" in writes[0].data, false);
  assert.equal("email" in writes[0].data, false);
});

test("needs-work feedback requires a useful reason", async () => {
  const writes = [];
  const handler = createWayfinderPublicFeedbackHandler({
    firestore: createFeedbackFirestore_(writes),
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });
  const response = createResponse_();

  await handler({
    method: "POST",
    headers: {"x-forwarded-for": "192.0.2.11"},
    ip: "192.0.2.11",
    body: {
      responseId: "response-67890",
      question: "Where is the church?",
      answer: "I do not know.",
      rating: "needs_work",
      reason: "",
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /choose what/i);
  assert.equal(writes.length, 0);
});

test("needs-work feedback stores its category and optional note", async () => {
  const writes = [];
  const handler = createWayfinderPublicFeedbackHandler({
    firestore: createFeedbackFirestore_(writes),
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });
  const response = createResponse_();

  await handler({
    method: "POST",
    headers: {"x-forwarded-for": "192.0.2.12"},
    ip: "192.0.2.12",
    body: {
      responseId: "response-abcde",
      question: "Where is the church?",
      answer: "I do not know.",
      rating: "needs_work",
      reason: "missing_information",
      note: "It should have used the location document.",
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(writes[0].data.reason, "missing_information");
  assert.equal(
      writes[0].data.note,
      "It should have used the location document.",
  );
});

function createFeedbackFirestore_(writes) {
  return {
    collection: () => ({
      doc: (id) => ({
        get: async () => ({exists: false}),
        set: async (data, options) => {
          writes.push({id: id, data: data, options: options});
        },
      }),
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
