import React, {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";

import {exportEventPng, exportPolicyPdf} from "./export.js";
import {normalizeFocalValue, normalizeImageZoom} from "./focal.js";
import {
  createStudioCloud,
  createStudioPreviewUnsplash,
} from "./persistence.js";
import {StudioPreview} from "./previews.jsx";
import {
  BRAND_COLOR_OPTIONS,
  STUDIO_STEPS,
  STUDIO_STORAGE_KEY,
  TEMPLATE_CATALOG,
  createStudioProject,
  getEventCompositionOptions,
  getEventFontOptions,
  getProjectWarnings,
  getTemplateById,
  isEventTemplateId,
  linesToText,
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
const EVENT_BLEND_OPTIONS = [
  {value: "multiply", label: "Multiply"},
  {value: "screen", label: "Screen"},
  {value: "overlay", label: "Overlay"},
  {value: "soft-light", label: "Soft Light"},
];

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
      ? stored.map((project) => {
          if (!isEventTemplateId(project.templateId) || !project.content) {
            return project;
          }
          const normalizedComposition = normalizeEventComposition(
            project.templateId,
            project.content.composition,
          );
          const hasFocalPoint =
            Number.isFinite(Number(project.content.focalX)) &&
            Number.isFinite(Number(project.content.focalY));
          if (
            hasFocalPoint &&
            normalizedComposition === project.content.composition
          ) {
            return project;
          }
          const legacyX = {
            "left center": 25,
            center: 50,
            "right center": 75,
          }[project.content.imagePosition] ?? 50;
          return {
            ...project,
            content: {
              ...project.content,
              composition: normalizedComposition,
              focalX: hasFocalPoint ? project.content.focalX : legacyX,
              focalY: hasFocalPoint ? project.content.focalY : 50,
            },
          };
        })
      : [];
  } catch (error) {
    return [];
  }
}

