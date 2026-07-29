import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarSourceCacheId,
} from "./calendar-source-cache.js";

test("calendar source cache IDs depend only on the lookahead window", () => {
  assert.equal(buildCalendarSourceCacheId(14), "v3-14");
  assert.equal(buildCalendarSourceCacheId(21), "v3-21");
  assert.equal(buildCalendarSourceCacheId(21.9), "v3-21");
});

test("calendar source cache IDs normalize invalid lookahead values", () => {
  assert.equal(buildCalendarSourceCacheId(0), "v3-14");
  assert.equal(buildCalendarSourceCacheId(200), "v3-90");
});
