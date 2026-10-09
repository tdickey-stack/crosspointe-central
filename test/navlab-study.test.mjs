import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("../public/navlab-study.js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;
const study = await import(moduleUrl);

test("lab drafts use an isolated key while retaining production import compatibility", () => {
  assert.equal(study.getSundayNotesStorageKey({date: "September 20, 2026"}), "navlab-sermon-notes-September 20, 2026");
  assert.equal(study.getSundayNotesStorageKey({}), "navlab-sermon-notes-default");
  assert.equal(study.getProductionSundayNotesStorageKey({date: "September 20, 2026"}), "central-sermon-notes-September 20, 2026");
});

test("the production shell selects Central storage while the lab remains isolated", () => {
  const sunday = {date: "October 11, 2026"};
  assert.equal(study.isProductionSundayStudy({
    documentElement: {dataset: {productionShell: "true"}},
  }), true);
  assert.equal(study.isProductionSundayStudy({
    documentElement: {dataset: {productionShell: "false"}},
  }), false);
  assert.deepEqual(study.getSundayNotesStoragePlan(sunday, true), {
    storageKey: "central-sermon-notes-October 11, 2026",
    migrationKey: "navlab-sermon-notes-October 11, 2026",
    production: true,
  });
  assert.deepEqual(study.getSundayNotesStoragePlan(sunday, false), {
    storageKey: "navlab-sermon-notes-October 11, 2026",
    migrationKey: "central-sermon-notes-October 11, 2026",
    production: false,
  });
});

test("migration copies only into an absent namespace and preserves both drafts", () => {
  const makeStorage = (entries) => {
    const values = new Map(entries);
    return {
      values,
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
    };
  };
  const sunday = {date: "October 11, 2026"};
  const productionPlan = study.getSundayNotesStoragePlan(sunday, true);
  const existing = makeStorage([
    [productionPlan.storageKey, "Central draft"],
    [productionPlan.migrationKey, "Preview draft"],
  ]);
  const loadedExisting = study.loadSundayNotesDraft(existing, productionPlan, null);
  assert.equal(loadedExisting.html, "<div>Central draft</div>");
  assert.equal(loadedExisting.migrated, false);
  assert.equal(existing.values.get(productionPlan.storageKey), "Central draft");
  assert.equal(existing.values.get(productionPlan.migrationKey), "Preview draft");

  const missing = makeStorage([[productionPlan.migrationKey, "Preview draft"]]);
  const loadedMigrated = study.loadSundayNotesDraft(missing, productionPlan, null);
  assert.equal(loadedMigrated.html, "<div>Preview draft</div>");
  assert.equal(loadedMigrated.migrated, true);
  assert.deepEqual(JSON.parse(missing.values.get(productionPlan.storageKey)), {
    type: "rich-text-v1",
    html: "&lt;div&gt;Preview draft&lt;/div&gt;",
  });
  assert.equal(missing.values.get(productionPlan.migrationKey), "Preview draft");

  const previewPlan = study.getSundayNotesStoragePlan(sunday, false);
  const isolatedPreview = makeStorage([
    [previewPlan.storageKey, "Preview draft"],
    [previewPlan.migrationKey, "Central draft"],
  ]);
  const loadedPreview = study.loadSundayNotesDraft(isolatedPreview, previewPlan, null);
  assert.equal(loadedPreview.html, "<div>Preview draft</div>");
  assert.equal(loadedPreview.migrated, false);
  assert.equal(isolatedPreview.values.get(previewPlan.storageKey), "Preview draft");
  assert.equal(isolatedPreview.values.get(previewPlan.migrationKey), "Central draft");
});

test("study config uses Central fields and labels an unconfigured reader honestly", () => {
  const empty = study.getSundayStudyConfig({sunday: {date: "Sunday"}});
  assert.equal(empty.reference, "");
  assert.equal(empty.bible.title, "Browse the Bible");
  assert.match(empty.bible.helperText, /No passage is configured/);
  assert.equal(empty.bible.versionId, "2692");

  const configured = study.getSundayStudyConfig({
    sunday: {scripture: "John 15:1-8"},
    sundaySettings: {sunday_scripture_reference: "Romans 8:1-4", sunday_scripture_bible_id: "111"},
    youVersionAppKey: " key ",
    googleDocsEnabled: "false",
    googleWebClientId: "client-id",
  });
  assert.equal(configured.bible.reference, "Romans 8:1-4");
  assert.equal(configured.bible.versionId, "111");
  assert.equal(configured.bible.appKey, "key");
  assert.equal(configured.google.enabled, false);
});

test("rich-text drafts are fail-closed when a DOM sanitizer is unavailable", () => {
  const stored = JSON.stringify({
    type: "rich-text-v1",
    html: '<strong onclick="steal()">Safe</strong><script>steal()</script>',
  });
  const rendered = study.parseStoredSundayNotes(stored, null);
  assert.doesNotMatch(rendered, /<script>|<strong/i);
  assert.match(rendered, /&lt;script&gt;/);
});

test("the module sanitizes before persistence and defers Google identity to an explicit save", () => {
  assert.match(moduleSource, /sanitizeSundayNotesHtml\(editor\.innerHTML\)/);
  const mountStart = moduleSource.indexOf("export function mountSundayStudy");
  const saveHandler = moduleSource.indexOf('saveButton.addEventListener("click"', mountStart);
  const saveHandlerEnd = moduleSource.indexOf("showPanel(\"notes\")", saveHandler);
  assert.ok(saveHandler > mountStart);
  assert.match(moduleSource.slice(saveHandler, saveHandlerEnd), /await requestToken\(\)/);
  assert.equal(moduleSource.match(/await loadGoogleIdentity\(\)/g)?.length, 1);
  assert.equal(moduleSource.match(/await requestToken\(\)/g)?.length, 1);
});

test("Google Docs export uses the configured web client on the current hosted origin", () => {
  assert.match(moduleSource, /client_id: config\.google\.clientId/);
  assert.match(moduleSource, /https:\/\/www\.googleapis\.com\/auth\/drive\.file/);
  assert.match(moduleSource, /https:\/\/docs\.googleapis\.com\/v1\/documents/);
  assert.match(moduleSource, /https:\/\/docs\.google\.com\/document\/d\/\$\{doc\.documentId\}\/edit/);
  assert.doesNotMatch(moduleSource, /redirect_uri/);
});

test("mobile defaults to Notes and retains both panels while switching", () => {
  assert.match(moduleSource, /let activePanel = "notes"/);
  assert.match(moduleSource, /notesPanel\.hidden = isMobile/);
  assert.match(moduleSource, /biblePanel\.hidden = isMobile/);
  assert.doesNotMatch(moduleSource, /workspace\.replaceChildren\(/);
});

test("study controls expose an editor name, complete tab keyboard controls, and reader retry", () => {
  assert.match(moduleSource, /editor\.setAttribute\("aria-label", "Sermon notes"\)/);
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.match(moduleSource, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(moduleSource, /nextTab\.focus\(\)/);
  assert.match(moduleSource, /makeButton\("Retry Bible reader"/);
  assert.match(moduleSource, /addEventListener\("click", initBible/);
});

test("migration is copy-only and Clear writes only the active namespace", () => {
  assert.match(moduleSource, /stored === null/);
  assert.match(moduleSource, /getItem\(storagePlan\.migrationKey\)/);
  assert.doesNotMatch(moduleSource, /removeItem\(/);
  assert.match(moduleSource, /setItem\(storageKey, JSON\.stringify\(\{type: "rich-text-v1", html: ""\}\)\)/);
});
