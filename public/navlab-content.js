import {HIGHLIGHT_TYPES, scheduledHighlights} from "./navlab-promotions.js?v=2";
import {createEventMedia, createEventDateToken, eventLocationMeta} from "./navlab-event-card.js?v=3";
import {createInterestDialogController} from "./navlab-interest.js?v=1";

const DEFAULT_ENDPOINT = "https://central.crosspointe.tv/api/central-data";
const REQUEST_TIMEOUT_MS = 30_000;
let todayRefreshTimer;
let stopHighlightRefresh = () => {};

function text(value) {
  return String(value || "").trim();
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(text(value));
    if (!/^https?:$/i.test(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}

function safeCalendarUrl(value, endpoint) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("/")) {
    try {
      const endpointUrl = new URL(endpoint, window.location.href);
      return safeHttpUrl(new URL(raw, endpointUrl).href);
    } catch (_error) {
      return "";
    }
  }
  return safeHttpUrl(raw);
}

export function navlabAnalyticsMetadata(type, item = {}) {
  const normalizedType = text(type) || (item.source === "Planning Center Registrations" ? "registrations" : "events");
  const sectionId = {
    campaigns: "campaigns",
    events: "events",
    nextSteps: "next_step",
    registrations: "registrations",
    resources: "resources",
    serveNeeds: "serve_needs",
  }[normalizedType] || normalizedType;
  const contentLabel = text(item.need || item.title);
  // Match the production client: only public source identity fields (or the
  // public title fallback) become analytics identifiers.
  const contentId = text(item.id || item.event_id || item.registration_id || contentLabel);
  return {sectionId, contentId, contentLabel};
}

export function applyNavlabAnalyticsAttributes(node, metadata = {}) {
  if (!node || typeof node.setAttribute !== "function") return node;
  const attributes = {
    "data-analytics-section": metadata.sectionId,
    "data-analytics-event": metadata.event,
    "data-analytics-action": metadata.action,
    "data-analytics-content-id": metadata.contentId,
    "data-analytics-content-label": metadata.contentLabel,
    "data-calendar-provider": metadata.calendarProvider,
  };
  for (const [name, value] of Object.entries(attributes)) {
    if (text(value)) node.setAttribute(name, text(value));
  }
  return node;
}

