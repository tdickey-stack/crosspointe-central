import React from "react";

import {defaultRecurrence} from "./recurrence.js";

export const RECURRENCE_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_OPTIONS = [
  {value: 1, label: "First"},
  {value: 2, label: "Second"},
  {value: 3, label: "Third"},
  {value: 4, label: "Fourth"},
  {value: 5, label: "Fifth"},
  {value: -1, label: "Last"},
];

function utcWeekday(dateKey) {
  const parsed = new Date(`${dateKey}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getUTCDay();
}

export function recurrenceForFrequency(startDate, frequency) {
  const initial = defaultRecurrence(startDate);
  return {
    ...initial,
    frequency,
    startDate,
    count: frequency === "yearly" ? 5 : initial.count,
    weekdays: [utcWeekday(startDate)],
  };
}

function NumberField({label, value, min, max, onChange, help = ""}) {
  return <label className="planner-field"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />{help && <small>{help}</small>}</label>;
}

function ToggleGrid({legend, options, selected, onChange}) {
  return <fieldset className="planner-recurrence-toggles"><legend>{legend}</legend><div>{options.map((option) => {
    const active = selected.includes(option.value);
    return <button type="button" className={active ? "is-active" : ""} aria-pressed={active} key={option.value} onClick={() => onChange(active ? selected.filter((value) => value !== option.value) : [...selected, option.value])}>{option.label}</button>;
  })}</div></fieldset>;
}

export function RecurrenceFields({recurrence, onChange}) {
  const update = (updates) => onChange({...recurrence, ...updates});
  const intervalUnit = recurrence.frequency === "weekly" ? "weeks" : recurrence.frequency === "monthly" ? "months" : "years";
  return <div className="planner-recurrence-controls">
    <div className="planner-form-grid">
      <NumberField label={`Repeat every (${intervalUnit})`} min={1} max={12} value={recurrence.interval} onChange={(interval) => update({interval})} />
      <label className="planner-field"><span>Ends</span><select value={recurrence.endType} onChange={(event) => update({endType: event.target.value})}><option value="count">After a number of events</option><option value="date">On a date</option></select></label>
      {recurrence.endType === "count" ? <NumberField label="Number of events" min={1} max={100} value={recurrence.count} onChange={(count) => update({count})} /> : <label className="planner-field"><span>Last event on or before</span><input type="date" min={recurrence.startDate} value={recurrence.until || ""} onChange={(event) => update({until: event.target.value})} /></label>}
    </div>

    {recurrence.frequency === "weekly" && <ToggleGrid legend="Repeat on" options={RECURRENCE_DAY_NAMES.map((label, value) => ({label: label.slice(0, 3), value}))} selected={recurrence.weekdays || []} onChange={(weekdays) => update({weekdays})} />}

    {recurrence.frequency === "monthly" && <>
      <div className="planner-recurrence-choice" role="group" aria-label="Monthly pattern">
        <button type="button" className={recurrence.monthlyMode === "date" ? "is-active" : ""} onClick={() => update({monthlyMode: "date"})}>Day of month</button>
        <button type="button" className={recurrence.monthlyMode === "weekday" ? "is-active" : ""} onClick={() => { const seeded = defaultRecurrence(recurrence.startDate); update({monthlyMode: "weekday", weekdays: recurrence.weekdays?.length ? recurrence.weekdays : seeded.weekdays, ordinals: recurrence.ordinals?.length ? recurrence.ordinals : seeded.ordinals}); }}>Weekday of month</button>
      </div>
      {recurrence.monthlyMode === "date" ? <div className="planner-form-grid">
        <label className="planner-field"><span>Day</span><select value={recurrence.monthDay} onChange={(event) => update({monthDay: Number(event.target.value)})}>{Array.from({length: 31}, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}<option value="-1">Last day</option></select></label>
        <label className="planner-field"><span>When a month is shorter</span><select value={recurrence.missingDate} onChange={(event) => update({missingDate: event.target.value})}><option value="skip">Skip that month</option><option value="last-day">Use its last day</option></select></label>
      </div> : <>
        <ToggleGrid legend="Which occurrence" options={ORDINAL_OPTIONS} selected={recurrence.ordinals || []} onChange={(ordinals) => update({ordinals})} />
        <ToggleGrid legend="Weekdays" options={RECURRENCE_DAY_NAMES.map((label, value) => ({label: label.slice(0, 3), value}))} selected={recurrence.weekdays || []} onChange={(weekdays) => update({weekdays})} />
      </>}
    </>}

    {recurrence.frequency === "yearly" && <label className="planner-field planner-recurrence-policy"><span>When this date is missing</span><select value={recurrence.missingDate} onChange={(event) => update({missingDate: event.target.value})}><option value="skip">Skip that year</option><option value="last-day">Use the month’s last day</option></select><small>This matters for dates such as February 29.</small></label>}
  </div>;
}
