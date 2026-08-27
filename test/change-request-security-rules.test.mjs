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

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const projectId = "crosspointe-central-change-request-rules";
const changeRequestsPath = "centralAdmin/root/changeRequests";
const notificationEventsPath =
  "centralAdmin/root/changeRequestNotificationEvents";
const pumbleOAuthStatesPath = "centralAdmin/root/pumbleOAuthStates";
const pumbleBotCredentialsPath = "centralAdmin/root/pumbleBotCredentials";
const pumbleBotCredentialLocksPath =
  "centralAdmin/root/pumbleBotCredentialLocks";
let environment;

function timestamp(value) {
  return firebase.firestore.Timestamp.fromDate(new Date(value));
}

async function seedUser(uid, permission, active = true) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`centralAdmin/root/users/${uid}`).set({
      active,
      pageAccess: {changeRequests: permission},
    });
  });
}

async function seedWorkflowDocuments() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`${changeRequestsPath}/request-a`).set({
      status: "pending",
      summary: "Homepage: heading update",
      submittedByEmail: "contributor@crosspointe.tv",
      createdAt: timestamp("2026-08-27T12:00:00.000Z"),
      nextReminderAt: timestamp("2026-08-29T12:00:00.000Z"),
    });
    await db.doc(`${notificationEventsPath}/event-a`).set({
      status: "pending",
      dueAt: timestamp("2026-08-27T12:00:00.000Z"),
      requestId: "request-a",
    });
    await db
        .doc(`${notificationEventsPath}/event-a/deliveries/delivery-a`)
        .set({channel: "email", status: "pending"});
  });
}

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(projectRoot, "firestore.rules"), "utf8"),
    },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await Promise.all([
    seedUser("none", "none"),
    seedUser("viewer", "view"),
    seedUser("approver", "approve"),
    seedUser("admin", "admin"),
    seedUser("inactive-admin", "admin", false),
  ]);
  await seedWorkflowDocuments();
});

test.after(async () => environment.cleanup());

test("signed-out, inactive, and no-access users cannot read Change Requests",
    async () => {
      const anonymousDb = environment.unauthenticatedContext().firestore();
      const inactiveDb = environment
          .authenticatedContext("inactive-admin")
          .firestore();
      const noAccessDb = environment.authenticatedContext("none").firestore();

      await assertFails(anonymousDb.doc(`${changeRequestsPath}/request-a`).get());
      await assertFails(
          anonymousDb.collection(changeRequestsPath)
              .where("status", "==", "pending")
              .get(),
      );
      await assertFails(inactiveDb.doc(`${changeRequestsPath}/request-a`).get());
      await assertFails(noAccessDb.doc(`${changeRequestsPath}/request-a`).get());
      await assertFails(
          noAccessDb.collection(changeRequestsPath)
              .where("status", "==", "pending")
              .get(),
      );
    });

test("active view, approve, and admin users can read Change Requests",
    async () => {
      for (const uid of ["viewer", "approver", "admin"]) {
        const db = environment.authenticatedContext(uid).firestore();
        await assertSucceeds(db.doc(`${changeRequestsPath}/request-a`).get());
        const snapshot = await assertSucceeds(
            db.collection(changeRequestsPath)
                .where("status", "==", "pending")
                .get(),
        );
        if (snapshot.size !== 1) {
          throw new Error(`${uid} should read the pending Change Request.`);
        }
      }
    });

test("all browser clients are denied Change Request writes", async () => {
  const contexts = [
    environment.unauthenticatedContext(),
    environment.authenticatedContext("viewer"),
    environment.authenticatedContext("approver"),
    environment.authenticatedContext("admin"),
  ];

  for (const context of contexts) {
    const db = context.firestore();
    await assertFails(db.doc(`${changeRequestsPath}/request-new`).set({
      status: "pending",
    }));
  }

  const adminReference = environment
      .authenticatedContext("admin")
      .firestore()
      .doc(`${changeRequestsPath}/request-a`);
  await assertFails(adminReference.update({status: "approved"}));
  await assertFails(adminReference.delete());
});

