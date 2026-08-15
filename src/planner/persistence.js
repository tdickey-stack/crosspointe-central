import {
  addDays,
  allocateLevel4SocialSlots,
  dateKey,
  ensureLevel2StandingLane,
  evaluateCapacity,
  generateCampaignSchedule,
  startOfSundayWeek,
} from "./domain.js";
import {cloneStarterData, isStarterPlaybookId} from "./seed-data.js";

export const PLANNER_COLLECTIONS = {
  playbooks: "centralPromotionPlaybooks",
  versions: "centralPromotionPlaybookVersions",
  campaigns: "centralPromotionCampaigns",
  plays: "centralPromotionScheduledPlays",
  capacityRules: "centralPromotionCapacityRules",
  standingLanes: "centralPromotionStandingLanes",
};

const PLANNER_RULES_SAFE_BATCH_SIZE = 5;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isBoundedString(value, maximum, {required = false} = {}) {
  return typeof value === "string" && value.length <= maximum &&
    (!required || value.length > 0);
}

function assertValidPlaybookDefinition(playbook) {
  const weeks = playbook?.weeks;
  if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 12 ||
    Number(playbook.durationWeeks) !== weeks.length) {
    throw new Error("The playbook must contain one definition for every campaign week.");
  }
  weeks.forEach((week, weekIndex) => {
    if (!week || Number(week.weekNumber) !== weekIndex + 1 ||
      !isBoundedString(week.phase, 50, {required: true}) ||
      !isBoundedString(week.label, 120) ||
      !Array.isArray(week.plays) || week.plays.length > 40) {
      throw new Error(`Week ${weekIndex + 1} has an invalid playbook definition.`);
    }
    week.plays.forEach((play) => {
      const weekdays = play?.eligibleWeekdays;
      const validWeekdays = Array.isArray(weekdays) && weekdays.length <= 7 &&
        weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
      if (!play || !isBoundedString(play.id, 100, {required: true}) ||
        !isBoundedString(play.playType, 120, {required: true}) ||
        !Number.isInteger(play.dayOfWeek) || play.dayOfWeek < 0 ||
        play.dayOfWeek > 6 || !validWeekdays ||
        !isBoundedString(play.channel, 100) ||
        !isBoundedString(play.resourceId, 100) ||
        !["required", "optional", "as-available"].includes(play.requirement) ||
        typeof play.supportsSmuggle !== "boolean" ||
        !["SKIP", "NEXT_AVAILABLE_SLOT", "NEXT_OCCURRENCE", "MANUAL_REVIEW"]
          .includes(play.lateBehavior) ||
        !Number.isInteger(play.maxPlacementsPerCampaignPerWeek) ||
        play.maxPlacementsPerCampaignPerWeek < 1 ||
        play.maxPlacementsPerCampaignPerWeek > 20) {
        throw new Error(
          `Week ${weekIndex + 1} contains an invalid promotion play.`,
        );
      }
    });
  });
}

function isoNow() {
  return new Date().toISOString();
}

function createId(prefix = "planner") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function timestampToIso(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

function timestampToDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = timestampToIso(value);
  return iso ? dateKey(iso) : "";
}

function dateTimestamp(value) {
  if (!value) return null;
  return window.firebase.firestore.Timestamp.fromDate(
    new Date(`${dateKey(value)}T12:00:00.000Z`),
  );
}

function instantTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return window.firebase.firestore.Timestamp.fromDate(parsed);
}

function documentData(snapshot) {
  return {id: snapshot.id, ...snapshot.data()};
}

