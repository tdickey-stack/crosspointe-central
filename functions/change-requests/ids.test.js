import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChangeRequestNotificationDeliveryId,
  buildChangeRequestNotificationEventId,
} from "./ids.js";

test("builds stable distinct submission and reminder event IDs", () => {
  const submitted = buildChangeRequestNotificationEventId({
    requestId: "request/a",
    eventType: "submitted",
  });
  const submittedAgain = buildChangeRequestNotificationEventId({
    requestId: "request/a",
    eventType: "submitted",
  });
  const reminderOne = buildChangeRequestNotificationEventId({
    requestId: "request/a",
    eventType: "reminder",
    reminderSequence: 1,
  });
  const reminderTwo = buildChangeRequestNotificationEventId({
    requestId: "request/a",
    eventType: "reminder",
    reminderSequence: 2,
  });

  assert.equal(submitted, submittedAgain);
  assert.match(submitted, /^cr-submitted-[a-f0-9]{64}$/);
  assert.match(reminderOne, /^cr-reminder-0001-[a-f0-9]{64}$/);
  assert.notEqual(submitted, reminderOne);
  assert.notEqual(reminderOne, reminderTwo);
});

test("builds one delivery ID per recipient and channel", () => {
  const input = {
    eventId: "cr-submitted-event",
    recipientUid: "admin-1",
    channel: "email",
  };
  const emailId = buildChangeRequestNotificationDeliveryId(input);

  assert.equal(emailId, buildChangeRequestNotificationDeliveryId(input));
  assert.notEqual(emailId, buildChangeRequestNotificationDeliveryId({
    ...input,
    channel: "pumble",
  }));
  assert.notEqual(emailId, buildChangeRequestNotificationDeliveryId({
    ...input,
    recipientUid: "admin-2",
  }));
  assert.throws(
      () => buildChangeRequestNotificationDeliveryId({
        ...input,
        channel: "sms",
      }),
      /email or Pumble/,
  );
});

test("rejects invalid event identity", () => {
  assert.throws(
      () => buildChangeRequestNotificationEventId({eventType: "submitted"}),
      /request ID/,
  );
  assert.throws(
      () => buildChangeRequestNotificationEventId({
        requestId: "request-1",
        eventType: "reminder",
        reminderSequence: 0,
      }),
      /reminder sequence/,
  );
});
