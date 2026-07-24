export const STUDIO_KNOWLEDGE_BASE = deepFreeze_({
  id: "crosspointe-studio-knowledge",
  version: "0.5.0-drive-sourced",
  status: "prototype_normalized_from_authoritative_sources",
  sources: [
    {
      id: "CP-CM-1.3",
      driveFileId: "1wIWv_YE8DdaqHMQcWqqUg8AoUDTZ6KEd",
      label: "CrossPointe Brand & Identity Guidelines",
      sourceType: "application/pdf",
      sourceModifiedAt: "2026-01-29T04:43:23.754Z",
      scope:
        "Logo rules, primary and secondary colors, and typography usage.",
    },
    {
      id: "CP-CM-1.4",
      driveFileId: "1WG1GDTx0Tuf6iKbgp4_K7b-OD-i_m4LGgOFp2HzCGV4",
      label: "Brand Voice & Audience Personas",
      sourceType: "application/vnd.google-apps.document",
      sourceModifiedAt: "2026-06-26T15:17:08.313Z",
      effectiveDate: "2026-07-25",
      scope:
        "Voice axioms, audience personas, application rules, and checklist.",
    },
  ],
  brandVoice: {
    positiveAxioms: [
      {
        id: "loving",
        guidance:
          "People should feel valued, respected, and cared for.",
      },
      {
        id: "stable",
        guidance:
          "Feel calm, dependable, and emotionally mature without hype.",
      },
      {
        id: "authentic",
        guidance:
          "Prefer honest human moments over polished promotional performance.",
      },
      {
        id: "engaging",
        guidance:
          "Feel clear, relational, welcoming, and pleasant.",
      },
      {
        id: "inspiring",
        guidance:
          "When appropriate, suggest hope, belonging, and meaningful purpose.",
      },
    ],
    negativeAxioms: [
      {
        id: "not_exclusive",
        guidance:
          "Welcome people at different points in their faith journey.",
      },
      {
        id: "not_overwhelming",
        guidance:
          "Keep the visual story focused and easy to understand.",
      },
      {
        id: "not_stale",
        guidance:
          "Feel current and natural without trend chasing or forced youth.",
      },
    ],
  },
  visualSystem: {
    logo: {
      clearSpace:
        "Keep surrounding elements at least 50% of the logomark height away.",
      approvedTreatments: [
        "Full color",
        "One color",
        "One color reverse",
        "Full color with approved background",
      ],
      prohibitedChanges: [
        "Do not reposition or redraw the logomark.",
        "Do not use a substitute font.",
        "Do not distort or resize the logo out of proportion.",
        "Do not change official colors.",
      ],
      generationRule:
        "Logo placement is template-owned. Generated imagery must never " +
        "draw, imitate, alter, or reserve a fake CrossPointe logo.",
    },
    typography: {
      primaryFamily: "Montserrat",
      fallbacks: ["Arial", "sans-serif"],
      roles: {
        logo: "Montserrat Bold",
        headingsSubheadingsTaglines: "Montserrat Semi-Bold",
        body: "Montserrat Regular",
        limitedPrintBodyAccent: "Montserrat Light",
      },
      generationRule:
        "Typography is template-owned context. Never render words or type " +
        "inside the generated photograph.",
    },
    palette: {
      primary: {
        crosspointeRed: "#EF3E2D",
        charcoal: "#27272A",
        cyan: "#33BECC",
        white: "#FFFFFF",
      },
      secondary: {
        burgundy: "#64242E",
        blush: "#FAC8C3",
        mint: "#4BC3A7",
        sky: "#4BB8E9",
        indigo: "#5558A6",
      },
      generationRule:
        "Create imagery that can sit naturally beneath charcoal-to-" +
        "transparent " +
        "overlays and intentional accents from the approved palette. Do not " +
        "make a brand color dominate the photograph or simulate a finished " +
        "branded layout.",
    },
  },
  imagery: {
    commonDirection: [
      "Warm, authentic imagery without generic stock-photo polish.",
      "Believable light, materials, environments, and emotionally mature " +
        "warmth.",
      "Favor visual honesty, meaningful detail, and a focused visual story.",
      "Keep requested negative space calm enough for deterministic copy.",
    ],
    peopleDirection: [
      "Use candid documentary photography rather than artificial posing.",
      "Represent a realistic range of ages and backgrounds without tokenism.",
      "Favor genuine interaction, human imperfection, and observable activity.",
      "Use realistic skin, hands, architecture, clothing, and lighting.",
      "Stage people as one relationship-neutral peer group, not as " +
        "couple-like pairs.",
      "Avoid romantic cues, intimate touch, isolated pairs, matched couple " +
        "posing, or symmetrical two-by-two seating.",
    ],
    avoid: [
      "Corporate stock photography, artificial posing, hype, or spectacle.",
      "Megachurch stage clichés unless the creative concept requires a stage.",
      "Visual chaos, extreme saturation, plastic skin, or exaggerated emotion.",
      "Tokenistic representation or demographic stereotypes.",
    ],
  },
  controlledElements: [
    "Do not render logos, church names, ministry names, event names, dates, " +
      "times, addresses, URLs, or QR codes.",
    "Do not render typography, captions, signs, watermarks, or legible text.",
    "When a scene includes packaging, containers, clothing, posters, " +
      "screens, " +
      "or signs, make them completely plain and unbranded with no letters, " +
      "numbers, pseudo-text, or label-like marks.",
    "Do not use celebrity likenesses or recognizable public figures.",
    "Do not caricature an audience persona or infer protected traits.",
    "Do not add gradients, overlays, fades, vignettes, copy panels, frames, " +
      "borders, layout masks, or intentionally washed-out regions.",
    "Create copy space only through natural composition, lighting, depth of " +
      "field, and scene selection.",
    "Do not simulate the final poster, flyer, social graphic, or layout.",
  ],
});

