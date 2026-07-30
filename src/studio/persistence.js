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
const LOGO_LIBRARY_COLLECTION = "centralStudioLogoLibrary";

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

function logoScaleValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(2, Math.max(0.5, number))
    : 1;
}

function logoClearSpaceValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(12, Math.max(0, number))
    : 4;
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

function signupSheetContentForCloud(content) {
  const signupCount = Number(content.signupCount);
  return {
    eyebrow: stringValue(content.eyebrow),
    audience: stringValue(content.audience),
    documentNumber: stringValue(content.documentNumber),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    instructionsLabel: stringValue(content.instructionsLabel),
    instructions: stringValue(content.instructions),
    signupCount: Number.isInteger(signupCount)
      ? Math.min(24, Math.max(4, signupCount))
      : 12,
    columnOneLabel: stringValue(content.columnOneLabel),
    columnTwoLabel: stringValue(content.columnTwoLabel),
    columnThreeLabel: stringValue(content.columnThreeLabel),
    showNumbers: content.showNumbers !== false,
    footerNote: stringValue(content.footerNote),
    footerReference: stringValue(content.footerReference),
    accent: "red",
  };
}

function directoryCardForCloud(card) {
  const imageUrl = stringValue(card?.imageUrl);
  return {
    id: stringValue(card?.id).slice(0, 80),
    name: stringValue(card?.name).slice(0, 80),
    subtitle: stringValue(card?.subtitle).slice(0, 100),
    details: stringValue(card?.details).slice(0, 360),
    imageUrl: imageUrl.startsWith("data:") ? "" : imageUrl.slice(0, 1000),
    imageStoragePath: stringValue(card?.imageStoragePath).slice(0, 500),
    sourceType:
      card?.sourceType === "planning-center" ? "planning-center" : "manual",
    sourceId: stringValue(card?.sourceId).slice(0, 80),
    publicUrl: stringValue(card?.publicUrl).slice(0, 500),
  };
}

function directoryContentForCloud(content) {
  const cards = (Array.isArray(content.cards) ? content.cards : []).slice(0, 8);
  return {
    eyebrow: stringValue(content.eyebrow),
    audience: stringValue(content.audience),
    documentNumber: stringValue(content.documentNumber),
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    cardOrder: cards.map((card) => stringValue(card?.id).slice(0, 80)),
    footerNote: stringValue(content.footerNote),
    footerReference: stringValue(content.footerReference),
    accent: "red",
  };
}

function documentPageForCloud(page) {
  const templateId = [
    "document-one-pager",
    "document-checklist",
    "document-signup-sheet",
    "document-directory",
    "document-content-page",
  ].includes(page?.templateId)
    ? page.templateId
    : "document-one-pager";
  const content =
    templateId === "document-checklist"
      ? checklistContentForCloud(page.content || {})
      : templateId === "document-signup-sheet"
        ? signupSheetContentForCloud(page.content || {})
        : templateId === "document-directory"
          ? directoryContentForCloud(page.content || {})
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
    heroMode: content.heroMode === "logo" ? "logo" : "text",
    heroLogoSource: ["upload", "library"].includes(content.heroLogoSource)
      ? content.heroLogoSource
      : "",
    heroLogoLibraryId:
      content.heroLogoSource === "library"
        ? stringValue(content.heroLogoLibraryId)
        : "",
    heroLogoStoragePath: ["upload", "library"].includes(
      content.heroLogoSource,
    )
      ? stringValue(content.heroLogoStoragePath)
      : "",
    heroLogoName: ["upload", "library"].includes(content.heroLogoSource)
      ? stringValue(content.heroLogoName)
      : "",
    heroLogoScale: logoScaleValue(content.heroLogoScale),
    heroLogoClearSpace: logoClearSpaceValue(content.heroLogoClearSpace),
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

async function hydrateDocumentPage(snapshot) {
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
  } else if (data.templateId === "document-directory") {
    const cardSnapshot = await snapshot.ref.collection("cards").get();
    const cardsById = new Map(
      cardSnapshot.docs.map((cardDocument) => [
        cardDocument.id,
        directoryCardForCloud(cardDocument.data()),
      ]),
    );
    content = {
      ...cloudContent,
      cards: (Array.isArray(cloudContent.cardOrder)
        ? cloudContent.cardOrder
        : []
      )
        .slice(0, 8)
        .map((cardId) => cardsById.get(cardId))
        .filter(Boolean),
    };
    delete content.cardOrder;
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
    const hydratedPages = await Promise.all(
      pageSnapshot.docs.map((page) => hydrateDocumentPage(page)),
    );
    const pagesById = new Map(
      hydratedPages.map((page) => [page.id, page]),
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
  let heroLogo = "";
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
  if (
    data.templateId !== "policy-document" &&
    ["upload", "library"].includes(cloudContent.heroLogoSource) &&
    cloudContent.heroLogoStoragePath
  ) {
    try {
      heroLogo = await storage
        .ref(cloudContent.heroLogoStoragePath)
        .getDownloadURL();
    } catch (error) {
      heroLogo = "";
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
          heroLogo,
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("Central Studio could not prepare that image."));
    reader.readAsDataURL(blob);
  });
}

async function imageResponseToDataUrl(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || "Central Studio could not prepare that image for export.",
    );
  }
  return blobToDataUrl(await response.blob());
}

