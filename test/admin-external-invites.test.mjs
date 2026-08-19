import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {
  getAdminUserManagementStatusCode_,
  isVerifiedGoogleInviteIdentity_,
} from "../functions/helpers/helpers.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function googleIdentity(overrides = {}) {
  return {
    email: "volunteer@example.com",
    email_verified: true,
    firebase: {sign_in_provider: "google.com"},
    ...overrides,
  };
}

test("a verified external Google identity can claim its exact invitation", () => {
  assert.equal(
      isVerifiedGoogleInviteIdentity_(
          googleIdentity({email: "Volunteer@Example.com"}),
          "volunteer@example.com",
      ),
      true,
  );
});

test("an external invitation cannot be claimed by a different identity", () => {
  assert.equal(
      isVerifiedGoogleInviteIdentity_(
          googleIdentity({email: "someone-else@example.com"}),
          "volunteer@example.com",
      ),
      false,
  );
});

test("external invitation claims require a verified Google account", () => {
  assert.equal(
      isVerifiedGoogleInviteIdentity_(
          googleIdentity({email_verified: false}),
          "volunteer@example.com",
      ),
      false,
  );
  assert.equal(
      isVerifiedGoogleInviteIdentity_(
          googleIdentity({firebase: {sign_in_provider: "password"}}),
          "volunteer@example.com",
      ),
      false,
  );
});

test("external invite validation failures return intentional client errors", () => {
  assert.equal(
      getAdminUserManagementStatusCode_({
        code: "external-admin-invite-required",
      }),
      400,
  );
  assert.equal(
      getAdminUserManagementStatusCode_({
        code: "admin-invite-google-account-required",
      }),
      403,
  );
});

test("the admin flow accepts outside invitees without opening manager access", () => {
  const adminSource = fs.readFileSync(
      path.join(projectRoot, "public/admin.js"),
      "utf8",
  );
  const backendSource = fs.readFileSync(
      path.join(projectRoot, "functions/index.js"),
      "utf8",
  );
  const inviteCreationSource = sourceBetween(
      backendSource,
      "async function upsertPendingAdminInvite_",
      "async function deleteAdminUserRecord_",
  );
  const inviteClaimSource = sourceBetween(
      backendSource,
      "async function claimAdminInvite_",
      "async function resolveAdminUserAuthRecord_",
  );

  assert.match(adminSource, /Outside email addresses are supported\./);
  assert.match(inviteCreationSource, /looksLikeEmailAddress_\(requestedEmail\)/);
  assert.doesNotMatch(inviteCreationSource, /isAllowedCentralAdminEmail_/);
  assert.match(
      inviteClaimSource,
      /isVerifiedGoogleInviteIdentity_\(\s*decodedToken,\s*inviteData\.invitedEmail,?\s*\)/,
  );
  assert.doesNotMatch(inviteClaimSource, /isAllowedCentralAdminEmail_/);
  assert.match(
      backendSource,
      /async function verifyAdminUserManagerAccess_\([\s\S]*?isAllowedCentralAdminEmail_\(email\)/,
  );
});

test("an invited external user reaches only their granted workspace overview", () => {
  const adminSource = fs.readFileSync(
      path.join(projectRoot, "public/admin.js"),
      "utf8",
  );
  const backendSource = fs.readFileSync(
      path.join(projectRoot, "functions/index.js"),
      "utf8",
  );
  const authListenerSource = sourceBetween(
      adminSource,
      "adminAuth.onAuthStateChanged(function(user)",
      "function connectEmulatorsIfNeeded_",
  );
  const overviewSource = sourceBetween(
      adminSource,
      "function renderOverviewPagePanel_",
      "function renderOverviewAccessPanel_",
  );

  assert.match(authListenerSource, /adminState\.userDocPath = getAdminUserDocPath_\(user\.uid\);\s*loadAdminUserDoc_\(\);/);
  assert.doesNotMatch(authListenerSource, /if \(!adminState\.userEmailAllowed\)/);
  assert.match(overviewSource, /!isActiveAdminUserRecord_\(\)/);
  assert.doesNotMatch(overviewSource, /!adminState\.userEmailAllowed/);
  assert.match(adminSource, /Only the tools granted to you are shown\./);
  assert.match(adminSource, /No workspace access found/);
  assert.match(adminSource, /Confirming your Central workspace invitation\./);
  assert.match(backendSource, /You've been invited to CrossPointe Central\./);
  assert.doesNotMatch(backendSource, /You've been invited to be an admin in CrossPointe Central\./);
});
