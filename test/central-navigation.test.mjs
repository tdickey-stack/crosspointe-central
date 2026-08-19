import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(projectRoot, "public/app.js"), "utf8");
const adminSource = fs.readFileSync(path.join(projectRoot, "public/admin.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "public/index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "public/styles.css"), "utf8");
const plannerSource = fs.readFileSync(path.join(projectRoot, "src/planner/main.jsx"), "utf8");
const studioSource = fs.readFileSync(path.join(projectRoot, "src/studio/main.jsx"), "utf8");

test("Central workspace menu checks the signed-in user's own active record", () => {
  assert.match(indexSource, /firebase-firestore-compat\.js/);
  assert.match(
      appSource,
      /CENTRAL_ADMIN_USER_COLLECTION_PATH \+ "\/" \+ user\.uid/,
  );
  assert.match(appSource, /userRecord && userRecord\.active === true/);
  assert.match(appSource, /hasAnyCentralNavigationPermission_\(pageAccess\)/);
  assert.match(appSource, /\.catch\(function\(\) \{[\s\S]*?renderCentralAppNavigation_\(null, null\)/);
});

test("Central workspace menu limits Studio and Planner to usable access", () => {
  assert.match(appSource, /\{href: "\/studio", label: "Studio"\}/);
  assert.match(appSource, /\{href: "\/planner", label: "Planner"\}/);
  assert.match(appSource, /\["view", "propose", "edit", "approve", "admin"\]/);
  assert.match(appSource, /pageAccessKey === "planner"/);
});

test("Central workspace menu visually honors its hidden state", () => {
  assert.match(appSource, /panelEl\.hidden = !centralAppNavigationOpen/);
  assert.match(
      stylesSource,
      /\.central-app-navigation-panel\[hidden\]\s*\{\s*display:\s*none;/,
  );
});

test("Admin navigation provides a permission-aware Planner destination", () => {
  assert.match(adminSource, /id: "planner"/);
  assert.match(adminSource, /route: "\/planner"/);
  assert.match(adminSource, /\{type: "page", id: "planner"\}/);
  assert.match(adminSource, /pageAccessKey === "planner"/);
});

test("Planner sidebar links to Central, Admin, and Studio", () => {
  assert.match(plannerSource, /aria-label="Central tools"/);
  assert.match(plannerSource, /href="\/admin"/);
  assert.match(plannerSource, /href="\/studio"/);
  assert.match(plannerSource, /href="\/" className="planner-central-link"/);
});

test("Studio hamburger links to Central, Admin, and Planner", () => {
  assert.match(studioSource, /function StudioNavigationMenu\(\)/);
  assert.match(studioSource, /aria-label="Open Studio navigation"/);
  assert.match(studioSource, /href="\/" onClick=\{\(\) => setOpen\(false\)\}>Central/);
  assert.match(studioSource, /href="\/admin" onClick=\{\(\) => setOpen\(false\)\}>Admin/);
  assert.match(studioSource, /href="\/planner" onClick=\{\(\) => setOpen\(false\)\}>Planner/);
});
