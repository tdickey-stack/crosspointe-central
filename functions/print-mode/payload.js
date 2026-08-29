export const PRINT_MODE_IMAGE_STORAGE_PREFIX =
  "bulletin-mode/fallback-images";
export const PRINT_MODE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const PRINT_MODE_EVENT_OVERRIDE_LIMIT = 200;
const PRINT_MODE_MAX_CAMPAIGNS = 3;
const PRINT_MODE_MAX_SERVE_NEEDS = 3;
const PRINT_MODE_MAX_FRONT_CONTENT_ITEMS = 4;
const PRINT_MODE_MAX_CUSTOM_BLOCKS = 8;
const PRINT_MODE_DESCRIPTION_OVERRIDE_LIMIT = 12;
const PRINT_MODE_DESCRIPTION_MAX_CHARACTERS = 140;
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
      size: 2,
      includeOnFront: false,
      includeOnBack: false,
      enabled: false,
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
      size: 2,
      includeOnFront: false,
      includeOnBack: false,
      enabled: false,
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
  const legacyCustomOnly = source.frontContentSource === "fallback";
  const normalizedFallbackBlocks = fallbackBlockSource
      .slice(0, PRINT_MODE_MAX_CUSTOM_BLOCKS)
      .map((blockItem, index) => {
        const block = blockItem && typeof blockItem === "object" ?
          blockItem :
          {};
        const size = normalizePrintModeBlockSize_(block.size);
        const includeOnFront = (
          Object.prototype.hasOwnProperty.call(block, "includeOnFront") ?
            block.includeOnFront === true :
            legacyCustomOnly
        );
        const includeOnBack = block.includeOnBack === true;
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
          size: size,
          includeOnFront: includeOnFront,
          includeOnBack: includeOnBack,
          enabled: block.enabled !== false &&
            (includeOnFront || includeOnBack),
        };
      })
      .filter((block) => block.id && block.title);
  let remainingCustomFrontUnits = PRINT_MODE_MAX_FRONT_CONTENT_ITEMS;
  normalizedFallbackBlocks.forEach((block) => {
    if (block.enabled === false || !block.includeOnFront) {
      return;
    }
    if (block.size > remainingCustomFrontUnits) {
      block.includeOnFront = false;
      block.enabled = block.includeOnBack;
      return;
    }
    remainingCustomFrontUnits -= block.size;
  });
  const customFrontUnits = normalizedFallbackBlocks.reduce(
      (total, block) => total + (
        block.enabled !== false && block.includeOnFront ? block.size : 0
      ),
      0,
  );
  const availableCentralUnits = Math.max(
      0,
      PRINT_MODE_MAX_FRONT_CONTENT_ITEMS - customFrontUnits,
  );
  const rawEvents = Array.isArray(source.events) ? source.events : [];
  const campaignIds = Array.isArray(source.campaignIds) ?
    source.campaignIds :
    [];
  const rawCampaignIcons = Array.isArray(source.campaignIcons) ?
    source.campaignIcons :
    [];
  const campaignDescriptionOverrides = normalizePrintModeDescriptionOverrides_(
      source.campaignDescriptionOverrides,
  );
  const serveNeedDescriptionOverrides = normalizePrintModeDescriptionOverrides_(
      source.serveNeedDescriptionOverrides,
  );
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
      .slice(
          0,
          availableCentralUnits > 0 ? PRINT_MODE_MAX_CAMPAIGNS : 0,
      );
  const campaignUnits = normalizedCampaignIds.length ? 1 : 0;
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
              availableCentralUnits - campaignUnits > 0 ?
                PRINT_MODE_MAX_SERVE_NEEDS : 0,
          ),
      );
  const normalizedFrontContentOrder = normalizePrintModeFrontContentOrder_(
      source.frontContentOrder,
      normalizedFallbackBlocks,
  );
  const normalizedBackContentOrder = normalizePrintModeBackContentOrder_(
      source.backContentOrder,
      normalizedFallbackBlocks,
  );

  return {
    serviceDate: normalizePrintModeDate_(source.serviceDate),
    printFormat: source.printFormat === "full-page" ?
      "full-page" : "half-letter",
    printColorMode: source.printColorMode === "bw" ? "bw" : "color",
    showCutLine: source.showCutLine === true,
    heroSource: source.heroSource === "manual" ? "manual" : "featured",
    frontContentSource: "mixed",
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
      backHeading: normalizePrintModeBackHeading_(headingsSource.backHeading),
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
      blackAndWhiteImageUrl: normalizePrintModeImageUrl_(
          featuredSource.blackAndWhiteImageUrl,
      ),
      blackAndWhiteImageStoragePath: normalizePrintModeStoragePath_(
          featuredSource.blackAndWhiteImageStoragePath,
      ),
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
    fallbackBlocks: normalizedFallbackBlocks,
    frontContentOrder: normalizedFrontContentOrder,
    backContentOrder: normalizedBackContentOrder,
    backCustomPlacement: source.backCustomPlacement === "before-events" ?
      "before-events" : "after-events",
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
    campaignDescriptionOverrides: campaignDescriptionOverrides,
    serveNeedIds: normalizedServeNeedIds,
    serveNeedDescriptionOverrides: serveNeedDescriptionOverrides,
    serveNeedId: normalizedServeNeedIds[0] || "",
  };
}

function normalizePrintModeDescriptionOverrides_(source) {
  const normalized = [];
  const seenIds = new Set();

  (Array.isArray(source) ? source : []).forEach((item) => {
    if (normalized.length >= PRINT_MODE_DESCRIPTION_OVERRIDE_LIMIT) {
      return;
    }
    const id = normalizePrintModeText(item && item.id, 160);
    if (!id || seenIds.has(id)) {
      return;
    }
    seenIds.add(id);
    normalized.push({
      id: id,
      description: normalizePrintModeLongText_(
          item && item.description,
          PRINT_MODE_DESCRIPTION_MAX_CHARACTERS,
      ),
    });
  });

  return normalized;
}

function normalizePrintModeBlockSize_(value) {
  const size = Math.round(Number(value));
  return size >= 1 && size <= 3 ? size : 2;
}

function normalizePrintModeBackHeading_(value) {
  const heading = normalizePrintModeHeading_(
      value,
      "The Next Four Weeks",
      80,
      2,
  );
  return heading === "The Next Two Weeks" ?
    "The Next Four Weeks" : heading;
}

function normalizePrintModeFrontContentOrder_(sourceOrder, fallbackBlocks) {
  const candidates = fallbackBlocks
      .map((block) => "custom:" + block.id)
      .concat(["campaigns", "serveNeeds"]);
  const allowed = new Set(candidates);
  const normalized = [];

  (Array.isArray(sourceOrder) ? sourceOrder : []).forEach((value) => {
    const token = String(value || "").trim();
    if (
      allowed.has(token) &&
      !normalized.includes(token)
    ) {
      normalized.push(token);
    }
  });

  candidates.forEach((token) => {
    if (!normalized.includes(token)) {
      normalized.push(token);
    }
  });

  return normalized;
}

function normalizePrintModeBackContentOrder_(sourceOrder, fallbackBlocks) {
  const candidates = fallbackBlocks.map((block) => "custom:" + block.id);
  const allowed = new Set(candidates);
  const normalized = [];

  (Array.isArray(sourceOrder) ? sourceOrder : []).forEach((value) => {
    const token = String(value || "").trim();
    if (allowed.has(token) && !normalized.includes(token)) {
      normalized.push(token);
    }
  });

  candidates.forEach((token) => {
    if (!normalized.includes(token)) {
      normalized.push(token);
    }
  });

  return normalized;
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
