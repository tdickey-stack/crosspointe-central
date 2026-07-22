(function() {
  var CENTRAL_APP_ROOT_DOC_PATH = "centralApp/root";
  var CENTRAL_APP_PUBLIC_COLLECTION_PATH = CENTRAL_APP_ROOT_DOC_PATH + "/public";
  var CENTRAL_APP_DRAFT_ROOT_DOC_PATH = "centralAppDraft/root";
  var CENTRAL_APP_DRAFT_PUBLIC_COLLECTION_PATH =
    CENTRAL_APP_DRAFT_ROOT_DOC_PATH + "/public";
  var CENTRAL_ADMIN_ROOT_DOC_PATH = "centralAdmin/root";
  var CENTRAL_ADMIN_PUBLIC_COLLECTION_PATH =
    CENTRAL_ADMIN_ROOT_DOC_PATH + "/public";
  var CENTRAL_ADMIN_USERS_COLLECTION_PATH = CENTRAL_ADMIN_ROOT_DOC_PATH + "/users";
  var CENTRAL_ADMIN_ROLES_COLLECTION_PATH = CENTRAL_ADMIN_ROOT_DOC_PATH + "/roles";
  var CENTRAL_ADMIN_PAGES_COLLECTION_PATH = CENTRAL_ADMIN_ROOT_DOC_PATH + "/pages";
  var CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH =
    CENTRAL_ADMIN_ROOT_DOC_PATH + "/changeRequests";
  var CENTRAL_ADMIN_AUDIT_LOG_COLLECTION_PATH =
    CENTRAL_ADMIN_ROOT_DOC_PATH + "/auditLog";
  var ADMIN_WHATS_NEW_DOC_PATH =
    CENTRAL_ADMIN_PUBLIC_COLLECTION_PATH + "/whatsNew";
  var HOSTED_WHATS_NEW_CONFIG_URL = "/content/whats-new.json";
  var FIRST_ADMIN_BOOTSTRAP_ENDPOINT = "/api/admin/bootstrap-first-user";
  var PUBLISH_PREVIEW_CONTENT_ENDPOINT = "/api/admin/publish-preview-content";
  var BULLETIN_MODE_ENDPOINT = "/api/admin/bulletin-mode";
  var SUBMIT_CHANGE_REQUEST_ENDPOINT = "/api/admin/submit-change-request";
  var REVIEW_CHANGE_REQUEST_ENDPOINT = "/api/admin/review-change-request";
  var LIST_ADMIN_USERS_ENDPOINT = "/api/admin/list-users";
  var UPSERT_ADMIN_USER_ENDPOINT = "/api/admin/upsert-user";
  var DELETE_ADMIN_USER_ENDPOINT = "/api/admin/delete-user";
  var CLAIM_ADMIN_INVITE_ENDPOINT = "/api/admin/claim-invite";
  var WAYFINDER_PROTOTYPE_QUERY_ENDPOINT =
    "/api/admin/wayfinder/prototype-query";
  var WAYFINDER_GENERATE_ANSWER_ENDPOINT =
    "/api/admin/wayfinder/generate-answer";
  var WAYFINDER_NOTICE_ENDPOINT = "/api/admin/wayfinder/notices";
  var WAYFINDER_KNOWLEDGE_CHANGE_ENDPOINT =
    "/api/admin/wayfinder/knowledge-changes";
  var WAYFINDER_WEBSITE_INDEX_ENDPOINT =
    "/api/admin/wayfinder/website-index";
  var WAYFINDER_FEATURED_EVENT_HEALTH_ENDPOINT =
    "/api/admin/wayfinder/featured-event-health";
  var WAYFINDER_ALPHA_SETTINGS_ENDPOINT =
    "/api/admin/wayfinder/alpha-settings";
  var WAYFINDER_FEEDBACK_ENDPOINT = "/api/admin/wayfinder/feedback";
  var WAYFINDER_EVALUATIONS_ENDPOINT =
    "/api/admin/wayfinder/evaluations";
  var PUBLISHED_CAMPAIGNS_COLLECTION_PATH = "centralContent/campaigns/items";
  var PUBLISHED_CAMPAIGNS_META_DOC_PATH = "centralContent/campaigns/meta/state";
  var PUBLISHED_NEXT_STEPS_COLLECTION_PATH = "centralContent/nextSteps/items";
  var PUBLISHED_NEXT_STEPS_META_DOC_PATH = "centralContent/nextSteps/meta/state";
  var PUBLISHED_SERVE_NEEDS_COLLECTION_PATH = "centralContent/serveNeeds/items";
  var PUBLISHED_SERVE_NEEDS_META_DOC_PATH = "centralContent/serveNeeds/meta/state";
  var PUBLISHED_RESOURCES_COLLECTION_PATH = "centralContent/resources/items";
  var PUBLISHED_RESOURCES_META_DOC_PATH = "centralContent/resources/meta/state";
  var PUBLISHED_QUICK_LINKS_COLLECTION_PATH = "centralContent/quickLinks/items";
  var PUBLISHED_QUICK_LINKS_META_DOC_PATH = "centralContent/quickLinks/meta/state";
  var PUBLISHED_ROOM_RULES_COLLECTION_PATH = "centralContent/roomRules/items";
  var PUBLISHED_ROOM_RULES_META_DOC_PATH = "centralContent/roomRules/meta/state";
  var DRAFT_QUICK_LINKS_COLLECTION_PATH = "centralContentDraft/quickLinks/items";
  var DRAFT_QUICK_LINKS_META_DOC_PATH = "centralContentDraft/quickLinks/meta/state";
  var PUBLISHED_STATUS_BANNER_DOC_PATH = "centralContent/statusBanner/items/live";
  var DRAFT_STATUS_BANNER_DOC_PATH = "centralContentDraft/statusBanner/items/live";
  var PUBLISHED_HUB_SETTINGS_DOC_PATH =
    CENTRAL_APP_PUBLIC_COLLECTION_PATH + "/settings";
  var PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH =
    CENTRAL_APP_PUBLIC_COLLECTION_PATH + "/sundaySettings";
  var PUBLISHED_THIS_SUNDAY_DOC_PATH =
    CENTRAL_APP_PUBLIC_COLLECTION_PATH + "/thisSunday";
  var DRAFT_HUB_SETTINGS_DOC_PATH =
    CENTRAL_APP_DRAFT_PUBLIC_COLLECTION_PATH + "/settings";
  var DRAFT_HUB_SUNDAY_SETTINGS_DOC_PATH =
    CENTRAL_APP_DRAFT_PUBLIC_COLLECTION_PATH + "/sundaySettings";
  var ADMIN_PAGES = [
    {
      id: "overview",
      label: "Overview",
      route: "/admin",
      pageAccessKey: "",
      summary: "Firebase status, auth state, and rollout guidance for the dashboard foundation.",
      collectionPath: "",
      status: "Foundation ready",
    },
    {
      id: "quick-links",
      label: "Quick Links",
      route: "/admin/quick-links",
      pageAccessKey: "quickLinks",
      summary: "Homepage shortcuts, Sunday quick actions, and destination URLs.",
      collectionPath: DRAFT_QUICK_LINKS_COLLECTION_PATH,
      status: "Preview workflow",
    },
    {
      id: "status-banner",
      label: "Status Banner",
      route: "/admin/status-banner",
      pageAccessKey: "statusBanner",
      summary: "One live announcement banner for urgent updates and temporary calls to action.",
      collectionPath: DRAFT_STATUS_BANNER_DOC_PATH,
      status: "Preview workflow",
    },
    {
      id: "hub",
      label: "Hub",
      route: "/admin/hub",
      pageAccessKey: "hub",
      summary: "Main Central homepage copy plus the Sunday-mode hero and labels that belong on the Hub page.",
      collectionPath: DRAFT_HUB_SETTINGS_DOC_PATH,
      status: "Preview workflow",
    },
    {
      id: "bulletin",
      label: "Bulletin Mode",
      route: "/admin/bulletin",
      pageAccessKey: "bulletin",
      summary: "Build a two-sided, two-up half-letter insert from current Central content.",
      collectionPath: "centralAdmin/root/public/bulletinMode",
      status: "Print workflow",
    },
    {
      id: "sunday",
      label: "Sunday",
      route: "/admin/sunday",
      pageAccessKey: "thisSunday",
      summary: "Sermon information for the Sunday experience, including the date, message details, and notes.",
      collectionPath: PUBLISHED_THIS_SUNDAY_DOC_PATH,
      status: "Preview workflow",
    },
    {
      id: "serve-needs",
      label: "Serve Needs",
      route: "/admin/serve-needs",
      pageAccessKey: "serveNeeds",
      summary: "Volunteer opportunities and ministry needs that invite people to share their interest.",
      collectionPath: PUBLISHED_SERVE_NEEDS_COLLECTION_PATH,
      status: "Preview workflow",
    },
    {
      id: "resources",
      label: "Resources",
      route: "/admin/resources",
      pageAccessKey: "resources",
      summary: "Helpful links, guides, and tools that appear in the Resources section of Central.",
      collectionPath: PUBLISHED_RESOURCES_COLLECTION_PATH,
      status: "Preview workflow",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      route: "/admin/campaigns",
      pageAccessKey: "campaigns",
      summary: "Church-wide campaigns and featured calls to action shown on the Campaigns section of Central.",
      collectionPath: PUBLISHED_CAMPAIGNS_COLLECTION_PATH,
      status: "Preview workflow",
    },
    {
      id: "next-steps",
      label: "Next Steps",
      route: "/admin/next-steps",
      pageAccessKey: "nextSteps",
      summary: "Connection pathways and action cards that appear in the Next Steps section of Central.",
      collectionPath: PUBLISHED_NEXT_STEPS_COLLECTION_PATH,
      status: "Preview workflow",
    },
    {
      id: "settings",
      label: "Settings",
      route: "/admin/settings",
      pageAccessKey: "settings",
      summary: "Operational Sunday controls, room rules, and admin user access for the dashboard.",
      collectionPath: PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH,
      status: "Preview workflow",
    },
    {
      id: "integrations",
      label: "Integrations",
      route: "/admin/integrations",
      pageAccessKey: "integrations",
      summary: "Connections and service-specific settings for Google, calendars, Resi, YouVersion, and Planning Center.",
      collectionPath: PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH,
      status: "Preview workflow",
    },
    {
      id: "wayfinder",
      label: "Wayfinder Lab",
      route: "/admin/wayfinder",
      pageAccessKey: "wayfinder",
      summary: "Private testing for Wayfinder's approved knowledge retrieval before Gemini is connected.",
      collectionPath: "centralAssistantKnowledgeDraft",
      status: "Private prototype",
    },
    {
      id: "change-requests",
      label: "Change Requests",
      route: "/admin/change-requests",
      pageAccessKey: "changeRequests",
      summary: "Approval queue for proposed edits before they publish.",
      collectionPath: CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH,
      status: "Approval queue",
    },
  ];
  var CENTRAL_ALLOWED_EMAIL_DOMAINS = ["crosspointe.tv"];
  var CENTRAL_ALLOWED_ADMIN_EMAILS = ["tylerdickey17@gmail.com"];
  var CENTRAL_THEME_STORAGE_KEY = "central-theme-override-v2";
  var CENTRAL_THEME_LIGHT = "light";
  var CENTRAL_THEME_DARK = "dark";
  var CENTRAL_THEME_META_LIGHT = "#f4f4f5";
  var CENTRAL_THEME_META_DARK = "#18181b";
  var HUB_HOMEPAGE_MODULE_SORT_SECTION = "hubHomepageModules";
  var HUB_SUNDAY_MODULE_SORT_SECTION = "hubSundayModules";
  var HUB_HOMEPAGE_MODULE_DEFINITIONS = [
    {
      id: "statusBanner",
      label: "Status Banner",
      description: "The alert banner that can appear at the top of the Hub.",
      defaultEnabled: true,
    },
    {
      id: "today",
      label: "Today",
      description: "Today at CrossPointe cards from Planning Center.",
      defaultEnabled: true,
    },
    {
      id: "sunday",
      label: "This Sunday",
      description: "The sermon and worship preview module for the standard Hub.",
      defaultEnabled: true,
    },
    {
      id: "events",
      label: "Events",
      description: "Upcoming events pulled in automatically from Planning Center.",
      defaultEnabled: true,
    },
    {
      id: "registrations",
      label: "Registrations",
      description: "Public signups from Planning Center Registrations.",
      defaultEnabled: true,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      description: "Church-wide campaigns and featured calls to action.",
      defaultEnabled: true,
    },
    {
      id: "nextSteps",
      label: "Next Steps",
      description: "Connection pathways and follow-up actions.",
      defaultEnabled: true,
    },
    {
      id: "serveNeeds",
      label: "Serve Needs",
      description: "Volunteer opportunities with the interest form modal.",
      defaultEnabled: true,
    },
    {
      id: "resources",
      label: "Resources",
      description: "Helpful links, guides, and recommended tools.",
      defaultEnabled: true,
    },
    {
      id: "quickLinks",
      label: "Quick Links",
      description: "Fast-access buttons for common destinations.",
      defaultEnabled: true,
    },
  ];
  var HUB_SUNDAY_MODULE_DEFINITIONS = [
    {
      id: "quickActions",
      label: "Quick Actions",
      description: "The Sunday quick-action buttons at the top of the page.",
      defaultEnabled: true,
    },
    {
      id: "sermonWorship",
      label: "Sermon + Worship",
      description: "The sermon card and worship set for Sunday morning.",
      defaultEnabled: true,
    },
    {
      id: "watchLive",
      label: "Watch Live",
      description: "The livestream section with the embedded video player.",
      defaultEnabled: true,
    },
    {
      id: "scriptureNotes",
      label: "Scripture + Notes",
      description: "The YouVersion reader and sermon notes workspace.",
      defaultEnabled: true,
    },
    {
      id: "today",
      label: "Today",
      description: "Today at CrossPointe cards from Planning Center.",
      defaultEnabled: true,
    },
    {
      id: "events",
      label: "Events",
      description: "Upcoming events pulled in automatically from Planning Center.",
      defaultEnabled: true,
    },
    {
      id: "registrations",
      label: "Registrations",
      description: "Public signups from Planning Center Registrations.",
      defaultEnabled: false,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      description: "Church-wide campaigns and featured calls to action.",
      defaultEnabled: false,
    },
    {
      id: "nextSteps",
      label: "Next Steps",
      description: "Connection pathways and follow-up actions.",
      defaultEnabled: false,
    },
    {
      id: "serveNeeds",
      label: "Serve Needs",
      description: "Volunteer opportunities with the interest form modal.",
      defaultEnabled: false,
    },
    {
      id: "resources",
      label: "Resources",
      description: "Helpful links, guides, and recommended tools.",
      defaultEnabled: false,
    },
  ];
  var FIRST_ADMIN_PAGE_ACCESS = {
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
  var PERMISSION_LABELS = {
    none: "No Access",
    view: "View Only",
    propose: "Propose Changes",
    edit: "Edit & Publish",
    approve: "Approve Changes",
    admin: "Admin",
  };
  var ADMIN_PERMISSION_OPTIONS = [
    "none",
    "view",
    "propose",
    "edit",
    "approve",
    "admin",
  ];
  var SUNDAY_MODE_OVERRIDE_OPTIONS = [
    {
      value: "auto",
      label: "Automatic",
    },
    {
      value: "enabled",
      label: "Force On",
    },
    {
      value: "disabled",
      label: "Force Off",
    },
  ];
  var DEFAULT_SUNDAY_MODE_START_TIME = "07:00";
  var DEFAULT_SUNDAY_MODE_END_TIME = "14:00";
  var ROOM_RULE_MATCH_TYPE_OPTIONS = [
    {
      value: "exact",
      label: "Exact",
    },
    {
      value: "contains",
      label: "Contains",
    },
    {
      value: "starts_with",
      label: "Starts With",
    },
    {
      value: "ends_with",
      label: "Ends With",
    },
  ];
  var ROOM_RULE_BEHAVIOR_OPTIONS = [
    {
      value: "replace",
      label: "Replace",
    },
    {
      value: "ignore",
      label: "Ignore",
    },
    {
      value: "ignore_if_multiple",
      label: "Ignore If Multiple",
    },
  ];
  var adminWhatsNewEscapeHandler = null;
  var adminWhatsNewUnsubscribe = null;
  var hostedWhatsNewConfigPromise = null;
  var adminState = {
    bootMode: window.CENTRAL_BOOT_MODE || "public",
    currentPageId: getCurrentAdminPageId_(),
    sidebarOpen: shouldAdminSidebarStartOpen_(),
    firebaseReady: false,
    firebaseProjectId: "",
    usingEmulators: shouldUseFirebaseEmulators_(),
    authReady: false,
    authLoading: true,
    firestoreReady: false,
    user: null,
    userEmailAllowed: false,
    userDocPath: "",
    userDocLoaded: false,
    userDocExists: false,
    userDocData: null,
    userDocErrorCode: "",
    bootstrapPending: false,
    bootstrapMessage: "",
    inviteClaimPending: false,
    adminWhatsNewLoaded: false,
    adminWhatsNewDocExists: false,
    adminWhatsNewData: null,
    changeRequestsLoaded: false,
    changeRequestsLoading: false,
    changeRequestsActionPending: false,
    changeRequestsItems: [],
    changeRequestsExpandedId: "",
    changeRequestsPendingCount: 0,
    changeRequestsError: "",
    changeRequestsMessage: "",
    quickLinksLoaded: false,
    quickLinksLoading: false,
    quickLinksSaving: false,
    quickLinksPublishing: false,
    quickLinksItems: [],
    quickLinksBaselineItems: [],
    quickLinksPendingChangesById: {},
    quickLinksPublishedItems: [],
    quickLinksDraft: createEmptyQuickLinkDraft_(),
    quickLinksDraftInitialized: false,
    quickLinksUsingPublishedFallback: false,
    quickLinksEditingId: "",
    quickLinksError: "",
    quickLinksMessage: "",
    resourcesLoaded: false,
    resourcesLoading: false,
    resourcesSaving: false,
    resourcesPublishing: false,
    resourcesItems: [],
    resourcesBaselineItems: [],
    resourcesPendingChangesById: {},
    resourcesPublishedItems: [],
    resourcesUsingPublishedFallback: false,
    resourcesDraft: createEmptyResourceDraft_(),
    resourcesEditingId: "",
    resourcesError: "",
    resourcesMessage: "",
    campaignsLoaded: false,
    campaignsLoading: false,
    campaignsSaving: false,
    campaignsPublishing: false,
    campaignsItems: [],
    campaignsBaselineItems: [],
    campaignsPendingChangesById: {},
    campaignsPublishedItems: [],
    campaignsUsingPublishedFallback: false,
    campaignsDraft: createEmptyCampaignDraft_(),
    campaignsEditingId: "",
    campaignsError: "",
    campaignsMessage: "",
    serveNeedsLoaded: false,
    serveNeedsLoading: false,
    serveNeedsSaving: false,
    serveNeedsPublishing: false,
    serveNeedsItems: [],
    serveNeedsBaselineItems: [],
    serveNeedsPendingChangesById: {},
    serveNeedsPublishedItems: [],
    serveNeedsUsingPublishedFallback: false,
    serveNeedsDraft: createEmptyServeNeedDraft_(),
    serveNeedsEditingId: "",
    serveNeedsError: "",
    serveNeedsMessage: "",
    nextStepsLoaded: false,
    nextStepsLoading: false,
    nextStepsSaving: false,
    nextStepsPublishing: false,
    nextStepsItems: [],
    nextStepsBaselineItems: [],
    nextStepsPendingChangesById: {},
    nextStepsPublishedItems: [],
    nextStepsUsingPublishedFallback: false,
    nextStepsDraft: createEmptyNextStepDraft_(),
    nextStepsEditingId: "",
    nextStepsError: "",
    nextStepsMessage: "",
    statusBannerLoaded: false,
    statusBannerLoading: false,
    statusBannerSaving: false,
    statusBannerPublishing: false,
    statusBannerDraftDocExists: false,
    statusBannerPublishedDocExists: false,
    statusBannerCurrent: null,
    statusBannerPublishedCurrent: null,
    statusBannerDraft: createEmptyStatusBannerDraft_(),
    statusBannerError: "",
    statusBannerMessage: "",
    settingsLoaded: false,
    settingsLoading: false,
    settingsLoadError: "",
    settingsSundayPublishing: false,
    settingsSundayCurrent: null,
    settingsSundayDraft: createEmptySettingsSundayDraft_(),
    settingsSundayError: "",
    settingsSundayMessage: "",
    wayfinderAlphaEnabled: false,
    wayfinderAlphaSaving: false,
    wayfinderAlphaError: "",
    wayfinderAlphaMessage: "",
    integrationsPublishing: false,
    integrationsError: "",
    integrationsMessage: "",
    wayfinderQuestion: "",
    wayfinderQuerying: false,
    wayfinderGenerating: false,
    wayfinderError: "",
    wayfinderAnswerError: "",
    wayfinderResult: null,
    wayfinderAnswerResult: null,
    wayfinderNoticeModeActive: false,
    wayfinderNoticeModeExpiresAt: "",
    wayfinderNoticeDraft: null,
    wayfinderNoticeWorking: false,
    wayfinderNoticeError: "",
    wayfinderNoticeMessage: "",
    wayfinderAdminUpdateType: "temporary",
    wayfinderNotices: [],
    wayfinderKnowledgeOverrides: [],
    wayfinderManagerLoading: false,
    wayfinderEditingNoticeId: "",
    wayfinderKnowledgeDraft: null,
    wayfinderKnowledgeWorking: false,
    wayfinderKnowledgeError: "",
    wayfinderKnowledgeMessage: "",
    wayfinderPendingEndNoticeId: "",
    wayfinderPendingDeactivateEntryId: "",
    wayfinderWebsiteIndexLoaded: false,
    wayfinderWebsiteIndexLoading: false,
    wayfinderWebsiteIndexWorking: false,
    wayfinderWebsiteIndexStatus: null,
    wayfinderWebsiteIndexError: "",
    wayfinderWebsiteIndexMessage: "",
    wayfinderFeaturedHealthLoaded: false,
    wayfinderFeaturedHealthLoading: false,
    wayfinderFeaturedHealthReport: null,
    wayfinderFeaturedHealthError: "",
    wayfinderFeedbackLoaded: false,
    wayfinderFeedbackLoading: false,
    wayfinderFeedbackWorking: false,
    wayfinderFeedbackItems: [],
    wayfinderFeedbackError: "",
    wayfinderEvaluationsLoaded: false,
    wayfinderEvaluationsLoading: false,
    wayfinderEvaluationsRunning: false,
    wayfinderEvaluationRuns: [],
    wayfinderEvaluationsLibrarySize: 0,
    wayfinderEvaluationsError: "",
    roomRulesLoaded: false,
    roomRulesLoading: false,
    roomRulesSaving: false,
    roomRulesPublishing: false,
    roomRulesItems: [],
    roomRulesBaselineItems: [],
    roomRulesPendingChangesById: {},
    roomRulesPublishedItems: [],
    roomRulesUsingPublishedFallback: false,
    roomRulesDraft: createEmptyRoomRuleDraft_(),
    roomRulesEditingId: "",
    roomRulesError: "",
    roomRulesMessage: "",
    adminUsersLoaded: false,
    adminUsersLoading: false,
    adminUsersSaving: false,
    adminUsersItems: [],
    adminUsersDraft: createEmptyAdminUserDraft_(),
    adminUsersEditingUid: "",
    adminUsersEditingInviteId: "",
    adminUsersError: "",
    adminUsersMessage: "",
    hubLoaded: false,
    hubLoading: false,
    hubLoadError: "",
    hubSettingsSaving: false,
    hubSettingsPublishing: false,
    hubSettingsDocExists: false,
    hubSettingsCurrent: null,
    hubSettingsDraft: createEmptyHubSettingsDraft_(),
    hubSettingsError: "",
    hubSettingsMessage: "",
    hubSundaySaving: false,
    hubSundayPublishing: false,
    hubSundayDocExists: false,
    hubSundayCurrent: null,
    hubSundayDraft: createEmptyHubSundayDraft_(),
    hubSundayError: "",
    hubSundayMessage: "",
    bulletinLoaded: false,
    bulletinLoading: false,
    bulletinSaving: false,
    bulletinImageUploading: false,
    bulletinCentralData: null,
    bulletinDraft: createEmptyBulletinDraft_(),
    bulletinEditingEventId: "",
    bulletinEventFilter: "week1",
    bulletinError: "",
    bulletinMessage: "",
    sundayLoaded: false,
    sundayLoading: false,
    sundayCurrent: null,
    sundayDraft: createEmptySundayDraft_(),
    sundayError: "",
    sundayMessage: "",
    sundayPublishing: false,
    deleteConfirmOpen: false,
    deleteConfirmTitle: "",
    deleteConfirmMessage: "",
    deleteConfirmConfirmLabel: "",
    deleteConfirmShowSkip: false,
    deleteConfirmSkip: false,
    deleteConfirmAction: null,
    deleteConfirmSuppressedUntil: getDeleteConfirmSuppressedUntil_(),
    collapsedSections: getStoredAdminCollapsedSections_(),
    errorMessage: "",
    infoMessage: "Initializing the admin shell.",
  };
  var CURRENT_CENTRAL_DATA_CACHE_TTL_MS = 30 * 1000;
  var ADMIN_EXPANDABLE_FLOW_DURATION_MS = 1000;
  var DELETE_CONFIRM_SUPPRESSION_MS = 5 * 60 * 1000;
  var DELETE_CONFIRM_STORAGE_KEY = "centralAdminDeleteConfirmSuppressedUntil";
  var CENTRAL_ADMIN_COLLAPSED_SECTIONS_KEY = "centralAdminCollapsedSectionsV3";
  var LEGACY_ADMIN_COLLAPSED_SECTIONS_KEY =
    "centralAdminCollapsedSectionsV2";
  var CENTRAL_ADMIN_WHATS_NEW_SEEN_KEY = "central-admin-whats-new-seen-v1";
  var CENTRAL_ADMIN_REDIRECT_SIGN_IN_KEY = "centralAdminRedirectSignInPending";
  var CENTRAL_ADMIN_INVITE_STORAGE_KEY = "centralAdminPendingInviteV1";
  var DEFAULT_ADMIN_COLLAPSED_SECTION_IDS = [
    "hub-homepage",
    "hub-sunday-mode",
    "settings-sunday-controls",
    "settings-room-rule-form",
    "settings-room-rules-list",
    "settings-admin-users",
    "integrations-google-calendar",
    "integrations-resi",
    "integrations-youversion",
    "integrations-planning-center",
  ];
  var ADMIN_COLLAPSED_SECTION_MIGRATION_IDS = [
    "integrations-google-calendar",
    "integrations-resi",
    "integrations-youversion",
    "integrations-planning-center",
  ];
  var currentCentralDataCacheValue = null;
  var currentCentralDataCacheFetchedAt = 0;
  var currentCentralDataCachePromise = null;
  var adminAuth = null;
  var adminFirestore = null;
  var appEl = null;
  var adminThemeMediaQuery = null;
  var adminThemeOverride = "";
  var adminPrintThemeLocked = false;
  var adminThemeBeforePrint = "";
  var adminSortDragSection = "";
  var adminSortDragDocId = "";
  var adminSortDropDocId = "";
  var adminSortDropPlacement = "";

  if (!isAdminRoute_()) {
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAdminDashboard_);
  } else {
    bootAdminDashboard_();
  }

  function bootAdminDashboard_() {
    appEl = document.getElementById("app");
    if (!appEl) {
      return;
    }

    initializeAdminTheme_();
    document.body.classList.add("central-admin-body");
    appEl.className = "central-admin";
    appEl.addEventListener("click", handleAdminClick_);
    appEl.addEventListener("input", handleAdminInput_);
    appEl.addEventListener("change", handleAdminInput_);
    appEl.addEventListener("dragstart", handleAdminDragStart_);
    appEl.addEventListener("dragover", handleAdminDragOver_);
    appEl.addEventListener("drop", handleAdminDrop_);
    appEl.addEventListener("dragend", handleAdminDragEnd_);
    document.addEventListener("keydown", handleAdminKeyDown_);
    window.addEventListener("popstate", handleAdminPopState_);
    window.addEventListener("beforeprint", beginAdminPrintThemeLock_);
    window.addEventListener("afterprint", endAdminPrintThemeLock_);

    renderAdmin_();
    initializeFirebaseFoundation_();
  }

  function initializeAdminTheme_() {
    adminThemeOverride = readStoredAdminTheme_();
    applyAdminTheme_(getResolvedAdminTheme_());
    bindAdminThemeListener_();
  }

  function bindAdminThemeListener_() {
    if (!window.matchMedia) {
      return;
    }

    adminThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    if (typeof adminThemeMediaQuery.addEventListener === "function") {
      adminThemeMediaQuery.addEventListener("change", handleAdminThemeMediaChange_);
      return;
    }

    if (typeof adminThemeMediaQuery.addListener === "function") {
      adminThemeMediaQuery.addListener(handleAdminThemeMediaChange_);
    }
  }

  function handleAdminThemeMediaChange_(event) {
    if (
      adminThemeOverride ||
      adminPrintThemeLocked ||
      (window.matchMedia && window.matchMedia("print").matches)
    ) {
      return;
    }

    applyAdminTheme_(
        event && event.matches ? CENTRAL_THEME_DARK : CENTRAL_THEME_LIGHT,
    );
  }

  function beginAdminPrintThemeLock_() {
    if (!adminPrintThemeLocked) {
      adminThemeBeforePrint = getResolvedAdminTheme_();
    }

    adminPrintThemeLocked = true;
    applyAdminTheme_(adminThemeBeforePrint);
  }

  function endAdminPrintThemeLock_() {
    var themeToRestore = adminThemeBeforePrint;
    adminPrintThemeLocked = false;
    adminThemeBeforePrint = "";

    if (isValidAdminTheme_(themeToRestore)) {
      applyAdminTheme_(themeToRestore);
    }
  }

  function readStoredAdminTheme_() {
    try {
      var storedTheme = localStorage.getItem(CENTRAL_THEME_STORAGE_KEY) || "";
      return isValidAdminTheme_(storedTheme) ? storedTheme : "";
    } catch (error) {
      return "";
    }
  }

  function writeStoredAdminTheme_(theme) {
    try {
      if (isValidAdminTheme_(theme)) {
        localStorage.setItem(CENTRAL_THEME_STORAGE_KEY, theme);
        return;
      }

      localStorage.removeItem(CENTRAL_THEME_STORAGE_KEY);
    } catch (error) {
    }
  }

  function prefersDarkAdminTheme_() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  function getSystemAdminTheme_() {
    return prefersDarkAdminTheme_() ?
      CENTRAL_THEME_DARK :
      CENTRAL_THEME_LIGHT;
  }

  function isValidAdminTheme_(theme) {
    return theme === CENTRAL_THEME_LIGHT || theme === CENTRAL_THEME_DARK;
  }

  function getResolvedAdminTheme_() {
    if (isValidAdminTheme_(adminThemeOverride)) {
      return adminThemeOverride;
    }

    var rootTheme = document.documentElement.getAttribute("data-theme");
    if (isValidAdminTheme_(rootTheme)) {
      return rootTheme;
    }

    return getSystemAdminTheme_();
  }

  function applyAdminTheme_(theme) {
    var resolvedTheme = isValidAdminTheme_(theme) ?
      theme :
      getResolvedAdminTheme_();

    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;

    if (document.body) {
      document.body.setAttribute("data-theme", resolvedTheme);
      document.body.style.colorScheme = resolvedTheme;
    }

    updateAdminThemeColor_();
    syncAdminThemeToggleUi_(resolvedTheme);
  }

  function updateAdminThemeColor_() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      return;
    }

    meta.setAttribute(
        "content",
        getResolvedAdminTheme_() === CENTRAL_THEME_DARK ?
          CENTRAL_THEME_META_DARK :
          CENTRAL_THEME_META_LIGHT,
    );
  }

  function syncAdminThemeToggleUi_(theme) {
    var resolvedTheme = isValidAdminTheme_(theme) ?
      theme :
      getResolvedAdminTheme_();
    var isDark = resolvedTheme === CENTRAL_THEME_DARK;
    var sourceLabel = adminThemeOverride ? "Manual" : "Device";
    var statusLabel = (isDark ? "Dark" : "Light") + " · " + sourceLabel;

    document.querySelectorAll("[data-admin-theme-toggle]").forEach(
        function(buttonEl) {
          buttonEl.setAttribute("data-theme-state", resolvedTheme);
          buttonEl.setAttribute("aria-pressed", isDark ? "true" : "false");
          buttonEl.setAttribute(
              "aria-label",
              isDark ? "Switch to light mode" : "Switch to dark mode",
          );

          var statusEl = buttonEl.querySelector("[data-admin-theme-status]");
          if (statusEl) {
            statusEl.textContent = statusLabel;
          }
        },
    );
  }

  function toggleAdminTheme_() {
    var nextTheme = getResolvedAdminTheme_() === CENTRAL_THEME_DARK ?
      CENTRAL_THEME_LIGHT :
      CENTRAL_THEME_DARK;
    var systemTheme = getSystemAdminTheme_();

    if (nextTheme === systemTheme) {
      adminThemeOverride = "";
      writeStoredAdminTheme_("");
    } else {
      adminThemeOverride = nextTheme;
      writeStoredAdminTheme_(nextTheme);
    }

    applyAdminTheme_(nextTheme);
  }

  function renderAdminThemeToggle_() {
    var resolvedTheme = getResolvedAdminTheme_();
    var isDark = resolvedTheme === CENTRAL_THEME_DARK;

    return [
      "<button type=\"button\" class=\"theme-toggle central-admin-theme-toggle\" data-admin-action=\"toggle-theme\" data-admin-theme-toggle",
      " data-theme-state=\"", escapeAttr_(resolvedTheme), "\"",
      " aria-pressed=\"", isDark ? "true" : "false", "\"",
      " aria-label=\"", escapeAttr_(
          isDark ? "Switch to light mode" : "Switch to dark mode",
      ), "\">",
      "<span class=\"theme-toggle-copy\">",
      "<strong>Theme</strong>",
      "<small data-admin-theme-status>",
      escapeHtml_((isDark ? "Dark" : "Light") + " · " +
        (adminThemeOverride ? "Manual" : "Device")),
      "</small>",
      "</span>",
      "<span class=\"theme-toggle-switch\" aria-hidden=\"true\">",
      "<span class=\"theme-toggle-thumb\"></span>",
      "</span>",
      "</button>",
    ].join("");
  }

  function initializeFirebaseFoundation_() {
    if (!window.firebase || !window.firebase.apps) {
      adminState.errorMessage = [
        "Firebase did not load from Hosting.",
        "Run this from Firebase Hosting or the Emulator Suite so /__/firebase/init.js is available.",
      ].join(" ");
      adminState.infoMessage = "Admin shell loaded without Firebase.";
      adminState.authLoading = false;
      renderAdmin_();
      return;
    }

    try {
      var firebaseApp = window.firebase.apps.length ?
        window.firebase.app() :
        window.firebase.initializeApp(window.__FIREBASE_DEFAULTS__ || {});

      adminState.firebaseReady = true;
      adminState.firebaseProjectId = firebaseApp.options.projectId || "";
      adminAuth = window.firebase.auth();
      adminFirestore = window.firebase.firestore();

      connectEmulatorsIfNeeded_(adminAuth, adminFirestore);

      adminState.authReady = true;
      adminState.firestoreReady = true;
      adminState.infoMessage = adminState.usingEmulators ?
        "Connected to the local Firebase emulators." :
        "Connected to your hosted Firebase project.";

      handlePendingAdminRedirectResult_();

      adminAuth.onAuthStateChanged(function(user) {
        adminState.user = user;
        adminState.userEmailAllowed = isAllowedAdminEmail_(user && user.email);
        adminState.authLoading = false;
        adminState.errorMessage = "";
        resetAdminUserDocState_();
        resetAdminWhatsNewState_();
        resetChangeRequestsState_();
        resetQuickLinksState_();
        resetResourcesState_();
        resetCampaignsState_();
        resetServeNeedsState_();
        resetNextStepsState_();
        resetStatusBannerState_();
        resetHubState_();
        resetSundayState_();
        resetSettingsState_();

        if (!user) {
          adminState.infoMessage = hasAdminInviteQueryParams_() ?
            "You have a Central Admin invitation waiting. Sign in with the Google account that received the invite to continue." :
            "Sign in with your CrossPointe Google account to continue.";
          renderAdmin_();
          return;
        }

        adminState.userDocPath = getAdminUserDocPath_(user.uid);

        if (!adminState.userEmailAllowed) {
          adminState.errorMessage = [
            "This Google account is signed in, but it is outside the current",
            "admin allowlist for the admin shell.",
          ].join(" ");
          adminState.infoMessage = hasAdminInviteQueryParams_() ?
            "Sign in with the same invited Google account to finish confirming this admin invite." :
            "Sign in with a CrossPointe Workspace account or an allowed tester account to continue.";
          renderAdmin_();
          return;
        }

        loadAdminUserDoc_();
      });
    } catch (error) {
      adminState.errorMessage = error && error.message ?
        error.message :
        "Firebase failed to initialize.";
      adminState.infoMessage = "Admin shell loaded, but Firebase setup needs attention.";
      adminState.authLoading = false;
      renderAdmin_();
    }
  }

  function connectEmulatorsIfNeeded_(auth, firestore) {
    if (!adminState.usingEmulators) {
      return;
    }

    var emulatorHost = getFirebaseEmulatorHost_();
    var authHost = emulatorHost.indexOf(":") !== -1 ?
      "[" + emulatorHost.replace(/^\[|\]$/g, "") + "]" :
      emulatorHost;

    try {
      auth.useEmulator("http://" + authHost + ":9099");
    } catch (error) {
    }

    try {
      firestore.useEmulator(emulatorHost, 8080);
    } catch (error) {
    }
  }

  function getFirebaseEmulatorHost_() {
    var hostname = String(window.location.hostname || "").trim();
    if (!hostname || hostname === "[::1]") {
      return hostname === "[::1]" ? "::1" : "127.0.0.1";
    }
    return hostname;
  }

  function buildAdminGoogleAuthProvider_() {
    var provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });
    return provider;
  }

  function shouldFallbackToAdminRedirectSignIn_(error) {
    var code = String(error && error.code || "").trim();
    return code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/operation-not-supported-in-this-environment";
  }

  function handlePendingAdminRedirectResult_() {
    if (!adminAuth || typeof adminAuth.getRedirectResult !== "function") {
      return;
    }

    if (isAdminRedirectSignInPending_()) {
      adminState.infoMessage = hasAdminInviteQueryParams_() ?
        "Finishing your invited Google sign-in." :
        "Finishing Google sign-in for the admin dashboard.";
      renderAdmin_();
    }

    adminAuth.getRedirectResult()
        .then(function(result) {
          clearAdminRedirectSignInPending_();
          if (result && result.user) {
            adminState.infoMessage = "Google sign-in completed. Loading your admin access.";
            renderAdmin_();
          }
        })
        .catch(function(error) {
          clearAdminRedirectSignInPending_();
          adminState.authLoading = false;
          adminState.errorMessage = error && error.message ?
            error.message :
            "Google sign-in could not be completed.";
          adminState.infoMessage = hasAdminInviteQueryParams_() ?
            "Try the invited Google account again." :
            "Try signing in again, or open the admin dashboard in Chrome.";
          renderAdmin_();
        });
  }

  function startAdminRedirectSignIn_(provider) {
    if (!adminAuth) {
      return Promise.resolve();
    }

    adminState.authLoading = true;
    adminState.errorMessage = "";
    adminState.infoMessage = hasAdminInviteQueryParams_() ?
      "Switching to full-page Google sign-in for your admin invitation." :
      "Switching to full-page Google sign-in.";
    writeAdminRedirectSignInPending_(true);
    renderAdmin_();

    return adminAuth.signInWithRedirect(provider).catch(function(error) {
      clearAdminRedirectSignInPending_();
      adminState.authLoading = false;
      adminState.errorMessage = error && error.message ?
        error.message :
        "Google sign-in could not start.";
      adminState.infoMessage = "Sign-in did not start. Please try again.";
      renderAdmin_();
    });
  }

  function handleAdminClick_(event) {
    var button = event.target.closest("[data-admin-action]");
    if (button) {
      var action = button.getAttribute("data-admin-action");

      if (action === "sign-in") {
        event.preventDefault();
        signInToAdmin_();
        return;
      }

      if (action === "local-test-sign-in") {
        event.preventDefault();
        signInToLocalAdmin_();
        return;
      }

      if (action === "toggle-theme") {
        event.preventDefault();
        toggleAdminTheme_();
        return;
      }

      if (action === "sign-out") {
        event.preventDefault();
        signOutFromAdmin_();
        return;
      }

      if (action === "bootstrap-first-admin") {
        event.preventDefault();
        bootstrapFirstAdminUser_();
        return;
      }

      if (action === "save-bulletin") {
        event.preventDefault();
        saveBulletinMode_();
        return;
      }

      if (action === "remove-bulletin-fallback-image") {
        event.preventDefault();
        adminState.bulletinDraft.fallbackHero.imageUrl = "";
        adminState.bulletinDraft.fallbackHero.imageStoragePath = "";
        adminState.bulletinMessage =
          "Welcome image removed from this draft. Save Bulletin Settings to keep the change.";
        renderAdmin_();
        return;
      }

      if (action === "print-bulletin") {
        event.preventDefault();
        printBulletin_();
        return;
      }

      if (action === "refresh-bulletin") {
        event.preventDefault();
        adminState.bulletinEditingEventId = "";
        adminState.bulletinLoaded = false;
        adminState.bulletinError = "";
        resetCurrentCentralDataCache_();
        loadBulletinMode_();
        return;
      }

      if (action === "edit-bulletin-event") {
        event.preventDefault();
        adminState.bulletinEditingEventId =
          button.getAttribute("data-admin-bulletin-event-id") || "";
        renderAdmin_();
        return;
      }

      if (action === "close-bulletin-event-editor") {
        event.preventDefault();
        adminState.bulletinEditingEventId = "";
        renderAdmin_();
        return;
      }

      if (action === "filter-bulletin-events") {
        event.preventDefault();
        adminState.bulletinEventFilter =
          button.getAttribute("data-admin-bulletin-filter") || "week1";
        renderAdmin_();
        return;
      }

      if (action === "bulk-bulletin-events") {
        event.preventDefault();
        updateBulletinEventBulkInclusion_(
            button.getAttribute("data-admin-bulletin-bulk") || "",
        );
        renderAdmin_();
        return;
      }

      if (action === "toggle-section-collapse") {
        event.preventDefault();
        toggleAdminSectionCollapsed_(
            button.getAttribute("data-admin-section-id") || "",
        );
        return;
      }

      if (action === "save-quick-link") {
        event.preventDefault();
        saveQuickLink_();
        return;
      }

      if (action === "reset-quick-link-form") {
        event.preventDefault();
        resetQuickLinksDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-quick-link") {
        event.preventDefault();
        startEditingQuickLink_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-quick-link") {
        event.preventDefault();
        deleteQuickLink_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "save-resource") {
        event.preventDefault();
        saveResource_();
        return;
      }

      if (action === "reset-resource-form") {
        event.preventDefault();
        resetResourcesDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-resource") {
        event.preventDefault();
        startEditingResource_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-resource") {
        event.preventDefault();
        deleteResource_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "save-campaign") {
        event.preventDefault();
        saveCampaign_();
        return;
      }

      if (action === "reset-campaign-form") {
        event.preventDefault();
        resetCampaignsDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-campaign") {
        event.preventDefault();
        startEditingCampaign_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-campaign") {
        event.preventDefault();
        deleteCampaign_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "save-next-step") {
        event.preventDefault();
        saveNextStep_();
        return;
      }

      if (action === "reset-next-step-form") {
        event.preventDefault();
        resetNextStepsDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-next-step") {
        event.preventDefault();
        startEditingNextStep_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-next-step") {
        event.preventDefault();
        deleteNextStep_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "save-status-banner") {
        event.preventDefault();
        saveStatusBanner_();
        return;
      }

      if (action === "publish-status-banner") {
        event.preventDefault();
        publishStatusBannerToPreview_();
        return;
      }

      if (action === "hide-status-banner") {
        event.preventDefault();
        hideStatusBannerInPreview_();
        return;
      }

      if (action === "reset-status-banner-form") {
        event.preventDefault();
        resetStatusBannerDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "save-hub-settings") {
        event.preventDefault();
        saveHubSettings_();
        return;
      }

      if (action === "publish-hub-settings") {
        event.preventDefault();
        publishHubSettingsToPreview_();
        return;
      }

      if (action === "reset-hub-settings") {
        event.preventDefault();
        resetHubSettingsDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "toggle-hub-module") {
        event.preventDefault();
        toggleHubModuleEnabled_(
            button.getAttribute("data-admin-sort-section") || "",
            button.getAttribute("data-admin-doc-id") || "",
            (button.getAttribute("data-admin-module-enabled") || "") === "true",
        );
        return;
      }

      if (action === "save-hub-sunday") {
        event.preventDefault();
        saveHubSunday_();
        return;
      }

      if (action === "publish-hub-sunday") {
        event.preventDefault();
        publishHubSundayToPreview_();
        return;
      }

      if (action === "reset-hub-sunday") {
        event.preventDefault();
        resetHubSundayDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "publish-settings-sunday") {
        event.preventDefault();
        publishSettingsSundayToPreview_();
        return;
      }

      if (action === "reset-settings-sunday") {
        event.preventDefault();
        resetSettingsSundayDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "toggle-wayfinder-alpha") {
        event.preventDefault();
        saveWayfinderAlphaSetting_(
            (button.getAttribute("data-wayfinder-enabled") || "") !== "true",
        );
        return;
      }

      if (action === "publish-integrations") {
        event.preventDefault();
        publishIntegrationsToPreview_();
        return;
      }

      if (action === "reset-integrations") {
        event.preventDefault();
        resetSettingsSundayDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "run-wayfinder-query") {
        event.preventDefault();
        runWayfinderPrototypeQuery_();
        return;
      }

      if (action === "generate-wayfinder-answer") {
        event.preventDefault();
        generateWayfinderAnswer_();
        return;
      }

      if (action === "publish-wayfinder-notice") {
        event.preventDefault();
        publishWayfinderNotice_();
        return;
      }

      if (action === "cancel-wayfinder-notice") {
        event.preventDefault();
        cancelWayfinderNotice_();
        return;
      }

      if (action === "set-wayfinder-update-type") {
        event.preventDefault();
        setWayfinderUpdateType_(
            button.getAttribute("data-wayfinder-update-type") || "temporary",
        );
        return;
      }

      if (action === "refresh-wayfinder-managers") {
        event.preventDefault();
        loadWayfinderManagers_();
        return;
      }

      if (action === "refresh-wayfinder-website-index") {
        event.preventDefault();
        refreshWayfinderWebsiteIndex_();
        return;
      }

      if (action === "check-wayfinder-website-index") {
        event.preventDefault();
        loadWayfinderWebsiteIndexStatus_(true);
        return;
      }

      if (action === "check-wayfinder-featured-events") {
        event.preventDefault();
        loadWayfinderFeaturedEventHealth_(true);
        return;
      }

      if (action === "refresh-wayfinder-feedback") {
        event.preventDefault();
        loadWayfinderFeedback_(true);
        return;
      }

      if (action === "run-wayfinder-evaluations") {
        event.preventDefault();
        runWayfinderEvaluations_("");
        return;
      }

      if (action === "rerun-wayfinder-evaluations") {
        event.preventDefault();
        runWayfinderEvaluations_(
            button.getAttribute("data-wayfinder-evaluation-run-id") || "",
        );
        return;
      }

      if (action === "refresh-wayfinder-evaluations") {
        event.preventDefault();
        loadWayfinderEvaluations_(true);
        return;
      }

      if (action === "review-wayfinder-feedback" ||
        action === "reopen-wayfinder-feedback") {
        event.preventDefault();
        updateWayfinderFeedbackStatus_(
            button.getAttribute("data-wayfinder-feedback-id") || "",
            action === "review-wayfinder-feedback" ? "review" : "reopen",
        );
        return;
      }

      if (action === "edit-wayfinder-notice") {
        event.preventDefault();
        beginWayfinderNoticeRevision_(
            button.getAttribute("data-wayfinder-notice-id") || "",
        );
        return;
      }

      if (action === "end-wayfinder-notice") {
        event.preventDefault();
        endWayfinderNotice_(
            button.getAttribute("data-wayfinder-notice-id") || "",
        );
        return;
      }

      if (action === "publish-wayfinder-knowledge") {
        event.preventDefault();
        publishWayfinderKnowledgeChange_();
        return;
      }

      if (action === "cancel-wayfinder-knowledge") {
        event.preventDefault();
        cancelWayfinderKnowledgeChange_();
        return;
      }

      if (action === "deactivate-wayfinder-knowledge") {
        event.preventDefault();
        deactivateWayfinderKnowledgeOverride_(
            button.getAttribute("data-wayfinder-entry-id") || "",
        );
        return;
      }

      if (action === "try-wayfinder-question") {
        event.preventDefault();
        runWayfinderPrototypeQuery_(
            button.getAttribute("data-wayfinder-question") || "",
        );
        return;
      }

      if (action === "publish-sunday") {
        event.preventDefault();
        publishSundayToPreview_();
        return;
      }

      if (action === "reset-sunday") {
        event.preventDefault();
        resetSundayDraftFromCurrent_();
        renderAdmin_();
        return;
      }

      if (action === "publish-quick-links") {
        event.preventDefault();
        publishQuickLinksToPreview_();
        return;
      }

      if (action === "publish-resources") {
        event.preventDefault();
        publishResourcesToPreview_();
        return;
      }

      if (action === "publish-campaigns") {
        event.preventDefault();
        publishCampaignsToPreview_();
        return;
      }

      if (action === "save-serve-need") {
        event.preventDefault();
        saveServeNeed_();
        return;
      }

      if (action === "reset-serve-need-form") {
        event.preventDefault();
        resetServeNeedsDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-serve-need") {
        event.preventDefault();
        startEditingServeNeed_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-serve-need") {
        event.preventDefault();
        deleteServeNeed_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "publish-serve-needs") {
        event.preventDefault();
        publishServeNeedsToPreview_();
        return;
      }

      if (action === "publish-next-steps") {
        event.preventDefault();
        publishNextStepsToPreview_();
        return;
      }

      if (action === "save-room-rule") {
        event.preventDefault();
        saveRoomRule_();
        return;
      }

      if (action === "reset-room-rule-form") {
        event.preventDefault();
        resetRoomRulesDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-room-rule") {
        event.preventDefault();
        startEditingRoomRule_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "delete-room-rule") {
        event.preventDefault();
        deleteRoomRule_(button.getAttribute("data-admin-doc-id") || "");
        return;
      }

      if (action === "publish-room-rules") {
        event.preventDefault();
        publishRoomRulesToPreview_();
        return;
      }

      if (action === "save-admin-user") {
        event.preventDefault();
        saveAdminUser_();
        return;
      }

      if (action === "reset-admin-user-form") {
        event.preventDefault();
        resetAdminUsersDraft_();
        renderAdmin_();
        return;
      }

      if (action === "edit-admin-user") {
        event.preventDefault();
        startEditingAdminUser_(
            button.getAttribute("data-admin-doc-id") || "",
            button.getAttribute("data-admin-record-type") || "user",
        );
        return;
      }

      if (action === "delete-admin-user") {
        event.preventDefault();
        deleteAdminUser_(
            button.getAttribute("data-admin-doc-id") || "",
            button.getAttribute("data-admin-record-type") || "user",
        );
        return;
      }

      if (action === "toggle-change-request") {
        event.preventDefault();
        toggleChangeRequestExpanded_(
            button.getAttribute("data-admin-request-id") || "",
        );
        return;
      }

      if (action === "close-change-request") {
        event.preventDefault();
        closeExpandedChangeRequest_();
        return;
      }

      if (action === "approve-change-request") {
        event.preventDefault();
        reviewChangeRequest_(
            button.getAttribute("data-admin-request-id") || "",
            "approve",
        );
        return;
      }

      if (action === "reject-change-request") {
        event.preventDefault();
        reviewChangeRequest_(
            button.getAttribute("data-admin-request-id") || "",
            "reject",
        );
        return;
      }

      if (action === "toggle-sidebar") {
        event.preventDefault();
        setAdminSidebarOpen_(!adminState.sidebarOpen);
        return;
      }

      if (action === "close-sidebar") {
        event.preventDefault();
        setAdminSidebarOpen_(false);
        return;
      }

      if (action === "confirm-delete-confirm") {
        event.preventDefault();
        confirmDeleteConfirm_();
        return;
      }

      if (action === "close-delete-confirm") {
        event.preventDefault();
        closeDeleteConfirm_();
        return;
      }
    }

    var bulletinChoice = event.target.closest("[data-admin-bulletin-choice]");
    if (bulletinChoice) {
      updateBulletinChoice_(bulletinChoice);
      renderAdmin_();
      return;
    }

    var navLink = event.target.closest("[data-admin-nav]");
    if (!navLink) {
      return;
    }

    event.preventDefault();
    var pageId = navLink.getAttribute("data-admin-nav") || "overview";
    navigateToAdminPage_(pageId);
  }

  function handleAdminPopState_() {
    adminState.currentPageId = getCurrentAdminPageId_();
    markAdminPageDataStaleForNavigation_(adminState.currentPageId);
    renderAdmin_();
  }

  function handleAdminKeyDown_(event) {
    var wayfinderInput = event.target && event.target.matches &&
      event.target.matches('[data-admin-field="wayfinder.question"]');
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing &&
      wayfinderInput && adminState.currentPageId === "wayfinder") {
      event.preventDefault();
      generateWayfinderAnswer_();
      return;
    }

    if (event.key !== "Escape" || !adminState.deleteConfirmOpen) {
      return;
    }

    event.preventDefault();
    closeDeleteConfirm_();
  }

  function handleAdminDragStart_(event) {
    var handle = event.target.closest("[data-admin-sort-handle]");
    if (!handle) {
      return;
    }

    var section = String(
        handle.getAttribute("data-admin-sort-section") || "",
    ).trim();
    var docId = String(handle.getAttribute("data-admin-doc-id") || "").trim();

    if (!canReorderSortableSection_(section) || !docId) {
      event.preventDefault();
      return;
    }

    adminSortDragSection = section;
    adminSortDragDocId = docId;
    clearAdminSortDropState_();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", section + ":" + docId);
      } catch (error) {
      }
    }

    var itemEl = getAdminSortableItemEl_(section, docId);
    if (itemEl) {
      itemEl.classList.add("is-dragging");
    }
  }

  function handleAdminDragOver_(event) {
    if (!adminSortDragSection || !adminSortDragDocId) {
      return;
    }

    var target = resolveAdminSortDropTarget_(event);
    if (!target || target.section !== adminSortDragSection) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    setAdminSortDropState_(
        target.section,
        target.docId,
        target.placement,
    );
  }

  function handleAdminDrop_(event) {
    if (!adminSortDragSection || !adminSortDragDocId) {
      return;
    }

    var target = resolveAdminSortDropTarget_(event);
    var draggedSection = adminSortDragSection;
    var draggedDocId = adminSortDragDocId;

    event.preventDefault();

    if (!target || target.section !== draggedSection) {
      clearAdminSortDragState_();
      return;
    }

    clearAdminSortDragState_();
    performSortableSectionReorder_(
      target.section,
      draggedDocId,
      target.docId,
      target.placement,
    );
  }

  function handleAdminDragEnd_() {
    clearAdminSortDragState_();
  }

  function resolveAdminSortDropTarget_(event) {
    var itemEl = event.target.closest("[data-admin-sort-item]");
    if (itemEl) {
      return {
        section: String(
            itemEl.getAttribute("data-admin-sort-section") || "",
        ).trim(),
        docId: String(itemEl.getAttribute("data-admin-doc-id") || "").trim(),
        placement: getAdminSortDropPlacement_(itemEl, event.clientY),
      };
    }

    var listEl = event.target.closest("[data-admin-sort-list]");
    if (!listEl) {
      return null;
    }

    var section = String(
        listEl.getAttribute("data-admin-sort-section") || "",
    ).trim();
    var itemEls = listEl.querySelectorAll("[data-admin-sort-item]");
    if (!itemEls.length) {
      return null;
    }

    var lastItemEl = itemEls[itemEls.length - 1];

    return {
      section: section,
      docId: String(lastItemEl.getAttribute("data-admin-doc-id") || "").trim(),
      placement: "after",
    };
  }

  function getAdminSortDropPlacement_(itemEl, clientY) {
    var rect = itemEl && typeof itemEl.getBoundingClientRect === "function" ?
      itemEl.getBoundingClientRect() :
      null;

    if (!rect) {
      return "after";
    }

    return clientY < (rect.top + (rect.height / 2)) ? "before" : "after";
  }

  function setAdminSortDropState_(section, docId, placement) {
    if (adminSortDropDocId === docId &&
      adminSortDropPlacement === placement &&
      adminSortDragSection === section) {
      return;
    }

    clearAdminSortDropState_();
    adminSortDropDocId = docId;
    adminSortDropPlacement = placement;

    var itemEl = getAdminSortableItemEl_(section, docId);
    if (!itemEl) {
      return;
    }

    itemEl.classList.add(
        placement === "before" ? "is-drop-before" : "is-drop-after",
    );
  }

  function clearAdminSortDropState_() {
    if (!appEl) {
      adminSortDropDocId = "";
      adminSortDropPlacement = "";
      return;
    }

    Array.prototype.forEach.call(
        appEl.querySelectorAll(".is-drop-before, .is-drop-after"),
        function(element) {
          element.classList.remove("is-drop-before", "is-drop-after");
        },
    );

    adminSortDropDocId = "";
    adminSortDropPlacement = "";
  }

  function clearAdminSortDragState_() {
    if (appEl) {
      Array.prototype.forEach.call(
          appEl.querySelectorAll(".is-dragging"),
          function(element) {
            element.classList.remove("is-dragging");
          },
      );
    }

    clearAdminSortDropState_();
    adminSortDragSection = "";
    adminSortDragDocId = "";
  }

  function getAdminSortableItemEl_(section, docId) {
    if (!appEl || !section || !docId) {
      return null;
    }

    var match = null;
    Array.prototype.forEach.call(
        appEl.querySelectorAll("[data-admin-sort-item]"),
        function(element) {
          if (match) {
            return;
          }

          if ((element.getAttribute("data-admin-sort-section") || "") === section &&
            (element.getAttribute("data-admin-doc-id") || "") === docId) {
            match = element;
          }
        },
    );

    return match;
  }

  function getSortableSectionStatePrefix_(section) {
    if (section === "quickLinks" ||
      section === "resources" ||
      section === "campaigns" ||
      section === "serveNeeds" ||
      section === "nextSteps") {
      return section;
    }

    return "";
  }

  function isSortableSection_(section) {
    return !!getSortableSectionStatePrefix_(section) ||
      isHubModuleSortableSection_(section);
  }

  function isSortableSectionBusy_(section) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      return !!(
        moduleConfig &&
        (adminState[moduleConfig.publishingStateKey] ||
          adminState[moduleConfig.loadingStateKey])
      );
    }

    var prefix = getSortableSectionStatePrefix_(section);
    if (!prefix) {
      return false;
    }

    return !!(
      adminState[prefix + "Saving"] ||
      adminState[prefix + "Publishing"]
    );
  }

  function canReorderSortableSection_(section) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      return !!(
        moduleConfig &&
        moduleConfig.canEdit &&
        !isSortableSectionBusy_(section)
      );
    }

    return isSortableSection_(section) &&
      canChangeContentWithPermission_(getPageAccessLevel_(section)) &&
      !isSortableSectionBusy_(section);
  }

  function getSortableSectionItems_(section) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      var draft = moduleConfig ? adminState[moduleConfig.draftKey] : null;
      return normalizeHubModuleItems_(
          draft && draft[moduleConfig.fieldKey],
          getHubModuleDefinitionsForSortSection_(section),
      );
    }

    var prefix = getSortableSectionStatePrefix_(section);
    return prefix ? (adminState[prefix + "Items"] || []) : [];
  }

  function cloneSortableSectionItems_(section) {
    return (Array.isArray(getSortableSectionItems_(section)) ?
      getSortableSectionItems_(section) :
      []).map(function(item) {
      return Object.assign({}, item);
    });
  }

  function setSortableSectionItems_(section, items) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      if (!moduleConfig || !adminState[moduleConfig.draftKey]) {
        return;
      }

      adminState[moduleConfig.draftKey][moduleConfig.fieldKey] =
        normalizeHubModuleItems_(
            items,
            getHubModuleDefinitionsForSortSection_(section),
        );
      return;
    }

    var prefix = getSortableSectionStatePrefix_(section);
    if (!prefix) {
      return;
    }

    adminState[prefix + "Items"] = Array.isArray(items) ? items : [];
  }

  function setSortableSectionSaving_(section, isSaving) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      if (!moduleConfig) {
        return;
      }

      adminState[moduleConfig.publishingStateKey] = !!isSaving;
      return;
    }

    var prefix = getSortableSectionStatePrefix_(section);
    if (!prefix) {
      return;
    }

    adminState[prefix + "Saving"] = !!isSaving;
  }

  function setSortableSectionMessage_(section, message) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      if (!moduleConfig) {
        return;
      }

      adminState[moduleConfig.messageStateKey] = String(message || "").trim();
      return;
    }

    var prefix = getSortableSectionStatePrefix_(section);
    if (!prefix) {
      return;
    }

    adminState[prefix + "Message"] = String(message || "").trim();
  }

  function setSortableSectionError_(section, message) {
    if (isHubModuleSortableSection_(section)) {
      var moduleConfig = getHubModuleSortSectionConfig_(section);
      if (!moduleConfig) {
        return;
      }

      adminState[moduleConfig.errorStateKey] = String(message || "").trim();
      return;
    }

    var prefix = getSortableSectionStatePrefix_(section);
    if (!prefix) {
      return;
    }

    adminState[prefix + "Error"] = String(message || "").trim();
  }

  function getSortableSectionLabel_(section) {
    if (section === HUB_HOMEPAGE_MODULE_SORT_SECTION) {
      return "Homepage modules";
    }

    if (section === HUB_SUNDAY_MODULE_SORT_SECTION) {
      return "Sunday Mode modules";
    }

    if (section === "quickLinks") {
      return "Quick Links";
    }

    if (section === "resources") {
      return "Resources";
    }

    if (section === "campaigns") {
      return "Campaigns";
    }

    if (section === "serveNeeds") {
      return "Serve Needs";
    }

    if (section === "nextSteps") {
      return "Next Steps";
    }

    return "List";
  }

  function normalizeSortableSectionComparableItems_(section, items) {
    if (section === "quickLinks") {
      return normalizeQuickLinksComparableItems_(items);
    }

    if (section === "resources") {
      return normalizeResourcesComparableItems_(items);
    }

    if (section === "campaigns") {
      return normalizeCampaignsComparableItems_(items);
    }

    if (section === "serveNeeds") {
      return normalizeServeNeedsComparableItems_(items);
    }

    if (section === "nextSteps") {
      return normalizeNextStepsComparableItems_(items);
    }

    return Array.isArray(items) ? items.slice() : [];
  }

  function areSortableSectionComparableItemsEqual_(section, leftItem, rightItem) {
    if (section === "quickLinks") {
      return areQuickLinkComparableItemsEqual_(leftItem, rightItem);
    }

    if (section === "resources") {
      return areResourceComparableItemsEqual_(leftItem, rightItem);
    }

    if (section === "campaigns") {
      return areCampaignComparableItemsEqual_(leftItem, rightItem);
    }

    if (section === "serveNeeds") {
      return areServeNeedComparableItemsEqual_(leftItem, rightItem);
    }

    if (section === "nextSteps") {
      return areNextStepComparableItemsEqual_(leftItem, rightItem);
    }

    return areAdminValuesEqual_(leftItem, rightItem);
  }

  function loadSortableSection_(section) {
    if (isHubModuleSortableSection_(section)) {
      loadHub_();
      return;
    }

    if (section === "quickLinks") {
      loadQuickLinks_();
      return;
    }

    if (section === "resources") {
      loadResources_();
      return;
    }

    if (section === "campaigns") {
      loadCampaigns_();
      return;
    }

    if (section === "serveNeeds") {
      loadServeNeeds_();
      return;
    }

    if (section === "nextSteps") {
      loadNextSteps_();
    }
  }

  function getSortableSectionNextSortValue_(items) {
    var maxSort = 0;

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var nextSort = Number(item && item.sort);
      if (Number.isFinite(nextSort) && nextSort > maxSort) {
        maxSort = nextSort;
      }
    });

    return maxSort > 0 ? maxSort + 10 : 10;
  }

  function buildSortableSectionChangeRequestData_(
      section,
      baselineItems,
      proposedItems,
  ) {
    var normalizedBaselineItems = normalizeSortableSectionComparableItems_(
        section,
        baselineItems,
    );
    var normalizedProposedItems = normalizeSortableSectionComparableItems_(
        section,
        proposedItems,
    );
    var baselineById = new Map();
    var proposedById = new Map();
    var changedIds = {};

    normalizedBaselineItems.forEach(function(item) {
      if (item && item.id) {
        baselineById.set(item.id, item);
      }
    });
    normalizedProposedItems.forEach(function(item) {
      if (item && item.id) {
        proposedById.set(item.id, item);
      }
    });

    normalizedProposedItems.forEach(function(item) {
      var baselineItem = baselineById.get(item.id) || null;
      if (!baselineItem ||
        !areSortableSectionComparableItemsEqual_(
            section,
            baselineItem,
            item,
        )) {
        changedIds[item.id] = true;
      }
    });

    normalizedBaselineItems.forEach(function(item) {
      if (!proposedById.has(item.id)) {
        changedIds[item.id] = true;
      }
    });

    return {
      baselineItems: normalizedBaselineItems.filter(function(item) {
        return !!changedIds[item.id] && baselineById.has(item.id);
      }),
      changeSet: {
        upsertItems: normalizedProposedItems.filter(function(item) {
          return !!changedIds[item.id];
        }),
        removeIds: normalizedBaselineItems.filter(function(item) {
          return !!changedIds[item.id] && !proposedById.has(item.id);
        }).map(function(item) {
          return item.id;
        }).sort(),
      },
      payload: {
        items: normalizedProposedItems.filter(function(item) {
          return !!changedIds[item.id];
        }),
      },
    };
  }

  function reorderSortableItems_(items, draggedDocId, targetDocId, placement) {
    var currentItems = Array.isArray(items) ? items.slice() : [];
    var fromIndex = -1;
    var toIndex = -1;

    currentItems.forEach(function(item, index) {
      if (item && item.id === draggedDocId) {
        fromIndex = index;
      }

      if (item && item.id === targetDocId) {
        toIndex = index;
      }
    });

    if (fromIndex === -1 || toIndex === -1) {
      return currentItems;
    }

    if (draggedDocId === targetDocId) {
      return currentItems;
    }

    var movedItems = currentItems.slice();
    var draggedItem = movedItems.splice(fromIndex, 1)[0];
    var adjustedTargetIndex = toIndex;

    if (fromIndex < toIndex) {
      adjustedTargetIndex -= 1;
    }

    var insertIndex = placement === "after" ?
      adjustedTargetIndex + 1 :
      adjustedTargetIndex;

    movedItems.splice(insertIndex, 0, draggedItem);

    return movedItems.map(function(item, index) {
      return Object.assign({}, item, {
        sort: (index + 1) * 10,
      });
    });
  }

  function reorderHubModuleItems_(section, items, draggedDocId, targetDocId, placement) {
    var currentItems = normalizeHubModuleItems_(
        items,
        getHubModuleDefinitionsForSortSection_(section),
    );
    var targetItem = currentItems.find(function(item) {
      return item && item.id === targetDocId;
    });
    var movedItems = reorderSortableItems_(
        currentItems,
        draggedDocId,
        targetDocId,
        placement,
    );

    if (!targetItem) {
      return currentItems;
    }

    return normalizeHubModuleItems_(
        movedItems.map(function(item) {
          if (!item || item.id !== draggedDocId) {
            return item;
          }

          return Object.assign({}, item, {
            enabled: !!targetItem.enabled,
          });
        }),
        getHubModuleDefinitionsForSortSection_(section),
    );
  }

  function applyHubModuleSectionUpdate_(section, previousItems, nextItems) {
    var moduleConfig = getHubModuleSortSectionConfig_(section);
    var actionConfig = moduleConfig ?
      getPrimaryContentActionConfig_(moduleConfig.permission) :
      null;
    var successMessage = actionConfig && actionConfig.mode === "submit" ?
      getSortableSectionLabel_(section) + " submitted for approval." :
      getSortableSectionLabel_(section) + " updated in preview.";
    var errorMessage = actionConfig && actionConfig.mode === "submit" ?
      "Unable to submit the " + getSortableSectionLabel_(section) +
        " for approval." :
      "Unable to update the " + getSortableSectionLabel_(section) +
        " in preview.";

    if (!moduleConfig || !actionConfig) {
      return;
    }

    setSortableSectionItems_(section, nextItems);
    setSortableSectionSaving_(section, true);
    setSortableSectionError_(section, "");
    setSortableSectionMessage_(section, "");
    renderAdmin_();

    runSectionPrimaryAction_({
      section: moduleConfig.section,
      permission: moduleConfig.permission,
      payload: moduleConfig.section === "hubSettings" ?
        buildHubSettingsPayload_() :
        buildHubSundayPayload_(),
      successMessage: successMessage,
    })
        .then(function(result) {
          setSortableSectionSaving_(section, false);
          setSortableSectionMessage_(
              section,
              result && result.message ?
                result.message :
                successMessage,
          );

          if (actionConfig.mode === "publish") {
            if (moduleConfig.section === "hubSettings") {
              loadHub_({
                settings: moduleConfig.section === "hubSettings" ?
                  adminState.hubSettingsMessage :
                  "",
              });
              return;
            }

            loadHub_({
              sunday: moduleConfig.section === "hubSunday" ?
                adminState.hubSundayMessage :
                "",
            });
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          setSortableSectionSaving_(section, false);
          setSortableSectionItems_(section, previousItems);
          setSortableSectionError_(
              section,
              error && error.message ?
                error.message :
                errorMessage,
          );
          renderAdmin_();
        });
  }

  function toggleHubModuleEnabled_(section, moduleId, nextEnabled) {
    var moduleConfig = getHubModuleSortSectionConfig_(section);
    var currentItems = cloneSortableSectionItems_(section);
    var itemIndex = currentItems.findIndex(function(item) {
      return item && item.id === String(moduleId || "").trim();
    });
    var movedItem = null;
    var insertIndex = 0;
    var nextItems = [];

    if (!moduleConfig || itemIndex === -1 || !moduleConfig.canEdit) {
      return;
    }

    movedItem = Object.assign({}, currentItems[itemIndex], {
      enabled: !!nextEnabled,
    });
    currentItems.splice(itemIndex, 1);

    if (nextEnabled) {
      insertIndex = currentItems.filter(function(item) {
        return item && item.enabled !== false;
      }).length;
      currentItems.splice(insertIndex, 0, movedItem);
    } else {
      currentItems.push(movedItem);
    }

    nextItems = normalizeHubModuleItems_(
        currentItems,
        getHubModuleDefinitionsForSortSection_(section),
    );

    applyHubModuleSectionUpdate_(section, cloneSortableSectionItems_(section), nextItems);
  }

  function performSortableSectionReorder_(
      section,
      draggedDocId,
      targetDocId,
      placement,
  ) {
    if (!canReorderSortableSection_(section)) {
      return;
    }

    if (isHubModuleSortableSection_(section)) {
      var previousModuleItems = cloneSortableSectionItems_(section);
      var nextModuleItems = reorderHubModuleItems_(
          section,
          previousModuleItems,
          draggedDocId,
          targetDocId,
          placement,
      );

      if (areAdminValuesEqual_(previousModuleItems, nextModuleItems)) {
        return;
      }

      applyHubModuleSectionUpdate_(
          section,
          previousModuleItems,
          nextModuleItems,
      );
      return;
    }

    var previousItems = cloneSortableSectionItems_(section);
    var nextItems = reorderSortableItems_(
        previousItems,
        draggedDocId,
        targetDocId,
        placement,
    );
    var submitChangeData = buildSortableSectionChangeRequestData_(
        section,
        previousItems,
        nextItems,
    );
    var actionConfig = getPrimaryContentActionConfig_(
        getPageAccessLevel_(section),
    );
    var successMessage = actionConfig.mode === "submit" ?
      getSortableSectionLabel_(section) +
        " reorder submitted for approval." :
      getSortableSectionLabel_(section) +
        " order updated in preview.";
    var errorMessage = actionConfig.mode === "submit" ?
      "Unable to submit the " + getSortableSectionLabel_(section) +
        " reorder for approval." :
      "Unable to update the " + getSortableSectionLabel_(section) +
        " order in preview.";

    if (!submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      return;
    }

    setSortableSectionItems_(section, nextItems);
    setSortableSectionSaving_(section, true);
    setSortableSectionError_(section, "");
    setSortableSectionMessage_(section, "");
    renderAdmin_();

    runSectionPrimaryAction_({
      section: section,
      permission: getPageAccessLevel_(section),
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          setSortableSectionSaving_(section, false);
          setSortableSectionMessage_(
              section,
              result && result.message ?
                result.message :
                successMessage,
          );
          loadSortableSection_(section);
        })
        .catch(function(error) {
          setSortableSectionSaving_(section, false);
          setSortableSectionItems_(section, previousItems);
          setSortableSectionError_(
              section,
              error && error.message ?
                error.message :
                errorMessage,
          );
          renderAdmin_();
        });
  }

  function handleAdminInput_(event) {
    if (
      event.type === "change" &&
      event.target.hasAttribute("data-admin-bulletin-fallback-image")
    ) {
      uploadBulletinFallbackImage_(
          event.target.files && event.target.files[0],
      );
      return;
    }

    var bulletinEventId = event.target.getAttribute(
        "data-admin-bulletin-event-id",
    );
    var bulletinEventField = event.target.getAttribute(
        "data-admin-bulletin-event-field",
    );
    if (bulletinEventId && bulletinEventField) {
      updateBulletinEventField_(
          bulletinEventId,
          bulletinEventField,
          event.target.type === "checkbox" ?
            !!event.target.checked :
            event.target.value,
      );
      return;
    }

    var field = event.target.getAttribute("data-admin-field");
    var nextValue = event.target.type === "checkbox" ?
      !!event.target.checked :
      event.target.value;
    if (!field) {
      return;
    }

    if (field === "delete-confirm.skip") {
      adminState.deleteConfirmSkip = nextValue;
      return;
    }

    if (field === "wayfinder.question") {
      adminState.wayfinderQuestion = String(nextValue || "");
      adminState.wayfinderError = "";
      adminState.wayfinderAnswerError = "";
      return;
    }

    if (field.indexOf("bulletin.") === 0) {
      updateBulletinDraftField_(field.replace("bulletin.", ""), nextValue);
      if (field === "bulletin.serviceDate" ||
        field === "bulletin.serveNeedId" ||
        field === "bulletin.featured.includeDescription" ||
        event.type === "change") {
        renderAdmin_();
      }
      return;
    }

    if (field.indexOf("quick-link.") !== 0 &&
      field.indexOf("resource.") !== 0 &&
      field.indexOf("campaign.") !== 0 &&
      field.indexOf("serve-need.") !== 0 &&
      field.indexOf("next-step.") !== 0 &&
      field.indexOf("room-rule.") !== 0 &&
      field.indexOf("admin-user.") !== 0) {
      if (field.indexOf("status-banner.") === 0) {
        updateStatusBannerDraftField_(
            field.replace("status-banner.", ""),
            nextValue,
        );
      } else if (field.indexOf("hub-settings.") === 0) {
        updateHubSettingsDraftField_(
            field.replace("hub-settings.", ""),
            nextValue,
        );
      } else if (field.indexOf("hub-sunday.") === 0) {
        updateHubSundayDraftField_(
            field.replace("hub-sunday.", ""),
            nextValue,
        );
      } else if (field.indexOf("settings-sunday.") === 0) {
        var settingsSundayFieldName = field.replace("settings-sunday.", "");
        updateSettingsSundayDraftField_(settingsSundayFieldName, nextValue);
        if (settingsSundayFieldName === "google_docs_enabled" ||
          settingsSundayFieldName === "calendar_integrations_enabled") {
          renderAdmin_();
        }
      } else if (field.indexOf("sunday.") === 0) {
        updateSundayDraftField_(
            field.replace("sunday.", ""),
            nextValue,
        );
      }
      return;
    }

    if (field.indexOf("quick-link.") === 0) {
      var fieldName = field.replace("quick-link.", "");

      adminState.quickLinksDraft[fieldName] = nextValue;
      adminState.quickLinksError = "";
      adminState.quickLinksMessage = "";
      return;
    }

    if (field.indexOf("resource.") === 0) {
      var resourceFieldName = field.replace("resource.", "");
      adminState.resourcesDraft[resourceFieldName] = nextValue;
      adminState.resourcesError = "";
      adminState.resourcesMessage = "";
      return;
    }

    if (field.indexOf("campaign.") === 0) {
      var campaignFieldName = field.replace("campaign.", "");
      adminState.campaignsDraft[campaignFieldName] = nextValue;
      if (campaignFieldName === "ongoing" && nextValue) {
        adminState.campaignsDraft.start_date = "";
        adminState.campaignsDraft.end_date = "";
      }
      adminState.campaignsError = "";
      adminState.campaignsMessage = "";
      if (campaignFieldName === "ongoing") {
        renderAdmin_();
      }
      return;
    }

    if (field.indexOf("serve-need.") === 0) {
      var serveNeedFieldName = field.replace("serve-need.", "");
      adminState.serveNeedsDraft[serveNeedFieldName] = nextValue;
      adminState.serveNeedsError = "";
      adminState.serveNeedsMessage = "";
      return;
    }

    if (field.indexOf("room-rule.") === 0) {
      var roomRuleFieldName = field.replace("room-rule.", "");
      adminState.roomRulesDraft[roomRuleFieldName] = nextValue;
      adminState.roomRulesError = "";
      adminState.roomRulesMessage = "";
      return;
    }

    if (field.indexOf("admin-user.pageAccess.") === 0) {
      var pageAccessFieldName = field.replace("admin-user.pageAccess.", "");
      adminState.adminUsersDraft.pageAccess[pageAccessFieldName] = nextValue;
      adminState.adminUsersError = "";
      adminState.adminUsersMessage = "";
      return;
    }

    if (field.indexOf("admin-user.") === 0) {
      var adminUserFieldName = field.replace("admin-user.", "");
      adminState.adminUsersDraft[adminUserFieldName] = nextValue;
      adminState.adminUsersError = "";
      adminState.adminUsersMessage = "";
      return;
    }

    var nextStepFieldName = field.replace("next-step.", "");
    adminState.nextStepsDraft[nextStepFieldName] = nextValue;
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "";
  }

  function updateStatusBannerDraftField_(fieldName, nextValue) {
    adminState.statusBannerDraft[fieldName] = nextValue;
    adminState.statusBannerError = "";
    adminState.statusBannerMessage = "";
  }

  function signInToAdmin_() {
    if (!adminAuth) {
      adminState.errorMessage = "Firebase Auth is not ready yet.";
      renderAdmin_();
      return;
    }

    adminState.errorMessage = "";
    adminState.authLoading = true;
    adminState.infoMessage = "Opening Google sign-in for the admin dashboard.";
    renderAdmin_();

    var provider = buildAdminGoogleAuthProvider_();

    adminAuth.signInWithPopup(provider).catch(function(error) {
      if (shouldFallbackToAdminRedirectSignIn_(error)) {
        return startAdminRedirectSignIn_(provider);
      }

      adminState.authLoading = false;
      adminState.errorMessage = error && error.message ?
        error.message :
        "Google sign-in was interrupted.";
      renderAdmin_();
    });
  }

  function signInToLocalAdmin_() {
    if (!adminAuth || !adminState.usingEmulators) {
      adminState.errorMessage = "Local test sign-in is only available in the emulator.";
      renderAdmin_();
      return;
    }

    adminState.errorMessage = "";
    adminState.authLoading = true;
    adminState.infoMessage = "Signing in with the local Wayfinder test account.";
    renderAdmin_();

    adminAuth.signInWithEmailAndPassword(
        "tdickey@crosspointe.tv",
        "WayfinderLocalOnly!2026",
    ).catch(function(error) {
      adminState.authLoading = false;
      adminState.errorMessage = error && error.message ?
        error.message :
        "The local test account could not sign in.";
      renderAdmin_();
    });
  }

  function signOutFromAdmin_() {
    if (!adminAuth) {
      return;
    }

    adminAuth.signOut().catch(function(error) {
      adminState.errorMessage = error && error.message ?
        error.message :
        "Unable to sign out right now.";
      renderAdmin_();
    });
  }

  function navigateToAdminPage_(pageId) {
    var nextPage = getAdminPageById_(pageId);
    var nextRoute = nextPage ? nextPage.route : "/admin";

    adminState.currentPageId = nextPage ? nextPage.id : "overview";
    if (!shouldAdminSidebarStartOpen_()) {
      adminState.sidebarOpen = false;
    }
    markAdminPageDataStaleForNavigation_(adminState.currentPageId);
    window.history.pushState({}, "", nextRoute);
    renderAdmin_();
  }

  function setAdminSidebarOpen_(isOpen) {
    adminState.sidebarOpen = !!isOpen;

    if (!syncAdminSidebarState_()) {
      renderAdmin_();
    }
  }

  function syncAdminSidebarState_() {
    if (!appEl) {
      return false;
    }

    var shellEl = appEl.querySelector(".central-admin-shell");
    if (!shellEl) {
      return false;
    }

    shellEl.classList.toggle("is-sidebar-open", !!adminState.sidebarOpen);
    shellEl.classList.toggle("is-sidebar-collapsed", !adminState.sidebarOpen);

    Array.prototype.forEach.call(
        shellEl.querySelectorAll(".central-admin-menu-button"),
        function(buttonEl) {
          buttonEl.setAttribute(
              "aria-expanded",
              adminState.sidebarOpen ? "true" : "false",
          );
        },
    );

    return true;
  }

  function getDeleteConfirmSuppressedUntil_() {
    if (!window.localStorage) {
      return 0;
    }

    try {
      var rawValue = window.localStorage.getItem(DELETE_CONFIRM_STORAGE_KEY) || "";
      var timestamp = parseInt(rawValue, 10);
      if (!isFinite(timestamp) || timestamp <= Date.now()) {
        window.localStorage.removeItem(DELETE_CONFIRM_STORAGE_KEY);
        return 0;
      }

      return timestamp;
    } catch (error) {
      return 0;
    }
  }

  function getStoredAdminCollapsedSections_() {
    var defaultSections = getDefaultAdminCollapsedSections_();
    var storageKey = CENTRAL_ADMIN_COLLAPSED_SECTIONS_KEY ||
      "centralAdminCollapsedSectionsV3";
    var legacyStorageKey = LEGACY_ADMIN_COLLAPSED_SECTIONS_KEY ||
      "centralAdminCollapsedSectionsV2";
    var migrationSectionIds = Array.isArray(
        ADMIN_COLLAPSED_SECTION_MIGRATION_IDS,
    ) ?
      ADMIN_COLLAPSED_SECTION_MIGRATION_IDS :
      [
        "integrations-google-calendar",
        "integrations-resi",
        "integrations-youversion",
        "integrations-planning-center",
      ];

    if (!window.localStorage) {
      return defaultSections;
    }

    try {
      var rawValue = window.localStorage.getItem(
          storageKey,
      ) || "";

      if (!rawValue) {
        var legacyRawValue = window.localStorage.getItem(
            legacyStorageKey,
        ) || "";
        var legacySections = legacyRawValue ?
          JSON.parse(legacyRawValue) :
          null;

        if (legacySections &&
          typeof legacySections === "object" &&
          !Array.isArray(legacySections)) {
          migrationSectionIds.forEach(function(sectionId) {
            legacySections[sectionId] = true;
          });
          window.localStorage.setItem(
              storageKey,
              JSON.stringify(legacySections),
          );
          return legacySections;
        }

        return defaultSections;
      }

      var parsed = JSON.parse(rawValue);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ?
        parsed :
        defaultSections;
    } catch (error) {
      return defaultSections;
    }
  }

  function getDefaultAdminCollapsedSections_() {
    var sectionIds = Array.isArray(DEFAULT_ADMIN_COLLAPSED_SECTION_IDS) ?
      DEFAULT_ADMIN_COLLAPSED_SECTION_IDS :
      [
        "hub-homepage",
        "hub-sunday-mode",
        "settings-sunday-controls",
        "settings-room-rule-form",
        "settings-room-rules-list",
        "settings-admin-users",
        "integrations-google-calendar",
        "integrations-resi",
        "integrations-youversion",
        "integrations-planning-center",
      ];
    var sections = {};

    sectionIds.forEach(function(sectionId) {
      sections[sectionId] = true;
    });

    return sections;
  }

  function persistAdminCollapsedSections_() {
    if (!window.localStorage) {
      return;
    }

    try {
      var sections = adminState.collapsedSections &&
        typeof adminState.collapsedSections === "object" &&
        !Array.isArray(adminState.collapsedSections) ?
        adminState.collapsedSections :
        {};

      window.localStorage.setItem(
          CENTRAL_ADMIN_COLLAPSED_SECTIONS_KEY,
          JSON.stringify(sections),
      );
    } catch (error) {
    }
  }

  function isAdminSectionCollapsed_(sectionId) {
    if (!sectionId) {
      return false;
    }

    return !!(
      adminState.collapsedSections &&
      adminState.collapsedSections[sectionId]
    );
  }

  function setAdminSectionCollapsedState_(sectionId, isCollapsed) {
    if (!sectionId) {
      return;
    }

    if (!adminState.collapsedSections ||
      typeof adminState.collapsedSections !== "object" ||
      Array.isArray(adminState.collapsedSections)) {
      adminState.collapsedSections = {};
    }

    if (isCollapsed) {
      adminState.collapsedSections[sectionId] = true;
    } else {
      delete adminState.collapsedSections[sectionId];
    }

    persistAdminCollapsedSections_();
  }

  function expandAdminSection_(sectionId) {
    setAdminSectionCollapsedState_(sectionId, false);
  }

  function toggleAdminSectionCollapsed_(sectionId) {
    if (!sectionId) {
      return;
    }

    setAdminSectionCollapsedState_(sectionId, !isAdminSectionCollapsed_(sectionId));

    if (!syncAdminCollapsibleSectionUi_(sectionId, true)) {
      renderAdmin_();
    }
  }

  function syncAdminCollapsibleSectionUi_(sectionId, animate) {
    if (!appEl || !sectionId) {
      return false;
    }

    var sectionEl = appEl.querySelector(
        '[data-admin-collapsible-section="' + escapeSelectorValue_(sectionId) + '"]',
    );
    var buttonEl = appEl.querySelector(
        '[data-admin-action="toggle-section-collapse"][data-admin-section-id="' +
        escapeSelectorValue_(sectionId) +
        '"]',
    );
    var drawerEl = appEl.querySelector(
        '[data-admin-collapse-drawer="' + escapeSelectorValue_(sectionId) + '"]',
    );

    if (!sectionEl || !buttonEl || !drawerEl) {
      return false;
    }

    var isCollapsed = isAdminSectionCollapsed_(sectionId);
    var slots = Array.prototype.slice.call(
        drawerEl.querySelectorAll(".expandable-slot"),
    );

    sectionEl.classList.toggle("is-collapsed", isCollapsed);
    buttonEl.setAttribute("aria-expanded", isCollapsed ? "false" : "true");

    if (!animate) {
      drawerEl.hidden = isCollapsed;
      drawerEl.setAttribute("aria-hidden", isCollapsed ? "true" : "false");
      drawerEl.style.height = "";
      drawerEl.style.opacity = "";
      drawerEl.style.overflow = "";
      drawerEl.style.transform = "";
      drawerEl.style.transition = "";
      drawerEl.style.willChange = "";

      slots.forEach(function(slot) {
        slot.classList.remove("expandable-visible");
        slot.classList.remove("expandable-leave");
        slot.style.animationDelay = "";
      });

      return true;
    }

    if (isCollapsed) {
      collapseAdminCollapsibleSection_(sectionEl, buttonEl, drawerEl, slots);
    } else {
      expandAdminCollapsibleSection_(sectionEl, buttonEl, drawerEl, slots);
    }

    return true;
  }

  function expandAdminCollapsibleSection_(sectionEl, buttonEl, drawerEl, slots) {
    sectionEl.classList.remove("is-collapsed");
    buttonEl.disabled = true;
    drawerEl.hidden = false;
    drawerEl.setAttribute("aria-hidden", "false");
    drawerEl.style.height = "0px";
    drawerEl.style.opacity = "0";
    drawerEl.style.overflow = "hidden";
    drawerEl.style.transform = "translateY(-8px)";
    drawerEl.style.willChange = "height, opacity, transform";
    drawerEl.style.transition = "";

    slots.forEach(function(slot) {
      slot.classList.remove("expandable-visible");
      slot.classList.remove("expandable-leave");
      slot.style.animationDelay = "";
    });

    var endHeight = drawerEl.scrollHeight;

    slots.forEach(function(slot, index) {
      slot.style.animationDelay = (index * 90) + "ms";
      slot.classList.add("expandable-visible");

      var handleAnimationEnd = function(event) {
        if (event.animationName !== "expandableReveal") return;
        slot.style.animationDelay = "";
        slot.removeEventListener("animationend", handleAnimationEnd);
      };

      slot.addEventListener("animationend", handleAnimationEnd);
    });

    transitionAdminCollapsibleDrawer_(drawerEl, endHeight, function() {
      drawerEl.style.height = "";
      drawerEl.style.overflow = "";
      drawerEl.style.willChange = "";
      buttonEl.disabled = false;
    });
  }

  function collapseAdminCollapsibleSection_(sectionEl, buttonEl, drawerEl, slots) {
    sectionEl.classList.add("is-collapsed");
    buttonEl.disabled = true;
    drawerEl.hidden = false;
    drawerEl.setAttribute("aria-hidden", "false");
    drawerEl.style.height = drawerEl.offsetHeight + "px";
    drawerEl.style.opacity = "1";
    drawerEl.style.overflow = "hidden";
    drawerEl.style.transform = "translateY(0)";
    drawerEl.style.willChange = "height, opacity, transform";
    drawerEl.style.transition = "";

    slots.slice().reverse().forEach(function(slot, index) {
      slot.classList.remove("expandable-visible");
      slot.classList.remove("expandable-leave");
      slot.style.animationDelay = (index * 45) + "ms";
      slot.classList.add("expandable-leave");

      var handleAnimationEnd = function(event) {
        if (event.animationName !== "expandableHide") return;
        slot.style.animationDelay = "";
        slot.removeEventListener("animationend", handleAnimationEnd);
      };

      slot.addEventListener("animationend", handleAnimationEnd);
    });

    transitionAdminCollapsibleDrawer_(drawerEl, 0, function() {
      slots.forEach(function(slot) {
        slot.classList.remove("expandable-leave");
        slot.style.animationDelay = "";
      });
      drawerEl.hidden = true;
      drawerEl.setAttribute("aria-hidden", "true");
      drawerEl.style.height = "";
      drawerEl.style.opacity = "";
      drawerEl.style.overflow = "";
      drawerEl.style.transform = "";
      drawerEl.style.transition = "";
      drawerEl.style.willChange = "";
      buttonEl.disabled = false;
    });
  }

  function transitionAdminCollapsibleDrawer_(drawerEl, endHeight, onDone) {
    var finished = false;

    var cleanup = function() {
      if (finished) return;
      finished = true;
      drawerEl.removeEventListener("transitionend", handleTransitionEnd);
      drawerEl.style.transition = "";
      drawerEl.style.opacity = "";
      drawerEl.style.transform = "";
      if (onDone) onDone();
    };

    var handleTransitionEnd = function(event) {
      if (event.target !== drawerEl || event.propertyName !== "height") return;
      cleanup();
    };

    drawerEl.addEventListener("transitionend", handleTransitionEnd);

    window.requestAnimationFrame(function() {
      drawerEl.style.transition =
        "height " + ADMIN_EXPANDABLE_FLOW_DURATION_MS +
        "ms cubic-bezier(0.16, 1, 0.3, 1), " +
        "opacity " + ADMIN_EXPANDABLE_FLOW_DURATION_MS + "ms ease, " +
        "transform " + ADMIN_EXPANDABLE_FLOW_DURATION_MS + "ms ease";
      drawerEl.style.height = endHeight + "px";
      drawerEl.style.opacity = "1";
      drawerEl.style.transform = "translateY(0)";
    });

    window.setTimeout(cleanup, ADMIN_EXPANDABLE_FLOW_DURATION_MS + 90);
  }

  function escapeSelectorValue_(value) {
    var text = String(value == null ? "" : value);

    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(text);
    }

    return text.replace(/["\\]/g, "\\$&");
  }

  function setDeleteConfirmSuppressedUntil_(timestamp) {
    var nextTimestamp = typeof timestamp === "number" &&
      isFinite(timestamp) &&
      timestamp > Date.now() ?
      timestamp :
      0;

    adminState.deleteConfirmSuppressedUntil = nextTimestamp;

    if (!window.localStorage) {
      return;
    }

    try {
      if (nextTimestamp) {
        window.localStorage.setItem(
            DELETE_CONFIRM_STORAGE_KEY,
            String(nextTimestamp),
        );
      } else {
        window.localStorage.removeItem(DELETE_CONFIRM_STORAGE_KEY);
      }
    } catch (error) {
    }
  }

  function isAdminRedirectSignInPending_() {
    if (!window.sessionStorage) {
      return false;
    }

    try {
      return window.sessionStorage.getItem(CENTRAL_ADMIN_REDIRECT_SIGN_IN_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function writeAdminRedirectSignInPending_(isPending) {
    if (!window.sessionStorage) {
      return;
    }

    try {
      if (isPending) {
        window.sessionStorage.setItem(CENTRAL_ADMIN_REDIRECT_SIGN_IN_KEY, "1");
      } else {
        window.sessionStorage.removeItem(CENTRAL_ADMIN_REDIRECT_SIGN_IN_KEY);
      }
    } catch (error) {
    }
  }

  function clearAdminRedirectSignInPending_() {
    writeAdminRedirectSignInPending_(false);
  }

  function readStoredAdminInviteParams_() {
    if (!window.sessionStorage) {
      return null;
    }

    try {
      var storedValue = window.sessionStorage.getItem(
          CENTRAL_ADMIN_INVITE_STORAGE_KEY,
      );
      var storedParams = storedValue ? JSON.parse(storedValue) : null;
      var inviteId = String(storedParams && storedParams.inviteId || "").trim();
      var token = String(storedParams && storedParams.token || "").trim();

      return inviteId && token ? {
        inviteId: inviteId,
        token: token,
      } : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredAdminInviteParams_(inviteParams) {
    if (!window.sessionStorage) {
      return;
    }

    try {
      if (inviteParams && inviteParams.inviteId && inviteParams.token) {
        window.sessionStorage.setItem(
            CENTRAL_ADMIN_INVITE_STORAGE_KEY,
            JSON.stringify({
              inviteId: String(inviteParams.inviteId).trim(),
              token: String(inviteParams.token).trim(),
            }),
        );
      } else {
        window.sessionStorage.removeItem(CENTRAL_ADMIN_INVITE_STORAGE_KEY);
      }
    } catch (error) {
    }
  }

  function isDeleteConfirmSuppressed_() {
    if (adminState.deleteConfirmSuppressedUntil > Date.now()) {
      return true;
    }

    if (adminState.deleteConfirmSuppressedUntil) {
      setDeleteConfirmSuppressedUntil_(0);
    }

    return false;
  }

  function openDeleteConfirm_(options) {
    if (!options || typeof options.onConfirm !== "function") {
      return;
    }

    if (options.showSkip !== false && isDeleteConfirmSuppressed_()) {
      options.onConfirm();
      return;
    }

    adminState.deleteConfirmOpen = true;
    adminState.deleteConfirmTitle = options.title || "Confirm Delete";
    adminState.deleteConfirmMessage = options.message ||
      "Are you sure you want to delete this item?";
    adminState.deleteConfirmConfirmLabel = options.confirmLabel || "Delete Item";
    adminState.deleteConfirmShowSkip = options.showSkip !== false;
    adminState.deleteConfirmSkip = false;
    adminState.deleteConfirmAction = options.onConfirm;
    renderAdmin_();
  }

  function closeDeleteConfirm_(skipRender) {
    adminState.deleteConfirmOpen = false;
    adminState.deleteConfirmTitle = "";
    adminState.deleteConfirmMessage = "";
    adminState.deleteConfirmConfirmLabel = "";
    adminState.deleteConfirmShowSkip = false;
    adminState.deleteConfirmSkip = false;
    adminState.deleteConfirmAction = null;

    if (!skipRender) {
      renderAdmin_();
    }
  }

  function confirmDeleteConfirm_() {
    if (typeof adminState.deleteConfirmAction !== "function") {
      closeDeleteConfirm_();
      return;
    }

    if (adminState.deleteConfirmShowSkip && adminState.deleteConfirmSkip) {
      setDeleteConfirmSuppressedUntil_(
          Date.now() + DELETE_CONFIRM_SUPPRESSION_MS,
      );
    }

    var nextAction = adminState.deleteConfirmAction;
    closeDeleteConfirm_(true);
    nextAction();
  }

  function confirmDeleteAction_(actionConfig, label, onConfirm) {
    openDeleteConfirm_({
      title: actionConfig && actionConfig.mode === "submit" ?
        "Submit Removal Request" :
        "Delete Item",
      message: actionConfig && actionConfig.mode === "submit" ?
        "Submit a removal request for " + label + "?" :
        "Delete " + label + " and publish that change to preview?",
      confirmLabel: actionConfig && actionConfig.mode === "submit" ?
        "Submit Request" :
        "Delete Item",
      onConfirm: onConfirm,
    });
  }

  function renderAdmin_() {
    if (!appEl) {
      return;
    }

    var currentPage = getAdminPageById_(adminState.currentPageId) ||
      getAdminPageById_("overview");
    var visiblePages = getVisibleAdminPages_();
    var accessIsResolved = !adminState.authLoading && (
      !adminState.user ||
      !adminState.userEmailAllowed ||
      adminState.userDocLoaded
    );

    if (accessIsResolved && !canAccessAdminPage_(currentPage)) {
      currentPage = getAdminPageById_("overview");
      adminState.currentPageId = "overview";

      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, "", "/admin");
      }
    }
    var shellClassName = adminState.sidebarOpen ?
      "central-admin-shell is-sidebar-open" :
      "central-admin-shell is-sidebar-collapsed";

    appEl.innerHTML = [
      "<div class=\"", shellClassName, "\">",
      "<button type=\"button\" class=\"central-admin-sidebar-scrim\" data-admin-action=\"close-sidebar\" aria-label=\"Close navigation\"></button>",
      renderAdminSidebar_(currentPage, visiblePages),
      renderAdminMain_(currentPage),
      renderDeleteConfirmModal_(),
      renderBulletinEventEditorModal_(currentPage),
      "</div>",
      currentPage.id === "bulletin" && adminState.bulletinLoaded ?
        renderBulletinPrintRoot_() :
        "",
    ].join("");

    maybeLoadCurrentPageData_();
  }

  function renderAdminSidebar_(currentPage, visiblePages) {
    return [
      "<aside class=\"central-admin-sidebar\" id=\"central-admin-sidebar\">",
      "<div class=\"central-admin-sidebar-top\">",
      "<div class=\"central-admin-brand\">",
      "<div class=\"central-admin-brand-mark\">",
      "<img src=\"/favicon.svg\" alt=\"Central logo\" class=\"central-admin-brand-logo\">",
      "</div>",
      "<div class=\"central-admin-brand-copy\">",
      "<h1>Central Admin</h1>",
      "</div>",
      "</div>",
      "<button type=\"button\" class=\"central-admin-sidebar-close\" data-admin-action=\"close-sidebar\" aria-label=\"Close menu\">",
      "<span></span><span></span>",
      "</button>",
      "</div>",
      renderAdminUserPanel_(),
      "<nav class=\"central-admin-nav\" aria-label=\"Admin pages\">",
      visiblePages.map(function(page) {
        return [
          "<a href=\"", escapeAttr_(page.route), "\" data-admin-nav=\"",
          escapeAttr_(page.id), "\" class=\"",
          page.id === currentPage.id ? "is-active" : "", "\">",
          "<span>", escapeHtml_(page.label), "</span>",
          renderAdminSidebarNavMeta_(page),
          "</a>",
        ].join("");
      }).join(""),
      "</nav>",
      "</aside>",
    ].join("");
  }

  function renderAdminMain_(currentPage) {
    return [
      "<main class=\"central-admin-main\">",
      "<div class=\"central-admin-main-inner\">",
      renderAdminHero_(currentPage),
      renderAdminPagePanel_(currentPage),
      "</div>",
      "</main>",
    ].join("");
  }

  function renderDeleteConfirmModal_() {
    if (!adminState.deleteConfirmOpen) {
      return "";
    }

    return [
      "<div class=\"central-admin-modal\" role=\"presentation\">",
      "<button type=\"button\" class=\"central-admin-modal-scrim\" data-admin-action=\"close-delete-confirm\" aria-label=\"Close confirmation\"></button>",
      "<div class=\"central-admin-modal-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"central-admin-delete-confirm-title\">",
      "<div class=\"central-admin-modal-copy\">",
      "<span class=\"central-admin-kicker\">Confirm</span>",
      "<h3 id=\"central-admin-delete-confirm-title\">",
      escapeHtml_(adminState.deleteConfirmTitle),
      "</h3>",
      "<p>",
      escapeHtml_(adminState.deleteConfirmMessage),
      "</p>",
      "</div>",
      adminState.deleteConfirmShowSkip ? [
        "<label class=\"central-admin-checkbox central-admin-modal-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"delete-confirm.skip\"",
        adminState.deleteConfirmSkip ? " checked" : "",
        ">",
        "<span>Don't ask me again for 5 minutes</span>",
        "</label>",
        "<p class=\"central-admin-note\">This applies across the whole admin dashboard.</p>",
      ].join("") : "",
      "<div class=\"central-admin-action-row central-admin-modal-actions\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"close-delete-confirm\">Cancel</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"confirm-delete-confirm\">",
      escapeHtml_(adminState.deleteConfirmConfirmLabel || "Delete Item"),
      "</button>",
      "</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderBulletinEventEditorModal_(currentPage) {
    if (
      !currentPage ||
      currentPage.id !== "bulletin" ||
      !adminState.bulletinEditingEventId
    ) {
      return "";
    }

    var item = (adminState.bulletinDraft.events || []).find(function(eventItem) {
      return eventItem.id === adminState.bulletinEditingEventId;
    });
    if (!item) {
      return "";
    }

    return [
      "<div class=\"central-admin-modal central-admin-bulletin-event-modal\" role=\"presentation\">",
      "<button type=\"button\" class=\"central-admin-modal-scrim\" data-admin-action=\"close-bulletin-event-editor\" aria-label=\"Close event editor\"></button>",
      "<div class=\"central-admin-modal-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"central-admin-bulletin-event-modal-title\">",
      "<div class=\"central-admin-modal-copy\">",
      "<span class=\"central-admin-kicker\">Bulletin Event</span>",
      "<h3 id=\"central-admin-bulletin-event-modal-title\">",
      escapeHtml_(item.title || "Untitled Event"),
      "</h3>",
      "<p>",
      escapeHtml_([item.date, item.time, item.location].filter(Boolean).join(" · ")),
      "</p>",
      "</div>",
      "<div class=\"central-admin-bulletin-event-modal-fields\">",
      "<label class=\"central-admin-field\"><span>Printed Title</span>",
      "<input type=\"text\" maxlength=\"180\" value=\"", escapeAttr_(item.title),
      "\" data-admin-bulletin-event-id=\"", escapeAttr_(item.id),
      "\" data-admin-bulletin-event-field=\"title\"></label>",
      "<label class=\"central-admin-field\"><span>Printed Room / Location</span>",
      "<input type=\"text\" maxlength=\"240\" value=\"", escapeAttr_(item.location),
      "\" data-admin-bulletin-event-id=\"", escapeAttr_(item.id),
      "\" data-admin-bulletin-event-field=\"location\">",
      "<small class=\"central-admin-field-hint\">Planning Center default: ",
      escapeHtml_(item.sourceLocation || "No room provided"),
      ". Enter another room to override it for this bulletin.</small></label>",
      "<label class=\"central-admin-field\"><span>Printed Description</span>",
      "<textarea rows=\"5\" maxlength=\"1200\" data-admin-bulletin-event-id=\"",
      escapeAttr_(item.id), "\" data-admin-bulletin-event-field=\"description\">",
      escapeHtml_(item.description), "</textarea>",
      "<small class=\"central-admin-field-hint\">Formatting: **bold**, *italics*, headings, and - or 1. lists. Line breaks are preserved.</small></label>",
      "<label class=\"central-admin-checkbox central-admin-modal-checkbox\"><input type=\"checkbox\" data-admin-bulletin-event-id=\"",
      escapeAttr_(item.id), "\" data-admin-bulletin-event-field=\"includeDescription\"",
      item.includeDescription ? " checked" : "", "><span>Include full description</span></label>",
      "</div>",
      "<div class=\"central-admin-action-row central-admin-modal-actions\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"close-bulletin-event-editor\">Done</button>",
      "</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderAdminHero_(currentPage) {
    return [
      "<section class=\"central-admin-hero\">",
      "<div class=\"central-admin-hero-top\">",
      "<button type=\"button\" class=\"central-admin-menu-button\" data-admin-action=\"toggle-sidebar\" aria-label=\"Toggle navigation menu\" aria-controls=\"central-admin-sidebar\" aria-expanded=\"",
      adminState.sidebarOpen ? "true" : "false",
      "\">",
      "<span></span><span></span><span></span>",
      "</button>",
      "<div class=\"central-admin-auth-actions\">",
      renderAdminThemeToggle_(),
      renderAdminAuthActions_(),
      "</div>",
      "</div>",
      "<div class=\"central-admin-hero-copy\">",
      "<div class=\"central-admin-hero-bar\">",
      "<span class=\"central-admin-kicker\">Central Admin</span>",
      "<span class=\"central-admin-badge\">", escapeHtml_(currentPage.label), "</span>",
      "</div>",
      "<h2>", escapeHtml_(getAdminHeroTitle_(currentPage)), "</h2>",
      "<p>", escapeHtml_(getAdminHeroDescription_(currentPage)), "</p>",
      "</div>",
      "<div class=\"central-admin-badges\">",
      renderAdminHeroBadges_(currentPage),
      "</div>",
      adminState.errorMessage ?
        "<p class=\"central-admin-note central-admin-hero-note\">" +
        escapeHtml_(adminState.errorMessage) +
        "</p>" :
        "",
      "</section>",
    ].join("");
  }

  function renderAdminHeroBadges_(currentPage) {
    var badges = [
      renderStatusPill_(
          getAdminAccessSummaryLabel_(),
          getAdminAccessSummaryTone_(),
      ),
    ];

    if (currentPage && currentPage.pageAccessKey) {
      var permission = getPageAccessLevel_(currentPage.pageAccessKey);
      if (permission !== "none") {
        badges.push(
            renderStatusPill_(
                getPermissionLabel_(permission),
                getPermissionToneClass_(permission),
            ),
        );
      }
    }

    if (
      adminState.changeRequestsPendingCount > 0 &&
      currentPage &&
      currentPage.id !== "change-requests"
    ) {
      badges.push(
          renderStatusPill_(
              String(adminState.changeRequestsPendingCount) + " pending",
              "is-live",
          ),
      );
    } else if (adminState.usingEmulators) {
      badges.push(renderStatusPill_("Local preview", "is-warn"));
    }

    return badges.join("");
  }

  function renderAdminUserPanel_() {
    if (!adminState.user) {
      return [
        "<section class=\"central-admin-user-card\">",
        "<div class=\"central-admin-user-avatar is-empty\">C</div>",
        "<div class=\"central-admin-user-copy\">",
        "<strong>Not signed in</strong>",
        "<p>Use an approved Google account.</p>",
        "</div>",
        "</section>",
      ].join("");
    }

    return [
      "<section class=\"central-admin-user-card\">",
      renderAdminUserAvatar_(),
      "<div class=\"central-admin-user-copy\">",
      "<strong>", escapeHtml_(getAdminUserDisplayName_()), "</strong>",
      "<p>", escapeHtml_(adminState.user.email || "No email available"), "</p>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderAdminUserAvatar_() {
    var photoUrl = String(
        adminState.user && adminState.user.photoURL || "",
    ).trim();

    if (photoUrl) {
      return [
        "<div class=\"central-admin-user-avatar\">",
        "<img src=\"", escapeAttr_(photoUrl), "\" alt=\"",
        escapeAttr_(getAdminUserDisplayName_()), "\">",
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-user-avatar is-empty\">",
      escapeHtml_(getAdminUserInitials_()),
      "</div>",
    ].join("");
  }

  function renderAdminSidebarNavMeta_(page) {
    if (!page || page.id !== "change-requests") {
      return "";
    }

    if (!adminState.changeRequestsPendingCount) {
      return "";
    }

    return [
      "<small>",
      escapeHtml_(String(adminState.changeRequestsPendingCount)),
      "</small>",
    ].join("");
  }

  function getAdminUserDisplayName_() {
    if (!adminState.user) {
      return "Central User";
    }

    return String(
        adminState.user.displayName ||
        adminState.user.email ||
        "Central User",
    ).trim();
  }

  function getAdminUserInitials_() {
    var label = getAdminUserDisplayName_();
    var parts = label.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return "C";
    }

    return parts.slice(0, 2).map(function(part) {
      return part.charAt(0).toUpperCase();
    }).join("");
  }

  function getAdminHeroDescription_(currentPage) {
    if (!currentPage) {
      return "Manage CrossPointe Central from one clean dashboard.";
    }

    if (currentPage.id === "overview") {
      return "Choose a section and jump straight into the parts of Central you can manage.";
    }

    return getAdminPageShortSummary_(currentPage);
  }

  function getAdminHeroTitle_(currentPage) {
    if (!currentPage || currentPage.id === "overview") {
      return "Dashboard";
    }

    return "Manage " + currentPage.label;
  }

  function renderAdminMetricCard_(label, metric, description, toneClass) {
    return [
      "<section class=\"central-admin-card\">",
      "<span class=\"central-admin-kicker\">", escapeHtml_(label), "</span>",
      "<div class=\"central-admin-metric\">", escapeHtml_(metric), "</div>",
      "<p>", escapeHtml_(description), "</p>",
      renderStatusPill_(label + " status", toneClass),
      "</section>",
    ].join("");
  }

  function renderAdminPagePanel_(currentPage) {
    if (currentPage.id === "overview") {
      return renderOverviewPagePanel_(currentPage);
    }

    if (currentPage.id === "hub") {
      return renderHubPagePanel_(currentPage);
    }

    if (currentPage.id === "bulletin") {
      return renderBulletinPagePanel_(currentPage);
    }

    if (currentPage.id === "quick-links") {
      return renderQuickLinksPagePanel_(currentPage);
    }

    if (currentPage.id === "sunday") {
      return renderSundayPagePanel_(currentPage);
    }

    if (currentPage.id === "resources") {
      return renderResourcesPagePanel_(currentPage);
    }

    if (currentPage.id === "campaigns") {
      return renderCampaignsPagePanel_(currentPage);
    }

    if (currentPage.id === "serve-needs") {
      return renderServeNeedsPagePanel_(currentPage);
    }

    if (currentPage.id === "next-steps") {
      return renderNextStepsPagePanel_(currentPage);
    }

    if (currentPage.id === "settings") {
      return renderSettingsPagePanel_(currentPage);
    }

    if (currentPage.id === "integrations") {
      return renderIntegrationsPagePanel_(currentPage);
    }

    if (currentPage.id === "wayfinder") {
      return renderWayfinderPagePanel_(currentPage);
    }

    if (currentPage.id === "status-banner") {
      return renderStatusBannerPagePanel_(currentPage);
    }

    if (currentPage.id === "change-requests") {
      return renderChangeRequestsPagePanel_(currentPage);
    }

    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-live"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Collection", currentPage.collectionPath || "Shell-only"),
      renderInlineMeta_("Default role", PERMISSION_LABELS.edit),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>What this patch handles now</strong>",
      renderStatusPill_("Foundation", "is-safe"),
      "</div>",
      "<ul class=\"central-admin-checklist\">",
      [
        "Dedicated /admin route boot flow",
        "Google Workspace sign-in entry point",
        "Firestore client startup with localhost emulator support",
        "Working admin navigation for the current Central editors",
      ].map(function(item) {
        return "<li>" + escapeHtml_(item) + "</li>";
      }).join(""),
      "</ul>",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>What we layer in next</strong>",
      renderStatusPill_("Next patch", "is-warn"),
      "</div>",
      "<ul class=\"central-admin-checklist\">",
      [
        "Resolve effective permissions from user and role docs",
        "Read initial Firestore collections for resources and the remaining content lists",
        "Add direct edit vs propose-change behavior",
        "Wire approvals and audit logging through Functions/Admin SDK",
      ].map(function(item) {
        return "<li>" + escapeHtml_(item) + "</li>";
      }).join(""),
      "</ul>",
      "</div>",
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderOverviewPagePanel_(currentPage) {
    var pages = getVisibleAdminPages_().filter(function(page) {
      return page.id !== "overview";
    });

    if (!adminState.user || !adminState.userEmailAllowed ||
      !isActiveAdminUserRecord_()) {
      return renderOverviewAccessPanel_(currentPage);
    }

    return [
      "<section class=\"central-admin-panel central-admin-overview-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(
          String(pages.length) + " page" + (pages.length === 1 ? "" : "s"),
          "is-safe",
      ),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      pages.length ? [
        "<div class=\"central-admin-overview-grid\">",
        pages.map(function(page) {
          return renderOverviewPageCard_(page);
        }).join(""),
        "</div>",
      ].join("") : [
        "<div class=\"central-admin-empty\">",
        "<p class=\"central-admin-footer-note\">",
        "No admin pages are visible for this account yet.",
        "</p>",
        "</div>",
      ].join(""),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderOverviewAccessPanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel central-admin-overview-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(getAdminAccessSummaryLabel_(), getAdminAccessSummaryTone_()),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      renderOverviewAccessBody_(),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderOverviewAccessBody_() {
    if (!adminState.user) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Sign in to continue</strong>",
        renderStatusPill_("Google required", "is-live"),
        "</div>",
        renderAdminNote_(
            "Use a CrossPointe account or an approved tester account to unlock the dashboard.",
        ),
        "<div class=\"central-admin-action-row\">",
        renderAdminAuthActions_(),
        "</div>",
        "</div>",
      ].join("");
    }

    if (!adminState.userEmailAllowed) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Wrong account</strong>",
        renderStatusPill_("Workspace required", "is-warn"),
        "</div>",
        renderAdminNote_(
            "You are signed in, but this Google account is not approved for Central Admin.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.userDocLoaded && !adminState.errorMessage) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Checking your access</strong>",
        renderStatusPill_("In progress", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Looking for your Firestore admin user record now.",
        ),
        "</div>",
      ].join("");
    }

    if (adminState.userDocExists && !isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Admin record found</strong>",
        renderStatusPill_("Needs activation", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Your admin user document exists, but it is not active yet.",
        ),
        adminState.bootstrapMessage ?
          renderAdminNote_(adminState.bootstrapMessage) :
          "",
        "</div>",
      ].join("");
    }

    if (adminState.inviteClaimPending) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Confirming your admin invitation</strong>",
        renderStatusPill_("In progress", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Central is connecting the permissions from your invitation to this Google account.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Create your admin access</strong>",
      renderStatusPill_(
          adminState.bootstrapPending ? "Working" : "One click",
          adminState.bootstrapPending ? "is-warn" : "is-live",
      ),
      "</div>",
      renderAdminNote_(
          "The fastest path is to create the first admin record for the Google account you are already using.",
      ),
      adminState.bootstrapMessage ?
        renderAdminNote_(adminState.bootstrapMessage) :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"bootstrap-first-admin\"",
      adminState.bootstrapPending ? " disabled" : "",
      ">",
      adminState.bootstrapPending ? "Creating Access..." : "Create My Admin Access",
      "</button>",
      "</div>",
      "</div>",
      "<details class=\"central-admin-details\">",
      "<summary>Manual setup</summary>",
      "<div class=\"central-admin-details-body\">",
      renderAdminNote_(
          "If automatic setup fails, create the Firestore document at " +
          adminState.userDocPath + ".",
      ),
      "<pre class=\"central-admin-code-block\">",
      escapeHtml_(JSON.stringify(createFirstAdminUserDocTemplate_(), null, 2)),
      "</pre>",
      "</div>",
      "</details>",
    ].join("");
  }

  function renderOverviewPageCard_(page) {
    var permission = getPageAccessLevel_(page.pageAccessKey);
    var statusText = page.id === "change-requests" &&
      adminState.changeRequestsPendingCount > 0 ?
      String(adminState.changeRequestsPendingCount) + " pending" :
      "";
    var actionLabel = page.id === "change-requests" &&
      adminState.changeRequestsPendingCount > 0 ?
      "Review Requests" :
      "Open Page";

    return [
      "<article class=\"central-admin-card central-admin-overview-card\">",
      "<div class=\"central-admin-overview-card-top\">",
      "<h3>", escapeHtml_(page.label), "</h3>",
      "<div class=\"central-admin-badges\">",
      renderStatusPill_(
          getPermissionLabel_(permission),
          getPermissionToneClass_(permission),
      ),
      statusText && page.id === "change-requests" ?
        renderStatusPill_(statusText, "is-live") :
        "",
      "</div>",
      "</div>",
      "<p>", escapeHtml_(getAdminPageShortSummary_(page)), "</p>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-nav=\"",
      escapeAttr_(page.id),
      "\">",
      escapeHtml_(actionLabel),
      "</button>",
      "</div>",
      "</article>",
    ].join("");
  }

  function getAdminPageShortSummary_(page) {
    if (!page) {
      return "Manage Central content from the dashboard.";
    }

    if (page.id === "hub") {
      return "Homepage content and Sunday-mode copy.";
    }

    if (page.id === "bulletin") {
      return "A print-ready half-letter Sunday insert.";
    }

    if (page.id === "quick-links") {
      return "Homepage shortcuts and featured links.";
    }

    if (page.id === "status-banner") {
      return "Temporary announcements and urgent updates.";
    }

    if (page.id === "sunday") {
      return "This week's sermon details and notes.";
    }

    if (page.id === "resources") {
      return "Helpful links, guides, and tools.";
    }

    if (page.id === "campaigns") {
      return "Featured ongoing and date-based campaigns.";
    }

    if (page.id === "next-steps") {
      return "Connection pathways and action cards.";
    }

    if (page.id === "serve-needs") {
      return "Volunteer needs and ministry opportunities.";
    }

    if (page.id === "settings") {
      return "Operational controls, room rules, and admin access.";
    }

    if (page.id === "change-requests") {
      return "Review and approve proposed changes.";
    }

    return page.summary || "Manage Central content from the dashboard.";
  }

  function getPermissionToneClass_(permission) {
    if (permission === "view" || permission === "none") {
      return "is-warn";
    }

    if (permission === "propose") {
      return "is-live";
    }

    return "is-safe";
  }

  function createDefaultHubHomepageModules_() {
    return normalizeHubModuleItems_(null, HUB_HOMEPAGE_MODULE_DEFINITIONS);
  }

  function createDefaultHubSundayModules_() {
    return normalizeHubModuleItems_(null, HUB_SUNDAY_MODULE_DEFINITIONS);
  }

  function getHubModuleDefinitionsForDraftField_(fieldName) {
    if (fieldName === "homepage_modules") {
      return HUB_HOMEPAGE_MODULE_DEFINITIONS;
    }

    if (fieldName === "sunday_modules") {
      return HUB_SUNDAY_MODULE_DEFINITIONS;
    }

    return [];
  }

  function getHubModuleDefinitionsForSortSection_(section) {
    if (section === HUB_HOMEPAGE_MODULE_SORT_SECTION) {
      return HUB_HOMEPAGE_MODULE_DEFINITIONS;
    }

    if (section === HUB_SUNDAY_MODULE_SORT_SECTION) {
      return HUB_SUNDAY_MODULE_DEFINITIONS;
    }

    return [];
  }

  function getHubModuleSortSectionConfig_(section) {
    if (section === HUB_HOMEPAGE_MODULE_SORT_SECTION) {
      return {
        section: "hubSettings",
        label: "Homepage modules",
        draftKey: "hubSettingsDraft",
        fieldKey: "homepage_modules",
        currentKey: "hubSettingsCurrent",
        permission: getPageAccessLevel_("hub"),
        canEdit: canEditHubSettings_(),
        publishingStateKey: "hubSettingsPublishing",
        loadingStateKey: "hubLoading",
        errorStateKey: "hubSettingsError",
        messageStateKey: "hubSettingsMessage",
      };
    }

    if (section === HUB_SUNDAY_MODULE_SORT_SECTION) {
      return {
        section: "hubSunday",
        label: "Sunday Mode modules",
        draftKey: "hubSundayDraft",
        fieldKey: "sunday_modules",
        currentKey: "hubSundayCurrent",
        permission: getHubSundayAccessLevel_(),
        canEdit: canEditHubSunday_(),
        publishingStateKey: "hubSundayPublishing",
        loadingStateKey: "hubLoading",
        errorStateKey: "hubSundayError",
        messageStateKey: "hubSundayMessage",
      };
    }

    return null;
  }

  function isHubModuleSortableSection_(section) {
    return !!getHubModuleSortSectionConfig_(section);
  }

  function normalizeHubModuleEnabledValue_(value) {
    return value !== false &&
      value !== "false" &&
      value !== 0 &&
      value !== "0";
  }

  function getHubModuleDefinitionDefaultEnabled_(definition) {
    return !definition || definition.defaultEnabled !== false;
  }

  function cloneHubModuleItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        enabled: normalizeHubModuleEnabledValue_(item && item.enabled),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
      };
    });
  }

  function normalizeHubModuleItems_(items, definitions) {
    var sourceItems = Array.isArray(items) ? items : [];
    var moduleDefinitions = Array.isArray(definitions) ? definitions : [];
    var definitionOrder = {};
    var definitionDefaults = {};
    var normalizedItems = [];
    var seenIds = {};

    moduleDefinitions.forEach(function(definition, index) {
      definitionOrder[definition.id] = index;
      definitionDefaults[definition.id] = getHubModuleDefinitionDefaultEnabled_(
          definition,
      );
    });

    sourceItems.forEach(function(item) {
      var moduleId = String(item && item.id || "").trim();
      if (!moduleId ||
        !Object.prototype.hasOwnProperty.call(definitionOrder, moduleId) ||
        seenIds[moduleId]) {
        return;
      }

      seenIds[moduleId] = true;
      normalizedItems.push({
        id: moduleId,
        enabled: normalizeHubModuleEnabledValue_(item && item.enabled),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          ((definitionOrder[moduleId] + 1) * 10),
      });
    });

    moduleDefinitions.forEach(function(definition, index) {
      if (seenIds[definition.id]) {
        return;
      }

      seenIds[definition.id] = true;
      normalizedItems.push({
        id: definition.id,
        enabled: definitionDefaults[definition.id],
        sort: (index + 1) * 10,
      });
    });

    return normalizedItems.sort(function(leftItem, rightItem) {
      if (leftItem.enabled !== rightItem.enabled) {
        return leftItem.enabled ? -1 : 1;
      }

      if (leftItem.sort !== rightItem.sort) {
        return leftItem.sort - rightItem.sort;
      }

      return definitionOrder[leftItem.id] - definitionOrder[rightItem.id];
    }).map(function(item, index) {
      return {
        id: item.id,
        enabled: item.enabled,
        sort: (index + 1) * 10,
      };
    });
  }

  function getHubModuleDefinitionById_(definitions, moduleId) {
    var targetId = String(moduleId || "").trim();
    return (Array.isArray(definitions) ? definitions : []).find(function(definition) {
      return definition && definition.id === targetId;
    }) || null;
  }

  function renderHubModuleManager_(config) {
    var section = String(config && config.section || "").trim();
    var canEdit = !!(config && config.canEdit);
    var modules = normalizeHubModuleItems_(
        config && config.items,
        getHubModuleDefinitionsForSortSection_(section),
    );
    var visibleItems = modules.filter(function(item) {
      return item && item.enabled !== false;
    });
    var disabledItems = modules.filter(function(item) {
      return item && item.enabled === false;
    });
    var canReorder = canReorderSortableSection_(section) &&
      modules.length > 1;
    var busy = isSortableSectionBusy_(section);

    return [
      "<div class=\"central-admin-module-manager\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>", escapeHtml_(config && config.title || "Modules"), "</strong>",
      renderStatusPill_(
          String(visibleItems.length) + " visible",
          visibleItems.length ? "is-safe" : "is-live",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Drag modules to change their order. Use Hide to move a module below Disabled, or Show to bring it back." :
            "This is the current module layout on preview.",
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"",
      escapeAttr_(section),
      "\">",
      visibleItems.map(function(item) {
        return renderHubModuleListItem_(section, item, canReorder, busy);
      }).join(""),
      "<div class=\"central-admin-module-divider\">",
      "<span>Disabled</span>",
      "<small>Hidden on the public page until you show them again.</small>",
      "</div>",
      disabledItems.length ?
        disabledItems.map(function(item) {
          return renderHubModuleListItem_(section, item, canReorder, busy);
        }).join("") :
        "<div class=\"central-admin-module-empty\">No modules are disabled right now.</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderHubModuleListItem_(section, item, canReorder, busy) {
    var definitions = getHubModuleDefinitionsForSortSection_(section);
    var definition = getHubModuleDefinitionById_(definitions, item && item.id);
    var isEnabled = !!(item && item.enabled !== false);
    var sortConfig = getHubModuleSortSectionConfig_(section);
    var canEdit = !!(sortConfig && sortConfig.canEdit);

    return [
      renderSortableListItemStart_(
          section,
          item,
          !canReorder,
          definition && definition.label ? definition.label : "module",
          "central-admin-module-item" + (isEnabled ? "" : " is-disabled"),
      ),
      "<div class=\"central-admin-list-main\">",
      "<div class=\"central-admin-item-meta\">",
      renderStatusPill_(
          isEnabled ? "Visible" : "Hidden",
          isEnabled ? "is-safe" : "is-live",
      ),
      "</div>",
      "<strong>",
      escapeHtml_(
          definition && definition.label ?
            definition.label :
            String(item && item.id || "Module"),
      ),
      "</strong>",
      definition && definition.description ?
        "<p class=\"central-admin-footer-note\">" +
        escapeHtml_(definition.description) +
        "</p>" :
        "",
      "</div>",
      canEdit ? [
        "<div class=\"central-admin-list-actions\">",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"toggle-hub-module\" data-admin-sort-section=\"",
        escapeAttr_(section),
        "\" data-admin-doc-id=\"",
        escapeAttr_(item && item.id || ""),
        "\" data-admin-module-enabled=\"",
        isEnabled ? "false" : "true",
        "\"",
        busy ? " disabled" : "",
        ">",
        escapeHtml_(isEnabled ? "Hide" : "Show"),
        "</button>",
        "</div>",
      ].join("") : "",
      "</article>",
    ].join("");
  }

  function renderBulletinPagePanel_(currentPage) {
    var permission = getPageAccessLevel_("bulletin");
    var canSave = isEditorLevelPermission_(permission);

    if (adminState.bulletinLoading && !adminState.bulletinLoaded) {
      return [
        "<section class=\"central-admin-panel\">",
        "<div class=\"central-admin-panel-header\"><div>",
        "<h3>", escapeHtml_(currentPage.label), "</h3>",
        "<p>", escapeHtml_(currentPage.summary), "</p>",
        "</div>", renderStatusPill_("Loading", "is-live"), "</div>",
        "<div class=\"central-admin-page-body\">",
        renderAdminNote_(
            "Loading the current Central content and saved bulletin settings.",
        ),
        "</div></section>",
      ].join("");
    }

    if (adminState.bulletinError && !adminState.bulletinLoaded) {
      return [
        "<section class=\"central-admin-panel\">",
        "<div class=\"central-admin-panel-header\"><div>",
        "<h3>", escapeHtml_(currentPage.label), "</h3>",
        "<p>", escapeHtml_(currentPage.summary), "</p>",
        "</div>", renderStatusPill_("Load failed", "is-warn"), "</div>",
        "<div class=\"central-admin-page-body\">",
        renderAdminNote_(adminState.bulletinError),
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"refresh-bulletin\">Try Again</button>",
        "</div></section>",
      ].join("");
    }

    return [
      "<section class=\"central-admin-panel central-admin-bulletin-panel\">",
      "<div class=\"central-admin-panel-header\"><div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>", renderStatusPill_("2-up duplex", "is-safe"), "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Paper", "US Letter landscape"),
      renderInlineMeta_("Duplex", "Flip on short edge"),
      renderInlineMeta_("Cut", "Center line"),
      "</div>",
      adminState.bulletinMessage ?
        renderAdminNote_(adminState.bulletinMessage) :
        "",
      adminState.bulletinError ?
        "<p class=\"central-admin-note\">" +
          escapeHtml_(adminState.bulletinError) + "</p>" :
        "",
      renderBulletinSettingsEditor_(canSave),
      renderBulletinContentEditor_(canSave),
      "<div class=\"central-admin-action-row central-admin-bulletin-actions\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-bulletin\"",
      !canSave || adminState.bulletinSaving ? " disabled" : "",
      ">",
      adminState.bulletinSaving ? "Saving..." : "Save Bulletin Settings",
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"print-bulletin\">Print / Save PDF</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"refresh-bulletin\">Refresh Central Content</button>",
      "</div>",
      renderAdminNote_(
          "In the print dialog, choose two-sided printing, flip on the short edge, and 100% scale. Save as PDF uses the same imposed layout.",
      ),
      renderBulletinPreview_(),
      "</div></section>",
    ].join("");
  }

  function renderBulletinSettingsEditor_(canSave) {
    var giving = adminState.bulletinDraft.giving || {};
    var headings = adminState.bulletinDraft.headings || {};

    return [
      "<div class=\"central-admin-bulletin-editor-grid central-admin-bulletin-settings-grid\">",
      "<div class=\"central-admin-item central-admin-bulletin-headings\">",
      "<div class=\"central-admin-item-header\"><strong>Page Headings</strong>",
      renderStatusPill_(canSave ? "Editable" : "Read only", canSave ? "is-safe" : "is-warn"),
      "</div>",
      "<div class=\"central-admin-form-grid central-admin-bulletin-heading-fields\">",
      renderAdminTextareaField_({
        label: "Front Page Heading",
        field: "bulletin.headings.frontHeading",
        value: headings.frontHeading,
        rows: 2,
        maxLength: 80,
        wide: true,
        hint: "Use a line break to control where the printed heading wraps.",
      }),
      renderAdminInputField_({
        label: "Back Page Eyebrow",
        field: "bulletin.headings.backEyebrow",
        value: headings.backEyebrow,
        maxLength: 50,
      }),
      renderAdminInputField_({
        label: "Back Page Heading",
        field: "bulletin.headings.backHeading",
        value: headings.backHeading,
        maxLength: 80,
      }),
      "</div></div>",
      "<div class=\"central-admin-item central-admin-bulletin-settings\">",
      "<div class=\"central-admin-item-header\"><strong>Bulletin Details</strong>",
      renderStatusPill_(canSave ? "Admin only" : "Read only", canSave ? "is-safe" : "is-warn"),
      "</div>",
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "Sunday Date",
        field: "bulletin.serviceDate",
        value: adminState.bulletinDraft.serviceDate,
        type: "date",
      }),
      renderBulletinMoneyInput_("Monthly Budget", "monthlyBudget", giving.monthlyBudget),
      renderBulletinMoneyInput_("Month-to-Date Giving", "monthToDateGiving", giving.monthToDateGiving),
      renderBulletinMoneyInput_("Annual Budget", "annualBudget", giving.annualBudget),
      renderBulletinMoneyInput_("Year-to-Date Giving", "yearToDateGiving", giving.yearToDateGiving),
      "</div></div>",
      "</div>",
    ].join("");
  }

  function renderBulletinMoneyInput_(label, fieldName, value) {
    return renderAdminInputField_({
      label: label,
      field: "bulletin.giving." + fieldName,
      value: String(value || ""),
      type: "number",
      placeholder: "0",
    });
  }

  function renderBulletinContentEditor_(canSave) {
    var data = adminState.bulletinCentralData || {};
    var featured = getBulletinFeaturedEvent_();
    var manualHeroIsActive = isBulletinManualHeroActive_();
    var events = getBulletinEventDraftsInWindow_();
    var visibleEvents = getFilteredBulletinEventDrafts_(events);
    var selectedEventCount = events.filter(function(item) {
      return item.included;
    }).length;
    var weekOneCount = events.filter(function(item) {
      return getBulletinEventWeek_(item) === "week1";
    }).length;
    var weekTwoCount = events.length - weekOneCount;
    var campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
    var serveNeeds = Array.isArray(data.serveNeeds) ? data.serveNeeds : [];

    return [
      "<div class=\"central-admin-bulletin-editor-grid\">",
      "<div class=\"central-admin-item central-admin-bulletin-hero-editor\">",
      "<div class=\"central-admin-item-header\"><strong>Main Hero</strong>",
      renderStatusPill_(
          manualHeroIsActive ? "Manual Hero Active" : "PCO Featured Active",
          "is-safe",
      ),
      "</div>",
      renderBulletinHeroSourceToggle_(canSave, featured),
      manualHeroIsActive ?
        renderBulletinFallbackHeroEditor_(canSave, true) :
        renderBulletinFeaturedHeroEditor_(featured, canSave),
      "</div>",
      "<div class=\"central-admin-item central-admin-bulletin-front-content\">",
      "<div class=\"central-admin-item-header\"><strong>Front Page Content</strong>",
      renderStatusPill_("Live sources", "is-live"), "</div>",
      "<p class=\"central-admin-note\">Choose up to three campaigns and one Serve Opportunity for the printed front.</p>",
      "<div class=\"central-admin-bulletin-choice-list\">",
      campaigns.length ? campaigns.map(function(item) {
        var checked = adminState.bulletinDraft.campaignIds.indexOf(String(item.id || "")) !== -1;
        return renderBulletinChoice_(
            "campaign",
            item.id,
            item.title || "Untitled campaign",
            checked,
            false,
        );
      }).join("") : renderAdminNote_("No active campaigns are available."),
      "</div>",
      "<label class=\"central-admin-field is-select central-admin-bulletin-serve-select\"><span>Serve Opportunity</span>",
      "<select data-admin-field=\"bulletin.serveNeedId\"",
      canSave ? "" : " disabled", ">",
      "<option value=\"\">None</option>",
      serveNeeds.map(function(item) {
        var id = String(item.id || "");
        return "<option value=\"" + escapeAttr_(id) + "\"" +
          (adminState.bulletinDraft.serveNeedId === id ? " selected" : "") +
          ">" + escapeHtml_(item.need || item.title || "Untitled need") +
          "</option>";
      }).join(""),
      "</select></label>",
      "</div>",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\"><strong>Next Two Weeks</strong>",
      renderStatusPill_(
          String(selectedEventCount) + " selected · " +
          String(events.length) + " available",
          selectedEventCount ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          "Week 1 is the default print selection for new bulletins. Week 2 stays available for events that need more advance notice. Featured Event is excluded automatically.",
      ),
      events.length ?
        renderBulletinEventFilterBar_(
            events.length,
            weekOneCount,
            weekTwoCount,
            selectedEventCount,
        ) +
        (visibleEvents.length ?
          "<div class=\"central-admin-bulletin-events-grid\">" +
            visibleEvents.map(renderBulletinEventEditor_).join("") +
          "</div>" :
          renderAdminNote_("No events match this view.")) :
        renderAdminNote_("No non-featured Central events fall in this bulletin window."),
      "</div>",
    ].join("");
  }

  function renderBulletinFeaturedHeroEditor_(featured, canSave) {
    if (!featured) {
      return renderAdminNote_(
          "No Featured Event is currently available from Planning Center. Bulletin Mode is safely using the Manual Hero.",
      );
    }

    return [
      "<div class=\"central-admin-bulletin-active-hero-editor\">",
      "<p class=\"central-admin-note\">The current Planning Center Featured Event is selected for this bulletin.</p>",
      renderAdminInputField_({
        label: "Printed Title",
        field: "bulletin.featured.title",
        value: featured.title,
        maxLength: 180,
        disabled: !canSave,
      }),
      renderAdminTextareaField_({
        label: "Printed Description",
        field: "bulletin.featured.description",
        value: featured.description,
        rows: 3,
        maxLength: 1200,
        disabled: !canSave,
        hint: "Formatting: **bold**, *italics*, headings, and - or 1. lists. Line breaks are preserved.",
      }),
      renderAdminCheckboxField_({
        label: "Include full description",
        field: "bulletin.featured.includeDescription",
        checked: featured.includeDescription,
        disabled: !canSave,
      }),
      "</div>",
    ].join("");
  }

  function renderBulletinHeroSourceToggle_(canSave, featured) {
    var selectedSource = adminState.bulletinDraft.heroSource === "manual" ?
      "manual" : "featured";

    return [
      "<fieldset class=\"central-admin-bulletin-hero-source\">",
      "<legend>Hero Source</legend>",
      "<label class=\"",
      selectedSource === "featured" ? "is-active" : "",
      featured ? "" : " is-unavailable",
      "\"><input type=\"radio\" name=\"bulletin-hero-source\" value=\"featured\" data-admin-field=\"bulletin.heroSource\"",
      selectedSource === "featured" ? " checked" : "",
      !canSave ? " disabled" : "",
      "><span><strong>PCO Featured Event</strong><small>",
      featured ? "Use the current Featured Event from Planning Center." :
        "Unavailable right now; Manual Hero will be used as a fallback.",
      "</small></span></label>",
      "<label class=\"",
      selectedSource === "manual" ? "is-active" : "",
      "\"><input type=\"radio\" name=\"bulletin-hero-source\" value=\"manual\" data-admin-field=\"bulletin.heroSource\"",
      selectedSource === "manual" ? " checked" : "",
      !canSave ? " disabled" : "",
      "><span><strong>Manual Hero</strong><small>Use the editable message and uploaded image below.</small></span></label>",
      "</fieldset>",
    ].join("");
  }

  function renderBulletinFallbackHeroEditor_(canSave, manualHeroIsActive) {
    var fallback = adminState.bulletinDraft.fallbackHero || {};
    var imageUrl = getBulletinFallbackImageUrl_(fallback.imageUrl);

    return [
      "<div class=\"central-admin-bulletin-fallback-editor\">",
      "<div class=\"central-admin-bulletin-fallback-heading\"><div>",
      "<strong>Manual Hero</strong>",
      "<small>",
      "Currently filling the front-page hero.",
      "</small></div>",
      renderStatusPill_(manualHeroIsActive ? "In use" : "Standby", "is-live"),
      "</div>",
      "<div class=\"central-admin-bulletin-fallback-fields\">",
      renderAdminInputField_({
        label: "Eyebrow",
        field: "bulletin.fallbackHero.eyebrow",
        value: fallback.eyebrow,
        maxLength: 80,
        disabled: !canSave,
      }),
      renderAdminInputField_({
        label: "Title",
        field: "bulletin.fallbackHero.title",
        value: fallback.title,
        maxLength: 180,
        disabled: !canSave,
      }),
      renderAdminTextareaField_({
        label: "Welcome Message",
        field: "bulletin.fallbackHero.description",
        value: fallback.description,
        rows: 4,
        maxLength: 1200,
        wide: true,
        disabled: !canSave,
        hint: "Formatting: **bold**, *italics*, headings, and lists. Line breaks are preserved.",
      }),
      "</div>",
      "<div class=\"central-admin-bulletin-image-editor",
      imageUrl ? " has-image" : "",
      "\">",
      imageUrl ? [
        "<img src=\"", escapeAttr_(imageUrl),
        "\" alt=\"Current evergreen welcome graphic\">",
      ].join("") :
        "<div class=\"central-admin-bulletin-image-placeholder\">Optional welcome graphic</div>",
      "<div class=\"central-admin-bulletin-image-actions\">",
      "<label class=\"central-admin-link-button is-secondary central-admin-file-button",
      adminState.bulletinImageUploading ? " is-disabled" : "",
      "\"><span>",
      adminState.bulletinImageUploading ? "Uploading..." :
        (imageUrl ? "Replace image" : "Upload image"),
      "</span><input type=\"file\" accept=\"image/jpeg,image/png,image/webp\" data-admin-bulletin-fallback-image",
      !canSave || adminState.bulletinImageUploading ? " disabled" : "",
      "></label>",
      imageUrl ? [
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"remove-bulletin-fallback-image\"",
        !canSave || adminState.bulletinImageUploading ? " disabled" : "",
        ">Remove image</button>",
      ].join("") : "",
      "<small>JPEG, PNG, or WebP up to 10 MB. The file is stored in the Central Firebase Storage bucket.</small>",
      "</div></div></div>",
    ].join("");
  }

  function renderBulletinEventFilterBar_(
      totalCount,
      weekOneCount,
      weekTwoCount,
      includedCount,
  ) {
    var filters = [
      {id: "week1", label: "Week 1", count: weekOneCount},
      {id: "week2", label: "Week 2", count: weekTwoCount},
      {id: "included", label: "Included", count: includedCount},
      {id: "all", label: "All 14 Days", count: totalCount},
    ];

    return [
      "<div class=\"central-admin-bulletin-event-toolbar\">",
      "<div class=\"central-admin-bulletin-event-filters\" role=\"group\" aria-label=\"Filter bulletin events\">",
      filters.map(function(filter) {
        var active = adminState.bulletinEventFilter === filter.id;
        return [
          "<button type=\"button\" class=\"central-admin-bulletin-filter",
          active ? " is-active" : "",
          "\" data-admin-action=\"filter-bulletin-events\" data-admin-bulletin-filter=\"",
          escapeAttr_(filter.id), "\" aria-pressed=\"", active ? "true" : "false", "\">",
          escapeHtml_(filter.label), " <span>", String(filter.count), "</span></button>",
        ].join("");
      }).join(""),
      "</div>",
      "<div class=\"central-admin-bulletin-event-bulk\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"bulk-bulletin-events\" data-admin-bulletin-bulk=\"include\">Include All</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"bulk-bulletin-events\" data-admin-bulletin-bulk=\"exclude\">Exclude All</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"bulk-bulletin-events\" data-admin-bulletin-bulk=\"week1-default\">Reset to Week 1</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderBulletinChoice_(type, id, label, checked, radio) {
    return [
      "<label class=\"central-admin-checkbox\">",
      "<input type=\"", radio ? "radio" : "checkbox", "\" data-admin-bulletin-choice=\"",
      escapeAttr_(type), "\" data-admin-doc-id=\"", escapeAttr_(String(id || "")), "\"",
      checked ? " checked" : "", ">",
      "<span>", escapeHtml_(label), "</span></label>",
    ].join("");
  }

  function renderBulletinEventEditor_(item) {
    return [
      "<article class=\"central-admin-bulletin-event-editor",
      item.included ? "" : " is-excluded",
      "\">",
      "<div class=\"central-admin-bulletin-event-top\">",
      "<div class=\"central-admin-bulletin-event-schedule\">",
      "<span class=\"central-admin-bulletin-event-date\">",
      escapeHtml_(item.date || "Date unavailable"),
      "</span>",
      "<strong>", escapeHtml_(item.time || "Time unavailable"), "</strong>",
      item.location ? "<small>" + escapeHtml_(item.location) + "</small>" : "",
      "</div>",
      renderBulletinChoice_("event", item.id, "Include", item.included, false),
      "</div>",
      "<div class=\"central-admin-bulletin-event-copy\">",
      "<h4>", escapeHtml_(item.title || "Untitled Event"), "</h4>",
      item.description ?
        "<p>" + escapeHtml_(item.description) + "</p>" :
        "<p class=\"is-empty\">No description from Planning Center.</p>",
      "</div>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary central-admin-bulletin-event-edit\" data-admin-action=\"edit-bulletin-event\" data-admin-bulletin-event-id=\"",
      escapeAttr_(item.id), "\">Edit Print Copy</button>",
      "</article>",
    ].join("");
  }

  function renderBulletinPreview_() {
    return [
      "<div class=\"central-admin-bulletin-preview-header\"><div>",
      "<span class=\"central-admin-kicker\">Live Preview</span>",
      "<h3>Half-letter insert</h3>",
      "</div>", renderStatusPill_("Front + Back", "is-safe"), "</div>",
      "<div class=\"central-admin-bulletin-preview-grid\">",
      renderBulletinPanel_("front", true),
      renderBulletinPanel_("back", true),
      "</div>",
    ].join("");
  }

  function renderBulletinPrintRoot_() {
    return [
      "<div class=\"central-bulletin-print-root\" aria-hidden=\"true\">",
      "<section class=\"central-bulletin-sheet central-bulletin-sheet-front\">",
      renderBulletinPanel_("front", false),
      renderBulletinPanel_("front", false),
      "</section>",
      "<section class=\"central-bulletin-sheet central-bulletin-sheet-back\">",
      renderBulletinPanel_("back", false),
      renderBulletinPanel_("back", false),
      "</section></div>",
    ].join("");
  }

  function renderBulletinPanel_(side, preview) {
    var className = "central-bulletin-panel central-bulletin-panel-" + side;
    if (preview) {
      className += " is-preview";
    }

    return [
      "<article class=\"", className, "\">",
      side === "front" ? renderBulletinFront_() : renderBulletinBack_(),
      "</article>",
    ].join("");
  }

  function renderBulletinFront_() {
    var hero = getBulletinFrontHero_();
    var heroImageUrl = hero.source === "featured" ?
      getBulletinFeaturedImageUrl_(hero) :
      getBulletinFallbackImageUrl_(hero.image_url);
    var campaigns = getSelectedBulletinCampaigns_();
    var serveNeed = getSelectedBulletinServeNeed_();
    var giving = adminState.bulletinDraft.giving || {};
    var headings = adminState.bulletinDraft.headings || {};

    return [
      renderBulletinBrandHeader_(),
      "<div class=\"central-bulletin-heading\"><h1>",
      renderBulletinHeadingText_(headings.frontHeading),
      "</h1></div>",
      hero ? [
        "<section class=\"central-bulletin-card central-bulletin-featured\">",
        heroImageUrl ? [
          "<div class=\"central-bulletin-featured-media\">",
          "<img src=\"", escapeAttr_(heroImageUrl),
          "\" alt=\"\"></div>",
        ].join("") : "",
        "<span class=\"central-bulletin-label\">", escapeHtml_(hero.eyebrow), "</span>",
        "<h2>", escapeHtml_(hero.title), "</h2>",
        hero.source === "featured" && hero.doors_open_time ? "<p class=\"central-bulletin-featured-time\">Doors Open " + escapeHtml_(hero.doors_open_time) + "</p>" : "",
        hero.source === "featured" ?
          "<p class=\"central-bulletin-featured-time\">" +
            escapeHtml_([hero.date, hero.time].filter(Boolean).join(" - ")) +
          "</p>" : "",
        hero.includeDescription && hero.description ?
          "<div class=\"central-bulletin-description central-bulletin-body-copy central-bulletin-markdown\">" +
            renderAdminMarkdownLite_(hero.description) + "</div>" :
          "",
        "</section>",
      ].join("") : "",
      campaigns.length ? [
        "<section class=\"central-bulletin-card central-bulletin-campaigns\"><span class=\"central-bulletin-label\">Current Campaigns</span>",
        campaigns.map(function(item) {
          return "<div class=\"central-bulletin-campaign\"><span class=\"central-bulletin-campaign-icon\">+</span><div><strong>" +
            escapeHtml_(item.title || "Campaign") + "</strong>" +
            (item.description ? "<p class=\"central-bulletin-body-copy\">" +
              escapeHtml_(item.description) + "</p>" : "") +
            "</div></div>";
        }).join(""),
        "</section>",
      ].join("") : "",
      serveNeed ? [
        "<section class=\"central-bulletin-card central-bulletin-serve\"><div><span class=\"central-bulletin-label\">Serve Opportunity</span><h3>",
        escapeHtml_(serveNeed.need || serveNeed.title || "Serve at CrossPointe"),
        "</h3>", serveNeed.description ?
          "<p class=\"central-bulletin-body-copy\">" +
            escapeHtml_(serveNeed.description) + "</p>" : "", "</div>",
        "<span class=\"central-bulletin-serve-cta\">Learn more at<br><strong>central.crosspointe.tv</strong></span></section>",
      ].join("") : "",
      "<section class=\"central-bulletin-card central-bulletin-giving\"><span class=\"central-bulletin-label\">Generosity</span>",
      "<div class=\"central-bulletin-giving-grid\">",
      renderBulletinGivingStat_("Monthly Budget", giving.monthlyBudget),
      renderBulletinGivingStat_("MTD Giving", giving.monthToDateGiving),
      renderBulletinGivingStat_("Annual Budget", giving.annualBudget),
      renderBulletinGivingStat_("YTD Giving", giving.yearToDateGiving),
      "</div><p class=\"central-bulletin-giving-link\">Give securely at <strong>crosspointe.tv/give</strong></p></section>",
    ].join("");
  }

  function renderBulletinGivingStat_(label, value) {
    return "<div><span>" + escapeHtml_(label) + "</span><strong>" +
      escapeHtml_(formatBulletinCurrency_(value)) + "</strong></div>";
  }

  function renderBulletinBack_() {
    var events = getBulletinEventDraftsInWindow_().filter(function(item) {
      return item.included;
    });
    var eventGroups = groupBulletinEventsByDate_(events);
    var eventColumns = splitBulletinEventGroupsIntoColumns_(eventGroups);
    var leftGroups = eventColumns.left;
    var rightGroups = eventColumns.right;
    var maxRows = Math.max(
        countBulletinEventsInGroups_(leftGroups),
        countBulletinEventsInGroups_(rightGroups),
    );
    var densityClass = getBulletinEventDensityClass_(maxRows);
    var serviceDate = parseBulletinDate_(adminState.bulletinDraft.serviceDate);
    var endDate = new Date(serviceDate.getTime());
    var headings = adminState.bulletinDraft.headings || {};
    endDate.setUTCDate(endDate.getUTCDate() + 13);

    return [
      "<div class=\"central-bulletin-back-heading\"><span class=\"central-bulletin-label\">",
      escapeHtml_(headings.backEyebrow), "</span>",
      "<h1>", renderBulletinHeadingText_(headings.backHeading), "</h1><strong>",
      escapeHtml_(formatBulletinDateRange_(serviceDate, endDate)),
      "</strong></div>",
      "<div class=\"central-bulletin-event-columns",
      densityClass, "\"><div>",
      leftGroups.map(renderBulletinPrintEventGroup_).join(""),
      "</div><div>",
      rightGroups.map(renderBulletinPrintEventGroup_).join(""),
      "</div></div>",
      "<section class=\"central-bulletin-back-cta\"><img class=\"central-bulletin-qr\" src=\"/central-bulletin-qr.png\" alt=\"QR code for central.crosspointe.tv\"><div>",
      "<span class=\"central-bulletin-label\">Full Details + Next Steps</span>",
      "<p>Visit <strong>central.crosspointe.tv</strong></p>",
      "<small>Times, locations, and events are subject to change. Visit the website for updates.</small>",
      "</div></section>",
    ].join("");
  }

  function getBulletinEventDensityClass_(maxRows) {
    if (maxRows > 10) {
      return " is-fitted is-overflow-density";
    }
    if (maxRows > 8) {
      return " is-fitted is-max-density";
    }
    if (maxRows > 6) {
      return " is-fitted is-ultra-dense";
    }
    if (maxRows > 4) {
      return " is-fitted is-stretched is-dense";
    }
    return " is-fitted is-stretched";
  }

  function groupBulletinEventsByDate_(events) {
    var groups = [];
    var groupsByDate = Object.create(null);

    (Array.isArray(events) ? events : []).forEach(function(item) {
      var dateKey = String(item && item.date || "");
      var group = groupsByDate[dateKey];

      if (!group) {
        group = {date: dateKey, events: []};
        groupsByDate[dateKey] = group;
        groups.push(group);
      }

      group.events.push(item);
    });

    return groups;
  }

  function countBulletinEventsInGroups_(groups) {
    return (Array.isArray(groups) ? groups : [])
        .reduce(function(total, group) {
          return total + (Array.isArray(group.events) ? group.events.length : 0);
        }, 0);
  }

  function splitBulletinEventGroupsIntoColumns_(groups) {
    var items = Array.isArray(groups) ? groups : [];
    if (items.length < 2) {
      return {left: items.slice(), right: []};
    }

    var weights = items.map(getBulletinEventGroupLayoutWeight_);
    var totalWeight = weights.reduce(function(total, weight) {
      return total + weight;
    }, 0);
    var leftWeight = 0;
    var bestIndex = 1;
    var bestDifference = Infinity;

    for (var index = 1; index < items.length; index += 1) {
      leftWeight += weights[index - 1];
      var difference = Math.abs(totalWeight - (leftWeight * 2));
      if (difference < bestDifference) {
        bestDifference = difference;
        bestIndex = index;
      }
    }

    return {
      left: items.slice(0, bestIndex),
      right: items.slice(bestIndex),
    };
  }

  function getBulletinEventLayoutWeight_(item) {
    var source = item || {};
    var titleLines = Math.max(1, Math.ceil(String(source.title || "").length / 25));
    var metaLength = String(source.time || "").length +
      String(source.location || "").length;
    var metaLines = Math.max(1, Math.ceil(metaLength / 31));
    var descriptionLines = source.includeDescription && source.description ?
      Math.ceil(String(source.description).length / 42) :
      0;

    return 3 + (titleLines * 1.35) + metaLines + (descriptionLines * 0.9);
  }

  function getBulletinEventEntryLayoutWeight_(item) {
    return Math.max(
        1,
        Math.min(2.4, getBulletinEventLayoutWeight_(item) / 4.5),
    );
  }

  function getBulletinEventGroupLayoutWeight_(group) {
    return (Array.isArray(group && group.events) ? group.events : [])
        .reduce(function(total, item) {
          return total + getBulletinEventEntryLayoutWeight_(item);
        }, 0);
  }

  function renderBulletinPrintEventGroup_(group) {
    var events = Array.isArray(group && group.events) ? group.events : [];
    var date = parseBulletinDate_(group.date);
    var weekday = new Intl.DateTimeFormat("en-US", {timeZone: "UTC", weekday: "short"}).format(date).toUpperCase();
    var month = new Intl.DateTimeFormat("en-US", {timeZone: "UTC", month: "short"}).format(date).toUpperCase();
    var day = String(date.getUTCDate());
    var hasDescription = events.some(function(item) {
      return item.includeDescription && String(item.description || "").trim();
    });
    var eventClass = "central-bulletin-event " +
      (hasDescription ? "has-description" : "is-compact") +
      (events.length > 1 ? " is-grouped" : "");
    var layoutWeight = Math.max(
        1,
        getBulletinEventGroupLayoutWeight_(group),
    ).toFixed(2);

    return [
      "<article class=\"", eventClass,
      "\" style=\"--bulletin-event-weight:", layoutWeight, "\">",
      "<div class=\"central-bulletin-event-date\" aria-label=\"",
      escapeAttr_(group.date), "\"><span>", escapeHtml_(month),
      "</span><strong>", escapeHtml_(day), "</strong><small>",
      escapeHtml_(weekday), "</small></div>",
      "<div class=\"central-bulletin-event-copy\">",
      events.map(renderBulletinPrintEventEntry_).join(""),
      "</div></article>",
    ].join("");
  }

  function renderBulletinPrintEventEntry_(item) {
    var description = item.includeDescription && item.description ?
      String(item.description).trim() : "";
    var entryWeight = getBulletinEventEntryLayoutWeight_(item).toFixed(2);

    return [
      "<section class=\"central-bulletin-event-entry",
      description ? " has-description" : " is-compact",
      "\" style=\"--bulletin-entry-weight:", entryWeight, "\">",
      "<p class=\"central-bulletin-event-meta\">",
      item.time ? [
        "<span class=\"central-bulletin-event-meta-time\">",
        escapeHtml_(item.time), "</span>",
      ].join("") : "",
      item.location ? [
        "<span class=\"central-bulletin-event-meta-location\">",
        escapeHtml_(item.location), "</span>",
      ].join("") : "",
      "</p><h3>", escapeHtml_(item.title), "</h3>",
      description ?
        "<div class=\"central-bulletin-event-description central-bulletin-body-copy central-bulletin-markdown\">" +
          renderAdminMarkdownLite_(description) + "</div>" :
        "",
      "</section>",
    ].join("");
  }

  function renderBulletinBrandHeader_() {
    return [
      "<header class=\"central-bulletin-brand-header\"><div class=\"central-bulletin-brand\">",
      "<img src=\"/favicon.svg\" alt=\"\"><div><strong>CrossPointe</strong><span>Central</span></div></div>",
      "<strong class=\"central-bulletin-sunday-date\">Sunday, ",
      escapeHtml_(formatBulletinLongDate_(adminState.bulletinDraft.serviceDate)),
      "</strong></header>",
    ].join("");
  }

  function renderHubPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Source", "/api/central-data"),
      renderInlineMeta_("Publish Target", PUBLISHED_HUB_SETTINGS_DOC_PATH),
      renderInlineMeta_(
          "Public behavior",
          "Changes here update the published Firestore content Central is using right now.",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Hub starts from the current published values Central is showing right now. Direct publishers can publish immediately, while request-level users submit their edits for approval.",
      ),
      adminState.hubLoading ?
        renderAdminNote_("Loading the current Hub values.") :
        "",
      adminState.hubLoadError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.hubLoadError) +
        "</p>" :
        "",
      "</div>",
      renderHubSettingsEditor_(),
      renderHubSundayEditor_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderHubSettingsEditor_() {
    var permission = getPageAccessLevel_("hub");
    var canEdit = canEditHubSettings_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.hubSettingsDraft || createEmptyHubSettingsDraft_();
    var actionDisabled = !canEdit ||
      adminState.hubSettingsPublishing ||
      adminState.hubLoading;

    return renderCollapsibleAdminSection_({
      id: "hub-homepage",
      title: "Homepage",
      pillHtml: renderStatusPill_(
          !canEdit ?
            "Read only" :
            (actionConfig.mode === "submit" ?
              "Approval required" :
              "Can publish"),
          !canEdit ?
            "is-warn" :
            (actionConfig.mode === "submit" ? "is-live" : "is-safe"),
      ),
      bodyHtml: [
      renderAdminNote_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "These homepage edits stay local until you submit them for approval. An admin can then review them in the Change Requests page." :
              "These homepage edits can publish directly to preview from this page.") :
            "Your current permission level does not allow editing the homepage.",
      ),
      adminState.hubSettingsMessage ?
        renderAdminNote_(adminState.hubSettingsMessage) :
        "",
      adminState.hubSettingsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.hubSettingsError) +
        "</p>" :
        "",
      renderAdminCheckboxField_({
        label: "Show the Central Featured event in the homepage hero",
        field: "hub-settings.featured_event_enabled",
        checked: draft.featured_event_enabled,
        disabled: !canEdit,
      }),
      renderAdminNote_(
          "When enabled, the next Planning Center event tagged Central and Central Featured replaces the Sunday countdown. A valid event image is required; otherwise Central keeps the countdown visible.",
      ),
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "Site Title",
        field: "hub-settings.site_title",
        value: draft.site_title,
        placeholder: "CrossPointe Central",
        maxLength: 60,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Hero Heading",
        field: "hub-settings.hero_heading",
        value: draft.hero_heading,
        placeholder: "Your hub for everything CrossPointe",
        maxLength: 90,
        disabled: !canEdit,
      }),
      renderAdminTextareaField_({
        label: "Hero Subheading",
        field: "hub-settings.hero_subheading",
        value: draft.hero_subheading,
        placeholder: "A short line that explains what Central helps people do.",
        rows: 3,
        wide: true,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Primary Button Text",
        field: "hub-settings.primary_button_text",
        value: draft.primary_button_text,
        placeholder: "Open Church Center",
        maxLength: 40,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Primary Button URL",
        field: "hub-settings.primary_button_url",
        value: draft.primary_button_url,
        placeholder: "https://crosspointe.tv",
        type: "text",
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Secondary Button Text",
        field: "hub-settings.secondary_button_text",
        value: draft.secondary_button_text,
        placeholder: "Watch Live",
        maxLength: 40,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Secondary Button URL",
        field: "hub-settings.secondary_button_url",
        value: draft.secondary_button_url,
        placeholder: "https://live.crosspointe.tv",
        type: "text",
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Countdown Label",
        field: "hub-settings.countdown_label",
        value: draft.countdown_label,
        placeholder: "Next Up",
        maxLength: 40,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Countdown Title",
        field: "hub-settings.countdown_title",
        value: draft.countdown_title,
        placeholder: "Sunday Worship",
        maxLength: 60,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Countdown Date & Time",
        field: "hub-settings.countdown_datetime",
        value: draft.countdown_datetime,
        type: "datetime-local",
        disabled: !canEdit,
      }),
      "</div>",
      renderAdminNote_(
          "Leave the countdown date blank to automatically count down to next Sunday at 9:00 AM. If you set a future date here, that manual countdown stays in place until the event passes.",
      ),
      renderHubModuleManager_({
        section: HUB_HOMEPAGE_MODULE_SORT_SECTION,
        title: "Homepage Modules",
        items: draft.homepage_modules,
        canEdit: canEdit,
      }),
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-hub-settings\"",
      actionDisabled ? " disabled" : "",
      ">",
      adminState.hubSettingsPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-hub-settings\"",
      adminState.hubSettingsPublishing ||
      !canEdit ? " disabled" : "",
      ">Reset Changes</button>",
      "</div>",
      ].join(""),
    });
  }

  function renderHubSundayEditor_() {
    var permission = getHubSundayAccessLevel_();
    var canEdit = canEditHubSunday_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.hubSundayDraft || createEmptyHubSundayDraft_();
    var actionDisabled = !canEdit ||
      adminState.hubSundayPublishing ||
      adminState.hubLoading;

    return renderCollapsibleAdminSection_({
      id: "hub-sunday-mode",
      title: "Sunday Mode",
      pillHtml: renderStatusPill_(
          !canEdit ?
            "Read only" :
            (actionConfig.mode === "submit" ?
              "Approval required" :
              "Can publish"),
          !canEdit ?
            "is-warn" :
            (actionConfig.mode === "submit" ? "is-live" : "is-safe"),
      ),
      bodyHtml: [
      renderAdminNote_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "These Sunday Mode edits stay local until you submit them for approval. An admin can then review them in the Change Requests page." :
              "These Sunday Mode edits can publish directly to preview from this page.") :
            "Your current permission level does not allow editing Sunday Mode.",
      ),
      renderAdminNote_(
          "Force Sunday Mode, the livestream link and note, and the Bible ID now live on the Settings page so the Hub editor stays focused on homepage content.",
      ),
      adminState.hubSundayMessage ?
        renderAdminNote_(adminState.hubSundayMessage) :
        "",
      adminState.hubSundayError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.hubSundayError) +
        "</p>" :
        "",
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
          label: "Eyebrow",
          field: "hub-sunday.sunday_eyebrow",
          value: draft.sunday_eyebrow,
          placeholder: "Sunday Morning",
          maxLength: 40,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Heading",
          field: "hub-sunday.sunday_heading",
          value: draft.sunday_heading,
          placeholder: "Everything you need for this morning.",
          maxLength: 100,
          disabled: !canEdit,
        }),
        renderAdminTextareaField_({
          label: "Sunday Subheading",
          field: "hub-sunday.sunday_subheading",
          value: draft.sunday_subheading,
          placeholder: "Welcome to CrossPointe Sunday morning.",
          rows: 3,
          wide: true,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Primary Button Text",
          field: "hub-sunday.sunday_primary_button_text",
          value: draft.sunday_primary_button_text,
          placeholder: "Take Notes",
          maxLength: 40,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Primary Button URL",
          field: "hub-sunday.sunday_primary_button_url",
          value: draft.sunday_primary_button_url,
          placeholder: "#sermon-notes",
          type: "text",
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Secondary Button Text",
          field: "hub-sunday.sunday_secondary_button_text",
          value: draft.sunday_secondary_button_text,
          placeholder: "Watch Live",
          maxLength: 40,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Secondary Button URL",
          field: "hub-sunday.sunday_secondary_button_url",
          value: draft.sunday_secondary_button_url,
          placeholder: "https://live.crosspointe.tv",
          type: "text",
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Status Label",
          field: "hub-sunday.sunday_status_label",
          value: draft.sunday_status_label,
          placeholder: "Status",
          maxLength: 30,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Speaker Label",
          field: "hub-sunday.sunday_speaker_label",
          value: draft.sunday_speaker_label,
          placeholder: "Speaker",
          maxLength: 30,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Scripture Label",
          field: "hub-sunday.sunday_scripture_label",
          value: draft.sunday_scripture_label,
          placeholder: "Scripture",
          maxLength: 30,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Livestream Title",
          field: "hub-sunday.sunday_livestream_title",
          value: draft.sunday_livestream_title,
          placeholder: "Watch Live",
          maxLength: 50,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Scripture Reference",
          field: "hub-sunday.sunday_scripture_reference",
          value: draft.sunday_scripture_reference,
          placeholder: "John 3:16",
          maxLength: 40,
          disabled: !canEdit,
        }),
        renderAdminInputField_({
          label: "Scripture Card Title",
          field: "hub-sunday.sunday_scripture_title",
          value: draft.sunday_scripture_title,
          placeholder: "Bible Reader",
          maxLength: 50,
          disabled: !canEdit,
        }),
        renderAdminTextareaField_({
          label: "Scripture Helper Text",
          field: "hub-sunday.sunday_scripture_helper_text",
          value: draft.sunday_scripture_helper_text,
          placeholder: "Optional helper copy for the scripture reader card.",
          rows: 3,
          wide: true,
          disabled: !canEdit,
        }),
      "</div>",
      renderHubModuleManager_({
        section: HUB_SUNDAY_MODULE_SORT_SECTION,
        title: "Sunday Mode Modules",
        items: draft.sunday_modules,
        canEdit: canEdit,
      }),
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-hub-sunday\"",
      actionDisabled ? " disabled" : "",
      ">",
      adminState.hubSundayPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-hub-sunday\"",
      adminState.hubSundayPublishing ||
      !canEdit ? " disabled" : "",
      ">Reset Changes</button>",
      "</div>",
      ].join(""),
    });
  }

  function renderSundayPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Source", "/api/central-data"),
      renderInlineMeta_("Publish Target", PUBLISHED_THIS_SUNDAY_DOC_PATH),
      renderInlineMeta_(
          "Public behavior",
          "Blank series, speaker, scripture, and notes stay hidden automatically on the Sunday page.",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Sunday starts from what Central is showing right now. The date defaults to the current Sunday if today is Sunday, otherwise the next upcoming Sunday, and you can override it any time.",
      ),
      adminState.sundayLoading ?
        renderAdminNote_("Loading the current Sunday values.") :
        "",
      "</div>",
      renderSundayEditor_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderSundayEditor_() {
    var permission = getThisSundayAccessLevel_();
    var canEdit = canEditThisSunday_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.sundayDraft || createEmptySundayDraft_();
    var actionDisabled = !canEdit ||
      adminState.sundayPublishing ||
      adminState.sundayLoading;

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Sermon Information</strong>",
      renderStatusPill_(
          !canEdit ?
            "Read only" :
            (actionConfig.mode === "submit" ?
              "Approval required" :
              "Can publish"),
          !canEdit ?
            "is-warn" :
            (actionConfig.mode === "submit" ? "is-live" : "is-safe"),
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "These Sunday edits stay local until you submit them for approval. An admin can then review them in the Change Requests page." :
              "These Sunday edits can publish directly to preview from this page.") :
            "Your current permission level does not allow editing Sunday.",
      ),
      adminState.sundayMessage ?
        renderAdminNote_(adminState.sundayMessage) :
        "",
      adminState.sundayError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.sundayError) +
        "</p>" :
        "",
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "Sunday Date",
        field: "sunday.date_iso",
        value: draft.date_iso,
        type: "date",
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Series",
        field: "sunday.series",
        value: draft.series,
        placeholder: "Summer in Psalms",
        maxLength: 80,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Sermon Title",
        field: "sunday.sermon_title",
        value: draft.sermon_title,
        placeholder: "A Hope That Holds",
        maxLength: 100,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Speaker",
        field: "sunday.speaker",
        value: draft.speaker,
        placeholder: "Pastor Chris Todd",
        maxLength: 80,
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Scripture",
        field: "sunday.scripture",
        value: draft.scripture,
        placeholder: "Psalm 27",
        maxLength: 120,
        disabled: !canEdit,
      }),
      renderAdminTextareaField_({
        label: "Notes",
        field: "sunday.note",
        value: draft.note,
        placeholder: "Optional supporting copy that appears beneath the sermon details.",
        rows: 4,
        wide: true,
        disabled: !canEdit,
      }),
      "</div>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-sunday\"",
      actionDisabled ? " disabled" : "",
      ">",
      adminState.sundayPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-sunday\"",
      adminState.sundayPublishing ||
      !canEdit ? " disabled" : "",
      ">Reset Changes</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderSettingsPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Sunday Settings", PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH),
      renderInlineMeta_("Room Rules", PUBLISHED_ROOM_RULES_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          "These settings update the published Firestore controls Central is using right now.",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Operational controls", "is-live"),
      "</div>",
      renderAdminNote_(
          "Use Settings for the switches and rules that shape how the app behaves behind the scenes, while Hub stays focused on the homepage content itself.",
      ),
      adminState.settingsLoading ?
        renderAdminNote_("Loading the current settings and room rules.") :
        "",
      adminState.settingsLoadError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.settingsLoadError) +
        "</p>" :
        "",
      "</div>",
      renderSettingsSundayEditor_(),
      renderWayfinderAlphaSettings_(),
      renderRoomRulesEditor_(),
      renderRoomRulesWorkingList_(),
      renderAdminUsersManager_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderSettingsSundayEditor_() {
    var permission = getPageAccessLevel_("settings");
    var canEdit = canEditSettingsSunday_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.settingsSundayDraft || createEmptySettingsSundayDraft_();
    var actionDisabled = !canEdit ||
      adminState.settingsSundayPublishing ||
      adminState.settingsLoading;

    return renderCollapsibleAdminSection_({
      id: "settings-sunday-controls",
      title: "Sunday Controls",
      pillHtml: renderStatusPill_(
          !canEdit ?
            "Read only" :
            (actionConfig.mode === "submit" ?
              "Approval required" :
              "Can publish"),
          !canEdit ?
            "is-warn" :
            (actionConfig.mode === "submit" ? "is-live" : "is-safe"),
      ),
      bodyHtml: [
      renderAdminNote_(
          canEdit ?
            "Live and Dev have separate Sunday Mode controls. Changing one environment will not change the other. Service integrations now live on the Integrations page." :
            "Your current permission level does not allow editing Settings.",
      ),
      adminState.settingsSundayMessage ?
        renderAdminNote_(adminState.settingsSundayMessage) :
        "",
      adminState.settingsSundayError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.settingsSundayError) +
        "</p>" :
        "",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Live Page</strong>",
      renderStatusPill_("Production", "is-live"),
      "</div>",
      renderAdminNote_(
          "Controls the live Hosting page. Automatic follows the live Sunday window.",
      ),
      renderAdminSelectField_({
        label: "Live Sunday Mode Override",
        field: "settings-sunday.sunday_mode_override",
        value: draft.sunday_mode_override,
        options: SUNDAY_MODE_OVERRIDE_OPTIONS,
        disabled: !canEdit,
      }),
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "Live Sunday Mode Start",
        field: "settings-sunday.sunday_mode_start_time",
        value: draft.sunday_mode_start_time,
        type: "time",
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Live Sunday Mode End",
        field: "settings-sunday.sunday_mode_end_time",
        value: draft.sunday_mode_end_time,
        type: "time",
        disabled: !canEdit,
      }),
      "</div>",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Dev Preview</strong>",
      renderStatusPill_("Isolated", "is-safe"),
      "</div>",
      renderAdminNote_(
          "Controls the Firebase dev preview and the local emulator. Force On here is safe for testing and will not turn on Sunday Mode for the live page.",
      ),
      renderAdminSelectField_({
        label: "Dev Sunday Mode Override",
        field: "settings-sunday.dev_sunday_mode_override",
        value: draft.dev_sunday_mode_override,
        options: SUNDAY_MODE_OVERRIDE_OPTIONS,
        disabled: !canEdit,
      }),
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "Dev Sunday Mode Start",
        field: "settings-sunday.dev_sunday_mode_start_time",
        value: draft.dev_sunday_mode_start_time,
        type: "time",
        disabled: !canEdit,
      }),
      renderAdminInputField_({
        label: "Dev Sunday Mode End",
        field: "settings-sunday.dev_sunday_mode_end_time",
        value: draft.dev_sunday_mode_end_time,
        type: "time",
        disabled: !canEdit,
      }),
      "</div>",
      "</div>",
      "</div>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-settings-sunday\"",
      actionDisabled ? " disabled" : "",
      ">",
      adminState.settingsSundayPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-settings-sunday\"",
      adminState.settingsSundayPublishing ||
      !canEdit ? " disabled" : "",
      ">Reset Changes</button>",
      "</div>",
      ].join(""),
    });
  }

  function renderWayfinderAlphaSettings_() {
    var permission = getPageAccessLevel_("wayfinder");
    var canAdmin = permission === "admin";
    var enabled = adminState.wayfinderAlphaEnabled === true;
    return renderCollapsibleAdminSection_({
      id: "settings-wayfinder-alpha",
      title: "Wayfinder Staff Alpha",
      pillHtml: renderStatusPill_(
          enabled ? "Enabled" : "Disabled",
          enabled ? "is-safe" : "is-warn",
      ),
      bodyHtml: [
        renderAdminNote_(
            enabled ?
              "Wayfinder is visible only to signed-in Central users who have User or Admin Wayfinder permission." :
              "Wayfinder is hidden from everyone on the public Central page, including staff testers.",
        ),
        renderAdminNote_(
            "User permission allows alpha testing. Admin permission also unlocks Alohomora and Colloportus update mode.",
        ),
        adminState.wayfinderAlphaMessage ?
          renderAdminNote_(adminState.wayfinderAlphaMessage) : "",
        adminState.wayfinderAlphaError ?
          "<p class=\"central-admin-note\">" +
            escapeHtml_(adminState.wayfinderAlphaError) + "</p>" : "",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button ",
        enabled ? "is-secondary" : "is-primary",
        "\" data-admin-action=\"toggle-wayfinder-alpha\" data-wayfinder-enabled=\"",
        enabled ? "true" : "false",
        "\"",
        (!canAdmin || adminState.wayfinderAlphaSaving) ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.wayfinderAlphaSaving ?
              "Saving..." :
              (enabled ? "Disable Wayfinder" : "Enable Staff Alpha"),
        ),
        "</button>",
        "</div>",
        !canAdmin ?
          renderAdminNote_("Only a Wayfinder Admin can change this switch.") :
          "",
      ].join(""),
    });
  }

  function renderIntegrationsPagePanel_(currentPage) {
    var permission = getPageAccessLevel_("integrations");
    var canEdit = canEditIntegrations_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var actionDisabled = !canEdit ||
      adminState.integrationsPublishing ||
      adminState.settingsLoading;

    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_(
          "Published settings",
          PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH,
      ),
      renderInlineMeta_(
          "Public behavior",
          "Changes take effect after they are published.",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Connected services</strong>",
      renderStatusPill_(
          canEdit ? "Ready to configure" : "Read only",
          canEdit ? "is-live" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Manage the services Central connects to. Each section keeps one provider's settings together." :
            "Your current permission level does not allow editing Integrations.",
      ),
      adminState.settingsLoading ?
        renderAdminNote_("Loading the current integration settings.") :
        "",
      adminState.settingsLoadError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.settingsLoadError) +
        "</p>" :
        "",
      adminState.integrationsMessage ?
        renderAdminNote_(adminState.integrationsMessage) :
        "",
      adminState.integrationsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.integrationsError) +
        "</p>" :
        "",
      "</div>",
      renderGoogleCalendarIntegrationSection_(),
      renderResiIntegrationSection_(),
      renderYouVersionIntegrationSection_(),
      renderPlanningCenterIntegrationSection_(),
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-integrations\"",
      actionDisabled ? " disabled" : "",
      ">",
      adminState.integrationsPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-integrations\"",
      adminState.integrationsPublishing || !canEdit ? " disabled" : "",
      ">Reset Changes</button>",
      "</div>",
      "</div>",
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderWayfinderPagePanel_(currentPage) {
    var permission = getPageAccessLevel_("wayfinder");
    var hasAccess = isActiveAdminUserRecord_() && permission === "admin";
    var result = adminState.wayfinderResult;
    var permanentUpdateMode = adminState.wayfinderNoticeModeActive &&
      adminState.wayfinderAdminUpdateType === "permanent";
    var wayfinderUpdateBusy = adminState.wayfinderNoticeWorking ||
      adminState.wayfinderKnowledgeWorking;
    var exampleQuestions = [
      "What time are services?",
      "Do I have to dress up for church?",
      "Can my children stay with me during worship?",
      "How do I get baptized?",
      "When is the next Starting Pointe?",
      "What is the address for a home group?",
    ];

    return [
      "<section class=\"central-admin-panel wayfinder-lab\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_("Private prototype", "is-warn"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Access", "Wayfinder Admin permission"),
      renderInlineMeta_("Mode", "Grounded Gemini prototype"),
      "</div>",
      "<div class=\"wayfinder-lab-notice\">",
      "<span class=\"central-admin-kicker\">Lab mode</span>",
      "<div>",
      "<strong>Gemini is now behind the approved knowledge layer.</strong>",
      "<p>The backend finds approved information first, then gives only that information to Gemini. Fixed safety answers skip Gemini completely.</p>",
      "</div>",
      "</div>",
      hasAccess ? renderWayfinderFeaturedEventHealth_() : "",
      hasAccess ? renderWayfinderWebsiteIndex_() : "",
      hasAccess ? renderWayfinderEvaluations_() : "",
      hasAccess ? renderWayfinderFeedbackManager_() : "",
      hasAccess ? [
        "<div class=\"central-admin-item wayfinder-lab-question\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>",
        adminState.wayfinderNoticeModeActive ?
          "Create a Wayfinder update" : "Ask a test question",
        "</strong>",
        renderStatusPill_(
            adminState.wayfinderNoticeModeActive ?
              "Authenticated admin mode" : "Approved data only",
            "is-safe",
        ),
        "</div>",
        renderAdminTextareaField_({
          label: permanentUpdateMode ? "Permanent knowledge change" :
            adminState.wayfinderNoticeModeActive ?
              "Temporary update" : "Question",
          field: "wayfinder.question",
          value: adminState.wayfinderQuestion,
          placeholder: permanentUpdateMode ?
            "Example: The Care Center now requires an appointment." :
            adminState.wayfinderNoticeModeActive ?
            "Example: The Care Center is closed this Friday." :
            "Try: What should I expect on my first visit?",
          rows: 3,
          wide: true,
          disabled: adminState.wayfinderQuerying ||
            adminState.wayfinderGenerating ||
            wayfinderUpdateBusy,
        }),
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"generate-wayfinder-answer\"",
        adminState.wayfinderQuerying || adminState.wayfinderGenerating ||
          wayfinderUpdateBusy ?
          " disabled" : "",
        ">",
        wayfinderUpdateBusy ? "Processing update..." :
          adminState.wayfinderGenerating ? "Generating safely..." :
          permanentUpdateMode ? "Prepare Permanent Change" :
            adminState.wayfinderNoticeModeActive ?
            "Prepare Notice Preview" : "Generate Wayfinder answer",
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"run-wayfinder-query\"",
        adminState.wayfinderQuerying || adminState.wayfinderGenerating ||
          adminState.wayfinderNoticeModeActive ||
          wayfinderUpdateBusy ?
          " disabled" : "",
        ">",
        adminState.wayfinderQuerying ? "Checking knowledge..." :
          "Check knowledge only",
        "</button>",
        "</div>",
        "<div class=\"wayfinder-lab-examples\" aria-label=\"Example questions\">",
        exampleQuestions.map(function(question) {
          return [
            "<button type=\"button\" data-admin-action=\"try-wayfinder-question\" data-wayfinder-question=\"",
            escapeAttr_(question), "\"",
            adminState.wayfinderQuerying || adminState.wayfinderGenerating ||
              adminState.wayfinderNoticeModeActive ||
              wayfinderUpdateBusy ?
              " disabled" : "",
            ">", escapeHtml_(question), "</button>",
          ].join("");
        }).join(""),
        "</div>",
        "</div>",
        renderWayfinderNoticeAdmin_(),
        adminState.wayfinderError ? [
          "<div class=\"central-admin-item wayfinder-lab-error\" role=\"alert\">",
          "<strong>Wayfinder could not run that test.</strong>",
          "<p>", escapeHtml_(adminState.wayfinderError), "</p>",
          "</div>",
        ].join("") : "",
        adminState.wayfinderAnswerError ? [
          "<div class=\"central-admin-item wayfinder-lab-error\" role=\"alert\">",
          "<strong>Gemini could not produce a verified answer.</strong>",
          "<p>", escapeHtml_(adminState.wayfinderAnswerError), "</p>",
          "</div>",
        ].join("") : "",
        renderWayfinderGeneratedAnswer_(adminState.wayfinderAnswerResult),
        renderWayfinderPrototypeResult_(result),
      ].join("") : [
        "<div class=\"central-admin-empty\">",
        "<strong>Private lab access is required.</strong>",
        "<p>Sign in with an active Central admin account that can access Integrations.</p>",
        "</div>",
      ].join(""),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderWayfinderWebsiteIndex_() {
    var status = adminState.wayfinderWebsiteIndexStatus || {};
    var ready = status.status === "ready";
    var busy = adminState.wayfinderWebsiteIndexLoading ||
      adminState.wayfinderWebsiteIndexWorking;
    var completedAt = status.completedAt ?
      formatAdminTimestamp_(status.completedAt) : "Not indexed yet";

    return [
      "<section class=\"central-admin-item wayfinder-website-index\">",
      "<div class=\"central-admin-item-header\"><div>",
      "<strong>CrossPointe website index</strong>",
      "<p>Wayfinder can use approved public website pages as a supplemental source. Planning Center remains authoritative for events.</p>",
      "</div>",
      renderStatusPill_(
          busy ? "Working" : ready ? "Ready" : "Not indexed",
          busy ? "is-warn" : ready ? "is-safe" : "is-warn",
      ),
      "</div>",
      "<div class=\"wayfinder-website-index-stats\">",
      renderInlineMeta_("Pages", String(Number(status.pageCount) || 0)),
      renderInlineMeta_("Search chunks", String(Number(status.chunkCount) || 0)),
      renderInlineMeta_("Last refreshed", completedAt),
      "</div>",
      Number(status.failedPageCount) ? [
        "<p class=\"wayfinder-website-index-warning\">",
        escapeHtml_(String(status.failedPageCount)),
        " page(s) could not be read during the last refresh.</p>",
      ].join("") : "",
      adminState.wayfinderWebsiteIndexMessage ? [
        "<p class=\"wayfinder-notice-message\">",
        escapeHtml_(adminState.wayfinderWebsiteIndexMessage),
        "</p>",
      ].join("") : "",
      adminState.wayfinderWebsiteIndexError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Website index not updated.</strong><p>",
        escapeHtml_(adminState.wayfinderWebsiteIndexError),
        "</p></div>",
      ].join("") : "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"refresh-wayfinder-website-index\"",
      busy ? " disabled" : "",
      ">",
      adminState.wayfinderWebsiteIndexWorking ? "Refreshing website..." :
        "Refresh Website Index",
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"check-wayfinder-website-index\"",
      busy ? " disabled" : "",
      ">Check Status</button>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderWayfinderFeaturedEventHealth_() {
    var report = adminState.wayfinderFeaturedHealthReport || {};
    var events = Array.isArray(report.events) ? report.events : [];
    var busy = adminState.wayfinderFeaturedHealthLoading;
    var ready = report.status === "ready";
    var needsAttention = ready && Number(report.unmatchedCount) > 0;
    var checkedAt = report.checkedAt ?
      formatAdminTimestamp_(report.checkedAt) : "Not checked yet";

    return [
      "<section class=\"central-admin-item wayfinder-featured-health\">",
      "<div class=\"central-admin-item-header\"><div>",
      "<strong>Featured Event health</strong>",
      "<p>Compares the Featured Events on crosspointe.tv with Planning Center. Website titles are public-facing; Planning Center supplies schedule details.</p>",
      "</div>",
      renderStatusPill_(
          busy ? "Checking" : !ready ? "Unavailable" :
            needsAttention ? "Needs attention" : "Healthy",
          busy || !ready || needsAttention ? "is-warn" : "is-safe",
      ),
      "</div>",
      "<div class=\"wayfinder-website-index-stats\">",
      renderInlineMeta_("Featured", String(Number(report.featuredCount) || 0)),
      renderInlineMeta_("Matched", String(Number(report.matchedCount) || 0)),
      renderInlineMeta_(
          "Name differences",
          String(Number(report.nameDifferenceCount) || 0),
      ),
      renderInlineMeta_("Unmatched", String(Number(report.unmatchedCount) || 0)),
      renderInlineMeta_("Last checked", checkedAt),
      "</div>",
      adminState.wayfinderFeaturedHealthError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Featured Event check unavailable.</strong><p>",
        escapeHtml_(adminState.wayfinderFeaturedHealthError),
        "</p></div>",
      ].join("") : "",
      events.length ? [
        "<div class=\"wayfinder-featured-health-list\">",
        events.map(renderWayfinderFeaturedEventHealthItem_).join(""),
        "</div>",
      ].join("") : ready && !busy ?
        "<div class=\"central-admin-empty\"><strong>No featured events found.</strong><p>The website Featured Events section is currently empty.</p></div>" : "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"check-wayfinder-featured-events\"",
      busy ? " disabled" : "", ">",
      busy ? "Checking events..." : "Check Featured Events",
      "</button></div></section>",
    ].join("");
  }

  function renderWayfinderFeaturedEventHealthItem_(item) {
    var status = String(item.status || "unmatched");
    var matched = status === "matched";
    var differs = matched && item.nameDiffers;
    return [
      "<article class=\"wayfinder-featured-health-item is-",
      escapeAttr_(status), "\">",
      "<div class=\"central-admin-item-header\"><div>",
      "<span class=\"central-admin-kicker\">Website title</span>",
      "<h4>", escapeHtml_(item.websiteName), "</h4>",
      "</div>",
      renderStatusPill_(
          matched ? differs ? "Matched · name differs" : "Matched" :
            status === "unverified" ? "Not checked" : "No PCO match",
          matched ? differs ? "is-live" : "is-safe" : "is-warn",
      ),
      "</div>",
      differs ? [
        "<p><strong>Planning Center title:</strong> ",
        escapeHtml_(item.planningCenterName), "</p>",
      ].join("") : matched ?
        "<p>Planning Center uses the same event name.</p>" :
        "<p>Wayfinder will not present this as a verified event until it can be matched safely.</p>",
      item.planningCenterStartsAt ? [
        "<p><strong>Verified schedule:</strong> ",
        escapeHtml_(formatAdminTimestamp_(item.planningCenterStartsAt)),
        "</p>",
      ].join("") : "",
      "<div class=\"wayfinder-featured-health-links\">",
      item.websiteUrl ? "<a href=\"" + escapeAttr_(item.websiteUrl) +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">Website card</a>" : "",
      item.planningCenterUrl ? "<a href=\"" +
        escapeAttr_(item.planningCenterUrl) +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">Planning Center event</a>" : "",
      "</div></article>",
    ].join("");
  }

  function renderWayfinderFeedbackManager_() {
    var items = Array.isArray(adminState.wayfinderFeedbackItems) ?
      adminState.wayfinderFeedbackItems : [];
    var newItems = items.filter(function(item) {
      return item.rating === "needs_work" && item.status !== "reviewed";
    });
    var busy = adminState.wayfinderFeedbackLoading ||
      adminState.wayfinderFeedbackWorking;
    return [
      "<section class=\"central-admin-item wayfinder-feedback-manager\">",
      "<div class=\"central-admin-item-header\"><div>",
      "<strong>Wayfinder feedback</strong>",
      "<p>Test ratings help us find knowledge gaps and tune retrieval. They do not train Gemini.</p>",
      "</div>",
      renderStatusPill_(
          newItems.length + " to review",
          newItems.length ? "is-warn" : "is-safe",
      ),
      "</div>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"refresh-wayfinder-feedback\"",
      busy ? " disabled" : "", ">",
      adminState.wayfinderFeedbackLoading ? "Refreshing..." :
        "Refresh Feedback",
      "</button></div>",
      adminState.wayfinderFeedbackError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Feedback unavailable.</strong><p>",
        escapeHtml_(adminState.wayfinderFeedbackError), "</p></div>",
      ].join("") : "",
      adminState.wayfinderFeedbackLoading && !items.length ?
        "<p>Loading feedback...</p>" : "",
      items.length ? [
        "<div class=\"wayfinder-feedback-list\">",
        items.map(renderWayfinderFeedbackItem_).join(""),
        "</div>",
      ].join("") : adminState.wayfinderFeedbackLoaded ?
        "<div class=\"central-admin-empty\"><strong>No feedback yet.</strong><p>Use the public Wayfinder chat to begin rating test answers.</p></div>" : "",
      "</section>",
    ].join("");
  }

  function renderWayfinderEvaluations_() {
    var runs = Array.isArray(adminState.wayfinderEvaluationRuns) ?
      adminState.wayfinderEvaluationRuns : [];
    var latest = runs[0] || null;
    var busy = adminState.wayfinderEvaluationsLoading ||
      adminState.wayfinderEvaluationsRunning;
    var summary = latest && latest.summary || {};
    return [
      "<section class=\"central-admin-item wayfinder-evaluations\">",
      "<div class=\"central-admin-item-header\"><div>",
      "<strong>Automated answer check</strong>",
      "<p>Each run draws one question from five categories. Questions do not repeat until their category's shuffle bag has been used.</p>",
      "</div>",
      latest ? renderStatusPill_(
          String(Number(summary.pass) || 0) + " passed · " +
          String(Number(summary.warning) || 0) + " warnings · " +
          String(Number(summary.fail) || 0) + " failed",
          Number(summary.fail) ? "is-warn" : "is-safe",
      ) : renderStatusPill_("Ready", "is-live"),
      "</div>",
      "<p class=\"central-admin-footer-note\">",
      escapeHtml_(String(adminState.wayfinderEvaluationsLibrarySize || 25)),
      " curated questions are available. The usual fixed safety tests still run separately on every code check.</p>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"run-wayfinder-evaluations\"",
      busy ? " disabled" : "", ">",
      adminState.wayfinderEvaluationsRunning ?
        "Testing five answers..." : "Run Random 5", "</button>",
      latest ? [
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"rerun-wayfinder-evaluations\" data-wayfinder-evaluation-run-id=\"",
        escapeAttr_(latest.runId), "\"", busy ? " disabled" : "",
        ">Rerun Same 5</button>",
      ].join("") : "",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"refresh-wayfinder-evaluations\"",
      busy ? " disabled" : "", ">Refresh History</button>",
      "</div>",
      adminState.wayfinderEvaluationsError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Evaluation unavailable.</strong><p>",
        escapeHtml_(adminState.wayfinderEvaluationsError), "</p></div>",
      ].join("") : "",
      adminState.wayfinderEvaluationsRunning ? [
        "<div class=\"wayfinder-evaluation-progress\" role=\"status\">",
        "<span class=\"wayfinder-lab-spinner\" aria-hidden=\"true\"></span>",
        "<p>Wayfinder is answering and checking five questions. Live event and group checks can take a moment.</p></div>",
      ].join("") : "",
      latest ? renderWayfinderEvaluationRun_(latest) :
        adminState.wayfinderEvaluationsLoaded ?
          "<div class=\"central-admin-empty\"><strong>No runs yet.</strong><p>Run the first five-question check when you are ready.</p></div>" : "",
      "</section>",
    ].join("");
  }

  function renderWayfinderEvaluationRun_(run) {
    var results = Array.isArray(run.results) ? run.results : [];
    return [
      "<div class=\"wayfinder-evaluation-run\">",
      "<div class=\"wayfinder-evaluation-run-heading\"><div>",
      "<span class=\"central-admin-kicker\">Latest run</span>",
      "<strong>", escapeHtml_(formatAdminTimestamp_(run.createdAt)),
      "</strong></div><code>", escapeHtml_(String(run.runId || "").slice(0, 8)),
      "</code></div>",
      "<div class=\"wayfinder-evaluation-results\">",
      results.map(renderWayfinderEvaluationResult_).join(""),
      "</div></div>",
    ].join("");
  }

  function renderWayfinderEvaluationResult_(result) {
    var status = String(result.status || "fail");
    var checks = Array.isArray(result.checks) ? result.checks : [];
    var sourceIds = Array.isArray(result.sourceIds) ? result.sourceIds : [];
    return [
      "<article class=\"wayfinder-evaluation-result is-", escapeAttr_(status),
      "\"><div class=\"central-admin-item-header\"><div>",
      "<span class=\"central-admin-kicker\">",
      escapeHtml_(String(result.category || "").replace(/_/g, " ")),
      "</span><h4>", escapeHtml_(result.question), "</h4></div>",
      renderStatusPill_(status, status === "pass" ? "is-safe" :
        status === "warning" ? "is-live" : "is-warn"), "</div>",
      result.error ? "<p class=\"wayfinder-evaluation-error\">" +
        escapeHtml_(result.error) + "</p>" : "",
      result.answer ? "<p class=\"wayfinder-evaluation-answer\">" +
        escapeHtml_(result.answer) + "</p>" : "",
      checks.length ? "<ul>" + checks.map(function(check) {
        return "<li class=\"is-" + escapeAttr_(check.status) + "\">" +
          escapeHtml_(check.message) + "</li>";
      }).join("") + "</ul>" : "",
      sourceIds.length ? "<p class=\"central-admin-footer-note\">Sources: " +
        sourceIds.map(function(id) {
          return "<code>" + escapeHtml_(id) + "</code>";
        }).join(" ") + "</p>" : "",
      "</article>",
    ].join("");
  }

  function renderWayfinderFeedbackItem_(item) {
    var reviewed = item.status === "reviewed" || item.status === "recorded";
    var reason = getWayfinderFeedbackReasonLabel_(item.reason);
    return [
      "<article class=\"wayfinder-feedback-item",
      reviewed ? " is-reviewed" : "", "\">",
      "<div class=\"wayfinder-feedback-item-header\"><div>",
      "<span>", item.rating === "helpful" ? "👍 Helpful" :
        "👎 Needs work", reason ? " · " + escapeHtml_(reason) : "",
      "</span><time>", escapeHtml_(formatAdminTimestamp_(item.createdAt)),
      "</time></div>",
      renderStatusPill_(item.status === "recorded" ? "Helpful" :
        reviewed ? "Reviewed" : "New",
          reviewed ? "is-safe" : "is-warn"),
      "</div>",
      "<h4>", escapeHtml_(item.question), "</h4>",
      "<p class=\"wayfinder-feedback-answer\">",
      escapeHtml_(item.answer), "</p>",
      renderWayfinderFeedbackTargets_(item),
      item.note ? "<p class=\"wayfinder-feedback-note\"><strong>Tester note:</strong> " +
        escapeHtml_(item.note) + "</p>" : "",
      item.status === "recorded" ? "" : [
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"",
      reviewed ? "reopen-wayfinder-feedback" : "review-wayfinder-feedback",
      "\" data-wayfinder-feedback-id=\"", escapeAttr_(item.id), "\"",
      adminState.wayfinderFeedbackWorking ? " disabled" : "", ">",
      reviewed ? "Reopen" : "Mark Reviewed", "</button>",
      ].join(""),
      "</article>",
    ].join("");
  }

  function renderWayfinderFeedbackTargets_(item) {
    var targets = [];
    (Array.isArray(item.actions) ? item.actions : []).forEach(function(action) {
      if (!action || action.type !== "event_details" || !action.event) return;
      var eventData = action.event;
      targets.push(
          "Event modal: " + String(eventData.title || action.label || "Event"),
      );
      if (eventData.registrationUrl) {
        targets.push(
            "Registration action: " +
            String(eventData.registrationLabel || "Register") + " — " +
            String(eventData.registrationUrl),
        );
      }
    });
    (Array.isArray(item.links) ? item.links : []).forEach(function(link) {
      if (!link || !link.url) return;
      targets.push(
          "External link: " + String(link.label || "Learn more") + " — " +
          String(link.url),
      );
    });
    if (!targets.length) return "";

    return [
      "<div class=\"central-admin-footer-note\"><strong>Response actions</strong><ul>",
      targets.map(function(target) {
        return "<li>" + escapeHtml_(target) + "</li>";
      }).join(""),
      "</ul></div>",
    ].join("");
  }

  function getWayfinderFeedbackReasonLabel_(reason) {
    return {
      incorrect: "Incorrect",
      missing_information: "Missing information",
      outdated: "Outdated",
      too_long: "Too long or not conversational",
      wrong_link: "Wrong or missing link",
      other: "Other",
    }[String(reason || "")] || "";
  }

  function renderWayfinderNoticeAdmin_() {
    var noticeDraft = adminState.wayfinderNoticeDraft;
    var knowledgeDraft = adminState.wayfinderKnowledgeDraft;
    if (!adminState.wayfinderNoticeModeActive &&
      !adminState.wayfinderNoticeMessage &&
      !adminState.wayfinderNoticeError && !noticeDraft && !knowledgeDraft) {
      return "";
    }

    return [
      "<section class=\"central-admin-item wayfinder-notice-admin\">",
      "<div class=\"central-admin-item-header\"><strong>Wayfinder update manager</strong>",
      renderStatusPill_(
          adminState.wayfinderNoticeModeActive ?
            "Admin mode active" : "Admin mode closed",
          adminState.wayfinderNoticeModeActive ? "is-safe" : "is-warn",
      ),
      "</div>",
      adminState.wayfinderNoticeModeActive ?
        renderWayfinderUpdateTypeControls_() : "",
      adminState.wayfinderNoticeMessage ? [
        "<p class=\"wayfinder-notice-message\">",
        escapeHtml_(adminState.wayfinderNoticeMessage),
        "</p>",
      ].join("") : "",
      adminState.wayfinderKnowledgeMessage ? [
        "<p class=\"wayfinder-notice-message\">",
        escapeHtml_(adminState.wayfinderKnowledgeMessage),
        "</p>",
      ].join("") : "",
      adminState.wayfinderNoticeError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Update not completed.</strong><p>",
        escapeHtml_(adminState.wayfinderNoticeError),
        "</p></div>",
      ].join("") : "",
      adminState.wayfinderKnowledgeError ? [
        "<div class=\"wayfinder-lab-error\" role=\"alert\"><strong>Permanent change not completed.</strong><p>",
        escapeHtml_(adminState.wayfinderKnowledgeError),
        "</p></div>",
      ].join("") : "",
      noticeDraft ? [
        "<div class=\"wayfinder-notice-preview\">",
        "<span class=\"central-admin-kicker\">Review before publishing</span>",
        "<h4>", escapeHtml_(noticeDraft.title), "</h4>",
        "<p>", escapeHtml_(noticeDraft.publicMessage), "</p>",
        "<dl>",
        "<div><dt>Starts</dt><dd>",
        escapeHtml_(formatAdminTimestamp_(noticeDraft.startsAt)),
        "</dd></div>",
        "<div><dt>Expires</dt><dd>",
        escapeHtml_(formatAdminTimestamp_(noticeDraft.expiresAt)),
        "</dd></div>",
        "<div><dt>Topic</dt><dd>",
        escapeHtml_(noticeDraft.topic), "</dd></div>",
        "</dl>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-wayfinder-notice\"",
        adminState.wayfinderNoticeWorking ? " disabled" : "",
        ">Publish Notice</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"cancel-wayfinder-notice\"",
        adminState.wayfinderNoticeWorking ? " disabled" : "",
        ">Cancel Draft</button>",
        "</div></div>",
      ].join("") : "",
      knowledgeDraft ? renderWayfinderKnowledgeDraft_(knowledgeDraft) : "",
      adminState.wayfinderNoticeModeActive ?
        renderWayfinderManagers_() : "",
      "</section>",
    ].join("");
  }

  function renderWayfinderUpdateTypeControls_() {
    var currentType = adminState.wayfinderAdminUpdateType;
    return [
      "<div class=\"wayfinder-update-type\" role=\"group\" aria-label=\"Update type\">",
      "<button type=\"button\" data-admin-action=\"set-wayfinder-update-type\" data-wayfinder-update-type=\"temporary\" class=\"",
      currentType === "temporary" ? "is-active" : "", "\">",
      "Temporary Notice</button>",
      "<button type=\"button\" data-admin-action=\"set-wayfinder-update-type\" data-wayfinder-update-type=\"permanent\" class=\"",
      currentType === "permanent" ? "is-active" : "", "\">",
      "Permanent Knowledge</button>",
      "</div>",
      adminState.wayfinderEditingNoticeId ? [
        "<p class=\"central-admin-footer-note\">Editing notice ",
        "<code>", escapeHtml_(adminState.wayfinderEditingNoticeId),
        "</code>. Describe what should change.</p>",
      ].join("") : "",
    ].join("");
  }

  function renderWayfinderKnowledgeDraft_(draft) {
    return [
      "<div class=\"wayfinder-notice-preview wayfinder-knowledge-preview\">",
      "<span class=\"central-admin-kicker\">Permanent change review</span>",
      "<h4>", escapeHtml_(draft.changeSummary), "</h4>",
      "<p><strong>Entry:</strong> <code>",
      escapeHtml_(draft.targetEntryId), "</code></p>",
      "<div class=\"wayfinder-knowledge-diff\">",
      renderWayfinderKnowledgeSnapshot_("Current", draft.beforeEntry),
      renderWayfinderKnowledgeSnapshot_(
          "Proposed",
          draft.replacementEntry,
      ),
      "</div>",
      "<p class=\"central-admin-footer-note\">Approving creates an audited revision. The imported JSON entry remains available underneath it.</p>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-wayfinder-knowledge\"",
      adminState.wayfinderKnowledgeWorking ? " disabled" : "",
      ">Approve Permanent Change</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"cancel-wayfinder-knowledge\"",
      adminState.wayfinderKnowledgeWorking ? " disabled" : "",
      ">Cancel Draft</button>",
      "</div></div>",
    ].join("");
  }

  function renderWayfinderKnowledgeSnapshot_(label, entry) {
    var facts = entry && Array.isArray(entry.requiredFacts) ?
      entry.requiredFacts : [];
    var allowedFacts = entry && Array.isArray(entry.allowedPublicFacts) ?
      entry.allowedPublicFacts : [];
    var actions = entry && Array.isArray(entry.requiredActions) ?
      entry.requiredActions : [];
    var guardrails = [];
    if (entry && Array.isArray(entry.prohibitedClaims)) {
      guardrails = guardrails.concat(entry.prohibitedClaims);
    }
    if (entry && Array.isArray(entry.prohibitedInformation)) {
      guardrails = guardrails.concat(entry.prohibitedInformation);
    }
    var links = entry && Array.isArray(entry.approvedLinks) ?
      entry.approvedLinks : [];
    return [
      "<section><span class=\"central-admin-kicker\">",
      escapeHtml_(label), "</span>",
      "<h5>", escapeHtml_(entry && entry.title || "Untitled entry"),
      "</h5>",
      renderWayfinderSnapshotList_("Facts", facts.concat(allowedFacts)),
      renderWayfinderSnapshotList_("Required actions", actions),
      renderWayfinderSnapshotList_("Guardrails", guardrails),
      renderWayfinderSnapshotList_("Approved links", links.map(function(link) {
        return String(link.label || "Link") + ": " + String(link.url || "");
      })),
      "</section>",
    ].join("");
  }

  function renderWayfinderSnapshotList_(label, items) {
    if (!Array.isArray(items) || !items.length) return "";
    return [
      "<h6>", escapeHtml_(label), "</h6><ul>",
      items.map(function(item) {
        return "<li>" + escapeHtml_(item) + "</li>";
      }).join(""),
      "</ul>",
    ].join("");
  }

  function renderWayfinderManagers_() {
    return [
      "<div class=\"wayfinder-manager-heading\">",
      "<div><span class=\"central-admin-kicker\">Stored updates</span>",
      "<h4>Manage Wayfinder information</h4></div>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"refresh-wayfinder-managers\"",
      adminState.wayfinderManagerLoading ? " disabled" : "",
      ">", adminState.wayfinderManagerLoading ? "Refreshing..." :
        "Refresh", "</button></div>",
      "<div class=\"wayfinder-manager-grid\">",
      renderWayfinderNoticeManager_(),
      renderWayfinderKnowledgeManager_(),
      "</div>",
    ].join("");
  }

  function renderWayfinderNoticeManager_() {
    var notices = Array.isArray(adminState.wayfinderNotices) ?
      adminState.wayfinderNotices : [];
    return [
      "<section class=\"wayfinder-manager-column\"><h5>Temporary notices</h5>",
      notices.length ? notices.map(renderWayfinderNoticeCard_).join("") :
        "<p class=\"central-admin-footer-note\">No temporary notices yet.</p>",
      "</section>",
    ].join("");
  }

  function renderWayfinderNoticeCard_(notice) {
    var canChange = notice.status === "active" ||
      notice.status === "scheduled";
    return [
      "<article class=\"wayfinder-manager-card\"><div class=\"central-admin-item-header\">",
      "<strong>", escapeHtml_(notice.title), "</strong>",
      renderStatusPill_(String(notice.status || "ended"),
          canChange ? "is-safe" : "is-warn"),
      "</div><p>", escapeHtml_(notice.publicMessage), "</p>",
      "<p class=\"central-admin-footer-note\">Expires ",
      escapeHtml_(formatAdminTimestamp_(notice.expiresAt)),
      notice.createdByEmail ? " · " + escapeHtml_(notice.createdByEmail) : "",
      "</p>",
      canChange ? [
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-wayfinder-notice\" data-wayfinder-notice-id=\"",
        escapeAttr_(notice.id), "\">Edit</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-danger\" data-admin-action=\"end-wayfinder-notice\" data-wayfinder-notice-id=\"",
        escapeAttr_(notice.id), "\">",
        adminState.wayfinderPendingEndNoticeId === notice.id ?
          "Confirm end now" : "End now",
        "</button></div>",
      ].join("") : "",
      "</article>",
    ].join("");
  }

  function renderWayfinderKnowledgeManager_() {
    var overrides = Array.isArray(adminState.wayfinderKnowledgeOverrides) ?
      adminState.wayfinderKnowledgeOverrides : [];
    return [
      "<section class=\"wayfinder-manager-column\"><h5>Permanent overrides</h5>",
      overrides.length ? overrides.map(function(item) {
        return [
          "<article class=\"wayfinder-manager-card\"><div class=\"central-admin-item-header\">",
          "<strong>", escapeHtml_(item.title), "</strong>",
          renderStatusPill_(item.active ? "active" : "inactive",
              item.active ? "is-safe" : "is-warn"),
          "</div><p>", escapeHtml_(item.changeSummary), "</p>",
          "<p class=\"central-admin-footer-note\">Revision ",
          escapeHtml_(String(item.revision || 0)),
          item.updatedAt ? " · " +
            escapeHtml_(formatAdminTimestamp_(item.updatedAt)) : "",
          "</p>",
          item.active ? [
            "<button type=\"button\" class=\"central-admin-link-button is-danger\" data-admin-action=\"deactivate-wayfinder-knowledge\" data-wayfinder-entry-id=\"",
            escapeAttr_(item.entryId), "\">",
            adminState.wayfinderPendingDeactivateEntryId === item.entryId ?
              "Confirm revert" : "Revert to imported entry",
            "</button>",
          ].join("") : "",
          "</article>",
        ].join("");
      }).join("") :
        "<p class=\"central-admin-footer-note\">No permanent overrides yet.</p>",
      "</section>",
    ].join("");
  }

  function renderWayfinderGeneratedAnswer_(result) {
    if (adminState.wayfinderGenerating) {
      return [
        "<div class=\"central-admin-item wayfinder-lab-loading\" role=\"status\" aria-live=\"polite\">",
        "<span class=\"wayfinder-lab-spinner\" aria-hidden=\"true\"></span>",
        "<div>",
        "<strong>Building a grounded answer</strong>",
        "<p>The backend is checking approved knowledge and safety rules before Gemini can respond.</p>",
        "</div>",
        "</div>",
      ].join("");
    }

    if (!result) {
      return "";
    }

    var sourceCards = Array.isArray(result.sourceCards) ?
      result.sourceCards : [];
    var modelUsed = result.modelUsed === true;
    var communicationPosture = String(
        result.communicationPosture || "universal",
    );
    var postureLabel = communicationPosture.replace(/_/g, " ");
    var modeLabel = modelUsed ? "Gemini grounded" :
      getWayfinderPolicyModeLabel_(result.mode);

    return [
      "<section class=\"central-admin-item wayfinder-lab-answer\" aria-live=\"polite\">",
      "<div class=\"wayfinder-lab-answer-header\">",
      "<div>",
      "<span class=\"central-admin-kicker\">Wayfinder answer</span>",
      "<h4>", escapeHtml_(modeLabel), "</h4>",
      "</div>",
      "<div class=\"wayfinder-lab-summary-pills\">",
      renderStatusPill_(
          modelUsed ? String(result.model || "Gemini") : "Gemini skipped",
          modelUsed ? "is-safe" : "is-warn",
      ),
      renderStatusPill_(
          String(result.confidence || "none") + " confidence",
          result.confidence === "high" ? "is-safe" : "is-live",
      ),
      modelUsed ? renderStatusPill_(
          postureLabel + " posture",
          result.postureConfidence === "high" ? "is-safe" : "is-live",
      ) : "",
      "</div>",
      "</div>",
      "<div class=\"wayfinder-lab-answer-copy\">",
      renderWayfinderAnswerParagraphs_(result.answer),
      result.followUpQuestion ? [
        "<p class=\"wayfinder-lab-follow-up\"><strong>Follow-up:</strong> ",
        escapeHtml_(result.followUpQuestion), "</p>",
      ].join("") : "",
      "</div>",
      sourceCards.length ? [
        "<div class=\"wayfinder-lab-source-cards\">",
        sourceCards.map(renderWayfinderSourceCard_).join(""),
        "</div>",
      ].join("") : "",
      "<p class=\"central-admin-footer-note\">",
      escapeHtml_(result.notice || "Only approved Wayfinder context was used."),
      "</p>",
      "</section>",
    ].join("");
  }

  function renderWayfinderAnswerParagraphs_(answer) {
    var paragraphs = String(answer || "").split(/\n+/).map(function(value) {
      return value.trim();
    }).filter(Boolean);

    return paragraphs.map(function(paragraph) {
      return "<p>" + escapeHtml_(paragraph) + "</p>";
    }).join("");
  }

  function renderWayfinderSourceCard_(source) {
    var value = source && typeof source === "object" ? source : {};
    var links = Array.isArray(value.links) ? value.links : [];

    return [
      "<article class=\"wayfinder-lab-source-card\">",
      "<span>", escapeHtml_(value.topic || "approved source"), "</span>",
      "<strong>", escapeHtml_(value.title || value.id || "Approved source"),
      "</strong>",
      "<code>", escapeHtml_(value.id || "source"), "</code>",
      links.length ? [
        "<div>",
        links.map(function(link) {
          var url = String(link && link.url || "").trim();
          var label = String(link && link.label || "Open source");
          if (!/^https:\/\//i.test(url)) return "";
          return [
            "<a href=\"", escapeAttr_(url),
            "\" target=\"_blank\" rel=\"noopener noreferrer\">",
            escapeHtml_(label), "</a>",
          ].join("");
        }).join(""),
        "</div>",
      ].join("") : "",
      "</article>",
    ].join("");
  }

  function getWayfinderPolicyModeLabel_(mode) {
    if (mode === "policy-answer") return "Approved policy response";
    if (mode === "live_source_required") return "Live source required";
    if (mode === "unknown") return "Safe unknown response";
    if (mode === "knowledge-fallback") return "Approved knowledge preview";
    return "Approved fallback response";
  }

  function renderWayfinderPrototypeResult_(result) {
    if (adminState.wayfinderQuerying) {
      return [
        "<div class=\"central-admin-item wayfinder-lab-loading\" role=\"status\" aria-live=\"polite\">",
        "<span class=\"wayfinder-lab-spinner\" aria-hidden=\"true\"></span>",
        "<div>",
        "<strong>Searching approved knowledge</strong>",
        "<p>Wayfinder is comparing the question with the draft knowledge base.</p>",
        "</div>",
        "</div>",
      ].join("");
    }

    if (!result) {
      return [
        "<div class=\"central-admin-empty wayfinder-lab-empty\">",
        "<strong>Your retrieval results will appear here.</strong>",
        "<p>Try your own wording or choose one of the examples above.</p>",
        "</div>",
      ].join("");
    }

    var results = Array.isArray(result.results) ? result.results : [];
    var confidence = String(result.confidence || "none").toLowerCase();
    var confidenceTone = confidence === "high" ? "is-safe" :
      confidence === "none" ? "is-warn" : "is-live";

    return [
      "<section class=\"wayfinder-lab-results\" aria-live=\"polite\">",
      "<div class=\"wayfinder-lab-summary\">",
      "<div>",
      "<span class=\"central-admin-kicker\">Retrieval report</span>",
      "<h4>", escapeHtml_(adminState.wayfinderQuestion || result.question),
      "</h4>",
      "</div>",
      "<div class=\"wayfinder-lab-summary-pills\">",
      renderStatusPill_(confidence + " confidence", confidenceTone),
      renderStatusPill_(
          String(result.knowledgeEntryCount || 0) + " entries searched",
          "",
      ),
      "</div>",
      "</div>",
      Number(result.knowledgeEntryCount || 0) === 0 ? [
        "<div class=\"central-admin-empty wayfinder-lab-no-match\">",
        "<strong>The draft knowledge base is empty.</strong>",
        "<p>Import the approved Wayfinder bundles into Firestore before testing questions.</p>",
        "</div>",
      ].join("") : results.length ? results.map(function(item, index) {
        return renderWayfinderMatch_(item, index);
      }).join("") : [
        "<div class=\"central-admin-empty wayfinder-lab-no-match\">",
        "<strong>No approved match was found.</strong>",
        "<p>This is the safe outcome. A future Wayfinder response should say it does not know and offer the approved public contact path.</p>",
        "</div>",
      ].join(""),
      "<p class=\"central-admin-footer-note\">",
      escapeHtml_(result.notice || "No Gemini response was generated."),
      "</p>",
      "</section>",
    ].join("");
  }

  function renderWayfinderMatch_(item, index) {
    var value = item && typeof item === "object" ? item : {};
    var matchedTerms = Array.isArray(value.matchedTerms) ?
      value.matchedTerms : [];
    var requiredSourceType = String(value.requiredSourceType || "").trim();

    return [
      "<article class=\"central-admin-item wayfinder-lab-match\">",
      "<div class=\"wayfinder-lab-match-header\">",
      "<div class=\"wayfinder-lab-rank\">", String(index + 1), "</div>",
      "<div class=\"wayfinder-lab-match-title\">",
      "<span>", escapeHtml_(value.topic || "Approved knowledge"), "</span>",
      "<h5>", escapeHtml_(value.title || value.id || "Knowledge entry"),
      "</h5>",
      "<code>", escapeHtml_(value.id || "unknown-entry"), "</code>",
      "</div>",
      "<div class=\"wayfinder-lab-match-score\">",
      "<strong>", escapeHtml_(String(value.score || 0)), "</strong>",
      "<span>match score</span>",
      "</div>",
      "</div>",
      matchedTerms.length ? [
        "<div class=\"wayfinder-lab-terms\"><span>Matched:</span>",
        matchedTerms.map(function(term) {
          return "<code>" + escapeHtml_(term) + "</code>";
        }).join(""),
        "</div>",
      ].join("") : "",
      requiredSourceType ? [
        "<div class=\"wayfinder-lab-live-source\">",
        renderStatusPill_("Live source required", "is-warn"),
        "<p>", escapeHtml_(requiredSourceType), "</p>",
        "</div>",
      ].join("") : "",
      "<div class=\"wayfinder-lab-detail-grid\">",
      renderWayfinderTextList_("Required facts", value.requiredFacts),
      renderWayfinderTextList_("Allowed public facts", value.allowedPublicFacts),
      renderWayfinderTextList_("Required actions", value.requiredActions),
      renderWayfinderApprovedActions_(value.approvedActions),
      renderWayfinderApprovedLinks_(value.approvedLinks),
      renderWayfinderTextList_("Do not claim", value.prohibitedClaims, true),
      renderWayfinderTextList_(
          "Do not reveal",
          value.prohibitedInformation,
          true,
      ),
      "</div>",
      "<p class=\"wayfinder-lab-mode\">Response mode: <strong>",
      escapeHtml_(value.responseMode || "flexible"),
      "</strong></p>",
      "</article>",
    ].join("");
  }

  function renderWayfinderTextList_(title, values, isGuardrail) {
    var items = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!items.length) {
      return "";
    }

    return [
      "<section class=\"wayfinder-lab-detail",
      isGuardrail ? " is-guardrail" : "", "\">",
      "<h6>", escapeHtml_(title), "</h6>",
      "<ul>",
      items.map(function(item) {
        return "<li>" + escapeHtml_(String(item)) + "</li>";
      }).join(""),
      "</ul>",
      "</section>",
    ].join("");
  }

  function renderWayfinderApprovedLinks_(values) {
    var links = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!links.length) {
      return "";
    }

    return [
      "<section class=\"wayfinder-lab-detail\">",
      "<h6>Approved links</h6>",
      "<ul>",
      links.map(function(link) {
        var url = String(link && link.url || "").trim();
        var label = String(link && link.label || url || "Approved link");
        if (!/^https:\/\//i.test(url)) {
          return "<li>" + escapeHtml_(label) + "</li>";
        }
        return [
          "<li><a href=\"", escapeAttr_(url),
          "\" target=\"_blank\" rel=\"noopener noreferrer\">",
          escapeHtml_(label), "</a></li>",
        ].join("");
      }).join(""),
      "</ul>",
      "</section>",
    ].join("");
  }

  function renderWayfinderApprovedActions_(values) {
    var actions = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!actions.length) {
      return "";
    }

    return renderWayfinderTextList_(
        "Approved contact actions",
        actions.map(function(action) {
          var label = String(action && action.label || "Contact").trim();
          var value = String(action && action.value || "").trim();
          return value ? label + ": " + value : label;
        }),
    );
  }

  function renderGoogleCalendarIntegrationSection_() {
    var draft = adminState.settingsSundayDraft ||
      createEmptySettingsSundayDraft_();
    var canEdit = canEditIntegrations_();

    return renderCollapsibleAdminSection_({
      id: "integrations-google-calendar",
      title: "Google + Calendar",
      pillHtml: renderStatusPill_(
          draft.google_docs_enabled || draft.calendar_integrations_enabled ?
            "Enabled" :
            "Disabled",
          draft.google_docs_enabled || draft.calendar_integrations_enabled ?
            "is-safe" :
            "is-warn",
      ),
      bodyHtml: [
        renderAdminCheckboxField_({
          label: "Enable Google Docs integration",
          field: "settings-sunday.google_docs_enabled",
          checked: draft.google_docs_enabled,
          disabled: !canEdit,
        }),
        renderAdminCheckboxField_({
          label: "Enable calendar integrations",
          field: "settings-sunday.calendar_integrations_enabled",
          checked: draft.calendar_integrations_enabled,
          disabled: !canEdit,
        }),
        renderAdminNote_(
            "Google Docs adds note saving to Sunday Mode. Calendar integrations add Google, Apple, and Outlook options to event cards.",
        ),
        "<div class=\"central-admin-form-grid\">",
        renderAdminInputField_({
          label: "Google Docs Web Client ID",
          field: "settings-sunday.google_web_client_id",
          value: draft.google_web_client_id,
          placeholder: "1234567890-abc123def456.apps.googleusercontent.com",
          type: "text",
          disabled: !canEdit || !draft.google_docs_enabled,
          wide: true,
        }),
        "</div>",
        renderAdminNote_(
            "Leave the client ID blank to keep using the existing backend value. Disabling Google Docs does not affect the calendar menu.",
        ),
      ].join(""),
    });
  }

  function renderResiIntegrationSection_() {
    var draft = adminState.settingsSundayDraft ||
      createEmptySettingsSundayDraft_();
    var canEdit = canEditIntegrations_();

    return renderCollapsibleAdminSection_({
      id: "integrations-resi",
      title: "Resi",
      pillHtml: renderStatusPill_(
          draft.sunday_livestream_url ? "Configured" : "Not configured",
          draft.sunday_livestream_url ? "is-safe" : "is-warn",
      ),
      bodyHtml: [
        "<div class=\"central-admin-form-grid\">",
        renderAdminInputField_({
          label: "Livestream URL",
          field: "settings-sunday.sunday_livestream_url",
          value: draft.sunday_livestream_url,
          placeholder: "https://live.crosspointe.tv",
          type: "text",
          disabled: !canEdit,
          wide: true,
        }),
        renderAdminTextareaField_({
          label: "Livestream Note",
          field: "settings-sunday.sunday_livestream_note",
          value: draft.sunday_livestream_note,
          placeholder: "Optional helper text beneath the livestream card.",
          rows: 3,
          wide: true,
          disabled: !canEdit,
        }),
        "</div>",
      ].join(""),
    });
  }

  function renderYouVersionIntegrationSection_() {
    var draft = adminState.settingsSundayDraft ||
      createEmptySettingsSundayDraft_();
    var canEdit = canEditIntegrations_();

    return renderCollapsibleAdminSection_({
      id: "integrations-youversion",
      title: "YouVersion",
      pillHtml: renderStatusPill_(
          draft.sunday_scripture_bible_id ? "Configured" : "Using default",
          draft.sunday_scripture_bible_id ? "is-safe" : "is-live",
      ),
      bodyHtml: [
        "<div class=\"central-admin-form-grid\">",
        renderAdminInputField_({
          label: "Bible ID",
          field: "settings-sunday.sunday_scripture_bible_id",
          value: draft.sunday_scripture_bible_id,
          placeholder: "3034",
          maxLength: 12,
          disabled: !canEdit,
        }),
        "</div>",
        renderAdminNote_(
            "This selects the Bible version used by Central's scripture reader.",
        ),
      ].join(""),
    });
  }

  function renderPlanningCenterIntegrationSection_() {
    return renderCollapsibleAdminSection_({
      id: "integrations-planning-center",
      title: "Planning Center",
      pillHtml: renderStatusPill_("Public signups only", "is-safe"),
      bodyHtml: renderAdminNote_(
          "Central imports public event and signup details from Planning Center. " +
          "Only Registrations signups in the configured Central category are " +
          "shown. Attendees, people, form answers, emergency contacts, and " +
          "payments are never requested or stored by Central.",
      ),
    });
  }

  function renderRoomRulesEditor_() {
    var permission = getPageAccessLevel_("roomRules");
    var canEdit = canEditRoomRules_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.roomRulesDraft || createEmptyRoomRuleDraft_();
    var actionDisabled = adminState.roomRulesSaving || adminState.roomRulesPublishing;

    return renderCollapsibleAdminSection_({
      id: "settings-room-rule-form",
      title: adminState.roomRulesEditingId ?
        "Edit Room Rule" :
        "Add Room Rule",
      pillHtml: renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      bodyHtml: [
      renderAdminNote_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "Room Rules shape how Planning Center rooms get renamed or hidden in Central. Each save sends a single approval request, so editors can submit one rule change at a time." :
              "Room Rules shape how Planning Center rooms get renamed or hidden in Central. Each save publishes that one rule change immediately.") :
            "Your current permission level does not allow editing room rules.",
      ),
      adminState.roomRulesMessage ?
        renderAdminNote_(adminState.roomRulesMessage) :
        "",
      adminState.roomRulesError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.roomRulesError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        renderAdminSelectField_({
          label: "Match Type",
          field: "room-rule.match_type",
          value: draft.match_type,
          options: ROOM_RULE_MATCH_TYPE_OPTIONS,
        }),
        renderAdminInputField_({
          label: "Match Text",
          field: "room-rule.match_text",
          value: draft.match_text,
          placeholder: "Student Ministry Room",
          maxLength: 120,
        }),
        renderAdminInputField_({
          label: "Display Location",
          field: "room-rule.display_location",
          value: draft.display_location,
          placeholder: "Students",
          maxLength: 120,
        }),
        renderAdminSelectField_({
          label: "Behavior",
          field: "room-rule.behavior",
          value: draft.behavior,
          options: ROOM_RULE_BEHAVIOR_OPTIONS,
        }),
        renderAdminInputField_({
          label: "Priority",
          field: "room-rule.priority",
          value: draft.priority || "50",
          type: "number",
        }),
        "</div>",
        renderAdminCheckboxField_({
          label: "Active",
          field: "room-rule.active",
          checked: !!draft.active,
        }),
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-room-rule\"",
        actionDisabled ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.roomRulesSaving ?
              getRoomRuleSaveBusyLabel_() :
              getRoomRuleSaveButtonLabel_(),
        ),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-room-rule-form\"",
        actionDisabled ? " disabled" : "",
        ">Reset Form</button>",
        "</div>",
      ].join("") : "",
      ].join(""),
    });
  }

  function renderRoomRulesWorkingList_() {
    var canEdit = canEditRoomRules_();

    if (adminState.roomRulesLoading && !adminState.roomRulesLoaded) {
      return renderCollapsibleAdminSection_({
        id: "settings-room-rules-list",
        title: "Current Room Rules",
        pillHtml: renderStatusPill_("Loading", "is-live"),
        bodyHtml: renderAdminNote_("Reading the current room rules now."),
      });
    }

    if (!adminState.roomRulesItems.length) {
      return renderCollapsibleAdminSection_({
        id: "settings-room-rules-list",
        title: "Current Room Rules",
        pillHtml: renderStatusPill_(
            adminState.roomRulesError ? "Read failed" : "Empty collection",
            adminState.roomRulesError ? "is-warn" : "is-live",
        ),
        bodyHtml: renderAdminNote_(
            adminState.roomRulesError ?
              "The current room rules could not be read right now." :
              "No room rules are currently published in Firestore. Room details in Central will use their default Planning Center names until you add rules here.",
        ),
      });
    }

    return renderCollapsibleAdminSection_({
      id: "settings-room-rules-list",
      title: "Current Room Rules",
      pillHtml: renderStatusPill_(
          adminState.roomRulesItems.length + " loaded",
          "is-safe",
      ),
      bodyHtml: [
      renderAdminNote_(
          "This is the current published room-rules list.",
      ),
      adminState.roomRulesItems.map(function(item) {
        return [
          "<div class=\"central-admin-list-row\">",
          "<div>",
          "<strong>",
          escapeHtml_(item.match_text || "Untitled rule"),
          "</strong>",
          "<p>",
          escapeHtml_(
              item.display_location ?
                item.display_location :
                "Uses the original room name unless a replacement is provided.",
          ),
          "</p>",
          "<div class=\"central-admin-item-meta\">",
          renderInlineMeta_("Match", formatRoomRuleMatchTypeLabel_(item.match_type)),
          renderInlineMeta_("Behavior", formatRoomRuleBehaviorLabel_(item.behavior)),
          renderInlineMeta_("Priority", String(item.priority || 50)),
          renderInlineMeta_("Status", item.active ? "Active" : "Inactive"),
          "</div>",
          "</div>",
          canEdit ? [
            "<div class=\"central-admin-row-actions\">",
            "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-room-rule\" data-admin-doc-id=\"",
            escapeAttr_(item.id),
            "\"",
            adminState.roomRulesSaving || adminState.roomRulesPublishing ? " disabled" : "",
            ">Edit</button>",
            "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-room-rule\" data-admin-doc-id=\"",
            escapeAttr_(item.id),
            "\"",
            adminState.roomRulesSaving || adminState.roomRulesPublishing ? " disabled" : "",
            ">Delete</button>",
            "</div>",
          ].join("") : "",
          "</div>",
        ].join("");
      }).join(""),
      ].join(""),
    });
  }

  function renderRoomRulesPublishPanel_() {
    var permission = getPageAccessLevel_("roomRules");
    var canEdit = canEditRoomRules_();
    var actionConfig = getPrimaryContentActionConfig_(permission);

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Publish Room Rules</strong>",
      renderStatusPill_(
          !canEdit ?
            "Read only" :
            (actionConfig.mode === "submit" ?
              "Approval required" :
              "Can publish"),
          !canEdit ?
            "is-warn" :
            (actionConfig.mode === "submit" ? "is-live" : "is-safe"),
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Publishing here updates the preview room rules used when Planning Center events are transformed for Central." :
            "Your current permission level does not allow publishing room rules.",
      ),
      adminState.roomRulesMessage ?
        renderAdminNote_(adminState.roomRulesMessage) :
        "",
      adminState.roomRulesError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.roomRulesError) +
        "</p>" :
        "",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-room-rules\"",
      adminState.roomRulesPublishing ? " disabled" : "",
      ">",
      adminState.roomRulesPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
    ].join("");
  }

  function renderAdminUsersManager_() {
    if (!canManageAdminUsers_()) {
      return renderCollapsibleAdminSection_({
        id: "settings-admin-users",
        title: "Admin Users",
        pillHtml: renderStatusPill_("Restricted", "is-warn"),
        bodyHtml: renderAdminNote_(
            "Only users with admin-level access to the Users section can add people or change permission levels.",
        ),
      });
    }

    var isEditingCurrentAdminUser = !!(
      adminState.user &&
      adminState.adminUsersEditingUid &&
      adminState.user.uid === adminState.adminUsersEditingUid
    );

    return renderCollapsibleAdminSection_({
      id: "settings-admin-users",
      title: adminState.adminUsersEditingInviteId ?
        "Edit Admin Invite" :
        (adminState.adminUsersEditingUid ?
        "Edit Admin User" :
        "Add Admin User"),
      pillHtml: renderStatusPill_("Admin only", "is-live"),
      bodyHtml: [
      renderAdminNote_(
          "Enter an email address to send an admin invite with permissions already attached. If you already know a Firebase UID, you can still add someone directly without the invite flow.",
      ),
      adminState.adminUsersMessage ?
        renderAdminNote_(adminState.adminUsersMessage) :
        "",
      adminState.adminUsersError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.adminUsersError) +
        "</p>" :
        "",
      "<div class=\"central-admin-form-grid\">",
      renderAdminInputField_({
        label: "UID",
        field: "admin-user.uid",
        value: adminState.adminUsersDraft.uid,
        placeholder: "Optional direct-add path",
        maxLength: 128,
      }),
      renderAdminInputField_({
        label: "Email",
        field: "admin-user.email",
        value: adminState.adminUsersDraft.email,
        placeholder: "name@crosspointe.tv",
        maxLength: 160,
      }),
      renderAdminInputField_({
        label: "Display Name",
        field: "admin-user.displayName",
        value: adminState.adminUsersDraft.displayName,
        placeholder: "CrossPointe Team Member",
        maxLength: 120,
      }),
      "</div>",
      renderAdminCheckboxField_({
        label: "Active",
        field: "admin-user.active",
        checked: !!adminState.adminUsersDraft.active,
        hint: "Inactive users can still exist in Firestore, but they will not be able to use the dashboard.",
      }),
      "<div class=\"central-admin-form-grid\">",
      getManagedAdminPageConfigs_().map(function(pageConfig) {
        var permissionOptions = pageConfig.key === "wayfinder" ?
          ["none", "view", "admin"] : ADMIN_PERMISSION_OPTIONS;
        return renderAdminSelectField_({
          label: pageConfig.label,
          field: "admin-user.pageAccess." + pageConfig.key,
          value: getAdminUserDraftPermissionValue_(pageConfig.key),
          options: permissionOptions.map(function(permission) {
            return {
              value: permission,
              label: pageConfig.key === "wayfinder" && permission === "view" ?
                "User" : (PERMISSION_LABELS[permission] || permission),
            };
          }),
        });
      }).join(""),
      "</div>",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-admin-user\"",
      adminState.adminUsersSaving ? " disabled" : "",
      ">",
      adminState.adminUsersSaving ?
        escapeHtml_(getAdminUserSaveBusyLabel_()) :
        escapeHtml_(getAdminUserSaveButtonLabel_()),
      "</button>",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-admin-user-form\"",
      adminState.adminUsersSaving ? " disabled" : "",
      ">Reset Form</button>",
      (adminState.adminUsersEditingUid || adminState.adminUsersEditingInviteId) ? [
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-admin-user\" data-admin-doc-id=\"",
        escapeAttr_(
            adminState.adminUsersEditingInviteId ||
            adminState.adminUsersEditingUid,
        ),
        "\" data-admin-record-type=\"",
        escapeAttr_(
            adminState.adminUsersEditingInviteId ?
              "invite" :
              "user",
        ),
        "\"",
        adminState.adminUsersSaving || isEditingCurrentAdminUser ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.adminUsersEditingInviteId ?
              "Delete Invite" :
              "Delete User",
        ),
        "</button>",
      ].join("") : "",
      "</div>",
      renderAdminUsersList_(),
      ].join(""),
    });
  }

  function renderAdminUsersList_() {
    if (adminState.adminUsersLoading && !adminState.adminUsersLoaded) {
      return renderAdminNote_("Loading the current admin users and pending invites.");
    }

    if (!adminState.adminUsersItems.length) {
      return renderAdminNote_("No admin users or pending invites have been loaded yet.");
    }

    return adminState.adminUsersItems.map(function(userItem) {
      var isCurrentAdminUser = !!(
        adminState.user &&
        userItem.recordType !== "invite" &&
        userItem.uid === adminState.user.uid
      );

      return [
        "<div class=\"central-admin-list-row\">",
        "<div>",
        "<strong>",
        escapeHtml_(userItem.displayName || userItem.email || userItem.uid),
        "</strong>",
        "<p>",
        escapeHtml_(
            [
              userItem.email || "",
              userItem.uid || "",
            ].filter(Boolean).join(" • "),
        ),
        "</p>",
        "<div class=\"central-admin-item-meta\">",
        renderInlineMeta_(
            "Status",
            userItem.recordType === "invite" ?
              "Invite Pending" :
              (userItem.active ? "Active" : "Inactive"),
        ),
        renderInlineMeta_("Hub", getPermissionLabel_(getAdminUserPermissionValue_(userItem, "hub"))),
        renderInlineMeta_("Settings", getPermissionLabel_(getAdminUserPermissionValue_(userItem, "settings"))),
        renderInlineMeta_("Approvals", getPermissionLabel_(getAdminUserPermissionValue_(userItem, "changeRequests"))),
        renderInlineMeta_("Users", getPermissionLabel_(getAdminUserPermissionValue_(userItem, "users"))),
        userItem.recordType === "invite" && userItem.inviteSentAt ?
          renderInlineMeta_(
              "Sent",
              formatAdminTimestamp_(userItem.inviteSentAt),
          ) :
          "",
        userItem.recordType === "invite" && userItem.inviteExpiresAt ?
          renderInlineMeta_(
              "Expires",
              formatAdminTimestamp_(userItem.inviteExpiresAt),
          ) :
          "",
        "</div>",
        "</div>",
        "<div class=\"central-admin-row-actions\">",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-admin-user\" data-admin-doc-id=\"",
        escapeAttr_(userItem.recordType === "invite" ? userItem.inviteId : userItem.uid),
        "\" data-admin-record-type=\"",
        escapeAttr_(userItem.recordType || "user"),
        "\"",
        adminState.adminUsersSaving ? " disabled" : "",
        ">",
        escapeHtml_(userItem.recordType === "invite" ?
          "Edit / Resend" :
          "Edit"),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-admin-user\" data-admin-doc-id=\"",
        escapeAttr_(userItem.recordType === "invite" ? userItem.inviteId : userItem.uid),
        "\" data-admin-record-type=\"",
        escapeAttr_(userItem.recordType || "user"),
        "\"",
        adminState.adminUsersSaving || isCurrentAdminUser ? " disabled" : "",
        ">",
        escapeHtml_(userItem.recordType === "invite" ? "Delete Invite" : "Delete"),
        "</button>",
        "</div>",
        "</div>",
      ].join("");
    }).join("");
  }

  function renderCollapsibleAdminSection_(config) {
    var sectionId = String(config && config.id || "").trim();
    var title = String(config && config.title || "").trim() || "Section";
    var bodyHtml = String(config && config.bodyHtml || "");
    var pillHtml = String(config && config.pillHtml || "");
    var bodyId = sectionId ?
      "central-admin-section-" + sectionId :
      "";
    var isCollapsed = isAdminSectionCollapsed_(sectionId);

    return [
      "<div class=\"central-admin-item central-admin-collapsible-section",
      isCollapsed ? " is-collapsed" : "",
      "\" data-admin-collapsible-section=\"",
      escapeAttr_(sectionId),
      "\">",
      "<button type=\"button\" class=\"central-admin-collapse-toggle\" data-admin-action=\"toggle-section-collapse\" data-admin-section-id=\"",
      escapeAttr_(sectionId),
      "\"",
      bodyId ? " aria-controls=\"" + escapeAttr_(bodyId) + "\"" : "",
      " aria-expanded=\"",
      isCollapsed ? "false" : "true",
      "\">",
      "<span class=\"central-admin-collapse-heading\">",
      "<strong>", escapeHtml_(title), "</strong>",
      "</span>",
      "<span class=\"central-admin-collapse-meta\">",
      pillHtml,
      "<span class=\"central-admin-collapse-chevron\" aria-hidden=\"true\"></span>",
      "</span>",
      "</button>",
      "<div class=\"central-admin-collapse-body expandable-drawer\" data-admin-collapse-drawer=\"",
      escapeAttr_(sectionId),
      "\"",
      bodyId ? " id=\"" + escapeAttr_(bodyId) + "\"" : "",
      " aria-hidden=\"",
      isCollapsed ? "true" : "false",
      "\"",
      isCollapsed ? " hidden" : "",
      ">",
      "<div class=\"central-admin-collapse-body-inner expandable-drawer-inner\">",
      "<div class=\"central-admin-collapse-slot expandable-slot\">",
      bodyHtml,
      "</div>",
      "</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderAdminInputField_(config) {
    return [
      "<label class=\"central-admin-field", config.wide ? " central-admin-field-wide" : "", "\">",
      "<span>", escapeHtml_(config.label || ""), "</span>",
      "<input type=\"", escapeAttr_(config.type || "text"), "\" data-admin-field=\"",
      escapeAttr_(config.field || ""), "\"",
      config.maxLength ? " maxlength=\"" + escapeAttr_(String(config.maxLength)) + "\"" : "",
      config.placeholder ? " placeholder=\"" + escapeAttr_(config.placeholder) + "\"" : "",
      config.disabled ? " disabled" : "",
      " value=\"", escapeAttr_(config.value || ""), "\">",
      "</label>",
    ].join("");
  }

  function renderAdminCheckboxField_(config) {
    return [
      "<label class=\"central-admin-checkbox\">",
      "<input type=\"checkbox\" data-admin-field=\"",
      escapeAttr_(config.field || ""),
      "\"",
      config.checked ? " checked" : "",
      config.disabled ? " disabled" : "",
      ">",
      "<span>",
      escapeHtml_(config.label || ""),
      config.hint ? " " + escapeHtml_(config.hint) : "",
      "</span>",
      "</label>",
    ].join("");
  }

  function renderAdminTextareaField_(config) {
    return [
      "<label class=\"central-admin-field", config.wide ? " central-admin-field-wide" : "", "\">",
      "<span>", escapeHtml_(config.label || ""), "</span>",
      "<textarea data-admin-field=\"", escapeAttr_(config.field || ""), "\" rows=\"",
      escapeAttr_(String(config.rows || 3)), "\"",
      config.maxLength ? " maxlength=\"" + escapeAttr_(String(config.maxLength)) + "\"" : "",
      config.placeholder ? " placeholder=\"" + escapeAttr_(config.placeholder) + "\"" : "",
      config.disabled ? " disabled" : "",
      ">",
      escapeHtml_(config.value || ""),
      "</textarea>",
      config.hint ? "<small class=\"central-admin-field-hint\">" +
        escapeHtml_(config.hint) + "</small>" : "",
      "</label>",
    ].join("");
  }

  function renderAdminSelectField_(config) {
    var options = Array.isArray(config && config.options) ? config.options : [];
    var value = String(config && config.value || "").trim();

    return [
      "<label class=\"central-admin-field is-select", config.wide ? " central-admin-field-wide" : "", "\">",
      "<span>", escapeHtml_(config.label || ""), "</span>",
      "<select data-admin-field=\"", escapeAttr_(config.field || ""), "\"",
      config.disabled ? " disabled" : "",
      ">",
      options.map(function(option) {
        var optionValue = String(option && option.value || "").trim();
        return [
          "<option value=\"",
          escapeAttr_(optionValue),
          "\"",
          optionValue === value ? " selected" : "",
          ">",
          escapeHtml_(option && option.label ? option.label : optionValue),
          "</option>",
        ].join("");
      }).join(""),
      "</select>",
      "</label>",
    ].join("");
  }

  function buildSingleItemUpsertChangeRequestData_(normalizeItems, baselineItem, proposedItem) {
    var normalize = typeof normalizeItems === "function" ?
      normalizeItems :
      function(items) {
        return Array.isArray(items) ? items.slice() : [];
      };
    var baselineItems = baselineItem ? normalize([baselineItem]) : [];
    var upsertItems = proposedItem ? normalize([proposedItem]) : [];

    return {
      baselineItems: baselineItems,
      changeSet: {
        upsertItems: upsertItems,
        removeIds: [],
      },
      payload: {
        items: upsertItems,
      },
    };
  }

  function buildSingleItemRemovalChangeRequestData_(normalizeItems, baselineItem, docId) {
    var normalize = typeof normalizeItems === "function" ?
      normalizeItems :
      function(items) {
        return Array.isArray(items) ? items.slice() : [];
      };
    var normalizedDocId = String(docId || "").trim();
    var baselineItems = baselineItem ? normalize([baselineItem]) : [];

    return {
      baselineItems: baselineItems,
      changeSet: {
        upsertItems: [],
        removeIds: baselineItem && normalizedDocId ? [normalizedDocId] : [],
      },
      payload: {
        items: [],
      },
    };
  }

  function renderSortableListItemStart_(section, item, disabled, itemLabel, extraClass) {
    return [
      "<article class=\"central-admin-list-item is-sortable",
      extraClass ? " " + escapeAttr_(extraClass) : "",
      "\" data-admin-sort-item=\"true\" data-admin-sort-section=\"",
      escapeAttr_(section),
      "\" data-admin-doc-id=\"",
      escapeAttr_(item && item.id || ""),
      "\">",
      renderSortableDragHandle_(section, item, disabled, itemLabel),
    ].join("");
  }

  function renderSortableDragHandle_(section, item, disabled, itemLabel) {
    var title = disabled ?
      "Reordering is unavailable right now." :
      "Drag to reorder " + String(itemLabel || "this item") + ".";

    return [
      "<div class=\"central-admin-drag-cell\">",
      "<div class=\"central-admin-drag-handle",
      disabled ? " is-disabled" : "",
      "\"",
      disabled ? "" : " draggable=\"true\" data-admin-sort-handle=\"true\" data-admin-sort-section=\"" + escapeAttr_(section) + "\" data-admin-doc-id=\"" + escapeAttr_(item && item.id || "") + "\"",
      " title=\"",
      escapeAttr_(title),
      "\">",
      "<span class=\"central-admin-drag-arrow is-left\"></span>",
      "<span class=\"central-admin-drag-line\"></span>",
      "<span class=\"central-admin-drag-arrow is-right\"></span>",
      "</div>",
      "</div>",
    ].join("");
  }

  function getSortableListInstruction_(canReorder) {
    return canReorder ?
      "Drag items to change the order. Dropping an item publishes the new order right away, or sends it for approval if your role requires review." :
      "This is the current published list.";
  }

  function renderQuickLinksPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Collection", PUBLISHED_QUICK_LINKS_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          getQuickLinksPreviewBehaviorLabel_(),
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Quick Links act one change at a time. You can drag them into a new order, and dropping a link publishes that reorder instantly or sends it for approval.",
      ),
      "</div>",
      renderQuickLinksEditorForm_(),
      renderQuickLinksList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderStatusBannerPagePanel_(currentPage) {
    var currentBanner = adminState.statusBannerPublishedCurrent;
    var bannerIsLive = !!(
      adminState.statusBannerPublishedDocExists &&
      currentBanner &&
      currentBanner.active
    );

    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Editor Source", "/api/central-data"),
      renderInlineMeta_("Preview Doc", PUBLISHED_STATUS_BANNER_DOC_PATH),
      renderInlineMeta_(
          "Public behavior",
          adminState.statusBannerPublishedDocExists ?
            (bannerIsLive ?
              "Central shows the published Firestore banner" :
              "Central is hiding the banner") :
            "No published Firestore banner exists yet",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "The banner editor starts from the published Firestore banner Central is using right now. Direct publishers can publish or hide immediately, while request-level users can submit those changes for approval.",
      ),
      "</div>",
      renderStatusBannerEditor_(),
      renderStatusBannerPreview_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderQuickLinksEditorForm_() {
    var canEdit = canEditQuickLinks_();
    var draft = adminState.quickLinksDraft || createEmptyQuickLinkDraft_();
    var saveDisabled = !canEdit ||
      adminState.quickLinksSaving ||
      adminState.quickLinksPublishing;

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>",
      escapeHtml_(
          adminState.quickLinksEditingId ?
            "Edit Quick Link" :
            "Add Quick Link",
      ),
      "</strong>",
      renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "These links feed the homepage quick links section and the Sunday morning quick actions row. Turn on Sunday Only when a link should stay hidden until Sunday Mode is active. Saving here immediately publishes the change or submits it for approval, depending on your access." :
            "Your current permission level does not allow editing quick links.",
      ),
      adminState.quickLinksMessage ?
        renderAdminNote_(adminState.quickLinksMessage) :
        "",
      adminState.quickLinksError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.quickLinksError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Title</span>",
        "<input type=\"text\" data-admin-field=\"quick-link.title\" maxlength=\"120\" placeholder=\"Church Center\" value=\"",
        escapeAttr_(draft.title || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>URL</span>",
        "<input type=\"url\" data-admin-field=\"quick-link.url\" placeholder=\"https://crosspointe.tv\" value=\"",
        escapeAttr_(draft.url || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"quick-link.active\"",
        draft.active ? " checked" : "",
        ">",
        "<span>Show this link in Central</span>",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"quick-link.sunday_only\"",
        draft.sunday_only ? " checked" : "",
        ">",
        "<span>Sunday Only</span>",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-quick-link\"",
        saveDisabled ? " disabled" : "",
        ">",
        escapeHtml_(getQuickLinksSaveButtonLabel_()),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-quick-link-form\"",
        adminState.quickLinksSaving || adminState.quickLinksPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.quickLinksEditingId ?
              "Cancel Edit" :
              "Clear Form",
        ),
        "</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderQuickLinksList_() {
    var canReorder = canReorderSortableSection_("quickLinks") &&
      adminState.quickLinksItems.length > 1;

    if (!isActiveAdminUserRecord_()) {
      return "";
    }

    if (adminState.quickLinksLoading && !adminState.quickLinksLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Quick Links</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Reading the current quick links now.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.quickLinksItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Quick Links</strong>",
        renderStatusPill_(
            adminState.quickLinksError ? "Read failed" : "Empty collection",
            adminState.quickLinksError ? "is-warn" : "is-live",
        ),
        "</div>",
        renderAdminNote_(
            adminState.quickLinksError ?
              "The current quick links could not be read right now." :
              "No quick links are currently published in Firestore. The Quick Links section will stay hidden in Central until you add items here.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Quick Links</strong>",
      renderStatusPill_(
          adminState.quickLinksItems.length + " loaded",
          "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          getSortableListInstruction_(canReorder),
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"quickLinks\">",
      adminState.quickLinksItems.map(function(item) {
        return [
          renderSortableListItemStart_(
              "quickLinks",
              item,
              !canReorder,
              item.title || "quick link",
          ),
          "<div class=\"central-admin-list-main\">",
          "<strong>", escapeHtml_(item.title || "Untitled Link"), "</strong>",
          "<a class=\"central-admin-inline-link\" href=\"", escapeAttr_(item.url || "#"), "\" target=\"_blank\" rel=\"noopener\">",
          escapeHtml_(item.url || "No URL"),
          "</a>",
          "<div class=\"central-admin-page-meta\">",
          renderInlineMeta_("Status", item.active ? "Active" : "Hidden"),
          renderInlineMeta_(
              "Audience",
              item.sunday_only ? "Sunday Only" : "All Modes",
          ),
          "</div>",
          "</div>",
          "<div class=\"central-admin-list-actions\">",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-quick-link\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.quickLinksSaving || adminState.quickLinksPublishing ? " disabled" : "",
          ">Edit</button>",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-quick-link\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.quickLinksSaving || adminState.quickLinksPublishing ? " disabled" : "",
          ">Delete</button>",
          "</div>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderStatusBannerEditor_() {
    var permission = getPageAccessLevel_("statusBanner");
    var canEdit = canEditStatusBanner_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var draft = adminState.statusBannerDraft || createEmptyStatusBannerDraft_();
    var liveBanner = adminState.statusBannerPublishedCurrent;
    var bannerIsLive = !!(
      adminState.statusBannerPublishedDocExists &&
      liveBanner &&
      liveBanner.active
    );

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Banner Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The banner editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Banner Editor</strong>",
      renderStatusPill_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "Approval required" :
              (bannerIsLive ?
                "Can publish live preview" :
                "Can change preview state")) :
            "Read only",
          canEdit ?
            (actionConfig.mode === "submit" ? "is-live" : "is-safe") :
            "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            (actionConfig.mode === "submit" ?
              "Submit banner changes for approval here. An admin can then approve or reject them from the Change Requests page." :
              "Publish updates the Central banner immediately. Hide changes the published banner state right away.") :
            "Your current permission level does not allow editing the status banner.",
      ),
      adminState.statusBannerMessage ?
        renderAdminNote_(adminState.statusBannerMessage) :
        "",
      adminState.statusBannerError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.statusBannerError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Headline</span>",
        "<input type=\"text\" data-admin-field=\"status-banner.title\" maxlength=\"90\" placeholder=\"Service update\" value=\"",
        escapeAttr_(draft.title || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>Message</span>",
        "<textarea data-admin-field=\"status-banner.message\" rows=\"4\" placeholder=\"Share the announcement you want everyone to see.\">",
        escapeHtml_(draft.message || ""),
        "</textarea>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button Text</span>",
        "<input type=\"text\" data-admin-field=\"status-banner.button_text\" maxlength=\"40\" placeholder=\"Learn more\" value=\"",
        escapeAttr_(draft.button_text || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button URL</span>",
        "<input type=\"url\" data-admin-field=\"status-banner.button_url\" placeholder=\"https://crosspointe.tv\" value=\"",
        escapeAttr_(draft.button_url || ""),
        "\">",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-status-banner\"",
        adminState.statusBannerPublishing ? " disabled" : "",
        ">",
        adminState.statusBannerPublishing ?
          escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
          escapeHtml_(actionConfig.label),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"hide-status-banner\"",
        adminState.statusBannerPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            actionConfig.mode === "submit" ?
              "Submit Hide Request" :
              "Hide In Preview",
        ),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-status-banner-form\"",
        adminState.statusBannerPublishing ? " disabled" : "",
        ">Reset Changes</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderStatusBannerPreview_() {
    var previewBanner = buildStatusBannerPreviewData_();
    var hasPreviewContent = !!(
      previewBanner.title ||
      previewBanner.message ||
      (previewBanner.button_text && previewBanner.button_url)
    );
    var liveBanner = adminState.statusBannerPublishedCurrent;
    var bannerIsLive = !!(
      adminState.statusBannerPublishedDocExists &&
      liveBanner &&
      liveBanner.active
    );

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Banner Preview</strong>",
      renderStatusPill_(
          bannerIsLive ? "Preview live" : "Working preview",
          bannerIsLive ? "is-safe" : "is-live",
      ),
      "</div>",
      renderAdminNote_(
          bannerIsLive ?
            "Central currently shows the published banner. This card shows the version you would publish or submit next." :
            (adminState.statusBannerPublishedDocExists ?
              "Central currently hides the banner. This card shows what would appear if you publish or submit this update." :
              "No published banner exists yet. This card shows what would appear if you publish or submit this update."),
      ),
      hasPreviewContent ?
        [
          "<div class=\"central-admin-banner-preview\">",
          "<h4>", escapeHtml_(previewBanner.title || "Banner headline"), "</h4>",
          "<p>", escapeHtml_(previewBanner.message || "Banner copy goes here."), "</p>",
          previewBanner.button_text && previewBanner.button_url ?
            "<span class=\"central-admin-preview-button\">" +
            escapeHtml_(previewBanner.button_text) +
            "</span>" :
            "",
          "</div>",
        ].join("") :
        "<div class=\"central-admin-empty\"><p class=\"central-admin-footer-note\">Start typing above to preview the banner here.</p></div>",
      "</div>",
    ].join("");
  }

  function renderQuickLinksPublishPanel_() {
    var permission = getPageAccessLevel_("quickLinks");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditQuickLinks_()) {
      return "";
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Publish Flow</strong>",
      renderStatusPill_(
          actionConfig.mode === "submit" ?
            "Approval required" :
            "Can publish",
          actionConfig.mode === "submit" ? "is-live" : "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          actionConfig.mode === "submit" ?
            "When you submit, admins will see this request in the Change Requests page and can approve or reject it there." :
            "Publishing here updates the Quick Links Central shows right now.",
      ),
      adminState.quickLinksMessage ?
        renderAdminNote_(adminState.quickLinksMessage) :
        "",
      adminState.quickLinksError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.quickLinksError) +
        "</p>" :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-quick-links\"",
      adminState.quickLinksPublishing ? " disabled" : "",
      ">",
      adminState.quickLinksPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderResourcesPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Collection", PUBLISHED_RESOURCES_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          getResourcesPreviewBehaviorLabel_(),
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Resources act one change at a time. You can drag them into a new order, and dropping a resource publishes that reorder instantly or sends it for approval.",
      ),
      "</div>",
      renderResourcesEditorForm_(),
      renderResourcesList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderResourcesEditorForm_() {
    var canEdit = canEditResources_();
    var draft = adminState.resourcesDraft || createEmptyResourceDraft_();
    var saveDisabled = !canEdit ||
      adminState.resourcesSaving ||
      adminState.resourcesPublishing;

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>",
      escapeHtml_(
          adminState.resourcesEditingId ?
            "Edit Resource" :
            "Add Resource",
      ),
      "</strong>",
      renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Use Resources for helpful links, guides, and tools. Saving here immediately publishes the change or submits it for approval, depending on your access." :
            "Your current permission level does not allow editing resources.",
      ),
      adminState.resourcesMessage ?
        renderAdminNote_(adminState.resourcesMessage) :
        "",
      adminState.resourcesError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.resourcesError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Title</span>",
        "<input type=\"text\" data-admin-field=\"resource.title\" maxlength=\"120\" placeholder=\"Prayer Guide\" value=\"",
        escapeAttr_(draft.title || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Type</span>",
        "<input type=\"text\" data-admin-field=\"resource.type\" maxlength=\"60\" placeholder=\"Guide\" value=\"",
        escapeAttr_(draft.type || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>Description</span>",
        "<textarea data-admin-field=\"resource.description\" rows=\"4\" placeholder=\"Tell people what this resource is for.\">",
        escapeHtml_(draft.description || ""),
        "</textarea>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button Text</span>",
        "<input type=\"text\" data-admin-field=\"resource.button_text\" maxlength=\"40\" placeholder=\"Open Resource\" value=\"",
        escapeAttr_(draft.button_text || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button URL</span>",
        "<input type=\"url\" data-admin-field=\"resource.button_url\" placeholder=\"https://crosspointe.tv\" value=\"",
        escapeAttr_(draft.button_url || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"resource.active\"",
        draft.active ? " checked" : "",
        ">",
        "<span>Show this resource in Central</span>",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-resource\"",
        saveDisabled ? " disabled" : "",
        ">",
        escapeHtml_(getResourcesSaveButtonLabel_()),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-resource-form\"",
        adminState.resourcesSaving || adminState.resourcesPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.resourcesEditingId ?
              "Cancel Edit" :
              "Clear Form",
        ),
        "</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderResourcesList_() {
    var canReorder = canReorderSortableSection_("resources") &&
      adminState.resourcesItems.length > 1;

    if (!isActiveAdminUserRecord_()) {
      return "";
    }

    if (adminState.resourcesLoading && !adminState.resourcesLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Resources</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Reading the current resources now.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.resourcesItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Resources</strong>",
        renderStatusPill_(
            adminState.resourcesError ? "Read failed" : "Empty collection",
            adminState.resourcesError ? "is-warn" : "is-live",
        ),
        "</div>",
        renderAdminNote_(
            adminState.resourcesError ?
              "The current resources could not be read right now." :
              "No resources are currently published in Firestore. The Resources section will stay hidden in Central until you add items here.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Resources</strong>",
      renderStatusPill_(
          adminState.resourcesItems.length + " loaded",
          "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          getSortableListInstruction_(canReorder),
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"resources\">",
      adminState.resourcesItems.map(function(item) {
        return [
          renderSortableListItemStart_(
              "resources",
              item,
              !canReorder,
              item.title || "resource",
          ),
          "<div class=\"central-admin-list-main\">",
          "<strong>", escapeHtml_(item.title || "Untitled Resource"), "</strong>",
          item.description ?
            "<p class=\"central-admin-footer-note\">" +
            escapeHtml_(item.description) +
            "</p>" :
            "",
          item.button_url ?
            "<a class=\"central-admin-inline-link\" href=\"" +
            escapeAttr_(item.button_url) +
            "\" target=\"_blank\" rel=\"noopener\">" +
            escapeHtml_(item.button_text || item.button_url) +
            "</a>" :
            "",
          "<div class=\"central-admin-page-meta\">",
          renderInlineMeta_("Type", item.type || "General"),
          renderInlineMeta_("Status", item.active ? "Active" : "Hidden"),
          "</div>",
          "</div>",
          "<div class=\"central-admin-list-actions\">",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-resource\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.resourcesSaving || adminState.resourcesPublishing ? " disabled" : "",
          ">Edit</button>",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-resource\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.resourcesSaving || adminState.resourcesPublishing ? " disabled" : "",
          ">Delete</button>",
          "</div>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderResourcesPublishPanel_() {
    var permission = getPageAccessLevel_("resources");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditResources_()) {
      return "";
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Publish Flow</strong>",
      renderStatusPill_(
          actionConfig.mode === "submit" ?
            "Approval required" :
            "Can publish",
          actionConfig.mode === "submit" ? "is-live" : "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          actionConfig.mode === "submit" ?
            "When you submit, admins will see this request in the Change Requests page and can approve or reject it there." :
            "Publishing here updates the Resources Central shows right now.",
      ),
      adminState.resourcesMessage ?
        renderAdminNote_(adminState.resourcesMessage) :
        "",
      adminState.resourcesError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.resourcesError) +
        "</p>" :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-resources\"",
      adminState.resourcesPublishing ? " disabled" : "",
      ">",
      adminState.resourcesPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderCampaignsPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Collection", PUBLISHED_CAMPAIGNS_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          getCampaignsPreviewBehaviorLabel_(),
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Campaigns act one change at a time. You can drag them into a new order, and dropping a campaign publishes that reorder instantly or sends it for approval.",
      ),
      "</div>",
      renderCampaignsEditorForm_(),
      renderCampaignsList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderCampaignsEditorForm_() {
    var canEdit = canEditCampaigns_();
    var draft = adminState.campaignsDraft || createEmptyCampaignDraft_();
    var saveDisabled = !canEdit ||
      adminState.campaignsSaving ||
      adminState.campaignsPublishing;

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>",
      escapeHtml_(
          adminState.campaignsEditingId ?
            "Edit Campaign" :
            "Add Campaign",
      ),
      "</strong>",
      renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Use Campaigns for church-wide initiatives and featured calls to action. Saving here immediately publishes the change or submits it for approval, depending on your access." :
            "Your current permission level does not allow editing campaigns.",
      ),
      adminState.campaignsMessage ?
        renderAdminNote_(adminState.campaignsMessage) :
        "",
      adminState.campaignsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.campaignsError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Title</span>",
        "<input type=\"text\" data-admin-field=\"campaign.title\" maxlength=\"120\" placeholder=\"Back to School Drive\" value=\"",
        escapeAttr_(draft.title || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>Description</span>",
        "<textarea data-admin-field=\"campaign.description\" rows=\"4\" placeholder=\"Tell people what this campaign is about and what action to take.\">",
        escapeHtml_(draft.description || ""),
        "</textarea>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button Text</span>",
        "<input type=\"text\" data-admin-field=\"campaign.button_text\" maxlength=\"40\" placeholder=\"Learn More\" value=\"",
        escapeAttr_(draft.button_text || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button URL</span>",
        "<input type=\"url\" data-admin-field=\"campaign.button_url\" placeholder=\"https://crosspointe.tv\" value=\"",
        escapeAttr_(draft.button_url || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"campaign.ongoing\"",
        draft.ongoing ? " checked" : "",
        ">",
        "<span>Ongoing campaign</span>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Start Date</span>",
        "<input type=\"date\" data-admin-field=\"campaign.start_date\" value=\"",
        escapeAttr_(draft.start_date || ""),
        "\"",
        draft.ongoing ? " disabled" : "",
        ">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>End Date</span>",
        "<input type=\"date\" data-admin-field=\"campaign.end_date\" value=\"",
        escapeAttr_(draft.end_date || ""),
        "\"",
        draft.ongoing ? " disabled" : "",
        ">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"campaign.active\"",
        draft.active ? " checked" : "",
        ">",
        "<span>Show this campaign in Central</span>",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-campaign\"",
        saveDisabled ? " disabled" : "",
        ">",
        escapeHtml_(getCampaignsSaveButtonLabel_()),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-campaign-form\"",
        adminState.campaignsSaving || adminState.campaignsPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.campaignsEditingId ?
              "Cancel Edit" :
              "Clear Form",
        ),
        "</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderCampaignsList_() {
    var canReorder = canReorderSortableSection_("campaigns") &&
      adminState.campaignsItems.length > 1;

    if (!isActiveAdminUserRecord_()) {
      return "";
    }

    if (adminState.campaignsLoading && !adminState.campaignsLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Campaigns</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Reading the current campaigns now.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.campaignsItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Campaigns</strong>",
        renderStatusPill_(
            adminState.campaignsError ? "Read failed" : "Empty collection",
            adminState.campaignsError ? "is-warn" : "is-live",
        ),
        "</div>",
        renderAdminNote_(
            adminState.campaignsError ?
              "The current campaigns could not be read right now." :
              "No campaigns are currently published in Firestore. The Campaigns section will stay hidden in Central until you add items here.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Campaigns</strong>",
      renderStatusPill_(
          adminState.campaignsItems.length + " loaded",
          "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          getSortableListInstruction_(canReorder),
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"campaigns\">",
      adminState.campaignsItems.map(function(item) {
        return [
          renderSortableListItemStart_(
              "campaigns",
              item,
              !canReorder,
              item.title || "campaign",
          ),
          "<div class=\"central-admin-list-main\">",
          "<strong>", escapeHtml_(item.title || "Untitled Campaign"), "</strong>",
          item.description ?
            "<p class=\"central-admin-footer-note\">" +
            escapeHtml_(item.description) +
            "</p>" :
            "",
          item.button_url ?
            "<a class=\"central-admin-inline-link\" href=\"" +
            escapeAttr_(item.button_url) +
            "\" target=\"_blank\" rel=\"noopener\">" +
            escapeHtml_(item.button_text || item.button_url) +
            "</a>" :
            "",
          "<div class=\"central-admin-page-meta\">",
          renderInlineMeta_("Schedule", getCampaignScheduleLabel_(item)),
          renderInlineMeta_("Status", item.active ? "Active" : "Hidden"),
          "</div>",
          "</div>",
          "<div class=\"central-admin-list-actions\">",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-campaign\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.campaignsSaving || adminState.campaignsPublishing ? " disabled" : "",
          ">Edit</button>",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-campaign\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.campaignsSaving || adminState.campaignsPublishing ? " disabled" : "",
          ">Delete</button>",
          "</div>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderCampaignsPublishPanel_() {
    var permission = getPageAccessLevel_("campaigns");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditCampaigns_()) {
      return "";
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Next Step</strong>",
      renderStatusPill_(
          actionConfig.mode === "submit" ?
            "Approval required" :
            "Can publish",
          actionConfig.mode === "submit" ? "is-live" : "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          actionConfig.mode === "submit" ?
            "When you submit, admins will see this request in the Change Requests page and can approve or reject it there." :
            "Publishing here updates the Campaigns Central shows right now.",
      ),
      adminState.campaignsMessage ?
        renderAdminNote_(adminState.campaignsMessage) :
        "",
      adminState.campaignsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.campaignsError) +
        "</p>" :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-campaigns\"",
      adminState.campaignsPublishing ? " disabled" : "",
      ">",
      adminState.campaignsPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderServeNeedsPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Collection", PUBLISHED_SERVE_NEEDS_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          getServeNeedsPreviewBehaviorLabel_(),
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Serve Needs act one change at a time. You can drag them into a new order, and dropping a need publishes that reorder instantly or sends it for approval.",
      ),
      "</div>",
      renderServeNeedsEditorForm_(),
      renderServeNeedsList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderServeNeedsEditorForm_() {
    var canEdit = canEditServeNeeds_();
    var draft = adminState.serveNeedsDraft || createEmptyServeNeedDraft_();
    var saveDisabled = !canEdit ||
      adminState.serveNeedsSaving ||
      adminState.serveNeedsPublishing;

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>",
      escapeHtml_(
          adminState.serveNeedsEditingId ?
            "Edit Serve Need" :
            "Add Serve Need",
      ),
      "</strong>",
      renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Use Serve Needs for ministry volunteer opportunities. The public button opens a contact form, and this record stores the ministry contact email that will receive the interest." :
            "Your current permission level does not allow editing serve needs.",
      ),
      adminState.serveNeedsMessage ?
        renderAdminNote_(adminState.serveNeedsMessage) :
        "",
      adminState.serveNeedsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.serveNeedsError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Need</span>",
        "<input type=\"text\" data-admin-field=\"serve-need.need\" maxlength=\"120\" placeholder=\"Production Team\" value=\"",
        escapeAttr_(draft.need || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Ministry</span>",
        "<input type=\"text\" data-admin-field=\"serve-need.ministry\" maxlength=\"80\" placeholder=\"Worship\" value=\"",
        escapeAttr_(draft.ministry || ""),
        "\">",
        "</label>",
        renderAdminSelectField_({
          label: "Priority Level",
          field: "serve-need.priority",
          value: draft.priority || "normal",
          options: ["low", "normal", "high", "urgent"].map(function(option) {
            return {
              value: option,
              label: option.charAt(0).toUpperCase() + option.slice(1),
            };
          }),
        }),
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>Description</span>",
        "<textarea data-admin-field=\"serve-need.description\" rows=\"4\" placeholder=\"Tell people what this role does and why it matters.\">",
        escapeHtml_(draft.description || ""),
        "</textarea>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button Text</span>",
        "<input type=\"text\" data-admin-field=\"serve-need.button_text\" maxlength=\"40\" placeholder=\"Share Interest\" value=\"",
        escapeAttr_(draft.button_text || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Contact Email</span>",
        "<input type=\"email\" data-admin-field=\"serve-need.contact_email\" placeholder=\"ministry@crosspointe.tv\" value=\"",
        escapeAttr_(draft.contact_email || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"serve-need.active\"",
        draft.active ? " checked" : "",
        ">",
        "<span>Show this serve need in Central</span>",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-serve-need\"",
        saveDisabled ? " disabled" : "",
        ">",
        escapeHtml_(getServeNeedsSaveButtonLabel_()),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-serve-need-form\"",
        adminState.serveNeedsSaving || adminState.serveNeedsPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.serveNeedsEditingId ?
              "Cancel Edit" :
              "Clear Form",
        ),
        "</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderServeNeedsList_() {
    var canReorder = canReorderSortableSection_("serveNeeds") &&
      adminState.serveNeedsItems.length > 1;

    if (!isActiveAdminUserRecord_()) {
      return "";
    }

    if (adminState.serveNeedsLoading && !adminState.serveNeedsLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Serve Needs</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Reading the current serve needs now.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.serveNeedsItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Serve Needs</strong>",
        renderStatusPill_(
            adminState.serveNeedsError ? "Read failed" : "Empty collection",
            adminState.serveNeedsError ? "is-warn" : "is-live",
        ),
        "</div>",
        renderAdminNote_(
            adminState.serveNeedsError ?
              "The current serve needs could not be read right now." :
              "No serve needs are currently published in Firestore. The Serve Needs section will stay hidden in Central until you add items here.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Serve Needs</strong>",
      renderStatusPill_(
          adminState.serveNeedsItems.length + " loaded",
          "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          getSortableListInstruction_(canReorder),
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"serveNeeds\">",
      adminState.serveNeedsItems.map(function(item) {
        return [
          renderSortableListItemStart_(
              "serveNeeds",
              item,
              !canReorder,
              item.need || "serve need",
          ),
          "<div class=\"central-admin-list-main\">",
          "<strong>", escapeHtml_(item.need || "Untitled Serve Need"), "</strong>",
          item.description ?
            "<p class=\"central-admin-footer-note\">" +
            escapeHtml_(item.description) +
            "</p>" :
            "",
          item.contact_email ?
            "<a class=\"central-admin-inline-link\" href=\"mailto:" +
            escapeAttr_(item.contact_email) +
            "\">" +
            escapeHtml_(item.contact_email) +
            "</a>" :
            "",
          "<div class=\"central-admin-page-meta\">",
          renderInlineMeta_("Ministry", item.ministry || "General"),
          renderInlineMeta_("Priority", item.priority || "normal"),
          renderInlineMeta_("Button", item.button_text || "None"),
          renderInlineMeta_("Status", item.active ? "Active" : "Hidden"),
          "</div>",
          "</div>",
          "<div class=\"central-admin-list-actions\">",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-serve-need\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.serveNeedsSaving || adminState.serveNeedsPublishing ? " disabled" : "",
          ">Edit</button>",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-serve-need\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.serveNeedsSaving || adminState.serveNeedsPublishing ? " disabled" : "",
          ">Delete</button>",
          "</div>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderServeNeedsPublishPanel_() {
    var permission = getPageAccessLevel_("serveNeeds");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditServeNeeds_()) {
      return "";
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Publish Flow</strong>",
      renderStatusPill_(
          actionConfig.mode === "submit" ?
            "Approval required" :
            "Can publish",
          actionConfig.mode === "submit" ? "is-live" : "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          actionConfig.mode === "submit" ?
            "When you submit, admins will see this request in the Change Requests page and can approve or reject it there." :
            "Publishing here updates the Serve Needs Central shows right now.",
      ),
      adminState.serveNeedsMessage ?
        renderAdminNote_(adminState.serveNeedsMessage) :
        "",
      adminState.serveNeedsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.serveNeedsError) +
        "</p>" :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-serve-needs\"",
      adminState.serveNeedsPublishing ? " disabled" : "",
      ">",
      adminState.serveNeedsPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderNextStepsPagePanel_(currentPage) {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(currentPage.status, "is-safe"),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Preview Collection", PUBLISHED_NEXT_STEPS_COLLECTION_PATH),
      renderInlineMeta_(
          "Public behavior",
          getNextStepsPreviewBehaviorLabel_(),
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Published workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          "Next Steps act one change at a time. You can drag them into a new order, and dropping a card publishes that reorder instantly or sends it for approval.",
      ),
      "</div>",
      renderNextStepsEditorForm_(),
      renderNextStepsList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderNextStepsEditorForm_() {
    var canEdit = canEditNextSteps_();
    var draft = adminState.nextStepsDraft || createEmptyNextStepDraft_();
    var saveDisabled = !canEdit ||
      adminState.nextStepsSaving ||
      adminState.nextStepsPublishing;

    if (!isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Editor</strong>",
        renderStatusPill_("Waiting for access", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Finish the admin-access check above first. The editor unlocks after your Firestore admin user record is active.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>",
      escapeHtml_(
          adminState.nextStepsEditingId ?
            "Edit Next Step" :
            "Add Next Step",
      ),
      "</strong>",
      renderStatusPill_(
          canEdit ? "Write access" : "Read only",
          canEdit ? "is-safe" : "is-warn",
      ),
      "</div>",
      renderAdminNote_(
          canEdit ?
            "Use Next Steps for connection cards and action pathways. Saving here immediately publishes the change or submits it for approval, depending on your access." :
            "Your current permission level does not allow editing Next Steps.",
      ),
      adminState.nextStepsMessage ?
        renderAdminNote_(adminState.nextStepsMessage) :
        "",
      adminState.nextStepsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.nextStepsError) +
        "</p>" :
        "",
      canEdit ? [
        "<div class=\"central-admin-form-grid\">",
        "<label class=\"central-admin-field\">",
        "<span>Title</span>",
        "<input type=\"text\" data-admin-field=\"next-step.title\" maxlength=\"120\" placeholder=\"Join a Group\" value=\"",
        escapeAttr_(draft.title || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field central-admin-field-wide\">",
        "<span>Description</span>",
        "<textarea data-admin-field=\"next-step.description\" rows=\"4\" placeholder=\"Tell people what this next step is and why it matters.\">",
        escapeHtml_(draft.description || ""),
        "</textarea>",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button Text</span>",
        "<input type=\"text\" data-admin-field=\"next-step.button_text\" maxlength=\"40\" placeholder=\"Learn More\" value=\"",
        escapeAttr_(draft.button_text || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-field\">",
        "<span>Button URL</span>",
        "<input type=\"url\" data-admin-field=\"next-step.button_url\" placeholder=\"https://crosspointe.tv\" value=\"",
        escapeAttr_(draft.button_url || ""),
        "\">",
        "</label>",
        "<label class=\"central-admin-checkbox\">",
        "<input type=\"checkbox\" data-admin-field=\"next-step.active\"",
        draft.active ? " checked" : "",
        ">",
        "<span>Show this next step in Central</span>",
        "</label>",
        "</div>",
        "<div class=\"central-admin-action-row\">",
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"save-next-step\"",
        saveDisabled ? " disabled" : "",
        ">",
        escapeHtml_(getNextStepsSaveButtonLabel_()),
        "</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reset-next-step-form\"",
        adminState.nextStepsSaving || adminState.nextStepsPublishing ? " disabled" : "",
        ">",
        escapeHtml_(
            adminState.nextStepsEditingId ?
              "Cancel Edit" :
              "Clear Form",
        ),
        "</button>",
        "</div>",
      ].join("") : "",
      "</div>",
    ].join("");
  }

  function renderNextStepsList_() {
    var canReorder = canReorderSortableSection_("nextSteps") &&
      adminState.nextStepsItems.length > 1;

    if (!isActiveAdminUserRecord_()) {
      return "";
    }

    if (adminState.nextStepsLoading && !adminState.nextStepsLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Next Steps</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Reading the current Next Steps now.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.nextStepsItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Next Steps</strong>",
        renderStatusPill_(
            adminState.nextStepsError ? "Read failed" : "Empty collection",
            adminState.nextStepsError ? "is-warn" : "is-live",
        ),
        "</div>",
        renderAdminNote_(
            adminState.nextStepsError ?
              "The current Next Steps could not be read right now." :
              "No Next Steps are currently published in Firestore. The Next Steps section will stay hidden in Central until you add items here.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Next Steps</strong>",
      renderStatusPill_(
          adminState.nextStepsItems.length + " loaded",
          "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          getSortableListInstruction_(canReorder),
      ),
      "<div class=\"central-admin-list\" data-admin-sort-list=\"true\" data-admin-sort-section=\"nextSteps\">",
      adminState.nextStepsItems.map(function(item) {
        return [
          renderSortableListItemStart_(
              "nextSteps",
              item,
              !canReorder,
              item.title || "next step",
          ),
          "<div class=\"central-admin-list-main\">",
          "<strong>", escapeHtml_(item.title || "Untitled Next Step"), "</strong>",
          item.description ?
            "<p class=\"central-admin-footer-note\">" +
            escapeHtml_(item.description) +
            "</p>" :
            "",
          item.button_url ?
            "<a class=\"central-admin-inline-link\" href=\"" +
            escapeAttr_(item.button_url) +
            "\" target=\"_blank\" rel=\"noopener\">" +
            escapeHtml_(item.button_text || item.button_url) +
            "</a>" :
            "",
          "<div class=\"central-admin-page-meta\">",
          renderInlineMeta_("Status", item.active ? "Active" : "Hidden"),
          "</div>",
          "</div>",
          "<div class=\"central-admin-list-actions\">",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"edit-next-step\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.nextStepsSaving || adminState.nextStepsPublishing ? " disabled" : "",
          ">Edit</button>",
          "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"delete-next-step\" data-admin-doc-id=\"",
          escapeAttr_(item.id),
          "\"",
          adminState.nextStepsSaving || adminState.nextStepsPublishing ? " disabled" : "",
          ">Delete</button>",
          "</div>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderNextStepsPublishPanel_() {
    var permission = getPageAccessLevel_("nextSteps");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditNextSteps_()) {
      return "";
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Next Step</strong>",
      renderStatusPill_(
          actionConfig.mode === "submit" ?
            "Approval required" :
            "Can publish",
          actionConfig.mode === "submit" ? "is-live" : "is-safe",
      ),
      "</div>",
      renderAdminNote_(
          actionConfig.mode === "submit" ?
            "When you submit, admins will see this request in the Change Requests page and can approve or reject it there." :
            "Publishing here updates the Next Steps Central shows right now.",
      ),
      adminState.nextStepsMessage ?
        renderAdminNote_(adminState.nextStepsMessage) :
        "",
      adminState.nextStepsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.nextStepsError) +
        "</p>" :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"publish-next-steps\"",
      adminState.nextStepsPublishing ? " disabled" : "",
      ">",
      adminState.nextStepsPublishing ?
        escapeHtml_(getPrimaryContentBusyLabel_(actionConfig)) :
        escapeHtml_(actionConfig.label),
      "</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function renderChangeRequestsPagePanel_(currentPage) {
    var canReview = canReviewChangeRequests_();

    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>", escapeHtml_(currentPage.label), "</h3>",
      "<p>", escapeHtml_(currentPage.summary), "</p>",
      "</div>",
      renderStatusPill_(
          adminState.changeRequestsPendingCount ?
            String(adminState.changeRequestsPendingCount) + " pending" :
            "Up to date",
          adminState.changeRequestsPendingCount ? "is-live" : "is-safe",
      ),
      "</div>",
      "<div class=\"central-admin-page-body\">",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Route", currentPage.route),
      renderInlineMeta_("Collection", currentPage.collectionPath || "Not set"),
      renderInlineMeta_(
          "Publish target",
          "Preview only",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>How this page behaves</strong>",
      renderStatusPill_("Approval workflow", "is-live"),
      "</div>",
      renderAdminNote_(
          canReview ?
            "Approving a request publishes that content immediately. Rejecting leaves the current published content unchanged." :
            "This page shows the current request queue. Review actions only unlock for users with change-request approval access.",
      ),
      adminState.changeRequestsMessage ?
        renderAdminNote_(adminState.changeRequestsMessage) :
        "",
      adminState.changeRequestsError ?
        "<p class=\"central-admin-note\">" +
        escapeHtml_(adminState.changeRequestsError) +
        "</p>" :
        "",
      "</div>",
      renderChangeRequestsList_(),
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderChangeRequestsList_() {
    if (adminState.changeRequestsLoading && !adminState.changeRequestsLoaded) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Queue</strong>",
        renderStatusPill_("Loading", "is-warn"),
        "</div>",
        renderAdminNote_("Reading the current approval queue now."),
        "</div>",
      ].join("");
    }

    if (!adminState.changeRequestsItems.length) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Current Queue</strong>",
        renderStatusPill_(
            adminState.changeRequestsError ? "Read failed" : "Empty",
            adminState.changeRequestsError ? "is-warn" : "is-safe",
        ),
        "</div>",
        renderAdminNote_(
            adminState.changeRequestsError ?
              "The approval queue could not be read right now." :
              "No change requests are waiting right now.",
        ),
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current Queue</strong>",
      renderStatusPill_(
          String(adminState.changeRequestsItems.length) + " loaded",
          "is-safe",
      ),
      "</div>",
      "<div class=\"central-admin-list\">",
      adminState.changeRequestsItems.map(function(item) {
        return renderChangeRequestListItem_(item);
      }).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function renderChangeRequestListItem_(item) {
    var isPending = item.status === "pending";
    var canReview = canReviewChangeRequests_();
    var isExpanded = adminState.changeRequestsExpandedId === item.id;

    return [
      "<article class=\"central-admin-list-item central-admin-change-request-item",
      isExpanded ? " is-expanded" : "",
      "\">",
      "<div class=\"central-admin-list-main\">",
      "<strong>", escapeHtml_(item.summary || "Untitled request"), "</strong>",
      "<div class=\"central-admin-page-meta\">",
      renderInlineMeta_("Section", item.sectionLabel || item.section || "Unknown"),
      renderInlineMeta_("Action", item.operation === "hide" ? "Hide" : "Publish"),
      renderInlineMeta_("Status", getChangeRequestStatusLabel_(item.status)),
      "</div>",
      "<p class=\"central-admin-note\">",
      escapeHtml_(
          (item.submittedByName || item.submittedByEmail || "Unknown submitter") +
          " submitted this on " + formatAdminTimestamp_(item.createdAt),
      ),
      "</p>",
      "</div>",
      "<div class=\"central-admin-list-actions\">",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"toggle-change-request\" data-admin-request-id=\"",
      escapeAttr_(item.id),
      "\"",
      adminState.changeRequestsActionPending ? " disabled" : "",
      ">",
      escapeHtml_(isExpanded ? "Hide Request" : "View Request"),
      "</button>",
      renderStatusPill_(
          getChangeRequestStatusLabel_(item.status),
          isPending ? "is-live" : "is-safe",
      ),
      "</div>",
      isExpanded ?
        renderChangeRequestExpandedDetail_(item, canReview, isPending) :
        "",
      "</article>",
    ].join("");
  }

  function renderChangeRequestExpandedDetail_(item, canReview, isPending) {
    var overviewSections = buildChangeRequestOverviewSections_(item);

    return [
      "<div class=\"central-admin-change-request-detail\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Request Details</strong>",
      renderStatusPill_("Expanded", "is-safe"),
      "</div>",
      "<div class=\"central-admin-item-meta\">",
      renderInlineMeta_("Request ID", item.id || "Unknown"),
      renderInlineMeta_("Target", item.target || "Preview"),
      item.updatedAt ?
        renderInlineMeta_("Updated", formatAdminTimestamp_(item.updatedAt)) :
        "",
      item.submittedByUid ?
        renderInlineMeta_("Submitter UID", item.submittedByUid) :
        "",
      "</div>",
      overviewSections.length ?
        [
          "<div class=\"central-admin-change-request-sections\">",
          overviewSections.map(function(section) {
            return renderChangeRequestOverviewSection_(section);
          }).join(""),
          "</div>",
        ].join("") :
        renderAdminNote_(
            "This request does not have a readable summary yet, but the approval actions below will still work.",
        ),
      "<div class=\"central-admin-action-row central-admin-change-request-action-row\">",
      isPending && canReview ? [
        "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"approve-change-request\" data-admin-request-id=\"",
        escapeAttr_(item.id),
        "\"",
        adminState.changeRequestsActionPending ? " disabled" : "",
        ">Approve</button>",
        "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"reject-change-request\" data-admin-request-id=\"",
        escapeAttr_(item.id),
        "\"",
        adminState.changeRequestsActionPending ? " disabled" : "",
        ">Reject</button>",
      ].join("") :
        "",
      "<button type=\"button\" class=\"central-admin-link-button is-secondary\" data-admin-action=\"close-change-request\"",
      adminState.changeRequestsActionPending ? " disabled" : "",
      ">Close</button>",
      "</div>",
      "</div>",
    ].join("");
  }

  function buildChangeRequestOverviewSections_(item) {
    var sections = [];
    var listSection = buildChangeRequestListOverviewSection_(item);
    var payloadSection = null;

    if (listSection) {
      sections.push(listSection);
    } else {
      payloadSection = buildChangeRequestPayloadOverviewSection_(item);
      if (payloadSection) {
        sections.push(payloadSection);
      }
    }

    if (!sections.length && item && item.summary) {
      sections.push({
        label: "Requested change",
        fields: [
          {
            label: "Summary",
            valueHtml: formatChangeRequestTextValueHtml_(item.summary),
            isEmpty: false,
          },
        ],
      });
    }

    return sections;
  }

  function buildChangeRequestListOverviewSection_(item) {
    var config = getChangeRequestListOverviewConfig_(
        item && item.section,
    );
    var detailFields = item && item.detailFields &&
      typeof item.detailFields === "object" ?
      item.detailFields :
      {};
    var changeSet = config ? detailFields[config.changeSetKey] : null;
    var baselineItems = config && Array.isArray(detailFields[config.baselineKey]) ?
      detailFields[config.baselineKey] :
      [];
    var breakdown = config && detailFields[config.breakdownKey] &&
      typeof detailFields[config.breakdownKey] === "object" ?
      detailFields[config.breakdownKey] :
      null;
    var groups = [];
    var badges = [];

    if (!config || !changeSet || typeof changeSet !== "object") {
      return null;
    }

    groups = buildChangeRequestListOverviewGroups_(
        config,
        baselineItems,
        changeSet,
    );
    badges = buildChangeRequestOverviewBadges_(breakdown, groups);

    if (!groups.length && !badges.length) {
      return null;
    }

    return {
      label: "Requested changes",
      note:
        "Only the touched items in this request will be applied. The rest of the list stays as-is.",
      badges: badges,
      groups: groups,
    };
  }

  function buildChangeRequestListOverviewGroups_(config, baselineItems, changeSet) {
    var baselineById = {};
    var addedEntries = [];
    var updatedEntries = [];
    var removedEntries = [];

    (Array.isArray(baselineItems) ? baselineItems : []).forEach(function(item) {
      var itemId = String(item && item.id || "").trim();
      if (!itemId) {
        return;
      }

      baselineById[itemId] = item;
    });

    (Array.isArray(changeSet.upsertItems) ? changeSet.upsertItems : []).forEach(
        function(item) {
          var itemId = String(item && item.id || "").trim();
          var baselineItem = itemId ? baselineById[itemId] : null;
          var entry = createChangeRequestOverviewEntry_(
              config.formatItemTitle(item, baselineItem),
              config.formatItemMeta(item, baselineItem),
          );

          if (!baselineItem) {
            addedEntries.push(entry);
            return;
          }

          if (!config.areItemsEqual(item, baselineItem)) {
            updatedEntries.push(entry);
          }
        },
    );

    (Array.isArray(changeSet.removeIds) ? changeSet.removeIds : []).forEach(
        function(removeId) {
          var itemId = String(removeId || "").trim();
          var baselineItem = itemId ? baselineById[itemId] : null;
          removedEntries.push(
              createChangeRequestOverviewEntry_(
                  config.formatItemTitle(null, baselineItem),
                  config.formatRemovedMeta(baselineItem),
              ),
          );
        },
    );

    return [
      buildChangeRequestOverviewGroup_("Adding", "is-safe", addedEntries),
      buildChangeRequestOverviewGroup_("Updating", "", updatedEntries),
      buildChangeRequestOverviewGroup_("Removing", "is-warn", removedEntries),
    ].filter(Boolean);
  }

  function buildChangeRequestOverviewGroup_(label, toneClass, entries) {
    var nextEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];

    if (!nextEntries.length) {
      return null;
    }

    return {
      label: label,
      toneClass: toneClass || "",
      count: nextEntries.length,
      entries: nextEntries,
    };
  }

  function createChangeRequestOverviewEntry_(title, meta) {
    return {
      title: String(title || "").trim() || "Untitled item",
      meta: String(meta || "").trim(),
    };
  }

  function buildChangeRequestOverviewBadges_(breakdown, groups) {
    var badges = [];
    var summary = breakdown || {};
    var addedCount = getChangeRequestOverviewCount_(
        summary.added,
        groups,
        "Adding",
    );
    var updatedCount = getChangeRequestOverviewCount_(
        summary.updated,
        groups,
        "Updating",
    );
    var removedCount = getChangeRequestOverviewCount_(
        summary.removed,
        groups,
        "Removing",
    );

    if (addedCount > 0) {
      badges.push(renderStatusPill_(String(addedCount) + " added", "is-safe"));
    }

    if (updatedCount > 0) {
      badges.push(renderStatusPill_(String(updatedCount) + " updated", ""));
    }

    if (removedCount > 0) {
      badges.push(renderStatusPill_(String(removedCount) + " removed", "is-warn"));
    }

    return badges;
  }

  function getChangeRequestOverviewCount_(count, groups, label) {
    var numericCount = Number(count);
    var matchedGroup = Array.isArray(groups) ? groups.find(function(group) {
      return group && group.label === label;
    }) : null;

    if (Number.isFinite(numericCount) && numericCount > 0) {
      return numericCount;
    }

    return matchedGroup && Array.isArray(matchedGroup.entries) ?
      matchedGroup.entries.length :
      0;
  }

  function buildChangeRequestPayloadOverviewSection_(item) {
    var config = getChangeRequestPayloadFieldConfig_(item && item.section);
    var payload = item && item.payload &&
      typeof item.payload === "object" &&
      !Array.isArray(item.payload) ?
      item.payload :
      {};
    var fields = [];

    if (config) {
      fields = buildChangeRequestOverviewFieldEntries_(config.fields, payload);

      if (String(item && item.operation || "").trim() === "hide") {
        fields.unshift({
          label: "Action",
          valueHtml: formatChangeRequestTextValueHtml_(
              "Hide this content from preview.",
          ),
          isEmpty: false,
        });
      }

      if (!fields.length) {
        return null;
      }

      return {
        label: config.label,
        note: config.note || "",
        fields: fields,
      };
    }

    return buildGenericChangeRequestOverviewSection_(item);
  }

  function buildChangeRequestOverviewFieldEntries_(fieldConfigs, payload) {
    return (Array.isArray(fieldConfigs) ? fieldConfigs : [])
        .map(function(fieldConfig) {
          return buildChangeRequestOverviewFieldEntry_(fieldConfig, payload);
        })
        .filter(Boolean);
  }

  function buildChangeRequestOverviewFieldEntry_(fieldConfig, payload) {
    var source = payload || {};
    var hasField =
      fieldConfig &&
      fieldConfig.key &&
      Object.prototype.hasOwnProperty.call(source, fieldConfig.key);
    var rawValue = hasField ? source[fieldConfig.key] : "";
    var formattedValue = null;

    if (!fieldConfig || !fieldConfig.key || (!hasField && !fieldConfig.alwaysShow)) {
      return null;
    }

    formattedValue = formatChangeRequestFieldValue_(
        rawValue,
        fieldConfig,
    );

    return {
      label: fieldConfig.label || formatChangeRequestFieldLabel_(fieldConfig.key),
      valueHtml: formattedValue.html,
      isEmpty: formattedValue.isEmpty,
    };
  }

  function buildGenericChangeRequestOverviewSection_(item) {
    var payload = item ? item.payload : null;
    var fields = [];

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      fields = Object.keys(payload)
          .sort()
          .map(function(key) {
            return {
              label: formatChangeRequestFieldLabel_(key),
              valueHtml: formatChangeRequestGenericValueHtml_(payload[key]),
              isEmpty: isChangeRequestGenericValueEmpty_(payload[key]),
            };
          });

      return fields.length ? {
        label: "Requested details",
        fields: fields,
      } : null;
    }

    if (Array.isArray(payload) && payload.length) {
      return {
        label: "Requested details",
        fields: [
          {
            label: "Items",
            valueHtml: formatChangeRequestTextValueHtml_(
                String(payload.length) + " saved items",
            ),
            isEmpty: false,
          },
        ],
      };
    }

    if (payload != null && String(payload).trim()) {
      return {
        label: "Requested details",
        fields: [
          {
            label: "Value",
            valueHtml: formatChangeRequestTextValueHtml_(payload),
            isEmpty: false,
          },
        ],
      };
    }

    return null;
  }

  function renderChangeRequestOverviewSection_(section) {
    return [
      "<section class=\"central-admin-change-request-section\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>", escapeHtml_(section && section.label || "Request Detail"), "</strong>",
      section && Array.isArray(section.badges) && section.badges.length ?
        [
          "<div class=\"central-admin-badges\">",
          section.badges.join(""),
          "</div>",
        ].join("") :
        "",
      "</div>",
      section && section.note ? renderAdminNote_(section.note) : "",
      section && Array.isArray(section.groups) && section.groups.length ?
        [
          "<div class=\"central-admin-change-request-groups\">",
          section.groups.map(function(group) {
            return renderChangeRequestOverviewGroup_(group);
          }).join(""),
          "</div>",
        ].join("") :
        "",
      section && Array.isArray(section.fields) && section.fields.length ?
        [
          "<div class=\"central-admin-change-request-fields\">",
          section.fields.map(function(field) {
            return renderChangeRequestOverviewField_(field);
          }).join(""),
          "</div>",
        ].join("") :
        "",
      "</section>",
    ].join("");
  }

  function renderChangeRequestOverviewGroup_(group) {
    return [
      "<section class=\"central-admin-change-request-group\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>", escapeHtml_(group && group.label || "Changes"), "</strong>",
      renderStatusPill_(
          String(group && group.count || 0) + " item" +
          (Number(group && group.count || 0) === 1 ? "" : "s"),
          group && group.toneClass || "",
      ),
      "</div>",
      "<ul class=\"central-admin-change-request-list\">",
      (group && Array.isArray(group.entries) ? group.entries : []).map(
          function(entry) {
            return renderChangeRequestOverviewListEntry_(entry);
          },
      ).join(""),
      "</ul>",
      "</section>",
    ].join("");
  }

  function renderChangeRequestOverviewListEntry_(entry) {
    return [
      "<li class=\"central-admin-change-request-list-item\">",
      "<strong>", escapeHtml_(entry && entry.title || "Untitled item"), "</strong>",
      entry && entry.meta ?
        "<span>" + formatChangeRequestTextValueHtml_(entry.meta) + "</span>" :
        "",
      "</li>",
    ].join("");
  }

  function renderChangeRequestOverviewField_(field) {
    return [
      "<div class=\"central-admin-change-request-field",
      field && field.isEmpty ? " is-empty" : "",
      "\">",
      "<span class=\"central-admin-change-request-field-label\">",
      escapeHtml_(field && field.label || "Field"),
      "</span>",
      "<span class=\"central-admin-change-request-field-value\">",
      field && field.valueHtml ? field.valueHtml : formatChangeRequestTextValueHtml_("Blank"),
      "</span>",
      "</div>",
    ].join("");
  }

  function getChangeRequestListOverviewConfig_(section) {
    var normalizedSection = String(section || "").trim();

    if (normalizedSection === "quickLinks") {
      return {
        changeSetKey: "quickLinksChangeSet",
        breakdownKey: "quickLinksChangeBreakdown",
        baselineKey: "quickLinksBaselineItems",
        areItemsEqual: areQuickLinkComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.title,
              baselineItem && baselineItem.title,
              "Quick link",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            item && item.active ? "Active" : "Hidden",
            item && item.sunday_only ? "Sunday only" : "",
            item && item.url ? item.url : "",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return joinChangeRequestMetaParts_([
            baselineItem && baselineItem.sunday_only ? "Sunday only" : "",
            baselineItem && baselineItem.url ? baselineItem.url : "",
          ]);
        },
      };
    }

    if (normalizedSection === "resources") {
      return {
        changeSetKey: "resourcesChangeSet",
        breakdownKey: "resourcesChangeBreakdown",
        baselineKey: "resourcesBaselineItems",
        areItemsEqual: areResourceComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.title,
              baselineItem && baselineItem.title,
              "Resource",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            item && item.type ? item.type : "",
            item && item.button_text ? "Button: " + item.button_text : "",
            item && item.active ? "Active" : "Hidden",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return joinChangeRequestMetaParts_([
            baselineItem && baselineItem.type ? baselineItem.type : "",
            baselineItem && baselineItem.button_text ?
              "Button: " + baselineItem.button_text :
              "",
          ]);
        },
      };
    }

    if (normalizedSection === "campaigns") {
      return {
        changeSetKey: "campaignsChangeSet",
        breakdownKey: "campaignsChangeBreakdown",
        baselineKey: "campaignsBaselineItems",
        areItemsEqual: areCampaignComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.title,
              baselineItem && baselineItem.title,
              "Campaign",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            formatChangeRequestCampaignSchedule_(item),
            item && item.button_text ? "Button: " + item.button_text : "",
            item && item.active ? "Active" : "Hidden",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return joinChangeRequestMetaParts_([
            formatChangeRequestCampaignSchedule_(baselineItem),
            baselineItem && baselineItem.button_text ?
              "Button: " + baselineItem.button_text :
              "",
          ]);
        },
      };
    }

    if (normalizedSection === "nextSteps") {
      return {
        changeSetKey: "nextStepsChangeSet",
        breakdownKey: "nextStepsChangeBreakdown",
        baselineKey: "nextStepsBaselineItems",
        areItemsEqual: areNextStepComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.title,
              baselineItem && baselineItem.title,
              "Next step",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            item && item.button_text ? "Button: " + item.button_text : "",
            item && item.active ? "Active" : "Hidden",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return baselineItem && baselineItem.button_text ?
            "Button: " + baselineItem.button_text :
            "";
        },
      };
    }

    if (normalizedSection === "serveNeeds") {
      return {
        changeSetKey: "serveNeedsChangeSet",
        breakdownKey: "serveNeedsChangeBreakdown",
        baselineKey: "serveNeedsBaselineItems",
        areItemsEqual: areServeNeedComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.need,
              baselineItem && baselineItem.need,
              "Serve need",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            item && item.ministry ? item.ministry : "",
            item && item.priority ?
              "Priority: " + formatChangeRequestServeNeedPriority_(item.priority) :
              "",
            item && item.contact_email ? item.contact_email : "",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return joinChangeRequestMetaParts_([
            baselineItem && baselineItem.ministry ? baselineItem.ministry : "",
            baselineItem && baselineItem.priority ?
              "Priority: " +
                formatChangeRequestServeNeedPriority_(baselineItem.priority) :
              "",
          ]);
        },
      };
    }

    if (normalizedSection === "roomRules") {
      return {
        changeSetKey: "roomRulesChangeSet",
        breakdownKey: "roomRulesChangeBreakdown",
        baselineKey: "roomRulesBaselineItems",
        areItemsEqual: areRoomRuleComparableItemsEqual_,
        formatItemTitle: function(item, baselineItem) {
          return getChangeRequestReadableLabel_(
              item && item.match_text,
              baselineItem && baselineItem.match_text,
              "Room rule",
          );
        },
        formatItemMeta: function(item) {
          return joinChangeRequestMetaParts_([
            item && item.match_type ?
              "Match: " + formatRoomRuleMatchTypeLabel_(item.match_type) :
              "",
            item && item.behavior ?
              "Behavior: " + formatRoomRuleBehaviorLabel_(item.behavior) :
              "",
            item && item.display_location ?
              "Display: " + item.display_location :
              "",
          ]);
        },
        formatRemovedMeta: function(baselineItem) {
          return joinChangeRequestMetaParts_([
            baselineItem && baselineItem.match_type ?
              "Match: " +
                formatRoomRuleMatchTypeLabel_(baselineItem.match_type) :
              "",
            baselineItem && baselineItem.behavior ?
              "Behavior: " +
                formatRoomRuleBehaviorLabel_(baselineItem.behavior) :
              "",
          ]);
        },
      };
    }

    return null;
  }

  function getChangeRequestPayloadFieldConfig_(section) {
    var normalizedSection = String(section || "").trim();

    if (normalizedSection === "hubSettings") {
      return {
        label: "Homepage fields",
        fields: [
          {key: "site_title", label: "Site title"},
          {key: "hero_heading", label: "Hero heading"},
          {key: "hero_subheading", label: "Hero subheading"},
          {key: "primary_button_text", label: "Primary button text"},
          {key: "primary_button_url", label: "Primary button URL"},
          {key: "secondary_button_text", label: "Secondary button text"},
          {key: "secondary_button_url", label: "Secondary button URL"},
          {key: "countdown_label", label: "Countdown label"},
          {key: "countdown_title", label: "Countdown title"},
          {key: "countdown_datetime", label: "Countdown date/time", type: "datetime"},
          {
            key: "homepage_modules",
            label: "Homepage modules",
            type: "module-list",
            moduleDefinitions: HUB_HOMEPAGE_MODULE_DEFINITIONS,
          },
        ],
      };
    }

    if (normalizedSection === "hubSunday") {
      return {
        label: "Sunday Mode fields",
        fields: [
          {key: "sunday_eyebrow", label: "Eyebrow"},
          {key: "sunday_heading", label: "Heading"},
          {key: "sunday_subheading", label: "Subheading"},
          {key: "sunday_primary_button_text", label: "Primary button text"},
          {key: "sunday_primary_button_url", label: "Primary button URL"},
          {key: "sunday_secondary_button_text", label: "Secondary button text"},
          {key: "sunday_secondary_button_url", label: "Secondary button URL"},
          {key: "sunday_status_label", label: "Status label"},
          {key: "sunday_speaker_label", label: "Speaker label"},
          {key: "sunday_scripture_label", label: "Scripture label"},
          {key: "sunday_livestream_title", label: "Livestream card title"},
          {key: "sunday_scripture_reference", label: "Scripture reference"},
          {key: "sunday_scripture_title", label: "Scripture title"},
          {key: "sunday_scripture_helper_text", label: "Scripture helper text"},
          {
            key: "sunday_modules",
            label: "Sunday Mode modules",
            type: "module-list",
            moduleDefinitions: HUB_SUNDAY_MODULE_DEFINITIONS,
          },
        ],
      };
    }

    if (normalizedSection === "settingsSunday") {
      return {
        label: "Sunday controls",
        fields: [
          {
            key: "sunday_mode_override",
            label: "Live Sunday Mode override",
            type: "sunday-mode",
          },
          {key: "sunday_mode_start_time", label: "Live Sunday Mode start"},
          {key: "sunday_mode_end_time", label: "Live Sunday Mode end"},
          {
            key: "dev_sunday_mode_override",
            label: "Dev Sunday Mode override",
            type: "sunday-mode",
          },
          {key: "dev_sunday_mode_start_time", label: "Dev Sunday Mode start"},
          {key: "dev_sunday_mode_end_time", label: "Dev Sunday Mode end"},
        ],
      };
    }

    if (normalizedSection === "integrations") {
      return {
        label: "Integration settings",
        fields: [
          {key: "sunday_livestream_url", label: "Livestream link"},
          {key: "sunday_livestream_note", label: "Livestream note"},
          {key: "sunday_scripture_bible_id", label: "Bible ID"},
          {
            key: "google_docs_enabled",
            label: "Google Docs note saving",
            type: "boolean",
            trueLabel: "Enabled",
            falseLabel: "Disabled",
          },
          {
            key: "calendar_integrations_enabled",
            label: "Calendar integrations",
            type: "boolean",
            trueLabel: "Enabled",
            falseLabel: "Disabled",
          },
          {key: "google_web_client_id", label: "Google Docs web client ID"},
        ],
      };
    }

    if (normalizedSection === "thisSunday") {
      return {
        label: "Sunday sermon details",
        fields: [
          {key: "date_iso", label: "Date", type: "date"},
          {key: "series", label: "Series"},
          {key: "sermon_title", label: "Sermon title"},
          {key: "speaker", label: "Speaker"},
          {key: "scripture", label: "Scripture"},
          {key: "note", label: "Notes"},
        ],
      };
    }

    if (normalizedSection === "statusBanner") {
      return {
        label: "Banner details",
        fields: [
          {
            key: "active",
            label: "Visibility",
            type: "boolean",
            trueLabel: "Visible",
            falseLabel: "Hidden",
          },
          {key: "title", label: "Headline"},
          {key: "message", label: "Message"},
          {key: "button_text", label: "Button text"},
          {key: "button_url", label: "Button URL"},
        ],
      };
    }

    return null;
  }

  function getChangeRequestReadableLabel_(primaryValue, fallbackValue, emptyLabel) {
    var label = String(primaryValue || fallbackValue || "").trim();
    return label || String(emptyLabel || "Untitled item");
  }

  function joinChangeRequestMetaParts_(parts) {
    return (Array.isArray(parts) ? parts : [])
        .map(function(part) {
          return String(part || "").trim();
        })
        .filter(function(part) {
          return !!part;
        })
        .join(" | ");
  }

  function formatChangeRequestCampaignSchedule_(item) {
    var source = item || {};
    var startDate = normalizeCampaignDateValue_(source.start_date);
    var endDate = normalizeCampaignDateValue_(source.end_date);

    if (source.ongoing === true) {
      return "Ongoing";
    }

    if (startDate && endDate) {
      return formatChangeRequestDateDisplayValue_(startDate) +
        " to " +
        formatChangeRequestDateDisplayValue_(endDate);
    }

    if (startDate) {
      return "Starts " + formatChangeRequestDateDisplayValue_(startDate);
    }

    if (endDate) {
      return "Ends " + formatChangeRequestDateDisplayValue_(endDate);
    }

    return "";
  }

  function formatChangeRequestServeNeedPriority_(value) {
    var normalized = normalizeServeNeedPriorityValue_(value);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function formatChangeRequestFieldLabel_(key) {
    var label = String(key || "").trim();

    if (!label) {
      return "Field";
    }

    return label
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, function(character) {
          return character.toUpperCase();
        });
  }

  function formatChangeRequestFieldValue_(value, fieldConfig) {
    var type = fieldConfig && fieldConfig.type || "";
    var normalizedValue = value;
    var textValue = "";

    if (type === "module-list") {
      var modules = normalizeHubModuleItems_(
          normalizedValue,
          fieldConfig && fieldConfig.moduleDefinitions,
      );

      if (!modules.length) {
        return {
          html: formatChangeRequestTextValueHtml_("No modules configured"),
          isEmpty: true,
        };
      }

      return {
        html: formatChangeRequestTextValueHtml_(
            modules.map(function(moduleItem, index) {
              var definition = getHubModuleDefinitionById_(
                  fieldConfig && fieldConfig.moduleDefinitions,
                  moduleItem && moduleItem.id,
              );

              return [
                String(index + 1) + ".",
                definition && definition.label ?
                  definition.label :
                  formatChangeRequestFieldLabel_(moduleItem && moduleItem.id),
                " - ",
                moduleItem && moduleItem.enabled !== false ?
                  "Visible" :
                  "Hidden",
              ].join("");
            }).join("\n"),
        ),
        isEmpty: false,
      };
    }

    if (type === "boolean") {
      textValue = isAdminTruthyValue_(normalizedValue) ?
        String(fieldConfig.trueLabel || "Yes") :
        String(fieldConfig.falseLabel || "No");
      return {
        html: formatChangeRequestTextValueHtml_(textValue),
        isEmpty: false,
      };
    }

    if (type === "sunday-mode") {
      return {
        html: formatChangeRequestTextValueHtml_(
            formatChangeRequestSundayModeOverrideLabel_(normalizedValue),
        ),
        isEmpty: false,
      };
    }

    if (type === "date") {
      textValue = formatChangeRequestDateDisplayValue_(normalizedValue);
    } else if (type === "datetime") {
      textValue = formatChangeRequestDateTimeDisplayValue_(normalizedValue);
    } else {
      textValue = String(normalizedValue == null ? "" : normalizedValue).trim();
    }

    if (!textValue) {
      return {
        html: formatChangeRequestTextValueHtml_(
            fieldConfig && fieldConfig.blankLabel ?
              fieldConfig.blankLabel :
              "Blank",
        ),
        isEmpty: true,
      };
    }

    return {
      html: formatChangeRequestTextValueHtml_(textValue),
      isEmpty: false,
    };
  }

  function formatChangeRequestDateDisplayValue_(value) {
    var normalizedValue = normalizeSundayDateInputValue_(value);
    return normalizedValue ? formatSundayDisplayDate_(normalizedValue) : "";
  }

  function formatChangeRequestDateTimeDisplayValue_(value) {
    var normalizedValue = formatDateTimeLocalValue_(value);
    var parsed = null;

    if (!normalizedValue) {
      return "";
    }

    parsed = new Date(normalizedValue);
    if (Number.isNaN(parsed.getTime())) {
      return normalizedValue.replace("T", " ");
    }

    return parsed.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatChangeRequestSundayModeOverrideLabel_(value) {
    var normalized = normalizeAdminSundayModeOverrideValue_(value);

    if (normalized === "enabled") {
      return "Force Sunday Mode on";
    }

    if (normalized === "disabled") {
      return "Force Sunday Mode off";
    }

    return "Automatic";
  }

  function formatChangeRequestTextValueHtml_(value) {
    return escapeHtml_(String(value == null ? "" : value)).replace(/\n/g, "<br>");
  }

  function formatChangeRequestGenericValueHtml_(value) {
    if (value == null) {
      return formatChangeRequestTextValueHtml_("Blank");
    }

    if (typeof value === "boolean") {
      return formatChangeRequestTextValueHtml_(value ? "Yes" : "No");
    }

    if (typeof value === "number") {
      return formatChangeRequestTextValueHtml_(String(value));
    }

    if (typeof value === "string") {
      return formatChangeRequestTextValueHtml_(value.trim() || "Blank");
    }

    if (Array.isArray(value)) {
      return formatChangeRequestTextValueHtml_(
          String(value.length) + " saved items",
      );
    }

    if (typeof value === "object") {
      return formatChangeRequestTextValueHtml_(
          String(Object.keys(value).length) + " saved values",
      );
    }

    return formatChangeRequestTextValueHtml_(String(value));
  }

  function isChangeRequestGenericValueEmpty_(value) {
    if (value == null) {
      return true;
    }

    if (typeof value === "string") {
      return value.trim() === "";
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === "object") {
      return Object.keys(value).length === 0;
    }

    return false;
  }

  function renderAdminStatusPanel_() {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>Auth and Environment Status</h3>",
      "<p>Everything we need to decide between local emulators and a Firebase preview channel.</p>",
      "</div>",
      renderStatusPill_(
          adminState.errorMessage ? "Needs attention" : "Healthy foundation",
          adminState.errorMessage ? "is-warn" : "is-safe",
      ),
      "</div>",
      "<div class=\"central-admin-stack\">",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Current status</strong>",
      renderStatusPill_(
          adminState.authLoading ? "Loading" : "Live",
          adminState.authLoading ? "is-warn" : "is-safe",
      ),
      "</div>",
      "<p>", escapeHtml_(adminState.infoMessage), "</p>",
      renderAdminNote_(
          "This shell now expects your first admin user record at " +
          (adminState.userDocPath || "centralAdmin/root/users/{uid}") + ".",
      ),
      adminState.errorMessage ?
        "<p class=\"central-admin-note\">" + escapeHtml_(adminState.errorMessage) + "</p>" :
        "",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Recommended test order</strong>",
      renderStatusPill_("Preview-safe", "is-live"),
      "</div>",
      "<ul class=\"central-admin-checklist\">",
      [
        "Deploy the repo's Firestore rules so the signed-in user can read their own admin record.",
        "Sign in and click Create My Admin Access if the panel asks for it.",
        "Reload /admin and confirm the sidebar changes from signed-in to authorized before we build editors.",
      ].map(function(item) {
        return "<li>" + escapeHtml_(item) + "</li>";
      }).join(""),
      "</ul>",
      "</div>",
      "<div class=\"central-admin-empty\">",
      "<p class=\"central-admin-footer-note\">",
      "The next content-page patch can plug into this shell without rewriting the public site or changing the",
      " existing <span class=\"central-admin-inline-code\">/api/central-data</span> response path.",
      "</p>",
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderAdminAccessPanel_() {
    return [
      "<section class=\"central-admin-panel\">",
      "<div class=\"central-admin-panel-header\">",
      "<div>",
      "<h3>First Admin Access</h3>",
      "<p>",
      escapeHtml_(getAdminAccessPanelSummary_()),
      "</p>",
      "</div>",
      renderStatusPill_(getAdminAccessSummaryLabel_(), getAdminAccessSummaryTone_()),
      "</div>",
      "<div class=\"central-admin-stack\">",
      renderAdminAccessBody_(),
      "</div>",
      "</section>",
    ].join("");
  }

  function renderAdminAccessBody_() {
    if (!adminState.user) {
      return [
        "<div class=\"central-admin-empty\">",
        "<p class=\"central-admin-footer-note\">",
        "Sign in with your CrossPointe Google account first. After that, this panel will show the exact Firestore path and starter document for your admin access.",
        "</p>",
        "</div>",
      ].join("");
    }

    if (!adminState.userEmailAllowed) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Wrong Google account</strong>",
        renderStatusPill_("Workspace required", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Use a CrossPointe account or an allowed tester account before creating admin access.",
        ),
        "</div>",
      ].join("");
    }

    if (!adminState.userDocLoaded && !adminState.errorMessage) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Checking Firestore</strong>",
        renderStatusPill_("In progress", "is-warn"),
        "</div>",
        renderAdminNote_(
            "The dashboard is looking for your admin user document at " +
            adminState.userDocPath + ".",
        ),
        "</div>",
      ].join("");
    }

    if (adminState.inviteClaimPending) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Confirming your admin invitation</strong>",
        renderStatusPill_("In progress", "is-warn"),
        "</div>",
        renderAdminNote_(
            "Central is creating your admin record with the permissions that were included in the invitation.",
        ),
        "</div>",
      ].join("");
    }

    if (adminState.userDocExists && isActiveAdminUserRecord_()) {
      return [
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Admin access is active</strong>",
        renderStatusPill_("Authorized", "is-safe"),
        "</div>",
        renderAdminNote_(
            "Your Firestore admin user record exists and active is set to true. The next step is to start replacing placeholder pages with real Firestore-backed reads.",
        ),
        "</div>",
        "<div class=\"central-admin-item\">",
        "<div class=\"central-admin-item-header\">",
        "<strong>Visible page access</strong>",
        renderStatusPill_("Resolved", "is-safe"),
        "</div>",
        "<div class=\"central-admin-page-meta\">",
        getVisibleAdminPages_().map(function(page) {
          return renderInlineMeta_(
              page.label,
              getPermissionLabel_(getPageAccessLevel_(page.pageAccessKey)),
          );
        }).join(""),
        "</div>",
        "</div>",
      ].join("");
    }

    return [
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Create your first admin user document</strong>",
      renderStatusPill_(
          adminState.bootstrapPending ? "Working" : "One click",
          adminState.bootstrapPending ? "is-warn" : "is-live",
      ),
      "</div>",
      renderAdminNote_(
          "The fastest path is to let the dashboard create the first admin record for the Google account that is already signed in.",
      ),
      adminState.bootstrapMessage ?
        renderAdminNote_(adminState.bootstrapMessage) :
        "",
      "<div class=\"central-admin-action-row\">",
      "<button type=\"button\" class=\"central-admin-link-button is-primary\" data-admin-action=\"bootstrap-first-admin\"",
      adminState.bootstrapPending ? " disabled" : "",
      ">",
      adminState.bootstrapPending ? "Creating Admin Access..." : "Create My Admin Access",
      "</button>",
      "</div>",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Manual fallback</strong>",
      renderStatusPill_("Console step", "is-live"),
      "</div>",
      renderAdminNote_(
          "If the automatic button cannot finish, create a document manually at " +
          adminState.userDocPath + ". You can paste the starter JSON below and add timestamp fields later if you want them.",
      ),
      "<pre class=\"central-admin-code-block\">",
      escapeHtml_(JSON.stringify(createFirstAdminUserDocTemplate_(), null, 2)),
      "</pre>",
      "</div>",
      "<div class=\"central-admin-item\">",
      "<div class=\"central-admin-item-header\">",
      "<strong>Why this path changed</strong>",
      renderStatusPill_("Firestore-safe", "is-safe"),
      "</div>",
      renderAdminNote_(
          "Firestore documents must use alternating collection/document segments. That is why admin records now live under centralAdmin/root/users/{uid} instead of centralAdmin/users/{uid}.",
      ),
      "</div>",
    ].join("");
  }

  function renderAdminAuthActions_() {
    if (!adminState.authReady) {
      return [
        "<button type=\"button\" class=\"is-secondary\" disabled>",
        "Waiting for Firebase",
        "</button>",
      ].join("");
    }

    if (!adminState.user) {
      var actions = [
        "<button type=\"button\" class=\"is-primary\" data-admin-action=\"sign-in\">",
        "Sign In with Google",
        "</button>",
      ];

      if (adminState.usingEmulators) {
        actions.push(
            "<button type=\"button\" class=\"is-secondary\" data-admin-action=\"local-test-sign-in\">",
            "Use Local Test Account",
            "</button>",
        );
      }

      return actions.join("");
    }

    return [
      "<div class=\"central-admin-session-actions\">",
      "<a href=\"/\" class=\"central-admin-link-button is-secondary central-admin-back-link\">",
      "Back to Central",
      "</a>",
      "<button type=\"button\" class=\"is-secondary\" data-admin-action=\"sign-out\">",
      "Sign Out",
      "</button>",
      "</div>",
    ].join("");
  }

  function maybeLoadCurrentPageData_() {
    loadChangeRequestsSummaryIfNeeded_();

    if (adminState.currentPageId === "hub") {
      loadHubIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "bulletin") {
      loadBulletinModeIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "quick-links") {
      loadQuickLinksIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "sunday") {
      loadSundayIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "resources") {
      loadResourcesIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "campaigns") {
      loadCampaignsIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "serve-needs") {
      loadServeNeedsIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "next-steps") {
      loadNextStepsIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "settings" ||
      adminState.currentPageId === "integrations") {
      loadSettingsIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "status-banner") {
      loadStatusBannerIfNeeded_();
      return;
    }

    if (adminState.currentPageId === "change-requests") {
      loadChangeRequestsIfNeeded_(false);
      return;
    }

    if (adminState.currentPageId === "wayfinder") {
      loadWayfinderFeaturedEventHealth_(false);
      loadWayfinderWebsiteIndexStatus_(false);
      loadWayfinderFeedback_(false);
      loadWayfinderEvaluations_(false);
    }
  }

  function loadHubIfNeeded_() {
    if (!adminFirestore) {
      return;
    }

    if (adminState.hubLoaded || adminState.hubLoading) {
      return;
    }

    loadHub_();
  }

  function loadBulletinModeIfNeeded_() {
    if (!adminState.user || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.bulletinLoaded || adminState.bulletinLoading) {
      return;
    }

    loadBulletinMode_();
  }

  function loadBulletinMode_() {
    adminState.bulletinLoading = true;
    adminState.bulletinError = "";
    renderAdmin_();

    callBulletinModeEndpoint_("GET").then(function(result) {
      var centralData = Object.assign({}, result && result.content || {});
      var bulletinEvents = result && result.events || {};
      if (Array.isArray(bulletinEvents.today)) {
        centralData.today = bulletinEvents.today;
      }
      if (Array.isArray(bulletinEvents.upcoming)) {
        centralData.events = bulletinEvents.upcoming;
      }
      adminState.bulletinLoading = false;
      adminState.bulletinLoaded = true;
      adminState.bulletinCentralData = centralData;
      adminState.bulletinDraft = normalizeBulletinDraft_(
          result && result.config,
          adminState.bulletinCentralData,
      );
      adminState.bulletinMessage = "";
      renderAdmin_();
    }).catch(function(error) {
      adminState.bulletinLoading = false;
      adminState.bulletinLoaded = false;
      adminState.bulletinError = error && error.message ?
        error.message :
        "Unable to load Bulletin Mode.";
      renderAdmin_();
    });
  }

  function loadSundayIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.sundayLoaded || adminState.sundayLoading) {
      return;
    }

    loadSunday_();
  }

  function loadSettingsIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.settingsLoaded || adminState.settingsLoading) {
      return;
    }

    loadSettings_();
  }

  function loadHub_(nextMessage) {
    if (!adminFirestore) {
      return;
    }

    adminState.hubLoading = true;
    adminState.hubLoadError = "";
    renderAdmin_();

    Promise.all([
      adminFirestore.doc(PUBLISHED_HUB_SETTINGS_DOC_PATH).get(),
      adminFirestore.doc(PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH).get(),
    ])
        .then(function(results) {
          var hubSettingsSnapshot = results[0];
          var hubSundaySnapshot = results[1];
          var fallbackNeeded =
            !hubSettingsSnapshot.exists || !hubSundaySnapshot.exists;

          return (fallbackNeeded ?
            fetchCurrentCentralDataForHub_() :
            Promise.resolve({}))
              .then(function(fallbackData) {
                var fallbackSundayModeOverride =
                  getFallbackSundayModeOverrideValue_(fallbackData);

                adminState.hubLoading = false;
                adminState.hubLoaded = true;
                adminState.hubSettingsDocExists = hubSettingsSnapshot.exists;
                adminState.hubSundayDocExists = hubSundaySnapshot.exists;
                adminState.hubSettingsCurrent = normalizeHubSettingsData_(
                    hubSettingsSnapshot.exists ?
                      hubSettingsSnapshot.data() :
                      fallbackData.settings,
                );
                adminState.hubSundayCurrent = normalizeHubSundayData_(
                    Object.assign(
                        {},
                        hubSundaySnapshot.exists ?
                          hubSundaySnapshot.data() :
                          (fallbackData.sundaySettings || {}),
                        {
                          sunday_mode_override: fallbackSundayModeOverride,
                          force_sunday_mode:
                            fallbackSundayModeOverride === "enabled",
                        },
                    ),
                );
                resetHubSettingsDraftFromCurrent_();
                resetHubSundayDraftFromCurrent_();
                if (nextMessage && typeof nextMessage === "object") {
                  adminState.hubSettingsMessage = String(
                      nextMessage.settings || "",
                  ).trim();
                  adminState.hubSundayMessage = String(
                      nextMessage.sunday || "",
                  ).trim();
                } else if (nextMessage) {
                  adminState.hubSettingsMessage = String(nextMessage).trim();
                }
                renderAdmin_();
              });
        })
        .catch(function(error) {
          adminState.hubLoading = false;
          adminState.hubLoaded = true;
          adminState.hubSettingsDocExists = false;
          adminState.hubSundayDocExists = false;
          adminState.hubLoadError = error && error.message ?
            error.message :
            "Unable to load the current Hub values.";
          renderAdmin_();
        });
  }

  function getFallbackSundayModeOverrideValue_(fallbackData) {
    var source = fallbackData || {};

    if (
      source.sundaySettings &&
      Object.prototype.hasOwnProperty.call(
          source.sundaySettings,
          "sunday_mode_override",
      )
    ) {
      return normalizeAdminSundayModeOverrideValue_(
          source.sundaySettings.sunday_mode_override,
      );
    }

    if (
      source.sundaySettings &&
      Object.prototype.hasOwnProperty.call(
          source.sundaySettings,
          "force_sunday_mode",
      )
    ) {
      return normalizeAdminSundayModeOverrideValue_(
          "",
          source.sundaySettings.force_sunday_mode,
      );
    }

    if (
      source.settings &&
      Object.prototype.hasOwnProperty.call(
          source.settings,
          "sunday_mode_override",
      )
    ) {
      return normalizeAdminSundayModeOverrideValue_(
          source.settings.sunday_mode_override,
      );
    }

    return normalizeAdminSundayModeOverrideValue_(
        "",
        (source.settings || {}).force_sunday_mode,
    );
  }

  function fetchCurrentCentralDataForHub_() {
    if (
      currentCentralDataCacheValue &&
      Date.now() - currentCentralDataCacheFetchedAt <
        CURRENT_CENTRAL_DATA_CACHE_TTL_MS
    ) {
      return Promise.resolve(currentCentralDataCacheValue);
    }

    if (currentCentralDataCachePromise) {
      return currentCentralDataCachePromise;
    }

    currentCentralDataCachePromise = fetch("/api/central-data", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }).then(function(response) {
      if (!response.ok) {
        throw new Error("The current Central data feed is unavailable.");
      }

      return response.json();
    }).then(function(payload) {
      currentCentralDataCacheValue = payload || {};
      currentCentralDataCacheFetchedAt = Date.now();
      currentCentralDataCachePromise = null;
      return currentCentralDataCacheValue;
    }).catch(function() {
      currentCentralDataCachePromise = null;
      return currentCentralDataCacheValue || {};
    });

    return currentCentralDataCachePromise;
  }

  function resetCurrentCentralDataCache_() {
    currentCentralDataCacheValue = null;
    currentCentralDataCacheFetchedAt = 0;
    currentCentralDataCachePromise = null;
  }

  function hasPublishedListOverrideState_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    if (!docSnapshot || !docSnapshot.exists) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(data, "overrideActive")) {
      return isAdminTruthyValue_(data.overrideActive);
    }

    return isAdminTruthyValue_(data.initialized);
  }

  function loadSunday_(nextMessage) {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.sundayLoading = true;
    adminState.sundayError = "";
    renderAdmin_();

    adminFirestore.doc(PUBLISHED_THIS_SUNDAY_DOC_PATH).get()
        .then(function(snapshot) {
          if (snapshot.exists) {
            return snapshot.data() || {};
          }

          return fetchCurrentCentralDataForHub_()
              .then(function(fallbackData) {
                return fallbackData && fallbackData.sunday ?
                  fallbackData.sunday :
                  {};
              });
        })
        .then(function(currentData) {
          adminState.sundayLoading = false;
          adminState.sundayLoaded = true;
          adminState.sundayCurrent = normalizeSundayComparableData_(
              currentData,
          );
          resetSundayDraftFromCurrent_();
          if (nextMessage) {
            adminState.sundayMessage = String(nextMessage).trim();
          }
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.sundayLoading = false;
          adminState.sundayLoaded = true;
          adminState.sundayError = error && error.message ?
            error.message :
            "Unable to load the current Sunday values.";
          renderAdmin_();
        });
  }

  function loadSettings_(nextMessage) {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.settingsLoading = true;
    adminState.roomRulesLoading = true;
    adminState.roomRulesLoaded = false;
    if (canManageAdminUsers_()) {
      adminState.adminUsersLoading = true;
      adminState.adminUsersLoaded = false;
    }
    adminState.settingsLoadError = "";
    renderAdmin_();

    Promise.all([
      adminFirestore.doc(PUBLISHED_HUB_SUNDAY_SETTINGS_DOC_PATH).get(),
      adminFirestore.collection(PUBLISHED_ROOM_RULES_COLLECTION_PATH).get(),
      adminFirestore.doc(PUBLISHED_ROOM_RULES_META_DOC_PATH).get(),
      adminFirestore.doc(PUBLISHED_HUB_SETTINGS_DOC_PATH).get(),
    ])
        .then(function(results) {
          var sundaySettingsSnapshot = results[0];
          var publishedSnapshot = results[1];
          var roomRulesMetaSnapshot = results[2];
          var publicSettingsSnapshot = results[3];
          var roomRulesOverrideActive = hasPublishedListOverrideState_(
              roomRulesMetaSnapshot,
          );
          var publishedItems = sortRoomRulesItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeRoomRuleDoc_(docSnapshot);
              }),
          );
          var fallbackNeeded =
            !sundaySettingsSnapshot.exists ||
            (!publishedItems.length && !roomRulesOverrideActive);

          return (fallbackNeeded ?
            fetchCurrentCentralDataForHub_() :
            Promise.resolve({}))
              .then(function(fallbackData) {
                var fallbackSundayModeOverride =
                  getFallbackSundayModeOverrideValue_(fallbackData);
                var fallbackItems = sortRoomRulesItems_(
                    (Array.isArray(fallbackData.roomRules) ?
                      fallbackData.roomRules :
                      []).map(function(item, index) {
                      return normalizeRoomRuleListItem_(item, index);
                    }),
                );
                var currentItems = publishedItems.length ?
                  publishedItems :
                  fallbackItems;
                if (roomRulesOverrideActive) {
                  currentItems = publishedItems;
                }

                adminState.settingsLoading = false;
                adminState.settingsLoaded = true;
                adminState.wayfinderAlphaEnabled = !!(
                  publicSettingsSnapshot.exists &&
                  publicSettingsSnapshot.data().wayfinder_enabled === true
                );
                adminState.settingsSundayCurrent = normalizeSettingsSundayData_(
                    sundaySettingsSnapshot.exists ?
                      sundaySettingsSnapshot.data() :
                      Object.assign(
                          {},
                          fallbackData.sundaySettings || {},
                          {
                            sunday_mode_override: fallbackSundayModeOverride,
                            force_sunday_mode:
                              fallbackSundayModeOverride === "enabled",
                          },
                      ),
                );
                resetSettingsSundayDraftFromCurrent_();
                adminState.roomRulesLoaded = true;
                adminState.roomRulesLoading = false;
                adminState.roomRulesBaselineItems = cloneRoomRulesItems_(
                    currentItems,
                );
                adminState.roomRulesPendingChangesById = {};
                adminState.roomRulesPublishedItems = publishedItems;
                adminState.roomRulesUsingPublishedFallback = false;
                adminState.roomRulesItems = currentItems;

                if (nextMessage && typeof nextMessage === "object") {
                  adminState.settingsSundayMessage = String(
                      nextMessage.sunday || "",
                  ).trim();
                  adminState.integrationsMessage = String(
                      nextMessage.integrations || "",
                  ).trim();
                  adminState.roomRulesMessage = String(
                      nextMessage.roomRules || "",
                  ).trim();
                } else if (nextMessage) {
                  adminState.settingsSundayMessage = String(nextMessage).trim();
                }

                if (canManageAdminUsers_()) {
                  loadAdminUsers_(
                      nextMessage && typeof nextMessage === "object" ?
                        nextMessage.users :
                        "",
                  );
                } else {
                  resetAdminUsersState_();
                }

                renderAdmin_();
              });
        })
        .catch(function(error) {
          adminState.settingsLoading = false;
          adminState.settingsLoaded = true;
          adminState.settingsLoadError = error && error.message ?
            error.message :
            "Unable to load the current settings.";
          renderAdmin_();
        });
  }

  function saveWayfinderAlphaSetting_(enabled) {
    if (!adminState.user ||
      getPageAccessLevel_("wayfinder") !== "admin") {
      adminState.wayfinderAlphaError =
        "Only a Wayfinder Admin can change alpha access.";
      renderAdmin_();
      return;
    }

    adminState.wayfinderAlphaSaving = true;
    adminState.wayfinderAlphaError = "";
    adminState.wayfinderAlphaMessage = "";
    renderAdmin_();

    adminState.user.getIdToken().then(function(idToken) {
      return fetch(WAYFINDER_ALPHA_SETTINGS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify({enabled: enabled === true}),
      });
    }).then(parseAdminEndpointResponse_).then(function(result) {
      adminState.wayfinderAlphaSaving = false;
      adminState.wayfinderAlphaEnabled = result.enabled === true;
      adminState.wayfinderAlphaMessage = String(result.message || "");
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderAlphaSaving = false;
      adminState.wayfinderAlphaError = error && error.message ?
        error.message : "Unable to update Wayfinder alpha access.";
      renderAdmin_();
    });
  }

  function canEditHubSettings_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("hub"));
  }

  function canEditHubSunday_() {
    return canChangeContentWithPermission_(getHubSundayAccessLevel_());
  }

  function canEditSettingsSunday_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("settings"));
  }

  function canEditIntegrations_() {
    return canChangeContentWithPermission_(
        getPageAccessLevel_("integrations"),
    );
  }

  function canEditRoomRules_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("roomRules"));
  }

  function canManageAdminUsers_() {
    var permission = getPageAccessLevel_("users");
    return permission === "admin";
  }

  function canEditThisSunday_() {
    return canChangeContentWithPermission_(getThisSundayAccessLevel_());
  }

  function getHubSundayAccessLevel_() {
    var pageAccess = adminState.userDocData && adminState.userDocData.pageAccess ?
      adminState.userDocData.pageAccess :
      {};
    var sundayPermission = normalizeAdminPermissionValue_(
        pageAccess.sundaySettings,
    );

    if (
      !Object.prototype.hasOwnProperty.call(pageAccess, "hub") &&
      sundayPermission !== "none"
    ) {
      return sundayPermission;
    }

    return getPageAccessLevel_("hub");
  }

  function getThisSundayAccessLevel_() {
    var sundayPermission = getPageAccessLevel_("thisSunday");

    if (sundayPermission && sundayPermission !== "none") {
      return sundayPermission;
    }

    return getPageAccessLevel_("settings");
  }

  function createEmptyHubSettingsDraft_() {
    return {
      site_title: "",
      hero_heading: "",
      hero_subheading: "",
      primary_button_text: "",
      primary_button_url: "",
      secondary_button_text: "",
      secondary_button_url: "",
      countdown_label: "",
      countdown_title: "",
      countdown_datetime: "",
      featured_event_enabled: false,
      homepage_modules: createDefaultHubHomepageModules_(),
    };
  }

  function createEmptyHubSundayDraft_() {
    return {
      sunday_eyebrow: "",
      sunday_heading: "",
      sunday_subheading: "",
      sunday_primary_button_text: "",
      sunday_primary_button_url: "",
      sunday_secondary_button_text: "",
      sunday_secondary_button_url: "",
      sunday_status_label: "",
      sunday_speaker_label: "",
      sunday_scripture_label: "",
      sunday_livestream_title: "",
      sunday_scripture_reference: "",
      sunday_scripture_title: "",
      sunday_scripture_helper_text: "",
      sunday_modules: createDefaultHubSundayModules_(),
    };
  }

  function createEmptyBulletinDraft_() {
    return {
      serviceDate: getDefaultSundayDateInputValue_(),
      heroSource: "featured",
      headings: {
        frontHeading: "This Week at\nCrossPointe",
        backEyebrow: "See You There",
        backHeading: "The Next Two Weeks",
      },
      giving: {
        monthlyBudget: 0,
        monthToDateGiving: 0,
        annualBudget: 0,
        yearToDateGiving: 0,
      },
      featuredEvent: {
        id: "",
        title: "",
        description: "",
        includeDescription: true,
      },
      fallbackHero: {
        eyebrow: "Welcome to CrossPointe",
        title: "We're Glad You're Here",
        description: [
          "Whether this is your first Sunday or CrossPointe is already home,",
          "we're glad you're here. Discover events, groups, serving",
          "opportunities, and next steps at central.crosspointe.tv.",
        ].join(" "),
        imageUrl: "",
        imageStoragePath: "",
      },
      events: [],
      campaignIds: [],
      serveNeedId: "",
    };
  }

  function normalizeBulletinDraft_(savedConfig, centralData) {
    var source = savedConfig && typeof savedConfig === "object" ?
      savedConfig :
      {};
    var data = centralData || {};
    var draft = createEmptyBulletinDraft_();
    var savedHeadings = source.headings &&
      typeof source.headings === "object" ? source.headings : {};
    var savedGiving = source.giving || {};
    var currentFeatured = data.featuredEvent || null;
    var savedFeatured = source.featuredEvent || {};
    var savedFallback = source.fallbackHero &&
      typeof source.fallbackHero === "object" ? source.fallbackHero : {};
    var savedEventsById = {};

    var automaticServiceDate = getDefaultSundayDateInputValue_();
    var savedServiceDate = normalizeSundayDateInputValue_(source.serviceDate);
    draft.serviceDate = savedServiceDate &&
      savedServiceDate >= automaticServiceDate ?
      savedServiceDate : automaticServiceDate;
    draft.heroSource = source.heroSource === "manual" ?
      "manual" : "featured";
    draft.headings = {
      frontHeading: normalizeBulletinHeadingText_(
          savedHeadings.frontHeading,
          "This Week at\nCrossPointe",
          80,
          2,
      ),
      backEyebrow: normalizeBulletinHeadingText_(
          savedHeadings.backEyebrow,
          "See You There",
          50,
          1,
      ),
      backHeading: normalizeBulletinHeadingText_(
          savedHeadings.backHeading,
          "The Next Two Weeks",
          80,
          2,
      ),
    };
    draft.giving = {
      monthlyBudget: normalizeBulletinMoney_(savedGiving.monthlyBudget),
      monthToDateGiving: normalizeBulletinMoney_(
          savedGiving.monthToDateGiving,
      ),
      annualBudget: normalizeBulletinMoney_(savedGiving.annualBudget),
      yearToDateGiving: normalizeBulletinMoney_(
          savedGiving.yearToDateGiving,
      ),
    };
    draft.fallbackHero = {
      eyebrow: String(
          savedFallback.eyebrow || draft.fallbackHero.eyebrow,
      ),
      title: String(savedFallback.title || draft.fallbackHero.title),
      description: String(
          savedFallback.description || draft.fallbackHero.description,
      ),
      imageUrl: getBulletinFallbackImageUrl_(savedFallback.imageUrl),
      imageStoragePath: String(savedFallback.imageStoragePath || ""),
    };

    if (currentFeatured) {
      var featuredId = getBulletinItemId_(currentFeatured);
      var savedFeaturedMatches = !savedFeatured.id ||
        savedFeatured.id === featuredId;
      draft.featuredEvent = {
        id: featuredId,
        title: savedFeaturedMatches && savedFeatured.title ?
          String(savedFeatured.title) :
          String(currentFeatured.title || ""),
        description: savedFeaturedMatches && savedFeatured.description ?
          String(savedFeatured.description) :
          String(currentFeatured.description || ""),
        includeDescription: savedFeaturedMatches ?
          savedFeatured.includeDescription !== false :
          true,
      };
    }

    (Array.isArray(source.events) ? source.events : []).forEach(function(item) {
      if (item && item.id) {
        savedEventsById[String(item.id)] = item;
      }
    });

    draft.events = getBulletinSourceEvents_(data).map(function(item) {
      var id = getBulletinItemId_(item);
      var hasSavedEvent = Object.prototype.hasOwnProperty.call(
          savedEventsById,
          id,
      );
      var saved = savedEventsById[id] || {};
      var sourceLocation = String(item.location || item.venue || "").trim();
      var savedLocation = String(saved.location || "").trim();
      var defaultWeekTwoStart = parseBulletinDate_(draft.serviceDate);
      defaultWeekTwoStart.setUTCDate(defaultWeekTwoStart.getUTCDate() + 7);
      return {
        id: id,
        title: saved.title ? String(saved.title) : String(item.title || ""),
        description: Object.prototype.hasOwnProperty.call(saved, "description") ?
          String(saved.description || "") :
          String(item.description || ""),
        included: hasSavedEvent ?
          saved.included !== false :
          parseBulletinDate_(item.date).getTime() <
            defaultWeekTwoStart.getTime(),
        includeDescription: saved.includeDescription !== false,
        date: String(item.date || ""),
        time: String(item.time || ""),
        doors_open_time: String(item.doors_open_time || ""),
        location: savedLocation || sourceLocation,
        sourceLocation: sourceLocation,
      };
    });

    var campaignIds = Array.isArray(source.campaignIds) ?
      source.campaignIds.map(String) :
      [];
    draft.campaignIds = campaignIds.length ? campaignIds :
      (Array.isArray(data.campaigns) ? data.campaigns : [])
          .slice(0, 3)
          .map(function(item) {
            return String(item.id || "");
          })
          .filter(Boolean);
    draft.serveNeedId = String(source.serveNeedId || "") ||
      String(data.serveNeeds && data.serveNeeds[0] &&
        data.serveNeeds[0].id || "");

    return draft;
  }

  function getBulletinSourceEvents_(data) {
    var source = data || {};
    var featured = source.featuredEvent || null;
    var events = [];
    var seen = {};

    (Array.isArray(source.today) ? source.today : [])
        .concat(Array.isArray(source.events) ? source.events : [])
        .forEach(function(item) {
      var id = getBulletinItemId_(item);
      if (!id || isBulletinFeaturedSourceEvent_(item, featured) || seen[id]) {
        return;
      }
          seen[id] = true;
          events.push(item);
        });

    return events.sort(function(left, right) {
      return parseBulletinDate_(left.date).getTime() -
        parseBulletinDate_(right.date).getTime();
    });
  }

  function isBulletinFeaturedSourceEvent_(item, featured) {
    if (!item || !featured) {
      return false;
    }

    var itemId = String(item.id || "").trim();
    var featuredId = String(featured.id || "").trim();
    if (itemId && featuredId && itemId === featuredId) {
      return true;
    }

    var itemChurchCenterUrl = String(item.church_center_url || "").trim();
    var featuredChurchCenterUrl = String(
        featured.church_center_url || "",
    ).trim();
    if (
      itemChurchCenterUrl &&
      featuredChurchCenterUrl &&
      itemChurchCenterUrl === featuredChurchCenterUrl
    ) {
      return true;
    }

    var itemTitle = String(item.title || "").trim();
    var featuredTitle = String(featured.title || "").trim();
    var datesMatch = String(item.date || "").trim() ===
      String(featured.date || "").trim();
    if (!datesMatch) {
      return false;
    }

    if (itemTitle === featuredTitle) {
      return true;
    }

    var itemTokens = getBulletinTitleTokens_(itemTitle);
    var featuredTokens = getBulletinTitleTokens_(featuredTitle);
    var shorterTokens = itemTokens.length <= featuredTokens.length ?
      itemTokens : featuredTokens;
    var longerTokens = itemTokens.length <= featuredTokens.length ?
      featuredTokens : itemTokens;

    return shorterTokens.length >= 3 && shorterTokens.every(function(token) {
      return longerTokens.indexOf(token) !== -1;
    });
  }

  function getBulletinTitleTokens_(title) {
    return String(title || "")
        .toLowerCase()
        .replace(/['’]s\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
  }

  function getBulletinItemId_(item) {
    var source = item || {};
    return String(source.id || [
      source.title,
      source.date,
      source.time,
    ].filter(Boolean).join("|"));
  }

  function getBulletinFeaturedEvent_() {
    var data = adminState.bulletinCentralData || {};
    var source = data.featuredEvent;
    if (!source) {
      return null;
    }

    return Object.assign({}, source, adminState.bulletinDraft.featuredEvent || {});
  }

  function getBulletinFeaturedImageUrl_(featured) {
    var imageUrl = String(featured && featured.image_url || "").trim();
    return /^https:\/\//i.test(imageUrl) ? imageUrl : "";
  }

  function getBulletinFallbackImageUrl_(value) {
    var imageUrl = String(value || "").trim();
    return (
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i.test(imageUrl) ||
      /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):9199\/v0\/b\//i.test(
          imageUrl,
      )
    ) ? imageUrl : "";
  }

  function getBulletinFrontHero_() {
    var featured = getBulletinFeaturedEvent_();
    if (featured && !isBulletinManualHeroActive_()) {
      return Object.assign({}, featured, {
        source: "featured",
        eyebrow: "Featured Event",
      });
    }

    var fallback = adminState.bulletinDraft.fallbackHero || {};
    return {
      source: "fallback",
      eyebrow: fallback.eyebrow || "Welcome to CrossPointe",
      title: fallback.title || "We're Glad You're Here",
      description: fallback.description || "",
      image_url: getBulletinFallbackImageUrl_(fallback.imageUrl),
      includeDescription: true,
    };
  }

  function isBulletinManualHeroActive_() {
    return adminState.bulletinDraft.heroSource === "manual" ||
      !getBulletinFeaturedEvent_();
  }

  function getBulletinEventDraftsInWindow_() {
    var start = parseBulletinDate_(adminState.bulletinDraft.serviceDate);
    var end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 13);

    return (adminState.bulletinDraft.events || []).filter(function(item) {
      var date = parseBulletinDate_(item.date);
      return date.getTime() >= start.getTime() &&
        date.getTime() <= end.getTime();
    });
  }

  function getBulletinEventWeek_(item) {
    var start = parseBulletinDate_(adminState.bulletinDraft.serviceDate);
    var weekTwoStart = new Date(start.getTime());
    weekTwoStart.setUTCDate(weekTwoStart.getUTCDate() + 7);
    return parseBulletinDate_(item && item.date).getTime() <
      weekTwoStart.getTime() ? "week1" : "week2";
  }

  function getFilteredBulletinEventDrafts_(events) {
    var source = Array.isArray(events) ?
      events :
      getBulletinEventDraftsInWindow_();
    var filter = String(adminState.bulletinEventFilter || "week1");

    if (filter === "included") {
      return source.filter(function(item) {
        return item.included;
      });
    }

    if (filter === "week1" || filter === "week2") {
      return source.filter(function(item) {
        return getBulletinEventWeek_(item) === filter;
      });
    }

    return source;
  }

  function updateBulletinEventBulkInclusion_(mode) {
    var events = getBulletinEventDraftsInWindow_();

    if (mode === "week1-default") {
      events.forEach(function(item) {
        item.included = getBulletinEventWeek_(item) === "week1";
      });
      adminState.bulletinEventFilter = "week1";
      return;
    }

    if (mode !== "include" && mode !== "exclude") {
      return;
    }

    var shouldInclude = mode === "include";
    events.forEach(function(item) {
      item.included = shouldInclude;
    });
  }

  function getSelectedBulletinCampaigns_() {
    var data = adminState.bulletinCentralData || {};
    var selectedIds = adminState.bulletinDraft.campaignIds || [];
    return (Array.isArray(data.campaigns) ? data.campaigns : [])
        .filter(function(item) {
          return selectedIds.indexOf(String(item.id || "")) !== -1;
        })
        .slice(0, 3);
  }

  function getSelectedBulletinServeNeed_() {
    var data = adminState.bulletinCentralData || {};
    return (Array.isArray(data.serveNeeds) ? data.serveNeeds : [])
        .find(function(item) {
          return String(item.id || "") === adminState.bulletinDraft.serveNeedId;
        }) || null;
  }

  function updateBulletinDraftField_(fieldName, value) {
    if (fieldName.indexOf("giving.") === 0) {
      adminState.bulletinDraft.giving[fieldName.replace("giving.", "")] =
        normalizeBulletinMoney_(value);
    } else if (fieldName.indexOf("headings.") === 0) {
      adminState.bulletinDraft.headings[
          fieldName.replace("headings.", "")
      ] = value;
    } else if (fieldName.indexOf("featured.") === 0) {
      adminState.bulletinDraft.featuredEvent[
          fieldName.replace("featured.", "")
      ] = value;
    } else if (fieldName.indexOf("fallbackHero.") === 0) {
      adminState.bulletinDraft.fallbackHero[
          fieldName.replace("fallbackHero.", "")
      ] = value;
    } else {
      adminState.bulletinDraft[fieldName] = value;
    }
    adminState.bulletinError = "";
    adminState.bulletinMessage = "";
  }

  function updateBulletinEventField_(eventId, fieldName, value) {
    var item = (adminState.bulletinDraft.events || []).find(function(eventItem) {
      return eventItem.id === eventId;
    });
    if (!item) {
      return;
    }
    item[fieldName] = value;
    adminState.bulletinError = "";
    adminState.bulletinMessage = "";
  }

  function updateBulletinChoice_(input) {
    var choiceType = input.getAttribute("data-admin-bulletin-choice") || "";
    var id = input.getAttribute("data-admin-doc-id") || "";

    if (choiceType === "campaign") {
      var ids = adminState.bulletinDraft.campaignIds.slice();
      var index = ids.indexOf(id);
      if (input.checked && index === -1 && ids.length < 3) {
        ids.push(id);
      } else if (!input.checked && index !== -1) {
        ids.splice(index, 1);
      }
      adminState.bulletinDraft.campaignIds = ids;
      return;
    }

    if (choiceType === "event") {
      updateBulletinEventField_(id, "included", !!input.checked);
    }
  }

  function buildBulletinModePayload_() {
    var draft = adminState.bulletinDraft;
    return {
      serviceDate: normalizeSundayDateInputValue_(draft.serviceDate),
      heroSource: draft.heroSource === "manual" ? "manual" : "featured",
      headings: {
        frontHeading: normalizeBulletinHeadingText_(
            draft.headings.frontHeading,
            "This Week at\nCrossPointe",
            80,
            2,
        ),
        backEyebrow: normalizeBulletinHeadingText_(
            draft.headings.backEyebrow,
            "See You There",
            50,
            1,
        ),
        backHeading: normalizeBulletinHeadingText_(
            draft.headings.backHeading,
            "The Next Two Weeks",
            80,
            2,
        ),
      },
      giving: {
        monthlyBudget: normalizeBulletinMoney_(draft.giving.monthlyBudget),
        monthToDateGiving: normalizeBulletinMoney_(
            draft.giving.monthToDateGiving,
        ),
        annualBudget: normalizeBulletinMoney_(draft.giving.annualBudget),
        yearToDateGiving: normalizeBulletinMoney_(
            draft.giving.yearToDateGiving,
        ),
      },
      featuredEvent: {
        id: String(draft.featuredEvent.id || ""),
        title: String(draft.featuredEvent.title || "").trim(),
        description: String(draft.featuredEvent.description || "").trim(),
        includeDescription: draft.featuredEvent.includeDescription !== false,
      },
      fallbackHero: {
        eyebrow: String(draft.fallbackHero.eyebrow || "").trim(),
        title: String(draft.fallbackHero.title || "").trim(),
        description: String(draft.fallbackHero.description || "").trim(),
        imageUrl: getBulletinFallbackImageUrl_(draft.fallbackHero.imageUrl),
        imageStoragePath: String(
            draft.fallbackHero.imageStoragePath || "",
        ).trim(),
      },
      events: (draft.events || []).map(function(item) {
        return {
          id: item.id,
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          location: String(item.location || "").trim(),
          included: item.included !== false,
          includeDescription: item.includeDescription !== false,
        };
      }),
      campaignIds: draft.campaignIds.slice(0, 3),
      serveNeedId: String(draft.serveNeedId || ""),
    };
  }

  function uploadBulletinFallbackImage_(file) {
    if (!file) {
      return;
    }

    if (!isEditorLevelPermission_(getPageAccessLevel_("bulletin"))) {
      adminState.bulletinError =
        "Your current access level does not allow uploading Bulletin images.";
      renderAdmin_();
      return;
    }

    var allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.indexOf(String(file.type || "").toLowerCase()) === -1) {
      adminState.bulletinError = "Choose a JPEG, PNG, or WebP image.";
      renderAdmin_();
      return;
    }

    if (!file.size || file.size > 10 * 1024 * 1024) {
      adminState.bulletinError = "Bulletin images must be 10 MB or smaller.";
      renderAdmin_();
      return;
    }

    adminState.bulletinImageUploading = true;
    adminState.bulletinError = "";
    adminState.bulletinMessage = "Uploading the welcome image...";
    renderAdmin_();

    readAdminFileAsDataUrl_(file)
        .then(function(dataUrl) {
          return callBulletinModeEndpoint_("POST", {
            action: "uploadFallbackImage",
            fileName: String(file.name || "bulletin-welcome-image"),
            contentType: String(file.type || ""),
            dataUrl: dataUrl,
          });
        })
        .then(function(result) {
          var imageUrl = getBulletinFallbackImageUrl_(
              result && result.imageUrl,
          );
          if (!imageUrl) {
            throw new Error("Firebase Storage did not return a usable image link.");
          }

          adminState.bulletinDraft.fallbackHero.imageUrl = imageUrl;
          adminState.bulletinDraft.fallbackHero.imageStoragePath = String(
              result && result.storagePath || "",
          );
          adminState.bulletinImageUploading = false;
          adminState.bulletinMessage =
            "Welcome image uploaded. Save Bulletin Settings to keep it with the evergreen hero.";
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.bulletinImageUploading = false;
          adminState.bulletinMessage = "";
          adminState.bulletinError = error && error.message ?
            error.message :
            "Unable to upload the Bulletin welcome image.";
          renderAdmin_();
        });
  }

  function readAdminFileAsDataUrl_(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.addEventListener("load", function() {
        resolve(String(reader.result || ""));
      }, {once: true});
      reader.addEventListener("error", function() {
        reject(new Error("The selected image could not be read."));
      }, {once: true});
      reader.readAsDataURL(file);
    });
  }

  function saveBulletinMode_() {
    if (!isEditorLevelPermission_(getPageAccessLevel_("bulletin"))) {
      adminState.bulletinError =
        "Your current access level does not allow saving Bulletin Mode.";
      renderAdmin_();
      return;
    }

    adminState.bulletinSaving = true;
    adminState.bulletinError = "";
    renderAdmin_();

    callBulletinModeEndpoint_("POST", buildBulletinModePayload_())
        .then(function(result) {
          adminState.bulletinSaving = false;
          adminState.bulletinMessage = result && result.message ?
            result.message :
            "Bulletin Mode settings saved.";
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.bulletinSaving = false;
          adminState.bulletinError = error && error.message ?
            error.message :
            "Unable to save Bulletin Mode settings.";
          renderAdmin_();
        });
  }

  function printBulletin_() {
    renderAdmin_();

    var images = appEl ? Array.prototype.slice.call(
        appEl.querySelectorAll(".central-bulletin-print-root img"),
    ) : [];
    var imageWaits = images.map(function(image) {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise(function(resolve) {
        var timeoutId = window.setTimeout(resolve, 3000);
        image.addEventListener("load", function() {
          window.clearTimeout(timeoutId);
          resolve();
        }, {once: true});
        image.addEventListener("error", function() {
          window.clearTimeout(timeoutId);
          resolve();
        }, {once: true});
      });
    });

    Promise.all(imageWaits).then(function() {
      beginAdminPrintThemeLock_();

      try {
        window.print();
      } catch (error) {
        endAdminPrintThemeLock_();
        throw error;
      }
    });
  }

  function normalizeBulletinMoney_(value) {
    var parsed = Number(String(value == null ? "" : value).replace(/[$,\s]/g, ""));
    return isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
  }

  function formatBulletinCurrency_(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(normalizeBulletinMoney_(value));
  }

  function normalizeBulletinHeadingText_(
      value,
      fallbackValue,
      maxLength,
      maxLines,
  ) {
    var normalized = String(value == null ? "" : value)
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(function(line) {
          return line.replace(/\s+/g, " ").trim();
        })
        .filter(Boolean)
        .slice(0, Math.max(1, Number(maxLines) || 1))
        .join("\n")
        .trim();
    var fallback = String(fallbackValue || "").trim();
    return (normalized || fallback).slice(0, Number(maxLength) || 80);
  }

  function renderBulletinHeadingText_(value) {
    return escapeHtml_(String(value || "")).replace(/\n/g, "<br>");
  }

  function parseBulletinDate_(value) {
    var normalized = normalizeSundayDateInputValue_(value);
    if (normalized) {
      var parts = normalized.split("-");
      return new Date(Date.UTC(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2]),
          12,
      ));
    }

    var parsed = new Date(String(value || "") + " 12:00:00 UTC");
    return Number.isNaN(parsed.getTime()) ?
      new Date(Date.UTC(1970, 0, 1, 12)) :
      parsed;
  }

  function formatBulletinLongDate_(value) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parseBulletinDate_(value));
  }

  function formatBulletinDateRange_(start, end) {
    var startMonth = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "long",
    }).format(start).toUpperCase();
    var endMonth = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "long",
    }).format(end).toUpperCase();
    return startMonth + " " + start.getUTCDate() + " - " +
      endMonth + " " + end.getUTCDate();
  }

  function createEmptySettingsSundayDraft_() {
    return {
      sunday_mode_override: "auto",
      sunday_mode_start_time: DEFAULT_SUNDAY_MODE_START_TIME,
      sunday_mode_end_time: DEFAULT_SUNDAY_MODE_END_TIME,
      dev_sunday_mode_override: "auto",
      dev_sunday_mode_start_time: DEFAULT_SUNDAY_MODE_START_TIME,
      dev_sunday_mode_end_time: DEFAULT_SUNDAY_MODE_END_TIME,
      sunday_livestream_url: "",
      sunday_livestream_note: "",
      sunday_scripture_bible_id: "",
      google_docs_enabled: true,
      calendar_integrations_enabled: true,
      google_web_client_id: "",
    };
  }

  function createEmptyRoomRuleDraft_() {
    return {
      match_type: "contains",
      match_text: "",
      display_location: "",
      behavior: "replace",
      priority: "50",
      active: true,
    };
  }

  function createEmptyAdminUserDraft_() {
    return {
      inviteId: "",
      uid: "",
      email: "",
      displayName: "",
      active: true,
      pageAccess: createAdminUserDraftPageAccess_("none"),
    };
  }

  function createEmptySundayDraft_() {
    return {
      date_iso: getDefaultSundayDateInputValue_(),
      series: "",
      sermon_title: "",
      speaker: "",
      scripture: "",
      note: "",
    };
  }

  function resetHubSettingsDraftFromCurrent_() {
    adminState.hubSettingsDraft = normalizeHubSettingsData_(
        adminState.hubSettingsCurrent,
    );
    adminState.hubSettingsError = "";
    adminState.hubSettingsMessage = "";
  }

  function resetHubSundayDraftFromCurrent_() {
    adminState.hubSundayDraft = normalizeHubSundayData_(
        adminState.hubSundayCurrent,
    );
    adminState.hubSundayError = "";
    adminState.hubSundayMessage = "";
  }

  function resetSettingsSundayDraftFromCurrent_() {
    adminState.settingsSundayDraft = normalizeSettingsSundayData_(
        adminState.settingsSundayCurrent,
    );
    adminState.settingsSundayError = "";
    adminState.settingsSundayMessage = "";
    adminState.integrationsPublishing = false;
    adminState.integrationsError = "";
    adminState.integrationsMessage = "";
  }

  function resetSundayDraftFromCurrent_() {
    adminState.sundayDraft = normalizeSundayData_(adminState.sundayCurrent);
    adminState.sundayError = "";
    adminState.sundayMessage = "";
  }

  function resetRoomRulesDraft_() {
    adminState.roomRulesDraft = createEmptyRoomRuleDraft_();
    adminState.roomRulesEditingId = "";
    adminState.roomRulesError = "";
    adminState.roomRulesMessage = "";
  }

  function resetAdminUsersDraft_() {
    adminState.adminUsersDraft = createEmptyAdminUserDraft_();
    adminState.adminUsersEditingUid = "";
    adminState.adminUsersEditingInviteId = "";
    adminState.adminUsersError = "";
    adminState.adminUsersMessage = "";
  }

  function resetHubState_() {
    adminState.hubLoaded = false;
    adminState.hubLoading = false;
    adminState.hubLoadError = "";
    adminState.hubSettingsSaving = false;
    adminState.hubSettingsPublishing = false;
    adminState.hubSettingsDocExists = false;
    adminState.hubSettingsCurrent = null;
    adminState.hubSettingsDraft = createEmptyHubSettingsDraft_();
    adminState.hubSettingsError = "";
    adminState.hubSettingsMessage = "";
    adminState.hubSundaySaving = false;
    adminState.hubSundayPublishing = false;
    adminState.hubSundayDocExists = false;
    adminState.hubSundayCurrent = null;
    adminState.hubSundayDraft = createEmptyHubSundayDraft_();
    adminState.hubSundayError = "";
    adminState.hubSundayMessage = "";
  }

  function resetSettingsState_() {
    adminState.settingsLoaded = false;
    adminState.settingsLoading = false;
    adminState.settingsLoadError = "";
    adminState.settingsSundayPublishing = false;
    adminState.settingsSundayCurrent = null;
    adminState.settingsSundayDraft = createEmptySettingsSundayDraft_();
    adminState.settingsSundayError = "";
    adminState.settingsSundayMessage = "";
    adminState.integrationsPublishing = false;
    adminState.integrationsError = "";
    adminState.integrationsMessage = "";
    resetRoomRulesState_();
    resetAdminUsersState_();
  }

  function resetSundayState_() {
    adminState.sundayLoaded = false;
    adminState.sundayLoading = false;
    adminState.sundayCurrent = null;
    adminState.sundayDraft = createEmptySundayDraft_();
    adminState.sundayError = "";
    adminState.sundayMessage = "";
    adminState.sundayPublishing = false;
  }

  function resetRoomRulesState_() {
    adminState.roomRulesLoaded = false;
    adminState.roomRulesLoading = false;
    adminState.roomRulesSaving = false;
    adminState.roomRulesPublishing = false;
    adminState.roomRulesItems = [];
    adminState.roomRulesBaselineItems = [];
    adminState.roomRulesPendingChangesById = {};
    adminState.roomRulesPublishedItems = [];
    adminState.roomRulesUsingPublishedFallback = false;
    adminState.roomRulesDraft = createEmptyRoomRuleDraft_();
    adminState.roomRulesEditingId = "";
    adminState.roomRulesError = "";
    adminState.roomRulesMessage = "";
  }

  function resetAdminUsersState_() {
    adminState.adminUsersLoaded = false;
    adminState.adminUsersLoading = false;
    adminState.adminUsersSaving = false;
    adminState.adminUsersItems = [];
    adminState.adminUsersDraft = createEmptyAdminUserDraft_();
    adminState.adminUsersEditingUid = "";
    adminState.adminUsersEditingInviteId = "";
    adminState.adminUsersError = "";
    adminState.adminUsersMessage = "";
  }

  function updateHubSettingsDraftField_(fieldName, nextValue) {
    adminState.hubSettingsDraft[fieldName] = nextValue;
    adminState.hubSettingsError = "";
    adminState.hubSettingsMessage = "";
  }

  function updateHubSundayDraftField_(fieldName, nextValue) {
    adminState.hubSundayDraft[fieldName] = nextValue;
    adminState.hubSundayError = "";
    adminState.hubSundayMessage = "";
  }

  function updateSettingsSundayDraftField_(fieldName, nextValue) {
    adminState.settingsSundayDraft[fieldName] = nextValue;
    if (adminState.currentPageId === "integrations") {
      adminState.integrationsError = "";
      adminState.integrationsMessage = "";
    } else {
      adminState.settingsSundayError = "";
      adminState.settingsSundayMessage = "";
    }
  }

  function updateSundayDraftField_(fieldName, nextValue) {
    var normalizedValue = nextValue;

    if (fieldName === "date_iso" && !String(nextValue || "").trim()) {
      normalizedValue = getDefaultSundayDateInputValue_();
    }

    adminState.sundayDraft[fieldName] = normalizedValue;
    adminState.sundayError = "";
    adminState.sundayMessage = "";
  }

  function normalizeHubSettingsData_(data) {
    var source = data || {};

    return {
      site_title: String(source.site_title || "").trim(),
      hero_heading: String(source.hero_heading || "").trim(),
      hero_subheading: String(source.hero_subheading || "").trim(),
      primary_button_text: String(source.primary_button_text || "").trim(),
      primary_button_url: String(source.primary_button_url || "").trim(),
      secondary_button_text: String(source.secondary_button_text || "").trim(),
      secondary_button_url: String(source.secondary_button_url || "").trim(),
      countdown_label: String(source.countdown_label || "").trim(),
      countdown_title: String(source.countdown_title || "").trim(),
      countdown_datetime: formatDateTimeLocalValue_(source.countdown_datetime),
      featured_event_enabled: normalizeAdminBooleanValue_(
          source.featured_event_enabled,
          false,
      ),
      homepage_modules: normalizeHubModuleItems_(
          source.homepage_modules,
          HUB_HOMEPAGE_MODULE_DEFINITIONS,
      ),
    };
  }

  function normalizeHubSundayData_(data) {
    var source = data || {};

    return {
      sunday_eyebrow: String(
          source.sunday_eyebrow ||
          source.sunday_eyebrow_live ||
          source.sunday_eyebrow_test ||
          "",
      ).trim(),
      sunday_heading: String(
          source.sunday_heading ||
          source.sunday_heading_live ||
          source.sunday_heading_test ||
          "",
      ).trim(),
      sunday_subheading: String(source.sunday_subheading || "").trim(),
      sunday_primary_button_text: String(source.sunday_primary_button_text || "").trim(),
      sunday_primary_button_url: String(source.sunday_primary_button_url || "").trim(),
      sunday_secondary_button_text: String(source.sunday_secondary_button_text || "").trim(),
      sunday_secondary_button_url: String(source.sunday_secondary_button_url || "").trim(),
      sunday_status_label: String(source.sunday_status_label || "").trim(),
      sunday_speaker_label: String(source.sunday_speaker_label || "").trim(),
      sunday_scripture_label: String(source.sunday_scripture_label || "").trim(),
      sunday_livestream_title: String(source.sunday_livestream_title || "").trim(),
      sunday_scripture_reference: String(source.sunday_scripture_reference || "").trim(),
      sunday_scripture_title: String(source.sunday_scripture_title || "").trim(),
      sunday_scripture_helper_text: String(source.sunday_scripture_helper_text || "").trim(),
      sunday_modules: normalizeHubModuleItems_(
          source.sunday_modules,
          HUB_SUNDAY_MODULE_DEFINITIONS,
      ),
    };
  }

  function normalizeSettingsSundayData_(data) {
    var source = data || {};
    var googleDocsEnabled = true;
    var calendarIntegrationsEnabled = true;

    if (Object.prototype.hasOwnProperty.call(source, "google_docs_enabled")) {
      googleDocsEnabled = normalizeAdminBooleanValue_(
          source.google_docs_enabled,
          true,
      );
    } else if (Object.prototype.hasOwnProperty.call(source, "googleDocsEnabled")) {
      googleDocsEnabled = normalizeAdminBooleanValue_(
          source.googleDocsEnabled,
          true,
      );
    }

    if (Object.prototype.hasOwnProperty.call(
        source,
        "calendar_integrations_enabled",
    )) {
      calendarIntegrationsEnabled = normalizeAdminBooleanValue_(
          source.calendar_integrations_enabled,
          true,
      );
    } else if (Object.prototype.hasOwnProperty.call(
        source,
        "calendarIntegrationsEnabled",
    )) {
      calendarIntegrationsEnabled = normalizeAdminBooleanValue_(
          source.calendarIntegrationsEnabled,
          true,
      );
    }

    return {
      sunday_mode_override: normalizeAdminSundayModeOverrideValue_(
          source.sunday_mode_override,
          source.force_sunday_mode,
      ),
      sunday_mode_start_time: normalizeAdminTimeInputValue_(
          source.sunday_mode_start_time,
          DEFAULT_SUNDAY_MODE_START_TIME,
      ),
      sunday_mode_end_time: normalizeAdminTimeInputValue_(
          source.sunday_mode_end_time,
          DEFAULT_SUNDAY_MODE_END_TIME,
      ),
      dev_sunday_mode_override: normalizeAdminSundayModeOverrideValue_(
          source.dev_sunday_mode_override,
          false,
      ),
      dev_sunday_mode_start_time: normalizeAdminTimeInputValue_(
          source.dev_sunday_mode_start_time,
          DEFAULT_SUNDAY_MODE_START_TIME,
      ),
      dev_sunday_mode_end_time: normalizeAdminTimeInputValue_(
          source.dev_sunday_mode_end_time,
          DEFAULT_SUNDAY_MODE_END_TIME,
      ),
      sunday_livestream_url: String(source.sunday_livestream_url || "").trim(),
      sunday_livestream_note: String(source.sunday_livestream_note || "").trim(),
      sunday_scripture_bible_id: String(source.sunday_scripture_bible_id || "").trim(),
      google_docs_enabled: googleDocsEnabled,
      calendar_integrations_enabled: calendarIntegrationsEnabled,
      google_web_client_id: String(
          source.google_web_client_id ||
          source.googleWebClientId ||
          "",
      ).trim(),
    };
  }

  function normalizeSundayData_(data) {
    var source = data || {};
    var dateValue = normalizeSundayDateInputValue_(
        source.date_iso || source.date,
    );

    return {
      date_iso: dateValue || getDefaultSundayDateInputValue_(),
      series: String(source.series || "").trim(),
      sermon_title: String(source.sermon_title || "").trim(),
      speaker: String(source.speaker || "").trim(),
      scripture: String(source.scripture || "").trim(),
      note: String(source.note || source.notes || "").trim(),
    };
  }

  function normalizeSundayComparableData_(data) {
    var normalized = normalizeSundayData_(data);

    return {
      date_iso: normalized.date_iso,
      date: formatSundayDisplayDate_(normalized.date_iso),
      series: normalized.series,
      sermon_title: normalized.sermon_title,
      speaker: normalized.speaker,
      scripture: normalized.scripture,
      note: normalized.note,
    };
  }

  function buildHubSettingsPayload_() {
    return normalizeHubSettingsData_(adminState.hubSettingsDraft);
  }

  function buildHubSundayPayload_() {
    return normalizeHubSundayData_(adminState.hubSundayDraft);
  }

  function buildSettingsSundayPayload_() {
    return normalizeSettingsSundayData_(adminState.settingsSundayDraft);
  }

  function buildSundayControlsPayload_() {
    var normalized = normalizeSettingsSundayData_(
        adminState.settingsSundayDraft,
    );

    return {
      sunday_mode_override: normalized.sunday_mode_override,
      sunday_mode_start_time: normalized.sunday_mode_start_time,
      sunday_mode_end_time: normalized.sunday_mode_end_time,
      dev_sunday_mode_override: normalized.dev_sunday_mode_override,
      dev_sunday_mode_start_time: normalized.dev_sunday_mode_start_time,
      dev_sunday_mode_end_time: normalized.dev_sunday_mode_end_time,
    };
  }

  function buildIntegrationsPayload_() {
    var normalized = normalizeSettingsSundayData_(
        adminState.settingsSundayDraft,
    );

    return {
      sunday_livestream_url: normalized.sunday_livestream_url,
      sunday_livestream_note: normalized.sunday_livestream_note,
      sunday_scripture_bible_id: normalized.sunday_scripture_bible_id,
      google_docs_enabled: normalized.google_docs_enabled,
      calendar_integrations_enabled: normalized.calendar_integrations_enabled,
      google_web_client_id: normalized.google_web_client_id,
    };
  }

  function buildSundayPayload_() {
    return normalizeSundayComparableData_(adminState.sundayDraft);
  }

  function formatDateTimeLocalValue_(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    var quickMatch = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (quickMatch) {
      return quickMatch[1] + "T" + quickMatch[2];
    }

    var parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }

    return [
      parsed.getFullYear(),
      "-",
      padAdminDatePart_(parsed.getMonth() + 1),
      "-",
      padAdminDatePart_(parsed.getDate()),
      "T",
      padAdminDatePart_(parsed.getHours()),
      ":",
      padAdminDatePart_(parsed.getMinutes()),
    ].join("");
  }

  function normalizeAdminTimeInputValue_(value, fallbackValue) {
    var text = String(value || "").trim();
    var match = text.match(/^(\d{1,2}):(\d{2})$/);
    var hour = 0;
    var minute = 0;

    if (!text) {
      return fallbackValue || "";
    }

    if (!match) {
      return fallbackValue || "";
    }

    hour = Number(match[1]);
    minute = Number(match[2]);

    if (
      !isFinite(hour) ||
      !isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return fallbackValue || "";
    }

    return [
      padAdminDatePart_(hour),
      ":",
      padAdminDatePart_(minute),
    ].join("");
  }

  function padAdminDatePart_(value) {
    return String(value).padStart(2, "0");
  }

  function getDefaultSundayDateInputValue_() {
    var nextSunday = new Date();
    var dayOfWeek = nextSunday.getDay();
    var daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    nextSunday.setHours(12, 0, 0, 0);
    nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);

    return [
      nextSunday.getFullYear(),
      "-",
      padAdminDatePart_(nextSunday.getMonth() + 1),
      "-",
      padAdminDatePart_(nextSunday.getDate()),
    ].join("");
  }

  function normalizeSundayDateInputValue_(value) {
    var text = String(value || "").trim();
    var quickMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var parsed = null;

    if (!text) {
      return "";
    }

    if (quickMatch) {
      return quickMatch[1] + "-" + quickMatch[2] + "-" + quickMatch[3];
    }

    parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return [
      parsed.getFullYear(),
      "-",
      padAdminDatePart_(parsed.getMonth() + 1),
      "-",
      padAdminDatePart_(parsed.getDate()),
    ].join("");
  }

  function formatSundayDisplayDate_(dateValue) {
    var normalizedValue = normalizeSundayDateInputValue_(dateValue);
    var parts = normalizedValue.split("-");
    var parsedDate = null;

    if (!normalizedValue) {
      return "";
    }

    parsedDate = new Date(Date.UTC(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
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

  function isAdminTruthyValue_(value) {
    var normalized = String(value == null ? "" : value).trim().toLowerCase();
    return normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on";
  }

  function normalizeAdminSundayModeOverrideValue_(overrideValue, legacyForceValue) {
    var normalized = String(overrideValue || "").trim().toLowerCase();

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

    return isAdminTruthyValue_(legacyForceValue) ? "enabled" : "auto";
  }

  function normalizeAdminBooleanValue_(value, defaultValue) {
    if (value === true || value === false) {
      return value;
    }

    if (value == null || String(value).trim() === "") {
      return !!defaultValue;
    }

    return isAdminTruthyValue_(value);
  }

  function saveHubSettings_() {
    if (!adminFirestore) {
      adminState.hubSettingsError = "Firestore is not ready yet.";
      renderAdmin_();
      return;
    }

    if (!canEditHubSettings_()) {
      adminState.hubSettingsError =
        "Your current access level cannot edit the homepage fields.";
      renderAdmin_();
      return;
    }

    var payload = buildHubSettingsPayload_();

    if ((payload.primary_button_text && !payload.primary_button_url) ||
      (!payload.primary_button_text && payload.primary_button_url)) {
      adminState.hubSettingsError =
        "Enter both a text label and a URL for the primary button.";
      renderAdmin_();
      return;
    }

    if ((payload.secondary_button_text && !payload.secondary_button_url) ||
      (!payload.secondary_button_text && payload.secondary_button_url)) {
      adminState.hubSettingsError =
        "Enter both a text label and a URL for the secondary button.";
      renderAdmin_();
      return;
    }

    adminState.hubSettingsSaving = true;
    adminState.hubSettingsError = "";
    adminState.hubSettingsMessage = "";
    renderAdmin_();

    var fieldValue = window.firebase.firestore.FieldValue;
    var docPayload = {
      site_title: payload.site_title,
      hero_heading: payload.hero_heading,
      hero_subheading: payload.hero_subheading,
      primary_button_text: payload.primary_button_text,
      primary_button_url: payload.primary_button_url,
      secondary_button_text: payload.secondary_button_text,
      secondary_button_url: payload.secondary_button_url,
      countdown_label: payload.countdown_label,
      countdown_title: payload.countdown_title,
      countdown_datetime: payload.countdown_datetime,
      featured_event_enabled: payload.featured_event_enabled,
      homepage_modules: payload.homepage_modules,
      updatedAt: fieldValue.serverTimestamp(),
    };

    if (!adminState.hubSettingsDocExists) {
      docPayload.createdAt = fieldValue.serverTimestamp();
    }

    adminFirestore.doc(DRAFT_HUB_SETTINGS_DOC_PATH).set(docPayload, {merge: true})
        .then(function() {
          adminState.hubSettingsSaving = false;
          adminState.hubSettingsDocExists = true;
          adminState.hubSettingsCurrent = payload;
          adminState.hubSettingsDraft = normalizeHubSettingsData_(payload);
          adminState.hubSettingsMessage = "Homepage draft saved.";
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.hubSettingsSaving = false;
          adminState.hubSettingsError = error && error.message ?
            error.message :
            "Unable to save the homepage draft.";
          renderAdmin_();
        });
  }

  function saveHubSunday_() {
    if (!adminFirestore) {
      adminState.hubSundayError = "Firestore is not ready yet.";
      renderAdmin_();
      return;
    }

    if (!canEditHubSunday_()) {
      adminState.hubSundayError =
        "Your current access level cannot edit the Sunday-mode fields.";
      renderAdmin_();
      return;
    }

    var payload = buildHubSundayPayload_();

    if ((payload.sunday_primary_button_text && !payload.sunday_primary_button_url) ||
      (!payload.sunday_primary_button_text && payload.sunday_primary_button_url)) {
      adminState.hubSundayError =
        "Enter both a text label and a URL for the Sunday primary button.";
      renderAdmin_();
      return;
    }

    if ((payload.sunday_secondary_button_text && !payload.sunday_secondary_button_url) ||
      (!payload.sunday_secondary_button_text && payload.sunday_secondary_button_url)) {
      adminState.hubSundayError =
        "Enter both a text label and a URL for the Sunday secondary button.";
      renderAdmin_();
      return;
    }

    adminState.hubSundaySaving = true;
    adminState.hubSundayError = "";
    adminState.hubSundayMessage = "";
    renderAdmin_();

    var fieldValue = window.firebase.firestore.FieldValue;
    var docPayload = {
      sunday_eyebrow: payload.sunday_eyebrow,
      sunday_heading: payload.sunday_heading,
      sunday_subheading: payload.sunday_subheading,
      sunday_primary_button_text: payload.sunday_primary_button_text,
      sunday_primary_button_url: payload.sunday_primary_button_url,
      sunday_secondary_button_text: payload.sunday_secondary_button_text,
      sunday_secondary_button_url: payload.sunday_secondary_button_url,
      sunday_status_label: payload.sunday_status_label,
      sunday_speaker_label: payload.sunday_speaker_label,
      sunday_scripture_label: payload.sunday_scripture_label,
      sunday_livestream_title: payload.sunday_livestream_title,
      sunday_scripture_reference: payload.sunday_scripture_reference,
      sunday_scripture_title: payload.sunday_scripture_title,
      sunday_scripture_helper_text: payload.sunday_scripture_helper_text,
      sunday_modules: payload.sunday_modules,
      sunday_mode_override: fieldValue.delete(),
      force_sunday_mode: fieldValue.delete(),
      sunday_mode_start_time: fieldValue.delete(),
      sunday_mode_end_time: fieldValue.delete(),
      dev_sunday_mode_override: fieldValue.delete(),
      dev_sunday_mode_start_time: fieldValue.delete(),
      dev_sunday_mode_end_time: fieldValue.delete(),
      sunday_livestream_url: fieldValue.delete(),
      sunday_livestream_note: fieldValue.delete(),
      sunday_scripture_bible_id: fieldValue.delete(),
      sunday_eyebrow_live: fieldValue.delete(),
      sunday_eyebrow_test: fieldValue.delete(),
      sunday_heading_live: fieldValue.delete(),
      sunday_heading_test: fieldValue.delete(),
      updatedAt: fieldValue.serverTimestamp(),
    };

    if (!adminState.hubSundayDocExists) {
      docPayload.createdAt = fieldValue.serverTimestamp();
    }

    adminFirestore.doc(DRAFT_HUB_SUNDAY_SETTINGS_DOC_PATH).set(docPayload, {merge: true})
        .then(function() {
          adminState.hubSundaySaving = false;
          adminState.hubSundayDocExists = true;
          adminState.hubSundayCurrent = payload;
          adminState.hubSundayDraft = normalizeHubSundayData_(payload);
          adminState.hubSundayMessage = "Sunday Mode draft saved.";
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.hubSundaySaving = false;
          adminState.hubSundayError = error && error.message ?
            error.message :
            "Unable to save the Sunday Mode draft.";
          renderAdmin_();
        });
  }

  function publishHubSettingsToPreview_() {
    var permission = getPageAccessLevel_("hub");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildHubSettingsPayload_();

    if (!canEditHubSettings_()) {
      adminState.hubSettingsError =
        "Your current access level cannot change the homepage.";
      renderAdmin_();
      return;
    }

    if ((payload.primary_button_text && !payload.primary_button_url) ||
      (!payload.primary_button_text && payload.primary_button_url)) {
      adminState.hubSettingsError =
        "Enter both a text label and a URL for the primary button.";
      renderAdmin_();
      return;
    }

    if ((payload.secondary_button_text && !payload.secondary_button_url) ||
      (!payload.secondary_button_text && payload.secondary_button_url)) {
      adminState.hubSettingsError =
        "Enter both a text label and a URL for the secondary button.";
      renderAdmin_();
      return;
    }

    adminState.hubSettingsPublishing = true;
    adminState.hubSettingsError = "";
    adminState.hubSettingsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "hubSettings",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Homepage changes submitted for approval." :
        "Homepage published.",
    })
        .then(function(result) {
          adminState.hubSettingsPublishing = false;
          adminState.hubSettingsMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Homepage changes submitted for approval." :
              "Homepage published.");

          if (actionConfig.mode === "publish") {
            loadHub_({
              settings: adminState.hubSettingsMessage,
            });
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.hubSettingsPublishing = false;
          adminState.hubSettingsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the homepage changes for approval." :
              "Unable to publish the homepage to preview.");
          renderAdmin_();
        });
  }

  function publishHubSundayToPreview_() {
    var permission = getHubSundayAccessLevel_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildHubSundayPayload_();

    if (!canEditHubSunday_()) {
      adminState.hubSundayError =
        "Your current access level cannot change Sunday Mode.";
      renderAdmin_();
      return;
    }

    if ((payload.sunday_primary_button_text && !payload.sunday_primary_button_url) ||
      (!payload.sunday_primary_button_text && payload.sunday_primary_button_url)) {
      adminState.hubSundayError =
        "Enter both a text label and a URL for the Sunday primary button.";
      renderAdmin_();
      return;
    }

    if ((payload.sunday_secondary_button_text && !payload.sunday_secondary_button_url) ||
      (!payload.sunday_secondary_button_text && payload.sunday_secondary_button_url)) {
      adminState.hubSundayError =
        "Enter both a text label and a URL for the Sunday secondary button.";
      renderAdmin_();
      return;
    }

    adminState.hubSundayPublishing = true;
    adminState.hubSundayError = "";
    adminState.hubSundayMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "hubSunday",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Sunday Mode changes submitted for approval." :
        "Sunday Mode published.",
    })
        .then(function(result) {
          adminState.hubSundayPublishing = false;
          adminState.hubSundayMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Sunday Mode changes submitted for approval." :
              "Sunday Mode published.");

          if (actionConfig.mode === "publish") {
            loadHub_({
              sunday: adminState.hubSundayMessage,
            });
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.hubSundayPublishing = false;
          adminState.hubSundayError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Sunday Mode changes for approval." :
              "Unable to publish Sunday Mode to preview.");
          renderAdmin_();
        });
  }

  function publishSettingsSundayToPreview_() {
    var permission = getPageAccessLevel_("settings");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildSundayControlsPayload_();

    if (!canEditSettingsSunday_()) {
      adminState.settingsSundayError =
        "Your current access level cannot change Settings.";
      renderAdmin_();
      return;
    }

    adminState.settingsSundayPublishing = true;
    adminState.settingsSundayError = "";
    adminState.settingsSundayMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "settingsSunday",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Sunday controls submitted for approval." :
        "Sunday controls published.",
    })
        .then(function(result) {
          adminState.settingsSundayPublishing = false;
          adminState.settingsSundayMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Sunday controls submitted for approval." :
              "Sunday controls published.");

          if (actionConfig.mode === "publish") {
            loadSettings_({
              sunday: adminState.settingsSundayMessage,
            });
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.settingsSundayPublishing = false;
          adminState.settingsSundayError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Sunday controls for approval." :
              "Unable to publish the Sunday controls to preview.");
          renderAdmin_();
        });
  }

  function publishIntegrationsToPreview_() {
    var permission = getPageAccessLevel_("integrations");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildIntegrationsPayload_();

    if (!canEditIntegrations_()) {
      adminState.integrationsError =
        "Your current access level cannot change Integrations.";
      renderAdmin_();
      return;
    }

    adminState.integrationsPublishing = true;
    adminState.integrationsError = "";
    adminState.integrationsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "integrations",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Integration changes submitted for approval." :
        "Integrations published.",
    })
        .then(function(result) {
          adminState.integrationsPublishing = false;
          adminState.integrationsMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Integration changes submitted for approval." :
              "Integrations published.");

          if (actionConfig.mode === "publish") {
            loadSettings_({
              integrations: adminState.integrationsMessage,
            });
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.integrationsPublishing = false;
          adminState.integrationsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the integration changes for approval." :
              "Unable to publish Integrations.");
          renderAdmin_();
        });
  }

  function publishSundayToPreview_() {
    var permission = getThisSundayAccessLevel_();
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildSundayPayload_();

    if (!canEditThisSunday_()) {
      adminState.sundayError =
        "Your current access level cannot change Sunday.";
      renderAdmin_();
      return;
    }

    if (!payload.date_iso) {
      adminState.sundayError = "Choose the Sunday date before continuing.";
      renderAdmin_();
      return;
    }

    adminState.sundayPublishing = true;
    adminState.sundayError = "";
    adminState.sundayMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "thisSunday",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Sunday changes submitted for approval." :
        "Sunday published.",
    })
        .then(function(result) {
          adminState.sundayPublishing = false;
          adminState.sundayMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Sunday changes submitted for approval." :
              "Sunday published.");

          if (actionConfig.mode === "publish") {
            loadSunday_(adminState.sundayMessage);
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.sundayPublishing = false;
          adminState.sundayError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Sunday changes for approval." :
              "Unable to publish Sunday to preview.");
          renderAdmin_();
        });
  }

  function loadQuickLinksIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.quickLinksLoaded || adminState.quickLinksLoading) {
      return;
    }

    loadQuickLinks_();
  }

  function loadQuickLinks_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.quickLinksLoading = true;
    adminState.quickLinksError = "";
    renderAdmin_();

    adminFirestore.collection(PUBLISHED_QUICK_LINKS_COLLECTION_PATH).get()
        .then(function(publishedSnapshot) {
          var publishedItems = sortQuickLinksItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeQuickLinkDoc_(docSnapshot);
              }),
          );
          adminState.quickLinksLoading = false;
          adminState.quickLinksLoaded = true;
          adminState.quickLinksBaselineItems = cloneQuickLinksItems_(
              publishedItems,
          );
          adminState.quickLinksPendingChangesById = {};
          adminState.quickLinksPublishedItems = publishedItems;
          adminState.quickLinksDraftInitialized = false;
          adminState.quickLinksUsingPublishedFallback = false;
          adminState.quickLinksItems = publishedItems;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.quickLinksLoading = false;
          adminState.quickLinksLoaded = true;
          adminState.quickLinksBaselineItems = [];
          adminState.quickLinksPendingChangesById = {};
          adminState.quickLinksDraftInitialized = false;
          adminState.quickLinksPublishedItems = [];
          adminState.quickLinksUsingPublishedFallback = false;
          adminState.quickLinksItems = [];
          adminState.quickLinksError = error && error.message ?
            error.message :
            "Unable to load the quick links.";
          renderAdmin_();
        });
  }

  function sortQuickLinksItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          return Number(a.sort || 999) - Number(b.sort || 999);
        });
  }

  function getQuickLinksPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore quick links";
  }

  function canEditQuickLinks_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("quickLinks"));
  }

  function loadCampaignsIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.campaignsLoaded || adminState.campaignsLoading) {
      return;
    }

    loadCampaigns_();
  }

  function loadCampaigns_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.campaignsLoading = true;
    adminState.campaignsError = "";
    renderAdmin_();

    adminFirestore.collection(PUBLISHED_CAMPAIGNS_COLLECTION_PATH).get()
        .then(function(publishedSnapshot) {
          var publishedItems = sortCampaignsItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeCampaignDoc_(docSnapshot);
              }),
          );
          adminState.campaignsLoading = false;
          adminState.campaignsLoaded = true;
          adminState.campaignsBaselineItems = cloneCampaignsItems_(
              publishedItems,
          );
          adminState.campaignsPendingChangesById = {};
          adminState.campaignsPublishedItems = publishedItems;
          adminState.campaignsUsingPublishedFallback = false;
          adminState.campaignsItems = publishedItems;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.campaignsLoading = false;
          adminState.campaignsLoaded = true;
          adminState.campaignsBaselineItems = [];
          adminState.campaignsPendingChangesById = {};
          adminState.campaignsPublishedItems = [];
          adminState.campaignsUsingPublishedFallback = false;
          adminState.campaignsItems = [];
          adminState.campaignsError = error && error.message ?
            error.message :
            "Unable to load the campaigns.";
          renderAdmin_();
        });
  }

  function loadServeNeedsIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.serveNeedsLoaded || adminState.serveNeedsLoading) {
      return;
    }

    loadServeNeeds_();
  }

  function loadServeNeeds_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.serveNeedsLoading = true;
    adminState.serveNeedsError = "";
    renderAdmin_();

    adminFirestore.collection(PUBLISHED_SERVE_NEEDS_COLLECTION_PATH).get()
        .then(function(publishedSnapshot) {
          var publishedItems = sortServeNeedsItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeServeNeedDoc_(docSnapshot);
              }),
          );
          adminState.serveNeedsLoading = false;
          adminState.serveNeedsLoaded = true;
          adminState.serveNeedsBaselineItems = cloneServeNeedsItems_(
              publishedItems,
          );
          adminState.serveNeedsPendingChangesById = {};
          adminState.serveNeedsPublishedItems = publishedItems;
          adminState.serveNeedsUsingPublishedFallback = false;
          adminState.serveNeedsItems = publishedItems;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.serveNeedsLoading = false;
          adminState.serveNeedsLoaded = true;
          adminState.serveNeedsBaselineItems = [];
          adminState.serveNeedsPendingChangesById = {};
          adminState.serveNeedsPublishedItems = [];
          adminState.serveNeedsUsingPublishedFallback = false;
          adminState.serveNeedsItems = [];
          adminState.serveNeedsError = error && error.message ?
            error.message :
            "Unable to load the serve needs.";
          renderAdmin_();
        });
  }

  function loadNextStepsIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.nextStepsLoaded || adminState.nextStepsLoading) {
      return;
    }

    loadNextSteps_();
  }

  function loadNextSteps_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.nextStepsLoading = true;
    adminState.nextStepsError = "";
    renderAdmin_();

    adminFirestore.collection(PUBLISHED_NEXT_STEPS_COLLECTION_PATH).get()
        .then(function(publishedSnapshot) {
          var publishedItems = sortNextStepsItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeNextStepDoc_(docSnapshot);
              }),
          );
          adminState.nextStepsLoading = false;
          adminState.nextStepsLoaded = true;
          adminState.nextStepsBaselineItems = cloneNextStepsItems_(
              publishedItems,
          );
          adminState.nextStepsPendingChangesById = {};
          adminState.nextStepsPublishedItems = publishedItems;
          adminState.nextStepsUsingPublishedFallback = false;
          adminState.nextStepsItems = publishedItems;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.nextStepsLoading = false;
          adminState.nextStepsLoaded = true;
          adminState.nextStepsBaselineItems = [];
          adminState.nextStepsPendingChangesById = {};
          adminState.nextStepsPublishedItems = [];
          adminState.nextStepsUsingPublishedFallback = false;
          adminState.nextStepsItems = [];
          adminState.nextStepsError = error && error.message ?
            error.message :
            "Unable to load the Next Steps.";
          renderAdmin_();
        });
  }

  function loadResourcesIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.resourcesLoaded || adminState.resourcesLoading) {
      return;
    }

    loadResources_();
  }

  function loadResources_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.resourcesLoading = true;
    adminState.resourcesError = "";
    renderAdmin_();

    adminFirestore.collection(PUBLISHED_RESOURCES_COLLECTION_PATH).get()
        .then(function(publishedSnapshot) {
          var publishedItems = sortResourcesItems_(
              publishedSnapshot.docs.map(function(docSnapshot) {
                return normalizeResourceDoc_(docSnapshot);
              }),
          );
          adminState.resourcesLoading = false;
          adminState.resourcesLoaded = true;
          adminState.resourcesBaselineItems = cloneResourcesItems_(
              publishedItems,
          );
          adminState.resourcesPendingChangesById = {};
          adminState.resourcesPublishedItems = publishedItems;
          adminState.resourcesUsingPublishedFallback = false;
          adminState.resourcesItems = publishedItems;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.resourcesLoading = false;
          adminState.resourcesLoaded = true;
          adminState.resourcesBaselineItems = [];
          adminState.resourcesPendingChangesById = {};
          adminState.resourcesPublishedItems = [];
          adminState.resourcesUsingPublishedFallback = false;
          adminState.resourcesItems = [];
          adminState.resourcesError = error && error.message ?
            error.message :
            "Unable to load the resources.";
          renderAdmin_();
        });
  }

  function loadStatusBannerIfNeeded_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    if (adminState.statusBannerLoaded || adminState.statusBannerLoading) {
      return;
    }

    loadStatusBanner_();
  }

  function loadStatusBanner_(nextMessage) {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      return;
    }

    adminState.statusBannerLoading = true;
    adminState.statusBannerError = "";
    renderAdmin_();

    adminFirestore.doc(PUBLISHED_STATUS_BANNER_DOC_PATH).get()
        .then(function(publishedSnapshot) {
          if (publishedSnapshot.exists) {
            adminState.statusBannerLoading = false;
            adminState.statusBannerLoaded = true;
            adminState.statusBannerDraftDocExists = false;
            adminState.statusBannerPublishedDocExists = true;
            adminState.statusBannerPublishedCurrent =
              normalizeStatusBannerDoc_(publishedSnapshot);
            adminState.statusBannerCurrent = adminState.statusBannerPublishedCurrent;
            resetStatusBannerDraftFromCurrent_();
            if (nextMessage) {
              adminState.statusBannerMessage = nextMessage;
            }
            renderAdmin_();
            return;
          }

          return fetchCurrentCentralDataForHub_()
              .then(function(currentCentralData) {
                var fallbackBanner = normalizeStatusBannerData_(
                    currentCentralData.banner,
                );

                adminState.statusBannerLoading = false;
                adminState.statusBannerLoaded = true;
                adminState.statusBannerDraftDocExists = false;
                adminState.statusBannerPublishedDocExists = false;
                adminState.statusBannerPublishedCurrent = fallbackBanner;
                adminState.statusBannerCurrent = fallbackBanner;
                resetStatusBannerDraftFromCurrent_();
                if (nextMessage) {
                  adminState.statusBannerMessage = nextMessage;
                }
                renderAdmin_();
              });
        })
        .catch(function(error) {
          adminState.statusBannerLoading = false;
          adminState.statusBannerLoaded = true;
          adminState.statusBannerDraftDocExists = false;
          adminState.statusBannerPublishedDocExists = false;
          adminState.statusBannerCurrent = null;
          adminState.statusBannerPublishedCurrent = null;
          adminState.statusBannerError = error && error.message ?
            error.message :
            "Unable to load the status banner.";
          renderAdmin_();
        });
  }

  function canEditStatusBanner_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("statusBanner"));
  }

  function createEmptyStatusBannerDraft_() {
    return {
      title: "",
      message: "",
      button_text: "",
      button_url: "",
    };
  }

  function normalizeStatusBannerData_(data) {
    var source = data || {};

    return {
      title: String(source.title || "").trim(),
      message: String(source.message || "").trim(),
      button_text: String(source.button_text || "").trim(),
      button_url: String(source.button_url || "").trim(),
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function resetStatusBannerDraftFromCurrent_() {
    var current = adminState.statusBannerCurrent;

    adminState.statusBannerDraft = current ? {
      title: current.title || "",
      message: current.message || "",
      button_text: current.button_text || "",
      button_url: current.button_url || "",
    } : createEmptyStatusBannerDraft_();
    adminState.statusBannerMessage = "";
    adminState.statusBannerError = "";
  }

  function resetStatusBannerState_() {
    adminState.statusBannerLoaded = false;
    adminState.statusBannerLoading = false;
    adminState.statusBannerSaving = false;
    adminState.statusBannerPublishing = false;
    adminState.statusBannerDraftDocExists = false;
    adminState.statusBannerPublishedDocExists = false;
    adminState.statusBannerCurrent = null;
    adminState.statusBannerPublishedCurrent = null;
    adminState.statusBannerDraft = createEmptyStatusBannerDraft_();
    adminState.statusBannerError = "";
    adminState.statusBannerMessage = "";
  }

  function buildStatusBannerPreviewData_() {
    var draft = adminState.statusBannerDraft || createEmptyStatusBannerDraft_();

    return {
      title: String(draft.title || "").trim(),
      message: String(draft.message || "").trim(),
      button_text: String(draft.button_text || "").trim(),
      button_url: String(draft.button_url || "").trim(),
    };
  }

  function saveStatusBanner_() {
    if (!adminFirestore) {
      adminState.statusBannerError = "Firestore is not ready yet.";
      renderAdmin_();
      return;
    }

    if (!canEditStatusBanner_()) {
      adminState.statusBannerError =
        "Your current access level cannot edit the status banner.";
      renderAdmin_();
      return;
    }

    var preview = buildStatusBannerPreviewData_();

    if (!preview.title) {
      adminState.statusBannerError = "The banner needs a headline.";
      renderAdmin_();
      return;
    }

    if (!preview.message) {
      adminState.statusBannerError = "The banner needs a message.";
      renderAdmin_();
      return;
    }

    if ((preview.button_text && !preview.button_url) ||
      (!preview.button_text && preview.button_url)) {
      adminState.statusBannerError =
        "If you use a button, enter both button text and button URL.";
      renderAdmin_();
      return;
    }

    adminState.statusBannerSaving = true;
    adminState.statusBannerError = "";
    adminState.statusBannerMessage = "";
    renderAdmin_();

    var fieldValue = window.firebase.firestore.FieldValue;
    var payload = {
      title: preview.title,
      message: preview.message,
      button_text: preview.button_text,
      button_url: preview.button_url,
      active: true,
      updatedAt: fieldValue.serverTimestamp(),
    };

    if (!adminState.statusBannerDraftDocExists) {
      payload.createdAt = fieldValue.serverTimestamp();
    }

    adminFirestore.doc(DRAFT_STATUS_BANNER_DOC_PATH).set(payload, {merge: true})
        .then(function() {
          adminState.statusBannerSaving = false;
          adminState.statusBannerDraftDocExists = true;
          adminState.statusBannerLoaded = false;
          loadStatusBanner_("Banner draft saved.");
        })
        .catch(function(error) {
          adminState.statusBannerSaving = false;
          adminState.statusBannerError = error && error.message ?
            error.message :
            "Unable to save the status-banner draft.";
          renderAdmin_();
        });
  }

  function publishStatusBannerToPreview_() {
    var permission = getPageAccessLevel_("statusBanner");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var payload = buildStatusBannerPreviewData_();

    if (!canEditStatusBanner_()) {
      adminState.statusBannerError =
        "Your current access level cannot change the status banner.";
      renderAdmin_();
      return;
    }

    if (!payload.title) {
      adminState.statusBannerError = "The banner needs a headline.";
      renderAdmin_();
      return;
    }

    if (!payload.message) {
      adminState.statusBannerError = "The banner needs a message.";
      renderAdmin_();
      return;
    }

    if ((payload.button_text && !payload.button_url) ||
      (!payload.button_text && payload.button_url)) {
      adminState.statusBannerError =
        "If you use a button, enter both button text and button URL.";
      renderAdmin_();
      return;
    }

    adminState.statusBannerPublishing = true;
    adminState.statusBannerError = "";
    adminState.statusBannerMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "statusBanner",
      permission: permission,
      payload: payload,
      successMessage: actionConfig.mode === "submit" ?
        "Status banner changes submitted for approval." :
        "Status banner published.",
    })
        .then(function(result) {
          adminState.statusBannerPublishing = false;
          adminState.statusBannerMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Status banner changes submitted for approval." :
              "Status banner published.");

          if (actionConfig.mode === "publish") {
            loadStatusBanner_(adminState.statusBannerMessage);
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.statusBannerPublishing = false;
          adminState.statusBannerError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the status banner changes for approval." :
              "Unable to publish the status banner to preview.");
          renderAdmin_();
        });
  }

  function hideStatusBannerInPreview_() {
    var permission = getPageAccessLevel_("statusBanner");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditStatusBanner_()) {
      adminState.statusBannerError =
        "Your current access level cannot change the status banner.";
      renderAdmin_();
      return;
    }

    adminState.statusBannerPublishing = true;
    adminState.statusBannerError = "";
    adminState.statusBannerMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "statusBanner",
      permission: permission,
      operation: "hide",
      payload: {},
      successMessage: actionConfig.mode === "submit" ?
        "Hide request submitted for approval." :
        "Status banner hidden.",
    })
        .then(function(result) {
          adminState.statusBannerPublishing = false;
          adminState.statusBannerMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Hide request submitted for approval." :
              "Status banner hidden.");

          if (actionConfig.mode === "publish") {
            loadStatusBanner_(adminState.statusBannerMessage);
            return;
          }

          renderAdmin_();
        })
        .catch(function(error) {
          adminState.statusBannerPublishing = false;
          adminState.statusBannerError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the hide request for approval." :
              "Unable to hide the status banner in preview.");
          renderAdmin_();
        });
  }

  function createEmptyQuickLinkDraft_() {
    return {
      title: "",
      url: "",
      sort: "50",
      active: true,
      sunday_only: false,
    };
  }

  function resetQuickLinksDraft_() {
    adminState.quickLinksDraft = createEmptyQuickLinkDraft_();
    adminState.quickLinksEditingId = "";
    adminState.quickLinksError = "";
    adminState.quickLinksMessage = "";
  }

  function resetQuickLinksState_() {
    adminState.quickLinksLoaded = false;
    adminState.quickLinksLoading = false;
    adminState.quickLinksSaving = false;
    adminState.quickLinksPublishing = false;
    adminState.quickLinksItems = [];
    adminState.quickLinksBaselineItems = [];
    adminState.quickLinksPendingChangesById = {};
    adminState.quickLinksPublishedItems = [];
    adminState.quickLinksDraft = createEmptyQuickLinkDraft_();
    adminState.quickLinksDraftInitialized = false;
    adminState.quickLinksUsingPublishedFallback = false;
    adminState.quickLinksEditingId = "";
    adminState.quickLinksError = "";
    adminState.quickLinksMessage = "";
  }

  function normalizeStatusBannerDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      title: String(data.title || "").trim(),
      message: String(data.message || "").trim(),
      button_text: String(data.button_text || "").trim(),
      button_url: String(data.button_url || "").trim(),
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function normalizeQuickLinkListItem_(item, index) {
    var source = item || {};

    return {
      id: String(source.id || ("quick-link-" + String(index + 1))).trim(),
      title: String(source.title || "").trim(),
      url: String(source.url || "").trim(),
      sort: Number.isFinite(Number(source.sort)) ?
        Number(source.sort) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
      sunday_only: source.sunday_only === true ||
        String(source.sunday_only || "").toLowerCase() === "true",
    };
  }

  function startEditingQuickLink_(docId) {
    var nextItem = adminState.quickLinksItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.quickLinksEditingId = nextItem.id;
    adminState.quickLinksDraft = {
      title: nextItem.title || "",
      url: nextItem.url || "",
      sort: String(nextItem.sort || 50),
      active: !!nextItem.active,
      sunday_only: !!nextItem.sunday_only,
    };
    adminState.quickLinksError = "";
    adminState.quickLinksMessage = "Editing " + (nextItem.title || "quick link") + ".";
    renderAdmin_();
  }

  function saveQuickLink_() {
    var permission = getPageAccessLevel_("quickLinks");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditQuickLinks_()) {
      adminState.quickLinksError = "Your current access level cannot edit quick links.";
      renderAdmin_();
      return;
    }

    var draft = adminState.quickLinksDraft || createEmptyQuickLinkDraft_();
    var title = String(draft.title || "").trim();
    var url = String(draft.url || "").trim();
    var sort = getQuickLinkSortValue_();

    if (!title) {
      adminState.quickLinksError = "Quick links need a title.";
      renderAdmin_();
      return;
    }

    if (!url) {
      adminState.quickLinksError = "Quick links need a destination URL.";
      renderAdmin_();
      return;
    }

    var items = sortQuickLinksItems_(adminState.quickLinksItems);
    var previousItem = adminState.quickLinksEditingId ?
      items.find(function(item) {
        return item.id === adminState.quickLinksEditingId;
      }) || getQuickLinkBaselineItemById_(adminState.quickLinksEditingId) || null :
      null;
    var sort = previousItem &&
      Number.isFinite(Number(previousItem.sort)) ?
      Number(previousItem.sort) :
      getSortableSectionNextSortValue_(items);
    var nextItem = {
      id: adminState.quickLinksEditingId ||
        createQuickLinkLocalId_(items.length),
      title: title,
      url: url,
      sort: sort,
      active: !!draft.active,
      sunday_only: !!draft.sunday_only,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeQuickLinksComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Quick link published.";

    adminState.quickLinksSaving = true;
    adminState.quickLinksError = "";
    adminState.quickLinksMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "quickLinks",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.quickLinksSaving = false;
          adminState.quickLinksDraft = createEmptyQuickLinkDraft_();
          adminState.quickLinksEditingId = "";
          adminState.quickLinksMessage = result && result.message ?
            result.message :
            successMessage;
          loadQuickLinks_();
        })
        .catch(function(error) {
          adminState.quickLinksSaving = false;
          adminState.quickLinksError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the quick-link change for approval." :
              "Unable to publish the quick-link change to preview.");
          renderAdmin_();
        });
  }

  function deleteQuickLink_(docId) {
    if (!docId || !canEditQuickLinks_()) {
      return;
    }

    var permission = getPageAccessLevel_("quickLinks");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.quickLinksItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.title ? nextItem.title : "this quick link";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getQuickLinkBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeQuickLinksComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Quick link removal published.";

      adminState.quickLinksSaving = true;
      adminState.quickLinksError = "";
      adminState.quickLinksMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "quickLinks",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.quickLinksSaving = false;
            adminState.quickLinksMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.quickLinksEditingId === docId) {
              adminState.quickLinksDraft = createEmptyQuickLinkDraft_();
              adminState.quickLinksEditingId = "";
            }

            loadQuickLinks_();
          })
          .catch(function(error) {
            adminState.quickLinksSaving = false;
            adminState.quickLinksError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the quick-link removal for approval." :
                "Unable to publish the quick-link removal to preview.");
            renderAdmin_();
          });
    });
  }

  function normalizeQuickLinkDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      id: docSnapshot.id,
      title: String(data.title || "").trim(),
      url: String(data.url || "").trim(),
      sort: Number.isFinite(Number(data.sort)) ?
        Number(data.sort) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
      sunday_only: data.sunday_only === true ||
        String(data.sunday_only || "").toLowerCase() === "true",
    };
  }

  function getQuickLinkSortValue_() {
    var draft = adminState.quickLinksDraft || createEmptyQuickLinkDraft_();
    var parsed = Number(draft.sort);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getQuickLinksSaveButtonLabel_() {
    if (adminState.quickLinksSaving) {
      return getPrimaryContentBusyLabel_(
          getPrimaryContentActionConfig_(getPageAccessLevel_("quickLinks")),
      );
    }

    if (isSubmitForApprovalPermission_(getPageAccessLevel_("quickLinks"))) {
      return adminState.quickLinksEditingId ?
        "Submit Changes" :
        "Submit Link";
    }

    return adminState.quickLinksEditingId ?
      "Publish Changes" :
      "Publish Link";
  }

  function publishQuickLinksToPreview_() {
    var permission = getPageAccessLevel_("quickLinks");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildQuickLinksSubmitChangeRequestData_();

    if (!canEditQuickLinks_()) {
      adminState.quickLinksError =
        "Your current access level cannot change quick links.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.quickLinksError =
        "Make a Quick Links change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.quickLinksPublishing = true;
    adminState.quickLinksError = "";
    adminState.quickLinksMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "quickLinks",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeQuickLinksComparableItems_(
            adminState.quickLinksBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildQuickLinksPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Quick links submitted for approval." :
        "Quick links published.",
    })
        .then(function(result) {
          adminState.quickLinksPublishing = false;
          adminState.quickLinksMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Quick links submitted for approval." :
              "Quick links published.");
          loadQuickLinks_();
        })
        .catch(function(error) {
          adminState.quickLinksPublishing = false;
          adminState.quickLinksError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the quick links for approval." :
              "Unable to publish the quick links to preview.");
          renderAdmin_();
        });
  }

  function buildQuickLinksPublishPayload_() {
    return {
      items: sortQuickLinksItems_(adminState.quickLinksItems).map(function(item) {
        return {
          id: item.id,
          title: String(item.title || "").trim(),
          url: String(item.url || "").trim(),
          sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
          active: !!item.active,
          sunday_only: !!item.sunday_only,
        };
      }),
    };
  }

  function createEmptyResourceDraft_() {
    return {
      title: "",
      type: "",
      description: "",
      button_text: "",
      button_url: "",
      sort: "50",
      active: true,
    };
  }

  function resetResourcesDraft_() {
    adminState.resourcesDraft = createEmptyResourceDraft_();
    adminState.resourcesEditingId = "";
    adminState.resourcesError = "";
    adminState.resourcesMessage = "";
  }

  function resetResourcesState_() {
    adminState.resourcesLoaded = false;
    adminState.resourcesLoading = false;
    adminState.resourcesSaving = false;
    adminState.resourcesPublishing = false;
    adminState.resourcesItems = [];
    adminState.resourcesBaselineItems = [];
    adminState.resourcesPendingChangesById = {};
    adminState.resourcesPublishedItems = [];
    adminState.resourcesUsingPublishedFallback = false;
    adminState.resourcesDraft = createEmptyResourceDraft_();
    adminState.resourcesEditingId = "";
    adminState.resourcesError = "";
    adminState.resourcesMessage = "";
  }

  function sortResourcesItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          var sortDelta = Number(a.sort || 999) - Number(b.sort || 999);
          if (sortDelta !== 0) {
            return sortDelta;
          }

          return String(a.id || "").localeCompare(String(b.id || ""));
        });
  }

  function normalizeResourceListItem_(item, index) {
    var source = item || {};

    return {
      id: String(source.id || ("resource-" + String(index + 1))).trim(),
      title: String(source.title || "").trim(),
      type: String(source.type || "").trim(),
      description: String(source.description || "").trim(),
      button_text: String(source.button_text || "").trim(),
      button_url: String(source.button_url || "").trim(),
      sort: Number.isFinite(Number(source.sort)) ?
        Number(source.sort) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function normalizeResourceDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      id: docSnapshot.id,
      title: String(data.title || "").trim(),
      type: String(data.type || "").trim(),
      description: String(data.description || "").trim(),
      button_text: String(data.button_text || "").trim(),
      button_url: String(data.button_url || "").trim(),
      sort: Number.isFinite(Number(data.sort)) ?
        Number(data.sort) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function cloneResourcesItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        title: String(item && item.title || "").trim(),
        type: String(item && item.type || "").trim(),
        description: String(item && item.description || "").trim(),
        button_text: String(item && item.button_text || "").trim(),
        button_url: String(item && item.button_url || "").trim(),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
        active: !!(item && item.active),
      };
    });
  }

  function normalizeResourcesComparableItems_(items) {
    return sortResourcesItems_(cloneResourcesItems_(items));
  }

  function normalizeResourceComparableItem_(item) {
    if (!item) {
      return null;
    }

    return {
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      type: String(item.type || "").trim(),
      description: String(item.description || "").trim(),
      button_text: String(item.button_text || "").trim(),
      button_url: String(item.button_url || "").trim(),
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
      active: !!item.active,
    };
  }

  function areResourceComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeResourceComparableItem_(leftItem),
        normalizeResourceComparableItem_(rightItem),
    );
  }

  function getResourcePendingChangeEntry_(docId) {
    if (!adminState.resourcesPendingChangesById) {
      return null;
    }

    return adminState.resourcesPendingChangesById[docId] || null;
  }

  function getResourceBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.resourcesBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setResourcePendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.resourcesPendingChangesById);
    var normalizedBaselineItem = normalizeResourceComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeResourceComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.resourcesPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.resourcesPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areResourceComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.resourcesPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.resourcesPendingChangesById = nextChangesById;
  }

  function trackResourceUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getResourcePendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getResourceBaselineItemById_(docId));

    setResourcePendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackResourceRemovalChange_(docId, originalItem) {
    var existingEntry = getResourcePendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getResourceBaselineItemById_(docId));

    setResourcePendingChange_(docId, baselineItem, null, true);
  }

  function buildResourcesSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.resourcesPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.resourcesPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeResourcesComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeResourcesComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeResourcesComparableItems_(upsertItems),
      },
    };
  }

  function getResourcesPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore resources";
  }

  function canEditResources_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("resources"));
  }

  function startEditingResource_(docId) {
    var nextItem = adminState.resourcesItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.resourcesEditingId = nextItem.id;
    adminState.resourcesDraft = {
      title: nextItem.title || "",
      type: nextItem.type || "",
      description: nextItem.description || "",
      button_text: nextItem.button_text || "",
      button_url: nextItem.button_url || "",
      sort: String(nextItem.sort || 50),
      active: !!nextItem.active,
    };
    adminState.resourcesError = "";
    adminState.resourcesMessage = "Editing " + (nextItem.title || "resource") + ".";
    renderAdmin_();
  }

  function getResourceSortValue_() {
    var draft = adminState.resourcesDraft || createEmptyResourceDraft_();
    var parsed = Number(draft.sort);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getResourcesSaveButtonLabel_() {
    if (adminState.resourcesSaving) {
      return getPrimaryContentBusyLabel_(
          getPrimaryContentActionConfig_(getPageAccessLevel_("resources")),
      );
    }

    if (isSubmitForApprovalPermission_(getPageAccessLevel_("resources"))) {
      return adminState.resourcesEditingId ?
        "Submit Changes" :
        "Submit Resource";
    }

    return adminState.resourcesEditingId ?
      "Publish Changes" :
      "Publish Resource";
  }

  function saveResource_() {
    var permission = getPageAccessLevel_("resources");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditResources_()) {
      adminState.resourcesError = "Your current access level cannot edit resources.";
      renderAdmin_();
      return;
    }

    var draft = adminState.resourcesDraft || createEmptyResourceDraft_();
    var title = String(draft.title || "").trim();
    var type = String(draft.type || "").trim();
    var description = String(draft.description || "").trim();
    var buttonText = String(draft.button_text || "").trim();
    var buttonUrl = String(draft.button_url || "").trim();
    var sort = getResourceSortValue_();

    if (!title) {
      adminState.resourcesError = "Resources need a title.";
      renderAdmin_();
      return;
    }

    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      adminState.resourcesError =
        "If you use a button, enter both button text and button URL.";
      renderAdmin_();
      return;
    }

    var items = sortResourcesItems_(adminState.resourcesItems);
    var previousItem = adminState.resourcesEditingId ?
      items.find(function(item) {
        return item.id === adminState.resourcesEditingId;
      }) || getResourceBaselineItemById_(adminState.resourcesEditingId) || null :
      null;
    var sort = previousItem &&
      Number.isFinite(Number(previousItem.sort)) ?
      Number(previousItem.sort) :
      getSortableSectionNextSortValue_(items);
    var nextItem = {
      id: adminState.resourcesEditingId ||
        createResourceLocalId_(items.length),
      title: title,
      type: type,
      description: description,
      button_text: buttonText,
      button_url: buttonUrl,
      sort: sort,
      active: !!draft.active,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeResourcesComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Resource published.";

    adminState.resourcesSaving = true;
    adminState.resourcesError = "";
    adminState.resourcesMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "resources",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.resourcesSaving = false;
          adminState.resourcesDraft = createEmptyResourceDraft_();
          adminState.resourcesEditingId = "";
          adminState.resourcesMessage = result && result.message ?
            result.message :
            successMessage;
          loadResources_();
        })
        .catch(function(error) {
          adminState.resourcesSaving = false;
          adminState.resourcesError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the resource change for approval." :
              "Unable to publish the resource change to preview.");
          renderAdmin_();
        });
  }

  function deleteResource_(docId) {
    if (!docId || !canEditResources_()) {
      return;
    }

    var permission = getPageAccessLevel_("resources");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.resourcesItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.title ? nextItem.title : "this resource";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getResourceBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeResourcesComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Resource removal published.";

      adminState.resourcesSaving = true;
      adminState.resourcesError = "";
      adminState.resourcesMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "resources",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.resourcesSaving = false;
            adminState.resourcesMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.resourcesEditingId === docId) {
              adminState.resourcesDraft = createEmptyResourceDraft_();
              adminState.resourcesEditingId = "";
            }

            loadResources_();
          })
          .catch(function(error) {
            adminState.resourcesSaving = false;
            adminState.resourcesError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the resource removal for approval." :
                "Unable to publish the resource removal to preview.");
            renderAdmin_();
          });
    });
  }

  function buildResourcesPublishPayload_() {
    return {
      items: sortResourcesItems_(adminState.resourcesItems).map(function(item) {
        return {
          id: item.id,
          title: String(item.title || "").trim(),
          type: String(item.type || "").trim(),
          description: String(item.description || "").trim(),
          button_text: String(item.button_text || "").trim(),
          button_url: String(item.button_url || "").trim(),
          sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
          active: !!item.active,
        };
      }),
    };
  }

  function publishResourcesToPreview_() {
    var permission = getPageAccessLevel_("resources");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildResourcesSubmitChangeRequestData_();

    if (!canEditResources_()) {
      adminState.resourcesError =
        "Your current access level cannot change resources.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.resourcesError =
        "Make a Resources change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.resourcesPublishing = true;
    adminState.resourcesError = "";
    adminState.resourcesMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "resources",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeResourcesComparableItems_(
            adminState.resourcesBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildResourcesPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Resources submitted for approval." :
        "Resources published.",
    })
        .then(function(result) {
          adminState.resourcesPublishing = false;
          adminState.resourcesMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Resources submitted for approval." :
              "Resources published.");
          loadResources_();
        })
        .catch(function(error) {
          adminState.resourcesPublishing = false;
          adminState.resourcesError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the resources for approval." :
              "Unable to publish the resources to preview.");
          renderAdmin_();
        });
  }

  function sortRoomRulesItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          var priorityDelta = Number(a.priority || 999) - Number(b.priority || 999);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          return String(a.id || "").localeCompare(String(b.id || ""));
        });
  }

  function normalizeRoomRuleListItem_(item, index) {
    var source = item || {};

    return {
      id: String(source.id || ("room-rule-" + String(index + 1))).trim(),
      match_type: normalizeRoomRuleMatchTypeValue_(source.match_type),
      match_text: String(source.match_text || "").trim(),
      display_location: String(source.display_location || "").trim(),
      behavior: normalizeRoomRuleBehaviorValue_(source.behavior),
      priority: Number.isFinite(Number(source.priority)) ?
        Number(source.priority) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function normalizeRoomRuleDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      id: docSnapshot.id,
      match_type: normalizeRoomRuleMatchTypeValue_(data.match_type),
      match_text: String(data.match_text || "").trim(),
      display_location: String(data.display_location || "").trim(),
      behavior: normalizeRoomRuleBehaviorValue_(data.behavior),
      priority: Number.isFinite(Number(data.priority)) ?
        Number(data.priority) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function cloneRoomRulesItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        match_type: normalizeRoomRuleMatchTypeValue_(item && item.match_type),
        match_text: String(item && item.match_text || "").trim(),
        display_location: String(item && item.display_location || "").trim(),
        behavior: normalizeRoomRuleBehaviorValue_(item && item.behavior),
        priority: Number.isFinite(Number(item && item.priority)) ?
          Number(item.priority) :
          50,
        active: !!(item && item.active),
      };
    });
  }

  function normalizeRoomRulesComparableItems_(items) {
    return sortRoomRulesItems_(cloneRoomRulesItems_(items));
  }

  function normalizeRoomRuleComparableItem_(item) {
    if (!item) {
      return null;
    }

    return {
      id: String(item.id || "").trim(),
      match_type: normalizeRoomRuleMatchTypeValue_(item.match_type),
      match_text: String(item.match_text || "").trim(),
      display_location: String(item.display_location || "").trim(),
      behavior: normalizeRoomRuleBehaviorValue_(item.behavior),
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 50,
      active: !!item.active,
    };
  }

  function areRoomRuleComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeRoomRuleComparableItem_(leftItem),
        normalizeRoomRuleComparableItem_(rightItem),
    );
  }

  function getRoomRulePendingChangeEntry_(docId) {
    if (!adminState.roomRulesPendingChangesById) {
      return null;
    }

    return adminState.roomRulesPendingChangesById[docId] || null;
  }

  function getRoomRuleBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.roomRulesBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setRoomRulePendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.roomRulesPendingChangesById);
    var normalizedBaselineItem = normalizeRoomRuleComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeRoomRuleComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.roomRulesPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.roomRulesPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areRoomRuleComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.roomRulesPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.roomRulesPendingChangesById = nextChangesById;
  }

  function trackRoomRuleUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getRoomRulePendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getRoomRuleBaselineItemById_(docId));

    setRoomRulePendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackRoomRuleRemovalChange_(docId, originalItem) {
    var existingEntry = getRoomRulePendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getRoomRuleBaselineItemById_(docId));

    setRoomRulePendingChange_(docId, baselineItem, null, true);
  }

  function buildRoomRulesSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.roomRulesPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.roomRulesPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeRoomRulesComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeRoomRulesComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeRoomRulesComparableItems_(upsertItems),
      },
    };
  }

  function getRoomRulesPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore room rules";
  }

  function formatRoomRuleMatchTypeLabel_(value) {
    var matchType = normalizeRoomRuleMatchTypeValue_(value);
    var option = ROOM_RULE_MATCH_TYPE_OPTIONS.find(function(item) {
      return item.value === matchType;
    });

    return option ? option.label : matchType;
  }

  function formatRoomRuleBehaviorLabel_(value) {
    var behavior = normalizeRoomRuleBehaviorValue_(value);
    var option = ROOM_RULE_BEHAVIOR_OPTIONS.find(function(item) {
      return item.value === behavior;
    });

    return option ? option.label : behavior;
  }

  function startEditingRoomRule_(docId) {
    var nextItem = adminState.roomRulesItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.roomRulesEditingId = nextItem.id;
    expandAdminSection_("settings-room-rule-form");
    adminState.roomRulesDraft = {
      match_type: normalizeRoomRuleMatchTypeValue_(nextItem.match_type),
      match_text: nextItem.match_text || "",
      display_location: nextItem.display_location || "",
      behavior: normalizeRoomRuleBehaviorValue_(nextItem.behavior),
      priority: String(nextItem.priority || 50),
      active: !!nextItem.active,
    };
    adminState.roomRulesError = "";
    adminState.roomRulesMessage = "Editing " + (nextItem.match_text || "room rule") + ".";
    renderAdmin_();
  }

  function getRoomRulePriorityValue_() {
    var draft = adminState.roomRulesDraft || createEmptyRoomRuleDraft_();
    var parsed = Number(draft.priority);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getRoomRuleSaveButtonLabel_() {
    if (isSubmitForApprovalPermission_(getPageAccessLevel_("roomRules"))) {
      return adminState.roomRulesEditingId ?
        "Submit Changes" :
        "Submit Room Rule";
    }

    return adminState.roomRulesEditingId ?
      "Publish Changes" :
      "Publish Room Rule";
  }

  function getRoomRuleSaveBusyLabel_() {
    return getPrimaryContentBusyLabel_(
        getPrimaryContentActionConfig_(getPageAccessLevel_("roomRules")),
    );
  }

  function saveRoomRule_() {
    var permission = getPageAccessLevel_("roomRules");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditRoomRules_()) {
      adminState.roomRulesError =
        "Your current access level cannot edit room rules.";
      renderAdmin_();
      return;
    }

    var draft = adminState.roomRulesDraft || createEmptyRoomRuleDraft_();
    var matchType = normalizeRoomRuleMatchTypeValue_(draft.match_type);
    var matchText = String(draft.match_text || "").trim();
    var displayLocation = String(draft.display_location || "").trim();
    var behavior = normalizeRoomRuleBehaviorValue_(draft.behavior);
    var priority = getRoomRulePriorityValue_();

    if (!matchText) {
      adminState.roomRulesError = "Room Rules need match text.";
      renderAdmin_();
      return;
    }

    var items = sortRoomRulesItems_(adminState.roomRulesItems);
    var previousItem = adminState.roomRulesEditingId ?
      items.find(function(item) {
        return item.id === adminState.roomRulesEditingId;
      }) || getRoomRuleBaselineItemById_(adminState.roomRulesEditingId) || null :
      null;
    var nextItem = {
      id: adminState.roomRulesEditingId ||
        createRoomRuleLocalId_(items.length),
      match_type: matchType,
      match_text: matchText,
      display_location: displayLocation,
      behavior: behavior,
      priority: priority,
      active: !!draft.active,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeRoomRulesComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Room Rule published.";

    adminState.roomRulesSaving = true;
    adminState.roomRulesError = "";
    adminState.roomRulesMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "roomRules",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.roomRulesSaving = false;
          adminState.roomRulesDraft = createEmptyRoomRuleDraft_();
          adminState.roomRulesEditingId = "";
          adminState.roomRulesMessage = result && result.message ?
            result.message :
            successMessage;
          loadSettings_({
            roomRules: adminState.roomRulesMessage,
          });
        })
        .catch(function(error) {
          adminState.roomRulesSaving = false;
          adminState.roomRulesError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the room-rule change for approval." :
              "Unable to publish the room-rule change to preview.");
          renderAdmin_();
        });
  }

  function deleteRoomRule_(docId) {
    if (!docId || !canEditRoomRules_()) {
      return;
    }

    var permission = getPageAccessLevel_("roomRules");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.roomRulesItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.match_text ?
      nextItem.match_text :
      "this room rule";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getRoomRuleBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeRoomRulesComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Room Rule removal published.";

      adminState.roomRulesSaving = true;
      adminState.roomRulesError = "";
      adminState.roomRulesMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "roomRules",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.roomRulesSaving = false;
            adminState.roomRulesMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.roomRulesEditingId === docId) {
              adminState.roomRulesDraft = createEmptyRoomRuleDraft_();
              adminState.roomRulesEditingId = "";
            }

            loadSettings_({
              roomRules: adminState.roomRulesMessage,
            });
          })
          .catch(function(error) {
            adminState.roomRulesSaving = false;
            adminState.roomRulesError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the room-rule removal for approval." :
                "Unable to publish the room-rule removal to preview.");
            renderAdmin_();
          });
    });
  }

  function buildRoomRulesPublishPayload_() {
    return {
      items: sortRoomRulesItems_(adminState.roomRulesItems).map(function(item) {
        return {
          id: item.id,
          match_type: normalizeRoomRuleMatchTypeValue_(item.match_type),
          match_text: String(item.match_text || "").trim(),
          display_location: String(item.display_location || "").trim(),
          behavior: normalizeRoomRuleBehaviorValue_(item.behavior),
          priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 50,
          active: !!item.active,
        };
      }),
    };
  }

  function publishRoomRulesToPreview_() {
    var permission = getPageAccessLevel_("roomRules");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildRoomRulesSubmitChangeRequestData_();

    if (!canEditRoomRules_()) {
      adminState.roomRulesError =
        "Your current access level cannot change room rules.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.roomRulesError =
        "Make a Room Rules change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.roomRulesPublishing = true;
    adminState.roomRulesError = "";
    adminState.roomRulesMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "roomRules",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeRoomRulesComparableItems_(
            adminState.roomRulesBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildRoomRulesPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Room Rules submitted for approval." :
        "Room Rules published.",
    })
        .then(function(result) {
          adminState.roomRulesPublishing = false;
          adminState.roomRulesMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Room Rules submitted for approval." :
              "Room Rules published.");
          loadSettings_({
            roomRules: adminState.roomRulesMessage,
          });
        })
        .catch(function(error) {
          adminState.roomRulesPublishing = false;
          adminState.roomRulesError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Room Rules for approval." :
              "Unable to publish the Room Rules to preview.");
          renderAdmin_();
        });
  }

  function normalizeRoomRuleMatchTypeValue_(value) {
    var normalized = String(value || "").trim().toLowerCase();

    if (normalized === "exact" ||
      normalized === "contains" ||
      normalized === "starts_with" ||
      normalized === "ends_with") {
      return normalized;
    }

    return "contains";
  }

  function normalizeRoomRuleBehaviorValue_(value) {
    var normalized = String(value || "").trim().toLowerCase();

    if (normalized === "replace" ||
      normalized === "ignore" ||
      normalized === "ignore_if_multiple") {
      return normalized;
    }

    return "replace";
  }

  function createEmptyCampaignDraft_() {
    return {
      title: "",
      description: "",
      button_text: "",
      button_url: "",
      ongoing: false,
      start_date: "",
      end_date: "",
      sort: "50",
      active: true,
    };
  }

  function resetCampaignsDraft_() {
    adminState.campaignsDraft = createEmptyCampaignDraft_();
    adminState.campaignsEditingId = "";
    adminState.campaignsError = "";
    adminState.campaignsMessage = "";
  }

  function resetCampaignsState_() {
    adminState.campaignsLoaded = false;
    adminState.campaignsLoading = false;
    adminState.campaignsSaving = false;
    adminState.campaignsPublishing = false;
    adminState.campaignsItems = [];
    adminState.campaignsBaselineItems = [];
    adminState.campaignsPendingChangesById = {};
    adminState.campaignsPublishedItems = [];
    adminState.campaignsUsingPublishedFallback = false;
    adminState.campaignsDraft = createEmptyCampaignDraft_();
    adminState.campaignsEditingId = "";
    adminState.campaignsError = "";
    adminState.campaignsMessage = "";
  }

  function sortCampaignsItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          var sortDelta = Number(a.sort || 999) - Number(b.sort || 999);
          if (sortDelta !== 0) {
            return sortDelta;
          }

          return String(a.id || "").localeCompare(String(b.id || ""));
        });
  }

  function normalizeCampaignDateValue_(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim()) ?
      String(value || "").trim() :
      "";
  }

  function getNormalizedCampaignOngoingValue_(source) {
    var hasOngoingValue = source &&
      Object.prototype.hasOwnProperty.call(source, "ongoing");
    var startDate = normalizeCampaignDateValue_(source && source.start_date);
    var endDate = normalizeCampaignDateValue_(source && source.end_date);

    if (hasOngoingValue) {
      return source.ongoing === true ||
        String(source.ongoing || "").toLowerCase() === "true";
    }

    return !startDate && !endDate;
  }

  function normalizeCampaignListItem_(item, index) {
    var source = item || {};
    var ongoing = getNormalizedCampaignOngoingValue_(source);

    return {
      id: String(source.id || ("campaign-" + String(index + 1))).trim(),
      title: String(source.title || "").trim(),
      description: String(source.description || "").trim(),
      button_text: String(source.button_text || "").trim(),
      button_url: String(source.button_url || "").trim(),
      ongoing: ongoing,
      start_date: ongoing ? "" : normalizeCampaignDateValue_(source.start_date),
      end_date: ongoing ? "" : normalizeCampaignDateValue_(source.end_date),
      sort: Number.isFinite(Number(source.sort)) ?
        Number(source.sort) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function normalizeCampaignDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};
    var ongoing = getNormalizedCampaignOngoingValue_(data);

    return {
      id: docSnapshot.id,
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      button_text: String(data.button_text || "").trim(),
      button_url: String(data.button_url || "").trim(),
      ongoing: ongoing,
      start_date: ongoing ? "" : normalizeCampaignDateValue_(data.start_date),
      end_date: ongoing ? "" : normalizeCampaignDateValue_(data.end_date),
      sort: Number.isFinite(Number(data.sort)) ?
        Number(data.sort) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function cloneCampaignsItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        title: String(item && item.title || "").trim(),
        description: String(item && item.description || "").trim(),
        button_text: String(item && item.button_text || "").trim(),
        button_url: String(item && item.button_url || "").trim(),
        ongoing: !!(item && item.ongoing),
        start_date: normalizeCampaignDateValue_(item && item.start_date),
        end_date: normalizeCampaignDateValue_(item && item.end_date),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
        active: !!(item && item.active),
      };
    });
  }

  function normalizeCampaignsComparableItems_(items) {
    return sortCampaignsItems_(cloneCampaignsItems_(items));
  }

  function normalizeCampaignComparableItem_(item) {
    var comparableItems = normalizeCampaignsComparableItems_(
        item ? [item] : [],
    );
    return comparableItems.length ? comparableItems[0] : null;
  }

  function areCampaignComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeCampaignComparableItem_(leftItem),
        normalizeCampaignComparableItem_(rightItem),
    );
  }

  function getCampaignPendingChangeEntry_(docId) {
    if (!docId) {
      return null;
    }

    if (!adminState.campaignsPendingChangesById) {
      return null;
    }

    return adminState.campaignsPendingChangesById[docId] || null;
  }

  function getCampaignBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.campaignsBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setCampaignPendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.campaignsPendingChangesById);
    var normalizedBaselineItem = normalizeCampaignComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeCampaignComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.campaignsPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.campaignsPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areCampaignComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.campaignsPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.campaignsPendingChangesById = nextChangesById;
  }

  function trackCampaignUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getCampaignPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getCampaignBaselineItemById_(docId));

    setCampaignPendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackCampaignRemovalChange_(docId, originalItem) {
    var existingEntry = getCampaignPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getCampaignBaselineItemById_(docId));

    setCampaignPendingChange_(docId, baselineItem, null, true);
  }

  function buildCampaignsSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.campaignsPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.campaignsPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeCampaignsComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeCampaignsComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeCampaignsComparableItems_(upsertItems),
      },
    };
  }

  function getCampaignsPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore campaigns";
  }

  function canEditCampaigns_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("campaigns"));
  }

  function startEditingCampaign_(docId) {
    var nextItem = adminState.campaignsItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.campaignsEditingId = nextItem.id;
    adminState.campaignsDraft = {
      title: nextItem.title || "",
      description: nextItem.description || "",
      button_text: nextItem.button_text || "",
      button_url: nextItem.button_url || "",
      ongoing: !!nextItem.ongoing,
      start_date: nextItem.start_date || "",
      end_date: nextItem.end_date || "",
      sort: String(nextItem.sort || 50),
      active: !!nextItem.active,
    };
    adminState.campaignsError = "";
    adminState.campaignsMessage = "Editing " + (nextItem.title || "campaign") + ".";
    renderAdmin_();
  }

  function getCampaignSortValue_() {
    var draft = adminState.campaignsDraft || createEmptyCampaignDraft_();
    var parsed = Number(draft.sort);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getCampaignsSaveButtonLabel_() {
    if (adminState.campaignsSaving) {
      return getPrimaryContentBusyLabel_(
          getPrimaryContentActionConfig_(getPageAccessLevel_("campaigns")),
      );
    }

    if (isSubmitForApprovalPermission_(getPageAccessLevel_("campaigns"))) {
      return adminState.campaignsEditingId ?
        "Submit Changes" :
        "Submit Campaign";
    }

    return adminState.campaignsEditingId ?
      "Publish Changes" :
      "Publish Campaign";
  }

  function getCampaignScheduleLabel_(item) {
    if (item && item.ongoing) {
      return "Ongoing";
    }

    var startDate = normalizeCampaignDateValue_(item && item.start_date);
    var endDate = normalizeCampaignDateValue_(item && item.end_date);

    if (startDate && endDate) {
      return startDate + " to " + endDate;
    }

    if (startDate) {
      return "Starts " + startDate;
    }

    if (endDate) {
      return "Ends " + endDate;
    }

    return "Always visible";
  }

  function saveCampaign_() {
    var permission = getPageAccessLevel_("campaigns");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditCampaigns_()) {
      adminState.campaignsError = "Your current access level cannot edit campaigns.";
      renderAdmin_();
      return;
    }

    var draft = adminState.campaignsDraft || createEmptyCampaignDraft_();
    var title = String(draft.title || "").trim();
    var description = String(draft.description || "").trim();
    var buttonText = String(draft.button_text || "").trim();
    var buttonUrl = String(draft.button_url || "").trim();
    var ongoing = !!draft.ongoing;
    var startDate = ongoing ? "" : normalizeCampaignDateValue_(draft.start_date);
    var endDate = ongoing ? "" : normalizeCampaignDateValue_(draft.end_date);
    var sort = getCampaignSortValue_();

    if (!title) {
      adminState.campaignsError = "Campaigns need a title.";
      renderAdmin_();
      return;
    }

    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      adminState.campaignsError =
        "If you use a button, enter both button text and button URL.";
      renderAdmin_();
      return;
    }

    if (!ongoing && (!startDate || !endDate)) {
      adminState.campaignsError =
        "Scheduled campaigns need both a start date and an end date.";
      renderAdmin_();
      return;
    }

    if (!ongoing && endDate < startDate) {
      adminState.campaignsError =
        "The campaign end date must be on or after the start date.";
      renderAdmin_();
      return;
    }

    var items = sortCampaignsItems_(adminState.campaignsItems);
    var previousItem = adminState.campaignsEditingId ?
      items.find(function(item) {
        return item.id === adminState.campaignsEditingId;
      }) || getCampaignBaselineItemById_(adminState.campaignsEditingId) || null :
      null;
    var sort = previousItem &&
      Number.isFinite(Number(previousItem.sort)) ?
      Number(previousItem.sort) :
      getSortableSectionNextSortValue_(items);
    var nextItem = {
      id: adminState.campaignsEditingId ||
        createCampaignLocalId_(items.length),
      title: title,
      description: description,
      button_text: buttonText,
      button_url: buttonUrl,
      ongoing: ongoing,
      start_date: startDate,
      end_date: endDate,
      sort: sort,
      active: !!draft.active,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeCampaignsComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Campaign published.";

    adminState.campaignsSaving = true;
    adminState.campaignsError = "";
    adminState.campaignsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "campaigns",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.campaignsSaving = false;
          adminState.campaignsDraft = createEmptyCampaignDraft_();
          adminState.campaignsEditingId = "";
          adminState.campaignsMessage = result && result.message ?
            result.message :
            successMessage;
          loadCampaigns_();
        })
        .catch(function(error) {
          adminState.campaignsSaving = false;
          adminState.campaignsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the campaign change for approval." :
              "Unable to publish the campaign change to preview.");
          renderAdmin_();
        });
  }

  function deleteCampaign_(docId) {
    if (!docId || !canEditCampaigns_()) {
      return;
    }

    var permission = getPageAccessLevel_("campaigns");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.campaignsItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.title ? nextItem.title : "this campaign";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getCampaignBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeCampaignsComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Campaign removal published.";

      adminState.campaignsSaving = true;
      adminState.campaignsError = "";
      adminState.campaignsMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "campaigns",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.campaignsSaving = false;
            adminState.campaignsMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.campaignsEditingId === docId) {
              adminState.campaignsDraft = createEmptyCampaignDraft_();
              adminState.campaignsEditingId = "";
            }

            loadCampaigns_();
          })
          .catch(function(error) {
            adminState.campaignsSaving = false;
            adminState.campaignsError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the campaign removal for approval." :
                "Unable to publish the campaign removal to preview.");
            renderAdmin_();
          });
    });
  }

  function buildCampaignsPublishPayload_() {
    return {
      items: sortCampaignsItems_(adminState.campaignsItems).map(function(item) {
        return {
          id: item.id,
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          button_text: String(item.button_text || "").trim(),
          button_url: String(item.button_url || "").trim(),
          ongoing: !!item.ongoing,
          start_date: item.ongoing ? "" : normalizeCampaignDateValue_(item.start_date),
          end_date: item.ongoing ? "" : normalizeCampaignDateValue_(item.end_date),
          sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
          active: !!item.active,
        };
      }),
    };
  }

  function publishCampaignsToPreview_() {
    var permission = getPageAccessLevel_("campaigns");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildCampaignsSubmitChangeRequestData_();

    if (!canEditCampaigns_()) {
      adminState.campaignsError =
        "Your current access level cannot change campaigns.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.campaignsError =
        "Make a Campaigns change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.campaignsPublishing = true;
    adminState.campaignsError = "";
    adminState.campaignsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "campaigns",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeCampaignsComparableItems_(
            adminState.campaignsBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildCampaignsPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Campaigns submitted for approval." :
        "Campaigns published.",
    })
        .then(function(result) {
          adminState.campaignsPublishing = false;
          adminState.campaignsMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Campaigns submitted for approval." :
              "Campaigns published.");
          loadCampaigns_();
        })
        .catch(function(error) {
          adminState.campaignsPublishing = false;
          adminState.campaignsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the campaigns for approval." :
              "Unable to publish the campaigns to preview.");
          renderAdmin_();
        });
  }

  function createEmptyServeNeedDraft_() {
    return {
      need: "",
      ministry: "",
      priority: "normal",
      description: "",
      button_text: "",
      contact_email: "",
      sort: "50",
      active: true,
    };
  }

  function resetServeNeedsDraft_() {
    adminState.serveNeedsDraft = createEmptyServeNeedDraft_();
    adminState.serveNeedsEditingId = "";
    adminState.serveNeedsError = "";
    adminState.serveNeedsMessage = "";
  }

  function resetServeNeedsState_() {
    adminState.serveNeedsLoaded = false;
    adminState.serveNeedsLoading = false;
    adminState.serveNeedsSaving = false;
    adminState.serveNeedsPublishing = false;
    adminState.serveNeedsItems = [];
    adminState.serveNeedsBaselineItems = [];
    adminState.serveNeedsPendingChangesById = {};
    adminState.serveNeedsPublishedItems = [];
    adminState.serveNeedsUsingPublishedFallback = false;
    adminState.serveNeedsDraft = createEmptyServeNeedDraft_();
    adminState.serveNeedsEditingId = "";
    adminState.serveNeedsError = "";
    adminState.serveNeedsMessage = "";
  }

  function sortServeNeedsItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          var sortDelta = Number(a.sort || 999) - Number(b.sort || 999);
          if (sortDelta !== 0) {
            return sortDelta;
          }

          return String(a.id || "").localeCompare(String(b.id || ""));
        });
  }

  function normalizeServeNeedPriorityValue_(value) {
    return String(value || "normal").trim().toLowerCase() || "normal";
  }

  function normalizeServeNeedListItem_(item, index) {
    var source = item || {};

    return {
      id: String(source.id || ("serve-need-" + String(index + 1))).trim(),
      need: String(source.need || source.title || "").trim(),
      ministry: String(source.ministry || "").trim(),
      priority: normalizeServeNeedPriorityValue_(
          source.priority || source.urgency,
      ),
      description: String(source.description || "").trim(),
      button_text: String(source.button_text || "").trim(),
      contact_email: String(
          source.contact_email || source.email || "",
      ).trim(),
      sort: Number.isFinite(Number(source.sort)) ?
        Number(source.sort) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function normalizeServeNeedDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      id: docSnapshot.id,
      need: String(data.need || "").trim(),
      ministry: String(data.ministry || "").trim(),
      priority: normalizeServeNeedPriorityValue_(data.priority),
      description: String(data.description || "").trim(),
      button_text: String(data.button_text || "").trim(),
      contact_email: String(data.contact_email || "").trim(),
      sort: Number.isFinite(Number(data.sort)) ?
        Number(data.sort) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function cloneServeNeedsItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        need: String(item && item.need || "").trim(),
        ministry: String(item && item.ministry || "").trim(),
        priority: normalizeServeNeedPriorityValue_(item && item.priority),
        description: String(item && item.description || "").trim(),
        button_text: String(item && item.button_text || "").trim(),
        contact_email: String(item && item.contact_email || "").trim(),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
        active: !!(item && item.active),
      };
    });
  }

  function normalizeServeNeedsComparableItems_(items) {
    return sortServeNeedsItems_(cloneServeNeedsItems_(items));
  }

  function normalizeServeNeedComparableItem_(item) {
    var comparableItems = normalizeServeNeedsComparableItems_(
        item ? [item] : [],
    );
    return comparableItems.length ? comparableItems[0] : null;
  }

  function areServeNeedComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeServeNeedComparableItem_(leftItem),
        normalizeServeNeedComparableItem_(rightItem),
    );
  }

  function getServeNeedPendingChangeEntry_(docId) {
    if (!docId) {
      return null;
    }

    if (!adminState.serveNeedsPendingChangesById) {
      return null;
    }

    return adminState.serveNeedsPendingChangesById[docId] || null;
  }

  function getServeNeedBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.serveNeedsBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setServeNeedPendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.serveNeedsPendingChangesById);
    var normalizedBaselineItem = normalizeServeNeedComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeServeNeedComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.serveNeedsPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.serveNeedsPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areServeNeedComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.serveNeedsPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.serveNeedsPendingChangesById = nextChangesById;
  }

  function trackServeNeedUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getServeNeedPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getServeNeedBaselineItemById_(docId));

    setServeNeedPendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackServeNeedRemovalChange_(docId, originalItem) {
    var existingEntry = getServeNeedPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getServeNeedBaselineItemById_(docId));

    setServeNeedPendingChange_(docId, baselineItem, null, true);
  }

  function buildServeNeedsSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.serveNeedsPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.serveNeedsPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeServeNeedsComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeServeNeedsComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeServeNeedsComparableItems_(upsertItems),
      },
    };
  }

  function getServeNeedsPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore serve needs";
  }

  function canEditServeNeeds_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("serveNeeds"));
  }

  function startEditingServeNeed_(docId) {
    var nextItem = adminState.serveNeedsItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.serveNeedsEditingId = nextItem.id;
    adminState.serveNeedsDraft = {
      need: nextItem.need || "",
      ministry: nextItem.ministry || "",
      priority: nextItem.priority || "normal",
      description: nextItem.description || "",
      button_text: nextItem.button_text || "",
      contact_email: nextItem.contact_email || "",
      sort: String(nextItem.sort || 50),
      active: !!nextItem.active,
    };
    adminState.serveNeedsError = "";
    adminState.serveNeedsMessage = "Editing " + (nextItem.need || "serve need") + ".";
    renderAdmin_();
  }

  function getServeNeedSortValue_() {
    var draft = adminState.serveNeedsDraft || createEmptyServeNeedDraft_();
    var parsed = Number(draft.sort);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getServeNeedsSaveButtonLabel_() {
    if (adminState.serveNeedsSaving) {
      return getPrimaryContentBusyLabel_(
          getPrimaryContentActionConfig_(getPageAccessLevel_("serveNeeds")),
      );
    }

    if (isSubmitForApprovalPermission_(getPageAccessLevel_("serveNeeds"))) {
      return adminState.serveNeedsEditingId ?
        "Submit Changes" :
        "Submit Serve Need";
    }

    return adminState.serveNeedsEditingId ?
      "Publish Changes" :
      "Publish Serve Need";
  }

  function saveServeNeed_() {
    var permission = getPageAccessLevel_("serveNeeds");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditServeNeeds_()) {
      adminState.serveNeedsError =
        "Your current access level cannot edit serve needs.";
      renderAdmin_();
      return;
    }

    var draft = adminState.serveNeedsDraft || createEmptyServeNeedDraft_();
    var need = String(draft.need || "").trim();
    var ministry = String(draft.ministry || "").trim();
    var priority = normalizeServeNeedPriorityValue_(draft.priority);
    var description = String(draft.description || "").trim();
    var buttonText = String(draft.button_text || "").trim();
    var contactEmail = String(draft.contact_email || "").trim();
    var sort = getServeNeedSortValue_();

    if (!need) {
      adminState.serveNeedsError = "Serve Needs need a title.";
      renderAdmin_();
      return;
    }

    if (!ministry) {
      adminState.serveNeedsError = "Serve Needs need a ministry.";
      renderAdmin_();
      return;
    }

    if (!buttonText) {
      adminState.serveNeedsError = "Serve Needs need button text.";
      renderAdmin_();
      return;
    }

    if (!contactEmail || contactEmail.indexOf("@") === -1) {
      adminState.serveNeedsError =
        "Serve Needs need a valid contact email address.";
      renderAdmin_();
      return;
    }

    var items = sortServeNeedsItems_(adminState.serveNeedsItems);
    var previousItem = adminState.serveNeedsEditingId ?
      items.find(function(item) {
        return item.id === adminState.serveNeedsEditingId;
      }) || getServeNeedBaselineItemById_(adminState.serveNeedsEditingId) || null :
      null;
    var sort = previousItem &&
      Number.isFinite(Number(previousItem.sort)) ?
      Number(previousItem.sort) :
      getSortableSectionNextSortValue_(items);
    var nextItem = {
      id: adminState.serveNeedsEditingId ||
        createServeNeedLocalId_(items.length),
      need: need,
      ministry: ministry,
      priority: priority,
      description: description,
      button_text: buttonText,
      contact_email: contactEmail,
      sort: sort,
      active: !!draft.active,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeServeNeedsComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Serve Need published.";

    adminState.serveNeedsSaving = true;
    adminState.serveNeedsError = "";
    adminState.serveNeedsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "serveNeeds",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.serveNeedsSaving = false;
          adminState.serveNeedsDraft = createEmptyServeNeedDraft_();
          adminState.serveNeedsEditingId = "";
          adminState.serveNeedsMessage = result && result.message ?
            result.message :
            successMessage;
          loadServeNeeds_();
        })
        .catch(function(error) {
          adminState.serveNeedsSaving = false;
          adminState.serveNeedsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the serve-need change for approval." :
              "Unable to publish the serve-need change to preview.");
          renderAdmin_();
        });
  }

  function deleteServeNeed_(docId) {
    if (!docId || !canEditServeNeeds_()) {
      return;
    }

    var permission = getPageAccessLevel_("serveNeeds");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.serveNeedsItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.need ? nextItem.need : "this serve need";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getServeNeedBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeServeNeedsComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Serve Need removal published.";

      adminState.serveNeedsSaving = true;
      adminState.serveNeedsError = "";
      adminState.serveNeedsMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "serveNeeds",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.serveNeedsSaving = false;
            adminState.serveNeedsMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.serveNeedsEditingId === docId) {
              adminState.serveNeedsDraft = createEmptyServeNeedDraft_();
              adminState.serveNeedsEditingId = "";
            }

            loadServeNeeds_();
          })
          .catch(function(error) {
            adminState.serveNeedsSaving = false;
            adminState.serveNeedsError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the serve-need removal for approval." :
                "Unable to publish the serve-need removal to preview.");
            renderAdmin_();
          });
    });
  }

  function buildServeNeedsPublishPayload_() {
    return {
      items: sortServeNeedsItems_(adminState.serveNeedsItems).map(function(item) {
        return {
          id: item.id,
          need: String(item.need || "").trim(),
          ministry: String(item.ministry || "").trim(),
          priority: normalizeServeNeedPriorityValue_(item.priority),
          description: String(item.description || "").trim(),
          button_text: String(item.button_text || "").trim(),
          contact_email: String(item.contact_email || "").trim(),
          sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
          active: !!item.active,
        };
      }),
    };
  }

  function publishServeNeedsToPreview_() {
    var permission = getPageAccessLevel_("serveNeeds");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildServeNeedsSubmitChangeRequestData_();

    if (!canEditServeNeeds_()) {
      adminState.serveNeedsError =
        "Your current access level cannot change serve needs.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.serveNeedsError =
        "Make a Serve Needs change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.serveNeedsPublishing = true;
    adminState.serveNeedsError = "";
    adminState.serveNeedsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "serveNeeds",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeServeNeedsComparableItems_(
            adminState.serveNeedsBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildServeNeedsPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Serve Needs submitted for approval." :
        "Serve Needs published.",
    })
        .then(function(result) {
          adminState.serveNeedsPublishing = false;
          adminState.serveNeedsMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Serve Needs submitted for approval." :
              "Serve Needs published.");
          loadServeNeeds_();
        })
        .catch(function(error) {
          adminState.serveNeedsPublishing = false;
          adminState.serveNeedsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the serve needs for approval." :
              "Unable to publish the serve needs to preview.");
          renderAdmin_();
        });
  }

  function createEmptyNextStepDraft_() {
    return {
      title: "",
      description: "",
      button_text: "",
      button_url: "",
      sort: "50",
      active: true,
    };
  }

  function resetNextStepsDraft_() {
    adminState.nextStepsDraft = createEmptyNextStepDraft_();
    adminState.nextStepsEditingId = "";
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "";
  }

  function resetNextStepsState_() {
    adminState.nextStepsLoaded = false;
    adminState.nextStepsLoading = false;
    adminState.nextStepsSaving = false;
    adminState.nextStepsPublishing = false;
    adminState.nextStepsItems = [];
    adminState.nextStepsBaselineItems = [];
    adminState.nextStepsPendingChangesById = {};
    adminState.nextStepsPublishedItems = [];
    adminState.nextStepsUsingPublishedFallback = false;
    adminState.nextStepsDraft = createEmptyNextStepDraft_();
    adminState.nextStepsEditingId = "";
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "";
  }

  function sortNextStepsItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(a, b) {
          var sortDelta = Number(a.sort || 999) - Number(b.sort || 999);
          if (sortDelta !== 0) {
            return sortDelta;
          }

          return String(a.id || "").localeCompare(String(b.id || ""));
        });
  }

  function normalizeNextStepListItem_(item, index) {
    var source = item || {};

    return {
      id: String(source.id || ("next-step-" + String(index + 1))).trim(),
      title: String(source.title || "").trim(),
      description: String(source.description || "").trim(),
      button_text: String(source.button_text || "").trim(),
      button_url: String(source.button_url || "").trim(),
      sort: Number.isFinite(Number(source.sort)) ?
        Number(source.sort) :
        50,
      active: source.active === true ||
        String(source.active || "").toLowerCase() === "true",
    };
  }

  function normalizeNextStepDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};

    return {
      id: docSnapshot.id,
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      button_text: String(data.button_text || "").trim(),
      button_url: String(data.button_url || "").trim(),
      sort: Number.isFinite(Number(data.sort)) ?
        Number(data.sort) :
        50,
      active: data.active === true || String(data.active || "").toLowerCase() === "true",
    };
  }

  function cloneNextStepsItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        title: String(item && item.title || "").trim(),
        description: String(item && item.description || "").trim(),
        button_text: String(item && item.button_text || "").trim(),
        button_url: String(item && item.button_url || "").trim(),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
        active: !!(item && item.active),
      };
    });
  }

  function normalizeNextStepsComparableItems_(items) {
    return sortNextStepsItems_(cloneNextStepsItems_(items));
  }

  function normalizeNextStepComparableItem_(item) {
    if (!item) {
      return null;
    }

    return {
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim(),
      button_text: String(item.button_text || "").trim(),
      button_url: String(item.button_url || "").trim(),
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
      active: !!item.active,
    };
  }

  function areNextStepComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeNextStepComparableItem_(leftItem),
        normalizeNextStepComparableItem_(rightItem),
    );
  }

  function getNextStepPendingChangeEntry_(docId) {
    if (!adminState.nextStepsPendingChangesById) {
      return null;
    }

    return adminState.nextStepsPendingChangesById[docId] || null;
  }

  function getNextStepBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.nextStepsBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setNextStepPendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.nextStepsPendingChangesById);
    var normalizedBaselineItem = normalizeNextStepComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeNextStepComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.nextStepsPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.nextStepsPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areNextStepComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.nextStepsPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.nextStepsPendingChangesById = nextChangesById;
  }

  function trackNextStepUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getNextStepPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getNextStepBaselineItemById_(docId));

    setNextStepPendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackNextStepRemovalChange_(docId, originalItem) {
    var existingEntry = getNextStepPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getNextStepBaselineItemById_(docId));

    setNextStepPendingChange_(docId, baselineItem, null, true);
  }

  function buildNextStepsSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.nextStepsPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.nextStepsPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeNextStepsComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeNextStepsComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeNextStepsComparableItems_(upsertItems),
      },
    };
  }

  function getNextStepsPreviewBehaviorLabel_() {
    return "Central is currently using the published Firestore Next Steps";
  }

  function canEditNextSteps_() {
    return canChangeContentWithPermission_(getPageAccessLevel_("nextSteps"));
  }

  function startEditingNextStep_(docId) {
    var nextItem = adminState.nextStepsItems.find(function(item) {
      return item.id === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.nextStepsEditingId = nextItem.id;
    adminState.nextStepsDraft = {
      title: nextItem.title || "",
      description: nextItem.description || "",
      button_text: nextItem.button_text || "",
      button_url: nextItem.button_url || "",
      sort: String(nextItem.sort || 50),
      active: !!nextItem.active,
    };
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "Editing " + (nextItem.title || "next step") + ".";
    renderAdmin_();
  }

  function getNextStepSortValue_() {
    var draft = adminState.nextStepsDraft || createEmptyNextStepDraft_();
    var parsed = Number(draft.sort);
    return Number.isFinite(parsed) ? parsed : 50;
  }

  function getNextStepsSaveButtonLabel_() {
    if (adminState.nextStepsSaving) {
      return getPrimaryContentBusyLabel_(
          getPrimaryContentActionConfig_(getPageAccessLevel_("nextSteps")),
      );
    }

    if (isSubmitForApprovalPermission_(getPageAccessLevel_("nextSteps"))) {
      return adminState.nextStepsEditingId ?
        "Submit Changes" :
        "Submit Next Step";
    }

    return adminState.nextStepsEditingId ?
      "Publish Changes" :
      "Publish Next Step";
  }

  function saveNextStep_() {
    var permission = getPageAccessLevel_("nextSteps");
    var actionConfig = getPrimaryContentActionConfig_(permission);

    if (!canEditNextSteps_()) {
      adminState.nextStepsError = "Your current access level cannot edit Next Steps.";
      renderAdmin_();
      return;
    }

    var draft = adminState.nextStepsDraft || createEmptyNextStepDraft_();
    var title = String(draft.title || "").trim();
    var description = String(draft.description || "").trim();
    var buttonText = String(draft.button_text || "").trim();
    var buttonUrl = String(draft.button_url || "").trim();
    var sort = getNextStepSortValue_();

    if (!title) {
      adminState.nextStepsError = "Next Steps need a title.";
      renderAdmin_();
      return;
    }

    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      adminState.nextStepsError =
        "If you use a button, enter both button text and button URL.";
      renderAdmin_();
      return;
    }

    var items = sortNextStepsItems_(adminState.nextStepsItems);
    var previousItem = adminState.nextStepsEditingId ?
      items.find(function(item) {
        return item.id === adminState.nextStepsEditingId;
      }) || getNextStepBaselineItemById_(adminState.nextStepsEditingId) || null :
      null;
    var sort = previousItem &&
      Number.isFinite(Number(previousItem.sort)) ?
      Number(previousItem.sort) :
      getSortableSectionNextSortValue_(items);
    var nextItem = {
      id: adminState.nextStepsEditingId ||
        createNextStepLocalId_(items.length),
      title: title,
      description: description,
      button_text: buttonText,
      button_url: buttonUrl,
      sort: sort,
      active: !!draft.active,
    };
    var submitChangeData = buildSingleItemUpsertChangeRequestData_(
        normalizeNextStepsComparableItems_,
        previousItem,
        nextItem,
    );
    var successMessage = actionConfig.mode === "submit" ?
      "Your change request was submitted for approval. Preview will update after an admin approves it." :
      "Next Step published.";

    adminState.nextStepsSaving = true;
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "nextSteps",
      permission: permission,
      baselineItems: submitChangeData.baselineItems,
      changeSet: submitChangeData.changeSet,
      payload: submitChangeData.payload,
      successMessage: successMessage,
    })
        .then(function(result) {
          adminState.nextStepsSaving = false;
          adminState.nextStepsDraft = createEmptyNextStepDraft_();
          adminState.nextStepsEditingId = "";
          adminState.nextStepsMessage = result && result.message ?
            result.message :
            successMessage;
          loadNextSteps_();
        })
        .catch(function(error) {
          adminState.nextStepsSaving = false;
          adminState.nextStepsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Next Step change for approval." :
              "Unable to publish the Next Step change to preview.");
          renderAdmin_();
        });
  }

  function deleteNextStep_(docId) {
    if (!docId || !canEditNextSteps_()) {
      return;
    }

    var permission = getPageAccessLevel_("nextSteps");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var nextItem = adminState.nextStepsItems.find(function(item) {
      return item.id === docId;
    });
    var label = nextItem && nextItem.title ? nextItem.title : "this next step";
    confirmDeleteAction_(actionConfig, label, function() {
      var baselineItem = nextItem || getNextStepBaselineItemById_(docId) || null;
      var submitChangeData = buildSingleItemRemovalChangeRequestData_(
          normalizeNextStepsComparableItems_,
          baselineItem,
          docId,
      );
      var successMessage = actionConfig.mode === "submit" ?
        "Your change request was submitted for approval. Preview will update after an admin approves it." :
        "Next Step removal published.";

      adminState.nextStepsSaving = true;
      adminState.nextStepsError = "";
      adminState.nextStepsMessage = "";
      renderAdmin_();

      runSectionPrimaryAction_({
        section: "nextSteps",
        permission: permission,
        baselineItems: submitChangeData.baselineItems,
        changeSet: submitChangeData.changeSet,
        payload: submitChangeData.payload,
        successMessage: successMessage,
      })
          .then(function(result) {
            adminState.nextStepsSaving = false;
            adminState.nextStepsMessage = result && result.message ?
              result.message :
              successMessage;

            if (adminState.nextStepsEditingId === docId) {
              adminState.nextStepsDraft = createEmptyNextStepDraft_();
              adminState.nextStepsEditingId = "";
            }

            loadNextSteps_();
          })
          .catch(function(error) {
            adminState.nextStepsSaving = false;
            adminState.nextStepsError = error && error.message ?
              error.message :
              (actionConfig.mode === "submit" ?
                "Unable to submit the Next Step removal for approval." :
                "Unable to publish the Next Step removal to preview.");
            renderAdmin_();
          });
    });
  }

  function buildNextStepsPublishPayload_() {
    return {
      items: sortNextStepsItems_(adminState.nextStepsItems).map(function(item) {
        return {
          id: item.id,
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          button_text: String(item.button_text || "").trim(),
          button_url: String(item.button_url || "").trim(),
          sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
          active: !!item.active,
        };
      }),
    };
  }

  function publishNextStepsToPreview_() {
    var permission = getPageAccessLevel_("nextSteps");
    var actionConfig = getPrimaryContentActionConfig_(permission);
    var submitChangeData = buildNextStepsSubmitChangeRequestData_();

    if (!canEditNextSteps_()) {
      adminState.nextStepsError =
        "Your current access level cannot change Next Steps.";
      renderAdmin_();
      return;
    }

    if (actionConfig.mode === "submit" &&
      !submitChangeData.changeSet.upsertItems.length &&
      !submitChangeData.changeSet.removeIds.length) {
      adminState.nextStepsError =
        "Make a Next Steps change before submitting it for approval.";
      renderAdmin_();
      return;
    }

    adminState.nextStepsPublishing = true;
    adminState.nextStepsError = "";
    adminState.nextStepsMessage = "";
    renderAdmin_();

    runSectionPrimaryAction_({
      section: "nextSteps",
      permission: permission,
      baselineItems: actionConfig.mode === "submit" ?
        submitChangeData.baselineItems :
        normalizeNextStepsComparableItems_(
            adminState.nextStepsBaselineItems,
        ),
      changeSet: actionConfig.mode === "submit" ?
        submitChangeData.changeSet :
        null,
      payload: actionConfig.mode === "submit" ?
        submitChangeData.payload :
        buildNextStepsPublishPayload_(),
      successMessage: actionConfig.mode === "submit" ?
        "Next Steps submitted for approval." :
        "Next Steps published.",
    })
        .then(function(result) {
          adminState.nextStepsPublishing = false;
          adminState.nextStepsMessage = result && result.message ?
            result.message :
            (actionConfig.mode === "submit" ?
              "Next Steps submitted for approval." :
              "Next Steps published.");
          loadNextSteps_();
        })
        .catch(function(error) {
          adminState.nextStepsPublishing = false;
          adminState.nextStepsError = error && error.message ?
            error.message :
            (actionConfig.mode === "submit" ?
              "Unable to submit the Next Steps for approval." :
              "Unable to publish the Next Steps to preview.");
          renderAdmin_();
        });
  }

  function createQuickLinkLocalId_(countHint) {
    return "quick-link-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function createResourceLocalId_(countHint) {
    return "resource-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function createCampaignLocalId_(countHint) {
    return "campaign-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function createServeNeedLocalId_(countHint) {
    return "serve-need-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function createNextStepLocalId_(countHint) {
    return "next-step-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function createRoomRuleLocalId_(countHint) {
    return "room-rule-local-" + String(Date.now()) + "-" + String(countHint || 0);
  }

  function markAdminPageDataStaleForNavigation_(pageId) {
    adminState.changeRequestsLoaded = false;

    if (pageId === "hub" && !hasPendingHubChanges_()) {
      adminState.hubLoaded = false;
    }

    if (pageId === "bulletin") {
      adminState.bulletinLoaded = false;
    }

    if (pageId === "quick-links" && !hasPendingQuickLinksChanges_()) {
      adminState.quickLinksLoaded = false;
    }

    if (pageId === "sunday" && !hasPendingSundayChanges_()) {
      adminState.sundayLoaded = false;
    }

    if (pageId === "resources" && !hasPendingResourcesChanges_()) {
      adminState.resourcesLoaded = false;
    }

    if (pageId === "campaigns" && !hasPendingCampaignsChanges_()) {
      adminState.campaignsLoaded = false;
    }

    if (pageId === "serve-needs" && !hasPendingServeNeedsChanges_()) {
      adminState.serveNeedsLoaded = false;
    }

    if (pageId === "next-steps" && !hasPendingNextStepsChanges_()) {
      adminState.nextStepsLoaded = false;
    }

    if ((pageId === "settings" || pageId === "integrations") &&
      !hasPendingSettingsChanges_() &&
      !hasPendingRoomRulesChanges_() &&
      !hasPendingAdminUsersChanges_()) {
      adminState.settingsLoaded = false;
      adminState.adminUsersLoaded = false;
    }

    if (pageId === "status-banner" && !hasPendingStatusBannerChanges_()) {
      adminState.statusBannerLoaded = false;
    }
  }

  function hasPendingHubChanges_() {
    return !areAdminValuesEqual_(
        buildHubSettingsPayload_(),
        normalizeHubSettingsData_(adminState.hubSettingsCurrent),
    ) || !areAdminValuesEqual_(
        buildHubSundayPayload_(),
        normalizeHubSundayData_(adminState.hubSundayCurrent),
    );
  }

  function hasPendingQuickLinksChanges_() {
    return Object.keys(adminState.quickLinksPendingChangesById || {}).length > 0;
  }

  function hasPendingSundayChanges_() {
    return !areAdminValuesEqual_(
        buildSundayPayload_(),
        normalizeSundayComparableData_(adminState.sundayCurrent),
    );
  }

  function hasPendingSettingsChanges_() {
    return !areAdminValuesEqual_(
        buildSettingsSundayPayload_(),
        normalizeSettingsSundayData_(adminState.settingsSundayCurrent),
    );
  }

  function hasPendingResourcesChanges_() {
    return Object.keys(adminState.resourcesPendingChangesById || {}).length > 0;
  }

  function hasPendingCampaignsChanges_() {
    return Object.keys(adminState.campaignsPendingChangesById || {}).length > 0;
  }

  function hasPendingServeNeedsChanges_() {
    return Object.keys(adminState.serveNeedsPendingChangesById || {}).length > 0;
  }

  function hasPendingNextStepsChanges_() {
    return Object.keys(adminState.nextStepsPendingChangesById || {}).length > 0;
  }

  function hasPendingRoomRulesChanges_() {
    return Object.keys(adminState.roomRulesPendingChangesById || {}).length > 0;
  }

  function hasPendingAdminUsersChanges_() {
    return !!adminState.adminUsersEditingUid ||
      !!adminState.adminUsersEditingInviteId ||
      hasAdminUserDraftContent_(adminState.adminUsersDraft);
  }

  function hasPendingStatusBannerChanges_() {
    return !areAdminValuesEqual_(
        buildStatusBannerPreviewData_(),
        normalizeStatusBannerComparableData_(adminState.statusBannerCurrent),
    );
  }

  function areAdminValuesEqual_(leftValue, rightValue) {
    return JSON.stringify(leftValue || null) === JSON.stringify(rightValue || null);
  }

  function cloneQuickLinksItems_(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return {
        id: String(item && item.id || "").trim(),
        title: String(item && item.title || "").trim(),
        url: String(item && item.url || "").trim(),
        sort: Number.isFinite(Number(item && item.sort)) ?
          Number(item.sort) :
          50,
        active: !!(item && item.active),
        sunday_only: !!(item && item.sunday_only),
      };
    });
  }

  function normalizeQuickLinksComparableItems_(items) {
    return sortQuickLinksItems_(cloneQuickLinksItems_(items));
  }

  function normalizeQuickLinkComparableItem_(item) {
    if (!item) {
      return null;
    }

    return {
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      url: String(item.url || "").trim(),
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : 50,
      active: !!item.active,
      sunday_only: !!item.sunday_only,
    };
  }

  function areQuickLinkComparableItemsEqual_(leftItem, rightItem) {
    return areAdminValuesEqual_(
        normalizeQuickLinkComparableItem_(leftItem),
        normalizeQuickLinkComparableItem_(rightItem),
    );
  }

  function getQuickLinkPendingChangeEntry_(docId) {
    if (!adminState.quickLinksPendingChangesById) {
      return null;
    }

    return adminState.quickLinksPendingChangesById[docId] || null;
  }

  function getQuickLinkBaselineItemById_(docId) {
    if (!docId) {
      return null;
    }

    return (adminState.quickLinksBaselineItems || []).find(function(item) {
      return item.id === docId;
    }) || null;
  }

  function setQuickLinkPendingChange_(docId, baselineItem, proposedItem, removed) {
    var nextChangesById = Object.assign({}, adminState.quickLinksPendingChangesById);
    var normalizedBaselineItem = normalizeQuickLinkComparableItem_(baselineItem);
    var normalizedProposedItem = removed ?
      null :
      normalizeQuickLinkComparableItem_(proposedItem);

    if (!normalizedBaselineItem && !normalizedProposedItem) {
      delete nextChangesById[docId];
      adminState.quickLinksPendingChangesById = nextChangesById;
      return;
    }

    if (!normalizedBaselineItem && removed) {
      delete nextChangesById[docId];
      adminState.quickLinksPendingChangesById = nextChangesById;
      return;
    }

    if (normalizedBaselineItem &&
      normalizedProposedItem &&
      areQuickLinkComparableItemsEqual_(
          normalizedBaselineItem,
          normalizedProposedItem,
      )) {
      delete nextChangesById[docId];
      adminState.quickLinksPendingChangesById = nextChangesById;
      return;
    }

    nextChangesById[docId] = {
      baselineItem: normalizedBaselineItem,
      proposedItem: normalizedProposedItem,
      removed: !!removed,
    };
    adminState.quickLinksPendingChangesById = nextChangesById;
  }

  function trackQuickLinkUpsertChange_(nextItem, originalItem) {
    var docId = nextItem && nextItem.id ? nextItem.id : "";
    var existingEntry = getQuickLinkPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getQuickLinkBaselineItemById_(docId));

    setQuickLinkPendingChange_(docId, baselineItem, nextItem, false);
  }

  function trackQuickLinkRemovalChange_(docId, originalItem) {
    var existingEntry = getQuickLinkPendingChangeEntry_(docId);
    var baselineItem = existingEntry &&
      Object.prototype.hasOwnProperty.call(existingEntry, "baselineItem") ?
      existingEntry.baselineItem :
      (originalItem || getQuickLinkBaselineItemById_(docId));

    setQuickLinkPendingChange_(docId, baselineItem, null, true);
  }

  function buildQuickLinksSubmitChangeRequestData_() {
    var baselineItems = [];
    var upsertItems = [];
    var removeIds = [];

    Object.keys(adminState.quickLinksPendingChangesById || {})
        .sort()
        .forEach(function(docId) {
          var entry = adminState.quickLinksPendingChangesById[docId] || {};

          if (entry.baselineItem) {
            baselineItems.push(entry.baselineItem);
          }

          if (entry.removed) {
            if (entry.baselineItem) {
              removeIds.push(docId);
            }
            return;
          }

          if (entry.proposedItem) {
            upsertItems.push(entry.proposedItem);
          }
        });

    return {
      baselineItems: normalizeQuickLinksComparableItems_(baselineItems),
      changeSet: {
        upsertItems: normalizeQuickLinksComparableItems_(upsertItems),
        removeIds: removeIds.sort(),
      },
      payload: {
        items: normalizeQuickLinksComparableItems_(upsertItems),
      },
    };
  }

  function normalizeStatusBannerComparableData_(data) {
    var source = data || {};

    return {
      title: String(source.title || "").trim(),
      message: String(source.message || "").trim(),
      button_text: String(source.button_text || "").trim(),
      button_url: String(source.button_url || "").trim(),
    };
  }

  function runSectionPrimaryAction_(config) {
    var permission = String(config && config.permission || "").trim().toLowerCase();
    var requestPayload = {
      section: config && config.section || "",
      operation: config && config.operation || "publish",
      payload: config && config.payload || {},
    };
    if (Array.isArray(config && config.baselineItems)) {
      requestPayload.baselineItems = config.baselineItems;
    }
    if (config && config.changeSet && typeof config.changeSet === "object") {
      requestPayload.changeSet = config.changeSet;
    }

    if (isDirectPublishPermission_(permission)) {
      return callPreviewPublishEndpoint_(requestPayload);
    }

    if (isSubmitForApprovalPermission_(permission)) {
      return callSubmitChangeRequestEndpoint_(requestPayload)
          .then(function(result) {
            adminState.changeRequestsLoaded = false;
            loadChangeRequestsSummaryIfNeeded_();
            return result;
          });
    }

    return Promise.reject(new Error("Your current access level cannot publish or submit this section."));
  }

  function callPreviewPublishEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before publishing preview content."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(PUBLISH_PREVIEW_CONTENT_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_)
        .then(function(result) {
          resetCurrentCentralDataCache_();
          return result;
        });
  }

  function callBulletinModeEndpoint_(method, payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before using Bulletin Mode."));
    }

    var normalizedMethod = method === "POST" ? "POST" : "GET";

    return adminState.user.getIdToken()
        .then(function(idToken) {
          var requestOptions = {
            method: normalizedMethod,
            headers: {
              Authorization: "Bearer " + idToken,
              Accept: "application/json",
            },
          };

          if (normalizedMethod === "POST") {
            requestOptions.headers["Content-Type"] = "application/json";
            requestOptions.body = JSON.stringify(payload || {});
          }

          return fetch(BULLETIN_MODE_ENDPOINT, requestOptions);
        })
        .then(parseAdminEndpointResponse_);
  }

  function runWayfinderPrototypeQuery_(questionOverride) {
    var question = String(
        typeof questionOverride === "string" && questionOverride.trim() ?
          questionOverride :
          adminState.wayfinderQuestion,
    ).trim();

    adminState.wayfinderQuestion = question;
    adminState.wayfinderError = "";

    if (!adminState.user) {
      adminState.wayfinderError =
        "Sign in with an approved Central admin account first.";
      renderAdmin_();
      return;
    }

    if (!question) {
      adminState.wayfinderError = "Enter a question for Wayfinder to test.";
      renderAdmin_();
      return;
    }

    if (question.length > 500) {
      adminState.wayfinderError =
        "Keep prototype questions to 500 characters or fewer.";
      renderAdmin_();
      return;
    }

    adminState.wayfinderQuerying = true;
    adminState.wayfinderResult = null;
    renderAdmin_();

    adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_PROTOTYPE_QUERY_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({question: question}),
          });
        })
        .then(parseAdminEndpointResponse_)
        .then(function(result) {
          adminState.wayfinderQuerying = false;
          adminState.wayfinderResult = result || null;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderQuerying = false;
          adminState.wayfinderResult = null;
          adminState.wayfinderError = error && error.message ?
            error.message :
            "The Wayfinder prototype is unavailable right now.";
          renderAdmin_();
        });
  }

  function callWayfinderWebsiteIndexEndpoint_(action) {
    if (!adminState.user) {
      return Promise.reject(new Error(
          "Sign in with an approved Central admin account first.",
      ));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_WEBSITE_INDEX_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({action: action}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function loadWayfinderFeaturedEventHealth_(forceReload) {
    if (!adminState.user || adminState.wayfinderFeaturedHealthLoading) return;
    if (adminState.wayfinderFeaturedHealthLoaded && !forceReload) return;
    adminState.wayfinderFeaturedHealthLoading = true;
    adminState.wayfinderFeaturedHealthError = "";
    renderAdmin_();

    adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_FEATURED_EVENT_HEALTH_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({action: "check"}),
          });
        })
        .then(parseAdminEndpointResponse_)
        .then(function(result) {
          adminState.wayfinderFeaturedHealthLoading = false;
          adminState.wayfinderFeaturedHealthLoaded = true;
          adminState.wayfinderFeaturedHealthReport = result || null;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderFeaturedHealthLoading = false;
          adminState.wayfinderFeaturedHealthLoaded = true;
          adminState.wayfinderFeaturedHealthError = error && error.message ?
            error.message : "Featured Event health is unavailable.";
          renderAdmin_();
        });
  }

  function loadWayfinderWebsiteIndexStatus_(forceReload) {
    if (!adminState.user || adminState.wayfinderWebsiteIndexLoading ||
      adminState.wayfinderWebsiteIndexWorking) return;
    if (adminState.wayfinderWebsiteIndexLoaded && !forceReload) return;

    adminState.wayfinderWebsiteIndexLoading = true;
    adminState.wayfinderWebsiteIndexError = "";
    renderAdmin_();
    callWayfinderWebsiteIndexEndpoint_("status")
        .then(function(result) {
          adminState.wayfinderWebsiteIndexLoading = false;
          adminState.wayfinderWebsiteIndexLoaded = true;
          adminState.wayfinderWebsiteIndexStatus = result || null;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderWebsiteIndexLoading = false;
          adminState.wayfinderWebsiteIndexLoaded = true;
          adminState.wayfinderWebsiteIndexError = error && error.message ?
            error.message : "The website index status is unavailable.";
          renderAdmin_();
        });
  }

  function refreshWayfinderWebsiteIndex_() {
    if (!adminState.user || adminState.wayfinderWebsiteIndexWorking) return;
    adminState.wayfinderWebsiteIndexWorking = true;
    adminState.wayfinderWebsiteIndexError = "";
    adminState.wayfinderWebsiteIndexMessage = "";
    renderAdmin_();

    callWayfinderWebsiteIndexEndpoint_("refresh")
        .then(function(result) {
          adminState.wayfinderWebsiteIndexWorking = false;
          adminState.wayfinderWebsiteIndexLoaded = true;
          adminState.wayfinderWebsiteIndexStatus = result || null;
          adminState.wayfinderWebsiteIndexMessage = [
            "Website refresh complete:",
            String(Number(result && result.pageCount) || 0),
            "pages and",
            String(Number(result && result.chunkCount) || 0),
            "search chunks are ready.",
          ].join(" ");
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderWebsiteIndexWorking = false;
          adminState.wayfinderWebsiteIndexError = error && error.message ?
            error.message : "The website index refresh is unavailable.";
          renderAdmin_();
        });
  }

  function callWayfinderFeedbackEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error(
          "Sign in with an approved Central admin account first.",
      ));
    }
    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_FEEDBACK_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function callWayfinderEvaluationsEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error(
          "Sign in with an approved Central admin account first.",
      ));
    }
    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_EVALUATIONS_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function loadWayfinderEvaluations_(forceReload) {
    if (!adminState.user || adminState.wayfinderEvaluationsLoading ||
      adminState.wayfinderEvaluationsRunning) return;
    if (adminState.wayfinderEvaluationsLoaded && !forceReload) return;
    adminState.wayfinderEvaluationsLoading = true;
    adminState.wayfinderEvaluationsError = "";
    renderAdmin_();
    callWayfinderEvaluationsEndpoint_({action: "list"})
        .then(function(result) {
          adminState.wayfinderEvaluationsLoading = false;
          adminState.wayfinderEvaluationsLoaded = true;
          adminState.wayfinderEvaluationsLibrarySize =
            Number(result.librarySize) || 0;
          adminState.wayfinderEvaluationRuns =
            Array.isArray(result.runs) ? result.runs : [];
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderEvaluationsLoading = false;
          adminState.wayfinderEvaluationsLoaded = true;
          adminState.wayfinderEvaluationsError = error && error.message ?
            error.message : "Evaluation history is unavailable.";
          renderAdmin_();
        });
  }

  function runWayfinderEvaluations_(runId) {
    if (!adminState.user || adminState.wayfinderEvaluationsRunning) return;
    adminState.wayfinderEvaluationsRunning = true;
    adminState.wayfinderEvaluationsError = "";
    renderAdmin_();
    callWayfinderEvaluationsEndpoint_({
      action: runId ? "rerun" : "run",
      runId: runId || "",
    }).then(function(result) {
      adminState.wayfinderEvaluationsRunning = false;
      adminState.wayfinderEvaluationsLoaded = true;
      adminState.wayfinderEvaluationRuns =
        Array.isArray(result.runs) ? result.runs :
          result.run ? [result.run] : [];
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderEvaluationsRunning = false;
      adminState.wayfinderEvaluationsError = error && error.message ?
        error.message : "The five-question evaluation could not finish.";
      renderAdmin_();
    });
  }

  function loadWayfinderFeedback_(forceReload) {
    if (!adminState.user || adminState.wayfinderFeedbackLoading ||
      adminState.wayfinderFeedbackWorking) return;
    if (adminState.wayfinderFeedbackLoaded && !forceReload) return;
    adminState.wayfinderFeedbackLoading = true;
    adminState.wayfinderFeedbackError = "";
    renderAdmin_();
    callWayfinderFeedbackEndpoint_({action: "list"})
        .then(function(result) {
          adminState.wayfinderFeedbackLoading = false;
          adminState.wayfinderFeedbackLoaded = true;
          adminState.wayfinderFeedbackItems =
            Array.isArray(result.feedback) ? result.feedback : [];
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderFeedbackLoading = false;
          adminState.wayfinderFeedbackLoaded = true;
          adminState.wayfinderFeedbackError = error && error.message ?
            error.message : "Wayfinder feedback is unavailable.";
          renderAdmin_();
        });
  }

  function updateWayfinderFeedbackStatus_(feedbackId, action) {
    if (!feedbackId || adminState.wayfinderFeedbackWorking) return;
    adminState.wayfinderFeedbackWorking = true;
    adminState.wayfinderFeedbackError = "";
    renderAdmin_();
    callWayfinderFeedbackEndpoint_({
      action: action,
      feedbackId: feedbackId,
    }).then(function(result) {
      adminState.wayfinderFeedbackWorking = false;
      adminState.wayfinderFeedbackLoaded = true;
      adminState.wayfinderFeedbackItems =
        Array.isArray(result.feedback) ? result.feedback : [];
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderFeedbackWorking = false;
      adminState.wayfinderFeedbackError = error && error.message ?
        error.message : "That feedback could not be updated.";
      renderAdmin_();
    });
  }

  function generateWayfinderAnswer_() {
    var question = String(adminState.wayfinderQuestion || "").trim();
    var normalizedCommand = question.toLowerCase();

    adminState.wayfinderAnswerError = "";

    if (normalizedCommand === "alohomora") {
      runWayfinderNoticeCommand_("enter");
      return;
    }

    if (normalizedCommand === "colloportus") {
      runWayfinderNoticeCommand_("exit");
      return;
    }

    if (adminState.wayfinderNoticeModeActive) {
      if (adminState.wayfinderAdminUpdateType === "permanent") {
        runWayfinderKnowledgeCommand_("draft", {instruction: question});
      } else {
        runWayfinderNoticeCommand_("draft", {
          instruction: question,
          noticeId: adminState.wayfinderEditingNoticeId || "",
        });
      }
      return;
    }

    if (!adminState.user) {
      adminState.wayfinderAnswerError =
        "Sign in with an approved Central admin account first.";
      renderAdmin_();
      return;
    }

    if (!question) {
      adminState.wayfinderAnswerError =
        "Enter a question for Wayfinder to answer.";
      renderAdmin_();
      return;
    }

    if (question.length > 500) {
      adminState.wayfinderAnswerError =
        "Keep prototype questions to 500 characters or fewer.";
      renderAdmin_();
      return;
    }

    adminState.wayfinderGenerating = true;
    adminState.wayfinderAnswerResult = null;
    renderAdmin_();

    adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_GENERATE_ANSWER_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({question: question}),
          });
        })
        .then(parseAdminEndpointResponse_)
        .then(function(result) {
          adminState.wayfinderGenerating = false;
          adminState.wayfinderAnswerResult = result || null;
          if (result && Array.isArray(result.results) &&
            result.results.length) {
            adminState.wayfinderResult = result;
          }
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderGenerating = false;
          adminState.wayfinderAnswerResult = null;
          adminState.wayfinderAnswerError = error && error.message ?
            error.message :
            "Gemini is unavailable for the Wayfinder lab right now.";
          renderAdmin_();
        });
  }

  function callWayfinderNoticeEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error(
          "Sign in with an approved Central admin account first.",
      ));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_NOTICE_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function runWayfinderNoticeCommand_(action, extraPayload) {
    var payload = Object.assign({action: action}, extraPayload || {});
    adminState.wayfinderNoticeWorking = true;
    adminState.wayfinderNoticeError = "";
    adminState.wayfinderAnswerError = "";
    adminState.wayfinderAnswerResult = null;
    renderAdmin_();

    callWayfinderNoticeEndpoint_(payload)
        .then(function(result) {
          adminState.wayfinderNoticeWorking = false;
          adminState.wayfinderNoticeModeActive =
            result && result.modeActive === true;
          adminState.wayfinderNoticeModeExpiresAt =
            String(result && result.expiresAt || "");
          adminState.wayfinderNoticeMessage =
            String(result && result.message || "");
          adminState.wayfinderNoticeDraft =
            result && result.draft ? result.draft : null;
          adminState.wayfinderQuestion = "";
          if (action === "exit") {
            adminState.wayfinderNoticeDraft = null;
            adminState.wayfinderKnowledgeDraft = null;
            adminState.wayfinderNotices = [];
            adminState.wayfinderKnowledgeOverrides = [];
            adminState.wayfinderEditingNoticeId = "";
            adminState.wayfinderPendingEndNoticeId = "";
            adminState.wayfinderPendingDeactivateEntryId = "";
          } else if (action === "enter") {
            loadWayfinderManagers_();
          }
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.wayfinderNoticeWorking = false;
          adminState.wayfinderNoticeError = error && error.message ?
            error.message : "The temporary notice update is unavailable.";
          if (/expired|sign in/i.test(adminState.wayfinderNoticeError)) {
            adminState.wayfinderNoticeModeActive = false;
          }
          renderAdmin_();
        });
  }

  function publishWayfinderNotice_() {
    var draft = adminState.wayfinderNoticeDraft;
    if (!draft || !draft.id) return;
    adminState.wayfinderNoticeWorking = true;
    adminState.wayfinderNoticeError = "";
    renderAdmin_();

    callWayfinderNoticeEndpoint_({
      action: "publish",
      draftId: draft.id,
    }).then(function(result) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeDraft = null;
      adminState.wayfinderNoticeMessage =
        String(result && result.message || "The notice is published.");
      adminState.wayfinderEditingNoticeId = "";
      loadWayfinderManagers_();
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeError = error && error.message ?
        error.message : "The notice could not be published.";
      renderAdmin_();
    });
  }

  function cancelWayfinderNotice_() {
    var draft = adminState.wayfinderNoticeDraft;
    if (!draft || !draft.id) return;
    adminState.wayfinderNoticeWorking = true;
    adminState.wayfinderNoticeError = "";
    renderAdmin_();

    callWayfinderNoticeEndpoint_({
      action: "cancel",
      draftId: draft.id,
    }).then(function(result) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeDraft = null;
      adminState.wayfinderNoticeMessage =
        String(result && result.message || "The draft was cancelled.");
      adminState.wayfinderEditingNoticeId = "";
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeError = error && error.message ?
        error.message : "The notice draft could not be cancelled.";
      renderAdmin_();
    });
  }

  function callWayfinderKnowledgeEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error(
          "Sign in with an approved Central admin account first.",
      ));
    }
    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(WAYFINDER_KNOWLEDGE_CHANGE_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function runWayfinderKnowledgeCommand_(action, extraPayload) {
    adminState.wayfinderKnowledgeWorking = true;
    adminState.wayfinderKnowledgeError = "";
    adminState.wayfinderKnowledgeMessage = "";
    renderAdmin_();
    callWayfinderKnowledgeEndpoint_(
        Object.assign({action: action}, extraPayload || {}),
    ).then(function(result) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeDraft =
        result && result.draft ? result.draft : null;
      adminState.wayfinderKnowledgeMessage =
        String(result && result.message || "");
      adminState.wayfinderQuestion = "";
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeError = error && error.message ?
        error.message : "The permanent change is unavailable.";
      if (/expired|sign in/i.test(adminState.wayfinderKnowledgeError)) {
        adminState.wayfinderNoticeModeActive = false;
      }
      renderAdmin_();
    });
  }

  function setWayfinderUpdateType_(value) {
    var nextType = value === "permanent" ? "permanent" : "temporary";
    adminState.wayfinderAdminUpdateType = nextType;
    adminState.wayfinderQuestion = "";
    adminState.wayfinderEditingNoticeId = "";
    adminState.wayfinderPendingEndNoticeId = "";
    adminState.wayfinderPendingDeactivateEntryId = "";
    adminState.wayfinderNoticeDraft = null;
    adminState.wayfinderKnowledgeDraft = null;
    adminState.wayfinderNoticeError = "";
    adminState.wayfinderKnowledgeError = "";
    renderAdmin_();
  }

  function loadWayfinderManagers_() {
    if (!adminState.wayfinderNoticeModeActive ||
      adminState.wayfinderManagerLoading) return;
    adminState.wayfinderManagerLoading = true;
    renderAdmin_();
    Promise.all([
      callWayfinderNoticeEndpoint_({action: "list"}),
      callWayfinderKnowledgeEndpoint_({action: "list"}),
    ]).then(function(results) {
      adminState.wayfinderManagerLoading = false;
      adminState.wayfinderNotices = results[0] &&
        Array.isArray(results[0].notices) ? results[0].notices : [];
      adminState.wayfinderKnowledgeOverrides = results[1] &&
        Array.isArray(results[1].overrides) ? results[1].overrides : [];
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderManagerLoading = false;
      adminState.wayfinderNoticeError = error && error.message ?
        error.message : "Stored Wayfinder updates could not be loaded.";
      renderAdmin_();
    });
  }

  function beginWayfinderNoticeRevision_(noticeId) {
    var notice = adminState.wayfinderNotices.find(function(item) {
      return item.id === noticeId;
    });
    if (!notice) return;
    adminState.wayfinderAdminUpdateType = "temporary";
    adminState.wayfinderEditingNoticeId = noticeId;
    adminState.wayfinderPendingEndNoticeId = "";
    adminState.wayfinderQuestion = "";
    adminState.wayfinderNoticeMessage =
      "Describe what should change about “" + notice.title + ".”";
    renderAdmin_();
  }

  function endWayfinderNotice_(noticeId) {
    if (!noticeId) return;
    if (adminState.wayfinderPendingEndNoticeId !== noticeId) {
      adminState.wayfinderPendingEndNoticeId = noticeId;
      adminState.wayfinderNoticeMessage =
        "Select Confirm end now to immediately stop this notice.";
      renderAdmin_();
      return;
    }
    adminState.wayfinderNoticeWorking = true;
    adminState.wayfinderNoticeError = "";
    renderAdmin_();
    callWayfinderNoticeEndpoint_({
      action: "end",
      noticeId: noticeId,
    }).then(function(result) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeMessage =
        String(result && result.message || "The notice ended.");
      adminState.wayfinderPendingEndNoticeId = "";
      loadWayfinderManagers_();
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderNoticeWorking = false;
      adminState.wayfinderNoticeError = error && error.message ?
        error.message : "The notice could not be ended.";
      renderAdmin_();
    });
  }

  function publishWayfinderKnowledgeChange_() {
    var draft = adminState.wayfinderKnowledgeDraft;
    if (!draft || !draft.id) return;
    adminState.wayfinderKnowledgeWorking = true;
    adminState.wayfinderKnowledgeError = "";
    renderAdmin_();
    callWayfinderKnowledgeEndpoint_({
      action: "publish",
      draftId: draft.id,
    }).then(function(result) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeDraft = null;
      adminState.wayfinderKnowledgeMessage =
        String(result && result.message || "The permanent change is active.");
      loadWayfinderManagers_();
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeError = error && error.message ?
        error.message : "The permanent change could not be approved.";
      renderAdmin_();
    });
  }

  function cancelWayfinderKnowledgeChange_() {
    var draft = adminState.wayfinderKnowledgeDraft;
    if (!draft || !draft.id) return;
    adminState.wayfinderKnowledgeWorking = true;
    renderAdmin_();
    callWayfinderKnowledgeEndpoint_({
      action: "cancel",
      draftId: draft.id,
    }).then(function(result) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeDraft = null;
      adminState.wayfinderKnowledgeMessage =
        String(result && result.message || "The draft was cancelled.");
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeError = error && error.message ?
        error.message : "The knowledge draft could not be cancelled.";
      renderAdmin_();
    });
  }

  function deactivateWayfinderKnowledgeOverride_(entryId) {
    if (!entryId) return;
    if (adminState.wayfinderPendingDeactivateEntryId !== entryId) {
      adminState.wayfinderPendingDeactivateEntryId = entryId;
      adminState.wayfinderKnowledgeMessage =
        "Select Confirm revert to restore the imported knowledge entry.";
      renderAdmin_();
      return;
    }
    adminState.wayfinderKnowledgeWorking = true;
    renderAdmin_();
    callWayfinderKnowledgeEndpoint_({
      action: "deactivate",
      entryId: entryId,
    }).then(function(result) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeMessage =
        String(result && result.message || "The override is inactive.");
      adminState.wayfinderPendingDeactivateEntryId = "";
      loadWayfinderManagers_();
      renderAdmin_();
    }).catch(function(error) {
      adminState.wayfinderKnowledgeWorking = false;
      adminState.wayfinderKnowledgeError = error && error.message ?
        error.message : "The override could not be deactivated.";
      renderAdmin_();
    });
  }

  function callSubmitChangeRequestEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before submitting a change request."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(SUBMIT_CHANGE_REQUEST_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function callReviewChangeRequestEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before reviewing change requests."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(REVIEW_CHANGE_REQUEST_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_)
        .then(function(result) {
          resetCurrentCentralDataCache_();
          return result;
        });
  }

  function loadChangeRequestsSummaryIfNeeded_() {
    if (!hasChangeRequestsInboxAccess_()) {
      return;
    }

    if (adminState.changeRequestsLoading || adminState.changeRequestsLoaded) {
      return;
    }

    loadChangeRequestsIfNeeded_(false);
  }

  function loadChangeRequestsIfNeeded_(forceReload) {
    if (!adminFirestore || !hasChangeRequestsInboxAccess_()) {
      return;
    }

    if (!forceReload &&
      (adminState.changeRequestsLoading || adminState.changeRequestsLoaded)) {
      return;
    }

    adminState.changeRequestsLoading = true;
    adminState.changeRequestsError = "";
    renderAdmin_();

    adminFirestore.collection(CENTRAL_ADMIN_CHANGE_REQUESTS_COLLECTION_PATH)
        .where("status", "==", "pending")
        .get()
        .then(function(snapshot) {
          var pendingCount = snapshot.size;
          var items = snapshot.docs.map(function(docSnapshot) {
            return normalizeChangeRequestDoc_(docSnapshot);
          }).sort(function(a, b) {
            return getAdminTimestampValue_(b.createdAt) -
              getAdminTimestampValue_(a.createdAt);
          }).slice(0, 50);

          adminState.changeRequestsLoading = false;
          adminState.changeRequestsLoaded = true;
          adminState.changeRequestsItems = items;
          if (!items.some(function(item) {
            return item.id === adminState.changeRequestsExpandedId;
          })) {
            adminState.changeRequestsExpandedId = "";
          }
          adminState.changeRequestsPendingCount = pendingCount;
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.changeRequestsLoading = false;
          adminState.changeRequestsLoaded = true;
          adminState.changeRequestsItems = [];
          adminState.changeRequestsExpandedId = "";
          adminState.changeRequestsPendingCount = 0;
          adminState.changeRequestsError = error && error.message ?
            error.message :
            "Unable to load the change requests.";
          renderAdmin_();
        });
  }

  function toggleChangeRequestExpanded_(requestId) {
    var nextId = String(requestId || "").trim();

    if (!nextId) {
      return;
    }

    adminState.changeRequestsExpandedId =
      adminState.changeRequestsExpandedId === nextId ?
        "" :
        nextId;
    renderAdmin_();
  }

  function closeExpandedChangeRequest_() {
    if (!adminState.changeRequestsExpandedId) {
      return;
    }

    adminState.changeRequestsExpandedId = "";
    renderAdmin_();
  }

  function reviewChangeRequest_(requestId, decision) {
    if (!requestId || !canReviewChangeRequests_()) {
      return;
    }

    var requestItem = adminState.changeRequestsItems.find(function(item) {
      return item.id === requestId;
    });
    var summary = requestItem && requestItem.summary ?
      requestItem.summary :
      "this change request";
    openDeleteConfirm_({
      title: decision === "approve" ?
        "Approve Change Request" :
        "Reject Change Request",
      message: decision === "approve" ?
        "Approve " + summary + " and publish it to preview?" :
        "Reject " + summary + "?",
      confirmLabel: decision === "approve" ?
        "Approve Request" :
        "Reject Request",
      showSkip: false,
      onConfirm: function() {
        runChangeRequestReview_(requestId, decision);
      },
    });
  }

  function runChangeRequestReview_(requestId, decision) {
    adminState.changeRequestsActionPending = true;
    adminState.changeRequestsError = "";
    adminState.changeRequestsMessage = "";
    renderAdmin_();

    callReviewChangeRequestEndpoint_({
      requestId: requestId,
      decision: decision,
    })
        .then(function(result) {
          adminState.changeRequestsActionPending = false;
          adminState.changeRequestsLoaded = false;
          adminState.changeRequestsExpandedId = "";
          adminState.changeRequestsMessage = result && result.message ?
            result.message :
            (decision === "approve" ?
              "Change request approved." :
              "Change request rejected.");
          loadChangeRequestsIfNeeded_(true);
        })
        .catch(function(error) {
          adminState.changeRequestsActionPending = false;
          adminState.changeRequestsError = error && error.message ?
            error.message :
            "Unable to review the change request.";
          renderAdmin_();
        });
  }

  function normalizeChangeRequestDoc_(docSnapshot) {
    var data = docSnapshot && typeof docSnapshot.data === "function" ?
      docSnapshot.data() || {} :
      {};
    var detailFields = {};
    var ignoredKeys = {
      target: true,
      section: true,
      sectionLabel: true,
      operation: true,
      status: true,
      summary: true,
      payload: true,
      submittedByUid: true,
      submittedByEmail: true,
      submittedByName: true,
      createdAt: true,
      updatedAt: true,
    };

    Object.keys(data).forEach(function(key) {
      if (ignoredKeys[key]) {
        return;
      }

      detailFields[key] = data[key];
    });

    return {
      id: docSnapshot.id,
      target: String(data.target || "preview").trim(),
      section: String(data.section || "").trim(),
      sectionLabel: String(data.sectionLabel || "").trim(),
      operation: String(data.operation || "publish").trim(),
      status: String(data.status || "pending").trim(),
      summary: String(data.summary || "").trim(),
      payload: data.payload || null,
      detailFields: detailFields,
      submittedByUid: String(data.submittedByUid || "").trim(),
      submittedByEmail: String(data.submittedByEmail || "").trim(),
      submittedByName: String(data.submittedByName || "").trim(),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    };
  }

  function getAdminTimestampValue_(value) {
    if (value && typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return 0;
  }

  function parseAdminEndpointResponse_(response) {
    return response.text().then(function(text) {
      var payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch (error) {
      }

      if (!response.ok) {
        throw new Error(
            payload && payload.error ?
              payload.error :
              "The admin request failed.",
        );
      }

      return payload || {};
    });
  }

  function createAdminUserDraftPageAccess_(defaultPermission) {
    var permission = normalizeAdminPermissionValue_(defaultPermission);
    var nextPageAccess = {};

    getManagedAdminPageConfigs_().forEach(function(pageConfig) {
      nextPageAccess[pageConfig.key] = permission;
    });

    return nextPageAccess;
  }

  function getManagedAdminPageConfigs_() {
    return [
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
  }

  function getAdminUserPageAccessLevel_(pageAccess, pageAccessKey) {
    var source = pageAccess || {};

    if (Object.prototype.hasOwnProperty.call(source, pageAccessKey)) {
      return normalizeAdminPermissionValue_(source[pageAccessKey]);
    }

    if (pageAccessKey === "hub" ||
      pageAccessKey === "bulletin" ||
      pageAccessKey === "integrations" ||
      pageAccessKey === "resources" ||
      pageAccessKey === "nextSteps" ||
      pageAccessKey === "campaigns" ||
      pageAccessKey === "serveNeeds" ||
      pageAccessKey === "thisSunday" ||
      pageAccessKey === "roomRules" ||
      pageAccessKey === "users") {
      return normalizeAdminPermissionValue_(source.settings);
    }

    return "none";
  }

  function normalizeAdminUserPageAccess_(pageAccess) {
    var nextPageAccess = createAdminUserDraftPageAccess_("none");
    var source = pageAccess && typeof pageAccess === "object" ?
      pageAccess :
      {};

    Object.keys(source).forEach(function(key) {
      nextPageAccess[key] = normalizeAdminPermissionValue_(source[key]);
    });

    if (!Object.prototype.hasOwnProperty.call(source, "integrations")) {
      nextPageAccess.integrations = normalizeAdminPermissionValue_(
          source.settings,
      );
    }

    if (!Object.prototype.hasOwnProperty.call(source, "bulletin")) {
      nextPageAccess.bulletin = normalizeAdminPermissionValue_(
          source.settings,
      );
    }

    return nextPageAccess;
  }

  function normalizeAdminUserItem_(item) {
    var source = item || {};

    return {
      recordType: String(source.recordType || "user").trim() || "user",
      inviteId: String(source.inviteId || "").trim(),
      uid: String(source.uid || "").trim(),
      email: String(source.email || "").trim().toLowerCase(),
      displayName: String(source.displayName || "").trim(),
      photoUrl: String(source.photoUrl || "").trim(),
      active: source.active === true,
      roleIds: Array.isArray(source.roleIds) ? source.roleIds.slice() : [],
      pageAccess: normalizeAdminUserPageAccess_(source.pageAccess),
      inviteStatus: String(source.inviteStatus || "").trim().toLowerCase(),
      inviteExpiresAt: String(source.inviteExpiresAt || "").trim(),
      inviteSentAt: String(source.inviteSentAt || "").trim(),
    };
  }

  function sortAdminUsersItems_(items) {
    return (Array.isArray(items) ? items.slice() : [])
        .sort(function(leftItem, rightItem) {
          var leftLabel = String(
              leftItem && (leftItem.displayName || leftItem.email || leftItem.uid) || "",
          ).toLowerCase();
          var rightLabel = String(
              rightItem && (rightItem.displayName || rightItem.email || rightItem.uid) || "",
          ).toLowerCase();

          return leftLabel.localeCompare(rightLabel);
        });
  }

  function getAdminUserPermissionValue_(userItem, pageAccessKey) {
    return getAdminUserPageAccessLevel_(
        userItem && userItem.pageAccess,
        pageAccessKey,
    );
  }

  function getAdminUserDraftPermissionValue_(pageAccessKey) {
    return getAdminUserPageAccessLevel_(
        adminState.adminUsersDraft && adminState.adminUsersDraft.pageAccess,
        pageAccessKey,
    );
  }

  function getAdminUserSaveButtonLabel_() {
    if (adminState.adminUsersEditingInviteId) {
      return "Update & Resend Invite";
    }

    if (adminState.adminUsersEditingUid) {
      return "Save Admin User";
    }

    return String(
        adminState.adminUsersDraft &&
        adminState.adminUsersDraft.uid ||
        "",
    ).trim() ?
      "Add Admin User" :
      "Send Invite";
  }

  function getAdminUserSaveBusyLabel_() {
    if (adminState.adminUsersEditingInviteId) {
      return "Resending...";
    }

    return adminState.adminUsersEditingUid ?
      "Saving..." :
      "Sending...";
  }

  function loadAdminUsers_(nextMessage) {
    if (!canManageAdminUsers_()) {
      return;
    }

    adminState.adminUsersLoading = true;
    adminState.adminUsersLoaded = false;
    adminState.adminUsersError = "";
    renderAdmin_();

    callListAdminUsersEndpoint_()
        .then(function(result) {
          var items = sortAdminUsersItems_(
              (Array.isArray(result && result.items) ? result.items : [])
                  .map(normalizeAdminUserItem_),
          );

          adminState.adminUsersLoading = false;
          adminState.adminUsersLoaded = true;
          adminState.adminUsersItems = items;
          if (nextMessage) {
            adminState.adminUsersMessage = String(nextMessage).trim();
          }
          renderAdmin_();
        })
        .catch(function(error) {
          adminState.adminUsersLoading = false;
          adminState.adminUsersLoaded = true;
          adminState.adminUsersItems = [];
          adminState.adminUsersError = error && error.message ?
            error.message :
            "Unable to load the admin users.";
          renderAdmin_();
        });
  }

  function startEditingAdminUser_(docId, recordType) {
    var normalizedRecordType = String(recordType || "user").trim() || "user";
    var nextItem = adminState.adminUsersItems.find(function(item) {
      if (normalizedRecordType === "invite") {
        return item.recordType === "invite" && item.inviteId === docId;
      }

      return item.recordType !== "invite" && item.uid === docId;
    });

    if (!nextItem) {
      return;
    }

    adminState.adminUsersEditingUid =
      normalizedRecordType === "invite" ? "" : nextItem.uid;
    adminState.adminUsersEditingInviteId =
      normalizedRecordType === "invite" ? nextItem.inviteId : "";
    expandAdminSection_("settings-admin-users");
    adminState.adminUsersDraft = {
      inviteId: nextItem.inviteId || "",
      uid: nextItem.uid || "",
      email: nextItem.email || "",
      displayName: nextItem.displayName || "",
      active: !!nextItem.active,
      pageAccess: normalizeAdminUserPageAccess_(nextItem.pageAccess),
    };
    adminState.adminUsersError = "";
    adminState.adminUsersMessage =
      "Editing " + (nextItem.displayName || nextItem.email || "admin user") + ".";
    renderAdmin_();
  }

  function buildAdminUserPayload_() {
    var draft = adminState.adminUsersDraft || createEmptyAdminUserDraft_();
    return {
      inviteId: String(
          adminState.adminUsersEditingInviteId ||
          draft.inviteId ||
          "",
      ).trim(),
      uid: String(draft.uid || "").trim(),
      email: String(draft.email || "").trim().toLowerCase(),
      displayName: String(draft.displayName || "").trim(),
      active: !!draft.active,
      pageAccess: normalizeAdminUserPageAccess_(draft.pageAccess),
    };
  }

  function hasAdminUserDraftContent_(draft) {
    var payload = buildComparableAdminUserDraft_(draft);
    return !areAdminValuesEqual_(
        payload,
        buildComparableAdminUserDraft_(createEmptyAdminUserDraft_()),
    );
  }

  function buildComparableAdminUserDraft_(draft) {
    var payload = draft || {};
    var pageAccess = normalizeAdminUserPageAccess_(payload.pageAccess);

    return {
      inviteId: String(payload.inviteId || "").trim(),
      uid: String(payload.uid || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      displayName: String(payload.displayName || "").trim(),
      active: !!payload.active,
      pageAccess: pageAccess,
    };
  }

  function hasAnyAdminUserPageAccess_(pageAccess) {
    var normalizedPageAccess = normalizeAdminUserPageAccess_(pageAccess);

    return getManagedAdminPageConfigs_().some(function(pageConfig) {
      return getAdminUserPageAccessLevel_(
          normalizedPageAccess,
          pageConfig.key,
      ) !== "none";
    });
  }

  function saveAdminUser_() {
    if (!canManageAdminUsers_()) {
      adminState.adminUsersError =
        "Your current access level cannot manage admin users.";
      renderAdmin_();
      return;
    }

    var payload = buildAdminUserPayload_();

    if (!payload.uid && !payload.email) {
      adminState.adminUsersError =
        "Enter an email address or a UID before continuing.";
      renderAdmin_();
      return;
    }

    if (payload.active && !hasAnyAdminUserPageAccess_(payload.pageAccess)) {
      adminState.adminUsersError = [
        "Choose at least one permission before sending an active admin invite.",
        "An active account with every permission set to No Access cannot use",
        "the admin dashboard.",
      ].join(" ");
      renderAdmin_();
      return;
    }

    if (
      adminState.user &&
      payload.uid === adminState.user.uid &&
      getAdminUserPageAccessLevel_(payload.pageAccess, "users") !== "admin"
    ) {
      adminState.adminUsersError =
        "Keep your own Users permission at Admin so you do not lock yourself out of this screen.";
      renderAdmin_();
      return;
    }

    adminState.adminUsersSaving = true;
    adminState.adminUsersError = "";
    adminState.adminUsersMessage = "";
    renderAdmin_();

    callUpsertAdminUserEndpoint_(payload)
        .then(function(result) {
          adminState.adminUsersSaving = false;
          adminState.adminUsersMessage = result && result.message ?
            result.message :
            "Admin user saved.";
          resetAdminUsersDraft_();

          if (adminState.user &&
            result &&
            result.recordType !== "invite" &&
            result.uid === adminState.user.uid) {
            loadAdminUserDoc_();
          }

          loadAdminUsers_(adminState.adminUsersMessage);
        })
        .catch(function(error) {
          adminState.adminUsersSaving = false;
          adminState.adminUsersError = error && error.message ?
            error.message :
            "Unable to save the admin user.";
          renderAdmin_();
        });
  }

  function deleteAdminUser_(docId, recordType) {
    var normalizedRecordType = String(recordType || "user").trim() || "user";
    var targetId = String(docId || "").trim();

    if (!canManageAdminUsers_() || !targetId) {
      return;
    }

    var targetItem = adminState.adminUsersItems.find(function(item) {
      if (normalizedRecordType === "invite") {
        return item.recordType === "invite" && item.inviteId === targetId;
      }

      return item.recordType !== "invite" && item.uid === targetId;
    }) || null;
    var label = targetItem &&
      (targetItem.displayName || targetItem.email || targetItem.uid) ?
      (targetItem.displayName || targetItem.email || targetItem.uid) :
      (normalizedRecordType === "invite" ? "this admin invite" : "this admin user");

    openDeleteConfirm_({
      title: normalizedRecordType === "invite" ?
        "Delete Admin Invite" :
        "Delete Admin User",
      message: normalizedRecordType === "invite" ?
        "Delete the pending admin invite for " + label + "?" :
        "Delete the admin dashboard access record for " + label + "?",
      confirmLabel: normalizedRecordType === "invite" ?
        "Delete Invite" :
        "Delete User",
      onConfirm: function() {
          adminState.adminUsersSaving = true;
          adminState.adminUsersError = "";
          adminState.adminUsersMessage = "";
          renderAdmin_();

          callDeleteAdminUserEndpoint_({
            uid: normalizedRecordType === "invite" ? "" : targetId,
            inviteId: normalizedRecordType === "invite" ? targetId : "",
            email: targetItem && targetItem.email ? targetItem.email : "",
            recordType: normalizedRecordType,
          })
              .then(function(result) {
                adminState.adminUsersSaving = false;
                adminState.adminUsersMessage = result && result.message ?
                  result.message :
                  (normalizedRecordType === "invite" ?
                    "Admin invite deleted." :
                    "Admin user deleted.");

                if (
                  (normalizedRecordType === "invite" &&
                    adminState.adminUsersEditingInviteId === targetId) ||
                  (normalizedRecordType !== "invite" &&
                    adminState.adminUsersEditingUid === targetId)
                ) {
                  resetAdminUsersDraft_();
                }

                loadAdminUsers_(adminState.adminUsersMessage);
              })
              .catch(function(error) {
                adminState.adminUsersSaving = false;
                adminState.adminUsersError = error && error.message ?
                  error.message :
                  "Unable to delete the admin user.";
                renderAdmin_();
              });
      },
    });
  }

  function callListAdminUsersEndpoint_() {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before loading admin users."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(LIST_ADMIN_USERS_ENDPOINT, {
            method: "GET",
            headers: {
              Authorization: "Bearer " + idToken,
              Accept: "application/json",
            },
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function callUpsertAdminUserEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before saving admin users."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(UPSERT_ADMIN_USER_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function callDeleteAdminUserEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before deleting admin users."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(DELETE_ADMIN_USER_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function callClaimAdminInviteEndpoint_(payload) {
    if (!adminState.user) {
      return Promise.reject(new Error("Sign in before confirming admin invites."));
    }

    return adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(CLAIM_ADMIN_INVITE_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
        })
        .then(parseAdminEndpointResponse_);
  }

  function bootstrapFirstAdminUser_() {
    if (!adminState.user) {
      adminState.errorMessage = "Sign in before creating admin access.";
      renderAdmin_();
      return;
    }

    if (!adminState.userEmailAllowed) {
      adminState.errorMessage =
        "Use a CrossPointe account or an allowed tester account before creating admin access.";
      renderAdmin_();
      return;
    }

    adminState.bootstrapPending = true;
    adminState.bootstrapMessage = "";
    adminState.errorMessage = "";
    adminState.infoMessage = "Creating your first admin access record.";
    renderAdmin_();

    adminState.user.getIdToken()
        .then(function(idToken) {
          return fetch(FIRST_ADMIN_BOOTSTRAP_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + idToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uid: adminState.user.uid,
            }),
          });
        })
        .then(function(response) {
          return response.text().then(function(text) {
            var payload = null;

            try {
              payload = text ? JSON.parse(text) : null;
            } catch (error) {
            }

            return {
              ok: response.ok,
              payload: payload,
            };
          });
        })
        .then(function(result) {
          if (!result.ok) {
            var bootstrapError = new Error(
                result.payload && result.payload.error ?
                  result.payload.error :
                  "Unable to create your first admin user record.",
            );
            bootstrapError.code = result.payload && result.payload.code ?
              result.payload.code :
              "";
            throw bootstrapError;
          }

          adminState.bootstrapPending = false;
          adminState.bootstrapMessage =
            result.payload && result.payload.message ?
              result.payload.message :
              "Your first admin access record was created.";
          adminState.infoMessage =
            "First admin access created. Reloading your Firestore user record.";
          loadAdminUserDoc_();
        })
        .catch(function(error) {
          adminState.bootstrapPending = false;
          adminState.infoMessage =
            "Automatic admin bootstrap could not finish.";
          adminState.errorMessage = getAdminBootstrapErrorMessage_(error);
          renderAdmin_();
        });
  }

  function getAdminInviteQueryParams_() {
    if (!window.URLSearchParams) {
      return null;
    }

    var searchParams = new URLSearchParams(window.location.search);
    var inviteId = String(searchParams.get("invite") || "").trim();
    var token = String(searchParams.get("token") || "").trim();

    if (inviteId && token) {
      var inviteParams = {
        inviteId: inviteId,
        token: token,
      };
      writeStoredAdminInviteParams_(inviteParams);
      return inviteParams;
    }

    return readStoredAdminInviteParams_();
  }

  function hasAdminInviteQueryParams_() {
    return !!getAdminInviteQueryParams_();
  }

  function clearAdminInviteQueryParamsFromUrl_() {
    writeStoredAdminInviteParams_(null);

    if (!window.URL || !window.history || !window.history.replaceState) {
      return;
    }

    try {
      var nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("invite");
      nextUrl.searchParams.delete("token");
      var nextPath =
        nextUrl.pathname +
        (nextUrl.search || "") +
        (nextUrl.hash || "");
      window.history.replaceState({}, "", nextPath);
    } catch (error) {
    }
  }

  function claimAdminInvite_() {
    var inviteParams = getAdminInviteQueryParams_();

    if (!inviteParams) {
      return;
    }

    if (!adminState.user) {
      adminState.errorMessage = "Sign in before confirming this admin invite.";
      renderAdmin_();
      return;
    }

    adminState.inviteClaimPending = true;
    adminState.infoMessage = "Confirming your Central Admin invitation.";
    adminState.errorMessage = "";
    renderAdmin_();

    callClaimAdminInviteEndpoint_(inviteParams)
        .then(function(result) {
          adminState.inviteClaimPending = false;
          clearAdminInviteQueryParamsFromUrl_();
          adminState.infoMessage = result && result.message ?
            result.message :
            "Your Central Admin invite was confirmed.";
          adminState.errorMessage = "";
          loadAdminUserDoc_();
        })
        .catch(function(error) {
          adminState.inviteClaimPending = false;
          adminState.infoMessage =
            "We could not confirm this admin invite yet.";
          adminState.errorMessage = error && error.message ?
            error.message :
            "Unable to confirm your admin invite right now.";
          renderAdmin_();
        });
  }

  function loadAdminUserDoc_() {
    if (!adminFirestore || !adminState.user) {
      renderAdmin_();
      return;
    }

    adminState.userDocLoaded = false;
    adminState.userDocExists = false;
    adminState.userDocData = null;
    adminState.userDocErrorCode = "";
    adminState.infoMessage =
      "Signed in. Checking Firestore for your admin access record.";
    renderAdmin_();

    adminFirestore.doc(adminState.userDocPath).get()
        .then(function(snapshot) {
          adminState.userDocLoaded = true;
          adminState.userDocExists = snapshot.exists;
          adminState.userDocData = snapshot.exists ? snapshot.data() : null;
          adminState.errorMessage = "";

          if (hasAdminInviteQueryParams_()) {
            claimAdminInvite_();
            return;
          }

          if (!snapshot.exists) {
            resetAdminWhatsNewState_();
            adminState.infoMessage = [
              "Signed in successfully. The next step is creating your admin",
              "access record with the button below.",
            ].join(" ");
            renderAdmin_();
            return;
          }

          if (!isActiveAdminUserRecord_()) {
            resetAdminWhatsNewState_();
            adminState.infoMessage =
              "Your admin user record was found, but active is not true yet.";
            adminState.errorMessage = [
              "Set active to true in " + adminState.userDocPath +
              " to finish enabling dashboard access.",
            ].join(" ");
            renderAdmin_();
            return;
          }

          adminState.infoMessage =
            "Signed in successfully and matched to your Firestore admin record.";
          renderAdmin_();
          loadAdminWhatsNew_();
        })
        .catch(function(error) {
          adminState.userDocLoaded = true;
          adminState.userDocExists = false;
          adminState.userDocData = null;
          adminState.userDocErrorCode = error && error.code ?
            error.code :
            "";
          resetAdminWhatsNewState_();
          adminState.infoMessage =
            "Signed in successfully, but Firestore access still needs one more setup step.";
          adminState.errorMessage = getAdminLookupErrorMessage_(error);
          renderAdmin_();
        });
  }

  function resetAdminUserDocState_() {
    adminState.userDocPath = "";
    adminState.userDocLoaded = false;
    adminState.userDocExists = false;
    adminState.userDocData = null;
    adminState.userDocErrorCode = "";
    adminState.bootstrapPending = false;
    adminState.bootstrapMessage = "";
    adminState.inviteClaimPending = false;
  }

  function resetAdminWhatsNewState_() {
    stopAdminWhatsNewSubscription_();
    adminState.adminWhatsNewLoaded = false;
    adminState.adminWhatsNewDocExists = false;
    adminState.adminWhatsNewData = null;
    closeAdminWhatsNewModal_();
  }

  function loadAdminWhatsNew_() {
    if (!adminFirestore || !isActiveAdminUserRecord_()) {
      resetAdminWhatsNewState_();
      return;
    }

    stopAdminWhatsNewSubscription_();
    adminState.adminWhatsNewLoaded = false;
    adminState.adminWhatsNewDocExists = false;
    adminState.adminWhatsNewData = null;

    loadHostedAdminWhatsNewOverride_().then(function(whatsNew) {
      if (whatsNew) {
        adminState.adminWhatsNewLoaded = true;
        adminState.adminWhatsNewDocExists = true;
        adminState.adminWhatsNewData = whatsNew;
        maybeShowAdminWhatsNewModal_(whatsNew);
        return;
      }

      subscribeToAdminWhatsNewFromFirestore_();
    }, function(error) {
      console.warn(
          "Hosted admin what's-new config unavailable, using Firestore fallback.",
          error,
      );
      subscribeToAdminWhatsNewFromFirestore_();
    });
  }

  function subscribeToAdminWhatsNewFromFirestore_() {
    adminWhatsNewUnsubscribe = adminFirestore
        .doc(ADMIN_WHATS_NEW_DOC_PATH)
        .onSnapshot(function(snapshot) {
          adminState.adminWhatsNewLoaded = true;
          adminState.adminWhatsNewDocExists = snapshot.exists;
          adminState.adminWhatsNewData = snapshot.exists ?
            normalizeAdminWhatsNewData_(snapshot.data()) :
            null;

          if (!snapshot.exists || !adminState.adminWhatsNewData) {
            closeAdminWhatsNewModal_();
            return;
          }

          maybeShowAdminWhatsNewModal_(adminState.adminWhatsNewData);
        }, function(error) {
          adminState.adminWhatsNewLoaded = true;
          adminState.adminWhatsNewDocExists = false;
          adminState.adminWhatsNewData = null;
          closeAdminWhatsNewModal_();
          console.error("Unable to load admin what's new.", error);
        });
  }

  function loadHostedAdminWhatsNewOverride_() {
    return loadHostedWhatsNewConfig_().then(function(config) {
      var source = config &&
        typeof config === "object" &&
        Object.prototype.hasOwnProperty.call(config, "admin") ?
        config.admin :
        null;

      if (!source || typeof source !== "object") {
        return null;
      }

      if (!isTruthyAdminValue_(getAdminWhatsNewValue_(source, [
        "enabled",
        "use_hosted",
        "useHosted",
      ]))) {
        return null;
      }

      return normalizeAdminWhatsNewData_(source);
    });
  }

  function loadHostedWhatsNewConfig_() {
    if (hostedWhatsNewConfigPromise) {
      return hostedWhatsNewConfigPromise;
    }

    hostedWhatsNewConfigPromise = fetch(HOSTED_WHATS_NEW_CONFIG_URL, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })
        .then(parseHostedWhatsNewResponse_)
        .catch(function(error) {
          hostedWhatsNewConfigPromise = null;
          throw error;
        });

    return hostedWhatsNewConfigPromise;
  }

  function parseHostedWhatsNewResponse_(response) {
    return response.text().then(function(text) {
      var payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch (error) {
      }

      if (!response.ok) {
        throw new Error("Could not load the hosted what's-new config.");
      }

      return payload && typeof payload === "object" ? payload : {};
    });
  }

  function normalizeAdminWhatsNewData_(source) {
    var data = source && typeof source === "object" ? source : {};

    return {
      active: isTruthyAdminValue_(
          getAdminWhatsNewValue_(data, ["active", "isActive"]),
      ),
      forceShow: isTruthyAdminValue_(
          getAdminWhatsNewValue_(
              data,
              ["force_show", "forceShow", "force_every_time", "forceEveryTime"],
          ),
      ),
      version: normalizeAdminWhatsNewText_(
          getAdminWhatsNewValue_(data, ["version", "release", "releaseVersion"]),
      ),
      title: normalizeAdminWhatsNewText_(
          getAdminWhatsNewValue_(data, ["title", "heading"]),
      ),
      message: normalizeAdminWhatsNewText_(
          getAdminWhatsNewValue_(data, ["message", "body", "content", "markdown"]),
      ),
      buttonText: normalizeAdminWhatsNewText_(
          getAdminWhatsNewValue_(
              data,
              [
                "button_text",
                "buttonText",
                "testing_button_text",
                "testingButtonText",
                "cta_text",
                "ctaText",
              ],
          ),
      ),
    };
  }

  function maybeShowAdminWhatsNewModal_(whatsNew) {
    var config = normalizeAdminWhatsNewData_(whatsNew);

    if (!config.active || !config.message) {
      closeAdminWhatsNewModal_();
      return false;
    }

    if (!config.forceShow && !config.version) {
      return false;
    }

    if (!config.forceShow &&
      readSeenAdminWhatsNewVersion_() === config.version) {
      return false;
    }

    if (!config.forceShow) {
      markAdminWhatsNewSeen_(config.version);
    }

    showAdminWhatsNewModal_({
      version: config.forceShow ? (config.version || "Testing") : config.version,
      title: config.title || "What's New In Central Admin",
      message: config.message,
      buttonText: config.buttonText || "Sounds Good",
    });
    return true;
  }

  function closeAdminWhatsNewModal_() {
    var modal = document.getElementById("central-admin-whats-new-modal");
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }

    if (adminWhatsNewEscapeHandler) {
      document.removeEventListener("keydown", adminWhatsNewEscapeHandler);
      adminWhatsNewEscapeHandler = null;
    }

    document.body.classList.remove("modal-open");
  }

  function stopAdminWhatsNewSubscription_() {
    if (typeof adminWhatsNewUnsubscribe === "function") {
      adminWhatsNewUnsubscribe();
    }

    adminWhatsNewUnsubscribe = null;
  }

  function getAdminWhatsNewValue_(source, keys) {
    var data = source && typeof source === "object" ? source : {};
    var keyList = Array.isArray(keys) ? keys : [];
    var index;
    var key;

    for (index = 0; index < keyList.length; index += 1) {
      key = keyList[index];

      if (Object.prototype.hasOwnProperty.call(data, key) &&
        data[key] !== undefined &&
        data[key] !== null) {
        return data[key];
      }
    }

    return "";
  }

  function normalizeAdminWhatsNewText_(value) {
    return String(value || "").trim();
  }

  function showAdminWhatsNewModal_(config) {
    removeAdminWhatsNewModal_();

    if (!document.body) {
      return;
    }

    var modal = document.createElement("div");
    modal.id = "central-admin-whats-new-modal";
    modal.className = "whats-new-modal";
    modal.innerHTML = [
      "<div class=\"whats-new-backdrop\" data-admin-whats-new-close=\"true\"></div>",
      "<div class=\"whats-new-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"admin-whats-new-title\">",
        "<button type=\"button\" class=\"whats-new-close\" aria-label=\"Close what's new\" data-admin-whats-new-close=\"true\">&times;</button>",
        "<div class=\"whats-new-kicker\">What's New</div>",
        "<div class=\"whats-new-version\">Version " + escapeHtml_(config.version || "") + "</div>",
        "<h2 class=\"whats-new-title\" id=\"admin-whats-new-title\">" + escapeHtml_(config.title || "What's New In Central Admin") + "</h2>",
        "<div class=\"whats-new-body\">" + renderAdminMarkdownLite_(config.message || "") + "</div>",
        "<div class=\"whats-new-actions\">",
          "<button type=\"button\" class=\"see-more-btn whats-new-confirm\" data-admin-whats-new-close=\"true\">" + escapeHtml_(config.buttonText || "Sounds Good") + "</button>",
        "</div>",
      "</div>",
    ].join("");

    modal.addEventListener("click", function(event) {
      var closeTrigger = event.target.closest(
          "[data-admin-whats-new-close=\"true\"]",
      );

      if (closeTrigger) {
        closeAdminWhatsNewModal_();
      }
    });

    adminWhatsNewEscapeHandler = function(event) {
      if (event.key === "Escape") {
        closeAdminWhatsNewModal_();
      }
    };

    document.addEventListener("keydown", adminWhatsNewEscapeHandler);
    document.body.classList.add("modal-open");
    document.body.appendChild(modal);
  }

  function removeAdminWhatsNewModal_() {
    closeAdminWhatsNewModal_();
  }

  function readSeenAdminWhatsNewVersion_() {
    try {
      return localStorage.getItem(CENTRAL_ADMIN_WHATS_NEW_SEEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function markAdminWhatsNewSeen_(version) {
    try {
      localStorage.setItem(
          CENTRAL_ADMIN_WHATS_NEW_SEEN_KEY,
          String(version || ""),
      );
    } catch (error) {
    }
  }

  function isTruthyAdminValue_(value) {
    if (value === true || value === 1) {
      return true;
    }

    var normalized = String(value || "").trim().toLowerCase();
    return normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on";
  }

  function resetChangeRequestsState_() {
    adminState.changeRequestsLoaded = false;
    adminState.changeRequestsLoading = false;
    adminState.changeRequestsActionPending = false;
    adminState.changeRequestsItems = [];
    adminState.changeRequestsExpandedId = "";
    adminState.changeRequestsPendingCount = 0;
    adminState.changeRequestsError = "";
    adminState.changeRequestsMessage = "";
  }

  function renderStatusPill_(label, toneClass) {
    return [
      "<span class=\"central-admin-pill ", toneClass || "", "\">",
      escapeHtml_(label),
      "</span>",
    ].join("");
  }

  function renderAdminNote_(text) {
    return [
      "<p class=\"central-admin-note\">",
      escapeHtml_(text),
      "</p>",
    ].join("");
  }

  function renderInlineMeta_(label, value) {
    return [
      "<span class=\"central-admin-pill\">",
      escapeHtml_(label + ": " + value),
      "</span>",
    ].join("");
  }

  function getCurrentAdminPageId_() {
    var path = window.location.pathname.replace(/^\/admin\/?/, "");
    if (!path) {
      return "overview";
    }

    var normalizedPath = path.replace(/\/+$/, "");
    var matchedPage = ADMIN_PAGES.find(function(page) {
      return getAdminPageRoutes_(page).some(function(route) {
        return route.replace(/^\/admin\/?/, "") === normalizedPath;
      });
    });

    return matchedPage ? matchedPage.id : "overview";
  }

  function getAdminPageRoutes_(page) {
    var routes = [page.route];

    if (Array.isArray(page.legacyRoutes)) {
      routes = routes.concat(page.legacyRoutes);
    }

    return routes;
  }

  function getAdminPageById_(pageId) {
    return ADMIN_PAGES.find(function(page) {
      return page.id === pageId;
    }) || null;
  }

  function isAdminRoute_() {
    return (window.CENTRAL_BOOT_MODE || "") === "admin" ||
      /^\/admin(?:\/|$)/.test(window.location.pathname);
  }

  function shouldUseFirebaseEmulators_() {
    var hostname = window.location.hostname;
    var searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("emulators") === "1") {
      return true;
    }

    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
  }

  function shouldAdminSidebarStartOpen_() {
    return window.innerWidth > 1080;
  }

  function isAllowedAdminEmail_(email) {
    if (!email) {
      return false;
    }

    var normalizedEmail = email.toLowerCase();

    if (CENTRAL_ALLOWED_ADMIN_EMAILS.indexOf(normalizedEmail) !== -1) {
      return true;
    }

    return CENTRAL_ALLOWED_EMAIL_DOMAINS.some(function(domain) {
      return normalizedEmail.endsWith("@" + domain);
    });
  }

  function getVisibleAdminPages_() {
    return ADMIN_PAGES.filter(canAccessAdminPage_);
  }

  function canAccessAdminPage_(page) {
    if (!page || page.id === "overview") {
      return true;
    }

    if (!isActiveAdminUserRecord_()) {
      return false;
    }

    var permission = getPageAccessLevel_(page.pageAccessKey);

    if (page.id === "wayfinder") {
      return permission === "admin";
    }

    return permission !== "none";
  }

  function getPageAccessLevel_(pageAccessKey) {
    if (!pageAccessKey || !adminState.userDocData ||
      !adminState.userDocData.pageAccess) {
      return "none";
    }

    var pageAccess = adminState.userDocData.pageAccess || {};
    if (Object.prototype.hasOwnProperty.call(pageAccess, pageAccessKey)) {
      return normalizeAdminPermissionValue_(pageAccess[pageAccessKey]);
    }

    if (pageAccessKey === "hub" || pageAccessKey === "integrations" ||
      pageAccessKey === "bulletin") {
      return normalizeAdminPermissionValue_(pageAccess.settings);
    }

    if (pageAccessKey === "resources" ||
      pageAccessKey === "nextSteps" ||
      pageAccessKey === "campaigns" ||
      pageAccessKey === "serveNeeds" ||
      pageAccessKey === "thisSunday" ||
      pageAccessKey === "roomRules" ||
      pageAccessKey === "users") {
      return normalizeAdminPermissionValue_(pageAccess.settings);
    }

    return "none";
  }

  function normalizeAdminPermissionValue_(value) {
    return String(value || "none").trim().toLowerCase() || "none";
  }

  function getPermissionLabel_(permission) {
    return PERMISSION_LABELS[permission] || "Not Set";
  }

  function canChangeContentWithPermission_(permission) {
    return permission === "propose" ||
      permission === "edit" ||
      permission === "approve" ||
      permission === "admin";
  }

  function isEditorLevelPermission_(permission) {
    return permission === "edit" ||
      permission === "approve" ||
      permission === "admin";
  }

  function isDirectPublishPermission_(permission) {
    return isEditorLevelPermission_(permission);
  }

  function isSubmitForApprovalPermission_(permission) {
    return permission === "propose";
  }

  function hasChangeRequestsInboxAccess_() {
    return isActiveAdminUserRecord_() &&
      getPageAccessLevel_("changeRequests") !== "none";
  }

  function canReviewChangeRequests_() {
    var permission = getPageAccessLevel_("changeRequests");
    return permission === "approve" || permission === "admin";
  }

  function getPrimaryContentActionConfig_(permission) {
    if (isDirectPublishPermission_(permission)) {
      return {
        mode: "publish",
        label: "Publish",
      };
    }

    if (isSubmitForApprovalPermission_(permission)) {
      return {
        mode: "submit",
        label: "Submit for Approval",
      };
    }

    return {
      mode: "blocked",
      label: "No Access",
    };
  }

  function getPrimaryContentBusyLabel_(actionConfig) {
    return actionConfig && actionConfig.mode === "submit" ?
      "Submitting..." :
      "Publishing...";
  }

  function getAdminPageStatusText_(page) {
    if (!page) {
      return "";
    }

    if (page.id === "change-requests") {
      if (adminState.changeRequestsPendingCount > 0) {
        return String(adminState.changeRequestsPendingCount) + " pending";
      }

      if (adminState.changeRequestsLoaded) {
        return "Up to date";
      }
    }

    return page.status || "";
  }

  function getChangeRequestStatusLabel_(status) {
    if (status === "approved") {
      return "Approved";
    }

    if (status === "rejected") {
      return "Rejected";
    }

    return "Pending";
  }

  function formatAdminTimestamp_(value) {
    var date = null;

    if (value && typeof value.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "an unknown time";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function isActiveAdminUserRecord_() {
    return !!(
      adminState.userDocExists &&
      adminState.userDocData &&
      adminState.userDocData.active === true
    );
  }

  function getAdminUserDocPath_(uid) {
    return CENTRAL_ADMIN_USERS_COLLECTION_PATH + "/" + uid;
  }

  function createFirstAdminUserDocTemplate_() {
    return {
      uid: adminState.user && adminState.user.uid ?
        adminState.user.uid :
        "",
      email: adminState.user && adminState.user.email ?
        adminState.user.email :
        "",
      displayName: adminState.user && adminState.user.displayName ?
        adminState.user.displayName :
        "",
      photoUrl: adminState.user && adminState.user.photoURL ?
        adminState.user.photoURL :
        "",
      active: true,
      roleIds: [],
      pageAccess: cloneFirstAdminPageAccess_(),
    };
  }

  function cloneFirstAdminPageAccess_() {
    return JSON.parse(JSON.stringify(FIRST_ADMIN_PAGE_ACCESS));
  }

  function getAdminLookupErrorMessage_(error) {
    if (error && error.code === "permission-denied") {
      return [
        "Firestore rules are still blocking reads to " +
        adminState.userDocPath + ". Deploy the repo's firestore.rules",
        "before testing this login flow again.",
      ].join(" ");
    }

    return error && error.message ?
      error.message :
      "Unable to read your Firestore admin user document.";
  }

  function getAdminBootstrapErrorMessage_(error) {
    if (error && error.code === "bootstrap-closed") {
      return [
        "Automatic bootstrap is closed because an admin user already exists.",
        "If that user should be you, add your record manually at " +
        adminState.userDocPath + ".",
      ].join(" ");
    }

    return error && error.message ?
      error.message :
      "Unable to create your first admin user document.";
  }

  function getAdminAccessSummaryLabel_() {
    if (adminState.inviteClaimPending) {
      return "Confirming invite";
    }

    if (adminState.bootstrapPending) {
      return "Creating admin doc";
    }

    if (!adminState.user) {
      return "Not signed in";
    }

    if (!adminState.userEmailAllowed) {
      return "Wrong account";
    }

    if (isActiveAdminUserRecord_()) {
      return "Admin access active";
    }

    if (adminState.userDocExists) {
      return "Admin doc needs activation";
    }

    if (adminState.userDocErrorCode === "permission-denied") {
      return "Deploy rules first";
    }

    return "Create admin doc";
  }

  function getAdminAccessSummaryTone_() {
    if (isActiveAdminUserRecord_()) {
      return "is-safe";
    }

    if (!adminState.user || !adminState.userEmailAllowed) {
      return "is-warn";
    }

    return "is-live";
  }

  function getAdminAccessPanelSummary_() {
    if (!adminState.user) {
      return "Sign in first, then this panel will show the exact Firestore path for your admin record.";
    }

    if (!adminState.userEmailAllowed) {
      return "You are signed in with the wrong Google account for the dashboard.";
    }

    if (isActiveAdminUserRecord_()) {
      return "Your Firestore admin record is live and the dashboard can now start honoring permissions.";
    }

    return "This panel can create your first admin record automatically and still shows the manual Firestore fallback.";
  }

  function escapeHtml_(value) {
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

  function escapeAttr_(value) {
    return escapeHtml_(value);
  }

  function renderAdminMarkdownLite_(value) {
    var normalized = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";

    var lines = normalized.split("\n");
    var html = [];
    var paragraphLines = [];
    var listLines = [];

    var flushParagraph = function() {
      if (!paragraphLines.length) return;

      html.push(
          "<p>" +
          renderAdminMarkdownInline_(paragraphLines.join("\n")).replace(/\n/g, "<br>") +
          "</p>",
      );
      paragraphLines = [];
    };

    var flushList = function() {
      if (!listLines.length) return;
      html.push(
          renderAdminMarkdownListCollectionHtml_(
              parseAdminMarkdownListBlocks_(listLines),
          ),
      );
      listLines = [];
    };

    lines.forEach(function(rawLine) {
      var line = String(rawLine || "");
      var trimmedLine = line.trim();
      var headingMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);
      var listMatch = parseAdminMarkdownListLine_(line);

      if (!trimmedLine) {
        flushParagraph();
        flushList();
        return;
      }

      if (headingMatch) {
        flushParagraph();
        flushList();
        html.push(
            "<h3 class=\"whats-new-heading level-" + headingMatch[1].length + "\">" +
            renderAdminMarkdownInline_(headingMatch[2]) +
            "</h3>",
        );
        return;
      }

      if (listMatch) {
        flushParagraph();
        listLines.push(line);
        return;
      }

      flushList();
      paragraphLines.push(trimmedLine);
    });

    flushParagraph();
    flushList();

    return html.join("");
  }

  function parseAdminMarkdownListLine_(line) {
    var match = String(line || "").match(/^([ \t]*)([-*]|\d+\.)\s+(.*)$/);
    if (!match) return null;

    return {
      indent: getAdminMarkdownIndentWidth_(match[1]),
      type: /^\d+\.$/.test(match[2]) ? "ol" : "ul",
      text: match[3],
    };
  }

  function getAdminMarkdownIndentWidth_(value) {
    return String(value || "").replace(/\t/g, "  ").length;
  }

  function parseAdminMarkdownListBlocks_(lines) {
    var tokens = (lines || []).map(parseAdminMarkdownListLine_).filter(Boolean);
    if (!tokens.length) return [];

    var index = 0;

    var parseListsAtIndent = function(expectedIndent) {
      var lists = [];
      var currentList = null;

      while (index < tokens.length) {
        var token = tokens[index];

        if (token.indent < expectedIndent) {
          break;
        }

        if (token.indent > expectedIndent) {
          if (!currentList || !currentList.items.length) {
            token.indent = expectedIndent;
          } else {
            currentList.items[currentList.items.length - 1].children =
              currentList.items[currentList.items.length - 1].children.concat(
                  parseListsAtIndent(token.indent),
              );
            continue;
          }
        }

        if (!currentList || currentList.type !== token.type) {
          currentList = {
            type: token.type,
            items: [],
          };
          lists.push(currentList);
        }

        currentList.items.push({
          text: token.text,
          children: [],
        });
        index += 1;

        while (index < tokens.length && tokens[index].indent > expectedIndent) {
          currentList.items[currentList.items.length - 1].children =
            currentList.items[currentList.items.length - 1].children.concat(
                parseListsAtIndent(tokens[index].indent),
            );
        }
      }

      return lists;
    };

    return parseListsAtIndent(tokens[0].indent);
  }

  function renderAdminMarkdownListCollectionHtml_(lists) {
    return (lists || []).map(function(list) {
      return "<" + list.type + ">" +
        (list.items || []).map(function(item) {
          return "<li>" +
            renderAdminMarkdownInline_(item.text || "") +
            renderAdminMarkdownListCollectionHtml_(item.children || []) +
            "</li>";
        }).join("") +
        "</" + list.type + ">";
    }).join("");
  }

  function renderAdminMarkdownInline_(value) {
    var html = escapeHtml_(value || "");

    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_\n][\s\S]*?)__/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

    return html;
  }
}());
