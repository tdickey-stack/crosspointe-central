import crypto from "node:crypto";

import admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

import {mergePreviewSingletonPayload} from "./preview-publish.js";
import {createWayfinderAnswerHandler} from "./wayfinder/answer.js";
import {
  createWayfinderAlphaAccessHandler,
  createWayfinderAlphaSettingsHandler,
  getWayfinderAlphaConfig,
} from "./wayfinder/alpha-access.js";
import {
  buildWayfinderFeaturedEventEntries,
  createWayfinderFeaturedEventProvider,
} from "./wayfinder/featured-events.js";
import {createWayfinderFeaturedEventHealthHandler} from
  "./wayfinder/featured-event-health.js";
import {
  createDeveloperApiWayfinderGenerator,
  DEFAULT_WAYFINDER_MODEL,
} from "./wayfinder/gemini.js";
import {
  createWayfinderAdminFeedbackHandler,
  createWayfinderPublicFeedbackHandler,
} from "./wayfinder/feedback.js";
import {createWayfinderEvaluationHandler} from
  "./wayfinder/evaluations.js";
import {
  createWayfinderKnowledgeChangeGenerator,
  createWayfinderKnowledgeChangeHandler,
  getActiveWayfinderKnowledgeOverrides,
} from "./wayfinder/knowledge-overrides.js";
import {createWayfinderPlanningCenterRetriever} from
  "./wayfinder/planning-center.js";
import {
  findDoorsOpenTimeInText,
  findPlanningCenterTagId,
  getCentralFeaturedEventCandidates,
  getPlanningCenterEventSchedule,
} from "./planning-center/featured-event.js";
import {
  CENTRAL_REGISTRATION_SIGNUP_FIELDS,
  getCentralRegistrationSignups,
} from
  "./planning-center/registrations.js";
import {
  createWayfinderNoticeCommandHandler,
  createWayfinderNoticeDraftGenerator,
  getActiveWayfinderNotices,
} from "./wayfinder/notices.js";
import {createWayfinderPrototypeHandler} from "./wayfinder/prototype.js";
import {
  createWayfinderWebsiteIndexHandler,
  getRelevantWayfinderWebsiteEntries,
} from "./wayfinder/website-index.js";

setGlobalOptions({maxInstances: 10});
admin.initializeApp();

const firestore = admin.firestore();
const getWayfinderFeaturedEvents = createWayfinderFeaturedEventProvider();
const getWayfinderFeaturedEventEntries = async (question) => {
  return buildWayfinderFeaturedEventEntries(
      await getWayfinderFeaturedEvents(), question,
  );
};

const CENTRAL_CACHE_TTL_MS = 2 * 60 * 1000;
const CENTRAL_ALLOWED_ADMIN_EMAIL_DOMAINS = ["crosspointe.tv"];
const CENTRAL_ALLOWED_ADMIN_EMAILS = ["tylerdickey17@gmail.com"];
const CENTRAL_ADMIN_ROOT_DOC_PATH = "centralAdmin/root";
const CENTRAL_ADMIN_USERS_COLLECTION_PATH =
  CENTRAL_ADMIN_ROOT_DOC_PATH + "/users";
const CENTRAL_ADMIN_INVITES_COLLECTION_PATH =
  CENTRAL_ADMIN_ROOT_DOC_PATH + "/invites";
const CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH =
  CENTRAL_ADMIN_ROOT_DOC_PATH + "/changeRequests";
const CENTRAL_ADMIN_AUDIT_LOG_COLLECTION_PATH =
  CENTRAL_ADMIN_ROOT_DOC_PATH + "/auditLog";
const CENTRAL_ADMIN_BULLETIN_MODE_DOC_PATH =
  CENTRAL_ADMIN_ROOT_DOC_PATH + "/public/bulletinMode";
const CHANGE_REQUEST_CLEANUP_LIMIT_PER_STATUS = 25;
const CENTRAL_PUBLIC_SETTINGS_DOC_PATH =
  "centralApp/root/public/settings";
const CENTRAL_PUBLIC_META_DOC_PATH =
  "centralApp/root/public/meta";
const CENTRAL_PUBLIC_SUNDAY_SETTINGS_DOC_PATH =
  "centralApp/root/public/sundaySettings";
const CENTRAL_PUBLIC_THIS_SUNDAY_DOC_PATH =
  "centralApp/root/public/thisSunday";
const CENTRAL_PUBLIC_WHATS_NEW_DOC_PATH =
  "centralApp/root/public/whatsNew";
const CENTRAL_CAMPAIGNS_COLLECTION_PATH =
  "centralContent/campaigns/items";
const CENTRAL_CAMPAIGNS_META_DOC_PATH =
  "centralContent/campaigns/meta/state";
const CENTRAL_NEXT_STEPS_COLLECTION_PATH =
  "centralContent/nextSteps/items";
const CENTRAL_NEXT_STEPS_META_DOC_PATH =
  "centralContent/nextSteps/meta/state";
const CENTRAL_SERVE_NEEDS_COLLECTION_PATH =
  "centralContent/serveNeeds/items";
const CENTRAL_SERVE_NEEDS_META_DOC_PATH =
  "centralContent/serveNeeds/meta/state";
const CENTRAL_RESOURCES_COLLECTION_PATH =
  "centralContent/resources/items";
const CENTRAL_RESOURCES_META_DOC_PATH =
  "centralContent/resources/meta/state";
const CENTRAL_QUICK_LINKS_COLLECTION_PATH =
  "centralContent/quickLinks/items";
const CENTRAL_QUICK_LINKS_META_DOC_PATH =
  "centralContent/quickLinks/meta/state";
const CENTRAL_ROOM_RULES_COLLECTION_PATH =
  "centralContent/roomRules/items";
const CENTRAL_ROOM_RULES_META_DOC_PATH =
  "centralContent/roomRules/meta/state";
const CENTRAL_SERVE_NEEDS_ROOT_DOC_PATH =
  "centralServeNeeds/root";
const CENTRAL_SERVE_NEEDS_INTERESTS_COLLECTION_PATH =
  CENTRAL_SERVE_NEEDS_ROOT_DOC_PATH + "/interests";
const CENTRAL_STATUS_BANNER_DOC_PATH =
  "centralContent/statusBanner/items/live";
const CENTRAL_MAIL_COLLECTION_PATH =
  process.env.CENTRAL_MAIL_COLLECTION_PATH || "mail";
const CENTRAL_GOOGLE_WEB_CLIENT_ID =
  trimEnvString_(process.env.CENTRAL_GOOGLE_WEB_CLIENT_ID) || "";
const CENTRAL_GMAIL_CLIENT_ID =
  trimEnvString_(process.env.CENTRAL_GMAIL_CLIENT_ID) || "";
const CENTRAL_GMAIL_SENDER_EMAIL =
  trimEnvString_(process.env.CENTRAL_GMAIL_SENDER_EMAIL) || "";
const CENTRAL_ADMIN_URL =
  trimEnvString_(process.env.CENTRAL_ADMIN_URL) || "";
const CENTRAL_ADMIN_INVITE_TTL_DAYS = parsePositiveInt_(
    process.env.CENTRAL_ADMIN_INVITE_TTL_DAYS,
    14,
);
const CENTRAL_EMAIL_BRAND_NAME = "CrossPointe Central";
const CENTRAL_EMAIL_SUPPORT_COPY =
  "If you were not expecting this email, you can safely ignore it.";
const HOMEPAGE_MODULE_DEFINITIONS = [
  {id: "statusBanner", defaultEnabled: true},
  {id: "today", defaultEnabled: true},
  {id: "sunday", defaultEnabled: true},
  {id: "events", defaultEnabled: true},
  {id: "registrations", defaultEnabled: true},
  {id: "campaigns", defaultEnabled: true},
  {id: "nextSteps", defaultEnabled: true},
  {id: "serveNeeds", defaultEnabled: true},
  {id: "resources", defaultEnabled: true},
  {id: "quickLinks", defaultEnabled: true},
];
const SUNDAY_MODE_MODULE_DEFINITIONS = [
  {id: "quickActions", defaultEnabled: true},
  {id: "sermonWorship", defaultEnabled: true},
  {id: "watchLive", defaultEnabled: true},
  {id: "scriptureNotes", defaultEnabled: true},
  {id: "today", defaultEnabled: true},
  {id: "events", defaultEnabled: true},
  {id: "registrations", defaultEnabled: false},
  {id: "campaigns", defaultEnabled: false},
  {id: "nextSteps", defaultEnabled: false},
  {id: "serveNeeds", defaultEnabled: false},
  {id: "resources", defaultEnabled: false},
];
const DEFAULT_CENTRAL_ROOM_RULES = [
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Kingdom Kid's",
    display_location: "Children's Center",
    behavior: "replace",
    priority: 10,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Kingdom Kids",
    display_location: "Children's Center",
    behavior: "replace",
    priority: 20,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Children",
    display_location: "Children's Center",
    behavior: "replace",
    priority: 30,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "The Pointe",
    display_location: "The Pointe",
    behavior: "ignore_if_multiple",
    priority: 10,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Student Room",
    display_location: "The Pointe",
    behavior: "replace",
    priority: 20,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Student Center",
    display_location: "The Pointe",
    behavior: "replace",
    priority: 30,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "CC Gym",
    display_location: "Community Center",
    behavior: "replace",
    priority: 10,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Community Center",
    display_location: "Community Center",
    behavior: "ignore_if_multiple",
    priority: 20,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "exact",
    match_text: "Kitchen",
    display_location: "Kitchen",
    behavior: "ignore_if_multiple",
    priority: 90,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "contains",
    match_text: "Cafe",
    display_location: "Cafe",
    behavior: "ignore_if_multiple",
    priority: 90,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "exact",
    match_text: "Weight Room",
    display_location: "Weight Room",
    behavior: "ignore_if_multiple",
    priority: 90,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "exact",
    match_text: "Volleyball Pit",
    display_location: "Volleyball Pit",
    behavior: "ignore_if_multiple",
    priority: 90,
    source: "Legacy sheet fallback",
  },
  {
    active: "TRUE",
    match_type: "exact",
    match_text: "Fitness Room",
    display_location: "Fitness Room",
    behavior: "ignore_if_multiple",
    priority: 90,
    source: "Legacy sheet fallback",
  },
];

// Sensitive server credentials live in Google Cloud Secret Manager. Each
// secret is bound only to the deployed functions that need it below.
const CENTRAL_GMAIL_CLIENT_SECRET =
  defineSecret("CENTRAL_GMAIL_CLIENT_SECRET");
const CENTRAL_GMAIL_REFRESH_TOKEN =
  defineSecret("CENTRAL_GMAIL_REFRESH_TOKEN");
const PCO_APP_ID = defineSecret("PCO_APP_ID");
const PCO_SECRET = defineSecret("PCO_SECRET");
const CENTRAL_CALENDAR_SIGNING_KEY =
  defineSecret("CENTRAL_CALENDAR_SIGNING_KEY");
const GMAIL_SECRETS = [
  CENTRAL_GMAIL_CLIENT_SECRET,
  CENTRAL_GMAIL_REFRESH_TOKEN,
];
const PLANNING_CENTER_SECRETS = [PCO_APP_ID, PCO_SECRET];
const PCO_TIMEZONE = process.env.PCO_TIMEZONE || "America/Chicago";
const PCO_CENTRAL_TAG_NAME = process.env.PCO_CENTRAL_TAG_NAME || "Central";
const PCO_CENTRAL_FEATURED_TAG_NAME =
  process.env.PCO_CENTRAL_FEATURED_TAG_NAME || "Central Featured";
const PCO_CENTRAL_REGISTRATION_CATEGORY_NAME =
  process.env.PCO_CENTRAL_REGISTRATION_CATEGORY_NAME || "Central";
const PCO_WAYFINDER_PRIORITY_TAG_NAME =
  process.env.PCO_WAYFINDER_PRIORITY_TAG_NAME || "Wayfinder Priority";
const PCO_CALENDAR_LOOKAHEAD_DAYS = parsePositiveInt_(
    process.env.PCO_CALENDAR_LOOKAHEAD_DAYS,
    14,
);
const PCO_SERVICE_TYPES = parsePlanningCenterServiceTypes_(
    process.env.PCO_SERVICE_TYPES || "2346:9:00,2345:10:30",
);
const SUNDAY_MODE_START_HOUR = parsePositiveInt_(
    process.env.SUNDAY_MODE_START_HOUR,
    7,
);
const SUNDAY_MODE_END_HOUR = parsePositiveInt_(
    process.env.SUNDAY_MODE_END_HOUR,
    14,
);
const DEFAULT_SUNDAY_MODE_START_TIME =
  formatSundayModeTimeValue_(SUNDAY_MODE_START_HOUR, 0);
const DEFAULT_SUNDAY_MODE_END_TIME =
  formatSundayModeTimeValue_(SUNDAY_MODE_END_HOUR, 0);
const SUNDAY_SERVICE_DURATION_MINUTES = parsePositiveInt_(
    process.env.SUNDAY_SERVICE_DURATION_MINUTES,
    75,
);

// The YouVersion browser SDK requires this app identifier in the client. It is
// intentionally public and must not be treated as a server-only secret.
const YOUVERSION_APP_KEY = process.env.YOUVERSION_APP_KEY || "";
const YOUVERSION_DEFAULT_BIBLE_ID =
  process.env.YOUVERSION_DEFAULT_BIBLE_ID || "3034";
const YOUVERSION_API_BASE_URL = "https://api.youversion.com/v1";
const YOUVERSION_CACHE_TTL_MS = 15 * 60 * 1000;

const cachedCentralDataByMode = new Map();
const cachedBulletinPlanningCenterByRoomRules = new Map();
const BULLETIN_PLANNING_CENTER_CACHE_TTL_MS = 60 * 1000;
const CENTRAL_DATA_ENVIRONMENT_LIVE = "live";
const CENTRAL_DATA_ENVIRONMENT_DEV = "dev";
const CENTRAL_DATA_CACHE_KEY_PREFIX = "published:";

function clearCentralDataCache_() {
  cachedCentralDataByMode.clear();
}
const cachedYouVersionPassages = new Map();
const MANAGED_ADMIN_PAGE_CONFIGS = [
  {key: "hub", label: "Hub"},
  {key: "bulletin", label: "Bulletin Mode"},
  {key: "settings", label: "Settings"},
  {key: "integrations", label: "Integrations"},
  {key: "wayfinder", label: "Wayfinder"},
  {key: "thisSunday", label: "Sunday"},
  {key: "quickLinks", label: "Quick Links"},
  {key: "statusBanner", label: "Status Banner"},
  {key: "resources", label: "Resources"},
  {key: "campaigns", label: "Campaigns"},
  {key: "nextSteps", label: "Next Steps"},
  {key: "serveNeeds", label: "Serve Needs"},
  {key: "roomRules", label: "Room Rules"},
  {key: "changeRequests", label: "Change Requests"},
  {key: "users", label: "Admin Users"},
  {key: "roles", label: "Roles"},
];
const MANAGED_ADMIN_PAGE_KEYS = MANAGED_ADMIN_PAGE_CONFIGS.map((config) => {
  return config.key;
});
const ADMIN_PERMISSION_LABELS = {
  none: "No Access",
  view: "View Only",
  propose: "Propose Changes",
  edit: "Edit & Publish",
  approve: "Approve Changes",
  admin: "Admin",
};

const YOUVERSION_BOOK_ALIASES = [
  {code: "GEN", names: ["genesis", "gen"]},
  {code: "EXO", names: ["exodus", "exo", "exod"]},
  {code: "LEV", names: ["leviticus", "lev"]},
  {code: "NUM", names: ["numbers", "num"]},
  {code: "DEU", names: ["deuteronomy", "deut", "deu"]},
  {code: "JOS", names: ["joshua", "josh", "jos"]},
  {code: "JDG", names: ["judges", "judg", "jdg"]},
  {code: "RUT", names: ["ruth", "rut"]},
  {code: "1SA", names: ["1 samuel", "1 sam", "1sa", "i samuel", "first samuel"]},
  {code: "2SA", names: ["2 samuel", "2 sam", "2sa", "ii samuel", "second samuel"]},
  {code: "1KI", names: ["1 kings", "1 kgs", "1ki", "1 kin", "i kings", "first kings"]},
  {code: "2KI", names: ["2 kings", "2 kgs", "2ki", "2 kin", "ii kings", "second kings"]},
  {code: "1CH", names: ["1 chronicles", "1 chron", "1 chr", "1ch", "i chronicles", "first chronicles"]},
  {code: "2CH", names: ["2 chronicles", "2 chron", "2 chr", "2ch", "ii chronicles", "second chronicles"]},
  {code: "EZR", names: ["ezra", "ezr"]},
  {code: "NEH", names: ["nehemiah", "neh"]},
  {code: "EST", names: ["esther", "est"]},
  {code: "JOB", names: ["job"]},
  {code: "PSA", names: ["psalm", "psalms", "ps", "psa"]},
  {code: "PRO", names: ["proverbs", "prov", "pro"]},
  {code: "ECC", names: ["ecclesiastes", "eccl", "ecc"]},
  {code: "SNG", names: ["song of solomon", "song of songs", "song", "songs", "sos"]},
  {code: "ISA", names: ["isaiah", "isa"]},
  {code: "JER", names: ["jeremiah", "jer"]},
  {code: "LAM", names: ["lamentations", "lam"]},
  {code: "EZK", names: ["ezekiel", "ezek", "ezk"]},
  {code: "DAN", names: ["daniel", "dan"]},
  {code: "HOS", names: ["hosea", "hos"]},
  {code: "JOL", names: ["joel", "jol"]},
  {code: "AMO", names: ["amos", "amo"]},
  {code: "OBA", names: ["obadiah", "obad", "oba"]},
  {code: "JON", names: ["jonah", "jon"]},
  {code: "MIC", names: ["micah", "mic"]},
  {code: "NAM", names: ["nahum", "nah", "nam"]},
  {code: "HAB", names: ["habakkuk", "hab"]},
  {code: "ZEP", names: ["zephaniah", "zeph", "zep"]},
  {code: "HAG", names: ["haggai", "hag"]},
  {code: "ZEC", names: ["zechariah", "zech", "zec"]},
  {code: "MAL", names: ["malachi", "mal"]},
  {code: "MAT", names: ["matthew", "matt", "mat", "mt"]},
  {code: "MRK", names: ["mark", "mrk", "mk"]},
  {code: "LUK", names: ["luke", "luk", "lk"]},
  {code: "JHN", names: ["john", "jhn", "jn"]},
  {code: "ACT", names: ["acts", "act"]},
  {code: "ROM", names: ["romans", "rom"]},
  {code: "1CO", names: ["1 corinthians", "1 cor", "1co", "i corinthians", "first corinthians"]},
  {code: "2CO", names: ["2 corinthians", "2 cor", "2co", "ii corinthians", "second corinthians"]},
  {code: "GAL", names: ["galatians", "gal"]},
  {code: "EPH", names: ["ephesians", "eph"]},
  {code: "PHP", names: ["philippians", "phil", "php"]},
  {code: "COL", names: ["colossians", "col"]},
  {code: "1TH", names: ["1 thessalonians", "1 thess", "1 thes", "1th", "i thessalonians", "first thessalonians"]},
  {code: "2TH", names: ["2 thessalonians", "2 thess", "2 thes", "2th", "ii thessalonians", "second thessalonians"]},
  {code: "1TI", names: ["1 timothy", "1 tim", "1ti", "i timothy", "first timothy"]},
  {code: "2TI", names: ["2 timothy", "2 tim", "2ti", "ii timothy", "second timothy"]},
  {code: "TIT", names: ["titus", "tit"]},
  {code: "PHM", names: ["philemon", "phlm", "phm"]},
  {code: "HEB", names: ["hebrews", "heb"]},
  {code: "JAS", names: ["james", "jas", "jm"]},
  {code: "1PE", names: ["1 peter", "1 pet", "1pe", "i peter", "first peter"]},
  {code: "2PE", names: ["2 peter", "2 pet", "2pe", "ii peter", "second peter"]},
  {code: "1JN", names: ["1 john", "1 jn", "1jn", "i john", "first john"]},
  {code: "2JN", names: ["2 john", "2 jn", "2jn", "ii john", "second john"]},
  {code: "3JN", names: ["3 john", "3 jn", "3jn", "iii john", "third john"]},
  {code: "JUD", names: ["jude", "jud"]},
  {code: "REV", names: ["revelation", "revelations", "rev"]},
];

const YOUVERSION_BOOK_LOOKUP = buildYouVersionBookLookup_();
const YOUVERSION_BOOK_KEYS = Object.keys(YOUVERSION_BOOK_LOOKUP).sort(
    (a, b) => b.length - a.length,
);

export const centralData = onRequest(
    {
      region: "us-central1",
      cors: true,
      secrets: [
        ...PLANNING_CENTER_SECRETS,
        CENTRAL_CALENDAR_SIGNING_KEY,
      ],
    },
    async (request, response) => {
      if (request.method !== "GET") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      try {
        const environment = getCentralDataEnvironment_(request);
        const cacheKey = CENTRAL_DATA_CACHE_KEY_PREFIX + environment;
        const cachedEntry = cachedCentralDataByMode.get(
            cacheKey,
        ) || null;

        if (
          cachedEntry &&
          cachedEntry.data &&
          (Date.now() - cachedEntry.fetchedAt) < CENTRAL_CACHE_TTL_MS
        ) {
          const refreshedData = await refreshCentralSundayModeData_(
              cachedEntry.data,
              environment,
          );
          cachedEntry.data = refreshedData;
          response.set("Cache-Control", "no-store");
          response.status(200).json(refreshedData);
          return;
        }

        const combinedData = await buildCentralDataPayload_(environment);
        const payload = {
          ...combinedData,
          youVersionAppKey: YOUVERSION_APP_KEY,
        };
        cachedCentralDataByMode.set(cacheKey, {
          data: payload,
          fetchedAt: Date.now(),
        });

        response.set("Cache-Control", "no-store");
        response.status(200).json(payload);
      } catch (error) {
        response.status(500).json({
          error: error && error.message ?
            error.message :
            "Unable to load CrossPointe Central.",
        });
      }
    },
);

export const wayfinderPrototypeQuery = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    createWayfinderPrototypeHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      getActiveKnowledgeOverrides: () =>
        getActiveWayfinderKnowledgeOverrides(firestore),
    }),
);

// Stored in Secret Manager and exposed only to the Wayfinder answer function.
const WAYFINDER_GEMINI_API_KEY = defineSecret("WAYFINDER_GEMINI_API_KEY");
const wayfinderGeminiGenerator = createDeveloperApiWayfinderGenerator({
  getApiKey: () => WAYFINDER_GEMINI_API_KEY.value(),
  model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
  onUsage: (metrics) => {
    console.info("Wayfinder Gemini usage.", metrics);
  },
});
const wayfinderNoticeDraftGenerator = createWayfinderNoticeDraftGenerator({
  getApiKey: () => WAYFINDER_GEMINI_API_KEY.value(),
  model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
  timezone: PCO_TIMEZONE,
});
const wayfinderKnowledgeChangeGenerator =
  createWayfinderKnowledgeChangeGenerator({
    getApiKey: () => WAYFINDER_GEMINI_API_KEY.value(),
    model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
  });
const wayfinderEvaluationAnswerHandler = createWayfinderAnswerHandler({
  admin: admin,
  firestore: firestore,
  generateAnswer: wayfinderGeminiGenerator,
  retrieveLiveContext: getWayfinderPlanningCenterContext_,
  getActiveNotices: () => getActiveWayfinderNotices(firestore),
  getActiveKnowledgeOverrides: () =>
    getActiveWayfinderKnowledgeOverrides(firestore),
  getWebsiteEntries: (question) =>
    getRelevantWayfinderWebsiteEntries(firestore, question),
  getFeaturedEventEntries: getWayfinderFeaturedEventEntries,
  requireAdminAuth: false,
  publicResponse: false,
  model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
});

export const wayfinderNoticeCommand = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 60,
      memory: "256MiB",
      secrets: [WAYFINDER_GEMINI_API_KEY],
    },
    createWayfinderNoticeCommandHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      generateDraft: wayfinderNoticeDraftGenerator,
    }),
);

export const wayfinderKnowledgeChange = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 60,
      memory: "256MiB",
      secrets: [WAYFINDER_GEMINI_API_KEY],
    },
    createWayfinderKnowledgeChangeHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      generateChange: wayfinderKnowledgeChangeGenerator,
    }),
);

export const wayfinderWebsiteIndex = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 180,
      memory: "512MiB",
    },
    createWayfinderWebsiteIndexHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
    }),
);

export const wayfinderFeaturedEventHealth = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 60,
      memory: "256MiB",
      secrets: PLANNING_CENTER_SECRETS,
    },
    createWayfinderFeaturedEventHealthHandler({
      admin,
      firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      getFeaturedEvents: getWayfinderFeaturedEvents,
      fetchJson: fetchPcoJson_,
      timezone: PCO_TIMEZONE,
    }),
);

export const wayfinderPublicFeedback = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 30,
      memory: "256MiB",
    },
    createWayfinderPublicFeedbackHandler({
      admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      requireEnabled: async () => {
        const config = await getWayfinderAlphaConfig(firestore);
        return config.enabled;
      },
      serverTimestamp: () =>
        admin.firestore.FieldValue.serverTimestamp(),
    }),
);

export const wayfinderAdminFeedback = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 30,
      memory: "256MiB",
    },
    createWayfinderAdminFeedbackHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      serverTimestamp: () =>
        admin.firestore.FieldValue.serverTimestamp(),
    }),
);

export const wayfinderEvaluations = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 300,
      memory: "512MiB",
      secrets: [WAYFINDER_GEMINI_API_KEY, ...PLANNING_CENTER_SECRETS],
    },
    createWayfinderEvaluationHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      serverTimestamp: () =>
        admin.firestore.FieldValue.serverTimestamp(),
      executeCase: executeWayfinderEvaluationCase_,
    }),
);

export const wayfinderGenerateAnswer = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 60,
      memory: "256MiB",
      secrets: [WAYFINDER_GEMINI_API_KEY, ...PLANNING_CENTER_SECRETS],
    },
    createWayfinderAnswerHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      generateAnswer: wayfinderGeminiGenerator,
      retrieveLiveContext: getWayfinderPlanningCenterContext_,
      getActiveNotices: () => getActiveWayfinderNotices(firestore),
      getActiveKnowledgeOverrides: () =>
        getActiveWayfinderKnowledgeOverrides(firestore),
      getWebsiteEntries: (question) =>
        getRelevantWayfinderWebsiteEntries(firestore, question),
      getFeaturedEventEntries: getWayfinderFeaturedEventEntries,
      model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
    }),
);

export const wayfinderAlphaAccess = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 30,
      memory: "256MiB",
    },
    createWayfinderAlphaAccessHandler({
      admin,
      firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
    }),
);

export const wayfinderAlphaSettings = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 30,
      memory: "256MiB",
    },
    createWayfinderAlphaSettingsHandler({
      admin,
      firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
    }),
);

export const wayfinderPublicAnswer = onRequest(
    {
      region: "us-central1",
      cors: true,
      timeoutSeconds: 60,
      memory: "256MiB",
      secrets: [WAYFINDER_GEMINI_API_KEY, ...PLANNING_CENTER_SECRETS],
    },
    createWayfinderAnswerHandler({
      admin: admin,
      firestore: firestore,
      isAllowedAdminEmail: isAllowedCentralAdminEmail_,
      getAdminUserDocPath: getCentralAdminUserDocPath_,
      generateAnswer: wayfinderGeminiGenerator,
      retrieveLiveContext: getWayfinderPlanningCenterContext_,
      getActiveNotices: () => getActiveWayfinderNotices(firestore),
      getActiveKnowledgeOverrides: () =>
        getActiveWayfinderKnowledgeOverrides(firestore),
      getWebsiteEntries: (question) =>
        getRelevantWayfinderWebsiteEntries(firestore, question),
      getFeaturedEventEntries: getWayfinderFeaturedEventEntries,
      requireEnabled: async () => {
        const config = await getWayfinderAlphaConfig(firestore);
        return config.enabled;
      },
      publicResponse: true,
      model: process.env.WAYFINDER_GEMINI_MODEL || DEFAULT_WAYFINDER_MODEL,
    }),
);

/**
 * Retrieves sanitized public Planning Center context for Wayfinder.
 *
 * @param {Object} request Live-source request from the Wayfinder handler.
 * @return {Promise<Object>} Sanitized live entries and source statuses.
 */
async function getWayfinderPlanningCenterContext_(request) {
  const roomRulesOverride = await getFirestoreRoomRulesOverride_();
  const roomRules = roomRulesOverride.shouldOverride ?
    roomRulesOverride.items : getDefaultCentralRoomRules_();
  const retriever = createWayfinderPlanningCenterRetriever({
    fetchJson: fetchPcoJson_,
    timezone: PCO_TIMEZONE,
    centralTagName: PCO_CENTRAL_TAG_NAME,
    priorityTagName: PCO_WAYFINDER_PRIORITY_TAG_NAME,
    getFeaturedEvents: getWayfinderFeaturedEvents,
    resolveEventRooms: (instanceId) => {
      return getEventInstanceRooms_(instanceId, roomRules);
    },
  });
  return retriever(request);
}

/**
 * Runs one curated evaluation case through the private diagnostic pipeline.
 *
 * @param {Object} testCase Curated evaluation case.
 * @return {Promise<Object>} Private Wayfinder answer payload.
 */
async function executeWayfinderEvaluationCase_(testCase) {
  const conversation = Array.isArray(testCase.conversation) ?
    testCase.conversation : [];
  const finalMessage = conversation[conversation.length - 1] || {};
  return new Promise((resolve, reject) => {
    const response = {
      set: () => response,
      status: (statusCode) => {
        response.statusCode = statusCode;
        return response;
      },
      json: (body) => {
        if (response.statusCode >= 400) {
          reject(new Error(String(body && body.error || "Evaluation failed.")));
          return;
        }
        resolve(body);
      },
      statusCode: 200,
    };
    wayfinderEvaluationAnswerHandler({
      method: "POST",
      headers: {
        "x-wayfinder-session": "evaluation-" + crypto.randomUUID(),
      },
      ip: "wayfinder-evaluation",
      body: {
        question: String(finalMessage.content || ""),
        history: conversation.slice(0, -1),
      },
    }, response).catch(reject);
  });
}

export const centralCalendarEvent = onRequest(
    {
      region: "us-central1",
      cors: true,
      secrets: [CENTRAL_CALENDAR_SIGNING_KEY],
    },
    (request, response) => {
      if (request.method !== "GET") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      try {
        const event = decodeCalendarEventToken_(
            request.query.event,
            request.query.signature,
        );
        const calendar = buildIcsCalendar_(event);
        const forceDownload = String(request.query.download || "") === "1";

        response.set("Cache-Control", "public, max-age=300");
        response.set("Content-Type", "text/calendar; charset=utf-8");
        response.set("X-Content-Type-Options", "nosniff");
        response.set(
            "Content-Disposition",
            (forceDownload ? "attachment" : "inline") +
              "; filename=\"" + calendar.filename + "\"",
        );
        response.status(200).send(calendar.content);
      } catch (error) {
        response.status(400).json({
          error: "This calendar event link is invalid or has expired.",
        });
      }
    },
);

export const sundayScripture = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "GET") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      if (!YOUVERSION_APP_KEY) {
        response.status(500).json({
          error: "YOUVERSION_APP_KEY is missing in functions/.env.",
        });
        return;
      }

      const reference = String(request.query.reference || "").trim();
      const bibleId = String(
          request.query.bible_id || YOUVERSION_DEFAULT_BIBLE_ID || "",
      ).trim();

      if (!reference) {
        response.status(400).json({
          error: "A scripture reference is required.",
        });
        return;
      }

      if (!bibleId) {
        response.status(400).json({
          error: "A YouVersion Bible ID is required.",
        });
        return;
      }

      const parsedReference = parseYouVersionReference_(reference);
      if (!parsedReference) {
        response.status(400).json({
          error: "Could not parse the scripture reference. Use a format like John 3:16 or 1 Kings 8.",
        });
        return;
      }

      const cacheKey = bibleId + ":" + parsedReference.usfm;
      const cachedPassage = cachedYouVersionPassages.get(cacheKey);

      if (
        cachedPassage &&
        (Date.now() - cachedPassage.savedAt) < YOUVERSION_CACHE_TTL_MS
      ) {
        response.set("Cache-Control", "no-store");
        response.status(200).json(cachedPassage.payload);
        return;
      }

      try {
        const upstreamUrl =
          YOUVERSION_API_BASE_URL +
          "/bibles/" + encodeURIComponent(bibleId) +
          "/passages/" + encodeURIComponent(parsedReference.usfm);

        const upstreamResponse = await fetch(upstreamUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-YVP-App-Key": YOUVERSION_APP_KEY,
          },
        });

        const upstreamText = await upstreamResponse.text();
        let upstreamPayload = null;

        try {
          upstreamPayload = JSON.parse(upstreamText);
        } catch (error) {
          response.status(502).json({
            error: "YouVersion returned a non-JSON response.",
            detail: upstreamText.slice(0, 300),
          });
          return;
        }

        if (!upstreamResponse.ok) {
          const statusCode =
            upstreamResponse.status >= 400 &&
            upstreamResponse.status < 500 ?
              upstreamResponse.status :
              502;

          response.status(statusCode).json({
            error:
              extractBestMessage_(upstreamPayload) ||
              "Could not load the YouVersion passage.",
          });
          return;
        }

        const extractedPassage = extractYouVersionPassageContent_(upstreamPayload);
        if (!extractedPassage || (!extractedPassage.html && !extractedPassage.text)) {
          response.status(502).json({
            error: "YouVersion returned data, but Central could not extract the passage text.",
          });
          return;
        }

        const payload = {
          reference: reference,
          normalizedReference: parsedReference.displayReference,
          usfm: parsedReference.usfm,
          bibleId: bibleId,
          html: extractedPassage.html,
          text: extractedPassage.text,
          sourceUrl: buildBibleDotComSearchUrl_(reference),
        };

        cachedYouVersionPassages.set(cacheKey, {
          savedAt: Date.now(),
          payload: payload,
        });

        response.set("Cache-Control", "no-store");
        response.status(200).json(payload);
      } catch (error) {
        response.status(500).json({
          error: error && error.message ?
            error.message :
            "Unable to reach YouVersion.",
        });
      }
    },
);

