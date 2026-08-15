import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirestoreWayfinderBetaService,
  createWayfinderBetaAdminHandler,
  createWayfinderBetaAnswerHandler,
  createWayfinderBetaFeedbackHandler,
  createWayfinderBetaRedeemHandler,
  hashWayfinderBetaToken,
} from "./beta-access.js";

test("legacy beta settings adopt the 20-browser cohort default", async () => {
  const fixture = createServiceFixture_();
  fixture.firestore.records.set("centralAssistantBetaConfig/settings", {
    betaEnabled: true,
    defaultMaxActivations: 3,
  });

  const config = await fixture.service.getConfig();
  assert.equal(config.defaultMaxActivations, 20);
  assert.equal(config.configVersion, 2);

  const invite = await fixture.service.createInvite({
    label: "Small cohort",
    expiresInDays: 30,
  }, adminIdentity_());
  assert.equal(invite.maxActivations, 20);
});

test("current beta settings preserve an intentional cohort size", async () => {
  const fixture = createServiceFixture_();
  fixture.firestore.records.set("centralAssistantBetaConfig/settings", {
    configVersion: 2,
    defaultMaxActivations: 8,
  });

  const config = await fixture.service.getConfig();
  assert.equal(config.defaultMaxActivations, 8);
});

test("reusable invitations create bounded browser sessions", async () => {
  const fixture = createServiceFixture_();
  await fixture.service.updateConfig({
    betaEnabled: true,
    sessionDays: 30,
  }, adminIdentity_());
  const invite = await fixture.service.createInvite({
    label: "Community leaders",
    maxActivations: 2,
    expiresInDays: 45,
  }, adminIdentity_());

  assert.match(invite.token, /^[A-Za-z0-9_-]{32,100}$/);
  assert.equal(invite.inviteRecordId, hashWayfinderBetaToken(invite.token));
  assert.equal(
      JSON.stringify([...fixture.firestore.records.values()])
          .includes(invite.token),
      false,
  );

  const first = await fixture.service.redeemInvite({token: invite.token});
  assert.match(first.access.accessId, /^WF-BETA-[A-Z0-9]{8}$/);
  assert.equal(first.access.expiresAt, "2026-09-13T15:00:00.000Z");
  assert.equal(
      JSON.stringify([...fixture.firestore.records.values()])
          .includes(first.sessionToken),
      false,
  );

  const reused = await fixture.service.redeemInvite({
    token: invite.token,
    existingSessionToken: first.sessionToken,
  });
  assert.equal(reused.access.accessId, first.access.accessId);
  const inviteRecord = fixture.firestore.records.get(
      "centralAssistantBetaInvites/" + invite.inviteRecordId,
  );
  assert.equal(inviteRecord.activationCount, 1);

  await fixture.service.redeemInvite({token: invite.token});
  await assert.rejects(
      fixture.service.redeemInvite({token: invite.token}),
      (error) => error.statusCode === 403 &&
        /access limit/i.test(error.message),
  );
});

test("beta quotas enforce cooldown, access, and global limits", async () => {
  const fixture = createServiceFixture_();
  await fixture.service.updateConfig({
    betaEnabled: true,
    perAccessDailyLimit: 2,
    globalDailyLimit: 2,
  }, adminIdentity_());
  const invite = await fixture.service.createInvite({
    label: "Quota test",
    maxActivations: 2,
    expiresInDays: 30,
  }, adminIdentity_());
  const first = await fixture.service.redeemInvite({token: invite.token});

  const firstUsage = await fixture.service.consumeQuestion(first.access);
  assert.equal(firstUsage.remainingToday, 1);
  await assert.rejects(
      fixture.service.consumeQuestion(first.access),
      (error) => error.statusCode === 429 &&
        /wait a moment/i.test(error.message),
  );

  fixture.advance(3000);
  const secondUsage = await fixture.service.consumeQuestion(first.access);
  assert.equal(secondUsage.remainingToday, 0);
  fixture.advance(3000);
  await assert.rejects(
      fixture.service.consumeQuestion(first.access),
      (error) => error.statusCode === 429 &&
        /question limit/i.test(error.message),
  );

  const second = await fixture.service.redeemInvite({token: invite.token});
  fixture.advance(3000);
  await assert.rejects(
      fixture.service.consumeQuestion(second.access),
      (error) => error.statusCode === 429 &&
        /beta capacity/i.test(error.message),
  );
});

