import {createRequire} from "node:module";

// Production is read only; all database writes are restricted to loopback.
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulatorHost)) {
  throw new Error("Print Mode seeding requires a local Firestore emulator.");
}
process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
const projectId = "crosspointe-central";
const source = "https://crosspointe-central.web.app/api/central-data";
const response = await fetch(source, {signal: AbortSignal.timeout(60000)});
if (!response.ok) throw new Error(`Live content request failed: ${response.status}`);
const payload = await response.json();
const sections = ["campaigns", "serveNeeds"];
for (const section of sections) {
  if (!Array.isArray(payload[section]) || payload[section].some((item) =>
    !item || typeof item.id !== "string" || !item.id || item.id.includes("/"))) {
    throw new Error(`Invalid live ${section} payload; nothing was written.`);
  }
}

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = require("firebase-admin");
const app = admin.initializeApp({projectId});
try {
  const db = admin.firestore(app);
  const batch = db.batch();
  for (const section of sections) {
    for (const item of payload[section]) {
      const {id, source: ignoredSource, ...data} = item;
      data.active = data.active === true || data.active === "TRUE";
      if ("ongoing" in data) data.ongoing = data.ongoing === true || data.ongoing === "TRUE";
      batch.set(db.doc(`centralContent/${section}/items/${id}`), data, {merge: true});
    }
    batch.set(db.doc(`centralContent/${section}/meta/state`), {
      initialized: true,
      overrideActive: true,
    }, {merge: true});
  }
  await batch.commit();
  for (const section of sections) {
    console.log(`Copied ${payload[section].length} live ${section} to ${emulatorHost}.`);
  }
  console.log("Existing local-only entries were preserved. Live content was not changed.");
} finally {
  await app.delete();
}