test("notification events and deliveries deny every browser operation",
    async () => {
      const anonymousDb = environment.unauthenticatedContext().firestore();
      const adminDb = environment.authenticatedContext("admin").firestore();
      const eventReference = adminDb.doc(`${notificationEventsPath}/event-a`);
      const deliveryReference = adminDb.doc(
          `${notificationEventsPath}/event-a/deliveries/delivery-a`,
      );

      await assertFails(
          anonymousDb.doc(`${notificationEventsPath}/event-a`).get(),
      );
      await assertFails(eventReference.get());
      await assertFails(adminDb.collection(notificationEventsPath).get());
      await assertFails(deliveryReference.get());
      await assertFails(
          eventReference.set({status: "pending", dueAt: timestamp(
            "2026-08-27T12:00:00.000Z",
          )}),
      );
      await assertFails(eventReference.update({status: "sending"}));
      await assertFails(eventReference.delete());
      await assertFails(
          deliveryReference.set({channel: "pumble", status: "pending"}),
      );
      await assertFails(deliveryReference.update({status: "sent"}));
      await assertFails(deliveryReference.delete());
    });

test("temporary Pumble OAuth state denies every browser operation", async () => {
  const anonymousDb = environment.unauthenticatedContext().firestore();
  const adminDb = environment.authenticatedContext("admin").firestore();
  const stateReference = adminDb.doc(`${pumbleOAuthStatesPath}/state-hash`);

  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`${pumbleOAuthStatesPath}/state-hash`).set({
      uid: "admin",
      expiresAt: timestamp("2026-08-27T12:10:00.000Z"),
    });
  });

  await assertFails(
      anonymousDb.doc(`${pumbleOAuthStatesPath}/state-hash`).get(),
  );
  await assertFails(stateReference.get());
  await assertFails(adminDb.collection(pumbleOAuthStatesPath).get());
  await assertFails(stateReference.set({uid: "admin"}));
  await assertFails(stateReference.update({uid: "approver"}));
  await assertFails(stateReference.delete());
});

test("rotating Pumble bot credentials deny every browser operation",
    async () => {
      const anonymousDb = environment.unauthenticatedContext().firestore();
      const adminDb = environment.authenticatedContext("admin").firestore();
      const credentialReference = adminDb.doc(
          `${pumbleBotCredentialsPath}/primary`,
      );

      await environment.withSecurityRulesDisabled(async (context) => {
        await context.firestore()
            .doc(`${pumbleBotCredentialsPath}/primary`)
            .set({
              token: "server-only-token",
              workspaceId: "workspace-1",
              botId: "bot-1",
              updatedAt: timestamp("2026-08-27T12:00:00.000Z"),
            });
      });

      await assertFails(
          anonymousDb.doc(`${pumbleBotCredentialsPath}/primary`).get(),
      );
      await assertFails(credentialReference.get());
      await assertFails(adminDb.collection(pumbleBotCredentialsPath).get());
      await assertFails(credentialReference.set({token: "attacker-token"}));
      await assertFails(credentialReference.update({token: "attacker-token"}));
      await assertFails(credentialReference.delete());
    });

test("Pumble bot credential leases deny every browser operation", async () => {
  const anonymousDb = environment.unauthenticatedContext().firestore();
  const adminDb = environment.authenticatedContext("admin").firestore();
  const lockReference = adminDb.doc(
      `${pumbleBotCredentialLocksPath}/primary`,
  );

  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore()
        .doc(`${pumbleBotCredentialLocksPath}/primary`)
        .set({
          leaseId: "server-only-lease",
          expiresAt: timestamp("2026-08-27T12:02:00.000Z"),
        });
  });

  await assertFails(
      anonymousDb.doc(`${pumbleBotCredentialLocksPath}/primary`).get(),
  );
  await assertFails(lockReference.get());
  await assertFails(adminDb.collection(pumbleBotCredentialLocksPath).get());
  await assertFails(lockReference.set({leaseId: "attacker-lease"}));
  await assertFails(lockReference.update({leaseId: "attacker-lease"}));
  await assertFails(lockReference.delete());
});
