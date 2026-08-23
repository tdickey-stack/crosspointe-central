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

import {projectForCloud} from "../src/studio/persistence.js";
import {createStudioProject} from "../src/studio/templates.js";

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
      optionalTextVisibility: "both",
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
      focalX: 50,
      focalY: 50,
      imageZoom: 1,
      backgroundImageOpacity: 1,
      backgroundImageRotation: 0,
      backgroundImageSource: "",
      backgroundImageUrl: "",
      backgroundImageStoragePath: "",
      unsplashPhotoId: "",
      unsplashPhotographerName: "",
      unsplashPhotographerUrl: "",
      unsplashPhotoUrl: "",
      heroMode: "text",
      heroLogoSource: "",
      heroLogoLibraryId: "",
      heroLogoStoragePath: "",
      heroLogoName: "",
      heroLogoScale: 1,
      heroLogoClearSpace: 4,
      fontKey: "montserrat",
      fontWeight: "template",
      brandMark: "central",
      brandColor: "auto",
      textAlignment: "left",
      textShadow: false,
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function socialProjectPayload(
  templateId = "social-scripture",
  ownerUid = "owner",
) {
  const payload = eventProjectPayload(ownerUid);
  const templateConfig = {
    "social-scripture": {composition: "serif-lines", fontKey: "eb-garamond"},
    "social-quote": {composition: "editorial-frame", fontKey: "bodoni-moda"},
    "social-statement": {composition: "center-frame", fontKey: "league-spartan"},
    "social-simple-statement": {composition: "flat", fontKey: "montserrat"},
    "social-pointe-glass": {composition: "pointe-glass", fontKey: "google-sans"},
  }[templateId];
  payload.schemaVersion = 3;
  delete payload.sourceId;
  delete payload.sourceEventId;
  delete payload.sourceUrl;
  delete payload.sourceUpdatedAt;
  payload.templateId = templateId;
  payload.name = "Social Post";
  payload.postMode = "single";
  payload.slideOrder = ["primary"];
  payload.content.eyebrow = "SCRIPTURE";
  payload.content.title = "Be still, and know that I am God.";
  payload.content.subtitle = "PSALM 46:10";
  payload.content.date = "";
  payload.content.time = "";
  payload.content.location = "";
  payload.content.cta = "";
  payload.content.composition = templateConfig.composition;
  payload.content.fontKey = templateConfig.fontKey;
  return payload;
}

