import React, {useId, useMemo, useState} from "react";
import {buildCampaignRows, campaignActivity} from "./campaign-activity.js";
import {isPromotionWindow} from "./domain.js";
import {describeRecurrence} from "./recurrence.js";

const LEVELS = [
  {level: 1, description: "Major campaigns"},
  {level: 2, description: "Event-based campaigns"},
  {level: 3, description: "Standard campaigns"},
  {level: 4, description: "Targeted promotions"},
  {level: 5, description: "Interest groups & gatherings"},
];

function formatCampaignDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Date needed";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago",
  });
}

function ActivityBadge({activity}) {
  return <span className={`planner-campaign-activity is-${activity.tone}`}>{activity.label}</span>;
}

// Keep the content mounted so both opening and closing use Central's motion curve.
// Inert removes collapsed controls from keyboard navigation immediately.
function CampaignDisclosure({id, expanded, children}) {
  return <div id={id} className={`planner-campaign-disclosure${expanded ? " is-expanded" : ""}`} inert={!expanded} aria-hidden={!expanded}>
    <div>{children}</div>
  </div>;
}

function CampaignEntry({row, workspace, today, canEdit, onOpenCampaign, onEditSeries}) {
  const [expanded, setExpanded] = useState(false);
  const datesId = useId();
  const {campaign, series, occurrences, activity} = row;
  const activeOccurrences = occurrences.filter((item) => !campaignActivity(item, today).inactive).length;
  const dateLabel = series
    ? activity.inactive ? campaign?.status === "archived" ? "Skipped event" : "Last event" : "Next event"
    : isPromotionWindow(campaign) ? "Promote through" : "Event date";
  const type = series ? `Recurring series · ${activeOccurrences} upcoming date${activeOccurrences === 1 ? "" : "s"}`
    : isPromotionWindow(campaign) ? "General promotion"
      : String(campaign?.campaignType || "Event").replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  let recurrence = "Recurring campaign";
  if (series) {
    try { recurrence = describeRecurrence(series.recurrence); } catch { /* Keep repair controls available. */ }
  }
  const playbookId = series?.playbookId || campaign?.playbookId;
  const playbook = workspace.playbooks.find((item) => item.id === playbookId);
  return <article className={`planner-campaign-entry${series?.saveState === "saving" ? " has-alert" : ""}`}>
    <button type="button" className="planner-campaign-open" disabled={!campaign} onClick={() => onOpenCampaign(campaign)}>
      <span className="planner-campaign-identity">
        <strong>{row.name || "Untitled campaign"}</strong>
        <span className="planner-campaign-meta">
          <ActivityBadge activity={activity} />
          <span>{series && activity.inactive ? "Recurring series" : type}</span>
          {row.conflicts > 0 && !activity.inactive && <span className="planner-campaign-activity is-attention">{row.conflicts} conflict{row.conflicts === 1 ? "" : "s"}</span>}
        </span>
      </span>
      <span className="planner-campaign-date"><small>{dateLabel}</small><strong>{formatCampaignDate(row.displayDate)}</strong></span>
      <span className="planner-campaign-open-arrow" aria-hidden="true">›</span>
    </button>
    {series?.saveState === "saving" && <div className="planner-series-save-warning" role="alert"><span><strong>Save interrupted</strong><small>Review this series and retry to finish creating every event and promotion.</small></span>{canEdit && <button className="planner-text-button" onClick={() => onEditSeries(series, campaign)}>Review and retry</button>}</div>}
    {series && <>
      <button type="button" className="planner-campaign-dates-toggle" aria-expanded={expanded} aria-controls={datesId} onClick={() => setExpanded(!expanded)}>
        <span className="planner-campaign-chevron" aria-hidden="true">⌄</span>
        {expanded ? "Hide event dates" : `Show ${occurrences.length} event date${occurrences.length === 1 ? "" : "s"}`}
        <span className="planner-campaign-series-ended">{series.status === "ended" ? "Series ended" : ""}</span>
      </button>
      <CampaignDisclosure id={datesId} expanded={expanded}>
        <div className="planner-campaign-series-detail">
          <p>{recurrence}</p>
          <p>{playbook?.name || playbookId} · Pinned to version {series.playbookVersion}</p>
          <div className="planner-campaign-occurrences">{occurrences.map((item) => <button type="button" key={item.id} onClick={() => onOpenCampaign(item)}>
            <time dateTime={item.eventDate}>{formatCampaignDate(item.eventDate)}</time>
            <ActivityBadge activity={campaignActivity(item, today)} />
            {item.recurrenceException && <small>Edited occurrence</small>}
            <span aria-hidden="true">›</span>
          </button>)}</div>
        </div>
      </CampaignDisclosure>
    </>}
  </article>;
}

