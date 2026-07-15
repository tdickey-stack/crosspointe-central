(function() {
  "use strict";

  if (window.CENTRAL_BOOT_MODE === "admin") return;

  var PUBLIC_CHAT_ENDPOINT = "/api/wayfinder/chat";
  var ALPHA_ACCESS_ENDPOINT = "/api/wayfinder/access";
  var PUBLIC_FEEDBACK_ENDPOINT = "/api/wayfinder/feedback";
  var NOTICE_ENDPOINT = "/api/admin/wayfinder/notices";
  var KNOWLEDGE_ENDPOINT = "/api/admin/wayfinder/knowledge-changes";
  var wayfinderChatState = {
    open: false,
    busy: false,
    adminMode: false,
    adminUpdateType: "temporary",
    sessionId: createSessionId_(),
    messages: [],
    conversationHistory: [],
    messageCounter: 0,
    authPromise: null,
    permission: "none",
  };
  var chatRoot = null;
  var chatPanel = null;
  var chatLauncher = null;
  var chatMessages = null;
  var chatInput = null;
  var mobileViewportFrame = 0;

  document.addEventListener("DOMContentLoaded", initializeWayfinderAlpha_);

  function initializeWayfinderAlpha_() {
    wayfinderChatState.authPromise = initializePublicFirebaseAuth_();
    wayfinderChatState.authPromise.then(function(user) {
      if (!user) return null;
      return user.getIdToken().then(function(idToken) {
        return fetch(ALPHA_ACCESS_ENDPOINT, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + idToken,
          },
        });
      }).then(parseWayfinderResponse_);
    }).then(function(access) {
      if (!access || access.enabled !== true || access.canUse !== true) return;
      wayfinderChatState.permission = String(access.permission || "none");
      mountWayfinderChat_();
    }).catch(function() {
      // During alpha, ineligible and signed-out visitors should not see Wayfinder.
    });
  }

  function mountWayfinderChat_() {
    chatRoot = document.createElement("div");
    chatRoot.className = "wayfinder-chat-root";
    chatRoot.innerHTML = [
      "<button type=\"button\" class=\"wayfinder-chat-launcher\" aria-label=\"Open Wayfinder\" aria-expanded=\"false\">",
      "<img src=\"/loader-icon.svg\" alt=\"\">",
      "<span class=\"wayfinder-chat-launcher-label\">Ask Wayfinder</span>",
      "</button>",
      "<section class=\"wayfinder-chat-panel\" role=\"dialog\" aria-modal=\"false\" aria-label=\"Wayfinder chat\" hidden>",
      "<header class=\"wayfinder-chat-header\">",
      "<div class=\"wayfinder-chat-identity\"><img src=\"/loader-icon.svg\" alt=\"\"><div>",
      "<strong>Wayfinder</strong><span>CrossPointe’s AI assistant</span>",
      "</div></div>",
      "<button type=\"button\" class=\"wayfinder-chat-close\" aria-label=\"Close Wayfinder\">&times;</button>",
      "</header>",
      "<div class=\"wayfinder-chat-admin-bar\" hidden>",
      "<span>Admin Update Mode</span>",
      "<div role=\"group\" aria-label=\"Wayfinder update type\">",
      "<button type=\"button\" data-wayfinder-chat-mode=\"temporary\" class=\"is-active\">Temporary</button>",
      "<button type=\"button\" data-wayfinder-chat-mode=\"permanent\">Permanent</button>",
      "</div></div>",
      "<div class=\"wayfinder-chat-messages\" role=\"log\" aria-live=\"polite\" aria-relevant=\"additions\"></div>",
      "<form class=\"wayfinder-chat-composer\">",
      "<label class=\"sr-only\" for=\"wayfinder-chat-input\">Message Wayfinder</label>",
      "<textarea id=\"wayfinder-chat-input\" rows=\"1\" maxlength=\"500\" placeholder=\"Ask Wayfinder a question…\"></textarea>",
      "<button type=\"submit\" class=\"wayfinder-chat-send\" aria-label=\"Send message\"><span aria-hidden=\"true\">↑</span></button>",
      "</form>",
      "<p class=\"wayfinder-chat-disclaimer\">Wayfinder uses approved public CrossPointe information. Don’t share sensitive personal information.</p>",
      "</section>",
    ].join("");
    document.body.appendChild(chatRoot);

    chatPanel = chatRoot.querySelector(".wayfinder-chat-panel");
    chatLauncher = chatRoot.querySelector(".wayfinder-chat-launcher");
    chatMessages = chatRoot.querySelector(".wayfinder-chat-messages");
    chatInput = chatRoot.querySelector("#wayfinder-chat-input");

    chatLauncher.addEventListener("click", openWayfinderChat_);
    chatRoot.querySelector(".wayfinder-chat-close")
        .addEventListener("click", closeWayfinderChat_);
    chatRoot.querySelector(".wayfinder-chat-composer")
        .addEventListener("submit", function(event) {
          event.preventDefault();
          sendWayfinderMessage_();
        });
    chatInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendWayfinderMessage_();
      }
    });
    chatInput.addEventListener("input", resizeWayfinderInput_);
    chatInput.addEventListener("focus", scheduleMobileViewportSync_);
    chatInput.addEventListener("blur", scheduleMobileViewportSync_);
    chatRoot.addEventListener("click", handleWayfinderChatAction_);
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && wayfinderChatState.open) {
        closeWayfinderChat_();
      }
    });
    window.addEventListener("resize", scheduleMobileViewportSync_);
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
          "resize",
          scheduleMobileViewportSync_,
      );
      window.visualViewport.addEventListener(
          "scroll",
          scheduleMobileViewportSync_,
      );
    }

    addTextMessage_(
        "assistant",
        "Hello! I’m Wayfinder, CrossPointe’s virtual AI information " +
          "assistant. What can I help you find?",
    );
  }

  function openWayfinderChat_() {
    wayfinderChatState.open = true;
    chatPanel.hidden = false;
    chatRoot.classList.add("is-open");
    document.body.classList.add("wayfinder-chat-open");
    chatLauncher.setAttribute("aria-expanded", "true");
    syncMobileViewport_();
    window.setTimeout(function() {
      if (!isMobileWayfinderLayout_()) chatInput.focus();
      syncMobileViewport_();
      scrollWayfinderMessages_();
    }, 80);
  }

  function closeWayfinderChat_() {
    wayfinderChatState.open = false;
    chatPanel.hidden = true;
    chatRoot.classList.remove("is-open");
    document.body.classList.remove("wayfinder-chat-open");
    chatLauncher.setAttribute("aria-expanded", "false");
    clearMobileViewport_();
    chatLauncher.focus();
  }

  function sendWayfinderMessage_() {
    var question = String(chatInput.value || "").trim();
    if (!question || wayfinderChatState.busy) return;
    addTextMessage_("user", question);
    chatInput.value = "";
    resizeWayfinderInput_();
    setWayfinderBusy_(true);

    var normalized = question.toLowerCase();
    var task;
    if (normalized === "alohomora") {
      task = enterPublicWayfinderAdminMode_();
    } else if (normalized === "colloportus") {
      task = exitPublicWayfinderAdminMode_();
    } else if (wayfinderChatState.adminMode) {
      task = createPublicWayfinderUpdate_(question);
    } else {
      task = callPublicWayfinder_({
        question: question,
        history: wayfinderChatState.conversationHistory.slice(),
      }).then(function(result) {
        var answer = String(
            result.answer || "I’m sorry, but I couldn’t answer that.",
        );
        var followUpQuestion = String(result.followUpQuestion || "");
        addTextMessage_(
            "assistant",
            answer,
            "",
            result.links,
            {
              responseId: String(result.responseId || ""),
              question: question,
              answer: answer,
            },
        );
        if (followUpQuestion) {
          addTextMessage_("assistant", followUpQuestion, "follow-up");
        }
        rememberConversationTurn_(question, answer, followUpQuestion);
      });
    }

    task.catch(function(error) {
      addTextMessage_(
          "assistant",
          error && error.message ? error.message :
            "I’m sorry, but Wayfinder is unavailable right now.",
          "error",
      );
    }).finally(function() {
      setWayfinderBusy_(false);
      chatInput.focus();
    });
  }

  function enterPublicWayfinderAdminMode_() {
    if (wayfinderChatState.permission !== "admin") {
      return Promise.reject(new Error(
          "Your Wayfinder access does not include Admin Update Mode.",
      ));
    }
    return callAuthenticatedWayfinder_(NOTICE_ENDPOINT, {action: "enter"})
        .then(function(result) {
          wayfinderChatState.adminMode = result.modeActive === true;
          wayfinderChatState.adminUpdateType = "temporary";
          syncAdminModeUi_();
          addTextMessage_("assistant", String(result.message ||
            "Admin Update Mode is active."), "admin");
          return loadPublicWayfinderManagerSummary_();
        });
  }

  function exitPublicWayfinderAdminMode_() {
    return callAuthenticatedWayfinder_(NOTICE_ENDPOINT, {action: "exit"})
        .then(function(result) {
          wayfinderChatState.adminMode = false;
          syncAdminModeUi_();
          addTextMessage_("assistant", String(result.message ||
            "Admin Update Mode is closed."), "admin");
        });
  }

  function createPublicWayfinderUpdate_(instruction) {
    if (wayfinderChatState.adminUpdateType === "permanent") {
      return callAuthenticatedWayfinder_(KNOWLEDGE_ENDPOINT, {
        action: "draft",
        instruction: instruction,
      }).then(function(result) {
        if (result.draft) {
          addStructuredMessage_("knowledge-draft", result.draft);
        } else {
          addTextMessage_("assistant", String(result.message ||
            "I need more information before preparing that change."), "admin");
        }
      });
    }
    return callAuthenticatedWayfinder_(NOTICE_ENDPOINT, {
      action: "draft",
      instruction: instruction,
    }).then(function(result) {
      if (result.draft) {
        addStructuredMessage_("notice-draft", result.draft);
      } else {
        addTextMessage_("assistant", String(result.message ||
          "I need more information before preparing that notice."), "admin");
      }
    });
  }

  function loadPublicWayfinderManagerSummary_() {
    return Promise.all([
      callAuthenticatedWayfinder_(NOTICE_ENDPOINT, {action: "list"}),
      callAuthenticatedWayfinder_(KNOWLEDGE_ENDPOINT, {action: "list"}),
    ]).then(function(results) {
      addStructuredMessage_("admin-summary", {
        notices: Array.isArray(results[0].notices) ? results[0].notices : [],
        overrides: Array.isArray(results[1].overrides) ?
          results[1].overrides : [],
      });
    });
  }

  function handleWayfinderChatAction_(event) {
    var ratingButton = event.target.closest(
        "[data-wayfinder-feedback-rating]",
    );
    if (ratingButton) {
      handleWayfinderFeedbackRating_(
          ratingButton.getAttribute("data-message-id") || "",
          ratingButton.getAttribute("data-wayfinder-feedback-rating") || "",
      );
      return;
    }
    var feedbackSubmitButton = event.target.closest(
        "[data-wayfinder-feedback-submit]",
    );
    if (feedbackSubmitButton) {
      submitWayfinderNeedsWorkFeedback_(
          feedbackSubmitButton.getAttribute("data-message-id") || "",
          feedbackSubmitButton,
      );
      return;
    }
    var modeButton = event.target.closest("[data-wayfinder-chat-mode]");
    if (modeButton) {
      wayfinderChatState.adminUpdateType =
        modeButton.getAttribute("data-wayfinder-chat-mode") === "permanent" ?
          "permanent" : "temporary";
      syncAdminModeUi_();
      chatInput.focus();
      return;
    }
    var actionButton = event.target.closest("[data-wayfinder-chat-action]");
    if (!actionButton || wayfinderChatState.busy) return;
    var action = actionButton.getAttribute("data-wayfinder-chat-action");
    var draftId = actionButton.getAttribute("data-draft-id") || "";
    var messageId = actionButton.getAttribute("data-message-id") || "";
    var endpoint = action.indexOf("knowledge") !== -1 ?
      KNOWLEDGE_ENDPOINT : NOTICE_ENDPOINT;
    var payload = {
      action: action.indexOf("publish") === 0 ? "publish" : "cancel",
      draftId: draftId,
    };
    setWayfinderBusy_(true);
    callAuthenticatedWayfinder_(endpoint, payload).then(function(result) {
      removeMessage_(messageId);
      addTextMessage_("assistant", String(result.message ||
        "The Wayfinder update was completed."), "admin");
      return loadPublicWayfinderManagerSummary_();
    }).catch(function(error) {
      addTextMessage_("assistant", error && error.message ? error.message :
        "That update could not be completed.", "error");
    }).finally(function() {
      setWayfinderBusy_(false);
    });
  }

  function callPublicWayfinder_(payload) {
    return getCurrentAdminIdToken_().then(function(idToken) {
      return fetch(PUBLIC_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer " + idToken,
          "X-Wayfinder-Session": wayfinderChatState.sessionId,
        },
        body: JSON.stringify(payload || {}),
      });
    }).then(parseWayfinderResponse_);
  }

  function handleWayfinderFeedbackRating_(messageId, rating) {
    var message = findWayfinderMessage_(messageId);
    var feedback = message && message.data && message.data.feedback;
    if (!feedback || feedback.status === "pending" ||
      feedback.status === "submitted") return;

    if (rating === "helpful") {
      submitWayfinderFeedback_(message, "helpful", "", "");
      return;
    }
    feedback.expanded = true;
    feedback.error = "";
    renderWayfinderMessages_();
  }

  function submitWayfinderNeedsWorkFeedback_(messageId, button) {
    var message = findWayfinderMessage_(messageId);
    if (!message) return;
    var details = button.closest(".wayfinder-chat-feedback-details");
    var reason = details ? String(
        details.querySelector("select").value || "",
    ) : "";
    var note = details ? String(
        details.querySelector("textarea").value || "",
    ).trim() : "";
    if (!reason) {
      message.data.feedback.error = "Choose what Wayfinder should improve.";
      renderWayfinderMessages_();
      return;
    }
    submitWayfinderFeedback_(message, "needs_work", reason, note);
  }

  function submitWayfinderFeedback_(message, rating, reason, note) {
    var data = message.data || {};
    var feedback = data.feedback || {};
    feedback.status = "pending";
    feedback.error = "";
    renderWayfinderMessages_();

    getCurrentAdminIdToken_().then(function(idToken) {
      return fetch(PUBLIC_FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer " + idToken,
          "X-Wayfinder-Session": wayfinderChatState.sessionId,
        },
        body: JSON.stringify({
          responseId: feedback.responseId,
          question: feedback.question,
          answer: feedback.answer,
          rating: rating,
          reason: reason,
          note: note,
          links: data.links || [],
        }),
      });
    }).then(parseWayfinderResponse_).then(function(result) {
      feedback.status = "submitted";
      feedback.rating = rating;
      feedback.message = String(result.message || "Thanks for the feedback!");
      renderWayfinderMessages_();
    }).catch(function(error) {
      feedback.status = "error";
      feedback.error = error && error.message ? error.message :
        "That feedback could not be saved.";
      renderWayfinderMessages_();
    });
  }

  function findWayfinderMessage_(messageId) {
    return wayfinderChatState.messages.find(function(message) {
      return message.id === messageId;
    }) || null;
  }

  function rememberConversationTurn_(question, answer, followUpQuestion) {
    var assistantMessage = [answer, followUpQuestion]
        .map(function(value) {
          return String(value || "").trim();
        })
        .filter(Boolean)
        .join("\n\n");
    wayfinderChatState.conversationHistory.push({
      role: "user",
      content: String(question || "").trim().slice(0, 500),
    }, {
      role: "assistant",
      content: assistantMessage.slice(0, 1800),
    });
    wayfinderChatState.conversationHistory =
      wayfinderChatState.conversationHistory.slice(-8);
  }

  function callAuthenticatedWayfinder_(endpoint, payload) {
    return getCurrentAdminIdToken_().then(function(idToken) {
      return fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + idToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload || {}),
      });
    }).then(parseWayfinderResponse_);
  }

  function parseWayfinderResponse_(response) {
    return response.text().then(function(text) {
      var payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (error) {
      }
      if (!response.ok) {
        throw new Error(payload.error || "Wayfinder could not complete that request.");
      }
      return payload;
    });
  }

  function initializePublicFirebaseAuth_() {
    var ready = window.CENTRAL_FIREBASE_AUTH_READY || Promise.resolve(null);
    return ready.then(function() {
      if (!window.firebase || !window.firebase.auth) return null;
      var auth = window.firebase.auth();
      if (shouldUseWayfinderEmulators_()) {
        var hostname = String(window.location.hostname || "127.0.0.1");
        try {
          auth.useEmulator("http://" + hostname + ":9099");
        } catch (error) {
        }
      }
      return new Promise(function(resolve) {
        var settled = false;
        var unsubscribe = auth.onAuthStateChanged(function(user) {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(user || null);
        });
        window.setTimeout(function() {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(auth.currentUser || null);
        }, 2500);
      });
    });
  }

  function getCurrentAdminIdToken_() {
    return (wayfinderChatState.authPromise || initializePublicFirebaseAuth_())
        .then(function(user) {
          var currentUser = user || window.firebase &&
            window.firebase.auth().currentUser;
          if (!currentUser) {
            throw new Error(
                "I couldn’t verify an active Central Admin session. Sign in " +
                  "to Central Admin in this browser, then try Alohomora again.",
            );
          }
          return currentUser.getIdToken();
        });
  }

  function shouldUseWayfinderEmulators_() {
    var params = new URLSearchParams(window.location.search);
    return params.get("emulators") === "1" ||
      ["localhost", "127.0.0.1", "[::1]"].indexOf(
          window.location.hostname,
      ) !== -1;
  }

  function addTextMessage_(role, text, tone, links, feedback) {
    addStructuredMessage_("text", {
      role: role,
      text: String(text || ""),
      tone: String(tone || ""),
      links: Array.isArray(links) ? links : [],
      feedback: feedback && feedback.responseId ? {
        responseId: String(feedback.responseId),
        question: String(feedback.question || "").slice(0, 500),
        answer: String(feedback.answer || "").slice(0, 1800),
        expanded: false,
        status: "idle",
        rating: "",
        message: "",
        error: "",
      } : null,
    });
  }

  function addStructuredMessage_(kind, data) {
    wayfinderChatState.messageCounter += 1;
    wayfinderChatState.messages.push({
      id: "wayfinder-message-" + wayfinderChatState.messageCounter,
      kind: kind,
      data: data || {},
    });
    renderWayfinderMessages_();
  }

  function removeMessage_(messageId) {
    wayfinderChatState.messages = wayfinderChatState.messages.filter(
        function(message) {
          return message.id !== messageId;
        },
    );
    renderWayfinderMessages_();
  }

  function renderWayfinderMessages_() {
    if (!chatMessages) return;
    chatMessages.innerHTML = wayfinderChatState.messages.map(function(message) {
      if (message.kind === "notice-draft") {
        return renderNoticeDraft_(message);
      }
      if (message.kind === "knowledge-draft") {
        return renderKnowledgeDraft_(message);
      }
      if (message.kind === "admin-summary") {
        return renderAdminSummary_(message);
      }
      return renderTextMessage_(message);
    }).join("") + (wayfinderChatState.busy ? renderTypingMessage_() : "");
    scrollWayfinderMessages_();
  }

  function renderTextMessage_(message) {
    var data = message.data || {};
    var role = data.role === "user" ? "user" : "assistant";
    return [
      "<article class=\"wayfinder-chat-message is-", role,
      data.tone ? " is-" + escapeAttr_(data.tone) : "", "\">",
      role === "assistant" ?
        "<img src=\"/loader-icon.svg\" alt=\"\">" : "",
      "<div>", renderParagraphs_(data.text),
      renderWayfinderActionLinks_(data.links),
      renderWayfinderFeedback_(message), "</div></article>",
    ].join("");
  }

  function renderWayfinderFeedback_(message) {
    var feedback = message.data && message.data.feedback;
    if (!feedback) return "";
    if (feedback.status === "submitted") {
      return [
        "<div class=\"wayfinder-chat-feedback is-submitted\">",
        "<span>", escapeHtml_(feedback.message), "</span></div>",
      ].join("");
    }
    var pending = feedback.status === "pending";
    return [
      "<div class=\"wayfinder-chat-feedback\">",
      "<span>Was this helpful?</span>",
      "<div class=\"wayfinder-chat-feedback-buttons\">",
      "<button type=\"button\" data-wayfinder-feedback-rating=\"helpful\" data-message-id=\"",
      escapeAttr_(message.id), "\"", pending ? " disabled" : "",
      ">👍 Yes</button>",
      "<button type=\"button\" data-wayfinder-feedback-rating=\"needs_work\" data-message-id=\"",
      escapeAttr_(message.id), "\"", pending ? " disabled" : "",
      ">👎 Needs work</button>",
      "</div>",
      feedback.expanded ? renderWayfinderFeedbackDetails_(message, pending) : "",
      feedback.error ? "<p class=\"wayfinder-chat-feedback-error\">" +
        escapeHtml_(feedback.error) + "</p>" : "",
      "</div>",
    ].join("");
  }

  function renderWayfinderFeedbackDetails_(message, pending) {
    return [
      "<div class=\"wayfinder-chat-feedback-details\">",
      "<label>What needs improvement?<select",
      pending ? " disabled" : "", ">",
      "<option value=\"\">Choose one</option>",
      "<option value=\"incorrect\">The answer is incorrect</option>",
      "<option value=\"missing_information\">Important information is missing</option>",
      "<option value=\"outdated\">The information is outdated</option>",
      "<option value=\"too_long\">Too long or not conversational</option>",
      "<option value=\"wrong_link\">The link is wrong or missing</option>",
      "<option value=\"other\">Something else</option>",
      "</select></label>",
      "<label>Optional note<textarea maxlength=\"500\" rows=\"2\" placeholder=\"Tell us what would have been better\"",
      pending ? " disabled" : "", "></textarea></label>",
      "<button type=\"button\" data-wayfinder-feedback-submit data-message-id=\"",
      escapeAttr_(message.id), "\"", pending ? " disabled" : "",
      ">", pending ? "Saving..." : "Send feedback", "</button>",
      "</div>",
    ].join("");
  }

  function renderWayfinderActionLinks_(links) {
    var safeLinks = (Array.isArray(links) ? links : []).slice(0, 6)
        .map(function(link) {
          var label = String(link && link.label || "Learn more").trim();
          var url = getSafeWayfinderActionUrl_(link && link.url);
          return label && url ? {label: label, url: url} : null;
        })
        .filter(Boolean);
    if (!safeLinks.length) return "";
    return [
      "<div class=\"wayfinder-chat-action-links\">",
      safeLinks.map(function(link) {
        return "<a href=\"" + escapeAttr_(link.url) +
          "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          escapeHtml_(link.label) + "</a>";
      }).join(""),
      "</div>",
    ].join("");
  }

  function getSafeWayfinderActionUrl_(value) {
    try {
      var url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.toString() : "";
    } catch (error) {
      return "";
    }
  }

  function renderNoticeDraft_(message) {
    var draft = message.data || {};
    return [
      "<article class=\"wayfinder-chat-message is-assistant is-admin\">",
      "<img src=\"/loader-icon.svg\" alt=\"\"><div class=\"wayfinder-chat-card\">",
      "<span>Temporary notice preview</span><strong>",
      escapeHtml_(draft.title), "</strong><p>",
      escapeHtml_(draft.publicMessage), "</p>",
      "<dl><div><dt>Starts</dt><dd>", formatDateTime_(draft.startsAt),
      "</dd></div><div><dt>Expires</dt><dd>",
      formatDateTime_(draft.expiresAt), "</dd></div></dl>",
      renderDraftActions_(message.id, draft.id, "notice"),
      "</div></article>",
    ].join("");
  }

  function renderKnowledgeDraft_(message) {
    var draft = message.data || {};
    var before = draft.beforeEntry || {};
    var after = draft.replacementEntry || {};
    return [
      "<article class=\"wayfinder-chat-message is-assistant is-admin\">",
      "<img src=\"/loader-icon.svg\" alt=\"\"><div class=\"wayfinder-chat-card\">",
      "<span>Permanent change preview</span><strong>",
      escapeHtml_(draft.changeSummary), "</strong>",
      "<details><summary>Review current and proposed facts</summary>",
      "<h5>Current</h5>", renderFactList_(before),
      "<h5>Proposed</h5>", renderFactList_(after), "</details>",
      renderDraftActions_(message.id, draft.id, "knowledge"),
      "</div></article>",
    ].join("");
  }

  function renderAdminSummary_(message) {
    var data = message.data || {};
    var notices = (data.notices || []).filter(function(notice) {
      return notice.status === "active" || notice.status === "scheduled";
    });
    var overrides = (data.overrides || []).filter(function(item) {
      return item.active === true;
    });
    return [
      "<article class=\"wayfinder-chat-message is-assistant is-admin\">",
      "<img src=\"/loader-icon.svg\" alt=\"\"><div class=\"wayfinder-chat-card\">",
      "<span>Stored Wayfinder updates</span>",
      "<p><strong>", String(notices.length), "</strong> active or scheduled notice",
      notices.length === 1 ? "" : "s", " and <strong>",
      String(overrides.length), "</strong> permanent override",
      overrides.length === 1 ? "" : "s", ".</p>",
      notices.length ? "<ul>" + notices.slice(0, 4).map(function(notice) {
        return "<li>" + escapeHtml_(notice.title) + "</li>";
      }).join("") + "</ul>" : "",
      "</div></article>",
    ].join("");
  }

  function renderDraftActions_(messageId, draftId, kind) {
    return [
      "<div class=\"wayfinder-chat-card-actions\">",
      "<button type=\"button\" data-wayfinder-chat-action=\"publish-", kind,
      "\" data-message-id=\"", escapeAttr_(messageId),
      "\" data-draft-id=\"", escapeAttr_(draftId), "\">",
      kind === "knowledge" ? "Approve permanent change" : "Publish notice",
      "</button>",
      "<button type=\"button\" class=\"is-secondary\" data-wayfinder-chat-action=\"cancel-",
      kind, "\" data-message-id=\"", escapeAttr_(messageId),
      "\" data-draft-id=\"", escapeAttr_(draftId), "\">Cancel</button>",
      "</div>",
    ].join("");
  }

  function renderFactList_(entry) {
    var facts = [];
    if (Array.isArray(entry.requiredFacts)) facts = facts.concat(entry.requiredFacts);
    if (Array.isArray(entry.allowedPublicFacts)) {
      facts = facts.concat(entry.allowedPublicFacts);
    }
    return facts.length ? "<ul>" + facts.map(function(fact) {
      return "<li>" + escapeHtml_(fact) + "</li>";
    }).join("") + "</ul>" : "<p>No public facts listed.</p>";
  }

  function renderTypingMessage_() {
    return [
      "<article class=\"wayfinder-chat-message is-assistant is-typing\">",
      "<img src=\"/loader-icon.svg\" alt=\"\"><div>",
      "<span></span><span></span><span></span></div></article>",
    ].join("");
  }

  function renderParagraphs_(value) {
    return String(value || "").split(/\n+/).map(function(paragraph) {
      return paragraph.trim();
    }).filter(Boolean).map(function(paragraph) {
      return "<p>" + escapeHtml_(paragraph) + "</p>";
    }).join("");
  }

  function setWayfinderBusy_(busy) {
    wayfinderChatState.busy = busy === true;
    chatInput.disabled = wayfinderChatState.busy;
    chatRoot.querySelector(".wayfinder-chat-send").disabled =
      wayfinderChatState.busy;
    renderWayfinderMessages_();
  }

  function syncAdminModeUi_() {
    var adminBar = chatRoot.querySelector(".wayfinder-chat-admin-bar");
    adminBar.hidden = !wayfinderChatState.adminMode;
    chatRoot.classList.toggle("is-admin-mode", wayfinderChatState.adminMode);
    adminBar.querySelectorAll("[data-wayfinder-chat-mode]")
        .forEach(function(button) {
          button.classList.toggle(
              "is-active",
              button.getAttribute("data-wayfinder-chat-mode") ===
                wayfinderChatState.adminUpdateType,
          );
        });
    chatInput.placeholder = wayfinderChatState.adminMode ?
      wayfinderChatState.adminUpdateType === "permanent" ?
        "Describe a permanent knowledge change…" :
        "Describe a temporary notice…" :
      "Ask Wayfinder a question…";
  }

  function resizeWayfinderInput_() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 116) + "px";
  }

  function scrollWayfinderMessages_() {
    window.requestAnimationFrame(function() {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function isMobileWayfinderLayout_() {
    return window.matchMedia &&
      window.matchMedia("(max-width: 640px)").matches;
  }

  function scheduleMobileViewportSync_() {
    if (mobileViewportFrame) {
      window.cancelAnimationFrame(mobileViewportFrame);
    }
    mobileViewportFrame = window.requestAnimationFrame(function() {
      mobileViewportFrame = 0;
      syncMobileViewport_();
      if (chatInput && document.activeElement === chatInput &&
        isMobileWayfinderLayout_()) {
        scrollWayfinderMessages_();
      }
    });
  }

  function syncMobileViewport_() {
    if (!chatRoot || !wayfinderChatState.open ||
      !isMobileWayfinderLayout_() || !window.visualViewport) {
      clearMobileViewport_();
      return;
    }
    chatRoot.style.setProperty(
        "--wayfinder-viewport-top",
        Math.max(0, Math.round(window.visualViewport.offsetTop)) + "px",
    );
    chatRoot.style.setProperty(
        "--wayfinder-viewport-height",
        Math.max(1, Math.round(window.visualViewport.height)) + "px",
    );
  }

  function clearMobileViewport_() {
    if (!chatRoot) return;
    chatRoot.style.removeProperty("--wayfinder-viewport-top");
    chatRoot.style.removeProperty("--wayfinder-viewport-height");
  }

  function formatDateTime_(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not set";
    return escapeHtml_(date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }));
  }

  function createSessionId_() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "wayfinder-" + Date.now() + "-" +
      Math.random().toString(36).slice(2);
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
}());
