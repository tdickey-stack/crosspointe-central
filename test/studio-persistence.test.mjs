import assert from "node:assert/strict";
import test from "node:test";

import {
  focalMediaStyle,
  imageRotationCoverScale,
  normalizeImageOpacity,
  normalizeImageRotation,
} from "../src/studio/focal.js";
import {
  createStudioCloud,
  projectForCloud,
  socialSlideForCloud,
} from "../src/studio/persistence.js";
import {
  planningCenterEventContentChanges,
  planningCenterEventsFromCentralData,
} from "../src/studio/planning-center-events.js";
import {
  EVENT_PALETTE_OPTIONS,
  GRAPHIC_BRAND_COLOR_OPTIONS,
  GRAPHIC_BRAND_MARK_OPTIONS,
  GRAPHIC_FONT_WEIGHT_OPTIONS,
  TEMPLATE_CATALOG,
  createSocialCarouselSlide,
  createStudioProject,
  getEventCompositionOptions,
  getEventFontOptions,
  getEventPalette,
  getTemplateById,
  getProjectWarnings,
  getSocialProjectSlides,
  isGraphicTemplateId,
  isSocialTemplateId,
  migrateLegacyStudioProject,
  supportsHeroLogoTemplate,
} from "../src/studio/templates.js";

test("Small Group Leader is a 16:9 document graphic with background support", () => {
  const template = TEMPLATE_CATALOG.find(
    (item) => item.id === "document-small-group-leader",
  );
  const project = createStudioProject(template.id);

  assert.equal(template.kind, "document");
  assert.equal(template.editorKind, "graphic");
  assert.deepEqual(template.formats, ["16:9"]);
  assert.equal(isGraphicTemplateId(template.id), true);
  assert.equal(project.projectKind, "graphic");
  assert.equal(project.content.format, "screen");
  assert.equal(project.content.composition, "groups-gradient");
  assert.equal(project.content.brandMark, "central");
  assert.equal(project.content.cta, "FIND YOUR PLACE");
  assert.deepEqual(getProjectWarnings(project), []);

  const payload = projectForCloud(project, "studio-admin");
  assert.equal(payload.templateId, template.id);
  assert.equal(payload.sourceType, "manual");
  assert.equal(payload.content.format, "screen");
  assert.equal(payload.content.heroMode, "text");
});

test("event templates share title fitting and custom hero logos", () => {
  const eventTemplates = TEMPLATE_CATALOG.filter(
    (template) => template.kind === "event",
  );
  assert.deepEqual(
    eventTemplates.map((template) => template.id),
    [
      "event-signal-stack",
      "event-rally-poster",
      "event-future-block",
      "event-center-stage",
      "event-timeless-center",
      "event-editorial-invitation",
      "event-scripted-welcome",
    ],
  );

  eventTemplates.forEach((template) => {
    const project = createStudioProject(template.id);
    project.id = `${template.id}-hero-project`;
    Object.assign(project.content, {
      heroMode: "logo",
      heroLogoSource: "upload",
      heroLogoStoragePath:
        `studio-projects/${project.id}/logo-event.png`,
      heroLogoName: "Event logo",
    });
    const payload = projectForCloud(project, "studio-admin");

    assert.equal(template.titleFitLines, 2, template.id);
    assert.equal(template.titleFitMinScale, 0.56, template.id);
    assert.equal(supportsHeroLogoTemplate(template.id), true, template.id);
    assert.equal(payload.content.heroMode, "logo", template.id);
    assert.equal(payload.content.heroLogoSource, "upload", template.id);
    assert.equal(
      payload.content.heroLogoStoragePath,
      project.content.heroLogoStoragePath,
      template.id,
    );
  });

  assert.equal(getTemplateById("event-promotion").titleFitLines, 2);
  assert.equal(supportsHeroLogoTemplate("event-promotion"), true);
  assert.equal(
    createStudioProject("event-future-block").content.fontKey,
    "unbounded",
  );
});

