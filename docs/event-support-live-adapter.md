# Central Notifications: gated PCO adapter

This is the review build for [issue #16](https://github.com/tdickey-stack/crosspointe-central/issues/16),
on `codex/central-notifications-phase1`. **The adapter cannot prepare or send invitations.**
Team leaders schedule people and send native PCO invitations. Prepared-but-unsent
invitations are a normal observed state, not a setup failure or confirmed coverage.
Default preview and observation remain read-only. A separate, explicitly approved
creation executor can create only the two empty test plans and their times.
It is an isolated Node tool, not deployed Central infrastructure. The authorized
empty-plan creation and subsequent manual scheduling are recorded below.

The original client and `adapter-cli.mjs` still permit only allowlisted GETs.
`creation-cli.mjs` defaults to an offline manifest. Its execution mode requires
the exact reviewed manifest hash, complete source links and a private journal.
The creation transport permits only marked private Plan creation, disabling
reminders on those owned plans, and the four exact PlanTime creations. It rejects
assignments, invitation preparation/sending, imports, rescheduling, Calendar or
team changes, and deletion. Rescheduling and response resets remain simulation-only.

## Selected controlled test

All local times below are America/Chicago, CDT, in 2026.

| Record | Event | Tech arrival | Participants |
| --- | --- | --- | --- |
| A, initial | October 28, 6–7 PM | 5 PM | Riley Baker: Sound; Tyler Dickey: Graphics |
| B, control | October 28, 6–7 PM | 5 PM | None |
| A, rescheduled | October 29, 7–8 PM | 6 PM | Same two people |

Tyler is the sole test leader and response recipient. The dedicated Event
Support service type will contain a non-split Tech team, default unconfirmed
responses, and Sound/Graphics roles. Service-type scheduled publishing must be
explicitly disabled; a missing setting also stops preflight. The team's prepared
notification default is observed, not enforced or changed. Tech's default arrival offset is 60 minutes;
an occurrence can override it. This does not set a default for other teams.

`scripts/event-support-harness/selected-test-plan.json` contains the selected
people and UTC times. Uncreated/unlinked resource IDs remain null. Never infer
links from a date or a similar name. A and B require distinct Calendar parent,
occurrence, plan and time IDs. Services titles include deterministic run markers.

## Commands

Use Node 22 or later from the repository root. No dependency installation is
required for these modules.

```sh
# Offline preview, also the default when no arguments are supplied:
node scripts/event-support-harness/adapter-cli.mjs --preview

# Original fictional simulation plus adapter and transport/journal tests:
node --test test/event-support-harness.test.mjs test/event-support-adapter.test.mjs test/event-support-adapter-infrastructure.test.mjs test/event-support-creation-client.test.mjs test/event-support-creation-cli.test.mjs

# Exact creation payloads, without credentials, journal access or network:
node scripts/event-support-harness/creation-cli.mjs --preview
```

For an explicitly requested read-only preflight, provide `PCO_APP_ID` and
`PCO_SECRET` through the process environment using the existing secure credential
workflow. Do not paste secrets into command lines or checked-in files. The CLI
does not load `.env`, local secret files, Firebase, or Secret Manager itself.

```sh
node scripts/event-support-harness/adapter-cli.mjs --read-only \
  --config scripts/event-support-harness/selected-test-plan.json \
  --journal-dir /private/tmp/central-notifications-readonly-review
```

Use a **dedicated** canonical directory; the journal sets that directory to 0700
and its files to 0600. Do not supply a shared directory such as `/private/tmp`
itself. Symlink path components, including macOS `/tmp`, are rejected. Local
evidence kept under `output/event-support-private/` is gitignored.

Read-only mode lists exact-name service type candidates without selecting one,
reads the selected Services people, checks explicitly linked Calendar occurrences,
and reports missing IDs. With all IDs supplied or recovered from validated journal
bindings, it checks the team and captures A/B. Preflight reports the effective
links while retaining the original reviewed scope hash. A binding must match
its completed creation operation, resource ID and original request intent.

Read-only reporting is independent of proposal generation and remains usable
after a partial move, a completed move, and renewed native responses. It does
not automatically build another reschedule proposal. Request the initial
baseline-to-target proposal explicitly through `adapter.previewReschedule()`;
that separate operation still rejects times that no longer match its baseline.
No POST, PATCH, DELETE or native action is sent.
On the observation CLI, `--execute`, `--live`, `--send`, unknown and duplicate arguments fail before
credential access. A preview with missing IDs is useful but is not live readiness.

## What is implemented

- Fixed PCO origin, no redirects or foreign next-page links, pinned Services
  `2018-11-01` and Calendar `2022-07-07` versions. GET retries are bounded;
  pagination fails closed on incomplete, inconsistent or ambiguous results.
- Exact service/team/parent/occurrence/plan/time/participant mapping checks.
  The selected leader, response preferences, non-split team and roles are checked.
  A private plan with reminders disabled and empty per-time reminders is required.
- Sanitized, durable local snapshots. Raw notes, contacts, decline text, response
  bodies and credentials are not journaled. A failed read retains prior snapshots;
  it never fabricates zero coverage or a cancellation.
- Proposed creation of private marked plans, then a separate reminder-disable
  PATCH, then named arrival/service times while the roster is empty. Reminder
  disabling is not a documented Plan-create attribute, so it is a separate step.
  See the official [Plan contract](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan).
- Both configured time IDs must be null before time creation begins. A partial
  configuration fails before either POST; valid journal-created times can still
  be reconciled and replayed without editing the reviewed configuration.
- Simulation of the exact time PATCHes and only confirmed assignment resets.
  Arrival shifts from 5 PM to 6 PM. Declined/unconfirmed assignments are not
  patched. Mixed or partial time assignments require manual review. PlanTime
  ownership is established through the exact plan's complete time collection;
  the resource has no documented plan relationship. See the official
  [PlanTime contract](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan_time).
- Scope and intent hashes, exclusive journal locks, atomic file replacement and
  fsync. Intent is saved before each simulated mutation. Lost create/PATCH
  responses are reconciled by readback; ambiguous or missing evidence stops for
  repair. An uncertain POST is never automatically resent, even if a later lookup
  is empty. Restarts retain completed operations and original response snapshots.
- Control B and A's roster/response evidence are rechecked before rescheduling.
  Unexpected changes stop the workflow. B is checked again afterward.

PlanPerson invitation preparation, delivery, and response are separate observations:

- `notificationPrepared` reflects PCO's `prepare_notification` boolean, including
  `true` when `notification_prepared_at` is null. A missing flag is reported as
  null (unknown), never inferred from its timestamp.
- `notificationSent` is true when a valid `notification_sent_at` exists, false
  for an explicit null, and null when that field is absent. Both original
  timestamps remain available. A prepared invitation may retain an earlier sent
  timestamp; neither observation erases the other.
- `status` remains PCO's `U`, `C`, or `D`. Preparation or sending does not turn
  an unconfirmed assignment into a confirmed one, and confirmation does not
  invent a sent invitation. Native PCO supports leader-controlled sending as
  described in [Send scheduling emails](https://help.planningcenter.com/en/142892-send-scheduling-emails.html).

`invitationsEnabled: false` describes the adapter's inability to send, not whether
a native PCO invitation is prepared. A team's `default_prepare_notifications`
may be true or false; missing values are unknown observations. None is an
invitation-sending instruction. Preparation and delivery changes still count as
evidence drift during a pending simulated reschedule, so recovery requires review
rather than overwriting a leader's intervening work.

PlanPerson status/timestamps are observations, not proof of renewed acceptance.
The adapter returns `confirmedRevision: null` and manual-evidence-required
coverage, even when PCO returns `C`. The approved baseline stays one Sound and one
Graphics; PCO's remaining needed-position quantities cannot reduce it. The
[NeededPosition contract](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/needed_position)
describes unfilled positions. Decline reason presence is retained, but its text
is deliberately excluded; this adapter cannot prove unchanged reason wording.

## Journal recovery and review limits

Keep the journal with the run. Never delete it to bypass an uncertain result.
A changed scope hash, duplicated marker, missing resource after a prior intent,
or changed completed result requires inspection. A lock remaining after a process
crash is not stolen automatically: confirm the process is gone, inspect the
journal and upstream resources, and explicitly recover the lock. Never use a new
run marker as a shortcut that could create duplicates.

The selected configuration records the verified service type, team, and four
Calendar source IDs. Original plan/time IDs must remain null. A read-only
preflight journal may be archived and replaced when completing that configuration,
because it has performed no mutations. Once a run owns mutations, preserve its
bindings and journal; do not edit the scope or restart with an empty journal.
After creation, leave the original null plan/time fields unchanged. Preflight
and capture use verified journal bindings automatically; do not copy created IDs
back into the configuration or replace the journal to make preflight pass.

The process lock protects one local journal. It is not a distributed lease and
does not prevent concurrent native PCO edits. Reads and writes are not an upstream
transaction. A future live execution must therefore be attended and isolated;
conflicts and partial application stop for review, not automatic rollback.

## Controlled live test checklist

1. Review the creation manifest after setup links are complete, then explicitly
   authorize those live operations. This creation stage is completed below.
2. Complete the existing Event Support/Tech setup with Tyler's routing settings and the two roles.
   Office/native Calendar setup creates internal, unpublished A/B events without
   public Central tags, room bookings or equipment requests. Enter exact IDs.
   Calendar writes, service/team administration and public visibility verification
   are manual steps; the adapter only reads linked Calendar identities/times.
3. Verify PCO write permissions and accepted plan/time payloads in the isolated
   test. Exercise a controlled lost-response recovery, then confirm exactly two
   distinct same-day plans with reminders off before anyone is added.
4. Configure and verify the needed-position role/time mappings in native Services.
   Their create payload has not been proved. Tyler assigns Riley and himself on
   A only and sends native invitations. Assignment creation, invite preparation,
   and invitation sending are not implemented in this adapter.
5. After separately authorizing native invitations, observe Riley accept and Tyler decline, including response delivery to Tyler.
   Record the original snapshot. Move only Calendar A to the selected target,
   review the exact proposal, and verify each mapped time and targeted reset.
   The live creation executor cannot apply that reschedule; a separately reviewed
   extension is still required for live time changes and response resets.
6. Verify Tyler's decline and history remain intact. Tyler sends Riley a renewed
   invitation in Services. Observe Riley's fresh response and test an old link;
   determine whether native evidence can distinguish current-revision acceptance.
   Expected manual coverage is 1/2, then 0/2, then 1/2; Graphics remains a gap.
7. Review and remove only the disposable test assignments, reminders, plans,
   Calendar records and memberships. Retain the empty Event Support/Tech setup
   and roles. Cleanup is manual; no DELETE executor is shipped.

Automated notifications, Firestore, production scheduling, distributed retries,
deployment, and full coverage certification remain outside this review build.

## Read-only evidence — October 21, 2026

The initial committed suite passed 62 tests: 18 original domain/harness tests, 23 transport
and journal tests, and 21 adapter behavior tests. This includes uncertain
POST/PATCH recovery across journal reopen, plus changed-response and changed-B
recovery checks that stop before further mutations. These are simulated writes,
not evidence of accepted live write payloads or delivered invitations.

The real adapter completed three PCO GET requests (all HTTP 200): the complete
service-type list and the two selected Services person records. Riley Baker and
Tyler Dickey matched their selected IDs. Event Support was not present. Calling
the mutation entry point with that same client returned `LIVE_WRITES_DISABLED`
and made **zero additional requests**. No PCO records were created or changed,
and no invitations were sent. Full linked-plan checks remain pending test setup.

## Review-fix validation — October 21, 2026

All four review findings are addressed: preflight resolves validated journal-owned
IDs without changing the approved scope hash; current-state reporting no longer
constructs a reschedule proposal; scheduled publishing is explicitly disabled;
and time creation validates the entire configured pair before any mutation.
The earlier restriction on native invitation preparation was removed after the
leader-controlled workflow was clarified; it is normal PCO state.

The revised suite passes 67 tests: 18 domain/harness, 23 transport/journal, and 26
adapter tests. The full simulated lifecycle starts with unbound A/B plan and time
IDs, creates both plans, reopens the journal, captures the linked records,
reschedules A, and reports a fresh participant response while preserving B.
Lost create and update responses recover without duplicate writes. Binding
tampering and unsafe setup fail closed. Read-only reports never send or mutate.
Syntax checks, diff checks, and independent review also passed.

At that review milestone, live transport remained GET-only, mutation methods remained simulation-only, and
invitations remain disabled. These checks do not establish live write acceptance,
invitation delivery, or current-revision coverage; those still require the
separately reviewed controlled test above.

## Creation executor and exact proposed live changes

Read-only verification on October 21 confirmed that **Event Support already exists
as service type `1832664`**, is not archived/deleted, and has scheduled publishing
off. The connector reports Administrator permission; this does not prove the
executor credential's write permission. The selected configuration now records
that service type and its **Tech team `7589233`**. No new service type is proposed.

### Authorized team setup completed

On October 21, the authorized setup changes were saved in native Services and
verified by readback:

- Tech's `default_prepare_notifications` is now **false**, confirmed by the
  connector and the unchecked Prepared setting in Services.
- Added Graphics as position **`40099720`**. Preserved Audio, Camera, Lights,
  Lyrics, Producer, Sound (`40099423`), and Video Switcher, including their IDs.
  There are now eight positions and no team members. The test's staffing baseline
  remains one Sound and one Graphics; no participants were added or scheduled.
- Native Services shows Tyler Dickey (`15109003`) as the sole team leader
  (`8543739`), with Accept and Decline notifications both enabled.
- Changed the scheduling default **Replies to** from All Team Leaders to
  **Tyler Dickey** to match the explicit test recipient. Declined the option to
  update already scheduled people; existing assignments were not changed.
- Tech remains non-split (`schedule_to: plan`) and defaults to `U`. Scheduling gap
  alerts and automatic signup sheets are off. Scheduled publishing was verified
  off on the Event Support service type. No invitation was prepared or sent.

These administrative changes used native Services, not the creation executor.
No test plan or Calendar record was created during that Services setup step.
The executor still makes no team edits.

### Calendar sources created and linked — October 21, 2026

The separately authorized native Calendar setup created these two internal test
events on CrossPointe Church calendar `81946`, owned by Tyler:

| Test | Exact Calendar name | Parent ID | Occurrence ID |
| --- | --- | --- | --- |
| A | TEST — Central Notifications A — NOT A REAL EVENT | `23139957` | `240573824` |
| B | TEST — Central Notifications B — CONTROL — NOT A REAL EVENT | `23139985` | `240574002` |

Both run October 28, 2026, 6–7 PM America/Chicago (`23:00Z`–`00:00Z`).
Both are unpublished on Church Center, excluded from shared calendars/iCal and
kiosks, have no tags, location, or resource bookings, and do not repeat. They
remain visible to internal Calendar users. Their descriptions explicitly tell
Cathy/office that no staffing, promotion, setup, or equipment is requested.
These settings were verified through native UI and fresh connector readback.

The exact parent/occurrence pairs are linked in `selected-test-plan.json`.
Fresh preflight with the actual executor credentials completed eight GETs and
passed service type, team, roles, leader/response defaults, selected people, and
both Calendar identities/times. No mutations or invitations were made by preflight.
`reviewCreation(...).blockers` is empty. The lifecycle report correctly retains
six expected missing-ID blockers: the two uncreated Services plans and their four
times. Those IDs remain null, and live writes remain disabled.

Local sanitized evidence is in
`output/event-support-private/calendar-linked-preflight-2026-10-21.json`.
The reviewed creation manifest is
`output/event-support-private/creation-manifest-2026-10-21.json`, with approval hash
`72c5b5b15c7b098d4add07703bea9805826734d9233619d8b86ce6703cd86ea7`.
The hash identifies the proposal; recording it does not authorize execution.

### Reviewed creation manifest

The user approved the exact manifest below on October 21. Its bounded execution
and post-creation verification are recorded below. Original plan/time IDs remain
null in the selected configuration; the persistent journal owns their bindings.
Invitations remain disabled.

The approved operations, in order, were:

| Step | Record | Change |
| --- | --- | --- |
| 1 | A | Create private Plan in service type `1832664` |
| 2 | A | Set `reminders_disabled: true`, unless already true |
| 3 | A | Create arrival time: October 28, 5–6 PM CDT, type `other` |
| 4 | A | Create service time: October 28, 6–7 PM CDT, type `service` |
| 5 | B | Create private control Plan in service type `1832664` |
| 6 | B | Set `reminders_disabled: true`, unless already true |
| 7 | B | Create arrival time: October 28, 5–6 PM CDT, type `other` |
| 8 | B | Create service time: October 28, 6–7 PM CDT, type `service` |

The exact titles are:

- `TEST — Central Notifications A [central-notifications-2026-10-28:A]`
- `TEST — Central Notifications B — Control [central-notifications-2026-10-28:B]`

Each Plan POST goes to `/services/v2/service_types/1832664/plans` with only
`title` and `public: false`. Each reminder PATCH targets the corresponding
journal-owned generated Plan ID with only `reminders_disabled: true`.
The [PCO Plan contract](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan)
documents reminder disabling as an update, not a create attribute.

Each PlanTime POST targets that plan's `/plan_times` collection. Names are exactly
`central-notifications-2026-10-28:A:arrival`, `central-notifications-2026-10-28:A:event`,
and the same two names with `B`. Arrival starts `2026-10-28T22:00:00.000Z` and ends
`2026-10-28T23:00:00.000Z`; service starts `2026-10-28T23:00:00.000Z` and ends
`2026-10-29T00:00:00.000Z`. All four have `team_reminders: []`, using the documented
[PlanTime fields](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan_time).
Generated IDs are substituted only from this run's validated journal bindings.

The creation stage leaves both plans empty: **zero assignments, zero invitations,
no needed-position creation, no template imports, and no reschedule**. Tyler and
Riley are selected for the subsequent manual scheduling stage. The October 29 move is unchanged in
the selected test configuration but is excluded from this creation manifest.

Execution requires `--execute-create`, `--approve-hash` with the newly reviewed
hash, and `--journal-dir` with a dedicated canonical private directory. No approval
hash is supplied by default or stored as an execution permission. Completing or
changing source links changes the hash and requires a fresh manifest review.
Do not execute merely because preview prints a hash.

The executor holds the journal lock for the entire workflow. Before each possible
mutation it rechecks setup, both Calendar baselines, ownership, privacy, empty
rosters, expected times and reminder state. The transport independently requires
the exact approved payload and persisted operation intent. Writes are never
automatically retried, including on rate limits, server errors or timeouts.
Uncertain outcomes stop for journal/readback recovery, with no automatic rollback
or journal reset. Native concurrent edits cannot be made transactional; this
remains an attended isolated test.

### Executor validation

At the creation review, the complete local suite passed **96 tests**: 18 domain/harness, 23 read transport
and journal, 39 adapter/lifecycle, 11 creation transport, and 5 creation CLI tests.
The integration tests run the actual creation transport and adapter against an
in-memory fake PCO server. They verify eight bounded writes, fresh-client recovery
after a lost time-creation response, zero duplicate writes on replay, and stopping
on roster/reminder drift. Negative tests cover incorrect approvals, incomplete
source links, foreign/duplicate roles, changed payloads, unowned resources,
forbidden actions, redirects, timeouts and credential-safe errors.

Independent review found and verified fixes for generated-ID substitution and a
reminder-state race before the first time creation. Three additional independent
fake-server integration checks passed. At that review point no live writes had
been sent. The controlled execution below subsequently verified live creation
payload acceptance and write permission; invitations remain untested and disabled.

### Controlled live creation completed — October 21, 2026

The explicitly approved manifest created two private, empty plans in Event
Support (`1832664`). All eight approved writes succeeded, with no duplicates:

| Test | Plan ID | Arrival time ID | Service time ID |
| --- | --- | --- | --- |
| A | `92857122` | `230072411` | `230072413` |
| B | `92857229` | `230072793` | `230072800` |

Both plans retain the exact reviewed TEST titles, `public: false`, and
`reminders_disabled: true`. Each has exactly two times: October 28 arrival
5–6 PM CDT (`other`) and service 6–7 PM CDT (`service`). All four PlanTime
`team_reminders` arrays are empty. Both complete rosters and needed-position
collections are empty. No invitation preparation, sending, assignment, template
import, Calendar change, or reschedule request was made.

The first attempt completed A's four writes, then hit HTTP 429 during a GET.
It stopped before B. Inspection confirmed every A operation was complete and no
B intent existed. The same journal and manifest were resumed using a temporary
runner with 500 ms request pacing. A was reconciled without another mutation;
only B's four writes remained. This verified safe recovery from a rate-limited
read. Routine execution still needs rate-aware pacing incorporated into the
maintained transport before unattended use; no permanent transport change was
made for this attended test.

A separate GET-only adapter pass finished with zero preflight blockers, verified
both snapshots, and retained `liveWritesEnabled: false` and
`invitationsEnabled: false`. Independent connector reads also confirmed both
private/reminder-disabled plans, their exact times, and zero-person rosters.
This establishes empty-plan creation readiness only, not confirmed staffing or
participant response/reschedule behavior.

Retain `output/event-support-private/live-creation-journal/` for every later stage;
do not reset it or copy generated IDs into the original configuration. Evidence:

- `output/event-support-private/creation-request-audit-2026-10-21.json`
- `output/event-support-private/creation-result-2026-10-21.json`
- `output/event-support-private/post-creation-readonly-2026-10-21.json`

Tyler subsequently scheduled Riley on Sound and himself on Graphics, both with
the arrival and service times, through native PCO. Read-only verification passed
after Riley's initial Audio selection was corrected. Both invitations were
prepared but unsent, both responses unconfirmed, routing was to Tyler, reminders
remained off, and B remained empty. No automatic assignment or invitation action
was performed. The next stage is leader-controlled native sending and observation
of responses; the adapter continues to observe only.

### Native invitation interpretation verified — October 21, 2026

The updated local suite passes **100 tests**, including 43 adapter tests. Focused
cases cover prepared-without-timestamp, sent-but-unconfirmed, confirmed-without-
delivery, unknown flags, enabled native preparation defaults, and preparation-only
drift during recovery. Independent review, syntax, and diff checks passed.

A fresh 26-request GET-only pass against the same journal completed with zero
preflight blockers. A's two assignments report `notificationPrepared: true`,
`notificationSent: false`, and `status: U`; B remains empty. No PCO writes or
invitation actions were made. The live evidence is saved in
`output/event-support-private/manual-assignments-readonly-2026-10-21.json`.
