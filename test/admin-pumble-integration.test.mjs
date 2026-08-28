import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const backendSource = fs.readFileSync(
    path.join(projectRoot, "functions/index.js"),
    "utf8",
);
const adminHandlerSource = fs.readFileSync(
    path.join(projectRoot, "functions/notifications/admin-handler.js"),
    "utf8",
);
const serveRuntimeSource = fs.readFileSync(
    path.join(projectRoot, "functions/notifications/serve-needs-runtime.js"),
    "utf8",
);

function sourceBetween(startMarker, endMarker) {
  const start = backendSource.indexOf(startMarker);
  const end = backendSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return backendSource.slice(start, end);
}

test("Pumble self-service uses the active Admin boundary", () => {
  const verifier = sourceBetween(
      "async function verifyCentralAdminRequest_",
      "function serializePumbleConnectionStatus_",
  );
  const pumbleEndpoints = sourceBetween(
      "export const changeRequestPumbleStatus",
      "export const changeRequestNotificationPreferences",
  );

  assert.match(verifier, /userData\.active !== true/);
  assert.match(verifier, /tokenEmail !== storedEmail/);
  assert.doesNotMatch(verifier, /isAllowedCentralAdminEmail_/);
  assert.match(pumbleEndpoints, /verifyCentralAdminRequest_\(request\)/);
  assert.doesNotMatch(
      pumbleEndpoints,
      /verifyChangeRequestReviewerRequest_\(request\)/,
  );
});

test("Serve Needs keeps email authoritative and adds isolated Pumble delivery", () => {
  const submit = sourceBetween(
      "export const shareServeNeedInterest",
      "export const syncServeNeedInterestNotificationStatus",
  );
  assert.match(submit, /secrets: SERVE_NEED_NOTIFICATION_SECRETS/);
  assert.match(submit, /await queueServeNeedInterestNotification_/);
  assert.match(submit, /await queueServeNeedInterestPumbleNotifications_/);
  assert.match(submit, /catch \(pumbleError\)/);
  assert.match(submit, /let emailNotificationError = null/);
  assert.match(submit, /if \(emailNotificationError\)/);
  assert.match(serveRuntimeSource, /getEligibleServeNeedPumbleRecipient/);
  assert.match(serveRuntimeSource, /transport\.send/);
  assert.match(serveRuntimeSource, /pumbleNotificationStatus/);
});

test("Pumble preference writes preserve eligibility and Email fallback", () => {
  assert.match(
      adminHandlerSource,
      /normalizeAdminPumbleNotificationSelection/,
  );
  assert.match(adminHandlerSource, /getAdminPumbleNotificationEligibility/);
  assert.match(adminHandlerSource, /current\.email \|\|/);
  assert.match(adminHandlerSource, /!selection\.changeRequests/);
  assert.match(
      adminHandlerSource,
      /"notificationPreferences\.serveNeeds\.pumble"/,
  );
});
