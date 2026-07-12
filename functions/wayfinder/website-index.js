import crypto from "node:crypto";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {tokenizeWayfinderText} from "./retrieval.js";

export const WAYFINDER_WEBSITE_CHUNKS_COLLECTION =
  "centralAssistantWebsiteChunksDraft";
export const WAYFINDER_WEBSITE_INDEX_DOC_PATH =
  "centralAssistantWebsiteIndexDraft/state";

const WEBSITE_ORIGIN = "https://www.crosspointe.tv";
const WEBSITE_SITEMAP_URL = WEBSITE_ORIGIN + "/page/sitemap.xml";
const ALLOWED_HOSTNAMES = new Set(["www.crosspointe.tv", "crosspointe.tv"]);
const MAX_PAGES = 60;
const MAX_PAGE_BYTES = 1024 * 1024;
const MAX_CHUNKS_PER_PAGE = 7;
const MAX_CHUNK_LENGTH = 1200;
const CHUNK_OVERLAP = 160;
const FETCH_TIMEOUT_MS = 12000;
const FETCH_CONCURRENCY = 4;
const MAX_REDIRECTS = 3;
const WEBSITE_RESULT_LIMIT = 3;
const EXCLUDED_PATH_PATTERNS = [
  /^\/admin(?:\/|$)/i,
  /^\/creative-dashboard(?:\/|$)/i,
  /^\/events?(?:\/|$)/i,
  /^\/episodes?(?:\/|$)/i,
  /^\/sermons?(?:-2)?(?:\/|$)/i,
  /^\/blog(?:\/|$)/i,
  /^\/channel(?:\/|$)/i,
  /^\/noteoutline(?:\/|$)/i,
  /^\/under-one-roof(?:\/|$)/i,
  /^\/easter(?:\/|$)/i,
  /^\/camps(?:\/|$)/i,
  /^\/page-not-found(?:\/|$)/i,
  /^\/group-archive(?:\/|$)/i,
];

export function createWayfinderWebsiteIndexHandler(dependencies) {
  const admin = dependencies.admin;
  const firestore = dependencies.firestore;
  const fetchImpl = dependencies.fetchImpl || fetch;

  return async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }

    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request: request,
        admin: admin,
        firestore: firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      const action = String(request.body && request.body.action || "status")
          .trim().toLowerCase();

      if (action === "status") {
        response.status(200).json(await getWayfinderWebsiteIndexStatus(
            firestore,
        ));
        return;
      }

      if (action !== "refresh") {
        throw createWayfinderAccessError(
            400,
            "Choose status or refresh for the Wayfinder website index.",
        );
      }

      const result = await refreshWayfinderWebsiteIndex({
        firestore: firestore,
        fetchImpl: fetchImpl,
        requestedByUid: authResult.decodedToken.uid,
        requestedByEmail: authResult.decodedToken.email,
      });
      response.status(200).json(result);
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      if (!error || !error.statusCode) {
        console.error("Wayfinder website index refresh failed.", {
          name: String(error && error.name || "Error"),
          code: String(error && error.code || "unknown"),
        });
      }
      response.status(status).json({
        error: error && error.statusCode ?
          String(error.message || "Website index access denied.") :
          "Wayfinder could not refresh the website index right now.",
      });
    }
  };
}