function appendLink(parent, label, url, secondary = false, analytics = {}) {
  if (!url) return;
  const link = element("a", `button${secondary ? " secondary" : ""}`, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  applyNavlabAnalyticsAttributes(link, analytics);
  parent.append(link);
}

function appendCentralLink(parent, label, raw, onNavigate, secondary = true) {
  const destinations = {"#upcoming-events": "events", "#registrations": "events", "#groups": "groups", "#next-step": "next-steps", "#resources": "next-steps", "#serve-needs": "next-steps", "#current-campaigns": "next-steps"};
  const value = text(raw);
  let destination = destinations[value] ||
    (/^https:\/\/(www\.)?crosspointe\.tv\/small-groups\/?$/.test(value) ? "groups" : "");
  if (!destination) {
    try {
      const url = new URL(value, window.location.href);
      if (url.hostname === "central.crosspointe.tv" && /^\/?(?:index\.html)?$/.test(url.pathname)) {
        destination = destinations[url.hash] || "";
      }
    } catch (_error) {
    }
  }
  if (destination) {
    const button = element("button", `button${secondary ? " secondary" : ""}`, label);
    button.type = "button";
    button.addEventListener("click", () => onNavigate(destination));
    parent.append(button);
  } else {
    // Existing Central section links can still open the production page.
    appendLink(parent, label, safeHttpUrl(text(raw).startsWith("#") ? `https://central.crosspointe.tv/${raw}` : raw), secondary);
  }
}

function calendarIntegrationsEnabled(data) {
  const sundaySettings = data && data.sundaySettings || {};
  const sources = [
    [data, "calendarIntegrationsEnabled"],
    [data, "calendar_integrations_enabled"],
    [sundaySettings, "calendarIntegrationsEnabled"],
    [sundaySettings, "calendar_integrations_enabled"],
  ];
  for (const [source, key] of sources) {
    if (!source || !Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (value === true || value === false) return value;
    if (value == null || text(value) === "") return true;
    return /^(true|1|yes|on)$/i.test(text(value));
  }
  return true;
}

function metaFor(item) {
  const date = text(item.date) || (text(item.close_date) ? `Registration closes on ${text(item.close_date)}` : "");
  return [date, text(item.time), text(item.location || item.venue)]
      .filter(Boolean).join(" · ");
}

function card(item, {detailsLabel = "Learn more", onDetails, event = false} = {}) {
  const article = element("article", `live-card card${event ? " event-card" : ""}`);
  if (event) {
    applyNavlabAnalyticsAttributes(article, navlabAnalyticsMetadata(item.labKind, item));
    article.append(createEventMedia(item, {kind: item.labKind === "registrations" ? "Registration" : "Event"}));
  }
  const body = element("div", "card-body");
  if (text(item.status_label)) body.append(element("p", "eyebrow", text(item.status_label)));
  const meta = event ? eventLocationMeta(item) : metaFor(item);
  if (meta) body.append(element("p", "live-meta", meta));
  body.append(element("h3", "", text(item.title) || "CrossPointe"));
  if (!onDetails && text(item.description)) body.append(element("p", "live-description", text(item.description)));
  if (onDetails) {
    const button = element("button", "button secondary", detailsLabel);
    button.type = "button";
    const analytics = navlabAnalyticsMetadata(item.labKind, item);
    applyNavlabAnalyticsAttributes(button, {
      action: "view_event",
      contentId: analytics.contentId,
      contentLabel: analytics.contentLabel,
    });
    button.addEventListener("click", () => onDetails(item, button));
    body.append(button);
  }
  article.append(body);
  return article;
}

function section(title, eyebrow, gridClass = "", analyticsSection = "") {
  const node = element("section", `live-section${gridClass ? ` ${gridClass}` : ""}`);
  applyNavlabAnalyticsAttributes(node, {sectionId: text(analyticsSection || title)
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "section"});
  const heading = element("div", "section-heading");
  const headingCopy = element("div");
  if (eyebrow) headingCopy.append(element("p", "eyebrow", eyebrow));
  headingCopy.append(element("h2", "", title));
  heading.append(headingCopy);
  const grid = element("div", `live-grid${gridClass ? ` ${gridClass}` : ""}`);
  node.append(heading, grid);
  return {node, grid};
}

function isFutureEvent(item) {
  const startsAt = new Date(text(item && item.starts_at));
  return !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now();
}

function createDialogController(endpoint, allowCalendarIntegrations) {
  const dialog = document.getElementById("detail-dialog");
  const title = document.getElementById("detail-title");
  const kicker = document.getElementById("detail-kicker");
  const meta = document.getElementById("detail-meta");
  const copy = document.getElementById("detail-copy");
  const links = document.getElementById("detail-links");

  return (item, sourceFocus) => {
    if (!dialog || !title || !kicker || !meta || !copy) return;
    const analytics = navlabAnalyticsMetadata(item.labKind, item);
    applyNavlabAnalyticsAttributes(dialog, analytics);
    title.textContent = text(item.title) || "CrossPointe Event";
    kicker.textContent = item.labKind === "registrations" || item.source === "Planning Center Registrations" ?
      "Registration" : "Event";
    meta.textContent = metaFor(item);
    copy.textContent = text(item.description) || "More details will be posted here as they become available.";
    if (links) {
      links.replaceChildren();
      appendLink(links, text(item.registration_button_text) || "Register", safeHttpUrl(item.registration_url), false, {
        event: "registration_click",
        action: "registration_outbound",
        contentId: analytics.contentId,
        contentLabel: analytics.contentLabel,
      });
      appendLink(links, "View event", safeHttpUrl(item.church_center_url || item.button_url), true);
      if (allowCalendarIntegrations) {
        appendLink(links, "Google Calendar", safeHttpUrl(item.calendar_url), true, {
          event: "calendar_add", action: "add_to_calendar", contentId: analytics.contentId,
          contentLabel: analytics.contentLabel, calendarProvider: "google",
        });
        appendLink(links, "Download calendar", safeCalendarUrl(item.calendar_file_url, endpoint), true, {
          event: "calendar_add", action: "add_to_calendar", contentId: analytics.contentId,
          contentLabel: analytics.contentLabel, calendarProvider: "apple",
        });
      }
    }
    const returnFocus = () => sourceFocus && sourceFocus.focus({preventScroll: true});
    dialog.addEventListener("close", returnFocus, {once: true});
    if (!dialog.open) dialog.showModal();
  };
}

function renderStatus(root, message, retry) {
  const status = element("article", "live-status card");
  status.setAttribute("role", "status");
  status.append(element("p", "", message));
  if (retry) {
    const button = element("button", "button", "Try again");
    button.type = "button";
    button.addEventListener("click", retry);
    status.append(button);
  }
  root.replaceChildren();
  if (root.id === "home-content" || root.id === "sunday-home-content") {
    const heading = element("h1", "page-heading", "CrossPointe Central");
    heading.id = root.id === "sunday-home-content" ? "sunday-home-title" : "home-title";
    heading.tabIndex = -1;
    root.append(heading);
  }
  root.append(status);
}

function createFeaturedCard(data, showDetails) {
  const settings = data?.settings || {};
  const enabled = (value) => value === true || ["true", "1", "yes", "on"].includes(text(value).toLowerCase());
  const featured = data && data.featuredEvent;
  if (enabled(settings.featured_event_enabled) && featured && isFutureEvent(featured) && text(featured.title)) {
    const featuredCard = element("article", "live-featured card");
    featuredCard.classList.add("event-card");
    const analytics = navlabAnalyticsMetadata(featured.labKind, featured);
    applyNavlabAnalyticsAttributes(featuredCard, analytics);
    const media = createEventMedia(featured, {kind: "Featured event", eager: true, showDate: false});
    media.classList.add("featured-event-media");
    featuredCard.append(media);
    const body = element("div", "card-body");
    const summary = element("div", "featured-event-summary");
    const date = createEventDateToken(featured);
    if (date) summary.append(date);
    const copy = element("div", "featured-event-copy");
    copy.append(element("p", "eyebrow", "Featured event"), element("h2", "", text(featured.title)));
    if (eventLocationMeta(featured)) copy.append(element("p", "live-meta", eventLocationMeta(featured)));
    summary.append(copy);
    body.append(summary);
    const details = element("button", "button", "View event");
    details.type = "button";
    applyNavlabAnalyticsAttributes(details, {
      action: "view_event", contentId: analytics.contentId, contentLabel: analytics.contentLabel,
    });
    details.addEventListener("click", () => showDetails(featured, details));
    const featuredActions = element("div", "hero-actions");
    appendLink(featuredActions, text(featured.registration_button_text) || "Register", safeHttpUrl(featured.registration_url), false, {
      event: "registration_click", action: "registration_outbound",
      contentId: analytics.contentId, contentLabel: analytics.contentLabel,
    });
    details.classList.add("secondary");
    featuredActions.append(details);
    body.append(featuredActions);
    featuredCard.append(body);
    return featuredCard;
  }
  return null;
}

function createWorshipCard(songs) {
  const setlist = Array.isArray(songs) ? songs : [];
  if (!setlist.length) return null;
  const setlistCard = element("article", "live-card card");
  const setlistBody = element("div", "card-body");
  setlistBody.append(element("h3", "", "Worship Set"));
  const services = [...new Set(setlist.map((song) => text(song.service) || "Sunday"))];
  const tabs = element("div", "chips");
  const list = element("ul");
  const renderService = (service) => {
    list.replaceChildren(...setlist.filter((song) => (text(song.service) || "Sunday") === service)
        .map((song) => element("li", "", text(song.song_title))));
    tabs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === service)));
  };
  services.forEach((service) => {
    const button = element("button", "", service);
    button.type = "button";
    button.addEventListener("click", () => renderService(service));
    tabs.append(button);
  });
  setlistBody.append(tabs, list); renderService(services[0]);
  setlistCard.append(setlistBody); return setlistCard;
}

