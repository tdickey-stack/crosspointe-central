import { hash, planTitle, schedule, validateScope } from './scope.mjs';

const planPlaceholder = key => `<${key}.planId>`;

const planBody = (scope, occurrence) => ({
  data: {
    type: 'Plan',
    attributes: {
      title: planTitle(scope, occurrence.key),
      public: false,
    },
  },
});

const reminderBody = key => ({
  data: {
    type: 'Plan',
    id: planPlaceholder(key),
    attributes: { reminders_disabled: true },
  },
});

const timeBody = (scope, occurrence, kind) => {
  const wanted = schedule(scope, occurrence);
  return {
    data: {
      type: 'PlanTime',
      attributes: {
        name: `${scope.runId}:${occurrence.key}:${kind}`,
        time_type: kind === 'arrival' ? 'other' : 'service',
        starts_at: kind === 'arrival' ? wanted.arrivalAt : wanted.startsAt,
        ends_at: kind === 'arrival' ? wanted.startsAt : wanted.endsAt,
        team_reminders: [],
      },
    },
  };
};

/**
 * Build the complete, offline approval manifest for the only live-write phase:
 * two empty private plans, reminders disabled, and two plan times per plan.
 */
export function reviewCreation(input) {
  const scope = validateScope(input);
  const base = `/services/v2/service_types/${scope.serviceTypeId}`;
  const blockers = [];

  if (!scope.serviceTypeId) blockers.push('Explicit Event Support service type ID required.');
  if (!scope.team.id) blockers.push('Explicit Tech team ID required.');
  for (const occurrence of scope.occurrences) {
    if (!occurrence.eventId) blockers.push(`${occurrence.key}: explicit eventId required.`);
    if (!occurrence.instanceId) blockers.push(`${occurrence.key}: explicit instanceId required.`);
    if (occurrence.planId !== null) blockers.push(`${occurrence.key}: planId must be null for creation.`);
    for (const kind of ['arrival', 'event']) {
      if (occurrence.timeIds[kind] !== null) blockers.push(`${occurrence.key}: ${kind} time ID must be null for creation.`);
    }
  }

  const operations = scope.occurrences.flatMap(occurrence => {
    const placeholder = planPlaceholder(occurrence.key);
    return [
      {
        key: `create-plan:${occurrence.key}`,
        method: 'POST',
        path: `${base}/plans`,
        body: planBody(scope, occurrence),
      },
      {
        key: `disable-reminders:${occurrence.key}`,
        method: 'PATCH',
        path: `${base}/plans/${placeholder}`,
        body: reminderBody(occurrence.key),
      },
      ...['arrival', 'event'].map(kind => ({
        key: `create-time:${occurrence.key}:${kind}`,
        method: 'POST',
        path: `${base}/plans/${placeholder}/plan_times`,
        body: timeBody(scope, occurrence, kind),
      })),
    ];
  });

  const manifest = {
    phase: 'create-empty-plans',
    scopeHash: hash(scope),
    invitationsEnabled: false,
    maximumMutations: 8,
    blockers,
    operations,
  };
  return { ...manifest, approvalHash: hash(manifest) };
}
