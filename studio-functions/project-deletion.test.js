import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRESTORE_DELETE_BATCH_LIMIT,
  deleteStudioProjectRecords,
} from "./project-deletion.js";

function reference(path, cards = []) {
  return {
    path,
    collection(name) {
      assert.equal(name, "cards");
      return {
        async get() {
          return {docs: cards.map((card) => ({ref: card}))};
        },
      };
    },
  };
}

function snapshot(references) {
  return {docs: references.map((item) => ({ref: item}))};
}

test("project deletion removes nested cards first in bounded batches", async () => {
  const project = reference("centralStudioProjects/project-a");
  const cards = Array.from(
    {length: FIRESTORE_DELETE_BATCH_LIMIT + 1},
    (_, index) => reference(`${project.path}/pages/directory/cards/card-${index}`),
  );
  const directoryPage = reference(
    `${project.path}/pages/directory`,
    cards,
  );
  const contentPage = reference(`${project.path}/pages/content`);
  const slide = reference(`${project.path}/slides/primary`);
  const membership = reference("centralStudioMemberships/member_project-a");
  const share = reference("centralStudioShares/share-a");
  const existing = new Set([
    project.path,
    directoryPage.path,
    contentPage.path,
    slide.path,
    membership.path,
    share.path,
    ...cards.map((card) => card.path),
  ]);
  const commits = [];
  const firestore = {
    batch() {
      const deletes = [];
      return {
        delete(item) {
          deletes.push(item.path);
        },
        async commit() {
          commits.push(deletes);
          deletes.forEach((path) => existing.delete(path));
        },
      };
    },
  };

  await deleteStudioProjectRecords({
    firestore,
    projectReference: project,
    memberships: snapshot([membership]),
    shares: snapshot([share]),
    pages: snapshot([directoryPage, contentPage]),
    slides: snapshot([slide]),
  });

  assert.deepEqual(existing, new Set());
  assert.equal(commits.length, 3);
  assert.ok(
    commits.every((deletes) => deletes.length <= FIRESTORE_DELETE_BATCH_LIMIT),
  );
  assert.ok(commits[0].every((path) => path.includes("/cards/")));
  assert.ok(commits[1].every((path) => path.includes("/cards/")));
  assert.ok(commits[2].includes(directoryPage.path));
  assert.ok(commits[2].includes(project.path));
});

test("a nested-card batch failure preserves every parent record", async () => {
  const project = reference("centralStudioProjects/project-b");
  const card = reference(`${project.path}/pages/directory/cards/card-a`);
  const page = reference(`${project.path}/pages/directory`, [card]);
  const slide = reference(`${project.path}/slides/primary`);
  const membership = reference("centralStudioMemberships/member_project-b");
  const share = reference("centralStudioShares/share-b");
  const existing = new Set([
    project.path,
    page.path,
    card.path,
    slide.path,
    membership.path,
    share.path,
  ]);
  let commits = 0;
  const firestore = {
    batch() {
      const deletes = [];
      return {
        delete(item) {
          deletes.push(item.path);
        },
        async commit() {
          commits += 1;
          throw new Error("card delete failed");
        },
      };
    },
  };

  await assert.rejects(
    deleteStudioProjectRecords({
      firestore,
      projectReference: project,
      memberships: snapshot([membership]),
      shares: snapshot([share]),
      pages: snapshot([page]),
      slides: snapshot([slide]),
    }),
    /card delete failed/u,
  );

  assert.equal(commits, 1);
  assert.deepEqual(existing, new Set([
    project.path,
    page.path,
    card.path,
    slide.path,
    membership.path,
    share.path,
  ]));
});

test("large membership cleanup keeps every Firestore batch below the limit", async () => {
  const project = reference("centralStudioProjects/project-c");
  const page = reference(`${project.path}/pages/content`);
  const memberships = Array.from(
    {length: FIRESTORE_DELETE_BATCH_LIMIT + 1},
    (_, index) => reference(`centralStudioMemberships/member-${index}`),
  );
  const commitSizes = [];
  const deleted = [];
  const firestore = {
    batch() {
      const references = [];
      return {
        delete(item) {
          references.push(item);
        },
        async commit() {
          commitSizes.push(references.length);
          deleted.push(...references.map((item) => item.path));
        },
      };
    },
  };

  await deleteStudioProjectRecords({
    firestore,
    projectReference: project,
    memberships: snapshot(memberships),
    shares: snapshot([]),
    pages: snapshot([page]),
    slides: snapshot([]),
  });

  assert.deepEqual(commitSizes, [FIRESTORE_DELETE_BATCH_LIMIT, 3]);
  assert.equal(deleted.length, memberships.length + 2);
  assert.equal(deleted.at(-1), project.path);
});
