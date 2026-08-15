const REQUIRED = "required";
const OPTIONAL = "optional";
const AVAILABLE = "as-available";

function play(
  id,
  playType,
  dayOfWeek,
  channel,
  resourceId,
  options = {},
) {
  return {
    id,
    playType,
    dayOfWeek,
    eligibleWeekdays: options.eligibleWeekdays || [dayOfWeek],
    channel,
    resourceId,
    requirement: options.requirement || REQUIRED,
    supportsSmuggle: options.supportsSmuggle === true,
    lateBehavior: options.lateBehavior || "SKIP",
    maxPlacementsPerCampaignPerWeek: options.maxPlacementsPerCampaignPerWeek || 1,
  };
}

function week(weekNumber, phase, label, plays) {
  return {weekNumber, phase, label, plays};
}

const stage = (id, options) =>
  play(id, "Stage Announcement", 0, "Sunday / Stage", "stage-announcement", options);
const slide = (id, options) =>
  play(id, "Pre-Service Slide", 0, "Sunday / Screens", "pre-service-slide", options);
const bulletin = (id, options) =>
  play(id, "Weekly Bulletin Mention", 0, "Weekly Bulletin", "weekly-bulletin", options);
const social = (id, day = 2, options) =>
  play(id, "Social Media Sprinkle", day, "Social Media", "social-sprinkle", {
    lateBehavior: "NEXT_AVAILABLE_SLOT",
    ...options,
  });
const newsletterFeature = (id, options) =>
  play(id, "Newsletter Feature", 3, "Newsletter", "newsletter-feature", {
    lateBehavior: "MANUAL_REVIEW",
    ...options,
  });
const newsletterCard = (id, options) =>
  play(id, "Newsletter Event Card", 3, "Newsletter", "newsletter-event-card", {
    lateBehavior: "MANUAL_REVIEW",
    ...options,
  });
const email = (id, day = 2, options) =>
  play(id, "Email", day, "Email", "email", {requirement: OPTIONAL, ...options});
const text = (id, day = 2, options) =>
  play(id, "Text Message", day, "Text", "text-message", {requirement: OPTIONAL, ...options});
const ministrySocial = (id, options) =>
  play(id, "Ministry Social Sprinkle", 2, "Ministry Social", "ministry-social", {
    lateBehavior: "NEXT_AVAILABLE_SLOT",
    ...options,
  });
const ministryEmail = (id, options) =>
  play(id, "Ministry Email", 2, "Ministry Email", "ministry-email", {
    requirement: OPTIONAL,
    ...options,
  });
const ministryText = (id, options) =>
  play(id, "Ministry Text", 2, "Ministry Text", "ministry-text", {
    requirement: OPTIONAL,
    ...options,
  });
const crossPost = (id, options) =>
  play(id, "Cross-Post to Main Account", 2, "Main Social", "main-social-crosspost", options);
const level4Social = (id) =>
  play(id, "Social Media Sprinkle", 1, "Social Media", "level-4-social", {
    eligibleWeekdays: [1, 5],
    requirement: AVAILABLE,
    lateBehavior: "NEXT_AVAILABLE_SLOT",
  });

function defaults(level, campaignType) {
  const base = [
    play("central-listing", "Central Listing", 0, "Central", "central-listing", {
      lateBehavior: "NEXT_AVAILABLE_SLOT",
    }),
  ];
  if (level <= 2 || (level === 3 && campaignType === "featured")) {
    base.push(play("homepage-feature", "Homepage Featured Event", 0, "Website", "homepage-feature", {
      lateBehavior: "MANUAL_REVIEW",
    }));
  }
  if (level >= 2) {
    base.push(play("events-page", "Website Events Page Feature", 0, "Website", "events-page", {
      lateBehavior: "NEXT_AVAILABLE_SLOT",
    }));
  }
  if (level <= 3) {
    base.push(play("welcome-center", "Welcome Center Resources", 0, "Welcome Center", "welcome-center", {
      lateBehavior: "MANUAL_REVIEW",
    }));
  }
  return base;
}

