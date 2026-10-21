# Event Support Phase 1 integration rehearsal

This isolated harness prepares the controlled test described in
[issue #16](https://github.com/tdickey-stack/crosspointe-central/issues/16).
It is **offline and dry-run only**. It does not load credentials, call PCO,
read/write Firestore, send invitations, or attach to deployed Central.
There is no live execution flag or network transport in the original simulation.
The separate [gated adapter](event-support-live-adapter.md) now adds real read-only
PCO checks, durable journals and mocked mutation tests. Live writes remain disabled.

## Run

From the repository root, using Node 22:

```sh
node scripts/event-support-harness/cli.mjs --dry-run
node --test test/event-support-harness.test.mjs
```

Omitting `--dry-run` still runs the same offline simulation. `--execute`,
`--live`, `--send`, and all other unsupported arguments fail before reading
the fixture. `--help` describes supported arguments.

To retain the JSON report and its simulated operation journal locally:

```sh
node scripts/event-support-harness/cli.mjs --dry-run > /private/tmp/event-support-phase1-dry-run.json
```

The CLI writes only to stdout/stderr. Shell redirection saves the report;
it does not provide a crash-safe journal for future live operations. Repeating
the same fixture produces the same report, hashes, and operation identities.
Exit status is nonzero for invalid input or a failed scenario check.

## Fictional input and output

`scripts/event-support-harness/fixture.json` uses fictional `fixture-` resource
identifiers, two unrelated occurrences on the same Chicago date, one accepted
Sound assignment, and one declined Graphics assignment. Its 2030 dates are
test data, not proposed dates for the live test.

`--fixture PATH` accepts a local JSON variation of this scenario. Keep
`schemaVersion: 1`, `simulated: true`, fictional IDs, explicit timestamp offsets,
and `America/Chicago`. Real PCO IDs are rejected. This is a normalized test
format, not a raw PCO payload importer. It models one occurrence per plan.

The report includes:

- A conspicuous simulation notice and zero live requests.
- Stable operation markers, proposed request bodies, body hashes, and a
  sequence of simulated outcomes and reconciliation decisions.
- Two independently linked fictional plans on the same date.
- Initial snapshots, reschedule proposals, and coverage before/after a fresh
  simulated confirmation. Source snapshots and decline history are retained.
- Explicit live evidence that remains outstanding.

The scenarios exercise lost-response recovery, idempotent reattachment,
ambiguous/incomplete lookup handling, prepared versus sent versus confirmed
assignments, single-occurrence rescheduling, and renewed confirmation.
No invitation action in the report represents an actual send.

Coverage uses approved team/role/quantity/time requirements, current revision
confirmations, and unique people during overlapping windows. It finds the best
valid allocation rather than depending on roster order. It allows reuse during
nonoverlapping windows. The fixture limit is 12 required slots, 100 assignment
rows, and 50,000 search steps; exceeding these limits fails explicitly.
This small-scenario solver is not a production staffing engine.

Time proposals keep setup offsets relative to event start, cleanup offsets
relative to event end, and spanning arrival/departure offsets relative to the
respective event boundaries. Only confirmed assignments associated with changed
times are proposed for reset. Declined/unconfirmed status and notification
history remain intact. Confirmed assignments spanning both affected and unrelated
times stop with an error because the required native reset granularity is unproven.

## What this does not prove

Passing this simulation does not complete the live integration gate. It does
not prove PCO write permissions, accepted request bodies, persistence after
timeouts, notification delivery, native reset/re-preparation semantics, or
per-time response behavior. `confirmedRevision` is our modeled validity marker;
it is not a PCO field. A future adapter must establish revision-valid response
evidence rather than treating any `C` status as a renewed acceptance.

Plan creation has a proposed API body. Time updates and assignment resets are
domain proposals, not validated executable PATCH requests. Needed-position
role payloads must be verified in the controlled PCO test. Requirements are
independent of PCO's remaining-needed-position count, which must never silently
lower the approved baseline.

This harness contains no automated Central reminders or notifications. The
later implementation must supersede old-revision reminders and reconcile stale
reads without turning them into cancellations or zero coverage.

## Controlled test selection and original checklist

`scripts/event-support-harness/live-test.template.json` is an intentionally
incomplete planning worksheet. The original CLI rejects it. The selected October
28/29, 2026 test with Tyler and Riley is recorded separately in
`scripts/event-support-harness/selected-test-plan.json`; see the adapter runbook
for current setup, verification results and remaining live gates. The checklist
below describes the full Phase 1 acceptance scope, not completed live work.

1. Select the date, two willing participants, scheduling leader, response
   recipient, cleanup owner, and explicit allowed messages/mutations.
2. Configure a dedicated Event Support service type with reviewed teams and
   roles. Recheck default reply recipients and leader response notifications.
3. Office creates/chooses two clearly labeled test Calendar occurrences on the
   same date. Record exact parent/occurrence IDs and reviewed arrival offsets.
   Select a new date/time for occurrence A; occurrence B remains the control.
4. Add a separately reviewed live adapter only after authorization. It must
   allowlist test resources, require explicit execution, snapshot before/after,
   and persist operation identity and outcome before/after each external action.
   No automatic POST retry after an uncertain result: finish a paginated exact
   marker lookup first; ambiguous or incomplete results require repair.
5. Create/link both plans and named times, verify needed-role/time mappings,
   then test uncertain creation recovery and repeat-run attachment.
6. The leader schedules and sends native Services invitations. Observe one
   acceptance and one decline, read API timestamps/status/response recipients,
   and verify the intended leader actually receives responses.
7. Move only A's mapped times. Verify setup/cleanup offsets, unchanged B, reset
   semantics, preserved declines, fresh invitations and fresh confirmations.
   Include duration-only changes, Chicago DST transitions, mixed-time
   assignments, and an old-invitation-link response. Stop if native behavior
   cannot distinguish valid reconfirmation; do not declare false coverage.
8. Remove disposable assignments/reminders and records within the approved
   cleanup scope. Read back the result and retain sanitized evidence.

The test must not use Services' bulk Reschedule Entire Plan feature. The live
adapter must avoid broad team notifications, real event moves, and worship
configuration changes outside the selected test resources.

Relevant PCO contracts:
[PlanPerson](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan_person),
[PlanTime](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan_time),
[PlanPersonTime](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/plan_person_time),
[NeededPosition](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/needed_position).