function renderHome(root, data, showDetails, onNavigate, interests) {
  const settings = data && data.settings || {};
  const sunday = data && data.sunday || {};
  const modules = new Map();
  root.replaceChildren();

  const hero = element("section", "live-hero");
  applyNavlabAnalyticsAttributes(hero, {sectionId: "hero"});
  const copy = element("div", "live-hero-copy");
  copy.append(element("p", "eyebrow", text(settings.site_title) || "CrossPointe Central"));
  const heading = element("h1", "", text(settings.hero_heading) || "Stay connected.");
  heading.id = "home-title";
  heading.tabIndex = -1;
  copy.append(heading);
  if (text(settings.hero_subheading)) copy.append(element("p", "", text(settings.hero_subheading)));
  const actions = element("div", "hero-actions");
  appendLink(actions, text(settings.primary_button_text) || "Learn more", safeHttpUrl(settings.primary_button_url));
  appendLink(actions, text(settings.secondary_button_text) || "More ways to connect", safeHttpUrl(settings.secondary_button_url), true);
  if (actions.childElementCount) copy.append(actions);
  hero.append(copy);

  const featured = createFeaturedCard(data, showDetails);
  if (featured) hero.append(featured);
  root.append(hero);
  renderHighlights(root, data, showDetails, onNavigate, interests);

  if (data && data.banner && text(data.banner.message || data.banner.text || data.banner.title)) {
    const banner = element("aside", "live-banner card");
    applyNavlabAnalyticsAttributes(banner, {sectionId: "status_banner"});
    if (text(data.banner.title)) banner.append(element("h2", "", text(data.banner.title)));
    if (text(data.banner.message)) banner.append(element("p", "", text(data.banner.message)));
    appendCentralLink(banner, text(data.banner.button_text) || "Learn more", data.banner.button_url, onNavigate, false);
    modules.set("statusBanner", banner);
  }
  if (text(sunday.date) || text(sunday.sermon_title) || text(sunday.note)) {
    const sundaySection = section("This Sunday", "Worship + Word", "two", "sunday");
    sundaySection.node.id = "this-sunday";
    const sundayCard = card({title: sunday.sermon_title || "Sunday Worship", description: sunday.note, location: sunday.speaker ? `With ${sunday.speaker}` : "", time: sunday.scripture || ""});
    const sundayBody = sundayCard.querySelector(".card-body");
    sundayBody.prepend(element("p", "eyebrow", text(sunday.date)));
    if (text(sunday.series)) sundayBody.append(element("p", "live-description", text(sunday.series)));
    const openNotes = element("button", "button secondary", "Open sermon notes");
    openNotes.type = "button";
    openNotes.addEventListener("click", () => onNavigate("notes"));
    sundayBody.append(openNotes);
    sundaySection.grid.append(sundayCard);
    const setlistCard = createWorshipCard(data.setlist);
    if (setlistCard) sundaySection.grid.append(setlistCard);
    modules.set("sunday", sundaySection.node);
  }
  const quickLinks = Array.isArray(data && data.quickLinks) ? data.quickLinks : [];
  if (quickLinks.length) {
    const content = section("Quick links", "Fast access", "", "quick_links");
    content.node.id = "quick-links";
    content.grid.className = "quick-links-row";
    quickLinks.forEach((item) => {
      const url = text(item.button_url || item.url);
      if (url) {
        appendCentralLink(content.grid, text(item.button_text) || text(item.title), url, onNavigate);
      }
    });
    if (content.grid.childElementCount) modules.set("quickLinks", content.node);
  }
  const defaultOrder = ["statusBanner", "sunday", "quickLinks"];
  const config = Array.isArray(settings.homepage_modules) ? settings.homepage_modules : [];
  defaultOrder.map((id, index) => {
    const item = config.find((entry) => entry.id === id);
    return {id, enabled: !item || (item.enabled !== false && item.enabled !== "false"), sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : (index + 1) * 10};
  }).sort((a, b) => a.sort - b.sort).forEach(({id, enabled: visible}) => {
    if (visible && modules.has(id)) root.append(modules.get(id));
  });
}

