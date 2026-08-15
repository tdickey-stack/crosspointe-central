import "temporal-polyfill/global";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import {
  PLAY_STATUSES,
  addDays,
  allocateLevel4SocialSlots,
  applySmuggle,
  businessLocalToIso,
  businessNowInputValue,
  dateKey,
  evaluateCapacity,
  generateCampaignSchedule,
  groupCalendarCampaignDays,
  nextPlanningWeekStart,
  recommendSmuggleOpportunities,
  scheduleSummary,
  utilizationForWeek,
  weeklyInventoryPlays,
} from "./domain.js";
import {createPlannerStore} from "./persistence.js";
import {isStarterPlaybookId} from "./seed-data.js";
import "./planner.css";

const EDIT_PERMISSIONS = new Set(["propose", "edit", "approve", "admin"]);
const VIEW_STORAGE_KEY = "central-promotion-planner-calendar-view";
const NAV_ITEMS = [
  {id: "overview", label: "Overview", icon: "◫"},
  {id: "calendar", label: "Calendar", icon: "▦"},
  {id: "campaigns", label: "Campaigns", icon: "◆"},
  {id: "playbooks", label: "Playbooks", icon: "▤"},
  {id: "rules", label: "Rules", icon: "⚙"},
];

const LEVEL_COLORS = {
  1: "#ef3e2d",
  2: "#f59e0b",
  3: "#4bb8e9",
  4: "#4bc3a7",
  5: "#a78bfa",
};

function getPlannerPermission(userData) {
  const pageAccess = userData?.pageAccess && typeof userData.pageAccess === "object"
    ? userData.pageAccess
    : {};
  return String(pageAccess.planner || pageAccess.studio || pageAccess.settings || "none")
    .trim()
    .toLowerCase();
}

function isLocalFirebaseHost() {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(window.location.hostname);
}

function getEmulatorHost() {
  const hostname = String(window.location.hostname || "").trim();
  return hostname === "[::1]" ? "::1" : hostname || "127.0.0.1";
}

function usePlannerAuth() {
  const [state, setState] = useState({
    status: "loading",
    auth: null,
    firestore: null,
    user: null,
    userData: null,
    permission: "none",
    preview: false,
    message: "Connecting Promotion Planner to Central.",
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = null;
    async function initialize() {
      const preview = isLocalFirebaseHost() && new URLSearchParams(window.location.search).get("preview") === "1";
      if (preview) {
        setState({
          status: "ready",
          auth: null,
          firestore: null,
          user: {
            uid: "planner-local-preview",
            email: "planner-preview@crosspointe.tv",
            displayName: "Planner Preview",
            photoURL: "",
          },
          userData: {active: true, pageAccess: {planner: "admin"}},
          permission: "admin",
          preview: true,
          message: "Local Planner preview access confirmed.",
        });
        return;
      }
      try {
        await window.CENTRAL_PLANNER_FIREBASE_READY;
        if (!window.firebase?.apps) {
          throw new Error("Firebase did not load. Open Planner through Firebase Hosting or the Emulator Suite.");
        }
        const app = window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(window.__FIREBASE_DEFAULTS__ || {});
        const auth = window.firebase.auth(app);
        const firestore = window.firebase.firestore(app);
        if (isLocalFirebaseHost()) {
          const host = getEmulatorHost();
          try {
            auth.useEmulator(`http://${host === "::1" ? "[::1]" : host}:9099`);
          } catch (_error) {}
          try {
            firestore.useEmulator(host, 8080);
          } catch (_error) {}
        }
        try {
          await auth.getRedirectResult();
        } catch (error) {
          if (active) setState((current) => ({...current, status: "error", auth, message: error.message}));
        }
        unsubscribe = auth.onAuthStateChanged(async (user) => {
          if (!active) return;
          if (!user) {
            setState({
              status: "signed-out",
              auth,
              firestore,
              user: null,
              userData: null,
              permission: "none",
              preview: false,
              message: "Sign in with your Central admin account to use Promotion Planner.",
            });
            return;
          }
          setState((current) => ({...current, status: "loading", auth, firestore, user, message: "Checking Planner access."}));
          try {
            const snapshot = await firestore.doc(`centralAdmin/root/users/${user.uid}`).get();
            const userData = snapshot.exists ? snapshot.data() : null;
            const permission = getPlannerPermission(userData);
            const authorized = userData?.active === true && permission !== "none";
            setState({
              status: authorized ? "ready" : "unauthorized",
              auth,
              firestore,
              user,
              userData,
              permission,
              preview: false,
              message: authorized
                ? "Planner access confirmed."
                : "This account does not currently have Promotion Planner access.",
            });
          } catch (error) {
            setState({
              status: "error",
              auth,
              firestore,
              user,
              userData: null,
              permission: "none",
              preview: false,
              message: error.message || "Planner could not load Central access.",
            });
          }
        });
      } catch (error) {
        if (active) setState((current) => ({...current, status: "error", message: error.message}));
      }
    }
    initialize();
    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  return state;
}

async function signIn(auth) {
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt: "select_account"});
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      await auth.signInWithRedirect(provider);
      return;
    }
    throw error;
  }
}

function Brand({compact = false}) {
  return (
    <a className="planner-brand" href="/planner" aria-label="Promotion Planner home">
      <img src="/favicon.svg" alt="" />
      {!compact && <span><strong>Promotion</strong><b>Planner</b></span>}
    </a>
  );
}

function AccessScreen({authState}) {
  const canSignIn = authState.status === "signed-out" && authState.auth;
  return (
    <main className="planner-access-shell">
      <section className="planner-access-card">
        <Brand />
        <span className="planner-kicker">CrossPointe Creative</span>
        <h1>{authState.status === "loading" ? "Opening your planning workspace" : "Promotion planning, operationalized."}</h1>
        <p>{authState.message}</p>
        {canSignIn && (
          <button className="planner-button is-primary" onClick={() => signIn(authState.auth)}>
            Sign in with Google
          </button>
        )}
        {authState.user && authState.status !== "ready" && (
          <button className="planner-button is-secondary" onClick={() => authState.auth?.signOut()}>
            Sign out
          </button>
        )}
      </section>
    </main>
  );
}