export const bootstrapFirstAdminUser = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      const email = normalizeAdminEmail_(decodedToken.email);
      if (!isAllowedCentralAdminEmail_(email)) {
        response.status(403).json({
          error:
            "Use a CrossPointe account or an explicitly allowed tester account to bootstrap the first admin user.",
        });
        return;
      }

      try {
        const bootstrapResult = await createFirstAdminUser_(decodedToken);

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          status: bootstrapResult.status,
          path: getCentralAdminUserDocPath_(decodedToken.uid),
          message: bootstrapResult.status === "exists" ?
            "Your admin user record already exists. Reloading it now is safe." :
            "Your first admin access record was created successfully.",
        });
      } catch (error) {
        const statusCode =
          error && error.code === "bootstrap-closed" ? 409 : 500;

        response.status(statusCode).json({
          error: getFirstAdminBootstrapErrorMessage_(error),
          code: error && error.code ? error.code : "",
          path: getCentralAdminUserDocPath_(decodedToken.uid),
        });
      }
    },
);

export const listAdminUsers = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "GET") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      try {
        await verifyAdminUserManagerAccess_(decodedToken);
        const [userSnapshot, inviteSnapshot] = await Promise.all([
          firestore
              .collection(CENTRAL_ADMIN_USERS_COLLECTION_PATH)
              .get(),
          firestore
              .collection(CENTRAL_ADMIN_INVITES_COLLECTION_PATH)
              .where("status", "==", "pending")
              .get(),
        ]);

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          items: userSnapshot.docs
              .map((docSnapshot) => normalizeManagedAdminUserResponse_(
                  docSnapshot,
              ))
              .concat(
                  inviteSnapshot.docs.map((docSnapshot) => {
                    return normalizeManagedAdminInviteResponse_(docSnapshot);
                  }),
              )
              .sort((leftItem, rightItem) => {
                const leftLabel = String(
                    leftItem.displayName ||
                    leftItem.email ||
                    leftItem.uid ||
                    "",
                ).toLowerCase();
                const rightLabel = String(
                    rightItem.displayName ||
                    rightItem.email ||
                    rightItem.uid ||
                    "",
                ).toLowerCase();

                return leftLabel.localeCompare(rightLabel);
              }),
        });
      } catch (error) {
        response.status(getAdminUserManagementStatusCode_(error)).json({
          error: getAdminUserManagementErrorMessage_(error),
          code: error && error.code ? error.code : "",
        });
      }
    },
);

export const upsertAdminUser = onRequest(
    {
      region: "us-central1",
      cors: true,
      secrets: GMAIL_SECRETS,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      try {
        const manager = await verifyAdminUserManagerAccess_(decodedToken);
        const upsertResult = await upsertAdminUserRecord_(
            manager,
            request.body && typeof request.body === "object" ?
              request.body :
              {},
            request,
        );

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          uid: upsertResult.uid,
          inviteId: upsertResult.inviteId || "",
          recordType: upsertResult.recordType || "user",
          path: upsertResult.recordType === "invite" ?
            getCentralAdminInviteDocPath_(upsertResult.inviteId) :
            getCentralAdminUserDocPath_(upsertResult.uid),
          message: upsertResult.message,
        });
      } catch (error) {
        response.status(getAdminUserManagementStatusCode_(error)).json({
          error: getAdminUserManagementErrorMessage_(error),
          code: error && error.code ? error.code : "",
        });
      }
    },
);

export const deleteAdminUser = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      try {
        const manager = await verifyAdminUserManagerAccess_(decodedToken);
        const deleteResult = await deleteAdminUserRecord_(
            manager,
            request.body && typeof request.body === "object" ?
              request.body :
              {},
        );

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          uid: deleteResult.uid || "",
          inviteId: deleteResult.inviteId || "",
          recordType: deleteResult.recordType || "user",
          message: deleteResult.message,
        });
      } catch (error) {
        response.status(getAdminUserManagementStatusCode_(error)).json({
          error: getAdminUserManagementErrorMessage_(error),
          code: error && error.code ? error.code : "",
        });
      }
    },
);

export const claimAdminInvite = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      try {
        const claimResult = await claimAdminInvite_(
            decodedToken,
            request.body && typeof request.body === "object" ?
              request.body :
              {},
        );

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          uid: claimResult.uid,
          inviteId: claimResult.inviteId,
          message: claimResult.message,
          path: getCentralAdminUserDocPath_(claimResult.uid),
        });
      } catch (error) {
        response.status(getAdminUserManagementStatusCode_(error)).json({
          error: getAdminUserManagementErrorMessage_(error),
          code: error && error.code ? error.code : "",
        });
      }
    },
);

export const bulletinMode = onRequest(
    {
      region: "us-central1",
      cors: true,
      secrets: PLANNING_CENTER_SECRETS,
    },
    async (request, response) => {
      if (request.method !== "GET" && request.method !== "POST") {
        response.status(405).json({error: "Method not allowed."});
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      try {
        const actor = await verifyBulletinModeAccess_(
            decodedToken,
            request.method === "POST",
        );

        if (request.method === "GET") {
          const [
            snapshot,
            roomRulesOverride,
            campaignsOverride,
            serveNeedsOverride,
          ] = await Promise.all([
            firestore.doc(CENTRAL_ADMIN_BULLETIN_MODE_DOC_PATH).get(),
            getFirestoreRoomRulesOverride_(),
            getFirestoreCampaignsOverride_(),
            getFirestoreServeNeedsOverride_(),
          ]);
          const roomRules = roomRulesOverride.shouldOverride ?
            roomRulesOverride.items :
            getDefaultCentralRoomRules_();
          const bulletinPlanningCenter =
            await getBulletinPlanningCenterData_(roomRules);
          response.set("Cache-Control", "no-store");
          response.status(200).json({
            ok: true,
            config: normalizeBulletinModePayload_(
              snapshot.exists ? snapshot.data() : {},
            ),
            events: bulletinPlanningCenter.events,
            content: {
              featuredEvent: bulletinPlanningCenter.featuredEvent,
              campaigns: campaignsOverride.shouldOverride ?
                campaignsOverride.items :
                [],
              serveNeeds: serveNeedsOverride.shouldOverride ?
                serveNeedsOverride.items :
                [],
            },
          });
          return;
        }

        const config = normalizeBulletinModePayload_(
            request.body && typeof request.body === "object" ?
              request.body :
              {},
        );
        await firestore.doc(CENTRAL_ADMIN_BULLETIN_MODE_DOC_PATH).set({
          ...config,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUid: actor.uid,
          updatedByEmail: actor.email,
        });

        await writeBulletinModeAuditLog_(actor, config.events.length);

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          config: config,
          message: "Bulletin Mode settings saved.",
        });
      } catch (error) {
        response.status(getBulletinModeStatusCode_(error)).json({
          error: getBulletinModeErrorMessage_(error),
          code: error && error.code ? error.code : "",
        });
      }
    },
);

export const publishPreviewContent = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      const requestBody = request.body && typeof request.body === "object" ?
        request.body :
        {};
      const section = normalizePreviewPublishSection_(requestBody.section);
      const operation = normalizePreviewPublishOperation_(requestBody.operation);
      const payload = requestBody.payload;

      if (!section) {
        response.status(400).json({
          error: "Choose a section to publish.",
          code: "invalid-section",
        });
        return;
      }

      if (operation === "hide" && section !== "statusBanner") {
        response.status(400).json({
          error: "Only the status banner supports the hide action.",
          code: "invalid-operation",
        });
        return;
      }

      try {
        const publisher = await verifyPreviewPublisherAccess_(
            decodedToken,
            section,
        );
        const normalizedPayload = normalizePreviewSectionPayload_(
            section,
            operation,
            payload,
        );
        const resolvedPayload = await resolveDirectPreviewPublishPayload_(
            section,
            requestBody,
            normalizedPayload,
        );
        const publishResult = await publishPreviewSectionPayload_(
            section,
            operation,
            resolvedPayload,
            publisher,
        );

        clearCentralDataCache_();

        await writePreviewPublishAuditLog_(
            publisher,
            section,
            operation,
            publishResult,
        );

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          section: section,
          operation: operation,
          itemCount: publishResult.itemCount || 0,
          clearedToFallback: publishResult.clearedToFallback === true,
          message: publishResult.message,
        });
      } catch (error) {
        response.status(getPreviewPublishStatusCode_(error)).json({
          error: getPreviewPublishErrorMessage_(error),
          code: error && error.code ? error.code : "",
          section: section,
          operation: operation,
        });
      }
    },
);

export const submitChangeRequest = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      const requestBody = request.body && typeof request.body === "object" ?
        request.body :
        {};
      const section = normalizePreviewPublishSection_(requestBody.section);
      const operation = normalizePreviewPublishOperation_(requestBody.operation);

      if (!section) {
        response.status(400).json({
          error: "Choose a section before submitting a change request.",
          code: "invalid-section",
        });
        return;
      }

      if (operation === "hide" && section !== "statusBanner") {
        response.status(400).json({
          error: "Only the status banner supports the hide action.",
          code: "invalid-operation",
        });
        return;
      }

      try {
        const submitter = await verifyChangeRequestSubmitterAccess_(
            decodedToken,
            section,
        );
        const normalizedPayload = normalizePreviewSectionPayload_(
            section,
            operation,
            requestBody.payload,
        );
        const changeRequestMetadata = await buildChangeRequestMetadata_(
            section,
            operation,
            normalizedPayload,
            requestBody,
        );
        const summary = changeRequestMetadata.summary;
        const requestDocPayload = {
          target: "preview",
          section: section,
          sectionLabel: getPreviewSectionLabel_(section),
          operation: operation,
          status: "pending",
          summary: summary,
          payload: normalizedPayload,
          submittedByUid: submitter.uid,
          submittedByEmail: submitter.email,
          submittedByName: submitter.displayName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (
          changeRequestMetadata &&
          changeRequestMetadata.requestFields &&
          typeof changeRequestMetadata.requestFields === "object"
        ) {
          Object.assign(requestDocPayload, changeRequestMetadata.requestFields);
        }
        const requestRef = await firestore
            .collection(CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH)
            .add(requestDocPayload);

        await writeChangeRequestAuditLog_({
          action: "submitChangeRequest",
          actor: submitter,
          section: section,
          operation: operation,
          requestId: requestRef.id,
          summary: summary,
          status: "pending",
        });
        await cleanupReviewedChangeRequests_();

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          requestId: requestRef.id,
          message:
            "Your change request was submitted for approval.",
        });
      } catch (error) {
        response.status(getChangeRequestStatusCode_(error)).json({
          error: getChangeRequestErrorMessage_(error),
          code: error && error.code ? error.code : "",
          section: section,
          operation: operation,
        });
      }
    },
);

export const reviewChangeRequest = onRequest(
    {
      region: "us-central1",
      cors: true,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const idToken = getBearerToken_(request.headers.authorization);
      if (!idToken) {
        response.status(401).json({
          error: "Missing Firebase ID token. Sign in again and retry.",
        });
        return;
      }

      let decodedToken = null;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        response.status(401).json({
          error: "Your Firebase sign-in expired. Sign in again and retry.",
        });
        return;
      }

      const requestBody = request.body && typeof request.body === "object" ?
        request.body :
        {};
      const requestId = String(requestBody.requestId || "").trim();
      const decision = normalizeChangeRequestDecision_(requestBody.decision);

      if (!requestId) {
        response.status(400).json({
          error: "Choose a change request before reviewing it.",
          code: "missing-request-id",
        });
        return;
      }

      if (!decision) {
        response.status(400).json({
          error: "Choose approve or reject before continuing.",
          code: "invalid-decision",
        });
        return;
      }

      try {
        const reviewer = await verifyChangeRequestReviewerAccess_(decodedToken);
        const requestRef = firestore
            .collection(CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH)
            .doc(requestId);
        const requestSnapshot = await requestRef.get();

        if (!requestSnapshot.exists) {
          throw createChangeRequestError_(
              "change-request-missing",
              "That change request could not be found.",
          );
        }

        const requestData = requestSnapshot.data() || {};
        if (String(requestData.status || "") !== "pending") {
          throw createChangeRequestError_(
              "change-request-closed",
              "That change request has already been reviewed.",
          );
        }

        let message = "";

        if (decision === "approve") {
          const approvedPayload = await resolveChangeRequestPayloadForApproval_(
              requestData,
          );
          const publishResult = await publishPreviewSectionPayload_(
              String(requestData.section || "").trim(),
              normalizePreviewPublishOperation_(requestData.operation),
              approvedPayload,
              reviewer,
          );

          clearCentralDataCache_();
          message = publishResult && publishResult.message ?
            publishResult.message :
            "Change request approved and published.";
        } else {
          message = "Change request rejected.";
        }

        await writeChangeRequestAuditLog_({
          action: "reviewChangeRequest",
          actor: reviewer,
          section: String(requestData.section || "").trim(),
          operation: normalizePreviewPublishOperation_(requestData.operation),
          requestId: requestId,
          summary: String(requestData.summary || "").trim(),
          status: decision === "approve" ? "approved" : "rejected",
        });
        await requestRef.delete();
        await cleanupReviewedChangeRequests_();

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          requestId: requestId,
          decision: decision,
          message: message,
        });
      } catch (error) {
        response.status(getChangeRequestStatusCode_(error)).json({
          error: getChangeRequestErrorMessage_(error),
          code: error && error.code ? error.code : "",
          requestId: requestId,
          decision: decision,
        });
      }
    },
);

export const shareServeNeedInterest = onRequest(
    {
      region: "us-central1",
      cors: true,
      secrets: GMAIL_SECRETS,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).json({
          error: "Method not allowed.",
        });
        return;
      }

      const requestBody = request.body && typeof request.body === "object" ?
        request.body :
        {};
      const serveNeedId = String(requestBody.serveNeedId || "").trim();
      const fallbackServeNeed =
        requestBody.serveNeed && typeof requestBody.serveNeed === "object" ?
          requestBody.serveNeed :
          null;
      const name = String(requestBody.name || "").trim();
      const email = String(requestBody.email || "").trim();
      const phone = String(requestBody.phone || "").trim();
      const preferredContactMethod = String(
          requestBody.preferredContactMethod || "",
      ).trim().toLowerCase();
      const additionalNotes = String(
          requestBody.additionalNotes || "",
      ).trim();

      if (!serveNeedId && !fallbackServeNeed) {
        response.status(400).json({
          error: "Choose a serve need before submitting your interest.",
          code: "missing-serve-need-id",
        });
        return;
      }

      if (!name) {
        response.status(400).json({
          error: "Enter your name before submitting.",
          code: "invalid-payload",
        });
        return;
      }

      if (!looksLikeEmailAddress_(email)) {
        response.status(400).json({
          error: "Enter a valid email address before submitting.",
          code: "invalid-payload",
        });
        return;
      }

      if (
        preferredContactMethod !== "email" &&
        preferredContactMethod !== "text"
      ) {
        response.status(400).json({
          error: "Choose Email or Text as your preferred contact method.",
          code: "invalid-payload",
        });
        return;
      }

      if (preferredContactMethod === "text" && !phone) {
        response.status(400).json({
          error: "Add a phone number if you prefer to be contacted by text.",
          code: "invalid-payload",
        });
        return;
      }

      try {
        let serveNeedData = {};
        let serveNeedSource = "firestore";

        if (serveNeedId) {
          const serveNeedRef = firestore
              .collection(CENTRAL_SERVE_NEEDS_COLLECTION_PATH)
              .doc(serveNeedId);
          const serveNeedSnapshot = await serveNeedRef.get();

          if (!serveNeedSnapshot.exists) {
            response.status(404).json({
              error: "That serve need could not be found. Refresh Central and try again.",
              code: "serve-need-missing",
            });
            return;
          }

          serveNeedData = serveNeedSnapshot.data() || {};

          if (!isTruthyValue_(serveNeedData.active)) {
            response.status(409).json({
              error: "That serve need is no longer active. Refresh Central and try again.",
              code: "serve-need-inactive",
            });
            return;
          }
        } else {
          serveNeedSource = "fallback";
          serveNeedData = {
            need: String(fallbackServeNeed.need || "").trim(),
            ministry: String(fallbackServeNeed.ministry || "").trim(),
            priority: normalizeServeNeedPriorityValue_(
                fallbackServeNeed.priority || "",
            ),
            description: String(fallbackServeNeed.description || "").trim(),
            button_text: String(fallbackServeNeed.button_text || "").trim(),
            contact_email: String(
                fallbackServeNeed.contact_email || "",
            ).trim().toLowerCase(),
            active: true,
          };

          if (!serveNeedData.need) {
            response.status(400).json({
              error: "Choose a serve need before submitting your interest.",
              code: "invalid-payload",
            });
            return;
          }

          if (!looksLikeEmailAddress_(serveNeedData.contact_email)) {
            response.status(400).json({
              error: "That serve need is missing a valid contact email address.",
              code: "invalid-payload",
            });
            return;
          }
        }

        const interestRef = firestore
            .collection(CENTRAL_SERVE_NEEDS_INTERESTS_COLLECTION_PATH)
            .doc();
        const interestRecord = {
          serveNeedId: serveNeedId,
          serveNeedSource: serveNeedSource,
          serveNeedNeed: String(serveNeedData.need || "").trim(),
          serveNeedMinistry: String(serveNeedData.ministry || "").trim(),
          serveNeedPriority: String(serveNeedData.priority || "").trim(),
          serveNeedDescription: String(
              serveNeedData.description || "",
          ).trim(),
          serveNeedButtonText: String(
              serveNeedData.button_text || "",
          ).trim(),
          contactEmail: String(
              serveNeedData.contact_email || "",
          ).trim(),
          notifyMethod: "email",
          name: name,
          email: email,
          phone: phone,
          preferredContactMethod: preferredContactMethod,
          additionalNotes: additionalNotes,
          status: "pending",
          notificationStatus: "pending",
          notificationAttempts: 0,
          sourceHost: getCentralRequestHostname_(request),
          userAgent: String(
              request.headers["user-agent"] || "",
          ).trim(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await interestRef.set(interestRecord);

        try {
          await queueServeNeedInterestNotification_(
              interestRef.id,
              interestRecord,
          );
        } catch (notificationError) {
          console.error(
              "Serve Need interest email failed.",
              notificationError,
          );

          await markServeNeedInterestNotificationFailed_(
              interestRef.id,
              notificationError,
          );

          response.status(502).json({
            error:
              getServeNeedInterestNotificationErrorMessage_(
                  notificationError,
              ),
            code: "notification-failed",
            saved: true,
          });
          return;
        }

        response.set("Cache-Control", "no-store");
        response.status(200).json({
          ok: true,
          message: "Your interest was shared successfully.",
          need: String(serveNeedData.need || "").trim(),
          ministry: String(serveNeedData.ministry || "").trim(),
          notificationStatus: "sent",
        });
      } catch (error) {
        console.error("Serve Need interest submit failed.", error);
        response.status(500).json({
          error: "We could not submit your interest right now. Please try again.",
          code: "submit-failed",
        });
      }
    },
);

export const syncServeNeedInterestNotificationStatus = onDocumentWritten(
    {
      region: "us-central1",
      document: CENTRAL_MAIL_COLLECTION_PATH + "/{mailId}",
    },
    async (event) => {
      const afterSnapshot = event.data && event.data.after;

      if (!afterSnapshot || !afterSnapshot.exists) {
        return;
      }

      const mailData = afterSnapshot.data() || {};
      const delivery = mailData.delivery || {};
      const deliveryState = String(delivery.state || "").trim().toUpperCase();

      if (!deliveryState) {
        return;
      }

      const mailId = String(event.params.mailId || "").trim();

      if (!mailId) {
        return;
      }

      const interestSnapshot = await firestore
          .collection(CENTRAL_SERVE_NEEDS_INTERESTS_COLLECTION_PATH)
          .where("notificationMailDocId", "==", mailId)
          .limit(1)
          .get();

      if (interestSnapshot.empty) {
        return;
      }

      const interestRef = interestSnapshot.docs[0].ref;
      const update = {
        notificationLastDeliveryState: deliveryState,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (typeof delivery.attempts === "number" && delivery.attempts > 0) {
        update.notificationAttempts = delivery.attempts;
      }

      if (delivery.info &&
        typeof delivery.info.messageId === "string" &&
        delivery.info.messageId.trim()) {
        update.notificationMessageId = delivery.info.messageId.trim();
      }

      if (deliveryState === "SUCCESS") {
        update.notificationStatus = "sent";
        update.notificationSentAt =
          admin.firestore.FieldValue.serverTimestamp();
      } else if (deliveryState === "ERROR") {
        update.notificationStatus = "failed";
        update.notificationError = String(
            delivery.error || "Unknown notification failure.",
        ).slice(0, 500);
      } else if (deliveryState === "RETRY") {
        update.notificationStatus = "retry";
        update.notificationError = String(
            delivery.error || "Notification delivery is being retried.",
        ).slice(0, 500);
      } else {
        update.notificationStatus = "queued";
      }

      await interestRef.set(update, {merge: true});
    },
);

async function queueServeNeedInterestNotification_(interestId, interestData) {
  const to = String(interestData && interestData.contactEmail || "").trim();

  if (!looksLikeEmailAddress_(to)) {
    const error = new Error(
        "Serve Needs email notifications need a valid recipient.",
    );
    error.code = "invalid-recipient";
    throw error;
  }

  const replyToAddresses = [
    looksLikeEmailAddress_(interestData && interestData.email) ?
      String(interestData.email || "").trim() :
      "",
  ].filter(Boolean);
  const subject = [
    "New Serve Interest",
    String(interestData && interestData.serveNeedNeed || "").trim() ||
      "Serve Opportunity",
  ].join(": ");
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PCO_TIMEZONE,
  });
  const sendResult = await sendCentralEmail_({
    to: to,
    replyTo: replyToAddresses.length ? replyToAddresses[0] : "",
    subject: subject,
    text: buildServeNeedInterestEmailText_(interestData, submittedAt),
    html: buildServeNeedInterestEmailHtml_(interestData, submittedAt),
  });

  await firestore
      .collection(CENTRAL_SERVE_NEEDS_INTERESTS_COLLECTION_PATH)
      .doc(interestId)
      .set({
        notificationStatus: "sent",
        notificationAttempts: 1,
        notificationProvider: "gmail-api",
        notificationMessageId: String(sendResult && sendResult.id || "").trim(),
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
}

function buildServeNeedInterestEmailText_(interestData, submittedAt) {
  const interest = interestData || {};
  const lines = [
    "A new Serve Needs interest form was submitted through Central.",
    "",
    "Serve Opportunity",
    "Need: " + String(interest.serveNeedNeed || "").trim(),
    "Ministry: " + String(interest.serveNeedMinistry || "").trim(),
    "",
    "Person Interested",
    "Name: " + String(interest.name || "").trim(),
    "Email: " + String(interest.email || "").trim(),
    "Phone: " + (String(interest.phone || "").trim() || "Not provided"),
    "Preferred Contact Method: " +
      formatServeNeedPreferredContactMethod_(
          interest.preferredContactMethod,
      ),
    "",
    "Additional Notes",
    String(interest.additionalNotes || "").trim() || "None",
    "",
    "Submitted",
    submittedAt,
  ];

  return lines.join("\n");
}

function buildServeNeedInterestEmailHtml_(interestData, submittedAt) {
  const interest = interestData || {};

  return buildCentralEmailHtml_({
    preheader: "A new Serve Needs interest form was submitted through Central.",
    title: "New Serve Interest",
    lead:
      "A new person shared interest in serving through CrossPointe Central.",
    sections: [
      {
        title: "Serve Opportunity",
        rows: [
          ["Need", String(interest.serveNeedNeed || "").trim()],
          ["Ministry", String(interest.serveNeedMinistry || "").trim()],
        ],
      },
      {
        title: "Person Interested",
        rows: [
          ["Name", String(interest.name || "").trim()],
          ["Email", String(interest.email || "").trim()],
          ["Phone", String(interest.phone || "").trim() || "Not provided"],
          [
            "Preferred Contact Method",
            formatServeNeedPreferredContactMethod_(
                interest.preferredContactMethod,
            ),
          ],
        ],
      },
      {
        title: "Additional Notes",
        body: String(interest.additionalNotes || "").trim() || "None",
      },
      {
        title: "Submitted",
        rows: [
          ["Time", submittedAt],
        ],
      },
    ],
    footerText:
      "Reply directly to this email to contact the person who submitted the form.",
  });
}

function formatServeNeedPreferredContactMethod_(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "text") {
    return "Text";
  }

  if (normalizedValue === "email") {
    return "E-Mail";
  }

  return String(value || "").trim();
}

async function queueCentralAdminInviteNotification_(inviteData) {
  const to = normalizeAdminEmail_(inviteData && inviteData.email);

  if (!looksLikeEmailAddress_(to)) {
    throw new Error("Admin invite emails need a valid recipient.");
  }

  const subject = "You're Invited: CrossPointe Central Admin";
  const messageText = buildCentralAdminInviteEmailText_(inviteData);
  const messageHtml = buildCentralAdminInviteEmailHtml_(inviteData);
  const sendResult = await sendCentralEmail_({
    to: to,
    replyTo: looksLikeEmailAddress_(inviteData && inviteData.invitedByEmail) ?
      String(inviteData.invitedByEmail || "").trim() :
      "",
    subject: subject,
    text: messageText,
    html: messageHtml,
  });
  return String(sendResult && sendResult.id || "").trim();
}

async function sendCentralEmail_(options) {
  const config = options && typeof options === "object" ? options : {};
  const to = String(config.to || "").trim();
  const subject = String(config.subject || "").trim();
  const text = String(config.text || "").trim();
  const html = String(config.html || "").trim();
  const replyTo = String(config.replyTo || "").trim();
  const gmailConfig = getCentralGmailConfig_();

  if (!looksLikeEmailAddress_(to)) {
    throw new Error("Central email delivery needs a valid recipient.");
  }

  if (!subject) {
    throw new Error("Central email delivery needs a subject.");
  }

  if (!text && !html) {
    throw new Error("Central email delivery needs text or HTML content.");
  }

  const accessToken = await fetchCentralGmailAccessToken_(gmailConfig);
  const rawMessage = buildCentralGmailRawMessage_({
    fromName: CENTRAL_EMAIL_BRAND_NAME,
    fromEmail: gmailConfig.senderEmail,
    to: to,
    replyTo: replyTo,
    subject: subject,
    text: text,
    html: html,
  });
  const gmailResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: rawMessage,
        }),
      },
  );

  if (!gmailResponse.ok) {
    const errorBody = await safeReadJsonResponse_(gmailResponse);
    const gmailMessage = String(
        errorBody &&
        errorBody.error &&
        (errorBody.error.message || errorBody.error.status) ||
        gmailResponse.statusText ||
        "Unknown Gmail API failure.",
    ).trim();
    const error = new Error(
        "Gmail API send failed (" +
        String(gmailResponse.status) +
        "): " +
        gmailMessage,
    );
    error.code = "gmail-send-failed";
    error.status = gmailResponse.status;
    throw error;
  }

  const responseBody = await safeReadJsonResponse_(gmailResponse);
  return {
    id: String(responseBody && responseBody.id || "").trim(),
    threadId: String(responseBody && responseBody.threadId || "").trim(),
  };
}

function getCentralGmailConfig_() {
  const clientSecret = trimEnvString_(
      CENTRAL_GMAIL_CLIENT_SECRET.value(),
  );
  const refreshToken = trimEnvString_(
      CENTRAL_GMAIL_REFRESH_TOKEN.value(),
  );

  if (!CENTRAL_GMAIL_CLIENT_ID ||
    !clientSecret ||
    !refreshToken ||
    !CENTRAL_GMAIL_SENDER_EMAIL) {
    const error = new Error(
        "Central Gmail API is not configured yet. Add the client ID, " +
        "client secret, refresh token, and sender email to the local " +
        "Functions configuration.",
    );
    error.code = "gmail-config-missing";
    throw error;
  }

  if (!looksLikeEmailAddress_(CENTRAL_GMAIL_SENDER_EMAIL)) {
    const error = new Error("Central Gmail sender email is invalid.");
    error.code = "gmail-config-invalid";
    throw error;
  }

  return {
    clientId: CENTRAL_GMAIL_CLIENT_ID,
    clientSecret: clientSecret,
    refreshToken: refreshToken,
    senderEmail: CENTRAL_GMAIL_SENDER_EMAIL,
  };
}

async function fetchCentralGmailAccessToken_(gmailConfig) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: String(gmailConfig.clientId || "").trim(),
      client_secret: String(gmailConfig.clientSecret || "").trim(),
      refresh_token: String(gmailConfig.refreshToken || "").trim(),
      grant_type: "refresh_token",
    }),
  });

  const tokenBody = await safeReadJsonResponse_(tokenResponse);

  if (!tokenResponse.ok) {
    const tokenMessage = String(
        tokenBody &&
        (tokenBody.error_description || tokenBody.error) ||
        tokenResponse.statusText ||
        "Unknown token exchange failure.",
    ).trim();
    const error = new Error(
        "Gmail OAuth token exchange failed (" +
        String(tokenResponse.status) +
        "): " +
        tokenMessage,
    );
    error.code = "gmail-token-failed";
    error.status = tokenResponse.status;
    throw error;
  }

  const accessToken = String(tokenBody && tokenBody.access_token || "").trim();

  if (!accessToken) {
    const error = new Error(
        "Gmail OAuth token exchange completed without an access token.",
    );
    error.code = "gmail-token-missing";
    throw error;
  }

  return accessToken;
}

