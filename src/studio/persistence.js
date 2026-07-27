import {
  DOCUMENT_PROJECT_TEMPLATE_ID,
  isDocumentProject,
  linesToText,
  migrateLegacyStudioProject,
  normalizeEventComposition,
  textToLines,
} from "./templates.js";

const PROJECT_COLLECTION = "centralStudioProjects";
const MEMBERSHIP_COLLECTION = "centralStudioMemberships";

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function focalValue(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, number))
    : fallback;
}

function zoomValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(2, Math.max(1, number))
    : 1;
}

function legacyFocalPoint(content) {
  const positions = {
    "left center": {x: 25, y: 50},
    center: {x: 50, y: 50},
    "right center": {x: 75, y: 50},
  };
  return positions[content.imagePosition] || positions.center;
}

function onePagerContentForCloud(content) {
  return {
    eyebrow: stringValue(content.eyebrow),
    audience: stringValue(content.audience),
    documentNumber: stringValue(content.documentNumber),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    operatingRuleLabel: stringValue(content.operatingRuleLabel),
    operatingRule: stringValue(content.operatingRule),
    primarySectionLabel: stringValue(content.primarySectionLabel),
    primarySectionTitle: stringValue(content.primarySectionTitle),
    primaryItemsText: stringValue(
      content.primaryItemsText || linesToText(content.primaryItems),
    ),
    secondarySectionLabel: stringValue(content.secondarySectionLabel),
    secondarySectionTitle: stringValue(content.secondarySectionTitle),
    secondaryItemsText: stringValue(
      content.secondaryItemsText || linesToText(content.secondaryItems),
    ),
    ownerLabel: stringValue(content.ownerLabel),
    ownerTitle: stringValue(content.ownerTitle),
    ownerItemsText: stringValue(
      content.ownerItemsText || linesToText(content.ownerItems),
    ),
    processLabel: stringValue(content.processLabel),
    processStepsText: stringValue(
      content.processStepsText || linesToText(content.processSteps),
    ),
    footerNote: stringValue(content.footerNote),
    footerReference: stringValue(content.footerReference),
    accent: "red",
  };
}

function checklistContentForCloud(content) {
  return {
    eyebrow: stringValue(content.eyebrow),
    audience: stringValue(content.audience),
    documentNumber: stringValue(content.documentNumber),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    instructionsLabel: stringValue(content.instructionsLabel),
    instructions: stringValue(content.instructions),
    sectionOneTitle: stringValue(content.sectionOneTitle),
    sectionOneItemsText: stringValue(
      content.sectionOneItemsText || linesToText(content.sectionOneItems),
    ),
    sectionTwoTitle: stringValue(content.sectionTwoTitle),
    sectionTwoItemsText: stringValue(
      content.sectionTwoItemsText || linesToText(content.sectionTwoItems),
    ),
    sectionThreeTitle: stringValue(content.sectionThreeTitle),
    sectionThreeItemsText: stringValue(
      content.sectionThreeItemsText || linesToText(content.sectionThreeItems),
    ),
    calloutLabel: stringValue(content.calloutLabel),
    calloutText: stringValue(content.calloutText),
    footerNote: stringValue(content.footerNote),
    footerReference: stringValue(content.footerReference),
    accent: "red",
  };
}

function contentBlocksForCloud(blocks) {
  return (Array.isArray(blocks) ? blocks : []).slice(0, 8).map((block) => ({
    id: stringValue(block?.id).slice(0, 80),
    type: [
      "heading",
      "paragraph",
      "bullets",
      "numbered",
      "callout",
      "divider",
    ].includes(block?.type)
      ? block.type
      : "paragraph",
    text: stringValue(block?.text).slice(0, 1200),
  }));
}

function contentPageContentForCloud(content) {
  return {
    eyebrow: stringValue(content.eyebrow),
    audience: stringValue(content.audience),
    documentNumber: stringValue(content.documentNumber),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    blocks: contentBlocksForCloud(content.blocks),
    footerNote: stringValue(content.footerNote),
    footerReference: stringValue(content.footerReference),
    accent: "red",
  };
}

function documentPageForCloud(page) {
  const templateId = [
    "document-one-pager",
    "document-checklist",
    "document-content-page",
  ].includes(page?.templateId)
    ? page.templateId
    : "document-one-pager";
  const content =
    templateId === "document-checklist"
      ? checklistContentForCloud(page.content || {})
      : templateId === "document-content-page"
        ? contentPageContentForCloud(page.content || {})
        : onePagerContentForCloud(page.content || {});
  return {
    schemaVersion: 1,
    templateId,
    content,
  };
}

