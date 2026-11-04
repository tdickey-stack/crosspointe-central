#!/usr/bin/env node
// Default is read-only. Apply mode creates only a missing event-day bulletin;
// every candidate is rechecked inside its own Firestore transaction.
import {createRequire} from "node:module";

const PROJECT_ID = "crosspointe-central";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/backfill-sunday-bulletins.mjs [--campaign=<id>] [--apply]\nDefault: dry-run against crosspointe-central. --apply creates missing event-day bulletins.");
  process.exit(0);
}
const unknown = args.filter((arg) => arg !== "--apply" && !arg.startsWith("--campaign="));
const campaignArgs = args.filter((arg) => arg.startsWith("--campaign="));
if (unknown.length || campaignArgs.length > 1 || (campaignArgs.length && !/^--campaign=[A-Za-z0-9_-]{1,128}$/.test(campaignArgs[0]))) {
  console.error("Invalid arguments. Use --help for usage.");
  process.exit(1);
}
const apply = args.includes("--apply");
const campaignId = campaignArgs[0]?.slice("--campaign=".length) || "";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const {Firestore} = require("../functions/node_modules/@google-cloud/firestore");
const {GoogleAuth, OAuth2Client} = require("../functions/node_modules/google-auth-library");
const {createBackfillCore} = await import("./sunday-bulletin-backfill-core.mjs");

// Firebase CLI login is supported alongside application-default credentials.
// No credentials or raw Firestore documents are written to the output.
function firebaseCliAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined;
  const auth = require("firebase-tools/lib/auth");
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) return undefined;
  const client = new OAuth2Client();
  client.getRequestHeaders = async () => {
    const token = await auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
    return {Authorization: `Bearer ${token.access_token}`};
  };
  return new GoogleAuth({authClient: client, projectId: PROJECT_ID});
}
const db = new Firestore({projectId: PROJECT_ID, auth: firebaseCliAuth()});
const campaigns = db.collection("centralPromotionCampaigns");
const versions = db.collection("centralPromotionPlaybookVersions");
const plays = db.collection("centralPromotionScheduledPlays");
const {inspect, eligible} = createBackfillCore({admin, versions, plays});

try {
  const refs = campaignId ? [campaigns.doc(campaignId)] : (await campaigns.where("status", "==", "active").get()).docs.map((doc) => doc.ref);
  for (const ref of refs) {
    const result = apply ? await db.runTransaction((transaction) => inspect(ref, transaction)) : await inspect(ref);
    if (!campaignId && !eligible(result.campaign, new Date())) continue;
    const campaign = result.campaign;
    console.log(`${ref.id}\t${campaign?.name || "(not found)"}\t${campaign?.eventDate || "-"}\t${result.action}`);
  }
} catch (error) {
  console.error(`Backfill failed: ${String(error.code || error.message || "unknown error").slice(0, 200)}`);
  process.exitCode = 1;
} finally {
  await db.terminate();
}
