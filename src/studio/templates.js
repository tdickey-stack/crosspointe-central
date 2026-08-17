export const STUDIO_STORAGE_KEY = "crosspointeStudioProjectsV1";
export const DOCUMENT_PROJECT_TEMPLATE_ID = "document-project";
export const LEGACY_POLICY_TEMPLATE_ID = "policy-document";
export const SOCIAL_SIMPLE_STATEMENT_TEMPLATE_ID = "social-simple-statement";
export const MAX_SOCIAL_CAROUSEL_SLIDES = 6;

export const BRAND_COLOR_OPTIONS = [
  {value: "red", label: "CrossPointe Red", hex: "#EF3E2D", ink: "light"},
  {value: "cyan", label: "CrossPointe Cyan", hex: "#33BECC", ink: "dark"},
  {value: "charcoal", label: "Charcoal", hex: "#27272A", ink: "light"},
  {value: "white", label: "White", hex: "#FFFFFF", ink: "dark"},
  {value: "sky", label: "Sky Blue", hex: "#4BB8E9", ink: "dark"},
  {value: "purple", label: "Purple", hex: "#5558A6", ink: "light"},
  {value: "mint", label: "Mint", hex: "#4BC3A7", ink: "dark"},
  {value: "burgundy", label: "Burgundy", hex: "#64242E", ink: "light"},
  {value: "blush", label: "Blush", hex: "#FAC8C3", ink: "dark"},
  {value: "cream", label: "Warm Cream", hex: "#F7F3E7", ink: "dark"},
];

export const EVENT_PALETTE_OPTIONS = [
  {
    value: "charcoal-red",
    label: "Charcoal + CrossPointe Red",
    ink: "light",
  },
  {
    value: "blue-charcoal",
    label: "Blue + Charcoal",
    ink: "light",
  },
  {
    value: "warm-light",
    label: "Warm Editorial Light",
    ink: "dark",
  },
  {
    value: "paper-red",
    label: "Paper + CrossPointe Red",
    ink: "dark",
  },
  {
    value: "sky-mint",
    label: "Sky + Mint Light",
    ink: "dark",
  },
  {
    value: "blush-burgundy",
    label: "Blush + Burgundy Light",
    ink: "dark",
  },
];

export const GRAPHIC_BRAND_MARK_OPTIONS = [
  {value: "central", label: "CrossPointe Central"},
  {value: "heart", label: "CrossPointe Heart"},
  {value: "full", label: "CrossPointe Full Logo"},
];

export const GRAPHIC_BRAND_COLOR_OPTIONS = [
  {value: "auto", label: "Auto Contrast"},
  {value: "white", label: "White"},
  {value: "charcoal", label: "Dark Grey"},
  {value: "red", label: "CrossPointe Red"},
];

export const GRAPHIC_FONT_WEIGHT_OPTIONS = [
  {value: "template", label: "Template Default", weight: null},
  {value: "thin", label: "Thin", weight: 100},
  {value: "light", label: "Light", weight: 300},
  {value: "medium", label: "Medium", weight: 500},
  {value: "bold", label: "Bold", weight: 700},
  {value: "black", label: "Black / Extra Bold", weight: 900},
];

const EVENT_FONT_LIBRARY = {
  montserrat: {value: "montserrat", label: "Montserrat", family: "Montserrat"},
  "league-spartan": {
    value: "league-spartan",
    label: "League Spartan",
    family: "League Spartan",
  },
  "google-sans": {
    value: "google-sans",
    label: "Google Sans",
    family: "Google Sans Flex",
  },
  "bebas-neue": {
    value: "bebas-neue",
    label: "Bebas Neue",
    family: "Bebas Neue",
  },
  "league-gothic": {
    value: "league-gothic",
    label: "League Gothic",
    family: "League Gothic",
  },
  "science-gothic": {
    value: "science-gothic",
    label: "Science Gothic",
    family: "Science Gothic",
  },
  unbounded: {value: "unbounded", label: "Unbounded", family: "Unbounded"},
  "bodoni-moda": {
    value: "bodoni-moda",
    label: "Bodoni Moda",
    family: "Bodoni Moda",
  },
  forum: {value: "forum", label: "Forum", family: "Forum"},
  niconne: {value: "niconne", label: "Niconne", family: "Niconne"},
  "eb-garamond": {
    value: "eb-garamond",
    label: "EB Garamond",
    family: "EB Garamond",
  },
};

const EVENT_COMPOSITION_LIBRARY = {
  editorial: {value: "editorial", label: "Editorial Orbit"},
  signal: {value: "signal", label: "Central Signal"},
  split: {value: "split", label: "Structured Split"},
  "rally-stripes": {value: "rally-stripes", label: "Rally Stripes"},
  "rally-frame": {value: "rally-frame", label: "Stage Frame"},
  "future-grid": {value: "future-grid", label: "Future Grid"},
  "future-cut": {value: "future-cut", label: "Forward Cut"},
  "editorial-frame": {
    value: "editorial-frame",
    label: "Invitation Frame",
  },
  "editorial-flow": {value: "editorial-flow", label: "Editorial Flow"},
  "editorial-column": {value: "editorial-column", label: "Story Column"},
  "welcome-halo": {value: "welcome-halo", label: "Welcome Halo"},
  "welcome-arch": {value: "welcome-arch", label: "Hospitality Arch"},
  "welcome-ribbons": {value: "welcome-ribbons", label: "Welcome Ribbons"},
  "center-burst": {value: "center-burst", label: "Center Burst"},
  "center-frame": {value: "center-frame", label: "Center Frame"},
  "serif-medallion": {value: "serif-medallion", label: "Serif Medallion"},
  "serif-lines": {value: "serif-lines", label: "Editorial Lines"},
  "color-overlay": {value: "color-overlay", label: "Color Overlay"},
  flat: {value: "flat", label: "Flat / No Overlay"},
  "groups-gradient": {
    value: "groups-gradient",
    label: "Pointe Groups Gradient",
  },
};

