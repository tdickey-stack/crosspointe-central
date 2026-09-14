import sanitizeHtml from "sanitize-html";
import {parseDocument} from "htmlparser2";
import render from "dom-serializer";

const ALLOWED_TAGS = [
  "p", "br", "div", "strong", "b", "em", "i", "u", "ul", "ol", "li",
  "h2", "h3", "h4", "blockquote", "a",
];

/**
 * Extracts an optional CTA and preserves only supported event rich text.
 * Marker matching operates on decoded text nodes, including auto-linked URLs.
 * @param {*} value Planning Center HTML description.
 * @return {Object} Rich/plain descriptions, CTA fields, and validation warning.
 */
export function parseEventDescription(value) {
  const safeHtml = sanitizeHtml(String(value || ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {a: ["href", "target", "rel"]},
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          href: attribs.href || "",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
  const document = parseDocument(safeHtml);
  const nodes = [];
  let text = "";
  const visit = (node) => {
    if (node.type === "text") {
      nodes.push({
        node, start: text.length, end: text.length + node.data.length,
      });
      text += node.data;
    }
    for (const child of node.children || []) visit(child);
    if (["p", "div", "li", "br"].includes(node.name)) text += "\n";
  };
  visit(document);
  const markers = [...text.matchAll(
      /\{\s*button_(?:text|link)\s*:(?:[^{}]*\}|[^{}\n]*(?=\n|$))/gi,
  )];
  let registrationUrl = "";
  let buttonText = "";
  let warning = "";
  if (markers.length) {
    const normalized = markers[0][0]
        .replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
    const pattern = new RegExp(
        "^\\{\\s*button_text\\s*:\\s*([\"'])(.*?)\\1\\s*\\|\\s*" +
        "button_link\\s*:\\s*([\"'])(.*?)\\3\\s*\\}$", "is",
    );
    const match = normalized.match(pattern);
    if (markers.length === 1 && match && match[2].trim()) {
      try {
        const url = new URL(match[4].trim());
        if (url.protocol === "https:" && !url.username && !url.password) {
          registrationUrl = url.href;
          buttonText = match[2].trim();
        }
      } catch (error) {/* Invalid markers are hidden and reported below. */}
    }
    if (!registrationUrl) {
      warning = "Use one button marker with button_text " +
        "and a valid HTTPS button_link.";
    }
    // Remove matched text ranges without discarding surrounding formatting.
    for (const entry of nodes) {
      let data = entry.node.data;
      for (const marker of [...markers].reverse()) {
        const start = Math.max(entry.start, marker.index);
        const end = Math.min(entry.end, marker.index + marker[0].length);
        if (end > start) {
          data = data.slice(0, start - entry.start) +
            data.slice(end - entry.start);
        }
      }
      entry.node.data = data;
    }
  }
  const html = render(document)
      .replace(/<(p|div|a)\b[^>]*>\s*<\/\1>/gi, "").trim();
  let plain = "";
  const plainVisit = (node) => {
    if (node.type === "text") plain += node.data;
    if (node.name === "br") plain += "\n";
    if (node.name === "li") plain += "\n• ";
    for (const child of node.children || []) plainVisit(child);
    if (["p", "div", "h2", "h3", "h4", "blockquote"].includes(node.name)) {
      plain += "\n\n";
    } else if (["li", "ul", "ol"].includes(node.name)) {
      plain += "\n";
    }
  };
  plainVisit(document);
  return {
    description: plain.replace(/\u00a0/g, " ").replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n").trim(),
    description_html: html,
    registration_url: registrationUrl,
    registration_button_text: buttonText,
    cta_warning: warning,
  };
}