function eventProject() {
  return {
    ...createStudioProject("event-signal-stack"),
    id: "legacy-browser-project",
    name: "Legacy Browser Project",
  };
}

test("new cloud projects create without reading a missing document first", async () => {
  const calls = [];
  const reference = {
    get: async () => {
      calls.push("get");
      throw new Error("A missing project read should not run.");
    },
    set: async () => {
      calls.push("set");
    },
  };
  const previousWindow = globalThis.window;
  globalThis.window = {
    firebase: {
      firestore: {
        FieldValue: {serverTimestamp: () => "server-timestamp"},
      },
    },
  };

  try {
    const cloud = createStudioCloud({
      auth: {},
      firestore: {doc: () => reference},
      storage: {},
      user: {uid: "studio-admin"},
    });
    const saved = await cloud.saveProject(
      createStudioProject("event-timeless-center"),
    );

    assert.deepEqual(calls, ["set"]);
    assert.equal(saved.cloudBacked, true);
    assert.equal(saved.ownerUid, "studio-admin");
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("Social Posts expose focused templates and mobile-first formats", () => {
  const socialTemplates = TEMPLATE_CATALOG.filter(
    (template) => template.kind === "social",
  );

  assert.deepEqual(
    socialTemplates.map((template) => template.id),
    [
      "social-scripture",
      "social-quote",
      "social-statement",
      "social-simple-statement",
    ],
  );
  socialTemplates.forEach((template) => {
    assert.deepEqual(template.formats, ["1:1", "4:5"]);
    assert.equal(isSocialTemplateId(template.id), true);
    assert.ok(getEventFontOptions(template.id).length >= 3);
    assert.ok(getEventCompositionOptions(template.id).length >= 1);
  });
});

test("Simple Statement keeps its ID, auto contrast, and background support", () => {
  const bold = TEMPLATE_CATALOG.find((template) => template.id === "social-statement");
  const simple = TEMPLATE_CATALOG.find(
    (template) => template.id === "social-simple-statement",
  );
  const project = createStudioProject(simple.id);

  assert.equal(bold.name, "Bold Statement");
  assert.equal(simple.name, "Simple Statement");
  assert.deepEqual(
    simple.fonts.map((font) => font.value),
    ["montserrat", "league-spartan", "google-sans"],
  );
  assert.deepEqual(simple.compositions.map((item) => item.value), ["flat"]);
  assert.equal(project.content.flatColor, "cream");
  assert.equal(project.content.textAlignment, "center");
  assert.equal(project.content.brandMark, "full");
  assert.equal(project.content.brandColor, "auto");
  assert.equal(project.postMode, "single");
  assert.deepEqual(project.carouselSlides, []);
  assert.equal(supportsHeroLogoTemplate(simple.id), true);
  assert.equal(supportsHeroLogoTemplate(bold.id), false);
  assert.deepEqual(getProjectWarnings(project), []);

  project.id = "simple-background-project";
  project.content.backgroundImageSource = "upload";
  project.content.backgroundImageStoragePath =
    "studio-projects/simple-background-project/background.png";
  const backgroundSlide = socialSlideForCloud(
    {content: project.content},
    project.templateId,
    project.id,
  );
  assert.equal(backgroundSlide.content.backgroundImageSource, "upload");
  assert.equal(
    backgroundSlide.content.backgroundImageStoragePath,
    "studio-projects/simple-background-project/background.png",
  );
});

test("Simple Statement keeps valid hero logos while other Social Posts strip them", () => {
  const simple = createStudioProject("social-simple-statement");
  simple.id = "simple-logo-project";
  Object.assign(simple.content, {
    heroMode: "logo",
    heroLogoSource: "upload",
    heroLogoStoragePath: "studio-projects/simple-logo-project/logo-mark.png",
    heroLogoName: "Campaign mark",
  });
  const simplePayload = projectForCloud(simple, "studio-admin");
  const simpleSlide = socialSlideForCloud(
    {content: simple.content},
    simple.templateId,
    simple.id,
  );
  assert.equal(simplePayload.content, undefined);
  assert.equal(simpleSlide.content.heroMode, "logo");
  assert.equal(simpleSlide.content.heroLogoSource, "upload");

  const bold = createStudioProject("social-statement");
  bold.id = "bold-logo-project";
  Object.assign(bold.content, {
    heroMode: "logo",
    heroLogoSource: "upload",
    heroLogoStoragePath: "studio-projects/bold-logo-project/logo-mark.png",
    heroLogoName: "Campaign mark",
  });
  const boldPayload = projectForCloud(bold, "studio-admin");
  const boldSlide = socialSlideForCloud(
    {content: bold.content},
    bold.templateId,
    bold.id,
  );
  assert.equal(boldPayload.content, undefined);
  assert.equal(boldSlide.content.heroMode, "text");
  assert.equal(boldSlide.content.heroLogoSource, "");
});

test("Social carousel projects preserve six ordered slides in one cloud project", () => {
  const project = createStudioProject("social-simple-statement");
  project.id = "carousel-project";
  project.postMode = "carousel";
  project.carouselSlides = Array.from({length: 7}, (_, index) =>
    createSocialCarouselSlide(
      {...project.content, title: `Slide ${index + 2}`},
      `slide-${index + 2}`,
    ),
  );

  const migrated = migrateLegacyStudioProject(project);
  assert.equal(getSocialProjectSlides(migrated).length, 6);
  const payload = projectForCloud(migrated, "studio-admin");
  assert.equal(payload.postMode, "carousel");
  assert.deepEqual(
    payload.slideOrder,
    ["primary", "slide-2", "slide-3", "slide-4", "slide-5", "slide-6"],
  );
  assert.deepEqual(
    getSocialProjectSlides(migrated).slice(1).map((slide) => slide.content.title),
    ["Slide 2", "Slide 3", "Slide 4", "Slide 5", "Slide 6"],
  );
});

test("Social Posts use simple copy defaults and sanitize event-only data", () => {
  const project = createStudioProject("social-scripture");

  assert.equal(project.sourceType, "manual");
  assert.equal(project.content.date, "");
  assert.equal(project.content.time, "");
  assert.equal(project.content.location, "");
  assert.equal(project.content.heroMode, "text");
  assert.deepEqual(getProjectWarnings(project), []);

  project.sourceType = "planning-center";
  project.sourceId = "100";
  project.sourceEventId = "10";
  project.content.format = "screen";
  project.content.date = "SEPTEMBER 18";
  project.content.heroMode = "logo";
  project.content.heroLogoSource = "upload";
  project.content.heroLogoStoragePath =
    `studio-projects/${project.id}/logo.png`;
  project.content.heroLogoName = "Event logo";

  const payload = projectForCloud(project, "studio-admin");
  const slidePayload = socialSlideForCloud(
    {content: project.content},
    project.templateId,
    project.id,
  );
  assert.equal(payload.sourceType, "manual");
  assert.equal(slidePayload.content.format, "square");
  assert.equal(slidePayload.content.date, "");
  assert.equal(slidePayload.content.heroMode, "text");
  assert.equal(slidePayload.content.heroLogoSource, "");
  assert.equal(slidePayload.content.heroLogoStoragePath, "");
  assert.equal(slidePayload.content.heroLogoName, "");
});

test("graphics expose official brand marks, logo colors, and global font weights", () => {
  const project = createStudioProject("social-quote");

  assert.deepEqual(
    GRAPHIC_BRAND_MARK_OPTIONS.map((option) => option.value),
    ["central", "heart", "full"],
  );
  assert.deepEqual(
    GRAPHIC_BRAND_COLOR_OPTIONS.map((option) => option.value),
    ["auto", "white", "charcoal", "red"],
  );
  assert.deepEqual(
    GRAPHIC_FONT_WEIGHT_OPTIONS.map((option) => option.value),
    ["template", "thin", "light", "medium", "bold", "black"],
  );
  assert.equal(project.content.brandMark, "central");
  assert.equal(project.content.brandColor, "auto");
  assert.equal(project.content.fontWeight, "template");
  assert.equal(project.content.eyebrowVisible, true);
  assert.equal(project.content.subtitleVisible, true);

  project.content.brandMark = "heart";
  project.content.brandColor = "red";
  project.content.fontWeight = "black";
  const payload = socialSlideForCloud(
    {content: project.content},
    project.templateId,
    project.id,
  );
  assert.equal(payload.content.brandMark, "heart");
  assert.equal(payload.content.brandColor, "red");
  assert.equal(payload.content.fontWeight, "black");

  project.content.brandMark = "unknown";
  project.content.brandColor = "unknown";
  project.content.fontWeight = "unknown";
  const normalized = socialSlideForCloud(
    {content: project.content},
    project.templateId,
    project.id,
  );
  assert.equal(normalized.content.brandMark, "central");
  assert.equal(normalized.content.brandColor, "auto");
  assert.equal(normalized.content.fontWeight, "template");
});

test("graphic eyebrow and subtitle visibility survive migration and cloud saves", () => {
  const event = createStudioProject("event-signal-stack");
  event.content.eyebrowVisible = false;
  event.content.subtitleVisible = false;
  const eventPayload = projectForCloud(event, "studio-admin");
  assert.equal(eventPayload.content.optionalTextVisibility, "none");

  const social = createStudioProject("social-simple-statement");
  social.content.eyebrow = "Saved context";
  social.content.subtitle = "Saved supporting line";
  social.content.eyebrowVisible = false;
  social.content.subtitleVisible = false;
  const slidePayload = socialSlideForCloud(
    {content: social.content},
    social.templateId,
    social.id,
  );
  assert.equal(slidePayload.content.eyebrow, "Saved context");
  assert.equal(slidePayload.content.subtitle, "Saved supporting line");
  assert.equal(slidePayload.content.optionalTextVisibility, "none");

  const migratedLegacy = migrateLegacyStudioProject({
    ...event,
    content: {
      ...event.content,
      eyebrowVisible: undefined,
      subtitleVisible: undefined,
    },
  });
  assert.equal(migratedLegacy.content.eyebrowVisible, true);
  assert.equal(migratedLegacy.content.subtitleVisible, true);

  const migratedCloud = migrateLegacyStudioProject({
    ...event,
    content: {
      ...event.content,
      eyebrowVisible: undefined,
      subtitleVisible: undefined,
      optionalTextVisibility: "subtitle",
    },
  });
  assert.equal(migratedCloud.content.eyebrowVisible, false);
  assert.equal(migratedCloud.content.subtitleVisible, true);
});

test("event palette catalog exposes distinct light options with dark copy", () => {
  const lightPalettes = EVENT_PALETTE_OPTIONS.filter(
    (palette) => palette.ink === "dark",
  );

  assert.deepEqual(
    lightPalettes.map((palette) => palette.value),
    ["warm-light", "paper-red", "sky-mint", "blush-burgundy"],
  );
  assert.equal(
    new Set(EVENT_PALETTE_OPTIONS.map((palette) => palette.value)).size,
    EVENT_PALETTE_OPTIONS.length,
  );
  assert.equal(getEventPalette("sky-mint").label, "Sky + Mint Light");
  assert.equal(getEventPalette("not-a-palette").value, "charcoal-red");
});

test("Central data maps to a deduplicated Planning Center event catalog", () => {
  const payload = {
    today: [
      {
        id: "100",
        planning_center_instance_id: "100",
        planning_center_event_id: "10",
        title: "Community Night",
        date: "Jul 30, 2026",
        time: "6:30 PM - 8:00 PM",
        starts_at: "2026-07-30T23:30:00.000Z",
        location: "CrossPointe Church",
        description: "<p>Come connect with us.</p>",
        church_center_url:
          "https://crosspointetv.churchcenter.com/calendar/event/100",
      },
    ],
    events: [
      {
        id: "100",
        planning_center_instance_id: "100",
        planning_center_event_id: "10",
        title: "Duplicate occurrence",
        starts_at: "2026-07-30T23:30:00.000Z",
      },
      {
        id: "200",
        planning_center_instance_id: "200",
        planning_center_event_id: "20",
        title: "Serve Day",
        date: "Aug 2, 2026",
        time: "9:00 AM",
        starts_at: "2026-08-02T14:00:00.000Z",
        registration_url:
          "https://crosspointetv.churchcenter.com/registrations/events/20",
      },
      {id: "invalid", title: "Missing start"},
    ],
  };

  const events = planningCenterEventsFromCentralData(payload);

  assert.deepEqual(events.map((event) => event.id), ["100", "200"]);
  assert.equal(events[0].description, "Come connect with us.");
  assert.match(events[0].publicUrl, /churchcenter[.]com/);
  assert.match(events[1].registrationUrl, /registrations/);
});

test("Planning Center event facts fit the deterministic event fields", () => {
  const changes = planningCenterEventContentChanges(
    {
      title: "A very long event title that needs a responsible word boundary",
      description:
        "This is a current public Planning Center description that gives the graphic a useful supporting line without changing its layout.",
      date: "Aug 2, 2026",
      time: "9:00 AM - 11:00 AM",
      location: "CrossPointe Church - Main Auditorium",
      registrationUrl:
        "https://crosspointetv.churchcenter.com/registrations/events/20",
    },
    {subtitle: "Existing subtitle", cta: "EXISTING CTA"},
  );

  assert.ok(changes.title.length <= 52);
  assert.ok(changes.subtitle.length <= 110);
  assert.ok(changes.location.length <= 34);
  assert.equal(changes.date, "AUG 2, 2026");
  assert.equal(changes.cta, "REGISTER IN CHURCH CENTER");
});

test("linked Planning Center project preserves sanitized source identity", () => {
  const project = eventProject();
  project.sourceType = "planning-center";
  project.sourceId = "100";
  project.sourceEventId = "10";
  project.sourceUrl =
    "https://crosspointetv.churchcenter.com/calendar/event/100";
  project.sourceUpdatedAt = "2026-07-30T15:00:00.000Z";

  const payload = projectForCloud(project, "studio-admin");

  assert.equal(payload.sourceType, "planning-center");
  assert.equal(payload.sourceId, "100");
  assert.equal(payload.sourceEventId, "10");
  assert.match(payload.sourceUrl, /^https:/);
  assert.ok(payload.sourceUpdatedAt instanceof Date);
});

test("event background image opacity is normalized for cloud persistence", () => {
  const project = eventProject();
  project.content.backgroundImageOpacity = 0.42;
  assert.equal(
    projectForCloud(project, "studio-admin").content.backgroundImageOpacity,
    0.42,
  );

  delete project.content.backgroundImageOpacity;
  assert.equal(
    projectForCloud(project, "studio-admin").content.backgroundImageOpacity,
    1,
  );

  project.content.backgroundImageOpacity = 8;
  assert.equal(
    projectForCloud(project, "studio-admin").content.backgroundImageOpacity,
    1,
  );
});

test("event background image opacity reaches the rendered export layer", () => {
  assert.equal(normalizeImageOpacity(-1), 0);
  assert.equal(normalizeImageOpacity(0.45), 0.45);
  assert.equal(normalizeImageOpacity(4), 1);
  assert.equal(normalizeImageOpacity(undefined), 1);
  assert.equal(
    focalMediaStyle({
      backgroundImage: "https://example.com/background.jpg",
      backgroundImageOpacity: 0.45,
    }).opacity,
    0.45,
  );
});

test("event background rotation is saved and covers every output ratio", () => {
  const project = eventProject();
  project.content.backgroundImageRotation = 225.4;
  assert.equal(
    projectForCloud(project, "studio-admin").content.backgroundImageRotation,
    225,
  );

  delete project.content.backgroundImageRotation;
  assert.equal(
    projectForCloud(project, "studio-admin").content.backgroundImageRotation,
    0,
  );

  assert.equal(normalizeImageRotation(-1), 0);
  assert.equal(normalizeImageRotation(181.7), 182);
  assert.equal(normalizeImageRotation(720), 360);
  assert.equal(normalizeImageRotation(undefined), 0);
  assert.equal(imageRotationCoverScale("square", 45), 1.414214);
  assert.equal(imageRotationCoverScale("portrait", 90), 1.25);
  assert.equal(imageRotationCoverScale("screen", 90), 1.777778);

  const style = focalMediaStyle({
    backgroundImage: "https://example.com/background.jpg",
    backgroundImageRotation: 90,
    format: "screen",
  });
  assert.equal(
    style.transform,
    "rotate(90deg) scale(1.777778) translate3d(0%, 0%, 0)",
  );
});

test("legacy browser uploads without cloud paths migrate without stale asset claims", () => {
  const project = eventProject();
  project.content = {
    ...project.content,
    backgroundImage: "data:image/png;base64,legacy",
    backgroundImageSource: "upload",
    backgroundImageStoragePath: "",
    heroMode: "logo",
    heroLogo: "data:image/png;base64,legacy-logo",
    heroLogoSource: "upload",
    heroLogoStoragePath: "",
    heroLogoName: "Legacy logo",
  };

  const payload = projectForCloud(project, "studio-admin");

  assert.equal(payload.content.backgroundImageSource, "");
  assert.equal(payload.content.backgroundImageStoragePath, "");
  assert.equal(payload.content.heroMode, "text");
  assert.equal(payload.content.heroLogoSource, "");
  assert.equal(payload.content.heroLogoStoragePath, "");
  assert.equal(payload.content.heroLogoName, "");
});

test("valid project-scoped uploads remain attached during migration", () => {
  const project = eventProject();
  project.content = {
    ...project.content,
    backgroundImageSource: "upload",
    backgroundImageStoragePath:
      "studio-projects/legacy-browser-project/background.png",
    heroMode: "logo",
    heroLogoSource: "upload",
    heroLogoStoragePath:
      "studio-projects/legacy-browser-project/logo-event.png",
    heroLogoName: "Event logo",
  };

  const payload = projectForCloud(project, "studio-admin");

  assert.equal(payload.content.backgroundImageSource, "upload");
  assert.equal(
    payload.content.backgroundImageStoragePath,
    "studio-projects/legacy-browser-project/background.png",
  );
  assert.equal(payload.content.heroMode, "logo");
  assert.equal(payload.content.heroLogoSource, "upload");
});

test("incomplete Unsplash references are cleared before cloud migration", () => {
  const project = eventProject();
  project.content = {
    ...project.content,
    backgroundImageSource: "unsplash",
    backgroundImageUrl: "https://images.unsplash.com/photo-example",
    unsplashPhotoId: "",
    unsplashPhotographerName: "",
    unsplashPhotographerUrl: "",
    unsplashPhotoUrl: "",
  };

  const payload = projectForCloud(project, "studio-admin");

  assert.equal(payload.content.backgroundImageSource, "");
  assert.equal(payload.content.backgroundImageUrl, "");
  assert.equal(payload.content.unsplashPhotoId, "");
});

test("valid Logo Library references remain attached during migration", () => {
  const project = eventProject();
  project.content = {
    ...project.content,
    heroMode: "logo",
    heroLogoSource: "library",
    heroLogoLibraryId: "bids-for-kids",
    heroLogoStoragePath:
      "studio-library/logos/bids-for-kids/source.webp",
    heroLogoName: "Bids for Kids",
  };

  const payload = projectForCloud(project, "studio-admin");

  assert.equal(payload.content.heroMode, "logo");
  assert.equal(payload.content.heroLogoSource, "library");
  assert.equal(payload.content.heroLogoLibraryId, "bids-for-kids");
});