const documentTemplate = ({
  id,
  name,
  shortName,
  description,
  variant,
  status = "Ready",
}) => ({
  id,
  name,
  shortName,
  description,
  formats: ["US Letter"],
  status,
  accent: "red",
  kind: "document",
  variant,
});

const eventTemplate = ({
  id,
  name,
  shortName,
  description,
  variant,
  fonts,
  compositions,
  defaultFont,
  previewCopy,
  defaults = {},
  accent = "blue",
  titleFitLines = 2,
  titleFitMinScale = 0.56,
}) => ({
  id,
  name,
  shortName,
  description,
  formats: ["1:1", "4:5", "16:9"],
  status: "Ready",
  accent,
  kind: "event",
  variant,
  fonts: fonts.map((font) => EVENT_FONT_LIBRARY[font]),
  compositions: compositions.map(
    (composition) => EVENT_COMPOSITION_LIBRARY[composition],
  ),
  defaultFont,
  previewCopy,
  defaults,
  titleFitLines,
  titleFitMinScale,
});

const socialTemplate = ({
  id,
  name,
  shortName,
  description,
  variant,
  fonts,
  compositions,
  defaultFont,
  previewCopy,
  defaults = {},
  accent = "red",
}) => ({
  id,
  name,
  shortName,
  description,
  formats: ["1:1", "4:5"],
  status: "Ready",
  accent,
  kind: "social",
  variant,
  fonts: fonts.map((font) => EVENT_FONT_LIBRARY[font]),
  compositions: compositions.map(
    (composition) => EVENT_COMPOSITION_LIBRARY[composition],
  ),
  defaultFont,
  previewCopy,
  defaults: {
    eyebrow: previewCopy.eyebrow || "",
    title: previewCopy.title || "",
    subtitle: previewCopy.subtitle || "",
    date: "",
    time: "",
    location: "",
    cta: previewCopy.footer || "",
    heroMode: "text",
    heroLogo: "",
    heroLogoSource: "",
    heroLogoLibraryId: "",
    heroLogoStoragePath: "",
    heroLogoName: "",
    ...defaults,
  },
});

const graphicDocumentTemplate = ({
  id,
  name,
  shortName,
  description,
  variant,
  fonts,
  compositions,
  defaultFont,
  previewCopy,
  defaults = {},
  accent = "mint",
}) => ({
  id,
  name,
  shortName,
  description,
  formats: ["16:9"],
  status: "Ready",
  accent,
  kind: "document",
  editorKind: "graphic",
  variant,
  fonts: fonts.map((font) => EVENT_FONT_LIBRARY[font]),
  compositions: compositions.map(
    (composition) => EVENT_COMPOSITION_LIBRARY[composition],
  ),
  defaultFont,
  previewCopy,
  defaults,
});

export const DOCUMENT_PAGE_TEMPLATES = [
  documentTemplate({
    id: "document-one-pager",
    name: "One Pager",
    shortName: "One Pager",
    description:
      "A structured one-page guide for SOPs, policies, playbooks, and ministry standards.",
    variant: "one-pager",
  }),
  documentTemplate({
    id: "document-checklist",
    name: "Checklist",
    shortName: "Checklist",
    description:
      "A practical, printable checklist with grouped tasks, guidance, and a branded callout.",
    variant: "checklist",
  }),
  documentTemplate({
    id: "document-signup-sheet",
    name: "Sign-Up Sheet",
    shortName: "Sign-Up",
    description:
      "A printable registration sheet with customizable columns and a controlled number of sign-up lines.",
    variant: "signup-sheet",
  }),
  documentTemplate({
    id: "document-directory",
    name: "Directory",
    shortName: "Directory",
    description:
      "A card-based directory for groups, ministries, staff, or other collections with photos and key details.",
    variant: "directory",
  }),
  documentTemplate({
    id: "document-content-page",
    name: "Branded Content Page",
    shortName: "Content",
    description:
      "A flexible branded page for headings, paragraphs, lists, callouts, and supporting copy.",
    variant: "content-page",
  }),
];