function renderSundayHome(root, data, showDetails, onNavigate, onWatch, interests) {
  const sunday = data.sunday || {};
  const settings = data.sundaySettings || {};
  root.replaceChildren();
  const hero = element("section", "sunday-home-hero card");
  applyNavlabAnalyticsAttributes(hero, {sectionId: "sunday_hero"});
  const copy = element("div", "sunday-home-copy");
  copy.append(element("p", "eyebrow", text(sunday.date) || "Sunday at CrossPointe"));
  const title = element("h1", "", text(sunday.sermon_title) || "Sunday Worship");
  title.id = "sunday-home-title"; title.tabIndex = -1;
  copy.append(title);
  const info = element("div", "sunday-home-meta");
  if (text(sunday.series)) info.append(element("p", "sunday-home-series", text(sunday.series)));
  if (text(sunday.speaker)) info.append(element("p", "", `With ${text(sunday.speaker)}`));
  const scripture = text(settings.sunday_scripture_reference || sunday.scripture);
  if (scripture) info.append(element("p", "", scripture));
  copy.append(info);
  if (text(sunday.note)) copy.append(element("p", "sunday-home-note", text(sunday.note)));
  const actions = element("div", "hero-actions");
  const notes = element("button", "button", "Take Notes"); notes.type = "button";
  notes.addEventListener("click", () => onNavigate("notes")); actions.append(notes);
  const canWatch = Boolean(safeHttpUrl(settings.sunday_livestream_url));
  if (canWatch) {
    const watch = element("button", "button secondary", "Watch Live"); watch.type = "button";
    watch.addEventListener("click", onWatch); actions.append(watch);
  }
  copy.append(actions); hero.append(copy);
  const welcome = element("div", "sunday-home-welcome");
  welcome.append(stepArtwork("book"), element("h2", "", "Let’s follow along."),
      element("p", "", "Keep Scripture close, capture what stands out, and take your next step."));
  hero.append(welcome); root.append(hero);

  if (canWatch) {
    const watchSection = section("Watch Live", "Join from wherever you are", "", "watch_live");
    watchSection.node.classList.add("sunday-watch-section");
    watchSection.grid.className = "sunday-watch-grid";
    const anchor = element("div", "sunday-watch-anchor card"); anchor.id = "sunday-watch-anchor";
    const start = element("button", "sunday-watch-start", "▶  Watch the service"); start.type = "button";
    start.addEventListener("click", onWatch);
    anchor.append(start);
    const caption = element("p", "sunday-watch-caption", "Watch here, then keep the service with you while you take notes or browse Central.");
    watchSection.grid.append(anchor, caption); root.append(watchSection.node);
  }
  const worship = createWorshipCard(data.setlist);
  if (worship) {
    const content = section("This morning’s worship", "Sing with us", "", "sermon_worship");
    content.grid.className = "sunday-worship-grid";
    content.grid.append(worship); root.append(content.node);
  }
  const featured = createFeaturedCard(data, showDetails);
  if (featured) {
    const content = section("Coming up at CrossPointe", "Beyond Sunday", "", "upcoming_events");
    content.node.classList.add("sunday-featured-section");
    content.grid.className = "sunday-featured-grid";
    content.grid.append(featured); root.append(content.node);
  }
  renderHighlights(root, data, showDetails, onNavigate, interests);
  const quick = section("Quick links", "Stay connected", "", "quick_links"); quick.grid.className = "quick-links-row";
  quick.node.id = "sunday-quick-links";
  for (const item of Array.isArray(data.quickLinks) ? data.quickLinks : []) {
    appendCentralLink(quick.grid, text(item.button_text || item.title), item.button_url || item.url, onNavigate);
  }
  if (quick.grid.childElementCount) root.append(quick.node);
}

