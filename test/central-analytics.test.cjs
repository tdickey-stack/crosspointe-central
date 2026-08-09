const assert = require("node:assert/strict");
const test = require("node:test");

const analytics = require("../public/central-analytics.js");

test("analytics event names are restricted to the approved taxonomy", () => {
  assert.equal(
      analytics.sanitizeAnalyticsEventName_("registration_click"),
      "registration_click",
  );
  assert.equal(
      analytics.sanitizeAnalyticsEventName_("user supplied event"),
      "central_ui_action",
  );
});

test("analytics parameters discard unknown and potentially sensitive fields", () => {
  assert.deepEqual(analytics.sanitizeAnalyticsParameters_({
    section_id: "registrations",
    interaction_action: "registration_outbound",
    email: "person@example.com",
    question: "private question",
    notes: "private notes",
  }), {
    section_id: "registrations",
    interaction_action: "registration_outbound",
  });
});

test("analytics link details remove query strings and fragments", () => {
  assert.deepEqual(analytics.getSafeAnalyticsLinkDetails_(
      "https://example.com/register?id=secret#details",
      "https://central.crosspointe.tv/",
  ), {
    link_domain: "example.com",
    link_path: "/register",
  });
});

test("content IDs are stable prefixed slugs instead of numeric-only values", () => {
  assert.equal(
      analytics.slugifyAnalyticsValue_("Group Registration 123"),
      "group_registration_123",
  );
});

test("delegated registration clicks use stable metadata and omit URL queries", () => {
  const section = {
    getAttribute(name) {
      return name === "data-analytics-section" ? "registrations" : "";
    },
    querySelector() {
      return null;
    },
  };
  const attributes = {
    "data-analytics-action": "registration_outbound",
    "data-analytics-content-id": "starting-pointe-3781634",
    "data-analytics-content-label": "Starting Pointe",
    "data-analytics-event": "registration_click",
    href: "https://example.com/register?id=private#step-two",
  };
  const actionElement = {
    textContent: "Register in Church Center",
    closest(selector) {
      if (selector === "[data-analytics-section]") return section;
      if (selector === "article, .card, .sunday-action") return null;
      return this;
    },
    getAttribute(name) {
      return attributes[name] || "";
    },
    hasAttribute(name) {
      return name === "data-analytics-ignore" ? false :
        Object.prototype.hasOwnProperty.call(attributes, name);
    },
  };

  assert.deepEqual(
      analytics.getAnalyticsInteractionFromElement_(
          actionElement,
          "https://central.crosspointe.tv/",
      ),
      {
        eventName: "registration_click",
        parameters: {
          section_id: "registrations",
          interaction_action: "registration_outbound",
          content_type: "registrations",
          content_id: "starting_pointe_3781634",
          content_label: "Starting Pointe",
          link_domain: "example.com",
          link_path: "/register",
        },
      },
  );
});
