import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import test from "node:test";

import {
  PLANNER_COLLECTIONS,
  plannerPersistenceInternals,
} from "../src/planner/persistence.js";
import {cloneStarterData} from "../src/planner/seed-data.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const projectId = "crosspointe-central-planner-rules";
let environment;

const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
const date = (value) => firebase.firestore.Timestamp.fromDate(new Date(`${value}T12:00:00Z`));

function playbookPayload() {
  return {
    schemaVersion: 1,
    level: 4,
    name: "Level 4 Standard",
    campaignType: "standard",
    durationWeeks: 2,
    currentVersion: 1,
    active: true,
    description: "Two-week interest campaign.",
    updatedByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

function versionPayload() {
  return {
    schemaVersion: 1,
    playbookId: "level-4-standard",
    level: 4,
    name: "Level 4 Standard",
    campaignType: "standard",
    durationWeeks: 2,
    version: 1,
    active: true,
    description: "Two-week interest campaign.",
    weeks: [1, 2].map((weekNumber) => ({
      weekNumber,
      phase: "Interest",
      label: weekNumber === 1 ? "Build Interest" : "Clear Invitation",
      plays: [{
        id: `w${weekNumber}-social`,
        playType: "Social Media Sprinkle",
        dayOfWeek: 1,
        eligibleWeekdays: [1, 5],
        channel: "Social Media",
        resourceId: "level-4-social",
        requirement: "as-available",
        supportsSmuggle: false,
        lateBehavior: "NEXT_AVAILABLE_SLOT",
        maxPlacementsPerCampaignPerWeek: 1,
      }],
    })),
    createdByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

function campaignPayload() {
  return {
    schemaVersion: 1,
    name: "Women's Breakfast",
    eventDate: date("2026-10-17"),
    registrationDeadline: date("2026-10-15"),
    submittedAt: date("2026-09-20"),
    recommendedStartDate: date("2026-10-04"),
    isOnTime: true,
    daysLate: 0,
    weeksLate: 0,
    level: 4,
    campaignType: "standard",
    playbookId: "level-4-standard",
    playbookVersion: 1,
    durationWeeks: 2,
    sourceEventId: "",
    notes: "",
    status: "active",
    createdByUid: "editor",
    updatedByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

function scheduledPlayPayload() {
  return {
    schemaVersion: 1,
    campaignId: "campaign-a",
    campaignName: "Women's Breakfast",
    campaignLevel: 4,
    campaignType: "standard",
    playbookId: "level-4-standard",
    playbookVersion: 1,
    templatePlayId: "w1-social",
    weekNumber: 1,
    phase: "Interest",
    playType: "Social Media Sprinkle",
    channel: "Social Media",
    resourceId: "level-4-social",
    originalScheduledDate: date("2026-10-05"),
    scheduledDate: date("2026-10-05"),
    eligibleWeekdays: [1, 5],
    status: "scheduled",
    requirement: "as-available",
    lateBehavior: "NEXT_AVAILABLE_SLOT",
    source: "campaign-generation",
    manuallyAdjusted: false,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    lateReason: "",
    supportsSmuggle: true,
    smuggle: null,
    createdByUid: "editor",
    updatedByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

function capacityPayload() {
  return {
    schemaVersion: 1,
    name: "Level 4 Social",
    channel: "Social Media",
    capacity: 2,
    typicalCapacity: 2,
    capacityPeriod: "week",
    allowedWeekdays: [1, 5],
    perCampaignMaximum: 1,
    eligibleLevels: [4],
    autoResolve: true,
    supportsSmuggle: true,
    allocationStrategy: "level-4-constrained-slot",
    showOnDashboard: true,
    active: true,
    updatedByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

function lanePayload() {
  return {
    schemaVersion: 1,
    name: "Level 2 Weekly Presence",
    level: 2,
    cadence: "weekly",
    fallbackPlaybookId: "level-2-ongoing-awareness",
    priorityOrder: ["event-campaign", "ongoing", "smuggle"],
    eligibleSmuggleLevels: [4, 5],
    active: true,
    updatedByUid: "editor",
    createdAt: serverTime(),
    updatedAt: serverTime(),
  };
}

async function seedUser(uid, permission = "edit", active = true, key = "planner") {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`centralAdmin/root/users/${uid}`).set({
      active,
      pageAccess: {[key]: permission},
    });
  });
}

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {rules: fs.readFileSync(path.join(projectRoot, "firestore.rules"), "utf8")},
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await Promise.all([
    seedUser("editor"),
    seedUser("viewer", "view"),
    seedUser("inactive", "admin", false),
    seedUser("legacy-studio", "edit", true, "studio"),
  ]);
});

test.after(async () => environment.cleanup());

test("anonymous, inactive, and missing admin users cannot read planner data", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("centralPromotionPlaybooks/level-4-standard").set({name: "seed"});
  });
  await assertFails(environment.unauthenticatedContext().firestore().collection("centralPromotionPlaybooks").get());
  await assertFails(environment.authenticatedContext("inactive").firestore().collection("centralPromotionPlaybooks").get());
  await assertFails(environment.authenticatedContext("missing").firestore().collection("centralPromotionPlaybooks").get());
});

test("view permission can read but cannot create or update planner records", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("centralPromotionPlaybooks/level-4-standard").set({name: "seed"});
  });
  const db = environment.authenticatedContext("viewer").firestore();
  await assertSucceeds(db.collection("centralPromotionPlaybooks").get());
  await assertFails(db.doc("centralPromotionPlaybooks/new-playbook").set({...playbookPayload(), updatedByUid: "viewer"}));
  await assertFails(db.doc("centralPromotionPlaybooks/level-4-standard").update({name: "Changed"}));
});

