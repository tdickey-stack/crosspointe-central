import assert from "node:assert/strict";

import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";

if (!getApps().length) initializeApp({projectId: "crosspointe-central"});
const db = getFirestore();
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const hostingBase = "http://127.0.0.1:5005";
const suffix = Date.now();

async function signUp(label) {
  const response = await fetch(`${authBase}/accounts:signUp?key=emulator`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email: `studio-${label}-${suffix}@example.test`,
      password: "emulator-only-password",
      returnSecureToken: true,
    }),
  });
  const data = await response.json();
  assert.equal(response.ok, true, data.error?.message);
  await db.doc(`centralAdmin/root/users/${data.localId}`).set({
    active: true,
    pageAccess: {studio: "edit"},
  });
  return {uid: data.localId, token: data.idToken};
}

async function api(path, token, body) {
  const response = await fetch(`${hostingBase}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? {"Content-Type": "application/json"} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return {response, data};
}

const owner = await signUp("owner");
const member = await signUp("member");
const projectId = `smoke-${suffix}`;
await db.doc(`centralStudioProjects/${projectId}`).set({
  schemaVersion: 1,
  ownerUid: owner.uid,
  templateId: "policy-document",
  name: "Emulator Smoke Project",
  status: "draft",
  sourceType: "manual",
  content: {},
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});
await db.doc(`centralStudioProjects/${projectId}/pages/example-page`).set({
  schemaVersion: 1,
  templateId: "document-content-page",
  content: {},
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const share = await api("/api/studio/projects/share", owner.token, {projectId});
assert.equal(share.response.status, 200, share.data.error);
assert.match(share.data.shareUrl, /\/studio\?share=/);
const token = new URL(share.data.shareUrl).searchParams.get("share");
assert.ok(token);

const accepted = await api("/api/studio/shares/accept", member.token, {token});
assert.equal(accepted.response.status, 200, accepted.data.error);
assert.equal(accepted.data.projectId, projectId);
assert.equal(
  (
    await db.doc(`centralStudioMemberships/${member.uid}_${projectId}`).get()
  ).exists,
  true,
);

const unsplash = await api(
  "/api/studio/unsplash/search?q=community",
  owner.token,
);
assert.ok(
  [200, 503].includes(unsplash.response.status),
  unsplash.data.error || `Unexpected Unsplash status ${unsplash.response.status}`,
);
if (unsplash.response.status === 200) {
  assert.ok(Array.isArray(unsplash.data.results));
}

const deleted = await api("/api/studio/projects/delete", owner.token, {
  projectId,
});
assert.equal(deleted.response.status, 200, deleted.data.error);
assert.equal((await db.doc(`centralStudioProjects/${projectId}`).get()).exists, false);
assert.equal(
  (
    await db.doc(`centralStudioProjects/${projectId}/pages/example-page`).get()
  ).exists,
  false,
);
assert.equal(
  (
    await db.doc(`centralStudioMemberships/${member.uid}_${projectId}`).get()
  ).exists,
  false,
);

console.log(
  "Studio emulator smoke test passed: auth, share, accept, Unsplash access, and document delete.",
);
