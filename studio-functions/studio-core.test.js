import assert from "node:assert/strict";
import test from "node:test";

import {
  hasStudioAccess,
  hashShareToken,
  isSafeUnsplashDownloadUrl,
  membershipId,
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