test("legacy Studio permission fallback grants matching Planner access", async () => {
  const db = environment.authenticatedContext("legacy-studio").firestore();
  await assertSucceeds(db.collection("centralPromotionCampaigns").get());
});

test("editor can create every valid planner entity", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  await assertSucceeds(db.doc("centralPromotionPlaybooks/level-4-standard").set(playbookPayload()));
  await assertSucceeds(db.doc("centralPromotionPlaybookVersions/level-4-standard_v1").set(versionPayload()));
  await assertSucceeds(db.doc("centralPromotionCampaigns/campaign-a").set(campaignPayload()));
  await assertSucceeds(db.doc("centralPromotionScheduledPlays/play-a").set(scheduledPlayPayload()));
  await assertSucceeds(db.doc("centralPromotionCapacityRules/level-4-social").set(capacityPayload()));
  await assertSucceeds(db.doc("centralPromotionStandingLanes/level-2-weekly").set(lanePayload()));
});

test("editor can publish the complete starter configuration in safe batches", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const starter = cloneStarterData();
  const timestamp = serverTime();
  const operations = [];
  starter.playbooks.forEach((playbook) => {
    operations.push({
      reference: db.collection(PLANNER_COLLECTIONS.playbooks).doc(playbook.id),
      payload: plannerPersistenceInternals.playbookMetaForCloud(
        playbook,
        "editor",
        timestamp,
      ),
    });
    operations.push({
      reference: db.collection(PLANNER_COLLECTIONS.versions)
        .doc(`${playbook.id}_v${playbook.version}`),
      payload: plannerPersistenceInternals.playbookVersionForCloud(
        playbook,
        "editor",
        timestamp,
      ),
    });
  });
  starter.capacityRules.forEach((rule) => {
    operations.push({
      reference: db.collection(PLANNER_COLLECTIONS.capacityRules).doc(rule.id),
      payload: plannerPersistenceInternals.capacityRuleForCloud(
        rule,
        "editor",
        timestamp,
      ),
    });
  });
  starter.standingLanes.forEach((lane) => {
    operations.push({
      reference: db.collection(PLANNER_COLLECTIONS.standingLanes).doc(lane.id),
      payload: plannerPersistenceInternals.standingLaneForCloud(
        lane,
        "editor",
        timestamp,
      ),
    });
  });

  await assertSucceeds(
    plannerPersistenceInternals.commitPlannerSetOperations(db, operations),
  );
  assert.equal(
    (await db.collection(PLANNER_COLLECTIONS.playbooks).get()).size,
    starter.playbooks.length,
  );
  assert.equal(
    (await db.collection(PLANNER_COLLECTIONS.versions).get()).size,
    starter.playbooks.length,
  );
});

test("create rejects oversized, mistyped, and extra fields", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  await assertFails(db.doc("centralPromotionPlaybookVersions/bad-duration_v1").set({
    ...versionPayload(),
    durationWeeks: 3,
  }));
  await assertFails(db.doc("centralPromotionCampaigns/bad-notes").set({...campaignPayload(), notes: "x".repeat(3001)}));
  await assertFails(db.doc("centralPromotionScheduledPlays/bad-status").set({...scheduledPlayPayload(), status: "published"}));
  await assertFails(db.doc("centralPromotionCapacityRules/bad-capacity").set({...capacityPayload(), capacity: "two"}));
  await assertFails(db.doc("centralPromotionCapacityRules/bad-typical-type").set({...capacityPayload(), typicalCapacity: "two"}));
  await assertFails(db.doc("centralPromotionCapacityRules/bad-typical-range").set({...capacityPayload(), typicalCapacity: 3}));
  await assertFails(db.doc("centralPromotionStandingLanes/extra-field").set({...lanePayload(), role: "admin"}));
});

