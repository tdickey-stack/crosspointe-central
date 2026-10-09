import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";

import {
  applyNavlabAnalyticsAttributes,
  navlabAnalyticsMetadata,
} from "../public/navlab-content.js";

const require = createRequire(import.meta.url);
const centralAnalytics = require("../public/central-analytics.js");

function analyticsNode(initial = {}) {
  const attributes = {...initial};
  return {
    attributes,
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] || ""; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name); },
  };
}

function actionInside(section, initial = {}) {
  const action = analyticsNode(initial);
  action.textContent = initial.textContent || "";
  action.closest = (selector) => {
    if (selector === "[data-analytics-section]") return section;
    if (selector === "article, .card, .sunday-action") return null;
    return action;
  };
  return action;
}

test("Navlab analytics uses the production section taxonomy and public item identity", () => {
  assert.deepEqual(navlabAnalyticsMetadata("registrations", {
    id: "registration-7",
    registration_id: "ignored-by-production-precedence",
    title: "Starting Pointe",
    contact_email: "private@example.test",
  }), {
    sectionId: "registrations",
    contentId: "registration-7",
    contentLabel: "Starting Pointe",
  });
  assert.deepEqual(navlabAnalyticsMetadata("serveNeeds", {
    id: "serve-3", need: "Production Team", contact_email: "private@example.test",
  }), {
    sectionId: "serve_needs",
    contentId: "serve-3",
    contentLabel: "Production Team",
  });
  assert.deepEqual(navlabAnalyticsMetadata("", {
    source: "Planning Center Registrations", registration_id: "form-2", title: "Fall Retreat",
  }), {
    sectionId: "registrations",
    contentId: "form-2",
    contentLabel: "Fall Retreat",
  });
  assert.doesNotMatch(JSON.stringify(navlabAnalyticsMetadata("events", {
    title: "Public title", contact_email: "private@example.test",
  })), /private@example\.test|contact_email/);
});

test("registration metadata produces the existing specialized analytics outcome", () => {
  const section = analyticsNode();
  applyNavlabAnalyticsAttributes(section, navlabAnalyticsMetadata("registrations", {
    id: "registration-7", title: "Starting Pointe",
  }));
  const action = actionInside(section, {
    href: "https://example.com/register?person=private#step-two",
    textContent: "Register",
  });
  applyNavlabAnalyticsAttributes(action, {
    event: "registration_click",
    action: "registration_outbound",
    contentId: "registration-7",
    contentLabel: "Starting Pointe",
  });

  assert.deepEqual(centralAnalytics.getAnalyticsInteractionFromElement_(
      action, "https://central.crosspointe.tv/",
  ), {
    eventName: "select_content",
    outcomeEventName: "registration_click",
    parameters: {
      section_id: "registrations",
      interaction_action: "registration_outbound",
      content_type: "registrations",
      content_id: "registration_7",
      content_label: "Starting Pointe",
      link_domain: "example.com",
      link_path: "/register",
    },
  });
});

test("calendar metadata emits calendar_add with the selected provider", () => {
  const section = analyticsNode();
  applyNavlabAnalyticsAttributes(section, navlabAnalyticsMetadata("events", {
    id: "event-4", title: "Community Night",
  }));
  const action = actionInside(section, {
    href: "https://calendar.google.com/calendar/render?private=value",
    textContent: "Google Calendar",
  });
  applyNavlabAnalyticsAttributes(action, {
    event: "calendar_add",
    action: "add_to_calendar",
    contentId: "event-4",
    contentLabel: "Community Night",
    calendarProvider: "google",
  });

  const interaction = centralAnalytics.getAnalyticsInteractionFromElement_(
      action, "https://central.crosspointe.tv/",
  );
  assert.equal(interaction.outcomeEventName, "calendar_add");
  assert.equal(interaction.parameters.section_id, "events");
  assert.equal(interaction.parameters.interaction_action, "add_to_calendar");
  assert.equal(interaction.parameters.calendar_provider, "google");
  assert.equal(interaction.parameters.content_id, "event_4");
});

test("rendered Navlab surfaces attach analytics sections without changing markup classes", () => {
  const source = readFileSync(new URL("../public/navlab-content.js", import.meta.url), "utf8");
  for (const sectionId of [
    "hero", "sunday_hero", "status_banner", "sunday", "quick_links",
    "watch_live", "sermon_worship", "upcoming_events", "home_highlights",
    "today_at_crosspointe", "next_step", "current_campaigns", "serve_needs", "resources",
  ]) {
    assert.equal(source.includes(`"${sectionId}"`), true, `${sectionId} analytics section is rendered`);
  }
  assert.match(source, /applyNavlabAnalyticsAttributes\(article, navlabAnalyticsMetadata/);
  assert.match(source, /event: "registration_click"/);
  assert.match(source, /event: "calendar_add"/);
});