test("conversations mask contact details and support revocation", async () => {
  const fixture = createServiceFixture_();
  await fixture.service.updateConfig({
    betaEnabled: true,
    transcriptRetentionDays: 30,
  }, adminIdentity_());
  const invite = await fixture.service.createInvite({
    label: "Privacy test",
    maxActivations: 1,
    expiresInDays: 30,
  }, adminIdentity_());
  const redeemed = await fixture.service.redeemInvite({token: invite.token});
  await fixture.service.recordConversation(redeemed.access, {
    responseId: "response-private-123",
    question: "Email me at person@example.com or 615-555-0199.",
    answer: "Sure, I will use person@example.com and (615) 555-0199.",
    modelUsed: true,
    statusCode: 200,
  });
  await fixture.service.recordFeedback(redeemed.access, {
    responseId: "response-private-123",
    rating: "needs_work",
    reason: "incorrect_information",
    note: "Call me at 615.555.0199.",
  });
  await fixture.service.recordFeedback(redeemed.access, {
    responseId: "response-private-123",
    rating: "helpful",
  });

  const dashboard = await fixture.service.getDashboard();
  const history = await fixture.service.getConversationHistory({
    accessId: redeemed.access.accessId,
  });
  assert.equal(history.conversations.length, 1);
  assert.equal(
      history.conversations[0].question,
      "Email me at [email removed] or [phone removed].",
  );
  assert.equal(
      history.conversations[0].answer,
      "Sure, I will use person@example.com and (615) 555-0199.",
  );
  assert.equal(history.conversations[0].feedbackRating, "helpful");
  assert.equal(dashboard.access[0].feedbackCount, 2);
  assert.equal(
      history.conversations[0].expiresAt,
      "2026-09-13T15:00:00.000Z",
  );

  await fixture.service.revokeAccess(redeemed.access.sessionRecordId);
  await assert.rejects(
      fixture.service.authenticateSessionToken(redeemed.sessionToken),
      (error) => error.statusCode === 403 && /revoked/i.test(error.message),
  );
});

test("per-user history pages through every retained interaction", async () => {
  const fixture = createServiceFixture_();
  await fixture.service.updateConfig({betaEnabled: true}, adminIdentity_());
  const invite = await fixture.service.createInvite({
    label: "Pagination test",
    maxActivations: 1,
    expiresInDays: 30,
  }, adminIdentity_());
  const redeemed = await fixture.service.redeemInvite({token: invite.token});
  for (let index = 0; index < 51; index += 1) {
    await fixture.service.recordConversation(redeemed.access, {
      responseId: "response-page-" + String(index).padStart(3, "0"),
      question: "Question " + String(index),
      answer: "Answer " + String(index),
      statusCode: 200,
    });
  }

  const firstPage = await fixture.service.getConversationHistory({
    accessId: redeemed.access.accessId,
  });
  assert.equal(firstPage.conversations.length, 50);
  assert.equal(firstPage.conversationPage.hasMore, true);
  assert.ok(firstPage.conversationPage.nextCursor);

  const secondPage = await fixture.service.getConversationHistory({
    accessId: redeemed.access.accessId,
    conversationCursor: firstPage.conversationPage.nextCursor,
  });
  assert.equal(secondPage.conversations.length, 1);
  assert.equal(secondPage.conversationPage.hasMore, false);
  assert.equal(
      firstPage.conversations.some((item) => {
        return item.id === secondPage.conversations[0].id;
      }),
      false,
  );
});

test("conversation history rejects malformed Access IDs", async () => {
  const fixture = createServiceFixture_();
  await assert.rejects(
      fixture.service.getConversationHistory({accessId: "not-an-access-id"}),
      (error) => error.statusCode === 400 && /valid/i.test(error.message),
  );
});

