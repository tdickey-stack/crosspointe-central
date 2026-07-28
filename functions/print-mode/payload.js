export const PRINT_MODE_IMAGE_STORAGE_PREFIX =
  "bulletin-mode/fallback-images";
export const PRINT_MODE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const PRINT_MODE_EVENT_OVERRIDE_LIMIT = 200;
const PRINT_MODE_MAX_CAMPAIGNS = 3;
const PRINT_MODE_MAX_SERVE_NEEDS = 3;
const PRINT_MODE_MAX_FRONT_CONTENT_ITEMS = 4;
const PRINT_MODE_CAMPAIGN_ICON_IDS = new Set([
  "general",
  "gift",
  "backpack",
  "house",
  "food",
  "clothing",
  "heart",
  "helping-hands",
  "praying-hands",
  "school",
  "family",
  "medical",
  "church",
  "missions",
  "donation",
  "calendar",
]);

export function getDefaultPrintModeFallbackBlocks() {
  return [
    {
      id: "new-here",
      eyebrow: "New Here?",
      title: "We'd Love to Help You Get Connected",
      description: [
        "Find your next step, learn more about CrossPointe, and discover",
        "ways to get involved at central.crosspointe.tv.",
      ].join(" "),
      imageUrl: "",
      imageStoragePath: "",
      imageSide: "right",
      enabled: true,
    },
    {
      id: "stay-connected",
      eyebrow: "Stay Connected",
      title: "Everything You Need for the Week Ahead",
      description: [
        "Explore events, groups, resources, and serving opportunities",
        "anytime at central.crosspointe.tv.",
      ].join(" "),
      imageUrl: "",
      imageStoragePath: "",
      imageSide: "left",
      enabled: true,
    },
  ];
}

export function normalizePrintModePayload(sourceData) {
  const source = sourceData && typeof sourceData === "object" ?
    sourceData :
    {};
  const givingSource = source.giving && typeof source.giving === "object" ?
    source.giving :
    {};
  const headingsSource = source.headings &&
    typeof source.headings === "object" ? source.headings : {};
  const featuredSource = source.featuredEvent &&
    typeof source.featuredEvent === "object" ?
    source.featuredEvent :
    {};
  const fallbackSource = source.fallbackHero &&
    typeof source.fallbackHero === "object" ?
    source.fallbackHero :
    {};
  const fallbackBlockSource = Array.isArray(source.fallbackBlocks) ?
    source.fallbackBlocks :
    getDefaultPrintModeFallbackBlocks();
  const rawEvents = Array.isArray(source.events) ? source.events : [];
  const campaignIds = Array.isArray(source.campaignIds) ?
    source.campaignIds :
    [];
  const rawCampaignIcons = Array.isArray(source.campaignIcons) ?
    source.campaignIcons :
    [];
  const campaignIcons = [];
  const seenCampaignIconIds = new Set();

  rawCampaignIcons.slice(0, 12).forEach((item) => {
    const id = normalizePrintModeText(item && item.id, 160);
    if (!id || seenCampaignIconIds.has(id)) {
      return;
    }
    seenCampaignIconIds.add(id);
    campaignIcons.push({
      id: id,
      icon: normalizePrintModeCampaignIconId_(item && item.icon),
    });
  });
  const normalizedCampaignIds = campaignIds
      .map((id) => normalizePrintModeText(id, 160))
      .filter((id, index, ids) => id && ids.indexOf(id) === index)
      .slice(0, PRINT_MODE_MAX_CAMPAIGNS);
  const rawServeNeedIds = Array.isArray(source.serveNeedIds) ?
    source.serveNeedIds :
    (source.serveNeedId ? [source.serveNeedId] : []);
  const normalizedServeNeedIds = rawServeNeedIds
      .map((id) => normalizePrintModeText(id, 160))
      .filter((id, index, ids) => id && ids.indexOf(id) === index)
      .slice(
          0,
          Math.min(
              PRINT_MODE_MAX_SERVE_NEEDS,
              Math.max(
                  0,
                  PRINT_MODE_MAX_FRONT_CONTENT_ITEMS -
                    normalizedCampaignIds.length,
              ),
          ),
      );

  return {
    serviceDate: normalizePrintModeDate_(source.serviceDate),
    printFormat: source.printFormat === "full-page" ?
      "full-page" : "half-letter",
    heroSource: source.heroSource === "manual" ? "manual" : "featured",
    frontContentSource: source.frontContentSource === "fallback" ?
      "fallback" : "live",
    headings: {
      frontHeading: normalizePrintModeHeading_(
          headingsSource.frontHeading,
          "This Week at\nCrossPointe",
          80,
          2,
      ),
      backEyebrow: normalizePrintModeHeading_(
          headingsSource.backEyebrow,
          "See You There",
          50,
          1,
      ),
      backHeading: normalizePrintModeHeading_(
          headingsSource.backHeading,
          "The Next Two Weeks",
          80,
          2,
      ),
    },
    giving: {
      monthlyBudget: normalizePrintModeDollarValue_(
          givingSource.monthlyBudget,
      ),
      monthToDateGiving: normalizePrintModeDollarValue_(
          givingSource.monthToDateGiving,
      ),
      annualBudget: normalizePrintModeDollarValue_(
          givingSource.annualBudget,
      ),
      yearToDateGiving: normalizePrintModeDollarValue_(
          givingSource.yearToDateGiving,
      ),
    },
    featuredEvent: {
      id: normalizePrintModeText(featuredSource.id, 160),
      title: normalizePrintModeText(featuredSource.title, 180),
      description: normalizePrintModeLongText_(
          featuredSource.description,
          1200,
      ),
      includeDescription: featuredSource.includeDescription !== false,
    },
    fallbackHero: {
      eyebrow: normalizePrintModeText(
          fallbackSource.eyebrow || "Welcome to CrossPointe",
          80,
      ),
      title: normalizePrintModeText(
          fallbackSource.title || "We're Glad You're Here",
          180,
      ),
      description: normalizePrintModeLongText_(
          fallbackSource.description || [
            "Whether this is your first Sunday or CrossPointe is already home,",
            "we're glad you're here. Discover events, groups, serving",
            "opportunities, and next steps at central.crosspointe.tv.",
          ].join(" "),
          1200,
      ),
      imageUrl: normalizePrintModeImageUrl_(fallbackSource.imageUrl),
      imageStoragePath: normalizePrintModeStoragePath_(
          fallbackSource.imageStoragePath,
      ),
    },
    fallbackBlocks: fallbackBlockSource.slice(0, 4)
        .map((blockItem, index) => {
          const block = blockItem && typeof blockItem === "object" ?
            blockItem :
            {};
          return {
            id: normalizePrintModeText(
                block.id || "fallback-" + String(index + 1),
                160,
            ),
            eyebrow: normalizePrintModeText(block.eyebrow, 80),
            title: normalizePrintModeText(block.title, 180),
            description: normalizePrintModeLongText_(
                block.description,
                800,
            ),
            imageUrl: normalizePrintModeImageUrl_(block.imageUrl),
            imageStoragePath: normalizePrintModeStoragePath_(
                block.imageStoragePath,
            ),
            imageSide: block.imageSide === "left" ? "left" : "right",
            enabled: block.enabled !== false,
          };
        })
        .filter((block) => block.id && block.title),
    events: rawEvents
        .slice(0, PRINT_MODE_EVENT_OVERRIDE_LIMIT)
        .map((eventItem) => {
          const item = eventItem && typeof eventItem === "object" ?
            eventItem :
            {};
          return {
            id: normalizePrintModeText(item.id, 160),
            title: normalizePrintModeText(item.title, 180),
            description: normalizePrintModeLongText_(
                item.description,
                1200,
            ),
            location: normalizePrintModeText(item.location, 240),
            included: item.included !== false,
            includeDescription: item.includeDescription !== false,
          };
        }).filter((item) => item.id),
    campaignIds: normalizedCampaignIds,
    campaignIcons: campaignIcons,
    serveNeedIds: normalizedServeNeedIds,
    serveNeedId: normalizedServeNeedIds[0] || "",
  };
}

