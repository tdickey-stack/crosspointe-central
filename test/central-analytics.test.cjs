const assert = require("node:assert/strict");
const test = require("node:test");

const analytics = require("../public/central-analytics.js");

test("analytics event names are restricted to the approved taxonomy", () => {
  assert.equal(
      analytics.sanitizeAnalyticsEventName_("registration_click"),
      "registration_click",
  );
  assert.equal(
      analytics.sanitizeAnalyticsEventName_("notification_action"),
      "notification_action",
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
        eventName: "select_content",
        outcomeEventName: "registration_click",
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

test("ordinary clicks emit select_content without a duplicate outcome", () => {
  const section = {
    getAttribute(name) {
      return name === "data-analytics-section" ? "resources" : "";
    },
    querySelector() {
      return null;
    },
  };
  const actionElement = {
    textContent: "Get the Guide",
    closest(selector) {
      if (selector === "[data-analytics-section]") return section;
      if (selector === "article, .card, .sunday-action") return null;
      return this;
    },
    getAttribute(name) {
      return name === "href" ? "https://example.com/guide" : "";
    },
    hasAttribute() {
      return false;
    },
  };

  const interaction = analytics.getAnalyticsInteractionFromElement_(
      actionElement,
      "https://central.crosspointe.tv/",
  );

  assert.equal(interaction.eventName, "select_content");
  assert.equal(interaction.outcomeEventName, "");
  assert.equal(interaction.parameters.content_label, "Get the Guide");
});

test("the delegated listener records one click plus one specialized outcome", () => {
  const loggedEvents = [];
  let clickHandler = null;
  const documentObject = {
    body: {
      setAttribute() {},
    },
    addEventListener(name, handler) {
      if (name === "click") clickHandler = handler;
    },
  };
  const windowObject = {
    CENTRAL_BOOT_MODE: "public",
    console: {
      info(prefix, eventName, parameters) {
        loggedEvents.push({prefix, eventName, parameters});
      },
    },
    location: {
      hostname: "localhost",
      href: "http://localhost/",
      search: "",
    },
  };
  const section = {
    getAttribute(name) {
      return name === "data-analytics-section" ? "events" : "";
    },
    querySelector() {
      return null;
    },
  };
  const attributes = {
    "data-analytics-event": "calendar_add",
    "data-analytics-action": "add_to_calendar",
    "data-analytics-content-label": "Starting Pointe",
    "data-calendar-provider": "google",
    href: "https://calendar.google.com/calendar/render?private=value",
  };
  const actionElement = {
    textContent: "Google Calendar",
    closest(selector) {
      if (selector === "[data-analytics-section]") return section;
      if (selector === "article, .card, .sunday-action") return null;
      return this;
    },
    getAttribute(name) {
      return attributes[name] || "";
    },
    hasAttribute() {
      return false;
    },
  };

  analytics.createService_(windowObject, documentObject);
  clickHandler({target: actionElement});

  assert.deepEqual(
      loggedEvents.map((entry) => entry.eventName),
      ["select_content", "calendar_add"],
  );
  assert.equal(loggedEvents[0].parameters.content_label, "Starting Pointe");
  assert.equal(loggedEvents[1].parameters.calendar_provider, "google");
});

test("notification outcomes remain separate from raw click totals", () => {
  const loggedEvents = [];
  const documentObject = {
    body: {setAttribute() {}},
    addEventListener() {},
  };
  const windowObject = {
    CENTRAL_BOOT_MODE: "public",
    console: {
      info(prefix, eventName, parameters) {
        loggedEvents.push({prefix, eventName, parameters});
      },
    },
    location: {
      hostname: "localhost",
      href: "http://localhost/",
      search: "",
    },
  };
  const service = analytics.createService_(windowObject, documentObject);

  service.track("notification_action", {
    section_id: "notification_prompt",
    interaction_action: "enable",
    content_type: "push_notifications",
    content_id: "push_subscription",
    content_label: "Enable notifications",
    result: "success",
  });

  assert.deepEqual(
      loggedEvents.map((entry) => entry.eventName),
      ["notification_action"],
  );
  assert.equal(loggedEvents[0].parameters.result, "success");
  assert.equal(loggedEvents[0].parameters.interaction_action, "enable");
});
