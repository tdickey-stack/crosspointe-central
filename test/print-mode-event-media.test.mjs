import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
    new URL("../public/admin.js", import.meta.url),
    "utf8",
);

function loadFunctions(names, globals = {}) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const end = source.indexOf("\n  }", start);
    assert.notEqual(end, -1, `Missing end of function ${name}`);
    vm.runInContext(source.slice(start, end + 4), context);
  }
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyDraft() {
  return {
    serviceDate: "2026-10-04",
    printFormat: "half-letter",
    printColorMode: "color",
    bulletinLayout: "readable",
    layout3: null,
    showCutLine: false,
    heroSource: "featured",
    frontContentSource: "mixed",
    headings: {
      frontHeading: "This Week at\nCrossPointe",
      backEyebrow: "See You There",
      backHeading: "The Next Four Weeks",
    },
    giving: {
      monthlyBudget: 0,
      monthToDateGiving: 0,
      annualBudget: 0,
      yearToDateGiving: 0,
    },
    featuredEvent: {
      id: "",
      title: "",
      description: "",
      includeDescription: true,
      blackAndWhiteImageUrl: "",
      blackAndWhiteImageStoragePath: "",
    },
    fallbackHero: {
      eyebrow: "Welcome",
      title: "We're Glad You're Here",
      description: "Welcome to CrossPointe.",
      imageUrl: "",
      imageStoragePath: "",
    },
    events: [],
    campaignIds: [],
    campaignIcons: {},
    campaignDescriptionOverrides: [],
    serveNeedIds: [],
    serveNeedDescriptionOverrides: [],
    fallbackBlocks: [],
    frontContentOrder: [],
    backContentOrder: [],
    backCustomPlacement: "after-events",
  };
}

function normalizationContext() {
  return loadFunctions([
    "getBulletinEventSourceUrl_",
    "getBulletinEventSourceMetadata_",
    "normalizeBulletinDraft_",
  ], {
    URL,
    PRINT_MODE_MAX_CUSTOM_BLOCKS: 8,
    PRINT_MODE_MAX_CAMPAIGNS: 4,
    PRINT_MODE_MAX_SERVE_NEEDS: 4,
    createEmptyBulletinDraft_: emptyDraft,
    createDefaultBulletinFallbackBlocks_: () => [],
    getDefaultSundayDateInputValue_: () => "2026-10-04",
    normalizeSundayDateInputValue_: (value) => String(value || ""),
    normalizeBulletinLayout3_: (value) => value || null,
    normalizeBulletinHeadingText_: (value, fallback) =>
      String(value || fallback),
    normalizeBulletinBackHeading_: (value) =>
      String(value || "The Next Four Weeks"),
    normalizeBulletinMoney_: (value) => Number(value) || 0,
    getBulletinFallbackImageUrl_: (value) => String(value || ""),
    normalizeBulletinBlockSize_: (value) => Number(value) === 2 ? 2 : 1,
    normalizeBulletinFrontContentOrder_: () => [],
    normalizeBulletinBackContentOrder_: () => [],
    getBulletinItemId_: (item) => String(item && item.id || ""),
    getBulletinSourceEvents_: (data) => data.events || [],
    parseBulletinDate_: (value) => new Date(`${value}T00:00:00.000Z`),
    normalizeBulletinCampaignIconId_: () => "default",
    getSuggestedBulletinCampaignIconId_: () => "default",
    getBulletinActiveSelectionIds_: () => [],
    normalizeBulletinDescriptionOverrides_: () => [],
  });
}

