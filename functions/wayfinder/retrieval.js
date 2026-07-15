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
  const entryList = Array.isArray(entries) ? entries : [];
  const preparedEntries = entryList.map(prepareEntry_);
  const vocabulary = buildVocabulary_(preparedEntries);
  const possibleTypoTokens = new Set(queryTokens.filter((token) => {
    return token.length >= 5 && !vocabulary.has(token);
  }));
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 10));
  const minimumScore = Math.max(1, Number(options.minimumScore) || 6);

  if (!query || queryTokens.length === 0) {
    return {
      question: query,
      confidence: "none",
      results: [],
    };
  }

  const ranked = preparedEntries
      .map((entry) => {
        return scoreEntry_(query, queryTokens, possibleTypoTokens, entry);
      })
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

  const asksReturnFrequency = /\bhow soon\b/.test(query) &&
    /\b(?:come back|return|after (?:i |we )?visit)\b/.test(query);
  if (asksReturnFrequency) {
    expanded.add("often");
    expanded.add("eligibility");
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

function scoreEntry_(query, queryTokens, possibleTypoTokens, preparedEntry) {
  const value = preparedEntry.value;
  const matchedTerms = new Set();
  let score = 0;

  preparedEntry.fields.forEach(({weight, text, tokens}) => {
    queryTokens.forEach((token) => {
      if (tokens.has(token) || possibleTypoTokens.has(token) &&
        [...tokens].some((candidate) => {
          return isLikelySingleCharacterTypo_(token, candidate);
        })) {
        score += weight;
        matchedTerms.add(token);
      }
    });

    if (text && text.includes(query)) {
      score += weight * 2;
    }
  });

  queryTokens.forEach((token) => {
    if (preparedEntry.topicTokens.has(token)) {
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

function prepareEntry_(entry) {
  const value = entry && typeof entry === "object" ? entry : {};
  return {
    value: value,
    fields: FIELD_WEIGHTS.map(([field, weight]) => {
      const text = flattenText_(value[field]);
      return {
        weight: weight,
        text: text,
        tokens: new Set(tokenizeWayfinderText(text)),
      };
    }),
    topicTokens: new Set(tokenizeWayfinderText(value.topic)),
  };
}

function buildVocabulary_(preparedEntries) {
  const vocabulary = new Set();
  preparedEntries.forEach((entry) => {
    entry.fields.forEach(({tokens}) => {
      tokens.forEach((token) => vocabulary.add(token));
    });
    entry.topicTokens.forEach((token) => vocabulary.add(token));
  });
  return vocabulary;
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

function isLikelySingleCharacterTypo_(leftValue, rightValue) {
  const left = String(leftValue || "");
  const right = String(rightValue || "");
  if (left === right) return true;
  if (left.length < 5 || right.length < 5 ||
    Math.abs(left.length - right.length) > 1 || left[0] !== right[0]) {
    return false;
  }

  if (left.length === right.length) {
    const mismatches = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length <= 1) return true;
    const [first, second] = mismatches;
    return second === first + 1 &&
      left[first] === right[second] && left[second] === right[first];
  }

  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    longIndex += 1;
  }
  return true;
}
