/* eslint-disable require-jsdoc */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PUMBLE_AUTHORIZE_ENDPOINT,
  PUMBLE_BOT_CREDENTIAL_PATH,
  PUMBLE_BOT_CREDENTIAL_LOCK_PATH,
  PUMBLE_OAUTH_STATES_PATH,
  PUMBLE_PROFILE_ENDPOINT,
  PUMBLE_REQUIRED_BOT_SCOPES,
  PUMBLE_TOKEN_ENDPOINT,
  buildPumbleAuthorizationUrl,
  buildPumbleOAuthCallbackUrl,
  createPumbleOAuthService,
  exchangePumbleAuthorizationCode,
  hashPumbleOAuthState,
  normalizePumbleOAuthReturnUrl,
  verifyPumbleBotTokenIdentity,
} from "./pumble-oauth.js";

const ADMIN_URL = "https://crosspointe-central.web.app/admin";
const CALLBACK_URL =
  "https://crosspointe-central.web.app/api/admin/pumble/oauth/callback";
const STATE = "state_abcdefghijklmnopqrstuvwxyz0123456789";
const COMPLETION_TOKEN = "complete_abcdefghijklmnopqrstuvwxyz012345";
const PREVIEW_URL =
  "https://crosspointe-central--dev-ab12cd.web.app/admin/change-requests";

test("builds a same-origin callback and least-privilege bot consent URL",
    () => {
      assert.equal(buildPumbleOAuthCallbackUrl(ADMIN_URL), CALLBACK_URL);
      const authorizationUrl = new URL(buildPumbleAuthorizationUrl({
        appId: "app-id",
        callbackUrl: CALLBACK_URL,
        state: STATE,
      }));

      assert.equal(authorizationUrl.origin + authorizationUrl.pathname,
          PUMBLE_AUTHORIZE_ENDPOINT);
      assert.equal(authorizationUrl.searchParams.get("clientId"), "app-id");
      assert.equal(
          authorizationUrl.searchParams.get("redirectUrl"),
          CALLBACK_URL,
      );
      assert.equal(authorizationUrl.searchParams.get("state"), STATE);
      assert.equal(
          authorizationUrl.searchParams.get("scopes"),
          PUMBLE_REQUIRED_BOT_SCOPES.map((scope) => "bot:" + scope).join(","),
      );
      assert.equal(authorizationUrl.searchParams.has("isReinstall"), false);
    });

test("exchanges a code without returning provider response internals",
    async () => {
      let captured;
      const result = await exchangePumbleAuthorizationCode({
        fetchImpl: async (url, options) => {
          captured = {url, options};
          return {
            ok: true,
            status: 200,
            json: async () => ({
              accessToken: "user-token",
              botToken: "bot-token",
              userId: "user-1",
              botId: "bot-1",
              workspaceId: "workspace-1",
              ignored: "provider-internal",
            }),
          };
        },
        appId: "app-id",
        clientSecret: "client-secret",
        code: "authorization-code",
      });

      assert.equal(captured.url, PUMBLE_TOKEN_ENDPOINT);
      assert.equal(captured.options.method, "POST");
      assert.equal(captured.options.redirect, "error");
      assert.equal(captured.options.signal instanceof AbortSignal, true);
      assert.equal(captured.options.body.get("client-id"), "app-id");
      assert.equal(captured.options.body.get("client-secret"), "client-secret");
      assert.equal(captured.options.body.get("code"), "authorization-code");
      assert.deepEqual(result, {
        botToken: "bot-token",
        userId: "user-1",
        botId: "bot-1",
        workspaceId: "workspace-1",
      });
    });

test("verifies a newly issued bot token with the Pumble app key", async () => {
  let captured;
  const result = await verifyPumbleBotTokenIdentity({
    fetchImpl: async (url, options) => {
      captured = {url, options};
      return {
        ok: true,
        status: 200,
        json: async () => ({
          workspaceId: "workspace-1",
          workspaceUserId: "bot-1",
        }),
      };
    },
    appKey: "app-key",
    botToken: "fresh-bot-token",
    expectedWorkspaceId: "workspace-1",
    expectedBotId: "bot-1",
  });
  assert.deepEqual(result, {workspaceId: "workspace-1", botId: "bot-1"});
  assert.equal(captured.url, PUMBLE_PROFILE_ENDPOINT);
  assert.equal(captured.options.method, "GET");
  assert.equal(new Headers(captured.options.headers).get("token"),
      "fresh-bot-token");
  assert.equal(new Headers(captured.options.headers).get("x-app-token"),
      "app-key");
});

