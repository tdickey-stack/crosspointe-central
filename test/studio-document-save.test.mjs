import assert from "node:assert/strict";
import test from "node:test";

import {createStudioCloud} from "../src/studio/persistence.js";
import {createStudioProject} from "../src/studio/templates.js";

function firestoreHarness() {
  const commits = [];

  class Reference {
    constructor(path) {
      this.path = path;
    }

    collection(name) {
      return new Collection(`${this.path}/${name}`);
    }
  }

  class Collection {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new Reference(`${this.path}/${id}`);
    }
  }

  return {
    commits,
    firestore: {
      doc(path) {
        return new Reference(path);
      },
      batch() {
        const writes = [];
        return {
          set(reference, value) {
            writes.push({type: "set", path: reference.path, value});
          },
          update(reference, value) {
            writes.push({type: "update", path: reference.path, value});
          },
          delete(reference) {
            writes.push({type: "delete", path: reference.path});
          },
          async commit() {
            commits.push(writes);
          },
        };
      },
    },
  };
}

function projectOperationHarness() {
  const records = new Map();
  const actions = [];

  class Reference {
    constructor(path) {
      this.path = path;
    }

    async get() {
      actions.push(`get:${this.path}`);
      const value = records.get(this.path);
      return {
        exists: Boolean(value),
        data: () => structuredClone(value),
      };
    }

    async set(value) {
      actions.push(`set:${this.path}`);
      records.set(this.path, structuredClone(value));
    }

    async update(value) {
      actions.push(`update:${this.path}`);
      records.set(this.path, {
        ...records.get(this.path),
        ...structuredClone(value),
      });
    }

    collection(name) {
      return new Collection(`${this.path}/${name}`);
    }
  }

  class Collection {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new Reference(`${this.path}/${id}`);
    }
  }

  return {
    actions,
    records,
    firestore: {
      doc(path) {
        return new Reference(path);
      },
    },
  };
}

function withFirebaseTimestamp(run) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
      },
    },
  };
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    });
}

test("new document root and pages commit as one atomic batch", async () => {
  await withFirebaseTimestamp(async () => {
    const harness = firestoreHarness();
    const cloud = createStudioCloud({
      auth: {},
      firestore: harness.firestore,
      storage: {},
      user: {uid: "studio-user"},
    });
    const project = createStudioProject("document-one-pager");
    project.id = "document-a";

    const saved = await cloud.saveProject(project);

    assert.equal(saved.cloudBacked, true);
    assert.equal(harness.commits.length, 1);
    assert.deepEqual(
      harness.commits[0].map((write) => [write.type, write.path]),
      [
        ["set", "centralStudioProjects/document-a"],
        [
          "set",
          `centralStudioProjects/document-a/pages/${project.pages[0].id}`,
        ],
      ],
    );
  });
});

test("directory cards commit only after their root and page batch", async () => {
  await withFirebaseTimestamp(async () => {
    const harness = firestoreHarness();
    const cloud = createStudioCloud({
      auth: {},
      firestore: harness.firestore,
      storage: {},
      user: {uid: "studio-user"},
    });
    const project = createStudioProject("document-directory");
    project.id = "directory-a";
    project.pages[0].content.cards = [
      {
        id: "card-a",
        name: "Group A",
        subtitle: "Sundays",
        details: "Room 1",
        imageUrl: "",
        imageStoragePath: "",
        sourceType: "manual",
        sourceId: "",
        publicUrl: "",
      },
    ];

    await cloud.saveProject(project);

    assert.equal(harness.commits.length, 2);
    assert.deepEqual(
      harness.commits[0].map((write) => write.path),
      [
        "centralStudioProjects/directory-a",
        `centralStudioProjects/directory-a/pages/${project.pages[0].id}`,
      ],
    );
    assert.deepEqual(
      harness.commits[1].map((write) => [write.type, write.path]),
      [
        [
          "set",
          `centralStudioProjects/directory-a/pages/${project.pages[0].id}/cards/card-a`,
        ],
      ],
    );
  });
});

test("concurrent saves for a new project serialize and the second updates", async () => {
  await withFirebaseTimestamp(async () => {
    const harness = projectOperationHarness();
    const cloud = createStudioCloud({
      auth: {},
      firestore: harness.firestore,
      storage: {},
      user: {uid: "studio-user"},
    });
    const first = createStudioProject("event-signal-stack");
    first.id = "serialized-project";
    const second = {
      ...first,
      content: {...first.content, title: "Newest title"},
    };

    const [firstSaved, secondSaved] = await Promise.all([
      cloud.saveProject(first),
      cloud.saveProject(second),
    ]);

    assert.equal(firstSaved.cloudBacked, true);
    assert.equal(secondSaved.cloudBacked, true);
    assert.deepEqual(harness.actions, [
      "set:centralStudioProjects/serialized-project",
      "get:centralStudioProjects/serialized-project",
      "update:centralStudioProjects/serialized-project",
    ]);
    assert.equal(
      harness.records.get("centralStudioProjects/serialized-project").content.title,
      "Newest title",
    );
  });
});

test("delete waits for an upload-created project and blocks later saves", async () => {
  await withFirebaseTimestamp(async () => {
    const harness = projectOperationHarness();
    let finishUpload;
    const uploadGate = new Promise((resolve) => {
      finishUpload = resolve;
    });
    const storage = {
      ref(path) {
        return {
          async put() {
            harness.actions.push(`upload-start:${path}`);
            await uploadGate;
            harness.actions.push(`upload-end:${path}`);
          },
          async getDownloadURL() {
            return `https://example.test/${path}`;
          },
        };
      },
    };
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      harness.actions.push("delete-request");
      return {ok: true, status: 200, json: async () => ({deleted: true})};
    };
    try {
      const cloud = createStudioCloud({
        auth: {currentUser: {getIdToken: async () => "studio-token"}},
        firestore: harness.firestore,
        storage,
        user: {uid: "studio-user"},
      });
      const project = createStudioProject("event-signal-stack");
      project.id = "upload-then-delete";
      const upload = cloud.uploadBackground(project, {
        type: "image/jpeg",
        size: 1024,
        name: "background.jpg",
      });
      await Promise.resolve();
      await Promise.resolve();
      const deletion = cloud.deleteProject(project.id, {ignoreMissing: true});
      await assert.rejects(
        cloud.saveProject({...project, content: {...project.content, title: "Late"}}),
        /being deleted/,
      );
      await assert.rejects(
        cloud.uploadHeroLogo(project, {
          type: "image/png",
          size: 512,
          name: "late-logo.png",
        }),
        /being deleted/,
      );
      assert.equal(harness.actions.includes("delete-request"), false);

      finishUpload();
      await upload;
      await deletion;
      assert.equal(harness.actions.at(-1), "delete-request");
      assert.ok(harness.actions.some((action) => action.startsWith("upload-end:")));
    } finally {
      if (previousFetch === undefined) delete globalThis.fetch;
      else globalThis.fetch = previousFetch;
    }
  });
});

test("coordinated deletion can treat an already-missing remote project as deleted", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({error: "Project not found."}),
  });
  try {
    const cloud = createStudioCloud({
      auth: {currentUser: {getIdToken: async () => "studio-token"}},
      firestore: {},
      storage: {},
      user: {uid: "studio-user"},
    });
    assert.deepEqual(
      await cloud.deleteProject("missing-project", {ignoreMissing: true}),
      {projectId: "missing-project", missing: true},
    );
    await assert.rejects(
      cloud.deleteProject("missing-project"),
      (error) => error.status === 404 && error.message === "Project not found.",
    );
  } finally {
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
  }
});
