import assert from "node:assert/strict";
import test from "node:test";

import {
  CENTRAL_REGISTRATION_SIGNUP_FIELDS,
  getCentralRegistrationSignups,
} from "./registrations.js";

test("requests every signup relationship required by the public card", () => {
  assert.deepEqual(
      CENTRAL_REGISTRATION_SIGNUP_FIELDS.filter((field) => {
        return [
          "categories",
          "next_signup_time",
          "selection_types",
          "signup_location",
        ].includes(field);
      }),
      [
        "categories",
        "next_signup_time",
        "selection_types",
        "signup_location",
      ],
  );
});

/**
 * Creates a Registrations response containing public and private resources.
 *
 * @return {Object} Planning Center JSON:API fixture.
 */
function buildPayload() {
  return {
    data: [
      {
        type: "Signup",
        id: "signup-1",
        attributes: {
          name: "Student Camp",
          description: "<p>Join us for <strong>camp</strong>.</p>",
          logo_url: "https://example.com/camp.jpg",
          new_registration_url:
            "https://crosspointetv.churchcenter.com/registrations/events/1",
          archived: false,
          open: true,
          closed: false,
          at_maximum_capacity: true,
          open_at: "2026-01-01T12:00:00Z",
          close_at: "2026-08-01T12:00:00Z",
        },
        relationships: {
          categories: {data: [{type: "Category", id: "category-central"}]},
          selection_types: {
            data: [
              {type: "SelectionType", id: "selection-student"},
              {type: "SelectionType", id: "selection-leader"},
            ],
          },
          next_signup_time: {
            data: {type: "SignupTime", id: "signup-time-1"},
          },
          signup_location: {
            data: {type: "SignupLocation", id: "signup-location-1"},
          },
        },
      },
      {
        type: "Signup",
        id: "signup-private",
        attributes: {
          name: "Staff Only",
          new_registration_url:
            "https://crosspointetv.churchcenter.com/registrations/events/2",
          open: true,
          closed: false,
        },
        relationships: {
          categories: {data: [{type: "Category", id: "category-staff"}]},
        },
      },
    ],
    included: [
      {
        type: "Category",
        id: "category-central",
        attributes: {name: "Central"},
      },
      {
        type: "Category",
        id: "category-staff",
        attributes: {name: "Staff"},
      },
      {
        type: "SelectionType",
        id: "selection-student",
        attributes: {
          name: "Student",
          price_cents: 12500,
          price_currency_symbol: "$",
          price_formatted: "125.00",
          publicly_available: true,
          waitlist: true,
        },
      },
      {
        type: "SelectionType",
        id: "selection-leader",
        attributes: {
          name: "Leader",
          price_cents: 0,
          price_currency_symbol: "$",
          price_formatted: "0.00",
          publicly_available: true,
          waitlist: false,
        },
      },
      {
        type: "SignupTime",
        id: "signup-time-1",
        attributes: {
          starts_at: "2026-08-10T14:00:00Z",
          ends_at: "2026-08-12T18:00:00Z",
          all_day: false,
        },
      },
      {
        type: "SignupLocation",
        id: "signup-location-1",
        attributes: {
          name: "CrossPointe Church",
          subpremise: "Event Hall",
          formatted_address: "2601 24th Ave SE\nNorman, OK 73071",
        },
      },
      {
        type: "Person",
        id: "person-1",
        attributes: {
          name: "Private Person",
          email: "private@example.com",
        },
      },
      {
        type: "Attendee",
        id: "attendee-1",
        attributes: {name: "Private Attendee"},
      },
    ],
  };
}

test("returns only open Central-category signups", () => {
  const signups = getCentralRegistrationSignups(buildPayload(), {
    categoryName: "Central",
    now: "2026-07-17T12:00:00Z",
  });

  assert.equal(signups.length, 1);
  assert.equal(signups[0].id, "signup-1");
  assert.equal(signups[0].title, "Student Camp");
  assert.equal(signups[0].description, "Join us for camp.");
  assert.equal(signups[0].location, "Event Hall");
  assert.equal(signups[0].venue, "CrossPointe Church");
  assert.equal(
      signups[0].address,
      "2601 24th Ave SE\nNorman, OK 73071",
  );
  assert.equal(signups[0].price_label, "Free–$125");
  assert.equal(signups[0].status, "waitlist");
  assert.equal(signups[0].status_label, "Waitlist available");
});

test("never exposes attendee or person resources", () => {
  const output = JSON.stringify(getCentralRegistrationSignups(buildPayload()));

  assert.doesNotMatch(output, /Private Person/);
  assert.doesNotMatch(output, /private@example\.com/);
  assert.doesNotMatch(output, /Private Attendee/);
});

