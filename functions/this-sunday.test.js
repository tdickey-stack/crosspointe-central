import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThisSundayDateStorageFields,
  getAutomaticSundayDateIso,
  resolveThisSundayDate,
} from "./this-sunday.js";

test("automatic Sunday date uses the upcoming Sunday", () => {
  assert.equal(
      getAutomaticSundayDateIso(
          new Date("2026-08-05T18:00:00.000Z"),
          "America/Chicago",
      ),
      "2026-08-09",
  );
});

test("automatic date keeps the current date throughout local Sunday", () => {
  assert.equal(
      getAutomaticSundayDateIso(
          new Date("2026-08-10T04:30:00.000Z"),
          "America/Chicago",
      ),
      "2026-08-09",
  );
});

test("automatic Sunday date advances after local Sunday ends", () => {
  assert.equal(
      getAutomaticSundayDateIso(
          new Date("2026-08-10T05:30:00.000Z"),
          "America/Chicago",
      ),
      "2026-08-16",
  );
});

test("legacy Sunday documents default to automatic date mode", () => {
  const resolved = resolveThisSundayDate({
    date_iso: "2026-07-26",
    sermon_title: "A Hope That Holds",
  }, {
    now: new Date("2026-08-05T18:00:00.000Z"),
    timezone: "America/Chicago",
  });

  assert.equal(resolved.date_override_enabled, false);
  assert.equal(resolved.date_iso, "2026-08-09");
  assert.equal(resolved.date, "August 9, 2026");
  assert.equal(resolved.sermon_title, "A Hope That Holds");
});

test("explicit date overrides remain fixed", () => {
  const resolved = resolveThisSundayDate({
    date_override_enabled: true,
    date_iso: "2026-12-27",
  }, {
    now: new Date("2026-08-05T18:00:00.000Z"),
    timezone: "America/Chicago",
  });

  assert.equal(resolved.date_override_enabled, true);
  assert.equal(resolved.date_iso, "2026-12-27");
  assert.equal(resolved.date, "December 27, 2026");
});

test("automatic publishing does not store a fixed date", () => {
  assert.deepEqual(buildThisSundayDateStorageFields({
    date_override_enabled: false,
    date_iso: "2026-08-09",
  }), {
    date_override_enabled: false,
    date: "",
    date_iso: "",
  });
});

test("override publishing stores the selected date", () => {
  assert.deepEqual(buildThisSundayDateStorageFields({
    date_override_enabled: true,
    date_iso: "2026-12-27",
  }), {
    date_override_enabled: true,
    date: "December 27, 2026",
    date_iso: "2026-12-27",
  });
});
