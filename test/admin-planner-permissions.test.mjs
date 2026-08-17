import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {buildFirstAdminPageAccess_} from "../functions/helpers/helpers.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Super User bootstrap includes Promotion Planner admin access", () => {
  assert.equal(buildFirstAdminPageAccess_().planner, "admin");
});

test("admin permission UI and privileged backend manage Planner explicitly", () => {
  const adminSource = fs.readFileSync(path.join(projectRoot, "public/admin.js"), "utf8");
  const backendSource = fs.readFileSync(path.join(projectRoot, "functions/index.js"), "utf8");

  assert.match(adminSource, /\{key: "planner", label: "Promotion Planner"\}/);
  assert.match(adminSource, /keys: \["studio", "planner"\]/);
  assert.match(backendSource, /\{key: "planner", label: "Promotion Planner"\}/);
  assert.match(backendSource, /if \(key === "planner"\)/);
});