function buildCentralGmailRawMessage_(options) {
  const config = options && typeof options === "object" ? options : {};
  const boundary = "central-" + crypto.randomBytes(12).toString("hex");
  const headers = [
    "From: " + buildCentralMailboxHeader_(
        config.fromName,
        config.fromEmail,
    ),
    "To: " + String(config.to || "").trim(),
    config.replyTo ?
      "Reply-To: " + String(config.replyTo || "").trim() :
      "",
    "Subject: " + encodeMimeHeaderValue_(String(config.subject || "").trim()),
    "MIME-Version: 1.0",
    "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"",
  ].filter(Boolean);
  const parts = [
    "--" + boundary,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "Content-Transfer-Encoding: base64",
    "",
    splitMimeBase64Lines_(Buffer.from(String(config.text || ""), "utf8")
        .toString("base64")),
    "--" + boundary,
    "Content-Type: text/html; charset=\"UTF-8\"",
    "Content-Transfer-Encoding: base64",
    "",
    splitMimeBase64Lines_(Buffer.from(String(config.html || ""), "utf8")
        .toString("base64")),
    "--" + boundary + "--",
    "",
  ];
  const mimeMessage = headers.concat([""], parts).join("\r\n");

  return Buffer.from(mimeMessage, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
}

function buildCentralMailboxHeader_(displayName, email) {
  const safeEmail = String(email || "").trim();
  const safeName = String(displayName || "").trim();

  if (!safeName) {
    return safeEmail;
  }

  return "\"" +
    safeName.replace(/["\\]/g, "\\$&") +
    "\" <" +
    safeEmail +
    ">";
}

function encodeMimeHeaderValue_(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return "=?UTF-8?B?" + Buffer.from(text, "utf8").toString("base64") + "?=";
}

function splitMimeBase64Lines_(value) {
  const matches = String(value || "").match(/.{1,76}/g);
  return matches ? matches.join("\r\n") : "";
}

async function safeReadJsonResponse_(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function buildCentralAdminInviteEmailText_(inviteData) {
  const invite = inviteData || {};
  const permissionLines = buildAdminInvitePermissionSummary_(invite.pageAccess)
      .map((entry) => {
        return "- " + entry.label + ": " + entry.permissionLabel;
      });
  const expiresAt = formatCentralEmailDateTime_(invite.inviteExpiresAt);
  const lines = [
    "You've been invited to be an admin in CrossPointe Central.",
    "",
    "Confirm your account",
    String(invite.inviteUrl || "").trim(),
    "",
    "Granted access",
    permissionLines.length ? permissionLines.join("\n") : "- No access assigned yet",
    "",
    "Invite expires",
    expiresAt || "Not set",
    "",
    "Invited by",
    String(invite.invitedByName || invite.invitedByEmail || "").trim() || "CrossPointe Team",
    "",
    CENTRAL_EMAIL_SUPPORT_COPY,
  ];

  return lines.join("\n");
}

function buildCentralAdminInviteEmailHtml_(inviteData) {
  const invite = inviteData || {};
  const permissionRows = buildAdminInvitePermissionSummary_(invite.pageAccess)
      .map((entry) => {
        return [
          entry.label,
          entry.permissionLabel,
        ];
      });

  return buildCentralEmailHtml_({
    preheader: "You've been invited to be an admin in CrossPointe Central.",
    title: "You're Invited To Central Admin",
    lead:
      "Your team prepared admin access for you in CrossPointe Central. Confirm your account to finish connecting it to your Google sign-in.",
    sections: [
      {
        title: "Granted Access",
        rows: permissionRows.length ? permissionRows : [
          ["Permissions", "No access assigned yet"],
        ],
      },
      {
        title: "Invite Details",
        rows: [
          [
            "Invited By",
            String(
                invite.invitedByName ||
                invite.invitedByEmail ||
                "CrossPointe Team",
            ).trim(),
          ],
          [
            "Expires",
            formatCentralEmailDateTime_(invite.inviteExpiresAt) || "Not set",
          ],
        ],
      },
    ],
    actionLabel: "Confirm Account",
    actionUrl: String(invite.inviteUrl || "").trim(),
    footerText:
      "Sign in with the same Google account that received this email. " +
      CENTRAL_EMAIL_SUPPORT_COPY,
  });
}

function buildAdminInvitePermissionSummary_(pageAccess) {
  const source = pageAccess && typeof pageAccess === "object" ?
    pageAccess :
    {};

  return MANAGED_ADMIN_PAGE_CONFIGS.map((config) => {
    const permission = normalizePreviewPermissionValue_(source[config.key]);
    return {
      key: config.key,
      label: config.label,
      permission: permission,
      permissionLabel: config.key === "wayfinder" && permission === "view" ?
        "User" :
        (ADMIN_PERMISSION_LABELS[permission] || permission),
    };
  }).filter((entry) => entry.permission !== "none");
}

function buildCentralAdminInviteUrl_(request, inviteId, token) {
  const baseUrl = trimEnvString_(CENTRAL_ADMIN_URL) ||
    (getCentralRequestOrigin_(request) + "/admin");
  const url = new URL(baseUrl);
  url.searchParams.set("invite", String(inviteId || "").trim());
  url.searchParams.set("token", String(token || "").trim());
  return url.toString();
}

function buildCentralEmailHtml_(options) {
  const config = options && typeof options === "object" ? options : {};
  const sections = Array.isArray(config.sections) ? config.sections : [];
  const actionUrl = String(config.actionUrl || "").trim();
  const actionLabel = String(config.actionLabel || "").trim();

  return [
    "<!doctype html>",
    "<html>",
    "<body style=\"margin:0;padding:0;background:#f5f2ed;color:#27272a;font-family:Arial,Helvetica,sans-serif;\">",
    "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">",
    escapeCentralEmailHtml_(config.preheader || config.lead || config.title || ""),
    "</div>",
    "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#f5f2ed;\">",
    "<tr><td align=\"center\" style=\"padding:32px 16px;\">",
    "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"max-width:640px;background:#ffffff;border:1px solid #e8ddd5;border-radius:24px;overflow:hidden;\">",
    "<tr><td style=\"padding:28px 32px;background:#ef3b2d;color:#ffffff;\">",
    "<div style=\"font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.86;\">",
    escapeCentralEmailHtml_(CENTRAL_EMAIL_BRAND_NAME),
    "</div>",
    "<h1 style=\"margin:12px 0 0;font-size:30px;line-height:1.08;font-weight:700;color:#ffffff;\">",
    escapeCentralEmailHtml_(config.title || CENTRAL_EMAIL_BRAND_NAME),
    "</h1>",
    config.lead ?
      "<p style=\"margin:14px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.92);\">" +
      escapeCentralEmailHtml_(config.lead) +
      "</p>" :
      "",
    "</td></tr>",
    "<tr><td style=\"padding:28px 32px 16px;\">",
    sections.map(function(section) {
      return buildCentralEmailSectionHtml_(section);
    }).join(""),
    actionUrl && actionLabel ?
      [
        "<div style=\"margin:8px 0 24px;\">",
        "<a href=\"", escapeCentralEmailAttribute_(actionUrl), "\" style=\"display:inline-block;padding:14px 22px;border-radius:999px;background:#ef3b2d;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;\">",
        escapeCentralEmailHtml_(actionLabel),
        "</a>",
        "</div>",
      ].join("") :
      "",
    "</td></tr>",
    "<tr><td style=\"padding:0 32px 28px;font-size:12px;line-height:1.6;color:#766c66;\">",
    escapeCentralEmailHtml_(config.footerText || CENTRAL_EMAIL_SUPPORT_COPY),
    "</td></tr>",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

function buildCentralEmailSectionHtml_(section) {
  const config = section && typeof section === "object" ? section : {};
  const rows = Array.isArray(config.rows) ? config.rows : [];
  const body = String(config.body || "").trim();

  return [
    "<div style=\"margin:0 0 20px;padding:20px 22px;border:1px solid #ece5df;border-radius:20px;background:#fcfcfd;\">",
    config.title ?
      "<div style=\"margin:0 0 12px;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ef3b2d;\">" +
      escapeCentralEmailHtml_(config.title) +
      "</div>" :
      "",
    rows.length ? buildCentralEmailRowsHtml_(rows) : "",
    body ?
      "<div style=\"font-size:15px;line-height:1.7;color:#27272a;white-space:pre-line;\">" +
      escapeCentralEmailHtml_(body) +
      "</div>" :
      "",
    "</div>",
  ].join("");
}

function buildCentralEmailRowsHtml_(rows) {
  return [
    "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\">",
    rows.map(function(row) {
      var label = Array.isArray(row) ? row[0] : "";
      var value = Array.isArray(row) ? row[1] : "";
      return [
        "<tr>",
        "<td valign=\"top\" style=\"padding:0 0 10px;font-size:13px;line-height:1.5;font-weight:700;color:#27272a;white-space:nowrap;\">",
        escapeCentralEmailHtml_(label || ""),
        "</td>",
        "<td valign=\"top\" style=\"padding:0 0 10px 16px;font-size:14px;line-height:1.6;color:#4b5563;\">",
        escapeCentralEmailHtml_(value || "None"),
        "</td>",
        "</tr>",
      ].join("");
    }).join(""),
    "</table>",
  ].join("");
}

function formatCentralEmailDateTime_(value) {
  const timestamp = getFirestoreTimestampMillis_(value);

  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PCO_TIMEZONE,
  });
}

function escapeCentralEmailHtml_(value) {
  return String(value || "").replace(/[&<>"']/g, function(character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[character];
  });
}

function escapeCentralEmailAttribute_(value) {
  return escapeCentralEmailHtml_(value);
}

async function markServeNeedInterestNotificationFailed_(interestId, error) {
  await firestore
      .collection(CENTRAL_SERVE_NEEDS_INTERESTS_COLLECTION_PATH)
      .doc(interestId)
      .set({
        notificationStatus: "failed",
        notificationAttempts: 1,
        notificationError: String(
            error && error.message || "Unknown notification failure.",
        ).slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
}

function getServeNeedInterestNotificationErrorMessage_(error) {
  return "Your interest was saved, but we could not email the ministry " +
    "leader right now. Please try again in a minute.";
}

async function buildCentralDataPayload_(environment) {
  const [
    settingsOverride,
    sundaySettingsOverride,
    thisSundayOverride,
    campaignsOverride,
    nextStepsOverride,
    serveNeedsOverride,
    resourcesOverride,
    quickLinksOverride,
    roomRulesOverride,
    statusBannerOverride,
    whatsNewOverride,
  ] = await Promise.all([
    getFirestorePublicSettingsOverride_(),
    getFirestoreSundaySettingsOverride_(),
    getFirestoreThisSundayOverride_(),
    getFirestoreCampaignsOverride_(),
    getFirestoreNextStepsOverride_(),
    getFirestoreServeNeedsOverride_(),
    getFirestoreResourcesOverride_(),
    getFirestoreQuickLinksOverride_(),
    getFirestoreRoomRulesOverride_(),
    getFirestoreStatusBannerOverride_(),
    getFirestoreWhatsNewOverride_(),
  ]);

  const settings = settingsOverride.shouldOverride ?
    settingsOverride.settings :
    {};
  const sundaySettings = sundaySettingsOverride.shouldOverride ?
    sundaySettingsOverride.settings :
    {};
  const sunday = thisSundayOverride.shouldOverride ?
    thisSundayOverride.sunday :
    {};
  const roomRules = roomRulesOverride.shouldOverride ?
    roomRulesOverride.items :
    getDefaultCentralRoomRules_();
  const planningCenterData = await getPlanningCenterDataSafely_(roomRules);
  const setlist = Array.isArray(planningCenterData.setlist) ?
    planningCenterData.setlist :
    [];

  const googleWebClientId = await getCentralGoogleWebClientId_(
      settings,
      sundaySettings,
  );
  const googleDocsEnabled = getCentralGoogleDocsEnabled_(
      settings,
      sundaySettings,
  );
  const calendarIntegrationsEnabled = getCentralCalendarIntegrationsEnabled_(
      settings,
      sundaySettings,
  );

  return {
    environment: environment,
    googleWebClientId: googleWebClientId,
    googleDocsEnabled: googleDocsEnabled,
    calendarIntegrationsEnabled: calendarIntegrationsEnabled,
    settings: settings,
    sundaySettings: sundaySettings,
    banner: statusBannerOverride.shouldOverride ?
      statusBannerOverride.banner :
      null,
    sunday: sunday,
    sundayMode: getSundayModeData_(
        settings,
        sunday,
        setlist,
        sundaySettings,
        environment,
    ),
    today: Array.isArray(planningCenterData.events && planningCenterData.events.today) ?
      planningCenterData.events.today :
      [],
    setlist: setlist,
    events: Array.isArray(
        planningCenterData.events && planningCenterData.events.upcoming,
    ) ?
      planningCenterData.events.upcoming :
      [],
    registrations: Array.isArray(planningCenterData.registrations) ?
      planningCenterData.registrations :
      [],
    featuredEvent: planningCenterData.featuredEvent || null,
    roomRules: roomRules,
    campaigns: campaignsOverride.shouldOverride ?
      campaignsOverride.items :
      [],
    nextSteps: nextStepsOverride.shouldOverride ?
      nextStepsOverride.items :
      [],
    serveNeeds: serveNeedsOverride.shouldOverride ?
      serveNeedsOverride.items :
      [],
    resources: resourcesOverride.shouldOverride ?
      resourcesOverride.items :
      [],
    quickLinks: quickLinksOverride.shouldOverride ?
      quickLinksOverride.items :
      [],
    whatsNew: whatsNewOverride.shouldOverride ?
      whatsNewOverride.whatsNew :
      {},
  };
}

/**
 * Refreshes environment-sensitive Sunday controls inside cached public data.
 *
 * @param {Object} cachedData Cached Central response payload.
 * @param {string} environment Resolved Hosting environment.
 * @return {Promise<Object>} Payload with current Sunday settings and mode.
 */
async function refreshCentralSundayModeData_(cachedData, environment) {
  const sundaySettingsOverride = await getFirestoreSundaySettingsOverride_();
  const sundaySettings = sundaySettingsOverride.shouldOverride ?
    sundaySettingsOverride.settings :
    (cachedData.sundaySettings || {});

  return {
    ...cachedData,
    environment: environment,
    sundaySettings: sundaySettings,
    sundayMode: getSundayModeData_(
        cachedData.settings || {},
        cachedData.sunday || {},
        Array.isArray(cachedData.setlist) ? cachedData.setlist : [],
        sundaySettings,
        environment,
    ),
  };
}

async function getCentralGoogleWebClientId_(settings, sundaySettings) {
  const settingsClientId = trimFirestoreStringValue_(
      settings &&
      (
        settings.googleWebClientId ||
        settings.google_web_client_id
      ),
  );

  if (settingsClientId) {
    return settingsClientId;
  }

  const sundaySettingsClientId = trimFirestoreStringValue_(
      sundaySettings &&
      (
        sundaySettings.googleWebClientId ||
        sundaySettings.google_web_client_id
      ),
  );

  if (sundaySettingsClientId) {
    return sundaySettingsClientId;
  }

  const metaClientId = await getFirestorePublicMetaGoogleWebClientId_();

  if (metaClientId) {
    return metaClientId;
  }

  return CENTRAL_GOOGLE_WEB_CLIENT_ID;
}

function getCentralGoogleDocsEnabled_(settings, sundaySettings) {
  const settingsValue = getOptionalBooleanConfigValue_(
      settings,
      "googleDocsEnabled",
      "google_docs_enabled",
  );

  if (settingsValue !== null) {
    return settingsValue;
  }

  const sundaySettingsValue = getOptionalBooleanConfigValue_(
      sundaySettings,
      "googleDocsEnabled",
      "google_docs_enabled",
  );

  if (sundaySettingsValue !== null) {
    return sundaySettingsValue;
  }

  return true;
}

/**
 * Resolves whether public calendar controls should be shown.
 *
 * @param {Object} settings Published homepage settings.
 * @param {Object} sundaySettings Published Sunday settings.
 * @return {boolean} Whether calendar integrations are enabled.
 */
function getCentralCalendarIntegrationsEnabled_(settings, sundaySettings) {
  const settingsValue = getOptionalBooleanConfigValue_(
      settings,
      "calendarIntegrationsEnabled",
      "calendar_integrations_enabled",
  );

  if (settingsValue !== null) {
    return settingsValue;
  }

  const sundaySettingsValue = getOptionalBooleanConfigValue_(
      sundaySettings,
      "calendarIntegrationsEnabled",
      "calendar_integrations_enabled",
  );

  if (sundaySettingsValue !== null) {
    return sundaySettingsValue;
  }

  return true;
}

async function getFirestorePublicMetaGoogleWebClientId_() {
  try {
    const snapshot = await firestore.doc(CENTRAL_PUBLIC_META_DOC_PATH).get();

    if (!snapshot.exists) {
      return "";
    }

    const data = snapshot.data() || {};
    return trimFirestoreStringValue_(
        data.googleWebClientId || data.google_web_client_id,
    );
  } catch (error) {
    console.error("Firestore public meta lookup failed.", error);
    return "";
  }
}

function getCentralRequestHostname_(request) {
  const forwardedHost = String(
      request && request.headers && request.headers["x-forwarded-host"] || "",
  ).trim().split(",")[0].trim();
  const directHost = String(
      request && request.headers && request.headers.host || "",
  ).trim();
  const hostname = String(request && request.hostname || "").trim();
  const rawHost = forwardedHost || directHost || hostname;

  return rawHost.toLowerCase().replace(/:\d+$/, "");
}

/**
 * Resolves the public Central environment from the original request hostname.
 *
 * @param {Object} request Incoming HTTPS request.
 * @return {string} Either the live or dev environment identifier.
 */
function getCentralDataEnvironment_(request) {
  const hostname = getCentralRequestHostname_(request);

  if (isLocalCentralHostname_(hostname)) {
    return CENTRAL_DATA_ENVIRONMENT_DEV;
  }

  if (
    hostname.startsWith("crosspointe-central--dev-") &&
    (
      hostname.endsWith(".web.app") ||
      hostname.endsWith(".firebaseapp.com")
    )
  ) {
    return CENTRAL_DATA_ENVIRONMENT_DEV;
  }

  return CENTRAL_DATA_ENVIRONMENT_LIVE;
}

function getCentralRequestProtocol_(request) {
  const forwardedProto = String(
      request && request.headers && request.headers["x-forwarded-proto"] || "",
  ).trim().split(",")[0].trim().toLowerCase();
  const requestProtocol = String(request && request.protocol || "")
      .trim()
      .toLowerCase();

  if (forwardedProto === "http" || forwardedProto === "https") {
    return forwardedProto;
  }

  if (requestProtocol === "http" || requestProtocol === "https") {
    return requestProtocol;
  }

  return isLocalCentralHostname_(getCentralRequestHostname_(request)) ?
    "http" :
    "https";
}

function getCentralRequestOrigin_(request) {
  const host = String(
      request && request.headers && request.headers["x-forwarded-host"] ||
      request && request.headers && request.headers.host ||
      request && request.hostname ||
      "",
  ).trim();

  if (!host) {
    return "";
  }

  return getCentralRequestProtocol_(request) + "://" + host;
}

function isLocalCentralHostname_(hostname) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
}

async function getFirestorePublicSettingsOverride_() {
  try {
    const snapshot = await firestore.doc(CENTRAL_PUBLIC_SETTINGS_DOC_PATH).get();

    if (!snapshot.exists) {
      return {
        shouldOverride: false,
        settings: {},
      };
    }

    return {
      shouldOverride: true,
      settings: toCentralSettingsFromFirestoreDoc_(snapshot),
    };
  } catch (error) {
    console.error("Firestore homepage override failed.", error);
    return {
      shouldOverride: false,
      settings: {},
    };
  }
}

function toCentralSettingsFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const nextSettings = {
    source: "Firestore",
  };

  copyTrimmedStringFieldIfPresent_(nextSettings, data, "site_title");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "hero_heading");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "hero_subheading");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "googleWebClientId");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "google_web_client_id");
  copyBooleanFieldIfPresent_(nextSettings, data, "googleDocsEnabled");
  copyBooleanFieldIfPresent_(nextSettings, data, "google_docs_enabled");
  copyBooleanFieldIfPresent_(
      nextSettings,
      data,
      "calendarIntegrationsEnabled",
  );
  copyBooleanFieldIfPresent_(
      nextSettings,
      data,
      "calendar_integrations_enabled",
  );
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "primary_button_text");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "primary_button_url");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "secondary_button_text");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "secondary_button_url");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "countdown_label");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "countdown_title");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "countdown_datetime");
  copyBooleanFieldIfPresent_(
      nextSettings,
      data,
      "featured_event_enabled",
  );
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "timezone");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_mode_override");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "force_sunday_mode");
  copyModuleConfigFieldIfPresent_(
      nextSettings,
      data,
      "homepage_modules",
      HOMEPAGE_MODULE_DEFINITIONS,
  );

  return nextSettings;
}

async function getFirestoreSundaySettingsOverride_() {
  try {
    const snapshot = await firestore
        .doc(CENTRAL_PUBLIC_SUNDAY_SETTINGS_DOC_PATH)
        .get();

    if (!snapshot.exists) {
      return {
        shouldOverride: false,
        settings: {},
      };
    }

    return {
      shouldOverride: true,
      settings: toCentralSundaySettingsFromFirestoreDoc_(snapshot),
    };
  } catch (error) {
    console.error("Firestore Sunday-mode override failed.", error);
    return {
      shouldOverride: false,
      settings: {},
    };
  }
}

function toCentralSundaySettingsFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const nextSettings = {
    source: "Firestore",
  };

  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_mode_override");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "force_sunday_mode");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_mode_start_time");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_mode_end_time");
  copyTrimmedStringFieldIfPresent_(
      nextSettings,
      data,
      "dev_sunday_mode_override",
  );
  copyTrimmedStringFieldIfPresent_(
      nextSettings,
      data,
      "dev_sunday_mode_start_time",
  );
  copyTrimmedStringFieldIfPresent_(
      nextSettings,
      data,
      "dev_sunday_mode_end_time",
  );
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_eyebrow");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_eyebrow_live");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_eyebrow_test");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_heading");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_heading_live");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_heading_test");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_subheading");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_primary_button_text");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_primary_button_url");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_secondary_button_text");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_secondary_button_url");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_status_label");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_speaker_label");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_scripture_label");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_livestream_url");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_livestream_title");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_livestream_note");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_scripture_reference");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_scripture_bible_id");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_scripture_title");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "sunday_scripture_helper_text");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "googleWebClientId");
  copyTrimmedStringFieldIfPresent_(nextSettings, data, "google_web_client_id");
  copyBooleanFieldIfPresent_(nextSettings, data, "googleDocsEnabled");
  copyBooleanFieldIfPresent_(nextSettings, data, "google_docs_enabled");
  copyBooleanFieldIfPresent_(
      nextSettings,
      data,
      "calendarIntegrationsEnabled",
  );
  copyBooleanFieldIfPresent_(
      nextSettings,
      data,
      "calendar_integrations_enabled",
  );
  copyModuleConfigFieldIfPresent_(
      nextSettings,
      data,
      "sunday_modules",
      SUNDAY_MODE_MODULE_DEFINITIONS,
  );

  return withResolvedSundayModeWindowSettings_(nextSettings);
}

async function getFirestoreThisSundayOverride_() {
  try {
    const snapshot = await firestore
        .doc(CENTRAL_PUBLIC_THIS_SUNDAY_DOC_PATH)
        .get();

    if (!snapshot.exists) {
      return {
        shouldOverride: false,
        sunday: {},
      };
    }

    return {
      shouldOverride: true,
      sunday: toCentralThisSundayFromFirestoreDoc_(snapshot),
    };
  } catch (error) {
    console.error("Firestore Sunday override failed.", error);
    return {
      shouldOverride: false,
      sunday: {},
    };
  }
}

function toCentralThisSundayFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const dateIso = normalizeThisSundayDateValue_(data.date_iso || data.date);
  const dateDisplay = dateIso ?
    formatThisSundayDisplayDate_(dateIso) :
    trimFirestoreStringValue_(data.date);

  return {
    source: "Firestore",
    date: dateDisplay,
    date_iso: dateIso,
    series: trimFirestoreStringValue_(data.series),
    sermon_title: trimFirestoreStringValue_(data.sermon_title),
    speaker: trimFirestoreStringValue_(data.speaker),
    scripture: trimFirestoreStringValue_(data.scripture),
    note: trimFirestoreStringValue_(data.note || data.notes),
  };
}

function copyTrimmedStringFieldIfPresent_(target, source, key) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) {
    return;
  }

  target[key] = String(source[key] || "").trim();
}

function copyBooleanFieldIfPresent_(target, source, key) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) {
    return;
  }

  const normalizedValue = normalizeOptionalBooleanConfigValue_(source[key]);

  if (normalizedValue === null) {
    return;
  }

  target[key] = normalizedValue;
}

function copyModuleConfigFieldIfPresent_(target, source, key, definitions) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) {
    return;
  }

  target[key] = normalizeModuleConfigPayload_(source[key], definitions);
}

function normalizeModuleConfigPayload_(sourceValue, definitions) {
  const rawItems = Array.isArray(sourceValue) ? sourceValue : [];
  const moduleDefinitions = Array.isArray(definitions) ? definitions : [];
  const seenIds = new Set();
  const normalizedItems = [];
  const defaultOrder = new Map();
  const defaultEnabled = new Map();

  moduleDefinitions.forEach((definition, index) => {
    const moduleId = String(definition && definition.id || "").trim();
    if (!moduleId) {
      return;
    }

    defaultOrder.set(moduleId, index);
    defaultEnabled.set(moduleId, !definition || definition.defaultEnabled !== false);
  });

  rawItems.forEach((item) => {
    const moduleId = String(item && item.id || "").trim();
    if (!moduleId ||
      !defaultOrder.has(moduleId) ||
      seenIds.has(moduleId)) {
      return;
    }

    seenIds.add(moduleId);
    normalizedItems.push({
      id: moduleId,
      enabled: item && item.enabled !== false && item.enabled !== "false",
      sort: normalizeSortValue_(
          item && item.sort,
          (defaultOrder.get(moduleId) + 1) * 10,
      ),
    });
  });

  moduleDefinitions.forEach((definition, index) => {
    const moduleId = String(definition && definition.id || "").trim();
    if (!moduleId || seenIds.has(moduleId)) {
      return;
    }

    seenIds.add(moduleId);
    normalizedItems.push({
      id: moduleId,
      enabled: defaultEnabled.get(moduleId) !== false,
      sort: (index + 1) * 10,
    });
  });

  return normalizedItems.sort((leftItem, rightItem) => {
    if (leftItem.enabled !== rightItem.enabled) {
      return leftItem.enabled ? -1 : 1;
    }

    if (leftItem.sort !== rightItem.sort) {
      return leftItem.sort - rightItem.sort;
    }

    return defaultOrder.get(leftItem.id) - defaultOrder.get(rightItem.id);
  }).map((item, index) => ({
    id: item.id,
    enabled: item.enabled !== false,
    sort: (index + 1) * 10,
  }));
}

async function getFirestoreCampaignsOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_CAMPAIGNS_COLLECTION_PATH,
    metaDocPath: CENTRAL_CAMPAIGNS_META_DOC_PATH,
    errorLabel: "Firestore campaigns override failed.",
    buildItems: (docs) => getVisibleCampaignItems_(
        docs.map(toCentralCampaignFromFirestoreDoc_),
    ),
  });
}

function toCentralCampaignFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const ongoing = getNormalizedCampaignOngoingValue_(data);

  return {
    id: String(snapshot && snapshot.id || "").trim(),
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    button_text: String(data.button_text || "").trim(),
    button_url: String(data.button_url || "").trim(),
    ongoing: ongoing ? "TRUE" : "FALSE",
    start_date: ongoing ? "" : normalizeCampaignDateValue_(data.start_date),
    end_date: ongoing ? "" : normalizeCampaignDateValue_(data.end_date),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

async function getFirestoreNextStepsOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_NEXT_STEPS_COLLECTION_PATH,
    metaDocPath: CENTRAL_NEXT_STEPS_META_DOC_PATH,
    errorLabel: "Firestore Next Steps override failed.",
    buildItems: (docs) => docs
        .map(toCentralNextStepFromFirestoreDoc_)
        .filter((item) => item.title)
        .filter(isActive_)
        .sort(sortBySort_),
  });
}

function toCentralNextStepFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    button_text: String(data.button_text || "").trim(),
    button_url: String(data.button_url || "").trim(),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

async function getFirestoreServeNeedsOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_SERVE_NEEDS_COLLECTION_PATH,
    metaDocPath: CENTRAL_SERVE_NEEDS_META_DOC_PATH,
    errorLabel: "Firestore Serve Needs override failed.",
    buildItems: (docs) => docs
        .map(toCentralServeNeedFromFirestoreDoc_)
        .filter((item) => item.need)
        .filter(isActive_)
        .sort(sortBySort_),
  });
}

function toCentralServeNeedFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    id: String(snapshot && snapshot.id || "").trim(),
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    need: String(data.need || "").trim(),
    ministry: String(data.ministry || "").trim(),
    priority: String(data.priority || "normal").trim().toLowerCase(),
    description: String(data.description || "").trim(),
    button_text: String(data.button_text || "").trim(),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

async function getFirestoreResourcesOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_RESOURCES_COLLECTION_PATH,
    metaDocPath: CENTRAL_RESOURCES_META_DOC_PATH,
    errorLabel: "Firestore resources override failed.",
    buildItems: (docs) => docs
        .map(toCentralResourceFromFirestoreDoc_)
        .filter((item) => item.title)
        .filter(isActive_)
        .sort(sortBySort_),
  });
}

function toCentralResourceFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    title: String(data.title || "").trim(),
    type: String(data.type || "").trim(),
    description: String(data.description || "").trim(),
    button_text: String(data.button_text || "").trim(),
    button_url: String(data.button_url || "").trim(),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

async function getFirestoreRoomRulesOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_ROOM_RULES_COLLECTION_PATH,
    metaDocPath: CENTRAL_ROOM_RULES_META_DOC_PATH,
    errorLabel: "Firestore room-rules override failed.",
    buildItems: (docs) => docs
        .map(toCentralRoomRuleFromFirestoreDoc_)
        .filter((item) => item.match_text)
        .sort((leftItem, rightItem) =>
          Number(leftItem.priority || 999) -
          Number(rightItem.priority || 999),
        ),
  });
}

function toCentralRoomRuleFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    id: String(snapshot && snapshot.id || "").trim(),
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    match_type: normalizeRoomRuleMatchType_(data.match_type),
    match_text: String(data.match_text || "").trim(),
    display_location: String(data.display_location || "").trim(),
    behavior: normalizeRoomRuleBehavior_(data.behavior),
    priority: normalizeSortValue_(data.priority, 50),
    source: "Firestore",
  };
}

function getDefaultCentralRoomRules_() {
  return DEFAULT_CENTRAL_ROOM_RULES.map((item, index) => ({
    id: item.id || "legacy-room-rule-" + String(index + 1),
    active: item.active,
    match_type: item.match_type,
    match_text: item.match_text,
    display_location: item.display_location,
    behavior: item.behavior,
    priority: item.priority,
    source: item.source,
  }));
}

async function getFirestoreQuickLinksOverride_() {
  return getFirestoreListOverrideItems_({
    collectionPath: CENTRAL_QUICK_LINKS_COLLECTION_PATH,
    metaDocPath: CENTRAL_QUICK_LINKS_META_DOC_PATH,
    errorLabel: "Firestore quick-links override failed.",
    buildItems: (docs) => docs
        .map(toCentralQuickLinkFromFirestoreDoc_)
        .filter((item) => item.url)
        .filter(isActive_)
        .sort(sortBySort_),
  });
}

function toCentralQuickLinkFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    sunday_only: isTruthyValue_(data.sunday_only) ? "TRUE" : "FALSE",
    title: String(data.title || "").trim(),
    url: String(data.url || "").trim(),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

async function getFirestoreListOverrideItems_(config) {
  try {
    const [snapshot, metaSnapshot] = await Promise.all([
      firestore.collection(config.collectionPath).get(),
      firestore.doc(config.metaDocPath).get(),
    ]);

    if (snapshot.empty) {
      return {
        shouldOverride: hasFirestoreListOverrideState_(metaSnapshot),
        items: [],
      };
    }

    return {
      shouldOverride: true,
      items: typeof config.buildItems === "function" ?
        config.buildItems(snapshot.docs) :
        [],
    };
  } catch (error) {
    console.error(String(config.errorLabel || "Firestore list override failed."), error);
    return {
      shouldOverride: false,
      items: [],
    };
  }
}

function hasFirestoreListOverrideState_(metaSnapshot) {
  const data = metaSnapshot && typeof metaSnapshot.data === "function" ?
    metaSnapshot.data() || {} :
    {};

  if (!metaSnapshot || !metaSnapshot.exists) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(data, "overrideActive")) {
    return isTruthyValue_(data.overrideActive);
  }

  return isTruthyValue_(data.initialized);
}

async function getFirestoreStatusBannerOverride_() {
  try {
    const snapshot = await firestore.doc(CENTRAL_STATUS_BANNER_DOC_PATH).get();

    if (!snapshot.exists) {
      return {
        shouldOverride: false,
        banner: null,
      };
    }

    return {
      shouldOverride: true,
      banner: toCentralStatusBannerFromFirestoreDoc_(snapshot),
    };
  } catch (error) {
    console.error("Firestore status-banner override failed.", error);
    return {
      shouldOverride: false,
      banner: null,
    };
  }
}

async function getFirestoreWhatsNewOverride_() {
  try {
    const snapshot = await firestore.doc(CENTRAL_PUBLIC_WHATS_NEW_DOC_PATH).get();

    if (!snapshot.exists) {
      return {
        shouldOverride: false,
        whatsNew: {},
      };
    }

    return {
      shouldOverride: true,
      whatsNew: toCentralWhatsNewFromFirestoreDoc_(snapshot),
    };
  } catch (error) {
    console.error("Firestore what's-new override failed.", error);
    return {
      shouldOverride: false,
      whatsNew: {},
    };
  }
}

function toCentralWhatsNewFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  return {
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    version: trimFirestoreStringValue_(data.version),
    title: trimFirestoreStringValue_(data.title),
    message: trimFirestoreStringValue_(data.message),
    button_text: trimFirestoreStringValue_(
        data.button_text || data.testing_button_text,
    ),
    force_show: isTruthyValue_(
        Object.prototype.hasOwnProperty.call(data, "force_show") ?
          data.force_show :
          data.force_every_time,
    ) ? "TRUE" : "FALSE",
    source: "Firestore",
  };
}

function toCentralStatusBannerFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};

  if (!isTruthyValue_(data.active)) {
    return null;
  }

  return {
    title: String(data.title || "").trim(),
    message: String(data.message || "").trim(),
    button_text: String(data.button_text || "").trim(),
    button_url: String(data.button_url || "").trim(),
    source: "Firestore",
  };
}

