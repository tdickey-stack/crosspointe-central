// Separate project records prevent an older tab's project list from erasing
// another tab's work. Pending drafts also have one slot per tab, so competing
// drafts of the same project survive until explicitly saved or recovered.
export function createStudioBrowserCache({
  storage, key, actorUid, prepare = (project) => project,
  migrate = (project) => project,
  writerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  now = () => Date.now(),
}) {
  const prefix = `${key}:records:`;
  const projectPrefix = (id) => `${prefix}${encodeURIComponent(id)}:`;
  const parse = (value, fallback = null) => {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  };
  const entries = () => {
    const found = [];
    for (let index = 0; index < storage.length; index += 1) {
      const recordKey = storage.key(index);
      if (recordKey?.startsWith(prefix)) {
        const record = parse(storage.getItem(recordKey));
        if (record) found.push({key: recordKey, ...record});
      }
    }
    return found;
  };
  const attribute = (project) => {
    // The account namespace identifies the viewer of a shared project. Its
    // owner remains unchanged; it must not be treated as another user's cache.
    if (actorUid && project.shared && !project._studioSync?.actorUid) {
      return {...project, _studioSync: {actorUid, revision: 0, syncedRevision: 0, pending: false}};
    }
    if (project._studioSync?.pending && !project._studioSync.changeId) {
      return {...project, _studioSync: {...project._studioSync,
        changeId: globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random()}`}};
    }
    return project;
  };
  const draftIdentity = (project) => project._studioSync?.changeId || JSON.stringify(project);
  const retireDraft = (project) => {
    const identity = draftIdentity(project);
    for (const record of entries()) {
      if (record.kind === "draft" && record.project?.id === project.id &&
          draftIdentity(record.project) === identity) storage.removeItem(record.key);
    }
  };
  const writeProject = (input) => {
    if (!input?.id) return;
    const project = prepare(attribute(input));
    const pending = project._studioSync?.pending === true;
    const recordKey = `${projectPrefix(project.id)}${pending ? `draft:${writerId}` : "saved"}`;
    if (!pending) {
      const existing = parse(storage.getItem(recordKey));
      // A stale tab cannot replace a newer acknowledged cloud snapshot.
      const currentRevision = existing?.project?._cloudRevision ?? -1;
      const nextRevision = project._cloudRevision ?? -1;
      if (currentRevision > nextRevision) return;
    }
    storage.setItem(recordKey, JSON.stringify({kind: pending ? "draft" : "saved", project, writtenAt: now()}));
    if (!pending && project._studioSync?.changeId) retireDraft(project);
  };
  const read = () => {
    // Import the old whole-array cache only after each record is durable. If
    // storage is full, its untouched original remains a recovery source.
    const legacy = parse(storage.getItem(key), []);
    let migrationError = null;
    if (Array.isArray(legacy) && legacy.length) {
      try {
        for (const project of legacy) writeProject(migrate(project));
        storage.removeItem(key);
      } catch (error) { migrationError = error; }
    }
    const records = entries();
    const deleted = new Set(records.filter((record) => record.kind === "deleted").map((record) => record.projectId));
    const grouped = new Map();
    for (const record of records) {
      if (!record.project?.id || record.kind === "recovery") continue;
      const project = attribute(migrate(record.project));
      const list = grouped.get(project.id) || [];
      list.push({...record, project});
      grouped.set(project.id, list);
    }
    if (migrationError) {
      for (const input of legacy) {
        const project = attribute(migrate(input));
        const list = grouped.get(project.id) || [];
        list.push({kind: project._studioSync?.pending ? "draft" : "saved", project, writtenAt: 0});
        grouped.set(project.id, list);
      }
    }
    const projects = [];
    const recoveryProjects = records.filter((record) => record.kind === "recovery" && record.project?.id)
      .map((record) => attribute(migrate(record.project)));
    for (const [id, recordsForProject] of grouped) {
      const draftsByIdentity = new Map();
      for (const record of recordsForProject.filter((item) => item.kind === "draft")) {
        const identity = draftIdentity(record.project);
        if ((draftsByIdentity.get(identity)?.writtenAt ?? -1) < record.writtenAt) draftsByIdentity.set(identity, record);
      }
      const drafts = [...draftsByIdentity.values()].sort((a, b) => b.writtenAt - a.writtenAt);
      if (deleted.has(id)) {
        recoveryProjects.push(...drafts.map((record) => record.project));
        continue;
      }
      const saved = recordsForProject.filter((record) => record.kind === "saved")
        .sort((a, b) => (b.project._cloudRevision ?? -1) - (a.project._cloudRevision ?? -1) || b.writtenAt - a.writtenAt)[0];
      const selected = drafts[0] || saved;
      if (selected) projects.push(selected.project);
      recoveryProjects.push(...drafts.slice(1).map((record) => record.project));
    }
    return {projects, recoveryProjects, migrationError};
  };
  const write = (projects, previousProjects = []) => {
    const previous = new Map(previousProjects.map((project) => [project.id, project]));
    for (const project of projects) {
      if (previous.get(project.id) !== project) writeProject(project);
    }
  };
  const remove = (projectId) => {
    // A tombstone prevents an older open tab's cached list resurrecting a
    // deleted/left project. Unsent drafts remain available as recovery copies.
    storage.setItem(`${projectPrefix(projectId)}deleted`, JSON.stringify({kind: "deleted", projectId, writtenAt: now()}));
    storage.removeItem(`${projectPrefix(projectId)}saved`);
  };
  const restore = (projects) => {
    for (const project of projects) {
      writeProject(project);
      storage.removeItem(`${projectPrefix(project.id)}deleted`);
    }
  };
  const preserveForRecovery = (project) => {
    const recoveryId = project._studioSync?.changeId || globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random()}`;
    const recordKey = `${projectPrefix(project.id)}recovery:${encodeURIComponent(recoveryId)}`;
    storage.setItem(recordKey, JSON.stringify({kind: "recovery", project: prepare(project), writtenAt: now()}));
  };
  const retireRecovery = (project) => {
    const identity = draftIdentity(project);
    for (const record of entries()) {
      if (record.kind === "recovery" && record.project?.id === project.id &&
          draftIdentity(record.project) === identity) storage.removeItem(record.key);
    }
  };
  return {read, write, restore, remove, retireDraft, preserveForRecovery, retireRecovery};
}