function saveContext(event) {
  const draft = emptyDraft();
  draft.events = [event];
  const adminState = {
    bulletinDraft: draft,
    bulletinCentralData: {campaigns: [], serveNeeds: []},
  };
  return loadFunctions(["buildBulletinModePayload_"], {
    adminState,
    PRINT_MODE_MAX_CUSTOM_BLOCKS: 8,
    PRINT_MODE_MAX_CAMPAIGNS: 4,
    PRINT_MODE_MAX_SERVE_NEEDS: 4,
    getBulletinActiveSelectionIds_: () => [],
    normalizeSundayDateInputValue_: (value) => value,
    getBulletinLayout_: () => "readable",
    getBulletinLayout3ForSave_: () => null,
    normalizeBulletinHeadingText_: (value) => value,
    normalizeBulletinBackHeading_: (value) => value,
    normalizeBulletinMoney_: (value) => value,
    getBulletinFallbackImageUrl_: (value) => value,
    normalizeBulletinBlockSize_: (value) => value,
    normalizeBulletinFrontContentOrder_: () => [],
    normalizeBulletinBackContentOrder_: () => [],
    getBulletinEventDraftsInWindow_: () => draft.events,
    normalizeBulletinCampaignIconId_: (value) => value,
    normalizeBulletinDescriptionOverrides_: () => [],
  });
}

function renderContext(frontHero = null) {
  const qrCalls = [];
  const hero = frontHero || {
    source: "manual",
    eyebrow: "Welcome",
    title: "Welcome to CrossPointe",
    description: "",
    includeDescription: false,
    image_url: "",
  };
  const context = loadFunctions([
    "escapeHtml_",
    "escapeAttr_",
    "getBulletinEventSourceUrl_",
    "renderBulletinLayout3EventMedia_",
    "renderBulletinLayout3Meta_",
    "renderBulletinLayout3Card_",
    "renderBulletinLayout3_",
  ], {
    URL,
    adminState: {
      bulletinDraft: {
        serviceDate: "2026-10-04",
        headings: {frontHeading: "This Week at CrossPointe"},
        giving: {},
      },
    },
    window: {
      PrintModeQr: {
        renderSvg(value) {
          qrCalls.push(value);
          return '<svg data-test-qr="true" viewBox="0 0 29 29"></svg>';
        },
      },
    },
    getBulletinFallbackImageUrl_: (value) => String(value || ""),
    getBulletinFeaturedPrintImageUrl_: (item) => String(item.image_url || ""),
    getBulletinFrontHero_: () => hero,
    getBulletinLayout3Entries_: () => [],
    formatBulletinLongDate_: (value) => String(value || ""),
    renderAdminMarkdownLite_: (value) => `<p>${String(value || "")}</p>`,
    renderBulletinGivingStat_: () => "",
    getBulletinGivingPeriodLabel_: () => "Month-to-date Giving",
  });
  return {context, qrCalls};
}

test("event source URLs accept only canonical credential-free HTTPS URLs", () => {
  const context = normalizationContext();
  const input = "  HTTPS://Ex\u00e4mple.org:443/a path/?name=Jos\u00e9#details  ";
  assert.equal(context.getBulletinEventSourceUrl_(input), new URL(input.trim()).href);

  for (const value of [
    "",
    "not a url",
    "/events/123",
    "http://crosspointe.tv/events/123",
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://editor:secret@crosspointe.tv/events/123",
    "https://editor@crosspointe.tv/events/123",
  ]) {
    assert.equal(context.getBulletinEventSourceUrl_(value), "", value);
  }
});

test("source metadata is trimmed, URL-safe, and limited to live fields", () => {
  const context = normalizationContext();
  const metadata = plain(context.getBulletinEventSourceMetadata_({
    id: "instance-1",
    title: "Fall Festival",
    planning_center_event_id: " 930568 ",
    image_url: " https://images.example.org/fall festival.jpg ",
    registration_url: " https://crosspointe.tv/register?event=fall ",
    registration_button_text: "  Register Your Booth  ",
    description: "This does not belong in source metadata.",
  }));

  assert.deepEqual(metadata, {
    planning_center_event_id: "930568",
    image_url: "https://images.example.org/fall%20festival.jpg",
    registration_url: "https://crosspointe.tv/register?event=fall",
    registration_button_text: "Register Your Booth",
  });

  assert.deepEqual(plain(context.getBulletinEventSourceMetadata_({
    planning_center_event_id: "  ",
    image_url: "http://images.example.org/fall.jpg",
    registration_url: "https://editor:secret@example.org/form",
    registration_button_text: "  Join Us  ",
  })), {
    planning_center_event_id: "",
    image_url: "",
    registration_url: "",
    registration_button_text: "Join Us",
  });
});

