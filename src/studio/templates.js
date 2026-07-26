export const STUDIO_STORAGE_KEY = "crosspointeStudioProjectsV1";

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
  "color-overlay": {value: "color-overlay", label: "Color Overlay"},
  flat: {value: "flat", label: "Flat / No Overlay"},
};

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
});

export const TEMPLATE_CATALOG = [
  {
    id: "policy-document",
    name: "SOP / Policy Document",
    shortName: "Policy",
    description:
      "A polished US Letter document for playbooks, ministry policies, and repeatable procedures.",
    formats: ["US Letter"],
    status: "Ready",
    accent: "red",
    kind: "policy",
  },
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
    previewCopy: {eyebrow: "EVENT", title: "CREATE", footer: "WITH PURPOSE"},
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
    previewCopy: {eyebrow: "ONE NIGHT", title: "GATHER", footer: "SHOW UP"},
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
    previewCopy: {eyebrow: "NEXT", title: "MOVE", footer: "FORWARD"},
    defaults: {
      composition: "future-grid",
      palette: "blue-charcoal",
      textAlignment: "left",
    },
    accent: "mint",
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
    previewCopy: {eyebrow: "YOU ARE", title: "Invited", footer: "JOIN US"},
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
    previewCopy: {eyebrow: "THERE IS", title: "Room", footer: "FOR YOU"},
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

const policyContent = {
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

const eventContent = {
  eyebrow: "A PLACE TO CONNECT",
  title: "Community Night",
  subtitle: "Come as you are. Leave knowing someone new.",
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
  imagePosition: "center",
  focalX: 50,
  focalY: 50,
  imageZoom: 1,
  backgroundImage: "",
  backgroundImageSource: "",
  backgroundImageUrl: "",
  backgroundImageStoragePath: "",
  unsplashPhotoId: "",
  unsplashPhotographerName: "",
  unsplashPhotographerUrl: "",
  unsplashPhotoUrl: "",
  textAlignment: "left",
  textShadow: false,
};

export function createStudioProject(templateId) {
  const template =
    TEMPLATE_CATALOG.find((item) => item.id === templateId) ||
    TEMPLATE_CATALOG[0];
  const createdAt = new Date().toISOString();
  const id =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `studio-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const eventContentForTemplate = {
    ...structuredCloneSafe_(eventContent),
    ...(template.defaults || {}),
    fontKey: template.defaultFont || "montserrat",
  };

  return {
    id,
    templateId: template.id,
    name:
      template.id === "policy-document"
        ? "Untitled Policy Document"
        : `Untitled ${template.name}`,
    status: "draft",
    sourceType: "manual",
    createdAt,
    updatedAt: createdAt,
    content:
      template.id === "policy-document"
        ? structuredCloneSafe_(policyContent)
        : eventContentForTemplate,
  };
}

export function getTemplateById(templateId) {
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
  return template.kind === "event" ? template.fonts : [];
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
  return template.kind === "event" ? template.compositions : [];
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

export function textToLines(value, maximum = 8) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

export function getBrandColor(value) {
  return (
    BRAND_COLOR_OPTIONS.find((option) => option.value === value) ||
    BRAND_COLOR_OPTIONS.find((option) => option.value === "charcoal")
  );
}

export function getProjectWarnings(project) {
  if (!project || !project.content) return ["Project content is missing."];
  const content = project.content;
  const warnings = [];

  if (!String(project.name || "").trim()) {
    warnings.push("Give this project a name before exporting.");
  }

  if (!String(content.title || "").trim()) {
    warnings.push("The title is required.");
  }

  if (isEventTemplateId(project.templateId)) {
    if (String(content.title || "").length > 44) {
      warnings.push("The event title may be too long for every format.");
    }
    if (!String(content.date || "").trim()) {
      warnings.push("Add an event date.");
    }
    if (!String(content.cta || "").trim()) {
      warnings.push("Add a clear next step.");
    }
    if (
      content.composition === "color-overlay" &&
      !String(content.backgroundImage || "").trim()
    ) {
      warnings.push("Color Overlay requires a background image.");
    }
  }

  if (project.templateId === "policy-document") {
    if (String(content.operatingRule || "").length > 320) {
      warnings.push("The operating rule may overflow the one-page template.");
    }
    if (!content.primaryItems || content.primaryItems.length < 2) {
      warnings.push("Add at least two standard workflow items.");
    }
    if (!content.ownerItems || content.ownerItems.length < 2) {
      warnings.push("Add at least two owner responsibilities.");
    }
  }

  return warnings;
}

function structuredCloneSafe_(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