function getVisibleCampaignItems_(items) {
  const todayKey = dateKey_(new Date(), PCO_TIMEZONE);

  return (Array.isArray(items) ? items : [])
      .map((item) => normalizeCampaignPublicItem_(item))
      .filter((item) => item.title)
      .filter((item) => isCampaignVisible_(item, todayKey))
      .sort(sortBySort_);
}

function normalizeCampaignPublicItem_(item) {
  const source = item || {};
  const ongoing = getNormalizedCampaignOngoingValue_(source);

  return {
    ...source,
    active: isTruthyValue_(source.active) ? "TRUE" : "FALSE",
    title: String(source.title || "").trim(),
    description: String(source.description || "").trim(),
    button_text: String(source.button_text || "").trim(),
    button_url: String(source.button_url || "").trim(),
    ongoing: ongoing ? "TRUE" : "FALSE",
    start_date: ongoing ? "" : normalizeCampaignDateValue_(source.start_date),
    end_date: ongoing ? "" : normalizeCampaignDateValue_(source.end_date),
    sort: normalizeSortValue_(source.sort, 50),
  };
}

function normalizeCampaignDateValue_(value) {
  const trimmed = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function getNormalizedCampaignOngoingValue_(item) {
  const source = item || {};
  const hasOngoingValue = Object.prototype.hasOwnProperty.call(source, "ongoing");
  const startDate = normalizeCampaignDateValue_(source.start_date);
  const endDate = normalizeCampaignDateValue_(source.end_date);

  if (hasOngoingValue) {
    return isTruthyValue_(source.ongoing);
  }

  return !startDate && !endDate;
}

function isCampaignVisible_(item, todayKey) {
  if (!isActive_(item)) {
    return false;
  }

  if (getNormalizedCampaignOngoingValue_(item)) {
    return true;
  }

  const startDate = normalizeCampaignDateValue_(item && item.start_date);
  const endDate = normalizeCampaignDateValue_(item && item.end_date);

  if (!startDate && !endDate) {
    return true;
  }

  if (startDate && todayKey < startDate) {
    return false;
  }

  if (endDate && todayKey > endDate) {
    return false;
  }

  return true;
}

async function getPlanningCenterDataSafely_(roomRules) {
  if (!hasPlanningCenterCredentials_()) {
    return {
      events: {
        today: [],
        upcoming: [],
      },
      registrations: [],
      featuredEvent: null,
      setlist: [],
    };
  }

  const [
    eventsResult,
    registrationsResult,
    featuredEventResult,
    setlistResult,
  ] =
    await Promise.allSettled([
      getCentralCalendarEvents_(roomRules),
      getCentralRegistrationSignups_(),
      getCentralFeaturedEvent_(roomRules),
      getPlanningCenterSetlist_(),
    ]);

  if (eventsResult.status === "rejected") {
    console.error("Planning Center calendar sync failed.", eventsResult.reason);
  }

  if (setlistResult.status === "rejected") {
    console.error("Planning Center setlist sync failed.", setlistResult.reason);
  }

  if (registrationsResult.status === "rejected") {
    console.error(
        "Planning Center registrations sync failed.",
        registrationsResult.reason,
    );
  }

  if (featuredEventResult.status === "rejected") {
    console.error(
        "Planning Center featured-event sync failed.",
        featuredEventResult.reason,
    );
  }

  return {
    events: eventsResult.status === "fulfilled" ? eventsResult.value : {
      today: [],
      upcoming: [],
    },
    registrations: registrationsResult.status === "fulfilled" ?
      registrationsResult.value : [],
    featuredEvent: featuredEventResult.status === "fulfilled" ?
      featuredEventResult.value : null,
    setlist: setlistResult.status === "fulfilled" ? setlistResult.value : [],
  };
}

function hasPlanningCenterCredentials_() {
  const credentials = getPlanningCenterCredentials_();
  return !!(credentials.appId && credentials.secret);
}

/**
 * Reads the Planning Center credentials bound to the current function.
 *
 * @return {{appId: string, secret: string}} Planning Center credentials.
 */
function getPlanningCenterCredentials_() {
  return {
    appId: trimEnvString_(PCO_APP_ID.value()),
    secret: trimEnvString_(PCO_SECRET.value()),
  };
}

async function fetchPcoJson_(url) {
  const credentials = getPlanningCenterCredentials_();
  if (!credentials.appId || !credentials.secret) {
    throw new Error(
        "Missing PCO_APP_ID or PCO_SECRET in Functions secrets.",
    );
  }

  const token = Buffer.from(
      credentials.appId + ":" + credentials.secret,
  ).toString("base64");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Basic " + token,
      Accept: "application/json",
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error("Planning Center API error " + response.status + ": " + body);
  }

  return JSON.parse(body);
}

async function fetchPcoCollectionJson_(url) {
  const combined = {
    data: [],
    included: [],
  };
  const seenUrls = new Set();
  let nextUrl = String(url || "").trim();
  let pageCount = 0;

  while (nextUrl && !seenUrls.has(nextUrl) && pageCount < 25) {
    seenUrls.add(nextUrl);
    const page = await fetchPcoJson_(nextUrl);
    combined.data.push(...(Array.isArray(page.data) ? page.data : []));
    combined.included.push(
        ...(Array.isArray(page.included) ? page.included : []),
    );
    nextUrl = String(page.links && page.links.next || "").trim();
    if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
      nextUrl = new URL(
          nextUrl,
          "https://api.planningcenteronline.com",
      ).toString();
    }
    pageCount += 1;
  }

  return combined;
}

async function getBulletinPlanningCenterData_(roomRules) {
  const cacheKey = JSON.stringify(Array.isArray(roomRules) ? roomRules : []);
  const cached = cachedBulletinPlanningCenterByRoomRules.get(cacheKey) || null;
  if (
    cached &&
    cached.data &&
    Date.now() - cached.fetchedAt < BULLETIN_PLANNING_CENTER_CACHE_TTL_MS
  ) {
    return cached.data;
  }

  if (cached && cached.promise) {
    return cached.promise;
  }

  const promise = Promise.allSettled([
    getCentralCalendarEvents_(roomRules, 21),
    getCentralFeaturedEvent_(roomRules),
  ]).then((results) => {
    const previous = cached && cached.data ? cached.data : null;
    const nextData = {
      events: results[0].status === "fulfilled" ?
        results[0].value :
        (previous && previous.events || {today: [], upcoming: []}),
      featuredEvent: results[1].status === "fulfilled" ?
        results[1].value :
        (previous && previous.featuredEvent || null),
    };

    if (results[0].status === "rejected") {
      console.error("Bulletin Mode calendar sync failed.", results[0].reason);
    }
    if (results[1].status === "rejected") {
      console.error(
          "Bulletin Mode featured event sync failed.",
          results[1].reason,
      );
    }

    cachedBulletinPlanningCenterByRoomRules.set(cacheKey, {
      data: nextData,
      fetchedAt: results[0].status === "fulfilled" || previous ?
        Date.now() :
        0,
      promise: null,
    });
    return nextData;
  }).catch((error) => {
    cachedBulletinPlanningCenterByRoomRules.delete(cacheKey);
    throw error;
  });

  cachedBulletinPlanningCenterByRoomRules.set(cacheKey, {
    data: cached && cached.data || null,
    fetchedAt: cached && cached.fetchedAt || 0,
    promise: promise,
  });
  return promise;
}

async function getCentralCalendarEvents_(roomRules, lookaheadDays) {
  const todayKey = dateKey_(new Date(), PCO_TIMEZONE);
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(
      twoWeeksFromNow.getDate() + (
        Number.isFinite(Number(lookaheadDays)) ?
          Number(lookaheadDays) :
          PCO_CALENDAR_LOOKAHEAD_DAYS
      ),
  );
  const endKey = dateKey_(twoWeeksFromNow, PCO_TIMEZONE);
  const queryStartDate = new Date(todayKey + "T00:00:00Z");
  const queryEndDate = new Date(endKey + "T23:59:59Z");
  queryStartDate.setUTCDate(queryStartDate.getUTCDate() - 1);
  queryEndDate.setUTCDate(queryEndDate.getUTCDate() + 1);

  const url =
    "https://api.planningcenteronline.com/calendar/v2/event_instances" +
    "?include=tags,event" +
    "&order=starts_at" +
    "&where[starts_at][gte]=" +
    encodeURIComponent(queryStartDate.toISOString()) +
    "&where[starts_at][lte]=" +
    encodeURIComponent(queryEndDate.toISOString()) +
    "&per_page=100";

  const data = await fetchPcoCollectionJson_(url);
  const tagMap = {};
  const eventMap = {};

  (data.included || []).forEach((item) => {
    if (item.type === "Tag") {
      tagMap[item.id] = item.attributes && item.attributes.name ?
        item.attributes.name :
        "";
    }

    if (item.type === "Event") {
      eventMap[item.id] = item.attributes || {};
    }
  });

  const items = await Promise.all(
      (data.data || []).map(async (instance) => {
        const attrs = instance.attributes || {};

        if (!instanceHasCentralTag_(instance, tagMap)) {
          return null;
        }

        const startsAt = attrs.published_starts_at || attrs.starts_at || "";
        if (!startsAt) return null;

        const startsDate = new Date(startsAt);
        if (Number.isNaN(startsDate.getTime())) return null;
        const startsDateKey = dateKey_(startsDate, PCO_TIMEZONE);
        if (startsDateKey < todayKey || startsDateKey > endKey) return null;

        const eventRef = instance.relationships &&
          instance.relationships.event &&
          instance.relationships.event.data;

        return buildCentralCalendarItem_(
            instance,
            eventRef && eventMap[eventRef.id] ? eventMap[eventRef.id] : {},
            roomRules,
            false,
        );
      }),
  );

  const today = [];
  const upcoming = [];

  items.filter(Boolean).forEach((item) => {
    if (dateKey_(item._dateObj, PCO_TIMEZONE) === todayKey) {
      today.push(toTodayItem_(item));
      return;
    }

    upcoming.push(toUpcomingItem_(item));
  });

  today.sort(sortByDate_);
  upcoming.sort(sortByDate_);

  return {
    today: today.map(removePrivateDate_),
    upcoming: upcoming.map(removePrivateDate_),
  };
}

/**
 * Retrieves public, Central-approved Planning Center Registrations signups.
 *
 * The request is intentionally limited to signup configuration resources. It
 * never requests attendees, registrations, people, emergency contacts, or
 * form answers.
 *
 * @return {Promise<Array<Object>>} Sanitized public signup cards.
 */
async function getCentralRegistrationSignups_() {
  const url =
    "https://api.planningcenteronline.com/registrations/v2/signups" +
    "?filter=unarchived" +
    "&include=categories,next_signup_time,selection_types,signup_location" +
    "&fields[Signup]=" + CENTRAL_REGISTRATION_SIGNUP_FIELDS.join(",") +
    "&fields[Category]=name" +
    "&fields[SelectionType]=at_maximum_capacity,available_capacity," +
    "maximum_capacity,name,price_cents,price_currency," +
    "price_currency_symbol,price_formatted,publicly_available,waitlist" +
    "&fields[SignupTime]=all_day,ends_at,starts_at" +
    "&fields[SignupLocation]=formatted_address,full_formatted_address," +
    "location_type,name,subpremise,url" +
    "&per_page=100";
  const data = await fetchPcoJson_(url);

  return getCentralRegistrationSignups(data, {
    categoryName: PCO_CENTRAL_REGISTRATION_CATEGORY_NAME,
  }).map((signup) => {
    const startsDate = new Date(signup.starts_at || "");
    const endsDate = new Date(signup.ends_at || "");
    const closeDate = new Date(signup.close_at || "");
    const hasStartDate = !Number.isNaN(startsDate.getTime());
    const hasEndDate = !Number.isNaN(endsDate.getTime());
    const hasCloseDate = !Number.isNaN(closeDate.getTime());
    const status = String(signup.status || "open");
    const closeLabel = hasCloseDate ?
      formatDate_(closeDate, PCO_TIMEZONE) + " at " +
        formatTime_(closeDate, PCO_TIMEZONE) : "";
    const calendarLocation = [
      signup.location,
      signup.venue,
      signup.address,
    ].filter((value, index, values) => {
      return value && values.indexOf(value) === index;
    }).join(", ");
    const calendarDescription = [
      signup.description,
      closeLabel ? "Registration closes " + closeLabel + "." : "",
    ].filter(Boolean).join("\n\n");

    return {
      id: signup.id,
      active: "TRUE",
      title: signup.title,
      description: signup.description,
      date: hasStartDate ? formatDate_(startsDate, PCO_TIMEZONE) : "",
      time: hasStartDate && !signup.all_day ?
        formatTimeRange_(startsDate, signup.ends_at, PCO_TIMEZONE) : "",
      location: signup.location,
      venue: signup.venue,
      address: signup.address,
      image_url: signup.image_url,
      registration_url: signup.registration_url,
      price_label: signup.price_label,
      status: status,
      status_label: signup.status_label,
      close_date: hasCloseDate ? formatDate_(closeDate, PCO_TIMEZONE) : "",
      close_label: closeLabel,
      button_text: "Learn More",
      registration_button_text: status === "waitlist" ?
        "Join Waitlist in Church Center" :
        status === "full" || status === "closed" ?
          "View in Church Center" :
          "Register in Church Center",
      calendar_url: hasStartDate ? buildGoogleCalendarUrl_({
        title: signup.title,
        startsAt: startsDate,
        endsAt: hasEndDate ? endsDate : signup.ends_at,
        location: calendarLocation,
        description: calendarDescription,
        url: signup.registration_url,
      }) : "",
      calendar_file_url: hasStartDate ? buildCalendarFileUrl_({
        title: signup.title,
        startsAt: startsDate,
        endsAt: hasEndDate ? endsDate : signup.ends_at,
        location: calendarLocation,
        description: calendarDescription,
        url: signup.registration_url,
      }) : "",
      source: signup.source,
    };
  });
}

/**
 * Retrieves the next Planning Center event carrying both Central tags.
 *
 * @param {Array<Object>} roomRules Published room-name transformation rules.
 * @return {Promise<Object|null>} Sanitized featured event or null.
 */
async function getCentralFeaturedEvent_(roomRules) {
  const tags = await fetchPcoJson_(
      "https://api.planningcenteronline.com/calendar/v2/tags?per_page=100",
  );
  const featuredTagId = findPlanningCenterTagId(
      tags,
      PCO_CENTRAL_FEATURED_TAG_NAME,
  );

  if (!featuredTagId) return null;

  const url =
    "https://api.planningcenteronline.com/calendar/v2/tags/" +
    encodeURIComponent(featuredTagId) +
    "/event_instances?filter=future&include=event,tags" +
    "&order=starts_at&per_page=100";
  const data = await fetchPcoJson_(url);
  const candidates = getCentralFeaturedEventCandidates(data, {
    centralTagName: PCO_CENTRAL_TAG_NAME,
    featuredTagName: PCO_CENTRAL_FEATURED_TAG_NAME,
  });

  for (const candidate of candidates) {
    const item = await buildCentralCalendarItem_(
        candidate.instance,
        candidate.eventAttributes,
        roomRules,
        true,
    );

    if (item) return removePrivateDate_(toUpcomingItem_(item));
  }

  return null;
}

/**
 * Converts a Planning Center event instance into Central's public event shape.
 *
 * @param {Object} instance Planning Center event instance.
 * @param {Object} eventAttrs Parent event attributes.
 * @param {Array<Object>} roomRules Published room-name transformation rules.
 * @param {boolean} featured Whether this is Central's featured event.
 * @return {Promise<Object|null>} Sanitized public event.
 */
async function buildCentralCalendarItem_(
    instance,
    eventAttrs,
    roomRules,
    featured,
) {
  const attrs = instance && instance.attributes || {};
  const fallbackStartsAt = attrs.published_starts_at || attrs.starts_at || "";
  const fallbackEndsAt = attrs.published_ends_at || attrs.ends_at || "";
  const fallbackStartsDate = new Date(fallbackStartsAt);

  if (
    !instance ||
    !instance.id ||
    Number.isNaN(fallbackStartsDate.getTime())
  ) {
    return null;
  }

  const description = htmlToPlainText_(
      eventAttrs.description ||
      eventAttrs.summary ||
      attrs.description ||
      "",
  );
  const title = String(attrs.name || "Untitled Event").trim();
  const [rooms, eventSchedule] = await Promise.all([
    getEventInstanceRooms_(
        instance.id,
        Array.isArray(roomRules) ? roomRules : [],
    ),
    featured ? getEventInstanceSchedule_(instance.id, title) : {},
  ]);
  const startsAt = String(eventSchedule.eventStartsAt || fallbackStartsAt);
  const endsAt = String(eventSchedule.eventEndsAt || fallbackEndsAt);
  const startsDate = new Date(startsAt);
  const endsDate = new Date(endsAt);
  const hasValidEndDate = !Number.isNaN(endsDate.getTime());
  const rawLocation = String(attrs.location || "").trim();
  const locationDetails = splitPlanningCenterLocation_(rawLocation);
  const location = rooms.length ?
    rooms.join(", ") : cleanLocation_(rawLocation);
  const doorsOpenStartsAt = new Date(eventSchedule.doorsOpenStartsAt || "");
  const namedDoorsOpenTime = !Number.isNaN(doorsOpenStartsAt.getTime()) ?
    formatTime_(doorsOpenStartsAt, PCO_TIMEZONE) : "";
  const doorsOpenTime = namedDoorsOpenTime ||
    findDoorsOpenTimeInText(description);
  const recurrence = String(
      attrs.compact_recurrence_description ||
      attrs.recurrence_description ||
      "",
  ).trim();
  const recurrenceDetails = String(
      attrs.recurrence_description || recurrence,
  ).trim();
  const calendarDescription = [description, recurrenceDetails]
      .filter(Boolean)
      .join("\n\n");
  const churchCenterUrl = attrs.church_center_url || "";
  const registrationUrl = /^https?:\/\//i.test(
      String(eventAttrs.registration_url || "").trim(),
  ) ? String(eventAttrs.registration_url).trim() : "";

  return {
    id: String(instance.id || "").trim(),
    active: "TRUE",
    featured: featured ? "TRUE" : "FALSE",
    title: title,
    date: formatDate_(startsDate, PCO_TIMEZONE),
    time: formatTimeRange_(startsDate, endsAt, PCO_TIMEZONE),
    doors_open_time: doorsOpenTime,
    location: location,
    description: description,
    recurrence: recurrence,
    recurrence_details: recurrenceDetails,
    venue: locationDetails.venue,
    address: locationDetails.address,
    registration_url: registrationUrl,
    church_center_url: churchCenterUrl,
    button_text: churchCenterUrl ? "Learn More" : "",
    button_url: churchCenterUrl,
    calendar_url: buildGoogleCalendarUrl_({
      title: title,
      startsAt: startsDate,
      endsAt: endsAt,
      location: location,
      description: calendarDescription,
      url: churchCenterUrl,
    }),
    calendar_file_url: buildCalendarFileUrl_({
      title: title,
      startsAt: startsDate,
      endsAt: endsAt,
      location: location,
      description: calendarDescription,
      url: churchCenterUrl,
    }),
    image_url: String(
        eventAttrs.image_url || attrs.image_url || "",
    ).trim(),
    end_date: hasValidEndDate ? formatDate_(endsDate, PCO_TIMEZONE) : "",
    sort: 50,
    source: "Planning Center",
    _dateObj: startsDate,
  };
}

function instanceHasCentralTag_(instance, tagMap) {
  const tagRefs =
    instance.relationships &&
    instance.relationships.tags &&
    instance.relationships.tags.data ?
      instance.relationships.tags.data :
      [];

  return tagRefs.some((tagRef) => tagMap[tagRef.id] === PCO_CENTRAL_TAG_NAME);
}

function cleanLocation_(location) {
  return String(location || "")
      .replace(
          "CrossPointe Church - 2601 24th Ave SE, Norman, OK 73071",
          "CrossPointe Church",
      )
      .trim();
}

/**
 * Splits Planning Center's combined venue and address label.
 *
 * @param {string} location Raw Planning Center location.
 * @return {{venue: string, address: string}} Public location parts.
 */
function splitPlanningCenterLocation_(location) {
  const value = String(location || "").trim();
  const separator = " - ";
  const separatorIndex = value.indexOf(separator);

  if (separatorIndex === -1) {
    return {
      venue: cleanLocation_(value),
      address: "",
    };
  }

  return {
    venue: value.slice(0, separatorIndex).trim(),
    address: value.slice(separatorIndex + separator.length).trim(),
  };
}

/**
 * Builds a Google Calendar event-template URL without requiring OAuth.
 *
 * @param {Object} event Event details.
 * @return {string} A Google Calendar URL, or an empty string without a start.
 */
function buildGoogleCalendarUrl_(event) {
  const startsAt = event && event.startsAt instanceof Date ?
    event.startsAt :
    new Date(event && event.startsAt);

  if (Number.isNaN(startsAt.getTime())) return "";

  const requestedEnd = new Date(event && event.endsAt);
  const endsAt = !Number.isNaN(requestedEnd.getTime()) &&
    requestedEnd.getTime() > startsAt.getTime() ?
      requestedEnd :
      new Date(startsAt.getTime() + 60 * 60 * 1000);
  const details = [
    String((event && event.description) || "").trim(),
    event && event.url ? "More information: " + event.url : "",
  ].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: String((event && event.title) || "CrossPointe Event").trim(),
    dates: formatGoogleCalendarDate_(startsAt) +
      "/" + formatGoogleCalendarDate_(endsAt),
  });

  if (event && event.location) {
    params.set("location", String(event.location).trim());
  }

  if (details) {
    params.set("details", details);
  }

  return "https://calendar.google.com/calendar/render?" + params.toString();
}

/**
 * Formats a date for the Google Calendar event-template dates parameter.
 *
 * @param {Date} date Date to format.
 * @return {string} A compact UTC timestamp.
 */
function formatGoogleCalendarDate_(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Builds a URL for downloading or opening a standards-based calendar event.
 *
 * @param {Object} event Event details.
 * @return {string} A local calendar event URL.
 */
function buildCalendarFileUrl_(event) {
  const startsAt = event && event.startsAt instanceof Date ?
    event.startsAt :
    new Date(event && event.startsAt);

  if (Number.isNaN(startsAt.getTime())) return "";

  const requestedEnd = new Date(event && event.endsAt);
  const endsAt = !Number.isNaN(requestedEnd.getTime()) &&
    requestedEnd.getTime() > startsAt.getTime() ?
      requestedEnd :
      new Date(startsAt.getTime() + 60 * 60 * 1000);
  const payload = {
    t: String((event && event.title) || "CrossPointe Event").trim(),
    s: startsAt.toISOString(),
    e: endsAt.toISOString(),
    l: String((event && event.location) || "").trim(),
    d: String((event && event.description) || "").trim(),
    u: String((event && event.url) || "").trim(),
  };
  const token = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
  );
  const signature = signCalendarEventToken_(token);

  if (!signature) return "";

  return "/api/calendar-event.ics?event=" + encodeURIComponent(token) +
    "&signature=" + encodeURIComponent(signature);
}

/**
 * Decodes and validates a public calendar event token.
 *
 * @param {unknown} rawToken Encoded event token.
 * @param {unknown} rawSignature Event token signature.
 * @return {Object} Validated event details.
 */
function decodeCalendarEventToken_(rawToken, rawSignature) {
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const signature = Array.isArray(rawSignature) ?
    rawSignature[0] :
    rawSignature;
  const cleanToken = String(token || "").trim();
  const cleanSignature = String(signature || "").trim();

  if (
    !cleanToken ||
    cleanToken.length > 12000 ||
    !isValidCalendarEventSignature_(cleanToken, cleanSignature)
  ) {
    throw new Error("Invalid calendar event token.");
  }

  const parsed = JSON.parse(
      Buffer.from(cleanToken, "base64url").toString("utf8"),
  );
  const startsAt = new Date(parsed && parsed.s);
  const requestedEnd = new Date(parsed && parsed.e);

  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Invalid calendar event start.");
  }

  const endsAt = !Number.isNaN(requestedEnd.getTime()) &&
    requestedEnd.getTime() > startsAt.getTime() ?
      requestedEnd :
      new Date(startsAt.getTime() + 60 * 60 * 1000);

  return {
    title: String((parsed && parsed.t) || "CrossPointe Event")
        .trim().slice(0, 240),
    startsAt: startsAt,
    endsAt: endsAt,
    location: String((parsed && parsed.l) || "").trim().slice(0, 500),
    description: String((parsed && parsed.d) || "").trim().slice(0, 4000),
    url: String((parsed && parsed.u) || "").trim().slice(0, 2000),
  };
}

/**
 * Signs a public calendar event token with a domain-separated key.
 *
 * @param {string} token Encoded event token.
 * @return {string} URL-safe token signature.
 */
function signCalendarEventToken_(token) {
  const signingSecret = trimEnvString_(
      CENTRAL_CALENDAR_SIGNING_KEY.value(),
  );
  if (!signingSecret) return "";

  const signingKey = crypto.createHash("sha256")
      .update("crosspointe-central-calendar-event\0")
      .update(signingSecret)
      .digest();

  return crypto.createHmac("sha256", signingKey)
      .update(String(token || ""))
      .digest("base64url");
}

/**
 * Verifies a calendar token signature without leaking timing information.
 *
 * @param {string} token Encoded event token.
 * @param {string} signature Provided token signature.
 * @return {boolean} Whether the signature is valid.
 */
function isValidCalendarEventSignature_(token, signature) {
  const expectedSignature = signCalendarEventToken_(token);

  if (!expectedSignature || !signature) return false;

  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  const providedBytes = Buffer.from(signature, "base64url");

  return expectedBytes.length === providedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Creates an RFC 5545 calendar payload for a single event.
 *
 * @param {Object} event Validated event details.
 * @return {{content: string, filename: string}} Calendar response details.
 */
function buildIcsCalendar_(event) {
  const details = [
    event.description,
    event.url ? "More information: " + event.url : "",
  ].filter(Boolean).join("\n\n");
  const uid = crypto.createHash("sha256")
      .update([
        event.title,
        event.startsAt.toISOString(),
        event.endsAt.toISOString(),
        event.url,
      ].join("|"))
      .digest("hex")
      .slice(0, 32) + "@central.crosspointe.tv";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrossPointe Central//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + formatGoogleCalendarDate_(new Date()),
    "DTSTART:" + formatGoogleCalendarDate_(event.startsAt),
    "DTEND:" + formatGoogleCalendarDate_(event.endsAt),
    "SUMMARY:" + escapeIcsText_(event.title),
  ];

  if (event.location) {
    lines.push("LOCATION:" + escapeIcsText_(event.location));
  }

  if (details) {
    lines.push("DESCRIPTION:" + escapeIcsText_(details));
  }

  if (event.url) {
    lines.push("URL:" + escapeIcsText_(event.url));
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return {
    content: lines.map(foldIcsLine_).join("\r\n") + "\r\n",
    filename: buildCalendarFilename_(event.title),
  };
}

/**
 * Escapes text values used in an iCalendar payload.
 *
 * @param {unknown} value Value to escape.
 * @return {string} Escaped iCalendar text.
 */
function escapeIcsText_(value) {
  return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
}

/**
 * Folds an iCalendar content line to the RFC 5545 byte limit.
 *
 * @param {string} line Calendar content line.
 * @return {string} Folded content line.
 */
function foldIcsLine_(line) {
  const chunks = [];
  let chunk = "";
  let chunkBytes = 0;
  let limit = 75;

  for (const character of String(line || "")) {
    const characterBytes = Buffer.byteLength(character, "utf8");

    if (chunk && chunkBytes + characterBytes > limit) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
      limit = 74;
    }

    chunk += character;
    chunkBytes += characterBytes;
  }

  chunks.push(chunk);
  return chunks.map((value, index) => index ? " " + value : value)
      .join("\r\n");
}

/**
 * Creates a safe calendar filename from an event title.
 *
 * @param {string} title Event title.
 * @return {string} Safe .ics filename.
 */
function buildCalendarFilename_(title) {
  const basename = String(title || "crosspointe-event")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "crosspointe-event";

  return basename + ".ics";
}

async function getEventInstanceRooms_(instanceId, roomRules) {
  const url =
    "https://api.planningcenteronline.com/calendar/v2/event_instances/" +
    encodeURIComponent(instanceId) +
    "/resource_bookings?include=resource";

  const data = await fetchPcoJson_(url);
  const resourceMap = {};

  (data.included || []).forEach((item) => {
    if (item.type !== "Resource") return;

    const attrs = item.attributes || {};
    if (attrs.kind !== "Room") return;

    resourceMap[item.id] = attrs.name || "";
  });

  const rawRooms = (data.data || [])
      .map((booking) => {
        const resource =
          booking.relationships &&
          booking.relationships.resource &&
          booking.relationships.resource.data ?
            booking.relationships.resource.data :
            null;

        if (!resource) return "";

        return resourceMap[resource.id] || "";
      })
      .filter(Boolean);

  return applyRoomRules_(rawRooms, roomRules);
}

/**
 * Retrieves the public Doors Open and main times for an event instance.
 *
 * @param {string} instanceId Planning Center event-instance ID.
 * @param {string} eventTitle Planning Center event title.
 * @return {Promise<Object>} Structured event schedule timestamps.
 */
async function getEventInstanceSchedule_(instanceId, eventTitle) {
  const url =
    "https://api.planningcenteronline.com/calendar/v2/event_instances/" +
    encodeURIComponent(instanceId) +
    "/event_times?order=starts_at&per_page=100";

  try {
    const data = await fetchPcoJson_(url);
    return getPlanningCenterEventSchedule(data, {
      eventTitle,
      mainTimeName: "Event Time",
    });
  } catch (error) {
    console.warn(
        "Planning Center event schedule could not be loaded for instance " +
        String(instanceId || "") + ".",
        error,
    );
    return {};
  }
}

function applyRoomRules_(rawRooms, roomRules) {
  const rooms = [...new Set((rawRooms || []).filter(Boolean))];
  if (!rooms.length) return [];

  const rules = (Array.isArray(roomRules) ? roomRules : [])
      .filter(isActive_)
      .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));

  const resolved = [];

  rooms.forEach((room) => {
    const rule = findRoomRule_(room, rules);

    if (!rule) {
      resolved.push({
        location: room,
        behavior: "replace",
      });
      return;
    }

    const behavior = String(rule.behavior || "replace").toLowerCase();
    const displayLocation = rule.display_location || room;

    if (behavior === "ignore") return;
    if (behavior === "ignore_if_multiple" && rooms.length > 1) return;

    resolved.push({
      location: displayLocation,
      behavior: behavior,
    });
  });

  return [...new Set(
      resolved.map((item) => item.location).filter(Boolean),
  )];
}

function findRoomRule_(roomName, rules) {
  const room = String(roomName || "").trim().toLowerCase();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const matchType = String(rule.match_type || "").trim().toLowerCase();
    const matchText = String(rule.match_text || "").trim().toLowerCase();

    if (!matchText) continue;

    if (matchType === "exact" && room === matchText) return rule;
    if (matchType === "contains" && room.indexOf(matchText) !== -1) return rule;
    if (matchType === "starts_with" && room.startsWith(matchText)) return rule;
    if (matchType === "ends_with" && room.endsWith(matchText)) return rule;
  }

  return null;
}

async function getPlanningCenterSetlist_() {
  if (!PCO_SERVICE_TYPES.length) return [];

  const serviceSongs = await Promise.allSettled(
      PCO_SERVICE_TYPES.map((serviceConfig) => {
        return getNextPlanSongsForServiceType_(
            serviceConfig.serviceTypeId,
            serviceConfig.serviceLabel,
        );
      }),
  );

  return serviceSongs.reduce((allSongs, result) => {
    if (result.status === "fulfilled") {
      return allSongs.concat(result.value);
    }

    console.error("Planning Center service setlist sync failed.", result.reason);
    return allSongs;
  }, []);
}

async function getNextPlanSongsForServiceType_(serviceTypeId, serviceLabel) {
  const plan = await getNextPlanForServiceType_(serviceTypeId);
  if (!plan) return [];

  const url =
    "https://api.planningcenteronline.com/services/v2/service_types/" +
    encodeURIComponent(serviceTypeId) +
    "/plans/" +
    encodeURIComponent(plan.id) +
    "/items?include=song&per_page=100";

  const data = await fetchPcoJson_(url);
  const songMap = {};

  (data.included || []).forEach((item) => {
    if (item.type !== "Song") return;

    const attrs = item.attributes || {};
    songMap[item.id] = {
      title: attrs.title || attrs.name || "",
      author: attrs.author || "",
    };
  });

  let sort = 1;
  let hasReachedSermon = false;

  return (data.data || [])
      .map((item) => {
        const attrs = item.attributes || {};
        const itemTitle = String(attrs.title || "").trim().toLowerCase();

        if (itemTitle === "sermon") {
          hasReachedSermon = true;
        }

        if (hasReachedSermon) return null;

        const songRef =
          item.relationships &&
          item.relationships.song &&
          item.relationships.song.data ?
            item.relationships.song.data :
            null;

        if (!songRef) return null;

        const song = songMap[songRef.id] || {};
        const title =
          song.title ||
          attrs.title ||
          attrs.description ||
          attrs.item_type ||
          "";

        if (!title) return null;

        return {
          active: "TRUE",
          service: serviceLabel,
          song_title: title,
          artist: song.author || "",
          spotify_url: "",
          apple_music_url: "",
          youtube_url: "",
          sort: sort++,
        };
      })
      .filter(Boolean);
}