export const TEMPLATE_CATALOG = [
  ...DOCUMENT_PAGE_TEMPLATES,
  graphicDocumentTemplate({
    id: "document-small-group-leader",
    name: "Small Group Leader",
    shortName: "Group Leader",
    description:
      "A 16:9 Small Group Directory graphic with fixed leader details, Pointe Groups artwork, and an optional leader photo background.",
    variant: "small-group-leader",
    fonts: ["montserrat", "league-spartan", "google-sans"],
    compositions: ["groups-gradient"],
    defaultFont: "montserrat",
    previewCopy: {
      eyebrow: "POINTE GROUPS",
      title: "Ladies Sunday School",
      subtitle: "Led by Terri & Debbie",
      date: "SUNDAYS",
      time: "10:30 AM–12:00 PM",
      location: "ROOM 203",
      footer: "FIND YOUR PLACE",
    },
    defaults: {
      eyebrow: "POINTE GROUPS",
      title: "Ladies Sunday School",
      subtitle: "Led by Terri & Debbie",
      date: "SUNDAYS",
      time: "10:30 AM–12:00 PM",
      location: "ROOM 203",
      cta: "FIND YOUR PLACE",
      format: "screen",
      composition: "groups-gradient",
      palette: "sky-mint",
      textAlignment: "right",
      brandMark: "central",
      brandColor: "white",
    },
  }),
  socialTemplate({
    id: "social-scripture",
    name: "Scripture Focus",
    shortName: "Scripture",
    description:
      "A spacious scripture post with a clear reference, restrained decoration, and fixed CrossPointe branding.",
    variant: "social-scripture",
    fonts: ["eb-garamond", "bodoni-moda", "montserrat"],
    compositions: [
      "serif-lines",
      "serif-medallion",
      "color-overlay",
      "flat",
    ],
    defaultFont: "eb-garamond",
    previewCopy: {
      eyebrow: "SCRIPTURE",
      title: "Be still, and know that I am God.",
      subtitle: "PSALM 46:10",
      footer: "",
    },
    defaults: {
      composition: "serif-lines",
      palette: "warm-light",
      textAlignment: "left",
    },
    accent: "purple",
  }),
  socialTemplate({
    id: "social-quote",
    name: "Quote Card",
    shortName: "Quote",
    description:
      "A simple quote-led composition with room for an attribution and quiet CrossPointe presence.",
    variant: "social-quote",
    fonts: ["bodoni-moda", "forum", "montserrat"],
    compositions: [
      "editorial-frame",
      "editorial-flow",
      "color-overlay",
      "flat",
    ],
    defaultFont: "bodoni-moda",
    previewCopy: {
      eyebrow: "A CROSSPOINTE VALUE",
      title: "People matter to God, so people matter to us.",
      subtitle: "WHO WE ARE",
      footer: "",
    },
    defaults: {
      composition: "editorial-frame",
      palette: "blush-burgundy",
      textAlignment: "center",
    },
    accent: "red",
  }),
  socialTemplate({
    id: "social-statement",
    name: "Bold Statement",
    shortName: "Bold",
    description:
      "A bold, minimal post for reminders, campaign phrases, and short ministry messages.",
    variant: "social-statement",
    fonts: ["league-spartan", "google-sans", "montserrat"],
    compositions: [
      "center-burst",
      "center-frame",
      "color-overlay",
      "flat",
    ],
    defaultFont: "league-spartan",
    previewCopy: {
      eyebrow: "A SIMPLE REMINDER",
      title: "YOU ARE NOT ALONE.",
      subtitle: "There is a place for you here.",
      footer: "",
    },
    defaults: {
      composition: "center-frame",
      palette: "paper-red",
      textAlignment: "center",
    },
    accent: "mint",
  }),
  socialTemplate({
    id: SOCIAL_SIMPLE_STATEMENT_TEMPLATE_ID,
    name: "Simple Statement",
    shortName: "Simple",
    description:
      "Centered text or a custom hero logo on a clean color background with quiet CrossPointe branding.",
    variant: "simple-statement",
    fonts: ["montserrat", "league-spartan", "google-sans"],
    compositions: ["flat"],
    defaultFont: "montserrat",
    previewCopy: {
      eyebrow: "",
      title: "being around people\nisn’t the same as being known",
      subtitle: "",
      footer: "",
    },
    defaults: {
      composition: "flat",
      flatColor: "cream",
      palette: "warm-light",
      textAlignment: "center",
      fontWeight: "bold",
      brandMark: "full",
      brandColor: "charcoal",
    },
    accent: "red",
  }),
  eventTemplate({
    id: "event-signal-stack",
    name: "Signal Stack",
    shortName: "Signal",
    description:
      "The original Studio event system: bold hierarchy, structured details, and flexible brand compositions.",
    variant: "signal-stack",
    fonts: ["montserrat", "league-spartan", "google-sans"],
    compositions: [
      "editorial",
      "signal",
      "split",
      "color-overlay",
      "flat",
    ],
    defaultFont: "montserrat",
    previewCopy: {
      eyebrow: "A PLACE TO CONNECT",
      title: "Community Night",
      subtitle: "Come as you are. Leave knowing someone new.",
      date: "SEPTEMBER 18",
      footer: "DETAILS AT CENTRAL.CROSSPOINTE.TV",
    },
  }),
  eventTemplate({
    id: "event-rally-poster",
    name: "Rally Poster",
    shortName: "Rally",
    description:
      "A condensed, high-energy poster system for conferences, student events, worship nights, and launches.",
    variant: "rally-poster",
    fonts: ["bebas-neue", "league-gothic", "science-gothic"],
    compositions: [
      "rally-stripes",
      "rally-frame",
      "editorial",
      "color-overlay",
      "flat",
    ],
    defaultFont: "bebas-neue",
    previewCopy: {
      eyebrow: "ONE NIGHT",
      title: "GATHER",
      subtitle: "Worship. Community. Purpose.",
      date: "OCTOBER 12",
      footer: "SHOW UP",
    },
    defaults: {composition: "rally-stripes", textAlignment: "center"},
    accent: "red",
  }),
  eventTemplate({
    id: "event-future-block",
    name: "Future Block",
    shortName: "Future",
    description:
      "A geometric, forward-looking layout for NextGen, technology, leadership, and modern ministry moments.",
    variant: "future-block",
    fonts: ["unbounded", "science-gothic", "google-sans"],
    compositions: [
      "future-grid",
      "future-cut",
      "editorial",
      "color-overlay",
      "flat",
    ],
    defaultFont: "unbounded",
    previewCopy: {
      eyebrow: "NEXT",
      title: "MOVE",
      subtitle: "Students stepping into what is next.",
      date: "AUGUST 23",
      footer: "MOVE FORWARD",
    },
    defaults: {
      composition: "future-grid",
      palette: "blue-charcoal",
      textAlignment: "left",
    },
    accent: "mint",
  }),
  eventTemplate({
    id: "event-center-stage",
    name: "Center Stage",
    shortName: "Center",
    description:
      "A bold sans-serif system with the complete hero message anchored to the true center of the canvas.",
    variant: "center-stage",
    fonts: ["league-spartan", "google-sans", "montserrat"],
    compositions: [
      "center-burst",
      "center-frame",
      "color-overlay",
      "flat",
    ],
    defaultFont: "league-spartan",
    previewCopy: {
      eyebrow: "ONE CHURCH",
      title: "TOGETHER",
      subtitle: "A night for worship, community, and purpose.",
      date: "SEPTEMBER 27",
      footer: "SAVE YOUR PLACE",
    },
    defaults: {
      composition: "center-burst",
      textAlignment: "center",
    },
    accent: "red",
  }),
  eventTemplate({
    id: "event-timeless-center",
    name: "Timeless Center",
    shortName: "Timeless",
    description:
      "A centered serif invitation with balanced spacing for dinners, ceremonies, and meaningful gatherings.",
    variant: "timeless-center",
    fonts: ["bodoni-moda", "forum", "eb-garamond"],
    compositions: [
      "serif-medallion",
      "serif-lines",
      "color-overlay",
      "flat",
    ],
    defaultFont: "bodoni-moda",
    previewCopy: {
      eyebrow: "AN EVENING",
      title: "At the Table",
      subtitle: "Good conversation. A shared meal. Room for you.",
      date: "OCTOBER 04",
      footer: "YOU ARE INVITED",
    },
    defaults: {
      composition: "serif-medallion",
      palette: "warm-light",
      textAlignment: "center",
    },
    accent: "purple",
  }),
  eventTemplate({
    id: "event-editorial-invitation",
    name: "Editorial Invitation",
    shortName: "Editorial",
    description:
      "An elegant, spacious invitation for dinners, women’s events, ceremonies, and story-led gatherings.",
    variant: "editorial-invitation",
    fonts: ["bodoni-moda", "forum", "eb-garamond"],
    compositions: [
      "editorial-flow",
      "editorial-frame",
      "editorial-column",
      "color-overlay",
      "flat",
    ],
    defaultFont: "bodoni-moda",
    previewCopy: {
      eyebrow: "YOU ARE",
      title: "Invited",
      subtitle: "An evening together around the table.",
      date: "NOVEMBER 08",
      footer: "JOIN US",
    },
    defaults: {
      composition: "editorial-flow",
      palette: "warm-light",
      textAlignment: "center",
    },
    accent: "purple",
  }),
  eventTemplate({
    id: "event-scripted-welcome",
    name: "Scripted Welcome",
    shortName: "Welcome",
    description:
      "A warm, expressive invitation for Sunday moments, hospitality, connection, and personal storytelling.",
    variant: "scripted-welcome",
    fonts: ["niconne", "forum", "bodoni-moda"],
    compositions: [
      "welcome-halo",
      "welcome-arch",
      "welcome-ribbons",
      "color-overlay",
      "flat",
    ],
    defaultFont: "niconne",
    previewCopy: {
      eyebrow: "THERE IS",
      title: "Room",
      subtitle: "Come as you are. You are welcome here.",
      date: "SUNDAY",
      footer: "FOR YOU",
    },
    defaults: {
      composition: "welcome-halo",
      flatColor: "blush",
      textAlignment: "center",
    },
    accent: "red",
  }),
];

