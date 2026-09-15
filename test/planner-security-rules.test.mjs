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
  createPlannerStore,
  plannerPersistenceInternals,
} from "../src/planner/persistence.js";
import {cloneStarterData} from "../src/planner/seed-data.js";
import {defaultRecurrence} from "../src/planner/recurrence.js";
import {generateCampaignSchedule} from "../src/planner/domain.js";
import {buildSeriesPlan, buildOccurrencePlan, skipOccurrencePlan} from "../src/planner/series.js";

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
    eventDetails: "Doors open at 8:30 AM.",
    sampleAnnouncement: "Join us for **Women's Breakfast**.",
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

function promotionRequestPayload() {
  return {
    schemaVersion: 1,
    source: "planning-center-form",
    sourceFormId: "1229879",
    sourceFormName: "General Promotion Form",
    sourceSubmissionId: "456789",
    submittedAt: date("2026-08-16"),
    receivedAt: date("2026-08-16"),
    status: "pending-review",
    proposedName: "Community Story",
    ministry: "Communications",
    description: "Share a ministry story across Central channels.",
    notes: "Coordinate with the ministry lead.",
    requestedPlatforms: ["Social Media", "Newsletter"],
    requestedPromotionStart: date("2026-08-23"),
    requestedPromotionEnd: date("2026-09-06"),
    rawEventDateText: "",
    eventDate: null,
    eventDates: [],
    eventDateEnd: null,
    dateParseStatus: "manual-required",
    dateParseKind: null,
    dateSource: "manual-review",
    eligibility: {qualified: true},
    campaignId: "",
    reviewedByUid: "",
    createdAt: date("2026-08-16"),
    updatedAt: date("2026-08-16"),
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

test.after(async () => environment?.cleanup());

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
  await assertFails(db.doc("centralPromotionCampaigns/bad-event-details").set({...campaignPayload(), eventDetails: "x".repeat(3001)}));
  await assertFails(db.doc("centralPromotionCampaigns/bad-sample-announcement").set({...campaignPayload(), sampleAnnouncement: 42}));
  const missingBriefField = campaignPayload();
  delete missingBriefField.eventDetails;
  await assertFails(db.doc("centralPromotionCampaigns/missing-event-details").set(missingBriefField));
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
  await assertSucceeds(playRef.update({
    status: "skipped",
    conflictState: "none",
    conflictReason: "",
    smuggle: null,
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

test("regeneration can advance generated schedules but cannot rewrite protected announcements", async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const playbookRef = db.doc("centralPromotionPlaybooks/level-4-standard");
  const campaignRef = db.doc("centralPromotionCampaigns/campaign-a");
  const generatedRef = db.doc("centralPromotionScheduledPlays/generated-play");
  const manualRef = db.doc("centralPromotionScheduledPlays/manual-play");
  const lockedRef = db.doc("centralPromotionScheduledPlays/locked-play");
  const completedRef = db.doc("centralPromotionScheduledPlays/completed-play");
  const smuggleRef = db.doc("centralPromotionScheduledPlays/smuggle-play");
  await assertSucceeds(playbookRef.set({...playbookPayload(), currentVersion: 2}));
  await assertSucceeds(campaignRef.set(campaignPayload()));
  await assertSucceeds(generatedRef.set(scheduledPlayPayload()));
  await assertSucceeds(manualRef.set({...scheduledPlayPayload(), manuallyAdjusted: true}));
  await assertSucceeds(lockedRef.set({...scheduledPlayPayload(), locked: true}));
  await assertSucceeds(completedRef.set({...scheduledPlayPayload(), status: "completed"}));
  await assertSucceeds(smuggleRef.set({...scheduledPlayPayload(), manuallyAdjusted: true, smuggle: {
    hostCampaignId: "campaign-a",
    hostScheduledPlayId: "smuggle-play",
    beneficiaryCampaignId: "campaign-b",
    beneficiaryName: "Guest Campaign",
    strategy: "SMUGGLE",
  }}));
  await assertSucceeds(campaignRef.update({
    playbookVersion: 2,
    recommendedStartDate: date("2026-10-03"),
    updatedByUid: "editor",
    updatedAt: serverTime(),
  }));
  const regeneratedFields = {
    playbookVersion: 2,
    originalScheduledDate: date("2026-10-09"),
    scheduledDate: date("2026-10-09"),
    updatedByUid: "editor",
    updatedAt: serverTime(),
  };
  await assertSucceeds(generatedRef.update(regeneratedFields));
  await assertSucceeds(smuggleRef.update({...regeneratedFields, manuallyAdjusted: false, smuggle: null}));
  await assertFails(manualRef.update({...regeneratedFields, manuallyAdjusted: false}));
  await assertFails(lockedRef.update({...regeneratedFields, locked: false}));
  await assertFails(completedRef.update({...regeneratedFields, status: "scheduled"}));
  await assertFails(campaignRef.update({
    playbookVersion: 1,
    updatedByUid: "editor",
    updatedAt: serverTime(),
  }));
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

test("Planning Center requests are private and server-created only", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore()
      .doc("centralPromotionRequests/pco_1229879_456789")
      .set(promotionRequestPayload());
  });
  const requestPath = "centralPromotionRequests/pco_1229879_456789";
  await assertFails(
    environment.unauthenticatedContext().firestore().doc(requestPath).get(),
  );
  await assertSucceeds(
    environment.authenticatedContext("viewer").firestore().doc(requestPath).get(),
  );
  await assertFails(
    environment.authenticatedContext("viewer").firestore().doc(requestPath)
      .update({proposedName: "Changed"}),
  );
  await assertFails(
    environment.authenticatedContext("editor").firestore()
      .doc("centralPromotionRequests/pco_1229879_999999")
      .set({...promotionRequestPayload(), sourceSubmissionId: "999999"}),
  );
  await assertFails(
    environment.authenticatedContext("editor").firestore().doc(requestPath)
      .delete(),
  );
});

test("Planner editors can review and convert a PCO request without rewriting its source", async () => {
  const requestPath = "centralPromotionRequests/pco_1229879_456789";
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(requestPath).set(promotionRequestPayload());
  });
  const reference = environment.authenticatedContext("editor")
    .firestore().doc(requestPath);
  await assertSucceeds(reference.update({
    proposedName: "Edited Community Story",
    eventDate: date("2026-09-06"),
    eventDates: [date("2026-09-06")],
    eventDateEnd: null,
    dateParseStatus: "manual",
    dateParseKind: "single",
    dateSource: "manual-review",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  const campaignId = "request-campaign-456789";
  const wrongLinkBatch = reference.firestore.batch();
  wrongLinkBatch.set(
    reference.firestore.doc(`centralPromotionCampaigns/${campaignId}`),
    {...campaignPayload(), sourceEventId: "pco-form:1229879:wrong"},
  );
  wrongLinkBatch.update(reference, {
    status: "converted",
    campaignId,
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  });
  await assertFails(wrongLinkBatch.commit());

  const conversionBatch = reference.firestore.batch();
  conversionBatch.set(
    reference.firestore.doc(`centralPromotionCampaigns/${campaignId}`),
    {
      ...campaignPayload(),
      sourceEventId: "pco-form:1229879:456789",
    },
  );
  conversionBatch.update(reference, {
    status: "converted",
    campaignId,
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  });
  await assertSucceeds(conversionBatch.commit());
  await assertFails(reference.update({
    sourceSubmissionId: "another-submission",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    description: "x".repeat(3001),
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    proposedName: "Changed after conversion",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    campaignId: "another-campaign",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    injectedRole: "admin",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
});

test("dismissed PCO requests cannot be converted or assigned a campaign later", async () => {
  const requestPath = "centralPromotionRequests/pco_1229879_456789";
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(requestPath).set(promotionRequestPayload());
  });
  const reference = environment.authenticatedContext("editor")
    .firestore().doc(requestPath);
  await assertSucceeds(reference.update({
    status: "dismissed",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    status: "converted",
    campaignId: "late-campaign",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    proposedName: "Changed after dismissal",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
});

test("PCO request date-review fields must remain internally consistent", async () => {
  const requestPath = "centralPromotionRequests/pco_1229879_456789";
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(requestPath).set(promotionRequestPayload());
  });
  const reference = environment.authenticatedContext("editor")
    .firestore().doc(requestPath);
  await assertFails(reference.update({
    eventDate: date("2026-09-06"),
    eventDates: [],
    dateParseStatus: "manual",
    dateParseKind: "single",
    dateSource: "manual-review",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    eventDates: [date("2026-09-06")],
    dateParseKind: "single",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    eventDate: date("2026-09-10"),
    eventDates: [date("2026-09-10"), date("2026-09-05")],
    eventDateEnd: date("2026-09-05"),
    dateParseStatus: "manual",
    dateParseKind: "range",
    dateSource: "manual-review",
    reviewedByUid: "editor",
    updatedAt: serverTime(),
  }));
  await assertFails(reference.update({
    reviewedByUid: "another-user",
    updatedAt: serverTime(),
  }));
});

function recurringSeries(overrides = {}) {
  return {
    id: "series-breakfast", name: "Monthly Breakfast",
    recurrence: {...defaultRecurrence("2026-10-17"), count: 3},
    playbookId: "level-4-standard", playbookVersion: 1, level: 4,
    campaignType: "standard", submittedAt: "2026-09-01T12:00:00.000Z",
    sourceEventId: "", eventDetails: "Shared details", sampleAnnouncement: "Welcome!",
    notes: "", deadlineOffsetDays: 2, status: "active", revision: 1,
    ...overrides,
  };
}

async function withPlannerFirebase(callback) {
  const previous = globalThis.window;
  globalThis.window = {firebase};
  try { return await callback(); } finally { globalThis.window = previous; }
}

function recurrenceCloud(series = recurringSeries()) {
  return plannerPersistenceInternals.seriesForCloud(series, "editor", serverTime());
}

test("recurring series enforce Planner access and strict nested schemas", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const reference = db.doc("centralPromotionCampaignSeries/series-breakfast");
  await assertSucceeds(reference.set(recurrenceCloud()));
  await assertSucceeds(environment.authenticatedContext("viewer").firestore().collection(PLANNER_COLLECTIONS.series).get());
  for (const identity of ["viewer", "inactive", "missing"]) {
    await assertFails(environment.authenticatedContext(identity).firestore().doc(reference.path).set(recurrenceCloud()));
  }
  await assertFails(environment.unauthenticatedContext().firestore().collection(PLANNER_COLLECTIONS.series).get());
  await assertFails(reference.update({"recurrence.weekdays": [9], updatedAt: serverTime()}));
  await assertFails(reference.update({"recurrence.ordinals": [1, 1], updatedAt: serverTime()}));
  await assertFails(reference.update({"recurrence.count": 101, updatedAt: serverTime()}));
  await assertFails(reference.update({"recurrence.interval": 1.5, updatedAt: serverTime()}));
  await assertFails(reference.update({"recurrence.startDate": "2026-10-17", updatedAt: serverTime()}));
  await assertFails(reference.update({"recurrence.unexpected": true, updatedAt: serverTime()}));
  await assertFails(reference.update({notes: "x".repeat(3001), updatedAt: serverTime()}));
  await assertFails(reference.update({deadlineOffsetDays: -1, updatedAt: serverTime()}));
  await assertFails(reference.update({createdByUid: "viewer", updatedAt: serverTime()}));
  await assertFails(reference.update({submittedAt: date("2026-01-01"), updatedAt: serverTime()}));
  await assertFails(reference.update({playbookVersion: 2, updatedAt: serverTime()}));
  await assertFails(reference.update({revision: 3, updatedAt: serverTime()}));
  await assertSucceeds(reference.update({revision: 2, status: "ended", updatedAt: serverTime()}));
  await assertFails(reference.delete());
}));

test("existing campaigns can join a series once and retain immutable occurrence identity", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  await db.doc("centralPromotionCampaignSeries/series-breakfast").set(recurrenceCloud());
  const reference = db.doc("centralPromotionCampaigns/campaign-a");
  await reference.set(campaignPayload());
  const link = {seriesId: "series-breakfast", occurrenceKey: date("2026-10-17"), seriesRevision: 1, recurrenceException: false};
  await assertFails(reference.update({seriesId: "series-breakfast", updatedAt: serverTime()}));
  await assertFails(reference.update({...link, seriesId: "missing-series", updatedAt: serverTime()}));
  await assertSucceeds(reference.update({...link, updatedAt: serverTime()}));
  await assertSucceeds(reference.update({eventDate: date("2026-10-24"), recurrenceException: true, updatedAt: serverTime()}));
  await assertFails(reference.update({occurrenceKey: date("2026-10-24"), updatedAt: serverTime()}));
  await assertFails(reference.update({seriesId: "another-series", updatedAt: serverTime()}));
  await assertFails(reference.update({seriesId: firebase.firestore.FieldValue.delete(), updatedAt: serverTime()}));
  await assertFails(reference.delete());
  await assertSucceeds(reference.update({status: "archived", recurrenceException: true, updatedAt: serverTime()}));
}));

test("series store saves bounded transactions, reloads distant occurrences, and retries without duplicates", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const store = createPlannerStore({firestore: db, user: {uid: "editor"}});
  const series = recurringSeries({recurrence: {...defaultRecurrence("2028-10-17"), count: 3}});
  const playbook = cloneStarterData().playbooks.find((item) => item.id === series.playbookId);
  const schedules = ["2028-10-17", "2028-11-17", "2028-12-17"].map((eventDate) => generateCampaignSchedule({
    campaign: {...series, id: `${series.id}_${eventDate}`, eventDate, registrationDeadline: "",
      seriesId: series.id, occurrenceKey: eventDate, seriesRevision: 1, recurrenceException: false},
    playbook, generatedAt: new Date("2026-09-15T12:00:00Z"),
  }));
  const plan = {series, campaigns: schedules.map((item) => item.campaign), plays: schedules.flatMap((item) => item.plays)};
  const first = await store.saveSeriesPlan(plan);
  assert.equal(first.series.saveState, "ready");
  const workspace = await store.loadWorkspace();
  assert.equal(workspace.campaignSeries.length, 1);
  assert.equal(workspace.campaigns.length, 3);
  assert.equal(workspace.scheduledPlays.length, plan.plays.length);
  assert.equal(workspace.campaigns[0].occurrenceKey, "2028-10-17");
  assert.equal(workspace.campaignSeries[0].recurrence.startDate, "2028-10-17");
  const created = (await db.doc(`centralPromotionCampaigns/${plan.campaigns[0].id}`).get()).data().createdAt;
  await store.saveSeriesPlan(plan);
  assert.equal((await db.collection(PLANNER_COLLECTIONS.plays).get()).size, plan.plays.length);
  assert.ok(created.isEqual((await db.doc(`centralPromotionCampaigns/${plan.campaigns[0].id}`).get()).data().createdAt));
  await assert.rejects(() => store.deleteCampaign(plan.campaigns[0].id), /Skip this recurring occurrence/);
  const play = workspace.scheduledPlays[0];
  await store.saveScheduledPlay({...play, notes: "ignored", status: "completed"});
  const stale = {...play, scheduledDate: "2028-10-10", manuallyAdjusted: true};
  await assert.rejects(() => store.saveSeriesPlan({series: null, campaigns: [], plays: [stale], expectedPlays: [play]}), /changed in another session/);
  assert.equal((await db.doc(`centralPromotionScheduledPlays/${play.id}`).get()).data().status, "completed");
}));