test("draft normalization preserves editorial event copy but refreshes live metadata", () => {
  const context = normalizationContext();
  const saved = emptyDraft();
  saved.events = [{
    id: "instance-1",
    title: "Staff title",
    description: "Staff description",
    location: "Staff room",
    included: false,
    includeDescription: false,
    planning_center_event_id: "stale-series",
    image_url: "https://stale.example.org/image.jpg",
    registration_url: "https://stale.example.org/form",
    registration_button_text: "Stale action",
  }];
  const current = {
    id: "instance-1",
    title: "Planning Center title",
    description: "Planning Center description",
    location: "Planning Center room",
    date: "2026-10-10",
    time: "6:00 PM",
    planning_center_event_id: " current-series ",
    image_url: " https://images.example.org/current.jpg ",
    registration_url: " https://crosspointe.tv/current-form ",
    registration_button_text: " Current action ",
  };

  const first = plain(context.normalizeBulletinDraft_(saved, {
    events: [current],
    campaigns: [],
    serveNeeds: [],
  })).events[0];
  assert.deepEqual(first, {
    id: "instance-1",
    title: "Staff title",
    description: "Staff description",
    included: false,
    includeDescription: false,
    date: "2026-10-10",
    time: "6:00 PM",
    doors_open_time: "",
    location: "Staff room",
    sourceLocation: "Planning Center room",
    planning_center_event_id: "current-series",
    image_url: "https://images.example.org/current.jpg",
    registration_url: "https://crosspointe.tv/current-form",
    registration_button_text: "Current action",
  });

  const refreshedSaved = {
    ...emptyDraft(),
    events: [first],
  };
  const refreshed = plain(context.normalizeBulletinDraft_(refreshedSaved, {
    events: [{
      ...current,
      planning_center_event_id: "current-series",
      image_url: "",
      registration_url: "",
      registration_button_text: "",
    }],
    campaigns: [],
    serveNeeds: [],
  })).events[0];
  assert.equal(refreshed.title, "Staff title");
  assert.equal(refreshed.description, "Staff description");
  assert.equal(refreshed.location, "Staff room");
  assert.equal(refreshed.included, false);
  assert.equal(refreshed.includeDescription, false);
  assert.equal(refreshed.planning_center_event_id, "current-series");
  assert.equal(refreshed.image_url, "");
  assert.equal(refreshed.registration_url, "");
  assert.equal(refreshed.registration_button_text, "");
});

test("saving persists editorial event fields and strips source metadata", () => {
  const event = {
    id: "instance-1",
    title: "  Staff title  ",
    description: "  Staff description  ",
    location: "  Staff room  ",
    included: false,
    includeDescription: false,
    planning_center_event_id: "930568",
    image_url: "https://images.example.org/current.jpg",
    registration_url: "https://crosspointe.tv/current-form",
    registration_button_text: "Register now",
  };
  const context = saveContext(event);
  assert.deepEqual(plain(context.buildBulletinModePayload_().events), [{
    id: "instance-1",
    title: "Staff title",
    description: "Staff description",
    location: "Staff room",
    included: false,
    includeDescription: false,
  }]);
});

