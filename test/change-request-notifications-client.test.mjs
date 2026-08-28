import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const adminSource = fs.readFileSync(
    path.join(projectRoot, "public/admin.js"),
    "utf8",
);
const adminStyles = fs.readFileSync(
    path.join(projectRoot, "public/admin.css"),
    "utf8",
);

test("Change Request notification UI uses the privileged endpoint", () => {
  assert.match(
      adminSource,
      /\/api\/admin\/change-request-notification-preferences/,
  );
  assert.match(adminSource, /Authorization: "Bearer " \+ idToken/);
  assert.match(adminSource, /channels: channels/);
});

test("temporary preference failures cannot overwrite stored channels", () => {
  const normalizeStart = adminSource.indexOf(
      "function normalizeChangeRequestNotificationPreferences_",
  );
  const normalizeEnd = adminSource.indexOf(
      "function normalizeChangeRequestNotificationChannels_",
      normalizeStart,
  );
  const normalizeBlock = adminSource.slice(normalizeStart, normalizeEnd);
  assert.doesNotMatch(normalizeBlock, /channels\s*=\s*\["email"\]/);

  const loadStart = adminSource.indexOf(
      "function loadChangeRequestNotificationPreferencesIfNeeded_",
  );
  const saveStart = adminSource.indexOf(
      "function saveChangeRequestNotificationPreferences_",
      loadStart,
  );
  const loadBlock = adminSource.slice(loadStart, saveStart);
  assert.match(loadBlock, /changeRequestNotificationsLoadFailed = true/);
  assert.doesNotMatch(
      loadBlock,
      /\.catch\([\s\S]*changeRequestNotificationChannels\s*=\s*\["email"\]/,
  );
  assert.match(
      adminSource,
      /changeRequestNotificationsSaving \|\|[\s\S]*changeRequestNotificationsLoadFailed/,
  );
});

test("submitted notification links can expand the intended request", () => {
  assert.match(
      adminSource,
      /new URLSearchParams\(window\.location\.search\)\.get\("request"\)/,
  );
  assert.match(adminSource, /changeRequestsExpandedId = requestedId/);
});

test("Pumble linking uses authenticated status and mutation endpoints", () => {
  assert.match(adminSource, /\/api\/admin\/pumble\/status/);
  assert.match(adminSource, /\/api\/admin\/pumble\/oauth\/start/);
  assert.match(adminSource, /\/api\/admin\/pumble\/disconnect/);
  assert.match(
      adminSource,
      /function callChangeRequestPumbleEndpoint_[\s\S]*getIdToken\(\)/,
  );
  assert.match(adminSource, /Authorization: "Bearer " \+ idToken/);
  assert.match(adminSource, /window\.location\.assign\(authorizationUrl\)/);
  assert.match(adminSource, /parsed\.origin !== "https:\/\/app\.pumble\.com"/);
  assert.match(adminSource, /parsed\.pathname !== "\/access-request"/);
});

test("Pumble settings live in Integrations and require verified linking", () => {
  const renderStart = adminSource.indexOf(
      "function renderPumbleIntegrationSection_",
  );
  const renderEnd = adminSource.indexOf(
      "function renderPumbleNotificationType_",
      renderStart,
  );
  const renderBlock = adminSource.slice(renderStart, renderEnd);

  assert.match(renderBlock, /changeRequestPumbleConnectionLoaded/);
  assert.match(renderBlock, /changeRequestPumbleLinked/);
  assert.match(renderBlock, /!linked \|\| eligibility\.changeRequests !== true/);
  assert.match(renderBlock, /!linked \|\| eligibility\.serveNeeds !== true/);
  assert.match(renderBlock, /Serve Needs responses/);
  assert.match(adminSource, /Link Pumble/);
  assert.match(adminSource, /Reconnect/);
  assert.match(adminSource, /Disconnect/);
  assert.match(adminStyles, /central-admin-pumble-connection\.is-connected/);
  assert.match(adminStyles, /central-admin-pumble-connection\.is-error/);
  assert.match(adminStyles, /central-admin-pumble-connection\.is-loading/);
  assert.match(
      adminStyles,
      /central-admin-notification-options\.is-two-column[\s\S]*grid-template-columns: 1fr/,
  );

  const saveStart = adminSource.indexOf(
      "function savePumbleNotificationPreferences_",
  );
  const saveEnd = adminSource.indexOf(
      "function callChangeRequestNotificationPreferencesEndpoint_",
      saveStart,
  );
  const saveBlock = adminSource.slice(saveStart, saveEnd);
  assert.match(saveBlock, /changeRequestPumbleConnectionLoaded/);
  assert.match(saveBlock, /changeRequestPumbleLinked/);
  assert.match(saveBlock, /pumbleNotifications: selected/);
  assert.doesNotMatch(saveBlock, /pumbleIdentity\.status/);

  const changeRequestStart = adminSource.indexOf(
      "function renderChangeRequestNotificationPreferences_",
  );
  const changeRequestEnd = adminSource.indexOf(
      "function renderChangeRequestPumbleActions_",
      changeRequestStart,
  );
  const changeRequestBlock = adminSource.slice(
      changeRequestStart,
      changeRequestEnd,
  );
  assert.match(changeRequestBlock, /Email notifications/);
  assert.match(changeRequestBlock, /\/admin\/integrations/);
  assert.doesNotMatch(changeRequestBlock, /link-change-request-pumble/);
});

test("Pumble OAuth returns use safe codes and leave other query state", () => {
  const handlerStart = adminSource.indexOf(
      "function handleChangeRequestPumbleOAuthReturn_",
  );
  const handlerEnd = adminSource.indexOf(
      "function normalizeChangeRequestNotificationPreferences_",
      handlerStart,
  );
  const handlerBlock = adminSource.slice(handlerStart, handlerEnd);

  assert.match(handlerBlock, /searchParams\.get\("pumble"\)/);
  assert.match(handlerBlock, /searchParams\.get\("pumble_code"\)/);
  assert.match(handlerBlock, /status !== "pending" && status !== "error"/);
  assert.match(handlerBlock, /hashParams\.get\("pumble_token"\)/);
  assert.doesNotMatch(handlerBlock, /searchParams\.get\("pumble_token"\)/);
  assert.match(handlerBlock, /CHANGE_REQUEST_PUMBLE_OAUTH_COMPLETE_ENDPOINT/);
  assert.match(handlerBlock, /pumble-oauth-state-expired/);
  assert.match(handlerBlock, /pumble-oauth-user-mismatch/);
  assert.match(handlerBlock, /pumble-oauth-completion-expired/);
  assert.match(handlerBlock, /pumble-oauth-exchange-failed/);
  assert.match(handlerBlock, /pumble-bot-verification-failed/);
  assert.match(handlerBlock, /pumble-workspace-mismatch/);
  assert.doesNotMatch(handlerBlock, /pumble_message/);
  assert.match(
      handlerBlock,
      /adminState\.currentPageId = "integrations";[\s\S]*clearChangeRequestPumbleOAuthParams_\(\)/,
  );
  assert.match(handlerBlock, /nextUrl\.pathname = "\/admin\/integrations"/);
  assert.match(handlerBlock, /nextUrl\.searchParams\.delete\("pumble"\)/);
  assert.match(handlerBlock, /nextUrl\.searchParams\.delete\("pumble_token"\)/);
  assert.match(
      handlerBlock,
      /nextUrl\.pathname \+ \(nextUrl\.search \|\| ""\) \+ \(nextUrl\.hash \|\| ""\)/,
  );
  assert.match(
      adminSource,
      /function renderAdminMain_[\s\S]*renderChangeRequestPumbleOAuthReturnNotice_\(\)/,
  );
  assert.match(adminSource, /Open Pumble settings/);
});

test("every active Admin can open Integrations without seeing gated services", () => {
  const accessStart = adminSource.indexOf("function canAccessAdminPage_");
  const accessEnd = adminSource.indexOf(
      "function getPageAccessLevel_",
      accessStart,
  );
  const accessBlock = adminSource.slice(accessStart, accessEnd);
  assert.match(accessBlock, /page\.id === "integrations"/);
  assert.match(accessBlock, /return true/);

  const renderStart = adminSource.indexOf(
      "function renderIntegrationsPagePanel_",
  );
  const renderEnd = adminSource.indexOf(
      "function renderPumbleIntegrationSection_",
      renderStart,
  );
  const renderBlock = adminSource.slice(renderStart, renderEnd);
  assert.match(renderBlock, /canViewServiceSettings = permission !== "none"/);
  assert.match(renderBlock, /renderPumbleIntegrationSection_\(\)/);
  assert.match(renderBlock, /canViewServiceSettings \? \[/);
  assert.match(renderBlock, /renderGoogleCalendarIntegrationSection_\(\)/);
  assert.match(renderBlock, /renderPlanningCenterIntegrationSection_\(\)/);
});

test("disconnect applies server-normalized Email preferences", () => {
  const disconnectStart = adminSource.indexOf(
      "function disconnectChangeRequestPumble_",
  );
  const disconnectEnd = adminSource.indexOf(
      "function callChangeRequestPumbleEndpoint_",
      disconnectStart,
  );
  const disconnectBlock = adminSource.slice(disconnectStart, disconnectEnd);

  assert.match(disconnectBlock, /result\.preferences\.channels/);
  assert.match(
      disconnectBlock,
      /changeRequestNotificationChannels\s*=/,
  );
  assert.match(disconnectBlock, /changeRequestNotificationsLoaded = true/);
});

test("notification responses are ignored after an auth account change", () => {
  const pumbleStatusStart = adminSource.indexOf(
      "function loadChangeRequestPumbleStatusIfNeeded_",
  );
  const preferencesStart = adminSource.indexOf(
      "function loadChangeRequestNotificationPreferencesIfNeeded_",
  );
  const preferencesEnd = adminSource.indexOf(
      "function callChangeRequestNotificationPreferencesEndpoint_",
      preferencesStart,
  );
  const pumbleStatusBlock = adminSource.slice(
      pumbleStatusStart,
      preferencesStart,
  );
  const preferencesBlock = adminSource.slice(
      preferencesStart,
      preferencesEnd,
  );

  assert.match(pumbleStatusBlock, /var requestUid = getCurrentAdminUserUid_\(\)/);
  assert.match(pumbleStatusBlock, /isCurrentAdminUserUid_\(requestUid\)/);
  assert.match(preferencesBlock, /var requestUid = getCurrentAdminUserUid_\(\)/);
  assert.match(preferencesBlock, /isCurrentAdminUserUid_\(requestUid\)/);
});
