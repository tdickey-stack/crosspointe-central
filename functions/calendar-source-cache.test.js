import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarSourceCacheId,
} from "./calendar-source-cache.js";

test("calendar source cache IDs depend only on the lookahead window", () => {
  assert.equal(buildCalendarSourceCacheId(14), "v4-14");
  assert.equal(buildCalendarSourceCacheId(21), "v4-21");
  assert.equal(buildCalendarSourceCacheId(21.9), "v4-21");
});

test("calendar source cache IDs normalize invalid lookahead values", () => {
  assert.equal(buildCalendarSourceCacheId(0), "v4-14");
  assert.equal(buildCalendarSourceCacheId(200), "v4-90");
});
