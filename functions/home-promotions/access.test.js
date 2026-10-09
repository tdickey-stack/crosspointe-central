import assert from "node:assert/strict";
import test from "node:test";
import {assertHomePromotionAccess} from "./access.js";

test("Home promotions requires Homepage permission", () => {
  for (const hub of ["none", "view", "propose", "edit", "approve", "admin"]) {
    const actor = {uid: "user", userData: {
      active: true, pageAccess: {hub, users: "admin"},
    }};
    if (hub !== "none") assert.equal(assertHomePromotionAccess(actor), actor);
    else assert.throws(() => assertHomePromotionAccess(actor), {status: 403});
    if (["edit", "approve", "admin"].includes(hub)) {
      assert.equal(assertHomePromotionAccess(actor, true), actor);
    } else {
      assert.throws(() => assertHomePromotionAccess(actor, true),
          {status: 403});
    }
  }
});

test("inactive and unauthenticated users cannot read or publish", () => {
  const inactive = {uid: "user", userData: {
    active: false, pageAccess: {hub: "admin"},
  }};
  for (const actor of [null, {}, inactive]) {
    assert.throws(() => assertHomePromotionAccess(actor), {status: 403});
    assert.throws(() => assertHomePromotionAccess(actor, true), {status: 403});
  }
});

test("legacy Homepage access inherits Settings only when hub is absent", () => {
  const actor = {uid: "legacy", userData: {
    active: true, pageAccess: {settings: "edit"},
  }};
  assert.equal(assertHomePromotionAccess(actor, true), actor);
  actor.userData.pageAccess.hub = "none";
  assert.throws(() => assertHomePromotionAccess(actor, true), {status: 403});
});
