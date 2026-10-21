import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {
  evaluateCoverage,
  planReschedule,
  reconcileCreation,
  runSimulation,
} from "../scripts/event-support-harness/domain.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("../scripts/event-support-harness/cli.mjs", import.meta.url));
const FIXTURE_PATH = fileURLToPath(new URL("../scripts/event-support-harness/fixture.json", import.meta.url));

function requirement(id, overrides = {}) {
  return {
    id,
    teamId: "team-tech",
    role: "Audio",
    quantity: 1,
    startsAt: "2027-04-18T10:00:00.000Z",
    endsAt: "2027-04-18T11:00:00.000Z",
    ...overrides,
  };
}

function assignment(id, personId, overrides = {}) {
  return {
    id,
    personId,
    teamId: "team-tech",
    role: "Audio",
    status: "C",
    confirmedRevision: 4,
    startsAt: "2027-04-18T09:00:00.000Z",
    endsAt: "2027-04-18T12:00:00.000Z",
    ...overrides,
  };
}

function runCli(args = []) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
    },
  });
}

function collectIdentifierValues(value, path = "fixture", collected = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectIdentifierValues(item, `${path}[${index}]`, collected));
    return collected;
  }
  if (!value || typeof value !== "object") return collected;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === "id" || key.endsWith("Id")) && typeof child === "string") {
      collected.push([childPath, child]);
    } else if (key.endsWith("Ids") && Array.isArray(child)) {
      child.forEach((identifier, index) => {
        if (typeof identifier === "string") collected.push([`${childPath}[${index}]`, identifier]);
      });
    }
    collectIdentifierValues(child, childPath, collected);
  }
  return collected;
}

test("creation reconciliation attaches only one exact marker and service-type match", () => {
  const operation = {marker: "event-support:fixture-op", serviceTypeId: "service-type-a"};
  const exact = {id: "plan-exact", marker: operation.marker, serviceTypeId: operation.serviceTypeId};
  const irrelevant = [
    {id: "plan-wrong-marker", marker: "event-support:other", serviceTypeId: operation.serviceTypeId},
    {id: "plan-wrong-type", marker: operation.marker, serviceTypeId: "service-type-b"},
  ];

  assert.deepEqual(reconcileCreation(operation, [exact, ...irrelevant]), {
    decision: "attach",
    resourceId: "plan-exact",
  });
  assert.deepEqual(reconcileCreation(operation, irrelevant), {decision: "retry"});
  assert.equal(reconcileCreation(operation, [exact, {...exact, id: "plan-duplicate"}]).decision, "needs-repair");
});

test("incomplete reconciliation reads always need repair", () => {
  const operation = {marker: "event-support:fixture-op", serviceTypeId: "service-type-a"};
  const candidate = {id: "plan-exact", marker: operation.marker, serviceTypeId: operation.serviceTypeId};

  assert.equal(reconcileCreation(operation, [], {complete: false}).decision, "needs-repair");
  assert.equal(reconcileCreation(operation, [candidate], {complete: false}).decision, "needs-repair");
});

test("coverage excludes unconfirmed, declined, stale, wrong-window, and duplicate assignments", () => {
  const requirements = [requirement("req-a", {quantity: 3})];
  const valid = assignment("assignment-valid", "person-a");
  const assignments = [
    valid,
    structuredClone(valid),
    {...valid, id: "assignment-duplicate-person"},
    assignment("assignment-unconfirmed", "person-b", {status: "U"}),
    assignment("assignment-declined", "person-c", {status: "D"}),
    assignment("assignment-old-revision", "person-d", {confirmedRevision: 3}),
    assignment("assignment-starts-late", "person-e", {startsAt: "2027-04-18T10:01:00.000Z"}),
    assignment("assignment-ends-early", "person-f", {endsAt: "2027-04-18T10:59:00.000Z"}),
    assignment("assignment-wrong-team", "person-g", {teamId: "team-hospitality"}),
    assignment("assignment-wrong-role", "person-h", {role: "Lighting"}),
  ];

  assert.deepEqual(evaluateCoverage(requirements, assignments, 4), {
    state: "Needs attention",
    required: 3,
    confirmed: 1,
    gaps: [{requirementId: "req-a", missing: 2}],
  });
});