test("an interrupted series save must finish before another revision can start", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const series = recurringSeries();
  const playbook = cloneStarterData().playbooks.find((item) => item.id === series.playbookId);
  const schedules = ["2026-10-17", "2026-11-17", "2026-12-17"].map((eventDate) => generateCampaignSchedule({
    campaign: {...series, id: `${series.id}_${eventDate}`, eventDate, registrationDeadline: "",
      seriesId: series.id, occurrenceKey: eventDate, seriesRevision: 1, recurrenceException: false},
    playbook, generatedAt: new Date("2026-09-15T12:00:00Z"),
  }));
  const plan = {series, campaigns: schedules.map((item) => item.campaign), plays: schedules.flatMap((item) => item.plays)};
  let attempts = 0;
  const interrupted = createPlannerStore({user: {uid: "editor"}, firestore: {
    collection: (name) => db.collection(name),
    runTransaction: (callback) => ++attempts === 3 ? Promise.reject(new Error("Simulated connection loss")) : db.runTransaction(callback),
  }});
  await assert.rejects(() => interrupted.saveSeriesPlan(plan), /Simulated connection loss/);
  assert.equal((await db.doc(`centralPromotionCampaignSeries/${series.id}`).get()).data().saveState, "saving");
  const normal = createPlannerStore({firestore: db, user: {uid: "editor"}});
  await assert.rejects(() => normal.saveSeriesPlan({...plan, series: {...series, revision: 2, name: "Changed after partial save"}, campaigns: [], plays: []}), /Finish the interrupted series save/);
  await normal.saveSeriesPlan(plan);
  assert.equal((await db.doc(`centralPromotionCampaignSeries/${series.id}`).get()).data().saveState, "ready");
  assert.equal((await db.collection(PLANNER_COLLECTIONS.campaigns).get()).size, 3);
  assert.equal((await db.collection(PLANNER_COLLECTIONS.plays).get()).size, plan.plays.length);
}));