export const STUDIO_AUDIENCE_PERSONAS = deepFreeze_({
  universal: {
    id: "universal",
    label: "General / All Audiences",
    archetype: "Universal",
    posture: "universal",
    summary:
      "Use the general CrossPointe brand voice without persona-specific " +
      "adaptation.",
    communicationNeed:
      "A broadly useful message when no specialized communication need is " +
      "primary.",
    communicationGuidance: [
      "Remain loving, stable, authentic, engaging, and appropriately " +
        "inspiring.",
      "Avoid exclusive, overwhelming, or stale communication.",
    ],
    imageGuidance: [
      "Create a broadly welcoming, clear, natural, and relational mood.",
      "Avoid narrow demographic, lifestyle, or visual-culture assumptions.",
    ],
  },
  new_nancy: {
    id: "new_nancy",
    label: "New Nancy",
    archetype: "The Restorer",
    posture: "reassuring_belonging",
    summary:
      "Personal, hopeful, and belonging-oriented without minimizing " +
      "difficulty.",
    communicationNeed:
      "People seeking restoration, hope, growth, purpose, or belonging.",
    communicationGuidance: [
      "Be personal rather than corporate.",
      "Be encouraging without minimizing the past.",
      "Be hopeful and reassuring.",
      "Invite belonging before asking for commitment.",
      "Celebrate progress, not perfection.",
    ],
    imageGuidance: [
      "Favor gentle visual welcome and restoration over crowd excitement.",
      "Suggest that there is room to arrive imperfectly and belong.",
      "Use gentle warmth without sentimentality or exaggerated reassurance.",
    ],
  },
  caring_carly: {
    id: "caring_carly",
    label: "Caring Carly",
    archetype: "The Stabilizer",
    posture: "practical_stability",
    summary:
      "Offer clear, compassionate, predictable support to someone who " +
      "regularly carries other people's needs while neglecting their own.",
    communicationNeed:
      "People carrying significant responsibilities who may feel stretched, " +
      "overwhelmed, or frustrated and need clarity, stability, compassion, " +
      "and practical support.",
    communicationGuidance: [
      "Be clear and predictable.",
      "Be compassionate without becoming overwhelming.",
      "Provide practical and obvious next steps.",
      "Reduce complexity whenever possible.",
      "Reinforce support without making promises.",
      "Acknowledge the weight of always caring for others without labeling " +
        "or dramatizing the person's emotional state.",
    ],
    imageGuidance: [
      "Use calm visual support, clarity, and steadiness.",
      "Keep the image understandable, grounded, and visually ordered.",
      "Avoid helplessness, crisis imagery, or promises of an outcome.",
      "Do not default to a smiling caregiver, a visibly caring face, or a " +
        "visibly frustrated person because of the mnemonic name.",
      "Translate the posture into relief, room to breathe, support, and " +
        "practical steadiness rather than a prescribed facial expression.",
    ],
  },
  boomer_bill: {
    id: "boomer_bill",
    label: "Boomer Bill",
    archetype: "The Legacy Builder",
    posture: "direct_relational_depth",
    summary:
      "Honest, purposeful, relational, and substantial without overselling.",
    communicationNeed:
      "People who value experience, trust, depth, meaningful contribution, " +
      "and lasting purpose.",
    communicationGuidance: [
      "Be honest and authentic.",
      "Respect experience and wisdom.",
      "Emphasize purpose over programs.",
      "Remain relational instead of promotional.",
      "Never manipulate or oversell.",
    ],
    imageGuidance: [
      "Emphasize continuity, substance, or enduring shared purpose.",
      "Favor material honesty and meaningful depth over polished promotion.",
      "Do not translate legacy into demographic or nostalgia stereotypes.",
    ],
  },
  sooner_sam: {
    id: "sooner_sam",
    label: "Sooner Sam",
    archetype: "The Builder",
    posture: "optimistic_agency",
    summary:
      "Authentic and optimistic, with accessible next steps and real choice.",
    communicationNeed:
      "People navigating options or next steps who want authentic guidance, " +
      "meaningful belonging, and freedom to choose.",
    communicationGuidance: [
      "Prefer authentic language over polished language.",
      "Be optimistic and energetic without becoming forced.",
      "Give the why, not only the what.",
      "Invite instead of pressuring.",
      "Make belonging accessible while preserving choice.",
    ],
    imageGuidance: [
      "Use visual movement, possibility, building, or active contribution.",
      "Feel optimistic without forced excitement.",
      "Preserve agency without pressure, performance, or perfection.",
    ],
  },
  happy_henry: {
    id: "happy_henry",
    label: "Happy Henry",
    archetype: "The Explorer",
    posture: "curious_relevance",
    summary:
      "Gently challenge comfortable self-sufficiency by making faith, " +
      "purpose, and community feel honestly relevant without becoming pushy.",
    communicationNeed:
      "People who are generally content with life's circumstances and may " +
      "wonder why they need God, faith, or church at all.",
    communicationGuidance: [
      "Lead with purpose and relevance.",
      "Answer why before asking for action.",
      "Respect curiosity and honest questions.",
      "Remain authentic and never pushy.",
      "Show value through stories and relationships.",
      "Use gentle challenge rather than assuming felt need, crisis, or " +
        "dissatisfaction.",
    ],
    imageGuidance: [
      "Use discovery, curiosity, or a meaningful visual progression.",
      "Let the image suggest why the moment matters before promotion.",
      "Feel contemporary without forced slang, trend chasing, or spectacle.",
      "Do not default to laughter, celebration, exaggerated happiness, or a " +
        "permanently cheerful person because of the mnemonic name.",
      "A thoughtful, content, or quietly curious mood may be more accurate " +
        "than a visibly happy expression.",
    ],
  },
});

