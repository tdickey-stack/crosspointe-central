/* eslint-disable require-jsdoc */
import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  DEFAULT_PUSH_LINK,
  PUSH_HISTORY_COLLECTION,
  PUSH_SCHEDULED_COLLECTION,
  createPushScheduleDispatcher,
  createPushScheduleHandler,
  getPushSubscriptionId,
  normalizePushMessagePayload,
  normalizePushSchedulePayload,
  normalizePushSubscriptionPayload,
} from "./push-notifications.js";

describe("push notification payloads", () => {
  it("creates stable non-reversible subscription document ids", () => {
    assert.equal(
        getPushSubscriptionId("token-a"),
        getPushSubscriptionId("token-a"),
    );
    assert.notEqual(
        getPushSubscriptionId("token-a"),
        getPushSubscriptionId("token-b"),
    );
    assert.equal(getPushSubscriptionId("token-a").length, 64);
  });

  it("normalizes subscription input", () => {
    assert.deepEqual(normalizePushSubscriptionPayload({
      token: " token-a ",
      enabled: true,
    }), {token: "token-a", enabled: true});
  });

  it("rejects missing subscription tokens", () => {
    assert.throws(
        () => normalizePushSubscriptionPayload({token: ""}),
        /valid push subscription token/,
    );
  });

  it("normalizes relative notification links to canonical Central", () => {
    assert.deepEqual(normalizePushMessagePayload({
      title: "Sunday update",
      message: "Service begins at 10:30.",
      link: "/#this-sunday",
    }), {
      title: "Sunday update",
      message: "Service begins at 10:30.",
      link: "https://central.crosspointe.tv/#this-sunday",
    });
  });

  it("enforces title and message limits", () => {
    assert.throws(
        () => normalizePushMessagePayload({title: "", message: "Hello"}),
        /notification title/,
    );
    assert.throws(
        () => normalizePushMessagePayload({title: "Hello", message: ""}),
        /message of 240/,
    );
  });

  it("uses an absolute default link and rejects insecure links", () => {
    assert.equal(normalizePushMessagePayload({
      title: "Hello",
      message: "Central update",
    }).link, DEFAULT_PUSH_LINK);
    assert.throws(
        () => normalizePushMessagePayload({
          title: "Hello",
          message: "Central update",
          link: "http://example.com/update",
        }),
        /valid https notification link/,
    );
  });

  it("normalizes future schedules and rejects past dates", () => {
    const now = Date.parse("2026-08-14T15:00:00.000Z");
    assert.deepEqual(normalizePushSchedulePayload({
      title: "Event reminder",
      message: "Registration closes tonight.",
      scheduledFor: "2026-08-14T16:30:00.000Z",
    }, now), {
      title: "Event reminder",
      message: "Registration closes tonight.",
      link: DEFAULT_PUSH_LINK,
      scheduledFor: "2026-08-14T16:30:00.000Z",
    });
    assert.throws(
        () => normalizePushSchedulePayload({
          title: "Event reminder",
          message: "Registration closes tonight.",
          scheduledFor: "2026-08-14T14:30:00.000Z",
        }, now),
        /future time/,
    );
  });
});

describe("scheduled push notification handlers", () => {
  it("creates, updates, lists, and cancels scheduled notifications",
      async () => {
        const firestore = createMemoryFirestore_();
        const fieldValue = createFieldValue_();
        const handler = createPushScheduleHandler({
          firestore,
          fieldValue,
          verifySender: async () => ({
            uid: "admin-1",
            email: "admin@example.com",
          }),
        });
        const scheduledForDate = new Date(Date.now() + 60 * 60 * 1000);
        const scheduledFor = scheduledForDate.toISOString();
        const createResponse = createResponse_();
        await handler({
          method: "POST",
          body: {
            action: "create",
            title: "Event tonight",
            message: "Doors open at 6:30.",
            scheduledFor,
          },
        }, createResponse);

        assert.equal(createResponse.statusCode, 201);
        const notificationId = createResponse.body.notification.id;
        assert.equal(createResponse.body.notification.link, DEFAULT_PUSH_LINK);

        const updatedForDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const updatedFor = updatedForDate.toISOString();
        const updateResponse = createResponse_();
        await handler({
          method: "POST",
          body: {
            action: "update",
            id: notificationId,
            title: "Event tonight",
            message: "Doors now open at 6:15.",
            link: "/#events",
            scheduledFor: updatedFor,
          },
        }, updateResponse);
        assert.equal(updateResponse.statusCode, 200);
        assert.equal(
            updateResponse.body.notification.link,
            "https://central.crosspointe.tv/#events",
        );

        const listResponse = createResponse_();
        await handler({method: "GET"}, listResponse);
        assert.equal(listResponse.statusCode, 200);
        assert.equal(listResponse.body.notifications.length, 1);
        assert.equal(listResponse.body.notifications[0].message,
            "Doors now open at 6:15.");

        const cancelResponse = createResponse_();
        await handler({
          method: "POST",
          body: {action: "cancel", id: notificationId},
        }, cancelResponse);
        assert.equal(cancelResponse.statusCode, 200);
        assert.equal(
            firestore.read_(PUSH_SCHEDULED_COLLECTION, notificationId).status,
            "canceled",
        );
      });

  it("dispatches due messages once and leaves future messages scheduled",
      async () => {
        const now = new Date("2026-08-14T15:00:00.000Z");
        const firestore = createMemoryFirestore_({
          centralPushSubscriptions: {
            token1: {token: "token-1", enabled: true},
            token2: {token: "token-2", enabled: true},
          },
          centralPushScheduled: {
            due1: {
              title: "Service update",
              message: "The livestream is starting.",
              link: DEFAULT_PUSH_LINK,
              status: "scheduled",
              scheduledFor: new Date(now.getTime() - 60 * 1000),
              createdByUid: "admin-1",
              createdByEmail: "admin@example.com",
            },
            future1: {
              title: "Tomorrow",
              message: "See you tomorrow.",
              link: DEFAULT_PUSH_LINK,
              status: "scheduled",
              scheduledFor: new Date(now.getTime() + 60 * 60 * 1000),
            },
          },
        });
        const sentMessages = [];
        const dispatcher = createPushScheduleDispatcher({
          firestore,
          fieldValue: createFieldValue_(),
          messaging: {
            sendEachForMulticast: async (message) => {
              sentMessages.push(message);
              return {
                successCount: 2,
                failureCount: 0,
                responses: [{success: true}, {success: true}],
              };
            },
          },
          now: () => now,
        });

        const summary = await dispatcher();
        assert.deepEqual(summary, {dueCount: 1, sentCount: 1, failedCount: 0});
        assert.equal(sentMessages.length, 1);
        assert.deepEqual(sentMessages[0].tokens, ["token-1", "token-2"]);
        assert.equal(
            firestore.read_(PUSH_SCHEDULED_COLLECTION, "due1").status,
            "sent",
        );
        assert.equal(
            firestore.read_(PUSH_SCHEDULED_COLLECTION, "future1").status,
            "scheduled",
        );
        const history = firestore.values_(PUSH_HISTORY_COLLECTION);
        assert.equal(history.length, 1);
        assert.equal(history[0].source, "scheduled");
        assert.equal(history[0].scheduledNotificationId, "due1");
      });
});

