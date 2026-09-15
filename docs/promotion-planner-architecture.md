# Central Promotion Planner Architecture

## Product boundary

Promotion Planner is a same-host, full-page Central product at `/planner`. It follows the proven Studio boundary:

- `public/planner.html` is the hosted entry page.
- `src/planner/` owns Planner React, business logic, persistence, starter data, and styling.
- `public/planner.js` and `public/planner.css` are generated artifacts.
- `scripts/build-planner.mjs` builds the browser bundle with esbuild.
- `firebase.json` rewrites `/planner` and `/planner/**` to the Planner entry page.

Planner does not load or modify `public/admin.js` or `public/admin.css`. All promotion controls live inside `/planner`.

## Existing Central architecture reused

- Static Firebase Hosting with a React 19/esbuild feature bundle.
- Firebase compat SDK initialization from the Hosting-provided `/__/firebase/init.js`.
- Google authentication and the existing `centralAdmin/root/users/{uid}` record.
- Active-user and page-permission semantics (`none`, `view`, `propose`, `edit`, `approve`, `admin`).
- Local Auth and Firestore emulator routing.
- Central's dark-first visual language, typography, favicon, cards, badges, forms, responsive behavior, and reduced-motion support.

Planner reads `pageAccess.planner` when present. During migration it falls back to `pageAccess.studio`, then `pageAccess.settings`, so existing Creative administrators are not unexpectedly locked out.

`/admin/settings/team` manages Promotion Planner as an explicit Creative permission. Super User defaults grant `planner: "admin"`; saved legacy accounts inherit their prior Studio permission when Planner has not been set explicitly.

## Calendar dependency decision

The repository had no calendar component or calendar UI dependency. Planner uses FullCalendar 7's official React 19 integration:

- Month: `dayGridMonth`
- Week: `dayGridWeek`
- Navigation and day links
- Multiple plays per day
- `+more` overflow popovers
- Custom Scheduled Play rendering
- Interaction plugin for manual drag/drop and future scheduling interactions

FullCalendar is only the display and interaction layer. It does not calculate campaign weeks, late submissions, capacity, Level 4 slots, Level 2 coverage, priorities, conflicts, or Smuggle opportunities.

## Business logic boundary

`src/planner/domain.js` contains pure, testable rules:

- America/Chicago submission handling and Sunday-Saturday campaign weeks
- backward anchoring from the event week
- recommended start, days/weeks late, and current campaign week
- independent Scheduled Play generation
- `SKIP`, `NEXT_AVAILABLE_SLOT`, `NEXT_OCCURRENCE`, and `MANUAL_REVIEW`
- general capacity conflict recommendations
- constrained Level 4 Monday/Friday Social allocation
- Level 2 event-first standing lane fallback
- explainable Level 4-before-Level 5 Smuggle recommendations
- explicit-only Smuggle application
- weekly utilization summaries

No schedule is hardcoded into the engine. It consumes editable Playbook Definition records.

## Firestore model

The target is the existing Standard edition, Firestore Native `(default)` database in `us-central1`.

| Collection | Purpose |
| --- | --- |
| `centralPromotionPlaybooks` | Current playbook metadata and current-version pointer |
| `centralPromotionPlaybookVersions` | Immutable snapshots of editable week/play definitions |
| `centralPromotionCampaigns` | Event, original submission, timeliness, status, and stored playbook version |
| `centralPromotionCampaignSeries` | Event recurrence, pinned playbook, shared defaults, relative deadline, and save/revision state |
| `centralPromotionScheduledPlays` | Independent dated records used by Calendar and Campaign detail |
| `centralPromotionCapacityRules` | Editable promotional inventory and allocation configuration |
| `centralPromotionStandingLanes` | Editable recurring Level 2 coverage configuration |
| `centralPromotionRequests` | Idempotent, server-created Planning Center form requests awaiting review |

Scheduled Plays always retain both `originalScheduledDate` and `scheduledDate`. Manual changes update only the Scheduled Play. Playbook saves create a new version rather than rewriting previous version snapshots.

Planning Center People form submissions enter through the signed
`/api/webhooks/planning-center/forms` endpoint. The webhook stores only the
campaign-planning subset of each qualifying submission. A Planner editor must
confirm the name, primary event date, level, and playbook before Central creates
the campaign. General Promotion submissions always require manual date review;
Event/Promo submissions use conservative free-text parsing and retain the
original date answer.