async function getNextPlanForServiceType_(serviceTypeId) {
  const url =
    "https://api.planningcenteronline.com/services/v2/service_types/" +
    encodeURIComponent(serviceTypeId) +
    "/plans?filter=future&order=sort_date&per_page=1";

  const data = await fetchPcoJson_(url);
  return data.data && data.data.length ? data.data[0] : null;
}

function getSundayModeData_(
    settings,
    sunday,
    setlist,
    sundaySettings,
    environment,
) {
  const timezone = settings.timezone || PCO_TIMEZONE || "America/Chicago";
  const environmentSundaySettings = getSundayModeEnvironmentSettings_(
      sundaySettings,
      environment,
  );
  const resolvedSundaySettings = withResolvedSundayModeWindowSettings_(
      environmentSundaySettings,
  );
  const now = new Date();
  const override = getSundayModeOverrideValue_(
      settings,
      environmentSundaySettings,
  );
  const enabled = override === "enabled" ?
    true :
    (
      override === "disabled" ?
        false :
        isSundayModeWindow_(now, timezone, resolvedSundaySettings)
    );

  return {
    enabled: enabled,
    forced: override === "enabled",
    override: override,
    environment: environment,
    timezone: timezone,
    prompts: [
      "What stood out to me?",
      "What is God teaching me?",
      "What will I do this week?",
    ],
    status: buildSundayStatus_(sunday, setlist, timezone, now),
  };
}

/**
 * Selects the Sunday controls belonging to the resolved environment.
 *
 * @param {Object} sundaySettings Published Sunday settings document.
 * @param {string} environment Resolved Hosting environment.
 * @return {Object} Sunday settings with the correct operational controls.
 */
function getSundayModeEnvironmentSettings_(sundaySettings, environment) {
  const source = sundaySettings && typeof sundaySettings === "object" ?
    sundaySettings :
    {};

  if (environment !== CENTRAL_DATA_ENVIRONMENT_DEV) {
    return source;
  }

  return {
    ...source,
    sunday_mode_override: Object.prototype.hasOwnProperty.call(
        source,
        "dev_sunday_mode_override",
    ) ? source.dev_sunday_mode_override : "auto",
    force_sunday_mode: false,
    sunday_mode_start_time: normalizeSundayModeTimeInputValue_(
        source.dev_sunday_mode_start_time,
    ) || DEFAULT_SUNDAY_MODE_START_TIME,
    sunday_mode_end_time: normalizeSundayModeTimeInputValue_(
        source.dev_sunday_mode_end_time,
    ) || DEFAULT_SUNDAY_MODE_END_TIME,
  };
}

function getSundayModeOverrideValue_(settings, sundaySettings) {
  const sundaySettingsOverride = getExplicitSundayModeOverrideValue_(
      sundaySettings,
  );
  if (sundaySettingsOverride) {
    return sundaySettingsOverride;
  }

  const settingsOverride = getExplicitSundayModeOverrideValue_(settings);
  if (settingsOverride) {
    return settingsOverride;
  }

  return "auto";
}

function getExplicitSundayModeOverrideValue_(source) {
  if (!source || typeof source !== "object") {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(source, "sunday_mode_override")) {
    return normalizeSundayModeOverrideValue_(source.sunday_mode_override);
  }

  if (Object.prototype.hasOwnProperty.call(source, "force_sunday_mode")) {
    return isTruthyValue_(source.force_sunday_mode) ?
      "enabled" :
      "auto";
  }

  return "";
}

function normalizeSundayModeOverrideValue_(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "enabled" ||
    normalized === "on" ||
    normalized === "force_on" ||
    normalized === "true"
  ) {
    return "enabled";
  }

  if (
    normalized === "disabled" ||
    normalized === "off" ||
    normalized === "force_off" ||
    normalized === "false"
  ) {
    return "disabled";
  }

  return "auto";
}

function isSundayModeWindow_(date, timezone, sundaySettings) {
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);

  if (dayName !== "Sun") return false;

  const minutes = getLocalMinutes_(date, timezone);
  const sundayWindow = getSundayModeWindowConfig_(sundaySettings);

  return minutes >= sundayWindow.startMinutes &&
    minutes < sundayWindow.endMinutes;
}

function buildSundayStatus_(sunday, setlist, timezone, now) {
  const services = getSundayServices_(setlist);
  const currentMinutes = getLocalMinutes_(now, timezone);

  const activeService = services.find((service) => {
    return currentMinutes >= service.minutes &&
      currentMinutes < service.minutes + SUNDAY_SERVICE_DURATION_MINUTES;
  });

  if (activeService) {
    const nextService = services.find((service) => service.minutes > activeService.minutes);

    return {
      badge: "Service Live",
      tone: "live",
      title: activeService.label + " service is happening now",
      detail: nextService ?
        "Next live service begins at " + nextService.label + "." :
        "Take notes, watch live, and follow along below.",
      activeService: activeService.label,
      nextService: nextService ? nextService.label : "",
    };
  }

  const firstService = services[0] || null;
  const nextService = services.find((service) => currentMinutes < service.minutes);

  if (firstService && currentMinutes < firstService.minutes) {
    return {
      badge: "Starting Soon",
      tone: "soon",
      title: "Service starts at " + firstService.label,
      detail: "Everything you need for Sunday morning is ready below.",
      activeService: "",
      nextService: firstService.label,
    };
  }

  if (nextService) {
    return {
      badge: "See You Next Week!",
      tone: "closed",
      title: nextService.label + " service starts soon",
      detail: "The next live service begins at " + nextService.label + ".",
      activeService: "",
      nextService: nextService.label,
    };
  }

  return {
    badge: "See You Next Week!",
    tone: "closed",
    title: "Thanks for worshiping with us today",
    detail: sunday.note || "We will see you next Sunday.",
    activeService: "",
    nextService: "",
  };
}

function getSundayServices_(setlist) {
  const seen = {};

  return (Array.isArray(setlist) ? setlist : [])
      .map((item) => String(item.service || "").trim())
      .filter(Boolean)
      .filter((label) => {
        if (seen[label]) return false;
        seen[label] = true;
        return true;
      })
      .map((label) => {
        return {
          label: label,
          minutes: sundayServiceMinutes_(label),
        };
      })
      .sort((a, b) => a.minutes - b.minutes);
}

function sundayServiceMinutes_(label) {
  const match = String(label || "")
      .trim()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);

  if (!match) return 9999;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || "am").toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function getLocalMinutes_(date, timezone) {
  const parts = getTimeZoneParts_(date, timezone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function toTodayItem_(item) {
  return {
    id: item.id,
    active: "TRUE",
    title: item.title,
    date: item.date,
    time: item.time,
    location: item.location,
    description: item.description,
    recurrence: item.recurrence,
    recurrence_details: item.recurrence_details,
    venue: item.venue,
    address: item.address,
    registration_url: item.registration_url,
    church_center_url: item.church_center_url,
    button_text: item.button_text,
    button_url: item.button_url,
    calendar_url: item.calendar_url,
    calendar_file_url: item.calendar_file_url,
    image_url: item.image_url,
    sort: item.sort,
    source: item.source,
    _dateObj: item._dateObj,
  };
}

function toUpcomingItem_(item) {
  return {
    id: item.id,
    active: "TRUE",
    featured: item.featured,
    title: item.title,
    date: item.date,
    time: item.time,
    doors_open_time: item.doors_open_time,
    location: item.location,
    description: item.description,
    recurrence: item.recurrence,
    recurrence_details: item.recurrence_details,
    venue: item.venue,
    address: item.address,
    registration_url: item.registration_url,
    church_center_url: item.church_center_url,
    button_text: item.button_text,
    button_url: item.button_url,
    calendar_url: item.calendar_url,
    calendar_file_url: item.calendar_file_url,
    image_url: item.image_url,
    end_date: item.end_date,
    sort: item.sort,
    source: item.source,
    _dateObj: item._dateObj,
  };
}

function removePrivateDate_(item) {
  delete item._dateObj;
  return item;
}

function sortByDate_(a, b) {
  return a._dateObj.getTime() - b._dateObj.getTime();
}

function sortBySort_(a, b) {
  return Number(a.sort || 999) - Number(b.sort || 999);
}

function isActive_(item) {
  return String((item && item.active) || "").toLowerCase() === "true";
}

function isTruthyValue_(value) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" ||
    normalized === "1" ||
    normalized === "yes";
}

function normalizeSortValue_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateKey_(date, timezone) {
  const parts = getTimeZoneParts_(date, timezone);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function getTimeZoneParts_(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function formatDate_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime_(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).replace(/\s/g, " ");
}

function formatTimeRange_(startsDate, endsAt, timezone) {
  const start = formatTime_(startsDate, timezone);
  if (!endsAt) return start;

  const endDate = new Date(endsAt);
  if (Number.isNaN(endDate.getTime())) return start;

  return start + " - " + formatTime_(endDate, timezone);
}

function parsePlanningCenterServiceTypes_(value) {
  return String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split(":");
        const serviceTypeId = String(parts[0] || "").trim();
        const serviceLabel = parts.slice(1).join(":").trim();

        if (!serviceTypeId || !serviceLabel) return null;

        return {
          serviceTypeId: serviceTypeId,
          serviceLabel: serviceLabel,
        };
      })
      .filter(Boolean);
}

function parsePositiveInt_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildYouVersionBookLookup_() {
  const lookup = {};

  YOUVERSION_BOOK_ALIASES.forEach((book) => {
    (book.names || []).forEach((name) => {
      lookup[normalizeYouVersionBookAlias_(name)] = book.code;
    });
  });

  return lookup;
}

function normalizeYouVersionBookAlias_(value) {
  return String(value || "")
      .toLowerCase()
      .replace(/[.]/g, "")
      .replace(/\s+/g, " ")
      .trim();
}

function parseYouVersionReference_(reference) {
  const cleanedReference = String(reference || "")
      .replace(/[–—]/g, "-")
      .replace(/\(([^)]*)\)\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

  if (!cleanedReference) return null;

  const normalizedReference = normalizeYouVersionBookAlias_(cleanedReference);

  for (const bookKey of YOUVERSION_BOOK_KEYS) {
    if (normalizedReference !== bookKey &&
      !normalizedReference.startsWith(bookKey + " ")) {
      continue;
    }

    const remainder = normalizedReference.slice(bookKey.length).trim();
    const chapterVerseMatch = remainder.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?/);

    if (!chapterVerseMatch) return null;

    let usfm = YOUVERSION_BOOK_LOOKUP[bookKey] + "." + chapterVerseMatch[1];

    if (chapterVerseMatch[2]) {
      usfm += "." + chapterVerseMatch[2];
    }

    if (chapterVerseMatch[3]) {
      usfm += "-" + chapterVerseMatch[3];
    }

    return {
      usfm: usfm,
      displayReference: cleanedReference,
    };
  }

  return null;
}

function buildBibleDotComSearchUrl_(reference) {
  return "https://www.bible.com/search/bible?q=" +
    encodeURIComponent(String(reference || "").trim());
}

function extractYouVersionPassageContent_(payload) {
  const stringCandidates = [];
  collectStringCandidates_(payload, "", stringCandidates, 0);

  const htmlCandidate = rankStringCandidates_(
      stringCandidates.filter((candidate) => looksLikeHtml_(candidate.value)),
      [
        /content\.html/i,
        /html/i,
        /passage/i,
        /content/i,
        /body/i,
      ],
  );

  if (htmlCandidate) {
    const safeHtml = sanitizePassageHtml_(htmlCandidate.value);
    return {
      html: safeHtml,
      text: htmlToPlainText_(safeHtml),
    };
  }

  const textCandidate = rankStringCandidates_(
      stringCandidates.filter((candidate) => looksLikePassageText_(candidate.value)),
      [
        /passage/i,
        /content/i,
        /text/i,
        /body/i,
      ],
  );

  if (!textCandidate) return null;

  return {
    html: "",
    text: normalizePassageText_(textCandidate.value),
  };
}

function collectStringCandidates_(value, path, candidates, depth) {
  if (depth > 6 || !value) return;

  if (typeof value === "string") {
    candidates.push({
      path: path,
      value: value,
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringCandidates_(item, path + "[" + index + "]", candidates, depth + 1);
    });
    return;
  }

  if (typeof value !== "object") return;

  Object.keys(value).forEach((key) => {
    const nextPath = path ? path + "." + key : key;
    collectStringCandidates_(value[key], nextPath, candidates, depth + 1);
  });
}

function rankStringCandidates_(candidates, preferredPatterns) {
  if (!candidates.length) return null;

  const scoredCandidates = candidates.map((candidate) => {
    let score = Math.min(candidate.value.length, 600);

    preferredPatterns.forEach((pattern, index) => {
      if (pattern.test(candidate.path || "")) {
        score += (preferredPatterns.length - index) * 500;
      }
    });

    return {
      candidate: candidate,
      score: score,
    };
  }).sort((a, b) => b.score - a.score);

  return scoredCandidates[0].candidate;
}

function looksLikeHtml_(value) {
  return /<(p|div|span|sup|br|em|strong)\b/i.test(String(value || ""));
}

function looksLikePassageText_(value) {
  const text = String(value || "").trim();

  if (text.length < 30) return false;
  if (/^https?:\/\//i.test(text)) return false;

  return /[A-Za-z]/.test(text) && /\s/.test(text);
}

function sanitizePassageHtml_(html) {
  return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "")
      .replace(/javascript:/gi, "");
}

function htmlToPlainText_(html) {
  return normalizePassageText_(
      String(html || "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, "\"")
          .replace(/&#39;/g, "'"),
  );
}

function normalizePassageText_(text) {
  return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

function extractBestMessage_(payload) {
  const candidates = [];
  collectStringCandidates_(payload, "", candidates, 0);

  const preferredMessage = rankStringCandidates_(
      candidates.filter((candidate) => {
        return /(error|message|detail|title)/i.test(candidate.path || "") &&
          String(candidate.value || "").trim();
      }),
      [
        /error\.message/i,
        /message/i,
        /detail/i,
        /title/i,
      ],
  );

  return preferredMessage ? String(preferredMessage.value).trim() : "";
}

function getBearerToken_(authorizationHeader) {
  const headerValue = String(authorizationHeader || "").trim();
  if (!headerValue.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return headerValue.slice(7).trim();
}

function normalizePreviewPublishSection_(value) {
  const section = String(value || "").trim();

  if (
    section === "hubSettings" ||
    section === "hubSunday" ||
    section === "settingsSunday" ||
    section === "integrations" ||
    section === "thisSunday" ||
    section === "campaigns" ||
    section === "nextSteps" ||
    section === "serveNeeds" ||
    section === "resources" ||
    section === "roomRules" ||
    section === "quickLinks" ||
    section === "statusBanner"
  ) {
    return section;
  }

  return "";
}

function normalizePreviewPublishOperation_(value) {
  return String(value || "").trim() === "hide" ? "hide" : "publish";
}

async function verifyPreviewPublisherAccess_(decodedToken, section) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedCentralAdminEmail_(email)) {
    throw createPreviewPublishError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to publish Central content.",
    );
  }

  const userSnapshot = await firestore
      .doc(getCentralAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createPreviewPublishError_(
        "admin-access-required",
        "Your admin access record must be active before you can publish changes.",
    );
  }

  const permission = getPreviewPublishPermission_(
      userSnapshot.get("pageAccess") || {},
      section,
  );

  if (!canPublishPreviewWithPermission_(permission)) {
    throw createPreviewPublishError_(
        "preview-publish-forbidden",
        "Your current admin access level does not allow publishing this section.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

async function verifyBulletinModeAccess_(decodedToken, requireEdit) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedCentralAdminEmail_(email)) {
    throw createPreviewPublishError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to manage Bulletin Mode.",
    );
  }

  const userSnapshot = await firestore
      .doc(getCentralAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createPreviewPublishError_(
        "admin-access-required",
        "Your admin access record must be active before you can use Bulletin Mode.",
    );
  }

  const pageAccess = userSnapshot.get("pageAccess") || {};
  const permission = getManagedAdminSectionPermission_(
      pageAccess,
      "bulletin",
      "settings",
  );
  const canRead = permission === "view" ||
    permission === "propose" ||
    canPublishPreviewWithPermission_(permission);
  const allowed = requireEdit ?
    canPublishPreviewWithPermission_(permission) :
    canRead;

  if (!allowed) {
    throw createPreviewPublishError_(
        "bulletin-mode-forbidden",
        requireEdit ?
          "Your current admin access level does not allow saving Bulletin Mode settings." :
          "Your current admin access level does not allow viewing Bulletin Mode.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

async function verifyChangeRequestSubmitterAccess_(decodedToken, section) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedCentralAdminEmail_(email)) {
    throw createChangeRequestError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to submit change requests.",
    );
  }

  const userSnapshot = await firestore
      .doc(getCentralAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createChangeRequestError_(
        "admin-access-required",
        "Your admin access record must be active before you can submit change requests.",
    );
  }

  const permission = getPreviewPublishPermission_(
      userSnapshot.get("pageAccess") || {},
      section,
  );

  if (!canSubmitChangeRequestWithPermission_(permission)) {
    throw createChangeRequestError_(
        "change-request-forbidden",
        "Your current admin access level does not allow submitting this section for approval.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

async function verifyChangeRequestReviewerAccess_(decodedToken) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedCentralAdminEmail_(email)) {
    throw createChangeRequestError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to review change requests.",
    );
  }

  const userSnapshot = await firestore
      .doc(getCentralAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createChangeRequestError_(
        "admin-access-required",
        "Your admin access record must be active before you can review change requests.",
    );
  }

  const permission = getChangeRequestsPermission_(
      userSnapshot.get("pageAccess") || {},
  );

  if (!canReviewChangeRequestsWithPermission_(permission)) {
    throw createChangeRequestError_(
        "change-request-review-forbidden",
        "Your current admin access level does not allow reviewing change requests.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

function getPreviewPublishPermission_(pageAccess, section) {
  const source = pageAccess && typeof pageAccess === "object" ?
    pageAccess :
    {};

  if (section === "hubSettings") {
    return getManagedAdminSectionPermission_(source, "hub", "settings");
  }

  if (section === "hubSunday") {
    const sundayPermission = normalizePreviewPermissionValue_(
        source.sundaySettings,
    );
    if (
      !hasManagedAdminPageAccessKey_(source, "hub") &&
      sundayPermission !== "none"
    ) {
      return sundayPermission;
    }

    return getManagedAdminSectionPermission_(source, "hub", "settings");
  }

  if (section === "settingsSunday") {
    return getManagedAdminSectionPermission_(source, "settings");
  }

  if (section === "integrations") {
    return getManagedAdminSectionPermission_(
        source,
        "integrations",
        "settings",
    );
  }

  if (section === "thisSunday") {
    return getManagedAdminSectionPermission_(source, "thisSunday", "settings");
  }

  if (section === "quickLinks") {
    return getManagedAdminSectionPermission_(source, "quickLinks");
  }

  if (section === "campaigns") {
    return getManagedAdminSectionPermission_(source, "campaigns", "settings");
  }

  if (section === "nextSteps") {
    return getManagedAdminSectionPermission_(source, "nextSteps", "settings");
  }

  if (section === "serveNeeds") {
    return getManagedAdminSectionPermission_(source, "serveNeeds", "settings");
  }

  if (section === "resources") {
    return getManagedAdminSectionPermission_(source, "resources", "settings");
  }

  if (section === "roomRules") {
    return getManagedAdminSectionPermission_(source, "roomRules", "settings");
  }

  if (section === "statusBanner") {
    return getManagedAdminSectionPermission_(source, "statusBanner");
  }

  return "none";
}

function hasManagedAdminPageAccessKey_(pageAccess, key) {
  return !!(
    pageAccess &&
    typeof pageAccess === "object" &&
    Object.prototype.hasOwnProperty.call(pageAccess, key)
  );
}

function getManagedAdminSectionPermission_(pageAccess, key, fallbackKey) {
  if (hasManagedAdminPageAccessKey_(pageAccess, key)) {
    return normalizePreviewPermissionValue_(pageAccess[key]);
  }

  if (fallbackKey) {
    return normalizePreviewPermissionValue_(pageAccess[fallbackKey]);
  }

  return "none";
}

function normalizePreviewPermissionValue_(value) {
  return String(value || "none").trim().toLowerCase() || "none";
}

function canPublishPreviewWithPermission_(permission) {
  return permission === "edit" ||
    permission === "approve" ||
    permission === "admin";
}

function canSubmitChangeRequestWithPermission_(permission) {
  return permission === "propose";
}

function canReviewChangeRequestsWithPermission_(permission) {
  return permission === "approve" ||
    permission === "admin";
}

function getChangeRequestsPermission_(pageAccess) {
  return normalizePreviewPermissionValue_(
      pageAccess && pageAccess.changeRequests,
  );
}

async function verifyAdminUserManagerAccess_(decodedToken) {
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);
  if (!isAllowedCentralAdminEmail_(email)) {
    throw createAdminUserManagementError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to manage admin users.",
    );
  }

  const userSnapshot = await firestore
      .doc(getCentralAdminUserDocPath_(decodedToken.uid))
      .get();

  if (!userSnapshot.exists || userSnapshot.get("active") !== true) {
    throw createAdminUserManagementError_(
        "admin-access-required",
        "Your admin access record must be active before you can manage admin users.",
    );
  }

  const permission = getManagedAdminSectionPermission_(
      userSnapshot.get("pageAccess") || {},
      "users",
      "settings",
  );

  if (permission !== "admin") {
    throw createAdminUserManagementError_(
        "admin-user-management-forbidden",
        "Your current admin access level does not allow managing admin users.",
    );
  }

  return {
    uid: String(decodedToken.uid || "").trim(),
    email: email,
    displayName: String(
        decodedToken.name ||
        userSnapshot.get("displayName") ||
        "",
    ).trim(),
  };
}

async function upsertAdminUserRecord_(manager, requestBody, request) {
  const payload = requestBody && typeof requestBody === "object" ?
    requestBody :
    {};
  const requestedInviteId = String(payload.inviteId || "").trim();
  const requestedUid = String(payload.uid || "").trim();
  const requestedEmail = normalizeAdminEmail_(payload.email);
  const requestedDisplayName = String(payload.displayName || "").trim();

  if (payload.active !== false &&
    !hasAnyManagedAdminPageAccess_(payload.pageAccess)) {
    throw createAdminUserManagementError_(
        "invalid-admin-permissions",
        "Choose at least one permission before creating an active admin account.",
    );
  }

  if (!requestedUid && !requestedEmail) {
    throw createAdminUserManagementError_(
        "missing-admin-user-target",
        "Enter a UID or an email address before saving the admin user.",
    );
  }

  const resolvedAuthUser = await resolveAdminUserAuthRecord_(
      requestedUid,
      requestedEmail,
      {
        allowMissingEmail: true,
      },
  );
  const existingUserSnapshotByEmail = requestedEmail ?
    await findAdminUserSnapshotByEmail_(requestedEmail) :
    null;
  const shouldUseInviteFlow = !!requestedEmail &&
    !requestedUid &&
    !existingUserSnapshotByEmail;

  if (requestedInviteId || shouldUseInviteFlow) {
    return await upsertPendingAdminInvite_(
        manager,
        request,
        payload,
        resolvedAuthUser,
    );
  }

  const uid = String(
      requestedUid ||
      resolvedAuthUser && resolvedAuthUser.uid ||
      existingUserSnapshotByEmail &&
        String(existingUserSnapshotByEmail.id || "").trim() ||
      "",
  ).trim();

  if (!uid) {
    throw createAdminUserManagementError_(
        "missing-admin-user-target",
        "We could not determine which Firebase user to update.",
    );
  }

  if (manager && manager.uid && manager.uid === uid && payload.active === false) {
    throw createAdminUserManagementError_(
        "self-disable-forbidden",
        "Do not disable your current admin account from this screen.",
    );
  }

  const userRef = existingUserSnapshotByEmail &&
    String(existingUserSnapshotByEmail.id || "").trim() === uid ?
      existingUserSnapshotByEmail.ref :
      firestore.doc(getCentralAdminUserDocPath_(uid));
  const userSnapshot = existingUserSnapshotByEmail &&
    String(existingUserSnapshotByEmail.id || "").trim() === uid ?
      existingUserSnapshotByEmail :
      await userRef.get();
  const existingData = userSnapshot.exists ? userSnapshot.data() || {} : {};
  const nextEmail = normalizeAdminEmail_(
      requestedEmail ||
      resolvedAuthUser && resolvedAuthUser.email ||
      existingData.email,
  );

  if (nextEmail && !isAllowedCentralAdminEmail_(nextEmail)) {
    throw createAdminUserManagementError_(
        "invalid-admin-email",
        "This email address is not currently allowed to sign in to the admin dashboard.",
    );
  }

  const nextDisplayName = String(
      requestedDisplayName ||
      resolvedAuthUser && resolvedAuthUser.displayName ||
      existingData.displayName ||
      "",
  ).trim();
  const nextPhotoUrl = String(
      resolvedAuthUser && resolvedAuthUser.photoURL ||
      existingData.photoUrl ||
      "",
  ).trim();
  const nextPageAccess = normalizeManagedAdminPageAccessForWrite_(
      payload.pageAccess,
      existingData.pageAccess,
  );
  const nextRoleIds = Array.isArray(existingData.roleIds) ?
    existingData.roleIds :
    [];

  if (manager && manager.uid && manager.uid === uid &&
    nextPageAccess.users !== "admin") {
    throw createAdminUserManagementError_(
        "self-demote-forbidden",
        "Keep your own Users permission at Admin so you do not lock yourself out of admin-user management.",
    );
  }

  await userRef.set({
    uid: uid,
    email: nextEmail,
    displayName: nextDisplayName,
    photoUrl: nextPhotoUrl,
    active: payload.active !== false,
    roleIds: nextRoleIds,
    pageAccess: nextPageAccess,
    createdAt: existingData.createdAt ||
      admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  if (nextEmail) {
    await retirePendingAdminInviteByEmail_(
        nextEmail,
        uid,
        manager,
    );
  }

  return {
    uid: uid,
    recordType: "user",
    message: userSnapshot.exists ?
      "Admin user updated." :
      "Admin user created.",
  };
}

async function upsertPendingAdminInvite_(
    manager,
    request,
    payload,
    resolvedAuthUser,
) {
  const requestedInviteId = String(payload.inviteId || "").trim();
  const requestedEmail = normalizeAdminEmail_(payload.email);
  const requestedDisplayName = String(payload.displayName || "").trim();

  if (!requestedEmail) {
    throw createAdminUserManagementError_(
        "missing-admin-user-target",
        "Enter an email address before sending an admin invite.",
    );
  }

  if (!isAllowedCentralAdminEmail_(requestedEmail)) {
    throw createAdminUserManagementError_(
        "invalid-admin-email",
        "This email address is not currently allowed to sign in to the admin dashboard.",
    );
  }

  let inviteSnapshot = null;

  if (requestedInviteId) {
    inviteSnapshot = await firestore
        .doc(getCentralAdminInviteDocPath_(requestedInviteId))
        .get();

    if (!inviteSnapshot.exists) {
      throw createAdminUserManagementError_(
          "admin-invite-missing",
          "That admin invite could not be found.",
      );
    }
  } else {
    inviteSnapshot = await findPendingAdminInviteByEmail_(requestedEmail);
  }

  const inviteRef = inviteSnapshot && inviteSnapshot.exists ?
    inviteSnapshot.ref :
    firestore.collection(CENTRAL_ADMIN_INVITES_COLLECTION_PATH).doc();
  const existingData = inviteSnapshot && inviteSnapshot.exists ?
    inviteSnapshot.data() || {} :
    {};
  const nextPageAccess = normalizeManagedAdminPageAccessForWrite_(
      payload.pageAccess,
      existingData.pageAccess,
  );
  const nextDisplayName = String(
      requestedDisplayName ||
      resolvedAuthUser && resolvedAuthUser.displayName ||
      existingData.displayName ||
      "",
  ).trim();
  const rawToken = createCentralOpaqueToken_();
  const inviteUrl = buildCentralAdminInviteUrl_(
      request,
      inviteRef.id,
      rawToken,
  );
  const inviteExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + (CENTRAL_ADMIN_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  );

  await inviteRef.set({
    invitedEmail: requestedEmail,
    displayName: nextDisplayName,
    active: payload.active !== false,
    pageAccess: nextPageAccess,
    status: "pending",
    inviteTokenHash: hashCentralOpaqueToken_(rawToken),
    inviteExpiresAt: inviteExpiresAt,
    inviteUrl: inviteUrl,
    invitedByUid: String(manager && manager.uid || "").trim(),
    invitedByEmail: String(manager && manager.email || "").trim(),
    invitedByName: String(manager && manager.displayName || "").trim(),
    inviteSentCount: Number(existingData.inviteSentCount || 0) + 1,
    lastMailStatus: "queued",
    createdAt: existingData.createdAt ||
      admin.firestore.FieldValue.serverTimestamp(),
    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedAt: admin.firestore.FieldValue.delete(),
    acceptedByUid: admin.firestore.FieldValue.delete(),
    acceptedByEmail: admin.firestore.FieldValue.delete(),
  }, {merge: true});

  try {
    const mailDocId = await queueCentralAdminInviteNotification_({
      email: requestedEmail,
      displayName: nextDisplayName,
      inviteUrl: inviteUrl,
      inviteExpiresAt: inviteExpiresAt,
      invitedByName: String(manager && manager.displayName || "").trim(),
      invitedByEmail: String(manager && manager.email || "").trim(),
      pageAccess: nextPageAccess,
    });

    await inviteRef.set({
      lastMailMessageId: mailDocId,
      lastMailStatus: "sent",
      lastMailDocId: admin.firestore.FieldValue.delete(),
      lastMailError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } catch (error) {
    await inviteRef.set({
      lastMailStatus: "failed",
      lastMailError: String(
          error && error.message || "Unknown email delivery failure.",
      ).slice(0, 500),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    throw createAdminUserManagementError_(
        "admin-invite-email-failed",
        "The admin invite was saved, but we could not send the email right now.",
    );
  }

  return {
    uid: "",
    inviteId: inviteRef.id,
    recordType: "invite",
    message: inviteSnapshot && inviteSnapshot.exists ?
      "Admin invite updated and emailed." :
      "Admin invite sent.",
  };
}

async function deleteAdminUserRecord_(manager, requestBody) {
  const payload = requestBody && typeof requestBody === "object" ?
    requestBody :
    {};
  const requestedRecordType = String(payload.recordType || "user")
      .trim()
      .toLowerCase();
  const requestedInviteId = String(payload.inviteId || "").trim();
  const requestedUid = String(payload.uid || "").trim();
  const requestedEmail = normalizeAdminEmail_(payload.email);

  if (requestedRecordType === "invite" || requestedInviteId) {
    if (!requestedInviteId) {
      throw createAdminUserManagementError_(
          "missing-admin-user-target",
          "Choose an admin invite before deleting it.",
      );
    }

    const inviteRef = firestore.doc(getCentralAdminInviteDocPath_(requestedInviteId));
    const inviteSnapshot = await inviteRef.get();

    if (!inviteSnapshot.exists) {
      throw createAdminUserManagementError_(
          "admin-invite-missing",
          "That admin invite could not be found.",
      );
    }

    await inviteRef.delete();

    return {
      uid: "",
      inviteId: requestedInviteId,
      recordType: "invite",
      message: "Admin invite deleted.",
    };
  }

  let userSnapshot = null;

  if (requestedUid) {
    userSnapshot = await firestore
        .doc(getCentralAdminUserDocPath_(requestedUid))
        .get();
  } else if (requestedEmail) {
    userSnapshot = await findAdminUserSnapshotByEmail_(requestedEmail);
  }

  if (!userSnapshot || !userSnapshot.exists) {
    throw createAdminUserManagementError_(
        "admin-user-missing",
        "That admin user could not be found.",
    );
  }

  const targetUid = String(
      userSnapshot.get("uid") ||
      userSnapshot.id ||
      "",
  ).trim();

  if (manager && manager.uid && manager.uid === targetUid) {
    throw createAdminUserManagementError_(
        "self-delete-forbidden",
        "Do not delete your current admin account from this screen.",
    );
  }

  await userSnapshot.ref.delete();

  return {
    uid: targetUid,
    inviteId: "",
    recordType: "user",
    message: "Admin user deleted.",
  };
}

async function claimAdminInvite_(decodedToken, requestBody) {
  const payload = requestBody && typeof requestBody === "object" ?
    requestBody :
    {};
  const inviteId = String(payload.inviteId || "").trim();
  const token = String(payload.token || "").trim();
  const email = normalizeAdminEmail_(decodedToken && decodedToken.email);

  if (!inviteId || !token) {
    throw createAdminUserManagementError_(
        "admin-invite-required",
        "Open the invite link again before trying to confirm this admin account.",
    );
  }

  if (!isAllowedCentralAdminEmail_(email)) {
    throw createAdminUserManagementError_(
        "admin-email-required",
        "Use a CrossPointe account or an explicitly allowed tester account to claim this invite.",
    );
  }

  const inviteRef = firestore.doc(getCentralAdminInviteDocPath_(inviteId));
  const tokenHash = hashCentralOpaqueToken_(token);

  return await firestore.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);

    if (!inviteSnapshot.exists) {
      throw createAdminUserManagementError_(
          "admin-invite-missing",
          "That admin invite could not be found.",
      );
    }

    const inviteData = inviteSnapshot.data() || {};
    const inviteStatus = String(inviteData.status || "").trim().toLowerCase();

    if (inviteStatus && inviteStatus !== "pending") {
      throw createAdminUserManagementError_(
          "admin-invite-claimed",
          "That admin invite has already been used or is no longer pending.",
      );
    }

    if (normalizeAdminEmail_(inviteData.invitedEmail) !== email) {
      throw createAdminUserManagementError_(
          "admin-invite-email-mismatch",
          "Sign in with the Google account that received this invite before confirming access.",
      );
    }

    if (String(inviteData.inviteTokenHash || "").trim() !== tokenHash) {
      throw createAdminUserManagementError_(
          "admin-invite-token-invalid",
          "That admin invite link is no longer valid. Ask for a fresh invite.",
      );
    }

    const inviteExpiresAtMillis = getFirestoreTimestampMillis_(
        inviteData.inviteExpiresAt,
    );
    if (inviteExpiresAtMillis && inviteExpiresAtMillis < Date.now()) {
      transaction.set(inviteRef, {
        status: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      throw createAdminUserManagementError_(
          "admin-invite-expired",
          "That admin invite has expired. Ask for a fresh invite.",
      );
    }

    const userRef = firestore.doc(
        getCentralAdminUserDocPath_(decodedToken.uid),
    );
    const userSnapshot = await transaction.get(userRef);
    const existingUserData = userSnapshot.exists ?
      userSnapshot.data() || {} :
      {};

    transaction.set(userRef, {
      uid: String(decodedToken.uid || "").trim(),
      email: email,
      displayName: String(
          decodedToken.name ||
          existingUserData.displayName ||
          inviteData.displayName ||
          "",
      ).trim(),
      photoUrl: String(
          decodedToken.picture ||
          existingUserData.photoUrl ||
          "",
      ).trim(),
      active: inviteData.active !== false,
      roleIds: Array.isArray(existingUserData.roleIds) ?
        existingUserData.roleIds :
        [],
      pageAccess: normalizeManagedAdminPageAccessForWrite_(
          inviteData.pageAccess,
          existingUserData.pageAccess,
      ),
      createdAt: existingUserData.createdAt ||
        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    transaction.set(inviteRef, {
      status: "accepted",
      inviteTokenHash: admin.firestore.FieldValue.delete(),
      inviteUrl: admin.firestore.FieldValue.delete(),
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedByUid: String(decodedToken.uid || "").trim(),
      acceptedByEmail: email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    return {
      uid: String(decodedToken.uid || "").trim(),
      inviteId: inviteId,
      message: "Your Central Admin invite was confirmed.",
    };
  });
}

async function resolveAdminUserAuthRecord_(requestedUid, requestedEmail, options) {
  const allowMissingEmail = !!(
    options &&
    options.allowMissingEmail === true
  );

  if (requestedUid) {
    try {
      return await admin.auth().getUser(requestedUid);
    } catch (error) {
      if (!requestedEmail) {
        return null;
      }
    }
  }

  if (!requestedEmail) {
    return null;
  }

  try {
    return await admin.auth().getUserByEmail(requestedEmail);
  } catch (error) {
    if (allowMissingEmail) {
      return null;
    }
    throw createAdminUserManagementError_(
        "admin-user-resolve-failed",
        "We could not resolve that email to a Firebase user yet. Ask them to sign in once first or paste their UID instead.",
    );
  }
}

async function findAdminUserSnapshotByEmail_(email) {
  if (!email) {
    return null;
  }

  const snapshot = await firestore
      .collection(CENTRAL_ADMIN_USERS_COLLECTION_PATH)
      .where("email", "==", normalizeAdminEmail_(email))
      .limit(1)
      .get();

  return snapshot.empty ? null : snapshot.docs[0];
}

async function findPendingAdminInviteByEmail_(email) {
  if (!email) {
    return null;
  }

  const snapshot = await firestore
      .collection(CENTRAL_ADMIN_INVITES_COLLECTION_PATH)
      .where("invitedEmail", "==", normalizeAdminEmail_(email))
      .where("status", "==", "pending")
      .limit(1)
      .get();

  return snapshot.empty ? null : snapshot.docs[0];
}

async function retirePendingAdminInviteByEmail_(email, uid, manager) {
  const pendingInviteSnapshot = await findPendingAdminInviteByEmail_(email);

  if (!pendingInviteSnapshot || !pendingInviteSnapshot.exists) {
    return;
  }

  await pendingInviteSnapshot.ref.set({
    status: "superseded",
    inviteTokenHash: admin.firestore.FieldValue.delete(),
    inviteUrl: admin.firestore.FieldValue.delete(),
    supersededAt: admin.firestore.FieldValue.serverTimestamp(),
    supersededByUid: String(uid || "").trim(),
    supersededByManagerUid: String(manager && manager.uid || "").trim(),
    supersededByManagerEmail: String(manager && manager.email || "").trim(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

function normalizeManagedAdminPageAccessForWrite_(pageAccess, existingPageAccess) {
  const source = pageAccess && typeof pageAccess === "object" ?
    pageAccess :
    {};
  const nextPageAccess = existingPageAccess &&
    typeof existingPageAccess === "object" ?
      {...existingPageAccess} :
      {};

  MANAGED_ADMIN_PAGE_KEYS.forEach((key) => {
    const value = (key === "integrations" || key === "bulletin") &&
      !Object.prototype.hasOwnProperty.call(source, key) ?
      source.settings :
      source[key];
    nextPageAccess[key] = normalizePreviewPermissionValue_(value);
  });

  return nextPageAccess;
}

function hasAnyManagedAdminPageAccess_(pageAccess) {
  const source = pageAccess && typeof pageAccess === "object" ?
    pageAccess :
    {};

  return MANAGED_ADMIN_PAGE_KEYS.some((key) => {
    return normalizePreviewPermissionValue_(source[key]) !== "none";
  });
}

function normalizeManagedAdminUserResponse_(docSnapshot) {
  const data = docSnapshot && typeof docSnapshot.data === "function" ?
    docSnapshot.data() || {} :
    {};

  return {
    recordType: "user",
    inviteId: "",
    uid: String(data.uid || docSnapshot.id || "").trim(),
    email: normalizeAdminEmail_(data.email),
    displayName: String(data.displayName || "").trim(),
    photoUrl: String(data.photoUrl || "").trim(),
    active: data.active === true,
    roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
    pageAccess: normalizeManagedAdminPageAccessForWrite_(
        data.pageAccess,
        createManagedAdminPageAccessTemplate_("none"),
    ),
  };
}

function normalizeManagedAdminInviteResponse_(docSnapshot) {
  const data = docSnapshot && typeof docSnapshot.data === "function" ?
    docSnapshot.data() || {} :
    {};

  return {
    recordType: "invite",
    inviteId: String(docSnapshot && docSnapshot.id || "").trim(),
    uid: "",
    email: normalizeAdminEmail_(data.invitedEmail),
    displayName: String(data.displayName || "").trim(),
    photoUrl: "",
    active: data.active !== false,
    roleIds: [],
    pageAccess: normalizeManagedAdminPageAccessForWrite_(
        data.pageAccess,
        createManagedAdminPageAccessTemplate_("none"),
    ),
    inviteStatus: String(data.status || "pending").trim().toLowerCase(),
    inviteExpiresAt: serializeAdminTimestampForJson_(data.inviteExpiresAt),
    inviteSentAt: serializeAdminTimestampForJson_(
        data.lastSentAt || data.updatedAt || data.createdAt,
    ),
  };
}

function createManagedAdminPageAccessTemplate_(permission) {
  const nextPageAccess = {};
  const normalizedPermission = normalizePreviewPermissionValue_(permission);

  MANAGED_ADMIN_PAGE_KEYS.forEach((key) => {
    nextPageAccess[key] = normalizedPermission;
  });

  return nextPageAccess;
}

function createAdminUserManagementError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getAdminUserManagementStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "admin-user-management-forbidden") {
    return 403;
  }

  if (error.code === "missing-admin-user-target" ||
    error.code === "admin-user-resolve-failed" ||
    error.code === "invalid-admin-email" ||
    error.code === "invalid-admin-permissions" ||
    error.code === "self-disable-forbidden" ||
    error.code === "self-delete-forbidden" ||
    error.code === "self-demote-forbidden" ||
    error.code === "admin-invite-required" ||
    error.code === "admin-invite-token-invalid") {
    return 400;
  }

  if (error.code === "admin-invite-email-mismatch") {
    return 403;
  }

  if (error.code === "admin-invite-missing" ||
    error.code === "admin-user-missing") {
    return 404;
  }

  if (error.code === "admin-invite-claimed" ||
    error.code === "admin-invite-expired") {
    return 409;
  }

  if (error.code === "admin-invite-email-failed") {
    return 502;
  }

  return 500;
}

function getAdminUserManagementErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "The admin user request failed.";
}

function createPreviewPublishError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getPreviewPublishStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "preview-publish-forbidden"
  ) {
    return 403;
  }

  if (
    error.code === "invalid-section" ||
    error.code === "invalid-operation" ||
    error.code === "invalid-payload"
  ) {
    return 400;
  }

  if (error.code === "change-request-conflict") {
    return 409;
  }

  return 500;
}

function getPreviewPublishErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "Unable to publish content.";
}

function getBulletinModeStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "bulletin-mode-forbidden"
  ) {
    return 403;
  }

  return 400;
}

function getBulletinModeErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "Unable to load or save Bulletin Mode settings.";
}

function createChangeRequestError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getChangeRequestStatusCode_(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "change-request-forbidden" ||
    error.code === "change-request-review-forbidden"
  ) {
    return 403;
  }

  if (
    error.code === "change-request-missing" ||
    error.code === "change-request-closed" ||
    error.code === "change-request-conflict"
  ) {
    return 409;
  }

  if (
    error.code === "invalid-section" ||
    error.code === "invalid-operation" ||
    error.code === "invalid-decision" ||
    error.code === "missing-request-id" ||
    error.code === "invalid-payload"
  ) {
    return 400;
  }

  return 500;
}

function getChangeRequestErrorMessage_(error) {
  return error && error.message ?
    error.message :
    "Unable to process the change request.";
}

function normalizeChangeRequestDecision_(value) {
  const decision = String(value || "").trim().toLowerCase();

  if (decision === "approve" || decision === "reject") {
    return decision;
  }

  return "";
}

function getSubmittedBaselineItems_(section, requestBody) {
  const rawBaselineItems = Array.isArray(requestBody && requestBody.baselineItems) ?
    requestBody.baselineItems :
    null;

  if (!rawBaselineItems) {
    return null;
  }

  if (section === "campaigns") {
    return normalizeCampaignsComparisonItems_(rawBaselineItems);
  }

  if (section === "nextSteps") {
    return normalizeNextStepsComparisonItems_(rawBaselineItems);
  }

  if (section === "serveNeeds") {
    return normalizeServeNeedsComparisonItems_(rawBaselineItems);
  }

  if (section === "resources") {
    return normalizeResourcesComparisonItems_(rawBaselineItems);
  }

  if (section === "roomRules") {
    return normalizeRoomRulesComparisonItems_(rawBaselineItems);
  }

  if (section === "quickLinks") {
    return normalizeQuickLinksComparisonItems_(rawBaselineItems);
  }

  return null;
}

function getSubmittedCampaignsChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeCampaignsChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function getSubmittedNextStepsChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeNextStepsChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function getSubmittedServeNeedsChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeServeNeedsChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function getSubmittedResourcesChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeResourcesChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function getSubmittedRoomRulesChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeRoomRulesChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function getSubmittedQuickLinksChangeSet_(requestBody, baselineItems, payload) {
  if (!requestBody || typeof requestBody.changeSet !== "object") {
    return null;
  }

  return normalizeQuickLinksChangeSet_(
      requestBody.changeSet,
      baselineItems || [],
      payload && payload.items,
  );
}

function normalizePreviewSectionPayload_(section, operation, rawPayload) {
  if (section === "hubSettings") {
    const payload = buildPublishedHubSettingsPayload_(rawPayload || {});
    validatePreviewButtonPair_(
        payload.primary_button_text,
        payload.primary_button_url,
        "Enter both a text label and a URL for the primary button.",
    );
    validatePreviewButtonPair_(
        payload.secondary_button_text,
        payload.secondary_button_url,
        "Enter both a text label and a URL for the secondary button.",
    );
    return payload;
  }

  if (section === "hubSunday") {
    const payload = buildPublishedHubSundayPayload_(rawPayload || {});
    validatePreviewButtonPair_(
        payload.sunday_primary_button_text,
        payload.sunday_primary_button_url,
        "Enter both a text label and a URL for the Sunday primary button.",
    );
    validatePreviewButtonPair_(
        payload.sunday_secondary_button_text,
        payload.sunday_secondary_button_url,
        "Enter both a text label and a URL for the Sunday secondary button.",
    );
    return payload;
  }

  if (section === "settingsSunday") {
    return buildPublishedSettingsSundayPayload_(rawPayload || {});
  }

  if (section === "integrations") {
    return buildPublishedIntegrationsPayload_(rawPayload || {});
  }

  if (section === "thisSunday") {
    const payload = buildPublishedThisSundayPayload_(rawPayload || {});

    if (!payload.date_iso && !payload.date) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Choose the Sunday date before publishing.",
      );
    }

    return payload;
  }

  if (section === "statusBanner") {
    if (operation === "hide") {
      return {};
    }

    const payload = buildPublishedStatusBannerPayload_(rawPayload || {});
    if (!payload.title) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "The banner needs a headline.",
      );
    }

    if (!payload.message) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "The banner needs a message.",
      );
    }

    validatePreviewButtonPair_(
        payload.button_text,
        payload.button_url,
        "If you use a button, enter both button text and button URL.",
    );
    return payload;
  }

  if (section === "campaigns") {
    return {
      items: normalizeCampaignsPayloadItems_(rawPayload),
    };
  }

  if (section === "nextSteps") {
    return {
      items: normalizeNextStepsPayloadItems_(rawPayload),
    };
  }

  if (section === "serveNeeds") {
    return {
      items: normalizeServeNeedsPayloadItems_(rawPayload),
    };
  }

  if (section === "resources") {
    return {
      items: normalizeResourcesPayloadItems_(rawPayload),
    };
  }

  if (section === "roomRules") {
    return {
      items: normalizeRoomRulesPayloadItems_(rawPayload),
    };
  }

  if (section === "quickLinks") {
    return {
      items: normalizeQuickLinksPayloadItems_(rawPayload),
    };
  }

  throw createPreviewPublishError_(
      "invalid-section",
      "Choose a section to publish.",
  );
}