function createFieldValue_() {
  return {serverTimestamp: () => new Date("2026-08-14T15:00:00.000Z")};
}

function createResponse_() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createMemoryFirestore_(seed = {}) {
  const collections = new Map();
  let nextId = 1;

  Object.entries(seed).forEach(([collectionName, documents]) => {
    collections.set(collectionName, new Map(
        Object.entries(documents).map(([id, data]) => [id, {...data}]),
    ));
  });

  function getCollection_(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  function createSnapshot_(id, data) {
    return {
      id,
      exists: !!data,
      data: () => data ? {...data} : undefined,
      get: (field) => data ? data[field] : undefined,
    };
  }

  function createDocumentRef_(collectionName, requestedId) {
    const id = requestedId || "auto-" + String(nextId++);
    const documents = getCollection_(collectionName);
    return {
      id,
      collectionName,
      async get() {
        return createSnapshot_(id, documents.get(id));
      },
      async set(data, options) {
        const current = options && options.merge ? documents.get(id) || {} : {};
        documents.set(id, {...current, ...data});
      },
      async update(data) {
        documents.set(id, {...(documents.get(id) || {}), ...data});
      },
      async delete() {
        documents.delete(id);
      },
    };
  }

  function createQuery_(collectionName, filters = [], order = null,
      maximum = Infinity) {
    return {
      where(field, operator, value) {
        return createQuery_(
            collectionName,
            filters.concat([{field, operator, value}]),
            order,
            maximum,
        );
      },
      orderBy(field, direction) {
        return createQuery_(
            collectionName,
            filters,
            {field, direction},
            maximum,
        );
      },
      limit(value) {
        return createQuery_(collectionName, filters, order, value);
      },
      doc(id) {
        return createDocumentRef_(collectionName, id);
      },
      async add(data) {
        const documentRef = createDocumentRef_(collectionName);
        await documentRef.set(data);
        return documentRef;
      },
      async get() {
        let entries = Array.from(getCollection_(collectionName).entries());
        filters.forEach((filter) => {
          entries = entries.filter(([, data]) => {
            return filter.operator === "==" &&
              data[filter.field] === filter.value;
          });
        });
        if (order) {
          entries.sort((left, right) => {
            const leftValue = toComparable_(left[1][order.field]);
            const rightValue = toComparable_(right[1][order.field]);
            return (leftValue - rightValue) *
              (order.direction === "desc" ? -1 : 1);
          });
        }
        return {
          docs: entries.slice(0, maximum).map(([id, data]) => {
            return createSnapshot_(id, data);
          }),
        };
      },
    };
  }

  return {
    collection(name) {
      return createQuery_(name);
    },
    async runTransaction(callback) {
      return callback({
        get: (documentRef) => documentRef.get(),
        update: (documentRef, data) => documentRef.update(data),
      });
    },
    batch() {
      const deletes = [];
      return {
        delete(documentRef) {
          deletes.push(documentRef);
        },
        async commit() {
          await Promise.all(deletes.map((documentRef) => documentRef.delete()));
        },
      };
    },
    read_(collectionName, id) {
      return getCollection_(collectionName).get(id);
    },
    values_(collectionName) {
      return Array.from(getCollection_(collectionName).values());
    },
  };
}

function toComparable_(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  return value;
}
