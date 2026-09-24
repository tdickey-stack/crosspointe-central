import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {DOCUMENT_FIELD_LIMITS, documentFieldWarnings} from '../src/studio/document-fields.js';
import {createLatestRequest} from '../src/studio/uploads.js';
import {getProjectWarnings, createStudioProject} from '../src/studio/templates.js';

test('document text limits match the enforced cloud contract and flag existing over-limit projects', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const [templateId, limits] of Object.entries(DOCUMENT_FIELD_LIMITS)) {
    for (const [field, maximum] of Object.entries(limits)) {
      assert.ok(rules.includes(`validStudioString(content.${field}, ${maximum})`), `${templateId}.${field}`);
      const page = {templateId, content:{[field]:'a'.repeat(maximum)}};
      assert.deepEqual(documentFieldWarnings(page), []);
      page.content[field] += 'b';
      assert.equal(documentFieldWarnings(page).length, 1);
    }
  }
  const project = createStudioProject('document-one-pager');
  project.pages[0].content.footerReference = 'x'.repeat(35);
  assert.ok(getProjectWarnings(project).some((warning) => warning.includes('34 characters')));
});

test('older uploads cannot replace a newer choice, removal, or unmounted editor', async () => {
  const request = createLatestRequest();
  let resolveOld;
  const pending = new Promise((resolve) => {resolveOld = resolve;});
  const old = request.begin();
  let image = 'original';
  const completed = pending.then(() => {if (old()) image = 'old';});
  const current = request.begin();
  if (current()) image = 'new';
  resolveOld();
  await completed;
  assert.equal(image, 'new');
  request.cancel();
  assert.equal(current(), false);
  assert.equal(old(), false);
});