function eventContentForCloud(content, templateId) {
  const source = ["upload", "unsplash"].includes(content.backgroundImageSource)
    ? content.backgroundImageSource
    : "";
  const legacyFocal = legacyFocalPoint(content);
  return {
    eyebrow: stringValue(content.eyebrow),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    date: stringValue(content.date),
    time: stringValue(content.time),
    location: stringValue(content.location),
    cta: stringValue(content.cta),
    format: stringValue(content.format || "square"),
    composition: normalizeEventComposition(
      templateId,
      stringValue(content.composition || "editorial"),
    ),
    palette: stringValue(content.palette || "charcoal-red"),
    flatColor: stringValue(content.flatColor || "charcoal"),
    overlayColor: stringValue(content.overlayColor || "red"),
    overlayBlendMode: stringValue(content.overlayBlendMode || "multiply"),
    imagePosition: stringValue(content.imagePosition || "center"),
    focalX: focalValue(content.focalX, legacyFocal.x),
    focalY: focalValue(content.focalY, legacyFocal.y),
    imageZoom: zoomValue(content.imageZoom),
    backgroundImageSource: source,
    backgroundImageUrl:
      source === "unsplash" ? stringValue(content.backgroundImageUrl) : "",
    backgroundImageStoragePath:
      source === "upload"
        ? stringValue(content.backgroundImageStoragePath)
        : "",
    unsplashPhotoId:
      source === "unsplash" ? stringValue(content.unsplashPhotoId) : "",
    unsplashPhotographerName:
      source === "unsplash"
        ? stringValue(content.unsplashPhotographerName)
        : "",
    unsplashPhotographerUrl:
      source === "unsplash"
        ? stringValue(content.unsplashPhotographerUrl)
        : "",
    unsplashPhotoUrl:
      source === "unsplash" ? stringValue(content.unsplashPhotoUrl) : "",
    fontKey: stringValue(content.fontKey || "montserrat"),
    textAlignment: stringValue(content.textAlignment || "left"),
    textShadow: Boolean(content.textShadow),
  };
}

export function projectForCloud(project, ownerUid) {
  if (isDocumentProject(project)) {
    return {
      schemaVersion: 2,
      ownerUid,
      templateId: DOCUMENT_PROJECT_TEMPLATE_ID,
      name: String(project.name || "").trim(),
      status: "draft",
      sourceType: "manual",
      pageOrder: (project.pages || []).slice(0, 20).map((page) => page.id),
      documentSettings: {
        showPageNumbers: project.documentSettings?.showPageNumbers !== false,
      },
    };
  }
  return {
    schemaVersion: 1,
    ownerUid,
    templateId: project.templateId,
    name: String(project.name || "").trim(),
    status: "draft",
    sourceType: "manual",
    content: eventContentForCloud(project.content || {}, project.templateId),
  };
}

function hydrateDocumentPage(snapshot) {
  const data = snapshot.data();
  const cloudContent = data.content || {};
  let content = cloudContent;
  if (data.templateId === "document-one-pager") {
    content = {
      ...cloudContent,
      primaryItems: textToLines(cloudContent.primaryItemsText, 7),
      secondaryItems: textToLines(cloudContent.secondaryItemsText, 7),
      ownerItems: textToLines(cloudContent.ownerItemsText, 3),
      processSteps: textToLines(cloudContent.processStepsText, 8),
    };
  } else if (data.templateId === "document-checklist") {
    content = {
      ...cloudContent,
      sectionOneItems: textToLines(cloudContent.sectionOneItemsText),
      sectionTwoItems: textToLines(cloudContent.sectionTwoItemsText),
      sectionThreeItems: textToLines(cloudContent.sectionThreeItemsText),
    };
  } else if (data.templateId === "document-content-page") {
    content = {
      ...cloudContent,
      blocks: contentBlocksForCloud(cloudContent.blocks),
    };
  }
  return {
    id: snapshot.id,
    templateId: data.templateId,
    content,
    cloudBacked: true,
  };
}