const LEGACY_EVENT_TEMPLATE_ID = "event-promotion";

export function isEventTemplateId(templateId) {
  return (
    templateId === LEGACY_EVENT_TEMPLATE_ID ||
    TEMPLATE_CATALOG.some(
      (template) => template.id === templateId && template.kind === "event",
    )
  );
}

export function isSocialTemplateId(templateId) {
  return TEMPLATE_CATALOG.some(
    (template) => template.id === templateId && template.kind === "social",
  );
}

export function supportsHeroLogoTemplate(templateId) {
  return (
    isEventTemplateId(templateId) ||
    templateId === SOCIAL_SIMPLE_STATEMENT_TEMPLATE_ID
  );
}

export function createSocialCarouselSlide(content, slideId = "") {
  return {
    id: slideId || createId("studio-slide"),
    content: structuredCloneSafe_(content || eventContent),
  };
}

export function getSocialProjectSlides(project) {
  if (!project?.content || !isSocialTemplateId(project.templateId)) return [];
  const additionalSlides =
    project.postMode === "carousel" && Array.isArray(project.carouselSlides)
      ? project.carouselSlides.slice(0, MAX_SOCIAL_CAROUSEL_SLIDES - 1)
      : [];
  return [
    {id: "primary", content: project.content},
    ...additionalSlides,
  ];
}

export function isGraphicTemplateId(templateId) {
  return (
    isEventTemplateId(templateId) ||
    isSocialTemplateId(templateId) ||
    TEMPLATE_CATALOG.some(
      (template) =>
        template.id === templateId && template.editorKind === "graphic",
    )
  );
}

export function isDocumentProject(project) {
  return Boolean(
    project &&
      (project.templateId === DOCUMENT_PROJECT_TEMPLATE_ID ||
        project.templateId === LEGACY_POLICY_TEMPLATE_ID ||
        project.projectKind === "document" ||
        Array.isArray(project.pages)),
  );
}

export const STUDIO_STEPS = [
  {
    id: "source",
    label: "Source",
    description: "Choose what this project is grounded in.",
  },
  {
    id: "content",
    label: "Content",
    description: "Write the approved fields used by the template.",
  },
  {
    id: "layout",
    label: "Layout",
    description: "Select a format and controlled composition.",
  },
  {
    id: "brand",
    label: "Brand",
    description: "Apply approved color and type treatments.",
  },
  {
    id: "review",
    label: "Review",
    description: "Check the final composition and prepare it for export.",
  },
];

