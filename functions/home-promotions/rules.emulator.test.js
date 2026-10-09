/* eslint-disable require-jsdoc */

import test from "node:test";
import {assertFails, initializeTestEnvironment} from
  "@firebase/rules-unit-testing";
import {collection, doc, getDocs, setDoc} from "firebase/firestore";

const endpoint = process.env.FIRESTORE_EMULATOR_HOST || "";

test("promotion schedules stay private and browser writes stay denied", {
  skip: !endpoint,
}, async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(endpoint)) {
    throw new Error("Use a loopback emulator for this test.");
  }
  const [host, port] = endpoint.split(":");
  const projectId = "demo-central-home-promotions";
  const environment = await initializeTestEnvironment({
    projectId, firestore: {host, port: Number(port)},
  });
  const userId = "home-promotions-rules-test";
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(),
          "centralAdmin/root/users/" + userId), {
        active: true, pageAccess: {hub: "admin", settings: "admin"},
      });
    });
    for (const context of [environment.unauthenticatedContext(),
      environment.authenticatedContext(userId)]) {
      const db = context.firestore();
      await assertFails(getDocs(collection(db,
          "centralAdmin/root/homePromotions")));
      await assertFails(setDoc(doc(db,
          "centralAdmin/root/homePromotions/direct-write"), {
        sourceType: "campaigns", sourceId: "example", active: true,
      }));
    }
  } finally {
    await environment.cleanup();
  }
});
