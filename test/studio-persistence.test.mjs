import assert from "node:assert/strict";
import test from "node:test";

import {
  focalMediaStyle,
  imageRotationCoverScale,
  normalizeImageOpacity,
  normalizeImageRotation,
} from "../src/studio/focal.js";
import {projectForCloud} from "../src/studio/persistence.js";
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
  createStudioProject,
  getEventCompositionOptions,
  getEventFontOptions,
  getEventPalette,
  getProjectWarnings,
  isGraphicTemplateId,
  isSocialTemplateId,
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

function eventProject() {
  return {
    ...createStudioProject("event-signal-stack"),
    id: "legacy-browser-project",
    name: "Legacy Browser Project",
  };
}

test("Social Posts expose three focused templates and mobile-first formats", () => {
  const socialTemplates = TEMPLATE_CATALOG.filter(
    (template) => template.kind === "social",
  );

  assert.deepEqual(
    socialTemplates.map((template) => template.id),
    ["social-scripture", "social-quote", "social-statement"],
  );
  socialTemplates.forEach((template) => {
    assert.deepEqual(template.formats, ["1:1", "4:5"]);
    assert.equal(isSocialTemplateId(template.id), true);
    assert.ok(getEventFontOptions(template.id).length >= 3);
    assert.ok(getEventCompositionOptions(template.id).length >= 4);
  });
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
  assert.equal(payload.sourceType, "manual");
  assert.equal(payload.content.format, "square");
  assert.equal(payload.content.date, "");
  assert.equal(payload.content.heroMode, "text");
  assert.equal(payload.content.heroLogoSource, "");
  assert.equal(payload.content.heroLogoStoragePath, "");
  assert.equal(payload.content.heroLogoName, "");
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

  project.content.brandMark = "heart";
  project.content.brandColor = "red";
  project.content.fontWeight = "black";
  const payload = projectForCloud(project, "studio-admin");
  assert.equal(payload.content.brandMark, "heart");
  assert.equal(payload.content.brandColor, "red");
  assert.equal(payload.content.fontWeight, "black");

  project.content.brandMark = "unknown";
  project.content.brandColor = "unknown";
  project.content.fontWeight = "unknown";
  const normalized = projectForCloud(project, "studio-admin");
  assert.equal(normalized.content.brandMark, "central");
  assert.equal(normalized.content.brandColor, "auto");
  assert.equal(normalized.content.fontWeight, "template");
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