function prepareProjectForStorage(project) {
  const stored = JSON.parse(JSON.stringify(project));
  if (
    isEventTemplateId(stored.templateId) &&
    stored.content &&
    String(stored.content.backgroundImage || "").startsWith("data:")
  ) {
    stored.content.backgroundImage = "";
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
  if (template.kind === "policy") {
    return (
      <div className="studio-template-art is-policy" aria-hidden="true">
        <div className="template-paper-header">
          <span />
          <span />
        </div>
        <div className="template-paper-rule" />
        <div className="template-paper-columns">
          <span />
          <span />
        </div>
        <div className="template-paper-card" />
        <div className="template-paper-footer" />
      </div>
    );
  }

  return (
    <div
      className={`studio-template-art is-event is-${template.variant}`}
      style={{
        "--template-art-font": `"${template.fonts[0].family}"`,
      }}
      aria-hidden="true"
    >
      <span className="template-event-orbit is-one" />
      <span className="template-event-orbit is-two" />
      <div className="template-event-copy">
        <span>{template.previewCopy.eyebrow}</span>
        <strong>{template.previewCopy.title}</strong>
        <small>{template.previewCopy.footer}</small>
      </div>
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
  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      ),
    [projects],
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

        <div className="studio-template-grid">
          {TEMPLATE_CATALOG.map((template) => (
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
                {template.kind === "event" ? (
                  <div
                    className="studio-template-fonts"
                    aria-label={`${template.name} font choices`}
                  >
                    {template.fonts.map((font) => (
                      <span
                        key={font.key}
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

      <section className="studio-home-section">
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
          <div className="studio-project-list">
            {sortedProjects.map((project) => {
              const template = getTemplateById(project.templateId);
              return (
                <div
                  className="studio-project-row"
                  key={project.id}
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
                        {template.name} · {project.shared ? "Shared with you · " : ""}
                        Updated{" "}
                        {new Date(project.updatedAt).toLocaleDateString()}
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
            })}
          </div>
        ) : (
          <div className="studio-empty-projects">
            <span>01</span>
            <div>
              <h3>Your first project starts above.</h3>
              <p>
                Choose a policy document or event graphic to open the guided
                Studio workspace.
              </p>
            </div>
          </div>
        )}
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
      <label className="studio-image-zoom">
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
      <p className="studio-focal-note">
        Focal movement only appears where the cropped image has room to move.
        Increase zoom when an axis feels locked.
      </p>
    </div>
  );
}

function EventQuickToolbar({content, updateContent, templateId}) {
  const alignment = content.textAlignment || "left";
  const fontOptions = getEventFontOptions(templateId);
  const compositionOptions = getEventCompositionOptions(templateId);
  const selectedComposition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  return (
    <div className="studio-event-toolbar" aria-label="Event design controls">
      <div className="studio-toolbar-group is-alignment">
        <span>Text</span>
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
            aria-label={`Align text ${option.value}`}
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
        <span>Font</span>
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
        <span>Ratio</span>
        <select
          value={content.format || "square"}
          onChange={(event) => updateContent({format: event.target.value})}
        >
          {EVENT_FORMAT_OPTIONS.map((option) => (
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

      {selectedComposition === "flat" ? (
        <label className="is-color">
          <span>Background</span>
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
            <span>Color</span>
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
            <span>Blend</span>
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
  );
}

function UnsplashSearch({unsplash, content, updateContent}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [state, setState] = useState({status: "", message: ""});

  const search = async (event) => {
    event.preventDefault();
    if (!unsplash || query.trim().length < 2) return;
    setState({status: "working", message: "Searching Unsplash…"});
    try {
      const orientation =
        content.format === "portrait"
          ? "portrait"
          : content.format === "square"
            ? "squarish"
            : "landscape";
      const data = await unsplash.searchUnsplash(query.trim(), orientation);
      setResults(data.results || []);
      setState({
        status: "success",
        message: data.results?.length
          ? `${data.results.length} photos found.`
          : "No photos matched that search.",
      });
    } catch (error) {
      setState({status: "error", message: error.message});
    }
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
      });
      setState({
        status: "success",
        message: `Photo by ${photo.photographerName} added.`,
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
            options={[
              {value: "charcoal-red", label: "Charcoal + CrossPointe Red"},
              {value: "warm-light", label: "Warm Editorial Light"},
              {value: "blue-charcoal", label: "Blue + Charcoal"},
            ]}
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
          maxLength={130}
          rows={3}
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

function StudioEditor({
  project,
  onChange,
  onBack,
  onDelete,
  onShare,
  cloud,
  unsplash,
}) {
  const [step, setStep] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [exportState, setExportState] = useState({status: "", message: ""});
  const previewElementRef = useRef(null);
  const warnings = getProjectWarnings(project);

  const updateProject = (changes) => {
    onChange({...project, ...changes, updatedAt: new Date().toISOString()});
  };
  const updateContent = (changes) => {
    updateProject({content: {...project.content, ...changes}});
  };
  const currentStep = STUDIO_STEPS[step];
  const runExport = async (type) => {
    setExportState({
      status: "working",
      message: `Preparing ${type === "pdf" ? "the PDF" : "the PNG"}…`,
    });
    try {
      const result =
        type === "pdf"
          ? await exportPolicyPdf(project, previewElementRef.current)
          : await exportEventPng(project, previewElementRef.current);
      setExportState({
        status: "success",
        message:
          type === "png"
            ? `${result.filename} was downloaded at ${result.width} × ${result.height}px.`
            : `${result.filename} was downloaded.`,
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

  return (
    <main className="studio-editor">
      <div className="studio-editor-titlebar">
        <div>
          <span className="studio-kicker">
            {getTemplateById(project.templateId).name}
          </span>
          <h1>{project.name}</h1>
        </div>
        <div className="studio-editor-title-actions">
          <StatusPill tone="draft">DRAFT</StatusPill>
          {!project.shared ? (
            <button
              className="studio-button is-secondary"
              onClick={() => onShare(project.id)}
              disabled={!cloud || !project.cloudBacked}
              title={
                !project.cloudBacked
                  ? "Wait for this project to finish saving before sharing."
                  : "Create a 30-day Studio share link."
              }
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
          <button
            className="studio-button is-secondary studio-mobile-preview-button"
            onClick={() => setPreviewVisible(true)}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="studio-workspace">
        <nav className="studio-step-rail" aria-label="Studio workflow">
          {STUDIO_STEPS.map((item, index) => (
            <button
              key={item.id}
              className={[
                index === step ? "is-active" : "",
                index < step ? "is-complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setStep(index)}
              aria-current={index === step ? "step" : undefined}
            >
              <span>{index < step ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </button>
          ))}
        </nav>

        <section className="studio-editor-panel">
          <StepContent
            step={step}
            project={project}
            updateProject={updateProject}
            updateContent={updateContent}
            warnings={warnings}
            onExportPng={() => runExport("png")}
            onExportPdf={() => runExport("pdf")}
            exportState={exportState}
            cloud={cloud}
            unsplash={unsplash}
          />
          <footer className="studio-workflow-footer">
            <button
              className="studio-button is-secondary"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
            <span>
              Step {step + 1} of {STUDIO_STEPS.length} · {currentStep.label}
            </span>
            {step < STUDIO_STEPS.length - 1 ? (
              <button
                className="studio-button is-primary"
                onClick={() =>
                  setStep((current) =>
                    Math.min(STUDIO_STEPS.length - 1, current + 1),
                  )
                }
              >
                Continue
              </button>
            ) : (
              <button className="studio-button is-secondary" onClick={onBack}>
                Finish for Now
              </button>
            )}
          </footer>
        </section>

        <aside
          className={`studio-preview-panel${previewVisible ? " is-mobile-open" : ""}`}
        >
          <div className="studio-preview-toolbar">
            <div>
              <span>LIVE PREVIEW</span>
              <strong>
                {project.templateId === "policy-document"
                  ? "US Letter"
                  : project.content.format === "screen"
                    ? "16:9"
                    : project.content.format === "portrait"
                      ? "4:5"
                      : "1:1"}
              </strong>
            </div>
            <button
              className="studio-preview-close"
              onClick={() => setPreviewVisible(false)}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
          <div
            className={`studio-preview-stage is-${project.templateId}`}
            data-studio-print-preview
          >
            <StudioPreview
              project={project}
              previewRef={previewElementRef}
            />
          </div>
          {isEventTemplateId(project.templateId) ? (
            <EventQuickToolbar
              content={project.content}
              updateContent={updateContent}
              templateId={project.templateId}
            />
          ) : null}
          <div className="studio-preview-note">
            <span aria-hidden="true">●</span>
            The preview is composed from controlled HTML and CSS, not a
            generated final graphic.
          </div>
        </aside>
      </div>
    </main>
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
          (project) => !cloudIds.has(project.id),
        );
        if (projectsToMigrate.length) {
          setCloudMessage(
            `Moving ${projectsToMigrate.length} browser project${
              projectsToMigrate.length === 1 ? "" : "s"
            } into your account…`,
          );
          await Promise.all(
            projectsToMigrate.map((project) => cloud.saveProject(project)),
          );
          cloudProjects = await cloud.loadProjects();
        }
        if (!active) return;
        setProjects(cloudProjects);
        persistProjects(cloudProjects);
        if (acceptedProjectId) setCurrentProjectId(acceptedProjectId);
        setCloudMessage("");
        setSaveState("Saved to Central");
      } catch (error) {
        if (!active) return;
        setCloudMessage(
          `${error.message} Browser saving remains available on this device.`,
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
              ? {...item, ...savedProject, content: item.content}
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
      <StudioHeader
        authState={authState}
        view={currentProject ? "editor" : "home"}
        onHome={() => setCurrentProjectId("")}
        saveState={saveState}
      />
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