async function hydrateProject(snapshot, storage, shared = false) {
  const data = snapshot.data();
  if (
    data.schemaVersion === 2 &&
    data.templateId === DOCUMENT_PROJECT_TEMPLATE_ID
  ) {
    const pageSnapshot = await snapshot.ref.collection("pages").get();
    const pagesById = new Map(
      pageSnapshot.docs.map((page) => {
        const hydrated = hydrateDocumentPage(page);
        return [hydrated.id, hydrated];
      }),
    );
    const pages = (data.pageOrder || [])
      .map((pageId) => pagesById.get(pageId))
      .filter(Boolean);
    return migrateLegacyStudioProject({
      id: snapshot.id,
      schemaVersion: 2,
      projectKind: "document",
      templateId: DOCUMENT_PROJECT_TEMPLATE_ID,
      name: data.name,
      status: data.status,
      sourceType: data.sourceType,
      createdAt:
        data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
      updatedAt:
        data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
      ownerUid: data.ownerUid,
      shared,
      cloudBacked: true,
      documentSettings: data.documentSettings || {showPageNumbers: true},
      pages,
    });
  }

  const cloudContent = data.content || {};
  let backgroundImage = stringValue(cloudContent.backgroundImageUrl);
  if (
    data.templateId !== "policy-document" &&
    cloudContent.backgroundImageSource === "upload" &&
    cloudContent.backgroundImageStoragePath
  ) {
    try {
      backgroundImage = await storage
        .ref(cloudContent.backgroundImageStoragePath)
        .getDownloadURL();
    } catch (error) {
      backgroundImage = "";
    }
  }
  const content =
    data.templateId === "policy-document"
      ? {
          ...cloudContent,
          primaryItems: textToLines(cloudContent.primaryItemsText, 7),
          secondaryItems: textToLines(cloudContent.secondaryItemsText, 7),
          ownerItems: textToLines(cloudContent.ownerItemsText, 3),
          processSteps: textToLines(cloudContent.processStepsText, 8),
        }
      : {
          ...cloudContent,
          backgroundImage,
          focalX: focalValue(
            cloudContent.focalX,
            legacyFocalPoint(cloudContent).x,
          ),
          focalY: focalValue(
            cloudContent.focalY,
            legacyFocalPoint(cloudContent).y,
          ),
        };
  return migrateLegacyStudioProject({
    id: snapshot.id,
    templateId: data.templateId,
    name: data.name,
    status: data.status,
    sourceType: data.sourceType,
    createdAt:
      data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    updatedAt:
      data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
    ownerUid: data.ownerUid,
    shared,
    cloudBacked: true,
    content,
  });
}

async function authorizedJson(auth, url, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to Central Studio first.");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Central Studio could not complete that request.");
  }
  return data;
}

async function localPreviewJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "X-Central-Studio-Preview": "1",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Central Studio could not complete that request.");
  }
  return data;
}

export function createStudioPreviewUnsplash() {
  return {
    searchUnsplash(query, orientation) {
      const parameters = new URLSearchParams({q: query});
      if (orientation) parameters.set("orientation", orientation);
      return localPreviewJson(
        `/api/studio/unsplash/search?${parameters.toString()}`,
      );
    },
    async selectUnsplash(photo) {
      await localPreviewJson("/api/studio/unsplash/track-download", {
        method: "POST",
        body: JSON.stringify({downloadLocation: photo.downloadLocation}),
      });
      return {
        backgroundImage: photo.imageUrl,
        backgroundImageSource: "unsplash",
        backgroundImageUrl: photo.imageUrl,
        backgroundImageStoragePath: "",
        unsplashPhotoId: photo.id,
        unsplashPhotographerName: photo.photographerName,
        unsplashPhotographerUrl: photo.photographerUrl,
        unsplashPhotoUrl: photo.photoUrl,
      };
    },
  };
}

