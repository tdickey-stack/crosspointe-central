# Central Notifications: gated PCO adapter

This is the review build for [issue #16](https://github.com/tdickey-stack/crosspointe-central/issues/16),
on `codex/central-notifications-phase1`. **Live writes and invitations are disabled
in code.** It is an isolated Node tool, not deployed Central infrastructure.

The real client permits only allowlisted GETs. Creation, reminder-disable, time
updates and response resets are rehearsed through an injected in-memory client
in the tests. The CLI never constructs that client or exposes those methods.
There is no environment variable, execution flag, or configuration field that
unlocks live mutations. A later reviewed code change is required.

## Selected controlled test

All local times below are America/Chicago, CDT, in 2026.

| Record | Event | Tech arrival | Participants |
| --- | --- | --- | --- |
| A, initial | October 28, 6–7 PM | 5 PM | Riley Baker: Sound; Tyler Dickey: Graphics |
| B, control | October 28, 6–7 PM | 5 PM | None |
| A, rescheduled | October 29, 7–8 PM | 6 PM | Same two people |

Tyler is the sole test leader and response recipient. The dedicated Event
Support service type will contain a non-split Tech team, default unconfirmed
responses, and Sound/Graphics roles. Tech's default arrival offset is 60 minutes;
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
node --test test/event-support-harness.test.mjs test/event-support-adapter.test.mjs test/event-support-adapter-infrastructure.test.mjs
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
and reports missing IDs. With all IDs supplied, it checks the team, captures A/B,
and builds a reschedule proposal. No POST, PATCH, DELETE or native action is sent.
`--execute`, `--live`, `--send`, unknown and duplicate arguments fail before
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

The supplied null-ID configuration is for preview/preflight. Finalize reviewed
explicit IDs in a private copy before any future live execution. A read-only
preflight journal may be archived and replaced when completing that configuration,
because it has performed no mutations. Once a run owns mutations, preserve its
bindings and journal; do not edit the scope or restart with an empty journal.

The process lock protects one local journal. It is not a distributed lease and
does not prevent concurrent native PCO edits. Reads and writes are not an upstream
transaction. A future live execution must therefore be attended and isolated;
conflicts and partial application stop for review, not automatic rollback.

## Still required before and during the controlled live test

1. Review this code and then authorize the exact live operations in a later step.
   The current build cannot execute them against PCO.
2. Create Event Support/Tech with Tyler's routing settings and the two roles.
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
5. Observe Riley accept and Tyler decline, including response delivery to Tyler.
   Record the original snapshot. Move only Calendar A to the selected target,
   review the exact proposal, and verify each mapped time and targeted reset.
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

The local suite passed 62 tests: 18 original domain/harness tests, 23 transport
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
