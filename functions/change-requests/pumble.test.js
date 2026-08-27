import assert from "node:assert/strict";
import test from "node:test";

import {
  PUMBLE_API_ENDPOINT,
  PUMBLE_MAX_MESSAGE_LENGTH,
  createPumbleChangeRequestTransport,
  normalizePumbleNotificationText,
  normalizePumbleProviderMessageId,
  normalizePumbleUserId,
} from "./pumble.js";

test("uses the official API endpoint and requires a direct-message client",
    () => {
      assert.equal(PUMBLE_API_ENDPOINT, "https://api-ga.pumble.com");
      assert.throws(
          () => createPumbleChangeRequestTransport({apiClient: {}}),
          /direct-message API client/,
      );
    });

test("normalizes linked IDs, text, and bounded provider message IDs", () => {
  assert.equal(normalizePumbleUserId(" user-1 "), "user-1");
  assert.equal(normalizePumbleNotificationText("  Review this request.  "),
      "Review this request.");
  assert.equal(normalizePumbleProviderMessageId({message: {id: " msg-1 "}}),
      "msg-1");
  assert.equal(normalizePumbleProviderMessageId({data: {messageId: "msg-2"}}),
      "msg-2");
  assert.throws(
      () => normalizePumbleUserId(""),
      (error) => error.code === "pumble-user-id-invalid" &&
        error.retryable === false,
  );
  assert.throws(
      () => normalizePumbleNotificationText("x".repeat(
          PUMBLE_MAX_MESSAGE_LENGTH + 1,
      )),
      /exceeds 10000/,
  );
});

test("sends only linked user IDs and text through the bot API client",
    async () => {
      const calls = [];
      const transport = createPumbleChangeRequestTransport({
        apiClient: {
          async sendDirectMessage(input) {
            calls.push(input);
            return {message: {id: "message-1", text: "provider payload"}};
          },
        },
      });

      const result = await transport.send({
        recipientUserId: "user-1",
        botUserId: "bot-1",
        recipientEmail: "ignored@example.com",
        text: "A Change Request needs review.",
      });

      assert.deepEqual(calls, [{
        userId: "user-1",
        botUserId: "bot-1",
        text: "A Change Request needs review.",
      }]);
      assert.deepEqual(result, {
        provider: "pumble-api",
        endpoint: PUMBLE_API_ENDPOINT,
        recipientUserId: "user-1",
        messageId: "message-1",
      });
      assert.equal(JSON.stringify(result).includes("provider payload"), false);
    });

test("rejects missing linked IDs before calling Pumble", async () => {
  let called = false;
  const transport = createPumbleChangeRequestTransport({
    apiClient: {
      async sendDirectMessage() {
        called = true;
      },
    },
  });

  await assert.rejects(
      transport.send({botUserId: "bot-1", text: "Review requested."}),
      (error) => error.code === "pumble-user-id-invalid",
  );
  await assert.rejects(
      transport.send({recipientUserId: "user-1", text: "Review requested."}),
      (error) => error.code === "pumble-user-id-invalid",
  );
  assert.equal(called, false);
});

test("preserves provider retry metadata without exposing credentials",
    async () => {
      const transport = createPumbleChangeRequestTransport({
        apiClient: {
          async sendDirectMessage() {
            const error = new Error("Pumble temporarily unavailable");
            error.status = 503;
            error.retryable = true;
            throw error;
          },
        },
      });

      await assert.rejects(
          transport.send({
            recipientUserId: "user-1",
            botUserId: "bot-1",
            text: "Review requested.",
          }),
          (error) => error.code === "pumble-provider-failed" &&
            error.status === 503 && error.retryable === true,
      );
    });
