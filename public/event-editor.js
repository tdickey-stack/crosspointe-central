(function() {
  "use strict";

  var PUBLISH_ENDPOINT = "/api/admin/publish-preview-content";
  var SUBMIT_ENDPOINT = "/api/admin/submit-change-request";
  var editorPreviousFocus = null;
  var savedNoticeTimer = null;

  function escapeHtml_(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function getIdToken_() {
    var ready = window.CENTRAL_FIREBASE_AUTH_READY || Promise.resolve();
    return ready.then(function() {
      var user = window.firebase && window.firebase.auth &&
        window.firebase.auth().currentUser;
      if (!user) throw new Error("Sign in to Central Admin before editing events.");
      return user.getIdToken();
    });
  }

  function parseResponse_(response) {
    return response.text().then(function(text) {
      var payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (error) {
      }
      if (!response.ok) {
        throw new Error(payload.error || "The event change could not be saved.");
      }
      return payload;
    });
  }

  function close_() {
    var root = document.getElementById("central-event-editor");
    if (root) root.remove();
    document.body.classList.remove("event-editor-open");
    if (editorPreviousFocus && typeof editorPreviousFocus.focus === "function") {
      editorPreviousFocus.focus();
    }
    editorPreviousFocus = null;
  }

  function showSavedNotice_(permission) {
    var existing = document.getElementById("central-event-save-notice");
    if (existing) existing.remove();
    if (savedNoticeTimer) window.clearTimeout(savedNoticeTimer);

    var submitted = permission === "propose";
    var notice = document.createElement("div");
    notice.id = "central-event-save-notice";
    notice.className = "event-override-save-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = [
      "<strong>",
      submitted ? "Change submitted" : "Changes saved",
      "</strong>",
      "<span>",
      submitted ?
        "After approval, please allow up to 2 minutes for the changes to appear across Central." :
        "Please allow up to 2 minutes for the changes to appear across Central.",
      "</span>",
    ].join("");
    document.body.appendChild(notice);
    window.setTimeout(function() {
      notice.classList.add("is-visible");
    }, 10);
    savedNoticeTimer = window.setTimeout(function() {
      notice.classList.remove("is-visible");
      window.setTimeout(function() {
        if (notice.parentNode) notice.remove();
      }, 240);
    }, 8000);
  }

  function buildPayload_(form, item) {
    var fields = ["title", "location", "description"].filter(function(field) {
      var checkbox = form.querySelector('[name="override_' + field + '"]');
      return checkbox && checkbox.checked;
    });
    var scope = String(form.elements.scope.value || "instance");
    return {
      action: "upsert",
      item: {
        scope: scope,
        planning_center_event_id: String(
            item.planning_center_event_id || "",
        ),
        planning_center_instance_id: String(
            item.planning_center_instance_id || item.id || "",
        ),
        overridden_fields: fields,
        title: String(form.elements.title.value || "").trim(),
        location: String(form.elements.location.value || "").trim(),
        description: String(form.elements.description.value || "").trim(),
        active: true,
      },
    };
  }

  function send_(permission, payload) {
    var endpoint = permission === "propose" ? SUBMIT_ENDPOINT : PUBLISH_ENDPOINT;
    return getIdToken_().then(function(idToken) {
      return fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + idToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          section: "events",
          operation: "publish",
          payload: payload,
        }),
      });
    }).then(parseResponse_);
  }

  function open_(item, options) {
    if (!item) return;
    close_();
    var config = options || {};
    var permission = String(config.permission || "view");
    var canEdit = ["propose", "edit", "approve", "admin"].indexOf(
        permission,
    ) !== -1;
    var overriddenFields = Array.isArray(item.overridden_fields) ?
      item.overridden_fields : [];
    var root = document.createElement("div");
    editorPreviousFocus = document.activeElement;
    root.id = "central-event-editor";
    root.className = "event-override-editor";
    root.innerHTML = [
      "<div class=\"event-override-backdrop\" data-event-editor-close></div>",
      "<section class=\"event-override-panel\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"event-override-title\">",
      "<header><div><span>Central Event Details</span>",
      "<h2 id=\"event-override-title\">", escapeHtml_(item.title || "Event"),
      "</h2><p>", escapeHtml_([item.date, item.time].filter(Boolean).join(" • ")),
      "</p></div><button type=\"button\" class=\"event-override-close\"",
      " aria-label=\"Close event editor\" data-event-editor-close>&times;</button></header>",
      "<form><div class=\"event-override-source-note\"><strong>Date and time are locked.</strong>",
      "<span>Planning Center remains the source of truth for the schedule and recurrence.</span></div>",
      "<label class=\"event-override-scope\"><span>Apply changes to</span><select name=\"scope\"",
      canEdit ? "" : " disabled", ">",
      "<option value=\"instance\"", item.override_scope !== "series" ? " selected" : "",
      ">This occurrence only</option>",
      "<option value=\"series\"", item.override_scope === "series" ? " selected" : "",
      ">All upcoming occurrences</option></select></label>",
      renderField_("title", "Name", item.title, item.planning_center_title,
          overriddenFields, canEdit, false),
      renderField_("location", "Displayed room / location", item.location,
          item.planning_center_location, overriddenFields, canEdit, false),
      renderField_("description", "Description", item.description,
          item.planning_center_description, overriddenFields, canEdit, true),
      "<p class=\"event-override-message\" role=\"status\"></p>",
      "<footer>",
      item.override_id && canEdit ?
        "<div class=\"event-override-danger-actions\">" +
          "<button type=\"button\" class=\"btn btn-danger event-override-reset\">" +
            "Reset to Planning Center" +
          "</button>" +
        "</div>" :
        "",
      "<div class=\"event-override-primary-actions\">",
      "<button type=\"button\" class=\"btn btn-secondary\"",
      " data-event-editor-close>Cancel</button>",
      canEdit ? "<button type=\"submit\" class=\"btn btn-primary\">" +
          (permission === "propose" ? "Submit for Approval" : "Save & Publish") +
        "</button>" : "",
      "</div>",
      "</footer></form></section>",
    ].join("");
    document.body.appendChild(root);
    document.body.classList.add("event-editor-open");

    root.querySelectorAll("[data-event-editor-close]").forEach(function(button) {
      button.addEventListener("click", close_);
    });
    var form = root.querySelector("form");
    if (form && canEdit) {
      form.addEventListener("submit", function(event) {
        event.preventDefault();
        var message = form.querySelector(".event-override-message");
        var buttons = form.querySelectorAll("button, input, textarea, select");
        var payload = buildPayload_(form, item);
        if (!payload.item.overridden_fields.length) {
          message.textContent = "Choose at least one field to override.";
          return;
        }
        buttons.forEach(function(control) {
          control.disabled = true;
        });
        message.textContent = permission === "propose" ?
          "Submitting event changes..." : "Publishing event changes...";
        send_(permission, payload).then(function(result) {
          message.classList.add("is-success");
          message.textContent = permission === "propose" ?
            "Change submitted for approval." :
            "Changes saved.";
          showSavedNotice_(permission);
          if (typeof config.onSaved === "function") config.onSaved(result);
          window.setTimeout(close_, 900);
        }).catch(function(error) {
          buttons.forEach(function(control) {
            control.disabled = false;
          });
          message.classList.remove("is-success");
          message.textContent = error.message;
        });
      });
      var reset = form.querySelector(".event-override-reset");
      if (reset) {
        reset.addEventListener("click", function() {
          var message = form.querySelector(".event-override-message");
          message.textContent = "Resetting event details...";
          send_(permission, {
            action: "delete",
            item: {
              id: item.override_id,
              scope: item.override_scope || "instance",
              planning_center_event_id: item.planning_center_event_id,
              planning_center_instance_id:
                item.planning_center_instance_id || item.id,
            },
          }).then(function(result) {
            message.classList.add("is-success");
            message.textContent = permission === "propose" ?
              "Reset submitted for approval." :
              "Changes saved.";
            showSavedNotice_(permission);
            if (typeof config.onSaved === "function") config.onSaved(result);
            window.setTimeout(close_, 900);
          }).catch(function(error) {
            message.classList.remove("is-success");
            message.textContent = error.message;
          });
        });
      }
    }
    var firstInput = root.querySelector("input:not([disabled]), select:not([disabled])");
    if (firstInput) firstInput.focus();
  }

  function renderField_(
      name,
      label,
      value,
      sourceValue,
      overriddenFields,
      canEdit,
      textarea,
  ) {
    var checked = overriddenFields.indexOf(name) !== -1;
    return [
      "<div class=\"event-override-field\">",
      "<label class=\"event-override-toggle\"><input type=\"checkbox\" name=\"override_",
      name, "\"", checked ? " checked" : "", canEdit ? "" : " disabled",
      "><span>Override ", escapeHtml_(label), "</span></label>",
      "<label><span>", escapeHtml_(label), "</span>",
      textarea ? "<textarea name=\"" + name + "\" rows=\"7\"" +
        (canEdit ? "" : " disabled") + ">" + escapeHtml_(value || "") +
        "</textarea>" :
        "<input name=\"" + name + "\" value=\"" +
        escapeHtml_(value || "") + "\"" + (canEdit ? "" : " disabled") + ">",
      "<small>Planning Center: ", escapeHtml_(sourceValue || "Not provided"),
      "</small></label></div>",
    ].join("");
  }

  window.CentralEventEditor = {
    open: open_,
    close: close_,
  };
}());
