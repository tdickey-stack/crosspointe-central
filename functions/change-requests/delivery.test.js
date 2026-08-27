import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChangeRequestDeliveryClaim,
  buildChangeRequestDeliveryFailure,
  buildChangeRequestDeliverySuccess,
  canClaimChangeRequestDelivery,
  changeRequestDeliveryLeaseMatches,
  getChangeRequestDeliveryRetryDelayMs,
  isRetryableChangeRequestDeliveryError,
} from "./delivery.js";

const NOW_MS = Date.parse("2026-08-27T15:00:00.000Z");

test("claims due pending, retry, and stale-lease deliveries", () => {
  assert.equal(canClaimChangeRequestDelivery({
    status: "pending",
    dueAtMs: NOW_MS,
  }, NOW_MS), true);
  assert.equal(canClaimChangeRequestDelivery({
    status: "retry",
    nextAttemptAtMs: NOW_MS + 1,
  }, NOW_MS), false);
  assert.equal(canClaimChangeRequestDelivery({
    status: "sending",
    leaseUntilMs: NOW_MS - 1,
  }, NOW_MS), true);
  assert.equal(canClaimChangeRequestDelivery({
    status: "sending",
    leaseUntilMs: NOW_MS + 1,
  }, NOW_MS), false);
  assert.equal(canClaimChangeRequestDelivery({
    status: "sent",
    dueAtMs: NOW_MS,
  }, NOW_MS), false);
});

test("builds an atomic claim and validates lease ownership", () => {
  const current = {status: "pending", attemptCount: 1, dueAtMs: NOW_MS};
  const claim = buildChangeRequestDeliveryClaim(current, {
    now: NOW_MS,
    leaseId: "worker-1",
    leaseMs: 30000,
  });
  const claimed = {...current, ...claim};

  assert.equal(claim.status, "sending");
  assert.equal(claim.attemptCount, 2);
  assert.equal(claim.leaseUntilMs, NOW_MS + 30000);
  assert.equal(changeRequestDeliveryLeaseMatches(claimed, "worker-1"), true);
  assert.equal(changeRequestDeliveryLeaseMatches(claimed, "worker-2"), false);
  assert.throws(
      () => buildChangeRequestDeliveryClaim({
        status: "sent",
      }, {now: NOW_MS, leaseId: "worker-1"}),
      /not claimable/,
  );
});

test("builds retry state with bounded exponential backoff", () => {
  const failure = buildChangeRequestDeliveryFailure(
      {status: "sending", attemptCount: 2},
      Object.assign(new Error("Rate limited"), {status: 429}),
      {now: NOW_MS, baseMs: 1000, maxMs: 10000, maxAttempts: 5},
  );

  assert.equal(failure.status, "retry");
  assert.equal(failure.nextAttemptAtMs, NOW_MS + 2000);
  assert.equal(failure.lastErrorStatus, 429);
  assert.equal(getChangeRequestDeliveryRetryDelayMs(9, {
    baseMs: 1000,
    maxMs: 10000,
  }), 10000);
});

test("makes permanent and exhausted failures terminal", () => {
  const invalidRecipient = Object.assign(new Error("Recipient missing"), {
    code: "pumble-user-not-found",
    retryable: false,
  });
  const permanent = buildChangeRequestDeliveryFailure(
      {status: "sending", attemptCount: 1},
      invalidRecipient,
      {now: NOW_MS},
  );
  const exhausted = buildChangeRequestDeliveryFailure(
      {status: "sending", attemptCount: 5},
      Object.assign(new Error("Unavailable"), {status: 503}),
      {now: NOW_MS, maxAttempts: 5},
  );

  assert.equal(permanent.status, "failed");
  assert.equal(permanent.nextAttemptAtMs, null);
  assert.equal(exhausted.status, "failed");
  assert.equal(isRetryableChangeRequestDeliveryError({status: 503}), true);
  assert.equal(isRetryableChangeRequestDeliveryError({status: 401}), false);
});

test("builds terminal success state without retaining a lease", () => {
  assert.deepEqual(buildChangeRequestDeliverySuccess({
    now: NOW_MS,
    providerMessageId: "message-1",
  }), {
    status: "sent",
    sentAtMs: NOW_MS,
    providerMessageId: "message-1",
    leaseId: "",
    leaseUntilMs: 0,
    nextAttemptAtMs: null,
    lastError: "",
    lastErrorCode: "",
    lastErrorStatus: 0,
  });
});
