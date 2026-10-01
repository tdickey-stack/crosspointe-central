import React, {useEffect, useMemo, useState} from "react";
import {addDays, planningWeekRange} from "./domain.js";
import {buildPromotionTimeline, timelinePosition, timelineRange} from "./timeline-layout.js";

const COLORS = {1: "#ef3e2d", 2: "#f59e0b", 3: "#4bb8e9", 4: "#4bc3a7", 5: "#a78bfa", 6: "#f472b6"};
const labelDate = (value) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"});
const review = (day) => day.plays.some((play) => ["conflict", "needs-decision"].includes(play.status) || (play.conflictState && play.conflictState !== "none"));

// Give nearby date buttons their own tracks so every marker remains clickable.
function arrangeDays(days, range, width) {
  const ends = [];
  const items = days.map((day) => {
    const position = timelinePosition(day.scheduledDate, day.scheduledDate, range);
    const x = parseFloat(position.left) * width / 100;
    let track = ends.findIndex((end) => end + 4 <= x);
    if (track < 0) track = ends.length;
    ends[track] = x + 22;
    return {day, track, position};
  });
  return {items, height: Math.max(1, ends.length) * 28};
}

function PromotionDates({arrangement, onOpenGroup}) {
  return <div className="planner-timeline-dates" style={{height: arrangement.height}}>{arrangement.items.map(({day, track, position}) => {
    const title = `${day.campaignName} · ${labelDate(day.scheduledDate)} · ${day.plays.map((play) => `${play.playType}${play.smuggle ? " (Smuggle)" : ""}`).join(", ")}${review(day) ? " · Needs review" : ""}`;
    return <button key={day.id} className={`planner-timeline-promotion ${review(day) ? "needs-review" : ""}`} style={{left: position.left, top: track * 28}} title={title} aria-label={title} onClick={() => onOpenGroup(day)}>{review(day) ? "!" : day.plays.length}</button>;
  })}</div>;
}