test("valid updates cannot bypass validators or mutate immutable history", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const campaignRef = db.doc("centralPromotionCampaigns/campaign-a");
  const playRef = db.doc("centralPromotionScheduledPlays/play-a");
  const capacityRef = db.doc("centralPromotionCapacityRules/newsletter-event-card");
  await assertSucceeds(campaignRef.set(campaignPayload()));
  await assertSucceeds(playRef.set(scheduledPlayPayload()));
  await assertSucceeds(capacityRef.set({...capacityPayload(), name: "Newsletter Event Cards", channel: "Newsletter", capacity: 6, typicalCapacity: 4}));
  await assertSucceeds(playRef.update({
    scheduledDate: date("2026-10-09"),
    status: "rescheduled",
    manuallyAdjusted: true,
    updatedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(playRef.update({campaignId: "campaign-b", updatedByUid: "editor", updatedAt: serverTime()}));
  await assertFails(playRef.update({status: "hacked", updatedByUid: "editor", updatedAt: serverTime()}));
  await assertFails(campaignRef.update({playbookVersion: 99, updatedByUid: "editor", updatedAt: serverTime()}));
  await assertSucceeds(capacityRef.update({capacity: 7, typicalCapacity: 5, updatedByUid: "editor", updatedAt: serverTime()}));
  await assertFails(capacityRef.update({capacity: 4, typicalCapacity: 5, updatedByUid: "editor", updatedAt: serverTime()}));
  await assertFails(capacityRef.update({typicalCapacity: 4, injectedRole: "admin", updatedByUid: "editor", updatedAt: serverTime()}));
});

test("playbook versions remain immutable while editors can atomically delete a campaign and its plays", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const versionRef = db.doc("centralPromotionPlaybookVersions/level-4-standard_v1");
  const campaignRef = db.doc("centralPromotionCampaigns/campaign-a");
  const playRef = db.doc("centralPromotionScheduledPlays/play-a");
  await assertSucceeds(versionRef.set(versionPayload()));
  await assertSucceeds(campaignRef.set(campaignPayload()));
  await assertSucceeds(playRef.set(scheduledPlayPayload()));
  await assertFails(versionRef.update({name: "Rewritten"}));
  await assertFails(versionRef.delete());
  await assertFails(playRef.delete());
  const batch = db.batch();
  batch.delete(playRef);
  batch.delete(campaignRef);
  await assertSucceeds(batch.commit());
});

test("built-in playbooks are protected while editors can delete custom playbooks", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const builtInRef = db.doc("centralPromotionPlaybooks/level-4-standard");
  const customRef = db.doc("centralPromotionPlaybooks/custom-stewardship");
  await assertSucceeds(builtInRef.set(playbookPayload()));
  await assertSucceeds(customRef.set({...playbookPayload(), name: "Stewardship Campaign"}));
  await assertFails(builtInRef.delete());
  await assertSucceeds(customRef.delete());
});

test("viewers cannot delete campaigns or scheduled plays", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("centralPromotionCampaigns/campaign-a").set(campaignPayload());
    await context.firestore().doc("centralPromotionScheduledPlays/play-a").set(scheduledPlayPayload());
    await context.firestore().doc("centralPromotionPlaybooks/custom-stewardship").set(playbookPayload());
  });
  const db = environment.authenticatedContext("viewer").firestore();
  await assertFails(db.doc("centralPromotionCampaigns/campaign-a").delete());
  await assertFails(db.doc("centralPromotionScheduledPlays/play-a").delete());
  await assertFails(db.doc("centralPromotionPlaybooks/custom-stewardship").delete());
});

test("Smuggle relationship must use the strict explicit schema", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const reference = db.doc("centralPromotionScheduledPlays/play-a");
  await assertSucceeds(reference.set(scheduledPlayPayload()));
  await assertSucceeds(reference.update({
    smuggle: {
      hostCampaignId: "campaign-a",
      hostScheduledPlayId: "play-a",
      beneficiaryCampaignId: "campaign-b",
      beneficiaryName: "Sewing Group",
      strategy: "SMUGGLE",
    },
    updatedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    smuggle: {
      hostCampaignId: "campaign-a",
      hostScheduledPlayId: "play-a",
      beneficiaryCampaignId: "campaign-b",
      beneficiaryName: "Sewing Group",
      strategy: "AUTO_SMUGGLE",
    },
    updatedByUid: "editor",
    updatedAt: serverTime(),
  }));
});