const onePagerContent = {
  eyebrow: "CROSSPOINTE CREATIVE | OPERATING PLAYBOOK",
  audience: "MINISTRY LEADERS",
  documentNumber: "SOP 01",
  title: "Event Request & Promotion Workflow",
  subtitle:
    "A clear path for planning, preparing, and promoting ministry opportunities.",
  operatingRuleLabel: "OPERATING RULE",
  operatingRule:
    "Begin with the audience and objective. The right communication plan is shaped by who needs to respond, what they need to do, and when they need to know.",
  primarySectionLabel: "STANDARD WORKFLOW",
  primarySectionTitle: "Normally Included",
  primaryItems: [
    "Submit complete event information",
    "Confirm one clear next step",
    "Identify the intended audience",
    "Allow time for review and production",
  ],
  secondarySectionLabel: "STRATEGIC OPTIONS",
  secondarySectionTitle: "Considered When Useful",
  secondaryItems: [
    "Expanded social campaign",
    "Targeted email or text communication",
    "Screen, stage, or video support",
    "Printed materials when the audience benefits",
  ],
  ownerLabel: "MINISTRY LEADER OWNS",
  ownerTitle: "Your Part of the Plan",
  ownerItems: [
    "Provide accurate details and timely approvals.",
    "Name the audience, objective, and desired response.",
    "Own participant follow-up after promotion begins.",
  ],
  processLabel: "PLAN WITH PURPOSE",
  processSteps: [
    "PRIORITIZE",
    "REACH",
    "ORGANIZE",
    "MAP",
    "OPTIMIZE",
    "TEST",
    "EVALUATE",
  ],
  footerNote:
    "Support depends on audience, timing, calendar, and Creative capacity.",
  footerReference: "CROSSPOINTE CREATIVE",
  accent: "red",
};

const checklistContent = {
  eyebrow: "CROSSPOINTE CREATIVE | CHECKLIST",
  audience: "MINISTRY TEAMS",
  documentNumber: "CHK 01",
  title: "Event Readiness Checklist",
  subtitle:
    "Use this page to confirm the people, details, and follow-up required before launch.",
  instructionsLabel: "BEFORE YOU BEGIN",
  instructions:
    "Work through each section with the project owner. Mark an item complete only when its details are confirmed.",
  sectionOneTitle: "PLAN",
  sectionOneItems: [
    "Confirm the audience and objective",
    "Name one clear next step",
    "Verify the event date, time, and location",
    "Assign the project owner",
  ],
  sectionTwoTitle: "PREPARE",
  sectionTwoItems: [
    "Gather approved copy and links",
    "Confirm registration or response details",
    "Allow time for creative review",
    "Identify supporting ministries or teams",
  ],
  sectionThreeTitle: "FOLLOW THROUGH",
  sectionThreeItems: [
    "Review every public-facing detail",
    "Confirm the communication schedule",
    "Prepare participant follow-up",
    "Evaluate results after the event",
  ],
  calloutLabel: "FINAL CHECK",
  calloutText:
    "The message, destination, and ministry follow-up should all point to the same next step.",
  footerNote: "Complete details reduce revisions and protect the launch timeline.",
  footerReference: "CROSSPOINTE CREATIVE",
  accent: "red",
};

const signupSheetContent = {
  eyebrow: "CROSSPOINTE CREATIVE | SIGN-UP SHEET",
  audience: "MINISTRY TEAMS",
  documentNumber: "SIGN-UP 01",
  title: "Sunday Serve Team Sign-Up",
  subtitle:
    "Add your name and contact information below. A ministry leader will follow up with next steps.",
  instructionsLabel: "HOW TO USE THIS SHEET",
  instructions:
    "Please print clearly and include the best way to reach you.",
  signupCount: 12,
  columnOneLabel: "NAME",
  columnTwoLabel: "EMAIL OR PHONE",
  columnThreeLabel: "NOTES",
  showNumbers: true,
  footerNote: "Return completed sheets to the ministry leader.",
  footerReference: "CROSSPOINTE CREATIVE",
  accent: "red",
};

const directoryContent = {
  eyebrow: "CROSSPOINTE CREATIVE | DIRECTORY",
  audience: "FIND YOUR PLACE",
  documentNumber: "DIR 01",
  title: "Pointe Groups Directory",
  subtitle:
    "Explore a few of the places where people can connect, grow, and follow Jesus together.",
  cards: [
    {
      id: "directory-card-one",
      name: "Young Adults",
      subtitle: "Tuesdays · 7:00 PM",
      details: "A place for young adults to build community and grow in faith.",
      imageUrl: "",
      imageStoragePath: "",
      sourceType: "manual",
      sourceId: "",
      publicUrl: "",
    },
    {
      id: "directory-card-two",
      name: "Women at CrossPointe",
      subtitle: "Wednesday Evenings",
      details: "Conversation, encouragement, and Scripture for women in every season.",
      imageUrl: "",
      imageStoragePath: "",
      sourceType: "manual",
      sourceId: "",
      publicUrl: "",
    },
  ],
  footerNote: "Find current group details and next steps at central.crosspointe.tv.",
  footerReference: "CROSSPOINTE CREATIVE",
  accent: "red",
};