Scheduled Plays are loaded in `scheduledDate` order without the former -70/+400-day cutoff. A saved yearly occurrence and every competing campaign must be available to reports, exceptions, and capacity evaluation. This still uses a Standard edition single-field index. If inventory grows substantially, replace this full-workspace read with coordinated range queries for every consumer; do not reintroduce a calendar-only horizon that silently drops saved promotions.

## Recurring event campaigns

`src/planner/recurrence.js` expands event dates. `src/planner/series.js` turns each event into an independent campaign using the existing backward-counting playbook. The calendar never expands virtual repeat events on its own.

- Weekly patterns select weekdays and an interval. Monthly patterns select a date, last day, or one or more ordinal weekdays (for example, first and third Wednesday). Yearly patterns use the first event's month. Month-end behavior explicitly skips missing dates or uses the last day; missing fifth weekdays are skipped.
- Every series ends on a date or after a count, with at most 100 event occurrences within five years of its start. There is no unattended, indefinite generation job.
- A series pins its playbook version and stores shared brief copy plus a registration deadline offset in days. Existing campaigns can become the first occurrence without changing campaign or promotion IDs.
- Each occurrence has `seriesId`, an immutable original `occurrenceKey` (timestamp in Firestore, date key in JavaScript), `seriesRevision`, and `recurrenceException`. A moved event retains its occurrence key. A skipped occurrence is retained as an archived exception, preventing accidental regeneration.
- Future edits preserve previous events and explicit exceptions. Completed, past, locked, manually adjusted, and Smuggle-linked promotions retain their history during recalculation. Explicit Skip and End cancel all affected future, uncompleted promotions, including locked and manually moved ones. Occurrence edits preview recalculated promotions. Ending a series archives affected future occurrences rather than deleting history.
- Explicit global playbook regeneration can advance an occurrence's version. Later series edits preserve those upgraded occurrences; the series' pinned version continues to control new dates.
- Series previews evaluate the combined workspace, reserve protected promotions, and include changes to competing campaigns in the save plan. Reports continue to group by occurrence campaign ID and show its actual event date.
- Persistence checks preview dependencies before saving, then saves at most five records per optimistic transaction. Expected prior records prevent overwriting concurrent edits; identical completed writes are accepted on retry. A `saving` series remains marked until all records finish, and must be resumed before another revision begins. Its cutoff and original campaign ID persist for recovery. Limits also cap each save at 5,000 records.
- Existing Planning Center request conversion remains one event per reviewed request. Its resulting campaign can be made recurring through **Repeat campaign**; free-text dates are not automatically interpreted as recurrence.

## Starter configuration

`src/planner/seed-data.js` translates the supplied Level 1-5 Campaign Playbooks into editable starter records:

- Level 1 Major
- Level 2 Event-Based
- Level 2 Ongoing Awareness
- Level 2 Ongoing Interest
- Level 3 Featured and Standard
- Level 4 Featured and Standard
- Level 5 Interest Window
- Stage, Newsletter Feature, Newsletter Event Card, and Level 4 Social capacity rules
- Newsletter Event Cards use a typical planning target of 4 and a hard weekly maximum of 6
- Level 2 weekly standing lane

The PDFs remain reference material. The authenticated UI shows starter configuration without writing it. An editor must explicitly choose **Publish starter configuration**; after that, Firestore is the operational source of truth.

## Access and safety

- No Planner collection is publicly readable.
- Active Central admins with Planner access may read.
- `view` is read-only.
- `propose`, `edit`, `approve`, and `admin` may create/update Planner data.
- One-off campaigns and their promotions may be deleted together by Planner editors. Recurring occurrences must be skipped; series deletion is denied.
- Browser creation and deletion of Planning Center form requests are denied;
  only review-owned fields can be updated by Planner editors.
- Playbook versions are immutable.
- Campaign playbook/submission history and Scheduled Play source history are immutable.
- Creates and updates use strict top-level schemas, type/range/length checks, trusted admin authorization, and server timestamps.
- Smuggle records require an explicit relationship schema with strategy `SMUGGLE`.

## Local verification

```bash
npm run build:planner
npm run test:planner
npm run test:planner-rules
npm run check:syntax
```

For UI review through Hosting:

```text
http://127.0.0.1:5005/planner?preview=1
```

Preview mode uses representative in-memory campaigns and never writes Firestore.
