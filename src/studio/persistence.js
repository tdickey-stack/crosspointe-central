import {
  DOCUMENT_PROJECT_TEMPLATE_ID,
  MAX_SOCIAL_CAROUSEL_SLIDES,
  isEventTemplateId,
  isDocumentProject,
  isSocialTemplateId,
  linesToText,
  migrateLegacyStudioProject,
  normalizeEventComposition,
  supportsHeroLogoTemplate,
  textToLines,
} from "./templates.js";
import {planningCenterEventsFromCentralData} from "./planning-center-events.js";

const PROJECT_COLLECTION = "centralStudioProjects";
const MEMBERSHIP_COLLECTION = "centralStudioMemberships";
const LOGO_LIBRARY_COLLECTION = "centralStudioLogoLibrary";
const SERVER_READ_OPTIONS = {source: "server"};

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function cloudRevisionValue(value, fallback = null) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : fallback;
}

function projectCloudRevision(project) {
  return Object.hasOwn(project || {}, "_cloudRevision")
    ? cloudRevisionValue(project._cloudRevision)
    : null;
}

function studioConflictError(projectId, expectedRevision, actualRevision) {
  const error = new Error(
    "This project changed in another Studio session. Save a copy or load the latest version before continuing.",
  );
  error.code = "studio/conflict";
  error.projectId = stringValue(projectId);
  error.expectedRevision = expectedRevision;
  error.actualRevision = actualRevision;
  return error;
}