test("occurrence provenance rejects mismatched playbooks and future revisions", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  await db.doc("centralPromotionCampaignSeries/series-breakfast").set(recurrenceCloud());
  const occurrence = {...campaignPayload(), seriesId: "series-breakfast", occurrenceKey: date("2026-10-17"), seriesRevision: 1, recurrenceException: false};
  const reference = db.doc("centralPromotionCampaigns/campaign-a");
  await assertFails(reference.set({...occurrence, playbookId: "another-playbook"}));
  await assertFails(reference.set({...occurrence, seriesRevision: 2}));
  await assertSucceeds(reference.set(occurrence));
  await assertFails(reference.update({seriesRevision: 2, updatedAt: serverTime()}));
  await db.doc("centralPromotionPlaybooks/level-4-standard").set({...playbookPayload(), currentVersion: 2});
  await assertSucceeds(reference.update({playbookVersion: 2, updatedAt: serverTime()}));
}));

test("real series plans survive reload, occurrence edits, future edits, skips, and ending", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const store = createPlannerStore({firestore: db, user: {uid: "editor"}});
  const generatedAt = new Date("2026-09-15T12:00:00Z");
  const context = (workspace) => ({campaigns: workspace.campaigns, plays: workspace.scheduledPlays,
    capacityRules: workspace.capacityRules, playbook: workspace.playbookVersions.find((item) => item.id === "level-4-standard"), generatedAt});
  let workspace = await store.loadWorkspace();
  await store.saveSeriesPlan(buildSeriesPlan({...context(workspace), series: recurringSeries()}));
  workspace = await store.loadWorkspace();
  assert.equal(workspace.campaigns.length, 3);
  const november = workspace.campaigns.find((item) => item.eventDate === "2026-11-17");
  await store.saveSeriesPlan(buildOccurrencePlan({...context(workspace), campaign: november, updates: {eventDate: "2026-11-24"}}));
  workspace = await store.loadWorkspace();
  assert.equal(workspace.campaigns.find((item) => item.id === november.id).registrationDeadline, "2026-11-22");
  await store.saveSeriesPlan(buildSeriesPlan({...context(workspace), series: {...workspace.campaignSeries[0], revision: 2, name: "Updated breakfast"}}));
  workspace = await store.loadWorkspace();
  assert.equal(workspace.campaigns.find((item) => item.id === november.id).eventDate, "2026-11-24");
  const december = workspace.campaigns.find((item) => item.eventDate === "2026-12-17");
  await store.saveSeriesPlan(skipOccurrencePlan({campaign: december, plays: workspace.scheduledPlays, generatedAt}));
  workspace = await store.loadWorkspace();
  assert.ok(workspace.scheduledPlays.filter((item) => item.campaignId === december.id).every((item) => item.status === "skipped"));
  await store.saveSeriesPlan(buildSeriesPlan({...context(workspace), fromDate: "2026-11-01",
    series: {...workspace.campaignSeries[0], revision: 3, status: "ended"}}));
  workspace = await store.loadWorkspace();
  assert.equal(workspace.campaignSeries[0].saveFromDate, "2026-11-01");
  assert.ok(workspace.scheduledPlays.filter((item) => item.campaignId === november.id).every((item) => item.status === "skipped"));
  assert.equal(workspace.campaigns.find((item) => item.eventDate === "2026-10-17").status, "active");
}));

