import assert from "node:assert/strict";
import test from "node:test";

import {getCentralRegistrationSignups} from "./registrations.js";

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
          name: "Falls Creek",
          full_formatted_address: "Davis, Oklahoma",
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
  });

  assert.equal(signups.length, 1);
  assert.equal(signups[0].id, "signup-1");
  assert.equal(signups[0].title, "Student Camp");
  assert.equal(signups[0].description, "Join us for camp.");
  assert.equal(signups[0].location, "Falls Creek");
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

test("rejects closed, archived, and unsafe-url signups", () => {
  const payload = buildPayload();
  const centralCategory = {
    categories: {data: [{type: "Category", id: "category-central"}]},
  };

  payload.data = [
    {
      type: "Signup",
      id: "closed",
      attributes: {
        name: "Closed",
        new_registration_url: "https://example.com/closed",
        closed: true,
      },
      relationships: centralCategory,
    },
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

  assert.deepEqual(getCentralRegistrationSignups(payload), []);
});
