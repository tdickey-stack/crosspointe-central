const CRISIS_PATTERNS = [
  /\bsuicid(?:e|al)\b/,
  /\bkill (?:myself|himself|herself|themselves)\b/,
  /\bend (?:my|their|his|her) life\b/,
  /\bself[- ]?harm\b/,
  /\bhurt (?:myself|himself|herself|themselves)\b/,
  /\boverdose\b/,
  /\bmental[- ]?health crisis\b/,
  /\bsubstance[- ]?use crisis\b/,
  /\bimmediate (?:physical )?danger\b/,
  /\bcredible threat\b/,
  /\babuse (?:is )?(?:happening|occurring) (?:now|right now)\b/,
  /\bchild (?:is )?in (?:immediate )?danger\b/,
];

const PROHIBITED_PATTERNS = [
  /\b(?:my|someone'?s|their) giving record(?:s)?\b/,
  /\b(?:my|someone'?s|their) donation record(?:s)?\b/,
  /\bmember record(?:s)?\b/,
  /\bchild record(?:s)?\b/,
  /\bpastoral (?:note|record)(?:s)?\b/,
  /\bcounseling (?:note|record)(?:s)?\b/,
  /\bchurch discipline\b/,
  /\bcomplaint(?:s)? (?:about|against)\b/,
  /\baccusation(?:s)? (?:about|against)\b/,
  /\bstaff schedule(?:s)?\b/,
  /\binternal (?:policy|policies|procedure|procedures)\b/,
  /\binternal security (?:practice|practices|procedure|procedures)\b/,
  /\b(?:give|provide|offer) (?:me )?legal advice\b/,
  /\b(?:give|provide|offer) (?:me )?medical advice\b/,
  /\b(?:give|provide|offer) (?:me )?financial advice\b/,
  /\b(?:can|will|would) you counsel me\b/,
  /\bongoing counseling\b/,
];

export function classifyWayfinderPolicyQuestion(question) {
  const value = normalize_(question);

  if (matchesAny_(value, CRISIS_PATTERNS)) return "crisis";
  if (matchesAny_(value, PROHIBITED_PATTERNS)) return "prohibited";
  return "knowledge";
}

export function buildWayfinderPolicyAnswer(route, policy) {
  const value = policy && typeof policy === "object" ? policy : {};

  if (route === "crisis") {
    return buildFixedAnswer_(
        route,
        value.crisisPolicy,
        "I'm sorry you're facing this. Wayfinder and CrossPointe do not " +
          "provide crisis intervention. If you or someone else is in " +
          "immediate physical danger, call 911 now. For a mental-health, " +
          "suicide, or substance-use crisis, call or text 988.",
    );
  }

  if (route === "prohibited") {
    return buildFixedAnswer_(
        route,
        value.prohibitedSubjectPolicy,
        "I'm not able to help with private records, personal disputes, " +
          "counseling, professional advice, or internal church matters.",
    );
  }

  if (route === "prayer") {
    const prayerPolicy = value.prayerPolicy || {};
    const form = prayerPolicy.prayerRequestForm || {};
    return {
      route: route,
      responseMode: "guided",
      answer: "CrossPointe believes in the power of prayer, and our staff " +
        "meets each week to pray over requests on the church prayer list. " +
        "You can share a request through the Prayer Request Form. If you " +
        "would like to speak with a pastor, email info@crosspointe.tv or " +
        "call or text 405-374-4740.",
      links: isHttpsUrl_(form.url) ? [{
        label: String(form.label || "Prayer Request Form"),
        url: form.url,
      }] : [],
    };
  }

  if (route === "pastoral_care") {
    return {
      route: route,
      responseMode: "guided",
      answer: "CrossPointe has pastors trained in pastoral counseling and " +
        "offers premarital counseling. Pastoral counseling is generally " +
        "limited to a small number of sessions, and CrossPointe is unable " +
        "to provide ongoing counseling. To ask about speaking with a " +
        "pastor, email info@crosspointe.tv or call or text 405-374-4740.",
      links: [],
    };
  }

  return null;
}

export function buildWayfinderUnknownAnswer(policy) {
  const value = policy && typeof policy === "object" ? policy : {};
  return buildFixedAnswer_(
      "unknown",
      value.unknownAnswerPolicy,
      "I'm sorry, but I don't have enough approved information to answer " +
        "that confidently. Please contact the CrossPointe office by " +
        "emailing info@crosspointe.tv or calling or texting 405-374-4740.",
  );
}

export function buildWayfinderLiveSourceAnswer(sourceTypes = []) {
  const needsGroups = Array.isArray(sourceTypes) &&
    sourceTypes.includes("planning_center_groups");
  return {
    route: "live_source_required",
    responseMode: "guided",
    answer: needsGroups ?
      "I can't verify the current Pointe Group directory right now. Please " +
      "use the approved group directory or contact the church office for " +
      "current information." :
      "I can't verify the current Planning Center event schedule right now. " +
      "Please check the CrossPointe events page or contact the church office " +
      "for the latest information.",
    links: needsGroups ? [{
      label: "Pointe Group directory",
      url: "https://www.crosspointe.tv/small-groups",
    }] : [{
      label: "CrossPointe events",
      url: "https://www.crosspointe.tv/events",
    }],
  };
}

function buildFixedAnswer_(route, policySection, fallback) {
  const section = policySection && typeof policySection === "object" ?
    policySection : {};
  const examples = Array.isArray(section.exampleResponses) ?
    section.exampleResponses : [];
  const answer = String(examples[0] || fallback).trim();

  return {
    route: route,
    responseMode: String(section.responseMode || "fixed_safety"),
    answer: answer,
    links: [],
  };
}

function matchesAny_(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function normalize_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isHttpsUrl_(value) {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch (error) {
    return false;
  }
}