test("rejects a bot token that Pumble does not accept", async () => {
  await assert.rejects(
      verifyPumbleBotTokenIdentity({
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({message: "Unauthorized"}),
        }),
        appKey: "app-key",
        botToken: "rejected-token",
        expectedWorkspaceId: "workspace-1",
        expectedBotId: "bot-1",
      }),
      (error) => error.code === "pumble-bot-verification-failed" &&
        error.status === 401,
  );
});

test("allows only canonical and same-project preview return hosts", () => {
  assert.equal(normalizePumbleOAuthReturnUrl(
      PREVIEW_URL + "?ignored=true#ignored",
      "https://crosspointe-central.web.app/admin",
  ), PREVIEW_URL);
  assert.equal(normalizePumbleOAuthReturnUrl(
      "https://crosspointe-central.web.app/other",
      "https://crosspointe-central.web.app/admin",
  ), "https://crosspointe-central.web.app/admin/change-requests");
  assert.throws(() => normalizePumbleOAuthReturnUrl(
      "https://crosspointe-central--dev-ab12cd.web.app.attacker.test/admin",
      "https://crosspointe-central.web.app/admin",
  ));
  assert.throws(() => normalizePumbleOAuthReturnUrl(
      PREVIEW_URL,
      "https://crosspointe-central.web.app/admin",
      "https://crosspointe-central.web.app",
  ));
});

test("provider failures preserve the state-validated preview return URL",
    async () => {
      const firestore = new FakeFirestore();
      const service = createPumbleOAuthService({
        firestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          json: async () => ({message: "Invalid code"}),
        }),
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => Date.parse("2026-08-27T18:00:00Z"),
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });
      await service.beginAuthorization("firebase-user-1", {
        returnUrl: PREVIEW_URL,
        requestOrigin: new URL(PREVIEW_URL).origin,
      });
      await assert.rejects(
          service.completeAuthorization({code: "bad-code", state: STATE}),
          (error) => error.code === "pumble-oauth-exchange-failed" &&
            error.returnUrl === PREVIEW_URL,
      );
      assert.equal(firestore.read(PUMBLE_BOT_CREDENTIAL_LOCK_PATH), undefined);
    });

test("an active bot rotation lease blocks a second token exchange",
    async () => {
      const firestore = new FakeFirestore();
      const nowMs = Date.parse("2026-08-27T18:00:00Z");
      let fetchCount = 0;
      const service = createPumbleOAuthService({
        firestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: async () => {
          fetchCount += 1;
          assert.fail("An active lease must block the provider exchange.");
        },
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => nowMs,
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });
      await service.beginAuthorization("firebase-user-1", {
        returnUrl: PREVIEW_URL,
        requestOrigin: new URL(PREVIEW_URL).origin,
      });
      firestore.write(PUMBLE_BOT_CREDENTIAL_LOCK_PATH, {
        leaseId: "another_callback_abcdefghijklmnopqrstuvwxyz",
        expiresAt: fakeTimestamp(nowMs + 60 * 1000),
      });
      await assert.rejects(
          service.completeAuthorization({code: "code", state: STATE}),
          (error) => error.code === "pumble-oauth-rotation-busy" &&
        error.returnUrl === PREVIEW_URL,
      );
      assert.equal(fetchCount, 0);
      assert.ok(firestore.read(
          PUMBLE_OAUTH_STATES_PATH + "/" + hashPumbleOAuthState(STATE),
      ));
    });

