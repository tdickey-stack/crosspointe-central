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

function documentProjectPayload(
  ownerUid = "owner",
  pageOrder = ["page-one"],
) {
  return {
    schemaVersion: 2,
    ownerUid,
    templateId: "document-project",
    name: "Ministry Playbook",
    status: "draft",
    sourceType: "manual",
    pageOrder,
    documentSettings: {showPageNumbers: true},
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function onePagerPagePayload() {
  return {
    schemaVersion: 1,
    templateId: "document-one-pager",
    content: policyContent(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function checklistPagePayload() {
  return {
    schemaVersion: 1,
    templateId: "document-checklist",
    content: {
      eyebrow: "CROSSPOINTE CREATIVE",
      audience: "MINISTRY LEADERS",
      documentNumber: "CHECKLIST 01",
      title: "Event Launch Checklist",
      subtitle: "Use this page to keep a repeatable process visible.",
      instructionsLabel: "HOW TO USE THIS",
      instructions: "Check each item after it is fully complete.",
      sectionOneTitle: "Before You Begin",
      sectionOneItemsText: "Confirm the audience\nName the objective",
      sectionTwoTitle: "Build and Review",
      sectionTwoItemsText: "Draft the message\nReview the details",
      sectionThreeTitle: "Publish and Follow Up",
      sectionThreeItemsText: "Publish approved assets\nArchive the final files",
      calloutLabel: "FINAL CHECK",
      calloutText: "Confirm the date, time, location, and next step.",
      footerNote: "Adjust this checklist to match the project.",
      footerReference: "CROSSPOINTE CREATIVE",
      accent: "red",
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function contentPagePayload() {
  return {
    schemaVersion: 1,
    templateId: "document-content-page",
    content: {
      eyebrow: "CROSSPOINTE CREATIVE",
      audience: "MINISTRY LEADERS",
      documentNumber: "GUIDE 02",
      title: "Supporting Details",
      subtitle: "A flexible branded page for explanation and callouts.",
      blocks: [
        {
          id: "block-one",
          type: "heading",
          text: "What this page supports",
        },
        {
          id: "block-two",
          type: "paragraph",
          text: "Use **bold** or *italic* emphasis without accepting HTML.",
        },
        {
          id: "block-three",
          type: "callout",
          text: "Keep the main decision easy to find.",
        },
      ],
      footerNote: "Supporting guidance for ministry teams.",
      footerReference: "CROSSPOINTE CREATIVE",
      accent: "red",
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

async function createDocumentProject(db, projectId = "document-a") {
  const batch = db.batch();
  batch.set(
    db.doc(`centralStudioProjects/${projectId}`),
    documentProjectPayload(),
  );
  batch.set(
    db.doc(`centralStudioProjects/${projectId}/pages/page-one`),
    onePagerPagePayload(),
  );
  return batch.commit();
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

test("owner can create and edit a multi-page document atomically", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(createDocumentProject(db));

  const root = db.doc("centralStudioProjects/document-a");
  const pageOne = db.doc("centralStudioProjects/document-a/pages/page-one");
  await assertSucceeds(root.get());
  await assertSucceeds(pageOne.get());

  const addPageBatch = db.batch();
  addPageBatch.update(root, {
    pageOrder: ["page-one", "checklist-one", "content-one"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  addPageBatch.set(
    db.doc("centralStudioProjects/document-a/pages/checklist-one"),
    checklistPagePayload(),
  );
  addPageBatch.set(
    db.doc("centralStudioProjects/document-a/pages/content-one"),
    contentPagePayload(),
  );
  await assertSucceeds(addPageBatch.commit());

  await assertSucceeds(
    db.doc("centralStudioProjects/document-a/pages/checklist-one").update({
      "content.calloutText": "Verify the owner and due date.",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    db.doc("centralStudioProjects/document-a/pages/checklist-one").update({
      "content.footerNote":
        "For questions or issues, contact Riley Baker at rbaker@crosspointe.tv. For emergencies, call (918) 497-9557. If Riley is unavailable during an emergency, call Tyler Dickey at (580) 579-3526.",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    db.doc("centralStudioProjects/document-a/pages/checklist-one").update({
      "content.footerNote": "x".repeat(501),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );

  const removePageBatch = db.batch();
  removePageBatch.update(root, {
    pageOrder: ["page-one", "content-one"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  removePageBatch.delete(
    db.doc("centralStudioProjects/document-a/pages/checklist-one"),
  );
  await assertSucceeds(removePageBatch.commit());
});

test("document pages reject orphan writes and malformed content", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  await assertFails(
    db
      .doc("centralStudioProjects/missing/pages/orphan")
      .set(onePagerPagePayload()),
  );

  await assertSucceeds(createDocumentProject(db));
  const unlistedPage = db.doc(
    "centralStudioProjects/document-a/pages/not-in-order",
  );
  await assertFails(unlistedPage.set(checklistPagePayload()));

  const invalidBlock = contentPagePayload();
  invalidBlock.content.blocks[0].html = "<script>alert(1)</script>";
  const invalidBatch = db.batch();
  invalidBatch.update(db.doc("centralStudioProjects/document-a"), {
    pageOrder: ["page-one", "unsafe-content"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  invalidBatch.set(
    db.doc("centralStudioProjects/document-a/pages/unsafe-content"),
    invalidBlock,
  );
  await assertFails(invalidBatch.commit());

  const tooManyPages = Array.from({length: 21}, (_, index) => `page-${index}`);
  await assertFails(
    db.doc("centralStudioProjects/document-a").update({
      pageOrder: tooManyPages,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    db.doc("centralStudioProjects/document-a").update({
      pageOrder: ["page-one", "page-one"],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("a legacy policy can migrate to a document project in one batch", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const root = db.doc("centralStudioProjects/legacy-policy");
  await assertSucceeds(root.set(projectPayload()));
  const existing = await root.get();

  const migration = db.batch();
  migration.set(root, {
    ...documentProjectPayload("owner", ["legacy-page"]),
    createdAt: existing.data().createdAt,
  });
  migration.set(
    db.doc("centralStudioProjects/legacy-policy/pages/legacy-page"),
    onePagerPagePayload(),
  );
  await assertSucceeds(migration.commit());
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
  const centerStagePayload = eventProjectPayload();
  centerStagePayload.templateId = "event-center-stage";
  centerStagePayload.content.fontKey = "league-spartan";
  centerStagePayload.content.composition = "center-burst";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-center-stage").set(centerStagePayload),
  );
  const timelessCenterPayload = eventProjectPayload();
  timelessCenterPayload.templateId = "event-timeless-center";
  timelessCenterPayload.content.fontKey = "bodoni-moda";
  timelessCenterPayload.content.composition = "serif-medallion";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-timeless-center").set(
      timelessCenterPayload,
    ),
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
  const mismatchedCenteredPayload = eventProjectPayload();
  mismatchedCenteredPayload.templateId = "event-timeless-center";
  mismatchedCenteredPayload.content.fontKey = "forum";
  mismatchedCenteredPayload.content.composition = "center-frame";
  await assertFails(
    db.doc("centralStudioProjects/event-mismatched-centered").set(
      mismatchedCenteredPayload,
    ),
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

test("a server-issued member can read and edit document pages but cannot orphan them", async () => {
  const ownerDb = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(createDocumentProject(ownerDb, "shared-document"));
  await environment.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .doc("centralStudioMemberships/member_shared-document")
      .set({
        projectId: "shared-document",
        ownerUid: "owner",
        memberUid: "member",
        permission: "edit",
        createdAt: firebase.firestore.Timestamp.now(),
      });
  });

  const memberDb = environment.authenticatedContext("member").firestore();
  const page = memberDb.doc(
    "centralStudioProjects/shared-document/pages/page-one",
  );
  await assertSucceeds(page.get());
  await assertSucceeds(
    page.update({
      "content.subtitle": "Edited by a shared Studio member.",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(page.delete());
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
