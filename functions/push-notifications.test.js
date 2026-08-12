import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  getPushSubscriptionId,
  normalizePushMessagePayload,
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

  it("normalizes relative notification links to the request origin", () => {
    assert.deepEqual(normalizePushMessagePayload({
      title: "Sunday update",
      message: "Service begins at 10:30.",
      link: "/#this-sunday",
    }, "https://central.example"), {
      title: "Sunday update",
      message: "Service begins at 10:30.",
      link: "https://central.example/#this-sunday",
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
    }, "https://central.example").link, "https://central.example/");
    assert.throws(
        () => normalizePushMessagePayload({
          title: "Hello",
          message: "Central update",
          link: "http://example.com/update",
        }, "https://central.example"),
        /valid https notification link/,
    );
  });
});