test("coverage maximizes allocation and prevents one person from filling overlapping roles", () => {
  const narrow = requirement("req-narrow", {
    startsAt: "2027-04-18T10:00:00.000Z",
    endsAt: "2027-04-18T10:30:00.000Z",
  });
  const broad = requirement("req-broad");
  const broadPersonFirst = assignment("assignment-broad", "person-a");
  const narrowOnlySecond = assignment("assignment-narrow", "person-b", {
    startsAt: narrow.startsAt,
    endsAt: narrow.endsAt,
  });

  assert.deepEqual(evaluateCoverage([narrow, broad], [broadPersonFirst, narrowOnlySecond], 4), {
    state: "Coverage confirmed",
    required: 2,
    confirmed: 2,
    gaps: [],
  });

  const overlappingRoles = [
    requirement("req-audio"),
    requirement("req-lighting", {role: "Lighting"}),
  ];
  const samePerson = [
    assignment("assignment-audio", "person-a"),
    assignment("assignment-lighting", "person-a", {role: "Lighting"}),
  ];
  const result = evaluateCoverage(overlappingRoles, samePerson, 4);
  assert.equal(result.state, "Needs attention");
  assert.equal(result.required, 2);
  assert.equal(result.confirmed, 1);
  assert.equal(result.gaps.reduce((sum, gap) => sum + gap.missing, 0), 1);
});

test("one person may cover nonoverlapping requirements", () => {
  const requirements = [
    requirement("req-early", {
      startsAt: "2027-04-18T09:00:00.000Z",
      endsAt: "2027-04-18T10:00:00.000Z",
    }),
    requirement("req-late", {
      startsAt: "2027-04-18T10:15:00.000Z",
      endsAt: "2027-04-18T11:15:00.000Z",
    }),
  ];
  const assignments = [
    assignment("assignment-early", "person-a", {
      startsAt: "2027-04-18T09:00:00.000Z",
      endsAt: "2027-04-18T10:00:00.000Z",
    }),
    assignment("assignment-late", "person-a", {
      startsAt: "2027-04-18T10:15:00.000Z",
      endsAt: "2027-04-18T11:15:00.000Z",
    }),
  ];

  assert.deepEqual(evaluateCoverage(requirements, assignments, 4), {
    state: "Coverage confirmed",
    required: 2,
    confirmed: 2,
    gaps: [],
  });
});

test("coverage rejects fixtures beyond its bounded allocation limits", () => {
  const tooManySlots = [requirement("req-too-many", {quantity: 13})];
  assert.throws(
    () => evaluateCoverage(tooManySlots, [], 4),
    /12|required slots|allocation.*bound/i,
  );

  const requirements = Array.from({length: 12}, (_value, index) => requirement(`req-${index}`));
  const assignments = Array.from({length: 11}, (_value, index) => assignment(`assignment-${index}`, `person-${index}`));
  assert.throws(
    () => evaluateCoverage(requirements, assignments, 4),
    /50.?000|search.*(?:bound|limit)|allocation.*bound|search exceeds/i,
  );
});

