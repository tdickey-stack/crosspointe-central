const DEFAULT_ENDPOINT = "https://central.crosspointe.tv/api/central-data";
const REQUEST_TIMEOUT_MS = 30_000;

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

function safeImageUrl(value) {
  const url = safeHttpUrl(value);
  return /^https:/i.test(url) ? url : "";
}

function safeCalendarUrl(value, endpoint) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("/")) return safeHttpUrl(new URL(raw, endpoint).href);
  return safeHttpUrl(raw);
}

function appendLink(parent, label, url, secondary = false) {
  if (!url) return;
  const link = element("a", `button${secondary ? " secondary" : ""}`, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  parent.append(link);
}

function appendCentralLink(parent, label, raw, onNavigate, secondary = true) {
  const destination = {"#upcoming-events": "events", "#registrations": "events", "#groups": "groups", "#next-step": "next-steps", "#resources": "next-steps", "#serve-needs": "next-steps"}[text(raw)] ||
    (/^https:\/\/(www\.)?crosspointe\.tv\/small-groups\/?$/.test(text(raw)) ? "groups" : "");
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

function metaFor(item) {
  const date = text(item.date) || (text(item.close_date) ? `Registration closes on ${text(item.close_date)}` : "");
  return [date, text(item.time), text(item.location || item.venue)]
      .filter(Boolean).join(" · ");
}

function card(item, {detailsLabel = "Learn more", onDetails} = {}) {
  const article = element("article", "live-card card");
  const body = element("div", "card-body");
  if (text(item.status_label)) body.append(element("p", "eyebrow", text(item.status_label)));
  const meta = metaFor(item);
  if (meta) body.append(element("p", "live-meta", meta));
  body.append(element("h3", "", text(item.title) || "CrossPointe"));
  if (!onDetails && text(item.description)) body.append(element("p", "live-description", text(item.description)));
  if (onDetails) {
    const button = element("button", "button secondary", detailsLabel);
    button.type = "button";
    button.addEventListener("click", () => onDetails(item, button));
    body.append(button);
  }
  article.append(body);
  return article;
}

function section(title, eyebrow, gridClass = "") {
  const node = element("section", `live-section${gridClass ? ` ${gridClass}` : ""}`);
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

function createDialogController(endpoint) {
  const dialog = document.getElementById("detail-dialog");
  const title = document.getElementById("detail-title");
  const kicker = document.getElementById("detail-kicker");
  const meta = document.getElementById("detail-meta");
  const copy = document.getElementById("detail-copy");
  const links = document.getElementById("detail-links");

  return (item, sourceFocus) => {
    if (!dialog || !title || !kicker || !meta || !copy) return;
    title.textContent = text(item.title) || "CrossPointe Event";
    kicker.textContent = item.source === "Planning Center Registrations" ?
      "Registration" : "Event";
    meta.textContent = metaFor(item);
    copy.textContent = text(item.description) || "More details will be posted here as they become available.";
    if (links) {
      links.replaceChildren();
      appendLink(links, text(item.registration_button_text) || "Register", safeHttpUrl(item.registration_url));
      appendLink(links, "View event", safeHttpUrl(item.church_center_url || item.button_url), true);
      appendLink(links, "Google Calendar", safeHttpUrl(item.calendar_url), true);
      appendLink(links, "Download calendar", safeCalendarUrl(item.calendar_file_url, endpoint), true);
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
  if (root.id === "home-content") {
    const heading = element("h1", "page-heading", "CrossPointe Central");
    heading.id = "home-title";
    heading.tabIndex = -1;
    root.append(heading);
  }
  root.append(status);
}

function renderHome(root, data, showDetails, onNavigate) {
  const settings = data && data.settings || {};
  const sunday = data && data.sunday || {};
  const modules = new Map();
  const enabled = (value) => value === true || ["true", "1", "yes", "on"].includes(text(value).toLowerCase());
  root.replaceChildren();

  const hero = element("section", "live-hero");
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

  const featured = data && data.featuredEvent;
  if (enabled(settings.featured_event_enabled) && featured && isFutureEvent(featured) && text(featured.title)) {
    const featuredCard = element("article", "live-featured card");
    const imageUrl = safeImageUrl(featured.image_url);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "eager";
      image.addEventListener("error", () => image.remove(), {once: true});
      featuredCard.append(image);
    }
    const body = element("div", "card-body");
    body.append(element("p", "eyebrow", "Featured event"), element("h2", "", text(featured.title)));
    if (metaFor(featured)) body.append(element("p", "live-meta", metaFor(featured)));
    const details = element("button", "button", "View event");
    details.type = "button";
    details.addEventListener("click", () => showDetails(featured, details));
    const featuredActions = element("div", "hero-actions");
    appendLink(featuredActions, text(featured.registration_button_text) || "Register", safeHttpUrl(featured.registration_url));
    details.classList.add("secondary");
    featuredActions.append(details);
    body.append(featuredActions);
    featuredCard.append(body);
    hero.append(featuredCard);
  }
  root.append(hero);

  if (data && data.banner && text(data.banner.message || data.banner.text || data.banner.title)) {
    const banner = element("aside", "live-banner card");
    if (text(data.banner.title)) banner.append(element("h2", "", text(data.banner.title)));
    if (text(data.banner.message)) banner.append(element("p", "", text(data.banner.message)));
    appendCentralLink(banner, text(data.banner.button_text) || "Learn more", data.banner.button_url, onNavigate, false);
    modules.set("statusBanner", banner);
  }
  if (text(sunday.date) || text(sunday.sermon_title) || text(sunday.note)) {
    const sundaySection = section("This Sunday", "Worship + Word", "two");
    const sundayCard = card({title: sunday.sermon_title || "Sunday Worship", description: sunday.note, location: sunday.speaker ? `With ${sunday.speaker}` : "", time: sunday.scripture || ""});
    const sundayBody = sundayCard.querySelector(".card-body");
    sundayBody.prepend(element("p", "eyebrow", text(sunday.date)));
    if (text(sunday.series)) sundayBody.append(element("p", "live-description", text(sunday.series)));
    sundaySection.grid.append(sundayCard);
    const setlist = Array.isArray(data.setlist) ? data.setlist : [];
    if (setlist.length) {
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
      setlistCard.append(setlistBody); sundaySection.grid.append(setlistCard);
    }
    modules.set("sunday", sundaySection.node);
  }
  const quickLinks = Array.isArray(data && data.quickLinks) ? data.quickLinks : [];
  if (quickLinks.length) {
    const content = section("Quick links", "Fast access");
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

// Decorative artwork stays local; card content and destinations come from Central.
function stepArtwork(kind) {
  const paths = {
    water: "M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z M8 15a4 4 0 0 0 4 4",
    people: "M3 21v-3a6 6 0 0 1 12 0v3 M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 5a3 3 0 0 1 0 6 M18 15a5 5 0 0 1 3 5",
    book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z M12 5v15 M6 8h3 M15 8h3",
    heart: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 1 10 8 15 7-5 13-10 8-15Z",
    arrow: "M4 20h5v-5h5v-5h6 M14 4h6v6",
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

function renderNextSteps(root, data, onNavigate) {
  root.replaceChildren();
  const sections = [
    ["nextSteps", "Take Your Next Step", "Get connected", "arrow"],
    ["serveNeeds", "Serve Opportunities", "Make a difference", "heart"],
    ["resources", "Resources", "Keep growing", "book"],
  ];
  const config = Array.isArray(data.settings?.homepage_modules) ? data.settings.homepage_modules : [];
  for (const [id, title, eyebrow, defaultIcon] of sections) {
    const setting = config.find((entry) => entry.id === id);
    if (setting?.enabled === false || setting?.enabled === "false") continue;
    const items = Array.isArray(data[id]) ? data[id] : [];
    if (!items.length) continue;
    const content = section(title, eyebrow);
    content.node.classList.add("steps-section");
    for (const item of items) {
      const name = text(item.need || item.title);
      const article = element("article", "step-card card");
      const icon = id === "nextSteps" ? (/bapti/i.test(name) ? "water" : /group/i.test(name) ? "people" : /foundation/i.test(name) ? "book" : defaultIcon) : defaultIcon;
      const body = element("div", "card-body");
      body.append(stepArtwork(icon));
      if (id === "serveNeeds" && text(item.ministry)) body.append(element("p", "step-ministry", text(item.ministry)));
      body.append(element("h3", "", name || title));
      if (text(item.description)) body.append(element("p", "live-description", text(item.description)));
      const actions = element("div", "step-actions");
      if (id === "serveNeeds") {
        appendLink(actions, "View opportunity on Central", "https://central.crosspointe.tv/#serve-needs", true);
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

function renderEvents(root, data, showDetails) {
  root.replaceChildren();
  const events = [...(Array.isArray(data && data.events) ? data.events : []).map((item) => ({...item, labKind: "events"})), ...(Array.isArray(data && data.registrations) ? data.registrations : []).map((item) => ({...item, labKind: "registrations"}))];
  const tools = element("div", "live-event-tools");
  const chips = element("div", "chips");
  const grid = element("div", "live-grid");
  const count = element("p", "live-meta");
  count.setAttribute("role", "status");
  const render = (kind) => {
    const matching = events.filter((item) => kind === "all" || item.labKind === kind);
    count.textContent = `${matching.length} ${kind === "registrations" ? "registrations" : "listings"}`;
    grid.replaceChildren(...matching.map((item) => card(item, {onDetails: showDetails})));
    if (!matching.length) grid.append(element("p", "live-status card", "Nothing is listed here right now. Check back soon."));
  };
  [["all", "All events"], ["events", "Events"], ["registrations", "Registrations"]].forEach(([kind, label], index) => {
    const button = element("button", "", label); button.type = "button"; button.setAttribute("aria-pressed", String(index === 0));
    button.addEventListener("click", () => { chips.querySelectorAll("button").forEach((node) => node.setAttribute("aria-pressed", String(node === button))); render(kind); });
    chips.append(button);
  });
  tools.append(chips); root.append(tools, count, grid); render("all");
}

export async function mountCentralContent({endpoint = DEFAULT_ENDPOINT, onNavigate = () => {}} = {}) {
  const home = document.getElementById("home-content");
  const events = document.getElementById("events-content");
  const nextSteps = document.getElementById("next-steps-content");
  if (!home || !events || !nextSteps) throw new Error("Nav Lab content roots are missing.");
  const load = async () => {
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
      const showDetails = createDialogController(endpoint);
      renderHome(home, data, showDetails, onNavigate);
      renderEvents(events, data, showDetails);
      renderNextSteps(nextSteps, data, onNavigate);
      return data;
    } catch (error) {
      const message = error && error.name === "AbortError" ? "Central took too long to respond." : "Central content could not load right now.";
      renderStatus(home, message, load);
      renderStatus(events, message, load);
      renderStatus(nextSteps, message, load);
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  };
  return load();
}
