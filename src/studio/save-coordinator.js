const SYNC_FIELD = "_studioSync";

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function timestampValue(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function requireActorUid(actorUid) {
  const normalized = stringValue(actorUid).trim();
  if (!normalized) throw new Error("Studio save coordination requires a user identity.");
  return normalized;
}

function syncMetadata(project) {
  const value = project?.[SYNC_FIELD];
  return value && typeof value === "object" ? value : {};
}

function cloudMetadata(project) {
  return {
    ...(Object.hasOwn(project || {}, "_cloudRevision")
      ? {_cloudRevision: project._cloudRevision}
      : {}),
    ...(Object.hasOwn(project || {}, "schemaVersion")
      ? {schemaVersion: project.schemaVersion}
      : {}),
    ...(Object.hasOwn(project || {}, "ownerUid")
      ? {ownerUid: project.ownerUid}
      : {}),
    ...(Object.hasOwn(project || {}, "cloudBacked")
      ? {cloudBacked: project.cloudBacked}
      : {}),
    ...(Object.hasOwn(project || {}, "shared")
      ? {shared: project.shared}
      : {}),
  };
}

export function markStudioProjectPending(
  project,
  actorUid,
  {now = () => new Date().toISOString()} = {},
) {
  const actor = requireActorUid(actorUid);
  const previous = syncMetadata(project);
  const sameActor = previous.actorUid === actor;
  const previousRevision = sameActor ? integerValue(previous.revision) : 0;
  const syncedRevision = sameActor
    ? Math.min(integerValue(previous.syncedRevision), previousRevision)
    : 0;
  return {
    ...project,
    [SYNC_FIELD]: {
      actorUid: actor,
      revision: previousRevision + 1,
      syncedRevision,
      pending: true,
      changedAt: now(),
      changeId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      ...(sameActor && previous.conflict ? {conflict: true} : {}),
      ...(sameActor && stringValue(previous.syncedAt)
        ? {syncedAt: previous.syncedAt}
        : {}),
    },
  };
}

export function applyStudioSaveSuccess(
  latestProject,
  savedProject,
  {actorUid, revision, now = () => new Date().toISOString()} = {},
) {
  const actor = requireActorUid(actorUid);
  if (!latestProject || latestProject.id !== savedProject?.id) return latestProject;
  const sync = syncMetadata(latestProject);
  if (sync.actorUid !== actor) return latestProject;
  const completedRevision = integerValue(revision, -1);
  const latestRevision = integerValue(sync.revision);
  const isCurrent = completedRevision === latestRevision;
  return {
    ...latestProject,
    ...cloudMetadata(savedProject),
    [SYNC_FIELD]: {
      ...sync,
      syncedRevision: Math.max(
        integerValue(sync.syncedRevision),
        Math.min(completedRevision, latestRevision),
      ),
      pending: !isCurrent,
      ...(isCurrent ? {syncedAt: now()} : {}),
      lastError: "",
      conflict: false,
    },
  };
}

export function applyStudioSaveFailure(
  latestProject,
  {actorUid, revision, error, now = () => new Date().toISOString()} = {},
) {
  const actor = requireActorUid(actorUid);
  if (!latestProject) return latestProject;
  const sync = syncMetadata(latestProject);
  if (
    sync.actorUid !== actor ||
    (integerValue(sync.revision) !== integerValue(revision, -1) && error?.code !== "studio/conflict")
  ) {
    return latestProject;
  }
  return {
    ...latestProject,
    [SYNC_FIELD]: {
      ...sync,
      pending: true,
      failedAt: now(),
      lastError: stringValue(error?.message || error).slice(0, 500),
      ...(error?.code === "studio/conflict" ? {conflict: true} : {}),
    },
  };
}

function trustedLocalProject(project, actorUid) {
  const sync = syncMetadata(project);
  if (stringValue(sync.actorUid)) return sync.actorUid === actorUid;
  return stringValue(project?.ownerUid) === actorUid;
}

function pendingLocalProject(project, actorUid) {
  const sync = syncMetadata(project);
  return sync.actorUid === actorUid && sync.pending === true;
}

function markLegacyProjectPending(project, actorUid) {
  return markStudioProjectPending(project, actorUid, {
    now: () => stringValue(project?.updatedAt) || new Date().toISOString(),
  });
}

export function reconcileStudioProjects({
  cloudProjects = [],
  browserProjects = [],
  actorUid,
} = {}) {
  const actor = requireActorUid(actorUid);
  const cloudById = new Map(cloudProjects.map((project) => [project.id, project]));
  const browserById = new Map(browserProjects.map((project) => [project.id, project]));
  const projects = [];
  const pendingProjects = [];
  const attentionProjects = [];
  const preservedBrowserProjects = [];
  const seen = new Set();

  const addPending = (project) => {
    projects.push(project);
    pendingProjects.push(project);
    seen.add(project.id);
  };

  for (const cloudProject of cloudProjects) {
    const browserProject = browserById.get(cloudProject.id);
    if (!browserProject) {
      projects.push(cloudProject);
      seen.add(cloudProject.id);
      continue;
    }

    const sync = syncMetadata(browserProject);
    const hasActorMarker = Boolean(stringValue(sync.actorUid));
    if (hasActorMarker && sync.actorUid !== actor) {
      projects.push(cloudProject);
      preservedBrowserProjects.push(browserProject);
      attentionProjects.push({
        projectId: browserProject.id,
        reason: "identity-mismatch",
      });
      seen.add(cloudProject.id);
      continue;
    }

    const trusted = trustedLocalProject(browserProject, actor);
    const localIsNewer =
      timestampValue(browserProject.updatedAt) >
      timestampValue(cloudProject.updatedAt);
    if (
      trusted &&
      (
        pendingLocalProject(browserProject, actor) ||
        (!hasActorMarker && localIsNewer)
      )
    ) {
      addPending(
        pendingLocalProject(browserProject, actor)
          ? browserProject
          : markLegacyProjectPending(browserProject, actor),
      );
      continue;
    }

    projects.push(cloudProject);
    seen.add(cloudProject.id);
  }

  for (const browserProject of browserProjects) {
    if (seen.has(browserProject.id) || cloudById.has(browserProject.id)) continue;
    const sync = syncMetadata(browserProject);
    const hasActorMarker = Boolean(stringValue(sync.actorUid));
    if (hasActorMarker && sync.actorUid !== actor) {
      preservedBrowserProjects.push(browserProject);
      attentionProjects.push({
        projectId: browserProject.id,
        reason: "identity-mismatch",
      });
      continue;
    }
    if (trustedLocalProject(browserProject, actor)) {
      if (browserProject.cloudBacked === true) {
        preservedBrowserProjects.push(browserProject);
        attentionProjects.push({
          projectId: browserProject.id,
          reason: "cloud-project-missing",
        });
        continue;
      }
      addPending(
        pendingLocalProject(browserProject, actor)
          ? browserProject
          : markLegacyProjectPending(browserProject, actor),
      );
      continue;
    }
    preservedBrowserProjects.push(browserProject);
    attentionProjects.push({
      projectId: browserProject.id,
      reason: "unattributed-browser-project",
    });
  }

  return {
    projects,
    pendingProjects,
    attentionProjects,
    preservedBrowserProjects,
  };
}

function safeCallback(callback, value) {
  try {
    callback?.(value);
  } catch (error) {
    // UI callbacks must not interrupt persistence sequencing.
  }
}

export function createStudioSaveCoordinator({
  actorUid,
  saveProject,
  deleteProject,
  onSaveSuccess,
  onSaveError,
  onDeleteSuccess,
  onDeleteError,
  onStateChange,
  debounceMs = 500,
  retryDelayMs = 1500,
  maxAutoRetries = 2,
  timers = globalThis,
} = {}) {
  const actor = requireActorUid(actorUid);
  if (typeof saveProject !== "function") {
    throw new Error("Studio save coordination requires saveProject.");
  }
  if (typeof deleteProject !== "function") {
    throw new Error("Studio save coordination requires deleteProject.");
  }
  const setTimer = timers.setTimeout?.bind(timers);
  const clearTimer = timers.clearTimeout?.bind(timers);
  if (!setTimer || !clearTimer) {
    throw new Error("Studio save coordination requires timer functions.");
  }

  const queues = new Map();
  let active = true;

  const stateFor = (projectId) => {
    let state = queues.get(projectId);
    if (!state) {
      state = {
        projectId,
        latestProject: null,
        latestRevision: 0,
        timer: null,
        ready: false,
        inFlight: null,
        deleted: false,
        blocked: false,
        deletePromise: null,
        retryCount: 0,
        idleResolvers: [],
      };
      queues.set(projectId, state);
    }
    return state;
  };

  const notify = (state, status, details = {}) => {
    if (!active) return;
    safeCallback(onStateChange, {
      actorUid: actor,
      projectId: state.projectId,
      revision: state.latestRevision,
      status,
      ...details,
    });
  };

  const isIdle = (state) =>
    !state.timer && !state.ready && !state.inFlight && !state.deletePromise;

  const settleIdle = (state) => {
    if (!isIdle(state)) return;
    const resolvers = state.idleResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  };

  const whenIdle = (state) =>
    isIdle(state)
      ? Promise.resolve()
      : new Promise((resolve) => state.idleResolvers.push(resolve));

  const scheduleTimer = (state, delay) => {
    if (state.timer) clearTimer(state.timer);
    state.ready = false;
    state.timer = setTimer(() => {
      state.timer = null;
      state.ready = true;
      void drain(state);
    }, Math.max(0, delay));
  };

  const drain = async (state) => {
    if (
      !active ||
      state.deleted ||
      state.blocked ||
      state.inFlight ||
      !state.ready ||
      !state.latestProject
    ) {
      settleIdle(state);
      return;
    }
    state.ready = false;
    const project = state.latestProject;
    const revision = state.latestRevision;
    notify(state, "saving", {revision});

    const operation = Promise.resolve().then(() => saveProject(project));
    state.inFlight = {revision, operation};
    try {
      const savedProject = await operation;
      state.retryCount = 0;
      const stale = state.latestRevision > revision;
      if (stale && state.latestProject) {
        state.latestProject = {
          ...state.latestProject,
          ...cloudMetadata(savedProject),
        };
      }
      if (active && !state.deleted) {
        safeCallback(onSaveSuccess, {
          actorUid: actor,
          projectId: state.projectId,
          revision,
          savedProject,
          stale,
        });
        notify(state, stale ? "pending" : "saved", {revision, stale});
      }
    } catch (error) {
      if (active && !state.deleted) {
        safeCallback(onSaveError, {
          actorUid: actor,
          projectId: state.projectId,
          revision,
          error,
        });
      }
      if (!state.deleted && active && error?.code === "studio/conflict") {
        state.blocked = true;
        state.ready = false;
        if (state.timer) clearTimer(state.timer);
        state.timer = null;
        notify(state, "conflict", {revision: state.latestRevision, error});
      } else if (!state.deleted && active) {
        state.retryCount += 1;
        if (state.retryCount <= maxAutoRetries) {
          const delay = retryDelayMs * 2 ** (state.retryCount - 1);
          notify(state, "retrying", {
            revision: state.latestRevision,
            error,
            attempt: state.retryCount,
          });
          scheduleTimer(state, delay);
        } else {
          notify(state, "error", {
            revision: state.latestRevision,
            error,
            attempt: state.retryCount,
          });
        }
      }
    } finally {
      state.inFlight = null;
      if (state.ready && !state.deleted) void drain(state);
      settleIdle(state);
    }
  };

  const schedule = (project) => {
    if (!active) throw new Error("This Studio save session has ended.");
    const projectId = stringValue(project?.id);
    if (!projectId) throw new Error("Studio projects require an ID before saving.");
    const sync = syncMetadata(project);
    if (sync.actorUid !== actor || sync.pending !== true) {
      throw new Error("Mark the Studio project pending for this user before saving.");
    }
    const revision = integerValue(sync.revision);
    if (revision < 1) throw new Error("Studio pending revisions must be positive.");
    const state = stateFor(projectId);
    if (state.deleted) throw new Error("A deleted Studio project cannot be saved.");
    if (revision < state.latestRevision) return revision;
    if (revision > state.latestRevision) state.retryCount = 0;
    state.latestProject = project;
    state.latestRevision = revision;
    state.ready = false;
    if (state.blocked || sync.conflict) {
      state.blocked = true;
      notify(state, "conflict", {revision});
      return revision;
    }
    scheduleTimer(state, debounceMs);
    notify(state, "pending", {revision});
    return revision;
  };

  const retry = (projectId) => {
    const state = queues.get(projectId);
    if (!active || !state || state.deleted || state.blocked || !state.latestProject) return false;
    state.retryCount = 0;
    state.ready = true;
    if (state.timer) {
      clearTimer(state.timer);
      state.timer = null;
    }
    void drain(state);
    return true;
  };

  const flush = async (projectId = "") => {
    const states = projectId
      ? [queues.get(projectId)].filter(Boolean)
      : [...queues.values()];
    for (const state of states) {
      if (state.deleted || state.blocked || !state.latestProject) continue;
      if (state.timer) {
        clearTimer(state.timer);
        state.timer = null;
      }
      state.ready = true;
      void drain(state);
    }
    await Promise.all(states.map(whenIdle));
  };

  const remove = (project) => {
    const projectId = stringValue(project?.id);
    if (!projectId) return Promise.reject(new Error("Studio projects require an ID."));
    const state = stateFor(projectId);
    if (state.deletePromise) return state.deletePromise;
    state.deleted = true;
    state.latestProject = null;
    state.ready = false;
    if (state.timer) {
      clearTimer(state.timer);
      state.timer = null;
    }
    notify(state, "deleting");
    state.deletePromise = (async () => {
      if (state.inFlight) {
        await state.inFlight.operation.catch(() => undefined);
      }
      // The injected delete must be idempotent. Always invoking it closes the
      // gap where an upload-created root exists outside this coordinator's
      // in-flight state.
      await deleteProject(projectId, project);
      if (active) {
        safeCallback(onDeleteSuccess, {actorUid: actor, projectId});
        notify(state, "deleted");
      }
      queues.delete(projectId);
    })().catch((error) => {
      state.deleted = false;
      if (active) {
        safeCallback(onDeleteError, {actorUid: actor, projectId, error});
        notify(state, "delete-error", {error});
      }
      throw error;
    }).finally(() => {
      state.deletePromise = null;
      settleIdle(state);
    });
    return state.deletePromise;
  };

  const dispose = () => {
    active = false;
    for (const state of queues.values()) {
      if (state.timer) clearTimer(state.timer);
      state.timer = null;
      state.ready = false;
      settleIdle(state);
    }
  };

  return {
    schedule,
    flush,
    retry,
    delete: remove,
    dispose,
    reset(projectId) {
      const state = queues.get(projectId);
      if (state?.inFlight || state?.deletePromise) throw new Error("Wait for the current save to finish before loading another version.");
      if (state?.timer) clearTimer(state.timer);
      if (state) {
        state.timer = null;
        state.ready = false;
        settleIdle(state);
      }
      queues.delete(projectId);
    },
  };
}
