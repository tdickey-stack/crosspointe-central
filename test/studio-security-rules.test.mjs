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
import "firebase/compat/storage";
import test from "node:test";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const projectId = "crosspointe-central-studio-rules";
let environment;

function policyContent() {
  return {
    eyebrow: "CROSSPOINTE CREATIVE",
    audience: "MINISTRY LEADERS",
    documentNumber: "SOP 01",
    title: "A Safe Studio Project",
    subtitle: "A concise purpose statement.",
    operatingRuleLabel: "OPERATING RULE",
    operatingRule: "Start with the audience and objective.",
    primarySectionLabel: "STANDARD WORKFLOW",
    primarySectionTitle: "Normally Included",
    primaryItemsText: "First step\nSecond step",
    secondarySectionLabel: "STRATEGIC OPTIONS",
    secondarySectionTitle: "When Useful",
    secondaryItemsText: "One option\nAnother option",
    ownerLabel: "MINISTRY LEADER OWNS",
    ownerTitle: "Your Part",
    ownerItemsText: "One responsibility\nAnother responsibility",
    processLabel: "PLAN WITH PURPOSE",
    processStepsText: "PLAN\nCREATE\nREVIEW",
    footerNote: "Support depends on timing and capacity.",
    footerReference: "CROSSPOINTE CREATIVE",
    accent: "red",
  };
}

function projectPayload(ownerUid = "owner") {
  return {
    schemaVersion: 1,
    ownerUid,
    templateId: "policy-document",
    name: "Policy Project",
    status: "draft",
    sourceType: "manual",
    content: policyContent(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function eventProjectPayload(ownerUid = "owner") {
  return {
    schemaVersion: 1,
    ownerUid,
    templateId: "event-promotion",
    name: "Event Project",
    status: "draft",
    sourceType: "manual",
    content: {
      eyebrow: "A PLACE TO CONNECT",
      title: "Community Night",
      subtitle: "Come as you are.",
      date: "SEPTEMBER 18",
      time: "6:30 PM",
      location: "CROSSPOINTE",
      cta: "DETAILS AT CENTRAL.CROSSPOINTE.TV",
      format: "square",
      composition: "editorial",
      palette: "charcoal-red",
      flatColor: "charcoal",
      overlayColor: "red",
      overlayBlendMode: "multiply",
      imagePosition: "center",
      focalX: 50,
      focalY: 50,
      imageZoom: 1,
      backgroundImageSource: "",
      backgroundImageUrl: "",
      backgroundImageStoragePath: "",
      unsplashPhotoId: "",
      unsplashPhotographerName: "",
      unsplashPhotographerUrl: "",
      unsplashPhotoUrl: "",
      fontKey: "montserrat",
      textAlignment: "left",
      textShadow: false,
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

async function seedUser(uid, permission = "edit") {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc(`centralAdmin/root/users/${uid}`)
      .set({active: true, pageAccess: {studio: permission}});
  });
}

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(projectRoot, "firestore.rules"), "utf8"),
    },
    storage: {
      rules: fs.readFileSync(path.join(projectRoot, "storage.rules"), "utf8"),
    },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await Promise.all([
    seedUser("owner"),
    seedUser("member"),
    seedUser("other"),
    seedUser("viewer", "view"),
  ]);
});

test.after(async () => {
  await environment.cleanup();
});

