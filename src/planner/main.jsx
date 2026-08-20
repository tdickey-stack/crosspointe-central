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
  addDays,
  allocateLevel4SocialSlots,
  applySmuggle,
  buildCampaignRegeneration,
  buildSmuggleRelationships,
  businessLocalToIso,
  businessNowInputValue,
  cancelSmuggle,
  dateKey,
  evaluateCapacity,
  generateCampaignSchedule,
  groupCalendarCampaignDays,
  nextPlanningWeekStart,
  recommendSmuggleOpportunities,
  recurringContentDates,
  reportPresetDateRange,
  scheduleSummary,
  skipPromotion,
  utilizationForWeek,
  utcDateFromKey,
  weeklyInventoryPlays,
} from "./domain.js";
import {
  buildPromotionBrief,
  downloadPromotionBriefPdf,
  formatBriefDate,
  sendPromotionBriefEmail,
} from "./briefs.js";
import {parseBriefMarkdown} from "./markdown.js";
import {createPlannerStore} from "./persistence.js";
import {isStarterPlaybookId} from "./seed-data.js";
import "./planner.css";

const EDIT_PERMISSIONS = new Set(["propose", "edit", "approve", "admin"]);
const VIEW_STORAGE_KEY = "central-promotion-planner-calendar-view";
const NAV_ITEMS = [
  {id: "overview", label: "Overview", icon: "◫"},
  {id: "requests", label: "Requests", icon: "◇"},
  {id: "calendar", label: "Calendar", icon: "▦"},
  {id: "campaigns", label: "Campaigns", icon: "◆"},
  {id: "content", label: "Content", icon: "●"},
  {id: "reports", label: "Announcement Brief", icon: "▧"},
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

const STANDALONE_CONTENT_TYPE = "standalone-content";
const CONTENT_TYPES = [
  {value: "Social Post", channel: "Social Media"},
  {value: "YouTube Video", channel: "YouTube"},
  {value: "Short / Reel", channel: "Social Media"},
  {value: "Podcast", channel: "Podcast"},
  {value: "Other Content", channel: "Other"},
];
const CONTENT_RECURRENCE_OPTIONS = [
  {value: "none", label: "Does not repeat"},
  {value: "weekly", label: "Weekly"},
  {value: "biweekly", label: "Every 2 weeks"},
  {value: "monthly", label: "Monthly"},
];
const REPORT_DATE_PRESETS = [
  {value: "upcoming", label: "Upcoming"},
  {value: "next-two-weeks", label: "Next 2 Weeks"},
  {value: "month-at-a-glance", label: "Month at a Glance"},
  {value: "custom", label: "Custom"},
];

function isStandaloneContent(item) {
  return item?.campaignType === STANDALONE_CONTENT_TYPE;
}

function visiblePromotions(plays) {
  return (plays || []).filter((play) => !["missed", "skipped"].includes(play.status));
}

function needsPromotionReview(play) {
  return ["conflict", "needs-decision"].includes(play.status) ||
    (play.conflictState && play.conflictState !== "none");
}

function phaseBrief(phase) {
  const normalized = String(phase || "").trim().toLowerCase();
  if (normalized === "awareness") return "Build recognition and make the event easy to discover.";
  if (normalized === "interest") return "Help people understand why this matters and move them toward a response.";
  if (["urgency", "sprint"].includes(normalized)) return "Create a clear final invitation before the event or registration deadline.";
  return "Keep the campaign moving with the promotion planned for this point in the timeline.";
}

function campaignTimingLabel(scheduledDate, eventDate) {
  if (!scheduledDate || !eventDate) return "Date context unavailable";
  const days = Math.round((utcDateFromKey(eventDate).getTime() - utcDateFromKey(scheduledDate).getTime()) / 86400000);
  if (days === 0) return "Event day";
  if (days === 1) return "1 day before the event";
  if (days > 1) return `${days} days before the event`;
  if (days === -1) return "1 day after the event";
  return `${Math.abs(days)} days after the event`;
}

function groupSmuggleOpportunities(opportunities) {
  const grouped = new Map();
  (opportunities || []).forEach((opportunity) => {
    const key = opportunity.beneficiaryScheduledPlayId || `${opportunity.beneficiaryCampaignId}:${opportunity.scheduledDate}:${opportunity.beneficiaryPlayType}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        beneficiaryCampaignId: opportunity.beneficiaryCampaignId,
        beneficiaryScheduledPlayId: opportunity.beneficiaryScheduledPlayId,
        beneficiaryName: opportunity.beneficiaryName,
        beneficiaryLevel: opportunity.beneficiaryLevel,
        beneficiaryPlayType: opportunity.beneficiaryPlayType,
        beneficiaryChannel: opportunity.beneficiaryChannel,
        scheduledDate: opportunity.scheduledDate,
        options: [],
      });
    }
    grouped.get(key).options.push(opportunity);
  });
  return [...grouped.values()].map((group) => ({
    ...group,
    options: group.options.sort((left, right) =>
      Number(left.hostCampaignLevel) - Number(right.hostCampaignLevel) ||
      String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
      String(left.hostCampaignName).localeCompare(String(right.hostCampaignName)),
    ),
  }));
}

function campaignDeadline(campaign) {
  if (!campaign) return "";
  return campaign.registrationDeadline && campaign.registrationDeadline < campaign.eventDate
    ? campaign.registrationDeadline
    : campaign.eventDate;
}

function PromotionKindBadge({item}) {
  return isStandaloneContent(item)
    ? <span className="planner-content-badge">Content</span>
    : <LevelBadge level={item.campaignLevel ?? item.level} />;
}

function contentSeriesDetails(plays) {
  const sorted = [...(plays || [])].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  const source = String(sorted[0]?.source || "");
  const cadence = source.includes(":") ? source.split(":").at(-1) : "none";
  const cadenceLabel = CONTENT_RECURRENCE_OPTIONS.find((item) => item.value === cadence)?.label || "Recurring";
  return {
    plays: sorted,
    firstDate: sorted[0]?.scheduledDate || "",
    lastDate: sorted.at(-1)?.scheduledDate || "",
    cadence,
    label: sorted.length > 1 ? `${cadenceLabel} · ${sorted.length} occurrences` : "One time",
  };
}

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
        <div className="planner-sidebar-footer">
          <span className="planner-sidebar-label">Central tools</span>
          <nav className="planner-tool-links" aria-label="Central tools">
            <a href="/admin" className="planner-tool-link">
              <span aria-hidden="true">⚙</span>Admin
            </a>
            <a href="/studio" className="planner-tool-link">
              <span aria-hidden="true">✦</span>Studio
            </a>
          </nav>
          <a href="/" className="planner-central-link">← Back to Central</a>
        </div>
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

function Overview({workspace, onNewCampaign, onOpenPlay, onSavePlay, onUseSmuggle, onSkipSmuggle, canEdit}) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedSmuggle, setSelectedSmuggle] = useState(null);
  const weekStart = nextPlanningWeekStart(new Date());
  const weekEnd = addDays(weekStart, 6);
  const smuggleRelationships = buildSmuggleRelationships({
    plays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  });
  const smuggledPlayIds = new Set(smuggleRelationships.map((relationship) => relationship.beneficiaryPlayId).filter(Boolean));
  const visibleWorkspacePlays = workspace.scheduledPlays.filter((play) => !smuggledPlayIds.has(play.id));
  const weekPlays = visiblePromotions(visibleWorkspacePlays).filter((play) =>
    play.scheduledDate >= weekStart && play.scheduledDate <= weekEnd,
  );
  const utilization = utilizationForWeek({
    weekStart,
    plays: visibleWorkspacePlays,
    capacityRules: workspace.capacityRules,
  });
  const opportunityGroups = groupSmuggleOpportunities(recommendSmuggleOpportunities({
    hostPlays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  })).slice(0, 4);
  const smuggleByHostPlay = new Map(smuggleRelationships.map((relationship) => [relationship.hostPlayId, relationship]));
  const attention = weekPlays.filter(needsPromotionReview);

  return (
    <>
      <PageHeading
        eyebrow={`Next planning week · ${formatDate(weekStart, {year: false})}–${formatDate(weekEnd)}`}
        title="Creative operations at a glance"
        copy="Capacity, coverage, and decisions across campaigns and standalone content."
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
      </section>
      <section className="planner-dashboard-grid">
        <article className="planner-panel planner-week-agenda">
          <div className="planner-panel-heading">
            <div><span className="planner-kicker">Schedule</span><h2>Next planning week</h2></div>
            <StatusBadge>{weekPlays.length} promotions</StatusBadge>
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
                    <div>{daily.map((play) => <PlayRow key={play.id} play={play} smuggleRelationship={smuggleByHostPlay.get(play.id)} onClick={() => onOpenPlay(play)} />)}</div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="A clear week" copy="No promotions are planned for this week." />}
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
                <span><strong>{play.campaignName}</strong><small>{play.playType} · {play.status === "conflict" ? "Conflict" : "Needs review"}</small></span>
                <span>›</span>
              </button>
            )) : <p className="planner-quiet-copy">No promotion conflicts need a decision.</p>}
          </article>
          <article className="planner-panel">
            <div className="planner-panel-heading">
              <div><span className="planner-kicker">Smuggle</span><h2>Opportunities</h2></div>
              <StatusBadge status="opportunity">{opportunityGroups.length}</StatusBadge>
            </div>
            {opportunityGroups.length ? opportunityGroups.map((group) => {
              const campaignCount = new Set(group.options.map((option) => option.hostCampaignId)).size;
              return (
              <div className="planner-smuggle-row" key={group.id}>
                <div><LevelBadge level={group.beneficiaryLevel} /><span><strong>{group.beneficiaryName}</strong><small>{group.beneficiaryPlayType} · {formatDate(group.scheduledDate)}</small></span></div>
                <p>{campaignCount} same-day Level 1–3 host event{campaignCount === 1 ? " is" : "s are"} available for this announcement.</p>
                {canEdit && <button className="planner-text-button" onClick={() => setSelectedSmuggle(group)}>Choose the host event →</button>}
              </div>
              );
            }) : <p className="planner-quiet-copy">No open Level 1–3 promotions can currently host a Smuggle.</p>}
          </article>
        </div>
      </section>
      {selectedMetric && (
        <WeeklyInventoryModal
          metric={selectedMetric}
          weekStart={weekStart}
          weekEnd={weekEnd}
          plays={visibleWorkspacePlays}
          campaigns={workspace.campaigns}
          canEdit={canEdit}
          onClose={() => setSelectedMetric(null)}
          onSavePlay={onSavePlay}
        />
      )}
      {selectedSmuggle && (
        <SmuggleSelectionDialog
          candidate={selectedSmuggle}
          onClose={() => setSelectedSmuggle(null)}
          onChoose={async (opportunity) => {
            await onUseSmuggle(opportunity);
            setSelectedSmuggle(null);
          }}
          onSkip={async () => {
            await onSkipSmuggle(selectedSmuggle);
            setSelectedSmuggle(null);
          }}
        />
      )}
    </>
  );
}

function PlayRow({play, onClick, showDate = false, smuggleRelationship = null}) {
  return (
    <button className="planner-play-row" onClick={onClick}>
      <span className="planner-play-level" style={{background: isStandaloneContent(play) ? "#f472b6" : LEVEL_COLORS[play.campaignLevel]}} />
      <span><strong>{play.playType}</strong><small>{play.campaignName} · {play.channel}{showDate ? ` · ${formatDate(play.scheduledDate)}` : ""}</small>{smuggleRelationship && <em className="planner-play-smuggle">↳ Contains L{smuggleRelationship.beneficiaryLevel} {smuggleRelationship.beneficiaryName}</em>}</span>
      {smuggleRelationship && <StatusBadge status="smuggle">Smuggle</StatusBadge>}
      {needsPromotionReview(play) && <StatusBadge status="conflict">{play.status === "conflict" ? "Conflict" : "Review"}</StatusBadge>}
    </button>
  );
}

function WeeklyInventoryPlay({play, deadline, canEdit, onSave}) {
  const needsAttention = needsPromotionReview(play);
  const [expanded, setExpanded] = useState(needsAttention);
  const [draft, setDraft] = useState({...play});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    setDraft({...play});
    setExpanded((current) => current || needsPromotionReview(play));
  }, [play]);
  const changed = draft.scheduledDate !== play.scheduledDate;
  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSave({...draft, manuallyAdjusted: true});
    } catch (error) {
      setSaveError(error.message || "This promotion could not be updated.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className={`planner-inventory-row ${needsAttention ? "has-alert" : ""}`}>
      <div className="planner-inventory-row-header">
        <PromotionKindBadge item={play} />
        <div><strong>{play.campaignName}</strong><small>{play.playType} · {play.channel} · {formatDate(play.scheduledDate, {year: false})}</small></div>
        {needsAttention && <StatusBadge status="conflict">{play.status === "conflict" ? "Conflict" : "Review"}</StatusBadge>}
        {canEdit && <button className="planner-text-button" onClick={() => setExpanded((current) => !current)}>{expanded ? "Hide" : needsAttention ? "Resolve" : "Adjust"}</button>}
      </div>
      {expanded && canEdit && (
        <div className="planner-inventory-row-controls">
          <Field label="Planned date"><input type="date" value={draft.scheduledDate} max={deadline || undefined} onChange={(event) => setDraft({...draft, scheduledDate: event.target.value, status: "rescheduled", conflictState: "none", conflictReason: ""})} /></Field>
          <button className="planner-button is-primary" disabled={!changed || saving} onClick={save}>{saving ? "Saving…" : "Save change"}</button>
          {saveError && <p role="alert">{saveError}</p>}
        </div>
      )}
    </article>
  );
}

function WeeklyInventoryModal({metric, weekStart, weekEnd, plays, campaigns, canEdit, onClose, onSavePlay}) {
  const matching = weeklyInventoryPlays({
    plays,
    weekStart,
    weekEnd,
    resourceId: metric.inventoryType === "resource" ? metric.resourceId : "",
    campaignLevel: metric.inventoryType === "level" ? metric.campaignLevel : null,
  });
  const attention = matching.filter(needsPromotionReview);
  const active = visiblePromotions(matching);
  return (
    <Modal title={metric.name} eyebrow={`${formatDate(weekStart, {year: false})}–${formatDate(weekEnd)}`} onClose={onClose} size="wide">
      <div className="planner-inventory-summary">
        <span><strong>{active.length}</strong> promotions</span>
        <span><strong>{attention.length}</strong> need attention</span>
        {metric.capacity && <span><strong>{metric.capacity}</strong> weekly maximum</span>}
      </div>
      {attention.length > 0 && (
        <div className="planner-detail-note is-alert">
          <strong>{attention.length} promotion{attention.length === 1 ? " needs" : "s need"} a decision</strong>
          <p>Resolve a conflict by moving the promotion to another valid date. Moving it outside this week removes it from this list.</p>
        </div>
      )}
      {active.length ? (
        <div className="planner-inventory-list">
          {active.map((play) => <WeeklyInventoryPlay key={play.id} play={play} deadline={campaignDeadline(campaigns.find((campaign) => campaign.id === play.campaignId))} canEdit={canEdit} onSave={onSavePlay} />)}
        </div>
      ) : <EmptyState title="Nothing scheduled" copy={`No ${metric.name.toLowerCase()} promotions are scheduled for this week.`} />}
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

function CalendarPromotionBriefDialog({group, workspace, onClose, onOpenPlay, onOpenCampaign}) {
  const campaign = workspace.campaigns.find((item) => item.id === group.campaignId);
  const campaignPlays = workspace.scheduledPlays.filter((play) => play.campaignId === group.campaignId);
  const playbook = workspace.playbooks.find((item) => item.id === campaign?.playbookId);
  const smuggleRelationships = buildSmuggleRelationships({
    plays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  });
  const smuggleByHostPlay = new Map(smuggleRelationships.map((relationship) => [relationship.hostPlayId, relationship]));
  const dayPlays = [...group.plays].sort((left, right) => String(left.playType).localeCompare(String(right.playType)));
  const weekNumbers = [...new Set(dayPlays.map((play) => Number(play.weekNumber)).filter(Boolean))].sort((left, right) => left - right);
  const phases = [...new Set(dayPlays.map((play) => String(play.phase || "").trim()).filter(Boolean))];
  const primaryWeek = weekNumbers[0] || Number(campaign?.currentWeek) || 1;
  const phase = phases[0] || playbook?.weeks?.find((week) => Number(week.weekNumber) === primaryWeek)?.phase || "Campaign";
  const weekLabel = playbook?.weeks?.find((week) => Number(week.weekNumber) === primaryWeek)?.label || "Planned promotion week";
  const durationWeeks = Number(campaign?.durationWeeks || playbook?.durationWeeks || Math.max(...weekNumbers, 1));
  const attention = dayPlays.filter(needsPromotionReview);
  const futureDates = [...new Set(visiblePromotions(campaignPlays)
    .map((play) => play.scheduledDate)
    .filter((scheduledDate) => scheduledDate > group.scheduledDate))].sort();
  const nextDate = futureDates[0] || "";
  const nextPlays = nextDate ? visiblePromotions(campaignPlays).filter((play) => play.scheduledDate === nextDate) : [];
  const arc = playbook?.weeks?.length ? playbook.weeks : [...new Map(campaignPlays
    .filter((play) => Number(play.weekNumber))
    .sort((left, right) => Number(left.weekNumber) - Number(right.weekNumber))
    .map((play) => [Number(play.weekNumber), {
      weekNumber: Number(play.weekNumber),
      phase: play.phase || "Campaign",
      label: `Week ${play.weekNumber}`,
    }])).values()];

  if (!campaign) return null;
  return (
    <Modal title={campaign.name} eyebrow={`Level ${campaign.level} · ${formatDate(group.scheduledDate)}`} onClose={onClose} size="wide">
      <section className="planner-calendar-brief-hero" style={{"--planner-brief-accent": LEVEL_COLORS[campaign.level] || LEVEL_COLORS[5]}}>
        <div className="planner-calendar-phase-card">
          <span className="planner-kicker">Current phase</span>
          <h3>{phase}</h3>
          <strong>{weekLabel}</strong>
          <p>{phaseBrief(phase)}</p>
        </div>
        <dl className="planner-calendar-brief-facts">
          <div><dt>Campaign position</dt><dd>{weekNumbers.length > 1 ? `Weeks ${weekNumbers.join(" & ")}` : `Week ${primaryWeek}`} of {durationWeeks}</dd></div>
          <div><dt>Promotion date</dt><dd>{campaignTimingLabel(group.scheduledDate, campaign.eventDate)}</dd></div>
          <div><dt>Event</dt><dd>{formatDate(campaign.eventDate)}</dd></div>
        </dl>
      </section>

      {arc.length > 0 && (
        <section className="planner-campaign-arc" aria-label="Campaign progression">
          <div className="planner-section-heading"><div><span className="planner-kicker">Campaign arc</span><h3>Where this promotion sits</h3></div></div>
          <ol>
            {arc.map((week) => {
              const active = weekNumbers.includes(Number(week.weekNumber));
              const past = Number(week.weekNumber) < primaryWeek;
              return <li key={week.weekNumber} className={active ? "is-current" : past ? "is-past" : ""}><span>Week {week.weekNumber}</span><strong>{week.phase || "Campaign"}</strong><small>{week.label || "Planned week"}</small></li>;
            })}
          </ol>
        </section>
      )}

      <section className="planner-calendar-day-brief">
        <div className="planner-section-heading"><div><span className="planner-kicker">This date</span><h3>{dayPlays.length} planned promotion{dayPlays.length === 1 ? "" : "s"}</h3></div>{attention.length > 0 && <StatusBadge status="conflict">{attention.length} need attention</StatusBadge>}</div>
        <div className="planner-calendar-brief-play-list">
          {dayPlays.map((play) => {
            const relationship = smuggleByHostPlay.get(play.id);
            return (
              <button key={play.id} className={`planner-calendar-brief-play ${needsPromotionReview(play) ? "has-alert" : ""}`} onClick={() => onOpenPlay(play)}>
                <span><strong>{play.playType}</strong><small>{play.channel} · {play.requirement === "as-available" ? "If available" : play.requirement === "optional" ? "Optional" : "Planned"}</small>{relationship && <em>Contains L{relationship.beneficiaryLevel} {relationship.beneficiaryName} as a Smuggle</em>}</span>
                {needsPromotionReview(play) ? <StatusBadge status="conflict">Review</StatusBadge> : <span className="planner-calendar-brief-open">Details ›</span>}
              </button>
            );
          })}
        </div>
      </section>

      {attention.length > 0 && <div className="planner-detail-note is-alert"><strong>This date needs a decision</strong><p>{attention.map((play) => `${play.playType}: ${play.conflictReason || play.lateReason || "Review this promotion."}`).join(" ")}</p></div>}
      {campaign.notes && <div className="planner-detail-note"><strong>Campaign notes</strong><p>{campaign.notes}</p></div>}
      <div className="planner-calendar-next-step">
        <span className="planner-kicker">Next in the plan</span>
        {nextDate ? <><strong>{formatDate(nextDate)} · {nextPlays.map((play) => play.playType).join(", ")}</strong><p>The campaign continues with {nextPlays.length} planned promotion{nextPlays.length === 1 ? "" : "s"} on its next active date.</p></> : <><strong>{group.scheduledDate === campaign.eventDate ? "This is the event-day promotion" : "No later promotions are planned"}</strong><p>This is the final active promotion date currently on the campaign.</p></>}
      </div>
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Close</button><button className="planner-button is-primary" onClick={() => onOpenCampaign(campaign)}>Open full campaign</button></div>
    </Modal>
  );
}

function CalendarView({workspace, canEdit, onOpenCampaign, onOpenPlay, onMovePlay}) {
  const calendarRef = useRef(null);
  const [view, setView] = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) || "dayGridMonth");
  const [filters, setFilters] = useState({campaign: "", level: "", channel: "", playType: ""});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const smuggleRelationships = useMemo(() => buildSmuggleRelationships({
    plays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  }), [workspace.scheduledPlays, workspace.campaigns]);
  const smuggledPlayIds = useMemo(() => new Set(
    smuggleRelationships.map((relationship) => relationship.beneficiaryPlayId).filter(Boolean),
  ), [smuggleRelationships]);
  const filtered = useMemo(() => visiblePromotions(workspace.scheduledPlays).filter((play) =>
    !smuggledPlayIds.has(play.id) &&
    (!filters.campaign || play.campaignId === filters.campaign) &&
    (!filters.level || (!isStandaloneContent(play) && String(play.campaignLevel) === filters.level)) &&
    (!filters.channel || play.channel === filters.channel) &&
    (!filters.playType || play.playType === filters.playType),
  ), [workspace.scheduledPlays, filters, smuggledPlayIds]);
  const values = (key) => [...new Set(workspace.scheduledPlays.map((play) => play[key]).filter(Boolean))].sort();
  const smuggleByHostPlay = useMemo(() => new Map(
    smuggleRelationships.map((relationship) => [relationship.hostPlayId, relationship]),
  ), [smuggleRelationships]);
  const events = groupCalendarCampaignDays(filtered).map((group) => {
    const content = isStandaloneContent(group);
    const color = content ? "#f472b6" : LEVEL_COLORS[group.campaignLevel] || LEVEL_COLORS[5];
    return {
      id: group.id,
      title: group.campaignName,
      start: group.scheduledDate,
      allDay: true,
      className: `planner-level-calendar-event ${content ? "is-content" : `is-level-${group.campaignLevel}`}`,
      color: `color-mix(in srgb, ${color} 16%, #18181b)`,
      contrastColor: `color-mix(in srgb, ${color} 76%, white)`,
      editable: false,
      extendedProps: {campaignDayGroup: group, sortLevel: content ? 6 : Number(group.campaignLevel)},
    };
  });
  const changeView = (next) => {
    calendarRef.current?.getApi?.().changeView(
      next,
      next === "dayGridWeek" ? nextPlanningWeekStart(new Date()) : undefined,
    );
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };
  const eventContent = (info) => {
    const campaignDayGroup = info.event.extendedProps.campaignDayGroup;
    if (campaignDayGroup) {
      return (
        <div className={`planner-calendar-event is-campaign-day ${isStandaloneContent(campaignDayGroup) ? "is-content" : `is-level-${campaignDayGroup.campaignLevel}`} ${view === "dayGridWeek" ? "is-week" : "is-month"}`}>
          <div><PromotionKindBadge item={campaignDayGroup} /><strong>{campaignDayGroup.campaignName}</strong><small>{campaignDayGroup.plays.length} type{campaignDayGroup.plays.length === 1 ? "" : "s"}</small></div>
          <ul>{campaignDayGroup.plays.map((play) => {
            const relationship = smuggleByHostPlay.get(play.id);
            return (
              <li key={play.id} className={relationship ? "has-smuggle" : ""}>
                <span>{play.playType}{needsPromotionReview(play) ? ` · ${play.status === "conflict" ? "Conflict" : "Review"}` : ""}</span>
                {relationship && <em>↳ Smuggle contains L{relationship.beneficiaryLevel} {relationship.beneficiaryName}</em>}
              </li>
            );
          })}</ul>
        </div>
      );
    }
    const play = info.event.extendedProps.play;
    return (
      <div className="planner-calendar-event">
        <div><PromotionKindBadge item={play} /><strong>{play.campaignName}</strong></div>
        <span>{play.playType}</span>
      </div>
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="Promotion plan"
        title="Promotion calendar"
        copy="Month and Week combine same-day promotion types into one card per campaign."
        actions={
          <div className="planner-segmented">
            <button className={view === "dayGridMonth" ? "is-active" : ""} onClick={() => changeView("dayGridMonth")}>Month</button>
            <button className={view === "dayGridWeek" ? "is-active" : ""} onClick={() => changeView("dayGridWeek")}>Week</button>
          </div>
        }
      />
      <section className="planner-panel planner-calendar-panel">
        <div className="planner-filter-bar">
          <FilterSelect label="Campaign / content" value={filters.campaign} onChange={(campaign) => setFilters({...filters, campaign})} options={workspace.campaigns.map((item) => ({value: item.id, label: item.name}))} />
          <FilterSelect label="Level" value={filters.level} onChange={(level) => setFilters({...filters, level})} options={[1, 2, 3, 4, 5].map((level) => ({value: String(level), label: `Level ${level}`}))} />
          <FilterSelect label="Channel" value={filters.channel} onChange={(channel) => setFilters({...filters, channel})} options={values("channel").map((value) => ({value, label: value}))} />
          <FilterSelect label="Promotion type" value={filters.playType} onChange={(playType) => setFilters({...filters, playType})} options={values("playType").map((value) => ({value, label: value}))} />
          {Object.values(filters).some(Boolean) && <button className="planner-text-button" onClick={() => setFilters({campaign: "", level: "", channel: "", playType: ""})}>Clear filters</button>}
        </div>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin, classicThemePlugin]}
          initialView={view}
          initialDate={view === "dayGridWeek" ? nextPlanningWeekStart(new Date()) : new Date()}
          firstDay={0}
          headerToolbar={{left: "prev,next today", center: "title", right: ""}}
          height="auto"
          views={{
            dayGridMonth: {dayMaxEventRows: 3},
            dayGridWeek: {dayMaxEventRows: 5},
          }}
          events={events}
          eventOrder={(left, right) =>
            Number(left.extendedProps.sortLevel) - Number(right.extendedProps.sortLevel) ||
            String(left.title).localeCompare(String(right.title))
          }
          eventOrderStrict
          eventContent={eventContent}
          eventClick={(info) => {
            const group = info.event.extendedProps.campaignDayGroup;
            if (!group) return onOpenPlay(info.event.extendedProps.play);
            const campaign = workspace.campaigns.find((item) => item.id === group.campaignId);
            if (!campaign) return onOpenPlay(group.plays[0]);
            if (isStandaloneContent(group)) return onOpenCampaign(campaign);
            setSelectedGroup(group);
          }}
          eventDrop={(info) => {
            const play = info.event.extendedProps.play;
            if (play) onMovePlay(play, info.event.startStr.slice(0, 10));
          }}
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
      {selectedGroup && <CalendarPromotionBriefDialog group={selectedGroup} workspace={workspace} onClose={() => setSelectedGroup(null)} onOpenPlay={(play) => { setSelectedGroup(null); onOpenPlay(play); }} onOpenCampaign={(campaign) => { setSelectedGroup(null); onOpenCampaign(campaign); }} />}
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
  const sorted = workspace.campaigns
    .filter((campaign) => !isStandaloneContent(campaign))
    .sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)));
  return (
    <>
      <PageHeading
        eyebrow="Campaigns"
        title="Every promotion in motion"
        copy="Campaigns turn each event playbook into a clear, date-specific promotion plan."
        actions={canEdit && <button className="planner-button is-primary" onClick={onNewCampaign}>＋ New campaign</button>}
      />
      <section className="planner-panel planner-table-panel">
        {sorted.length ? (
          <div className="planner-campaign-table">
            <div className="planner-table-header"><span>Campaign</span><span>Event</span><span>Playbook</span><span /></div>
            {sorted.map((campaign) => {
              const conflicts = workspace.scheduledPlays.filter((play) => play.campaignId === campaign.id && play.status === "conflict").length;
              return (
                <button className="planner-campaign-row" key={campaign.id} onClick={() => onOpenCampaign(campaign)}>
                  <span className="planner-campaign-title"><LevelBadge level={campaign.level} /><span><strong>{campaign.name}</strong><small>{titleCase(campaign.campaignType)}</small></span>{conflicts > 0 && <StatusBadge status="conflict">{conflicts} conflict{conflicts === 1 ? "" : "s"}</StatusBadge>}</span>
                  <span><strong>{formatDate(campaign.eventDate)}</strong><small>{campaign.currentWeek > 0 && campaign.currentWeek <= campaign.durationWeeks ? `Week ${campaign.currentWeek} of ${campaign.durationWeeks}` : "Upcoming"}</small></span>
                  <span><strong>{workspace.playbooks.find((item) => item.id === campaign.playbookId)?.name || campaign.playbookId}</strong><small>Version {campaign.playbookVersion}</small></span>
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

function contentFormFromSeries(campaign, plays) {
  if (!campaign) {
    return {
      title: "",
      publishDate: addDays(dateKey(new Date()), 7),
      contentType: CONTENT_TYPES[0].value,
      channel: CONTENT_TYPES[0].channel,
      recurrence: "none",
      occurrences: 12,
      notes: "",
    };
  }
  const series = contentSeriesDetails(visiblePromotions(plays));
  const first = series.plays[0];
  return {
    title: campaign.name || "",
    publishDate: series.firstDate || campaign.recommendedStartDate || campaign.eventDate,
    contentType: first?.playType || CONTENT_TYPES[0].value,
    channel: first?.channel || CONTENT_TYPES[0].channel,
    recurrence: series.cadence || "none",
    occurrences: Math.max(2, series.plays.length || 1),
    notes: campaign.notes || "",
  };
}

function buildStandaloneContent(form, existingCampaign = null, existingPlays = []) {
  const id = existingCampaign?.id || `content-${Date.now().toString(36)}`;
  const submittedAt = existingCampaign?.submittedAt || new Date().toISOString();
  const dates = recurringContentDates({
    startDate: form.publishDate,
    cadence: form.recurrence,
    occurrences: form.occurrences,
  });
  const lastDate = dates.at(-1);
  const campaign = {
    ...(existingCampaign || {}),
    id,
    name: form.title.trim(),
    eventDate: lastDate,
    registrationDeadline: "",
    submittedAt,
    submittedDate: dateKey(submittedAt),
    recommendedStartDate: existingCampaign?.recommendedStartDate || form.publishDate,
    isOnTime: true,
    daysLate: 0,
    weeksLate: 0,
    level: 5,
    campaignType: STANDALONE_CONTENT_TYPE,
    playbookId: STANDALONE_CONTENT_TYPE,
    playbookVersion: 1,
    durationWeeks: dates.length,
    currentWeek: existingCampaign?.currentWeek || 1,
    sourceEventId: "",
    notes: form.notes.trim(),
    status: "active",
  };
  const priorPlays = [...existingPlays].sort((left, right) =>
    Number(left.weekNumber || 1) - Number(right.weekNumber || 1) ||
    String(left.scheduledDate).localeCompare(String(right.scheduledDate)),
  );
  const plays = dates.map((scheduledDate, index) => {
    const prior = priorPlays[index];
    return {
    ...(prior || {}),
    id: prior?.id || `${id}-promotion-${index + 1}`,
    campaignId: id,
    campaignName: campaign.name,
    campaignLevel: 5,
    campaignType: STANDALONE_CONTENT_TYPE,
    playbookId: STANDALONE_CONTENT_TYPE,
    playbookVersion: 1,
    templatePlayId: prior?.templatePlayId || `standalone-content-${index + 1}`,
    weekNumber: index + 1,
    phase: "Content",
    playType: form.contentType,
    channel: form.channel.trim(),
    resourceId: "standalone-content",
    originalScheduledDate: prior?.originalScheduledDate || scheduledDate,
    scheduledDate,
    eligibleWeekdays: [utcDateFromKey(scheduledDate).getUTCDay()],
    status: "scheduled",
    requirement: "required",
    lateBehavior: "SKIP",
    source: `${STANDALONE_CONTENT_TYPE}:${form.recurrence}`,
    manuallyAdjusted: prior ? scheduledDate !== prior.originalScheduledDate : false,
    locked: false,
    conflictState: "none",
    conflictReason: "",
    lateReason: "",
    supportsSmuggle: false,
    smuggle: null,
  };
  });
  priorPlays.slice(dates.length).forEach((prior) => {
    plays.push({
      ...prior,
      campaignName: campaign.name,
      playType: form.contentType,
      channel: form.channel.trim(),
      status: "skipped",
      source: `${STANDALONE_CONTENT_TYPE}:${form.recurrence}`,
      manuallyAdjusted: true,
      conflictState: "none",
      conflictReason: "",
    });
  });
  return {campaign, plays};
}

function ContentDialog({campaign = null, plays = [], onClose, onSave}) {
  const editing = Boolean(campaign);
  const [form, setForm] = useState(() => contentFormFromSeries(campaign, plays));
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  const recurrenceDates = useMemo(() => form.publishDate ? recurringContentDates({startDate: form.publishDate, cadence: form.recurrence, occurrences: form.occurrences}) : [], [form.publishDate, form.recurrence, form.occurrences]);
  const validOccurrences = form.recurrence === "none" || (Number(form.occurrences) >= 2 && Number(form.occurrences) <= 12);
  const valid = form.title.trim() && form.publishDate && form.contentType && form.channel.trim() && validOccurrences;
  return (
    <Modal title={editing ? "Edit content" : "Add content"} eyebrow="Social & video plan" onClose={onClose}>
      <div className="planner-form-grid">
        <Field label="Title" wide><input autoFocus value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Weekend recap video" /></Field>
        <Field label="First publish date"><input type="date" value={form.publishDate} onChange={(event) => update("publishDate", event.target.value)} /></Field>
        <Field label="Content type"><select value={form.contentType} onChange={(event) => {
          const type = CONTENT_TYPES.find((item) => item.value === event.target.value);
          setForm((current) => ({...current, contentType: event.target.value, channel: type?.channel || current.channel}));
        }}>{CONTENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.value}</option>)}</select></Field>
        <Field label="Repeat"><select value={form.recurrence} onChange={(event) => update("recurrence", event.target.value)}>{CONTENT_RECURRENCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        {form.recurrence !== "none" && <Field label="Number of occurrences" help="Creates up to 12 concrete calendar entries in this series."><input type="number" min="2" max="12" value={form.occurrences} onChange={(event) => update("occurrences", Number(event.target.value))} /></Field>}
        <Field label="Channel" wide><input value={form.channel} onChange={(event) => update("channel", event.target.value)} placeholder="Instagram, YouTube, Facebook…" /></Field>
        <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Caption direction, links, assets, or production notes." /></Field>
      </div>
      {form.recurrence !== "none" && recurrenceDates.length > 0 && <div className="planner-detail-note"><strong>{recurrenceDates.length} scheduled occurrences</strong><p>{CONTENT_RECURRENCE_OPTIONS.find((item) => item.value === form.recurrence)?.label} from {formatDate(recurrenceDates[0])} through {formatDate(recurrenceDates.at(-1))}. Each occurrence will appear separately on the calendar.</p></div>}
      <div className="planner-modal-actions">
        <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="planner-button is-primary" disabled={!valid || saving} onClick={async () => {
          setSaving(true);
          try { await onSave(buildStandaloneContent(form, campaign, plays)); }
          catch (_error) { setSaving(false); }
        }}>{saving ? "Saving…" : editing ? "Save changes" : "Add to planner"}</button>
      </div>
    </Modal>
  );
}

function ContentView({workspace, canEdit, onNewContent, onOpenContent}) {
  const content = workspace.campaigns
    .filter(isStandaloneContent)
    .map((item) => ({
      item,
      series: contentSeriesDetails(visiblePromotions(workspace.scheduledPlays.filter((play) => play.campaignId === item.id))),
    }))
    .sort((left, right) => String(left.series.firstDate || left.item.eventDate).localeCompare(String(right.series.firstDate || right.item.eventDate)));
  return (
    <>
      <PageHeading
        eyebrow="Content"
        title="Social and video plan"
        copy="Plan one-time or recurring social posts, YouTube videos, Shorts, Reels, and other content alongside event campaigns."
        actions={canEdit && <button className="planner-button is-primary" onClick={onNewContent}>＋ Add content</button>}
      />
      <section className="planner-panel planner-content-list">
        {content.length ? content.map(({item, series}) => {
          const promotion = series.plays[0];
          const dateLabel = series.firstDate === series.lastDate
            ? formatDate(series.firstDate)
            : `${formatDate(series.firstDate, {year: false})}–${formatDate(series.lastDate)}`;
          return (
            <button className="planner-content-row" key={item.id} onClick={() => onOpenContent(item)}>
              <span className="planner-content-date"><strong>{dateKey(series.firstDate || item.recommendedStartDate).slice(-2)}</strong><small>{formatDate(series.firstDate || item.recommendedStartDate, {year: false}).split(" ")[0]}</small></span>
              <span><strong>{item.name}</strong><small>{promotion?.playType || "Content"} · {promotion?.channel || "Channel not set"} · {series.label}</small></span>
              <span><strong>{dateLabel}</strong><small>{series.plays.length > 1 ? "Series schedule" : "Publish date"}</small></span>
              <span>›</span>
            </button>
          );
        }) : <EmptyState title="No standalone content yet" copy="Add a one-time or recurring social post, YouTube video, Short, Reel, or other content item." action={canEdit && <button className="planner-button is-primary" onClick={onNewContent}>Add content</button>} />}
      </section>
    </>
  );
}

function requestDateLabel(request) {
  if (request.eventDate) return formatDate(request.eventDate);
  if (request.rawEventDateText) return request.rawEventDateText;
  if (request.requestedPromotionStart || request.requestedPromotionEnd) {
    const start = request.requestedPromotionStart ? formatDate(request.requestedPromotionStart) : "No start";
    const end = request.requestedPromotionEnd ? formatDate(request.requestedPromotionEnd) : "No end";
    return `${start} – ${end}`;
  }
  return "Manual date review needed";
}

function RequestsView({workspace, canEdit, onOpenRequest}) {
  const [status, setStatus] = useState("pending-review");
  const requests = [...(workspace.promotionRequests || [])]
    .filter((request) => request.status === status)
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  const pendingCount = (workspace.promotionRequests || [])
    .filter((request) => request.status === "pending-review").length;
  return (
    <>
      <PageHeading
        eyebrow="Planning Center Forms"
        title="Campaign requests"
        copy="Review new Event & Promo and General Promotion submissions before they become campaign schedules. Nothing is added to the calendar until you approve it here."
        actions={<div className="planner-segmented planner-request-filters" aria-label="Request status">
          {[
            ["pending-review", `Pending · ${pendingCount}`],
            ["converted", "Converted"],
            ["dismissed", "Dismissed"],
          ].map(([value, label]) => <button key={value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>{label}</button>)}
        </div>}
      />
      <section className="planner-panel planner-request-list">
        {requests.length ? requests.map((request) => (
          <button className="planner-request-row" key={request.id} onClick={() => onOpenRequest(request)}>
            <span className={`planner-request-source is-${request.sourceFormId === "930568" ? "event" : "general"}`} aria-hidden="true">{request.sourceFormId === "930568" ? "E" : "G"}</span>
            <span className="planner-request-title">
              <strong>{request.proposedName || "Untitled promotion request"}</strong>
              <small>{request.ministry || request.sourceFormName || "Planning Center form"}</small>
            </span>
            <span className="planner-request-date">
              <strong>{requestDateLabel(request)}</strong>
              <small>{["needs-review", "manual-required"].includes(request.dateParseStatus) ? "Date needs review" : "Proposed event date"}</small>
            </span>
            <span className="planner-request-submitted">
              <strong>{formatDate(request.submittedAt)}</strong>
              <small>Submitted</small>
            </span>
            <StatusBadge status={["needs-review", "manual-required"].includes(request.dateParseStatus) ? "needs-decision" : request.status}>{request.status === "pending-review" ? ["needs-review", "manual-required"].includes(request.dateParseStatus) ? "Needs date" : "Ready to review" : request.status}</StatusBadge>
            <span className="planner-request-chevron">›</span>
          </button>
        )) : <EmptyState
          title={status === "pending-review" ? "No requests waiting" : `No ${titleCase(status)} requests`}
          copy={status === "pending-review" ? "New qualifying Planning Center form submissions will appear here automatically." : "Requests will remain available here for reference after review."}
        />}
      </section>
      {!canEdit && <p className="planner-request-readonly">You have view access. A Planner editor or administrator can convert and dismiss requests.</p>}
    </>
  );
}

function RequestReviewDialog({request, workspace, canEdit, onClose, onConvert, onDismiss}) {
  const campaignPlaybooks = workspace.playbooks.filter((item) =>
    item.active !== false &&
    (!isStarterPlaybookId(item.id) || !String(item.campaignType).startsWith("ongoing")),
  );
  const [form, setForm] = useState({
    name: request.proposedName || "",
    eventDate: request.eventDate || "",
    level: "",
    playbookId: "",
  });
  const [saving, setSaving] = useState(false);
  const [dismissConfirm, setDismissConfirm] = useState(false);
  const playbooksForLevel = campaignPlaybooks.filter((item) => Number(item.level) === Number(form.level));
  const playbook = campaignPlaybooks.find((item) => item.id === form.playbookId);
  const preview = useMemo(() => {
    if (!form.name.trim() || !form.eventDate || !playbook) return null;
    const id = `pco-form-${request.sourceFormId}-${request.sourceSubmissionId}`
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 128);
    const generated = generateCampaignSchedule({
      campaign: {
        id,
        name: form.name.trim(),
        eventDate: form.eventDate,
        registrationDeadline: "",
        submittedAt: request.submittedAt || new Date().toISOString(),
        level: playbook.level,
        campaignType: playbook.campaignType,
        playbookId: playbook.id,
        sourceEventId: `pco-form:${request.sourceFormId}:${request.sourceSubmissionId}`,
        eventDetails: String(request.description || "").trim(),
        sampleAnnouncement: "",
        notes: String(request.notes || "").trim(),
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
    return {
      ...generated,
      plays: ownPlays,
      plannedPlays: visiblePromotions(ownPlays),
      summary: scheduleSummary(ownPlays),
    };
  }, [form, playbook, request, workspace]);
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  const statusIsPending = request.status === "pending-review";
  return (
    <Modal title={request.proposedName || "Promotion request"} eyebrow="Planning Center request" onClose={onClose} size="wide">
      <div className="planner-request-review-grid">
        <section className="planner-request-source-details">
          <div className="planner-request-source-heading">
            <span className={`planner-request-source is-${request.sourceFormId === "930568" ? "event" : "general"}`}>{request.sourceFormId === "930568" ? "E" : "G"}</span>
            <div><strong>{request.sourceFormName || "Planning Center Form"}</strong><small>Submitted {formatDate(request.submittedAt)}</small></div>
          </div>
          <dl className="planner-detail-list">
            <div><dt>Ministry</dt><dd>{request.ministry || "Not provided"}</dd></div>
            <div><dt>Submission ID</dt><dd>{request.sourceSubmissionId || "Not provided"}</dd></div>
            <div><dt>Original date response</dt><dd>{request.rawEventDateText || "Not included"}</dd></div>
            <div><dt>Requested promotion window</dt><dd>{request.requestedPromotionStart || request.requestedPromotionEnd ? requestDateLabel({...request, eventDate: "", rawEventDateText: ""}) : "Not included"}</dd></div>
          </dl>
          {request.description && <div className="planner-detail-note"><strong>Description</strong><p>{request.description}</p></div>}
          {request.notes && <div className="planner-detail-note"><strong>Additional notes</strong><p>{request.notes}</p></div>}
          {request.requestedPlatforms?.length > 0 && <div className="planner-request-platforms"><strong>Requested platforms</strong><div>{request.requestedPlatforms.map((platform) => <span key={platform}>{platform}</span>)}</div></div>}
          {request.eventDates?.length > 1 && <div className="planner-detail-note"><strong>Dates found in the form response</strong><p>{request.eventDates.map((value) => formatDate(value)).join(" · ")}</p></div>}
        </section>
        <section className="planner-request-conversion">
          <div className="planner-form-grid">
            <Field label="Campaign / Event name" wide><input autoFocus value={form.name} disabled={!canEdit || !statusIsPending} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Primary event date" help={["needs-review", "manual-required"].includes(request.dateParseStatus) ? "This request requires a manually confirmed date." : "Confirm or correct the proposed date."}><input type="date" value={form.eventDate} disabled={!canEdit || !statusIsPending} onChange={(event) => update("eventDate", event.target.value)} /></Field>
            <Field label="Promotion level"><select value={form.level} disabled={!canEdit || !statusIsPending} onChange={(event) => setForm((current) => ({...current, level: event.target.value, playbookId: ""}))}><option value="">Choose a level</option>{[1, 2, 3, 4, 5].filter((level) => campaignPlaybooks.some((item) => Number(item.level) === level)).map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field>
            <Field label="Promotion playbook" wide><select value={form.playbookId} disabled={!canEdit || !statusIsPending || !form.level} onChange={(event) => update("playbookId", event.target.value)}><option value="">Choose a playbook</option>{playbooksForLevel.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          </div>
          {!statusIsPending && <div className="planner-detail-note"><strong>{request.status === "converted" ? "Campaign created" : "Request dismissed"}</strong><p>{request.status === "converted" ? `This submission was converted to campaign ${request.campaignId || "(ID unavailable)"}.` : "This submission was reviewed and intentionally left out of the Planner."}</p></div>}
          {statusIsPending && !preview && <EmptyState title="Complete the campaign details" copy="Confirm the name and primary event date, then deliberately choose a promotion level and playbook." />}
          {statusIsPending && preview && <>
            <div className={`planner-timeliness-card ${preview.campaign.isOnTime ? "is-on-time" : "is-late"}`}>
              <div><span className="planner-kicker">Level {playbook.level} · {preview.campaign.durationWeeks}-week campaign</span><h3>Schedule preview</h3></div>
              <dl><div><dt>Recommended start</dt><dd>{formatDate(preview.campaign.recommendedStartDate)}</dd></div><div><dt>Event</dt><dd>{formatDate(preview.campaign.eventDate)}</dd></div><div><dt>Submitted</dt><dd>{formatDate(preview.campaign.submittedAt)}</dd></div></dl>
              {preview.summary.missed > 0 && <p>{preview.summary.missed} promotion{preview.summary.missed === 1 ? "" : "s"} already passed and will not be added.</p>}
            </div>
            <div className="planner-preview-metrics"><span><strong>{preview.plannedPlays.length}</strong> promotions</span><span><strong>{preview.summary.conflicts}</strong> conflicts</span></div>
            <div className="planner-preview-list">{preview.plannedPlays.map((play) => <PlayRow key={play.id} play={play} onClick={() => {}} />)}</div>
          </>}
        </section>
      </div>
      {dismissConfirm && <div className="planner-delete-confirmation"><div><strong>Dismiss this request?</strong><p>It will remain available under Dismissed, but no campaign or calendar promotions will be created.</p></div><div><button className="planner-button is-secondary" disabled={saving} onClick={() => setDismissConfirm(false)}>Keep reviewing</button><button className="planner-button is-danger" disabled={saving} onClick={async () => { setSaving(true); try { await onDismiss(request); } catch (_error) { setSaving(false); } }}>{saving ? "Dismissing…" : "Dismiss request"}</button></div></div>}
      <div className="planner-modal-actions">
        {canEdit && statusIsPending && !dismissConfirm && <button className="planner-button is-danger is-quiet" disabled={saving} onClick={() => setDismissConfirm(true)}>Dismiss</button>}
        <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Close</button>
        {canEdit && statusIsPending && <button className="planner-button is-primary" disabled={!preview || saving || dismissConfirm} onClick={async () => { setSaving(true); try { await onConvert(request, preview.campaign, preview.plannedPlays, form.eventDate); } catch (_error) { setSaving(false); } }}>{saving ? "Creating campaign…" : preview ? `Create campaign · ${preview.plannedPlays.length} promos` : "Create campaign"}</button>}
      </div>
    </Modal>
  );
}

function BriefEntryPreview({entry, canEdit = false, onEditBriefContent}) {
  const color = entry.kind === "content" ? "#f472b6" : LEVEL_COLORS[entry.level] || LEVEL_COLORS[5];
  return (
    <article className="planner-brief-entry" style={{"--brief-accent": color}}>
      <header>
        <div>
          <PromotionKindBadge item={entry.kind === "content" ? {campaignType: STANDALONE_CONTENT_TYPE} : {level: entry.level}} />
          <span><strong>{entry.name}</strong><small>{entry.kind === "content" ? `${formatDate(entry.firstPromotionDate)}–${formatDate(entry.lastPromotionDate)}` : `Event ${formatDate(entry.eventDate)}`}</small></span>
        </div>
        <div className="planner-brief-entry-actions">
          {canEdit && entry.kind === "campaign" && <button className="planner-text-button" onClick={() => onEditBriefContent(entry.id)}>Edit brief content</button>}
          <StatusBadge status={entry.smuggledInto.length && !entry.announcements.length ? "smuggle" : ""}>{entry.announcements.length ? `${entry.announcements.length} selected` : "Smuggle"}</StatusBadge>
        </div>
      </header>
      {entry.registrationDeadline && <p className="planner-brief-deadline">Registration deadline · {formatDate(entry.registrationDeadline)}</p>}
      {entry.smuggledInto.map((relationship) => (
        <div className="planner-brief-smuggled-into" key={relationship.id}>
          <StatusBadge status="smuggle">Smuggled into</StatusBadge>
          <span><strong>L{relationship.hostCampaignLevel} {relationship.hostCampaignName}</strong><small>{relationship.hostPlayType} · {formatDate(relationship.scheduledDate)}</small></span>
        </div>
      ))}
      <div className="planner-brief-announcements">
        {entry.announcements.map((announcement) => (
          <div key={announcement.id} className={announcement.needsAttention ? "has-alert" : ""}>
            <span><strong>{announcement.playType}</strong><small>{announcement.channel || "Channel not set"}</small>{announcement.smuggle && <em className="planner-brief-smuggle">↳ Contains L{announcement.smuggle.beneficiaryLevel} {announcement.smuggle.beneficiaryName}</em>}</span>
            <time dateTime={announcement.scheduledDate}>{formatDate(announcement.scheduledDate)}</time>
          </div>
        ))}
      </div>
      {entry.eventDetails && <section className="planner-brief-copy"><strong>Event details</strong><PlannerMarkdown value={entry.eventDetails} /></section>}
      {entry.notes && <p className="planner-brief-notes"><strong>Notes</strong>{entry.notes}</p>}
    </article>
  );
}

function AnnouncementScriptPreview({brief}) {
  const sections = brief.entries.filter((entry) => entry.sampleAnnouncement);
  if (!sections.length && !brief.closingScript) return (
    <section className="planner-announcement-script is-empty">
      <span className="planner-kicker">Combined script</span>
      <h3>Add sample announcements to build the script</h3>
      <p>Use Edit brief content on an event, then its copy will appear here in event order.</p>
    </section>
  );
  return (
    <section className="planner-announcement-script">
      <header><div><span className="planner-kicker">Combined script</span><h3>Sunday announcement script</h3></div><small>Starts on a fresh PDF page</small></header>
      {sections.map((entry) => <article key={entry.id} style={{"--script-accent": entry.kind === "content" ? "#f472b6" : LEVEL_COLORS[entry.level] || LEVEL_COLORS[5]}}><h4>{entry.name}</h4><PlannerMarkdown value={entry.sampleAnnouncement} /></article>)}
      {brief.closingScript && <article className="is-closing" style={{"--script-accent": LEVEL_COLORS[1]}}><h4>{brief.closingScriptTitle || "One Next Step"}</h4><PlannerMarkdown value={brief.closingScript} /></article>}
    </section>
  );
}

function ReportEmailDialog({brief, authState, onClose, onSent}) {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState(`${brief.title} · ${formatBriefDate(brief.startDate, {year: false})}–${formatBriefDate(brief.endDate)}`);
  const [message, setMessage] = useState("Here is the latest Sunday announcement brief from Central.");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const valid = recipients.trim() && subject.trim();
  return (
    <Modal title="Email announcement brief" eyebrow="Sent by central@crosspointe.tv" onClose={onClose}>
      <div className="planner-form-grid">
        <Field label="Recipients" wide help="Separate multiple email addresses with commas."><input autoFocus type="text" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="creative@crosspointe.tv, ministry@crosspointe.tv" /></Field>
        <Field label="Subject" wide><input value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field label="Message" wide><textarea value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
      </div>
      <div className="planner-detail-note"><strong>PDF included</strong><p>Central will attach the same {brief.entries.length}-item brief available from Download PDF. The email body also includes a readable campaign summary.</p></div>
      {error && <div className="planner-detail-note is-alert"><strong>Email not sent</strong><p>{error}</p></div>}
      <div className="planner-modal-actions">
        <button className="planner-button is-secondary" disabled={sending} onClick={onClose}>Cancel</button>
        <button className="planner-button is-primary" disabled={!valid || sending} onClick={async () => {
          setSending(true); setError("");
          try {
            const result = await sendPromotionBriefEmail({user: authState.user, recipients, subject, message, brief});
            onSent(result);
          } catch (sendError) {
            setError(sendError.message || "Central could not send this brief.");
            setSending(false);
          }
        }}>{sending ? "Sending…" : "Send brief"}</button>
      </div>
    </Modal>
  );
}

function ReportsView({workspace, authState, canEdit, canEmail, onEditBriefContent, onNotice, onError}) {
  const initialRange = reportPresetDateRange("upcoming", new Date());
  const [datePreset, setDatePreset] = useState("upcoming");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [title, setTitle] = useState("Sunday Announcement Brief");
  const [includeEventDetails, setIncludeEventDetails] = useState(false);
  const [includeSampleAnnouncements, setIncludeSampleAnnouncements] = useState(false);
  const [closingScriptTitle, setClosingScriptTitle] = useState("One Next Step");
  const [closingScript, setClosingScript] = useState("");
  const playTypes = useMemo(() => [...new Set(visiblePromotions(workspace.scheduledPlays).map((play) => play.playType).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [workspace.scheduledPlays]);
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(playTypes.includes("Stage Announcement") ? ["Stage Announcement"] : playTypes));
  const [emailOpen, setEmailOpen] = useState(false);
  const brief = useMemo(() => buildPromotionBrief({
    campaigns: workspace.campaigns,
    scheduledPlays: workspace.scheduledPlays,
    selectedPlayTypes: [...selectedTypes],
    startDate,
    endDate,
    title,
    includeEventDetails,
    includeSampleAnnouncements,
    closingScriptTitle,
    closingScript,
  }), [workspace.campaigns, workspace.scheduledPlays, selectedTypes, startDate, endDate, title, includeEventDetails, includeSampleAnnouncements, closingScriptTitle, closingScript]);
  const dateRangeValid = startDate && endDate && startDate <= endDate;
  const ready = dateRangeValid && selectedTypes.size > 0 && brief.entries.length > 0;
  const toggleType = (playType) => setSelectedTypes((current) => {
    const next = new Set(current);
    if (next.has(playType)) next.delete(playType);
    else next.add(playType);
    return next;
  });

  return (
    <>
      <PageHeading
        eyebrow="Announcement Brief"
        title="Build the Sunday announcement brief"
        copy="Review the events on the first page, then combine their saved sample announcements into one speaker-ready script with an optional closing section."
        actions={<div className="planner-heading-action-group"><button className="planner-button is-secondary" disabled={!ready} onClick={() => {
          try {
            const result = downloadPromotionBriefPdf(brief);
            onNotice(`${result.filename} downloaded.`);
          } catch (pdfError) { onError(pdfError.message || "The PDF could not be generated."); }
        }}>↓ Download PDF</button>{canEmail && !authState.preview && <button className="planner-button is-primary" disabled={!ready} onClick={() => setEmailOpen(true)}>✉ Email brief</button>}</div>}
      />
      <section className="planner-report-layout">
        <aside className="planner-panel planner-report-controls">
          <div className="planner-panel-heading"><div><span className="planner-kicker">Brief setup</span><h2>Sunday announcements</h2></div></div>
          <div className="planner-form-grid">
            <Field label="Brief title" wide><input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label="Date range" wide help={`${formatBriefDate(startDate)} through ${formatBriefDate(endDate)}`}>
              <select value={datePreset} onChange={(event) => {
                const nextPreset = event.target.value;
                setDatePreset(nextPreset);
                if (nextPreset !== "custom") {
                  const nextRange = reportPresetDateRange(nextPreset, new Date());
                  setStartDate(nextRange.startDate);
                  setEndDate(nextRange.endDate);
                }
              }}>
                {REPORT_DATE_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
              </select>
            </Field>
            {datePreset === "custom" && <>
              <Field label="From"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
              <Field label="Through"><input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
            </>}
          </div>
          {!dateRangeValid && <div className="planner-detail-note is-alert"><strong>Check the date range</strong><p>The end date must be the same as or later than the start date.</p></div>}
          <div className="planner-report-type-heading"><strong>Campaign content</strong><span>Optional</span></div>
          <div className="planner-report-inclusions">
            <label><input type="checkbox" checked={includeEventDetails} onChange={(event) => setIncludeEventDetails(event.target.checked)} /><span><strong>Event details</strong><small>Include brief-ready details saved with each event.</small></span></label>
            <label><input type="checkbox" checked={includeSampleAnnouncements} onChange={(event) => setIncludeSampleAnnouncements(event.target.checked)} /><span><strong>Combined announcement script</strong><small>Start a fresh PDF page with every saved sample announcement in event order.</small></span></label>
          </div>
          {includeSampleAnnouncements && <div className="planner-report-closing">
            <div className="planner-report-type-heading"><strong>Closing section</strong><span>Optional</span></div>
            <Field label="Section heading" wide><input value={closingScriptTitle} maxLength={120} onChange={(event) => setClosingScriptTitle(event.target.value)} placeholder="One Next Step" /></Field>
            <Field label="Closing script" wide help="Tie the announcements together with a final next step or reminder."><MarkdownTextEditor value={closingScript} onChange={setClosingScript} placeholder="Everything is on **CrossPointe Central**…" /></Field>
          </div>}
          <div className="planner-report-type-heading"><strong>Promotion types</strong><span>{selectedTypes.size} selected</span></div>
          <div className="planner-report-type-actions"><button className="planner-text-button" onClick={() => setSelectedTypes(new Set(playTypes))}>Select all</button><button className="planner-text-button" onClick={() => setSelectedTypes(new Set())}>Clear</button></div>
          <div className="planner-report-types">
            {playTypes.map((playType) => <label key={playType}><input type="checkbox" checked={selectedTypes.has(playType)} onChange={() => toggleType(playType)} /><span>{playType}</span></label>)}
          </div>
          {!canEmail && <div className="planner-detail-note"><strong>PDF access only</strong><p>Planner Approve or Admin permission is required to send an external email.</p></div>}
          {authState.preview && <div className="planner-detail-note"><strong>Email disabled in local preview</strong><p>PDF generation is available here. Email sending requires an authenticated Central environment.</p></div>}
        </aside>
        <section className="planner-panel planner-report-preview">
          <div className="planner-report-preview-header">
            <div><span className="planner-kicker">Live preview</span><h2>{brief.title || "Announcement Brief"}</h2><p>{formatBriefDate(startDate)}–{formatBriefDate(endDate)}</p></div>
            <div><span><strong>{brief.announcementCount}</strong> promotions</span><span><strong>{brief.entries.length}</strong> campaigns + content</span><span className={brief.attentionCount ? "has-alert" : ""}><strong>{brief.attentionCount}</strong> need attention</span></div>
          </div>
          {brief.entries.length ? <><div className="planner-brief-entry-list">{brief.entries.map((entry) => <BriefEntryPreview key={entry.id} entry={entry} canEdit={canEdit} onEditBriefContent={(campaignId) => {
            const campaign = workspace.campaigns.find((item) => item.id === campaignId);
            if (campaign) onEditBriefContent(campaign);
          }} />)}</div>{includeSampleAnnouncements && <AnnouncementScriptPreview brief={brief} />}</> : <EmptyState title="No matching promotions" copy="Choose at least one promotion type and a date range containing planned promotions." />}
        </section>
      </section>
      {emailOpen && <ReportEmailDialog brief={brief} authState={authState} onClose={() => setEmailOpen(false)} onSent={(result) => { setEmailOpen(false); onNotice(result.message || "Announcement brief sent."); }} />}
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
      <div className="planner-detail-note"><strong>Start with a clean rhythm</strong><p>Each week is created empty so you can define the exact promotions, phase, and label after the playbook is added.</p></div>
      <div className="planner-modal-actions">
        <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="planner-button is-primary" disabled={!valid || saving} onClick={async () => { setSaving(true); try { await onCreate(customPlaybookFromForm(form)); } catch (_error) { setSaving(false); } }}>{saving ? "Adding…" : "Add playbook"}</button>
      </div>
    </Modal>
  );
}

function RegenerationDialog({regeneration, onClose, onRegenerate}) {
  const [saving, setSaving] = useState(false);
  const summary = regeneration.summary;
  return (
    <Modal title="Regenerate campaign announcements" eyebrow="Apply current playbooks" onClose={onClose} size="wide">
      <div className="planner-detail-note">
        <strong>Rolling phase windows</strong>
        <p>Each playbook week becomes a full seven-day window before the event. Fixed weekdays stay fixed, and no generated announcement lands on or after the event date.</p>
      </div>
      <div className="planner-regeneration-metrics">
        <span><strong>{summary.campaigns}</strong> active campaigns</span>
        <span><strong>{summary.added}</strong> added</span>
        <span><strong>{summary.moved}</strong> moved</span>
        <span><strong>{summary.removed}</strong> removed</span>
        <span><strong>{summary.preserved}</strong> protected</span>
        <span className={summary.conflicts ? "has-alert" : ""}><strong>{summary.conflicts}</strong> conflicts</span>
      </div>
      {summary.smugglesCleared > 0 && <div className="planner-detail-note is-smuggle"><strong>{summary.smugglesCleared} Smuggle decision{summary.smugglesCleared === 1 ? "" : "s"} will be cleared</strong><p>Dates and hosts may change during regeneration. The resulting same-day opportunities can be reviewed again from Overview.</p></div>}
      <div className="planner-detail-note"><strong>Operational history stays safe</strong><p>Completed, past, locked, and manually adjusted announcements are preserved. Future automatic announcements removed from a playbook are hidden as skipped history rather than deleted.</p></div>
      <div className="planner-regeneration-list">
        {regeneration.items.map((item) => (
          <div key={item.campaignId}>
            <LevelBadge level={item.level} />
            <span><strong>{item.campaignName}</strong><small>Playbook v{item.fromVersion} → v{item.toVersion}</small></span>
            <small>{item.added} added · {item.moved} moved · {item.removed} removed · {item.preserved} protected</small>
          </div>
        ))}
      </div>
      <div className="planner-modal-actions">
        <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="planner-button is-primary" disabled={saving || summary.campaigns === 0} onClick={async () => {
          setSaving(true);
          try {
            await onRegenerate(regeneration);
            onClose();
          } catch (_error) {
            setSaving(false);
          }
        }}>{saving ? "Regenerating…" : `Regenerate ${summary.campaigns} campaign${summary.campaigns === 1 ? "" : "s"}`}</button>
      </div>
    </Modal>
  );
}

function PlaybooksView({workspace, canEdit, onSave, onDelete, onRegenerate}) {
  const [selectedId, setSelectedId] = useState(workspace.playbooks[0]?.id || "");
  const selected = workspace.playbooks.find((item) => item.id === selectedId) || workspace.playbooks[0];
  const [draft, setDraft] = useState(() => selected ? structuredClone(selected) : null);
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set(selected?.weeks?.[0] ? [selected.weeks[0].weekNumber] : []));
  const [newPlaybookOpen, setNewPlaybookOpen] = useState(false);
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (selected) {
      setDraft(structuredClone(selected));
      setExpandedWeeks(new Set(selected.weeks?.[0] ? [selected.weeks[0].weekNumber] : []));
      setConfirmDelete(false);
    }
  }, [selectedId, selected?.version]);
  const regeneration = useMemo(() => buildCampaignRegeneration({
    campaigns: workspace.campaigns,
    plays: workspace.scheduledPlays,
    playbooks: workspace.playbooks,
    capacityRules: workspace.capacityRules,
    generatedAt: new Date(),
  }), [workspace]);
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
      playType: "New Promotion",
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
        copy="Saving creates a new immutable version. Regenerate active campaigns when you are ready to apply the latest playbooks and scheduling rules."
        actions={canEdit && <div className="planner-heading-action-group"><button className="planner-button is-secondary" onClick={() => setRegenerationOpen(true)}>↻ Regenerate campaigns</button><button className="planner-button is-secondary" onClick={() => setNewPlaybookOpen(true)}>＋ New playbook</button><button className="planner-button is-primary" onClick={() => onSave(draft)}>Save as version {Number(draft.version || 0) + 1}</button></div>}
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
                  <span className="planner-week-toggle-summary"><strong>{week.label || "Untitled week"}</strong><small>{week.plays.length} promotion{week.plays.length === 1 ? "" : "s"}</small></span>
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
                          <input aria-label="Promotion type" value={item.playType} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "playType", event.target.value)} />
                          <input aria-label="Channel" value={item.channel} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "channel", event.target.value)} />
                          <select aria-label="Requirement" value={item.requirement} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "requirement", event.target.value)}><option value="required">Required</option><option value="optional">Optional</option><option value="as-available">As available</option></select>
                          <select aria-label="Late behavior" value={item.lateBehavior} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "lateBehavior", event.target.value)}><option value="SKIP">Skip</option><option value="NEXT_AVAILABLE_SLOT">Next slot</option><option value="NEXT_OCCURRENCE">Next occurrence</option><option value="MANUAL_REVIEW">Manual review</option></select>
                          <label className="planner-check" title="Allow smaller, lower-level promotions to be included inside this announcement"><input type="checkbox" checked={item.supportsSmuggle === true} disabled={!canEdit} onChange={(event) => updateWeekPlay(weekIndex, playIndex, "supportsSmuggle", event.target.checked)} /><span>Can host Smuggle</span></label>
                          {canEdit && <button className="planner-remove-button" onClick={() => removePlay(weekIndex, playIndex)} aria-label={`Remove ${item.playType}`}>×</button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && <button className="planner-text-button" onClick={() => addPlay(weekIndex)}>＋ Add promotion</button>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
      {newPlaybookOpen && <NewPlaybookDialog onClose={() => setNewPlaybookOpen(false)} onCreate={async (playbook) => { const saved = await onSave(playbook); setSelectedId(saved.id); setNewPlaybookOpen(false); }} />}
      {regenerationOpen && <RegenerationDialog regeneration={regeneration} onClose={() => setRegenerationOpen(false)} onRegenerate={onRegenerate} />}
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

function MarkdownInline({tokens}) {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}-${token.text}`;
    if (token.type === "strong") return <strong key={key}>{token.text}</strong>;
    if (token.type === "emphasis") return <em key={key}>{token.text}</em>;
    if (token.type === "code") return <code key={key}>{token.text}</code>;
    return <React.Fragment key={key}>{token.text}</React.Fragment>;
  });
}

function PlannerMarkdown({value}) {
  const blocks = parseBriefMarkdown(value);
  return <div className="planner-markdown">{blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "heading") {
      const Heading = `h${Math.min(6, block.level + 3)}`;
      return <Heading key={key}><MarkdownInline tokens={block.content} /></Heading>;
    }
    if (block.type === "paragraph") {
      return <p key={key}>{block.lines.map((line, lineIndex) => <React.Fragment key={`${key}-${lineIndex}`}><MarkdownInline tokens={line} />{lineIndex < block.lines.length - 1 && <br />}</React.Fragment>)}</p>;
    }
    const List = block.type === "ordered-list" ? "ol" : "ul";
    return <List key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}><MarkdownInline tokens={item} /></li>)}</List>;
  })}</div>;
}

function MarkdownTextEditor({value, onChange, placeholder = "", rows = 6}) {
  const textareaRef = useRef(null);
  const replaceSelection = (prefix, suffix = prefix, fallback = "text") => {
    const textarea = textareaRef.current;
    const current = String(value || "");
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const selected = current.slice(start, end) || fallback;
    onChange(`${current.slice(0, start)}${prefix}${selected}${suffix}${current.slice(end)}`);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };
  const prefixLines = (prefix) => {
    const textarea = textareaRef.current;
    const current = String(value || "");
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const lineStart = current.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const selection = current.slice(lineStart, end) || "Item";
    const replacement = selection.split("\n").map((line) => `${prefix}${line}`).join("\n");
    onChange(`${current.slice(0, lineStart)}${replacement}${current.slice(end)}`);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };
  return <div className="planner-markdown-editor">
    <div className="planner-markdown-toolbar" aria-label="Text formatting">
      <button type="button" aria-label="Bold" onClick={() => replaceSelection("**")} title="Bold"><strong>B</strong></button>
      <button type="button" aria-label="Italic" onClick={() => replaceSelection("*")} title="Italic"><em>I</em></button>
      <button type="button" aria-label="Heading" onClick={() => prefixLines("## ")} title="Heading">Heading</button>
      <button type="button" aria-label="Bulleted list" onClick={() => prefixLines("- ")} title="Bulleted list">List</button>
    </div>
    <textarea ref={textareaRef} value={value || ""} rows={rows} maxLength={3000} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </div>;
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

function SmuggleSelectionDialog({candidate, onClose, onChoose, onSkip}) {
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal title={`Place ${candidate.beneficiaryName}`} eyebrow="Choose the host event" onClose={onClose} size="wide">
      <div className="planner-smuggle-explainer">
        <LevelBadge level={candidate.beneficiaryLevel} />
        <div><strong>Place the Level {candidate.beneficiaryLevel} {candidate.beneficiaryPlayType} for {candidate.beneficiaryName}.</strong><p>Only compatible Level 1–3 announcements already planned for {formatDate(candidate.scheduledDate)} are shown. The lower-level announcement will appear inside the host instead of as a separate item.</p></div>
      </div>
      <div className="planner-smuggle-options">
        {candidate.options.map((option) => (
          <article className="planner-smuggle-option" key={option.id}>
            <div className="planner-smuggle-option-heading">
              <LevelBadge level={option.hostCampaignLevel} />
              <span><strong>{option.hostCampaignName}</strong><small>{option.hostPlayType} · {option.hostChannel || "Channel not set"}</small></span>
              <time dateTime={option.scheduledDate}>{formatDate(option.scheduledDate)}</time>
            </div>
            <p>This {option.hostPlayType} will contain the Level {candidate.beneficiaryLevel} announcement on the same date.</p>
            <button className="planner-button is-primary" disabled={Boolean(savingId)} onClick={async () => {
              setSavingId(option.id); setError("");
              try {
                await onChoose(option);
              } catch (saveError) {
                setError(saveError.message || "This Smuggle choice could not be saved.");
                setSavingId("");
              }
            }}>{savingId === option.id ? "Saving…" : `Use ${option.hostCampaignName}`}</button>
          </article>
        ))}
      </div>
      <div className="planner-smuggle-decline">
        <div>
          <strong>Do not run this announcement</strong>
          <p>Remove the {candidate.beneficiaryPlayType} on {formatDate(candidate.scheduledDate)} from the plan. Other promotions for {candidate.beneficiaryName} will stay scheduled, and this conflict will be resolved.</p>
        </div>
        <button className="planner-button is-secondary" disabled={Boolean(savingId)} onClick={async () => {
          setSavingId("skip"); setError("");
          try {
            await onSkip();
          } catch (saveError) {
            setError(saveError.message || "This decision could not be saved.");
            setSavingId("");
          }
        }}>{savingId === "skip" ? "Saving…" : "Do not announce"}</button>
      </div>
      {error && <div className="planner-detail-note is-alert"><strong>Decision not saved</strong><p>{error}</p></div>}
      <div className="planner-modal-actions"><button className="planner-button is-secondary" disabled={Boolean(savingId)} onClick={onClose}>Cancel</button></div>
    </Modal>
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
    eventDetails: "",
    sampleAnnouncement: "",
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
    const plannedPlays = visiblePromotions(ownPlays);
    return {...generated, plays: ownPlays, plannedPlays, summary: scheduleSummary(ownPlays), conflicts: [...level4.conflicts, ...capacity.conflicts].filter((item) => item.overflowPlayIds.some((playId) => ownPlays.some((play) => play.id === playId)))};
  }, [form, playbook, workspace]);
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  return (
    <Modal title="Build a new campaign" eyebrow="Promotion preview" onClose={onClose} size="wide">
      <div className="planner-campaign-builder">
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="planner-form-grid">
            <Field label="Campaign / Event name" wide><input autoFocus required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Women's Breakfast" /></Field>
            <Field label="Event date"><input type="date" required value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} /></Field>
            <Field label="Registration deadline"><input type="date" value={form.registrationDeadline} max={form.eventDate} onChange={(event) => update("registrationDeadline", event.target.value)} /></Field>
            <Field label="Original request received"><input type="datetime-local" required value={form.submittedAt} onChange={(event) => update("submittedAt", event.target.value)} /></Field>
            <Field label="Promotion playbook"><select value={form.playbookId} onChange={(event) => update("playbookId", event.target.value)}>{campaignPlaybooks.map((item) => <option key={item.id} value={item.id}>Level {item.level} · {item.name}</option>)}</select></Field>
            <Field label="Source Event ID"><input value={form.sourceEventId} onChange={(event) => update("sourceEventId", event.target.value)} placeholder="Optional Central / PCO event ID" /></Field>
            <Field label="Event details" wide help="Optional brief-ready copy. Supports headings, lists, bold, italics, and line breaks."><MarkdownTextEditor value={form.eventDetails} onChange={(value) => update("eventDetails", value)} placeholder="What should the team know about this event?" /></Field>
            <Field label="Sample announcement" wide help="Optional example wording for stage, email, or social teams."><MarkdownTextEditor value={form.sampleAnnouncement} onChange={(value) => update("sampleAnnouncement", value)} placeholder="Join us for **Women’s Breakfast**…" /></Field>
            <Field label="Notes" wide><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Context Creative should keep with this campaign." /></Field>
          </div>
        </form>
        <section className="planner-schedule-preview">
          {!preview ? <EmptyState title="Ready for the details" copy="Name the campaign and choose an event date to preview its promotion plan." /> : (
            <>
              <div className={`planner-timeliness-card ${preview.campaign.isOnTime ? "is-on-time" : "is-late"}`}>
                <div><span className="planner-kicker">{preview.campaign.durationWeeks}-week campaign</span><h3>Planning window</h3></div>
                <dl><div><dt>Recommended start</dt><dd>{formatDate(preview.campaign.recommendedStartDate)}</dd></div><div><dt>Event</dt><dd>{formatDate(preview.campaign.eventDate)}</dd></div><div><dt>Request received</dt><dd>{formatDate(preview.campaign.submittedDate)}</dd></div></dl>
                {preview.summary.missed > 0 && <p>{preview.summary.missed} promotion{preview.summary.missed === 1 ? "" : "s"} in the playbook already passed and will not be added to the plan.</p>}
              </div>
              <div className="planner-preview-metrics">
                <span><strong>{preview.plannedPlays.length}</strong> promotions</span><span><strong>{preview.summary.conflicts}</strong> conflicts</span>
              </div>
              <div className="planner-preview-list">
                {preview.plannedPlays.map((play) => <PlayRow key={play.id} play={play} onClick={() => {}} />)}
              </div>
              <div className="planner-modal-actions">
                <button className="planner-button is-secondary" onClick={onClose}>Cancel</button>
                <button className="planner-button is-primary" onClick={() => onGenerate(preview.campaign, preview.plannedPlays)}>Add {preview.plannedPlays.length} promotions</button>
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}

function PlayDialog({play, campaign, smuggleRelationship, canEdit, onClose, onSave, onCancelSmuggle}) {
  const [draft, setDraft] = useState({...play});
  const [cancellingSmuggle, setCancellingSmuggle] = useState(false);
  const [smuggleError, setSmuggleError] = useState("");
  return (
    <Modal title={play.playType} eyebrow="Promotion" onClose={onClose}>
      <div className="planner-detail-hero"><PromotionKindBadge item={play} /><div><h3>{play.campaignName}</h3><p>{play.channel}{!isStandaloneContent(play) ? ` · Week ${play.weekNumber} · ${play.phase}` : ""}</p></div>{needsPromotionReview(draft) && <StatusBadge status="conflict">{draft.status === "conflict" ? "Conflict" : "Review"}</StatusBadge>}</div>
      <dl className="planner-detail-list"><div><dt>Planned date</dt><dd>{formatDate(draft.scheduledDate)}</dd></div>{!isStandaloneContent(play) && <div><dt>Playbook</dt><dd>{play.playbookId} · v{play.playbookVersion}</dd></div>}</dl>
      {play.lateReason && <div className="planner-detail-note"><strong>Late handling</strong><p>{play.lateReason}</p></div>}
      {play.conflictReason && <div className="planner-detail-note is-alert"><strong>Conflict</strong><p>{play.conflictReason}</p></div>}
      {smuggleRelationship && <div className="planner-detail-note is-smuggle">
        <div className="planner-smuggle-note-heading"><strong>Smuggle host</strong>{canEdit && <button className="planner-text-button" disabled={cancellingSmuggle} onClick={async () => {
          setCancellingSmuggle(true); setSmuggleError("");
          try { await onCancelSmuggle(smuggleRelationship); }
          catch (cancelError) { setSmuggleError(cancelError.message || "The Smuggle could not be cancelled."); setCancellingSmuggle(false); }
        }}>{cancellingSmuggle ? "Cancelling…" : "Cancel Smuggle"}</button>}</div>
        <p>This Level {smuggleRelationship.hostCampaignLevel} {smuggleRelationship.hostCampaignName} promotion contains Level {smuggleRelationship.beneficiaryLevel} {smuggleRelationship.beneficiaryName}.</p>
        <small>Cancelling returns the lower-level announcement to the normal plan so it can run separately, be placed in another host, or be skipped.</small>
        {smuggleError && <p className="planner-inline-error">{smuggleError}</p>}
      </div>}
      {canEdit && (
        <div className="planner-form-grid planner-play-adjustment">
          <Field label="Move promotion"><input type="date" value={draft.scheduledDate} max={campaignDeadline(campaign) || undefined} onChange={(event) => setDraft({...draft, scheduledDate: event.target.value, status: "rescheduled", conflictState: "none", conflictReason: "", manuallyAdjusted: true})} /></Field>
        </div>
      )}
      <div className="planner-modal-actions"><button className="planner-button is-secondary" onClick={onClose}>Close</button>{canEdit && <button className="planner-button is-primary" onClick={() => onSave(draft)}>Save promotion</button>}</div>
    </Modal>
  );
}

function CampaignBriefContentDialog({campaign, onClose, onSave}) {
  const [draft, setDraft] = useState({
    eventDetails: campaign.eventDetails || "",
    sampleAnnouncement: campaign.sampleAnnouncement || "",
  });
  const [saving, setSaving] = useState(false);
  return <Modal title="Edit weekly brief content" eyebrow={campaign.name} onClose={onClose} size="wide">
    <div className="planner-form-grid">
      <Field label="Event details" wide help="Use brief-ready wording. Supports headings, lists, bold, italics, and line breaks."><MarkdownTextEditor value={draft.eventDetails} onChange={(value) => setDraft((current) => ({...current, eventDetails: value}))} placeholder="Key event details, audience, location, or next step." /></Field>
      <Field label="Sample announcement" wide help="Add optional example wording the communication team can adapt."><MarkdownTextEditor value={draft.sampleAnnouncement} onChange={(value) => setDraft((current) => ({...current, sampleAnnouncement: value}))} placeholder="Join us for **Event Name**…" /></Field>
    </div>
    {(draft.eventDetails || draft.sampleAnnouncement) && <div className="planner-brief-content-preview">
      <span className="planner-kicker">Formatting preview</span>
      {draft.eventDetails && <section><strong>Event details</strong><PlannerMarkdown value={draft.eventDetails} /></section>}
      {draft.sampleAnnouncement && <section><strong>Sample announcement</strong><PlannerMarkdown value={draft.sampleAnnouncement} /></section>}
    </div>}
    <div className="planner-modal-actions">
      <button className="planner-button is-secondary" disabled={saving} onClick={onClose}>Cancel</button>
      <button className="planner-button is-primary" disabled={saving} onClick={async () => {
        setSaving(true);
        try { await onSave({...campaign, ...draft}); }
        catch (_error) { setSaving(false); }
      }}>{saving ? "Saving…" : "Save brief content"}</button>
    </div>
  </Modal>;
}

function CampaignDialog({campaign, workspace, canEdit, onClose, onOpenPlay, onEditContent, onEditBriefContent, onDelete, onCancelSmuggle}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingSmuggleId, setCancellingSmuggleId] = useState("");
  const smuggleRelationships = buildSmuggleRelationships({plays: workspace.scheduledPlays, campaigns: workspace.campaigns});
  const smuggledPlayIds = new Set(smuggleRelationships.map((relationship) => relationship.beneficiaryPlayId).filter(Boolean));
  const campaignPlays = workspace.scheduledPlays.filter((play) => play.campaignId === campaign.id);
  const intentionallySkipped = campaignPlays.filter((play) =>
    play.status === "skipped" && play.manuallyAdjusted === true,
  ).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  const plays = visiblePromotions(campaignPlays.filter((play) =>
    !smuggledPlayIds.has(play.id),
  )).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  const standalone = isStandaloneContent(campaign);
  const series = standalone ? contentSeriesDetails(plays) : null;
  const seriesSchedule = series?.firstDate === series?.lastDate
    ? formatDate(series?.firstDate)
    : `${formatDate(series?.firstDate, {year: false})}–${formatDate(series?.lastDate)}`;
  const hostedByPlay = new Map(smuggleRelationships.map((relationship) => [relationship.hostPlayId, relationship]));
  const guestRelationships = smuggleRelationships.filter((relationship) => relationship.beneficiaryCampaignId === campaign.id);
  const summary = scheduleSummary(plays);
  return (
    <Modal title={campaign.name} eyebrow={standalone ? "Content" : `Level ${campaign.level} campaign`} onClose={onClose} size="wide">
      <div className="planner-campaign-detail-summary">
        <div><span>{standalone ? "Schedule" : "Event date"}</span><strong>{standalone ? seriesSchedule : formatDate(campaign.eventDate)}</strong></div>{standalone ? <><div><span>Repeat</span><strong>{series?.label || "One time"}</strong></div><div><span>Content type</span><strong>{plays[0]?.playType || "Content"}</strong></div><div><span>Channel</span><strong>{plays[0]?.channel || "Not set"}</strong></div></> : <><div><span>Playbook</span><strong>{workspace.playbooks.find((item) => item.id === campaign.playbookId)?.name || campaign.playbookId} · v{campaign.playbookVersion}</strong></div><div><span>Recommended start</span><strong>{formatDate(campaign.recommendedStartDate)}</strong></div></>}
      </div>
      <div className="planner-preview-metrics"><span><strong>{summary.total}</strong> {standalone ? "occurrences" : "promotions"}</span>{!standalone && <span><strong>{summary.conflicts}</strong> conflicts</span>}{intentionallySkipped.length > 0 && <span><strong>{intentionallySkipped.length}</strong> not running</span>}</div>
      {campaign.eventDetails && <div className="planner-detail-note planner-campaign-brief-copy"><strong>Event details</strong><PlannerMarkdown value={campaign.eventDetails} /></div>}
      {campaign.sampleAnnouncement && <div className="planner-detail-note planner-campaign-brief-copy"><strong>Sample announcement</strong><PlannerMarkdown value={campaign.sampleAnnouncement} /></div>}
      {campaign.notes && <div className="planner-detail-note"><strong>Notes</strong><p>{campaign.notes}</p></div>}
      {guestRelationships.map((relationship) => <div className="planner-detail-note is-smuggle" key={relationship.id}>
        <div className="planner-smuggle-note-heading"><strong>{relationship.beneficiaryPlayType} smuggled into Level {relationship.hostCampaignLevel} {relationship.hostCampaignName}</strong>{canEdit && <button className="planner-text-button" disabled={Boolean(cancellingSmuggleId)} onClick={async () => {
          setCancellingSmuggleId(relationship.id);
          try { await onCancelSmuggle(relationship); }
          catch (_error) { setCancellingSmuggleId(""); }
        }}>{cancellingSmuggleId === relationship.id ? "Cancelling…" : "Cancel Smuggle"}</button>}</div>
        <p>{formatDate(relationship.scheduledDate)} · The announcement appears inside that higher-level {relationship.hostPlayType} instead of separately.</p>
        <small>Cancelling restores this announcement to the normal plan and makes other Smuggle hosts available again.</small>
      </div>)}
      {intentionallySkipped.map((play) => <div className="planner-detail-note is-skipped" key={play.id}><strong>{play.playType} will not run</strong><p>{formatDate(play.scheduledDate)} · This decision removes the announcement from the calendar, capacity totals, and reports.</p></div>)}
      <div className="planner-campaign-play-list">{plays.map((play) => <PlayRow key={play.id} play={play} showDate={standalone && plays.length > 1} smuggleRelationship={hostedByPlay.get(play.id)} onClick={() => onOpenPlay(play)} />)}</div>
      {confirmDelete && (
        <div className="planner-delete-confirmation" role="alert">
          <div><strong>Delete this {standalone ? plays.length > 1 ? `content series and all ${plays.length} occurrences` : "content item" : `campaign and all ${plays.length} promotion${plays.length === 1 ? "" : "s"}`}?</strong><p>This cannot be undone and removes it from every Planner view.</p></div>
          <div><button className="planner-button is-secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep {standalone ? "content" : "campaign"}</button><button className="planner-button is-danger" disabled={deleting} onClick={async () => { setDeleting(true); try { await onDelete(campaign); } catch (_error) { /* PlannerApp displays the save error. */ } finally { setDeleting(false); } }}>{deleting ? "Deleting…" : "Delete permanently"}</button></div>
        </div>
      )}
      <div className="planner-modal-actions">
        {canEdit && !confirmDelete && <button className="planner-button is-danger is-quiet" onClick={() => setConfirmDelete(true)}>Delete {standalone ? "content" : "campaign"}</button>}
        {canEdit && !standalone && !confirmDelete && <button className="planner-button is-secondary" onClick={() => onEditBriefContent(campaign)}>Edit brief content</button>}
        {canEdit && standalone && !confirmDelete && <button className="planner-button is-primary" onClick={() => onEditContent(campaign)}>Edit content</button>}
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
  const [newContentOpen, setNewContentOpen] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [editingBriefContent, setEditingBriefContent] = useState(null);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const store = useMemo(() => createPlannerStore({
    firestore: authState.firestore,
    user: authState.user,
    preview: authState.preview,
  }), [authState.firestore, authState.user?.uid, authState.preview]);
  const canEdit = EDIT_PERMISSIONS.has(authState.permission);
  const canEmail = ["approve", "admin"].includes(authState.permission);
  const smuggleRelationships = workspace ? buildSmuggleRelationships({
    plays: workspace.scheduledPlays,
    campaigns: workspace.campaigns,
  }) : [];
  const smuggleByHostPlay = new Map(smuggleRelationships.map((relationship) => [relationship.hostPlayId, relationship]));

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
    return <main className="planner-loading"><Brand /><span className="planner-loader" /><p>{error || "Loading playbooks, campaigns, and promotions."}</p></main>;
  }

  const updatePlay = async (play, success = "Promotion updated.") => {
    const campaign = workspace.campaigns.find((item) => item.id === play.campaignId);
    const deadline = campaignDeadline(campaign);
    if (deadline && play.scheduledDate > deadline) {
      setError(`This promotion cannot be planned after ${formatDate(deadline)}.`);
      throw new Error("A promotion cannot be planned after its campaign deadline.");
    }
    const saved = await perform(() => store.saveScheduledPlay(play), success);
    setWorkspace((current) => ({...current, scheduledPlays: current.scheduledPlays.map((item) => item.id === saved.id ? saved : item)}));
    setSelectedPlay(null);
    return saved;
  };

  const deleteCampaign = async (campaign) => {
    const result = await perform(() => store.deleteCampaign(campaign.id), `${campaign.name} was deleted from the Planner.`);
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.filter((item) => item.id !== campaign.id),
      scheduledPlays: current.scheduledPlays.filter((item) => item.campaignId !== campaign.id),
    }));
    setSelectedCampaign(null);
    return result;
  };

  const saveCampaignBriefContent = async (campaign) => {
    const saved = await perform(
      () => store.saveCampaignDetails(campaign),
      `${campaign.name} brief content was updated.`,
    );
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) => item.id === saved.id ? saved : item),
    }));
    setEditingBriefContent(null);
    return saved;
  };

  const useSmuggle = async (opportunity) => {
    const host = workspace.scheduledPlays.find((play) => play.id === opportunity.hostScheduledPlayId);
    if (!host) return;
    await updatePlay(applySmuggle(host, opportunity), `${opportunity.beneficiaryName} is now intentionally included as a Smuggle promotion.`);
  };

  const removeSmuggle = async (relationship) => {
    const host = workspace.scheduledPlays.find((play) => play.id === relationship.hostPlayId);
    if (!host) throw new Error("The Smuggle host announcement could not be found.");
    return updatePlay(
      cancelSmuggle(host),
      `${relationship.beneficiaryName} was removed from the ${relationship.hostCampaignName} Smuggle. Its announcement is back in the normal plan.`,
    );
  };

  const skipSmuggle = async (candidate) => {
    const beneficiary = workspace.scheduledPlays.find((play) => play.id === candidate.beneficiaryScheduledPlayId);
    if (!beneficiary) throw new Error("The announcement to remove could not be found.");
    await updatePlay(skipPromotion(beneficiary), `${beneficiary.campaignName} will not receive a ${beneficiary.playType} on ${formatDate(beneficiary.scheduledDate)}.`);
  };

  let content = null;
  if (activeView === "calendar") content = <CalendarView workspace={workspace} canEdit={canEdit} onOpenCampaign={setSelectedCampaign} onOpenPlay={setSelectedPlay} onMovePlay={(play, scheduledDate) => updatePlay({...play, scheduledDate, status: "rescheduled", conflictState: "none", conflictReason: "", manuallyAdjusted: true}, "Promotion moved.")} />;
  else if (activeView === "requests") content = <RequestsView workspace={workspace} canEdit={canEdit} onOpenRequest={setSelectedRequest} />;
  else if (activeView === "campaigns") content = <CampaignsView workspace={workspace} canEdit={canEdit} onNewCampaign={() => setNewCampaignOpen(true)} onOpenCampaign={setSelectedCampaign} />;
  else if (activeView === "content") content = <ContentView workspace={workspace} canEdit={canEdit} onNewContent={() => setNewContentOpen(true)} onOpenContent={setSelectedCampaign} />;
  else if (activeView === "reports") content = <ReportsView workspace={workspace} authState={authState} canEdit={canEdit} canEmail={canEmail} onEditBriefContent={setEditingBriefContent} onNotice={(nextMessage) => { setMessage(nextMessage); window.setTimeout(() => setMessage(""), 4000); }} onError={(nextError) => setError(nextError)} />;
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
  }} onRegenerate={async (regeneration) => {
    const result = await perform(
      () => store.regenerateCampaignSchedules(regeneration),
      `${regeneration.summary.campaigns} campaign${regeneration.summary.campaigns === 1 ? "" : "s"} regenerated from the current playbooks.`,
    );
    const campaignIds = new Set(result.campaigns.map((campaign) => campaign.id));
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        result.campaigns.find((item) => item.id === campaign.id) || campaign,
      ),
      scheduledPlays: [
        ...current.scheduledPlays.filter((play) => !campaignIds.has(play.campaignId)),
        ...result.plays,
      ],
    }));
    return result;
  }} />;
  else if (activeView === "rules") content = <RulesView workspace={workspace} canEdit={canEdit} onSaveRule={async (rule) => {
    const saved = await perform(() => store.saveCapacityRule(rule), `${rule.name} capacity rule saved.`);
    setWorkspace((current) => ({...current, capacityRules: current.capacityRules.map((item) => item.id === saved.id ? saved : item)}));
  }} onSaveLane={async (lane) => {
    const saved = await perform(() => store.saveStandingLane(lane), `${lane.name} standing lane saved.`);
    setWorkspace((current) => ({...current, standingLanes: current.standingLanes.map((item) => item.id === saved.id ? saved : item)}));
  }} />;
  else content = <Overview workspace={workspace} canEdit={canEdit} onNewCampaign={() => setNewCampaignOpen(true)} onOpenPlay={setSelectedPlay} onSavePlay={updatePlay} onUseSmuggle={useSmuggle} onSkipSmuggle={skipSmuggle} />;

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
        const result = await perform(() => store.saveCampaignSchedule(campaign, plays), `${campaign.name} added with ${plays.length} promotion${plays.length === 1 ? "" : "s"}.`);
        setWorkspace((current) => ({...current, campaigns: [result.campaign, ...current.campaigns], scheduledPlays: [...current.scheduledPlays, ...result.plays]}));
        setNewCampaignOpen(false); setActiveView("campaigns");
      }} />}
      {newContentOpen && <ContentDialog onClose={() => setNewContentOpen(false)} onSave={async ({campaign, plays}) => {
        const result = await perform(() => store.saveCampaignSchedule(campaign, plays), `${campaign.name} added to the content plan.`);
        setWorkspace((current) => ({...current, campaigns: [result.campaign, ...current.campaigns], scheduledPlays: [...current.scheduledPlays, ...result.plays]}));
        setNewContentOpen(false); setActiveView("content");
      }} />}
      {editingContent && <ContentDialog campaign={editingContent} plays={workspace.scheduledPlays.filter((play) => play.campaignId === editingContent.id)} onClose={() => setEditingContent(null)} onSave={async ({campaign, plays}) => {
        const result = await perform(() => store.saveCampaignSchedule(campaign, plays), `${campaign.name} was updated.`);
        setWorkspace((current) => ({
          ...current,
          campaigns: current.campaigns.map((item) => item.id === result.campaign.id ? result.campaign : item),
          scheduledPlays: [...current.scheduledPlays.filter((item) => item.campaignId !== result.campaign.id), ...result.plays],
        }));
        setEditingContent(null); setActiveView("content");
      }} />}
      {selectedPlay && <PlayDialog play={selectedPlay} campaign={workspace.campaigns.find((item) => item.id === selectedPlay.campaignId)} smuggleRelationship={smuggleByHostPlay.get(selectedPlay.id)} canEdit={canEdit} onClose={() => setSelectedPlay(null)} onSave={updatePlay} onCancelSmuggle={removeSmuggle} />}
      {selectedCampaign && <CampaignDialog campaign={selectedCampaign} workspace={workspace} canEdit={canEdit} onClose={() => setSelectedCampaign(null)} onOpenPlay={(play) => { setSelectedCampaign(null); setSelectedPlay(play); }} onEditContent={(campaign) => { setSelectedCampaign(null); setEditingContent(campaign); }} onEditBriefContent={(campaign) => { setSelectedCampaign(null); setEditingBriefContent(campaign); }} onDelete={deleteCampaign} onCancelSmuggle={removeSmuggle} />}
      {editingBriefContent && <CampaignBriefContentDialog campaign={editingBriefContent} onClose={() => setEditingBriefContent(null)} onSave={saveCampaignBriefContent} />}
      {selectedRequest && <RequestReviewDialog request={selectedRequest} workspace={workspace} canEdit={canEdit} onClose={() => setSelectedRequest(null)} onConvert={async (request, campaign, plays, eventDate) => {
        const dateWasChanged = eventDate !== request.eventDate || ["needs-review", "manual-required"].includes(request.dateParseStatus);
        const {result, savedRequest, updates} = await perform(async () => {
          const updates = {
            proposedName: campaign.name,
            eventDate,
            eventDates: dateWasChanged ? [eventDate] : request.eventDates?.length ? request.eventDates : [eventDate],
            eventDateEnd: dateWasChanged ? "" : request.eventDateEnd || "",
            dateParseStatus: dateWasChanged ? "manual" : request.dateParseStatus || "parsed",
            dateParseKind: dateWasChanged ? "single" : request.dateParseKind || "single",
            dateSource: dateWasChanged ? "manual-review" : request.dateSource || "form-parser",
            status: "converted",
            campaignId: campaign.id,
          };
          const result = await store.convertPromotionRequest(
            request.id,
            campaign,
            plays,
            updates,
          );
          const savedRequest = result.request;
          return {result, savedRequest, updates};
        }, `${campaign.name} was created from the Planning Center request.`);
        setWorkspace((current) => ({
          ...current,
          campaigns: [result.campaign, ...current.campaigns.filter((item) => item.id !== result.campaign.id)],
          scheduledPlays: [...current.scheduledPlays.filter((item) => item.campaignId !== result.campaign.id), ...result.plays],
          promotionRequests: current.promotionRequests.map((item) => item.id === request.id ? {...item, ...savedRequest, ...updates} : item),
        }));
        setSelectedRequest(null);
        setActiveView("campaigns");
      }} onDismiss={async (request) => {
        const savedRequest = await perform(() => store.updatePromotionRequest(request.id, {status: "dismissed", campaignId: ""}), `${request.proposedName || "The request"} was dismissed.`);
        setWorkspace((current) => ({...current, promotionRequests: current.promotionRequests.map((item) => item.id === request.id ? {...item, ...savedRequest, status: "dismissed", campaignId: ""} : item)}));
        setSelectedRequest(null);
      }} />}
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