test("creates single-use state and rotates only the linked bot credential",
    async () => {
      const firestore = new FakeFirestore();
      const requests = [];
      const nowMs = Date.parse("2026-08-27T18:00:00Z");
      const service = createPumbleOAuthService({
        firestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: createPumbleOAuthFetch({requests}),
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => nowMs,
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });

      const begun = await service.beginAuthorization("firebase-user-1", {
        returnUrl: PREVIEW_URL,
        requestOrigin: new URL(PREVIEW_URL).origin,
      });
      const statePath = PUMBLE_OAUTH_STATES_PATH + "/" +
        hashPumbleOAuthState(STATE);
      const stored = firestore.read(statePath);
      assert.equal(stored.uid, "firebase-user-1");
      assert.equal(stored.kind, "authorization");
      assert.equal(stored.returnUrl, PREVIEW_URL);
      assert.equal(stored.callbackUrl, CALLBACK_URL);
      assert.equal(stored.createdAt.toMillis(), nowMs);
      assert.equal(stored.expiresAt.toMillis(), nowMs + 10 * 60 * 1000);
      assert.equal(new URL(begun.authorizationUrl).searchParams.get("state"),
          STATE);

      const completed = await service.completeAuthorization({
        code: "authorization-code",
        state: STATE,
      });
      assert.equal(completed.completionToken, COMPLETION_TOKEN);
      assert.equal(completed.returnUrl, PREVIEW_URL);
      assert.equal(firestore.read(statePath), undefined);
      assert.equal(requests.length, 2);
      assert.equal(requests[0].url, PUMBLE_TOKEN_ENDPOINT);
      assert.equal(requests[1].url, PUMBLE_PROFILE_ENDPOINT);
      assert.equal(
          new Headers(requests[1].options.headers).get("token"),
          "fresh-bot-token",
      );
      assert.equal(firestore.read(PUMBLE_BOT_CREDENTIAL_LOCK_PATH), undefined);
      assert.equal(
          firestore.read(PUMBLE_BOT_CREDENTIAL_PATH).token,
          "fresh-bot-token",
      );
      assert.equal(
          JSON.stringify(firestore.dump()).includes("discard-this-user-token"),
          false,
      );
      const completionPath = PUMBLE_OAUTH_STATES_PATH + "/" +
        hashPumbleOAuthState(COMPLETION_TOKEN);
      assert.equal(
          JSON.stringify(firestore.read(completionPath))
              .includes("fresh-bot-token"),
          false,
      );

      const connection = await service.finalizeAuthorization({
        uid: "firebase-user-1",
        completionToken: COMPLETION_TOKEN,
      });
      assert.equal(connection.status, "linked");
      assert.equal(connection.userId, "pumble-user-1");
      assert.equal(connection.botId, "pumble-bot-1");
      assert.equal(connection.workspaceId, "crosspointe-workspace");
      assert.equal(connection.linkedAt.toMillis(), nowMs);
      assert.equal(
          firestore.read(PUMBLE_BOT_CREDENTIAL_PATH).workspaceId,
          "crosspointe-workspace",
      );

      await assert.rejects(
          service.completeAuthorization({
            code: "authorization-code",
            state: STATE,
          }),
          (error) => error.code === "pumble-oauth-state-invalid" &&
            error.status === 400,
      );
    });

test("rejects expired state and a token from another bot workspace",
    async () => {
      const nowMs = Date.parse("2026-08-27T18:00:00Z");
      const expiredFirestore = new FakeFirestore();
      const expiredService = createPumbleOAuthService({
        firestore: expiredFirestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: async () => {
          assert.fail("Expired state must not be exchanged.");
        },
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => nowMs,
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
        stateTtlMs: 1,
      });
      await expiredService.beginAuthorization("firebase-user-1");

      const statePath = PUMBLE_OAUTH_STATES_PATH + "/" +
    hashPumbleOAuthState(STATE);
      expiredFirestore.write(statePath, {
        ...expiredFirestore.read(statePath),
        expiresAt: fakeTimestamp(nowMs - 1),
      });
      await assert.rejects(
          expiredService.completeAuthorization({
            code: "code",
            state: STATE,
          }),
          (error) => error.code === "pumble-oauth-state-expired" &&
            error.returnUrl ===
              "https://crosspointe-central.web.app/admin/change-requests",
      );
      assert.equal(expiredFirestore.read(statePath), undefined);

      const mismatchFirestore = new FakeFirestore();
      mismatchFirestore.write(PUMBLE_BOT_CREDENTIAL_PATH, {
        token: "existing-bot-token",
        botId: "configured-bot-1",
        workspaceId: "crosspointe-workspace",
        updatedAt: fakeTimestamp(nowMs - 1000),
      });
      const mismatchService = createPumbleOAuthService({
        firestore: mismatchFirestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: createPumbleOAuthFetch({
          tokenPayload: {
            botId: "other-bot-1",
            workspaceId: "other-workspace",
          },
        }),
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => nowMs,
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });
      await mismatchService.beginAuthorization("firebase-user-1");
      await assert.rejects(
          mismatchService.completeAuthorization({
            code: "code",
            state: STATE,
          }),
          (error) => error.code === "pumble-workspace-mismatch" &&
        error.status === 403,
      );
      assert.equal(
          mismatchFirestore.read(PUMBLE_BOT_CREDENTIAL_PATH).token,
          "existing-bot-token",
      );
    });

test("only the initiating Firebase user can consume an OAuth completion",
    async () => {
      const firestore = new FakeFirestore();
      const service = createPumbleOAuthService({
        firestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: createPumbleOAuthFetch(),
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => Date.parse("2026-08-27T18:00:00Z"),
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });
      await service.beginAuthorization("firebase-user-1");
      await service.completeAuthorization({
        code: "authorization-code",
        state: STATE,
      });

      await assert.rejects(
          service.finalizeAuthorization({
            uid: "firebase-user-2",
            completionToken: COMPLETION_TOKEN,
          }),
          (error) => error.code === "pumble-oauth-user-mismatch" &&
            error.status === 403,
      );
      const connection = await service.finalizeAuthorization({
        uid: "firebase-user-1",
        completionToken: COMPLETION_TOKEN,
      });
      assert.equal(connection.userId, "pumble-user-1");
    });