test("owner can create, read, update, and delete a strictly valid project", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const reference = db.doc("centralStudioProjects/project-a");
  await assertSucceeds(reference.set(projectPayload()));
  await assertSucceeds(reference.get());
  await assertSucceeds(
    reference.update({
      name: "Updated Policy",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(reference.delete());
});

test("event projects accept valid sources and reject cross-project upload paths", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const reference = db.doc("centralStudioProjects/event-a");
  await assertSucceeds(reference.set(eventProjectPayload()));
  const rallyPayload = eventProjectPayload();
  rallyPayload.templateId = "event-rally-poster";
  rallyPayload.content.fontKey = "bebas-neue";
  rallyPayload.content.composition = "rally-stripes";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-rally").set(rallyPayload),
  );
  const futurePayload = eventProjectPayload();
  futurePayload.templateId = "event-future-block";
  futurePayload.content.fontKey = "unbounded";
  futurePayload.content.composition = "future-grid";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-future").set(futurePayload),
  );
  const editorialPayload = eventProjectPayload();
  editorialPayload.templateId = "event-editorial-invitation";
  editorialPayload.content.fontKey = "bodoni-moda";
  editorialPayload.content.composition = "editorial-frame";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-editorial").set(editorialPayload),
  );
  const editorialFlowPayload = eventProjectPayload();
  editorialFlowPayload.templateId = "event-editorial-invitation";
  editorialFlowPayload.content.fontKey = "forum";
  editorialFlowPayload.content.composition = "editorial-flow";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-editorial-flow").set(
      editorialFlowPayload,
    ),
  );
  const welcomePayload = eventProjectPayload();
  welcomePayload.templateId = "event-scripted-welcome";
  welcomePayload.content.fontKey = "niconne";
  welcomePayload.content.composition = "welcome-halo";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-welcome").set(welcomePayload),
  );
  const welcomeRibbonsPayload = eventProjectPayload();
  welcomeRibbonsPayload.templateId = "event-scripted-welcome";
  welcomeRibbonsPayload.content.fontKey = "forum";
  welcomeRibbonsPayload.content.composition = "welcome-ribbons";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-welcome-ribbons").set(
      welcomeRibbonsPayload,
    ),
  );
  const removedOrbitPayload = eventProjectPayload();
  removedOrbitPayload.templateId = "event-scripted-welcome";
  removedOrbitPayload.content.fontKey = "niconne";
  removedOrbitPayload.content.composition = "editorial";
  await assertFails(
    db.doc("centralStudioProjects/event-removed-orbit").set(
      removedOrbitPayload,
    ),
  );
  const mismatchedPayload = eventProjectPayload();
  mismatchedPayload.templateId = "event-rally-poster";
  mismatchedPayload.content.fontKey = "bebas-neue";
  mismatchedPayload.content.composition = "future-grid";
  await assertFails(
    db.doc("centralStudioProjects/event-mismatched").set(mismatchedPayload),
  );
  await assertSucceeds(
    reference.update({
      "content.backgroundImageSource": "upload",
      "content.backgroundImageStoragePath":
        "studio-projects/event-a/background.png",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.backgroundImageStoragePath":
        "studio-projects/someone-elses-project/background.png",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.focalX": 101,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.focalY": -1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.imageZoom": 2.01,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.overlayBlendMode": "color-burn",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.fontKey": "comic-sans",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("project creation rejects impersonation, unknown fields, and view-only users", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  const viewerDb = environment.authenticatedContext("viewer").firestore();
  await assertFails(
    ownerDb.doc("centralStudioProjects/wrong-owner").set(
      projectPayload("other"),
    ),
  );
  await assertFails(
    ownerDb.doc("centralStudioProjects/extra-field").set({
      ...projectPayload(),
      collaboratorUids: ["other"],
    }),
  );
  await assertFails(
    viewerDb.doc("centralStudioProjects/viewer-project").set(
      projectPayload("viewer"),
    ),
  );
});

test("updates cannot hijack ownership or bypass field limits", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  const reference = ownerDb.doc("centralStudioProjects/project-a");
  await assertSucceeds(reference.set(projectPayload()));
  await assertFails(
    reference.update({
      ownerUid: "other",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.operatingRule": "x".repeat(321),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.unexpected": "not allowed",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("a server-issued member can read and edit but cannot delete", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(
    ownerDb.doc("centralStudioProjects/project-a").set(projectPayload()),
  );
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc("centralStudioMemberships/member_project-a")
      .set({
        projectId: "project-a",
        ownerUid: "owner",
        memberUid: "member",
        permission: "edit",
        createdAt: firebase.firestore.Timestamp.now(),
      });
  });
  const memberDb = environment.authenticatedContext("member").firestore();
  const reference = memberDb.doc("centralStudioProjects/project-a");
  await assertSucceeds(reference.get());
  await assertSucceeds(
    reference.update({
      name: "Collaborative Edit",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(reference.delete());
  await assertFails(
    memberDb.doc("centralStudioMemberships/member_project-a").delete(),
  );
});

test("unrelated and unauthenticated users cannot read projects", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(
    ownerDb.doc("centralStudioProjects/project-a").set(projectPayload()),
  );
  await assertFails(
    environment
      .authenticatedContext("other")
      .firestore()
      .doc("centralStudioProjects/project-a")
      .get(),
  );
  await assertFails(
    environment
      .unauthenticatedContext()
      .firestore()
      .doc("centralStudioProjects/project-a")
      .get(),
  );
});

test("owner project query is constrained to the signed-in UID", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(
    ownerDb.doc("centralStudioProjects/project-a").set(projectPayload()),
  );
  await assertSucceeds(
    ownerDb
      .collection("centralStudioProjects")
      .where("ownerUid", "==", "owner")
      .get(),
  );
  await assertFails(
    ownerDb
      .collection("centralStudioProjects")
      .where("ownerUid", "==", "other")
      .get(),
  );
});

test("membership queries return only the signed-in member's records", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc("centralStudioMemberships/member_project-a")
      .set({
        projectId: "project-a",
        ownerUid: "owner",
        memberUid: "member",
        permission: "edit",
        createdAt: firebase.firestore.Timestamp.now(),
      });
  });
  const memberDb = environment.authenticatedContext("member").firestore();
  await assertSucceeds(
    memberDb
      .collection("centralStudioMemberships")
      .where("memberUid", "==", "member")
      .get(),
  );
  await assertFails(
    memberDb
      .collection("centralStudioMemberships")
      .where("memberUid", "==", "other")
      .get(),
  );
});

test("Storage accepts only authorized project images under 8 MiB", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc("centralStudioProjects/project-a")
      .set({
        ...projectPayload(),
        createdAt: firebase.firestore.Timestamp.now(),
        updatedAt: firebase.firestore.Timestamp.now(),
      });
  });
  const ownerStorage = environment.authenticatedContext("owner").storage();
  const otherStorage = environment.authenticatedContext("other").storage();
  await assertSucceeds(
    ownerStorage
      .ref("studio-projects/project-a/background.png")
      .put(new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
      }),
  );
  await assertFails(
    ownerStorage
      .ref("studio-projects/project-a/not-image.txt")
      .putString("not an image", "raw", {contentType: "text/plain"}),
  );
  await assertFails(
    otherStorage
      .ref("studio-projects/project-a/background.png")
      .put(new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
      }),
  );
});
