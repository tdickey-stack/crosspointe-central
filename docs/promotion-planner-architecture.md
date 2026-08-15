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
| `centralPromotionScheduledPlays` | Independent dated records used by Calendar and Campaign detail |
| `centralPromotionCapacityRules` | Editable promotional inventory and allocation configuration |
| `centralPromotionStandingLanes` | Editable recurring Level 2 coverage configuration |

Scheduled Plays always retain both `originalScheduledDate` and `scheduledDate`. Manual changes update only the Scheduled Play. Playbook saves create a new version rather than rewriting previous version snapshots.

The initial Scheduled Play query is bounded from 70 days before today through 400 days after today and ordered by `scheduledDate`. That uses a Standard edition single-field index; no new composite index is required.

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
- Browser deletes are denied.
- Playbook versions are immutable.
- Campaign playbook/submission history and Scheduled Play source history are immutable.
- Creates and updates use strict top-level schemas, type/range/length checks, trusted admin authorization, and server timestamps.
- Smuggle records require an explicit relationship schema with strategy `SMUGGLE`.

## Local verification

```bash
pnpm run build:planner
pnpm run test:planner
pnpm run test:planner-rules
pnpm run check:syntax
```

For UI review through Hosting:

```text
http://127.0.0.1:5005/planner?preview=1
```

Preview mode uses representative in-memory campaigns and never writes Firestore.