export const STUDIO_AUDIENCE_GENDER_OPTIONS = deepFreeze_({
  unspecified: {
    id: "unspecified",
    label: "All / Unspecified",
    description:
      "Use the event request and persona without an additional gender-based " +
      "audience emphasis.",
    promptRules: [
      "Do not invent gender-specific assumptions.",
      "Never derive gender from the persona's mnemonic name.",
    ],
  },
  male: {
    id: "male",
    label: "Men",
    description:
      "Shape the concept to resonate with men as the intended audience while " +
      "keeping the selected persona gender-neutral.",
    promptRules: [
      "Use gender as creative-strategy context, not as a cast requirement.",
      "Let the event request and persona determine the setting, symbolism, " +
        "energy, and emotional depth.",
      "Do not assume hobbies, occupations, colors, interests, emotional " +
        "range, or visual clichés merely because the audience is men.",
    ],
  },
  female: {
    id: "female",
    label: "Women",
    description:
      "Shape the concept to resonate with women as the intended audience " +
      "while keeping the selected persona gender-neutral.",
    promptRules: [
      "Use gender as creative-strategy context, not as a cast requirement.",
      "Let the event request and persona determine the setting, symbolism, " +
        "energy, and emotional depth.",
      "Do not assume hobbies, occupations, colors, interests, emotional " +
        "range, or visual clichés merely because the audience is women.",
    ],
  },
  mixed: {
    id: "mixed",
    label: "Men and Women",
    description:
      "Shape the concept for an audience of men and women without dividing " +
      "the creative direction into gender-coded halves.",
    promptRules: [
      "Use gender as creative-strategy context, not as a cast requirement.",
      "Seek broad relevance without assigning different colors, interests, " +
        "roles, or emotions by gender.",
    ],
  },
});

