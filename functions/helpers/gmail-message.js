import crypto from "node:crypto";
import {
  buildCentralMailboxHeader_,
  encodeMimeHeaderValue_,
  splitMimeBase64Lines_,
} from "./helpers.js";

/**
 * Builds a base64url Gmail message with only populated body alternatives.
 * @param {Object} options Message headers, bodies, and optional attachments.
 * @return {string} Encoded MIME message for the Gmail API.
 */
export function buildCentralGmailRawMessage_(options) {
  const config = options && typeof options === "object" ? options : {};
  const attachments = Array.isArray(config.attachments) ?
    config.attachments.filter((attachment) => {
      return attachment && attachment.base64 && attachment.filename;
    }) :
    [];
  const alternativeBoundary =
    "central-alt-" + crypto.randomBytes(12).toString("hex");
  const mixedBoundary = attachments.length ?
    "central-mixed-" + crypto.randomBytes(12).toString("hex") :
    "";
  const messageSubtype = attachments.length ? "mixed" : "alternative";
  const messageBoundary = attachments.length ?
    mixedBoundary :
    alternativeBoundary;
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
    "Content-Type: multipart/" + messageSubtype +
      "; boundary=\"" + messageBoundary + "\"",
  ].filter(Boolean);
  // Clients prefer the last supported alternative. An empty HTML part would
  // hide a valid plain-text notification, so only include populated formats.
  const bodyFormats = [
    ["text/plain", String(config.text || "")],
    ["text/html", String(config.html || "")],
  ].filter(([, content]) => content.trim());
  const alternativeParts = [
    ...bodyFormats.flatMap(([contentType, content]) => [
      "--" + alternativeBoundary,
      "Content-Type: " + contentType + "; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: base64",
      "",
      splitMimeBase64Lines_(Buffer.from(content, "utf8").toString("base64")),
    ]),
    "--" + alternativeBoundary + "--",
    "",
  ];
  const parts = attachments.length ? [
    "--" + mixedBoundary,
    "Content-Type: multipart/alternative; boundary=\"" +
      alternativeBoundary + "\"",
    "",
    ...alternativeParts,
    ...attachments.flatMap((attachment) => {
      const filename = String(attachment.filename || "attachment")
          .replace(/[\r\n"]+/g, "-")
          .slice(0, 140);
      const contentType = String(
          attachment.contentType || "application/octet-stream",
      ).replace(/[\r\n;]+/g, "").slice(0, 100);
      return [
        "--" + mixedBoundary,
        "Content-Type: " + contentType + "; name=\"" + filename + "\"",
        "Content-Disposition: attachment; filename=\"" + filename + "\"",
        "Content-Transfer-Encoding: base64",
        "",
        splitMimeBase64Lines_(String(attachment.base64 || "")),
      ];
    }),
    "--" + mixedBoundary + "--",
    "",
  ] : alternativeParts;
  const mimeMessage = headers.concat([""], parts).join("\r\n");

  return Buffer.from(mimeMessage, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
}
