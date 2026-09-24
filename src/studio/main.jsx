import React, {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";

import {flushSync} from "react-dom";
import {getGraphicTextFields} from "./text-fields.js";
import {createLatestRequest, readStudioImage} from "./uploads.js";
import {DOCUMENT_FIELD_LIMITS, DOCUMENT_LINE_LIST_LIMITS} from "./document-fields.js";
import {StudioConflictMessage} from "./conflict-message.jsx";
import {markStudioProjectPending, applyStudioSaveSuccess, applyStudioSaveFailure, reconcileStudioProjects, createStudioSaveCoordinator} from "./save-coordinator.js";
import {createStudioBrowserCache} from "./browser-cache.js";
import {loadStudioExports} from "./export-loader.js";
const waitForPreviewMount = (timeoutMs = 8000) => new Promise((resolve, reject) => {
  let settled = false;
  const timeout = window.setTimeout(() => {
    settled = true;
    reject(new Error(
      "Studio timed out while preparing the export preview. Please try again.",
    ));
  }, timeoutMs);
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    resolve();
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
});
import {
  CREATIVE_FILENAME_PREFERENCE_KEY,
  buildCreativeFilename,
  validateCreativeFilenameForExport,
} from "./creative-filename.js";
import {
  normalizeFocalValue,
  normalizeImageOpacity,
  normalizeImageRotation,
  normalizeImageZoom,
} from "./focal.js";
import {
  createStudioCloud,
  createStudioPreviewUnsplash,
} from "./persistence.js";
import {
  DocumentPagePreview,
  EventPreview,
  StudioPreview,
} from "./previews.jsx";
import {
  planningCenterEventContentChanges,
  planningCenterEventSearchText,
} from "./planning-center-events.js";
import {
  BRAND_COLOR_OPTIONS,
  DOCUMENT_PAGE_TEMPLATES,
  EVENT_PALETTE_OPTIONS,
  GRAPHIC_BRAND_COLOR_OPTIONS,
  GRAPHIC_BRAND_MARK_OPTIONS,
  GRAPHIC_FONT_WEIGHT_OPTIONS,
  MAX_SOCIAL_CAROUSEL_SLIDES,
  STUDIO_STORAGE_KEY,
  TEMPLATE_CATALOG,
  createDocumentPage,
  createSocialCarouselSlide,
  createStudioProject,
  getEventCompositionOptions,
  getEventFontOptions,
  getProjectWarnings,
  getSocialProjectSlides,
  getTemplateById,
  isDocumentProject,
  isGraphicTemplateId,
  isSocialTemplateId,
  linesToText,
  migrateLegacyStudioProject,
  normalizeEventComposition,
  supportsHeroLogoTemplate,
  textToLines,
} from "./templates.js";
import "./studio.css";

const EDIT_PERMISSIONS = new Set(["propose", "edit", "approve", "admin"]);
const EVENT_FORMAT_OPTIONS = [
  {value: "square", label: "1:1"},
  {value: "portrait", label: "4:5"},
  {value: "screen", label: "16:9"},
];
const SOCIAL_FORMAT_OPTIONS = EVENT_FORMAT_OPTIONS.filter(
  (option) => option.value !== "screen",
);
const EVENT_BLEND_OPTIONS = [
  {value: "multiply", label: "Multiply"},
  {value: "screen", label: "Screen"},
  {value: "overlay", label: "Overlay"},
  {value: "soft-light", label: "Soft Light"},
];
const EVENT_PANEL_TRANSITION_MS = 720;

function loadCreativeFilenamePreference() {
  try {
    return window.localStorage.getItem(CREATIVE_FILENAME_PREFERENCE_KEY) === "true";
  } catch (_error) {
    return false;
  }
}

function useCreativeFilenamePreference() {
  const [enabled, setEnabled] = useState(loadCreativeFilenamePreference);
  const updateEnabled = (nextEnabled) => {
    setEnabled(nextEnabled);
    try {
      window.localStorage.setItem(
        CREATIVE_FILENAME_PREFERENCE_KEY,
        String(nextEnabled),
      );
    } catch (_error) {
      // Studio can still use the preference for this session when storage is blocked.
    }
  };
  return [enabled, updateEnabled];
}

function getStudioPermission(userData) {
  const pageAccess =
    userData && userData.pageAccess && typeof userData.pageAccess === "object"
      ? userData.pageAccess
      : {};
  const explicit = String(pageAccess.studio || "").trim().toLowerCase();
  if (explicit) return explicit;

  // Existing Central administrators predate the Studio permission. Settings is
  // the temporary migration fallback until their records are saved again.
  return String(pageAccess.settings || "none").trim().toLowerCase();
}

function isLocalFirebaseHost() {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    window.location.hostname,
  );
}

function getEmulatorHost() {
  const hostname = String(window.location.hostname || "").trim();
  return hostname === "[::1]" ? "::1" : hostname || "127.0.0.1";
}

function useStudioAuth() {
  const [authState, setAuthState] = useState({
    status: "loading",
    auth: null,
    user: null,
    userData: null,
    permission: "none",
    message: "Connecting Studio to Central.",
  });

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    async function initialize() {
      const localPreviewEnabled =
        isLocalFirebaseHost() &&
        new URLSearchParams(window.location.search).get("preview") === "1";
      if (localPreviewEnabled) {
        setAuthState({
          status: "ready",
          auth: null,
          firestore: null,
          storage: null,
          user: {
            uid: "studio-local-preview",
            email: "studio-preview@crosspointe.tv",
            displayName: "Studio Preview",
            photoURL: "",
          },
          userData: {
            active: true,
            pageAccess: {studio: "admin"},
          },
          permission: "admin",
          message: "Local Studio preview access confirmed.",
        });
        return;
      }

      try {
        await window.CENTRAL_STUDIO_FIREBASE_READY;
        if (!window.firebase || !window.firebase.apps) {
          throw new Error(
            "Firebase did not load. Open Studio through Firebase Hosting or the Emulator Suite.",
          );
        }

        const app = window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(window.__FIREBASE_DEFAULTS__ || {});
        const auth = window.firebase.auth(app);
        const firestore = window.firebase.firestore(app);
        const storage = window.firebase.storage(app);

        if (isLocalFirebaseHost()) {
          const host = getEmulatorHost();
          try {
            auth.useEmulator(`http://${host === "::1" ? "[::1]" : host}:9099`);
          } catch (error) {
            // The SDK throws when an emulator has already been connected.
          }
          try {
            firestore.useEmulator(host, 8080);
          } catch (error) {
            // The SDK throws when an emulator has already been connected.
          }
          try {
            storage.useEmulator(host, 9199);
          } catch (error) {
            // The SDK throws when an emulator has already been connected.
          }
        }

        try {
          await auth.getRedirectResult();
        } catch (error) {
          if (active) {
            setAuthState({
              status: "error",
              auth,
              user: null,
              userData: null,
              permission: "none",
              message: error.message || "Google sign-in could not be completed.",
            });
          }
        }

        unsubscribe = auth.onAuthStateChanged(async (user) => {
          if (!active) return;

          if (!user) {
            setAuthState({
              status: "signed-out",
              auth,
              user: null,
              userData: null,
              permission: "none",
              message: "Sign in with your Central admin account to use Studio.",
            });
            return;
          }

          setAuthState((current) => ({
            ...current,
            status: "loading",
            auth,
            user,
            message: "Checking your Studio access.",
          }));

          try {
            const snapshot = await firestore
              .doc(`centralAdmin/root/users/${user.uid}`)
              .get();
            const userData = snapshot.exists ? snapshot.data() : null;
            const permission = getStudioPermission(userData);
            const authorized =
              userData && userData.active === true && permission !== "none";

            setAuthState({
              status: authorized ? "ready" : "unauthorized",
              auth,
              firestore,
              storage,
              user,
              userData,
              permission,
              message: authorized
                ? "Studio access confirmed."
                : "This account does not currently have Studio access.",
            });
          } catch (error) {
            setAuthState({
              status: "error",
              auth,
              user,
              userData: null,
              permission: "none",
              message:
                error.message || "Studio could not load your Central access.",
            });
          }
        });
      } catch (error) {
        if (!active) return;
        setAuthState({
          status: "error",
          auth: null,
          user: null,
          userData: null,
          permission: "none",
          message: error.message || "Studio could not initialize.",
        });
      }
    }

    initialize();
    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return authState;
}

const STUDIO_RECOVERY_STORAGE_KEY = `${STUDIO_STORAGE_KEY}:recovery`;

function studioAccountStorageKey(actorUid) {
  return `${STUDIO_STORAGE_KEY}:account:${encodeURIComponent(String(actorUid || ""))}`;
}

function loadProjects(storageKey = STUDIO_STORAGE_KEY) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored)
      ? stored.map(migrateLegacyStudioProject)
      : [];
  } catch (error) {
    return [];
  }
}

function prepareProjectForStorage(project) {
  const stored = JSON.parse(JSON.stringify(project));
  const stripGraphicDataUrls = (content) => {
    if (String(content?.backgroundImage || "").startsWith("data:")) {
      content.backgroundImage = "";
      if (!content.backgroundImageStoragePath) {
        content.backgroundImageSource = "";
      }
    }
    if (String(content?.heroLogo || "").startsWith("data:")) {
      content.heroLogo = "";
      if (!content.heroLogoStoragePath) {
        content.heroMode = "text";
        content.heroLogoSource = "";
        content.heroLogoLibraryId = "";
        content.heroLogoName = "";
      }
    }
  };
  if (isGraphicTemplateId(stored.templateId) && stored.content) {
    stripGraphicDataUrls(stored.content);
    (stored.carouselSlides || []).forEach((slide) =>
      stripGraphicDataUrls(slide.content),
    );
  }
  if (isDocumentProject(stored)) {
    (stored.pages || []).forEach((page) => {
      if (page.templateId !== "document-directory") return;
      (page.content?.cards || []).forEach((card) => {
        if (String(card.imageUrl || "").startsWith("data:")) {
          card.imageUrl = "";
          card.imageStoragePath = "";
        }
      });
    });
  }
  return stored;
}

function persistProjects(projects, storageKey = STUDIO_STORAGE_KEY) {
  const safeProjects = projects.map(prepareProjectForStorage);
  localStorage.setItem(storageKey, JSON.stringify(safeProjects));
}

function browserProjectIdentity(project) {
  return String(
    project?._studioSync?.actorUid || project?.ownerUid || "unattributed",
  );
}

function browserProjectKey(project) {
  return `${browserProjectIdentity(project)}:${project.id}:${project._studioSync?.changeId || ""}`;
}

function isRecoverableBrowserProject(project, actorUid) {
  const identity = browserProjectIdentity(project);
  return identity === "unattributed" || identity === actorUid;
}

function newerProject(left, right) {
  const leftTime = new Date(left?.updatedAt || "").getTime() || 0;
  const rightTime = new Date(right?.updatedAt || "").getTime() || 0;
  return rightTime > leftTime ? right : left;
}

function dedupeBrowserProjects(projects, {includeIdentity = true} = {}) {
  const byKey = new Map();
  for (const project of projects) {
    if (!project?.id) continue;
    const key = includeIdentity
      ? browserProjectKey(project)
      : project.id;
    byKey.set(key, byKey.has(key) ? newerProject(byKey.get(key), project) : project);
  }
  return [...byKey.values()];
}

function partitionBrowserProjects(projects, actorUid) {
  const current = [];
  const unattributed = [];
  const foreign = [];
  for (const project of dedupeBrowserProjects(projects)) {
    const marker = String(project?._studioSync?.actorUid || "");
    const owner = String(project?.ownerUid || "");
    if (marker === actorUid || (!marker && owner === actorUid)) {
      current.push(project);
    } else if (!marker && !owner) {
      unattributed.push(project);
    } else {
      foreign.push(project);
    }
  }
  return {current, unattributed, foreign};
}

function recoveredProjectCopy(project) {
  const recovered = JSON.parse(JSON.stringify(project));
  const previousId = recovered.id;
  recovered.id = `studio-${
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }`;
  recovered.name = `${String(recovered.name || "Untitled project").slice(0, 68)} (Recovered)`;
  recovered.createdAt = new Date().toISOString();
  recovered.updatedAt = recovered.createdAt;
  recovered.cloudBacked = false;
  recovered.shared = false;
  delete recovered.ownerUid;
  delete recovered._studioSync;
  delete recovered._cloudRevision;

  const clearProjectAssets = (content) => {
    if (!content) return;
    if (
      content.backgroundImageSource === "upload" ||
      String(content.backgroundImageStoragePath || "").startsWith(
        `studio-projects/${previousId}/`,
      )
    ) {
      content.backgroundImage = "";
      content.backgroundImageSource = "";
      content.backgroundImageUrl = "";
      content.backgroundImageStoragePath = "";
      content.unsplashPhotoId = "";
      content.unsplashPhotographerName = "";
      content.unsplashPhotographerUrl = "";
      content.unsplashPhotoUrl = "";
    }
    if (
      content.heroLogoSource === "upload" ||
      String(content.heroLogoStoragePath || "").startsWith(
        `studio-projects/${previousId}/`,
      )
    ) {
      content.heroMode = "text";
      content.heroLogo = "";
      content.heroLogoSource = "";
      content.heroLogoLibraryId = "";
      content.heroLogoStoragePath = "";
      content.heroLogoName = "";
    }
  };
  clearProjectAssets(recovered.content);
  (recovered.carouselSlides || []).forEach((slide) =>
    clearProjectAssets(slide.content),
  );
  (recovered.pages || []).forEach((page) => {
    if (page.templateId !== "document-directory") return;
    (page.content?.cards || []).forEach((card) => {
      if (card.imageStoragePath) {
        card.imageUrl = "";
        card.imageStoragePath = "";
      }
    });
  });
  return recovered;
}

function StudioLogo() {
  return (
    <a className="studio-brand" href="/studio" aria-label="Central Studio home">
      <img src="/favicon.svg" alt="" />
      <span>
        <strong>Central</strong>
        <b>Studio</b>
      </span>
    </a>
  );
}

function AccessScreen({authState}) {
  const signIn = async () => {
    if (!authState.auth) return;
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt: "select_account"});
    try {
      await authState.auth.signInWithPopup(provider);
    } catch (error) {
      const code = String(error && error.code ? error.code : "");
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await authState.auth.signInWithRedirect(provider);
      }
    }
  };

  const isLoading = authState.status === "loading";
  const isUnauthorized = authState.status === "unauthorized";

  return (
    <main className="studio-access-shell">
      <div className="studio-access-card">
        <StudioLogo />
        <div className="studio-access-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="studio-kicker">
          {isLoading
            ? "CONNECTING"
            : isUnauthorized
              ? "ACCESS REQUIRED"
              : authState.status === "error"
                ? "STUDIO NEEDS ATTENTION"
                : "CREATIVE WORKSPACE"}
        </span>
        <h1>
          {isLoading
            ? "Preparing your workspace"
            : isUnauthorized
              ? "Studio is not enabled for this account"
              : authState.status === "error"
                ? "Studio could not start"
                : "Create with clarity"}
        </h1>
        <p>{authState.message}</p>
        <div className="studio-access-actions">
          {authState.status === "signed-out" ? (
            <button className="studio-button is-primary" onClick={signIn}>
              Sign in with Google
            </button>
          ) : null}
          <a className="studio-button is-secondary" href="/admin">
            Back to Central Admin
          </a>
        </div>
      </div>
    </main>
  );
}

function StatusPill({children, tone = ""}) {
  return (
    <span className={`studio-status-pill${tone ? ` is-${tone}` : ""}`}>
      {children}
    </span>
  );
}

function StudioNavigationMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="studio-navigation-menu" ref={menuRef}>
      <button
        className="studio-navigation-button"
        type="button"
        aria-label="Open Studio navigation"
        aria-expanded={open}
        aria-controls="studio-navigation-links"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open ? (
        <nav
          className="studio-navigation-links"
          id="studio-navigation-links"
          aria-label="Central navigation"
        >
          <a href="/" onClick={() => setOpen(false)}>Central</a>
          <a href="/admin" onClick={() => setOpen(false)}>Admin</a>
          <a href="/planner" onClick={() => setOpen(false)}>Planner</a>
        </nav>
      ) : null}
    </div>
  );
}

function StudioHeader({authState, view, onHome, saveState}) {
  return (
    <header className="studio-app-header">
      <div className="studio-header-leading">
        <StudioNavigationMenu />
        <StudioLogo />
      </div>
      <div className="studio-header-context">
        {view === "editor" ? (
          <button className="studio-back-button" onClick={onHome}>
            <span aria-hidden="true">←</span>
            Projects
          </button>
        ) : (
          <StatusPill tone="prototype">LOCAL FOUNDATION</StatusPill>
        )}
      </div>
      <div className="studio-header-actions">
        {view === "editor" && saveState ? (
          <span className="studio-save-state">{saveState}</span>
        ) : null}
        <div className="studio-user-chip">
          {authState.user && authState.user.photoURL ? (
            <img src={authState.user.photoURL} alt="" />
          ) : (
            <span>{String(authState.user?.email || "U").charAt(0)}</span>
          )}
          <div>
            <strong>
              {authState.user?.displayName ||
                authState.user?.email ||
                "Central User"}
            </strong>
            <small>{authState.permission} access</small>
          </div>
        </div>
        <a className="studio-icon-button" href="/admin" title="Central Admin">
          Admin
        </a>
      </div>
    </header>
  );
}