// Decorative artwork stays local; card content and destinations come from Central.
function stepArtwork(kind) {
  const paths = {
    water: "M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z M8 15a4 4 0 0 0 4 4",
    people: "M3 21v-3a6 6 0 0 1 12 0v3 M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 5a3 3 0 0 1 0 6 M18 15a5 5 0 0 1 3 5",
    book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z M12 5v15 M6 8h3 M15 8h3",
    heart: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 1 10 8 15 7-5 13-10 8-15Z",
    arrow: "M4 20h5v-5h5v-5h6 M14 4h6v6",
    calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M7 3v5 M17 3v5 M3 11h18 M8 16h2 M14 16h2",
    ticket: "M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z M14 5v2 M14 10v1 M14 14v1 M14 18v1",
  };
  const badge = element("div", `step-art step-art-${kind}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths[kind] || paths.arrow);
  svg.append(path);
  badge.append(svg);
  return badge;
}

// Home and the regular browse sections share destinations and details flows.
function appendSourceAction(parent, type, item, {showDetails, onNavigate, interests}) {
  if (type === "events" || type === "registrations") {
    const button = element("button", "button secondary", type === "registrations" ? "View registration" : "View event");
    button.type = "button";
    const analytics = navlabAnalyticsMetadata(type, item);
    applyNavlabAnalyticsAttributes(button, {
      action: "view_event", contentId: analytics.contentId, contentLabel: analytics.contentLabel,
    });
    button.addEventListener("click", () => showDetails({...item, labKind: type}, button));
    parent.append(button);
  } else if (type === "serveNeeds") {
    const button = element("button", "button secondary", text(item.button_text) || "Share my interest");
    button.type = "button";
    button.addEventListener("click", () => interests.openServeNeed(item, button));
    parent.append(button);
  } else if (type === "campaigns" && text(item.action_type).toLowerCase() === "contact") {
    const button = element("button", "button secondary", text(item.button_text) || "Get More Info");
    button.type = "button";
    button.addEventListener("click", () => interests.openCampaign(item, button));
    parent.append(button);
  } else {
    appendCentralLink(parent, text(item.button_text) || "Learn more", text(item.button_url || item.url), onNavigate);
  }
}

function highlightCard(candidate, actions, {today = false} = {}) {
  const {type, title, item} = candidate;
  const article = element("article", `highlight-card highlight-${type} card`);
  applyNavlabAnalyticsAttributes(article, navlabAnalyticsMetadata(type, item));
  article.dataset.sourceKey = candidate.key;
  const isEvent = type === "events" || type === "registrations";
  if (isEvent) article.classList.add("event-card");
  const artwork = isEvent ? createEventMedia(item, {kind: today ? "Today" : HIGHLIGHT_TYPES[type].label}) : element("div", "highlight-artwork");
  if (!isEvent) artwork.append(stepArtwork(HIGHLIGHT_TYPES[type].icon), element("p", "highlight-kind", HIGHLIGHT_TYPES[type].label));
  const body = element("div", "card-body");
  const meta = isEvent ? eventLocationMeta(item) : type === "serveNeeds" ? text(item.ministry) :
    type === "campaigns" ? "Church-wide focus" : text(item.date) || text(item.status_label) || "Sign up at CrossPointe";
  if (meta) body.append(element("p", "live-meta", meta));
  body.append(element("h3", "", title));
  if (!today && text(item.description)) body.append(element("p", "highlight-summary", text(item.description)));
  const links = element("div", "step-actions");
  appendSourceAction(links, type, item, actions);
  if (links.childElementCount) body.append(links);
  article.append(artwork, body);
  return article;
}

function renderHighlights(root, data, showDetails, onNavigate, interests) {
  const highlights = scheduledHighlights(data);
  const previous = root.querySelector(".home-highlights");
  const signature = JSON.stringify(highlights);
  if (previous?.dataset.highlights === signature) return;
  const content = section("At CrossPointe", "Find your next connection", "", "home_highlights");
  content.node.classList.add("home-highlights");
  content.node.dataset.highlights = signature;
  content.node.hidden = highlights.length === 0;
  content.grid.classList.add("highlights-grid");
  content.grid.append(...highlights.map((candidate) =>
    highlightCard(candidate, {showDetails, onNavigate, interests})));
  if (previous) previous.replaceWith(content.node);
  else root.append(content.node);
}

function renderNextSteps(root, data, onNavigate, interests) {
  root.replaceChildren();
  const sections = [
    ["nextSteps", "Take Your Next Step", "Get connected", "arrow"],
    ["campaigns", "Current Campaigns", "Church-wide focus", "people"],
    ["serveNeeds", "Serve Opportunities", "Make a difference", "heart"],
    ["resources", "Resources", "Keep growing", "book"],
  ];
  const config = Array.isArray(data.settings?.homepage_modules) ? data.settings.homepage_modules : [];
  const analyticsSections = {nextSteps: "next_step", campaigns: "current_campaigns", serveNeeds: "serve_needs", resources: "resources"};
  for (const [id, title, eyebrow, defaultIcon] of sections) {
    const setting = config.find((entry) => entry.id === id);
    if (setting?.enabled === false || setting?.enabled === "false") continue;
    const items = Array.isArray(data[id]) ? data[id] : [];
    if (!items.length) continue;
    const content = section(title, eyebrow, "", analyticsSections[id]);
    content.node.classList.add("steps-section");
    content.node.id = {nextSteps: "next-step", campaigns: "current-campaigns", serveNeeds: "serve-needs", resources: "resources"}[id] || "";
    for (const item of items) {
      const name = text(item.need || item.title);
      const article = element("article", "step-card card");
      applyNavlabAnalyticsAttributes(article, navlabAnalyticsMetadata(id, item));
      const icon = id === "nextSteps" ? (/bapti/i.test(name) ? "water" : /group/i.test(name) ? "people" : /foundation/i.test(name) ? "book" : defaultIcon) : defaultIcon;
      const body = element("div", "card-body");
      body.append(stepArtwork(icon));
      if (id === "serveNeeds" && text(item.ministry)) body.append(element("p", "step-ministry", text(item.ministry)));
      body.append(element("h3", "", name || title));
      if (text(item.description)) body.append(element("p", "live-description", text(item.description)));
      const actions = element("div", "step-actions");
      if (id === "serveNeeds" || id === "campaigns") {
        appendSourceAction(actions, id, item, {onNavigate, interests});
      } else if (id === "nextSteps" && /^join a pointe group$/i.test(name)) {
        appendCentralLink(actions, text(item.button_text) || "Explore groups", "#groups", onNavigate);
      } else {
        appendCentralLink(actions, text(item.button_text) || "Learn more", text(item.button_url || item.url), onNavigate);
      }
      if (actions.childElementCount) body.append(actions);
      article.append(body);
      content.grid.append(article);
    }
    root.append(content.node);
  }
  if (!root.childElementCount) renderStatus(root, "New ways to connect, serve, and grow will be posted here soon.");
}

export function todayEventItems(data, now = Date.now()) {
  const config = Array.isArray(data?.settings?.homepage_modules) ? data.settings.homepage_modules : [];
  const setting = config.find((entry) => entry.id === "today");
  if (setting?.enabled === false || setting?.enabled === "false") return [];
  // Use Central's Today projection, which already uses the church's timezone.
  // Match the existing homepage: remove started events, retaining legacy items
  // without a usable timestamp rather than parsing their formatted time labels.
  return (Array.isArray(data?.today) ? data.today : []).filter((item) => {
    if (!item || !text(item.title) || item.active === false || text(item.active).toLowerCase() === "false") return false;
    const startsAt = Date.parse(text(item.starts_at));
    return !Number.isFinite(startsAt) || startsAt > now;
  });
}

function renderEvents(root, data, showDetails) {
  root.replaceChildren();
  window.clearInterval(todayRefreshTimer);
  const today = section("Today at CrossPointe", "Happening today", "", "today_at_crosspointe");
  today.node.classList.add("today-section");
  today.node.id = "today-at-crosspointe";
  let previousToday;
  const refreshToday = () => {
    const items = todayEventItems(data);
    if (previousToday && items.length === previousToday.length && items.every((item, index) => item === previousToday[index])) return;
    previousToday = items;
    today.node.hidden = !items.length;
    today.grid.replaceChildren(...items.map((item) => highlightCard({
      key: `events:${text(item.planning_center_instance_id || item.id)}`,
      type: "events", title: text(item.title), item,
    }, {showDetails}, {today: true})));
  };
  refreshToday();
  root.append(today.node);
  todayRefreshTimer = window.setInterval(refreshToday, 60_000);
  const upcoming = section("Upcoming events & registrations", "Plan ahead", "", "upcoming_events");
  upcoming.node.id = "upcoming-events";
  const events = [...(Array.isArray(data && data.events) ? data.events : []).map((item) => ({...item, labKind: "events"})), ...(Array.isArray(data && data.registrations) ? data.registrations : []).map((item) => ({...item, labKind: "registrations"}))];
  const tools = element("div", "live-event-tools");
  const chips = element("div", "chips");
  const grid = upcoming.grid;
  const count = element("p", "live-meta");
  count.setAttribute("role", "status");
  const render = (kind) => {
    const matching = events.filter((item) => kind === "all" || item.labKind === kind);
    count.textContent = `${matching.length} ${kind === "registrations" ? "registrations" : "listings"}`;
    grid.replaceChildren(...matching.map((item) => card(item, {onDetails: showDetails, event: true})));
    if (!matching.length) grid.append(element("p", "live-status card", "Nothing is listed here right now. Check back soon."));
  };
  [["all", "All events"], ["events", "Events"], ["registrations", "Registrations"]].forEach(([kind, label], index) => {
    const button = element("button", "", label); button.type = "button"; button.setAttribute("aria-pressed", String(index === 0));
    button.dataset.eventFilter = kind;
    button.addEventListener("click", () => { chips.querySelectorAll("button").forEach((node) => node.setAttribute("aria-pressed", String(node === button))); render(kind); });
    chips.append(button);
  });
  tools.append(chips); upcoming.node.insertBefore(tools, grid); upcoming.node.insertBefore(count, grid);
  root.append(upcoming.node); render("all");
}

// onData is a stream callback: it receives the initial payload and every valid
// polling refresh so schedule-driven Sunday Mode can change without remounting.
export async function mountCentralContent({endpoint = DEFAULT_ENDPOINT, onNavigate = () => {}, onWatch = () => {}, onData = () => {}} = {}) {
  const home = document.getElementById("home-content");
  const events = document.getElementById("events-content");
  const nextSteps = document.getElementById("next-steps-content");
  const sundayHome = document.getElementById("sunday-home-content");
  if (!home || !events || !nextSteps) throw new Error("Nav Lab content roots are missing.");
  const interests = createInterestDialogController();
  stopHighlightRefresh();
  const load = async () => {
    stopHighlightRefresh();
    renderStatus(home, "Loading Central…");
    renderStatus(events, "Loading Central…");
    renderStatus(nextSteps, "Loading next steps…");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {headers: {Accept: "application/json"}, cache: "no-store", signal: controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(text(data.error) || `Central returned ${response.status}.`);
      if (!data || typeof data.settings !== "object") throw new Error("Unsupported Central response.");
      const showDetails = createDialogController(endpoint, calendarIntegrationsEnabled(data));
      renderHome(home, data, showDetails, onNavigate, interests);
      renderEvents(events, data, showDetails);
      renderNextSteps(nextSteps, data, onNavigate, interests);
      if (sundayHome) renderSundayHome(sundayHome, data, showDetails, onNavigate, onWatch, interests);
      onData(data);
      let latest = data;
      let refreshTimer;
      let stopped = false;
      let refreshing = false;
      let pendingController;
      const paintHighlights = () => {
        renderHighlights(home, latest, showDetails, onNavigate, interests);
        if (sundayHome) renderHighlights(sundayHome, latest, showDetails, onNavigate, interests);
      };
      const scheduleRefresh = () => {
        window.clearTimeout(refreshTimer);
        const deadlines = (latest.homeHighlights || []).map((item) => Date.parse(item.endsAt))
          .filter((end) => end > Date.now());
        const delay = Math.min(60_000, ...deadlines.map((end) => end - Date.now() + 25));
        refreshTimer = window.setTimeout(refreshHighlights, delay);
      };
      const refreshHighlights = async () => {
        if (stopped || refreshing) return;
        paintHighlights(); // Expired placements disappear even if the network fails.
        if (document.hidden) {scheduleRefresh(); return;}
        refreshing = true;
        pendingController = new AbortController();
        const timeout = window.setTimeout(() => pendingController.abort(), REQUEST_TIMEOUT_MS);
        try {
          const result = await fetch(endpoint, {headers: {Accept: "application/json"},
            cache: "no-store", signal: pendingController.signal});
          if (!result.ok) throw new Error("Highlight refresh failed.");
          const fresh = await result.json();
          if (!stopped && fresh && typeof fresh.settings === "object") {
            latest = fresh;
            paintHighlights();
            onData(fresh);
          }
        } catch (_) {
          // Preserve still-valid cards; the next refresh retries without a page reset.
        } finally {
          window.clearTimeout(timeout);
          refreshing = false;
          if (!stopped) scheduleRefresh();
        }
      };
      const onVisible = () => {if (!document.hidden) refreshHighlights();};
      document.addEventListener("visibilitychange", onVisible);
      stopHighlightRefresh = () => {
        stopped = true;
        pendingController?.abort();
        window.clearTimeout(refreshTimer);
        document.removeEventListener("visibilitychange", onVisible);
      };
      scheduleRefresh();
      return data;
    } catch (error) {
      const message = error && error.name === "AbortError" ? "Central took too long to respond." : "Central content could not load right now.";
      renderStatus(home, message, load);
      renderStatus(events, message, load);
      renderStatus(nextSteps, message, load);
      if (sundayHome) renderStatus(sundayHome, message, load);
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  };
  return load();
}
