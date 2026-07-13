const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "at", "be", "can", "do", "does",
  "church", "crosspointe", "for", "from", "had", "has", "have", "how",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "there",
  "this", "to", "up", "we", "what", "when", "where", "which", "who",
  "why", "with", "you", "your",
]);

const TOKEN_ALIASES = new Map([
  ["baptize", "baptism"],
  ["baptized", "baptism"],
  ["baptizing", "baptism"],
  ["dunk", "baptism"],
  ["dunked", "baptism"],
  ["child", "children"],
  ["kid", "children"],
  ["kids", "children"],
  ["teen", "student"],
  ["teens", "student"],
  ["teenager", "student"],
  ["teenagers", "student"],
  ["youth", "student"],
  ["groups", "group"],
  ["clothes", "clothing"],
  ["wear", "clothing"],
  ["attire", "clothing"],
  ["services", "service"],
  ["visiting", "visit"],
  ["visitor", "visit"],
  ["guests", "guest"],
  ["members", "membership"],
  ["member", "membership"],
  ["volunteer", "serve"],
  ["volunteering", "serve"],
  ["praying", "prayer"],
  ["pray", "prayer"],
  ["tithing", "tithe"],
]);

const FIELD_WEIGHTS = [
  ["title", 10],
  ["sampleQuestions", 7],
  ["keywords", 6],
  ["requiredFacts", 3],
  ["allowedPublicFacts", 3],
  ["requiredActions", 2],
  ["routingGuidance", 2],
  ["prohibitedInformation", 2],
  ["prohibitedClaims", 1],
];

export function rankWayfinderKnowledge(question, entries, options = {}) {
  const query = normalizeText_(question);
  const queryTokens = expandQuestionTokens_(
      query,
      tokenizeWayfinderText(query),
  );
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 10));
  const minimumScore = Math.max(1, Number(options.minimumScore) || 6);

  if (!query || queryTokens.length === 0) {
    return {
      question: query,
      confidence: "none",
      results: [],
    };
  }

  const ranked = (Array.isArray(entries) ? entries : [])
      .map((entry) => scoreEntry_(query, queryTokens, entry))
      .filter((result) => result.score >= minimumScore)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.id).localeCompare(String(right.id));
      })
      .slice(0, limit);

  return {
    question: query,
    confidence: getConfidence_(ranked),
    results: ranked,
  };
}

function expandQuestionTokens_(query, tokens) {
  const expanded = new Set(tokens);
  const asksWhenChurchMeets = /\b(?:time|times|when|start|starts|meet|meets)\b/
      .test(query) && /\b(?:church|service|services)\b/.test(query);

  if (asksWhenChurchMeets) {
    expanded.add("service");
    expanded.add("time");
  }

  return [...expanded];
}

export function tokenizeWayfinderText(value) {
  const rawTokens = normalizeText_(value)
      .replace(/[’']s\b/g, "")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/^-+|-+$/g, ""))
      .filter(Boolean)
      .filter((token) => token.length > 1 || /^\d+$/.test(token))
      .map((token) => TOKEN_ALIASES.get(token) || token)
      .filter((token) => !STOP_WORDS.has(token));

  return [...new Set(rawTokens)];
}

function scoreEntry_(query, queryTokens, entry) {
  const value = entry && typeof entry === "object" ? entry : {};
  const matchedTerms = new Set();
  let score = 0;

  FIELD_WEIGHTS.forEach(([field, weight]) => {
    const text = flattenText_(value[field]);
    const tokens = new Set(tokenizeWayfinderText(text));

    queryTokens.forEach((token) => {
      if (tokens.has(token)) {
        score += weight;
        matchedTerms.add(token);
      }
    });

    if (text && text.includes(query)) {
      score += weight * 2;
    }
  });

  const topicTokens = new Set(tokenizeWayfinderText(value.topic));
  queryTokens.forEach((token) => {
    if (topicTokens.has(token)) {
      score += 4;
      matchedTerms.add(token);
    }
  });

  return {
    id: String(value.id || ""),
    topic: String(value.topic || ""),
    title: String(value.title || ""),
    responseMode: String(value.responseMode || "flexible"),
    score: score,
    matchedTerms: [...matchedTerms].sort(),
    requiredFacts: arrayOfStrings_(value.requiredFacts),
    allowedPublicFacts: arrayOfStrings_(value.allowedPublicFacts),
    requiredActions: arrayOfStrings_(value.requiredActions),
    approvedActions: Array.isArray(value.approvedActions) ?
      value.approvedActions : [],
    approvedLinks: Array.isArray(value.approvedLinks) ?
      value.approvedLinks : [],
    prohibitedClaims: arrayOfStrings_(value.prohibitedClaims),
    prohibitedInformation: arrayOfStrings_(value.prohibitedInformation),
    requiredSourceType: String(
        value.requiredSourceType || value.requiredSourceTypeForDates || "",
    ),
    sourceBundleId: String(value.sourceBundleId || ""),
  };
}

function getConfidence_(ranked) {
  if (!ranked.length) return "none";

  const first = ranked[0];
  const second = ranked[1];
  const margin = second ? first.score - second.score : first.score;

  if (first.score >= 24 && margin >= 5) return "high";
  if (first.score >= 12) return "medium";
  return "low";
}

function flattenText_(value) {
  if (Array.isArray(value)) {
    return value.map(flattenText_).filter(Boolean).join(" ");
  }

  if (value && typeof value === "object") {
    return Object.values(value).map(flattenText_).filter(Boolean).join(" ");
  }

  return normalizeText_(value);
}

function arrayOfStrings_(value) {
  return (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
}

function normalizeText_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
