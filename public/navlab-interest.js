const CAMPAIGN_ENDPOINT = "/api/campaigns/share-interest";
const SERVE_NEED_ENDPOINT = "/api/serve-needs/share-interest";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value) {
  return String(value ?? "").trim();
}

function bounded(value, maximum, label) {
  const normalized = text(value);
  if (normalized.length > maximum) throw new Error(`${label} is too long.`);
  return normalized;
}

export function normalizeInterestItem(kind, item) {
  const source = item && typeof item === "object" ? item : {};
  const id = text(source.id);
  if (!id || id.length > 160) return null;

  if (kind === "campaign") {
    if (text(source.action_type).toLowerCase() !== "contact") return null;
    return {
      kind,
      id,
      title: text(source.title) || "Campaign",
      description: text(source.description),
      buttonText: text(source.button_text) || "Get More Info",
    };
  }

  if (kind === "serveNeed") {
    return {
      kind,
      id,
      title: text(source.need || source.title) || "Serve Opportunity",
      description: text(source.description),
      ministry: text(source.ministry),
      priority: text(source.priority || source.urgency).toLowerCase(),
      buttonText: text(source.button_text) || "Share my interest",
    };
  }

  return null;
}

export function buildInterestSubmission(kind, item, values) {
  const subject = normalizeInterestItem(kind, item);
  if (!subject) throw new Error("That opportunity is not available right now. Refresh Central and try again.");

  const source = values && typeof values === "object" ? values : {};
  const name = bounded(source.name, 120, "Name");
  const email = bounded(source.email, 254, "Email").toLowerCase();
  const phone = bounded(source.phone, 40, "Phone");
  if (!name) throw new Error("Enter your name before submitting.");
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address before submitting.");

  if (kind === "campaign") {
    return {
      campaignId: subject.id,
      name,
      email,
      phone,
      message: bounded(source.message, 2000, "Message"),
    };
  }

  const preferredContactMethod = text(source.preferredContactMethod).toLowerCase();
  if (preferredContactMethod !== "email" && preferredContactMethod !== "text") {
    throw new Error("Choose Email or Text as your preferred contact method.");
  }
  if (preferredContactMethod === "text" && !phone) {
    throw new Error("Add a phone number if you prefer to be contacted by text.");
  }

  return {
    serveNeedId: subject.id,
    name,
    email,
    phone,
    preferredContactMethod,
    additionalNotes: bounded(source.additionalNotes, 2000, "Additional notes"),
  };
}

export async function submitInterestRequest(kind, item, values, fetchImpl = fetch) {
  const endpoint = kind === "campaign" ? CAMPAIGN_ENDPOINT :
    kind === "serveNeed" ? SERVE_NEED_ENDPOINT : "";
  if (!endpoint) throw new Error("That opportunity is not available right now.");
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json", Accept: "application/json"},
    body: JSON.stringify(buildInterestSubmission(kind, item, values)),
  });
  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(text(payload.error) || (kind === "campaign" ?
      "We could not send your message right now." :
      "We could not submit your interest right now."));
  }
  return payload;
}

function ensureStyles(documentRef) {
  if (documentRef.querySelector("link[data-navlab-interest-styles]")) return;
  const link = documentRef.createElement("link");
  link.rel = "stylesheet";
  link.href = "/navlab-interest.css?v=1";
  link.dataset.navlabInterestStyles = "true";
  documentRef.head.append(link);
}

function node(documentRef, tag, className, value) {
  const result = documentRef.createElement(tag);
  if (className) result.className = className;
  if (value != null) result.textContent = value;
  return result;
}

function field(documentRef, labelText, input) {
  const label = node(documentRef, "label", "navlab-interest-field");
  label.append(node(documentRef, "span", "", labelText), input);
  return label;
}