function TemplateArtwork({templateId}) {
  const template = getTemplateById(templateId);
  const previewProject = useMemo(() => {
    const project = createStudioProject(templateId);
    if (!["event", "social"].includes(template.kind)) return project;

    return {
      ...project,
      content: {
        ...project.content,
        eyebrow: template.previewCopy.eyebrow,
        title: template.previewCopy.title,
        subtitle: template.previewCopy.subtitle || project.content.subtitle,
        date: template.previewCopy.date || project.content.date,
        cta: template.previewCopy.footer,
      },
    };
  }, [template, templateId]);

  return (
    <div
      className={[
        "studio-template-art",
        "is-real-template",
        `is-${template.kind}`,
        template.variant ? `is-${template.variant}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="studio-template-preview-frame">
        <StudioPreview project={previewProject} previewRef={null} />
      </div>
    </div>
  );
}

function StudioProjectRow({
  project,
  canCreate,
  onOpen,
  onDelete,
  isCollapsedEnd = false,
}) {
  const template = getTemplateById(project.templateId);
  const projectDetail = isDocumentProject(project)
    ? `${project.pages?.length || 0} page${project.pages?.length === 1 ? "" : "s"}`
    : isSocialTemplateId(project.templateId) && project.postMode === "carousel"
      ? `${getSocialProjectSlides(project).length} slides · ${template.name}`
      : template.name;

  return (
    <div
      className={`studio-project-row${isCollapsedEnd ? " is-collapsed-end" : ""}`}
    >
      <button
        className="studio-project-open"
        onClick={() => onOpen(project.id)}
      >
        <span className={`studio-project-icon is-${template.accent}`}>
          {template.shortName.charAt(0)}
        </span>
        <span className="studio-project-copy">
          <strong>{project.name}</strong>
          <small>
            {projectDetail} · {project.shared ? "Shared with you · " : ""}
            Updated {new Date(project.updatedAt).toLocaleDateString()}
          </small>
        </span>
        <StatusPill>{project.status || "draft"}</StatusPill>
        <span className="studio-project-arrow" aria-hidden="true">
          →
        </span>
      </button>
      {canCreate ? (
        <button
          className="studio-project-delete"
          onClick={() => onDelete(project.id)}
          aria-label={`${project.shared ? "Leave" : "Delete"} ${project.name}`}
          title={project.shared ? "Leave shared project" : "Delete project"}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function StudioHome({
  projects,
  canCreate,
  onCreate,
  onOpen,
  onDelete,
  cloudEnabled,
}) {
  const [templateFilter, setTemplateFilter] = useState("all");
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
    ),
    [projects],
  );
  const recentProjects = sortedProjects.slice(0, 3);
  const additionalProjects = sortedProjects.slice(3);
  const visibleTemplates = useMemo(
    () =>
      TEMPLATE_CATALOG.filter(
        (template) =>
          templateFilter === "all" || template.kind === templateFilter,
      ),
    [templateFilter],
  );

  return (
    <main className="studio-home">
      <section className="studio-home-hero">
        <div>
          <span className="studio-kicker">CENTRAL STUDIO</span>
          <h1>Make the work clear.<br />Keep the brand strong.</h1>
          <p>
            Start with a controlled CrossPointe template, shape the approved
            content, and review the real composition as you work.
          </p>
        </div>
        <div className="studio-home-hero-mark" aria-hidden="true">
          <span className="is-one" />
          <span className="is-two" />
          <span className="is-three" />
          <i />
        </div>
      </section>

      <section className="studio-home-section studio-recent-projects-section">
        <div className="studio-section-heading">
          <div>
            <span className="studio-kicker">YOUR WORK</span>
            <h2>Recent projects</h2>
          </div>
          <span className="studio-browser-save-note">
            {cloudEnabled
              ? "Saved to each user’s Central Studio account"
              : "Saved in this browser for local preview"}
          </span>
        </div>

        {sortedProjects.length ? (
          <>
            <div
              className={`studio-project-list${projectsExpanded ? " is-expanded" : ""}`}
            >
              {recentProjects.map((project, index) => (
                <StudioProjectRow
                  key={project.id}
                  project={project}
                  canCreate={canCreate}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  isCollapsedEnd={
                    !projectsExpanded &&
                    additionalProjects.length > 0 &&
                    index === recentProjects.length - 1
                  }
                />
              ))}
              {additionalProjects.length ? (
                <div
                  id="studio-additional-projects"
                  className={`studio-project-overflow${
                    projectsExpanded ? " is-expanded" : ""
                  }`}
                  aria-hidden={projectsExpanded ? undefined : "true"}
                  inert={!projectsExpanded}
                >
                  <div className="studio-project-overflow-inner">
                    {additionalProjects.map((project) => (
                      <StudioProjectRow
                        key={project.id}
                        project={project}
                        canCreate={canCreate}
                        onOpen={onOpen}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {additionalProjects.length ? (
              <div className="studio-project-more-wrap">
                <button
                  type="button"
                  className="studio-project-more-button"
                  aria-expanded={projectsExpanded}
                  aria-controls="studio-additional-projects"
                  onClick={() => setProjectsExpanded((expanded) => !expanded)}
                >
                  <span>{projectsExpanded ? "Show Less" : "See More"}</span>
                  <small>
                    {additionalProjects.length} more project
                    {additionalProjects.length === 1 ? "" : "s"}
                  </small>
                  <i aria-hidden="true">⌄</i>
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="studio-empty-projects">
            <span>01</span>
            <div>
              <h3>Your first project starts below.</h3>
              <p>
                Choose a document, event graphic, or social post to open the
                Studio workspace.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="studio-home-section">
        <div className="studio-section-heading">
          <div>
            <span className="studio-kicker">START SOMETHING</span>
            <h2>Approved starting templates</h2>
          </div>
          {!canCreate ? (
            <StatusPill tone="warning">VIEW ONLY</StatusPill>
          ) : null}
        </div>

        <div
          className="studio-template-filters"
          role="group"
          aria-label="Filter starting templates"
        >
          {[
            {value: "all", label: "All Templates"},
            {value: "document", label: "Documents"},
            {value: "event", label: "Event Graphics"},
            {value: "social", label: "Social Posts"},
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={templateFilter === filter.value ? "is-active" : ""}
              aria-pressed={templateFilter === filter.value}
              onClick={() => setTemplateFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="studio-template-grid">
          {visibleTemplates.map((template) => (
            <article className="studio-template-card" key={template.id}>
              <TemplateArtwork templateId={template.id} />
              <div className="studio-template-card-body">
                <div className="studio-template-card-title">
                  <div>
                    <span>{template.status}</span>
                    <h3>{template.name}</h3>
                  </div>
                  <StatusPill>{template.formats.join(" · ")}</StatusPill>
                </div>
                <p>{template.description}</p>
                {["event", "social"].includes(template.kind) ? (
                  <div
                    className="studio-template-fonts"
                    aria-label={`${template.name} font choices`}
                  >
                    {template.fonts.map((font) => (
                      <span
                        key={font.value}
                        style={{fontFamily: `"${font.family}", sans-serif`}}
                      >
                        {font.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <button
                  className="studio-button is-primary"
                  disabled={!canCreate}
                  onClick={() => onCreate(template.id)}
                >
                  Use Template
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="studio-print-mode-note">
        <div>
          <span className="studio-kicker">PRINT WORK STAYS FOCUSED</span>
          <h2>Flyers and bulletin inserts remain in Print Mode.</h2>
          <p>
            Studio is not duplicating those tools in this milestone. They can
            move into this template system later while Print Mode keeps the
            same familiar output.
          </p>
        </div>
        <a className="studio-button is-secondary" href="/admin/bulletin">
          Open Print Mode
        </a>
      </aside>
    </main>
  );
}

function Field({label, hint, children, wide = false}) {
  return (
    <label className={`studio-field${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  hint,
  maxLength,
  type = "text",
  wide = false,
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input
        type={type}
        value={value || ""}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  maxLength,
  wide = true,
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <textarea
        value={value || ""}
        rows={rows}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function LineListField({
  label,
  items,
  draftValue,
  onChange,
  maximum,
  maxLength,
  rows,
  hint,
}) {
  const value =
    typeof draftValue === "string" ? draftValue : linesToText(items);

  return (
    <TextareaField
      label={label}
      value={value}
      onChange={(nextValue) =>
        onChange({
          draftValue: nextValue,
          items: textToLines(nextValue),
        })
      }
      rows={rows}
      maxLength={maxLength}
      hint={maximum && textToLines(value).length > maximum
        ? `This layout supports ${maximum} items. Remove the extra lines before exporting.`
        : hint}
    />
  );
}

function ToggleField({label, description, checked, onChange}) {
  return (
    <label className="studio-toggle-field">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function clampFocalPoint(value) {
  return normalizeFocalValue(value);
}

function ImageFocalPointEditor({content, updateContent}) {
  const draggingRef = useRef(false);
  const focalX = clampFocalPoint(Number(content.focalX ?? 50));
  const focalY = clampFocalPoint(Number(content.focalY ?? 50));
  const imageZoom = normalizeImageZoom(content.imageZoom);
  const imageOpacity = normalizeImageOpacity(content.backgroundImageOpacity);
  const imageRotation = normalizeImageRotation(
    content.backgroundImageRotation,
  );

  const rotateImage = (degrees) => {
    updateContent({
      backgroundImageRotation: (imageRotation + degrees + 360) % 360,
    });
  };

  const setFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    updateContent({
      focalX: clampFocalPoint(
        ((event.clientX - bounds.left) / bounds.width) * 100,
      ),
      focalY: clampFocalPoint(
        ((event.clientY - bounds.top) / bounds.height) * 100,
      ),
    });
  };

  const startDragging = (event) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event);
  };

  const moveTarget = (event) => {
    if (!draggingRef.current) return;
    setFromPointer(event);
  };

  const stopDragging = (event) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudgeTarget = (event) => {
    const step = event.shiftKey ? 10 : 2;
    const changes = {};
    if (event.key === "ArrowLeft") changes.focalX = focalX - step;
    if (event.key === "ArrowRight") changes.focalX = focalX + step;
    if (event.key === "ArrowUp") changes.focalY = focalY - step;
    if (event.key === "ArrowDown") changes.focalY = focalY + step;
    if (event.key === "Home") {
      changes.focalX = 50;
      changes.focalY = 50;
    }
    if (!Object.keys(changes).length) return;
    event.preventDefault();
    updateContent(
      Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [
          key,
          clampFocalPoint(value),
        ]),
      ),
    );
  };

  return (
    <div className="studio-focal-editor">
      <div className="studio-focal-heading">
        <div>
          <strong>Image focal point</strong>
          <small>
            Drag the target onto the subject Studio should preserve when the
            format changes.
          </small>
        </div>
        <button
          type="button"
          onClick={() => updateContent({focalX: 50, focalY: 50})}
        >
          Reset center
        </button>
      </div>
      <div
        className={`studio-focal-image is-${content.format || "square"}`}
        style={{
          backgroundImage: `url("${content.backgroundImage}")`,
        }}
        onPointerDown={startDragging}
        onPointerMove={moveTarget}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <button
          className="studio-focal-target"
          type="button"
          style={{left: `${focalX}%`, top: `${focalY}%`}}
          aria-label={`Image focal point: ${Math.round(
            focalX,
          )} percent horizontal and ${Math.round(focalY)} percent vertical`}
          title="Drag to set the image focal point. Use arrow keys to fine tune."
          onKeyDown={nudgeTarget}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div className="studio-focal-coordinates" aria-hidden="true">
        <span>Horizontal {Math.round(focalX)}%</span>
        <span>Vertical {Math.round(focalY)}%</span>
      </div>
      <label className="studio-image-range">
        <span>
          Image zoom <strong>{Math.round(imageZoom * 100)}%</strong>
        </span>
        <input
          type="range"
          min="1"
          max="2"
          step="0.05"
          value={imageZoom}
          onChange={(event) =>
            updateContent({
              imageZoom: normalizeImageZoom(event.target.value),
            })
          }
        />
      </label>
      <label className="studio-image-range">
        <span>
          Image opacity <strong>{Math.round(imageOpacity * 100)}%</strong>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={imageOpacity}
          onChange={(event) =>
            updateContent({
              backgroundImageOpacity: normalizeImageOpacity(
                event.target.value,
              ),
            })
          }
        />
        <small>
          Lower the image opacity to reveal the template palette underneath.
        </small>
      </label>
      <label className="studio-image-range">
        <span>
          Image rotation <strong>{imageRotation}°</strong>
        </span>
        <input
          type="range"
          min="0"
          max="360"
          step="1"
          value={imageRotation}
          onChange={(event) =>
            updateContent({
              backgroundImageRotation: normalizeImageRotation(
                event.target.value,
              ),
            })
          }
        />
      </label>
      <div className="studio-image-rotation-actions">
        <button
          type="button"
          onClick={() => rotateImage(-90)}
          aria-label="Rotate background 90 degrees counterclockwise"
        >
          ↶ 90°
        </button>
        <button
          type="button"
          onClick={() => updateContent({backgroundImageRotation: 0})}
          disabled={imageRotation === 0 || imageRotation === 360}
        >
          Reset rotation
        </button>
        <button
          type="button"
          onClick={() => rotateImage(90)}
          aria-label="Rotate background 90 degrees clockwise"
        >
          90° ↷
        </button>
      </div>
      <p className="studio-focal-note">
        Focal movement only appears where the cropped image has room to move.
        Increase zoom when an axis feels locked.
      </p>
    </div>
  );
}

function EventQuickToolbar({
  content,
  updateContent,
  templateId,
  selectedField,
  onSelectField,
  activePanel,
  onPanelChange,
}) {
  const isSocial = isSocialTemplateId(templateId);
  const template = getTemplateById(templateId);
  const isSmallGroupLeader = template.variant === "small-group-leader";
  const supportsHeroLogo = supportsHeroLogoTemplate(templateId);
  const alignment = content.textAlignment || "left";
  const fontOptions = getEventFontOptions(templateId);
  const compositionOptions = getEventCompositionOptions(templateId);
  const selectedComposition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  const textFieldOptions = getGraphicTextFields(template);
  const selectedTextOption = textFieldOptions[selectedField];
  return (
    <div className="studio-event-toolbar-shell">
      {selectedTextOption ? (
        <div className="studio-event-context-tray is-text">
          <div className="studio-context-heading">
            <div>
              <span>SELECTED TEXT</span>
              <strong>{selectedTextOption.label}</strong>
            </div>
            <div className="studio-template-lock-note">
              <span aria-hidden="true">⌁</span>
              Position set by template
            </div>
            <button
              type="button"
              aria-label="Clear text selection"
              onClick={() => onSelectField("")}
            >
              ×
            </button>
          </div>
          <label className="studio-context-text-field">
            <span className="studio-visually-hidden">
              {selectedTextOption.label}
            </span>
            {selectedTextOption.multiline ? (
              <textarea
                rows="2"
                maxLength={selectedTextOption.maximum}
                value={content[selectedField] || ""}
                onChange={(event) =>
                  updateContent({[selectedField]: event.target.value})
                }
              />
            ) : (
              <input
                type="text"
                maxLength={selectedTextOption.maximum}
                value={content[selectedField] || ""}
                onChange={(event) =>
                  updateContent({[selectedField]: event.target.value})
                }
              />
            )}
            <small>
              {String(content[selectedField] || "").length}/
              {selectedTextOption.maximum}
            </small>
          </label>
        </div>
      ) : null}

      <div
        className="studio-event-toolbar"
        aria-label={
          isSocial
            ? "Social post design controls"
            : isSmallGroupLeader
              ? "Small Group leader design controls"
              : "Event design controls"
        }
      >
        <div className="studio-toolbar-selection">
          <span>{selectedTextOption ? "TEXT" : "CANVAS"}</span>
          <strong>
            {selectedTextOption?.label || "Template controls"}
          </strong>
        </div>

        {supportsHeroLogo && !isSmallGroupLeader ? (
          <button
            className={[
              "studio-toolbar-tool",
              activePanel === "hero" ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            aria-expanded={activePanel === "hero"}
            onClick={() =>
              onPanelChange(activePanel === "hero" ? "" : "hero")
            }
          >
            <span aria-hidden="true">◇</span>
            Hero
          </button>
        ) : null}

        <button
          className={[
            "studio-toolbar-tool",
            activePanel === "background" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-expanded={activePanel === "background"}
          onClick={() =>
            onPanelChange(activePanel === "background" ? "" : "background")
          }
        >
          <span aria-hidden="true">▧</span>
          Background
        </button>

        {!isSmallGroupLeader ? (
          <div className="studio-toolbar-divider" aria-hidden="true" />
        ) : null}

        {!isSmallGroupLeader ? (
          <div className="studio-toolbar-group is-alignment">
            <span>Alignment · entire design</span>
            {[
              {value: "left", label: "Left", glyph: "≡"},
              {value: "center", label: "Center", glyph: "≡"},
              {value: "right", label: "Right", glyph: "≡"},
            ].map((option) => (
              <button
                key={option.value}
                className={[
                  alignment === option.value ? "is-active" : "",
                  `is-${option.value}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                aria-label={`Align all template text ${option.value}`}
                aria-pressed={alignment === option.value}
                onClick={() => updateContent({textAlignment: option.value})}
              >
                {option.glyph}
              </button>
            ))}
            <button
              className={content.textShadow ? "is-active" : ""}
              type="button"
              aria-label="Toggle text drop shadow"
              aria-pressed={Boolean(content.textShadow)}
              title="Text drop shadow"
              onClick={() => updateContent({textShadow: !content.textShadow})}
            >
              S
            </button>
          </div>
        ) : null}

        <label>
          <span>Brand mark</span>
          <select
            value={content.brandMark || "central"}
            onChange={(event) => updateContent({brandMark: event.target.value})}
          >
            {GRAPHIC_BRAND_MARK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Brand color</span>
          <select
            value={content.brandColor || "auto"}
            onChange={(event) => updateContent({brandColor: event.target.value})}
          >
            {GRAPHIC_BRAND_COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>
            {isSocial
              ? "Message font"
              : isSmallGroupLeader
                ? "Group font"
                : "Title font"}
          </span>
          <select
            value={content.fontKey || fontOptions[0]?.value || "montserrat"}
            onChange={(event) => updateContent({fontKey: event.target.value})}
          >
            {fontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Global weight</span>
          <select
            value={content.fontWeight || "template"}
            onChange={(event) => updateContent({fontWeight: event.target.value})}
          >
            {GRAPHIC_FONT_WEIGHT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {isSmallGroupLeader ? (
          <div className="studio-toolbar-fixed-value">
            <span>Ratio</span>
            <strong>16:9</strong>
          </div>
        ) : (
          <label>
            <span>Ratio</span>
            <select
              value={content.format || "square"}
              onChange={(event) => updateContent({format: event.target.value})}
            >
              {(isSocial ? SOCIAL_FORMAT_OPTIONS : EVENT_FORMAT_OPTIONS).map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
        )}

        {!isSmallGroupLeader ? (
          <label>
            <span>Composition</span>
            <select
              value={selectedComposition}
              onChange={(event) =>
                updateContent({composition: event.target.value})
              }
            >
              {compositionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!["flat", "color-overlay"].includes(selectedComposition) ? (
          <label>
            <span>Palette</span>
            <select
              value={content.palette || "charcoal-red"}
              onChange={(event) =>
                updateContent({palette: event.target.value})
              }
            >
              {EVENT_PALETTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {selectedComposition === "flat" ? (
          <label className="is-color">
            <span>Background color</span>
            <i
              style={{
                background:
                  BRAND_COLOR_OPTIONS.find(
                    (option) => option.value === content.flatColor,
                  )?.hex || "#27272A",
              }}
            />
            <select
              value={content.flatColor || "charcoal"}
              onChange={(event) =>
                updateContent({flatColor: event.target.value})
              }
            >
              {BRAND_COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selectedComposition === "color-overlay" ? (
          <>
            <label className="is-color">
              <span>Overlay color</span>
              <i
                style={{
                  background:
                    BRAND_COLOR_OPTIONS.find(
                      (option) => option.value === content.overlayColor,
                    )?.hex || "#EF3E2D",
                }}
              />
              <select
                value={content.overlayColor || "red"}
                onChange={(event) =>
                  updateContent({overlayColor: event.target.value})
                }
              >
                {BRAND_COLOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Blend mode</span>
              <select
                value={content.overlayBlendMode || "multiply"}
                onChange={(event) =>
                  updateContent({overlayBlendMode: event.target.value})
                }
              >
                {EVENT_BLEND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

function useUploadRequest() {
  const requests = useRef(null);
  if (!requests.current) requests.current = createLatestRequest();
  useEffect(() => () => requests.current.cancel(), []);
  return requests.current;
}

function EventHeroControls({
  content,
  updateContent,
  cloud,
  project,
  canManageLogoLibrary,
}) {
  const request = useUploadRequest();
  const libraryRequest = useUploadRequest();
  const projectLogoInputRef = useRef(null);
  const libraryLogoInputRef = useRef(null);
  const [library, setLibrary] = useState([]);
  const [libraryName, setLibraryName] = useState("");
  const [state, setState] = useState({status: "", message: ""});
  const projectIdRef = useRef(project?.id);
  const chooseContent = (changes) => {
    request.cancel();
    setState({status: "", message: ""});
    updateContent(changes);
  };

  const refreshLibrary = async () => {
    const isCurrent = libraryRequest.begin();
    if (!cloud?.loadLogoLibrary) {
      if (isCurrent()) setLibrary([]);
      return;
    }
    setState({status: "working", message: "Loading the Logo Library…"});
    try {
      const logos = await cloud.loadLogoLibrary();
      if (!isCurrent()) return;
      setLibrary(logos);
      setState({
        status: "success",
        message: logos.length
          ? `${logos.length} logo${logos.length === 1 ? "" : "s"} available.`
          : "The Logo Library is ready for its first upload.",
      });
    } catch (error) {
      if (isCurrent()) setState({status: "error", message: error.message});
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, [cloud]);

  useEffect(() => {
    if (projectIdRef.current === project?.id) return;
    projectIdRef.current = project?.id;
    request.cancel();
    setState({status: "", message: ""});
  }, [project?.id]);

  const validateLogoFile = (file) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP logo.");
    }
    if (file.size >= 4 * 1024 * 1024) {
      throw new Error("Logo files must be smaller than 4 MB.");
    }
  };

  const uploadProjectLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isCurrent = request.begin();
    setState({status: "working", message: "Loading project logo…"});
    try {
      validateLogoFile(file);
      const preview = await readStudioImage(file, 4);
      if (!isCurrent()) return;
      updateContent({
        heroMode: "logo",
        heroLogo: preview,
        heroLogoSource: "",
        heroLogoLibraryId: "",
        heroLogoStoragePath: "",
        heroLogoName: file.name.slice(0, 80),
      });
      if (!cloud?.uploadHeroLogo) {
        setState({
          status: "success",
          message: "Logo loaded in this browser preview.",
        });
        return;
      }
      setState({status: "working", message: "Uploading project logo…"});
      const changes = await cloud.uploadHeroLogo(project, file);
      if (!isCurrent()) return;
      updateContent(changes);
      setState({status: "success", message: "Project logo saved to Studio."});
    } catch (error) {
      if (!isCurrent()) return;
      setState({status: "error", message: error.message});
    }
  };

  const uploadLibraryLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !cloud?.uploadLogoToLibrary) return;
    const isCurrent = request.begin();
    const submittedLibraryName = libraryName;
    try {
      validateLogoFile(file);
      const inferredName = file.name
        .replace(/\.(jpe?g|png|webp)$/iu, "")
        .replace(/[-_]+/gu, " ")
        .trim();
      const name = libraryName.trim() || inferredName;
      setState({status: "working", message: "Adding logo to the library…"});
      const logo = await cloud.uploadLogoToLibrary(name, file);
      if (!isCurrent()) return;
      setLibrary((current) =>
        [...current, logo].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setLibraryName((current) =>
        current === submittedLibraryName ? "" : current,
      );
      updateContent({
        heroMode: "logo",
        heroLogo: logo.imageUrl,
        heroLogoSource: "library",
        heroLogoLibraryId: logo.id,
        heroLogoStoragePath: logo.storagePath,
        heroLogoName: logo.name,
      });
      setState({
        status: "success",
        message: `${logo.name} was added to the Logo Library and selected.`,
      });
    } catch (error) {
      if (!isCurrent()) return;
      setState({status: "error", message: error.message});
    }
  };

  const selectLibraryLogo = (logoId) => {
    request.cancel();
    const logo = library.find((item) => item.id === logoId);
    if (!logo) return;
    updateContent({
      heroMode: "logo",
      heroLogo: logo.imageUrl,
      heroLogoSource: "library",
      heroLogoLibraryId: logo.id,
      heroLogoStoragePath: logo.storagePath,
      heroLogoName: logo.name,
    });
    setState({
      status: "success",
      message: `${logo.name} selected from the Logo Library.`,
    });
  };

  const logoScale = Math.min(
    2,
    Math.max(0.5, Number(content.heroLogoScale) || 1),
  );
  const logoClearSpace = Math.min(
    12,
    Math.max(0, Number(content.heroLogoClearSpace) || 0),
  );

  return (
    <div className="studio-hero-controls">
      <div className="studio-hero-mode" role="group" aria-label="Hero type">
        <button
          className={content.heroMode !== "logo" ? "is-active" : ""}
          type="button"
          aria-pressed={content.heroMode !== "logo"}
          onClick={() => chooseContent({heroMode: "text"})}
        >
          <strong>Text Hero</strong>
          <span>Use the template’s display typography.</span>
        </button>
        <button
          className={content.heroMode === "logo" ? "is-active" : ""}
          type="button"
          aria-pressed={content.heroMode === "logo"}
          onClick={() => chooseContent({heroMode: "logo"})}
        >
          <strong>Logo Hero</strong>
          <span>Replace the main text with a prepared logo.</span>
        </button>
      </div>

      {content.heroMode === "logo" ? (
        <>
          <div className="studio-logo-source-grid">
            <label className="studio-field">
              <span>Logo Library</span>
              <select
                value={
                  content.heroLogoSource === "library"
                    ? content.heroLogoLibraryId
                    : ""
                }
                disabled={!cloud || state.status === "working"}
                onChange={(event) => selectLibraryLogo(event.target.value)}
              >
                <option value="">
                  {library.length ? "Choose a shared logo…" : "No shared logos yet"}
                </option>
                {library.map((logo) => (
                  <option key={logo.id} value={logo.id}>
                    {logo.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="studio-logo-upload-option">
              <span>One-off logo</span>
              <input
                ref={projectLogoInputRef}
                className="studio-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadProjectLogo}
              />
              <button
                className="studio-button is-secondary"
                type="button"
                disabled={state.status === "working"}
                onClick={() => projectLogoInputRef.current?.click()}
              >
                Upload for this project
              </button>
            </div>
          </div>

          {content.heroLogo ? (
            <div className="studio-selected-logo">
              <div>
                <img
                  src={content.heroLogo}
                  alt={content.heroLogoName || "Selected event logo"}
                />
              </div>
              <span>
                <strong>{content.heroLogoName || "Selected logo"}</strong>
                <small>
                  {content.heroLogoSource === "library"
                    ? "Logo Library"
                    : content.heroLogoSource === "upload"
                      ? "Saved with this project"
                      : "Browser preview"}
                </small>
              </span>
            </div>
          ) : null}

          <div className="studio-logo-adjustments">
            <label>
              <span>
                Logo size <strong>{Math.round(logoScale * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={logoScale}
                onChange={(event) =>
                  updateContent({heroLogoScale: Number(event.target.value)})
                }
              />
            </label>
            <label>
              <span>
                Clear space <strong>{Math.round(logoClearSpace)}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={logoClearSpace}
                onChange={(event) =>
                  updateContent({
                    heroLogoClearSpace: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="studio-logo-sizing-note">
            Transparent file margins are ignored. Use Clear space to control
            the intentional gap around the visible logo.
          </p>

          {canManageLogoLibrary ? (
            <div className="studio-logo-library-admin">
              <div>
                <span className="studio-kicker">STUDIO ADMIN</span>
                <strong>Add a reusable logo</strong>
                <p>
                  Upload once so every Studio user can select it in future
                  graphics.
                </p>
              </div>
              <label>
                <span>Library name</span>
                <input
                  type="text"
                  maxLength="80"
                  value={libraryName}
                  placeholder="Bids for Kids"
                  disabled={state.status === "working"}
                  onChange={(event) => setLibraryName(event.target.value)}
                />
              </label>
              <input
                ref={libraryLogoInputRef}
                className="studio-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadLibraryLogo}
              />
              <button
                className="studio-button is-secondary"
                type="button"
                disabled={!cloud || state.status === "working"}
                onClick={() => libraryLogoInputRef.current?.click()}
              >
                Add to Logo Library
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="studio-hero-text-note">
          The title remains editable directly on the canvas. Switching back to
          Logo Hero restores the last selected logo.
        </p>
      )}

      {state.message ? (
        <p className={`studio-export-status is-${state.status}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function UnsplashSearch({
  beginSourceRequest,
  sourceRevision,
  unsplash,
  content,
  updateContent,
}) {
  const searchRequest = useUploadRequest();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [state, setState] = useState({status: "", message: ""});

  useEffect(() => {
    searchRequest.cancel();
    setResults([]);
    setPage(1);
    setTotalPages(0);
    setState({status: "", message: ""});
  }, [unsplash, content.format]);

  useEffect(() => {
    setState({status: "", message: ""});
  }, [sourceRevision]);

  const searchPage = async (nextPage) => {
    if (!unsplash || query.trim().length < 2) return;
    const isCurrent = searchRequest.begin();
    const submittedQuery = query.trim();
    setState({status: "working", message: "Searching Unsplash…"});
    try {
      const orientation =
        content.format === "portrait"
          ? "portrait"
          : content.format === "square"
            ? "squarish"
            : "landscape";
      const data = await unsplash.searchUnsplash(
        submittedQuery,
        orientation,
        nextPage,
      );
      if (!isCurrent()) return;
      setResults(data.results || []);
      setPage(nextPage);
      setTotalPages(Number(data.totalPages || 0));
      const firstResult = (nextPage - 1) * 18 + 1;
      const lastResult =
        firstResult + Math.max((data.results?.length || 1) - 1, 0);
      setState({
        status: "success",
        message: data.results?.length
          ? `Showing photos ${firstResult}–${lastResult} of ${Number(
              data.total || data.results.length,
            )}.`
          : "No photos matched that search.",
      });
    } catch (error) {
      if (isCurrent()) setState({status: "error", message: error.message});
    }
  };

  const search = (event) => {
    event.preventDefault();
    searchPage(1);
  };

  const selectPhoto = async (photo) => {
    const isCurrent = beginSourceRequest();
    setState({status: "working", message: "Adding the selected photo…"});
    try {
      const changes = await unsplash.selectUnsplash(photo);
      if (!isCurrent()) return;
      updateContent({
        ...changes,
        focalX: 50,
        focalY: 50,
        imageZoom: 1,
        backgroundImageRotation: 0,
      });
      setState({status: "success", message: "Photo added from Unsplash."});
    } catch (error) {
      if (!isCurrent()) return;
      setState({status: "error", message: error.message});
    }
  };

  return (
    <div className="studio-unsplash">
      <div className="studio-subsection-heading">
        <span className="studio-kicker">STOCK PHOTOGRAPHY</span>
        <h3>Search Unsplash inside Studio</h3>
        <p>
          Photos remain unwatermarked. Studio preserves the photographer and
          Unsplash attribution required by the API.
        </p>
      </div>
      <form className="studio-unsplash-search" onSubmit={search}>
        <input
          type="search"
          value={query}
          placeholder="People connecting, worship, community…"
          onChange={(event) => {
            searchRequest.cancel();
            setQuery(event.target.value);
            setResults([]);
            setPage(1);
            setTotalPages(0);
            setState({status: "", message: ""});
          }}
          disabled={!unsplash}
        />
        <button
          className="studio-button is-secondary"
          type="submit"
          disabled={
            !unsplash ||
            query.trim().length < 2 ||
            state.status === "working"
          }
        >
          Search
        </button>
      </form>
      {!unsplash ? (
        <p className="studio-unsplash-note">
          Unsplash search is available when Studio is signed in and connected
          to its backend.
        </p>
      ) : null}
      {state.message ? (
        <p className={`studio-export-status is-${state.status}`}>
          {state.message}
        </p>
      ) : null}
      {results.length ? (
        <>
          <div className="studio-unsplash-results">
            {results.map((photo) => (
              <div key={photo.id}>
                <button type="button" onClick={() => selectPhoto(photo)}>
                  <img src={photo.thumbnailUrl} alt={photo.alt || ""} />
                  <span className="studio-visually-hidden">Use this photo</span>
                </button>
                <span>
                  Photo by{" "}
                  <a
                    href={photo.photographerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {photo.photographerName}
                  </a>
                  {" "}on{" "}
                  <a
                    href={photo.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Unsplash
                  </a>
                </span>
              </div>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav
              className="studio-unsplash-pagination"
              aria-label="Unsplash search result pages"
            >
              <button
                className="studio-button is-secondary"
                type="button"
                disabled={page <= 1 || state.status === "working"}
                onClick={() => searchPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                className="studio-button is-secondary"
                type="button"
                disabled={page >= totalPages || state.status === "working"}
                onClick={() => searchPage(page + 1)}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function EventBackgroundControls({
  content,
  updateContent,
  cloud,
  unsplash,
  project,
}) {
  const request = useUploadRequest();
  const fileInputRef = useRef(null);
  const [uploadState, setUploadState] = useState({status: "", message: ""});
  const [sourceRevision, setSourceRevision] = useState(0);
  const chooseContent = (changes) => {
    request.cancel();
    setSourceRevision((current) => current + 1);
    setUploadState({status: "", message: ""});
    updateContent(changes);
  };
  const beginSourceRequest = () => {
    setUploadState({status: "", message: ""});
    return request.begin();
  };

  useEffect(() => {
    request.cancel();
    setSourceRevision((current) => current + 1);
    setUploadState({status: "", message: ""});
  }, [project?.id]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isCurrent = request.begin();
    setSourceRevision((current) => current + 1);
    setUploadState({status: "working", message: "Loading image…"});
    try {
      const preview = await readStudioImage(file);
      if (!isCurrent()) return;
      updateContent({backgroundImage: preview, backgroundImageSource: "", backgroundImageUrl: "", backgroundImageStoragePath: "", focalX: 50, focalY: 50, imageZoom: 1, backgroundImageRotation: 0});
      if (cloud) {
        const changes = await cloud.uploadBackground(project, file);
        if (!isCurrent()) return;
        updateContent(changes);
      }
      setUploadState({status: "success", message: cloud ? "Image saved to Studio." : "Preview loaded in this browser."});
    } catch (error) {
      if (isCurrent()) setUploadState({status: "error", message: error.message});
    }
  };

  return (
    <div className="studio-source-background">
      <div className="studio-subsection-heading">
        <span className="studio-kicker">BACKGROUND</span>
        <h3>Establish the visual foundation</h3>
        <p>
          Choose the image before writing around it, or continue with a
          template-generated background.
        </p>
      </div>
      <input
        ref={fileInputRef}
        className="studio-file-input"
        type="file"
        accept="image/*"
        onChange={handleFile}
      />
      <div className="studio-image-controls">
        <button
          className="studio-image-dropzone"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="studio-upload-icon" aria-hidden="true">↑</span>
          <span>
            <strong>
              {content.backgroundImage
                ? "Replace preview image"
                : "Upload a preview image"}
            </strong>
            <small>
              JPG, PNG, or WebP · under 8 MB ·{" "}
              {cloud ? "saved with this project" : "browser preview only"}
            </small>
          </span>
        </button>
        {content.backgroundImage ? (
          <button
            className="studio-button is-secondary"
            type="button"
            onClick={() =>
              chooseContent({
                backgroundImage: "",
                backgroundImageSource: "",
                backgroundImageUrl: "",
                backgroundImageStoragePath: "",
                unsplashPhotoId: "",
                unsplashPhotographerName: "",
                unsplashPhotographerUrl: "",
                unsplashPhotoUrl: "",
                backgroundImageOpacity: 1,
                backgroundImageRotation: 0,
              })
            }
          >
            Remove Image
          </button>
        ) : null}
      </div>
      {content.backgroundImage ? (
        <ImageFocalPointEditor
          content={content}
          updateContent={updateContent}
        />
      ) : null}
      {uploadState.message ? (
        <p className={`studio-export-status is-${uploadState.status}`}>
          {uploadState.message}
        </p>
      ) : null}
      {content.backgroundImageSource === "unsplash" &&
      content.unsplashPhotographerName ? (
        <p className="studio-unsplash-attribution">
          Photo by{" "}
          <a
            href={content.unsplashPhotographerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {content.unsplashPhotographerName}
          </a>
          {" "}on{" "}
          <a href={content.unsplashPhotoUrl} target="_blank" rel="noreferrer">
            Unsplash
          </a>
        </p>
      ) : null}
      <UnsplashSearch
        beginSourceRequest={beginSourceRequest}
        sourceRevision={sourceRevision}
        unsplash={unsplash}
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

function DocumentSectionHeading({eyebrow, title, description}) {
  return (
    <div className="studio-document-section-heading">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function DocumentFooterFields({content, updateContent, referenceMaximum = 40}) {
  return (
    <>
      <DocumentSectionHeading
        eyebrow="PAGE FOOTER"
        title="Finish the page"
        description="These details appear in the locked CrossPointe footer."
      />
      <div className="studio-field-grid">
        <TextareaField
          label="Footer note"
          value={content.footerNote}
          onChange={(value) => updateContent({footerNote: value})}
          maxLength={500}
          rows={5}
        />
        <InputField
          label="Footer reference"
          value={content.footerReference}
          onChange={(value) => updateContent({footerReference: value})}
          maxLength={referenceMaximum}
          wide
        />
      </div>
    </>
  );
}

function OnePagerInspector({content, updateContent}) {
  return (
    <div className="studio-document-inspector-content">
      <DocumentSectionHeading
        eyebrow="ONE PAGER"
        title="Page identity"
        description="Every field maps to a controlled location in the page."
      />
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Page title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={72}
          wide
        />
        <TextareaField
          label="Purpose statement"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={150}
          rows={3}
        />
      </div>

      <DocumentSectionHeading
        eyebrow="FEATURED RULE"
        title="Lead with the governing idea"
      />
      <div className="studio-field-grid">
        <InputField
          label="Operating rule heading"
          value={content.operatingRuleLabel}
          onChange={(value) => updateContent({operatingRuleLabel: value})}
          maxLength={32}
          wide
        />
        <TextareaField
          label="Operating rule"
          value={content.operatingRule}
          onChange={(value) => updateContent({operatingRule: value})}
          maxLength={320}
          rows={5}
          hint={`${String(content.operatingRule || "").length}/320 characters`}
        />
      </div>

      <DocumentSectionHeading
        eyebrow="CONTROLLED SECTIONS"
        title="Shape the repeatable guidance"
      />
      <div className="studio-field-grid">
        <InputField
          label="Primary section label"
          value={content.primarySectionLabel}
          onChange={(value) => updateContent({primarySectionLabel: value})}
          maxLength={32}
        />
        <InputField
          label="Primary section heading"
          value={content.primarySectionTitle}
          onChange={(value) => updateContent({primarySectionTitle: value})}
          maxLength={38}
        />
        <LineListField
          label="Primary items"
          items={content.primaryItems}
          draftValue={content.primaryItemsText}
          maxLength={DOCUMENT_FIELD_LIMITS["document-one-pager"].primaryItemsText}
          onChange={({draftValue, items}) =>
            updateContent({primaryItemsText: draftValue, primaryItems: items})
          }
          maximum={DOCUMENT_LINE_LIST_LIMITS["document-one-pager"].primaryItems.maximum}
          rows={7}
          hint="One item per line; up to 7 items."
        />
        <InputField
          label="Secondary section label"
          value={content.secondarySectionLabel}
          onChange={(value) => updateContent({secondarySectionLabel: value})}
          maxLength={32}
        />
        <InputField
          label="Secondary section heading"
          value={content.secondarySectionTitle}
          onChange={(value) => updateContent({secondarySectionTitle: value})}
          maxLength={38}
        />
        <LineListField
          label="Secondary items"
          items={content.secondaryItems}
          draftValue={content.secondaryItemsText}
          maxLength={DOCUMENT_FIELD_LIMITS["document-one-pager"].secondaryItemsText}
          onChange={({draftValue, items}) =>
            updateContent({
              secondaryItemsText: draftValue,
              secondaryItems: items,
            })
          }
          maximum={DOCUMENT_LINE_LIST_LIMITS["document-one-pager"].secondaryItems.maximum}
          rows={7}
          hint="One item per line; up to 7 items."
        />
        <InputField
          label="Owner section label"
          value={content.ownerLabel}
          onChange={(value) => updateContent({ownerLabel: value})}
          maxLength={32}
        />
        <InputField
          label="Owner section heading"
          value={content.ownerTitle}
          onChange={(value) => updateContent({ownerTitle: value})}
          maxLength={38}
        />
        <LineListField
          label="Owner responsibilities"
          items={content.ownerItems}
          draftValue={content.ownerItemsText}
          maxLength={DOCUMENT_FIELD_LIMITS["document-one-pager"].ownerItemsText}
          onChange={({draftValue, items}) =>
            updateContent({ownerItemsText: draftValue, ownerItems: items})
          }
          maximum={DOCUMENT_LINE_LIST_LIMITS["document-one-pager"].ownerItems.maximum}
          rows={5}
          hint="Exactly three concise responsibilities work best."
        />
      </div>

      <DocumentSectionHeading
        eyebrow="PROCESS FOOTER"
        title="Edit the full process strip"
        description="The label, every process step, note, and reference are editable."
      />
      <div className="studio-field-grid">
        <InputField
          label="Process label"
          value={content.processLabel}
          onChange={(value) => updateContent({processLabel: value})}
          maxLength={30}
          wide
        />
        <LineListField
          label="Process steps"
          items={content.processSteps}
          draftValue={content.processStepsText}
          maxLength={DOCUMENT_FIELD_LIMITS["document-one-pager"].processStepsText}
          onChange={({draftValue, items}) =>
            updateContent({processStepsText: draftValue, processSteps: items})
          }
          maximum={DOCUMENT_LINE_LIST_LIMITS["document-one-pager"].processSteps.maximum}
          rows={6}
          hint="One short process step per line; up to 8 steps."
        />
      </div>
      <DocumentFooterFields
        referenceMaximum={DOCUMENT_FIELD_LIMITS["document-one-pager"].footerReference}
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

function ChecklistInspector({content, updateContent}) {
  const checklistSections = [
    {
      key: "One",
      title: content.sectionOneTitle,
      items: content.sectionOneItems,
      draft: content.sectionOneItemsText,
    },
    {
      key: "Two",
      title: content.sectionTwoTitle,
      items: content.sectionTwoItems,
      draft: content.sectionTwoItemsText,
    },
    {
      key: "Three",
      title: content.sectionThreeTitle,
      items: content.sectionThreeItems,
      draft: content.sectionThreeItemsText,
    },
  ];
  return (
    <div className="studio-document-inspector-content">
      <DocumentSectionHeading
        eyebrow="CHECKLIST"
        title="Page identity"
        description="Build a printable, grouped checklist inside the document system."
      />
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Page title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={72}
          wide
        />
        <TextareaField
          label="Purpose statement"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={220}
          rows={3}
        />
        <InputField
          label="Instructions label"
          value={content.instructionsLabel}
          onChange={(value) => updateContent({instructionsLabel: value})}
          maxLength={32}
          wide
        />
        <TextareaField
          label="Instructions"
          value={content.instructions}
          onChange={(value) => updateContent({instructions: value})}
          maxLength={360}
          rows={4}
        />
      </div>

      {checklistSections.map((section, index) => (
        <React.Fragment key={section.key}>
          <DocumentSectionHeading
            eyebrow={`CHECKLIST GROUP ${index + 1}`}
            title={section.title || `Group ${index + 1}`}
          />
          <div className="studio-field-grid">
            <InputField
              label="Group heading"
              value={section.title}
              onChange={(value) =>
                updateContent({[`section${section.key}Title`]: value})
              }
              maxLength={36}
              wide
            />
            <LineListField
              maxLength={1400}
              label="Checklist items"
              items={section.items}
              draftValue={section.draft}
              onChange={({draftValue, items}) =>
                updateContent({
                  [`section${section.key}ItemsText`]: draftValue,
                  [`section${section.key}Items`]: items,
                })
              }
              rows={12}
              hint="One entry per line: “## Heading” adds a heading, “---” adds a divider, and “- Sub-item” indents a step. The page layout adapts to the entries you add."
            />
          </div>
        </React.Fragment>
      ))}

      <DocumentSectionHeading
        eyebrow="CALLOUT"
        title="End with one final reminder"
      />
      <div className="studio-field-grid">
        <InputField
          label="Callout label"
          value={content.calloutLabel}
          onChange={(value) => updateContent({calloutLabel: value})}
          maxLength={32}
          wide
        />
        <TextareaField
          label="Callout text"
          value={content.calloutText}
          onChange={(value) => updateContent({calloutText: value})}
          maxLength={360}
          rows={4}
        />
      </div>
      <DocumentFooterFields
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

function SignupSheetInspector({content, updateContent}) {
  const signupCount = Math.min(
    24,
    Math.max(4, Number(content.signupCount) || 12),
  );
  return (
    <div className="studio-document-inspector-content">
      <DocumentSectionHeading
        eyebrow="SIGN-UP SHEET"
        title="Page identity"
        description="Create a printable sheet with a controlled number of writable rows."
      />
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Page title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={72}
          wide
        />
        <TextareaField
          label="Purpose statement"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={220}
          rows={3}
        />
        <InputField
          label="Instructions label"
          value={content.instructionsLabel}
          onChange={(value) => updateContent({instructionsLabel: value})}
          maxLength={32}
          wide
        />
        <TextareaField
          label="Instructions"
          value={content.instructions}
          onChange={(value) => updateContent({instructions: value})}
          maxLength={360}
          rows={3}
        />
      </div>

      <DocumentSectionHeading
        eyebrow="SIGN-UP LINES"
        title="Control the writing space"
        description="Every line stays the same size. Fewer sign-ups simply leave more blank space on the page."
      />
      <div className="studio-count-control">
        <div>
          <strong>{signupCount}</strong>
          <span>available sign-ups</span>
        </div>
        <input
          type="range"
          min="4"
          max="24"
          step="1"
          value={signupCount}
          aria-label="Number of sign-up lines"
          onChange={(event) =>
            updateContent({signupCount: Number(event.target.value)})
          }
        />
        <div className="studio-count-control-actions">
          <button
            type="button"
            disabled={signupCount <= 4}
            onClick={() => updateContent({signupCount: signupCount - 1})}
          >
            −
          </button>
          <button
            type="button"
            disabled={signupCount >= 24}
            onClick={() => updateContent({signupCount: signupCount + 1})}
          >
            +
          </button>
        </div>
      </div>
      <div className="studio-field-grid">
        <InputField
          label="First column"
          value={content.columnOneLabel}
          onChange={(value) => updateContent({columnOneLabel: value})}
          maxLength={28}
        />
        <InputField
          label="Second column"
          value={content.columnTwoLabel}
          onChange={(value) => updateContent({columnTwoLabel: value})}
          maxLength={28}
        />
        <InputField
          label="Third column"
          value={content.columnThreeLabel}
          onChange={(value) => updateContent({columnThreeLabel: value})}
          maxLength={28}
        />
      </div>
      <ToggleField
        label="Number each row"
        description="Show a small sequence number beside every sign-up."
        checked={content.showNumbers !== false}
        onChange={(showNumbers) => updateContent({showNumbers})}
      />
      <DocumentFooterFields
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

function createDirectoryCard(changes = {}) {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ||
      `directory-card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    subtitle: "",
    details: "",
    imageUrl: "",
    imageStoragePath: "",
    sourceType: "manual",
    sourceId: "",
    publicUrl: "",
    ...changes,
  };
}

function DirectoryCardEditor({
  card,
  index,
  total,
  project,
  page,
  cloud,
  updateCard,
  moveCard,
  deleteCard,
}) {
  const request = useUploadRequest();
  const fileInputRef = useRef(null);
  const [uploadState, setUploadState] = useState({status: "", message: ""});
  useEffect(() => {
    request.cancel();
    setUploadState({status: "", message: ""});
    return () => request.cancel();
  }, [project?.id, page?.id, card.id]);
  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isCurrent = request.begin();
    setUploadState({status: "working", message: "Loading directory image…"});
    try {
      const preview = await readStudioImage(file);
      if (!isCurrent()) return;
      updateCard({imageUrl: preview, imageStoragePath: ""});
      if (cloud) {
        const image = await cloud.uploadDirectoryImage(project, page.id, card.id, file);
        if (!isCurrent()) return;
        updateCard(image);
      }
      setUploadState({status: "success", message: cloud ? "Directory image saved." : "Preview loaded in this browser."});
    } catch (error) {
      if (isCurrent()) setUploadState({status: "error", message: error.message});
    }
  };
  return (
    <div className="studio-directory-card-editor">
      <div className="studio-content-block-heading">
        <strong>Card {index + 1}</strong>
        <div>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => moveCard(-1)}
            aria-label={`Move directory card ${index + 1} up`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => moveCard(1)}
            aria-label={`Move directory card ${index + 1} down`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => {request.cancel(); deleteCard();}}
            aria-label={`Delete directory card ${index + 1}`}
          >
            ×
          </button>
        </div>
      </div>
      <div className="studio-directory-image-editor">
        <div
          className={card.imageUrl ? "has-image" : ""}
          style={
            card.imageUrl
              ? {backgroundImage: `url("${card.imageUrl}")`}
              : undefined
          }
        >
          {!card.imageUrl ? String(card.name || "C").slice(0, 1) : null}
        </div>
        <div>
          <input
            ref={fileInputRef}
            className="studio-file-input"
            type="file"
            accept="image/*"
            onChange={handleImage}
          />
          <button
            className="studio-button is-secondary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {card.imageUrl ? "Replace Photo" : "Add Photo"}
          </button>
          {card.imageUrl ? (
            <button
              className="studio-button is-secondary"
              type="button"
              onClick={() => {
                request.cancel();
                setUploadState({status: "", message: ""});
                updateCard({imageUrl: "", imageStoragePath: ""});
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {uploadState.message ? (
        <p className={`studio-export-status is-${uploadState.status}`}>
          {uploadState.message}
        </p>
      ) : null}
      <div className="studio-field-grid">
        <InputField
          label="Name"
          value={card.name}
          onChange={(name) => updateCard({name})}
          maxLength={80}
          wide
        />
        <InputField
          label="Schedule or subtitle"
          value={card.subtitle}
          onChange={(subtitle) => updateCard({subtitle})}
          maxLength={100}
          wide
        />
        <TextareaField
          label="Description"
          value={card.details}
          onChange={(details) => updateCard({details})}
          maxLength={360}
          rows={5}
        />
      </div>
      {card.sourceType === "planning-center" ? (
        <p className="studio-directory-source-note">
          Imported from Planning Center Groups. The card stays editable after
          import.
        </p>
      ) : null}
    </div>
  );
}

function PlanningCenterGroupPicker({service, cards, onImport}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [state, setState] = useState({status: "", message: ""});
  const search = async () => {
    if (!service?.searchPlanningCenterGroups) return;
    setState({status: "working", message: "Loading published PCO Groups…"});
    try {
      const data = await service.searchPlanningCenterGroups(query);
      setResults(Array.isArray(data.groups) ? data.groups : []);
      setSelectedIds([]);
      setState({
        status: "success",
        message: `${Number(data.total || data.groups?.length || 0)} published group${
          Number(data.total || data.groups?.length || 0) === 1 ? "" : "s"
        } available.`,
      });
    } catch (error) {
      setState({status: "error", message: error.message});
    }
  };
  const availableSlots = Math.max(0, 8 - cards.length);
  const importSelected = () => {
    const imported = results
      .filter((group) => selectedIds.includes(group.id))
      .slice(0, availableSlots)
      .map((group) =>
        createDirectoryCard({
          name: group.name,
          subtitle: [group.schedule, group.typeName].filter(Boolean).join(" · "),
          details: group.description,
          imageUrl: group.imageUrl,
          sourceType: "planning-center",
          sourceId: group.id,
          publicUrl: group.publicUrl,
        }),
      );
    onImport(imported);
    setSelectedIds([]);
    setState({
      status: "success",
      message: `${imported.length} group card${imported.length === 1 ? "" : "s"} added.`,
    });
  };
  return (
    <div className="studio-pco-group-picker">
      <div className="studio-pco-group-search">
        <input
          type="search"
          value={query}
          placeholder="Filter by group name, type, or schedule"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
        <button
          className="studio-button is-secondary"
          type="button"
          disabled={!service?.searchPlanningCenterGroups || state.status === "working"}
          onClick={search}
        >
          {state.status === "working" ? "Loading…" : "Browse PCO Groups"}
        </button>
      </div>
      {!service?.searchPlanningCenterGroups ? (
        <p className="studio-directory-source-note">
          Planning Center import becomes available through the Studio backend.
          Manual cards remain fully available.
        </p>
      ) : null}
      {state.message ? (
        <p className={`studio-export-status is-${state.status}`}>
          {state.message}
        </p>
      ) : null}
      {results.length ? (
        <>
          <div className="studio-pco-group-results">
            {results.map((group) => {
              const alreadyAdded = cards.some(
                (card) =>
                  card.sourceType === "planning-center" &&
                  card.sourceId === group.id,
              );
              const selected = selectedIds.includes(group.id);
              return (
                <label key={group.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={
                      alreadyAdded ||
                      (!selected && selectedIds.length >= availableSlots)
                    }
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, group.id]
                          : current.filter((id) => id !== group.id),
                      )
                    }
                  />
                  <span
                    className={group.imageUrl ? "has-image" : ""}
                    style={
                      group.imageUrl
                        ? {backgroundImage: `url("${group.imageUrl}")`}
                        : undefined
                    }
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{group.name}</strong>
                    <small>
                      {[group.schedule, group.typeName]
                        .filter(Boolean)
                        .join(" · ") || "Published group"}
                    </small>
                  </span>
                  {alreadyAdded ? <em>ADDED</em> : null}
                </label>
              );
            })}
          </div>
          <button
            className="studio-button is-primary"
            type="button"
            disabled={!selectedIds.length || availableSlots === 0}
            onClick={importSelected}
          >
            Add Selected Groups
          </button>
        </>
      ) : null}
    </div>
  );
}

function DirectoryInspector({
  content,
  updateContent,
  project,
  page,
  cloud,
  services,
}) {
  const cards = Array.isArray(content.cards) ? content.cards : [];
  const updateCards = (nextCards) => updateContent((latest) => ({cards: typeof nextCards === "function" ? nextCards(latest.cards || []) : nextCards}));
  return (
    <div className="studio-document-inspector-content">
      <DocumentSectionHeading
        eyebrow="DIRECTORY"
        title="Page identity"
        description="Build a branded card directory manually or start with published Planning Center Groups."
      />
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Page title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={72}
          wide
        />
        <TextareaField
          label="Purpose statement"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={220}
          rows={3}
        />
      </div>

      <DocumentSectionHeading
        eyebrow="PLANNING CENTER"
        title="Import published groups"
        description="Select the groups you want. Studio creates editable cards from their public information."
      />
      <PlanningCenterGroupPicker
        service={services}
        cards={cards}
        onImport={(groups) => updateCards((latestCards) => [...latestCards, ...groups.filter((group) => !latestCards.some((card) => card.sourceId && card.sourceId === group.sourceId))].slice(0, 8))}
      />

      <DocumentSectionHeading
        eyebrow="DIRECTORY CARDS"
        title={`${cards.length} of 8 cards`}
        description="Use another Directory page when this collection needs more than 8 entries."
      />
      <div className="studio-directory-card-editor-list">
        {cards.map((card, index) => (
          <DirectoryCardEditor
            key={card.id}
            card={card}
            index={index}
            total={cards.length}
            project={project}
            page={page}
            cloud={cloud}
            updateCard={(changes) =>
              updateCards((latestCards) =>
                latestCards.map((item) =>
                  item.id === card.id ? {...item, ...changes} : item,
                ),
              )
            }
            moveCard={(direction) => {
              updateCards((latestCards) => {
                const currentIndex = latestCards.findIndex(
                  (item) => item.id === card.id,
                );
                const targetIndex = currentIndex + direction;
                if (
                  currentIndex < 0 ||
                  targetIndex < 0 ||
                  targetIndex >= latestCards.length
                ) {
                  return latestCards;
                }
                const nextCards = [...latestCards];
                [nextCards[currentIndex], nextCards[targetIndex]] = [
                  nextCards[targetIndex],
                  nextCards[currentIndex],
                ];
                return nextCards;
              });
            }}
            deleteCard={() =>
              updateCards((latestCards) =>
                latestCards.filter((item) => item.id !== card.id),
              )
            }
          />
        ))}
      </div>
      <button
        className="studio-button is-secondary studio-add-directory-card"
        type="button"
        disabled={cards.length >= 8}
        onClick={() =>
          updateCards((latestCards) =>
            latestCards.length >= 8
              ? latestCards
              : [...latestCards, createDirectoryCard()],
          )
        }
      >
        + Add Blank Card
      </button>
      <DocumentFooterFields
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

const CONTENT_BLOCK_TYPES = [
  {value: "heading", label: "Heading"},
  {value: "paragraph", label: "Paragraph"},
  {value: "bullets", label: "Bulleted List"},
  {value: "numbered", label: "Numbered List"},
  {value: "callout", label: "Callout"},
  {value: "divider", label: "Divider"},
];

function MarkdownTextEditor({value, onChange, rows = 4}) {
  const textareaRef = useRef(null);
  const applyFormat = (prefix, suffix = prefix, placeholder = "text") => {
    const textarea = textareaRef.current;
    const current = String(value || "");
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const selection = current.slice(start, end) || placeholder;
    const next = `${current.slice(0, start)}${prefix}${selection}${suffix}${current.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selection.length,
      );
    });
  };
  return (
    <div className="studio-markdown-editor">
      <div className="studio-markdown-toolbar" aria-label="Text formatting">
        <button type="button" onClick={() => applyFormat("**")} title="Bold">
          B
        </button>
        <button type="button" onClick={() => applyFormat("*")} title="Italic">
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => applyFormat("[", "](https://)", "link text")}
          title="Link"
        >
          Link
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value || ""}
        rows={rows}
        maxLength={1200}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ContentBlockEditor({
  block,
  index,
  total,
  updateBlock,
  moveBlock,
  deleteBlock,
}) {
  return (
    <div className="studio-content-block-editor">
      <div className="studio-content-block-heading">
        <select
          value={block.type}
          onChange={(event) => updateBlock({type: event.target.value})}
          aria-label={`Block ${index + 1} type`}
        >
          {CONTENT_BLOCK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <div>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => moveBlock(-1)}
            aria-label={`Move block ${index + 1} up`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => moveBlock(1)}
            aria-label={`Move block ${index + 1} down`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={deleteBlock}
            aria-label={`Delete block ${index + 1}`}
          >
            ×
          </button>
        </div>
      </div>
      {block.type !== "divider" ? (
        <MarkdownTextEditor
          value={block.text}
          onChange={(text) => updateBlock({text})}
          rows={block.type === "paragraph" ? 5 : 3}
        />
      ) : (
        <p className="studio-divider-note">
          A branded divider will appear at this position.
        </p>
      )}
    </div>
  );
}

function ContentPageInspector({content, updateContent}) {
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const updateBlocks = (nextBlocks) => updateContent({blocks: nextBlocks});
  const addBlock = (type = "paragraph") => {
    if (blocks.length >= 8) return;
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `content-block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    updateBlocks([
      ...blocks,
      {
        id,
        type,
        text:
          type === "heading"
            ? "New section"
            : type === "bullets" || type === "numbered"
              ? "First item\nSecond item"
              : "",
      },
    ]);
  };
  return (
    <div className="studio-document-inspector-content">
      <DocumentSectionHeading
        eyebrow="BRANDED CONTENT"
        title="Page identity"
        description="The header and footer stay governed while the content area remains flexible."
      />
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Page title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={72}
          wide
        />
        <TextareaField
          label="Purpose statement"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={220}
          rows={3}
        />
      </div>

      <DocumentSectionHeading
        eyebrow="CONTENT BLOCKS"
        title="Build the page"
        description="Choose a block type, write visually, and use the optional formatting shortcuts when useful."
      />
      <details className="studio-formatting-key">
        <summary>Formatting key</summary>
        <div>
          <code>**bold**</code>
          <span>Bold text</span>
          <code>*italic*</code>
          <span>Italic text</span>
          <code>[label](https://url)</code>
          <span>Link text</span>
        </div>
      </details>
      <div className="studio-content-block-list">
        {blocks.map((block, index) => (
          <ContentBlockEditor
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            updateBlock={(changes) =>
              updateBlocks(
                blocks.map((item) =>
                  item.id === block.id ? {...item, ...changes} : item,
                ),
              )
            }
            moveBlock={(direction) => {
              const targetIndex = index + direction;
              if (targetIndex < 0 || targetIndex >= blocks.length) return;
              const nextBlocks = [...blocks];
              [nextBlocks[index], nextBlocks[targetIndex]] = [
                nextBlocks[targetIndex],
                nextBlocks[index],
              ];
              updateBlocks(nextBlocks);
            }}
            deleteBlock={() =>
              updateBlocks(blocks.filter((item) => item.id !== block.id))
            }
          />
        ))}
      </div>
      <div className="studio-add-block-menu">
        <span>Add content</span>
        {CONTENT_BLOCK_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            disabled={blocks.length >= 8}
            onClick={() => addBlock(type.value)}
          >
            + {type.label}
          </button>
        ))}
      </div>
      <DocumentFooterFields
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

const DOCUMENT_PAGE_INSPECTORS = Object.freeze({
  "document-checklist": ChecklistInspector,
  "document-signup-sheet": SignupSheetInspector,
  "document-directory": DirectoryInspector,
  "document-content-page": ContentPageInspector,
});

function DocumentPageInspector({
  page,
  updatePage,
  project,
  cloud,
  services,
}) {
  const updateContent = (changes) =>
    updatePage((latest) => ({content: {...latest.content, ...(typeof changes === "function" ? changes(latest.content) : changes)}}));
  const InspectorComponent =
    DOCUMENT_PAGE_INSPECTORS[page.templateId] || OnePagerInspector;
  return (
    <InspectorComponent
      content={page.content}
      updateContent={updateContent}
      project={project}
      page={page}
      cloud={cloud}
      services={services}
    />
  );
}

function AddPageDialog({onAdd, onClose}) {
  return (
    <div className="studio-page-dialog-backdrop" role="presentation">
      <section
        className="studio-page-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-page-dialog-title"
      >
        <div className="studio-page-dialog-heading">
          <div>
            <span className="studio-kicker">ADD A PAGE</span>
            <h2 id="studio-page-dialog-title">Choose a page template</h2>
            <p>
              Each page keeps the same CrossPointe document system and can use
              a different controlled layout.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close page picker">
            ×
          </button>
        </div>
        <div className="studio-page-template-grid">
          {DOCUMENT_PAGE_TEMPLATES.map((template) => {
            const page = createDocumentPage(template.id);
            return (
              <button
                type="button"
                key={template.id}
                onClick={() => onAdd(template.id)}
              >
                <div className="studio-page-template-preview" aria-hidden="true">
                  <DocumentPagePreview
                    page={page}
                    pageNumber={1}
                    pageCount={1}
                    showPageNumbers={false}
                  />
                </div>
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getCreativeFilenameDefaults(project) {
  const template = getTemplateById(project.templateId);
  const isUntitled = /^Untitled\b/i.test(String(project.name || "").trim());
  const descriptionTemplate = isDocumentProject(project) && project.pages?.[0]
    ? getTemplateById(project.pages[0].templateId)
    : template;
  const workType = template.kind === "social"
    ? "SOCIAL"
    : template.kind === "event"
      ? "EVENT"
      : "DOCUMENT";
  return {
    workType,
    description: isUntitled ? descriptionTemplate.name : project.name,
  };
}

function CreativeFilenameToggle({checked, onChange, compact = false}) {
  return (
    <label
      className={`studio-creative-filename-toggle${compact ? " is-compact" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="studio-creative-filename-switch" aria-hidden="true">
        <i />
      </span>
      <span className="studio-creative-filename-copy">
        <strong>Creative Team naming</strong>
        <small>
          {checked
            ? "Studio will ask for naming details before export."
            : "Use the standard project filename."}
        </small>
      </span>
    </label>
  );
}

function CreativeFilenameDialog({
  project,
  extension,
  onClose,
  onConfirm,
}) {
  const defaults = getCreativeFilenameDefaults(project);
  const carouselSlideCount =
    isSocialTemplateId(project.templateId) && project.postMode === "carousel"
      ? getSocialProjectSlides(project).length
      : 0;
  const carouselRatio = project.content?.format === "portrait" ? "4x5" : "1x1";
  const [contentId, setContentId] = useState("");
  const [workType, setWorkType] = useState(defaults.workType);
  const [description, setDescription] = useState(defaults.description);
  const [version, setVersion] = useState(1);
  const [error, setError] = useState("");
  const exportDate = useMemo(() => new Date(), []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const preview = useMemo(() => {
    try {
      return buildCreativeFilename({
        contentId: contentId || "CONTENTID",
        workType: workType || "WORKTYPE",
        description,
        version,
        date: exportDate,
      });
    } catch (_error) {
      return "CONTENTID_WORKTYPE_DESCRIPTION_YYYYMMDD_VXXX";
    }
  }, [contentId, description, exportDate, version, workType]);

  const submit = (event) => {
    event.preventDefault();
    try {
      const filename = buildCreativeFilename({
        contentId,
        workType,
        description,
        version,
        date: exportDate,
      });
      validateCreativeFilenameForExport(filename, {extension, carousel: carouselSlideCount > 0, formatLabel: carouselRatio});
      setError("");
      onConfirm(filename);
    } catch (nextError) {
      setError(nextError.message || "Complete the required filename details.");
    }
  };

  return (
    <div
      className="studio-page-dialog-backdrop studio-creative-filename-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="studio-page-dialog studio-creative-filename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-creative-filename-title"
      >
        <div className="studio-page-dialog-heading">
          <div>
            <span className="studio-kicker">CREATIVE TEAM EXPORT</span>
            <h2 id="studio-creative-filename-title">
              {carouselSlideCount ? "Name this carousel ZIP" : "Name this file"}
            </h2>
            <p>
              {carouselSlideCount
                ? "Studio packages every slide PNG into one ZIP. The base name follows CONTENTID_WORKTYPE_DESCRIPTION_YYYYMMDD_VXXX, and each PNG inside adds its slide number and ratio."
                : "Studio formats the download as CONTENTID_WORKTYPE_DESCRIPTION_YYYYMMDD_VXXX."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close filename dialog">
            ×
          </button>
        </div>
        <form className="studio-creative-filename-form" onSubmit={submit}>
          <label className="studio-field">
            <span>Content ID</span>
            <input
              autoFocus
              required
              value={contentId}
              maxLength="48"
              placeholder="2417"
              onChange={(event) => setContentId(event.target.value)}
            />
          </label>
          <label className="studio-field">
            <span>Work Type</span>
            <input
              required
              value={workType}
              maxLength="48"
              placeholder="SOCIAL"
              onChange={(event) => setWorkType(event.target.value)}
            />
            <small>Free-form until the official Work Type list is added.</small>
          </label>
          <label className="studio-field is-wide">
            <span>Description <i>OPTIONAL</i></span>
            <input
              value={description}
              maxLength="100"
              placeholder="EASTER INVITE"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="studio-field">
            <span>Version</span>
            <input
              type="number"
              required
              min="1"
              max="999"
              step="1"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </label>
          <div className="studio-creative-filename-preview">
            <span>{carouselSlideCount ? "ZIP DOWNLOAD" : "DOWNLOAD NAME"}</span>
            <strong>
              {carouselSlideCount
                ? `${preview}.zip · contains ${preview}-s01-${carouselRatio}.${extension} … ${preview}-s${String(
                    carouselSlideCount,
                  ).padStart(2, "0")}-${carouselRatio}.${extension}`
                : `${preview}.${extension}`}
            </strong>
          </div>
          {error ? <p className="studio-creative-filename-error" role="alert">{error}</p> : null}
          <div className="studio-creative-filename-actions">
            <button className="studio-button is-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="studio-button is-primary" type="submit">
              {carouselSlideCount
                ? `Export ${carouselSlideCount}-slide ZIP`
                : `Export ${extension.toUpperCase()}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DocumentEditor({
  project,
  onChange,
  onBack,
  onDelete,
  onShare,
  cloud,
  unsplash,
  onBusyChange,
}) {
  const [activePageId, setActivePageId] = useState(project.pages?.[0]?.id || "");
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [creativeFilenameEnabled, setCreativeFilenameEnabled] =
    useCreativeFilenamePreference();
  const [exportState, setExportState] = useState({status: "", message: ""});
  const [exportProject, setExportProject] = useState(null);
  const [layoutWarning, setLayoutWarning] = useState("");
  const latestProjectRef = useRef(project);
  latestProjectRef.current = project;
  const exportPageRefs = useRef(new Map());
  const printPagesRef = useRef(null);
  const pages = project.pages || [];
  const activePage =
    pages.find((page) => page.id === activePageId) || pages[0] || null;
  const activeIndex = activePage
    ? pages.findIndex((page) => page.id === activePage.id)
    : -1;
  const warnings = [...getProjectWarnings(project), ...(layoutWarning ? [layoutWarning] : [])];

  useEffect(() => {
    if (!pages.length) return;
    if (!pages.some((page) => page.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [activePageId, pages]);

  const updateProject = (changes) => {
    const latest = latestProjectRef.current;
    const next = {...latest, ...(typeof changes === "function" ? changes(latest) : changes), updatedAt: new Date().toISOString()};
    latestProjectRef.current = next;
    onChange(next);
  };
  const updatePage = (pageId, changes) => updateProject((latest) => ({
    pages: latest.pages.map((page) => page.id === pageId
      ? {...page, ...(typeof changes === "function" ? changes(page) : changes)} : page),
  }));
  const addPage = (templateId) => {
    if (pages.length >= 20) return;
    const page = createDocumentPage(templateId);
    updateProject({pages: [...pages, page]});
    setActivePageId(page.id);
    setShowPagePicker(false);
  };
  const duplicatePage = () => {
    if (!activePage || pages.length >= 20) return;
    const duplicate = createDocumentPage(
      activePage.templateId,
      activePage.content,
    );
    const nextPages = [...pages];
    nextPages.splice(activeIndex + 1, 0, duplicate);
    updateProject({pages: nextPages});
    setActivePageId(duplicate.id);
  };
  const deletePage = () => {
    if (!activePage || pages.length <= 1) return;
    const confirmed = window.confirm(
      `Delete page ${activeIndex + 1}, “${activePage.content?.title || getTemplateById(activePage.templateId).name}”?`,
    );
    if (!confirmed) return;
    const nextPages = pages.filter((page) => page.id !== activePage.id);
    const nextActive = nextPages[Math.min(activeIndex, nextPages.length - 1)];
    updateProject({pages: nextPages});
    setActivePageId(nextActive.id);
  };
  const movePage = (direction) => {
    const targetIndex = activeIndex + direction;
    if (activeIndex < 0 || targetIndex < 0 || targetIndex >= pages.length) {
      return;
    }
    const nextPages = [...pages];
    [nextPages[activeIndex], nextPages[targetIndex]] = [
      nextPages[targetIndex],
      nextPages[activeIndex],
    ];
    updateProject({pages: nextPages});
  };
  const exportPdf = async (filenameBase = "") => {
    setShowFilenameDialog(false);
    setExportState({status: "working", message: "Preparing every page…"});
    let exportMounted = false;
    try {
      const snapshot = structuredClone(latestProjectRef.current);
      exportPageRefs.current.clear();
      flushSync(() => {
        setExportProject(snapshot);
        onBusyChange(true);
      });
      exportMounted = true;
      const {exportDocumentPdf} = await loadStudioExports();
      await waitForPreviewMount();
      const elements = snapshot.pages.map((page) => exportPageRefs.current.get(page.id));
      const result = await exportDocumentPdf(snapshot, elements, {
        resolvePlanningCenterImage: (cloud || unsplash)
          ?.resolvePlanningCenterImage,
        filenameBase,
      });
      setExportState({
        status: "success",
        message: `${result.filename} was downloaded with ${result.pages} page${
          result.pages === 1 ? "" : "s"
        }.`,
      });
    } catch (error) {
      setExportState({
        status: "error",
        message: error.message || "Studio could not export this document.",
      });
    } finally {
      if (exportMounted) {
        flushSync(() => {
          setExportProject(null);
          onBusyChange(false);
        });
      }
    }
  };
  const requestPdfExport = () => {
    if (creativeFilenameEnabled) {
      setShowFilenameDialog(true);
      return;
    }
    exportPdf();
  };
  const systemPrint = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setExportState({
        status: "error",
        message: "Allow pop-ups for Central Studio to use System Print.",
      });
      return;
    }
    setExportState({status: "working", message: "Preparing System Print…"});
    let exportMounted = false;
    try {
      const snapshot = structuredClone(latestProjectRef.current);
      exportPageRefs.current.clear();
      flushSync(() => {
        setExportProject(snapshot);
        onBusyChange(true);
      });
      exportMounted = true;
      const {openDocumentSystemPrint} = await loadStudioExports();
      await waitForPreviewMount();
      await openDocumentSystemPrint(snapshot, printPagesRef.current, {
        printWindow,
        resolvePlanningCenterImage: (cloud || unsplash)
          ?.resolvePlanningCenterImage,
      });
      setExportState({
        status: "success",
        message: "System Print opened with the document pages only.",
      });
    } catch (error) {
      setExportState({
        status: "error",
        message: error.message || "Studio could not open System Print.",
      });
      printWindow?.close();
    } finally {
      if (exportMounted) {
        flushSync(() => {
          setExportProject(null);
          onBusyChange(false);
        });
      }
    }
  };

  return (
    <main className="studio-editor is-document-editor">
      <div className="studio-editor-titlebar">
        <div>
          <span className="studio-kicker">MULTI-PAGE DOCUMENT</span>
          <h1>{project.name}</h1>
        </div>
        <div className="studio-editor-title-actions">
          <StatusPill tone="draft">
            {pages.length} PAGE{pages.length === 1 ? "" : "S"}
          </StatusPill>
          <button
            className="studio-button is-primary"
            type="button"
            disabled={warnings.length > 0 || exportState.status === "working"}
            onClick={requestPdfExport}
          >
            {exportState.status === "working" ? "Preparing PDF…" : "Export PDF"}
          </button>
          {!project.shared ? (
            <button
              className="studio-button is-secondary"
              onClick={() => onShare(project.id)}
              disabled={!cloud || !project.cloudBacked}
            >
              Share
            </button>
          ) : (
            <StatusPill>SHARED WITH YOU</StatusPill>
          )}
          <button
            className="studio-button is-danger"
            onClick={() => onDelete(project.id)}
          >
            {project.shared ? "Leave" : "Delete"}
          </button>
          <button className="studio-button is-secondary" onClick={onBack}>
            Finish for Now
          </button>
        </div>
      </div>

      <div className="studio-document-filename-preference">
        <CreativeFilenameToggle
          checked={creativeFilenameEnabled}
          onChange={setCreativeFilenameEnabled}
        />
      </div>

      {exportState.message ? (
        <p
          className={`studio-export-status studio-document-export-status is-${exportState.status}`}
          role={exportState.status === "error" ? "alert" : "status"}
        >
          {exportState.message}
        </p>
      ) : null}

      {warnings.length ? <div className="studio-document-warnings" role="alert">
        {warnings.map((warning) => <p key={warning}>{warning}</p>)}
      </div> : null}

      <div className="studio-document-workspace">
        <nav className="studio-page-rail" aria-label="Document pages">
          <div className="studio-page-rail-heading">
            <span>PAGES</span>
            <button
              type="button"
              onClick={() => setShowPagePicker(true)}
              disabled={pages.length >= 20}
            >
              + Add Page
            </button>
          </div>
          <div className="studio-page-thumbnails">
            {pages.map((page, index) => (
              <button
                type="button"
                key={page.id}
                className={page.id === activePage?.id ? "is-active" : ""}
                aria-current={page.id === activePage?.id ? "page" : undefined}
                onClick={() => setActivePageId(page.id)}
              >
                <span>{index + 1}</span>
                <div className="studio-page-thumbnail-preview" aria-hidden="true">
                  <DocumentPagePreview
                    page={page}
                    pageNumber={index + 1}
                    pageCount={pages.length}
                    showPageNumbers={
                      project.documentSettings?.showPageNumbers !== false
                    }
                  />
                </div>
                <strong>{getTemplateById(page.templateId).name}</strong>
              </button>
            ))}
          </div>
          <div className="studio-page-actions">
            <button
              type="button"
              onClick={() => movePage(-1)}
              disabled={activeIndex <= 0}
            >
              ↑
              <span>Move up</span>
            </button>
            <button
              type="button"
              onClick={() => movePage(1)}
              disabled={activeIndex < 0 || activeIndex >= pages.length - 1}
            >
              ↓
              <span>Move down</span>
            </button>
            <button
              type="button"
              onClick={duplicatePage}
              disabled={!activePage || pages.length >= 20}
            >
              ⧉
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={deletePage}
              disabled={pages.length <= 1}
            >
              ×
              <span>Delete page</span>
            </button>
          </div>
        </nav>

        <section className="studio-document-canvas-panel">
          <div className="studio-preview-toolbar">
            <div>
              <span>PAGE {activeIndex + 1}</span>
              <strong>
                {activePage
                  ? getTemplateById(activePage.templateId).name
                  : "US Letter"}
              </strong>
            </div>
            {warnings.length ? (
              <StatusPill tone="warning">
                {warnings.length} CHECK{warnings.length === 1 ? "" : "S"}
              </StatusPill>
            ) : (
              <StatusPill tone="ready">READY</StatusPill>
            )}
          </div>
          <div
            className="studio-preview-stage studio-document-preview-stage"
          >
            {activePage ? (
              <DocumentPagePreview
                key={activePage.id}
                onLayoutWarning={setLayoutWarning}
                page={activePage}
                pageNumber={activeIndex + 1}
                pageCount={pages.length}
                showPageNumbers={
                  project.documentSettings?.showPageNumbers !== false
                }
              />
            ) : null}
          </div>
          <div className="studio-document-canvas-footer">
            <ToggleField
              label="Page numbers"
              description="Show the current page and total in every document footer."
              checked={project.documentSettings?.showPageNumbers !== false}
              onChange={(showPageNumbers) =>
                updateProject({
                  documentSettings: {
                    ...project.documentSettings,
                    showPageNumbers,
                  },
                })
              }
            />
            <button
              className="studio-button is-secondary"
              type="button"
              onClick={systemPrint}
              disabled={warnings.length > 0 || exportState.status === "working"}
            >
              System Print
            </button>
          </div>
        </section>

        <aside className="studio-document-inspector">
          <div className="studio-document-inspector-header">
            <div>
              <span>EDIT PAGE {activeIndex + 1}</span>
              <strong>
                {activePage
                  ? getTemplateById(activePage.templateId).name
                  : "Page"}
              </strong>
            </div>
            <InputField
              label="Project name"
              value={project.name}
              maxLength={80}
              onChange={(name) => updateProject({name})}
            />
          </div>
          {activePage ? (
            <DocumentPageInspector
              key={activePage.id}
              page={activePage}
              updatePage={(changes) => updatePage(activePage.id, changes)}
              project={project}
              cloud={cloud}
              services={cloud || unsplash}
            />
          ) : null}
        </aside>
      </div>

      {exportProject ? <div
        ref={printPagesRef}
        className="studio-document-export-pages"
        data-studio-document-print
        aria-hidden="true"
      >
        {exportProject.pages.map((page, index) => (
          <DocumentPagePreview
            key={page.id}
            page={page}
            pageNumber={index + 1}
            pageCount={exportProject.pages.length}
            showPageNumbers={exportProject.documentSettings?.showPageNumbers !== false}
            previewRef={(element) => {
              if (element) exportPageRefs.current.set(page.id, element);
              else exportPageRefs.current.delete(page.id);
            }}
          />
        ))}
      </div> : null}

      {showPagePicker ? (
        <AddPageDialog
          onAdd={addPage}
          onClose={() => setShowPagePicker(false)}
        />
      ) : null}
      {showFilenameDialog ? (
        <CreativeFilenameDialog
          project={project}
          extension="pdf"
          onClose={() => setShowFilenameDialog(false)}
          onConfirm={exportPdf}
        />
      ) : null}
    </main>
  );
}

function EventToolSideSheet({eyebrow, title, label, onClose, children}) {
  return (
    <aside
      className="studio-event-side-sheet studio-event-tool-sheet"
      aria-label={label}
    >
      <div className="studio-event-sheet-header">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${label}`}>
          ×
        </button>
      </div>
      <div className="studio-event-sheet-content">{children}</div>
    </aside>
  );
}

function SocialProjectBriefSheet({project, updateProject, onClose}) {
  const isCarousel = project.postMode === "carousel";
  const setPostMode = (postMode) => {
    if (
      postMode === "single" &&
      (project.carouselSlides || []).length &&
      !window.confirm("Switch to a single post and remove the additional slides?")
    ) {
      return;
    }
    updateProject({
      postMode,
      carouselSlides: postMode === "carousel" ? project.carouselSlides || [] : [],
    });
  };
  return (
    <aside className="studio-event-side-sheet" aria-label="Project brief">
      <div className="studio-event-sheet-header">
        <div>
          <span>PROJECT BRIEF</span>
          <h2>Frame the message</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close project brief">
          ×
        </button>
      </div>
      <div className="studio-event-sheet-content">
        <p className="studio-event-sheet-intro">
          Social Posts keep the message simple: a short scripture, quote, or
          statement; a controlled composition; and the fixed CrossPointe brand
          mark. Click the text directly on the canvas to edit it.
        </p>
        <InputField
          label="Project name"
          value={project.name}
          maxLength={80}
          wide
          onChange={(name) => updateProject({name})}
          hint="This identifies the project in Studio and does not appear on the post."
        />
        <div className="studio-hero-mode" role="group" aria-label="Social post type">
          <button
            className={!isCarousel ? "is-active" : ""}
            type="button"
            aria-pressed={!isCarousel}
            onClick={() => setPostMode("single")}
          >
            <strong>Single Post</strong>
            <span>Create and export one social graphic.</span>
          </button>
          <button
            className={isCarousel ? "is-active" : ""}
            type="button"
            aria-pressed={isCarousel}
            onClick={() => setPostMode("carousel")}
          >
            <strong>Carousel</strong>
            <span>
              Keep up to {MAX_SOCIAL_CAROUSEL_SLIDES} slides in this Studio
              project.
            </span>
          </button>
        </div>
        <div className="studio-event-brief-summary">
          <div>
            <span>Template</span>
            <strong>{getTemplateById(project.templateId).name}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>Manual social copy</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function GraphicDocumentBriefSheet({project, updateProject, onClose}) {
  return (
    <aside className="studio-event-side-sheet" aria-label="Project brief">
      <div className="studio-event-sheet-header">
        <div>
          <span>PROJECT BRIEF</span>
          <h2>Introduce the group</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close project brief">
          ×
        </button>
      </div>
      <div className="studio-event-sheet-content">
        <p className="studio-event-sheet-intro">
          This 16:9 Directory graphic keeps the CrossPointe logo at bottom left
          and the group name, leaders, and meeting details at top right. Use the
          built-in Pointe Groups background or add a leader photo.
        </p>
        <InputField
          label="Project name"
          value={project.name}
          maxLength={80}
          wide
          onChange={(name) => updateProject({name})}
          hint="This identifies the project in Studio and does not appear on the graphic."
        />
        <div className="studio-event-brief-summary">
          <div>
            <span>Template</span>
            <strong>{getTemplateById(project.templateId).name}</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>16:9 Small Group Directory</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function EventProjectBriefSheet({
  project,
  updateProject,
  services,
  onClose,
}) {
  const isPlanningCenterLinked = project.sourceType === "planning-center";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [eventState, setEventState] = useState({
    status: "idle",
    events: [],
    message: "",
  });

  const matchingEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return eventState.events;
    return eventState.events.filter((event) =>
      planningCenterEventSearchText(event).includes(normalizedQuery),
    );
  }, [eventState.events, query]);

  const loadEvents = async () => {
    if (!services?.loadPlanningCenterEvents) {
      setEventState({
        status: "error",
        events: [],
        message: "Planning Center events are unavailable in this Studio session.",
      });
      return [];
    }
    setEventState((current) => ({
      ...current,
      status: "loading",
      message:
        "Loading the next 60 days of Central events from Planning Center…",
    }));
    try {
      const events = await services.loadPlanningCenterEvents();
      setEventState({
        status: "ready",
        events,
        message: events.length
          ? `${events.length} Central event${
            events.length === 1 ? "" : "s"
          } available in the next 60 days.`
          : "No Central-tagged Planning Center events were found " +
            "in the next 60 days.",
      });
      return events;
    } catch (error) {
      setEventState({
        status: "error",
        events: [],
        message:
          error.message ||
          "Studio could not load Planning Center events right now.",
      });
      return [];
    }
  };

  const openPlanningCenterPicker = async () => {
    setPickerOpen(true);
    if (eventState.status === "idle") await loadEvents();
  };

  const applyPlanningCenterEvent = (event) => {
    const importedAt = new Date().toISOString();
    updateProject({
      name: project.name.startsWith("Untitled ")
        ? event.title.slice(0, 80)
        : project.name,
      sourceType: "planning-center",
      sourceId: event.id,
      sourceEventId: event.eventId,
      sourceUrl: event.publicUrl,
      sourceUpdatedAt: importedAt,
      content: {
        ...project.content,
        ...planningCenterEventContentChanges(event, project.content),
      },
    });
    setPickerOpen(false);
    setQuery("");
  };

  const refreshLinkedEvent = async () => {
    const events = await loadEvents();
    const linkedEvent = events.find((event) => event.id === project.sourceId);
    if (!linkedEvent) {
      setEventState((current) => ({
        ...current,
        status: "error",
        message:
          "The linked occurrence is no longer in Studio’s 60-day " +
          "Planning Center event feed.",
      }));
      return;
    }
    applyPlanningCenterEvent(linkedEvent);
  };

  const useManualSource = () => {
    updateProject({
      sourceType: "manual",
      sourceId: "",
      sourceEventId: "",
      sourceUrl: "",
      sourceUpdatedAt: "",
    });
    setPickerOpen(false);
    setQuery("");
  };

  const sourceRefreshLabel = project.sourceUpdatedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(project.sourceUpdatedAt))
    : "";

  return (
    <aside
      className="studio-event-side-sheet"
      aria-label="Project brief"
    >
      <div className="studio-event-sheet-header">
        <div>
          <span>PROJECT BRIEF</span>
          <h2>Ground the design</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close project brief">
          ×
        </button>
      </div>
      <div className="studio-event-sheet-content">
        <p className="studio-event-sheet-intro">
          Choose a Central event in the next 60 days to import its Planning
          Center facts.
          Refreshing replaces event copy, while the template, palette, format,
          font, imagery, and composition stay under Studio’s control.
        </p>
        <div className="studio-source-options">
          <button
            className={[
              "studio-source-option",
              !isPlanningCenterLinked ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={useManualSource}
          >
            <span className="studio-source-radio" aria-hidden="true" />
            <span>
              <strong>Manual event details</strong>
              <small>
                Keep the current copy editable without an authoritative source
                link.
              </small>
            </span>
            {!isPlanningCenterLinked ? (
              <StatusPill tone="ready">SELECTED</StatusPill>
            ) : null}
          </button>
          <button
            className={[
              "studio-source-option",
              isPlanningCenterLinked ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={openPlanningCenterPicker}
          >
            <span className="studio-source-radio" aria-hidden="true" />
            <span>
              <strong>Central / Planning Center event</strong>
              <small>
                Import and refresh approved public event facts from Central’s
                Planning Center feed.
              </small>
            </span>
            <StatusPill tone={isPlanningCenterLinked ? "ready" : "draft"}>
              {isPlanningCenterLinked ? "LINKED" : "CHOOSE EVENT"}
            </StatusPill>
          </button>
        </div>

        {isPlanningCenterLinked ? (
          <div className="studio-pco-linked-event">
            <div>
              <span>LINKED EVENT</span>
              <strong>{project.content.title}</strong>
              <small>
                {[project.content.date, project.content.time]
                  .filter(Boolean)
                  .join(" · ")}
                {sourceRefreshLabel ? ` · Refreshed ${sourceRefreshLabel}` : ""}
              </small>
            </div>
            <div>
              <button
                className="studio-button is-secondary"
                type="button"
                disabled={eventState.status === "loading"}
                onClick={refreshLinkedEvent}
              >
                {eventState.status === "loading"
                  ? "Refreshing…"
                  : "Refresh facts"}
              </button>
              <button
                className="studio-button is-secondary"
                type="button"
                onClick={openPlanningCenterPicker}
              >
                Change event
              </button>
            </div>
          </div>
        ) : null}

        {pickerOpen ? (
          <div className="studio-pco-event-picker">
            <div className="studio-pco-event-picker-heading">
              <div>
                <span>PLANNING CENTER EVENTS</span>
                <strong>Choose an occurrence</strong>
              </div>
              <button
                type="button"
                aria-label="Close Planning Center event picker"
                onClick={() => setPickerOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="studio-pco-event-search">
              <span>Search events</span>
              <input
                value={query}
                type="search"
                placeholder="Title, date, or location"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {eventState.message ? (
              <p
                className={`studio-pco-event-status is-${eventState.status}`}
                role={eventState.status === "error" ? "alert" : "status"}
              >
                {eventState.message}
              </p>
            ) : null}
            <div className="studio-pco-event-results">
              {matchingEvents.map((event) => (
                <button
                  key={event.id}
                  className={
                    project.sourceId === event.id ? "is-selected" : ""
                  }
                  type="button"
                  onClick={() => applyPlanningCenterEvent(event)}
                >
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {[event.date, event.time].filter(Boolean).join(" · ")}
                    </small>
                    {event.location ? <small>{event.location}</small> : null}
                  </span>
                  <b>{project.sourceId === event.id ? "CURRENT" : "USE"}</b>
                </button>
              ))}
              {eventState.status === "ready" && !matchingEvents.length ? (
                <p>No events match that search.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <InputField
          label="Project name"
          value={project.name}
          maxLength={80}
          wide
          onChange={(name) => updateProject({name})}
          hint="This identifies the project in Studio and does not appear on the graphic."
        />
        <div className="studio-event-brief-summary">
          <div>
            <span>Template</span>
            <strong>{getTemplateById(project.templateId).name}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>
              {isPlanningCenterLinked
                ? "Planning Center · linked occurrence"
                : "Manual foundation"}
            </strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function EventReviewSheet({
  project,
  warnings,
  exportState,
  creativeFilenameEnabled,
  onCreativeFilenameChange,
  onClose,
  onExport,
  exportLabel = "Export High-Res PNG",
}) {
  const isExporting = exportState.status === "working";
  return (
    <aside className="studio-event-side-sheet" aria-label="Review checks">
      <div className="studio-event-sheet-header">
        <div>
          <span>REVIEW</span>
          <h2>{warnings.length ? "A few details need attention" : "Ready to export"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close review">
          ×
        </button>
      </div>
      <div className="studio-event-sheet-content">
        <div className="studio-review-summary">
          <div>
            <span>Template</span>
            <strong>{getTemplateById(project.templateId).name}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>
              {project.content.format === "screen"
                ? "16:9"
                : project.content.format === "portrait"
                  ? "4:5"
                  : "1:1"}
            </strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{project.status || "draft"}</strong>
          </div>
        </div>
        <div
          className={`studio-review-checks${warnings.length ? " has-warnings" : ""}`}
        >
          {warnings.length ? (
            warnings.map((warning) => (
              <div key={warning}>
                <span aria-hidden="true">!</span>
                <p>{warning}</p>
              </div>
            ))
          ) : (
            <>
              <div>
                <span aria-hidden="true">✓</span>
                <p>Required content is present.</p>
              </div>
              <div>
                <span aria-hidden="true">✓</span>
                <p>The selected format uses a deterministic composition.</p>
              </div>
            </>
          )}
        </div>
        <CreativeFilenameToggle
          checked={creativeFilenameEnabled}
          onChange={onCreativeFilenameChange}
          compact
        />
        <button
          className="studio-button is-primary studio-event-sheet-export"
          type="button"
          disabled={warnings.length > 0 || isExporting}
          onClick={onExport}
        >
          {isExporting ? "Preparing High-Res PNG…" : exportLabel}
        </button>
        {exportState.message ? (
          <p
            className={`studio-export-status is-${exportState.status}`}
            role={exportState.status === "error" ? "alert" : "status"}
          >
            {exportState.message}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function SocialCarouselRail({
  slides,
  activeSlideId,
  onSelect,
  onAdd,
  onDuplicate,
  onMove,
  onDelete,
}) {
  const activeIndex = slides.findIndex((slide) => slide.id === activeSlideId);
  return (
    <nav className="studio-social-slide-rail" aria-label="Carousel slides">
      <div className="studio-social-slide-heading">
        <span>CAROUSEL</span>
        <strong>{slides.length}/{MAX_SOCIAL_CAROUSEL_SLIDES} slides</strong>
      </div>
      <div className="studio-social-slide-list">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            className={slide.id === activeSlideId ? "is-active" : ""}
            type="button"
            aria-label={`Edit slide ${index + 1}`}
            aria-current={slide.id === activeSlideId ? "true" : undefined}
            onClick={() => onSelect(slide.id)}
          >
            <span>{index + 1}</span>
            <strong>{slide.content?.title || slide.content?.heroLogoName || "Untitled"}</strong>
          </button>
        ))}
      </div>
      <div className="studio-social-slide-actions">
        <button type="button" disabled={activeIndex <= 0} onClick={() => onMove(-1)}>
          ← <span>Move</span>
        </button>
        <button
          type="button"
          disabled={activeIndex < 0 || activeIndex >= slides.length - 1}
          onClick={() => onMove(1)}
        >
          → <span>Move</span>
        </button>
        <button
          type="button"
          disabled={slides.length >= MAX_SOCIAL_CAROUSEL_SLIDES}
          onClick={onDuplicate}
        >
          ⧉ <span>Duplicate</span>
        </button>
        <button
          type="button"
          disabled={slides.length >= MAX_SOCIAL_CAROUSEL_SLIDES}
          onClick={onAdd}
        >
          + <span>Add</span>
        </button>
        <button type="button" disabled={slides.length <= 1} onClick={onDelete}>
          × <span>Delete</span>
        </button>
      </div>
    </nav>
  );
}

function EventStudioEditor({
  project,
  onChange,
  onBack,
  onDelete,
  onShare,
  cloud,
  unsplash,
  saveState,
  canManageLogoLibrary,
  onBusyChange,
}) {
  const [selectedField, setSelectedField] = useState("");
  const [activePanel, setActivePanel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const eventMenuRef = useRef(null);
  const [sideSheet, setSideSheet] = useState(
    project.name.startsWith("Untitled ") ? "brief" : "",
  );
  const [renderedWorkspacePanel, setRenderedWorkspacePanel] = useState(
    project.name.startsWith("Untitled ") ? "brief" : "",
  );
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [creativeFilenameEnabled, setCreativeFilenameEnabled] =
    useCreativeFilenamePreference();
  const [exportState, setExportState] = useState({status: "", message: ""});
  const [activeSlideId, setActiveSlideId] = useState("primary");
  const [layoutWarnings, setLayoutWarnings] = useState({});
  const [exportProject, setExportProject] = useState(null);
  const snapshotSlides = exportProject
    ? isSocialTemplateId(exportProject.templateId) &&
      exportProject.postMode === "carousel"
      ? getSocialProjectSlides(exportProject)
      : [{id: "primary", content: exportProject.content}]
    : [];
  const eventExportRefs = useRef(new Map());
  const latestProjectRef = useRef(project);
  latestProjectRef.current = project;
  const workspacePanelFrameRef = useRef(null);
  const workspacePanelTimerRef = useRef(null);
  const template = getTemplateById(project.templateId);
  const isSocial = template.kind === "social";
  const isCarousel = isSocial && project.postMode === "carousel";
  const slides = getSocialProjectSlides(project);
  const exportSlides = isCarousel
    ? slides
    : [{id: "primary", content: project.content}];
  const warnings = [
    ...getProjectWarnings(project),
    ...(template.variant === "simple-statement"
      ? exportSlides.flatMap((slide, index) => {
          const measured = layoutWarnings[`${project.id}:${slide.id}`];
          const warning = measured?.content === slide.content ? measured.message : "";
          return warning ? [`${isCarousel ? `Slide ${index + 1}: ` : ""}${warning}`] : [];
        })
      : []),
  ];
  const activeSlide = isCarousel
    ? slides.find((slide) => slide.id === activeSlideId) || slides[0]
    : slides[0];
  const activeContent = activeSlide?.content || project.content;
  const textFieldOptions = getGraphicTextFields(template);
  const hiddenTextFields = ["eyebrow", "subtitle"].filter(
    (field) => activeContent[`${field}Visible`] === false,
  );
  const activeSlideIndex = slides.findIndex(
    (slide) => slide.id === activeSlide?.id,
  );
  const isGraphicDocument = template.editorKind === "graphic";
  const formatLabel =
    activeContent.format === "screen"
      ? "16:9"
      : activeContent.format === "portrait"
        ? "4:5"
        : "1:1";
  const requestedWorkspacePanel = activePanel || sideSheet;

  const updateProject = (changes) => {
    onChange({...project, ...changes, updatedAt: new Date().toISOString()});
  };
  const applySlides = (nextSlides) => {
    if (!nextSlides.length) return [];
    const normalizedSlides = nextSlides.map((slide, index) =>
      index === 0
        ? {...slide, id: "primary"}
        : slide.id === "primary"
          ? createSocialCarouselSlide(slide.content)
          : slide,
    );
    updateProject({
      postMode: "carousel",
      content: normalizedSlides[0].content,
      carouselSlides: normalizedSlides.slice(1),
    });
    return normalizedSlides;
  };
  const updateContentForSlide = (slideId, changes) => {
    const latestProject = latestProjectRef.current;
    const latestIsCarousel =
      isSocialTemplateId(latestProject.templateId) &&
      latestProject.postMode === "carousel";
    const latestSlides = getSocialProjectSlides(latestProject);
    if (!latestIsCarousel) {
      onChange({
        ...latestProject,
        content: {...latestProject.content, ...changes},
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (!latestSlides.some((slide) => slide.id === slideId)) return;
    const nextSlides = latestSlides.map((slide) => ({
      ...slide,
      content: {
        ...slide.content,
        ...(slide.id === slideId ? changes : {}),
        ...(Object.hasOwn(changes, "format") ? {format: changes.format} : {}),
      },
    }));
    const normalizedSlides = nextSlides.map((slide, index) =>
      index === 0
        ? {...slide, id: "primary"}
        : slide.id === "primary"
          ? createSocialCarouselSlide(slide.content)
          : slide,
    );
    onChange({
      ...latestProject,
      postMode: "carousel",
      content: normalizedSlides[0].content,
      carouselSlides: normalizedSlides.slice(1),
      updatedAt: new Date().toISOString(),
    });
  };
  const updateContent = (changes) =>
    updateContentForSlide(activeSlide?.id || "primary", changes);
  const addSlide = () => {
    if (!activeSlide || slides.length >= MAX_SOCIAL_CAROUSEL_SLIDES) return;
    const slide = createSocialCarouselSlide({
      ...activeSlide.content,
      title: "New slide",
      heroMode: "text",
      heroLogo: "",
      heroLogoSource: "",
      heroLogoLibraryId: "",
      heroLogoStoragePath: "",
      heroLogoName: "",
    });
    const nextSlides = [...slides];
    nextSlides.splice(activeSlideIndex + 1, 0, slide);
    applySlides(nextSlides);
    setActiveSlideId(slide.id);
  };
  const duplicateSlide = () => {
    if (!activeSlide || slides.length >= MAX_SOCIAL_CAROUSEL_SLIDES) return;
    const slide = createSocialCarouselSlide(activeSlide.content);
    const nextSlides = [...slides];
    nextSlides.splice(activeSlideIndex + 1, 0, slide);
    applySlides(nextSlides);
    setActiveSlideId(slide.id);
  };
  const deleteSlide = () => {
    if (!activeSlide || slides.length <= 1) return;
    if (!window.confirm(`Delete slide ${activeSlideIndex + 1}?`)) return;
    const nextSlides = slides.filter((slide) => slide.id !== activeSlide.id);
    const normalizedSlides = applySlides(nextSlides);
    setActiveSlideId(
      normalizedSlides[Math.min(activeSlideIndex, normalizedSlides.length - 1)].id,
    );
  };
  const moveSlide = (direction) => {
    const targetIndex = activeSlideIndex + direction;
    if (activeSlideIndex < 0 || targetIndex < 0 || targetIndex >= slides.length) {
      return;
    }
    const nextSlides = [...slides];
    [nextSlides[activeSlideIndex], nextSlides[targetIndex]] = [
      nextSlides[targetIndex],
      nextSlides[activeSlideIndex],
    ];
    const normalizedSlides = applySlides(nextSlides);
    setActiveSlideId(normalizedSlides[targetIndex].id);
  };
  const openSideSheet = (sheet) => {
    setSideSheet(sheet);
    setActivePanel("");
    setSelectedField("");
    setMenuOpen(false);
  };

  useEffect(() => {
    setSelectedField("");
    setActivePanel("");
    setMenuOpen(false);
    setSideSheet(project.name.startsWith("Untitled ") ? "brief" : "");
    setActiveSlideId("primary");
  }, [project.id]);

  useEffect(() => {
    if (!isCarousel) {
      setActiveSlideId("primary");
      return;
    }
    if (!slides.some((slide) => slide.id === activeSlideId)) {
      setActiveSlideId(slides[0]?.id || "primary");
    }
  }, [activeSlideId, isCarousel, slides]);

  useEffect(() => {
    window.cancelAnimationFrame(workspacePanelFrameRef.current);
    window.clearTimeout(workspacePanelTimerRef.current);

    if (requestedWorkspacePanel) {
      setRenderedWorkspacePanel(requestedWorkspacePanel);
      workspacePanelFrameRef.current = window.requestAnimationFrame(() => {
        setWorkspacePanelOpen(true);
      });
    } else {
      setWorkspacePanelOpen(false);
      workspacePanelTimerRef.current = window.setTimeout(() => {
        setRenderedWorkspacePanel("");
      }, EVENT_PANEL_TRANSITION_MS);
    }

    return () => {
      window.cancelAnimationFrame(workspacePanelFrameRef.current);
      window.clearTimeout(workspacePanelTimerRef.current);
    };
  }, [requestedWorkspacePanel]);

  useEffect(() => {
    const closeTransientUi = (event) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setActivePanel("");
      setSideSheet("");
      setSelectedField("");
    };
    const closeMenuOnOutsideClick = (event) => {
      if (eventMenuRef.current && !eventMenuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeTransientUi);
    document.addEventListener("mousedown", closeMenuOnOutsideClick);
    return () => {
      window.removeEventListener("keydown", closeTransientUi);
      document.removeEventListener("mousedown", closeMenuOnOutsideClick);
    };
  }, []);

  const runExport = async (filenameBase = "") => {
    setShowFilenameDialog(false);
    setSelectedField("");
    setActivePanel("");
    setMenuOpen(false);
    setSideSheet("");
    let exportMounted = false;
    try {
      const snapshot = structuredClone(latestProjectRef.current);
      const snapshotIsCarousel =
        isSocialTemplateId(snapshot.templateId) &&
        snapshot.postMode === "carousel";
      setExportState({
        status: "working",
        message: snapshotIsCarousel
          ? "Preparing the carousel ZIP…"
          : "Preparing the high-resolution PNG…",
      });
      eventExportRefs.current.clear();
      flushSync(() => {
        setExportProject(snapshot);
        onBusyChange(true);
      });
      exportMounted = true;
      const {exportCarouselZip, exportEventPng} = await loadStudioExports();
      await waitForPreviewMount();
      const result = snapshotIsCarousel
        ? await exportCarouselZip(
            snapshot,
            getSocialProjectSlides(snapshot).map((slide) => eventExportRefs.current.get(slide.id)),
            {filenameBase},
          )
        : await exportEventPng(snapshot, eventExportRefs.current.get("primary"), {
            filenameBase,
          });
      setExportState({
        status: "success",
        message: snapshotIsCarousel
          ? `Studio downloaded ${result.filename} with ${result.slides} slide PNGs.`
          : `${result.filename} was downloaded at ${result.width} × ${result.height}px.`,
      });
    } catch (error) {
      setExportState({
        status: "error",
        message:
          error.message ||
          "Studio could not export this project. Try removing the background image and exporting again.",
      });
    } finally {
      if (exportMounted) {
        flushSync(() => {
          setExportProject(null);
          onBusyChange(false);
        });
      }
    }
  };
  const requestExport = () => {
    if (creativeFilenameEnabled) {
      setMenuOpen(false);
      setShowFilenameDialog(true);
      return;
    }
    runExport();
  };

  return (
    <main
      className={`studio-event-editor${isSocial ? " is-social-editor" : ""}`}
    >
      <header className="studio-event-editor-topbar">
        <div className="studio-event-editor-menu-area">
          <div className="studio-event-menu-wrap" ref={eventMenuRef}>
            <button
              className="studio-event-menu-button"
              type="button"
              aria-label="Open project menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            {menuOpen ? (
              <div className="studio-event-project-menu" role="menu">
                <div>
                  <span>{template.name}</span>
                  <strong>{project.name}</strong>
                </div>
                <a href="/" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span aria-hidden="true">⌂</span>
                  Central
                </a>
                <a href="/admin" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span aria-hidden="true">⚙</span>
                  Admin
                </a>
                <a href="/planner" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span aria-hidden="true">□</span>
                  Planner
                </a>
                <div className="studio-event-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openSideSheet("brief");
                  }}
                >
                  <span aria-hidden="true">◇</span>
                  Project Brief
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openSideSheet("review");
                  }}
                >
                  <span aria-hidden="true">✓</span>
                  Review checks
                  {warnings.length ? <i>{warnings.length}</i> : null}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!cloud || !project.cloudBacked || project.shared}
                  onClick={() => {
                    onShare(project.id);
                    setMenuOpen(false);
                  }}
                >
                  <span aria-hidden="true">↗</span>
                  Share project
                </button>
                <div className="studio-event-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={warnings.length > 0 || exportState.status === "working"}
                  onClick={requestExport}
                >
                  <span aria-hidden="true">↓</span>
                  {isCarousel ? "Export Carousel" : "Export PNG"}
                </button>
                <button type="button" role="menuitem" onClick={onBack}>
                  <span aria-hidden="true">←</span>
                  All projects
                </button>
                <div className="studio-event-menu-divider" />
                <button
                  className="is-danger"
                  type="button"
                  role="menuitem"
                  onClick={() => onDelete(project.id)}
                >
                  <span aria-hidden="true">×</span>
                  {project.shared ? "Leave project" : "Delete project"}
                </button>
              </div>
            ) : null}
          </div>
          <button
            className="studio-event-back-button"
            type="button"
            onClick={onBack}
            aria-label="Return to Studio projects"
          >
            <img src="/favicon.svg" alt="" />
            <span>
              <strong>Central</strong>
              <b>Studio</b>
            </span>
          </button>
        </div>

        <div className="studio-event-project-title">
          <span>{template.name}</span>
          <input
            value={project.name}
            maxLength="80"
            aria-label="Project name"
            onChange={(event) => updateProject({name: event.target.value})}
          />
        </div>

        <div className="studio-event-editor-actions">
          {saveState ? <span>{saveState}</span> : null}
          <button
            className={[
              "studio-event-review-button",
              warnings.length ? "has-warnings" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={() => openSideSheet("review")}
          >
            {warnings.length ? `${warnings.length} checks` : "Ready"}
          </button>
          <button
            className="studio-button is-primary"
            type="button"
            disabled={warnings.length > 0 || exportState.status === "working"}
            title={
              warnings.length
                ? "Open Review checks to resolve export warnings."
                : isCarousel
                  ? "Export every carousel slide as a high-resolution PNG."
                  : "Export a high-resolution PNG."
            }
            onClick={requestExport}
          >
            {exportState.status === "working"
              ? "Exporting…"
              : isCarousel
                ? "Export Carousel"
                : "Export PNG"}
          </button>
        </div>
      </header>

      <div
        className={[
          "studio-event-workspace",
          workspacePanelOpen ? "has-side-sheet" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={[
            "studio-event-panel-slot",
            workspacePanelOpen ? "is-open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {renderedWorkspacePanel === "hero" &&
          supportsHeroLogoTemplate(project.templateId) &&
          !isGraphicDocument ? (
            <EventToolSideSheet
              eyebrow="HERO"
              title="Text or hero logo"
              label="hero controls"
              onClose={() => setActivePanel("")}
            >
              <EventHeroControls
                key={`${project.id}:${activeSlide?.id}`}
                content={activeContent}
                updateContent={(changes) =>
                  updateContentForSlide(activeSlide?.id || "primary", changes)
                }
                cloud={cloud}
                project={project}
                canManageLogoLibrary={canManageLogoLibrary}
              />
            </EventToolSideSheet>
          ) : null}
          {renderedWorkspacePanel === "background" ? (
            <EventToolSideSheet
              eyebrow="BACKGROUND"
              title="Image and focal point"
              label="background controls"
              onClose={() => setActivePanel("")}
            >
              <EventBackgroundControls
                key={`${project.id}:${activeSlide?.id}`}
                content={activeContent}
                updateContent={updateContent}
                cloud={cloud}
                unsplash={unsplash}
                project={project}
              />
            </EventToolSideSheet>
          ) : null}
          {renderedWorkspacePanel === "brief" ? (
            isGraphicDocument ? (
              <GraphicDocumentBriefSheet
                project={project}
                updateProject={updateProject}
                onClose={() => setSideSheet("")}
              />
            ) : isSocial ? (
              <SocialProjectBriefSheet
                project={project}
                updateProject={updateProject}
                onClose={() => setSideSheet("")}
              />
            ) : (
              <EventProjectBriefSheet
                project={project}
                updateProject={updateProject}
                services={cloud || unsplash}
                onClose={() => setSideSheet("")}
              />
            )
          ) : null}
          {renderedWorkspacePanel === "review" ? (
            <EventReviewSheet
              project={project}
              warnings={warnings}
              exportState={exportState}
              creativeFilenameEnabled={creativeFilenameEnabled}
              onCreativeFilenameChange={setCreativeFilenameEnabled}
              onClose={() => setSideSheet("")}
              onExport={requestExport}
              exportLabel={isCarousel ? "Export Carousel ZIP" : "Export High-Res PNG"}
            />
          ) : null}
        </div>

        <section
          className={`studio-event-canvas-region${isCarousel ? " has-carousel-rail" : ""}${hiddenTextFields.length ? " has-hidden-text" : ""}`}
          onPointerDownCapture={() => setMenuOpen(false)}
        >
          <div className="studio-event-canvas-meta">
            <span>LIVE CANVAS</span>
            <strong>{formatLabel}</strong>
            {isCarousel ? (
              <strong>SLIDE {activeSlideIndex + 1}/{slides.length}</strong>
            ) : null}
            <p>Click any text to edit it. Template positions remain fixed.</p>
          </div>
          {hiddenTextFields.length ? (
            <div className="studio-hidden-text-controls" role="group" aria-label="Hidden text">
              <span>Hidden text</span>
              {hiddenTextFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => {
                    updateContent({[`${field}Visible`]: true});
                    setSelectedField(field);
                    setActivePanel("");
                  }}
                >
                  Show {textFieldOptions[field].label.toLowerCase()}
                </button>
              ))}
            </div>
          ) : null}
          {isCarousel ? (
            <SocialCarouselRail
              slides={slides}
              activeSlideId={activeSlide?.id || "primary"}
              onSelect={(slideId) => {
                setActiveSlideId(slideId);
                setSelectedField("");
              }}
              onAdd={addSlide}
              onDuplicate={duplicateSlide}
              onMove={moveSlide}
              onDelete={deleteSlide}
            />
          ) : null}
          <div
            className={`studio-event-canvas-stage is-${activeContent.format || "square"}`}
            data-studio-print-preview
          >
            <EventPreview
              onLayoutWarning={(warning) => {
                const key = `${project.id}:${activeSlide?.id || "primary"}`;
                setLayoutWarnings((current) => current[key]?.message === warning && current[key]?.content === activeContent ? current : {...current, [key]: {message: warning, content: activeContent}});
              }}
              content={activeContent}
              templateId={project.templateId}
              editorMode={exportState.status !== "working"}
              selectedField={selectedField}
              onSelectField={(field) => {
                setSelectedField(field);
                if (field) setActivePanel("");
              }}
              onEditField={(field, value) =>
                updateContent({[field]: value})
              }
            />
          </div>
          {exportState.message && exportState.status !== "working" ? (
            <button
              className={`studio-event-export-toast is-${exportState.status}`}
              type="button"
              onClick={() => setExportState({status: "", message: ""})}
            >
              <span>{exportState.message}</span>
              <i aria-hidden="true">×</i>
            </button>
          ) : null}
        </section>
      </div>

      <EventQuickToolbar
        content={activeContent}
        updateContent={updateContent}
        templateId={project.templateId}
        selectedField={selectedField}
        onSelectField={setSelectedField}
        activePanel={activePanel}
        onPanelChange={(panel) => {
          setActivePanel(panel);
          if (panel) {
            setSelectedField("");
            setSideSheet("");
          }
        }}
      />
      {exportProject ? <div
        className="studio-event-export-previews"
        aria-hidden="true"
      >
        {snapshotSlides.map((slide) => (
          <EventPreview
            key={slide.id}
            content={slide.content}
            previewRef={(element) => {
              if (element) eventExportRefs.current.set(slide.id, element);
              else eventExportRefs.current.delete(slide.id);
            }}
            templateId={exportProject.templateId}
          />
        ))}
      </div> : null}
      {showFilenameDialog ? (
        <CreativeFilenameDialog
          project={project}
          extension="png"
          onClose={() => setShowFilenameDialog(false)}
          onConfirm={runExport}
        />
      ) : null}
    </main>
  );
}

function StudioEditor(props) {
  return isDocumentProject(props.project) ? (
    <DocumentEditor {...props} />
  ) : (
    <EventStudioEditor {...props} />
  );
}

function StudioApp() {
  const authState = useStudioAuth();
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [saveState, setSaveState] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [projectSessionUid, setProjectSessionUid] = useState("");
  const coordinatorRef = useRef(null);
  const browserCacheRef = useRef(null);
  const storageKeyRef = useRef("");
  const recoveryProjectsRef = useRef([]);
  const projectsRef = useRef(projects);
  const [recoverableCount, setRecoverableCount] = useState(0);
  const [saveStatuses, setSaveStatuses] = useState({});
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const replaceProjects = (next) => {
    const previous = projectsRef.current;
    projectsRef.current = next;
    setProjects(next);
    if (!storageKeyRef.current) return true;
    try {
      if (browserCacheRef.current) browserCacheRef.current.write(next, previous);
      else persistProjects(next, storageKeyRef.current);
      return true;
    } catch (error) {
      setCloudMessage("Browser storage is full or unavailable. Keep Studio open until Central finishes syncing.");
      return false;
    }
  };
  const cloud = useMemo(
    () =>
      createStudioCloud({
        auth: authState.auth,
        firestore: authState.firestore,
        storage: authState.storage,
        user: authState.user,
      }),
    [
      authState.auth,
      authState.firestore,
      authState.storage,
      authState.user,
    ],
  );
  const unsplash = useMemo(
    () =>
      cloud ||
      (isLocalFirebaseHost() &&
      new URLSearchParams(window.location.search).get("preview") === "1"
        ? createStudioPreviewUnsplash()
        : null),
    [cloud],
  );

  const visibleProjects =
    authState.status === "ready" &&
    projectSessionUid === authState.user.uid
      ? projects
      : [];
  const currentProject = visibleProjects.find(
    (project) => project.id === currentProjectId,
  );

  useEffect(() => {
    window.scrollTo({top: 0, behavior: "auto"});
  }, [currentProjectId]);

  useEffect(() => {
    if (authState.status !== "ready" || cloud) return undefined;
    const actorUid = authState.user.uid;
    storageKeyRef.current = STUDIO_STORAGE_KEY;
    const browserCache = createStudioBrowserCache({storage: localStorage, key: STUDIO_STORAGE_KEY,
      actorUid, prepare: prepareProjectForStorage, migrate: migrateLegacyStudioProject});
    browserCacheRef.current = browserCache;
    let browserProjects;
    try { browserProjects = browserCache.read().projects; }
    catch { browserProjects = loadProjects(STUDIO_STORAGE_KEY); }
    projectsRef.current = browserProjects;
    setProjects(browserProjects);
    setProjectSessionUid(actorUid);
    setCurrentProjectId("");
    return () => {
      if (storageKeyRef.current === STUDIO_STORAGE_KEY) {
        storageKeyRef.current = "";
        browserCacheRef.current = null;
      }
    };
  }, [authState.status, authState.user, cloud]);

  useEffect(() => {
    if (authState.status !== "ready" || !cloud) return undefined;
    let active = true;
    const actorUid = authState.user.uid;
    setProjectSessionUid(actorUid);
    setCurrentProjectId("");
    const accountStorageKey = studioAccountStorageKey(actorUid);
    storageKeyRef.current = accountStorageKey;
    const browserCache = createStudioBrowserCache({storage: localStorage, key: accountStorageKey,
      actorUid, prepare: prepareProjectForStorage, migrate: migrateLegacyStudioProject});
    browserCacheRef.current = browserCache;
    let cached;
    try { cached = browserCache.read(); }
    catch (error) {
      cached = {projects: loadProjects(accountStorageKey), recoveryProjects: [], migrationError: error};
    }
    const partitionedCache = partitionBrowserProjects(
      [
        ...cached.projects,
        ...loadProjects(),
      ],
      actorUid,
    );
    const currentCache = dedupeBrowserProjects(partitionedCache.current, {
      includeIdentity: false,
    });
    const legacyCandidates = partitionedCache.unattributed.filter(
      (project) => !currentCache.some((current) => current.id === project.id),
    );
    const initialRecovery = dedupeBrowserProjects([
      ...loadProjects(STUDIO_RECOVERY_STORAGE_KEY),
      ...partitionedCache.foreign,
      ...legacyCandidates,
      ...cached.recoveryProjects,
    ]);
    recoveryProjectsRef.current = initialRecovery;
    setRecoverableCount(initialRecovery.filter((project) => isRecoverableBrowserProject(project, actorUid)).length);
    try { persistProjects(initialRecovery, STUDIO_RECOVERY_STORAGE_KEY); }
    catch { setCloudMessage("Studio could not update the recovery list. Keep this tab open until your work is saved."); }
    replaceProjects(currentCache);
    setSaveStatuses({});
    const coordinator = createStudioSaveCoordinator({
      actorUid,
      saveProject: (project) => cloud.saveProject(project),
      deleteProject: (projectId, project) =>
        project.shared
          ? cloud.leaveProject(projectId)
          : cloud.deleteProject(projectId, {ignoreMissing: true}),
      onSaveSuccess: (result) => {
        replaceProjects(projectsRef.current.map((item) => applyStudioSaveSuccess(item, result.savedProject, result)));
      },
      onSaveError: (result) => {
        replaceProjects(projectsRef.current.map((item) => item.id === result.projectId ? applyStudioSaveFailure(item, result) : item));
        if (result.error?.code !== "studio/conflict") setCloudMessage(result.error.message);
      },
      onStateChange: (state) => {
        setSaveState("");
        setSaveStatuses((current) => ({
          ...current,
          [state.projectId]: state.status,
        }));
      },
    });
    coordinatorRef.current = coordinator;
    const retryPending = () => projectsRef.current.forEach((project) => {
      if (
        project._studioSync?.pending &&
        !coordinator.retry(project.id)
      ) {
        coordinator.schedule(project);
      }
    });
    window.addEventListener("online", retryPending);
    async function loadCloudProjects() {
      setCloudLoading(true);
      setCloudMessage("Loading your Central Studio projects…");
      try {
        const shareToken = new URLSearchParams(window.location.search).get("share");
        let acceptedProjectId = "";
        if (shareToken) {
          const accepted = await cloud.acceptShare(shareToken);
          acceptedProjectId = accepted.projectId;
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("share");
          window.history.replaceState({}, "", cleanUrl);
        }
        const cloudProjects = await cloud.loadProjects();
        if (!active) return;
        try { browserCache.restore(cloudProjects); }
        catch { setCloudMessage("Studio loaded, but browser storage is unavailable. Keep this tab open until your work is synced."); }
        const result = reconcileStudioProjects({
          cloudProjects,
          browserProjects: [...currentCache, ...legacyCandidates],
          actorUid,
        });
        const recoveryProjects = dedupeBrowserProjects([
          ...initialRecovery,
          ...result.preservedBrowserProjects,
          ...cached.recoveryProjects,
        ]);
        recoveryProjectsRef.current = recoveryProjects;
        setRecoverableCount(
          recoveryProjects.filter(
            (project) => isRecoverableBrowserProject(project, actorUid),
          ).length,
        );
        let recoveryStored = true;
        try {
          persistProjects(recoveryProjects, STUDIO_RECOVERY_STORAGE_KEY);
        } catch (error) {
          recoveryStored = false;
          setCloudMessage("Browser storage is full or unavailable. Keep Studio open until Central finishes syncing.");
        }
        const projectsStored = replaceProjects(result.projects);
        let legacyRemoved = true;
        if (recoveryStored && projectsStored) {
          try {
            localStorage.removeItem(STUDIO_STORAGE_KEY);
          } catch (error) {
            legacyRemoved = false;
            setCloudMessage("Studio synced, but the older browser cache could not be cleared.");
          }
        }
        result.pendingProjects.forEach((project) => coordinator.schedule(project));
        if (acceptedProjectId) setCurrentProjectId(acceptedProjectId);
        if (recoveryStored && projectsStored && legacyRemoved) {
          setCloudMessage(
            result.attentionProjects.length
              ? "Some older browser projects are stored as recovery copies on this device."
              : "",
          );
        }
      } catch (error) {
        if (!active) return;
        replaceProjects(currentCache);
        currentCache.forEach((project) => {
          if (project._studioSync?.pending) coordinator.schedule(project);
        });
        setCloudMessage("Studio could not load cloud projects. Your account's browser copies are available; reconnect to sync changes. " + error.message);
      } finally {if (active) setCloudLoading(false);}
    }
    loadCloudProjects();
    return () => {
      active = false;
      coordinator.dispose();
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
      if (storageKeyRef.current === accountStorageKey) storageKeyRef.current = "";
      if (browserCacheRef.current === browserCache) browserCacheRef.current = null;
      window.removeEventListener("online", retryPending);
    };
  }, [authState.status, cloud]);

  if (authState.status !== "ready") {
    return <AccessScreen authState={authState} />;
  }

  const canCreate =
    projectSessionUid === authState.user.uid &&
    EDIT_PERMISSIONS.has(authState.permission);

  const saveProjects = (nextProjects, changedProject = null) => {
    setSaveState("");
    const marked = changedProject && cloud
      ? markStudioProjectPending({...changedProject, _studioSync: projectsRef.current.find((item) => item.id === changedProject.id)?._studioSync || changedProject._studioSync}, authState.user.uid)
      : changedProject;
    const next = marked ? nextProjects.map((item) => item.id === marked.id ? marked : item) : nextProjects;
    const browserStored = replaceProjects(next);
    if (marked && cloud) {
      coordinatorRef.current?.schedule(marked);
      if (!browserStored) void coordinatorRef.current?.flush(marked.id);
    }
    else setSaveState("Saved in this browser");
  };
  const recoverLegacyProjects = () => {
    if (!cloud || !canCreate) return;
    const recoverable = recoveryProjectsRef.current.filter(
      (project) =>
        isRecoverableBrowserProject(project, authState.user.uid),
    );
    if (!recoverable.length) return;
    const recovered = recoverable.map((project) =>
      markStudioProjectPending(
        recoveredProjectCopy(project),
        authState.user.uid,
      ),
    );
    const recoveredKeys = new Set(
      recoverable.map(
        (project) => browserProjectKey(project),
      ),
    );
    const remainingRecovery = recoveryProjectsRef.current.filter(
      (project) =>
        !recoveredKeys.has(
          browserProjectKey(project),
        ),
    );
    const browserStored = replaceProjects([
      ...recovered,
      ...projectsRef.current,
    ]);
    let recoveryStored = false;
    if (browserStored) {
      recoveryProjectsRef.current = remainingRecovery;
      try {
        persistProjects(remainingRecovery, STUDIO_RECOVERY_STORAGE_KEY);
        recoverable.forEach((project) => {
          browserCacheRef.current?.retireDraft(project);
          browserCacheRef.current?.retireRecovery(project);
          if (!projectsRef.current.some((current) => current.id === project.id)) browserCacheRef.current?.remove(project.id);
        });
        recoveryStored = true;
      } catch (error) {
        setCloudMessage("The recovered projects are syncing, but Studio could not update the browser recovery list.");
      }
    }
    // Hide the action for this session even when browser storage is full. In
    // that case the original recovery records stay intact for the next load.
    setRecoverableCount(0);
    recovered.forEach((project) => {
      coordinatorRef.current?.schedule(project);
      if (!browserStored) void coordinatorRef.current?.flush(project.id);
    });
    setCurrentProjectId(recovered[0]?.id || "");
    if (browserStored && recoveryStored) {
      setCloudMessage(
        `${recovered.length} browser project${recovered.length === 1 ? "" : "s"} recovered and queued for Central sync. Uploaded project images must be added again.`,
      );
    }
  };
  const statuses = Object.values(saveStatuses);
  const activeStatus = saveStatuses[currentProjectId];
  const effectiveSaveState = cloud
    ? (activeStatus === "conflict" || statuses.includes("conflict") ? "Your edits are kept · Resolve save conflict"
      : activeStatus === "error" || statuses.includes("error") ? "Browser saved · Central sync needs attention"
      : statuses.some((status) => ["pending", "saving", "retrying"].includes(status)) ? "Saving to Central…" : saveState || "Saved to Central")
    : saveState;

  const createProject = (templateId) => {
    if (!canCreate) return;
    const project = createStudioProject(templateId);
    saveProjects([project, ...projectsRef.current], project);
    setCurrentProjectId(project.id);
  };

  const updateProject = (nextProject) => {
    const nextProjects = projectsRef.current.map((project) =>
      project.id === nextProject.id ? nextProject : project,
    );
    saveProjects(nextProjects, nextProject);
  };

  const deleteProject = async (projectId) => {
    const project = visibleProjects.find((item) => item.id === projectId);
    if (!project) return;
    const confirmed = window.confirm(
      project.shared
        ? `Leave "${project.name}"? It will disappear from your Studio projects, but the owner keeps it.`
        : `Delete "${project.name}"? This removes the project and its uploaded images for everyone and cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleteBusy(true);
    try {
      if (cloud) await coordinatorRef.current.delete(project);
      let cacheRemoved = true;
      try { browserCacheRef.current?.remove(projectId); }
      catch { cacheRemoved = false; }
      const nextProjects = projectsRef.current.filter((item) => item.id !== projectId);
      replaceProjects(nextProjects);
      setSaveState(cloud ? "Saved to Central" : "Saved in this browser");
      if (currentProjectId === projectId) {
        setCurrentProjectId("");
      }
      if (!cacheRemoved) setCloudMessage("The project was removed, but Studio could not clear its browser cache. Reconnect before opening an older tab.");
    } catch (error) {
      setCloudMessage(error.message);
    } finally {setDeleteBusy(false);}
  };

  const shareProject = async (projectId) => {
    if (!cloud) return;
    setSaveState("Creating share link…");
    try {
      await coordinatorRef.current?.flush(projectId);
      if (projectsRef.current.find((item) => item.id === projectId)?._studioSync?.pending) throw new Error("Wait for this project to finish syncing before sharing.");
      const result = await cloud.createShare(projectId);
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        setSaveState("Share link copied");
      } catch (error) {
        window.prompt("Copy this Studio share link:", result.shareUrl);
        setSaveState("Share link ready");
      }
    } catch (error) {
      setSaveState("Share could not be created");
      setCloudMessage(error.message);
    }
  };

  const loadLatestProject = async (projectId, {preserve = true, open = true} = {}) => {
    const browserCache = browserCacheRef.current;
    const latest = await cloud.loadProject(projectId);
    if (browserCacheRef.current !== browserCache) return;
    const local = projectsRef.current.find((project) => project.id === projectId);
    if (!local) return;
    if (preserve) {
      // Persist a separate recovery record before replacing the visible draft.
      browserCache.preserveForRecovery(local);
      recoveryProjectsRef.current = dedupeBrowserProjects([...recoveryProjectsRef.current, local]);
      setRecoverableCount(recoveryProjectsRef.current.filter((project) => isRecoverableBrowserProject(project, authState.user.uid)).length);
    }
    coordinatorRef.current.reset(projectId);
    if (latest) {
      browserCache.restore([latest]);
      replaceProjects(projectsRef.current.map((project) => project.id === projectId ? latest : project));
    } else {
      browserCache.remove(projectId);
      replaceProjects(projectsRef.current.filter((project) => project.id !== projectId));
    }
    browserCache.retireDraft(local);
    setSaveStatuses((current) => { const next = {...current}; delete next[projectId]; return next; });
    if (open) setCurrentProjectId(latest ? projectId : "");
    setCloudMessage(!latest ? "The original project is no longer available. Your local edits have been kept for recovery."
      : preserve ? "Loaded the latest saved version. Your previous edits are available as a recovery copy." : "Your changes are saved as a separate copy. The original now has the latest saved version.");
  };
  const resolveProjectConflict = async (projectId, keepCopy) => {
    const local = projectsRef.current.find((project) => project.id === projectId);
    if (!local || !cloud) return;
    setResolvingConflict(true);
    try {
      if (keepCopy) {
        const copy = markStudioProjectPending(recoveredProjectCopy(local), authState.user.uid);
        copy.name = `${String(local.name || "Untitled project").slice(0, 72)} (Copy)`;
        const stored = replaceProjects([copy, ...projectsRef.current]);
        coordinatorRef.current.schedule(copy);
        setCurrentProjectId(copy.id);
        if (!stored) {
          await coordinatorRef.current.flush(copy.id);
          if (projectsRef.current.find((project) => project.id === copy.id)?._studioSync?.pending) {
            throw new Error("Keep this tab open until your copy finishes saving. Your original edits have been retained.");
          }
        }
        await loadLatestProject(projectId, {preserve: false, open: false});
        setCloudMessage("Your changes are kept in a separate copy. Uploaded project images must be added again.");
      } else {
        await loadLatestProject(projectId);
      }
    } catch (error) { setCloudMessage(error.message); }
    finally { setResolvingConflict(false); }
  };
  const conflictedProjects = visibleProjects.filter((project) => project._studioSync?.conflict || saveStatuses[project.id] === "conflict");

  return (
    <>
    <div className="studio-app" inert={exportBusy || deleteBusy || cloudLoading || resolvingConflict ? true : undefined}>
      {!currentProject || isDocumentProject(currentProject) ? (
        <StudioHeader
          authState={authState}
          view={currentProject ? "editor" : "home"}
          onHome={() => setCurrentProjectId("")}
          saveState={effectiveSaveState}
        />
      ) : null}
      {cloudMessage || recoverableCount ? (
        <div className="studio-cloud-message" role="status">
          <span>
            {cloudMessage ||
              `${recoverableCount} older browser project${recoverableCount === 1 ? " is" : "s are"} available to recover.`}
          </span>
          {recoverableCount && canCreate ? (
            <button
              className="studio-button is-secondary"
              onClick={recoverLegacyProjects}
            >
              Recover {recoverableCount}
            </button>
          ) : null}
          <button onClick={() => setCloudMessage("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {conflictedProjects.filter((project) => !currentProject || project.id === currentProject.id).map((project) => (
        <StudioConflictMessage key={project.id} projectName={project.name}
          onKeepCopy={() => resolveProjectConflict(project.id, true)}
          onLoadLatest={() => resolveProjectConflict(project.id, false)} />
      ))}
      {currentProject ? (
        <StudioEditor
          key={currentProject.id}
          onBusyChange={setExportBusy}
          project={currentProject}
          onChange={updateProject}
          onBack={() => setCurrentProjectId("")}
          onDelete={deleteProject}
          onShare={shareProject}
          cloud={cloud}
          unsplash={unsplash}
          saveState={effectiveSaveState}
          canManageLogoLibrary={
            String(authState.userData?.pageAccess?.studio || "")
              .trim()
              .toLowerCase() === "admin"
          }
        />
      ) : (
        <StudioHome
          projects={visibleProjects}
          canCreate={canCreate}
          onCreate={createProject}
          onOpen={setCurrentProjectId}
          onDelete={deleteProject}
          cloudEnabled={Boolean(cloud)}
        />
      )}
    </div>
    {exportBusy || deleteBusy || cloudLoading || resolvingConflict ? <div className="studio-busy-overlay" role="status">{exportBusy ? "Preparing your export…" : deleteBusy ? "Deleting your project…" : resolvingConflict ? "Preserving your work…" : "Loading your projects…"}</div> : null}
    </>
  );
}

createRoot(document.getElementById("studio-root")).render(<StudioApp />);
