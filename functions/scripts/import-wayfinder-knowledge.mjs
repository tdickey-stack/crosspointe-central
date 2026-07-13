import admin from "firebase-admin";

import {flattenWayfinderBundles} from "../wayfinder/knowledge.js";
import {loadWayfinderBundles} from "./wayfinder-bundles.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowProduction = args.has("--allow-production");
const emulatorHostArgument = process.argv.slice(2).find((argument) => {
  return argument.startsWith("--emulator-host=");
});

if (emulatorHostArgument) {
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHostArgument.split("=")[1];
}

try {
  const bundles = await loadWayfinderBundles();
  const result = flattenWayfinderBundles(bundles);

  if (result.errors.length) {
    throw new Error(
        "Wayfinder validation failed:\n" +
        result.errors.map((error) => "- " + error).join("\n"),
    );
  }

  console.log("Validated " + result.entries.length +
    " knowledge entries and " + result.policies.length +
    " policy document(s).");

  if (dryRun) {
    console.log("Dry run complete. No Firestore writes were made.");
    process.exit(0);
  }

  const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || "");
  if (!emulatorHost && !allowProduction) {
    throw new Error(
        "Production import is locked. Use --emulator-host=127.0.0.1:8080 " +
        "for local testing. Production requires --allow-production.",
    );
  }

  const projectIdArgument = process.argv.slice(2).find((argument) => {
    return argument.startsWith("--project=");
  });
  const projectId = projectIdArgument ? projectIdArgument.split("=")[1] :
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    "crosspointe-central";

  admin.initializeApp({projectId: projectId});
  const firestore = admin.firestore();
  const writes = [
    ...result.policies,
    ...result.entries,
  ];

  const expectedIdsByCollection = new Map();
  writes.forEach((write) => {
    if (!expectedIdsByCollection.has(write.collection)) {
      expectedIdsByCollection.set(write.collection, new Set());
    }
    expectedIdsByCollection.get(write.collection).add(write.id);
  });

  const staleReferences = [];
  for (const [collection, expectedIds] of expectedIdsByCollection) {
    const snapshot = await firestore.collection(collection).get();
    snapshot.docs.forEach((document) => {
      const data = document.data() || {};
      const managedByImporter = Boolean(data.sourceBundleId) ||
        data.documentType === "assistant_policy";
      if (managedByImporter && !expectedIds.has(document.id)) {
        staleReferences.push(document.ref);
      }
    });
  }

  for (let offset = 0; offset < staleReferences.length; offset += 400) {
    const batch = firestore.batch();
    staleReferences.slice(offset, offset + 400).forEach((reference) => {
      batch.delete(reference);
    });
    await batch.commit();
  }

  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = firestore.batch();
    writes.slice(offset, offset + 400).forEach((write) => {
      const reference = firestore.collection(write.collection).doc(write.id);
      batch.set(reference, {
        ...write.data,
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  console.log("Imported " + writes.length + " draft document(s) into " +
    (emulatorHost ? "the Firestore emulator." : "production Firestore."));
  if (staleReferences.length) {
    console.log("Removed " + staleReferences.length +
      " stale imported document(s).");
  }
} catch (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}