test("Layout 3 event cards render an image rail, QR, and complete escaped caption", () => {
  const {context, qrCalls} = renderContext();
  const item = {
    id: "instance-1",
    title: "Fall Festival",
    date: "2026-10-10",
    time: "6:00 PM",
    image_url: "https://images.example.org/fall.jpg?size=large&crop=wide",
    registration_url: "https://crosspointe.tv/register?event=fall",
    registration_button_text: "Register <Your> Booth & Bring Friends",
  };
  const html = context.renderBulletinLayout3Card_({
    key: "event:instance-1",
    type: "event",
    size: 1,
    item,
  });

  assert.deepEqual(qrCalls, ["https://crosspointe.tv/register?event=fall"]);
  assert.match(html, /class="b3-event-media/);
  assert.match(html, /src="https:\/\/images\.example\.org\/fall\.jpg\?size=large&amp;crop=wide"/);
  assert.match(html, /data-test-qr="true"/);
  assert.match(html, /Register &lt;Your&gt; Booth &amp; Bring Friends/);
  assert.doesNotMatch(html, /Register <Your>/);
});

test("Layout 3 featured hero uses the same event media and registration QR", () => {
  const {context, qrCalls} = renderContext({
    source: "featured",
    id: "featured-1",
    planning_center_event_id: "930568",
    eyebrow: "Featured Event",
    title: "Fall Festival",
    description: "",
    includeDescription: false,
    image_url: "https://images.example.org/featured.jpg",
    registration_url: "https://crosspointe.tv/featured-form",
    registration_button_text: "Reserve Your Place",
  });
  const html = context.renderBulletinLayout3_("front");

  assert.deepEqual(qrCalls, ["https://crosspointe.tv/featured-form"]);
  assert.match(html, /class="b3-hero"/);
  assert.match(html, /class="b3-event-media/);
  assert.match(html, /Reserve Your Place/);
});

test("Layout 3 event media omits registration UI without a safe destination", () => {
  const {context, qrCalls} = renderContext();
  const noLink = context.renderBulletinLayout3EventMedia_({
    image_url: "https://images.example.org/fall.jpg",
    registration_button_text: "Register now",
    registration_url: "",
  }, "https://images.example.org/fall.jpg");
  const noLabel = context.renderBulletinLayout3EventMedia_({
    image_url: "",
    registration_button_text: "",
    registration_url: "https://crosspointe.tv/register",
  }, "");

  assert.deepEqual(qrCalls, ["https://crosspointe.tv/register"]);
  assert.doesNotMatch(noLink, /data-test-qr/);
  assert.doesNotMatch(noLink, /Register now/);
  assert.match(noLabel, /data-test-qr/);
  assert.match(noLabel, />Register<\/span>/);
  assert.match(noLabel, /class="b3-event-media/);
});

test("event image load and failure paths update fallback state and refit", () => {
  let fitCalls = 0;
  const context = loadFunctions(["syncBulletinEventImages_"], {
    syncBulletinFrontFit_: () => {
      fitCalls += 1;
    },
  });
  const loadedClasses = [];
  const loadedListeners = {};
  const failedListeners = {};
  let removed = false;
  const loaded = {
    complete: false,
    parentElement: {classList: {add: (value) => loadedClasses.push(value)}},
    addEventListener(type, listener, options) {
      loadedListeners[type] = {listener, options};
    },
    remove() {
      throw new Error("loaded image should remain");
    },
  };
  const failed = {
    complete: false,
    parentElement: {classList: {add() {}}},
    addEventListener(type, listener, options) {
      failedListeners[type] = {listener, options};
    },
    remove() {
      removed = true;
    },
  };

  context.syncBulletinEventImages_({
    querySelectorAll(selector) {
      assert.equal(selector, "[data-bulletin-event-image]");
      return [loaded, failed];
    },
  });
  assert.equal(loadedListeners.load.options.once, true);
  assert.equal(failedListeners.error.options.once, true);

  loadedListeners.load.listener();
  failedListeners.error.listener();
  assert.deepEqual(loadedClasses, ["is-loaded"]);
  assert.equal(removed, true);
  assert.equal(fitCalls, 2);
});

test("Layout 3 custom cards keep their existing image branch", () => {
  const {context, qrCalls} = renderContext();
  const html = context.renderBulletinLayout3Card_({
    key: "custom:welcome",
    type: "custom",
    size: 1,
    item: {
      id: "welcome",
      title: "Welcome",
      imageUrl: "https://storage.example.org/welcome.jpg",
      imageSide: "left",
    },
  });

  assert.deepEqual(qrCalls, []);
  assert.match(html, /class="b3-card-image"/);
  assert.doesNotMatch(html, /class="b3-event-media/);
});