export const STARTER_PLAYBOOKS = [
  {
    id: "level-1-major",
    level: 1,
    name: "Level 1 Major Campaign",
    campaignType: "major",
    durationWeeks: 8,
    version: 1,
    active: true,
    description: "Eight-week Awareness, Interest, and Urgency campaign for church-wide events.",
    weeks: [
      week(1, "Awareness", "Launch Campaign", [
        ...defaults(1, "major"), stage("w1-stage"), slide("w1-slide"), bulletin("w1-bulletin"),
        play("w1-launch-email", "Church-Wide Launch Email", 2, "Email", "email"),
        play("w1-church-text", "Church-Wide Text", 2, "Text", "text-message", {requirement: OPTIONAL}),
        social("w1-social"),
      ]),
      week(2, "Awareness", "Maintain Awareness", [slide("w2-slide"), bulletin("w2-bulletin")]),
      week(3, "Awareness", "Reinforce Awareness", [
        stage("w3-stage"), slide("w3-slide"), bulletin("w3-bulletin"), social("w3-social"),
        email("w3-email"), text("w3-text"),
      ]),
      week(4, "Awareness", "Push Awareness", [
        stage("w4-stage"), slide("w4-slide"), bulletin("w4-bulletin"), social("w4-social"),
      ]),
      week(5, "Interest", "Shift to Interest", [
        stage("w5-stage"), slide("w5-slide"), bulletin("w5-bulletin"),
      ]),
      week(6, "Interest", "Reinforce Interest", [
        stage("w6-stage"), slide("w6-slide"), bulletin("w6-bulletin"), social("w6-social"),
        email("w6-email"), text("w6-text"),
      ]),
      week(7, "Interest", "Reinforce Interest", [
        stage("w7-stage"), slide("w7-slide"), bulletin("w7-bulletin"), social("w7-social"),
        email("w7-email"), text("w7-text"),
      ]),
      week(8, "Urgency", "Sprint", [
        stage("w8-stage"), slide("w8-slide"), bulletin("w8-bulletin"),
        play("w8-floating-banner", "Publish Floating Web Banner", 0, "Website", "floating-web-banner"),
        ...[1, 2, 3, 4, 5, 6].flatMap((day) => [
          play(`w8-social-${day}`, "Social Post", day, "Social Media", "social-sprint", {requirement: OPTIONAL}),
          play(`w8-email-${day}`, "Email", day, "Email", "email", {requirement: OPTIONAL}),
          play(`w8-text-${day}`, "Text Message", day, "Text", "text-message", {requirement: OPTIONAL}),
        ]),
      ]),
    ],
  },
  {
    id: "level-2-event",
    level: 2,
    name: "Level 2 Event-Based",
    campaignType: "event-based",
    durationWeeks: 6,
    version: 1,
    active: true,
    description: "Six-week Awareness and Interest campaign for formation and next-step events.",
    weeks: [
      week(1, "Awareness", "Launch Awareness", [
        ...defaults(2, "event-based"), stage("w1-stage"), slide("w1-slide"), bulletin("w1-bulletin"),
        social("w1-social", 4, {supportsSmuggle: true}),
      ]),
      week(2, "Awareness", "Reinforce Awareness", [
        slide("w2-slide"), bulletin("w2-bulletin"), newsletterFeature("w2-newsletter"),
      ]),
      week(3, "Awareness", "Reinforce Awareness", [
        stage("w3-stage"), slide("w3-slide"), bulletin("w3-bulletin"),
        social("w3-social", 4, {supportsSmuggle: true}),
      ]),
      week(4, "Interest", "Shift to Interest", [
        stage("w4-stage", {supportsSmuggle: true}), slide("w4-slide"), bulletin("w4-bulletin"),
        email("w4-email", 1), text("w4-text", 1), social("w4-social", 4, {supportsSmuggle: true}),
      ]),
      week(5, "Interest", "Build Interest", [
        slide("w5-slide"), bulletin("w5-bulletin"), newsletterFeature("w5-newsletter"),
        social("w5-social", 4, {requirement: OPTIONAL, supportsSmuggle: true}),
      ]),
      week(6, "Interest", "Leverage Interest", [
        stage("w6-stage", {supportsSmuggle: true}), slide("w6-slide"), bulletin("w6-bulletin"),
        email("w6-email", 1), text("w6-text", 1), newsletterFeature("w6-newsletter", {requirement: OPTIONAL}),
        social("w6-social", 4, {supportsSmuggle: true}),
      ]),
    ],
  },
  {
    id: "level-2-ongoing-awareness",
    level: 2,
    name: "Level 2 Ongoing Awareness",
    campaignType: "ongoing-awareness",
    durationWeeks: 1,
    version: 1,
    active: true,
    description: "Recurring weekly awareness lane when no Level 2 event campaign occupies the week.",
    weeks: [week(1, "Awareness", "Awareness Play", [
      slide("awareness-slide"), bulletin("awareness-bulletin"),
      newsletterFeature("awareness-newsletter"),
      social("awareness-social", 4, {requirement: OPTIONAL, supportsSmuggle: true}),
    ])],
  },
  {
    id: "level-2-ongoing-interest",
    level: 2,
    name: "Level 2 Ongoing Interest",
    campaignType: "ongoing-interest",
    durationWeeks: 1,
    version: 1,
    active: true,
    description: "Recurring weekly interest lane with optional direct-response plays.",
    weeks: [week(1, "Interest", "Interest Play", [
      stage("interest-stage", {supportsSmuggle: true}), slide("interest-slide"),
      bulletin("interest-bulletin"), email("interest-email", 1), text("interest-text", 1),
      newsletterFeature("interest-newsletter", {requirement: OPTIONAL}),
      social("interest-social", 4, {requirement: OPTIONAL, supportsSmuggle: true}),
    ])],
  },
  {
    id: "level-3-featured",
    level: 3,
    name: "Level 3 Featured",
    campaignType: "featured",
    durationWeeks: 6,
    version: 1,
    active: true,
    description: "Six-week church-supported NextGen campaign.",
    weeks: [
      week(1, "Awareness", "Launch Awareness", [...defaults(3, "featured"), stage("w1-stage"), slide("w1-slide"), bulletin("w1-bulletin"), ministrySocial("w1-social"), ministryEmail("w1-email"), ministryText("w1-text")]),
      week(2, "Awareness", "Reinforce Awareness", [slide("w2-slide"), bulletin("w2-bulletin"), ministrySocial("w2-social"), newsletterFeature("w2-newsletter")]),
      week(3, "Awareness", "Emphasize Awareness", [stage("w3-stage"), slide("w3-slide"), bulletin("w3-bulletin"), ministrySocial("w3-social"), crossPost("w3-crosspost"), ministryEmail("w3-email"), ministryText("w3-text")]),
      week(4, "Interest", "Shift to Interest", [stage("w4-stage"), slide("w4-slide"), bulletin("w4-bulletin"), ministrySocial("w4-social"), ministryEmail("w4-email"), ministryText("w4-text")]),
      week(5, "Interest", "Reinforce Interest", [slide("w5-slide"), bulletin("w5-bulletin"), ministrySocial("w5-social"), newsletterFeature("w5-newsletter"), ministryEmail("w5-email"), ministryText("w5-text")]),
      week(6, "Interest", "Leverage Interest", [stage("w6-stage"), slide("w6-slide"), bulletin("w6-bulletin"), ministrySocial("w6-social"), newsletterFeature("w6-newsletter", {requirement: OPTIONAL}), crossPost("w6-crosspost")]),
    ],
  },
  {
    id: "level-3-standard",
    level: 3,
    name: "Level 3 Standard",
    campaignType: "standard",
    durationWeeks: 3,
    version: 1,
    active: true,
    description: "Focused three-week ministry-specific NextGen campaign.",
    weeks: [
      week(1, "Awareness", "Launch Awareness", [...defaults(3, "standard"), stage("w1-stage"), slide("w1-slide"), bulletin("w1-bulletin"), ministrySocial("w1-social"), ministryEmail("w1-email"), ministryText("w1-text")]),
      week(2, "Interest", "Shift to Interest", [slide("w2-slide"), bulletin("w2-bulletin"), ministrySocial("w2-social", {requirement: OPTIONAL}), newsletterFeature("w2-newsletter", {requirement: OPTIONAL}), ministryEmail("w2-email"), ministryText("w2-text")]),
      week(3, "Interest", "Leverage Interest", [stage("w3-stage"), slide("w3-slide"), bulletin("w3-bulletin"), ministrySocial("w3-social"), ministryEmail("w3-email", {requirement: REQUIRED}), ministryText("w3-text", {requirement: REQUIRED}), crossPost("w3-crosspost")]),
    ],
  },
  {
    id: "level-4-featured",
    level: 4,
    name: "Level 4 Featured",
    campaignType: "featured",
    durationWeeks: 4,
    version: 1,
    active: true,
    description: "Four-week campaign for broad ministry and community events.",
    weeks: [
      week(1, "Awareness", "Launch Awareness", [...defaults(4, "featured"), stage("w1-stage", {requirement: AVAILABLE}), slide("w1-slide"), bulletin("w1-bulletin"), level4Social("w1-social"), newsletterCard("w1-newsletter", {requirement: AVAILABLE})]),
      week(2, "Awareness", "Reinforce Awareness", [slide("w2-slide"), bulletin("w2-bulletin"), level4Social("w2-social"), newsletterFeature("w2-newsletter")]),
      week(3, "Interest", "Shift to Interest", [slide("w3-slide"), bulletin("w3-bulletin"), level4Social("w3-social"), newsletterFeature("w3-newsletter")]),
      week(4, "Interest", "Leverage Interest", [stage("w4-stage", {requirement: AVAILABLE}), slide("w4-slide"), bulletin("w4-bulletin"), level4Social("w4-social"), newsletterCard("w4-newsletter", {requirement: AVAILABLE})]),
    ],
  },
  {
    id: "level-4-standard",
    level: 4,
    name: "Level 4 Standard",
    campaignType: "standard",
    durationWeeks: 2,
    version: 1,
    active: true,
    description: "Repeatable two-week Interest campaign for focused events.",
    weeks: [1, 2].map((number) => week(number, "Interest", number === 1 ? "Build Interest" : "Clear Invitation", [
      ...(number === 1 ? defaults(4, "standard") : []),
      stage(`w${number}-stage`, {requirement: AVAILABLE}),
      slide(`w${number}-slide`, {requirement: OPTIONAL}),
      bulletin(`w${number}-bulletin`),
      level4Social(`w${number}-social`),
      newsletterCard(`w${number}-newsletter`, {requirement: AVAILABLE}),
    ])),
  },
  {
    id: "level-5-interest",
    level: 5,
    name: "Level 5 Interest Window",
    campaignType: "interest",
    durationWeeks: 2,
    version: 1,
    active: true,
    description: "Up to two weeks of personal, discoverable, as-available visibility.",
    weeks: [1, 2].map((number) => week(number, "Interest", "Maintain Interest", [
      ...(number === 1 ? [
        play("central-listing", "Central Listing", 0, "Central", "central-listing"),
        play("events-page", "Website Events Page Listing", 0, "Website", "events-page"),
      ] : []),
      bulletin(`w${number}-bulletin`, {requirement: AVAILABLE}),
      newsletterCard(`w${number}-newsletter`, {requirement: AVAILABLE}),
    ])),
  },
];

