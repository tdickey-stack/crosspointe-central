import assert from "node:assert/strict";
import test from "node:test";

import {
  HomePromotionsValidationError,
  buildPromotionPayload,
  chicagoLocalToIso,
  createPromotionId,
  highlightPresentation,
  instantToChicagoIso,
  isoToChicagoLocal,
} from "../public/admin-home-promotions.js";

const candidate = {
  key: "campaigns:fall-groups",
  type: "campaigns",
  id: "fall-groups",
  title: "Find your group",
  eligible: true,
  item: {title: "Find your group", description: "Source-owned copy"},
};

test("converts Chicago local times with the offset active on that date", () => {
  assert.equal(chicagoLocalToIso("2026-01-15T09:30"), "2026-01-15T09:30:00-06:00");
  assert.equal(chicagoLocalToIso("2026-07-15T09:30"), "2026-07-15T09:30:00-05:00");
  assert.equal(isoToChicagoLocal("2026-07-15T14:30:00Z"), "2026-07-15T09:30");
  assert.equal(isoToChicagoLocal("2026-01-15T15:30:00Z"), "2026-01-15T09:30");
});

test("rejects the nonexistent Chicago hour when daylight time begins", () => {
  assert.throws(
      () => chicagoLocalToIso("2026-03-08T02:30"),
      (error) => error instanceof HomePromotionsValidationError &&
        error.code === "nonexistent-local-time" && /clock moves forward/.test(error.message),
  );
});

test("rejects the ambiguous Chicago hour when daylight time ends", () => {
  assert.throws(
      () => chicagoLocalToIso("2026-11-01T01:30"),
      (error) => error instanceof HomePromotionsValidationError &&
        error.code === "ambiguous-local-time" && /occurs twice/.test(error.message),
  );
});

test("formats an instant as Chicago ISO with an explicit offset", () => {
  assert.equal(
      instantToChicagoIso(new Date("2026-07-15T14:30:45.500Z")),
      "2026-07-15T09:30:45-05:00",
  );
  assert.equal(
      instantToChicagoIso(new Date("2026-01-15T15:30:45.500Z")),
      "2026-01-15T09:30:45-06:00",
  );
});

test("labels scheduled and automatic Home selections without inventing a window", () => {
  assert.deepEqual(highlightPresentation({
    selection: "scheduled",
    endsAt: "2026-07-15T17:00:00-05:00",
  }), {
    selection: "Scheduled",
    timing: "Through Jul 15, 2026, 5:00 PM CDT",
  });
  assert.deepEqual(highlightPresentation({selection: "automatic"}), {
    selection: "Automatic",
    timing: "Filled from current eligible content",
  });
  assert.deepEqual(highlightPresentation({
    selection: "automatic",
    endsAt: "2026-07-15T17:00:00-05:00",
  }), {
    selection: "Automatic",
    timing: "Eligible through Jul 15, 2026, 5:00 PM CDT",
  });
});

test("builds the exact scheduled POST body without copying source content", () => {
  const payload = buildPromotionPayload({
    id: "5bd7a2dc-1f13-4745-9a8e-f02715471d44",
    revision: 4,
    candidate,
    startMode: "scheduled",
    startsAtLocal: "2026-12-01T09:00",
    endsAtLocal: "2026-12-03T17:15",
    order: "2",
    active: true,
  });

  assert.deepEqual(payload, {
    item: {
      id: "5bd7a2dc-1f13-4745-9a8e-f02715471d44",
      sourceType: "campaigns",
      sourceId: "fall-groups",
      startsAt: "2026-12-01T09:00:00-06:00",
      endsAt: "2026-12-03T17:15:00-06:00",
      order: 2,
      active: true,
      revision: 4,
    },
  });
  assert.equal("title" in payload.item, false);
  assert.equal("description" in payload.item, false);
});

test("a Now schedule uses the supplied instant and starts before its required end", () => {
  const payload = buildPromotionPayload({
    id: "124e9159-8d5c-4521-87e4-5e696763a594",
    revision: 0,
    candidate,
    startMode: "now",
    startsAtLocal: "",
    endsAtLocal: "2026-07-16T12:00",
    order: 0,
    active: true,
  }, new Date("2026-07-15T14:30:45Z"));

  assert.equal(payload.item.startsAt, "2026-07-15T09:30:45-05:00");
  assert.equal(payload.item.endsAt, "2026-07-16T12:00:00-05:00");
  assert.equal(payload.item.order, 0);
  assert.equal(payload.item.revision, 0);
});

test("validates the window, priority, and featured-hero exclusion before request", () => {
  const base = {
    id: "7bc3c5da-3f59-4504-adbd-00b52e0679c7",
    revision: 0,
    candidate,
    startMode: "scheduled",
    startsAtLocal: "2026-07-16T12:00",
    endsAtLocal: "2026-07-16T11:00",
    order: 1,
    active: true,
  };
  assert.throws(() => buildPromotionPayload(base), {code: "invalid-window"});
  assert.throws(() => buildPromotionPayload({...base, endsAtLocal: "2026-07-17T11:00", order: 1000}), {code: "invalid-order"});
  assert.throws(() => buildPromotionPayload({
    ...base,
    endsAtLocal: "2026-07-17T11:00",
    candidate: {...candidate, type: "events", eligible: false, unavailableReason: "featured-event"},
  }), {code: "candidate-unavailable"});
});

test("creates the client ID once through browser crypto for idempotent retries", () => {
  const calls = [];
  const value = createPromotionId({randomUUID() {
    calls.push("called");
    return "00392f36-c843-4f88-9000-98058af1a8b7";
  }});
  assert.equal(value, "00392f36-c843-4f88-9000-98058af1a8b7");
  assert.deepEqual(calls, ["called"]);
});