export async function refreshWayfinderWebsiteIndex(options) {
  const firestore = options.firestore;
  const fetchImpl = options.fetchImpl || fetch;
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const sitemapXml = await fetchTextSafely_(WEBSITE_SITEMAP_URL, fetchImpl, {
    acceptedContentTypes: ["application/xml", "text/xml", "text/plain"],
  });
  const pageUrls = parseSitemapUrls(sitemapXml)
      .map(canonicalizeWebsiteUrl)
      .filter(Boolean)
      .filter((url) => !shouldExcludeWebsiteUrl(url))
      .slice(0, MAX_PAGES);

  if (!pageUrls.length) {
    const error = new Error("The CrossPointe page sitemap had no safe pages.");
    error.code = "wayfinder-empty-sitemap";
    throw error;
  }

  const pageResults = await mapWithConcurrency_(
      pageUrls,
      FETCH_CONCURRENCY,
      async (url) => {
        try {
          const html = await fetchTextSafely_(url, fetchImpl, {
            acceptedContentTypes: ["text/html", "application/xhtml+xml"],
          });
          const page = extractWebsitePage(html, url);
          if (!page.text) {
            page.text = [
              "CrossPointe has a public website page titled",
              page.title + ".",
              page.description,
            ].filter(Boolean).join(" ");
            page.contentHash = crypto.createHash("sha256")
                .update(page.text).digest("hex");
          }
          if (!page.text || page.text.length < 20) {
            return {
              url: url,
              status: "skipped",
              reason: "not-enough-text",
            };
          }
          return {url: url, status: "indexed", page: page};
        } catch (error) {
          return {
            url: url,
            status: "failed",
            reason: String(error && error.code || error && error.message ||
              "fetch-failed").slice(0, 120),
          };
        }
      },
  );
  const indexedPages = pageResults.filter((result) => {
    return result.status === "indexed" && result.page;
  });
  const chunkRecords = indexedPages.flatMap((result) => {
    return buildWebsitePageChunks(result.page).map((chunk) => ({
      ...chunk,
      runId: runId,
      indexedAt: startedAt,
      sourceType: "website_page",
      sourceAuthority: "supplemental",
    }));
  });

  if (!chunkRecords.length) {
    const error = new Error("No usable text was found on the website pages.");
    error.code = "wayfinder-empty-website-index";
    throw error;
  }

  await writeWebsiteIndexRun_(firestore, runId, chunkRecords);
  const completedAt = new Date().toISOString();
  const failedPages = pageResults.filter((result) => {
    return result.status === "failed";
  });
  const skippedPages = pageResults.filter((result) => {
    return result.status === "skipped";
  });
  const state = {
    activeRunId: runId,
    status: "ready",
    source: WEBSITE_SITEMAP_URL,
    startedAt: startedAt,
    completedAt: completedAt,
    requestedByUid: String(options.requestedByUid || ""),
    requestedByEmail: String(options.requestedByEmail || ""),
    pageCount: indexedPages.length,
    chunkCount: chunkRecords.length,
    failedPageCount: failedPages.length,
    skippedPageCount: skippedPages.length,
    failedPages: failedPages.slice(0, 10),
    excludedPageCount: Math.max(0, parseSitemapUrls(sitemapXml).length -
      pageUrls.length),
  };
  await firestore.doc(WAYFINDER_WEBSITE_INDEX_DOC_PATH).set(state);
  await deleteInactiveWebsiteRuns_(firestore, runId);
  return {ok: true, ...sanitizeWebsiteIndexState_(state)};
}

export async function getWayfinderWebsiteIndexStatus(firestore) {
  const snapshot = await firestore.doc(WAYFINDER_WEBSITE_INDEX_DOC_PATH).get();
  if (!snapshot.exists) {
    return {
      ok: true,
      status: "not-indexed",
      pageCount: 0,
      chunkCount: 0,
      failedPageCount: 0,
      skippedPageCount: 0,
      completedAt: "",
    };
  }
  return {ok: true, ...sanitizeWebsiteIndexState_(snapshot.data())};
}

export async function getRelevantWayfinderWebsiteEntries(
    firestore,
    question,
    options = {},
) {
  const stateSnapshot = await firestore
      .doc(WAYFINDER_WEBSITE_INDEX_DOC_PATH).get();
  if (!stateSnapshot.exists) return [];
  const activeRunId = String(stateSnapshot.get("activeRunId") || "").trim();
  if (!activeRunId) return [];

  const chunksSnapshot = await firestore
      .collection(WAYFINDER_WEBSITE_CHUNKS_COLLECTION)
      .where("runId", "==", activeRunId)
      .limit(450)
      .get();
  const queryTokens = tokenizeWayfinderText(question);
  if (!queryTokens.length) return [];

  const ranked = chunksSnapshot.docs
      .map((doc) => scoreWebsiteChunk_(doc.id, doc.data(), queryTokens))
      .filter((result) => result.score >= 5)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.id.localeCompare(right.id);
      });
  const seenPages = new Set();
  const limit = Math.max(1, Math.min(
      Number(options.limit) || WEBSITE_RESULT_LIMIT,
      5,
  ));

  return ranked.filter((result) => {
    if (seenPages.has(result.pageId)) return false;
    seenPages.add(result.pageId);
    return true;
  }).slice(0, limit).map(buildWebsiteKnowledgeEntry_);
}

export function parseSitemapUrls(xml) {
  const urls = [];
  const pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let match = pattern.exec(String(xml || ""));
  while (match) {
    const value = decodeHtmlEntities_(stripTags_(match[1])).trim();
    if (value) urls.push(value);
    match = pattern.exec(String(xml || ""));
  }
  return [...new Set(urls)];
}