export default function CampaignsView({workspace, today, onNewCampaign, onOpenCampaign, onEditSeries, canEdit}) {
  const [view, setView] = useState("active");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({active: new Set(), inactive: new Set()});
  const sectionPrefix = useId();
  const rows = useMemo(() => buildCampaignRows(workspace, today), [workspace, today]);
  const activeCount = rows.filter((row) => !row.activity.inactive).length;
  const inactiveCount = rows.length - activeCount;
  const search = query.trim().toLocaleLowerCase();
  const visible = rows.filter((row) => row.activity.inactive === (view === "inactive") && row.name.toLocaleLowerCase().includes(search));
  const groups = [...LEVELS];
  if (visible.some((row) => !LEVELS.some(({level}) => level === Number(row.level)))) groups.push({level: "review", description: "Check the promotion level"});
  const levelRows = (level) => visible.filter((row) => level === "review" ? !LEVELS.some((item) => item.level === Number(row.level)) : Number(row.level) === level);
  const shownGroups = search ? groups.filter(({level}) => levelRows(level).length) : groups;
  const allCollapsed = shownGroups.length > 0 && shownGroups.every(({level}) => collapsed[view].has(level));
  function toggleLevel(level) {
    setCollapsed((current) => {
      const next = new Set(current[view]);
      if (next.has(level)) next.delete(level); else next.add(level);
      return {...current, [view]: next};
    });
  }
  return <>
    <div className="planner-page-heading planner-campaigns-heading">
      <div><span className="planner-kicker">Promotion Planner</span><h1>Campaigns</h1><p>Your promotion plans, organized by priority.</p></div>
      {canEdit && <div className="planner-heading-actions"><button className="planner-button is-primary" onClick={onNewCampaign}>＋ New campaign</button></div>}
    </div>
    <div className="planner-campaigns-workspace">
      <div className="planner-campaigns-toolbar">
        <div className="planner-campaign-views" role="group" aria-label="Campaign view">
          <button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Active <span>{activeCount}</span></button>
          <button type="button" aria-pressed={view === "inactive"} onClick={() => setView("inactive")}>Inactive <span>{inactiveCount}</span></button>
        </div>
        <label className="planner-campaign-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search campaigns" placeholder="Search campaigns…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="planner-campaigns-caption"><span>{view === "active" ? "Current and upcoming campaigns" : "Ended, completed, and skipped campaigns"}</span>
        {shownGroups.length > 0 && <button type="button" className="planner-text-button" onClick={() => setCollapsed((current) => ({...current, [view]: allCollapsed ? new Set() : new Set(shownGroups.map(({level}) => level))}))}>{allCollapsed ? "Expand levels" : "Collapse levels"}</button>}
      </div>
      <div className="planner-campaign-levels">
        {shownGroups.map(({level, description}) => {
          const items = levelRows(level);
          const expanded = !collapsed[view].has(level);
          const panelId = `${sectionPrefix}-${view}-${level}`;
          return <section key={level} className={`planner-campaign-level is-level-${level}`}>
            <h2><button type="button" className="planner-campaign-level-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggleLevel(level)}>
              <span className="planner-campaign-level-dot" aria-hidden="true" /><strong>{level === "review" ? "Needs review" : `Level ${level}`}</strong><span className="planner-campaign-level-count">{items.length}</span><span className="planner-campaign-level-description">{description}</span><span className="planner-campaign-chevron" aria-hidden="true">⌄</span>
            </button></h2>
            <CampaignDisclosure id={panelId} expanded={expanded}>
              {items.length ? items.map((row) => <CampaignEntry key={row.id} row={row} workspace={workspace} today={today} canEdit={canEdit} onOpenCampaign={onOpenCampaign} onEditSeries={onEditSeries} />) : <p className="planner-campaign-empty">No {view} campaigns</p>}
            </CampaignDisclosure>
          </section>;
        })}
        {search && !visible.length && <div className="planner-campaign-search-empty"><strong>No matching {view} campaigns</strong><p>Try another name or switch to {view === "active" ? "Inactive" : "Active"}.</p><button type="button" className="planner-text-button" onClick={() => setQuery("")}>Clear search</button></div>}
      </div>
      <div className="planner-campaigns-footer"><span role="status">{visible.length} {view} campaign{visible.length === 1 ? "" : "s"} · recurring series count as one</span><span>As of {formatCampaignDate(today)} · Central time</span></div>
    </div>
  </>;
}