export function normalizePrintModeText(value, maxLength) {
  return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
}

function normalizePrintModeCampaignIconId_(value) {
  const iconId = String(value || "").trim().toLowerCase();
  return PRINT_MODE_CAMPAIGN_ICON_IDS.has(iconId) ?
    iconId :
    "general";
}

function normalizePrintModeLongText_(value, maxLength) {
  return String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
      .join("\n")
      .trim()
      .slice(0, maxLength);
}

function normalizePrintModeImageUrl_(value) {
  const normalized = String(value || "").trim().slice(0, 2000);
  if (!normalized) {
    return "";
  }

  if (
    /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i.test(normalized) ||
    /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):9199\/v0\/b\//i.test(
        normalized,
    )
  ) {
    return normalized;
  }

  return "";
}

function normalizePrintModeStoragePath_(value) {
  const normalized = String(value || "").trim().slice(0, 500);
  return normalized.startsWith(PRINT_MODE_IMAGE_STORAGE_PREFIX + "/") ?
    normalized :
    "";
}

function normalizePrintModeHeading_(
    value,
    fallbackValue,
    maxLength,
    maxLines,
) {
  const normalized = String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, Math.max(1, Number(maxLines) || 1))
      .join("\n")
      .trim();
  const fallback = String(fallbackValue || "").trim();
  return (normalized || fallback).slice(0, Number(maxLength) || 80);
}

function normalizePrintModeDollarValue_(value) {
  const parsed = Number(
      String(value == null ? "" : value).replace(/[$,\s]/g, ""),
  );
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(Math.round(parsed), 1000000000);
}

function normalizePrintModeDate_(value) {
  const text = String(value || "").trim();
  const quickMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!text) {
    return "";
  }

  if (quickMatch) {
    return quickMatch[1] + "-" + quickMatch[2] + "-" + quickMatch[3];
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return [
    parsed.getFullYear(),
    "-",
    String(parsed.getMonth() + 1).padStart(2, "0"),
    "-",
    String(parsed.getDate()).padStart(2, "0"),
  ].join("");
}