test("a failed integration write leaves the completion retryable",
    async () => {
      const firestore = new FakeFirestore();
      const userRef = firestore.doc("centralAdmin/root/users/firebase-user-1");
      firestore.write(userRef.path, {active: true});
      const service = createPumbleOAuthService({
        firestore,
        timestampFromMillis: fakeTimestamp,
        fetchImpl: createPumbleOAuthFetch(),
        getAppId: () => "app-id",
        getAppKey: () => "app-key",
        getClientSecret: () => "client-secret",
        adminUrl: ADMIN_URL,
        now: () => Date.parse("2026-08-27T18:00:00Z"),
        createState: () => STATE,
        createCompletionToken: () => COMPLETION_TOKEN,
      });
      await service.beginAuthorization("firebase-user-1");
      await service.completeAuthorization({code: "code", state: STATE});
      const completionPath = PUMBLE_OAUTH_STATES_PATH + "/" +
        hashPumbleOAuthState(COMPLETION_TOKEN);

      await assert.rejects(service.finalizeAuthorization({
        uid: "firebase-user-1",
        completionToken: COMPLETION_TOKEN,
        applyConnection: async ({transaction, connection}) => {
          transaction.update(userRef, {pumble: connection});
          throw new Error("simulated integration write failure");
        },
      }), /simulated integration write failure/);
      assert.ok(firestore.read(completionPath));
      assert.equal(firestore.read(userRef.path).pumble, undefined);

      await service.finalizeAuthorization({
        uid: "firebase-user-1",
        completionToken: COMPLETION_TOKEN,
        applyConnection: async ({transaction, connection}) => {
          transaction.update(userRef, {pumble: connection});
        },
      });
      assert.equal(firestore.read(completionPath), undefined);
      assert.equal(firestore.read(userRef.path).pumble.userId, "pumble-user-1");
    });

function createPumbleOAuthFetch(options = {}) {
  const requests = Array.isArray(options.requests) ? options.requests : [];
  const tokenPayload = {
    accessToken: "discard-this-user-token",
    botToken: "fresh-bot-token",
    userId: "pumble-user-1",
    botId: "pumble-bot-1",
    workspaceId: "crosspointe-workspace",
    ...(options.tokenPayload || {}),
  };
  const profilePayload = {
    workspaceId: tokenPayload.workspaceId,
    workspaceUserId: tokenPayload.botId,
    ...(options.profilePayload || {}),
  };
  return async (url, fetchOptions) => {
    requests.push({url, options: fetchOptions});
    if (url === PUMBLE_TOKEN_ENDPOINT) {
      return {
        ok: true,
        status: 200,
        json: async () => tokenPayload,
      };
    }
    if (url === PUMBLE_PROFILE_ENDPOINT) {
      return {
        ok: true,
        status: 200,
        json: async () => profilePayload,
      };
    }
    assert.fail("Unexpected Pumble URL: " + url);
  };
}

function fakeTimestamp(milliseconds) {
  return {
    milliseconds,
    toMillis() {
      return milliseconds;
    },
  };
}

class FakeFirestore {
  constructor() {
    this.documents = new Map();
  }

  collection(path) {
    return {
      doc: (id) => this.doc(path + "/" + id),
    };
  }

  doc(path) {
    return {
      path,
      get: async () => ({
        exists: this.documents.has(path),
        data: () => this.read(path),
        get: (field) => (this.read(path) || {})[field],
      }),
      create: async (data) => {
        if (this.documents.has(path)) throw new Error("already exists");
        this.write(path, data);
      },
    };
  }

  async runTransaction(callback) {
    const creates = [];
    const deletes = [];
    const sets = [];
    const updates = [];
    const result = await callback({
      get: async (ref) => ({
        exists: this.documents.has(ref.path),
        data: () => this.read(ref.path),
      }),
      delete: (ref) => deletes.push(ref.path),
      create: (ref, value) => creates.push({ref, value}),
      set: (ref, value) => sets.push({ref, value}),
      update: (ref, value) => updates.push({ref, value}),
    });
    creates.forEach(({ref, value}) => {
      if (this.documents.has(ref.path)) throw new Error("already exists");
      this.write(ref.path, value);
    });
    deletes.forEach((path) => this.documents.delete(path));
    sets.forEach(({ref, value}) => this.write(ref.path, value));
    updates.forEach(({ref, value}) => {
      this.write(ref.path, {...(this.read(ref.path) || {}), ...value});
    });
    return result;
  }

  read(path) {
    return this.documents.get(path);
  }

  write(path, data) {
    this.documents.set(path, data);
  }

  dump() {
    return Object.fromEntries(this.documents.entries());
  }
}
