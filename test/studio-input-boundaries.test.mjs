import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  DOCUMENT_FIELD_LIMITS,
  DOCUMENT_LINE_LIST_LIMITS,
  documentFieldWarnings,
  documentLineListItems,
} from '../src/studio/document-fields.js';
import {createLatestRequest} from '../src/studio/uploads.js';
import {getProjectWarnings, createStudioProject} from '../src/studio/templates.js';
import {insertPlainTextAtSelection} from '../src/studio/text-fields.js';

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

test('one-pager list limits validate the full retained draft instead of a truncated render array', () => {
  const project = createStudioProject('document-one-pager');
  const page = project.pages[0];
  page.content.ownerItemsText = 'First\nSecond\nThird\nFourth';
  page.content.ownerItems = ['First', 'Second', 'Third'];

  assert.deepEqual(
    documentLineListItems(page.templateId, page.content, 'ownerItems'),
    ['First', 'Second', 'Third', 'Fourth'],
  );
  assert.ok(
    getProjectWarnings(project).some((warning) =>
      warning.includes('owner responsibilities list has 4 items; this layout supports up to 3'),
    ),
  );

  for (const [itemsField, config] of Object.entries(
    DOCUMENT_LINE_LIST_LIMITS['document-one-pager'],
  )) {
    page.content[config.draftField] = Array.from(
      {length: config.maximum},
      (_, index) => `${itemsField} ${index + 1}`,
    ).join('\n');
    assert.equal(
      documentFieldWarnings(page).some((warning) =>
        warning.startsWith(`The ${config.label} list has`),
      ),
      false,
      itemsField,
    );
    page.content[config.draftField] += `\n${itemsField} excess`;
    assert.equal(
      documentFieldWarnings(page).some((warning) =>
        warning.startsWith(`The ${config.label} list has`),
      ),
      true,
      itemsField,
    );
  }
});

test('plain-text contenteditable insertion prefers the native undo-aware edit command', () => {
  let rangeTouched = false;
  const element = {contains: () => true};
  const range = {
    commonAncestorContainer: element,
    deleteContents() { rangeTouched = true; },
  };
  const commands = [];
  const documentObject = {
    defaultView: {
      getSelection: () => ({rangeCount: 1, getRangeAt: () => range}),
    },
    execCommand(command, showUi, value) {
      commands.push([command, showUi, value]);
      return true;
    },
  };

  assert.equal(
    insertPlainTextAtSelection('First\nSecond', element, documentObject),
    true,
  );
  assert.deepEqual(commands, [['insertText', false, 'First\nSecond']]);
  assert.equal(rangeTouched, false);
});

test('plain-text contenteditable insertion retains multiline fallback and restores the caret', () => {
  const appended = [];
  const fragment = {append: (node) => appended.push(node)};
  const element = {contains: () => true};
  let inserted = null;
  let collapsed = null;
  const range = {
    commonAncestorContainer: element,
    deleteContents() {},
    insertNode(node) { inserted = node; },
    collapse(value) { collapsed = value; },
  };
  let restoredRange = null;
  const selection = {
    rangeCount: 1,
    getRangeAt: () => range,
    removeAllRanges() {},
    addRange(nextRange) { restoredRange = nextRange; },
  };
  const documentObject = {
    defaultView: {getSelection: () => selection},
    execCommand: () => false,
    createDocumentFragment: () => fragment,
    createElement: (tagName) => ({tagName}),
    createTextNode: (text) => ({text}),
  };

  assert.equal(
    insertPlainTextAtSelection('First\nSecond', element, documentObject),
    true,
  );
  assert.equal(inserted, fragment);
  assert.deepEqual(appended, [
    {text: 'First'},
    {tagName: 'br'},
    {text: 'Second'},
  ]);
  assert.equal(collapsed, false);
  assert.equal(restoredRange, range);
});