function validatePreviewButtonPair_(label, url, errorMessage) {
  if ((label && !url) || (!label && url)) {
    throw createPreviewPublishError_(
        "invalid-payload",
        errorMessage,
    );
  }
}

function normalizeResourcesPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Resources need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedResourcePayload_(item || {});
    const docId = normalizeResourcePublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.title) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every resource needs a title.",
      );
    }

    validatePreviewButtonPair_(
        payload.button_text,
        payload.button_url,
        "If you use a button, enter both button text and button URL.",
    );

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeRoomRulesPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Room Rules need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedRoomRulePayload_(item || {});
    const docId = normalizeRoomRulePublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.match_text) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Room Rule needs match text.",
      );
    }

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeCampaignsPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Campaigns need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedCampaignPayload_(item || {});
    const docId = normalizeCampaignPublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.title) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every campaign needs a title.",
      );
    }

    validatePreviewButtonPair_(
        payload.button_text,
        payload.button_url,
        "If you use a button, enter both button text and button URL.",
    );

    if (!payload.ongoing && (!payload.start_date || !payload.end_date)) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Scheduled campaigns need both a start date and an end date.",
      );
    }

    if (!payload.ongoing && payload.end_date < payload.start_date) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Campaign end dates must be on or after the start date.",
      );
    }

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeNextStepsPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Next Steps need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedNextStepPayload_(item || {});
    const docId = normalizeNextStepPublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.title) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Next Step needs a title.",
      );
    }

    validatePreviewButtonPair_(
        payload.button_text,
        payload.button_url,
        "If you use a button, enter both button text and button URL.",
    );

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeServeNeedsPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Serve Needs need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedServeNeedPayload_(item || {});
    const docId = normalizeServeNeedPublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.need) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Serve Need needs a need title.",
      );
    }

    if (!payload.ministry) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Serve Need needs a ministry.",
      );
    }

    if (!payload.button_text) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Serve Need needs button text.",
      );
    }

    if (!looksLikeEmailAddress_(payload.contact_email)) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every Serve Need needs a valid contact email address.",
      );
    }

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeQuickLinksPayloadItems_(rawPayload) {
  const rawItems = Array.isArray(rawPayload) ?
    rawPayload :
    Array.isArray(rawPayload && rawPayload.items) ?
      rawPayload.items :
      null;

  if (!rawItems) {
    throw createPreviewPublishError_(
        "invalid-payload",
        "Quick links need a valid list of items.",
    );
  }

  return rawItems.map((item, index) => {
    const payload = buildPublishedQuickLinkPayload_(item || {});
    const docId = normalizeQuickLinkPublishDocId_(
        item && item.id,
        index,
    );

    if (!payload.title) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every quick link needs a title.",
      );
    }

    if (!payload.url) {
      throw createPreviewPublishError_(
          "invalid-payload",
          "Every quick link needs a destination URL.",
      );
    }

    return {
      id: docId,
      ...payload,
    };
  });
}

function normalizeResourcePublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "resource-" + String(index + 1);
}

function normalizeRoomRulePublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "room-rule-" + String(index + 1);
}

function normalizeCampaignPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "campaign-" + String(index + 1);
}

function normalizeNextStepPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "next-step-" + String(index + 1);
}

function normalizeServeNeedPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "serve-need-" + String(index + 1);
}

function normalizeQuickLinkPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "quick-link-" + String(index + 1);
}

async function publishPreviewSectionPayload_(
    section,
    operation,
    payload,
    publisher,
) {
  if (section === "hubSettings") {
    return publishPreviewMergedSingletonPayload_({
      publishedDocPath: CENTRAL_PUBLIC_SETTINGS_DOC_PATH,
      payload: payload,
      message: "Homepage published.",
      publisher: publisher,
    });
  }

  if (section === "hubSunday") {
    return publishPreviewMergedSingletonPayload_({
      publishedDocPath: CENTRAL_PUBLIC_SUNDAY_SETTINGS_DOC_PATH,
      payload: payload,
      message: "Sunday Mode published.",
      publisher: publisher,
    });
  }

  if (section === "settingsSunday") {
    return publishPreviewMergedSingletonPayload_({
      publishedDocPath: CENTRAL_PUBLIC_SUNDAY_SETTINGS_DOC_PATH,
      payload: payload,
      message: "Sunday controls published.",
      publisher: publisher,
    });
  }

  if (section === "integrations") {
    return publishPreviewMergedSingletonPayload_({
      publishedDocPath: CENTRAL_PUBLIC_SUNDAY_SETTINGS_DOC_PATH,
      payload: payload,
      message: "Integrations published.",
      publisher: publisher,
    });
  }

  if (section === "thisSunday") {
    return publishPreviewSingletonPayload_({
      publishedDocPath: CENTRAL_PUBLIC_THIS_SUNDAY_DOC_PATH,
      payload: payload,
      message: "Sunday published.",
      publisher: publisher,
    });
  }

  if (section === "statusBanner") {
    return operation === "hide" ?
      hidePreviewStatusBanner_(publisher) :
      publishPreviewSingletonPayload_({
        publishedDocPath: CENTRAL_STATUS_BANNER_DOC_PATH,
        payload: payload,
        message: "Status banner published.",
        publisher: publisher,
      });
  }

  if (section === "campaigns") {
    return publishPreviewCampaignsPayload_(payload, publisher);
  }

  if (section === "nextSteps") {
    return publishPreviewNextStepsPayload_(payload, publisher);
  }

  if (section === "serveNeeds") {
    return publishPreviewServeNeedsPayload_(payload, publisher);
  }

  if (section === "resources") {
    return publishPreviewResourcesPayload_(payload, publisher);
  }

  if (section === "roomRules") {
    return publishPreviewRoomRulesPayload_(payload, publisher);
  }

  if (section === "quickLinks") {
    return publishPreviewQuickLinksPayload_(payload, publisher);
  }

  throw createPreviewPublishError_(
      "invalid-section",
      "Choose a section to publish.",
  );
}

async function hidePreviewStatusBanner_(publisher) {
  const docPayload = withPreviewPublishMetadata_(
      {
        active: false,
      },
      {},
      publisher,
  );

  await firestore.doc(CENTRAL_STATUS_BANNER_DOC_PATH).set(docPayload);

  return {
    itemCount: 1,
    message: "Status banner hidden.",
  };
}

async function publishPreviewSingletonPayload_(config) {
  const publishedRef = firestore.doc(config.publishedDocPath);
  const publishedSnapshot = await publishedRef.get();
  const docPayload = withPreviewPublishMetadata_(
      config.payload || {},
      publishedSnapshot.exists ? publishedSnapshot.data() || {} : {},
      config.publisher,
  );

  await publishedRef.set(docPayload);

  return {
    itemCount: 1,
    message: config.message,
  };
}

async function publishPreviewMergedSingletonPayload_(config) {
  const publishedRef = firestore.doc(config.publishedDocPath);
  const publishedSnapshot = await publishedRef.get();
  const existingData = publishedSnapshot.exists ?
    publishedSnapshot.data() || {} :
    {};
  const mergedPayload = mergePreviewSingletonPayload(
      existingData,
      config.payload,
  );
  const docPayload = withPreviewPublishMetadata_(
      mergedPayload,
      existingData,
      config.publisher,
  );

  await publishedRef.set(docPayload);

  return {
    itemCount: 1,
    message: config.message,
  };
}

async function publishPreviewResourcesPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_RESOURCES_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_RESOURCES_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_RESOURCES_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      title: item.title,
      type: item.type,
      description: item.description,
      button_text: item.button_text,
      button_url: item.button_url,
      sort: item.sort,
      active: item.active,
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Resources published.",
  } : {
    itemCount: 0,
    message:
      "Resources were cleared. The Resources section will stay hidden until you add items again.",
  };
}

async function publishPreviewRoomRulesPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_ROOM_RULES_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_ROOM_RULES_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_ROOM_RULES_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      match_type: normalizeRoomRuleMatchType_(item.match_type),
      match_text: trimFirestoreStringValue_(item.match_text),
      display_location: trimFirestoreStringValue_(item.display_location),
      behavior: normalizeRoomRuleBehavior_(item.behavior),
      priority: normalizeSortValue_(item.priority, 50),
      active: isTruthyValue_(item.active),
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Room Rules published.",
  } : {
    itemCount: 0,
    message: "Room Rules were cleared.",
  };
}

async function publishPreviewServeNeedsPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_SERVE_NEEDS_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_SERVE_NEEDS_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_SERVE_NEEDS_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      need: item.need,
      ministry: item.ministry,
      priority: item.priority,
      description: item.description,
      button_text: item.button_text,
      contact_email: item.contact_email,
      sort: item.sort,
      active: item.active,
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Serve Needs published.",
  } : {
    itemCount: 0,
    message:
      "Serve Needs were cleared. The Serve Needs section will stay hidden until you add items again.",
  };
}

async function publishPreviewCampaignsPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_CAMPAIGNS_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_CAMPAIGNS_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_CAMPAIGNS_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      title: item.title,
      description: item.description,
      button_text: item.button_text,
      button_url: item.button_url,
      ongoing: item.ongoing,
      start_date: item.start_date,
      end_date: item.end_date,
      sort: item.sort,
      active: item.active,
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Campaigns published.",
  } : {
    itemCount: 0,
    message:
      "Campaigns were cleared. The Campaigns section will stay hidden until you add items again.",
  };
}

async function publishPreviewNextStepsPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_NEXT_STEPS_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_NEXT_STEPS_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_NEXT_STEPS_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      title: item.title,
      description: item.description,
      button_text: item.button_text,
      button_url: item.button_url,
      sort: item.sort,
      active: item.active,
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Next Steps published.",
  } : {
    itemCount: 0,
    message:
      "Next Steps were cleared. The Next Steps section will stay hidden until you add items again.",
  };
}

async function publishPreviewQuickLinksPayload_(payload, publisher) {
  const items = Array.isArray(payload && payload.items) ?
    payload.items :
    [];
  const metaRef = firestore.doc(CENTRAL_QUICK_LINKS_META_DOC_PATH);
  const publishedSnapshot = await firestore
      .collection(CENTRAL_QUICK_LINKS_COLLECTION_PATH)
      .get();
  const existingById = new Map();

  publishedSnapshot.docs.forEach((docSnapshot) => {
    existingById.set(docSnapshot.id, docSnapshot.data() || {});
  });

  const batch = firestore.batch();
  const nextIds = new Set();

  items.forEach((item) => {
    const docId = item.id;
    const publishedRef = firestore
        .collection(CENTRAL_QUICK_LINKS_COLLECTION_PATH)
        .doc(docId);
    const nextPayload = {
      title: item.title,
      url: item.url,
      sort: item.sort,
      active: item.active,
      sunday_only: !!item.sunday_only,
    };

    batch.set(
        publishedRef,
        withPreviewPublishMetadata_(
            nextPayload,
            existingById.get(docId) || {},
            publisher,
        ),
    );
    nextIds.add(docId);
  });

  publishedSnapshot.docs.forEach((docSnapshot) => {
    if (!nextIds.has(docSnapshot.id)) {
      batch.delete(docSnapshot.ref);
    }
  });
  batch.set(
      metaRef,
      buildPreviewListOverrideStatePayload_(items.length, publisher),
      {merge: true},
  );

  await batch.commit();

  return items.length ? {
    itemCount: items.length,
    message: "Quick links published.",
  } : {
    itemCount: 0,
    message:
      "Quick Links were cleared. The Quick Links section will stay hidden until you add items again.",
  };
}

function getPreviewSectionLabel_(section) {
  if (section === "hubSettings") {
    return "Homepage";
  }

  if (section === "hubSunday") {
    return "Sunday Mode";
  }

  if (section === "settingsSunday") {
    return "Settings";
  }

  if (section === "integrations") {
    return "Integrations";
  }

  if (section === "thisSunday") {
    return "Sunday";
  }

  if (section === "campaigns") {
    return "Campaigns";
  }

  if (section === "nextSteps") {
    return "Next Steps";
  }

  if (section === "serveNeeds") {
    return "Serve Needs";
  }

  if (section === "resources") {
    return "Resources";
  }

  if (section === "roomRules") {
    return "Room Rules";
  }

  if (section === "quickLinks") {
    return "Quick Links";
  }

  if (section === "statusBanner") {
    return "Status Banner";
  }

  return "Central Content";
}

function buildChangeRequestSummary_(section, operation, payload) {
  if (section === "hubSettings") {
    return [
      "Homepage",
      String(
          payload.hero_heading ||
          payload.site_title ||
          ((
            Array.isArray(payload.homepage_modules) &&
            payload.homepage_modules.length
          ) ?
            "module layout update" :
            "content update"),
      ).trim(),
    ].join(": ");
  }

  if (section === "hubSunday") {
    return [
      "Sunday Mode",
      String(
          payload.sunday_heading ||
          payload.sunday_eyebrow ||
          ((
            Array.isArray(payload.sunday_modules) &&
            payload.sunday_modules.length
          ) ?
            "module layout update" :
            "content update"),
      ).trim(),
      ].join(": ");
  }

  if (section === "settingsSunday") {
    return "Settings: operational Sunday controls update";
  }

  if (section === "integrations") {
    return "Integrations: connected service settings update";
  }

  if (section === "thisSunday") {
    return [
      "Sunday",
      String(
          payload.sermon_title ||
          payload.series ||
          payload.date ||
          "content update",
      ).trim(),
    ].join(": ");
  }

  if (section === "statusBanner") {
    return operation === "hide" ?
      "Status Banner: hide the current banner" :
      [
        "Status Banner",
        String(payload.title || "content update").trim(),
      ].join(": ");
  }

  if (section === "campaigns") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Campaigns: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "campaign", "campaigns");
  }

  if (section === "nextSteps") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Next Steps: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "next step", "next steps");
  }

  if (section === "serveNeeds") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Serve Needs: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "need", "needs");
  }

  if (section === "resources") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Resources: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "resource", "resources");
  }

  if (section === "roomRules") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Room Rules: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "rule", "rules");
  }

  if (section === "quickLinks") {
    const count = Array.isArray(payload && payload.items) ?
      payload.items.length :
      0;
    return "Quick Links: replace list with " +
      String(count) +
      " " +
      getCountLabel_(count, "link", "links");
  }

  return getPreviewSectionLabel_(section) + ": content update";
}