function rescheduleSnapshot() {
  return {
    revision: 7,
    occurrence: {
      id: "occurrence-a",
      startsAt: "2027-04-18T10:00:00.000Z",
      endsAt: "2027-04-18T14:00:00.000Z",
    },
    plan: {id: "plan-a"},
    times: [
      {id: "time-load-in", startsAt: "2027-04-18T09:00:00.000Z", endsAt: "2027-04-18T10:00:00.000Z"},
      {id: "time-event", startsAt: "2027-04-18T10:00:00.000Z", endsAt: "2027-04-18T14:00:00.000Z"},
      {id: "time-cleanup", startsAt: "2027-04-18T14:00:00.000Z", endsAt: "2027-04-18T15:00:00.000Z"},
    ],
    assignments: [
      {
        ...assignment("assignment-confirmed", "person-a", {
          confirmedRevision: 7,
          startsAt: "2027-04-18T10:00:00.000Z",
          endsAt: "2027-04-18T14:00:00.000Z",
        }),
        timeIds: ["time-event"],
        notification: {lastSentAt: "2027-04-01T12:00:00.000Z", channel: "fixture-channel"},
      },
      {
        ...assignment("assignment-unconfirmed", "person-b", {
          status: "U",
          confirmedRevision: 6,
          startsAt: "2027-04-18T09:00:00.000Z",
          endsAt: "2027-04-18T10:00:00.000Z",
        }),
        timeIds: ["time-load-in"],
        notification: {lastSentAt: "2027-04-02T12:00:00.000Z"},
      },
      {
        ...assignment("assignment-declined", "person-c", {
          status: "D",
          confirmedRevision: 5,
          startsAt: "2027-04-18T14:00:00.000Z",
          endsAt: "2027-04-18T15:00:00.000Z",
        }),
        timeIds: ["time-cleanup", "outside-time"],
        declineHistory: [{at: "2027-04-03T12:00:00.000Z", reason: "Fictional conflict"}],
      },
      {
        ...assignment("assignment-external", "person-d", {
          confirmedRevision: 7,
          startsAt: "2027-04-19T09:00:00.000Z",
          endsAt: "2027-04-19T10:00:00.000Z",
        }),
        timeIds: ["outside-time"],
      },
    ],
    requirements: [
      requirement("requirement-a", {
        startsAt: "2027-04-18T10:30:00.000Z",
        endsAt: "2027-04-18T13:30:00.000Z",
      }),
    ],
  };
}

test("rescheduling preserves independent start/end offsets and resets only affected confirmations", () => {
  const snapshot = rescheduleSnapshot();
  const original = structuredClone(snapshot);
  const result = planReschedule(snapshot, {
    startsAt: "2027-04-18T11:00:00.000Z",
    endsAt: "2027-04-18T16:00:00.000Z",
  });

  assert.equal(result.revision, 8);
  assert.equal(result.state, "Needs reconfirmation");
  assert.deepEqual(result.times, [
    {id: "time-load-in", startsAt: "2027-04-18T10:00:00.000Z", endsAt: "2027-04-18T11:00:00.000Z"},
    {id: "time-event", startsAt: "2027-04-18T11:00:00.000Z", endsAt: "2027-04-18T16:00:00.000Z"},
    {id: "time-cleanup", startsAt: "2027-04-18T16:00:00.000Z", endsAt: "2027-04-18T17:00:00.000Z"},
  ]);
  assert.deepEqual(result.requirements, [{
    ...snapshot.requirements[0],
    startsAt: "2027-04-18T11:30:00.000Z",
    endsAt: "2027-04-18T15:30:00.000Z",
  }]);

  const confirmed = result.assignments.find((item) => item.id === "assignment-confirmed");
  assert.equal(confirmed.status, "U");
  assert.equal(confirmed.confirmedRevision, null);
  assert.equal(confirmed.startsAt, "2027-04-18T11:00:00.000Z");
  assert.equal(confirmed.endsAt, "2027-04-18T16:00:00.000Z");
  assert.deepEqual(confirmed.notification, original.assignments[0].notification);

  const unconfirmed = result.assignments.find((item) => item.id === "assignment-unconfirmed");
  assert.equal(unconfirmed.status, "U");
  assert.equal(unconfirmed.confirmedRevision, 6);
  assert.equal(unconfirmed.startsAt, "2027-04-18T10:00:00.000Z");
  assert.equal(unconfirmed.endsAt, "2027-04-18T11:00:00.000Z");
  assert.deepEqual(unconfirmed.notification, original.assignments[1].notification);

  const declined = result.assignments.find((item) => item.id === "assignment-declined");
  assert.equal(declined.status, "D");
  assert.equal(declined.confirmedRevision, 5);
  assert.equal(declined.startsAt, "2027-04-18T16:00:00.000Z");
  assert.equal(declined.endsAt, "2027-04-18T17:00:00.000Z");
  assert.deepEqual(declined.declineHistory, original.assignments[2].declineHistory);

  assert.deepEqual(result.assignments.find((item) => item.id === "assignment-external"), original.assignments[3]);
  assert.deepEqual(
    result.actions.filter((action) => action.kind === "update-time").map((action) => action.targetId).sort(),
    ["time-cleanup", "time-event", "time-load-in"],
  );
  assert.deepEqual(
    result.actions.filter((action) => action.kind === "reset-confirmation").map(({kind, targetId}) => ({kind, targetId})),
    [{kind: "reset-confirmation", targetId: "assignment-confirmed"}],
  );
  assert.deepEqual(snapshot, original);
});

