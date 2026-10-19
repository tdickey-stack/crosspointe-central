/* eslint-disable require-jsdoc */

import assert from "node:assert/strict";
import test from "node:test";

import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

import {createHomePromotionsService} from "./service.js";

const EMULATOR_HOST = String(
    process.env.FIRESTORE_EMULATOR_HOST || "",
).trim();

test("Firestore transaction preserves revisions and adjacent schedules", {
  skip: !EMULATOR_HOST,
}, async () => {
  const projectId = process.env.GCLOUD_PROJECT ||
    "demo-central-home-promotions";
  if (!/^(?:127[.]0[.]0[.]1|localhost|\[::1\]):\d+$/.test(EMULATOR_HOST) ||
    !projectId.startsWith("demo-")) {
    throw new Error(
        "Home promotion emulator tests require a loopback host and " +
          "demo- project.",
    );
  }
  const appName = "home-promotions-emulator-" + Date.now();
  const app = initializeApp({projectId}, appName);
  const firestore = getFirestore(app);
  const now = Date.now();
  const prefix = "emulator-" + now;
  const firstId = prefix + "-first";
  const secondId = prefix + "-second";
  const collection = firestore.collection(
      "centralAdmin/root/homePromotions",
  );
  const service = createHomePromotionsService({
    firestore,
    timestampFromMillis: (milliseconds) => Timestamp.fromMillis(milliseconds),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    now: () => now,
  });
  const publicData = {
    settings: {featured_event_enabled: false, homepage_modules: []},
    campaigns: [{
      id: "campaign-1",
      title: "Campaign One",
      active: "TRUE",
    }],
  };
  const actor = {
    uid: "emulator-admin",
    email: "emulator@crosspointe.tv",
    displayName: "Emulator Admin",
  };
  const first = {
    id: firstId,
    sourceType: "campaigns",
    sourceId: "campaign-1",
    startsAt: new Date(now - 60 * 1000).toISOString(),
    endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
    order: 10,
    active: true,
    revision: 0,
  };
  const second = {
    ...first,
    id: secondId,
    startsAt: first.endsAt,
    endsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const created = await service.save(first, actor, publicData);
    assert.equal(created.revision, 1);
    assert.equal((await service.save(first, actor, publicData)).revision, 1);
    assert.equal((await service.save(second, actor, publicData)).revision, 1);

    const highlights = await service.publicProjection(publicData);
    assert.deepEqual(highlights.map((item) => item.promotionId), [firstId]);

    const updated = await service.save({
      ...first,
      order: 20,
      revision: 1,
    }, actor, publicData);
    assert.equal(updated.revision, 2);
    const stored = await collection.doc(firstId).get();
    assert.equal(stored.get("revision"), 2);
    assert.equal(stored.get("startsAt") instanceof Timestamp, true);
  } finally {
    await Promise.all([
      collection.doc(firstId).delete(),
      collection.doc(secondId).delete(),
    ]);
    if (getApps().some((candidate) => candidate.name === appName)) {
      await deleteApp(app);
    }
  }
});

test("concurrent overlapping creates save exactly one placement", {
  skip: !EMULATOR_HOST,
}, async () => {
  const projectId = process.env.GCLOUD_PROJECT ||
    "demo-central-home-promotions";
  if (!/^(?:127[.]0[.]0[.]1|localhost|\[::1\]):\d+$/.test(EMULATOR_HOST) ||
    !projectId.startsWith("demo-")) {
    throw new Error(
        "Home promotion emulator tests require a loopback host and " +
          "demo- project.",
    );
  }
  const appName = "home-promotions-race-" + Date.now();
  const app = initializeApp({projectId}, appName);
  const firestore = getFirestore(app);
  const now = Date.now();
  const prefix = "race-" + now;
  const firstId = prefix + "-first";
  const secondId = prefix + "-second";
  const collection = firestore.collection(
      "centralAdmin/root/homePromotions",
  );
  const service = createHomePromotionsService({
    firestore,
    timestampFromMillis: (milliseconds) => Timestamp.fromMillis(milliseconds),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    now: () => now,
  });
  const publicData = {
    settings: {featured_event_enabled: false, homepage_modules: []},
    campaigns: [{
      id: "campaign-race",
      title: "Campaign Race",
      active: "TRUE",
    }],
  };
  const actor = {
    uid: "emulator-admin",
    email: "emulator@crosspointe.tv",
    displayName: "Emulator Admin",
  };
  const placement = {
    sourceType: "campaigns",
    sourceId: "campaign-race",
    startsAt: new Date(now - 60 * 1000).toISOString(),
    endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
    order: 10,
    active: true,
    revision: 0,
  };

  try {
    const results = await Promise.allSettled([
      service.save({...placement, id: firstId}, actor, publicData),
      service.save({...placement, id: secondId}, actor, publicData),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "promotion-source-overlap");
    assert.equal(rejected[0].reason.status, 409);

    const stored = await Promise.all([
      collection.doc(firstId).get(),
      collection.doc(secondId).get(),
    ]);
    assert.equal(stored.filter((snapshot) => snapshot.exists).length, 1);
  } finally {
    await Promise.all([
      collection.doc(firstId).delete(),
      collection.doc(secondId).delete(),
    ]);
    if (getApps().some((candidate) => candidate.name === appName)) {
      await deleteApp(app);
    }
  }
});
