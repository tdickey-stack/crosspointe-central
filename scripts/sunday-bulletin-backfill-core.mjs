import {dateKey, generateEventDayBulletin} from "../src/planner/domain.js";

const ACTOR = "planner-sunday-bulletin-backfill";

export function createBackfillCore({admin, versions, plays, clock = () => new Date()}) {
  const timestampDate = (value) => value?.toDate ? dateKey(value.toDate()) : typeof value === "string" ? value.slice(0, 10) : "";
  const readCampaign = (snapshot) => {
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    return {...data, id: snapshot.id, eventDate: timestampDate(data.eventDate), registrationDeadline: timestampDate(data.registrationDeadline), campaignEndDate: timestampDate(data.campaignEndDate), submittedAt: data.submittedAt?.toDate?.().toISOString() || data.submittedAt};
  };
  const readPlays = (snapshot) => snapshot.docs.map((doc) => ({...doc.data(), id: doc.id, scheduledDate: timestampDate(doc.data().scheduledDate)}));
  function eligible(campaign, now) {
    if (!campaign || campaign.status !== "active" || campaign.scheduleMode === "promotion-window" || campaign.campaignType === "standalone-content" || !/^\d{4}-\d{2}-\d{2}$/.test(campaign.eventDate) || campaign.eventDate < dateKey(now)) return false;
    return new Date(`${campaign.eventDate}T12:00:00Z`).getUTCDay() === 0;
  }
  function hasExisting(campaign, existing) {
    return existing.some((play) => play.templatePlayId === "event-day-bulletin" ||
      (play.resourceId === "weekly-bulletin" && play.scheduledDate === campaign.eventDate));
  }
  function cloudPlay(play) {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const dateTimestamp = (value) => admin.firestore.Timestamp.fromDate(new Date(`${value}T12:00:00.000Z`));
    return {
      schemaVersion: 1, campaignId: play.campaignId, campaignName: play.campaignName,
      campaignLevel: Number(play.campaignLevel), campaignType: play.campaignType,
      playbookId: play.playbookId, playbookVersion: Number(play.playbookVersion),
      templatePlayId: play.templatePlayId, weekNumber: Number(play.weekNumber), phase: play.phase,
      playType: play.playType, channel: play.channel, resourceId: play.resourceId,
      originalScheduledDate: dateTimestamp(play.originalScheduledDate), scheduledDate: dateTimestamp(play.scheduledDate),
      eligibleWeekdays: play.eligibleWeekdays, status: play.status, requirement: play.requirement,
      lateBehavior: play.lateBehavior, source: play.source, manuallyAdjusted: play.manuallyAdjusted === true,
      locked: play.locked === true, conflictState: play.conflictState || "none",
      conflictReason: play.conflictReason || "", lateReason: play.lateReason || "",
      supportsSmuggle: play.supportsSmuggle === true, smuggle: null,
      createdByUid: ACTOR, updatedByUid: ACTOR, createdAt: timestamp, updatedAt: timestamp,
    };
  }
  async function inspect(reference, writer = null) {
    const read = writer ? (ref) => writer.get(ref) : (ref) => ref.get();
    const campaign = readCampaign(await read(reference));
    const now = clock();
    if (!eligible(campaign, now)) return {campaign, action: "skip"};
    const versionRef = versions.doc(`${campaign.playbookId}_v${campaign.playbookVersion}`);
    const [version, existing] = await Promise.all([
      read(versionRef), read(plays.where("campaignId", "==", reference.id)),
    ]);
    if (!version.exists || hasExisting(campaign, readPlays(existing))) return {campaign, action: "skip"};
    const playbook = {...version.data(), id: campaign.playbookId, version: Number(campaign.playbookVersion)};
    const play = generateEventDayBulletin({campaign, playbook, generatedAt: now});
    if (!play) return {campaign, action: "skip"};
    const playRef = plays.doc(play.id);
    const collision = await read(playRef);
    if (collision.exists) return {campaign, action: "skip"};
    if (writer) writer.create(playRef, cloudPlay(play));
    return {campaign, action: writer ? "added" : "add"};
  }

  return {inspect, eligible};
}
