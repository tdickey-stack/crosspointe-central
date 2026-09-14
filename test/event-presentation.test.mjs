import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
function loadFunctions(names, extras = {}) {
  const context = vm.createContext({URL, ...extras});
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf("\nfunction ", start + 1);
    vm.runInContext(source.slice(start, end < 0 ? source.length : end), context);
  }
  return context;
}
const helpers = ["escapeHtml", "escapeAttr", "escapeJsString", "analyticsAttrs_", "buildLinkAttrs_", "button", "getEventAnalyticsContentId_", "getSafeEventRegistrationUrl_", "renderFeaturedEventActions_", "registerEventDetailsItem_", "getEventModalRecurrence_", "renderEventDescription_"];
const context = loadFunctions(helpers, {eventDetailKeyCounter: 0, eventDetailItemsByKey: {}});

test("informational featured events retain one primary View Event action", () => {
  const html = context.renderFeaturedEventActions_({item: {title: "Event"}, title: "Event", eventKey: "detail:1"});
  assert.match(html, /btn-primary/);
  assert.match(html, />View Event<\/button>/);
  assert.doesNotMatch(html, /<a /);
});

test("featured CTA escapes its custom label and keeps the details action secondary", () => {
  const html = context.renderFeaturedEventActions_({item: {id: "123", registration_url: "https://example.com/form?a=1&b=2", registration_button_text: "Register <Booth>"}, title: "Event", eventKey: "detail:1"});
  assert.match(html, /Register &lt;Booth&gt;/);
  assert.match(html, /data-analytics-action="registration_outbound"/);
  assert.match(html, /<button type="button" class="btn featured-event-cta"/);
  assert.match(html, /href="https:\/\/example.com\/form\?a=1&amp;b=2"/);
});

test("unsafe, incomplete, and credential-bearing CTA destinations are omitted", () => {
  for (const url of ["javascript:alert(1)", "https://", "https://user:password@example.com", "/relative"]) {
    assert.equal(context.getSafeEventRegistrationUrl_(url), "");
    const html = context.renderFeaturedEventActions_({item: {registration_url: url}, title: "Event", eventKey: "detail:1"});
    assert.doesNotMatch(html, /<a /);
  }
});

test("event modal registration preserves formatted copy and custom CTA", () => {
  const key = context.registerEventDetailsItem_({description: "Welcome", description_html: "<p><strong>Welcome</strong></p>", registration_url: "https://example.com", registration_button_text: "Host a Booth", featured: "TRUE"});
  const item = context.eventDetailItemsByKey[key];
  assert.equal(item.descriptionHtml, "<p><strong>Welcome</strong></p>");
  assert.equal(item.registrationButtonText, "Host a Booth");
  assert.equal(item.featured, true);
});

test("plain-text overrides remain escaped and missing descriptions retain fallback", () => {
  assert.equal(context.renderEventDescription_({description: "<script>alert(1)</script>"}), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.match(context.renderEventDescription_({}), /More details will be posted/);
});


test("button marker warnings appear only for event editors", () => {
  const item = {id: "123", title: "Event", cta_warning: "Missing <link>"};
  for (const permission of ["none", "view", "edit", "propose"]) {
    const editor = loadFunctions(["escapeHtml", "escapeAttr", "escapeJsString", "renderEventEditButton_"], {centralEventEditPermission: permission});
    const html = editor.renderEventEditButton_(item);
    if (["edit", "propose"].includes(permission)) assert.match(html, /Missing &lt;link&gt;/);
    else assert.doesNotMatch(html, /Missing/);
  }
});
