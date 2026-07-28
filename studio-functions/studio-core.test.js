import assert from "node:assert/strict";
import test from "node:test";

import {
  hasStudioAccess,
  hashShareToken,
  isPublishedPlanningCenterGroup,
  isSafePlanningCenterGroupImageUrl,
  isSafePlanningCenterGroupsUrl,
  isSafeUnsplashDownloadUrl,
  membershipId,
  planningCenterGroupResult,
  unsplashPhotoResult,
} from "./studio-core.js";

test("Studio access honors the dedicated permission and settings fallback", () => {
  assert.equal(
    hasStudioAccess({active: true, pageAccess: {studio: "edit"}}, true),
    true,
  );
  assert.equal(
    hasStudioAccess({active: true, pageAccess: {settings: "admin"}}, true),
    true,
  );
  assert.equal(
    hasStudioAccess({active: true, pageAccess: {studio: "view"}}, true),
    false,
  );
  assert.equal(
    hasStudioAccess({active: false, pageAccess: {studio: "admin"}}),
    false,
  );
});

test("share identifiers are deterministic without storing the raw token", () => {
  assert.equal(hashShareToken("share-me"), hashShareToken("share-me"));
  assert.notEqual(hashShareToken("share-me"), "share-me");
  assert.equal(membershipId("uid", "project"), "uid_project");
});

test("Unsplash download tracking accepts only the official endpoint", () => {
  assert.equal(
    isSafeUnsplashDownloadUrl(
      "https://api.unsplash.com/photos/abc123/download?ixid=test",
    ),
    true,
  );
  assert.equal(
    isSafeUnsplashDownloadUrl("https://images.unsplash.com/photo-test"),
    false,
  );
  assert.equal(
    isSafeUnsplashDownloadUrl("https://example.com/photos/a/download"),
    false,
  );
});

test("Unsplash results include attribution UTM parameters", () => {
  const result = unsplashPhotoResult({
    id: "photo-1",
    urls: {
      regular: "https://images.unsplash.com/photo-1?w=1080",
      full: "https://images.unsplash.com/photo-1?w=4000",
    },
    links: {
      html: "https://unsplash.com/photos/photo-1",
      download_location: "https://api.unsplash.com/photos/photo-1/download",
    },
    user: {
      name: "Example Photographer",
      links: {html: "https://unsplash.com/@example"},
    },
  });
  assert.match(result.photoUrl, /utm_source=crosspointe_central_studio/);
  assert.match(result.photographerUrl, /utm_medium=referral/);
  assert.match(result.exportImageUrl, /w=4000/);
});

test("Planning Center group results retain only published directory fields", () => {
  const group = {
    id: "group-1",
    attributes: {
      listed: true,
      archived_at: null,
      name: "Young Adults",
      description_as_plain_text: "Community for young adults.",
      schedule: "Tuesdays at 7:00 PM",
      contact_email: "private@example.com",
      header_image: {
        medium: "https://groups-production.s3.amazonaws.com/group.jpg",
      },
      public_church_center_web_url:
        "https://crosspointetv.churchcenter.com/groups/young-adults",
    },
    relationships: {
      group_type: {data: {id: "type-1"}},
    },
  };
  const result = planningCenterGroupResult(
    group,
    new Map([["type-1", "Pointe Groups"]]),
  );
  assert.equal(isPublishedPlanningCenterGroup(group), true);
  assert.equal(result.name, "Young Adults");
  assert.equal(result.typeName, "Pointe Groups");
  assert.match(result.imageUrl, /^https:/);
  assert.equal("contactEmail" in result, false);
});

test("Planning Center pagination accepts only the official Groups endpoint", () => {
  assert.equal(
    isSafePlanningCenterGroupsUrl(
      "https://api.planningcenteronline.com/groups/v2/groups?per_page=100",
    ),
    true,
  );
  assert.equal(
    isSafePlanningCenterGroupsUrl(
      "https://api.planningcenteronline.com/people/v2/people",
    ),
    false,
  );
  assert.equal(
    isSafePlanningCenterGroupsUrl(
      "https://example.com/groups/v2/groups",
    ),
    false,
  );
});

test("Planning Center image proxy accepts only published group image paths", () => {
  assert.equal(
    isSafePlanningCenterGroupImageUrl(
      "https://groups-production.s3.amazonaws.com/uploads/group/header_image/1651899/medium_CP_Designs.png",
    ),
    true,
  );
  assert.equal(
    isSafePlanningCenterGroupImageUrl(
      "https://groups-production.s3.amazonaws.com/private/example.png",
    ),
    false,
  );
  assert.equal(
    isSafePlanningCenterGroupImageUrl(
      "https://example.com/uploads/group/header_image/1/example.png",
    ),
    false,
  );
});