function formatDate(value, options = {}) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: options.year === false ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey(value)}T12:00:00Z`));
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function StatusBadge({status, children}) {
  const value = String(status || "neutral");
  return <span className={`planner-badge is-${value}`}>{children || titleCase(value)}</span>;
}

function LevelBadge({level}) {
  return <span className="planner-level-badge" style={{"--level-color": LEVEL_COLORS[level]}}>L{level}</span>;
}

function EmptyState({title, copy, action}) {
  return (
    <div className="planner-empty-state">
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function AppHeader({authState, activeView, onMenu}) {
  return (
    <header className="planner-header">
      <button className="planner-mobile-menu" onClick={onMenu} aria-label="Open navigation">☰</button>
      <Brand />
      <div className="planner-header-context">
        <span className="planner-kicker">Promotion Planner</span>
        <strong>{NAV_ITEMS.find((item) => item.id === activeView)?.label}</strong>
      </div>
      <div className="planner-user-chip">
        {authState.user?.photoURL
          ? <img src={authState.user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span>{String(authState.user?.displayName || authState.user?.email || "P")[0]}</span>}
        <div>
          <strong>{authState.user?.displayName || authState.user?.email}</strong>
          <small>{authState.preview ? "Preview data" : titleCase(authState.permission)}</small>
        </div>
        {!authState.preview && (
          <button onClick={() => authState.auth?.signOut()} aria-label="Sign out">↗</button>
        )}
      </div>
    </header>
  );
}

function Sidebar({activeView, setActiveView, open, close}) {
  return (
    <>
      {open && <button className="planner-sidebar-scrim" onClick={close} aria-label="Close navigation" />}
      <aside className={`planner-sidebar ${open ? "is-open" : ""}`}>
        <div>
          <span className="planner-sidebar-label">Plan</span>
          <nav aria-label="Promotion Planner">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={activeView === item.id ? "is-active" : ""}
                onClick={() => { setActiveView(item.id); close(); }}
              >
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
        </div>
        <a href="/" className="planner-central-link">← Back to Central</a>
      </aside>
    </>
  );
}

function PageHeading({eyebrow, title, copy, actions}) {
  return (
    <div className="planner-page-heading">
      <div>
        <span className="planner-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {actions && <div className="planner-heading-actions">{actions}</div>}
    </div>
  );
}

function Overview({workspace, onNewCampaign, onOpenPlay, onSavePlay, onUseSmuggle, canEdit}) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const weekStart = nextPlanningWeekStart(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekPlays = workspace.scheduledPlays.filter((play) =>
    play.scheduledDate >= weekStart && play.scheduledDate <= weekEnd,
  );
  const utilization = utilizationForWeek({
    weekStart,
    plays: workspace.scheduledPlays,
    capacityRules: workspace.capacityRules,
  });
  const ongoing = workspace.playbooks.find((item) => item.id === "level-2-ongoing-awareness");
  const lane = ongoing
    ? workspace.scheduledPlays.some((play) =>
      Number(play.campaignLevel) === 2 && play.scheduledDate >= weekStart && play.scheduledDate <= weekEnd && !["missed", "skipped"].includes(play.status),
    )
    : false;
  const opportunities = recommendSmuggleOpportunities({
    hostPlays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  }).slice(0, 4);
  const attention = weekPlays.filter((play) =>
    ["conflict", "needs-decision", "missed"].includes(play.status),
  );
  const lateCampaigns = workspace.campaigns.filter((campaign) => campaign.isOnTime === false && campaign.status === "active");

  return (
    <>
      <PageHeading
        eyebrow={`Next planning week · ${formatDate(weekStart, {year: false})}–${formatDate(weekEnd)}`}
        title="Creative operations at a glance"
        copy="Capacity, coverage, and decisions across every active promotion campaign."
        actions={canEdit && <button className="planner-button is-primary" onClick={onNewCampaign}>＋ New campaign</button>}
      />
      <section className="planner-metric-grid" aria-label="Next planning week capacity">
        {utilization.map((item) => (
          <button
            type="button"
            className={`planner-metric-card ${item.capacityState === "conflict" ? "has-alert" : ["above-typical", "full"].includes(item.capacityState) ? "has-caution" : ""}`}
            key={item.id}
            onClick={() => setSelectedMetric({...item, inventoryType: "resource", resourceId: item.id})}
            aria-label={`Open ${item.name} promotions for next planning week`}
          >
            <div><span>{item.name}</span><StatusBadge status={item.capacityState} /></div>
            <strong>{item.used}<i>/</i>{item.capacity}</strong>
            <div className="planner-meter"><span style={{width: `${Math.min(100, item.used / item.capacity * 100)}%`}} /></div>
            {item.typicalCapacity < item.capacity && <p>Typical target {item.typicalCapacity} · hard maximum {item.capacity}</p>}
          </button>
        ))}
        <button
          type="button"
          className={`planner-metric-card ${lane ? "" : "has-alert"}`}
          onClick={() => setSelectedMetric({id: "level-2-lane", name: "Level 2 Lane", inventoryType: "level", campaignLevel: 2})}
          aria-label="Open Level 2 Lane promotions for next planning week"
        >
          <div><span>Level 2 Lane</span><StatusBadge status={lane ? "covered" : "needs-decision"}>{lane ? "Covered" : "Needs attention"}</StatusBadge></div>
          <strong className="is-word">{lane ? "Active" : "Open"}</strong>
          <p>{lane ? "Event or ongoing promotion is present." : "Add the ongoing Level 2 fallback."}</p>
        </button>
      </section>
      <section className="planner-dashboard-grid">
        <article className="planner-panel planner-week-agenda">
          <div className="planner-panel-heading">
            <div><span className="planner-kicker">Schedule</span><h2>Next planning week</h2></div>
            <StatusBadge>{weekPlays.length} plays</StatusBadge>
          </div>
          {weekPlays.length ? (
            <div className="planner-agenda-list">
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const day = addDays(weekStart, offset);
                const daily = weekPlays.filter((play) => play.scheduledDate === day);
                if (!daily.length) return null;
                return (
                  <div className="planner-agenda-day" key={day}>
                    <time dateTime={day}><b>{formatDate(day, {year: false}).split(" ")[0]}</b><strong>{dateKey(day).slice(-2)}</strong></time>
                    <div>{daily.map((play) => <PlayRow key={play.id} play={play} onClick={() => onOpenPlay(play)} />)}</div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="A clear week" copy="No scheduled plays are loaded for this week." />}
        </article>
        <div className="planner-dashboard-stack">
          <article className="planner-panel">
            <div className="planner-panel-heading">
              <div><span className="planner-kicker">Needs attention</span><h2>Decisions</h2></div>
              <StatusBadge status={attention.length ? "conflict" : "covered"}>{attention.length}</StatusBadge>
            </div>
            {attention.length ? attention.slice(0, 5).map((play) => (
              <button className="planner-attention-row" key={play.id} onClick={() => onOpenPlay(play)}>
                <span className={`planner-attention-dot is-${play.status}`} />
                <span><strong>{play.campaignName}</strong><small>{play.playType} · {titleCase(play.status)}</small></span>
                <span>›</span>
              </button>
            )) : <p className="planner-quiet-copy">No conflicts or missed plays need a decision.</p>}
          </article>
          <article className="planner-panel">
            <div className="planner-panel-heading">
              <div><span className="planner-kicker">Smuggle</span><h2>Opportunities</h2></div>
              <StatusBadge status="opportunity">{opportunities.length}</StatusBadge>
            </div>
            {opportunities.length ? opportunities.map((opportunity) => (
              <div className="planner-smuggle-row" key={opportunity.id}>
                <div><LevelBadge level={opportunity.beneficiaryLevel} /><span><strong>{opportunity.beneficiaryName}</strong><small>{opportunity.hostPlayType} · {formatDate(opportunity.scheduledDate)}</small></span></div>
                <p>{opportunity.scoreReason}</p>
                {canEdit && <button className="planner-text-button" onClick={() => onUseSmuggle(opportunity)}>Use as Smuggle →</button>}
              </div>
            )) : <p className="planner-quiet-copy">No open, Smuggle-capable Level 2 plays are currently loaded.</p>}
          </article>
          {lateCampaigns.length > 0 && (
            <article className="planner-panel planner-late-callout">
              <span className="planner-kicker">Submission health</span>
              <h2>{lateCampaigns.length} late campaign{lateCampaigns.length === 1 ? "" : "s"}</h2>
              <p>Past plays remain visible as missed; nothing is compressed into the current week.</p>
            </article>
          )}
        </div>
      </section>
      {selectedMetric && (
        <WeeklyInventoryModal
          metric={selectedMetric}
          weekStart={weekStart}
          weekEnd={weekEnd}
          plays={workspace.scheduledPlays}
          canEdit={canEdit}
          onClose={() => setSelectedMetric(null)}
          onSavePlay={onSavePlay}
        />
      )}
    </>
  );
}

function PlayRow({play, onClick}) {
  return (
    <button className="planner-play-row" onClick={onClick}>
      <span className="planner-play-level" style={{background: LEVEL_COLORS[play.campaignLevel]}} />
      <span><strong>{play.playType}</strong><small>{play.campaignName} · {play.channel}</small></span>
      {play.smuggle && <StatusBadge status="smuggle">Smuggle</StatusBadge>}
      <StatusBadge status={play.status} />
    </button>
  );
}

function WeeklyInventoryPlay({play, canEdit, onSave}) {
  const needsAttention = ["conflict", "needs-decision", "missed"].includes(play.status);
  const [expanded, setExpanded] = useState(needsAttention);
  const [draft, setDraft] = useState({...play});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    setDraft({...play});
    setExpanded((current) => current || ["conflict", "needs-decision", "missed"].includes(play.status));
  }, [play]);
  const changed = draft.scheduledDate !== play.scheduledDate || draft.status !== play.status;
  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave({...draft, manuallyAdjusted: true});
    } catch (error) {
      setSaveError(error.message || "This scheduled play could not be updated.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className={`planner-inventory-row ${needsAttention ? "has-alert" : ""}`}>
      <div className="planner-inventory-row-header">
        <LevelBadge level={play.campaignLevel} />
        <div><strong>{play.campaignName}</strong><small>{play.playType} · {play.channel} · {formatDate(play.scheduledDate, {year: false})}</small></div>
        <StatusBadge status={play.status} />
        {canEdit && <button className="planner-text-button" onClick={() => setExpanded((current) => !current)}>{expanded ? "Hide" : needsAttention ? "Resolve" : "Adjust"}</button>}
      </div>
      {expanded && canEdit && (
        <div className="planner-inventory-row-controls">
          <Field label="Scheduled date"><input type="date" value={draft.scheduledDate} onChange={(event) => setDraft({...draft, scheduledDate: event.target.value, status: "rescheduled"})} /></Field>
          <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({...draft, status: event.target.value})}>{PLAY_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></Field>
          <button className="planner-button is-primary" disabled={!changed || saving} onClick={save}>{saving ? "Saving…" : "Save change"}</button>
          {saveError && <p role="alert">{saveError}</p>}
        </div>
      )}
    </article>
  );
}

function WeeklyInventoryModal({metric, weekStart, weekEnd, plays, canEdit, onClose, onSavePlay}) {
  const matching = weeklyInventoryPlays({
    plays,
    weekStart,
    weekEnd,
    resourceId: metric.inventoryType === "resource" ? metric.resourceId : "",
    campaignLevel: metric.inventoryType === "level" ? metric.campaignLevel : null,
  });
  const attention = matching.filter((play) => ["conflict", "needs-decision", "missed"].includes(play.status));
  const active = matching.filter((play) => !["missed", "skipped", "completed"].includes(play.status));
  return (
    <Modal title={metric.name} eyebrow={`${formatDate(weekStart, {year: false})}–${formatDate(weekEnd)}`} onClose={onClose} size="wide">
      <div className="planner-inventory-summary">
        <span><strong>{matching.length}</strong> total plays</span>
        <span><strong>{active.length}</strong> active</span>
        <span><strong>{attention.length}</strong> need attention</span>
        {metric.capacity && <span><strong>{metric.capacity}</strong> weekly maximum</span>}
      </div>
      {attention.length > 0 && (
        <div className="planner-detail-note is-alert">
          <strong>{attention.length} play{attention.length === 1 ? " needs" : "s need"} a decision</strong>
          <p>Resolve a conflict here by moving the play to another date or changing its status. Moving it outside this week removes it from this list.</p>
        </div>
      )}
      {matching.length ? (
        <div className="planner-inventory-list">
          {matching.map((play) => <WeeklyInventoryPlay key={play.id} play={play} canEdit={canEdit} onSave={onSavePlay} />)}
        </div>
      ) : <EmptyState title="Nothing scheduled" copy={`No ${metric.name.toLowerCase()} promotions are scheduled for this week.`} />}
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

function CalendarView({workspace, canEdit, onOpenCampaign, onOpenPlay, onMovePlay}) {
  const calendarRef = useRef(null);
  const [view, setView] = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) || "dayGridMonth");
  const [filters, setFilters] = useState({campaign: "", level: "", channel: "", playType: "", status: ""});
  const filtered = useMemo(() => workspace.scheduledPlays.filter((play) =>
    (!filters.campaign || play.campaignId === filters.campaign) &&
    (!filters.level || String(play.campaignLevel) === filters.level) &&
    (!filters.channel || play.channel === filters.channel) &&
    (!filters.playType || play.playType === filters.playType) &&
    (!filters.status || play.status === filters.status),
  ), [workspace.scheduledPlays, filters]);
  const values = (key) => [...new Set(workspace.scheduledPlays.map((play) => play[key]).filter(Boolean))].sort();
  const events = view === "dayGridWeek"
    ? groupCalendarCampaignDays(filtered).map((group) => ({
      id: group.id,
      title: group.campaignName,
      start: group.scheduledDate,
      allDay: true,
      className: `planner-level-calendar-event is-level-${group.campaignLevel}`,
      editable: false,
      extendedProps: {weeklyGroup: group, sortLevel: Number(group.campaignLevel)},
    }))
    : filtered.map((play) => ({
      id: play.id,
      title: `${play.campaignName} · ${play.playType}`,
      start: play.scheduledDate,
      allDay: true,
      className: `planner-level-calendar-event is-level-${play.campaignLevel}`,
      editable: canEdit && !play.locked && !["completed", "missed", "skipped"].includes(play.status),
      extendedProps: {play, sortLevel: Number(play.campaignLevel)},
    }));
  const changeView = (next) => {
    calendarRef.current?.getApi?.().changeView(
      next,
      next === "dayGridWeek" ? nextPlanningWeekStart(new Date()) : undefined,
    );
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };
  const eventContent = (info) => {
    const weeklyGroup = info.event.extendedProps.weeklyGroup;
    if (weeklyGroup) {
      return (
        <div className="planner-calendar-event is-week is-campaign-week">
          <div><LevelBadge level={weeklyGroup.campaignLevel} /><strong>{weeklyGroup.campaignName}</strong><small>{weeklyGroup.plays.length} type{weeklyGroup.plays.length === 1 ? "" : "s"}</small></div>
          <ul>{weeklyGroup.plays.map((play) => (
            <li key={play.id}>{play.playType}{["conflict", "needs-decision", "missed"].includes(play.status) ? ` · ${titleCase(play.status)}` : ""}</li>
          ))}</ul>
        </div>
      );
    }
    const play = info.event.extendedProps.play;
    return (
      <div className="planner-calendar-event">
        <div><LevelBadge level={play.campaignLevel} /><strong>{play.campaignName}</strong></div>
        <span>{play.playType}</span>
      </div>
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="Scheduled Plays"
        title="Promotion calendar"
        copy="Month shows individual scheduled plays. Week combines same-day promotion types into one card per campaign."
        actions={
          <div className="planner-segmented">
            <button className={view === "dayGridMonth" ? "is-active" : ""} onClick={() => changeView("dayGridMonth")}>Month</button>
            <button className={view === "dayGridWeek" ? "is-active" : ""} onClick={() => changeView("dayGridWeek")}>Week</button>
          </div>
        }
      />
      <section className="planner-panel planner-calendar-panel">
        <div className="planner-filter-bar">
          <FilterSelect label="Campaign" value={filters.campaign} onChange={(campaign) => setFilters({...filters, campaign})} options={workspace.campaigns.map((item) => ({value: item.id, label: item.name}))} />
          <FilterSelect label="Level" value={filters.level} onChange={(level) => setFilters({...filters, level})} options={[1, 2, 3, 4, 5].map((level) => ({value: String(level), label: `Level ${level}`}))} />
          <FilterSelect label="Channel" value={filters.channel} onChange={(channel) => setFilters({...filters, channel})} options={values("channel").map((value) => ({value, label: value}))} />
          <FilterSelect label="Play type" value={filters.playType} onChange={(playType) => setFilters({...filters, playType})} options={values("playType").map((value) => ({value, label: value}))} />
          <FilterSelect label="Status" value={filters.status} onChange={(status) => setFilters({...filters, status})} options={PLAY_STATUSES.map((value) => ({value, label: titleCase(value)}))} />
          {Object.values(filters).some(Boolean) && <button className="planner-text-button" onClick={() => setFilters({campaign: "", level: "", channel: "", playType: "", status: ""})}>Clear filters</button>}
        </div>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin, classicThemePlugin]}
          initialView={view}
          initialDate={view === "dayGridWeek" ? nextPlanningWeekStart(new Date()) : new Date()}
          firstDay={0}
          headerToolbar={{left: "prev,next today", center: "title", right: ""}}
          height="auto"
          events={events}
          eventOrder={(left, right) =>
            Number(left.extendedProps.sortLevel) - Number(right.extendedProps.sortLevel) ||
            String(left.title).localeCompare(String(right.title))
          }
          eventOrderStrict
          eventContent={eventContent}
          eventClick={(info) => {
            const group = info.event.extendedProps.weeklyGroup;
            if (!group) return onOpenPlay(info.event.extendedProps.play);
            const campaign = workspace.campaigns.find((item) => item.id === group.campaignId);
            return campaign ? onOpenCampaign(campaign) : onOpenPlay(group.plays[0]);
          }}
          eventDrop={(info) => {
            const play = info.event.extendedProps.play;
            if (play) onMovePlay(play, info.event.startStr.slice(0, 10));
          }}
          dayMaxEventRows={3}
          eventMaxStack={4}
          moreLinkClick="popover"
          fixedWeekCount={false}
          editable={canEdit}
          eventStartEditable={canEdit}
          displayEventTime={false}
          nowIndicator
          navLinks
          navLinkDayClick={(date) => {
            changeView("dayGridWeek");
            calendarRef.current?.getApi?.().gotoDate(date);
          }}
          viewDidMount={(info) => {
            setView(info.view.type);
            localStorage.setItem(VIEW_STORAGE_KEY, info.view.type);
          }}
        />
      </section>
    </>
  );
}

function FilterSelect({label, value, onChange, options}) {
  return (
    <label className="planner-filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function CampaignsView({workspace, onNewCampaign, onOpenCampaign, canEdit}) {
  const sorted = [...workspace.campaigns].sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)));
  return (
    <>
      <PageHeading
        eyebrow="Campaigns"
        title="Every promotion in motion"
        copy="Campaigns keep their original playbook version, timeliness, and independent scheduled plays."
        actions={canEdit && <button className="planner-button is-primary" onClick={onNewCampaign}>＋ New campaign</button>}
      />
      <section className="planner-panel planner-table-panel">
        {sorted.length ? (
          <div className="planner-campaign-table">
            <div className="planner-table-header"><span>Campaign</span><span>Event</span><span>Playbook</span><span>Timing</span><span>Status</span><span /></div>
            {sorted.map((campaign) => {
              const conflicts = workspace.scheduledPlays.filter((play) => play.campaignId === campaign.id && play.status === "conflict").length;
              return (
                <button className="planner-campaign-row" key={campaign.id} onClick={() => onOpenCampaign(campaign)}>
                  <span className="planner-campaign-title"><LevelBadge level={campaign.level} /><span><strong>{campaign.name}</strong><small>{titleCase(campaign.campaignType)}</small></span></span>
                  <span><strong>{formatDate(campaign.eventDate)}</strong><small>{campaign.currentWeek > 0 && campaign.currentWeek <= campaign.durationWeeks ? `Week ${campaign.currentWeek} of ${campaign.durationWeeks}` : "Upcoming"}</small></span>
                  <span><strong>{workspace.playbooks.find((item) => item.id === campaign.playbookId)?.name || campaign.playbookId}</strong><small>Version {campaign.playbookVersion}</small></span>
                  <span><StatusBadge status={campaign.isOnTime ? "on-time" : "late"}>{campaign.isOnTime ? "On time" : `${campaign.daysLate}d late`}</StatusBadge></span>
                  <span><StatusBadge status={conflicts ? "conflict" : campaign.status}>{conflicts ? `${conflicts} conflict${conflicts === 1 ? "" : "s"}` : titleCase(campaign.status)}</StatusBadge></span>
                  <span>›</span>
                </button>
              );
            })}
          </div>
        ) : <EmptyState title="No campaigns yet" copy="Create the first campaign to generate an explainable schedule." action={canEdit && <button className="planner-button is-primary" onClick={onNewCampaign}>New campaign</button>} />}
      </section>
    </>
  );
}

function customPlaybookFromForm(form) {
  const slug = String(form.name || "custom-playbook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "custom-playbook";
  const durationWeeks = Math.min(12, Math.max(1, Number(form.durationWeeks || 1)));
  return {
    id: `custom-${slug}-${Date.now().toString(36)}`,
    level: Number(form.level || 1),
    name: String(form.name || "").trim(),
    campaignType: String(form.campaignType || "custom").trim(),
    durationWeeks,
    version: 0,
    active: true,
    description: String(form.description || "").trim(),
    weeks: Array.from({length: durationWeeks}, (_value, index) => ({
      weekNumber: index + 1,
      phase: "Awareness",
      label: `Plan Week ${index + 1}`,
      plays: [],
    })),
  };
}

function NewPlaybookDialog({onClose, onCreate}) {
  const [form, setForm] = useState({name: "", level: 1, campaignType: "custom", durationWeeks: 8, description: ""});
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  const valid = form.name.trim() && form.campaignType.trim() && Number(form.durationWeeks) >= 1;
  return (
    <Modal title="Add a custom playbook" eyebrow="Reusable template" onClose={onClose}>
      <div className="planner-form-grid">
        <Field label="Playbook name" wide><input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Level 1 Stewardship Campaign" /></Field>
        <Field label="Promotion level"><select value={form.level} onChange={(event) => update("level", Number(event.target.value))}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field>
        <Field label="Campaign type"><input value={form.campaignType} onChange={(event) => update("campaignType", event.target.value)} placeholder="stewardship" /></Field>
        <Field label="Number of weeks"><input type="number" min="1" max="12" value={form.durationWeeks} onChange={(event) => update("durationWeeks", Number(event.target.value))} /></Field>
        <Field label="Description" wide><textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="When and why this playbook should be used." /></Field>
      </div>
      <div className="planner-detail-note"><strong>Start with a clean rhythm</strong><p>Each week is created empty so you can define the exact plays, phase, and label after the playbook is added.</p></div>
      <div className="planner-modal-actions">
        <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="planner-button is-primary" disabled={!valid || saving} onClick={async () => { setSaving(true); try { await onCreate(customPlaybookFromForm(form)); } catch (_error) { setSaving(false); } }}>{saving ? "Adding…" : "Add playbook"}</button>
      </div>
    </Modal>
  );
}

function PlaybooksView({workspace, canEdit, onSave, onDelete}) {
  const [selectedId, setSelectedId] = useState(workspace.playbooks[0]?.id || "");
  const selected = workspace.playbooks.find((item) => item.id === selectedId) || workspace.playbooks[0];
  const [draft, setDraft] = useState(() => selected ? structuredClone(selected) : null);
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set(selected?.weeks?.[0] ? [selected.weeks[0].weekNumber] : []));
  const [newPlaybookOpen, setNewPlaybookOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (selected) {
      setDraft(structuredClone(selected));
      setExpandedWeeks(new Set(selected.weeks?.[0] ? [selected.weeks[0].weekNumber] : []));
      setConfirmDelete(false);
    }
  }, [selectedId, selected?.version]);
  if (!draft) return <EmptyState title="No playbooks" copy="Publish the starter configuration to begin." />;
  const isStarter = isStarterPlaybookId(draft.id);
  const campaignReferences = workspace.campaigns.filter((item) => item.playbookId === draft.id);
  const laneReferences = workspace.standingLanes.filter((item) => item.fallbackPlaybookId === draft.id);
  const referenceCount = campaignReferences.length + laneReferences.length;
  const toggleWeek = (weekNumber) => setExpandedWeeks((current) => {
    const next = new Set(current);
    if (next.has(weekNumber)) next.delete(weekNumber);
    else next.add(weekNumber);
    return next;
  });
  const updateWeekPlay = (weekIndex, playIndex, key, value) => {
    const next = structuredClone(draft);
    next.weeks[weekIndex].plays[playIndex][key] = value;
    setDraft(next);
  };
  const addPlay = (weekIndex) => {
    const next = structuredClone(draft);
    next.weeks[weekIndex].plays.push({
      id: `play-${Date.now()}`,
      playType: "New Play",
      dayOfWeek: 0,
      eligibleWeekdays: [0],
      channel: "Central",
      resourceId: "central-listing",
      requirement: "required",
      supportsSmuggle: false,
      lateBehavior: "SKIP",
      maxPlacementsPerCampaignPerWeek: 1,
    });
    setDraft(next);
  };
  const removePlay = (weekIndex, playIndex) => {
    const next = structuredClone(draft);
    next.weeks[weekIndex].plays.splice(playIndex, 1);
    setDraft(next);
  };
  return (
    <>
      <PageHeading
        eyebrow="Playbook Definitions"
        title="Editable promotion rhythms"
        copy="Saving creates a new immutable version. Existing campaign schedules stay exactly as generated."
        actions={canEdit && <div className="planner-heading-action-group"><button className="planner-button is-secondary" onClick={() => setNewPlaybookOpen(true)}>＋ New playbook</button><button className="planner-button is-primary" onClick={() => onSave(draft)}>Save as version {Number(draft.version || 0) + 1}</button></div>}
      />
      <section className="planner-playbook-layout">
        <aside className="planner-panel planner-playbook-list">
          {workspace.playbooks.map((playbook) => (
            <button key={playbook.id} className={playbook.id === draft.id ? "is-active" : ""} onClick={() => setSelectedId(playbook.id)}>
              <LevelBadge level={playbook.level} />
              <span><strong>{playbook.name}</strong><small>{playbook.durationWeeks} week{playbook.durationWeeks === 1 ? "" : "s"} · v{playbook.version} · {isStarterPlaybookId(playbook.id) ? "Default" : "Custom"}</small></span>
              <span>›</span>
            </button>
          ))}
        </aside>
        <div className="planner-playbook-editor">
          <section className="planner-panel planner-playbook-meta">
            <div className="planner-form-grid">
              <Field label="Playbook name"><input value={draft.name} disabled={!canEdit} onChange={(event) => setDraft({...draft, name: event.target.value})} /></Field>
              <Field label="Campaign type"><input value={draft.campaignType} disabled={!canEdit} onChange={(event) => setDraft({...draft, campaignType: event.target.value})} /></Field>
              <Field label="Promotion level"><select value={draft.level} disabled={!canEdit} onChange={(event) => setDraft({...draft, level: Number(event.target.value)})}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field>
              <Field label="Duration"><input type="number" min="1" max="12" value={draft.durationWeeks} disabled={!canEdit} onChange={(event) => setDraft({...draft, durationWeeks: Number(event.target.value)})} /></Field>
              <Field label="Description" wide><textarea value={draft.description || ""} disabled={!canEdit} onChange={(event) => setDraft({...draft, description: event.target.value})} /></Field>
            </div>
            <div className="planner-playbook-meta-footer">
              <div><StatusBadge status={isStarter ? "active" : "awareness"}>{isStarter ? "Protected default" : "Custom playbook"}</StatusBadge><small>{isStarter ? "This built-in playbook can be versioned, but not deleted." : "Custom playbooks can be deleted while they are not in use."}</small></div>
              {canEdit && !isStarter && !confirmDelete && <button className="planner-button is-danger is-quiet" onClick={() => setConfirmDelete(true)}>Delete playbook</button>}
            </div>
            {confirmDelete && (
              <div className="planner-delete-confirmation planner-playbook-delete-confirmation">
                <div><strong>{referenceCount ? "This playbook is still in use" : `Delete ${draft.name}?`}</strong><p>{referenceCount ? `${campaignReferences.length} campaign${campaignReferences.length === 1 ? "" : "s"} and ${laneReferences.length} standing lane${laneReferences.length === 1 ? "" : "s"} currently reference it. Update those records before deleting.` : "The active template will be removed. Its immutable version history remains preserved for existing records and audit history."}</p></div>
                <div><button className="planner-button is-secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep playbook</button><button className="planner-button is-danger" disabled={deleting || referenceCount > 0} onClick={async () => { setDeleting(true); try { await onDelete(draft); const nextPlaybook = workspace.playbooks.find((item) => item.id !== draft.id); setSelectedId(nextPlaybook?.id || ""); } catch (_error) { /* PlannerApp displays the save error. */ } finally { setDeleting(false); } }}>{deleting ? "Deleting…" : "Delete permanently"}</button></div>
              </div>
            )}
          </section>
          {draft.weeks.map((week, weekIndex) => {
            const expanded = expandedWeeks.has(week.weekNumber);
            const bodyId = `playbook-${draft.id}-week-${week.weekNumber}`;
            return (
              <section className={`planner-panel planner-week-editor ${expanded ? "is-expanded" : "is-collapsed"}`} key={`${draft.id}-${week.weekNumber}`}>
                <button className="planner-week-toggle" aria-expanded={expanded} aria-controls={bodyId} onClick={() => toggleWeek(week.weekNumber)}>
                  <span className="planner-week-toggle-title"><b>Week {week.weekNumber}</b><StatusBadge status={String(week.phase).toLowerCase()}>{week.phase}</StatusBadge></span>
                  <span className="planner-week-toggle-summary"><strong>{week.label || "Untitled week"}</strong><small>{week.plays.length} play{week.plays.length === 1 ? "" : "s"}</small></span>
                  <span className="planner-week-chevron" aria-hidden="true">⌄</span>
                </button>
                {expanded && (
                  <div className="planner-week-body" id={bodyId}>
                    <div className="planner-form-grid planner-week-fields">
                      <Field label={`Week ${week.weekNumber} label`}><input value={week.label || ""} disabled={!canEdit} onChange={(event) => { const next = structuredClone(draft); next.weeks[weekIndex].label = event.target.value; setDraft(next); }} /></Field>
                      <Field label="Phase"><input value={week.phase || ""} disabled={!canEdit} onChange={(event) => { const next = structuredClone(draft); next.weeks[weekIndex].phase = event.target.value; setDraft(next); }} /></Field>
                    </div>
                    <div className="planner-week-play-list">
                      {week.plays.map((item, playIndex) => (
                        <div className="planner-play-editor-row" key={item.id}>
                          <select aria-label="Day" value={item.dayOfWeek} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "dayOfWeek", Number(event.target.value))}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select>
                          <input aria-label="Play type" value={item.playType} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "playType", event.target.value)} />
                          <input aria-label="Channel" value={item.channel} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "channel", event.target.value)} />
                          <select aria-label="Requirement" value={item.requirement} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "requirement", event.target.value)}><option value="required">Required</option><option value="optional">Optional</option><option value="as-available">As available</option></select>
                          <select aria-label="Late behavior" value={item.lateBehavior} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "lateBehavior", event.target.value)}><option value="SKIP">Skip</option><option value="NEXT_AVAILABLE_SLOT">Next slot</option><option value="NEXT_OCCURRENCE">Next occurrence</option><option value="MANUAL_REVIEW">Manual review</option></select>
                          <label className="planner-check"><input type="checkbox" checked={item.supportsSmuggle === true} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "supportsSmuggle", event.target.checked)} /><span>Smuggle</span></label>
                          {canEdit && <button className="planner-remove-button" onClick={() => removePlay(weekIndex, playIndex)} aria-label={`Remove ${item.playType}`}>×</button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && <button className="planner-text-button" onClick={() => addPlay(weekIndex)}>＋ Add play to Week {week.weekNumber}</button>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
      {newPlaybookOpen && <NewPlaybookDialog onClose={() => setNewPlaybookOpen(false)} onCreate={async (playbook) => { const saved = await onSave(playbook); setSelectedId(saved.id); setNewPlaybookOpen(false); }} />}
    </>
  );
}

function RulesView({workspace, canEdit, onSaveRule, onSaveLane}) {
  const [editingRule, setEditingRule] = useState(null);
  const [editingLane, setEditingLane] = useState(null);
  return (
    <>
      <PageHeading eyebrow="Scheduling configuration" title="Capacity, lanes, and allocation" copy="These rules drive recommendations and conflicts; they are not hidden in scheduling code." />
      <div className="planner-rules-stack">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="planner-kicker">Promotional inventory</span><h2>Capacity rules</h2></div></div>
          <div className="planner-rule-grid">
            {workspace.capacityRules.map((rule) => (
              <article className="planner-rule-card" key={rule.id}>
                <div><span className="planner-rule-icon">{rule.capacity}</span><StatusBadge status={rule.active ? "active" : "inactive"} /></div>
                <h3>{rule.name}</h3><p>{rule.channel} · per {rule.capacityPeriod}</p>
                <dl><div><dt>Typical</dt><dd>{rule.typicalCapacity ?? rule.capacity}</dd></div><div><dt>Maximum</dt><dd>{rule.capacity}</dd></div><div><dt>Days</dt><dd>{(rule.allowedWeekdays || []).map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(" / ") || "Any"}</dd></div><div><dt>Levels</dt><dd>{(rule.eligibleLevels || []).map((level) => `L${level}`).join(", ")}</dd></div><div><dt>Allocation</dt><dd>{titleCase(rule.allocationStrategy)}</dd></div></dl>
                {canEdit && <button className="planner-button is-secondary" onClick={() => setEditingRule(structuredClone(rule))}>Edit rule</button>}
              </article>
            ))}
          </div>
        </section>
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="planner-kicker">Recurring requirements</span><h2>Standing lanes</h2></div></div>
          {workspace.standingLanes.map((lane) => (
            <article className="planner-lane-card" key={lane.id}>
              <div className="planner-lane-flow"><span>Level {lane.level} event</span><i>→</i><span>Ongoing promotion</span><i>→</i><span>Approved Smuggle</span></div>
              <div><h3>{lane.name}</h3><p>{titleCase(lane.cadence)} coverage · fallback: {workspace.playbooks.find((item) => item.id === lane.fallbackPlaybookId)?.name || lane.fallbackPlaybookId}</p></div>
              {canEdit && <button className="planner-button is-secondary" onClick={() => setEditingLane(structuredClone(lane))}>Edit lane</button>}
            </article>
          ))}
        </section>
      </div>
      {editingRule && <RuleDialog rule={editingRule} onClose={() => setEditingRule(null)} onSave={async (rule) => { await onSaveRule(rule); setEditingRule(null); }} />}
      {editingLane && <LaneDialog lane={editingLane} playbooks={workspace.playbooks} onClose={() => setEditingLane(null)} onSave={async (lane) => { await onSaveLane(lane); setEditingLane(null); }} />}
    </>
  );
}

function Field({label, children, wide = false, help = ""}) {
  return <label className={`planner-field ${wide ? "is-wide" : ""}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function Modal({title, eyebrow, onClose, children, size = "normal"}) {
  return (
    <div className="planner-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`planner-modal is-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><div><span className="planner-kicker">{eyebrow}</span><h2>{title}</h2></div><button onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </section>
    </div>
  );
}