function input(documentRef, type, name, options = {}) {
  const control = documentRef.createElement("input");
  control.type = type;
  control.name = name;
  if (options.required) control.required = true;
  if (options.maxLength) control.maxLength = options.maxLength;
  if (options.autocomplete) control.autocomplete = options.autocomplete;
  return control;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function successMessage(kind, subject, payload, values) {
  if (kind === "campaign") {
    return `Your message about ${subject.title} was sent. A member of our team will be reaching out to give you more information.`;
  }
  const need = text(payload.need) || subject.title;
  const ministry = text(payload.ministry) || subject.ministry;
  const contactMethod = values.preferredContactMethod === "text" ? "text" : "email";
  return `Thanks for sharing your interest in ${need}${ministry ? ` with ${ministry}` : ""}. A ministry leader will be reaching out to you by ${contactMethod} to talk more about your volunteer interest.`;
}

export function createInterestDialogController({
  documentRef = document,
  fetchImpl = fetch,
} = {}) {
  ensureStyles(documentRef);
  let dialog = null;

  const close = () => {
    if (!dialog) return;
    const activeDialog = dialog;
    dialog = null;
    if (activeDialog.open) activeDialog.close();
    else activeDialog.remove();
  };

  const open = (kind, item, sourceFocus) => {
    const subject = normalizeInterestItem(kind, item);
    if (!subject) return false;
    close();
    const previousFocus = sourceFocus || documentRef.activeElement;
    const modal = node(documentRef, "dialog", "navlab-interest-dialog");
    dialog = modal;
    const titleId = `navlab-interest-${kind}-title`;
    const descriptionId = `navlab-interest-${kind}-description`;
    modal.setAttribute("aria-labelledby", titleId);
    modal.setAttribute("aria-describedby", descriptionId);

    const closeButton = node(documentRef, "button", "navlab-interest-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close interest form");
    closeButton.addEventListener("click", close);

    const content = node(documentRef, "div", "navlab-interest-content");
    const renderForm = () => {
      content.replaceChildren();
      content.append(node(documentRef, "p", "navlab-interest-kicker",
          kind === "campaign" ? "Campaign" : "Serve Opportunity"));
      if (kind === "serveNeed" && (subject.ministry || subject.priority)) {
        const priority = subject.priority ? `${subject.priority[0].toUpperCase()}${subject.priority.slice(1)} priority` : "";
        content.append(node(documentRef, "p", "navlab-interest-meta",
            [subject.ministry, priority].filter(Boolean).join(" · ")));
      }
      const heading = node(documentRef, "h2", "navlab-interest-title", subject.title);
      heading.id = titleId;
      content.append(heading);
      const description = node(documentRef, "p", "navlab-interest-copy",
          subject.description || (kind === "campaign" ?
            "Send a message and a member of our team will follow up with more information." :
            "Share your contact information and a ministry leader will help you take the next step."));
      description.id = descriptionId;
      content.append(description);

      const form = node(documentRef, "form", "navlab-interest-form");
      form.noValidate = false;
      const name = input(documentRef, "text", "name", {required: true, maxLength: 120, autocomplete: "name"});
      const email = input(documentRef, "email", "email", {required: true, maxLength: 254, autocomplete: "email"});
      const phone = input(documentRef, "tel", "phone", {maxLength: 40, autocomplete: "tel"});
      form.append(field(documentRef, "Name", name), field(documentRef, "Email", email), field(documentRef, "Phone", phone));

      if (kind === "campaign") {
        const message = documentRef.createElement("textarea");
        message.name = "message";
        message.rows = 4;
        message.maxLength = 2000;
        message.placeholder = "What would you like to know?";
        const wrapper = field(documentRef, "Message", message);
        wrapper.classList.add("is-wide");
        form.append(wrapper);
      } else {
        const select = documentRef.createElement("select");
        select.name = "preferredContactMethod";
        select.required = true;
        [["email", "Email"], ["text", "Text"]].forEach(([value, label]) => {
          const option = node(documentRef, "option", "", label);
          option.value = value;
          select.append(option);
        });
        form.append(field(documentRef, "Preferred contact method", select));
        const notes = documentRef.createElement("textarea");
        notes.name = "additionalNotes";
        notes.rows = 4;
        notes.maxLength = 2000;
        notes.placeholder = "Anything you’d like the ministry leader to know?";
        const wrapper = field(documentRef, "Additional notes", notes);
        wrapper.classList.add("is-wide");
        form.append(wrapper);
      }

      const error = node(documentRef, "p", "navlab-interest-error");
      error.hidden = true;
      error.tabIndex = -1;
      error.setAttribute("role", "alert");
      const actions = node(documentRef, "div", "navlab-interest-actions");
      const submit = node(documentRef, "button", "button", kind === "campaign" ? subject.buttonText : "Share my interest");
      submit.type = "submit";
      actions.append(submit);
      form.append(error, actions);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = formValues(form);
        error.hidden = true;
        error.textContent = "";
        submit.disabled = true;
        form.setAttribute("aria-busy", "true");
        submit.textContent = kind === "campaign" ? "Sending…" : "Sharing…";
        try {
          const payload = await submitInterestRequest(kind, item, values, fetchImpl);
          const success = node(documentRef, "div", "navlab-interest-success");
          success.setAttribute("role", "status");
          success.append(node(documentRef, "p", "navlab-interest-kicker", "Thank You"));
          const successTitle = node(documentRef, "h2", "navlab-interest-title",
              kind === "campaign" ? "Message Sent" : "Interest Shared");
          successTitle.tabIndex = -1;
          success.append(successTitle, node(documentRef, "p", "navlab-interest-copy",
              successMessage(kind, subject, payload, values)));
          const successActions = node(documentRef, "div", "navlab-interest-actions");
          const done = node(documentRef, "button", "button", "Close");
          done.type = "button";
          done.addEventListener("click", close);
          successActions.append(done);
          success.append(successActions);
          content.replaceChildren(success);
          successTitle.focus({preventScroll: true});
        } catch (requestError) {
          error.textContent = requestError && requestError.message ? requestError.message :
            "We could not submit this form right now.";
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = kind === "campaign" ? subject.buttonText : "Share my interest";
          form.removeAttribute("aria-busy");
          error.focus?.({preventScroll: true});
        }
      });
      content.append(form);
      window.requestAnimationFrame(() => name.focus({preventScroll: true}));
    };

    modal.append(closeButton, content);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener("close", () => {
      modal.remove();
      if (dialog === modal) dialog = null;
      previousFocus?.focus?.({preventScroll: true});
    }, {once: true});
    documentRef.body.append(modal);
    renderForm();
    modal.showModal();
    return true;
  };

  return {
    close,
    openCampaign(item, sourceFocus) { return open("campaign", item, sourceFocus); },
    openServeNeed(item, sourceFocus) { return open("serveNeed", item, sourceFocus); },
  };
}
