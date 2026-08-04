import React, {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";

import {
  exportDocumentPdf,
  exportEventPng,
  openDocumentSystemPrint,
} from "./export.js";
import {
  CREATIVE_FILENAME_PREFERENCE_KEY,
  buildCreativeFilename,
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
  STUDIO_STORAGE_KEY,
  TEMPLATE_CATALOG,
  createDocumentPage,
  createStudioProject,
  getEventCompositionOptions,
  getEventFontOptions,
  getProjectWarnings,
  getTemplateById,
  isDocumentProject,
  isGraphicTemplateId,
  isSocialTemplateId,
  linesToText,
  migrateLegacyStudioProject,
  normalizeEventComposition,
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

function loadProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(STUDIO_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.map(migrateLegacyStudioProject)
      : [];
  } catch (error) {
    return [];
  }
}

function prepareProjectForStorage(project) {
  const stored = JSON.parse(JSON.stringify(project));
  if (
    isGraphicTemplateId(stored.templateId) &&
    stored.content &&
    String(stored.content.backgroundImage || "").startsWith("data:")
  ) {
    stored.content.backgroundImage = "";
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

function persistProjects(projects) {
  const safeProjects = projects.map(prepareProjectForStorage);
  localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(safeProjects));
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

function StudioHeader({authState, view, onHome, saveState}) {
  return (
    <header className="studio-app-header">
      <StudioLogo />
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

function SelectField({label, value, onChange, options, hint}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LineListField({
  label,
  items,
  draftValue,
  onChange,
  maximum,
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
          items: textToLines(nextValue, maximum),
        })
      }
      rows={rows}
      hint={hint}
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

function BrandColorField({
  value,
  onChange,
  label = "Flat background color",
  hint = "Approved colors from the CrossPointe brand guidelines.",
}) {
  return (
    <div className="studio-brand-color-field">
      <span>{label}</span>
      <div className="studio-brand-color-options">
        {BRAND_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={value === option.value ? "is-selected" : ""}
            type="button"
            onClick={() => onChange(option.value)}
            title={`${option.label} ${option.hex}`}
            aria-label={`${option.label} ${option.hex}`}
            aria-pressed={value === option.value}
          >
            <i style={{background: option.hex}} />
            <small>{option.label}</small>
          </button>
        ))}
      </div>
      <small>{hint}</small>
    </div>
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

const EVENT_TEXT_FIELD_OPTIONS = {
  eyebrow: {label: "Utility label", maximum: 30},
  title: {label: "Event title", maximum: 52},
  subtitle: {label: "Supporting line", maximum: 110, multiline: true},
  date: {label: "Date", maximum: 28},
  time: {label: "Time", maximum: 24},
  location: {label: "Location", maximum: 34},
  cta: {label: "Call to action", maximum: 44},
};

const SOCIAL_TEXT_FIELD_OPTIONS = {
  eyebrow: {label: "Context label", maximum: 30},
  title: {label: "Main text", maximum: 220, multiline: true},
  subtitle: {label: "Reference or attribution", maximum: 110},
  cta: {label: "Footer text", maximum: 44},
};

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
  const alignment = content.textAlignment || "left";
  const fontOptions = getEventFontOptions(templateId);
  const compositionOptions = getEventCompositionOptions(templateId);
  const selectedComposition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  const textFieldOptions = isSocial
    ? SOCIAL_TEXT_FIELD_OPTIONS
    : EVENT_TEXT_FIELD_OPTIONS;
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
        aria-label={isSocial ? "Social post design controls" : "Event design controls"}
      >
        <div className="studio-toolbar-selection">
          <span>{selectedTextOption ? "TEXT" : "CANVAS"}</span>
          <strong>
            {selectedTextOption?.label || "Template controls"}
          </strong>
        </div>

        {!isSocial ? (
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

        <div className="studio-toolbar-divider" aria-hidden="true" />

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
          <span>{isSocial ? "Message font" : "Title font"}</span>
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

        <label>
          <span>Ratio</span>
          <select
            value={content.format || "square"}
            onChange={(event) => updateContent({format: event.target.value})}
          >
            {(isSocial ? SOCIAL_FORMAT_OPTIONS : EVENT_FORMAT_OPTIONS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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

function EventHeroControls({
  content,
  updateContent,
  cloud,
  project,
  canManageLogoLibrary,
}) {
  const projectLogoInputRef = useRef(null);
  const libraryLogoInputRef = useRef(null);
  const [library, setLibrary] = useState([]);
  const [libraryName, setLibraryName] = useState("");
  const [state, setState] = useState({status: "", message: ""});

  const refreshLibrary = async () => {
    if (!cloud?.loadLogoLibrary) {
      setLibrary([]);
      return;
    }
    setState({status: "working", message: "Loading the Logo Library…"});
    try {
      const logos = await cloud.loadLogoLibrary();
      setLibrary(logos);
      setState({
        status: "success",
        message: logos.length
          ? `${logos.length} logo${logos.length === 1 ? "" : "s"} available.`
          : "The Logo Library is ready for its first upload.",
      });
    } catch (error) {
      setState({status: "error", message: error.message});
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, [cloud]);

  const previewFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Studio could not preview that logo."));
      reader.readAsDataURL(file);
    });

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
    try {
      validateLogoFile(file);
      const preview = await previewFile(file);
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
      updateContent(changes);
      setState({status: "success", message: "Project logo saved to Studio."});
    } catch (error) {
      setState({status: "error", message: error.message});
    }
  };

  const uploadLibraryLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !cloud?.uploadLogoToLibrary) return;
    try {
      validateLogoFile(file);
      const inferredName = file.name
        .replace(/\.(jpe?g|png|webp)$/iu, "")
        .replace(/[-_]+/gu, " ")
        .trim();
      const name = libraryName.trim() || inferredName;
      setState({status: "working", message: "Adding logo to the library…"});
      const logo = await cloud.uploadLogoToLibrary(name, file);
      setLibrary((current) =>
        [...current, logo].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setLibraryName("");
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
      setState({status: "error", message: error.message});
    }
  };

  const selectLibraryLogo = (logoId) => {
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
          onClick={() => updateContent({heroMode: "text"})}
        >
          <strong>Text Hero</strong>
          <span>Use the template’s display typography.</span>
        </button>
        <button
          className={content.heroMode === "logo" ? "is-active" : ""}
          type="button"
          aria-pressed={content.heroMode === "logo"}
          onClick={() => updateContent({heroMode: "logo"})}
        >
          <strong>Logo Hero</strong>
          <span>Replace the event title with a prepared logo.</span>
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
                  Event Graphics.
                </p>
              </div>
              <label>
                <span>Library name</span>
                <input
                  type="text"
                  maxLength="80"
                  value={libraryName}
                  placeholder="Bids for Kids"
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
  unsplash,
  content,
  updateContent,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [state, setState] = useState({status: "", message: ""});

  const searchPage = async (nextPage) => {
    if (!unsplash || query.trim().length < 2) return;
    setState({status: "working", message: "Searching Unsplash…"});
    try {
      const orientation =
        content.format === "portrait"
          ? "portrait"
          : content.format === "square"
            ? "squarish"
            : "landscape";
      const data = await unsplash.searchUnsplash(
        query.trim(),
        orientation,
        nextPage,
      );
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
      setState({status: "error", message: error.message});
    }
  };

  const search = (event) => {
    event.preventDefault();
    searchPage(1);
  };

  const selectPhoto = async (photo) => {
    setState({status: "working", message: "Adding the selected photo…"});
    try {
      const changes = await unsplash.selectUnsplash(photo);
      updateContent({
        ...changes,
        focalX: 50,
        focalY: 50,
        imageZoom: 1,
        backgroundImageRotation: 0,
      });
    } catch (error) {
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
          onChange={(event) => setQuery(event.target.value)}
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
  const fileInputRef = useRef(null);
  const [uploadState, setUploadState] = useState({status: "", message: ""});

  const handleFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadState({status: "error", message: "Use a JPG, PNG, or WebP image."});
      return;
    }
    if (file.size >= 8 * 1024 * 1024) {
      setUploadState({status: "error", message: "Use an image smaller than 8 MB."});
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateContent({
        backgroundImage: String(reader.result || ""),
        backgroundImageSource: "",
        backgroundImageUrl: "",
        backgroundImageStoragePath: "",
        focalX: 50,
        focalY: 50,
        imageZoom: 1,
        backgroundImageRotation: 0,
      });
    };
    reader.readAsDataURL(file);
    if (!cloud) {
      setUploadState({
        status: "success",
        message: "Preview loaded in this browser. Cloud upload is unavailable.",
      });
      return;
    }
    setUploadState({status: "working", message: "Uploading image to Studio…"});
    try {
      const changes = await cloud.uploadBackground(project, file);
      updateContent(changes);
      setUploadState({status: "success", message: "Image saved to Studio."});
    } catch (error) {
      setUploadState({status: "error", message: error.message});
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
              updateContent({
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
        unsplash={unsplash}
        content={content}
        updateContent={updateContent}
      />
    </div>
  );
}

function SourceStep({project, updateProject, cloud, unsplash}) {
  const isPolicy = project.templateId === "policy-document";
  const updateContent = (changes) =>
    updateProject({content: {...project.content, ...changes}});
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">PROJECT FOUNDATION</span>
        <h2>{isPolicy ? "Start with a governed document" : "Choose the event source"}</h2>
        <p>
          {isPolicy
            ? "This first version starts from approved manual content. Policy libraries and source-document linking will follow."
            : "Manual event details are enabled for the frontend foundation. Central and Planning Center source selection comes in the next data milestone."}
        </p>
      </div>

      <div className="studio-source-options">
        <button className="studio-source-option is-selected">
          <span className="studio-source-radio" aria-hidden="true" />
          <span>
            <strong>{isPolicy ? "New SOP / Policy" : "Manual event details"}</strong>
            <small>
              {isPolicy
                ? "Build a single-page operating document from controlled sections."
                : "Enter event facts directly while the authoritative source connector is prepared."}
            </small>
          </span>
          <StatusPill tone="ready">AVAILABLE</StatusPill>
        </button>
        <button className="studio-source-option" disabled>
          <span className="studio-source-radio" aria-hidden="true" />
          <span>
            <strong>
              {isPolicy ? "Existing Studio policy" : "Central / Planning Center event"}
            </strong>
            <small>
              {isPolicy
                ? "Duplicate and update a previously approved document."
                : "Re-read authoritative event facts and preserve the source identity."}
            </small>
          </span>
          <StatusPill>NEXT MILESTONE</StatusPill>
        </button>
      </div>

      <div className="studio-field-grid">
        <InputField
          label="Project name"
          value={project.name}
          maxLength={80}
          wide
          onChange={(name) => updateProject({name})}
          hint="This identifies the project in Studio; it does not appear on the graphic."
        />
      </div>
      {!isPolicy ? (
        <EventBackgroundControls
          content={project.content}
          updateContent={updateContent}
          cloud={cloud}
          unsplash={unsplash}
          project={project}
        />
      ) : null}
    </div>
  );
}

function PolicyContentStep({content, updateContent}) {
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">DOCUMENT CONTENT</span>
        <h2>Build the information hierarchy</h2>
        <p>
          Every field maps to a controlled location in the one-page document.
        </p>
      </div>
      <div className="studio-field-grid">
        <InputField
          label="Document number"
          value={content.documentNumber}
          onChange={(value) => updateContent({documentNumber: value})}
          maxLength={18}
        />
        <InputField
          label="Audience label"
          value={content.audience}
          onChange={(value) => updateContent({audience: value})}
          maxLength={28}
        />
        <InputField
          label="Document title"
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
          rows={2}
        />
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
          rows={4}
          hint={`${String(content.operatingRule || "").length}/320 characters`}
        />
      </div>
    </div>
  );
}

function EventContentStep({content, updateContent}) {
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">EVENT CONTENT</span>
        <h2>Keep the message short and useful</h2>
        <p>
          The template protects hierarchy while the copy adapts across each
          format.
        </p>
      </div>
      <div className="studio-field-grid">
        <InputField
          label="Utility label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={30}
        />
        <InputField
          label="Event title"
          value={content.title}
          onChange={(value) => updateContent({title: value})}
          maxLength={52}
        />
        <TextareaField
          label="Supporting line"
          value={content.subtitle}
          onChange={(value) => updateContent({subtitle: value})}
          maxLength={110}
          rows={3}
        />
        <InputField
          label="Date"
          value={content.date}
          onChange={(value) => updateContent({date: value})}
          maxLength={28}
        />
        <InputField
          label="Time"
          value={content.time}
          onChange={(value) => updateContent({time: value})}
          maxLength={24}
        />
        <InputField
          label="Location"
          value={content.location}
          onChange={(value) => updateContent({location: value})}
          maxLength={34}
        />
        <InputField
          label="Call to action"
          value={content.cta}
          onChange={(value) => updateContent({cta: value})}
          maxLength={44}
          wide
        />
      </div>
    </div>
  );
}

function PolicyLayoutStep({content, updateContent}) {
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">CONTROLLED SECTIONS</span>
        <h2>Shape the repeatable guidance</h2>
        <p>
          Use one line per item. Studio keeps the two support columns and owner
          responsibilities aligned.
        </p>
      </div>
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
          label="Standard workflow items"
          items={content.primaryItems}
          draftValue={content.primaryItemsText}
          onChange={({draftValue, items}) =>
            updateContent({primaryItemsText: draftValue, primaryItems: items})
          }
          maximum={7}
          rows={7}
          hint="One item per line; up to 7 items."
        />
        <LineListField
          label="Strategic option items"
          items={content.secondaryItems}
          draftValue={content.secondaryItemsText}
          onChange={({draftValue, items}) =>
            updateContent({
              secondaryItemsText: draftValue,
              secondaryItems: items,
            })
          }
          maximum={7}
          rows={7}
          hint="One item per line; up to 7 items."
        />
        <LineListField
          label="Owner responsibilities"
          items={content.ownerItems}
          draftValue={content.ownerItemsText}
          onChange={({draftValue, items}) =>
            updateContent({ownerItemsText: draftValue, ownerItems: items})
          }
          maximum={3}
          rows={5}
          hint="Exactly three concise responsibilities work best."
        />
      </div>
    </div>
  );
}

function EventLayoutStep({content, updateContent, templateId}) {
  const compositionOptions = getEventCompositionOptions(templateId);
  const selectedComposition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">FORMAT + COMPOSITION</span>
        <h2>Reflow the idea, not just the canvas</h2>
        <p>
          Each format uses the same approved content with responsive placement
          rules.
        </p>
      </div>
      <div className="studio-field-grid">
        <SelectField
          label="Output format"
          value={content.format}
          onChange={(value) => updateContent({format: value})}
          options={EVENT_FORMAT_OPTIONS.map((option) => ({
            ...option,
            label:
              option.value === "square"
                ? "1:1 Social Post"
                : option.value === "portrait"
                  ? "4:5 Social Post"
                  : "16:9 Screen Graphic",
          }))}
        />
        <SelectField
          label="Composition"
          value={selectedComposition}
          onChange={(value) => updateContent({composition: value})}
          options={compositionOptions}
        />
        {!["flat", "color-overlay"].includes(selectedComposition) ? (
          <SelectField
            label="Palette"
            value={content.palette}
            onChange={(value) => updateContent({palette: value})}
            options={EVENT_PALETTE_OPTIONS}
          />
        ) : null}
        {selectedComposition === "flat" && !content.backgroundImage ? (
          <BrandColorField
            value={content.flatColor || "charcoal"}
            onChange={(flatColor) => updateContent({flatColor})}
          />
        ) : null}
        {selectedComposition === "color-overlay" ? (
          <>
            <BrandColorField
              value={content.overlayColor || "red"}
              onChange={(overlayColor) => updateContent({overlayColor})}
              label="Overlay color"
              hint="The selected CrossPointe color is blended over the background image."
            />
            <SelectField
              label="Blend mode"
              value={content.overlayBlendMode || "multiply"}
              onChange={(overlayBlendMode) =>
                updateContent({overlayBlendMode})
              }
              options={EVENT_BLEND_OPTIONS}
              hint="Multiply darkens, Screen lightens, Overlay adds contrast, and Soft Light is more subtle."
            />
            {!content.backgroundImage ? (
              <p className="studio-field-note">
                Add a background image in Source to preview the color blend.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="studio-layout-guidance">
        <span>Template behavior</span>
        <ul>
          <li>Logo and CTA anchors cannot be freely moved.</li>
          <li>Type roles and contrast remain deterministic.</li>
          <li>Long titles trigger a review warning instead of shrinking forever.</li>
          <li>Flat mode removes decorative overlays and gradients.</li>
          <li>Color Overlay uses approved brand colors and Photoshop-style blending.</li>
        </ul>
      </div>
    </div>
  );
}

function PolicyBrandStep({content, updateContent}) {
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">DOCUMENT IDENTITY</span>
        <h2>Finish the governed details</h2>
        <p>
          The visual system remains fixed while labels and references describe
          this specific document.
        </p>
      </div>
      <div className="studio-field-grid">
        <InputField
          label="Header label"
          value={content.eyebrow}
          onChange={(value) => updateContent({eyebrow: value})}
          maxLength={52}
          wide
        />
        <InputField
          label="Process label"
          value={content.processLabel}
          onChange={(value) => updateContent({processLabel: value})}
          maxLength={30}
        />
        <InputField
          label="Footer reference"
          value={content.footerReference}
          onChange={(value) => updateContent({footerReference: value})}
          maxLength={34}
        />
        <TextareaField
          label="Footer note"
          value={content.footerNote}
          onChange={(value) => updateContent({footerNote: value})}
          maxLength={500}
          rows={5}
        />
      </div>
      <div className="studio-locked-style">
        <div className="studio-locked-swatch">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>CrossPointe Policy System</strong>
          <p>
            Montserrat hierarchy, red-to-charcoal hero, white card grid, red
            operating accents, and branded process footer.
          </p>
        </div>
        <StatusPill tone="ready">LOCKED</StatusPill>
      </div>
    </div>
  );
}

function EventBrandStep({content, updateContent, templateId}) {
  const fontOptions = getEventFontOptions(templateId);
  const selectedFontKey = content.fontKey || fontOptions[0]?.value;
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">TYPE TREATMENT</span>
        <h2>Place the message around the visual</h2>
        <p>
          Control alignment and legibility while Studio preserves the approved
          hierarchy and safe margins.
        </p>
      </div>
      <div className="studio-field-grid">
        <div className="studio-font-choice-field">
          <span>Display font</span>
          <div className="studio-font-choice-grid">
            {fontOptions.map((font) => (
              <button
                className={font.value === selectedFontKey ? "is-selected" : ""}
                key={font.value}
                onClick={() => updateContent({fontKey: font.value})}
                style={{fontFamily: `"${font.family}", sans-serif`}}
                type="button"
              >
                <i>Aa</i>
                <strong>{font.label}</strong>
              </button>
            ))}
          </div>
          <small>
            Applied to the event title; supporting information remains
            Montserrat for clarity.
          </small>
        </div>
        <SelectField
          label="Global font weight"
          value={content.fontWeight || "template"}
          onChange={(fontWeight) => updateContent({fontWeight})}
          options={GRAPHIC_FONT_WEIGHT_OPTIONS}
          hint="Applies one weight to every text element in the graphic."
        />
        <SelectField
          label="Brand mark"
          value={content.brandMark || "central"}
          onChange={(brandMark) => updateContent({brandMark})}
          options={GRAPHIC_BRAND_MARK_OPTIONS}
          hint="Choose Central, the CrossPointe heart, or the full church logo."
        />
        <SelectField
          label="Brand color"
          value={content.brandColor || "auto"}
          onChange={(brandColor) => updateContent({brandColor})}
          options={GRAPHIC_BRAND_COLOR_OPTIONS}
          hint="Auto Contrast switches between white and dark grey for legibility."
        />
        <SelectField
          label="Text alignment"
          value={content.textAlignment || "left"}
          onChange={(textAlignment) => updateContent({textAlignment})}
          options={[
            {value: "left", label: "Left"},
            {value: "center", label: "Center"},
            {value: "right", label: "Right"},
          ]}
          hint="Moves and aligns the primary copy and event details."
        />
      </div>
      <ToggleField
        label="Text drop shadow"
        description="Adds separation when type sits over a busy or similarly colored background."
        checked={content.textShadow}
        onChange={(textShadow) => updateContent({textShadow})}
      />
      <div className="studio-locked-style">
        <div
          className="studio-type-sample"
          style={{
            fontFamily: `${
              fontOptions.find(
                (option) => option.value === selectedFontKey,
              )?.family || fontOptions[0]?.family || "Montserrat"
            }, sans-serif`,
          }}
        >
          Aa
        </div>
        <div>
          <strong>Curated template typography</strong>
          <p>
            Each event template offers three display families selected for its
            proportions and layout. Policy documents remain Montserrat-only.
          </p>
        </div>
        <StatusPill tone="ready">3 FONTS</StatusPill>
      </div>
      <div className="studio-ai-boundary-note">
        <span>AI image generation</span>
        <p>
          The prototype is intentionally disconnected here. The secured,
          quota-controlled generation workflow will be added after projects,
          templates, and authoritative event data are stable.
        </p>
      </div>
    </div>
  );
}

function ReviewStep({
  project,
  warnings,
  onPrint,
  onExportPng,
  onExportPdf,
  exportState,
}) {
  const isPolicy = project.templateId === "policy-document";
  const isExporting = exportState.status === "working";
  return (
    <div className="studio-step-card">
      <div className="studio-step-card-heading">
        <span className="studio-kicker">FINAL CHECK</span>
        <h2>{warnings.length ? "A few details need attention" : "Ready for a closer review"}</h2>
        <p>
          Studio checks the deterministic content rules before an approval or
          export can happen.
        </p>
      </div>

      <div className="studio-review-summary">
        <div>
          <span>Template</span>
          <strong>{getTemplateById(project.templateId).name}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{project.status || "draft"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>Manual foundation</strong>
        </div>
      </div>

      <div className={`studio-review-checks${warnings.length ? " has-warnings" : ""}`}>
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
              <p>The selected format is using a deterministic composition.</p>
            </div>
          </>
        )}
      </div>

      <div className="studio-review-actions">
        {isPolicy ? (
          <>
            <button
              className="studio-button is-primary"
              onClick={onExportPdf}
              disabled={warnings.length > 0 || isExporting}
            >
              {isExporting ? "Preparing PDF…" : "Export PDF"}
            </button>
            <button
              className="studio-button is-secondary"
              onClick={onPrint}
              disabled={isExporting}
            >
              System Print
            </button>
          </>
        ) : (
          <button
            className="studio-button is-primary"
            onClick={onExportPng}
            disabled={warnings.length > 0 || isExporting}
          >
            {isExporting ? "Preparing High-Res PNG…" : "Export High-Res PNG"}
          </button>
        )}
        <button className="studio-button is-secondary" disabled>
          Submit for Approval
        </button>
      </div>
      {exportState.message ? (
        <p
          className={`studio-export-status is-${exportState.status}`}
          role={exportState.status === "error" ? "alert" : "status"}
        >
          {exportState.message}
        </p>
      ) : null}
      <p className="studio-review-footnote">
        Exports are generated from the exact live preview. Approval history
        remains disabled until its review workflow is defined.
      </p>
    </div>
  );
}

function StepContent({
  step,
  project,
  updateProject,
  updateContent,
  warnings,
  onExportPng,
  onExportPdf,
  exportState,
  cloud,
  unsplash,
}) {
  if (step === 0) {
    return (
      <SourceStep
        project={project}
        updateProject={updateProject}
        cloud={cloud}
        unsplash={unsplash}
      />
    );
  }
  if (step === 1) {
    return project.templateId === "policy-document" ? (
      <PolicyContentStep
        content={project.content}
        updateContent={updateContent}
      />
    ) : (
      <EventContentStep
        content={project.content}
        updateContent={updateContent}
      />
    );
  }
  if (step === 2) {
    return project.templateId === "policy-document" ? (
      <PolicyLayoutStep
        content={project.content}
        updateContent={updateContent}
      />
    ) : (
      <EventLayoutStep
        content={project.content}
        updateContent={updateContent}
        templateId={project.templateId}
      />
    );
  }
  if (step === 3) {
    return project.templateId === "policy-document" ? (
      <PolicyBrandStep
        content={project.content}
        updateContent={updateContent}
      />
    ) : (
      <EventBrandStep
        content={project.content}
        updateContent={updateContent}
        templateId={project.templateId}
      />
    );
  }
  return (
    <ReviewStep
      project={project}
      warnings={warnings}
      onPrint={() => window.print()}
      onExportPng={onExportPng}
      onExportPdf={onExportPdf}
      exportState={exportState}
    />
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

function DocumentFooterFields({content, updateContent}) {
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
          maxLength={40}
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
          onChange={({draftValue, items}) =>
            updateContent({primaryItemsText: draftValue, primaryItems: items})
          }
          maximum={7}
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
          onChange={({draftValue, items}) =>
            updateContent({
              secondaryItemsText: draftValue,
              secondaryItems: items,
            })
          }
          maximum={7}
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
          onChange={({draftValue, items}) =>
            updateContent({ownerItemsText: draftValue, ownerItems: items})
          }
          maximum={3}
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
          onChange={({draftValue, items}) =>
            updateContent({processStepsText: draftValue, processSteps: items})
          }
          maximum={8}
          rows={6}
          hint="One short process step per line; up to 8 steps."
        />
      </div>
      <DocumentFooterFields
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
  const fileInputRef = useRef(null);
  const [uploadState, setUploadState] = useState({status: "", message: ""});
  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadState({status: "error", message: "Use a JPG, PNG, or WebP image."});
      return;
    }
    if (file.size >= 8 * 1024 * 1024) {
      setUploadState({status: "error", message: "Use an image smaller than 8 MB."});
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      updateCard({
        imageUrl: String(reader.result || ""),
        imageStoragePath: "",
        sourceType: "manual",
      });
    reader.readAsDataURL(file);
    if (!cloud) {
      setUploadState({
        status: "success",
        message: "Preview loaded for this browser session.",
      });
      return;
    }
    setUploadState({status: "working", message: "Saving directory image…"});
    try {
      const image = await cloud.uploadDirectoryImage(
        project,
        page.id,
        card.id,
        file,
      );
      updateCard({...image, sourceType: card.sourceType || "manual"});
      setUploadState({status: "success", message: "Directory image saved."});
    } catch (error) {
      setUploadState({status: "error", message: error.message});
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
            onClick={deleteCard}
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
              onClick={() =>
                updateCard({imageUrl: "", imageStoragePath: ""})
              }
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
  const updateCards = (nextCards) => updateContent({cards: nextCards});
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
        onImport={(groups) => updateCards([...cards, ...groups].slice(0, 8))}
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
              updateCards(
                cards.map((item) =>
                  item.id === card.id ? {...item, ...changes} : item,
                ),
              )
            }
            moveCard={(direction) => {
              const targetIndex = index + direction;
              if (targetIndex < 0 || targetIndex >= cards.length) return;
              const nextCards = [...cards];
              [nextCards[index], nextCards[targetIndex]] = [
                nextCards[targetIndex],
                nextCards[index],
              ];
              updateCards(nextCards);
            }}
            deleteCard={() =>
              updateCards(cards.filter((item) => item.id !== card.id))
            }
          />
        ))}
      </div>
      <button
        className="studio-button is-secondary studio-add-directory-card"
        type="button"
        disabled={cards.length >= 8}
        onClick={() => updateCards([...cards, createDirectoryCard()])}
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

function DocumentPageInspector({
  page,
  updatePage,
  project,
  cloud,
  services,
}) {
  const updateContent = (changes) =>
    updatePage({content: {...page.content, ...changes}});
  if (page.templateId === "document-checklist") {
    return (
      <ChecklistInspector
        content={page.content}
        updateContent={updateContent}
      />
    );
  }
  if (page.templateId === "document-signup-sheet") {
    return (
      <SignupSheetInspector
        content={page.content}
        updateContent={updateContent}
      />
    );
  }
  if (page.templateId === "document-directory") {
    return (
      <DirectoryInspector
        content={page.content}
        updateContent={updateContent}
        project={project}
        page={page}
        cloud={cloud}
        services={services}
      />
    );
  }
  if (page.templateId === "document-content-page") {
    return (
      <ContentPageInspector
        content={page.content}
        updateContent={updateContent}
      />
    );
  }
  return (
    <OnePagerInspector
      content={page.content}
      updateContent={updateContent}
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
            <h2 id="studio-creative-filename-title">Name this file</h2>
            <p>
              Studio formats the download as
              CONTENTID_WORKTYPE_DESCRIPTION_YYYYMMDD_VXXX.
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
            <span>DOWNLOAD NAME</span>
            <strong>{preview}.{extension}</strong>
          </div>
          {error ? <p className="studio-creative-filename-error" role="alert">{error}</p> : null}
          <div className="studio-creative-filename-actions">
            <button className="studio-button is-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="studio-button is-primary" type="submit">
              Export {extension.toUpperCase()}
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
}) {
  const [activePageId, setActivePageId] = useState(project.pages?.[0]?.id || "");
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [creativeFilenameEnabled, setCreativeFilenameEnabled] =
    useCreativeFilenamePreference();
  const [exportState, setExportState] = useState({status: "", message: ""});
  const exportPageRefs = useRef(new Map());
  const printPagesRef = useRef(null);
  const pages = project.pages || [];
  const activePage =
    pages.find((page) => page.id === activePageId) || pages[0] || null;
  const activeIndex = activePage
    ? pages.findIndex((page) => page.id === activePage.id)
    : -1;
  const warnings = getProjectWarnings(project);

  useEffect(() => {
    if (!pages.length) return;
    if (!pages.some((page) => page.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [activePageId, pages]);

  const updateProject = (changes) =>
    onChange({...project, ...changes, updatedAt: new Date().toISOString()});
  const updatePage = (pageId, changes) => {
    updateProject({
      pages: pages.map((page) =>
        page.id === pageId ? {...page, ...changes} : page,
      ),
    });
  };
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
    try {
      const elements = pages.map((page) => exportPageRefs.current.get(page.id));
      const result = await exportDocumentPdf(project, elements, {
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
    setExportState({status: "working", message: "Preparing System Print…"});
    try {
      await openDocumentSystemPrint(project, printPagesRef.current, {
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
              disabled={exportState.status === "working"}
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
              page={activePage}
              updatePage={(changes) => updatePage(activePage.id, changes)}
              project={project}
              cloud={cloud}
              services={cloud || unsplash}
            />
          ) : null}
        </aside>
      </div>

      <div
        ref={printPagesRef}
        className="studio-document-export-pages"
        data-studio-document-print
        aria-hidden="true"
      >
        {pages.map((page, index) => (
          <DocumentPagePreview
            key={page.id}
            page={page}
            pageNumber={index + 1}
            pageCount={pages.length}
            showPageNumbers={project.documentSettings?.showPageNumbers !== false}
            previewRef={(element) => {
              if (element) exportPageRefs.current.set(page.id, element);
              else exportPageRefs.current.delete(page.id);
            }}
          />
        ))}
      </div>

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
      message: "Loading current Central events from Planning Center…",
    }));
    try {
      const events = await services.loadPlanningCenterEvents();
      setEventState({
        status: "ready",
        events,
        message: events.length
          ? `${events.length} current event${events.length === 1 ? "" : "s"} available.`
          : "No current Central-tagged Planning Center events were found.",
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
          "The linked occurrence is no longer in Central’s current Planning Center event feed.",
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
          Choose a current Central event to import its Planning Center facts.
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
          {isExporting ? "Preparing High-Res PNG…" : "Export High-Res PNG"}
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
}) {
  const [selectedField, setSelectedField] = useState("");
  const [activePanel, setActivePanel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const previewElementRef = useRef(null);
  const workspacePanelFrameRef = useRef(null);
  const workspacePanelTimerRef = useRef(null);
  const warnings = getProjectWarnings(project);
  const template = getTemplateById(project.templateId);
  const isSocial = template.kind === "social";
  const formatLabel =
    project.content.format === "screen"
      ? "16:9"
      : project.content.format === "portrait"
        ? "4:5"
        : "1:1";
  const requestedWorkspacePanel = activePanel || sideSheet;

  const updateProject = (changes) => {
    onChange({...project, ...changes, updatedAt: new Date().toISOString()});
  };
  const updateContent = (changes) => {
    updateProject({content: {...project.content, ...changes}});
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
  }, [project.id]);

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
    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, []);

  const runExport = async (filenameBase = "") => {
    setShowFilenameDialog(false);
    setSelectedField("");
    setActivePanel("");
    setMenuOpen(false);
    setSideSheet("");
    setExportState({
      status: "working",
      message: "Preparing the high-resolution PNG…",
    });
    try {
      await new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve),
        ),
      );
      const result = await exportEventPng(project, previewElementRef.current, {
        filenameBase,
      });
      setExportState({
        status: "success",
        message: `${result.filename} was downloaded at ${result.width} × ${result.height}px.`,
      });
    } catch (error) {
      setExportState({
        status: "error",
        message:
          error.message ||
          "Studio could not export this project. Try removing the background image and exporting again.",
      });
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
          <div className="studio-event-menu-wrap">
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
                  Export PNG
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
                : "Export a high-resolution PNG."
            }
            onClick={requestExport}
          >
            {exportState.status === "working" ? "Exporting…" : "Export PNG"}
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
          {renderedWorkspacePanel === "hero" && !isSocial ? (
            <EventToolSideSheet
              eyebrow="HERO"
              title="Text or event logo"
              label="hero controls"
              onClose={() => setActivePanel("")}
            >
              <EventHeroControls
                content={project.content}
                updateContent={updateContent}
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
                content={project.content}
                updateContent={updateContent}
                cloud={cloud}
                unsplash={unsplash}
                project={project}
              />
            </EventToolSideSheet>
          ) : null}
          {renderedWorkspacePanel === "brief" ? (
            isSocial ? (
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
            />
          ) : null}
        </div>

        <section
          className="studio-event-canvas-region"
          onPointerDownCapture={() => setMenuOpen(false)}
        >
          <div className="studio-event-canvas-meta">
            <span>LIVE CANVAS</span>
            <strong>{formatLabel}</strong>
            <p>Click any text to edit it. Template positions remain fixed.</p>
          </div>
          <div
            className={`studio-event-canvas-stage is-${project.content.format || "square"}`}
            data-studio-print-preview
          >
            <EventPreview
              content={project.content}
              previewRef={previewElementRef}
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
        content={project.content}
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
  const [projects, setProjects] = useState(loadProjects);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [saveState, setSaveState] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const saveTimer = useRef(null);
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

  const currentProject = projects.find(
    (project) => project.id === currentProjectId,
  );

  useEffect(() => {
    window.scrollTo({top: 0, behavior: "auto"});
  }, [currentProjectId]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (authState.status !== "ready" || !cloud) return undefined;
    let active = true;

    async function loadCloudProjects() {
      setCloudMessage("Loading your Central Studio projects…");
      try {
        const shareToken = new URLSearchParams(window.location.search).get(
          "share",
        );
        let acceptedProjectId = "";
        if (shareToken) {
          const accepted = await cloud.acceptShare(shareToken);
          acceptedProjectId = accepted.projectId;
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("share");
          window.history.replaceState({}, "", cleanUrl);
        }

        let cloudProjects = await cloud.loadProjects();
        const cloudIds = new Set(cloudProjects.map((project) => project.id));
        const browserProjects = loadProjects();
        const projectsToMigrate = browserProjects.filter(
          (project) =>
            !cloudIds.has(project.id) || project.cloudBacked === false,
        );
        const failedMigrationIds = new Set();
        if (projectsToMigrate.length) {
          setCloudMessage(
            `Moving ${projectsToMigrate.length} browser project${
              projectsToMigrate.length === 1 ? "" : "s"
            } into your account…`,
          );
          const migrationResults = await Promise.allSettled(
            projectsToMigrate.map((project) => cloud.saveProject(project)),
          );
          migrationResults.forEach((result, index) => {
            if (result.status === "rejected") {
              failedMigrationIds.add(projectsToMigrate[index].id);
            }
          });
          cloudProjects = await cloud.loadProjects();
        }
        if (!active) return;
        const refreshedCloudIds = new Set(
          cloudProjects.map((project) => project.id),
        );
        const browserOnlyProjects = projectsToMigrate
          .filter(
            (project) =>
              failedMigrationIds.has(project.id) ||
              !refreshedCloudIds.has(project.id),
          )
          .map((project) => ({...project, cloudBacked: false}));
        const browserOnlyIds = new Set(
          browserOnlyProjects.map((project) => project.id),
        );
        const availableProjects = [
          ...cloudProjects.filter(
            (project) => !browserOnlyIds.has(project.id),
          ),
          ...browserOnlyProjects,
        ];
        const migrationFailureCount = browserOnlyProjects.length;
        setProjects(availableProjects);
        persistProjects(availableProjects);
        if (acceptedProjectId) setCurrentProjectId(acceptedProjectId);
        if (migrationFailureCount) {
          setCloudMessage(
            `${migrationFailureCount} older browser project${
              migrationFailureCount === 1 ? "" : "s"
            } could not be moved into Central yet. ${
              migrationFailureCount === 1 ? "It is" : "They are"
            } still saved in this browser.`,
          );
          setSaveState("Browser project needs attention");
        } else {
          setCloudMessage("");
          setSaveState("Saved to Central");
        }
      } catch (error) {
        if (!active) return;
        setCloudMessage(
          "Studio could not load cloud projects right now. " +
            "Your browser projects are still available on this device.",
        );
      }
    }

    loadCloudProjects();
    return () => {
      active = false;
    };
  }, [authState.status, cloud]);

  if (authState.status !== "ready") {
    return <AccessScreen authState={authState} />;
  }

  const canCreate = EDIT_PERMISSIONS.has(authState.permission);

  const scheduleSave = (project) => {
    setSaveState(cloud ? "Saving to Central…" : "Saving in this browser…");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!cloud) {
        setSaveState("Saved in this browser");
        return;
      }
      try {
        const savedProject = await cloud.saveProject(project);
        setProjects((current) => {
          const next = current.map((item) =>
            item.id === savedProject.id
              ? isDocumentProject(item)
                ? {...item, ...savedProject, pages: item.pages}
                : {...item, ...savedProject, content: item.content}
              : item,
          );
          persistProjects(next);
          return next;
        });
        setSaveState("Saved to Central");
      } catch (error) {
        setSaveState("Browser saved · Central sync needs attention");
        setCloudMessage(error.message);
      }
    }, 500);
  };

  const saveProjects = (nextProjects, changedProject = null) => {
    setProjects(nextProjects);
    persistProjects(nextProjects);
    if (changedProject) scheduleSave(changedProject);
  };

  const createProject = (templateId) => {
    if (!canCreate) return;
    const project = createStudioProject(templateId);
    saveProjects([project, ...projects], project);
    setCurrentProjectId(project.id);
  };

  const updateProject = (nextProject) => {
    const nextProjects = projects.map((project) =>
      project.id === nextProject.id ? nextProject : project,
    );
    saveProjects(nextProjects, nextProject);
  };

  const deleteProject = async (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const confirmed = window.confirm(
      project.shared
        ? `Leave "${project.name}"? It will disappear from your Studio projects, but the owner keeps it.`
        : `Delete "${project.name}"? This removes the project and its uploaded images for everyone and cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      if (cloud && project.cloudBacked) {
        if (project.shared) {
          await cloud.leaveProject(projectId);
        } else {
          await cloud.deleteProject(projectId);
        }
      }
      const nextProjects = projects.filter((item) => item.id !== projectId);
      setProjects(nextProjects);
      persistProjects(nextProjects);
      setSaveState(cloud ? "Saved to Central" : "Saved in this browser");
      if (currentProjectId === projectId) {
        setCurrentProjectId("");
      }
    } catch (error) {
      setCloudMessage(error.message);
    }
  };

  const shareProject = async (projectId) => {
    if (!cloud) return;
    setSaveState("Creating share link…");
    try {
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

  return (
    <div className="studio-app">
      {!currentProject || isDocumentProject(currentProject) ? (
        <StudioHeader
          authState={authState}
          view={currentProject ? "editor" : "home"}
          onHome={() => setCurrentProjectId("")}
          saveState={saveState}
        />
      ) : null}
      {cloudMessage ? (
        <div className="studio-cloud-message" role="status">
          <span>{cloudMessage}</span>
          <button onClick={() => setCloudMessage("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {currentProject ? (
        <StudioEditor
          project={currentProject}
          onChange={updateProject}
          onBack={() => setCurrentProjectId("")}
          onDelete={deleteProject}
          onShare={shareProject}
          cloud={cloud}
          unsplash={unsplash}
          saveState={saveState}
          canManageLogoLibrary={
            String(authState.userData?.pageAccess?.studio || "")
              .trim()
              .toLowerCase() === "admin"
          }
        />
      ) : (
        <StudioHome
          projects={projects}
          canCreate={canCreate}
          onCreate={createProject}
          onOpen={setCurrentProjectId}
          onDelete={deleteProject}
          cloudEnabled={Boolean(cloud)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("studio-root")).render(<StudioApp />);