export const STARTER_CAPACITY_RULES = [
  {
    id: "stage-announcement",
    name: "Stage Announcements",
    channel: "Sunday / Stage",
    capacity: 3,
    typicalCapacity: 3,
    capacityPeriod: "sunday",
    allowedWeekdays: [0],
    perCampaignMaximum: 1,
    eligibleLevels: [1, 2, 3, 4],
    autoResolve: false,
    supportsSmuggle: true,
    allocationStrategy: "priority-recommendation",
    showOnDashboard: true,
    active: true,
  },
  {
    id: "newsletter-feature",
    name: "Newsletter Feature",
    channel: "Newsletter",
    capacity: 1,
    typicalCapacity: 1,
    capacityPeriod: "week",
    allowedWeekdays: [3],
    perCampaignMaximum: 1,
    eligibleLevels: [1, 2, 3, 4],
    autoResolve: false,
    supportsSmuggle: false,
    allocationStrategy: "creative-decision",
    showOnDashboard: true,
    active: true,
  },
  {
    id: "newsletter-event-card",
    name: "Newsletter Event Cards",
    channel: "Newsletter",
    capacity: 6,
    typicalCapacity: 4,
    capacityPeriod: "week",
    allowedWeekdays: [3],
    perCampaignMaximum: 1,
    eligibleLevels: [4, 5],
    autoResolve: false,
    supportsSmuggle: false,
    allocationStrategy: "creative-decision",
    showOnDashboard: true,
    active: true,
  },
  {
    id: "level-4-social",
    name: "Level 4 Social",
    channel: "Social Media",
    capacity: 2,
    typicalCapacity: 2,
    capacityPeriod: "week",
    allowedWeekdays: [1, 5],
    perCampaignMaximum: 1,
    eligibleLevels: [4],
    autoResolve: true,
    supportsSmuggle: true,
    allocationStrategy: "level-4-constrained-slot",
    showOnDashboard: true,
    active: true,
  },
];

export const STARTER_STANDING_LANES = [
  {
    id: "level-2-weekly",
    name: "Level 2 Weekly Presence",
    level: 2,
    cadence: "weekly",
    fallbackPlaybookId: "level-2-ongoing-awareness",
    priorityOrder: ["event-campaign", "ongoing", "smuggle"],
    eligibleSmuggleLevels: [4, 5],
    active: true,
  },
];

export const STARTER_PLAYBOOK_IDS = STARTER_PLAYBOOKS.map((playbook) => playbook.id);

export function isStarterPlaybookId(playbookId) {
  return STARTER_PLAYBOOK_IDS.includes(String(playbookId || ""));
}

export function cloneStarterData() {
  return JSON.parse(JSON.stringify({
    playbooks: STARTER_PLAYBOOKS,
    capacityRules: STARTER_CAPACITY_RULES,
    standingLanes: STARTER_STANDING_LANES,
  }));
}