export const STUDIO_VISUAL_APPROACHES = deepFreeze_({
  auto: {
    id: "auto",
    label: "Let Studio Decide",
    description:
      "Choose the strongest people, scenery, abstract, or object-led " +
      "approach " +
      "for the creative concept.",
    promptRules: [
      "Choose the most effective visual subject for the concept.",
      "People are optional, not preferred or required.",
    ],
  },
  people: {
    id: "people",
    label: "People / Community",
    description:
      "Use candid human activity, interaction, or community as the visual " +
      "focus.",
    promptRules: [
      "People may be the primary visual focus.",
      "Use candid documentary realism and natural, unforced interaction.",
    ],
  },
  scenery: {
    id: "scenery",
    label: "Scenery / Environment",
    description:
      "Use landscape, weather, architecture, or an environment without people.",
    promptRules: [
      "Do not include any people, faces, silhouettes, crowds, or human " +
        "figures.",
      "Let landscape, architecture, light, weather, or environment carry " +
        "meaning.",
    ],
  },
  abstract: {
    id: "abstract",
    label: "Abstract / Atmospheric",
    description:
      "Use light, color, texture, shape, or motion without a literal human " +
      "scene.",
    promptRules: [
      "Do not include people, faces, silhouettes, bodies, or human figures.",
      "Use sophisticated light, color, texture, shape, depth, or motion.",
      "Avoid generic corporate gradients, clip art, icons, or wallpaper " +
        "patterns.",
    ],
  },
  objects: {
    id: "objects",
    label: "Objects / Still Life",
    description:
      "Use meaningful unbranded objects or still-life symbolism without " +
      "people.",
    promptRules: [
      "Do not include people, faces, hands, silhouettes, or human figures.",
      "Use a restrained, meaningful still life with believable materials.",
      "All objects must remain completely unbranded and free of text.",
    ],
  },
});

export function getStudioAudiencePersonaOptions() {
  return Object.values(STUDIO_AUDIENCE_PERSONAS).map((persona) => ({
    value: persona.id,
    label: persona.id === "universal" ?
      persona.label :
      `${persona.label} — ${persona.archetype}`,
    description: persona.summary,
  }));
}

export function getStudioVisualApproachOptions() {
  return Object.values(STUDIO_VISUAL_APPROACHES).map((approach) => ({
    value: approach.id,
    label: approach.label,
    description: approach.description,
  }));
}

export function getStudioAudienceGenderOptions() {
  return Object.values(STUDIO_AUDIENCE_GENDER_OPTIONS).map((option) => ({
    value: option.id,
    label: option.label,
    description: option.description,
  }));
}

function deepFreeze_(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach((child) => deepFreeze_(child));
  return Object.freeze(value);
}