test("a same-schedule reschedule is a no-op", () => {
  const snapshot = rescheduleSnapshot();
  const result = planReschedule(snapshot, {
    startsAt: snapshot.occurrence.startsAt,
    endsAt: snapshot.occurrence.endsAt,
  });

  assert.equal(result.revision, snapshot.revision);
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.times, snapshot.times);
  assert.deepEqual(result.assignments, snapshot.assignments);
  assert.deepEqual(result.requirements, snapshot.requirements);
});

test("reschedule results cannot mutate the source snapshot", () => {
  const snapshot = rescheduleSnapshot();
  const original = structuredClone(snapshot);
  const result = planReschedule(snapshot, {
    startsAt: "2027-04-18T11:00:00.000Z",
    endsAt: "2027-04-18T16:00:00.000Z",
  });

  result.times[0].startsAt = "2099-01-01T00:00:00.000Z";
  result.assignments[0].notification.channel = "mutated-result-only";
  result.requirements[0].role = "mutated-result-only";
  assert.deepEqual(snapshot, original);
  assert.notStrictEqual(result.times, snapshot.times);
  assert.notStrictEqual(result.assignments[0].notification, snapshot.assignments[0].notification);
});

test("new schedule data cannot replace the exact occurrence identity", () => {
  const snapshot = rescheduleSnapshot();
  const result = planReschedule(snapshot, {
    id: "different-occurrence-must-not-win",
    startsAt: "2027-04-18T11:00:00.000Z",
    endsAt: "2027-04-18T16:00:00.000Z",
  });

  assert.equal(result.occurrence.id, snapshot.occurrence.id);
  assert.equal(snapshot.occurrence.id, "occurrence-a");
});

