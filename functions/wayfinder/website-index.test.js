import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWebsitePageChunks,
  canonicalizeWebsiteUrl,
  extractWebsitePage,
  getRelevantWayfinderWebsiteEntries,
  parseSitemapUrls,
  shouldExcludeWebsiteUrl,
} from "./website-index.js";

test("page sitemap URLs are parsed and deduplicated", () => {
  const xml = [
    "<urlset>",
    "<url><loc>https://www.crosspointe.tv/kids</loc></url>",
    "<url><loc>https://www.crosspointe.tv/kids</loc></url>",
    "<url><loc>https://www.crosspointe.tv/small-groups</loc></url>",
    "</urlset>",
  ].join("");

  assert.deepEqual(parseSitemapUrls(xml), [
    "https://www.crosspointe.tv/kids",
    "https://www.crosspointe.tv/small-groups",
  ]);
});

test("website URLs stay on the approved CrossPointe origin", () => {
  assert.equal(
      canonicalizeWebsiteUrl("https://crosspointe.tv/kids/?ref=test#top"),
      "https://www.crosspointe.tv/kids",
  );
  assert.equal(canonicalizeWebsiteUrl("https://example.com/kids"), "");
  assert.equal(canonicalizeWebsiteUrl("http://www.crosspointe.tv/kids"), "");
});

test("dynamic event and campaign pages are excluded", () => {
  assert.equal(shouldExcludeWebsiteUrl(
      "https://www.crosspointe.tv/events",
  ), true);
  assert.equal(shouldExcludeWebsiteUrl(
      "https://www.crosspointe.tv/under-one-roof",
  ), true);
  assert.equal(shouldExcludeWebsiteUrl(
      "https://www.crosspointe.tv/small-groups",
  ), false);
});

test("HTML extraction removes navigation, scripts, and footer content", () => {
  const page = extractWebsitePage([
    "<!doctype html><html><head>",
    "<title>Small Groups | CrossPointe Church</title>",
    "<meta name=\"description\" content=\"Find a Pointe Group.\">",
    "</head><body>",
    "<header>Old navigation schedule</header>",
    "<main><h1>Pointe Groups</h1>",
    "<p>Groups are always accepting new people.</p>",
    "<script>privateImplementationDetail()</script></main>",
    "<footer>Unrelated footer text</footer>",
    "</body></html>",
  ].join(""), "https://www.crosspointe.tv/small-groups");

  assert.equal(page.title, "Pointe Groups");
  assert.match(page.text, /always accepting new people/i);
  assert.doesNotMatch(page.text, /privateImplementationDetail/);
  assert.doesNotMatch(page.text, /Old navigation schedule/);
  assert.doesNotMatch(page.text, /Unrelated footer text/);
});

test("long pages become bounded search chunks with page links", () => {
  const paragraph = "Pointe Groups gather for fellowship and Bible study. ";
  const page = {
    pageId: "small-groups",
    title: "Small Groups",
    description: "Find a Pointe Group.",
    url: "https://www.crosspointe.tv/small-groups",
    path: "/small-groups",
    text: paragraph.repeat(80) + "\n\n" + paragraph.repeat(80),
    contentHash: "hash",
  };
  const chunks = buildWebsitePageChunks(page);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.length <= 7);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 1200));
  assert.ok(chunks.every((chunk) => chunk.url === page.url));
});

test("embedded pages still retain a searchable title and link", () => {
  const page = extractWebsitePage(
      "<html><head><title>Small Groups | CrossPointe</title></head>" +
        "<body><main><iframe src=\"groups\"></iframe></main></body></html>",
      "https://www.crosspointe.tv/small-groups",
  );

  assert.equal(page.title, "Small Groups");
  assert.equal(page.url, "https://www.crosspointe.tv/small-groups");
});

test("website retrieval returns the best supplemental page", async () => {
  const entries = await getRelevantWayfinderWebsiteEntries(
      createRetrievalFirestore_(),
      "Where can I find all the small groups?",
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "Small Groups");
  assert.equal(entries[0].sourceAuthority, "supplemental");
  assert.equal(
      entries[0].approvedLinks[0].url,
      "https://www.crosspointe.tv/small-groups",
  );
});

function createRetrievalFirestore_() {
  const chunks = [{
    id: "run-1-small-groups-00",
    data: {
      pageId: "small-groups",
      title: "Small Groups",
      path: "/small-groups",
      url: "https://www.crosspointe.tv/small-groups",
      text: "Pointe Groups are always accepting new people.",
      keywords: ["pointe", "group", "small", "accepting", "people"],
    },
  }, {
    id: "run-1-kids-00",
    data: {
      pageId: "kids",
      title: "Kingdom Kids",
      path: "/kids",
      url: "https://www.crosspointe.tv/kids",
      text: "Children are welcome at CrossPointe.",
      keywords: ["children", "kids"],
    },
  }];
  return {
    doc: () => ({
      get: async () => ({
        exists: true,
        get: (field) => field === "activeRunId" ? "run-1" : undefined,
      }),
    }),
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: chunks.map((chunk) => ({
              id: chunk.id,
              data: () => chunk.data,
            })),
          }),
        }),
      }),
    }),
  };
}