async function localPreviewImageDataUrl(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {"X-Central-Studio-Preview": "1"},
  });
  return imageResponseToDataUrl(response);
}

async function authorizedImageDataUrl(auth, url) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to Central Studio first.");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {Authorization: `Bearer ${token}`},
  });
  return imageResponseToDataUrl(response);
}

export function createStudioPreviewUnsplash() {
  return {
    searchUnsplash(query, orientation, page = 1) {
      const parameters = new URLSearchParams({q: query});
      if (orientation) parameters.set("orientation", orientation);
      parameters.set("page", String(page));
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
    searchPlanningCenterGroups(query = "") {
      const parameters = new URLSearchParams();
      if (String(query || "").trim()) {
        parameters.set("q", String(query).trim());
      }
      return localPreviewJson(
        `/api/studio/pco/groups?${parameters.toString()}`,
      );
    },
    resolvePlanningCenterImage(imageUrl) {
      const parameters = new URLSearchParams({url: String(imageUrl || "")});
      return localPreviewImageDataUrl(
        `/api/studio/pco/image?${parameters.toString()}`,
      );
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
        await reference.set({
          ...payload,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        });
      } else if (previousData.schemaVersion === 2) {
        await reference.update({
          name: payload.name,
          status: payload.status,
          sourceType: payload.sourceType,
          pageOrder: payload.pageOrder,
          documentSettings: payload.documentSettings,
          updatedAt: serverTimestamp,
        });
      } else {
        await reference.set({
          ...payload,
          createdAt: previousData.createdAt,
          updatedAt: serverTimestamp,
        });
      }

      for (const page of project.pages || []) {
        const pageReference = reference.collection("pages").doc(page.id);
        const pageSnapshot = await pageReference.get();
        const previousPageData = pageSnapshot.exists
          ? pageSnapshot.data()
          : null;
        const previousCardSnapshot =
          previousPageData?.templateId === "document-directory"
            ? await pageReference.collection("cards").get()
            : null;
        const pagePayload = documentPageForCloud(page);
        if (pageSnapshot.exists) {
          await pageReference.update({
            templateId: pagePayload.templateId,
            content: pagePayload.content,
            updatedAt: serverTimestamp,
          });
        } else {
          await pageReference.set({
            ...pagePayload,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        }

        const previousCardIds = new Set(
          previousCardSnapshot?.docs.map((card) => card.id) || [],
        );
        if (page.templateId === "document-directory") {
          const cards = (Array.isArray(page.content?.cards)
            ? page.content.cards
            : []
          ).slice(0, 8);
          const nextCardIds = new Set(cards.map((card) => card.id));
          for (const card of cards) {
            const cardReference = pageReference.collection("cards").doc(card.id);
            const cardPayload = directoryCardForCloud(card);
            if (previousCardIds.has(card.id)) {
              await cardReference.update({
                ...cardPayload,
                updatedAt: serverTimestamp,
              });
            } else {
              await cardReference.set({
                ...cardPayload,
                createdAt: serverTimestamp,
                updatedAt: serverTimestamp,
              });
            }
          }
          for (const cardId of previousCardIds) {
            if (!nextCardIds.has(cardId)) {
              await pageReference.collection("cards").doc(cardId).delete();
            }
          }
        } else {
          for (const cardId of previousCardIds) {
            await pageReference.collection("cards").doc(cardId).delete();
          }
        }
      }

      for (const pageId of previousPageIds) {
        if (nextPageIds.has(pageId)) continue;
        const pageReference = reference.collection("pages").doc(pageId);
        const cardSnapshot = await pageReference.collection("cards").get();
        for (const cardDocument of cardSnapshot.docs) {
          await cardDocument.ref.delete();
        }
        await pageReference.delete();
      }
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

  async function uploadHeroLogo(project, file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP logo.");
    }
    if (file.size >= 4 * 1024 * 1024) {
      throw new Error("Logo files must be smaller than 4 MB.");
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
    const path = `studio-projects/${project.id}/logo-${assetId}.${extension}`;
    const reference = storage.ref(path);
    await reference.put(file, {
      contentType: file.type,
      cacheControl: "private,max-age=3600",
    });
    return {
      heroMode: "logo",
      heroLogo: await reference.getDownloadURL(),
      heroLogoSource: "upload",
      heroLogoLibraryId: "",
      heroLogoStoragePath: path,
      heroLogoName: stringValue(file.name).slice(0, 80) || "Uploaded logo",
    };
  }

  async function loadLogoLibrary() {
    const snapshot = await firestore.collection(LOGO_LIBRARY_COLLECTION).get();
    const logos = await Promise.all(
      snapshot.docs.map(async (document) => {
        const data = document.data();
        let imageUrl = "";
        try {
          imageUrl = await storage.ref(data.storagePath).getDownloadURL();
        } catch (error) {
          imageUrl = "";
        }
        return {
          id: document.id,
          name: stringValue(data.name),
          storagePath: stringValue(data.storagePath),
          contentType: stringValue(data.contentType),
          status: stringValue(data.status),
          imageUrl,
        };
      }),
    );
    return logos
      .filter((logo) => logo.status === "active" && logo.imageUrl)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function uploadLogoToLibrary(name, file) {
    const cleanName = stringValue(name).trim().slice(0, 80);
    if (!cleanName) throw new Error("Enter a name for this library logo.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP logo.");
    }
    if (file.size >= 4 * 1024 * 1024) {
      throw new Error("Logo files must be smaller than 4 MB.");
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
    const path = `studio-library/logos/${assetId}/source.${extension}`;
    const reference = storage.ref(path);
    await reference.put(file, {
      contentType: file.type,
      cacheControl: "public,max-age=3600",
    });
    try {
      await firestore.doc(`${LOGO_LIBRARY_COLLECTION}/${assetId}`).set({
        schemaVersion: 1,
        name: cleanName,
        storagePath: path,
        contentType: file.type,
        status: "active",
        createdByUid: user.uid,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      await reference.delete().catch(() => {});
      throw error;
    }
    return {
      id: assetId,
      name: cleanName,
      storagePath: path,
      contentType: file.type,
      status: "active",
      imageUrl: await reference.getDownloadURL(),
    };
  }

  async function uploadDirectoryImage(project, pageId, cardId, file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP image.");
    }
    if (file.size >= 8 * 1024 * 1024) {
      throw new Error("Directory images must be smaller than 8 MB.");
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
    const path =
      `studio-projects/${project.id}/directory-${String(pageId).slice(0, 36)}-` +
      `${String(cardId).slice(0, 36)}-${assetId}.${extension}`;
    const reference = storage.ref(path);
    await reference.put(file, {
      contentType: file.type,
      cacheControl: "private,max-age=3600",
    });
    return {
      imageUrl: await reference.getDownloadURL(),
      imageStoragePath: path,
    };
  }

  return {
    loadProjects,
    saveProject,
    uploadBackground,
    uploadHeroLogo,
    uploadDirectoryImage,
    loadLogoLibrary,
    uploadLogoToLibrary,
    searchUnsplash(query, orientation, page = 1) {
      const parameters = new URLSearchParams({q: query});
      if (orientation) parameters.set("orientation", orientation);
      parameters.set("page", String(page));
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
    searchPlanningCenterGroups(query = "") {
      const parameters = new URLSearchParams();
      if (String(query || "").trim()) {
        parameters.set("q", String(query).trim());
      }
      return authorizedJson(
        auth,
        `/api/studio/pco/groups?${parameters.toString()}`,
      );
    },
    resolvePlanningCenterImage(imageUrl) {
      const parameters = new URLSearchParams({url: String(imageUrl || "")});
      return authorizedImageDataUrl(
        auth,
        `/api/studio/pco/image?${parameters.toString()}`,
      );
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