export function canonicalizeWebsiteUrl(value) {
  try {
    const url = new URL(String(value || ""), WEBSITE_ORIGIN);
    if (url.protocol !== "https:" || !ALLOWED_HOSTNAMES.has(url.hostname)) {
      return "";
    }
    url.hostname = "www.crosspointe.tv";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch (error) {
    return "";
  }
}

export function shouldExcludeWebsiteUrl(value) {
  const canonical = canonicalizeWebsiteUrl(value);
  if (!canonical) return true;
  const path = new URL(canonical).pathname;
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function extractWebsitePage(html, url) {
  const source = String(html || "");
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const headingMatch = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const descriptionFirstPattern = new RegExp(
      "<meta\\b[^>]*name=[\"']description[\"'][^>]*" +
      "content=[\"']([^\"']*)[\"'][^>]*>",
      "i",
  );
  const contentFirstPattern = new RegExp(
      "<meta\\b[^>]*content=[\"']([^\"']*)[\"'][^>]*" +
      "name=[\"']description[\"'][^>]*>",
      "i",
  );
  const metaMatch = source.match(descriptionFirstPattern) ||
    source.match(contentFirstPattern);
  const mainMatch = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    source.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const contentHtml = mainMatch ? mainMatch[1] :
    bodyMatch ? bodyMatch[1] : source;
  const removableElementPattern = new RegExp(
      "<(script|style|noscript|svg|canvas|template|form|nav|footer|" +
        "header)\\b[^>]*>[\\s\\S]*?</\\1>",
      "gi",
  );
  const cleaned = contentHtml
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(removableElementPattern, " ")
      .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  const title = normalizeVisibleText_(
      headingMatch ? headingMatch[1] :
        titleMatch ? titleMatch[1] : "CrossPointe",
  ).replace(/\s*[|–—-]\s*CrossPointe.*$/i, "").slice(0, 160);
  const description = normalizeVisibleText_(metaMatch ? metaMatch[1] : "")
      .slice(0, 300);
  const text = normalizeVisibleText_(cleaned);
  const canonicalUrl = canonicalizeWebsiteUrl(url);

  return {
    pageId: crypto.createHash("sha256").update(canonicalUrl).digest("hex")
        .slice(0, 24),
    title: title || "CrossPointe",
    description: description,
    url: canonicalUrl,
    path: canonicalUrl ? new URL(canonicalUrl).pathname : "",
    text: text,
    contentHash: crypto.createHash("sha256").update(text).digest("hex"),
  };
}

export function buildWebsitePageChunks(page) {
  const paragraphs = String(page && page.text || "")
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  const chunks = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    const pieces = splitLongText_(paragraph, MAX_CHUNK_LENGTH);
    pieces.forEach((piece) => {
      const candidate = current ? current + "\n\n" + piece : piece;
      if (candidate.length <= MAX_CHUNK_LENGTH) {
        current = candidate;
        return;
      }
      if (current) chunks.push(current);
      const overlap = current ? current.slice(-CHUNK_OVERLAP).trim() : "";
      current = overlap && overlap.length + piece.length + 2 <=
        MAX_CHUNK_LENGTH ? overlap + "\n\n" + piece : piece;
    });
  });
  if (current) chunks.push(current);

  return chunks.slice(0, MAX_CHUNKS_PER_PAGE).map((text, index) => ({
    id: String(page.pageId) + "-" + String(index).padStart(2, "0"),
    pageId: String(page.pageId || ""),
    chunkIndex: index,
    title: String(page.title || "CrossPointe"),
    description: String(page.description || ""),
    url: String(page.url || ""),
    path: String(page.path || ""),
    text: text,
    keywords: tokenizeWayfinderText([
      page.title,
      page.description,
      page.path,
      text,
    ].join(" ")).slice(0, 120),
    contentHash: String(page.contentHash || ""),
  }));
}

function scoreWebsiteChunk_(id, data, queryTokens) {
  const value = data && typeof data === "object" ? data : {};
  const titleTokens = new Set(tokenizeWayfinderText(value.title));
  const pathTokens = new Set(tokenizeWayfinderText(value.path));
  const textTokens = new Set(Array.isArray(value.keywords) ?
    value.keywords : tokenizeWayfinderText(value.text));
  let score = 0;
  const matchedTerms = [];
  queryTokens.forEach((token) => {
    let matched = false;
    if (titleTokens.has(token)) {
      score += 8;
      matched = true;
    }
    if (pathTokens.has(token)) {
      score += 7;
      matched = true;
    }
    if (textTokens.has(token)) {
      score += 2;
      matched = true;
    }
    if (matched) matchedTerms.push(token);
  });
  return {
    id: String(id || value.id || ""),
    pageId: String(value.pageId || ""),
    title: String(value.title || "CrossPointe website"),
    url: String(value.url || ""),
    path: String(value.path || ""),
    text: String(value.text || ""),
    score: score,
    matchedTerms: matchedTerms,
  };
}

