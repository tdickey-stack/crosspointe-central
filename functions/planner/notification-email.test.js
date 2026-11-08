/* eslint-disable require-jsdoc, max-len */

import test from "node:test";
import assert from "node:assert/strict";
import {buildCentralGmailRawMessage_} from "../helpers/gmail-message.js";
import {buildPlannerNotification} from "./request-notifications.js";

// Parse the MIME tree as a receiving client would, then inspect the preferred
// (last) alternative. This deliberately operates on the encoded wire message.
function parseMime(raw) {
  const separator = raw.indexOf("\r\n\r\n");
  assert.notEqual(separator, -1, "MIME entity must separate headers and body");
  const headers = Object.fromEntries(raw.slice(0, separator).split("\r\n").map((line) => {
    const colon = line.indexOf(":");
    assert.ok(colon > 0, `invalid header: ${line}`);
    return [line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()];
  }));
  const body = raw.slice(separator + 4);
  const type = headers["content-type"] || "text/plain";
  if (/^multipart\//i.test(type)) {
    const match = /boundary="?([^";]+)"?/i.exec(type);
    const boundary = match && match[1];
    assert.ok(boundary, "multipart entity requires a boundary");
    const sections = body.split(`--${boundary}`);
    assert.ok(sections.length >= 3, "multipart must contain parts and closing boundary");
    assert.ok(sections.at(-1).startsWith("--"), "multipart must close its boundary");
    return {headers, type: type.split(";")[0].toLowerCase(), parts: sections.slice(1, -1).map((part) => {
      assert.ok(part.startsWith("\r\n") && part.endsWith("\r\n"));
      return parseMime(part.slice(2, -2));
    })};
  }
  assert.equal((headers["content-transfer-encoding"] || "").toLowerCase(), "base64");
  return {headers, type: type.split(";")[0].toLowerCase(), content: Buffer.from(body.replace(/\s/g, ""), "base64")};
}

const submitted = buildPlannerNotification([{proposedName: "Café outreach", ministry: "Niños"}], "submitted");
const reminder = buildPlannerNotification([{proposedName: "Café outreach", ministry: "Niños"}], "reminder");
const attachment = {filename: "brief.txt", contentType: "text/plain", base64: Buffer.from("Attachment ☀").toString("base64")};
const cases = [
  {name: "submitted with omitted HTML", message: submitted, expected: [["text/plain", submitted.text]]},
  {name: "reminder with empty HTML", message: {...reminder, html: ""}, expected: [["text/plain", reminder.text]]},
  {name: "whitespace HTML", message: {subject: "Test", text: "Hello ☀", html: " \n "}, expected: [["text/plain", "Hello ☀"]]},
  {name: "HTML only", message: {subject: "Test", html: "<p>Bonjour ☀</p>"}, expected: [["text/html", "<p>Bonjour ☀</p>"]]},
  {name: "both alternatives", message: {subject: "Test", text: "Plain ☀", html: "<p>Rich ☀</p>"}, expected: [["text/plain", "Plain ☀"], ["text/html", "<p>Rich ☀</p>"]]},
];

for (const sample of cases) {
  for (const withAttachment of [false, true]) {
    test(`${sample.name}, ${withAttachment ? "with" : "without"} attachment`, () => {
      const encoded = buildCentralGmailRawMessage_({
        fromName: "CrossPointe", fromEmail: "sender@example.com", to: "recipient@example.com",
        replyTo: "reply@example.com", ...sample.message,
        attachments: withAttachment ? [attachment] : [],
      });
      assert.match(encoded, /^[A-Za-z0-9_-]+$/);
      const raw = Buffer.from(encoded, "base64url").toString("utf8");
      assert.doesNotMatch(raw, /(?<!\r)\n/);
      const root = parseMime(raw);
      assert.equal(root.headers.to, "recipient@example.com");
      assert.equal(root.headers["reply-to"], "reply@example.com");
      const subject = /^=\?UTF-8\?B\?([^?]+)\?=$/i.exec(root.headers.subject);
      assert.ok(subject, "subject should be MIME encoded");
      assert.equal(Buffer.from(subject[1], "base64").toString("utf8"), sample.message.subject);
      assert.equal(root.headers["mime-version"], "1.0");
      let content = root;
      if (withAttachment) {
        assert.equal(root.type, "multipart/mixed");
        assert.equal(root.parts.length, 2);
        content = root.parts[0];
        assert.match(root.parts[1].headers["content-disposition"], /attachment;.*brief\.txt/i);
        assert.equal(root.parts[1].content.toString(), "Attachment ☀");
      }
      const alternatives = content.type === "multipart/alternative" ? content.parts : [content];
      assert.deepEqual(alternatives.map((part) => [part.type, part.content.toString()]), sample.expected);
      assert.equal(alternatives.at(-1).content.toString(), sample.expected.at(-1)[1]);
    });
  }
}