function isMissingOrDenied(error) {
  return ["not-found", "permission-denied"].includes(
    stringValue(error?.code).replace(/^firestore\//, ""),
  );
}

function enumValue(value, allowed, fallback) {
  const normalized = stringValue(value);
  return allowed.includes(normalized) ? normalized : fallback;
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

function opacityValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(1, Math.max(0, number))
    : 1;
}

function rotationValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(360, Math.max(0, Math.round(number)))
    : 0;
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

function isScopedProjectAssetPath(path, projectId) {
  const cleanPath = stringValue(path);
  const prefix = `studio-projects/${stringValue(projectId)}/`;
  if (!cleanPath.startsWith(prefix)) return false;
  const assetName = cleanPath.slice(prefix.length);
  return assetName.length > 0 && !assetName.includes("/");
}

function isValidUnsplashReference(content) {
  return (
    stringValue(content.backgroundImageUrl).startsWith("https://") &&
    stringValue(content.unsplashPhotoId).length > 0 &&
    stringValue(content.unsplashPhotographerName).length > 0 &&
    stringValue(content.unsplashPhotographerUrl).startsWith("https://") &&
    stringValue(content.unsplashPhotoUrl).startsWith("https://")
  );
}

function isValidLibraryLogoReference(content) {
  const logoId = stringValue(content.heroLogoLibraryId);
  const path = stringValue(content.heroLogoStoragePath);
  return (
    /^[A-Za-z0-9_-]{1,80}$/.test(logoId) &&
    new RegExp(
      `^studio-library/logos/${logoId}/source[.](jpg|png|webp)$`,
    ).test(path) &&
    stringValue(content.heroLogoName).length > 0
  );
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

const DOCUMENT_PAGE_SERIALIZERS = Object.freeze({
  "document-one-pager": onePagerContentForCloud,
  "document-checklist": checklistContentForCloud,
  "document-signup-sheet": signupSheetContentForCloud,
  "document-directory": directoryContentForCloud,
  "document-content-page": contentPageContentForCloud,
});

function documentPageForCloud(page) {
  const templateId = Object.hasOwn(
    DOCUMENT_PAGE_SERIALIZERS,
    page?.templateId,
  )
    ? page.templateId
    : "document-one-pager";
  return {
    schemaVersion: 1,
    templateId,
    content: DOCUMENT_PAGE_SERIALIZERS[templateId](page?.content || {}),
  };
}

function eventContentForCloud(content, templateId, projectId) {
  const isSocial = isSocialTemplateId(templateId);
  const supportsHero = supportsHeroLogoTemplate(templateId);
  const requestedBackgroundSource = ["upload", "unsplash"].includes(
    content.backgroundImageSource,
  )
    ? content.backgroundImageSource
    : "";
  const source =
    requestedBackgroundSource === "upload" &&
    isScopedProjectAssetPath(content.backgroundImageStoragePath, projectId)
      ? "upload"
      : requestedBackgroundSource === "unsplash" &&
          isValidUnsplashReference(content)
        ? "unsplash"
        : "";
  const requestedHeroSource = supportsHero && ["upload", "library"].includes(
    content.heroLogoSource,
  )
    ? content.heroLogoSource
    : "";
  const heroSource =
    requestedHeroSource === "upload" &&
    isScopedProjectAssetPath(content.heroLogoStoragePath, projectId) &&
    stringValue(content.heroLogoName).length > 0
      ? "upload"
      : requestedHeroSource === "library" &&
          isValidLibraryLogoReference(content)
        ? "library"
        : "";
  const legacyFocal = legacyFocalPoint(content);
  const eyebrowVisible = content.eyebrowVisible !== false;
  const subtitleVisible = content.subtitleVisible !== false;
  return {
    eyebrow: stringValue(content.eyebrow),
    optionalTextVisibility: eyebrowVisible
      ? subtitleVisible
        ? "both"
        : "eyebrow"
      : subtitleVisible
        ? "subtitle"
        : "none",
    title: stringValue(content.title),
    subtitle: stringValue(content.subtitle),
    date: isSocial ? "" : stringValue(content.date),
    time: isSocial ? "" : stringValue(content.time),
    location: isSocial ? "" : stringValue(content.location),
    cta: stringValue(content.cta),
    format: isSocial
      ? content.format === "portrait"
        ? "portrait"
        : "square"
      : stringValue(content.format || "square"),
    composition: normalizeEventComposition(
      templateId,
      stringValue(content.composition || "editorial"),
    ),
    palette: stringValue(content.palette || "charcoal-red"),
    flatColor: stringValue(content.flatColor || "charcoal"),
    overlayColor: stringValue(content.overlayColor || "red"),
    overlayBlendMode: stringValue(content.overlayBlendMode || "multiply"),
    focalX: focalValue(content.focalX, legacyFocal.x),
    focalY: focalValue(content.focalY, legacyFocal.y),
    imageZoom: zoomValue(content.imageZoom),
    backgroundImageOpacity: opacityValue(content.backgroundImageOpacity),
    backgroundImageRotation: rotationValue(content.backgroundImageRotation),
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
    heroMode:
      supportsHero && content.heroMode === "logo" && heroSource ? "logo" : "text",
    heroLogoSource: heroSource,
    heroLogoLibraryId:
      heroSource === "library"
        ? stringValue(content.heroLogoLibraryId)
        : "",
    heroLogoStoragePath: heroSource
      ? stringValue(content.heroLogoStoragePath)
      : "",
    heroLogoName: heroSource
      ? stringValue(content.heroLogoName)
      : "",
    heroLogoScale: logoScaleValue(content.heroLogoScale),
    heroLogoClearSpace: logoClearSpaceValue(content.heroLogoClearSpace),
    fontKey: stringValue(content.fontKey || "montserrat"),
    fontWeight: enumValue(
      content.fontWeight,
      ["template", "thin", "light", "medium", "bold", "black"],
      "template",
    ),
    brandMark: enumValue(
      content.brandMark,
      ["central", "heart", "full"],
      "central",
    ),
    brandColor: enumValue(
      content.brandColor,
      ["auto", "white", "charcoal", "red"],
      "auto",
    ),
    textAlignment: stringValue(content.textAlignment || "left"),
    textShadow: Boolean(content.textShadow),
  };
}

export function socialSlideForCloud(slide, templateId, projectId) {
  return {
    schemaVersion: 1,
    content: eventContentForCloud(
      slide?.content || {},
      templateId,
      projectId,
    ),
  };
}

export function projectForCloud(project, ownerUid) {
  const revision = Math.max(1, projectCloudRevision(project) || 1);
  if (isDocumentProject(project)) {
    return {
      schemaVersion: 2,
      revision,
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
  const sourceType =
    isEventTemplateId(project.templateId) &&
    project.sourceType === "planning-center" &&
    /^\d{1,80}$/u.test(String(project.sourceId || "")) &&
    /^\d{1,80}$/u.test(String(project.sourceEventId || ""))
      ? "planning-center"
      : "manual";
  const requestedSourceDate = new Date(project.sourceUpdatedAt || "");
  const sourceUpdatedAt =
    sourceType === "planning-center" &&
    !Number.isNaN(requestedSourceDate.getTime())
      ? requestedSourceDate
      : null;
  const isSocial = isSocialTemplateId(project.templateId);
  return {
    schemaVersion: isSocial ? 3 : 1,
    revision,
    ownerUid,
    templateId: project.templateId,
    name: String(project.name || "").trim(),
    status: "draft",
    sourceType,
    ...(!isSocial
      ? {
          sourceId:
            sourceType === "planning-center" ? stringValue(project.sourceId) : "",
          sourceEventId:
            sourceType === "planning-center"
              ? stringValue(project.sourceEventId)
              : "",
          sourceUrl:
            sourceType === "planning-center" &&
            /^https:\/\//iu.test(String(project.sourceUrl || ""))
              ? stringValue(project.sourceUrl).slice(0, 500)
              : "",
          sourceUpdatedAt,
        }
      : {}),
    ...(isSocial
      ? {
          postMode: project.postMode === "carousel" ? "carousel" : "single",
          slideOrder: [
            "primary",
            ...(project.postMode === "carousel" &&
            Array.isArray(project.carouselSlides)
              ? project.carouselSlides
                  .slice(0, MAX_SOCIAL_CAROUSEL_SLIDES - 1)
                  .map((slide) => stringValue(slide?.id).slice(0, 128))
                  .filter(Boolean)
              : []),
          ],
        }
      : {}),
    ...(!isSocial
      ? {
          content: eventContentForCloud(
            project.content || {},
            project.templateId,
            project.id,
          ),
        }
      : {}),
  };
}

async function hydrateGraphicContent(content, storage) {
  const cloudContent = content || {};
  let backgroundImage = stringValue(cloudContent.backgroundImageUrl);
  let heroLogo = "";
  if (
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
  return {
    ...cloudContent,
    backgroundImage,
    heroLogo,
    focalX: focalValue(cloudContent.focalX, legacyFocalPoint(cloudContent).x),
    focalY: focalValue(cloudContent.focalY, legacyFocalPoint(cloudContent).y),
  };
}

async function hydrateDocumentPage(snapshot) {
  const data = snapshot.data();
  const cloudContent = data.content || {};
  let content = cloudContent;
  if (data.templateId === "document-one-pager") {
    content = {
      ...cloudContent,
      primaryItems: textToLines(cloudContent.primaryItemsText),
      secondaryItems: textToLines(cloudContent.secondaryItemsText),
      ownerItems: textToLines(cloudContent.ownerItemsText),
      processSteps: textToLines(cloudContent.processStepsText),
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
    const cardSnapshot = await snapshot.ref
      .collection("cards")
      .get(SERVER_READ_OPTIONS);
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
    const pageSnapshot = await snapshot.ref
      .collection("pages")
      .get(SERVER_READ_OPTIONS);
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
      _cloudRevision: cloudRevisionValue(data.revision, 0),
      shared,
      cloudBacked: true,
      documentSettings: data.documentSettings || {showPageNumbers: true},
      pages,
    });
  }

  const cloudContent = data.content || {};
  let content;
  const carouselSlides = [];
  if (
    isSocialTemplateId(data.templateId) &&
    data.schemaVersion === 3 &&
    Array.isArray(data.slideOrder) &&
    data.slideOrder.length
  ) {
    const slideSnapshot = await snapshot.ref
      .collection("slides")
      .get(SERVER_READ_OPTIONS);
    const slidesById = new Map(
      slideSnapshot.docs.map((slideDocument) => [
        slideDocument.id,
        slideDocument.data(),
      ]),
    );
    for (const slideId of data.slideOrder.slice(0, MAX_SOCIAL_CAROUSEL_SLIDES)) {
      const slideData = slidesById.get(slideId);
      if (!slideData?.content) continue;
      const hydratedSlide = {
        id: slideId,
        content: await hydrateGraphicContent(slideData.content, storage),
      };
      if (slideId === "primary") content = hydratedSlide.content;
      else carouselSlides.push(hydratedSlide);
    }
  }
  if (!content) {
    content =
      data.templateId === "policy-document"
        ? {
            ...cloudContent,
            primaryItems: textToLines(cloudContent.primaryItemsText),
            secondaryItems: textToLines(cloudContent.secondaryItemsText),
            ownerItems: textToLines(cloudContent.ownerItemsText),
            processSteps: textToLines(cloudContent.processStepsText),
          }
        : await hydrateGraphicContent(cloudContent, storage);
  }
  return migrateLegacyStudioProject({
    id: snapshot.id,
    templateId: data.templateId,
    name: data.name,
    status: data.status,
    sourceType: data.sourceType,
    sourceId: stringValue(data.sourceId),
    sourceEventId: stringValue(data.sourceEventId),
    sourceUrl: stringValue(data.sourceUrl),
    sourceUpdatedAt:
      data.sourceUpdatedAt?.toDate?.().toISOString() ||
      stringValue(data.sourceUpdatedAt),
    createdAt:
      data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    updatedAt:
      data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
    ownerUid: data.ownerUid,
    _cloudRevision: cloudRevisionValue(data.revision, 0),
    shared,
    cloudBacked: true,
    ...(isSocialTemplateId(data.templateId)
      ? {
          postMode: data.postMode === "carousel" ? "carousel" : "single",
          carouselSlides,
        }
      : {}),
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
    const error = new Error(
      data.error || "Central Studio could not complete that request.",
    );
    error.status = response.status;
    throw error;
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
    async loadPlanningCenterEvents() {
      return planningCenterEventsFromCentralData(
        await localPreviewJson("/api/studio/pco/events"),
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
  const projectSaveChains = new Map();
  const knownProjectMetadata = new Map();
  const deletedProjectIds = new Set();

  async function hydrateConsistentProject(snapshot, shared) {
    let candidate = snapshot;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const expectedRevision = cloudRevisionValue(
        candidate.data().revision,
        0,
      );
      const hydrated = await hydrateProject(candidate, storage, shared);
      const latest = await candidate.ref.get(SERVER_READ_OPTIONS);
      if (!latest.exists) return null;
      const actualRevision = cloudRevisionValue(latest.data().revision, 0);
      if (actualRevision === expectedRevision) return hydrated;
      candidate = latest;
    }
    throw studioConflictError(
      candidate.id,
      cloudRevisionValue(snapshot.data().revision, 0),
      cloudRevisionValue(candidate.data().revision, 0),
    );
  }

  async function loadProjects() {
    const ownedSnapshot = await firestore
      .collection(PROJECT_COLLECTION)
      .where("ownerUid", "==", user.uid)
      .get(SERVER_READ_OPTIONS);
    const membershipSnapshot = await firestore
      .collection(MEMBERSHIP_COLLECTION)
      .where("memberUid", "==", user.uid)
      .get(SERVER_READ_OPTIONS);
    const ownedIds = new Set(ownedSnapshot.docs.map((document) => document.id));
    const sharedSnapshots = await Promise.all(
      membershipSnapshot.docs
        .map((document) => document.data().projectId)
        .filter((projectId) => projectId && !ownedIds.has(projectId))
        .map((projectId) =>
          firestore
            .doc(`${PROJECT_COLLECTION}/${projectId}`)
            .get(SERVER_READ_OPTIONS),
        ),
    );
    const projects = await Promise.all([
      ...ownedSnapshot.docs.map((snapshot) =>
        hydrateConsistentProject(snapshot, false),
      ),
      ...sharedSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => hydrateConsistentProject(snapshot, true)),
    ]);
    const loadedProjects = projects.filter(Boolean);
    for (const project of loadedProjects) {
      knownProjectMetadata.delete(project.id);
    }
    return loadedProjects;
  }

  async function loadProject(projectId) {
    const reference = firestore.doc(
      `${PROJECT_COLLECTION}/${stringValue(projectId)}`,
    );
    let snapshot;
    try {
      snapshot = await reference.get(SERVER_READ_OPTIONS);
    } catch (error) {
      if (isMissingOrDenied(error)) return null;
      throw error;
    }
    if (!snapshot.exists) return null;
    const project = await hydrateConsistentProject(
      snapshot,
      snapshot.data().ownerUid !== user.uid,
    );
    if (project) knownProjectMetadata.delete(project.id);
    return project;
  }

  async function commitExistingProject(
    reference,
    projectId,
    expectedRevision,
    applyWrites,
  ) {
    if (expectedRevision === null) {
      const latest = await reference.get(SERVER_READ_OPTIONS);
      throw studioConflictError(
        projectId,
        null,
        latest.exists ? cloudRevisionValue(latest.data().revision, 0) : null,
      );
    }
    return firestore.runTransaction(async (transaction) => {
      const latest = await transaction.get(reference);
      const actualRevision = latest.exists
        ? cloudRevisionValue(latest.data().revision, 0)
        : null;
      if (!latest.exists || actualRevision !== expectedRevision) {
        throw studioConflictError(
          projectId,
          expectedRevision,
          actualRevision,
        );
      }
      const nextRevision = actualRevision + 1;
      applyWrites(transaction, latest.data(), nextRevision);
      return nextRevision;
    });
  }

  async function saveProjectNow(project, {knownExisting = false} = {}) {
    const reference = firestore.doc(`${PROJECT_COLLECTION}/${project.id}`);
    const shouldLoadExisting = knownExisting || project.cloudBacked === true;
    let snapshot = null;
    if (shouldLoadExisting) {
      try {
        snapshot = await reference.get(SERVER_READ_OPTIONS);
      } catch (error) {
        if (isMissingOrDenied(error)) {
          throw studioConflictError(
            project.id,
            projectCloudRevision(project),
            null,
          );
        }
        throw error;
      }
    }
    const projectExists = snapshot?.exists === true;
    const expectedRevision = projectCloudRevision(project);
    if (shouldLoadExisting && !projectExists) {
      throw studioConflictError(project.id, expectedRevision, null);
    }
    if (projectExists && expectedRevision === null) {
      throw studioConflictError(
        project.id,
        null,
        cloudRevisionValue(snapshot.data().revision, 0),
      );
    }
    const payload = projectForCloud(
      project,
      projectExists ? snapshot.data().ownerUid : user.uid,
    );
    const serverTimestamp =
      window.firebase.firestore.FieldValue.serverTimestamp();

    if (isDocumentProject(project)) {
      const previousData = projectExists ? snapshot.data() : null;
      const previousPageIds =
        previousData?.schemaVersion === 2 &&
        Array.isArray(previousData.pageOrder)
          ? previousData.pageOrder
          : [];
      const nextPages = (project.pages || []).slice(0, 20);
      const nextPageIds = new Set(payload.pageOrder);
      const pageIdsToRead = projectExists
        ? [...new Set([...previousPageIds, ...payload.pageOrder])]
        : [];
      const previousPageSnapshots = new Map(
        await Promise.all(
          pageIdsToRead.map(async (pageId) => {
            const pageReference = reference.collection("pages").doc(pageId);
            return [pageId, await pageReference.get(SERVER_READ_OPTIONS)];
          }),
        ),
      );
      const previousCardSnapshots = new Map(
        await Promise.all(
          [...previousPageSnapshots.entries()]
            .filter(([, pageSnapshot]) =>
              pageSnapshot.exists &&
              pageSnapshot.data().templateId === "document-directory",
            )
            .map(async ([pageId]) => {
              const cards = await reference
                .collection("pages")
                .doc(pageId)
                .collection("cards")
                .get(SERVER_READ_OPTIONS);
              return [pageId, cards];
            }),
        ),
      );
      const nextPagesById = new Map(nextPages.map((page) => [page.id, page]));
      const cardPageIds = new Set([
        ...previousCardSnapshots.keys(),
        ...nextPages
          .filter((page) => page.templateId === "document-directory")
          .map((page) => page.id),
      ]);
      const applyWrites = (writer, currentData, nextRevision) => {
        if (!projectExists) {
          writer.set(reference, {
            ...payload,
            revision: nextRevision,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        } else if (currentData.schemaVersion === 2) {
          writer.update(reference, {
            revision: nextRevision,
            name: payload.name,
            status: payload.status,
            sourceType: payload.sourceType,
            pageOrder: payload.pageOrder,
            documentSettings: payload.documentSettings,
            updatedAt: serverTimestamp,
          });
        } else {
          writer.set(reference, {
            ...payload,
            revision: nextRevision,
            createdAt: currentData.createdAt,
            updatedAt: serverTimestamp,
          });
        }

        for (const page of nextPages) {
          const pageReference = reference.collection("pages").doc(page.id);
          const pageSnapshot = previousPageSnapshots.get(page.id);
          const pagePayload = documentPageForCloud(page);
          if (pageSnapshot?.exists) {
            writer.update(pageReference, {
              templateId: pagePayload.templateId,
              content: pagePayload.content,
              updatedAt: serverTimestamp,
            });
          } else {
            writer.set(pageReference, {
              ...pagePayload,
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp,
            });
          }
        }

        for (const pageId of cardPageIds) {
          const page = nextPagesById.get(pageId);
          const cards =
            page?.templateId === "document-directory" &&
            Array.isArray(page.content?.cards)
              ? page.content.cards.slice(0, 8)
              : [];
          const previousCardIds = new Set(
            previousCardSnapshots.get(pageId)?.docs.map((card) => card.id) || [],
          );
          const nextCardIds = new Set(cards.map((card) => card.id));
          const pageReference = reference.collection("pages").doc(pageId);
          for (const card of cards) {
            const cardReference = pageReference.collection("cards").doc(card.id);
            const cardPayload = directoryCardForCloud(card);
            if (previousCardIds.has(card.id)) {
              writer.update(cardReference, {
                ...cardPayload,
                updatedAt: serverTimestamp,
              });
            } else {
              writer.set(cardReference, {
                ...cardPayload,
                createdAt: serverTimestamp,
                updatedAt: serverTimestamp,
              });
            }
          }
          for (const cardId of previousCardIds) {
            if (!nextCardIds.has(cardId)) {
              writer.delete(pageReference.collection("cards").doc(cardId));
            }
          }
        }

        for (const pageId of previousPageIds) {
          if (!nextPageIds.has(pageId)) {
            writer.delete(reference.collection("pages").doc(pageId));
          }
        }
      };
      let nextRevision;
      if (projectExists) {
        nextRevision = await commitExistingProject(
          reference,
          project.id,
          expectedRevision,
          applyWrites,
        );
      } else {
        nextRevision = 1;
        const batch = firestore.batch();
        applyWrites(batch, null, nextRevision);
        await batch.commit();
      }
      return {
        ...project,
        schemaVersion: 2,
        ownerUid: payload.ownerUid,
        cloudBacked: true,
        _cloudRevision: nextRevision,
      };
    }

    if (isSocialTemplateId(project.templateId)) {
      const previousData = projectExists ? snapshot.data() : null;
      const previousSlideSnapshot = projectExists
        ? await reference.collection("slides").get(SERVER_READ_OPTIONS)
        : null;
      const previousSlideIds = new Set(
        previousSlideSnapshot?.docs.map((slide) => slide.id) || [],
      );
      const nextSlides = [
        {id: "primary", content: project.content},
        ...(project.postMode === "carousel" &&
        Array.isArray(project.carouselSlides)
          ? project.carouselSlides.slice(0, MAX_SOCIAL_CAROUSEL_SLIDES - 1)
          : []),
      ];
      const nextSlideIds = new Set(payload.slideOrder);
      const applyWrites = (writer, currentData, nextRevision) => {
        if (!projectExists) {
          writer.set(reference, {
            ...payload,
            revision: nextRevision,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        } else if (currentData.schemaVersion === 3) {
          writer.update(reference, {
            revision: nextRevision,
            schemaVersion: payload.schemaVersion,
            name: payload.name,
            status: payload.status,
            sourceType: payload.sourceType,
            postMode: payload.postMode,
            slideOrder: payload.slideOrder,
            updatedAt: serverTimestamp,
          });
        } else {
          writer.set(reference, {
            ...payload,
            revision: nextRevision,
            createdAt: currentData.createdAt,
            updatedAt: serverTimestamp,
          });
        }
        for (const slide of nextSlides) {
          const slideId = stringValue(slide?.id).slice(0, 128);
          if (!nextSlideIds.has(slideId)) continue;
          const slideReference = reference.collection("slides").doc(slideId);
          const slidePayload = socialSlideForCloud(
            slide,
            project.templateId,
            project.id,
          );
          if (previousSlideIds.has(slideId)) {
            writer.update(slideReference, {
              content: slidePayload.content,
              updatedAt: serverTimestamp,
            });
          } else {
            writer.set(slideReference, {
              ...slidePayload,
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp,
            });
          }
        }
        for (const slideId of previousSlideIds) {
          if (!nextSlideIds.has(slideId)) {
            writer.delete(reference.collection("slides").doc(slideId));
          }
        }
      };
      let nextRevision;
      if (projectExists) {
        nextRevision = await commitExistingProject(
          reference,
          project.id,
          expectedRevision,
          applyWrites,
        );
      } else {
        nextRevision = 1;
        const batch = firestore.batch();
        applyWrites(batch, null, nextRevision);
        await batch.commit();
      }
      return {
        ...project,
        schemaVersion: 3,
        ownerUid: payload.ownerUid,
        cloudBacked: true,
        _cloudRevision: nextRevision,
      };
    }

    let nextRevision;
    if (projectExists) {
      nextRevision = await commitExistingProject(
        reference,
        project.id,
        expectedRevision,
        (transaction, currentData, revision) => {
          transaction.update(reference, {
            revision,
            name: payload.name,
            status: payload.status,
            sourceType: payload.sourceType,
            sourceId: payload.sourceId,
            sourceEventId: payload.sourceEventId,
            sourceUrl: payload.sourceUrl,
            sourceUpdatedAt: payload.sourceUpdatedAt,
            content: payload.content,
            updatedAt: serverTimestamp,
          });
        },
      );
    } else {
      nextRevision = 1;
      await reference.set({
        ...payload,
        revision: nextRevision,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
    }
    return {
      ...project,
      ownerUid: payload.ownerUid,
      cloudBacked: true,
      _cloudRevision: nextRevision,
    };
  }

  function rememberSavedProject(project) {
    knownProjectMetadata.set(project.id, {
      schemaVersion: project.schemaVersion,
      ownerUid: project.ownerUid,
      cloudBacked: true,
      shared: project.shared === true,
      _cloudRevision: projectCloudRevision(project),
    });
  }

  async function runProjectSave(project, options) {
    const known = knownProjectMetadata.get(project.id);
    const candidate = known
      ? {...project, ...known, cloudBacked: true}
      : project;
    const knownExisting = options.knownExisting === true || Boolean(known);
    try {
      const saved = await saveProjectNow(candidate, {knownExisting});
      rememberSavedProject(saved);
      return saved;
    } catch (error) {
      if (knownExisting || candidate.cloudBacked === true) throw error;
      let snapshot;
      try {
        snapshot = await firestore
          .doc(`${PROJECT_COLLECTION}/${project.id}`)
          .get(SERVER_READ_OPTIONS);
      } catch (readError) {
        throw error;
      }
      if (!snapshot.exists) throw error;
      throw studioConflictError(
        project.id,
        0,
        cloudRevisionValue(snapshot.data().revision, 0),
      );
    }
  }

  function enqueueProjectOperation(projectId, run) {
    if (deletedProjectIds.has(projectId)) {
      return Promise.reject(new Error("This Studio project is being deleted."));
    }
    const previous = projectSaveChains.get(projectId) || Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(run);
    projectSaveChains.set(projectId, operation);
    const clear = () => {
      if (projectSaveChains.get(projectId) === operation) {
        projectSaveChains.delete(projectId);
      }
    };
    operation.then(clear, clear);
    return operation;
  }

  function saveProject(project, options = {}) {
    const projectId = stringValue(project?.id);
    if (!projectId) {
      return Promise.reject(new Error("Studio projects require an ID before saving."));
    }
    if (deletedProjectIds.has(projectId)) {
      return Promise.reject(new Error("This Studio project is being deleted."));
    }
    return enqueueProjectOperation(projectId, () =>
      runProjectSave(project, options),
    );
  }

  async function ensureProjectExistsNow(project) {
    const known = knownProjectMetadata.get(project.id);
    const candidate = known
      ? {...project, ...known, cloudBacked: true}
      : project;
    if (candidate.cloudBacked === true) {
      const expectedRevision = projectCloudRevision(candidate);
      let snapshot;
      try {
        snapshot = await firestore
          .doc(`${PROJECT_COLLECTION}/${candidate.id}`)
          .get(SERVER_READ_OPTIONS);
      } catch (error) {
        if (isMissingOrDenied(error)) {
          throw studioConflictError(candidate.id, expectedRevision, null);
        }
        throw error;
      }
      const actualRevision = snapshot.exists
        ? cloudRevisionValue(snapshot.data().revision, 0)
        : null;
      if (!snapshot.exists || expectedRevision === null ||
          actualRevision !== expectedRevision) {
        throw studioConflictError(
          candidate.id,
          expectedRevision,
          actualRevision,
        );
      }
      return {
        ...candidate,
        ownerUid: snapshot.data().ownerUid,
        cloudBacked: true,
        _cloudRevision: expectedRevision,
      };
    }
    return runProjectSave(candidate, {});
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
    return enqueueProjectOperation(project.id, async () => {
      await ensureProjectExistsNow(project);
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
    });
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
    return enqueueProjectOperation(project.id, async () => {
      await ensureProjectExistsNow(project);
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
    });
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
    return enqueueProjectOperation(project.id, async () => {
      await ensureProjectExistsNow(project);
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
    });
  }

  async function removeProjectAfterPendingOperations(
    projectId,
    endpoint,
    {ignoreMissing = false} = {},
  ) {
    const cleanProjectId = stringValue(projectId);
    if (!cleanProjectId) throw new Error("Studio projects require an ID.");
    deletedProjectIds.add(cleanProjectId);
    const pending = projectSaveChains.get(cleanProjectId);
    if (pending) await pending.catch(() => undefined);
    try {
      const result = await authorizedJson(auth, endpoint, {
        method: "POST",
        body: JSON.stringify({projectId: cleanProjectId}),
      });
      knownProjectMetadata.delete(cleanProjectId);
      return result;
    } catch (error) {
      if (ignoreMissing && error.status === 404) {
        knownProjectMetadata.delete(cleanProjectId);
        return {projectId: cleanProjectId, missing: true};
      }
      deletedProjectIds.delete(cleanProjectId);
      throw error;
    }
  }

  return {
    loadProjects,
    loadProject,
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
    async loadPlanningCenterEvents() {
      return planningCenterEventsFromCentralData(
        await authorizedJson(auth, "/api/studio/pco/events"),
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
      return removeProjectAfterPendingOperations(
        projectId,
        "/api/studio/projects/leave",
      );
    },
    deleteProject(projectId, options = {}) {
      return removeProjectAfterPendingOperations(
        projectId,
        "/api/studio/projects/delete",
        options,
      );
    },
  };
}