function NewCampaignDialog({workspace, onClose, onGenerate}) {
  const campaignPlaybooks = workspace.playbooks.filter((item) =>
    item.active !== false &&
    (!isStarterPlaybookId(item.id) || !String(item.campaignType).startsWith("ongoing")),
  );
  const defaultPlaybook = campaignPlaybooks[0] || workspace.playbooks[0];
  const [form, setForm] = useState({
    name: "",
    eventDate: addDays(dateKey(new Date()), 28),
    registrationDeadline: "",
    submittedAt: businessNowInputValue(),
    playbookId: defaultPlaybook?.id || "",
    sourceEventId: "",
    notes: "",
  });
  const playbook = workspace.playbooks.find((item) => item.id === form.playbookId) || defaultPlaybook;
  const preview = useMemo(() => {
    if (!form.name.trim() || !form.eventDate || !playbook) return null;
    const id = `campaign-preview-${Date.now()}`;
    const generated = generateCampaignSchedule({
      campaign: {
        ...form,
        id,
        submittedAt: businessLocalToIso(form.submittedAt),
        level: playbook.level,
        campaignType: playbook.campaignType,
        status: "active",
      },
      playbook,
      generatedAt: new Date(),
    });
    const combinedCampaigns = [...workspace.campaigns, generated.campaign];
    const combinedPlays = [...workspace.scheduledPlays, ...generated.plays];
    const level4 = allocateLevel4SocialSlots({plays: combinedPlays, campaigns: combinedCampaigns});
    const capacity = evaluateCapacity({
      plays: level4.plays,
      capacityRules: workspace.capacityRules.filter((rule) => rule.id !== "level-4-social"),
      campaigns: combinedCampaigns,
    });
    const ownPlays = capacity.plays.filter((item) => item.campaignId === id);
    return {...generated, plays: ownPlays, summary: scheduleSummary(ownPlays), conflicts: [...level4.conflicts, ...capacity.conflicts].filter((item) => item.overflowPlayIds.some((playId) => ownPlays.some((play) => play.id === playId)))};
  }, [form, playbook, workspace]);
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  return (
    <Modal title="Build a new campaign" eyebrow="Schedule preview" onClose={onClose} size="wide">
      <div className="planner-campaign-builder">
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="planner-form-grid">
            <Field label="Campaign / Event name" wide><input autoFocus required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Women's Breakfast" /></Field>
            <Field label="Event date"><input type="date" required value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} /></Field>
            <Field label="Registration deadline"><input type="date" value={form.registrationDeadline} max={form.eventDate} onChange={(event) => update("registrationDeadline", event.target.value)} /></Field>
            <Field label="Original request received"><input type="datetime-local" required value={form.submittedAt} onChange={(event) => update("submittedAt", event.target.value)} /></Field>
            <Field label="Promotion playbook"><select value={form.playbookId} onChange={(event) => update("playbookId", event.target.value)}>{campaignPlaybooks.map((item) => <option key={item.id} value={item.id}>Level {item.level} · {item.name}</option>)}</select></Field>
            <Field label="Source Event ID"><input value={form.sourceEventId} onChange={(event) => update("sourceEventId", event.target.value)} placeholder="Optional Central / PCO event ID" /></Field>
            <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Context Creative should keep with this campaign." /></Field>
          </div>
        </form>
        <section className="planner-schedule-preview">
          {!preview ? <EmptyState title="Ready for the details" copy="Name the campaign and choose an event date to preview the rules-based schedule." /> : (
            <>
              <div className={`planner-timeliness-card ${preview.campaign.isOnTime ? "is-on-time" : "is-late"}`}>
                <div><span className="planner-kicker">{preview.campaign.durationWeeks}-week campaign</span><h3>{preview.campaign.isOnTime ? "On-time submission" : "Late submission"}</h3></div>
                <dl><div><dt>Recommended start</dt><dd>{formatDate(preview.campaign.recommendedStartDate)}</dd></div><div><dt>Request received</dt><dd>{formatDate(preview.campaign.submittedDate)}</dd></div><div><dt>Current week</dt><dd>{preview.campaign.currentWeek > 0 && preview.campaign.currentWeek <= preview.campaign.durationWeeks ? `Week ${preview.campaign.currentWeek}` : preview.campaign.currentWeek === 0 ? "Before campaign" : "Campaign passed"}</dd></div></dl>
                {!preview.campaign.isOnTime && <p>{preview.campaign.daysLate} days late. Passed plays are recorded, never compressed into the current week.</p>}
              </div>
              <div className="planner-preview-metrics">
                <span><strong>{preview.summary.missed}</strong> missed</span><span><strong>{preview.summary.rescheduled}</strong> rescheduled</span><span><strong>{preview.summary.remaining}</strong> remaining</span><span><strong>{preview.summary.conflicts}</strong> conflicts</span>
              </div>
              <div className="planner-preview-list">
                {preview.plays.map((play) => <PlayRow key={play.id} play={play} onClick={() => {}} />)}
              </div>
              <div className="planner-modal-actions">
                <button className="planner-button is-secondary" onClick={onClose}>Cancel</button>
                <button className="planner-button is-primary" onClick={() => onGenerate(preview.campaign, preview.plays)}>Generate {preview.summary.total} plays</button>
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}

function PlayDialog({play, campaign, canEdit, onClose, onSave}) {
  const [draft, setDraft] = useState({...play});
  return (
    <Modal title={play.playType} eyebrow="Scheduled Play" onClose={onClose}>
      <div className="planner-detail-hero"><LevelBadge level={play.campaignLevel} /><div><h3>{play.campaignName}</h3><p>{play.channel} · Week {play.weekNumber} · {play.phase}</p></div><StatusBadge status={draft.status} /></div>
      <dl className="planner-detail-list"><div><dt>Original date</dt><dd>{formatDate(play.originalScheduledDate)}</dd></div><div><dt>Scheduled date</dt><dd>{formatDate(draft.scheduledDate)}</dd></div><div><dt>Playbook</dt><dd>{play.playbookId} · v{play.playbookVersion}</dd></div><div><dt>Requirement</dt><dd>{titleCase(play.requirement)}</dd></div><div><dt>Late behavior</dt><dd>{titleCase(play.lateBehavior)}</dd></div><div><dt>Source</dt><dd>{titleCase(play.source)}</dd></div></dl>
      {play.lateReason && <div className="planner-detail-note"><strong>Late handling</strong><p>{play.lateReason}</p></div>}
      {play.conflictReason && <div className="planner-detail-note is-alert"><strong>Conflict</strong><p>{play.conflictReason}</p></div>}
      {play.smuggle && <div className="planner-detail-note is-smuggle"><strong>Smuggle promotion</strong><p>This Level 2 play intentionally includes {play.smuggle.beneficiaryName}.</p></div>}
      {canEdit && (
        <div className="planner-form-grid planner-play-adjustment">
          <Field label="Move scheduled play"><input type="date" value={draft.scheduledDate} onChange={(event) => setDraft({...draft, scheduledDate: event.target.value, status: "rescheduled", manuallyAdjusted: true})} /></Field>
          <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({...draft, status: event.target.value})}>{PLAY_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></Field>
        </div>
      )}
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Close</button>{canEdit && <button className="planner-button is-primary" onClick={() => onSave(draft)}>Save play</button>}</div>
    </Modal>
  );
}

function CampaignDialog({campaign, workspace, canEdit, onClose, onOpenPlay, onDelete}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const plays = workspace.scheduledPlays.filter((play) => play.campaignId === campaign.id).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  const summary = scheduleSummary(plays);
  return (
    <Modal title={campaign.name} eyebrow={`Level ${campaign.level} campaign`} onClose={onClose} size="wide">
      <div className="planner-campaign-detail-summary">
        <div><span>Event date</span><strong>{formatDate(campaign.eventDate)}</strong></div><div><span>Playbook</span><strong>{workspace.playbooks.find((item) => item.id === campaign.playbookId)?.name || campaign.playbookId} · v{campaign.playbookVersion}</strong></div><div><span>Recommended start</span><strong>{formatDate(campaign.recommendedStartDate)}</strong></div><div><span>Submission</span><StatusBadge status={campaign.isOnTime ? "on-time" : "late"}>{campaign.isOnTime ? "On time" : `${campaign.daysLate} days late`}</StatusBadge></div>
      </div>
      <div className="planner-preview-metrics"><span><strong>{summary.total}</strong> plays</span><span><strong>{summary.missed}</strong> missed</span><span><strong>{summary.rescheduled}</strong> moved</span><span><strong>{summary.conflicts}</strong> conflicts</span></div>
      {campaign.notes && <div className="planner-detail-note"><strong>Notes</strong><p>{campaign.notes}</p></div>}
      <div className="planner-campaign-play-list">{plays.map((play) => <PlayRow key={play.id} play={play} onClick={() => onOpenPlay(play)} />)}</div>
      {confirmDelete && (
        <div className="planner-delete-confirmation" role="alert">
          <div><strong>Delete this campaign and all {plays.length} scheduled play{plays.length === 1 ? "" : "s"}?</strong><p>This cannot be undone and removes the campaign from every Planner view.</p></div>
          <div><button className="planner-button is-secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep campaign</button><button className="planner-button is-danger" disabled={deleting} onClick={async () => { setDeleting(true); try { await onDelete(campaign); } catch (_error) { /* PlannerApp displays the save error. */ } finally { setDeleting(false); } }}>{deleting ? "Deleting…" : "Delete permanently"}</button></div>
        </div>
      )}
      <div className="planner-modal-actions">
        {canEdit && !confirmDelete && <button className="planner-button is-danger is-quiet" onClick={() => setConfirmDelete(true)}>Delete campaign</button>}
        <button className="planner-button is-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function RuleDialog({rule, onClose, onSave}) {
  const [draft, setDraft] = useState({...rule, typicalCapacity: rule.typicalCapacity ?? rule.capacity});
  const thresholdsValid = Number(draft.typicalCapacity) >= 1 && Number(draft.typicalCapacity) <= Number(draft.capacity);
  return (
    <Modal title={rule.name} eyebrow="Capacity rule" onClose={onClose}>
      <div className="planner-form-grid">
        <Field label="Resource name" wide><input value={draft.name} onChange={(event) => setDraft({...draft, name: event.target.value})} /></Field>
        <Field label="Hard maximum"><input type="number" min="1" max="20" value={draft.capacity} onChange={(event) => {
          const capacity = Number(event.target.value);
          setDraft({...draft, capacity, typicalCapacity: Math.min(Number(draft.typicalCapacity || capacity), capacity)});
        }} /></Field>
        <Field label="Typical target" help="Creates an early planning warning without blocking an allowed slot."><input type="number" min="1" max={draft.capacity} value={draft.typicalCapacity} onChange={(event) => setDraft({...draft, typicalCapacity: Number(event.target.value)})} /></Field>
        <Field label="Period"><select value={draft.capacityPeriod} onChange={(event) => setDraft({...draft, capacityPeriod: event.target.value})}><option value="day">Day</option><option value="week">Week</option><option value="sunday">Sunday</option></select></Field>
        <Field label="Per-campaign max"><input type="number" min="1" max="10" value={draft.perCampaignMaximum} onChange={(event) => setDraft({...draft, perCampaignMaximum: Number(event.target.value)})} /></Field>
        <Field label="Allocation"><select value={draft.allocationStrategy} onChange={(event) => setDraft({...draft, allocationStrategy: event.target.value})}><option value="creative-decision">Creative decision</option><option value="priority-recommendation">Priority recommendation</option><option value="level-4-constrained-slot">Level 4 constrained slots</option></select></Field>
      </div>
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Cancel</button><button className="planner-button is-primary" disabled={!thresholdsValid} onClick={() => onSave(draft)}>Save rule</button></div>
    </Modal>
  );
}

function LaneDialog({lane, playbooks, onClose, onSave}) {
  const [draft, setDraft] = useState(lane);
  return (
    <Modal title={lane.name} eyebrow="Standing lane" onClose={onClose}>
      <div className="planner-form-grid">
        <Field label="Lane name" wide><input value={draft.name} onChange={(event) => setDraft({...draft, name: event.target.value})} /></Field>
        <Field label="Fallback playbook" wide><select value={draft.fallbackPlaybookId} onChange={(event) => setDraft({...draft, fallbackPlaybookId: event.target.value})}>{playbooks.filter((item) => Number(item.level) === Number(draft.level)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Eligible Smuggle levels" wide help="Comma-separated promotion levels"><input value={(draft.eligibleSmuggleLevels || []).join(", ")} onChange={(event) => setDraft({...draft, eligibleSmuggleLevels: event.target.value.split(",").map((item) => Number(item.trim())).filter((item) => item >= 1 && item <= 5)})} /></Field>
      </div>
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Cancel</button><button className="planner-button is-primary" onClick={() => onSave(draft)}>Save lane</button></div>
    </Modal>
  );
}

function PlannerApp({authState}) {
  const [workspace, setWorkspace] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const store = useMemo(() => createPlannerStore({
    firestore: authState.firestore,
    user: authState.user,
    preview: authState.preview,
  }), [authState.firestore, authState.user?.uid, authState.preview]);
  const canEdit = EDIT_PERMISSIONS.has(authState.permission);

  const load = async () => {
    setLoading(true); setError("");
    try { setWorkspace(await store.loadWorkspace()); }
    catch (loadError) { setError(loadError.message || "Planner data could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [store]);

  const perform = async (action, success) => {
    setError(""); setMessage("");
    try {
      const result = await action();
      setMessage(success);
      window.setTimeout(() => setMessage(""), 4000);
      return result;
    } catch (actionError) {
      setError(actionError.message || "The Planner change could not be saved.");
      throw actionError;
    }
  };

  if (loading || !workspace) {
    return <main className="planner-loading"><Brand /><span className="planner-loader" /><p>{error || "Loading playbooks, campaigns, and scheduled plays."}</p></main>;
  }

  const updatePlay = async (play, success = "Scheduled play updated.") => {
    const saved = await perform(() => store.saveScheduledPlay(play), success);
    setWorkspace((current) => ({...current, scheduledPlays: current.scheduledPlays.map((item) => item.id === saved.id ? saved : item)}));
    setSelectedPlay(null);
    return saved;
  };

  const deleteCampaign = async (campaign) => {
    const result = await perform(() => store.deleteCampaign(campaign.id), `${campaign.name} and its scheduled plays were deleted.`);
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.filter((item) => item.id !== campaign.id),
      scheduledPlays: current.scheduledPlays.filter((item) => item.campaignId !== campaign.id),
    }));
    setSelectedCampaign(null);
    return result;
  };

  const useSmuggle = async (opportunity) => {
    const host = workspace.scheduledPlays.find((play) => play.id === opportunity.hostScheduledPlayId);
    if (!host) return;
    await updatePlay(applySmuggle(host, opportunity), `${opportunity.beneficiaryName} is now intentionally included as a Smuggle promotion.`);
  };

  let content = null;
  if (activeView === "calendar") content = <CalendarView workspace={workspace} canEdit={canEdit} onOpenCampaign={setSelectedCampaign} onOpenPlay={setSelectedPlay} onMovePlay={(play, scheduledDate) => updatePlay({...play, scheduledDate, status: "rescheduled", manuallyAdjusted: true}, "Scheduled play moved.")} />;
  else if (activeView === "campaigns") content = <CampaignsView workspace={workspace} canEdit={canEdit} onNewCampaign={() => setNewCampaignOpen(true)} onOpenCampaign={setSelectedCampaign} />;
  else if (activeView === "playbooks") content = <PlaybooksView workspace={workspace} canEdit={canEdit} onSave={async (playbook) => {
    const isNew = !workspace.playbooks.some((item) => item.id === playbook.id);
    const saved = await perform(() => store.savePlaybook(playbook), isNew ? `Added ${playbook.name}.` : `Saved ${playbook.name} as a new version.`);
    setWorkspace((current) => {
      const exists = current.playbooks.some((item) => item.id === saved.id);
      return {...current, playbooks: exists ? current.playbooks.map((item) => item.id === saved.id ? saved : item) : [...current.playbooks, saved]};
    });
    return saved;
  }} onDelete={async (playbook) => {
    const result = await perform(() => store.deletePlaybook(playbook.id), `${playbook.name} was deleted. Its version history was preserved.`);
    setWorkspace((current) => ({...current, playbooks: current.playbooks.filter((item) => item.id !== playbook.id)}));
    return result;
  }} />;
  else if (activeView === "rules") content = <RulesView workspace={workspace} canEdit={canEdit} onSaveRule={async (rule) => {
    const saved = await perform(() => store.saveCapacityRule(rule), `${rule.name} capacity rule saved.`);
    setWorkspace((current) => ({...current, capacityRules: current.capacityRules.map((item) => item.id === saved.id ? saved : item)}));
  }} onSaveLane={async (lane) => {
    const saved = await perform(() => store.saveStandingLane(lane), `${lane.name} standing lane saved.`);
    setWorkspace((current) => ({...current, standingLanes: current.standingLanes.map((item) => item.id === saved.id ? saved : item)}));
  }} />;
  else content = <Overview workspace={workspace} canEdit={canEdit} onNewCampaign={() => setNewCampaignOpen(true)} onOpenPlay={setSelectedPlay} onSavePlay={updatePlay} onUseSmuggle={useSmuggle} />;

  return (
    <div className="planner-app">
      <AppHeader authState={authState} activeView={activeView} onMenu={() => setMobileNav(true)} />
      <Sidebar activeView={activeView} setActiveView={setActiveView} open={mobileNav} close={() => setMobileNav(false)} />
      <main className="planner-main">
        {!workspace.isSeeded && (
          <div className="planner-seed-banner">
            <div><strong>Starter playbooks are ready to publish</strong><p>You are viewing the attached Level 1–5 playbooks as local starter data. Publish once to make Central the operational source of truth.</p></div>
            {canEdit && <button className="planner-button is-primary" onClick={async () => {
              const next = await perform(() => store.publishStarterConfiguration(), "Starter playbooks, capacity rules, and standing lane published.");
              setWorkspace(next);
            }}>Publish starter configuration</button>}
          </div>
        )}
        {authState.preview && <div className="planner-preview-banner">Local preview · changes stay in this browser session</div>}
        {error && <div className="planner-toast is-error" role="alert"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
        {message && <div className="planner-toast is-success" role="status"><span>{message}</span><button onClick={() => setMessage("")}>×</button></div>}
        {content}
      </main>
      {newCampaignOpen && <NewCampaignDialog workspace={workspace} onClose={() => setNewCampaignOpen(false)} onGenerate={async (campaign, plays) => {
        const result = await perform(() => store.saveCampaignSchedule(campaign, plays), `${campaign.name} generated with ${plays.length} independent scheduled plays.`);
        setWorkspace((current) => ({...current, campaigns: [result.campaign, ...current.campaigns], scheduledPlays: [...current.scheduledPlays, ...result.plays]}));
        setNewCampaignOpen(false); setActiveView("campaigns");
      }} />}
      {selectedPlay && <PlayDialog play={selectedPlay} campaign={workspace.campaigns.find((item) => item.id === selectedPlay.campaignId)} canEdit={canEdit} onClose={() => setSelectedPlay(null)} onSave={updatePlay} />}
      {selectedCampaign && <CampaignDialog campaign={selectedCampaign} workspace={workspace} canEdit={canEdit} onClose={() => setSelectedCampaign(null)} onOpenPlay={(play) => { setSelectedCampaign(null); setSelectedPlay(play); }} onDelete={deleteCampaign} />}
    </div>
  );
}

function Root() {
  const authState = usePlannerAuth();
  if (authState.status !== "ready") return <AccessScreen authState={authState} />;
  return <PlannerApp authState={authState} />;
}

const root = document.getElementById("planner-root");
if (root) createRoot(root).render(<Root />);
