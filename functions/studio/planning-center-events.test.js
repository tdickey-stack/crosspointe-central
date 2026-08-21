import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDIO_PLANNING_CENTER_LOOKAHEAD_DAYS,
  createStudioPlanningCenterEventsHandler,
  getStudioPermission,
  hasStudioEventLookupAccess,
} from "./planning-center-events.js";

function createResponse() {
  return {
    body: null,
    headers: {},
    statusCode: 0,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function createRequest(overrides = {}) {
  const headers = Object.fromEntries(
      Object.entries(overrides.headers || {}).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
  );
  return {
    method: overrides.method || "GET",
    get(name) {
      return headers[String(name || "").toLowerCase()] || "";
    },
  };
}

function createOptions(overrides = {}) {
  return {
    admin: {
      auth() {
        return {
          async verifyIdToken() {
            return {uid: "studio-user"};
          },
        };
      },
    },
    firestore: {
      doc(path) {
        assert.equal(path, "centralAdmin/root/users/studio-user");
        return {
          async get() {
            return {
              exists: true,
              data: () => ({
                active: true,
                pageAccess: {studio: "edit"},
              }),
            };
          },
        };
      },
    },
    async getFirestoreRoomRulesOverride() {
      return {shouldOverride: true, items: [{id: "room-rule"}]};
    },
    async getFirestoreEventOverrides() {
      return [{id: "event-override"}];
    },
    getDefaultRoomRules() {
      return [{id: "default-rule"}];
    },
    async getCentralCalendarEvents() {
      return {today: [], upcoming: []};
    },
    ...overrides,
  };
}

test(
    "Studio event access accepts active view access and settings fallback",
    () => {
      assert.equal(
          hasStudioEventLookupAccess({
            active: true,
            pageAccess: {studio: "view"},
          }),
          true,
      );
      assert.equal(
          getStudioPermission({active: true, pageAccess: {settings: "admin"}}),
          "admin",
      );
      assert.equal(
          hasStudioEventLookupAccess({
            active: false,
            pageAccess: {studio: "admin"},
          }),
          false,
      );
    },
);

test("Studio event lookup rejects requests without a Studio session",
    async () => {
      const response = createResponse();
      await createStudioPlanningCenterEventsHandler(createOptions())(
          createRequest(),
          response,
      );
      assert.equal(response.statusCode, 401);
      assert.match(response.body.error, /Sign in to Central Studio/);
    });

test("Studio event lookup rejects active users without Studio access",
    async () => {
      const options = createOptions({
        firestore: {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    active: true,
                    pageAccess: {studio: "none"},
                  }),
                };
              },
            };
          },
        },
      });
      const response = createResponse();
      await createStudioPlanningCenterEventsHandler(options)(
          createRequest({headers: {authorization: "Bearer token"}}),
          response,
      );

      assert.equal(response.statusCode, 403);
      assert.match(response.body.error, /does not have access/);
    });

test("Studio event lookup uses an isolated 60-day calendar window",
    async () => {
      const calls = [];
      const options = createOptions({
        async getCentralCalendarEvents(
            roomRules,
            days,
            cacheOptions,
            overrides,
        ) {
          calls.push({roomRules, days, cacheOptions, overrides});
          return {
            today: [],
            upcoming: [{id: "future-event", starts_at: "2026-10-01T12:00:00Z"}],
          };
        },
      });
      const response = createResponse();
      await createStudioPlanningCenterEventsHandler(options)(
          createRequest({headers: {authorization: "Bearer token"}}),
          response,
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.lookaheadDays, 60);
      assert.equal(response.body.events.upcoming[0].id, "future-event");
      assert.deepEqual(calls, [
        {
          roomRules: [{id: "room-rule"}],
          days: STUDIO_PLANNING_CENTER_LOOKAHEAD_DAYS,
          cacheOptions: {},
          overrides: [{id: "event-override"}],
        },
      ]);
    });