const contentPageContent = {
  eyebrow: "CROSSPOINTE CREATIVE | DOCUMENT",
  audience: "MINISTRY LEADERS",
  documentNumber: "PAGE 01",
  title: "Supporting Guidance",
  subtitle:
    "Use flexible content blocks to add context, explanations, examples, or supporting information.",
  blocks: [
    {
      id: "content-heading",
      type: "heading",
      text: "What this page covers",
    },
    {
      id: "content-paragraph",
      type: "paragraph",
      text:
        "This page keeps the same CrossPointe document system while giving you room for longer supporting copy.",
    },
    {
      id: "content-list",
      type: "bullets",
      text:
        "Use clear, direct language\nKeep each section focused\nEnd with an actionable next step",
    },
    {
      id: "content-callout",
      type: "callout",
      text:
        "Use **bold text** for the most important idea and keep callouts concise.",
    },
  ],
  footerNote: "Supporting guidance should remain concise and action-oriented.",
  footerReference: "CROSSPOINTE CREATIVE",
  accent: "red",
};

const eventContent = {
  eyebrow: "A PLACE TO CONNECT",
  eyebrowVisible: true,
  title: "Community Night",
  subtitle: "Come as you are. Leave knowing someone new.",
  subtitleVisible: true,
  date: "SEPTEMBER 18",
  time: "6:30 PM",
  location: "CROSSPOINTE CHURCH",
  cta: "DETAILS AT CENTRAL.CROSSPOINTE.TV",
  format: "square",
  composition: "editorial",
  palette: "charcoal-red",
  flatColor: "charcoal",
  overlayColor: "red",
  overlayBlendMode: "multiply",
  fontKey: "montserrat",
  fontWeight: "template",
  brandMark: "central",
  brandColor: "auto",
  imagePosition: "center",
  focalX: 50,
  focalY: 50,
  imageZoom: 1,
  backgroundImageOpacity: 1,
  backgroundImageRotation: 0,
  backgroundImage: "",
  backgroundImageSource: "",
  backgroundImageUrl: "",
  backgroundImageStoragePath: "",
  unsplashPhotoId: "",
  unsplashPhotographerName: "",
  unsplashPhotographerUrl: "",
  unsplashPhotoUrl: "",
  heroMode: "text",
  heroLogo: "",
  heroLogoSource: "",
  heroLogoLibraryId: "",
  heroLogoStoragePath: "",
  heroLogoName: "",
  heroLogoScale: 1,
  heroLogoClearSpace: 4,
  textAlignment: "left",
  textShadow: false,
};