function buildWebsiteKnowledgeEntry_(result) {
  return {
    id: "website-" + result.id,
    topic: "website_content",
    title: result.title,
    responseMode: "guided",
    requiredFacts: [],
    allowedPublicFacts: [result.text],
    requiredActions: [
      "Use this public website content only when it directly answers " +
        "the question.",
    ],
    prohibitedClaims: [
      "Do not treat website event dates or schedules as live event data.",
      "Do not let this supplemental page override curated knowledge or " +
        "Planning Center.",
      "Do not infer facts that are not stated in this page excerpt.",
    ],
    approvedLinks: [{label: result.title, url: result.url}],
    sourceType: "website_page",
    sourceAuthority: "supplemental",
    websiteScore: result.score,
    matchedTerms: result.matchedTerms,
  };
}

async function fetchTextSafely_(urlValue, fetchImpl, options = {}) {
  let url = canonicalizeWebsiteUrl(urlValue);
  if (!url) {
    throw Object.assign(new Error("Unsafe website URL."), {
      code: "unsafe-url",
    });
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml," +
          "text/xml;q=0.9,text/plain;q=0.8",
        "User-Agent": "CrossPointe-Wayfinder-Indexer/1.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const nextUrl = canonicalizeWebsiteUrl(
          new URL(response.headers.get("location") || "", url).toString(),
      );
      if (!nextUrl) {
        throw Object.assign(new Error("Unsafe redirect."), {
          code: "unsafe-redirect",
        });
      }
      url = nextUrl;
      continue;
    }
    if (!response.ok) {
      throw Object.assign(new Error("HTTP " + response.status), {
        code: "http-" + response.status,
      });
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_PAGE_BYTES) {
      throw Object.assign(new Error("Page is too large."), {
        code: "page-too-large",
      });
    }
    const contentType = String(response.headers.get("content-type") || "")
        .toLowerCase();
    const accepted = options.acceptedContentTypes || [];
    if (contentType && accepted.length &&
      !accepted.some((type) => contentType.includes(type))) {
      throw Object.assign(new Error("Unsupported page type."), {
        code: "unsupported-content-type",
      });
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_PAGE_BYTES) {
      throw Object.assign(new Error("Page is too large."), {
        code: "page-too-large",
      });
    }
    return text;
  }
  throw Object.assign(new Error("Too many redirects."), {
    code: "too-many-redirects",
  });
}

async function writeWebsiteIndexRun_(firestore, runId, chunks) {
  for (let index = 0; index < chunks.length; index += 400) {
    const batch = firestore.batch();
    chunks.slice(index, index + 400).forEach((chunk) => {
      const ref = firestore.collection(WAYFINDER_WEBSITE_CHUNKS_COLLECTION)
          .doc(runId + "-" + chunk.id);
      batch.set(ref, chunk);
    });
    await batch.commit();
  }
}

async function deleteInactiveWebsiteRuns_(firestore, activeRunId) {
  const snapshot = await firestore
      .collection(WAYFINDER_WEBSITE_CHUNKS_COLLECTION)
      .limit(450)
      .get();
  const inactiveDocs = snapshot.docs.filter((doc) => {
    return String(doc.get("runId") || "") !== activeRunId;
  });
  if (!inactiveDocs.length) return;
  const batch = firestore.batch();
  inactiveDocs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function mapWithConcurrency_(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from(
      {length: Math.min(concurrency, values.length)},
      () => worker(),
  ));
  return results;
}

function sanitizeWebsiteIndexState_(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    status: String(state.status || "not-indexed"),
    pageCount: Number(state.pageCount) || 0,
    chunkCount: Number(state.chunkCount) || 0,
    failedPageCount: Number(state.failedPageCount) || 0,
    skippedPageCount: Number(state.skippedPageCount) || 0,
    excludedPageCount: Number(state.excludedPageCount) || 0,
    completedAt: String(state.completedAt || ""),
    source: String(state.source || WEBSITE_SITEMAP_URL),
  };
}

function splitLongText_(text, maxLength) {
  const value = String(text || "").trim();
  if (value.length <= maxLength) return value ? [value] : [];
  const pieces = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf(". ", maxLength);
    if (splitAt < Math.floor(maxLength * 0.55)) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt < Math.floor(maxLength * 0.4)) splitAt = maxLength;
    pieces.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function normalizeVisibleText_(value) {
  return decodeHtmlEntities_(stripTags_(String(value || "")))
      .replace(/\r/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

function stripTags_(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities_(value) {
  return String(value || "")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
        return String.fromCodePoint(parseInt(code, 16));
      })
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
}