export function PromotionTimelineView({workspace, today, onRangeChange, onOpenCampaign, onOpenGroup}) {
  const [view, setView] = useState(() => ({year: Number(today.slice(0, 4)), quarter: Math.ceil(Number(today.slice(5, 7)) / 3), zoom: "quarter"}));
  const [level, setLevel] = useState("");
  const range = useMemo(() => timelineRange(view), [view]);
  useEffect(() => {
    onRangeChange((current) => current?.startDate === range.startDate && current?.endDate === range.endDate ? current : range);
  }, [range, onRangeChange]);
  const layout = useMemo(() => buildPromotionTimeline(workspace, range, {level}), [workspace, range, level]);
  const width = view.zoom === "year" ? 1800 : 1100;
  const firstMonth = view.zoom === "year" ? 1 : (view.quarter - 1) * 3 + 1;
  const months = Array.from({length: view.zoom === "year" ? 12 : 3}, (_, index) => {
    const month = firstMonth + index;
    const start = `${view.year}-${String(month).padStart(2, "0")}-01`;
    const next = month === 12 ? `${view.year + 1}-01-01` : `${view.year}-${String(month + 1).padStart(2, "0")}-01`;
    return {start, end: addDays(next, -1), label: new Date(`${start}T12:00:00Z`).toLocaleDateString("en-US", {month: "long", timeZone: "UTC"})};
  });
  const weekTicks = [];
  if (view.zoom === "quarter") {
    let week = planningWeekRange(range.startDate).startDate;
    if (week < range.startDate) week = addDays(week, 7);
    while (week <= range.endDate) {
      weekTicks.push(week);
      week = addDays(week, 7);
    }
  }
  const navigate = (direction) => setView((current) => {
    if (current.zoom === "year") return {...current, year: current.year + direction};
    const next = current.quarter + direction;
    return {...current, year: current.year + (next < 1 ? -1 : next > 4 ? 1 : 0), quarter: next < 1 ? 4 : next > 4 ? 1 : next};
  });
  const grids = months.map((month) => <span key={month.start} className="planner-timeline-gridline" style={{left: timelinePosition(month.start, month.end, range).left}} />);
  const todayVisible = today >= range.startDate && today <= range.endDate;
  const ongoing = arrangeDays(layout.ongoing, range, width);
  return <>
    <div className="planner-page-heading"><div><span className="planner-kicker">Promotion plan</span><h1>Promotion timeline</h1><p>Campaign phases and scheduled promotions on one shared timeline.</p></div><div className="planner-heading-actions"><div className="planner-segmented" aria-label="Timeline range">{["quarter", "year"].map((zoom) => <button key={zoom} className={view.zoom === zoom ? "is-active" : ""} aria-pressed={view.zoom === zoom} onClick={() => setView({...view, zoom})}>{zoom === "quarter" ? "Quarter" : "Year"}</button>)}</div></div></div>
    <section className="planner-panel planner-timeline-panel">
      <div className="planner-timeline-toolbar">
        <div className="planner-timeline-navigation"><button className="planner-button is-secondary" aria-label={`Previous ${view.zoom}`} onClick={() => navigate(-1)}>←</button><h2>{view.zoom === "quarter" ? `Q${view.quarter} · ` : ""}{view.year}</h2><button className="planner-button is-secondary" aria-label={`Next ${view.zoom}`} onClick={() => navigate(1)}>→</button><button className="planner-button is-secondary" onClick={() => setView({...view, year: Number(today.slice(0, 4)), quarter: Math.ceil(Number(today.slice(5, 7)) / 3)})}>Today</button></div>
        <label className="planner-filter-select"><span>Level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">All campaigns & content</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Level {value}</option>)}</select></label>
      </div>
      <div className="planner-timeline-legend"><span><b className="phase" />Campaign phase</span><span><b className="event">◆</b>Event date</span><span><b className="promotion">3</b>Promotions on a date</span><span><b className="review">!</b>Needs review</span></div>
      <p className="planner-timeline-help">Select a campaign or phase for details; select a numbered date for its promotion brief. Scroll across to see the full range.{view.zoom === "year" && " Switch to Quarter for more detail."}</p>
      <div className="planner-timeline-scroll" tabIndex={0} role="region" aria-label={`${view.year} promotion timeline, scroll horizontally`}>
        <div className="planner-timeline-canvas" style={{minWidth: width}}>
          <div className="planner-timeline-caption"><span>{layout.groups.length} campaigns & content items</span><span>{labelDate(range.startDate)} – {labelDate(range.endDate)}</span></div>
          <div className="planner-timeline-months">{months.map((month) => <div key={month.start} style={timelinePosition(month.start, month.end, range)}>{month.label}</div>)}</div>
          {weekTicks.length > 0 && <div className="planner-timeline-weeks" aria-label="Weeks beginning Monday">{weekTicks.map((week) => <span key={week} style={{left: timelinePosition(week, week, range).left}}>{labelDate(week).replace(`, ${view.year}`, "")}</span>)}</div>}
          <div className="planner-timeline-work">
            {grids}
            {todayVisible && <div className="planner-timeline-today" style={{left: timelinePosition(today, today, range).left}}><span>Today</span></div>}
            {layout.lanes.map((lane, index) => {
              const dates = arrangeDays(lane.groups.flatMap((group) => group.days).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.id.localeCompare(right.id)), range, width);
              const height = dates.height + 82;
              return <div className="planner-timeline-lane" key={index} style={{height, "--timeline-level": COLORS[lane.level]}}><span className="planner-timeline-lane-level">{lane.level === 6 ? "Content" : `L${lane.level}`}</span>{lane.groups.map((group) => {
                const eventVisible = group.campaign.eventDate >= range.startDate && group.campaign.eventDate <= range.endDate && lane.level !== 6;
                return <React.Fragment key={group.id}>
                  <div className="planner-timeline-envelope" style={timelinePosition(group.startDate, group.endDate, range)}>
                    <button className="planner-timeline-campaign" title={`${group.campaign.name} · ${labelDate(group.startDate)} – ${labelDate(group.endDate)}`} onClick={() => onOpenCampaign(group.campaign)}><strong>{group.campaign.name}</strong></button>
                  </div>
                  {group.phases.map((phase) => <button key={phase.id} className="planner-timeline-phase" aria-label={`${group.campaign.name}, ${phase.name}, ${labelDate(phase.startDate)} to ${labelDate(phase.endDate)}`} style={timelinePosition(phase.startDate, phase.endDate, range)} title={`${group.campaign.name} · ${phase.name} · ${labelDate(phase.startDate)} – ${labelDate(phase.endDate)}`} onClick={() => onOpenCampaign(group.campaign)}>{phase.name}</button>)}
                  {eventVisible && <button className="planner-timeline-event" style={{left: timelinePosition(group.campaign.eventDate, group.campaign.eventDate, range).left}} title={`${group.campaign.name} · Event: ${labelDate(group.campaign.eventDate)}`} aria-label={`${group.campaign.name}, event date ${labelDate(group.campaign.eventDate)}`} onClick={() => onOpenCampaign(group.campaign)}>◆</button>}
                </React.Fragment>;
              })}<PromotionDates arrangement={dates} onOpenGroup={onOpenGroup} /></div>;
            })}
            {!layout.groups.length && <div className="planner-empty-state"><h3>No campaigns in this range</h3><p>Try another quarter, year, or level.</p></div>}
          </div>
          {layout.ongoing.length > 0 && <div className="planner-timeline-ongoing" style={{"--timeline-level": COLORS[2]}}><h3>Level 2 ongoing coverage</h3><p>Weekly fallback promotions when no Level 2 event campaign covers the week.</p><div className="planner-timeline-ongoing-dates" style={{height: ongoing.height + 8}}>{grids}<PromotionDates arrangement={ongoing} onOpenGroup={onOpenGroup} /></div></div>}
        </div>
      </div>
    </section>
  </>;
}