function createId(prefix = "studio") {
  return globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDocumentPage(templateId, content = null, pageId = "") {
  const template = DOCUMENT_PAGE_TEMPLATES.find(
    (item) => item.id === templateId,
  ) || DOCUMENT_PAGE_TEMPLATES[0];
  const defaults =
    template.id === "document-checklist"
      ? checklistContent
      : template.id === "document-signup-sheet"
        ? signupSheetContent
        : template.id === "document-directory"
          ? directoryContent
      : template.id === "document-content-page"
        ? contentPageContent
        : onePagerContent;
  return {
    id: pageId || createId("studio-page"),
    templateId: template.id,
    content: structuredCloneSafe_(content || defaults),
  };
}

export function migrateLegacyStudioProject(project) {
  if (!project || typeof project !== "object") return project;
  if (project.templateId === LEGACY_POLICY_TEMPLATE_ID) {
    return {
      ...project,
      schemaVersion: 2,
      projectKind: "document",
      templateId: DOCUMENT_PROJECT_TEMPLATE_ID,
      documentSettings: {showPageNumbers: true},
      pages: [
        createDocumentPage(
          "document-one-pager",
          project.content || onePagerContent,
          `${project.id || "legacy"}-page-1`,
        ),
      ],
      legacyTemplateId: LEGACY_POLICY_TEMPLATE_ID,
    };
  }
  if (isDocumentProject(project)) {
    const pages = Array.isArray(project.pages)
      ? project.pages
          .slice(0, 20)
          .map((page) =>
            createDocumentPage(page.templateId, page.content, page.id),
          )
      : [createDocumentPage("document-one-pager")];
    return {
      ...project,
      schemaVersion: 2,
      projectKind: "document",
      templateId: DOCUMENT_PROJECT_TEMPLATE_ID,
      documentSettings: {
        showPageNumbers: project.documentSettings?.showPageNumbers !== false,
      },
      pages: pages.length ? pages : [createDocumentPage("document-one-pager")],
    };
  }
  if (!isGraphicTemplateId(project.templateId) || !project.content) {
    return project;
  }
  const normalizedComposition = normalizeEventComposition(
    project.templateId,
    project.content.composition,
  );
  const isSocial = isSocialTemplateId(project.templateId);
  const supportsHero = supportsHeroLogoTemplate(project.templateId);
  const optionalTextVisibility = String(
    project.content.optionalTextVisibility || "",
  );
  const hasFocalPoint =
    Number.isFinite(Number(project.content.focalX)) &&
    Number.isFinite(Number(project.content.focalY));
  const legacyX = {
    "left center": 25,
    center: 50,
    "right center": 75,
  }[project.content.imagePosition] ?? 50;
  const migrated = {
    ...project,
    content: {
      ...project.content,
      composition: normalizedComposition,
      eyebrowVisible:
        typeof project.content.eyebrowVisible === "boolean"
          ? project.content.eyebrowVisible
          : !["subtitle", "none"].includes(optionalTextVisibility),
      subtitleVisible:
        typeof project.content.subtitleVisible === "boolean"
          ? project.content.subtitleVisible
          : !["eyebrow", "none"].includes(optionalTextVisibility),
      date: isSocial ? "" : String(project.content.date || ""),
      time: isSocial ? "" : String(project.content.time || ""),
      location: isSocial ? "" : String(project.content.location || ""),
      format: isSocial
        ? project.content.format === "portrait"
          ? "portrait"
          : "square"
        : project.content.format || "square",
      focalX: hasFocalPoint ? project.content.focalX : legacyX,
      focalY: hasFocalPoint ? project.content.focalY : 50,
      backgroundImageOpacity: Number.isFinite(
        Number(project.content.backgroundImageOpacity),
      )
        ? Math.min(
            1,
            Math.max(0, Number(project.content.backgroundImageOpacity)),
          )
        : 1,
      backgroundImageRotation: Number.isFinite(
        Number(project.content.backgroundImageRotation),
      )
        ? Math.min(
            360,
            Math.max(
              0,
              Math.round(Number(project.content.backgroundImageRotation)),
            ),
          )
        : 0,
      fontWeight: GRAPHIC_FONT_WEIGHT_OPTIONS.some(
        (option) => option.value === project.content.fontWeight,
      )
        ? project.content.fontWeight
        : "template",
      brandMark: GRAPHIC_BRAND_MARK_OPTIONS.some(
        (option) => option.value === project.content.brandMark,
      )
        ? project.content.brandMark
        : "central",
      brandColor: GRAPHIC_BRAND_COLOR_OPTIONS.some(
        (option) => option.value === project.content.brandColor,
      )
        ? project.content.brandColor
        : "auto",
      heroMode:
        supportsHero && project.content.heroMode === "logo" ? "logo" : "text",
      heroLogo: supportsHero ? String(project.content.heroLogo || "") : "",
      heroLogoSource: supportsHero && ["upload", "library"].includes(
        project.content.heroLogoSource,
      )
        ? project.content.heroLogoSource
        : "",
      heroLogoLibraryId: supportsHero
        ? String(project.content.heroLogoLibraryId || "")
        : "",
      heroLogoStoragePath: supportsHero
        ? String(project.content.heroLogoStoragePath || "")
        : "",
      heroLogoName: supportsHero
        ? String(project.content.heroLogoName || "")
        : "",
      heroLogoScale: Number.isFinite(Number(project.content.heroLogoScale))
        ? Math.min(2, Math.max(0.5, Number(project.content.heroLogoScale)))
        : 1,
      heroLogoClearSpace: Number.isFinite(
        Number(project.content.heroLogoClearSpace),
      )
        ? Math.min(
            12,
            Math.max(0, Number(project.content.heroLogoClearSpace)),
          )
        : 4,
    },
  };
  if (!isSocial) return migrated;

  const carouselSlides =
    project.postMode === "carousel" && Array.isArray(project.carouselSlides)
      ? project.carouselSlides
          .slice(0, MAX_SOCIAL_CAROUSEL_SLIDES - 1)
          .map((slide) => {
            const normalized = migrateLegacyStudioProject({
              ...project,
              postMode: "single",
              carouselSlides: [],
              content: slide?.content || {},
            });
            return createSocialCarouselSlide(
              normalized.content,
              String(slide?.id || "").slice(0, 128),
            );
          })
      : [];
  return {
    ...migrated,
    schemaVersion: 3,
    postMode: project.postMode === "carousel" ? "carousel" : "single",
    carouselSlides,
  };
}

export function createStudioProject(templateId) {
  const template =
    TEMPLATE_CATALOG.find((item) => item.id === templateId) ||
    TEMPLATE_CATALOG[0];
  const createdAt = new Date().toISOString();
  const id = createId("studio");

  if (template.kind === "document" && template.editorKind !== "graphic") {
    return {
      id,
      schemaVersion: 2,
      projectKind: "document",
      templateId: DOCUMENT_PROJECT_TEMPLATE_ID,
      name: `Untitled ${template.name}`,
      status: "draft",
      sourceType: "manual",
      createdAt,
      updatedAt: createdAt,
      documentSettings: {showPageNumbers: true},
      pages: [createDocumentPage(template.id)],
    };
  }

  return {
    id,
    schemaVersion: template.kind === "social" ? 3 : 1,
    projectKind: template.editorKind === "graphic" ? "graphic" : undefined,
    templateId: template.id,
    name: `Untitled ${template.name}`,
    status: "draft",
    sourceType: "manual",
    sourceId: "",
    sourceEventId: "",
    sourceUrl: "",
    sourceUpdatedAt: "",
    createdAt,
    updatedAt: createdAt,
    ...(template.kind === "social"
      ? {postMode: "single", carouselSlides: []}
      : {}),
    content: {
      ...structuredCloneSafe_(eventContent),
      ...(template.defaults || {}),
      fontKey: template.defaultFont || "montserrat",
    },
  };
}

export function getTemplateById(templateId) {
  if (templateId === DOCUMENT_PROJECT_TEMPLATE_ID) {
    return {
      id: DOCUMENT_PROJECT_TEMPLATE_ID,
      name: "Document",
      shortName: "Document",
      description: "A multi-page CrossPointe document.",
      formats: ["US Letter"],
      status: "Ready",
      accent: "red",
      kind: "document-project",
    };
  }
  if (templateId === LEGACY_POLICY_TEMPLATE_ID) {
    return DOCUMENT_PAGE_TEMPLATES[0];
  }
  if (templateId === LEGACY_EVENT_TEMPLATE_ID) {
    return TEMPLATE_CATALOG.find(
      (item) => item.id === "event-signal-stack",
    );
  }
  return (
    TEMPLATE_CATALOG.find((item) => item.id === templateId) ||
    TEMPLATE_CATALOG[0]
  );
}

export function getEventFontOptions(templateId) {
  const template = getTemplateById(templateId);
  return ["event", "social"].includes(template.kind) ||
    template.editorKind === "graphic"
    ? template.fonts
    : [];
}

export function getEventFont(templateId, fontKey) {
  const template = getTemplateById(templateId);
  return (
    template.fonts?.find((font) => font.value === fontKey) ||
    template.fonts?.find((font) => font.value === template.defaultFont) ||
    EVENT_FONT_LIBRARY.montserrat
  );
}

export function getEventCompositionOptions(templateId) {
  const template = getTemplateById(templateId);
  return ["event", "social"].includes(template.kind) ||
    template.editorKind === "graphic"
    ? template.compositions
    : [];
}

export function normalizeEventComposition(templateId, composition) {
  const template = getTemplateById(templateId);
  const legacyMappings = {
    "rally-poster": {
      split: "rally-stripes",
      signal: "rally-frame",
    },
    "future-block": {
      signal: "future-grid",
      split: "future-cut",
    },
    "editorial-invitation": {
      editorial: "editorial-flow",
      signal: "editorial-frame",
      split: "editorial-column",
    },
    "scripted-welcome": {
      editorial: "welcome-ribbons",
      signal: "welcome-halo",
      split: "welcome-arch",
    },
  };
  const migrated =
    legacyMappings[template.variant]?.[composition] || composition;
  return template.compositions?.some((option) => option.value === migrated)
    ? migrated
    : template.compositions?.[0]?.value || "editorial";
}

export function linesToText(lines) {
  return Array.isArray(lines) ? lines.join("\n") : "";
}

export function textToLines(value, maximum = Number.POSITIVE_INFINITY) {
  const lines = String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return Number.isFinite(maximum) ? lines.slice(0, maximum) : lines;
}

export function getBrandColor(value) {
  return (
    BRAND_COLOR_OPTIONS.find((option) => option.value === value) ||
    BRAND_COLOR_OPTIONS.find((option) => option.value === "charcoal")
  );
}

export function getEventPalette(value) {
  return (
    EVENT_PALETTE_OPTIONS.find((option) => option.value === value) ||
    EVENT_PALETTE_OPTIONS[0]
  );
}

export function getProjectWarnings(project) {
  if (!project) return ["Project data is missing."];
  const warnings = [];

  if (!String(project.name || "").trim()) {
    warnings.push("Give this project a name before exporting.");
  }

  if (isDocumentProject(project)) {
    if (!project.pages?.length) {
      warnings.push("Add at least one page before exporting.");
      return warnings;
    }
    project.pages.forEach((page, index) => {
      const content = page.content || {};
      const pageLabel = `Page ${index + 1}`;
      if (!String(content.title || "").trim()) {
        warnings.push(`${pageLabel} needs a title.`);
      }
      if (
        page.templateId === "document-one-pager" &&
        ![
          content.operatingRule,
          ...(content.primaryItems || []),
          ...(content.secondaryItems || []),
          ...(content.ownerItems || []),
          ...(content.processSteps || []),
        ].some((value) => String(value || "").trim())
      ) {
        warnings.push(`${pageLabel} needs at least one guidance section.`);
      }
      if (
        page.templateId === "document-checklist" &&
        ![
          ...(content.sectionOneItems || []),
          ...(content.sectionTwoItems || []),
          ...(content.sectionThreeItems || []),
        ].some((value) => String(value || "").trim())
      ) {
        warnings.push(`${pageLabel} needs at least one checklist item.`);
      }
      if (
        page.templateId === "document-directory" &&
        !(content.cards || []).some((card) =>
          String(card?.name || "").trim(),
        )
      ) {
        warnings.push(`${pageLabel} needs at least one directory card.`);
      }
      if (
        page.templateId === "document-content-page" &&
        !(content.blocks || []).some(
          (block) =>
            block?.type === "divider" || String(block?.text || "").trim(),
        )
      ) {
        warnings.push(`${pageLabel} needs at least one content block.`);
      }
    });
    return warnings;
  }

  const isSocial = isSocialTemplateId(project.templateId);
  const isSmallGroupLeader =
    getTemplateById(project.templateId).variant === "small-group-leader";
  const graphicContents =
    isSocial && project.postMode === "carousel"
      ? getSocialProjectSlides(project).map((slide) => slide.content)
      : [project.content || {}];
  graphicContents.forEach((content, index) => {
    const prefix = graphicContents.length > 1 ? `Slide ${index + 1}: ` : "";
    if (
      content.heroMode !== "logo" &&
      !String(content.title || "").trim()
    ) {
      warnings.push(`${prefix}The title is required.`);
    }
    if (
      content.heroMode !== "logo" &&
      String(content.title || "").length > (isSocial ? 180 : 44)
    ) {
      warnings.push(
        `${prefix}${
          isSocial
            ? "The main text may be too long for every format."
            : isSmallGroupLeader
              ? "The group name may be too long for the leader card."
              : "The event title may be too long for every format."
        }`,
      );
    }
    if (
      content.heroMode === "logo" &&
      !String(content.heroLogo || content.heroLogoStoragePath || "").trim()
    ) {
      warnings.push(`${prefix}Choose or upload a hero logo.`);
    }
    if (!isSocial && !String(content.date || "").trim()) {
      warnings.push(
        `${prefix}${
          isSmallGroupLeader ? "Add the group meeting day." : "Add an event date."
        }`,
      );
    }
    if (!isSocial && !String(content.cta || "").trim()) {
      warnings.push(`${prefix}Add a clear next step.`);
    }
    if (
      content.composition === "color-overlay" &&
      !String(content.backgroundImage || "").trim()
    ) {
      warnings.push(`${prefix}Color Overlay requires a background image.`);
    }
  });
  return warnings;
}

function structuredCloneSafe_(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