export function createStudioCloud({
  auth,
  firestore,
  storage,
  user,
}) {
  if (!auth || !firestore || !storage || !user) return null;

  async function loadProjects() {
    const ownedSnapshot = await firestore
      .collection(PROJECT_COLLECTION)
      .where("ownerUid", "==", user.uid)
      .get();
    const membershipSnapshot = await firestore
      .collection(MEMBERSHIP_COLLECTION)
      .where("memberUid", "==", user.uid)
      .get();
    const ownedIds = new Set(ownedSnapshot.docs.map((document) => document.id));
    const sharedSnapshots = await Promise.all(
      membershipSnapshot.docs
        .map((document) => document.data().projectId)
        .filter((projectId) => projectId && !ownedIds.has(projectId))
        .map((projectId) =>
          firestore.doc(`${PROJECT_COLLECTION}/${projectId}`).get(),
        ),
    );
    return Promise.all([
      ...ownedSnapshot.docs.map((snapshot) =>
        hydrateProject(snapshot, storage, false),
      ),
      ...sharedSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => hydrateProject(snapshot, storage, true)),
    ]);
  }

  async function saveProject(project) {
    const reference = firestore.doc(`${PROJECT_COLLECTION}/${project.id}`);
    const snapshot = await reference.get();
    const payload = projectForCloud(
      project,
      snapshot.exists ? snapshot.data().ownerUid : user.uid,
    );

    if (isDocumentProject(project)) {
      const batch = firestore.batch();
      const serverTimestamp =
        window.firebase.firestore.FieldValue.serverTimestamp();
      const previousData = snapshot.exists ? snapshot.data() : null;
      const previousPageIds =
        previousData?.schemaVersion === 2 &&
        Array.isArray(previousData.pageOrder)
          ? previousData.pageOrder
          : [];
      const nextPageIds = new Set(payload.pageOrder);

      if (!snapshot.exists) {
        batch.set(reference, {
          ...payload,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        });
      } else if (previousData.schemaVersion === 2) {
        batch.update(reference, {
          name: payload.name,
          status: payload.status,
          sourceType: payload.sourceType,
          pageOrder: payload.pageOrder,
          documentSettings: payload.documentSettings,
          updatedAt: serverTimestamp,
        });
      } else {
        batch.set(reference, {
          ...payload,
          createdAt: previousData.createdAt,
          updatedAt: serverTimestamp,
        });
      }

      (project.pages || []).forEach((page) => {
        const pageReference = reference.collection("pages").doc(page.id);
        const pagePayload = documentPageForCloud(page);
        if (previousPageIds.includes(page.id)) {
          batch.update(pageReference, {
            templateId: pagePayload.templateId,
            content: pagePayload.content,
            updatedAt: serverTimestamp,
          });
        } else {
          batch.set(pageReference, {
            ...pagePayload,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        }
      });
      previousPageIds
        .filter((pageId) => !nextPageIds.has(pageId))
        .forEach((pageId) => {
          batch.delete(reference.collection("pages").doc(pageId));
        });
      await batch.commit();
      return {
        ...project,
        schemaVersion: 2,
        ownerUid: payload.ownerUid,
        cloudBacked: true,
      };
    }

    if (snapshot.exists) {
      await reference.update({
        name: payload.name,
        status: payload.status,
        sourceType: payload.sourceType,
        content: payload.content,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await reference.set({
        ...payload,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    return {...project, ownerUid: payload.ownerUid, cloudBacked: true};
  }

  async function uploadBackground(project, file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP image.");
    }
    if (file.size >= 8 * 1024 * 1024) {
      throw new Error("Background images must be smaller than 8 MB.");
    }
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const assetId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await saveProject(project);
    const path = `studio-projects/${project.id}/${assetId}.${extension}`;
    const reference = storage.ref(path);
    await reference.put(file, {
      contentType: file.type,
      cacheControl: "private,max-age=3600",
    });
    return {
      backgroundImage: await reference.getDownloadURL(),
      backgroundImageSource: "upload",
      backgroundImageStoragePath: path,
      backgroundImageUrl: "",
      unsplashPhotoId: "",
      unsplashPhotographerName: "",
      unsplashPhotographerUrl: "",
      unsplashPhotoUrl: "",
    };
  }

  return {
    loadProjects,
    saveProject,
    uploadBackground,
    searchUnsplash(query, orientation) {
      const parameters = new URLSearchParams({q: query});
      if (orientation) parameters.set("orientation", orientation);
      return authorizedJson(
        auth,
        `/api/studio/unsplash/search?${parameters.toString()}`,
      );
    },
    async selectUnsplash(photo) {
      await authorizedJson(auth, "/api/studio/unsplash/track-download", {
        method: "POST",
        body: JSON.stringify({downloadLocation: photo.downloadLocation}),
      });
      return {
        backgroundImage: photo.imageUrl,
        backgroundImageSource: "unsplash",
        backgroundImageUrl: photo.imageUrl,
        backgroundImageStoragePath: "",
        unsplashPhotoId: photo.id,
        unsplashPhotographerName: photo.photographerName,
        unsplashPhotographerUrl: photo.photographerUrl,
        unsplashPhotoUrl: photo.photoUrl,
      };
    },
    createShare(projectId) {
      return authorizedJson(auth, "/api/studio/projects/share", {
        method: "POST",
        body: JSON.stringify({projectId}),
      });
    },
    acceptShare(token) {
      return authorizedJson(auth, "/api/studio/shares/accept", {
        method: "POST",
        body: JSON.stringify({token}),
      });
    },
    leaveProject(projectId) {
      return authorizedJson(auth, "/api/studio/projects/leave", {
        method: "POST",
        body: JSON.stringify({projectId}),
      });
    },
    deleteProject(projectId) {
      return authorizedJson(auth, "/api/studio/projects/delete", {
        method: "POST",
        body: JSON.stringify({projectId}),
      });
    },
  };
}
