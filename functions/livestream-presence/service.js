/* eslint-disable require-jsdoc */
import {createHash} from "node:crypto";

export const PRESENCE_EXPIRY_MS = 60 * 1000;
export const PRESENCE_RETENTION_MS = 48 * 60 * 60 * 1000;
export const PRESENCE_COLLECTION = "centralLivestreamPresence";

// The key describes Central's configured player/day, not Resi broadcast status.
export function resolveStream({enabled, url, timezone}, environment, now) {
  let configured;
  try {
    configured = new URL(url);
  } catch (error) {
    return null;
  }
  if (!enabled || configured.protocol !== "https:" ||
      configured.hostname !== "control.resi.io" || configured.port ||
      configured.username || configured.password) return null;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(now));
  const streamKey = createHash("sha256")
      .update(JSON.stringify([environment, configured.href, day]))
      .digest("hex");
  return {streamKey, streamUrl: configured.href};
}

export function validHeartbeat(body) {
  return !!body && typeof body === "object" && !Array.isArray(body) &&
    Object.keys(body).length === 4 &&
    typeof body.sessionId === "string" &&
    /^[A-Za-z0-9_-]{22,80}$/.test(body.sessionId) &&
    typeof body.streamKey === "string" &&
    /^[a-f0-9]{64}$/.test(body.streamKey) &&
    typeof body.active === "boolean" &&
    Number.isSafeInteger(body.sequence) && body.sequence > 0;
}

export function nextSession(previous, heartbeat, now) {
  if (previous && previous.sequence >= heartbeat.sequence) return null;
  return {
    sequence: heartbeat.sequence,
    activeUntil: heartbeat.active ? now + PRESENCE_EXPIRY_MS : 0,
  };
}

export function createPresenceService({store, loadConfiguration,
  now = Date.now}) {
  const current = async (environment) => resolveStream(
      await loadConfiguration(environment), environment, now(),
  );
  return {
    async read(environment) {
      const stream = await current(environment);
      const checkedAt = now();
      if (!stream) return {available: false};
      const count = await store.count(stream.streamKey, checkedAt);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error("Invalid presence count.");
      }
      return {available: true, streamKey: stream.streamKey,
        streamUrl: stream.streamUrl, count,
        updatedAt: new Date(checkedAt).toISOString()};
    },
    async write(environment, heartbeat) {
      const stream = await current(environment);
      if (!stream || heartbeat.streamKey !== stream.streamKey) {
        return {available: false};
      }
      await store.write(stream.streamKey, heartbeat, now());
      return {available: true};
    },
  };
}

export function createFirestorePresenceStore(firestore) {
  const roots = firestore.collection(PRESENCE_COLLECTION);
  const initialized = new Map();
  const ensureRoot = async (streamKey, now) => {
    if (!initialized.has(streamKey)) {
      // Only a handful of current live/dev/day keys are needed per instance.
      if (initialized.size >= 32) initialized.clear();
      const promise = roots.doc(streamKey).create({
        retireAt: now + PRESENCE_RETENTION_MS,
      }).catch((error) => {
        if (error.code !== 6 && error.code !== "already-exists") {
          initialized.delete(streamKey);
          throw error;
        }
      });
      initialized.set(streamKey, promise);
    }
    await initialized.get(streamKey);
  };
  return {
    async count(streamKey, now) {
      // A single range field uses the default single-field index. At exactly
      // 60 seconds a session has expired; stopped sessions use activeUntil=0.
      const snapshot = await roots.doc(streamKey).collection("sessions")
          .where("activeUntil", ">", now).count().get();
      return snapshot.data().count;
    },
    async write(streamKey, heartbeat, now) {
      await ensureRoot(streamKey, now);
      const ref = roots.doc(streamKey).collection("sessions")
          .doc(heartbeat.sessionId);
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const next = nextSession(
            snapshot.exists ? snapshot.data() : null, heartbeat, now,
        );
        // Keep inactive sequence tombstones until this entire day is retired.
        // Deleting on pause would allow delayed older heartbeats to resurrect.
        if (next) transaction.set(ref, next);
      });
    },
  };
}

export async function cleanupPresence(firestore, now = Date.now()) {
  const roots = await firestore.collection(PRESENCE_COLLECTION)
      .where("retireAt", "<=", now).orderBy("retireAt").limit(20).get();
  let deletedSessions = 0;
  let deletedStreams = 0;
  for (const root of roots.docs) {
    // Bounded work per run. A partially drained root stays eligible next hour.
    for (let batchNumber = 0; batchNumber < 4; batchNumber++) {
      const sessions = await root.ref.collection("sessions").limit(250).get();
      if (sessions.empty) {
        await root.ref.delete();
        deletedStreams++;
        break;
      }
      const batch = firestore.batch();
      sessions.docs.forEach((session) => batch.delete(session.ref));
      await batch.commit();
      deletedSessions += sessions.size;
    }
  }
  return {deletedSessions, deletedStreams};
}