function socialSlidePayload(content) {
  return {
    schemaVersion: 1,
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

async function createSocialProject(db, projectId, payload) {
  const reference = db.doc(`centralStudioProjects/${projectId}`);
  const {content, ...rootPayload} = payload;
  await assertSucceeds(reference.set(rootPayload));
  const primaryReference = reference.collection("slides").doc("primary");
  await assertSucceeds(primaryReference.set(socialSlidePayload(content)));
  return {reference, primaryReference};
}

function logoLibraryPayload(
  logoId = "logo-a",
  createdByUid = "studio-admin",
) {
  return {
    schemaVersion: 1,
    name: "Bids for Kids",
    storagePath: `studio-library/logos/${logoId}/source.png`,
    contentType: "image/png",
    status: "active",
    createdByUid,
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

function signupSheetPagePayload() {
  return {
    schemaVersion: 1,
    templateId: "document-signup-sheet",
    content: {
      eyebrow: "CROSSPOINTE CREATIVE | SIGN-UP SHEET",
      audience: "MINISTRY TEAMS",
      documentNumber: "SIGN-UP 01",
      title: "Serve Team Sign-Up",
      subtitle: "Add your name and contact information below.",
      instructionsLabel: "HOW TO USE THIS SHEET",
      instructions: "Please print clearly.",
      signupCount: 12,
      columnOneLabel: "NAME",
      columnTwoLabel: "EMAIL OR PHONE",
      columnThreeLabel: "NOTES",
      showNumbers: true,
      footerNote: "Return completed sheets to the ministry leader.",
      footerReference: "CROSSPOINTE CREATIVE",
      accent: "red",
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function directoryCardPayload(
  cardId = "manual-card",
  projectId = "document-a",
) {
  return {
    id: cardId,
    name: "Young Adults",
    subtitle: "Tuesdays at 7:00 PM",
    details: "Community for young adults.",
    imageUrl:
      "https://firebasestorage.googleapis.com/v0/b/example/o/group.jpg",
    imageStoragePath:
      `studio-projects/${projectId}/directory-group.jpg`,
    sourceType: "manual",
    sourceId: "",
    publicUrl: "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

function directoryPagePayload(cardOrder = []) {
  return {
    schemaVersion: 1,
    templateId: "document-directory",
    content: {
      eyebrow: "CROSSPOINTE CREATIVE | DIRECTORY",
      audience: "FIND YOUR PLACE",
      documentNumber: "DIR 01",
      title: "Pointe Groups Directory",
      subtitle: "Find a place to connect and grow.",
      cardOrder,
      footerNote: "Find current details at central.crosspointe.tv.",
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
    seedUser("studio-admin", "admin"),
    seedUser("approver", "approve"),
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

test("Central Embed documents remain API-only for every browser client", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("centralEmbeds/embed_abc123def456").set({
      schemaVersion: 1,
      name: "Private admin name",
      published: {items: []},
    });
  });

  const anonymous = environment.unauthenticatedContext().firestore();
  const adminUser = environment
      .authenticatedContext("studio-admin")
      .firestore();
  const anonymousReference = anonymous.doc(
      "centralEmbeds/embed_abc123def456",
  );
  const adminReference = adminUser.doc("centralEmbeds/embed_abc123def456");

  await assertFails(anonymousReference.get());
  await assertFails(anonymousReference.set({name: "Attack"}));
  await assertFails(adminReference.get());
  await assertFails(adminReference.update({name: "Bypass API"}));
  await assertFails(adminReference.delete());
});

test("Central Embed image storage remains API-only", async () => {
  const storage = environment
      .authenticatedContext("studio-admin")
      .storage();
  const reference = storage.ref(
      "central-embeds/embed_abc123def456/event-images/event-1.png",
  );
  await assertFails(reference.put(new Uint8Array([137, 80, 78, 71]), {
    contentType: "image/png",
  }));
  await assertFails(reference.getDownloadURL());
});

test("legacy browser assets are sanitized into a rules-valid cloud project", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const project = {
    ...createStudioProject("event-signal-stack"),
    id: "legacy-browser-project",
    name: "Legacy Browser Project",
  };
  project.content = {
    ...project.content,
    backgroundImage: "data:image/png;base64,legacy",
    backgroundImageSource: "upload",
    backgroundImageStoragePath: "",
    heroMode: "logo",
    heroLogo: "data:image/png;base64,legacy-logo",
    heroLogoSource: "upload",
    heroLogoStoragePath: "",
    heroLogoName: "Legacy logo",
  };
  const payload = projectForCloud(project, "owner");

  await assertSucceeds(
    db.doc("centralStudioProjects/legacy-browser-project").set({
      ...payload,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("project IDs reject characters that could alter storage path matching", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  await assertFails(
    db.doc("centralStudioProjects/project.*").set(projectPayload()),
  );
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
    pageOrder: [
      "page-one",
      "checklist-one",
      "signup-one",
      "directory-one",
      "content-one",
    ],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  addPageBatch.set(
    db.doc("centralStudioProjects/document-a/pages/checklist-one"),
    checklistPagePayload(),
  );
  addPageBatch.set(
    db.doc("centralStudioProjects/document-a/pages/signup-one"),
    signupSheetPagePayload(),
  );
  addPageBatch.set(
    db.doc("centralStudioProjects/document-a/pages/directory-one"),
    directoryPagePayload(),
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
    pageOrder: ["page-one", "signup-one", "directory-one", "content-one"],
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

  const invalidSignup = signupSheetPagePayload();
  invalidSignup.content.signupCount = 25;
  const invalidSignupBatch = db.batch();
  invalidSignupBatch.update(db.doc("centralStudioProjects/document-a"), {
    pageOrder: ["page-one", "invalid-signup"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  invalidSignupBatch.set(
    db.doc("centralStudioProjects/document-a/pages/invalid-signup"),
    invalidSignup,
  );
  await assertFails(invalidSignupBatch.commit());

  const invalidDirectory = directoryPagePayload(["unsafe-card"]);
  const invalidDirectoryBatch = db.batch();
  invalidDirectoryBatch.update(db.doc("centralStudioProjects/document-a"), {
    pageOrder: ["page-one", "invalid-directory"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  invalidDirectoryBatch.set(
    db.doc("centralStudioProjects/document-a/pages/invalid-directory"),
    invalidDirectory,
  );
  await assertSucceeds(invalidDirectoryBatch.commit());
  await assertFails(
    db
      .doc(
        "centralStudioProjects/document-a/pages/invalid-directory/cards/unsafe-card",
      )
      .set(directoryCardPayload("unsafe-card", "someone-else")),
  );

});

test("a full eight-card directory stays within the rules budget", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(createDocumentProject(db));
  const cardIds = Array.from(
    {length: 8},
    (_, index) => `directory-card-${index + 1}`,
  );
  const fullDirectory = directoryPagePayload(cardIds);
  await assertSucceeds(
    db.doc("centralStudioProjects/document-a").update({
    pageOrder: ["page-one", "full-directory"],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    db
      .doc("centralStudioProjects/document-a/pages/full-directory")
      .set(fullDirectory),
  );
  for (const cardId of cardIds) {
    await assertSucceeds(
      db
        .doc(
          `centralStudioProjects/document-a/pages/full-directory/cards/${cardId}`,
        )
        .set(directoryCardPayload(cardId)),
    );
  }
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
  const pointeGlassPayload = eventProjectPayload();
  pointeGlassPayload.templateId = "event-pointe-glass";
  pointeGlassPayload.content.fontKey = "google-sans";
  pointeGlassPayload.content.composition = "pointe-glass";
  await assertSucceeds(
    db.doc("centralStudioProjects/event-pointe-glass").set(pointeGlassPayload),
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
  const smallGroupPayload = eventProjectPayload();
  smallGroupPayload.templateId = "document-small-group-leader";
  smallGroupPayload.name = "Small Group Leader";
  smallGroupPayload.content.format = "screen";
  smallGroupPayload.content.composition = "groups-gradient";
  smallGroupPayload.content.heroMode = "text";
  await assertSucceeds(
    db.doc("centralStudioProjects/small-group-leader").set(smallGroupPayload),
  );
  smallGroupPayload.content.format = "square";
  await assertFails(
    db.doc("centralStudioProjects/small-group-leader-square").set(
      smallGroupPayload,
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
  const borrowedGlassPayload = eventProjectPayload();
  borrowedGlassPayload.templateId = "event-center-stage";
  borrowedGlassPayload.content.fontKey = "google-sans";
  borrowedGlassPayload.content.composition = "pointe-glass";
  await assertFails(
    db.doc("centralStudioProjects/event-borrowed-glass").set(
      borrowedGlassPayload,
    ),
  );
  const mismatchedGlassPayload = eventProjectPayload();
  mismatchedGlassPayload.templateId = "event-pointe-glass";
  mismatchedGlassPayload.content.fontKey = "google-sans";
  mismatchedGlassPayload.content.composition = "center-frame";
  await assertFails(
    db.doc("centralStudioProjects/event-mismatched-glass").set(
      mismatchedGlassPayload,
    ),
  );
  await assertSucceeds(
    reference.update({
      "content.optionalTextVisibility": "none",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.optionalTextVisibility": "hidden",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.optionalTextVisibility": 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
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
      "content.focalX": "50",
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
  await assertSucceeds(
    reference.update({
      "content.backgroundImageOpacity": 0.45,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.backgroundImageOpacity": 1.01,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    reference.update({
      "content.backgroundImageRotation": 225,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.backgroundImageRotation": 361,
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
  await assertSucceeds(
    reference.update({
      "content.fontWeight": "black",
      "content.brandMark": "heart",
      "content.brandColor": "red",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.fontWeight": "ultra",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.brandMark": "unapproved",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    reference.update({
      "content.heroMode": "logo",
      "content.heroLogoSource": "upload",
      "content.heroLogoStoragePath":
        "studio-projects/event-a/logo-event.png",
      "content.heroLogoName": "Event logo",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.heroLogoStoragePath":
        "studio-projects/someone-elses-project/logo-event.png",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    reference.update({
      "content.heroLogoSource": "library",
      "content.heroLogoLibraryId": "bids-for-kids",
      "content.heroLogoStoragePath":
        "studio-library/logos/bids-for-kids/source.webp",
      "content.heroLogoName": "Bids for Kids",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.heroLogoStoragePath":
        "studio-library/logos/another-logo/source.webp",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    reference.update({
      "content.heroLogoScale": 2,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.heroLogoScale": 2.01,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      "content.heroLogoClearSpace": -1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("Social Posts accept their strict layouts and reject event-only state", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const {primaryReference: scriptureReference} = await createSocialProject(
    db,
    "social-scripture",
    socialProjectPayload(),
  );
  await createSocialProject(db, "social-quote", socialProjectPayload("social-quote"));
  await createSocialProject(
    db,
    "social-statement",
    socialProjectPayload("social-statement"),
  );
  await createSocialProject(
    db,
    "social-pointe-glass",
    socialProjectPayload("social-pointe-glass"),
  );
  const borrowedSocialGlass = socialProjectPayload("social-statement");
  borrowedSocialGlass.content.composition = "pointe-glass";
  const {content: borrowedSocialContent, ...borrowedSocialRoot} =
    borrowedSocialGlass;
  const borrowedSocialReference = db.doc(
    "centralStudioProjects/social-borrowed-glass",
  );
  await assertSucceeds(borrowedSocialReference.set(borrowedSocialRoot));
  await assertFails(
    borrowedSocialReference
      .collection("slides")
      .doc("primary")
      .set(socialSlidePayload(borrowedSocialContent)),
  );
  const mismatchedSocialGlass = socialProjectPayload("social-pointe-glass");
  mismatchedSocialGlass.content.composition = "center-frame";
  const {content: mismatchedSocialContent, ...mismatchedSocialRoot} =
    mismatchedSocialGlass;
  const mismatchedSocialReference = db.doc(
    "centralStudioProjects/social-mismatched-glass",
  );
  await assertSucceeds(mismatchedSocialReference.set(mismatchedSocialRoot));
  await assertFails(
    mismatchedSocialReference
      .collection("slides")
      .doc("primary")
      .set(socialSlidePayload(mismatchedSocialContent)),
  );
  const simpleStatement = socialProjectPayload("social-simple-statement");
  simpleStatement.content.flatColor = "cream";
  simpleStatement.content.backgroundImageSource = "upload";
  simpleStatement.content.backgroundImageStoragePath =
    "studio-projects/social-simple-statement/background.png";
  const {primaryReference: simpleStatementReference} = await createSocialProject(
    db,
    "social-simple-statement",
    simpleStatement,
  );
  await assertFails(
    simpleStatementReference.update({
      "content.backgroundImageStoragePath":
        "studio-projects/another-project/background.png",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertSucceeds(
    simpleStatementReference.update({
      "content.backgroundImageSource": "unsplash",
      "content.backgroundImageUrl":
        "https://images.unsplash.com/photo-simple-statement",
      "content.backgroundImageStoragePath": "",
      "content.unsplashPhotoId": "photo-simple-statement",
      "content.unsplashPhotographerName": "Studio Photographer",
      "content.unsplashPhotographerUrl":
        "https://unsplash.com/@studio-photographer",
      "content.unsplashPhotoUrl":
        "https://unsplash.com/photos/photo-simple-statement",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    simpleStatementReference.update({
      "content.unsplashPhotographerName": "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  const simpleLogoPayload = socialProjectPayload("social-simple-statement");
  simpleLogoPayload.content.flatColor = "cream";
  simpleLogoPayload.content.heroMode = "logo";
  simpleLogoPayload.content.heroLogoSource = "upload";
  simpleLogoPayload.content.heroLogoStoragePath =
    "studio-projects/social-simple-logo/logo-campaign.png";
  simpleLogoPayload.content.heroLogoName = "Campaign logo";
  await createSocialProject(db, "social-simple-logo", simpleLogoPayload);

  const carouselPayload = socialProjectPayload("social-simple-statement");
  carouselPayload.content.flatColor = "cream";
  carouselPayload.postMode = "carousel";
  carouselPayload.slideOrder = [
    "primary",
    "slide-2",
    "slide-3",
    "slide-4",
    "slide-5",
    "slide-6",
  ];
  const {reference: carouselReference} = await createSocialProject(
    db,
    "social-carousel",
    carouselPayload,
  );
  for (let index = 2; index <= 6; index += 1) {
    await assertSucceeds(
      carouselReference.collection("slides").doc(`slide-${index}`).set(
        socialSlidePayload({
          ...carouselPayload.content,
          title: `Slide ${index}`,
        }),
      ),
    );
  }
  await assertFails(
    carouselReference.collection("slides").doc("not-listed").set(
      socialSlidePayload({...carouselPayload.content, title: "Not listed"}),
    ),
  );
  await assertFails(
    carouselReference.collection("slides").doc("slide-2").update({
      "content.backgroundImageSource": "upload",
      "content.backgroundImageStoragePath":
        "studio-projects/another-project/background.png",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    carouselReference.collection("slides").doc("slide-2").update({
      unexpected: "schema pollution",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    carouselReference.collection("slides").doc("slide-2").update({
      "content.format": "portrait",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  const oversizedCarousel = {
    ...carouselPayload,
    slideOrder: [...carouselPayload.slideOrder, "slide-7"],
  };
  delete oversizedCarousel.content;
  await assertFails(
    db.doc("centralStudioProjects/social-carousel-too-large").set(
      oversizedCarousel,
    ),
  );
  await assertSucceeds(
    scriptureReference.update({
      "content.title": "A".repeat(220),
      "content.format": "portrait",
      "content.optionalTextVisibility": "none",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    scriptureReference.update({
      "content.optionalTextVisibility": {hidden: true},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    scriptureReference.update({
      "content.title": "A".repeat(221),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    scriptureReference.update({
      "content.format": "screen",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    scriptureReference.update({
      "content.date": "SEPTEMBER 18",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    scriptureReference.update({
      "content.heroMode": "logo",
      "content.heroLogoSource": "upload",
      "content.heroLogoStoragePath":
        "studio-projects/social-scripture/logo.png",
      "content.heroLogoName": "Event logo",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );

  const mismatchedComposition = socialProjectPayload("social-quote");
  mismatchedComposition.content.composition = "center-frame";
  const mismatchedReference = db.doc(
    "centralStudioProjects/social-mismatched",
  );
  const {content: mismatchedContent, ...mismatchedRoot} = mismatchedComposition;
  await assertSucceeds(mismatchedReference.set(mismatchedRoot));
  await assertFails(
    mismatchedReference
      .collection("slides")
      .doc("primary")
      .set(socialSlidePayload(mismatchedContent)),
  );

  const planningCenterSource = socialProjectPayload("social-statement");
  planningCenterSource.sourceType = "planning-center";
  planningCenterSource.sourceId = "100";
  planningCenterSource.sourceEventId = "10";
  planningCenterSource.sourceUrl = "https://example.com/event/100";
  planningCenterSource.sourceUpdatedAt =
    firebase.firestore.FieldValue.serverTimestamp();
  delete planningCenterSource.content;
  await assertFails(
    db.doc("centralStudioProjects/social-planning-center").set(
      planningCenterSource,
    ),
  );
});

test("event projects accept light palettes and validated Planning Center sources", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const payload = eventProjectPayload();
  payload.templateId = "event-center-stage";
  payload.content.fontKey = "league-spartan";
  payload.content.composition = "center-burst";
  payload.content.palette = "paper-red";
  payload.sourceType = "planning-center";
  payload.sourceId = "228960560";
  payload.sourceEventId = "21812604";
  payload.sourceUrl =
    "https://crosspointetv.churchcenter.com/calendar/event/228960560";
  payload.sourceUpdatedAt =
    firebase.firestore.FieldValue.serverTimestamp();

  const reference = db.doc("centralStudioProjects/planning-center-event");
  await assertSucceeds(reference.set(payload));
  await assertSucceeds(
    reference.update({
      sourceType: "manual",
      sourceId: "",
      sourceEventId: "",
      sourceUrl: "",
      sourceUpdatedAt: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
});

test("event projects reject malformed Planning Center source identity", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const payload = eventProjectPayload();
  payload.sourceType = "planning-center";
  payload.sourceId = "instance-100";
  payload.sourceEventId = "10";
  payload.sourceUrl = "https://example.com/event/100";
  payload.sourceUpdatedAt =
    firebase.firestore.FieldValue.serverTimestamp();

  await assertFails(
    db.doc("centralStudioProjects/malformed-planning-center-event").set(payload),
  );
});

test("Logo Library is readable by Studio users and writable only by explicit Studio admins", async () => {
  const adminDb = environment
    .authenticatedContext("studio-admin")
    .firestore();
  const editorDb = environment.authenticatedContext("owner").firestore();
  const approverDb = environment.authenticatedContext("approver").firestore();
  const reference = adminDb.doc("centralStudioLogoLibrary/logo-a");

  await assertSucceeds(reference.set(logoLibraryPayload()));
  await assertSucceeds(editorDb.doc("centralStudioLogoLibrary/logo-a").get());
  await assertSucceeds(
    editorDb.collection("centralStudioLogoLibrary").get(),
  );
  await assertFails(
    editorDb
      .doc("centralStudioLogoLibrary/editor-logo")
      .set(logoLibraryPayload("editor-logo", "owner")),
  );
  await assertFails(
    approverDb
      .doc("centralStudioLogoLibrary/approver-logo")
      .set(logoLibraryPayload("approver-logo", "approver")),
  );
  await assertFails(
    adminDb
      .doc("centralStudioLogoLibrary/spoofed-logo")
      .set(logoLibraryPayload("spoofed-logo", "owner")),
  );
  await assertFails(
    adminDb.doc("centralStudioLogoLibrary/wrong-path").set({
      ...logoLibraryPayload("wrong-path"),
      storagePath: "studio-library/logos/another-logo/source.png",
    }),
  );
  await assertFails(
    adminDb.doc("centralStudioLogoLibrary/extra-field").set({
      ...logoLibraryPayload("extra-field"),
      public: true,
    }),
  );
  await assertSucceeds(
    reference.update({
      name: "Bids for Kids Updated",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(
    reference.update({
      storagePath: "studio-library/logos/logo-a/source.webp",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
  await assertFails(reference.delete());
  await assertFails(
    environment
      .unauthenticatedContext()
      .firestore()
      .doc("centralStudioLogoLibrary/logo-a")
      .get(),
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

test("Storage enforces project image access and tighter logo limits", async () => {
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
  const fiveMiB = new Uint8Array(5 * 1024 * 1024);
  await assertSucceeds(
    ownerStorage
      .ref("studio-projects/project-a/background-large.png")
      .put(fiveMiB, {contentType: "image/png"}),
  );
  await assertFails(
    ownerStorage
      .ref("studio-projects/project-a/logo-too-large.png")
      .put(fiveMiB, {contentType: "image/png"}),
  );
});

test("Logo Library Storage is readable by Studio users and immutable after metadata exists", async () => {
  const adminContext = environment.authenticatedContext("studio-admin");
  const editorContext = environment.authenticatedContext("owner");
  const adminStorage = adminContext.storage();
  const editorStorage = editorContext.storage();
  const logoReference = adminStorage.ref(
    "studio-library/logos/logo-a/source.png",
  );

  await assertSucceeds(
    logoReference.put(new Uint8Array([137, 80, 78, 71]), {
      contentType: "image/png",
    }),
  );
  await assertSucceeds(
    editorStorage.ref("studio-library/logos/logo-a/source.png").getDownloadURL(),
  );
  await assertFails(
    editorStorage
      .ref("studio-library/logos/editor-logo/source.png")
      .put(new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
      }),
  );
  await assertFails(
    adminStorage
      .ref("studio-library/logos/bad-file/source.svg")
      .putString("<svg></svg>", "raw", {contentType: "image/svg+xml"}),
  );

  await assertSucceeds(
    adminContext
      .firestore()
      .doc("centralStudioLogoLibrary/logo-a")
      .set(logoLibraryPayload()),
  );
  await assertFails(
    logoReference.put(new Uint8Array([137, 80, 78, 71]), {
      contentType: "image/png",
    }),
  );
  await assertFails(logoReference.delete());

  const orphanReference = adminStorage.ref(
    "studio-library/logos/orphan-logo/source.webp",
  );
  await assertSucceeds(
    orphanReference.put(new Uint8Array([82, 73, 70, 70]), {
      contentType: "image/webp",
    }),
  );
  await assertSucceeds(orphanReference.delete());
});
