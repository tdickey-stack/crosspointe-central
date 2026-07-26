import {
  linesToText,
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

function policyContentForCloud(content) {
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
  return {
    schemaVersion: 1,
    ownerUid,
    templateId: project.templateId,
    name: String(project.name || "").trim(),
    status: "draft",
    sourceType: "manual",
    content:
      project.templateId === "policy-document"
        ? policyContentForCloud(project.content || {})
        : eventContentForCloud(project.content || {}, project.templateId),
  };
}

async function hydrateProject(snapshot, storage, shared = false) {
  const data = snapshot.data();
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
  return {
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
  };
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
