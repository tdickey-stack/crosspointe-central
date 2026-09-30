import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { addDays, daysBetween, generateSchedule, summarizeEvent, weeklyCongestion, validateTemplate, validateEvent, createId, WORK_STAGES, DEMAND_LEVELS } from "./domain.js";
import { STARTER_TEMPLATES, createDemoEvents } from "./seed-data.js";
import { createAnnualStore } from "./persistence.js";
import { buildTimelineLayout } from "./timeline-layout.js";
import "./annual-planner.css";
const params = new URLSearchParams(location.search);
const PRESENTER = params.get("presenter") === "1";
const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
const LEVELS = [1, 2, 3, 4, 5];
const EDIT = /* @__PURE__ */ new Set(["propose", "edit", "approve", "admin"]);
const ALLOWED = /* @__PURE__ */ new Set(["view", ...EDIT]);
const COLORS = { 1: "#ef3e2d", 2: "#f59e0b", 3: "#4bb8e9", 4: "#4bc3a7", 5: "#a78bfa" };
const clone = (value) => JSON.parse(JSON.stringify(value));
const timeUnits = (days) => days !== 0 && days % 7 === 0 ? `${days / 7}w` : `${days}d`;
const fmt = (value) => (/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = (value) => (/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const restEvent = (e) => e.templateSnapshot.phases.every((p) => p.kind === "rest");
const overlaps = (a, b) => a.startDate <= b.endDate && b.startDate <= a.endDate;
const isWorkPhase = phase => ['preparation', 'active'].includes(phase.kind);
const profileLabel = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unclassified';
const phaseProfileText = phase => `${profileLabel(phase.workStage)} · ${profileLabel(phase.demand)} demand`;
const phaseDemandClass = phase => isWorkPhase(phase) ? `demand-${phase.demand || 'unclassified'}` : '';
function changeProfile(phase, key, value) {
  const result = {...phase};
  if (value) result[key] = value;
  else delete result[key];
  return result;
}
function changePhaseKind(phase, kind) {
  const result = {...phase, kind};
  if (!isWorkPhase(result)) { delete result.workStage; delete result.demand; }
  return result;
}
function StageMark({phase, expanded = false}) {
  if (!isWorkPhase(phase)) return null;
  const stage = phase.workStage;
  const abbreviation = {ideation:'I',activation:'A',implementation:'M'}[stage] || '?';
  return <span className={`ap-stage-mark ${stage ? '' : 'unclassified'}`} aria-label={`${profileLabel(stage)} work stage`} title={`${profileLabel(stage)} work stage`}>{expanded && stage ? profileLabel(stage) : abbreviation}</span>;
}
function DemandMark({phase}) {
  if (!isWorkPhase(phase)) return null;
  const ticks = phase.demand === 'high' ? '▮▮▮' : phase.demand === 'moderate' ? '▮▮' : phase.demand === 'light' ? '▮' : '?';
  return <span className={`ap-demand-mark ${phaseDemandClass(phase)}`} aria-label={`${profileLabel(phase.demand)} demand`} title={phaseProfileText(phase)}>{ticks}</span>;
}
function ProfileFields({phase, onChange, disabled = false}) {
  if (!isWorkPhase(phase)) return null;
  return <div className="ap-profile-fields">
    <Field label="Work stage"><select aria-label={`${phase.name} work stage`} value={phase.workStage || ''} disabled={disabled} onChange={event=>onChange(changeProfile(phase,'workStage',event.target.value))}><option value="">Unclassified</option>{WORK_STAGES.map(value=><option value={value} key={value}>{profileLabel(value)}</option>)}</select></Field>
    <Field label="Demand"><select aria-label={`${phase.name} demand`} value={phase.demand || ''} disabled={disabled} onChange={event=>onChange(changeProfile(phase,'demand',event.target.value))}><option value="">Unclassified</option>{DEMAND_LEVELS.map(value=><option value={value} key={value}>{profileLabel(value)}</option>)}</select></Field>
  </div>;
}
function pressureDescription(week) {
  const pressure = week.pressure;
  if (!pressure) return 'Work demand has not been classified for this week.';
  if (!pressure.phases?.length || !pressure.date) return 'No Level 1–2 work is scheduled this week.';
  const descriptions = pressure.phases.map(phase=>`${phase.eventName} — ${phase.name} (${phaseProfileText(phase)})`);
  const evidence = descriptions.length > 1 ? descriptions.join(' overlaps ') : descriptions[0] || 'No all-staff work';
  return `${evidence} on ${fullDate(pressure.date)}.`;
}
function DemandGuide() {
  return <div className="ap-demand-guide"><div className="ap-stage-key" aria-label="Work stage legend"><span>Work stage</span><span><b>I</b> Ideation</span><span><b>A</b> Activation</span><span><b>M</b> Implementation</span><span><b>?</b> Unclassified</span></div><div className="ap-demand-key" aria-label="Phase demand legend"><span>Demand</span><span><b>?</b> Unclassified</span><span><b>▮</b> Light</span><span><b>▮▮</b> Moderate</span><span><b>▮▮▮</b> High</span></div><details><summary>Work stages & overlap signals</summary><p><b>Ideation</b> shapes the idea. <b>Activation</b> turns it into a plan and brings people on board. <b>Implementation</b> carries the work through. Each phase keeps its own meaningful name.</p><p>Demand describes the phase, separately from its stage or event priority. It does not assign individual or team workload, hours, or percentages.</p><p><b>Review:</b> high + light, or two moderate events. <b>Strong:</b> high + moderate, two high events, or three moderate events. Light-only overlap stays clear. An event counts once at its highest active demand. Weeks with unclassified work use the saved event-count thresholds.</p></details></div>;
}
function scheduleIdsFor(template) {
  const ids = new Set(template.phases.map(phase=>phase.id));
  const hasWork = template.phases.some(phase=>isWorkPhase(phase)||phase.kind==='milestone');
  if (hasWork) {
    for(let index=1;index<=template.meetingCount;index++) ids.add(`meeting-${index}`);
    if(template.recoveryDays) ids.add('recovery');
  }
  return ids;
}
function permission(data) {
  const access = data?.pageAccess || {};
  for (const key of ["planner", "studio", "settings"]) if (Object.hasOwn(access, key)) return String(access[key]).trim().toLowerCase();
  return "none";
}
function useAuth() {
  const [state, set] = useState({ status: "loading", message: "Connecting to Central\u2026" });
  useEffect(() => {
    let alive = true, off, offProfile;
    let generation = 0;
    const initialize = async () => {
      if (LOCAL && params.get("preview") === "1") {
        set({ status: "ready", preview: true, user: { uid: "annual-local-preview", displayName: "Local preview" }, permission: "admin" });
        return;
      }
      try {
        await window.CENTRAL_ANNUAL_FIREBASE_READY;
        if (!window.firebase) throw Error("Central could not load. Reload to retry.");
        const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(window.__FIREBASE_DEFAULTS__ || {});
        const auth = window.firebase.auth(app);
        const firestore = window.firebase.firestore(app);
        if (LOCAL) {
          const host = location.hostname.replace(/[\[\]]/g, "");
          try {
            auth.useEmulator(`http://${host === "::1" ? "[::1]" : host}:9099`);
          } catch {
          }
          try {
            firestore.useEmulator(host, 8080);
          } catch {
          }
        }
        await auth.getRedirectResult();
        off = auth.onAuthStateChanged((user) => {
          const version = ++generation;
          offProfile?.();
          if (!alive) return;
          if (!user) {
            set({ status: "signed-out", auth, message: "Sign in with your Central staff account." });
            return;
          }
          set({ status: "loading", message: "Checking staff access\u2026" });
          offProfile = firestore.doc(`centralAdmin/root/users/${user.uid}`).onSnapshot((snap) => {
            if (!alive || version !== generation) return;
            const data = snap.exists ? snap.data() : null;
            const access = permission(data);
            set({ status: data?.active === true && ALLOWED.has(access) ? "ready" : "denied", auth, firestore, user, permission: access, message: "This account does not have Planner access. Contact a Central administrator." });
          }, (error) => {
            if (alive && version === generation) set({ status: "error", auth, message: error.message });
          });
        });
      } catch (error) {
        if (alive) set({ status: "error", message: error.message });
      }
    };
    initialize();
    return () => {
      alive = false;
      ++generation;
      off?.();
      offProfile?.();
    };
  }, []);
  return state;
}
function AuthGate() {
  const auth = useAuth();
  const [error, setError] = useState("");
  if (auth.status === "ready") return <Planner key={auth.user.uid} auth={auth} />;
  return <main className="ap-gate"><div className="ap-mark">C<span>+</span></div><p className="eyebrow">CROSSPOINTE CENTRAL</p><h1>Annual Planner</h1><p>{auth.message}</p>{error && <p role="alert">{error}</p>}{auth.status === "signed-out" && <button className="primary" onClick={async () => {
    try {
      await auth.auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
    } catch (e) {
      setError(e.message);
    }
  }}>Sign in with Google</button>}{auth.status === "error" && <button onClick={() => location.reload()}>Retry connection</button>}<a href="/">Back to Central</a></main>;
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement;
    const node = ref.current;
    node.querySelector("input,button,select,textarea")?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = [...node.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex=\"0\"]")].filter((el) => el.offsetParent !== null && !el.matches(":disabled"));
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return <div className="ap-overlay" onMouseDown={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}><section ref={ref} className={`ap-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><div><p className="eyebrow">ANNUAL PLANNER</p><h2>{title}</h2></div><button aria-label="Close dialog" onClick={onClose}>✕</button></header>{children}</section></div>;
}
function Field({ label, children, hint }) {
  return <label className="ap-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function TimeField({ label, days, onChange, min = -730, max = 730 }) {
  const [unit, setUnit] = useState(days % 7 === 0 ? "weeks" : "days");
  const multiplier = unit === "weeks" ? 7 : 1;
  return <Field label={label}><div className="ap-time-input"><input type="number" aria-label={`${label} value`} min={min / multiplier} max={max / multiplier} step="any" value={Number((days / multiplier).toFixed(5))} onChange={(e) => onChange(Math.round(Number(e.target.value) * multiplier))} /><select aria-label={`${label} unit`} value={unit} onChange={(e) => setUnit(e.target.value)}><option value="weeks">weeks</option><option value="days">days</option></select></div></Field>;
}
function rangeFor(view) {
  if (view.zoom === "year") return { start: `${view.year}-01-01`, end: `${view.year}-12-31` };
  const month = (Number(view.quarter) - 1) * 3 + 1;
  const start = `${view.year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 10 ? `${view.year + 1}-01-01` : `${view.year}-${String(month + 3).padStart(2, "0")}-01`;
  return { start, end: addDays(next, -1) };
}
function position(item, range) {
  const length = daysBetween(range.start, range.end) + 1;
  const start = item.startDate < range.start ? range.start : item.startDate;
  const end = item.endDate > range.end ? range.end : item.endDate;
  return { left: `${daysBetween(range.start, start) / length * 100}%`, width: `${Math.max(1, daysBetween(start, end) + 1) / length * 100}%` };
}
function arrangeCanvasLane(groups, compact, isRest = false) {
  const top = isRest ? 3 : compact ? 7 : 10;
  const arranged = groups.map((group) => {
    const phaseEnds = [];
    const phaseItems = [...group.items].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate)).map((item) => {
      let track = phaseEnds.findIndex((end) => end < item.startDate);
      if (track < 0) track = phaseEnds.length;
      phaseEnds[track] = item.endDate;
      return { item, track };
    });
    const phaseHeight = compact ? 20 : 26;
    const height = isRest ? 28 : (compact ? 26 : 34) + Math.max(1, phaseEnds.length) * phaseHeight;
    return { ...group, phaseItems, phaseHeight, height, top };
  });
  return { groups: arranged, height: Math.max(isRest ? 34 : compact ? 60 : 80, ...arranged.map((group) => group.height + top * 2)) };
}
function Timeline({ events, view, settings, onEvent, onWeek, readOnly }) {
  const compact = view.density !== "roomy";
  const range = rangeFor(view);
  const showMeetings = view.showMeetings ?? view.zoom === "quarter";
  const months = Array.from({ length: view.zoom === "year" ? 12 : 3 }, (_, index) => {
    const month = (view.zoom === "year" ? 0 : (view.quarter - 1) * 3) + index + 1;
    const startDate = `${view.year}-${String(month).padStart(2, "0")}-01`;
    return { startDate, endDate: month === 12 ? `${view.year}-12-31` : addDays(`${view.year}-${String(month + 1).padStart(2, "0")}-01`, -1), label: (/* @__PURE__ */ new Date(`${startDate}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) };
  });
  const layout = buildTimelineLayout(events, range, { level: view.level, showMeetings });
  const lanes = layout.lanes.map((lane) => arrangeCanvasLane(lane, compact));
  const restLanes = layout.restLanes.map((lane) => arrangeCanvasLane(lane, compact, true));
  const allStaff = events.filter((event) => event.level <= 2 && !restEvent(event)).flatMap((event) => generateSchedule(event).filter((item) => ["preparation", "active"].includes(item.kind)));
  const weeks = weeklyCongestion(events, view.year, settings).filter((week) => week.startDate <= range.end && week.endDate >= range.start);
  const flaggedWeeks = weeks.filter((week) => week.severity !== "clear");
  const weekLabel = week => `${week.pressure?.reason || "Shared work"}. ${pressureDescription(week)} Weekly event-count peak: ${week.count} events. ${week.restConflicts.length} protected-rest conflicts.`;
  const grids = months.map((month) => <span key={month.startDate} className="ap-shared-gridline" style={{ left: position(month, range).left }} />);
  const renderGroup = (group) => {
    const event = group.event;
    const review = event.level >= 3 && group.items.some((item) => ["preparation", "active"].includes(item.kind) && allStaff.some((work) => overlaps(work, item)));
    const completeWork = generateSchedule(event).filter((item) => ["preparation", "active", "milestone"].includes(item.kind) || showMeetings && item.kind === "meeting");
    const firstDate = completeWork.map((item) => item.startDate).sort()[0];
    const lastDate = completeWork.map((item) => item.endDate).sort().at(-1);
    const title = `Level ${event.level} \xB7 ${event.name} \xB7 ${fullDate(firstDate)} \u2013 ${fullDate(lastDate)}${event.status === "tentative" ? " \xB7 Tentative" : ""}${review ? " \xB7 Review overlap with all-staff work" : ""}`;
    const groupRange = { start: group.startDate, end: group.endDate };
    return <div className={`ap-canvas-event ${review ? "needs-review" : ""}`} key={event.id} style={{ ...position(group, range), top: group.top, height: group.height, "--level": COLORS[event.level] }}>
      <div className="ap-canvas-connection" />
      <button className="ap-canvas-event-title" disabled={readOnly} onClick={() => onEvent(event)} style={{ left: 0, width: "100%" }} title={title} aria-label={title}>
        <span className="ap-level">L{event.level}</span><strong>{event.name}</strong>{review && <span className="ap-review-marker" aria-label="Review overlap">○</span>}{event.status === "tentative" && <span className="ap-tentative-marker" aria-label="Tentative">◌</span>}
      </button>
      {group.phaseItems.map(({ item, track }) => <button disabled={readOnly} onClick={() => onEvent(event)} key={item.id} className={`ap-canvas-phase ${item.kind} ${phaseDemandClass(item)} ${item.manuallyAdjusted ? "manual" : ""}`} style={{ ...position(item, groupRange), top: (compact ? 25 : 34) + track * group.phaseHeight, height: group.phaseHeight - 3 }} title={`${event.name} \xB7 ${item.name} \xB7 ${fullDate(item.startDate)} \u2013 ${fullDate(item.endDate)}${isWorkPhase(item) ? ` · ${phaseProfileText(item)}` : ""}${item.manuallyAdjusted ? " \xB7 Manual dates" : ""}`} aria-label={`${event.name}, ${item.name}, ${fullDate(item.startDate)} to ${fullDate(item.endDate)}${isWorkPhase(item) ? `, ${phaseProfileText(item)}` : ""}`}>
        <StageMark phase={item}/><DemandMark phase={item}/><span className="ap-phase-name">{["meeting", "milestone"].includes(item.kind) ? "\u25C6" : item.name}</span>
      </button>)}
    </div>;
  };
  return <div className="ap-timeline-scroll"><div className={`ap-shared-timeline ${compact ? "compact" : "roomy"} ${view.zoom === "quarter" ? "quarter" : ""}`}>
    <div className="ap-shared-caption"><span>{layout.events.length} events · shared staff calendar{view.zoom === "year" && <small> · Zoom to a quarter for short event names</small>}</span><span>{showMeetings ? "Individual meetings shown" : "Meetings hidden"} · {flaggedWeeks.length} capacity signals</span></div>
    <div className="ap-shared-months">{months.map((month) => <div key={month.startDate} style={position(month, range)}>{month.label}</div>)}</div>
    <div className="ap-shared-capacity" aria-label="Weekly all-staff congestion">{flaggedWeeks.map((week) => <button disabled={readOnly} key={week.startDate} className={`ap-capacity-count ${week.severity}`} style={position(week, range)} onClick={() => onWeek(week)} title={weekLabel(week)} aria-label={weekLabel(week)}>{week.severity === "strong" ? "!!" : "!"}</button>)}</div>
    <div className="ap-work-canvas">
      <div className="ap-capacity-bands">{flaggedWeeks.map((week) => <button disabled={readOnly} key={week.startDate} className={`ap-capacity-band ${week.severity}`} style={position(week, range)} onClick={() => onWeek(week)} title={weekLabel(week)} aria-label={`Review ${weekLabel(week)}`} tabIndex={-1} />)}</div>
      {grids}
      {lanes.map((lane, index) => <div className="ap-shared-lane" key={index} style={{ height: lane.height }}>{lane.groups.map(renderGroup)}</div>)}
      {!layout.events.length && <div className="ap-empty"><span className="ap-empty-symbol">＋</span><h3>Room for the year ahead.</h3><p>{events.length ? "No event work matches this view. Protected rest remains visible below." : "Start with the Level 1 anchors. Build the shared plan around them."}</p></div>}
    </div>
    <div className="ap-rest-strip-heading"><span>Protected rest & recovery</span><small>Kept separate from shared-capacity counts · visible at every level</small></div>
    <div className="ap-rest-canvas">{grids}{restLanes.map((lane, index) => <div className="ap-shared-lane rest-lane" key={index} style={{ height: lane.height }}>{lane.groups.map((group) => <div className="ap-canvas-rest" key={`${group.event.id}-${group.item.id}`} style={{ ...position(group, range), top: group.top, height: group.height }}><button disabled={readOnly} className="ap-canvas-rest-title" style={{ left: 0, width: "100%" }} onClick={() => onEvent(group.event)} title={`${group.event.name} \xB7 ${group.item.name} \xB7 ${fullDate(group.item.startDate)} \u2013 ${fullDate(group.item.endDate)}`} aria-label={`${group.event.name}, ${group.item.name}, ${fullDate(group.item.startDate)} to ${fullDate(group.item.endDate)}`}><strong>{group.event.name}</strong><span>{group.item.name}</span></button><button disabled={readOnly} className="ap-canvas-rest-range" onClick={() => onEvent(group.event)} title={`${group.item.name}: ${fullDate(group.item.startDate)} \u2013 ${fullDate(group.item.endDate)}`} aria-label={`Edit ${group.event.name} protected rest`} /></div>)}</div>)}{!restLanes.length && <p className="ap-rest-empty">No protected rest or recovery in this date range.</p>}</div>
  </div></div>;
}
function MonthGrid({ events, view, onView, onEvent, readOnly }) {
  const month = view.month || 0;
  const first = `${view.year}-${String(month + 1).padStart(2, "0")}-01`;
  const day = (/* @__PURE__ */ new Date(`${first}T12:00:00Z`)).getUTCDay();
  const start = addDays(first, -((day + 6) % 7));
  const rows = Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_2, d) => addDays(start, week * 7 + d)));
  const matchesLevel = event => view.level === "all" || (view.level === "small" ? event.level >= 3 : event.level === Number(view.level));
  return <section className="ap-month-view"><div className="ap-month-controls"><button aria-label="Previous month" disabled={readOnly || !month} onClick={() => onView((v) => ({ ...v, month: month - 1 }))}>←</button><h3>{(/* @__PURE__ */ new Date(`${first}T12:00:00Z`)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h3><button aria-label="Next month" disabled={readOnly || month === 11} onClick={() => onView((v) => ({ ...v, month: month + 1 }))}>→</button></div><div className="ap-month-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>{rows.map((week) => <div key={week[0]} className="ap-calendar-week"><div className="ap-week-dates">{week.map((d) => <span className={d.slice(5, 7) === first.slice(5, 7) ? "" : "outside"} key={d}>{Number(d.slice(-2))}</span>)}</div>{events.flatMap((e) => generateSchedule(e).filter((i) => i.startDate <= week[6] && i.endDate >= week[0] && (i.kind === "rest" || matchesLevel(e))).map((i) => <button disabled={readOnly} onClick={() => onEvent(e)} key={`${e.id}-${i.id}`} className={`ap-month-segment ${i.kind} ${phaseDemandClass(i)}`} style={{ "--level": COLORS[e.level], marginLeft: `${Math.max(0, daysBetween(week[0], i.startDate)) / 7 * 100}%`, width: `${(Math.min(6, daysBetween(week[0], i.endDate)) - Math.max(0, daysBetween(week[0], i.startDate)) + 1) / 7 * 100}%` }} title={`${e.name}: ${i.name}, ${fullDate(i.startDate)}–${fullDate(i.endDate)}${isWorkPhase(i) ? ` · ${phaseProfileText(i)}` : ""}`} aria-label={`${e.name}, ${i.name}, ${fullDate(i.startDate)} to ${fullDate(i.endDate)}${isWorkPhase(i) ? `, ${phaseProfileText(i)}` : ""}`}><StageMark phase={i}/><DemandMark phase={i}/><span className="ap-phase-name">{e.name} · {i.name}</span></button>))}</div>)}</section>;
}
function EventEditor({ initial, templates, events, settings, onSave, onDelete, onClose, onDisplay, editable, year }) {
  const [draft, setDraft] = useState(() => clone(initial));
  const [step, setStep] = useState("edit");
  const [error, setError] = useState("");
  const [upgradeBlock, setUpgradeBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const isRest = restEvent(draft);
  const overrideCount = Object.keys(draft.overrides || {}).length;
  const exclusionsFull = (draft.excludedMeetingDates || []).length >= 12;
  const update = (value) => {
    setStep("edit");
    setError("");
    setUpgradeBlock(null);
    setDraft((e) => ({ ...e, ...value }));
    onDisplay(null);
  };
  const lastSchedule = useRef([]);
  let schedule = lastSchedule.current, validation = [];
  try {
    validation = validateEvent(draft);
    const calculated = generateSchedule({ ...draft, name: draft.name || "New event" });
    schedule = calculated;
    lastSchedule.current = calculated;
  } catch (e) {
    if (!validation.length) validation = [e.message];
  }
  let restEnd = "";
  try {
    restEnd = addDays(draft.anchorDate, draft.templateSnapshot.phases[0].durationDays - 1);
  } catch {
  }
  const candidate = events.filter((e) => e.id !== draft.id).concat(draft);
  let warnings = [];
  try {
    if (!validation.length) warnings = weeklyCongestion(candidate, year, settings).map(week => {const own = week.pressureByEvent?.[draft.id];return {...week,pressure:own || week.pressure,severity:own?.severity || "clear"};}).filter((w) => w.severity !== "clear" && w.pressure?.eventIds.includes(draft.id) || w.restConflicts.some((c) => c.restEventId === draft.id || c.eventIds.includes(draft.id)));
  } catch {
  }
  const upgrading = initial.revision > 0 && (initial.templateSnapshot.version !== draft.templateSnapshot.version || initial.templateId !== draft.templateId);
  let changedDates = 0;
  if (upgrading) {
    const previous = new Map(generateSchedule(initial).map((item) => [item.id, item]));
    changedDates = schedule.filter((item) => !previous.has(item.id) || previous.get(item.id).startDate !== item.startDate || previous.get(item.id).endDate !== item.endDate).length;
  }
  const previousPhases = new Map(initial.templateSnapshot.phases.map(phase=>[phase.id,phase]));
  const profileChanges = draft.templateSnapshot.phases.filter(phase=>isWorkPhase(phase) && (previousPhases.get(phase.id)?.workStage !== phase.workStage || previousPhases.get(phase.id)?.demand !== phase.demand));
  const useTemplate = id => {
    const template = templates.find(item=>item.id===id);
    if (!template) return;
    const acceptedIds = scheduleIdsFor(template);
    const missing = Object.entries(draft.overrides).filter(([itemId])=>!acceptedIds.has(itemId)).map(([itemId,dates])=>({id:itemId,name:draft.templateSnapshot.phases.find(phase=>phase.id===itemId)?.name || schedule.find(item=>item.id===itemId)?.name || itemId,...dates}));
    if (missing.length) {
      setUpgradeBlock({name:template.name,version:template.version,missing});
      setStep('edit');
      onDisplay(null);
      return;
    }
    update({templateId:template.id,templateSnapshot:clone(template),level:template.level});
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(draft);
      onDisplay(null);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (!busy) {
      onDisplay(null);
      onClose();
    }
  };
  return <Modal title={editable ? initial.revision ? `Edit ${isRest ? "protected rest" : "event"}` : `Plan ${isRest ? "protected rest" : "an event"}` : draft.name} onClose={close} wide><div className="ap-modal-body" tabIndex={0} role="region" aria-label="Event planning details"><fieldset className="ap-modal-fields" disabled={busy}><div className="ap-editor-steps"><span className={step === "edit" ? "selected" : ""}>1 · Shape the plan</span><span className={step === "preview" ? "selected" : ""}>2 · Review & apply</span></div><div className="ap-form-grid"><Field label={isRest ? "Rest block name" : "Event or season name"}><input value={draft.name} disabled={!editable || busy} onChange={(e) => update({ name: e.target.value })} /></Field><Field label={isRest ? "Start date" : "Anchor date"} hint="Moving the anchor recalculates the plan; manual dates stay fixed."><input type="date" value={draft.anchorDate} disabled={!editable || busy} onChange={(e) => update({ anchorDate: e.target.value })} /></Field>{isRest ? <Field label="End date"><input type="date" min={draft.anchorDate} value={restEnd} disabled={!editable || busy} onChange={(e) => {
    if (e.target.value && draft.anchorDate) update({ templateSnapshot: { ...draft.templateSnapshot, phases: [{ ...draft.templateSnapshot.phases[0], durationDays: daysBetween(draft.anchorDate, e.target.value) + 1 }] } });
  }} /></Field> : <><Field label="Phase playbook"><select value={draft.templateId} disabled={!editable || busy} onChange={(e) => useTemplate(e.target.value)}>{!templates.some((t) => t.id === draft.templateId) && <option value={draft.templateId}>{draft.templateSnapshot.name}</option>}{templates.map((t) => <option key={t.id} value={t.id}>{t.name} · L{t.level}</option>)}</select></Field><Field label="Priority level"><select value={draft.level} disabled={!editable || busy} onChange={(e) => update({ level: Number(e.target.value) })}>{LEVELS.map((l) => <option key={l} value={l}>Level {l}{l === 1 ? " \xB7 Annual anchor" : l === 2 ? " \xB7 Shared season" : ""}</option>)}</select></Field></>}<Field label="Status"><select value={draft.status} disabled={!editable || busy} onChange={(e) => update({ status: e.target.value })}><option value="tentative">Tentative</option><option value="confirmed">Confirmed</option></select></Field><Field label="Staff notes"><textarea rows="2" value={draft.notes || ""} disabled={!editable || busy} onChange={(e) => update({ notes: e.target.value })} /></Field></div>
 {!isRest && <p className="ap-note">Using playbook version {draft.templateSnapshot.version}. Changes to the library do not change this event automatically.{templates.find((t) => t.id === draft.templateId)?.version > draft.templateSnapshot.version && editable && <button className="text-button" onClick={() => useTemplate(draft.templateId)}>Preview latest playbook</button>}</p>}
 {upgradeBlock && <div className="ap-alert ap-upgrade-block" role="alert"><b>Playbook change needs a manual-date decision</b><p>{upgradeBlock.name} v{upgradeBlock.version} has different phase or meeting IDs. These manual dates cannot be carried to that playbook safely. Your current plan is unchanged.</p>{upgradeBlock.missing.map(item=><div key={item.id}><span><strong>{item.name}</strong> · {fullDate(item.startDate)}–{fullDate(item.endDate)}</span><button disabled={busy} onClick={()=>{const overrides={...draft.overrides};delete overrides[item.id];update({overrides});}}>Reset these manual dates</button></div>)}<p>Keep the current playbook to preserve these dates, or explicitly reset each listed range and select the new playbook again. Reset changes remain a proposal until applied.</p><button onClick={()=>setUpgradeBlock(null)}>Keep current playbook</button></div>}
 <>{upgrading && <div className="ap-preview-summary"><b>Proposed playbook update · this event only</b><p>{initial.templateSnapshot.name} v{initial.templateSnapshot.version} → {draft.templateSnapshot.name} v{draft.templateSnapshot.version}. {changedDates} schedule items have new or changed dates; {profileChanges.length} phases have changed work stage or demand. Compatible manual overrides are retained.</p><small>Review the schedule below. This event changes only when you choose Apply to calendar.</small></div>}</><h3>{step === "preview" ? "Proposed schedule" : "Dates & individual meetings"}</h3><p className="muted">{isRest ? "Protect this time on the shared staff calendar." : "Manual date changes stay attached to each phase or meeting. Work stage and demand edits affect this event only; the library and dates stay unchanged."}</p><>{!isRest && <p className="ap-note">{overrideCount} of 8 custom date ranges used. {overrideCount >= 8 ? "Reset one range below to adjust another item; existing manual dates remain editable." : "Reset an item to return to the playbook dates."}</p>}</><div className="ap-schedule-list">{schedule.map((item) => <div className="ap-schedule-item" key={item.id}><div><span className={`ap-kind ${item.kind}`}>{item.kind}</span><strong>{item.name}</strong>{item.manuallyAdjusted && <small>Manual dates preserved</small>}</div><label><span className="sr-only">{item.name} start date</span><input type="date" disabled={!editable || busy || isRest || overrideCount >= 8 && !Object.hasOwn(draft.overrides, item.id)} value={draft.overrides?.[item.id]?.startDate ?? item.startDate} onChange={(e) => update({ overrides: { ...draft.overrides, [item.id]: { startDate: e.target.value, endDate: item.endDate < e.target.value ? e.target.value : item.endDate } } })} /></label><label><span className="sr-only">{item.name} end date</span><input type="date" disabled={!editable || busy || isRest || overrideCount >= 8 && !Object.hasOwn(draft.overrides, item.id)} value={draft.overrides?.[item.id]?.endDate ?? item.endDate} min={item.startDate} onChange={(e) => update({ overrides: { ...draft.overrides, [item.id]: { startDate: item.startDate, endDate: e.target.value } } })} /></label>{editable && !isRest && <div className="ap-item-actions">{item.manuallyAdjusted && <button onClick={() => {
    const overrides = { ...draft.overrides };
    delete overrides[item.id];
    update({ overrides });
  }}>Reset</button>}{item.id.startsWith("meeting-") && <button disabled={exclusionsFull} title={exclusionsFull ? "12 skipped dates are saved. Restore a skipped date before skipping another." : "Skip this meeting date"} onClick={() => {
    const overrides = { ...draft.overrides };
    delete overrides[item.id];
    update({ overrides, excludedMeetingDates: [.../* @__PURE__ */ new Set([...draft.excludedMeetingDates || [], item.startDate])] });
  }}>Skip</button>}</div>}{draft.templateSnapshot.phases.some(phase=>phase.id===item.id) && <ProfileFields phase={draft.templateSnapshot.phases.find(phase=>phase.id===item.id)} disabled={!editable || busy} onChange={phase=>update({templateSnapshot:{...draft.templateSnapshot,phases:draft.templateSnapshot.phases.map(existing=>existing.id===phase.id?phase:existing)}})}/>}</div>)}</div>{draft.excludedMeetingDates?.length > 0 && <div className="ap-note">Skipped meetings ({draft.excludedMeetingDates.length}/12). {exclusionsFull && "Restore a skipped date to make room for another."}  {draft.excludedMeetingDates.map((d) => <button key={d} disabled={!editable || busy} onClick={() => update({ excludedMeetingDates: draft.excludedMeetingDates.filter((x) => x !== d) })}>{fmt(d)} · restore</button>)}</div>}
 {step === "preview" && <div className="ap-preview-summary"><b>Review before applying</b>{profileChanges.length>0 && <div className="ap-profile-change-list"><strong>Event phase profile changes</strong>{profileChanges.map(phase=><div key={phase.id}>{phase.name}: {phaseProfileText(previousPhases.get(phase.id)||{})} → {phaseProfileText(phase)}</div>)}</div>}<p>{warnings.length ? `${warnings.length} week${warnings.length === 1 ? "" : "s"} need a conversation about shared capacity or protected rest.` : "No Level 1\u20132 congestion or protected-rest conflict found for this proposal."}</p>{warnings.slice(0, 8).map((w) => <div key={w.startDate}><b>{w.severity === "clear" ? "Protected-rest review" : w.pressure?.reason}</b><p>{w.severity !== "clear" ? pressureDescription(w) : ""}</p><small>Weekly event-count peak: {w.count} events.{w.restConflicts.length ? ` Protected rest: ${w.restConflicts.map(c=>c.restName).join(", ")}` : ""}</small></div>)}<small>Warnings invite a decision; they do not block saving.</small></div>}
 {validation.length > 0 && <div role="alert" className="ap-alert">{validation.join(" ")}</div>}{error && <div className="ap-alert" role="alert">{error} Your changes remain here. Retry after resolving the connection or conflict.</div>}</fieldset></div><footer>{editable && initial.revision > 0 && <button className="danger" disabled={busy} onClick={async () => {
    if (!window.confirm(`Delete \u201C${draft.name}\u201D from the shared annual calendar?`)) return;
    setBusy(true);
    try {
      await onDelete(initial);
      close();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }}>Delete</button>}<span className="ap-spacer" /><button disabled={busy} onClick={close}>{editable ? "Cancel" : "Close"}</button>{editable && (step === "edit" ? <button className="primary" disabled={busy || validation.length > 0} onClick={() => setStep("preview")}>Review proposal →</button> : <><button disabled={busy} onClick={() => onDisplay(draft)}>Preview on display</button><button className="primary" disabled={busy || validation.length > 0} onClick={save}>{busy ? "Saving\u2026" : "Apply to calendar"}</button></>)}</footer></Modal>;
}
function PlaybookEditor({ initial, onSave, onClose }) {
  const [draft, set] = useState(()=>clone(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = value => set(current=>({...current,...value}));
  const updatePhase = phase => update({phases:draft.phases.map(current=>current.id===phase.id?phase:current)});
  const errors = validateTemplate(draft);
  return <Modal title="Edit phase playbook" wide onClose={()=>!busy&&onClose()}>
    <div className="ap-modal-body" tabIndex={0} role="region" aria-label="Phase playbook details"><fieldset className="ap-modal-fields" disabled={busy}>
      <p className="ap-note">Saved changes apply to new events. Existing events keep their saved playbook until you explicitly preview an update. A playbook update that would remove a manual-date mapping must be resolved first.</p>
      <div className="ap-form-grid">
        <Field label="Playbook name"><input value={draft.name} onChange={event=>update({name:event.target.value})}/></Field>
        <Field label="Default level"><select value={draft.level} onChange={event=>update({level:Number(event.target.value)})}>{LEVELS.map(level=><option key={level} value={level}>Level {level}</option>)}</select></Field>
        <Field label="Description"><textarea value={draft.description||''} onChange={event=>update({description:event.target.value})}/></Field>
        <Field label="Tuesday staff meetings (0–8)"><input type="number" min="0" max="8" value={draft.meetingCount} onChange={event=>update({meetingCount:Number(event.target.value)})}/></Field>
        <Field label="Recovery days after active phase (0–56)"><input type="number" min="0" max="56" value={draft.recoveryDays} onChange={event=>update({recoveryDays:Number(event.target.value)})}/></Field>
      </div>
      <h3>Repeatable phases</h3><p className="muted">Keep meaningful phase names. Choose a work stage and a separate demand level for each preparation or active phase. Unclassified stays visibly unclassified.</p><DemandGuide/>
      <p className="muted">Use up to 6 phases, in weeks or days. A negative start is before the anchor: −8 weeks begins preparation eight weeks earlier.</p>
      {draft.phases.map(phase=><div className="ap-phase-fields" key={phase.id}>
        <Field label="Phase name"><input value={phase.name} onChange={event=>updatePhase({...phase,name:event.target.value})}/></Field>
        <Field label="Kind"><select value={phase.kind} onChange={event=>updatePhase(changePhaseKind(phase,event.target.value))}>{['preparation','active','milestone','rest'].map(kind=><option key={kind}>{kind}</option>)}</select></Field>
        <TimeField label="Start from anchor" days={phase.offsetDays} onChange={offsetDays=>updatePhase({...phase,offsetDays})}/>
        <TimeField label="Phase length" min={1} max={366} days={phase.durationDays} onChange={durationDays=>updatePhase({...phase,durationDays})}/>
        <button aria-label={`Remove ${phase.name}`} disabled={draft.phases.length===1} onClick={()=>update({phases:draft.phases.filter(current=>current.id!==phase.id)})}>✕</button>
        <ProfileFields phase={phase} onChange={updatePhase}/>
      </div>)}
      <button disabled={draft.phases.length>=6} onClick={()=>update({phases:[...draft.phases,{id:createId('phase'),name:'New phase',kind:'preparation',offsetDays:-7,durationDays:7}]})}>{draft.phases.length>=6?'6 phase limit reached':'＋ Add phase'}</button>
      {errors.length>0&&<p className="ap-alert" role="alert">{errors.join(' ')}</p>}{error&&<p className="ap-alert" role="alert">{error}</p>}
    </fieldset></div>
    <footer><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||errors.length>0} onClick={async()=>{setBusy(true);try{await onSave(draft);onClose();}catch(error){setError(error.message);}finally{setBusy(false);}}}>{busy?'Saving…':'Save playbook'}</button></footer>
  </Modal>;
}
function SettingsEditor({ settings, onSave, onClose }) {
  const [draft,set] = useState({...settings});
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const valid = Number.isInteger(draft.lightThreshold)&&Number.isInteger(draft.strongThreshold)&&draft.lightThreshold>=1&&draft.lightThreshold<=10&&draft.strongThreshold>draft.lightThreshold&&draft.strongThreshold<=20;
  return <Modal title="Shared capacity signals" onClose={()=>!busy&&onClose()}>
    <div className="ap-modal-body" tabIndex={0} role="region" aria-label="Shared capacity settings"><fieldset className="ap-modal-fields" disabled={busy}>
      <p>Classified phases use the demand rules below. Each active Level 1–2 event counts once at its highest demand; meetings and recovery do not add pressure.</p><DemandGuide/>
      <h3>Fallback for unclassified work</h3><p>These adjustable thresholds apply when work has no demand classification. They do not change the fixed demand rules.</p>
      <Field label="Review at concurrent unclassified-work events"><input type="number" min="1" max="10" value={draft.lightThreshold} onChange={event=>set({...draft,lightThreshold:Number(event.target.value)})}/></Field>
      <Field label="Strong warning at concurrent unclassified-work events"><input type="number" min={draft.lightThreshold+1} max="20" value={draft.strongThreshold} onChange={event=>set({...draft,strongThreshold:Number(event.target.value)})}/></Field>
      <p className="ap-note">The fallback counts all active Level 1–2 events on a day with unclassified work. Protected rest and recovery retain separate warnings. Levels 3–5 still show lighter review markers when they overlap all-staff work.</p>
      {!valid&&<p className="ap-alert">Use a review threshold of 1–10 and a higher strong threshold up to 20.</p>}{error&&<p role="alert" className="ap-alert">{error}</p>}
    </fieldset></div><footer><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy||!valid} className="primary" onClick={async()=>{setBusy(true);try{await onSave(draft);onClose();}catch(error){setError(error.message);}finally{setBusy(false);}}}>{busy?'Saving…':'Save signals'}</button></footer>
  </Modal>;
}
function WeekDetails({week,events,onClose,onEvent}) {
  const pressure = week.pressure;
  const eventButton = id => {
    const item = events.find(event=>event.id===id);
    return item?<button className="ap-detail-event" key={id} onClick={()=>onEvent(item)}><span style={{color:COLORS[item.level]}}>{restEvent(item)?'REST':`L${item.level}`}</span>{item.name}<span aria-hidden="true">→</span></button>:null;
  };
  return <Modal title={`${fmt(week.startDate)} – ${fullDate(week.endDate)}`} onClose={onClose}>
    <div className="ap-modal-body" tabIndex={0} role="region" aria-label="Weekly work pressure details">
      <h3>{pressure?.reason || 'Shared work pressure'}</h3><p>{pressureDescription(week)}</p>
      {pressure?.unclassified&&<p className="ap-note">Unclassified work is present on this date. The signal also considers the saved event-count fallback; unclassified does not mean light.</p>}
      <div className="ap-pressure-phases">{pressure?.phases.map(phase=><div className={`ap-pressure-phase demand-${phase.demand||'unclassified'}`} key={`${phase.eventId}-${phase.id}`}><strong>{phase.eventName} · {phase.name}</strong><span>{phaseProfileText(phase)}</span><small>{fullDate(phase.startDate)}–{fullDate(phase.endDate)}</small></div>)}</div>
      <div className="ap-detail-events">{(pressure?.eventIds||[]).map(eventButton)}</div>
      <details className="ap-raw-capacity"><summary>Most events at once this week · {week.count} at peak</summary><p>{week.count} unique Level 1–2 events overlap on {fullDate(week.peakDate||week.startDate)}. This count can occur on a different day from the demand signal above.</p><div className="ap-detail-events">{week.eventIds.map(eventButton)}</div></details>
      <h3>Protected rest & recovery</h3>{week.restConflicts.length?week.restConflicts.map((conflict,index)=><section className="ap-rest-detail" key={`${conflict.restEventId}-${index}`}><b>{conflict.restName}</b><p>Work overlaps this protected window:</p><div className="ap-detail-events">{conflict.eventIds.map(eventButton)}</div>{eventButton(conflict.restEventId)}</section>):<p className="muted">No event work overlaps protected rest this week.</p>}
    </div><footer><button onClick={onClose}>Close</button></footer>
  </Modal>;
}
function makeEvent(template, year, isRest = false) {
  const snapshot = isRest ? { id: "protected-rest", name: "Protected rest", description: "Protected shared Sabbath or recovery.", level: 1, version: 1, meetingCount: 0, recoveryDays: 0, phases: [{ id: "protected-rest", name: "Protected rest", kind: "rest", offsetDays: 0, durationDays: 7 }] } : clone(template);
  return { id: createId("event"), name: isRest ? "Protected rest" : "", level: snapshot.level, anchorDate: `${year}-01-01`, templateId: snapshot.id, templateSnapshot: snapshot, overrides: {}, notes: "", status: "tentative", excludedMeetingDates: [], revision: 0 };
}
function Planner({ auth }) {
  const store = useMemo(() => createAnnualStore({ firestore: auth.firestore, user: auth.user, preview: !!auth.preview }), [auth.firestore, auth.user.uid, auth.preview]);
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ year: 2027, zoom: "year", quarter: 1, month: 0, mode: "timeline", level: "all", density: "compact", showMeetings: null });
  const [section, setSection] = useState("calendar");
  const [showAllCapacity, setShowAllCapacity] = useState(false);
  const [showAllRest, setShowAllRest] = useState(false);
  const [inspectedWeek, setInspectedWeek] = useState(null);
  const [event, setEvent] = useState(null);
  const [playbook, setPlaybook] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftDisplay, setDraftDisplay] = useState(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [presenterConnected, setPresenterConnected] = useState(false);
  const channel = useRef(null);
  const popup = useRef(null);
  const messageState = useRef(null);
  const lastDisplayContact = useRef(0);
  const session = useRef(null);
  if (!session.current) {
    if (PRESENTER) session.current = params.get("displaySession");
    else {
      const key = `annual-display-session:${auth.user.uid}`;
      try {
        session.current = sessionStorage.getItem(key) || createId("display");
        sessionStorage.setItem(key, session.current);
      } catch {
        session.current = createId("display");
      }
    }
  }
  const editable = EDIT.has(auth.permission) && !PRESENTER;
  useEffect(() => store.subscribe((data) => {
    setWorkspace(data);
    setLoadError("");
  }, (error) => setLoadError(error.message || "Unable to load the shared calendar.")), [store]);
  const broadcast = () => {
    if (!PRESENTER && channel.current) channel.current.postMessage({ type: "state", ...messageState.current });
  };
  messageState.current = { view, draft: draftDisplay, previewWorkspace: auth.preview ? workspace : null };
  useEffect(() => {
    if (!session.current || !window.BroadcastChannel) return;
    const bus = new BroadcastChannel(`central-annual:${auth.user.uid}:${session.current}`);
    channel.current = bus;
    const sendState = () => {
      if (!PRESENTER) bus.postMessage({ type: "state", ...messageState.current });
    };
    bus.onmessage = ({ data }) => {
      if (!data || typeof data !== "object") return;
      if (PRESENTER && data.type === "state") {
        lastDisplayContact.current = Date.now();
        setPresenterConnected(true);
        if (data.view) setView(data.view);
        setDraftDisplay(data.draft || null);
        if (auth.preview && data.previewWorkspace) setWorkspace(data.previewWorkspace);
      }
      if (!PRESENTER && data.type === "hello") {
        setDisplayOpen(true);
        sendState();
      }
      if (PRESENTER && data.type === "clear") {
        setDraftDisplay(null);
        setPresenterConnected(false);
      }
    };
    if (PRESENTER) bus.postMessage({ type: "hello" });
    const timer = setInterval(() => {
      if (PRESENTER) {
        bus.postMessage({ type: "hello" });
        if (Date.now() - lastDisplayContact.current > 12e3) {
          setDraftDisplay(null);
          setPresenterConnected(false);
        }
      } else sendState();
    }, 4e3);
    const leaving = () => {
      if (!PRESENTER) bus.postMessage({ type: "clear" });
    };
    window.addEventListener("beforeunload", leaving);
    return () => {
      leaving();
      clearInterval(timer);
      bus.close();
      channel.current = null;
      window.removeEventListener("beforeunload", leaving);
    };
  }, [auth.user.uid, auth.preview]);
  useEffect(() => broadcast(), [view, draftDisplay, workspace]);
  const openDisplay = () => {
    setActionError("");
    if (!window.BroadcastChannel) {
      setActionError("This browser cannot sync a presentation window. Use a current desktop browser.");
      return false;
    }
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("presenter", "1");
    url.searchParams.set("displaySession", session.current);
    if (auth.preview && LOCAL) url.searchParams.set("preview", "1");
    popup.current = window.open(url.href, `central-annual-display-${auth.user.uid}`, "popup,width=1440,height=900");
    if (!popup.current) {
      setActionError("The presentation window was blocked. Allow pop-ups for Central, then choose Open display again.");
      setDisplayOpen(false);
      return false;
    }
    setDisplayOpen(true);
    popup.current.focus();
    return true;
  };
  const displayDraft = (value) => {
    if (value && (!popup.current || popup.current.closed)) {
      if (!openDisplay()) return;
    }
    setDraftDisplay(value ? clone(value) : null);
  };
  const save = async (callback) => {
    setSaving(true);
    setActionError("");
    try {
      return await callback();
    } catch (error) {
      setActionError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  };
  if (!workspace) return <main className="ap-gate"><div className="ap-mark">C<span>+</span></div><h1>Annual Planner</h1><p>{loadError || "Loading the shared staff calendar\u2026"}</p>{loadError && <button onClick={() => location.reload()}>Retry connection</button>}</main>;
  const templates = workspace.templates?.length ? workspace.templates : STARTER_TEMPLATES;
  const settings = { lightThreshold: 2, strongThreshold: 3, ...workspace.settings };
  const committed = workspace.events || [];
  const events = draftDisplay ? [...committed.filter((e) => e.id !== draftDisplay.id), draftDisplay] : committed;
  const weeks = weeklyCongestion(events, view.year, settings);
  const congestion = weeks.filter((w) => w.severity !== "clear");
  const restWarnings = weeks.filter((w) => w.restConflicts.length);
  const visibleYearEvents = events.filter((e) => {
    const summary = summarizeEvent(e);
    return summary.startDate <= `${view.year}-12-31` && summary.endDate >= `${view.year}-01-01`;
  });
  const anchors = visibleYearEvents.filter((e) => e.level === 1 && !restEvent(e)).length;
  const timeline = <><div className="ap-legend"><span><i className="prep" />Preparation</span><span><i className="active" />Active event / season</span>{(view.mode === "month" || (view.showMeetings ?? view.zoom === "quarter")) && <span><i className="meeting" />Tuesday meeting</span>}<span><i className="rest" />Protected rest / recovery</span><span className="ap-legend-signal"><i className="light" />Review overlap <i className="strong" />Strong overlap</span></div><DemandGuide/>{view.mode === "month" ? <MonthGrid key={`${view.year}-${view.quarter}`} events={events} view={view} onView={setView} onEvent={setEvent} readOnly={PRESENTER} /> : <Timeline events={events} view={view} settings={settings} onEvent={setEvent} onWeek={setInspectedWeek} readOnly={PRESENTER} />}</>;
  const controls = <div className="ap-view-controls"><div className="ap-year"><button aria-label="Previous year" disabled={view.year <= 1901} onClick={() => setView((v) => ({ ...v, year: Math.max(1901, v.year - 1) }))}>←</button><strong>{view.year}</strong><button aria-label="Next year" disabled={view.year >= 2199} onClick={() => setView((v) => ({ ...v, year: Math.min(2199, v.year + 1) }))}>→</button></div><div className="ap-segmented" aria-label="Calendar layout"><button aria-pressed={view.mode === "timeline"} onClick={() => setView((v) => ({ ...v, mode: "timeline" }))}>Timeline</button><button aria-pressed={view.mode === "month"} onClick={() => setView((v) => ({ ...v, mode: "month" }))}>Month</button></div>{view.mode === "timeline" && <div className="ap-segmented" aria-label="Timeline zoom"><button aria-pressed={view.zoom === "year"} onClick={() => setView((v) => ({ ...v, zoom: "year" }))}>Year</button><button aria-pressed={view.zoom === "quarter"} onClick={() => setView((v) => ({ ...v, zoom: "quarter" }))}>Quarter</button></div>}{view.zoom === "quarter" && view.mode === "timeline" && <select aria-label="Quarter" value={view.quarter} onChange={(e) => setView((v) => ({ ...v, quarter: Number(e.target.value) }))}>{[1, 2, 3, 4].map((q) => <option value={q} key={q}>Q{q}</option>)}</select>}<select aria-label="Filter priority levels" value={view.level} onChange={(e) => setView((v) => ({ ...v, level: e.target.value }))}><option value="all">All priority levels</option><option value="1">Level 1 · Anchors</option><option value="2">Level 2 · Shared seasons</option><option value="small">Levels 3–5 · Smaller events</option></select>{view.mode === "timeline" && <button className="ap-meetings-toggle" aria-pressed={view.showMeetings ?? view.zoom === "quarter"} onClick={() => setView((v) => ({ ...v, showMeetings: !(v.showMeetings ?? v.zoom === "quarter") }))}>Show meetings</button>}<select aria-label="Presentation density" value={view.density} onChange={(e) => setView((v) => ({ ...v, density: e.target.value }))}><option value="compact">Display · Compact</option><option value="roomy">Display · Roomy</option></select></div>;
  if (PRESENTER) return <main className={`ap-presenter ${view.density !== "roomy" ? "compact" : ""}`}><header><div><p className="eyebrow">CROSSPOINTE · SHARED STAFF CALENDAR</p><h1>{view.year} <span>Annual Plan</span></h1></div><div className="ap-presenter-state"><span className={draftDisplay ? "ap-proposed" : "ap-live"}>{draftDisplay ? "PROPOSED \xB7 NOT SAVED" : "COMMITTED CALENDAR"}</span><button onClick={async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) {
      setActionError(e.message);
    }
  }}>Full screen</button></div></header>{loadError && <div className="ap-alert" role="alert">Connection interrupted: {loadError} The displayed calendar may be out of date.</div>}{actionError && <div className="ap-alert" role="alert">{actionError}</div>}{auth.preview && <div className="ap-preview-banner">LOCAL PREVIEW · Demonstration data only</div>}{draftDisplay && <div className="ap-draft-banner">PROPOSED CHANGE · {draftDisplay.name} · Discussion preview only</div>}{timeline}<footer><span>{anchors} Level 1 anchors · {congestion.length} weeks with shared-capacity signals · {restWarnings.length} protected-rest warnings</span><span>{presenterConnected ? "Connected to operator" : auth.preview ? "Open the operator window to sync this local preview" : "Live shared calendar"}</span></footer></main>;
  return <div className="ap-shell"><aside className="ap-sidebar"><a href="/" className="ap-brand"><div className="ap-mark">C<span>+</span></div><span>CROSSPOINTE<small>CENTRAL</small></span></a><p className="ap-nav-label">STAFF WORKSPACE</p><nav><button className={section === "calendar" ? "selected" : ""} onClick={() => setSection("calendar")}><span>▦</span> Annual calendar</button><button className={section === "playbooks" ? "selected" : ""} onClick={() => setSection("playbooks")}><span>▤</span> Phase playbooks</button><a href="/planner"><span>↗</span> Promotion Planner</a></nav><div className="ap-sidebar-bottom"><span className="ap-avatar">{auth.user.displayName?.slice(0, 1) || "C"}</span><div><strong>{auth.user.displayName || "Central staff"}</strong><small>{editable ? "Shared staff workspace" : "Read-only access"}</small></div></div></aside><main className="ap-main"><header className="ap-topbar"><span>Planning <span className="muted">/</span> Annual Planner</span><div className={`ap-save-status ${loadError ? "error" : ""}`} role="status"><i />{loadError ? "Connection needs attention" : saving ? "Saving\u2026" : auth.preview ? "Local preview \xB7 not cloud saved" : "Shared calendar \xB7 connected"}</div></header>{auth.preview && <div className="ap-preview-banner">LOCAL PREVIEW · Changes stay on this browser. <button disabled={saving || committed.length > 0} onClick={async () => {
    try {
      await save(async () => {
        for (const e of createDemoEvents(view.year)) await store.saveEvent(e);
      });
    } catch {
    }
  }}>{committed.length ? "Preview calendar has events" : "Load sample year"}</button></div>}{loadError && <div className="ap-alert" role="alert">{loadError} Changes cannot be verified while disconnected. <button onClick={() => location.reload()}>Reconnect</button></div>}{actionError && <div className="ap-alert" role="alert">{actionError}<button onClick={() => setActionError("")} aria-label="Dismiss error">✕</button></div>}
 <section className="ap-page-heading"><div><p className="eyebrow">ONE YEAR. ONE SHARED PICTURE.</p><h1>{section === "calendar" ? "Plan the year together." : "Build a repeatable rhythm."}</h1><p>{section === "calendar" ? "See the big commitments, make room to prepare, and protect time to recover." : "Editable starting points for the work before, during, and after each event."}</p></div><div className="ap-heading-actions">{section === "calendar" ? <><button onClick={openDisplay}>{displayOpen ? "Open display \u2197" : "Present \u2197"}</button>{editable && <button className="primary" onClick={() => setEvent(makeEvent(templates[0], view.year))}>＋ Plan an event</button>}</> : editable && <button className="primary" onClick={() => setPlaybook({ ...clone(templates[0]), id: createId("playbook"), revision: 0, version: 1, name: "New playbook" })}>＋ New playbook</button>}</div></section>
 {section === "calendar" ? <><div className="ap-workflow"><button onClick={() => setView((v) => ({ ...v, level: "1" }))}><span>01</span><div><b>Place the anchors</b><small>Level 1 · Start here</small></div><em>{anchors}</em></button><button onClick={() => setView((v) => ({ ...v, level: "2" }))}><span>02</span><div><b>Add shared seasons</b><small>Level 2 · Plan the preparation</small></div><em>{visibleYearEvents.filter((e) => e.level === 2 && !restEvent(e)).length}</em></button><button onClick={() => setView((v) => ({ ...v, level: "small" }))}><span>03</span><div><b>Make room for the rest</b><small>Levels 3–5 · Review the fit</small></div><em>{visibleYearEvents.filter((e) => e.level >= 3 && !restEvent(e)).length}</em></button></div><section className="ap-calendar-card"><div className="ap-calendar-toolbar">{controls}<div className="ap-calendar-actions">{editable && <><button onClick={() => setEvent(makeEvent(templates[0], view.year, true))}>＋ Protect rest</button><button aria-label="Capacity signal settings" onClick={() => setSettingsOpen(true)}>Signals ⚙</button></>}</div></div>{draftDisplay && <div className="ap-draft-banner"><span>PROPOSED DISPLAY · {draftDisplay.name} · Not saved</span><button onClick={() => setDraftDisplay(null)}>End preview</button></div>}{timeline}</section><section className="ap-review-panels"><div><div className="ap-panel-heading"><h3>Shared capacity</h3><span>{congestion.length} weeks</span></div><p>Signals follow the demand of overlapping Level 1–2 phases. Each explanation names the work and its actual pressure date.</p>{congestion.length ? <div className="ap-warning-list">{(showAllCapacity ? congestion : congestion.slice(0, 6)).map((w) => <div key={w.startDate}><span className={`ap-warning-dot ${w.severity}`} /><button className="ap-week-detail-link" onClick={() => setInspectedWeek(w)}>{fmt(w.startDate)} ↗</button><span>{w.pressure?.reason}</span><small>{pressureDescription(w)}</small><small className="ap-raw-count">Weekly event-count peak: {w.count} events · {fullDate(w.peakDate || w.startDate)}</small></div>)}{congestion.length > 6 && <button className="text-button ap-show-all" onClick={() => setShowAllCapacity((value) => !value)}>{showAllCapacity ? "Show fewer weeks" : `Show all ${congestion.length} weeks`}</button>}</div> : <p className="ap-quiet">No shared-capacity signals for this year.</p>}</div><div><div className="ap-panel-heading"><h3>Protect the breathing room</h3><span>{restWarnings.length} weeks</span></div><p>Sabbath and recovery remain visible, with their own conflict signals.</p>{restWarnings.length ? <div className="ap-warning-list">{(showAllRest ? restWarnings : restWarnings.slice(0, 5)).map((w) => <div key={w.startDate}><span className="ap-warning-dot rest" /><button className="ap-week-detail-link" onClick={() => setInspectedWeek(w)}>{fmt(w.startDate)} ↗</button><small>{w.restConflicts.map((c) => `${c.restName}: ${c.names.join(", ")}`).join(" \xB7 ")}</small></div>)}{restWarnings.length > 5 && <button className="text-button ap-show-all" onClick={() => setShowAllRest((value) => !value)}>{showAllRest ? "Show fewer weeks" : `Show all ${restWarnings.length} weeks`}</button>}</div> : <p className="ap-quiet">No protected-rest conflicts for this year.</p>}</div></section></> : <section className="ap-playbooks"><div className="ap-note">Proposed starting points, ready to adapt. Playbooks describe preparation and staff rhythm; they do not place events on the calendar until you choose an anchor date.</div><div className="ap-playbook-grid">{templates.map((t) => <article key={t.id} style={{ "--level": COLORS[t.level] }}><div className="ap-panel-heading"><span className="ap-level">LEVEL {t.level}</span><small>Version {t.version}</small></div><h2>{t.name}</h2><p>{t.description}</p><div className="ap-playbook-phases">{t.phases.map((p) => <div key={p.id}><i className={p.kind} /><span>{p.name}{isWorkPhase(p) && <span className="ap-playbook-profile">{phaseProfileText(p)}</span>}</span><small>{p.offsetDays > 0 ? "+" : ""}{timeUnits(p.offsetDays)} · {timeUnits(p.durationDays)}</small></div>)}</div><p className="ap-playbook-meta">{t.meetingCount} Tuesday meetings · {t.recoveryDays} recovery days</p>{editable && <footer><button onClick={() => setPlaybook(t)}>Edit playbook</button><button onClick={() => setEvent(makeEvent(t, view.year))}>Use playbook →</button></footer>}</article>)}</div></section>}
 <footer className="ap-page-footer"><span>CrossPointe Central · Annual Planner</span><span>Shared priorities. Thoughtful preparation. Protected rest.</span></footer></main>{inspectedWeek && <WeekDetails week={weeks.find((w) => w.startDate === inspectedWeek.startDate) || inspectedWeek} events={events} onClose={() => setInspectedWeek(null)} onEvent={(item) => {
    setInspectedWeek(null);
    setEvent(item);
  }} />}{event && <EventEditor initial={event} templates={templates} events={committed} settings={settings} editable={editable && !loadError} year={view.year} onClose={() => {
    setEvent(null);
    setDraftDisplay(null);
  }} onDisplay={displayDraft} onSave={(e) => save(() => store.saveEvent(e))} onDelete={(e) => save(() => store.deleteEvent(e))} />} {playbook && <PlaybookEditor initial={playbook} onSave={(t) => save(() => store.saveTemplate(t))} onClose={() => setPlaybook(null)} />} {settingsOpen && <SettingsEditor settings={settings} onSave={(s) => save(() => store.saveSettings(s))} onClose={() => setSettingsOpen(false)} />}</div>;
}
createRoot(document.getElementById("annual-root")).render(<AuthGate />);
