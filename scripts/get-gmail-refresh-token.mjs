#!/usr/bin/env node

import crypto from "node:crypto";
import http from "node:http";
import process from "node:process";

const clientId = String(process.env.CENTRAL_GMAIL_CLIENT_ID || "").trim();
const clientSecret = String(
    process.env.CENTRAL_GMAIL_CLIENT_SECRET || "",
).trim();
const senderEmail = String(
    process.env.CENTRAL_GMAIL_SENDER_EMAIL || "central@crosspointe.tv",
).trim();
const scope = String(
    process.env.CENTRAL_GMAIL_SCOPE ||
    "https://www.googleapis.com/auth/gmail.send",
).trim();
const port = normalizePort_(process.env.CENTRAL_GMAIL_OAUTH_PORT, 8787);
const redirectUri = "http://127.0.0.1:" + port + "/oauth2/callback";
const state = crypto.randomBytes(24).toString("hex");
const skipStateCheck = String(
    process.env.CENTRAL_GMAIL_SKIP_STATE_CHECK || "",
).trim().toLowerCase() === "true";

if (!clientId || !clientSecret) {
  console.error(
      "Missing CENTRAL_GMAIL_CLIENT_ID or CENTRAL_GMAIL_CLIENT_SECRET.",
  );
  console.error(
      "Run this script with those env vars set to your Gmail API OAuth client.",
  );
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("response_mode", "query");
authUrl.searchParams.set("scope", scope);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);
if (senderEmail) {
  authUrl.searchParams.set("login_hint", senderEmail);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(
      request.url || "/",
      "http://127.0.0.1:" + port,
  );

  if (requestUrl.pathname !== "/oauth2/callback") {
    response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
    response.end("Not found.");
    return;
  }

  const callbackState = String(requestUrl.searchParams.get("state") || "");
  const code = String(requestUrl.searchParams.get("code") || "");
  const error = String(requestUrl.searchParams.get("error") || "");
  const callbackUrlForLogs = requestUrl.toString();

  if (error) {
    response.writeHead(400, {"Content-Type": "text/html; charset=utf-8"});
    response.end(buildHtmlPage_(
        "Authorization failed",
        "Google returned: " + escapeHtml_(error),
    ));
    console.error("Google authorization failed:", error);
    shutdown_(1);
    return;
  }

  if (!skipStateCheck && callbackState !== state) {
    response.writeHead(400, {"Content-Type": "text/html; charset=utf-8"});
    response.end(buildHtmlPage_(
        "State mismatch",
        "The returned OAuth state did not match this request.",
    ));
    console.error("OAuth state mismatch.");
    console.error("Expected state:", state);
    console.error("Received state:", callbackState || "(empty)");
    shutdown_(1);
    return;
  }

  if (!code) {
    response.writeHead(400, {"Content-Type": "text/html; charset=utf-8"});
    response.end(buildHtmlPage_(
        "Missing code",
        "Google did not return an authorization code yet. " +
        "Return to the printed Google authorization URL and try again.",
    ));
    console.error("No authorization code was returned.");
    console.error("Callback URL:", callbackUrlForLogs);
    console.error(
        "If this was a stale or manual localhost visit, leave the helper " +
        "running and use the printed Google authorization URL again.",
    );
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenBody = await safeReadJson_(tokenResponse);

    if (!tokenResponse.ok) {
      throw new Error(
          "Token exchange failed (" +
          tokenResponse.status +
          "): " +
          String(
              tokenBody.error_description ||
              tokenBody.error ||
              tokenResponse.statusText ||
              "Unknown error.",
          ),
      );
    }

    const refreshToken = String(tokenBody.refresh_token || "").trim();
    const accessToken = String(tokenBody.access_token || "").trim();

    if (!refreshToken) {
      throw new Error(
          "Google did not return a refresh token. Revoke the app in " +
          "https://myaccount.google.com/permissions and run the flow again.",
      );
    }

    response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    response.end(buildHtmlPage_(
        "Refresh token generated",
        "You can close this tab and return to Codex.",
    ));

    console.log("");
    console.log("Refresh token generated successfully.");
    console.log("");
    console.log("Add these to functions/.env and your FIREBASE_FUNCTIONS_ENV secret:");
    console.log("");
    console.log("CENTRAL_GMAIL_CLIENT_ID=" + clientId);
    console.log("CENTRAL_GMAIL_CLIENT_SECRET=<your-client-secret>");
    console.log("CENTRAL_GMAIL_REFRESH_TOKEN=" + refreshToken);
    console.log("CENTRAL_GMAIL_SENDER_EMAIL=" + senderEmail);
    console.log("");
    console.log("Access token preview (not needed long-term):");
    console.log(accessToken);
    shutdown_(0);
  } catch (exchangeError) {
    response.writeHead(500, {"Content-Type": "text/html; charset=utf-8"});
    response.end(buildHtmlPage_(
        "Token exchange failed",
        escapeHtml_(String(exchangeError.message || exchangeError)),
    ));
    console.error(String(exchangeError && exchangeError.message || exchangeError));
    shutdown_(1);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("");
  console.log("Central Gmail token helper is listening on " + redirectUri);
  console.log("");
  console.log("Before you continue, add this exact redirect URI to your OAuth client:");
  console.log(redirectUri);
  console.log("");
  if (skipStateCheck) {
    console.log("State validation is disabled for this run.");
    console.log("");
  }
  console.log("Then open this URL in your browser and sign in as " + senderEmail + ":");
  console.log(authUrl.toString());
  console.log("");
});

function normalizePort_(value, fallback) {
  const numeric = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 65535) {
    return fallback;
  }
  return numeric;
}

function buildHtmlPage_(title, message) {
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>",
    escapeHtml_(title),
    "</title></head>",
    "<body style=\"font-family:Arial,Helvetica,sans-serif;padding:32px;\">",
    "<h1 style=\"font-size:24px;\">",
    escapeHtml_(title),
    "</h1>",
    "<p style=\"font-size:16px;line-height:1.5;\">",
    escapeHtml_(message),
    "</p>",
    "</body></html>",
  ].join("");
}

function escapeHtml_(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[character];
  });
}

async function safeReadJson_(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function shutdown_(code) {
  server.close(() => {
    process.exit(code);
  });

  setTimeout(() => {
    process.exit(code);
  }, 250).unref();
}