async function buildChangeRequestMetadata_(section, operation, payload, requestBody) {
  if (section === "campaigns") {
    try {
      const submittedBaselineItems =
        getSubmittedBaselineItems_(section, requestBody);
      const submittedChangeSet = getSubmittedCampaignsChangeSet_(
          requestBody,
          submittedBaselineItems || [],
          payload,
      );

      if (submittedChangeSet) {
        const baselineItems = submittedBaselineItems || [];
        const breakdown = summarizeCampaignsSubmittedChangeSet_(
            baselineItems,
            submittedChangeSet,
        );

        return {
          summary: buildCampaignsChangeRequestSummary_(breakdown),
          requestFields: {
            campaignsBaselineHash: createCampaignsComparisonHash_(
                baselineItems,
            ),
            campaignsBaselineItems: baselineItems,
            campaignsChangeBreakdown: breakdown,
            campaignsChangeSet: submittedChangeSet,
          },
        };
      }

      const currentItems = submittedBaselineItems ||
        await getCurrentCampaignsBaselineItems_();
      const proposedItems = normalizeCampaignsComparisonItems_(
          payload && payload.items,
      );
      const breakdown = summarizeCampaignsChangeSet_(
          currentItems,
          proposedItems,
      );

      return {
        summary: buildCampaignsChangeRequestSummary_(breakdown),
        requestFields: {
          campaignsBaselineHash: createCampaignsComparisonHash_(currentItems),
          campaignsBaselineItems: currentItems,
          campaignsChangeBreakdown: breakdown,
          campaignsChangeSet: computeCampaignsChangeSet_(
              currentItems,
              proposedItems,
          ),
        },
      };
    } catch (error) {
      console.error("Campaigns change request metadata failed.", error);
      throw createChangeRequestError_(
          "invalid-payload",
          "Campaigns could not be prepared for approval. Reload Campaigns and submit the request again.",
      );
    }
  }

  if (section === "nextSteps") {
    try {
      const submittedBaselineItems =
        getSubmittedBaselineItems_(section, requestBody);
      const submittedChangeSet = getSubmittedNextStepsChangeSet_(
          requestBody,
          submittedBaselineItems || [],
          payload,
      );

      if (submittedChangeSet) {
        const baselineItems = submittedBaselineItems || [];
        const breakdown = summarizeNextStepsSubmittedChangeSet_(
            baselineItems,
            submittedChangeSet,
        );

        return {
          summary: buildNextStepsChangeRequestSummary_(breakdown),
          requestFields: {
            nextStepsBaselineHash: createNextStepsComparisonHash_(
                baselineItems,
            ),
            nextStepsBaselineItems: baselineItems,
            nextStepsChangeBreakdown: breakdown,
            nextStepsChangeSet: submittedChangeSet,
          },
        };
      }

      const currentItems = submittedBaselineItems ||
        await getCurrentNextStepsBaselineItems_();
      const proposedItems = normalizeNextStepsComparisonItems_(
          payload && payload.items,
      );
      const breakdown = summarizeNextStepsChangeSet_(
          currentItems,
          proposedItems,
      );

      return {
        summary: buildNextStepsChangeRequestSummary_(breakdown),
        requestFields: {
          nextStepsBaselineHash: createNextStepsComparisonHash_(currentItems),
          nextStepsBaselineItems: currentItems,
          nextStepsChangeBreakdown: breakdown,
          nextStepsChangeSet: computeNextStepsChangeSet_(
              currentItems,
              proposedItems,
          ),
        },
      };
    } catch (error) {
      console.error("Next Steps change request metadata failed.", error);
      throw createChangeRequestError_(
          "invalid-payload",
          "Next Steps could not be prepared for approval. Reload Next Steps and submit the request again.",
      );
    }
  }

  if (section === "serveNeeds") {
    try {
      const submittedBaselineItems =
        getSubmittedBaselineItems_(section, requestBody);
      const submittedChangeSet = getSubmittedServeNeedsChangeSet_(
          requestBody,
          submittedBaselineItems || [],
          payload,
      );

      if (submittedChangeSet) {
        const baselineItems = submittedBaselineItems || [];
        const breakdown = summarizeServeNeedsSubmittedChangeSet_(
            baselineItems,
            submittedChangeSet,
        );

        return {
          summary: buildServeNeedsChangeRequestSummary_(breakdown),
          requestFields: {
            serveNeedsBaselineHash: createServeNeedsComparisonHash_(
                baselineItems,
            ),
            serveNeedsBaselineItems: baselineItems,
            serveNeedsChangeBreakdown: breakdown,
            serveNeedsChangeSet: submittedChangeSet,
          },
        };
      }

      const currentItems = submittedBaselineItems ||
        await getCurrentServeNeedsBaselineItems_();
      const proposedItems = normalizeServeNeedsComparisonItems_(
          payload && payload.items,
      );
      const breakdown = summarizeServeNeedsChangeSet_(
          currentItems,
          proposedItems,
      );

      return {
        summary: buildServeNeedsChangeRequestSummary_(breakdown),
        requestFields: {
          serveNeedsBaselineHash: createServeNeedsComparisonHash_(currentItems),
          serveNeedsBaselineItems: currentItems,
          serveNeedsChangeBreakdown: breakdown,
          serveNeedsChangeSet: computeServeNeedsChangeSet_(
              currentItems,
              proposedItems,
          ),
        },
      };
    } catch (error) {
      console.error("Serve Needs change request metadata failed.", error);
      throw createChangeRequestError_(
          "invalid-payload",
          "Serve Needs could not be prepared for approval. Reload Serve Needs and submit the request again.",
      );
    }
  }

  if (section === "resources") {
    try {
      const submittedBaselineItems =
        getSubmittedBaselineItems_(section, requestBody);
      const submittedChangeSet = getSubmittedResourcesChangeSet_(
          requestBody,
          submittedBaselineItems || [],
          payload,
      );

      if (submittedChangeSet) {
        const baselineItems = submittedBaselineItems || [];
        const breakdown = summarizeResourcesSubmittedChangeSet_(
            baselineItems,
            submittedChangeSet,
        );

        return {
          summary: buildResourcesChangeRequestSummary_(breakdown),
          requestFields: {
            resourcesBaselineHash: createResourcesComparisonHash_(
                baselineItems,
            ),
            resourcesBaselineItems: baselineItems,
            resourcesChangeBreakdown: breakdown,
            resourcesChangeSet: submittedChangeSet,
          },
        };
      }

      const currentItems = submittedBaselineItems ||
        await getCurrentResourcesBaselineItems_();
      const proposedItems = normalizeResourcesComparisonItems_(
          payload && payload.items,
      );
      const breakdown = summarizeResourcesChangeSet_(
          currentItems,
          proposedItems,
      );

      return {
        summary: buildResourcesChangeRequestSummary_(breakdown),
        requestFields: {
          resourcesBaselineHash: createResourcesComparisonHash_(currentItems),
          resourcesBaselineItems: currentItems,
          resourcesChangeBreakdown: breakdown,
          resourcesChangeSet: computeResourcesChangeSet_(
              currentItems,
              proposedItems,
          ),
        },
      };
    } catch (error) {
      console.error("Resources change request metadata failed.", error);
      return {
        summary: buildChangeRequestSummary_(section, operation, payload),
        requestFields: {},
      };
    }
  }

  if (section === "roomRules") {
    try {
      const submittedBaselineItems =
        getSubmittedBaselineItems_(section, requestBody);
      const submittedChangeSet = getSubmittedRoomRulesChangeSet_(
          requestBody,
          submittedBaselineItems || [],
          payload,
      );

      if (submittedChangeSet) {
        const baselineItems = submittedBaselineItems || [];
        const breakdown = summarizeRoomRulesSubmittedChangeSet_(
            baselineItems,
            submittedChangeSet,
        );

        return {
          summary: buildRoomRulesChangeRequestSummary_(breakdown),
          requestFields: {
            roomRulesBaselineHash: createRoomRulesComparisonHash_(
                baselineItems,
            ),
            roomRulesBaselineItems: baselineItems,
            roomRulesChangeBreakdown: breakdown,
            roomRulesChangeSet: submittedChangeSet,
          },
        };
      }

      const currentItems = submittedBaselineItems ||
        await getCurrentRoomRulesBaselineItems_();
      const proposedItems = normalizeRoomRulesComparisonItems_(
          payload && payload.items,
      );
      const breakdown = summarizeRoomRulesChangeSet_(
          currentItems,
          proposedItems,
      );

      return {
        summary: buildRoomRulesChangeRequestSummary_(breakdown),
        requestFields: {
          roomRulesBaselineHash: createRoomRulesComparisonHash_(currentItems),
          roomRulesBaselineItems: currentItems,
          roomRulesChangeBreakdown: breakdown,
          roomRulesChangeSet: computeRoomRulesChangeSet_(
              currentItems,
              proposedItems,
          ),
        },
      };
    } catch (error) {
      console.error("Room Rules change request metadata failed.", error);
      throw createChangeRequestError_(
          "invalid-payload",
          "Room Rules could not be prepared for approval. Reload Settings and submit the request again.",
      );
    }
  }

  if (section !== "quickLinks") {
    return {
      summary: buildChangeRequestSummary_(section, operation, payload),
      requestFields: {},
    };
  }

  try {
    const submittedBaselineItems =
      getSubmittedBaselineItems_(section, requestBody);
    const submittedChangeSet = getSubmittedQuickLinksChangeSet_(
        requestBody,
        submittedBaselineItems || [],
        payload,
    );

    if (submittedChangeSet) {
      const baselineItems = submittedBaselineItems || [];
      const breakdown = summarizeQuickLinksSubmittedChangeSet_(
          baselineItems,
          submittedChangeSet,
      );

      return {
        summary: buildQuickLinksChangeRequestSummary_(breakdown),
        requestFields: {
          quickLinksBaselineHash: createQuickLinksComparisonHash_(
              baselineItems,
          ),
          quickLinksBaselineItems: baselineItems,
          quickLinksChangeBreakdown: breakdown,
          quickLinksChangeSet: submittedChangeSet,
        },
      };
    }

    const currentItems = submittedBaselineItems ||
      await getCurrentQuickLinksBaselineItems_();
    const proposedItems = normalizeQuickLinksComparisonItems_(
        payload && payload.items,
    );
    const breakdown = summarizeQuickLinksChangeSet_(
        currentItems,
        proposedItems,
    );

    return {
      summary: buildQuickLinksChangeRequestSummary_(breakdown),
      requestFields: {
        quickLinksBaselineHash: createQuickLinksComparisonHash_(currentItems),
        quickLinksBaselineItems: currentItems,
        quickLinksChangeBreakdown: breakdown,
        quickLinksChangeSet: computeQuickLinksChangeSet_(
            currentItems,
            proposedItems,
        ),
      },
    };
  } catch (error) {
    console.error("Quick-links change request metadata failed.", error);
    return {
      summary: buildChangeRequestSummary_(section, operation, payload),
      requestFields: {},
    };
  }
}

async function assertChangeRequestStillApprovable_(requestData) {
  const section = String(requestData && requestData.section || "").trim();

  if (section === "campaigns") {
    const baselineHash = String(
        requestData && requestData.campaignsBaselineHash || "",
    ).trim();

    if (!baselineHash) {
      return;
    }

    const currentItems = await getCurrentCampaignsBaselineItems_();
    const currentHash = createCampaignsComparisonHash_(currentItems);

    if (currentHash !== baselineHash) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Campaigns changed after this request was submitted. Reload Campaigns and submit a fresh request so you do not overwrite newer edits.",
      );
    }
    return;
  }

  if (section === "nextSteps") {
    const baselineHash = String(
        requestData && requestData.nextStepsBaselineHash || "",
    ).trim();

    if (!baselineHash) {
      return;
    }

    const currentItems = await getCurrentNextStepsBaselineItems_();
    const currentHash = createNextStepsComparisonHash_(currentItems);

    if (currentHash !== baselineHash) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Next Steps changed after this request was submitted. Reload Next Steps and submit a fresh request so you do not overwrite newer edits.",
      );
    }
    return;
  }

  if (section === "serveNeeds") {
    const baselineHash = String(
        requestData && requestData.serveNeedsBaselineHash || "",
    ).trim();

    if (!baselineHash) {
      return;
    }

    const currentItems = await getCurrentServeNeedsBaselineItems_();
    const currentHash = createServeNeedsComparisonHash_(currentItems);

    if (currentHash !== baselineHash) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Serve Needs changed after this request was submitted. Reload Serve Needs and submit a fresh request so you do not overwrite newer edits.",
      );
    }
    return;
  }

  if (section === "resources") {
    const baselineHash = String(
        requestData && requestData.resourcesBaselineHash || "",
    ).trim();

    if (!baselineHash) {
      return;
    }

    const currentItems = await getCurrentResourcesBaselineItems_();
    const currentHash = createResourcesComparisonHash_(currentItems);

    if (currentHash !== baselineHash) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Resources changed after this request was submitted. Reload Resources and submit a fresh request so you do not overwrite newer edits.",
      );
    }
    return;
  }

  if (section === "roomRules") {
    const baselineHash = String(
        requestData && requestData.roomRulesBaselineHash || "",
    ).trim();

    if (!baselineHash) {
      return;
    }

    const currentItems = await getCurrentRoomRulesBaselineItems_();
    const currentHash = createRoomRulesComparisonHash_(currentItems);

    if (currentHash !== baselineHash) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Room Rules changed after this request was submitted. Reload Settings and submit a fresh request so you do not overwrite newer edits.",
      );
    }
    return;
  }

  if (section !== "quickLinks") {
    return;
  }

  const baselineHash = String(
      requestData && requestData.quickLinksBaselineHash || "",
  ).trim();

  if (!baselineHash) {
    return;
  }

  const currentItems = await getCurrentQuickLinksBaselineItems_();
  const currentHash = createQuickLinksComparisonHash_(currentItems);

  if (currentHash !== baselineHash) {
    throw createChangeRequestError_(
        "change-request-conflict",
        "Quick Links changed after this request was submitted. Reload Quick Links and submit a fresh request so you do not overwrite newer edits.",
    );
  }
}

async function resolveChangeRequestPayloadForApproval_(requestData) {
  const section = String(requestData && requestData.section || "").trim();
  const operation = normalizePreviewPublishOperation_(
      requestData && requestData.operation,
  );
  const payload = requestData && requestData.payload || {};

  if (section === "campaigns" && operation === "publish") {
    return resolveCampaignsApprovalPayload_(requestData);
  }

  if (section === "nextSteps" && operation === "publish") {
    return resolveNextStepsApprovalPayload_(requestData);
  }

  if (section === "serveNeeds" && operation === "publish") {
    return resolveServeNeedsApprovalPayload_(requestData);
  }

  if (section === "resources" && operation === "publish") {
    return resolveResourcesApprovalPayload_(requestData);
  }

  if (section === "roomRules" && operation === "publish") {
    return resolveRoomRulesApprovalPayload_(requestData);
  }

  if (section !== "quickLinks" || operation !== "publish") {
    return payload;
  }

  return resolveQuickLinksApprovalPayload_(requestData);
}

async function resolveDirectPreviewPublishPayload_(section, requestBody, payload) {
  const baselineItems = getSubmittedBaselineItems_(section, requestBody);
  if (!baselineItems) {
    return payload;
  }

  if (section === "campaigns") {
    const changeSet = getSubmittedCampaignsChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyCampaignsChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentCampaignsBaselineItems_(),
      ),
    };
  }

  if (section === "nextSteps") {
    const changeSet = getSubmittedNextStepsChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyNextStepsChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentNextStepsBaselineItems_(),
      ),
    };
  }

  if (section === "serveNeeds") {
    const changeSet = getSubmittedServeNeedsChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyServeNeedsChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentServeNeedsBaselineItems_(),
      ),
    };
  }

  if (section === "resources") {
    const changeSet = getSubmittedResourcesChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyResourcesChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentResourcesBaselineItems_(),
      ),
    };
  }

  if (section === "roomRules") {
    const changeSet = getSubmittedRoomRulesChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyRoomRulesChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentRoomRulesBaselineItems_(),
      ),
    };
  }

  if (section === "quickLinks") {
    const changeSet = getSubmittedQuickLinksChangeSet_(
        requestBody,
        baselineItems,
        payload,
    );
    if (!changeSet) {
      return payload;
    }

    return {
      items: applyQuickLinksChangeSet_(
          baselineItems,
          changeSet,
          await getCurrentQuickLinksBaselineItems_(),
      ),
    };
  }

  return payload;
}

async function resolveCampaignsApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.campaignsBaselineItems;
  const baselineHash = String(
      requestData && requestData.campaignsBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeCampaignsComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
      "This Campaigns request is missing the merge-safe approval metadata. Please reload Campaigns and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeCampaignsComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeCampaignsChangeSet_(
      requestData && requestData.campaignsChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentCampaignsBaselineItems_();
  const mergedItems = applyCampaignsChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function resolveNextStepsApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.nextStepsBaselineItems;
  const baselineHash = String(
      requestData && requestData.nextStepsBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeNextStepsComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
      "This Next Steps request is missing the merge-safe approval metadata. Please reload Next Steps and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeNextStepsComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeNextStepsChangeSet_(
      requestData && requestData.nextStepsChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentNextStepsBaselineItems_();
  const mergedItems = applyNextStepsChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function resolveServeNeedsApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.serveNeedsBaselineItems;
  const baselineHash = String(
      requestData && requestData.serveNeedsBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeServeNeedsComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
        "This Serve Needs request is missing the merge-safe approval metadata. Please reload Serve Needs and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeServeNeedsComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeServeNeedsChangeSet_(
      requestData && requestData.serveNeedsChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentServeNeedsBaselineItems_();
  const mergedItems = applyServeNeedsChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function resolveRoomRulesApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.roomRulesBaselineItems;
  const baselineHash = String(
      requestData && requestData.roomRulesBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeRoomRulesComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
        "This Room Rules request is missing the merge-safe approval metadata. Please reload Settings and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeRoomRulesComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeRoomRulesChangeSet_(
      requestData && requestData.roomRulesChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentRoomRulesBaselineItems_();
  const mergedItems = applyRoomRulesChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function resolveResourcesApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.resourcesBaselineItems;
  const baselineHash = String(
      requestData && requestData.resourcesBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeResourcesComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
        "This Resources request is missing the merge-safe approval metadata. Please reload Resources and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeResourcesComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeResourcesChangeSet_(
      requestData && requestData.resourcesChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentResourcesBaselineItems_();
  const mergedItems = applyResourcesChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function getCurrentListBaselineItems_(config) {
  const publishedSnapshot = await firestore.collection(config.collectionPath).get();

  if (publishedSnapshot.empty) {
    return config.normalizeItems([]);
  }

  return config.normalizeItems(
      publishedSnapshot.docs.map((docSnapshot) => {
        return {
          id: docSnapshot.id,
          ...(docSnapshot.data() || {}),
        };
      }),
  );
}

async function getCurrentCampaignsBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_CAMPAIGNS_COLLECTION_PATH,
    normalizeItems: normalizeCampaignsComparisonItems_,
  });
}

function normalizeCampaignsComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeCampaignComparisonItem_(item, index))
      .sort(sortCampaignsComparisonItems_);
}

function normalizeCampaignsChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeCampaignsChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeCampaignsComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function normalizeCampaignComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");
  const ongoing = getNormalizedCampaignOngoingValue_(source);

  return {
    id: normalizeCampaignPublishDocId_(source.id, index),
    title: trimFirestoreStringValue_(source.title),
    description: trimFirestoreStringValue_(source.description),
    button_text: trimFirestoreStringValue_(source.button_text),
    button_url: trimFirestoreStringValue_(source.button_url),
    ongoing: ongoing,
    start_date: ongoing ? "" : normalizeCampaignDateValue_(source.start_date),
    end_date: ongoing ? "" : normalizeCampaignDateValue_(source.end_date),
    sort: normalizeSortValue_(source.sort, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
  };
}

function sortCampaignsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeCampaignsChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areCampaignsComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function computeCampaignsChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapCampaignsComparisonItemsById_(baselineItems);
  const proposedById = mapCampaignsComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areCampaignsComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortCampaignsComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function applyCampaignsChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapCampaignsComparisonItemsById_(baselineItems);
  const currentById = mapCampaignsComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeCampaignsChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Campaigns conflict on \"" +
            getCampaignConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areCampaignsComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Campaigns conflict on \"" +
          getCampaignConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areCampaignsComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Campaigns conflict on \"" +
            getCampaignConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Campaigns conflict on \"" +
          getCampaignConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areCampaignsComparisonItemsEqual_(baselineItem, currentItem) &&
      !areCampaignsComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Campaigns conflict on \"" +
          getCampaignConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortCampaignsComparisonItems_);
}

function mapCampaignsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areCampaignsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Boolean(currentItem && currentItem.ongoing) ===
      Boolean(proposedItem && proposedItem.ongoing) &&
    String(currentItem && currentItem.start_date || "") ===
      String(proposedItem && proposedItem.start_date || "") &&
    String(currentItem && currentItem.end_date || "") ===
      String(proposedItem && proposedItem.end_date || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getCampaignConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this campaign",
  ) || "this campaign";
}

function buildCampaignsChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "campaign", "campaigns"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "campaign", "campaigns"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "campaign", "campaigns"),
    );
  }

  if (!parts.length) {
    return "Campaigns: no changes detected";
  }

  return "Campaigns: " + parts.join(", ");
}

function summarizeCampaignsSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeCampaignsComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeCampaignsChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapCampaignsComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areCampaignsComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createCampaignsComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeCampaignsComparisonItems_(items)))
      .digest("hex");
}

async function getCurrentNextStepsBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_NEXT_STEPS_COLLECTION_PATH,
    normalizeItems: normalizeNextStepsComparisonItems_,
  });
}

function normalizeNextStepsComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeNextStepComparisonItem_(item, index))
      .sort(sortNextStepsComparisonItems_);
}

function normalizeNextStepsChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeNextStepsChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeNextStepsComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function normalizeNextStepComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");

  return {
    id: normalizeNextStepPublishDocId_(source.id, index),
    title: trimFirestoreStringValue_(source.title),
    description: trimFirestoreStringValue_(source.description),
    button_text: trimFirestoreStringValue_(source.button_text),
    button_url: trimFirestoreStringValue_(source.button_url),
    sort: normalizeSortValue_(source.sort, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
  };
}

function sortNextStepsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeNextStepsChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areNextStepsComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function computeNextStepsChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapNextStepsComparisonItemsById_(baselineItems);
  const proposedById = mapNextStepsComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areNextStepsComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortNextStepsComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function applyNextStepsChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapNextStepsComparisonItemsById_(baselineItems);
  const currentById = mapNextStepsComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeNextStepsChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Next Steps conflict on \"" +
            getNextStepConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areNextStepsComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Next Steps conflict on \"" +
          getNextStepConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areNextStepsComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Next Steps conflict on \"" +
            getNextStepConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Next Steps conflict on \"" +
          getNextStepConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areNextStepsComparisonItemsEqual_(baselineItem, currentItem) &&
      !areNextStepsComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Next Steps conflict on \"" +
          getNextStepConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortNextStepsComparisonItems_);
}

function mapNextStepsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areNextStepsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getNextStepConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this next step",
  ) || "this next step";
}

function buildNextStepsChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "next step", "next steps"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "next step", "next steps"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "next step", "next steps"),
    );
  }

  if (!parts.length) {
    return "Next Steps: no changes detected";
  }

  return "Next Steps: " + parts.join(", ");
}

function summarizeNextStepsSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeNextStepsComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeNextStepsChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapNextStepsComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areNextStepsComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createNextStepsComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeNextStepsComparisonItems_(items)))
      .digest("hex");
}

function normalizeServeNeedPriorityValue_(value) {
  return trimFirestoreStringValue_(value || "normal").toLowerCase() || "normal";
}

async function getCurrentServeNeedsBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_SERVE_NEEDS_COLLECTION_PATH,
    normalizeItems: normalizeServeNeedsComparisonItems_,
  });
}

function normalizeServeNeedsComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeServeNeedComparisonItem_(item, index))
      .sort(sortServeNeedsComparisonItems_);
}

function normalizeServeNeedsChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeServeNeedsChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeServeNeedsComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function normalizeServeNeedComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");

  return {
    id: normalizeServeNeedPublishDocId_(source.id, index),
    need: trimFirestoreStringValue_(source.need || source.title),
    ministry: trimFirestoreStringValue_(source.ministry),
    priority: normalizeServeNeedPriorityValue_(
        source.priority || source.urgency,
    ),
    description: trimFirestoreStringValue_(source.description),
    button_text: trimFirestoreStringValue_(source.button_text),
    contact_email: trimFirestoreStringValue_(
        source.contact_email || source.email,
    ).toLowerCase(),
    sort: normalizeSortValue_(source.sort, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
  };
}

function sortServeNeedsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeServeNeedsChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areServeNeedsComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function computeServeNeedsChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapServeNeedsComparisonItemsById_(baselineItems);
  const proposedById = mapServeNeedsComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areServeNeedsComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortServeNeedsComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function applyServeNeedsChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapServeNeedsComparisonItemsById_(baselineItems);
  const currentById = mapServeNeedsComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeServeNeedsChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Serve Needs conflict on \"" +
            getServeNeedConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areServeNeedsComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Serve Needs conflict on \"" +
          getServeNeedConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areServeNeedsComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Serve Needs conflict on \"" +
            getServeNeedConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Serve Needs conflict on \"" +
          getServeNeedConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areServeNeedsComparisonItemsEqual_(baselineItem, currentItem) &&
      !areServeNeedsComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Serve Needs conflict on \"" +
          getServeNeedConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortServeNeedsComparisonItems_);
}

function mapServeNeedsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areServeNeedsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.need || "") ===
    String(proposedItem && proposedItem.need || "") &&
    String(currentItem && currentItem.ministry || "") ===
      String(proposedItem && proposedItem.ministry || "") &&
    String(currentItem && currentItem.priority || "normal") ===
      String(proposedItem && proposedItem.priority || "normal") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.contact_email || "") ===
      String(proposedItem && proposedItem.contact_email || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getServeNeedConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.need ||
      currentItem && currentItem.need ||
      fallbackId ||
      "this serve need",
  ) || "this serve need";
}

function buildServeNeedsChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "need", "needs"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "need", "needs"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "need", "needs"),
    );
  }

  if (!parts.length) {
    return "Serve Needs: no changes detected";
  }

  return "Serve Needs: " + parts.join(", ");
}

function summarizeServeNeedsSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeServeNeedsComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeServeNeedsChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapServeNeedsComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areServeNeedsComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createServeNeedsComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeServeNeedsComparisonItems_(items)))
      .digest("hex");
}

async function getCurrentResourcesBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_RESOURCES_COLLECTION_PATH,
    normalizeItems: normalizeResourcesComparisonItems_,
  });
}

function normalizeResourcesComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeResourceComparisonItem_(item, index))
      .sort(sortResourcesComparisonItems_);
}

function normalizeResourcesChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeResourcesChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeResourcesComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function normalizeResourceComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");

  return {
    id: normalizeResourcePublishDocId_(source.id, index),
    title: trimFirestoreStringValue_(source.title),
    type: trimFirestoreStringValue_(source.type),
    description: trimFirestoreStringValue_(source.description),
    button_text: trimFirestoreStringValue_(source.button_text),
    button_url: trimFirestoreStringValue_(source.button_url),
    sort: normalizeSortValue_(source.sort, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
  };
}

function sortResourcesComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeResourcesChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areResourcesComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function computeResourcesChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapResourcesComparisonItemsById_(baselineItems);
  const proposedById = mapResourcesComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areResourcesComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortResourcesComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function mergeResourcesChangeSet_(baselineItems, proposedItems, currentItems) {
  const baselineById = mapResourcesComparisonItemsById_(baselineItems);
  const proposedById = mapResourcesComparisonItemsById_(proposedItems);
  const currentById = mapResourcesComparisonItemsById_(currentItems);
  const allIds = new Set([
    ...baselineById.keys(),
    ...proposedById.keys(),
    ...currentById.keys(),
  ]);
  const mergedItems = [];

  for (const id of allIds) {
    const baselineItem = baselineById.get(id) || null;
    const proposedItem = proposedById.get(id) || null;
    const currentItem = currentById.get(id) || null;
    const mergedItem = mergeResourcesItemChange_(
        id,
        baselineItem,
        proposedItem,
        currentItem,
    );

    if (mergedItem) {
      mergedItems.push(mergedItem);
    }
  }

  return mergedItems.sort(sortResourcesComparisonItems_);
}

function applyResourcesChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapResourcesComparisonItemsById_(baselineItems);
  const currentById = mapResourcesComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeResourcesChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Resources conflict on \"" +
            getResourceConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areResourcesComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Resources conflict on \"" +
          getResourceConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areResourcesComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Resources conflict on \"" +
            getResourceConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Resources conflict on \"" +
          getResourceConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areResourcesComparisonItemsEqual_(baselineItem, currentItem) &&
      !areResourcesComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Resources conflict on \"" +
          getResourceConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortResourcesComparisonItems_);
}

function mapResourcesComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function mergeResourcesItemChange_(id, baselineItem, proposedItem, currentItem) {
  if (!baselineItem) {
    if (proposedItem && currentItem) {
      if (areResourcesComparisonItemsEqual_(proposedItem, currentItem)) {
        return proposedItem;
      }

      throw createChangeRequestError_(
          "change-request-conflict",
          "Resources conflict on \"" +
          getResourceConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    return proposedItem || currentItem || null;
  }

  const proposedChanged = !areResourcesItemsEqualOrMissing_(
      baselineItem,
      proposedItem,
  );
  const currentChanged = !areResourcesItemsEqualOrMissing_(
      baselineItem,
      currentItem,
  );

  if (!proposedChanged && !currentChanged) {
    return currentItem || baselineItem;
  }

  if (proposedChanged && !currentChanged) {
    return proposedItem;
  }

  if (!proposedChanged && currentChanged) {
    return currentItem;
  }

  if (areResourcesItemsEqualOrMissing_(proposedItem, currentItem)) {
    return proposedItem || currentItem;
  }

  throw createChangeRequestError_(
      "change-request-conflict",
      "Resources conflict on \"" +
      getResourceConflictLabel_(proposedItem, currentItem, id) +
      "\". Submit a fresh request so you do not overwrite newer edits.",
  );
}

function areResourcesItemsEqualOrMissing_(leftItem, rightItem) {
  if (!leftItem && !rightItem) {
    return true;
  }

  if (!leftItem || !rightItem) {
    return false;
  }

  return areResourcesComparisonItemsEqual_(leftItem, rightItem);
}

function areResourcesComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.type || "") ===
      String(proposedItem && proposedItem.type || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getResourceConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this resource",
  ) || "this resource";
}

function buildResourcesChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "resource", "resources"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "resource", "resources"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "resource", "resources"),
    );
  }

  if (!parts.length) {
    return "Resources: no changes detected";
  }

  return "Resources: " + parts.join(", ");
}

function summarizeResourcesSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeResourcesComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeResourcesChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapResourcesComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areResourcesComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createResourcesComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeResourcesComparisonItems_(items)))
      .digest("hex");
}

async function getCurrentRoomRulesBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_ROOM_RULES_COLLECTION_PATH,
    normalizeItems: normalizeRoomRulesComparisonItems_,
  });
}

function normalizeRoomRulesComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeRoomRuleComparisonItem_(item, index))
      .sort(sortRoomRulesComparisonItems_);
}

function normalizeRoomRulesChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeRoomRulesChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeRoomRulesComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function normalizeRoomRuleComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");

  return {
    id: normalizeRoomRulePublishDocId_(source.id, index),
    match_type: normalizeRoomRuleMatchType_(source.match_type),
    match_text: trimFirestoreStringValue_(source.match_text),
    display_location: trimFirestoreStringValue_(source.display_location),
    behavior: normalizeRoomRuleBehavior_(source.behavior),
    priority: normalizeSortValue_(source.priority, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
  };
}

function sortRoomRulesComparisonItems_(a, b) {
  const sortDelta =
    Number(a && a.priority || 999) - Number(b && b.priority || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeRoomRulesChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areRoomRulesComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function computeRoomRulesChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapRoomRulesComparisonItemsById_(baselineItems);
  const proposedById = mapRoomRulesComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areRoomRulesComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortRoomRulesComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function applyRoomRulesChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapRoomRulesComparisonItemsById_(baselineItems);
  const currentById = mapRoomRulesComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeRoomRulesChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Room Rules conflict on \"" +
            getRoomRuleConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areRoomRulesComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Room Rules conflict on \"" +
          getRoomRuleConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areRoomRulesComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Room Rules conflict on \"" +
            getRoomRuleConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Room Rules conflict on \"" +
          getRoomRuleConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areRoomRulesComparisonItemsEqual_(baselineItem, currentItem) &&
      !areRoomRulesComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Room Rules conflict on \"" +
          getRoomRuleConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortRoomRulesComparisonItems_);
}

function mapRoomRulesComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function areRoomRulesComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.match_type || "contains") ===
    String(proposedItem && proposedItem.match_type || "contains") &&
    String(currentItem && currentItem.match_text || "") ===
      String(proposedItem && proposedItem.match_text || "") &&
    String(currentItem && currentItem.display_location || "") ===
      String(proposedItem && proposedItem.display_location || "") &&
    String(currentItem && currentItem.behavior || "replace") ===
      String(proposedItem && proposedItem.behavior || "replace") &&
    Number(currentItem && currentItem.priority || 50) ===
      Number(proposedItem && proposedItem.priority || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getRoomRuleConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.match_text ||
      currentItem && currentItem.match_text ||
      fallbackId ||
      "this room rule",
  ) || "this room rule";
}

function buildRoomRulesChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "rule", "rules"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "rule", "rules"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "rule", "rules"),
    );
  }

  if (!parts.length) {
    return "Room Rules: no changes detected";
  }

  return "Room Rules: " + parts.join(", ");
}

function summarizeRoomRulesSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeRoomRulesComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeRoomRulesChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapRoomRulesComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areRoomRulesComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createRoomRulesComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeRoomRulesComparisonItems_(items)))
      .digest("hex");
}

async function resolveQuickLinksApprovalPayload_(requestData) {
  const rawBaselineItems = requestData && requestData.quickLinksBaselineItems;
  const baselineHash = String(
      requestData && requestData.quickLinksBaselineHash || "",
  ).trim();
  const hasBaselineItems = Array.isArray(rawBaselineItems);
  const baselineItems = normalizeQuickLinksComparisonItems_(rawBaselineItems);

  if (!baselineHash || !hasBaselineItems) {
    throw createChangeRequestError_(
        "change-request-conflict",
        "This Quick Links request is missing the merge-safe approval metadata. Please reload Quick Links and submit a fresh request so nothing gets overwritten.",
    );
  }

  const proposedItems = normalizeQuickLinksComparisonItems_(
      requestData &&
      requestData.payload &&
      requestData.payload.items,
  );
  const changeSet = normalizeQuickLinksChangeSet_(
      requestData && requestData.quickLinksChangeSet,
      baselineItems,
      proposedItems,
  );
  const currentItems = await getCurrentQuickLinksBaselineItems_();
  const mergedItems = applyQuickLinksChangeSet_(
      baselineItems,
      changeSet,
      currentItems,
  );

  return {
    items: mergedItems,
  };
}

async function getCurrentQuickLinksBaselineItems_() {
  return getCurrentListBaselineItems_({
    collectionPath: CENTRAL_QUICK_LINKS_COLLECTION_PATH,
    normalizeItems: normalizeQuickLinksComparisonItems_,
  });
}