function normalizePlaybookVersion(data) {
  return {
    ...data,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function normalizePlannerDocument(data) {
  return {
    ...data,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function normalizeCampaign(data) {
  return {
    ...data,
    eventDate: timestampToDateKey(data.eventDate),
    registrationDeadline: timestampToDateKey(data.registrationDeadline),
    recommendedStartDate: timestampToDateKey(data.recommendedStartDate),
    submittedAt: timestampToIso(data.submittedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function normalizePlay(data) {
  return {
    ...data,
    originalScheduledDate: timestampToDateKey(data.originalScheduledDate),
    scheduledDate: timestampToDateKey(data.scheduledDate),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function campaignForCloud(campaign, ownerUid, timestamp) {
  return {
    schemaVersion: 1,
    name: String(campaign.name || "").slice(0, 140),
    eventDate: dateTimestamp(campaign.eventDate),
    registrationDeadline: campaign.registrationDeadline
      ? dateTimestamp(campaign.registrationDeadline)
      : null,
    submittedAt: instantTimestamp(campaign.submittedAt),
    recommendedStartDate: dateTimestamp(campaign.recommendedStartDate),
    isOnTime: campaign.isOnTime === true,
    daysLate: Number(campaign.daysLate || 0),
    weeksLate: Number(campaign.weeksLate || 0),
    level: Number(campaign.level),
    campaignType: String(campaign.campaignType || "").slice(0, 80),
    playbookId: String(campaign.playbookId || "").slice(0, 100),
    playbookVersion: Number(campaign.playbookVersion || 1),
    durationWeeks: Number(campaign.durationWeeks || 1),
    sourceEventId: String(campaign.sourceEventId || "").slice(0, 100),
    notes: String(campaign.notes || "").slice(0, 3000),
    status: ["draft", "active", "completed", "archived"].includes(campaign.status)
      ? campaign.status
      : "active",
    createdByUid: String(campaign.createdByUid || ownerUid),
    updatedByUid: ownerUid,
    createdAt: campaign.createdAt ? instantTimestamp(campaign.createdAt) : timestamp,
    updatedAt: timestamp,
  };
}

function smuggleForCloud(smuggle) {
  if (!smuggle) return null;
  return {
    hostCampaignId: String(smuggle.hostCampaignId || "").slice(0, 128),
    hostScheduledPlayId: String(smuggle.hostScheduledPlayId || "").slice(0, 128),
    beneficiaryCampaignId: String(smuggle.beneficiaryCampaignId || "").slice(0, 128),
    beneficiaryName: String(smuggle.beneficiaryName || "").slice(0, 140),
    strategy: "SMUGGLE",
  };
}

function playForCloud(play, ownerUid, timestamp) {
  return {
    schemaVersion: 1,
    campaignId: String(play.campaignId || "").slice(0, 128),
    campaignName: String(play.campaignName || "").slice(0, 140),
    campaignLevel: Number(play.campaignLevel),
    campaignType: String(play.campaignType || "").slice(0, 80),
    playbookId: String(play.playbookId || "").slice(0, 100),
    playbookVersion: Number(play.playbookVersion || 1),
    templatePlayId: String(play.templatePlayId || "").slice(0, 100),
    weekNumber: Number(play.weekNumber || 1),
    phase: String(play.phase || "").slice(0, 50),
    playType: String(play.playType || "").slice(0, 120),
    channel: String(play.channel || "").slice(0, 100),
    resourceId: String(play.resourceId || "").slice(0, 100),
    originalScheduledDate: dateTimestamp(play.originalScheduledDate),
    scheduledDate: dateTimestamp(play.scheduledDate),
    eligibleWeekdays: (play.eligibleWeekdays || []).slice(0, 7).map(Number),
    status: String(play.status || "scheduled"),
    requirement: String(play.requirement || "required"),
    lateBehavior: String(play.lateBehavior || "SKIP"),
    source: String(play.source || "campaign-generation").slice(0, 60),
    manuallyAdjusted: play.manuallyAdjusted === true,
    locked: play.locked === true,
    conflictState: String(play.conflictState || "none").slice(0, 80),
    conflictReason: String(play.conflictReason || "").slice(0, 800),
    lateReason: String(play.lateReason || "").slice(0, 800),
    supportsSmuggle: play.supportsSmuggle === true,
    smuggle: smuggleForCloud(play.smuggle),
    createdByUid: String(play.createdByUid || ownerUid),
    updatedByUid: ownerUid,
    createdAt: play.createdAt ? instantTimestamp(play.createdAt) : timestamp,
    updatedAt: timestamp,
  };
}

function playbookMetaForCloud(playbook, ownerUid, timestamp) {
  return {
    schemaVersion: 1,
    level: Number(playbook.level),
    name: String(playbook.name || "").slice(0, 120),
    campaignType: String(playbook.campaignType || "").slice(0, 80),
    durationWeeks: Number(playbook.durationWeeks || 1),
    currentVersion: Number(playbook.version || 1),
    active: playbook.active !== false,
    description: String(playbook.description || "").slice(0, 1000),
    updatedByUid: ownerUid,
    createdAt: playbook.createdAt ? instantTimestamp(playbook.createdAt) : timestamp,
    updatedAt: timestamp,
  };
}

function playbookVersionForCloud(playbook, ownerUid, timestamp) {
  assertValidPlaybookDefinition(playbook);
  return {
    schemaVersion: 1,
    playbookId: String(playbook.id || "").slice(0, 100),
    level: Number(playbook.level),
    name: String(playbook.name || "").slice(0, 120),
    campaignType: String(playbook.campaignType || "").slice(0, 80),
    durationWeeks: Number(playbook.durationWeeks || 1),
    version: Number(playbook.version || 1),
    active: playbook.active !== false,
    description: String(playbook.description || "").slice(0, 1000),
    weeks: deepClone(playbook.weeks || []).slice(0, 12),
    createdByUid: ownerUid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function capacityRuleForCloud(rule, ownerUid, timestamp) {
  const capacity = Math.max(1, Number(rule.capacity || 1));
  const typicalCapacity = Math.min(
    capacity,
    Math.max(1, Number(rule.typicalCapacity || capacity)),
  );
  return {
    schemaVersion: 1,
    name: String(rule.name || "").slice(0, 120),
    channel: String(rule.channel || "").slice(0, 100),
    capacity,
    typicalCapacity,
    capacityPeriod: String(rule.capacityPeriod || "week"),
    allowedWeekdays: (rule.allowedWeekdays || []).slice(0, 7).map(Number),
    perCampaignMaximum: Number(rule.perCampaignMaximum || 1),
    eligibleLevels: (rule.eligibleLevels || []).slice(0, 5).map(Number),
    autoResolve: rule.autoResolve === true,
    supportsSmuggle: rule.supportsSmuggle === true,
    allocationStrategy: String(rule.allocationStrategy || "creative-decision").slice(0, 80),
    showOnDashboard: rule.showOnDashboard !== false,
    active: rule.active !== false,
    updatedByUid: ownerUid,
    createdAt: rule.createdAt ? instantTimestamp(rule.createdAt) : timestamp,
    updatedAt: timestamp,
  };
}

function standingLaneForCloud(lane, ownerUid, timestamp) {
  return {
    schemaVersion: 1,
    name: String(lane.name || "").slice(0, 120),
    level: Number(lane.level || 2),
    cadence: String(lane.cadence || "weekly"),
    fallbackPlaybookId: String(lane.fallbackPlaybookId || "").slice(0, 100),
    priorityOrder: (lane.priorityOrder || []).slice(0, 5).map(String),
    eligibleSmuggleLevels: (lane.eligibleSmuggleLevels || []).slice(0, 5).map(Number),
    active: lane.active !== false,
    updatedByUid: ownerUid,
    createdAt: lane.createdAt ? instantTimestamp(lane.createdAt) : timestamp,
    updatedAt: timestamp,
  };
}

async function commitPlannerSetOperations(
  firestore,
  operations,
  batchSize = PLANNER_RULES_SAFE_BATCH_SIZE,
) {
  for (let index = 0; index < operations.length; index += batchSize) {
    const batch = firestore.batch();
    operations.slice(index, index + batchSize).forEach((operation) => {
      batch.set(operation.reference, operation.payload);
    });
    await batch.commit();
  }
}

function createPreviewWorkspace() {
  const starter = cloneStarterData();
  const today = dateKey(new Date());
  const weekStart = startOfSundayWeek(today);
  const campaignDefinitions = [
    {
      id: "preview-level-2",
      name: "Starting Pointe",
      eventDate: addDays(weekStart, 27),
      registrationDeadline: addDays(weekStart, 24),
      submittedAt: new Date(Date.now() - 21 * 86400000).toISOString(),
      level: 2,
      campaignType: "event-based",
      playbookId: "level-2-event",
      sourceEventId: "",
      notes: "Preview campaign for the Level 2 standing lane.",
      status: "active",
    },
    {
      id: "preview-level-4",
      name: "Women's Breakfast",
      eventDate: addDays(weekStart, 12),
      registrationDeadline: addDays(weekStart, 10),
      submittedAt: new Date(Date.now() - 16 * 86400000).toISOString(),
      level: 4,
      campaignType: "featured",
      playbookId: "level-4-featured",
      sourceEventId: "",
      notes: "Broad-interest community event.",
      status: "active",
    },
    {
      id: "preview-level-5",
      name: "Sewing Group Workshop",
      eventDate: addDays(weekStart, 18),
      registrationDeadline: "",
      submittedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      level: 5,
      campaignType: "interest",
      playbookId: "level-5-interest",
      sourceEventId: "",
      notes: "Eligible for a Smuggle opportunity.",
      status: "active",
    },
  ];
  let campaigns = [];
  let plays = [];
  campaignDefinitions.forEach((definition) => {
    const playbook = starter.playbooks.find((item) => item.id === definition.playbookId);
    const generated = generateCampaignSchedule({campaign: definition, playbook, generatedAt: new Date()});
    campaigns.push(generated.campaign);
    plays.push(...generated.plays);
  });
  const level4 = allocateLevel4SocialSlots({plays, campaigns});
  const capacity = evaluateCapacity({
    plays: level4.plays,
    capacityRules: starter.capacityRules.filter((rule) => rule.id !== "level-4-social"),
    campaigns,
  });
  const lane = ensureLevel2StandingLane({
    weekStart,
    plays: capacity.plays,
    ongoingPlaybook: starter.playbooks.find((item) => item.id === "level-2-ongoing-awareness"),
  });
  plays = lane.source === "ongoing"
    ? [...capacity.plays, ...lane.plays]
    : capacity.plays;
  return {
    ...starter,
    campaigns,
    scheduledPlays: plays,
    isSeeded: true,
    preview: true,
  };
}

export function createPlannerStore({firestore = null, user = null, preview = false}) {
  let previewWorkspace = preview ? createPreviewWorkspace() : null;

  async function loadWorkspace() {
    if (preview) return deepClone(previewWorkspace);
    if (!firestore || !user) throw new Error("Planner is not connected to Firebase.");
    const now = new Date();
    const rangeStart = addDays(dateKey(now), -70);
    const rangeEnd = addDays(dateKey(now), 400);
    const [playbookSnapshot, versionSnapshot, campaignSnapshot, playSnapshot, ruleSnapshot, laneSnapshot] =
      await Promise.all([
        firestore.collection(PLANNER_COLLECTIONS.playbooks).get(),
        firestore.collection(PLANNER_COLLECTIONS.versions).get(),
        firestore.collection(PLANNER_COLLECTIONS.campaigns).get(),
        firestore.collection(PLANNER_COLLECTIONS.plays)
          .where("scheduledDate", ">=", dateTimestamp(rangeStart))
          .where("scheduledDate", "<=", dateTimestamp(rangeEnd))
          .orderBy("scheduledDate", "asc")
          .get(),
        firestore.collection(PLANNER_COLLECTIONS.capacityRules).get(),
        firestore.collection(PLANNER_COLLECTIONS.standingLanes).get(),
      ]);
    const metadata = playbookSnapshot.docs.map((doc) => normalizePlannerDocument(documentData(doc)));
    const versions = versionSnapshot.docs.map((doc) => normalizePlaybookVersion(documentData(doc)));
    const playbooks = metadata.map((meta) => {
      const version = versions.find((item) =>
        item.playbookId === meta.id && Number(item.version) === Number(meta.currentVersion),
      );
      return version ? {...version, ...meta, version: Number(meta.currentVersion)} : meta;
    });
    const starter = cloneStarterData();
    return {
      playbooks: playbooks.length ? playbooks : starter.playbooks,
      capacityRules: ruleSnapshot.empty
        ? starter.capacityRules
        : ruleSnapshot.docs.map((doc) => normalizePlannerDocument(documentData(doc))),
      standingLanes: laneSnapshot.empty
        ? starter.standingLanes
        : laneSnapshot.docs.map((doc) => normalizePlannerDocument(documentData(doc))),
      campaigns: campaignSnapshot.docs.map((doc) => normalizeCampaign(documentData(doc))),
      scheduledPlays: playSnapshot.docs.map((doc) => normalizePlay(documentData(doc))),
      isSeeded: !playbookSnapshot.empty && !ruleSnapshot.empty && !laneSnapshot.empty,
      preview: false,
    };
  }

  async function publishStarterConfiguration() {
    if (preview) {
      previewWorkspace.isSeeded = true;
      return deepClone(previewWorkspace);
    }
    const starter = cloneStarterData();
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    const operations = [];
    starter.playbooks.forEach((playbook) => {
      operations.push({
        reference: firestore.collection(PLANNER_COLLECTIONS.playbooks).doc(playbook.id),
        payload: playbookMetaForCloud(playbook, user.uid, timestamp),
      });
      operations.push({
        reference: firestore.collection(PLANNER_COLLECTIONS.versions)
          .doc(`${playbook.id}_v${playbook.version}`),
        payload: playbookVersionForCloud(playbook, user.uid, timestamp),
      });
    });
    starter.capacityRules.forEach((rule) => {
      operations.push({
        reference: firestore.collection(PLANNER_COLLECTIONS.capacityRules).doc(rule.id),
        payload: capacityRuleForCloud(rule, user.uid, timestamp),
      });
    });
    starter.standingLanes.forEach((lane) => {
      operations.push({
        reference: firestore.collection(PLANNER_COLLECTIONS.standingLanes).doc(lane.id),
        payload: standingLaneForCloud(lane, user.uid, timestamp),
      });
    });
    const snapshots = await Promise.all(
      operations.map((operation) => operation.reference.get()),
    );
    const missingOperations = operations.filter(
      (_operation, index) => !snapshots[index].exists,
    );
    await commitPlannerSetOperations(firestore, missingOperations);
    return loadWorkspace();
  }

  async function savePlaybook(playbook) {
    const next = {...deepClone(playbook), version: Number(playbook.version || 0) + 1};
    if (preview) {
      const index = previewWorkspace.playbooks.findIndex((item) => item.id === next.id);
      if (index === -1) previewWorkspace.playbooks.push(next);
      else previewWorkspace.playbooks[index] = next;
      return deepClone(next);
    }
    const batch = firestore.batch();
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    const metaPayload = playbookMetaForCloud(next, user.uid, timestamp);
    if (playbook.createdAt) delete metaPayload.createdAt;
    batch.set(
      firestore.collection(PLANNER_COLLECTIONS.playbooks).doc(next.id),
      metaPayload,
      {merge: true},
    );
    batch.set(
      firestore.collection(PLANNER_COLLECTIONS.versions).doc(`${next.id}_v${next.version}`),
      playbookVersionForCloud(next, user.uid, timestamp),
    );
    await batch.commit();
    return next;
  }

  async function deletePlaybook(playbookId) {
    const id = String(playbookId || "").trim();
    if (!id) throw new Error("A playbook ID is required for deletion.");
    if (isStarterPlaybookId(id)) {
      throw new Error("Built-in playbooks are protected and cannot be deleted.");
    }
    if (preview) {
      const campaignUsesPlaybook = previewWorkspace.campaigns.some((item) => item.playbookId === id);
      const laneUsesPlaybook = previewWorkspace.standingLanes.some((item) => item.fallbackPlaybookId === id);
      if (campaignUsesPlaybook || laneUsesPlaybook) {
        throw new Error("This playbook is still used by a campaign or standing lane and cannot be deleted.");
      }
      previewWorkspace.playbooks = previewWorkspace.playbooks.filter((item) => item.id !== id);
      return {playbookId: id};
    }
    const [campaignSnapshot, laneSnapshot] = await Promise.all([
      firestore.collection(PLANNER_COLLECTIONS.campaigns).where("playbookId", "==", id).limit(1).get(),
      firestore.collection(PLANNER_COLLECTIONS.standingLanes).where("fallbackPlaybookId", "==", id).limit(1).get(),
    ]);
    if (!campaignSnapshot.empty || !laneSnapshot.empty) {
      throw new Error("This playbook is still used by a campaign or standing lane and cannot be deleted.");
    }
    await firestore.collection(PLANNER_COLLECTIONS.playbooks).doc(id).delete();
    return {playbookId: id};
  }

  async function saveCapacityRule(rule) {
    const next = {...deepClone(rule), id: rule.id || createId("rule")};
    if (preview) {
      const index = previewWorkspace.capacityRules.findIndex((item) => item.id === next.id);
      if (index === -1) previewWorkspace.capacityRules.push(next);
      else previewWorkspace.capacityRules[index] = next;
      return deepClone(next);
    }
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    const payload = capacityRuleForCloud(next, user.uid, timestamp);
    if (rule.createdAt) delete payload.createdAt;
    await firestore.collection(PLANNER_COLLECTIONS.capacityRules).doc(next.id).set(
      payload,
      {merge: true},
    );
    return next;
  }

  async function saveStandingLane(lane) {
    const next = {...deepClone(lane), id: lane.id || createId("lane")};
    if (preview) {
      const index = previewWorkspace.standingLanes.findIndex((item) => item.id === next.id);
      if (index === -1) previewWorkspace.standingLanes.push(next);
      else previewWorkspace.standingLanes[index] = next;
      return deepClone(next);
    }
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    const payload = standingLaneForCloud(next, user.uid, timestamp);
    if (lane.createdAt) delete payload.createdAt;
    await firestore.collection(PLANNER_COLLECTIONS.standingLanes).doc(next.id).set(
      payload,
      {merge: true},
    );
    return next;
  }

  async function saveCampaignSchedule(campaign, plays) {
    const nextCampaign = {...deepClone(campaign), id: campaign.id || createId("campaign")};
    const nextPlays = plays.map((play) => ({
      ...deepClone(play),
      id: play.id || createId("play"),
      campaignId: nextCampaign.id,
    }));
    if (preview) {
      previewWorkspace.campaigns = [
        nextCampaign,
        ...previewWorkspace.campaigns.filter((item) => item.id !== nextCampaign.id),
      ];
      previewWorkspace.scheduledPlays = [
        ...previewWorkspace.scheduledPlays.filter((item) => item.campaignId !== nextCampaign.id),
        ...nextPlays,
      ];
      return {campaign: deepClone(nextCampaign), plays: deepClone(nextPlays)};
    }
    const batch = firestore.batch();
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    batch.set(
      firestore.collection(PLANNER_COLLECTIONS.campaigns).doc(nextCampaign.id),
      campaignForCloud(nextCampaign, user.uid, timestamp),
    );
    nextPlays.forEach((play) => {
      batch.set(
        firestore.collection(PLANNER_COLLECTIONS.plays).doc(play.id),
        playForCloud(play, user.uid, timestamp),
      );
    });
    await batch.commit();
    return {campaign: nextCampaign, plays: nextPlays};
  }

  async function saveScheduledPlay(play) {
    const next = {...deepClone(play), manuallyAdjusted: true};
    if (preview) {
      previewWorkspace.scheduledPlays = previewWorkspace.scheduledPlays.map((item) =>
        item.id === next.id ? next : item,
      );
      return deepClone(next);
    }
    const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
    const payload = playForCloud(next, user.uid, timestamp);
    delete payload.createdAt;
    delete payload.createdByUid;
    await firestore.collection(PLANNER_COLLECTIONS.plays).doc(next.id).set(
      payload,
      {merge: true},
    );
    return next;
  }

  async function deleteCampaign(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id) throw new Error("A campaign ID is required for deletion.");
    if (preview) {
      const deletedPlayIds = previewWorkspace.scheduledPlays
        .filter((item) => item.campaignId === id)
        .map((item) => item.id);
      previewWorkspace.campaigns = previewWorkspace.campaigns.filter((item) => item.id !== id);
      previewWorkspace.scheduledPlays = previewWorkspace.scheduledPlays.filter((item) => item.campaignId !== id);
      return {campaignId: id, deletedPlayIds};
    }
    const playSnapshot = await firestore.collection(PLANNER_COLLECTIONS.plays)
      .where("campaignId", "==", id)
      .get();
    if (playSnapshot.size > 499) {
      throw new Error("This campaign has too many scheduled plays for a safe browser deletion. Contact a Central administrator.");
    }
    const batch = firestore.batch();
    playSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(firestore.collection(PLANNER_COLLECTIONS.campaigns).doc(id));
    await batch.commit();
    return {campaignId: id, deletedPlayIds: playSnapshot.docs.map((doc) => doc.id)};
  }

  return {
    loadWorkspace,
    publishStarterConfiguration,
    savePlaybook,
    deletePlaybook,
    saveCapacityRule,
    saveStandingLane,
    saveCampaignSchedule,
    saveScheduledPlay,
    deleteCampaign,
  };
}

export const plannerPersistenceInternals = {
  campaignForCloud,
  playForCloud,
  playbookMetaForCloud,
  playbookVersionForCloud,
  capacityRuleForCloud,
  standingLaneForCloud,
  assertValidPlaybookDefinition,
  commitPlannerSetOperations,
  PLANNER_RULES_SAFE_BATCH_SIZE,
};