test("shows closing-soon and closed states until the event ends", () => {
  const closingSoonPayload = buildPayload();
  closingSoonPayload.data[0].attributes.at_maximum_capacity = false;
  const closingSoon = getCentralRegistrationSignups(closingSoonPayload, {
    now: "2026-07-26T12:00:00Z",
  });

  assert.equal(closingSoon[0].status, "closing-soon");
  assert.equal(closingSoon[0].status_label, "Registration closing soon");

  const closed = getCentralRegistrationSignups(buildPayload(), {
    now: "2026-08-02T12:00:00Z",
  });

  assert.equal(closed[0].status, "closed");
  assert.equal(closed[0].status_label, "Registration closed");

  const eventEnded = getCentralRegistrationSignups(buildPayload(), {
    now: "2026-08-12T18:00:01Z",
  });

  assert.deepEqual(eventEnded, []);
});

test("includes open Central signups more than 30 days before the event", () => {
  const signups = getCentralRegistrationSignups(buildPayload(), {
    now: "2026-02-01T12:00:00Z",
  });
  assert.equal(signups.length, 1);
  assert.equal(signups[0].id, "signup-1");
});

test("preserves closing-date expiry for undated signups", () => {
  const missingDatePayload = buildPayload();
  missingDatePayload.included = missingDatePayload.included.filter((item) => {
    return item.type !== "SignupTime";
  });
  missingDatePayload.data[0].attributes.close_at = "2026-10-28T05:00:00Z";
  const closeDateFallback = getCentralRegistrationSignups(missingDatePayload, {
    now: "2026-08-10T15:26:15Z",
  });
  assert.equal(closeDateFallback.length, 1);
  assert.equal(closeDateFallback[0].starts_at, "");
  assert.equal(closeDateFallback[0].close_at, "2026-10-28T05:00:00.000Z");

  assert.deepEqual(getCentralRegistrationSignups(missingDatePayload, {
    now: "2026-10-28T05:00:00Z",
  }), []);
});

test("includes ongoing Central signups only while explicitly open", () => {
  const payload = buildPayload();
  const signup = payload.data[0];
  signup.attributes.name = "Under One Roof Memorial Bricks";
  signup.attributes.close_at = null;
  signup.attributes.at_maximum_capacity = false;
  signup.relationships.next_signup_time.data = null;
  const options = {now: "2026-09-05T18:00:00Z"};

  const signups = getCentralRegistrationSignups(payload, options);
  assert.equal(signups.length, 1);
  assert.equal(signups[0].title, "Under One Roof Memorial Bricks");
  assert.equal(signups[0].starts_at, "");
  assert.equal(signups[0].close_at, "");
  assert.equal(signups[0].status, "open");
  assert.equal(signups[0].status_label, "Registration open");

  signup.attributes.closed = true;
  assert.deepEqual(getCentralRegistrationSignups(payload, options), []);
  signup.attributes.closed = false;
  for (const open of [false, null, undefined]) {
    signup.attributes.open = open;
    assert.deepEqual(getCentralRegistrationSignups(payload, options), []);
  }

  signup.attributes.open = true;
  payload.included.find((item) => item.id === "category-central")
      .attributes.name = "central";
  assert.deepEqual(getCentralRegistrationSignups(payload, options), []);
});

test("keeps scheduled registrations hidden before they open", () => {
  const payload = buildPayload();
  payload.data[0].attributes.open = false;
  payload.data[0].attributes.open_at = "2026-07-20T12:00:00Z";
  assert.deepEqual(getCentralRegistrationSignups(payload, {
    now: "2026-07-17T12:00:00Z",
  }), []);
});

test("sorts dated signups before ongoing signups, then by title", () => {
  const payload = buildPayload();
  const dated = payload.data[0];
  const ongoing = ["Zebra", "Alpha"].map((name) => {
    const signup = structuredClone(dated);
    signup.id = name;
    signup.attributes.name = name;
    signup.attributes.close_at = null;
    signup.relationships.next_signup_time.data = null;
    return signup;
  });
  payload.data = [...ongoing, dated];
  assert.deepEqual(getCentralRegistrationSignups(payload, {
    now: "2026-07-17T12:00:00Z",
  }).map((signup) => signup.id), ["signup-1", "Alpha", "Zebra"]);
});

test("rejects archived and unsafe-url signups", () => {
  const payload = buildPayload();
  const centralCategory = {
    categories: {data: [{type: "Category", id: "category-central"}]},
  };

  payload.data = [
    {
      type: "Signup",
      id: "archived",
      attributes: {
        name: "Archived",
        new_registration_url: "https://example.com/archived",
        archived: true,
      },
      relationships: centralCategory,
    },
    {
      type: "Signup",
      id: "unsafe",
      attributes: {
        name: "Unsafe",
        new_registration_url: "javascript:alert(1)",
        open: true,
      },
      relationships: centralCategory,
    },
  ];

  assert.deepEqual(getCentralRegistrationSignups(payload, {
    now: "2026-07-01T12:00:00Z",
  }), []);
});
