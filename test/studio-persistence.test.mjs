import assert from "node:assert/strict";
import test from "node:test";

import {projectForCloud} from "../src/studio/persistence.js";
import {createStudioProject} from "../src/studio/templates.js";

function eventProject() {
  return {
    ...createStudioProject("event-signal-stack"),
    id: "legacy-browser-project",
    name: "Legacy Browser Project",
  };
}

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
