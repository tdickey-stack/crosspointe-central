import assert from "node:assert/strict";
import test from "node:test";

import {buildServeNeedPumbleNotificationText} from "./serve-needs.js";

test("builds a bounded Serve Needs direct message", () => {
  const text = buildServeNeedPumbleNotificationText({
    serveNeedNeed: "Production Team",
    serveNeedMinistry: "Worship",
    name: "Taylor Example",
    email: "taylor@example.com",
    phone: "555-0100",
    preferredContactMethod: "text",
    additionalNotes: "Available twice a month.",
  }, "Aug 28, 2026 at 2:30 PM");

  assert.match(text, /New Serve Needs Response/);
  assert.match(text, /Opportunity: Production Team/);
  assert.match(text, /Preferred contact: Text/);
  assert.match(text, /Available twice a month/);
  assert.ok(text.length <= 5000);
});