test("rescheduling across Chicago spring DST preserves the local arrival offset", () => {
  const snapshot = {
    revision: 1,
    occurrence: {
      id: "occurrence-dst",
      startsAt: "2030-03-09T16:00:00.000Z",
      endsAt: "2030-03-09T17:00:00.000Z",
    },
    plan: {id: "plan-dst"},
    times: [
      {id: "time-arrival", startsAt: "2030-03-09T15:30:00.000Z", endsAt: "2030-03-09T16:00:00.000Z"},
      {id: "time-event", startsAt: "2030-03-09T16:00:00.000Z", endsAt: "2030-03-09T17:00:00.000Z"},
    ],
    assignments: [{
      ...assignment("assignment-dst", "person-dst", {
        confirmedRevision: 1,
        startsAt: "2030-03-09T15:30:00.000Z",
        endsAt: "2030-03-09T17:00:00.000Z",
      }),
      timeIds: ["time-arrival", "time-event"],
    }],
    requirements: [requirement("requirement-dst", {
      startsAt: "2030-03-09T15:30:00.000Z",
      endsAt: "2030-03-09T17:00:00.000Z",
    })],
  };
  const result = planReschedule(snapshot, {
    startsAt: "2030-03-10T15:00:00.000Z",
    endsAt: "2030-03-10T16:00:00.000Z",
  });
  const arrival = result.times.find((row) => row.id === "time-arrival");
  assert.equal(arrival.startsAt, "2030-03-10T14:30:00.000Z");
  assert.equal(arrival.endsAt, "2030-03-10T15:00:00.000Z");

  const localTime = (value) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.hour}:${byType.minute}`;
  };
  assert.equal(localTime(snapshot.times[0].startsAt), "09:30");
  assert.equal(localTime(snapshot.occurrence.startsAt), "10:00");
  assert.equal(localTime(arrival.startsAt), "09:30");
  assert.equal(localTime(result.occurrence.startsAt), "10:00");
});

test("rescheduling rejects invalid ranges and unsupported confirmed mixed-time assignments", () => {
  const snapshot = rescheduleSnapshot();
  assert.throws(
    () => planReschedule(snapshot, {startsAt: "2027-04-18T16:00:00.000Z", endsAt: "2027-04-18T11:00:00.000Z"}),
    /invalid|range|before|after/i,
  );

  const invalidTime = structuredClone(snapshot);
  invalidTime.times[0].endsAt = "2027-04-18T08:00:00.000Z";
  assert.throws(
    () => planReschedule(invalidTime, {startsAt: "2027-04-18T11:00:00.000Z", endsAt: "2027-04-18T16:00:00.000Z"}),
    /invalid|range|before|after/i,
  );

  const mixedConfirmed = structuredClone(snapshot);
  mixedConfirmed.assignments[0].timeIds.push("outside-time");
  assert.throws(
    () => planReschedule(mixedConfirmed, {startsAt: "2027-04-18T11:00:00.000Z", endsAt: "2027-04-18T16:00:00.000Z"}),
    /unsupported|granularity|outside|mixed/i,
  );
});

test("the bundled fixture is fictional, fixture-scoped, and passes the dry-run simulation", () => {
  const fixtureText = readFileSync(FIXTURE_PATH, "utf8");
  const fixture = JSON.parse(fixtureText);
  assert.match(fixtureText, /fictional/i);
  const identifiers = collectIdentifierValues(fixture);
  assert.ok(identifiers.length > 0);
  for (const [path, identifier] of identifiers) {
    assert.match(identifier, /^fixture-/, `${path} must be fixture-prefixed`);
  }

  const result = runSimulation(fixture);
  assert.equal(result.mode, "dry-run");
  assert.equal(result.simulated, true);
  assert.equal(result.liveRequests, 0);
  assert.ok(Array.isArray(result.checks) && result.checks.length > 0);
  assert.ok(result.checks.every((check) => typeof check.name === "string" && check.passed === true));
  assert.ok(Array.isArray(result.journal));
  assert.ok(Array.isArray(result.plans));
  assert.ok(result.before && typeof result.before === "object");
  assert.ok(result.after && typeof result.after === "object");
});

test("same Chicago date occurrences remain distinct across the UTC date boundary", () => {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  fixture.occurrences = [
    {
      id: "fixture-occurrence-a",
      parentEventId: "fixture-event-a",
      startsAt: "2030-01-20T23:30:00.000Z",
      endsAt: "2030-01-21T00:30:00.000Z",
    },
    {
      id: "fixture-occurrence-b",
      parentEventId: "fixture-event-b",
      startsAt: "2030-01-21T01:30:00.000Z",
      endsAt: "2030-01-21T02:30:00.000Z",
    },
  ];
  fixture.snapshot.occurrence = {
    id: "fixture-occurrence-a",
    startsAt: "2030-01-20T23:30:00.000Z",
    endsAt: "2030-01-21T00:30:00.000Z",
  };
  fixture.snapshot.times = [
    {id: "fixture-time-arrival", name: "Arrival and setup", startsAt: "2030-01-20T23:00:00.000Z", endsAt: "2030-01-20T23:30:00.000Z"},
    {id: "fixture-time-event", name: "Event", startsAt: "2030-01-20T23:30:00.000Z", endsAt: "2030-01-21T00:30:00.000Z"},
  ];
  for (const row of [...fixture.snapshot.requirements, ...fixture.snapshot.assignments]) {
    row.startsAt = "2030-01-20T23:00:00.000Z";
    row.endsAt = "2030-01-21T00:30:00.000Z";
  }
  fixture.reschedule = {
    startsAt: "2030-01-22T00:30:00.000Z",
    endsAt: "2030-01-22T01:30:00.000Z",
  };

  assert.notEqual(fixture.occurrences[0].startsAt.slice(0, 10), fixture.occurrences[1].startsAt.slice(0, 10));
  const chicagoDate = (value) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  assert.equal(chicagoDate(fixture.occurrences[0].startsAt), chicagoDate(fixture.occurrences[1].startsAt));

  const result = runSimulation(fixture);
  assert.ok(result.checks.every((check) => check.passed));
  assert.equal(result.plans.length, 2);
  assert.notEqual(result.plans[0].id, result.plans[1].id);
  assert.notEqual(result.plans[0].occurrenceId, result.plans[1].occurrenceId);
});

test("simulation rejects malformed and non-fixture identifiers", () => {
  assert.throws(() => runSimulation({}), /fixture|invalid|required|malformed/i);

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const identifiers = collectIdentifierValues(fixture);
  assert.ok(identifiers.length > 0);
  const path = identifiers[0][0].replace(/^fixture\./, "").split(/\.|\[|\]/).filter(Boolean);
  let target = fixture;
  for (const segment of path.slice(0, -1)) target = target[/^\d+$/.test(segment) ? Number(segment) : segment];
  target[path.at(-1)] = "live-id-is-forbidden";
  assert.throws(() => runSimulation(fixture), /fixture-|identifier|fixture/i);

  const hiddenLiveIdentifier = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  hiddenLiveIdentifier.snapshot.assignments[0].externalPlanId = "123456789";
  assert.throws(() => runSimulation(hiddenLiveIdentifier), /fixture-|identifier|fixture|unknown/i);
});

test("CLI emits deterministic JSON and accepts only dry-run fixture options", () => {
  const first = runCli([]);
  const second = runCli([]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  const parsed = JSON.parse(first.stdout);
  assert.equal(parsed.mode, "dry-run");
  assert.equal(parsed.simulated, true);
  assert.equal(parsed.liveRequests, 0);

  const explicit = runCli(["--dry-run", "--fixture", FIXTURE_PATH]);
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.deepEqual(JSON.parse(explicit.stdout), parsed);

  for (const args of [["--execute"], ["--live"], ["--send"], ["--unknown"], ["--dry-run=true"], ["--fixture"], ["positional"]]) {
    const rejected = runCli(args);
    assert.notEqual(rejected.status, 0, `${args.join(" ")} must be rejected`);
  }
});

test("CLI help is available and malformed fixture files fail closed", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /usage/i);
  assert.match(help.stdout, /--dry-run/);
  assert.match(help.stdout, /--fixture/);

  const directory = mkdtempSync(join(tmpdir(), "event-support-harness-"));
  try {
    const invalidJsonPath = join(directory, "invalid.json");
    writeFileSync(invalidJsonPath, "{not-json", "utf8");
    const invalidJson = runCli(["--fixture", invalidJsonPath]);
    assert.notEqual(invalidJson.status, 0);
    assert.equal(invalidJson.stdout, "");

    const malformedPath = join(directory, "malformed.json");
    writeFileSync(malformedPath, JSON.stringify({fictional: true}), "utf8");
    const malformed = runCli(["--fixture", malformedPath]);
    assert.notEqual(malformed.status, 0);
    assert.equal(malformed.stdout, "");
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("harness code has no credential or network dependency", () => {
  const sources = [
    readFileSync(CLI_PATH, "utf8"),
    readFileSync(fileURLToPath(new URL("../scripts/event-support-harness/domain.mjs", import.meta.url)), "utf8"),
  ].join("\n");
  assert.doesNotMatch(sources, /process\.env|\bfetch\s*\(|globalThis\.fetch|from\s+["'](?:node:)?(?:http|https|net)["']|firebase-admin|google-auth-library|dotenv|secretmanager/i);
});