function normalizeQuickLinksComparisonItems_(items) {
  return (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeQuickLinkComparisonItem_(item, index))
      .sort(sortQuickLinksComparisonItems_);
}

function normalizeQuickLinkComparisonItem_(item, index) {
  const source = item || {};
  const hasActiveValue = Object.prototype.hasOwnProperty.call(source, "active");

  return {
    id: normalizeQuickLinkPublishDocId_(source.id, index),
    title: trimFirestoreStringValue_(source.title),
    url: trimFirestoreStringValue_(source.url),
    sort: normalizeSortValue_(source.sort, 50),
    active: hasActiveValue ? isTruthyValue_(source.active) : true,
    sunday_only: isTruthyValue_(source.sunday_only),
  };
}

function sortQuickLinksComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function summarizeQuickLinksChangeSet_(currentItems, proposedItems) {
  const currentById = new Map();
  const proposedById = new Map();
  let added = 0;
  let updated = 0;
  let removed = 0;
  let unchanged = 0;

  currentItems.forEach((item) => {
    currentById.set(item.id, item);
  });
  proposedItems.forEach((item) => {
    proposedById.set(item.id, item);
  });

  proposedById.forEach((item, id) => {
    if (!currentById.has(id)) {
      added += 1;
      return;
    }

    if (areQuickLinksComparisonItemsEqual_(currentById.get(id), item)) {
      unchanged += 1;
      return;
    }

    updated += 1;
  });

  currentById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: unchanged,
    currentItemCount: currentItems.length,
    proposedItemCount: proposedItems.length,
  };
}

function normalizeQuickLinksChangeSet_(changeSet, baselineItems, proposedItems) {
  const source = changeSet && typeof changeSet === "object" ?
    changeSet :
    computeQuickLinksChangeSet_(
        baselineItems || [],
        proposedItems || [],
    );

  return {
    upsertItems: normalizeQuickLinksComparisonItems_(
        source && source.upsertItems,
    ),
    removeIds: (Array.isArray(source && source.removeIds) ?
      source.removeIds :
      [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort(),
  };
}

function computeQuickLinksChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapQuickLinksComparisonItemsById_(baselineItems);
  const proposedById = mapQuickLinksComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areQuickLinksComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortQuickLinksComparisonItems_),
    removeIds: removeIds.sort(),
  };
}

function applyQuickLinksChangeSet_(baselineItems, changeSet, currentItems) {
  const baselineById = mapQuickLinksComparisonItemsById_(baselineItems);
  const currentById = mapQuickLinksComparisonItemsById_(currentItems);
  const mergedById = new Map(currentById);
  const normalizedChangeSet = normalizeQuickLinksChangeSet_(
      changeSet,
      baselineItems,
      [],
  );

  normalizedChangeSet.removeIds.forEach((id) => {
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Quick Links conflict on \"" +
            getQuickLinkConflictLabel_(null, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }
      return;
    }

    if (!currentItem) {
      mergedById.delete(id);
      return;
    }

    if (!areQuickLinksComparisonItemsEqual_(baselineItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Quick Links conflict on \"" +
          getQuickLinkConflictLabel_(baselineItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.delete(id);
  });

  normalizedChangeSet.upsertItems.forEach((proposedItem) => {
    const id = String(proposedItem && proposedItem.id || "").trim();
    const baselineItem = baselineById.get(id) || null;
    const currentItem = currentById.get(id) || null;

    if (!baselineItem) {
      if (currentItem &&
        !areQuickLinksComparisonItemsEqual_(proposedItem, currentItem)) {
        throw createChangeRequestError_(
            "change-request-conflict",
            "Quick Links conflict on \"" +
            getQuickLinkConflictLabel_(proposedItem, currentItem, id) +
            "\". Submit a fresh request so you do not overwrite newer edits.",
        );
      }

      mergedById.set(id, proposedItem);
      return;
    }

    if (!currentItem) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Quick Links conflict on \"" +
          getQuickLinkConflictLabel_(proposedItem, baselineItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    if (!areQuickLinksComparisonItemsEqual_(baselineItem, currentItem) &&
      !areQuickLinksComparisonItemsEqual_(proposedItem, currentItem)) {
      throw createChangeRequestError_(
          "change-request-conflict",
          "Quick Links conflict on \"" +
          getQuickLinkConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    mergedById.set(id, proposedItem);
  });

  return Array.from(mergedById.values()).sort(sortQuickLinksComparisonItems_);
}

function mergeQuickLinksChangeSet_(baselineItems, proposedItems, currentItems) {
  const baselineById = mapQuickLinksComparisonItemsById_(baselineItems);
  const proposedById = mapQuickLinksComparisonItemsById_(proposedItems);
  const currentById = mapQuickLinksComparisonItemsById_(currentItems);
  const allIds = new Set([
    ...baselineById.keys(),
    ...proposedById.keys(),
    ...currentById.keys(),
  ]);
  const mergedItems = [];

  for (const id of allIds) {
    const baselineItem = baselineById.get(id) || null;
    const proposedItem = proposedById.get(id) || null;
    const currentItem = currentById.get(id) || null;
    const mergedItem = mergeQuickLinksItemChange_(
        id,
        baselineItem,
        proposedItem,
        currentItem,
    );

    if (mergedItem) {
      mergedItems.push(mergedItem);
    }
  }

  return mergedItems.sort(sortQuickLinksComparisonItems_);
}

function mapQuickLinksComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function mergeQuickLinksItemChange_(id, baselineItem, proposedItem, currentItem) {
  if (!baselineItem) {
    if (proposedItem && currentItem) {
      if (areQuickLinksComparisonItemsEqual_(proposedItem, currentItem)) {
        return proposedItem;
      }

      throw createChangeRequestError_(
          "change-request-conflict",
          "Quick Links conflict on \"" +
          getQuickLinkConflictLabel_(proposedItem, currentItem, id) +
          "\". Submit a fresh request so you do not overwrite newer edits.",
      );
    }

    return proposedItem || currentItem || null;
  }

  const proposedChanged = !areQuickLinksItemsEqualOrMissing_(
      baselineItem,
      proposedItem,
  );
  const currentChanged = !areQuickLinksItemsEqualOrMissing_(
      baselineItem,
      currentItem,
  );

  if (!proposedChanged && !currentChanged) {
    return currentItem || baselineItem;
  }

  if (proposedChanged && !currentChanged) {
    return proposedItem;
  }

  if (!proposedChanged && currentChanged) {
    return currentItem;
  }

  if (areQuickLinksItemsEqualOrMissing_(proposedItem, currentItem)) {
    return proposedItem || currentItem;
  }

  throw createChangeRequestError_(
      "change-request-conflict",
      "Quick Links conflict on \"" +
      getQuickLinkConflictLabel_(proposedItem, currentItem, id) +
      "\". Submit a fresh request so you do not overwrite newer edits.",
  );
}

function areQuickLinksItemsEqualOrMissing_(leftItem, rightItem) {
  if (!leftItem && !rightItem) {
    return true;
  }

  if (!leftItem || !rightItem) {
    return false;
  }

  return areQuickLinksComparisonItemsEqual_(leftItem, rightItem);
}

function areQuickLinksComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.url || "") ===
      String(proposedItem && proposedItem.url || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getQuickLinkConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this link",
  ) || "this link";
}

function buildQuickLinksChangeRequestSummary_(breakdown) {
  const summary = breakdown || {};
  const parts = [];

  if (summary.added > 0) {
    parts.push(
        "add " + String(summary.added) + " " +
        getCountLabel_(summary.added, "link", "links"),
    );
  }

  if (summary.updated > 0) {
    parts.push(
        "update " + String(summary.updated) + " " +
        getCountLabel_(summary.updated, "link", "links"),
    );
  }

  if (summary.removed > 0) {
    parts.push(
        "remove " + String(summary.removed) + " " +
        getCountLabel_(summary.removed, "link", "links"),
    );
  }

  if (!parts.length) {
    return "Quick Links: no changes detected";
  }

  return "Quick Links: " + parts.join(", ");
}

function summarizeQuickLinksSubmittedChangeSet_(baselineItems, changeSet) {
  const normalizedBaselineItems = normalizeQuickLinksComparisonItems_(
      baselineItems,
  );
  const normalizedChangeSet = normalizeQuickLinksChangeSet_(
      changeSet,
      normalizedBaselineItems,
      [],
  );
  const baselineById = mapQuickLinksComparisonItemsById_(
      normalizedBaselineItems,
  );
  let added = 0;
  let updated = 0;
  let removed = 0;

  normalizedChangeSet.upsertItems.forEach((item) => {
    const baselineItem = baselineById.get(item.id) || null;

    if (!baselineItem) {
      added += 1;
      return;
    }

    if (!areQuickLinksComparisonItemsEqual_(baselineItem, item)) {
      updated += 1;
    }
  });

  normalizedChangeSet.removeIds.forEach((id) => {
    if (baselineById.has(id)) {
      removed += 1;
    }
  });

  return {
    added: added,
    updated: updated,
    removed: removed,
    unchanged: 0,
    currentItemCount: normalizedBaselineItems.length,
    proposedItemCount:
      normalizedBaselineItems.length + added - removed,
  };
}

function createQuickLinksComparisonHash_(items) {
  return crypto.createHash("sha256")
      .update(JSON.stringify(normalizeQuickLinksComparisonItems_(items)))
      .digest("hex");
}

function getCountLabel_(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

function withPreviewPublishMetadata_(payload, sourceData, publisher) {
  return {
    ...payload,
    createdAt:
      sourceData && sourceData.createdAt ?
        sourceData.createdAt :
        admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedToPreviewAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedToPreviewByUid: String(publisher && publisher.uid || "").trim(),
    publishedToPreviewByEmail: String(
        publisher && publisher.email || "",
    ).trim(),
    publishedToPreviewByName: String(
        publisher && publisher.displayName || "",
    ).trim(),
  };
}

function buildPreviewListOverrideStatePayload_(itemCount, publisher) {
  return {
    overrideActive: true,
    initialized: true,
    itemCount: Number(itemCount || 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedToPreviewAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedToPreviewByUid: String(publisher && publisher.uid || "").trim(),
    publishedToPreviewByEmail: String(
        publisher && publisher.email || "",
    ).trim(),
    publishedToPreviewByName: String(
        publisher && publisher.displayName || "",
    ).trim(),
  };
}

function buildPublishedHubSettingsPayload_(sourceData) {
  return {
    site_title: trimFirestoreStringValue_(sourceData.site_title),
    hero_heading: trimFirestoreStringValue_(sourceData.hero_heading),
    hero_subheading: trimFirestoreStringValue_(sourceData.hero_subheading),
    primary_button_text: trimFirestoreStringValue_(
        sourceData.primary_button_text,
    ),
    primary_button_url: trimFirestoreStringValue_(
        sourceData.primary_button_url,
    ),
    secondary_button_text: trimFirestoreStringValue_(
        sourceData.secondary_button_text,
    ),
    secondary_button_url: trimFirestoreStringValue_(
        sourceData.secondary_button_url,
    ),
    countdown_label: trimFirestoreStringValue_(sourceData.countdown_label),
    countdown_title: trimFirestoreStringValue_(sourceData.countdown_title),
    countdown_datetime: trimFirestoreStringValue_(
        sourceData.countdown_datetime,
    ),
    featured_event_enabled: normalizeOptionalBooleanConfigValue_(
        sourceData.featured_event_enabled,
    ) === true,
    homepage_modules: normalizeModuleConfigPayload_(
        sourceData.homepage_modules,
        HOMEPAGE_MODULE_DEFINITIONS,
    ),
  };
}

function buildPublishedHubSundayPayload_(sourceData) {
  return {
    sunday_eyebrow: trimFirestoreStringValue_(sourceData.sunday_eyebrow),
    sunday_heading: trimFirestoreStringValue_(sourceData.sunday_heading),
    sunday_subheading: trimFirestoreStringValue_(sourceData.sunday_subheading),
    sunday_primary_button_text: trimFirestoreStringValue_(
        sourceData.sunday_primary_button_text,
    ),
    sunday_primary_button_url: trimFirestoreStringValue_(
        sourceData.sunday_primary_button_url,
    ),
    sunday_secondary_button_text: trimFirestoreStringValue_(
        sourceData.sunday_secondary_button_text,
    ),
    sunday_secondary_button_url: trimFirestoreStringValue_(
        sourceData.sunday_secondary_button_url,
    ),
    sunday_status_label: trimFirestoreStringValue_(
        sourceData.sunday_status_label,
    ),
    sunday_speaker_label: trimFirestoreStringValue_(
        sourceData.sunday_speaker_label,
    ),
    sunday_scripture_label: trimFirestoreStringValue_(
        sourceData.sunday_scripture_label,
    ),
    sunday_livestream_title: trimFirestoreStringValue_(
        sourceData.sunday_livestream_title,
    ),
    sunday_scripture_reference: trimFirestoreStringValue_(
        sourceData.sunday_scripture_reference,
    ),
    sunday_scripture_title: trimFirestoreStringValue_(
        sourceData.sunday_scripture_title,
    ),
    sunday_scripture_helper_text: trimFirestoreStringValue_(
        sourceData.sunday_scripture_helper_text,
    ),
    sunday_modules: normalizeModuleConfigPayload_(
        sourceData.sunday_modules,
        SUNDAY_MODE_MODULE_DEFINITIONS,
    ),
  };
}

function buildPublishedSettingsSundayPayload_(sourceData) {
  const liveSettings = buildPublishedSundayModeEnvironmentPayload_(
      sourceData,
      "",
      "Live page",
  );
  const devSettings = buildPublishedSundayModeEnvironmentPayload_(
      sourceData,
      "dev_",
      "Dev preview",
  );

  return {
    ...liveSettings,
    force_sunday_mode: liveSettings.sunday_mode_override === "enabled",
    ...devSettings,
  };
}

/**
 * Normalizes one environment's Sunday control fields for publication.
 *
 * @param {Object} sourceData Submitted Sunday controls.
 * @param {string} fieldPrefix Environment field prefix.
 * @param {string} environmentLabel Human-readable validation label.
 * @return {Object} Normalized environment control fields.
 */
function buildPublishedSundayModeEnvironmentPayload_(
    sourceData,
    fieldPrefix,
    environmentLabel,
) {
  const overrideField = fieldPrefix + "sunday_mode_override";
  const startTimeField = fieldPrefix + "sunday_mode_start_time";
  const endTimeField = fieldPrefix + "sunday_mode_end_time";
  const fallbackOverride = fieldPrefix ? "" : sourceData.force_sunday_mode;
  const sundayModeOverride = normalizeSundayModeOverrideValue_(
      sourceData[overrideField] || fallbackOverride,
  );
  const sundayModeStartTime = normalizeSundayModeTimeInputValue_(
      sourceData[startTimeField],
  ) || DEFAULT_SUNDAY_MODE_START_TIME;
  const sundayModeEndTime = normalizeSundayModeTimeInputValue_(
      sourceData[endTimeField],
  ) || DEFAULT_SUNDAY_MODE_END_TIME;

  if (
    sundayModeTimeValueToMinutes_(sundayModeEndTime) <=
      sundayModeTimeValueToMinutes_(sundayModeStartTime)
  ) {
    throw createPreviewPublishError_(
        "invalid-payload",
        environmentLabel +
          " Sunday Mode end time must be later than the start time.",
    );
  }

  return {
    [overrideField]: sundayModeOverride,
    [startTimeField]: sundayModeStartTime,
    [endTimeField]: sundayModeEndTime,
  };
}

/**
 * Normalizes the connected-service settings published by the admin.
 *
 * @param {Object} sourceData Submitted integration settings.
 * @return {Object} Normalized Firestore payload.
 */
function buildPublishedIntegrationsPayload_(sourceData) {
  return {
    sunday_livestream_url: trimFirestoreStringValue_(
        sourceData.sunday_livestream_url,
    ),
    sunday_livestream_note: trimFirestoreStringValue_(
        sourceData.sunday_livestream_note,
    ),
    sunday_scripture_bible_id: trimFirestoreStringValue_(
        sourceData.sunday_scripture_bible_id,
    ),
    google_web_client_id: trimFirestoreStringValue_(
        sourceData.google_web_client_id || sourceData.googleWebClientId,
    ),
    google_docs_enabled: normalizeOptionalBooleanConfigValue_(
        Object.prototype.hasOwnProperty.call(sourceData, "google_docs_enabled") ?
          sourceData.google_docs_enabled :
          sourceData.googleDocsEnabled,
    ) !== false,
    calendar_integrations_enabled: normalizeOptionalBooleanConfigValue_(
        Object.prototype.hasOwnProperty.call(
            sourceData,
            "calendar_integrations_enabled",
        ) ?
          sourceData.calendar_integrations_enabled :
          sourceData.calendarIntegrationsEnabled,
    ) !== false,
  };
}

function withResolvedSundayModeWindowSettings_(settings) {
  const source = settings && typeof settings === "object" ? settings : {};

  return {
    ...source,
    sunday_mode_start_time: normalizeSundayModeTimeInputValue_(
        source.sunday_mode_start_time,
    ) || DEFAULT_SUNDAY_MODE_START_TIME,
    sunday_mode_end_time: normalizeSundayModeTimeInputValue_(
        source.sunday_mode_end_time,
    ) || DEFAULT_SUNDAY_MODE_END_TIME,
  };
}

function getSundayModeWindowConfig_(sundaySettings) {
  const resolvedSettings = withResolvedSundayModeWindowSettings_(sundaySettings);

  return {
    startTime: resolvedSettings.sunday_mode_start_time,
    endTime: resolvedSettings.sunday_mode_end_time,
    startMinutes: sundayModeTimeValueToMinutes_(
        resolvedSettings.sunday_mode_start_time,
    ),
    endMinutes: sundayModeTimeValueToMinutes_(
        resolvedSettings.sunday_mode_end_time,
    ),
  };
}

function normalizeSundayModeTimeInputValue_(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const match = rawValue.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return "";
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  return formatSundayModeTimeValue_(hour, minute);
}

function sundayModeTimeValueToMinutes_(value) {
  const normalizedValue = normalizeSundayModeTimeInputValue_(value) ||
    DEFAULT_SUNDAY_MODE_START_TIME;
  const parts = normalizedValue.split(":");

  return (Number(parts[0]) * 60) + Number(parts[1]);
}

function formatSundayModeTimeValue_(hour, minute) {
  return String(hour).padStart(2, "0") + ":" +
    String(minute).padStart(2, "0");
}

function buildPublishedRoomRulePayload_(sourceData) {
  return {
    match_type: normalizeRoomRuleMatchType_(sourceData.match_type),
    match_text: trimFirestoreStringValue_(sourceData.match_text),
    display_location: trimFirestoreStringValue_(sourceData.display_location),
    behavior: normalizeRoomRuleBehavior_(sourceData.behavior),
    priority: normalizeSortValue_(sourceData.priority, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function buildPublishedThisSundayPayload_(sourceData) {
  const dateIso = normalizeThisSundayDateValue_(
      sourceData.date_iso || sourceData.date,
  );

  return {
    date: dateIso ?
      formatThisSundayDisplayDate_(dateIso) :
      trimFirestoreStringValue_(sourceData.date),
    date_iso: dateIso,
    series: trimFirestoreStringValue_(sourceData.series),
    sermon_title: trimFirestoreStringValue_(sourceData.sermon_title),
    speaker: trimFirestoreStringValue_(sourceData.speaker),
    scripture: trimFirestoreStringValue_(sourceData.scripture),
    note: trimFirestoreStringValue_(sourceData.note || sourceData.notes),
  };
}

function buildPublishedStatusBannerPayload_(sourceData) {
  return {
    title: trimFirestoreStringValue_(sourceData.title),
    message: trimFirestoreStringValue_(sourceData.message),
    button_text: trimFirestoreStringValue_(sourceData.button_text),
    button_url: trimFirestoreStringValue_(sourceData.button_url),
    active: true,
  };
}

function buildPublishedCampaignPayload_(sourceData) {
  const ongoing = getNormalizedCampaignOngoingValue_(sourceData);

  return {
    title: trimFirestoreStringValue_(sourceData.title),
    description: trimFirestoreStringValue_(sourceData.description),
    button_text: trimFirestoreStringValue_(sourceData.button_text),
    button_url: trimFirestoreStringValue_(sourceData.button_url),
    ongoing: ongoing,
    start_date: ongoing ? "" : normalizeCampaignDateValue_(sourceData.start_date),
    end_date: ongoing ? "" : normalizeCampaignDateValue_(sourceData.end_date),
    sort: normalizeSortValue_(sourceData.sort, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function buildPublishedNextStepPayload_(sourceData) {
  return {
    title: trimFirestoreStringValue_(sourceData.title),
    description: trimFirestoreStringValue_(sourceData.description),
    button_text: trimFirestoreStringValue_(sourceData.button_text),
    button_url: trimFirestoreStringValue_(sourceData.button_url),
    sort: normalizeSortValue_(sourceData.sort, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function normalizeBulletinModePayload_(sourceData) {
  const source = sourceData && typeof sourceData === "object" ?
    sourceData :
    {};
  const givingSource = source.giving && typeof source.giving === "object" ?
    source.giving :
    {};
  const featuredSource = source.featuredEvent &&
    typeof source.featuredEvent === "object" ?
    source.featuredEvent :
    {};
  const rawEvents = Array.isArray(source.events) ? source.events : [];
  const campaignIds = Array.isArray(source.campaignIds) ?
    source.campaignIds :
    [];

  return {
    serviceDate: normalizeThisSundayDateValue_(source.serviceDate),
    giving: {
      monthlyBudget: normalizeBulletinDollarValue_(
          givingSource.monthlyBudget,
      ),
      monthToDateGiving: normalizeBulletinDollarValue_(
          givingSource.monthToDateGiving,
      ),
      annualBudget: normalizeBulletinDollarValue_(
          givingSource.annualBudget,
      ),
      yearToDateGiving: normalizeBulletinDollarValue_(
          givingSource.yearToDateGiving,
      ),
    },
    featuredEvent: {
      id: normalizeBulletinModeText_(featuredSource.id, 160),
      title: normalizeBulletinModeText_(featuredSource.title, 180),
      description: normalizeBulletinModeText_(
          featuredSource.description,
          1200,
      ),
      includeDescription: featuredSource.includeDescription !== false,
    },
    events: rawEvents.slice(0, 40).map((eventItem) => {
      const item = eventItem && typeof eventItem === "object" ?
        eventItem :
        {};
      return {
        id: normalizeBulletinModeText_(item.id, 160),
        title: normalizeBulletinModeText_(item.title, 180),
        description: normalizeBulletinModeText_(item.description, 1200),
        included: item.included !== false,
        includeDescription: item.includeDescription !== false,
      };
    }).filter((item) => item.id),
    campaignIds: campaignIds.slice(0, 12)
        .map((id) => normalizeBulletinModeText_(id, 160))
        .filter(Boolean),
    serveNeedId: normalizeBulletinModeText_(source.serveNeedId, 160),
  };
}

function normalizeBulletinModeText_(value, maxLength) {
  return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
}

function normalizeBulletinDollarValue_(value) {
  const parsed = Number(String(value == null ? "" : value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(Math.round(parsed), 1000000000);
}

function buildPublishedServeNeedPayload_(sourceData) {
  return {
    need: trimFirestoreStringValue_(sourceData.need),
    ministry: trimFirestoreStringValue_(sourceData.ministry),
    priority: trimFirestoreStringValue_(sourceData.priority || "normal")
        .toLowerCase(),
    description: trimFirestoreStringValue_(sourceData.description),
    button_text: trimFirestoreStringValue_(sourceData.button_text),
    contact_email: trimFirestoreStringValue_(sourceData.contact_email)
        .toLowerCase(),
    sort: normalizeSortValue_(sourceData.sort, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function buildPublishedResourcePayload_(sourceData) {
  return {
    title: trimFirestoreStringValue_(sourceData.title),
    type: trimFirestoreStringValue_(sourceData.type),
    description: trimFirestoreStringValue_(sourceData.description),
    button_text: trimFirestoreStringValue_(sourceData.button_text),
    button_url: trimFirestoreStringValue_(sourceData.button_url),
    sort: normalizeSortValue_(sourceData.sort, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function buildPublishedQuickLinkPayload_(sourceData) {
  return {
    title: trimFirestoreStringValue_(sourceData.title),
    url: trimFirestoreStringValue_(sourceData.url),
    sort: normalizeSortValue_(sourceData.sort, 50),
    active: isTruthyValue_(sourceData.active),
  };
}

function normalizeRoomRuleMatchType_(value) {
  const normalized = trimFirestoreStringValue_(value).toLowerCase();

  if (normalized === "exact" ||
    normalized === "contains" ||
    normalized === "starts_with" ||
    normalized === "ends_with") {
    return normalized;
  }

  return "contains";
}

function normalizeRoomRuleBehavior_(value) {
  const normalized = trimFirestoreStringValue_(value).toLowerCase();

  if (normalized === "replace" ||
    normalized === "ignore" ||
    normalized === "ignore_if_multiple") {
    return normalized;
  }

  return "replace";
}

function normalizeThisSundayDateValue_(value) {
  const text = trimFirestoreStringValue_(value);
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

function formatThisSundayDisplayDate_(value) {
  const normalizedValue = normalizeThisSundayDateValue_(value);

  if (!normalizedValue) {
    return trimFirestoreStringValue_(value);
  }

  const parts = normalizedValue.split("-").map((part) => Number(part));
  const parsedDate = new Date(Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2],
      12,
      0,
      0,
  ));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function trimFirestoreStringValue_(value) {
  return String(value || "").trim();
}

function normalizeOptionalBooleanConfigValue_(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = trimFirestoreStringValue_(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }

  return null;
}

function getOptionalBooleanConfigValue_(source, ...keys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    return normalizeOptionalBooleanConfigValue_(source[key]);
  }

  return null;
}

function trimEnvString_(value) {
  return String(value || "").trim();
}

function getFirestoreTimestampMillis_(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function serializeAdminTimestampForJson_(value) {
  const timestamp = getFirestoreTimestampMillis_(value);
  return timestamp ? new Date(timestamp).toISOString() : "";
}

function createCentralOpaqueToken_() {
  return crypto.randomBytes(24).toString("hex");
}

function hashCentralOpaqueToken_(value) {
  return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
}

function looksLikeEmailAddress_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      trimFirestoreStringValue_(value).toLowerCase(),
  );
}

function hasQuickLinksDraftBeenInitialized_(draftSnapshot, draftMetaSnapshot) {
  if (draftSnapshot && !draftSnapshot.empty) {
    return true;
  }

  if (!draftMetaSnapshot || !draftMetaSnapshot.exists) {
    return false;
  }

  return isTruthyValue_(draftMetaSnapshot.get("initialized"));
}

async function writePreviewPublishAuditLog_(
    publisher,
    section,
    operation,
    publishResult,
) {
  try {
    await firestore.collection(CENTRAL_ADMIN_AUDIT_LOG_COLLECTION_PATH).add({
      action: "publishPreviewContent",
      target: "preview",
      section: String(section || "").trim(),
      operation: String(operation || "publish").trim(),
      itemCount: Number(publishResult && publishResult.itemCount || 0),
      clearedToFallback: publishResult &&
        publishResult.clearedToFallback === true,
      message: String(publishResult && publishResult.message || "").trim(),
      actorUid: String(publisher && publisher.uid || "").trim(),
      actorEmail: String(publisher && publisher.email || "").trim(),
      actorDisplayName: String(
          publisher && publisher.displayName || "",
      ).trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Preview publish audit log failed.", error);
  }
}

async function writeBulletinModeAuditLog_(actor, eventCount) {
  try {
    await firestore.collection(CENTRAL_ADMIN_AUDIT_LOG_COLLECTION_PATH).add({
      action: "saveBulletinMode",
      target: "admin",
      section: "bulletin",
      operation: "save",
      itemCount: Number(eventCount || 0),
      message: "Bulletin Mode settings saved.",
      actorUid: String(actor && actor.uid || "").trim(),
      actorEmail: String(actor && actor.email || "").trim(),
      actorDisplayName: String(actor && actor.displayName || "").trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Bulletin Mode audit log failed.", error);
  }
}

async function writeChangeRequestAuditLog_(entry) {
  try {
    await firestore.collection(CENTRAL_ADMIN_AUDIT_LOG_COLLECTION_PATH).add({
      action: String(entry && entry.action || "").trim(),
      target: "preview",
      section: String(entry && entry.section || "").trim(),
      operation: String(entry && entry.operation || "publish").trim(),
      requestId: String(entry && entry.requestId || "").trim(),
      summary: String(entry && entry.summary || "").trim(),
      status: String(entry && entry.status || "").trim(),
      actorUid: String(entry && entry.actor && entry.actor.uid || "").trim(),
      actorEmail: String(entry && entry.actor && entry.actor.email || "").trim(),
      actorDisplayName: String(
          entry && entry.actor && entry.actor.displayName || "",
      ).trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Change-request audit log failed.", error);
  }
}

async function cleanupReviewedChangeRequests_() {
  try {
    const statuses = ["approved", "rejected"];

    for (const status of statuses) {
      const snapshot = await firestore
          .collection(CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH)
          .where("status", "==", status)
          .limit(CHANGE_REQUEST_CLEANUP_LIMIT_PER_STATUS)
          .get();

      if (snapshot.empty) {
        continue;
      }

      const batch = firestore.batch();
      snapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("Reviewed change-request cleanup failed.", error);
  }
}

async function createFirstAdminUser_(decodedToken) {
  const userDocPath = getCentralAdminUserDocPath_(decodedToken.uid);
  const userRef = firestore.doc(userDocPath);
  const adminRootRef = firestore.doc(CENTRAL_ADMIN_ROOT_DOC_PATH);
  const usersQuery = firestore.collection(CENTRAL_ADMIN_USERS_COLLECTION_PATH).limit(1);

  return firestore.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (userSnapshot.exists) {
      return {
        status: "exists",
      };
    }

    const rootSnapshot = await transaction.get(adminRootRef);
    const existingUsersSnapshot = await transaction.get(usersQuery);

    if (
      (rootSnapshot.exists && rootSnapshot.get("firstAdminUid")) ||
      !existingUsersSnapshot.empty
    ) {
      const error = new Error(
          "Automatic bootstrap is closed because an admin user already exists.",
      );
      error.code = "bootstrap-closed";
      throw error;
    }

    transaction.set(userRef, buildFirstAdminUserDoc_(decodedToken));
    transaction.set(
        adminRootRef,
        {
          firstAdminUid: decodedToken.uid,
          firstAdminEmail: normalizeAdminEmail_(decodedToken.email),
          firstAdminDisplayName: String(decodedToken.name || "").trim(),
          firstAdminBootstrappedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    return {
      status: "created",
    };
  });
}

function buildFirstAdminUserDoc_(decodedToken) {
  return {
    uid: String(decodedToken.uid || "").trim(),
    email: normalizeAdminEmail_(decodedToken.email),
    displayName: String(decodedToken.name || "").trim(),
    photoUrl: String(decodedToken.picture || "").trim(),
    active: true,
    roleIds: [],
    pageAccess: buildFirstAdminPageAccess_(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildFirstAdminPageAccess_() {
  return {
    hub: "admin",
    bulletin: "admin",
    settings: "admin",
    integrations: "admin",
    wayfinder: "admin",
    sundaySettings: "admin",
    thisSunday: "admin",
    whatsNew: "admin",
    statusBanner: "admin",
    today: "admin",
    events: "admin",
    setlist: "admin",
    campaigns: "admin",
    nextSteps: "admin",
    serveNeeds: "admin",
    resources: "admin",
    quickLinks: "admin",
    roomRules: "admin",
    users: "admin",
    roles: "admin",
    changeRequests: "admin",
  };
}

function getCentralAdminUserDocPath_(uid) {
  return CENTRAL_ADMIN_USERS_COLLECTION_PATH + "/" + String(uid || "").trim();
}

function getCentralAdminInviteDocPath_(inviteId) {
  return CENTRAL_ADMIN_INVITES_COLLECTION_PATH + "/" +
    String(inviteId || "").trim();
}

function normalizeAdminEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function isAllowedCentralAdminEmail_(email) {
  if (!email) return false;

  if (CENTRAL_ALLOWED_ADMIN_EMAILS.includes(email)) {
    return true;
  }

  return CENTRAL_ALLOWED_ADMIN_EMAIL_DOMAINS.some((domain) => {
    return email.endsWith("@" + domain);
  });
}

function getFirstAdminBootstrapErrorMessage_(error) {
  if (error && error.code === "bootstrap-closed") {
    return [
      "Automatic bootstrap is closed because an admin user already exists.",
      "If you still need access, add your Firestore user document manually.",
    ].join(" ");
  }

  return error && error.message ?
    error.message :
    "Unable to create the first admin user document.";
}