test("series preview rejects changes to competing campaigns before writing", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const store = createPlannerStore({firestore: db, user: {uid: "editor"}});
  const workspace = await store.loadWorkspace();
  const series = recurringSeries();
  const plan = buildSeriesPlan({series, playbook: workspace.playbooks.find((item) => item.id === series.playbookId),
    campaigns: workspace.campaigns, plays: workspace.scheduledPlays, capacityRules: workspace.capacityRules,
    generatedAt: new Date("2026-09-15T12:00:00Z")});
  await db.doc("centralPromotionCampaigns/competing-campaign").set(campaignPayload());
  await assert.rejects(() => store.saveSeriesPlan(plan), /capacity changed since this preview/);
  assert.equal((await db.collection(PLANNER_COLLECTIONS.series).get()).size, 0);
}));

test("converted series can resume an interrupted end after reloading its saved scope", async () => withPlannerFirebase(async () => {
  const db = environment.authenticatedContext("editor").firestore();
  const store = createPlannerStore({firestore: db, user: {uid: "editor"}});
  await db.doc("centralPromotionCampaigns/campaign-a").set(campaignPayload());
  const generatedAt = new Date("2026-09-15T12:00:00Z");
  const context = (workspace) => ({campaigns: workspace.campaigns, plays: workspace.scheduledPlays,
    capacityRules: workspace.capacityRules, playbook: workspace.playbooks.find((item) => item.id === "level-4-standard"), generatedAt});
  let workspace = await store.loadWorkspace();
  const startDate = workspace.campaigns[0].eventDate;
  const conversion = buildSeriesPlan({...context(workspace), seedCampaignId: "campaign-a",
    series: recurringSeries({submittedAt: workspace.campaigns[0].submittedAt,
      recurrence: {...defaultRecurrence(startDate), count: 3}})});
  await store.saveSeriesPlan(conversion);
  // The exact original preview is also safe to retry after all its writes landed.
  await store.saveSeriesPlan(conversion);
  workspace = await store.loadWorkspace();
  const cutoff = workspace.campaigns.map((item) => item.eventDate).sort()[1];
  const ending = buildSeriesPlan({...context(workspace), fromDate: cutoff,
    series: {...workspace.campaignSeries[0], revision: 2, status: "ended"}});
  let transactions = 0;
  const interrupted = createPlannerStore({user: {uid: "editor"}, firestore: {
    collection: (name) => db.collection(name),
    runTransaction: (callback) => ++transactions === 3 ? Promise.reject(new Error("Interrupted ending")) : db.runTransaction(callback),
  }});
  await assert.rejects(() => interrupted.saveSeriesPlan(ending), /Interrupted ending/);
  workspace = await store.loadWorkspace();
  const savedSeries = workspace.campaignSeries[0];
  assert.equal(savedSeries.saveState, "saving");
  assert.equal(savedSeries.seedCampaignId, "campaign-a");
  assert.equal(savedSeries.saveFromDate, cutoff);
  await store.saveSeriesPlan(buildSeriesPlan({...context(workspace), series: savedSeries,
    fromDate: savedSeries.saveFromDate, seedCampaignId: savedSeries.seedCampaignId}));
  workspace = await store.loadWorkspace();
  assert.equal(workspace.campaignSeries[0].saveState, "ready");
  assert.equal(workspace.campaigns.find((item) => item.id === "campaign-a").status, "active");
  assert.ok(workspace.campaigns.filter((item) => item.eventDate >= cutoff).every((item) => item.status === "archived"));
}));