test("beta handlers issue secure cookies and retain every answer", async () => {
  const fixture = createServiceFixture_();
  await fixture.service.updateConfig({betaEnabled: true}, adminIdentity_());
  const invite = await fixture.service.createInvite({
    label: "Handler test",
    maxActivations: 1,
    expiresInDays: 30,
  }, adminIdentity_());
  const redeemResponse = createResponse_();
  await createWayfinderBetaRedeemHandler({service: fixture.service})({
    method: "POST",
    headers: {
      "origin": "https://central.crosspointe.tv",
      "x-forwarded-proto": "https",
    },
    body: {token: invite.token},
  }, redeemResponse);

  assert.equal(redeemResponse.statusCode, 200);
  assert.match(redeemResponse.body.sessionToken, /^[A-Za-z0-9_-]{32,100}$/);
  const cookie = redeemResponse.headers.get("Set-Cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  const sessionToken = redeemResponse.body.sessionToken;

  const answerResponse = createResponse_();
  await createWayfinderBetaAnswerHandler({
    service: fixture.service,
    answerHandler: async (request, response) => {
      response.status(200).json({
        ok: true,
        responseId: "response-handler-123",
        answer: "Contact person@example.com.",
        answerMode: "generated",
        modelUsed: true,
      });
    },
  })({
    method: "POST",
    headers: {cookie: "__session=" + sessionToken},
    body: {question: "My number is 615-555-0199."},
  }, answerResponse);

  assert.equal(answerResponse.statusCode, 200);
  const conversation = fixture.firestore.records.get(
      "centralAssistantBetaConversations/response-handler-123",
  );
  assert.equal(conversation.question, "My number is [phone removed].");
  assert.equal(conversation.answer, "Contact person@example.com.");
});

test("beta feedback masks contact details before shared storage", async () => {
  let forwardedBody = null;
  let recordedBody = null;
  const service = {
    authenticateSessionToken: async () => ({
      accessId: "WF-BETA-12345678",
    }),
    recordFeedback: async (access, body) => {
      recordedBody = body;
    },
  };
  const response = createResponse_();
  await createWayfinderBetaFeedbackHandler({
    service,
    feedbackHandler: async (request, capturedResponse) => {
      forwardedBody = request.body;
      capturedResponse.status(200).json({ok: true});
    },
  })({
    method: "POST",
    headers: {cookie: "__session=" + "a".repeat(43)},
    body: {
      responseId: "response-feedback-123",
      question: "Email person@example.com",
      answer: "Call 615-555-0199",
      note: "person@example.com",
    },
  }, response);

  assert.equal(forwardedBody.question, "Email [email removed]");
  assert.equal(forwardedBody.answer, "Call [phone removed]");
  assert.equal(forwardedBody.note, "[email removed]");
  assert.deepEqual(recordedBody, forwardedBody);
});

test("admin returns a link without returning the raw token field", async () => {
  const response = createResponse_();
  const handler = createWayfinderBetaAdminHandler({
    admin: {
      auth: () => ({
        verifyIdToken: async () => ({
          uid: "admin-user",
          email: "admin@crosspointe.tv",
        }),
      }),
    },
    firestore: createAdminAccessFirestore_(),
    isAllowedAdminEmail: () => true,
    getAdminUserDocPath: () => "centralAdmin/root/users/admin-user",
    service: {
      createInvite: async () => ({
        inviteId: "WF-INV-ABC123",
        token: "raw-secret-token",
      }),
      getDashboard: async () => ({
        config: {},
        usage: {},
        invites: [],
        access: [],
      }),
    },
  });
  await handler({
    method: "POST",
    headers: {
      authorization: "Bearer admin-token",
      origin: "http://localhost:5000",
    },
    body: {action: "create_invite", label: "Test"},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal("token" in response.body.createdInvite, false);
  assert.equal(
      response.body.createdInvite.inviteLink,
      "http://localhost:5000/#wayfinder-invite=raw-secret-token",
  );
});

function createServiceFixture_() {
  const firestore = createMemoryFirestore_();
  let currentTime = new Date("2026-08-14T15:00:00.000Z");
  let randomSeed = 1;
  const service = createFirestoreWayfinderBetaService({
    firestore,
    timestampFromDate: (date) => new Date(date),
    now: () => new Date(currentTime),
    randomBytes: (size) => {
      const buffer = Buffer.alloc(size, randomSeed);
      randomSeed += 1;
      return buffer;
    },
  });
  return {
    firestore,
    service,
    advance(milliseconds) {
      currentTime = new Date(currentTime.getTime() + milliseconds);
    },
  };
}

function createMemoryFirestore_() {
  const records = new Map();
  const getReference = (path) => ({
    path,
    async get() {
      return createSnapshot_(path, records.get(path));
    },
    async set(data, options) {
      writeRecord_(records, path, data, options);
    },
  });
  const firestore = {
    records,
    doc: (path) => getReference(path),
    collection: (collectionPath) => {
      return {
        doc: (id) => getReference(collectionPath + "/" + id),
        orderBy: (field, direction) => createQuery_(
            records,
            collectionPath,
        ).orderBy(field, direction),
        where: (field, operator, value) => createQuery_(
            records,
            collectionPath,
        ).where(field, operator, value),
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        get: async (reference) => reference.get(),
        set: (reference, data, options) => {
          writes.push({reference, data, options});
        },
      };
      const result = await callback(transaction);
      writes.forEach((write) => {
        writeRecord_(
            records,
            write.reference.path,
            write.data,
            write.options,
        );
      });
      return result;
    },
  };
  return firestore;
}

function createQuery_(records, collectionPath) {
  let maximum = Infinity;
  let cursorId = "";
  let sortField = "";
  let sortDirection = "asc";
  const filters = [];
  return {
    where(field, operator, value) {
      filters.push({field, operator, value});
      return this;
    },
    orderBy(field, direction) {
      sortField = field;
      sortDirection = direction;
      return this;
    },
    startAfter(snapshot) {
      cursorId = snapshot && snapshot.id || "";
      return this;
    },
    limit(value) {
      maximum = value;
      return this;
    },
    async get() {
      const prefix = collectionPath + "/";
      let documents = [...records.entries()]
          .filter(([path]) => {
            return path.startsWith(prefix) &&
              !path.slice(prefix.length).includes("/");
          })
          .map(([path, data]) => createSnapshot_(path, data))
          .filter((document) => {
            return filters.every((filter) => {
              if (filter.operator !== "==") return false;
              return document.get(filter.field) === filter.value;
            });
          })
          .sort((left, right) => {
            const leftValue = toSortValue_(left.get(sortField));
            const rightValue = toSortValue_(right.get(sortField));
            return sortDirection === "desc" ?
              rightValue - leftValue : leftValue - rightValue;
          });
      if (cursorId) {
        const cursorIndex = documents.findIndex((document) => {
          return document.id === cursorId;
        });
        if (cursorIndex >= 0) documents = documents.slice(cursorIndex + 1);
      }
      documents = documents.slice(0, maximum);
      return {docs: documents};
    },
  };
}

function createSnapshot_(path, value) {
  const exists = value !== undefined;
  const data = exists ? structuredClone(value) : undefined;
  return {
    id: path.split("/").pop(),
    exists,
    data: () => data === undefined ? undefined : structuredClone(data),
    get: (field) => data && structuredClone(data[field]),
  };
}

function writeRecord_(records, path, data, options) {
  const next = structuredClone(data);
  if (options && options.merge === true && records.has(path)) {
    records.set(path, {...records.get(path), ...next});
    return;
  }
  records.set(path, next);
}

function toSortValue_(value) {
  if (value instanceof Date) return value.getTime();
  return Number(value) || 0;
}

function adminIdentity_() {
  return {uid: "admin-user", email: "admin@crosspointe.tv"};
}

function createAdminAccessFirestore_() {
  return {
    doc: () => ({
      get: async () => ({
        exists: true,
        get: (field) => {
          if (field === "active") return true;
          if (field === "pageAccess") return {wayfinder: "admin"};
          return undefined;
        },
      }),
    }),
  };
}

function createResponse_() {
  return {
    statusCode: 0,
    body: null,
    headers: new Map(),
    set(name, value) {
      this.headers.set(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
